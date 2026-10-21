import type { Scope } from "./domain.ts";
import { exactKeys, identifier, integer, object, string, text } from "./validation.ts";
import { ensure } from "../server/errors.ts";

export const evidenceSources = [
  "workload",
  "project",
  "logs",
  "events",
  "releases",
  "applets",
  "metrics",
] as const;
export type EvidenceSource = (typeof evidenceSources)[number];
export type EvidenceEntry = {
  id: string;
  source: EvidenceSource;
  state: "observed" | "empty" | "unknown" | "unavailable";
  at: number | null;
  summary: string;
  details: string[];
  code: string | null;
  fact:
    | { kind: "http"; origin: string; path: string; status: number }
    | { kind: "log"; message: string }
    | { kind: "env_keys"; keys: string[] }
    | null;
};
export type EvidenceBundle = {
  version: 1;
  mode: "simulated" | "provider_contract";
  scope: Scope;
  window: { start: number; end: number };
  collectedAt: number;
  entries: EvidenceEntry[];
};
export type Diagnosis = {
  status: "hypotheses" | "insufficient_evidence";
  summary: string;
  hypotheses: {
    category: "configuration" | "resources" | "code" | "unknown";
    explanation: string;
    evidenceIds: string[];
    nextCheck: string;
  }[];
  limitations: string[];
};

export function inWindow(entry: EvidenceEntry, bundle: EvidenceBundle): boolean {
  return entry.at !== null && entry.at >= bundle.window.start && entry.at <= bundle.window.end;
}

export function parseEvidenceBundle(value: unknown): EvidenceBundle {
  const raw = object(value),
    scope = object(raw.scope),
    window = object(raw.window);
  exactKeys(raw, ["version", "mode", "scope", "window", "collectedAt", "entries"]);
  exactKeys(scope, ["teamId", "app"]);
  exactKeys(window, ["start", "end"]);
  ensure(
    raw.version === 1 && (raw.mode === "simulated" || raw.mode === "provider_contract"),
    "EVIDENCE_INVALID",
    "نوع شواهد معتبر نیست.",
  );
  const teamId = string(scope.teamId, 24),
    app = identifier(scope.app);
  ensure(/^[a-f0-9]{24}$/.test(teamId), "EVIDENCE_INVALID", "تیم شاهد معتبر نیست.");
  const start = integer(window.start, 0, Number.MAX_SAFE_INTEGER),
    end = integer(window.end, start, start + 900_000);
  const collectedAt = integer(raw.collectedAt, 0, Number.MAX_SAFE_INTEGER);
  ensure(
    Array.isArray(raw.entries) && raw.entries.length > 0 && raw.entries.length <= 40,
    "EVIDENCE_INVALID",
    "تعداد شواهد معتبر نیست.",
  );
  const ids = new Set<string>();
  const entries = raw.entries.map((value: unknown): EvidenceEntry => {
    const row = object(value);
    exactKeys(row, ["id", "source", "state", "at", "summary", "details", "code", "fact"]);
    const id = identifier(row.id);
    ensure(!ids.has(id), "EVIDENCE_INVALID", "شناسه شاهد تکراری است.");
    ids.add(id);
    const source = evidenceSources.find((source) => source === row.source);
    ensure(
      source &&
        (row.state === "observed" ||
          row.state === "empty" ||
          row.state === "unknown" ||
          row.state === "unavailable"),
      "EVIDENCE_INVALID",
      "وضعیت شاهد معتبر نیست.",
    );
    ensure(
      Array.isArray(row.details) && row.details.length <= 8,
      "EVIDENCE_INVALID",
      "جزئیات شاهد بیش از سقف است.",
    );
    let fact: EvidenceEntry["fact"] = null;
    if (row.fact !== null) {
      const item = object(row.fact);
      ensure(row.state === "observed", "EVIDENCE_INVALID", "شاهد نامعلوم fact تأییدشده ندارد.");
      if (item.kind === "http") {
        exactKeys(item, ["kind", "origin", "path", "status"]);
        ensure(source === "workload", "EVIDENCE_INVALID", "منبع HTTP معتبر نیست.");
        fact = {
          kind: "http",
          origin: string(item.origin, 240),
          path: string(item.path, 200),
          status: integer(item.status, 100, 599),
        };
      } else if (item.kind === "log") {
        exactKeys(item, ["kind", "message"]);
        ensure(source === "logs", "EVIDENCE_INVALID", "منبع log معتبر نیست.");
        fact = { kind: "log", message: text(item.message, 2048) };
      } else if (item.kind === "env_keys") {
        exactKeys(item, ["kind", "keys"]);
        ensure(
          source === "project" && Array.isArray(item.keys) && item.keys.length <= 128,
          "EVIDENCE_INVALID",
          "منبع config معتبر نیست.",
        );
        fact = { kind: "env_keys", keys: item.keys.map((key: unknown) => string(key, 128)) };
      } else ensure(false, "EVIDENCE_INVALID", "نوع fact ناشناخته است.");
    }
    return {
      id,
      source,
      state: row.state,
      at: row.at === null ? null : integer(row.at, 0, Number.MAX_SAFE_INTEGER),
      summary: text(row.summary, 512),
      details: row.details.map((part: unknown) => text(part, 2048)),
      code: row.code === null ? null : identifier(row.code),
      fact,
    };
  });
  return {
    version: 1,
    mode: raw.mode,
    scope: { teamId, app },
    window: { start, end },
    collectedAt,
    entries,
  };
}

export function parseDiagnosis(value: unknown, bundle: EvidenceBundle): Diagnosis {
  const raw = object(value);
  exactKeys(raw, ["summary", "hypotheses"]);
  ensure(
    Array.isArray(raw.hypotheses) && raw.hypotheses.length <= 3,
    "DIAGNOSIS_INVALID",
    "فرضیه‌های مدل معتبر نیستند.",
  );
  const hypotheses = raw.hypotheses.map((value: unknown): Diagnosis["hypotheses"][number] => {
    const row = object(value);
    exactKeys(row, ["category", "explanation", "evidenceIds", "nextCheck"]);
    ensure(
      row.category === "configuration" ||
        row.category === "resources" ||
        row.category === "code" ||
        row.category === "unknown",
      "DIAGNOSIS_INVALID",
      "دسته فرضیه معتبر نیست.",
    );
    ensure(
      Array.isArray(row.evidenceIds) && row.evidenceIds.length > 0 && row.evidenceIds.length <= 5,
      "DIAGNOSIS_UNGROUNDED",
      "فرضیه به شاهد مشخص نیاز دارد.",
    );
    const evidenceIds = row.evidenceIds.map((value: unknown) => identifier(value));
    for (const id of evidenceIds) {
      const entry = bundle.entries.find((entry) => entry.id === id);
      ensure(
        entry &&
          (row.category === "unknown" || (entry.state === "observed" && inWindow(entry, bundle))),
        "DIAGNOSIS_UNGROUNDED",
        "شاهد فرضیه غایب، خارج بازه یا تأییدنشده است.",
      );
    }
    return {
      category: row.category,
      explanation: text(row.explanation, 1200),
      evidenceIds,
      nextCheck: text(row.nextCheck, 600),
    };
  });
  const hasSymptom = bundle.entries.some(
    (entry) => entry.fact?.kind === "http" && entry.fact.status >= 500 && inWindow(entry, bundle),
  );
  const limitations = [
    "فرضیه‌ها علت تأییدشده نیستند؛ اصلاح به approval مستقل و بررسی همان درخواست نیاز دارد.",
    ...bundle.entries
      .filter((entry) => entry.state !== "observed" || !inWindow(entry, bundle))
      .map((entry) => `${entry.id}: ${entry.summary}`),
  ];
  if (!hasSymptom)
    limitations.unshift("خطای HTTP در بازه انتخاب‌شده مشاهده نشده؛ نتیجه تشخیص قطعی نیست.");
  return {
    status:
      hasSymptom && hypotheses.some((item) => item.category !== "unknown")
        ? "hypotheses"
        : "insufficient_evidence",
    summary: text(raw.summary, 1200),
    hypotheses,
    limitations,
  };
}

export type Verification = {
  outcome: "verified" | "still_failing" | "inconclusive";
  reason: string;
  beforeId: string;
  afterId: string | null;
};
export function verifySameSymptom(before: EvidenceBundle, after: EvidenceBundle): Verification {
  const old = before.entries.find(
    (entry) => entry.fact?.kind === "http" && inWindow(entry, before),
  );
  const next = after.entries.find((entry) => entry.fact?.kind === "http" && inWindow(entry, after));
  const result = (outcome: Verification["outcome"], reason: string): Verification => ({
    outcome,
    reason,
    beforeId: old?.id || "missing",
    afterId: next?.id || null,
  });
  if (
    before.mode !== after.mode ||
    before.scope.teamId !== after.scope.teamId ||
    before.scope.app !== after.scope.app ||
    old?.fact?.kind !== "http" ||
    next?.fact?.kind !== "http" ||
    old.at === null ||
    next.at === null ||
    next.at <= old.at ||
    old.fact.origin !== next.fact.origin ||
    old.fact.path !== next.fact.path ||
    old.fact.status < 500
  )
    return result("inconclusive", "شاهد قبل/بعد متعلق به همان app، مقصد، مسیر و ترتیب زمان نیست.");
  if (next.fact.status >= 500)
    return result("still_failing", "همان درخواست هنوز خطای سرور دارد؛ اصلاح موفق نشده است.");
  if (next.fact.status < 200 || next.fact.status >= 300)
    return result("inconclusive", "پاسخ جدید موفقیت workload را تأیید نمی‌کند.");
  return result(
    "verified",
    "همان درخواست پس از اصلاح پاسخ موفق داد؛ این نتیجه فقط همین symptom و زمان را پوشش می‌دهد.",
  );
}
