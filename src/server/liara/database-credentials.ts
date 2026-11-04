import { databaseHostname, type DatabaseResourceSpec } from "../../contracts/database-provision.ts";
import type { Scope } from "../../contracts/domain.ts";
import { object, string, integer, hasControl, identifier } from "../../contracts/validation.ts";
import { providerObjectId } from "../../contracts/provision.ts";
import type { Config } from "../config.ts";
import { AppError, ensure } from "../errors.ts";
import { authorizeScope } from "../policy/action.ts";
import type { RunBudget } from "../policy/budget.ts";
import { abortable, boundedJson, httpFailure, sendRead, transport, type Transport } from "../providers/http.ts";
import { containsCredential } from "../policy/redaction.ts";

/** Private adapter result: callers must pass it directly to encrypted input storage, never tools/UI/logs. */
export class LiaraDatabaseCredentialsClient {
  readonly config: Config; readonly send: Transport;
  constructor(config: Config, send: Transport = transport) { this.config = config; this.send = send; }
  private async details(scope: Scope, databaseId: string, budget: RunBudget, signal: AbortSignal) {
    authorizeScope(scope, this.config); providerObjectId(databaseId);
    ensure(this.config.enableLiveLiara && this.config.liaraToken && this.config.liaraBaseUrl === "https://api.liara.ir", "LIARA_UNCONFIGURED", "اتصال مجاز دیتابیس آماده نیست.", 503);
    const url = new URL(`/v1/databases/${databaseId}`, this.config.liaraBaseUrl); url.searchParams.set("teamID", scope.teamId);
    const bounded = budget.signal(signal);
    try {
      return await abortable(async () => {
        const response = await sendRead(this.send, url.href, { method: "GET", redirect: "error", cache: "no-store", signal: bounded,
          headers: { Authorization: `Bearer ${this.config.liaraToken}`, Accept: "application/json" } }, budget, bounded);
        if (!response.ok) { await response.body?.cancel().catch(() => undefined); throw httpFailure(response.status); }
        const row = object(object(await boundedJson(response, 128 * 1024)).database);
        ensure(!bounded.aborted && row.id === databaseId && (row._id === undefined || row._id === databaseId), "DATABASE_DETAILS_CHANGED", "هویت دیتابیس تأیید نشد.", 409);
        return row;
      }, bounded);
    } catch (error) {
      if (error instanceof AppError && error.code.startsWith("PROVIDER_")) throw error;
      throw new AppError("DATABASE_CREDENTIALS_UNAVAILABLE", "اطلاعات اتصال خصوصی دیتابیس قابل تأیید نیست؛ چیزی به برنامه منتقل نشد.", 409);
    }
  }
  /** Whitelisted identity only. Password-bearing provider details never enter the tool result. */
  async inspect(scope: Scope, databaseId: string, budget: RunBudget, signal: AbortSignal) {
    const row = await this.details(scope, databaseId, budget, signal), version = string(row.version, 64);
    ensure(row.publicNetwork === false && object(row.metaData).privateNetwork === true && /^[A-Za-z0-9][A-Za-z0-9._+-]*$/.test(version),
      "DATABASE_DETAILS_CHANGED", "دیتابیس باید خصوصی و نسخهٔ آن مشخص باشد.", 409);
    const result = { id: databaseId, hostname: databaseHostname(row.hostname), type: identifier(row.type), version,
      planId: identifier(row.planID), networkId: providerObjectId(object(row.network)._id), publicNetwork: false as const };
    ensure(!containsCredential(JSON.stringify(result), [this.config.liaraToken, this.config.modelKey, this.config.operatorToken, this.config.sessionSecret,
      ...this.config.projectSecretValues, ...(typeof row.root_password === "string" ? [row.root_password] : [])].filter(Boolean)),
      "SENSITIVE_RESPONSE", "اطلاعات هویت دیتابیس قابل نمایش نیست.", 502);
    return result;
  }
  async read(spec: DatabaseResourceSpec, databaseId: string, budget: RunBudget, signal: AbortSignal) {
    try {
        ensure(spec.version !== 29 || spec.databaseId === databaseId, "DATABASE_DETAILS_CHANGED", "شناسهٔ دیتابیس با انتخاب برابر نیست.", 409);
        const row = await this.details(spec.scope, databaseId, budget, signal), requested = spec.database;
        // Official DB-details documents id, username, root_password, dbName, internalPort and hostname.
        // Unknown aliases, hidden values, public endpoints or changed configuration fail closed.
        ensure(row.id === databaseId && (row._id === undefined || row._id === databaseId) && row.hostname === requested.hostname && row.type === requested.type &&
          row.version === requested.version && row.planID === requested.planId && row.publicNetwork === false && object(row.metaData).privateNetwork === true,
          "DATABASE_DETAILS_CHANGED", "هویت یا تنظیمات خصوصی دیتابیس تأیید نشد؛ اطلاعاتی به برنامه منتقل نشد.", 409);
        if (row.network !== undefined || spec.version === 29) ensure(object(row.network)._id === requested.networkId, "DATABASE_NETWORK_CHANGED", "شبکه دیتابیس تغییر کرده است.", 409);
        const password = string(row.root_password, 4096), username = string(row.username, 128), database = string(row.dbName, 128), port = integer(row.internalPort, 1, 65535);
        ensure(password.length >= 8 && !hasControl(password) && /^[A-Za-z0-9_.-]+$/.test(username) && /^[A-Za-z0-9_.-]+$/.test(database),
          "DATABASE_CREDENTIALS_UNAVAILABLE", "اطلاعات اتصال خصوصی کامل و معتبر نیست.", 409);
        return { host: requested.hostname, port, username, password, database };
    } catch (error) {
      if (error instanceof AppError && error.code.startsWith("PROVIDER_")) throw error;
      throw new AppError("DATABASE_CREDENTIALS_UNAVAILABLE", "اطلاعات اتصال خصوصی دیتابیس قابل تأیید نیست؛ چیزی به برنامه منتقل نشد.", 409);
    }
  }
}
