import assert from "node:assert/strict";
import { test } from "node:test";
import { codexPatchArguments, decodeCodexPatchEvents, CodexPatchModel, codexChildEnvironment } from "../../src/server/agent/codex-patch.ts";
import { AppError } from "../../src/server/errors.ts";
import { missionAuthorityFixture } from "../helpers/mission-authority-fixture.ts";
import { reconcileRejectedCodexResult, settleLegacyCodexTokens } from "../../src/server/application/coding-execution.ts";
import { decideMissionAuthority } from "../../src/server/application/mission-authority.ts";
import { CodeRepairAdapter } from "../../src/server/agent/code-repair.ts";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";

const patch = { baseRevision: "a".repeat(64), files: [{ path: "invoice.mjs", beforeHash: "b".repeat(64), replacements: [{ before: "line.price", after: "line.price * line.quantity" }] }] };
const events = (items: unknown[]) => items.map(value => JSON.stringify(value)).join("\n");
test("Codex structured final text is a patch proposal with measured token usage, never a test or publication receipt", () => {
  const result = decodeCodexPatchEvents(events([
    { type: "thread.started", thread_id: "dedicated-thread" }, { type: "turn.started" },
    { type: "item.completed", item: { type: "error", message: "non-fatal startup diagnostic is not authority" } },
    { type: "item.completed", item: { type: "reasoning", text: "inspect the provided failed sum" } },
    { type: "item.completed", item: { type: "agent_message", text: JSON.stringify(patch, null, 2) } },
    { type: "turn.completed", usage: { input_tokens: 100, cached_input_tokens: 40, output_tokens: 20 } },
  ]));
  assert.equal(result.usage, 120); assert.equal(result.calls.length, 1); assert.equal(result.calls[0]?.function.name, "submit_patch");
  assert.deepEqual(JSON.parse(result.calls[0]?.function.arguments ?? ""), patch);
});
test("command, filesystem, MCP, failed turn, missing usage and conflicting finals never become a successful coding result", () => {
  for (const kind of ["command_execution", "file_change", "mcp_tool_call", "web_search"]) {
    assert.throws(() => decodeCodexPatchEvents(events([{ type: "item.completed", item: { type: kind } }])),
      (error: unknown) => error instanceof AppError && error.code === "CODEX_TOOL_DENIED");
  }
  for (const value of [
    [{ type: "turn.failed", error: { message: "private provider diagnostic" } }],
    [{ type: "item.completed", item: { type: "error", message: "diagnostic alone cannot succeed" } }],
    [{ type: "item.completed", item: { type: "agent_message", text: JSON.stringify(patch) } }],
    [{ type: "turn.completed", usage: { input_tokens: 100, output_tokens: 20 } }, { type: "turn.completed", usage: { input_tokens: 1, output_tokens: 1 } }],
  ]) assert.throws(() => decodeCodexPatchEvents(events(value)), AppError);
});
test("Codex dispatch is ephemeral, ignores user config/rules and disables device execution and network rather than bypassing the sandbox", () => {
  const args = codexPatchArguments("C:/private/patch.schema.json"), joined = args.join(" ");
  for (const flag of ["--ignore-user-config", "--ignore-rules", "--ephemeral", "--strict-config", "--output-schema"]) assert.ok(args.includes(flag));
  for (const feature of ["shell_tool", "apps", "remote_plugin", "multi_agent", "code_mode_host", "memories", "computer_use", "browser_use", "view_image"]) assert.ok(joined.includes(`--disable ${feature}`));
  assert.ok(joined.includes('permissions.launchlane-packet.network.enabled=false'));
  assert.ok(joined.includes('permissions.launchlane-packet.filesystem={":minimal"="read",":workspace_roots"="read"}'));
  assert.equal(/danger-full-access|dangerously-bypass|--worktree|--add-dir/.test(joined), false);
});

test("legacy Codex token receipts settle once without renewing run limits, authority, model calls or tests", async () => {
  const f = await missionAuthorityFixture(false, true);
  try {
    const run = f.repo.get(f.session.actorId, f.proposed.id); assert.ok(run?.repair);
    const original = { ...run.usage }, authority = run.authority?.hash, job = run.repair.id;
    f.store.db.prepare("INSERT INTO coding_agent_executions VALUES(?,?,'returned',?)").run(job, f.session.actorId,
      JSON.stringify({ parentRunId: run.id, code: null, completedAt: Date.now(), tokens: 13351 }));
    settleLegacyCodexTokens(f.store, f.session, job); settleLegacyCodexTokens(f.store, f.session, job);
    const after = f.repo.get(f.session.actorId, run.id); assert.ok(after);
    assert.equal(after.usage.observedTokens, original.observedTokens + 13351);
    assert.equal(after.usage.modelCalls, original.modelCalls); assert.equal(after.usage.toolCalls, original.toolCalls + 2);
    assert.deepEqual(after.limits, run.limits); assert.equal(after.authority?.hash, authority); assert.equal(after.repair?.state, "proposed");
    assert.equal(f.counts().sends, 0); assert.equal(f.counts().patches, 0);
  } finally { f.close(); }
});

test("the Codex port reserves before dispatch, charges version/auth reads and tokens, and cannot dispatch the same job again", async () => {
  const f = await agentFixture(), config = { ...f.config, enableLocalRepair: true };
  try {
    const job = await new CodeRepairAdapter(config, f.store).propose(f.session.actorId, { projectId: f.flow.id, expectedSourceHash: f.flow.profile.sourceHash,
      goal: "اصلاح تعداد اقلام در همان آزمون", allowedPaths: ["invoice.mjs"], testFiles: ["invoice.test.mjs"], execution: "container" }, AbortSignal.timeout(5000));
    f.store.db.prepare("UPDATE code_repair_jobs SET state='working' WHERE id=?").run(job.id);
    let dispatches = 0;
    const model = new CodexPatchModel(config, f.store, f.session.actorId, "synthetic-codex-process", async (_executable, args) => {
      if (args[0] === "--version") return { stdout: "codex-cli 0.163.0-alpha.11\n", stderr: "", code: 0 };
      if (args[0] === "login") return { stdout: "Logged in using ChatGPT", stderr: "", code: 0 };
      dispatches++;
      assert.equal(f.store.db.prepare("SELECT state FROM coding_agent_executions WHERE job_id=?").get(job.id)?.state, "dispatched");
      return { stdout: events([{ type: "thread.started", thread_id: "a".repeat(36) }, { type: "turn.started" },
        { type: "item.completed", item: { type: "error", message: "non-fatal diagnostic" } },
        { type: "item.completed", item: { type: "agent_message", text: JSON.stringify({ ...patch, baseRevision: job.baseRevision }) } },
        { type: "turn.completed", usage: { input_tokens: 100, cached_input_tokens: 40, output_tokens: 20 } }]), stderr: "", code: 0 };
    });
    const budget = new RunBudget({ maxModelCalls: 1, maxToolCalls: 2, runTimeoutMs: 5000 }); budget.observedTokens = 50;
    const messages = [{ role: "system" as const, content: "Return the scoped patch; host owns tests." }, { role: "user" as const,
      content: JSON.stringify({ jobId: job.id, parentRunId: null, baseRevision: job.baseRevision, allowedPaths: job.allowedPaths }) }],
      tools = [{ type: "function" as const, function: { name: "submit_patch", description: "scoped patch", parameters: { type: "object" as const, additionalProperties: false as const, required: [], properties: {} } } }];
    await model.complete(messages, tools, budget, AbortSignal.timeout(5000));
    assert.equal(budget.modelCalls, 1); assert.equal(budget.toolCalls, 2); assert.equal(budget.observedTokens, 170);
    const row = f.store.db.prepare("SELECT state,data_json FROM coding_agent_executions WHERE job_id=?").get(job.id); assert.ok(row);
    const receipt = JSON.parse(String(row.data_json)); assert.equal(row.state, "returned"); assert.equal(receipt.budgetTokensBefore, 50); assert.equal(receipt.budgetTokensAfter, 170);
    assert.equal(receipt.tokens, 120); assert.equal(receipt.cost, "subscription_usage_unpriced");
    await assert.rejects(model.complete(messages, tools, new RunBudget({ maxModelCalls: 1, maxToolCalls: 2, runTimeoutMs: 5000 }), AbortSignal.timeout(5000)),
      (error: unknown) => error instanceof AppError && error.code === "CODEX_EXECUTION_EXISTS");
    assert.equal(dispatches, 1);
    for (const key of ["MODEL_API_KEY", "LIARA_API_TOKEN", "LAUNCHLANE_OPERATOR_TOKEN", "LAUNCHLANE_SESSION_SECRET"]) assert.equal(Object.hasOwn(codexChildEnvironment(), key), false);
  } finally { f.close(); }
});

test("reconciliation requires a completed metadata-only response and unchanged workspace; it never accepts a patch or approves another job", async () => {
  const f = await missionAuthorityFixture(false, true);
  try {
    const actor = f.session.actorId, run = f.repo.get(actor, f.proposed.id); assert.ok(run?.repair);
    const job = run.repair.id;
    f.store.db.prepare("UPDATE code_repair_jobs SET state='failed' WHERE id=?").run(job);
    run.repair = { ...run.repair, state: "failed" }; run.state = "partially_completed"; run.usage.unknownModelCalls = 1; f.repo.save(actor, run);
    const receipt = { jobId: job, parentRunId: run.id, baseRevision: run.context.sourceHash, code: "CODEX_TOOL_DENIED", mode: "packet_only", tokens: 77,
      startedAt: Date.now() - 100, completedAt: Date.now(), eventKinds: ["thread.started", "item.completed", "item:error", "item:agent_message", "turn.started", "turn.completed"] };
    f.store.db.prepare("INSERT INTO coding_agent_executions VALUES(?,?,'uncertain',?)").run(job, actor, JSON.stringify({ ...receipt, eventKinds: [...receipt.eventKinds, "item:command_execution"] }));
    await assert.rejects(reconcileRejectedCodexResult(f.config, f.store, f.session, job, AbortSignal.timeout(5000)), AppError);
    f.store.db.prepare("UPDATE coding_agent_executions SET data_json=? WHERE job_id=?").run(JSON.stringify(receipt), job);
    const before = f.repo.get(actor, run.id); assert.ok(before);
    await reconcileRejectedCodexResult(f.config, f.store, f.session, job, AbortSignal.timeout(5000));
    const after = f.repo.get(actor, run.id); assert.ok(after);
    assert.equal(after.usage.toolCalls, before.usage.toolCalls + 1); assert.equal(after.usage.observedTokens, before.usage.observedTokens + 77);
    assert.equal(after.usage.unknownModelCalls, 0); assert.equal(after.repair?.state, "failed"); assert.equal(after.repair?.artifact, null);
    assert.deepEqual(after.limits, before.limits); assert.equal(after.authority?.hash, before.authority?.hash);
    assert.equal(f.store.db.prepare("SELECT state FROM coding_agent_executions WHERE job_id=?").get(job)?.state, "returned");
    await assert.rejects(reconcileRejectedCodexResult(f.config, f.store, f.session, job, AbortSignal.timeout(5000)), AppError);
  } finally { f.close(); }
});

test("crash recovery keeps a dispatched coding execution uncertain and rejects the queued worker before another model or container", async () => {
  const f = await missionAuthorityFixture(false, true);
  try {
    const authority = f.proposed.authority; assert.ok(authority);
    const queued = await decideMissionAuthority(f.config, f.store, f.session, f.proposed.id, f.proposed.revision, authority.id, authority.hash, "approve");
    assert.ok(queued.repair);
    f.store.db.prepare("INSERT INTO coding_agent_executions VALUES(?,?,'dispatched',?)").run(queued.repair.id, f.session.actorId,
      JSON.stringify({ state: "dispatched", parentRunId: queued.id, tokens: null, code: null }));
    f.store.recoverInterrupted();
    assert.equal(f.store.db.prepare("SELECT state FROM coding_agent_executions WHERE job_id=?").get(queued.repair.id)?.state, "uncertain");
    await assert.rejects(new CodeRepairAdapter(f.config, f.store).run(f.session.actorId, queued.repair.id, AbortSignal.timeout(5000)),
      (error: unknown) => error instanceof AppError && error.code === "CODING_EXECUTION_UNCERTAIN");
    assert.equal(f.repo.get(f.session.actorId, queued.id)?.repair?.state, "queued");
    assert.equal(f.counts().patches, 0); assert.equal(f.counts().sends, 0);
  } finally { f.close(); }
});

test("a received Codex usage receipt survives a crash before parent persistence without duplicate settlement or renewed authority", async () => {
  const f = await missionAuthorityFixture(false, true);
  try {
    const run = f.repo.get(f.session.actorId, f.proposed.id); assert.ok(run?.repair);
    run.state = "interrupted"; run.usage.observedTokens = 100; run.usage.unknownModelCalls = 1; f.repo.save(f.session.actorId, run);
    f.store.db.prepare("INSERT INTO coding_agent_executions VALUES(?,?,'returned',?)").run(run.repair.id, f.session.actorId,
      JSON.stringify({ parentRunId: run.id, code: null, completedAt: Date.now(), tokens: 120, tokenAccountingVersion: 1, probeAccountingVersion: 1,
        budgetTokensBefore: 100, budgetTokensAfter: 220 }));
    settleLegacyCodexTokens(f.store, f.session, run.repair.id); settleLegacyCodexTokens(f.store, f.session, run.repair.id);
    const after = f.repo.get(f.session.actorId, run.id); assert.ok(after);
    assert.equal(after.usage.observedTokens, 220); assert.equal(after.usage.unknownModelCalls, 0); assert.equal(after.state, "interrupted");
    assert.deepEqual(after.limits, run.limits); assert.equal(after.authority?.hash, run.authority?.hash); assert.equal(after.repair?.state, "proposed");
    assert.equal(f.counts().patches, 0); assert.equal(f.counts().sends, 0);
  } finally { f.close(); }
});
