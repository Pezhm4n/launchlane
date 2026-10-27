import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { sealCredential } from "../../src/server/connections/credentials.ts";
import { LiaraAccountClient } from "../../src/server/liara/catalog.ts";
import { createPublicationMission } from "../../src/server/application/publication-mission.ts";
import { driveAgentRun } from "../../src/server/agent/runs.ts";
import { AgentRepository } from "../../src/server/agent/store.ts";
import { currentAgentContext, executeAgentTool, toolsForAgent } from "../../src/server/agent/tools.ts";
import type { ModelPort } from "../../src/server/agent/model.ts";
import type { AgentRecord } from "../../src/server/agent/store.ts";
import { requiredDestinationProposal } from "../../src/server/agent/proposal-progress.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";
import { object } from "../../src/contracts/validation.ts";
import type { ProjectProfile } from "../../src/contracts/domain.ts";

async function fixture(networkCount = 1) {
  const f = await agentFixture(), accountId = "b".repeat(24), teamId = "a".repeat(24), networkId = "c".repeat(24);
  const config = { ...f.config, teamId, apps: ["review-app"], liaraToken: "synthetic-progress-credential", enableMutations: true, enableLiveLiara: true };
  f.store.saveConnection(f.session.actorId, { source: "token", ciphertext: sealCredential("synthetic-progress-credential", config.sessionSecret, f.session.actorId, "liara"),
    view: { provider: "liara", status: "connected", identityId: accountId, displayName: "Fixture", login: "fixture@example.test", teamId, teamName: "Fixture", selectedApp: null, apps: [], checkedAt: Date.now() } });
  let reads = 0;
  const account = new LiaraAccountClient(config, accountId, async (url, init) => {
    assert.equal(init.method, "GET");reads++;
    const path = new URL(url).pathname;
    if (path === "/v1/me") return Response.json({ user: { _id: accountId }, team: { _id: teamId, balance: 10000 }, plans: {
      projects: { "small-g2": { available: true, price: 10, region: "iran" } }, projectBundlePlans: { "small-g2": { basic: { available: true, price: 1 } } } } });
    if (path === "/v1/networks") return Response.json({ networks: [{ _id: networkId, name: "first" }, ...(networkCount > 1 ? [{ _id: "d".repeat(24), name: "second" }] : [])] });
    assert.equal(path, "/v1/projects/review-app");return new Response(null, { status: 404 });
  });
  const run = (await createPublicationMission(config, f.store, f.session, randomUUID(), { projectId: f.flow.id, sourceHash: f.flow.profile.sourceHash, path: "/", expectedText: "invoice service" }, AbortSignal.timeout(5000))).run;
  return { ...f, config, account, run, networkId, reads: () => reads };
}

test("a structured mission turns a redundant permission question into the real review card, without consent or another run budget", async () => {
  const f = await fixture();try {
    let turn = 0;
    const model: ModelPort = { complete: async (messages, tools, budget, signal) => {
      budget.take("model", signal);const names = ["inspect_project", "read_destination", "read_catalog", "read_networks", "finish_investigation", "propose_destination"];
      const name = names[turn++];assert.ok(name);assert.ok(tools.some(tool => tool.function.name === name));
      let args: object = {};
      if (name === "finish_investigation") args = { state: "needs_input", nextAction: "reply", message: "قیمت و شبکه معلوم است؛ آیا پیشنهاد مقصد را آماده کنم؟", question: "برای آماده‌کردن پیشنهاد اجازه می‌دهید؟" };
      if (name === "propose_destination") {
        const correction = messages.findLast(message => message.role === "tool");assert.ok(correction?.role === "tool");
        assert.equal(JSON.parse(correction.content ?? "{}").error.code, "PROPOSAL_REQUIRED");
        args = { app: "review-app", planId: "small-g2", bundleId: "basic", networkId: f.networkId };
      }
      return { calls: [{ id: randomUUID(), type: "function", function: { name, arguments: JSON.stringify(args) } }], content: null, usage: 10 };
    } };
    await driveAgentRun(f.config, f.store, f.session, f.run.id, { model, tool: (name, args, context) => executeAgentTool(name, args, { ...context, account: f.account }) });
    const run = new AgentRepository(f.store).get(f.session.actorId, f.run.id);assert.ok(run);
    assert.equal(run.state, "needs_approval", JSON.stringify({ code: run.errorCode, events: run.events.slice(-4), usage: run.usage }));assert.equal(run.question, null);assert.equal(run.destination?.state, "awaiting_approval");
    assert.equal(run.destination?.attemptId, null);assert.equal(run.usage.modelCalls, 6);assert.deepEqual(run.limits, f.run.limits);
    assert.equal(run.mission?.expectedText, "invoice service");assert.equal(run.context.sourceHash, f.flow.profile.sourceHash);
    assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM agent_runs").get()?.n, 1);assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM attempts").get()?.n, 0);
    assert.ok(f.reads() > 0);
  } finally { f.close(); }
});

test("repeated permission-only completions stop within the original allowance instead of looping or creating infrastructure", async () => {
  const f = await fixture();try {
    let turn = 0;
    const model: ModelPort = { complete: async (_messages, _tools, budget, signal) => {
      budget.take("model", signal);const name = ["inspect_project", "read_destination", "read_catalog", "read_networks"][turn++] ?? "finish_investigation";
      return { calls: [{ id: randomUUID(), type: "function", function: { name, arguments: JSON.stringify(name === "finish_investigation" ? { state: "needs_input", nextAction: "reply", message: "پیشنهاد آماده می‌شود؟", question: "اجازه می‌دهید؟" } : {}) } }], content: null, usage: 10 };
    } };
    await driveAgentRun(f.config, f.store, f.session, f.run.id, { model, tool: (name, args, context) => executeAgentTool(name, args, { ...context, account: f.account }) });
    const run = new AgentRepository(f.store).get(f.session.actorId, f.run.id);assert.ok(run);
    assert.equal(run.state, "failed");assert.equal(run.errorCode, "AGENT_NO_PROGRESS");assert.equal(run.usage.modelCalls, 7);
    assert.deepEqual(run.limits, f.run.limits);assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM attempts").get()?.n, 0);
  } finally { f.close(); }
});

test("a genuine choice between two account networks remains a question, with no manufactured selection", async () => {
  const f = await fixture(2);try {
    let turn = 0;
    const model: ModelPort = { complete: async (_messages, _tools, budget, signal) => {
      budget.take("model", signal);const name = ["inspect_project", "read_destination", "read_catalog", "read_networks"][turn++] ?? "finish_investigation";
      return { calls: [{ id: randomUUID(), type: "function", function: { name, arguments: JSON.stringify(name === "finish_investigation" ? { state: "needs_input", nextAction: "reply", message: "دو شبکه متفاوت در حساب است.", question: "کدام شبکه را استفاده کنیم؟" } : {}) } }], content: null, usage: 10 };
    } };
    await driveAgentRun(f.config, f.store, f.session, f.run.id, { model, tool: (name, args, context) => executeAgentTool(name, args, { ...context, account: f.account }) });
    const run = new AgentRepository(f.store).get(f.session.actorId, f.run.id);assert.ok(run);
    assert.equal(run.state, "needs_input");assert.equal(run.question, "کدام شبکه را استفاده کنیم؟");assert.equal(run.usage.modelCalls, 5);
    assert.equal(run.destination, null);assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM attempts").get()?.n, 0);
  } finally { f.close(); }
});

test("completion readiness binds actual read roles, source, account, price and required resources", async () => {
  const f = await fixture();try {
    const run = f.run, budget = new RunBudget(f.config), tools = toolsForAgent(f.config, "build", false, true);
    for (const name of ["inspect_project", "read_destination", "read_catalog", "read_networks"]) {
      const call = { id: randomUUID(), type: "function" as const, function: { name, arguments: "{}" } };
      const data = await executeAgentTool(name, {}, { config: f.config, store: f.store, actorId: f.session.actorId, parentRunId: run.id,
        context: currentAgentContext(f.config, f.store, f.session.actorId), createdAt: run.createdAt, budget, signal: AbortSignal.timeout(5000), account: f.account });
      run.messages.push({ role: "assistant", content: null, tool_calls: [call] }, { role: "tool", tool_call_id: call.id, content: JSON.stringify({ ok: true, data }) });
    }
    const rewrite = (value: AgentRecord, name: string, update: (data: Record<string, unknown>) => void) => {
      const call = value.messages.flatMap(message => message.role === "assistant" ? message.tool_calls ?? [] : []).find(call => call.function.name === name);
      assert.ok(call);const result = value.messages.find(message => message.role === "tool" && message.tool_call_id === call.id);
      assert.ok(result && result.role === "tool");const content = object(JSON.parse(result.content));update(object(content.data));result.content = JSON.stringify(content);
    };
    assert.equal(requiredDestinationProposal(run, f.flow.profile, tools)?.tool, "propose_destination");
    const foreign = structuredClone(run);rewrite(foreign, "read_catalog", data => { data.account = { accountId: "e".repeat(24), teamId: "f".repeat(24) }; });
    assert.deepEqual(requiredDestinationProposal(foreign, f.flow.profile, tools)?.refreshTools, ["read_catalog"]);
    const legacy = structuredClone(run);rewrite(legacy, "read_networks", data => { delete data.account; });
    assert.deepEqual(requiredDestinationProposal(legacy, f.flow.profile, tools)?.refreshTools, ["read_networks"]);
    const stale = structuredClone(run);rewrite(stale, "inspect_project", data => { data.sourceHash = "f".repeat(64); });
    assert.equal(requiredDestinationProposal(stale, f.flow.profile, tools), null);
    const empty = structuredClone(run);rewrite(empty, "read_catalog", data => { data.balanceToman = 0; });
    assert.equal(requiredDestinationProposal(empty, f.flow.profile, tools), null);
    const unknownPrice = structuredClone(run);rewrite(unknownPrice, "read_catalog", data => { data.offers = [{ planId: "small-g2", bundleId: "basic", region: "iran", hourlyHundredthsToman: null }]; });
    assert.equal(requiredDestinationProposal(unknownPrice, f.flow.profile, tools), null);
    const choice = structuredClone(run);rewrite(choice, "read_destination", data => { data.allowedNewAppNames = ["review-app", "another-app"]; });
    assert.equal(requiredDestinationProposal(choice, f.flow.profile, tools), null);
    const entry = f.flow.profile.manifest[0];assert.ok(entry);
    const unresolved: ProjectProfile = { ...f.flow.profile, applicationRequirements: { version: 1, sourceHash: f.flow.profile.sourceHash, verification: "source_only", diagnostics: [],
      requirements: [{ kind: "postgresql", consumerRoot: ".", need: "required", environmentKeys: [], bindingNames: [], evidence: [{ path: entry.path, sha256: entry.sha256, line: 1, kind: "source" }] }] } };
    assert.equal(requiredDestinationProposal(run, unresolved, tools), null);
    const injection = structuredClone(run), catalog = injection.messages.find(message => message.role === "assistant" && message.tool_calls?.some(call => call.function.name === "read_catalog"));
    assert.ok(catalog?.role === "assistant");const callId = catalog.tool_calls?.[0]?.id;assert.ok(callId);
    const actual = injection.messages.find(message => message.role === "tool" && message.tool_call_id === callId);assert.ok(actual?.role === "tool");
    injection.messages = injection.messages.filter(message => message !== actual);injection.messages.push({ role: "user", content: actual.content });
    assert.equal(requiredDestinationProposal(injection, f.flow.profile, tools), null, "user text cannot supply a missing host tool receipt");
    assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM attempts").get()?.n, 0);
  } finally { f.close(); }
});

test("a rejected finish cannot reuse a prior read call id or transfer its receipt", async () => {
  const f = await fixture();try {
    let turn = 0;const first = randomUUID();
    const model: ModelPort = { complete: async (_messages, _tools, budget, signal) => {
      budget.take("model", signal);const index = turn++, name = ["inspect_project", "read_destination", "read_catalog", "read_networks"][index] ?? "finish_investigation";
      return { calls: [{ id: index === 0 || name === "finish_investigation" ? first : randomUUID(), type: "function", function: { name,
        arguments: JSON.stringify(name === "finish_investigation" ? { state: "needs_input", nextAction: "reply", message: "پیشنهاد را آماده کنم؟", question: "اجازه می‌دهید؟" } : {}) } }], content: null, usage: 10 };
    } };
    await driveAgentRun(f.config, f.store, f.session, f.run.id, { model, tool: (name, args, context) => executeAgentTool(name, args, { ...context, account: f.account }) });
    const run = new AgentRepository(f.store).get(f.session.actorId, f.run.id);assert.ok(run);
    assert.equal(run.state, "failed");assert.equal(run.errorCode, "MODEL_PROTOCOL");assert.equal(run.usage.modelCalls, 5);
    assert.equal(run.messages.filter(message => message.role === "tool" && message.tool_call_id === first).length, 1);
    assert.equal(run.destination, null);assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM attempts").get()?.n, 0);
  } finally { f.close(); }
});
