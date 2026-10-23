import type { Action, Session } from "../../contracts/domain.ts";
import { environmentVariables, isApplicationEnvironmentKey, validateEnvironmentVisibility, type EnvironmentSpec } from "../../contracts/environment.ts";
import type { Config } from "../config.ts";
import { connectedLiaraConfig } from "../connections/liara.ts";
import { ensure } from "../errors.ts";
import { AgentRepository } from "../agent/store.ts";
import { assertAgentContext } from "../agent/tools.ts";
import { environmentFingerprint, openEnvironmentInput, saveEnvironmentInput } from "../environment/secrets.ts";
import { LiaraEnvironmentClient } from "../liara/environment.ts";
import type { Store } from "../persistence/store.ts";
import { RunBudget } from "../policy/budget.ts";
import { restoreProjectFlow, validateProjectAction } from "./project-flows.ts";
import { object, exactKeys } from "../../contracts/validation.ts";
import { importedEnvironment, importedEnvironmentReview } from "../environment/import.ts";

type Dependencies = { client?: LiaraEnvironmentClient };
export async function proposeImportedEnvironment(config: Config, store: Store, session: Session, runId: string, requestKey: string,
  publicKeys: readonly string[], signal: AbortSignal, deps: Dependencies = {}): Promise<Action> {
  const { flow } = environmentContext(config, store, session.actorId, runId), review = importedEnvironmentReview(config, store, session.actorId, flow);
  ensure(publicKeys.every(key => review.publicKeys.includes(key)), "ENV_SCOPE_DENIED", "انتخاب متغیر عمومی معتبر نیست.", 409);
  ensure(review.available.length > 0 && review.publicKeys.filter(key => review.available.includes(key)).every(key => publicKeys.includes(key)),
    "ENV_REVIEW_REQUIRED", "عمومی‌بودن تنظیمات مرورگر را تأیید کنید؛ نشانی‌های محلی جدا تکمیل می‌شوند.", 409);
  const values = importedEnvironment(config, store, session.actorId, flow.id).filter(row => review.available.includes(row.key));
  return proposeEnvironment(config, store, session, runId, requestKey, values.map(row => ({ ...row, public: publicKeys.includes(row.key) })), signal, deps);
}
const processState = globalThis as typeof globalThis & { launchlaneEnvironmentOperations?: Set<string> };
export function environmentContext(config: Config, store: Store, actorId: string, runId: string) {
  const run = new AgentRepository(store).get(actorId, runId);
  ensure(run?.mission && run.projectId && run.context.target, "ENV_PROJECT_REQUIRED", "پروژه و مقصد همین مأموریت را انتخاب کنید.", 409);
  assertAgentContext(config, store, actorId, run.context);
  const flow = store.getProjectFlow(actorId), target = run.context.target;
  ensure(flow?.id === run.projectId && flow.artifact && flow.status === "ready", "PROJECT_CHANGED", "فایل‌های پروژه آماده نیستند.", 409);
  const scoped = connectedLiaraConfig(config, store, actorId, target.app);
  return { run, flow, target, scoped };
}
// Each read/write is charged to the existing mission before transport; reload never renews its allowance.
async function withBudget<T>(config: Config, store: Store, actorId: string, runId: string,
  task: (budget: RunBudget) => Promise<T>): Promise<T> {
  const repo = new AgentRepository(store), run = environmentContext(config, store, actorId, runId).run;
  ensure(["needs_input", "partially_completed", "failed", "interrupted"].includes(run.state), "AGENT_BUSY", "مأموریت باید در انتظار اطلاعات باشد.", 409);
  // Concurrent preflights must not invalidate each other's durable budget revision before the single write claim.
  processState.launchlaneEnvironmentOperations ??= new Set<string>();
  const operations = processState.launchlaneEnvironmentOperations, operationKey = `${actorId}:${runId}`;
  ensure(!operations.has(operationKey), "ENV_BUSY", "بررسی همین اطلاعات در جریان است؛ وضعیت ثبت‌شده را دریافت کنید.", 409);
  operations.add(operationKey);
  const started = Date.now(), prior = run.usage.elapsedMs, budget = new RunBudget({ ...run.limits, runTimeoutMs: Math.max(1, run.limits.runTimeoutMs - prior) });
  budget.modelCalls = run.usage.modelCalls; budget.toolCalls = run.usage.toolCalls; budget.observedTokens = run.usage.observedTokens;
  let revision = run.revision;
  const persist = () => { run.usage.toolCalls = budget.toolCalls; run.usage.elapsedMs = prior + Date.now() - started; repo.save(actorId, run, revision); revision = run.revision; };
  const take = budget.take.bind(budget); budget.take = (kind, signal) => { take(kind, signal); persist(); };
  try { return await task(budget); } finally { try { persist(); } finally { operations.delete(operationKey); } }
}
export async function proposeEnvironment(config: Config, store: Store, session: Session, runId: string, requestKey: string,
  input: unknown, signal: AbortSignal, deps: Dependencies = {}): Promise<Action> {
  ensure(config.enableLiveLiara && config.enableMutations, "MUTATIONS_DISABLED", "تغییر واقعی اطلاعات برنامه در این نصب خاموش است.", 403);
  ensure(/^[a-f0-9-]{36}$/.test(requestKey), "INVALID_INPUT", "شناسه درخواست معتبر نیست.");
  ensure(Array.isArray(input) && input.length <= 32, "INVALID_ENV_INPUT", "اطلاعات متغیرها معتبر نیست.");
  const publicKeys = new Set<string>();
  const changes = environmentVariables(input.map(value => {
    const row = object(value); exactKeys(row, ["key", "value", "public"]);
    ensure(row.public === undefined || typeof row.public === "boolean", "INVALID_ENV_INPUT", "نوع مقدار معتبر نیست.");
    if (row.public === true && typeof row.key === "string") publicKeys.add(row.key);
    return { key: row.key, value: row.value };
  }), 32), { run, flow, target, scoped } = environmentContext(config, store, session.actorId, runId);
  ensure(changes.length > 0 && changes.every(({ key, value }) => (publicKeys.has(key) || value.length >= 4) && flow.profile.envNames.includes(key) && isApplicationEnvironmentKey(key)),
    "ENV_SCOPE_DENIED", "فقط اطلاعات لازمِ شناسایی‌شده در همین پروژه قابل تکمیل است؛ تنظیمات اجرای محیط جدا بررسی می‌شوند.", 409);
  validateEnvironmentVisibility(changes.filter(row => !publicKeys.has(row.key)).map(row => row.key));
  const infrastructureSecrets = [scoped.liaraToken, config.modelKey, config.operatorToken, config.sessionSecret].filter(Boolean);
  ensure(changes.every(row => infrastructureSecrets.every(secret => !row.value.includes(secret))), "ENV_INFRASTRUCTURE_CREDENTIAL", "کلیدهای نصب یا زیرساخت را به برنامه مشتری منتقل نکنید.", 409);
  const previous = store.db.prepare("SELECT action_id FROM environment_inputs WHERE actor_id=? AND id=?").get(session.actorId, requestKey);
  if (previous?.action_id) {
    const action = store.getAction(String(previous.action_id), session.actorId);
    ensure(action.spec.version === 9 && action.spec.agentRunId === run.id && action.spec.projectFlowId === flow.id, "IDEMPOTENCY_CONFLICT", "شناسه درخواست متعلق به مرحله دیگری است.", 409);
    const values = openEnvironmentInput(store, config.sessionSecret, session.actorId, action.spec, true).filter(row => action.spec.version === 9 && action.spec.keys.includes(row.key));
    ensure(environmentFingerprint(config.sessionSecret, values) === environmentFingerprint(config.sessionSecret, changes), "IDEMPOTENCY_CONFLICT", "همان شناسه با مقادیر متفاوت پذیرفته نمی‌شود.", 409);
    ensure(JSON.stringify(action.spec.secretKeys) === JSON.stringify(changes.filter(row => !publicKeys.has(row.key)).map(row => row.key)), "IDEMPOTENCY_CONFLICT", "محرمانگی همان درخواست تغییر نمی‌کند.", 409);
    return action;
  }
  store.assertAgentIdle(session.actorId);
  await restoreProjectFlow(config, store, session.actorId, signal, flow.id);
  return withBudget(config, store, session.actorId, runId, async budget => {
    const client = deps.client ?? new LiaraEnvironmentClient(scoped), scope = { teamId: target.teamId, app: target.app },
      current = await client.read({ scope, targetAppId: target.appId }, budget, signal), merged = new Map(current.values.map(row => [row.key, row]));
    for (const row of changes) merged.set(row.key, row);
    const values = environmentVariables([...merged.values()]), spec: EnvironmentSpec = { version: 9, operation: "update_env", scope,
      projectFlowId: flow.id, sourceHash: flow.profile.sourceHash, artifactHash: flow.artifact?.archiveHash ?? "", selectionHash: flow.selectionHash,
      accountId: target.accountId, targetAppId: target.appId, agentRunId: run.id, secretRef: requestKey,
      baseFingerprint: environmentFingerprint(config.sessionSecret, current.values), effectiveFingerprint: environmentFingerprint(config.sessionSecret, values),
      keys: changes.map(row => row.key), secretKeys: changes.filter(row => !publicKeys.has(row.key)).map(row => row.key), args: { port: null, planId: current.planId } };
    environmentContext(config, store, session.actorId, runId);
    saveEnvironmentInput(store, config.sessionSecret, session.actorId, spec, values, Date.now() + 600000);
    return store.createAction(session.actorId, spec);
  });
}
export async function executeEnvironment(config: Config, store: Store, session: Session, id: string, signal: AbortSignal, deps: Dependencies = {}): Promise<Action> {
  const action = store.getAction(id, session.actorId);
  ensure(action.spec.version === 9 && action.state === "approved" && !action.attemptId && action.expiresAt > Date.now(), "ACTION_CONFLICT", "تصمیم قابل مصرف برای این تغییر وجود ندارد.", 409);
  const spec = action.spec, { scoped } = environmentContext(config, store, session.actorId, spec.agentRunId);
  validateEnvironmentVisibility(spec.secretKeys);
  ensure(scoped.enableLiveLiara && scoped.enableMutations, "MUTATIONS_DISABLED", "تغییر واقعی اطلاعات برنامه خاموش است.", 403);
  await validateProjectAction(config, store, session.actorId, spec, signal);
  return withBudget(config, store, session.actorId, spec.agentRunId, async budget => {
    const values = openEnvironmentInput(store, config.sessionSecret, session.actorId, spec), client = deps.client ?? new LiaraEnvironmentClient(scoped),
      current = await client.read(spec, budget, signal);
    ensure(current.planId === spec.args.planId && environmentFingerprint(config.sessionSecret, current.values) === spec.baseFingerprint,
      "ENV_BASE_CHANGED", "اطلاعات یا پلن مقصد تغییر کرده است؛ پیشنهاد تازه لازم است و چیزی ارسال نشد.", 409);
    ensure(budget.maxToolCalls - budget.toolCalls >= 1 && !budget.signal(signal).aborted, "BUDGET_EXHAUSTED", "بودجه ارسال کافی نیست.", 409);
    environmentContext(config, store, session.actorId, spec.agentRunId);
    store.claim(id, session.actorId, session.id, spec);
    try {
      store.environmentStep(id, session.actorId, "request_started");
      await client.update(spec, values, budget, signal);
      return store.environmentStep(id, session.actorId, "accepted");
    } catch {
      store.uncertain(id, session.actorId); return store.getAction(id, session.actorId);
    }
  });
}
export async function observeEnvironment(config: Config, store: Store, session: Session, id: string, signal: AbortSignal, deps: Dependencies = {}): Promise<Action> {
  const action = store.getAction(id, session.actorId);
  ensure(action.spec.version === 9 && action.environment && ["observing", "uncertain"].includes(action.state), "ACTION_CONFLICT", "این تغییر منتظر بررسی نیست.", 409);
  const spec = action.spec, progress = action.environment, { scoped } = environmentContext(config, store, session.actorId, spec.agentRunId);
  return withBudget(config, store, session.actorId, spec.agentRunId, async budget => {
    let outcome: "verified" | "inconclusive" | "not_started" = "inconclusive";
    try {
      const current = await (deps.client ?? new LiaraEnvironmentClient(scoped)).read(spec, budget, signal);
      if (progress.stage === "claimed") outcome = "not_started";
      else if (current.planId === spec.args.planId && environmentFingerprint(config.sessionSecret, current.values) === spec.effectiveFingerprint) outcome = "verified";
    } catch { /* Unknown configuration remains locked; a read error never authorizes another write. */ }
    environmentContext(config, store, session.actorId, spec.agentRunId);
    return store.observeEnvironment(id, session.actorId, outcome, progress.checkedAt);
  });
}
