import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pnpmTool } from "../../contracts/pnpm-workspace.ts";
import { object } from "../../contracts/validation.ts";
import { AppError, ensure } from "../errors.ts";
import type { SourceFile } from "../workspace/inspect.ts";
import { pnpmYaml } from "../workspace/pnpm.ts";
import { lockedTarballs, registryBytes, type LockedTarball } from "./npm-source.ts";
import { abortable } from "../providers/http.ts";

export function pnpmTarballs(files: readonly SourceFile[]): LockedTarball[] {
  const file = files.find(file => file.path === "pnpm-lock.yaml"); ensure(file, "PNPM_LOCK_REQUIRED", "lock اصلی pnpm لازم است.", 409);
  const lock = pnpmYaml(file), packages = object(lock.packages ?? {}), entries: Record<string, unknown> = {};
  for (const [key, input] of Object.entries(packages)) {
    const match = /^((?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+)@(\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?(?:\+[A-Za-z0-9.-]+)?)$/.exec(key);
    ensure(match, "PNPM_DEPENDENCY_UNSUPPORTED", "شناسهٔ dependency در lock باید نام و نسخه دقیق registry باشد.", 409);
    const row = object(input), resolution = object(row.resolution), name = match[1] ?? "", version = match[2] ?? "";
    ensure(Object.keys(resolution).every(key => key === "integrity" || key === "tarball"), "PNPM_DEPENDENCY_UNSUPPORTED", "resolution خارج registry یا dependency patch‌شده در این قرارداد اجرا نمی‌شود.", 409);
    entries[`node_modules/${key}`] = { ...row, version, integrity: resolution.integrity,
      resolved: resolution.tarball ?? `https://registry.npmjs.org/${name}/-/${name.split("/").at(-1)}-${version}.tgz` };
  }
  entries["node_modules/launchlane-pinned-pnpm"] = { version: pnpmTool.version, resolved: `https://registry.npmjs.org/pnpm/-/pnpm-${pnpmTool.version}.tgz`, integrity: pnpmTool.integrity };
  // Reuse the public-registry/platform/SRI validator and downloader. This in-memory adapter
  // never writes an npm lock, changes pnpm's source lock or resolves the workspace itself.
  return lockedTarballs([{ path: "package-lock.json", content: Buffer.from(JSON.stringify({ lockfileVersion: 3, packages: entries })) }]);
}
export type PnpmMetadataReader = (name: string, signal: AbortSignal) => Promise<Buffer>;
export const pnpmRegistryMetadata: PnpmMetadataReader = (name, signal) => registryBytes(`https://registry.npmjs.org/${encodeURIComponent(name)}`, signal, 16 * 1024 * 1024, "application/json");
export async function writePnpmRegistryManifest(files: readonly SourceFile[], directory: string, signal: AbortSignal, beforeRead: () => void,
  readMetadata: PnpmMetadataReader = pnpmRegistryMetadata): Promise<void> {
  const items = pnpmTarballs(files);
  const downloaded: unknown = JSON.parse(await readFile(join(directory, "manifest.json"), "utf8"));
  ensure(Array.isArray(downloaded), "PNPM_LOCK_INVALID", "فهرست dependencyهای بررسی‌شده معتبر نیست.", 409);
  const included = new Set(downloaded.map(item => object(item).file));
  await writeFile(join(directory, "pnpm-registry.json"), JSON.stringify(items.filter(item => included.has(item.file)).map(item => ({ path: new URL(item.url).pathname, file: item.file, integrity: item.integrity }))), { flag: "wx", mode: 0o600 });
  const groups = new Map<string, LockedTarball[]>();
  for (const item of items.filter(item => included.has(item.file) && item.integrity !== pnpmTool.integrity)) {
    const path = new URL(item.url).pathname, name = path.slice(1, path.lastIndexOf("/-/"));
    ensure(name && /^(?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/.test(name), "PNPM_METADATA_INVALID", "نام registry باید همان نام قفل‌شده باشد.", 409);
    groups.set(name, [...(groups.get(name) ?? []), item]);
  }
  const metadata: { path: string; value: unknown }[] = []; let total = 0;
  for (const [name, entries] of groups) {
    beforeRead(); const deadline = AbortSignal.any([signal, AbortSignal.timeout(90000)]), bytes = await abortable(() => readMetadata(name, deadline), deadline);
    total += bytes.length; ensure(bytes.length <= 16 * 1024 * 1024 && total <= 64 * 1024 * 1024, "PNPM_METADATA_LIMIT", "مشخصات registry از سقف این اجرا بیشتر است.", 413);
    let value: Record<string, unknown>;
    try { value = object(JSON.parse(bytes.toString("utf8"))); }
    catch { throw new AppError("PNPM_METADATA_INVALID", "مشخصات registry برای این نسخه قابل بررسی نیست؛ policy امنیتی نادیده گرفته نشد.", 502); }
    const versions = object(value.versions), time = object(value.time);
    ensure(value.name === name, "PNPM_METADATA_CHANGED", "هویت metadata با lock برابر نیست.", 409);
    for (const item of entries) {
      const match = Object.entries(versions).find(([, version]) => {
        if (!version || typeof version !== "object" || !("dist" in version) || !version.dist || typeof version.dist !== "object") return false;
        const dist = object(version.dist); return dist.tarball === item.url && dist.integrity === item.integrity;
      });
      ensure(match && typeof time[match[0]] === "string" && Number.isFinite(Date.parse(String(time[match[0]]))), "PNPM_METADATA_CHANGED", "نسخه، integrity و زمان انتشار واقعی dependency باید از registry تأیید شوند؛ سیاست امنیتی pnpm غیرفعال نمی‌شود.", 409);
    }
    metadata.push({ path: `/${name}`, value });
  }
  await writeFile(join(directory, "pnpm-metadata.json"), JSON.stringify(metadata), { flag: "wx", mode: 0o600 });
}
