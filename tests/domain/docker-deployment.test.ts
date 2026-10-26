import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID, createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { captureProject } from "../../src/server/workspace/inspect.ts";
import { createSourceArchive, persistArtifact } from "../../src/server/workspace/archive.ts";
import { sealCredential } from "../../src/server/connections/credentials.ts";
import { LiaraDeployClient } from "../../src/server/liara/deploy.ts";
import { LiaraProvisionClient } from "../../src/server/liara/provision.ts";
import { LiaraEnvironmentClient } from "../../src/server/liara/environment.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";
import { parseActionSpec } from "../../src/server/policy/action.ts";
import { Store } from "../../src/server/persistence/store.ts";
import { AppError } from "../../src/server/errors.ts";
import { canReadDeploymentResult } from "../../src/contracts/deployment.ts";
import { canReadDestinationResult } from "../../src/contracts/provision.ts";
import type { ProjectFlow } from "../../src/contracts/project-flow.ts";
import type { DockerRuntime } from "../../src/contracts/docker-runtime.ts";
import type { Transport } from "../../src/server/providers/http.ts";
import { LiaraAccountClient } from "../../src/server/liara/catalog.ts";
import { GoalModelClient } from "../../src/server/agent/model.ts";
import { driveAgentRun } from "../../src/server/agent/runs.ts";
import { executeAgentTool } from "../../src/server/agent/tools.ts";
import { AgentRepository, agentView } from "../../src/server/agent/store.ts";
import { parseAgentView } from "../../src/contracts/agent.ts";
import { createPublicationMission } from "../../src/server/application/publication-mission.ts";
import { reviseAgentDestination } from "../../src/server/application/agent-destination.ts";

const team = "a".repeat(24), app = "docker-contract", appId = "e".repeat(24), accountId = "d".repeat(24), network = "f".repeat(24);
const bounded = () => AbortSignal.timeout(5000);
const denial = (error: unknown) => error instanceof AppError && error.status >= 400 && error.status < 500;
async function fixture() {
  const f = await agentFixture();
  try {
    const dockerfile = "FROM node:22.23.3-bookworm-slim\nWORKDIR /app\nCOPY . .\nEXPOSE 3000\nCMD [\"node\", \"server.mjs\"]\n";
    writeFileSync(join(f.project, "Dockerfile"), dockerfile);
    writeFileSync(join(f.project, "liara.json"), JSON.stringify({ platform: "docker", port: 3000 }));
    const captured = await captureProject(f.workspace, "service");
    const archive = await createSourceArchive({ workspaceRoot: f.workspace, directory: "service", sourceHash: captured.profile.sourceHash });
    await persistArtifact(f.config.stateDir, archive.artifact, archive.bytes); f.store.recordArtifact(f.session.actorId, archive.artifact);
    const { nodeRuntime: _node, nextRuntime: _next, frontendRuntime: _frontend, pythonRuntime: _python, staticRuntime: _static, ...base } = captured.profile;
    const runtime: DockerRuntime = { kind: "docker", contextRoot: ".", dockerfile: "Dockerfile", dockerfileHash: createHash("sha256").update(dockerfile).digest("hex"), port: 3000 };
    const flow: ProjectFlow = { ...f.flow, id: randomUUID(), artifact: archive.artifact, actionId: null,
      profile: { ...base, runtime: "docker", nodeVersion: null, dockerRuntime: runtime, port: 3000, start: "liara-docker", build: null, missing: [] } };
    f.store.saveProjectFlow(f.session.actorId, flow);
    const config = { ...f.config, teamId: team, apps: [app], liaraToken: "synthetic-docker-provider", enableMutations: true, enableLiveLiara: true,
      probeOrigins: { [app]: `https://${app}.example.com` } };
    f.store.saveConnection(f.session.actorId, { source: "token", ciphertext: sealCredential(config.liaraToken, config.sessionSecret, f.session.actorId, "liara"),
      view: { provider: "liara", status: "connected", identityId: accountId, displayName: "Synthetic Docker", login: "fixture@example.test", teamId: team,
        teamName: "Fixture", selectedApp: app, apps: [{ id: appId, name: app, platform: "docker" }], checkedAt: Date.now() } });
    const common = { scope: { teamId: team, app }, sourceHash: flow.profile.sourceHash, artifactHash: archive.artifact.archiveHash, projectFlowId: flow.id,
      selectionHash: flow.selectionHash, accountId, nodeVersion: null, runtime };
    const deploy = parseActionSpec({ ...common, version: 21, operation: "deploy", targetAppId: appId, environment: null, args: { port: 3000, planId: "starter" },
      workload: { origin: config.probeOrigins[app], path: "/", status: 200, assertion: { kind: "text", contains: "invoice service" } } });
    const now = Date.now();
    const provision = parseActionSpec({ ...common, version: 22, operation: "create_app", previousAppId: appId, networkId: network, bundleId: "basic", readOnlyRootFilesystem: true,
      args: { port: null, planId: "starter" }, cost: { catalogFingerprint: "b".repeat(64), observedAt: now, expiresAt: now + 600000,
        hourlyHundredthsToman: 500, region: "iran", currency: "toman", period: "hour", extras: "tax_traffic_storage_not_included" } });
    if (deploy.version !== 21 || provision.version !== 22) throw Error("Fixture version mismatch");
    return { ...f, config, flow, runtime, deploy, provision, bytes: archive.bytes };
  } catch (error) { f.close(); throw error; }
}
test("Docker publication keeps rejection, expiry, session binding and single-use claims in the shared Store", async () => {
  for (const mode of ["reject", "expire", "other-session", "replay"] as const) {
    const f = await fixture();
    try {
      const action = f.store.createAction(f.session.actorId, f.deploy);
      if (mode === "reject") f.store.decide(action.id, f.session.actorId, f.session.id, action.hash, "reject");
      else f.store.decide(action.id, f.session.actorId, f.session.id, action.hash, "approve");
      if (mode === "replay") {
        const claimed = f.store.claim(action.id, f.session.actorId, f.session.id, f.deploy);
        assert.equal(claimed.deployment?.stage, "claimed"); assert.ok(claimed.attemptId);
      }
      assert.throws(() => f.store.claim(action.id, f.session.actorId, mode === "other-session" ? "other" : f.session.id, f.deploy, mode === "expire" ? action.expiresAt + 1 : Date.now()), denial);
      assert.equal(f.store.db.prepare("SELECT COUNT(*) AS count FROM attempts").get()?.count, mode === "replay" ? 1 : 0);
    } finally { f.close(); }
  }
});
test("changing Dockerfile bytes or the account cannot spend an existing approval", async () => {
  const f = await fixture();
  try {
    const action = f.store.createAction(f.session.actorId, f.deploy);
    f.store.decide(action.id, f.session.actorId, f.session.id, action.hash, "approve");
    const changed = { ...f.deploy, runtime: { ...f.runtime, dockerfileHash: "b".repeat(64) } };
    assert.throws(() => f.store.claim(action.id, f.session.actorId, f.session.id, changed), denial);
    const connection = f.store.getConnection(f.session.actorId, "liara"); assert.ok(connection);
    f.store.saveConnection(f.session.actorId, { ...connection, view: { ...connection.view, identityId: "c".repeat(24) } });
    assert.throws(() => f.store.claim(action.id, f.session.actorId, f.session.id, f.deploy), denial);
    assert.equal(f.store.db.prepare("SELECT COUNT(*) AS count FROM attempts").get()?.count, 0);
  } finally { f.close(); }
});
test("a new active project invalidates a Docker approval without losing the previous immutable archive", async () => {
  const f = await fixture();
  try {
    const action = f.store.createAction(f.session.actorId, f.deploy);
    f.store.decide(action.id, f.session.actorId, f.session.id, action.hash, "approve");
    f.store.saveProjectFlow(f.session.actorId, { ...f.flow, id: randomUUID(), actionId: null });
    assert.throws(() => f.store.claim(action.id, f.session.actorId, f.session.id, f.deploy), denial);
    assert.equal(f.store.getArtifact(f.session.actorId, f.deploy.artifactHash).archiveHash, f.deploy.artifactHash);
  } finally { f.close(); }
});
test("Docker release uses the official v2 build.dockerfile payload and preserves opaque source receipts", async () => {
  const f = await fixture();
  try {
    const calls: string[] = [];
    const writer = new LiaraDeployClient(f.config, async (url, init) => {
      const parsed = new URL(url); calls.push(parsed.pathname);
      assert.equal(parsed.searchParams.get("teamID"), team); assert.equal(init.method, "POST"); assert.equal(init.redirect, "error");
      if (parsed.pathname.endsWith("/sources")) {
        assert.ok(init.body instanceof FormData);
        return Response.json({ sourceID: "source-docker.tar.gz" });
      }
      assert.deepEqual(JSON.parse(String(init.body)), { sourceID: "source-docker.tar.gz", port: 3000, type: "docker", platformConfig: {}, build: { dockerfile: "Dockerfile" } });
      return Response.json({ releaseID: "release-exact" });
    });
    const budget = new RunBudget(f.config);
    const sourceId = await writer.upload(f.deploy, f.bytes, budget, bounded());
    assert.equal(await writer.release(f.deploy, sourceId, budget, bounded()), "release-exact");
    assert.deepEqual(calls, [`/v2/projects/${app}/sources`, `/v2/projects/${app}/releases`]);
  } finally { f.close(); }
});
test("provider failures and malformed Docker receipts never retry the write", async () => {
  const f = await fixture();
  try {
    for (const behavior of ["timeout", "http500", "wrong-receipt"] as const) {
      let calls = 0;
      const transport: Transport = async () => {
        calls++;
        if (behavior === "timeout") throw Error("private transport message");
        return behavior === "http500" ? new Response(null, { status: 500 }) : Response.json({ wrongReleaseId: "not-proof" });
      };
      await assert.rejects(new LiaraDeployClient(f.config, transport).release(f.deploy, "source-docker.tar.gz", new RunBudget(f.config), bounded()), error => error instanceof AppError && !error.message.includes("private transport message"));
      assert.equal(calls, 1);
    }
  } finally { f.close(); }
});
test("v22 creates only the approved Docker destination and keeps creation distinct from publication", async () => {
  const f = await fixture();
  try {
    const writer = new LiaraProvisionClient(f.config, async (url, init) => {
      assert.equal(new URL(url).pathname, "/v1/projects");
      assert.deepEqual(JSON.parse(String(init.body)), { name: app, planID: "starter", bundlePlanID: "basic", platform: "docker", network, readOnlyRootFilesystem: true });
      return Response.json({ projectID: appId });
    });
    assert.equal(await writer.create(f.provision, new RunBudget(f.config), bounded()), appId);
    const action = f.store.createAction(f.session.actorId, f.provision);
    f.store.decide(action.id, f.session.actorId, f.session.id, action.hash, "approve");
    f.store.claim(action.id, f.session.actorId, f.session.id, f.provision);
    f.store.provisionStep(action.id, f.session.actorId, "request_started");
    f.store.provisionStep(action.id, f.session.actorId, "created", appId);
    const accepted = f.store.receipt(action.id, f.session.actorId, appId);
    assert.equal(accepted.state, "observing"); assert.equal(canReadDestinationResult(accepted), true); assert.equal(accepted.deployment, undefined);
  } finally { f.close(); }
});
test("an interrupted Docker publication recovers as uncertain with its consumed attempt intact", async () => {
  const f = await fixture(); let reopened: Store | undefined;
  try {
    const action = f.store.createAction(f.session.actorId, f.deploy);
    f.store.decide(action.id, f.session.actorId, f.session.id, action.hash, "approve");
    const claimed = f.store.claim(action.id, f.session.actorId, f.session.id, f.deploy);
    f.store.deploymentStep(action.id, f.session.actorId, "upload_started");
    f.store.close(); reopened = new Store(join(f.config.stateDir, "state.sqlite")); reopened.recoverInterrupted();
    const recovered = reopened.getAction(action.id, f.session.actorId);
    assert.equal(recovered.state, "uncertain"); assert.equal(recovered.attemptId, claimed.attemptId);
    assert.equal(recovered.deployment?.stage, "upload_started"); assert.equal(canReadDeploymentResult(recovered), true);
    assert.throws(() => reopened?.claim(action.id, f.session.actorId, f.session.id, f.deploy), denial);
  } finally { reopened?.close(); f.close(); }
});

test("a generic healthy observation cannot complete Docker destination creation", async () => {
  const f = await fixture();
  try {
    const action = f.store.createAction(f.session.actorId, f.provision);
    f.store.decide(action.id, f.session.actorId, f.session.id, action.hash, "approve");
    f.store.claim(action.id, f.session.actorId, f.session.id, f.provision);
    f.store.provisionStep(action.id, f.session.actorId, "request_started");
    f.store.provisionStep(action.id, f.session.actorId, "created", appId);
    f.store.receipt(action.id, f.session.actorId, appId);
    assert.throws(() => f.store.finishObservation(action.id, f.session.actorId, "healthy"), { code: "PROVISION_OBSERVATION_REQUIRED" });
    const unchanged = f.store.getAction(action.id, f.session.actorId);
    assert.equal(unchanged.state, "observing");
    assert.equal(unchanged.provision?.observation, null);
    assert.equal(f.store.db.prepare("SELECT COUNT(*) AS count FROM attempts").get()?.count, 1);
  } finally { f.close(); }
});
test("Docker environment readback validates identity while preserving provider metadata boundaries", async () => {
  const f = await fixture();
  try {
    const client = new LiaraEnvironmentClient(f.config, async () => Response.json({ project: { _id: appId, project_id: app, type: "docker", planID: "starter", envs: [{ key: "MODE", value: "test", encrypted: false, createdAt: 1 }] } }));
    assert.deepEqual(await client.read(f.deploy, new RunBudget(f.config), bounded()), { planId: "starter", values: [{ key: "MODE", value: "test" }] });
    const wrong = new LiaraEnvironmentClient(f.config, async () => Response.json({ project: { _id: "c".repeat(24), project_id: app, type: "docker", planID: "starter", envs: [] } }));
    await assert.rejects(wrong.read(f.deploy, new RunBudget(f.config), bounded()), { code: "ENV_TARGET_CHANGED" });
  } finally { f.close(); }
});

test("the Agent registry preserves a source-selected Docker destination through the actual proposal and view decoders", async () => {
  const f = await fixture();try {
    assert.equal((await captureProject(f.workspace, "service")).profile.runtime, "docker");
    const connection = f.store.getConnection(f.session.actorId, "liara");assert.ok(connection);
    f.store.saveConnection(f.session.actorId, { ...connection, view: { ...connection.view, selectedApp: null, apps: [] } });
    let reads = 0;
    const account = new LiaraAccountClient(f.config, accountId, async (url, init) => {
      reads++;assert.equal(init.method, "GET");const path = new URL(url).pathname;
      if (path === "/v1/me") return Response.json({ user: { _id: accountId }, team: { _id: team, balance: 10000 }, plans: { projects: { starter: { available: true, price: 10, region: "iran" }, growth: { available: true, price: 20, region: "iran" } }, projectBundlePlans: { starter: { basic: { available: true, price: 1 } }, growth: { basic: { available: true, price: 2 } } } } });
      if (path === "/v1/networks") return Response.json({ networks: [{ _id: network, name: "fixture" }] });
      assert.equal(path, `/v1/projects/${app}`);return new Response(null, { status: 404 });
    });
    const model = new GoalModelClient(f.config, async () => Response.json({ choices: [{ finish_reason: "tool_calls", message: { role: "assistant", tool_calls: [{ id: randomUUID(), type: "function", function: { name: "propose_destination", arguments: JSON.stringify({ app, planId: "starter", bundleId: "basic", networkId: network }) } }] } }], usage: { total_tokens: 10 } }));
    const run = (await createPublicationMission(f.config, f.store, f.session, randomUUID(), { projectId: f.flow.id, sourceHash: f.flow.profile.sourceHash, path: "/", expectedText: "invoice service" }, bounded())).run;
    await driveAgentRun(f.config, f.store, f.session, run.id, { model,
      tool: (name, args, context) => executeAgentTool(name, args, { ...context, account }) });
    const proposed = new AgentRepository(f.store).get(f.session.actorId, run.id);assert.ok(proposed);
    assert.equal(proposed.state, "needs_approval", JSON.stringify({ state: proposed.state, code: proposed.errorCode, events: proposed.events.slice(-4) }));
    assert.equal(proposed.destination?.spec.version, 22);assert.equal(parseAgentView(agentView(proposed)).destination?.spec.version, 22);
    assert.equal(proposed.usage.modelCalls, 1);assert.ok(reads > 0);assert.equal(proposed.destination?.attemptId, null);
    const revised = await reviseAgentDestination(f.config, f.store, f.session, proposed.id, proposed.revision, "growth", "basic", bounded(), account);
    assert.equal(revised.destination?.spec.version, 22);assert.equal(revised.destination?.spec.args.planId, "growth");
    assert.equal(revised.destination?.attemptId, null);assert.equal(revised.usage.modelCalls, 1);
    assert.equal(f.store.getAction(proposed.destination.id, f.session.actorId).state, "cancelled");
  } finally { f.close(); }
});
