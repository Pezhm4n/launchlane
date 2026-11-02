import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { writePnpmFixture } from "../helpers/pnpm-fixture.ts";
import { componentTarget } from "../helpers/component-target.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import { nodeBuildRuntime, parseProjectBuildPlan } from "../../src/contracts/project-build.ts";
import { sourcePnpmComponent } from "../../src/server/agent/pnpm-component.ts";
import { CodeRepairAdapter } from "../../src/server/agent/code-repair.ts";
import { registryTarball } from "../../src/server/agent/npm-source.ts";
import { readArtifact } from "../../src/server/workspace/archive.ts";
import { componentAssets, componentVerification } from "../../src/server/application/component-verification.ts";
import { compiledProof } from "../../src/server/agent/fullstack-artifact.ts";

test("actual pinned Vite/React workspace compiles, preserves original tests and serves the exact artifact in a fresh Docker/browser", async () => {
  const f = await agentFixture(); try {
    const paths = ["package.json", "pnpm-workspace.yaml", "pnpm-lock.yaml", "apps/web/package.json", "apps/web/index.html", "apps/web/dist.test.mjs", "apps/web/src/main.js"];
    const files = paths.map(path => ({ path, content: readFileSync(join("tests/fixtures/pnpm-vite-component", path)) })); writePnpmFixture(f.project, files);
    const signal = AbortSignal.timeout(300000), flow = await prepareProjectFlow(f.config, f.store, f.session.actorId, { kind: "local", directory: "service" }, signal), workspace = flow.profile.pnpmWorkspace; assert.ok(workspace);
    const component = sourcePnpmComponent(files, workspace, "apps/web"), build = parseProjectBuildPlan({ ...nodeBuildRuntime(workspace.nodeVersion), version: 9, sourceHash: flow.profile.sourceHash, workspace, component, apiChecks: [],
      buildCommand: "pnpm -r build", testCommand: component.testCommand, startCommand: "launchlane-component-static", port: 8080, workload: { path: "/", status: 200, assertion: { kind: "text", contains: "<title>Compiled Vite workspace</title>" } } });
    const adapter = new CodeRepairAdapter({ ...f.config, enableLocalRepair: true, maxToolCalls: 160 }, f.store, undefined, (item, parent) => item.url.includes("/pnpm/-/") && process.env.LAUNCHLANE_TEST_PNPM_TARBALL ? Promise.resolve(readFileSync(process.env.LAUNCHLANE_TEST_PNPM_TARBALL)) : registryTarball(item, parent));
    const proposed = await adapter.propose(f.session.actorId, { projectId: flow.id, expectedSourceHash: flow.profile.sourceHash, goal: "Check actual static compiler and exact output", allowedPaths: [], testFiles: [], execution: "container", validationOnly: true, build }, signal);
    adapter.approve(f.session.actorId, proposed.id); const job = await adapter.run(f.session.actorId, proposed.id, signal);
    assert.equal(job.state, "succeeded", JSON.stringify({ code: job.errorCode, message: job.message, test: job.afterTest })); assert.ok(job.artifact && job.publication);
    assert.match(job.afterTest?.output ?? "", /vite v8\.3\.1/); assert.match(job.afterTest?.output ?? "", /built document references a nonempty transformed browser module/);
    const selected = await prepareProjectFlow(f.config, f.store, f.session.actorId, { kind: "repair", directory: ".", jobId: job.id, artifactHash: job.artifact.archiveHash }, signal);
    const verification = await componentVerification(f.store, f.config.stateDir, f.session.actorId, selected, f.config.sessionSecret), target = await componentTarget(await readArtifact(f.config.stateDir, job.artifact));
    try {
      assert.equal(await (await fetch(`${target.origin}/launchlane-build-proof.json`)).text(), compiledProof(job.publication));
      const assets = await componentAssets(f.store, f.config.stateDir, f.session.actorId, verification, target.origin); assert.ok(assets.length > 0);
      const browser = await chromium.launch({ headless: true }); try {
        const page = await browser.newPage(); await page.goto(target.origin); await page.getByText("Vite component total: 73", { exact: true }).waitFor();
        await page.getByRole("button", { name: "Open orders", exact: true }).click(); await page.waitForURL(`${target.origin}/orders`); await page.getByText("Orders total: 73", { exact: true }).waitFor();
        await page.reload(); await page.getByText("Vite component total: 73", { exact: true }).waitFor();
      } finally { await browser.close(); }
    } finally { await target.close(); }
    console.log(JSON.stringify({ testedSourceHash: job.baseRevision, artifactHash: job.artifact.archiveHash, output: job.afterTest?.buildOutput, image: build.image, compiler: "vite8.3.1", browser: "Chromium", originalTests: true }));
    for (const file of files) assert.deepEqual(readFileSync(join(f.project, file.path)), file.content);
  } finally { f.close(); }
});
