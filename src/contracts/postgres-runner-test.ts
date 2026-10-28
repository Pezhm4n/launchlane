import { exactKeys, hash, integer, object, string, text } from "./validation.ts";
import { parsePostgresDataOracle, type PostgresDataOracle } from "./postgres-migration-test.ts";
import { ensure } from "../server/errors.ts";
import { isPublicClientEnvironmentKey } from "./environment.ts";

export type PostgresRunnerTarget = Readonly<{ id: string; environmentKeys: readonly string[]; requiredRelations: readonly string[]; oracle: PostgresDataOracle }>;
export type PostgresMigrationRunner = Readonly<{ script: string; chain: readonly Readonly<{ name: string; command: string }>[]; sha256: string }>;
export function runnerScriptName(value: unknown): string {
  const name = string(value, 64); ensure(/^[A-Za-z0-9][A-Za-z0-9:_-]*$/.test(name), "MIGRATION_RUNNER_INVALID", "نام script باید از package.json همین پروژه انتخاب شود.", 409); return name;
}
export function parsePostgresMigrationRunner(value: unknown): PostgresMigrationRunner {
  const row = object(value); exactKeys(row, ["script", "chain", "sha256"]); const script = runnerScriptName(row.script);
  ensure(Array.isArray(row.chain) && row.chain.length > 0 && row.chain.length <= 3, "MIGRATION_RUNNER_INVALID", "زنجیرهٔ script موجود لازم است.", 409);
  const chain = row.chain.map(value => { const part = object(value); exactKeys(part, ["name", "command"]); return { name: runnerScriptName(part.name), command: text(part.command, 2000) }; });
  const permitted = [`pre${script}`, script, `post${script}`];
  ensure(chain.filter(part => part.name === script).length === 1 && chain.every((part, i) => permitted.includes(part.name) && (i === 0 || permitted.indexOf(part.name) > permitted.indexOf(chain[i - 1]?.name ?? ""))), "MIGRATION_RUNNER_INVALID", "ترتیب hookها و script باید صریح باشد.", 409);
  return { script, chain, sha256: hash(row.sha256) };
}
export function parsePostgresRunnerTargets(value: unknown): readonly PostgresRunnerTarget[] {
  ensure(Array.isArray(value) && value.length > 0 && value.length <= 4, "MIGRATION_TARGETS_INVALID", "آزمون به یک تا چهار دیتابیس مستقل نیاز دارد.", 409);
  const targets = value.map(value => { const row = object(value); exactKeys(row, ["id", "environmentKeys", "requiredRelations", "oracle"]); const id = string(row.id, 32);
    ensure(/^[a-z][a-z0-9_]{0,31}$/.test(id) && Array.isArray(row.environmentKeys) && row.environmentKeys.length > 0 && row.environmentKeys.length <= 4 &&
      row.environmentKeys.every(key => typeof key === "string" && key.length <= 128 && !isPublicClientEnvironmentKey(key) && /^(?:DATABASE_URL|[A-Z][A-Z0-9_]*_(?:DB|DATABASE)_(?:URL|URI))$/.test(key)), "MIGRATION_TARGETS_INVALID", "شناسهٔ دیتابیس و نام ورودی source باید محدود و صریح باشند.", 409);
    ensure(Array.isArray(row.requiredRelations) && row.requiredRelations.length > 0 && row.requiredRelations.length <= 16 && row.requiredRelations.every(name => typeof name === "string" && /^public\.[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(name)), "MIGRATION_TARGETS_INVALID", "جدول‌های لازم هر دیتابیس باید مشخص باشند.", 409);
    const oracle = parsePostgresDataOracle(row.oracle, "runner"), relations = row.requiredRelations;
    ensure(oracle.columns.every(column => relations.includes(column.relation)), "MIGRATION_ORACLE_INVALID", "معیارها باید به همان دیتابیس و جدول‌های لازم وصل باشند.", 409);
    ensure(relations.every(relation => oracle.columns.some(column => column.relation === relation)), "MIGRATION_ORACLE_INVALID", "هر جدول لازم باید دست‌کم یک ستون در سنجش مستقل schema داشته باشد؛ اعلام آمادگی برنامه کافی نیست.", 409);
    return { id, environmentKeys: [...row.environmentKeys].sort(), requiredRelations: [...row.requiredRelations].sort(), oracle };
  });
  const keys = targets.flatMap(target => target.environmentKeys);
  ensure(new Set(targets.map(target => target.id)).size === targets.length && new Set(keys).size === keys.length && targets.every(target => new Set(target.requiredRelations).size === target.requiredRelations.length), "MIGRATION_TARGETS_INVALID", "شناسه، ورودی اتصال و جدول تکراری مجاز نیستند.", 409);
  return targets;
}
export type PostgresRunnerTestReceipt = Readonly<{
  kind: "disposable_postgres_runner"; sourceHash: string; planHash: string; runnerHash: string;
  targets: readonly Readonly<{ id: string; columnChecks: number; rowChecks: number; persistenceChecks: number }>[];
  runnerRuns: 2; applicationRuns: 2; replay: "selected_oracles_unchanged"; databaseRestartVerified: false; production: false; checkedAt: number;
}>;
export function parsePostgresRunnerTestReceipt(value: unknown): PostgresRunnerTestReceipt {
  const row = object(value); exactKeys(row, ["kind", "sourceHash", "planHash", "runnerHash", "targets", "runnerRuns", "applicationRuns", "replay", "databaseRestartVerified", "production", "checkedAt"]);
  ensure(row.kind === "disposable_postgres_runner" && row.runnerRuns === 2 && row.applicationRuns === 2 && row.replay === "selected_oracles_unchanged" && row.databaseRestartVerified === false && row.production === false && Array.isArray(row.targets) && row.targets.length > 0 && row.targets.length <= 4,
    "MIGRATION_RUNNER_RECEIPT_INVALID", "رسید runner فقط به اثر مستقل دادهٔ موقت و اجرای دوبارهٔ برنامه محدود است.", 409);
  const targets = row.targets.map(value => { const part = object(value); exactKeys(part, ["id", "columnChecks", "rowChecks", "persistenceChecks"]); const id = string(part.id, 32); ensure(/^[a-z][a-z0-9_]{0,31}$/.test(id), "MIGRATION_RUNNER_RECEIPT_INVALID", "شناسهٔ رسید دیتابیس معتبر نیست.", 409);
    return { id, columnChecks: integer(part.columnChecks, 1, 64), rowChecks: integer(part.rowChecks, 0, 16), persistenceChecks: integer(part.persistenceChecks, 1, 8) }; });
  ensure(new Set(targets.map(target => target.id)).size === targets.length, "MIGRATION_RUNNER_RECEIPT_INVALID", "رسید دیتابیس تکراری نیست.", 409);
  return { kind: "disposable_postgres_runner", sourceHash: hash(row.sourceHash), planHash: hash(row.planHash), runnerHash: hash(row.runnerHash), targets, runnerRuns: 2, applicationRuns: 2, replay: "selected_oracles_unchanged", databaseRestartVerified: false, production: false, checkedAt: integer(row.checkedAt, 0, Number.MAX_SAFE_INTEGER) };
}
