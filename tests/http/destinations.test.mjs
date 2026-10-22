import assert from "node:assert/strict";
import { test } from "node:test";
import { startTestServer } from "../../scripts/test-server.mjs";

test("destination routes require operator session and CSRF, reject forged operations and keep live gates closed", async () => {
  const server = await startTestServer();
  let cookie = "", csrf = "";
  const request = (path, body, extra = {}) => fetch(server.origin + path, { method: body === undefined ? "GET" : "POST",
    headers: { origin: server.origin, cookie, ...(body === undefined ? {} : { "content-type": "application/json", "x-csrf-token": csrf }), ...extra },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10000) });
  const expect = async (r, status, code) => { assert.equal(r.status, status); const payload = await r.json(); if (code) assert.equal(payload.error.code, code); return payload; };
  try {
    await expect(await request("/api/destinations", { operation: "options" }), 401, "AUTH_REQUIRED");
    await expect(await request(`/api/destinations/${"a".repeat(36)}`), 401, "AUTH_REQUIRED");
    const login = await request("/api/session", { token: server.token }); assert.equal(login.status, 200);
    cookie = login.headers.get("set-cookie").split(";")[0]; csrf = (await login.json()).session.csrfToken;
    await expect(await request("/api/destinations", { operation: "options" }, { "x-csrf-token": "forged" }), 403, "CSRF_DENIED");
    await expect(await request("/api/destinations", { operation: "options", role: "system" }), 400, "INVALID_INPUT");
    await expect(await request("/api/destinations", { operation: "create", approved: true }), 400, "INVALID_OPERATION");
    await expect(await request("/api/destinations", { operation: "options" }), 403, "LIARA_AUTH_REQUIRED");
    await expect(await request("/api/destinations", { operation: "propose", projectId: "a".repeat(36), app: server.app,
      planId: "starter", bundleId: "basic", networkId: "c".repeat(24) }), 403, "MUTATIONS_DISABLED");
    await expect(await request(`/api/destinations/${"a".repeat(36)}`), 404, "NOT_FOUND");
    const workspace = await expect(await request("/api/workspace"), 200);
    assert.equal(workspace.actions.length, 0);
  } finally { await server.close(); }
});
