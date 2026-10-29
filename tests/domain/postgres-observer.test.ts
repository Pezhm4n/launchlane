import assert from "node:assert/strict";
import { test } from "node:test";
import type { PostgresDataOracle } from "../../src/contracts/postgres-migration-test.ts";
import { PostgresObserver, type PostgresObserverSessionInput, type PostgresObserverSession } from "../../src/server/liara/postgres-observer.ts";
import { AppError } from "../../src/server/errors.ts";

const connection = { host: "approved-db", port: 5432, username: "application", password: "local-test-only-password", database: "application" };
const options = { expectedMajor: "16.3", network: { mode: "private_network" as const }, digestKey: "private-observer-digest-key-for-tests", signal: new AbortController().signal };
const oracle: PostgresDataOracle = {
  columns: [{ relation: "public.Account", name: "id", type: "integer", nullable: false }, { relation: "public.Account", name: "value", type: "text", nullable: true }, { relation: "public.Account", name: "title", type: "text", nullable: false }],
  rows: [{ relation: "public.Account", key: { column: "id", value: 1 }, values: [{ column: "title", value: "public test fixture" }] }],
  persistence: [{ relation: "public.Account", key: { column: "id", value: 1 }, column: "value" }],
};
function harness(replace?: (sql: string, values: readonly unknown[]) => readonly unknown[] | undefined) {
  let connections = 0, ended = 0, destroyed = 0;
  const inputs: PostgresObserverSessionInput[] = [], calls: { sql: string; values: readonly unknown[] }[] = [];
  const createSession = (input: PostgresObserverSessionInput): PostgresObserverSession => {
    inputs.push(input);
    return {
      async connect() { connections++; },
      async query(sql, values) {
        calls.push({ sql, values }); const replacement = replace?.(sql, values); if (replacement) return replacement;
        if (sql.includes("current_database()")) return [{ database: connection.database, username: connection.username, version: "160003", readonly: "on" }];
        if (sql.includes("AS matches")) return [{ matches: oracle.columns.length, unsupported: 0 }];
        if (sql.includes("AS oversized")) return [{ count: 1, oversized: false, value: "application-generated-private-cell" }];
        if (sql.includes("AS ok")) return [{ count: 1, ok: true }];
        return [];
      },
      async end() { ended++; },
      destroy() { destroyed++; },
    };
  };
  const observer = new PostgresObserver({ resolve: async () => [{ address: "172.20.0.7", family: 4 }], createSession });
  return { observer, createSession, inputs, calls, counts: () => ({ connections, ended, destroyed }) };
}
function code(expected: string) { return (error: unknown) => error instanceof AppError && error.code === expected && !error.message.includes(connection.password); }

test("PostgreSQL observation pins its private address, verifies identity and uses only bounded host SELECTs in a readonly snapshot", async () => {
  const f = harness(); let taken = 0;
  const result = await f.observer.observe(connection, oracle, { ...options, take: () => { taken++; } });
  assert.deepEqual({ ...result.observation, checkedAt: 0 }, { checkedAt: 0, serverMajor: 16, columnChecks: 3, rowChecks: 1, persistenceChecks: 1,
    schemaMatches: true, rowsMatch: true, persistencePresent: true, persistenceNonNull: true });
  assert.equal(result.privatePersistence.length, 1); assert.match(result.privatePersistence[0] ?? "", /^[a-f0-9]{64}$/);
  assert.equal(f.inputs[0]?.address, "172.20.0.7"); assert.equal(f.inputs[0]?.host, connection.host); assert.equal(f.inputs[0]?.network.mode, "private_network");
  assert.equal(f.calls[0]?.sql, "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  assert.ok(f.calls[1]?.sql.includes("statement_timeout','3000ms'")); assert.ok(f.calls[1]?.sql.includes("search_path','pg_catalog'"));
  assert.equal(f.calls.at(-1)?.sql, "ROLLBACK"); assert.equal(taken, f.calls.length); assert.equal(f.calls.length, 7);
  assert.deepEqual(f.counts(), { connections: 1, ended: 1, destroyed: 1 });
  const serializable = JSON.stringify(result.observation); assert.ok(!serializable.includes(connection.password));
  assert.ok(!serializable.includes(connection.host)); assert.ok(!serializable.includes("application-generated-private-cell"));
  assert.ok(!serializable.includes(result.privatePersistence[0] ?? ""));
  assert.ok(f.calls.some(call => call.sql.includes('public."Account"')));
  assert.ok(f.calls.every(call => !call.sql.includes(connection.password) && !call.sql.includes("public test fixture")));
  assert.ok(f.calls.some(call => call.values.includes(JSON.stringify("public test fixture"))));
});

test("persistence digests are stable across fresh sessions only with the same private key and source oracle", async () => {
  const f = harness(), first = await f.observer.observe(connection, oracle, options), second = await f.observer.observe(connection, oracle, options);
  assert.deepEqual(first.privatePersistence, second.privatePersistence); assert.equal(f.counts().connections, 2);
  const different = await f.observer.observe(connection, oracle, { ...options, digestKey: "a-different-private-digest-key-for-tests" });
  assert.notDeepEqual(first.privatePersistence, different.privatePersistence);
});

test("schema mismatch blocks data lookup and never establishes data readiness", async () => {
  const f = harness(sql => sql.includes("AS matches") ? [{ matches: 2, unsupported: 0 }] : undefined), result = await f.observer.observe(connection, oracle, options);
  assert.equal(result.observation.schemaMatches, false); assert.equal(result.observation.rowsMatch, false);
  assert.equal(result.observation.persistencePresent, false); assert.equal(result.observation.rowChecks, 0); assert.equal(result.observation.persistenceChecks, 0);
  assert.deepEqual(result.privatePersistence, []); assert.equal(f.calls.length, 5);
});

test("missing, duplicate, null and incorrect fixed data are observed as failed checks", async () => {
  for (const count of [0, 2]) {
    const f = harness(sql => sql.includes("AS oversized") ? [{ count, oversized: false, value: null }] : sql.includes("AS ok") ? [{ count, ok: false }] : undefined);
    const result = await f.observer.observe(connection, oracle, options);
    assert.equal(result.observation.rowsMatch, false); assert.equal(result.observation.persistencePresent, false); assert.equal(result.observation.persistenceNonNull, false);
  }
  const f = harness(sql => sql.includes("AS oversized") ? [{ count: 1, oversized: false, value: null }] : undefined), result = await f.observer.observe(connection, oracle, options);
  assert.equal(result.observation.persistencePresent, true); assert.equal(result.observation.persistenceNonNull, false);
});

test("network validation rejects public, loopback, metadata, IPv6, mixed DNS and oversized answers before credentials are sent", async () => {
  for (const addresses of [[], [{ address: "127.0.0.1", family: 4 }], [{ address: "169.254.169.254", family: 4 }],
    [{ address: "93.184.216.34", family: 4 }], [{ address: "::1", family: 6 }], [{ address: "::ffff:10.0.0.1", family: 6 }],
    [{ address: "10.20.1.2", family: 4 }, { address: "1.1.1.1", family: 4 }], Array.from({ length: 9 }, () => ({ address: "10.20.1.2", family: 4 }))]) {
    const f = harness(), observer = new PostgresObserver({ resolve: async () => addresses, createSession: f.createSession });
    await assert.rejects(observer.observe(connection, oracle, options), code("DATABASE_DATA_NETWORK_DENIED")); assert.equal(f.inputs.length, 0);
  }
  for (const address of ["10.0.0.2", "172.16.0.2", "172.31.255.254", "192.168.1.2"]) {
    const f = harness(), observer = new PostgresObserver({ resolve: async () => [{ address, family: 4 }], createSession: f.createSession });
    await observer.observe(connection, oracle, options); assert.equal(f.inputs[0]?.address, address);
  }
});

test("only the validated DNS address is passed to the client and a fresh observation resolves again", async () => {
  const f = harness(); let resolutions = 0;
  const observer = new PostgresObserver({ resolve: async () => { resolutions++; return [{ address: resolutions === 1 ? "10.20.1.2" : "127.0.0.1", family: 4 }]; }, createSession: f.createSession });
  await observer.observe(connection, oracle, options); assert.equal(resolutions, 1); assert.equal(f.inputs[0]?.address, "10.20.1.2");
  await assert.rejects(observer.observe(connection, oracle, options), code("DATABASE_DATA_NETWORK_DENIED")); assert.equal(f.inputs.length, 1);
});

test("database, role, server version and readonly identity all have to match before schema reads", async () => {
  for (const change of [{ database: "another" }, { username: "another" }, { version: "150009" }, { readonly: "off" }, { version: "16.3" }]) {
    const f = harness(sql => sql.includes("current_database()") ? [{ database: connection.database, username: connection.username, version: "160003", readonly: "on", ...change }] : undefined);
    await assert.rejects(f.observer.observe(connection, oracle, options), code("DATABASE_DATA_IDENTITY_CHANGED"));
    assert.equal(f.calls.length, 3); assert.equal(f.counts().destroyed, 1);
  }
});

test("opaque provider/client errors and cancellation cannot leak credentials or become an observation", async () => {
  const f = harness(() => { throw new Error(`postgresql://${connection.username}:${connection.password}@${connection.host}`); });
  await assert.rejects(f.observer.observe(connection, oracle, options), code("DATABASE_DATA_UNAVAILABLE")); assert.equal(f.counts().destroyed, 1);
  const aborted = new AbortController(); aborted.abort();
  await assert.rejects(harness().observer.observe(connection, oracle, { ...options, signal: aborted.signal }), code("DATABASE_DATA_CANCELLED"));
});

test("abort destroys an active session and rejects even when the query never resolves", async () => {
  const controller = new AbortController(); let destroyed = 0, ended = 0;
  const observer = new PostgresObserver({ resolve: async () => [{ address: "10.1.2.3", family: 4 }], createSession: () => ({
    async connect() {}, query() { controller.abort(); return new Promise(() => undefined); }, async end() { ended++; }, destroy() { destroyed++; },
  }) });
  await assert.rejects(observer.observe(connection, oracle, { ...options, signal: controller.signal }), code("DATABASE_DATA_CANCELLED"));
  assert.ok(destroyed >= 1); assert.equal(ended, 1);
});

test("oversized or malformed responses fail closed and remain private", async () => {
  for (const replacement of [
    (sql: string) => sql.includes("AS oversized") ? [{ count: 1, oversized: true, value: null }] : undefined,
    (sql: string) => sql.includes("AS oversized") ? [{ count: 1, oversized: false, value: "s".repeat(17000) }] : undefined,
    (sql: string) => sql.includes("AS matches") ? [{ matches: 999 }] : undefined,
    (sql: string) => sql.includes("AS matches") ? [{ matches: 3 }, { matches: 3 }, { matches: 3 }] : undefined,
  ]) {
    const f = harness(replacement); await assert.rejects(f.observer.observe(connection, oracle, options), error => error instanceof AppError && !error.message.includes(connection.password));
    assert.equal(f.counts().destroyed, 1);
  }
});

test("caller cannot add URL/options, arbitrary identifiers, implicit transport or a weak digest key", async () => {
  const f = harness();
  const extraConnection = { ...connection, connectionString: "postgres://wrong" };
  await assert.rejects(f.observer.observe(extraConnection, oracle, options));
  await assert.rejects(f.observer.observe({ ...connection, host: "http://internal/admin" }, oracle, options));
  await assert.rejects(f.observer.observe(connection, { ...oracle, columns: [{ ...oracle.columns[0], relation: "public.Account; SELECT dangerous()", name: "id", type: "integer", nullable: false }] }, options));
  await assert.rejects(f.observer.observe(connection, oracle, { ...options, digestKey: "weak" }));
  const insecureNetwork = { mode: "tls" as const, rejectUnauthorized: false };
  await assert.rejects(f.observer.observe(connection, oracle, { ...options, network: insecureNetwork }));
  assert.equal(f.inputs.length, 0);
});

test("explicit TLS configuration reaches the pinned client unchanged and never selects an insecure mode", async () => {
  const f = harness(); await f.observer.observe(connection, oracle, { ...options, network: { mode: "tls", ca: "trusted operator CA" } });
  assert.deepEqual(f.inputs[0]?.network, { mode: "tls", ca: "trusted operator CA" });
});

test("custom types are rejected before any selected value or custom output function is read", async () => {
  const f = harness(sql => sql.includes("AS matches") ? [{ matches: 2, unsupported: 1 }] : undefined);
  await assert.rejects(f.observer.observe(connection, oracle, options), code("DATABASE_DATA_TYPE_UNSUPPORTED"));
  assert.ok(f.calls.every(call => !call.sql.includes('public."Account"')));
  assert.ok(f.calls.some(call => call.sql.includes("pg_catalog.pg_type") && call.sql.includes("tn.nspname='pg_catalog'")));
});

test("the maximum oracle stays within29 parameterized queries and every query spends the durable tool budget", async () => {
  const maximum: PostgresDataOracle = { ...oracle,
    rows: Array.from({ length: 16 }, (_, i) => ({ relation: "public.Account", key: { column: "id", value: i }, values: [{ column: "title", value: "public fixture" }] })),
    persistence: Array.from({ length: 8 }, (_, i) => ({ relation: "public.Account", key: { column: "id", value: i }, column: "value" })),
  };
  const f = harness(); let taken = 0;
  await f.observer.observe(connection, maximum, { ...options, take: () => { taken++; } });
  assert.equal(f.calls.length, 29); assert.equal(taken, 29);
  const denied = harness(); let allowance = 3;
  await assert.rejects(denied.observer.observe(connection, oracle, { ...options, take: () => { if (--allowance < 0) throw new AppError("BUDGET_EXHAUSTED", "internal text"); } }), code("BUDGET_EXHAUSTED"));
  assert.equal(denied.calls.length, 3); assert.equal(denied.counts().destroyed, 1);
});
