import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { setTimeout as pause } from "node:timers/promises";
import { compareLatency, summarizeLatency } from "../../src/contracts/latency.ts";
import { readConfig } from "../../src/server/config.ts";
import { AppError } from "../../src/server/errors.ts";
import { collectEvidence } from "../../src/server/incident/collect.ts";
import { LiaraReadClient } from "../../src/server/liara/client.ts";
import { WorkloadProbe, type ProbeTransport } from "../../src/server/liara/probe.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";
import { freeHttpTestPort } from "../helpers/http-port.ts";

const scope = { teamId: "a".repeat(24), app: "sample-node" },
  origin = "https://sample.example.com";
const config = readConfig({
  LIARA_TEAM_ID: scope.teamId,
  LAUNCHLANE_APP_ALLOWLIST: scope.app,
  LIARA_API_TOKEN: "synthetic-only",
  LAUNCHLANE_ENABLE_LIVE_LIARA: "true",
  LAUNCHLANE_PROBE_ORIGINS: JSON.stringify({ [scope.app]: origin }),
});
const signal = () => AbortSignal.timeout(10_000);
function client(onRead = () => {}) {
  return new LiaraReadClient(config, async (url) => {
    onRead();
    const path = new URL(url).pathname;
    if (path.endsWith("/logs") || path.endsWith("/events")) return Response.json({ data: [] });
    if (path.endsWith("/releases"))
      return Response.json({ total: 0, currentRelease: null, releases: [] });
    if (path.endsWith("/applets")) return Response.json({ applets: [] });
    if (path.endsWith("/summary"))
      return Response.json({
        cpuUsage: [{ applet: "unknown-unit", value: [999999999, "98"] }],
        memoryUsage: [],
      });
    return Response.json({
      project: {
        _id: "app-exact",
        project_id: scope.app,
        type: "node",
        status: "Running",
        envs: [],
      },
    });
  });
}
function collect(
  send: ProbeTransport,
  options: { samples?: boolean; limit?: number; active?: boolean; signal?: AbortSignal } = {},
) {
  const active = { ...config, enableLiveLiara: options.active ?? true },
    budget = new RunBudget({ ...active, maxToolCalls: options.limit ?? 12 }),
    now = Date.now();
  const reader = client();
  const probe = new WorkloadProbe(
    active,
    async () => [{ address: "93.184.216.34", family: 4 }],
    send,
  );
  return collectEvidence(
    new LiaraReadClient(active, reader.send),
    probe,
    {
      scope,
      expectedAppId: "app-exact",
      start: now - 1000,
      end: budget.deadline,
      since: new Date(now - 1000).toISOString(),
      path: "/orders",
      sampleLatency: options.samples ?? true,
    },
    budget,
    options.signal ?? signal(),
  ).then((bundle) => ({ bundle, budget }));
}

test("local HTTP oracle records an unchanged delay and a removed delay on the same response without diagnosing unknown CPU values", async (t) => {
  let delayMs = 180,
    active = 0,
    maxActive = 0,
    hits = 0;
  const server = createServer(async (request, response) => {
    assert.equal(request.url, "/orders");
    hits++;
    active++;
    maxActive = Math.max(active, maxActive);
    await pause(delayMs);
    response.setHeader("content-type", "application/json");
    response.end('{"orders":3}');
    active--;
  });
  const port = await freeHttpTestPort();
  await new Promise<void>((done) => server.listen(port, "127.0.0.1", done));
  const send: ProbeTransport = async (url, _address, abort) => {
    assert.equal(url.origin, origin);
    assert.equal(url.pathname, "/orders");
    const started = performance.now(),
      response = await fetch(`http://127.0.0.1:${port}/orders`, {
        signal: abort,
        redirect: "error",
      });
    const body = await response.text();
    return {
      status: response.status,
      body,
      bytes: Buffer.byteLength(body),
      durationMs: Math.round(performance.now() - started),
    };
  };
  try {
    const before = await collect(send);
    const unchanged = await collect(send);
    assert.equal(summarizeLatency(before.bundle).state, "complete");
    assert.ok(
      summarizeLatency(unchanged.bundle).samples.every((row) => row.durationMs >= 150),
      "The unrelated change must retain the controlled 180ms delay",
    );
    delayMs = 2;
    const after = await collect(send);
    assert.equal(compareLatency(before.bundle, after.bundle).outcome, "lower_observed");
    assert.equal(after.budget.toolCalls, 10);
    assert.equal(hits, 9);
    assert.equal(maxActive, 1);
    assert.ok(
      after.bundle.entries
        .filter((row) => row.source === "metrics")
        .every((row) => row.state === "unknown" && row.fact === null),
    );
    assert.equal(
      new Set(after.bundle.entries.map((row) => row.id)).size,
      after.bundle.entries.length,
    );
    t.diagnostic(
      JSON.stringify({
        source: "local_http_socket_with_synthetic_provider_and_dns",
        unit: "ms",
        before: summarizeLatency(before.bundle).samples.map((row) => row.durationMs),
        unchanged: summarizeLatency(unchanged.bundle).samples.map((row) => row.durationMs),
        after: summarizeLatency(after.bundle).samples.map((row) => row.durationMs),
      }),
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((done) => server.close(() => done()));
  }
});

test("a stopped or timed-out latency series preserves observed samples and never replaces a timeout with zero milliseconds or retries the failure", async () => {
  let calls = 0;
  const { bundle } = await collect(async () => {
    calls++;
    if (calls === 2) throw new AppError("PROBE_TIMEOUT", "Synthetic timeout", 409);
    return { status: 200, body: "same", bytes: 4, durationMs: 8 };
  });
  assert.equal(calls, 2);
  assert.equal(summarizeLatency(bundle).state, "incomplete");
  assert.equal(bundle.entries.find((row) => row.code === "PROBE_TIMEOUT")?.fact, null);
  assert.deepEqual(
    summarizeLatency(bundle).samples.map((row) => row.durationMs),
    [8],
  );
});

test("a server error after a successful timed response stops the series and cannot become a latency improvement", async () => {
  let calls = 0;
  const { bundle } = await collect(async () => {
    calls++;
    return { status: calls === 1 ? 200 : 500, body: "same", bytes: 4, durationMs: 8 };
  });
  assert.equal(calls, 2);
  assert.equal(summarizeLatency(bundle).state, "incomplete");
  assert.deepEqual(summarizeLatency(bundle).samples.map((sample) => sample.status), [200, 500]);
});

test("disabled collection and an inadequate sampling budget stop before any upstream read; cancellation is not saved as a completed series", async () => {
  let probes = 0,
    reads = 0;
  const send: ProbeTransport = async () => {
    probes++;
    return { status: 200, body: "same", bytes: 4, durationMs: 8 };
  };
  const disabled = { ...config, enableLiveLiara: false },
    lowBudget = new RunBudget({ ...config, maxToolCalls: 9 }),
    now = Date.now();
  const input = {
    scope,
    expectedAppId: "app-exact",
    start: now - 1000,
    end: lowBudget.deadline,
    since: new Date(now - 1000).toISOString(),
    path: "/orders",
    sampleLatency: true,
  };
  const probe = new WorkloadProbe(
    config,
    async () => [{ address: "93.184.216.34", family: 4 }],
    send,
  );
  const read = client(() => {
    reads++;
  });
  await assert.rejects(
    collectEvidence(new LiaraReadClient(disabled, read.send), probe, input, lowBudget, signal()),
    (error: unknown) => error instanceof AppError && error.code === "LIVE_LIARA_DISABLED",
  );
  await assert.rejects(
    collectEvidence(read, probe, input, lowBudget, signal()),
    (error: unknown) => error instanceof AppError && error.code === "BUDGET_EXHAUSTED",
  );
  assert.equal(reads, 0);
  assert.equal(probes, 0);
  const controller = new AbortController();
  await assert.rejects(
    collect(
      async () => {
        controller.abort();
        return send(new URL(origin), { address: "93.184.216.34", family: 4 }, controller.signal);
      },
      { signal: controller.signal },
    ),
    (error: unknown) =>
      error instanceof AppError && ["CANCELLED", "BUDGET_EXHAUSTED"].includes(error.code),
  );
});
