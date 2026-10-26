import { exactKeys, hash, object, string } from "./validation.ts";
import { ensure } from "../server/errors.ts";

export type WorkerSqliteAdapter = Readonly<{
  version: 1; kind: "worker-sqlite"; nodeVersion: "24";
  workerEntry: string; databaseBinding: string; assetsBinding: string; migrationsDirectory: string;
  requiredEnvironmentKeys: readonly string[]; configHash: string; programHash: string;
}>;
export function workerSourcePath(value: unknown): string {
  const path = string(value, 240);
  ensure(path.split("/").every(part => /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(part) && part !== "." && part !== "..") && path.split("/").length <= 10,
    "WORKER_SOURCE_INVALID", "مسیر Worker باید نسبی و داخل همان پروژه باشد.", 409);
  return path;
}
export function parseWorkerSqliteAdapter(value: unknown): WorkerSqliteAdapter {
  const row = object(value);
  exactKeys(row, ["version", "kind", "nodeVersion", "workerEntry", "databaseBinding", "assetsBinding", "migrationsDirectory", "requiredEnvironmentKeys", "configHash", "programHash"]);
  const name = (value: unknown) => { const name = string(value, 128);ensure(/^[A-Za-z_][A-Za-z0-9_]*$/.test(name), "WORKER_SOURCE_INVALID", "نام binding معتبر نیست.", 409);return name; };
  ensure(row.version === 1 && row.kind === "worker-sqlite" && row.nodeVersion === "24" && Array.isArray(row.requiredEnvironmentKeys) && row.requiredEnvironmentKeys.length <= 32,
    "WORKER_SOURCE_INVALID", "قرارداد سازگاری Worker معتبر نیست.", 409);
  const requiredEnvironmentKeys = row.requiredEnvironmentKeys.map(name), databaseBinding = name(row.databaseBinding), assetsBinding = name(row.assetsBinding);
  ensure(databaseBinding !== assetsBinding && new Set(requiredEnvironmentKeys).size === requiredEnvironmentKeys.length && !requiredEnvironmentKeys.includes(databaseBinding) && !requiredEnvironmentKeys.includes(assetsBinding),
    "WORKER_SOURCE_INVALID", "نام binding یا تنظیمات تکراری است.", 409);
  return { version: 1, kind: "worker-sqlite", nodeVersion: "24", workerEntry: workerSourcePath(row.workerEntry), databaseBinding, assetsBinding,
    migrationsDirectory: workerSourcePath(row.migrationsDirectory), requiredEnvironmentKeys, configHash: hash(row.configHash), programHash: hash(row.programHash) };
}
