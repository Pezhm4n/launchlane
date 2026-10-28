const express = require("express"), { Pool } = require("pg"), { join } = require("node:path");
const pools = { auth: new Pool({ connectionString: process.env.AUTH_DB_URL }), profile: new Pool({ connectionString: process.env.PROFILE_DB_URL }) }, app = express();
app.use(express.json());
app.get("/api/ready/:target", async (req, res) => {
  const pool = pools[req.params.target]; if (!pool) return res.status(404).end();
  try { const result = await pool.query("SELECT 1 AS connected"); res.json({ connected: result.rows[0].connected === 1 }); } catch { res.status(500).end(); }
});
app.get("/api/entry/:target", async (req, res) => {
  const pool = pools[req.params.target]; if (!pool) return res.status(404).end();
  try { const row = (await pool.query('SELECT id,label,"noteValue" AS note FROM public."Records" WHERE id=7')).rows[0]; if (!row) return res.status(404).end(); res.json(row); } catch { res.status(500).end(); }
});
app.post("/api/entry/:target", async (req, res) => {
  const pool = pools[req.params.target]; if (!pool) return res.status(404).end();
  if (typeof req.body.note !== "string" || !/^[a-f0-9-]{36}$/.test(req.body.note)) return res.status(400).end();
  try { res.json((await pool.query('INSERT INTO public."Records"(id,label,"noteValue") VALUES(7,$1,$2) ON CONFLICT(id) DO UPDATE SET "noteValue"=COALESCE("Records"."noteValue",EXCLUDED."noteValue") RETURNING id,label,"noteValue" AS note', [req.params.target, req.body.note])).rows[0]); } catch { res.status(500).end(); }
});
app.use(express.static(join(__dirname, "dist"))); app.listen(3000, "0.0.0.0");
