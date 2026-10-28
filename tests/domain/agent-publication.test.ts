import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { createAgentRun, decideAgentPublication, driveAgentRun, resumeAgentPublication } from "../../src/server/agent/runs.ts";
import { AgentRepository, agentView } from "../../src/server/agent/store.ts";
import { currentAgentContext, executeAgentTool, toolsForAgent, toolsForConversation } from "../../src/server/agent/tools.ts";
import { GoalModelClient, maxModelToolDefinitions } from "../../src/server/agent/model.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";
import { isWorkloadDeploymentSpec } from "../../src/contracts/deployment.ts";
import { LiaraReadClient } from "../../src/server/liara/client.ts";
import { LiaraDeployClient } from "../../src/server/liara/deploy.ts";
import { WorkloadProbe } from "../../src/server/liara/probe.ts";
import { sealCredential } from "../../src/server/connections/credentials.ts";
import { AppError } from "../../src/server/errors.ts";
import { readPublicationHistory } from "../../src/server/application/rollback.ts";
import { callMcpTool, mcpTools } from "../../src/server/mcp/server.ts";
import { issueMcpAccess, requireMcpAccess } from "../../src/server/mcp/access.ts";

async function fixture(mode: "ready" | "pending" | "lost" = "ready") {
  const f = await agentFixture(), app = "agent-site", teamId = "a".repeat(24), origin = "https://agent-site.example.com";
  const config = { ...f.config, teamId, apps: [app], liaraToken: "private-test-liara-credential",
    probeOrigins: { [app]: origin }, enableLiveLiara: true, enableMutations: true };
  f.store.saveConnection(f.session.actorId, { source: "token",
    ciphertext: sealCredential(config.liaraToken, config.sessionSecret, f.session.actorId, "liara"),
    view: { provider: "liara", status: "connected", identityId: "test-account", displayName: "آزمون", login: "test@example.test",
      teamId, teamName: "آزمون", checkedAt: Date.now(), selectedApp: app, apps: [{ name: app, id: "app-internal-id", platform: "node" }] } });
  let sends = 0, reads = 0, models = 0;
  const read = new LiaraReadClient(config, async (url) => {
    reads++;
    return Response.json(url.includes("/releases")
      ? { currentRelease: "approved-release", total: 1, releases: [{ _id: "approved-release", state: mode === "pending" ? "BUILDING" : "READY", port: 3000 }] }
      : { project: { _id: "app-internal-id", project_id: app, type: "node", status: "Running", planID: "existing-plan", envs: [] } });
  });
  const write = new LiaraDeployClient(config, async (url) => {
    sends++;
    if (mode === "lost") throw new Error("lost response");
    return Response.json(url.includes("/sources") ? { sourceID: "immutable-source.tar.gz" } : { releaseID: "approved-release" });
  });
  const probe = new WorkloadProbe(config, async () => [{ address: "93.184.216.34", family: 4 }],
    async () => ({ status: 200, body: "<main>invoice service</main>", bytes: 28, durationMs: 2 }));
  const model = new GoalModelClient(config, async (_url, init) => {
    models++;
    const request: unknown = JSON.parse(String(init.body));
    assert.ok(typeof request === "object" && request !== null && "messages" in request && Array.isArray(request.messages));
    const content = JSON.stringify(request.messages.at(-1));
    const name = content.includes('"role":"user"') ? "inspect_project" : "propose_publication";
    return Response.json({ choices: [{ finish_reason: "tool_calls", message: { role: "assistant", tool_calls: [{ id: randomUUID(), type: "function", function: {
      name, arguments: JSON.stringify(name === "inspect_project" ? {} : { path: "/", status: 200, assertion: { kind: "text", contains: "invoice service" } }),
    } }] } }], usage: { total_tokens: 42 } });
  });
  const dependencies = { model, tool: (name: string, args: unknown, context: Parameters<typeof executeAgentTool>[2]) =>
    executeAgentTool(name, args, { ...context, read }), deployment: { read, write, probe }, pollDelayMs: 1 };
  const run = createAgentRun(config, f.store, f.session, randomUUID(), "پروژه را منتشر کن", f.flow.id).run;
  await driveAgentRun(config, f.store, f.session, run.id, dependencies);
  const repo = new AgentRepository(f.store), proposed = repo.get(f.session.actorId, run.id);
  assert.ok(proposed?.publication);
  assert.equal(proposed.state, "needs_approval");
  assert.equal(proposed.publication.spec.version, 7);
  assert.equal(sends, 0);
  return { ...f, config, repo, proposed, dependencies, counts: () => ({ sends, reads, models }) };
}

async function completedPublication() {
  const f = await fixture();
  const publication = f.proposed.publication;
  assert.ok(publication);
  await decideAgentPublication(f.config, f.store, f.session, f.proposed.id, f.proposed.revision, publication.id, "approve");
  await driveAgentRun(f.config, f.store, f.session, f.proposed.id, f.dependencies);
  assert.equal(f.repo.get(f.session.actorId, f.proposed.id)?.state, "completed");
  return { ...f, publication: f.store.getAction(publication.id, f.session.actorId) };
}

test("maintenance model selects historical publication and rollback adopts the archive before budget persistence, then uses the normal approval and journal", async () => {
  const f = await completedPublication();
  try {
    let modelCalls = 0;
    const model = new GoalModelClient(f.config, async (_url, init) => {
      modelCalls++;
      const body = JSON.parse(String(init.body));
      assert.ok(body.tools.some((tool: { function: { name: string } }) => tool.function.name === "propose_rollback"));
      if (modelCalls === 2) assert.ok(JSON.stringify(body.messages.at(-1)).includes(f.publication.id));
      const name = modelCalls === 1 ? "read_publications" : "propose_rollback";
      return Response.json({ choices: [{ finish_reason: "tool_calls", message: { role: "assistant", tool_calls: [{
        id: randomUUID(), type: "function", function: { name, arguments: JSON.stringify(modelCalls === 1 ? {} : { actionId: f.publication.id }) },
      }] } }], usage: { total_tokens: 42 } });
    });
    const requestKey = randomUUID(), goal = "همان نسخهٔ منتشرشدهٔ قبلی را برای بازگردانی پیشنهاد بده";
    const initial = createAgentRun(f.config, f.store, f.session, requestKey, goal, f.flow.id).run;
    const sends = f.counts().sends;
    await driveAgentRun(f.config, f.store, f.session, initial.id, { ...f.dependencies, model });
    const proposed = f.repo.get(f.session.actorId, initial.id);
    assert.ok(proposed?.publication);
    assert.equal(proposed.state, "needs_approval");
    assert.equal(f.counts().sends, sends);
    const flow = f.store.getProjectFlow(f.session.actorId);
    assert.equal(flow?.selection.kind, "artifact");
    assert.equal(proposed.context.projectId, flow?.id);
    assert.equal(proposed.projectId, flow?.id);
    assert.equal(f.repo.forProject(f.session.actorId, proposed.projectId, "publication")?.id, proposed.id);
    assert.equal(f.repo.forProject(f.session.actorId, proposed.projectId, "conversation"), null);
    assert.ok(isWorkloadDeploymentSpec(proposed.publication.spec) && isWorkloadDeploymentSpec(f.publication.spec));
    assert.equal(proposed.publication.spec.artifactHash, f.publication.spec.artifactHash);
    assert.ok(proposed.usage.toolCalls > 0);
    assert.equal(proposed.usage.modelCalls, 2);
    assert.deepEqual(proposed.limits, initial.limits);
    // A lost registration response joins the updated context without a fresh model budget.
    assert.equal(createAgentRun(f.config, f.store, f.session, requestKey, goal, proposed.projectId).created, false);
    const persisted = f.repo.get(f.session.actorId, initial.id);
    assert.ok(persisted);
    assert.equal(persisted.usage.modelCalls, 2);
    await decideAgentPublication(f.config, f.store, f.session, proposed.id, persisted.revision, proposed.publication.id, "approve");
    await driveAgentRun(f.config, f.store, f.session, proposed.id, { ...f.dependencies, model });
    const result = f.repo.get(f.session.actorId, proposed.id);
    assert.equal(result?.state, "completed");
    assert.equal(result?.publication?.deployment?.observation?.code, "WORKLOAD_VERIFIED");
    assert.equal(f.counts().sends, sends + 2);
    assert.equal(modelCalls, 2);
    assert.equal(f.store.getAction(f.publication.id, f.session.actorId).state, "succeeded");
  } finally { f.close(); }
});

test("publication history scopes internal app/account/team and paginates without claiming the current release", async () => {
  const f = await completedPublication();
  try {
    const spec = f.publication.spec;
    assert.equal(spec.version, 7);
    for (let i = 0; i < 23; i++) {
      const action = f.store.createAction(f.session.actorId, spec);
      f.store.db.prepare("UPDATE actions SET state='succeeded',remote_id=? WHERE id=?").run(`release-${i}`, action.id);
    }
    // Colliding public names in another account/internal app are excluded.
    f.store.db.prepare("UPDATE actions SET spec=json_set(spec,'$.accountId','another-account') WHERE remote_id='release-22'").run();
    f.store.db.prepare("UPDATE actions SET spec=json_set(spec,'$.targetAppId','another-internal-app') WHERE remote_id='release-21'").run();
    const first = readPublicationHistory(f.config, f.store, f.session.actorId);
    assert.equal(first.publications.length, 20);
    assert.equal(first.publications[0]?.releaseId, "release-20");
    assert.equal(first.currentReleaseVerified, false);
    assert.equal(first.dataCompatibilityVerified, false);
    assert.ok(first.nextBeforeActionId);
    const second = readPublicationHistory(f.config, f.store, f.session.actorId, first.nextBeforeActionId);
    assert.equal(second.publications.length, 2);
    assert.equal(second.nextBeforeActionId, null);
    assert.equal(new Set([...first.publications, ...second.publications].map(row => row.actionId)).size, 22);
    assert.throws(() => readPublicationHistory(f.config, f.store, "different-actor"), { code: "LIARA_AUTH_REQUIRED" });
  } finally { f.close(); }
});

test("publication history partitions long UTF-8 workload criteria by bytes without losing or repeating records", async () => {
  const f = await completedPublication();
  try {
    assert.ok(isWorkloadDeploymentSpec(f.publication.spec));
    for (let i = 0; i < 20; i++) {
      const action = f.store.createAction(f.session.actorId, { ...f.publication.spec,
        workload: { ...f.publication.spec.workload, path: `/${"a".repeat(190)}`, assertion: { kind: "text", contains: "ش".repeat(256) } } });
      f.store.db.prepare("UPDATE actions SET state='succeeded',remote_id=? WHERE id=?").run(`long-${i}`, action.id);
    }
    let page = readPublicationHistory(f.config, f.store, f.session.actorId);
    assert.ok(page.publications.length > 0 && page.publications.length < 20);
    const ids: string[] = [];
    while (true) {
      assert.ok(Buffer.byteLength(JSON.stringify(page)) < 17 * 1024);
      ids.push(...page.publications.map(row => row.actionId));
      if (!page.nextBeforeActionId) break;
      assert.equal(page.nextBeforeActionId, page.publications.at(-1)?.actionId);
      page = readPublicationHistory(f.config, f.store, f.session.actorId, page.nextBeforeActionId);
    }
    assert.equal(ids.length, 21); assert.equal(new Set(ids).size, 21); assert.equal(ids.at(-1), f.publication.id);
  } finally { f.close(); }
});

test("MCP maintenance uses the existing run, joins retries and obeys read-only/revoked grants", async () => {
  const f = await completedPublication();
  try {
    const accessFor = (missions: boolean) => {
      const grant = issueMcpAccess(f.config, f.store, f.session, missions);
      return requireMcpAccess(new Request(`${f.config.origin}/api/mcp`, { headers: { host: new URL(f.config.origin).host, authorization: `Bearer ${grant.accessToken}` } }), f.config, f.store);
    };
    const readOnly = accessFor(false), access = accessFor(true), scheduled: Array<() => Promise<void>> = [];
    assert.ok(!mcpTools(f.config, readOnly).some(tool => tool.name === "launchlane_maintain"));
    const context = { config: f.config, store: f.store, access, schedule: (work: () => Promise<void>) => { scheduled.push(work); } };
    const args = { requestKey: randomUUID(), goal: "سابقهٔ انتشار را برای بازگردانی بررسی کن\nفقط پیشنهاد بساز" };
    assert.equal((await callMcpTool({ ...context, access: readOnly }, "launchlane_maintain", args, AbortSignal.timeout(3000))).isError, true);
    const first = await callMcpTool(context, "launchlane_maintain", args, AbortSignal.timeout(3000));
    assert.ok(!first.isError);
    const repeated = await callMcpTool(context, "launchlane_maintain", args, AbortSignal.timeout(3000));
    assert.ok(!repeated.isError);
    assert.equal(scheduled.length, 1);
    const maintenance = f.repo.forProject(f.session.actorId, f.flow.id, "publication");
    assert.equal(maintenance?.channel, "maintenance");
    assert.equal(f.repo.forProject(f.session.actorId, f.flow.id, "conversation"), null);
    assert.equal(f.counts().models, 2);
    assert.equal(f.counts().sends, 2);
    const conflict = await callMcpTool(context, "launchlane_maintain", { ...args, goal: "هدف دیگر" }, AbortSignal.timeout(3000));
    assert.equal(conflict.isError, true);
    assert.ok(JSON.stringify(conflict).includes("IDEMPOTENCY_CONFLICT"));
    f.store.revokeSession(f.session.id);
    assert.equal((await callMcpTool(context, "launchlane_maintain", args, AbortSignal.timeout(3000))).isError, true);
    assert.equal(scheduled.length, 1);
  } finally { f.close(); }
});

test("paused maintenance MCP reads reserve the same remaining allowance and cannot start beside its active owner", async () => {
  const f = await agentFixture();
  try {
    const run = createAgentRun(f.config, f.store, f.session, randomUUID(), "وضعیت پروژه را بررسی کن", f.flow.id, "maintenance").run;
    const context = { config: f.config, store: f.store, access: { session: f.session, parentSessionId: f.session.id, missions: true }, schedule: () => {} };
    assert.ok(JSON.stringify(await callMcpTool(context, "inspect_project", {}, AbortSignal.timeout(3000))).includes("AGENT_BUSY"));
    run.state = "needs_input"; run.nextAction = "reply";
    run.usage.toolCalls = run.limits.maxToolCalls - 1; run.usage.modelCalls = 2;
    const repo = new AgentRepository(f.store); repo.save(f.session.actorId, run);
    const reads = await Promise.all([callMcpTool(context, "inspect_project", {}, AbortSignal.timeout(3000)),
      callMcpTool(context, "inspect_project", {}, AbortSignal.timeout(3000))]);
    assert.equal(reads.filter(result => !result.isError).length, 1);
    assert.ok(JSON.stringify(reads.find(result => result.isError)).includes("BUDGET_EXHAUSTED"));
    assert.equal(repo.get(f.session.actorId, run.id)?.usage.toolCalls, run.limits.maxToolCalls);
    assert.equal(repo.get(f.session.actorId, run.id)?.usage.modelCalls, 2);
    assert.ok(!((await callMcpTool(context, "launchlane_mission", { id: run.id }, AbortSignal.timeout(3000))).isError));
  } finally { f.close(); }
});

test("maintenance can investigate a changed/missing workspace and restore only the historical archive after the source tool reports its failure", async () => {
  for (const missing of [false, true]) {
    const f = await completedPublication();
    try {
      if (missing) await rename(f.project, join(f.workspace, "moved-source"));
      else await writeFile(join(f.project, "server.mjs"), "throw Error('changed source must never be published');\n");
      let calls = 0;
      const model = new GoalModelClient(f.config, async (_url, init) => {
        calls++;
        const body = JSON.parse(String(init.body));
        if (calls === 2) assert.ok(JSON.stringify(body.messages.at(-1)).includes("PROJECT_CHANGED"));
        const name = calls === 1 ? "inspect_project" : calls === 2 ? "read_publications" : "propose_rollback";
        return Response.json({ choices: [{ finish_reason: "tool_calls", message: { role: "assistant", tool_calls: [{ id: randomUUID(), type: "function",
          function: { name, arguments: JSON.stringify(calls < 3 ? {} : { actionId: f.publication.id }) } }] } }], usage: { total_tokens: 42 } });
      });
      const run = createAgentRun(f.config, f.store, f.session, randomUUID(), "نسخه قبلی را از archive برای بازگردانی آماده کن", f.flow.id, "maintenance").run;
      await driveAgentRun(f.config, f.store, f.session, run.id, { ...f.dependencies, model });
      const proposed = f.repo.get(f.session.actorId, run.id);
      assert.equal(proposed?.state, "needs_approval");
      assert.ok(proposed?.publication && isWorkloadDeploymentSpec(proposed.publication.spec) && isWorkloadDeploymentSpec(f.publication.spec));
      assert.equal(proposed.publication.spec.artifactHash, f.publication.spec.artifactHash);
      assert.deepEqual(proposed.publication.spec.workload, f.publication.spec.workload);
      assert.equal(proposed.events.find(event => event.tool === "inspect_project" && event.kind === "tool")?.outcome, "failed");
      assert.equal(proposed.usage.modelCalls, 3); assert.equal(f.counts().sends, 2);
      await decideAgentPublication(f.config, f.store, f.session, proposed.id, proposed.revision, proposed.publication.id, "approve");
      await driveAgentRun(f.config, f.store, f.session, run.id, { ...f.dependencies, model });
      assert.equal(f.repo.get(f.session.actorId, run.id)?.state, "completed");
      assert.equal(f.counts().sends, 4); assert.equal(calls, 3);
    } finally { f.close(); }
  }
});

test("MCP resumes a paused maintenance owner once without renewing its budget and rejects another owner or exhaustion", async () => {
  const f = await agentFixture();
  try {
    const repo = new AgentRepository(f.store), run = createAgentRun(f.config, f.store, f.session, randomUUID(), "بررسی نگهداری", f.flow.id, "maintenance").run;
    run.state = "partially_completed"; run.usage.modelCalls = 2; run.usage.toolCalls = 3; repo.save(f.session.actorId, run);
    let scheduled = 0;
    const context = { config: f.config, store: f.store, access: { session: f.session, parentSessionId: f.session.id, missions: true }, schedule: () => { scheduled++; } };
    const args = { id: run.id, revision: run.revision, requestKey: randomUUID() };
    assert.ok(!(await callMcpTool(context, "launchlane_resume", args, AbortSignal.timeout(3000))).isError);
    assert.ok(!(await callMcpTool(context, "launchlane_resume", args, AbortSignal.timeout(3000))).isError);
    assert.equal(scheduled, 1);
    const queued = repo.get(f.session.actorId, run.id); assert.ok(queued);
    assert.equal(queued.state, "queued"); assert.deepEqual(queued.limits, run.limits);
    assert.equal(queued.usage.modelCalls, 2); assert.equal(queued.usage.toolCalls, 3);
    queued.state = "partially_completed"; repo.save(f.session.actorId, queued);
    const competing = createAgentRun(f.config, f.store, f.session, randomUUID(), "هدف دیگر", f.flow.id, "maintenance").run;
    const denied = await callMcpTool(context, "launchlane_resume", { ...args, revision: queued.revision, requestKey: randomUUID() }, AbortSignal.timeout(3000));
    assert.ok(JSON.stringify(denied).includes("AGENT_BUSY")); assert.equal(scheduled, 1);
    competing.state = "cancelled"; repo.save(f.session.actorId, competing);
    queued.usage.modelCalls = queued.limits.maxModelCalls; repo.save(f.session.actorId, queued);
    const exhausted = await callMcpTool(context, "launchlane_resume", { ...args, revision: queued.revision, requestKey: randomUUID() }, AbortSignal.timeout(3000));
    assert.ok(JSON.stringify(exhausted).includes("BUDGET_EXHAUSTED")); assert.equal(scheduled, 1);
  } finally { f.close(); }
});

test("maintenance restart recovery resumes its persisted allowance while a changed target still stops before model or write", async () => {
  const f = await completedPublication();
  try {
    const run = createAgentRun(f.config, f.store, f.session, randomUUID(), "ادامه نگهداری", f.flow.id, "maintenance").run;
    run.usage.modelCalls = 2; run.usage.toolCalls = 4; f.repo.save(f.session.actorId, run);
    f.repo.recover();
    const interrupted = f.repo.get(f.session.actorId, run.id); assert.equal(interrupted?.state, "interrupted"); assert.ok(interrupted);
    const context = { config: f.config, store: f.store, access: { session: f.session, parentSessionId: f.session.id, missions: true }, schedule: () => {} };
    const resumed = await callMcpTool(context, "launchlane_resume", { id: run.id, revision: interrupted.revision, requestKey: randomUUID() }, AbortSignal.timeout(3000));
    assert.ok(!resumed.isError);
    const queued = f.repo.get(f.session.actorId, run.id); assert.ok(queued);
    assert.equal(queued.state, "queued"); assert.equal(queued.errorCode, null);
    assert.deepEqual(queued.limits, run.limits); assert.equal(queued.usage.modelCalls, 2); assert.equal(queued.usage.toolCalls, 4);
    const connection = f.store.getConnection(f.session.actorId, "liara"); assert.ok(connection);
    f.store.saveConnection(f.session.actorId, { ...connection, view: { ...connection.view, apps: connection.view.apps.map(app => ({ ...app, id: "different-internal-id" })) } });
    const before = f.counts();
    await driveAgentRun(f.config, f.store, f.session, run.id, f.dependencies);
    assert.equal(f.repo.get(f.session.actorId, run.id)?.errorCode, "AGENT_CONTEXT_CHANGED");
    assert.deepEqual(f.counts(), before);
  } finally { f.close(); }
});

test("rollback is unavailable to questions and structured publication, rejects invalid IDs before selection and keeps tool schemas bounded", async () => {
  const f = await completedPublication();
  try {
    for (const preparation of ["native", "build", "fullstack"] as const) for (const hasTarget of [false, true]) {
      for (const program of [false, true]) for (const storage of [false, true]) {
        const definitions = toolsForAgent({ ...f.config, enableLocalRepair: true }, preparation, hasTarget, program, storage);
        assert.ok(definitions.length + 1 <= maxModelToolDefinitions);
        if (program || !hasTarget || storage) assert.ok(!definitions.some(tool => tool.function.name === "propose_rollback"));
      }
    }
    assert.ok(!toolsForConversation(f.config).some(tool => tool.function.name === "propose_rollback"));
    const context = { config: f.config, store: f.store, actorId: f.session.actorId,
      context: currentAgentContext(f.config, f.store, f.session.actorId), createdAt: Date.now(),
      budget: new RunBudget(f.config), signal: AbortSignal.timeout(3000) };
    const before = f.store.getProjectFlow(f.session.actorId);
    await assert.rejects(executeAgentTool("propose_rollback", { actionId: "invalid" }, context), { code: "INVALID_INPUT" });
    await assert.rejects(executeAgentTool("propose_rollback", { actionId: f.publication.id }, context), { code: "ROLLBACK_MISSION_REQUIRED" });
    await assert.rejects(executeAgentTool("read_publications", { beforeActionId: "invalid" }, context), { code: "INVALID_INPUT" });
    assert.deepEqual(f.store.getProjectFlow(f.session.actorId), before);
    assert.equal(f.counts().sends, 2);
  } finally { f.close(); }
});

test("agent publication pauses without a write, atomically approves, verifies and replays without model/provider calls", async () => {
  const f = await fixture();
  try {
    const actionId = f.proposed.publication?.id;
    assert.ok(actionId);
    await decideAgentPublication(f.config, f.store, f.session, f.proposed.id, f.proposed.revision, actionId, "approve");
    await assert.rejects(decideAgentPublication(f.config, f.store, f.session, f.proposed.id, f.proposed.revision, actionId, "approve"),
      (e: unknown) => e instanceof AppError && e.code === "AGENT_CONFLICT");
    await driveAgentRun(f.config, f.store, f.session, f.proposed.id, f.dependencies);
    const result = f.repo.get(f.session.actorId, f.proposed.id);
    assert.ok(result);
    assert.equal(result.state, "completed");
    assert.equal(result.effect, "remote_changes_verified");
    assert.equal(result.publication?.deployment?.observation?.code, "WORKLOAD_VERIFIED");
    assert.equal(f.counts().sends, 2);
    assert.equal(f.counts().models, 2);
    assert.equal(result.usage.toolCalls, 11);
    const before = f.counts();
    for (let i = 0; i < 3; i++) assert.deepEqual(agentView(f.repo.get(f.session.actorId, result.id) ?? result), agentView(result));
    await driveAgentRun(f.config, f.store, f.session, result.id, f.dependencies);
    assert.deepEqual(f.counts(), before);
  } finally { f.close(); }
});

test("reject and failed run transition cannot leave a hidden approved publication", async () => {
  for (const reject of [false, true]) {
    const f = await fixture();
    try {
      const actionId = f.proposed.publication?.id;
      assert.ok(actionId);
      if (!reject) f.store.db.exec("CREATE TRIGGER prevent_run_update BEFORE UPDATE ON agent_runs BEGIN SELECT RAISE(ABORT,'simulated storage failure'); END");
      if (reject) {
        await decideAgentPublication(f.config, f.store, f.session, f.proposed.id, f.proposed.revision, actionId, "reject");
        assert.equal(f.store.getAction(actionId, f.session.actorId).state, "cancelled");
      } else {
        await assert.rejects(decideAgentPublication(f.config, f.store, f.session, f.proposed.id, f.proposed.revision, actionId, "approve"));
        assert.equal(f.store.getAction(actionId, f.session.actorId).state, "awaiting_approval");
      }
      assert.equal(f.counts().sends, 0);
    } finally { f.close(); }
  }
});

test("pending release survives recovery and resumes readback without upload, release or model replay", async () => {
  const f = await fixture("pending");
  try {
    const actionId = f.proposed.publication?.id;
    assert.ok(actionId);
    await decideAgentPublication(f.config, f.store, f.session, f.proposed.id, f.proposed.revision, actionId, "approve");
    await driveAgentRun(f.config, f.store, f.session, f.proposed.id, f.dependencies);
    let run = f.repo.get(f.session.actorId, f.proposed.id);
    assert.ok(run);
    assert.equal(run.effect, "remote_changes_unverified");
    assert.equal(run.state, "partially_completed");
    f.store.recoverInterrupted();
    f.repo.recover();
    const before = f.counts();
    run = resumeAgentPublication(f.store, f.session, run.id, run.revision);
    await driveAgentRun(f.config, f.store, f.session, run.id, f.dependencies);
    assert.equal(f.counts().sends, 2);
    assert.equal(f.counts().models, before.models);
    assert.ok(f.counts().reads > before.reads);
  } finally { f.close(); }
});

test("a process stop before claim cancels the queued publication approval and cannot replay it", async () => {
  const f = await fixture();
  try {
    const actionId = f.proposed.publication?.id;
    assert.ok(actionId);
    await decideAgentPublication(f.config, f.store, f.session, f.proposed.id, f.proposed.revision, actionId, "approve");
    f.store.recoverInterrupted();
    f.repo.recover();
    const run = f.repo.get(f.session.actorId, f.proposed.id);
    assert.equal(run?.state, "interrupted");
    assert.equal(run?.publication?.state, "cancelled");
    await driveAgentRun(f.config, f.store, f.session, f.proposed.id, f.dependencies);
    assert.equal(f.counts().sends, 0);
  } finally { f.close(); }
});
