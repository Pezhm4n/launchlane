import type { Session } from "../../contracts/domain.ts";
import { object, string, integer, hash } from "../../contracts/validation.ts";
import type { Config } from "../config.ts";
import type { Store } from "../persistence/store.ts";
import { ensure } from "../errors.ts";
import { AgentRepository, addEvent } from "../agent/store.ts";
import { fingerprint } from "../policy/action.ts";
import { captureProject } from "../workspace/inspect.ts";
import { privateValues, assertAgentContext } from "../agent/tools.ts";
import { join } from "node:path";

function transaction<T>(store: Store, work: () => T): T {
  store.db.exec("BEGIN IMMEDIATE");
  try { const result = work(); store.db.exec("COMMIT"); return result; }
  catch (error) { store.db.exec("ROLLBACK"); throw error; }
}

// This only settles a received-but-rejected result; it cannot produce a patch, authority or successful job.
export async function reconcileRejectedCodexResult(config: Config, store: Store, session: Session, jobId: string, signal: AbortSignal): Promise<void> {
  const row = store.db.prepare("SELECT data_json FROM coding_agent_executions WHERE job_id=? AND actor_id=? AND state='uncertain'").get(jobId, session.actorId);
  ensure(row && store.sessionExists(session.id, session.actorId, Date.now()), "CODING_RECONCILIATION_REQUIRED", "رسید قطعی یا نشست معتبر در دسترس نیست.", 409);
  const execution = object(JSON.parse(string(row.data_json, 16384))), parentId = string(execution.parentRunId, 36),
    repo = new AgentRepository(store), run = repo.get(session.actorId, parentId);
  ensure(execution.code === "CODEX_TOOL_DENIED" && execution.completedAt !== null && execution.mode === "packet_only" &&
    execution.jobId === jobId && Array.isArray(execution.eventKinds) && execution.eventKinds.includes("turn.completed") &&
    execution.eventKinds.includes("item:agent_message") && execution.eventKinds.every(kind =>
      ["thread.started", "turn.started", "turn.completed", "item.completed", "item.started", "item:error", "item:reasoning", "item:agent_message"].includes(string(kind, 100))),
    "CODING_RECONCILIATION_REQUIRED", "خروج کامل بدون ابزار اجرایی از رسید موجود اثبات نمی‌شود؛ اجرای تازه مجاز نشد.", 409);
  const tokens = integer(execution.tokens, 0, Number.MAX_SAFE_INTEGER), completedAt = integer(execution.completedAt, 0, Date.now());
  ensure(completedAt >= integer(execution.startedAt, 0, Number.MAX_SAFE_INTEGER), "CODING_RECONCILIATION_REQUIRED", "زمان receipt معتبر نیست.", 409);
  ensure(run?.state === "partially_completed" && run.repair?.id === jobId && run.repair.state === "failed" && !run.repair.artifact &&
    run.context.sourceHash === hash(execution.baseRevision) && run.usage.toolCalls < run.limits.maxToolCalls && run.usage.elapsedMs < run.limits.runTimeoutMs,
    "CODING_RECONCILIATION_REQUIRED", "مأموریت یا job تغییر کرده است؛ نتیجه قدیمی منتقل نمی‌شود.", 409);
  assertAgentContext(config, store, session.actorId, run.context);
  const started = Date.now(), before = fingerprint(execution);
  run.usage.toolCalls++; repo.save(session.actorId, run);
  const snapshot = await captureProject(join(config.stateDir, "repair-workspaces", jobId), ".", { signal, secrets: privateValues(config) });
  ensure(snapshot.profile.sourceHash === execution.baseRevision && !signal.aborted, "CODING_RECONCILIATION_REQUIRED", "workspace تغییر کرده یا بررسی قطع شده است؛ مجوز تازه صادر نشد.", 409);
  transaction(store, () => {
    const current = store.db.prepare("SELECT data_json FROM coding_agent_executions WHERE job_id=? AND actor_id=? AND state='uncertain'").get(jobId, session.actorId);
    ensure(current && fingerprint(JSON.parse(string(current.data_json, 16384))) === before, "CODING_RECONCILIATION_REQUIRED", "رسید هم‌زمان تغییر کرده است.", 409);
    store.db.prepare("UPDATE coding_agent_executions SET state='returned',data_json=? WHERE job_id=? AND actor_id=? AND state='uncertain'")
      .run(JSON.stringify({ ...execution, state: "returned", code: "CODEX_RESULT_NOT_RETAINED", reconciledAt: Date.now(), acceptedPatch: false, workspaceUnchanged: true }), jobId, session.actorId);
    if (execution.tokenAccountingVersion === undefined) run.usage.observedTokens += tokens;
    run.usage.unknownModelCalls = Math.max(0, run.usage.unknownModelCalls - 1);
    run.usage.elapsedMs += Date.now() - started;
    run.errorCode = "CODEX_RESULT_NOT_RETAINED";
    addEvent(run, "state", "اجرای بیرونی پایان یافته و workspace تغییر نکرده است. وصله‌ای پذیرفته نشد؛ مصرف گزارش‌شده ثبت شد. رسید قبلی اختیار جدید صادر نمی‌کند.");
    repo.save(session.actorId, run);
  });
}

export function settleLegacyCodexTokens(store: Store, session: Session, jobId: string): void {
  ensure(store.sessionExists(session.id, session.actorId, Date.now()), "AUTH_REQUIRED", "برای تطبیق رسید وارد شوید.", 401);
  transaction(store, () => {
    const row = store.db.prepare("SELECT data_json FROM coding_agent_executions WHERE job_id=? AND actor_id=? AND state='returned'").get(jobId, session.actorId);
    ensure(row, "CODING_RECONCILIATION_REQUIRED", "رسید پایان‌یافته موجود نیست.", 409);
    const execution = object(JSON.parse(string(row.data_json, 16384)));
    const repo = new AgentRepository(store), run = repo.get(session.actorId, string(execution.parentRunId, 36)), tokens = integer(execution.tokens, 0, Number.MAX_SAFE_INTEGER);
    ensure(run && run.state !== "working" && run.state !== "queued", "CODING_RECONCILIATION_REQUIRED", "مالک فعال یا مأموریت نامشخص اجازه تطبیق هم‌زمان نمی‌دهد.", 409);
    let tokensRecorded = execution.budgetReconciledAt !== undefined || execution.code === "CODEX_RESULT_NOT_RETAINED" && execution.reconciledAt !== undefined;
    const
      probesRecorded = execution.probeAccountingVersion === 1 || execution.probeBudgetReconciledAt !== undefined;
    if (execution.tokenAccountingVersion === 1 && !tokensRecorded) {
      const before = integer(execution.budgetTokensBefore, 0, Number.MAX_SAFE_INTEGER), after = integer(execution.budgetTokensAfter, before, Number.MAX_SAFE_INTEGER);
      ensure(after === before + tokens, "CODING_RECONCILIATION_REQUIRED", "زنجیره مصرف receipt معتبر نیست.", 409);
      tokensRecorded = run.usage.observedTokens >= after;
      ensure(tokensRecorded || run.state === "interrupted" && run.usage.observedTokens === before && run.usage.unknownModelCalls > 0,
        "CODING_RECONCILIATION_REQUIRED", "مصرف والد با receipt تطبیق خودکار ندارد؛ سقف یا مصرف بازنشانی نمی‌شود.", 409);
    }
    if (tokensRecorded && probesRecorded) return;
    ensure((execution.code === null || tokensRecorded) && execution.completedAt !== null, "CODING_RECONCILIATION_REQUIRED", "این نتیجه به تطبیق مصرف نسخه قدیمی تعلق ندارد.", 409);
    if (!tokensRecorded) { run.usage.observedTokens += tokens; if (execution.tokenAccountingVersion === 1) run.usage.unknownModelCalls--; }
    if (!probesRecorded) run.usage.toolCalls += 2;
    store.db.prepare("UPDATE coding_agent_executions SET data_json=? WHERE job_id=? AND actor_id=? AND state='returned'")
      .run(JSON.stringify({ ...execution, budgetReconciledAt: Date.now(), probeBudgetReconciledAt: Date.now(), settledParentTokens: run.usage.observedTokens }), jobId, session.actorId);
    repo.save(session.actorId, run);
  });
}
