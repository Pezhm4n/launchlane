import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { gunzipSync } from "node:zlib";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import { createPublicationMission, resumePublicationMission } from "../../src/server/application/publication-mission.ts";
import { proposeImportedEnvironment, executeEnvironment, observeEnvironment } from "../../src/server/application/environment.ts";
import { sealCredential } from "../../src/server/connections/credentials.ts";
import { connectedLiaraConfig } from "../../src/server/connections/liara.ts";
import { LiaraEnvironmentClient } from "../../src/server/liara/environment.ts";
import { AgentRepository } from "../../src/server/agent/store.ts";
import { GoalModelClient } from "../../src/server/agent/model.ts";
import { driveAgentRun, decideAgentRepair } from "../../src/server/agent/runs.ts";
import { currentEnvironment } from "../../src/server/environment/secrets.ts";
import { readArtifact } from "../../src/server/workspace/archive.ts";

test("the same guided mission imports its folder environment into real isolated build/test/start and retains no secret artifact", async () => {
  const f = await agentFixture(), secret = "synthetic-isolated-build-environment", expectedHash = createHash("sha256").update(secret).digest("hex");
  const signal = () => AbortSignal.timeout(120000);
  try {
    const config = { ...f.config, enableLocalRepair: true, enableLiveLiara: true, enableMutations: true, teamId: "a".repeat(24) }, actor = f.session.actorId;
    writeFileSync(join(f.project, "package.json"), JSON.stringify({ name: "environment-built-service", version: "1.0.0", type: "module", engines: { node: "22.x" }, scripts: { build: "node build.mjs", test: "node --test environment.test.mjs", start: "node server.mjs" } }));
    writeFileSync(join(f.project, "package-lock.json"), JSON.stringify({ name: "environment-built-service", version: "1.0.0", lockfileVersion: 3, packages: { "": { name: "environment-built-service", version: "1.0.0", engines: { node: "22.x" } } } }));
    const check = `import{createHash}from'node:crypto';import assert from'node:assert/strict';assert.equal(createHash('sha256').update(process.env.SERVICE_ACCESS??'').digest('hex'),'${expectedHash}');`;
    writeFileSync(join(f.project, "build.mjs"), check + "import{writeFileSync}from'node:fs';writeFileSync('.build-check','built');console.log(process.env.SERVICE_ACCESS);\n");
    writeFileSync(join(f.project, "environment.test.mjs"), check + "import{readFileSync}from'node:fs';import{test}from'node:test';test('the original build and environment criterion',()=>assert.equal(readFileSync('.build-check','utf8'),'built'));\n");
    writeFileSync(join(f.project, "server.mjs"), check + "import http from'node:http';import{readFileSync}from'node:fs';const ready=readFileSync('.build-check','utf8')==='built';http.createServer((_req,res)=>res.end(ready?'environment build ready':'not ready')).listen(3000);\n");
    writeFileSync(join(f.project, ".env"), `SERVICE_ACCESS=${secret}\nPORT=9876\n`);
    const flow = await prepareProjectFlow(config, f.store, actor, { kind: "local", directory: "service" }, signal());
    f.store.saveConnection(actor, { source: "token", ciphertext: sealCredential("synthetic-environment-build-provider-credential", config.sessionSecret, actor, "liara"), view: {
      provider: "liara", status: "connected", identityId: "b".repeat(24), teamId: config.teamId, teamName: "تیم آزمون", displayName: "آزمون", login: "test@example.test", checkedAt: Date.now(),
      apps: [{ id: "c".repeat(24), name: "environment-build", platform: "node" }], selectedApp: "environment-build" } });
    const repo = new AgentRepository(f.store), run = (await createPublicationMission(config, f.store, f.session, randomUUID(), { projectId: flow.id, sourceHash: flow.profile.sourceHash, path: "/", expectedText: "environment build ready" }, signal())).run;
    run.state = "needs_input"; run.nextAction = "configure_env"; repo.save(actor, run);
    let values: { key: string; value: string }[] = [], cloudWrites = 0;
    const client = new LiaraEnvironmentClient(connectedLiaraConfig(config, f.store, actor), async (_url, options) => {
      if (options.method === "POST") { values = JSON.parse(String(options.body)).variables; cloudWrites++; return new Response(""); }
      return Response.json({ project: { _id: "c".repeat(24), project_id: "environment-build", type: "node", planID: "g2-standard", envs: values } });
    });
    const env = await proposeImportedEnvironment(config, f.store, f.session, run.id, randomUUID(), [], signal(), { client });
    f.store.decide(env.id, actor, f.session.id, env.hash, "approve"); await executeEnvironment(config, f.store, f.session, env.id, signal(), { client }); await observeEnvironment(config, f.store, f.session, env.id, signal(), { client });
    const before = repo.get(actor, run.id); assert.ok(before); await resumePublicationMission(config, f.store, f.session, run.id, before.revision, randomUUID(), signal());
    let turn = 0;
    const model = new GoalModelClient(config, async () => {
      turn++; const name = turn === 1 ? "propose_project_build" : "finish_investigation", args = turn === 1
        ? { path: "/", status: 200, assertion: { kind: "text", contains: "environment build ready" } }
        : { state: "partially_completed", message: "ساخت و پاسخ همان نسخه جدا بررسی شد؛ انتشار در این آزمون انجام نمی‌شود.", question: null, nextAction: "reply" };
      return Response.json({ choices: [{ finish_reason: "tool_calls", message: { role: "assistant", tool_calls: [{ id: randomUUID(), type: "function", function: { name, arguments: JSON.stringify(args) } }] } }], usage: { total_tokens: 40 } });
    });
    await driveAgentRun(config, f.store, f.session, run.id, { model }); let current = repo.get(actor, run.id); assert.ok(current?.repair?.build);
    assert.deepEqual(current.repair.build.environment?.keys, ["SERVICE_ACCESS"]); assert.equal(current.state, "needs_approval"); assert.equal(JSON.stringify(current).includes(secret), false);
    await decideAgentRepair(config, f.store, f.session, current.id, current.revision, current.repair.id, "approve"); await driveAgentRun(config, f.store, f.session, run.id, { model });
    current = repo.get(actor, run.id); assert.ok(current?.repair); assert.equal(current.repair.state, "succeeded", current.repair.message);
    assert.equal(current.repair.afterTest?.passed, true); assert.equal(JSON.stringify(current).includes(secret), false); assert.ok(current.repair.afterTest?.output.includes("[REDACTED]"));
    const selected = f.store.getProjectFlow(actor); assert.ok(selected); assert.equal(selected.selection.kind, "repair");
    assert.ok(selected.artifact); assert.equal(gunzipSync(await readArtifact(config.stateDir, selected.artifact)).includes(Buffer.from(secret)), false);
    assert.deepEqual(currentEnvironment(f.store, config.sessionSecret, actor, selected.id), current.repair.build?.environment, "the tested descendant retains the exact original scoped reference");
    assert.equal(readFileSync(join(f.project, "build.mjs"), "utf8").includes(secret), false); assert.equal(cloudWrites, 1, "one synthetic env update; no publication");
    for (const id of current.repair.containerIds ?? []) assert.notEqual(spawnSync("docker", ["inspect", id], { windowsHide: true, encoding: "utf8", timeout: 10000 }).status, 0, "only this job's container must be removed");
    assert.equal(current.repair.containerIds?.length, 1);
  } finally { f.close(); }
});
