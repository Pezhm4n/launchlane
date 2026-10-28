import { createHash } from "node:crypto";
import type { PostgresMigrationTest, PostgresMigrationTestReceipt, MigrationScalar } from "../../contracts/postgres-migration-test.ts";
import { parsePostgresMigrationTestReceipt } from "../../contracts/postgres-migration-test.ts";
import type { SourceFile } from "../workspace/inspect.ts";
import { ensure } from "../errors.ts";
import { fingerprint } from "../policy/action.ts";
import { object } from "../../contracts/validation.ts";
import type { PostgresFixtureBinding, PostgresFixtureSql } from "./postgres-fixture.ts";
import type { CommandResult } from "./container.ts";

/** Lexical boundary for this plain-SQL adapter, not a general SQL parser.
 * No transaction control, psql commands, role/admin changes, functions or quoted identifiers.
 * Other migration formats need their own reviewed adapter; their source is never rewritten here.
 */
export function migrationStatements(sql: string): readonly string[] {
  ensure(!sql.includes("\0") && !/^\s*\\/m.test(sql), "MIGRATION_SQL_UNSUPPORTED", "فرمان psql یا ورودی نامعتبر در migration مجاز نیست.", 409);
  const statements: string[] = []; let words = "", i = 0;
  while (i < sql.length) {
    if (sql.startsWith("--", i)) { const end = sql.indexOf("\n", i + 2); i = end < 0 ? sql.length : end + 1; words += " "; continue; }
    if (sql.startsWith("/*", i)) {
      let depth = 1; i += 2;
      while (i < sql.length && depth) { if (sql.startsWith("/*", i)) { depth++; i += 2; } else if (sql.startsWith("*/", i)) { depth--; i += 2; } else i++; ensure(depth <= 16, "MIGRATION_SQL_UNSUPPORTED", "عمق comment محدود است.", 409); }
      ensure(depth === 0, "MIGRATION_SQL_UNSUPPORTED", "comment کامل نیست.", 409); words += " "; continue;
    }
    if (sql[i] === '"') throwUnsupported();
    if (sql[i] === "'") {
      const escaped = i > 0 && /[eE]/.test(sql[i - 1] ?? "") && (i < 2 || !/[\w$]/.test(sql[i - 2] ?? "")); let closed = false; i++;
      while (i < sql.length) { if (escaped && sql[i] === "\\") i += 2; else if (sql[i] === "'") { i++; if (sql[i] === "'") i++; else { closed = true; break; } } else i++; }
      ensure(closed, "MIGRATION_SQL_UNSUPPORTED", "رشتهٔ SQL کامل نیست.", 409); words += " ? "; continue;
    }
    const dollar = sql[i] === "$" ? /^\$(?:[a-zA-Z_][a-zA-Z0-9_]*)?\$/.exec(sql.slice(i))?.[0] : undefined;
    if (dollar) { const end = sql.indexOf(dollar, i + dollar.length); ensure(end >= 0, "MIGRATION_SQL_UNSUPPORTED", "رشتهٔ SQL کامل نیست.", 409); i = end + dollar.length; words += " ? "; continue; }
    if (sql[i] === ";") { if (words.trim()) statements.push(words.trim().toUpperCase().replace(/\s+/g, " ")); words = ""; i++; continue; }
    words += /[a-zA-Z0-9_.]/.test(sql[i] ?? "") ? sql[i] : " "; i++;
  }
  if (words.trim()) statements.push(words.trim().toUpperCase().replace(/\s+/g, " "));
  ensure(statements.length > 0 && statements.length <= 256 && statements.every(statement =>
    /^(?:CREATE TABLE |ALTER TABLE |DROP TABLE |CREATE (?:UNIQUE )?INDEX |DROP INDEX |CREATE TYPE |ALTER TYPE |DROP TYPE |CREATE SEQUENCE |ALTER SEQUENCE |DROP SEQUENCE |INSERT INTO |UPDATE |DELETE FROM |TRUNCATE )/.test(`${statement} `) &&
    !statement.includes("_LAUNCHLANE") && !/\b(?:PG_CATALOG|INFORMATION_SCHEMA)\./.test(statement)), "MIGRATION_SQL_UNSUPPORTED", "migration باید SQL داده/ساختار محدود باشد؛ فرمان مدیریتی، transaction یا دفتر میزبان مجاز نیست.", 409);
  return statements;
}
function throwUnsupported(): never { ensure(false, "MIGRATION_SQL_UNSUPPORTED", "شناسهٔ quote‌شده در این adapter پشتیبانی نمی‌شود؛ فایل اصلی تغییر داده نشد.", 409); }
export function migrationSource(files: readonly SourceFile[], plan: PostgresMigrationTest) {
  let total = 0;
  return plan.files.map(expected => {
    const file = files.find(file => file.path === expected.path);
    ensure(file && file.content.length <= 65536 && createHash("sha256").update(file.content).digest("hex") === expected.sha256, "MIGRATION_SOURCE_CHANGED", "بایت فایل migration با تصمیم برابر نیست.", 409);
    total += file.content.length; ensure(total <= 262144, "MIGRATION_SOURCE_LIMIT", "مجموع SQL این برش از سقف بررسی بیشتر است.", 409);
    const sql = file.content.toString("utf8"); ensure(Buffer.from(sql).equals(file.content), "MIGRATION_SQL_UNSUPPORTED", "فایل SQL باید UTF-8 معتبر باشد.", 409);
    migrationStatements(sql); return { ...expected, sql };
  });
}
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
const jsonValue = (value: MigrationScalar) => `${literal(JSON.stringify(value))}::jsonb`;
function appliedSql(files: ReturnType<typeof migrationSource>): string {
  return `SELECT pg_catalog.pg_advisory_xact_lock(1746368110,1);\n${files.map(file => `DO ${literal(`DECLARE prior text; BEGIN
SELECT sha256 INTO prior FROM public._launchlane_migrations WHERE path=${literal(file.path)};
IF prior IS NOT NULL THEN IF prior<>${literal(file.sha256)} THEN RAISE EXCEPTION 'migration checksum changed'; END IF;
ELSE EXECUTE ${literal(file.sql)}; INSERT INTO public._launchlane_migrations(path,sha256) VALUES(${literal(file.path)},${literal(file.sha256)}); END IF;
END`)};`).join("\n")}\nSELECT 'launchlane_migration_applied';`;
}
function oracleSql(plan: PostgresMigrationTest): string {
  const columns = plan.columns.map((column, i) => `SELECT ${i} AS i, EXISTS(SELECT 1 FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class c ON c.oid=a.attrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=${literal(column.relation.slice(7))} AND c.relkind IN ('r','p') AND a.attname=${literal(column.name)} AND a.attnum>0 AND NOT a.attisdropped AND pg_catalog.format_type(a.atttypid,a.atttypmod)=${literal(column.type)} AND a.attnotnull=${column.nullable ? "false" : "true"}) AS ok`).join(" UNION ALL ");
  const rows = plan.rows.map((row, i) => `SELECT ${i} AS i, (count(*)=1 AND COALESCE(bool_and(${row.values.map(value => `(pg_catalog.to_jsonb(t)->${literal(value.column)}) IS NOT DISTINCT FROM ${jsonValue(value.value)}`).join(" AND ")}),false)) AS ok FROM ${row.relation} t WHERE (pg_catalog.to_jsonb(t)->${literal(row.key.column)}) IS NOT DISTINCT FROM ${jsonValue(row.key.value)}`).join(" UNION ALL ");
  const persistence = plan.persistence.map((row, i) => `SELECT ${i} AS i, (SELECT count(*)=1 FROM ${row.relation} t WHERE (pg_catalog.to_jsonb(t)->${literal(row.key.column)}) IS NOT DISTINCT FROM ${jsonValue(row.key.value)}) AS present, (SELECT pg_catalog.to_jsonb(t)->${literal(row.column)} FROM ${row.relation} t WHERE (pg_catalog.to_jsonb(t)->${literal(row.key.column)}) IS NOT DISTINCT FROM ${jsonValue(row.key.value)}) AS value`).join(" UNION ALL ");
  return `SELECT pg_catalog.json_build_object('columns',(SELECT json_agg(x ORDER BY i) FROM (${columns}) x),'rows',(SELECT json_agg(x ORDER BY i) FROM (${rows}) x),'persistence',(SELECT json_agg(x ORDER BY i) FROM (${persistence}) x),'files',(SELECT COALESCE(json_agg(x ORDER BY path),'[]'::json) FROM (SELECT path,sha256 FROM public._launchlane_migrations) x));`;
}
function successful(result: CommandResult, code: string) { ensure(result.exitCode === 0 && !result.signal, code, "اجرای migration یا سنجش مستقل داده موفق نبود؛ خروجی source شاهد موفقیت نیست.", 409); }
function verify(result: CommandResult, plan: PostgresMigrationTest): readonly { hash: string; empty: boolean }[] {
  successful(result, "MIGRATION_ORACLE_FAILED"); let raw: unknown;
  try { raw = JSON.parse(result.output.trim()); } catch { ensure(false, "MIGRATION_ORACLE_FAILED", "رسید مستقل SQL معتبر نیست.", 409); }
  const row = object(raw);
  for (const [key, count] of [["columns", plan.columns.length], ["rows", plan.rows.length]] as const) {
    const values = row[key]; ensure(Array.isArray(values) && values.length === count && values.every((value, i) => object(value).i === i && object(value).ok === true), "MIGRATION_ORACLE_FAILED", "schema یا داده با معیار مصوب برابر نیست.", 409);
  }
  ensure(Array.isArray(row.files) && row.files.length === plan.files.length && plan.files.every(file => Array.isArray(row.files) && row.files.filter(value => object(value).path === file.path && object(value).sha256 === file.sha256).length === 1), "MIGRATION_LEDGER_CHANGED", "دفتر migration باید دقیقاً با فایل‌ها و checksumهای مصوب برابر باشد.", 409);
  ensure(Array.isArray(row.persistence) && row.persistence.length === plan.persistence.length, "MIGRATION_PERSISTENCE_FAILED", "سنجش مستقل ردیف‌های ماندگار کامل نیست.", 409);
  return row.persistence.map((value, i) => { const item = object(value);
    ensure(item.i === i && item.present === true && "value" in item && Buffer.byteLength(JSON.stringify(item.value)) <= 4096, "MIGRATION_PERSISTENCE_FAILED", "ردیف ماندگاری یکتا و محدود تأیید نشد.", 409);
    return { hash: fingerprint(item.value), empty: item.value === null };
  });
}
export async function runPostgresMigrationTest<T extends CommandResult>(options: {
  files: readonly SourceFile[]; plan: PostgresMigrationTest; fixture: PostgresFixtureBinding; sql: PostgresFixtureSql; signal: AbortSignal;
  run: () => Promise<T>; take: () => void;
}): Promise<T & { databaseMigration?: PostgresMigrationTestReceipt }> {
  const { plan, fixture, sql, signal } = options;
  ensure(fixture.user === "launchlane_migration_app", "MIGRATION_ROLE_REQUIRED", "migration به role غیر superuser نیاز دارد.", 409);
  const files = migrationSource(options.files, plan), apply = appliedSql(files), oracle = oracleSql(plan);
  options.take(); successful(await sql.apply(apply, signal), "MIGRATION_EXECUTION_FAILED");
  options.take(); const baseline = verify(await sql.read(oracle, signal), plan);
  const first = await options.run(); if (first.exitCode !== 0 || first.signal) return first;
  options.take(); const written = verify(await sql.read(oracle, signal), plan);
  ensure(written.every((value, i) => !value.empty && value.hash !== baseline[i]?.hash), "MIGRATION_APPLICATION_WRITE_UNVERIFIED", "آزمون اصلی باید مقدار تازه‌ای در دیتابیس بنویسد؛ echo یا حافظهٔ برنامه شاهد نوشتن نیست.", 409);
  options.take(); successful(await sql.apply(apply, signal), "MIGRATION_REPLAY_FAILED");
  options.take(); const replayed = verify(await sql.read(oracle, signal), plan);
  ensure(replayed.every((value, i) => !value.empty && value.hash === written[i]?.hash), "MIGRATION_REPLAY_FAILED", "اجرای دوبارهٔ migration داده را تغییر داد؛ برنامهٔ دوم برای پنهان‌کردن این افت اجرا نشد.", 409);
  const second = await options.run(); if (second.exitCode !== 0 || second.signal) return second;
  options.take(); const retained = verify(await sql.read(oracle, signal), plan);
  ensure(retained.every((value, i) => !value.empty && value.hash === written[i]?.hash), "MIGRATION_PERSISTENCE_FAILED", "همان داده پس از اجرای دوبارهٔ برنامه حفظ نشد.", 409);
  return { ...second, databaseMigration: parsePostgresMigrationTestReceipt({ kind: "disposable_postgres_migration", sourceHash: fixture.sourceHash, planHash: fingerprint(plan), files: plan.files,
    columnChecks: plan.columns.length, rowChecks: plan.rows.length, persistenceChecks: plan.persistence.length, applicationRuns: 2, replay: "unchanged", databaseRestartVerified: false, production: false, checkedAt: Date.now() }) };
}
