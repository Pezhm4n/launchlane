import type { DatabaseProvisionSpec } from "../../contracts/database-provision.ts";
import { object, string, integer, hasControl } from "../../contracts/validation.ts";
import { providerObjectId } from "../../contracts/provision.ts";
import type { Config } from "../config.ts";
import { AppError, ensure } from "../errors.ts";
import { authorizeScope } from "../policy/action.ts";
import type { RunBudget } from "../policy/budget.ts";
import { abortable, boundedJson, httpFailure, sendRead, transport, type Transport } from "../providers/http.ts";

/** Private adapter result: callers must pass it directly to encrypted input storage, never tools/UI/logs. */
export class LiaraDatabaseCredentialsClient {
  readonly config: Config; readonly send: Transport;
  constructor(config: Config, send: Transport = transport) { this.config = config; this.send = send; }
  async read(spec: DatabaseProvisionSpec, databaseId: string, budget: RunBudget, signal: AbortSignal) {
    authorizeScope(spec.scope, this.config); providerObjectId(databaseId);
    ensure(this.config.enableLiveLiara && this.config.liaraToken && this.config.liaraBaseUrl === "https://api.liara.ir", "LIARA_UNCONFIGURED", "اتصال مجاز دیتابیس آماده نیست.", 503);
    const url = new URL(`/v1/databases/${databaseId}`, this.config.liaraBaseUrl); url.searchParams.set("teamID", spec.scope.teamId);
    const bounded = budget.signal(signal);
    try {
      return await abortable(async () => {
        const response = await sendRead(this.send, url.href, { method: "GET", redirect: "error", cache: "no-store", signal: bounded,
          headers: { Authorization: `Bearer ${this.config.liaraToken}`, Accept: "application/json" } }, budget, bounded);
        if (!response.ok) { await response.body?.cancel().catch(() => undefined); throw httpFailure(response.status); }
        const row = object(object(await boundedJson(response, 128 * 1024)).database), requested = spec.database;
        // Official DB-details documents id, username, root_password, dbName, internalPort and hostname.
        // Unknown aliases, hidden values, public endpoints or changed configuration fail closed.
        ensure(row.id === databaseId && (row._id === undefined || row._id === databaseId) && row.hostname === requested.hostname && row.type === requested.type &&
          row.version === requested.version && row.planID === requested.planId && row.publicNetwork === false && object(row.metaData).privateNetwork === true,
          "DATABASE_DETAILS_CHANGED", "هویت یا تنظیمات خصوصی دیتابیس تأیید نشد؛ اطلاعاتی به برنامه منتقل نشد.", 409);
        if (row.network !== undefined) ensure(object(row.network)._id === requested.networkId, "DATABASE_NETWORK_CHANGED", "شبکه دیتابیس تغییر کرده است.", 409);
        const password = string(row.root_password, 4096), username = string(row.username, 128), database = string(row.dbName, 128), port = integer(row.internalPort, 1, 65535);
        ensure(password.length >= 8 && !hasControl(password) && /^[A-Za-z0-9_.-]+$/.test(username) && /^[A-Za-z0-9_.-]+$/.test(database),
          "DATABASE_CREDENTIALS_UNAVAILABLE", "اطلاعات اتصال خصوصی کامل و معتبر نیست.", 409);
        return { host: requested.hostname, port, username, password, database };
      }, bounded);
    } catch (error) {
      if (error instanceof AppError && error.code.startsWith("PROVIDER_")) throw error;
      throw new AppError("DATABASE_CREDENTIALS_UNAVAILABLE", "اطلاعات اتصال خصوصی دیتابیس قابل تأیید نیست؛ چیزی به برنامه منتقل نشد.", 409);
    }
  }
}
