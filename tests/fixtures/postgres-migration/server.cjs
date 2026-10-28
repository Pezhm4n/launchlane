const express = require("express"), { Pool } = require("pg"), { join } = require("node:path");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const app = express();
app.use(express.json());
app.get("/api/entry", async (_req, res) => {
  try { res.json((await pool.query("SELECT id,label,note FROM public.entries WHERE id=7")).rows[0]); }
  catch { res.status(500).json({ error: "database_not_prepared" }); }
});
app.post("/api/entry", async (req, res) => {
  if (typeof req.body.note !== "string" || !/^[a-f0-9-]{36}$/.test(req.body.note)) return res.status(400).end();
  try { const result = await pool.query("UPDATE public.entries SET note=COALESCE(note,$1) WHERE id=7 RETURNING id,label,note", [req.body.note]); res.json(result.rows[0]); }
  catch { res.status(500).json({ error: "write_failed" }); }
});
app.use(express.static(join(__dirname, "dist")));
app.listen(3000, "0.0.0.0");
