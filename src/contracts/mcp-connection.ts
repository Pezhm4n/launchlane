import { ensure } from "../server/errors.ts";
import { integer, object, string, text } from "./validation.ts";

export const mcpHosts = ["codex", "claude", "opencode"] as const;
export type McpHost = typeof mcpHosts[number];
export type McpConnectionView = {
  id: string; host: McpHost; missions: boolean; expiresAt: number; createdAt: number;
  state: "prepared" | "initialized" | "connected" | "revoked" | "expired";
  protocolVersion: string | null; reportedClient: string | null;
  initializedAt: number | null; discoveredAt: number | null; lastToolAt: number | null;
  configuration: string; filename: string; executableReadiness: "not_verified";
};
export function parseMcpHost(value: unknown): McpHost {
  const host = mcpHosts.find(host => host === value);
  ensure(host, "INVALID_INPUT", "دستیار موردنظر معتبر نیست."); return host;
}
export function parseMcpConnection(value: unknown): McpConnectionView {
  const row = object(value), state = row.state;
  ensure(state === "prepared" || state === "initialized" || state === "connected" || state === "revoked" || state === "expired",
    "INVALID_RESPONSE", "وضعیت اتصال معتبر نیست.");
  ensure(typeof row.missions === "boolean" && row.executableReadiness === "not_verified", "INVALID_RESPONSE", "محدوده اتصال معتبر نیست.");
  const at = (value: unknown) => value === null ? null : integer(value, 0, Number.MAX_SAFE_INTEGER);
  return { id: string(row.id, 64), host: parseMcpHost(row.host), missions: row.missions, state,
    expiresAt: integer(row.expiresAt, 0, Number.MAX_SAFE_INTEGER), createdAt: integer(row.createdAt, 0, Number.MAX_SAFE_INTEGER),
    protocolVersion: row.protocolVersion === null ? null : string(row.protocolVersion, 64), reportedClient: row.reportedClient === null ? null : string(row.reportedClient, 160),
    initializedAt: at(row.initializedAt), discoveredAt: at(row.discoveredAt), lastToolAt: at(row.lastToolAt),
    configuration: text(row.configuration, 16000), filename: string(row.filename, 80), executableReadiness: "not_verified" };
}
