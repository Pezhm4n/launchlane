import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { parseCodeRepairJob } from "../../src/contracts/code-repair.ts";
import { CodeRepairAdapter } from "../../src/server/agent/code-repair.ts";
import { createAgentRun, decideAgentRepair, reviewAgentRepair } from "../../src/server/agent/runs.ts";
import { AgentRepository } from "../../src/server/agent/store.ts";
import { currentAgentContext, executeAgentTool } from "../../src/server/agent/tools.ts";
import { AppError } from "../../src/server/errors.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";
import { agentFixture } from "../helpers/agent-fixture.ts";

const code = (expected: string) => (error: unknown) => error instanceof AppError && error.code === expected;
async function fixture() {
  const f = await agentFixture();
  f.config.enableLocalRepair = true;
  const repo = new AgentRepository(f.store), adapter = new CodeRepairAdapter(f.config, f.store);
  const created = createAgentRun(f.config, f.store, f.session, randomUUID(), "اصلاح محاسبه فاکتور", f.flow.id);
  const parent = repo.claim(f.session.actorId, created.run.id); assert.ok(parent);
  const input = { projectId: f.flow.id, parentRunId: parent.id, goal: "اعمال تعداد هر کالا در فاکتور",
    allowedPaths: ["invoice.mjs"], testFiles: ["invoice.test.mjs"], expectedSourceHash: f.flow.profile.sourceHash,
    execution: "container" as const };
  const job = await adapter.propose(f.session.actorId, input, AbortSignal.timeout(3000));
  parent.repair = job;
  parent.repairDecision = { sessionId: f.session.id, expiresAt: Date.now() + 600000, consumed: false };
  parent.state = "needs_approval";
  repo.save(f.session.actorId, parent);
  return { ...f, repo, adapter, parent, job, input };
}

test("repair correlation comes from the active host run, survives parsing, and cannot be supplied in model tool arguments", async () => {
  const f = await fixture();
  try {
    assert.equal(f.adapter.status(f.session.actorId, f.job.id).parentRunId, f.parent.id);
    const { parentRunId: _parent, ...historical } = f.job;
    assert.equal(parseCodeRepairJob(historical).parentRunId, null);
    assert.throws(() => parseCodeRepairJob({ ...historical, parentRunId: "wrong" }), code("STORAGE_INVALID"));
    await assert.rejects(f.adapter.propose("other-actor", f.input, AbortSignal.timeout(1000)), code("REPAIR_PARENT_CHANGED"));
    await assert.rejects(f.adapter.propose(f.session.actorId, { ...f.input, parentRunId: randomUUID() }, AbortSignal.timeout(1000)), code("REPAIR_PARENT_CHANGED"));
    await assert.rejects(executeAgentTool("propose_code_repair", { goal: f.input.goal, allowedPaths: f.input.allowedPaths,
      testFiles: f.input.testFiles, parentRunId: f.parent.id }, { config: f.config, store: f.store, actorId: f.session.actorId,
      context: currentAgentContext(f.config, f.store, f.session.actorId), createdAt: Date.now(),
      budget: new RunBudget(f.config), signal: AbortSignal.timeout(1000) }), code("INVALID_INPUT"));
    assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM code_repair_jobs").get()?.n, 1);
    assert.deepEqual(f.adapter.status(f.session.actorId, f.job.id).containerIds, []);
  } finally { f.close(); }
});

test("a correlated repair cannot start with a fresh, enlarged or renewed parent budget", async () => {
  const f = await fixture();
  try {
    const approved = await decideAgentRepair(f.config, f.store, f.session, f.parent.id, f.parent.revision, f.job.id, "approve");
    const parent = f.repo.claim(f.session.actorId, approved.id); assert.ok(parent);
    await assert.rejects(f.adapter.run(f.session.actorId, f.job.id, AbortSignal.timeout(1000)), code("REPAIR_SHARED_BUDGET_REQUIRED"));
    await assert.rejects(f.adapter.run(f.session.actorId, f.job.id, AbortSignal.timeout(1000), new RunBudget({ ...parent.limits,
      maxModelCalls: parent.limits.maxModelCalls + 1 })), code("REPAIR_SHARED_BUDGET_REQUIRED"));
    parent.usage.modelCalls = 1; parent.usage.toolCalls = 2; parent.usage.elapsedMs = 60000;
    f.repo.save(f.session.actorId, parent);
    const renewed = new RunBudget(parent.limits); renewed.modelCalls = 1; renewed.toolCalls = 2;
    await assert.rejects(f.adapter.run(f.session.actorId, f.job.id, AbortSignal.timeout(1000), renewed), code("REPAIR_SHARED_BUDGET_REQUIRED"));
    assert.equal(f.adapter.status(f.session.actorId, f.job.id).state, "queued");
    assert.deepEqual(f.adapter.status(f.session.actorId, f.job.id).containerIds, []);
  } finally { f.close(); }
});

test("reviewing an expired repair keeps its parent and replaces only the pending job without renewing usage", async () => {
  const f = await fixture();
  try {
    assert.ok(f.parent.repairDecision);
    f.parent.repairDecision.expiresAt = 0;
    f.repo.save(f.session.actorId, f.parent);
    const reviewed = await reviewAgentRepair(f.config, f.store, f.session, f.parent.id, f.parent.revision, f.job.id, AbortSignal.timeout(3000));
    assert.equal(reviewed.state, "needs_approval");
    assert.equal(reviewed.repair?.parentRunId, f.parent.id);
    assert.notEqual(reviewed.repair?.id, f.job.id);
    assert.equal(reviewed.usage.modelCalls, f.parent.usage.modelCalls);
    assert.equal(reviewed.usage.toolCalls, f.parent.usage.toolCalls + 1);
    assert.equal(f.adapter.status(f.session.actorId, f.job.id).state, "cancelled");
    assert.equal(reviewed.repair?.beforeTest, null);
  } finally { f.close(); }
});

test("cancelled, replaced, stale and unapproved parents cannot claim the correlated job", async () => {
  for (const change of ["cancelled", "job", "source", "approval", "session"] as const) {
    const f = await fixture();
    try {
      const approved = await decideAgentRepair(f.config, f.store, f.session, f.parent.id, f.parent.revision, f.job.id, "approve");
      const parent = f.repo.claim(f.session.actorId, approved.id); assert.ok(parent?.repair && parent.repairDecision);
      if (change === "cancelled") parent.state = "cancelled";
      if (change === "job") parent.repair = await f.adapter.propose(f.session.actorId, f.input, AbortSignal.timeout(3000));
      if (change === "source") parent.context.sourceHash = "0".repeat(64);
      if (change === "approval") parent.repairDecision.consumed = false;
      if (change === "session") f.store.revokeSession(f.session.id);
      f.repo.save(f.session.actorId, parent);
      await assert.rejects(f.adapter.run(f.session.actorId, f.job.id, AbortSignal.timeout(1000), new RunBudget(parent.limits)),
        code(change === "approval" || change === "session" ? "REPAIR_APPROVAL_EXPIRED" : "REPAIR_PARENT_CHANGED"));
      assert.equal(f.adapter.status(f.session.actorId, f.job.id).state, "queued");
      assert.deepEqual(f.adapter.status(f.session.actorId, f.job.id).containerIds, []);
    } finally { f.close(); }
  }
});
