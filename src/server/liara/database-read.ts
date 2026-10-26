import type { DatabaseAccountScope, DatabaseCapabilities, DatabaseInventory, DatabaseInventoryResource, DatabaseLookup, DatabaseResourceIdentity } from "../../contracts/database-resource.ts";
import { databaseAccountScope } from "../../contracts/database-resource.ts";
import { providerObjectId } from "../../contracts/provision.ts";
import { identifier, integer, object, string } from "../../contracts/validation.ts";
import { containsCredential } from "../policy/redaction.ts";
import { explicitIsoTime } from "./read-contracts.ts";
import type { Config } from "../config.ts";
import { AppError, ensure } from "../errors.ts";
import type { RunBudget } from "../policy/budget.ts";
import { abortable, boundedJson, httpFailure, sendRead, transport, type Transport } from "../providers/http.ts";
import { LiaraAccountClient } from "./catalog.ts";

function publicMetadata<T>(value: T, secrets: readonly string[]): T {
  ensure(!containsCredential(JSON.stringify(value) ?? "", secrets), "SENSITIVE_RESPONSE", "اطلاعات دیتابیس شامل مقدار محرمانه است و نمایش داده نشد.", 502);
  return value;
}
function upstream<T>(parse: () => T): T {
  try { return parse(); }
  catch (error) {
    if (error instanceof AppError && error.code !== "INVALID_INPUT") throw error;
    throw new AppError("DATABASE_RESPONSE_INVALID", "ساختار اطلاعات دیتابیس قابل تأیید نیست؛ نتیجه خالی فرض نشد.", 502);
  }
}
function optionalIdentifier(value: unknown): string | null { return value === undefined || value === null ? null : identifier(value); }
function snapshotTime(value: number): number { return integer(value, 0, Number.MAX_SAFE_INTEGER); }

/** CLI 9.4.7: lib/commands/db/list.js and lib/types/{database,get-dbs-response}.d.ts.
 * This endpoint has no documented pagination contract. A short or empty list is not proof of completeness.
 * Passwords, URLs and unverified detail fields are deliberately never copied from the response.
 */
export function parseDatabaseInventoryResponse(value: unknown, expected: DatabaseAccountScope, observedAt = Date.now(), secrets: readonly string[] = []): DatabaseInventory {
  const scope = databaseAccountScope(expected);
  return upstream(() => {
    const root = object(value), rows = root.databases;
    ensure(Array.isArray(rows) && rows.length <= 1000, "DATABASE_RESPONSE_INVALID", "فهرست دیتابیس‌ها موجود نیست یا از سقف بررسی بزرگ‌تر است.", 502);
    const databases = rows.map((value: unknown): DatabaseInventoryResource => {
      const row = object(value), hostname = string(row.hostname, 253);
      ensure(/^[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/.test(hostname) && !hostname.includes(".."), "DATABASE_RESPONSE_INVALID", "شناسهٔ اتصال دیتابیس معتبر نیست.", 502);
      const createdAt = row.created_at === undefined || row.created_at === null ? null : string(row.created_at, 64);
      ensure(createdAt === null || explicitIsoTime(createdAt) !== null, "DATABASE_RESPONSE_INVALID", "زمان ایجاد دیتابیس با واحد یا قالب مشخص دریافت نشد.", 502);
      return { id: providerObjectId(row._id), hostname, type: identifier(row.type),
        scale: row.scale === undefined || row.scale === null ? null : integer(row.scale, 0, 1000),
        status: row.status === undefined || row.status === null ? null : identifier(row.status),
        planId: optionalIdentifier(row.planID), bundleId: optionalIdentifier(row.bundlePlanID), createdAt,
        version: null, networkId: null, publicNetwork: null, dataAccess: "unverified" };
    });
    ensure(new Set(databases.map(row => row.id)).size === databases.length && new Set(databases.map(row => row.hostname)).size === databases.length,
      "DATABASE_RESPONSE_INVALID", "هویت یا نام دیتابیس در پاسخ تکراری است.", 502);
    return publicMetadata({ contract: "liara-database-inventory-v1" as const, ...scope, observedAt: snapshotTime(observedAt), databases,
      coverage: { pagination: "undocumented" as const, completeness: "unknown" as const, observedCount: databases.length, limit: 1000 as const } }, secrets);
  });
}

/** CLI 9.4.7 db/create.js obtains the engine/version choices and plan.supports from /v1/me.
 * Values remain the provider's identifiers. No PostgreSQL alias, version, price or network is inferred.
 */
export function parseDatabaseCapabilitiesResponse(value: unknown, expected: DatabaseAccountScope, observedAt = Date.now(), secrets: readonly string[] = []): DatabaseCapabilities {
  const scope = databaseAccountScope(expected);
  return upstream(() => {
    const root = object(value);
    ensure(object(root.user)._id === scope.accountId && object(root.team)._id === scope.teamId,
      "SCOPE_DENIED", "اطلاعات دیتابیس متعلق به حساب و تیم انتخاب‌شده نیست.", 403);
    const engines: { type: string; versions: string[] }[] = [], plans: { id: string; available: boolean; supports: string[] }[] = [];
    const rawPlans = root.plans === undefined || root.plans === null ? undefined : object(root.plans).databases;
    const supported = root.databaseVersions !== undefined && rawPlans !== undefined;
    if (root.databaseVersions !== undefined) {
      const versions = object(root.databaseVersions);
      ensure(Object.keys(versions).length <= 32, "DATABASE_RESPONSE_INVALID", "تعداد موتورهای دیتابیس از سقف بررسی بیشتر است.", 502);
      for (const [type, values] of Object.entries(versions)) {
        identifier(type);
        ensure(Array.isArray(values) && values.length <= 128, "DATABASE_RESPONSE_INVALID", "نسخه‌های موتور دیتابیس قابل تأیید نیستند.", 502);
        const options = values.map((value: unknown) => {
          const version = string(object(value).value, 64);
          ensure(/^[a-zA-Z0-9][a-zA-Z0-9._+-]*$/.test(version), "DATABASE_RESPONSE_INVALID", "شناسهٔ نسخه دیتابیس معتبر نیست.", 502);
          return version;
        });
        ensure(new Set(options).size === options.length, "DATABASE_RESPONSE_INVALID", "نسخهٔ تکراری در catalog دیتابیس وجود دارد.", 502);
        engines.push({ type, versions: options });
      }
    }
    if (rawPlans !== undefined) {
      const catalog = object(rawPlans);
      ensure(Object.keys(catalog).length <= 200, "DATABASE_RESPONSE_INVALID", "تعداد پلن‌های دیتابیس از سقف بررسی بیشتر است.", 502);
      for (const [id, value] of Object.entries(catalog)) {
        const row = object(value);
        identifier(id);
        ensure(typeof row.available === "boolean" && Array.isArray(row.supports) && row.supports.length <= 32,
          "DATABASE_RESPONSE_INVALID", "قابلیت یا موجودبودن پلن دیتابیس مشخص نیست.", 502);
        const supports = row.supports.map((value: unknown) => identifier(value));
        ensure(new Set(supports).size === supports.length, "DATABASE_RESPONSE_INVALID", "موتورهای پشتیبانی‌شده در پلن تکراری‌اند.", 502);
        plans.push({ id, available: row.available, supports });
      }
    }
    return publicMetadata({ contract: "liara-database-capabilities-v1" as const, ...scope, observedAt: snapshotTime(observedAt),
      catalog: supported ? "observed" as const : "unsupported" as const, engines, plans,
      operations: { inventory: "read_only" as const, credentials: "unsupported" as const, provision: "not_implemented" as const,
        migrate: "not_implemented" as const, connectivity: "unverified" as const } }, secrets);
  });
}

/** Read-only account adapter. Caller supplies connectedLiaraAccountConfig, never model-supplied credentials.
 * CLI 9.4.7 db/list.js proves /v1/databases; base.js proves the teamID query.
 * No detail/credential endpoint or pagination parameters are inferred from create arguments.
 */
export class LiaraDatabaseReadClient {
  readonly config: Config;
  readonly accountId: string;
  readonly send: Transport;
  constructor(config: Config, accountId: string, send: Transport = transport) {
    // Both identity and inventory belong to one connection snapshot, even if the caller refreshes its config.
    this.config = Object.freeze({ ...config, apps: [...config.apps], projectSecretValues: [...config.projectSecretValues] });
    this.accountId = accountId; this.send = send;
  }
  private scope() {
    ensure(this.config.enableLiveLiara, "LIVE_LIARA_DISABLED", "خواندن واقعی لیارا در این نصب خاموش است.", 403);
    ensure(this.config.liaraToken && this.config.liaraBaseUrl === "https://api.liara.ir", "LIARA_UNCONFIGURED", "اتصال مجاز لیارا مشخص نیست.", 403);
    return databaseAccountScope({ accountId: this.accountId, teamId: this.config.teamId });
  }
  private secrets(): string[] {
    return [this.config.liaraToken, this.config.modelKey, this.config.operatorToken, this.config.sessionSecret, ...this.config.projectSecretValues].filter(Boolean);
  }
  private async read<T>(path: "/v1/me" | "/v1/databases", budget: RunBudget, signal: AbortSignal, parse: (value: unknown) => T): Promise<T> {
    this.scope();
    const url = new URL(path, this.config.liaraBaseUrl), bounded = budget.signal(signal);
    url.searchParams.set("teamID", this.config.teamId);
    try {
      return await abortable(async () => {
        const response = await sendRead(this.send, url.href, { method: "GET", redirect: "error", cache: "no-store", signal: bounded,
          headers: { Authorization: `Bearer ${this.config.liaraToken}`, Accept: "application/json" } }, budget, bounded);
        try {
          if (!response.ok) throw httpFailure(response.status);
          const result = parse(await boundedJson(response, 1024 * 1024));
          ensure(!bounded.aborted, signal.aborted ? "CANCELLED" : "BUDGET_EXHAUSTED", "اطلاعات دیتابیس پس از پایان مهلت دریافت شد؛ تأیید نشد.", 409);
          return result;
        } finally { await response.body?.cancel().catch(() => undefined); }
      }, bounded);
    } catch (error) {
      if (bounded.aborted) throw new AppError(signal.aborted ? "CANCELLED" : "BUDGET_EXHAUSTED", "خواندن دیتابیس کامل نشد.", 409);
      if (error instanceof AppError) throw error;
      throw new AppError("PROVIDER_TRANSPORT", "اطلاعات دیتابیس دریافت نشد؛ موجودی خالی فرض نشد.", 502);
    }
  }
  async inventory(budget: RunBudget, signal: AbortSignal): Promise<DatabaseInventory> {
    const scope = this.scope();
    await new LiaraAccountClient(this.config, scope.accountId, this.send).identity(budget, signal);
    return this.read("/v1/databases", budget, signal, value => parseDatabaseInventoryResponse(value, scope, Date.now(), this.secrets()));
  }
  async capabilities(budget: RunBudget, signal: AbortSignal): Promise<DatabaseCapabilities> {
    const scope = this.scope();
    return this.read("/v1/me", budget, signal, value => parseDatabaseCapabilitiesResponse(value, scope, Date.now(), this.secrets()));
  }
  async database(identity: DatabaseResourceIdentity, budget: RunBudget, signal: AbortSignal): Promise<DatabaseLookup> {
    const scope = this.scope(), expected = databaseAccountScope(identity), databaseId = providerObjectId(identity.databaseId);
    ensure(scope.accountId === expected.accountId && scope.teamId === expected.teamId, "SCOPE_DENIED", "دیتابیس انتخاب‌شده متعلق به حساب و تیم این درخواست نیست.", 403);
    const inventory = await this.inventory(budget, signal), resource = inventory.databases.find(row => row.id === databaseId) ?? null;
    return { ...scope, observedAt: inventory.observedAt, outcome: resource ? "observed" : "not_observed", resource, coverage: inventory.coverage };
  }
}
