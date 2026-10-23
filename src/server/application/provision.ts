import type { Action, Session } from "../../contracts/domain.ts";
import type { ProvisionSpec, ProvisionObservation, ProvisionReadback } from "../../contracts/provision.ts";
import { identifier } from "../../contracts/validation.ts";
import { providerObjectId } from "../../contracts/provision.ts";
import type { Config } from "../config.ts";
import { connectedLiaraAccountConfig } from "../connections/liara.ts";
import { ensure, AppError } from "../errors.ts";
import { LiaraAccountClient, quotePaaSOffer, type PaaSCatalog } from "../liara/catalog.ts";
import type { ProjectFlow } from "../../contracts/project-flow.ts";
import { parseDestinationRecommendation, type DestinationRecommendation } from "../../contracts/destination-recommendation.ts";
import { LiaraProvisionClient } from "../liara/provision.ts";
import type { Store } from "../persistence/store.ts";
import { authorizeScope } from "../policy/action.ts";
import { RunBudget } from "../policy/budget.ts";
import { executeApproved } from "./execute.ts";
import { restoreProjectFlow } from "./project-flows.ts";
import { parseNodeVersion } from "../../contracts/node-runtime.ts";
import { actionPlatform } from "../../contracts/platform.ts";

type Dependencies = { read?: LiaraAccountClient; write?: LiaraProvisionClient; budget?: RunBudget;
  onRecommendation?: (recommendation: DestinationRecommendation) => void; onProposed?: (action: Action) => void };
export function recommendDestination(flow: ProjectFlow, catalog: PaaSCatalog, selected?: { planId: string; bundleId: string }): DestinationRecommendation {
  ensure(flow.profile.runtime === "node" || flow.profile.runtime === "python" || flow.profile.runtime === "static", "PROJECT_INCOMPLETE", "روش اجرای پروژه هنوز مشخص نیست؛ پیشنهاد اختصاصی آماده نشد.", 409);
  const available = catalog.offers.filter(offer => offer.region === "iran" && offer.hourlyHundredthsToman !== null), plans = new Set<string>();
  const choices = available.filter(offer => { if (plans.has(offer.planId)) return false; plans.add(offer.planId); return true; }).slice(0, 3);
  const current = selected && available.find(offer => offer.planId === selected.planId && offer.bundleId === selected.bundleId);
  if (current && !choices.some(offer => offer.planId === current.planId && offer.bundleId === current.bundleId)) choices.push(current);
  ensure(choices[0], "PLAN_UNAVAILABLE", "پلن با قیمت مشخص در حساب موجود نیست؛ قیمت نامعلوم پیشنهاد هزینه نمی‌شود.", 409);
  const runtime = flow.profile.nextRuntime ? `Next.js / Node ${flow.profile.nextRuntime.version}` : flow.profile.runtime === "static" ? "سایت ایستا" : flow.profile.runtime === "python" ? `Python ${flow.profile.pythonRuntime?.version ?? ""}` : `Node.js ${flow.profile.nodeRuntime?.version ?? ""}`;
  return parseDestinationRecommendation({ version: 1, projectId: flow.id, sourceHash: flow.profile.sourceHash, catalogFingerprint: catalog.fingerprint,
    observedAt: catalog.observedAt, projectName: flow.displayName || (flow.selection.kind === "upload" || flow.selection.kind === "github" ? flow.selection.name : flow.selection.directory.split(/[\\/]/).at(-1)) || "پروژه شما",
    summary: `${runtime}؛ ${flow.profile.build ? "فرمان ساخت شناسایی شده است" : "فرمان ساخت جداگانه‌ای در پروژه پیدا نشده است"}؛ ${flow.profile.envNames.length ? `${flow.profile.envNames.length} نام تنظیم نیاز به بررسی دارد` : "نام تنظیم الزامی از بررسی ایستا استخراج نشده است"}.`,
    reason: "برای اولین انتشار و بررسی همین پروژه، کم‌هزینه‌ترین ترکیب موجود با قیمت مشخص پیشنهاد می‌شود. نیاز واقعی به حافظه و پردازنده هنوز اندازه‌گیری نشده؛ انتخاب نهایی با شماست.",
    capacity: "unmeasured", recommended: { planId: choices[0].planId, bundleId: choices[0].bundleId },
    offers: choices.map(offer => ({ planId: offer.planId, bundleId: offer.bundleId, region: offer.region, hourlyHundredthsToman: offer.hourlyHundredthsToman })) });
}
function scopedConfig(config: Config, store: Store, actor: string, app: string): Config {
  ensure(/^[a-z0-9][a-z0-9-]{0,62}$/.test(app) && (!config.apps.length || config.apps.includes(app)),
    "SCOPE_DENIED", "نام برنامه در محدوده مجاز این نصب نیست.", 403);
  return { ...connectedLiaraAccountConfig(config, store, actor), apps: [app] };
}
function assertAccount(config: Config, store: Store, actor: string, spec: ProvisionSpec): Config {
  const scoped = scopedConfig(config, store, actor, spec.scope.app), account = store.getConnection(actor, "liara")?.view;
  ensure(account?.identityId === spec.accountId && account.teamId === spec.scope.teamId && scoped.enableLiveLiara,
    "SCOPE_DENIED", "حساب ساخت مقصد تغییر کرده یا خواندن سرویس خاموش است.", 403);
  authorizeScope(spec.scope, scoped);
  return scoped;
}
async function checkInputs(client: LiaraAccountClient, spec: ProvisionSpec, budget: RunBudget, signal: AbortSignal): Promise<void> {
  ensure(spec.cost.expiresAt > Date.now(), "CATALOG_STALE", "اعتبار برآورد تمام شده است؛ پیشنهاد تازه لازم است.", 409);
  const catalog = await client.catalog(budget, signal), quote = quotePaaSOffer(catalog, spec.args.planId, spec.bundleId);
  ensure(quote.catalogFingerprint === spec.cost.catalogFingerprint && quote.selected.hourlyHundredthsToman === spec.cost.hourlyHundredthsToman &&
    quote.selected.region === spec.cost.region,
    "PLAN_CHANGED", "قیمت یا موجودبودن پلن تغییر کرده است؛ تأیید تازه لازم است.", 409);
  ensure(quote.creditCoversOneBaseHour, "INSUFFICIENT_CREDIT", "اعتبار فعلی هزینه پایه یک ساعت را پوشش نمی‌دهد؛ پرداخت از حساب کاربر انجام می‌شود.", 409);
  ensure((await client.networks(budget, signal)).some((network) => network.id === spec.networkId),
    "NETWORK_CHANGED", "شبکه انتخاب‌شده در همین تیم موجود نیست؛ پیشنهاد تازه لازم است.", 409);
  ensure(await client.projectMetadata(spec.scope.app, budget, signal) === null,
    "APP_ALREADY_EXISTS", "برنامه‌ای با این نام موجود است؛ ساخته یا جایگزین نمی‌شود. مقصد موجود یا نام دیگری انتخاب کنید.", 409);
}

export async function destinationOptions(config: Config, store: Store, actor: string, signal: AbortSignal, dependencies: Dependencies = {}) {
  const scoped = connectedLiaraAccountConfig(config, store, actor), connection = store.getConnection(actor, "liara")?.view;
  ensure(connection?.status === "connected", "LIARA_AUTH_REQUIRED", "ابتدا حساب را متصل کنید.", 403);
  const budget = dependencies.budget ?? new RunBudget(scoped), client = dependencies.read ?? new LiaraAccountClient(scoped, connection.identityId),
    catalog = await client.catalog(budget, signal), networks = await client.networks(budget, signal), current = store.getConnection(actor, "liara")?.view;
  ensure(current?.status === "connected" && current.identityId === connection.identityId && current.teamId === connection.teamId,
    "SCOPE_DENIED", "حساب هنگام خواندن گزینه‌ها تغییر کرد.", 403);
  return { catalog, networks, networkCreationAvailable: config.enableMutations && networks.length === 0 };
}

export async function proposeDestination(config: Config, store: Store, actor: string,
  input: { flowId: string; app: string; planId: string; bundleId: string; networkId: string },
  signal: AbortSignal, dependencies: Dependencies = {}): Promise<Action> {
  ensure(config.enableMutations && config.enableLiveLiara, "MUTATIONS_DISABLED", "پیشنهاد ساخت واقعی مقصد در این نصب خاموش است.", 403);
  const app = identifier(input.app), scoped = scopedConfig(config, store, actor, app), connection = store.getConnection(actor, "liara")?.view;
  ensure(connection?.status === "connected", "LIARA_AUTH_REQUIRED", "ابتدا حساب را متصل کنید.", 403);
  const flow = await restoreProjectFlow(scoped, store, actor, signal, input.flowId);
  ensure(flow?.status === "ready" && flow.artifact && flow.profile.start &&
    (flow.profile.runtime === "node" && flow.profile.nodeRuntime?.version || flow.profile.runtime === "python" && flow.profile.pythonRuntime || flow.profile.runtime === "static" && flow.profile.staticRuntime),
    "PROJECT_INCOMPLETE", "روش اجرای این پروژه هنوز آمادهٔ انتشار نیست؛ نتیجهٔ بررسی فایل‌ها و آماده‌سازی را ببینید.", 409);
  const budget = dependencies.budget ?? new RunBudget(scoped), client = dependencies.read ?? new LiaraAccountClient(scoped, connection.identityId),
    catalog = await client.catalog(budget, signal), quote = quotePaaSOffer(catalog, identifier(input.planId), identifier(input.bundleId)),
    networkId = providerObjectId(input.networkId);
  ensure(quote.selected.region === "iran", "PROVISION_REGION_UNVERIFIED", "ساخت مقصد در این مرحله فقط برای پلن ایران و شبکه موجود پشتیبانی می‌شود.", 409);
  ensure(quote.creditCoversOneBaseHour, "INSUFFICIENT_CREDIT", "اعتبار حساب هزینه پایه یک ساعت این پیشنهاد را پوشش نمی‌دهد.", 409);
  ensure((await client.networks(budget, signal)).some((network) => network.id === networkId), "NETWORK_CHANGED", "شبکه متعلق به همین فهرست تیم نیست.", 409);
  ensure(await client.projectMetadata(app, budget, signal) === null, "APP_ALREADY_EXISTS", "این نام قبلاً استفاده شده است؛ برنامه موجود جایگزین نمی‌شود.", 409);
  const spec: ProvisionSpec = { ...(flow.profile.runtime === "static" && flow.profile.staticRuntime
    ? { version: 16 as const, nodeVersion: null, runtime: flow.profile.staticRuntime }
    : flow.profile.runtime === "python" && flow.profile.pythonRuntime
    ? { version: 12 as const, nodeVersion: null, runtime: flow.profile.pythonRuntime }
    : flow.profile.nextRuntime ? { version: 18 as const, nodeVersion: flow.profile.nextRuntime.version, runtime: flow.profile.nextRuntime }
    : { version: 8 as const, nodeVersion: parseNodeVersion(flow.profile.nodeRuntime?.version) }), operation: "create_app", scope: { teamId: scoped.teamId, app },
    sourceHash: flow.profile.sourceHash, artifactHash: flow.artifact.archiveHash, projectFlowId: flow.id, selectionHash: flow.selectionHash,
    accountId: connection.identityId, previousAppId: connection.apps.find((app) => app.name === connection.selectedApp)?.id ?? null,
    networkId, bundleId: quote.selected.bundleId, readOnlyRootFilesystem: true,
    args: { port: null, planId: quote.selected.planId }, cost: { catalogFingerprint: quote.catalogFingerprint,
      observedAt: quote.observedAt, expiresAt: quote.expiresAt, hourlyHundredthsToman: quote.selected.hourlyHundredthsToman,
      region: quote.selected.region, currency: "toman", period: "hour", extras: "tax_traffic_storage_not_included" } };
  ensure(!signal.aborted, "CANCELLED", "پیشنهاد ساخت متوقف شد.", 409);
  dependencies.onRecommendation?.(recommendDestination(flow, catalog, { planId: spec.args.planId, bundleId: spec.bundleId }));
  return store.createAction(actor, spec, Date.now(), Math.min(600000, spec.cost.expiresAt - Date.now()), dependencies.onProposed);
}

export async function executeDestination(config: Config, store: Store, session: Session, id: string,
  signal: AbortSignal, dependencies: Dependencies = {}): Promise<Action> {
  ensure(config.enableMutations && config.enableLiveLiara, "MUTATIONS_DISABLED", "ساخت مقصد در این نصب خاموش است.", 403);
  const action = store.getAction(id, session.actorId);
  ensure((action.spec.version === 8 || action.spec.version === 12 || action.spec.version === 16 || action.spec.version === 18) && action.state === "approved" && !action.attemptId && action.expiresAt > Date.now(),
    "ACTION_CONFLICT", "پیشنهاد ساخت معتبر و تأییدشده‌ای برای اجرا وجود ندارد.", 409);
  const spec = action.spec, scoped = assertAccount(config, store, session.actorId, spec), budget = dependencies.budget ?? new RunBudget(scoped),
    client = dependencies.read ?? new LiaraAccountClient(scoped, spec.accountId), writer = dependencies.write ?? new LiaraProvisionClient(scoped);
  ensure(budget.maxToolCalls - budget.toolCalls >= 4, "BUDGET_EXHAUSTED", "بودجه برای پیش‌نیازها و ساخت مقصد کافی نیست.", 409);
  return executeApproved({ config: scoped, store, session, id, currentSpec: spec, signal: budget.signal(signal), adapter: {
    async preflight(bounded) {
      await checkInputs(client, spec, budget, bounded);
      // Read recovery must not consume the create allowance before an attempt is claimed.
      ensure(budget.maxToolCalls - budget.toolCalls >= 1, "BUDGET_EXHAUSTED", "بودجه ارسال ساخت مقصد کافی نیست.", 409);
      assertAccount(config, store, session.actorId, spec);
    },
    async execute(claimed, bounded) {
      assertAccount(config, store, session.actorId, spec);
      store.provisionStep(claimed.id, session.actorId, "request_started");
      const appId = await writer.create(spec, budget, bounded);
      // Bind the returned internal ID before any readback or account selection can happen.
      store.provisionStep(claimed.id, session.actorId, "created", appId);
      return { remoteId: appId };
    },
  } });
}

export async function observeDestination(config: Config, store: Store, session: Session, id: string,
  signal: AbortSignal, dependencies: Dependencies = {}): Promise<Action> {
  const action = store.getAction(id, session.actorId);
  ensure((action.spec.version === 8 || action.spec.version === 12 || action.spec.version === 16 || action.spec.version === 18) && action.provision && (action.state === "observing" || action.state === "uncertain"),
    "ACTION_CONFLICT", "ساخت مقصد منتظر نتیجه نیست.", 409);
  const spec = action.spec, scoped = assertAccount(config, store, session.actorId, spec), budget = dependencies.budget ?? new RunBudget(scoped),
    client = dependencies.read ?? new LiaraAccountClient(scoped, spec.accountId);
  let proof: ProvisionReadback | null = null, result: ProvisionObservation = { outcome: "inconclusive", code: "CREATE_RECEIPT_UNKNOWN", checkedAt: 0 };
  if (action.provision.stage === "claimed" && action.state === "uncertain") result = { ...result, outcome: "not_started", code: "CREATE_NOT_STARTED" };
  else if (action.provision.stage === "created" && action.provision.appId) {
    try {
      await client.identity(budget, signal);
      proof = await client.projectMetadata(spec.scope.app, budget, signal);
      if (proof) {
        const matches = proof.id === action.provision.appId && proof.platform === actionPlatform(spec) && proof.planId === spec.args.planId &&
          proof.bundleId === spec.bundleId && proof.networkId === spec.networkId && proof.readOnlyRootFilesystem === true;
        result = { ...result, outcome: matches ? "verified" : "changed", code: matches ? "DESTINATION_VERIFIED" : "DESTINATION_CHANGED" };
      } else result = { ...result, code: "DESTINATION_NOT_VISIBLE" };
    } catch (error) {
      if (signal.aborted) throw new AppError("CANCELLED", "بررسی ساخت متوقف شد؛ ساخت دوباره انجام نمی‌شود.", 409);
      result = { ...result, code: error instanceof AppError ? error.code : "OBSERVATION_UNAVAILABLE" };
    }
  }
  assertAccount(config, store, session.actorId, spec);
  ensure(!signal.aborted, "CANCELLED", "بررسی متوقف شد.", 409);
  return store.recordProvisionObservation(id, session.actorId, { ...result,
    checkedAt: Math.max(Date.now(), (action.provision.observation?.checkedAt ?? 0) + 1) }, proof);
}
