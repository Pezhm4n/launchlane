import assert from "node:assert/strict";
import { test } from "node:test";
import { startTestServer } from "../../scripts/test-server.mjs";

test("database decision, observation and secure binding require auth, CSRF and exact host-owned arguments", async () => {
  const server = await startTestServer(); let cookie = "", csrf = "";
  const request = (path, body, extra = {}) => fetch(server.origin + path, { method: "POST", signal: AbortSignal.timeout(10000),
    headers: { origin: server.origin, cookie, "content-type": "application/json", "x-csrf-token": csrf, ...extra }, body: JSON.stringify(body) });
  const expect = async (response, status, code) => { assert.equal(response.status, status); const payload = await response.json(); assert.equal(payload.error.code, code); assert.ok(payload.error.requestId); };
  const runPath = `/api/agent/runs/${"a".repeat(36)}`, decision = { operation: "database-decision", actionId: "b".repeat(36), revision: 1, decision: "approve" },
    binding = { operation: "propose-database", runId: "a".repeat(36), requestKey: "b".repeat(36) };
  try {
    await expect(await request(runPath, decision), 401, "AUTH_REQUIRED"); await expect(await request("/api/project-environment", binding), 401, "AUTH_REQUIRED");
    const login = await request("/api/session", { token: server.token }); assert.equal(login.status, 200); cookie = login.headers.get("set-cookie").split(";")[0]; csrf = (await login.json()).session.csrfToken;
    await expect(await request(runPath, decision, { "x-csrf-token": "forged" }), 403, "CSRF_DENIED");
    await expect(await request(runPath, { ...decision, approved: true }), 400, "INVALID_INPUT");
    await expect(await request(runPath, { ...decision, decision: "create" }), 400, "INVALID_INPUT");
    await expect(await request(runPath, decision), 409, "AGENT_CONFLICT");
    await expect(await request(runPath, { operation: "database-observe", revision: 1 }), 409, "AGENT_CONFLICT");
    await expect(await request("/api/project-environment", { ...binding, password: "model-cannot-inject" }), 400, "INVALID_INPUT");
    await expect(await request("/api/project-environment", binding), 403, "MUTATIONS_DISABLED");
  } finally { await server.close(); }
});
