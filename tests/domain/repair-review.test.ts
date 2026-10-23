import assert from "node:assert/strict";
import { test } from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { AgentRepository } from "../../src/server/agent/store.ts";
import { CodeRepairAdapter } from "../../src/server/agent/code-repair.ts";
import { createAgentRun, driveAgentRun, decideAgentRepair, reviewAgentRepair } from "../../src/server/agent/runs.ts";
import type { ModelPort } from "../../src/server/agent/model.ts";

async function fixture() {
  const f = await agentFixture(), config = { ...f.config, enableLocalRepair: true };
  let requests = 0;
  const model: ModelPort = { async complete(_messages, _tools, budget, signal) {
    requests++; budget.take("model", signal);
    return { usage: 10, content: null, calls: [{ id: "repair-review", type: "function", function: { name: "propose_code_repair", arguments: JSON.stringify({ goal: "Use quantity", allowedPaths: ["invoice.mjs"], testFiles: ["invoice.test.mjs"] }) } }] };
  } };
  const { run } = createAgentRun(config, f.store, f.session, "review-proposal", "Correct the invoice quantity", f.flow.id);
  await driveAgentRun(config, f.store, f.session, run.id, { model });
  const repo = new AgentRepository(f.store), proposed = repo.get(f.session.actorId, run.id);
  assert.equal(proposed?.state, "needs_approval"); assert.ok(proposed.repair);
  const fresh = { ...f.session, id: "fresh-review-session" };
  f.store.saveSession(fresh);
  return { ...f, config, repo, proposed, fresh, requests: () => requests };
}

test("another session cannot inherit authority; reviewing creates an unapproved exact-scope replacement without model work", async () => {
  const f = await fixture();
  try {
    const before = f.proposed, old = before.repair;
    assert.ok(old);
    await assert.rejects(decideAgentRepair(f.config, f.store, f.fresh, before.id, before.revision, old.id, "approve"), { code: "REPAIR_APPROVAL_EXPIRED" });
    const reviewed = await reviewAgentRepair(f.config, f.store, f.fresh, before.id, before.revision, old.id, AbortSignal.timeout(5000));
    assert.equal(reviewed.state, "needs_approval"); assert.equal(reviewed.repair?.state, "proposed");
    assert.notEqual(reviewed.repair?.id, old.id); assert.equal(reviewed.repairDecision?.consumed, false);
    assert.equal(reviewed.repairDecision?.sessionId, f.fresh.id); assert.equal(f.requests(), 1);
    assert.equal(reviewed.usage.modelCalls, before.usage.modelCalls); assert.equal(reviewed.usage.toolCalls, before.usage.toolCalls + 1);
    assert.deepEqual(reviewed.limits, before.limits);
    assert.deepEqual(reviewed.repair?.allowedPaths, old.allowedPaths); assert.deepEqual(reviewed.repair?.testFiles, old.testFiles);
    assert.equal(reviewed.repair?.baseRevision, old.baseRevision); assert.equal(reviewed.repair?.beforeTest, null);
    assert.equal(new CodeRepairAdapter(f.config, f.store).status(f.session.actorId, old.id).state, "cancelled");
    assert.ok(reviewed.repair);
    const approved = await decideAgentRepair(f.config, f.store, f.fresh, reviewed.id, reviewed.revision, reviewed.repair.id, "approve");
    assert.equal(approved.state, "queued"); assert.equal(approved.repair?.state, "queued");
  } finally { f.close(); }
});

test("stale source, missing session and exhausted allowance cannot refresh a repair proposal", async () => {
  for (const kind of ["source", "session", "budget"] as const) {
    const f = await fixture();
    try {
      const before = f.proposed; assert.ok(before.repair);
      if (kind === "source") writeFileSync(join(f.project, "invoice.mjs"), "export const changed = true;\n");
      if (kind === "budget") { before.usage.toolCalls = before.limits.maxToolCalls; f.repo.save(f.session.actorId, before, before.revision); }
      const session = kind === "session" ? { ...f.fresh, id: "unknown-session" } : f.fresh;
      await assert.rejects(reviewAgentRepair(f.config, f.store, session, before.id, before.revision, before.repair.id, AbortSignal.timeout(5000)),
        { code: kind === "source" ? "PROJECT_CHANGED" : kind === "session" ? "AUTH_REQUIRED" : "BUDGET_EXHAUSTED" });
      assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM code_repair_jobs").get()?.n, 1);
      assert.equal(new CodeRepairAdapter(f.config, f.store).status(f.session.actorId, before.repair.id).state, "proposed");
    } finally { f.close(); }
  }
});
