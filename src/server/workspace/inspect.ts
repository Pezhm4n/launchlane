import { createHash } from "node:crypto";
import { constants, type Dirent } from "node:fs";
import { lstat, open, opendir, realpath } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import type { ManifestEntry, ProjectProfile } from "../../contracts/domain.ts";
import { hasControl, object } from "../../contracts/validation.ts";
import { AppError, ensure } from "../errors.ts";
import { resolveNodeRuntime } from "./node-runtime.ts";
import { sourcePorts } from "./ports.ts";
import { fingerprint } from "../policy/action.ts";
import { parsePythonRuntime, pythonStart } from "../../contracts/python-runtime.ts";
import { containsSourceCredential } from "../policy/redaction.ts";
import { SOURCE_MAX_FILES, SOURCE_MAX_ENTRIES, SOURCE_MAX_BYTES, sourceFileByteLimit, sourceFileLimitMessage } from "../../contracts/source-limits.ts";
import {
  checkName,
  excludedPath,
  filesystemError,
  sourceFileAllowed,
  under,
  workspaceDirectory,
} from "./paths.ts";
export { excludedPath } from "./paths.ts";

async function readSafeFile(root: string, path: string): Promise<Buffer> {
  const relativePath = relative(root, path).split(sep).join("/"), limit = sourceFileByteLimit(relativePath);
  const resolved = await realpath(path);
  ensure(under(root, resolved), "UNSAFE_PATH", "فایل بیرون workspace است.", 403);
  const before = await lstat(path);
  ensure(
    before.isFile() && !before.isSymbolicLink(),
    "UNSAFE_PATH",
    "پیوند یا فایل ویژه مجاز نیست.",
    403,
  );
  ensure(
    before.size <= limit,
    "SOURCE_LIMIT",
    sourceFileLimitMessage(relativePath),
    413,
  );
  // O_NOFOLLOW is supported on POSIX; canonical + lstat checks also run on Windows.
  const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const opened = await handle.stat();
    ensure(
      opened.isFile() &&
        opened.dev === before.dev &&
        opened.ino === before.ino &&
        opened.size === before.size,
      "SOURCE_CHANGED",
      "source هنگام بررسی تغییر کرد؛ دوباره بررسی کنید.",
      409,
    );
    const buffer = Buffer.alloc(before.size + 1);
    let bytes = 0;
    while (bytes < buffer.length) {
      const part = await handle.read(buffer, bytes, buffer.length - bytes, null);
      if (!part.bytesRead) break;
      bytes += part.bytesRead;
    }
    ensure(
      bytes === before.size && bytes <= limit,
      "SOURCE_CHANGED",
      "source هنگام بررسی تغییر کرد؛ دوباره بررسی کنید.",
      409,
    );
    const after = await handle.stat();
    ensure(
      after.mtimeMs === before.mtimeMs &&
        after.ctimeMs === before.ctimeMs &&
        (await realpath(path)) === resolved,
      "SOURCE_CHANGED",
      "source هنگام بررسی تغییر کرد؛ دوباره بررسی کنید.",
      409,
    );
    return buffer.subarray(0, bytes);
  } finally {
    await handle.close();
  }
}

function safeScript(value: unknown): string | null {
  if (typeof value !== "string" || !value || value.length > 256 || hasControl(value)) return null;
  ensure(
    !containsSourceCredential(value),
    "SENSITIVE_SOURCE",
    "یک script مقدار حساس دارد؛ آن را به متغیر محیطی منتقل کنید.",
  );
  return value;
}

type ScanOptions = { secrets?: readonly string[]; signal?: AbortSignal };
export type SourceFile = Readonly<{ path: string; content: Buffer }>;

export async function inspectProject(
  workspaceRoot: string,
  directory: string,
  options: ScanOptions = {},
): Promise<ProjectProfile> {
  try {
    return (await scanProject(workspaceRoot, directory, options, false)).profile;
  } catch (error) {
    throw filesystemError(error);
  }
}

export async function captureProject(
  workspaceRoot: string,
  directory: string,
  options: ScanOptions = {},
): Promise<{ profile: ProjectProfile; files: SourceFile[] }> {
  try {
    return await scanProject(workspaceRoot, directory, options, true);
  } catch (error) {
    throw filesystemError(error);
  }
}

async function scanProject(
  workspaceRoot: string,
  directory: string,
  options: ScanOptions,
  capture: boolean,
): Promise<{ profile: ProjectProfile; files: SourceFile[] }> {
  ensure(!options.signal?.aborted, "CANCELLED", "بررسی پروژه لغو شد.", 409);
  const { target } = await workspaceDirectory(workspaceRoot, directory);
  const manifest: ManifestEntry[] = [];
  const files: SourceFile[] = [];
  const envNames = new Set<string>();
  let totalBytes = 0,
    seen = 0,
    excludedCount = 0;
  let packageJson: Record<string, unknown> | null = null;
  let liaraJson: Record<string, unknown> | null = null;
  let literalPort: number | null = null;
  const ports = new Set<number>();
  let unresolvedPort = false;
  const visit = async (folder: string, depth: number): Promise<void> => {
    ensure(depth <= 10, "SOURCE_LIMIT", "عمق source بیشتر از سقف مجاز است.", 413);
    const entries: Dirent[] = [];
    // Enforce the enumeration bound before a large directory is materialized in memory.
    for await (const entry of await opendir(folder, { bufferSize: 32 })) {
      ensure(!options.signal?.aborted, "CANCELLED", "بررسی پروژه لغو شد.", 409);
      ensure(++seen <= SOURCE_MAX_ENTRIES, "SOURCE_LIMIT", "تعداد فایل‌ها بیشتر از سقف بررسی است.", 413);
      entries.push(entry);
    }
    entries.sort((a, b) => a.name.localeCompare(b.name, "en"));
    for (const entry of entries) {
      ensure(!options.signal?.aborted, "CANCELLED", "بررسی پروژه لغو شد.", 409);
      if (excludedPath(entry.name)) {
        excludedCount++;
        continue;
      }
      checkName(entry.name);
      const path = resolve(folder, entry.name);
      const stat = await lstat(path);
      ensure(
        !stat.isSymbolicLink() && under(target, await realpath(path)),
        "UNSAFE_PATH",
        "source دارای پیوند یا junction است؛ ابتدا آن را حذف کنید.",
        403,
      );
      if (stat.isDirectory()) {
        await visit(path, depth + 1);
        continue;
      }
      ensure(stat.isFile(), "UNSAFE_PATH", "فایل ویژه در source مجاز نیست.", 403);
      if (!sourceFileAllowed(entry.name)) {
        excludedCount++;
        continue;
      }
      const content = await readSafeFile(target, path);
      ensure(
        manifest.length < SOURCE_MAX_FILES && totalBytes + content.length <= SOURCE_MAX_BYTES,
        "SOURCE_LIMIT",
        "حجم یا تعداد source بیشتر از سقف مجاز است.",
        413,
      );
      const text = content.toString("utf8");
      const relativePath = relative(target, path).split(sep).join("/");
      ensure(
        !containsSourceCredential(text, options.secrets, relativePath),
        "SENSITIVE_SOURCE",
        `فایل «${relativePath}» احتمالاً مقدار محرمانه دارد. آن را به متغیر محیطی منتقل و پروژه را دوباره بررسی کنید.`,
      );
      ensure(relativePath.length <= 512, "UNSAFE_PATH", "مسیر یک فایل بیش از حد بلند است.", 403);
      manifest.push({
        path: relativePath,
        bytes: content.length,
        sha256: createHash("sha256").update(content).digest("hex"),
      });
      // Retain actual bytes, not the full scratch buffer behind readSafeFile's subarray.
      if (capture) files.push({ path: relativePath, content: Buffer.from(content) });
      totalBytes += content.length;
      if (relativePath === "package.json" || relativePath === "liara.json") {
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          throw new AppError("INVALID_PROJECT", "package.json یا liara.json معتبر نیست.");
        }
        ensure(
          typeof parsed === "object" && parsed !== null && !Array.isArray(parsed),
          "INVALID_PROJECT",
          "package.json یا liara.json باید تنظیمات معتبر پروژه باشد. فایل را اصلاح یا پوشه دیگری انتخاب کنید.",
        );
        if (relativePath === "package.json") packageJson = object(parsed);
        else liaraJson = object(parsed);
      }
      if (/\.[cm]?[jt]sx?$/.test(entry.name)) {
        for (const match of text.matchAll(
          /\bprocess\.env(?:\.([A-Z][A-Z0-9_]{0,63})|\[['"]([A-Z][A-Z0-9_]{0,63})['"]\])/g,
        )) {
          const name = match[1] || match[2];
          if (name) envNames.add(name);
        }
        const candidates = sourcePorts(text);
        for (const value of candidates.ports) ports.add(value);
        unresolvedPort ||= candidates.unresolved;
      }
      if (entry.name.endsWith(".py")) {
        for (const match of text.matchAll(/\bos\.(?:getenv\(\s*|environ\[\s*|environ\.get\(\s*)['"]([A-Z][A-Z0-9_]{0,63})['"]/g)) {
          if (match[1]) envNames.add(match[1]);
        }
      }
    }
  };
  await visit(target, 0);
  // Values are assigned by the bounded walk; parse records again to retain narrowing across async closures.
  const pkg: Record<string, unknown> = packageJson ?? {};
  const liara: Record<string, unknown> = liaraJson ?? {};
  const scripts = pkg.scripts === undefined ? {} : object(pkg.scripts);
  const nodeRuntime = resolveNodeRuntime(pkg.engines, liara.node);
  if (
    typeof liara.port === "number" &&
    Number.isInteger(liara.port) &&
    liara.port >= 1 &&
    liara.port <= 65535
  )
    literalPort = liara.port;
  const nextStart = typeof object(pkg.dependencies ?? {}).next === "string" && typeof scripts.start === "string"
    ? /^next start(?: (?:-H|--hostname) (?:0\.0\.0\.0|127\.0\.0\.1))?(?: (?:-p|--port) (\d{1,5}))?$/.exec(scripts.start) : null;
  const nextPort = nextStart ? Number(nextStart[1] ?? 3000) : null;
  const port = literalPort ?? (nextPort && nextPort <= 65535 ? nextPort : null) ?? (!unresolvedPort && ports.size === 1 ? ([...ports][0] ?? null) : null);
  // A workspace manifest describes multiple packages. Do not treat an orchestrator start
  // as the single Node workload supported by this deployment path; require an explicit leaf.
  const hasWorkspaces = pkg.workspaces !== undefined;
  const python = !packageJson && manifest.some(file => file.path.endsWith(".py"));
  const pythonRuntime = python ? parsePythonRuntime({ kind: "python", version: object(liara.python ?? {}).version ?? "3.12",
    command: Array.isArray(liara.args) && liara.args.length === 1 && typeof liara.args[0] === "string" ? liara.args[0].trim().split(/\s+/) : ["python3", "main.py"] }) : undefined;
  const start = pythonRuntime ? (pythonRuntime.command[1] === "-m" || manifest.some(file => file.path === pythonRuntime.command[1]) ? pythonStart(pythonRuntime) : null) : hasWorkspaces ? null : safeScript(scripts.start),
    build = safeScript(scripts.build);
  const missing: string[] = [];
  if (hasWorkspaces) missing.push("این پوشه چند بسته را مدیریت می‌کند؛ زیرپوشه همان برنامه قابل انتشار را انتخاب کنید.");
  if (!packageJson && !python) missing.push("پروژه Node یا Python قابل تشخیص نیست.");
  if (!start) missing.push("دستور start مشخص نیست؛ قبل از انتشار آن را تعیین کنید.");
  if (port === null) missing.push("پورت قطعی نیست؛ پورت برنامه را وارد کنید.");
  if (packageJson && !nodeRuntime.version) missing.push(nodeRuntime.detail);
  if (envNames.size)
    missing.push("فقط نام envها شناسایی شد؛ مقدار و کافی‌بودن آن‌ها هنوز بررسی نشده است.");
  manifest.sort((a, b) => a.path.localeCompare(b.path, "en"));
  const profile: ProjectProfile = {
    directory,
    runtime: packageJson ? "node" : python ? "python" : "unknown",
    nodeVersion: python ? null : nodeRuntime.requirement,
    ...(pythonRuntime ? { pythonRuntime } : { nodeRuntime }),
    port,
    start,
    build,
    envNames: [...envNames].sort(),
    missing,
    manifest,
    sourceHash: fingerprint(manifest),
    totalBytes,
    excludedCount,
    inspectedAt: new Date().toISOString(),
  };
  return { profile, files };
}
