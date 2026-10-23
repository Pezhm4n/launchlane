import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { startTestServer } from "../../scripts/test-server.mjs";

test("native folder import is authenticated, scoped and usable without a configured server workspace", async () => {
  const server = await startTestServer({ workspaceConfigured: false });
  let cookie = "", csrf = "";
  const form = (path = "server.mjs") => {
    const data = new FormData();
    data.set("manifest", JSON.stringify({ name: "my-local-app", paths: ["package.json", path] }));
    data.set("file-0", new Blob([JSON.stringify({ engines: { node: "22" }, scripts: { start: "node server.mjs" } })]), "package.json");
    data.set("file-1", new Blob(["import http from 'node:http'; http.createServer((q,s)=>s.end('hello')).listen(process.env.PORT || 3000);"]), "server.mjs");
    return data;
  };
  const upload = (body, headers = {}) => fetch(`${server.origin}/api/projects/upload`, {
    method: "POST", body, headers: { origin: server.origin, cookie, "x-csrf-token": csrf, ...headers }, signal: AbortSignal.timeout(15000),
  });
  const check = async (response, status, code) => {
    const data = await response.json(); assert.equal(response.status, status, JSON.stringify(data));
    if (code) assert.equal(data.error.code, code); return data;
  };
  try {
    await check(await upload(form()), 401, "AUTH_REQUIRED");
    const login = await fetch(`${server.origin}/api/session`, { method: "POST", headers: { origin: server.origin, "content-type": "application/json" }, body: JSON.stringify({ token: server.token }) });
    assert.equal(login.status, 200); cookie = login.headers.get("set-cookie").split(";")[0];
    const workspace = await check(await fetch(`${server.origin}/api/workspace`, { headers: { cookie } }), 200);
    csrf = workspace.session.csrfToken;
    assert.notEqual(workspace.capabilities.workspace.state, "available");
    await check(await upload(form(), { "x-csrf-token": "invalid" }), 403, "CSRF_DENIED");
    await check(await upload(form(), { origin: "https://other.invalid" }), 403, "ORIGIN_DENIED");
    await check(await upload(form("../outside.mjs")), 403, "UNSAFE_PATH");
    await check(await upload(form(".env")), 403, "UNSAFE_PATH");
    const prepared = await check(await upload(form()), 201);
    assert.equal(prepared.flow.selection.kind, "upload"); assert.equal(prepared.flow.status, "ready");
    assert.equal(prepared.flow.displayName, "my-local-app"); assert.equal(prepared.action, null);
    assert.deepEqual(prepared.flow.profile.manifest.map(row => row.path), ["package.json", "server.mjs"]);
    assert.match(await readFile(join(server.stateDir, "uploaded-sources", prepared.flow.id, "server.mjs"), "utf8"), /createServer/);
    const restored = await check(await fetch(`${server.origin}/api/project-flows?id=${prepared.flow.id}`, { headers: { cookie } }), 200);
    assert.equal(restored.flow.id, prepared.flow.id); assert.equal(restored.flow.displayName, "my-local-app");
    await check(await upload(form(".env.local")), 403, "UNSAFE_PATH");
    const preserved = await check(await fetch(`${server.origin}/api/project-flows`, { headers: { cookie } }), 200);
    assert.equal(preserved.flow.id, prepared.flow.id);
  } finally { await server.close(); }
});
