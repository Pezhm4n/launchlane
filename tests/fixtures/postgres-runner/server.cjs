const express = require("express"), { Pool } = require("pg"), { join } = require("node:path");
const pools = { auth: new Pool({ connectionString: process.env.AUTH_DB_URL }), profile: new Pool({ connectionString: process.env.PROFILE_DB_URL }) }, app = express();
app.use(express.json());
app.get("/api/entry/:target", async (req, res) => {
  const pool = pools[req.params.target]; if (!pool) return res.status(404).end();
  try { res.json((await pool.query("SELECT id,label,note FROM public.entries WHERE id=7")).rows[0]); } catch { res.status(500).json({ error: "database_not_prepared" }); }
});
app.post("/api/entry/:target", async (req, res) => {
  const pool = pools[req.params.target]; if (!pool) return res.status(404).end();
  if (typeof req.body.note !== "string" || !/^[a-f0-9-]{36}$/.test(req.body.note)) return res.status(400).end();
  try { res.json((await pool.query("UPDATE public.entries SET note=COALESCE(note,$1) WHERE id=7 RETURNING id,label,note", [req.body.note])).rows[0]); } catch { res.status(500).json({ error: "write_failed" }); }
});
app.use(express.static(join(__dirname, "dist"))); app.listen(3000, "0.0.0.0");
