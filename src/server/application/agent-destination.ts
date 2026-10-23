import type { Session } from "../../contracts/domain.ts";
import type { DestinationRecommendation } from "../../contracts/destination-recommendation.ts";
import type { Config } from "../config.ts";
import type { Store } from "../persistence/store.ts";
import type { LiaraAccountClient } from "../liara/catalog.ts";
import { AgentRepository, addEvent } from "../agent/store.ts";
import { assertAgentContext } from "../agent/tools.ts";
import { ensure } from "../errors.ts";
import { RunBudget } from "../policy/budget.ts";
import { proposeDestination } from "./provision.ts";

export async function reviseAgentDestination(config: Config, store: Store, session: Session, id: string, revision: number,
  planId: string, bundleId: string, signal: AbortSignal, read?: LiaraAccountClient) {
  const repo = new AgentRepository(store), run = repo.get(session.actorId, id), previous = run?.destination;
  ensure(run?.mission && run.revision === revision && run.state === "needs_approval" && previous &&
    (previous.spec.version === 8 || previous.spec.version === 12 || previous.spec.version === 16) && previous.state === "awaiting_approval" && !previous.attemptId,
    "DESTINATION_CONFLICT", "فقط پیشنهاد اجرا‌نشده را می‌توان تغییر داد؛ وضعیت تازه را ببینید.", 409);
  ensure(store.sessionExists(session.id, session.actorId, Date.now()), "AUTH_REQUIRED", "دوباره وارد شوید.", 401);
  assertAgentContext(config, store, session.actorId, run.context);
  if (previous.spec.args.planId === planId && previous.spec.bundleId === bundleId) return run;
  const started = Date.now(), budget = new RunBudget({ ...run.limits, runTimeoutMs: Math.max(1, run.limits.runTimeoutMs - run.usage.elapsedMs) });
  budget.modelCalls = run.usage.modelCalls; budget.toolCalls = run.usage.toolCalls;
  const take = budget.take.bind(budget);
  budget.take = (kind, parent) => {
    ensure(kind === "tool" && store.sessionExists(session.id, session.actorId, Date.now()), "AUTH_REQUIRED", "دوباره وارد شوید.", 401);
    take(kind, parent); run.usage.toolCalls = budget.toolCalls; repo.save(session.actorId, run);
  };
  let recommendation: DestinationRecommendation | null = null;
  try {
    await proposeDestination(config, store, session.actorId, { flowId: previous.spec.projectFlowId, app: previous.spec.scope.app,
      networkId: previous.spec.networkId, planId, bundleId }, signal, { budget, ...(read ? { read } : {}),
      onRecommendation: value => { recommendation = value; },
      onProposed: action => {
        ensure(store.sessionExists(session.id, session.actorId, Date.now()) && !signal.aborted, "AUTH_REQUIRED", "نشست یا درخواست پایان یافت.", 401);
        assertAgentContext(config, store, session.actorId, run.context);
        ensure(store.getAction(previous.id, session.actorId).state === "cancelled", "DESTINATION_CONFLICT", "پیشنهاد قبلی نامعتبر نشده است.", 409);
        run.destination = action; run.destinationRecommendation = recommendation;
        addEvent(run, "state", "انتخاب پلن ثبت شد؛ پیشنهاد قبلی لغو و قیمت تازه برای تصمیم شما آماده شد. هنوز برنامه‌ای ساخته نشده است.");
        // Runs inside createAction's transaction: stale revision rolls back both actions and the new selection.
        repo.save(session.actorId, run);
      } });
    return run;
  } finally {
    const current = repo.get(session.actorId, id);
    if (current?.revision === run.revision) { current.usage.elapsedMs += Date.now() - started; repo.save(session.actorId, current); run.revision = current.revision; run.updatedAt = current.updatedAt; run.usage = current.usage; }
  }
}
