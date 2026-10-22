import { lstat, mkdir, readdir, realpath, rm, writeFile } from "node:fs/promises";
import type { Stats } from "node:fs";
import { dirname, join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { extract } from "tar-stream";
import { string } from "../../contracts/validation.ts";
import { AppError, ensure } from "../errors.ts";
import { checkName, excludedPath, sourceFileAllowed, under } from "../workspace/paths.ts";
import type { SourceFile } from "../workspace/inspect.ts";
import { SOURCE_MAX_BYTES, SOURCE_MAX_FILES, SOURCE_MAX_ENTRIES, sourceFileByteLimit, sourceFileLimitMessage } from "../../contracts/source-limits.ts";

export function projectSubdirectory(value: unknown): string {
  const path = string(value, 240);
  ensure(
    path === "." ||
      (!/[\\:]/.test(path) &&
        path
          .split("/")
          .every((part) => part && part !== "." && part !== ".." && !excludedPath(part))),
    "UNSAFE_PATH",
    "زیرپوشه را از فهرست مخزن انتخاب کنید.",
    403,
  );
  if (path !== ".") for (const part of path.split("/")) checkName(part);
  return path;
}

export async function unpackGitHubArchive(
  bytes: Buffer,
  directory: string,
  signal: AbortSignal,
): Promise<SourceFile[]> {
  projectSubdirectory(directory);
  ensure(
    bytes.length <= 25_165_824,
    "GITHUB_DOWNLOAD_LIMIT",
    "مخزن برای دریافت مستقیم بیش از حد بزرگ است.",
    413,
  );
  const files: SourceFile[] = [],
    names = new Set<string>();
  let entries = 0,
    total = 0,
    inflated = 0,
    prefix: string | null = null,
    matchedDirectory = directory === ".";
  const archive = extract();
  archive.on("entry", (header, stream, next) => {
    // A rejected header can destroy its child stream before an iterator owns the error.
    stream.on("error", () => undefined);
    void (async () => {
      ensure(!signal.aborted, "CANCELLED", "دریافت پروژه لغو شد.", 409);
      ensure(
        ++entries <= SOURCE_MAX_ENTRIES,
        "GITHUB_DOWNLOAD_LIMIT",
        "تعداد فایل‌های مخزن بیش از سقف ورود مستقیم است.",
        413,
      );
      const path = header.name.replace(/\/$/, "");
      ensure(
        path.length <= 700 && !/[\\:]/.test(path) && !path.startsWith("/"),
        "UNSAFE_PATH",
        "مسیر نامعتبر در بسته مخزن وجود دارد.",
        403,
      );
      const parts = path.split("/");
      ensure(
        parts.length <= 13 && parts.every((part) => part && part !== "." && part !== ".."),
        "UNSAFE_PATH",
        "بسته مخزن مسیر خارج از پوشه دارد.",
        403,
      );
      prefix ??= parts[0] ?? null;
      ensure(
        prefix && prefix === parts[0],
        "GITHUB_ARCHIVE_INVALID",
        "بسته مخزن یک ریشه معتبر ندارد.",
        502,
      );
      const relative = parts.slice(1).join("/");
      ensure(
        header.type === "file" || header.type === "directory",
        "UNSAFE_PATH",
        "این مخزن پیوند یا فایل ویژه دارد؛ یک پروژه بدون پیوند انتخاب کنید.",
        403,
      );
      const selected =
        directory === "." || relative === directory || relative.startsWith(`${directory}/`);
      const output = directory === "." ? relative : relative.slice(directory.length + 1);
      if (selected) matchedDirectory = true;
      const keep =
        selected &&
        output &&
        header.type === "file" &&
        !parts.slice(1).some(excludedPath) &&
        sourceFileAllowed(parts.at(-1) || "");
      const chunks: Buffer[] = [];
      let count = 0;
      if (keep) {
        for (const part of output.split("/")) checkName(part);
        ensure(
          output.length <= 512 && !names.has(output.toLowerCase()),
          "GITHUB_ARCHIVE_INVALID",
          "بسته مخزن نام تکراری یا مسیر بیش از حد بلند دارد.",
          502,
        );
        ensure(
          Number.isSafeInteger(header.size) && header.size >= 0,
          "GITHUB_ARCHIVE_INVALID",
          "اندازه فایل مخزن معتبر نیست.",
          502,
        );
        ensure(header.size <= sourceFileByteLimit(output), "GITHUB_DOWNLOAD_LIMIT", sourceFileLimitMessage(output), 413);
        ensure(
          total + header.size <= SOURCE_MAX_BYTES && files.length < SOURCE_MAX_FILES,
          "GITHUB_DOWNLOAD_LIMIT",
          "مجموع فایل‌های انتخاب‌شده از سقف ۲۰ مگابایت یا ۱۰۰۰ فایل بیشتر است. پوشه یک برنامه کوچک‌تر را انتخاب کنید.",
          413,
        );
      }
      for await (const raw of stream) {
        const part: unknown = raw;
        ensure(Buffer.isBuffer(part), "GITHUB_ARCHIVE_INVALID", "خواندن بسته مخزن کامل نشد.", 502);
        ensure(!signal.aborted, "CANCELLED", "دریافت پروژه لغو شد.", 409);
        if (keep) {
          count += part.length;
          ensure(
            count <= sourceFileByteLimit(output) && total + count <= SOURCE_MAX_BYTES,
            "GITHUB_DOWNLOAD_LIMIT",
            "حجم فایل‌های پروژه بیش از سقف مجاز است.",
            413,
          );
          chunks.push(part);
        }
      }
      if (keep) {
        ensure(
          count === header.size,
          "GITHUB_ARCHIVE_INVALID",
          "اندازه فایل مخزن تغییر کرده است.",
          502,
        );
        names.add(output.toLowerCase());
        total += count;
        files.push({ path: output, content: Buffer.concat(chunks) });
      }
      next();
    })().catch((error: unknown) =>
      archive.destroy(
        error instanceof AppError
          ? error
          : new AppError(
              "GITHUB_ARCHIVE_INVALID",
              "بسته دریافت‌شده از مخزن قابل استفاده نیست.",
              502,
            ),
      ),
    );
  });
  const cap = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      inflated += chunk.length;
      callback(
        inflated > 67_108_864
          ? new AppError(
              "GITHUB_DOWNLOAD_LIMIT",
              "حجم بازشده مخزن بیش از سقف ورود مستقیم است. مخزن کوچک‌تری انتخاب کنید.",
              413,
            )
          : null,
        chunk,
      );
    },
  });
  try {
    await pipeline(Readable.from([bytes]), createGunzip(), cap, archive, { signal });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      signal.aborted ? "CANCELLED" : "GITHUB_ARCHIVE_INVALID",
      signal.aborted ? "دریافت پروژه لغو شد." : "بسته مخزن ناقص یا نامعتبر است. دوباره تلاش کنید.",
      signal.aborted ? 409 : 502,
    );
  }
  ensure(
    matchedDirectory,
    "GITHUB_FOLDER_NOT_FOUND",
    "این زیرپوشه در نسخه انتخاب‌شده وجود ندارد. زیرپوشه را دوباره انتخاب کنید.",
    404,
  );
  ensure(
    files.length,
    "GITHUB_FOLDER_EMPTY",
    "در این پوشه فایل پروژه قابل بررسی پیدا نشد. پوشه دیگری انتخاب کنید.",
    409,
  );
  return files;
}

export async function persistGitHubSource(
  stateDir: string,
  id: string,
  files: readonly SourceFile[],
  signal: AbortSignal,
): Promise<string> {
  ensure(/^[a-f0-9-]{36}$/.test(id), "INVALID_INPUT", "شناسه پروژه معتبر نیست.");
  const root = await realpath(stateDir),
    base = join(root, "github-sources");
  await mkdir(base, { recursive: true, mode: 0o700 });
  const stat = await lstat(base);
  ensure(
    stat.isDirectory() && !stat.isSymbolicLink() && (await realpath(base)) === base,
    "UNSAFE_PATH",
    "پوشه نگهداری پروژه امن نیست.",
    503,
  );
  ensure(
    (await readdir(base)).length < 16,
    "GITHUB_STORAGE_LIMIT",
    "ظرفیت نسخه‌های دریافت‌شده این نصب پر است. نسخه‌های قدیمی باید از تنظیمات نصب پاک‌سازی شوند.",
    413,
  );
  const destination = join(base, id);
  await mkdir(destination, { mode: 0o700 });
  try {
    for (const file of files) {
      ensure(!signal.aborted, "CANCELLED", "ذخیره پروژه لغو شد.", 409);
      const target = join(destination, file.path);
      ensure(under(destination, target), "UNSAFE_PATH", "فایل خارج از پروژه مجاز نیست.", 403);
      await mkdir(dirname(target), { recursive: true, mode: 0o700 });
      await writeFile(target, file.content, { flag: "wx", mode: 0o600 });
    }
    ensure(
      (await realpath(destination)) === destination,
      "UNSAFE_PATH",
      "مسیر پروژه تغییر کرده است.",
      403,
    );
    return destination;
  } catch (error) {
    await discardGitHubSource(stateDir, id);
    throw error;
  }
}

export async function discardGitHubSource(stateDir: string, id: string): Promise<void> {
  ensure(/^[a-f0-9-]{36}$/.test(id), "INVALID_INPUT", "شناسه پروژه معتبر نیست.");
  const root = await realpath(stateDir), base = join(root, "github-sources"), target = join(base, id);
  const stat = await lstat(base);
  ensure(stat.isDirectory() && !stat.isSymbolicLink() && (await realpath(base)) === base,
    "UNSAFE_PATH", "پوشه نگهداری پروژه امن نیست؛ پاک‌سازی متوقف شد.", 503);
  let targetStat: Stats;
  try { targetStat = await lstat(target); }
  catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
  ensure(targetStat.isDirectory() && !targetStat.isSymbolicLink() && under(base, target) && target !== base && (await realpath(target)) === target,
    "UNSAFE_PATH", "مسیر پروژه تغییر کرده است؛ پاک‌سازی متوقف شد.", 503);
  await rm(target, { recursive: true, force: true });
}
