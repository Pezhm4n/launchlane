import type { Session } from "../../contracts/domain.ts";
import { object, string } from "../../contracts/validation.ts";
import type { Config } from "../config.ts";
import type { Store } from "../persistence/store.ts";
import { AppError, ensure } from "../errors.ts";
import { assertMissionAuthority, missionAuthority } from "../policy/mission-authority.ts";
import type { ModelPort } from "./model.ts";
import { CodexPatchModel } from "./codex-patch.ts";

export function missionRepairProvider(config: Config, store: Store, session: Session, runId: string, internal: ModelPort,
  onFallback: (code: string) => void, external: ModelPort = new CodexPatchModel(config, store, session.actorId)): ModelPort {
  return { complete: async (messages, tools, budget, signal) => {
    const authority = missionAuthority(store, session.actorId, runId);
    ensure(authority, "PLAN_STEP_REQUIRED", "انتخاب عامل به برنامه مصوب متصل نیست.", 409);
    const plan = assertMissionAuthority(store, session.actorId, session.id, authority);
    ensure(plan.version === 2 && plan.codingAgent.kind === "codex", "PLAN_AGENT_CHANGED", "عامل این اجرا با برنامه مصوب برابر نیست.", 409);
    const message = messages[1];
    ensure(message?.role === "user", "CODEX_SCOPE_DENIED", "بسته اصلاح معتبر نیست.", 403);
    const packet = object(JSON.parse(message.content)), jobId = string(packet.jobId, 36);
    ensure(packet.parentRunId === runId, "CODEX_SCOPE_DENIED", "بسته به این مأموریت تعلق ندارد.", 403);
    try { return await external.complete(messages, tools, budget, signal); }
    catch (error) {
      const allowed = error instanceof AppError && ["CODEX_UNAVAILABLE", "CODEX_VERSION_UNCONFIRMED", "CODEX_AUTH_REQUIRED"].includes(error.code);
      const dispatched = store.db.prepare("SELECT job_id FROM coding_agent_executions WHERE job_id=? AND actor_id=?").get(jobId, session.actorId);
      if (!allowed || !plan.codingAgent.fallbackBeforeDispatch || dispatched || signal.aborted) throw error;
      // Recheck consent after the probe; a rejected/revoked plan cannot be bypassed by fallback.
      assertMissionAuthority(store, session.actorId, session.id, authority);
      onFallback(error.code);
      return internal.complete(messages, tools, budget, signal);
    }
  } };
}
