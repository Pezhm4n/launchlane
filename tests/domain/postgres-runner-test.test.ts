import assert from "node:assert/strict";
import { test } from "node:test";
import { object } from "../../src/contracts/validation.ts";
import { parseCodeRepairJob } from "../../src/contracts/code-repair.ts";
import { parseDisposableTestDatabase, type DisposableTestDatabase } from "../../src/contracts/test-database.ts";
import { parsePostgresRunnerTargets, parsePostgresRunnerTestReceipt } from "../../src/contracts/postgres-runner-test.ts";
import { executeAgentTool, currentAgentContext } from "../../src/server/agent/tools.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";
import { fingerprint } from "../../src/server/policy/action.ts";
import { AppError } from "../../src/server/errors.ts";
import { sourceMigrationRunner, runPostgresRunnerTest, runnerDataSql } from "../../src/server/agent/postgres-runner-test.ts";
import { validateTestDatabaseSource, assertPostgresWorkerBinding } from "../../src/server/agent/test-database.ts";
import { captureProject } from "../../src/server/workspace/inspect.ts";
import type { PostgresFixtureBinding } from "../../src/server/agent/postgres-fixture.ts";
import { runnerFixture, runnerBuildInput } from "../helpers/runner-fixture.ts";

const code = (expected: string) => (error: unknown) => error instanceof AppError && error.code === expected;
const signal = () => AbortSignal.timeout(10000);
const result = (output = "", exitCode = 0) => ({ output, exitCode, signal: null });
async function prepared() {
  const f = await runnerFixture();
  try {
    const input = await runnerBuildInput(), context = { config: f.config, store: f.store, actorId: f.session.actorId, context: currentAgentContext(f.config, f.store, f.session.actorId), createdAt: Date.now(), budget: new RunBudget(f.config), signal: signal() };
    const job = parseCodeRepairJob(object(await executeAgentTool("propose_project_build", input, context)).repairProposal);
    assert.ok(job.build?.version === 7 && job.build.testDatabase?.version === 3);
    const plan = job.build.testDatabase, files = (await captureProject(f.workspace, "runner-service", { signal: signal(), secrets: [] })).files;
    const fixture: PostgresFixtureBinding = { jobId: job.id, sourceHash: f.flow.profile.sourceHash, containerId: "c".repeat(64), networkMode: `container:${"c".repeat(64)}`, host: "127.0.0.1", port: 5432, database: "launchlane_fixture", user: "launchlane_fixture", authentication: "isolated_trust", targets: plan.targets.map((target, i) => ({ id: target.id, database: `launchlane_target_${i}`, user: `launchlane_app_${i}` })) };
    return { ...f, input, context, job, plan, files, fixture };
  } catch (error) { f.close(); throw error; }
}
test("the shared tool binds an original runner and all hooks and separates source-backed targets without executing or fabricating hashes", async () => {
  const f = await prepared(); try {
    assert.deepEqual(f.plan.runner.chain.map(part => part.name), ["predb:migrate", "db:migrate"]); assert.equal(f.plan.runner.sha256, sourceMigrationRunner(f.files, "db:migrate").sha256);
    assert.deepEqual(f.plan.environmentKeys, ["AUTH_DB_URL", "PROFILE_DB_URL"]); assert.deepEqual(f.plan.targets.map(target => target.id), ["auth", "profile"]);
    assert.equal(f.job.afterTest, null); assert.deepEqual(f.job.containerIds, []); assert.equal(f.job.artifact, null);
    assertPostgresWorkerBinding(f.fixture, f.job.id, f.flow.profile.sourceHash, false, f.plan.targets);
    for (const extra of [{ password: "not allowed" }, { image: "not allowed" }, { environmentKeys: ["AUTH_DB_URL"] }, { runner: f.plan.runner }])
      await assert.rejects(executeAgentTool("propose_project_build", { ...f.input, compatibilityDatabase: { ...f.input.compatibilityDatabase, ...extra } }, f.context));
    const changed = f.files.map(file => file.path === "package.json" ? { ...file, content: Buffer.from(file.content.toString("utf8").replace("node preflight.cjs", "node different.cjs")) } : file);
    assert.throws(() => validateTestDatabaseSource(changed, f.flow.profile, f.plan), code("MIGRATION_RUNNER_CHANGED"));
    assert.throws(() => sourceMigrationRunner(f.files, "missing"), code("MIGRATION_RUNNER_INVALID"));
    assert.throws(() => parseCodeRepairJob({ ...f.job, state: "succeeded", afterTest: { command: "fake", passed: true, exitCode: 0, signal: null, output: "ok", durationMs: 1 } }), code("MIGRATION_RUNNER_RECEIPT_INVALID"));
  } finally { f.close(); }
});
test("runner targets reject aliases, public/duplicate connection keys, missing or conflicting oracles and history still parses", async () => {
  const input = await runnerBuildInput(), targets = input.compatibilityDatabase.targets, first = targets[0]; assert.ok(first);
  assert.throws(() => parsePostgresRunnerTargets([{ ...first, requiredRelations: [...first.requiredRelations, "public.unobserved"] }]), code("MIGRATION_ORACLE_INVALID"));
  for (const bad of [[], [...targets, first], [{ ...first, environmentKeys: ["NEXT_PUBLIC_AUTH_DB_URL"] }], [{ ...first, id: "../../other" }], [{ ...first, oracle: { ...first.oracle, persistence: [] } }], [{ ...first, environmentKeys: ["AUTH_DB_URL", "AUTH_DB_URL"] }]]) assert.throws(() => parsePostgresRunnerTargets(bad));
  const f = await prepared(); try {
    const historical: DisposableTestDatabase = { version: 1, kind: "postgresql", purpose: "compatibility_test", image: f.plan.image, environmentKeys: ["DATABASE_URL"], requiredRelations: ["public.entries"] };
    assert.equal(fingerprint(parseDisposableTestDatabase(historical)), fingerprint(historical));
    assert.throws(() => parseDisposableTestDatabase({ ...f.plan, environmentKeys: ["AUTH_DB_URL"] }), code("MIGRATION_TARGETS_INVALID"));
    assert.throws(() => assertPostgresWorkerBinding({ ...f.fixture, targets: [...(f.fixture.targets ?? [])].reverse() }, f.job.id, f.flow.profile.sourceHash, false, f.plan.targets), code("TEST_DATABASE_BINDING_CHANGED"));
  } finally { f.close(); }
});
test("independent metadata precedes scalar-only data reads and host source SQL is never executed by the runner adapter", async () => {
  const f = await prepared(); try {
    const stages: string[] = []; let apps = 0;
    const proof = await runPostgresRunnerTest({ files: f.files, plan: f.plan, fixture: f.fixture, signal: signal(), take: () => undefined,
      run: async phase => { stages.push(phase); if (phase === "application") apps++; return result(); },
      sql: { apply: async () => { throw Error("host must not apply source SQL"); }, read: async (sql, _stopped, id) => {
        const target = f.plan.targets.find(target => target.id === id); assert.ok(target); const schema = sql.includes("pg_attribute"); stages.push(`${id}:${schema ? "schema" : "data"}`);
        if (schema) { assert.match(sql, /tn.nspname='pg_catalog'/); assert.match(sql, /ty.typtype='b'/); return result(JSON.stringify(target.oracle.columns.map((_, i) => ({ i, ok: true })))); }
        assert.equal(sql.includes("to_jsonb(t)"), false); assert.match(sql, /to_jsonb\(t\."note"\)/);
        return result(JSON.stringify({ rows: target.oracle.rows.map((_, i) => ({ i, ok: true })), persistence: [{ i: 0, present: true, value: apps ? `fresh-${id}` : null }] }));
      } } });
    assert.equal(proof.databaseRunner?.runnerHash, f.plan.runner.sha256); assert.equal(proof.databaseRunner?.planHash, fingerprint(f.plan)); assert.equal(proof.databaseRunner?.targets.length, 2);
    assert.equal(proof.databaseRunner?.production, false); assert.equal(proof.databaseRunner?.databaseRestartVerified, false); assert.deepEqual(stages.filter(stage => !stage.includes(":")), ["runner", "application", "runner", "application"]);
    assert.deepEqual(stages.slice(stages.lastIndexOf("runner") + 1, stages.lastIndexOf("application")), ["auth:schema", "auth:data", "profile:schema", "profile:data"]);
    assert.equal(parsePostgresRunnerTestReceipt(proof.databaseRunner).replay, "selected_oracles_unchanged");
  } finally { f.close(); }
});
test("missing/unsafe schema, one wrong database, unchanged data, runner replay data loss, failure and exhausted budget cannot issue proof", async () => {
  const f = await prepared(); try {
    for (const kind of ["schema", "row", "memory", "replay", "second", "runner", "budget"] as const) {
      let runners = 0, apps = 0, dataReads = 0;
      const task = () => runPostgresRunnerTest({ files: f.files, plan: f.plan, fixture: f.fixture, signal: signal(), take: () => { if (kind === "budget") throw Error("budget spent"); },
        run: async phase => { if (phase === "runner") { runners++; return result("original runner failed", kind === "runner" ? 77 : 0); } apps++; return result(); },
        sql: { apply: async () => { throw Error("denied"); }, read: async (sql, _stopped, id) => { const target = f.plan.targets.find(target => target.id === id); assert.ok(target);
          if (sql.includes("pg_attribute")) return result(JSON.stringify(target.oracle.columns.map((_, i) => ({ i, ok: kind !== "schema" }))));
          dataReads++; return result(JSON.stringify({ rows: target.oracle.rows.map((_, i) => ({ i, ok: kind !== "row" || id !== "profile" })), persistence: [{ i: 0, present: true, value: !apps || kind === "memory" || kind === "replay" && runners === 2 ? null : kind === "second" && apps === 2 ? "different" : `fresh-${id}` }] }));
        } } });
      if (kind === "runner") { const failed = await task(); assert.equal(failed.exitCode, 77); assert.equal(failed.databaseRunner, undefined); assert.equal(apps, 0); }
      else await assert.rejects(task());
      if (kind === "schema") assert.equal(dataReads, 0);
      if (kind === "replay") assert.equal(apps, 1, "data loss is caught before a second app could hide it by writing again");
      if (kind === "budget") assert.equal(runners, 0);
    }
    const changed = f.files.map(file => file.path === "package.json" ? { ...file, content: Buffer.from(file.content.toString("utf8").replace("node migrate.cjs", "node other.cjs")) } : file);
    await assert.rejects(runPostgresRunnerTest({ files: changed, plan: f.plan, fixture: f.fixture, signal: signal(), take: () => { throw Error("must not execute"); }, run: async () => result(), sql: { apply: async () => result(), read: async () => result() } }), code("MIGRATION_RUNNER_CHANGED"));
  } finally { f.close(); }
});

test("schema-only runner may start with no row but must prove an actual inserted row in every later read", async () => {
  const f = await prepared(); try {
    const plan = parseDisposableTestDatabase({ ...f.plan, targets: f.plan.targets.map(target => ({ ...target, oracle: { ...target.oracle, rows: [] } })) }); assert.ok(plan.version === 3);
    for (const missingAfterWrite of [false, true]) {
      let apps = 0;
      const task = () => runPostgresRunnerTest({ files: f.files, plan, fixture: f.fixture, signal: signal(), take: () => undefined, run: async phase => { if (phase === "application") apps++; return result(); },
        sql: { apply: async () => { throw Error("not allowed"); }, read: async (sql, _stopped, id) => { const target = plan.targets.find(target => target.id === id); assert.ok(target);
          if (sql.includes("pg_attribute")) return result(JSON.stringify(target.oracle.columns.map((_, i) => ({ i, ok: true }))));
          assert.match(sql, /'rows','\[\]'::pg_catalog.json/);
          const present = apps > 0 && !missingAfterWrite; return result(JSON.stringify({ rows: [], persistence: [{ i: 0, present, value: present ? `inserted-${id}` : null }] }));
        } } });
      if (missingAfterWrite) await assert.rejects(task(), code("MIGRATION_PERSISTENCE_FAILED"));
      else { const proof = (await task()).databaseRunner; assert.ok(proof); assert.ok(proof.targets.every(target => target.rowChecks === 0)); }
    }
  } finally { f.close(); }
});

test("runner oracles preserve quoted ORM identifier case and reject schema or identifier injection", async () => {
  const input = await runnerBuildInput(true), targets = parsePostgresRunnerTargets(input.compatibilityDatabase.targets), target = targets[0]; assert.ok(target);
  assert.deepEqual(target.requiredRelations, ["public.Records"]); assert.match(runnerDataSql(target), /FROM public\."Records"/); assert.match(runnerDataSql(target), /to_jsonb\(t\."noteValue"\)/);
  assert.throws(() => parsePostgresRunnerTargets([{ ...target, requiredRelations: ["other.Records"] }]));
  assert.throws(() => parsePostgresRunnerTargets([{ ...target, oracle: { ...target.oracle, columns: [{ relation: "public.Records", name: 'note";DROP TABLE x;', type: "text", nullable: true }] } }]));
});
