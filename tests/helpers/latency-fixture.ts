import { parseEvidenceBundle, type EvidenceBundle } from "../../src/contracts/incident.ts";
export function latencyEvidence(
  now = Date.now(),
  durations: readonly number[] = [820, 910, 870],
  seriesId = "series-before",
): EvidenceBundle {
  return parseEvidenceBundle({
    version: 1,
    mode: "simulated",
    scope: { teamId: "a".repeat(24), app: "sample-node" },
    window: { start: now - 1000, end: now },
    collectedAt: now,
    entries: durations.map((durationMs, index) => ({
      id: `workload-${index + 1}`,
      source: "workload",
      state: "observed",
      at: now - (durations.length - index) * 10,
      summary: "زمان پاسخ نمونه؛ داده شبیه‌سازی‌شده",
      details: [],
      code: null,
      fact: {
        kind: "http",
        origin: "https://sample.example.com",
        path: "/orders",
        status: 200,
        durationMs,
        sampling: {
          protocol: "https-get-body-v1",
          seriesId,
          index: index + 1,
          count: 3,
          appId: "synthetic-app",
          responseHash: "a".repeat(64),
        },
      },
    })),
  });
}
