import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, cp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { parseProjectBuildPlan, projectBuildImage } from "../../src/contracts/project-build.ts";
import { downloadLockedTarballs, lockedTarballs } from "../../src/server/agent/npm-source.ts";
import { AppError } from "../../src/server/errors.ts";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { toolsForAgent } from "../../src/server/agent/tools.ts";
import { GoalModelClient, type ToolDefinition } from "../../src/server/agent/model.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import { currentAgentContext, executeAgentTool } from "../../src/server/agent/tools.ts";
import { validateBuildPlan, validateBuildRepairPaths } from "../../src/server/agent/build-policy.ts";
import { captureProject } from "../../src/server/workspace/inspect.ts";
import { parseCodeRepairJob } from "../../src/contracts/code-repair.ts";

const bytes = Buffer.from("locked package bytes"), integrity = `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
const entry = { version: "1.0.0", resolved: "https://registry.npmjs.org/fixture/-/fixture-1.0.0.tgz", integrity };
function files(packages: Record<string, unknown>, version = 3) {
  return [{ path: "package-lock.json", content: Buffer.from(JSON.stringify({ lockfileVersion: version, packages: { "": {}, ...packages } })) }];
}
test("locked build accepts public integrity-bound Linux packages and deduplicates identical aliases", () => {
  const list = lockedTarballs(files({ "node_modules/fixture": entry, "node_modules/alias": { ...entry, resolved: entry.resolved.replace("fixture/-/", "alias/-/") },
    "node_modules/windows": { os: ["win32"], resolved: "file:never-read" }, "node_modules/arm": { cpu: ["arm64"] } }));
  assert.equal(list.length, 1); assert.equal(list[0]?.integrity, integrity);
});
test("foreign registries, credentials, redirects, links, incompatible integrity and old lockfiles are denied", () => {
  for (const resolved of ["http://registry.npmjs.org/a.tgz", "https://evil.test/a.tgz", "https://user:password@registry.npmjs.org/a.tgz", entry.resolved + "?token=value", "file:../local"]) {
    assert.throws(() => lockedTarballs(files({ "node_modules/fixture": { ...entry, resolved } })), { code: "BUILD_REGISTRY_DENIED" });
  }
  assert.throws(() => lockedTarballs(files({ "../fixture": entry })), { code: "BUILD_LOCK_UNSUPPORTED" });
  assert.throws(() => lockedTarballs(files({ "node_modules/fixture": { ...entry, link: true } })), { code: "BUILD_LOCK_UNSUPPORTED" });
  assert.throws(() => lockedTarballs(files({ "node_modules/fixture": { ...entry, integrity: "sha1-weak" } })), { code: "BUILD_INTEGRITY_REQUIRED" });
  assert.throws(() => lockedTarballs(files({}, 2)), { code: "BUILD_LOCK_UNSUPPORTED" });
  assert.throws(() => lockedTarballs(files({ "node_modules/one": entry, "node_modules/two": { ...entry, integrity: `sha256-${createHash("sha256").update(bytes).digest("base64")}` } })), { code: "BUILD_LOCK_INVALID" });
});
test("only verified bytes reach the job directory; peer cancellation does not replace the original failure", async () => {
  const directory = await mkdtemp(join(tmpdir(), "launchlane-locked-build-"));
  try {
    const list = lockedTarballs(files({ "node_modules/fixture": entry }));
    let calls = 0;
    await downloadLockedTarballs(list, directory, AbortSignal.timeout(1000), () => { calls++; }, async () => bytes);
    assert.equal(calls, 1); assert.deepEqual(await readFile(join(directory, list[0]?.file ?? "")), bytes);
    const corrupt = join(directory, "corrupt");
    await assert.rejects(downloadLockedTarballs(list, corrupt, AbortSignal.timeout(1000), () => {}, async () => Buffer.from("changed")), { code: "BUILD_INTEGRITY_MISMATCH" });
    assert.deepEqual(await readdir(corrupt), []);
    const parallel = [list[0], list[0]].filter(item => item !== undefined);
    let attempts = 0;
    await assert.rejects(downloadLockedTarballs(parallel, join(directory, "failed"), AbortSignal.timeout(1000), () => {}, async (_item, signal) => {
      if (attempts++ === 1) throw new AppError("ORIGINAL_NETWORK_FAILURE", "synthetic");
      return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("peer aborted")), { once: true }));
    }), { code: "ORIGINAL_NETWORK_FAILURE" });
    const controller = new AbortController();
    const pending = downloadLockedTarballs(list, join(directory, "cancelled"), controller.signal, () => {}, () => new Promise(() => {}));
    setImmediate(() => controller.abort());
    await assert.rejects(pending, { code: "CANCELLED" });
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test("the build plan fixes the runtime and original independent workload criterion", () => {
  const input = { version: 1, nodeVersion: "22", image: projectBuildImage, buildCommand: "next build", testCommand: null, startCommand: "next start", port: 3000,
    workload: { path: "/orders", status: 200, assertion: { kind: "json", field: "total", equals: 73 } } };
  assert.deepEqual(parseProjectBuildPlan(input), input);
  assert.throws(() => parseProjectBuildPlan({ ...input, nodeVersion: "24" }), { code: "BUILD_RUNTIME_UNSUPPORTED" });
  assert.throws(() => parseProjectBuildPlan({ ...input, workload: { ...input.workload, path: "//other.test" } }));
  assert.throws(() => parseProjectBuildPlan({ ...input, approved: true }));
  for (const path of ["package-lock.json", "package.json", "app/order.test.ts", "tests/order.js", "tsconfig.json", "vitest.config.ts"])
    assert.throws(() => validateBuildRepairPaths([path]), { code: "BUILD_ORACLE_CHANGED" });
  validateBuildRepairPaths(["app/orders/page.tsx"]);
});
test("both preparation alternatives fit the real model client's tool bound with every service gate enabled", async () => {
  const f = await agentFixture();
  try {
    const config = { ...f.config, enableLocalRepair: true, enableMutations: true, enableLiveLiara: true };
    const completion: ToolDefinition = { type: "function", function: { name: "finish", description: "fixture", parameters: { type: "object", properties: {}, required: [], additionalProperties: false } } };
    for (const mode of ["native", "build"] as const) {
      const tools = [...toolsForAgent(config, mode), completion], names = tools.map(tool => tool.function.name);
      assert.equal(new Set(names).size, names.length); assert.ok(names.length <= 16);
      assert.equal(names.includes("propose_project_build"), mode === "build");
      assert.equal(names.includes("propose_project_preparation"), mode === "native");
      let sends = 0;
      const model = new GoalModelClient(config, async (_url, init) => {
        sends++;
        const body = JSON.parse(String(init.body)); assert.equal(body.tools.length, tools.length);
        return Response.json({ choices: [{ finish_reason: "tool_calls", message: { role: "assistant", tool_calls: [{ id: "bounded-tool-fixture", type: "function", function: { name: "inspect_project", arguments: "{}" } }] } }], usage: { total_tokens: 10 } });
      });
      const result = await model.complete([{ role: "user", content: "بررسی پروژه" }], tools, new RunBudget(config), AbortSignal.timeout(1000));
      assert.equal(result.calls[0]?.function.name, "inspect_project"); assert.equal(sends, 1);
    }
  } finally { f.close(); }
});
test("publication cannot bypass a required build or spend cloud reads before its source-bound receipt", async () => {
  const f = await agentFixture();
  try {
    const project = join(f.workspace, "built-service");
    await cp("tests/fixtures/locked-node-build", project, { recursive: true });
    const config = { ...f.config, enableLocalRepair: true, enableMutations: true, enableLiveLiara: true },
      flow = await prepareProjectFlow(config, f.store, f.session.actorId, { kind: "local", directory: "built-service" }, AbortSignal.timeout(5000)),
      context = { config, store: f.store, actorId: f.session.actorId, context: currentAgentContext(config, f.store, f.session.actorId),
        budget: new RunBudget(config), createdAt: Date.now(), signal: AbortSignal.timeout(5000) },
      args = { path: "/orders", status: 200, assertion: { kind: "json", field: "total", equals: 73 } };
    await assert.rejects(executeAgentTool("propose_publication", args, context), { code: "PROJECT_BUILD_REQUIRED" });
    assert.equal(f.store.listActions(f.session.actorId).length, 0);
    const proposal = await executeAgentTool("propose_project_build", args, context);
    assert.ok(typeof proposal === "object" && proposal !== null && "repairProposal" in proposal);
    const job = parseCodeRepairJob(proposal.repairProposal);
    assert.ok(job.build);
    const build = job.build;
    assert.equal(job.state, "proposed"); assert.equal(job.validationOnly, true); assert.equal(job.afterTest, null);
    assert.equal(job.containerImage, projectBuildImage); assert.deepEqual(job.containerIds, []);
    assert.equal(job.baseRevision, flow.profile.sourceHash);
    await assert.rejects(executeAgentTool("propose_code_repair", { goal: "repair", allowedPaths: ["server.txt"], testFiles: [] }, { ...context, buildJob: { ...job, state: "failed" } }), { code: "BUILD_EXECUTION_REQUIRED" });
    await assert.rejects(executeAgentTool("propose_project_build", args, { ...context, buildJob: { ...job, state: "failed" } }), { code: "BUILD_NO_PROGRESS" });
    await assert.rejects(executeAgentTool("propose_project_build", { ...args, path: "/other" }, { ...context, buildJob: job }), { code: "MISSION_EXPECTATION_CHANGED" });
    const captured = await captureProject(project, ".");
    assert.throws(() => validateBuildPlan(captured.files, captured.profile, { ...build, startCommand: "node arbitrary.mjs" }), { code: "BUILD_PLAN_CHANGED" });
    assert.throws(() => validateBuildPlan(captured.files, { ...captured.profile, nodeRuntime: { ...captured.profile.nodeRuntime, version: "22", source: "package.json", requirement: ">=22.99 <23", detail: "fixture" } }, build), { code: "BUILD_RUNTIME_UNSUPPORTED" });
  } finally { f.close(); }
});
test("Next's explicit CLI port and documented default are recognized without executing its scripts", async () => {
  const f = await agentFixture();
  try {
    for (const [start, expected] of [["next start", 3000], ["next start -p 4300", 4300], ["next start --hostname 0.0.0.0 --port 4400", 4400]] as const) {
      await writeFile(join(f.project, "package.json"), JSON.stringify({ engines: { node: "22.x" }, dependencies: { next: "16.4.2" }, scripts: { start, build: "next build" } }));
      const captured = await captureProject(f.project, "."); assert.equal(captured.profile.port, expected); assert.equal(captured.profile.start, start);
    }
  } finally { f.close(); }
});
