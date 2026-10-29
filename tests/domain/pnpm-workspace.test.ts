import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { inspectPnpmWorkspace, pnpmYaml } from "../../src/server/workspace/pnpm.ts";
import { pnpmTarballs } from "../../src/server/agent/pnpm-source.ts";
import { pnpmFixtureFiles, writePnpmFixture } from "../helpers/pnpm-fixture.ts";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import { currentAgentContext, executeAgentTool, toolsForAgent } from "../../src/server/agent/tools.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";
import { parseCodeRepairJob } from "../../src/contracts/code-repair.ts";
import { parseProjectBuildPlan, nodeBuildRuntime, projectBuildImage } from "../../src/contracts/project-build.ts";
import { validateBuildPlan, validateBuildRepairPaths, dockerProjectBuild } from "../../src/server/agent/build-policy.ts";
import { captureProject } from "../../src/server/workspace/inspect.ts";
import { assertApplicationPublicationScope } from "../../src/server/policy/application-scope.ts";
import { CodeRepairAdapter } from "../../src/server/agent/code-repair.ts";
import { object, string } from "../../src/contracts/validation.ts";
import { randomUUID } from "node:crypto";
import { GoalModelClient } from "../../src/server/agent/model.ts";
import { createAgentRun, decideAgentRepair, driveAgentRun } from "../../src/server/agent/runs.ts";
import { AgentRepository } from "../../src/server/agent/store.ts";
import { AppError } from "../../src/server/errors.ts";

test("pnpm root, all importers, links, original scripts and exact compatible Node are source bound", async () => {
  const { files } = await pnpmFixtureFiles(), plan = inspectPnpmWorkspace(files); assert.ok(plan);
  assert.equal(plan.nodeVersion, "24"); assert.deepEqual(plan.packages.map(pkg => pkg.root), [".", "apps/api", "packages/shared"]);
  assert.deepEqual(plan.packages[1]?.dependencies, ["@fixture/shared"]); assert.equal(plan.packages[0]?.build, "pnpm -r build");
  assert.equal(pnpmTarballs(files).length, 2);
  for (const path of ["pnpm-workspace.yaml", "pnpm-lock.yaml", ".pnpmfile.cjs"]) assert.throws(() => validateBuildRepairPaths([path]), { code: "BUILD_ORACLE_CHANGED" });
  const replace = (path: string, content: string) => files.map(file => file.path === path ? { path, content: Buffer.from(content) } : file);
  const root = files[0]?.content.toString() ?? "";
  assert.throws(() => inspectPnpmWorkspace(replace("package.json", root.replace("pnpm@11.19.0", "pnpm@11.18.0"))), { code: "PNPM_VERSION_UNSUPPORTED" });
  assert.throws(() => inspectPnpmWorkspace([...files, { path: "package-lock.json", content: Buffer.from("{}") }]), { code: "PACKAGE_MANAGER_CONFLICT" });
  assert.throws(() => inspectPnpmWorkspace(replace("package.json", root.replace("24.x", ">=24.99"))), { code: "PNPM_NODE_CONFLICT" });
  assert.throws(() => inspectPnpmWorkspace([...files, { path: "liara.json", content: Buffer.from('{"node":{"version":"22"}}') }]), { code: "PNPM_NODE_CONFLICT" });
  const lock = files.find(file => file.path === "pnpm-lock.yaml")?.content.toString() ?? "";
  assert.throws(() => inspectPnpmWorkspace(replace("pnpm-lock.yaml", lock.replace("link:../../packages/shared", "link:../../outside"))), { code: "PNPM_WORKSPACE_LINK_CHANGED" });
  assert.throws(() => inspectPnpmWorkspace(replace("pnpm-lock.yaml", lock.replace("specifier: 1.0.0", "specifier: 2.0.0"))), { code: "PNPM_LOCK_MISMATCH" });
  assert.throws(() => inspectPnpmWorkspace(replace("pnpm-workspace.yaml", "packages: [apps/*]\n")), { code: "PNPM_IMPORTERS_CHANGED" });
  assert.throws(() => inspectPnpmWorkspace(replace("pnpm-workspace.yaml", "packages: [apps/*, packages/*]\nregistry: https://other.invalid\n")), { code: "PNPM_SETTINGS_UNSUPPORTED" });
  assert.throws(() => pnpmYaml({ path: "pnpm-lock.yaml", content: Buffer.from("x: &alias {value: 1}\ny: *alias\n") }), { code: "PNPM_LOCK_INVALID" });
  assert.throws(() => pnpmTarballs(replace("pnpm-lock.yaml", lock.replace("resolution: {integrity:", "resolution: {tarball: 'https://other.invalid/fixture.tgz', integrity:"))), { code: "BUILD_REGISTRY_DENIED" });
});

test("shared Agent proposes compile before a destination without data inputs or a false npm/publication route", async () => {
  const f = await agentFixture(); try {
    const { files } = await pnpmFixtureFiles(); writePnpmFixture(f.project, files);
    const config = { ...f.config, enableLocalRepair: true }, signal = AbortSignal.timeout(10000);
    const flow = await prepareProjectFlow(config, f.store, f.session.actorId, { kind: "local", directory: "service" }, signal);
    assert.ok(flow.profile.pnpmWorkspace); assert.equal(flow.artifact, null);
    assert.equal(flow.profile.nodeRuntime?.source, "package.json");
    assert.ok(toolsForAgent(config, "fullstack", false, true).some(tool => tool.function.name === "propose_project_build"));
    const result = await executeAgentTool("propose_project_build", { path: "/", status: 200, assertion: { kind: "text", contains: "original-app" } },
      { config, store: f.store, actorId: f.session.actorId, context: currentAgentContext(config, f.store, f.session.actorId), budget: new RunBudget(config), signal, createdAt: Date.now() });
    assert.ok(result && typeof result === "object" && "repairProposal" in result);
    const job = parseCodeRepairJob(result.repairProposal); assert.equal(job.build?.version, 8); assert.equal(job.state, "proposed");
    assert.ok(job.build?.version === 8); assert.equal(job.build.phase, "compile"); assert.equal(job.build.environment, null); assert.equal(job.build.sourceEnvironment, undefined);
    assert.equal(job.build.startCommand, "pnpm-workspace-compile"); assert.equal(job.build.testCommand, null); assert.equal(job.artifact, null);
    assert.throws(() => parseProjectBuildPlan({ ...job.build, environment: { keys: ["DATABASE_URL"] } }));
    const captured = await captureProject(f.project, ".");
    assert.throws(() => validateBuildPlan(captured.files, captured.profile, parseProjectBuildPlan({ ...nodeBuildRuntime("24"), buildCommand: "pnpm -r build", testCommand: null, startCommand: "node server.mjs", port: 3000, workload: job.build?.workload })), { code: "PNPM_BUILD_REQUIRED" });
    assert.throws(() => assertApplicationPublicationScope(flow.profile), { code: "PNPM_PUBLICATION_ROUTE_REQUIRED" });
    await assert.rejects(executeAgentTool("propose_project_build", { path: "/", status: 200, assertion: { kind: "text", contains: "original-app" } },
      { config, store: f.store, actorId: f.session.actorId, context: currentAgentContext(config, f.store, f.session.actorId), budget: new RunBudget(config), signal, createdAt: Date.now(), buildJob: { ...job, state: "succeeded" } }),
      { code: "PNPM_COMPILE_ALREADY_VERIFIED" });
    assert.equal(f.store.db.prepare("SELECT count(*) AS n FROM actions").get()?.n, 0);
  } finally { f.close(); }
});

test("an explicit Docker route retains its image-owned manager instead of entering native pnpm preparation", async () => {
  const f = await agentFixture(); try {
    const pkg = JSON.parse(readFileSync(join(f.project, "package.json"), "utf8"));
    writeFileSync(join(f.project, "package.json"), JSON.stringify({ ...pkg, packageManager: "pnpm@10.0.0" }));
    writeFileSync(join(f.project, "liara.json"), JSON.stringify({ platform: "docker", port: 3000 }));
    writeFileSync(join(f.project, "Dockerfile"), `FROM ${projectBuildImage}\nWORKDIR /app\nCOPY . .\nEXPOSE 3000\nCMD ["node", "server.mjs"]\n`);
    const captured = await captureProject(f.project, "."); assert.equal(captured.profile.runtime, "docker"); assert.equal(captured.profile.pnpmWorkspace, undefined);
    assert.equal(dockerProjectBuild(captured.files, captured.profile, { path: "/", status: 200, assertion: { kind: "text", contains: "invoice" } }, null).version, 6);
  } finally { f.close(); }
});

test("persisted pnpm dependency usage above 512 stays readable without renewing or rewriting its receipt", async () => {
  const f = await agentFixture(); try {
    const { files } = await pnpmFixtureFiles(); writePnpmFixture(f.project, files);
    const config = { ...f.config, enableLocalRepair: true }, signal = AbortSignal.timeout(10000),
      flow = await prepareProjectFlow(config, f.store, f.session.actorId, { kind: "local", directory: "service" }, signal), workspace = flow.profile.pnpmWorkspace;
    assert.ok(workspace);
    const build = parseProjectBuildPlan({ ...nodeBuildRuntime(workspace.nodeVersion), version: 8, workspace, phase: "compile", buildCommand: "pnpm -r build", testCommand: null,
      startCommand: "pnpm-workspace-compile", port: 3000, workload: { path: "/", status: 200, assertion: { kind: "text", contains: "original-app" } } });
    const adapter = new CodeRepairAdapter(config, f.store), job = await adapter.propose(f.session.actorId, { projectId: flow.id, expectedSourceHash: flow.profile.sourceHash,
      goal: "Read a persisted high-dependency receipt", allowedPaths: [], testFiles: [], execution: "container", validationOnly: true, build }, signal);
    const row = f.store.db.prepare("SELECT data_json FROM code_repair_jobs WHERE id=?").get(job.id), record = object(JSON.parse(string(row?.data_json, 512 * 1024)));
    object(record.usage).toolCalls = 513; const stored = JSON.stringify(record);
    f.store.db.prepare("UPDATE code_repair_jobs SET data_json=? WHERE id=?").run(stored, job.id);
    assert.equal(adapter.status(f.session.actorId, job.id).state, "proposed");
    assert.equal(f.store.db.prepare("SELECT data_json FROM code_repair_jobs WHERE id=?").get(job.id)?.data_json, stored);
    object(record.usage).toolCalls = 4096;
    f.store.db.prepare("UPDATE code_repair_jobs SET data_json=? WHERE id=?").run(JSON.stringify(record), job.id);
    assert.equal(adapter.status(f.session.actorId, job.id).state, "proposed");
    object(record.usage).toolCalls = 4097;
    f.store.db.prepare("UPDATE code_repair_jobs SET data_json=? WHERE id=?").run(JSON.stringify(record), job.id);
    assert.throws(() => adapter.status(f.session.actorId, job.id), { code: "INVALID_INPUT" });
  } finally { f.close(); }
});

test("an interrupted workspace build preserves its underlying error and cannot manufacture a compile receipt or retry", async () => {
  const f = await agentFixture(); try {
    const { files } = await pnpmFixtureFiles(); writePnpmFixture(f.project, files);
    const config = { ...f.config, enableLocalRepair: true }, signal = AbortSignal.timeout(10000),
      flow = await prepareProjectFlow(config, f.store, f.session.actorId, { kind: "local", directory: "service" }, signal);
    let modelCalls = 0, dependencyReads = 0;
    const model = new GoalModelClient(config, async () => {
      modelCalls++;
      return Response.json({ choices: [{ finish_reason: "tool_calls", message: { role: "assistant", tool_calls: [{ id: randomUUID(), type: "function", function: {
        name: "propose_project_build", arguments: JSON.stringify({ path: "/", status: 200, assertion: { kind: "text", contains: "original-app" } }),
      } }] } }], usage: { total_tokens: 10 } });
    });
    const run = createAgentRun(config, f.store, f.session, randomUUID(), "بررسی ساخت همین workspace", flow.id).run;
    const dependencies = { model, tarballReader: async () => { dependencyReads++; throw new AppError("SANDBOX_CLEANUP_UNCONFIRMED", "رسید محیط معلوم نیست؛ اجرا تکرار نمی‌شود.", 503); } };
    await driveAgentRun(config, f.store, f.session, run.id, dependencies);
    const repo = new AgentRepository(f.store), proposed = repo.get(f.session.actorId, run.id); assert.ok(proposed?.repair);
    assert.equal(proposed.state, "needs_approval");
    await decideAgentRepair(config, f.store, f.session, run.id, proposed.revision, proposed.repair.id, "approve");
    await driveAgentRun(config, f.store, f.session, run.id, dependencies);
    const result = repo.get(f.session.actorId, run.id); assert.ok(result);
    assert.equal(result.state, "failed"); assert.equal(result.errorCode, "SANDBOX_CLEANUP_UNCONFIRMED");
    assert.equal(result.repair?.state, "interrupted"); assert.equal(result.repair.errorCode, result.errorCode);
    assert.equal(result.repair.afterTest, null); assert.equal(result.repair.artifact, null); assert.equal(result.publication, null);
    assert.equal(modelCalls, 1); assert.equal(dependencyReads, 1);
    assert.ok(!result.messages.some(message => message.role === "user" && message.content.startsWith("Host workspace compile receipt")));
    await driveAgentRun(config, f.store, f.session, run.id, dependencies);
    assert.equal(modelCalls, 1); assert.equal(dependencyReads, 1);
  } finally { f.close(); }
});
