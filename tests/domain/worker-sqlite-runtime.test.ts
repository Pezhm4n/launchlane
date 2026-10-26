import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { runInNewContext } from "node:vm";
import { workerSqliteDatabaseProgram } from "../../src/server/agent/worker-sqlite-runtime.ts";

type Result = { success: boolean; results: Record<string, unknown>[]; meta: { changes: number } };
type Statement = { bind: (...values: unknown[]) => Statement; all: () => Promise<Result>; run: () => Promise<Result>; first: (column?: string) => Promise<unknown> };
type Binding = { prepare: (sql: string) => Statement; batch: (statements: Statement[]) => Promise<Result[]> };
type Migration = { name: string; sql: string; sha256: string };
type Runtime = { DatabaseBinding: new (db: DatabaseSync) => Binding; migrate: (db: DatabaseSync, inputs: Migration[]) => { applied: number; total: number } };
const require = createRequire(import.meta.url);
const plain = (value: unknown): unknown => JSON.parse(JSON.stringify(value));
function fixture() {
  const module = { exports: {} as unknown };
  runInNewContext(workerSqliteDatabaseProgram, { module, require, Buffer, performance, Uint8Array, ArrayBuffer }, { timeout: 1000 });
  const runtime = module.exports as Runtime, sqlite = new DatabaseSync(":memory:"), db = new runtime.DatabaseBinding(sqlite);
  return { ...runtime, sqlite, db };
}
const migration = (name: string, sql: string): Migration => ({ name, sql, sha256: createHash("sha256").update(sql).digest("hex") });

test("D1's repeated numbered and anonymous bindings retain order without rewriting literals or comments", async () => {
  const f = fixture();try {
    const row = await f.db.prepare("SELECT ?2 AS second, ?1 AS first, ?2 AS again, ? AS third, '?7' AS literal /* ?8 */ -- ?9\n").bind("a", "b", "c").first();
    assert.deepEqual(plain(row), { second: "b", first: "a", again: "b", third: "c", literal: "?7" });
    const base = f.db.prepare("SELECT ? AS value"), first = base.bind("one"), second = base.bind("two");
    assert.equal(await first.first("value"), "one");assert.equal(await second.first("value"), "two");
    await assert.rejects(base.all(), /D1_BIND_COUNT_MISMATCH/);
    assert.equal(await f.db.prepare("SELECT 1 AS x WHERE 0").first(), null);
    await assert.rejects(first.first("missing"), /D1_COLUMN_NOT_FOUND/);
  } finally { f.sqlite.close(); }
});

test("binding rejects unsupported values, named placeholders, malformed queries and additional statements", async () => {
  const f = fixture();try {
    for (const value of [undefined, NaN, Infinity, 1n, {}, [1, 2]]) assert.throws(() => f.db.prepare("SELECT ?").bind(value), /D1_BIND_TYPE_UNSUPPORTED/);
    for (const query of ["SELECT :value", "SELECT @value", "SELECT $value", "SELECT ?0", "SELECT ?32767", "SELECT '?", "SELECT 1 /*", "SELECT 1; DELETE FROM x"])
      assert.throws(() => f.db.prepare(query), /D1_/);
    assert.equal(await f.db.prepare("SELECT ? AS x; -- one statement\n").bind(true).first("x"), 1);
  } finally { f.sqlite.close(); }
});

test("an actual SQLite batch rolls back all preceding writes on a later error and rejects foreign statements", async () => {
  const f = fixture(), other = new DatabaseSync(":memory:"), foreign = new f.DatabaseBinding(other);try {
    f.sqlite.exec("CREATE TABLE events (id INTEGER PRIMARY KEY,value TEXT)");
    await assert.rejects(f.db.batch([f.db.prepare("INSERT INTO events VALUES (?,?)").bind(1, "synthetic"), f.db.prepare("INSERT INTO missing_table VALUES (1)")]), /missing_table/);
    assert.equal(f.sqlite.prepare("SELECT count(*) n FROM events").get()?.n, 0);
    await assert.rejects(f.db.batch([f.db.prepare("INSERT INTO events VALUES (1,'local')"), foreign.prepare("SELECT 1")]), /D1_STATEMENT_OWNER_MISMATCH/);
    assert.equal(f.sqlite.prepare("SELECT count(*) n FROM events").get()?.n, 0);
    const rows = await f.db.batch([f.db.prepare("INSERT INTO events VALUES (1,'local')"), f.db.prepare("SELECT * FROM events")]);
    assert.equal(rows[0]?.meta.changes, 1);assert.deepEqual(plain(rows[1]?.results), [{ id: 1, value: "local" }]);
  } finally { f.sqlite.close();other.close(); }
});

test("migration checksums, lexical filenames and ownership survive reruns without resetting stored data", () => {
  const f = fixture();try {
    const initial = migration("0001_init.sql", "CREATE TABLE events (id INTEGER PRIMARY KEY,value TEXT);");
    const seed = migration("0002_seed.sql", "INSERT INTO events VALUES (1,'synthetic');");
    assert.deepEqual(plain(f.migrate(f.sqlite, [seed, initial])), { applied: 2, total: 2 });
    f.sqlite.prepare("UPDATE events SET value=?").run("persisted synthetic edit");
    assert.deepEqual(plain(f.migrate(f.sqlite, [initial, seed])), { applied: 0, total: 2 });
    assert.equal(f.sqlite.prepare("SELECT value FROM events").get()?.value, "persisted synthetic edit");
    assert.throws(() => f.migrate(f.sqlite, [initial]), /D1_MIGRATION_CHANGED/);
    assert.throws(() => f.migrate(f.sqlite, [initial, migration(seed.name, "DELETE FROM events;")]), /D1_MIGRATION_CHANGED/);
    assert.equal(f.sqlite.prepare("SELECT count(*) n FROM events").get()?.n, 1);
    const day = migration("0008_day.sql", "ALTER TABLE events ADD COLUMN day INTEGER;"), plan = migration("0008_plan.sql", "ALTER TABLE events ADD COLUMN plan INTEGER;");
    assert.deepEqual(plain(f.migrate(f.sqlite, [initial, seed, plan, day])), { applied: 2, total: 4 });
  } finally { f.sqlite.close(); }
});

test("failed pending migration is atomic; unknown populated databases and changed bytes fail before data writes", () => {
  const f = fixture();try {
    const initial = migration("0001_init.sql", "CREATE TABLE events (id INTEGER PRIMARY KEY);"), bad = migration("0002_bad.sql", "INSERT INTO missing_table VALUES (1);");
    assert.throws(() => f.migrate(f.sqlite, [initial, bad]), /missing_table/);
    assert.equal(f.sqlite.prepare("SELECT count(*) n FROM sqlite_master WHERE name='events'").get()?.n, 0);
    assert.throws(() => f.migrate(f.sqlite, [{ ...initial, sha256: "a".repeat(64) }]), /D1_MIGRATION_INVALID/);
    f.sqlite.exec("CREATE TABLE owner_data (id INTEGER);INSERT INTO owner_data VALUES (9)");
    assert.throws(() => f.migrate(f.sqlite, [initial]), /D1_MIGRATION_UNOWNED_DATABASE/);
    assert.equal(f.sqlite.prepare("SELECT id FROM owner_data").get()?.id, 9);
  } finally { f.sqlite.close(); }
});
