import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { sealCredential } from "../../src/server/connections/credentials.ts";
import { connectedLiaraConfig } from "../../src/server/connections/liara.ts";
import { LiaraLifecycleClient } from "../../src/server/liara/lifecycle.ts";
import { proposeLifecycle, executeLifecycle, observeLifecycle } from "../../src/server/application/project-lifecycle.ts";
import { listProjects, openLibraryProject } from "../../src/server/application/project-library.ts";
import { decodeAction } from "../../src/contracts/client-decode.ts";
import { AppError } from "../../src/server/errors.ts";
import { AgentRepository } from "../../src/server/agent/store.ts";
import { currentAgentContext } from "../../src/server/agent/tools.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";

const code = (expected: string) => (error: unknown) => error instanceof AppError && error.code === expected;
async function fixture() {
  const f = await agentFixture(), actor = f.session.actorId, config = { ...f.config, enableLiveLiara: true, enableMutations: true, teamId: "a".repeat(24) }, app = "lifecycle-fixture", appId = "c".repeat(24);
  f.store.saveConnection(actor, { source: "token", ciphertext: sealCredential("synthetic-lifecycle-credential", config.sessionSecret, actor, "liara"), view: {
    provider: "liara", status: "connected", identityId: "b".repeat(24), teamId: config.teamId, teamName: "test", displayName: "test", login: "test@example.test", checkedAt: Date.now(), selectedApp: app, apps: [{ id: appId, name: app, platform: "node" }] } });
  let scale = 1, pods = 1, present = true, lost = false, plan = "g2-standard", identity = appId, status = 200, appletStatus = 200;
  const writes: string[] = [];
  const client = new LiaraLifecycleClient(connectedLiaraConfig(config, f.store, actor, app), async (url, options) => {
    const target = new URL(url); assert.equal(target.origin, "https://api.liara.ir"); assert.equal(target.searchParams.get("teamID"), config.teamId);
    if (options.method === "POST") { writes.push("stop"); assert.deepEqual(JSON.parse(String(options.body)), { scale: 0 }); scale = 0; if (lost) throw Error("lost-response"); return new Response(); }
    if (options.method === "DELETE") { writes.push("delete"); present = false; if (lost) throw Error("lost-response"); return new Response(null, { status: 204 }); }
    if (status !== 200) return new Response(null, { status });
    if (target.pathname.endsWith("/applets")) return appletStatus === 200 ? Response.json({ applets: pods ? [{ state: "RUNNING" }] : [] }) : new Response(null, { status: appletStatus });
    return present ? Response.json({ project: { _id: identity, project_id: app, planID: plan, scale } }) : new Response(null, { status: 404 });
  });
  const signal = () => AbortSignal.timeout(5000);
  const propose = (operation: "stop_app" | "delete_app", key = randomUUID()) => proposeLifecycle(config, f.store, f.session, f.flow.id, operation, key, signal(), { client });
  const execute = async (id: string) => executeLifecycle(config, f.store, f.session, id, signal(), { client });
  const observe = (id: string) => observeLifecycle(config, f.store, f.session, id, signal(), { client });
  const approve = (action: Awaited<ReturnType<typeof propose>>) => f.store.decide(action.id, actor, f.session.id, action.hash, "approve");
  return { ...f, config, actor, app, appId, client, writes, propose, execute, observe, approve, signal,
    setPods: (n: number) => { pods = n; }, setLost: () => { lost = true; }, setScale: (n: number) => { scale = n; },
    setPlan: (value: string) => { plan = value; }, setIdentity: () => { identity = "d".repeat(24); }, setStatus: (n: number) => { status = n; }, setAppletStatus: (n: number) => { appletStatus = n; } };
}
test("stop/delete use exact approved identity, independent stop and 404 readback, and one write each", async () => {
  const f = await fixture();
  try {
    await assert.rejects(f.propose("delete_app"), code("APP_STOP_REQUIRED"));
    const key = randomUUID(), stop = await f.propose("stop_app", key);
    assert.deepEqual(decodeAction(stop), stop); assert.equal((await f.propose("stop_app", key)).id, stop.id); assert.deepEqual(f.writes, []);
    await assert.rejects(f.execute(stop.id), code("ACTION_CONFLICT")); f.approve(stop);
    assert.equal((await f.execute(stop.id)).state, "observing");
    assert.equal((await f.observe(stop.id)).state, "uncertain", "desired scale zero is not a stopped workload");
    await assert.rejects(f.execute(stop.id), code("ACTION_CONFLICT"));
    f.setPods(0); assert.equal((await f.observe(stop.id)).state, "succeeded");
    const remove = await f.propose("delete_app"); f.approve(remove); assert.equal((await f.execute(remove.id)).state, "observing");
    assert.equal((await f.observe(remove.id)).state, "succeeded"); assert.deepEqual(f.writes, ["stop", "delete"]);
    assert.equal(f.store.getConnection(f.actor, "liara")?.view.selectedApp, null);
    assert.deepEqual(f.store.getConnection(f.actor, "liara")?.view.apps, []);
    assert.equal(f.store.db.prepare("SELECT count(*) n FROM attempts").get()?.n, 2);
    assert.ok(f.store.db.prepare("SELECT event FROM audit_events WHERE action_id=? AND event='lifecycle_verified'").get(remove.id));
  } finally { f.close(); }
});
test("lost write responses and restart reconcile by reads without replay; 401/429/5xx are not deletion proof", async () => {
  const f = await fixture();
  try {
    f.setLost(); const stop = await f.propose("stop_app"); f.approve(stop); await f.execute(stop.id);
    f.store.recoverInterrupted();
    for (const status of [401, 429, 500]) { f.setStatus(status); assert.equal((await f.observe(stop.id)).state, "uncertain"); }
    f.setStatus(200); f.setPods(0); assert.equal((await f.observe(stop.id)).state, "succeeded");
    const remove = await f.propose("delete_app"); f.approve(remove); assert.equal((await f.execute(remove.id)).state, "uncertain");
    assert.equal((await f.observe(remove.id)).state, "succeeded"); assert.deepEqual(f.writes, ["stop", "delete"]);
  } finally { f.close(); }
});
test("a broken instances API verifies only desired scale, keeps runtime visibility unknown, and never hides identity/read/auth failures", async () => {
  const f = await fixture();
  try {
    const action = await f.propose("stop_app"); f.approve(action); await f.execute(action.id);
    f.setAppletStatus(401); assert.equal((await f.observe(action.id)).state, "uncertain");
    f.setAppletStatus(500); const configured = await f.observe(action.id);
    assert.equal(configured.state, "succeeded"); assert.equal(configured.lifecycle?.verification, "configuration");
    assert.notEqual(configured.lifecycle?.verification, "instances_absent"); assert.deepEqual(f.writes, ["stop"]);
  } finally { f.close(); }
});
test("denial, expiry, changed identity/plan, wrong session and restarted workload fail before mutation", async () => {
  for (const variant of ["deny", "expiry", "identity", "plan", "session", "running"] as const) {
    const f = await fixture();
    try {
      if (variant === "running") { f.setScale(0); f.setPods(0); }
      const action = await f.propose(variant === "running" ? "delete_app" : "stop_app");
      if (variant === "deny") f.store.decide(action.id, f.actor, f.session.id, action.hash, "reject"); else f.approve(action);
      if (variant === "expiry") f.store.db.prepare("UPDATE actions SET expires_at=? WHERE id=?").run(Date.now() - 1, action.id);
      if (variant === "identity") f.setIdentity();
      if (variant === "plan") f.setPlan("other-plan");
      if (variant === "running") f.setScale(1);
      await assert.rejects(variant === "session" ? executeLifecycle(f.config, f.store, { ...f.session, id: randomUUID() }, action.id, f.signal(), { client: f.client }) : f.execute(action.id));
      assert.deepEqual(f.writes, [], variant);
    } finally { f.close(); }
  }
});
test("local removal is confirmed, source-bound, idempotent, actor-scoped and preserves audit/source", async () => {
  const f = await fixture();
  try {
    assert.equal(f.store.projectRemoval(f.actor, f.flow.id), "local");
    assert.throws(() => f.store.archiveProject("other-actor", f.session.id, f.flow.id, f.flow.profile.sourceHash), code("PROJECT_CHANGED"));
    assert.throws(() => f.store.archiveProject(f.actor, f.session.id, f.flow.id, "0".repeat(64)), code("PROJECT_CHANGED"));
    f.store.archiveProject(f.actor, f.session.id, f.flow.id, f.flow.profile.sourceHash);
    f.store.archiveProject(f.actor, f.session.id, f.flow.id, f.flow.profile.sourceHash);
    assert.deepEqual(listProjects(f.config, f.store, f.actor).projects, []); assert.equal(f.store.getProjectFlow(f.actor), null);
    assert.ok(f.store.getProjectFlow(f.actor, f.flow.id));
    await assert.rejects(openLibraryProject(f.config, f.store, f.actor, f.flow.id, f.signal()), code("PROJECT_ARCHIVED"));
  } finally { f.close(); }
});
test("a failed deployment still owns a destination; removing a running or uncertain project cannot hide resources", async () => {
  const f = await fixture();
  try {
    assert.ok(f.flow.artifact);
    const deploy = f.store.createAction(f.actor, { version: 4, operation: "deploy", scope: { teamId: f.config.teamId, app: f.app }, projectFlowId: f.flow.id,
      sourceHash: f.flow.profile.sourceHash, artifactHash: f.flow.artifact.archiveHash, selectionHash: f.flow.selectionHash, targetAppId: f.appId,
      args: { port: 3000, planId: "g2-standard" }, workload: { origin: "https://lifecycle-fixture.liara.run", path: "/", status: 200, revision: "v1" } });
    f.store.decide(deploy.id, f.actor, f.session.id, deploy.hash, "approve"); f.store.claim(deploy.id, f.actor, f.session.id, deploy.spec);
    f.store.db.prepare("UPDATE actions SET state='failed' WHERE id=?").run(deploy.id);
    assert.equal(f.store.projectRemoval(f.actor, f.flow.id), "destination");
    assert.throws(() => f.store.archiveProject(f.actor, f.session.id, f.flow.id, f.flow.profile.sourceHash), code("DESTINATION_REMOVAL_REQUIRED"));
    const stop = await f.propose("stop_app"); f.approve(stop); await f.execute(stop.id); f.setPods(0); await f.observe(stop.id);
    const remove = await f.propose("delete_app"); f.approve(remove); await f.execute(remove.id); await f.observe(remove.id);
    assert.equal(f.store.projectRemoval(f.actor, f.flow.id), "local");
    f.store.archiveProject(f.actor, f.session.id, f.flow.id, f.flow.profile.sourceHash); assert.deepEqual(listProjects(f.config, f.store, f.actor).projects, []);
  } finally { f.close(); }
});
test("removing inactive history does not cancel another project's pending decision or active selection", async () => {
  const f = await fixture();
  try {
    const next = await prepareProjectFlow(f.config, f.store, f.actor, { kind: "local", directory: "service" }, f.signal()), repo = new AgentRepository(f.store),
      run = repo.create(f.actor, randomUUID(), currentAgentContext(f.config, f.store, f.actor), "انتشار پروژهٔ دوم", { maxModelCalls: 8, maxToolCalls: 30, runTimeoutMs: 600000 }).run;
    run.state = "needs_approval"; repo.save(f.actor, run);
    f.store.archiveProject(f.actor, f.session.id, f.flow.id, f.flow.profile.sourceHash);
    assert.equal(f.store.getProjectFlow(f.actor)?.id, next.id); assert.equal(repo.get(f.actor, run.id)?.state, "needs_approval");
    assert.deepEqual(repo.get(f.actor, run.id)?.usage, run.usage);
  } finally { f.close(); }
});
