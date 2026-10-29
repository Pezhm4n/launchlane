import { exactKeys, hash, integer, object, string } from "./validation.ts";
import { ensure } from "../server/errors.ts";
import { providerObjectId } from "./provision.ts";

export function dataObservationId(value: unknown): string {
  const id = string(value, 36);
  ensure(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id), "INVALID_INPUT", "شناسهٔ بررسی داده معتبر نیست.");
  return id;
}
export type DatabaseDataTargetObservation = Readonly<{
  id: string; databaseId: string; serverMajor: number; columnChecks: number; rowChecks: number; persistenceChecks: number;
  schemaMatches: boolean; rowsMatch: boolean; persistencePresent: boolean; persistenceNonNull: boolean;
}>;
export type DatabaseDataObservation = Readonly<{
  id: string; actionId: string; releaseId: string; artifactHash: string; checkedAt: number;
  outcome: "verified" | "failed"; targets: readonly DatabaseDataTargetObservation[];
  baselineId: string | null; comparison: "not_requested" | "not_comparable" | "same_selected_values" | "selected_values_changed";
  migrationVerified: false; applicationWriteVerified: false; restartPersistenceVerified: false; remoteChanges: false;
}>;
export function parseDatabaseDataObservation(value: unknown): DatabaseDataObservation {
  const row = object(value);
  exactKeys(row, ["id", "actionId", "releaseId", "artifactHash", "checkedAt", "outcome", "targets", "baselineId", "comparison",
    "migrationVerified", "applicationWriteVerified", "restartPersistenceVerified", "remoteChanges"]);
  ensure(Array.isArray(row.targets) && row.targets.length > 0 && row.targets.length <= 4 && (row.outcome === "verified" || row.outcome === "failed") &&
    row.migrationVerified === false && row.applicationWriteVerified === false && row.restartPersistenceVerified === false && row.remoteChanges === false,
    "DATABASE_DATA_INVALID", "رسید فقط اتصال و معیارهای خوانده‌شدهٔ داده را پوشش می‌دهد.", 409);
  const targets = row.targets.map(value => {
    const part = object(value); exactKeys(part, ["id", "databaseId", "serverMajor", "columnChecks", "rowChecks", "persistenceChecks", "schemaMatches", "rowsMatch", "persistencePresent", "persistenceNonNull"]);
    const id = string(part.id, 32);
    ensure(/^[a-z][a-z0-9_]{0,31}$/.test(id) && typeof part.schemaMatches === "boolean" && typeof part.rowsMatch === "boolean" &&
      typeof part.persistencePresent === "boolean" && typeof part.persistenceNonNull === "boolean", "DATABASE_DATA_INVALID", "رسید سنجش دیتابیس معتبر نیست.", 409);
    return { id, databaseId: providerObjectId(part.databaseId), serverMajor: integer(part.serverMajor, 10, 99),
      columnChecks: integer(part.columnChecks, 1, 64), rowChecks: integer(part.rowChecks, 0, 16), persistenceChecks: integer(part.persistenceChecks, 0, 8),
      schemaMatches: part.schemaMatches, rowsMatch: part.rowsMatch, persistencePresent: part.persistencePresent, persistenceNonNull: part.persistenceNonNull };
  });
  const healthy = targets.every(target => target.schemaMatches && target.rowsMatch && target.persistencePresent && target.persistenceNonNull && target.persistenceChecks > 0);
  ensure(new Set(targets.map(target => target.id)).size === targets.length && new Set(targets.map(target => target.databaseId)).size === targets.length &&
    row.outcome === (healthy ? "verified" : "failed") &&
    (row.baselineId === null ? row.comparison === "not_requested" : row.comparison === "not_comparable" || healthy && (row.comparison === "same_selected_values" || row.comparison === "selected_values_changed")),
    "DATABASE_DATA_INVALID", "نتیجهٔ داده باید از همهٔ معیارها به دست آید.", 409);
  const comparison = row.comparison;
  ensure(comparison === "not_requested" || comparison === "not_comparable" || comparison === "same_selected_values" || comparison === "selected_values_changed", "DATABASE_DATA_INVALID", "مقایسهٔ داده معتبر نیست.", 409);
  return { id: dataObservationId(row.id), actionId: dataObservationId(row.actionId), releaseId: string(row.releaseId, 128), artifactHash: hash(row.artifactHash),
    checkedAt: integer(row.checkedAt, 0, Number.MAX_SAFE_INTEGER), outcome: row.outcome, targets, baselineId: row.baselineId === null ? null : dataObservationId(row.baselineId),
    comparison, migrationVerified: false, applicationWriteVerified: false, restartPersistenceVerified: false, remoteChanges: false };
}
export type DatabaseDataState = Readonly<{ available: boolean; enabled: boolean; latest: DatabaseDataObservation | null }>;
export function parseDatabaseDataState(value: unknown): DatabaseDataState {
  const row = object(value); exactKeys(row, ["available", "enabled", "latest"]);
  ensure(typeof row.available === "boolean" && typeof row.enabled === "boolean", "DATABASE_DATA_INVALID", "وضعیت بررسی داده معتبر نیست.", 409);
  return { available: row.available, enabled: row.enabled, latest: row.latest === null ? null : parseDatabaseDataObservation(row.latest) };
}
