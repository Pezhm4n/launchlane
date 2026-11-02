import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { exactKeys, hash, integer, object, string } from "../../contracts/validation.ts";
import { ensure, AppError } from "../errors.ts";

export type ExecutableOutput = Readonly<{ version: 1; sourceHash: string; planHash: string; bytes: number; sha256: string; base64: string }>;
export const executableByteLimit = 8 * 1024 * 1024;
export function parseExecutableOutput(value: unknown, secrets: readonly string[] = []): ExecutableOutput {
  const row = object(value); exactKeys(row, ["version", "sourceHash", "planHash", "bytes", "sha256", "base64"]);
  const bytes = integer(row.bytes, 64, executableByteLimit), sha256 = hash(row.sha256), base64 = string(row.base64, Math.ceil(executableByteLimit / 3) * 4 + 4), buffer = Buffer.from(base64, "base64");
  ensure(row.version === 1 && buffer.length === bytes && buffer.toString("base64") === base64 && createHash("sha256").update(buffer).digest("hex") === sha256 &&
    buffer.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])) && buffer[4] === 2 && buffer[5] === 1 && buffer.readUInt16LE(18) === 62,
    "EXECUTABLE_OUTPUT_INVALID", "بایت‌های باینری Linux/amd64 با گواه ساخت برابر نیستند.", 409);
  ensure(!secrets.filter(Boolean).some(secret => buffer.includes(Buffer.from(secret))), "BUILD_OUTPUT_SENSITIVE", "خروجی compiled شامل مقدار خصوصی همین مأموریت است؛ انتشار متوقف شد.", 409);
  return { version: 1, sourceHash: hash(row.sourceHash), planHash: hash(row.planHash), bytes, sha256, base64 };
}
export function encodeExecutableOutput(value: ExecutableOutput): Buffer { return gzipSync(Buffer.from(JSON.stringify(parseExecutableOutput(value))), { level: 6 }); }
export function decodeExecutableOutput(bytes: Buffer, secrets: readonly string[] = []): ExecutableOutput {
  ensure(bytes.length > 0 && bytes.length <= 12 * 1024 * 1024, "EXECUTABLE_OUTPUT_INVALID", "حجم بستهٔ compiled معتبر نیست.", 409);
  try { return parseExecutableOutput(JSON.parse(gunzipSync(bytes, { maxOutputLength: 12 * 1024 * 1024 }).toString("utf8")), secrets); }
  catch (error) { if (error instanceof AppError) throw error; throw new AppError("EXECUTABLE_OUTPUT_INVALID", "بستهٔ باینری compiled قابل بررسی نیست.", 409); }
}
