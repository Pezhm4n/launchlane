const assert = require("node:assert/strict"), { test } = require("node:test"), { randomUUID } = require("node:crypto");
test("original empty-schema API oracle inserts actual rows and retains them after application replacement", async () => {
  for (const target of ["auth", "profile"]) {
    const url = `http://127.0.0.1:3000/api/entry/${target}`, before = await fetch(url); assert.ok([200, 404].includes(before.status));
    const existing = before.status === 200 ? await before.json() : null, note = existing?.note ?? randomUUID();
    if (existing) { assert.equal(existing.id, 7); assert.equal(existing.label, target); }
    const saved = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ note }) });
    assert.equal(saved.status, 200); const value = await saved.json(); assert.equal(value.id, 7); assert.equal(value.label, target); assert.equal(value.note, note);
    assert.equal((await (await fetch(url)).json()).note, note);
  }
});
