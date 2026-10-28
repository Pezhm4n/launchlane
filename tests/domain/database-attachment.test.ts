import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import { proposeDatabaseAttachment, proposeDatabase, executeDatabase, observeDatabase } from "../../src/server/application/databases.ts";
import { LiaraDatabaseReadClient } from "../../src/server/liara/database-read.ts";
import { LiaraDatabaseProvisionClient } from "../../src/server/liara/database-provision.ts";
import { LiaraDatabaseCredentialsClient } from "../../src/server/liara/database-credentials.ts";
import { LiaraAccountClient } from "../../src/server/liara/catalog.ts";
import { LiaraEnvironmentClient } from "../../src/server/liara/environment.ts";
import { sealCredential } from "../../src/server/connections/credentials.ts";
import { AppError } from "../../src/server/errors.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";
import { decodeAction } from "../../src/contracts/client-decode.ts";
import { parseDatabaseResourceSpec } from "../../src/contracts/database-provision.ts";
import { fingerprint } from "../../src/server/policy/action.ts";
import { createPublicationMission } from "../../src/server/application/publication-mission.ts";
import { driveAgentRun, decideAgentDatabase, continueAgentRun } from "../../src/server/agent/runs.ts";
import { AgentRepository, agentView } from "../../src/server/agent/store.ts";
import { executeAgentTool, toolsForAgent, toolsForConversation } from "../../src/server/agent/tools.ts";
import { proposeDatabaseEnvironment } from "../../src/server/application/database-environment.ts";
import { executeEnvironment, observeEnvironment } from "../../src/server/application/environment.ts";
import { currentEnvironment, openEnvironmentInput } from "../../src/server/environment/secrets.ts";
import { assertDatabaseEnvironmentBinding } from "../../src/server/environment/database-binding.ts";
import { parseAgentView } from "../../src/contracts/agent.ts";
import type { ModelPort } from "../../src/server/agent/model.ts";

const team = "a".repeat(24), accountId = "b".repeat(24), appId = "c".repeat(24), networkId = "d".repeat(24), dbId = "e".repeat(24), app = "existing-consumer";
const signal = () => AbortSignal.timeout(15000), code = (expected: string) => (error: unknown) => error instanceof AppError && error.code === expected;
async function fixture() {
  const f = await agentFixture();
  try {
    writeFileSync(join(f.project, "package.json"), JSON.stringify({ name: "existing-consumer", type: "module", engines: { node: "22" }, scripts: { start: "node server.mjs" }, dependencies: { pg: "8.16.3" } }));
    writeFileSync(join(f.project, "server.mjs"), "import pg from 'pg'; export const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});\n");
    const config = { ...f.config, teamId: team, apps: [app], enableLiveLiara: true, enableMutations: true, liaraToken: "synthetic-existing-provider" };
    const flow = await prepareProjectFlow(config, f.store, f.session.actorId, { kind: "local", directory: "service" }, signal());
    f.store.saveConnection(f.session.actorId, { source: "token", ciphertext: sealCredential(config.liaraToken, config.sessionSecret, f.session.actorId, "liara"), view: {
      provider: "liara", status: "connected", identityId: accountId, displayName: "Fixture", login: "fixture@example.test", teamName: "Fixture", teamId: team,
      checkedAt: Date.now(), selectedApp: app, apps: [{ id: appId, name: app, platform: "node" }],
    } });
    const state = { visible: true, version: "16.4", network: networkId, publicNetwork: false, id: dbId, price: 100, scopeAccount: accountId, password: "synthetic-existing-db-secret", environmentWrites: 0, writes: 0 };
    let values = [{ key: "KEEP_KEY", value: "keep-existing-value" }];
    const read = new LiaraDatabaseReadClient(config, accountId, async (url, init) => {
      assert.equal(init.method, "GET"); const u = new URL(url); assert.equal(u.searchParams.get("teamID"), team);
      if (u.pathname === "/v1/me") return Response.json({ user: { _id: state.scopeAccount }, team: { _id: team, balance: 0 }, databaseVersions: { postgres: [{ value: "16.4" }] },
        plans: { databases: { small: { available: true, supports: ["postgres"], price: state.price } }, databaseBundlePlans: { small: { basic: { available: true, price: 10 } } } } });
      assert.equal(u.pathname, "/v1/databases"); return Response.json({ databases: state.visible ? [{ _id: dbId, hostname: "existing-data", type: "postgres", planID: "small", bundlePlanID: "basic", status: "RUNNING" }] : [] });
    });
    const account = new LiaraAccountClient(config, accountId, async url => new URL(url).pathname === `/v1/projects/${app}`
      ? Response.json({ project: { _id: appId, project_id: app, type: "node", readOnlyRootFilesystem: true, planID: "app-small", bundlePlanID: "basic", network: { _id: networkId } } })
      : Response.json({ networks: [{ _id: networkId, name: "fixture" }] }));
    const credentials = new LiaraDatabaseCredentialsClient(config, async (url, init) => { assert.equal(init.method, "GET"); assert.equal(new URL(url).pathname, `/v1/databases/${dbId}`);
      assert.equal(new URL(url).searchParams.get("teamID"), team);
      return Response.json({ database: { id: state.id, hostname: "existing-data", type: "postgres", version: state.version, planID: "small", publicNetwork: state.publicNetwork,
        network: { _id: state.network }, metaData: { privateNetwork: true }, username: "postgres", root_password: state.password, dbName: "postgres", internalPort: 5432 } }); });
    const write = new LiaraDatabaseProvisionClient(config, async () => { state.writes++; throw Error("Existing-resource selection cannot POST a create"); });
    const environment = new LiaraEnvironmentClient(config, async (_url, init) => { if (init.method === "POST") { state.environmentWrites++; values = JSON.parse(String(init.body)).variables; return Response.json({}); }
      return Response.json({ project: { _id: appId, project_id: app, type: "node", planID: "app-small", envs: values } }); });
    return { ...f, config, flow, state, environment, get values() { return values; }, deps: { read, account, credentials, write },
      input: { flowId: flow.id, requestKey: randomUUID(), consumerRoot: ".", databaseId: dbId, bindingKeys: ["DATABASE_URL"] } };
  } catch (error) { f.close(); throw error; }
}

test("existing database selection binds exact identity and private source purpose without purchasing, SQL or a create receipt", async () => {
  const f = await fixture(); try {
    const a = await proposeDatabaseAttachment(f.config, f.store, f.session.actorId, f.input, signal(), f.deps);
    assert.equal(a.spec.version, 29); assert.equal(a.spec.operation, "attach_database"); assert.equal(a.state, "awaiting_approval");
    assert.equal(decodeAction(a).hash, a.hash); assert.equal(JSON.stringify(a).includes(f.state.password), false);
    const spec = a.spec; assert.ok(spec.version === 29);
    assert.throws(() => f.store.createAction(f.session.actorId, { ...spec, databaseId: "f".repeat(24), requestKey: randomUUID() }), code("DATABASE_BINDING_ALREADY_RESERVED"));
    assert.equal((await proposeDatabaseAttachment(f.config, f.store, f.session.actorId, f.input, signal(), f.deps)).id, a.id);
    assert.notEqual(fingerprint(a.spec), fingerprint({ ...a.spec, databaseId: "f".repeat(24) }));
    for (const changes of [{ operation: "create_database" }, { databaseId: "bad" }, { unexpected: true }]) assert.throws(() => parseDatabaseResourceSpec({ ...a.spec, ...changes }));
    await assert.rejects(executeDatabase(f.config, f.store, f.session, a.id, signal(), f.deps), code("ACTION_CONFLICT"));
    await assert.rejects(proposeDatabase(f.config, f.store, f.session.actorId, { ...f.input, type: "postgres", version: "16.4", planId: "small", bundleId: "basic" }, signal(), f.deps), code("IDEMPOTENCY_CONFLICT"));
    f.store.decide(a.id, f.session.actorId, f.session.id, a.hash, "approve");
    await executeDatabase(f.config, f.store, f.session, a.id, signal(), f.deps);
    const selected = await observeDatabase(f.config, f.store, f.session, a.id, signal(), f.deps);
    assert.equal(selected.state, "succeeded"); assert.equal(selected.database?.stage, "selected"); assert.equal(selected.remoteId, dbId); assert.equal(f.state.writes, 0);
    assert.equal(selected.database?.observation?.outcome, "identity_verified");
    await assert.rejects(executeDatabase(f.config, f.store, f.session, a.id, signal(), f.deps), code("ACTION_CONFLICT"));
    assert.equal(f.state.environmentWrites, 0);
  } finally { f.close(); }
});

test("existing-resource proposal rejects missing identity, public/cross-network resources and mismatched source purpose", async () => {
  for (const kind of ["missing", "network", "public", "id", "account", "version", "key", "consumer"] as const) {
    const f = await fixture(); try {
      if (kind === "missing") f.state.visible = false;
      if (kind === "network") f.state.network = "f".repeat(24);
      if (kind === "public") f.state.publicNetwork = true;
      if (kind === "id") f.state.id = "f".repeat(24);
      if (kind === "account") f.state.scopeAccount = "f".repeat(24);
      if (kind === "version") f.state.version = "17.0";
      await assert.rejects(proposeDatabaseAttachment(f.config, f.store, f.session.actorId, { ...f.input,
        ...(kind === "key" ? { bindingKeys: ["NEXT_PUBLIC_DATABASE_URL"] } : {}), ...(kind === "consumer" ? { consumerRoot: "other" } : {}) }, signal(), f.deps));
      assert.equal(f.store.db.prepare("SELECT count(*) n FROM actions").get()?.n, 0); assert.equal(f.state.writes, 0);
    } finally { f.close(); }
  }
});

test("approved existing-resource intent is revalidated before claim, including source, scope, price, network, expiry and budget", async () => {
  for (const kind of ["version", "network", "public", "id", "account", "price", "source", "expiry", "budget"] as const) {
    const f = await fixture(); try {
      const a = await proposeDatabaseAttachment(f.config, f.store, f.session.actorId, f.input, signal(), f.deps);
      f.store.decide(a.id, f.session.actorId, f.session.id, a.hash, "approve");
      if (kind === "version") f.state.version = "17.0";
      if (kind === "network") f.state.network = "f".repeat(24);
      if (kind === "public") f.state.publicNetwork = true;
      if (kind === "id") f.state.id = "f".repeat(24);
      if (kind === "account") f.state.scopeAccount = "f".repeat(24);
      if (kind === "price") f.state.price = 101;
      if (kind === "source") writeFileSync(join(f.project, "server.mjs"), "changed source\n");
      if (kind === "expiry") f.store.db.prepare("UPDATE actions SET expires_at=0 WHERE id=?").run(a.id);
      await assert.rejects(executeDatabase(f.config, f.store, f.session, a.id, signal(), { ...f.deps,
        ...(kind === "budget" ? { budget: new RunBudget({ maxModelCalls: 0, maxToolCalls: 6, runTimeoutMs: 10000 }) } : {}) }));
      assert.equal(f.store.getAction(a.id, f.session.actorId).attemptId, null); assert.equal(f.state.writes, 0);
    } finally { f.close(); }
  }
});

test("selected-resource reconciliation cannot adopt another ID or accept an inventory-only proof", async () => {
  const f = await fixture(); try {
    const a = await proposeDatabaseAttachment(f.config, f.store, f.session.actorId, f.input, signal(), f.deps);
    f.store.decide(a.id, f.session.actorId, f.session.id, a.hash, "approve"); await executeDatabase(f.config, f.store, f.session, a.id, signal(), f.deps);
    assert.throws(() => f.store.recordDatabaseObservation(a.id, f.session.actorId, null, { accountId, teamId: team, id: dbId, hostname: "existing-data", type: "postgres", planId: "small", bundleId: "basic", observedAt: Date.now() }), code("EVIDENCE_MISMATCH"));
    f.state.visible = false; const uncertain = await observeDatabase(f.config, f.store, f.session, a.id, signal(), f.deps); assert.equal(uncertain.state, "uncertain");
    f.state.visible = true; f.state.network = "f".repeat(24); await assert.rejects(observeDatabase(f.config, f.store, f.session, a.id, signal(), f.deps), code("EVIDENCE_MISMATCH"));
    f.state.network = networkId; const selected = await observeDatabase(f.config, f.store, f.session, a.id, signal(), f.deps); assert.equal(selected.state, "succeeded"); assert.equal(f.state.writes, 0);
  } finally { f.close(); }
});

test("existing-resource consent cannot change session, actor, immutable arguments or be reused after rejection", async () => {
  const f = await fixture(); try {
    const rejected = await proposeDatabaseAttachment(f.config, f.store, f.session.actorId, f.input, signal(), f.deps);
    f.store.decide(rejected.id, f.session.actorId, f.session.id, rejected.hash, "reject");
    await assert.rejects(executeDatabase(f.config, f.store, f.session, rejected.id, signal(), f.deps));
    const a = await proposeDatabaseAttachment(f.config, f.store, f.session.actorId, { ...f.input, requestKey: randomUUID() }, signal(), f.deps);
    const spec = a.spec; assert.ok(spec.version === 29);
    f.store.decide(a.id, f.session.actorId, f.session.id, a.hash, "approve");
    await assert.rejects(executeDatabase(f.config, f.store, { ...f.session, id: "other-session" }, a.id, signal(), f.deps));
    assert.throws(() => f.store.claim(a.id, f.session.actorId, f.session.id, { ...spec, sourceHash: "0".repeat(64) }));
    assert.throws(() => f.store.getAction(a.id, "other-actor"));
    assert.equal(f.store.getAction(a.id, f.session.actorId).attemptId, null); assert.equal(f.state.writes, 0);
  } finally { f.close(); }
});

test("an interrupted local selection reconciles only its approved ID without replaying a claim or provider write", async () => {
  const f = await fixture(); try {
    const a = await proposeDatabaseAttachment(f.config, f.store, f.session.actorId, f.input, signal(), f.deps);
    f.store.decide(a.id, f.session.actorId, f.session.id, a.hash, "approve");
    const claimed = f.store.claim(a.id, f.session.actorId, f.session.id, a.spec); f.store.startDatabaseRequest(a.id, f.session.actorId); f.store.uncertain(a.id, f.session.actorId);
    const selected = await observeDatabase(f.config, f.store, f.session, a.id, signal(), f.deps);
    assert.equal(selected.state, "succeeded"); assert.equal(selected.attemptId, claimed.attemptId); assert.equal(selected.database?.stage, "selected"); assert.equal(selected.remoteId, dbId);
    assert.equal(f.store.db.prepare("SELECT count(*) n FROM attempts").get()?.n, 1); assert.equal(f.state.writes, 0); assert.equal(f.state.environmentWrites, 0);
    assert.throws(() => f.store.claim(a.id, f.session.actorId, f.session.id, a.spec), code("ACTION_CONFLICT"));
  } finally { f.close(); }
});

test("shared Agent tool selects an existing database then uses the unchanged private env approval; rebinding preserves exact resource purpose", async () => {
  const f = await fixture(); try {
    assert.ok(toolsForAgent(f.config, "build", true, false, false, true).some(row => row.function.name === "propose_database_attachment"));
    assert.ok(!toolsForConversation(f.config).some(row => row.function.name === "propose_database_attachment"));
    let calls = 0;
    const { run } = await createPublicationMission(f.config, f.store, f.session, randomUUID(), { projectId: f.flow.id, sourceHash: f.flow.profile.sourceHash, path: "/", expectedText: "existing database" }, signal());
    const repo = new AgentRepository(f.store), model: ModelPort = { async complete(_messages, _tools, budget, bounded) {
      budget.take("model", bounded); calls++; const name = calls === 1 || calls === 3 ? "propose_database_attachment" : "finish_investigation";
      return { content: null, calls: [{ id: `existing-${calls}`, type: "function", function: { name, arguments: JSON.stringify(name === "propose_database_attachment"
        ? { consumerRoot: ".", databaseId: dbId, bindingKeys: ["DATABASE_URL"] }
        : { state: "needs_input", message: "هویت منبع از داده و migration جداست.", question: null, nextAction: "configure_env" }) } }], usage: 4 };
    } };
    const tool = (name: string, args: unknown, c: Parameters<typeof executeAgentTool>[2]) => executeAgentTool(name, args, { ...c, database: f.deps.read, account: f.deps.account, databaseCredentials: f.deps.credentials });
    for (let iteration = 0; iteration < 2; iteration++) {
      if (iteration) { const previous = repo.get(f.session.actorId, run.id); assert.ok(previous); continueAgentRun(f.config, f.store, f.session, run.id, previous.revision, randomUUID(), "همان اتصال را بازخوانی و امن تنظیم کن"); f.state.password = "synthetic-rotated-private-secret"; }
      await driveAgentRun(f.config, f.store, f.session, run.id, { model, tool, database: f.deps, pollDelayMs: 0 });
      const pending = repo.get(f.session.actorId, run.id); assert.ok(pending?.database?.spec.version === 29); assert.equal(pending.state, "needs_approval");
      await decideAgentDatabase(f.config, f.store, f.session, run.id, pending.revision, pending.database.id, "approve");
      await driveAgentRun(f.config, f.store, f.session, run.id, { model, tool, database: f.deps, pollDelayMs: 0 });
      const selected = repo.get(f.session.actorId, run.id); assert.ok(selected); assert.equal(selected.effect, iteration ? "configuration_changed" : "no_remote_changes"); assert.equal(selected.database?.database?.stage, "selected");
      assert.equal(parseAgentView(agentView(selected)).database?.spec.version, 29); assert.equal(JSON.stringify(agentView(selected)).includes(f.state.password), false);
      const a = await proposeDatabaseEnvironment(f.config, f.store, f.session, run.id, randomUUID(), signal(), { ...f.deps, environment: f.environment });
      assert.ok(a.spec.version === 9); assert.deepEqual(a.spec.keys, ["DATABASE_URL"]); assert.equal(f.state.environmentWrites, iteration);
      assert.equal(openEnvironmentInput(f.store, f.config.sessionSecret, f.session.actorId, a.spec).find(row => row.key === "KEEP_KEY")?.value, "keep-existing-value");
      f.store.decide(a.id, f.session.actorId, f.session.id, a.hash, "approve"); await executeEnvironment(f.config, f.store, f.session, a.id, signal(), { client: f.environment });
      await observeEnvironment(f.config, f.store, f.session, a.id, signal(), { client: f.environment });
      assertDatabaseEnvironmentBinding(f.store, f.config.sessionSecret, f.session.actorId, f.flow, currentEnvironment(f.store, f.config.sessionSecret, f.session.actorId, f.flow.id));
    }
    assert.equal(f.state.environmentWrites, 2); assert.equal(f.state.writes, 0); assert.equal(repo.get(f.session.actorId, run.id)?.publication, null);
  } finally { f.close(); }
});
