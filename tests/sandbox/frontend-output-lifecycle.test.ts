import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { gzipSync } from "node:zlib";
import { pack } from "tar-stream";
import { parseProjectBuildPlan, node20BuildImage } from "../../src/contracts/project-build.ts";
import { CodeRepairAdapter } from "../../src/server/agent/code-repair.ts";
import { docker, resolveCreatedContainer, runContainerBuild } from "../../src/server/agent/container.ts";
import { persistBuildOutput, readBuildOutput } from "../../src/server/agent/build-output-store.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import { fingerprint } from "../../src/server/policy/action.ts";
import { agentFixture } from "../helpers/agent-fixture.ts";

const frontend = { kind: "react", builder: "vite", nodeVersion: "20", outputDirectory: "build", mirror: false } as const;
const plan = parseProjectBuildPlan({ version: 5, nodeVersion: "20", image: node20BuildImage, frontend,
  buildCommand: "node build.cjs", testCommand: null, startCommand: "liara-frontend", port: 80,
  workload: { path: "/", status: 200, assertion: { kind: "text", contains: "Durable frontend" } } });
const html = '<!doctype html><title>Durable frontend</title><script src="/app.js"></script>';
const javascript = 'document.body.dataset.ready="verified";';
const binary = Buffer.from([0, 255, 128, 17]);
const script = `const fs=require('node:fs');fs.mkdirSync('build',{recursive:true});fs.writeFileSync('build/index.html',${JSON.stringify(html)});fs.writeFileSync('build/app.js',${JSON.stringify(javascript)});fs.writeFileSync('build/picture.png',Buffer.from([0,255,128,17]));`;
test("Docker readback confirms a truly absent create and recovers the exact stopped worker after a lost reply", async () => {
  const expected = { name: `launchlane-build-${randomUUID()}`, image: node20BuildImage, label: "locked-build-v1" },
    lost = { output: "", exitCode: null, signal: "SIGTERM" };
  assert.equal(await resolveCreatedContainer(lost, expected), null);
  let id: string | null = null;
  try {
    const created = await docker(["create", "--pull=never", "--name", expected.name, "--label", `ir.launchlane.worker=${expected.label}`, "--network", "none", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", expected.image, "node", "-e", "process.exit(0)"], AbortSignal.timeout(10000), 4096);
    id = await resolveCreatedContainer(created, expected);
    assert.equal(created.exitCode, 0, created.output); assert.ok(id);
    assert.equal(await resolveCreatedContainer(lost, expected), id);
  } finally {
    if (id) assert.equal((await docker(["rm", "--force", id], AbortSignal.timeout(5000), 4096)).exitCode, 0);
  }
});
function project(directory: string, build = script) {
  writeFileSync(join(directory, "package.json"), JSON.stringify({ name: "frontend-output-fixture", version: "1.0.0", engines: { node: "20.x" }, scripts: { build: "node build.cjs" } }));
  writeFileSync(join(directory, "package-lock.json"), JSON.stringify({ name: "frontend-output-fixture", version: "1.0.0", lockfileVersion: 3, packages: { "": { name: "frontend-output-fixture", version: "1.0.0" } } }));
  writeFileSync(join(directory, "build.cjs"), build);
}
async function gone(id: string) {
  assert.match(id, /^[a-f0-9]{64}$/);
  const result = await docker(["inspect", "--type", "container", id], AbortSignal.timeout(5000), 4096);
  assert.equal(result.exitCode, 1, "The exact worker must be removed before durable output is read");
  assert.match(result.output, /No such (?:object|container)/i);
}

test("frontend build exports exact tmpfs bytes, removes its worker and reloads a durable source/plan-bound artifact", async () => {
  const f = await agentFixture();
  try {
    project(f.project);
    const cache = join(f.directory, "cache"); mkdirSync(cache); writeFileSync(join(cache, "manifest.json"), "[]");
    const result = await runContainerBuild(f.project, cache, plan, AbortSignal.timeout(120000));
    assert.equal(result.exitCode, 0, result.output); assert.ok(result.buildOutput);
    await gone(result.containerId);
    const binding = { sourceHash: "a".repeat(64), planHash: fingerprint(plan) };
    const receipt = await persistBuildOutput(f.config.stateDir, result.buildOutput, binding);
    const output = await readBuildOutput(f.config.stateDir, JSON.parse(JSON.stringify(receipt)), binding);
    assert.deepEqual(output.files.find(file => file.path === "picture.png")?.content, binary);
    assert.equal(output.files.find(file => file.path === "app.js")?.content.toString(), javascript);
    assert.equal(output.files.find(file => file.path === "index.html")?.content.toString(), html);
    assert.equal(existsSync(join(f.project, "build")), false, "Original source stays read-only");
  } finally { f.close(); }
});

test("failed frontend asset verification cannot produce an export and still removes its exact worker", async () => {
  const f = await agentFixture(); let created: string | undefined;
  try {
    project(f.project, `${script}require('node:fs').unlinkSync('build/app.js');`);
    const cache = join(f.directory, "cache"); mkdirSync(cache); writeFileSync(join(cache, "manifest.json"), "[]");
    const result = await runContainerBuild(f.project, cache, plan, AbortSignal.timeout(120000), id => { created = id; });
    assert.equal(result.exitCode, 73, result.output); assert.equal(result.buildOutput, undefined);
    assert.ok(created); await gone(created);
  } finally { f.close(); }
});

test("frontend export rejects a private environment value compiled into bytes, while an explicit public value is retained", async () => {
  const f = await agentFixture();
  try {
    const cache = join(f.directory, "cache"); mkdirSync(cache); writeFileSync(join(cache, "manifest.json"), "[]");
    for (const key of ["SERVICE_ACCESS", "VITE_PUBLIC_TITLE"]) {
      const value = "fixture-frontend-compiled-value", environment = { actionId: randomUUID(), fingerprint: "b".repeat(64), keys: [key] };
      project(f.project, `${script}require('node:fs').writeFileSync('build/value.txt',process.env.${key});`);
      const bound = parseProjectBuildPlan({ ...plan, environment }); let created: string | undefined;
      const run = runContainerBuild(f.project, cache, bound, AbortSignal.timeout(120000), id => { created = id; }, [{ key, value }]);
      if (key === "SERVICE_ACCESS") await assert.rejects(run, (error: unknown) => error instanceof Error && "code" in error && error.code === "BUILD_OUTPUT_SENSITIVE" && !error.message.includes(value));
      else {
        const result = await run; assert.equal(result.exitCode, 0, result.output);
        assert.equal(result.buildOutput?.files.find(file => file.path === "value.txt")?.content.toString(), value);
      }
      assert.ok(created); await gone(created);
    }
  } finally { f.close(); }
});

// Dependency/model transports below are fixtures; npm, runtime, build, HTTP, export and persistence are real.
async function dependency(name: string) {
  const archive = pack(), chunks: Buffer[] = [];
  const reading = (async () => { for await (const chunk of archive) { assert.ok(chunk instanceof Uint8Array); chunks.push(Buffer.from(chunk)); } })();
  archive.entry({ name: "package/package.json", mode: 0o644, mtime: new Date(0) }, JSON.stringify({ name, version: "0.0.0-launchlane-fixture" }));
  archive.finalize(); await reading;
  return gzipSync(Buffer.concat(chunks));
}
test("a real approved validation job persists its output receipt across service reconstruction without model calls", async () => {
  const f = await agentFixture();
  try {
    project(f.project);
    const tarballs = new Map<string, Buffer>(), packages: Record<string, unknown> = {}, dependencies: Record<string, string> = {};
    for (const name of ["react", "vite"]) {
      const bytes = await dependency(name), version = "0.0.0-launchlane-fixture", url = `https://registry.npmjs.org/${name}/-/${name}-${version}.tgz`;
      tarballs.set(url, bytes); dependencies[name] = version;
      packages[`node_modules/${name}`] = { version, resolved: url, integrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}` };
    }
    writeFileSync(join(f.project, "package.json"), JSON.stringify({ name: "frontend-output-fixture", version: "1.0.0", engines: { node: "20.x" }, dependencies, scripts: { build: "node build.cjs" } }));
    writeFileSync(join(f.project, "package-lock.json"), JSON.stringify({ name: "frontend-output-fixture", version: "1.0.0", lockfileVersion: 3,
      packages: { "": { name: "frontend-output-fixture", version: "1.0.0", dependencies }, ...packages } }));
    const flow = await prepareProjectFlow(f.config, f.store, f.session.actorId, { kind: "local", directory: "service" }, AbortSignal.timeout(5000));
    assert.deepEqual(flow.profile.frontendRuntime, frontend);
    const config = { ...f.config, enableLocalRepair: true }, adapter = new CodeRepairAdapter(config, f.store,
      { complete: async () => { assert.fail("Validation must not call a model"); } }, async item => {
      const bytes = tarballs.get(item.url); assert.ok(bytes); return bytes;
    }), signal = AbortSignal.timeout(120000);
    const proposed = await adapter.propose(f.session.actorId, { projectId: flow.id, expectedSourceHash: flow.profile.sourceHash,
      goal: "Verify and retain the actual frontend output", build: plan, allowedPaths: [], testFiles: [], execution: "container", validationOnly: true }, signal);
    adapter.approve(f.session.actorId, proposed.id);
    const job = await adapter.run(f.session.actorId, proposed.id, signal);
    assert.equal(job.state, "succeeded", JSON.stringify(job)); assert.ok(job.artifact); assert.ok(job.afterTest?.buildOutput);
    const recovered = new CodeRepairAdapter(config, f.store).status(f.session.actorId, job.id);
    assert.deepEqual(recovered.afterTest?.buildOutput, job.afterTest.buildOutput);
    const output = await readBuildOutput(f.config.stateDir, job.afterTest.buildOutput, { sourceHash: job.artifact.sourceHash, planHash: fingerprint(plan) });
    assert.deepEqual(output.files.find(file => file.path === "picture.png")?.content, binary);
    assert.equal(existsSync(join(f.project, "build")), false);
    assert.deepEqual(job.changedPaths, []);
  } finally { f.close(); }
});
