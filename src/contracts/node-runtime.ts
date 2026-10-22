import { ensure } from "../server/errors.ts";
import { exactKeys, object, string } from "./validation.ts";

// Documentary catalog, not a live availability check. Keep unknown provider versions closed.
export const NODE_VERSIONS = ["8", "10", "12", "14", "16", "18", "20", "22", "24"] as const;
export type NodeVersion = (typeof NODE_VERSIONS)[number];
export type NodeRuntime = Readonly<{
  version: NodeVersion | null;
  source: "package.json" | "liara.json" | "liara-default";
  requirement: string | null;
  detail: string;
}>;

export function parseNodeVersion(value: unknown): NodeVersion {
  const version = NODE_VERSIONS.find((version) => version === value);
  ensure(
    version,
    "NODE_VERSION_UNSUPPORTED",
    "نسخه Node در فهرست مستند این نصب نیست. تنظیمات نسخه را اصلاح و پروژه را دوباره بررسی کنید.",
    409,
  );
  return version;
}

export function parseNodeRuntime(value: unknown): NodeRuntime {
  const row = object(value);
  exactKeys(row, ["version", "source", "requirement", "detail"]);
  ensure(
    row.source === "package.json" || row.source === "liara.json" || row.source === "liara-default",
    "INVALID_RESPONSE",
    "منبع نسخه Node معتبر نیست.",
  );
  return {
    version: row.version === null ? null : parseNodeVersion(row.version),
    source: row.source,
    requirement: row.requirement === null ? null : string(row.requirement, 128),
    detail: string(row.detail, 700),
  };
}
