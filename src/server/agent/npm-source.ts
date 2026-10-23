import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { mkdir, writeFile } from "node:fs/promises";
import { request } from "node:https";
import { join } from "node:path";
import { object, string } from "../../contracts/validation.ts";
import { AppError, ensure } from "../errors.ts";
import { isPublicAddress } from "../liara/probe.ts";
import type { SourceFile } from "../workspace/inspect.ts";
import { abortable } from "../providers/http.ts";

export type LockedTarball = { url: string; integrity: string; algorithm: "sha512" | "sha256"; digest: string; file: string };
export const dependencyByteLimit = 384 * 1024 * 1024;
const tarballByteLimit = 64 * 1024 * 1024;

function compatible(value: unknown, platform: string): boolean {
  if (value === undefined) return true;
  ensure(Array.isArray(value) && value.every(item => typeof item === "string"), "BUILD_LOCK_INVALID", "محدودیت سکوی dependency معتبر نیست.");
  const entries: string[] = value;
  return !entries.includes(`!${platform}`) && (!entries.some(item => !item.startsWith("!")) || entries.includes(platform) || entries.includes("any"));
}

export function lockedTarballs(files: readonly SourceFile[]): LockedTarball[] {
  const source = files.find(file => file.path === "package-lock.json");
  ensure(source, "BUILD_LOCK_REQUIRED", "برای نصب قابل تکرار، package-lock.json همان برنامه لازم است.", 409);
  const lock = object(JSON.parse(source.content.toString("utf8"))), packages = object(lock.packages);
  ensure(lock.lockfileVersion === 3 && Object.keys(packages).length <= 2048,
    "BUILD_LOCK_UNSUPPORTED", "نصب قابل‌تکرار به lockfile نسخه ۳ با حداکثر ۲۰۴۸ ورودی نیاز دارد؛ حجم dependency و مهلت هم جدا کنترل می‌شوند.", 409);
  const result = new Map<string, LockedTarball>(), urlDigests = new Map<string, string>();
  for (const [path, value] of Object.entries(packages)) {
    if (path === "") continue;
    const row = object(value);
    ensure(path.startsWith("node_modules/") && !path.split("/").some(part => part === "." || part === "..") && row.link !== true,
      "BUILD_LOCK_UNSUPPORTED", "dependency محلی، workspace یا پیوندی در این قرارداد نصب نمی‌شود.", 409);
    if (!compatible(row.os, "linux") || !compatible(row.cpu, "x64") || !compatible(row.libc, "glibc")) continue;
    if (row.inBundle === true && row.resolved === undefined) continue;
    const url = new URL(string(row.resolved, 2048));
    ensure(url.origin === "https://registry.npmjs.org" && !url.username && !url.password && !url.search && !url.hash && url.pathname.endsWith(".tgz"),
      "BUILD_REGISTRY_DENIED", "این قرارداد فقط tarball عمومی registry رسمی npm را از lockfile می‌خواند؛ credential registry وارد worker نمی‌شود.", 403);
    const integrity = string(row.integrity, 128), match = /^(sha512|sha256)-([A-Za-z0-9+/]+={0,2})$/.exec(integrity);
    ensure(match && (match[1] === "sha512" || match[1] === "sha256"), "BUILD_INTEGRITY_REQUIRED", "هش integrity قفل‌شده dependency لازم است.", 409);
    const digest = match[2] ?? "", algorithm = match[1];
    ensure(Buffer.from(digest, "base64").length === (algorithm === "sha512" ? 64 : 32) && Buffer.from(digest, "base64").toString("base64") === digest,
      "BUILD_INTEGRITY_REQUIRED", "هش dependency معتبر نیست.", 409);
    const previous = urlDigests.get(url.href);
    ensure(!previous || previous === integrity, "BUILD_LOCK_INVALID", "یک dependency با دو هش ناسازگار تعریف شده است.");
    urlDigests.set(url.href, integrity);
    result.set(integrity, { url: url.href, integrity, digest, algorithm, file: `${createHash("sha256").update(integrity).digest("hex")}.tgz` });
  }
  return [...result.values()];
}

export type TarballReader = (item: LockedTarball, signal: AbortSignal) => Promise<Buffer>;
export const registryTarball: TarballReader = async (item, signal) => {
  try {
  const addresses = await abortable(() => lookup("registry.npmjs.org", { all: true, family: 4 }), signal);
  ensure(addresses.length > 0 && addresses.every(entry => isPublicAddress({ address: entry.address, family: 4 })),
    "BUILD_DNS_DENIED", "آدرس شبکه registry عمومی نیست.", 403);
  const address = addresses[0];
  ensure(address, "BUILD_DNS_DENIED", "آدرس registry در دسترس نیست.", 503);
  return await new Promise((resolve, reject) => {
    // Pin the validated address while TLS still authenticates the official registry hostname.
    const req = request(item.url, { signal, family: 4, maxHeaderSize: 8192,
      lookup: (_hostname, _options, callback) => callback(null, address.address, 4),
      headers: { Accept: "application/octet-stream", "Accept-Encoding": "identity", "User-Agent": "Launchlane-LockedBuild/1" } }, response => {
      if (response.statusCode !== 200) {
        response.destroy(); reject(new AppError("BUILD_DEPENDENCY_UNAVAILABLE", "دریافت dependency قفل‌شده کامل نشد؛ build اجرا نشده است.", 502, true)); return;
      }
      let bytes = 0;
      const chunks: Buffer[] = [];
      response.on("data", (part: Buffer) => {
        bytes += part.length;
        if (bytes > tarballByteLimit) { response.destroy(new AppError("BUILD_DEPENDENCY_LIMIT", "حجم یک dependency از سقف مجاز بیشتر است.", 413)); return; }
        chunks.push(part);
      });
      response.once("error", reject);
      response.once("end", () => resolve(Buffer.concat(chunks)));
    });
    req.once("error", reject); req.end();
  });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("BUILD_DEPENDENCY_UNAVAILABLE", "خواندن dependency قفل‌شده به نتیجه نرسید؛ script اجرا نشده و source تغییر نکرده است.", 503, true);
  }
};

export async function downloadLockedTarballs(items: readonly LockedTarball[], directory: string, signal: AbortSignal,
  beforeRead: () => void = () => {}, read: TarballReader = registryTarball): Promise<number> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const controller = new AbortController(), bounded = AbortSignal.any([signal, controller.signal]);
  let next = 0, total = 0, failure: unknown;
  const worker = async () => {
    while (next < items.length && !bounded.aborted) {
      const item = items[next++];
      if (!item) return;
      beforeRead();
      const deadline = AbortSignal.any([bounded, AbortSignal.timeout(90000)]);
      const bytes = await abortable(() => read(item, deadline), deadline);
      ensure(!bounded.aborted, "CANCELLED", "دریافت dependency متوقف شد.", 409);
      total += bytes.length;
      ensure(bytes.length <= tarballByteLimit && total <= dependencyByteLimit, "BUILD_DEPENDENCY_LIMIT", "حجم dependencyها از سقف این آماده‌سازی بیشتر است.", 413);
      ensure(createHash(item.algorithm).update(bytes).digest("base64") === item.digest,
        "BUILD_INTEGRITY_MISMATCH", "بایت‌های dependency با lockfile برابر نیست؛ اجرا متوقف شد.", 409);
      await writeFile(join(directory, item.file), bytes, { flag: "wx", mode: 0o600 });
    }
  };
  // All in-flight downloads settle before the caller can dispose of this job's directory.
  await Promise.allSettled(Array.from({ length: Math.min(4, items.length) }, () => worker().catch(error => {
    if (!controller.signal.aborted) { failure = error; controller.abort(); }
    throw error;
  })));
  if (failure !== undefined) throw failure;
  ensure(!signal.aborted, "CANCELLED", "دریافت dependency متوقف شد.", 409);
  await writeFile(join(directory, "manifest.json"), JSON.stringify(items.map(({ file, algorithm, integrity }) => ({ file, algorithm, integrity }))), { flag: "wx", mode: 0o600 });
  return total;
}
