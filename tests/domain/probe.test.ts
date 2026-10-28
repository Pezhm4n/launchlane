import assert from "node:assert/strict";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { readConfig } from "../../src/server/config.ts";
import { AppError } from "../../src/server/errors.ts";
import { isPublicAddress, WorkloadProbe } from "../../src/server/liara/probe.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";

const scope = { teamId: "a".repeat(24), app: "sample-node" };
const config = readConfig({
  LIARA_TEAM_ID: scope.teamId,
  LAUNCHLANE_APP_ALLOWLIST: scope.app,
  LAUNCHLANE_PROBE_ORIGINS: '{"sample-node":"https://sample-node.example.com"}',
});
const active = { ...config, enableLiveLiara: true };
const code = (expected: string) => (error: unknown) =>
  error instanceof AppError && error.code === expected;
const response = { status: 500, body: '{"error":"CONFIG_REQUIRED"}', bytes: 27, durationMs: 12 };
const publicAddress = { address: "93.184.216.34", family: 4 as const };
const signal = () => new AbortController().signal;

test("document verification reads bounded HTML beyond 64 KiB while ordinary probes retain their original cap", async () => {
  const body = "<!doctype html><main>" + "x".repeat(70000) + "original criterion at end</main>";
  const probe = new WorkloadProbe(active, async () => [publicAddress], async (_url, _address, _signal, maxBytes) => {
    assert.equal(maxBytes, 1024 * 1024);
    return { status: 200, body, bytes: Buffer.byteLength(body), durationMs: 1, contentType: "text/html; charset=utf-8" };
  });
  const result = await probe.checkDocument(scope, "/", new RunBudget(active), signal());
  assert.ok(result.body.includes("original criterion at end")); assert.equal(result.bytes, Buffer.byteLength(body));
  const ordinary = new WorkloadProbe(active, async () => [publicAddress], async () => ({ status: 200, body, bytes: Buffer.byteLength(body), durationMs: 1, contentType: "text/html" }));
  await assert.rejects(ordinary.check(scope, "/", new RunBudget(active), signal(), 65536), code("PROBE_INVALID"));
});

test("a document read cannot admit oversized JSON, absent MIME evidence or HTML beyond one MiB", async () => {
  for (const [contentType, length] of [["application/json", 65537], [null, 65537], ["text/html", 1024 * 1024 + 1]] as const) {
    const body = "x".repeat(length), probe = new WorkloadProbe(active, async () => [publicAddress], async () => ({ status: 200, body, bytes: length, durationMs: 1, contentType }));
    await assert.rejects(probe.checkDocument(scope, "/", new RunBudget(active), signal()), code("PROBE_INVALID"));
  }
});

test("health target configuration rejects arbitrary protocols, IPs, ports and account mixup", () => {
  for (const origin of [
    "http://service.example.com",
    "https://127.0.0.1",
    "https://[::1]",
    "https://name.local",
    "https://user:pass@service.example.com",
    "https://service.example.com/path",
    "https://service.example.com?token=secret",
    "https://service.example.com:8443",
  ])
    assert.throws(
      () =>
        readConfig({
          LAUNCHLANE_APP_ALLOWLIST: scope.app,
          LAUNCHLANE_PROBE_ORIGINS: JSON.stringify({ [scope.app]: origin }),
        }),
      code("CONFIG_INVALID"),
    );
  assert.throws(
    () => readConfig({ LAUNCHLANE_PROBE_ORIGINS: '{"other":"https://other.example.com"}' }),
    code("CONFIG_INVALID"),
  );
});

test("special-purpose v4/v6, mapped addresses and malformed DNS answers are denied", () => {
  for (const address of [
    "0.0.0.0",
    "10.0.0.1",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.1.1",
    "192.0.2.1",
    "198.18.0.1",
    "224.0.0.1",
    "255.255.255.255",
  ])
    assert.equal(isPublicAddress({ address, family: 4 }), false, address);
  for (const address of [
    "::1",
    "::ffff:93.184.216.34",
    "64:ff9b::a00:1",
    "fc00::1",
    "fe80::1",
    "2001:db8::1",
    "2002::1",
    "3fff::1",
    "invalid",
  ])
    assert.equal(isPublicAddress({ address, family: 6 }), false, address);
  assert.equal(isPublicAddress(publicAddress), true);
  assert.equal(isPublicAddress({ address: "2606:4700:4700::1111", family: 6 }), true);
});

test("disabled checks and unsafe destinations make zero DNS/socket calls", async () => {
  let dns = 0,
    sockets = 0;
  const resolve = async () => {
    dns++;
    return [publicAddress];
  };
  const send = async () => {
    sockets++;
    return response;
  };
  await assert.rejects(
    new WorkloadProbe(config, resolve, send).check(scope, "/", new RunBudget(config), signal()),
    code("LIVE_LIARA_DISABLED"),
  );
  const probe = new WorkloadProbe(active, resolve, send);
  for (const path of [
    "//internal/",
    "/../metadata",
    "/%2e%2e/metadata",
    "/?token=value",
    "https://evil.example/",
  ])
    await assert.rejects(
      probe.check(scope, path, new RunBudget(active), signal()),
      code("PROBE_TARGET_DENIED"),
    );
  await assert.rejects(
    probe.check({ ...scope, app: "other" }, "/", new RunBudget(active), signal()),
    code("SCOPE_DENIED"),
  );
  assert.equal(dns, 0);
  assert.equal(sockets, 0);
  for (const addresses of [
    [{ address: "10.0.0.1", family: 4 as const }],
    [publicAddress, { address: "127.0.0.1", family: 4 as const }],
    [],
  ]) {
    await assert.rejects(
      new WorkloadProbe(active, async () => addresses, send).check(
        scope,
        "/",
        new RunBudget(active),
        signal(),
      ),
      code("PROBE_DNS_DENIED"),
    );
  }
  assert.equal(sockets, 0);
});

test("one DNS answer is pinned for HTTPS, no redirect/retry, and a workload 500 stays 500", async () => {
  let dns = 0,
    sockets = 0;
  const probe = new WorkloadProbe(
    active,
    async () => {
      dns++;
      return [publicAddress];
    },
    async (url, pin) => {
      sockets++;
      assert.equal(url.origin, config.probeOrigins[scope.app]);
      assert.deepEqual(pin, publicAddress);
      return response;
    },
  );
  const result = await probe.check(scope, "/", new RunBudget(active), signal());
  assert.equal(result.status, 500);
  assert.equal(result.path, "/");
  assert.equal(result.outcome, "response");
  assert.equal(dns, 1);
  assert.equal(sockets, 1);
  const redirected = new WorkloadProbe(
    active,
    async () => [publicAddress],
    async () => ({ ...response, status: 302, body: "https://127.0.0.1/private" }),
  );
  const unknown = await redirected.check(scope, "/", new RunBudget(active), signal());
  assert.equal(unknown.outcome, "redirect_blocked");
  assert.equal(unknown.body, "");
});

test("cancellation during DNS never opens a socket; a late healthy answer never counts as success", async () => {
  let sockets = 0;
  const controller = new AbortController();
  const cancelled = new WorkloadProbe(
    active,
    async () => {
      controller.abort();
      return [publicAddress];
    },
    async () => {
      sockets++;
      return response;
    },
  );
  await assert.rejects(
    cancelled.check(scope, "/", new RunBudget(active), controller.signal),
    code("CANCELLED"),
  );
  assert.equal(sockets, 0);
  const late = new AbortController();
  const probe = new WorkloadProbe(
    active,
    async () => [publicAddress],
    async () => {
      late.abort();
      return { ...response, status: 200 };
    },
  );
  await assert.rejects(
    probe.check(scope, "/", new RunBudget(active), late.signal),
    code("CANCELLED"),
  );
  const oversize = new WorkloadProbe(
    active,
    async () => [publicAddress],
    async () => ({ ...response, bytes: 4097 }),
  );
  await assert.rejects(
    oversize.check(scope, "/", new RunBudget(active), signal()),
    code("PROBE_INVALID"),
  );
});


test("asset fingerprinting allows a bounded query and pins the approved origin", async () => {
  let calls = 0;
  const probe = new WorkloadProbe(active, async () => [publicAddress], async (url, _pin, _signal, maxBytes, accept) => {
    calls++;
    assert.equal(maxBytes, 4 * 1024 * 1024);
    assert.equal(accept, "*/*");
    assert.equal(url.origin, config.probeOrigins[scope.app]);
    assert.equal(url.pathname, "/assets/app.js");
    assert.equal(url.search, "?v=2");
    return { status: 200, body: "console.log(1)", bytes: 14, durationMs: 1, contentType: "text/javascript" };
  });
  const result = await probe.checkAsset(scope, "/assets/app.js?v=2", new RunBudget(active), signal());
  assert.equal(result.status, 200);
  assert.equal(result.contentType, "text/javascript");
  assert.equal(result.sha256?.length, 64);
  assert.equal(result.body, "");
  assert.equal(result.outcome, "response");
  assert.equal(calls, 1);
});

test("asset paths reject traversal, fragments, arbitrary origins and overlong queries before DNS", async () => {
  let sockets = 0;
  const probe = new WorkloadProbe(active, async () => [publicAddress], async () => {
    sockets++;
    return response;
  });
  for (const path of [
    "//evil.example/a.js",
    "/../a.js",
    "/a.js#frag",
    "https://evil.example/a.js",
    `/a.js?${"x".repeat(300)}`,
  ])
    await assert.rejects(
      probe.checkAsset(scope, path, new RunBudget(active), signal()),
      code("PROBE_TARGET_DENIED"),
    );
  assert.equal(sockets, 0);
});

test("a response after a slow handshake retains its real 500 within the remaining operation deadline", async () => {
  let requests = 0;
  const probe = new WorkloadProbe(active, async () => [publicAddress], async (_url, pin, bounded) => {
    requests++;
    assert.deepEqual(pin, publicAddress);
    await delay(6000, undefined, { signal: bounded });
    return { ...response, durationMs: 6000 };
  });
  const budget = new RunBudget({ ...active, runTimeoutMs: 12_000 });
  const result = await probe.check(scope, "/orders", budget, signal());
  assert.equal(result.status, 500);
  assert.equal(result.body, response.body);
  assert.equal(result.path, "/orders");
  assert.equal(result.durationMs, 6000);
  assert.equal(result.outcome, "response");
  assert.equal(requests, 1);
  assert.equal(budget.toolCalls, 1);
});
