import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { compareSelectedSource, sourceComparisonNotice } from "../../src/server/agent/source-comparison.ts";
import { currentAgentContext, executeAgentTool } from "../../src/server/agent/tools.ts";
import { AgentRepository, agentView } from "../../src/server/agent/store.ts";
import { createAgentRun, driveAgentRun } from "../../src/server/agent/runs.ts";
import { GoalModelClient } from "../../src/server/agent/model.ts";
import { LiaraReadClient } from "../../src/server/liara/client.ts";
import { proposeWorkloadDeployment } from "../../src/server/application/deployment.ts";
import { sealCredential } from "../../src/server/connections/credentials.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";
import { object } from "../../src/contracts/validation.ts";
import { parseAgentView } from "../../src/contracts/agent.ts";
import { agentFixture } from "../helpers/agent-fixture.ts";

async function fixture() {
  const f = await agentFixture(), app = "source-case", teamId = "a".repeat(24), appId = "c".repeat(24);
  const config = { ...f.config, teamId, apps: [app], liaraToken: "synthetic-source-identity-credential", enableLiveLiara: true, enableMutations: true,
    probeOrigins: { [app]: "https://source-case.example.com" } };
  f.store.saveConnection(f.session.actorId, { source: "token", ciphertext: sealCredential(config.liaraToken, config.sessionSecret, f.session.actorId, "liara"), view: {
    provider: "liara", status: "connected", identityId: "source-account", displayName: "آزمون", login: "test@example.test", teamId,
    teamName: "آزمون", checkedAt: Date.now(), selectedApp: app, apps: [{ name: app, id: appId, platform: "node" }] } });
  let reads = 0, current: string | null = "recorded-release", replacement = false;
  const read = new LiaraReadClient(config, async url => {
    reads++;
    return Response.json(url.includes("/releases") ? { currentRelease: current, total: 1, releases: [{ _id: "newer-ready-release", state: "READY", port: 3000 }] }
      : { project: { _id: replacement ? "replacement-app-id" : appId, project_id: app, type: "node", status: "Running", planID: "current-plan", envs: [] } });
  });
  const action = await proposeWorkloadDeployment(config, f.store, f.session.actorId, { flowId: f.flow.id, app, port: null,
    workload: { origin: config.probeOrigins[app], path: "/", status: 200, assertion: { kind: "text", contains: "invoice service" } } }, AbortSignal.timeout(5000), { read });
  f.store.decide(action.id, f.session.actorId, f.session.id, action.hash, "approve");
  f.store.claim(action.id, f.session.actorId, f.session.id, action.spec);
  f.store.deploymentStep(action.id, f.session.actorId, "upload_started");
  f.store.deploymentStep(action.id, f.session.actorId, "uploaded", "immutable-source.tar.gz");
  f.store.deploymentStep(action.id, f.session.actorId, "release_started", "immutable-source.tar.gz");
  f.store.receipt(action.id, f.session.actorId, "recorded-release");
  // A synthetic saved workload failure must not erase accepted source provenance or become healthy.
  f.store.db.prepare("UPDATE actions SET state='failed' WHERE id=?").run(action.id);
  const context = currentAgentContext(config, f.store, f.session.actorId);
  return { ...f, config, read, action, context, get reads() { return reads; }, setCurrent(value: string | null) { current = value; }, replace() { replacement = true; } };
}

test("comparison binds the accepted source/release/attempt to actor, account, team and internal app identity without claiming health", async () => {
  const f = await fixture();
  try {
    const before = JSON.stringify(f.store.db.prepare("SELECT * FROM actions").all()), attempts = JSON.stringify(f.store.db.prepare("SELECT * FROM attempts").all());
    const matched = compareSelectedSource(f.store, f.session.actorId, f.context, "recorded-release", 100);
    assert.equal(matched?.relationship, "matching_recorded_source");assert.equal(matched?.workloadHealth, "unverified");assert.equal(matched?.runtimeContent, "unverified");
    const different = compareSelectedSource(f.store, f.session.actorId, { ...f.context, sourceHash: "d".repeat(64) }, "recorded-release", 101);
    assert.equal(different?.relationship, "different_recorded_source");assert.equal(different?.recordedSourceHash, f.context.sourceHash);
    for (const target of [{ ...f.context.target, accountId: "foreign-account" }, { ...f.context.target, appId: "reused-name-new-id" }, { ...f.context.target, teamId: "e".repeat(24) }]) {
      assert.ok(f.context.target);
      assert.equal(compareSelectedSource(f.store, f.session.actorId, { ...f.context, target: { ...f.context.target, ...target } }, "recorded-release", 102)?.relationship, "unattributed_release");
    }
    assert.equal(compareSelectedSource(f.store, "foreign-actor", f.context, "recorded-release", 103)?.relationship, "unattributed_release");
    assert.equal(compareSelectedSource(f.store, f.session.actorId, f.context, "manual-release", 104)?.relationship, "unattributed_release");
    assert.equal(compareSelectedSource(f.store, f.session.actorId, f.context, null, 105)?.relationship, "unknown_current_release");
    assert.equal(compareSelectedSource(f.store, f.session.actorId, { ...f.context, projectId: null, sourceHash: null }, "recorded-release", 106), null);
    assert.equal(JSON.stringify(f.store.db.prepare("SELECT * FROM actions").all()), before);assert.equal(JSON.stringify(f.store.db.prepare("SELECT * FROM attempts").all()), attempts);
  } finally { f.close(); }
});

test("unclaimed, unaccepted, corrupt or conflicting stored attribution stays unknown", async () => {
  const f = await fixture();
  try {
    const compare = () => compareSelectedSource(f.store, f.session.actorId, f.context, "recorded-release", 100);
    f.store.db.prepare("UPDATE attempts SET remote_id='different-response' WHERE action_id=?").run(f.action.id);
    assert.equal(compare()?.relationship, "unattributed_release");
    f.store.db.prepare("UPDATE attempts SET remote_id='recorded-release' WHERE action_id=?").run(f.action.id);
    f.store.db.prepare("UPDATE deployment_progress SET data_json=? WHERE action_id=?").run(JSON.stringify({ stage: "release_started", sourceId: "immutable-source.tar.gz", observation: null }), f.action.id);
    assert.equal(compare()?.relationship, "unattributed_release");
    f.store.db.prepare("UPDATE deployment_progress SET data_json=? WHERE action_id=?").run(JSON.stringify({ stage: "release_accepted", sourceId: "immutable-source.tar.gz", observation: null }), f.action.id);
    f.store.db.prepare("UPDATE actions SET hash=? WHERE id=?").run("f".repeat(64), f.action.id);
    assert.equal(compare()?.relationship, "unattributed_release");
    f.store.db.prepare("UPDATE actions SET hash=? WHERE id=?").run(f.action.hash, f.action.id);
    const duplicate = f.store.createAction(f.session.actorId, f.action.spec);
    f.store.db.prepare("UPDATE actions SET remote_id='recorded-release' WHERE id=?").run(duplicate.id);
    assert.equal(compare()?.reason, "ambiguous_records");
  } finally { f.close(); }
});

test("the shared release read uses actual currentRelease, not newest READY, preserves three-read budget and rejects app replacement", async () => {
  const f = await fixture();
  try {
    const context = () => ({ config: f.config, store: f.store, actorId: f.session.actorId, context: f.context,
      createdAt: Date.now(), budget: new RunBudget(f.config), signal: AbortSignal.timeout(5000), read: f.read });
    const c = context(), result = object(await executeAgentTool("read_releases", {}, c));
    assert.equal(object(result.sourceComparison).relationship, "matching_recorded_source");assert.equal(result.currentRelease, "recorded-release");
    assert.equal(c.budget.toolCalls, 3);assert.equal(result.remoteChanges, false);
    f.setCurrent(null);
    const missing = object(await executeAgentTool("read_releases", {}, context()));
    assert.equal(object(missing.sourceComparison).relationship, "unknown_current_release");
    f.replace();await assert.rejects(executeAgentTool("read_releases", {}, context()), { code: "SCOPE_DENIED" });
  } finally { f.close(); }
});

test("actual agent transport and event replay expose the scoped notice once, without replaying reads or asserting deployment success", async () => {
  const f = await fixture();
  try {
    let requests = 0;
    const model = new GoalModelClient(f.config, async (_url, init) => {
      requests++;
      if (requests === 2) assert.match(String(init.body), /matching_recorded_source/);
      return Response.json({ choices: [{ finish_reason: "tool_calls", message: { role: "assistant", tool_calls: [{ id: randomUUID(), type: "function", function: {
        name: requests === 1 ? "read_releases" : "finish_investigation", arguments: JSON.stringify(requests === 1 ? {} : { state: "partially_completed", message: "مبدأ انتشار بررسی شد؛ سلامت برنامه بررسی نشده است.", question: null, nextAction: "reply" }),
      } }] } }], usage: { total_tokens: 20 } });
    });
    const run = createAgentRun(f.config, f.store, f.session, randomUUID(), "نسخه‌های همین سرویس را فقط بخوان", f.flow.id).run;
    await driveAgentRun(f.config, f.store, f.session, run.id, { model,
      tool: (name, args, context) => executeAgentTool(name, args, { ...context, read: f.read }) });
    const repo = new AgentRepository(f.store), current = repo.get(f.session.actorId, run.id);assert.ok(current);
    const view = parseAgentView(agentView(current)), notices = view.events.filter(event => event.notice);
    assert.equal(notices.length, 1);assert.match(notices[0]?.notice ?? "", /مبدأ انتشار ثبت‌شده/);
    assert.equal(view.effect, "no_remote_changes");assert.equal(view.state, "partially_completed");
    const reads = f.reads;assert.deepEqual(parseAgentView(agentView(repo.get(f.session.actorId, run.id) ?? current)), view);assert.equal(f.reads, reads);
    const comparison = compareSelectedSource(f.store, f.session.actorId, f.context, "recorded-release", 100);
    assert.equal(sourceComparisonNotice({ ok: true, data: { sourceComparison: { ...comparison, appId: "foreign" } } }, f.context), null);
    assert.equal(sourceComparisonNotice({ ok: false, data: { sourceComparison: comparison } }, f.context), null);
  } finally { f.close(); }
});
