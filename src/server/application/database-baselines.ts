import type { Config } from "../config.ts";
import { projectSecretValues } from "../environment/secrets.ts";
import { containsSourceCredential } from "../policy/redaction.ts";
import { createHash, randomUUID } from "node:crypto";
import type { Store } from "../persistence/store.ts";
import { ensure } from "../errors.ts";
import { dataObservationId } from "../../contracts/database-data.ts";
import { parseDatabaseBaseline } from "../../contracts/database-baseline.ts";
import type { ImportedBaseline } from "../../contracts/postgres-bootstrap.ts";
import { string, text } from "../../contracts/validation.ts";
import { extractDatabaseBaseline, inspectDatabaseDump } from "../workspace/database-baseline.ts";
import type { DisposableTestDatabase } from "../../contracts/test-database.ts";

function assertPrivateBaseline(config: Config, store: Store, actor: string, sql: string) {
  const values = [config.liaraToken, config.modelKey, config.operatorToken, config.sessionSecret,
    ...projectSecretValues(store, config.sessionSecret, actor)].filter(Boolean);
  ensure(!containsSourceCredential(sql, values, "schema-baseline.sql"), "SENSITIVE_SOURCE", "ساختار انتخاب‌شده حاوی مقدار خصوصی است؛ ذخیره، نمایش یا اجرای آن مجاز نیست.", 403);
}
function context(store: Store, actor: string, projectId: string) {
  const flow = store.getProjectFlow(actor);
  ensure(flow?.id === dataObservationId(projectId) && flow.status === "ready" && flow.artifact && flow.profile.applicationRequirements?.requirements.some(row => row.kind === "postgresql"),
    "DATABASE_BASELINE_PROJECT_CHANGED", "پروژهٔ PostgreSQL فعال را دوباره انتخاب کنید.", 409);
  return flow;
}
function publicRow(row: Record<string, unknown>) {
  return parseDatabaseBaseline({ id: row.id, path: `baseline-${row.id}.sql`, projectId: row.flow_id, sourceHash: row.source_hash,
    sha256: row.schema_hash, tables: JSON.parse(string(row.tables_json, 4096)), statements: row.statements, createdAt: row.created_at });
}
export function listDatabaseBaselines(config: Config, store: Store, actor: string, projectId: string) {
  const flow = context(store, actor, projectId);
  const rows = store.db.prepare("SELECT * FROM database_baselines WHERE actor_id=? AND flow_id=? AND source_hash=? ORDER BY created_at LIMIT 33").all(actor, flow.id, flow.profile.sourceHash);
  ensure(rows.length <= 32, "DATABASE_BASELINE_LIMIT", "فهرست ساختارها به بررسی بخش‌بندی‌شده نیاز دارد.", 409);
  return rows.map(row => { assertPrivateBaseline(config, store, actor, text(row.sql_text, 65536)); return publicRow(row); });
}
export function previewDatabaseBaseline(config: Config, store: Store, actor: string, projectId: string, input: string) {
  context(store, actor, projectId);
  const tables = inspectDatabaseDump(input);
  for (const table of tables) assertPrivateBaseline(config, store, actor, table);
  return { tables, dataImported: false };
}
export function importDatabaseBaseline(config: Config, store: Store, actor: string, projectId: string, requestKey: string, input: string, tables: readonly string[]) {
  const flow = context(store, actor, projectId), key = dataObservationId(requestKey), selected = extractDatabaseBaseline(input, tables),
    prior = store.db.prepare("SELECT * FROM database_baselines WHERE actor_id=? AND flow_id=? AND request_key=?").get(actor, flow.id, key);
  assertPrivateBaseline(config, store, actor, selected.sql);
  if (prior) {
    ensure(prior.source_hash === flow.profile.sourceHash && prior.schema_hash === selected.sha256 && prior.tables_json === JSON.stringify(selected.tables), "IDEMPOTENCY_CONFLICT", "درخواست قبلی به ساختار دیگری تعلق دارد.", 409);
    return publicRow(prior);
  }
  ensure(listDatabaseBaselines(config, store, actor, projectId).length < 32, "DATABASE_BASELINE_LIMIT", "سقف ساختارهای این پروژه پر شده است.", 409);
  const id = randomUUID(), createdAt = Date.now();
  store.db.prepare("INSERT INTO database_baselines VALUES (?,?,?,?,?,?,?,?,?,?)").run(id, actor, flow.id, flow.profile.sourceHash, key, selected.sql, selected.sha256, JSON.stringify(selected.tables), selected.statements, createdAt);
  return parseDatabaseBaseline({ id, path: `baseline-${id}.sql`, projectId: flow.id, sourceHash: flow.profile.sourceHash, sha256: selected.sha256, tables: selected.tables, statements: selected.statements, createdAt });
}
export function importedBaseline(config: Config, store: Store, actor: string, projectId: string, sourceHash: string, path: string): ImportedBaseline | null {
  const match = /^baseline-([a-f0-9-]{36})\.sql$/.exec(path); if (!match?.[1]) return null;
  const row = store.db.prepare("SELECT * FROM database_baselines WHERE id=? AND actor_id=? AND flow_id=? AND source_hash=?").get(dataObservationId(match[1]), actor, projectId, sourceHash);
  ensure(row, "DATABASE_BASELINE_SCOPE_CHANGED", "ساختار واردشده متعلق به همین پروژه و نسخه نیست.", 409);
  const sql = text(row.sql_text, 65536), sha256 = string(row.schema_hash, 64);
  ensure(createHash("sha256").update(sql).digest("hex") === sha256, "DATABASE_BASELINE_CHANGED", "بایت‌های ساختار واردشده تغییر کرده‌اند.", 409);
  assertPrivateBaseline(config, store, actor, sql);
  return { id: match[1], sql, sha256 };
}
export function assertBaselineImports(config: Config, store: Store, actor: string, projectId: string, sourceHash: string, plan: DisposableTestDatabase | undefined) {
  if (plan?.version !== 3 && plan?.version !== 4) return;
  for (const target of plan.targets) for (const expected of target.bootstrap?.imports ?? []) {
    const current = importedBaseline(config, store, actor, projectId, sourceHash, `baseline-${expected.id}.sql`);
    ensure(current?.sha256 === expected.sha256 && current.sql === expected.sql, "DATABASE_BASELINE_CHANGED", "ساختار اولیه با همان تصمیم آزمون برابر نیست.", 409);
  }
}
