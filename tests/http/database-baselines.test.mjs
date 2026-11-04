import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { startTestServer } from "../../scripts/test-server.mjs";

test("baseline intake enforces authentication, CSRF and the selected PostgreSQL source before parsing a dump", async () => {
  const server = await startTestServer(); let cookie = "", csrf = "";
  const path = `/api/projects/database-baselines?projectId=${randomUUID()}`;
  const post = (headers = {}) => fetch(server.origin + path, { method: "POST", headers: { origin: server.origin, cookie, "x-csrf-token": csrf, ...headers }, body: new FormData() });
  const expect = async (response, status, code) => { assert.equal(response.status, status); assert.equal((await response.json()).error.code, code); };
  try {
    await expect(await post(), 401, "AUTH_REQUIRED");
    await expect(await fetch(server.origin + path), 401, "AUTH_REQUIRED");
    const login = await fetch(`${server.origin}/api/session`, { method: "POST", headers: { origin: server.origin, "content-type": "application/json" }, body: JSON.stringify({ token: server.token }) });
    cookie = login.headers.get("set-cookie").split(";")[0]; csrf = (await login.json()).session.csrfToken;
    await expect(await post({ "x-csrf-token": "forged" }), 403, "CSRF_DENIED");
    await expect(await post({ origin: "https://untrusted.example" }), 403, "ORIGIN_DENIED");
    await expect(await post(), 409, "DATABASE_BASELINE_PROJECT_CHANGED");
    await expect(await fetch(server.origin + path, { headers: { cookie } }), 409, "DATABASE_BASELINE_PROJECT_CHANGED");
    for (const query of ["", "?projectId=invalid", `?projectId=${randomUUID()}&sql=SELECT`, `?projectId=${randomUUID()}&projectId=${randomUUID()}`])
      await expect(await fetch(`${server.origin}/api/projects/database-baselines${query}`, { headers: { cookie } }), 400, "INVALID_INPUT");
  } finally { await server.close(); }
});
