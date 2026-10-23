import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
let missions = false, output = ".local/mcp-access.json";
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--missions" && !missions) missions = true;
  else if (args[i] === "--output" && args[i + 1] && output === ".local/mcp-access.json") output = args[++i];
  else throw Error("Usage: node scripts/setup-mcp.mjs [--missions] [--output <new file under .local>]");
}
const path = resolve(root, output), within = relative(resolve(root, ".local"), path);
if (!within || within.startsWith("..") || isAbsolute(within)) throw Error("MCP credentials must stay under this checkout's ignored .local directory.");
if (existsSync(path)) throw Error("Access file already exists; choose a new --output path. No existing configuration was overwritten.");
for (let parent = dirname(path); ; parent = dirname(parent)) {
  if (existsSync(parent) && lstatSync(parent).isSymbolicLink()) throw Error("Linked access directories are not allowed.");
  if (parent === dirname(parent)) break;
}
const env = parseEnv(readFileSync(resolve(root, ".env.local"), "utf8"));
const origin = new URL(env.LAUNCHLANE_ORIGIN || "http://127.0.0.1:3000");
if (origin.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname) || origin.pathname !== "/" || origin.username || origin.password || origin.search || origin.hash) throw Error("Launchlane requires its configured loopback origin.");
async function request(route, body, cookie = "", csrf = "") {
  return fetch(new URL(route, origin), { method: "POST", redirect: "error", signal: AbortSignal.timeout(15000), headers: { origin: origin.origin, "content-type": "application/json", cookie, "x-csrf-token": csrf }, body: JSON.stringify(body) });
}
const login = await request("/api/session", { token: env.LAUNCHLANE_OPERATOR_TOKEN });
if (login.status !== 200) throw Error("Local login failed. Check setup and the running web server; no access file was written.");
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
