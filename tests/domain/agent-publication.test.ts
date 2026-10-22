import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { createAgentRun, decideAgentPublication, driveAgentRun, resumeAgentPublication } from "../../src/server/agent/runs.ts";
import { AgentRepository, agentView } from "../../src/server/agent/store.ts";
import { executeAgentTool } from "../../src/server/agent/tools.ts";
import { GoalModelClient } from "../../src/server/agent/model.ts";
import { LiaraReadClient } from "../../src/server/liara/client.ts";
import { LiaraDeployClient } from "../../src/server/liara/deploy.ts";
import { WorkloadProbe } from "../../src/server/liara/probe.ts";
import { sealCredential } from "../../src/server/connections/credentials.ts";
import { AppError } from "../../src/server/errors.ts";

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
