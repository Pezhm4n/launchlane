import assert from "node:assert/strict";
import { test } from "node:test";
import { parseMissionPlan } from "../../src/contracts/mission-authority.ts";
import { parseCodingAgentChoice, codexWorkerModel, codexWorkerVersion } from "../../src/contracts/coding-agent.ts";
import { proposeMissionAuthority, decideMissionAuthority } from "../../src/server/application/mission-authority.ts";
import { missionAuthorityFixture } from "../helpers/mission-authority-fixture.ts";
import { fingerprint } from "../../src/server/policy/action.ts";
import { missionAuthority } from "../../src/server/policy/mission-authority.ts";
import { AppError } from "../../src/server/errors.ts";
import { missionRepairProvider } from "../../src/server/agent/coding-provider.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";

const codexChoice = parseCodingAgentChoice({ kind: "codex", mode: "packet_only", version: codexWorkerVersion, model: codexWorkerModel,
  cost: "subscription_usage_unpriced", acknowledgeUnknownCost: true, fallbackBeforeDispatch: true });

test("coding choice is explicit; unsupported hosts, models, missing cost consent and secret fields fail closed", () => {
  assert.deepEqual(parseCodingAgentChoice({ kind: "internal" }), { kind: "internal" });
  for (const invalid of [{ ...codexChoice, kind: "claude" }, { ...codexChoice, kind: "opencode" }, { ...codexChoice, acknowledgeUnknownCost: false },
    { ...codexChoice, model: "unreviewed-model" }, { ...codexChoice, version: "codex-cli other" }, { ...codexChoice, apiKey: "unexpected" }, { kind: "internal", fallbackBeforeDispatch: true }]) {
    assert.throws(() => parseCodingAgentChoice(invalid), AppError);
  }
});

test("an unavailable external connector cannot start the internal model when fallback was not approved", async () => {
  const f = await missionAuthorityFixture(false, true);
  try {
    const proposed = await proposeMissionAuthority(f.config, f.store, f.session, f.proposed.id, f.proposed.revision, AbortSignal.timeout(5000),
      f.dependencies.deployment.read, f.dependencies.authorityAccount, parseCodingAgentChoice({ ...codexChoice, fallbackBeforeDispatch: false }));
    assert.ok(proposed.authority && proposed.repair);
    let internal = 0;
    const port = missionRepairProvider(f.config, f.store, f.session, proposed.id, { complete: async () => { internal++; throw Error("not authorized"); } },
      () => { throw Error("not authorized"); }, { complete: async () => { throw new AppError("CODEX_UNAVAILABLE", "missing", 503); } });
    const messages = [{ role: "system" as const, content: "bounded worker" }, { role: "user" as const, content: JSON.stringify({ jobId: proposed.repair.id, parentRunId: proposed.id }) }];
    await assert.rejects(port.complete(messages, [], new RunBudget(proposed.limits), AbortSignal.timeout(5000)), AppError);
    await decideMissionAuthority(f.config, f.store, f.session, proposed.id, proposed.revision, proposed.authority.id, proposed.authority.hash, "approve");
    const run = f.repo.get(f.session.actorId, proposed.id); assert.ok(run); run.state = "working"; f.repo.save(f.session.actorId, run);
    await assert.rejects(port.complete(messages, [], new RunBudget(run.limits), AbortSignal.timeout(5000)),
      (error: unknown) => error instanceof AppError && error.code === "CODEX_UNAVAILABLE");
    assert.equal(internal, 0); assert.equal(f.counts().patches, 0); assert.equal(f.counts().sends, 0);
  } finally { f.close(); }
});

test("v1 plan hashes survive; revising an unexecuted agent choice archives history and invalidates the old approval without spending a model or build slot", async () => {
  const f = await missionAuthorityFixture(false, true);
  try {
    const old = f.proposed.authority; assert.ok(old); assert.equal(old.plan.version, 1);
    assert.equal(fingerprint(parseMissionPlan(old.plan)), fingerprint(old.plan));
    assert.throws(() => parseMissionPlan({ ...old.plan, codingAgent: codexChoice }), AppError);
    const revised = await proposeMissionAuthority(f.config, f.store, f.session, f.proposed.id, f.proposed.revision, AbortSignal.timeout(5000),
      f.dependencies.deployment.read, f.dependencies.authorityAccount, codexChoice);
    assert.ok(revised.authority); assert.equal(revised.authority.plan.version, 2); assert.equal(revised.authority.plan.revision, 2);
    assert.notEqual(revised.authority.hash, old.hash); assert.notEqual(revised.authority.id, old.id);
    assert.equal(f.store.db.prepare("SELECT plan_hash FROM mission_authority_history WHERE id=?").get(old.id)?.plan_hash, old.hash);
    await assert.rejects(decideMissionAuthority(f.config, f.store, f.session, revised.id, revised.revision, old.id, old.hash, "approve"), AppError);
    const duplicate = await proposeMissionAuthority(f.config, f.store, f.session, revised.id, revised.revision, AbortSignal.timeout(5000),
      f.dependencies.deployment.read, f.dependencies.authorityAccount, codexChoice);
    assert.deepEqual(duplicate.usage, revised.usage); assert.equal(duplicate.authority?.id, revised.authority.id);
    const internal = await proposeMissionAuthority(f.config, f.store, f.session, duplicate.id, duplicate.revision, AbortSignal.timeout(5000),
      f.dependencies.deployment.read, f.dependencies.authorityAccount, { kind: "internal" });
    assert.equal(internal.authority?.plan.revision, 3); assert.equal(f.store.db.prepare("SELECT count(*) n FROM mission_authority_history").get()?.n, 2);
    assert.equal(internal.usage.modelCalls, f.proposed.usage.modelCalls); assert.equal(f.counts().patches, 0); assert.equal(f.counts().sends, 0);
    assert.equal(f.store.db.prepare("SELECT count(*) n FROM mission_steps").get()?.n, 0);
    assert.ok(internal.authority);
    await decideMissionAuthority(f.config, f.store, f.session, internal.id, internal.revision, internal.authority.id, internal.authority.hash, "approve");
    assert.equal(missionAuthority(f.store, f.session.actorId, internal.id)?.state, "approved");
  } finally { f.close(); }
});

test("fallback cannot bypass refusal, policy, budget, revocation, or an already dispatched execution", async () => {
  const f = await missionAuthorityFixture(false, true);
  try {
    const proposed = await proposeMissionAuthority(f.config, f.store, f.session, f.proposed.id, f.proposed.revision, AbortSignal.timeout(5000),
      f.dependencies.deployment.read, f.dependencies.authorityAccount, codexChoice);
    assert.ok(proposed.authority && proposed.repair);
    await decideMissionAuthority(f.config, f.store, f.session, proposed.id, proposed.revision, proposed.authority.id, proposed.authority.hash, "approve");
    const owner = f.repo.get(f.session.actorId, proposed.id); assert.ok(owner); owner.state = "working"; f.repo.save(f.session.actorId, owner);
    let internal = 0, fallback = 0;
    const messages = [{ role: "system" as const, content: "bounded worker" }, { role: "user" as const, content: JSON.stringify({ jobId: proposed.repair.id, parentRunId: proposed.id }) }];
    for (const code of ["BUDGET_EXHAUSTED", "CODEX_SCOPE_DENIED", "CODEX_TOOL_DENIED", "CODEX_EXECUTION_UNCERTAIN"]) {
      const port = missionRepairProvider(f.config, f.store, f.session, proposed.id, { complete: async () => { internal++; throw Error("unexpected internal model"); } },
        () => fallback++, { complete: async () => { throw new AppError(code, "bounded failure", 409); } });
      await assert.rejects(port.complete(messages, [], new RunBudget(owner.limits), AbortSignal.timeout(5000)), AppError);
    }
    f.store.db.prepare("INSERT INTO coding_agent_executions VALUES(?,?,'dispatched',?)").run(proposed.repair.id, f.session.actorId, JSON.stringify({ parentRunId: proposed.id }));
    const port = missionRepairProvider(f.config, f.store, f.session, proposed.id, { complete: async () => { internal++; throw Error("unexpected internal model"); } },
      () => fallback++, { complete: async () => { throw new AppError("CODEX_UNAVAILABLE", "after dispatch", 503); } });
    await assert.rejects(port.complete(messages, [], new RunBudget(owner.limits), AbortSignal.timeout(5000)), AppError);
    f.store.db.prepare("UPDATE mission_authorities SET state='revoked' WHERE id=?").run(proposed.authority.id);
    await assert.rejects(port.complete(messages, [], new RunBudget(owner.limits), AbortSignal.timeout(5000)), AppError);
    assert.equal(internal, 0); assert.equal(fallback, 0); assert.equal(f.counts().patches, 0); assert.equal(f.counts().sends, 0);
  } finally { f.close(); }
});
