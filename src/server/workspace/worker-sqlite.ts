import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { parseWorkerSqliteAdapter, workerSourcePath, type WorkerSqliteAdapter } from "../../contracts/worker-sqlite.ts";
import { object } from "../../contracts/validation.ts";
import { ensure } from "../errors.ts";
import { parseApplicationJsonc } from "./application-requirements.ts";
import { workerSqliteBuild, workerSqliteFiles, workerSqlitePaths, workerSqliteProgramHash } from "../agent/worker-sqlite-programs.ts";
import type { SourceFile } from "./inspect.ts";

type Ast = Record<string, unknown> & { type: string };
const parser: unknown = createRequire(import.meta.url)("next/dist/compiled/babel/parser.js");
function node(value: unknown): value is Ast { return !!value && typeof value === "object" && !Array.isArray(value) && "type" in value && typeof value.type === "string"; }
function property(value: unknown): string | null {
  return node(value) && value.type === "Identifier" && typeof value.name === "string" ? value.name
    : node(value) && value.type === "StringLiteral" && typeof value.value === "string" ? value.value : null;
}
function environmentNames(source: SourceFile): string[] {
  ensure(parser && typeof parser === "object" && "parse" in parser && typeof parser.parse === "function", "WORKER_SOURCE_INVALID", "بررسی‌کنندهٔ Worker آماده نیست.", 409);
  const root: unknown = parser.parse(source.content.toString("utf8"), { sourceType: "module", plugins: ["typescript"] });
  const pending: unknown[] = [root], names = new Set<string>();let count = 0;
  while (pending.length) {
    const current = pending.pop();if (!node(current)) continue;
    ensure(++count <= 100000, "WORKER_SOURCE_INVALID", "بررسی Worker از سقف مجاز بزرگ‌تر است.", 409);
    if (["MemberExpression", "OptionalMemberExpression"].includes(current.type) && node(current.object) &&
      ["MemberExpression", "OptionalMemberExpression"].includes(current.object.type) && property(current.object.property) === "env") {
      const key = property(current.property);
      ensure(key && /^[A-Za-z_][A-Za-z0-9_]*$/.test(key), "WORKER_BINDING_UNSUPPORTED", "نام binding پویا به بازبینی مستقل نیاز دارد.", 409);names.add(key);
    }
    for (const [key, child] of Object.entries(current)) {
      if (["loc", "extra", "comments", "leadingComments", "trailingComments", "typeAnnotation", "typeParameters", "typeArguments"].includes(key)) continue;
      if (node(child)) pending.push(child);else if (Array.isArray(child)) pending.push(...child.filter(node));
    }
  }
  return [...names].sort();
}
/** Narrow source-only candidate: one Hono Worker, one D1 binding and Vite SPA assets.
 * Remote D1 identity/data is never opened or substituted during this inspection.
 */
export function inspectWorkerSqlite(pkg: Record<string, unknown>, files: readonly SourceFile[]): WorkerSqliteAdapter | undefined {
  const deps = { ...object(pkg.dependencies ?? {}), ...object(pkg.devDependencies ?? {}) };
  if (!deps.hono || !deps.vite || !(deps.react || deps.vue)) return undefined;
  const configs = files.filter(file => /^wrangler\.jsonc?$/.test(file.path));if (configs.length !== 1) return undefined;
  const file = configs[0];if (!file) return undefined;
  const config = object(parseApplicationJsonc(file.content.toString("utf8")));
  const allowed = ["$schema", "name", "main", "compatibility_date", "assets", "d1_databases"];
  ensure(Object.keys(config).every(key => allowed.includes(key)), "WORKER_BINDING_UNSUPPORTED", "این تبدیل فقط Worker و D1 و assets مشخص را پوشش می‌دهد؛ binding یا تنظیم دیگر نیازمند برنامهٔ مستقل است.", 409);
  const workerEntry = workerSourcePath(config.main), source = files.find(file => file.path === workerEntry);
  ensure(source && /\.[cm]?[jt]s$/.test(workerEntry), "WORKER_SOURCE_INVALID", "فایل Worker در source موجود نیست.", 409);
  // Workers without a bound SPA are still inspectable; this adapter does not cover them.
  if (config.assets === undefined) return undefined;
  ensure(Array.isArray(config.d1_databases) && config.d1_databases.length === 1, "WORKER_BINDING_UNSUPPORTED", "این تبدیل فقط یک binding دیتابیس مشخص را می‌پذیرد.", 409);
  const database = object(config.d1_databases[0]), assets = object(config.assets), databaseBinding = database.binding, assetsBinding = assets.binding;
  ensure(Object.keys(database).every(key => ["binding", "database_name", "database_id", "migrations_dir"].includes(key)) &&
    Object.keys(assets).every(key => ["directory", "binding", "not_found_handling", "run_worker_first"].includes(key)),
    "WORKER_BINDING_UNSUPPORTED", "تنظیم اضافی D1 یا assets باید جداگانه پشتیبانی و آزموده شود.", 409);
  const build = object(pkg.scripts ?? {}).build, preparedBuild = files.some(file => file.path === workerSqlitePaths.descriptor) && (build === workerSqliteBuild || build === "node .launchlane-build.cjs");
  ensure((assets.directory === "./dist" || assets.directory === "dist") && assets.not_found_handling === "single-page-application" && (build === "vite build" || preparedBuild),
    "WORKER_ASSETS_UNSUPPORTED", "مسیر assets و فرمان ساخت Worker باید مشخص و سازگار باشند.", 409);
  const migrationsDirectory = workerSourcePath(database.migrations_dir ?? "migrations");
  ensure(files.some(file => file.path.startsWith(`${migrationsDirectory}/`) && /^\d{4}_[A-Za-z0-9_-]+\.sql$/.test(file.path.slice(migrationsDirectory.length + 1))),
    "WORKER_MIGRATIONS_REQUIRED", "migrationهای همین نسخه باید در source حاضر باشند.", 409);
  return parseWorkerSqliteAdapter({ version: 1, kind: "worker-sqlite", nodeVersion: "24", workerEntry, databaseBinding, assetsBinding, migrationsDirectory,
    requiredEnvironmentKeys: environmentNames(source).filter(key => key !== databaseBinding && key !== assetsBinding),
    configHash: createHash("sha256").update(file.content).digest("hex"), programHash: workerSqliteProgramHash });
}
export function preparedWorkerSqlite(pkg: Record<string, unknown>, files: readonly SourceFile[]): WorkerSqliteAdapter | undefined {
  const descriptor = files.find(file => file.path === workerSqlitePaths.descriptor);if (!descriptor) return undefined;
  const declared = parseWorkerSqliteAdapter(JSON.parse(descriptor.content.toString("utf8"))), detected = inspectWorkerSqlite(pkg, files);
  ensure(detected && JSON.stringify(declared) === JSON.stringify(detected), "WORKER_PREPARATION_CHANGED", "مشخصات Worker با source و برنامهٔ میزبان برابر نیستند.", 409);
  for (const [path, content] of workerSqliteFiles(detected)) ensure(files.find(file => file.path === path)?.content.equals(content),
    "WORKER_PREPARATION_CHANGED", "فایل آماده‌شدهٔ Worker تغییر کرده است؛ رسید قبلی قابل استفاده نیست.", 409);
  return detected;
}
