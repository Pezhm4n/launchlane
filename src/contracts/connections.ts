import { ensure } from "../server/errors.ts";
import { integer, object, string } from "./validation.ts";
export type ConnectionProvider = "github" | "liara";
export type ConnectedApp = { id: string; name: string; platform: string };
export type ConnectionView = {
  provider: ConnectionProvider;
  status: "connected" | "reauth_required";
  identityId: string;
  displayName: string;
  login: string;
  checkedAt: number;
  teamId: string | null;
  teamName: string | null;
  apps: ConnectedApp[];
  selectedApp: string | null;
};
export function parseConnection(value: unknown): ConnectionView {
  const raw = object(value);
  ensure(
    (raw.provider === "github" || raw.provider === "liara") &&
      (raw.status === "connected" || raw.status === "reauth_required") &&
      Array.isArray(raw.apps) &&
      raw.apps.length <= 100,
    "CONNECTION_INVALID",
    "اطلاعات اتصال معتبر نیست.",
  );
  return {
    provider: raw.provider,
    status: raw.status,
    identityId: string(raw.identityId, 128),
    displayName: string(raw.displayName, 160),
    login: string(raw.login, 320),
    checkedAt: integer(raw.checkedAt, 0, Number.MAX_SAFE_INTEGER),
    teamId: raw.teamId === null ? null : string(raw.teamId, 24),
    teamName: raw.teamName === null ? null : string(raw.teamName, 160),
    selectedApp: raw.selectedApp === null ? null : string(raw.selectedApp, 63),
    apps: raw.apps.map((value: unknown) => {
      const row = object(value);
      return {
        id: string(row.id, 128),
        name: string(row.name, 63),
        platform: string(row.platform, 64),
      };
    }),
  };
}
