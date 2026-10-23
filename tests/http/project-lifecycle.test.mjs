import assert from "node:assert/strict";
import { test } from "node:test";
import { startTestServer } from "../../scripts/test-server.mjs";

test("project removal and lifecycle require authentication, CSRF, exact operations and human confirmation", async () => {
  const server = await startTestServer(); let cookie = "", csrf = "";
  const request = (path, body, method, extra = {}) => fetch(server.origin + path, { method: method ?? (body === undefined ? "GET" : "POST"), headers: {
    origin: server.origin, cookie, "content-type": "application/json", "x-csrf-token": csrf, ...extra }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const expect = async (response, status, code) => { assert.equal(response.status, status); const row = await response.json(); if (code) assert.equal(row.error.code, code); return row; };
  try {
    await expect(await request("/api/projects/library", {}, "DELETE"), 401, "AUTH_REQUIRED");
    await expect(await request("/api/projects/lifecycle?project=abc"), 401, "AUTH_REQUIRED");
    const login = await request("/api/session", { token: server.token }); cookie = login.headers.get("set-cookie").split(";")[0]; csrf = (await login.json()).session.csrfToken;
    const flow = (await expect(await request("/api/project-flows", { operation: "prepare", selection: { kind: "sample", directory: "examples/node-service" } }), 201)).flow;
    const body = { id: flow.id, sourceHash: flow.profile.sourceHash, confirmed: true };
    await expect(await request("/api/projects/library", body, "DELETE", { "x-csrf-token": "forged" }), 403, "CSRF_DENIED");
    await expect(await request("/api/projects/library", { ...body, confirmed: false }, "DELETE"), 409, "CONFIRMATION_REQUIRED");
    await expect(await request("/api/projects/library", { ...body, force: true }, "DELETE"), 400, "INVALID_INPUT");
    await expect(await request("/api/projects/lifecycle", { operation: "shell", actionId: flow.id }), 400, "INVALID_OPERATION");
    await expect(await request("/api/projects/lifecycle", { operation: "propose", projectId: flow.id, effect: "delete_app", requestKey: flow.id }), 403, "MUTATIONS_DISABLED");
    await expect(await request("/api/projects/library", body, "DELETE"), 200);
    await expect(await request("/api/projects/library", body, "DELETE"), 200);
    assert.deepEqual((await expect(await request("/api/projects/library"), 200)).projects, []);
    await expect(await request("/api/projects/library", { id: flow.id }), 409, "PROJECT_ARCHIVED");
    assert.equal((await expect(await request("/api/workspace"), 200)).actions.length, 0);
  } finally { await server.close(); }
});
