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
import { staticRuntime } from "../../contracts/static-runtime.ts";
import { validateStaticFiles } from "./static.ts";
import { parseNextRuntime } from "../../contracts/next-runtime.ts";
import { frontendRuntime } from "./frontend.ts";
import { sourceEnvironmentNames } from "./environment-names.ts";
import { containsSourceCredential } from "../policy/redaction.ts";
import { sourceIgnore, ignoreFileMaxBytes, type SourceIgnoreFile } from "../../contracts/source-ignore.ts";
import { inspectNativePlatform } from "./native-platform.ts";
import { parseDockerRuntime } from "../../contracts/docker-runtime.ts";
import { inspectFullstack } from "./fullstack.ts";
import { inspectApplicationRequirements } from "./application-requirements.ts";
import { separateApplicationRequirements } from "../policy/application-scope.ts";
import { configuredFixtureReviews, containsKnownSourceValue } from "../policy/source-fixture-review.ts";
import type { SourceFixtureReviewEvidence } from "../../contracts/source-fixture-review.ts";
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

export async function readSafeFile(root: string, path: string, maxBytes?: number): Promise<Buffer> {
  const relativePath = relative(root, path).split(sep).join("/"), limit = maxBytes ?? sourceFileByteLimit(relativePath);
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
  if (typeof value !== "string" || !value || value.length > 1000 || hasControl(value)) return null;
  ensure(
    !containsSourceCredential(value),
    "SENSITIVE_SOURCE",
    "یک script مقدار حساس دارد؛ آن را به متغیر محیطی منتقل کنید.",
  );
  return value;
}

type ScanOptions = { secrets?: readonly string[]; signal?: AbortSignal; onCredentialFinding?: (path: string) => void };
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
  _capture: boolean,
): Promise<{ profile: ProjectProfile; files: SourceFile[] }> {
  ensure(!options.signal?.aborted, "CANCELLED", "بررسی پروژه لغو شد.", 409);
  const { target } = await workspaceDirectory(workspaceRoot, directory);
  const manifest: ManifestEntry[] = [];
  const files: SourceFile[] = [];
  const envNames = new Set<string>();
  let totalBytes = 0,
    seen = 0,
    excludedCount = 0;
  let inspectedBytes = 0, inspectedFiles = 0;
  const credentialFindings: string[] = [];
  const fixtureReviews = configuredFixtureReviews(), usedFixtureReviews: SourceFixtureReviewEvidence[] = [];
  let packageJson: Record<string, unknown> | null = null;
  let liaraJson: Record<string, unknown> | null = null;
  let literalPort: number | null = null;
  const ports = new Set<number>();
  let unresolvedPort = false;
  const ignoreFiles: SourceIgnoreFile[] = [];
  let ignored = sourceIgnore(ignoreFiles);
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
    if (entries.some(entry => entry.name === ".gitignore")) {
      const path = resolve(folder, ".gitignore"), content = await readSafeFile(target, path, ignoreFileMaxBytes);
      let text: string;
      try { text = new TextDecoder("utf-8", { fatal: true }).decode(content); }
      catch { throw new AppError("SOURCE_IGNORE_INVALID", "قواعد بسته‌بندی باید متن UTF-8 باشند.", 409); }
      ignoreFiles.push({ path: relative(target, path).split(sep).join("/"), content: text }); ignored = sourceIgnore(ignoreFiles);
    }
    for (const entry of entries) {
      ensure(!options.signal?.aborted, "CANCELLED", "بررسی پروژه لغو شد.", 409);
      if (excludedPath(entry.name)) {
        excludedCount++;
        continue;
      }
      checkName(entry.name);
      const path = resolve(folder, entry.name);
      const relativePath = relative(target, path).split(sep).join("/");
      if (ignored(relativePath, entry.isDirectory())) { excludedCount++; continue; }
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
      inspectedBytes += content.length; inspectedFiles++;
      ensure(
        inspectedFiles <= SOURCE_MAX_FILES && inspectedBytes <= SOURCE_MAX_BYTES,
        "SOURCE_LIMIT",
        "حجم یا تعداد source بیشتر از سقف مجاز است.",
        413,
      );
      const text = content.toString("utf8");
      const contentHash = createHash("sha256").update(content).digest("hex");
      if (containsSourceCredential(text, options.secrets, relativePath)) {
        const review = fixtureReviews.find(review => review.path === relativePath && review.sha256 === contentHash);
        if (!review || containsKnownSourceValue(text, options.secrets)) { credentialFindings.push(relativePath); options.onCredentialFinding?.(relativePath); continue; }
        usedFixtureReviews.push(review);
      }
      ensure(relativePath.length <= 512, "UNSAFE_PATH", "مسیر یک فایل بیش از حد بلند است.", 403);
      manifest.push({
        path: relativePath,
        bytes: content.length,
        sha256: contentHash,
      });
      // Retain actual bytes, not the full scratch buffer behind readSafeFile's subarray.
      files.push({ path: relativePath, content: Buffer.from(content) });
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
        const candidates = sourcePorts(text);
        for (const value of candidates.ports) ports.add(value);
        unresolvedPort ||= candidates.unresolved;
      }
      const testOnly = /(?:^|\/)(?:tests?|testing|unit|__tests__|e2e)(?:\/|$)|(?:^|\/)(?:test_[^/]+\.py|[^/]+_test\.py)|\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(relativePath);
      if (!testOnly && /\.(?:py|vue|[cm]?[jt]sx?)$/i.test(relativePath)) {
        for (const name of sourceEnvironmentNames(text, relativePath)) envNames.add(name);
        ensure(envNames.size <= 128, "ENV_DISCOVERY_LIMIT", "تعداد نام تنظیمات پروژه بیشتر از سقف این بررسی است.", 413);
      }
    }
  };
  await visit(target, 0);
  ensure(!credentialFindings.length, "SENSITIVE_SOURCE", `فایل «${credentialFindings[0]}»${credentialFindings.length > 1 ? ` و ${credentialFindings.length - 1} فایل دیگر` : ""} احتمالاً مقدار محرمانه دارد. آن را به متغیر محیطی منتقل و پروژه را دوباره بررسی کنید.`);
  // Values are assigned by the bounded walk; parse records again to retain narrowing across async closures.
  const pkg: Record<string, unknown> = packageJson ?? {};
  const liara: Record<string, unknown> = liaraJson ?? {};
  const applicationRequirements = inspectApplicationRequirements(files);
  const separateExecution = separateApplicationRequirements({ applicationRequirements }).length > 0;
  const fullstack = inspectFullstack(pkg, liara, files, [...envNames].sort());
  for (const key of fullstack?.workerSqlite?.requiredEnvironmentKeys ?? []) envNames.add(key);
  const nativeInspection = inspectNativePlatform(files, liara);
  const dockerDescriptor = nativeInspection.state === "detected" && nativeInspection.descriptor.platform === "docker" ? nativeInspection.descriptor : null;
  const dockerEntry = dockerDescriptor?.entry ? manifest.find(file => file.path === dockerDescriptor.entry) : undefined;
  // A package's Dockerfile may only build its API; it does not supersede an entire Node application implicitly.
  const dockerRuntime = !fullstack && dockerDescriptor && dockerEntry && dockerDescriptor.port && (liara.platform === "docker" || !packageJson)
    ? parseDockerRuntime({ kind: "docker", contextRoot: ".", dockerfile: dockerEntry.path, dockerfileHash: dockerEntry.sha256, port: dockerDescriptor.port }) : undefined;
  const nativeExecutionRequired = nativeInspection.state === "detected" && nativeInspection.descriptor.platform !== "docker" ||
    nativeInspection.state === "unsupported" && (nativeInspection.platform !== "docker" || liara.platform === "docker");
  const scripts = pkg.scripts === undefined ? {} : object(pkg.scripts);
  const staticSite = !packageJson && manifest.some(file => file.path === "index.html") &&
    !manifest.some(file => /\.(?:py|php|csproj|fsproj|go|rb|java)$|^(?:Dockerfile|composer\.json|Gemfile)$/i.test(file.path)) &&
    (liara.platform === undefined || liara.platform === "static");
  if (staticSite) validateStaticFiles(files, manifest.map(file => file.path));
  const next = !dockerRuntime && !nativeExecutionRequired && !separateExecution && typeof object(pkg.dependencies ?? {}).next === "string" && typeof scripts.start === "string" && /^next start(?:\s|$)/.test(scripts.start) && liara.platform !== "node";
  const nextConfig = object(liara.next ?? {});
  const frontend = dockerRuntime || fullstack || nativeExecutionRequired || separateExecution ? undefined : frontendRuntime(pkg, liara, files);
  const nodeRuntime = resolveNodeRuntime(pkg.engines, frontend ? { version: "20" } : next ? { version: nextConfig.nodeVersion } : liara.node);
  const nextRuntime = next && nodeRuntime.version ? parseNextRuntime({ kind: "next", version: nodeRuntime.version, mirror: object(liara.next ?? {}).mirror ?? true }) : undefined;
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
  const port = dockerRuntime?.port ?? (staticSite || frontend ? 80 : literalPort ?? (nextPort && nextPort <= 65535 ? nextPort : null) ?? (!unresolvedPort && ports.size === 1 ? ([...ports][0] ?? null) : null));
  // A workspace manifest describes multiple packages. Do not treat an orchestrator start
  // as the single Node workload supported by this deployment path; require an explicit leaf.
  const hasWorkspaces = pkg.workspaces !== undefined;
  const python = !packageJson && manifest.some(file => file.path.endsWith(".py"));
  const pythonRuntime = python ? parsePythonRuntime({ kind: "python", version: object(liara.python ?? {}).version ?? "3.12",
    command: Array.isArray(liara.args) && liara.args.length === 1 && typeof liara.args[0] === "string" ? liara.args[0].trim().split(/\s+/) : ["python3", "main.py"] }) : undefined;
  const start = nativeExecutionRequired ? null : dockerRuntime ? "liara-docker" : staticSite ? "liara-static" : frontend ? "liara-frontend" : pythonRuntime ? (pythonRuntime.command[1] === "-m" || manifest.some(file => file.path === pythonRuntime.command[1]) ? pythonStart(pythonRuntime) : null) : hasWorkspaces ? null : safeScript(scripts.start),
    build = dockerRuntime ? null : safeScript(scripts.build);
  const missing: string[] = [];
  if (separateApplicationRequirements({ applicationRequirements, ...(fullstack ? { fullstack } : {}), start, build }).length) missing.push("این پروژه بخش اجرایی مستقل هم دارد؛ ساخت و بررسی فقط فرانت برای انتشار کامل کافی نیست.");
  if (applicationRequirements.diagnostics.length) missing.push("بررسی برخی نیازهای برنامه کامل نشد؛ نتیجهٔ نامعلوم باید پیش از انتشار بررسی شود.");
  if (nativeExecutionRequired) missing.push("بخش سرور بومی شناسایی شده است؛ ساخت، منابع و معیار واقعی آن هنوز به executor متصل نشده‌اند. انتشار فرانت این بخش را کامل نمی‌کند.");
  if (fullstack?.requiresPreparation) missing.push("این پروژه فرانت و API مستقل دارد؛ فرمان شروع و ساخت کامل باید در نسخهٔ جدا آماده و آزموده شوند. تنظیم Docker موجود ممکن است فقط یک بخش را منتشر کند.");
  if (hasWorkspaces) missing.push("این پوشه چند بسته را مدیریت می‌کند؛ زیرپوشه همان برنامه قابل انتشار را انتخاب کنید.");
  if (next && !manifest.some(file => /^(?:src\/)?(?:app\/(?:\([^/]+\)\/)*page|pages\/index)\.[cm]?[jt]sx?$/.test(file.path))) missing.push("صفحهٔ اصلی Next در پوشهٔ انتخاب‌شده پیدا نشد؛ ریشهٔ همان برنامه را بررسی کنید.");
  if (next && !build) missing.push("فرمان ساخت Next در پروژه موجود نیست؛ پروژه پیش از انتشار به آماده‌سازی نیاز دارد.");
  if (!staticSite && !packageJson && !python && !dockerRuntime) missing.push("روش اجرای قابل انتشار هنوز مشخص نیست؛ شواهد پلتفرم را بررسی کنید.");
  if (!start) missing.push("دستور start مشخص نیست؛ قبل از انتشار آن را تعیین کنید.");
  if (port === null) missing.push("پورت قطعی نیست؛ پورت برنامه را وارد کنید.");
  if (packageJson && !nodeRuntime.version) missing.push(nodeRuntime.detail);
  if (envNames.size)
    missing.push("فقط نام envها شناسایی شد؛ مقدار و کافی‌بودن آن‌ها هنوز بررسی نشده است.");
  manifest.sort((a, b) => a.path.localeCompare(b.path, "en"));
  const profile: ProjectProfile = {
    directory,
    runtime: dockerRuntime ? "docker" : staticSite ? "static" : packageJson ? "node" : python ? "python" : "unknown",
    nodeVersion: dockerRuntime || python || staticSite ? null : nodeRuntime.requirement,
    ...(dockerRuntime ? { dockerRuntime } : staticSite ? { staticRuntime } : pythonRuntime ? { pythonRuntime } : { nodeRuntime }),
    ...(nativeInspection.state !== "not_applicable" ? { nativeInspection } : {}),
    ...(fullstack ? { fullstack } : {}),
    applicationRequirements,
    ...(usedFixtureReviews.length ? { sourceFixtureReviews: usedFixtureReviews } : {}),
    ...(nextRuntime ? { nextRuntime } : {}),
    ...(frontend && nodeRuntime.version === "20" ? { frontendRuntime: frontend } : {}),
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
