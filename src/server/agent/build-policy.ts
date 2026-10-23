import type { ProjectProfile } from "../../contracts/domain.ts";
import { parseProjectBuildPlan, type ProjectBuildPlan } from "../../contracts/project-build.ts";
import { object } from "../../contracts/validation.ts";
import { ensure } from "../errors.ts";
import { fingerprint } from "../policy/action.ts";
import type { SourceFile } from "../workspace/inspect.ts";
import { lockedTarballs } from "./npm-source.ts";
import semver from "semver";
import { pythonRequirements } from "./python-source.ts";
import { pythonStart } from "../../contracts/python-runtime.ts";

export function requiresProjectBuild(files: readonly SourceFile[]): boolean {
  if (files.some(file => file.path.endsWith(".py")) && !files.some(file => file.path === "package.json")) return true;
  const file = files.find(file => file.path === "package.json");
  if (!file) return false;
  const pkg = object(JSON.parse(file.content.toString("utf8")));
  return !!object(pkg.scripts ?? {}).build || [pkg.dependencies, pkg.devDependencies, pkg.optionalDependencies]
    .some(value => value !== undefined && Object.keys(object(value)).length > 0);
}
export function projectTestCommand(files: readonly SourceFile[]): string | null {
  if (!files.some(file => file.path === "package.json") && files.some(file => file.path.endsWith(".py"))) return null;
  const file = files.find(file => file.path === "package.json");
  ensure(file, "BUILD_PLAN_CHANGED", "package.json موجود نیست.", 409);
  const value = object(object(JSON.parse(file.content.toString("utf8"))).scripts ?? {}).test;
  ensure(value === undefined || (typeof value === "string" && value.length <= 1000), "BUILD_PLAN_CHANGED", "فرمان آزمون معتبر و محدود لازم است.", 409);
  return typeof value === "string" && value.trim() ? value : null;
}
export function dependencyFreeNode(files: readonly SourceFile[]): boolean {
  const file = files.find(file => file.path === "package.json");
  if (!file || files.some(file => /^(?:package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?)$/.test(file.path))) return false;
  const pkg = object(JSON.parse(file.content.toString("utf8")));
  return pkg.workspaces === undefined && [pkg.dependencies, pkg.devDependencies, pkg.optionalDependencies, pkg.peerDependencies]
    .every(value => value === undefined || Object.keys(object(value)).length === 0);
}
export function validateBuildRepairPaths(paths: readonly string[]) {
  ensure(paths.every(path => !/(?:^|\/)(?:tests?|specs?|__tests__|__mocks__|cypress|e2e)(?:\/|$)|\.(?:test|spec|cy)\.[cm]?[jt]sx?$/i.test(path) &&
    !/(?:^|\/)(?:test_[^/]+\.py|[^/]+_test\.py|requirements[^/]*\.txt|pyproject\.toml|setup\.py|setup\.cfg|liara\.json|package(?:-lock)?\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|tsconfig(?:\.[^/]+)?\.json|(?:vitest|jest|playwright|cypress|eslint)\.config\.[^/]+|\.eslintrc[^/]*|biome\.jsonc?)$/i.test(path)),
    "BUILD_ORACLE_CHANGED", "تست، تنظیمات سنجش یا dependency در این قرارداد تغییر نمی‌کند؛ محدوده مستقل لازم است.", 403);
}
export function validateBuildPlan(files: readonly SourceFile[], profile: ProjectProfile, value: ProjectBuildPlan): ProjectBuildPlan {
  const plan = parseProjectBuildPlan(value);
  if (plan.version === 2) {
    ensure(profile.runtime === "python" && fingerprint(profile.pythonRuntime) === fingerprint(plan.runtime) && profile.start === pythonStart(plan.runtime) &&
      profile.start === plan.startCommand && profile.port === plan.port && profile.build === null,
      "BUILD_PLAN_CHANGED", "فرمان، پورت یا نسخه Python با پروژه برابر نیست.", 409);
    pythonRequirements(files);
    return plan;
  }
  ensure(!profile.nodeRuntime?.requirement || semver.satisfies(plan.nodeVersion === "20" ? "20.20.2" : plan.nodeVersion === "24" ? "24.18.0" : "22.23.3", profile.nodeRuntime.requirement),
    "BUILD_RUNTIME_UNSUPPORTED", "نسخه دقیق image با engines.node پروژه سازگار نیست؛ محیط سازگار لازم است.", 409);
  ensure(profile.nodeRuntime?.version === plan.nodeVersion && profile.start === plan.startCommand && profile.build === plan.buildCommand && profile.port === plan.port && projectTestCommand(files) === plan.testCommand,
    "BUILD_PLAN_CHANGED", "نسخه Node، فرمان‌ها یا پورت با source انتخاب‌شده برابر نیستند.", 409);
  ensure(profile.frontendRuntime ? plan.version === 5 && fingerprint(profile.frontendRuntime) === fingerprint(plan.frontend) : plan.version !== 5,
    "BUILD_PLAN_CHANGED", "ساخت رابط و پوشه خروجی باید با پروژه برابر باشند.", 409);
  const file = files.find(file => file.path === "package.json");
  ensure(file && object(JSON.parse(file.content.toString("utf8"))).workspaces === undefined,
    "BUILD_LEAF_REQUIRED", "پوشه همان برنامه را انتخاب کنید؛ root چندبخشی اجرا نمی‌شود.", 409);
  if (plan.install === "none") ensure(dependencyFreeNode(files), "BUILD_INSTALL_SCOPE", "حذف نصب فقط برای پروژهٔ بدون وابستگی و بدون lockfile مجاز است؛ lock یا dependency باید با مسیر خودش بررسی شود.", 409);
  else lockedTarballs(files);
  return plan;
}
export function sameBuildWorkload(plan: ProjectBuildPlan, value: ProjectBuildPlan["workload"]): boolean {
  return fingerprint(plan.workload) === fingerprint(value);
}
