import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { startTestServer } from "./test-server.mjs";
import { mcpClientConfigurations } from "./mcp-client-config.ts";

// Opt-in compatibility probe: installed Codex host, no turn/start, no model or provider credentials.
const executable = process.env.LAUNCHLANE_CODEX_PATH || "codex";
const version = execFileSync(executable, ["--version"], { encoding: "utf8", windowsHide: true, timeout: 10000 }).trim();
assert.match(version, /^codex-cli [a-zA-Z0-9.+-]+$/);
const web = await startTestServer();
let child, report;
const pending = new Map();
async function closeWebFixture() {
  try { await web.close(); } catch (error) {
    const owned = resolve(web.workspace, "..");
    if (!owned.startsWith(join(tmpdir(), "launchlane-http-"))) throw error;
    // Windows can retain a just-closed SQLite handle briefly; retry cleanup of this fixture only.
    await rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  }
}
try {
  const login = await fetch(`${web.origin}/api/session`, { method: "POST", headers: { origin: web.origin, "content-type": "application/json" }, body: JSON.stringify({ token: web.token }) });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const workspace = await (await fetch(`${web.origin}/api/workspace`, { headers: { origin: web.origin, cookie } })).json();
  const response = await fetch(`${web.origin}/api/mcp/access`, { method: "POST", headers: { origin: web.origin, cookie, "x-csrf-token": workspace.session.csrfToken, "content-type": "application/json" }, body: JSON.stringify({ missions: false }) });
  assert.equal(response.status, 201);
  const access = await response.json(), home = join(web.workspace, "..", "codex-home"), accessPath = join(web.workspace, "..", "access.json");
  await mkdir(home);
  await writeFile(accessPath, JSON.stringify({ ...access, url: `${web.origin}/api/mcp` }), { mode: 0o600 });
  const snippet = mcpClientConfigurations(accessPath, web.origin, process.execPath, resolve("scripts/mcp-stdio.mjs")).codex;
  await writeFile(join(home, "config.toml"), `model_provider = "openai"\napproval_policy = "never"\nsandbox_mode = "read-only"\n${snippet}`);
  const env = Object.fromEntries(["PATH", "Path", "SystemRoot", "WINDIR", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "TEMP", "TMP"].filter(key => process.env[key]).map(key => [key, process.env[key]]));
  env.CODEX_HOME = home;
  child = spawn(executable, ["app-server", "--stdio"], { cwd: web.workspace, env, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
  let buffer = "", sequence = 1;
  child.stderr.resume();
  child.stdout.on("data", bytes => {
    buffer += bytes;
    if (buffer.length > 1024 * 1024) { child.kill(); return; }
    while (buffer.includes("\n")) {
      const end = buffer.indexOf("\n"), line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
      let message; try { message = JSON.parse(line); } catch { continue; }
      const callback = pending.get(message.id);
      if (callback) { pending.delete(message.id); clearTimeout(callback.timer); if (message.error) callback.reject(Error(`Codex RPC rejected: ${message.error.code}`)); else callback.resolve(message.result); }
    }
  });
  const rpc = (method, params) => new Promise((resolveResult, reject) => {
    const id = sequence++, timer = setTimeout(() => { pending.delete(id); reject(Error(`Codex RPC timed out: ${method}`)); }, 30000);
    pending.set(id, { resolve: resolveResult, reject, timer });
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  });
  await rpc("initialize", { clientInfo: { name: "launchlane_mcp_probe", version: "1" }, capabilities: { experimentalApi: true } });
  child.stdin.write(`${JSON.stringify({ method: "initialized" })}\n`);
  const thread = await rpc("thread/start", { cwd: web.workspace, ephemeral: true, approvalPolicy: "never", sandbox: "read-only" });
  const threadId = thread.thread.id;
  const status = await rpc("mcpServerStatus/list", { threadId, serverName: "launchlane", detail: "toolsAndAuthOnly" });
  const host = status.data.find(item => item.name === "launchlane"); assert.ok(host);
  assert.ok(host.tools.launchlane_context);
  const call = tool => rpc("mcpServer/tool/call", { threadId, server: "launchlane", tool, arguments: {} });
  const context = await call("launchlane_context"); assert.equal(context.isError ?? false, false); assert.equal(JSON.parse(context.content[0].text).data.project, null);
  const denied = await call("launchlane_publish"); assert.equal(denied.isError, true); assert.equal(JSON.parse(denied.content[0].text).error.code, "TOOL_DENIED");
  const replay = await call("launchlane_mission"); assert.equal(JSON.parse(replay.content[0].text).data.run, null);
  report = { version, discoveredTools: Object.keys(host.tools), actualCalls: 3, scopeDenied: true, sharedApplication: true, modelRequests: 0, cloudWrites: 0, executableRepairTested: false };
} finally {
  for (const entry of pending.values()) clearTimeout(entry.timer);
  if (child && child.exitCode === null && child.signalCode === null) {
    child.stdin.end();
    await Promise.race([new Promise(done => child.once("exit", done)), new Promise(done => setTimeout(done, 3000))]);
    if (child.exitCode === null && child.signalCode === null) { const ended = new Promise(done => child.once("exit", done)); child.kill(); await ended; }
  }
  await closeWebFixture();
}
console.info(JSON.stringify({ ...report, cleanup: "verified" }, null, 2));
