import type { Scope } from "../../contracts/domain.ts";
import { integer, string } from "../../contracts/validation.ts";
import type { Config } from "../config.ts";
import { AppError, ensure } from "../errors.ts";
import { authorizeScope } from "../policy/action.ts";
import type { RunBudget } from "../policy/budget.ts";
import {
  abortable,
  boundedJson,
  httpFailure,
  sendRead,
  type Transport,
  transport,
} from "../providers/http.ts";
import { parseMetricSummary } from "./metrics.ts";
import {
  parseApplets,
  parseEvents,
  parseLogsV2,
  explicitIsoTime,
  parseProject,
  parseReleases,
  parseBuildLogs,
} from "./read-contracts.ts";
export type { ReleasePage } from "./read-contracts.ts";

export class LiaraReadClient {
  readonly config: Config;
  readonly send: Transport;
  constructor(config: Config, send: Transport = transport) {
    this.config = config;
    this.send = send;
  }

  private async read<T>(
    scope: Scope,
    suffix: string,
    query: Record<string, string>,
    budget: RunBudget,
    signal: AbortSignal,
    parse: (value: unknown, secrets: readonly string[]) => T,
    version: "v1" | "v2" = "v1",
    buildReleaseId?: string,
  ): Promise<T> {
    authorizeScope(scope, this.config);
    // This gate precedes transport and budget, even when credentials are configured.
    ensure(
      this.config.enableLiveLiara,
      "LIVE_LIARA_DISABLED",
      "خواندن واقعی لیارا غیرفعال است؛ مسیر آفلاین در دسترس است.",
      403,
    );
    ensure(
      this.config.liaraToken,
      "LIARA_UNCONFIGURED",
      "توکن PaaS لیارا تنظیم نشده است؛ رمز ورود توکن API نیست.",
      503,
    );
    ensure(
      this.config.liaraBaseUrl === "https://api.liara.ir",
      "PROVIDER_HOST_DENIED",
      "میزبان API لیارا مجاز نیست.",
      403,
    );
    const url = new URL(
      buildReleaseId ? `/v2/releases/${buildReleaseId}/build-logs` : `/${version}/projects/${encodeURIComponent(scope.app)}${suffix}`,
      this.config.liaraBaseUrl,
    );
    url.searchParams.set("teamID", scope.teamId);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
    const boundedSignal = budget.signal(signal);
    try {
      // Bound both headers and body independently of a transport's abort implementation.
      const result = await abortable(async () => {
        const response = await sendRead(this.send, url.toString(), {
          method: "GET",
          redirect: "error",
          cache: "no-store",
          signal: boundedSignal,
          headers: {
            Authorization: `Bearer ${this.config.liaraToken}`,
            Accept: "application/json",
          },
        }, budget, boundedSignal);
        if (!response.ok) {
          await response.body?.cancel();
          throw httpFailure(response.status);
        }
        return parse(
          await boundedJson(response, buildReleaseId ? 1024 * 1024 : 256 * 1024),
          [
            this.config.liaraToken,
            this.config.modelKey,
            this.config.operatorToken,
            this.config.sessionSecret,
            ...this.config.projectSecretValues,
          ].filter(Boolean),
        );
      }, boundedSignal);
      ensure(
        !boundedSignal.aborted,
        signal.aborted ? "CANCELLED" : "BUDGET_EXHAUSTED",
        "پاسخ پس از پایان اجرا دریافت شد؛ نتیجه تأیید نشده است.",
        409,
      );
      return result;
    } catch (error) {
      if (boundedSignal.aborted)
        throw new AppError(
          signal.aborted ? "CANCELLED" : "BUDGET_EXHAUSTED",
          "خواندن لیارا کامل نشد.",
          409,
        );
      if (error instanceof AppError && error.code !== "INVALID_INPUT") throw error;
      throw new AppError(
        error instanceof AppError ? "UPSTREAM_INVALID" : "PROVIDER_TRANSPORT",
        "پاسخ لیارا با قرارداد تطبیق ندارد یا دریافت نشد؛ داده خالی فرض نشد.",
        502,
      );
    }
  }

  releases(scope: Scope, page: number, count: number, budget: RunBudget, signal: AbortSignal) {
    integer(page, 1, 1000);
    integer(count, 1, 50);
    return this.read(
      scope,
      "/releases",
      { page: String(page), count: String(count) },
      budget,
      signal,
      (value, secrets) => parseReleases(value, scope, page, count, secrets),
    );
  }
  async buildLogs(scope: Scope, releaseId: string, since: string | null, budget: RunBudget, signal: AbortSignal) {
    ensure(/^[a-f0-9]{24}$/.test(releaseId) && (since === null || explicitIsoTime(since) !== null), "INVALID_INPUT", "نسخه یا زمان گزارش ساخت معتبر نیست.");
    // This provider endpoint is global. Prove membership in the selected app before reading it.
    const page = await this.releases(scope, 1, 50, budget, signal);
    ensure(page.releases.some(release => release.id === releaseId), "RELEASE_SCOPE_DENIED", "نسخه باید از پنجاه نسخهٔ اخیر همین برنامه انتخاب شود.", 403);
    return this.read(scope, "/build-logs", { since: since ?? "undefined" }, budget, signal,
      (value, secrets) => parseBuildLogs(value, scope, releaseId, secrets, since), "v2", releaseId);
  }
  project(scope: Scope, budget: RunBudget, signal: AbortSignal) {
    return this.read(scope, "", {}, budget, signal, (value, secrets) =>
      parseProject(value, scope, secrets),
    );
  }
  logs(scope: Scope, since: string, budget: RunBudget, signal: AbortSignal) {
    string(since, 64);
    const start = explicitIsoTime(since);
    ensure(start !== null && start >= 0, "INVALID_INPUT", "زمان آغاز گزارش باید تاریخ معتبر باشد.");
    return this.read(
      scope,
      "/logs",
      { start: String(Math.floor(start / 1000)), direction: "forward", last_lines: "false" },
      budget,
      signal,
      (value, secrets) => parseLogsV2(value, since, secrets),
      "v2",
    );
  }
  events(scope: Scope, budget: RunBudget, signal: AbortSignal) {
    return this.read(scope, "/events", {}, budget, signal, parseEvents);
  }
  applets(scope: Scope, budget: RunBudget, signal: AbortSignal) {
    return this.read(scope, "/applets", {}, budget, signal, parseApplets);
  }
  metrics(scope: Scope, budget: RunBudget, signal: AbortSignal) {
    return this.read(scope, "/metrics/summary", {}, budget, signal, parseMetricSummary);
  }
}
