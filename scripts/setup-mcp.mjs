import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { parseMcpAccessFile } from "../src/contracts/mcp-access-file.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
let missions = false, output = ".local/mcp-access.json", fromFile = "";
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--missions" && !missions) missions = true;
  else if (args[i] === "--output" && args[i + 1] && output === ".local/mcp-access.json") output = args[++i];
  else if (args[i] === "--from-file" && args[i + 1] && !fromFile) fromFile = args[++i];
  else throw Error("Usage: node scripts/setup-mcp.mjs [--missions] [--from-file <browser download>] [--output <new file under .local>]");
}
const path = resolve(root, output), within = relative(resolve(root, ".local"), path);
if (!within || within.startsWith("..") || isAbsolute(within)) throw Error("MCP credentials must stay under this checkout's ignored .local directory.");
if (existsSync(path) && (!fromFile || resolve(fromFile) !== path)) throw Error("Access file already exists; choose a new --output path. No existing configuration was overwritten.");
for (let parent = dirname(path); ; parent = dirname(parent)) {
  if (existsSync(parent) && lstatSync(parent).isSymbolicLink()) throw Error("Linked access directories are not allowed.");
  if (parent === dirname(parent)) break;
}
const env = parseEnv(readFileSync(resolve(root, ".env.local"), "utf8"));
const origin = new URL(env.LAUNCHLANE_ORIGIN || "http://127.0.0.1:3000");
if (origin.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname) || origin.pathname !== "/" || origin.username || origin.password || origin.search || origin.hash) throw Error("Launchlane requires its configured loopback origin.");
if (fromFile) {
  const input = resolve(fromFile), stat = lstatSync(input);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 8192) throw Error("Use the small access file downloaded from Launchlane; linked files are not allowed.");
  let imported;
  try { imported = parseMcpAccessFile(JSON.parse(readFileSync(input, "utf8").replace(/^\uFEFF/, "")), origin.origin); }
  catch { throw Error("The access file is invalid, expired or belongs to another installation. Download a new file from Accounts > MCP."); }
  if (missions && !imported.missions) throw Error("The downloaded access is read-only; this command cannot grant mission permission.");
  const client = new Client({ name: "launchlane-mcp-setup", version: "1" });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(imported.url), { requestInit: { headers: { authorization: `Bearer ${imported.accessToken}` } }, fetch: (request, init) => fetch(request, { ...init, redirect: "error" }) }));
    const result = await client.callTool({ name: "launchlane_context", arguments: {} });
    if (result.isError) throw Error("denied");
  } catch { throw Error("Launchlane did not verify this access. Keep the originating browser session signed in and download a fresh file if needed."); }
  finally { await client.close().catch(() => undefined); }
  if (input !== path) {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    writeFileSync(path, JSON.stringify(imported, null, 2), { flag: "wx", mode: 0o600 });
  }
  console.info(`Verified browser-session MCP access at ${path}. Expires ${new Date(imported.expiresAt).toISOString()}. Missions ${imported.missions ? "enabled" : "disabled"}. No model/provider was called.`);
  process.exit(0);
}
async function request(route, body, cookie = "", csrf = "") {
  return fetch(new URL(route, origin), { method: "POST", redirect: "error", signal: AbortSignal.timeout(15000), headers: { origin: origin.origin, "content-type": "application/json", cookie, "x-csrf-token": csrf }, body: JSON.stringify(body) });
}
const login = await request("/api/session", { token: env.LAUNCHLANE_OPERATOR_TOKEN });
if (login.status !== 200) throw Error("Local login failed. For Liara sign-in, download access from Accounts > MCP and use --from-file. No access file was written.");
const cookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";
const workspace = await fetch(new URL("/api/workspace", origin), { redirect: "error", signal: AbortSignal.timeout(15000), headers: { origin: origin.origin, cookie } });
if (!workspace.ok) throw Error("Local session could not be verified.");
const csrf = (await workspace.json()).session.csrfToken;
const response = await request("/api/mcp/access", { missions }, cookie, csrf);
if (response.status !== 201) throw Error("Scoped access could not be created. Existing files were preserved.");
const access = await response.json();
mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
try {
  writeFileSync(path, JSON.stringify({ url: new URL("/api/mcp", origin).href, ...access }, null, 2), { flag: "wx", mode: 0o600 });
} catch {
  await fetch(new URL("/api/mcp/access", origin), { method: "DELETE", redirect: "error", signal: AbortSignal.timeout(15000), headers: { origin: origin.origin, cookie, "content-type": "application/json", "x-csrf-token": csrf }, body: JSON.stringify({ id: access.id }) }).catch(() => undefined);
  throw Error("Access file could not be saved; revocation was attempted. No existing file was overwritten.");
}
console.info(`Scoped MCP access saved to ${path}. Expires ${new Date(access.expiresAt).toISOString()}. Missions ${missions ? "enabled" : "disabled"}. No host configuration was modified and no model/provider was called.`);
