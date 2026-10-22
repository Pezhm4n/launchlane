import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { createPublicationMission, resumePublicationMission } from "../../src/server/application/publication-mission.ts";
import { AgentRepository, agentView } from "../../src/server/agent/store.ts";
import { executeAgentTool, currentAgentContext } from "../../src/server/agent/tools.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";
import { AppError } from "../../src/server/errors.ts";
import { parsePublicationInput } from "../../src/contracts/publication-mission.ts";
import { workbenchLocation } from "../../src/contracts/navigation.ts";
import { createAgentRun, driveAgentRun } from "../../src/server/agent/runs.ts";
import { GoalModelClient } from "../../src/server/agent/model.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import { CodeRepairAdapter } from "../../src/server/agent/code-repair.ts";
import { sealCredential } from "../../src/server/connections/credentials.ts";

const errorCode = (code: string) => (error: unknown) => error instanceof AppError && error.code === code;

test("account setup continues the same mission and seeded allowance; two resume keys join one continuation", async () => {
  const f = await agentFixture();
  try {
    const config = { ...f.config, teamId: "a".repeat(24) }, input = { projectId: f.flow.id, sourceHash: f.flow.profile.sourceHash, path: "/", expectedText: "invoice ready" };
    const initial = await createPublicationMission(config, f.store, f.session, randomUUID(), input, AbortSignal.timeout(5000)), repo = new AgentRepository(f.store), run = initial.run;
    run.state = "needs_input"; run.nextAction = "connect_account"; run.question = "حساب را متصل کنید.";
    run.usage.modelCalls = 3; run.usage.toolCalls = 2; run.usage.elapsedMs = 100;
    repo.save(f.session.actorId, run);
    f.store.saveConnection(f.session.actorId, { source: "token", ciphertext: sealCredential("synthetic-resume-credential", config.sessionSecret, f.session.actorId, "liara"),
      view: { provider: "liara", status: "connected", identityId: "b".repeat(24), displayName: "حساب آزمون", login: "test@example.test", checkedAt: Date.now(),
        teamId: config.teamId, teamName: "تیم آزمون", apps: [], selectedApp: null } });
    const duplicate = await createPublicationMission(config, f.store, f.session, randomUUID(), input, AbortSignal.timeout(5000));
    assert.equal(duplicate.created, false); assert.equal(duplicate.run.id, run.id);
    const keys = [randomUUID(), randomUUID()], resumed = await Promise.all(keys.map(key => resumePublicationMission(config, f.store, f.session, run.id, run.revision, key, AbortSignal.timeout(5000))));
    assert.equal(resumed.filter(value => value.created).length, 1);
    for (const value of resumed) {
      assert.equal(value.run.id, run.id); assert.equal(value.run.state, "queued"); assert.equal(value.run.usage.modelCalls, 3);
      assert.equal(value.run.usage.toolCalls, 2); assert.equal(value.run.usage.elapsedMs, 100); assert.equal(value.run.context.account?.accountId, "b".repeat(24));
      assert.equal(value.run.mission?.expectedText, input.expectedText); assert.equal(value.run.effect, "no_remote_changes");
    }
    assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM agent_runs").get()?.n, 1);
    assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM attempts").get()?.n, 0);
    const joined = await createPublicationMission(config, f.store, f.session, randomUUID(), input, AbortSignal.timeout(5000));
    assert.equal(joined.run.id, run.id); assert.equal(joined.created, false);
  } finally { f.close(); }
});
test("structured publication joins concurrent registrations and replays without model or write; project history is scoped", async () => {
  const f = await agentFixture();
  try {
    const input = { projectId: f.flow.id, sourceHash: f.flow.profile.sourceHash, path: "/", expectedText: "invoice ready" };
    const values = await Promise.all([randomUUID(), randomUUID()].map(key => createPublicationMission(f.config, f.store, f.session, key, input, AbortSignal.timeout(5000))));
    assert.equal(values.filter(value => value.created).length, 1);
    assert.equal(values[0]?.run.id, values[1]?.run.id);
    const repo = new AgentRepository(f.store), run = values[0]?.run;
    assert.ok(run);
    assert.equal(run.mission?.sourceHash, input.sourceHash);
    assert.equal(run.context.sourceHash, input.sourceHash);
    assert.deepEqual(run.usage, { modelCalls: 0, toolCalls: 0, observedTokens: 0, unknownModelCalls: 0, elapsedMs: 0 });
    assert.equal(repo.forProject(f.session.actorId, randomUUID()), null);
    assert.equal(repo.forProject("another-actor", input.projectId), null);
    const original = JSON.stringify(agentView(run));
    assert.equal(JSON.stringify(agentView(repo.forProject(f.session.actorId, input.projectId)!)), original);
    assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM attempts").get()?.n, 0);
    assert.throws(() => f.store.assertAgentIdle(f.session.actorId), errorCode("AGENT_BUSY"));
    await assert.rejects(createPublicationMission(f.config, f.store, f.session, randomUUID(), { ...input, sourceHash: "0".repeat(64) }, AbortSignal.timeout(5000)), errorCode("PROJECT_CHANGED"));
  } finally { f.close(); }
});
test("publication validates source, server-owned fields, probe paths and secret-free expectations before creating work", async () => {
  const input = { projectId: randomUUID(), sourceHash: "a".repeat(64), path: "/", expectedText: null };
  for (const path of ["https://other.test/", "//other.test", "/?secret=value", "/a#b", "/a\\b", "/a\u0001"]) assert.throws(() => parsePublicationInput({ ...input, path }));
  for (const field of ["approved", "command", "artifactHash", "accountId"]) assert.throws(() => parsePublicationInput({ ...input, [field]: true }));
  const f = await agentFixture();
  try {
    await assert.rejects(createPublicationMission({ ...f.config, enableLiveModel: false }, f.store, f.session, randomUUID(), input, AbortSignal.timeout(5000)), errorCode("LIVE_MODEL_DISABLED"));
    assert.equal(new AgentRepository(f.store).get(f.session.actorId), null);
  } finally { f.close(); }
});
test("a publication tool cannot relax either the structured criterion or a prior failed publication", async () => {
  const f = await agentFixture();
  try {
    const c = { config: f.config, store: f.store, actorId: f.session.actorId, context: currentAgentContext(f.config, f.store, f.session.actorId), createdAt: Date.now(),
      budget: new RunBudget(f.config), signal: AbortSignal.timeout(5000),
      mission: { kind: "publication" as const, identity: "a".repeat(64), projectId: f.flow.id, sourceHash: f.flow.profile.sourceHash, path: "/orders", expectedText: "orders-ready" } };
    for (const args of [{ path: "/", status: 200, assertion: { kind: "text", contains: "orders-ready" } }, { path: "/orders", status: 200, assertion: { kind: "text", contains: "anything" } }]) {
      await assert.rejects(executeAgentTool("propose_publication", args, { ...c, config: { ...f.config, enableMutations: true, enableLiveLiara: true } }), errorCode("MISSION_EXPECTATION_CHANGED"));
    }
    await assert.rejects(executeAgentTool("propose_publication", { path: "/orders", status: 200, assertion: { kind: "text", contains: "orders-ready" } }, { ...c, config: { ...f.config, enableMutations: true, enableLiveLiara: true }, publicationExpectation: { origin: "https://sample.test", path: "/orders", status: 200, assertion: { kind: "json", field: "total", equals: 73 } } }), errorCode("MISSION_EXPECTATION_CHANGED"));
    assert.equal(c.budget.toolCalls, 0);
  } finally { f.close(); }
});
test("navigation has two destinations; missing, invalid and historical agent links map to publication preserving valid project", () => {
  const id = randomUUID();
  for (const view of ["", "agent", "publish", "unsupported"]) assert.deepEqual(workbenchLocation(`?view=${view}&project=${id}`), { mode: "source", project: id });
  assert.deepEqual(workbenchLocation(`?view=incident&project=${id}`), { mode: "incident", project: id });
  assert.deepEqual(workbenchLocation("?view=publish&project=" + "-".repeat(36)), { mode: "source", project: null });
});
test("optional questions have read tools only and cannot replace the durable publication view", async () => {
  const f = await agentFixture();
  try {
    const mission = (await createPublicationMission(f.config, f.store, f.session, randomUUID(), { projectId: f.flow.id, sourceHash: f.flow.profile.sourceHash, path: "/", expectedText: null }, AbortSignal.timeout(5000))).run;
    const repo = new AgentRepository(f.store);
    mission.state = "partially_completed";
    repo.save(f.session.actorId, mission);
    const config = { ...f.config, enableLocalRepair: true };
    const conversation = createAgentRun(config, f.store, f.session, randomUUID(), "برای انتشار چه چیزهایی لازم است؟", f.flow.id, "conversation").run;
    const model = new GoalModelClient(config, async (_url, init) => {
      const request = JSON.parse(String(init.body));
      assert.ok(request.tools.every((tool: { function: { name: string } }) => !tool.function.name.startsWith("propose_")));
      return Response.json({ choices: [{ finish_reason: "tool_calls", message: { role: "assistant", tool_calls: [{ id: randomUUID(), type: "function", function: { name: "propose_code_repair", arguments: "{}" } }] } }], usage: { total_tokens: 20 } });
    });
    await driveAgentRun(config, f.store, f.session, conversation.id, { model });
    assert.equal(repo.forProject(f.session.actorId, f.flow.id, "publication")?.id, mission.id);
    assert.equal(repo.forProject(f.session.actorId, f.flow.id, "conversation")?.id, conversation.id);
    assert.equal(repo.get(f.session.actorId, conversation.id)?.state, "failed");
    assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM code_repair_jobs").get()?.n, 0);
    assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM attempts").get()?.n, 0);
  } finally { f.close(); }
});
test("changing source cancels a pending repair on the server; active work rejects a late source selection", async () => {
  const f = await agentFixture();
  try {
    const run = (await createPublicationMission(f.config, f.store, f.session, randomUUID(), { projectId: f.flow.id, sourceHash: f.flow.profile.sourceHash, path: "/", expectedText: null }, AbortSignal.timeout(5000))).run;
    const repo = new AgentRepository(f.store), adapter = new CodeRepairAdapter(f.config, f.store);
    run.repair = await adapter.propose(f.session.actorId, { projectId: f.flow.id, goal: "محاسبه تعداد اصلاح شود.", allowedPaths: ["invoice.mjs"], testFiles: ["invoice.test.mjs"], expectedSourceHash: f.flow.profile.sourceHash }, AbortSignal.timeout(5000));
    run.state = "needs_approval"; repo.save(f.session.actorId, run);
    f.store.assertAgentIdle(f.session.actorId, null, true);
    const replacement = await prepareProjectFlow(f.config, f.store, f.session.actorId, f.flow.selection, AbortSignal.timeout(5000));
    assert.equal(repo.get(f.session.actorId, run.id)?.state, "cancelled");
    assert.equal(adapter.status(f.session.actorId, run.repair.id).state, "cancelled");
    const fresh = createAgentRun(f.config, f.store, f.session, randomUUID(), "بررسی نسخه جدید", replacement.id).run;
    await assert.rejects(prepareProjectFlow(f.config, f.store, f.session.actorId, f.flow.selection, AbortSignal.timeout(5000)), errorCode("AGENT_BUSY"));
    assert.equal(f.store.getProjectFlow(f.session.actorId)?.id, replacement.id);
    assert.equal(repo.get(f.session.actorId, fresh.id)?.state, "queued");
    assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM attempts").get()?.n, 0);
  } finally { f.close(); }
});
test("a model's destination name outside the published allowlist is recoverable before any account API call", async () => {
  const f = await agentFixture();
  try {
    const config = { ...f.config, teamId: "a".repeat(24), apps: ["allowed-target"], enableLiveLiara: true, enableMutations: true };
    f.store.saveConnection(f.session.actorId, { source: "token", ciphertext: sealCredential("synthetic-test-account-key", config.sessionSecret, f.session.actorId, "liara"), view: { provider: "liara", status: "connected", identityId: "test-account", displayName: "حساب آزمون", login: "test@example.test", checkedAt: Date.now(), teamId: config.teamId, teamName: "تیم آزمون", apps: [], selectedApp: null } });
    const budget = new RunBudget(config);
    await assert.rejects(executeAgentTool("propose_destination", { app: "outside-target", planId: "small-g2", bundleId: "basic", networkId: "b".repeat(24) }, { config, store: f.store, actorId: f.session.actorId, context: currentAgentContext(config, f.store, f.session.actorId), createdAt: Date.now(), budget, signal: AbortSignal.timeout(5000) }), errorCode("DESTINATION_NAME_NOT_ALLOWED"));
    assert.equal(budget.toolCalls, 0);
    assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM actions").get()?.n, 0);
  } finally { f.close(); }
});
