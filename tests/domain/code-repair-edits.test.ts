import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { applyTextEdits, CodeRepairAdapter } from "../../src/server/agent/code-repair.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import type { ModelPort } from "../../src/server/agent/model.ts";
import { agentFixture, repairBrokenSource } from "../helpers/agent-fixture.ts";

test("exact edits preserve unrelated bytes and uniform line endings", () => {
  assert.equal(applyTextEdits("prefix\nalpha\nbeta\nsuffix\n", [{ before: "alpha\nbeta", after: "alpha\ncorrect" }]), "prefix\nalpha\ncorrect\nsuffix\n");
  assert.equal(applyTextEdits("prefix\r\nalpha\r\nbeta\r\nsuffix\r\n", [{ before: "alpha\nbeta", after: "alpha\ncorrect" }]), "prefix\r\nalpha\r\ncorrect\r\nsuffix\r\n");
  assert.equal(applyTextEdits("prefix suffix", [{ before: "prefix ", after: "" }]), "suffix");
});

test("missing, repeated, overlapping and malformed matches cannot become a best-effort patch", () => {
  for (const [base, before] of [["alpha", "missing"], ["alpha alpha", "alpha"], ["aaaa", "aaa"]])
    assert.throws(() => applyTextEdits(base ?? "", [{ before, after: "changed" }]), { code: "REPAIR_MATCH_REQUIRED" });
  assert.throws(() => applyTextEdits("alpha", [{ before: "", after: "changed" }]));
  assert.throws(() => applyTextEdits("alpha", [{ before: "alpha", after: "changed", approved: true }]));
  assert.throws(() => applyTextEdits("alpha", []));
});

test("a larger real source file can be repaired with a small hash-bound model edit and unchanged tests", async () => {
  const f = await agentFixture();
  try {
    const original = "// preserved context\n".repeat(700) + repairBrokenSource;
    writeFileSync(join(f.project, "invoice.mjs"), original);
    const flow = await prepareProjectFlow(f.config, f.store, f.session.actorId, { kind: "local", directory: "service" }, AbortSignal.timeout(5000));
    let requests = 0;
    const model: ModelPort = { async complete(_messages, _tools, budget, signal) {
      requests++; budget.take("model", signal);
      return { content: null, usage: 25, calls: [{ id: "exact-edit", type: "function", function: { name: "submit_patch", arguments: JSON.stringify({
        baseRevision: flow.profile.sourceHash, files: [{ path: "invoice.mjs", beforeHash: createHash("sha256").update(original).digest("hex"), replacements: [{ before: "sum + line.price", after: "sum + line.price * line.quantity" }] }],
      }) } }] };
    } };
    const adapter = new CodeRepairAdapter(f.config, f.store, model), proposal = await adapter.propose(f.session.actorId, {
      projectId: flow.id, goal: "Use each quantity and preserve unrelated context", allowedPaths: ["invoice.mjs"], testFiles: ["invoice.test.mjs"], expectedSourceHash: flow.profile.sourceHash,
    }, AbortSignal.timeout(5000));
    adapter.approve(f.session.actorId, proposal.id);
    const result = await adapter.run(f.session.actorId, proposal.id, AbortSignal.timeout(15000));
    assert.equal(result.state, "succeeded", result.errorCode ?? ""); assert.equal(requests, 1);
    assert.equal(result.beforeTest?.passed, false); assert.equal(result.afterTest?.passed, true); assert.ok(result.artifact);
    assert.equal(readFileSync(join(f.project, "invoice.mjs"), "utf8"), original);
    assert.equal(readFileSync(join(f.config.stateDir, "repair-workspaces", result.id, "invoice.mjs"), "utf8"), original.replace("sum + line.price", "sum + line.price * line.quantity"));
  } finally { f.close(); }
});

test("an unworkable source scope is rejected before asking for local-work approval", async () => {
  const f = await agentFixture();
  try {
    writeFileSync(join(f.project, "invoice.mjs"), "// context\n".repeat(2500) + repairBrokenSource);
    const flow = await prepareProjectFlow(f.config, f.store, f.session.actorId, { kind: "local", directory: "service" }, AbortSignal.timeout(5000));
    await assert.rejects(new CodeRepairAdapter(f.config, f.store).propose(f.session.actorId, {
      projectId: flow.id, goal: "Fix quantity", allowedPaths: ["invoice.mjs"], testFiles: ["invoice.test.mjs"], expectedSourceHash: flow.profile.sourceHash,
    }, AbortSignal.timeout(5000)), { code: "REPAIR_SOURCE_LIMIT" });
    assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM code_repair_jobs").get()?.n, 0);
  } finally { f.close(); }
});
