import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { containsSourceCredential, redact } from "../../src/server/policy/redaction.ts";
import { GoalModelClient, type ToolDefinition } from "../../src/server/agent/model.ts";
import { readConfig } from "../../src/server/config.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";
import { captureProject } from "../../src/server/workspace/inspect.ts";
import { AppError } from "../../src/server/errors.ts";
import { parseBuildLogs } from "../../src/server/liara/read-contracts.ts";
import { agentFixture } from "../helpers/agent-fixture.ts";

const secret = 'Synthetic signing +/ع!*()"\\ value';
const url = encodeURIComponent(secret), form = new URLSearchParams({ v: secret }).toString().slice(2);
const variants = [secret, JSON.stringify(secret).slice(1, -1), url, form,
  url.replace(/%[\da-f]{2}/gi, part => part.toLowerCase()),
  form.replace(/%[\da-f]{2}/gi, (part, index: number) => index % 2 ? part.toLowerCase() : part)];

test("known secrets remain hidden in exact JSON, URL and form representations including mixed percent-escape case", () => {
  for (const variant of variants) {
    assert.equal(redact(`before ${variant} after ${variant}`, [secret]), "before [REDACTED] after [REDACTED]");
    for (const path of ["notes.md", "app.py", "package.json", "locales/fa/auth.json", "index.ts"])
      assert.equal(containsSourceCredential(`untrusted echo: ${variant}`, [secret], path), true);
  }
  assert.equal(containsSourceCredential(JSON.stringify({ description: secret }), [secret], "package.json"), true);
});

test("raw secret case, literal plus, regex metacharacters and unrelated encodings keep their meaning", () => {
  assert.equal(redact("keep AbCd", ["abcd"]), "keep AbCd");
  assert.equal(redact("a+b+c", ["a b c"]), "[REDACTED]");
  assert.equal(redact("a b c", ["a+b+c"]), "a b c");
  assert.equal(redact("a%2Bb%2Bc", ["a+b+c"]), "[REDACTED]");
  assert.equal(redact("a+b+c", ["a+b+c"]), "[REDACTED]");
  assert.equal(redact("a...b", ["a.*b"]), "a...b");
  assert.equal(redact("a.*b", ["a.*b"]), "[REDACTED]");
  assert.equal(redact("echo abc", ["abc"]), "echo abc", "the existing short-value threshold is unchanged");
  assert.equal(redact("raw \ud800abc", ["\ud800abc"]), "raw [REDACTED]");
});

test("source capture rejects encoded known values before an archive can be prepared", async () => {
  const f = await agentFixture();
  try {
    for (const variant of variants.slice(2)) {
      writeFileSync(join(f.project, "notes.md"), `untrusted echo: ${variant}\n`);
      await assert.rejects(captureProject(f.workspace, "service", { secrets: [secret], signal: AbortSignal.timeout(5000) }),
        (error: unknown) => error instanceof AppError && error.code === "SENSITIVE_SOURCE");
    }
  } finally { f.close(); }
});

test("provider build evidence and the actual model-request boundary scrub equivalent secret encodings", async () => {
  const scope = { teamId: "a".repeat(24), app: "encoded-evidence" }, releaseId = "b".repeat(24);
  const logs = parseBuildLogs({ release: { _id: releaseId, state: "FAILED" }, buildOutput: variants.map(line => ({
    stream: "STDOUT", line, createdAt: "2026-10-27T08:00:00Z",
  })) }, scope, releaseId, [secret]);
  assert.ok(logs.entries.every(row => row.line === "[REDACTED]"));
  const config = readConfig({ MODEL_API_KEY: "synthetic-model-credential-for-test", MODEL_ID: "gpt-6-luna", LAUNCHLANE_ENABLE_LIVE_MODEL: "true" });
  const tool: ToolDefinition = { type: "function", function: { name: "inspect_project", description: "Read only", parameters: {
    type: "object", additionalProperties: false, properties: {}, required: [],
  } } };
  let sent = 0;
  await new GoalModelClient({ ...config, projectSecretValues: [secret] }, async (_url, init) => {
    sent++;
    const body: { messages: { content: string }[] } = JSON.parse(String(init.body));
    assert.equal(body.messages[0]?.content, variants.map(() => "[REDACTED]").join("\n"));
    return Response.json({ choices: [{ finish_reason: "stop", message: { role: "assistant", content: "بررسی شد." } }] });
  }).complete([{ role: "user", content: variants.join("\n") }], [tool],
    new RunBudget({ maxModelCalls: 1, maxToolCalls: 1, runTimeoutMs: 5000 }), AbortSignal.timeout(5000));
  assert.equal(sent, 1, "only synthetic transport is called");
});
