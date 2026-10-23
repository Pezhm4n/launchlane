import type { Session } from "../../contracts/domain.ts";
import { parsePublicationInput } from "../../contracts/publication-mission.ts";
import type { Config } from "../config.ts";
import type { Store } from "../persistence/store.ts";
import { ensure } from "../errors.ts";
import { fingerprint } from "../policy/action.ts";
import { text } from "../../contracts/validation.ts";
import { containsCredential } from "../policy/redaction.ts";
import { currentAgentContext, privateValues } from "../agent/tools.ts";
import { AgentRepository, addEvent } from "../agent/store.ts";
import { restoreProjectFlow } from "./project-flows.ts";
import { continueAgentRun } from "../agent/runs.ts";
import { CodeRepairAdapter } from "../agent/code-repair.ts";
import { projectSecretValues } from "../environment/secrets.ts";

// The button owns a typed intent and immutable source; prose is only model context.
export async function createPublicationMission(config: Config, store: Store, session: Session,
  requestKey: string, value: unknown, signal: AbortSignal) {
  config = { ...config, projectSecretValues: projectSecretValues(store, config.sessionSecret, session.actorId) };
  const input = parsePublicationInput(value);
  const repo = new AgentRepository(store), joined = repo.forProject(session.actorId, input.projectId, "publication");
  if (joined?.mission) {
    const { kind: _kind, identity: _identity, ...original } = joined.mission;
    if (fingerprint(original) === fingerprint(input) && fingerprint(currentAgentContext(config, store, session.actorId)) === fingerprint(joined.context)) return { run: joined, created: false };
  }
  ensure(config.enableLiveModel && config.modelKey, "LIVE_MODEL_DISABLED", "آماده‌سازی هوشمند در این نصب فعال نیست؛ از مسئول نصب پیگیری کنید.", 403);
  ensure(!containsCredential(input.expectedText ?? "", privateValues(config)), "SENSITIVE_INPUT", "نشانه صفحه نباید مقدار محرمانه باشد.");
  const flow = await restoreProjectFlow(config, store, session.actorId, signal, input.projectId);
  ensure(flow && flow.status !== "stale" && flow.status !== "unavailable" && flow.profile.sourceHash === input.sourceHash,
    "PROJECT_CHANGED", flow?.message || "نسخه پروژه تغییر کرده است؛ آن را دوباره بررسی کنید.", 409);
  const context = currentAgentContext(config, store, session.actorId);
  ensure(context.projectId === input.projectId && context.sourceHash === input.sourceHash,
    "AGENT_CONTEXT_CHANGED", "انتخاب پروژه تغییر کرده است.", 409);
  const identity = fingerprint({ input, context }), previous = repo.publication(session.actorId, identity);
  // Two tabs and a lost registration response join the same durable run, even with different client keys.
  if (previous) return { run: previous, created: false };
  const pending = repo.forProject(session.actorId, input.projectId, "publication");
  if (pending?.mission && pending.state === "needs_input" && pending.effect === "no_remote_changes" && !pending.publication && !pending.destination &&
    (pending.nextAction === "connect_account" || pending.nextAction === "select_app")) {
    const { kind: _kind, identity: _identity, ...intent } = pending.mission;
    if (fingerprint(intent) === fingerprint(input)) return { run: pending, created: false };
  }
  const goal = `این پروژه انتخاب‌شده را برای انتشار آماده کن و با تصمیم‌های لازم واقعاً منتشر کن. مسیر بررسی ${input.path} و پاسخ مورد انتظار 200 است. ${input.expectedText ? `نشانه الزامی صفحه: ${JSON.stringify(input.expectedText)}.` : "نشانه معنادار پاسخ را از source همان صفحه استخراج کن؛ اگر قابل استخراج نیست فقط همان اطلاعات ضروری را بخواه."} در شکست قابل اصلاح، از شواهد واقعی و worker مجاز استفاده کن و همان معیار را حفظ کن. ساخت مقصد و انتشار فقط پس از تصمیم معتبر انجام شوند.`;
  return repo.create(session.actorId, requestKey, context, goal, {
    maxModelCalls: config.agentMaxModelCalls, maxToolCalls: config.agentMaxToolCalls,
    runTimeoutMs: config.agentTimeoutMs,
  }, { ...input, kind: "publication", identity });
}

const continuation = "همان مأموریت انتشار را با source و معیار قبلی ادامه بده. انتخاب‌های تکمیل‌شده حساب را دوباره بررسی کن؛ بودجه و سابقه قبلی حفظ می‌شوند و هیچ مجوز تازه‌ای از این پیام صادر نمی‌شود.";
export async function resumePublicationMission(config: Config, store: Store, session: Session, id: string,
  revision: number, requestKey: string, signal: AbortSignal, feedback: string | null = null) {
  config = { ...config, projectSecretValues: projectSecretValues(store, config.sessionSecret, session.actorId) };
  const observation = feedback === null ? null : text(feedback, 2000).trim();
  ensure(observation === null || observation.length > 0, "INVALID_INPUT", "توضیح ادامه خالی است.");
  ensure(!observation || !containsCredential(observation, privateValues(config)), "SENSITIVE_INPUT", "مقدار محرمانه را در توضیح ادامه ننویسید.");
  const message = observation ? `${continuation}\nAdditional operator observations (not approval; keep the original source and workload): ${observation}` : continuation;
  ensure(/^[a-f0-9-]{36}$/.test(requestKey), "INVALID_INPUT", "شناسه ادامه معتبر نیست.");
  const repo = new AgentRepository(store), previous = repo.get(session.actorId, id);
  ensure(previous?.mission, "AGENT_CONFLICT", "این درخواست مأموریت مرحله‌ای انتشار نیست.", 409);
  if (previous.lastInputKey === requestKey) {
    ensure(previous.lastInput === message, "IDEMPOTENCY_CONFLICT", "شناسه ادامه با درخواست دیگری ثبت شده است.", 409);
    return { run: previous, created: false };
  }
  const flow = await restoreProjectFlow(config, store, session.actorId, signal, previous.projectId ?? undefined);
  ensure(flow && flow.status !== "stale" && flow.status !== "unavailable" && flow.profile.sourceHash === previous.context.sourceHash,
    "PROJECT_CHANGED", "source تغییر کرده است؛ همان مأموریت با نسخه دیگر ادامه نمی‌یابد.", 409);
  store.db.exec("BEGIN IMMEDIATE");
  try {
    const run = repo.get(session.actorId, id);
    if (run?.mission && ((run.lastInputKey === requestKey && run.lastInput === message) || (run.lastResumeRevision === revision && run.lastInput === message))) {
      store.db.exec("COMMIT");
      return { run, created: false };
    }
    ensure(run?.mission && run.revision === revision && ["needs_input", "partially_completed", "failed", "interrupted"].includes(run.state),
      "AGENT_CONFLICT", "وضعیت ادامه تغییر کرده است؛ نتیجه تازه را دریافت کنید.", 409);
    store.assertAgentIdle(session.actorId);
    const context = currentAgentContext(config, store, session.actorId);
    if (fingerprint(context) !== fingerprint(run.context)) {
      ensure(run.effect === "no_remote_changes" && !run.publication && !run.destination &&
        (run.nextAction === "connect_account" || run.nextAction === "select_app") &&
        context.projectId === run.context.projectId && context.sourceHash === run.context.sourceHash && context.selectionHash === run.context.selectionHash,
        "AGENT_CONTEXT_CHANGED", "این تغییر مقصد خارج از تکمیل حساب اولیه است؛ تصمیم‌ها به انتخاب تازه منتقل نمی‌شوند.", 409);
      run.context = context;
      const { kind: _kind, identity: _identity, ...input } = run.mission;
      run.mission.identity = fingerprint({ input, context });
      addEvent(run, "state", "انتخاب حساب تکمیل شد؛ همان مأموریت و بودجه ادامه می‌یابند. هیچ تأیید انتشار یا ساخت صادر نشد.");
    }
    if (run.repair) {
      const adapter = new CodeRepairAdapter(config, store);
      run.repair = adapter.status(session.actorId, run.repair.id);
      if (run.repair.state === "queued" && (!run.repairDecision || run.repairDecision.expiresAt <= Date.now() || run.repairDecision.sessionId !== session.id)) {
        run.repair = adapter.cancel(session.actorId, run.repair.id);
        addEvent(run, "state", "اعتبار تصمیم قبلی تمام شده بود؛ اجرا نشد و برای اجرای تازه تصمیم دیگری لازم است.");
      }
      if (run.repair.validationOnly && run.repair.state === "failed" && ![72, 73, 76].includes(run.repair.afterTest?.exitCode ?? -1)) {
        run.buildRetryKey = requestKey; run.buildRetryConsumed = false;
      }
    }
    if (run.publication) run.publication = store.getAction(run.publication.id, session.actorId);
    if (run.destination) run.destination = store.getAction(run.destination.id, session.actorId);
    if (run.state === "failed" || run.state === "interrupted") run.state = "partially_completed";
    run.errorCode = null;
    run.lastResumeRevision = revision;
    repo.save(session.actorId, run, revision);
    const result = continueAgentRun(config, store, session, id, run.revision, requestKey, message);
    store.db.exec("COMMIT");
    return result;
  } catch (error) {
    store.db.exec("ROLLBACK");
    throw error;
  }
}
