import type { RestartSpec } from "../../contracts/restart.ts";
import type { Config } from "../config.ts";
import { AppError, ensure } from "../errors.ts";
import { authorizeScope, parseActionSpec } from "../policy/action.ts";
import type { RunBudget } from "../policy/budget.ts";
import { abortable, httpFailure, transport, type Transport } from "../providers/http.ts";

export class LiaraRestartClient {
  readonly config: Config;
  readonly send: Transport;
  constructor(config: Config, send: Transport = transport) {
    this.config = config;
    this.send = send;
  }

  async restart(spec: RestartSpec, budget: RunBudget, signal: AbortSignal): Promise<void> {
    ensure(
      parseActionSpec(spec).version === 6,
      "RESTART_PROPOSAL_REQUIRED",
      "پیشنهاد تازه راه‌اندازی دوباره لازم است.",
      409,
    );
    authorizeScope(spec.scope, this.config);
    ensure(
      this.config.enableMutations && this.config.enableLiveLiara,
      "MUTATIONS_DISABLED",
      "راه‌اندازی دوباره واقعی در این نصب غیرفعال است.",
      403,
    );
    ensure(
      this.config.liaraToken && this.config.liaraBaseUrl === "https://api.liara.ir",
      "LIARA_UNCONFIGURED",
      "اتصال مجاز لیارا آماده نیست.",
      503,
    );
    const url = new URL(
      `/v1/projects/${encodeURIComponent(spec.scope.app)}/actions/restart`,
      this.config.liaraBaseUrl,
    );
    url.searchParams.set("teamID", spec.scope.teamId);
    budget.take("tool", signal);
    const bounded = budget.signal(signal);
    try {
      const response = await abortable(
        () =>
          this.send(url.toString(), {
            method: "POST",
            redirect: "error",
            cache: "no-store",
            signal: bounded,
            headers: {
              Authorization: `Bearer ${this.config.liaraToken}`,
              Accept: "application/json",
            },
          }),
        bounded,
      );
      // The pinned contract guarantees only HTTP 200 acceptance, with no body or operation ID.
      // Discard provider content: neither a message nor a release ID proves restart completion.
      void response.body?.cancel().catch(() => undefined);
      if (!response.ok) throw httpFailure(response.status);
      ensure(
        response.status === 200 && !bounded.aborted,
        "UPSTREAM_UNCERTAIN",
        "پذیرش درخواست با قرارداد تطبیق ندارد.",
        409,
      );
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        "UPSTREAM_UNCERTAIN",
        "پاسخ قطعی راه‌اندازی دوباره دریافت نشد؛ ارسال خودکار تکرار نمی‌شود.",
        409,
      );
    }
  }
}
