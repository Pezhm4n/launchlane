import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, mkdir, open, readdir, realpath, unlink } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { gzip } from "node:zlib";
import { pack } from "tar-stream";
import type { SourceArtifact } from "../../contracts/domain.ts";
import { MAX_ARCHIVE_BYTES } from "../../contracts/source.ts";
import { hash } from "../../contracts/validation.ts";
import { AppError, ensure } from "../errors.ts";
import { captureProject, type SourceFile } from "./inspect.ts";
import { validateBuildOutput, type ValidatedBuildOutput } from "../agent/build-output.ts";

const compress = promisify(gzip);

function cancelled(signal?: AbortSignal): void {
  ensure(!signal?.aborted, "CANCELLED", "آماده‌سازی بسته لغو شد؛ فایلی ارسال نشد.", 409);
}

async function encode(files: readonly SourceFile[], signal?: AbortSignal): Promise<Buffer> {
  const archive = pack();
  const collected = (async () => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    for await (const raw of archive) {
      const chunk: unknown = raw;
      cancelled(signal);
      ensure(Buffer.isBuffer(chunk), "ARCHIVE_INVALID", "ساخت بسته source کامل نشد.", 503);
      bytes += chunk.length;
      ensure(
        bytes <= MAX_ARCHIVE_BYTES,
        "SOURCE_LIMIT",
        "بسته source از سقف مجاز بزرگ‌تر است.",
        413,
      );
      chunks.push(chunk);
    }
    return Buffer.concat(chunks, bytes);
  })();
  // Keep a rejection observed while entry callbacks are pending (e.g. cancellation).
  void collected.catch(() => undefined);
  try {
    for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path, "en"))) {
      cancelled(signal);
      await new Promise<void>((resolve, reject) => {
        archive.entry(
          {
            name: file.path,
            type: "file",
            size: file.content.length,
            mode: 0o644,
            uid: 0,
            gid: 0,
            uname: "",
            gname: "",
            mtime: new Date(0),
          },
          file.content,
          (error) => (error ? reject(error) : resolve()),
        );
      });
    }
    archive.finalize();
    const bytes = await compress(await collected, { level: 6 });
    cancelled(signal);
    ensure(
      bytes.length <= MAX_ARCHIVE_BYTES,
      "SOURCE_LIMIT",
      "بسته source بیش از حد بزرگ است.",
      413,
    );
    return bytes;
  } finally {
    archive.destroy();
  }
}

async function artifactDirectory(stateDir: string): Promise<string> {
  const root = await realpath(stateDir);
  const directory = join(root, "source-artifacts");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const stat = await lstat(directory);
  ensure(
    stat.isDirectory() && !stat.isSymbolicLink() && (await realpath(directory)) === directory,
    "UNSAFE_ARTIFACT_PATH",
    "پوشه نگهداری source امن نیست؛ تنظیمات محلی را بررسی کنید.",
    503,
  );
  return directory;
}

function digest(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function readArtifact(stateDir: string, artifact: SourceArtifact): Promise<Buffer> {
  const archiveHash = hash(artifact.archiveHash);
  const directory = await artifactDirectory(stateDir);
  const path = join(directory, `${archiveHash}.tar.gz`);
  try {
    const before = await lstat(path);
    ensure(
      before.isFile() &&
        !before.isSymbolicLink() &&
        before.size === artifact.bytes &&
        before.size <= MAX_ARCHIVE_BYTES,
      "ARTIFACT_MISMATCH",
      "بسته source تغییر کرده است؛ دوباره آن را آماده کنید.",
      409,
    );
    ensure(
      (await realpath(path)) === path,
      "UNSAFE_ARTIFACT_PATH",
      "مسیر بسته source امن نیست.",
      503,
    );
    const file = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    try {
      const opened = await file.stat();
      ensure(
        opened.dev === before.dev && opened.ino === before.ino && opened.size === before.size,
        "ARTIFACT_MISMATCH",
        "بسته source هنگام خواندن تغییر کرده است.",
        409,
      );
      const bytes = Buffer.alloc(artifact.bytes + 1);
      let length = 0;
      while (length < bytes.length) {
        const part = await file.read(bytes, length, bytes.length - length, null);
        if (!part.bytesRead) break;
        length += part.bytesRead;
      }
      const result = bytes.subarray(0, length);
      const after = await file.stat();
      ensure(
        length === artifact.bytes &&
          digest(result) === archiveHash &&
          after.mtimeMs === before.mtimeMs &&
          after.ctimeMs === before.ctimeMs &&
          (await realpath(path)) === path,
        "ARTIFACT_MISMATCH",
        "محتوای بسته source با هش ثبت‌شده برابر نیست.",
        409,
      );
      return result;
    } finally {
      await file.close();
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      "ARTIFACT_UNAVAILABLE",
      "بسته source در دسترس نیست؛ نگهداری محلی را بررسی کنید.",
      503,
    );
  }
}

export async function persistArtifact(
  stateDir: string,
  artifact: SourceArtifact,
  bytes: Buffer,
): Promise<void> {
  const directory = await artifactDirectory(stateDir);
  const entries = await readdir(directory);
  const destination = join(directory, `${artifact.archiveHash}.tar.gz`);
  if (entries.includes(`${artifact.archiveHash}.tar.gz`)) {
    await readArtifact(stateDir, artifact);
    return;
  }
  ensure(
    entries.length < 32,
    "ARTIFACT_STORAGE_LIMIT",
    "نگهداری بسته‌های محلی پر شده است؛ ابتدا فضای source را مدیریت کنید.",
    413,
  );
  let occupied = 0;
  for (const entry of entries) {
    const stat = await lstat(join(directory, entry));
    ensure(
      stat.isFile() && !stat.isSymbolicLink(),
      "UNSAFE_ARTIFACT_PATH",
      "پوشه بسته source دارای فایل نامعتبر است.",
      503,
    );
    occupied += stat.size;
  }
  ensure(
    occupied + bytes.length <= 128 * 1024 * 1024,
    "ARTIFACT_STORAGE_LIMIT",
    "حجم بسته‌های محلی به سقف نگهداری رسیده است.",
    413,
  );
  const temporary = join(directory, `${randomUUID()}.pending`);
  const file = await open(temporary, "wx", 0o600);
  try {
    try {
      await file.writeFile(bytes);
      await file.sync();
    } finally {
      await file.close();
    }
    // Publish without overwriting another request's content-addressed file or following a symlink.
    await link(temporary, destination).catch((error: unknown) => {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
    });
    await readArtifact(stateDir, artifact);
  } finally {
    await unlink(temporary);
  }
}

export async function createSourceArchive(input: {
  workspaceRoot: string;
  directory: string;
  sourceHash: string;
  secrets?: readonly string[];
  signal?: AbortSignal;
  compiledOutput?: ValidatedBuildOutput;
}): Promise<{ artifact: SourceArtifact; bytes: Buffer }> {
  cancelled(input.signal);
  const expected = hash(input.sourceHash);
  const { profile, files } = await captureProject(input.workspaceRoot, input.directory, input);
  ensure(
    profile.sourceHash === expected,
    "SOURCE_CHANGED",
    "source پس از بررسی تغییر کرده است؛ دوباره بررسی کنید.",
    409,
  );
  ensure(
    files.length > 0 && (profile.runtime === "node" || profile.runtime === "python" || profile.runtime === "static" || profile.runtime === "docker") && profile.start,
    "PROJECT_INCOMPLETE",
    "پروژه به package.json و دستور start نیاز دارد.",
    409,
  );
  let packaged = files;
  if (input.compiledOutput) {
    const directory = profile.fullstack?.outputDirectory;
    ensure(directory && !profile.fullstack?.requiresPreparation && profile.build === "node .launchlane-build.cjs" && files.some(file => file.path === ".launchlane-build.json"),
      "BUILD_OUTPUT_BINDING_CHANGED", "خروجی کامل فقط به نسخهٔ آماده‌شده و بررسی‌کنندهٔ همان ساخت متصل می‌شود.", 409);
    const output = validateBuildOutput({ version: 1, files: input.compiledOutput.manifest }, new Map(input.compiledOutput.files.map(file => [file.path, file.content])));
    const metadata = files.find(file => file.path === ".launchlane-build.json");
    ensure(metadata, "BUILD_OUTPUT_BINDING_CHANGED", "فهرست خروجی نهایی موجود نیست.", 409);
    const declaration: unknown = JSON.parse(metadata.content.toString("utf8"));
    ensure(declaration && typeof declaration === "object" && "outputDirectory" in declaration && "files" in declaration && declaration.outputDirectory === directory && JSON.stringify(declaration.files) === JSON.stringify(output.manifest),
      "BUILD_OUTPUT_BINDING_CHANGED", "فهرست خروجی نهایی با بایت‌های بسته برابر نیست.", 409);
    const prefix = `${directory}/`;
    ensure(!files.some(file => file.path === directory || file.path.startsWith(prefix)), "BUILD_OUTPUT_BINDING_CHANGED", "خروجی نباید فایل source موجود را جایگزین کند.", 409);
    packaged = [...files, ...output.files.map(file => ({ path: prefix + file.path, content: file.content }))];
    ensure(packaged.length <= 1000, "SOURCE_LIMIT", "تعداد فایل‌های بستهٔ نهایی بیش از سقف این انتشار است.", 413);
  }
  const bytes = await encode(packaged, input.signal);
  const artifact: SourceArtifact = {
    format: "tar.gz",
    archiveHash: digest(bytes),
    sourceHash: expected,
    bytes: bytes.length,
    fileCount: packaged.length,
    createdAt: Date.now(),
  };
  return { artifact, bytes };
}
