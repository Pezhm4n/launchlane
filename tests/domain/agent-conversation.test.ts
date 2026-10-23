import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { GoalModelClient } from "../../src/server/agent/model.ts";
import { createAgentRun, driveAgentRun, continueAgentRun } from "../../src/server/agent/runs.ts";
import { AgentRepository } from "../../src/server/agent/store.ts";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { AppError } from "../../src/server/errors.ts";
import { executeAgentTool } from "../../src/server/agent/tools.ts";
import { LiaraAccountClient } from "../../src/server/liara/catalog.ts";
import { sealCredential } from "../../src/server/connections/credentials.ts";

test("assistant price questions use the shared scoped catalog and quote application without creating a proposal or a write", async () => {
  const f = await agentFixture(), accountId = "b".repeat(24), teamId = "a".repeat(24), config = { ...f.config, teamId, enableLiveLiara: true, enableMutations: true, liaraToken: "synthetic-chat-catalog" };
  try {
    f.store.saveConnection(f.session.actorId, { source: "token", ciphertext: sealCredential(config.liaraToken, config.sessionSecret, f.session.actorId, "liara"),
      view: { provider: "liara", status: "connected", identityId: accountId, displayName: "آزمون", login: "test@example.test", checkedAt: Date.now(), teamId, teamName: "آزمون", apps: [], selectedApp: null } });
    let turn = 0, reads = 0;
    const account = new LiaraAccountClient(config, accountId, async (url, input) => {
      assert.equal(input.method, "GET"); assert.equal(new URL(url).pathname, "/v1/me"); reads++;
      return Response.json({ user: { _id: accountId }, team: { _id: teamId, balance: 10000 }, plans: {
        projects: { starter: { available: true, region: "iran", price: 250 } }, projectBundlePlans: { starter: { basic: { available: true, price: 40 } } } } });
    });
    const model = new GoalModelClient(config, async (_url, input) => {
      const packet = JSON.parse(String(input.body)), names = packet.tools.map((tool: { function: { name: string } }) => tool.function.name);
      assert.ok(names.includes("read_catalog") && names.includes("quote_resource_plan")); assert.ok(!names.some((name: string) => name.startsWith("propose_")));
      if (++turn === 3) return final("هزینه پایهٔ این گزینه ۲۹۰ تومان در ساعت است؛ ظرفیت لازم هنوز اندازه‌گیری نشده است.");
      return Response.json({ choices: [{ finish_reason: "tool_calls", message: { role: "assistant", tool_calls: [{ id: randomUUID(), type: "function", function: {
        name: turn === 1 ? "read_catalog" : "quote_resource_plan", arguments: turn === 1 ? "{}" : JSON.stringify({ planId: "starter", bundleId: "basic" }) } }] } }], usage: { total_tokens: 50 } });
    });
    const run = createAgentRun(config, f.store, f.session, randomUUID(), "چه پلنی موجود است و هزینه پایهٔ starter چقدر است؟", f.flow.id, "conversation").run;
    await driveAgentRun(config, f.store, f.session, run.id, { model, tool: (name, args, context) => executeAgentTool(name, args, { ...context, account }) });
    const result = new AgentRepository(f.store).get(f.session.actorId, run.id); assert.ok(result);
    assert.equal(result.state, "partially_completed"); assert.equal(reads, 2); assert.equal(result.usage.modelCalls, 3); assert.equal(result.usage.toolCalls, 2);
    assert.ok(result.messages.some(message => message.role === "tool" && message.content.includes('"hourlyHundredthsToman":29000')));
    assert.equal(result.destination, null); assert.equal(result.effect, "no_remote_changes");
    assert.equal(f.store.db.prepare("SELECT count(*) n FROM actions").get()?.n, 0); assert.equal(f.store.db.prepare("SELECT count(*) n FROM attempts").get()?.n, 0);
  } finally { f.close(); }
});

const final = (message: string, state = "partially_completed", question: string | null = null) =>
  Response.json({ choices: [{ finish_reason: "tool_calls", message: { role: "assistant", tool_calls: [{
    id: randomUUID(), type: "function", function: { name: "finish_investigation", arguments: JSON.stringify({
      state, message, question, nextAction: "reply",
    }) },
  }] } }], usage: { total_tokens: 50 } });

for (const [goal, answer, question] of [
  ["سلام، وقت شما بخیر.", "سلام! در خدمت شما هستم.", null],
  ["سلااام رفیق! خوبی؟", "سلام! آماده‌ام برای پروژه‌تان کمک کنم.", null],
  ["خب اینو درستش کن", "برای اصلاح به توضیح مشکل نیاز دارم.", "کدام مشکل را می‌خواهید بررسی کنیم؟"],
  ["چقدر RAM لازم دارم؟", "بدون اندازه‌گیری مصرف نمی‌توانم ظرفیت لازم را مشخص کنم.", null],
] as const) {
  test(`optional chat accepts a non-executing answer without manufacturing a tool receipt: ${goal}`, async () => {
    const f = await agentFixture();
    try {
      let toolCalls = 0;
      const model = new GoalModelClient(f.config, async () => final(answer, "partially_completed", question));
      const created = createAgentRun(f.config, f.store, f.session, randomUUID(), goal, f.flow.id, "conversation");
      await driveAgentRun(f.config, f.store, f.session, created.run.id, {
        model, tool: async () => { toolCalls++; throw new Error("No evidence read required"); },
      });
      const run = new AgentRepository(f.store).get(f.session.actorId, created.run.id);
      assert.ok(run);
      assert.equal(run.state, question ? "needs_input" : "partially_completed");
      assert.equal(run.errorCode, null);
      assert.equal(run.events.at(-1)?.message, answer);
      assert.equal(run.question, question);
      assert.equal(run.effect, "no_remote_changes");
      assert.equal(toolCalls, 0);
      assert.equal(run.usage.toolCalls, 0);
      assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM attempts").get()?.n, 0);
    } finally { f.close(); }
  });
}

test("a mission still cannot finish without evidence, and chat cannot manufacture a completed outcome", async () => {
  for (const channel of ["legacy", "conversation"] as const) {
    const f = await agentFixture();
    try {
      const model = new GoalModelClient(f.config, async () => final("انتشار تأیید شد", channel === "conversation" ? "completed" : "partially_completed"));
      const created = createAgentRun(f.config, f.store, f.session, randomUUID(), "پروژه را منتشر کن", f.flow.id, channel);
      await driveAgentRun(f.config, f.store, f.session, created.run.id, { model });
      const run = new AgentRepository(f.store).get(f.session.actorId, created.run.id);
      assert.equal(run?.state, "failed");
      assert.equal(run?.errorCode, "OUTCOME_UNVERIFIED");
      assert.equal(run?.effect, "no_remote_changes");
    } finally { f.close(); }
  }
});

test("read-only chat exposes no proposal tool and preserves the revised goal on continuation", async () => {
  const f = await agentFixture();
  try {
    const requests: Record<string, unknown>[] = [];
    const model = new GoalModelClient({ ...f.config, enableMutations: true, enableLocalRepair: true, enableLiveLiara: true }, async (_url, init) => {
      const request = JSON.parse(String(init.body));
      requests.push(request);
      const names = request.tools.map((tool: { function: { name: string } }) => tool.function.name);
      assert.ok(!names.some((name: string) => name.startsWith("propose_")));
      return final("فقط بررسی انجام می‌دهم؛ تغییری منتشر نشده است.");
    });
    const created = createAgentRun(f.config, f.store, f.session, randomUUID(), "برای انتشار راهنمایی می‌خواهم", f.flow.id, "conversation");
    await driveAgentRun(f.config, f.store, f.session, created.run.id, { model });
    const repo = new AgentRepository(f.store), first = repo.get(f.session.actorId, created.run.id);
    assert.ok(first);
    const changed = "نظرم عوض شد؛ فقط راهنمایی می‌خواهم و هیچ تغییری نده";
    continueAgentRun(f.config, f.store, f.session, first.id, first.revision, randomUUID(), changed);
    await driveAgentRun(f.config, f.store, f.session, first.id, { model });
    const messages = requests.at(-1)?.messages as { role: string; content: string }[];
    assert.equal(messages.at(-1)?.content, changed);
    assert.ok(messages.some(message => message.role === "system" && message.content.includes("optional read-only project chat")));
    assert.equal(repo.get(f.session.actorId, first.id)?.effect, "no_remote_changes");
  } finally { f.close(); }
});

test("blank initial and continued messages fail before persistence or budget consumption", async () => {
  const f = await agentFixture();
  try {
    for (const value of ["", " ", "\n\t\r ", "\u00a0\u2003"]) {
      assert.throws(() => createAgentRun(f.config, f.store, f.session, randomUUID(), value, f.flow.id, "conversation"),
        error => error instanceof AppError && error.code === "INVALID_INPUT");
    }
    assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM agent_runs").get()?.n, 0);
    const created = createAgentRun(f.config, f.store, f.session, randomUUID(), "  سلام  ", f.flow.id, "conversation");
    await driveAgentRun(f.config, f.store, f.session, created.run.id, {
      model: new GoalModelClient(f.config, async () => final("سلام!")),
    });
    const repo = new AgentRepository(f.store), before = repo.get(f.session.actorId, created.run.id);
    assert.ok(before);
    assert.equal(before.lastInput, "سلام");
    for (const value of ["", " ", "\n\t\r ", "\u00a0\u2003"]) {
      assert.throws(() => continueAgentRun(f.config, f.store, f.session, before.id, before.revision, randomUUID(), value),
        error => error instanceof AppError && error.code === "INVALID_INPUT");
    }
    assert.deepEqual(repo.get(f.session.actorId, before.id), before);
  } finally { f.close(); }
});
