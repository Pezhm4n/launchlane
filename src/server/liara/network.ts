import type { NetworkSpec } from "../../contracts/network.ts";
import type { Config } from "../config.ts";
import { ensure } from "../errors.ts";
import { authorizeScope } from "../policy/action.ts";
import type { RunBudget } from "../policy/budget.ts";
import { abortable, httpFailure, transport, type Transport } from "../providers/http.ts";

export class LiaraNetworkClient {
  readonly config: Config;
  readonly send: Transport;
  constructor(config: Config, send: Transport = transport) { this.config = config; this.send = send; }
  async create(spec: NetworkSpec, budget: RunBudget, signal: AbortSignal): Promise<void> {
    authorizeScope(spec.scope, this.config);
    ensure(this.config.enableMutations && this.config.enableLiveLiara && this.config.liaraToken && this.config.liaraBaseUrl === "https://api.liara.ir",
      "MUTATIONS_DISABLED", "اتصال مجاز ساخت شبکه آماده نیست.", 403);
    const url = new URL("/v1/networks", this.config.liaraBaseUrl);
    url.searchParams.set("teamID", spec.scope.teamId);
    budget.take("tool", signal);
    const bounded = budget.signal(signal);
    const response = await abortable(() => this.send(url.href, {
      method: "POST", redirect: "error", cache: "no-store", signal: bounded,
      headers: { Authorization: `Bearer ${this.config.liaraToken}`, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ networkName: spec.networkName }),
    }), bounded);
    await response.body?.cancel();
    // The official CLI ignores the response body. Identity comes from the separate account-scoped readback.
    ensure(response.ok, "NETWORK_CREATE_REJECTED", httpFailure(response.status).message, 502);
    ensure(!bounded.aborted, "UPSTREAM_UNCERTAIN", "پاسخ ساخت شبکه پس از مهلت رسید؛ ارسال تکرار نمی‌شود.", 409);
  }
}
