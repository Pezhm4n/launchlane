import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { angularFixtureFiles, assertAngularWorkload } from "../helpers/angular-fixture.ts";
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
import { createAgentRun, driveAgentRun } from "../../src/server/agent/runs.ts";
import { AgentRepository } from "../../src/server/agent/store.ts";
import { GoalModelClient } from "../../src/server/agent/model.ts";
import { executeAgentTool } from "../../src/server/agent/tools.ts";
import { LiaraReadClient } from "../../src/server/liara/client.ts";
import { sealCredential } from "../../src/server/connections/credentials.ts";
import { randomUUID } from "node:crypto";
import { RunBudget } from "../../src/server/policy/budget.ts";
import { pnpmRegistryMetadata } from "../../src/server/agent/pnpm-source.ts";

// Reuse only public immutable response bytes within this suite. Each job still
// validates every locked version/integrity/time and charges its original budget.
const metadata = new Map<string, Buffer>(); let metadataBytes = 0;
const cachedMetadata: typeof pnpmRegistryMetadata = async (name, signal, remaining, onBytes) => {
  const cached = metadata.get(name); if (cached) return cached;
  const bytes = await pnpmRegistryMetadata(name, signal, remaining, onBytes); metadataBytes += bytes.length;
  assert.ok(metadataBytes <= 64 * 1024 * 1024); metadata.set(name, bytes); return bytes;
};

for (const scenario of ["compiled", "source-test-failure", "compiler-failure"]) test(`actual Angular AOT component: ${scenario}`, async () => {
  const f = await agentFixture(); try {
    const files = angularFixtureFiles().map(file => scenario === "source-test-failure" && file.path === "apps/web/src/invoice.mjs" ? { ...file, content: Buffer.from(file.content.toString().replace("line.price * line.quantity", "line.price")) } : scenario === "compiler-failure" && file.path === "apps/web/src/main.ts" ? { ...file, content: Buffer.from(file.content.toString().replace("state.total()", "state.missingValue()")) } : file); writePnpmFixture(f.project, files);
    const signal = AbortSignal.timeout(300000), flow = await prepareProjectFlow(f.config, f.store, f.session.actorId, { kind: "local", directory: "service" }, signal), workspace = flow.profile.pnpmWorkspace; assert.ok(workspace);
    assert.equal(workspace.packages.find(pkg => pkg.root === "apps/web")?.name, "@compiled/angular-web");
    const component = sourcePnpmComponent(files, workspace, "apps/web"), build = parseProjectBuildPlan({ ...nodeBuildRuntime(workspace.nodeVersion), version: 9, sourceHash: flow.profile.sourceHash, workspace, component, apiChecks: [],
      buildCommand: "pnpm -r build", testCommand: component.testCommand, startCommand: "launchlane-component-static", port: 8080, workload: { path: "/", status: 200, assertion: { kind: "text", contains: "<title>Compiled Angular workspace</title>" } } });
    assert.equal(component.outputDirectory, "dist/staging/client");
    const adapter = new CodeRepairAdapter({ ...f.config, enableLocalRepair: true }, f.store, undefined, (item, parent) => item.url.includes("/pnpm/-/") && process.env.LAUNCHLANE_TEST_PNPM_TARBALL ? Promise.resolve(readFileSync(process.env.LAUNCHLANE_TEST_PNPM_TARBALL)) : registryTarball(item, parent), {}, cachedMetadata);
    const proposed = await adapter.propose(f.session.actorId, { projectId: flow.id, expectedSourceHash: flow.profile.sourceHash, goal: "Check actual static compiler and exact output", allowedPaths: [], testFiles: [], execution: "container", validationOnly: true, build }, signal);
    adapter.approve(f.session.actorId, proposed.id); const budget = new RunBudget({ maxToolCalls: f.config.agentMaxToolCalls, maxModelCalls: f.config.agentMaxModelCalls, runTimeoutMs: f.config.agentTimeoutMs });
    const job = await adapter.run(f.session.actorId, proposed.id, signal, budget);
    if (scenario !== "compiled") { assert.equal(job.state, "failed", JSON.stringify(job)); assert.equal(job.artifact, null); assert.equal(job.afterTest?.exitCode, scenario === "compiler-failure" ? 72 : 76, JSON.stringify({code:job.errorCode,message:job.message})); for (const file of files) assert.deepEqual(readFileSync(join(f.project, file.path)), file.content); return; }
    assert.equal(job.state, "succeeded", JSON.stringify({ code: job.errorCode, message: job.message, test: job.afterTest })); assert.ok(job.artifact && job.publication);
    assert.match(job.afterTest?.output ?? "", /ng build portal --configuration=staging/); assert.match(job.afterTest?.output ?? "", /Angular AOT emits nonempty hashed browser modules/);
    const selected = await prepareProjectFlow(f.config, f.store, f.session.actorId, { kind: "repair", directory: ".", jobId: job.id, artifactHash: job.artifact.archiveHash }, signal);
    const verification = await componentVerification(f.store, f.config.stateDir, f.session.actorId, selected, f.config.sessionSecret), target = await componentTarget(await readArtifact(f.config.stateDir, job.artifact));
    try {
      const app = "angular-component", team = "a".repeat(24), appId = "b".repeat(24), origin = `https://${app}.example.com`, config = { ...f.config, apps: [app], teamId: team, liaraToken: "synthetic-angular-provider", enableMutations: true, enableLiveLiara: true, probeOrigins: { [app]: origin } };
      f.store.saveConnection(f.session.actorId, { source: "token", ciphertext: sealCredential(config.liaraToken, config.sessionSecret, f.session.actorId, "liara"), view: { provider: "liara", status: "connected", identityId: "fixture-account", displayName: "Fixture", login: "fixture@example.test", teamId: team, teamName: "Fixture", selectedApp: app, apps: [{ id: appId, name: app, platform: "docker" }], checkedAt: Date.now() } });
      const read = new LiaraReadClient(config, async () => Response.json({ project: { _id: appId, project_id: app, type: "docker", status: "Running", envs: [], planID: "fixture-plan" } }));
      const model = new GoalModelClient(config, async () => Response.json({ choices: [{ finish_reason: "tool_calls", message: { role: "assistant", tool_calls: [{ id: randomUUID(), type: "function", function: { name: "propose_publication", arguments: JSON.stringify(build.workload) } }] } }], usage: { total_tokens: 10 } }));
      const run = createAgentRun(config, f.store, f.session, randomUUID(), "انتشار همان خروجی Angular", selected.id).run;
      await driveAgentRun(config, f.store, f.session, run.id, { model, tool: (name, args, context) => executeAgentTool(name, args, { ...context, read }) });
      const pending = new AgentRepository(f.store).get(f.session.actorId, run.id);
      assert.equal(pending?.publication?.spec.version, 40); assert.equal(pending?.publication?.state, "awaiting_approval");
      assert.equal(pending?.publication?.spec.artifactHash, job.artifact.archiveHash);
      assert.equal(await (await fetch(`${target.origin}/launchlane-build-proof.json`)).text(), compiledProof(job.publication));
      const assets = await componentAssets(f.store, f.config.stateDir, f.session.actorId, verification, target.origin); assert.ok(assets.length > 0);
      const browser = await chromium.launch({ headless: true }); try {
        const page = await browser.newPage(); await assertAngularWorkload(page, target.origin);
      } finally { await browser.close(); }
    } finally { await target.close(); }
    console.log(JSON.stringify({ toolCalls: budget.toolCalls, testedSourceHash: job.baseRevision, artifactHash: job.artifact.archiveHash, output: job.afterTest?.buildOutput, image: build.image, compiler: "Angular22.2.4/CLI22.2.5/TypeScript6.0.3", scenario, browser: "Chromium", originalTests: true }));
    for (const file of files) assert.deepEqual(readFileSync(join(f.project, file.path)), file.content);
  } finally { f.close(); }
});
