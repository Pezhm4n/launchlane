import type { Action, ProjectProfile } from "../../contracts/domain.ts";
import { databaseBindingKeys, isDatabaseProvisionSpec, parseDatabaseBindingKeys, type DatabaseProvisionSpec } from "../../contracts/database-provision.ts";
import { isApplicationEnvironmentKey } from "../../contracts/environment.ts";
import { ensure } from "../errors.ts";

export function sourceDatabaseBindingKeys(profile: ProjectProfile, consumerRoot: string, type: string, value: unknown): readonly string[] {
  const keys = parseDatabaseBindingKeys(value), kind = type === "postgres" ? "postgresql" : type === "mysql" ? "mysql" : type === "redis" ? "redis" : null;
  const requirement = profile.applicationRequirements?.requirements.find(row => row.kind === kind && row.consumerRoot === consumerRoot && row.need === "required");
  const shape = type === "redis" ? /^(?:REDIS_(?:URL|URI)|[A-Z][A-Z0-9_]*_REDIS_(?:URL|URI))$/ : /^(?:DATABASE_URL|[A-Z][A-Z0-9_]*_(?:DB|DATABASE)_(?:URL|URI))$/;
  ensure(profile.applicationRequirements?.sourceHash === profile.sourceHash && requirement?.evidence.every(evidence => profile.manifest.some(file => file.path === evidence.path && file.sha256 === evidence.sha256)) &&
    keys.every(key => shape.test(key) && isApplicationEnvironmentKey(key) && profile.envNames.includes(key) && requirement.environmentKeys.includes(key)),
    "DATABASE_BINDING_SOURCE_REQUIRED", "نام اتصال باید در source همان مصرف‌کننده و نوع دیتابیس مشخص باشد؛ نام یا سرویس جایگزین ساخته نمی‌شود.", 409);
  return keys;
}

/** Called inside the existing action transaction: a new request cannot reserve an occupied connection. */
export function assertDatabaseBindingAvailable(spec: DatabaseProvisionSpec, existing: readonly Action[], now = Date.now()): void {
  const keys = databaseBindingKeys(spec);
  for (const action of existing) {
    const prior = action.spec;
    if (!isDatabaseProvisionSpec(prior) || prior.accountId !== spec.accountId || prior.targetAppId !== spec.targetAppId || prior.scope.teamId !== spec.scope.teamId ||
      action.state === "cancelled" || action.state === "expired" || action.state === "failed" && !action.database?.databaseId) continue;
    if (!action.attemptId && ["awaiting_approval", "approved"].includes(action.state) && (action.expiresAt <= now || prior.cost.expiresAt <= now)) continue;
    ensure(!databaseBindingKeys(prior).some(key => keys.includes(key)), "DATABASE_BINDING_ALREADY_RESERVED", "برای این ورودی، منبع یا درخواست دیگری ثبت شده است؛ همان منبع و رسید را بررسی کنید و دیتابیس تکراری نسازید.", 409);
  }
}
