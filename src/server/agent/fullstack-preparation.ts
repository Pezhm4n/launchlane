import semver from "semver";
import { parseFullstackPreparation, type FullstackPreparation } from "../../contracts/fullstack.ts";
import type { ProjectProfile } from "../../contracts/domain.ts";
import { object } from "../../contracts/validation.ts";
import { ensure } from "../errors.ts";
import { fingerprint } from "../policy/action.ts";
import type { SourceFile } from "../workspace/inspect.ts";
import { lockedTarballs, type LockedTarball } from "./npm-source.ts";
import { workerSqliteBuild, workerSqliteFiles, workerSqlitePaths, workerSqliteStart } from "./worker-sqlite-programs.ts";

function packageJson(files: readonly SourceFile[], path: string) {
  const file = files.find(file => file.path === path);
  ensure(file, "FULLSTACK_PACKAGE_REQUIRED", `بستهٔ «${path}» در source موجود نیست.`, 409);
  return object(JSON.parse(file.content.toString("utf8")));
}
export function assertCompiledLifecycle(pkg: Record<string, unknown>): void {
  const scripts = object(pkg.scripts ?? {});
  const hooks = ["preinstall", "install", "postinstall", "prepublish", "preprepare", "prepare", "postprepare", "prebuild", "postbuild", "prestart", "poststart"];
  ensure(hooks.every(name => scripts[name] === undefined || typeof scripts[name] === "string" && !scripts[name].trim()),
    "FULLSTACK_LIFECYCLE_REVIEW_REQUIRED", "این پروژه hook نصب، ساخت یا شروع دارد؛ انتشار خروجی آماده نباید همان hook را با تنظیمات خصوصی دوباره اجرا کند. برنامهٔ مستقل و آزموده برای آن لازم است.", 409);
}
export function fullstackPreparation(files: readonly SourceFile[], profile: ProjectProfile): FullstackPreparation {
  const fullstack = profile.fullstack;
  if (fullstack?.workerSqlite) {
    const pkg = packageJson(files, "package.json");assertCompiledLifecycle(pkg);
    const required = object(pkg.engines ?? {}).node;
    ensure(required === undefined || typeof required === "string" && semver.validRange(required) && semver.satisfies("24.18.0", required), "FULLSTACK_NODE_CONFLICT", "این سازگاری Worker به Node24 نیاز دارد؛ engine منبع ناسازگار تغییر نمی‌کند.", 409);
    ensure(pkg.workspaces === undefined, "FULLSTACK_WORKSPACES_UNSUPPORTED", "این تبدیل فقط همان بستهٔ Worker را می‌پذیرد.", 409);
    const testScripts = Object.entries(object(pkg.scripts ?? {})).filter(([name, command]) => /^test(?::[A-Za-z0-9_-]+)*$/.test(name) && typeof command === "string" && command.trim()).map(([name]) => name).sort();
    const plan = parseFullstackPreparation({ version: 2, entryFile: workerSqlitePaths.server, backendScript: "server", startCommand: workerSqliteStart,
      buildCommand: workerSqliteBuild, nodeVersion: "24", port: 3000, outputDirectory: "dist", packageRoots: ["."], outputPolicy: "compiled-v1", testScripts, workerSqlite: fullstack.workerSqlite });
    fullstackTarballs(files, plan);return plan;
  }
  ensure(fullstack?.backendScript && fullstack.entryFile && fullstack.startCommand && profile.port && profile.build,
    "FULLSTACK_PREPARATION_REQUIRED", "فایل و فرمان API، پورت و فرمان ساخت باید از source مشخص شوند؛ انتشار فرانت جایگزین آن نمی‌شود.", 409);
  const versions = [{ major: "22", exact: "22.23.3" }, { major: "24", exact: "24.18.0" }] as const;
  const packages = fullstack.packageRoots.map(root => packageJson(files, root === "." ? "package.json" : `${root}/package.json`));
  ensure(packages.every(pkg => pkg.workspaces === undefined), "FULLSTACK_WORKSPACES_UNSUPPORTED", "workspaceهای npm به قرارداد نصب مستقل نیاز دارند؛ بستهٔ ریشه با چند lock اشتباه گرفته نمی‌شود.", 409);
  const version = versions.find(version => packages.every(pkg => { const required = object(pkg.engines ?? {}).node; return required === undefined || typeof required === "string" && semver.validRange(required) && semver.satisfies(version.exact, required); }));
  ensure(version, "FULLSTACK_NODE_CONFLICT", "نسخهٔ سازگار مشترک برای بسته‌های این برنامه در محیط‌های ساخت موجود نیست.", 409);
  let buildCommand = profile.build;
  for (const root of fullstack.packageRoots.filter(root => root !== ".")) {
    const escaped = root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Preserve the command's existing flags and every following build/test. Replace only installation mode.
    buildCommand = buildCommand.replace(new RegExp(`\\bnpm --prefix ${escaped} install(?=\\s|$)`, "g"), `npm --prefix ${root} ci --offline --no-audit --no-fund`);
  }
  ensure(!/\b(?:npm|npx)\s+(?:install|i|add|update|upgrade)\b|\bnpx\s+--yes\b/.test(buildCommand),
    "FULLSTACK_UNLOCKED_BUILD", "فرمان ساخت نصب قفل‌نشده دارد؛ نسخهٔ بررسی‌شده باید همهٔ dependencyها را از lock همان بسته بگیرد.", 409);
  const rootPackage = packages[0]; ensure(rootPackage, "FULLSTACK_PACKAGE_REQUIRED", "بستهٔ اصلی موجود نیست.", 409);
  assertCompiledLifecycle(rootPackage);
  if (fullstack.startCommand.startsWith("tsx ")) ensure(typeof object(rootPackage.dependencies ?? {}).tsx === "string", "FULLSTACK_RUNTIME_DEPENDENCY", "اجرای TypeScript به tsx در dependencyهای زمان اجرا نیاز دارد؛ dependency جدید بدون برنامهٔ مستقل اضافه نمی‌شود.", 409);
  const testScripts = Object.entries(object(rootPackage.scripts ?? {})).filter(([name, command]) => /^test(?::[A-Za-z0-9_-]+)*$/.test(name) && typeof command === "string" && command.trim()).map(([name]) => name).sort();
  const plan = parseFullstackPreparation({ version: 2, entryFile: fullstack.entryFile, backendScript: fullstack.backendScript,
    startCommand: fullstack.startCommand, buildCommand, nodeVersion: version.major, port: profile.port, outputDirectory: fullstack.outputDirectory, packageRoots: fullstack.packageRoots, outputPolicy: "compiled-v1", testScripts });
  fullstackTarballs(files, plan);
  return plan;
}
export function fullstackTarballs(files: readonly SourceFile[], plan: FullstackPreparation): LockedTarball[] {
  const result = new Map<string, LockedTarball>(), urls = new Map<string, string>();
  for (const root of plan.packageRoots) {
    const prefix = root === "." ? "" : `${root}/`;
    const scope = files.filter(file => file.path === `${prefix}package-lock.json`).map(file => ({ ...file, path: "package-lock.json" }));
    for (const item of lockedTarballs(scope)) {
      ensure(!urls.has(item.url) || urls.get(item.url) === item.integrity, "FULLSTACK_LOCK_CONFLICT", "یک dependency در دو lock با هش متفاوت تعریف شده است.", 409);
      urls.set(item.url, item.integrity); result.set(item.integrity, item);
    }
  }
  ensure(result.size <= 4096, "FULLSTACK_DEPENDENCY_LIMIT", "تعداد dependencyهای این ساخت از سقف مجاز بیشتر است.", 413);
  return [...result.values()];
}
/** Deterministic, approval-bound edits in the product's private copy only. Original source stays immutable. */
export function prepareFullstackFiles(files: readonly SourceFile[], profile: ProjectProfile, value: FullstackPreparation): SourceFile[] {
  const plan = parseFullstackPreparation(value), derived = fullstackPreparation(files, profile);
  ensure(fingerprint(plan) === fingerprint(derived), "FULLSTACK_PREPARATION_CHANGED", "فرمان‌ها یا بسته‌های برنامه با نسخهٔ مصوب برابر نیستند.", 409);
  const pkg = packageJson(files, "package.json"), liaraFile = files.find(file => file.path === "liara.json"), liara = liaraFile ? object(JSON.parse(liaraFile.content.toString("utf8"))) : {};
  const changes = new Map<string, Buffer>([
    ["package.json", Buffer.from(`${JSON.stringify({ ...pkg, scripts: { ...object(pkg.scripts ?? {}), start: plan.startCommand, build: plan.buildCommand } }, null, 2)}\n`)],
    ["liara.json", Buffer.from(`${JSON.stringify({ ...liara, platform: "node", port: plan.port, node: { ...object(liara.node ?? {}), version: plan.nodeVersion } }, null, 2)}\n`)],
  ]);
  if (plan.workerSqlite) for (const [path, content] of workerSqliteFiles(plan.workerSqlite)) {
    const before = files.find(file => file.path === path);
    ensure(!before || before.content.equals(content), "WORKER_PREPARATION_CHANGED", "فایل جدید Worker نباید فایل متفاوت موجود را جایگزین کند.", 409);changes.set(path, content);
  }
  return [...files.filter(file => !changes.has(file.path)), ...[...changes].map(([path, content]) => ({ path, content }))].sort((a, b) => a.path.localeCompare(b.path, "en"));
}
