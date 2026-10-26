import type { EnvironmentReference, EnvironmentVariable, SourceEnvironmentReference } from "../../contracts/environment.ts";
import { isApplicationEnvironmentKey, isPublicClientEnvironmentKey, parseSourceEnvironmentReference } from "../../contracts/environment.ts";
import type { ProjectBuildPlan } from "../../contracts/project-build.ts";
import type { Config } from "../config.ts";
import type { Store } from "../persistence/store.ts";
import { ensure } from "../errors.ts";
import { environmentFingerprint, environmentProjectIds, currentEnvironment, projectEnvironmentValues } from "./secrets.ts";
import { importedEnvironment } from "./import.ts";
import { fingerprint } from "../policy/action.ts";

export function buildSourceEnvironment(plan: ProjectBuildPlan): SourceEnvironmentReference | undefined {
  return "sourceEnvironment" in plan ? plan.sourceEnvironment : undefined;
}

function privateSourceValues(config: Pick<Config, "sessionSecret">, store: Store, actor: string, projectId: string): EnvironmentVariable[] {
  const flow = store.getProjectFlow(actor, projectId);ensure(flow, "PROJECT_REQUIRED", "پروژهٔ ورودی ساخت پیدا نشد.", 409);
  const values = importedEnvironment(config, store, actor, projectId).filter(row => flow.profile.envNames.includes(row.key) && isApplicationEnvironmentKey(row.key));
  ensure(values.every(row => !isPublicClientEnvironmentKey(row.key)), "PUBLIC_BUILD_ENV_REVIEW_REQUIRED", "ورودی عمومی مرورگر باید جداگانه بررسی شود؛ ساخت خصوصی آن را خودکار منتشر نمی‌کند.", 409);
  return values;
}
export function sourceBuildEnvironment(config: Pick<Config, "sessionSecret">, store: Store, actor: string, projectId: string): SourceEnvironmentReference | null {
  const flow = store.getProjectFlow(actor, projectId);ensure(flow, "PROJECT_REQUIRED", "پروژهٔ ورودی ساخت پیدا نشد.", 409);
  const values = privateSourceValues(config, store, actor, projectId);
  return values.length ? parseSourceEnvironmentReference({ version: 1, kind: "source_environment", projectId: flow.id, sourceHash: flow.profile.sourceHash,
    fingerprint: environmentFingerprint(config.sessionSecret, values), keys: values.map(row => row.key) }) : null;
}
export function buildEnvironmentValues(config: Pick<Config, "sessionSecret">, store: Store, actor: string, projectId: string,
  environment: EnvironmentReference | null | undefined, sourceEnvironment: SourceEnvironmentReference | undefined): EnvironmentVariable[] {
  if (!sourceEnvironment) return projectEnvironmentValues(store, config.sessionSecret, actor, projectId, environment);
  ensure(!environment, "ENV_REFERENCE_CHANGED", "ساخت نمی‌تواند هم‌زمان دو منبع متفاوت برای تنظیمات بگیرد.", 409);
  const reference = parseSourceEnvironmentReference(sourceEnvironment), projects = environmentProjectIds(store, actor, projectId), origin = store.getProjectFlow(actor, reference.projectId);
  ensure(projects.has(reference.projectId) && origin?.profile.sourceHash === reference.sourceHash, "ENV_REFERENCE_CHANGED", "منبع خصوصی یا تبار پروژه تغییر کرده است.", 409);
  const values = privateSourceValues(config, store, actor, reference.projectId);
  ensure(JSON.stringify(values.map(row => row.key)) === JSON.stringify(reference.keys) && environmentFingerprint(config.sessionSecret, values) === reference.fingerprint,
    "ENV_REFERENCE_CHANGED", "ورودی خصوصی ساخت تغییر کرده است؛ تصمیم قبلی قابل استفاده نیست.", 409);
  return values;
}
/** A local build is not evidence of a cloud env write. Live publication must prove
 * the same used values through the existing verified v9 configuration, not a fake receipt.
 */
export function matchesPublishedBuildEnvironment(config: Pick<Config, "sessionSecret">, store: Store, actor: string, projectId: string, build: ProjectBuildPlan): boolean {
  const current = currentEnvironment(store, config.sessionSecret, actor, projectId);
  const source = buildSourceEnvironment(build);
  if (!source) return fingerprint(build.environment ?? null) === fingerprint(current);
  if (!current) return false;
  const reference = parseSourceEnvironmentReference(source), projects = environmentProjectIds(store, actor, projectId), origin = store.getProjectFlow(actor, reference.projectId);
  if (!projects.has(reference.projectId) || origin?.profile.sourceHash !== reference.sourceHash) return false;
  const values = projectEnvironmentValues(store, config.sessionSecret, actor, projectId, current);
  return JSON.stringify(values.map(row => row.key)) === JSON.stringify(reference.keys) && environmentFingerprint(config.sessionSecret, values) === reference.fingerprint;
}
