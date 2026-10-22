import { ensure } from "../server/errors.ts";
import { integer, object, string, text } from "./validation.ts";
import { parseCodeRepairJob, type CodeRepairJob } from "./code-repair.ts";

export const agentStates = [
  "queued",
  "working",
  "needs_input",
  "needs_approval",
  "partially_completed",
  "failed",
  "cancelled",
  "interrupted",
] as const;
export type AgentState = (typeof agentStates)[number];
export const nextActions = [
  "choose_project",
  "connect_account",
  "select_app",
  "review_project",
  "reply",
] as const;
export type NextAction = (typeof nextActions)[number];
export type AgentEvent = {
  sequence: number;
  kind: "user" | "activity" | "tool" | "assistant" | "error" | "state";
  message: string;
  at: number;
  tool?: string;
  callId?: string;
};
export type AgentView = {
  id: string;
  revision: number;
  projectId: string | null;
  state: AgentState;
  events: AgentEvent[];
  nextAction: NextAction | null;
  question: string | null;
  updatedAt: number;
  // A host-owned statement. Model prose is never an execution receipt.
  effect: "no_remote_changes";
  repair: CodeRepairJob | null;
};
export function parseAgentView(value: unknown): AgentView {
  const row = object(value);
  const state = agentStates.find((state) => state === row.state);
  const nextAction =
    row.nextAction === null ? null : nextActions.find((action) => action === row.nextAction);
  ensure(
    state && nextAction !== undefined && row.effect === "no_remote_changes",
    "INVALID_RESPONSE",
    "وضعیت دستیار معتبر نیست.",
  );
  ensure(
    Array.isArray(row.events) && row.events.length <= 160,
    "INVALID_RESPONSE",
    "رویدادهای دستیار معتبر نیستند.",
  );
  let previous = 0;
  const events = row.events.map((value): AgentEvent => {
    const event = object(value),
      sequence = integer(event.sequence, 1, 10000);
    ensure(sequence > previous, "INVALID_RESPONSE", "ترتیب رویدادها معتبر نیست.");
    previous = sequence;
    const kind = event.kind;
    ensure(
      kind === "user" ||
        kind === "activity" ||
        kind === "tool" ||
        kind === "assistant" ||
        kind === "error" ||
        kind === "state",
      "INVALID_RESPONSE",
      "نوع رویداد معتبر نیست.",
    );
    return {
      sequence,
      kind,
      message: text(event.message, 6000),
      at: integer(event.at, 0, Number.MAX_SAFE_INTEGER),
      ...(event.tool === undefined ? {} : { tool: string(event.tool, 80) }),
      ...(event.callId === undefined ? {} : { callId: string(event.callId, 80) }),
    };
  });
  return {
    id: string(row.id, 36),
    revision: integer(row.revision, 1, 10000),
    projectId: row.projectId === null ? null : string(row.projectId, 36),
    state,
    events,
    nextAction,
    question: row.question === null ? null : text(row.question, 2000),
    updatedAt: integer(row.updatedAt, 0, Number.MAX_SAFE_INTEGER),
    effect: "no_remote_changes",
    repair: row.repair === null || row.repair === undefined ? null : parseCodeRepairJob(row.repair),
  };
}
