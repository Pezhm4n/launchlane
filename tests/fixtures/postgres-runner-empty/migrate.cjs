const { Client } = require("pg");
(async () => {
  for (const connectionString of [process.env.AUTH_DB_URL, process.env.PROFILE_DB_URL]) {
    const client = new Client({ connectionString }); await client.connect();
    try {
      await client.query("BEGIN"); await client.query("SELECT pg_advisory_xact_lock(103715,1)");
      await client.query('CREATE TABLE IF NOT EXISTS "public"."Records" (id integer PRIMARY KEY,label text NOT NULL,"noteValue" text)');
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { await client.end(); }
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
