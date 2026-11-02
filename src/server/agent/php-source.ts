import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Agent } from "undici";
import { composerTool, phpUnzipTool } from "../../contracts/php-runtime.ts";
import { object, string } from "../../contracts/validation.ts";
import type { SourceFile } from "../workspace/inspect.ts";
import { ensure, AppError } from "../errors.ts";
import { abortable } from "../providers/http.ts";
import { isPublicAddress } from "../liara/probe.ts";

export const composerToolUrl = `https://getcomposer.org/download/${composerTool.version}/composer.phar`;
export type PhpReader = (url: string, signal: AbortSignal, limit: number, take?: () => void) => Promise<Buffer>;
export const phpRegistryRead: PhpReader = async (url, parent, limit, take) => {
  const signal = AbortSignal.any([parent, AbortSignal.timeout(60000)]);
  try {
    for (let redirects = 0; redirects <= 2; redirects++) {
      const target = new URL(url);
      ensure(target.protocol === "https:" && !target.username && !target.password && !target.port && !target.search && !target.hash &&
        (target.href === composerToolUrl || target.href === phpUnzipTool.url || target.origin === "https://codeload.github.com" && /^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/legacy[.]zip\/[a-f0-9]{40}$/.test(target.pathname) ||
          target.origin === "https://api.github.com" && /^\/repos\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/zipball\/[a-f0-9]{40}$/.test(target.pathname)), "PHP_REGISTRY_DENIED", "فقط ابزار تثبیت‌شده و dist عمومی GitHub با commit دقیق مجاز است.", 403);
      const addresses = await abortable(() => lookup(target.hostname, { all: true, family: 4 }), signal), address = addresses[0];
      ensure(address && addresses.every(row => isPublicAddress({ address: row.address, family: 4 })), "PHP_REGISTRY_DENIED", "نشانی مخزن PHP عمومی نیست.", 403);
      const dispatcher = new Agent({ connect: { family: 4, lookup: (_host, _options, callback) => callback(null, address.address, 4) }, connectTimeout: 30000 });
      try {
        take?.(); const options: RequestInit & { dispatcher: Agent } = { signal, redirect: "manual", cache: "no-store", dispatcher, headers: { "Accept-Encoding": "identity", "User-Agent": "Launchlane-LockedBuild/1" } }, response = await fetch(target, options);
        if ([301, 302, 303, 307, 308].includes(response.status)) { await response.body?.cancel(); const location = response.headers.get("location"); ensure(location && redirects < 2, "PHP_REGISTRY_DENIED", "تغییر مقصد dist قابل بررسی نیست.", 403); url = new URL(location, target).href; continue; }
        if (!response.ok) { await response.body?.cancel(); throw new AppError("PHP_REGISTRY_UNAVAILABLE", `دریافت dependency عمومی PHP کامل نشد (HTTP ${response.status})؛ credential یا VCS جایگزین نمی‌شود.`, 502, true); }
        const chunks: Buffer[] = []; let bytes = 0;
        for await (const part of response.body ?? []) { bytes += part.length; ensure(bytes <= limit, "PHP_DEPENDENCY_LIMIT", "حجم dependency PHP از سقف بیشتر است.", 413); chunks.push(Buffer.from(part)); } return Buffer.concat(chunks);
      } finally { await dispatcher.destroy(); }
    }
    throw new AppError("PHP_REGISTRY_DENIED", "تغییر مقصد dist بیش از سقف است.", 403);
  } catch (error) { if (error instanceof AppError) throw error; throw new AppError("PHP_REGISTRY_UNAVAILABLE", "دریافت dependency PHP کامل نشد؛ ساخت تأیید نشده است.", 502, true); }
};

export function phpDistRequests(files: readonly SourceFile[]) {
  const source = files.find(file => file.path === "composer.lock"); ensure(source, "PHP_LOCK_REQUIRED", "composer.lock اصلی لازم است.", 409);
  let lock: Record<string, unknown>;
  try { lock = object(JSON.parse(source.content.toString("utf8"))); } catch { throw new AppError("PHP_LOCK_UNSUPPORTED", "ساختار composer.lock معتبر نیست.", 409); }
  const prod = lock.packages, dev = lock["packages-dev"] ?? [], result: { name: string; url: string; downloadUrl: string; sha1: string; cachePath: string }[] = [], names = new Set<string>();
  ensure(Array.isArray(prod) && Array.isArray(dev) && prod.length + dev.length <= 256, "PHP_LOCK_UNSUPPORTED", "فهرست packageهای قفل‌شده باید محدود و معتبر باشد.", 409);
  for (const input of [...prod, ...dev]) {
    const row = object(input), name = string(row.name, 200); ensure(/^[a-z0-9][a-z0-9_.-]*\/[a-z0-9][a-z0-9_.-]*$/.test(name) && !names.has(name), "PHP_LOCK_UNSUPPORTED", "هویت package باید یکتا و صریح باشد.", 409); names.add(name);
    if (row.type === "metapackage" && row.dist === undefined) continue;
    const dist = object(row.dist), reference = string(dist.reference, 40), sha1 = dist.shasum === undefined || dist.shasum === "" ? "" : string(dist.shasum, 40);
    let url: URL; try { url = new URL(string(dist.url, 2048)); } catch { throw new AppError("PHP_DIST_UNSUPPORTED", "نشانی dist معتبر نیست.", 409); }
    const match = /^\/repos\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/zipball\/([a-f0-9]{40})$/.exec(url.pathname);
    ensure(dist.type === "zip" && /^[a-f0-9]{40}$/.test(reference) && (!sha1 || /^[a-f0-9]{40}$/.test(sha1)) && url.origin === "https://api.github.com" && !url.username && !url.password && !url.port && !url.search && !url.hash && match?.[3] === reference,
      "PHP_DIST_UNSUPPORTED", "dist عمومی ZIP باید به همان commit قفل‌شده متصل باشد؛ git، path و registry خصوصی اجرا نمی‌شوند.", 409);
    result.push({ name, url: url.href, downloadUrl: `https://codeload.github.com/${match[1]}/${match[2]}/legacy.zip/${reference}`, sha1, cachePath: `files/${name}/${createHash("sha1").update(url.href).digest("hex")}.zip` });
  }
  return result;
}

export async function preparePhpDependencies(files: readonly SourceFile[], input: string, stateDir: string, signal: AbortSignal, take: () => void, read: PhpReader = phpRegistryRead) {
  await mkdir(input, { recursive: true });
  for (const item of [{ ...composerTool, url: composerToolUrl, file: "composer.phar" }, { ...phpUnzipTool, file: "unzip.deb" }]) {
    const cached = join(stateDir, `php-tool-${item.sha256}`); let bytes: Buffer | null = null;
    try { const stat = await lstat(cached); ensure(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && stat.size === item.bytes, "PHP_TOOLCHAIN_CHANGED", "فایل ابزار PHP تغییر کرده است.", 409); bytes = await readFile(cached, { signal }); } catch (error) { if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error; }
    if (!bytes) bytes = await read(item.url, signal, item.bytes, take);
    ensure(bytes.length === item.bytes && createHash("sha256").update(bytes).digest("hex") === item.sha256, "PHP_TOOLCHAIN_CHANGED", "ابزار PHP با checksum تثبیت‌شده برابر نیست.", 409);
    try { await writeFile(cached, bytes, { flag: "wx", mode: 0o600, signal }); } catch (error) { if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error; }
    await writeFile(join(input, item.file), bytes, { flag: "wx", mode: 0o600, signal });
  }
  let total = 0;
  for (const item of phpDistRequests(files)) {
    const bytes = await read(item.downloadUrl, signal, 32 * 1024 * 1024, take); total += bytes.length;
    ensure(bytes.length > 4 && bytes.length <= 32 * 1024 * 1024 && total <= 256 * 1024 * 1024 && bytes.subarray(0, 2).toString() === "PK" && (!item.sha1 || createHash("sha1").update(bytes).digest("hex") === item.sha1), "PHP_DIST_CHANGED", "بایت‌های dist با lock یا محدودیت نصب برابر نیستند.", 409);
    const path = join(input, "cache", item.cachePath); await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes, { flag: "wx", mode: 0o600, signal });
  }
}
