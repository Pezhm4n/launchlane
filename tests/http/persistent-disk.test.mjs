import assert from "node:assert/strict";
import { test } from "node:test";
import { startTestServer } from "../../scripts/test-server.mjs";

test("disk endpoints require authenticated read/write, exact inputs, CSRF and open mutation gates", async () => {
  const server = await startTestServer();
  let cookie = "", csrf = "";
  const request = (path, body, extra = {}) => fetch(server.origin + path, {
    method: body === undefined ? "GET" : "POST", signal: AbortSignal.timeout(10000),
    headers: { origin: server.origin, cookie, ...(body === undefined ? {} : { "content-type": "application/json", "x-csrf-token": csrf }), ...extra },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const expect = async (response, status, code) => {
    assert.equal(response.status, status);const payload = await response.json();assert.equal(payload.error.code, code);
    assert.ok(payload.error.requestId);assert.equal(typeof payload.error.retryable, "boolean");return payload;
  };
  try {
    const path = "/api/projects/disks", proposal = { operation: "propose", projectId: "a".repeat(36), requestKey: "b".repeat(36) };
    await expect(await request(`${path}?project=${proposal.projectId}`), 401, "AUTH_REQUIRED");
    await expect(await request(path, proposal), 401, "AUTH_REQUIRED");
    const login = await request("/api/session", { token: server.token });assert.equal(login.status, 200);
    cookie = login.headers.get("set-cookie").split(";")[0];csrf = (await login.json()).session.csrfToken;
    await expect(await request(path, proposal, { "x-csrf-token": "forged" }), 403, "CSRF_DENIED");
    await expect(await request(path, { ...proposal, approved: true }), 400, "INVALID_INPUT");
    await expect(await request(path, { operation: "resize", approved: true }), 400, "INVALID_OPERATION");
    await expect(await request(`${path}?project=${proposal.projectId}&actor=forged`), 400, "INVALID_INPUT");
    await expect(await request(`${path}?project=${proposal.projectId}`), 409, "PROJECT_CHANGED");
    await expect(await request(path, proposal), 403, "MUTATIONS_DISABLED");
    const runPath = `/api/agent/runs/${"a".repeat(36)}`, decision = { operation: "disk-decision", actionId: "b".repeat(36), revision: 1, decision: "approve" };
    await expect(await request(runPath, decision, { "x-csrf-token": "forged" }), 403, "CSRF_DENIED");
    await expect(await request(runPath, { ...decision, approved: true }), 400, "INVALID_INPUT");
    await expect(await request(runPath, decision), 409, "AGENT_CONFLICT");
    const workspace = await (await request("/api/workspace")).json();assert.deepEqual(workspace.actions, []);
  } finally { await server.close(); }
});
