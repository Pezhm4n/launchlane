import { exactKeys, hash, integer, object, string } from "./validation.ts";
import { ensure } from "../server/errors.ts";
import { parseWorkerSqliteAdapter, type WorkerSqliteAdapter } from "./worker-sqlite.ts";

export type FullstackInspection = Readonly<{
  kind: "node-fullstack";
  frontend: "react" | "vue";
  outputDirectory: string;
  backendScript: string | null;
  entryFile: string | null;
  startCommand: string | null;
  packageRoots: readonly string[];
  publicEnvironmentKeys: readonly string[];
  privateEnvironmentKeys: readonly string[];
  requiresPreparation: boolean;
  workerSqlite?: WorkerSqliteAdapter;
}>;
export function fullstackPath(value: unknown): string {
  const path = string(value, 240);
  ensure(path.split("/").every(part => /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(part) && part !== "." && part !== "..") && path.split("/").length <= 10,
    "FULLSTACK_PATH_INVALID", "مسیر بخش برنامه باید داخل همین پروژه باشد.", 409);
  return path;
}
export function parseFullstackInspection(value: unknown): FullstackInspection {
  const row = object(value);
  exactKeys(row, ["kind", "frontend", "outputDirectory", "backendScript", "entryFile", "startCommand", "packageRoots", "publicEnvironmentKeys", "privateEnvironmentKeys", "requiresPreparation", "workerSqlite"]);
  ensure(row.kind === "node-fullstack" && (row.frontend === "react" || row.frontend === "vue") && typeof row.requiresPreparation === "boolean" &&
    Array.isArray(row.packageRoots) && row.packageRoots.length > 0 && row.packageRoots.length <= 16,
    "FULLSTACK_PROFILE_INVALID", "ساختار بخش‌های برنامه معتبر نیست.", 409);
  const names = (value: unknown) => {
    ensure(Array.isArray(value) && value.length <= 128 && value.every(key => typeof key === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(key)), "FULLSTACK_PROFILE_INVALID", "نام تنظیمات معتبر نیست.", 409);
    return value.map(key => string(key, 256));
  };
  const packageRoots = row.packageRoots.map(path => path === "." ? "." : fullstackPath(path));
  ensure(new Set(packageRoots).size === packageRoots.length && packageRoots[0] === ".", "FULLSTACK_PROFILE_INVALID", "ریشه‌های بسته تکراری یا نامعتبر هستند.", 409);
  return { kind: "node-fullstack", frontend: row.frontend, outputDirectory: fullstackPath(row.outputDirectory),
    backendScript: row.backendScript === null ? null : string(row.backendScript, 80), entryFile: row.entryFile === null ? null : fullstackPath(row.entryFile),
    startCommand: row.startCommand === null ? null : string(row.startCommand, 1000), packageRoots,
    publicEnvironmentKeys: names(row.publicEnvironmentKeys), privateEnvironmentKeys: names(row.privateEnvironmentKeys), requiresPreparation: row.requiresPreparation,
    ...(row.workerSqlite === undefined ? {} : { workerSqlite: parseWorkerSqliteAdapter(row.workerSqlite) }) };
}
export type FullstackPreparation = Readonly<{
  version: 2; entryFile: string; backendScript: string; startCommand: string; buildCommand: string;
  port: number; nodeVersion: "22" | "24"; outputDirectory: string; packageRoots: readonly string[];
  outputPolicy: "compiled-v1";
  testScripts: readonly string[];
  workerSqlite?: WorkerSqliteAdapter;
}>;
export function parseFullstackPreparation(value: unknown): FullstackPreparation {
  const row = object(value);
  exactKeys(row, ["version", "entryFile", "backendScript", "startCommand", "buildCommand", "port", "nodeVersion", "outputDirectory", "packageRoots", "outputPolicy", "testScripts", "workerSqlite"]);
  ensure(row.version === 2 && row.outputPolicy === "compiled-v1" && (row.nodeVersion === "22" || row.nodeVersion === "24") && Array.isArray(row.packageRoots) && row.packageRoots.length > 0 && row.packageRoots.length <= 16,
    "FULLSTACK_PREPARATION_INVALID", "برنامهٔ آماده‌سازی کامل معتبر نیست.", 409);
  const backendScript = string(row.backendScript, 80);
  ensure(/^[A-Za-z][A-Za-z0-9:_-]*$/.test(backendScript), "FULLSTACK_PREPARATION_INVALID", "نام فرمان سرور معتبر نیست.", 409);
  ensure(Array.isArray(row.testScripts) && row.testScripts.length <= 8 && row.testScripts.every(name => typeof name === "string" && /^test(?::[A-Za-z0-9_-]+)*$/.test(name) && name.length <= 80),
    "FULLSTACK_TEST_SCOPE", "نام آزمون‌های موجود باید صریح و محدود باشد.", 409);
  return { version: 2, entryFile: fullstackPath(row.entryFile), backendScript, startCommand: string(row.startCommand, 1000), buildCommand: string(row.buildCommand, 1000),
    port: integer(row.port, 1, 65535), nodeVersion: row.nodeVersion, outputDirectory: fullstackPath(row.outputDirectory),
    packageRoots: row.packageRoots.map(path => path === "." ? "." : fullstackPath(path)), outputPolicy: "compiled-v1", testScripts: row.testScripts.map(name => string(name, 80)),
    ...(row.workerSqlite === undefined ? {} : { workerSqlite: parseWorkerSqliteAdapter(row.workerSqlite) }) };
}
export function fullstackTestCommand(plan: FullstackPreparation): string | null {
  return plan.testScripts.length ? plan.testScripts.map(name => `npm run ${name}`).join(" && ") : null;
}
export type FullstackApiCheck = Readonly<{ path: string; status: number; assertions: readonly Readonly<{ pointer: readonly string[]; equals: string | number | boolean | null }>[] }>;
export function parseFullstackApiChecks(value: unknown): readonly FullstackApiCheck[] {
  ensure(Array.isArray(value) && value.length > 0 && value.length <= 8, "FULLSTACK_API_CHECK_REQUIRED", "بررسی مستقل API و داده باید علاوه بر صفحهٔ اصلی مشخص شود.", 409);
  return value.map(input => {
    const row = object(input); exactKeys(row, ["path", "status", "assertions"]);
    const path = string(row.path, 200);
    ensure(/^\/(?!\/)[A-Za-z0-9_./-]*$/.test(path) && !path.split("/").some(part => part === "." || part === "..") && Array.isArray(row.assertions) && row.assertions.length > 0 && row.assertions.length <= 16,
      "FULLSTACK_API_CHECK_REQUIRED", "مسیر و معیار JSON برای API باید صریح و محدود باشند.", 409);
    return { path, status: integer(row.status, 200, 299), assertions: row.assertions.map(input => {
      const item = object(input); exactKeys(item, ["pointer", "equals"]);
      ensure(Array.isArray(item.pointer) && item.pointer.length > 0 && item.pointer.length <= 8 && item.pointer.every(key => typeof key === "string" && /^[A-Za-z_][A-Za-z0-9_]{0,79}$/.test(key) && !["__proto__", "prototype", "constructor"].includes(key)) &&
        (item.equals === null || typeof item.equals === "boolean" || typeof item.equals === "number" && Number.isFinite(item.equals) || typeof item.equals === "string" && item.equals.length <= 256),
        "FULLSTACK_API_CHECK_REQUIRED", "فیلد و مقدار مورد انتظار API معتبر نیستند.", 409);
      return { pointer: item.pointer.map(key => string(key, 80)), equals: item.equals };
    }) };
  });
}
export type FullstackVerification = Readonly<{
  version: 1; buildJobId: string; testedSourceHash: string; planHash: string; outputArtifactHash: string;
  outputDirectory: string; apiChecks: readonly FullstackApiCheck[];
}>;
export function parseFullstackVerification(value: unknown): FullstackVerification {
  const row = object(value); exactKeys(row, ["version", "buildJobId", "testedSourceHash", "planHash", "outputArtifactHash", "outputDirectory", "apiChecks"]);
  const id = string(row.buildJobId, 36);
  ensure(row.version === 1 && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id), "FULLSTACK_VERIFICATION_REQUIRED", "ساخت کامل باید به رسید همان job متصل باشد.", 409);
  return { version: 1, buildJobId: id, testedSourceHash: hash(row.testedSourceHash), planHash: hash(row.planHash), outputArtifactHash: hash(row.outputArtifactHash),
    outputDirectory: fullstackPath(row.outputDirectory), apiChecks: parseFullstackApiChecks(row.apiChecks) };
}
export function matchesFullstackApi(check: FullstackApiCheck, status: number, body: string): boolean {
  if (status !== check.status || new TextEncoder().encode(body).byteLength > 65536) return false;
  try {
    const json: unknown = JSON.parse(body);
    return check.assertions.every(assertion => {
      let value = json;
      for (const key of assertion.pointer) {
        if (!value || typeof value !== "object" || !Object.hasOwn(value, key)) return false;
        value = Object.getOwnPropertyDescriptor(value, key)?.value;
      }
      return value === assertion.equals;
    });
  } catch { return false; }
}
