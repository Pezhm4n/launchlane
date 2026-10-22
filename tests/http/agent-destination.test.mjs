import assert from "node:assert/strict";
import { test } from "node:test";
import { startTestServer } from "../../scripts/test-server.mjs";
import { seedDestinationProposal } from "../helpers/destination-proposal.mjs";

test("agent destination decisions require session, CSRF and an exact run/action; closed gates cannot create", async () => {
  const server = await startTestServer();
  let fixture;
  try {
    fixture = await seedDestinationProposal(server);
    const path = `${server.origin}/api/agent/runs/${fixture.run.id}`, body = { operation: "destination-decision", revision: fixture.run.revision, actionId: fixture.action.id, decision: "approve" };
    const post = (headers = {}, data = body) => fetch(path, { method: "POST", headers: { "Content-Type": "application/json", Origin: server.origin, ...headers }, body: JSON.stringify(data) });
    assert.equal((await post()).status, 401);
    const login = await fetch(`${server.origin}/api/session`, { method: "POST", headers: { Origin: server.origin, "Content-Type": "application/json" }, body: JSON.stringify({ token: server.token }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0], csrf = (await login.json()).session.csrfToken;
    assert.equal((await post({ Cookie: cookie })).status, 403);
    const headers = { Cookie: cookie, "X-CSRF-Token": csrf };
    assert.equal((await post(headers, { ...body, actionId: "e".repeat(36) })).status, 409);
    const disabled = await post(headers);
    assert.equal(disabled.status, 403); assert.equal((await disabled.json()).error.code, "MUTATIONS_DISABLED");
    assert.equal((await post(headers, { operation: "destination-observe", revision: body.revision })).status, 409);
    const rejected = await post(headers, { ...body, decision: "reject" });
    assert.equal(rejected.status, 200); assert.equal((await rejected.json()).run.destination.state, "cancelled");
    assert.equal(fixture.store.db.prepare("SELECT COUNT(*) AS n FROM attempts").get().n, 0);
  } finally { fixture?.store.close(); await server.close(); }
});
