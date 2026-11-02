import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pnpmFixtureFiles, writePnpmFixture } from "../helpers/pnpm-fixture.ts";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import { nodeBuildRuntime, parseProjectBuildPlan } from "../../src/contracts/project-build.ts";
import { sourcePnpmComponent } from "../../src/server/agent/pnpm-component.ts";
import { CodeRepairAdapter } from "../../src/server/agent/code-repair.ts";
import { registryTarball } from "../../src/server/agent/npm-source.ts";
import { readComponentOutput } from "../../src/server/agent/build-output-store.ts";
import { componentVerification } from "../../src/server/application/component-verification.ts";
import { fingerprint } from "../../src/server/policy/action.ts";
import { readArtifact } from "../../src/server/workspace/archive.ts";
import { componentTarget } from "../helpers/component-target.ts";
import { compiledProof } from "../../src/server/agent/fullstack-artifact.ts";

for (const scenario of ["compiled", "production-dependency", "node22", "original-test-failure", "missing-entry", "wrong-api", "skipped-test", "build-changes-oracle", "build-tree-escape", "background-counterfeit"]) test(`actual compiled pnpm component: ${scenario}`, async () => {
  const f = await agentFixture(); try {
    const fixture = await pnpmFixtureFiles();
    fixture.files = fixture.files.map(file => {
      if (scenario === "background-counterfeit" && file.path === "apps/api/api.test.cjs") return { ...file, content: Buffer.concat([file.content, Buffer.from("const child=require('node:child_process').spawn(process.execPath,['-e',\"require('node:http').createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify({total:73}))}).listen(3000,'0.0.0.0')\"],{detached:true,stdio:'ignore'});child.unref();\n")]) };
      if (scenario === "node22" && file.path === "package.json") { const pkg = JSON.parse(file.content.toString()); pkg.engines.node = "22.x"; return { ...file, content: Buffer.from(JSON.stringify(pkg)) }; }
      if (scenario === "production-dependency" && file.path === "package.json") { const pkg = JSON.parse(file.content.toString()); pkg.dependencies = pkg.devDependencies; delete pkg.devDependencies; return { ...file, content: Buffer.from(JSON.stringify(pkg)) }; }
      if (scenario === "production-dependency" && file.path === "pnpm-lock.yaml") return { ...file, content: Buffer.from(file.content.toString().replace("devDependencies:", "dependencies:")) };
      if (file.path === "apps/api/package.json") { const pkg = JSON.parse(file.content.toString()); pkg.scripts.start = "node dist/server.cjs"; return { ...file, content: Buffer.from(JSON.stringify(pkg)) }; }
      if (scenario === "build-changes-oracle" && file.path === "packages/shared/build.cjs") return { ...file, content: Buffer.concat([file.content, Buffer.from("require('node:fs').writeFileSync('value.test.cjs','// changed oracle');\n")]) };
      if (file.path === "apps/api/build.cjs" && scenario !== "missing-entry") return { ...file, content: Buffer.concat([file.content, Buffer.from("require('node:fs').copyFileSync('server.cjs','dist/server.cjs');\n")]) };
      if (scenario === "background-counterfeit" && file.path === "apps/api/server.cjs") return { ...file, content: Buffer.from("throw Error('production start is broken');\n") };
      if (scenario === "build-tree-escape" && file.path === "apps/api/server.cjs") return { ...file, content: Buffer.from(file.content.toString().replace("require('./dist/value.cjs')", "require('/work/project/apps/api/dist/value.cjs')")) };
      if (file.path === "apps/api/server.cjs") return { ...file, content: Buffer.from(file.content.toString().replace("require('./dist/value.cjs')", scenario === "production-dependency" ? "require('launchlane-fixture-value')" : "require('./value.cjs')")) };
      if (file.path === "apps/api/api.test.cjs" && scenario === "original-test-failure") return { ...file, content: Buffer.from(file.content.toString().replace(",73)", ",74)")) };
      if (file.path === "apps/api/api.test.cjs" && scenario === "skipped-test") return { ...file, content: Buffer.from(file.content.toString().replace("test('", "test.skip('")) };
      return file;
    });
    writePnpmFixture(f.project, fixture.files);
    const signal = AbortSignal.timeout(180000), flow = await prepareProjectFlow(f.config, f.store, f.session.actorId, { kind: "local", directory: "service" }, signal), workspace = flow.profile.pnpmWorkspace; assert.ok(workspace);
    const component = sourcePnpmComponent(fixture.files, workspace, "apps/api"), build = parseProjectBuildPlan({ ...nodeBuildRuntime(workspace.nodeVersion), version: 9, sourceHash: flow.profile.sourceHash, workspace, component,
      buildCommand: "pnpm -r build", testCommand: component.testCommand, startCommand: "node dist/server.cjs", port: 8080,
      workload: { path: "/", status: 200, assertion: { kind: "json", field: "total", equals: 73 } },
      apiChecks: [{ path: "/api/value", status: 200, assertions: [{ pointer: ["total"], equals: scenario === "wrong-api" ? 74 : 73 }] }] });
    const integrity = `sha512-${createHash("sha512").update(fixture.dependency).digest("base64")}`;
    const adapter = new CodeRepairAdapter({ ...f.config, enableLocalRepair: true }, f.store, undefined, async (item, parent) => item.url.includes("/launchlane-fixture-value/") ? fixture.dependency : process.env.LAUNCHLANE_TEST_PNPM_TARBALL ? readFileSync(process.env.LAUNCHLANE_TEST_PNPM_TARBALL) : registryTarball(item, parent), {}, async name => {
      assert.equal(name, "launchlane-fixture-value"); return Buffer.from(JSON.stringify({ name, time: { "1.0.0": "2020-01-01T00:00:00.000Z" }, versions: { "1.0.0": { name, version: "1.0.0", dist: { tarball: "https://registry.npmjs.org/launchlane-fixture-value/-/launchlane-fixture-value-1.0.0.tgz", integrity } } } }));
    });
    const proposed = await adapter.propose(f.session.actorId, { projectId: flow.id, expectedSourceHash: flow.profile.sourceHash, goal: "Check compiled component", allowedPaths: [], testFiles: [], execution: "container", validationOnly: true, build }, signal);
    adapter.approve(f.session.actorId, proposed.id); const job = await adapter.run(f.session.actorId, proposed.id, signal);
    if (!["compiled", "production-dependency", "node22"].includes(scenario)) {
      assert.equal(job.state, "failed", JSON.stringify(job.afterTest)); assert.equal(job.artifact, null); assert.equal(job.errorCode, "BUILD_CHECK_FAILED"); assert.equal(job.afterTest?.exitCode, scenario === "build-changes-oracle" ? 72 : ["original-test-failure", "skipped-test"].includes(scenario) ? 76 : 73); if(scenario === "background-counterfeit")assert.match(job.afterTest?.output ?? "", /unexpected background process/); return;
    }
    assert.equal(job.state, "succeeded", JSON.stringify({ code: job.errorCode, message: job.message, receipt: job.afterTest })); assert.ok(job.artifact && job.publication && job.afterTest?.buildOutput);
    const output = await readComponentOutput(f.config.stateDir, job.afterTest.buildOutput, { sourceHash: flow.profile.sourceHash, planHash: fingerprint(build) });
    assert.ok(output.entries.some(file => file.path === "apps/api/dist/server.cjs")); assert.ok(output.entries.some(file => file.type === "symlink" && file.path === "apps/api/node_modules/@fixture/shared"));
    assert.equal(output.entries.some(file => file.path.includes("launchlane-fixture-value")), scenario === "production-dependency", "only declared production dependencies enter runtime");
    const selected = await prepareProjectFlow(f.config, f.store, f.session.actorId, { kind: "repair", directory: ".", jobId: job.id, artifactHash: job.artifact.archiveHash }, signal);
    assert.equal(selected.profile.runtime, "docker"); assert.equal(selected.profile.pnpmWorkspace, undefined); assert.equal(selected.artifact?.archiveHash, job.artifact.archiveHash);
    assert.deepEqual(await componentVerification(f.store, f.config.stateDir, f.session.actorId, selected, f.config.sessionSecret), selected.profile.pnpmComponent);
    const target = await componentTarget(await readArtifact(f.config.stateDir, f.store.getArtifact(f.session.actorId, job.artifact.archiveHash)));
    try {
      assert.equal(await (await fetch(`${target.origin}/launchlane-build-proof.json`)).text(), compiledProof(job.publication));
      let response: Response | undefined;
      for (let i = 0; i < 40; i++) { response = await fetch(`${target.origin}/api/value`); if (response.status === 200) break; await new Promise(resolve => setTimeout(resolve, 100)); }
      assert.equal(response?.status, 200); assert.deepEqual(await response?.json(), { total: 73 });
    } finally { await target.close(); }
    console.log(JSON.stringify({ scenario, testedSourceHash: job.baseRevision, planHash: fingerprint(build), artifactHash: job.artifact.archiveHash, output: job.afterTest.buildOutput, image: build.image }));
    for (const file of fixture.files) assert.deepEqual(readFileSync(join(f.project, file.path)), file.content);
  } finally { f.close(); }
});
