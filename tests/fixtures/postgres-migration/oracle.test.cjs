const assert = require("node:assert/strict"), { test } = require("node:test"), { randomUUID } = require("node:crypto");
test("original API oracle writes once to real data and reads the same value", async () => {
  const origin = "http://127.0.0.1:3000";
  const initial = await fetch(`${origin}/api/entry`); assert.equal(initial.status, 200);
  const row = await initial.json(); assert.equal(row.id, 7); assert.equal(row.label, "original datum");
  const expected = row.note ?? randomUUID();
  const saved = await fetch(`${origin}/api/entry`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ note: expected }) });
  assert.equal(saved.status, 200); assert.equal((await saved.json()).note, expected);
  const read = await (await fetch(`${origin}/api/entry`)).json(); assert.equal(read.note, expected); assert.equal(read.label, "original datum");
});
test("the app namespace cannot connect as the fixture root over TCP", async () => {
  const { Client } = require("pg"), url = new URL(process.env.DATABASE_URL); url.username = "launchlane_fixture";
  const root = new Client({ connectionString: url.href, connectionTimeoutMillis: 1000 });
  try { await assert.rejects(root.connect(), /pg_hba.conf rejects connection/); } finally { await root.end().catch(() => {}); }
});
