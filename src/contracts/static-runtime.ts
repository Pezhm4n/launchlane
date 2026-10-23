import { ensure } from "../server/errors.ts";
import { exactKeys, object } from "./validation.ts";
export type StaticRuntime = Readonly<{ kind: "static"; documentRoot: "."; entry: "index.html"; port: 80 }>;
export const staticRuntime: StaticRuntime = { kind: "static", documentRoot: ".", entry: "index.html", port: 80 };
export function parseStaticRuntime(value: unknown): StaticRuntime {
  const row = object(value); exactKeys(row, ["kind", "documentRoot", "entry", "port"]);
  ensure(row.kind === "static" && row.documentRoot === "." && row.entry === "index.html" && row.port === 80,
    "STATIC_RUNTIME_INVALID", "تنظیمات انتشار سایت ایستا با فایل‌های بررسی‌شده تطبیق ندارد.");
  return { ...staticRuntime };
}
