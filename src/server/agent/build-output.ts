import { createHash } from "node:crypto";
import { exactKeys, hash, integer, object, string } from "../../contracts/validation.ts";
import { excludedPath } from "../../contracts/source-paths.ts";
import { AppError, ensure } from "../errors.ts";
import { checkName } from "../workspace/paths.ts";
import type { SourceFile } from "../workspace/inspect.ts";

export const BUILD_OUTPUT_MAX_FILES = 512;
export const BUILD_OUTPUT_MAX_BYTES = 32 * 1024 * 1024;
export const BUILD_OUTPUT_MAX_FILE_BYTES = 8 * 1024 * 1024;

export type BuildOutputEntry = Readonly<{ path: string; type: "file"; bytes: number; sha256: string }>;
export type ValidatedBuildOutput = Readonly<{
  version: 1;
  manifest: readonly BuildOutputEntry[];
  files: readonly SourceFile[];
  totalBytes: number;
}>;

function outputPath(value: unknown): string {
  const path = string(value, 512), parts = path.split("/");
  ensure(!path.startsWith("/") && !/[\\:]/.test(path) && path === path.normalize("NFC"),
    "BUILD_OUTPUT_PATH_DENIED", "مسیر خروجی ساخت باید نسبی و بدون نام جایگزین باشد.", 409);
  for (const part of parts) {
    checkName(part);
    const compatible = part.normalize("NFKC");
    ensure(part !== "." && part !== ".." && part === part.trim() && !part.endsWith(".") &&
      !/^(?:CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])(?:\.|$)/i.test(compatible),
      "BUILD_OUTPUT_PATH_DENIED", "یکی از نام‌های خروجی ساخت در محیط مقصد امن یا یکتا نیست.", 409);
    ensure(!excludedPath(part) && !/^(?:private|__private__|\.private|\.config)$/i.test(part) &&
      !/^(?:package(?:-lock)?\.json|requirements(?:\.lock)?\.txt|pyproject\.toml|Dockerfile|\.gitignore)$/i.test(part),
      "BUILD_OUTPUT_PRIVATE_FILE", "فایل تنظیمات خصوصی یا دادهٔ برنامه نباید در خروجی عمومی ساخت قرار بگیرد.", 409);
  }
  return path;
}

function pathKey(path: string): string {
  return path.normalize("NFKC").toLowerCase().normalize("NFC");
}

function manifestEntries(value: unknown): { manifest: BuildOutputEntry[]; totalBytes: number } {
  const row = object(value); exactKeys(row, ["version", "files"]);
  ensure(row.version === 1 && Array.isArray(row.files), "BUILD_OUTPUT_INVALID", "قرارداد خروجی ساخت معتبر نیست.", 409);
  ensure(row.files.length > 0 && row.files.length <= BUILD_OUTPUT_MAX_FILES,
    "BUILD_OUTPUT_LIMIT", "تعداد فایل‌های خروجی ساخت از محدودهٔ مجاز بیشتر است.", 413);
  const manifest: BuildOutputEntry[] = [], names = new Set<string>(); let totalBytes = 0;
  for (const entry of row.files) {
    const file = object(entry); exactKeys(file, ["path", "type", "bytes", "sha256"]);
    ensure(file.type === "file", "BUILD_OUTPUT_TYPE_DENIED", "خروجی ساخت فقط می‌تواند فایل عادی داشته باشد؛ پیوند و فایل ویژه پذیرفته نیست.", 409);
    const path = outputPath(file.path), key = pathKey(path), bytes = integer(file.bytes, 0, Number.MAX_SAFE_INTEGER);
    ensure(bytes <= BUILD_OUTPUT_MAX_FILE_BYTES && totalBytes + bytes <= BUILD_OUTPUT_MAX_BYTES,
      "BUILD_OUTPUT_LIMIT", "حجم یک فایل یا مجموع خروجی ساخت از سقف مجاز بیشتر است.", 413);
    ensure(!names.has(key), "BUILD_OUTPUT_PATH_DENIED", "فهرست خروجی ساخت نام تکراری یا نام جایگزین دارد.", 409);
    names.add(key); totalBytes += bytes;
    manifest.push({ path, type: "file", bytes, sha256: hash(file.sha256) });
  }
  for (const file of manifest) {
    const parts = pathKey(file.path).split("/"); parts.pop();
    while (parts.length) {
      ensure(!names.has(parts.join("/")), "BUILD_OUTPUT_PATH_DENIED", "یک مسیر خروجی هم‌زمان فایل و پوشه معرفی شده است.", 409);
      parts.pop();
    }
  }
  ensure(manifest.some(file => file.path === "index.html" && file.bytes > 0),
    "BUILD_OUTPUT_INDEX_REQUIRED", "صفحهٔ اصلی index.html در خروجی ساخت موجود یا قابل‌استفاده نیست.", 409);
  manifest.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  return { manifest, totalBytes };
}

// The caller supplies export metadata and bytes; this boundary never resolves or writes host paths.
export function validateBuildOutput(value: unknown, contents: ReadonlyMap<string, Uint8Array>): ValidatedBuildOutput {
  try {
    const { manifest, totalBytes } = manifestEntries(value);
    ensure(contents.size === manifest.length, "BUILD_OUTPUT_MISMATCH", "فهرست فایل‌ها با بایت‌های خروجی ساخت برابر نیست.", 409);
    const files: SourceFile[] = [];
    for (const file of manifest) {
      const content = contents.get(file.path);
      ensure(content instanceof Uint8Array && content.byteLength === file.bytes,
        "BUILD_OUTPUT_MISMATCH", "بایت یا اندازهٔ یکی از فایل‌های خروجی ساخت تغییر کرده است.", 409);
      const snapshot = Buffer.from(content);
      ensure(createHash("sha256").update(snapshot).digest("hex") === file.sha256,
        "BUILD_OUTPUT_MISMATCH", "هش واقعی یکی از فایل‌های خروجی ساخت با رسید برابر نیست.", 409);
      files.push({ path: file.path, content: snapshot });
    }
    return { version: 1, manifest, files, totalBytes };
  } catch (error) {
    if (error instanceof AppError && error.code === "INVALID_INPUT")
      throw new AppError("BUILD_OUTPUT_INVALID", "ساختار فهرست خروجی ساخت معتبر نیست.", 409);
    throw error;
  }
}
