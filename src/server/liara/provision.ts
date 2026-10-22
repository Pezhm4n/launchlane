import { object } from "../../contracts/validation.ts";
import { providerObjectId, type ProvisionSpec } from "../../contracts/provision.ts";
import type { Config } from "../config.ts";
import { AppError, ensure } from "../errors.ts";
import { authorizeScope } from "../policy/action.ts";
import type { RunBudget } from "../policy/budget.ts";
import { abortable, boundedJson, httpFailure, transport, type Transport } from "../providers/http.ts";
import { containsCredential } from "../policy/redaction.ts";

export class LiaraProvisionClient {
  readonly config: Config;
  readonly send: Transport;
  constructor(config: Config, send: Transport = transport) { this.config = config; this.send = send; }
  async create(spec: ProvisionSpec, budget: RunBudget, signal: AbortSignal): Promise<string> {
    authorizeScope(spec.scope, this.config);
    ensure(this.config.enableMutations && this.config.enableLiveLiara, "MUTATIONS_DISABLED", "ساخت واقعی مقصد در این نصب خاموش است.", 403);
    ensure(this.config.liaraToken && this.config.liaraBaseUrl === "https://api.liara.ir", "LIARA_UNCONFIGURED", "اتصال مجاز لیارا آماده نیست.", 503);
    const url = new URL("/v1/projects", this.config.liaraBaseUrl); url.searchParams.set("teamID", spec.scope.teamId);
    budget.take("tool", signal);
    const bounded = budget.signal(signal);
    try {
      const response = await abortable(() => this.send(url.href, { method: "POST", redirect: "error", cache: "no-store", signal: bounded,
        headers: { Authorization: `Bearer ${this.config.liaraToken}`, Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ name: spec.scope.app, planID: spec.args.planId, bundlePlanID: spec.bundleId, platform: "node", network: spec.networkId, readOnlyRootFilesystem: true }),
      }), bounded);
      if (response.status !== 200) { await response.body?.cancel(); throw httpFailure(response.status); }
      const raw = object(await abortable(() => boundedJson(response, 16384), bounded));
      ensure(!bounded.aborted, "UPSTREAM_UNCERTAIN", "پاسخ ساخت پس از پایان مهلت دریافت شد.", 409);
      const id = providerObjectId(raw.projectID);
      ensure(!containsCredential(id, [this.config.liaraToken, this.config.modelKey, this.config.operatorToken, this.config.sessionSecret].filter(Boolean)),
        "SENSITIVE_RESPONSE", "شناسه برگشتی شامل اطلاعات محرمانه است.", 502);
      return id;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("UPSTREAM_UNCERTAIN", "پاسخ قطعی ساخت مقصد دریافت نشد؛ ارسال خودکار تکرار نمی‌شود.", 409);
    }
  }
}
