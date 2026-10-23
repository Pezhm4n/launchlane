import { randomUUID } from "node:crypto";
import { isAbsolute } from "node:path";
import { lstatSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const endpoint = "https://ai.boxapi.ir/ai/v1/chat/completions";
const validCount = value => Number.isSafeInteger(value) && value >= 0;
function failure(code) { return Object.assign(new Error(code), { code }); }
function ceiling(usage, cost) {
  const split = validCount(usage.prompt_tokens) && validCount(usage.completion_tokens) &&
    usage.prompt_tokens + usage.completion_tokens === usage.total_tokens;
  const bounded = split ? usage.prompt_tokens / 1e6 + usage.completion_tokens * 2 / 1e6 : usage.total_tokens * 2 / 1e6;
  return Math.ceil(Math.max(bounded, typeof cost === "number" && Number.isFinite(cost) && cost >= 0 ? cost * 2 : 0) * 1e6) / 1e6;
}
async function receipt(response) {
  const copy = response.clone(), chunks = []; let length = 0;
  try {
    for await (const chunk of copy.body ?? []) {
      length += chunk.length;
      if (length > 128 * 1024) return null;
      chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch { return null; }
}

// This opens an existing allowance. It never creates a ledger, migrates it, or grants credit.
export function openModelBudget(path, phaseId, send = globalThis.fetch) {
  if (!isAbsolute(path) || !lstatSync(path).isFile() || !/^[a-z0-9][a-z0-9-]{0,80}$/.test(phaseId))
    throw failure("MODEL_BUDGET_UNAVAILABLE");
  const db = new DatabaseSync(path, { timeout: 3000, allowExtension: false });
  const kind = `model:${phaseId}`;
  function snapshot() {
    const allowance = db.prepare("SELECT authorized_usd FROM phase_allowances WHERE id=?").get(phaseId)?.authorized_usd;
    const calls = db.prepare("SELECT COALESCE(SUM(COALESCE(settled_ceiling_usd,reserved_usd)),0) spent FROM calls WHERE kind=?").get(kind).spent;
    const reserves = db.prepare("SELECT COALESCE(SUM(ceiling_usd),0) reserved FROM phase_reserves WHERE phase=?").get(phaseId).reserved;
    if (![allowance, calls, reserves].every(value => typeof value === "number" && Number.isFinite(value) && value >= 0) || allowance <= 0)
      throw failure("MODEL_BUDGET_UNAVAILABLE");
    return { authorizedUsd: allowance, callsCeilingUsd: calls, previousReservesUsd: reserves, remainingUsd: allowance - calls - reserves };
  }
  try {
    if (db.prepare("PRAGMA quick_check").get().quick_check !== "ok") throw failure("MODEL_BUDGET_UNAVAILABLE");
    snapshot();
    // Validate the existing write contract before the public server accepts traffic.
    const columns = new Set(db.prepare("PRAGMA table_info(calls)").all().map(column => column.name));
    if (!["id", "at", "kind", "status", "reserved_usd", "reported_tokens", "prompt_tokens", "completion_tokens", "provider_cost", "error", "settled_ceiling_usd"].every(column => columns.has(column)))
      throw failure("MODEL_BUDGET_UNAVAILABLE");
  } catch { db.close(); throw failure("MODEL_BUDGET_UNAVAILABLE"); }
  return {
    snapshot,
    close: () => db.close(),
    fetch: async (input, init = {}) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.origin !== "https://ai.boxapi.ir") return send(input, init);
      if (url.href !== endpoint || init.method !== "POST" || typeof init.body !== "string" || Buffer.byteLength(init.body) > 96 * 1024)
        throw failure("MODEL_BUDGET_SCOPE");
      let body; try { body = JSON.parse(init.body); } catch { throw failure("MODEL_BUDGET_SCOPE"); }
      if (body.model !== "gpt-6-luna" || !Number.isSafeInteger(body.max_completion_tokens) || body.max_completion_tokens < 1 || body.max_completion_tokens > 4096)
        throw failure("MODEL_BUDGET_SCOPE");
      const reservation = Math.max(0.05, (Buffer.byteLength(init.body) + 2048) / 1e6 + body.max_completion_tokens * 2 / 1e6), id = randomUUID();
      db.exec("BEGIN IMMEDIATE");
      try {
        if (snapshot().remainingUsd + 1e-9 < reservation) throw failure("MODEL_BUDGET_EXHAUSTED");
        db.prepare("INSERT INTO calls(id,at,kind,status,reserved_usd,reported_tokens,prompt_tokens,completion_tokens,provider_cost,error) VALUES (?,?,?,?,?,?,?,?,?,?)")
          .run(id, Date.now(), kind, "reserved", reservation, null, null, null, null, null);
        db.exec("COMMIT");
      } catch (error) { db.exec("ROLLBACK"); throw error; }
      try {
        const response = await send(input, init), value = await receipt(response), usage = value?.usage;
        const tokens = validCount(usage?.total_tokens) ? usage.total_tokens : null;
        const cost = value?.cost ?? usage?.cost ?? null;
        db.prepare("UPDATE calls SET status=?,reported_tokens=?,prompt_tokens=?,completion_tokens=?,provider_cost=?,settled_ceiling_usd=? WHERE id=?")
          .run(String(response.status), tokens, validCount(usage?.prompt_tokens) ? usage.prompt_tokens : null,
            validCount(usage?.completion_tokens) ? usage.completion_tokens : null,
            typeof cost === "number" && Number.isFinite(cost) && cost >= 0 ? JSON.stringify(cost) : "null",
            response.status === 200 && tokens !== null ? ceiling(usage, cost) : null, id);
        return response;
      } catch (error) {
        db.prepare("UPDATE calls SET status='unknown',error='transport_or_cancel' WHERE id=?").run(id);
        throw error;
      }
    },
  };
}

if (process.env.LAUNCHLANE_MODEL_BUDGET_GUARD === "true") {
  const guard = openModelBudget(process.env.LAUNCHLANE_MODEL_LEDGER_PATH ?? "", process.env.LAUNCHLANE_MODEL_LEDGER_PHASE ?? "");
  globalThis.fetch = guard.fetch;
  process.once("exit", () => guard.close());
}
