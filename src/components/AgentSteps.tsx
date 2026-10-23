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
export function AgentSteps({ run, active }: { run: AgentView; active: boolean }) {
  return <details><summary>مراحل بررسی</summary><ol className={styles.list}>
    {publicationSteps(run.events, active).map(step => <li key={step.key} data-status={step.status}>
      <span className={styles.icon}><WorkspaceGlyph name={step.status === "succeeded" ? "check" : step.status === "failed" ? "close" : step.status === "pending" ? "loader" : "down"} /></span>
      <div>{step.message}<span className="sr-only"> — {step.status === "succeeded" ? "انجام شد" : step.status === "failed" ? "ناموفق" : step.status === "pending" ? "در حال اجرا" : "ثبت شد"}</span>
        {step.failure ? <div className={styles.failure}><p>{step.failure.message}</p><p>{step.failure.nextStep}</p><details><summary>جزئیات فنی</summary><code>{step.failure.code}</code></details></div> : null}</div>
    </li>)}
  </ol></details>;
}
