import assert from "node:assert/strict";
import { test } from "node:test";
import { parseFrameworkPythonRuntime } from "../../src/contracts/framework-python.ts";
import { parsePythonRuntime } from "../../src/contracts/python-runtime.ts";
import { parseProjectBuildPlan } from "../../src/contracts/project-build.ts";
import { frameworkFixture } from "../helpers/framework-fixture.ts";
import { assertFrameworkBuild } from "../../src/server/policy/framework-python.ts";
import { proposeWorkloadDeployment, executeDeployment, observeDeployment } from "../../src/server/application/deployment.ts";
import { sealCredential } from "../../src/server/connections/credentials.ts";
import { LiaraReadClient } from "../../src/server/liara/client.ts";
import { LiaraDeployClient } from "../../src/server/liara/deploy.ts";
import { WorkloadProbe } from "../../src/server/liara/probe.ts";
import { decodeAction, decodeProfile } from "../../src/contracts/client-decode.ts";
import { parseActionSpec } from "../../src/server/policy/action.ts";
import { parseProvisionSpec } from "../../src/contracts/provision.ts";
import { actionPlatform } from "../../src/contracts/platform.ts";
import { executeAgentTool, currentAgentContext, toolsForAgent } from "../../src/server/agent/tools.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";
import { object } from "../../src/contracts/validation.ts";
import { parseCodeRepairJob } from "../../src/contracts/code-repair.ts";
import { assertApplicationPublicationScope } from "../../src/server/policy/application-scope.ts";
import { proposeDestination, executeDestination, observeDestination } from "../../src/server/application/provision.ts";
import { LiaraAccountClient } from "../../src/server/liara/catalog.ts";
import { LiaraProvisionClient } from "../../src/server/liara/provision.ts";

for (const kind of ["flask", "django"] as const) test(`${kind}: source-bound runner, v41/42 approval, provider payload and original route fence`, async () => {
  const f = await frameworkFixture(kind); try {
    const runtime = f.selected.profile.pythonRuntime; assert.ok(runtime && runtime.kind !== "python");
    assert.deepEqual(parseFrameworkPythonRuntime(runtime), runtime); assert.deepEqual(decodeProfile({ profile: f.selected.profile }).pythonRuntime, runtime);
    assert.throws(() => parsePythonRuntime(runtime));
    assert.throws(() => parseFrameworkPythonRuntime({ ...runtime, command: ["sh", "-c", "echo forged"] }));
    assert.throws(() => parseProjectBuildPlan({ ...f.build, testCommand: "true" }), { code: "FRAMEWORK_TEST_CHANGED" });
    assert.throws(() => assertFrameworkBuild(f.store, "foreign", f.selected), { code: "FRAMEWORK_BUILD_REQUIRED" });
    assert.throws(() => assertFrameworkBuild(f.store, f.session.actorId, f.original), { code: "FRAMEWORK_BUILD_REQUIRED" });
    const requirements = f.selected.profile.applicationRequirements; assert.ok(requirements);
    assert.throws(() => assertApplicationPublicationScope({ ...f.selected.profile, applicationRequirements: { ...requirements, requirements: [...requirements.requirements,
      { kind: "background_worker", consumerRoot: ".", need: "required", environmentKeys: [], bindingNames: [], evidence: [{ path: "worker.py", sha256: "f".repeat(64), line: 1, kind: "source" }] }] } }), { code: "FRAMEWORK_TOPOLOGY_REQUIRED" });
    const app = `framework-${kind}`, origin = `https://${app}.example.com`, appId = "b".repeat(24), config = { ...f.config, apps: [app], teamId: "a".repeat(24), liaraToken: "synthetic-framework-provider", enableMutations: true, enableLiveLiara: true, probeOrigins: { [app]: origin } };
    f.store.saveConnection(f.session.actorId, { source: "token", ciphertext: sealCredential(config.liaraToken, config.sessionSecret, f.session.actorId, "liara"), view: { provider: "liara", status: "connected", identityId: "e".repeat(24), displayName: "Fixture", login: "fixture@example.test", teamId: config.teamId, teamName: "Fixture", selectedApp: app, apps: [{ id: appId, name: app, platform: kind }], checkedAt: Date.now() } });
    const read = new LiaraReadClient(config, async url => Response.json(new URL(url).pathname.endsWith("/releases") ? { total: 1, currentRelease: "framework-release", releases: [{ _id: "framework-release", state: "READY", port: 8000 }] } : { project: { _id: appId, project_id: app, type: kind, status: "Running", envs: [], planID: "fixture-plan" } }));
    const toolConfig = { ...config, enableLocalRepair: true }, result = object(await executeAgentTool("propose_project_build", f.build.workload, {
      config: toolConfig, store: f.store, actorId: f.session.actorId, context: currentAgentContext(toolConfig, f.store, f.session.actorId), createdAt: Date.now(), budget: new RunBudget(toolConfig), signal: AbortSignal.timeout(5000) }));
    const beforeTarget = toolsForAgent(toolConfig, "framework", false, true).map(tool => tool.function.name);
    assert.equal(beforeTarget.includes("propose_project_build"), true); assert.equal(beforeTarget.includes("propose_publication"), false);
    assert.equal(toolsForAgent(toolConfig, "build", false, true).some(tool => tool.function.name === "propose_project_build"), false);
    const proposed = parseCodeRepairJob(result.repairProposal); assert.equal(proposed.build?.version, 10); assert.equal(proposed.build?.testCommand, f.build.testCommand); assert.equal(proposed.state, "proposed");
    let writes = 0;
    const writer = new LiaraDeployClient(config, async (url, request) => {
      writes++; if (new URL(url).pathname.endsWith("/sources")) return Response.json({ sourceID: "framework-source" });
      const payload = JSON.parse(String(request.body)); assert.equal(payload.type, kind); assert.equal(payload.port, 8000); assert.equal(payload.args, undefined);
      assert.deepEqual(payload.platformConfig, kind === "flask" ? { pythonVersion: "3.12", mirror: false, appModule: "web:app" } : { pythonVersion: "3.12", mirror: false, collectStatic: false, compileMessages: false, modifySettings: false });
      return Response.json({ releaseID: "framework-release" });
    });
    const action = await proposeWorkloadDeployment(config, f.store, f.session.actorId, { flowId: f.selected.id, app, port: null, workload: { origin, ...f.build.workload } }, AbortSignal.timeout(5000), { read });
    const spec = action.spec; assert.ok(spec.version === 41);
    assert.equal(action.spec.version, 41); assert.deepEqual(parseActionSpec(action.spec), action.spec); assert.deepEqual(decodeAction(action).spec, action.spec); assert.equal(actionPlatform(action.spec), kind);
    const provision = parseProvisionSpec({ version: 42, operation: "create_app", scope: action.spec.scope, sourceHash: f.selected.profile.sourceHash, artifactHash: f.selected.artifact?.archiveHash, projectFlowId: f.selected.id,
      selectionHash: action.spec.selectionHash, accountId: "e".repeat(24), previousAppId: null, nodeVersion: null, runtime, networkId: "c".repeat(24), bundleId: "basic", readOnlyRootFilesystem: true,
      args: { port: null, planId: "fixture-plan" }, cost: { catalogFingerprint: "d".repeat(64), observedAt: Date.now(), expiresAt: Date.now()+60000, hourlyHundredthsToman: 100, region: "iran", currency: "toman", period: "hour", extras: "tax_traffic_storage_not_included" } });
    assert.equal(actionPlatform(provision), kind); assert.deepEqual(parseActionSpec(provision), provision);
    assert.throws(() => parseProvisionSpec({ ...provision, nodeVersion: "22" }), { code: "INVALID_INPUT" });
    assert.throws(() => f.store.createAction(f.session.actorId, { ...spec, workload: { ...spec.workload, assertion: { kind: "json", field: "total", equals: 1 } } }), { code: "MISSION_EXPECTATION_CHANGED" });
    f.store.decide(action.id, f.session.actorId, f.session.id, action.hash, "approve");
    await executeDeployment(config, f.store, f.session, action.id, AbortSignal.timeout(5000), { read, write: writer }); assert.equal(writes, 2);
    const probe = new WorkloadProbe(config, async () => [{ address: "93.184.216.34", family: 4 }], async () => ({ status: 200, body: '{"total":73}', bytes: 12, durationMs: 1, contentType: "application/json" }));
    assert.equal((await observeDeployment(config, f.store, f.session, action.id, AbortSignal.timeout(5000), { read, probe })).state, "succeeded");
    await assert.rejects(executeDeployment(config, f.store, f.session, action.id, AbortSignal.timeout(5000), { read, write: writer })); assert.equal(writes, 2);
  } finally { f.close(); }
});

for (const kind of ["flask", "django"] as const) for (const wrongFamily of [false, true]) test(`${kind}: native destination single-send and family readback (${wrongFamily ? "mismatch" : "verified"})`, async () => {
  const f = await frameworkFixture(kind); try {
    const teamId = "a".repeat(24), accountId = "b".repeat(24), networkId = "c".repeat(24), appId = "d".repeat(24), app = `new-${kind}`;
    const config = { ...f.config, teamId, apps: [app], enableMutations: true, enableLiveLiara: true, liaraToken: "synthetic-framework-destination" };
    f.store.saveConnection(f.session.actorId, { source: "token", ciphertext: sealCredential(config.liaraToken, config.sessionSecret, f.session.actorId, "liara"),
      view: { provider: "liara", status: "connected", identityId: accountId, displayName: "Fixture", login: "fixture@example.test", teamId, teamName: "Fixture", selectedApp: null, apps: [], checkedAt: Date.now() } });
    let exists = false, writes = 0;
    const read = new LiaraAccountClient(config, accountId, async url => {
      const path = new URL(url).pathname;
      if (path === "/v1/me") return Response.json({ user: { _id: accountId }, team: { _id: teamId, balance: 10000 }, plans: {
        projects: { starter: { available: true, region: "iran", price: 500 } }, projectBundlePlans: { starter: { basic: { available: true, price: 40 } } } } });
      if (path === "/v1/networks") return Response.json({ networks: [{ _id: networkId, name: "fixture-network" }] });
      assert.equal(path, `/v1/projects/${app}`);
      return exists ? Response.json({ project: { _id: appId, project_id: app, type: wrongFamily ? "python" : kind, planID: "starter", bundlePlanID: "basic", network: { _id: networkId }, readOnlyRootFilesystem: true } }) : new Response(null, { status: 404 });
    });
    const write = new LiaraProvisionClient(config, async (url, request) => {
      writes++; assert.equal(new URL(url).pathname, "/v1/projects"); assert.equal(request.method, "POST");
      assert.deepEqual(JSON.parse(String(request.body)), { name: app, planID: "starter", bundlePlanID: "basic", platform: kind, network: networkId, readOnlyRootFilesystem: true });
      exists = true; return Response.json({ projectID: appId });
    });
    const signal = () => AbortSignal.timeout(5000), deps = { read, write };
    const action = await proposeDestination(config, f.store, f.session.actorId, { flowId: f.selected.id, app, planId: "starter", bundleId: "basic", networkId }, signal(), deps);
    assert.equal(action.spec.version, 42); assert.deepEqual(decodeAction(action).spec, action.spec); assert.equal(writes, 0);
    f.store.decide(action.id, f.session.actorId, f.session.id, action.hash, "approve");
    assert.equal((await executeDestination(config, f.store, f.session, action.id, signal(), deps)).state, "observing");
    const checked = await observeDestination(config, f.store, f.session, action.id, signal(), deps);
    assert.equal(checked.provision?.observation?.code, wrongFamily ? "DESTINATION_CHANGED" : "DESTINATION_VERIFIED");
    assert.equal(f.store.getConnection(f.session.actorId, "liara")?.view.selectedApp, wrongFamily ? null : app);
    await assert.rejects(executeDestination(config, f.store, f.session, action.id, signal(), deps), { code: "ACTION_CONFLICT" }); assert.equal(writes, 1);
  } finally { f.close(); }
});
