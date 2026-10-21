import { object, string } from "../../contracts/validation.ts";
import { ensure } from "../errors.ts";
import { evidenceText } from "./read-contracts.ts";

type RawPoint = { applet: string; values: (number | string)[] };
export type MetricEvidence = {
  state: "unknown";
  unit: "unverified";
  timestampUnit: "unverified";
  rawPoints: RawPoint[];
  reason: "missing" | "empty" | "unit_and_time_unverified";
};

function metric(value: unknown, secrets: readonly string[]): MetricEvidence {
  if (value === null || value === undefined)
    return {
      state: "unknown",
      unit: "unverified",
      timestampUnit: "unverified",
      rawPoints: [],
      reason: "missing",
    };
  ensure(
    Array.isArray(value) && value.length <= 100,
    "UPSTREAM_INVALID",
    "ساختار metric با قرارداد مستند تطبیق ندارد.",
    502,
  );
  const rawPoints = value.map((entry: unknown): RawPoint => {
    const row = object(entry);
    ensure(
      Array.isArray(row.value) &&
        row.value.length <= 16 &&
        row.value.every(
          (part) =>
            (typeof part === "string" && part.length <= 100) ||
            (typeof part === "number" && Number.isFinite(part)),
        ),
      "UPSTREAM_INVALID",
      "نقطه metric معتبر نیست.",
      502,
    );
    return {
      applet: evidenceText(string(row.applet), 128, secrets),
      values: row.value.map((part: number | string) =>
        typeof part === "string" ? evidenceText(part, 100, secrets) : part,
      ),
    };
  });
  // The pinned schema does not establish units or tuple order. Do not infer percent, bytes or seconds.
  return {
    state: "unknown",
    unit: "unverified",
    timestampUnit: "unverified",
    rawPoints,
    reason: rawPoints.length ? "unit_and_time_unverified" : "empty",
  };
}

export function parseMetricSummary(
  value: unknown,
  secrets: readonly string[] = [],
): {
  cpu: MetricEvidence;
  memory: MetricEvidence;
} {
  const raw = object(value);
  return { cpu: metric(raw.cpuUsage, secrets), memory: metric(raw.memoryUsage, secrets) };
}
