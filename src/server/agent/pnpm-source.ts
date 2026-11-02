import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { pnpmTool } from "../../contracts/pnpm-workspace.ts";
import { object } from "../../contracts/validation.ts";
import { AppError, ensure } from "../errors.ts";
import type { SourceFile } from "../workspace/inspect.ts";
import { pnpmYaml } from "../workspace/pnpm.ts";
import { lockedTarballs, registryBytes, type LockedTarball } from "./npm-source.ts";
import { abortable } from "../providers/http.ts";

function pnpmRegistryEntries(files: readonly SourceFile[], allPlatforms: boolean): LockedTarball[] {
  const file = files.find(file => file.path === "pnpm-lock.yaml"); ensure(file, "PNPM_LOCK_REQUIRED", "lock اصلی pnpm لازم است.", 409);
  const lock = pnpmYaml(file), packages = object(lock.packages ?? {}), entries: Record<string, unknown> = {};
  for (const [key, input] of Object.entries(packages)) {
    const match = /^((?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+)@(\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?(?:\+[A-Za-z0-9.-]+)?)$/.exec(key);
    ensure(match, "PNPM_DEPENDENCY_UNSUPPORTED", "شناسهٔ dependency در lock باید نام و نسخه دقیق registry باشد.", 409);
    const row = object(input), resolution = object(row.resolution), name = match[1] ?? "", version = match[2] ?? "";
    ensure(Object.keys(resolution).every(key => key === "integrity" || key === "tarball"), "PNPM_DEPENDENCY_UNSUPPORTED", "resolution خارج registry یا dependency patch‌شده در این قرارداد اجرا نمی‌شود.", 409);
    entries[`node_modules/${key}`] = { ...row, ...(allPlatforms ? { os: undefined, cpu: undefined, libc: undefined } : {}), version, integrity: resolution.integrity,
      resolved: resolution.tarball ?? `https://registry.npmjs.org/${name}/-/${name.split("/").at(-1)}-${version}.tgz` };
  }
  entries["node_modules/launchlane-pinned-pnpm"] = { version: pnpmTool.version, resolved: `https://registry.npmjs.org/pnpm/-/pnpm-${pnpmTool.version}.tgz`, integrity: pnpmTool.integrity };
  // Reuse the public-registry/platform/SRI validator and downloader. This in-memory adapter
  // never writes an npm lock, changes pnpm's source lock or resolves the workspace itself.
  return lockedTarballs([{ path: "package-lock.json", content: Buffer.from(JSON.stringify({ lockfileVersion: 3, packages: entries })) }]);
}
export function pnpmTarballs(files: readonly SourceFile[]): LockedTarball[] { return pnpmRegistryEntries(files, false); }
export const pnpmMetadataByteLimit = 64 * 1024 * 1024;
export type PnpmMetadataReader = (name: string, signal: AbortSignal, remainingBytes?: number, onBytes?: (bytes: number) => void) => Promise<Buffer>;
export const pnpmRegistryMetadata: PnpmMetadataReader = (name, signal, remainingBytes = pnpmMetadataByteLimit, onBytes) =>
  registryBytes(`https://registry.npmjs.org/${encodeURIComponent(name)}`, signal, Math.min(remainingBytes, pnpmMetadataByteLimit), "application/json", true, onBytes);
export async function writePnpmRegistryManifest(files: readonly SourceFile[], directory: string, signal: AbortSignal, beforeRead: () => void,
  readMetadata: PnpmMetadataReader = pnpmRegistryMetadata): Promise<void> {
  const items = pnpmRegistryEntries(files, true);
  const downloaded: unknown = JSON.parse(await readFile(join(directory, "manifest.json"), "utf8"));
  ensure(Array.isArray(downloaded), "PNPM_LOCK_INVALID", "فهرست dependencyهای بررسی‌شده معتبر نیست.", 409);
  const included = new Set(downloaded.map(item => object(item).file));
  await writeFile(join(directory, "pnpm-registry.json"), JSON.stringify(items.filter(item => included.has(item.file)).map(item => ({ path: new URL(item.url).pathname, file: item.file, integrity: item.integrity }))), { flag: "wx", mode: 0o600 });
  const groups = new Map<string, LockedTarball[]>();
  // pnpm11 checks publish policy for every lock entry, including non-Linux optional
  // packages. Supply their verified metadata; never download/serve their binaries.
  for (const item of items.filter(item => item.integrity !== pnpmTool.integrity)) {
    const path = new URL(item.url).pathname, name = path.slice(1, path.lastIndexOf("/-/"));
    ensure(name && /^(?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/.test(name), "PNPM_METADATA_INVALID", "نام registry باید همان نام قفل‌شده باشد.", 409);
    groups.set(name, [...(groups.get(name) ?? []), item]);
  }
  const metadata: { path: string; value: unknown }[] = [], pending = [...groups], controller = new AbortController(), bounded = AbortSignal.any([signal, controller.signal]);
  let total = 0, decodedTotal = 0, retainedTotal = 0, next = 0, failure: unknown;
  async function collect(name: string, entries: LockedTarball[]) {
    const remaining = pnpmMetadataByteLimit - total;
    ensure(remaining > 0, "PNPM_METADATA_LIMIT", "مشخصات registry از سقف این اجرا بیشتر است.", 413);
    let streamed = 0;
    const charge = (bytes: number) => { ensure(Number.isSafeInteger(bytes) && bytes > 0 && total + bytes <= pnpmMetadataByteLimit, "PNPM_METADATA_LIMIT", "مشخصات registry از سقف این اجرا بیشتر است.", 413); total += bytes; streamed += bytes; };
    beforeRead(); const deadline = AbortSignal.any([bounded, AbortSignal.timeout(90000)]), bytes = await abortable(() => readMetadata(name, deadline, remaining, charge), deadline);
    // Injected buffered readers retain the same aggregate quota. Native reads charge
    // each chunk before retaining it, so four in-flight reads cannot multiply it.
    if (!streamed && bytes.length) charge(bytes.length);
    ensure(streamed === bytes.length && bytes.length <= remaining, "PNPM_METADATA_LIMIT", "شمارش بایت‌های registry با پاسخ برابر نیست.", 413);
    let decoded: Buffer;
    try { decoded = bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes, { maxOutputLength: pnpmMetadataByteLimit }) : bytes; }
    catch { throw new AppError("PNPM_METADATA_LIMIT", "پاسخ فشردهٔ registry معتبر و محدود نیست.", 413); }
    decodedTotal += decoded.length;
    ensure(decoded.length <= pnpmMetadataByteLimit && decodedTotal <= 384 * 1024 * 1024, "PNPM_METADATA_LIMIT", "حجم بازشدهٔ مشخصات registry از سقف این اجرا بیشتر است.", 413);
    let value: Record<string, unknown>;
    try { value = object(JSON.parse(decoded.toString("utf8"))); }
    catch { throw new AppError("PNPM_METADATA_INVALID", "مشخصات registry برای این نسخه قابل بررسی نیست؛ policy امنیتی نادیده گرفته نشد.", 502); }
    const versions = object(value.versions), time = object(value.time);
    ensure(value.name === name, "PNPM_METADATA_CHANGED", "هویت metadata با lock برابر نیست.", 409);
    const selectedVersions: Record<string, unknown> = {}, selectedTime: Record<string, string> = {};
    for (const item of entries) {
      const match = Object.entries(versions).find(([, version]) => {
        if (!version || typeof version !== "object" || !("dist" in version) || !version.dist || typeof version.dist !== "object") return false;
        const dist = object(version.dist); return dist.tarball === item.url && dist.integrity === item.integrity;
      });
      ensure(match && typeof time[match[0]] === "string" && Number.isFinite(Date.parse(String(time[match[0]]))), "PNPM_METADATA_CHANGED", "نسخه، integrity و زمان انتشار واقعی dependency باید از registry تأیید شوند؛ سیاست امنیتی pnpm غیرفعال نمی‌شود.", 409);
      ensure(object(match[1]).name === name && object(match[1]).version === match[0], "PNPM_METADATA_CHANGED", "هویت نسخهٔ registry با lock برابر نیست.", 409);
      selectedVersions[match[0]] = match[1]; selectedTime[match[0]] = String(time[match[0]]);
    }
    // A full packument contains the history/readmes of thousands of unrelated versions
    // (Vite measured38,999,531 bytes). Keep the same total network budget and original
    // publish times, but give the frozen installer only the exact verified lock versions.
    const selected = { name, versions: selectedVersions, time: selectedTime }; retainedTotal += Buffer.byteLength(JSON.stringify(selected));
    ensure(retainedTotal <= pnpmMetadataByteLimit, "PNPM_METADATA_LIMIT", "مشخصات لازم برای worker از سقف نگهداری بیشتر است.", 413);
    metadata.push({ path: `/${name}`, value: selected });
  }
  const worker = async () => { while (next < pending.length && !bounded.aborted) { const item = pending[next++]; if (item) await collect(...item); } };
  await Promise.allSettled(Array.from({ length: Math.min(4, pending.length) }, () => worker().catch(error => { if (!controller.signal.aborted) { failure = error; controller.abort(); } throw error; })));
  if (failure !== undefined) throw failure;
  ensure(!signal.aborted, "CANCELLED", "خواندن metadata متوقف شد.", 409);
  await writeFile(join(directory, "pnpm-metadata.json"), JSON.stringify(metadata.sort((a, b) => a.path.localeCompare(b.path, "en"))), { flag: "wx", mode: 0o600 });
}
