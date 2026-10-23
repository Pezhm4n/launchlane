import { ensure } from "../server/errors.ts";
import { excludedPath, sourceFileAllowed } from "./source-paths.ts";
import { SOURCE_MAX_BYTES, SOURCE_MAX_FILES, sourceFileByteLimit, sourceFileLimitMessage } from "./source-limits.ts";

export type FolderFile = { path: string; size: number };
export function planFolderUpload(entries: readonly FolderFile[]) {
  ensure(entries.length > 0 && entries.length <= 100_000, "SOURCE_LIMIT", "پوشه خالی یا بسیار بزرگ است؛ پوشهٔ یک برنامه را انتخاب کنید.");
  const name = entries[0]?.path.split("/")[0] || "";
  ensure(/^[\p{L}\p{N}._ @()+[\]-]{1,160}$/u.test(name) && name !== "." && name !== "..", "INVALID_FOLDER", "نام پوشهٔ پروژه پشتیبانی نمی‌شود.");
  const files: { index: number; path: string }[] = [], seen = new Set<string>();
  let bytes = 0, excluded = 0;
  for (const [index, entry] of entries.entries()) {
    const parts = entry.path.split("/");
    ensure(parts.shift() === name && parts.length > 0 && parts.every(part => part && part !== "." && part !== ".." && !/[\\:]/.test(part)), "UNSAFE_PATH", "مسیر یکی از فایل‌ها معتبر نیست؛ پوشهٔ خود برنامه را انتخاب کنید.");
    if (parts.some(excludedPath) || !sourceFileAllowed(parts.at(-1) || "")) { excluded++; continue; }
    ensure(parts.length <= 16 && parts.every(part => /^[\p{L}\p{N}._ @()+[\]-]{1,160}$/u.test(part)), "UNSAFE_PATH", "مسیر یکی از فایل‌ها معتبر نیست؛ پوشهٔ خود برنامه را انتخاب کنید.");
    const path = parts.join("/");
    ensure(path.length <= 240 && !seen.has(path.toLocaleLowerCase("en-US")), "INVALID_FOLDER", "نام تکراری یا مسیر بسیار طولانی در پوشه وجود دارد.");
    ensure(entry.size <= sourceFileByteLimit(path), "SOURCE_LIMIT", sourceFileLimitMessage(path));
    seen.add(path.toLocaleLowerCase("en-US")); bytes += entry.size; files.push({ index, path });
    ensure(files.length <= SOURCE_MAX_FILES && bytes <= SOURCE_MAX_BYTES, "SOURCE_LIMIT", "برای بررسی، حداکثر هزار فایل با مجموع حجم ۲۰ مگابایت انتخاب کنید؛ پوشهٔ یک برنامه را انتخاب کنید.");
  }
  ensure(files.length, "EMPTY_FOLDER", "فایل قابل بررسی در این پوشه پیدا نشد. پوشهٔ برنامه را انتخاب کنید.");
  return { name, files, bytes, excluded };
}
