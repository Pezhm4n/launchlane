import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { createAgentRun, decideAgentDestination, decideAgentPublication, driveAgentRun, resumeAgentDestination } from "../../src/server/agent/runs.ts";
import { AgentRepository } from "../../src/server/agent/store.ts";
import { executeAgentTool, toolsForAgent } from "../../src/server/agent/tools.ts";
import { GoalModelClient } from "../../src/server/agent/model.ts";
import { LiaraAccountClient } from "../../src/server/liara/catalog.ts";
import { LiaraProvisionClient } from "../../src/server/liara/provision.ts";
import { LiaraReadClient } from "../../src/server/liara/client.ts";
import { LiaraDeployClient } from "../../src/server/liara/deploy.ts";
import { WorkloadProbe } from "../../src/server/liara/probe.ts";
import { sealCredential } from "../../src/server/connections/credentials.ts";
import { executeDestination, observeDestination } from "../../src/server/application/provision.ts";
import { AppError } from "../../src/server/errors.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";

const app = "agent-created-site", team = "a".repeat(24), accountId = "b".repeat(24), network = "c".repeat(24), createdId = "d".repeat(24);
async function fixture(runtime: "node" | "static" = "node") {
  const f = await agentFixture(), config = { ...f.config, teamId: team, apps: [app], liaraToken: "private-destination-test-credential",
    enableLiveLiara: true, enableMutations: true };
  const flow = runtime === "static" ? await prepareProjectFlow(config, f.store, f.session.actorId,
    { kind: "upload", name: "invoice-site", directory: "." }, AbortSignal.timeout(3000), undefined, undefined,
    [{ path: "index.html", content: Buffer.from("<!DOCTYPE html><html><title>invoice service</title><body>invoice service</body></html>") }]) : f.flow;
  f.store.saveConnection(f.session.actorId, { source: "token", ciphertext: sealCredential(config.liaraToken, config.sessionSecret, f.session.actorId, "liara"),
    view: { provider: "liara", status: "connected", identityId: accountId, displayName: "آزمون", login: "test@example.test",
      teamId: team, teamName: "آزمون", checkedAt: Date.now(), apps: [], selectedApp: null } });
  let creates = 0, publishes = 0, reads = 0, models = 0, exists = false, loseResponse = false, defaultSubdomain = true;
  let beforeObservation: (() => void) | null = null;
  const account = new LiaraAccountClient(config, accountId, async (url) => {
    reads++;
    const path = new URL(url).pathname;
    if (path === "/v1/me") return Response.json({ user: { _id: accountId }, team: { _id: team, balance: 10000 },
      plans: { projects: { starter: { available: true, region: "iran", price: 500 } }, projectBundlePlans: { starter: { basic: { available: true, price: 40 } } } } });
    if (path === "/v1/networks") return Response.json({ networks: [{ _id: network, name: "existing-network" }] });
    assert.equal(path, `/v1/projects/${app}`);
    if (!exists) return new Response(null, { status: 404 });
    beforeObservation?.();
    return Response.json({ project: { _id: createdId, project_id: app, type: runtime, planID: "starter", bundlePlanID: "basic",
      network: { _id: network }, readOnlyRootFilesystem: true, defaultSubdomain } });
  });
  const write = new LiaraProvisionClient(config, async () => {
    creates++;
    exists = true;
    if (loseResponse) throw new Error("response lost");
    return Response.json({ projectID: createdId });
  });
  const read = new LiaraReadClient(config, async (url) => {
    reads++;
    assert.ok(exists);
    return Response.json(url.includes("/releases")
      ? { currentRelease: "created-release", total: 1, releases: [{ _id: "created-release", state: "READY", port: 3000 }] }
      : { project: { _id: createdId, project_id: app, type: runtime, planID: "starter", status: "Running", envs: [] } });
  });
  const deployment = { read, write: new LiaraDeployClient(config, async (url) => {
    publishes++;
    return Response.json(url.includes("/sources") ? { sourceID: "created-source.tar.gz" } : { releaseID: "created-release" });
  }), probe: new WorkloadProbe({ ...config, probeOrigins: { [app]: `https://${app}.liara.run` } }, async () => [{ address: "93.184.216.34", family: 4 }],
    async () => ({ status: 200, body: "invoice service", bytes: 15, durationMs: 2 })) };
  const calls = ["inspect_project", "read_catalog", "read_networks", "propose_destination", "propose_publication"];
  const model = new GoalModelClient(config, async () => {
    const name = calls[models++];
    assert.ok(name, "unexpected repeated model call");
    const args = name === "propose_destination" ? { app, planId: "starter", bundleId: "basic", networkId: network }
      : name === "propose_publication" ? { path: "/", status: 200, assertion: { kind: "text", contains: "invoice service" } } : {};
    return Response.json({ choices: [{ finish_reason: "tool_calls", message: { role: "assistant", tool_calls: [{ id: randomUUID(), type: "function", function: { name, arguments: JSON.stringify(args) } }] } }], usage: { total_tokens: 52 } });
  });
  const dependencies = { model, destination: { read: account, write }, deployment, pollDelayMs: 1,
    tool: (name: string, input: unknown, context: Parameters<typeof executeAgentTool>[2]) => executeAgentTool(name, input, { ...context, account, read }) };
  const repo = new AgentRepository(f.store), initial = createAgentRun(config, f.store, f.session, randomUUID(), "مقصد تازه بساز و همین پروژه را منتشر کن", flow.id).run;
  await driveAgentRun(config, f.store, f.session, initial.id, dependencies);
  const run = repo.get(f.session.actorId, initial.id);
  assert.equal(run?.destination?.spec.version, runtime === "static" ? 16 : 8);
  assert.ok(run);
  assert.equal(run.state, "needs_approval");
  assert.equal(creates, 0);
  return { ...f, flow, config, repo, run, dependencies,
    counts: () => ({ creates, publishes, reads, models }),
    set(v: { loseResponse?: boolean; defaultSubdomain?: boolean; beforeObservation?: () => void }) {
      loseResponse = v.loseResponse ?? loseResponse; defaultSubdomain = v.defaultSubdomain ?? defaultSubdomain;
      beforeObservation = v.beforeObservation ?? beforeObservation;
    },
    async approve() { assert.ok(run.destination); return decideAgentDestination(config, f.store, f.session, run.id, run.revision, run.destination.id, "approve"); },
  };
}

for (const runtime of ["node", "static"] as const) test(`${runtime} agent creates one approved identity then proposes and publishes the same archive with a separate decision`, async () => {
  const f = await fixture(runtime);
  try {
    const selectedHash = f.flow.artifact?.archiveHash;
    await f.approve();
    await assert.rejects(f.approve(), (e: unknown) => e instanceof AppError && e.code === "AGENT_CONFLICT");
    await driveAgentRun(f.config, f.store, f.session, f.run.id, f.dependencies);
    const proposed = f.repo.get(f.session.actorId, f.run.id);
    assert.equal(proposed?.publication?.spec.version, runtime === "static" ? 15 : 7);
    assert.ok(proposed?.publication);
    assert.equal(proposed.state, "needs_approval");
    assert.equal(proposed.destination?.state, "succeeded");
    assert.equal(proposed.effect, "destination_created");
    assert.equal(proposed.context.target?.appId, createdId);
    assert.equal(proposed.publication.spec.targetAppId, createdId);
    assert.equal(proposed.publication.spec.artifactHash, selectedHash);
    assert.equal(proposed.publication.spec.workload.origin, `https://${app}.liara.run`);
    assert.equal(f.counts().creates, 1); assert.equal(f.counts().publishes, 0);
    await decideAgentPublication(f.config, f.store, f.session, proposed.id, proposed.revision, proposed.publication.id, "approve");
    await driveAgentRun(f.config, f.store, f.session, proposed.id, f.dependencies);
    const result = f.repo.get(f.session.actorId, f.run.id);
    assert.equal(result?.state, "completed"); assert.equal(result?.effect, "remote_changes_verified");
    assert.equal(result?.destination?.provision?.appId, createdId);
    assert.equal(f.counts().creates, 1); assert.equal(f.counts().publishes, 2);
    const before = f.counts();
    await driveAgentRun(f.config, f.store, f.session, proposed.id, f.dependencies);
    assert.deepEqual(f.counts(), before);
  } finally { f.close(); }
});

test("rejecting expired or stale destination proposals is possible, while approval stays bound and atomic", async () => {
  for (const mode of ["expired", "context", "storage"] as const) {
    const f = await fixture();
    try {
      const action = f.run.destination;
      assert.ok(action);
      if (mode === "expired") f.store.db.prepare("UPDATE actions SET expires_at=0 WHERE id=?").run(action.id);
      if (mode === "context") f.store.disconnectConnection(f.session.actorId, "liara");
      if (mode === "storage") f.store.db.exec("CREATE TRIGGER stop_run_update BEFORE UPDATE ON agent_runs BEGIN SELECT RAISE(ABORT,'storage stopped'); END");
      await assert.rejects(f.approve());
      assert.equal(f.store.getAction(action.id, f.session.actorId).state, "awaiting_approval");
      if (mode === "storage") f.store.db.exec("DROP TRIGGER stop_run_update");
      await decideAgentDestination(f.config, f.store, f.session, f.run.id, f.run.revision, action.id, "reject");
      assert.equal(f.repo.get(f.session.actorId, f.run.id)?.state, "needs_input");
      assert.equal(f.store.getAction(action.id, f.session.actorId).state, "cancelled");
      assert.equal(f.counts().creates, 0);
    } finally { f.close(); }
  }
});

test("unknown creation receipt survives recovery without adopting a name or repeating a model/create request", async () => {
  const f = await fixture();
  try {
    f.set({ loseResponse: true });
    await f.approve();
    await driveAgentRun(f.config, f.store, f.session, f.run.id, f.dependencies);
    let run = f.repo.get(f.session.actorId, f.run.id);
    assert.ok(run); assert.equal(run.state, "partially_completed");
    assert.equal(run.destination?.state, "uncertain"); assert.equal(run.effect, "remote_changes_unverified");
    f.store.recoverInterrupted(); f.repo.recover();
    const before = f.counts();
    run = resumeAgentDestination(f.store, f.session, run.id, run.revision);
    await driveAgentRun(f.config, f.store, f.session, run.id, f.dependencies);
    assert.equal(f.counts().creates, 1); assert.equal(f.counts().models, before.models);
    assert.equal(f.store.getConnection(f.session.actorId, "liara")?.view.selectedApp, null);
    assert.equal(f.repo.get(f.session.actorId, run.id)?.publication, null);
  } finally { f.close(); }
});

test("a crash between verified creation and conversation adoption resumes only the exact durable identity", async () => {
  const f = await fixture();
  try {
    await f.approve();
    const working = f.repo.claim(f.session.actorId, f.run.id);
    assert.ok(working?.destination);
    await executeDestination(f.config, f.store, f.session, working.destination.id, AbortSignal.timeout(3000), f.dependencies.destination);
    await observeDestination(f.config, f.store, f.session, working.destination.id, AbortSignal.timeout(3000), f.dependencies.destination);
    f.store.recoverInterrupted(); f.repo.recover();
    let run = f.repo.get(f.session.actorId, working.id);
    assert.ok(run); assert.equal(run.state, "interrupted"); assert.equal(run.destinationContinued, false);
    assert.equal(run.effect, "destination_created");
    run = resumeAgentDestination(f.store, f.session, run.id, run.revision);
    await driveAgentRun(f.config, f.store, f.session, run.id, f.dependencies);
    assert.equal(f.counts().creates, 1); assert.equal(f.counts().publishes, 0);
    assert.equal(f.repo.get(f.session.actorId, run.id)?.publication?.state, "awaiting_approval");
  } finally { f.close(); }
});

test("creation cannot overwrite a user's concurrent destination selection or imply publication", async () => {
  const f = await fixture();
  try {
    f.set({ beforeObservation: () => {
      const connection = f.store.getConnection(f.session.actorId, "liara"); assert.ok(connection);
      f.store.saveConnection(f.session.actorId, { ...connection, view: { ...connection.view,
        apps: [{ name: "user-chosen", id: "e".repeat(24), platform: "node" }], selectedApp: "user-chosen" } });
    } });
    await f.approve();
    await driveAgentRun(f.config, f.store, f.session, f.run.id, f.dependencies);
    const run = f.repo.get(f.session.actorId, f.run.id);
    assert.equal(run?.state, "failed"); assert.equal(run?.errorCode, "AGENT_CONTEXT_CHANGED");
    assert.equal(run?.destination?.state, "succeeded"); assert.equal(run?.effect, "destination_created");
    assert.equal(run?.publication, null); assert.equal(f.counts().models, 4);
    assert.equal(f.store.getConnection(f.session.actorId, "liara")?.view.selectedApp, "user-chosen");
  } finally { f.close(); }
});

test("a queued creation approval is cancelled on recovery, and disabled gates omit creation tools", async () => {
  const f = await fixture();
  try {
    await f.approve(); f.store.recoverInterrupted(); f.repo.recover();
    await driveAgentRun(f.config, f.store, f.session, f.run.id, f.dependencies);
    assert.equal(f.repo.get(f.session.actorId, f.run.id)?.destination?.state, "cancelled");
    assert.equal(f.counts().creates, 0);
    for (const config of [{ ...f.config, enableMutations: false }, { ...f.config, enableLiveLiara: false }]) {
      assert.ok(!toolsForAgent(config).some((tool) => tool.function.name === "propose_destination"));
    }
  } finally { f.close(); }
});

test("a disabled provider default subdomain never manufactures a probe target", async () => {
  const f = await fixture();
  try {
    f.set({ defaultSubdomain: false });
    await f.approve();
    const action = f.run.destination; assert.ok(action);
    await executeDestination(f.config, f.store, f.session, action.id, AbortSignal.timeout(3000), f.dependencies.destination);
    await observeDestination(f.config, f.store, f.session, action.id, AbortSignal.timeout(3000), f.dependencies.destination);
    assert.equal(f.store.getProbeOrigin(f.session.actorId, team, app), null);
    assert.equal(f.repo.get(f.session.actorId, f.run.id)?.effect, "destination_created");
  } finally { f.close(); }
});
