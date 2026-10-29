import { createHash } from "node:crypto";
import { posix } from "node:path";
import { parseDocument } from "yaml";
import semver from "semver";
import { parsePnpmWorkspace, pnpmTool, type PnpmWorkspace } from "../../contracts/pnpm-workspace.ts";
import { object } from "../../contracts/validation.ts";
import { AppError, ensure } from "../errors.ts";
import type { SourceFile } from "./inspect.ts";

export function pnpmYaml(file: SourceFile): Record<string, unknown> {
  ensure(file.content.length <= 4 * 1024 * 1024, "PNPM_LOCK_LIMIT", "حجم تنظیمات pnpm بیشتر از سقف بررسی است.", 413);
  const doc = parseDocument(new TextDecoder("utf-8", { fatal: true }).decode(file.content), { schema: "core", uniqueKeys: true, merge: false });
  ensure(!doc.errors.length, "PNPM_LOCK_INVALID", "تنظیمات یا lockfile pnpm معتبر نیست؛ source تغییر داده نشد.", 409);
  try { return object(doc.toJS({ maxAliasCount: 0 })); }
  catch { throw new AppError("PNPM_LOCK_INVALID", "پیوند YAML یا ساختار نامعتبر در lock پشتیبانی نمی‌شود.", 409); }
}
function pattern(value: unknown): RegExp {
  ensure(typeof value === "string" && value.length <= 160 && !value.startsWith("/") && value.split("/").every(part => part !== "." && part !== "..") && /^[A-Za-z0-9_@.*!/-]+$/.test(value),
    "PNPM_GLOB_UNSUPPORTED", "الگوی پوشه‌های workspace در این قرارداد پشتیبانی نمی‌شود؛ بسته‌ای حذف یا هموار نشد.", 409);
  return new RegExp(`^${value.split("/").map(part => part === "**" ? ".*" : part.split("*").map(value => value.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[^/]*")).join("/")}$`);
}
export function inspectPnpmWorkspace(files: readonly SourceFile[]): PnpmWorkspace | undefined {
  const rootFile = files.find(file => file.path === "package.json"); if (!rootFile) return;
  const root = object(JSON.parse(rootFile.content.toString("utf8")));
  if (!(typeof root.packageManager === "string" && root.packageManager.startsWith("pnpm@")) && !files.some(file => file.path === "pnpm-lock.yaml" || file.path === "pnpm-workspace.yaml")) return;
  ensure(root.packageManager === `pnpm@${pnpmTool.version}` || root.packageManager === `pnpm@${pnpmTool.version}+sha512.${Buffer.from(pnpmTool.integrity.slice(7), "base64").toString("hex")}`,
    "PNPM_VERSION_UNSUPPORTED", "packageManager باید نسخهٔ دقیق pnpm پشتیبانی‌شده را مشخص کند؛ نسخه یا lock جایگزین نمی‌شود.", 409);
  ensure(!files.some(file => /^(?:package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|bun\.lockb?)$/.test(file.path)), "PACKAGE_MANAGER_CONFLICT", "چند lockfile ناسازگار در ریشه وجود دارد؛ انتخاب خودکار npm مجاز نیست.", 409);
  ensure(!files.some(file => /(?:^|\/)\.pnpmfile\.[cm]?js$/.test(file.path)), "PNPM_HOOK_UNSUPPORTED", "hook تغییر dependency به قرارداد مستقل نیاز دارد؛ lock آن نادیده گرفته نمی‌شود.", 409);
  const lockFile = files.find(file => file.path === "pnpm-lock.yaml"); ensure(lockFile, "PNPM_LOCK_REQUIRED", "pnpm-lock.yaml اصلی workspace لازم است.", 409);
  const lock = pnpmYaml(lockFile); ensure(lock.lockfileVersion === "9.0" || lock.lockfileVersion === 9, "PNPM_LOCK_UNSUPPORTED", "این نصب lockfile pnpm نسخهٔ۹ را اجرا می‌کند.", 409);
  const workspaceFile = files.find(file => file.path === "pnpm-workspace.yaml"), workspace = workspaceFile ? pnpmYaml(workspaceFile) : {};
  ensure(Object.keys(workspace).every(key => ["packages", "allowBuilds", "onlyBuiltDependencies", "injectWorkspacePackages", "syncInjectedDepsAfterScripts"].includes(key)) && root.pnpm === undefined && root.workspaces === undefined,
    "PNPM_SETTINGS_UNSUPPORTED", "تنظیمات اضافی workspace نیازمند بررسی مستقل‌اند؛ تنظیم موجود برای عبور نصب حذف نشد.", 409);
  const patterns = workspace.packages ?? []; ensure(Array.isArray(patterns) && patterns.length <= 64, "PNPM_WORKSPACE_INVALID", "الگوی بسته‌های workspace معتبر نیست.", 409);
  const positive = patterns.filter(value => typeof value === "string" && !value.startsWith("!")).map(pattern), negative = patterns.filter(value => typeof value === "string" && value.startsWith("!")).map(value => pattern(value.slice(1)));
  ensure(patterns.every(value => typeof value === "string"), "PNPM_WORKSPACE_INVALID", "الگوی بسته‌ها باید متن باشد.", 409);
  const manifests = [rootFile, ...files.filter(file => file.path.endsWith("/package.json") && positive.some(pattern => pattern.test(posix.dirname(file.path))) && !negative.some(pattern => pattern.test(posix.dirname(file.path)))).sort((a, b) => a.path.localeCompare(b.path, "en"))];
  const importers = object(lock.importers), roots = manifests.map(file => posix.dirname(file.path));
  ensure(Object.keys(importers).length === roots.length && roots.every(root => Object.hasOwn(importers, root)), "PNPM_IMPORTERS_CHANGED", "همهٔ importerهای lock باید با بسته‌های همین source برابر باشند؛ انتخاب یک leaf lock ریشه را دور نمی‌زند.", 409);
  const raw = manifests.map(file => ({ file, pkg: object(JSON.parse(file.content.toString("utf8"))) }));
  const liaraFile = files.find(file => file.path === "liara.json"), liara = liaraFile ? object(JSON.parse(liaraFile.content.toString("utf8"))) : {}, configuredNode = object(liara.node ?? {}).version;
  ensure(configuredNode === undefined || configuredNode === "22" || configuredNode === "24", "PNPM_NODE_CONFLICT", "نسخهٔ صریح محیط باید با image موجود سازگار باشد؛ نسخهٔ source جایگزین نشد.", 409);
  const nodeVersion = ([{ major: "22", exact: "22.23.3" }, { major: "24", exact: "24.18.0" }] as const).find(version => (configuredNode === undefined || configuredNode === version.major) && semver.satisfies(version.exact, pnpmTool.nodeRequirement) && raw.every(({ pkg }) => {
    const requirement = object(pkg.engines ?? {}).node; return requirement === undefined || typeof requirement === "string" && semver.validRange(requirement) && semver.satisfies(version.exact, requirement);
  }))?.major;
  ensure(nodeVersion, "PNPM_NODE_CONFLICT", "هیچ image موجود با قید Node همهٔ بسته‌ها و pnpm سازگار نیست.", 409);
  const packages = raw.map(({ file, pkg }) => {
    const scripts = object(pkg.scripts ?? {}), importer = object(importers[posix.dirname(file.path)]), dependencies: string[] = [];
    ensure(pkg.devEngines === undefined, "PNPM_SETTINGS_UNSUPPORTED", "devEngines و runtime دانلودی به بررسی قید مستقل نیاز دارند؛ محیط میزبان جایگزین نمی‌شود.", 409);
    ensure(pkg.packageManager === undefined || pkg.packageManager === root.packageManager, "PACKAGE_MANAGER_CONFLICT", "نسخه pnpm در بسته داخلی با ریشه متفاوت است.", 409);
    ensure(object(pkg.engines ?? {}).pnpm === undefined || typeof object(pkg.engines).pnpm === "string" && semver.satisfies(pnpmTool.version, String(object(pkg.engines).pnpm)), "PNPM_VERSION_UNSUPPORTED", "قید engines.pnpm با نسخهٔ انتخاب‌شده سازگار نیست.", 409);
    for (const group of ["dependencies", "devDependencies", "optionalDependencies"] as const) {
      const declared = object(pkg[group] ?? {}), locked = object(importer[group] ?? {});
      ensure(Object.keys(declared).length === Object.keys(locked).length, "PNPM_LOCK_MISMATCH", "manifest و lockfile همگام نیستند؛ lock بازنویسی نشد.", 409);
      for (const [name, specifier] of Object.entries(declared)) {
        const entry = object(locked[name]); ensure(entry.specifier === specifier, "PNPM_LOCK_MISMATCH", "specifier اصلی dependency با lock برابر نیست.", 409);
        if (typeof specifier === "string" && specifier.startsWith("workspace:")) {
          const target = raw.find(({ pkg }) => pkg.name === name), version = entry.version;
          ensure(target && typeof version === "string" && version.startsWith("link:") && posix.normalize(posix.join(posix.dirname(file.path), version.slice(5))) === posix.dirname(target.file.path),
            "PNPM_WORKSPACE_LINK_CHANGED", "dependency داخلی باید به بستهٔ موجود در همین workspace وصل باشد.", 409);
          dependencies.push(name);
        } else ensure(typeof entry.version === "string" && !/^(?:link:|file:|https?:|git)/.test(entry.version), "PNPM_DEPENDENCY_UNSUPPORTED", "dependency محلی یا git خارج workspace به قرارداد مستقل نیاز دارد.", 409);
      }
    }
    const command = (name: string) => scripts[name] === undefined ? null : scripts[name];
    return { root: posix.dirname(file.path), name: pkg.name, dependencies: [...new Set(dependencies)].sort(), build: command("build"), test: command("test"), start: command("start") };
  });
  const evidence = [...manifests, lockFile, ...(workspaceFile ? [workspaceFile] : []), ...(liaraFile ? [liaraFile] : [])].sort((a, b) => a.path.localeCompare(b.path, "en"));
  return parsePnpmWorkspace({ version: 1, manager: pnpmTool, nodeVersion, packages, files: evidence.map(file => ({ path: file.path, sha256: createHash("sha256").update(file.content).digest("hex") })) });
}
