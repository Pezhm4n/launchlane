import type { Session } from "../../contracts/domain.ts";
import { parsePublicationInput } from "../../contracts/publication-mission.ts";
import type { Config } from "../config.ts";
import type { Store } from "../persistence/store.ts";
import { ensure } from "../errors.ts";
import { fingerprint } from "../policy/action.ts";
import { containsCredential } from "../policy/redaction.ts";
import { currentAgentContext, privateValues } from "../agent/tools.ts";
import { AgentRepository } from "../agent/store.ts";
import { restoreProjectFlow } from "./project-flows.ts";

// The button owns a typed intent and immutable source; prose is only model context.
export async function createPublicationMission(config: Config, store: Store, session: Session,
  requestKey: string, value: unknown, signal: AbortSignal) {
  const input = parsePublicationInput(value);
  ensure(config.enableLiveModel && config.modelKey, "LIVE_MODEL_DISABLED", "آماده‌سازی هوشمند در این نصب فعال نیست؛ از مسئول نصب پیگیری کنید.", 403);
  ensure(!containsCredential(input.expectedText ?? "", privateValues(config)), "SENSITIVE_INPUT", "نشانه صفحه نباید مقدار محرمانه باشد.");
  const flow = await restoreProjectFlow(config, store, session.actorId, signal, input.projectId);
  ensure(flow && flow.status !== "stale" && flow.status !== "unavailable" && flow.profile.sourceHash === input.sourceHash,
    "PROJECT_CHANGED", flow?.message || "نسخه پروژه تغییر کرده است؛ آن را دوباره بررسی کنید.", 409);
  const context = currentAgentContext(config, store, session.actorId);
  ensure(context.projectId === input.projectId && context.sourceHash === input.sourceHash,
    "AGENT_CONTEXT_CHANGED", "انتخاب پروژه تغییر کرده است.", 409);
  const repo = new AgentRepository(store),
    identity = fingerprint({ input, context }), previous = repo.publication(session.actorId, identity);
  // Two tabs and a lost registration response join the same durable run, even with different client keys.
  if (previous) return { run: previous, created: false };
  const goal = `این پروژه انتخاب‌شده را برای انتشار آماده کن و با تصمیم‌های لازم واقعاً منتشر کن. مسیر بررسی ${input.path} و پاسخ مورد انتظار 200 است. ${input.expectedText ? `نشانه الزامی صفحه: ${JSON.stringify(input.expectedText)}.` : "نشانه معنادار پاسخ را از source همان صفحه استخراج کن؛ اگر قابل استخراج نیست فقط همان اطلاعات ضروری را بخواه."} در شکست قابل اصلاح، از شواهد واقعی و worker مجاز استفاده کن و همان معیار را حفظ کن. ساخت مقصد و انتشار فقط پس از تصمیم معتبر انجام شوند.`;
  return repo.create(session.actorId, requestKey, context, goal, {
    maxModelCalls: config.agentMaxModelCalls, maxToolCalls: config.agentMaxToolCalls,
    runTimeoutMs: config.agentTimeoutMs,
  }, { ...input, kind: "publication", identity });
}
