import { integer } from "../../contracts/validation.ts";
import { ensure } from "../errors.ts";
import { redact } from "../policy/redaction.ts";

const maxContentBytes = 20 * 1024;
export function projectFileReadRange(args: Record<string, unknown>) {
  if (args.startLine === undefined && args.lineCount === undefined) return null;
  return { startLine: args.startLine === undefined ? 1 : integer(args.startLine, 1, 1_000_000),
    lineCount: args.lineCount === undefined ? 80 : integer(args.lineCount, 1, 200) };
}

export function projectFileText(bytes: Buffer, range: ReturnType<typeof projectFileReadRange>, secrets: readonly string[]) {
  const decoded = bytes.toString("utf8");
  ensure(Buffer.from(decoded).equals(bytes) && !bytes.includes(0), "SOURCE_FILE_LIMIT", "این فایل متن UTF-8 معتبر نیست.", 413);
  if (!range) {
    ensure(bytes.length <= maxContentBytes, "SOURCE_FILE_LIMIT", "فایل بزرگ است؛ بخش مشخصی را با startLine و lineCount بخوانید.", 413);
    return { content: redact(decoded, secrets) };
  }
  // Redact before slicing: a secret spanning a range boundary must never leak in pieces.
  const lines = redact(decoded, secrets).split("\n");
  ensure(range.startLine <= lines.length, "SOURCE_LINE_RANGE", "خط آغاز بیرون از متن پاک‌سازی‌شدهٔ فایل است.");
  const selected: string[] = [];
  let size = 0;
  for (let index = range.startLine - 1; index < Math.min(lines.length, range.startLine - 1 + range.lineCount); index++) {
    const line = lines[index] + (index < lines.length - 1 ? "\n" : "");
    const length = Buffer.byteLength(line);
    if (size + length > maxContentBytes) break;
    selected.push(line); size += length;
  }
  ensure(selected.length > 0, "SOURCE_FILE_LIMIT", "یک خط به‌تنهایی از سقف خواندن بزرگ‌تر است؛ متن این خط کوتاه یا بریده نمی‌شود.", 413);
  const endLine = range.startLine + selected.length - 1, hasMore = endLine < lines.length;
  return { content: selected.join(""), range: { startLine: range.startLine, endLine, totalLines: lines.length,
    lineNumbers: "redacted_text" as const, contentBytes: size, hasMore, nextStartLine: hasMore ? endLine + 1 : null } };
}
