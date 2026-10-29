import { createHash } from "node:crypto";
import { object } from "../../contracts/validation.ts";
import { runnerScriptName, parsePostgresMigrationRunner, parsePostgresRunnerTestReceipt, type PostgresMigrationRunner, type PostgresRunnerTarget, type PostgresRunnerTestReceipt } from "../../contracts/postgres-runner-test.ts";
import type { DisposableTestDatabase } from "../../contracts/test-database.ts";
import type { SourceFile } from "../workspace/inspect.ts";
import type { PostgresFixtureBinding, PostgresFixtureSql } from "./postgres-fixture.ts";
import type { CommandResult } from "./container.ts";
import { ensure } from "../errors.ts";
import { fingerprint } from "../policy/action.ts";

export function sourceMigrationRunner(files: readonly SourceFile[], scriptValue: unknown): PostgresMigrationRunner {
  const script = runnerScriptName(scriptValue), file = files.find(file => file.path === "package.json");
  ensure(file, "MIGRATION_RUNNER_INVALID", "package.json همان source لازم است.", 409);
  const scripts = object(object(JSON.parse(file.content.toString("utf8"))).scripts);
  ensure(typeof scripts[script] === "string" && scripts[script].trim(), "MIGRATION_RUNNER_INVALID", "script انتخاب‌شده باید در source موجود باشد؛ فرمانی ساخته نمی‌شود.", 409);
  const chain = [`pre${script}`, script, `post${script}`].filter(name => scripts[name] !== undefined).map(name => ({ name, command: scripts[name] }));
  return parsePostgresMigrationRunner({ script, chain, sha256: createHash("sha256").update(JSON.stringify(chain)).digest("hex") });
}
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
const scalar = (column: string) => `COALESCE(pg_catalog.to_jsonb(t."${column}"),'null'::pg_catalog.jsonb)`;
const relation = (value: string) => `public."${value.slice(7)}"`;
const jsonValue = (value: unknown) => `${literal(JSON.stringify(value))}::pg_catalog.jsonb`;
export function runnerSchemaSql(target: PostgresRunnerTarget): string {
  // Resolve only built-in scalar types before reading values. Never serialize the source-owned composite row.
  const checks = target.oracle.columns.map((column, i) => `SELECT ${i} AS i,EXISTS(SELECT 1 FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class c ON c.oid=a.attrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_type ty ON ty.oid=a.atttypid JOIN pg_catalog.pg_namespace tn ON tn.oid=ty.typnamespace WHERE n.nspname='public' AND c.relname=${literal(column.relation.slice(7))} AND c.relkind IN ('r','p') AND a.attname=${literal(column.name)} AND a.attnum>0 AND NOT a.attisdropped AND tn.nspname='pg_catalog' AND ty.typtype='b' AND ty.typelem=0 AND pg_catalog.format_type(a.atttypid,a.atttypmod)=${literal(column.type)} AND a.attnotnull=${column.nullable ? "false" : "true"}) AS ok`).join(" UNION ALL ");
  return `SELECT pg_catalog.json_agg(x ORDER BY i) FROM (${checks}) x;`;
}
export function runnerDataSql(target: PostgresRunnerTarget): string {
  const rows = target.oracle.rows.map((row, i) => `SELECT ${i} AS i,(count(*)=1 AND COALESCE(bool_and(${row.values.map(value => `${scalar(value.column)} IS NOT DISTINCT FROM ${jsonValue(value.value)}`).join(" AND ")}),false)) AS ok FROM ${relation(row.relation)} t WHERE ${scalar(row.key.column)} IS NOT DISTINCT FROM ${jsonValue(row.key.value)}`).join(" UNION ALL ");
  const persistence = target.oracle.persistence.map((row, i) => `SELECT ${i} AS i,(SELECT count(*)=1 FROM ${relation(row.relation)} t WHERE ${scalar(row.key.column)} IS NOT DISTINCT FROM ${jsonValue(row.key.value)}) AS present,(SELECT ${scalar(row.column)} FROM ${relation(row.relation)} t WHERE ${scalar(row.key.column)} IS NOT DISTINCT FROM ${jsonValue(row.key.value)}) AS value`).join(" UNION ALL ");
  return `SELECT pg_catalog.json_build_object('rows',${rows ? `(SELECT pg_catalog.json_agg(x ORDER BY i) FROM (${rows}) x)` : "'[]'::pg_catalog.json"},'persistence',(SELECT pg_catalog.json_agg(x ORDER BY i) FROM (${persistence}) x));`;
}
function parsed(result: CommandResult): unknown {
  ensure(result.exitCode === 0 && !result.signal, "MIGRATION_ORACLE_FAILED", "خواندن مستقل schema یا دادهٔ همان دیتابیس موفق نبود.", 409);
  try { return JSON.parse(result.output.trim()); } catch { ensure(false, "MIGRATION_ORACLE_FAILED", "رسید مستقل داده معتبر نیست.", 409); }
}
type Observed = readonly Readonly<{ id: string; hashes: readonly string[]; empty: readonly boolean[] }>[];
function retained(before: Observed, after: Observed, code: string): void {
  ensure(fingerprint(before) === fingerprint(after), code, "همان داده در تمام دیتابیس‌های مصوب حفظ نشد؛ خروجی موفق runner شاهد این اثر نیست.", 409);
}
export async function runPostgresRunnerTest<T extends CommandResult>(options: {
  files: readonly SourceFile[]; plan: Extract<DisposableTestDatabase, { version: 3 | 4 }>; fixture: PostgresFixtureBinding; sql: PostgresFixtureSql; signal: AbortSignal;
  run: (phase: "runner" | "application") => Promise<T>; take: () => void;
}): Promise<T & { databaseRunner?: PostgresRunnerTestReceipt }> {
  const { plan, fixture, sql, signal, take } = options;
  ensure(fingerprint(sourceMigrationRunner(options.files, plan.runner.script)) === fingerprint(plan.runner), "MIGRATION_RUNNER_CHANGED", "script و hookهای واقعی با تصمیم برابر نیستند.", 409);
  ensure(fixture.targets?.length === plan.targets.length && plan.targets.every((target, index) => { const bound = fixture.targets?.[index]; return bound?.id === target.id && bound.database === `launchlane_target_${index}` && bound.user === `launchlane_app_${index}`; }), "MIGRATION_ROLE_REQUIRED", "اتصال‌های مستقل runner باید متعلق به همین طرح و roleهای محدود باشند.", 409);
  const observe = async (allowAbsent = false): Promise<Observed> => {
    const result = [];
    for (const target of plan.targets) {
      take(); const schema = parsed(await sql.read(runnerSchemaSql(target), signal, target.id));
      ensure(Array.isArray(schema) && schema.length === target.oracle.columns.length && schema.every((value, i) => object(value).i === i && object(value).ok === true), "MIGRATION_ORACLE_FAILED", "ستون‌ها باید نوع داخلی PostgreSQL و schema مصوب داشته باشند؛ مقدار نوع سفارشی خوانده نشد.", 409);
      take(); const data = object(parsed(await sql.read(runnerDataSql(target), signal, target.id)));
      ensure(Array.isArray(data.rows) && data.rows.length === target.oracle.rows.length && data.rows.every((value, i) => object(value).i === i && object(value).ok === true), "MIGRATION_ORACLE_FAILED", "ردیف‌های ثابت دیتابیس با معیار مصوب برابر نیستند.", 409);
      ensure(Array.isArray(data.persistence) && data.persistence.length === target.oracle.persistence.length, "MIGRATION_PERSISTENCE_FAILED", "سنجش ماندگاری همان دیتابیس کامل نیست.", 409);
      const values = data.persistence.map((value, i) => { const item = object(value); ensure(item.i === i && (item.present === true || allowAbsent && item.present === false && item.value === null) && "value" in item && Buffer.byteLength(JSON.stringify(item.value)) <= 4096, "MIGRATION_PERSISTENCE_FAILED", "ردیف ماندگاری باید یکتا و محدود باشد؛ نبود ردیف فقط پیش از اولین اجرای برنامه مجاز است.", 409); return item.value; });
      result.push({ id: target.id, hashes: values.map(fingerprint), empty: values.map(value => value === null) });
    }
    return result;
  };
  take(); const migrated = await options.run("runner"); if (migrated.exitCode !== 0 || migrated.signal) return migrated;
  const baseline = await observe(true);
  take(); const first = await options.run("application"); if (first.exitCode !== 0 || first.signal) return first;
  const written = await observe();
  ensure(written.every((target, index) => target.hashes.every((hash, i) => !target.empty[i] && hash !== baseline[index]?.hashes[i])), "MIGRATION_APPLICATION_WRITE_UNVERIFIED", "آزمون اصلی باید از راه برنامه در هر دیتابیس مقدار تازه بنویسد؛ echo یا seed ثابت کافی نیست.", 409);
  take(); const replay = await options.run("runner"); if (replay.exitCode !== 0 || replay.signal) return replay;
  retained(written, await observe(), "MIGRATION_REPLAY_FAILED");
  take(); const second = await options.run("application"); if (second.exitCode !== 0 || second.signal) return second;
  retained(written, await observe(), "MIGRATION_PERSISTENCE_FAILED");
  return { ...second, databaseRunner: parsePostgresRunnerTestReceipt({ kind: "disposable_postgres_runner", sourceHash: fixture.sourceHash, planHash: fingerprint(plan), runnerHash: plan.runner.sha256,
    targets: plan.targets.map(target => ({ id: target.id, columnChecks: target.oracle.columns.length, rowChecks: target.oracle.rows.length, persistenceChecks: target.oracle.persistence.length })), runnerRuns: 2, applicationRuns: 2, replay: "selected_oracles_unchanged", databaseRestartVerified: false, production: false, checkedAt: Date.now() }) };
}
