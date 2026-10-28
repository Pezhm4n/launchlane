import assert from "node:assert/strict";
import { test } from "node:test";
import { databaseAccountScope } from "../../src/contracts/database-resource.ts";
import { readConfig, type Config } from "../../src/server/config.ts";
import { AppError } from "../../src/server/errors.ts";
import { LiaraDatabaseReadClient, parseDatabaseCapabilitiesResponse, parseDatabaseInventoryResponse, quoteDatabaseOffer } from "../../src/server/liara/database-read.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";
import type { Transport } from "../../src/server/providers/http.ts";

const scope = { accountId: "a".repeat(24), teamId: "b".repeat(24) }, id = "c".repeat(24), otherId = "d".repeat(24);
const privateValue = "synthetic-private-database-value";
const config = (overrides: Partial<Config> = {}): Config => ({ ...readConfig({ LIARA_TEAM_ID: scope.teamId, LIARA_API_TOKEN: "synthetic-liara-account-value",
  LAUNCHLANE_ENABLE_LIVE_LIARA: "true", LAUNCHLANE_SESSION_SECRET: "synthetic-session-value-".repeat(2) }), projectSecretValues: [privateValue], ...overrides });
const budget = (limits: { tools?: number; timeout?: number } = {}) => new RunBudget({ maxModelCalls: 0, maxToolCalls: limits.tools ?? 8, runTimeoutMs: limits.timeout ?? 2000 });
const signal = () => AbortSignal.timeout(2500);
const code = (expected: string) => (error: unknown) => error instanceof AppError && error.code === expected;
const database = (overrides: Record<string, unknown> = {}) => ({ _id: id, hostname: "fixture-postgres", type: "postgres", scale: 1,
  status: "RUNNING", planID: "g2-fixture", bundlePlanID: "fixture-bundle", created_at: "2026-10-25T00:00:00.000Z", ...overrides });
const me = () => ({ user: { _id: scope.accountId }, team: { _id: scope.teamId, balance: 100_000 },
  databaseVersions: { postgres: [{ value: "16.4", label: "Untrusted display text" }] },
  defaultDatabaseVersions: { postgres: "16.4" },
  plans: { databases: { "g2-fixture": { available: true, supports: ["postgres"], price: 100, displayPrice: 72_000,
      RAM: { amount: 1 }, CPU: { amount: 0.5 }, volume: 2 } },
    databaseBundlePlans: { "g2-fixture": { basic: { available: true, price: 10, displayPrice: 7_200 } } } } });
const json = (value: unknown, status = 200) => Response.json(value, { status });

test("CLI-shaped inventory exports only metadata; RUNNING, scale and a hostname are not database health", () => {
  const result = parseDatabaseInventoryResponse({ databases: [database({ password: privateValue, connectionString: `postgres://example:${privateValue}@example.invalid/db`,
    version: "16.4", network: otherId, publicNetwork: true })] }, scope, 1234);
  assert.equal(result.contract, "liara-database-inventory-v1"); assert.equal(result.observedAt, 1234);
  const row = result.databases[0]; assert.ok(row);
  assert.equal(row.id, id); assert.equal(row.type, "postgres"); assert.equal(row.status, "RUNNING");
  assert.equal(row.dataAccess, "unverified"); assert.equal(row.version, null); assert.equal(row.networkId, null); assert.equal(row.publicNetwork, null);
  assert.equal(JSON.stringify(result).includes(privateValue), false); assert.equal("password" in row, false); assert.equal("connectionString" in row, false);
  assert.deepEqual(result.coverage, { pagination: "undocumented", completeness: "unknown", observedCount: 1, limit: 1000 });
});
test("missing optional measurements stay null and empty inventory stays observed but incomplete", () => {
  const row = parseDatabaseInventoryResponse({ databases: [{ _id: id, hostname: "fixture", type: "provider-engine" }] }, scope).databases[0];
  assert.ok(row); assert.equal(row.scale, null); assert.equal(row.status, null); assert.equal(row.planId, null); assert.equal(row.createdAt, null);
  const empty = parseDatabaseInventoryResponse({ databases: [], next: "untrusted-cursor", hasMore: true }, scope);
  assert.deepEqual(empty.databases, []); assert.equal(empty.coverage.completeness, "unknown");
  assert.equal(parseDatabaseInventoryResponse({ databases: [database({ scale: 0 })] }, scope).databases[0]?.scale, 0);
});
test("malformed, duplicate, excessive and credential-bearing inventory is never replaced with empty data", () => {
  for (const payload of [null, {}, { databases: null }, { databases: {} }, { databases: [database({ _id: "not-an-internal-id" })] },
    { databases: [database({ hostname: "postgres://user:password@example.invalid" })] }, { databases: [database({ scale: "1" })] },
    { databases: [database({ created_at: 1792886400000 })] }, { databases: [database({ created_at: "2026-10-25T00:00:00" })] },
    { databases: [database(), database({ hostname: "another" })] }, { databases: [database(), database({ _id: otherId })] },
    { databases: Array.from({ length: 1001 }, () => database()) }]) assert.throws(() => parseDatabaseInventoryResponse(payload, scope), code("DATABASE_RESPONSE_INVALID"));
  assert.throws(() => parseDatabaseInventoryResponse({ databases: [database({ hostname: privateValue })] }, scope, Date.now(), [privateValue]), code("SENSITIVE_RESPONSE"));
  assert.throws(() => databaseAccountScope({ ...scope, accountId: "invalid" }));
});
test("account capabilities use dynamic provider type/version/plan identifiers and make no provision or connectivity claim", () => {
  const source = me(); source.databaseVersions.postgres.push({ value: "17.2", label: privateValue });
  const result = parseDatabaseCapabilitiesResponse(source, scope);
  assert.equal(result.catalog, "observed"); assert.deepEqual(result.engines, [{ type: "postgres", versions: ["16.4", "17.2"] }]);
  assert.deepEqual(result.plans, [{ id: "g2-fixture", available: true, supports: ["postgres"], hourlyToman: 100,
    monthlyDisplayToman: 72_000, ramAmount: 1, cpuAmount: 0.5, volumeAmount: 2 }]);
  assert.deepEqual(result.bundles, [{ planId: "g2-fixture", bundleId: "basic", available: true, hourlyToman: 10, monthlyDisplayToman: 7_200 }]);
  assert.deepEqual(result.defaults, { postgres: "16.4" }); assert.equal(result.balanceToman, 100_000);
  assert.deepEqual(result.operations, { inventory: "read_only", credentials: "unsupported", provision: "not_implemented", migrate: "not_implemented", connectivity: "unverified" });
  assert.equal(JSON.stringify(result).includes(privateValue), false);
  const missing = parseDatabaseCapabilitiesResponse({ user: source.user, team: source.team }, scope);
  assert.equal(missing.catalog, "unsupported"); assert.deepEqual(missing.engines, []);
});

test("database quote exposes component prices without inventing a combined total", () => {
  const capabilities = parseDatabaseCapabilitiesResponse(me(), scope);
  const quote = quoteDatabaseOffer(capabilities, { type: "postgres", version: "16.4", planId: "g2-fixture", bundleId: "basic" });
  assert.equal(quote.planHourlyToman, 100); assert.equal(quote.planMonthlyDisplayToman, 72_000);
  assert.equal(quote.bundleHourlyToman, 10); assert.equal(quote.bundleMonthlyDisplayToman, 7_200);
  assert.equal(quote.balanceToman, 100_000); assert.equal(quote.creditCoversPlanBaseHour, true);
  assert.equal(quote.combinedTotal, "not_computed"); assert.equal(quote.unit, "toman_per_hour");
  assert.ok(quote.unknown.includes("combined_total")); assert.ok(quote.unknown.includes("tax_traffic_storage"));
  for (const input of [
    { type: "mysql", version: "16.4", planId: "g2-fixture", bundleId: "basic" },
    { type: "postgres", version: "15.0", planId: "g2-fixture", bundleId: "basic" },
    { type: "postgres", version: "16.4", planId: "missing-plan", bundleId: "basic" },
    { type: "postgres", version: "16.4", planId: "g2-fixture", bundleId: "missing-bundle" },
    { type: "postgres", version: "16.4", planId: "g2-fixture" },
  ]) assert.throws(() => quoteDatabaseOffer(capabilities, input));
  const unknownPrice = parseDatabaseCapabilitiesResponse({ ...me(),
    plans: { databases: { "g2-fixture": { available: true, supports: ["postgres"] } },
      databaseBundlePlans: { "g2-fixture": { basic: { available: true } } } } }, scope);
  const uncertain = quoteDatabaseOffer(unknownPrice, { type: "postgres", version: "16.4", planId: "g2-fixture", bundleId: "basic" });
  assert.equal(uncertain.planHourlyToman, null); assert.equal(uncertain.bundleHourlyToman, null);
  assert.equal(uncertain.creditCoversPlanBaseHour, null); assert.equal(uncertain.unit, null);
  assert.ok(uncertain.unknown.includes("plan_hourly_price")); assert.ok(uncertain.unknown.includes("bundle_hourly_price"));
});

test("catalog identity, malformed supported versions, availability and plan bounds fail closed", () => {
  for (const changed of [{ ...me(), user: { _id: otherId } }, { ...me(), team: { _id: otherId } }])
    assert.throws(() => parseDatabaseCapabilitiesResponse(changed, scope), code("SCOPE_DENIED"));
  for (const changed of [{ ...me(), databaseVersions: null }, { ...me(), databaseVersions: { postgres: [{ value: 16 }] } },
    { ...me(), databaseVersions: { postgres: [{ value: "16" }, { value: "16" }] } },
    { ...me(), databaseVersions: { postgres: Array.from({ length: 129 }, () => ({ value: "16" })) } },
    { ...me(), plans: { databases: { fixture: { supports: ["postgres"] } } } },
    { ...me(), plans: { databases: { fixture: { available: true, supports: ["postgres", "postgres"] } } } },
    { ...me(), plans: { databases: Object.fromEntries(Array.from({ length: 201 }, (_, n) => [`fixture${n}`, { available: false, supports: [] }])) } }])
    assert.throws(() => parseDatabaseCapabilitiesResponse(changed, scope), code("DATABASE_RESPONSE_INVALID"));
  const partial = parseDatabaseCapabilitiesResponse({ ...me(), plans: {} }, scope); assert.equal(partial.catalog, "unsupported");
  assert.throws(() => parseDatabaseCapabilitiesResponse({ ...me(), databaseVersions: { [privateValue]: [{ value: "1" }] } }, scope, Date.now(), [privateValue]), code("SENSITIVE_RESPONSE"));
});
test("inventory verifies fresh account/team identity, uses only scoped GETs and consumes the aggregate tool budget", async () => {
  const requests: { path: string; method: string | undefined }[] = [], c = config(), usage = budget();
  const send: Transport = async (address, init) => {
    const url = new URL(address); assert.equal(url.origin, "https://api.liara.ir"); assert.equal(url.searchParams.get("teamID"), scope.teamId);
    assert.deepEqual([...url.searchParams.keys()], ["teamID"]); assert.equal(init.redirect, "error"); assert.equal(init.cache, "no-store");
    assert.equal(new Headers(init.headers).get("authorization"), `Bearer ${c.liaraToken}`); assert.equal(init.body, undefined);
    requests.push({ path: url.pathname, method: init.method });
    return json(url.pathname === "/v1/me" ? me() : { databases: [database()] });
  };
  const result = await new LiaraDatabaseReadClient(c, scope.accountId, send).inventory(usage, signal());
  assert.equal(result.accountId, scope.accountId); assert.equal(result.databases[0]?.id, id); assert.equal(usage.toolCalls, 2); assert.equal(usage.modelCalls, 0);
  assert.deepEqual(requests, [{ path: "/v1/me", method: "GET" }, { path: "/v1/databases", method: "GET" }]);
});
test("database lookup selects the exact internal identity; an unobserved ID is not a missing database claim", async () => {
  const requests: string[] = [], client = new LiaraDatabaseReadClient(config(), scope.accountId, async url => {
    requests.push(new URL(url).pathname); return json(url.includes("/v1/me?") ? me() : { databases: [database()] });
  });
  const found = await client.database({ ...scope, databaseId: id }, budget(), signal());
  assert.equal(found.outcome, "observed"); assert.equal(found.resource?.id, id);
  const unseen = await client.database({ ...scope, databaseId: otherId }, budget(), signal());
  assert.equal(unseen.outcome, "not_observed"); assert.equal(unseen.resource, null); assert.equal(unseen.coverage.completeness, "unknown");
  await assert.rejects(client.database({ ...scope, teamId: otherId, databaseId: id }, budget(), signal()), code("SCOPE_DENIED"));
  await assert.rejects(client.database({ ...scope, accountId: otherId, databaseId: id }, budget(), signal()), code("SCOPE_DENIED"));
  assert.equal(requests.length, 4); assert.equal(requests.some(path => path.includes(id)), false, "no invented per-database detail endpoint");
});
test("a caller configuration refresh cannot switch the team or credential between identity and inventory", async () => {
  const c = config(), originalToken = c.liaraToken, requests: string[] = [];
  const client = new LiaraDatabaseReadClient(c, scope.accountId, async (address, init) => {
    const url = new URL(address); requests.push(url.pathname);
    assert.equal(url.searchParams.get("teamID"), scope.teamId);
    assert.equal(new Headers(init.headers).get("authorization"), `Bearer ${originalToken}`);
    c.teamId = otherId; c.liaraToken = "synthetic-switched-token";
    return json(url.pathname === "/v1/me" ? me() : { databases: [database()] });
  });
  const result = await client.inventory(budget(), signal()); assert.equal(result.teamId, scope.teamId); assert.equal(requests.length, 2);
});
test("wrong provider account/team and invalid identifiers stop before inventory transport", async () => {
  for (const identity of [{ ...me(), user: { _id: otherId } }, { ...me(), team: { _id: otherId } }]) {
    const requests: string[] = [], client = new LiaraDatabaseReadClient(config(), scope.accountId, async url => { requests.push(new URL(url).pathname); return json(identity); });
    await assert.rejects(client.inventory(budget(), signal()), code("SCOPE_DENIED")); assert.deepEqual(requests, ["/v1/me"]);
  }
  let calls = 0; const client = new LiaraDatabaseReadClient(config(), scope.accountId, async () => { calls++; return json(me()); });
  await assert.rejects(client.database({ ...scope, databaseId: "../databases" }, budget(), signal()), code("INVALID_INPUT")); assert.equal(calls, 0);
});
test("read gates, provider host, cancellation and exhausted allowance perform no extra request", async () => {
  let calls = 0; const send: Transport = async () => { calls++; return json(me()); };
  for (const overrides of [{ enableLiveLiara: false }, { liaraToken: "" }, { liaraBaseUrl: "https://example.invalid" }])
    await assert.rejects(new LiaraDatabaseReadClient(config(overrides), scope.accountId, send).inventory(budget(), signal()), code(overrides.enableLiveLiara === false ? "LIVE_LIARA_DISABLED" : "LIARA_UNCONFIGURED"));
  const stopped = new AbortController(); stopped.abort();
  await assert.rejects(new LiaraDatabaseReadClient(config(), scope.accountId, send).inventory(budget(), stopped.signal), code("CANCELLED")); assert.equal(calls, 0);
  const one = budget({ tools: 1 }); await assert.rejects(new LiaraDatabaseReadClient(config(), scope.accountId, send).inventory(one, signal()), code("BUDGET_EXHAUSTED"));
  assert.equal(calls, 1); assert.equal(one.toolCalls, 1);
});
test("provider auth/rate-limit/5xx/not-found responses are sanitized failures with no HTTP retries", async () => {
  for (const [status, expected] of [[401, "PROVIDER_AUTH"], [429, "PROVIDER_RATE_LIMIT"], [500, "PROVIDER_UNAVAILABLE"], [404, "PROVIDER_UNAVAILABLE"]] as const) {
    let calls = 0; const client = new LiaraDatabaseReadClient(config(), scope.accountId, async url => {
      calls++; return url.includes("/v1/me?") ? json(me()) : new Response(privateValue, { status });
    });
    await assert.rejects(client.inventory(budget(), signal()), error => code(expected)(error) && !String(error).includes(privateValue)); assert.equal(calls, 2);
  }
});
test("only the existing bounded connect-timeout GET retry is used and every attempt consumes the same allowance", async () => {
  let attempts = 0; const usage = budget(), client = new LiaraDatabaseReadClient(config(), scope.accountId, async address => {
    if (new URL(address).pathname === "/v1/me") return json(me());
    attempts++;
    if (attempts === 1) throw new TypeError(privateValue, { cause: { code: "UND_ERR_CONNECT_TIMEOUT" } });
    return json({ databases: [] });
  });
  const result = await client.inventory(usage, signal()); assert.equal(result.coverage.observedCount, 0); assert.equal(attempts, 2); assert.equal(usage.toolCalls, 3);
  let failures = 0; const unavailable = new LiaraDatabaseReadClient(config(), scope.accountId, async address => {
    if (new URL(address).pathname === "/v1/me") return json(me());
    failures++; throw new Error(privateValue);
  });
  await assert.rejects(unavailable.inventory(budget(), signal()), error => code("PROVIDER_TRANSPORT")(error) && !String(error).includes(privateValue)); assert.equal(failures, 1);
});
test("invalid JSON/MIME, excessive content and secret-shaped metadata remain typed failures", async () => {
  for (const response of [new Response("{", { headers: { "content-type": "application/json" } }), new Response("upstream failure", { headers: { "content-type": "text/html" } }),
    new Response("{}", { headers: { "content-type": "application/json", "content-length": String(1024 * 1024 + 1) } }),
    json({ databases: [database({ hostname: privateValue })] })]) {
    const client = new LiaraDatabaseReadClient(config(), scope.accountId, async url => url.includes("/v1/me?") ? json(me()) : response);
    await assert.rejects(client.inventory(budget(), signal()), error => error instanceof AppError && !String(error).includes(privateValue));
  }
});
test("capabilities validate identity in their own response without repeated reads or hard-coded engine versions", async () => {
  let calls = 0; const usage = budget(), client = new LiaraDatabaseReadClient(config(), scope.accountId, async url => {
    calls++; assert.equal(new URL(url).pathname, "/v1/me"); return json(me());
  });
  const result = await client.capabilities(usage, signal()); assert.equal(calls, 1); assert.equal(usage.toolCalls, 1); assert.equal(result.engines[0]?.type, "postgres");
});
test("rejected response bodies are cancelled even when MIME or declared size fails before JSON parsing", async () => {
  const rejectedHeaders: HeadersInit[] = [{ "content-type": "text/html" }, { "content-type": "application/json", "content-length": String(1024 * 1024 + 1) }];
  for (const headers of rejectedHeaders) {
    let cancelled = false;
    const response = new Response(new ReadableStream({ cancel() { cancelled = true; } }), { headers });
    const client = new LiaraDatabaseReadClient(config(), scope.accountId, async url => url.includes("/v1/me?") ? json(me()) : response);
    await assert.rejects(client.inventory(budget(), signal()), error => error instanceof AppError);
    assert.equal(cancelled, true);
  }
});
test("streamed response bytes are bounded even without a Content-Length header", async () => {
  let cancelled = false;
  const oversized = new Response(new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(1024 * 1024 + 1)); }, cancel() { cancelled = true; },
  }), { headers: { "content-type": "application/json" } });
  const client = new LiaraDatabaseReadClient(config(), scope.accountId, async address => new URL(address).pathname === "/v1/me" ? json(me()) : oversized);
  await assert.rejects(client.inventory(budget(), signal()), code("UPSTREAM_LIMIT")); assert.equal(cancelled, true);
});
test("header and body deadlines stop non-cooperating transports; late data cannot become a successful inventory", async () => {
  const client = new LiaraDatabaseReadClient(config(), scope.accountId, async url => url.includes("/v1/me?") ? json(me()) : new Promise<Response>(() => undefined));
  await assert.rejects(client.inventory(budget({ timeout: 35 }), signal()), code("BUDGET_EXHAUSTED"));
  const slow = new LiaraDatabaseReadClient(config(), scope.accountId, async url => url.includes("/v1/me?") ? json(me()) : new Response(new ReadableStream({
    start(controller) { setTimeout(() => { controller.enqueue(new TextEncoder().encode('{"databases":[]}')); controller.close(); }, 80); },
  }), { headers: { "content-type": "application/json" } }));
  await assert.rejects(slow.inventory(budget({ timeout: 35 }), signal()), code("BUDGET_EXHAUSTED"));
});
