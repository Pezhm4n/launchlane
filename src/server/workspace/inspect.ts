import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import type { ManifestEntry, ProjectProfile } from "../../contracts/domain.ts";
import { hasControl, object } from "../../contracts/validation.ts";
import { AppError, ensure } from "../errors.ts";
import { fingerprint } from "../policy/action.ts";
import { containsCredential } from "../policy/redaction.ts";

const MAX_FILES = 1000;
const MAX_ENTRIES = 5000;
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_FILE_BYTES = 512 * 1024;
const excludedNames = new Set([
  ".git",
  ".hg",
  ".svn",
  "node_modules",
  ".next",
  ".data",
  ".local",
  ".artifacts",
  ".agents",
  ".cache",
  ".npm",
  ".yarn",
  "coverage",
  "dist",
  "build",
  "out",
  "vendor",
  ".vercel",
  ".liara",
  ".ssh",
  ".aws",
  "__pycache__",
]);
const allowedExtension =
  /\.(?:[cm]?[jt]sx?|json|lock|md|txt|html?|css|scss|svg|png|jpe?g|webp|ico|woff2?|ya?ml)$/i;

export function excludedPath(name: string): boolean {
  return (
    excludedNames.has(name.toLowerCase()) ||
    /^\.env/i.test(name) ||
    /(?:credential|password|secret|access[-_]?token|api[-_]?key)/i.test(name) ||
    /\.(?:pem|key|p12|pfx|db|sqlite\d*|log|gz|zip|tar)$/i.test(name) ||
    /^(?:\.npmrc|\.netrc|id_rsa|id_ed25519)$/i.test(name)
  );
}

function under(root: string, target: string): boolean {
  const path = relative(root, target);
  return path === "" || (!isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`));
}

function checkName(name: string): void {
  ensure(
    name.length > 0 && name.length <= 160 && /^[\p{L}\p{N}._ @()+-]+$/u.test(name),
    "UNSAFE_PATH",
    "نام یک فایل برای بسته source مجاز نیست؛ نام ساده‌تری انتخاب کنید.",
  );
}

async function readSafeFile(root: string, path: string): Promise<Buffer> {
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
    before.size <= MAX_FILE_BYTES,
    "SOURCE_LIMIT",
    "یک فایل از سقف بررسی source بزرگ‌تر است.",
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
    const buffer = Buffer.alloc(MAX_FILE_BYTES + 1);
    let bytes = 0;
    while (bytes < buffer.length) {
      const part = await handle.read(buffer, bytes, buffer.length - bytes, null);
      if (!part.bytesRead) break;
      bytes += part.bytesRead;
    }
    ensure(
      bytes === before.size && bytes <= MAX_FILE_BYTES,
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
    !containsCredential(value),
    "SENSITIVE_SOURCE",
    "یک script مقدار حساس دارد؛ آن را به متغیر محیطی منتقل کنید.",
  );
  return value;
}

export async function inspectProject(
  workspaceRoot: string,
  directory: string,
  options: { secrets?: readonly string[]; signal?: AbortSignal } = {},
): Promise<ProjectProfile> {
  ensure(
    directory.length > 0 &&
      directory.length <= 240 &&
      !isAbsolute(directory) &&
      !directory.includes("\\") &&
      !directory.includes(":") &&
      directory
        .split("/")
        .every((part) => part && part !== ".." && part !== "." && !excludedPath(part)),
    "UNSAFE_PATH",
    "مسیر باید نسبی و زیر workspace مجاز باشد.",
    403,
  );
  const root = await realpath(workspaceRoot);
  const target = resolve(root, directory);
  ensure(under(root, target), "UNSAFE_PATH", "پروژه بیرون workspace است.", 403);
  let cursor = root;
  for (const part of directory.split("/")) {
    checkName(part);
    cursor = resolve(cursor, part);
    const stat = await lstat(cursor);
    ensure(
      stat.isDirectory() && !stat.isSymbolicLink() && under(root, await realpath(cursor)),
      "UNSAFE_PATH",
      "مسیر پروژه نباید پیوند یا junction باشد.",
      403,
    );
  }
  const manifest: ManifestEntry[] = [];
  const envNames = new Set<string>();
  let totalBytes = 0,
    seen = 0,
    excludedCount = 0;
  let packageJson: Record<string, unknown> | null = null;
  let liaraJson: Record<string, unknown> | null = null;
  let literalPort: number | null = null;
  const ports = new Set<number>();
  const visit = async (folder: string, depth: number): Promise<void> => {
    ensure(depth <= 10, "SOURCE_LIMIT", "عمق source بیشتر از سقف مجاز است.", 413);
    const entries = await readdir(folder, { withFileTypes: true });
    ensure(
      seen + entries.length <= MAX_ENTRIES,
      "SOURCE_LIMIT",
      "تعداد فایل‌ها بیشتر از سقف بررسی است.",
      413,
    );
    seen += entries.length;
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
      if (
        !allowedExtension.test(entry.name) &&
        !["Dockerfile", "Procfile", ".dockerignore", ".gitignore"].includes(entry.name)
      ) {
        excludedCount++;
        continue;
      }
      const content = await readSafeFile(target, path);
      ensure(
        manifest.length < MAX_FILES && totalBytes + content.length <= MAX_BYTES,
        "SOURCE_LIMIT",
        "حجم یا تعداد source بیشتر از سقف مجاز است.",
        413,
      );
      const text = content.toString("utf8");
      ensure(
        !containsCredential(text, options.secrets),
        "SENSITIVE_SOURCE",
        "source شامل مقدار حساس احتمالی است؛ آن را به env منتقل و دوباره بررسی کنید.",
      );
      const relativePath = relative(target, path).split(sep).join("/");
      manifest.push({
        path: relativePath,
        bytes: content.length,
        sha256: createHash("sha256").update(content).digest("hex"),
      });
      totalBytes += content.length;
      if (relativePath === "package.json" || relativePath === "liara.json") {
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          throw new AppError("INVALID_PROJECT", "package.json یا liara.json معتبر نیست.");
        }
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
        for (const match of text.matchAll(
          /\b(?:listen\(\s*|process\.env\.PORT\s*\|\|\s*)(\d{2,5})\b/g,
        )) {
          const value = Number(match[1]);
          if (value > 0 && value <= 65535) ports.add(value);
        }
      }
    }
  };
  await visit(target, 0);
  // Values are assigned by the bounded walk; parse records again to retain narrowing across async closures.
  const pkg: Record<string, unknown> = packageJson ?? {};
  const liara: Record<string, unknown> = liaraJson ?? {};
  const scripts = pkg.scripts === undefined ? {} : object(pkg.scripts);
  const engines = pkg.engines === undefined ? {} : object(pkg.engines);
  if (
    typeof liara.port === "number" &&
    Number.isInteger(liara.port) &&
    liara.port >= 1 &&
    liara.port <= 65535
  )
    literalPort = liara.port;
  const port = literalPort ?? (ports.size === 1 ? ([...ports][0] ?? null) : null);
  const start = safeScript(scripts.start),
    build = safeScript(scripts.build);
  const missing: string[] = [];
  if (!packageJson) missing.push("package.json پیدا نشد؛ پروژه Node تأیید نشده است.");
  if (!start) missing.push("دستور start مشخص نیست؛ قبل از انتشار آن را تعیین کنید.");
  if (port === null) missing.push("پورت قطعی نیست؛ پورت برنامه را وارد کنید.");
  if (envNames.size)
    missing.push("فقط نام envها شناسایی شد؛ مقدار و کافی‌بودن آن‌ها هنوز بررسی نشده است.");
  manifest.sort((a, b) => a.path.localeCompare(b.path, "en"));
  return {
    directory,
    runtime: packageJson ? "node" : "unknown",
    nodeVersion: typeof engines.node === "string" ? safeScript(engines.node) : null,
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
}
