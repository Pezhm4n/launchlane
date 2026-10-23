import { randomBytes } from "node:crypto";
import type { Action, Session } from "../../contracts/domain.ts";
import type { NetworkSpec } from "../../contracts/network.ts";
import { identifier } from "../../contracts/validation.ts";
import type { Config } from "../config.ts";
import { connectedLiaraAccountConfig } from "../connections/liara.ts";
import { ensure } from "../errors.ts";
import { LiaraAccountClient } from "../liara/catalog.ts";
import { LiaraNetworkClient } from "../liara/network.ts";
import type { Store } from "../persistence/store.ts";
import { authorizeScope } from "../policy/action.ts";
import { RunBudget } from "../policy/budget.ts";
import { executeApproved } from "./execute.ts";
import { restoreProjectFlow } from "./project-flows.ts";

type Dependencies = { read?: LiaraAccountClient; write?: LiaraNetworkClient; budget?: RunBudget };
function accountConfig(config: Config, store: Store, actor: string, app: string, spec?: NetworkSpec): Config {
  ensure(/^[a-z0-9][a-z0-9-]{0,62}$/.test(app) && (!config.apps.length || config.apps.includes(app)),
    "SCOPE_DENIED", "نام مقصد در محدوده مجاز این نصب نیست.", 403);
  const scoped = { ...connectedLiaraAccountConfig(config, store, actor), apps: [app] }, connection = store.getConnection(actor, "liara")?.view;
  ensure(connection?.status === "connected" && scoped.enableLiveLiara && (!spec || connection.identityId === spec.accountId && connection.teamId === spec.scope.teamId),
    "SCOPE_DENIED", "حساب یا تیم ساخت شبکه تغییر کرده است.", 403);
  if (spec) authorizeScope(spec.scope, scoped);
  return scoped;
}

export async function proposeNetwork(config: Config, store: Store, actor: string,
  input: { flowId: string; app: string; agentRunId?: string }, signal: AbortSignal, dependencies: Dependencies = {}): Promise<Action> {
  ensure(config.enableMutations && config.enableLiveLiara, "MUTATIONS_DISABLED", "ساخت شبکه در این نصب خاموش است.", 403);
  const app = identifier(input.app), scoped = accountConfig(config, store, actor, app), connection = store.getConnection(actor, "liara")?.view;
  ensure(connection?.status === "connected", "LIARA_AUTH_REQUIRED", "ابتدا حساب را متصل کنید.", 403);
  const flow = await restoreProjectFlow(scoped, store, actor, signal, input.flowId);
  ensure(flow?.status === "ready" && flow.artifact, "PROJECT_INCOMPLETE", "ابتدا پروژه را انتخاب و بررسی کنید.", 409);
  const budget = dependencies.budget ?? new RunBudget(scoped), reader = dependencies.read ?? new LiaraAccountClient(scoped, connection.identityId);
  await reader.identity(budget, signal);
  ensure((await reader.networks(budget, signal)).length === 0, "NETWORK_ALREADY_AVAILABLE", "شبکه موجود است؛ همان را انتخاب کنید. ساخت اضافه لازم نیست.", 409);
  ensure(!signal.aborted, "CANCELLED", "پیشنهاد شبکه متوقف شد.", 409);
  accountConfig(config, store, actor, app);
  return store.createAction(actor, {
    version: 13, operation: "create_network", scope: { teamId: scoped.teamId, app },
    sourceHash: flow.profile.sourceHash, artifactHash: flow.artifact.archiveHash, projectFlowId: flow.id, selectionHash: flow.selectionHash,
    accountId: connection.identityId, previousAppId: connection.apps.find(value => value.name === connection.selectedApp)?.id ?? null,
    agentRunId: input.agentRunId ?? null, networkName: `ll-${flow.id.replaceAll("-", "").slice(0, 8)}-${randomBytes(8).toString("hex")}`,
    args: { port: null, planId: null }, cost: { state: "unknown", amount: null, currency: null, period: null },
  });
}

export async function executeNetwork(config: Config, store: Store, session: Session, id: string,
  signal: AbortSignal, dependencies: Dependencies = {}): Promise<Action> {
  const action = store.getAction(id, session.actorId);
  ensure(action.spec.version === 13 && action.state === "approved" && !action.attemptId && action.expiresAt > Date.now(),
    "ACTION_CONFLICT", "پیشنهاد شبکه مجوز معتبر اجرا ندارد.", 409);
  const spec = action.spec, scoped = accountConfig(config, store, session.actorId, spec.scope.app, spec),
    budget = dependencies.budget ?? new RunBudget(scoped), reader = dependencies.read ?? new LiaraAccountClient(scoped, spec.accountId),
    writer = dependencies.write ?? new LiaraNetworkClient(scoped);
  return executeApproved({ config: scoped, store, session, id, currentSpec: spec, signal: budget.signal(signal), adapter: {
    async preflight(bounded) {
      ensure(budget.maxToolCalls - budget.toolCalls >= 3, "BUDGET_EXHAUSTED", "بودجه بررسی حساب و ساخت شبکه کافی نیست.", 409);
      await reader.identity(budget, bounded);
      ensure((await reader.networks(budget, bounded)).length === 0, "NETWORK_ALREADY_AVAILABLE", "شبکه‌ای در تیم موجود شده است؛ ساخت تازه متوقف شد.", 409);
      ensure(budget.maxToolCalls - budget.toolCalls >= 1, "BUDGET_EXHAUSTED", "بودجه ارسال ساخت شبکه پس از بررسی‌ها کافی نیست.", 409);
      accountConfig(config, store, session.actorId, spec.scope.app, spec);
    },
    async execute(claimed, bounded) {
      accountConfig(config, store, session.actorId, spec.scope.app, spec);
      store.startNetworkRequest(claimed.id, session.actorId);
      await writer.create(spec, budget, bounded);
      return { networkAccepted: true };
    },
  } });
}

export async function observeNetwork(config: Config, store: Store, session: Session, id: string,
  signal: AbortSignal, dependencies: Dependencies = {}): Promise<Action> {
  const action = store.getAction(id, session.actorId), progress = action.network;
  ensure(action.spec.version === 13 && progress && (action.state === "observing" || action.state === "uncertain"),
    "ACTION_CONFLICT", "شبکه منتظر بررسی نتیجه نیست.", 409);
  const spec = action.spec, scoped = accountConfig(config, store, session.actorId, spec.scope.app, spec),
    budget = dependencies.budget ?? new RunBudget(scoped), reader = dependencies.read ?? new LiaraAccountClient(scoped, spec.accountId);
  let proof = null;
  if (progress.acceptedAt !== null) {
    await reader.identity(budget, signal);
    const matches = (await reader.networks(budget, signal)).filter(network => network.name === spec.networkName);
    ensure(matches.length <= 1, "NETWORK_IDENTITY_AMBIGUOUS", "هویت شبکه یکتا نیست؛ ساخت دیگری انجام نمی‌شود.", 409);
    if (matches[0]) proof = { ...matches[0], accountId: spec.accountId, teamId: spec.scope.teamId, observedAt: Date.now() };
  }
  accountConfig(config, store, session.actorId, spec.scope.app, spec);
  ensure(!signal.aborted, "CANCELLED", "بررسی شبکه متوقف شد؛ ساخت تکرار نمی‌شود.", 409);
  return store.recordNetworkObservation(id, session.actorId, progress.observation?.checkedAt ?? null, proof);
}
