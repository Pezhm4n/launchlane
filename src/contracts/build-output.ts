import { ensure } from "../server/errors.ts";
import { exactKeys, hash, integer, object } from "./validation.ts";

export type BuildOutputReceipt = Readonly<{
  version: 1; sourceHash: string; planHash: string; artifactHash: string;
  bytes: number; fileCount: number; totalBytes: number;
}>;
export function parseBuildOutputReceipt(value: unknown): BuildOutputReceipt {
  const row = object(value);
  exactKeys(row, ["version", "sourceHash", "planHash", "artifactHash", "bytes", "fileCount", "totalBytes"]);
  ensure(row.version === 1, "BUILD_OUTPUT_INVALID", "نسخهٔ رسید خروجی ساخت معتبر نیست.", 409);
  return { version: 1, sourceHash: hash(row.sourceHash), planHash: hash(row.planHash), artifactHash: hash(row.artifactHash),
    bytes: integer(row.bytes, 1, 48 * 1024 * 1024), fileCount: integer(row.fileCount, 1, 512), totalBytes: integer(row.totalBytes, 1, 32 * 1024 * 1024) };
}
