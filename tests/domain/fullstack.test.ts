import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import { testOutputProgram } from "../../src/server/agent/container.ts";
import { gunzipSync } from "node:zlib";
import { extract } from "tar-stream";
import { test } from "node:test";

test("declared tests that skip their database checks cannot become a successful fullstack receipt", () => {
  const check: unknown = runInNewContext(`${testOutputProgram}; incompleteTestLine`);
  assert.equal(typeof check, "function"); if (typeof check !== "function") return;
  for (const line of ["SKIP: AI_HISTORY_TEST_DB_URL is not set.", "# SKIP: AI_HISTORY_TEST_DB_URL is not set.", "\u001b[33m# SKIP: database unavailable\u001b[0m", "# skipped 1", "ℹ skipped 2", "Tests 4 passed | 1 skipped", "ok 1 - database # SKIP unavailable", "No test files found, exiting with code 0", "# tests 0"]) assert.equal(check(line), true, line);
  for (const line of ["# tests 14", "# skipped 0", "ℹ skipped 0", "Tests 12 passed", "ok 1 - preserves skipped row labels", "  # todo 0"]) assert.equal(check(line), false, line);
});
import { captureProject } from "../../src/server/workspace/inspect.ts";
import { fullstackPreparation, fullstackTarballs, prepareFullstackFiles } from "../../src/server/agent/fullstack-preparation.ts";
import { parseProjectBuildPlan, projectBuildImage } from "../../src/contracts/project-build.ts";
import { validateBuildPlan } from "../../src/server/agent/build-policy.ts";
import { matchesFullstackApi, parseFullstackApiChecks } from "../../src/contracts/fullstack.ts";
import { decodeProfile } from "../../src/contracts/client-decode.ts";
import { validateBuildOutput } from "../../src/server/agent/build-output.ts";
import { persistBuildOutput } from "../../src/server/agent/build-output-store.ts";
import { fingerprint } from "../../src/server/policy/action.ts";
import { assembleFullstackArtifact, compiledBuildVerifier, compiledProof, compiledProofPath } from "../../src/server/agent/fullstack-artifact.ts";
import { readArtifact } from "../../src/server/workspace/archive.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import { fullstackVerification } from "../../src/server/application/fullstack-verification.ts";
import { agentFixture } from "../helpers/agent-fixture.ts";
import type { SourceFile } from "../../src/server/workspace/inspect.ts";
import { sealCredential } from "../../src/server/connections/credentials.ts";
import { LiaraReadClient } from "../../src/server/liara/client.ts";
import { LiaraDeployClient } from "../../src/server/liara/deploy.ts";
import { WorkloadProbe } from "../../src/server/liara/probe.ts";
import { executeDeployment, observeDeployment, proposeWorkloadDeployment } from "../../src/server/application/deployment.ts";
import { parseActionSpec } from "../../src/server/policy/action.ts";
import { decodeAction } from "../../src/contracts/client-decode.ts";
import { createAgentRun, decideAgentPublication, driveAgentRun } from "../../src/server/agent/runs.ts";
import { AgentRepository } from "../../src/server/agent/store.ts";
import { GoalModelClient } from "../../src/server/agent/model.ts";
import { executeAgentTool } from "../../src/server/agent/tools.ts";

const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const apiChecks = [{ path: "/health/db", status: 200, assertions: [{ pointer: ["auth", "ok"], equals: true }, { pointer: ["profile", "ok"], equals: true }] }];
function sourceFiles() {
  const pkg = { name: "fullstack-fixture", type: "module", engines: { node: ">=18" }, dependencies: { react: "18.3.1", vite: "6.4.3", express: "4.19.2", tsx: "4.20.0" },
    scripts: { start: "node frontend-server.cjs", server: "tsx --tsconfig tsconfig.ai.json server/index.ts", build: "vite build && npm --prefix guides install --legacy-peer-deps && npm --prefix guides run build" } };
  const lock = { lockfileVersion: 3, packages: { "": {}, "node_modules/sample": { resolved: "https://registry.npmjs.org/sample/-/sample-1.0.0.tgz", integrity: `sha512-${Buffer.alloc(64, 1).toString("base64")}` } } };
  return [
    { path: "package.json", content: JSON.stringify(pkg) }, { path: "package-lock.json", content: JSON.stringify(lock) },
    { path: "guides/package.json", content: JSON.stringify({ name: "guides", engines: { node: ">=22.12" }, scripts: { build: "astro build" } }) },
    { path: "guides/package-lock.json", content: JSON.stringify(lock) }, { path: "guides/src/index.astro", content: "<main>Guide</main>" },
    { path: "vite.config.ts", content: "export default {build:{outDir:'build'}}" }, { path: "tsconfig.ai.json", content: "{}" },
    { path: "server/index.ts", content: "import express from 'express';const app=express();app.use(express.static('build'));app.get('/health/db',(_req,res)=>res.json({auth:{ok:true},profile:{ok:true}}));app.listen(8000);" },
    { path: "frontend-server.cjs", content: "require('node:http').createServer().listen(3000)" }, { path: "server/migrations/001.sql", content: "CREATE TABLE IF NOT EXISTS audit_entries (id integer);" },
    { path: "Dockerfile", content: "FROM node:22\nCOPY server /app/server\nEXPOSE 8000\nCMD [\"node\",\"/app/server/index.js\"]" },
    { path: "liara.json", content: JSON.stringify({ platform: "docker", port: 8000, app: "old-backend", build: { location: "iran" } }) },
  ].map(file => ({ path: file.path, content: Buffer.from(file.content) }));
}
async function writeFiles(root: string, files: readonly SourceFile[] = sourceFiles()) { for (const file of files) { const path = join(root, file.path); await mkdir(join(path, ".."), { recursive: true }); await writeFile(path, file.content); } }

test("mixed frontend/API projects cannot silently become a frontend-only or backend-only release", async () => {
  const root = await mkdtemp(join(tmpdir(), "launchlane-fullstack-"));
  try {
    await writeFiles(root); const captured = await captureProject(root, "."), profile = captured.profile;
    assert.equal(profile.runtime, "node"); assert.equal(profile.frontendRuntime, undefined); assert.equal(profile.dockerRuntime, undefined);
    assert.equal(profile.start, "node frontend-server.cjs", "inspection reports the real current command, even when it is insufficient");
    assert.equal(profile.fullstack?.requiresPreparation, true); assert.equal(profile.fullstack?.backendScript, "server"); assert.equal(profile.fullstack?.entryFile, "server/index.ts");
    assert.equal(profile.fullstack?.outputDirectory, "build"); assert.deepEqual(profile.fullstack?.packageRoots, [".", "guides"]);
    assert.deepEqual(decodeProfile({ profile }), profile);
    const plan = fullstackPreparation(captured.files, profile);
    assert.equal(plan.nodeVersion, "22"); assert.equal(plan.startCommand, "tsx --tsconfig tsconfig.ai.json server/index.ts");
    assert.match(plan.buildCommand, /npm --prefix guides ci --offline/); assert.match(plan.buildCommand, /--legacy-peer-deps/);
    assert.equal(fullstackTarballs(captured.files, plan).length, 1, "identical locked bytes are fetched once across roots");
    const prepared = prepareFullstackFiles(captured.files, profile, plan);
    for (const file of captured.files.filter(file => !["package.json", "liara.json"].includes(file.path))) assert.ok(prepared.find(next => next.path === file.path)?.content.equals(file.content));
    const pkg = JSON.parse(prepared.find(file => file.path === "package.json")?.content.toString() ?? "null");
    assert.deepEqual(pkg.dependencies, JSON.parse(captured.files.find(file => file.path === "package.json")?.content.toString() ?? "null").dependencies);
    assert.equal(pkg.scripts.server, plan.startCommand); assert.equal(pkg.scripts.start, plan.startCommand);
    const build = parseProjectBuildPlan({ version: 7, nodeVersion: "22", image: projectBuildImage, fullstack: plan, apiChecks,
      buildCommand: plan.buildCommand, startCommand: plan.startCommand, testCommand: null, port: 8000, workload: { path: "/", status: 200, assertion: { kind: "text", contains: "Full application" } } });
    assert.equal(validateBuildPlan(captured.files, profile, build).version, 7);
    assert.throws(() => validateBuildPlan(captured.files, profile, parseProjectBuildPlan({ version: 1, nodeVersion: "22", image: projectBuildImage, buildCommand: profile.build, startCommand: "node frontend-server.cjs", testCommand: null, port: 8000, workload: build.workload })), { code: "FULLSTACK_BUILD_REQUIRED" });
    assert.throws(() => parseProjectBuildPlan({ ...build, apiChecks: [] }), { code: "FULLSTACK_API_CHECK_REQUIRED" });
    assert.throws(() => parseProjectBuildPlan({ ...build, fullstack: { ...plan, nodeVersion: "24" } }), { code: "FULLSTACK_BUILD_CHANGED" });
    for (const hook of ["postbuild", "prestart", "prepare", "postinstall"]) {
      const hooked = captured.files.map(file => file.path === "package.json" ? { ...file, content: Buffer.from(JSON.stringify({ ...pkg, scripts: { ...pkg.scripts, [hook]: "node rewrite-output.cjs" } })) } : file);
      assert.throws(() => fullstackPreparation(hooked, profile), { code: "FULLSTACK_LIFECYCLE_REVIEW_REQUIRED" });
    }
    assert.ok((await readFile(join(root, "package.json"))).equals(captured.files.find(file => file.path === "package.json")?.content ?? Buffer.alloc(0)), "inspection and preparation do not edit original files");
  } finally { await rm(root, { recursive: true, force: true }); }
});
test("HTTP200, a frontend fallback, one healthy database and inherited JSON fields cannot satisfy complete API criteria", () => {
  const [check] = parseFullstackApiChecks(apiChecks); assert.ok(check);
  assert.equal(matchesFullstackApi(check, 200, '<html>Full application</html>'), false);
  assert.equal(matchesFullstackApi(check, 200, JSON.stringify({ auth: { ok: false }, profile: { ok: true } })), false);
  assert.equal(matchesFullstackApi(check, 200, JSON.stringify({ auth: { ok: true }, profile: { ok: true } })), true);
  assert.equal(matchesFullstackApi(check, 503, JSON.stringify({ auth: { ok: true }, profile: { ok: true } })), false);
  assert.throws(() => parseFullstackApiChecks([{ ...check, assertions: [{ pointer: ["__proto__", "ok"], equals: true }] }]));
});
test("the final archive and project selection retain exact compiled bytes and their tested-source provenance", async () => {
  const f = await agentFixture();
  try {
    const root = join(f.config.stateDir, "repair-workspaces", randomUUID()); await mkdir(root, { recursive: true }); await writeFiles(root);
    const before = await captureProject(root, "."), preparation = fullstackPreparation(before.files, before.profile);
    await writeFiles(root, prepareFullstackFiles(before.files, before.profile, preparation));
    const tested = await captureProject(root, "."), build = parseProjectBuildPlan({ version: 7, nodeVersion: "22", image: projectBuildImage, fullstack: preparation, apiChecks,
      buildCommand: preparation.buildCommand, testCommand: null, startCommand: preparation.startCommand, port: 8000, workload: { path: "/", status: 200, assertion: { kind: "text", contains: "Full application" } } });
    const contents = new Map([["index.html", Buffer.from('<!doctype html><html>Full application<script src="/app.js"></script></html>')], ["app.js", Buffer.from("console.log('compiled exact bytes')")]]);
    const output = validateBuildOutput({ version: 1, files: [...contents].map(([path, bytes]) => ({ path, type: "file", bytes: bytes.length, sha256: digest(bytes) })) }, contents);
    const receipt = await persistBuildOutput(f.config.stateDir, output, { sourceHash: tested.profile.sourceHash, planHash: fingerprint(build) });
    const assembled = await assembleFullstackArtifact({ stateDir: f.config.stateDir, store: f.store, actorId: f.session.actorId, workspace: root, sourceHash: tested.profile.sourceHash,
      plan: build, receipt, signal: AbortSignal.timeout(5000), secrets: [] });
    const archive = extract(), files = new Map<string, Buffer>(), finished = new Promise<void>((resolve, reject) => { archive.once("finish", resolve); archive.once("error", reject); });
    archive.on("entry", (header, stream, next) => { const chunks: Buffer[] = []; stream.on("data", (value: unknown) => { assert.ok(Buffer.isBuffer(value)); chunks.push(value); }); stream.once("end", () => { files.set(header.name, Buffer.concat(chunks)); next(); }); stream.resume(); });
    archive.end(gunzipSync(await readArtifact(f.config.stateDir, assembled.artifact))); await finished;
    assert.ok(files.get("build/index.html")?.equals(contents.get("index.html") ?? Buffer.alloc(0))); assert.ok(files.get("build/app.js")?.equals(contents.get("app.js") ?? Buffer.alloc(0)));
    assert.equal(files.get(".launchlane-build.cjs")?.toString(), compiledBuildVerifier); assert.equal(JSON.parse(files.get("package.json")?.toString() ?? "null").scripts.build, "node .launchlane-build.cjs");
    const jobId = root.split(/[\\/]/).at(-1); assert.ok(jobId);
    f.store.db.prepare("INSERT INTO code_repair_jobs VALUES (?,?,?,?,?)").run(jobId, f.session.actorId, "succeeded", Date.now(), JSON.stringify({ job: {
      id: jobId, projectId: f.flow.id, baseRevision: before.profile.sourceHash, state: "succeeded", goal: "Controlled assembled artifact fixture", allowedPaths: [], testFiles: [], changedPaths: assembled.changedPaths,
      diff: null, beforeTest: null, afterTest: { command: "controlled receipt fixture", exitCode: 0, signal: null, output: "fixture", durationMs: 1, passed: true, buildOutput: receipt },
      artifact: assembled.artifact, publication: assembled.publication, execution: "container", containerIds: ["1".repeat(64)], containerImage: projectBuildImage, build, errorCode: null, message: "fixture", createdAt: Date.now(), updatedAt: Date.now(),
    } }));
    const selected = await prepareProjectFlow(f.config, f.store, f.session.actorId, { kind: "repair", directory: ".", jobId, artifactHash: assembled.artifact.archiveHash }, AbortSignal.timeout(5000));
    assert.equal(selected.artifact?.archiveHash, assembled.artifact.archiveHash, "selection must not rearchive and drop compiled files");
    assert.equal((await fullstackVerification(f.store, f.config.stateDir, f.session.actorId, selected, f.config.sessionSecret)).outputArtifactHash, receipt.artifactHash);
    const verify = join(f.directory, "trusted-verify"); await mkdir(verify); for (const [path, bytes] of files) { const target = join(verify, path); await mkdir(join(target, ".."), { recursive: true }); await writeFile(target, bytes); }
    assert.equal(spawnSync(process.execPath, [join(verify, ".launchlane-build.cjs")], { encoding: "utf8", timeout: 5000 }).status, 0);
    await writeFile(join(verify, "build", "app.js"), "tampered"); assert.notEqual(spawnSync(process.execPath, [join(verify, ".launchlane-build.cjs")], { encoding: "utf8", timeout: 5000 }).status, 0);
    await writeFile(join(verify, "build", "app.js"), contents.get("app.js") ?? ""); await writeFile(join(verify, "build", "unexpected.txt"), "unexpected output");
    assert.notEqual(spawnSync(process.execPath, [join(verify, ".launchlane-build.cjs")], { encoding: "utf8", timeout: 5000 }).status, 0, "unreviewed extra output must fail verification");
    const app = "fullstack-fixture", team = "a".repeat(24), targetId = "b".repeat(24), origin = `https://${app}.example.com`;
    const config = { ...f.config, teamId: team, apps: [app], liaraToken: "synthetic-fullstack-provider", enableMutations: true, enableLiveLiara: true, probeOrigins: { [app]: origin } };
    f.store.saveConnection(f.session.actorId, { source: "token", ciphertext: sealCredential(config.liaraToken, config.sessionSecret, f.session.actorId, "liara"),
      view: { provider: "liara", status: "connected", identityId: "fixture-account", displayName: "Fixture", login: "fixture@example.test", teamId: team, teamName: "Fixture", selectedApp: app,
        apps: [{ id: targetId, name: app, platform: "node" }], checkedAt: Date.now() } });
    const read = new LiaraReadClient(config, async url => Response.json(new URL(url).pathname.endsWith("/releases")
      ? { total: 1, currentRelease: "fixture-release", releases: [{ _id: "fixture-release", state: "READY", port: 8000 }] }
      : { project: { _id: targetId, project_id: app, type: "node", status: "Running", envs: [], planID: "fixture-plan" } }));
    let writes = 0, writeError: unknown;
    const writer = new LiaraDeployClient(config, async (url, request) => {
      try {
      writes++;
      if (new URL(url).pathname.endsWith("/sources")) {
        assert.ok(request.body instanceof FormData); const archive = request.body.get("file"); assert.ok(archive instanceof Blob);
        assert.equal(digest(Buffer.from(await archive.arrayBuffer())), assembled.artifact.archiveHash);
        return Response.json({ sourceID: "fixture-source" });
      }
      assert.deepEqual(JSON.parse(String(request.body)), { sourceID: "fixture-source", port: 8000, type: "node", platformConfig: { version: "22" } });
      return Response.json({ releaseID: "fixture-release" });
      } catch (error) { writeError = error; throw error; }
    });
    for (const mode of ["wrong-proof", "unhealthy-api", "wrong-asset", "correct"] as const) {
      const action = await proposeWorkloadDeployment(config, f.store, f.session.actorId, { flowId: selected.id, app, port: null, workload: { origin, ...build.workload } }, AbortSignal.timeout(5000), { read });
      assert.ok(action.spec.version === 23); assert.deepEqual(parseActionSpec(action.spec), action.spec); assert.deepEqual(decodeAction(action).spec, action.spec);
      const proof = compiledProof(action.spec.verification);
      assert.notEqual(fingerprint(action.spec), fingerprint({ ...action.spec, verification: { ...action.spec.verification, outputArtifactHash: "f".repeat(64) } }));
      f.store.decide(action.id, f.session.actorId, f.session.id, action.hash, "approve");
      await executeDeployment(config, f.store, f.session, action.id, AbortSignal.timeout(5000), { read, write: writer }).catch(error => { throw writeError ?? error; });
      const probe = new WorkloadProbe(config, async () => [{ address: "93.184.216.34", family: 4 }], async url => {
        const body = url.pathname === compiledProofPath ? mode === "wrong-proof" ? "an older release" : proof : url.pathname === "/health/db"
          ? JSON.stringify({ auth: { ok: true }, profile: { ok: mode !== "unhealthy-api" } }) : url.pathname === "/app.js"
            ? mode === "wrong-asset" ? "a changed browser bundle" : contents.get("app.js")?.toString() ?? "" : contents.get("index.html")?.toString() ?? "";
        return { status: 200, body, bytes: Buffer.byteLength(body), durationMs: 1, contentType: url.pathname === "/app.js" ? "application/javascript" : "text/html" };
      });
      const observed = await observeDeployment(config, f.store, f.session, action.id, AbortSignal.timeout(5000), { read, probe });
      assert.equal(observed.state, mode === "correct" ? "succeeded" : "failed");
      assert.equal(observed.deployment?.observation?.code, mode === "correct" ? "WORKLOAD_VERIFIED" : mode === "wrong-proof" ? "FULLSTACK_VERSION_MISMATCH" : mode === "wrong-asset" ? "FULLSTACK_ASSET_MISMATCH" : "FULLSTACK_API_MISMATCH");
    }
    assert.equal(writes, 8, "each synthetic publication performs exactly one upload and one release");
    const model = new GoalModelClient(config, async () => Response.json({ choices: [{ finish_reason: "tool_calls", message: { role: "assistant", tool_calls: [{ id: randomUUID(), type: "function", function: {
      name: "propose_publication", arguments: JSON.stringify(build.workload),
    } }] } }], usage: { total_tokens: 10 } }));
    const probe = new WorkloadProbe(config, async () => [{ address: "93.184.216.34", family: 4 }], async url => {
      const body = url.pathname === compiledProofPath ? compiledProof(await fullstackVerification(f.store, config.stateDir, f.session.actorId, selected, config.sessionSecret))
        : url.pathname === "/health/db" ? JSON.stringify({ auth: { ok: true }, profile: { ok: true } }) : contents.get(url.pathname === "/app.js" ? "app.js" : "index.html")?.toString() ?? "";
      return { status: 200, body, bytes: Buffer.byteLength(body), durationMs: 1, contentType: url.pathname === "/app.js" ? "application/javascript" : "text/html" };
    });
    const dependencies = { model, tool: (name: string, args: unknown, context: Parameters<typeof executeAgentTool>[2]) => executeAgentTool(name, args, { ...context, read }),
      deployment: { read, write: writer, probe }, pollDelayMs: 1 };
    const run = createAgentRun(config, f.store, f.session, randomUUID(), "پروژهٔ کامل و آزموده‌شده را منتشر کن", selected.id).run;
    await driveAgentRun(config, f.store, f.session, run.id, dependencies);
    const repo = new AgentRepository(f.store), proposed = repo.get(f.session.actorId, run.id);
    assert.ok(proposed?.publication); assert.equal(proposed.publication.spec.version, 23); assert.equal(proposed.state, "needs_approval");
    assert.equal(writes, 8, "the Agent caller must pause before either provider write");
    await decideAgentPublication(config, f.store, f.session, proposed.id, proposed.revision, proposed.publication.id, "approve");
    await driveAgentRun(config, f.store, f.session, run.id, dependencies);
    assert.equal(repo.get(f.session.actorId, run.id)?.state, "completed"); assert.equal(writes, 10);
  } finally { f.close(); }
});
