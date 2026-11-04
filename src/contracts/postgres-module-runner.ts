import { applicationSourcePath } from "./application-requirements.ts";
import { exactKeys, hash, object, string } from "./validation.ts";
import { ensure } from "../server/errors.ts";

type Scalar = string | number | boolean | null;
export type MigrationModuleInput = Readonly<{
  path: string; exportName: string; poolProperty: string;
  targets: readonly Readonly<{ id: string; arguments: Readonly<Record<string, Scalar | readonly Scalar[]>> }>[];
}>;
export type MigrationModule = MigrationModuleInput & Readonly<{
  sourceHash: string; loader: "node" | "tsx"; tsconfig?: Readonly<{ path: string; sha256: string }>;
}>;
export function moduleIdentifier(value: unknown): string {
  const name = string(value, 64);
  ensure(/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) && !["__proto__", "prototype", "constructor"].includes(name), "MIGRATION_MODULE_INVALID", "نام تابع و گزینه باید محدود و صریح باشد.", 409);
  return name;
}
export function parseMigrationModuleInput(value: unknown): MigrationModuleInput {
  const row = object(value); exactKeys(row, ["path", "exportName", "poolProperty", "targets"]);
  const path = applicationSourcePath(row.path), exportName = moduleIdentifier(row.exportName), poolProperty = moduleIdentifier(row.poolProperty);
  ensure(/\.[cm]?[jt]s$/.test(path) && !path.split("/").some(part => part.startsWith(".") || part === "node_modules"), "MIGRATION_MODULE_INVALID", "ماژول باید فایل عمومی source باشد.", 409);
  ensure(Array.isArray(row.targets) && row.targets.length > 0 && row.targets.length <= 4, "MIGRATION_MODULE_INVALID", "آرگومان هر دیتابیس لازم است.", 409);
  const scalar = (value: unknown): Scalar => {
    ensure(value === null || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER || typeof value === "string" && /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(value), "MIGRATION_MODULE_INVALID", "فقط literal محدود؛ بدون SQL، مسیر یا مقدار اتصال، پذیرفته می‌شود.", 409);
    return value;
  };
  const targets = row.targets.map(value => {
    const target = object(value); exactKeys(target, ["id", "arguments"]); const id = string(target.id, 32), args = object(target.arguments);
    ensure(/^[a-z][a-z0-9_]{0,31}$/.test(id) && Object.keys(args).length <= 8 && !Object.hasOwn(args, poolProperty), "MIGRATION_MODULE_INVALID", "آرگومان نمی‌تواند اتصال میزبان را جایگزین کند.", 409);
    const entries = Object.entries(args).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, value]) => {
      moduleIdentifier(key);
      if (!Array.isArray(value)) return [key, scalar(value)] as const;
      ensure(value.length > 0 && value.length <= 16, "MIGRATION_MODULE_INVALID", "آرایهٔ آرگومان باید محدود باشد.", 409);
      return [key, value.map(scalar)] as const;
    });
    return { id, arguments: Object.fromEntries(entries) };
  });
  ensure(new Set(targets.map(target => target.id)).size === targets.length, "MIGRATION_MODULE_INVALID", "هدف تکراری مجاز نیست.", 409);
  return { path, exportName, poolProperty, targets };
}
export function parseMigrationModule(value: unknown): MigrationModule {
  const row = object(value); exactKeys(row, ["path", "exportName", "poolProperty", "targets", "sourceHash", "loader", "tsconfig"]);
  const input = parseMigrationModuleInput({ path: row.path, exportName: row.exportName, poolProperty: row.poolProperty, targets: row.targets });
  ensure(row.loader === "node" || row.loader === "tsx", "MIGRATION_MODULE_INVALID", "loader باید از source بیاید.", 409);
  const config = row.tsconfig === undefined ? undefined : (() => {
    const part = object(row.tsconfig); exactKeys(part, ["path", "sha256"]); const path = applicationSourcePath(part.path);
    ensure(row.loader === "tsx" && path.endsWith(".json"), "MIGRATION_MODULE_INVALID", "پیکربندی TypeScript معتبر نیست.", 409);
    return { path, sha256: hash(part.sha256) };
  })();
  ensure(!/\.[cm]?ts$/.test(input.path) || row.loader === "tsx", "MIGRATION_MODULE_INVALID", "TypeScript به loader موجود پروژه نیاز دارد.", 409);
  return { ...input, sourceHash: hash(row.sourceHash), loader: row.loader, ...(config ? { tsconfig: config } : {}) };
}
