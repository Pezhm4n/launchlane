import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { parseDatabaseDataObservation, parseDatabaseDataState, dataObservationId } from "../../src/contracts/database-data.ts";
import { databaseDataState, observeDatabaseData, readDatabaseDataRelease } from "../../src/server/application/database-data.ts";
import { readConfig } from "../../src/server/config.ts";
import { Store } from "../../src/server/persistence/store.ts";
import { migrations } from "../../src/server/persistence/migrations.ts";
import { executeAgentTool, currentAgentContext, toolsForAgent } from "../../src/server/agent/tools.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";
import { AppError } from "../../src/server/errors.ts";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { LiaraReadClient } from "../../src/server/liara/client.ts";
import { callMcpTool, mcpTools } from "../../src/server/mcp/server.ts";
import { object } from "../../src/contracts/validation.ts";

const observation = () => ({ id: randomUUID(), actionId: randomUUID(), releaseId: "release", artifactHash: "a".repeat(64), checkedAt: Date.now(), outcome: "verified",
  targets: [{ id: "auth", databaseId: "a".repeat(24), serverMajor: 16, columnChecks: 3, rowChecks: 1, persistenceChecks: 1,
    schemaMatches: true, rowsMatch: true, persistencePresent: true, persistenceNonNull: true }], baselineId: null, comparison: "not_requested",
  migrationVerified: false, applicationWriteVerified: false, restartPersistenceVerified: false, remoteChanges: false });
const code = (expected: string) => (error: unknown) => error instanceof AppError && error.code === expected;
test("database data receipts cannot manufacture migration, writes, restart persistence or raw data evidence", () => {
  const value = observation(), parsed = parseDatabaseDataObservation(value); assert.equal(parsed.outcome, "verified");
  for (const flag of ["migrationVerified", "applicationWriteVerified", "restartPersistenceVerified", "remoteChanges"])
    assert.throws(() => parseDatabaseDataObservation({ ...value, [flag]: true }));
  for (const extra of ["password", "privatePersistence", "rows", "connectionString"])
    assert.throws(() => parseDatabaseDataObservation({ ...value, [extra]: "private-value" }));
  assert.throws(() => parseDatabaseDataObservation({ ...value, targets: [...value.targets, value.targets[0]] }));
  assert.throws(() => parseDatabaseDataObservation({ ...value, targets: [{ ...value.targets[0], schemaMatches: false }] }));
  assert.throws(() => parseDatabaseDataObservation({ ...value, targets: [{ ...value.targets[0], persistenceChecks: 0 }] }));
  assert.throws(() => parseDatabaseDataObservation({ ...value, comparison: "same_selected_values" }));
  assert.throws(() => parseDatabaseDataObservation({ ...value, baselineId: randomUUID() }));
  const failed = { ...value, outcome: "failed", targets: [{ ...value.targets[0], schemaMatches: false, rowChecks: 0, persistenceChecks: 0, rowsMatch: false, persistencePresent: false, persistenceNonNull: false }] };
  assert.equal(parseDatabaseDataObservation(failed).outcome, "failed");
  assert.equal(parseDatabaseDataObservation({ ...failed, baselineId: randomUUID(), comparison: "not_comparable" }).comparison, "not_comparable");
  assert.throws(() => parseDatabaseDataObservation({ ...failed, baselineId: randomUUID(), comparison: "same_selected_values" }));
  assert.equal(parseDatabaseDataState({ available: true, enabled: false, latest: value }).latest?.id, value.id);
  assert.throws(() => parseDatabaseDataState({ available: true, enabled: false, latest: value, secret: "hidden" }));
  for (const invalid of ["../actions", "", "a".repeat(36), "https://private.example", null]) assert.throws(() => dataObservationId(invalid));
});
test("database data SQL gate defaults off and an unsupported/nonowned action never opens a session", async () => {
  const f = await agentFixture(); try {
    assert.equal(readConfig({}).enableDatabaseDataReads, false);
    await assert.rejects(observeDatabaseData(f.config, f.store, f.session.actorId, randomUUID(), null, AbortSignal.timeout(5000)), code("DATABASE_DATA_READS_DISABLED"));
    const config = { ...f.config, enableLiveLiara: true, enableDatabaseDataReads: true }, action = f.store.createAction(f.session.actorId,
      { version: 1, operation: "restart", scope: { teamId: "a".repeat(24), app: "sample" }, sourceHash: null, args: { port: null, planId: null } });
    await assert.rejects(observeDatabaseData(config, f.store, f.session.actorId, action.id, null, AbortSignal.timeout(5000)), code("DATABASE_PUBLICATION_REQUIRED"));
    assert.throws(() => databaseDataState(config, f.store, f.session.actorId, action.id), code("DATABASE_PUBLICATION_REQUIRED"));
    await assert.rejects(observeDatabaseData(config, f.store, "other-actor", action.id, null, AbortSignal.timeout(5000)));
    assert.equal(f.store.db.prepare("SELECT count(*) n FROM database_data_observations").get()?.n, 0);
  } finally { f.close(); }
});
test("shared Agent tool derives data SQL from the host and rejects arbitrary URLs/queries before execution", async () => {
  const f = await agentFixture(); try {
    const config = { ...f.config, enableLiveLiara: true, enableDatabaseDataReads: true }, c = { config, store: f.store, actorId: f.session.actorId,
      context: currentAgentContext(config, f.store, f.session.actorId), createdAt: Date.now(), budget: new RunBudget(config), signal: AbortSignal.timeout(5000) };
    for (const extra of ["sql", "query", "url", "host", "databaseId", "password", "oracle"])
      await assert.rejects(executeAgentTool("read_database_data", { actionId: randomUUID(), [extra]: "input" }, c), code("INVALID_INPUT"));
    await assert.rejects(executeAgentTool("read_database_data", { actionId: randomUUID() }, c), code("DATABASE_CONTEXT_REQUIRED"));
    await assert.rejects(executeAgentTool("read_database_data", { actionId: randomUUID() }, { ...c, config: { ...config, enableDatabaseDataReads: false } }), code("TOOL_DENIED"));
    assert.ok(!toolsForAgent(config, "fullstack", false, true, false, true).some(tool => tool.function.name === "read_database_data"));
    for (const preparation of ["native", "build", "fullstack"] as const) for (const hasTarget of [false, true]) for (const program of [false, true])
      for (const managed of [false, true]) for (const disk of [false, true]) assert.ok(toolsForAgent({ ...config, enableLocalRepair: true, enableMutations: true }, preparation, hasTarget, program, disk, managed).length <= 20);
    assert.equal(c.budget.modelCalls, 0); assert.equal(c.budget.toolCalls, 0);
  } finally { f.close(); }
});
test("database observations append migration22 preserving all prior history and sessions", () => {
  const dir = mkdtempSync(join(tmpdir(), "launchlane-data-migrate-")), path = join(dir, "state.sqlite"), legacy = new DatabaseSync(path);
  legacy.exec("CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,checksum TEXT NOT NULL) STRICT");
  for (const migration of migrations.filter(row => row.version <= 21)) {
    legacy.exec(migration.sql); legacy.prepare("INSERT INTO schema_migrations VALUES(?,?)").run(migration.version, createHash("sha256").update(migration.sql).digest("hex"));
  }
  legacy.prepare("INSERT INTO sessions VALUES(?,?,?)").run("data-legacy", "actor", Date.now() + 60000);
  const history = legacy.prepare("SELECT * FROM schema_migrations ORDER BY version").all(); legacy.close();
  const store = new Store(path); try {
    assert.deepEqual(store.db.prepare("SELECT * FROM schema_migrations WHERE version<=21 ORDER BY version").all(), history);
    assert.equal(store.sessionExists("data-legacy", "actor", Date.now()), true);
    assert.equal(store.db.prepare("SELECT count(*) n FROM database_data_observations").get()?.n, 0);
  } finally { store.close(); assert.ok(dir.startsWith(join(tmpdir(), "launchlane-data-migrate-"))); rmSync(dir, { recursive: true, force: true }); }
});
test("direct data routes require an explicit server-owned account/team/network allowlist", () => {
  const route = { accountId: "a".repeat(24), teamId: "b".repeat(24), networkId: "c".repeat(24) };
  assert.deepEqual(readConfig({}).databaseReadNetworks, []);
  assert.deepEqual(readConfig({ LAUNCHLANE_DATABASE_READ_NETWORKS: JSON.stringify([route]) }).databaseReadNetworks, [route]);
  for (const value of ["not-json", JSON.stringify({ routes: [route] }), JSON.stringify([route, route]), JSON.stringify([{ ...route, accountId: "unscoped" }]), JSON.stringify([{ ...route, url: "postgres://forged" }])])
    assert.throws(() => readConfig({ LAUNCHLANE_DATABASE_READ_NETWORKS: value }), code("CONFIG_INVALID"));
});
test("data release evidence follows bounded pages without mistaking an older current release for a changed one", async () => {
  const config = { ...readConfig({}), enableLiveLiara: true, liaraToken: "synthetic-read-token", teamId: "a".repeat(24), apps: ["sample"] },
    scope = { teamId: config.teamId, app: "sample" }, signal = AbortSignal.timeout(5000);
  for (const mode of ["page2", "missing", "changed", "not-ready"] as const) {
    const pages: number[] = [], read = new LiaraReadClient(config, async url => {
      const page = Number(new URL(url).searchParams.get("page")); pages.push(page); assert.equal(new URL(url).searchParams.get("count"), "50");
      return Response.json({ total: 200, currentRelease: mode === "changed" && page === 2 ? "another-release" : "accepted-release", releases:
        page === 2 && mode !== "missing" ? [{ _id: "accepted-release", state: mode === "not-ready" ? "BUILDING" : "READY", port: 3000 }]
          : Array.from({ length: 50 }, (_, i) => ({ _id: `failed-${page}-${i}`, state: "FAILED", port: 3000 })) });
    });
    const operation = readDatabaseDataRelease(read, scope, "accepted-release", new RunBudget(config), signal);
    if (mode === "page2") await operation;
    else await assert.rejects(operation, code(mode === "missing" ? "DATABASE_DATA_RELEASE_UNOBSERVED" : mode === "not-ready" ? "DATABASE_DATA_RELEASE_NOT_READY" : "DATABASE_DATA_RELEASE_CHANGED"));
    assert.deepEqual(pages, mode === "missing" ? [1, 2, 3] : [1, 2]);
  }
});
test("MCP exposes the same gated readonly data tool and cannot supply SQL or schedule a data mission", async () => {
  const f = await agentFixture(); try {
    const config = { ...f.config, enableLiveLiara: true, enableDatabaseDataReads: true }, access = { session: f.session, parentSessionId: f.session.id, missions: false },
      c = { config, store: f.store, access, schedule: () => { throw Error("A readonly data tool must not schedule a mission"); } };
    assert.ok(mcpTools(config, access).some(tool => tool.name === "read_database_data"));
    assert.ok(!mcpTools({ ...config, enableDatabaseDataReads: false }, access).some(tool => tool.name === "read_database_data"));
    for (const sql of [false, true]) {
      const result = await callMcpTool(c, "read_database_data", { actionId: randomUUID(), ...(sql ? { query: "SELECT arbitrary()" } : {}) }, AbortSignal.timeout(5000)), content = result.content?.[0];
      assert.equal(result.isError, true); assert.ok(content?.type === "text");
      assert.equal(object(object(JSON.parse(content.text)).error).code, sql ? "INVALID_INPUT" : "DATABASE_CONTEXT_REQUIRED");
    }
    assert.equal(f.store.db.prepare("SELECT count(*) n FROM agent_runs").get()?.n, 0);
    assert.equal(f.store.db.prepare("SELECT count(*) n FROM database_data_observations").get()?.n, 0);
  } finally { f.close(); }
});
