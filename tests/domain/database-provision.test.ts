import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import { proposeDatabase, executeDatabase, observeDatabase } from "../../src/server/application/databases.ts";
import { LiaraDatabaseReadClient } from "../../src/server/liara/database-read.ts";
import { LiaraDatabaseProvisionClient } from "../../src/server/liara/database-provision.ts";
import { LiaraAccountClient } from "../../src/server/liara/catalog.ts";
import { sealCredential } from "../../src/server/connections/credentials.ts";
import { AppError } from "../../src/server/errors.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";
import { decodeAction } from "../../src/contracts/client-decode.ts";
import { createAgentRun, driveAgentRun, decideAgentDatabase, resumeAgentDatabase, cancelAgentRun, continueAgentRun } from "../../src/server/agent/runs.ts";
import { databaseBindingKeys, parseDatabaseProvisionSpec } from "../../src/contracts/database-provision.ts";
import { fingerprint } from "../../src/server/policy/action.ts";
import { createPublicationMission } from "../../src/server/application/publication-mission.ts";
import { databaseEnvironmentOption, proposeDatabaseEnvironment } from "../../src/server/application/database-environment.ts";
import { executeEnvironment, observeEnvironment } from "../../src/server/application/environment.ts";
import { LiaraDatabaseCredentialsClient } from "../../src/server/liara/database-credentials.ts";
import { LiaraEnvironmentClient } from "../../src/server/liara/environment.ts";
import { openEnvironmentInput, currentEnvironment, projectSecretValues } from "../../src/server/environment/secrets.ts";
import { redact } from "../../src/server/policy/redaction.ts";
import { assertDatabaseEnvironmentBinding } from "../../src/server/environment/database-binding.ts";
import { executeAgentTool, toolsForAgent, toolsForConversation } from "../../src/server/agent/tools.ts";
import { AgentRepository, agentView } from "../../src/server/agent/store.ts";
import { parseAgentView } from "../../src/contracts/agent.ts";
import type { ModelPort } from "../../src/server/agent/model.ts";

const team = "a".repeat(24), accountId = "b".repeat(24), appId = "c".repeat(24), networkId = "d".repeat(24), dbId = "e".repeat(24), app = "database-consumer";
const signal = () => AbortSignal.timeout(10000), code = (expected: string) => (error: unknown) => error instanceof AppError && error.code === expected;
async function fixture(keys: readonly string[] = ["DATABASE_URL"]) {
  const f = await agentFixture();
  try {
    writeFileSync(join(f.project, "package.json"), JSON.stringify({ name: "consumer", type: "module", engines: { node: "22" }, scripts: { start: "node server.mjs" }, dependencies: { pg: "8.16.3" } }));
    writeFileSync(join(f.project, "server.mjs"), `import pg from 'pg';\n${keys.map((key, i) => `export const pool${i}=new pg.Pool({connectionString:process.env.${key}});`).join("\n")}\n`);
    const config = { ...f.config, teamId: team, apps: [app], enableLiveLiara: true, enableMutations: true, liaraToken: "synthetic-database-provider" };
    const flow = await prepareProjectFlow(config, f.store, f.session.actorId, { kind: "local", directory: "service" }, signal());
    f.store.saveConnection(f.session.actorId, { source: "token", ciphertext: sealCredential(config.liaraToken, config.sessionSecret, f.session.actorId, "liara"), view: {
      provider: "liara", status: "connected", identityId: accountId, displayName: "Fixture", login: "fixture@example.test", teamName: "Fixture", teamId: team,
      checkedAt: Date.now(), selectedApp: app, apps: [{ id: appId, name: app, platform: "node" }],
    } });
    let writes = 0, exists = false, visible = true, lost = false, responseId = true, status = 200, price = 100, network = networkId, hostname = "", scopeAccount = accountId;
    const read = new LiaraDatabaseReadClient(config, accountId, async url => {
      const u = new URL(url); assert.equal(u.searchParams.get("teamID"), team);
      if (u.pathname === "/v1/me") return Response.json({ user: { _id: scopeAccount }, team: { _id: team, balance: 100000 }, databaseVersions: { postgres: [{ value: "16.4" }] },
        plans: { databases: { small: { available: true, supports: ["postgres"], price } }, databaseBundlePlans: { small: { basic: { available: true, price: 10 } } } } });
      assert.equal(u.pathname, "/v1/databases"); return Response.json({ databases: exists && visible ? [{ _id: dbId, hostname, type: "postgres", planID: "small", bundlePlanID: "basic", status: "RUNNING" }] : [] });
    });
    const account = new LiaraAccountClient(config, accountId, async url => {
      const path = new URL(url).pathname;
      if (path === `/v1/projects/${app}`) return Response.json({ project: { _id: appId, project_id: app, type: "node", readOnlyRootFilesystem: true, planID: "app-small", bundlePlanID: "basic", network: { _id: network } } });
      assert.equal(path, "/v1/networks"); return Response.json({ networks: [{ _id: networkId, name: "fixture" }] });
    });
    const write = new LiaraDatabaseProvisionClient(config, async (url, init) => {
      writes++; assert.equal(new URL(url).pathname, "/v1/databases"); assert.equal(new URL(url).searchParams.get("teamID"), team);
      const row = f.store.db.prepare("SELECT id FROM actions WHERE json_extract(spec,'$.version') IN (27,28) ORDER BY rowid DESC LIMIT 1").get();
      const action = f.store.getAction(String(row?.id), f.session.actorId); assert.equal(action.database?.stage, "request_started"); assert.ok(action.attemptId);
      const body = JSON.parse(String(init.body)); hostname = body.hostname;
      assert.deepEqual(body, { hostname, planID: "small", bundlePlanID: "basic", publicNetwork: false, type: "postgres", version: "16.4", network: networkId });
      exists = true; if (lost) throw Error("lost response");
      return Response.json(responseId ? { databaseID: dbId, password: "must-never-export-this" } : { accepted: true }, { status });
    });
    const deps = { read, account, write }, input = { flowId: flow.id, requestKey: randomUUID(), consumerRoot: ".", type: "postgres", version: "16.4", planId: "small", bundleId: "basic" };
    return { ...f, config, flow, deps, input, get writes() { return writes; }, set(values: { visible?: boolean; lost?: boolean; responseId?: boolean; status?: number; price?: number; network?: string; scopeAccount?: string }) {
      if (values.visible !== undefined) visible = values.visible; if (values.lost !== undefined) lost = values.lost; if (values.responseId !== undefined) responseId = values.responseId;
      if (values.status !== undefined) status = values.status; if (values.price !== undefined) price = values.price; if (values.network !== undefined) network = values.network; if (values.scopeAccount !== undefined) scopeAccount = values.scopeAccount;
    } };
  } catch (error) { f.close(); throw error; }
}
test("database creation binds source, current prices, private network and one durable returned identity", async () => {
  const f = await fixture(); try {
    const action = await proposeDatabase(f.config, f.store, f.session.actorId, f.input, signal(), f.deps);
    assert.equal(action.spec.version, 27); assert.equal(action.state, "awaiting_approval"); assert.equal(f.writes, 0);
    assert.equal((await proposeDatabase(f.config, f.store, f.session.actorId, f.input, signal(), f.deps)).id, action.id);
    assert.equal(decodeAction(action).hash, action.hash);
    await assert.rejects(executeDatabase(f.config, f.store, f.session, action.id, signal(), f.deps), code("ACTION_CONFLICT"));
    f.store.decide(action.id, f.session.actorId, f.session.id, action.hash, "approve");
    const accepted = await executeDatabase(f.config, f.store, f.session, action.id, signal(), f.deps);
    assert.throws(() => f.store.finishObservation(action.id, f.session.actorId, "healthy"), code("DATABASE_OBSERVATION_REQUIRED"));
    assert.equal(accepted.state, "observing"); assert.equal(accepted.remoteId, dbId); assert.equal(f.writes, 1);
    assert.equal(JSON.stringify(accepted).includes("must-never-export-this"), false);
    const observed = await observeDatabase(f.config, f.store, f.session, action.id, signal(), f.deps);
    assert.equal(observed.state, "succeeded"); assert.equal(observed.database?.observation?.outcome, "identity_verified");
    assert.equal("credentials" in (observed.database ?? {}), false);
    await assert.rejects(executeDatabase(f.config, f.store, f.session, action.id, signal(), f.deps), code("ACTION_CONFLICT")); assert.equal(f.writes, 1);
  } finally { f.close(); }
});

test("bound database proposals reject undeclared, public, cross-consumer and overlapping connection identities before any write", async () => {
  const f = await fixture(["AUTH_DB_URL", "PROFILE_DB_URL"]); try {
    for (const bindingKeys of [[], ["DATABASE_URL"], ["NEXT_PUBLIC_AUTH_DB_URL"], ["AUTH_DB_URL", "AUTH_DB_URL"], ["PORT"]])
      await assert.rejects(proposeDatabase(f.config, f.store, f.session.actorId, { ...f.input, requestKey: randomUUID(), bindingKeys }, signal(), f.deps));
    await assert.rejects(proposeDatabase(f.config, f.store, f.session.actorId, { ...f.input, consumerRoot: "another", bindingKeys: ["AUTH_DB_URL"] }, signal(), f.deps));
    const input = { ...f.input, bindingKeys: ["AUTH_DB_URL"] }, first = await proposeDatabase(f.config, f.store, f.session.actorId, input, signal(), f.deps);
    assert.ok(first.spec.version === 28); assert.deepEqual(databaseBindingKeys(first.spec), ["AUTH_DB_URL"]); assert.equal(decodeAction(first).hash, first.hash);
    assert.deepEqual(parseDatabaseProvisionSpec(first.spec), first.spec); assert.equal((await proposeDatabase(f.config, f.store, f.session.actorId, input, signal(), f.deps)).id, first.id);
    await assert.rejects(proposeDatabase(f.config, f.store, f.session.actorId, { ...input, bindingKeys: ["PROFILE_DB_URL"] }, signal(), f.deps), code("IDEMPOTENCY_CONFLICT"));
    await assert.rejects(proposeDatabase(f.config, f.store, f.session.actorId, { ...input, requestKey: randomUUID() }, signal(), f.deps), code("DATABASE_BINDING_ALREADY_RESERVED"));
    assert.notEqual(fingerprint(first.spec), fingerprint({ ...first.spec, bindingKeys: ["PROFILE_DB_URL"] }));
    assert.equal(f.writes, 0); f.store.decide(first.id, f.session.actorId, f.session.id, first.hash, "reject");
    const replacement = await proposeDatabase(f.config, f.store, f.session.actorId, { ...input, requestKey: randomUUID() }, signal(), f.deps); assert.notEqual(replacement.id, first.id);
    f.store.db.prepare("UPDATE actions SET expires_at=0 WHERE id=?").run(replacement.id);
    const afterExpiry = await proposeDatabase(f.config, f.store, f.session.actorId, { ...input, requestKey: randomUUID() }, signal(), f.deps); assert.notEqual(afterExpiry.id, replacement.id); assert.equal(f.writes, 0);
    const { bindingKeys: _keys, ...legacy } = first.spec, historical = { ...legacy, version: 27 };
    assert.equal(parseDatabaseProvisionSpec(historical).version, 27);
    assert.throws(() => parseDatabaseProvisionSpec({ ...historical, bindingKeys: ["AUTH_DB_URL"] }));
  } finally { f.close(); }
});

test("one durable Agent mission creates and privately binds two source-declared databases without replacing the first connection", async () => {
  const f = await fixture(["AUTH_DB_URL", "PROFILE_DB_URL"]); try {
    const resources: { _id: string; hostname: string; type: string; planID: string; bundlePlanID: string; status: string }[] = [];
    let writes = 0, detailReads = 0, environmentWrites = 0, calls = 0, values = [{ key: "KEEP_KEY", value: "keep-existing-value" }];
    const read = new LiaraDatabaseReadClient(f.config, accountId, async url => new URL(url).pathname === "/v1/me"
      ? Response.json({ user: { _id: accountId }, team: { _id: team, balance: 100000 }, databaseVersions: { postgres: [{ value: "16.4" }] }, plans: { databases: { small: { available: true, supports: ["postgres"], price: 100 } }, databaseBundlePlans: { small: { basic: { available: true, price: 10 } } } } })
      : Response.json({ databases: resources }));
    const write = new LiaraDatabaseProvisionClient(f.config, async (_url, init) => { writes++; const body = JSON.parse(String(init.body)), id = writes === 1 ? "e".repeat(24) : "f".repeat(24);
      resources.push({ _id: id, hostname: body.hostname, type: "postgres", planID: "small", bundlePlanID: "basic", status: "RUNNING" }); return Response.json({ databaseID: id }); });
    const credentials = new LiaraDatabaseCredentialsClient(f.config, async url => { detailReads++; const resource = resources.find(row => new URL(url).pathname.endsWith(row._id)); assert.ok(resource);
      return Response.json({ database: { id: resource._id, hostname: resource.hostname, type: "postgres", version: "16.4", planID: "small", publicNetwork: false,
        network: { _id: networkId }, metaData: { privateNetwork: true }, username: "postgres", root_password: `synthetic-secret-${resource._id}`, dbName: "postgres", internalPort: 5432 } }); });
    const environment = new LiaraEnvironmentClient(f.config, async (_url, init) => { if (init.method === "POST") { environmentWrites++; values = JSON.parse(String(init.body)).variables; return Response.json({}); }
      return Response.json({ project: { _id: appId, project_id: app, type: "node", planID: "app-small", envs: values } }); });
    const database = { read, account: f.deps.account, write }, repo = new AgentRepository(f.store), { run } = await createPublicationMission(f.config, f.store, f.session, randomUUID(), { projectId: f.flow.id, sourceHash: f.flow.profile.sourceHash, path: "/", expectedText: "two data targets" }, signal());
    const model: ModelPort = { async complete(_messages, _tools, budget, bounded) {
      budget.take("model", bounded); calls++; const slot = calls <= 2 ? "AUTH_DB_URL" : "PROFILE_DB_URL", name = calls === 1 || calls === 3 ? "propose_database" : "finish_investigation";
      return { content: null, calls: [{ id: `two-databases-${calls}`, type: "function", function: { name, arguments: JSON.stringify(name === "propose_database" ? { consumerRoot: ".", bindingKeys: [slot], type: "postgres", version: "16.4", planId: "small", bundleId: "basic" }
        : { state: calls === 5 ? "partially_completed" : "needs_input", message: "منابع و اتصال تنظیمات از داده و migration جدا هستند.", question: null, nextAction: calls === 5 ? "reply" : "configure_env" }) } }], usage: 4 };
    } };
    const tool = (name: string, args: unknown, context: Parameters<typeof executeAgentTool>[2]) => executeAgentTool(name, args, { ...context, database: read, account: f.deps.account });
    const ids: string[] = [];
    for (const [index, key] of ["AUTH_DB_URL", "PROFILE_DB_URL"].entries()) {
      if (index > 0) { const prior = repo.get(f.session.actorId, run.id); assert.ok(prior); continueAgentRun(f.config, f.store, f.session, run.id, prior.revision, randomUUID(), "همان مأموریت را ادامه بده"); }
      await driveAgentRun(f.config, f.store, f.session, run.id, { model, tool, database, pollDelayMs: 0 });
      const pending = repo.get(f.session.actorId, run.id); assert.ok(pending?.database?.spec.version === 28); assert.equal(pending.state, "needs_approval"); assert.deepEqual(pending.database.spec.bindingKeys, [key]); ids.push(pending.database.id);
      await decideAgentDatabase(f.config, f.store, f.session, pending.id, pending.revision, pending.database.id, "approve");
      await driveAgentRun(f.config, f.store, f.session, run.id, { model, tool, database, pollDelayMs: 0 });
      if (index === 0) await assert.rejects(proposeDatabase(f.config, f.store, f.session.actorId, { ...f.input, requestKey: randomUUID(), bindingKeys: ["PROFILE_DB_URL"], agentRunId: run.id }, signal(), database), code("DATABASE_BINDING_REQUIRED"));
      const requestKey = randomUUID(), binding = await proposeDatabaseEnvironment(f.config, f.store, f.session, run.id, requestKey, signal(), { credentials, read, account: f.deps.account, environment });
      assert.ok(binding.spec.version === 9); assert.deepEqual(binding.spec.keys, [key]); assert.equal(binding.state, "awaiting_approval");
      const prepared = openEnvironmentInput(f.store, f.config.sessionSecret, f.session.actorId, binding.spec); assert.ok(prepared.some(row => row.key === "KEEP_KEY"));
      if (index > 0) assert.equal(prepared.find(row => row.key === "AUTH_DB_URL")?.value, values.find(row => row.key === "AUTH_DB_URL")?.value);
      assert.equal((await proposeDatabaseEnvironment(f.config, f.store, f.session, run.id, requestKey, signal(), { credentials, read, account: f.deps.account, environment })).id, binding.id);
      f.store.decide(binding.id, f.session.actorId, f.session.id, binding.hash, "approve"); await executeEnvironment(f.config, f.store, f.session, binding.id, signal(), { client: environment });
      assert.equal((await observeEnvironment(f.config, f.store, f.session, binding.id, signal(), { client: environment })).state, "succeeded");
      assertDatabaseEnvironmentBinding(f.store, f.config.sessionSecret, f.session.actorId, f.flow, currentEnvironment(f.store, f.config.sessionSecret, f.session.actorId, f.flow.id));
    }
    const prior = repo.get(f.session.actorId, run.id); assert.ok(prior); continueAgentRun(f.config, f.store, f.session, run.id, prior.revision, randomUUID(), "همان مأموریت را ادامه بده");
    await driveAgentRun(f.config, f.store, f.session, run.id, { model, tool, database, pollDelayMs: 0 }); const final = repo.get(f.session.actorId, run.id); assert.ok(final);
    assert.equal(final.id, run.id); assert.equal(final.state, "partially_completed"); assert.equal(final.usage.modelCalls, 5); assert.deepEqual(final.limits, run.limits); assert.equal(new Set(ids).size, 2);
    assert.equal(writes, 2); assert.equal(environmentWrites, 2); assert.equal(detailReads, 2); assert.ok(ids.every(id => f.store.getAction(id, f.session.actorId).state === "succeeded"));
    assert.notEqual(new URL(values.find(row => row.key === "AUTH_DB_URL")?.value ?? "").hostname, new URL(values.find(row => row.key === "PROFILE_DB_URL")?.value ?? "").hostname);
    assert.equal(JSON.stringify(agentView(final)).includes("synthetic-secret-"), false); assert.equal(final.publication, null);
    f.store.db.prepare("UPDATE database_environment_bindings SET database_action_id=CASE WHEN database_action_id=? THEN ? ELSE ? END WHERE database_action_id IN (?,?)").run(ids[0] ?? "", ids[1] ?? "", ids[0] ?? "", ids[0] ?? "", ids[1] ?? "");
    assert.throws(() => assertDatabaseEnvironmentBinding(f.store, f.config.sessionSecret, f.session.actorId, f.flow, currentEnvironment(f.store, f.config.sessionSecret, f.session.actorId, f.flow.id)), code("DATABASE_BINDING_CHANGED"));
  } finally { f.close(); }
});
for (const bound of [false, true]) test(`${bound ? "bound" : "historical"} lost or unknown create response never adopts a database by name or authorizes another write`, async () => {
  for (const kind of ["lost", "responseId"] as const) { const f = await fixture(); try {
    f.set(kind === "lost" ? { lost: true } : { responseId: false });
    const input = { ...f.input, ...(bound ? { bindingKeys: ["DATABASE_URL"] } : {}) }, action = await proposeDatabase(f.config, f.store, f.session.actorId, input, signal(), f.deps);
    f.store.decide(action.id, f.session.actorId, f.session.id, action.hash, "approve");
    if (kind === "lost") await assert.rejects(executeDatabase(f.config, f.store, f.session, action.id, signal(), f.deps), code("UPSTREAM_UNCERTAIN"));
    else await executeDatabase(f.config, f.store, f.session, action.id, signal(), f.deps);
    assert.equal((await observeDatabase(f.config, f.store, f.session, action.id, signal(), f.deps)).state, "uncertain");
    assert.equal(f.store.getAction(action.id, f.session.actorId).remoteId, null);
    await assert.rejects(proposeDatabase(f.config, f.store, f.session.actorId, { ...input, requestKey: randomUUID() }, signal(), f.deps), code("UNRESOLVED_EFFECT")); assert.equal(f.writes, 1);
  } finally { f.close(); } }
});
test("delayed inventory reconciles exact returned ID without replay", async () => { const f = await fixture(); try {
  const a = await proposeDatabase(f.config, f.store, f.session.actorId, f.input, signal(), f.deps); f.store.decide(a.id, f.session.actorId, f.session.id, a.hash, "approve");
  await executeDatabase(f.config, f.store, f.session, a.id, signal(), f.deps); f.set({ visible: false });
  assert.equal((await observeDatabase(f.config, f.store, f.session, a.id, signal(), f.deps)).state, "uncertain"); f.set({ visible: true });
  assert.equal((await observeDatabase(f.config, f.store, f.session, a.id, signal(), f.deps)).state, "succeeded"); assert.equal(f.writes, 1);
} finally { f.close(); } });
test("database preflight rejects changed price, network, account, source, expiry and exhausted budget before claim", async () => {
  for (const kind of ["price", "network", "account", "source", "expiry", "budget"] as const) { const f = await fixture(); try {
    const a = await proposeDatabase(f.config, f.store, f.session.actorId, f.input, signal(), f.deps); f.store.decide(a.id, f.session.actorId, f.session.id, a.hash, "approve");
    if (kind === "price") f.set({ price: 101 }); if (kind === "network") f.set({ network: "f".repeat(24) }); if (kind === "account") f.set({ scopeAccount: "f".repeat(24) });
    if (kind === "source") writeFileSync(join(f.project, "server.mjs"), "changed source\n");
    if (kind === "expiry") f.store.db.prepare("UPDATE actions SET expires_at=0 WHERE id=?").run(a.id);
    const deps = kind === "budget" ? { ...f.deps, budget: new RunBudget({ maxModelCalls: 0, maxToolCalls: 5, runTimeoutMs: 10000 }) } : f.deps;
    await assert.rejects(executeDatabase(f.config, f.store, f.session, a.id, signal(), deps)); assert.equal(f.writes, 0); assert.equal(f.store.getAction(a.id, f.session.actorId).attemptId, null);
  } finally { f.close(); } }
});
test("database source semantics and idempotent arguments cannot be changed", async () => { const f = await fixture(); try {
  for (const changes of [{ type: "mysql" }, { consumerRoot: "other" }, { version: "17.0" }, { planId: "unknown" }]) await assert.rejects(proposeDatabase(f.config, f.store, f.session.actorId, { ...f.input, ...changes }, signal(), f.deps));
  const a = await proposeDatabase(f.config, f.store, f.session.actorId, f.input, signal(), f.deps);
  await assert.rejects(proposeDatabase(f.config, f.store, f.session.actorId, { ...f.input, bundleId: "other" }, signal(), f.deps), code("IDEMPOTENCY_CONFLICT"));
  f.store.decide(a.id, f.session.actorId, f.session.id, a.hash, "reject"); assert.equal(f.writes, 0);
} finally { f.close(); } });
test("database 401/429/5xx commits one uncertain attempt and never retries the write", async () => {
  for (const status of [401, 429, 503]) { const f = await fixture(); try {
    f.set({ status }); const a = await proposeDatabase(f.config, f.store, f.session.actorId, f.input, signal(), f.deps); f.store.decide(a.id, f.session.actorId, f.session.id, a.hash, "approve");
    await assert.rejects(executeDatabase(f.config, f.store, f.session, a.id, signal(), f.deps), code("UPSTREAM_UNCERTAIN"));
    await observeDatabase(f.config, f.store, f.session, a.id, signal(), f.deps);
    assert.equal(f.store.getAction(a.id, f.session.actorId).state, "uncertain"); assert.equal(f.writes, 1);
  } finally { f.close(); } }
});
test("private database details reject recreated identities, public access, changed version/network and hidden credentials", async () => { const f = await fixture(); try {
  const action = await proposeDatabase(f.config, f.store, f.session.actorId, f.input, signal(), f.deps); if (action.spec.version !== 27) throw Error("missing database proposal");
  const spec = action.spec, base = { id: dbId, hostname: spec.database.hostname, type: "postgres", version: "16.4", planID: "small", publicNetwork: false,
    network: { _id: networkId }, metaData: { privateNetwork: true }, username: "postgres", root_password: "synthetic-private-password", dbName: "postgres", internalPort: 5432 };
  for (const changes of [{ id: "f".repeat(24) }, { hostname: "other-host" }, { publicNetwork: true }, { version: "17.0" }, { network: { _id: "f".repeat(24) } },
    { metaData: {} }, { root_password: "***" }, { internalPort: "5432" }, { username: "a/b" }]) {
    const client = new LiaraDatabaseCredentialsClient(f.config, async () => Response.json({ database: { ...base, ...changes } }));
    await assert.rejects(client.read(spec, dbId, new RunBudget(f.config), signal()), code("DATABASE_CREDENTIALS_UNAVAILABLE"));
  }
  assert.equal(f.writes, 0);
} finally { f.close(); } });
test("cancelling a queued database owner revokes unused consent; parent and session cannot be replaced", async () => { const f = await fixture(); try {
  const { run } = createAgentRun(f.config, f.store, f.session, "cancel-database", "دیتابیس همین پروژه را آماده کن", f.flow.id);
  const a = await proposeDatabase(f.config, f.store, f.session.actorId, { ...f.input, agentRunId: run.id }, signal(), f.deps), repo = new AgentRepository(f.store);
  run.database = a; run.state = "needs_approval"; repo.save(f.session.actorId, run);
  const pending = repo.get(f.session.actorId, run.id); assert.ok(pending);
  const approved = await decideAgentDatabase(f.config, f.store, f.session, pending.id, pending.revision, a.id, "approve");
  await assert.rejects(executeDatabase(f.config, f.store, { ...f.session, id: "other-session" }, a.id, signal(), f.deps)); assert.equal(f.writes, 0);
  cancelAgentRun(f.store, f.session.actorId, approved.id, approved.revision);
  await assert.rejects(executeDatabase(f.config, f.store, f.session, a.id, signal(), f.deps), code("ACTION_CONFLICT")); assert.equal(f.writes, 0);
  assert.equal(f.store.getAction(a.id, f.session.actorId).state, "cancelled");
} finally { f.close(); } });
test("Agent chooses database proposal then continues same budget after approval/readback without claiming data health", async () => {
  const f = await fixture(); try {
    const { run: initial } = await createPublicationMission(f.config, f.store, f.session, "database-agent-request", { projectId: f.flow.id, sourceHash: f.flow.profile.sourceHash, path: "/", expectedText: "invoice service" }, signal());
    assert.ok(initial); let calls = 0;
    const model: ModelPort = { async complete(_messages, tools, budget, bounded) {
      budget.take("model", bounded); calls++; assert.ok(tools.some(row => row.function.name === "propose_database")); assert.ok(tools.length <= 20);
      const name = calls === 1 ? "propose_database" : "finish_investigation", args = calls === 1 ? { consumerRoot: ".", bindingKeys: ["DATABASE_URL"], type: "postgres", version: "16.4", planId: "small", bundleId: "basic" }
        : { state: "needs_input", message: "هویت دیتابیس تأیید شد؛ اتصال و بررسی داده باقی است.", question: null, nextAction: "configure_env" };
      return { content: null, usage: 5, calls: [{ id: `database-call-${calls}`, type: "function", function: { name, arguments: JSON.stringify(args) } }] };
    } };
    const tool: typeof executeAgentTool = (name, args, context) => executeAgentTool(name, args, { ...context, database: f.deps.read, account: f.deps.account });
    await driveAgentRun(f.config, f.store, f.session, initial.id, { model, tool });
    const repo = new AgentRepository(f.store), pending = repo.get(f.session.actorId, initial.id); assert.ok(pending?.database); assert.equal(pending.state, "needs_approval"); assert.equal(f.writes, 0);
    parseAgentView(agentView(pending));
    const next = await decideAgentDatabase(f.config, f.store, f.session, pending.id, pending.revision, pending.database.id, "approve");
    await driveAgentRun(f.config, f.store, f.session, next.id, { model, tool, database: f.deps, pollDelayMs: 0 });
    const result = repo.get(f.session.actorId, initial.id); assert.ok(result); assert.equal(result.effect, "database_created"); assert.equal(result.databaseContinued, true); assert.equal(result.usage.modelCalls, 2); assert.equal(f.writes, 1);
    assert.ok(result.messages.some(row => row.content?.includes('"connectivityVerified":false')));
    assert.throws(() => resumeAgentDatabase(f.store, f.session, result.id, result.revision), code("AGENT_CONFLICT"));
    const option = databaseEnvironmentOption(f.config, f.store, f.session.actorId, result.id); assert.deepEqual(option?.keys, ["DATABASE_URL"]);
    assert.throws(() => assertDatabaseEnvironmentBinding(f.store, f.config.sessionSecret, f.session.actorId, f.flow, null), code("DATABASE_BINDING_REQUIRED"));
    let environmentWrites = 0, values = [{ key: "KEEP_KEY", value: "keep-existing-value" }], detailReads = 0;
    const secret = "synthetic-db-p@ss:/word", credentials = new LiaraDatabaseCredentialsClient(f.config, async url => {
      detailReads++; assert.equal(new URL(url).pathname, `/v1/databases/${dbId}`);
      return Response.json({ database: { id: dbId, hostname: option?.hostname, type: "postgres", version: "16.4", planID: "small", publicNetwork: false,
        network: { _id: networkId }, metaData: { privateNetwork: true }, username: "postgres", root_password: secret, dbName: "postgres", internalPort: 5432 } });
    });
    const environment = new LiaraEnvironmentClient(f.config, async (_url, init) => {
      if (init.method === "POST") { environmentWrites++; values = JSON.parse(String(init.body)).variables; return Response.json({}); }
      return Response.json({ project: { _id: appId, project_id: app, type: "node", planID: "app-small", envs: values } });
    });
    const requestKey = randomUUID(), deps = { credentials, read: f.deps.read, account: f.deps.account, environment };
    const binding = await proposeDatabaseEnvironment(f.config, f.store, f.session, result.id, requestKey, signal(), deps);
    assert.equal(binding.spec.version, 9); assert.equal(environmentWrites, 0);
    assert.equal((await proposeDatabaseEnvironment(f.config, f.store, f.session, result.id, requestKey, signal(), deps)).id, binding.id); assert.equal(detailReads, 1);
    const saved = repo.get(f.session.actorId, result.id); assert.ok(saved);
    assert.equal(JSON.stringify(binding).includes(secret), false); assert.equal(JSON.stringify(agentView(saved)).includes(secret), false);
    const secrets = projectSecretValues(f.store, f.config.sessionSecret, f.session.actorId);
    assert.equal(redact(`password=${secret}`, secrets).includes(secret), false);
    assert.equal(f.store.db.prepare("SELECT database_action_id FROM database_environment_bindings WHERE action_id=?").get(binding.id)?.database_action_id, pending.database.id);
    if (binding.spec.version !== 9) throw Error("missing env proposal");
    const prepared = openEnvironmentInput(f.store, f.config.sessionSecret, f.session.actorId, binding.spec), url = new URL(prepared.find(row => row.key === "DATABASE_URL")?.value ?? "");
    assert.equal(decodeURIComponent(url.password), secret); assert.equal(url.hostname, option?.hostname); assert.equal(url.port, "5432"); assert.equal(url.pathname, "/postgres");
    assert.ok(prepared.some(row => row.key === "KEEP_KEY"));
    await assert.rejects(executeEnvironment(f.config, f.store, f.session, binding.id, signal(), { client: environment })); assert.equal(environmentWrites, 0);
    f.store.decide(binding.id, f.session.actorId, f.session.id, binding.hash, "approve");
    await executeEnvironment(f.config, f.store, f.session, binding.id, signal(), { client: environment });
    assert.equal((await observeEnvironment(f.config, f.store, f.session, binding.id, signal(), { client: environment })).state, "succeeded"); assert.equal(environmentWrites, 1);
    assert.ok(currentEnvironment(f.store, f.config.sessionSecret, f.session.actorId, f.flow.id));
    assertDatabaseEnvironmentBinding(f.store, f.config.sessionSecret, f.session.actorId, f.flow, currentEnvironment(f.store, f.config.sessionSecret, f.session.actorId, f.flow.id));
    assert.equal(repo.get(f.session.actorId, result.id)?.effect, "configuration_changed");
    assert.ok((repo.get(f.session.actorId, result.id)?.usage.toolCalls ?? 0) > result.usage.toolCalls);
    assert.equal(toolsForConversation(f.config).some(row => row.function.name === "propose_database"), false);
    assert.equal(toolsForAgent(f.config).some(row => row.function.name === "propose_database"), false);
  } finally { f.close(); }
});
