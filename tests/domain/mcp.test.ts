import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { issueMcpAccess, requireMcpAccess } from "../../src/server/mcp/access.ts";
import { callMcpTool, mcpTools } from "../../src/server/mcp/server.ts";
import { AgentRepository, agentView } from "../../src/server/agent/store.ts";
import { object } from "../../src/contracts/validation.ts";
import { parsePublicationInput } from "../../src/contracts/publication-mission.ts";
import { agentFixture } from "../helpers/agent-fixture.ts";

function data(result: Awaited<ReturnType<typeof callMcpTool>>) {
  const content = result.content?.[0];
  assert.ok(content?.type === "text");
  return object(JSON.parse(content.text));
}
test("MCP access is purpose-bound, signed, expiring, revocable and dependent on its operator session", async () => {
  const f = await agentFixture();
  try {
    const now = Date.now(), grant = issueMcpAccess(f.config, f.store, f.session, false, now);
    const request = (token = grant.accessToken, extra = {}) => new Request(`${f.config.origin}/api/mcp`, { headers: { host: new URL(f.config.origin).host, authorization: `Bearer ${token}`, ...extra } });
    const verified = requireMcpAccess(request(), f.config, f.store, now);
    assert.equal(verified.session.actorId, f.session.actorId); assert.equal(verified.missions, false);
    assert.ok(grant.expiresAt <= f.session.expiresAt);
    assert.throws(() => requireMcpAccess(request(`${grant.accessToken}x`), f.config, f.store, now), { code: "AUTH_REQUIRED" });
    assert.throws(() => requireMcpAccess(request(f.config.operatorToken), f.config, f.store, now), { code: "AUTH_REQUIRED" });
    assert.throws(() => requireMcpAccess(request(grant.accessToken, { origin: "https://untrusted.test" }), f.config, f.store, now), { code: "ORIGIN_DENIED" });
    assert.throws(() => requireMcpAccess(request(grant.accessToken, { host: "untrusted.test" }), f.config, f.store, now), { code: "HOST_DENIED" });
    assert.throws(() => requireMcpAccess(request(), f.config, f.store, grant.expiresAt + 1), { code: "AUTH_REQUIRED" });
    f.store.revokeSession(grant.id);
    assert.throws(() => requireMcpAccess(request(), f.config, f.store, now), { code: "AUTH_REQUIRED" });
    const child = issueMcpAccess(f.config, f.store, f.session, true, now);
    f.store.revokeSession(f.session.id);
    assert.throws(() => requireMcpAccess(request(child.accessToken), f.config, f.store, now), { code: "AUTH_REQUIRED" });
  } finally { f.close(); }
});

test("MCP registry calls the same source policy; read access cannot manufacture approval, jobs or missions", async () => {
  const f = await agentFixture();
  try {
    const c = { config: f.config, store: f.store, access: { session: f.session, parentSessionId: f.session.id, missions: false }, schedule: () => { throw Error("Read must not schedule work"); } }, signal = AbortSignal.timeout(5000);
    const names = mcpTools(f.config, c.access).map(tool => tool.name);
    assert.ok(names.includes("inspect_project")); assert.ok(names.includes("read_project_file"));
    assert.ok(!names.includes("propose_code_repair")); assert.ok(!names.includes("launchlane_publish"));
    const inspect = data(await callMcpTool(c, "inspect_project", {}, signal));
    assert.equal(object(inspect.data).runtime, "node");
    const context = object(data(await callMcpTool(c, "launchlane_context", {}, signal)).data);
    assert.equal(object(context.project).id, f.flow.id);
    for (const [name, args, code] of [
      ["read_project_file", { path: ".env" }, "SOURCE_PATH_DENIED"],
      ["read_project_file", { path: "../outside" }, "SOURCE_PATH_DENIED"],
      ["inspect_project", { approved: true }, "INVALID_INPUT"],
      ["launchlane_publish", { approved: true }, "TOOL_DENIED"],
      ["propose_code_repair", {}, "TOOL_DENIED"],
      ["execute", {}, "TOOL_DENIED"],
    ] as const) {
      const result = await callMcpTool(c, name, args, signal);
      assert.equal(result.isError, true); assert.equal(object(data(result).error).code, code);
      assert.ok(!JSON.stringify(result).includes(f.config.operatorToken));
    }
    assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM agent_runs").get()?.n, 0);
    assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM attempts").get()?.n, 0);
  } finally { f.close(); }
});

test("MCP joins the web mission, replays authoritative receipts and cancels with the same CAS without resetting allowance", async () => {
  const f = await agentFixture();
  try {
    const queued: Array<() => Promise<void>> = [], c = { config: f.config, store: f.store, access: { session: f.session, parentSessionId: f.session.id, missions: true }, schedule: (work: () => Promise<void>) => { queued.push(work); } }, signal = AbortSignal.timeout(5000);
    const input = { requestKey: randomUUID(), publication: { projectId: f.flow.id, sourceHash: f.flow.profile.sourceHash, path: "/", expectedText: "invoice service" } };
    const schema = object(object(mcpTools(f.config, c.access).find(tool => tool.name === "launchlane_publish")?.inputSchema.properties).publication);
    assert.equal(object(object(schema.properties).expectedText).maxLength, 240);
    assert.equal(parsePublicationInput({ ...input.publication, expectedText: "x".repeat(240) }).expectedText?.length, 240);
    assert.throws(() => parsePublicationInput({ ...input.publication, expectedText: "x".repeat(241) }), { code: "INVALID_INPUT" });
    assert.equal(object(data(await callMcpTool(c, "launchlane_publish", { ...input, publication: { ...input.publication, expectedText: "x".repeat(241) } }, signal)).error).code, "INVALID_INPUT");
    assert.equal(queued.length, 0);
    const first = object(data(await callMcpTool(c, "launchlane_publish", input, signal)).data), initial = object(first.run);
    const duplicate = object(data(await callMcpTool(c, "launchlane_publish", { ...input, requestKey: randomUUID() }, signal)).data);
    assert.equal(object(duplicate.run).id, initial.id); assert.equal(queued.length, 1);
    const repo = new AgentRepository(f.store), run = repo.get(f.session.actorId, String(initial.id)); assert.ok(run);
    run.usage.modelCalls = 3; run.usage.toolCalls = 8; repo.save(f.session.actorId, run);
    const replay = object(data(await callMcpTool(c, "launchlane_mission", { id: run.id }, signal)).data);
    assert.deepEqual(replay.run, agentView(repo.get(f.session.actorId, run.id) ?? run));
    const other = { ...f.session, id: "other-session", actorId: "other-actor" }; f.store.saveSession(other);
    assert.equal(object(data(await callMcpTool({ ...c, access: { session: other, parentSessionId: other.id, missions: true } }, "launchlane_mission", { id: run.id }, signal)).error).code, "AGENT_NOT_FOUND");
    const denied = await callMcpTool(c, "launchlane_cancel", { id: run.id, revision: Number(initial.revision) }, signal);
    assert.equal(object(data(denied).error).code, "AGENT_CONFLICT");
    const cancelled = await callMcpTool(c, "launchlane_cancel", { id: run.id, revision: run.revision }, signal);
    assert.equal(object(object(data(cancelled).data).run).state, "cancelled");
    const stored = repo.get(f.session.actorId, run.id); assert.equal(stored?.usage.modelCalls, 3); assert.equal(stored?.usage.toolCalls, 8);
    assert.equal(queued.length, 1); assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM attempts").get()?.n, 0);
  } finally { f.close(); }
});

test("raw MCP reads cannot run in parallel with the owner or renew a paused publication budget", async () => {
  const f = await agentFixture();
  try {
    const c = { config: f.config, store: f.store, access: { session: f.session, parentSessionId: f.session.id, missions: true }, schedule: () => {} }, signal = AbortSignal.timeout(5000);
    const input = { requestKey: randomUUID(), publication: { projectId: f.flow.id, sourceHash: f.flow.profile.sourceHash, path: "/", expectedText: "invoice service" } };
    const initial = object(object(data(await callMcpTool(c, "launchlane_publish", input, signal)).data).run);
    assert.equal(object(data(await callMcpTool(c, "inspect_project", {}, signal)).error).code, "AGENT_BUSY");
    const repo = new AgentRepository(f.store), run = repo.get(f.session.actorId, String(initial.id)); assert.ok(run);
    run.state = "needs_input"; run.nextAction = "reply"; run.usage.toolCalls = run.limits.maxToolCalls - 1; run.usage.modelCalls = 2;
    repo.save(f.session.actorId, run);
    const reads = await Promise.all([callMcpTool(c, "inspect_project", {}, signal), callMcpTool(c, "inspect_project", {}, signal)]);
    assert.equal(reads.filter(result => !result.isError).length, 1);
    const rejected = reads.find(result => result.isError); assert.ok(rejected);
    assert.equal(object(data(rejected).error).code, "BUDGET_EXHAUSTED");
    const stored = repo.get(f.session.actorId, run.id); assert.equal(stored?.usage.toolCalls, run.limits.maxToolCalls); assert.equal(stored?.usage.modelCalls, 2);
    assert.equal(object(data(await callMcpTool(c, "inspect_project", {}, signal)).error).code, "BUDGET_EXHAUSTED");
    assert.equal((await callMcpTool(c, "launchlane_mission", { id: run.id }, signal)).isError, undefined);
    assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM attempts").get()?.n, 0);
  } finally { f.close(); }
});

test("revoking the MCP parent before dispatch prevents model work, while a late response cannot continue a revoked mission", async () => {
  for (const duringRequest of [false, true]) {
    const f = await agentFixture(), originalFetch = globalThis.fetch;
    try {
      const grant = issueMcpAccess(f.config, f.store, f.session, true);
      const request = new Request(`${f.config.origin}/api/mcp`, { headers: { host: new URL(f.config.origin).host, authorization: `Bearer ${grant.accessToken}` } });
      const access = requireMcpAccess(request, f.config, f.store), queued: Array<() => Promise<void>> = [];
      const c = { config: f.config, store: f.store, access, schedule: (work: () => Promise<void>) => { queued.push(work); } };
      const result = object(object(data(await callMcpTool(c, "launchlane_publish", { requestKey: randomUUID(), publication: {
        projectId: f.flow.id, sourceHash: f.flow.profile.sourceHash, path: "/", expectedText: "invoice service",
      } }, AbortSignal.timeout(5000))).data).run);
      assert.equal(queued.length, 1);
      let requests = 0;
      const entered = Promise.withResolvers<void>(), response = Promise.withResolvers<Response>();
      const lateResponse = () => Response.json({ choices: [{ finish_reason: "stop", message: { role: "assistant",
        content: JSON.stringify({ state: "needs_input", message: "late untrusted answer", question: null, nextAction: "reply" }) } }], usage: { total_tokens: 10 } });
      globalThis.fetch = async () => { requests++; entered.resolve(); return duringRequest ? response.promise : lateResponse(); };
      if (!duringRequest) f.store.revokeSession(f.session.id);
      const work = queued[0]; assert.ok(work);
      const running = work();
      if (duringRequest) {
        await Promise.race([entered.promise, new Promise((_, reject) => { const timer = setTimeout(() => reject(Error("Model did not start")), 5000); timer.unref(); })]);
        f.store.revokeSession(f.session.id);
        response.resolve(lateResponse());
      }
      await running;
      const run = new AgentRepository(f.store).get(f.session.actorId, String(result.id));
      assert.equal(requests, duringRequest ? 1 : 0);
      assert.equal(run?.errorCode, "AUTH_REQUIRED"); assert.equal(run?.state, "failed");
      assert.equal(run?.usage.modelCalls, requests);
      assert.ok(!run?.events.some(event => event.message.includes("late untrusted answer")));
      assert.equal(object(data(await callMcpTool(c, "launchlane_context", {}, AbortSignal.timeout(1000))).error).code, "AUTH_REQUIRED");
      assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM attempts").get()?.n, 0);
    } finally { globalThis.fetch = originalFetch; f.close(); }
  }
});
