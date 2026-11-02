import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { Agent } from "undici";
import { abortable } from "../providers/http.ts";
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { goToolchain } from "../../contracts/go-runtime.ts";
import type { SourceFile } from "../workspace/inspect.ts";
import { ensure, AppError } from "../errors.ts";
import { isPublicAddress } from "../liara/probe.ts";

export const goToolchainUrl = `https://dl.google.com/go/${goToolchain.filename}`;
export type GoReader = (url: string, signal: AbortSignal, limit: number, take?: () => void) => Promise<Buffer>;
const readGoUrl: GoReader = async (url, signal, limit, take) => {
  const bounded = AbortSignal.any([signal, AbortSignal.timeout(limit > 20 * 1024 * 1024 ? 120000 : 30000)]);
  try {
    for (let redirects = 0; redirects <= 2; redirects++) {
      const target = new URL(url);
      ensure(target.protocol === "https:" && !target.username && !target.password && !target.port && !target.hash &&
        (target.origin === "https://dl.google.com" && target.href === goToolchainUrl || target.origin === "https://mirrors.aliyun.com" && target.pathname === `/golang/${goToolchain.filename}` && !target.search ||
          ["https://proxy.golang.org", "https://goproxy.cn"].includes(target.origin) && !target.search ||
          target.origin === "https://storage.googleapis.com" && target.pathname.startsWith("/proxy-golang-org-prod/")), "GO_REGISTRY_DENIED", "فقط مخزن عمومی و toolchain ثابت Go مجاز است.", 403);
      const addresses = await abortable(() => lookup(target.hostname, { all: true, family: 4 }), bounded);
      ensure(addresses.length > 0 && addresses.every(row => (row.family === 4 || row.family === 6) && isPublicAddress({ address: row.address, family: row.family })), "GO_REGISTRY_DENIED", "نشانی مخزن Go عمومی نیست.", 403);
      const address = addresses[0]; ensure(address, "GO_REGISTRY_DENIED", "نشانی عمومی Go موجود نیست.", 403);
      const dispatcher = new Agent({ connect: { family: 4, lookup: (_host, _options, callback) => callback(null, address.address, 4) },
        connectTimeout: 30000, headersTimeout: 120000, bodyTimeout: 120000 });
      try {
      // Pin the reviewed public DNS address while TLS authenticates the original host.
      const options: RequestInit & { dispatcher: Agent } = { signal: bounded, redirect: "manual", cache: "no-store", dispatcher,
        headers: { "Accept-Encoding": "identity", "User-Agent": "Launchlane-LockedBuild/1" } };
      take?.(); const response = await fetch(target, options);
      if ([301, 302, 303, 307, 308].includes(response.status)) { await response.body?.cancel(); const location = response.headers.get("location"); ensure(redirects < 2 && location, "GO_REGISTRY_DENIED", "تغییر مقصد مخزن Go قابل تأیید نیست.", 403); url = new URL(location, target).href; continue; }
      if (!response.ok) { await response.body?.cancel(); throw new AppError("GO_REGISTRY_UNAVAILABLE", `وابستگی عمومی Go دریافت نشد (HTTP ${response.status})؛ VCS یا credential جایگزین نمی‌شود.`, 502, true); }
      const chunks: Buffer[] = []; let bytes = 0;
      for await (const chunk of response.body ?? []) { bytes += chunk.length; ensure(bytes <= limit, "GO_DEPENDENCY_LIMIT", "حجم dependency Go از سقف بیشتر است.", 413); chunks.push(Buffer.from(chunk)); }
      return Buffer.concat(chunks);
      } finally { await dispatcher.destroy(); }
    }
    throw new AppError("GO_REGISTRY_DENIED", "تغییر مقصد مخزن Go بیش از سقف است.", 403);
  } catch (error) { if (error instanceof AppError) throw error; throw new AppError("GO_REGISTRY_UNAVAILABLE", "ارتباط مخزن Go کامل نشد؛ ساخت تأیید نشده است.", 502, true); }
};
export const goRegistryRead: GoReader = async (url, signal, limit, take) => {
  try { return await readGoUrl(url, signal, limit, take); }
  catch (error) {
    if (!(error instanceof AppError) || error.code !== "GO_REGISTRY_UNAVAILABLE" || signal.aborted) throw error;
    // A read-only mirror cannot change identity: the tool has a fixed official SHA;
    // module bytes still have to pass the original go.sum in the offline Go command.
    const fallback = url === goToolchainUrl ? `https://mirrors.aliyun.com/golang/${goToolchain.filename}` :
      url.startsWith("https://proxy.golang.org/") ? url.replace("https://proxy.golang.org/", "https://goproxy.cn/") : null;
    if (!fallback) throw error;
    return readGoUrl(fallback, signal, limit, take);
  }
};

export function goModuleRequests(files: readonly SourceFile[]) {
  const sum = files.find(file => file.path === "go.sum")?.content.toString("utf8") ?? "";
  ensure(Buffer.byteLength(sum) <= 65536, "GO_DEPENDENCY_LIMIT", "go.sum بیش از سقف این worker است.", 413);
  const entries = new Map<string, { path: string; version: string; zip: boolean }>(), identities = new Set<string>();
  for (const line of sum.split(/\r?\n/).filter(line => line.trim())) {
    const match = /^(\S+) (v[0-9][A-Za-z0-9.+-]*)(\/go\.mod)? h1:([A-Za-z0-9+/]{43}=)$/.exec(line);
    ensure(match?.[1] && match[2] && /^[A-Za-z0-9][A-Za-z0-9._~/-]*$/.test(match[1]) && match[1].includes(".") && match[1].split("/").every(part => part && part !== "." && part !== ".."), "GO_LOCK_UNSUPPORTED", "مسیر و checksum عمومی go.sum باید معتبر و تثبیت‌شده باشند.", 409);
    const identity = `${match[1]} ${match[2]}${match[3] ?? ""}`; ensure(!identities.has(identity), "GO_LOCK_UNSUPPORTED", "checksum تکراری یا مبهم در go.sum مجاز نیست.", 409); identities.add(identity);
    const path = match[1].replace(/[A-Z]/g, letter => `!${letter.toLowerCase()}`), version = match[2].replace(/[A-Z]/g, letter => `!${letter.toLowerCase()}`), key = `${path}/@v/${version}`;
    const previous = entries.get(key); entries.set(key, { path, version, zip: !match[3] || previous?.zip === true });
  }
  ensure(entries.size <= 128, "GO_DEPENDENCY_LIMIT", "تعداد نسخه‌های module از سقف این worker بیشتر است.", 413);
  return [...entries.values()].sort((a, b) => `${a.path}/${a.version}`.localeCompare(`${b.path}/${b.version}`, "en"));
}

export async function prepareGoDependencies(files: readonly SourceFile[], directory: string, stateDir: string, signal: AbortSignal, take: () => void, read: GoReader = goRegistryRead) {
  const tool = join(stateDir, `go-${goToolchain.sha256}.tar.gz`);
  let toolBytes: Buffer | null = null;
  try { const stat = await lstat(tool); ensure(stat.isFile() && !stat.isSymbolicLink() && stat.size === goToolchain.bytes, "GO_TOOLCHAIN_CHANGED", "فایل toolchain تغییر کرده است.", 409); toolBytes = await readFile(tool, { signal }); }
  catch (error) { if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error; }
  if (!toolBytes) toolBytes = await read(goToolchainUrl, signal, goToolchain.bytes, take);
  ensure(toolBytes.length === goToolchain.bytes && createHash("sha256").update(toolBytes).digest("hex") === goToolchain.sha256, "GO_TOOLCHAIN_CHANGED", "بایت‌های toolchain با checksum ثابت Go برابر نیستند.", 409);
  try { await writeFile(tool, toolBytes, { flag: "wx", mode: 0o600, signal }); } catch (error) { if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error; }
  await mkdir(join(directory, "proxy"), { recursive: true }); let total = 0;
  for (const entry of goModuleRequests(files)) for (const extension of entry.zip ? ["mod", "info", "zip"] : ["mod", "info"]) {
    const relative = `${entry.path}/@v/${entry.version}.${extension}`, limit = extension === "zip" ? 20 * 1024 * 1024 : 1024 * 1024;
    const bytes = await read(`https://proxy.golang.org/${relative}`, signal, limit, take); total += bytes.length;
    ensure(bytes.length <= limit && total <= 128 * 1024 * 1024, "GO_DEPENDENCY_LIMIT", "حجم moduleهای Go از سقف بیشتر است.", 413);
    const target = join(directory, "proxy", relative); await mkdir(dirname(target), { recursive: true }); await writeFile(target, bytes, { flag: "wx", mode: 0o600, signal });
  }
  return tool;
}
