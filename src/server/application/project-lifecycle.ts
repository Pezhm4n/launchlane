import type { Action, Session } from "../../contracts/domain.ts";
import type { LifecycleSpec, LifecycleProgress } from "../../contracts/project-lifecycle.ts";
import { parseLifecycleSpec } from "../../contracts/project-lifecycle.ts";
import { string } from "../../contracts/validation.ts";
import type { Config } from "../config.ts";
import type { Store } from "../persistence/store.ts";
import { connectedLiaraConfig } from "../connections/liara.ts";
import { AppError, ensure } from "../errors.ts";
import { RunBudget } from "../policy/budget.ts";
import { LiaraLifecycleClient } from "../liara/lifecycle.ts";

type Deps = { client?: LiaraLifecycleClient };
function context(config: Config, store: Store, actor: string, spec: LifecycleSpec) {
  const flow = store.getProjectFlow(actor), connection = store.getConnection(actor, "liara")?.view;
  ensure(flow?.id === spec.projectFlowId && flow.profile.sourceHash === spec.sourceHash && flow.selectionHash === spec.selectionHash, "PROJECT_CHANGED", "پروژه تغییر کرده است.", 409);
  ensure(connection?.identityId === spec.accountId && connection.teamId === spec.scope.teamId && connection.selectedApp === spec.scope.app && connection.apps.some(app => app.id === spec.targetAppId && app.name === spec.scope.app),
    "PROJECT_ACCESS_CHANGED", "حساب یا مقصد تغییر کرده است؛ همان پروژه را باز کنید.", 409);
  return connectedLiaraConfig(config, store, actor, spec.scope.app);
}
export function currentLifecycle(store: Store, actor: string, projectId: string): Action | null {
  const row = store.db.prepare("SELECT id FROM actions WHERE actor_id=? AND json_extract(spec,'$.version')=14 AND json_extract(spec,'$.projectFlowId')=? ORDER BY rowid DESC LIMIT 1").get(actor, projectId);
  return row ? store.getAction(string(row.id, 36), actor) : null;
}
export async function proposeLifecycle(config: Config, store: Store, session: Session, projectId: string, operation: LifecycleSpec["operation"], requestKey: string, signal: AbortSignal, deps: Deps = {}) {
  ensure(config.enableLiveLiara && config.enableMutations, "MUTATIONS_DISABLED", "مدیریت واقعی مقصد در این نصب خاموش است.", 403);
  const flow = store.getProjectFlow(session.actorId), connection = store.getConnection(session.actorId, "liara")?.view, app = connection?.apps.find(app => app.name === connection.selectedApp);
  ensure(flow?.id === projectId && connection && app, "PROJECT_REQUIRED", "ابتدا همان پروژه و مقصد را باز کنید.", 409);
  const spec = parseLifecycleSpec({ version: 14, operation, scope: { teamId: connection.teamId, app: app.name }, accountId: connection.identityId, targetAppId: app.id,
    projectFlowId: flow.id, sourceHash: flow.profile.sourceHash, selectionHash: flow.selectionHash, args: { port: null, planId: "pending" }, requestKey });
  const previous = store.db.prepare("SELECT id,spec FROM actions WHERE actor_id=? AND json_extract(spec,'$.version')=14 AND json_extract(spec,'$.requestKey')=?").get(session.actorId, requestKey);
  if (previous) { const action = store.getAction(string(previous.id, 36), session.actorId); ensure(action.spec.version === 14 && action.spec.projectFlowId === projectId && action.spec.operation === operation, "IDEMPOTENCY_CONFLICT", "شناسه درخواست متعلق به اقدام دیگری است.", 409); return action; }
  store.assertAgentIdle(session.actorId);
  const scoped = context(config, store, session.actorId, spec), client = deps.client ?? new LiaraLifecycleClient(scoped), budget = new RunBudget(scoped), metadata = await client.read(spec, budget, signal);
  ensure(metadata, "NOT_FOUND", "مقصد در لیارا پیدا نشد؛ وضعیت اتصال را به‌روز کنید.", 404);
  if (operation === "delete_app") ensure(metadata.scale === 0, "APP_STOP_REQUIRED", "ابتدا برنامه را متوقف کنید و منتظر تأیید توقف در تنظیمات لیارا بمانید.", 409);
  context(config, store, session.actorId, spec);
  // A concurrent double click must reuse the proposal before it can create fresh authority.
  const concurrent = currentLifecycle(store, session.actorId, projectId);
  if (concurrent?.spec.version === 14 && concurrent.spec.requestKey === requestKey) return concurrent;
  ensure(!concurrent || !["awaiting_approval", "approved", "executing", "observing", "uncertain"].includes(concurrent.state) || concurrent.expiresAt <= Date.now() && !concurrent.attemptId,
    "ACTION_CONFLICT", "ابتدا پیشنهاد مدیریت مقصد را پاسخ دهید یا نتیجهٔ همان اقدام را بررسی کنید.", 409);
  return store.createAction(session.actorId, { ...spec, args: { port: null, planId: metadata.planId } });
}
export async function executeLifecycle(config: Config, store: Store, session: Session, id: string, signal: AbortSignal, deps: Deps = {}) {
  const action = store.getAction(id, session.actorId);
  ensure(action.spec.version === 14 && action.state === "approved" && !action.attemptId, "ACTION_CONFLICT", "این مجوز قابل مصرف نیست؛ وضعیت همان اقدام را بخوانید.", 409);
  const spec = action.spec, scoped = context(config, store, session.actorId, spec), client = deps.client ?? new LiaraLifecycleClient(scoped), budget = new RunBudget(scoped);
  ensure(scoped.enableMutations && scoped.enableLiveLiara, "MUTATIONS_DISABLED", "مدیریت مقصد خاموش است.", 403);
  const metadata = await client.read(spec, budget, signal);
  ensure(metadata?.planId === spec.args.planId, "LIFECYCLE_TARGET_CHANGED", "مقصد یا پلن تغییر کرده است؛ تصمیم تازه لازم است.", 409);
  if (spec.operation === "delete_app") ensure(metadata.scale === 0, "APP_STOP_REQUIRED", "توقف در تنظیمات لیارا ثبت نشده است؛ حذف ارسال نشد.", 409);
  context(config, store, session.actorId, spec); store.claim(id, session.actorId, session.id, spec);
  try { store.lifecycleStep(id, session.actorId, "request_started"); await client.mutate(spec, budget, signal); return store.lifecycleStep(id, session.actorId, "accepted"); }
  catch { store.uncertain(id, session.actorId); return store.getAction(id, session.actorId); }
}
export async function observeLifecycle(config: Config, store: Store, session: Session, id: string, signal: AbortSignal, deps: Deps = {}) {
  const action = store.getAction(id, session.actorId);
  ensure(action.spec.version === 14 && action.lifecycle && ["observing", "uncertain"].includes(action.state), "ACTION_CONFLICT", "این اقدام منتظر بررسی نیست.", 409);
  const spec = action.spec, scoped = context(config, store, session.actorId, spec), budget = new RunBudget(scoped), client = deps.client ?? new LiaraLifecycleClient(scoped);
  let verification: LifecycleProgress["verification"];
  try {
    const metadata = await client.read(spec, budget, signal);
    if (spec.operation === "delete_app" && metadata === null) verification = "destination_absent";
    else if (spec.operation === "stop_app" && metadata?.scale === 0) {
      try { if (await client.empty(spec, budget, signal)) verification = "instances_absent"; }
      catch (cause) {
        // The official stop effect is scale=0. Do not turn a broken instances API into an empty list.
        if (cause instanceof AppError && cause.code === "LIFECYCLE_INSTANCES_UNAVAILABLE") verification = "configuration";
        else throw cause;
      }
    }
  }
  catch { /* A provider failure or a replaced identity is not proof of stop/removal. */ }
  context(config, store, session.actorId, spec);
  return store.observeLifecycle(id, session.actorId, verification, action.lifecycle.checkedAt);
}
