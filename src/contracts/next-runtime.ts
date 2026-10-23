import { ensure } from "../server/errors.ts";
import { exactKeys, object } from "./validation.ts";
import { parseNodeVersion, type NodeVersion } from "./node-runtime.ts";
export type NextRuntime = Readonly<{ kind: "next"; version: NodeVersion; mirror: boolean }>;
export function parseNextRuntime(value: unknown): NextRuntime {
  const row = object(value); exactKeys(row, ["kind", "version", "mirror"]);
  const version = parseNodeVersion(row.version);
  ensure(row.kind === "next" && ["20", "22", "24"].includes(version) && typeof row.mirror === "boolean", "NEXT_RUNTIME_UNSUPPORTED", "نسخه یا تنظیم دریافت وابستگی Next با قرارداد این مسیر سازگار نیست.", 409);
  return { kind: "next", version, mirror: row.mirror };
}
