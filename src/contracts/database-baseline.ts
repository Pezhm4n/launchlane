import { dataObservationId } from "./database-data.ts";
import { exactKeys, hash, integer, object, string } from "./validation.ts";
import { ensure } from "../server/errors.ts";
export type DatabaseBaseline = Readonly<{ id: string; path: string; projectId: string; sourceHash: string; sha256: string; tables: readonly string[]; statements: number; createdAt: number }>;
export function parseDatabaseBaseline(value: unknown): DatabaseBaseline {
  const row = object(value); exactKeys(row, ["id", "path", "projectId", "sourceHash", "sha256", "tables", "statements", "createdAt"]);
  const id = dataObservationId(row.id);
  ensure(row.path === `baseline-${id}.sql` && Array.isArray(row.tables) && row.tables.length > 0 && row.tables.length <= 8 && row.tables.every(table => typeof table === "string" && /^public\.[a-z_][a-z0-9_]{0,62}$/.test(table)), "DATABASE_BASELINE_INVALID", "رسید ساختار اولیه معتبر نیست.", 409);
  return { id, path: row.path, projectId: dataObservationId(row.projectId), sourceHash: hash(row.sourceHash), sha256: hash(row.sha256), tables: row.tables.map(table => string(table, 70)), statements: integer(row.statements, 1, 256), createdAt: integer(row.createdAt, 0, Number.MAX_SAFE_INTEGER) };
}
