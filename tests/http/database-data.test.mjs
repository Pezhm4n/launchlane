import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { startTestServer } from "../../scripts/test-server.mjs";

test("data observations require scoped authentication/CSRF and default off without any SQL or infrastructure write", async () => {
  const server = await startTestServer(); let cookie = "", csrf = "";
  const request = (body, extra = {}) => fetch(`${server.origin}/api/projects/database-data`, { method: "POST", headers: {
    origin: server.origin, cookie, "content-type": "application/json", "x-csrf-token": csrf, ...extra }, body: JSON.stringify(body) });
  const expect = async (response, status, code) => { assert.equal(response.status, status); const row = await response.json(); assert.equal(row.error.code, code); };
  try {
    await expect(await request({ actionId: randomUUID() }), 401, "AUTH_REQUIRED");
    await expect(await fetch(`${server.origin}/api/projects/database-data?actionId=${randomUUID()}`), 401, "AUTH_REQUIRED");
    const login = await fetch(`${server.origin}/api/session`, { method: "POST", headers: { origin: server.origin, "content-type": "application/json" }, body: JSON.stringify({ token: server.token }) });
    cookie = login.headers.get("set-cookie").split(";")[0]; csrf = (await login.json()).session.csrfToken;
    await expect(await request({ actionId: randomUUID() }, { "x-csrf-token": "forged" }), 403, "CSRF_DENIED");
    await expect(await request({ actionId: randomUUID() }, { origin: "https://untrusted.example" }), 403, "ORIGIN_DENIED");
    await expect(await request({ actionId: "not-a-uuid" }), 400, "INVALID_INPUT");
    for (const key of ["sql", "url", "credential"]) await expect(await request({ actionId: randomUUID(), [key]: "forged" }), 400, "INVALID_INPUT");
    await expect(await request({ actionId: randomUUID(), baselineId: "forged" }), 400, "INVALID_INPUT");
    await expect(await request({ actionId: randomUUID() }), 403, "DATABASE_DATA_READS_DISABLED");
    for (const query of ["", "?actionId=invalid", `?actionId=${randomUUID()}&sql=SELECT`, `?actionId=${randomUUID()}&actionId=${randomUUID()}`])
      await expect(await fetch(`${server.origin}/api/projects/database-data${query}`, { headers: { cookie } }), 400, "INVALID_INPUT");
  } finally { await server.close(); }
});
