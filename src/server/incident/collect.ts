import type { Scope } from "../../contracts/domain.ts";
import {
  parseEvidenceBundle,
  type EvidenceBundle,
  type EvidenceEntry,
  type EvidenceSource,
} from "../../contracts/incident.ts";
import { integer, string } from "../../contracts/validation.ts";
import { AppError, ensure } from "../errors.ts";
import type { LiaraReadClient } from "../liara/client.ts";
import type { WorkloadProbe } from "../liara/probe.ts";
import { authorizeScope } from "../policy/action.ts";
import type { RunBudget } from "../policy/budget.ts";

export async function collectEvidence(
  client: LiaraReadClient,
  probe: WorkloadProbe,
  input: {
    scope: Scope;
    expectedAppId?: string;
    start: number;
    end: number;
    since: string;
    path: string;
  },
  budget: RunBudget,
  signal: AbortSignal,
): Promise<EvidenceBundle> {
  authorizeScope(input.scope, client.config);
  ensure(
    client.config.enableLiveLiara,
    "LIVE_LIARA_DISABLED",
    "جمع‌آوری واقعی شواهد غیرفعال است؛ می‌توانید تمرین آفلاین را اجرا کنید.",
    403,
  );
  integer(input.start, 0, Number.MAX_SAFE_INTEGER);
  integer(input.end, input.start, input.start + 900_000);
  string(input.since, 64);
  const expectedAppId = input.expectedAppId === undefined ? null : string(input.expectedAppId, 128);
  const entries: EvidenceEntry[] = [];
  const controller = new AbortController(),
    boundedSignal = AbortSignal.any([signal, controller.signal, budget.signal(signal)]);
  const checkedProject = async () => {
    const value = await client.project(input.scope, budget, boundedSignal);
    ensure(
      value.id === expectedAppId,
      "SCOPE_MISMATCH",
      "هویت برنامه در لیارا تغییر کرده است؛ اتصال و مقصد را دوباره بررسی کنید.",
      409,
    );
    return value;
  };
  // A persisted incident belongs to an app identity, not a reusable public name.
  const project = expectedAppId ? await checkedProject() : null;
  const entry = (
    source: EvidenceSource,
    state: EvidenceEntry["state"],
    summary: string,
    details: string[] = [],
    fact: EvidenceEntry["fact"] = null,
    at: number | null = Date.now(),
  ): EvidenceEntry => ({
    id: `${source}-${entries.length + 1}`,
    source,
    state,
    summary,
    details,
    at,
    fact,
    code: null,
  });
  const read = async (source: EvidenceSource, run: () => Promise<EvidenceEntry[]>) => {
    try {
      return await run();
    } catch (error) {
      if (
        signal.aborted ||
        boundedSignal.aborted ||
        (error instanceof AppError && ["CANCELLED", "BUDGET_EXHAUSTED"].includes(error.code))
      ) {
        controller.abort();
        throw error;
      }
      return [
        {
          ...entry(
            source,
            "unavailable",
            "خواندن این منبع کامل نشد؛ داده خالی فرض نشده است.",
            [],
            null,
            null,
          ),
          code: error instanceof AppError ? error.code : "PROVIDER_TRANSPORT",
        },
      ];
    }
  };
  // Seven independent reads share one deadline. A failed source is visible; cancellation ends the run.
  const groups = await Promise.all([
    read("workload", async () => {
      const value = await probe.check(input.scope, input.path, budget, boundedSignal);
      return [
        entry(
          "workload",
          value.outcome === "response" ? "observed" : "unknown",
          value.outcome === "response"
            ? `HTTP ${value.status} در مسیر ${value.path}`
            : "ارجاع به نشانی دیگر دنبال نشد؛ نتیجه بازشدن صفحه مشخص نیست.",
          value.body ? [value.body.slice(0, 1000)] : [],
          value.outcome === "response"
            ? {
                kind: "http",
                origin: value.origin,
                path: value.path,
                status: value.status,
                durationMs: Math.round(value.durationMs),
              }
            : null,
          value.observedAt,
        ),
      ];
    }),
    read("project", async () => {
      const value = project ?? (await client.project(input.scope, budget, boundedSignal));
      return [
        entry(
          "project",
          "observed",
          `پیکربندی ${input.scope.app}: فقط نام متغیرها`,
          ["کامل‌بودن و مقدار متغیرهای محیطی هنوز تأیید نشده‌اند."],
          { kind: "env_keys", keys: value.envKeys },
        ),
      ];
    }),
    read("logs", async () => {
      const value = await client.logs(input.scope, input.since, budget, boundedSignal);
      if (!value.entries.length)
        return [entry("logs", "empty", "گزارش‌های برنامه پاسخ خالی دادند.", [], null, null)];
      return value.entries.slice(-20).map((log, index) => ({
        ...entry(
          "logs",
          "observed",
          "پیام برنامه؛ محتوای نامطمئن",
          log.rawTime ? [`زمان خام: ${log.rawTime}`] : [],
          log.message ? { kind: "log", message: log.message.slice(0, 600) } : null,
          log.timeMs,
        ),
        id: `log-${index + 1}`,
      }));
    }),
    read("events", async () => {
      const value = await client.events(input.scope, budget, boundedSignal);
      return [
        entry(
          "events",
          value.series.length ? "unknown" : "empty",
          value.series.length
            ? "رویداد دریافت شد؛ واحد زمان و ترتیب داده‌ها هنوز قابل تفسیر نیست."
            : "رویدادی در پاسخ وجود نداشت.",
          [],
          null,
          null,
        ),
      ];
    }),
    read("releases", async () => {
      const value = await client.releases(input.scope, 1, 5, budget, boundedSignal);
      return [
        entry(
          "releases",
          value.releases.length ? "observed" : "empty",
          value.currentRelease
            ? `نسخه فعلی: ${value.currentRelease}`
            : "نسخه فعلی در پاسخ مشخص نیست.",
          [
            ...value.releases.slice(0, 5).map((release) => `${release.id}: ${release.state}`),
            value.hasMore
              ? "تاریخچه صفحه‌های بعد دارد؛ این بررسی همه انتشارها را پوشش نمی‌دهد."
              : "فقط همین صفحه بررسی شد.",
            "زمان ثبت کد، زمان انتشار نیست؛ پاسخ خود سایت جداگانه بررسی می‌شود.",
          ],
        ),
      ];
    }),
    read("applets", async () => {
      const value = await client.applets(input.scope, budget, boundedSignal);
      return [
        entry(
          "applets",
          value.applets.length ? "unknown" : "empty",
          "وضعیت اجرای برنامه به‌تنهایی درست بازشدن سایت را ثابت نمی‌کند.",
          value.applets.slice(0, 5).map((applet) => `${applet.name}: ${applet.state}`),
        ),
      ];
    }),
    read("metrics", async () => {
      const value = await client.metrics(input.scope, budget, boundedSignal);
      return [
        entry(
          "metrics",
          "unknown",
          "پردازنده و حافظه: واحد و زمان داده‌ها تأیید نشده‌اند.",
          [`CPU: ${value.cpu.reason}`, `RAM: ${value.memory.reason}`],
          null,
          null,
        ),
      ];
    }),
  ]);
  // Reject a mixed snapshot if the provider replaced the app while the reads were running.
  if (expectedAppId) await checkedProject();
  ensure(
    !boundedSignal.aborted && Date.now() < budget.deadline,
    signal.aborted ? "CANCELLED" : "BUDGET_EXHAUSTED",
    "جمع‌آوری شواهد کامل نشد.",
    409,
  );
  groups.forEach((group) => {
    entries.push(...group);
  });
  // IDs are assigned after concurrent reads so completion order cannot create duplicate references.
  entries.forEach((item, index) => {
    item.id = `${item.source}-${index + 1}`;
  });
  const collectedAt = Date.now();
  return parseEvidenceBundle({
    version: 1,
    mode: "provider_contract",
    scope: input.scope,
    window: { start: input.start, end: Math.min(input.end, collectedAt) },
    collectedAt,
    entries,
  });
}
