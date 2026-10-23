import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { openModelBudget } from "../../scripts/model-budget.mjs";
const endpoint = "https://ai.boxapi.ir/ai/v1/chat/completions";
const request = { method: "POST", body: JSON.stringify({ model: "gpt-6-luna", max_completion_tokens: 1024 }) };
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "launchlane-host-budget-")), path = join(directory, "ledger.sqlite"), db = new DatabaseSync(path);
  db.exec(`CREATE TABLE phase_allowances(id TEXT PRIMARY KEY,authorized_usd REAL,started_at INTEGER,baseline_calls INTEGER) STRICT;
    CREATE TABLE phase_reserves(id TEXT PRIMARY KEY,phase TEXT,ceiling_usd REAL,at INTEGER,reason TEXT) STRICT;
    CREATE TABLE calls(id TEXT PRIMARY KEY,at INTEGER,kind TEXT,status TEXT,reserved_usd REAL,reported_tokens INTEGER,prompt_tokens INTEGER,completion_tokens INTEGER,provider_cost TEXT,error TEXT,settled_ceiling_usd REAL) STRICT;
    INSERT INTO phase_allowances VALUES ('existing-phase',0.2,1,0);
    INSERT INTO phase_reserves VALUES ('previous','existing-phase',0.1,1,'retained unknown usage');`);
  return { path, db, close() { db.close(); rmSync(directory, { recursive: true }); } };
}
test("hosted guard preserves allowance/reserves, settles a real-shaped receipt and never changes the response", async () => {
  const f = fixture(); let sends = 0;
  const guard = openModelBudget(f.path, "existing-phase", async () => { sends++; return Response.json({ usage: { total_tokens: 1000, prompt_tokens: 900, completion_tokens: 100 } }); });
  try {
    assert.equal((await guard.fetch(endpoint, request)).status, 200);
    assert.equal(sends, 1); assert.equal(guard.snapshot().callsCeilingUsd, 0.0011);
    assert.equal(guard.snapshot().previousReservesUsd, 0.1); assert.equal(guard.snapshot().authorizedUsd, 0.2);
    assert.equal(f.db.prepare("SELECT count(*) n FROM phase_allowances").get().n, 1);
    assert.equal(f.db.prepare("SELECT reason FROM phase_reserves").get().reason, "retained unknown usage");
  } finally { guard.close(); f.close(); }
});
test("unknown outcomes retain full reserves across reopening and exhaust the same allowance", async () => {
  const f = fixture(); let sends = 0;
  let guard = openModelBudget(f.path, "existing-phase", async () => { sends++; throw Error("private transport detail"); });
  try {
    await assert.rejects(guard.fetch(endpoint, request)); guard.close();
    guard = openModelBudget(f.path, "existing-phase", async () => { sends++; return Response.json({ choices: [] }); });
    await guard.fetch(endpoint, request);
    await assert.rejects(guard.fetch(endpoint, request), { code: "MODEL_BUDGET_EXHAUSTED" });
    assert.equal(sends, 2); assert.equal(guard.snapshot().callsCeilingUsd, 0.1);
    assert.equal(f.db.prepare("SELECT error FROM calls WHERE status='unknown'").get().error, "transport_or_cancel");
  } finally { guard.close(); f.close(); }
});
test("two independent connections reserve before sending and cannot concurrently overdraw", async () => {
  const f = fixture(); f.db.prepare("UPDATE phase_allowances SET authorized_usd=0.15").run(); let release, sends = 0;
  const send = async () => { sends++; return new Promise(resolve => { release = () => resolve(Response.json({})); }); };
  const first = openModelBudget(f.path, "existing-phase", send), second = openModelBudget(f.path, "existing-phase", send);
  try {
    const pending = first.fetch(endpoint, request);
    await assert.rejects(second.fetch(endpoint, request), { code: "MODEL_BUDGET_EXHAUSTED" });
    assert.equal(sends, 1); release(); await pending;
  } finally { first.close(); second.close(); f.close(); }
});
test("missing allowance/ledger fails closed without creating credit or a new file", () => {
  const f = fixture(); try {
    assert.throws(() => openModelBudget(f.path, "new-phase"), { code: "MODEL_BUDGET_UNAVAILABLE" });
    assert.throws(() => openModelBudget(join(f.path, "missing"), "existing-phase"));
    assert.equal(f.db.prepare("SELECT count(*) n FROM phase_allowances").get().n, 1);
  } finally { f.close(); }
});
test("only the priced model/envelope is admitted; cloud reads pass through with no model reservation", async () => {
  const f = fixture(); let sends = 0;
  const guard = openModelBudget(f.path, "existing-phase", async () => { sends++; return Response.json({}); });
  try {
    for (const input of [{ ...request, method: "GET" }, { ...request, body: "{" },
      { ...request, body: JSON.stringify({ model: "other", max_completion_tokens: 1024 }) },
      { ...request, body: JSON.stringify({ model: "gpt-6-luna", max_completion_tokens: 8192 }) }])
      await assert.rejects(guard.fetch(endpoint, input), { code: "MODEL_BUDGET_SCOPE" });
    await guard.fetch("https://api.liara.ir/v1/projects", { method: "GET" });
    assert.equal(sends, 1); assert.equal(guard.snapshot().callsCeilingUsd, 0);
  } finally { guard.close(); f.close(); }
});
