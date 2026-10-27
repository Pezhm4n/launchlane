import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { projectFileReadRange, projectFileText } from "../../src/server/agent/project-file-read.ts";
import { currentAgentContext, executeAgentTool, toolsForAgent, toolsForConversation } from "../../src/server/agent/tools.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";
import { AppError } from "../../src/server/errors.ts";
import { object } from "../../src/contracts/validation.ts";
import { projectModelMessages } from "../../src/server/agent/context-projection.ts";
import { validateToolMessages, type ModelMessage } from "../../src/server/agent/model.ts";
import { callMcpTool, mcpTools } from "../../src/server/mcp/server.ts";
import { agentFixture } from "../helpers/agent-fixture.ts";

const code = (expected: string) => (error: unknown) => error instanceof AppError && error.code === expected;
test("full reads keep their original shape and limit; bounded excerpts preserve UTF-8 and explicit continuation", () => {
  assert.deepEqual(projectFileText(Buffer.from("a\r\nb\n"), null, []), { content: "a\r\nb\n" });
  const bytes = Buffer.from(Array.from({ length: 300 }, (_, index) => `// ${index + 1} ${"ف".repeat(90)}`).join("\n"));
  assert.throws(() => projectFileText(bytes, null, []), code("SOURCE_FILE_LIMIT"));
  const first = projectFileText(bytes, { startLine: 1, lineCount: 200 }, []);
  assert.ok(first.range);assert.ok(first.range.endLine < 200);assert.ok(first.range.contentBytes <= 20 * 1024);
  assert.equal(first.range.lineNumbers, "redacted_text");assert.equal(first.range.totalLines, 300);
  assert.equal(first.range.nextStartLine, first.range.endLine + 1);assert.equal(Buffer.byteLength(first.content), first.range.contentBytes);
  let reconstructed = first.content;
  let next: number | null = first.range.nextStartLine;
  while (next !== null) {
    const part = projectFileText(bytes, { startLine: next, lineCount: 200 }, []);
    assert.ok(part.range);reconstructed += part.content;next = part.range.nextStartLine;
  }
  assert.equal(reconstructed, bytes.toString("utf8"));
  assert.equal(projectFileText(Buffer.from("a\nb"), { startLine: 2, lineCount: 20 }, []).range?.hasMore, false);
});

test("invalid bounds, binary/invalid UTF-8 and oversized individual lines cannot masquerade as complete text", () => {
  for (const args of [{ startLine: 0 }, { startLine: -1 }, { startLine: 1.5 }, { startLine: "1" }, { startLine: 1000001 }, { lineCount: 0 }, { lineCount: 201 }, { lineCount: null }])
    assert.throws(() => projectFileReadRange(args), code("INVALID_INPUT"));
  assert.equal(projectFileReadRange({}), null);assert.deepEqual(projectFileReadRange({ lineCount: 2 }), { startLine: 1, lineCount: 2 });
  for (const bytes of [Buffer.from([0xff, 0xfe]), Buffer.from("a\0b")])
    assert.throws(() => projectFileText(bytes, { startLine: 1, lineCount: 1 }, []), code("SOURCE_FILE_LIMIT"));
  assert.throws(() => projectFileText(Buffer.from("x".repeat(20481)), { startLine: 1, lineCount: 1 }, []), code("SOURCE_FILE_LIMIT"));
  assert.throws(() => projectFileText(Buffer.from("a\nb"), { startLine: 3, lineCount: 1 }, []), code("SOURCE_LINE_RANGE"));
});

test("redaction happens before slicing and line numbering explicitly belongs to the sanitized text", () => {
  const secret = "synthetic\nprivate-value", bytes = Buffer.from(`first\n${secret}\nlast`);
  const part = projectFileText(bytes, { startLine: 2, lineCount: 1 }, [secret]);
  assert.equal(part.content, "[REDACTED]\n");assert.equal(part.range?.totalLines, 3);
  assert.equal(part.range?.lineNumbers, "redacted_text");
});

test("the shared registry reads a large immutable manifest file with the same authority, budget and revision fences", async () => {
  const f = await agentFixture();
  try {
    writeFileSync(join(f.project, "large.mjs"), Array.from({ length: 400 }, (_, index) => `// line ${index + 1} ${"plain source ".repeat(7)}`).join("\n"));
    await prepareProjectFlow(f.config, f.store, f.session.actorId, { kind: "local", directory: "service" }, AbortSignal.timeout(5000));
    const context = () => ({ config: f.config, store: f.store, actorId: f.session.actorId,
      context: currentAgentContext(f.config, f.store, f.session.actorId), createdAt: Date.now(), budget: new RunBudget(f.config), signal: AbortSignal.timeout(5000) });
    for (const registry of [toolsForAgent(f.config), toolsForConversation(f.config)]) {
      const definition = registry.find(tool => tool.function.name === "read_project_file");
      assert.ok(definition?.function.parameters.properties.startLine);assert.ok(definition.function.parameters.properties.lineCount);
    }
    const invalid = context();
    await assert.rejects(executeAgentTool("read_project_file", { path: "large.mjs", startLine: 0 }, invalid), code("INVALID_INPUT"));
    assert.equal(invalid.budget.toolCalls, 0);
    await assert.rejects(executeAgentTool("read_project_file", { path: "large.mjs" }, context()), code("SOURCE_FILE_LIMIT"));
    const c = context(), result = object(await executeAgentTool("read_project_file", { path: "large.mjs", startLine: 200, lineCount: 2 }, c));
    assert.equal(result.trust, "untrusted_source");assert.equal(result.sourceHash, c.context.sourceHash);assert.equal(c.budget.toolCalls, 1);
    assert.equal(object(result.range).startLine, 200);assert.match(String(result.content), /line 200 /);assert.doesNotMatch(String(result.content), /line 199 /);
    const mcp = { config: f.config, store: f.store, access: { session: f.session, parentSessionId: f.session.id, missions: false },
      schedule: () => { throw new Error("Source reads cannot schedule a mission"); } };
    assert.ok(object(mcpTools(f.config, mcp.access).find(tool => tool.name === "read_project_file")?.inputSchema.properties).startLine);
    const reply = await callMcpTool(mcp, "read_project_file", { path: "large.mjs", startLine: 202, lineCount: 1 }, AbortSignal.timeout(5000));
    const block = reply.content?.[0];assert.ok(block?.type === "text");
    const mcpRead = object(object(JSON.parse(block.text)).data);
    assert.equal(object(mcpRead.range).startLine, 202);assert.match(String(mcpRead.content), /line 202 /);
    assert.equal(f.store.db.prepare("SELECT count(*) n FROM attempts").get()?.n, 0);
    assert.equal(f.store.db.prepare("SELECT count(*) n FROM agent_runs").get()?.n, 0);
    await assert.rejects(executeAgentTool("read_project_file", { path: "../private", startLine: 1 }, context()), code("SOURCE_PATH_DENIED"));
    writeFileSync(join(f.project, "large.mjs"), "// changed\n");
    await assert.rejects(executeAgentTool("read_project_file", { path: "large.mjs", startLine: 1 }, c), code("PROJECT_CHANGED"));
  } finally { f.close(); }
});

test("ranged results retain every call/result pair and unique chunk under context pressure", () => {
  const messages: ModelMessage[] = [];
  for (let index = 0; index < 6; index++) messages.push({ role: "assistant", content: null, tool_calls: [{ id: `range-${index}`, type: "function", function: {
    name: "read_project_file", arguments: JSON.stringify({ path: "large.mjs", startLine: 1, lineCount: 100 }),
  } }] }, { role: "tool", tool_call_id: `range-${index}`, content: JSON.stringify({ ok: true, data: {
    path: "large.mjs", content: "x".repeat(10000), trust: "untrusted_source", sourceHash: "a".repeat(64),
    range: { startLine: 1, endLine: 100, totalLines: 500, nextStartLine: 101 },
  } }) });
  assert.equal(projectModelMessages(messages), messages);validateToolMessages(messages);
});
