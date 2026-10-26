import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { parseProjectBuildPlan, projectBuildImage } from "../../src/contracts/project-build.ts";
import { runContainerBuild } from "../../src/server/agent/container.ts";

async function checkFullstack(unhealthyApi: boolean, skippedTest = false) {
  const directory = await mkdtemp(join(tmpdir(), "launchlane-fullstack-actual-")), source = join(directory, "source"), cache = join(directory, "cache");
  try {
    await mkdir(join(source, "guides"), { recursive: true }); await mkdir(cache); await writeFile(join(cache, "manifest.json"), "[]");
    const buildCommand = "node build.cjs && npm --prefix guides ci --offline --no-audit --no-fund && npm --prefix guides run build";
    const pkg = { name: "controlled-fullstack", version: "1.0.0", scripts: { build: buildCommand, start: "node server.cjs", "test:unit": "node --test oracle.test.cjs" } };
    const lock = (name: string) => ({ name, version: "1.0.0", lockfileVersion: 3, packages: { "": { name, version: "1.0.0" } } });
    await writeFile(join(source, "package.json"), JSON.stringify(pkg)); await writeFile(join(source, "package-lock.json"), JSON.stringify(lock(pkg.name)));
    await writeFile(join(source, "guides/package.json"), JSON.stringify({ name: "guides", version: "1.0.0", engines: { node: ">=22.12" }, scripts: { build: "node build.cjs" } }));
    await writeFile(join(source, "guides/package-lock.json"), JSON.stringify(lock("guides")));
    await writeFile(join(source, "build.cjs"), "const fs=require('node:fs');if(process.env.RUNTIME_CREDENTIAL)throw Error('private runtime environment reached frontend build');fs.mkdirSync('build');fs.writeFileSync('build/index.html','<!doctype html><html>Full application<script src=\"/app.js\"></script><link rel=\"stylesheet\" href=\"/app.css\"></html>');fs.writeFileSync('build/app.js','console.log(\"actual compiled frontend\")');fs.writeFileSync('build/app.css','body{color:white}');");
    await writeFile(join(source, "guides/build.cjs"), "const fs=require('node:fs');fs.mkdirSync('../build/guides');fs.writeFileSync('../build/guides/index.html','<!doctype html><html>Guide output</html>');");
    await writeFile(join(source, "oracle.test.cjs"), "const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');test('unchanged oracle retains nested guide output',()=>assert.match(fs.readFileSync('build/guides/index.html','utf8'),/Guide output/));");
    if (skippedTest) await writeFile(join(source, "oracle.test.cjs"), "console.log('SKIP: disposable database is not configured.');process.exit(0);");
    await writeFile(join(source, "server.cjs"), "const http=require('node:http'),fs=require('node:fs');http.createServer((req,res)=>{if(req.url==='/health/db'){res.setHeader('content-type','application/json');return res.end(JSON.stringify({auth:{ok:!!process.env.RUNTIME_CREDENTIAL},profile:{ok:process.env.FAIL_API!=='1'}}))}const path={'/':'build/index.html','/app.js':'build/app.js','/app.css':'build/app.css'}[req.url];if(!path){res.statusCode=404;return res.end('missing')}res.setHeader('content-type',path.endsWith('.js')?'application/javascript':path.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(path))}).listen(Number(process.env.PORT),'0.0.0.0');");
    const plan = parseProjectBuildPlan({ version: 7, nodeVersion: "22", image: projectBuildImage,
      fullstack: { version: 2, entryFile: "server.cjs", backendScript: "server", startCommand: "node server.cjs", buildCommand, port: 8080, nodeVersion: "22", outputDirectory: "build", packageRoots: [".", "guides"], outputPolicy: "compiled-v1", testScripts: ["test:unit"] },
      apiChecks: [{ path: "/health/db", status: 200, assertions: [{ pointer: ["auth", "ok"], equals: true }, { pointer: ["profile", "ok"], equals: true }] }],
      buildCommand, testCommand: "npm run test:unit", startCommand: "node server.cjs", port: 8080,
      workload: { path: "/", status: 200, assertion: { kind: "text", contains: "Full application" } },
      environment: { actionId: "11111111-1111-4111-8111-111111111111", fingerprint: "1".repeat(64), keys: ["RUNTIME_CREDENTIAL", "FAIL_API"] } });
    const originalOracle = await readFile(join(source, "oracle.test.cjs"));
    const result = await runContainerBuild(source, cache, plan, AbortSignal.timeout(180000), undefined,
      [{ key: "RUNTIME_CREDENTIAL", value: "private-runtime-control-input" }, { key: "FAIL_API", value: unhealthyApi ? "1" : "0" }]);
    assert.ok((await readFile(join(source, "oracle.test.cjs"))).equals(originalOracle));
    return result;
  } finally { await rm(directory, { recursive: true, force: true }); }
}
test("actual fullstack sandbox installs both locks offline, keeps runtime credentials out of frontend build, runs unchanged tests and exports exact frontend bytes", { timeout: 180000 }, async () => {
  const result = await checkFullstack(false);
  assert.equal(result.exitCode, 0, result.output); assert.equal(result.signal, null); assert.ok(result.buildOutput);
  assert.ok(result.buildOutput.files.some(file => file.path === "guides/index.html"));
  assert.ok(result.buildOutput.files.some(file => file.path === "app.js" && file.content.includes("actual compiled frontend")));
});
test("actual fullstack sandbox rejects a healthy HTML frontend with an unhealthy independent API criterion", { timeout: 180000 }, async () => {
  const result = await checkFullstack(true); assert.equal(result.exitCode, 73, result.output); assert.equal(result.buildOutput, undefined);
});

test("actual fullstack sandbox refuses exit-zero skipped database tests before issuing an artifact", { timeout: 180000 }, async () => {
  const result = await checkFullstack(false, true); assert.equal(result.exitCode, 76, result.output); assert.equal(result.buildOutput, undefined);
});
