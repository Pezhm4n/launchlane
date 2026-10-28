import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { parseDisposableTestDatabase, postgresTestImage } from "../../src/contracts/test-database.ts";
import { parsePostgresMigrationTest, parsePostgresMigrationTestReceipt } from "../../src/contracts/postgres-migration-test.ts";
import { migrationStatements, migrationSource, runPostgresMigrationTest } from "../../src/server/agent/postgres-migration-test.ts";
import type { PostgresFixtureBinding, PostgresFixtureSql } from "../../src/server/agent/postgres-fixture.ts";
import { AppError } from "../../src/server/errors.ts";
import { fingerprint } from "../../src/server/policy/action.ts";
import { migrationBuildInput, migrationFixture } from "../helpers/migration-fixture.ts";
import { currentAgentContext, executeAgentTool } from "../../src/server/agent/tools.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";
import { parseCodeRepairJob } from "../../src/contracts/code-repair.ts";
import { object } from "../../src/contracts/validation.ts";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import { createAgentRun, driveAgentRun } from "../../src/server/agent/runs.ts";
import { AgentRepository } from "../../src/server/agent/store.ts";
import type { ModelPort } from "../../src/server/agent/model.ts";
import { randomUUID } from "node:crypto";

const sql = "-- original schema\nCREATE TABLE public.entries(id integer PRIMARY KEY, label text NOT NULL, note text);\nINSERT INTO public.entries(id,label) VALUES (7,'original datum');\n";
const sourceFile = { path: "001_entries.sql", content: Buffer.from(sql) }, source = [sourceFile], sha = createHash("sha256").update(sql).digest("hex");
const plan = parsePostgresMigrationTest({ files: [{ path: sourceFile.path, sha256: sha }], columns: [
  { relation: "public.entries", name: "id", type: "integer", nullable: false }, { relation: "public.entries", name: "label", type: "text", nullable: false }, { relation: "public.entries", name: "note", type: "text", nullable: true },
], rows: [{ relation: "public.entries", key: { column: "id", value: 7 }, values: [{ column: "label", value: "original datum" }] }], persistence: [{ relation: "public.entries", key: { column: "id", value: 7 }, column: "note" }] });
const fixture: PostgresFixtureBinding = { jobId: "11111111-1111-4111-8111-111111111111", sourceHash: "a".repeat(64), containerId: "b".repeat(64), networkMode: `container:${"b".repeat(64)}`,
  host: "127.0.0.1", port: 5432, database: "launchlane_fixture", user: "launchlane_migration_app", authentication: "isolated_trust" };
const signal = () => AbortSignal.timeout(5000), code = (expected: string) => (error: unknown) => error instanceof AppError && error.code === expected;
const result = (output = "", exitCode: number | null = 0, stopped: string | null = null) => ({ output, exitCode, signal: stopped });
const proof = (good = true, value: string | null = null) => JSON.stringify({ columns: plan.columns.map((_, i) => ({ i, ok: good })), rows: plan.rows.map((_, i) => ({ i, ok: true })), files: plan.files, persistence: [{ i: 0, present: true, value }] });

test("migration test preserves explicit file order, requires independent schema/data and keeps legacy v1 readable", () => {
  const base = { kind: "postgresql", purpose: "compatibility_test", image: postgresTestImage, environmentKeys: ["DATABASE_URL"], requiredRelations: ["public.entries"] };
  assert.equal(parseDisposableTestDatabase({ version: 1, ...base }).version, 1);
  assert.equal(parseDisposableTestDatabase({ version: 2, ...base, migration: plan }).version, 2);
  for (const migration of [{ ...plan, rows: [] }, { ...plan, columns: [] }, { ...plan, files: [...plan.files, ...plan.files] }, { ...plan, rows: [...plan.rows, ...plan.rows] }, { ...plan, persistence: [...plan.persistence, ...plan.persistence] },
    { ...plan, rows: [{ relation: "public.entries", key: { column: "id", value: 7 }, values: [{ column: "note", value: null }] }] },
    { ...plan, rows: [{ relation: "public.entries", key: { column: "token", value: "unsafe" }, values: [{ column: "id", value: 7 }] }] }]) assert.throws(() => parsePostgresMigrationTest(migration));
  assert.throws(() => parseDisposableTestDatabase({ version: 2, ...base, migration: plan, credentials: "not-allowed" }));
  const second = { path: "000_second.sql", sha256: "f".repeat(64) };
  assert.deepEqual(parsePostgresMigrationTest({ ...plan, files: [...plan.files, second] }).files, [...plan.files, second]);
});
test("SQL source is immutable, bounded and refuses psql/admin/transaction/host-ledger escapes without editing it", () => {
  assert.equal(migrationSource(source, plan)[0]?.sql, sql);
  assert.throws(() => migrationSource([{ ...sourceFile, content: Buffer.from(sql + "--changed") }], plan), code("MIGRATION_SOURCE_CHANGED"));
  for (const text of ["COMMIT;", "BEGIN; CREATE TABLE public.x(id int);", "\\! touch /tmp/escaped", "CREATE ROLE owner SUPERUSER;", "CREATE FUNCTION x() RETURNS void AS $$BEGIN END$$ LANGUAGE plpgsql;",
    'CREATE TABLE "quoted"(id int);', "DROP TABLE public._launchlane_migrations;", "UPDATE pg_catalog.pg_authid SET rolname='bad';", "CREATE TABLE public.x(id text DEFAULT 'unterminated);", "/* never closed"]) assert.throws(() => migrationStatements(text), code("MIGRATION_SQL_UNSUPPORTED"));
  assert.equal(migrationStatements("/* outer /* nested */ ok */ CREATE TABLE public.x(label text DEFAULT 'COMMIT;'); INSERT INTO public.x VALUES($tag$ROLLBACK;$tag$);").length, 2);
});
test("migration and original oracles run around two separate app lifetimes; receipt never claims a database restart or production", async () => {
  const events: string[] = [], scripts: string[] = []; let charged = 0, reads = 0;
  const db: PostgresFixtureSql = { apply: async text => { events.push("apply"); scripts.push(text); return result(); }, read: async text => { events.push("read"); assert.match(text, /pg_catalog\.pg_attribute/); assert.match(text, /count\(\*\)=1/); return result(proof(true, ++reads === 1 ? null : "written once")); } };
  const outcome = await runPostgresMigrationTest({ files: source, plan, fixture, sql: db, signal: signal(), take: () => { charged++; }, run: async () => { events.push("app"); return result("app passed"); } });
  assert.deepEqual(events, ["apply", "read", "app", "read", "apply", "app", "read"]); assert.equal(charged, 5); assert.equal(scripts[0], scripts[1]);
  const script = scripts[0]; assert.ok(script); assert.match(script, /pg_advisory_xact_lock/); assert.match(script, /migration checksum changed/);
  assert.ok(outcome.databaseMigration); assert.equal(outcome.databaseMigration.planHash, fingerprint(plan)); assert.equal(outcome.databaseMigration.production, false); assert.equal(outcome.databaseMigration.databaseRestartVerified, false);
  assert.equal(parsePostgresMigrationTestReceipt(outcome.databaseMigration).sourceHash, fixture.sourceHash);
});
test("exit-zero application output cannot replace the independent schema/data oracle or ledger", async () => {
  for (const payload of [proof(false), JSON.stringify({ columns: [], rows: [], files: plan.files }), "not json", JSON.stringify({ ...JSON.parse(proof()), files: [] })]) {
    let apps = 0;
    await assert.rejects(runPostgresMigrationTest({ files: source, plan, fixture, signal: signal(), take: () => undefined,
      sql: { apply: async () => result(), read: async () => result(payload) }, run: async () => { apps++; return result(); } })); assert.equal(apps, 0);
  }
});
test("failed/lost migration, exhausted budget, failed second app or changed data cannot issue a success receipt", async () => {
  for (const kind of ["lost", "failed", "budget", "data", "second", "memory", "changed"] as const) {
    let applies = 0, reads = 0, apps = 0;
    const task = () => runPostgresMigrationTest({ files: source, plan, fixture, signal: signal(), take: () => { if (kind === "budget") throw Error("budget spent"); },
      sql: { apply: async () => { applies++; return kind === "lost" ? result("", null, "LOST_RESPONSE") : result("", kind === "failed" ? 3 : 0); }, read: async () => { reads++; return result(proof(kind !== "data" || reads !== 3, reads === 1 || kind === "memory" ? null : kind === "changed" && reads === 3 ? "replacement value" : "written once")); } },
      run: async () => { apps++; return result("unchanged independent API/test failed", kind === "second" && apps === 2 ? 73 : 0); } });
    if (kind === "second") { const failed = await task(); assert.equal(failed.exitCode, 73); assert.equal(failed.databaseMigration, undefined); }
    else await assert.rejects(task());
    if (kind === "lost" || kind === "failed") { assert.equal(applies, 1); assert.equal(apps, 0); }
    if (kind === "budget") assert.equal(applies, 0);
  }
});
test("superuser fixture and fabricated production/restart receipt are rejected before any SQL", async () => {
  let calls = 0;
  await assert.rejects(runPostgresMigrationTest({ files: source, plan, fixture: { ...fixture, user: "launchlane_fixture" }, signal: signal(), take: () => undefined,
    sql: { apply: async () => { calls++; return result(); }, read: async () => result(proof()) }, run: async () => result() }), code("MIGRATION_ROLE_REQUIRED")); assert.equal(calls, 0);
  assert.throws(() => parsePostgresMigrationTestReceipt({ kind: "disposable_postgres_migration", production: true }));
});
test("shared build registry derives source SQL hashes and refuses model-provided identity, credentials and missing files", async () => {
  const f = await migrationFixture(); try {
    const context = { config: f.config, store: f.store, actorId: f.session.actorId, context: currentAgentContext(f.config, f.store, f.session.actorId),
      createdAt: Date.now(), budget: new RunBudget(f.config), signal: signal() };
    const result = object(await executeAgentTool("propose_project_build", migrationBuildInput, context)), job = parseCodeRepairJob(result.repairProposal);
    assert.equal(job.state, "proposed"); assert.ok(job.build?.version === 7 && job.build.testDatabase?.version === 2);
    assert.equal(job.build.testDatabase.migration.files[0]?.sha256, f.flow.profile.manifest.find(file => file.path === "001_entries.sql")?.sha256);
    assert.equal(job.afterTest, null); assert.deepEqual(job.containerIds, []); assert.equal(job.build.environment, null);
    assert.throws(() => parseCodeRepairJob({ ...job, state: "succeeded", afterTest: { command: "fake success", exitCode: 0, signal: null, output: "model says passed", durationMs: 1, passed: true } }), code("MIGRATION_RECEIPT_INVALID"));
    for (const changes of [{ sqlFiles: ["missing.sql"] }, { credentials: "not permitted" }, { files: [{ path: "001_entries.sql", sha256: "b".repeat(64) }] }, { persistence: [] }]) {
      await assert.rejects(executeAgentTool("propose_project_build", { ...migrationBuildInput, compatibilityDatabase: { ...migrationBuildInput.compatibilityDatabase,
        migration: { ...migrationBuildInput.compatibilityDatabase.migration, ...changes } } }, context));
    }
  } finally { f.close(); }
});
test("Agent may correct SQL selection after a measured migration failure only through a fresh review with unchanged data oracles", async () => {
  const f = await migrationFixture(); try {
    await writeFile(join(f.project, "002_index.sql"), "CREATE INDEX entries_label ON public.entries(label);\n");
    await prepareProjectFlow(f.config, f.store, f.session.actorId, { kind: "local", directory: "migration-service" }, signal());
    const context = { config: f.config, store: f.store, actorId: f.session.actorId, context: currentAgentContext(f.config, f.store, f.session.actorId), createdAt: Date.now(), budget: new RunBudget(f.config), signal: signal() };
    const input = (sqlFiles: string[]) => ({ ...migrationBuildInput, compatibilityDatabase: { ...migrationBuildInput.compatibilityDatabase, migration: { ...migrationBuildInput.compatibilityDatabase.migration, sqlFiles } } });
    const first = parseCodeRepairJob(object(await executeAgentTool("propose_project_build", input(["002_index.sql", "001_entries.sql"]), context)).repairProposal);
    const failed = { ...first, state: "failed" as const, errorCode: "MIGRATION_EXECUTION_FAILED" };
    const next = parseCodeRepairJob(object(await executeAgentTool("propose_project_build", input(["001_entries.sql", "002_index.sql"]), { ...context, buildJob: failed })).repairProposal);
    assert.notEqual(next.id, first.id); assert.equal(next.state, "proposed"); assert.equal(next.afterTest, null); assert.deepEqual(next.containerIds, []);
    assert.ok(next.build?.version === 7 && next.build.testDatabase?.version === 2 && first.build?.version === 7 && first.build.testDatabase?.version === 2);
    assert.deepEqual(next.build.testDatabase.migration.columns, first.build.testDatabase.migration.columns); assert.deepEqual(next.build.testDatabase.migration.persistence, first.build.testDatabase.migration.persistence);
    await assert.rejects(executeAgentTool("propose_project_build", input(["001_entries.sql", "002_index.sql"]), { ...context, buildJob: { ...failed, errorCode: "CACHE_INTEGRITY" } }), code("MIGRATION_SELECTION_REVIEW_REQUIRED"));
    const weakened = input(["001_entries.sql", "002_index.sql"]); weakened.compatibilityDatabase.migration.rows = [];
    await assert.rejects(executeAgentTool("propose_project_build", weakened, { ...context, buildJob: failed }));
  } finally { f.close(); }
});

test("the real-model contradictory null expectation returns actionable feedback and the same Agent loop can correct only the invalid proposal", async () => {
  const f = await migrationFixture(); try {
    let calls = 0;
    const model: ModelPort = { async complete(messages, _tools, budget, stopped) {
      budget.take("model", stopped); calls++;
      if (calls === 2) {
        const feedback = messages.findLast(message => message.role === "tool"); assert.ok(feedback);
        const error = object(object(JSON.parse(feedback.content)).error);
        assert.equal(error.code, "MIGRATION_PERSISTENCE_CONFLICT"); assert.match(String(error.message), /null/); assert.match(String(error.message), /معیار نوشتن و ماندگاری را حذف نکنید/);
      }
      const args = calls === 1 ? { ...migrationBuildInput, compatibilityDatabase: { ...migrationBuildInput.compatibilityDatabase,
        migration: { ...migrationBuildInput.compatibilityDatabase.migration, rows: [{ relation: "public.entries", key: { column: "id", value: 7 }, values: [{ column: "label", value: "original datum" }, { column: "note", value: null }] }] } } } : migrationBuildInput;
      return { content: null, calls: [{ id: `conflict-${calls}`, type: "function", function: { name: "propose_project_build", arguments: JSON.stringify(args) } }], usage: 5 };
    } };
    const run = createAgentRun(f.config, f.store, f.session, randomUUID(), "migration و نوشتن و حفظ داده را در محیط موقت پیشنهاد کن", f.flow.id).run;
    await driveAgentRun(f.config, f.store, f.session, run.id, { model });
    const result = new AgentRepository(f.store).get(f.session.actorId, run.id); assert.ok(result?.repair);
    assert.equal(calls, 2); assert.equal(result.state, "needs_approval"); assert.equal(result.repair.afterTest, null); assert.deepEqual(result.repair.containerIds, []);
    assert.ok(result.repair.build?.version === 7 && result.repair.build.testDatabase?.version === 2);
    assert.deepEqual(result.repair.build.testDatabase.migration.persistence, migrationBuildInput.compatibilityDatabase.migration.persistence);
    assert.deepEqual(result.repair.build.testDatabase.migration.rows, migrationBuildInput.compatibilityDatabase.migration.rows);
    assert.equal(f.store.db.prepare("SELECT count(*) n FROM actions").get()?.n, 0);
  } finally { f.close(); }
});
