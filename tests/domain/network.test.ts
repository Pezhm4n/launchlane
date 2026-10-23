import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { LiaraAccountClient } from "../../src/server/liara/catalog.ts";
import { LiaraNetworkClient } from "../../src/server/liara/network.ts";
import { proposeNetwork, executeNetwork, observeNetwork } from "../../src/server/application/network.ts";
import { sealCredential } from "../../src/server/connections/credentials.ts";
import { AppError } from "../../src/server/errors.ts";
import { decodeAction } from "../../src/contracts/client-decode.ts";
import { fingerprint, parseActionSpec } from "../../src/server/policy/action.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";
import { createAgentRun, decideAgentNetwork, driveAgentRun, resumeAgentNetwork } from "../../src/server/agent/runs.ts";
import { AgentRepository } from "../../src/server/agent/store.ts";
import type { ModelPort } from "../../src/server/agent/model.ts";

const team = "a".repeat(24), account = "b".repeat(24), networkId = "c".repeat(24), app = "new-agent-app";
const signal = () => AbortSignal.timeout(5000);
const code = (expected: string) => (error: unknown) => error instanceof AppError && error.code === expected;
async function fixture() {
  const f = await agentFixture(), config = { ...f.config, teamId: team, apps: [app], liaraToken: "synthetic-private-network-key",
    enableLiveLiara: true, enableMutations: true };
  let writes = 0, exists = false, lost = false, visible = true, readCalls = 0, readRetries = false, networkName = "", status = 201;
  f.store.saveConnection(f.session.actorId, { source: "token", ciphertext: sealCredential(config.liaraToken, config.sessionSecret, f.session.actorId, "liara"),
    view: { provider: "liara", status: "connected", identityId: account, displayName: "آزمون", login: "test@example.test", teamId: team,
      teamName: "آزمون", checkedAt: Date.now(), apps: [], selectedApp: null } });
  const read = new LiaraAccountClient(config, account, async (url, init) => {
    readCalls++;
    assert.equal(init.method, "GET"); assert.equal(new URL(url).searchParams.get("teamID"), team);
    if (readRetries && readCalls % 2 === 1) return new Response(null, { status: 503, headers: { "Retry-After": "0" } });
    if (new URL(url).pathname === "/v1/me") return Response.json({ user: { _id: account }, team: { _id: team } });
    assert.equal(new URL(url).pathname, "/v1/networks");
    return Response.json({ networks: exists && visible ? [{ _id: networkId, name: networkName || "existing-network" }] : [] });
  });
  const write = new LiaraNetworkClient(config, async (url, init) => {
    writes++;
    assert.equal(new URL(url).pathname, "/v1/networks"); assert.equal(new URL(url).searchParams.get("teamID"), team);
    assert.equal(init.method, "POST"); assert.equal(init.redirect, "error");
    const action = f.store.getAction(f.store.getProjectFlow(f.session.actorId)?.actionId ?? "", f.session.actorId);
    assert.equal(action.network?.stage, "request_started"); assert.ok(action.attemptId);
    assert.equal(action.spec.version, 13);
    if (action.spec.version !== 13) throw Error("wrong spec");
    assert.deepEqual(JSON.parse(String(init.body)), { networkName: action.spec.networkName });
    networkName = action.spec.networkName; exists = true;
    if (lost) throw new TypeError("response lost after a committed request");
    return new Response(null, { status });
  });
  return { ...f, config, deps: { read, write }, get writes() { return writes; },
    set(values: { exists?: boolean; lost?: boolean; visible?: boolean; readRetries?: boolean; status?: number }) {
      exists = values.exists ?? exists; lost = values.lost ?? lost; visible = values.visible ?? visible;
      readRetries = values.readRetries ?? readRetries; readCalls = 0; status = values.status ?? status;
    },
    propose() { return proposeNetwork(config, f.store, f.session.actorId, { flowId: f.flow.id, app }, signal(), { read }); },
    approve(action: import("../../src/contracts/domain.ts").Action, ack = true) {
      return f.store.decide(action.id, f.session.actorId, f.session.id, action.hash, "approve", Date.now(), undefined, { acknowledgeUnknownCost: ack });
    },
  };
}

test("network requires explicit unknown-cost acknowledgment and independent identity readback; acceptance is not publication", async () => {
  const f = await fixture();
  try {
    const action = await f.propose();
    assert.equal(action.spec.version, 13);
    if (action.spec.version !== 13) throw Error("wrong spec");
    assert.deepEqual(action.spec.cost, { state: "unknown", amount: null, currency: null, period: null });
    assert.deepEqual(decodeAction(action).spec, parseActionSpec(action.spec));
    assert.equal(fingerprint(parseActionSpec(action.spec)), fingerprint(action.spec));
    assert.throws(() => f.approve(action, false), code("UNKNOWN_COST_ACK_REQUIRED"));
    assert.equal(f.store.getAction(action.id, f.session.actorId).state, "awaiting_approval");
    f.approve(action);
    assert.throws(() => f.approve(action), code("ACTION_CONFLICT"));
    const sent = await executeNetwork(f.config, f.store, f.session, action.id, signal(), f.deps);
    assert.equal(sent.state, "observing"); assert.equal(sent.remoteId, null); assert.equal(sent.network?.stage, "accepted");
    assert.throws(() => f.store.finishObservation(action.id, f.session.actorId, "healthy"), code("NETWORK_OBSERVATION_REQUIRED"));
    const checked = await observeNetwork(f.config, f.store, f.session, action.id, signal(), f.deps);
    assert.equal(checked.state, "succeeded"); assert.equal(checked.remoteId, networkId); assert.equal(checked.network?.networkId, networkId);
    assert.equal(f.store.getConnection(f.session.actorId, "liara")?.view.selectedApp, null);
    assert.equal(f.writes, 1);
    await assert.rejects(executeNetwork(f.config, f.store, f.session, action.id, signal(), f.deps), code("ACTION_CONFLICT"));
    await assert.rejects(f.propose(), code("NETWORK_ALREADY_AVAILABLE"));
    assert.equal(f.writes, 1);
  } finally { f.close(); }
});

test("lost network response cannot become success by name, reset into write-ready, or allow a second app to create another network", async () => {
  const f = await fixture();
  try {
    const action = await f.propose(); f.approve(action); f.set({ lost: true });
    await assert.rejects(executeNetwork(f.config, f.store, f.session, action.id, signal(), f.deps), code("UPSTREAM_UNCERTAIN"));
    f.store.recoverInterrupted();
    const checked = await observeNetwork(f.config, f.store, f.session, action.id, signal(), f.deps);
    assert.equal(checked.state, "uncertain"); assert.equal(checked.remoteId, null); assert.equal(checked.network?.stage, "request_started");
    const spec = action.spec;
    assert.throws(() => f.store.createAction(f.session.actorId, { ...spec, scope: { teamId: team, app: "another-app" } }), code("UNRESOLVED_EFFECT"));
    await assert.rejects(executeNetwork(f.config, f.store, f.session, action.id, signal(), f.deps), code("ACTION_CONFLICT"));
    assert.equal(f.writes, 1);
  } finally { f.close(); }
});

test("accepted network not yet visible remains uncertain and later reconciles the same request without another write", async () => {
  const f = await fixture();
  try {
    const action = await f.propose(); f.approve(action); f.set({ visible: false });
    await executeNetwork(f.config, f.store, f.session, action.id, signal(), f.deps);
    const first = await observeNetwork(f.config, f.store, f.session, action.id, signal(), f.deps);
    assert.equal(first.state, "uncertain"); assert.equal(first.network?.stage, "accepted");
    f.store.recoverInterrupted(); f.set({ visible: true });
    const second = await observeNetwork(f.config, f.store, f.session, action.id, signal(), f.deps);
    assert.equal(second.state, "succeeded"); assert.equal(second.remoteId, networkId); assert.equal(f.writes, 1);
  } finally { f.close(); }
});

test("network context, expiry, session, available network and exhausted preflight allowance stop before a write", async () => {
  for (const kind of ["source", "expiry", "session", "network", "budget", "gate"] as const) {
    const f = await fixture();
    try {
      const action = await f.propose(); f.approve(action);
      if (kind === "source") writeFileSync(join(f.project, "server.mjs"), "// changed after decision\n");
      if (kind === "expiry") f.store.db.prepare("UPDATE actions SET expires_at=0 WHERE id=?").run(action.id);
      if (kind === "network") f.set({ exists: true });
      if (kind === "budget") f.set({ readRetries: true });
      const deps = kind === "budget" ? { ...f.deps, budget: new RunBudget({ maxModelCalls: 1, maxToolCalls: 4, runTimeoutMs: 5000 }) } : f.deps;
      await assert.rejects(executeNetwork(kind === "gate" ? { ...f.config, enableMutations: false } : f.config, f.store,
        kind === "session" ? { ...f.session, id: "another-session" } : f.session, action.id, signal(), deps), AppError);
      assert.equal(f.writes, 0, kind); assert.equal(f.store.getAction(action.id, f.session.actorId).attemptId, null, kind);
    } finally { f.close(); }
  }
});

test("network create 401/429/5xx has a single durable attempt and no blind replay", async () => {
  for (const status of [401, 429, 503]) {
    const f = await fixture();
    try {
      const action = await f.propose(); f.approve(action); f.set({ status });
      await assert.rejects(executeNetwork(f.config, f.store, f.session, action.id, signal(), f.deps), code("UPSTREAM_UNCERTAIN"));
      assert.equal(f.writes, 1); assert.equal(f.store.getAction(action.id, f.session.actorId).state, "uncertain");
      await assert.rejects(executeNetwork(f.config, f.store, f.session, action.id, signal(), f.deps), code("ACTION_CONFLICT"));
      assert.equal(f.writes, 1);
    } finally { f.close(); }
  }
});

test("unknown-cost consent and the parent run transition roll back together; forged free pricing or a removed acknowledgment cannot execute", async () => {
  const f = await fixture();
  try {
    const action = await f.propose();
    assert.throws(() => parseActionSpec({ ...action.spec, cost: { state: "known", amount: 0, currency: "toman", period: "hour" } }), code("INVALID_NETWORK_PROPOSAL"));
    assert.throws(() => f.store.decide(action.id, f.session.actorId, f.session.id, action.hash, "approve", Date.now(), () => { throw Error("run revision lost"); },
      { acknowledgeUnknownCost: true }), /run revision lost/);
    assert.equal(f.store.getAction(action.id, f.session.actorId).state, "awaiting_approval");
    assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM audit_events WHERE action_id=? AND event='unknown_network_cost_acknowledged'").get(action.id)?.n, 0);
    f.approve(action);
    f.store.db.prepare("DELETE FROM audit_events WHERE action_id=? AND event='unknown_network_cost_acknowledged'").run(action.id);
    await assert.rejects(executeNetwork(f.config, f.store, f.session, action.id, signal(), f.deps), code("UNKNOWN_COST_ACK_REQUIRED"));
    assert.equal(f.writes, 0); assert.equal(f.store.getAction(action.id, f.session.actorId).attemptId, null);
  } finally { f.close(); }
});

test("agent network decision continues the same run and durable budget; repeated decisions/observations cannot create a second network", async () => {
  const f = await fixture();
  try {
    const repo = new AgentRepository(f.store), result = createAgentRun(f.config, f.store, f.session, "network-request-key", "شبکه موردنیاز همین پروژه را بساز", f.flow.id);
    let calls = 0;
    const model: ModelPort = { async complete(_messages, tools, budget, bounded) {
      budget.take("model", bounded); calls++;
      assert.ok(tools.some(tool => tool.function.name === "propose_network")); assert.ok(tools.length <= 16);
      const name = calls === 1 ? "propose_network" : "finish_investigation", args = calls === 1 ? { app }
        : { state: "partially_completed", message: "شبکه ساخته و از حساب تأیید شد؛ برنامه هنوز منتشر نشده است.", question: null, nextAction: "reply" };
      return { content: null, usage: 5, calls: [{ id: `call-${calls}`, type: "function", function: { name, arguments: JSON.stringify(args) } }] };
    } };
    const { executeAgentTool } = await import("../../src/server/agent/tools.ts");
    const drive = () => driveAgentRun(f.config, f.store, f.session, result.run.id, { model, network: f.deps, pollDelayMs: 0,
      tool: (name, args, context) => executeAgentTool(name, args, { ...context, account: f.deps.read }) });
    await drive();
    const proposed = repo.get(f.session.actorId, result.run.id);
    assert.equal(proposed?.state, "needs_approval"); assert.ok(proposed?.network);
    if (!proposed?.network) throw Error("missing network proposal");
    await assert.rejects(decideAgentNetwork(f.config, f.store, f.session, proposed.id, proposed.revision, proposed.network.id, "approve", false), code("UNKNOWN_COST_ACK_REQUIRED"));
    const approved = await decideAgentNetwork(f.config, f.store, f.session, proposed.id, proposed.revision, proposed.network.id, "approve", true);
    await assert.rejects(decideAgentNetwork(f.config, f.store, f.session, proposed.id, proposed.revision, proposed.network.id, "approve", true), code("AGENT_CONFLICT"));
    assert.equal(approved.state, "queued"); await drive();
    const finished = repo.get(f.session.actorId, proposed.id);
    assert.equal(finished?.state, "partially_completed"); assert.equal(finished?.effect, "network_created");
    assert.equal(finished?.networkContinued, true); assert.equal(finished?.usage.modelCalls, 2); assert.equal(f.writes, 1);
    assert.deepEqual(finished?.limits, result.run.limits);
    assert.throws(() => resumeAgentNetwork(f.store, f.session, proposed.id, finished?.revision ?? 0), code("AGENT_CONFLICT"));
  } finally { f.close(); }
});
