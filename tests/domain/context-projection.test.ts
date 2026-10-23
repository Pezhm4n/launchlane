import assert from "node:assert/strict";
import { test } from "node:test";
import { projectModelMessages } from "../../src/server/agent/context-projection.ts";
import { GoalModelClient, type ModelMessage, type ToolDefinition, validateToolMessages } from "../../src/server/agent/model.ts";
import { readConfig } from "../../src/server/config.ts";
import { AppError } from "../../src/server/errors.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";

const source = "// original workload must remain unchanged\n".repeat(370);
function pair(id: string, options: { name?: string; args?: unknown; content?: string; path?: string; hash?: string } = {}): ModelMessage[] {
  const path = options.path ?? "server.js";
  return [{ role: "assistant", content: null, tool_calls: [{ id, type: "function", function: {
    name: options.name ?? "read_project_file", arguments: JSON.stringify(options.args ?? { path }),
  } }] }, { role: "tool", tool_call_id: id, content: options.content ?? JSON.stringify({ ok: true, data: {
    path, content: source, trust: "untrusted_source", sourceHash: options.hash ?? "a".repeat(64),
  } }) }];
}
function history(): ModelMessage[] {
  return [{ role: "system", content: "Original oracle /orders 200; program expired; unknown write must be observed." },
    { role: "user", content: "همان پروژه را بررسی کن؛ انتشار تازه مجاز نیست." },
    ...Array.from({ length: 6 }, (_, index) => pair(`read-${index}`)).flat()];
}
function result(messages: readonly ModelMessage[], id: string) {
  const message = messages.find(message => message.role === "tool" && message.tool_call_id === id);
  assert.ok(message?.role === "tool");
  return message;
}

test("old duplicate source is referenced only when identical full evidence remains in this request; durable messages and pairs stay intact", () => {
  const messages = history(), original = structuredClone(messages), projected = projectModelMessages(messages);
  assert.deepEqual(messages, original);
  assert.equal(projected.length, messages.length);
  validateToolMessages(projected);
  assert.equal(projected[0], messages[0]); assert.equal(projected[1], messages[1]);
  for (const id of ["read-0", "read-1"]) {
    const data = JSON.parse(result(projected, id).content);
    assert.equal(data.contextProjection.fullResultToolCallId, "read-5");
    assert.equal(data.contextProjection.kind, "identical_source_reference");
    assert.equal(data.data.path, "server.js"); assert.equal(data.data.sourceHash, "a".repeat(64));
    assert.equal(data.data.trust, "untrusted_source"); assert.equal(data.data.content, undefined);
  }
  for (const id of ["read-2", "read-3", "read-4", "read-5"]) assert.equal(result(projected, id), result(messages, id));
  assert.equal(JSON.parse(result(projected, "read-5").content).data.content, source);
  assert.ok(Buffer.byteLength(JSON.stringify(projected)) < Buffer.byteLength(JSON.stringify(messages)));
});

test("small requests and unique source content are never clipped or replaced", () => {
  const small = pair("small"); assert.equal(projectModelMessages(small), small);
  const unique = Array.from({ length: 7 }, (_, index) => pair(`unique-${index}`, { path: `file-${index}.js` })).flat();
  assert.equal(projectModelMessages(unique), unique);
});

test("pressure and source sizes use UTF-8 bytes, and applying a projection twice never creates reference chains", () => {
  const content = JSON.stringify({ ok: true, data: { path: "server.js", content: "ف".repeat(5500), trust: "untrusted_source", sourceHash: "a".repeat(64) } });
  const messages = Array.from({ length: 6 }, (_, index) => pair(`utf8-${index}`, { content })).flat();
  assert.ok(JSON.stringify(messages).length < 48 * 1024);
  assert.ok(Buffer.byteLength(JSON.stringify(messages)) > 48 * 1024);
  const projected = projectModelMessages(messages);
  assert.equal(JSON.parse(result(projected, "utf8-0").content).contextProjection.contentBytes, 11000);
  assert.equal(projectModelMessages(projected), projected);
  validateToolMessages(projected);
});

test("source revision, path, arguments and complete payload must all match; unknown schemas remain verbatim", () => {
  const canonical = JSON.parse(result(pair("original"), "original").content);
  const variants = [
    pair("revision", { hash: "b".repeat(64) }), pair("path", { path: "other.js" }),
    pair("args", { args: { path: "server.js", unexpected: true } }),
    pair("unknown", { content: JSON.stringify({ ...canonical, authority: "untrusted" }) }),
    pair("unknown-data", { content: JSON.stringify({ ...canonical, data: { ...canonical.data, workload: "/original" } }) }),
    pair("invalid", { content: "{invalid json" }),
    pair("different", { content: JSON.stringify({ ...canonical, data: { ...canonical.data, content: `${source}different` } }) }),
  ];
  for (const variant of variants) {
    const messages = [...variant, ...history()], projected = projectModelMessages(messages);
    assert.equal(projected[1], messages[1]);
    validateToolMessages(projected);
  }
});

test("failures, logs, metrics, workload, quotes, proposals, user and host authority receipts are never projection candidates", () => {
  for (const name of ["read_logs", "read_metrics", "read_workload", "quote_resource_plan", "propose_publication", "propose_code_repair"]) {
    const messages = [...pair(`old-${name}`, { name }), ...history(), ...pair(`new-${name}`, { name })];
    assert.equal(result(projectModelMessages(messages), `old-${name}`), result(messages, `old-${name}`));
  }
  const failure = JSON.stringify({ ok: false, error: { code: "UNKNOWN_WRITE", message: source, retryable: false } });
  const host: ModelMessage = { role: "user", content: `Host receipt: uncertain; original criterion retained. ${source}` };
  const messages = [...pair("failed", { content: failure }), host, ...history(), ...pair("failed-copy", { content: failure })];
  const projected = projectModelMessages(messages);
  assert.equal(result(projected, "failed"), result(messages, "failed")); assert.equal(projected[2], host);
});

const tool: ToolDefinition = { type: "function", function: { name: "read_project_file", description: "Read a selected file", parameters: {
  type: "object", additionalProperties: false, required: ["path"], properties: { path: { type: "string" } },
} } };
function config() {
  return readConfig({ MODEL_ID: "gpt-6-luna", MODEL_API_KEY: "synthetic-model-value-".repeat(3),
    LAUNCHLANE_OPERATOR_TOKEN: "synthetic-operator-value-".repeat(3), LAUNCHLANE_SESSION_SECRET: "synthetic-session-value-".repeat(3),
    LAUNCHLANE_ENABLE_LIVE_MODEL: "true" });
}
const budget = () => new RunBudget({ runTimeoutMs: 10000, maxModelCalls: 1, maxToolCalls: 1 });

test("the real model adapter sends a smaller redacted projection under the unchanged byte ceiling, with one request and reservation", async (t) => {
  const c = config(), messages = history(), original = structuredClone(messages);
  messages[1] = { role: "user", content: `Keep original oracle. ${c.modelKey}` };
  let requests = 0, reservations = 0;
  assert.ok(Buffer.byteLength(JSON.stringify(messages)) > 96 * 1024);
  const runBudget = budget();
  await new GoalModelClient(c, async (_url, init) => {
    requests++;
    const body = String(init.body), request = JSON.parse(body);
    assert.ok(Buffer.byteLength(body) <= 96 * 1024);
    assert.ok(!body.includes(c.modelKey));
    validateToolMessages(request.messages);
    assert.equal(JSON.parse(result(request.messages, "read-5").content).data.content, source);
    t.diagnostic(JSON.stringify({ originalMessagesBytes: Buffer.byteLength(JSON.stringify(messages)), requestBytes: Buffer.byteLength(body), limitBytes: 96 * 1024 }));
    return Response.json({ choices: [{ finish_reason: "stop", message: { role: "assistant", content: "نتیجه خواندن حفظ شد." } }], usage: { total_tokens: 12 } });
  }).complete(messages, [tool], runBudget, AbortSignal.timeout(10000), () => { reservations++; });
  assert.equal(requests, 1); assert.equal(reservations, 1); assert.equal(runBudget.modelCalls, 1);
  assert.deepEqual(messages.slice(2), original.slice(2)); assert.ok(messages[1]?.content?.includes(c.modelKey));
});

test("irreducible oversized context and malformed pairs still fail before transport or reservation", async () => {
  for (const malformed of [false, true]) {
    const messages = malformed ? history().slice(0, -1) : Array.from({ length: 7 }, (_, index) => pair(`unique-${index}`, { path: `file-${index}.js` })).flat();
    let requests = 0, reservations = 0;
    const runBudget = budget();
    await assert.rejects(new GoalModelClient(config(), async () => { requests++; throw new Error("Must not send"); })
      .complete(messages, [tool], runBudget, AbortSignal.timeout(10000), () => { reservations++; }),
    (error: unknown) => error instanceof AppError && error.code === (malformed ? "MODEL_PROTOCOL" : "MODEL_INPUT_LIMIT"));
    assert.equal(requests, 0); assert.equal(reservations, 0); assert.equal(runBudget.modelCalls, 0);
  }
});
