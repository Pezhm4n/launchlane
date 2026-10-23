"use client";
import { useEffect, useRef, useState } from "react";
import type { AgentEvent, AgentView } from "../contracts/agent.ts";
import { WorkspaceGlyph } from "./WorkspaceGlyph.tsx";
import styles from "./AgentSteps.module.css";

export function publicationSteps(events: readonly AgentEvent[], active: boolean) {
  const results = new Map(events.filter(event => event.kind === "tool" && event.callId).map(event => [event.callId, event]));
  const starts = new Set(events.filter(event => event.kind === "activity" && event.callId).map(event => event.callId));
  return events.filter(event => event.kind !== "user" && event.kind !== "assistant" && !(event.kind === "tool" && starts.has(event.callId))).map(event => {
    const result = event.callId ? results.get(event.callId) : undefined;
    return { key: event.sequence, message: event.message, failure: result?.failure ?? event.failure, status: event.kind === "error" ? "failed" : result?.outcome ?? event.outcome ??
      (event.callId && event.kind === "activity" && !result && active ? "pending" : "recorded") };
  });
}
export function publicationStepSummary(steps: ReturnType<typeof publicationSteps>) {
  return {
    succeeded: steps.filter(step => step.status === "succeeded").length,
    failed: steps.filter(step => step.status === "failed").length,
    pending: steps.findLast(step => step.status === "pending")?.message ?? null,
  };
}
export function AgentSteps({ run, active }: { run: AgentView; active: boolean }) {
  const steps = publicationSteps(run.events, active), summary = publicationStepSummary(steps),
    failureKeys = steps.filter(step => step.status === "failed").map(step => step.key).join(","),
    seen = useRef({ runId: run.id, failures: new Set(failureKeys.split(",").filter(Boolean)) }),
    [open, setOpen] = useState(summary.failed > 0);
  useEffect(() => {
    const failures = failureKeys.split(",").filter(Boolean);
    if (seen.current.runId !== run.id) {
      seen.current = { runId: run.id, failures: new Set(failures) };
      setOpen(failures.length > 0);
      return;
    }
    // Replaying the same failed receipt must preserve the person's closed view.
    const fresh = failures.some(key => !seen.current.failures.has(key));
    for (const key of failures) seen.current.failures.add(key);
    if (fresh) setOpen(true);
  }, [run.id, failureKeys]);
  return <details className={styles.steps} open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className={styles.summary}>
      <span className={styles.heading}>مراحل بررسی</span>
      <span className={styles.state} aria-live="polite">{summary.pending ?? (summary.failed ? "مرحله‌های ناموفق را بررسی کنید" : summary.succeeded ? "نتیجهٔ بررسی‌ها ثبت شد" : "جزئیات اجرا را ببینید")}</span>
      <span className={styles.counts}>
        {summary.succeeded ? <span data-status="succeeded"><WorkspaceGlyph name="check" />{new Intl.NumberFormat("fa-IR").format(summary.succeeded)} انجام شد</span> : null}
        {summary.failed ? <span data-status="failed"><WorkspaceGlyph name="close" />{new Intl.NumberFormat("fa-IR").format(summary.failed)} ناموفق</span> : null}
      </span>
    </summary>
    <ol className={styles.list}>
    {steps.map(step => <li key={step.key} data-status={step.status}>
      <span className={styles.icon}><WorkspaceGlyph name={step.status === "succeeded" ? "check" : step.status === "failed" ? "close" : step.status === "pending" ? "loader" : "down"} /></span>
      <div>{step.message}<span className="sr-only"> — {step.status === "succeeded" ? "انجام شد" : step.status === "failed" ? "ناموفق" : step.status === "pending" ? "در حال اجرا" : "ثبت شد"}</span>
        {step.failure ? <div className={styles.failure}><p>{step.failure.message}</p><p>{step.failure.nextStep}</p><details><summary>جزئیات فنی</summary><code>{step.failure.code}</code></details></div> : null}</div>
    </li>)}
    </ol>
  </details>;
}
