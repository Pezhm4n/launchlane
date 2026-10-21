import assert from "node:assert/strict";
import { test } from "node:test";

// This smoke suite needs a running local server. It does not call Liara or a model.
const origin = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
const url = new URL(origin);
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(url.hostname), "Bootstrap smoke targets loopback only");

test("the running server serves the product entry point", async () => {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /text\/html/);
  assert.match(await response.text(), /Launchlane/);
});

test("liveness is explicit about unverified external integrations", async () => {
  const response = await fetch(new URL("/api/health", url), { signal: AbortSignal.timeout(10_000) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const payload = await response.json();
  assert.equal(payload.service, "launchlane");
  assert.equal(payload.status, "ok");
  assert.equal(payload.stage, "preparation");
  assert.deepEqual(payload.integrations, { liara: "unverified", model: "unconfigured" });
  assert.equal(response.headers.has("x-powered-by"), false);
});
