import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseEvidenceBundle,
  verifySameSymptom,
  type EvidenceBundle,
} from "../../src/contracts/incident.ts";
import { compareLatency, summarizeLatency } from "../../src/contracts/latency.ts";
import { latencyEvidence } from "../helpers/latency-fixture.ts";
import { object } from "../../src/contracts/validation.ts";

const start = 1_000_000;
const before = latencyEvidence(start),
  after = latencyEvidence(start + 10_000, [110, 140, 120], "series-after");
function changed(bundle: EvidenceBundle, change: (raw: Record<string, unknown>) => void): unknown {
  const raw = object(JSON.parse(JSON.stringify(bundle)));
  change(raw);
  return raw;
}
test("latency summaries report three actual sample values, range and median without a percentile or a resource diagnosis", () => {
  const result = summarizeLatency(before);
  assert.equal(result.state, "complete");
  assert.deepEqual(
    result.samples.map((row) => row.durationMs),
    [820, 910, 870],
  );
  assert.deepEqual([result.minMs, result.medianMs, result.maxMs], [820, 870, 910]);
  assert.ok(!("p95" in result) && !("cpu" in result) && !("confidence" in result));
  assert.equal(compareLatency(before, after).outcome, "lower_observed");
  assert.equal(
    verifySameSymptom(before, after).outcome,
    "inconclusive",
    "HTTP health must not become a latency-fix claim",
  );
});
test("a near unchanged case and an overlapping noisy sample cannot claim lower latency", () => {
  assert.equal(
    compareLatency(before, latencyEvidence(start + 10_000, [820, 910, 870], "unchanged")).outcome,
    "overlapping",
  );
  assert.equal(
    compareLatency(before, latencyEvidence(start + 10_000, [800, 900, 950], "noisy")).outcome,
    "overlapping",
  );
  assert.equal(
    compareLatency(before, latencyEvidence(start + 10_000, [1100, 1200, 1300], "slower")).outcome,
    "higher_observed",
  );
});
test("different account, app identity, origin, page, response and non-fresh samples cannot be compared", () => {
  const variants: EvidenceBundle[] = [
    { ...after, mode: "provider_contract" },
    { ...after, scope: { ...after.scope, teamId: "b".repeat(24) } },
    { ...after, scope: { ...after.scope, app: "another-app" } },
    latencyEvidence(start - 5000, [10, 20, 15], "older"),
  ];
  for (const field of ["origin", "path", "appId", "responseHash", "seriesId"] as const) {
    variants.push({
      ...after,
      entries: after.entries.map((row) => ({
        ...row,
        fact:
          row.fact?.kind === "http" && row.fact.sampling
            ? {
                ...row.fact,
                ...(field === "origin"
                  ? { origin: "https://other.example.com" }
                  : field === "path"
                    ? { path: "/healthz" }
                    : {}),
                sampling: {
                  ...row.fact.sampling,
                  ...(field === "appId"
                    ? { appId: "replaced-app" }
                    : field === "responseHash"
                      ? { responseHash: "b".repeat(64) }
                      : field === "seriesId"
                        ? { seriesId: "series-before" }
                        : {}),
                },
              }
            : row.fact,
      })),
    });
  }
  for (const variant of variants)
    assert.equal(compareLatency(before, variant).outcome, "inconclusive");
});
test("missing samples, timeout, unlabelled legacy durations, changed response within a series and stale timestamps remain incomplete", () => {
  const partial = { ...after, entries: after.entries.slice(0, 2) };
  assert.equal(summarizeLatency(partial).state, "incomplete");
  const legacy = {
    ...after,
    entries: after.entries.map((row) => ({
      ...row,
      fact:
        row.fact?.kind === "http"
          ? {
              kind: "http" as const,
              origin: row.fact.origin,
              path: row.fact.path,
              status: row.fact.status,
              durationMs: row.fact.durationMs ?? 0,
            }
          : null,
    })),
  };
  assert.equal(summarizeLatency(legacy).state, "not_measured");
  for (const variant of [
    { ...after, window: { start: start + 11_000, end: start + 12_000 } },
    {
      ...after,
      entries: after.entries.map((row, index) =>
        index !== 1
          ? row
          : { ...row, state: "unavailable" as const, at: null, code: "PROBE_TIMEOUT", fact: null },
      ),
    },
    {
      ...after,
      entries: after.entries.map((row, index) =>
        index !== 1 || row.fact?.kind !== "http" || !row.fact.sampling
          ? row
          : {
              ...row,
              fact: {
                ...row.fact,
                sampling: { ...row.fact.sampling, responseHash: "b".repeat(64) },
              },
            },
      ),
    },
    { ...after, entries: [...after.entries].reverse() },
  ])
    assert.equal(compareLatency(before, variant).outcome, "inconclusive");
});
test("sample protocol rejects an invented time unit, different concurrency or sample count at the external parser", () => {
  for (const mutation of [
    { protocol: "seconds" },
    { concurrency: 10 },
    { count: 100 },
    { index: 0 },
    { responseHash: "not-a-digest" },
  ]) {
    const raw = changed(after, (row) => {
      assert.ok(Array.isArray(row.entries));
      const first: unknown = row.entries[0];
      assert.ok(first && typeof first === "object" && "fact" in first);
      const fact = first.fact;
      assert.ok(fact && typeof fact === "object" && "sampling" in fact);
      fact.sampling = { ...object(fact.sampling), ...mutation };
    });
    assert.throws(() => parseEvidenceBundle(raw));
  }
});
