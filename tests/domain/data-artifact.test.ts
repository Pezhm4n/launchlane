import assert from "node:assert/strict";
import { test } from "node:test";
import { object } from "../../src/contracts/validation.ts";
import { parseCodeRepairJob } from "../../src/contracts/code-repair.ts";
import { parseDisposableTestDatabase } from "../../src/contracts/test-database.ts";
import { executeAgentTool, currentAgentContext } from "../../src/server/agent/tools.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";
import { fingerprint } from "../../src/server/policy/action.ts";
import { AppError } from "../../src/server/errors.ts";
import { runnerFixture, runnerBuildInput } from "../helpers/runner-fixture.ts";
import { assertPreparedDatabaseBindings } from "../../src/server/environment/prepared-database.ts";
import { bindDataArtifactResources } from "../helpers/data-artifact-bindings.ts";
import { assembleFullstackArtifact } from "../../src/server/agent/fullstack-artifact.ts";

const signal = () => AbortSignal.timeout(15000), code = (expected: string) => (error: unknown) => error instanceof AppError && error.code === expected;
test("artifact preparation is a distinct explicit approval with unchanged source runner and independent data targets", async () => {
  const f = await runnerFixture(); try {
    const input = await runnerBuildInput(), context = { config: f.config, store: f.store, actorId: f.session.actorId, context: currentAgentContext(f.config, f.store, f.session.actorId), createdAt: Date.now(), budget: new RunBudget(f.config), signal: signal() };
    const legacy = parseCodeRepairJob(object(await executeAgentTool("propose_project_build", input, context)).repairProposal);
    const prepared = parseCodeRepairJob(object(await executeAgentTool("propose_project_build", { ...input, compatibilityDatabase: { ...input.compatibilityDatabase, prepareArtifact: true } }, context)).repairProposal);
    assert.ok(legacy.build?.version === 7 && legacy.build.testDatabase?.version === 3);
    assert.ok(prepared.build?.version === 7 && prepared.build.testDatabase?.version === 4);
    const database = prepared.build.testDatabase;
    assert.equal(database.purpose, "prepare_artifact"); assert.deepEqual(database.runner, legacy.build.testDatabase.runner); assert.deepEqual(database.targets, legacy.build.testDatabase.targets);
    assert.notEqual(fingerprint(legacy.build), fingerprint(prepared.build)); assert.equal(prepared.artifact, null); assert.equal(prepared.afterTest, null); assert.equal(prepared.build.environment, null);
    assert.equal("sourceEnvironment" in prepared.build, false); assert.equal(prepared.containerIds?.length, 0);
    assert.throws(() => parseDisposableTestDatabase({ ...database, version: 3 })); assert.throws(() => parseDisposableTestDatabase({ ...database, purpose: "compatibility_test" }));
    await assert.rejects(executeAgentTool("propose_project_build", { ...input, compatibilityDatabase: { ...input.compatibilityDatabase, prepareArtifact: false } }, context));
    assert.throws(() => parseCodeRepairJob({ ...prepared, state: "succeeded", afterTest: { command: "fake", exitCode: 0, signal: null, durationMs: 1, passed: true, output: "green" } }), code("MIGRATION_RUNNER_RECEIPT_INVALID"));
    assert.throws(() => assertPreparedDatabaseBindings(f.store, f.config.sessionSecret, f.session.actorId, f.flow, database), code("DATABASE_BINDING_REQUIRED"));
    const assembly = { stateDir: f.config.stateDir, store: f.store, actorId: f.session.actorId, workspace: f.project, sourceHash: f.flow.profile.sourceHash,
      plan: prepared.build, signal: signal(), secrets: [], receipt: { version: 1 as const, sourceHash: f.flow.profile.sourceHash, planHash: fingerprint(prepared.build), artifactHash: "0".repeat(64), bytes: 1, fileCount: 1, totalBytes: 1 } };
    await assert.rejects(assembleFullstackArtifact(assembly), code("MIGRATION_RUNNER_RECEIPT_INVALID"));
    const proof = { kind: "disposable_postgres_runner" as const, sourceHash: f.flow.profile.sourceHash, planHash: fingerprint(legacy.build.testDatabase), runnerHash: database.runner.sha256,
      targets: database.targets.map(target => ({ id: target.id, columnChecks: target.oracle.columns.length, rowChecks: target.oracle.rows.length, persistenceChecks: target.oracle.persistence.length })),
      runnerRuns: 2 as const, applicationRuns: 2 as const, replay: "selected_oracles_unchanged" as const, databaseRestartVerified: false as const, production: false as const, checkedAt: Date.now() };
    await assert.rejects(assembleFullstackArtifact({ ...assembly, databaseRunner: proof }), code("MIGRATION_RUNNER_RECEIPT_INVALID"));
    const artifactProof = { ...proof, planHash: fingerprint(database) }, output = { ...assembly.receipt, sourceHash: artifactProof.sourceHash },
      publication = { version: 1, testedSourceHash: artifactProof.sourceHash, planHash: output.planHash, outputArtifactHash: output.artifactHash },
      receipt = { command: "synthetic compiled data preparation", exitCode: 0, signal: null, durationMs: 1, passed: true, output: "synthetic", databaseRunner: artifactProof, buildOutput: output };
    assert.notEqual(artifactProof.planHash, output.planHash);
    const completed = { ...prepared, state: "succeeded", artifact: f.flow.artifact, postgresFixtureSourceHash: artifactProof.sourceHash, publication, afterTest: receipt };
    assert.equal(parseCodeRepairJob(completed).publication?.planHash, output.planHash);
    for (const changed of [{ ...publication, planHash: artifactProof.planHash }, { ...publication, testedSourceHash: "f".repeat(64) }, { ...publication, outputArtifactHash: "f".repeat(64) }])
      assert.throws(() => parseCodeRepairJob({ ...completed, publication: changed }), code("MIGRATION_RUNNER_RECEIPT_INVALID"));
    const previous = parseCodeRepairJob({ ...legacy, state: "succeeded", postgresFixtureSourceHash: f.flow.profile.sourceHash,
      afterTest: { command: "synthetic original-runner receipt", exitCode: 0, signal: null, durationMs: 1, passed: true, output: "synthetic", databaseRunner: proof } });
    const promoted = parseCodeRepairJob(object(await executeAgentTool("propose_project_build", { ...input, compatibilityDatabase: { ...input.compatibilityDatabase, prepareArtifact: true } }, { ...context, buildJob: previous })).repairProposal);
    assert.equal(promoted.state, "proposed"); assert.equal(promoted.afterTest, null); assert.equal(promoted.artifact, null);
    const first = input.compatibilityDatabase.targets[0]; assert.ok(first);
    await assert.rejects(executeAgentTool("propose_project_build", { ...input, compatibilityDatabase: { ...input.compatibilityDatabase, prepareArtifact: true,
      targets: [{ ...first, oracle: { ...first.oracle, rows: [] } }, ...input.compatibilityDatabase.targets.slice(1)] } }, { ...context, buildJob: previous }), code("MISSION_EXPECTATION_CHANGED"));
  } finally { f.close(); }
});

for (const collapse of [false, true]) test(`data preparation ${collapse ? "rejects collapsing two tested targets to one real resource" : "accepts every separately approved exact resource and private binding"}`, async () => {
  const f = await runnerFixture(); try {
    const input = await runnerBuildInput(), job = parseCodeRepairJob(object(await executeAgentTool("propose_project_build", { ...input, compatibilityDatabase: { ...input.compatibilityDatabase, prepareArtifact: true } },
      { config: f.config, store: f.store, actorId: f.session.actorId, context: currentAgentContext(f.config, f.store, f.session.actorId), createdAt: Date.now(), budget: new RunBudget(f.config), signal: signal() })).repairProposal);
    assert.ok(job.build?.version === 7 && job.build.testDatabase?.version === 4); const plan = job.build.testDatabase;
    const bound = await bindDataArtifactResources(f, collapse); assert.equal(bound.values.length, 2); assert.equal(bound.actions.length, 2);
    if (collapse) assert.throws(() => assertPreparedDatabaseBindings(f.store, f.config.sessionSecret, f.session.actorId, f.flow, plan), code("DATABASE_TARGETS_COLLAPSED"));
    else {
      assertPreparedDatabaseBindings(f.store, f.config.sessionSecret, f.session.actorId, f.flow, plan);
      const requirements = f.flow.profile.applicationRequirements; assert.ok(requirements);
      const unknownFlow = { ...f.flow, profile: { ...f.flow.profile, applicationRequirements: { ...requirements, requirements: requirements.requirements.map(need => ({ ...need, need: "unknown" as const })) } } };
      assertPreparedDatabaseBindings(f.store, f.config.sessionSecret, f.session.actorId, unknownFlow, plan);
      f.store.db.prepare("UPDATE database_environment_bindings SET database_action_id=? WHERE database_action_id=?").run(bound.actions[0] ?? "", bound.actions[1] ?? "");
      assert.throws(() => assertPreparedDatabaseBindings(f.store, f.config.sessionSecret, f.session.actorId, f.flow, plan));
      assert.throws(() => assertPreparedDatabaseBindings(f.store, f.config.sessionSecret, f.session.actorId, unknownFlow, plan));
    }
  } finally { f.close(); }
});
