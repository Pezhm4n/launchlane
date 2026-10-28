import { exactKeys, hash, integer, object, string } from "./validation.ts";
import { applicationSourcePath } from "./application-requirements.ts";
import { ensure } from "../server/errors.ts";

export type MigrationScalar = string | number | boolean | null;
export type PostgresMigrationTest = Readonly<{
  files: readonly Readonly<{ path: string; sha256: string }>[];
  columns: readonly Readonly<{ relation: string; name: string; type: string; nullable: boolean }>[];
  rows: readonly Readonly<{ relation: string; key: Readonly<{ column: string; value: MigrationScalar }>; values: readonly Readonly<{ column: string; value: MigrationScalar }>[] }>[];
  persistence: readonly Readonly<{ relation: string; key: Readonly<{ column: string; value: MigrationScalar }>; column: string }>[];
}>;
export function migrationIdentifier(value: unknown): string {
  const name = string(value, 63);
  ensure(/^[a-z_][a-z0-9_]*$/.test(name) && !name.startsWith("_launchlane"), "MIGRATION_ORACLE_INVALID", "نام ستون سنجش معتبر نیست.", 409); return name;
}
export function migrationRelation(value: unknown): string {
  const name = string(value, 70); ensure(/^public\.[a-z_][a-z0-9_]{0,62}$/.test(name) && !name.startsWith("public._launchlane"), "MIGRATION_ORACLE_INVALID", "جدول سنجش باید در schema عمومی دادهٔ ساختگی باشد.", 409); return name;
}
function scalar(value: unknown): MigrationScalar {
  ensure(value === null || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 1e12 ||
    typeof value === "string" && value.length <= 256 && !value.includes("\0"), "MIGRATION_ORACLE_INVALID", "مقدار سنجش داده باید scalar محدود و ساختگی باشد.", 409);
  return value;
}
function rowValue(value: unknown) {
  const row = object(value); exactKeys(row, ["column", "value"]); const column = migrationIdentifier(row.column);
  ensure(!/(?:password|secret|token|authorization|api_?key)/i.test(column), "MIGRATION_ORACLE_INVALID", "مقادیر محرمانه موضوع سنجش ردیف نیستند.", 409);
  return { column, value: scalar(row.value) };
}
export function parsePostgresMigrationTest(value: unknown): PostgresMigrationTest {
  const row = object(value); exactKeys(row, ["files", "columns", "rows", "persistence"]);
  ensure(Array.isArray(row.files) && row.files.length > 0 && row.files.length <= 16 && Array.isArray(row.columns) && row.columns.length > 0 && row.columns.length <= 64 &&
    Array.isArray(row.rows) && row.rows.length > 0 && row.rows.length <= 16 && Array.isArray(row.persistence) && row.persistence.length > 0 && row.persistence.length <= 8, "MIGRATION_ORACLE_INVALID", "فایل‌ها، schema، داده و ستونِ ماندگار آزمون باید مشخص و محدود باشند.", 409);
  const files = row.files.map(value => { const item = object(value); exactKeys(item, ["path", "sha256"]); const path = applicationSourcePath(item.path);
    ensure(/\.sql$/.test(path) && path.length <= 256, "MIGRATION_SOURCE_INVALID", "فایل migration باید SQL همین source باشد.", 409); return { path, sha256: hash(item.sha256) }; });
  const columns = row.columns.map(value => { const item = object(value); exactKeys(item, ["relation", "name", "type", "nullable"]); const type = string(item.type, 80);
    ensure(/^[a-z][a-z0-9 ,()[\]]*$/.test(type) && typeof item.nullable === "boolean", "MIGRATION_ORACLE_INVALID", "نوع و nullable ستون باید صریح باشند.", 409);
    return { relation: migrationRelation(item.relation), name: migrationIdentifier(item.name), type, nullable: item.nullable }; });
  const rows = row.rows.map(value => { const item = object(value); exactKeys(item, ["relation", "key", "values"]);
    ensure(Array.isArray(item.values) && item.values.length > 0 && item.values.length <= 8, "MIGRATION_ORACLE_INVALID", "مقادیر مورد انتظار ردیف لازم‌اند.", 409);
    const values = item.values.map(rowValue); ensure(new Set(values.map(value => value.column)).size === values.length, "MIGRATION_ORACLE_INVALID", "ستون ردیف تکراری نیست.", 409);
    return { relation: migrationRelation(item.relation), key: rowValue(item.key), values }; });
  const persistence = row.persistence.map(value => { const item = object(value); exactKeys(item, ["relation", "key", "column"]); const column = migrationIdentifier(item.column);
    ensure(!/(?:password|secret|token|authorization|api_?key)/i.test(column), "MIGRATION_ORACLE_INVALID", "ستون محرمانه موضوع سنجش ماندگاری نیست.", 409);
    const relation = migrationRelation(item.relation), key = rowValue(item.key);
    ensure(columns.some(item => item.relation === relation && item.name === column) && columns.some(item => item.relation === relation && item.name === key.column), "MIGRATION_ORACLE_INVALID", "ردیف ماندگاری باید به schema مصوب متصل باشد.", 409);
    return { relation, key, column }; });
  ensure(persistence.every(target => !rows.some(row => row.relation === target.relation && row.key.column === target.key.column && row.key.value === target.key.value && row.values.some(value => value.column === target.column))),
    "MIGRATION_PERSISTENCE_CONFLICT", "ستونِ persistence باید با نوشتن برنامه تغییر کند؛ همان ستون را در rows با مقدار ثابت، حتی null، قرار ندهید. rows معیار مقادیر ثابت مثل شناسه و عنوان است؛ میزبان مقدار اولیهٔ ستون ماندگار را جداگانه می‌خواند و تغییر واقعی آن را می‌سنجد. معیار نوشتن و ماندگاری را حذف نکنید.", 409);
  ensure(new Set(files.map(file => file.path.toLowerCase())).size === files.length &&
    new Set(columns.map(column => `${column.relation}.${column.name}`)).size === columns.length &&
    new Set(rows.map(row => JSON.stringify([row.relation, row.key]))).size === rows.length && new Set(persistence.map(row => JSON.stringify([row.relation, row.key, row.column]))).size === persistence.length &&
    rows.every(item => columns.some(column => column.relation === item.relation && column.name === item.key.column) && item.values.every(value => columns.some(column => column.relation === item.relation && column.name === value.column))),
    "MIGRATION_ORACLE_INVALID", "ترتیب فایل‌ها، یکتایی ستون‌ها و اتصال سنجش ردیف به schema باید مشخص باشند.", 409);
  return { files, columns, rows, persistence };
}
export type PostgresMigrationTestReceipt = Readonly<{
  kind: "disposable_postgres_migration"; sourceHash: string; planHash: string; files: PostgresMigrationTest["files"];
  columnChecks: number; rowChecks: number; persistenceChecks: number; applicationRuns: 2; replay: "unchanged"; databaseRestartVerified: false; production: false; checkedAt: number;
}>;
export function parsePostgresMigrationTestReceipt(value: unknown): PostgresMigrationTestReceipt {
  const row = object(value); exactKeys(row, ["kind", "sourceHash", "planHash", "files", "columnChecks", "rowChecks", "persistenceChecks", "applicationRuns", "replay", "databaseRestartVerified", "production", "checkedAt"]);
  ensure(row.kind === "disposable_postgres_migration" && row.applicationRuns === 2 && row.replay === "unchanged" && row.databaseRestartVerified === false && row.production === false && Array.isArray(row.files) && row.files.length > 0 && row.files.length <= 16,
    "MIGRATION_RECEIPT_INVALID", "رسید migration فقط به دیتابیس موقت و اجرای دوبارهٔ برنامه محدود است.", 409);
  return { kind: "disposable_postgres_migration", sourceHash: hash(row.sourceHash), planHash: hash(row.planHash), files: row.files.map(value => { const item = object(value); exactKeys(item, ["path", "sha256"]); return { path: applicationSourcePath(item.path), sha256: hash(item.sha256) }; }),
    columnChecks: integer(row.columnChecks, 1, 64), rowChecks: integer(row.rowChecks, 1, 16), persistenceChecks: integer(row.persistenceChecks, 1, 8), applicationRuns: 2, replay: "unchanged", databaseRestartVerified: false, production: false, checkedAt: integer(row.checkedAt, 0, Number.MAX_SAFE_INTEGER) };
}
