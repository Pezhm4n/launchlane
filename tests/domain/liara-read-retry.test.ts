import assert from "node:assert/strict";
import { test } from "node:test";
import { readConfig } from "../../src/server/config.ts";
import { AppError } from "../../src/server/errors.ts";
import { LiaraAccountClient } from "../../src/server/liara/catalog.ts";
import { LiaraReadClient } from "../../src/server/liara/client.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";
import { sendRead, type Transport } from "../../src/server/providers/http.ts";

const team = "a".repeat(24), app = "retry-sample", key = "synthetic-retry-key";
const config = readConfig({ LIARA_TEAM_ID: team, LIARA_API_TOKEN: key,
  LAUNCHLANE_APP_ALLOWLIST: app, LAUNCHLANE_ENABLE_LIVE_LIARA: "true" });
const scope = { teamId: team, app };
const signal = () => AbortSignal.timeout(3000);
const connectTimeout = () => new TypeError("private transport text", {
  cause: Object.assign(new Error("private connect details"), { code: "UND_ERR_CONNECT_TIMEOUT" }),
});
const code = (expected: string) => (error: unknown) => error instanceof AppError && error.code === expected;

test("Liara account and evidence GETs retry one connect timeout with the same scope and counted budget", async () => {
  for (const kind of ["account", "evidence"] as const) {
    let calls = 0;
    const budget = new RunBudget(config), targets: string[] = [];
    const send: Transport = async (url, init) => {
      calls++;
      targets.push(url);
      assert.equal(init.method, "GET");
      assert.equal(init.redirect, "error");
      assert.equal(new URL(url).searchParams.get("teamID"), team);
      assert.equal(new Headers(init.headers).get("Authorization"), `Bearer ${key}`);
      if (calls === 1) throw connectTimeout();
      return kind === "account" ? new Response(null, { status: 404 }) : Response.json({});
    };
    if (kind === "account")
      assert.equal(await new LiaraAccountClient(config, "b".repeat(24), send).projectMetadata(app, budget, signal()), null);
    else
      assert.equal((await new LiaraReadClient(config, send).metrics(scope, budget, signal())).memory.reason, "missing");
    assert.equal(calls, 2);
    assert.equal(budget.toolCalls, 2);
    assert.equal(targets[0], targets[1]);
  }
});

test("connect timeouts stop after two attempts and sanitized errors contain no transport details", async () => {
  for (const kind of ["account", "evidence"] as const) {
    let calls = 0;
    const budget = new RunBudget(config), send: Transport = async () => { calls++; throw connectTimeout(); };
    await assert.rejects(
      kind === "account"
        ? new LiaraAccountClient(config, "b".repeat(24), send).networks(budget, signal())
        : new LiaraReadClient(config, send).metrics(scope, budget, signal()),
      (error: unknown) => error instanceof AppError && error.code === "PROVIDER_TRANSPORT" &&
        !error.message.includes("private"),
    );
    assert.equal(calls, 2);
    assert.equal(budget.toolCalls, 2);
  }
});

test("a read retry cannot exceed the shared attempt budget, deadline or cancellation", async () => {
  for (const limit of ["attempts", "deadline", "cancel"] as const) {
    let calls = 0;
    const controller = new AbortController(), budget = new RunBudget({ ...config,
      maxToolCalls: limit === "attempts" ? 1 : 10, runTimeoutMs: limit === "deadline" ? 30 : 3000 });
    const send: Transport = async () => {
      calls++;
      if (limit === "cancel") setTimeout(() => controller.abort(), 10);
      throw connectTimeout();
    };
    await assert.rejects(new LiaraAccountClient(config, "b".repeat(24), send).networks(budget, controller.signal),
      code(limit === "cancel" ? "CANCELLED" : "BUDGET_EXHAUSTED"));
    assert.equal(calls, 1);
    assert.equal(budget.toolCalls, 1);
  }
});

test("HTTP responses and unrelated errors do not retry; writes cannot enter the read transport", async () => {
  for (const status of [200, 401, 429, 503]) {
    let calls = 0;
    const budget = new RunBudget(config), result = await sendRead(async () => {
      calls++;
      return new Response(null, { status });
    }, "https://api.liara.ir/v1/networks", { method: "GET" }, budget, signal());
    assert.equal(result.status, status);
    assert.equal(calls, 1);
    assert.equal(budget.toolCalls, 1);
  }
  for (const error of [new TypeError("programming error"), new Error("unknown transport error")]) {
    let calls = 0;
    await assert.rejects(sendRead(async () => { calls++; throw error; }, "https://api.liara.ir/v1/networks",
      { method: "GET" }, new RunBudget(config), signal()), (actual: unknown) => actual === error);
    assert.equal(calls, 1);
  }
  let writes = 0;
  const budget = new RunBudget(config);
  await assert.rejects(sendRead(async () => { writes++; throw connectTimeout(); }, "https://api.liara.ir/v1/projects",
    { method: "POST" }, budget, signal()), code("READ_METHOD_REQUIRED"));
  assert.equal(writes, 0);
  assert.equal(budget.toolCalls, 0);
});

test("an eventual response after a connect retry still validates payloads and account identity", async () => {
  let calls = 0;
  const budget = new RunBudget(config), send: Transport = async () => {
    if (++calls === 1) throw connectTimeout();
    return Response.json({ project: { _id: "c".repeat(24), project_id: "different-app" } });
  };
  await assert.rejects(new LiaraAccountClient(config, "b".repeat(24), send).projectMetadata(app, budget, signal()), code("UPSTREAM_INVALID"));
  assert.equal(calls, 2);
  assert.equal(budget.toolCalls, 2);
});
