import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { migrationFixture, migrationBuildInput } from "../helpers/migration-fixture.ts";
import { createAgentRun, decideAgentRepair, driveAgentRun } from "../../src/server/agent/runs.ts";
import { AgentRepository } from "../../src/server/agent/store.ts";
import type { ModelPort } from "../../src/server/agent/model.ts";
import { withPostgresFixture } from "../../src/server/agent/postgres-fixture.ts";
import { runPostgresMigrationTest } from "../../src/server/agent/postgres-migration-test.ts";
import { parsePostgresMigrationTest } from "../../src/contracts/postgres-migration-test.ts";
import { AppError } from "../../src/server/errors.ts";

// Actual Docker, PostgreSQL, locked npm/Vite build, API and original tests.
// The model is synthetic; no Liara account, cloud database or stored environment is used.
test("actual Agent approval executes source-bound SQL and independently verifies API data across fresh app workers", { timeout: 600000 }, async () => {
  const f = await migrationFixture();
  try {
    assert.ok(f.flow.profile.fullstack); assert.equal(f.flow.status, "ready");
    const original = await readFile(join(f.project, "oracle.test.cjs")), originalSql = await readFile(join(f.project, "001_entries.sql"));
    const { run } = createAgentRun(f.config, f.store, f.session, randomUUID(), "migration همین source و نوشتن/خواندن API را فقط در دیتابیس موقت و محیط ایزوله بررسی کن", f.flow.id);
    let calls = 0;
    const model: ModelPort = { async complete(_messages, _tools, budget, signal) {
      budget.take("model", signal); calls++;
      const name = calls === 1 ? "propose_project_build" : "finish_investigation", args = calls === 1 ? migrationBuildInput :
        { state: "partially_completed", message: "اثر migration و ماندن داده در آزمون موقت بررسی شد؛ انتشار و دیتابیس واقعی بررسی نشده‌اند.", question: null, nextAction: "reply" };
      return { calls: [{ id: `migration-${calls}`, type: "function", function: { name, arguments: JSON.stringify(args) } }], content: null, usage: 5 };
    } };
    await driveAgentRun(f.config, f.store, f.session, run.id, { model });
    const repo = new AgentRepository(f.store), proposed = repo.get(f.session.actorId, run.id); assert.ok(proposed?.repair);
    assert.equal(proposed.state, "needs_approval"); assert.deepEqual(proposed.repair.containerIds, []);
    assert.equal(proposed.repair.build?.version, 7); assert.equal(proposed.repair.afterTest, null);
    await decideAgentRepair(f.config, f.store, f.session, proposed.id, proposed.revision, proposed.repair.id, "approve");
    await driveAgentRun(f.config, f.store, f.session, run.id, { model });
    const result = repo.get(f.session.actorId, run.id); assert.ok(result?.repair);
    assert.equal(result.repair.state, "succeeded", JSON.stringify({ code: result.repair.errorCode, message: result.repair.message, output: result.repair.afterTest?.output }));
    assert.equal(result.repair.artifact, null); assert.equal(result.repair.publication, undefined); assert.equal(result.publication, null);
    const receipt = result.repair.afterTest?.databaseMigration; assert.ok(receipt);
    assert.equal(receipt.applicationRuns, 2); assert.equal(receipt.persistenceChecks, 1); assert.equal(receipt.production, false); assert.equal(receipt.databaseRestartVerified, false);
    assert.equal(receipt.files[0]?.sha256, createHash("sha256").update(originalSql).digest("hex"));
    assert.equal(result.repair.containerIds?.length, 3); assert.equal(new Set(result.repair.containerIds).size, 3); assert.equal(result.effect, "no_remote_changes"); assert.equal(result.usage.modelCalls, 2);
    assert.ok((await readFile(join(f.project, "oracle.test.cjs"))).equals(original)); assert.ok((await readFile(join(f.project, "001_entries.sql"))).equals(originalSql));
    assert.equal(f.store.db.prepare("SELECT count(*) n FROM actions").get()?.n, 0);
    assert.ok(result.messages.some(message => message.content?.includes('"databaseRestartVerified":false')));
  } finally { f.close(); }
});

test("actual PostgreSQL rolls back partial migration and rejects checksum edits before running any application", { timeout: 180000 }, async () => {
  const bytes = await readFile(resolve("tests/fixtures/postgres-migration/001_entries.sql")),
    file = { path: "001_entries.sql", content: bytes }, checksum = createHash("sha256").update(bytes).digest("hex"), expectations = migrationBuildInput.compatibilityDatabase.migration;
  for (const kind of ["rollback", "checksum"] as const) {
    const bad = { path: "002_missing.sql", content: Buffer.from("INSERT INTO public.missing(id) VALUES(1);") }, files = kind === "rollback" ? [file, bad] : [file];
    const plan = parsePostgresMigrationTest({ files: files.map(file => ({ path: file.path, sha256: createHash("sha256").update(file.content).digest("hex") })), columns: expectations.columns, rows: expectations.rows, persistence: expectations.persistence });
    await withPostgresFixture({ jobId: randomUUID(), sourceHash: "a".repeat(64), signal: AbortSignal.timeout(60000), onCreated: () => undefined, migration: true }, async (fixture, signal, sql) => {
      if (kind === "checksum") { const seeded = await sql.apply(`INSERT INTO public._launchlane_migrations(path,sha256) VALUES('001_entries.sql','${"b".repeat(64)}');`, signal); assert.equal(seeded.exitCode, 0); assert.notEqual(checksum, "b".repeat(64)); }
      let apps = 0;
      await assert.rejects(runPostgresMigrationTest({ files, plan, fixture, sql, signal, take: () => undefined, run: async () => { apps++; return { exitCode: 0, signal: null, output: "not executed" }; } }), error => error instanceof AppError && error.code === "MIGRATION_EXECUTION_FAILED");
      assert.equal(apps, 0);
      const after = await sql.read("SELECT json_build_object('absent',pg_catalog.to_regclass('public.entries') IS NULL,'records',(SELECT count(*) FROM public._launchlane_migrations),'limited',(SELECT NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole FROM pg_catalog.pg_roles WHERE rolname='launchlane_migration_app'));", signal);
      assert.equal(after.exitCode, 0); const proof = JSON.parse(after.output.trim()); assert.equal(proof.absent, true); assert.equal(proof.limited, true); assert.equal(proof.records, kind === "rollback" ? 0 : 1);
    });
  }
});
