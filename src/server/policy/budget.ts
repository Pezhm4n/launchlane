import { ensure } from "../errors.ts";

export class RunBudget {
  readonly deadline: number;
  readonly maxModelCalls: number;
  readonly maxToolCalls: number;
  modelCalls = 0;
  toolCalls = 0;
  observedTokens: number | null = null;

  constructor(
    limits: { runTimeoutMs: number; maxModelCalls: number; maxToolCalls: number },
    now = Date.now(),
  ) {
    this.deadline = now + limits.runTimeoutMs;
    this.maxModelCalls = limits.maxModelCalls;
    this.maxToolCalls = limits.maxToolCalls;
  }

  take(kind: "model" | "tool", signal: AbortSignal): void {
    ensure(!signal.aborted, "CANCELLED", "عملیات لغو شد.", 409);
    ensure(
      Date.now() < this.deadline,
      "BUDGET_EXHAUSTED",
      "مهلت اجرا تمام شد؛ نتیجه کامل نشده است.",
      409,
    );
    ensure(
      kind === "model" ? this.modelCalls < this.maxModelCalls : this.toolCalls < this.maxToolCalls,
      "BUDGET_EXHAUSTED",
      "سقف فراخوانی اجرا تمام شد؛ نتیجه کامل نشده است.",
      409,
    );
    if (kind === "model") this.modelCalls++;
    else this.toolCalls++;
  }

  signal(parent: AbortSignal): AbortSignal {
    return AbortSignal.any([parent, AbortSignal.timeout(Math.max(1, this.deadline - Date.now()))]);
  }
}
