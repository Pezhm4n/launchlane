import type { EvidenceBundle, EvidenceEntry } from "./incident.ts";
import { exactKeys, hash, identifier, integer, object, string } from "./validation.ts";
import { ensure } from "../server/errors.ts";

export const latencyProtocol = "https-get-body-v1";
export const latencySampleCount = 3;
export type LatencySampling = {
  protocol: typeof latencyProtocol;
  seriesId: string;
  index: number;
  count: typeof latencySampleCount;
  appId: string;
  responseHash: string;
};
export function parseLatencySampling(value: unknown): LatencySampling {
  const row = object(value);
  exactKeys(row, ["protocol", "seriesId", "index", "count", "appId", "responseHash"]);
  ensure(
    row.protocol === latencyProtocol && row.count === latencySampleCount,
    "EVIDENCE_INVALID",
    "روش اندازه‌گیری زمان پاسخ معتبر نیست.",
  );
  return {
    protocol: latencyProtocol,
    seriesId: identifier(row.seriesId),
    index: integer(row.index, 1, latencySampleCount),
    count: latencySampleCount,
    appId: string(row.appId, 128),
    responseHash: hash(row.responseHash),
  };
}

type TimedHttp = EvidenceEntry & {
  at: number;
  fact: {
    kind: "http";
    origin: string;
    path: string;
    status: number;
    durationMs: number;
    sampling: LatencySampling;
  };
};
export type LatencySummary = {
  state: "complete" | "incomplete" | "not_measured";
  reason: string;
  samples: { id: string; at: number; durationMs: number; status: number }[];
  minMs: number | null;
  medianMs: number | null;
  maxMs: number | null;
};
function series(bundle: EvidenceBundle): TimedHttp[] {
  return bundle.entries.filter(
    (row): row is TimedHttp =>
      row.source === "workload" &&
      row.state === "observed" &&
      row.at !== null &&
      row.fact?.kind === "http" &&
      row.fact.durationMs !== undefined &&
      Number.isSafeInteger(row.fact.durationMs) &&
      row.fact.durationMs >= 0 &&
      row.fact.sampling !== undefined,
  );
}
export function summarizeLatency(bundle: EvidenceBundle): LatencySummary {
  const rows = series(bundle),
    first = rows[0];
  const base: LatencySummary = {
    state: rows.length ? "incomplete" : "not_measured",
    reason:
      "سه پاسخ قابل مقایسه ثبت نشده است؛ از یک زمان یا timeout نمی‌توان رفع کندی را نتیجه گرفت.",
    samples: rows.map((row) => ({
      id: row.id,
      at: row.at,
      durationMs: row.fact.durationMs,
      status: row.fact.status,
    })),
    minMs: null,
    medianMs: null,
    maxMs: null,
  };
  if (!first || rows.length !== latencySampleCount) return base;
  if (
    !rows.every(
      (row, index) =>
        row.at >= bundle.window.start &&
        row.at <= bundle.window.end &&
        row.at <= bundle.collectedAt &&
        row.at >= (rows[index - 1]?.at ?? 0) &&
        row.fact.status >= 200 &&
        row.fact.status < 300 &&
        row.fact.status === first.fact.status &&
        row.fact.origin === first.fact.origin &&
        row.fact.path === first.fact.path &&
        row.fact.sampling.protocol === first.fact.sampling.protocol &&
        row.fact.sampling.protocol === latencyProtocol &&
        row.fact.sampling.count === latencySampleCount &&
        row.fact.sampling.seriesId === first.fact.sampling.seriesId &&
        row.fact.sampling.appId === first.fact.sampling.appId &&
        row.fact.sampling.index === index + 1 &&
        row.fact.sampling.responseHash === first.fact.sampling.responseHash,
    )
  )
    return {
      ...base,
      reason: "زمان، پاسخ یا مقصد نمونه‌ها یکسان نیست؛ مقایسه سرعت قابل تأیید نیست.",
    };
  const durations = rows.map((row) => row.fact.durationMs).sort((a, b) => a - b);
  return {
    ...base,
    state: "complete",
    reason: "سه پاسخ کوتاه از همین صفحه اندازه‌گیری شد؛ این سنجش ظرفیت یا تجربه همه کاربران نیست.",
    minMs: durations[0] ?? null,
    medianMs: durations[1] ?? null,
    maxMs: durations[2] ?? null,
  };
}
export type LatencyComparison = {
  outcome: "lower_observed" | "higher_observed" | "overlapping" | "inconclusive";
  reason: string;
};
export function compareLatency(before: EvidenceBundle, after: EvidenceBundle): LatencyComparison {
  const left = summarizeLatency(before),
    right = summarizeLatency(after),
    old = series(before),
    fresh = series(after),
    a = old[0],
    b = fresh[0];
  const uncertain = (reason: string): LatencyComparison => ({ outcome: "inconclusive", reason });
  if (left.state !== "complete" || right.state !== "complete")
    return uncertain(
      "برای مقایسه، هر دو بررسی باید سه پاسخ معتبر از همان صفحه داشته باشند. پاسخ 200 به‌تنهایی رفع کندی نیست.",
    );
  if (
    !a ||
    !b ||
    before.mode !== after.mode ||
    before.scope.teamId !== after.scope.teamId ||
    before.scope.app !== after.scope.app ||
    a.fact.origin !== b.fact.origin ||
    a.fact.path !== b.fact.path ||
    a.fact.sampling.appId !== b.fact.sampling.appId ||
    a.fact.sampling.protocol !== b.fact.sampling.protocol ||
    a.fact.sampling.responseHash !== b.fact.sampling.responseHash ||
    a.fact.status !== b.fact.status ||
    a.fact.sampling.seriesId === b.fact.sampling.seriesId ||
    b.at <= (old.at(-1)?.at ?? Infinity)
  )
    return uncertain(
      "برنامه، پاسخ، روش یا ترتیب زمان دو بررسی متفاوت است؛ بهبود سرعت نتیجه نمی‌شود.",
    );
  if (right.maxMs !== null && left.minMs !== null && right.maxMs < left.minMs)
    return {
      outcome: "lower_observed",
      reason:
        "هر سه زمان تازه از نمونه‌های نخست کمتر بودند. فقط همین نمونه‌ها سریع‌تر پاسخ دادند؛ علت تغییر و رفع پایدار کندی تأیید نشده است.",
    };
  if (right.minMs !== null && left.maxMs !== null && right.minMs > left.maxMs)
    return {
      outcome: "higher_observed",
      reason:
        "هر سه زمان تازه از نمونه‌های نخست بیشتر بودند. کندترشدن این نمونه‌ها مشاهده شد؛ علت آن هنوز مشخص نیست.",
    };
  return {
    outcome: "overlapping",
    reason:
      "بازه زمان نمونه‌های قبل و بعد هم‌پوشانی دارد؛ کاهش روشن و پایدار زمان پاسخ تأیید نشده است.",
  };
}
