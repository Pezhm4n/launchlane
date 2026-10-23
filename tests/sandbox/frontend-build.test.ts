import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runInNewContext } from "node:vm";
import { parseProjectBuildPlan, nodeBuildRuntime } from "../../src/contracts/project-build.ts";
import { frontendAssetProgram, runContainerBuild } from "../../src/server/agent/container.ts";

test("the worker HTML parser finds script and stylesheet requirements independently of filename, HTML case or quoting", () => {
  const html = `<p>İ</p><BASE HREF='/assets/'><script SRC = "/missing.js"></script><script src=entry TYPE=module></script>
    <LINK REL="alternate STYLESHEET" HREF = app.css><link rel=modulepreload href=module-entry>
    <link REL=PRELOAD AS=script href="app&#46;js"><link rel=preload as=style href='/theme'>`;
  const result: unknown = runInNewContext(`${frontendAssetProgram};frontendAssets(html)`, { Buffer, html });
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { base: "/assets/", references: [
    { path: "/missing.js", kind: "script" }, { path: "entry", kind: "script" }, { path: "app.css", kind: "style" },
    { path: "module-entry", kind: "script" }, { path: "app.js", kind: "script" }, { path: "/theme", kind: "style" },
  ] });
});

test("the worker HTML parser ignores commented markup, raw text, nonexecutable data and unrelated URL attributes", () => {
  const html = `<!-- <script src="/comment.js"></script><link rel=stylesheet href=/comment.css> -->
    <script>const markup='<link rel="stylesheet" href="/inline.css">';</script>
    <style>.example:after{content:'<script src="/style.js">'}</style><textarea><script src=/textarea.js></script></textarea>
    <a href="/download.js">download</a><img src="/image.css"><link rel=icon href="/icon.js">
    <link rel=preload as=font href="/font.js"><script type=application/json src=/data.js></script><script src=/actual.js></script>`;
  const result: unknown = runInNewContext(`${frontendAssetProgram};frontendAssets(html)`, { Buffer, html });
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { base: null, references: [{ path: "/actual.js", kind: "script" }] });
  assert.throws(() => runInNewContext(`${frontendAssetProgram};frontendAssets(html)`, { Buffer, html: "x".repeat(65537) }), /frontend document limit/);
  assert.throws(() => runInNewContext(`${frontendAssetProgram};frontendAssets(html)`, { Buffer, html: "<i></i>".repeat(2049) }), /frontend tag limit/);
  for (const comment of ["<!-->", "<!--->", "<!-- empty --!>"]) {
    const afterComment: unknown = runInNewContext(`${frontendAssetProgram};frontendAssets(html)`, { Buffer, html: `${comment}<script src=/actual.js></script>` });
    assert.deepEqual(JSON.parse(JSON.stringify(afterComment)), { base: null, references: [{ path: "/actual.js", kind: "script" }] });
  }
  assert.throws(() => runInNewContext(`${frontendAssetProgram};frontendAssets(html)`, { Buffer, html: '<!-- <script src="/missing.js">' }), /incomplete frontend comment/);
});

test("the worker asset MIME check binds JavaScript and stylesheet responses to their actual HTML resource kind", () => {
  for (const [kind, mime, expected] of [
    ["script", "application/javascript", true], ["script", "Text/JavaScript; charset=utf-8", true],
    ["style", "text/css; charset=utf-8", true], ["script", "text/css", false], ["style", "application/javascript", false],
    ["script", "text/html", false], ["style", "text/html", false], ["script", "text/javascript-fake", false], ["script", null, false],
  ] as const) {
    assert.equal(runInNewContext(`${frontendAssetProgram};frontendAssetMime(kind,mime)`, { kind, mime }), expected, `${kind}: ${mime}`);
  }
});

async function checkFrontend(html: string, files: Readonly<Record<string, string>> = {}) {
  const directory = await mkdtemp(join(tmpdir(), "launchlane-frontend-assets-")), source = join(directory, "source"), cache = join(directory, "cache");
  try {
    await mkdir(source); await mkdir(cache); await writeFile(join(cache, "manifest.json"), "[]");
    const pkg = { name: "frontend-assets-control", version: "1.0.0", scripts: { build: "node build.cjs" } };
    await writeFile(join(source, "package.json"), JSON.stringify(pkg));
    await writeFile(join(source, "package-lock.json"), JSON.stringify({ name: pkg.name, version: pkg.version, lockfileVersion: 3, packages: { "": { name: pkg.name, version: pkg.version } } }));
    await writeFile(join(source, "build.cjs"), `const fs=require('node:fs');fs.mkdirSync('dist');for(const [path,content] of Object.entries(${JSON.stringify({ "index.html": `<html><head><title>Notes</title>${html}</head><body>Notes</body></html>`, ...files })}))fs.writeFileSync('dist/'+path,content);`);
    const plan = parseProjectBuildPlan({ ...nodeBuildRuntime("20"), version: 5, frontend: { kind: "vue", builder: "vite", nodeVersion: "20", outputDirectory: "dist", mirror: false },
      buildCommand: pkg.scripts.build, testCommand: null, startCommand: "liara-frontend", port: 80, workload: { path: "/", status: 200, assertion: { kind: "text", contains: "<title>Notes</title>" } } });
    return await runContainerBuild(source, cache, plan, AbortSignal.timeout(120000));
  } finally { await rm(directory, { recursive: true, force: true }); }
}

test("uppercase and spaced script attributes cannot hide a missing build asset", async () => {
  const broken = await checkFrontend('<script SRC = "/missing.js"></script>');
  assert.equal(broken.exitCode, 73, broken.output);
  assert.match(broken.output, /built asset missing or invalid/);
});

test("unquoted and extensionless assets, module preloads and resource-specific MIME stay part of the original frontend oracle", async () => {
  for (const html of [
    "<script src=/missing.js></script>", "<script src=/missing-entry></script>", "<script src=/app.css></script>",
    "<LINK REL = stylesheet HREF = /app.js>", "<link rel=modulepreload href=/missing-module>",
    "<link rel=preload as=script href=/missing-preload>", "<link rel=preload as=style href=/missing-style>",
  ]) {
    const broken = await checkFrontend(html, { "app.js": "document.body.dataset.app='ready'", "app.css": "body{color:blue}" });
    assert.equal(broken.exitCode, 73, `${html}\n${broken.output}`);
    assert.match(broken.output, /built asset missing or invalid/);
  }
  const passed = await checkFrontend(`<!-- <script src="/missing-comment.js"></script> --><a href="/download.js">Download</a>
    <script>const markup='<link href="/missing-inline.css" rel="stylesheet">';</script>
    <script SRC=/app.js TYPE=module></script><LINK REL = STYLESHEET HREF = '/app.css'>
    <link rel=modulepreload href="/app&#46;js"><link rel=preload as=style href=/app.css>`,
    { "app.js": "document.body.dataset.app='ready'", "app.css": "body{color:blue}" });
  assert.equal(passed.exitCode, 0, passed.output); assert.equal(passed.signal, null);
});

test("the frontend runner serves the actual build output and rejects a missing JavaScript asset despite an unchanged HTTP200 document", async () => {
  const directory = await mkdtemp(join(tmpdir(), "launchlane-frontend-build-")), source = join(directory, "source"), cache = join(directory, "cache");
  try {
    await mkdir(source); await mkdir(cache); await writeFile(join(cache, "manifest.json"), "[]");
    const pkg = { name: "frontend-runner-control", version: "1.0.0", scripts: { build: "node build.cjs", start: "node forbidden-start.cjs" } };
    await writeFile(join(source, "package.json"), JSON.stringify(pkg));
    await writeFile(join(source, "package-lock.json"), JSON.stringify({ name: pkg.name, version: pkg.version, lockfileVersion: 3, packages: { "": { name: pkg.name, version: pkg.version } } }));
    await writeFile(join(source, "forbidden-start.cjs"), "throw Error('frontend must not run a dev/start server')");
    const build = "const fs=require('node:fs');if(process.versions.node!=='20.20.2')throw Error('wrong runtime');fs.mkdirSync('dist');fs.writeFileSync('dist/index.html','<html><head><title>Notes</title><link href=\"/app.css\" rel=\"stylesheet\"></head><body><script src=\"/app.js\"></script></body></html>');fs.writeFileSync('dist/app.css','body{color:blue}');";
    const plan = parseProjectBuildPlan({ ...nodeBuildRuntime("20"), version: 5, frontend: { kind: "vue", builder: "vite", nodeVersion: "20", outputDirectory: "dist", mirror: false },
      buildCommand: pkg.scripts.build, testCommand: null, startCommand: "liara-frontend", port: 80, workload: { path: "/", status: 200, assertion: { kind: "text", contains: "<title>Notes</title>" } } });
    await writeFile(join(source, "build.cjs"), build);
    const broken = await runContainerBuild(source, cache, plan, AbortSignal.timeout(120000));
    assert.equal(broken.exitCode, 73, broken.output); assert.match(broken.output, /built asset missing or invalid/);
    await writeFile(join(source, "build.cjs"), build + "fs.writeFileSync('dist/app.js','document.body.dataset.app=\"ready\"');");
    const passed = await runContainerBuild(source, cache, plan, AbortSignal.timeout(120000));
    assert.equal(passed.exitCode, 0, passed.output); assert.equal(passed.signal, null);
    assert.equal(await readFile(join(source, "package.json"), "utf8"), JSON.stringify(pkg));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
