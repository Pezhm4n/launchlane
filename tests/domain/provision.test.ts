import assert from "node:assert/strict";
import { writeFileSync, rmSync, cpSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { LiaraAccountClient } from "../../src/server/liara/catalog.ts";
import { LiaraProvisionClient } from "../../src/server/liara/provision.ts";
import { proposeDestination, executeDestination, observeDestination } from "../../src/server/application/provision.ts";
import { sealCredential } from "../../src/server/connections/credentials.ts";
import { AppError } from "../../src/server/errors.ts";
import { Store } from "../../src/server/persistence/store.ts";
import { decodeAction } from "../../src/contracts/client-decode.ts";
import { fingerprint, parseActionSpec } from "../../src/server/policy/action.ts";
import { LiaraReadClient } from "../../src/server/liara/client.ts";
import { proposeWorkloadDeployment } from "../../src/server/application/deployment.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";

const team = "a".repeat(24), account = "b".repeat(24), network = "c".repeat(24), createdId = "d".repeat(24), app = "new-agent-app";
const signal = () => AbortSignal.timeout(3000);
const code = (expected: string) => (error: unknown) => error instanceof AppError && error.code === expected;
async function fixture(runtime: "node" | "python" = "node") {
  const f = await agentFixture(), config = { ...f.config, teamId: team, apps: [app], liaraToken: "synthetic-private-provision-key",
    enableLiveLiara: true, enableMutations: true };
  let flow = f.flow;
  if (runtime === "python") {
    cpSync(resolve("tests/fixtures/python-service"), join(f.workspace, "python"), { recursive: true });
    flow = await prepareProjectFlow(config, f.store, f.session.actorId, { kind: "local", directory: "python" }, signal());
  }
  let store = f.store, writes = 0, exists = false, price = 500, balance = 10000, hasNetwork = true, lost = false,
    returnedId = createdId, observedId = createdId, afterSend: (() => void) | null = null;
  store.saveConnection(f.session.actorId, { source: "token", ciphertext: sealCredential(config.liaraToken, config.sessionSecret, f.session.actorId, "liara"),
    view: { provider: "liara", status: "connected", identityId: account, displayName: "آزمون", login: "test@example.test", teamId: team,
      teamName: "آزمون", checkedAt: Date.now(), apps: [], selectedApp: null } });
  const read = new LiaraAccountClient(config, account, async (url, init) => {
    assert.equal(init.method, "GET"); assert.equal(new URL(url).searchParams.get("teamID"), team);
    const path = new URL(url).pathname;
    if (path === "/v1/me") return Response.json({ user: { _id: account }, team: { _id: team, balance }, plans: {
      projects: { starter: { available: true, region: "iran", price } }, projectBundlePlans: { starter: { basic: { available: true, price: 40 } } },
    } });
    if (path === "/v1/networks") return Response.json({ networks: hasNetwork ? [{ _id: network, name: "test-network" }] : [] });
    assert.equal(path, `/v1/projects/${app}`);
    return exists ? Response.json({ project: { _id: observedId, project_id: app, type: runtime, planID: "starter", bundlePlanID: "basic",
      network: { _id: network }, readOnlyRootFilesystem: true, envs: [{ key: "DO_NOT_EXPORT", value: "secret-not-in-readback" }] } }) : new Response(null, { status: 404 });
  });
  const write = new LiaraProvisionClient(config, async (url, init) => {
    writes++;
    assert.equal(new URL(url).pathname, "/v1/projects"); assert.equal(new URL(url).searchParams.get("teamID"), team);
    assert.equal(init.method, "POST"); assert.equal(init.redirect, "error");
    const current = store.getAction(store.getProjectFlow(f.session.actorId)?.actionId ?? "", f.session.actorId);
    assert.equal(current.provision?.stage, "request_started"); assert.ok(current.attemptId);
    assert.deepEqual(JSON.parse(String(init.body)), { name: app, planID: "starter", bundlePlanID: "basic", platform: runtime, network, readOnlyRootFilesystem: true });
    exists = true;
    afterSend?.();
    if (lost) throw new TypeError("lost response with private text must not escape", {
      cause: Object.assign(new Error("private connect details"), { code: "UND_ERR_CONNECT_TIMEOUT" }),
    });
    return Response.json({ projectID: returnedId });
  });
  const deps = { read, write }, action = await proposeDestination(config, store, f.session.actorId,
    { flowId: flow.id, app, planId: "starter", bundleId: "basic", networkId: network }, signal(), deps);
  return { ...f, flow, config, action, deps,
    get store() { return store; }, get writes() { return writes; },
    approve() { return store.decide(action.id, f.session.actorId, f.session.id, action.hash, "approve"); },
    set(v: { exists?: boolean; price?: number; balance?: number; hasNetwork?: boolean; lost?: boolean; returnedId?: string; observedId?: string; afterSend?: () => void }) {
      exists = v.exists ?? exists; price = v.price ?? price; balance = v.balance ?? balance; hasNetwork = v.hasNetwork ?? hasNetwork; lost = v.lost ?? lost;
      returnedId = v.returnedId ?? returnedId; observedId = v.observedId ?? observedId; afterSend = v.afterSend ?? afterSend;
    },
    reopen() { store.close(); store = new Store(join(config.stateDir, "state.sqlite")); store.recoverInterrupted(); },
    close() {
      if (store.db.isOpen) store.close();
      const target = resolve(f.directory);
      assert.ok(target.startsWith(join(tmpdir(), "launchlane-agent-")));
      rmSync(target, { recursive: true, force: true });
    },
  };
}

test("an approved destination pins the real returned internal ID and exact configuration before selection; it is not a deployment", async () => {
  const f = await fixture();
  try {
    assert.equal(f.writes, 0); assert.equal(f.action.spec.version, 8); assert.equal(f.action.spec.operation, "create_app");
    assert.deepEqual(decodeAction(f.action).spec, parseActionSpec(f.action.spec));
    f.approve();
    const sent = await executeDestination(f.config, f.store, f.session, f.action.id, signal(), f.deps);
    assert.equal(sent.state, "observing"); assert.equal(sent.provision?.appId, createdId); assert.equal(sent.remoteId, createdId);
    assert.equal(f.store.getConnection(f.session.actorId, "liara")?.view.selectedApp, null);
    const checked = await observeDestination(f.config, f.store, f.session, f.action.id, signal(), f.deps);
    assert.equal(checked.state, "succeeded"); assert.equal(checked.provision?.observation?.code, "DESTINATION_VERIFIED");
    const selected = f.store.getConnection(f.session.actorId, "liara")?.view;
    assert.equal(selected?.selectedApp, app); assert.equal(selected?.apps[0]?.id, createdId);
    assert.ok(!JSON.stringify(checked).includes("secret-not-in-readback")); assert.equal(f.writes, 1);
    await assert.rejects(executeDestination(f.config, f.store, f.session, f.action.id, signal(), f.deps), code("ACTION_CONFLICT"));
    assert.equal(f.writes, 1);
  } finally { f.close(); }
});

test("changed price/network, existing name, expiry, disabled writes and changed source stop before a create attempt", async () => {
  for (const kind of ["price", "credit", "network", "exists", "expiry", "gate", "source"] as const) {
    const f = await fixture();
    try {
      f.approve();
      if (kind === "price") f.set({ price: 501 });
      if (kind === "credit") f.set({ balance: 0 });
      if (kind === "network") f.set({ hasNetwork: false });
      if (kind === "exists") f.set({ exists: true });
      if (kind === "expiry") f.store.db.prepare("UPDATE actions SET expires_at=0 WHERE id=?").run(f.action.id);
      if (kind === "source") writeFileSync(join(f.project, "server.mjs"), "// source changed after approval\n");
      await assert.rejects(executeDestination(kind === "gate" ? { ...f.config, enableMutations: false } : f.config,
        f.store, f.session, f.action.id, signal(), f.deps), AppError);
      assert.equal(f.writes, 0, kind); assert.equal(f.store.getAction(f.action.id, f.session.actorId).attemptId, null, kind);
    } finally { f.close(); }
  }
});

test("a preflight read retry cannot consume the create allowance and claim an unsendable attempt", async () => {
  const f = await fixture();
  try {
    f.approve();
    let retried = false;
    const send = f.deps.read.send, budget = new RunBudget({ ...f.config, maxToolCalls: 4 });
    const read = new LiaraAccountClient(f.config, account, async (url, init) => {
      if (!retried && new URL(url).pathname === "/v1/networks") {
        retried = true;
        throw new TypeError("connect failed", { cause: { code: "UND_ERR_CONNECT_TIMEOUT" } });
      }
      return send(url, init);
    });
    await assert.rejects(executeDestination(f.config, f.store, f.session, f.action.id, signal(), { ...f.deps, read, budget }), code("BUDGET_EXHAUSTED"));
    assert.equal(retried, true);
    assert.equal(budget.toolCalls, 4);
    assert.equal(f.writes, 0);
    assert.equal(f.store.getAction(f.action.id, f.session.actorId).attemptId, null);
    assert.equal(f.store.getAction(f.action.id, f.session.actorId).state, "approved");
  } finally { f.close(); }
});

test("publication after creation binds the returned app ID and the same approved source artifact", async () => {
  const f = await fixture();
  try {
    f.approve();
    await executeDestination(f.config, f.store, f.session, f.action.id, signal(), f.deps);
    await observeDestination(f.config, f.store, f.session, f.action.id, signal(), f.deps);
    const origin = `https://${app}.example.com`;
    f.store.setProbeOrigin(f.session.actorId, { teamId: team, app }, origin);
    const read = new LiaraReadClient(f.config, async () => Response.json({ project: {
      _id: createdId, project_id: app, type: "node", status: "ACTIVE", planID: "starter", envs: [],
    } }));
    const publication = await proposeWorkloadDeployment(f.config, f.store, f.session.actorId, {
      flowId: f.flow.id, app, port: null, workload: { origin, path: "/", status: 200, assertion: { kind: "text", contains: "invoice service" } },
    }, signal(), { read });
    assert.equal(publication.spec.version, 7);
    if (publication.spec.version !== 7 || f.action.spec.version !== 8) throw new Error("wrong fixture");
    assert.equal(publication.spec.targetAppId, createdId);
    assert.equal(publication.spec.artifactHash, f.action.spec.artifactHash);
    assert.equal(publication.spec.accountId, f.action.spec.accountId);
    assert.equal(publication.state, "awaiting_approval");
    assert.equal(f.writes, 1);
  } finally { f.close(); }
});

test("lost create response cannot adopt an app by name or replay, including after process recovery", async () => {
  const f = await fixture();
  try {
    f.approve(); f.set({ lost: true });
    await assert.rejects(executeDestination(f.config, f.store, f.session, f.action.id, signal(), f.deps), code("UPSTREAM_UNCERTAIN"));
    assert.equal(f.store.getAction(f.action.id, f.session.actorId).provision?.stage, "request_started");
    f.reopen();
    const result = await observeDestination(f.config, f.store, f.session, f.action.id, signal(), f.deps);
    assert.equal(result.state, "uncertain"); assert.equal(result.remoteId, null); assert.equal(result.provision?.appId, null);
    assert.equal(f.store.getConnection(f.session.actorId, "liara")?.view.selectedApp, null);
    await assert.rejects(executeDestination(f.config, f.store, f.session, f.action.id, signal(), f.deps), code("ACTION_CONFLICT"));
    assert.equal(f.writes, 1);
  } finally { f.close(); }
});

test("a received ID survives a later storage failure and readback recovers it without another create", async () => {
  const f = await fixture();
  try {
    f.approve();
    f.store.db.exec("CREATE TRIGGER block_receipt BEFORE UPDATE ON actions WHEN NEW.remote_id IS NOT NULL BEGIN SELECT RAISE(ABORT,'receipt storage unavailable'); END");
    await assert.rejects(executeDestination(f.config, f.store, f.session, f.action.id, signal(), f.deps), code("UPSTREAM_UNCERTAIN"));
    const uncertain = f.store.getAction(f.action.id, f.session.actorId);
    assert.equal(uncertain.state, "uncertain"); assert.equal(uncertain.provision?.appId, createdId);
    f.store.db.exec("DROP TRIGGER block_receipt"); f.reopen();
    const checked = await observeDestination(f.config, f.store, f.session, f.action.id, signal(), f.deps);
    assert.equal(checked.state, "succeeded"); assert.equal(checked.remoteId, createdId); assert.equal(f.writes, 1);
  } finally { f.close(); }
});

test("same-name replacement and a changed user selection cannot silently become the new destination", async () => {
  for (const replace of [true, false]) {
    const f = await fixture();
    try {
      f.approve();
      if (replace) f.set({ observedId: "e".repeat(24) });
      else f.set({ afterSend() {
        const connection = f.store.getConnection(f.session.actorId, "liara"); assert.ok(connection);
        f.store.saveConnection(f.session.actorId, { ...connection, view: { ...connection.view,
          apps: [{ id: "f".repeat(24), name: "my-existing-app", platform: "node" }], selectedApp: "my-existing-app" } });
      } });
      await executeDestination(f.config, f.store, f.session, f.action.id, signal(), f.deps);
      const result = await observeDestination(f.config, f.store, f.session, f.action.id, signal(), f.deps);
      assert.equal(result.state, replace ? "failed" : "succeeded");
      assert.equal(f.store.getConnection(f.session.actorId, "liara")?.view.selectedApp, replace ? null : "my-existing-app");
      assert.equal(f.writes, 1);
    } finally { f.close(); }
  }
});

test("duplicate execution has one create owner and approval binds cost, network, source and account", async () => {
  const f = await fixture();
  try {
    assert.equal(f.action.spec.version, 8);
    if (f.action.spec.version !== 8) throw new Error("wrong fixture");
    for (const spec of [{ ...f.action.spec, networkId: "e".repeat(24) },
      { ...f.action.spec, cost: { ...f.action.spec.cost, hourlyHundredthsToman: 1 } },
      { ...f.action.spec, accountId: "f".repeat(24) }, { ...f.action.spec, sourceHash: "f".repeat(64) }])
      assert.notEqual(fingerprint(spec), fingerprint(f.action.spec));
    f.approve();
    const executions = await Promise.allSettled([1, 2].map(() => executeDestination(f.config, f.store, f.session, f.action.id, signal(), f.deps)));
    assert.equal(executions.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(f.writes, 1); assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM attempts WHERE action_id=?").get(f.action.id)?.n, 1);
  } finally { f.close(); }
});

test("Python destination uses v12 with identity-bound readback and one create, preserving Node v8 history", async () => {
  const f = await fixture("python");
  try {
    assert.equal(f.action.spec.version, 12);
    assert.deepEqual(decodeAction(f.action).spec, parseActionSpec(f.action.spec));
    f.approve();
    await executeDestination(f.config, f.store, f.session, f.action.id, signal(), f.deps);
    const checked = await observeDestination(f.config, f.store, f.session, f.action.id, signal(), f.deps);
    assert.equal(checked.state, "succeeded");
    assert.equal(f.store.getConnection(f.session.actorId, "liara")?.view.apps[0]?.platform, "python");
    await assert.rejects(executeDestination(f.config, f.store, f.session, f.action.id, signal(), f.deps), code("ACTION_CONFLICT"));
    assert.equal(f.writes, 1);
  } finally { f.close(); }
});
