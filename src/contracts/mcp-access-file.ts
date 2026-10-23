import { ensure } from "../server/errors.ts";
import { exactKeys, integer, object, string } from "./validation.ts";

export type McpAccessFile = Readonly<{
  url: string;
  accessToken: string;
  id: string;
  expiresAt: number;
  missions: boolean;
}>;

// This validates the transport file, not the signature. The application verifies the grant.
export function parseMcpAccessFile(value: unknown, expectedOrigin: string, now = Date.now()): McpAccessFile {
  const row = object(value);
  exactKeys(row, ["url", "accessToken", "id", "expiresAt", "missions"]);
  let url: URL;
  try { url = new URL(string(row.url, 300)); }
  catch { throw new Error("نشانی فایل دسترسی معتبر نیست."); }
  ensure(url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) &&
    url.origin === expectedOrigin && url.pathname === "/api/mcp" && !url.username && !url.password && !url.search && !url.hash,
    "MCP_ACCESS_INVALID", "این فایل باید متعلق به همین نصب محلی Launchlane باشد.");
  const accessToken = string(row.accessToken, 2048), id = string(row.id, 64);
  ensure(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(accessToken) && /^[A-Za-z0-9_-]{16,64}$/.test(id),
    "MCP_ACCESS_INVALID", "ساختار دسترسی معتبر نیست.");
  const expiresAt = integer(row.expiresAt, now + 1, now + 60 * 60_000);
  ensure(typeof row.missions === "boolean", "MCP_ACCESS_INVALID", "محدودهٔ دسترسی مشخص نیست.");
  return { url: url.href, accessToken, id, expiresAt, missions: row.missions };
}
