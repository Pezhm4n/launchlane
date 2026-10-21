import { object, string } from "../../contracts/validation.ts";
import { ensure } from "../errors.ts";

type RawPoint = { applet: string; values: (number | string)[] };
export type MetricEvidence = {
  state: "unknown";
  unit: "unverified";
  timestampUnit: "unverified";
  rawPoints: RawPoint[];
  reason: "missing" | "empty" | "unit_and_time_unverified";
};

function metric(value: unknown): MetricEvidence {
  if (value === null || value === undefined)
    return {
      state: "unknown",
      unit: "unverified",
      timestampUnit: "unverified",
      rawPoints: [],
      reason: "missing",
    };
  ensure(
    Array.isArray(value) && value.length <= 1000,
    "UPSTREAM_INVALID",
    "ساختار metric با قرارداد مستند تطبیق ندارد.",
    502,
  );
  const rawPoints = value.map((entry: unknown): RawPoint => {
    const row = object(entry);
    ensure(
      Array.isArray(row.value) &&
        row.value.length <= 1000 &&
        row.value.every(
          (part) =>
            (typeof part === "string" && part.length <= 100) ||
            (typeof part === "number" && Number.isFinite(part)),
        ),
      "UPSTREAM_INVALID",
      "نقطه metric معتبر نیست.",
      502,
    );
    return { applet: string(row.applet), values: row.value };
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

export function parseMetricSummary(value: unknown): {
  cpu: MetricEvidence;
  memory: MetricEvidence;
} {
  const raw = object(value);
  return { cpu: metric(raw.cpuUsage), memory: metric(raw.memoryUsage) };
}
