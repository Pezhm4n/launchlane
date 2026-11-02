import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { cp, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { agentFixture } from "./agent-fixture.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import { parseProjectBuildPlan, pythonBuildImage } from "../../src/contracts/project-build.ts";

/** Synthetic worker receipt for policy/provider regressions only. Real workers have a separate suite. */
export async function frameworkFixture(kind: "flask" | "django") {
  const f = await agentFixture(); try {
    const directory = join(f.workspace, kind); await cp(resolve("tests/fixtures", `${kind}-service`), directory, { recursive: true });
    const original = await prepareProjectFlow(f.config, f.store, f.session.actorId, { kind: "local", directory: kind }, AbortSignal.timeout(5000));
    assert.ok(original.artifact && original.profile.start);
    const build = parseProjectBuildPlan({ version: 10, nodeVersion: null, image: pythonBuildImage, runtime: original.profile.pythonRuntime,
      buildCommand: null, testCommand: kind === "django" ? "python3 manage.py test" : "python3 -m unittest discover", startCommand: original.profile.start, port: 8000,
      workload: { path: "/orders", status: 200, assertion: { kind: "json", field: "total", equals: 73 } } });
    const jobId = randomUUID(), workspace = join(f.config.stateDir, "repair-workspaces", jobId); await mkdir(workspace, { recursive: true }); await cp(directory, workspace, { recursive: true });
    const job = { id: jobId, projectId: original.id, baseRevision: original.profile.sourceHash, state: "succeeded", goal: "Synthetic framework contract receipt", allowedPaths: [], testFiles: [], changedPaths: [],
      diff: null, beforeTest: null, afterTest: { command: build.testCommand, exitCode: 0, signal: null, output: "synthetic", durationMs: 1, passed: true },
      artifact: original.artifact, execution: "container", validationOnly: true, containerIds: ["1".repeat(64)], containerImage: build.image, build, errorCode: null, message: "fixture", createdAt: Date.now(), updatedAt: Date.now() };
    f.store.db.prepare("INSERT INTO code_repair_jobs VALUES (?,?,?,?,?)").run(jobId, f.session.actorId, "succeeded", Date.now(), JSON.stringify({ job }));
    const selected = await prepareProjectFlow(f.config, f.store, f.session.actorId, { kind: "repair", directory: ".", jobId, artifactHash: original.artifact.archiveHash }, AbortSignal.timeout(5000));
    return { ...f, original, selected, build, job };
  } catch (error) { f.close(); throw error; }
}
