import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import type { LifecycleSpec } from "../../src/contracts/project-lifecycle.ts";
import { decodeAction } from "../../src/contracts/client-decode.ts";
import { proposeLifecycle, executeLifecycle, observeLifecycle } from "../../src/server/application/project-lifecycle.ts";
import { connectedLiaraConfig } from "../../src/server/connections/liara.ts";
import { sealCredential } from "../../src/server/connections/credentials.ts";
import { LiaraLifecycleClient } from "../../src/server/liara/lifecycle.ts";
import { LiaraAccountClient } from "../../src/server/liara/catalog.ts";
import { LiaraReadClient } from "../../src/server/liara/client.ts";
import { AppError } from "../../src/server/errors.ts";
import { parseActionSpec } from "../../src/server/policy/action.ts";
import { agentFixture } from "../helpers/agent-fixture.ts";

const code = (expected: string) => (error: unknown) => error instanceof AppError && error.code === expected;
const signal = () => AbortSignal.timeout(5000);
async function fixture() {
  const f = await agentFixture(), actor = f.session.actorId, team = "a".repeat(24), account = "b".repeat(24), app = "activation-fixture", appId = "c".repeat(24);
  const config = { ...f.config, teamId: team, apps: [app], enableLiveLiara: true, enableMutations: true };
  f.store.saveConnection(actor, { source: "token", ciphertext: sealCredential("synthetic-activation-credential", config.sessionSecret, actor, "liara"), view: {
    provider: "liara", status: "connected", identityId: account, teamId: team, teamName: "test", displayName: "test", login: "test@example.test", checkedAt: Date.now(), selectedApp: app, apps: [{ id: appId, name: app, platform: "node" }] } });
  const state = { scale: 0, defaultSubdomain: false, defaultSubdomainExpired: false, present: true, identity: appId, plan: "small-g2", bundle: "basic", price: 1041.66, balance: 100000, lost: false, status: 200,
    currentRelease: "e".repeat(24), releaseState: "READY" };
  const writes: { path: string; body: unknown }[] = [];
  const scoped = connectedLiaraConfig(config, f.store, actor, app);
  const client = new LiaraLifecycleClient(scoped, async (url, options) => {
    const target = new URL(url); assert.equal(target.origin, "https://api.liara.ir"); assert.equal(target.searchParams.get("teamID"), team);
    if (options.method === "POST") {
      const body: unknown = options.body === undefined ? null : JSON.parse(String(options.body)); writes.push({ path: target.pathname, body });
      if (target.pathname === `/v1/projects/${appId}/default-subdomain/enable`) { assert.equal(body, null); state.defaultSubdomain = true; }
      else { assert.equal(target.pathname, `/v1/projects/${app}/actions/scale`); assert.ok(body && typeof body === "object" && "scale" in body && (body.scale === 0 || body.scale === 1)); state.scale = body.scale; }
      if (state.lost) throw Error("lost-after-accepted"); return new Response();
    }
    if (options.method === "DELETE") { writes.push({ path: target.pathname, body: null }); assert.equal(target.pathname, `/v1/projects/${app}`); state.present = false; return new Response(null, { status: 204 }); }
    if (state.status !== 200) return new Response(null, { status: state.status });
    if (target.pathname.endsWith("/applets")) return Response.json({ applets: state.scale === 0 ? [] : [{ state: "RUNNING" }] });
    return state.present ? Response.json({ project: { _id: state.identity, project_id: app, planID: state.plan, bundlePlanID: state.bundle, scale: state.scale, defaultSubdomain: state.defaultSubdomain, defaultSubdomainExpired: state.defaultSubdomainExpired } }) : new Response(null, { status: 404 });
  });
  const catalog = new LiaraAccountClient(scoped, account, async (url, options) => {
    assert.equal(options.method, "GET"); assert.equal(new URL(url).pathname, "/v1/me");
    return Response.json({ user: { _id: account }, team: { _id: team, balance: state.balance }, plans: {
      projects: { "small-g2": { available: true, price: state.price, region: "iran" } }, projectBundlePlans: { "small-g2": { basic: { available: true, price: 0 } } } } });
  });
  const read = new LiaraReadClient(scoped, async (url, options) => {
    assert.equal(options.method, "GET"); assert.equal(new URL(url).pathname, `/v1/projects/${app}/releases`);
    return Response.json({ total: 1, currentRelease: state.currentRelease, releases: [{ _id: "e".repeat(24), state: state.releaseState, port: 3000 }] });
  });
  const deps = { client, account: catalog, read };
  const propose = (operation: LifecycleSpec["operation"], requestKey = randomUUID()) => proposeLifecycle(config, f.store, f.session, f.flow.id, operation, requestKey, signal(), deps);
  const approve = (action: Awaited<ReturnType<typeof propose>>) => f.store.decide(action.id, actor, f.session.id, action.hash, "approve");
  const execute = (id: string) => executeLifecycle(config, f.store, f.session, id, signal(), deps);
  const observe = (id: string) => observeLifecycle(config, f.store, f.session, id, signal(), deps);
  const publication = () => {
    assert.ok(f.flow.artifact);
    const action = f.store.createAction(actor, { version: 7, operation: "deploy", scope: { teamId: team, app }, sourceHash: f.flow.profile.sourceHash,
      artifactHash: f.flow.artifact.archiveHash, projectFlowId: f.flow.id, selectionHash: f.flow.selectionHash, targetAppId: appId, accountId: account, nodeVersion: "22",
      args: { port: 3000, planId: state.plan }, workload: { origin: `https://${app}.liara.run`, path: "/", status: 200, assertion: { kind: "text", contains: "invoice service" } } });
    approve(action); f.store.claim(action.id, actor, f.session.id, action.spec);
    f.store.deploymentStep(action.id, actor, "upload_started"); f.store.deploymentStep(action.id, actor, "uploaded", "source-fixture");
    f.store.deploymentStep(action.id, actor, "release_started", "source-fixture");
    return f.store.receipt(action.id, actor, "e".repeat(24));
  };
  return { ...f, config, actor, state, deps, writes, propose, approve, execute, observe, publication };
}

test("existing app public origin and paid start use separate exact approvals and journals; readback proves configuration only", async () => {
  const f = await fixture();
  try {
    const key = randomUUID(), domain = await f.propose("enable_default_subdomain", key);
    assert.equal(domain.spec.version, 24); assert.deepEqual(decodeAction(domain), domain);
    assert.equal((await f.propose("enable_default_subdomain", key)).id, domain.id);
    await assert.rejects(f.execute(domain.id), code("ACTION_CONFLICT")); assert.deepEqual(f.writes, []);
    f.approve(domain); assert.equal((await f.execute(domain.id)).state, "observing");
    const configured = await f.observe(domain.id); assert.equal(configured.state, "succeeded"); assert.equal(configured.lifecycle?.verification, "configuration");
    await assert.rejects(f.execute(domain.id), code("ACTION_CONFLICT"));
    const start = await f.propose("start_app"); assert.equal(start.spec.version, 24);
    assert.ok(start.spec.version === 24 && start.spec.cost?.hourlyHundredthsToman === 104166);
    f.approve(start); assert.equal((await f.execute(start.id)).state, "observing");
    const running = await f.observe(start.id); assert.equal(running.state, "succeeded"); assert.equal(running.lifecycle?.verification, "configuration");
    assert.equal(running.deployment, undefined, "desired scale is never a deployment/workload receipt");
    assert.equal(f.writes.length, 2); assert.equal(f.store.db.prepare("SELECT count(*) n FROM attempts").get()?.n, 2);
    await assert.rejects(f.propose("start_app"), code("LIFECYCLE_ALREADY_CONFIGURED"));
  } finally { f.close(); }
});

test("changed identity, plan, bundle, scale, domain, price and credit fail before the paid write or approval claim", async () => {
  for (const variant of ["identity", "plan", "bundle", "scale", "domain", "price", "credit"] as const) {
    const f = await fixture();
    try {
      const start = await f.propose("start_app"); f.approve(start);
      if (variant === "identity") f.state.identity = "d".repeat(24);
      if (variant === "plan") f.state.plan = "other-plan";
      if (variant === "bundle") f.state.bundle = "other-bundle";
      if (variant === "scale") f.state.scale = 1;
      if (variant === "domain") f.state.defaultSubdomain = true;
      if (variant === "price") f.state.price++;
      if (variant === "credit") f.state.balance = 0;
      await assert.rejects(f.execute(start.id), code(variant === "price" ? "PLAN_CHANGED" : variant === "credit" ? "INSUFFICIENT_CREDIT" : "LIFECYCLE_TARGET_CHANGED"));
      assert.deepEqual(f.writes, [], variant); assert.equal(f.store.getAction(start.id, f.actor).attemptId, null);
    } finally { f.close(); }
  }
});

test("lost accepted writes reconcile only by reads; identity/auth/provider failures and changed plan cannot verify them", async () => {
  for (const operation of ["start_app", "enable_default_subdomain"] as const) {
    const f = await fixture();
    try {
      const action = await f.propose(operation); f.approve(action); f.state.lost = true;
      assert.equal((await f.execute(action.id)).state, "uncertain"); f.store.recoverInterrupted();
      for (const status of [401, 429, 500]) { f.state.status = status; assert.equal((await f.observe(action.id)).state, "uncertain"); }
      f.state.status = 200; f.state.plan = "different"; assert.equal((await f.observe(action.id)).state, "uncertain");
      f.state.plan = "small-g2"; assert.equal((await f.observe(action.id)).state, "succeeded");
      await assert.rejects(f.execute(action.id), code("ACTION_CONFLICT")); assert.equal(f.writes.length, 1);
    } finally { f.close(); }
  }
});

test("rejection, action expiry, stale quote, wrong session and generic receipts cannot authorize or fake activation", async () => {
  for (const variant of ["reject", "expiry", "session", "quote"] as const) {
    const f = await fixture();
    try {
      let action = await f.propose("start_app");
      if (variant === "quote") {
        assert.ok(action.spec.version === 24 && action.spec.cost);
        f.store.decide(action.id, f.actor, f.session.id, action.hash, "reject");
        action = f.store.createAction(f.actor, { ...action.spec, requestKey: randomUUID(), cost: { ...action.spec.cost, observedAt: Date.now() - 20000, expiresAt: Date.now() - 10000 } });
        assert.throws(() => f.approve(action), code("CATALOG_STALE"));
      } else {
        if (variant === "reject") f.store.decide(action.id, f.actor, f.session.id, action.hash, "reject"); else f.approve(action);
        if (variant === "expiry") f.store.db.prepare("UPDATE actions SET expires_at=? WHERE id=?").run(Date.now() - 1, action.id);
        await assert.rejects(variant === "session" ? executeLifecycle(f.config, f.store, { ...f.session, id: randomUUID() }, action.id, signal(), f.deps) : f.execute(action.id));
      }
      assert.deepEqual(f.writes, []);
      assert.throws(() => f.store.receipt(action.id, f.actor, "invented"), code("LIFECYCLE_RECEIPT_REQUIRED"));
      assert.throws(() => f.store.finishObservation(action.id, f.actor, "healthy"), code("LIFECYCLE_OBSERVATION_REQUIRED"));
    } finally { f.close(); }
  }
});

test("v14 canonical history never gains activation semantics and v24 rejects missing cost or unknown effects", async () => {
  const f = await fixture();
  try {
    const action = await f.propose("start_app"); assert.ok(action.spec.version === 24);
    for (const spec of [{ ...action.spec, cost: null }, { ...action.spec, operation: "resize_app" }, { ...action.spec, version: 14 }, { ...action.spec, expected: { ...action.spec.expected, scale: 2 } }])
      assert.throws(() => parseActionSpec(spec));
    const { bundleId: _bundle, expected: _expected, cost: _cost, ...rest } = action.spec;
    const old = { ...rest, version: 14, operation: "stop_app" };
    assert.deepEqual(parseActionSpec(old), old);
  } finally { f.close(); }
});

test("only an exact READY/current publication may enable its missing origin while awaiting workload verification", async () => {
  const f = await fixture();
  try {
    const publication = f.publication(), domain = await f.propose("enable_default_subdomain");
    assert.ok(domain.spec.version === 24 && domain.spec.publication);
    assert.deepEqual(domain.spec.publication, { actionId: publication.id, releaseId: publication.remoteId, artifactHash: f.flow.artifact?.archiveHash });
    assert.deepEqual(decodeAction(domain), domain);
    await assert.rejects(f.propose("start_app"), code("ACTION_CONFLICT"));
    f.approve(domain); await f.execute(domain.id); assert.equal((await f.observe(domain.id)).state, "succeeded");
    assert.equal(f.store.getAction(publication.id, f.actor).state, "observing", "domain configuration cannot invent a successful workload receipt");
    assert.equal(f.writes.length, 1);
  } finally { f.close(); }
});

test("publication replacement, pending builds, unknown effects and forged artifact/release dependencies keep the origin private", async () => {
  for (const variant of ["building", "replacement", "before-send", "artifact", "release", "uncertain"] as const) {
    const f = await fixture();
    try {
      const publication = f.publication();
      if (variant === "building") f.state.releaseState = "BUILDING";
      if (variant === "replacement") f.state.currentRelease = "f".repeat(24);
      if (variant === "building" || variant === "replacement") await assert.rejects(f.propose("enable_default_subdomain"), code("PUBLICATION_NOT_CURRENT"));
      else {
        const domain = await f.propose("enable_default_subdomain"), spec = domain.spec; assert.ok(spec.version === 24 && spec.publication);
        if (variant === "artifact" || variant === "release") {
          const proof = { ...spec.publication, ...(variant === "artifact" ? { artifactHash: "0".repeat(64) } : { releaseId: "f".repeat(24) }) };
          assert.throws(() => f.store.createAction(f.actor, { ...spec, publication: proof, requestKey: randomUUID() }), code("PUBLICATION_DEPENDENCY_CHANGED"));
        } else {
          f.approve(domain);
          if (variant === "before-send") f.state.currentRelease = "f".repeat(24);
          else f.store.db.prepare("UPDATE actions SET state='uncertain' WHERE id=?").run(publication.id);
          await assert.rejects(f.execute(domain.id), code(variant === "before-send" ? "PUBLICATION_NOT_CURRENT" : "PUBLICATION_DEPENDENCY_CHANGED"));
        }
      }
      assert.deepEqual(f.writes, [], variant);
    } finally { f.close(); }
  }
});

test("an expired or newly expired default domain never starts a settings write", async () => {
  const f = await fixture();
  try {
    f.state.defaultSubdomainExpired = true;
    await assert.rejects(f.propose("enable_default_subdomain"), code("DEFAULT_SUBDOMAIN_EXPIRED"));
    f.state.defaultSubdomainExpired = false;
    const action = await f.propose("enable_default_subdomain"); f.approve(action); f.state.defaultSubdomainExpired = true;
    await assert.rejects(f.execute(action.id), code("DEFAULT_SUBDOMAIN_EXPIRED"));
    assert.deepEqual(f.writes, []); assert.equal(f.store.getAction(action.id, f.actor).attemptId, null);
  } finally { f.close(); }
});

test("a fresh explicit stop/delete compensates an unknown domain setting and only verified absence closes its old uncertainty", async () => {
  const f = await fixture();
  try {
    const domain = await f.propose("enable_default_subdomain"); f.approve(domain); f.state.lost = true;
    assert.equal((await f.execute(domain.id)).state, "uncertain"); f.state.lost = false;
    const stop = await f.propose("stop_app"); f.approve(stop); await f.execute(stop.id);
    assert.equal((await f.observe(stop.id)).state, "succeeded");
    assert.equal(f.store.getAction(domain.id, f.actor).state, "uncertain", "stopping is never evidence about the earlier URL request");
    const remove = await f.propose("delete_app"); f.approve(remove); await f.execute(remove.id);
    f.state.status = 500; assert.equal((await f.observe(remove.id)).state, "uncertain");
    assert.equal(f.store.getAction(domain.id, f.actor).state, "uncertain");
    f.state.status = 200; assert.equal((await f.observe(remove.id)).state, "succeeded");
    const superseded = f.store.getAction(domain.id, f.actor); assert.equal(superseded.state, "cancelled"); assert.equal(superseded.errorCode, "DESTINATION_REMOVED");
    assert.equal(superseded.lifecycle?.stage, "request_started"); assert.ok(superseded.attemptId, "the original consumed attempt is retained");
    await assert.rejects(f.execute(domain.id), code("ACTION_CONFLICT")); assert.equal(f.writes.length, 3);
    assert.ok(f.store.db.prepare("SELECT event FROM audit_events WHERE action_id=? AND event='lifecycle_superseded_by_verified_delete'").get(domain.id));
  } finally { f.close(); }
});

test("cleanup cannot bypass an unknown deployment or an actively executing setting", async () => {
  for (const variant of ["deployment", "active-setting"] as const) {
    const f = await fixture();
    try {
      if (variant === "deployment") { const action = f.publication(); f.store.db.prepare("UPDATE actions SET state='uncertain' WHERE id=?").run(action.id); }
      else { const action = await f.propose("enable_default_subdomain"); f.approve(action); f.store.claim(action.id, f.actor, f.session.id, action.spec); }
      await assert.rejects(f.propose("stop_app"), code(variant === "active-setting" ? "ACTION_CONFLICT" : "UNRESOLVED_EFFECT")); assert.deepEqual(f.writes, []);
    } finally { f.close(); }
  }
});
