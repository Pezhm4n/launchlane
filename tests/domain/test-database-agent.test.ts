import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { parseCodeRepairJob } from "../../src/contracts/code-repair.ts";
import { fullstackTestCommand } from "../../src/contracts/fullstack.ts";
import { nodeBuildRuntime, parseProjectBuildPlan, projectBuildImage } from "../../src/contracts/project-build.ts";
import { postgresTestImage } from "../../src/contracts/test-database.ts";
import { object } from "../../src/contracts/validation.ts";
import type { CommandResult, docker } from "../../src/server/agent/container.ts";
import { CodeRepairAdapter } from "../../src/server/agent/code-repair.ts";
import { sandboxProxyKeys } from "../../src/server/agent/docker-proxy.ts";
import { fullstackPreparation } from "../../src/server/agent/fullstack-preparation.ts";
import { GoalModelClient } from "../../src/server/agent/model.ts";
import { createAgentRun, decideAgentRepair, driveAgentRun } from "../../src/server/agent/runs.ts";
import { AgentRepository } from "../../src/server/agent/store.ts";
import { currentAgentContext, executeAgentTool, toolsForAgent } from "../../src/server/agent/tools.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import { createPublicationMission } from "../../src/server/application/publication-mission.ts";
import { executeEnvironment, observeEnvironment, proposeEnvironment } from "../../src/server/application/environment.ts";
import { sealCredential } from "../../src/server/connections/credentials.ts";
import { connectedLiaraConfig } from "../../src/server/connections/liara.ts";
import { importedEnvironment, saveImportedEnvironment } from "../../src/server/environment/import.ts";
import { currentEnvironment, projectEnvironmentValues } from "../../src/server/environment/secrets.ts";
import { LiaraEnvironmentClient } from "../../src/server/liara/environment.ts";
import { callMcpTool, mcpTools } from "../../src/server/mcp/server.ts";
import { fingerprint } from "../../src/server/policy/action.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";
import { captureProject } from "../../src/server/workspace/inspect.ts";
import { agentFixture } from "../helpers/agent-fixture.ts";

const compatibilityDatabase = { environmentKeys: ["AUTH_DB_URL", "AI_HISTORY_TEST_DB_URL"], requiredRelations: ["public.users"] };
const args = { path: "/", status: 200, assertion: { kind: "text", contains: "Controlled full application" },
  apiChecks: [{ path: "/health/db", status: 200, assertions: [{ pointer: ["auth", "ok"], equals: true }] }] };
const fixtureValue = "postgresql://synthetic-only.invalid/private-value";
async function fixture() {
  const f = await agentFixture();
  try {
    const files: Record<string, string> = {
      "package.json": JSON.stringify({ name: "controlled-agent-database", engines: { node: "22" },
        scripts: { start: "node frontend-server.cjs", server: "node server.cjs", build: "node build.cjs", "test:db": "node --test integration.test.mjs" },
        dependencies: { react: "18", express: "4", pg: "8" }, devDependencies: { vite: "6" } }),
      "package-lock.json": JSON.stringify({ lockfileVersion: 3, packages: {} }),
      "vite.config.ts": "export default {build:{outDir:'build'}};",
      "frontend-server.cjs": "// inert controlled source, never run on the host",
      "build.cjs": "// compiler transport is synthetic",
      "server.cjs": "const express=require('express'),{Pool}=require('pg');const pool=new Pool({connectionString:process.env.AUTH_DB_URL});const app=express();app.use(express.static('build'));app.listen(3000);",
      "schema.sql": "CREATE TABLE IF NOT EXISTS public.users(id integer PRIMARY KEY);",
      "integration.test.mjs": "import {test} from 'node:test';test('original database oracle',()=>{if(!process.env.AI_HISTORY_TEST_DB_URL)throw Error('test database required')});",
    };
    for (const [path, content] of Object.entries(files)) await writeFile(join(f.project, path), content);
    const config = { ...f.config, enableLocalRepair: true };
    const flow = await prepareProjectFlow(config, f.store, f.session.actorId, { kind: "local", directory: "service" }, AbortSignal.timeout(10000));
    return { ...f, config, flow };
  } catch (error) { f.close(); throw error; }
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function context(f: Fixture) {
  return { config: f.config, store: f.store, actorId: f.session.actorId, context: currentAgentContext(f.config, f.store, f.session.actorId),
    budget: new RunBudget(f.config), createdAt: Date.now(), signal: AbortSignal.timeout(10000) };
}
async function propose(f: Fixture, value: unknown, previous?: ReturnType<typeof parseCodeRepairJob>, explicitBuildRetry = false) {
  return parseCodeRepairJob(object(await executeAgentTool("propose_project_build", value, { ...context(f), ...(previous ? { buildJob: previous } : {}), explicitBuildRetry })).repairProposal);
}

// Only Docker's command transport is synthetic. No Docker process, registry, npm download,
// PostgreSQL, compiler or project script executes in these tool/mission boundary tests.
function syntheticEngine(f: Fixture, failApplication = false) {
  const pgId = "1".repeat(64), nodeId = "2".repeat(64), actualImage = "sha256:392c708576858a9a583a1b937503a99df57ca5dae63890748f4d0f2fc848abc6";
  let pg = false, node = false, running = false, jobId = "", hash = "";
  const calls: string[][] = [];
  const result = (output = "", exitCode: number | null = 0): CommandResult => ({ output, exitCode, signal: null });
  const command: typeof docker = async (raw, _signal, _limit, input) => {
    assert.deepEqual(raw.slice(0, 2), ["--host", "unix:///var/run/docker.sock"]);
    const a = raw.slice(2); calls.push(a);
    if (a[0] === "image") return result(JSON.stringify({ id: actualImage, os: "linux", architecture: "amd64", digests: [`postgres@${postgresTestImage.split("@")[1]}`], volumes: { "/var/lib/postgresql/data": {} }, onBuild: null }));
    if (a[0] === "create") {
      const labels = new Map<string, string>();
      for (const [i, value] of a.entries()) if (value === "--label") {
        const label = a[i + 1]; assert.ok(label); const at = label.indexOf("="); labels.set(label.slice(0, at), label.slice(at + 1));
      }
      jobId = labels.get("ir.launchlane.job") ?? ""; hash = labels.get("ir.launchlane.source") ?? "";
      const row = f.store.db.prepare("SELECT data_json FROM code_repair_jobs WHERE id=?").get(jobId); assert.ok(row);
      assert.equal(object(object(JSON.parse(String(row.data_json))).job).postgresExecutionStarted, true);
      for (const key of sandboxProxyKeys) assert.ok(a.some((value, i) => value === "--env" && a[i + 1] === `${key}=`));
      if (a.includes(postgresTestImage)) { pg = true; return result(pgId); }
      assert.equal(running, true); assert.equal(a[a.indexOf("--network") + 1], `container:${pgId}`); node = true; return result(nodeId);
    }
    if (a[0] === "inspect") {
      const ref = a.at(-1), isPg = ref === pgId || ref === `launchlane-postgres-${jobId}`;
      if (!(isPg ? pg : ref === nodeId && node)) return result(`Error: No such container: ${ref}`, 1);
      if (a.includes("{{json .State}}")) return result(JSON.stringify({ Running: true, OOMKilled: false }));
      const base = { id: isPg ? pgId : nodeId, name: isPg ? `/launchlane-postgres-${jobId}` : `/launchlane-build-${jobId}`, image: isPg ? postgresTestImage : projectBuildImage,
        labels: { "ir.launchlane.worker": isPg ? "postgres-fixture-v1" : "locked-build-v1", "ir.launchlane.job": jobId, "ir.launchlane.source": hash },
        env: sandboxProxyKeys.map(key => `${key}=`), network: `container:${pgId}`, ports: null };
      return result(JSON.stringify(isPg ? { ...base, actualImage, running, oom: false, user: "999:999", mounts: [], networks: running ? { none: {} } : {}, host: {
        ReadonlyRootfs: true, Privileged: false, NetworkMode: "none", PublishAllPorts: false, PortBindings: null, Binds: null, Mounts: [], Devices: [], CapAdd: null,
        CapDrop: ["ALL"], SecurityOpt: ["no-new-privileges"], Memory: 536870912, MemorySwap: 536870912, NanoCpus: 250000000, PidsLimit: 128, PidMode: "", IpcMode: "private",
        RestartPolicy: { Name: "no" }, LogConfig: { Type: "none" }, Tmpfs: { "/var/lib/postgresql/data": "rw,nosuid,nodev,noexec,size=268435456,uid=999,gid=999,mode=0700", "/var/run/postgresql": "rw,nosuid,nodev,noexec,size=16777216,uid=999,gid=999,mode=0700" },
      } } : base));
    }
    if (a[0] === "start") { if (a[1] === pgId) running = true; return result(a[1]); }
    if (a[0] === "exec") {
      if (a.includes("pg_isready")) return result();
      if (a.includes("/proc/self/mountinfo")) return result(["/var/lib/postgresql/data", "/var/run/postgresql"].map(path => `1 0 0:2 / ${path} rw,nosuid,nodev,noexec - tmpfs tmpfs rw`).join("\n"));
      assert.ok(input); const payload = object(JSON.parse(input.toString())); assert.deepEqual(payload.environment, []);
      assert.equal(input.includes(Buffer.from(fixtureValue)), false); assert.equal(input.includes(Buffer.from(f.config.modelKey)), false);
      assert.equal(object(payload.testDatabase).jobId, jobId); assert.equal(object(payload.testDatabase).sourceHash, hash);
      return result(failApplication ? "Original application database oracle failed" : "Synthetic Docker command transport returned success", failApplication ? 1 : 0);
    }
    if (a[0] === "rm") { if (a.at(-1) === nodeId) node = false; else pg = false; return result(a.at(-1)); }
    throw Error(`Unexpected synthetic command: ${a[0]}`);
  };
  return { command, calls, endpoint: { socketPath: "/var/run/docker.sock" } };
}

test("existing build tool accepts only source-proven names and host-binds disposable database scope", async () => {
  const f = await fixture(); try {
    const definition = toolsForAgent(f.config, "build").find(tool => tool.function.name === "propose_project_build"); assert.ok(definition);
    const schema = object(object(definition.function.parameters.properties).compatibilityDatabase);
    assert.deepEqual(Object.keys(object(schema.properties)).sort(), ["environmentKeys", "migration", "requiredRelations"]);
    for (const bad of [
      { ...compatibilityDatabase, image: "postgres:latest" }, { ...compatibilityDatabase, url: fixtureValue },
      { ...compatibilityDatabase, purpose: "production" }, { ...compatibilityDatabase, environmentKeys: ["VITE_DATABASE_URL"] },
      { ...compatibilityDatabase, environmentKeys: ["UNKNOWN_DB_URL"] }, { ...compatibilityDatabase, requiredRelations: ["public.unknown"] },
      { ...compatibilityDatabase, requiredRelations: ["pg_catalog.pg_authid"] },
    ]) await assert.rejects(propose(f, { ...args, compatibilityDatabase: bad }));
    const job = await propose(f, { ...args, compatibilityDatabase });
    assert.equal(job.state, "proposed"); assert.equal(job.baseRevision, f.flow.profile.sourceHash); assert.equal(job.afterTest, null);
    assert.ok(job.build?.version === 7); assert.deepEqual(job.build.testDatabase, { version: 1, kind: "postgresql", purpose: "compatibility_test", image: postgresTestImage,
      environmentKeys: [...compatibilityDatabase.environmentKeys].sort(), requiredRelations: ["public.users"] });
    assert.equal(job.build.environment, null); assert.equal(job.artifact, null); assert.equal(job.publication, undefined); assert.deepEqual(job.containerIds, []);
  } finally { f.close(); }
});

test("ordinary v7 canonical plan stays unchanged and a failed ordinary build may gain a database without weakening its oracle", async () => {
  const f = await fixture(); try {
    const ordinary = await propose(f, args); assert.ok(ordinary.build?.version === 7); assert.equal("testDatabase" in ordinary.build, false);
    const captured = await captureProject(f.project, "."), preparation = fullstackPreparation(captured.files, captured.profile);
    const expected = parseProjectBuildPlan({ ...nodeBuildRuntime(preparation.nodeVersion), version: 7, fullstack: preparation, apiChecks: args.apiChecks,
      buildCommand: preparation.buildCommand, testCommand: fullstackTestCommand(preparation), startCommand: preparation.startCommand, port: preparation.port,
      workload: { path: args.path, status: args.status, assertion: args.assertion }, environment: null });
    assert.equal(fingerprint(ordinary.build), fingerprint(expected));
    await assert.rejects(propose(f, args, { ...ordinary, state: "failed", validationOnly: true }), { code: "BUILD_NO_PROGRESS" });
    const compatibility = await propose(f, { ...args, compatibilityDatabase }, { ...ordinary, state: "failed" }); assert.ok(compatibility.build?.version === 7);
    assert.deepEqual(compatibility.build.workload, ordinary.build.workload); assert.deepEqual(compatibility.build.apiChecks, ordinary.build.apiChecks);
    await assert.rejects(propose(f, args, compatibility), { code: "MISSION_EXPECTATION_CHANGED" });
    await assert.rejects(propose(f, { ...args, compatibilityDatabase }, { ...compatibility, state: "failed" }), { code: "BUILD_NO_PROGRESS" });
    assert.equal((await propose(f, { ...args, compatibilityDatabase }, { ...compatibility, state: "failed" }, true)).state, "proposed");
    await assert.rejects(propose(f, { ...args, compatibilityDatabase: { ...compatibilityDatabase, environmentKeys: ["AUTH_DB_URL"] } }, compatibility), { code: "MISSION_EXPECTATION_CHANGED" });
    await assert.rejects(propose(f, { ...args, compatibilityDatabase, apiChecks: [{ ...args.apiChecks[0], path: "/other" }] }, compatibility), { code: "MISSION_EXPECTATION_CHANGED" });
  } finally { f.close(); }
});

test("Agent driver pauses for its real approval then retains limited compatibility receipt without selecting or publishing an artifact", async () => {
  const f = await fixture(); try {
    saveImportedEnvironment(f.config, f.store, f.session.actorId, f.flow, [{ key: "AUTH_DB_URL", value: fixtureValue }]);
    const vaultBefore = f.store.db.prepare("SELECT * FROM environment_inputs").all();
    const oracleBefore = await readFile(join(f.project, "integration.test.mjs")), engine = syntheticEngine(f); let sends = 0;
    const model = new GoalModelClient(f.config, async () => { sends++; return Response.json({ choices: [{ finish_reason: "tool_calls", message: { role: "assistant", tool_calls: [{ id: randomUUID(), type: "function", function: sends === 1
      ? { name: "propose_project_build", arguments: JSON.stringify({ ...args, compatibilityDatabase }) }
      : { name: "finish_investigation", arguments: JSON.stringify({ state: "partially_completed", message: "آزمون سازگاری گذشت؛ انتشار هنوز انجام نشده است.", question: null, nextAction: "reply" }) } }] } }], usage: { total_tokens: 10 } }); });
    const initial = createAgentRun(f.config, f.store, f.session, randomUUID(), "آزمون سازگاری با داده ساختگی؛ انتشار بعداً", f.flow.id).run;
    const dependencies = { model, repairSandbox: engine };
    await driveAgentRun(f.config, f.store, f.session, initial.id, dependencies);
    const repo = new AgentRepository(f.store), proposed = repo.get(f.session.actorId, initial.id); assert.ok(proposed?.repair);
    assert.equal(proposed.state, "needs_approval"); assert.equal(engine.calls.length, 0); assert.equal(sends, 1);
    const approved = await decideAgentRepair(f.config, f.store, f.session, proposed.id, proposed.revision, proposed.repair.id, "approve");
    assert.equal(approved.state, "queued"); assert.equal(approved.repairDecision?.consumed, true);
    await driveAgentRun(f.config, f.store, f.session, initial.id, dependencies);
    const done = repo.get(f.session.actorId, initial.id); assert.ok(done?.repair);
    assert.equal(done.state, "partially_completed"); assert.equal(done.repair.state, "succeeded", done.repair.message);
    assert.equal(done.repair.afterTest?.passed, true); assert.equal(done.repair.artifact, null); assert.equal(done.repair.publication, undefined);
    assert.equal(done.repair.afterTest?.buildOutput, undefined); assert.equal(done.repair.postgresExecutionStarted, undefined);
    assert.equal(done.projectId, f.flow.id); assert.equal(done.context.sourceHash, f.flow.profile.sourceHash); assert.equal(done.effect, "no_remote_changes");
    assert.ok(done.messages.some(message => message.content?.includes('"publishable":false') && message.content.includes('"selectedTestedArtifact":false')));
    assert.equal(done.usage.modelCalls, 2); assert.equal(sends, 2); assert.ok(done.usage.toolCalls > proposed.usage.toolCalls);
    assert.equal(f.store.listActions(f.session.actorId).length, 0); assert.ok((await readFile(join(f.project, "integration.test.mjs"))).equals(oracleBefore));
    assert.deepEqual(f.store.db.prepare("SELECT * FROM environment_inputs").all(), vaultBefore);
    assert.deepEqual(importedEnvironment(f.config, f.store, f.session.actorId, f.flow.id), [{ key: "AUTH_DB_URL", value: fixtureValue }]);
  } finally { f.close(); }
});

test("MCP publication lifecycle uses the same approved Agent build registry; direct build execution is not exposed", async () => {
  const f = await fixture(); try {
    const app = "compatibility-fixture", teamId = "a".repeat(24), targetId = "b".repeat(24);
    const config = { ...f.config, teamId, apps: [app] };
    f.store.saveConnection(f.session.actorId, { source: "token", ciphertext: sealCredential("synthetic-provider-only", f.config.sessionSecret, f.session.actorId, "liara"),
      view: { provider: "liara", status: "connected", identityId: "fixture-account", displayName: "Fixture", login: "fixture@example.test", teamId, teamName: "Fixture", selectedApp: app,
        apps: [{ id: targetId, name: app, platform: "node" }], checkedAt: Date.now() } });
    const access = { session: f.session, parentSessionId: f.session.id, missions: true }, tasks: (() => Promise<void>)[] = [];
    const c = { config, store: f.store, access, schedule: (work: () => Promise<void>) => { tasks.push(work); } };
    assert.equal(mcpTools(config, access).some(tool => tool.name === "propose_project_build"), false);
    const readOnly = { ...c, access: { ...access, missions: false } };
    assert.equal((await callMcpTool(readOnly, "launchlane_publish", {}, AbortSignal.timeout(1000))).isError, true);
    assert.equal(tasks.length, 0);
    const denied = await callMcpTool(c, "propose_project_build", { ...args, compatibilityDatabase }, AbortSignal.timeout(1000)); assert.equal(denied.isError, true);
    const input = { requestKey: randomUUID(), publication: { projectId: f.flow.id, sourceHash: f.flow.profile.sourceHash, path: "/", expectedText: args.assertion.contains } };
    const result = await callMcpTool(c, "launchlane_publish", input, AbortSignal.timeout(10000)); assert.notEqual(result.isError, true);
    assert.equal(tasks.length, 1, "capture scheduling; never invoke the closure with the live/default model");
    const id = String(object(object(object(result.structuredContent).data).run).id), engine = syntheticEngine(f);
    let sends = 0;
    const model = new GoalModelClient(config, async () => { sends++; return Response.json({ choices: [{ finish_reason: "tool_calls", message: { role: "assistant", tool_calls: [{ id: randomUUID(), type: "function", function: sends === 1
      ? { name: "propose_project_build", arguments: JSON.stringify({ ...args, compatibilityDatabase }) }
      : { name: "finish_investigation", arguments: JSON.stringify({ state: "partially_completed", message: "آزمون داده ساختگی تمام شد؛ مقصد تولید هنوز آماده نیست.", question: null, nextAction: "reply" }) } }] } }], usage: { total_tokens: 10 } }); });
    const dependencies = { model, repairSandbox: engine };
    // Same scheduled driver, with explicit synthetic model/command dependencies at this seam.
    await driveAgentRun(config, f.store, f.session, id, dependencies);
    const repo = new AgentRepository(f.store), proposed = repo.get(f.session.actorId, id);
    assert.ok(proposed?.repair, JSON.stringify({ state: proposed?.state, code: proposed?.errorCode, events: proposed?.events.slice(-3) }));
    assert.equal(proposed.state, "needs_approval"); assert.equal(engine.calls.length, 0);
    await decideAgentRepair(config, f.store, f.session, id, proposed.revision, proposed.repair.id, "approve");
    await driveAgentRun(config, f.store, f.session, id, dependencies);
    const done = repo.get(f.session.actorId, id); assert.equal(done?.state, "partially_completed"); assert.equal(done?.repair?.state, "succeeded");
    assert.equal(done?.projectId, f.flow.id); assert.equal(done?.repair?.artifact, null); assert.equal(done?.publication, null);
    const readback = await callMcpTool(c, "launchlane_mission", { id }, AbortSignal.timeout(1000)); assert.notEqual(readback.isError, true);
    const view = object(object(object(readback.structuredContent).data).run); assert.equal(view.state, "partially_completed");
    assert.equal(f.store.listActions(f.session.actorId).length, 0); assert.equal(tasks.length, 1);
  } finally { f.close(); }
});

test("rejected or expired compatibility approval never starts an engine or manufactures a passing receipt", async () => {
  for (const mode of ["reject", "expire"] as const) {
    const f = await fixture(); try {
      const engine = syntheticEngine(f), model = new GoalModelClient(f.config, async () => Response.json({ choices: [{ finish_reason: "tool_calls", message: {
        role: "assistant", tool_calls: [{ id: randomUUID(), type: "function", function: { name: "propose_project_build", arguments: JSON.stringify({ ...args, compatibilityDatabase }) } }],
      } }], usage: { total_tokens: 10 } }));
      const run = createAgentRun(f.config, f.store, f.session, randomUUID(), "آزمون محدود سازگاری", f.flow.id).run;
      await driveAgentRun(f.config, f.store, f.session, run.id, { model, repairSandbox: engine });
      const repo = new AgentRepository(f.store), proposed = repo.get(f.session.actorId, run.id); assert.ok(proposed?.repair && proposed.repairDecision);
      if (mode === "reject") {
        const rejected = await decideAgentRepair(f.config, f.store, f.session, proposed.id, proposed.revision, proposed.repair.id, "reject");
        assert.equal(rejected.repair?.state, "cancelled");
      } else {
        proposed.repairDecision.expiresAt = Date.now() - 1; repo.save(f.session.actorId, proposed);
        const expired = repo.get(f.session.actorId, run.id); assert.ok(expired?.repair);
        await assert.rejects(decideAgentRepair(f.config, f.store, f.session, expired.id, expired.revision, expired.repair.id, "approve"), { code: "REPAIR_APPROVAL_EXPIRED" });
      }
      const final = repo.get(f.session.actorId, run.id); assert.equal(engine.calls.length, 0);
      assert.equal(final?.repair?.afterTest, null); assert.equal(final?.repair?.artifact, null); assert.equal(final?.publication, null);
      assert.equal(f.store.listActions(f.session.actorId).length, 0);
    } finally { f.close(); }
  }
});

test("failed application oracle returns failure to the same Agent goal without compatibility success or publication", async () => {
  const f = await fixture(); try {
    const engine = syntheticEngine(f, true); let sends = 0;
    const model = new GoalModelClient(f.config, async () => { sends++; return Response.json({ choices: [{ finish_reason: "tool_calls", message: { role: "assistant", tool_calls: [{ id: randomUUID(), type: "function", function: sends === 1
      ? { name: "propose_project_build", arguments: JSON.stringify({ ...args, compatibilityDatabase }) }
      : { name: "finish_investigation", arguments: JSON.stringify({ state: "partially_completed", message: "آزمون برنامه خطا داد؛ شواهد برای ادامه حفظ شد.", question: null, nextAction: "reply" }) } }] } }], usage: { total_tokens: 10 } }); });
    const run = createAgentRun(f.config, f.store, f.session, randomUUID(), "علت شکست برنامه را با دیتابیس ساختگی بررسی کن", f.flow.id).run;
    const dependencies = { model, repairSandbox: engine }, repo = new AgentRepository(f.store);
    await driveAgentRun(f.config, f.store, f.session, run.id, dependencies);
    const proposed = repo.get(f.session.actorId, run.id); assert.ok(proposed?.repair);
    await decideAgentRepair(f.config, f.store, f.session, proposed.id, proposed.revision, proposed.repair.id, "approve");
    await driveAgentRun(f.config, f.store, f.session, run.id, dependencies);
    const done = repo.get(f.session.actorId, run.id); assert.ok(done?.repair);
    assert.equal(done.state, "partially_completed"); assert.equal(done.repair.state, "failed"); assert.equal(done.repair.afterTest?.passed, false);
    assert.equal(done.repair.artifact, null); assert.equal(done.publication, null); assert.equal(done.projectId, f.flow.id);
    assert.ok(done.messages.some(message => message.content?.startsWith("Host isolated build failure")));
    assert.equal(done.messages.some(message => message.content?.startsWith("Host disposable compatibility receipt")), false);
    assert.equal(done.effect, "no_remote_changes"); assert.equal(f.store.listActions(f.session.actorId).length, 0);
  } finally { f.close(); }
});

test("a verified v9 environment stays unchanged and excluded across compatibility proposal, approval and worker receipt", async () => {
  const f = await fixture(); try {
    const app = "verified-environment-fixture", teamId = "a".repeat(24), targetId = "b".repeat(24);
    const config = { ...f.config, teamId, apps: [app], enableLiveLiara: true, enableMutations: true };
    f.store.saveConnection(f.session.actorId, { source: "token", ciphertext: sealCredential("synthetic-environment-provider", config.sessionSecret, f.session.actorId, "liara"),
      view: { provider: "liara", status: "connected", identityId: "c".repeat(24), displayName: "Fixture", login: "fixture@example.test", teamId, teamName: "Fixture", selectedApp: app,
        apps: [{ id: targetId, name: app, platform: "node" }], checkedAt: Date.now() } });
    const repo = new AgentRepository(f.store), environmentMission = (await createPublicationMission(config, f.store, f.session, randomUUID(),
      { projectId: f.flow.id, sourceHash: f.flow.profile.sourceHash, path: "/", expectedText: args.assertion.contains }, AbortSignal.timeout(5000))).run;
    environmentMission.state = "needs_input"; environmentMission.nextAction = "configure_env"; repo.save(f.session.actorId, environmentMission);
    let variables: { key: string; value: string }[] = [], environmentWrites = 0;
    const client = new LiaraEnvironmentClient(connectedLiaraConfig(config, f.store, f.session.actorId, app), async (url, init) => {
      assert.equal(new URL(String(url)).origin, "https://api.liara.ir");
      if (init?.method === "POST") { environmentWrites++; const body = object(JSON.parse(String(init.body))); assert.equal(body.project, app);
        assert.deepEqual(body.variables, [{ key: "AUTH_DB_URL", value: fixtureValue }]); variables = [{ key: "AUTH_DB_URL", value: fixtureValue }]; return new Response(""); }
      return Response.json({ project: { _id: targetId, project_id: app, type: "node", status: "running", planID: "fixture-plan", envs: variables.map(row => ({ ...row, encrypted: false })) } });
    });
    const action = await proposeEnvironment(config, f.store, f.session, environmentMission.id, randomUUID(), [{ key: "AUTH_DB_URL", value: fixtureValue }], AbortSignal.timeout(5000), { client });
    f.store.decide(action.id, f.session.actorId, f.session.id, action.hash, "approve");
    await executeEnvironment(config, f.store, f.session, action.id, AbortSignal.timeout(5000), { client });
    const observed = await observeEnvironment(config, f.store, f.session, action.id, AbortSignal.timeout(5000), { client });
    assert.equal(observed.state, "succeeded"); assert.equal(observed.environment?.outcome, "verified"); assert.equal(environmentWrites, 1);
    const reference = currentEnvironment(f.store, config.sessionSecret, f.session.actorId, f.flow.id); assert.ok(reference); assert.equal(reference.actionId, action.id);
    assert.throws(() => projectEnvironmentValues(f.store, config.sessionSecret, f.session.actorId, f.flow.id, null), { code: "ENV_REFERENCE_CHANGED" });
    assert.deepEqual(projectEnvironmentValues(f.store, config.sessionSecret, f.session.actorId, f.flow.id, reference), [{ key: "AUTH_DB_URL", value: fixtureValue }]);
    const ordinary = parseCodeRepairJob(object(await executeAgentTool("propose_project_build", args,
      { ...context(f), config, context: currentAgentContext(config, f.store, f.session.actorId) })).repairProposal);
    assert.ok(ordinary.build?.version === 7 && ordinary.preparation); assert.equal(ordinary.build.testDatabase, undefined);
    assert.deepEqual(ordinary.build.environment, reference);
    await assert.rejects(new CodeRepairAdapter(config, f.store).propose(f.session.actorId, {
      projectId: f.flow.id, expectedSourceHash: f.flow.profile.sourceHash, goal: "Ordinary build must retain its reviewed environment reference",
      allowedPaths: ordinary.allowedPaths, testFiles: ordinary.testFiles, execution: "container", preparation: ordinary.preparation,
      build: { ...ordinary.build, environment: null },
    }, AbortSignal.timeout(5000)), { code: "ENV_REFERENCE_CHANGED" });
    const vaultBefore = f.store.db.prepare("SELECT * FROM environment_inputs").all(), actionsBefore = f.store.db.prepare("SELECT * FROM actions").all();
    const engine = syntheticEngine(f); let sends = 0;
    const model = new GoalModelClient(config, async () => { sends++; return Response.json({ choices: [{ finish_reason: "tool_calls", message: { role: "assistant", tool_calls: [{ id: randomUUID(), type: "function", function: sends === 1
      ? { name: "propose_project_build", arguments: JSON.stringify({ ...args, compatibilityDatabase }) }
      : { name: "finish_investigation", arguments: JSON.stringify({ state: "partially_completed", message: "آزمون داده ساختگی پایان یافت و تنظیمات مقصد حفظ شد.", question: null, nextAction: "reply" }) } }] } }], usage: { total_tokens: 10 } }); });
    const run = createAgentRun(config, f.store, f.session, randomUUID(), "بررسی جداگانه سازگاری با داده ساختگی", f.flow.id).run, dependencies = { model, repairSandbox: engine };
    await driveAgentRun(config, f.store, f.session, run.id, dependencies);
    const proposed = repo.get(f.session.actorId, run.id); assert.ok(proposed?.repair, proposed?.events.at(-1)?.message); assert.equal(proposed.state, "needs_approval");
    assert.equal(proposed.repair.build?.environment, null); assert.equal(engine.calls.length, 0);
    await decideAgentRepair(config, f.store, f.session, proposed.id, proposed.revision, proposed.repair.id, "approve");
    await driveAgentRun(config, f.store, f.session, run.id, dependencies);
    const done = repo.get(f.session.actorId, run.id); assert.ok(done?.repair);
    assert.equal(done.state, "partially_completed"); assert.equal(done.repair.state, "succeeded", done.repair.message); assert.equal(done.repair.afterTest?.passed, true);
    assert.equal(done.repair.artifact, null); assert.equal(done.publication, null); assert.equal(done.repair.build?.environment, null);
    assert.ok(done.messages.some(message => message.content?.startsWith("Host disposable compatibility receipt")));
    assert.equal(JSON.stringify(engine.calls).includes(fixtureValue), false); assert.equal(JSON.stringify(done).includes(fixtureValue), false);
    assert.deepEqual(currentEnvironment(f.store, config.sessionSecret, f.session.actorId, f.flow.id), reference);
    assert.deepEqual(f.store.db.prepare("SELECT * FROM environment_inputs").all(), vaultBefore);
    assert.deepEqual(f.store.db.prepare("SELECT * FROM actions").all(), actionsBefore); assert.equal(environmentWrites, 1);
    assert.throws(() => projectEnvironmentValues(f.store, config.sessionSecret, f.session.actorId, f.flow.id, null), { code: "ENV_REFERENCE_CHANGED" });
  } finally { f.close(); }
});
