import { createHmac, randomBytes } from "node:crypto";
import type { Session } from "../../contracts/domain.ts";
import { exactKeys, integer, object, string } from "../../contracts/validation.ts";
import type { Config } from "../config.ts";
import { ensure } from "../errors.ts";
import type { Store } from "../persistence/store.ts";
import { checkRequest, csrfFor, safeEqual } from "../policy/session.ts";

export type McpAccess = { session: Session; missions: boolean };
function signature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(`launchlane:mcp:v1:${payload}`).digest("base64url");
}

export function issueMcpAccess(config: Config, store: Store, parent: Session, missions: boolean, now = Date.now()) {
  ensure(parent.expiresAt > now && store.sessionExists(parent.id, parent.actorId, now), "AUTH_REQUIRED", "برای اتصال وارد شوید.", 401);
  const id = randomBytes(24).toString("base64url"), expiresAt = Math.min(parent.expiresAt, now + 60 * 60_000);
  const session: Session = { id, actorId: parent.actorId, expiresAt, csrfToken: csrfFor(id, config.sessionSecret) };
  const payload = Buffer.from(JSON.stringify({ audience: "launchlane-mcp-v1", id, parentId: parent.id, actorId: parent.actorId, expiresAt, missions })).toString("base64url");
  store.saveSession(session);
  return { accessToken: `${payload}.${signature(payload, config.sessionSecret)}`, id, expiresAt, missions };
}

export function requireMcpAccess(request: Request, config: Config, store: Store, now = Date.now()): McpAccess {
  // Native MCP clients omit Origin. A present Origin and every Host still use the web policy.
  checkRequest(request, config, false);
  ensure(config.authConfigured, "AUTH_UNCONFIGURED", "ابتدا ورود محلی را تنظیم کنید.", 503);
  const auth = request.headers.get("authorization") ?? "";
  ensure(auth.startsWith("Bearer ") && auth.length < 2048, "AUTH_REQUIRED", "اتصال Launchlane نیاز به دسترسی معتبر دارد.", 401);
  const [payload, signed, extra] = auth.slice(7).split(".");
  ensure(payload && signed && !extra && safeEqual(signed, signature(payload, config.sessionSecret)), "AUTH_REQUIRED", "دسترسی اتصال معتبر نیست؛ اتصال را دوباره آماده کنید.", 401);
  let value: unknown;
  try { value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); } catch { value = null; }
  const row = object(value);
  exactKeys(row, ["audience", "id", "parentId", "actorId", "expiresAt", "missions"]);
  const id = string(row.id, 64), actorId = string(row.actorId, 24), parentId = string(row.parentId, 64), expiresAt = integer(row.expiresAt, 1, Number.MAX_SAFE_INTEGER);
  ensure(row.audience === "launchlane-mcp-v1" && typeof row.missions === "boolean" && expiresAt > now && expiresAt <= now + 60 * 60_000 && store.sessionExists(id, actorId, now) && store.sessionExists(parentId, actorId, now), "AUTH_REQUIRED", "دسترسی اتصال منقضی یا لغو شده است؛ دوباره وارد شوید و اتصال را آماده کنید.", 401);
  return { session: { id, actorId, expiresAt, csrfToken: csrfFor(id, config.sessionSecret) }, missions: row.missions };
}
