import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { publicationWorkloadFixture } from "../helpers/publication-workload-fixture.ts";
import { executeAgentTool, toolsForAgent } from "../../src/server/agent/tools.ts";
import { object } from "../../src/contracts/validation.ts";
import { parsePublicationWorkloadRead } from "../../src/contracts/publication-workload.ts";
import { GoalModelClient } from "../../src/server/agent/model.ts";
import { createAgentRun, driveAgentRun } from "../../src/server/agent/runs.ts";
import { AgentRepository, agentView } from "../../src/server/agent/store.ts";
import { parseAgentView } from "../../src/contracts/agent.ts";
import { publicationWorkloadNotice } from "../../src/server/agent/workload-notice.ts";
import { readPublicationWorkload } from "../../src/server/application/publication-workload.ts";
import type { WorkloadProbe } from "../../src/server/liara/probe.ts";
import { mcpTools } from "../../src/server/mcp/server.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";

test("the shared workload read checks the saved archive, original page and nested JSON routes against the same accepted current release", async () => {
  const f = await publicationWorkloadFixture(); try {
    const before = JSON.stringify(f.store.db.prepare("SELECT * FROM actions").all()), attempts = JSON.stringify(f.store.db.prepare("SELECT * FROM attempts").all()), c = f.context();
    const result = object(await executeAgentTool("read_workload", { ...f.input, assets: true }, c));
    assert.equal(result.outcome, "matched"); assert.equal(result.code, "PUBLICATION_ROUTES_MATCHED"); assert.equal(result.matched, 2);
    assert.equal(result.actionId, f.action.id); assert.equal(result.releaseId, f.releaseId); assert.equal(result.artifactHash, f.flow.artifact?.archiveHash);
    assert.equal(result.sourceHash, f.flow.profile.sourceHash); assert.equal(result.archivedArtifactVerified, true);
    assert.equal(result.publicationVerified, false); assert.equal(result.runtimeContent, "unverified"); assert.equal(result.runtimeConfiguration, "unverified");
    assert.equal(result.remoteChanges, false); assert.equal(object(result.assets).checked, 1); assert.equal(c.budget.toolCalls, 9);
    assert.deepEqual(f.state.sockets, ["/", "/app.js", "/api/orders", "/api/session"]); assert.equal(f.state.identities, 2); assert.equal(f.state.releases, 2);
    assert.ok(!JSON.stringify(result).includes(f.config.modelKey)); assert.ok(!JSON.stringify(result).includes("ignore approvals"));
    assert.ok(Buffer.byteLength(JSON.stringify(result)) < 4096);
    assert.equal(JSON.stringify(f.store.db.prepare("SELECT * FROM actions").all()), before); assert.equal(JSON.stringify(f.store.db.prepare("SELECT * FROM attempts").all()), attempts);
  } finally { f.close(); }
});

test("healthy HTML cannot hide wrong, missing, logged-out, redirected, HTML-fallback or skipped API expectations", async () => {
  for (const mode of ["wrong-value", "missing", "logged-out", "redirect", "mime", "array", "asset"] as const) {
    const f = await publicationWorkloadFixture(); try {
      const api = f.state.pages["/api/orders"], auth = f.state.pages["/api/session"], asset = f.state.pages["/app.js"]; assert.ok(api && auth && asset);
      if (mode === "wrong-value") api.body = '{"summary":{"total":74}}';
      if (mode === "missing") api.body = '{"summary":{}}';
      if (mode === "logged-out") auth.body = '{"auth":{"authenticated":false}}';
      if (mode === "redirect") api.status = 302;
      if (mode === "mime") api.contentType = "text/html";
      if (mode === "array") api.body = '[{"summary":{"total":73}}]';
      if (mode === "asset") asset.contentType = "text/html";
      const result = object(await executeAgentTool("read_workload", { ...f.input, assets: true }, f.context()));
      assert.equal(object(result.primary).matched, true); assert.equal(result.outcome, "mismatch", mode); assert.equal(result.publicationVerified, false);
      assert.equal(result.code, "PUBLICATION_ROUTES_MISMATCH"); assert.equal(f.store.getAction(f.action.id, f.session.actorId).state, "observing");
    } finally { f.close(); }
  }
});

test("a newer READY release, missing current ID, unready exact release or a mid-read replacement cannot verify these routes", async () => {
  for (const mode of ["newer", "missing", "unready", "changed"] as const) {
    const f = await publicationWorkloadFixture(); try {
      if (mode === "newer") f.state.current = "newer-ready-release";
      if (mode === "missing") f.state.current = null;
      if (mode === "unready") f.state.ready = false;
      if (mode === "changed") f.state.onSocket = () => { f.state.current = "newer-ready-release"; };
      const result = object(await executeAgentTool("read_workload", f.input, f.context()));
      assert.equal(result.outcome, "inconclusive"); assert.equal(result.code, mode === "changed" ? "PUBLICATION_RELEASE_CHANGED" : "PUBLICATION_RELEASE_NOT_CURRENT");
      assert.equal(f.state.sockets.length, mode === "changed" ? 3 : 0); assert.equal(result.publicationVerified, false);
    } finally { f.close(); }
  }
});

test("invalid route inputs, foreign scope, altered source receipts and archives fail before any provider or workload read", async () => {
  const f = await publicationWorkloadFixture(); try {
    const [first] = f.input.checks; assert.ok(first);
    for (const input of [{ ...f.input, checks: [] }, { ...f.input, checks: [first, first] }, { path: "/", checks: f.input.checks },
      { path: "/", publicationActionId: f.action.id }, { ...f.input, publicationActionId: "bad-id" },
      { ...f.input, checks: [{ ...first, path: "/api/orders?token=private" }] },
      { ...f.input, checks: [{ ...first, assertions: [{ pointer: ["__proto__"], equals: null }] }] },
      { ...f.input, checks: Array.from({ length: 9 }, (_, index) => ({ ...first, path: `/api/p${index}` })) },
      { ...f.input, path: "/other" }]) await assert.rejects(executeAgentTool("read_workload", input, f.context()));
    assert.equal(f.state.reads, 0); assert.deepEqual(f.state.sockets, []);
    const connection = f.store.getConnection(f.session.actorId, "liara"); assert.ok(connection);
    f.store.saveConnection(f.session.actorId, { ...connection, view: { ...connection.view, identityId: "foreign-account" } });
    await assert.rejects(executeAgentTool("read_workload", f.input, f.context()), { code: "SCOPE_DENIED" });
    f.store.saveConnection(f.session.actorId, connection);
    f.store.db.prepare("UPDATE attempts SET remote_id='different-reply' WHERE action_id=?").run(f.action.id);
    await assert.rejects(executeAgentTool("read_workload", f.input, f.context()), { code: "PUBLICATION_RECEIPT_REQUIRED" });
    f.store.db.prepare("UPDATE attempts SET remote_id=? WHERE action_id=?").run(f.releaseId, f.action.id);
    assert.ok(f.flow.artifact); writeFileSync(join(f.config.stateDir, "source-artifacts", `${f.flow.artifact.archiveHash}.tar.gz`), "changed bytes");
    await assert.rejects(executeAgentTool("read_workload", f.input, f.context()), { code: "ARTIFACT_MISMATCH" });
    assert.equal(f.state.reads, 0); assert.deepEqual(f.state.sockets, []);
  } finally { f.close(); }
});

test("app replacement, selection changes, private DNS and exhausted budget never become successful publication observations", async () => {
  for (const mode of ["identity-before", "identity-after", "selection", "dns", "budget", "origin", "gate"] as const) {
    const f = await publicationWorkloadFixture(); try {
      const c = f.context();
      if (mode === "identity-before") f.state.replacementAt = 1;
      if (mode === "identity-after") f.state.replacementAt = 2;
      if (mode === "dns") f.state.privateDns = true;
      if (mode === "selection") f.state.onSocket = () => { const connection = f.store.getConnection(f.session.actorId, "liara"); assert.ok(connection);
        f.store.saveConnection(f.session.actorId, { ...connection, view: { ...connection.view, selectedApp: null } }); };
      if (mode === "budget") c.budget.toolCalls = c.budget.maxToolCalls - 1;
      const config = mode === "origin" ? { ...c.config, probeOrigins: { [f.app]: "https://other.example.com" } } : mode === "gate" ? { ...c.config, enableLiveLiara: false } : c.config;
      await assert.rejects(executeAgentTool("read_workload", f.input, { ...c, config }), { code: mode.startsWith("identity") ? "SCOPE_DENIED" :
        mode === "selection" ? "AGENT_CONTEXT_CHANGED" : mode === "dns" ? "PROBE_DNS_DENIED" : mode === "budget" ? "BUDGET_EXHAUSTED" : mode === "origin" ? "PUBLICATION_ORIGIN_CHANGED" : "LIVE_LIARA_DISABLED" });
      assert.equal(f.state.sockets.length, mode === "identity-after" ? 3 : mode === "selection" ? 1 : 0);
    } finally { f.close(); }
  }
});

test("stale, future, wrong-path and foreign-scope probe receipts are rejected rather than combined with this release", async () => {
  for (const mode of ["stale", "future", "path", "scope", "origin"] as const) {
    const f = await publicationWorkloadFixture(); try {
      const c = f.context(), check = c.probe.check.bind(c.probe);
      c.probe.check = async (...args: Parameters<WorkloadProbe["check"]>) => {
        const result = await check(...args);
        return { ...result, ...(mode === "stale" ? { observedAt: 1 } : mode === "future" ? { observedAt: Date.now() + 60000 } :
          mode === "path" ? { path: "/other" } : mode === "scope" ? { scope: { ...result.scope, teamId: "d".repeat(24) } } : { origin: "https://other.example.com" }) };
      };
      await assert.rejects(executeAgentTool("read_workload", f.input, c), { code: "EVIDENCE_MISMATCH" });
      assert.equal(f.state.sockets.length, 1);
    } finally { f.close(); }
  }
});

test("MCP exposes the same optional publication-route schema with its existing read-only grant", async () => {
  const f = await publicationWorkloadFixture(); try {
    const schema = mcpTools(f.config, { session: f.session, parentSessionId: f.session.id, missions: false }).find(tool => tool.name === "read_workload"); assert.ok(schema);
    assert.equal(schema.annotations?.readOnlyHint, true); assert.ok(object(schema.inputSchema.properties).publicationActionId);
    assert.equal(object(object(schema.inputSchema.properties).checks).maxItems, 8);
  } finally { f.close(); }
});

test("redaction placeholders cannot become successful JSON or stored primary expectations", async () => {
  for (const mode of ["api", "primary-json", "primary-text"] as const) {
    const f = await publicationWorkloadFixture(mode === "api" ? undefined : mode === "primary-json" ? { kind: "json", field: "secret", equals: "[REDACTED]" } : { kind: "text", contains: "[REDACTED]" });
    try {
      const input = mode === "api" ? { ...f.input, checks: [{ path: "/api/orders", status: 200, assertions: [{ pointer: ["secret"], equals: "[REDACTED]" }] }] } : f.input;
      if (mode !== "api") f.state.pages["/"] = { status: 200, contentType: "application/json", body: JSON.stringify({ secret: f.config.modelKey }) };
      await assert.rejects(executeAgentTool("read_workload", input, f.context()), { code: "PUBLICATION_WORKLOAD_REDACTED" });
      assert.equal(f.state.reads, 0); assert.deepEqual(f.state.sockets, []);
    } finally { f.close(); }
  }
});

test("a standalone twelve-read allowance cannot start an eight-route suite that needs fourteen reads", async () => {
  const f = await publicationWorkloadFixture(); try {
    const c = f.context(), budget = new RunBudget({ ...f.config, maxToolCalls: 12 }), checks = Array.from({ length: 8 }, (_, index) => ({ ...f.input.checks[0], path: `/api/p${index}` }));
    await assert.rejects(executeAgentTool("read_workload", { ...f.input, checks }, { ...c, budget }), { code: "BUDGET_EXHAUSTED" });
    assert.equal(budget.toolCalls, 0); assert.equal(f.state.reads, 0); assert.deepEqual(f.state.sockets, []);
  } finally { f.close(); }
});

test("current release correlation supplies the exact accepted action even when the data-context tool set omits publication history", async () => {
  const f = await publicationWorkloadFixture(); try {
    const tools = toolsForAgent(f.config, "native", true, false, false, true).map(tool => tool.function.name);
    assert.ok(!tools.includes("read_publications")); assert.ok(tools.includes("read_releases") && tools.includes("read_workload"));
    const release = object(await executeAgentTool("read_releases", {}, f.context())), actionId = object(release.sourceComparison).recordedActionId;
    assert.equal(actionId, f.action.id);
    const result = object(await executeAgentTool("read_workload", { ...f.input, publicationActionId: actionId }, f.context()));
    assert.equal(result.outcome, "matched"); assert.equal(result.publicationVerified, false);
  } finally { f.close(); }
});

test("the actual shared Agent turn persists a host route notice and replay does not repeat reads or change publication authority", async () => {
  const f = await publicationWorkloadFixture(); try {
    let requests = 0;
    const model = new GoalModelClient(f.config, async (_url, init) => {
      requests++;
      if (requests === 3) { assert.match(String(init.body), /publication-routes-v1/); assert.ok(!String(init.body).includes(f.config.liaraToken)); }
      const body = object(JSON.parse(String(init.body))); assert.ok(Array.isArray(body.messages));
      const actionId = requests === 2 ? object(object(JSON.parse(String(object(body.messages.at(-1)).content))).data).sourceComparison : null;
      return Response.json({ choices: [{ finish_reason: "tool_calls", message: { role: "assistant", tool_calls: [{ id: randomUUID(), type: "function", function: requests === 1
        ? { name: "read_releases", arguments: "{}" } : requests === 2
        ? { name: "read_workload", arguments: JSON.stringify({ ...f.input, publicationActionId: object(actionId).recordedActionId }) }
        : { name: "finish_investigation", arguments: JSON.stringify({ state: "partially_completed", message: "معیارهای پاسخ در همین بررسی برقرار بود؛ ماندگاری و رفتار مرورگر سنجیده نشده‌اند.", question: null, nextAction: "reply" }) },
      }] } }], usage: { total_tokens: 20 } });
    });
    const run = createAgentRun(f.config, f.store, f.session, randomUUID(), "پاسخ مسیرهای همین انتشار ثبت‌شده را بررسی کن", f.flow.id, "maintenance").run;
    const dependencies = { model, tool: (name: string, args: unknown, context: Parameters<typeof executeAgentTool>[2]) => executeAgentTool(name, args, { ...context, read: f.context().read, probe: f.context().probe }) };
    await driveAgentRun(f.config, f.store, f.session, run.id, dependencies);
    const repo = new AgentRepository(f.store), saved = repo.get(f.session.actorId, run.id); assert.ok(saved);
    assert.equal(saved.state, "partially_completed"); assert.equal(saved.effect, "no_remote_changes"); assert.equal(saved.usage.modelCalls, 3);
    const view = parseAgentView(agentView(saved)); assert.equal(view.events.filter(event => event.notice?.includes("مسیر API")).length, 1);
    assert.equal(saved.publication, null); assert.equal(f.store.getAction(f.action.id, f.session.actorId).state, "observing");
    const reads = f.state.reads, sockets = f.state.sockets.length;
    await driveAgentRun(f.config, f.store, f.session, run.id, dependencies);
    assert.equal(f.state.reads, reads); assert.equal(f.state.sockets.length, sockets); assert.equal(requests, 3);
    const result = await readPublicationWorkload(f.config, f.store, f.session.actorId, { ...parsePublicationWorkloadRead({ publicationActionId: f.action.id, checks: f.input.checks }), path: "/", assets: false }, f.context().budget, f.context().signal, { read: f.context().read, probe: f.context().probe });
    assert.ok(publicationWorkloadNotice({ ok: true, data: result }, f.context().context));
    assert.equal(publicationWorkloadNotice({ ok: true, data: { ...result, appId: "foreign" } }, f.context().context), null);
    assert.equal(publicationWorkloadNotice({ ok: true, data: { ...result, publicationVerified: true } }, f.context().context), null);
  } finally { f.close(); }
});
