import assert from "node:assert/strict";
import { test } from "node:test";
import { missionAuthorityFixture } from "../helpers/mission-authority-fixture.ts";
import { parseCodingAgentChoice, codexWorkerModel, codexWorkerVersion } from "../../src/contracts/coding-agent.ts";
import { proposeMissionAuthority, decideMissionAuthority } from "../../src/server/application/mission-authority.ts";
import { driveAgentRun } from "../../src/server/agent/runs.ts";
import { CodexPatchModel } from "../../src/server/agent/codex-patch.ts";
import { AppError } from "../../src/server/errors.ts";
import { object, string } from "../../src/contracts/validation.ts";

const choice = parseCodingAgentChoice({ kind: "codex", mode: "packet_only", version: codexWorkerVersion, model: codexWorkerModel,
  cost: "subscription_usage_unpriced", acknowledgeUnknownCost: true, fallbackBeforeDispatch: true });
test("a genuinely missing Codex executable falls back before dispatch and the same approved mission repairs with unchanged real Node22 tests", async () => {
  const f = await missionAuthorityFixture(false, true);
  try {
    const proposed = await proposeMissionAuthority(f.config, f.store, f.session, f.proposed.id, f.proposed.revision, AbortSignal.timeout(5000),
      f.dependencies.deployment.read, f.dependencies.authorityAccount, choice);
    assert.ok(proposed.authority);
    await decideMissionAuthority(f.config, f.store, f.session, proposed.id, proposed.revision, proposed.authority.id, proposed.authority.hash, "approve");
    await driveAgentRun(f.config, f.store, f.session, proposed.id, { ...f.dependencies,
      repairModel: new CodexPatchModel(f.config, f.store, f.session.actorId, "launchlane-deliberately-missing-codex-executable") });
    const run = f.repo.get(f.session.actorId, proposed.id); assert.ok(run);
    assert.equal(run.state, "completed", JSON.stringify(run)); assert.equal(f.counts().patches, 1); assert.equal(f.counts().sends, 2);
    assert.equal(run.repair?.beforeTest?.passed, false); assert.equal(run.repair?.afterTest?.passed, true);
    assert.equal(run.events.filter(event => event.tool === "coding_fallback" && event.callId === "CODEX_UNAVAILABLE").length, 1);
    assert.equal(f.store.db.prepare("SELECT count(*) n FROM coding_agent_executions").get()?.n, 0);
    assert.equal(run.authority?.id, proposed.authority.id); assert.deepEqual(run.limits, proposed.limits);
    assert.ok(run.publication && "artifactHash" in run.publication.spec); assert.equal(run.publication.spec.artifactHash, run.repair?.artifact?.archiveHash);
  } finally { f.close(); }
});

test("a lost dispatched external response stops the same mission with no internal patch, publication or renewed allowance", async () => {
  const f = await missionAuthorityFixture(false, true);
  try {
    const proposed = await proposeMissionAuthority(f.config, f.store, f.session, f.proposed.id, f.proposed.revision, AbortSignal.timeout(5000),
      f.dependencies.deployment.read, f.dependencies.authorityAccount, choice);
    assert.ok(proposed.authority);
    await decideMissionAuthority(f.config, f.store, f.session, proposed.id, proposed.revision, proposed.authority.id, proposed.authority.hash, "approve");
    await driveAgentRun(f.config, f.store, f.session, proposed.id, { ...f.dependencies, repairModel: { complete: async (messages, _tools, budget, signal) => {
      const message = messages[1]; assert.ok(message?.role === "user"); const packet = object(JSON.parse(message.content));
      budget.take("model", signal);
      f.store.db.prepare("INSERT INTO coding_agent_executions VALUES(?,?,'uncertain',?)").run(string(packet.jobId, 36), f.session.actorId,
        JSON.stringify({ parentRunId: proposed.id, state: "uncertain", tokens: null }));
      throw new AppError("CODEX_EXECUTION_UNCERTAIN", "synthetic lost response after durable dispatch", 409);
    } } });
    const run = f.repo.get(f.session.actorId, proposed.id); assert.ok(run);
    assert.equal(run.state, "partially_completed"); assert.equal(run.errorCode, "CODING_EXECUTION_UNCERTAIN");
    assert.equal(f.counts().patches, 0); assert.equal(f.counts().sends, 0); assert.equal(run.repair?.artifact, null);
    assert.equal(run.authority?.id, proposed.authority.id); assert.deepEqual(run.limits, proposed.limits);
    assert.equal(run.usage.unknownModelCalls, 1); assert.equal(run.events.some(event => event.tool === "coding_fallback"), false);
  } finally { f.close(); }
});
