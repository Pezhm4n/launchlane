import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { agentFixture } from "./agent-fixture.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import { parseProjectBuildPlan, projectBuildImage } from "../../src/contracts/project-build.ts";
import { executablePort } from "../../src/contracts/go-runtime.ts";
import { sourceBuildEnvironment } from "../../src/server/environment/build.ts";
import { parseExecutableOutput } from "../../src/server/agent/executable-output.ts";
import { persistExecutableOutput } from "../../src/server/agent/build-output-store.ts";
import { assembleExecutableArtifact } from "../../src/server/agent/executable-artifact.ts";
import { fingerprint } from "../../src/server/policy/action.ts";
import { createHash } from "node:crypto";

/** Synthetic ELF/worker receipt only; the separate sandbox suite runs the actual Go compiler. */
export async function goFixture(privateInput = false) {
  const f = await agentFixture(); try {
    const source = join(f.workspace, "go"), secret = randomUUID(); await cp(resolve("tests/fixtures/go-service"), source, { recursive: true });
    if (privateInput) await writeFile(join(source, ".env"), `APP_LABEL=${secret}\n`);
    const original = await prepareProjectFlow(f.config, f.store, f.session.actorId, { kind: "local", directory: "go" }, AbortSignal.timeout(5000)), runtime = original.profile.goRuntime;
    if (!runtime) throw Error("fixture Go runtime missing");
    const sourceEnvironment = sourceBuildEnvironment(f.config, f.store, f.session.actorId, original.id), build = parseProjectBuildPlan({ version: 11, nodeVersion: null, image: projectBuildImage,
      sourceHash: original.profile.sourceHash, runtime, buildCommand: "go build -mod=readonly -trimpath -buildvcs=false", testCommand: "go test -json -count=1 -mod=readonly ./...", startCommand: "launchlane-compiled-go", port: executablePort(runtime),
      workload: { path: "/orders", status: 200, assertion: { kind: "json", field: "total", equals: 73 } }, ...(sourceEnvironment ? { sourceEnvironment } : {}) });
    const bytes = Buffer.alloc(64); Buffer.from([0x7f, 0x45, 0x4c, 0x46, 2, 1]).copy(bytes); bytes.writeUInt16LE(62, 18);
    const output = parseExecutableOutput({ version: 1, sourceHash: original.profile.sourceHash, planHash: fingerprint(build), bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), base64: bytes.toString("base64") });
    const receipt = await persistExecutableOutput(f.config.stateDir, output), id = randomUUID(), workspace = join(f.config.stateDir, "repair-workspaces", id);
    await mkdir(workspace, { recursive: true });
    for (const file of original.profile.manifest) { const target = join(workspace, file.path); await mkdir(join(target, ".."), { recursive: true }); await writeFile(target, await readFile(join(source, file.path)), { flag: "wx" }); }
    if (build.version !== 11) throw Error("fixture plan missing");
    const assembled = await assembleExecutableArtifact({ store: f.store, stateDir: f.config.stateDir, actorId: f.session.actorId, workspace, sourceHash: original.profile.sourceHash, jobId: id, plan: build, receipt, signal: AbortSignal.timeout(5000), secrets: [] });
    const job = { id, projectId: original.id, baseRevision: original.profile.sourceHash, state: "succeeded", goal: "Synthetic compiled Go receipt", allowedPaths: [], testFiles: [], changedPaths: assembled.changedPaths,
      diff: null, beforeTest: null, afterTest: { command: "synthetic", exitCode: 0, signal: null, durationMs: 1, output: "synthetic", passed: true, buildOutput: receipt }, artifact: assembled.artifact, publication: assembled.publication,
      execution: "container", validationOnly: true, containerIds: ["1".repeat(64), "2".repeat(64)], containerImage: projectBuildImage, build, errorCode: null, message: "fixture", createdAt: Date.now(), updatedAt: Date.now() };
    f.store.db.prepare("INSERT INTO code_repair_jobs VALUES (?,?,?,?,?)").run(id, f.session.actorId, "succeeded", Date.now(), JSON.stringify({ job }));
    const selected = await prepareProjectFlow(f.config, f.store, f.session.actorId, { kind: "repair", directory: ".", jobId: id, artifactHash: assembled.artifact.archiveHash }, AbortSignal.timeout(5000));
    return { ...f, original, selected, build, job, receipt, secret };
  } catch (error) { f.close(); throw error; }
}
