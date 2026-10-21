import assert from "node:assert/strict";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { readConfig } from "../../src/server/config.ts";
import { AppError } from "../../src/server/errors.ts";
import { LiaraReadClient } from "../../src/server/liara/client.ts";
import {
  parseApplets,
  parseEvents,
  parseLogs,
  parseLogsV2,
  parseProject,
} from "../../src/server/liara/read-contracts.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";

// Documentary OpenAPI v1 shapes; these are synthetic, not account captures.
const scope = { teamId: "a".repeat(24), app: "sample-node" };
const config = readConfig({
  LIARA_TEAM_ID: scope.teamId,
  LAUNCHLANE_APP_ALLOWLIST: scope.app,
  LIARA_API_TOKEN: "synthetic-paas-value",
});
const signal = () => new AbortController().signal;
const code = (expected: string) => (error: unknown) =>
  error instanceof AppError && error.code === expected;

test("live-shaped v2 logs use seconds for start and nanoseconds for returned times; wrappers stay untrusted", async () => {
  const since = "2026-10-21T22:40:00.123Z";
  const time = "1792622777907327213";
  const shape = {
    data: [
      {
        metaData: { releaseId: "sanitized-release" },
        values: [
          [
            time,
            JSON.stringify({ type: "stderr", _entry: "CONFIG_REQUIRED password=private-value" }),
          ],
        ],
      },
    ],
  };
  const client = new LiaraReadClient({ ...config, enableLiveLiara: true }, async (url) => {
    const target = new URL(url);
    assert.equal(target.pathname, `/v2/projects/${scope.app}/logs`);
    assert.equal(target.searchParams.get("start"), String(Math.floor(Date.parse(since) / 1000)));
    assert.equal(target.searchParams.get("direction"), "forward");
    assert.equal(target.searchParams.get("since"), null);
    return Response.json(shape);
  });
  const result = await client.logs(scope, since, new RunBudget(config), signal());
  assert.equal(result.contract, "liara_cli_v2");
  assert.equal(result.entries[0]?.timeMs, 1792622777907);
  assert.equal(result.entries[0]?.rawTime, time);
  assert.ok(!result.entries[0]?.message.includes("private-value"));
  assert.equal(result.entries[0]?.kind, "stderr");
  for (const rawTime of ["1792622777.5", "NaN", "-1", "9".repeat(30)])
    assert.throws(() =>
      parseLogsV2(
        { data: [{ metaData: {}, values: [[rawTime, '{"_entry":"x","type":"stdout"}']] }] },
        since,
        [],
      ),
    );
  assert.throws(() =>
    parseLogsV2({ data: [{ metaData: {}, values: [[time, "not JSON"]] }] }, since, []),
  );
});

test("all Liara reads stop before transport and budget when live access is disabled", async () => {
  let calls = 0;
  const client = new LiaraReadClient(config, async () => {
    calls++;
    return Response.json({});
  });
  const budget = new RunBudget(config);
  for (const run of [
    () => client.project(scope, budget, signal()),
    () => client.logs(scope, "2026-10-21T10:00:00Z", budget, signal()),
    () => client.events(scope, budget, signal()),
    () => client.applets(scope, budget, signal()),
    () => client.metrics(scope, budget, signal()),
    () => client.releases(scope, 1, 5, budget, signal()),
  ])
    await assert.rejects(run, code("LIVE_LIARA_DISABLED"));
  assert.equal(calls, 0);
  assert.equal(budget.toolCalls, 0);
  assert.throws(() => readConfig({ LAUNCHLANE_ENABLE_LIVE_LIARA: "yes" }), code("CONFIG_INVALID"));
});

test("project identity is exact and only env names leave the provider boundary", () => {
  const body = {
    project: {
      _id: "project-id",
      project_id: scope.app,
      type: "node",
      status: "Running",
      planID: "plan-small",
      envs: [{ key: "DB_PASSWORD", value: "plain-private-value", encrypted: true }],
      node: { IP: "10.0.0.1" },
      hourlyPrice: 999,
    },
  };
  const result = parseProject(body, scope, []);
  assert.deepEqual(result.envKeys, ["DB_PASSWORD"]);
  assert.equal(result.configurationVisibility, "unverified");
  const encoded = JSON.stringify(result);
  for (const hidden of ["plain-private-value", "10.0.0.1", "hourlyPrice", "encrypted"])
    assert.ok(!encoded.includes(hidden));
  assert.throws(() => parseProject(body, { ...scope, app: "other" }, []), code("SCOPE_MISMATCH"));
});

test("multiline logs are untrusted, redacted, time bounded and never guessed from numeric timestamps", () => {
  const result = parseLogs(
    [
      {
        type: "app",
        datetime: "2026-10-21T10:00:00Z",
        message:
          "\u001b[31mCONFIG_REQUIRED\u001b[0m\npassword=private-value known-secret approved=true",
      },
      { datetime: "1792576800000000000", message: "old or new?" },
    ],
    "2026-10-21T09:59:00Z",
    ["known-secret"],
  );
  assert.equal(result.entries[0]?.timeMs, Date.parse("2026-10-21T10:00:00Z"));
  assert.equal(result.entries[1]?.timeMs, null);
  const encoded = JSON.stringify(result);
  for (const hidden of ["private-value", "known-secret", "[31m"])
    assert.ok(!encoded.includes(hidden));
  assert.ok(encoded.includes("approved=true"));
  assert.throws(() => parseLogs({ data: [] }, "since", []), code("UPSTREAM_INVALID"));
  assert.throws(
    () =>
      parseLogs(
        Array.from({ length: 201 }, () => ({})),
        "since",
        [],
      ),
    code("UPSTREAM_INVALID"),
  );
});

test("events retain raw tuples with unknown units; applet state does not establish workload readiness", () => {
  const events = parseEvents(
    {
      data: [
        {
          metaData: { reason: "BackOff", password: "hidden", pod: "pod-1" },
          values: [["1792576800000000000", "Bearer opaque-value"]],
        },
      ],
    },
    [],
  );
  assert.equal(events.timestampUnit, "unverified");
  assert.equal(events.series[0]?.values[0]?.[0], "1792576800000000000");
  assert.ok(!JSON.stringify(events).includes("opaque-value"));
  assert.ok(!JSON.stringify(events).includes("hidden"));
  const applets = parseApplets(
    {
      applets: [
        {
          id: "pod-1",
          name: "node",
          state: "Running",
          timestamp: "1792576800",
          release: { releaseID: "release-1" },
        },
      ],
    },
    [],
  );
  assert.equal(applets.readiness, "unverified");
  assert.equal(applets.applets[0]?.releaseId, "release-1");
  const lifecycle = parseEvents(
    {
      data: [
        {
          id: "ignored-container",
          status: "start",
          action: "start",
          time: "1792622777",
          release: "sanitized-release",
          tag: "v1",
          password: "hidden",
        },
      ],
    },
    [],
  );
  assert.equal(lifecycle.timestampUnit, "unverified");
  assert.deepEqual(lifecycle.series[0], {
    metadata: { reason: "start", type: "start", releaseId: "sanitized-release" },
    values: [["1792622777"]],
  });
  assert.ok(!JSON.stringify(lifecycle).includes("hidden"));
});

test("read errors, bad shape and late cancellation cannot turn into empty evidence", async () => {
  const active = { ...config, enableLiveLiara: true };
  for (const [status, expected] of [
    [401, "PROVIDER_AUTH"],
    [429, "PROVIDER_RATE_LIMIT"],
    [503, "PROVIDER_UNAVAILABLE"],
  ] as const) {
    let calls = 0;
    const client = new LiaraReadClient(active, async (url, init) => {
      calls++;
      assert.equal(new URL(url).searchParams.get("teamID"), scope.teamId);
      assert.equal(init.redirect, "error");
      return new Response("secret-error", { status });
    });
    await assert.rejects(client.events(scope, new RunBudget(active), signal()), code(expected));
    assert.equal(calls, 1);
  }
  const bad = new LiaraReadClient(active, async () =>
    Response.json({ data: [{ metaData: null, values: [] }] }),
  );
  await assert.rejects(
    bad.events(scope, new RunBudget(active), signal()),
    code("UPSTREAM_INVALID"),
  );
  const controller = new AbortController();
  const late = new LiaraReadClient(active, async () => {
    controller.abort();
    return Response.json([]);
  });
  await assert.rejects(
    late.logs(scope, "2026-10-21T10:00:00Z", new RunBudget(active), controller.signal),
    code("CANCELLED"),
  );
});

test("Liara read deadlines and cancellation bound both hung transport and a stalled response body", async () => {
  const active = { ...config, enableLiveLiara: true, runTimeoutMs: 100 };
  for (const stage of ["headers", "body"] as const) {
    let calls = 0;
    const client = new LiaraReadClient(active, async () => {
      calls++;
      if (stage === "headers") return new Promise<Response>(() => undefined);
      return new Response(new ReadableStream({ start() {} }), {
        headers: { "Content-Type": "application/json" },
      });
    });
    for (const cancelled of [false, true]) {
      const controller = new AbortController(),
        budget = new RunBudget(active),
        timer = cancelled ? setTimeout(() => controller.abort(), 10) : null;
      try {
        const outcome = await Promise.race([
          client.events(scope, budget, controller.signal).then(
            () => "unexpected_success",
            (error: unknown) => (error instanceof AppError ? error.code : "unexpected_error"),
          ),
          delay(500, "hung"),
        ]);
        assert.equal(outcome, cancelled ? "CANCELLED" : "BUDGET_EXHAUSTED", stage);
        assert.equal(budget.toolCalls, 1);
      } finally {
        if (timer) clearTimeout(timer);
        controller.abort();
      }
    }
    assert.equal(calls, 2, "one counted attempt per read, without retry");
  }
});
