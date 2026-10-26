import { createHash, randomUUID } from "node:crypto";
import { constants, type BigIntStats } from "node:fs";
import { link, lstat, mkdir, open, opendir, realpath, unlink, type FileHandle } from "node:fs/promises";
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from "node:path";
import { hasControl } from "../../contracts/validation.ts";
import { AppError, ensure } from "../errors.ts";
import { abortable } from "../providers/http.ts";
import type { LockedTarball } from "./npm-source.ts";

export const npmCacheByteLimit = 512 * 1024 * 1024;
export const npmCacheEntryLimit = 4096;
const tarballLimit = 64 * 1024 * 1024, indexLimit = 512 * 1024;
const indexName = ".quota-v1", lockName = ".write-lock", header = "LAUNCHLANE_NPM_CACHE_V1\n", initialized = "INITIALIZED";
const filename = /^[a-f0-9]{64}\.tgz$/;
type Anchor = { path: string; stat: BigIntStats };
type Regular = { bytes: Buffer; stat: BigIntStats };
const queues = new Map<string, { tail: Promise<void>; count: number }>();
const failure = () => new AppError("NPM_CACHE_UNAVAILABLE", "کش dependency قابل خواندن یا نگهداری نیست؛ محتوا تأیید نشد.", 503);
function stop(signal?: AbortSignal): void { ensure(!signal?.aborted, "CANCELLED", "عملیات کش dependency لغو شد.", 409); }
function missing(error: unknown): boolean { return error instanceof Error && "code" in error && error.code === "ENOENT"; }
function exists(error: unknown): boolean { return error instanceof Error && "code" in error && error.code === "EEXIST"; }
function same(a: BigIntStats, b: BigIntStats): boolean { return a.dev === b.dev && a.ino === b.ino; }
function samePath(a: string, b: string): boolean { return process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b; }
function rootPath(root: string): string {
  ensure(typeof root === "string" && root.length <= 4096 && isAbsolute(root) && !hasControl(root) && !root.startsWith("\\\\"),
    "NPM_CACHE_PATH_DENIED", "کش فقط مسیر محلی و صریح اپراتور را می‌پذیرد.", 409);
  const path = resolve(root);
  ensure(path !== parse(path).root, "NPM_CACHE_PATH_DENIED", "ریشهٔ دیسک محل کش dependency نیست.", 409);
  return path;
}
function validateItem(item: LockedTarball): void {
  ensure(item && (item.algorithm === "sha512" || item.algorithm === "sha256") && typeof item.digest === "string" && item.digest.length <= 88 && typeof item.file === "string" &&
    /^[A-Za-z0-9+/]+={0,2}$/.test(item.digest) && Buffer.from(item.digest, "base64").length === (item.algorithm === "sha512" ? 64 : 32) &&
    Buffer.from(item.digest, "base64").toString("base64") === item.digest && item.integrity === `${item.algorithm}-${item.digest}` &&
    filename.test(item.file) && item.file === `${createHash("sha256").update(item.integrity).digest("hex")}.tgz`,
    "BUILD_INTEGRITY_REQUIRED", "هویت content و integrity قفل‌شدهٔ dependency معتبر نیست.", 409);
  let url: URL;
  try { url = new URL(item.url); } catch { throw new AppError("BUILD_REGISTRY_DENIED", "کش فقط dependency عمومی قفل‌شدهٔ npm را می‌پذیرد.", 403); }
  ensure(url.origin === "https://registry.npmjs.org" && !url.username && !url.password && !url.search && !url.hash && url.pathname.endsWith(".tgz"),
    "BUILD_REGISTRY_DENIED", "کش فقط dependency عمومی قفل‌شدهٔ npm را می‌پذیرد.", 403);
}
function verify(bytes: Buffer, item: LockedTarball): void {
  ensure(bytes.length <= tarballLimit, "BUILD_DEPENDENCY_LIMIT", "حجم dependency از سقف مجاز بیشتر است.", 413);
  ensure(createHash(item.algorithm).update(bytes).digest("base64") === item.digest,
    "BUILD_INTEGRITY_MISMATCH", "بایت‌های کش با lockfile برابر نیست؛ استفاده یا دانلود جایگزین خودکار مجاز نیست.", 409);
}
async function guarded<T>(work: () => Promise<T>): Promise<T> {
  try { return await work(); } catch (error) { if (error instanceof AppError) throw error; throw failure(); }
}
async function serial<T>(root: string, signal: AbortSignal, work: () => Promise<T>): Promise<T> {
  stop(signal);
  const key = process.platform === "win32" ? root.toLowerCase() : root, previous = queues.get(key);
  ensure(!previous || previous.count < 8, "NPM_CACHE_BUSY", "صف کش dependency پر است؛ درخواست شبکه‌ای جایگزین نشد.", 409);
  const state = previous ?? { tail: Promise.resolve(), count: 0 }; state.count++;
  const current = state.tail.then(() => { stop(signal); return work(); });
  state.tail = current.then(() => undefined, () => undefined); queues.set(key, state);
  void current.then(() => undefined, () => undefined).then(() => { if (--state.count === 0 && queues.get(key) === state) queues.delete(key); });
  return abortable(() => current, signal);
}
async function anchors(path: string, create: boolean, signal?: AbortSignal): Promise<Anchor[] | null> {
  const base = parse(path).root, parts = relative(base, path).split(sep).filter(Boolean), result: Anchor[] = [];
  let current = base;
  for (let index = -1; index < parts.length; index++) {
    stop(signal); if (index >= 0) current = join(current, parts[index] ?? "");
    let stat: BigIntStats;
    try { stat = await lstat(current, { bigint: true }); }
    catch (error) {
      if (!missing(error)) throw error;
      if (!create) return null;
      if (result.length) await unchanged(result);
      await mkdir(current, { mode: 0o700 }).catch((error: unknown) => { if (!exists(error)) throw error; });
      stat = await lstat(current, { bigint: true });
    }
    ensure(stat.isDirectory() && !stat.isSymbolicLink() && samePath(await realpath(current), current),
      "NPM_CACHE_PATH_DENIED", "مسیر کش شامل پیوند یا پوشهٔ نامعتبر است.", 409);
    result.push({ path: current, stat });
  }
  return result;
}
async function unchanged(values: readonly Anchor[], signal?: AbortSignal): Promise<void> {
  for (const value of values) {
    stop(signal); const now = await lstat(value.path, { bigint: true });
    ensure(now.isDirectory() && !now.isSymbolicLink() && same(now, value.stat) && samePath(await realpath(value.path), value.path),
      "NPM_CACHE_PATH_DENIED", "مسیر کش هنگام عملیات تغییر کرده است.", 409);
  }
}
function regular(stat: BigIntStats, limit: number): void {
  ensure(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1n, "NPM_CACHE_PATH_DENIED", "فایل کش باید regular و بدون پیوند باشد.", 409);
  ensure(stat.size >= 0n && stat.size <= BigInt(limit), "NPM_CACHE_LIMIT", "حجم فایل کش از سقف مجاز بیشتر است.", 413);
}
async function readHandle(file: FileHandle, size: number, signal: AbortSignal): Promise<Buffer> {
  const bytes = Buffer.alloc(size + 1); let length = 0;
  while (length < bytes.length) { stop(signal); const read = await file.read(bytes, length, bytes.length - length, length); if (!read.bytesRead) break; length += read.bytesRead; }
  return bytes.subarray(0, length);
}
async function readRegular(path: string, limit: number, parents: readonly Anchor[], signal: AbortSignal): Promise<Regular | null> {
  stop(signal); let before: BigIntStats;
  try { before = await lstat(path, { bigint: true }); }
  catch (error) { if (!missing(error)) throw error; await unchanged(parents, signal); return null; }
  regular(before, limit);
  ensure(samePath(await realpath(path), path), "NPM_CACHE_PATH_DENIED", "فایل کش در مسیر canonical خودش نیست.", 409);
  const file = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0) | (constants.O_NONBLOCK || 0));
  try {
    const opened = await file.stat({ bigint: true }); regular(opened, limit);
    ensure(same(opened, before) && opened.size === before.size && opened.mtimeNs === before.mtimeNs && opened.ctimeNs === before.ctimeNs, "NPM_CACHE_PATH_DENIED", "فایل کش هنگام بازشدن تغییر کرده است.", 409);
    const bytes = await readHandle(file, Number(before.size), signal), after = await file.stat({ bigint: true }), named = await lstat(path, { bigint: true });
    regular(after, limit); regular(named, limit);
    ensure(bytes.length === Number(before.size) && same(after, before) && same(named, before) && after.size === before.size && named.size === before.size &&
      after.mtimeNs === before.mtimeNs && after.ctimeNs === before.ctimeNs && named.mtimeNs === before.mtimeNs && named.ctimeNs === before.ctimeNs && samePath(await realpath(path), path),
      "NPM_CACHE_PATH_DENIED", "فایل کش هنگام خواندن تغییر کرده است.", 409);
    await unchanged(parents, signal); return { bytes, stat: after };
  } finally { await file.close(); }
}
async function readTarball(path: string, item: LockedTarball, parents: readonly Anchor[], signal: AbortSignal): Promise<Buffer | null> {
  const value = await readRegular(path, tarballLimit, parents, signal);
  if (!value) return null; verify(value.bytes, item); return value.bytes;
}
export async function readNpmCacheTarball(root: string, item: LockedTarball, signal: AbortSignal): Promise<Buffer | null> {
  return guarded(async () => {
    validateItem(item); const path = rootPath(root);
    return serial(path, signal, async () => {
      const parents = await anchors(path, false, signal); if (!parents) return null;
      const bytes = await readTarball(join(path, item.file), item, parents, signal);
      if (!bytes && await readRegular(join(path, lockName), 0, parents, signal)) throw new AppError("NPM_CACHE_BUSY", "نوشتن قبلی کش هنوز تعیین تکلیف نشده است؛ miss فرض نشد.", 409);
      return bytes;
    });
  });
}

/** Explicit _cacache root only. cacache 20.0.4 lib/content/path.js and hash-to-segments.js;
 * content-v2 is addressed by the locked digest, never by npm's mutable URL index. Read-only, no discovery.
 */
export async function readNpmContentCacheTarball(root: string, item: LockedTarball, signal: AbortSignal): Promise<Buffer | null> {
  return guarded(async () => {
    stop(signal); validateItem(item); const path = rootPath(root), hex = Buffer.from(item.digest, "base64").toString("hex");
    const target = join(path, "content-v2", item.algorithm, hex.slice(0, 2), hex.slice(2, 4), hex.slice(4)), parents = await anchors(dirname(target), false, signal);
    return parents ? readTarball(target, item, parents, signal) : null;
  });
}
async function removeOwned(path: string, owned: BigIntStats, parents: readonly Anchor[]): Promise<void> {
  await unchanged(parents);
  let stat: BigIntStats;
  try { stat = await lstat(path, { bigint: true }); } catch (error) { if (missing(error)) return; throw error; }
  ensure(stat.isFile() && !stat.isSymbolicLink() && same(stat, owned) && samePath(await realpath(path), path), "NPM_CACHE_PATH_DENIED", "فایل موقت کش تغییر مالکیت داده است و حذف نشد.", 409);
  await unlink(path);
}
async function reserve(root: string, item: LockedTarball, size: number, parents: readonly Anchor[], signal: AbortSignal): Promise<void> {
  const path = join(root, indexName); let data = await readRegular(path, indexLimit, parents, signal);
  if (!data) {
    const entries: [string, number][] = []; let bytes = 0;
    const directory = await opendir(root);
    for await (const entry of directory) {
      stop(signal); if (entry.name === lockName) continue;
      ensure(filename.test(entry.name) && entries.length < npmCacheEntryLimit, "NPM_CACHE_LIMIT", "کش فایل ناشناخته یا بیش از سقف دارد؛ پاک‌سازی خودکار انجام نشد.", 413);
      const target = join(root, entry.name), stat = await lstat(target, { bigint: true }); regular(stat, tarballLimit);
      ensure(samePath(await realpath(target), target), "NPM_CACHE_PATH_DENIED", "فایل کش در مسیر خودش نیست.", 409);
      bytes += Number(stat.size); entries.push([entry.name, Number(stat.size)]);
      ensure(bytes + indexLimit <= npmCacheByteLimit, "NPM_CACHE_LIMIT", "ظرفیت کش dependency پر است.", 413);
    }
    const records = entries.sort(([a], [b]) => a.localeCompare(b)).map(([name, bytes]) => `${name} ${bytes}\n`).join("");
    const initial = Buffer.from(`${header}${records}${initialized}\n`);
    const file = await open(path, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | (constants.O_NOFOLLOW || 0), 0o600);
    try { stop(signal); await file.writeFile(initial); await file.sync(); } finally { await file.close(); }
    data = await readRegular(path, indexLimit, parents, signal);
  }
  ensure(data, "NPM_CACHE_UNAVAILABLE", "دفتر سهمیهٔ کش موجود نیست.", 503);
  const text = data.bytes.toString("utf8"), entries = new Map<string, number>(); let occupied = 0;
  ensure(text.startsWith(header) && text.endsWith("\n"), "NPM_CACHE_UNAVAILABLE", "دفتر سهمیهٔ کش ناقص است؛ بازنشانی نشد.", 503);
  const records = text.slice(header.length, -1).split("\n");
  ensure(records.filter(line => line === initialized).length === 1, "NPM_CACHE_UNAVAILABLE", "ثبت اولیهٔ سهمیهٔ کش کامل نشده است؛ بازنشانی نشد.", 503);
  for (const line of records.filter(line => line !== initialized)) {
    const match = /^([a-f0-9]{64}\.tgz) (0|[1-9][0-9]{0,7})$/.exec(line), name = match?.[1], value = Number(match?.[2]);
    ensure(name && !entries.has(name) && Number.isSafeInteger(value) && value <= tarballLimit && entries.size < npmCacheEntryLimit,
      "NPM_CACHE_UNAVAILABLE", "دفتر سهمیهٔ کش نامعتبر است؛ بازنشانی نشد.", 503);
    entries.set(name, value); occupied += value;
  }
  ensure(occupied + indexLimit <= npmCacheByteLimit, "NPM_CACHE_LIMIT", "ظرفیت کش dependency پر است.", 413);
  const reserved = entries.get(item.file);
  if (reserved !== undefined) { ensure(reserved === size, "NPM_CACHE_UNAVAILABLE", "اندازهٔ رزرو‌شدهٔ content کش تغییر کرده است.", 503); return; }
  ensure(entries.size < npmCacheEntryLimit && occupied + size + indexLimit <= npmCacheByteLimit, "NPM_CACHE_LIMIT", "ظرفیت کش dependency پر است؛ داده‌ای حذف نشد.", 413);
  const record = Buffer.from(`${item.file} ${size}\n`);
  ensure(data.bytes.length + record.length <= indexLimit, "NPM_CACHE_LIMIT", "دفتر سهمیهٔ کش به سقف رسیده است.", 413);
  const file = await open(path, constants.O_RDWR | (constants.O_NOFOLLOW || 0) | (constants.O_NONBLOCK || 0));
  try {
    const stat = await file.stat({ bigint: true }); regular(stat, indexLimit);
    ensure(same(stat, data.stat) && stat.size === data.stat.size && stat.mtimeNs === data.stat.mtimeNs && stat.ctimeNs === data.stat.ctimeNs,
      "NPM_CACHE_PATH_DENIED", "دفتر سهمیهٔ کش هنگام رزرو تغییر کرده است.", 409);
    stop(signal); await file.write(record, 0, record.length, Number(stat.size)); await file.sync();
    ensure((await file.stat({ bigint: true })).size === stat.size + BigInt(record.length), "NPM_CACHE_UNAVAILABLE", "ثبت سهمیهٔ کش کامل نشد.", 503);
  } finally { await file.close(); }
}
/** One private namespace; all conforming writers take the wx lock and reserve capacity durably first.
 * Quota reservations are monotonic, including interrupted/deleted entries. No eviction or stale-lock reset.
 */
export async function writeNpmCacheTarball(root: string, item: LockedTarball, input: Buffer, signal: AbortSignal): Promise<void> {
  return guarded(async () => {
    validateItem(item); ensure(Buffer.isBuffer(input) && input.length <= tarballLimit, "BUILD_DEPENDENCY_LIMIT", "حجم dependency از سقف مجاز بیشتر است.", 413);
    const path = rootPath(root);
    return serial(path, signal, async () => {
      const bytes = Buffer.from(input); verify(bytes, item);
      const parents = await anchors(path, true, signal); ensure(parents, "NPM_CACHE_PATH_DENIED", "مسیر کش موجود نیست.", 409);
      const target = join(path, item.file), lockPath = join(path, lockName);
      let lock: FileHandle;
      try { lock = await open(lockPath, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | (constants.O_NOFOLLOW || 0), 0o600); }
      catch (error) {
        if (!exists(error)) throw error;
        await readRegular(lockPath, 0, parents, signal);
        throw new AppError("NPM_CACHE_BUSY", "نوشتن قبلی کش هنوز تعیین تکلیف نشده است؛ قفل پاک نشد.", 409);
      }
      const ownedLock = await lock.stat({ bigint: true }); let temporary: { path: string; stat: BigIntStats } | null = null;
      try {
        const existing = await readTarball(target, item, parents, signal);
        await reserve(path, item, bytes.length, parents, signal);
        if (existing) return;
        await unchanged(parents, signal);
        const pending = join(path, `.pending-${randomUUID()}`), file = await open(pending, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | (constants.O_NOFOLLOW || 0), 0o600);
        try {
          temporary = { path: pending, stat: await file.stat({ bigint: true }) }; regular(temporary.stat, tarballLimit);
          stop(signal); await file.writeFile(bytes); await file.sync();
          const stat = await file.stat({ bigint: true }); regular(stat, tarballLimit);
          ensure(same(stat, temporary.stat) && Number(stat.size) === bytes.length, "NPM_CACHE_PATH_DENIED", "فایل موقت کش تغییر کرده است.", 409);
          verify(await readHandle(file, bytes.length, signal), item);
        } finally { await file.close(); }
        await unchanged(parents, signal); stop(signal);
        const pendingStat = await lstat(pending, { bigint: true }); regular(pendingStat, tarballLimit);
        ensure(same(pendingStat, temporary.stat) && samePath(await realpath(pending), pending), "NPM_CACHE_PATH_DENIED", "فایل موقت کش پیش از انتشار تغییر کرده است.", 409);
        await link(pending, target).catch((error: unknown) => { if (!exists(error)) throw error; });
        await removeOwned(pending, temporary.stat, parents); temporary = null;
        ensure(await readTarball(target, item, parents, signal), "NPM_CACHE_UNAVAILABLE", "فایل کش پس از انتشار موجود نیست.", 503);
      } finally {
        try { if (temporary) await removeOwned(temporary.path, temporary.stat, parents); }
        finally { await lock.close(); await removeOwned(lockPath, ownedLock, parents); }
      }
    });
  });
}
