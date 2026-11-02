import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash, randomUUID } from "node:crypto";
import { gzipSync } from "node:zlib";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { componentFixture } from "../helpers/component-fixture.ts";
import { validateComponentOutput, encodeComponentOutput, decodeComponentOutput } from "../../src/server/agent/component-output.ts";
import { componentVerification } from "../../src/server/application/component-verification.ts";
import { sealCredential } from "../../src/server/connections/credentials.ts";
import { LiaraReadClient } from "../../src/server/liara/client.ts";
import { LiaraDeployClient } from "../../src/server/liara/deploy.ts";
import { WorkloadProbe } from "../../src/server/liara/probe.ts";
import { proposeWorkloadDeployment, executeDeployment, observeDeployment } from "../../src/server/application/deployment.ts";
import { parseActionSpec } from "../../src/server/policy/action.ts";
import { decodeAction } from "../../src/contracts/client-decode.ts";
import { compiledProof } from "../../src/server/agent/fullstack-artifact.ts";
import { GoalModelClient } from "../../src/server/agent/model.ts";
import { createAgentRun, decideAgentPublication, driveAgentRun } from "../../src/server/agent/runs.ts";
import { executeAgentTool } from "../../src/server/agent/tools.ts";
import { AgentRepository } from "../../src/server/agent/store.ts";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { pnpmFixtureFiles } from "../helpers/pnpm-fixture.ts";
import { pnpmTarballs, writePnpmRegistryManifest, pnpmMetadataByteLimit } from "../../src/server/agent/pnpm-source.ts";
import { AppError } from "../../src/server/errors.ts";
import { inspectPnpmWorkspace } from "../../src/server/workspace/pnpm.ts";
import { sourcePnpmComponent } from "../../src/server/agent/pnpm-component.ts";
import { proposeDestination } from "../../src/server/application/provision.ts";
import { validateProjectAction } from "../../src/server/application/project-flows.ts";
import { LiaraAccountClient } from "../../src/server/liara/catalog.ts";
import { nodeBuildRuntime, parseProjectBuildPlan } from "../../src/contracts/project-build.ts";

test("Vite component output accepts the original equals flag and rejects ambiguous or missing values", async () => {
  const paths = ["package.json", "pnpm-workspace.yaml", "pnpm-lock.yaml", "apps/web/package.json"];
  const fixture = await Promise.all(paths.map(async path => ({ path, content: await readFile(join("tests/fixtures/pnpm-vue-component", path)) })));
  const filesFor = (build: string) => fixture.map(file => file.path !== "apps/web/package.json" ? file : { ...file, content: Buffer.from(JSON.stringify({ ...JSON.parse(file.content.toString()), scripts: { build } })) });
  for (const build of ["vite build --outDir=public-build", "vite build --outDir public-build"]) {
    const files = filesFor(build), workspace = inspectPnpmWorkspace(files); assert.ok(workspace);
    assert.equal(sourcePnpmComponent(files, workspace, "apps/web").outputDirectory, "public-build");
  }
  for (const build of ["vite build --outDir", "vite build --outDir=", "vite build --outDir=a --outDir=b", "vite build --outDir=public-build --outDir"]) {
    const files = filesFor(build), workspace = inspectPnpmWorkspace(files); assert.ok(workspace);
    assert.throws(() => sourcePnpmComponent(files, workspace, "apps/web"), { code: "COMPONENT_OUTPUT_UNSUPPORTED" });
  }
});

test("component destination creation rechecks local bytes before cloud env can exist; publication still requires matching env", async () => {
  const f = await componentFixture(true); try {
    const app = "component-destination", teamId = "a".repeat(24), accountId = "b".repeat(24), networkId = "c".repeat(24), config = { ...f.config, teamId, apps: [app], liaraToken: "synthetic-destination-only", enableMutations: true, enableLiveLiara: true };
    f.store.saveConnection(f.session.actorId, { source: "token", ciphertext: sealCredential("synthetic-destination-only", config.sessionSecret, f.session.actorId, "liara"), view: { provider: "liara", status: "connected", identityId: accountId, displayName: "Fixture", login: "fixture@example.test", teamId, teamName: "Fixture", selectedApp: null, apps: [], checkedAt: Date.now() } });
    const read = new LiaraAccountClient(config, accountId, async url => {
      const path = new URL(url).pathname;
      if (path === "/v1/me") return Response.json({ user: { _id: accountId }, team: { _id: teamId, balance: 10000 }, plans: { projects: { starter: { available: true, price: 10, region: "iran" } }, projectBundlePlans: { starter: { basic: { available: true, price: 1 } } } } });
      if (path === "/v1/networks") return Response.json({ networks: [{ _id: networkId, name: "fixture" }] });
      assert.equal(path, `/v1/projects/${app}`); return new Response(null, { status: 404 });
    });
    const action = await proposeDestination(config, f.store, f.session.actorId, { flowId: f.selected.id, app, planId: "starter", bundleId: "basic", networkId }, AbortSignal.timeout(5000), { read });
    assert.equal(action.spec.version, 22); assert.equal(action.state, "awaiting_approval");
    await validateProjectAction(config, f.store, f.session.actorId, action.spec, AbortSignal.timeout(5000));
    await assert.rejects(componentVerification(f.store, config.stateDir, f.session.actorId, f.selected, config.sessionSecret), { code: "COMPONENT_ENV_CHANGED" });
    assert.equal(f.store.db.prepare("SELECT count(*) AS n FROM attempts").get()?.n, 0);
  } finally { f.close(); }
});

test("component selection preserves executable dependencies and rejects CLI/hook starts instead of deleting them", async () => {
  const fixture = await pnpmFixtureFiles();
  const changed = (start: string, prestart?: string) => fixture.files.map(file => {
    if (!["apps/api/package.json", "packages/shared/package.json"].includes(file.path)) return file;
    const pkg = JSON.parse(file.content.toString()); pkg.scripts.start = file.path.startsWith("apps/") ? start : "node dist/value.cjs";
    if (prestart && file.path.startsWith("apps/")) pkg.scripts.prestart = prestart;
    return { ...file, content: Buffer.from(JSON.stringify(pkg)) };
  });
  const files = changed("node dist/main.js"), workspace = inspectPnpmWorkspace(files); assert.ok(workspace);
  const component = sourcePnpmComponent(files, workspace, "apps/api");
  assert.ok(component.remainingRoots.includes("packages/shared"), "a runtime dependency with its own start still requires separate acceptance");
  const plan = parseProjectBuildPlan({ ...nodeBuildRuntime(workspace.nodeVersion), version: 9, workspace, component, sourceHash: "a".repeat(64), buildCommand: "pnpm -r build", testCommand: component.testCommand,
    startCommand: "node dist/main.js", port: 8080, workload: { path: "/", status: 200, assertion: { kind: "json", field: "total", equals: 73 } }, apiChecks: [{ path: "/api/value", status: 200, assertions: [{ pointer: ["total"], equals: 73 }] }] });
  assert.throws(() => parseProjectBuildPlan({ ...plan, phase: "compile" }), { code: "COMPONENT_PLAN_CHANGED" });
  for (const unsupported of [changed("nest start"), changed("node dist/main.js", "node migrate.cjs")]) {
    const workspace = inspectPnpmWorkspace(unsupported); assert.ok(workspace);
    assert.throws(() => sourcePnpmComponent(unsupported, workspace, "apps/api"), { code: "COMPONENT_START_UNSUPPORTED" });
  }
});

test("full registry history uses one unchanged aggregate budget; frozen worker receives only original locked versions/times", async () => {
  const f = await agentFixture(); try {
    const fixture = await pnpmFixtureFiles(), items = pnpmTarballs(fixture.files), root = join(f.directory, "registry"); await mkdir(root);
    await writeFile(join(root, "manifest.json"), JSON.stringify(items.map(item => ({ file: item.file }))));
    const dependency = items.find(item => item.url.includes("/launchlane-fixture-value/")); assert.ok(dependency);
    const version = { name: "launchlane-fixture-value", version: "1.0.0", dist: { tarball: dependency.url, integrity: dependency.integrity } };
    const bytes = Buffer.from(JSON.stringify({ name: version.name, readme: "x".repeat(16 * 1024 * 1024), versions: { "1.0.0": version, "9.0.0": { ...version, version: "9.0.0" } }, time: { "1.0.0": "2020-01-01T00:00:00.000Z", "9.0.0": "2026-10-29T00:00:00.000Z" } }));
    let reads = 0;
    await writePnpmRegistryManifest(fixture.files, root, AbortSignal.timeout(5000), () => { reads++; }, async (_name, _signal, remaining) => { assert.equal(remaining, pnpmMetadataByteLimit); return bytes; });
    assert.equal(reads, 1); const stored = await readFile(join(root, "pnpm-metadata.json")); assert.ok(stored.length < 2048);
    assert.deepEqual(JSON.parse(stored.toString()), [{ path: `/${version.name}`, value: { name: version.name, versions: { "1.0.0": version }, time: { "1.0.0": "2020-01-01T00:00:00.000Z" } } }]);
    const compressed = join(f.directory, "compressed-registry"); await mkdir(compressed); await writeFile(join(compressed, "manifest.json"), JSON.stringify(items.map(item => ({ file: item.file }))));
    await writePnpmRegistryManifest(fixture.files, compressed, AbortSignal.timeout(5000), () => {}, async () => gzipSync(bytes));
    assert.deepEqual(await readFile(join(compressed, "pnpm-metadata.json")), stored);
    const denied = join(f.directory, "denied-registry"); await mkdir(denied); await writeFile(join(denied, "manifest.json"), JSON.stringify(items.map(item => ({ file: item.file }))));
    await assert.rejects(writePnpmRegistryManifest(fixture.files, denied, AbortSignal.timeout(5000), () => {}, async () => Buffer.alloc(pnpmMetadataByteLimit + 1)), { code: "PNPM_METADATA_LIMIT" });
    const bomb = join(f.directory, "compressed-limit"); await mkdir(bomb); await writeFile(join(bomb, "manifest.json"), JSON.stringify(items.map(item => ({ file: item.file }))));
    const compressedOversize = gzipSync(Buffer.alloc(pnpmMetadataByteLimit + 1, 120)); assert.ok(compressedOversize.length < 1024 * 1024);
    await assert.rejects(writePnpmRegistryManifest(fixture.files, bomb, AbortSignal.timeout(5000), () => {}, async () => compressedOversize), { code: "PNPM_METADATA_LIMIT" });
  } finally { f.close(); }
});

test("four bounded metadata readers share streaming bytes and preserve the first failure without writing a partial manifest", async () => {
  const f = await agentFixture(); try {
    const packages = Object.fromEntries(["one", "two", "three", "four"].map(name => [`${name}@1.0.0`, { resolution: { integrity: `sha512-${createHash("sha512").update(name).digest("base64")}` } }]));
    const files = [{ path: "pnpm-lock.yaml", content: Buffer.from(JSON.stringify({ lockfileVersion: "9.0", packages })) }], items = pnpmTarballs(files);
    const directory = async (name: string) => { const root = join(f.directory, name); await mkdir(root); await writeFile(join(root, "manifest.json"), JSON.stringify(items.map(item => ({ file: item.file })))); return root; };
    let active = 0, peak = 0, reads = 0, release = () => {}; const gate = new Promise<void>(resolve => { release = resolve; });
    const root = await directory("parallel");
    await writePnpmRegistryManifest(files, root, AbortSignal.timeout(5000), () => { reads++; }, async (name, _signal, _remaining, onBytes) => {
      active++; peak = Math.max(peak, active); if (active === 4) release(); await gate;
      const item = items.find(item => item.url.includes(`/${name}/-/`)); assert.ok(item);
      const bytes = Buffer.from(JSON.stringify({ name, time: { "1.0.0": "2020-01-01T00:00:00.000Z" }, versions: { "1.0.0": { name, version: "1.0.0", dist: { tarball: item.url, integrity: item.integrity } } } }));
      onBytes?.(bytes.length); active--; return bytes;
    });
    assert.equal(peak, 4); assert.equal(reads, 4); assert.equal(active, 0);
    assert.deepEqual(JSON.parse(await readFile(join(root, "pnpm-metadata.json"), "utf8")).map((row: { path: string }) => row.path), ["/four", "/one", "/three", "/two"]);
    const failed = await directory("first-failure"); let starts = 0;
    await assert.rejects(writePnpmRegistryManifest(files, failed, AbortSignal.timeout(5000), () => {}, async () => {
      if (starts++ === 0) throw new AppError("ORIGINAL_METADATA_FAILURE", "synthetic");
      return new Promise(() => {});
    }), { code: "ORIGINAL_METADATA_FAILURE" });
    assert.equal(starts, 4); await assert.rejects(readFile(join(failed, "pnpm-metadata.json")), { code: "ENOENT" });
    const limited = await directory("stream-limit"); let charged = 0;
    await assert.rejects(writePnpmRegistryManifest(files, limited, AbortSignal.timeout(5000), () => {}, async (_name, _signal, _remaining, onBytes) => {
      assert.ok(onBytes); for (let index = 0; index < 5; index++) { onBytes(16 * 1024 * 1024); charged += 16 * 1024 * 1024; }
      return Buffer.alloc(0);
    }), { code: "PNPM_METADATA_LIMIT" });
    assert.equal(charged, pnpmMetadataByteLimit); await assert.rejects(readFile(join(limited, "pnpm-metadata.json")), { code: "ENOENT" });
  } finally { f.close(); }
});

test("component output keeps executable bytes, internal links and strict bounds; rejects traversal, cycles, tamper and secrets", () => {
  const bytes = Buffer.from("compiled value"), file = { path: "packages/core/dist/core.cjs", type: "file", bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), executable: true };
  const output = { version: 1, sourceHash: "a".repeat(64), planHash: "b".repeat(64), entries: [file, { path: "apps/api/node_modules/core", type: "symlink", target: "packages/core" }], contents: [{ path: file.path, base64: bytes.toString("base64") }], totalBytes: bytes.length };
  const parsed = validateComponentOutput(output); assert.deepEqual(decodeComponentOutput(encodeComponentOutput(parsed)), parsed);
  for (const path of ["../outside", "/tmp/outside", "C:/outside", "apps/.env", "node_modules/.npmrc", "a/credentials.json", "a/.aws/config", "a\\b", "a/../b", "a/CON.js", "a/.", "a\u0000b"]) assert.throws(() => validateComponentOutput({ ...output, entries: [{ ...file, path }] }));
  const credentialModule = { ...file, path: "node_modules/auth/credentials.js" };
  assert.ok(validateComponentOutput({ ...output, entries: [credentialModule], contents: [{ path: credentialModule.path, base64: bytes.toString("base64") }] }));
  assert.throws(() => validateComponentOutput(output, ["compiled value"]));
  assert.throws(() => validateComponentOutput({ ...output, contents: [{ path: file.path, base64: Buffer.from("changed").toString("base64") }] }));
  assert.throws(() => validateComponentOutput({ ...output, entries: [...output.entries, { path: "apps/api/node_modules/core/child.js", type: "symlink", target: file.path }] }));
  assert.throws(() => validateComponentOutput({ ...output, entries: [file, { path: "a", type: "symlink", target: "b" }, { path: "b", type: "symlink", target: "a" }] }));
});

test("supply-chain metadata covers non-Linux optional lock entries without serving their binaries", async () => {
  const f = await agentFixture(); try {
    const fixture = await pnpmFixtureFiles(), integrity = `sha512-${Buffer.alloc(64, 1).toString("base64")}`;
    const files = fixture.files.map(file => file.path === "pnpm-lock.yaml" ? { ...file, content: Buffer.from(file.content.toString().replace("\npackages:\n", `\npackages:\n  android-only@1.0.0:\n    resolution: {integrity: ${integrity}}\n    os: [android]\n    cpu: [arm]\n`)) } : file);
    const items = pnpmTarballs(files); assert.ok(!items.some(item => item.url.includes("android-only")));
    const root = join(f.directory, "all-platform-metadata"); await mkdir(root); await writeFile(join(root, "manifest.json"), JSON.stringify(items.map(item => ({ file: item.file }))));
    const names: string[] = [];
    await writePnpmRegistryManifest(files, root, AbortSignal.timeout(5000), () => {}, async name => {
      names.push(name); const item = items.find(item => item.url.includes(`/${name}/`));
      return Buffer.from(JSON.stringify({ name, versions: { "1.0.0": { name, version: "1.0.0", dist: { tarball: item?.url ?? "https://registry.npmjs.org/android-only/-/android-only-1.0.0.tgz", integrity: item?.integrity ?? integrity } } }, time: { "1.0.0": "2020-01-01T00:00:00.000Z" } }));
    });
    assert.ok(names.includes("android-only")); assert.ok(!(await readFile(join(root, "pnpm-registry.json"), "utf8")).includes("android-only"));
  } finally { f.close(); }
});

test("source marker, foreign actor, changed host and lost output cannot authorize a component", async () => {
  const f = await componentFixture(); try {
    const actor = f.session.actorId;
    assert.ok(await componentVerification(f.store, f.config.stateDir, actor, f.selected, f.config.sessionSecret));
    await assert.rejects(componentVerification(f.store, f.config.stateDir, "foreign", f.selected, f.config.sessionSecret), { code: "COMPONENT_BUILD_REQUIRED" });
    await assert.rejects(componentVerification(f.store, f.config.stateDir, actor, { ...f.selected, selection: { kind: "local", directory: "service" } }, f.config.sessionSecret), { code: "COMPONENT_BUILD_REQUIRED" });
    await assert.rejects(componentVerification(f.store, f.config.stateDir, actor, { ...f.selected, profile: { ...f.selected.profile, manifest: f.selected.profile.manifest.filter(file => file.path !== ".launchlane-component.cjs") } }, f.config.sessionSecret), { code: "COMPONENT_RUNTIME_CHANGED" });
    const output = join(f.config.stateDir, "build-outputs", `${f.receipt.artifactHash}.component.gz`), bytes = await readFile(output);
    await writeFile(output, Buffer.from("changed")); await assert.rejects(componentVerification(f.store, f.config.stateDir, actor, f.selected, f.config.sessionSecret)); await writeFile(output, bytes);
  } finally { f.close(); }
});

test("shared Agent, approval, Docker adapter and release fences publish only the exact compiled component", async () => {
  const f = await componentFixture(); try {
    const app = "component-fixture", team = "a".repeat(24), targetId = "b".repeat(24), origin = `https://${app}.example.com`, config = { ...f.config, teamId: team, apps: [app], liaraToken: "synthetic-component-provider", enableMutations: true, enableLiveLiara: true, probeOrigins: { [app]: origin } };
    f.store.saveConnection(f.session.actorId, { source: "token", ciphertext: sealCredential(config.liaraToken, config.sessionSecret, f.session.actorId, "liara"), view: { provider: "liara", status: "connected", identityId: "fixture-account", displayName: "Fixture", login: "fixture@example.test", teamId: team, teamName: "Fixture", selectedApp: app, apps: [{ id: targetId, name: app, platform: "docker" }], checkedAt: Date.now() } });
    let release = "fixture-release", writes = 0;
    const read = new LiaraReadClient(config, async url => Response.json(new URL(url).pathname.endsWith("/releases") ? { total: 1, currentRelease: release, releases: [{ _id: release, state: "READY", port: 8080 }] } : { project: { _id: targetId, project_id: app, type: "docker", status: "Running", envs: [], planID: "fixture-plan" } }));
    const writer = new LiaraDeployClient(config, async (url, request) => {
      writes++; if (new URL(url).pathname.endsWith("/sources")) { assert.ok(request.body instanceof FormData); const archive = request.body.get("file"); assert.ok(archive instanceof Blob); assert.equal(createHash("sha256").update(Buffer.from(await archive.arrayBuffer())).digest("hex"), f.selected.artifact?.archiveHash); return Response.json({ sourceID: "fixture-source" }); }
      assert.deepEqual(JSON.parse(String(request.body)), { sourceID: "fixture-source", port: 8080, type: "docker", platformConfig: {}, build: { dockerfile: ".launchlane-component.Dockerfile" } }); return Response.json({ releaseID: "fixture-release" });
    });
    for (const mode of ["wrong-proof", "unhealthy-api", "release-changed", "correct"] as const) {
      release = "fixture-release";
      const action = await proposeWorkloadDeployment(config, f.store, f.session.actorId, { flowId: f.selected.id, app, port: null, workload: { origin, ...f.build.workload } }, AbortSignal.timeout(5000), { read });
      assert.equal(action.spec.version, 40); assert.deepEqual(parseActionSpec(action.spec), action.spec); assert.deepEqual(decodeAction(action).spec, action.spec);
      f.store.decide(action.id, f.session.actorId, f.session.id, action.hash, "approve");
      await executeDeployment(config, f.store, f.session, action.id, AbortSignal.timeout(5000), { read, write: writer });
      const probe = new WorkloadProbe(config, async () => [{ address: "93.184.216.34", family: 4 }], async url => {
        if (mode === "release-changed") release = "another-release";
        const body = url.pathname === "/launchlane-build-proof.json" ? mode === "wrong-proof" ? "older release" : compiledProof(f.job.publication) : JSON.stringify({ total: mode === "unhealthy-api" && url.pathname === "/api/value" ? 74 : 73 });
        return { status: 200, body, bytes: Buffer.byteLength(body), durationMs: 1, contentType: "application/json" };
      });
      const observed = await observeDeployment(config, f.store, f.session, action.id, AbortSignal.timeout(5000), { read, probe });
      assert.equal(observed.state, mode === "correct" ? "succeeded" : mode === "release-changed" ? "observing" : "failed", JSON.stringify(observed.deployment?.observation));
      assert.throws(() => f.store.claim(action.id, f.session.actorId, f.session.id, action.spec));
      if (mode === "release-changed") {
        // Preserve the unresolved write; recover by fresh observations of that same release.
        release = "fixture-release";
        const recoveredProbe = new WorkloadProbe(config, async () => [{ address: "93.184.216.34", family: 4 }], async url => {
          const body = url.pathname === "/launchlane-build-proof.json" ? compiledProof(f.job.publication) : JSON.stringify({ total: 73 });
          return { status: 200, body, bytes: Buffer.byteLength(body), durationMs: 1, contentType: "application/json" };
        });
        assert.equal((await observeDeployment(config, f.store, f.session, action.id, AbortSignal.timeout(5000), { read, probe: recoveredProbe })).state, "succeeded");
      }
    }
    assert.equal(writes, 8);
    const model = new GoalModelClient(config, async () => Response.json({ choices: [{ finish_reason: "tool_calls", message: { role: "assistant", tool_calls: [{ id: randomUUID(), type: "function", function: { name: "propose_publication", arguments: JSON.stringify(f.build.workload) } }] } }], usage: { total_tokens: 10 } }));
    const probe = new WorkloadProbe(config, async () => [{ address: "93.184.216.34", family: 4 }], async url => { const body = url.pathname === "/launchlane-build-proof.json" ? compiledProof(f.job.publication) : JSON.stringify({ total: 73 }); return { status: 200, body, bytes: Buffer.byteLength(body), durationMs: 1, contentType: "application/json" }; });
    const dependencies = { model, tool: (name: string, args: unknown, context: Parameters<typeof executeAgentTool>[2]) => executeAgentTool(name, args, { ...context, read }), deployment: { read, write: writer, probe }, pollDelayMs: 1 };
    const run = createAgentRun(config, f.store, f.session, randomUUID(), "همان component را منتشر کن", f.selected.id).run;
    await driveAgentRun(config, f.store, f.session, run.id, dependencies); const repo = new AgentRepository(f.store), proposed = repo.get(f.session.actorId, run.id); assert.ok(proposed?.publication); assert.equal(writes, 8);
    await decideAgentPublication(config, f.store, f.session, proposed.id, proposed.revision, proposed.publication.id, "approve"); await driveAgentRun(config, f.store, f.session, run.id, dependencies);
    const finished = repo.get(f.session.actorId, run.id); assert.ok(finished); assert.equal(finished.state, "partially_completed"); assert.equal(finished.effect, "remote_changes_verified"); assert.equal(finished.publication?.state, "succeeded"); assert.equal(writes, 10);
  } finally { f.close(); }
});
