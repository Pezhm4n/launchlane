import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID, createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runnerFixture, runnerBuildInput } from "../helpers/runner-fixture.ts";
import { createPublicationMission } from "../../src/server/application/publication-mission.ts";
import { driveAgentRun, decideAgentRepair } from "../../src/server/agent/runs.ts";
import { AgentRepository } from "../../src/server/agent/store.ts";
import type { ModelPort } from "../../src/server/agent/model.ts";
import { withPostgresFixture } from "../../src/server/agent/postgres-fixture.ts";
import { AppError } from "../../src/server/errors.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";

// Actual source runner, transaction/ledger, Node22/Vite, PostgreSQL and HTTP/original tests.
// Synthetic model only. No cloud credentials, provider resource or original project data.
for (const seedless of [false, true]) test(`structured Agent approval runs the original ${seedless ? "schema-only" : "seeded"} runner and independently verifies two databases across four fresh workers`, { timeout: 600000 }, async () => {
  const f = await runnerFixture(seedless); try {
    const paths = ["001_entries.sql", "migrate.cjs", "oracle.test.cjs", "preflight.cjs"], originals = await Promise.all(paths.map(path => readFile(join(f.project, path)))), input = await runnerBuildInput(seedless);
    const { run } = await createPublicationMission(f.config, f.store, f.session, randomUUID(), { projectId: f.flow.id, sourceHash: f.flow.profile.sourceHash, path: "/", expectedText: "Runner lifecycle" }, AbortSignal.timeout(10000));
    let calls = 0;
    const model: ModelPort = { async complete(messages, _tools, budget, signal) {
      budget.take("model", signal); calls++;
      if (calls === 2) assert.ok(messages.some(message => message.content?.includes('"kind":"disposable_postgres_runner"')));
      return { content: null, calls: [{ id: `runner-${calls}`, type: "function", function: { name: calls === 1 ? "propose_project_build" : "finish_investigation", arguments: JSON.stringify(calls === 1 ? input : { state: "partially_completed", message: "اثر runner و داده در دو دیتابیس موقت بررسی شد؛ منابع واقعی و انتشار تأیید نشده‌اند.", question: null, nextAction: "reply" }) } }], usage: 5 };
    } };
    await driveAgentRun(f.config, f.store, f.session, run.id, { model }); const repo = new AgentRepository(f.store), proposed = repo.get(f.session.actorId, run.id); assert.ok(proposed?.repair);
    assert.equal(proposed.state, "needs_approval"); assert.deepEqual(proposed.repair.containerIds, []); assert.equal(proposed.repair.afterTest, null);
    await decideAgentRepair(f.config, f.store, f.session, proposed.id, proposed.revision, proposed.repair.id, "approve");
    await driveAgentRun(f.config, f.store, f.session, run.id, { model }); const result = repo.get(f.session.actorId, run.id); assert.ok(result?.repair);
    assert.equal(result.repair.state, "succeeded", JSON.stringify({ code: result.repair.errorCode, output: result.repair.afterTest?.output, message: result.repair.message }));
    const proof = result.repair.afterTest?.databaseRunner; assert.ok(proof); assert.equal(proof.sourceHash, result.repair.postgresFixtureSourceHash);
    assert.equal(result.state, "partially_completed"); assert.equal(result.effect, "no_remote_changes"); assert.equal(result.repair.artifact, null); assert.equal(result.publication, null);
    assert.deepEqual(proof.targets, [{ id: "auth", columnChecks: seedless ? 3 : 5, rowChecks: seedless ? 0 : 2, persistenceChecks: 1 }, { id: "profile", columnChecks: seedless ? 3 : 5, rowChecks: seedless ? 0 : 2, persistenceChecks: 1 }]);
    assert.equal(proof.runnerRuns, 2); assert.equal(proof.applicationRuns, 2); assert.equal(proof.production, false); assert.equal(proof.databaseRestartVerified, false);
    assert.equal(result.repair.containerIds?.length, 5); assert.equal(new Set(result.repair.containerIds).size, 5); assert.equal(result.usage.modelCalls, 2); assert.equal(f.store.db.prepare("SELECT count(*) n FROM actions").get()?.n, 0);
    for (const [i, path] of paths.entries()) { const original = originals[i]; assert.ok(original); assert.equal(createHash("sha256").update(await readFile(join(f.project, path))).digest("hex"), createHash("sha256").update(original).digest("hex")); }
  } finally { f.close(); }
});

test("an exit-zero original runner that resets stored data on replay fails before a second application can hide the data loss", { timeout: 600000 }, async () => {
  const f = await runnerFixture(); try {
    const path = join(f.project, "migrate.cjs"), original = await readFile(path, "utf8");
    assert.equal(original.split('await client.query("COMMIT");').length, 2);
    await writeFile(path, original.replace('await client.query("COMMIT");', 'await client.query("COMMIT"); await client.query("UPDATE public.entries SET note=NULL");'));
    const flow = await prepareProjectFlow(f.config, f.store, f.session.actorId, { kind: "local", directory: "runner-service" }, AbortSignal.timeout(10000)), input = await runnerBuildInput();
    const { run } = await createPublicationMission(f.config, f.store, f.session, randomUUID(), { projectId: flow.id, sourceHash: flow.profile.sourceHash, path: "/", expectedText: "Runner lifecycle" }, AbortSignal.timeout(10000));
    let calls = 0;
    const model: ModelPort = { async complete(_messages, _tools, budget, signal) {
      budget.take("model", signal); calls++;
      return { content: null, calls: [{ id: `reset-${calls}`, type: "function", function: { name: calls === 1 ? "propose_project_build" : "finish_investigation", arguments: JSON.stringify(calls === 1 ? input : { state: "partially_completed", message: "runner داده را در اجرای دوباره پاک کرد؛ نتیجهٔ موفق یا انتشار نداریم.", question: null, nextAction: "reply" }) } }], usage: 5 };
    } };
    await driveAgentRun(f.config, f.store, f.session, run.id, { model }); const repo = new AgentRepository(f.store), proposed = repo.get(f.session.actorId, run.id); assert.ok(proposed?.repair);
    await decideAgentRepair(f.config, f.store, f.session, proposed.id, proposed.revision, proposed.repair.id, "approve");
    await driveAgentRun(f.config, f.store, f.session, run.id, { model }); const result = repo.get(f.session.actorId, run.id); assert.ok(result?.repair);
    assert.equal(result.repair.state, "failed"); assert.equal(result.repair.errorCode, "MIGRATION_REPLAY_FAILED"); assert.equal(result.repair.containerIds?.length, 4);
    assert.equal(result.repair.afterTest?.databaseRunner, undefined); assert.equal(result.repair.artifact, null); assert.equal(result.publication, null);
    assert.ok((await readFile(join(f.project, "oracle.test.cjs"))).equals(await readFile("tests/fixtures/postgres-runner/oracle.test.cjs")));
  } finally { f.close(); }
});

test("actual runner fixture exposes only a read-only non-superuser observer per target and never a host source-SQL injection path", { timeout: 120000 }, async () => {
  await withPostgresFixture({ jobId: randomUUID(), sourceHash: "a".repeat(64), targets: ["auth", "profile"], migration: true, signal: AbortSignal.timeout(90000), onCreated: () => undefined }, async (binding, signal, sql) => {
    assert.deepEqual(binding.targets?.map(target => target.database), ["launchlane_target_0", "launchlane_target_1"]);
    await assert.rejects(async () => sql.apply("CREATE TABLE public.no_host_injection(id int);", signal), error => error instanceof AppError && error.code === "MIGRATION_RUNNER_SQL_DENIED");
    await assert.rejects(async () => sql.read("SELECT 1", signal, "other"), error => error instanceof AppError && error.code === "MIGRATION_TARGET_UNKNOWN");
    for (const [i, target] of ["auth", "profile"].entries()) {
      const observed = await sql.read("SELECT json_build_object('user',current_user,'database',current_database(),'super',(SELECT rolsuper FROM pg_roles WHERE rolname=current_user),'bypass',(SELECT rolbypassrls FROM pg_roles WHERE rolname=current_user),'readonly',current_setting('transaction_read_only'),'path',current_setting('search_path'));", signal, target);
      assert.equal(observed.exitCode, 0); const row = JSON.parse(observed.output.trim()); assert.deepEqual(row, { user: "launchlane_observer", database: `launchlane_target_${i}`, super: false, bypass: true, readonly: "on", path: "pg_catalog" });
      const write = await sql.read("CREATE TABLE public.observer_write(id int);", signal, target); assert.notEqual(write.exitCode, 0);
    }
  });
});
