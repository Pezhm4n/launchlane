import { randomUUID, createHash } from "node:crypto";
import { join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { agentFixture } from "./agent-fixture.ts";
import { pnpmFixtureFiles, writePnpmFixture } from "./pnpm-fixture.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import { captureProject } from "../../src/server/workspace/inspect.ts";
import { sourcePnpmComponent } from "../../src/server/agent/pnpm-component.ts";
import { nodeBuildRuntime, parseProjectBuildPlan } from "../../src/contracts/project-build.ts";
import { validateComponentOutput } from "../../src/server/agent/component-output.ts";
import { persistComponentOutput } from "../../src/server/agent/build-output-store.ts";
import { assembleComponentArtifact } from "../../src/server/agent/component-artifact.ts";
import { fingerprint } from "../../src/server/policy/action.ts";
import { sourceBuildEnvironment } from "../../src/server/environment/build.ts";

/** Synthetic receipt fixture for policy/provider contracts. Actual worker acceptance is separate. */
export async function componentFixture(privateEnvironment = false) {
  const f = await agentFixture(); try {
    const fixture = await pnpmFixtureFiles();
    fixture.files = fixture.files.map(file => { if (file.path !== "apps/api/package.json") return file; const pkg = JSON.parse(file.content.toString()); pkg.scripts.start = "node dist/server.cjs"; return { ...file, content: Buffer.from(JSON.stringify(pkg)) }; });
    writePnpmFixture(f.project, fixture.files);
    if (privateEnvironment) {
      await writeFile(join(f.project, ".env"), "COMPONENT_PRIVATE=private-contract-fixture-value\n");
      await writeFile(join(f.project, "apps/api/env.cjs"), "exports.configured=Boolean(process.env.COMPONENT_PRIVATE);\n");
    }
    const original = await prepareProjectFlow(f.config, f.store, f.session.actorId, { kind: "local", directory: "service" }, AbortSignal.timeout(5000)), workspace = original.profile.pnpmWorkspace;
    if (!workspace) throw Error("missing workspace fixture");
    const captured = await captureProject(f.project, "."), jobId = randomUUID(), root = join(f.config.stateDir, "repair-workspaces", jobId); await mkdir(root, { recursive: true }); writePnpmFixture(root, captured.files);
    const sourceEnvironment = privateEnvironment ? sourceBuildEnvironment(f.config, f.store, f.session.actorId, original.id) : null;
    const component = sourcePnpmComponent(captured.files, workspace, "apps/api"), build = parseProjectBuildPlan({ ...nodeBuildRuntime(workspace.nodeVersion), version: 9, sourceHash: original.profile.sourceHash, workspace, component, ...(sourceEnvironment ? { sourceEnvironment } : {}),
      buildCommand: "pnpm -r build", testCommand: component.testCommand, startCommand: "node dist/server.cjs", port: 8080,
      workload: { path: "/", status: 200, assertion: { kind: "json", field: "total", equals: 73 } }, apiChecks: [{ path: "/api/value", status: 200, assertions: [{ pointer: ["total"], equals: 73 }] }] });
    const contents = [{ path: "apps/api/dist/server.cjs", base64: Buffer.from("require('node:http').createServer((req,res)=>res.end(JSON.stringify({total:73}))).listen(+process.env.PORT,'0.0.0.0');").toString("base64") }];
    const output = validateComponentOutput({ version: 1, sourceHash: original.profile.sourceHash, planHash: fingerprint(build), contents,
      entries: contents.map(file => ({ path: file.path, type: "file", bytes: Buffer.from(file.base64, "base64").length, sha256: createHash("sha256").update(Buffer.from(file.base64, "base64")).digest("hex"), executable: false })), totalBytes: Buffer.from(contents[0]?.base64 ?? "", "base64").length });
    const receipt = await persistComponentOutput(f.config.stateDir, output), assembled = await assembleComponentArtifact({ stateDir: f.config.stateDir, store: f.store, actorId: f.session.actorId, workspace: root, sourceHash: original.profile.sourceHash, jobId, plan: build, receipt, signal: AbortSignal.timeout(5000), secrets: [] });
    const job = { id: jobId, projectId: original.id, baseRevision: original.profile.sourceHash, state: "succeeded", goal: "Synthetic component receipt", allowedPaths: [], testFiles: [], changedPaths: assembled.changedPaths,
      diff: null, beforeTest: null, afterTest: { command: "synthetic contract fixture", exitCode: 0, signal: null, output: "fixture", durationMs: 1, passed: true, buildOutput: receipt },
      artifact: assembled.artifact, publication: assembled.publication, execution: "container", validationOnly: true, containerIds: ["1".repeat(64)], containerImage: build.image, build, errorCode: null, message: "fixture", createdAt: Date.now(), updatedAt: Date.now() };
    f.store.db.prepare("INSERT INTO code_repair_jobs VALUES (?,?,?,?,?)").run(jobId, f.session.actorId, "succeeded", Date.now(), JSON.stringify({ job }));
    const selected = await prepareProjectFlow(f.config, f.store, f.session.actorId, { kind: "repair", directory: ".", jobId, artifactHash: assembled.artifact.archiveHash }, AbortSignal.timeout(5000));
    return { ...f, selected, original, build, receipt, job, root };
  } catch (error) { f.close(); throw error; }
}
