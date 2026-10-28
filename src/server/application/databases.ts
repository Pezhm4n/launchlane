import type { Action, Session } from "../../contracts/domain.ts";
import type { DatabaseProvisionSpec } from "../../contracts/database-provision.ts";
import { databaseHostname } from "../../contracts/database-provision.ts";
import { applicationSourcePath } from "../../contracts/application-requirements.ts";
import { identifier, string } from "../../contracts/validation.ts";
import { connectedLiaraConfig } from "../connections/liara.ts";
import type { Config } from "../config.ts";
import { ensure } from "../errors.ts";
import { LiaraAccountClient } from "../liara/catalog.ts";
import { LiaraDatabaseReadClient, quoteDatabaseOffer } from "../liara/database-read.ts";
import { LiaraDatabaseProvisionClient } from "../liara/database-provision.ts";
import type { Store } from "../persistence/store.ts";
import { RunBudget } from "../policy/budget.ts";
import { executeApproved } from "./execute.ts";
import { restoreProjectFlow } from "./project-flows.ts";

type Dependencies = { read?: LiaraDatabaseReadClient; account?: LiaraAccountClient; write?: LiaraDatabaseProvisionClient; budget?: RunBudget };
type Input = { flowId: string; requestKey: string; consumerRoot: string; type: string; version: string; planId: string; bundleId: string; agentRunId?: string };
function context(config: Config, store: Store, actor: string, spec?: DatabaseProvisionSpec) {
  const flow = store.getProjectFlow(actor), connection = store.getConnection(actor, "liara")?.view,
    app = connection?.apps.find(row => row.name === connection.selectedApp);
  ensure(flow?.artifact && flow.status === "ready" && connection?.status === "connected" && app,
    "DATABASE_CONTEXT_REQUIRED", "پروژه و مقصد همین حساب برای دیتابیس لازم است.", 409);
  const scoped = connectedLiaraConfig(config, store, actor, app.name);
  if (spec) {
    store.assertProjectAction(actor, spec);
    ensure(connection.identityId === spec.accountId && connection.teamId === spec.scope.teamId && app.id === spec.targetAppId,
      "DATABASE_TARGET_CHANGED", "حساب یا مقصد دیتابیس تغییر کرده است.", 409);
  }
  return { flow, artifact: flow.artifact, connection, app, config: scoped };
}
function sourceNeed(c: ReturnType<typeof context>, consumerRoot: string, type: string) {
  const kind = type === "postgres" ? "postgresql" : type === "mysql" ? "mysql" : type === "redis" ? "redis" : null;
  const inspection = c.flow.profile.applicationRequirements;
  ensure(kind && inspection?.sourceHash === c.flow.profile.sourceHash && inspection.requirements.some(requirement =>
    requirement.kind === kind && requirement.consumerRoot === consumerRoot && requirement.need === "required" &&
    requirement.evidence.every(evidence => c.flow.profile.manifest.some(file => file.path === evidence.path && file.sha256 === evidence.sha256))),
    "DATABASE_SOURCE_REQUIREMENT_REQUIRED", "نوع دیتابیس باید به نیاز مشخص همان بخش source متصل باشد؛ سرویس متفاوت جایگزین نمی‌شود.", 409);
}
async function preflight(c: ReturnType<typeof context>, spec: DatabaseProvisionSpec, budget: RunBudget, signal: AbortSignal, deps: Dependencies) {
  const reader = deps.read ?? new LiaraDatabaseReadClient(c.config, spec.accountId), account = deps.account ?? new LiaraAccountClient(c.config, spec.accountId);
  const quote = quoteDatabaseOffer(await reader.capabilities(budget, signal), { type: spec.database.type, version: spec.database.version, planId: spec.database.planId, bundleId: spec.database.bundleId });
  ensure(quote.planHourlyToman === spec.cost.planHourlyToman && quote.bundleHourlyToman === spec.cost.bundleHourlyToman && spec.cost.expiresAt > Date.now(),
    "DATABASE_PRICE_CHANGED", "قیمت دیتابیس تغییر کرده یا منقضی است؛ تصمیم تازه لازم است.", 409);
  const project = await account.projectMetadata(spec.scope.app, budget, signal);
  ensure(project?.id === spec.targetAppId && project.networkId === spec.database.networkId, "DATABASE_TARGET_CHANGED", "مقصد یا شبکه مصرف‌کننده تغییر کرده است.", 409);
  ensure((await account.networks(budget, signal)).some(row => row.id === spec.database.networkId), "DATABASE_NETWORK_CHANGED", "شبکه در تیم انتخاب‌شده موجود نیست.", 409);
  const inventory = await reader.inventory(budget, signal);
  ensure(!inventory.databases.some(row => row.hostname === spec.database.hostname), "DATABASE_ALREADY_EXISTS", "نام دیتابیس قبلاً موجود است؛ ساخت تکراری انجام نشد.", 409);
}
export async function proposeDatabase(config: Config, store: Store, actor: string, input: Input, signal: AbortSignal, deps: Dependencies = {}): Promise<Action> {
  ensure(config.enableMutations && config.enableLiveLiara, "MUTATIONS_DISABLED", "ساخت دیتابیس در این نصب خاموش است.", 403);
  const c = context(config, store, actor), consumerRoot = applicationSourcePath(input.consumerRoot, true), type = identifier(input.type),
    version = string(input.version, 64), planId = identifier(input.planId), bundleId = identifier(input.bundleId), requestKey = string(input.requestKey, 36);
  ensure(c.flow.id === input.flowId && /^[a-f0-9-]{36}$/.test(requestKey), "INVALID_INPUT", "پروژه یا شناسه درخواست دیتابیس معتبر نیست.");
  sourceNeed(c, consumerRoot, type);
  const prior = store.db.prepare("SELECT id FROM actions WHERE actor_id=? AND json_extract(spec,'$.version')=27 AND json_extract(spec,'$.requestKey')=?").get(actor, requestKey);
  if (prior) {
    const action = store.getAction(string(prior.id, 36), actor), spec = action.spec;
    ensure(spec.version === 27 && spec.projectFlowId === input.flowId && spec.sourceHash === c.flow.profile.sourceHash && spec.artifactHash === c.artifact.archiveHash && spec.selectionHash === c.flow.selectionHash &&
      spec.accountId === c.connection.identityId && spec.targetAppId === c.app.id && spec.consumerRoot === consumerRoot && spec.agentRunId === (input.agentRunId ?? null) &&
      spec.database.type === type && spec.database.version === version && spec.database.planId === planId && spec.database.bundleId === bundleId,
      "IDEMPOTENCY_CONFLICT", "شناسه درخواست دیتابیس به انتخاب دیگری تعلق دارد.", 409);
    return action;
  }
  store.assertAgentIdle(actor, null, false, input.agentRunId ?? null);
  const restored = await restoreProjectFlow(c.config, store, actor, signal, input.flowId);
  ensure(restored?.status === "ready" && restored.profile.sourceHash === c.flow.profile.sourceHash, "PROJECT_CHANGED", "source تغییر کرده است.", 409);
  const budget = deps.budget ?? new RunBudget(c.config), reader = deps.read ?? new LiaraDatabaseReadClient(c.config, c.connection.identityId),
    account = deps.account ?? new LiaraAccountClient(c.config, c.connection.identityId),
    quote = quoteDatabaseOffer(await reader.capabilities(budget, signal), { type, version, planId, bundleId });
  ensure(quote.planHourlyToman !== null && quote.bundleHourlyToman !== null && quote.creditCoversPlanBaseHour === true,
    "DATABASE_PRICE_REQUIRED", "قیمت هر دو بخش و اعتبار پایه حساب باید مشخص باشند.", 409);
  const project = await account.projectMetadata(c.app.name, budget, signal);
  ensure(project?.id === c.app.id, "DATABASE_TARGET_CHANGED", "هویت مقصد تغییر کرده است.", 409);
  ensure((await account.networks(budget, signal)).some(row => row.id === project.networkId), "DATABASE_NETWORK_CHANGED", "شبکه مقصد در همین تیم تأیید نشد.", 409);
  const hostname = databaseHostname(`ll-${c.flow.id.replaceAll("-", "").slice(0, 8)}-${requestKey.replaceAll("-", "").slice(0, 16)}`);
  ensure(!(await reader.inventory(budget, signal)).databases.some(row => row.hostname === hostname), "DATABASE_ALREADY_EXISTS", "این نام دیتابیس قبلاً موجود است.", 409);
  ensure(!signal.aborted, "CANCELLED", "پیشنهاد دیتابیس متوقف شد.", 409);
  const fresh = context(config, store, actor);
  ensure(fresh.flow.id === c.flow.id && fresh.flow.profile.sourceHash === c.flow.profile.sourceHash && fresh.app.id === c.app.id && fresh.connection.identityId === c.connection.identityId,
    "DATABASE_TARGET_CHANGED", "پروژه یا مقصد هنگام پیشنهاد تغییر کرد.", 409);
  return store.createAction(actor, { version: 27, operation: "create_database", scope: { teamId: c.config.teamId, app: c.app.name },
    projectFlowId: c.flow.id, sourceHash: c.flow.profile.sourceHash, artifactHash: c.artifact.archiveHash, selectionHash: c.flow.selectionHash,
    accountId: c.connection.identityId, targetAppId: c.app.id, consumerRoot, requestKey, agentRunId: input.agentRunId ?? null,
    database: { hostname, type, version, planId, bundleId, networkId: project.networkId, publicNetwork: false }, args: { port: null, planId },
    cost: { planHourlyToman: quote.planHourlyToman, bundleHourlyToman: quote.bundleHourlyToman, combinedTotal: "not_computed", extras: "unknown", expiresAt: Date.now() + 5 * 60000 } });
}
export async function executeDatabase(config: Config, store: Store, session: Session, id: string, signal: AbortSignal, deps: Dependencies = {}): Promise<Action> {
  const action = store.getAction(id, session.actorId);
  ensure(action.spec.version === 27 && action.state === "approved" && !action.attemptId, "ACTION_CONFLICT", "دیتابیس مجوز معتبر اجرا ندارد.", 409);
  const spec = action.spec, c = context(config, store, session.actorId, spec), budget = deps.budget ?? new RunBudget(c.config),
    writer = deps.write ?? new LiaraDatabaseProvisionClient(c.config);
  sourceNeed(c, spec.consumerRoot, spec.database.type);
  return executeApproved({ config: c.config, store, session, id, currentSpec: spec, signal: budget.signal(signal), adapter: {
    async preflight(bounded) {
      ensure(budget.maxToolCalls - budget.toolCalls >= 6, "BUDGET_EXHAUSTED", "بودجه بررسی حساب، قیمت و دیتابیس کافی نیست.", 409);
      await preflight(c, spec, budget, bounded, deps);
      context(config, store, session.actorId, spec);
      ensure(budget.maxToolCalls - budget.toolCalls >= 1, "BUDGET_EXHAUSTED", "بودجه ارسال پس از بررسی‌ها کافی نیست.", 409);
    },
    async execute(claimed, bounded) {
      context(config, store, session.actorId, spec);
      store.startDatabaseRequest(claimed.id, session.actorId);
      const result = await writer.create(spec, budget, bounded);
      return { databaseAccepted: true, databaseId: result.databaseId };
    },
  } });
}
export async function observeDatabase(config: Config, store: Store, session: Session, id: string, signal: AbortSignal, deps: Dependencies = {}): Promise<Action> {
  const action = store.getAction(id, session.actorId), progress = action.database;
  ensure(action.spec.version === 27 && progress && ["observing", "uncertain"].includes(action.state), "ACTION_CONFLICT", "دیتابیس منتظر بازخوانی نیست.", 409);
  const spec = action.spec, connection = store.getConnection(session.actorId, "liara")?.view;
  ensure(connection?.status === "connected" && connection.identityId === spec.accountId && connection.teamId === spec.scope.teamId &&
    connection.apps.some(row => row.name === spec.scope.app && row.id === spec.targetAppId), "DATABASE_TARGET_CHANGED", "حساب یا مقصد مشاهده تغییر کرده است.", 409);
  const scoped = connectedLiaraConfig(config, store, session.actorId, spec.scope.app), budget = deps.budget ?? new RunBudget(scoped),
    reader = deps.read ?? new LiaraDatabaseReadClient(scoped, spec.accountId);
  let proof = null;
  if (progress.acceptedAt !== null && progress.databaseId !== null) {
    const observed = await reader.database({ accountId: spec.accountId, teamId: spec.scope.teamId, databaseId: progress.databaseId }, budget, signal);
    if (observed.resource) proof = { ...observed.resource, accountId: spec.accountId, teamId: spec.scope.teamId, observedAt: observed.observedAt };
  }
  ensure(!signal.aborted, "CANCELLED", "بررسی دیتابیس متوقف شد؛ ساخت تکرار نمی‌شود.", 409);
  return store.recordDatabaseObservation(id, session.actorId, progress.observation?.checkedAt ?? null, proof);
}
