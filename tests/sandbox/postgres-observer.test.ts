import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { test } from "node:test";
import type { PostgresDataOracle } from "../../src/contracts/postgres-migration-test.ts";
import { PostgresObserver } from "../../src/server/liara/postgres-observer.ts";
import { AppError } from "../../src/server/errors.ts";
import { createPostgresObserverFixture } from "../helpers/postgres-observer-fixture.ts";

// Actual default pg driver and pinned PostgreSQL. No model, provider account, production connection or SQL write.
// Fixture SQL below belongs only to the exact disposable container. Product observations remain READ ONLY.
test("actual private PostgreSQL independently verifies bounded schema/data in fresh readonly driver sessions", { timeout: 180000 }, async () => {
  const password = randomBytes(24).toString("hex"), privateKey = randomBytes(32).toString("hex"), fixture = await createPostgresObserverFixture();
  const { address, port, sql } = fixture;
  try {
    await sql(`CREATE ROLE observer_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '${password}';
      CREATE TABLE public."Account"(id integer PRIMARY KEY,title text NOT NULL,nullable_text text,value uuid);
      INSERT INTO public."Account" VALUES(1,'public fixture',NULL,'${randomUUID()}');
      GRANT CONNECT ON DATABASE postgres TO observer_app; GRANT USAGE ON SCHEMA public TO observer_app;
      GRANT SELECT ON public."Account" TO observer_app;`);
    const oracle: PostgresDataOracle = {
      columns: [{ relation: "public.Account", name: "id", type: "integer", nullable: false }, { relation: "public.Account", name: "title", type: "text", nullable: false },
        { relation: "public.Account", name: "nullable_text", type: "text", nullable: true }, { relation: "public.Account", name: "value", type: "uuid", nullable: true }],
      rows: [{ relation: "public.Account", key: { column: "id", value: 1 }, values: [{ column: "title", value: "public fixture" }, { column: "nullable_text", value: null }] }],
      persistence: [{ relation: "public.Account", key: { column: "id", value: 1 }, column: "value" }],
    };
    const observer = new PostgresObserver({ resolve: async host => { assert.equal(host, "observer-fixture"); return [{ address, family: 4 }]; } }),
      privateConnection = { host: "observer-fixture", port, username: "observer_app", password, database: "postgres" },
      options = { expectedMajor: "16", network: { mode: "private_network" as const }, digestKey: privateKey, signal: AbortSignal.timeout(60000) };
    const first = await observer.observe(privateConnection, oracle, options);
    assert.ok(first.observation.schemaMatches && first.observation.rowsMatch && first.observation.persistencePresent && first.observation.persistenceNonNull);
    assert.equal(first.observation.serverMajor, 16); assert.equal(first.observation.columnChecks, 4);
    assert.equal(first.observation.rowChecks, 1); assert.equal(first.observation.persistenceChecks, 1);
    assert.ok(!JSON.stringify(first.observation).includes(password) && !JSON.stringify(first.observation).includes(first.privatePersistence[0] ?? ""));
    const second = await observer.observe(privateConnection, oracle, options);
    assert.ok(JSON.stringify(first.privatePersistence) === JSON.stringify(second.privatePersistence), "A second fresh connection must read the same selected data.");
    await sql(`UPDATE public."Account" SET value='${randomUUID()}' WHERE id=1;`);
    const changed = await observer.observe(privateConnection, oracle, options);
    assert.ok(JSON.stringify(first.privatePersistence) !== JSON.stringify(changed.privatePersistence), "An external fixture write must change the private digest.");
    const wrongSchema = await observer.observe(privateConnection, { ...oracle, columns: [...oracle.columns, { relation: "public.Account", name: "absent", type: "text", nullable: true }] }, options);
    assert.equal(wrongSchema.observation.schemaMatches, false); assert.equal(wrongSchema.observation.rowChecks, 0);
    await sql('ALTER TABLE public."Account" ALTER COLUMN value TYPE text USING value::text; UPDATE public."Account" SET value=repeat(\'z\',50000);');
    const textOracle = { ...oracle, columns: oracle.columns.map(column => column.name === "value" ? { ...column, type: "text" } : column) };
    await assert.rejects(observer.observe(privateConnection, textOracle, options), error => error instanceof AppError && error.code === "DATABASE_DATA_LIMIT");
    await sql('CREATE TYPE public.observer_enum AS ENUM(\'ready\'); ALTER TABLE public."Account" ALTER COLUMN value TYPE public.observer_enum USING \'ready\'::public.observer_enum;');
    await assert.rejects(observer.observe(privateConnection, oracle, options), error => error instanceof AppError && error.code === "DATABASE_DATA_TYPE_UNSUPPORTED");
    assert.equal(await sql("SELECT count(*) FROM pg_catalog.pg_stat_activity WHERE usename='observer_app';"), "0", "Every product observer connection must be closed.");
  } finally {
    await fixture.close();
  }
});
