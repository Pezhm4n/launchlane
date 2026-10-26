import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import { parseEnvironmentFiles, saveImportedEnvironment } from "../../src/server/environment/import.ts";
import { buildEnvironmentValues, sourceBuildEnvironment, matchesPublishedBuildEnvironment } from "../../src/server/environment/build.ts";
import { currentAgentContext, executeAgentTool } from "../../src/server/agent/tools.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";
import { AppError } from "../../src/server/errors.ts";
import { parseCodeRepairJob } from "../../src/contracts/code-repair.ts";
import { nodeBuildRuntime, parseProjectBuildPlan } from "../../src/contracts/project-build.ts";
import { planFolderUpload } from "../../src/contracts/folder-upload.ts";
import { object } from "../../src/contracts/validation.ts";
import { fingerprint } from "../../src/server/policy/action.ts";
import { createPublicationMission } from "../../src/server/application/publication-mission.ts";
import { executeEnvironment, observeEnvironment, proposeEnvironment } from "../../src/server/application/environment.ts";
import { AgentRepository } from "../../src/server/agent/store.ts";
import { sealCredential } from "../../src/server/connections/credentials.ts";
import { connectedLiaraConfig } from "../../src/server/connections/liara.ts";
import { LiaraEnvironmentClient } from "../../src/server/liara/environment.ts";

const code = (expected: string) => (error: unknown) => error instanceof AppError && error.code === expected;
async function fixture() {
  const f = await agentFixture();
  await writeFile(join(f.project, "server.mjs"), "import http from 'node:http';const env=process.env.SESSION_SECRET;http.createServer((q,s)=>s.end(env?'ready':'missing')).listen(3000);");
  const flow = await prepareProjectFlow(f.config, f.store, f.session.actorId, { kind: "local", directory: "service" }, AbortSignal.timeout(5000));
  const values = [{ key: "SESSION_SECRET", value: "private-source-build-fixture-value" }];
  saveImportedEnvironment(f.config, f.store, f.session.actorId, flow, values);
  return { ...f, flow, values };
}
test("Cloudflare local env files are private upload inputs with explicit overlay order, never source archive entries", () => {
  const files = [{ path: "qadam/package.json", size: 2 }, { path: "qadam/.dev.vars", size: 24 }, { path: "qadam/.dev.vars.local", size: 24 }, { path: "qadam/sub/.dev.vars", size: 24 }];
  const planned = planFolderUpload(files);
  assert.deepEqual(planned.files.map(row => row.path), ["package.json"]);
  assert.deepEqual(planned.environmentFiles.map(row => row.name), [".dev.vars", ".dev.vars.local"]);
  assert.deepEqual(parseEnvironmentFiles([{ name: ".dev.vars", content: "SESSION_SECRET=first-value" }, { name: ".dev.vars.local", content: "SESSION_SECRET=second-value" },
    { name: ".env.production", content: "SESSION_SECRET=production-value" }]), [{ key: "SESSION_SECRET", value: "production-value" }]);
  assert.throws(() => parseEnvironmentFiles([{ name: ".dev.vars.example", content: "KEY=some-value" }]), code("INVALID_ENV_FILE"));
});
test("build approval references existing encrypted source input without creating or claiming a cloud env action", async () => {
  const f = await fixture();try {
    const actor = f.session.actorId, reference = sourceBuildEnvironment(f.config, f.store, actor, f.flow.id);assert.ok(reference);
    assert.deepEqual(reference.keys, ["SESSION_SECRET"]);assert.equal(reference.sourceHash, f.flow.profile.sourceHash);
    assert.deepEqual(buildEnvironmentValues(f.config, f.store, actor, f.flow.id, null, reference), f.values);
    const encoded = JSON.stringify(f.store.db.prepare("SELECT * FROM environment_inputs").all());assert.ok(!encoded.includes(f.values[0]?.value ?? "missing"));
    const config = { ...f.config, enableLocalRepair: true }, context = { config, store: f.store, actorId: actor, context: currentAgentContext(config, f.store, actor), createdAt: Date.now(), budget: new RunBudget(config), signal: AbortSignal.timeout(10000) };
    const result = object(await executeAgentTool("propose_project_build", { path: "/", status: 200, assertion: { kind: "text", contains: "ready" } }, context)), job = parseCodeRepairJob(result.repairProposal);
    assert.equal(job.state, "proposed");assert.ok(job.build && job.build.version !== 6);assert.deepEqual(job.build.sourceEnvironment, reference);
    assert.equal(job.build.environment, null);assert.equal(job.artifact, null);assert.equal(job.afterTest, null);
    assert.ok(!JSON.stringify(result).includes(f.values[0]?.value ?? "missing"));
    assert.equal(f.store.db.prepare("SELECT count(*) n FROM actions").get()?.n, 0);
    assert.equal(f.store.db.prepare("SELECT count(*) n FROM attempts").get()?.n, 0);
    assert.equal(matchesPublishedBuildEnvironment(f.config, f.store, actor, f.flow.id, job.build), false, "a private input is not verified cloud configuration");
  } finally { f.close(); }
});
test("changed values, actor, source, reference keys and expiry cannot reuse the local build's private input", async () => {
  const f = await fixture();try {
    const actor = f.session.actorId, reference = sourceBuildEnvironment(f.config, f.store, actor, f.flow.id);assert.ok(reference);
    assert.throws(() => buildEnvironmentValues(f.config, f.store, "foreign-actor", f.flow.id, null, reference));
    for (const changed of [{ ...reference, sourceHash: "a".repeat(64) }, { ...reference, projectId: randomUUID() }, { ...reference, keys: ["UNREVIEWED"] }])
      assert.throws(() => buildEnvironmentValues(f.config, f.store, actor, f.flow.id, null, changed), code("ENV_REFERENCE_CHANGED"));
    saveImportedEnvironment(f.config, f.store, actor, f.flow, [{ key: "SESSION_SECRET", value: "changed-private-fixture-value" }]);
    assert.throws(() => buildEnvironmentValues(f.config, f.store, actor, f.flow.id, null, reference), code("ENV_REFERENCE_CHANGED"));
    const next = sourceBuildEnvironment(f.config, f.store, actor, f.flow.id);assert.ok(next);
    f.store.db.prepare("UPDATE environment_inputs SET expires_at=0 WHERE actor_id=?").run(actor);
    assert.throws(() => buildEnvironmentValues(f.config, f.store, actor, f.flow.id, null, next), code("ENV_INPUT_EXPIRED"));
  } finally { f.close(); }
});

test("only verified cloud configuration with the exact privately tested values can satisfy publication binding", async () => {
  const f = await fixture();try {
    const actor = f.session.actorId, sourceEnvironment = sourceBuildEnvironment(f.config, f.store, actor, f.flow.id);assert.ok(sourceEnvironment);
    const build = parseProjectBuildPlan({ ...nodeBuildRuntime("22"), buildCommand: null, testCommand: "node --test", startCommand: "node server.mjs", port: 3000,
      workload: { path: "/", status: 200, assertion: { kind: "text", contains: "ready" } }, environment: null, sourceEnvironment });
    const app = "source-env-fixture", teamId = "a".repeat(24), targetId = "b".repeat(24), config = { ...f.config, teamId, apps: [app], enableLiveLiara: true, enableMutations: true };
    f.store.saveConnection(actor, { source: "token", ciphertext: sealCredential("synthetic-provider-fixture", config.sessionSecret, actor, "liara"),
      view: { provider: "liara", status: "connected", identityId: "c".repeat(24), displayName: "Fixture", login: "fixture@example.test", teamId, teamName: "Fixture", selectedApp: app,
        apps: [{ id: targetId, name: app, platform: "node" }], checkedAt: Date.now() } });
    let variables: { key: string; value: string }[] = [], writes = 0;
    const client = new LiaraEnvironmentClient(connectedLiaraConfig(config, f.store, actor, app), async (_url, init) => {
      if (init?.method === "POST") {
        writes++;const body = object(JSON.parse(String(init.body)));assert.ok(Array.isArray(body.variables));
        variables = body.variables.map(value => { const row = object(value);assert.equal(typeof row.key, "string");assert.equal(typeof row.value, "string");return { key: String(row.key), value: String(row.value) }; });return new Response("");
      }
      return Response.json({ project: { _id: targetId, project_id: app, type: "node", status: "running", planID: "fixture-plan", envs: variables.map(row => ({ ...row, encrypted: false })) } });
    });
    for (const [index, value] of ["private-source-build-fixture-value", "changed-cloud-fixture-value"].entries()) {
      const repo = new AgentRepository(f.store), mission = (await createPublicationMission(config, f.store, f.session, randomUUID(),
        { projectId: f.flow.id, sourceHash: f.flow.profile.sourceHash, path: "/", expectedText: "ready" }, AbortSignal.timeout(5000))).run;
      mission.state = "needs_input";mission.nextAction = "configure_env";repo.save(actor, mission);
      const action = await proposeEnvironment(config, f.store, f.session, mission.id, randomUUID(), [{ key: "SESSION_SECRET", value }], AbortSignal.timeout(5000), { client });
      assert.equal(matchesPublishedBuildEnvironment(config, f.store, actor, f.flow.id, build), index === 1, "proposing a replacement must not fabricate verified configuration");
      f.store.decide(action.id, actor, f.session.id, action.hash, "approve");
      await executeEnvironment(config, f.store, f.session, action.id, AbortSignal.timeout(5000), { client });
      const observed = await observeEnvironment(config, f.store, f.session, action.id, AbortSignal.timeout(5000), { client });
      assert.equal(observed.state, "succeeded");assert.equal(observed.environment?.outcome, "verified");
      assert.equal(matchesPublishedBuildEnvironment(config, f.store, actor, f.flow.id, build), index === 0);
    }
    assert.equal(writes, 2, "synthetic provider writes only, both through approval, journal and observation");
  } finally { f.close(); }
});
test("public inputs need their own review, corrupt ciphertext stays fatal and old build canonicalization is unchanged", async () => {
  const f = await fixture();try {
    const actor = f.session.actorId, reference = sourceBuildEnvironment(f.config, f.store, actor, f.flow.id);assert.ok(reference);
    const historical = { ...nodeBuildRuntime("22"), buildCommand: null, testCommand: null, startCommand: "node server.mjs", port: 3000,
      workload: { path: "/", status: 200, assertion: { kind: "text", contains: "ready" } }, environment: null };
    assert.equal(fingerprint(parseProjectBuildPlan(historical)), fingerprint(historical));
    assert.throws(() => parseProjectBuildPlan({ ...historical, environment: { actionId: randomUUID(), fingerprint: "a".repeat(64), keys: [] }, sourceEnvironment: reference }), code("INVALID_ENV_REFERENCE"));
    await writeFile(join(f.project, "public.mjs"), "export const url=process.env.VITE_API_URL;");
    const flow = await prepareProjectFlow(f.config, f.store, actor, { kind: "local", directory: "service" }, AbortSignal.timeout(5000));
    saveImportedEnvironment(f.config, f.store, actor, flow, [{ key: "VITE_API_URL", value: "https://example.test" }]);
    assert.throws(() => sourceBuildEnvironment(f.config, f.store, actor, flow.id), code("PUBLIC_BUILD_ENV_REVIEW_REQUIRED"));
    f.store.db.prepare("UPDATE environment_inputs SET ciphertext='source-v1.corrupted' WHERE actor_id=?").run(actor);
    assert.throws(() => buildEnvironmentValues(f.config, f.store, actor, f.flow.id, null, reference), code("ENV_STORAGE_INVALID"));
  } finally { f.close(); }
});
