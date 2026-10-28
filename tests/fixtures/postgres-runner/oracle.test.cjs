const assert = require("node:assert/strict"), { test } = require("node:test"), { randomUUID } = require("node:crypto"), { Client } = require("pg");
test("original API oracle writes once and reads actual data independently in both databases", async () => {
  for (const [target, label] of [["auth", "identity datum"], ["profile", "profile datum"]]) {
    const url = `http://127.0.0.1:3000/api/entry/${target}`, initial = await fetch(url); assert.equal(initial.status, 200);
    const row = await initial.json(); assert.equal(row.id, 7); assert.equal(row.label, label); const note = row.note ?? randomUUID();
    const saved = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ note }) });
    assert.equal(saved.status, 200); assert.equal((await saved.json()).note, note); assert.equal((await (await fetch(url)).json()).note, note);
  }
});
test("app roles cannot cross database boundaries or connect as root or observer", async () => {
  for (const mode of ["cross", "root", "observer"]) {
    const url = new URL(process.env.AUTH_DB_URL);
    if (mode === "cross") url.pathname = new URL(process.env.PROFILE_DB_URL).pathname;
    else url.username = mode === "root" ? "launchlane_fixture" : "launchlane_observer";
    const client = new Client({ connectionString: url.href, connectionTimeoutMillis: 1000 });
    try { await assert.rejects(client.connect(), /pg_hba.conf rejects connection/); } finally { await client.end().catch(() => {}); }
  }
  for (const key of ["AUTH_DB_URL", "PROFILE_DB_URL"]) {
    const client = new Client({ connectionString: process.env[key] }); await client.connect();
    try { const row = (await client.query("SELECT rolsuper,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user")).rows[0]; assert.deepEqual(row, { rolsuper: false, rolcreatedb: false, rolcreaterole: false }); } finally { await client.end(); }
  }
});
