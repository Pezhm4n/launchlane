import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import { Pool } from "undici";
import { transport } from "../../src/server/providers/http.ts";

test("only the exact Liara HTTPS origin uses a shared pool without sharing per-request credentials or signals", async () => {
  const original = globalThis.fetch, pools: Pool[] = [];
  const cases = ["https://api.liara.ir/v1/me", "https://api.liara.ir/v1/projects?teamID=synthetic",
    "https://ai.boxapi.ir/ai/v1/chat/completions", "https://api.liara.ir.example.test/v1/me", "http://api.liara.ir/v1/me"];
  try {
    for (const [index, url] of cases.entries()) {
      const controller = new AbortController(), headers = { Authorization: `Bearer synthetic-${index}` };
      const init: RequestInit = { method: "GET", headers, signal: controller.signal, redirect: "error", cache: "no-store" };
      globalThis.fetch = async (actual, options) => {
        assert.equal(actual, url);
        assert.equal(options?.headers, headers);
        assert.equal(options?.signal, controller.signal);
        assert.equal(options?.redirect, "error");
        assert.equal(options?.cache, "no-store");
        if (index < 2) {
          assert.ok(options && "dispatcher" in options && options.dispatcher instanceof Pool);
          pools.push(options.dispatcher);
        } else assert.ok(options && !("dispatcher" in options));
        return Response.json({ public: true });
      };
      assert.equal((await transport(url, init)).status, 200);
      assert.ok(!("dispatcher" in init));
    }
    assert.equal(pools.length, 2);
    assert.equal(pools[0], pools[1]);
  } finally { globalThis.fetch = original; }
});

test("the pooled write transport forwards the original body once and never retries a connect failure", async () => {
  const original = globalThis.fetch, controller = new AbortController();
  const body = new FormData();
  body.set("file", new Blob(["synthetic artifact"]), "source.tar.gz");
  const failure = new TypeError("fetch failed", { cause: { code: "UND_ERR_CONNECT_TIMEOUT" } });
  let calls = 0;
  try {
    globalThis.fetch = async (_url, init) => {
      calls++;
      assert.equal(init?.method, "POST");
      assert.equal(init?.body, body);
      assert.equal(init?.signal, controller.signal);
      assert.ok(init && "dispatcher" in init && init.dispatcher instanceof Pool);
      throw failure;
    };
    await assert.rejects(transport("https://api.liara.ir/v2/projects/sample/sources", {
      method: "POST", body, signal: controller.signal, redirect: "error",
    }), (error: unknown) => error === failure);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});

test("the pinned pool interoperates with native Node fetch for actual headers, multipart bytes and cancellation", async () => {
  const requests: { method: string | undefined; auth: string | undefined; body: string }[] = [];
  const server = createServer(async (request, response) => {
    if (request.url === "/hung") return;
    const chunks: Buffer[] = [];
    for await (const part of request) chunks.push(Buffer.from(part));
    requests.push({ method: request.method, auth: request.headers.authorization, body: Buffer.concat(chunks).toString("utf8") });
    if (request.url === "/lost") { response.destroy(); return; }
    response.end("received");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`, dispatcher = new Pool(origin, {
    connectTimeout: 30_000, keepAliveTimeout: 30_000, keepAliveMaxTimeout: 60_000, allowH2: false,
  });
  try {
    const body = new FormData();
    body.set("file", new Blob(["exact-synthetic-artifact"]), "source.tar.gz");
    const options: RequestInit & { dispatcher: Pool } = { method: "POST", body, dispatcher,
      headers: { Authorization: "Bearer first-synthetic-key" }, signal: AbortSignal.timeout(5000) };
    const first = await fetch(origin, options);
    assert.equal(await first.text(), "received");
    const second = await fetch(origin, { ...options, method: "GET", body: null,
      headers: { Authorization: "Bearer second-synthetic-key" } });
    assert.equal(await second.text(), "received");
    assert.equal(requests.length, 2);
    assert.equal(requests[0]?.method, "POST");
    assert.equal(requests[0]?.auth, "Bearer first-synthetic-key");
    assert.ok(requests[0]?.body.includes('name="file"; filename="source.tar.gz"'));
    assert.ok(requests[0]?.body.includes("exact-synthetic-artifact"));
    assert.equal(requests[1]?.method, "GET");
    assert.equal(requests[1]?.auth, "Bearer second-synthetic-key");
    assert.equal(requests[1]?.body, "");
    await assert.rejects(fetch(`${origin}/lost`, options), TypeError);
    assert.equal(requests.length, 3, "a lost POST response must not replay the wire request");
    assert.equal(requests[2]?.method, "POST");
    assert.ok(requests[2]?.body.includes("exact-synthetic-artifact"));
    await assert.rejects(fetch(`${origin}/hung`, { ...options, method: "GET", body: null,
      signal: AbortSignal.timeout(20) }), (error: unknown) => error instanceof Error && error.name === "TimeoutError");
  } finally {
    await dispatcher.destroy();
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
