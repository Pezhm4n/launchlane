import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { missionAuthorityFixture } from "../helpers/mission-authority-fixture.ts";
import { decideMissionAuthority, checkMissionCost } from "../../src/server/application/mission-authority.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";
import { assertMissionJob, assertMissionJobExecution, assertMissionPublication, missionAuthority, reserveMissionStep } from "../../src/server/policy/mission-authority.ts";
import { parseAgentView } from "../../src/contracts/agent.ts";
import { agentView } from "../../src/server/agent/store.ts";
import { AppError } from "../../src/server/errors.ts";
import type { Action } from "../../src/contracts/domain.ts";

function code(expected: string) { return (error: unknown) => error instanceof AppError && error.code === expected; }

test("plan decisions bind actor/session/revision/hash, reject replay and atomically reserve the first build", async () => {
  const f = await missionAuthorityFixture(), a = f.proposed.authority;
  try {
    assert.ok(a); assert.ok(f.proposed.repair); assert.equal(f.counts().sends, 0);
    assert.deepEqual(parseAgentView(agentView(f.proposed)).authority, a);
    assert.equal(parseAgentView({ ...agentView(f.proposed), authority: undefined }).authority, null, "historical views remain readable");
    await assert.rejects(decideMissionAuthority(f.config, f.store, { ...f.session, actorId: "someone-else" }, f.proposed.id, f.proposed.revision, a.id, a.hash, "approve"), code("PLAN_CONFLICT"));
    const other = { ...f.session, id: "other-valid-session" }; f.store.saveSession(other);
    await assert.rejects(decideMissionAuthority(f.config, f.store, other, f.proposed.id, f.proposed.revision, a.id, a.hash, "approve"), code("PLAN_CONFLICT"));
    await assert.rejects(decideMissionAuthority(f.config, f.store, f.session, f.proposed.id, f.proposed.revision, a.id, "0".repeat(64), "approve"), code("PLAN_CONFLICT"));
    f.store.db.exec("CREATE TRIGGER prevent_plan_run_update BEFORE UPDATE ON agent_runs BEGIN SELECT RAISE(ABORT,'simulated storage failure'); END");
    await assert.rejects(decideMissionAuthority(f.config, f.store, f.session, f.proposed.id, f.proposed.revision, a.id, a.hash, "approve"));
    assert.equal(missionAuthority(f.store, f.session.actorId, f.proposed.id)?.state, "proposed");
    assert.equal(f.store.db.prepare("SELECT count(*) n FROM mission_steps").get()?.n, 0);
    f.store.db.exec("DROP TRIGGER prevent_plan_run_update");
    const run = await decideMissionAuthority(f.config, f.store, f.session, f.proposed.id, f.proposed.revision, a.id, a.hash, "approve");
    assert.equal(run.state, "queued"); assert.equal(run.repair?.state, "queued"); assert.equal(run.repairDecision?.expiresAt, a.plan.expiresAt);
    await assert.rejects(decideMissionAuthority(f.config, f.store, f.session, f.proposed.id, f.proposed.revision, a.id, a.hash, "approve"), code("PLAN_CONFLICT"));
    assert.equal(f.store.db.prepare("SELECT count(*) n FROM mission_steps").get()?.n, 1);
    f.prices.hourly++;
    await assert.rejects(checkMissionCost(f.config, f.store, f.session, a, new RunBudget(f.config), AbortSignal.timeout(5000), f.dependencies.authorityAccount), code("PLAN_COST_CHANGED"));
    assert.equal(f.counts().sends, 0);
  } finally { f.close(); }
});

test("job authority rejects changed commands, files, unproven ancestry, expiry, revoked sessions and exhausted repair attempts before execution", async () => {
  const f = await missionAuthorityFixture(), a = f.proposed.authority;
  try {
    assert.ok(a); const run = await decideMissionAuthority(f.config, f.store, f.session, f.proposed.id, f.proposed.revision, a.id, a.hash, "approve");
    const authority = run.authority, job = run.repair; assert.ok(authority && job?.build); const build = job.build;
    assert.ok(build.version === 1, "the fixture authorizes its explicit Node22 plan");
    assertMissionJobExecution(f.store, f.session.actorId, f.session.id, job);
    assert.throws(() => assertMissionJob(f.store, f.session.actorId, f.session.id, authority, { ...job, build: { ...build, startCommand: "node another.mjs" } }), code("PLAN_REPAIR_SCOPE"));
    assert.throws(() => assertMissionJob(f.store, f.session.actorId, f.session.id, authority, { ...job, allowedPaths: ["package.json"] }), code("PLAN_REPAIR_SCOPE"));
    assert.throws(() => assertMissionJob(f.store, f.session.actorId, f.session.id, authority, { ...job, baseRevision: "9".repeat(64) }), code("PLAN_LINEAGE_INVALID"));
    assert.throws(() => assertMissionJobExecution(f.store, f.session.actorId, f.session.id, { ...job, allowedPaths: ["server.mjs"] }), code("PLAN_CHANGED"));
    reserveMissionStep(f.store, f.session.actorId, f.session, authority, "repair", randomUUID(), "1".repeat(64));
    reserveMissionStep(f.store, f.session.actorId, f.session, authority, "repair", randomUUID(), "2".repeat(64));
    assert.throws(() => reserveMissionStep(f.store, f.session.actorId, f.session, authority, "repair", randomUUID(), "3".repeat(64)), code("PLAN_ATTEMPT_LIMIT"));
    f.store.db.prepare("DELETE FROM sessions WHERE id=?").run(f.session.id);
    assert.throws(() => assertMissionJobExecution(f.store, f.session.actorId, f.session.id, job), code("PLAN_AUTHORITY_EXPIRED"));
    f.store.saveSession(f.session);
    f.store.db.prepare("UPDATE mission_authorities SET state='revoked' WHERE id=?").run(a.id);
    assert.throws(() => assertMissionJobExecution(f.store, f.session.actorId, f.session.id, job), code("PLAN_AUTHORITY_EXPIRED"));
    assert.equal(f.store.db.prepare("SELECT count(*) n FROM attempts").get()?.n, 0);
  } finally { f.close(); }
});

test("the root hash cannot stand in for an untested or changed publication and recovery revokes unused program authority", async () => {
  const f = await missionAuthorityFixture(), a = f.proposed.authority;
  try {
    assert.ok(a); const run = await decideMissionAuthority(f.config, f.store, f.session, f.proposed.id, f.proposed.revision, a.id, a.hash, "approve");
    const authority = run.authority; assert.ok(authority);
    const action: Action = { id: randomUUID(), actorId: f.session.actorId, hash: "f".repeat(64), state: "awaiting_approval", createdAt: Date.now(), expiresAt: a.plan.expiresAt, attemptId: null, remoteId: null, errorCode: null,
      spec: { version: 7, operation: "deploy", accountId: a.plan.target.accountId, scope: { teamId: a.plan.target.teamId, app: a.plan.target.app },
        targetAppId: a.plan.target.appId, args: { planId: a.plan.target.planId, port: a.plan.build.port }, nodeVersion: "22",
        artifactHash: a.plan.rootArtifactHash, sourceHash: a.plan.rootSourceHash, projectFlowId: f.flow.id, selectionHash: f.flow.selectionHash,
        workload: { ...a.plan.build.workload, origin: a.plan.target.origin } } };
    assert.throws(() => assertMissionPublication(f.store, f.session.actorId, f.session.id, authority, action), code("PLAN_BUILD_REQUIRED"));
    assert.equal(action.spec.version, 7); if (action.spec.version !== 7) throw new Error("fixture contract"); const spec = action.spec;
    assert.throws(() => assertMissionPublication(f.store, f.session.actorId, f.session.id, authority, { ...action, spec: { ...spec, args: { port: 3000, planId: "expensive-plan" } } }), code("PLAN_PUBLICATION_SCOPE"));
    f.repo.recover(); assert.equal(missionAuthority(f.store, f.session.actorId, run.id)?.state, "revoked");
    assert.equal(f.repo.get(f.session.actorId, run.id)?.state, "interrupted");
    assert.equal(f.counts().sends, 0);
  } finally { f.close(); }
});

test("rejecting a program never grants its local job authority", async () => {
  const f = await missionAuthorityFixture(), a = f.proposed.authority;
  try {
    assert.ok(a); const rejected = await decideMissionAuthority(f.config, f.store, f.session, f.proposed.id, f.proposed.revision, a.id, a.hash, "reject");
    assert.equal(rejected.state, "needs_input"); assert.equal(rejected.repair?.state, "cancelled");
    assert.equal(f.store.db.prepare("SELECT count(*) n FROM mission_steps").get()?.n, 0); assert.equal(f.counts().sends, 0);
  } finally { f.close(); }
});
