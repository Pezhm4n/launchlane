import assert from "node:assert/strict";
import { test } from "node:test";
import { httpFailure } from "../../src/server/providers/http.ts";
import { failureNextStep } from "../../src/contracts/agent-failure.ts";
import { AppError } from "../../src/server/errors.ts";
import { BoxApiClient } from "../../src/server/agent/boxapi.ts";
import { LiaraDeployClient, type DeploySpec } from "../../src/server/liara/deploy.ts";
import { LiaraReadClient } from "../../src/server/liara/client.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";
import { readConfig } from "../../src/server/config.ts";

const cases = [
  { status: 400, code: "PROVIDER_REJECTED", retryable: false },
  { status: 401, code: "PROVIDER_AUTH", retryable: false },
  { status: 402, code: "PROVIDER_PAYMENT_REQUIRED", retryable: false },
  { status: 403, code: "PROVIDER_AUTH", retryable: false },
  { status: 409, code: "PROVIDER_CONFLICT", retryable: false },
  { status: 413, code: "PROVIDER_REQUEST_TOO_LARGE", retryable: false },
  { status: 422, code: "PROVIDER_REJECTED", retryable: false },
  { status: 429, code: "PROVIDER_RATE_LIMIT", retryable: true },
  { status: 500, code: "PROVIDER_UNAVAILABLE", retryable: true },
  { status: 503, code: "PROVIDER_UNAVAILABLE", retryable: true },
] as const;
const privateBody = "Bearer synthetic-private-response account-password=must-not-escape";
const scope = { teamId: "a".repeat(24), app: "provider-failure-fixture" };
const config = readConfig({
  LIARA_TEAM_ID: scope.teamId, LAUNCHLANE_APP_ALLOWLIST: scope.app, LIARA_API_TOKEN: "synthetic-provider-fixture",
  MODEL_API_KEY: "synthetic-model-fixture", MODEL_ID: "gpt-6-luna", LAUNCHLANE_ENABLE_LIVE_MODEL: "true",
  LAUNCHLANE_ENABLE_LIVE_LIARA: "true", LAUNCHLANE_ENABLE_MUTATIONS: "true",
});
const spec: DeploySpec = { version: 5, operation: "deploy", scope, sourceHash: "1".repeat(64), artifactHash: "2".repeat(64),
  projectFlowId: "f".repeat(36), selectionHash: "3".repeat(64), targetAppId: "fixture-app-id", nodeVersion: "22",
  args: { port: 3000, planId: "starter" }, workload: { origin: `https://${scope.app}.liara.run`, path: "/", status: 200, revision: "fixture-v1" } };
const failure = (expected: typeof cases[number]) => (error: unknown) => {
  assert.ok(error instanceof AppError);
  assert.equal(error.code, expected.code); assert.equal(error.retryable, expected.retryable);
  assert.ok(!error.message.includes(privateBody)); assert.ok(!error.message.includes("must-not-escape"));
  return true;
};

test("provider status mapping separates payment, conflict and request size while preserving existing auth and transient contracts", () => {
  for (const expected of cases) failure(expected)(httpFailure(expected.status));
  assert.equal(httpFailure(404).code, "PROVIDER_UNAVAILABLE"); assert.equal(httpFailure(404).retryable, false);
  assert.doesNotMatch(httpFailure(409).message, /نام|برنامه‌ای با این نام/);
});

test("provider failures remain one request with sanitized errors across model, read and write adapters", async () => {
  for (const expected of cases) {
    const signal = AbortSignal.timeout(5000);
    for (const kind of ["model", "read", "write"] as const) {
      let calls = 0, discarded = 0;
      const send = async (_url: string, init: RequestInit) => {
        calls++; assert.equal(init.method, kind === "read" ? "GET" : "POST");
        return new Response(new ReadableStream<Uint8Array>({
          start(controller) { controller.enqueue(new TextEncoder().encode(privateBody)); },
          cancel() { discarded++; },
        }), { status: expected.status });
      };
      const budget = new RunBudget(config);
      if (kind === "model") await assert.rejects(new BoxApiClient(config, send).complete([{ role: "user", content: "بررسی" }], budget, signal), failure(expected));
      else if (kind === "read") await assert.rejects(new LiaraReadClient(config, send).project(scope, budget, signal), failure(expected));
      else await assert.rejects(new LiaraDeployClient(config, send).release(spec, "source-exact", budget, signal), failure(expected));
      assert.equal(calls, 1, `${kind}/${expected.status} must not retry based on retryable metadata`);
      assert.equal(discarded, 1, `${kind}/${expected.status} must discard the untrusted body`);
    }
  }
});

test("actionable next steps direct account, provider and network failures away from editing code and blind write replay", () => {
  for (const code of ["PROVIDER_AUTH", "PROVIDER_PAYMENT_REQUIRED", "PROVIDER_TRANSPORT", "MODEL_TRANSPORT", "PROVIDER_UNAVAILABLE"]) assert.match(failureNextStep(code), /کد/);
  assert.match(failureNextStep("PROVIDER_AUTH"), /اتصال حساب|مجوز/);
  assert.match(failureNextStep("PROVIDER_PAYMENT_REQUIRED"), /پرداخت|اعتبار/);
  assert.match(failureNextStep("PROVIDER_CONFLICT"), /تعارض/); assert.match(failureNextStep("PROVIDER_CONFLICT"), /تکرار نمی‌شود/);
  assert.match(failureNextStep("PROVIDER_REQUEST_TOO_LARGE"), /حجم|بسته/);
  assert.match(failureNextStep("PROVIDER_RATE_LIMIT"), /زمان انتظار/); assert.match(failureNextStep("PROVIDER_RATE_LIMIT"), /ابتدا نتیجه/);
});
