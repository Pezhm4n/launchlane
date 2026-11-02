import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { agentFixture } from "./agent-fixture.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import { parseProjectBuildPlan } from "../../src/contracts/project-build.ts";
import { phpBuildImage } from "../../src/contracts/php-runtime.ts";
import { sourceBuildEnvironment } from "../../src/server/environment/build.ts";
import { validateComponentOutput } from "../../src/server/agent/component-output.ts";
import { persistComponentOutput } from "../../src/server/agent/build-output-store.ts";
import { assemblePhpArtifact } from "../../src/server/agent/php-artifact.ts";
import { fingerprint } from "../../src/server/policy/action.ts";
import { createHash } from "node:crypto";

/** Synthetic installed/worker receipt only; the separate sandbox suite runs actual Composer/PHPUnit/Apache. */
export async function phpFixture(privateInput = false) {
  const f = await agentFixture(); try {
    const source = join(f.workspace, "php"), secret = randomUUID(); await cp(resolve("tests/fixtures/php-service"), source, { recursive: true });
    if (privateInput) await writeFile(join(source, ".env"), `APP_LABEL=${secret}\n`);
    const original = await prepareProjectFlow(f.config, f.store, f.session.actorId, { kind: "local", directory: "php" }, AbortSignal.timeout(5000)), runtime = original.profile.phpRuntime;
    if (!runtime) throw Error("fixture PHP runtime missing");
    const sourceEnvironment = sourceBuildEnvironment(f.config, f.store, f.session.actorId, original.id), build = parseProjectBuildPlan({ version: 12, nodeVersion: null, image: phpBuildImage,
      sourceHash: original.profile.sourceHash, runtime, buildCommand: "composer install --prefer-dist", testCommand: "phpunit original configuration", startCommand: "launchlane-installed-php", port: runtime.port,
      workload: { path: "/api/orders", status: 200, assertion: { kind: "json", field: "total", equals: 73 } }, ...(sourceEnvironment ? { sourceEnvironment } : {}) });
    const bytes = Buffer.from("synthetic installed PHP"), output = validateComponentOutput({ version: 1, sourceHash: original.profile.sourceHash, planHash: fingerprint(build), entries: [{ path: "public/index.php", type: "file", bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), executable: false }], contents: [{ path: "public/index.php", base64: bytes.toString("base64") }], totalBytes: bytes.length });
    const receipt = await persistComponentOutput(f.config.stateDir, output), id = randomUUID(), workspace = join(f.config.stateDir, "repair-workspaces", id);
    await mkdir(workspace, { recursive: true });
    for (const file of original.profile.manifest) { const target = join(workspace, file.path); await mkdir(join(target, ".."), { recursive: true }); await writeFile(target, await readFile(join(source, file.path)), { flag: "wx" }); }
    if (build.version !== 12) throw Error("fixture plan missing");
    const assembled = await assemblePhpArtifact({ store: f.store, stateDir: f.config.stateDir, actorId: f.session.actorId, workspace, sourceHash: original.profile.sourceHash, jobId: id, plan: build, receipt, signal: AbortSignal.timeout(5000), secrets: [] });
    const job = { id, projectId: original.id, baseRevision: original.profile.sourceHash, state: "succeeded", goal: "Synthetic installed PHP receipt", allowedPaths: [], testFiles: [], changedPaths: assembled.changedPaths,
      diff: null, beforeTest: null, afterTest: { command: "synthetic", exitCode: 0, signal: null, durationMs: 1, output: "synthetic", passed: true, buildOutput: receipt }, artifact: assembled.artifact, publication: assembled.publication,
      execution: "container", validationOnly: true, containerIds: ["1".repeat(64), "2".repeat(64)], containerImage: phpBuildImage, build, errorCode: null, message: "fixture", createdAt: Date.now(), updatedAt: Date.now() };
    f.store.db.prepare("INSERT INTO code_repair_jobs VALUES (?,?,?,?,?)").run(id, f.session.actorId, "succeeded", Date.now(), JSON.stringify({ job }));
    const selected = await prepareProjectFlow(f.config, f.store, f.session.actorId, { kind: "repair", directory: ".", jobId: id, artifactHash: assembled.artifact.archiveHash }, AbortSignal.timeout(5000));
    return { ...f, original, selected, build, job, receipt, secret };
  } catch (error) { f.close(); throw error; }
}
