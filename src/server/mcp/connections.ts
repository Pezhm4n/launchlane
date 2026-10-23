import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, realpathSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { Session } from "../../contracts/domain.ts";
import { parseMcpHost, type McpConnectionView } from "../../contracts/mcp-connection.ts";
import { integer, object, string } from "../../contracts/validation.ts";
import type { Config } from "../config.ts";
import { ensure } from "../errors.ts";
import type { Store } from "../persistence/store.ts";
import { issueMcpAccess } from "./access.ts";

function ownRow(store: Store, actor: string, id: string) {
  const row = store.db.prepare("SELECT * FROM mcp_connections WHERE actor_id=? AND id=?").get(actor, id);
  ensure(row, "MCP_CONNECTION_NOT_FOUND", "این اتصال پیدا نشد.", 404); return row;
}
function accessPath(config: Config, id: string): string {
  ensure(/^[A-Za-z0-9_-]{32}$/.test(id), "STORAGE_INVALID", "شناسه اتصال معتبر نیست.", 503);
  return join(config.stateDir, "mcp-access", `${id}.json`);
}
function configuration(host: McpConnectionView["host"], id: string, path: string) {
  const command = process.execPath, bridge = realpathSync(resolve("scripts/mcp-stdio.mjs")), name = `launchlane_${id.slice(0, 8)}`,
    env = { LAUNCHLANE_MCP_ACCESS_FILE: path };
  if (host === "codex") return { filename: "config.toml", text: `[mcp_servers.${name}]\ncommand = ${JSON.stringify(command)}\nargs = [${JSON.stringify(bridge)}]\n\n[mcp_servers.${name}.env]\nLAUNCHLANE_MCP_ACCESS_FILE = ${JSON.stringify(path)}\n` };
  return { filename: host === "claude" ? ".mcp.json" : "opencode.json", text: JSON.stringify(host === "claude"
    ? { mcpServers: { [name]: { type: "stdio", command, args: [bridge], env } } }
    : { mcp: { [name]: { type: "local", command: [command, bridge], environment: env, enabled: true } } }, null, 2) };
}
function view(config: Config, store: Store, value: unknown, now = Date.now()): McpConnectionView {
  const row = object(value), id = string(row.id, 64), actor = string(row.actor_id, 24), host = parseMcpHost(row.host),
    at = (value: unknown) => value === null ? null : integer(value, 0, Number.MAX_SAFE_INTEGER),
    initializedAt = at(row.initialized_at), discoveredAt = at(row.discovered_at), expiresAt = integer(row.expires_at, 1, Number.MAX_SAFE_INTEGER),
    active = store.sessionExists(id, actor, now) && store.sessionExists(string(row.parent_session_id, 64), actor, now),
    configSnippet = configuration(host, id, accessPath(config, id));
  ensure(string(row.access_path, 4096) === accessPath(config, id), "STORAGE_INVALID", "مرجع امن اتصال معتبر نیست.", 503);
  return { id, host, missions: integer(row.missions, 0, 1) === 1, expiresAt, createdAt: integer(row.created_at, 1, Number.MAX_SAFE_INTEGER),
    state: row.revoked_at !== null ? "revoked" : !active || expiresAt <= now ? "expired" : initializedAt && discoveredAt && discoveredAt >= initializedAt ? "connected" : initializedAt ? "initialized" : "prepared",
    initializedAt, discoveredAt, lastToolAt: at(row.last_tool_at), protocolVersion: row.protocol_version === null ? null : string(row.protocol_version, 64),
    reportedClient: row.reported_client === null ? null : string(row.reported_client, 160), configuration: configSnippet.text, filename: configSnippet.filename, executableReadiness: "not_verified" };
}
export function listMcpConnections(config: Config, store: Store, session: Session): McpConnectionView[] {
  ensure(store.sessionExists(session.id, session.actorId, Date.now()), "AUTH_REQUIRED", "دوباره وارد شوید.", 401);
  return store.db.prepare("SELECT * FROM mcp_connections WHERE actor_id=? ORDER BY created_at DESC,id DESC LIMIT 30").all(session.actorId)
    .map(row => view(config, store, row));
}
export function prepareMcpConnection(config: Config, store: Store, session: Session, key: string, hostValue: unknown, missions: boolean) {
  ensure(store.sessionExists(session.id, session.actorId, Date.now()), "AUTH_REQUIRED", "دوباره وارد شوید.", 401);
  const host = parseMcpHost(hostValue), origin = new URL(config.origin);
  ensure(origin.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname), "MCP_LOCAL_SETUP_ONLY", "این روش اتصال برای نصب و دستیار روی همین دستگاه است.", 409);
  ensure(/^[a-f0-9-]{36}$/.test(key) && typeof missions === "boolean", "INVALID_INPUT", "درخواست اتصال معتبر نیست.");
  const previous = store.db.prepare("SELECT * FROM mcp_connections WHERE actor_id=? AND request_key=?").get(session.actorId, key);
  if (previous) {
    ensure(previous.host === host && previous.missions === (missions ? 1 : 0), "IDEMPOTENCY_CONFLICT", "شناسه درخواست برای تنظیمات دیگری ثبت شده است.", 409);
    return view(config, store, previous);
  }
  ensure(store.sessionExists(session.id, session.actorId, Date.now()), "AUTH_REQUIRED", "دوباره وارد شوید.", 401);
  const directory = join(config.stateDir, "mcp-access");
  for (let parent = directory; ; parent = dirname(parent)) {
    ensure(!existsSync(parent) || !lstatSync(parent).isSymbolicLink(), "MCP_PRIVATE_PATH", "پوشه امن اتصال نباید پیوند باشد.", 409);
    if (parent === dirname(parent)) break;
  }
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  let file: string | null = null, fileCreated = false;
  store.db.exec("BEGIN IMMEDIATE");
  try {
    const access = issueMcpAccess(config, store, session, missions); file = accessPath(config, access.id);
    // Small synchronous writes keep credential issuance and its ownership row in one SQLite transition.
    const descriptor = openSync(file, "wx", 0o600); fileCreated = true;
    try { writeFileSync(descriptor, JSON.stringify({ url: new URL("/api/mcp", origin).href, ...access })); fsyncSync(descriptor); }
    finally { closeSync(descriptor); }
    store.db.prepare("INSERT INTO mcp_connections(id,actor_id,request_key,host,missions,parent_session_id,expires_at,created_at,access_path) VALUES(?,?,?,?,?,?,?,?,?)")
      .run(access.id, session.actorId, key, host, missions ? 1 : 0, session.id, access.expiresAt, Date.now(), file);
    const result = view(config, store, ownRow(store, session.actorId, access.id)); store.db.exec("COMMIT"); return result;
  } catch (error) {
    store.db.exec("ROLLBACK"); if (fileCreated && file && existsSync(file)) unlinkSync(file); throw error;
  }
}
export function revokeMcpConnection(config: Config, store: Store, session: Session, id: string) {
  ensure(store.sessionExists(session.id, session.actorId, Date.now()), "AUTH_REQUIRED", "دوباره وارد شوید.", 401);
  const row = ownRow(store, session.actorId, id), path = accessPath(config, id);
  ensure(row.access_path === path, "STORAGE_INVALID", "مرجع امن اتصال معتبر نیست.", 503);
  store.db.exec("BEGIN IMMEDIATE");
  try { store.revokeSession(id); store.db.prepare("UPDATE mcp_connections SET revoked_at=COALESCE(revoked_at,?) WHERE actor_id=? AND id=?").run(Date.now(), session.actorId, id); store.db.exec("COMMIT"); }
  catch (error) { store.db.exec("ROLLBACK"); throw error; }
  // Revocation is already durable if deleting the expired capability file fails.
  let fileRemoved = false; try { if (existsSync(path)) unlinkSync(path); fileRemoved = true; } catch { /* Auth is revoked; report remaining local cleanup. */ }
  return { connection: view(config, store, ownRow(store, session.actorId, id)), fileRemoved };
}
