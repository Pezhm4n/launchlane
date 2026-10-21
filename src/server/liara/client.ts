import type { Scope } from "../../contracts/domain.ts";
import { integer, object, string } from "../../contracts/validation.ts";
import type { Config } from "../config.ts";
import { AppError, ensure } from "../errors.ts";
import { authorizeScope } from "../policy/action.ts";
import type { RunBudget } from "../policy/budget.ts";
import { boundedJson, httpFailure, type Transport, transport } from "../providers/http.ts";

export type ReleasePage = {
  evidence: "provider_response";
  scope: Scope;
  page: number;
  count: number;
  total: number;
  currentRelease: string | null;
  hasMore: boolean;
  releases: { id: string; state: string; port: number | null; committedAt: string | null }[];
};

export class LiaraReadClient {
  readonly config: Config;
  readonly send: Transport;
  constructor(config: Config, send: Transport = transport) {
    this.config = config;
    this.send = send;
  }

  async releases(
    scope: Scope,
    page: number,
    count: number,
    budget: RunBudget,
    signal: AbortSignal,
  ): Promise<ReleasePage> {
    authorizeScope(scope, this.config);
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
    integer(page, 1, 1000);
    integer(count, 1, 50);
    const url = new URL(
      `/v1/projects/${encodeURIComponent(scope.app)}/releases`,
      this.config.liaraBaseUrl,
    );
    url.searchParams.set("teamID", scope.teamId);
    url.searchParams.set("page", String(page));
    url.searchParams.set("count", String(count));
    budget.take("tool", signal);
    const boundedSignal = budget.signal(signal);
    try {
      const response = await this.send(url.toString(), {
        method: "GET",
        redirect: "error",
        cache: "no-store",
        signal: boundedSignal,
        headers: { Authorization: `Bearer ${this.config.liaraToken}`, Accept: "application/json" },
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw httpFailure(response.status);
      }
      const value = object(await boundedJson(response));
      const total = integer(value.total, 0, 1_000_000);
      ensure(
        Array.isArray(value.releases) && value.releases.length <= count,
        "UPSTREAM_INVALID",
        "صفحه release با قرارداد تطبیق ندارد.",
        502,
      );
      const releases = value.releases.map((raw: unknown) => {
        const release = object(raw);
        const git =
          release.gitInfo === undefined || release.gitInfo === null ? {} : object(release.gitInfo);
        const committedAt =
          git.committedAt === undefined || git.committedAt === null
            ? null
            : string(git.committedAt, 40);
        ensure(
          committedAt === null ||
            (/^\d{4}-\d\d-\d\dT/.test(committedAt) && Number.isFinite(Date.parse(committedAt))),
          "UPSTREAM_INVALID",
          "زمان release معتبر نیست.",
          502,
        );
        return {
          id: string(release._id, 128),
          state: string(release.state, 64),
          port:
            release.port === undefined || release.port === null
              ? null
              : integer(release.port, 1, 65535),
          committedAt,
        };
      });
      return {
        evidence: "provider_response",
        scope,
        page,
        count,
        total,
        hasMore: page * count < total,
        currentRelease:
          value.currentRelease === undefined || value.currentRelease === null
            ? null
            : string(value.currentRelease, 128),
        releases,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        boundedSignal.aborted ? "CANCELLED" : "PROVIDER_TRANSPORT",
        "خواندن لیارا کامل نشد؛ داده خالی یا موفق فرض نشد.",
        502,
      );
    }
  }
}
