import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseProjectBuildPlan, nodeBuildRuntime } from "../../src/contracts/project-build.ts";
import { runContainerBuild } from "../../src/server/agent/container.ts";

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
