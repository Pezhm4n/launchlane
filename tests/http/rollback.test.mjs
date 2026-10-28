import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { startTestServer } from "../../scripts/test-server.mjs";

test("rollback endpoint requires a session, CSRF, an exact action id and the live mutation gate", async () => {
  const server = await startTestServer();
  let cookie = "", csrf = "";
  const request = (body, headers = {}) => fetch(`${server.origin}/api/projects/rollback`, {
    method: "POST",
    headers: { origin: server.origin, cookie, "content-type": "application/json", "x-csrf-token": csrf, ...headers },
    body: JSON.stringify(body),
  });
  const expect = async (response, status, code) => {
    assert.equal(response.status, status);
    const row = await response.json();
    if (code) assert.equal(row.error.code, code);
    return row;
  };
  try {
    await expect(await request({ beforeActionId: randomUUID() }), 401, "AUTH_REQUIRED");
    const login = await fetch(`${server.origin}/api/session`, {
      method: "POST",
      headers: { origin: server.origin, "content-type": "application/json" },
      body: JSON.stringify({ token: server.token }),
    });
    cookie = login.headers.get("set-cookie").split(";")[0];
    csrf = (await login.json()).session.csrfToken;
    await expect(await request({ beforeActionId: randomUUID() }, { "x-csrf-token": "forged" }), 403, "CSRF_DENIED");
    await expect(await request({ beforeActionId: randomUUID(), extra: true }), 400, "INVALID_INPUT");
    await expect(await request({ beforeActionId: "not-a-uuid" }), 400, "INVALID_INPUT");
    await expect(await request({ beforeActionId: randomUUID() }), 403, "MUTATIONS_DISABLED");
  } finally { await server.close(); }
});
