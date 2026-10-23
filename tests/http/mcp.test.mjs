import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { setTimeout as pause } from "node:timers/promises";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { startTestServer } from "../../scripts/test-server.mjs";

function decoded(result) {
  assert.equal(result.content[0].type, "text");
  return JSON.parse(result.content[0].text);
}
test("real MCP SDK HTTP and stdio share the web mission, enforce scope and replay without a second model owner", async t => {
  const server = await startTestServer({ agentFixture: true });
  const clients = [];
  let cookie = "", csrf = "";
  const web = (path, body, method = body === undefined ? "GET" : "POST") => fetch(server.origin + path, { method, signal: AbortSignal.timeout(15000), headers: { origin: server.origin, cookie, "x-csrf-token": csrf, ...(body === undefined ? {} : { "content-type": "application/json" }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const rpc = (token, body, headers = {}) => fetch(`${server.origin}/api/mcp`, { method: "POST", signal: AbortSignal.timeout(15000), headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json, text/event-stream", ...headers }, body: JSON.stringify(body) });
  async function connect(access) {
    const client = new Client({ name: "launchlane-regression", version: "1" }); clients.push(client);
    await client.connect(new StreamableHTTPClientTransport(new URL(`${server.origin}/api/mcp`), { requestInit: { headers: { authorization: `Bearer ${access.accessToken}` } } }));
    return client;
  }
  const calls = async () => (await readFile(server.modelLog, "utf8").catch(() => "")).split("\n").filter(Boolean).length;
  try {
    await t.test("neither MCP transport nor access issuance accepts an unauthenticated request", async () => {
      assert.equal((await rpc("", { jsonrpc: "2.0", id: 1, method: "tools/list" })).status, 401);
      assert.equal((await web("/api/mcp/access", { missions: true })).status, 401);
    });
    const login = await web("/api/session", { token: server.token }); assert.equal(login.status, 200); cookie = login.headers.get("set-cookie").split(";")[0];
    csrf = (await (await web("/api/workspace")).json()).session.csrfToken;
    const readGrant = await (await web("/api/mcp/access", { missions: false })).json();
    const readClient = await connect(readGrant);
    await t.test("protocol request IDs survive the transport and incompatible versions or oversized bodies are rejected", async () => {
      const response = await rpc(readGrant.accessToken, { jsonrpc: "2.0", id: "correlation-e2e", method: "tools/list" }, { "mcp-protocol-version": "2025-11-25" });
      assert.equal(response.status, 200);
      const body = await response.text(), message = JSON.parse(response.headers.get("content-type").includes("text/event-stream") ? body.match(/^data: (.+)$/m)[1] : body);
      assert.equal(message.id, "correlation-e2e");
      const incompatible = await rpc(readGrant.accessToken, { jsonrpc: "2.0", id: 2, method: "tools/list" }, { "mcp-protocol-version": "2099-01-01" });
      assert.equal(incompatible.status, 400);
      const oversized = await rpc(readGrant.accessToken, { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "inspect_project", arguments: { padding: "x".repeat(18000) } } });
      assert.equal(oversized.status, 413); assert.equal(await calls(), 0);
    });
    await t.test("SDK negotiation discovers the actual read tools; a read grant cannot create missions or approve writes", async () => {
      assert.equal(readClient.getServerVersion().name, "launchlane");
      const tools = (await readClient.listTools()).tools.map(tool => tool.name);
      assert.ok(tools.includes("read_project_file")); assert.ok(!tools.includes("launchlane_publish")); assert.ok(!tools.includes("propose_code_repair"));
      const denied = await readClient.callTool({ name: "launchlane_publish", arguments: {} });
      assert.equal(denied.isError, true); assert.equal(decoded(denied).error.code, "TOOL_DENIED");
      assert.equal((await rpc(readGrant.accessToken, { jsonrpc: "2.0", id: 8, method: "tools/list" }, { origin: "https://untrusted.test" })).status, 403);
      assert.equal((await rpc(server.token, { jsonrpc: "2.0", id: 9, method: "tools/list" })).status, 401);
      assert.equal(await calls(), 0);
    });
    const prepared = await web("/api/project-flows", { operation: "prepare", selection: { kind: "sample", directory: "examples/node-service" } }); assert.equal(prepared.status, 201);
    const flow = (await prepared.json()).flow;
    const accessResponse = await web("/api/mcp/access", { missions: true }); assert.equal(accessResponse.status, 201);
    const access = await accessResponse.json(), client = await connect(access);
    const input = { requestKey: randomUUID(), publication: { projectId: flow.id, sourceHash: flow.profile.sourceHash, path: "/", expectedText: null } };
    let run;
    await t.test("a real MCP call inspects the same project and rejects secret/outside paths", async () => {
      const inspected = decoded(await client.callTool({ name: "inspect_project", arguments: {} })).data;
      assert.equal(inspected.runtime, "node");
      const denied = decoded(await client.callTool({ name: "read_project_file", arguments: { path: ".env" } }));
      assert.equal(denied.error.code, "SOURCE_PATH_DENIED");
      const invalid = decoded(await client.callTool({ name: "inspect_project", arguments: { approved: true } }));
      assert.equal(invalid.error.code, "INVALID_INPUT");
    });
    await t.test("MCP and web registrations join one application mission and authoritative replay", async () => {
      run = decoded(await client.callTool({ name: "launchlane_publish", arguments: input })).data.run;
      assert.ok(run.id); assert.equal(run.mission.projectId, flow.id);
      const duplicate = await web("/api/agent/runs", { operation: "publish", ...input, requestKey: randomUUID() });
      assert.equal(duplicate.status, 200); assert.equal((await duplicate.json()).run.id, run.id);
      for (let attempt = 0; attempt < 100; attempt++) {
        const snapshot = await (await web(`/api/agent/runs/${run.id}`)).json(); run = snapshot.run;
        if (!["queued", "working"].includes(run.state)) break;
        await pause(100);
      }
      assert.ok(!["queued", "working"].includes(run.state));
      const saved = decoded(await client.callTool({ name: "launchlane_mission", arguments: { id: run.id, after: 0 } })).data;
      assert.deepEqual(saved.run, run); assert.equal(saved.approvalTransport, "launchlane_web");
      assert.equal(saved.reviewUrl, `${server.origin}/?view=publish&project=${flow.id}`);
    });
    await t.test("disconnect/reconnect and the actual stdio bridge preserve the mission without model/write replay", async () => {
      const count = await calls(); await client.close();
      const reconnected = await connect(access);
      assert.deepEqual(decoded(await reconnected.callTool({ name: "launchlane_mission", arguments: { id: run.id, after: 10000 } })).data.events, []);
      const path = join(server.workspace, "..", "mcp-access.json");
      await writeFile(path, JSON.stringify({ ...access, url: `${server.origin}/api/mcp` }));
      const bridge = new Client({ name: "stdio-regression", version: "1" }); clients.push(bridge);
      const transport = new StdioClientTransport({ command: process.execPath, args: [resolve("scripts/mcp-stdio.mjs")], env: { LAUNCHLANE_MCP_ACCESS_FILE: path }, stderr: "pipe" });
      let errors = ""; transport.stderr?.on("data", chunk => { errors += chunk; });
      await bridge.connect(transport);
      assert.ok((await bridge.listTools()).tools.some(tool => tool.name === "inspect_project"));
      assert.equal(decoded(await bridge.callTool({ name: "launchlane_mission", arguments: { id: run.id } })).data.run.id, run.id);
      const context = decoded(await bridge.callTool({ name: "launchlane_context", arguments: {} })).data;
      assert.equal(context.project.id, flow.id);
      await bridge.close();
      assert.ok(!errors.includes(access.accessToken)); assert.equal(await calls(), count);
    });
    await t.test("explicit revocation blocks a valid token and operator logout also revokes remaining child access", async () => {
      assert.equal((await web("/api/mcp/access", { id: readGrant.id }, "DELETE")).status, 200);
      assert.equal((await rpc(readGrant.accessToken, { jsonrpc: "2.0", id: 10, method: "tools/list" })).status, 401);
      assert.equal((await web("/api/session", undefined, "DELETE")).status, 200);
      assert.equal((await rpc(access.accessToken, { jsonrpc: "2.0", id: 11, method: "tools/list" })).status, 401);
    });
  } finally { await Promise.allSettled(clients.map(client => client.close())); await server.close(); }
});
