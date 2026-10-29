import { createHmac, randomUUID } from "node:crypto";
import { dataObservationId, parseDatabaseDataObservation, type DatabaseDataState } from "../../contracts/database-data.ts";
import { parseCodeRepairJob } from "../../contracts/code-repair.ts";
import { object, string } from "../../contracts/validation.ts";
import type { Config } from "../config.ts";
import { connectedLiaraConfig } from "../connections/liara.ts";
import { AppError, ensure } from "../errors.ts";
import { assertPreparedDatabaseBindings } from "../environment/prepared-database.ts";
import { canonical, fingerprint } from "../policy/action.ts";
import { RunBudget } from "../policy/budget.ts";
import type { Store } from "../persistence/store.ts";
import { LiaraDatabaseCredentialsClient } from "../liara/database-credentials.ts";
import { LiaraDatabaseReadClient } from "../liara/database-read.ts";
import { LiaraAccountClient } from "../liara/catalog.ts";
import { LiaraReadClient } from "../liara/client.ts";
import { LiaraEnvironmentClient } from "../liara/environment.ts";
import { PostgresObserver } from "../liara/postgres-observer.ts";
import { fullstackVerification, requiresProductionDataVerification } from "./fullstack-verification.ts";
import { actionPlatform } from "../../contracts/platform.ts";
import type { Scope } from "../../contracts/domain.ts";

type Dependencies = { database?: LiaraDatabaseReadClient; credentials?: LiaraDatabaseCredentialsClient; account?: LiaraAccountClient;
  read?: LiaraReadClient; environment?: LiaraEnvironmentClient; observer?: PostgresObserver; budget?: RunBudget };

function networksAllowed(config: Config, accountId: string, teamId: string, networkIds: readonly string[]) {
  return networkIds.length > 0 && networkIds.every(networkId => config.databaseReadNetworks.some(row => row.accountId === accountId && row.teamId === teamId && row.networkId === networkId));
}

/** The current release may predate newer failed builds. A bounded miss is unknown, never a changed release. */
export async function readDatabaseDataRelease(read: LiaraReadClient, scope: Scope, releaseId: string, budget: RunBudget, signal: AbortSignal) {
  for (let page = 1; page <= 3; page++) {
    const result = await read.releases(scope, page, 50, budget, signal);
    ensure(result.currentRelease === releaseId, "DATABASE_DATA_RELEASE_CHANGED", "نسخهٔ جاری با رسید انتشار برابر نیست.", 409);
    const current = result.releases.find(row => row.id === releaseId);
    if (current) { ensure(current.state === "READY", "DATABASE_DATA_RELEASE_NOT_READY", "نسخهٔ جاری هنوز آماده تأیید نشده است.", 409); return; }
    if (!result.hasMore) break;
  }
  ensure(false, "DATABASE_DATA_RELEASE_UNOBSERVED", "حالت نسخهٔ جاری در محدودهٔ سابقه خوانده نشد؛ تغییر نسخه یا سلامت آن تأیید نمی‌شود.", 409);
}

function context(config: Config, store: Store, actor: string, actionId: string) {
  const action = store.getAction(dataObservationId(actionId), actor), spec = action.spec,
    flow = store.getProjectFlow(actor), connection = store.getConnection(actor, "liara")?.view,
    app = connection?.apps.find(row => row.name === connection.selectedApp);
  ensure(spec.version === 23 && action.state === "succeeded" && action.remoteId && action.deployment?.observation?.outcome === "verified" &&
    action.deployment.observation.releaseId === action.remoteId, "DATABASE_PUBLICATION_REQUIRED", "ابتدا انتشار همان بسته و پاسخ آن باید رسید تأییدشده داشته باشد.", 409);
  ensure(flow?.artifact && flow.id === spec.projectFlowId && flow.status === "ready" && flow.profile.sourceHash === spec.sourceHash &&
    flow.artifact.archiveHash === spec.artifactHash && flow.selectionHash === spec.selectionHash && connection?.status === "connected" &&
    connection.identityId === spec.accountId && connection.teamId === spec.scope.teamId && app?.id === spec.targetAppId && app.name === spec.scope.app,
    "DATABASE_DATA_CONTEXT_CHANGED", "حساب، پروژه یا مقصد بررسی داده تغییر کرده است؛ نسخهٔ فعال را انتخاب کنید.", 409);
  store.assertProjectAction(actor, spec);
  return { action, spec, flow, config: connectedLiaraConfig(config, store, actor, app.name) };
}
function dataPlan(store: Store, actor: string, c: ReturnType<typeof context>) {
  if (!requiresProductionDataVerification(store, actor, c.spec.verification)) return null;
  const row = store.db.prepare("SELECT state,data_json FROM code_repair_jobs WHERE id=? AND actor_id=? AND state='succeeded'").get(c.spec.verification.buildJobId, actor);
  ensure(row, "FULLSTACK_BUILD_REQUIRED", "رسید ساخت همین نسخه موجود نیست.", 409);
  const job = parseCodeRepairJob({ ...object(object(JSON.parse(string(row.data_json, 1024 * 1024))).job), state: row.state });
  ensure(job.build?.version === 7 && job.build.testDatabase?.version === 4, "DATABASE_DATA_PLAN_REQUIRED", "معیار مستقل همان بسته لازم است.", 409);
  return job.build.testDatabase;
}
/** Reload reads stored evidence only. It never opens a SQL connection or renews a run. */
export function databaseDataState(config: Config, store: Store, actor: string, actionId: string): DatabaseDataState {
  const c = context(config, store, actor, actionId), plan = dataPlan(store, actor, c), available = plan !== null,
    row = store.db.prepare("SELECT public_json FROM database_data_observations WHERE actor_id=? AND action_id=? ORDER BY checked_at DESC,rowid DESC LIMIT 1").get(actor, actionId);
  const enabled = config.enableLiveLiara && config.enableDatabaseDataReads && plan && config.databaseReadNetworks.length > 0 &&
    networksAllowed(config, c.spec.accountId, c.spec.scope.teamId, assertPreparedDatabaseBindings(store, config.sessionSecret, actor, c.flow, plan).targets.map(row => row.spec.database.networkId));
  return { available, enabled: Boolean(enabled),
    latest: row ? parseDatabaseDataObservation(JSON.parse(string(row.public_json, 32768))) : null };
}

/** The model chooses only a publication and a prior receipt. SQL/targets/credentials come from host-validated evidence. */
export async function observeDatabaseData(config: Config, store: Store, actor: string, actionId: string,
  baselineId: string | null, signal: AbortSignal, deps: Dependencies = {}) {
  ensure(config.enableLiveLiara && config.enableDatabaseDataReads, "DATABASE_DATA_READS_DISABLED", "بررسی مستقیم داده در این نصب فعال نیست؛ اتصال خصوصی میزبان به شبکهٔ همین دیتابیس لازم است.", 403);
  const initial = context(config, store, actor, actionId), plan = dataPlan(store, actor, initial);
  ensure(plan, "DATABASE_DATA_PLAN_REQUIRED", "این انتشار معیار مستقل دادهٔ آزموده‌شده ندارد.", 409);
  const verification = await fullstackVerification(store, config.stateDir, actor, initial.flow, config.sessionSecret);
  ensure(fingerprint(verification) === fingerprint(initial.spec.verification), "DATABASE_DATA_CONTEXT_CHANGED", "معیار داده یا بستهٔ انتشار تغییر کرده است.", 409);
  const bound = assertPreparedDatabaseBindings(store, config.sessionSecret, actor, initial.flow, plan),
    bindingHash = createHmac("sha256", config.sessionSecret).update(canonical({ actor, spec: initial.spec, environment: bound.reference,
      values: bound.values, resources: bound.targets.map(row => ({ databaseId: row.databaseId, spec: row.spec })) })).digest("hex");
  ensure(networksAllowed(config, initial.spec.accountId, initial.spec.scope.teamId, bound.targets.map(row => row.spec.database.networkId)),
    "DATABASE_DATA_NETWORK_NOT_AUTHORIZED", "مسیر خصوصی همین حساب، تیم و شبکه باید در تنظیمات سرور مجاز شده باشد؛ اتصال SQL آغاز نشد.", 403);
  const baseline = baselineId === null ? null : store.db.prepare("SELECT binding_hash,private_json,public_json FROM database_data_observations WHERE actor_id=? AND action_id=? AND id=?").get(actor, actionId, dataObservationId(baselineId));
  ensure(baselineId === null || baseline?.binding_hash === bindingHash, "DATABASE_DATA_BASELINE_CHANGED", "بررسی قبلی به همین بسته، اتصال و منبع تعلق ندارد.", 409);
  const baselineObservation = baseline ? parseDatabaseDataObservation(JSON.parse(string(baseline.public_json, 32768))) : null;
  const budget = deps.budget ?? new RunBudget({ ...config, maxToolCalls: config.agentMaxToolCalls }), bounded = budget.signal(signal),
    scoped = initial.config, database = deps.database ?? new LiaraDatabaseReadClient(scoped, initial.spec.accountId),
    credentials = deps.credentials ?? new LiaraDatabaseCredentialsClient(scoped), account = deps.account ?? new LiaraAccountClient(scoped, initial.spec.accountId),
    read = deps.read ?? new LiaraReadClient(scoped), environment = deps.environment ?? new LiaraEnvironmentClient(scoped), observer = deps.observer ?? new PostgresObserver();
  const revalidate = async () => {
    const current = context(config, store, actor, actionId), currentBound = assertPreparedDatabaseBindings(store, config.sessionSecret, actor, current.flow, plan);
    ensure(createHmac("sha256", config.sessionSecret).update(canonical({ actor, spec: current.spec, environment: currentBound.reference,
      values: currentBound.values, resources: currentBound.targets.map(row => ({ databaseId: row.databaseId, spec: row.spec })) })).digest("hex") === bindingHash,
      "DATABASE_DATA_CONTEXT_CHANGED", "اتصال یا منبع هنگام بررسی تغییر کرد.", 409);
    const app = await account.projectMetadata(initial.spec.scope.app, budget, bounded);
    ensure(app?.id === initial.spec.targetAppId && app.platform === actionPlatform(initial.spec) && bound.targets.every(row => app.networkId === row.spec.database.networkId),
      "DATABASE_DATA_RELEASE_CHANGED", "نسخهٔ جاری یا شبکهٔ برنامه با رسید انتشار برابر نیست.", 409);
    await readDatabaseDataRelease(read, initial.spec.scope, string(initial.action.remoteId, 128), budget, bounded);
    const env = await environment.read(initial.spec, budget, bounded);
    ensure(bound.values.every(value => env.values.some(row => row.key === value.key && row.value === value.value)),
      "DATABASE_DATA_ENV_CHANGED", "اتصال جاری لیارا با ورودی خصوصی تأییدشده برابر نیست.", 409);
  };
  await database.capabilities(budget, bounded); // fresh account/team identity before any private detail or SQL connection
  await revalidate();
  const targets = [], privatePersistence: (readonly string[])[] = [];
  const liveConnection = async (target: typeof bound.targets[number]) => {
    // Legacy credential bindings allowed an absent network field. A new data read requires
    // fresh explicit network identity too, without changing those historical contracts.
    const identity = await credentials.inspect(initial.spec.scope, target.databaseId, budget, bounded).catch((error: unknown) => {
      if (error instanceof AppError && error.code === "INVALID_INPUT") throw new AppError("DATABASE_DATA_RESOURCE_UNVERIFIED", "هویت یا شبکهٔ دیتابیس از پاسخ سرویس قابل تأیید نیست؛ شاهد تازهٔ داده ثبت نشد.", 409);
      throw error;
    });
    ensure(identity.networkId === target.spec.database.networkId && identity.hostname === target.spec.database.hostname &&
      identity.type === "postgres" && identity.version === target.spec.database.version && identity.planId === target.spec.database.planId,
      "DATABASE_DATA_RESOURCE_CHANGED", "هویت یا شبکهٔ فعلی دیتابیس با منبع تأییدشده برابر نیست.", 409);
    const connection = await credentials.read(target.spec, target.databaseId, budget, bounded), url = new URL(`postgresql://${connection.host}:${connection.port}/`);
    url.username = connection.username; url.password = connection.password; url.pathname = `/${encodeURIComponent(connection.database)}`;
    ensure(target.target.environmentKeys.every(key => bound.values.some(value => value.key === key && value.value === url.href)),
      "DATABASE_DATA_CREDENTIALS_CHANGED", "اتصال تأییدشده با جزئیات فعلی همان دیتابیس برابر نیست.", 409);
    return connection;
  };
  for (const target of bound.targets) {
    const connection = await liveConnection(target);
    const expectedMajor = Number(/^([1-9][0-9]?)(?:\.|$)/.exec(target.spec.database.version)?.[1]);
    ensure(Number.isInteger(expectedMajor) && expectedMajor >= 10, "DATABASE_DATA_VERSION_UNKNOWN", "نسخهٔ واقعی PostgreSQL مشخص نیست.", 409);
    const result = await observer.observe(connection, target.target.oracle, { expectedMajor: String(expectedMajor), network: { mode: "private_network" },
      digestKey: config.sessionSecret, signal: bounded, take: () => budget.take("tool", bounded) });
    targets.push({ id: target.target.id, databaseId: target.databaseId, ...result.observation });
    privatePersistence.push(result.privatePersistence);
  }
  await revalidate();
  for (const target of bound.targets) await liveConnection(target);
  context(config, store, actor, actionId);
  ensure(fingerprint(assertPreparedDatabaseBindings(store, config.sessionSecret, actor, initial.flow, plan)) === fingerprint(bound),
    "DATABASE_DATA_CONTEXT_CHANGED", "اتصال هنگام بررسی تغییر کرد.", 409);
  ensure(!bounded.aborted, "CANCELLED", "بررسی داده کامل نشد.", 409);
  const healthy = targets.every(target => target.schemaMatches && target.rowsMatch && target.persistencePresent && target.persistenceNonNull && target.persistenceChecks > 0);
  const observation = parseDatabaseDataObservation({ id: randomUUID(), actionId, releaseId: initial.action.remoteId, artifactHash: initial.spec.artifactHash, checkedAt: Date.now(),
    outcome: healthy ? "verified" : "failed",
    targets: targets.map(({ checkedAt: _checkedAt, ...target }) => target), baselineId,
    comparison: baseline ? !healthy || baselineObservation?.outcome !== "verified" ? "not_comparable" : canonical(JSON.parse(string(baseline.private_json, 32768))) === canonical(privatePersistence) ? "same_selected_values" : "selected_values_changed" : "not_requested",
    migrationVerified: false, applicationWriteVerified: false, restartPersistenceVerified: false, remoteChanges: false });
  store.db.prepare("INSERT INTO database_data_observations VALUES (?,?,?,?,?,?,?)").run(observation.id, actor, actionId, bindingHash, JSON.stringify(observation), JSON.stringify(privatePersistence), observation.checkedAt);
  return observation;
}
