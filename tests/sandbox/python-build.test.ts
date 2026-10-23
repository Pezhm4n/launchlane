import assert from "node:assert/strict";
import { test } from "node:test";
import { cp, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import { CodeRepairAdapter } from "../../src/server/agent/code-repair.ts";
import { parseProjectBuildPlan, pythonBuildImage } from "../../src/contracts/project-build.ts";
import type { ModelPort } from "../../src/server/agent/model.ts";
import { runPythonBuild } from "../../src/server/agent/python-container.ts";

test("offline Python worker reproduces a semantic failure, repairs only scoped source and selects the exact tested artifact", async () => {
  const f = await agentFixture();
  try {
    const project = join(f.workspace, "python");
    await cp(resolve("tests/fixtures/python-service"), project, { recursive: true });
    const correct = await readFile(join(project, "invoice.py"), "utf8"), broken = correct.replace('line["price"] * line["quantity"]', 'line["price"]');
    await writeFile(join(project, "invoice.py"), broken);
    const flow = await prepareProjectFlow(f.config, f.store, f.session.actorId, { kind: "local", directory: "python" }, AbortSignal.timeout(3000));
    const build = parseProjectBuildPlan({ version: 2, nodeVersion: null, image: pythonBuildImage,
      runtime: flow.profile.pythonRuntime, buildCommand: null, testCommand: null, startCommand: flow.profile.start, port: 8000,
      workload: { path: "/orders", status: 200, assertion: { kind: "json", field: "total", equals: 73 } } });
    let requests = 0;
    const model: ModelPort = { async complete(_messages, _tools, budget, signal) {
      budget.take("model", signal);
      requests++;
      return { content: null, usage: 25, calls: [{ id: "patch-python", type: "function", function: { name: "submit_patch", arguments: JSON.stringify({
        baseRevision: flow.profile.sourceHash, files: [{ path: "invoice.py", beforeHash: createHash("sha256").update(broken).digest("hex"), content: correct }],
      }) } }] };
    } };
    const adapter = new CodeRepairAdapter({ ...f.config, enableLocalRepair: true }, f.store, model), signal = AbortSignal.timeout(120000);
    const proposed = await adapter.propose(f.session.actorId, { projectId: flow.id, expectedSourceHash: flow.profile.sourceHash,
      goal: "Quantity must contribute; preserve zero quantities and fractional prices", execution: "container", build,
      allowedPaths: ["invoice.py"], testFiles: ["test_invoice.py"] }, signal);
    adapter.approve(f.session.actorId, proposed.id);
    const job = await adapter.run(f.session.actorId, proposed.id, signal);
    assert.equal(job.state, "succeeded", `${job.errorCode}: ${job.beforeTest?.output}; ${job.afterTest?.output}`);
    assert.equal(requests, 1); assert.equal(job.beforeTest?.passed, false); assert.equal(job.beforeTest?.exitCode, 76);
    assert.equal(job.afterTest?.passed, true); assert.deepEqual(job.changedPaths, ["invoice.py"]); assert.equal(job.containerIds?.length, 2);
    assert.equal(await readFile(join(project, "invoice.py"), "utf8"), broken, "original source is preserved");
    assert.ok(job.artifact);
    const selected = await prepareProjectFlow(f.config, f.store, f.session.actorId, { kind: "repair", directory: ".", jobId: job.id, artifactHash: job.artifact.archiveHash }, signal);
    assert.equal(selected.artifact?.archiveHash, job.artifact.archiveHash); assert.equal(selected.profile.runtime, "python");
  } finally { f.close(); }
});

test("a corrupted wheel is rejected before pip or project code runs", async () => {
  const f = await agentFixture();
  try {
    const project = join(f.workspace, "python"), wheels = join(f.directory, "corrupt-wheels");
    await cp(resolve("tests/fixtures/python-service"), project, { recursive: true }); await mkdir(wheels);
    await writeFile(join(wheels, "fixture-1-py3-none-any.whl"), "bad");
    await writeFile(join(wheels, "manifest.json"), JSON.stringify([{ filename: "fixture-1-py3-none-any.whl", size: 3, sha256: "0".repeat(64) }]));
    await writeFile(join(wheels, "requirements.txt"), "fixture==1\n");
    const plan = parseProjectBuildPlan({ version: 2, nodeVersion: null, image: pythonBuildImage,
      runtime: { kind: "python", version: "3.12", command: ["python3", "main.py"] }, buildCommand: null, testCommand: null,
      startCommand: "python3 main.py", port: 8000, workload: { path: "/orders", status: 200, assertion: { kind: "json", field: "total", equals: 73 } } });
    assert.equal(plan.version, 2); if (plan.version !== 2) throw Error("wrong Python plan");
    const result = await runPythonBuild(project, wheels, plan, [], AbortSignal.timeout(60000));
    assert.equal(result.exitCode, 74); assert.match(result.output, /checksum changed/);
    assert.equal(result.output.includes("Installing collected"), false);
  } finally { f.close(); }
});
