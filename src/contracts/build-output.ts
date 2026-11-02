import { ensure } from "../server/errors.ts";
import { exactKeys, hash, integer, object } from "./validation.ts";

export type BuildOutputReceipt = Readonly<{
  version: 1 | 2; sourceHash: string; planHash: string; artifactHash: string;
  bytes: number; fileCount: number; totalBytes: number;
}>;
export function parseBuildOutputReceipt(value: unknown): BuildOutputReceipt {
  const row = object(value);
  exactKeys(row, ["version", "sourceHash", "planHash", "artifactHash", "bytes", "fileCount", "totalBytes"]);
  ensure(row.version === 1 || row.version === 2, "BUILD_OUTPUT_INVALID", "نسخهٔ رسید خروجی ساخت معتبر نیست.", 409);
  return { version: row.version, sourceHash: hash(row.sourceHash), planHash: hash(row.planHash), artifactHash: hash(row.artifactHash),
    bytes: integer(row.bytes, 1, row.version === 2 ? 16 * 1024 * 1024 : 48 * 1024 * 1024), fileCount: integer(row.fileCount, 1, row.version === 2 ? 8192 : 512), totalBytes: integer(row.totalBytes, 1, row.version === 2 ? 96 * 1024 * 1024 : 32 * 1024 * 1024) };
}
