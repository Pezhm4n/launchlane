import type { Action, Session } from "../../contracts/domain.ts";
import type { Config } from "../config.ts";
import type { Store } from "../persistence/store.ts";
import { ensure } from "../errors.ts";
import { LiaraDatabaseCredentialsClient } from "../liara/database-credentials.ts";
import { LiaraDatabaseReadClient } from "../liara/database-read.ts";
import { LiaraAccountClient } from "../liara/catalog.ts";
import type { LiaraEnvironmentClient } from "../liara/environment.ts";
import { environmentContext, proposeResourceEnvironment } from "./environment.ts";
import { string } from "../../contracts/validation.ts";
import { databaseBindingKeys, isDatabaseResourceSpec } from "../../contracts/database-provision.ts";
import { sourceDatabaseBindingKeys } from "../policy/database-targets.ts";

function context(config: Config, store: Store, actor: string, runId: string) {
  const c = environmentContext(config, store, actor, runId), action = c.run.database;
  ensure(action && isDatabaseResourceSpec(action.spec) && action.state === "succeeded" && action.database?.databaseId && action.database.observation?.outcome === "identity_verified" &&
    action.spec.agentRunId === runId && action.spec.projectFlowId === c.flow.id && action.spec.accountId === c.target.accountId && action.spec.targetAppId === c.target.appId,
    "DATABASE_BINDING_UNAVAILABLE", "دیتابیس همین مأموریت باید ابتدا با شناسهٔ واقعی تأیید شود.", 409);
  store.assertProjectAction(actor, action.spec);
  const spec = action.spec;
  const requirement = c.flow.profile.applicationRequirements?.requirements.find(row => row.consumerRoot === spec.consumerRoot && row.need === "required" &&
    row.kind === (spec.database.type === "postgres" ? "postgresql" : spec.database.type === "mysql" ? "mysql" : "redis"));
  // A URL binding is accepted only when this exact consumer declares it. Never map unrelated application keys.
  const keys = databaseBindingKeys(spec);
  ensure(keys.every(key => requirement?.environmentKeys.includes(key) && c.flow.profile.envNames.includes(key)), "DATABASE_BINDING_SHAPE_UNSUPPORTED", "کلید اتصال این بخش در source مشخص نیست؛ مقدار حدسی ساخته نمی‌شود.", 409);
  if (spec.version !== 27) sourceDatabaseBindingKeys(c.flow.profile, spec.consumerRoot, spec.database.type, keys);
  return { ...c, databaseAction: action, spec: action.spec, databaseId: action.database.databaseId, keys };
}
export function databaseEnvironmentOption(config: Config, store: Store, actor: string, runId: string) {
  try { const c = context(config, store, actor, runId); return { actionId: c.databaseAction.id, hostname: c.spec.database.hostname, keys: c.keys }; }
  catch { return null; }
}
export async function proposeDatabaseEnvironment(config: Config, store: Store, session: Session, runId: string, requestKey: string, signal: AbortSignal,
  deps: { credentials?: LiaraDatabaseCredentialsClient; read?: LiaraDatabaseReadClient; account?: LiaraAccountClient; environment?: LiaraEnvironmentClient } = {}): Promise<Action> {
  ensure(store.sessionExists(session.id, session.actorId, Date.now()), "AUTH_REQUIRED", "دوباره وارد شوید.", 401);
  ensure(config.enableLiveLiara && config.enableMutations, "MUTATIONS_DISABLED", "اتصال واقعی دیتابیس در این نصب خاموش است.", 403);
  const initial = context(config, store, session.actorId, runId);
  const previous = store.db.prepare("SELECT action_id FROM environment_inputs WHERE actor_id=? AND id=?").get(session.actorId, requestKey);
  if (previous?.action_id) {
    const action = store.getAction(string(previous.action_id, 36), session.actorId), link = store.db.prepare("SELECT database_action_id FROM database_environment_bindings WHERE action_id=?").get(action.id);
    ensure(action.spec.version === 9 && action.spec.agentRunId === runId && link?.database_action_id === initial.databaseAction.id && JSON.stringify([...action.spec.keys].sort()) === JSON.stringify(initial.keys),
      "IDEMPOTENCY_CONFLICT", "این درخواست به اتصال دیگری تعلق دارد.", 409); return action;
  }
  return proposeResourceEnvironment(config, store, session, runId, requestKey, async budget => {
    const c = context(config, store, session.actorId, runId), reader = deps.read ?? new LiaraDatabaseReadClient(c.scoped, c.target.accountId),
      account = deps.account ?? new LiaraAccountClient(c.scoped, c.target.accountId);
    await reader.capabilities(budget, signal); // revalidate actual account/team before a private detail read
    const app = await account.projectMetadata(c.target.app, budget, signal);
    ensure(app?.id === c.target.appId && app.networkId === c.spec.database.networkId, "DATABASE_NETWORK_CHANGED", "شبکه مصرف‌کننده تغییر کرده است.", 409);
    const values = await (deps.credentials ?? new LiaraDatabaseCredentialsClient(c.scoped)).read(c.spec, c.databaseId, budget, signal);
    const protocol = c.spec.database.type === "postgres" ? "postgresql:" : c.spec.database.type === "mysql" ? "mysql:" : "redis:", url = new URL(`${protocol}//${values.host}:${values.port}/`);
    url.username = values.username; url.password = values.password;
    ensure(c.spec.database.type !== "redis" || /^\d{1,3}$/.test(values.database), "DATABASE_BINDING_SHAPE_UNSUPPORTED", "شمارهٔ دیتابیس Redis باید از provider مشخص باشد.", 409);
    url.pathname = `/${encodeURIComponent(values.database)}`;
    context(config, store, session.actorId, runId);
    return c.keys.map(key => ({ key, value: url.href, public: false }));
  }, signal, { ...(deps.environment ? { client: deps.environment } : {}), onCreated(action) {
    const fresh = context(config, store, session.actorId, runId);
    ensure(fresh.databaseAction.id === initial.databaseAction.id, "DATABASE_BINDING_UNAVAILABLE", "منبع اتصال تغییر کرده است.", 409);
    store.db.prepare("INSERT INTO database_environment_bindings VALUES (?,?)").run(action.id, initial.databaseAction.id);
  } });
}
