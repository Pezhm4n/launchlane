import type { DatabaseProvisionSpec } from "../../contracts/database-provision.ts";
import { providerObjectId } from "../../contracts/provision.ts";
import { object } from "../../contracts/validation.ts";
import type { Config } from "../config.ts";
import { ensure } from "../errors.ts";
import { authorizeScope } from "../policy/action.ts";
import type { RunBudget } from "../policy/budget.ts";
import { abortable, boundedJson, httpFailure, transport, type Transport } from "../providers/http.ts";

/** CLI db/create: one POST. HTTP acceptance is not identity, configuration or data-plane proof. */
export class LiaraDatabaseProvisionClient {
  readonly config: Config;
  readonly send: Transport;
  constructor(config: Config, send: Transport = transport) { this.config = config; this.send = send; }
  async create(spec: DatabaseProvisionSpec, budget: RunBudget, signal: AbortSignal): Promise<{ databaseId: string | null }> {
    authorizeScope(spec.scope, this.config);
    ensure(this.config.enableMutations && this.config.enableLiveLiara && this.config.liaraToken && this.config.liaraBaseUrl === "https://api.liara.ir",
      "MUTATIONS_DISABLED", "اتصال مجاز ساخت دیتابیس آماده نیست.", 403);
    const url = new URL("/v1/databases", this.config.liaraBaseUrl); url.searchParams.set("teamID", spec.scope.teamId);
    const database = spec.database;
    budget.take("tool", signal); const bounded = budget.signal(signal);
    const response = await abortable(() => this.send(url.href, { method: "POST", redirect: "error", cache: "no-store", signal: bounded,
      headers: { Authorization: `Bearer ${this.config.liaraToken}`, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ hostname: database.hostname, planID: database.planId, bundlePlanID: database.bundleId,
        publicNetwork: false, type: database.type, version: database.version, network: database.networkId }) }), bounded);
    try {
      ensure(response.ok, "DATABASE_CREATE_REJECTED", httpFailure(response.status).message, 502);
      // Only an explicit provider object ID can correlate the accepted request with inventory.
      // Empty/unknown response shapes remain accepted-but-unverified; never recover by hostname alone.
      let databaseId: string | null = null;
      if (response.headers.get("content-type")?.toLowerCase().includes("application/json")) {
        const root = object(await boundedJson(response, 64 * 1024));
        if (root.databaseID !== undefined) databaseId = providerObjectId(root.databaseID);
      }
      ensure(!bounded.aborted, "UPSTREAM_UNCERTAIN", "پاسخ دیتابیس پس از مهلت رسید؛ ساخت تکرار نمی‌شود.", 409);
      return { databaseId };
    } finally { await response.body?.cancel().catch(() => undefined); }
  }
}
