const { Client } = require("pg"), { readFileSync } = require("node:fs"), { createHash } = require("node:crypto");
const sql = readFileSync("001_entries.sql", "utf8"), checksum = createHash("sha256").update(sql).digest("hex");
async function migrate(connectionString, label) {
  const client = new Client({ connectionString }); await client.connect();
  try {
    await client.query("BEGIN"); await client.query("SELECT pg_advisory_xact_lock(103714,1)");
    await client.query("CREATE TABLE IF NOT EXISTS public.schema_migrations(version text PRIMARY KEY,checksum text NOT NULL)");
    const applied = await client.query("SELECT checksum FROM public.schema_migrations WHERE version=$1", ["001_entries.sql"]);
    if (applied.rows.length) { if (applied.rows[0].checksum !== checksum) throw Error("original migration checksum changed"); }
    else {
      await client.query(sql); await client.query("INSERT INTO public.entries(id,label) VALUES(7,$1)", [label]);
      await client.query("INSERT INTO public.schema_migrations(version,checksum) VALUES($1,$2)", ["001_entries.sql", checksum]);
    }
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { await client.end(); }
}
(async () => { await migrate(process.env.AUTH_DB_URL, "identity datum"); await migrate(process.env.PROFILE_DB_URL, "profile datum"); console.log("Original runner completed"); })().catch(error => { console.error(error.message); process.exitCode = 1; });
