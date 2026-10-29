import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pnpmFixtureFiles, writePnpmFixture } from "../helpers/pnpm-fixture.ts";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import { nodeBuildRuntime, parseProjectBuildPlan } from "../../src/contracts/project-build.ts";
import { CodeRepairAdapter } from "../../src/server/agent/code-repair.ts";
import { registryTarball } from "../../src/server/agent/npm-source.ts";
import { createHash } from "node:crypto";

for (const scenario of ["compile", "runtime", "original-test-failure", "wrong-workload", "fresh-dependency", "skipped-test", "build-changes-oracle"]) test(`actual pinned pnpm workspace: ${scenario}`, async () => {
  const f = await agentFixture(); try {
    const runtime = scenario !== "compile" && scenario !== "fresh-dependency", fixture = await pnpmFixtureFiles(runtime);
    if (scenario === "original-test-failure") fixture.files = fixture.files.map(file => file.path === "packages/shared/value.test.cjs" ? { ...file, content: Buffer.from(file.content.toString().replace(",73)", ",74)")) } : file);
    if (scenario === "skipped-test") fixture.files = fixture.files.map(file => file.path === "packages/shared/value.test.cjs" ? { ...file, content: Buffer.from(file.content.toString().replace("test('", "test.skip('")) } : file);
    if (scenario === "build-changes-oracle") fixture.files = fixture.files.map(file => file.path === "packages/shared/build.cjs" ? { ...file, content: Buffer.concat([file.content, Buffer.from("require('node:fs').writeFileSync('value.test.cjs','// replaced oracle');\n")]) } : file);
    writePnpmFixture(f.project, fixture.files);
    const signal = AbortSignal.timeout(180000), flow = await prepareProjectFlow(f.config, f.store, f.session.actorId, { kind: "local", directory: "service" }, signal), workspace = flow.profile.pnpmWorkspace; assert.ok(workspace);
    const build = parseProjectBuildPlan({ ...nodeBuildRuntime(workspace.nodeVersion), version: 8, workspace, phase: runtime ? "runtime" : "compile",
      buildCommand: "pnpm -r build", testCommand: runtime ? "pnpm -r test" : null, startCommand: runtime ? "pnpm --filter @fixture/api start" : "pnpm-workspace-compile", port: 3000,
      workload: { path: "/", status: 200, assertion: { kind: "json", field: "total", equals: scenario === "wrong-workload" ? 74 : 73 } } });
    const integrity = `sha512-${createHash("sha512").update(fixture.dependency).digest("base64")}`;
    const adapter = new CodeRepairAdapter({ ...f.config, enableLocalRepair: true }, f.store, undefined, async (item, parent) => item.url.includes("/launchlane-fixture-value/") ? fixture.dependency : process.env.LAUNCHLANE_TEST_PNPM_TARBALL ? readFileSync(process.env.LAUNCHLANE_TEST_PNPM_TARBALL) : registryTarball(item, parent), {}, async name => {
      assert.equal(name, "launchlane-fixture-value"); return Buffer.from(JSON.stringify({ name, time: { "1.0.0": scenario === "fresh-dependency" ? new Date(Date.now() - 60000).toISOString() : "2020-01-01T00:00:00.000Z" }, versions: { "1.0.0": { name, version: "1.0.0", dist: { tarball: "https://registry.npmjs.org/launchlane-fixture-value/-/launchlane-fixture-value-1.0.0.tgz", integrity } } } }));
    });
    const proposed = await adapter.propose(f.session.actorId, { projectId: flow.id, expectedSourceHash: flow.profile.sourceHash, goal: "Check original pnpm workspace", allowedPaths: [], testFiles: [], execution: "container", validationOnly: true, build }, signal);
    adapter.approve(f.session.actorId, proposed.id); const job = await adapter.run(f.session.actorId, proposed.id, signal);
    if (!["compile", "runtime"].includes(scenario)) {
      assert.equal(job.state, "failed", JSON.stringify(job.afterTest)); assert.equal(job.artifact, null); assert.equal(job.errorCode, "BUILD_CHECK_FAILED");
      assert.equal(job.afterTest?.exitCode, scenario === "fresh-dependency" ? 71 : scenario === "wrong-workload" ? 73 : scenario === "build-changes-oracle" ? 72 : 76);
      if (scenario === "skipped-test") assert.match(job.afterTest?.output ?? "", /skipped or absent checks/);
      if (scenario === "fresh-dependency") assert.match(job.afterTest?.output ?? "", /supply-chain policy/);
      for (const file of fixture.files) assert.deepEqual(readFileSync(join(f.project, file.path)), file.content);
      return;
    }
    assert.equal(job.state, "succeeded", JSON.stringify({ code: job.errorCode, message: job.message, receipt: job.afterTest })); assert.ok(job.afterTest?.passed);
    assert.equal(!!job.artifact, runtime); assert.deepEqual(job.changedPaths, []);
    assert.match(job.afterTest.output, /frozen root lock and all workspace importers preserved/);
    if (runtime) assert.match(job.afterTest.output, /original workload response/); else assert.match(job.afterTest.output, /compile only/);
    for (const file of fixture.files) assert.deepEqual(readFileSync(join(f.project, file.path)), file.content);
  } finally { f.close(); }
});
