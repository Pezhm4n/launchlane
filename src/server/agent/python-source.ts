import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { object, string } from "../../contracts/validation.ts";
import { ensure, AppError } from "../errors.ts";
import type { SourceFile } from "../workspace/inspect.ts";

export type PythonRequirement = { name: string; version: string };
export function pythonRequirements(files: readonly SourceFile[]): PythonRequirement[] {
  const source = files.find(file => file.path === "requirements.txt");
  ensure(source || !files.some(file => /^(?:pyproject\.toml|requirements\.lock\.txt)$/.test(file.path)),
    "PYTHON_REQUIREMENTS_REQUIRED", "وابستگی‌های Python باید در requirements.txt ریشه با نسخه دقیق مشخص باشند.", 409);
  if (!source) return [];
  ensure(source.content.length <= 16384, "PYTHON_DEPENDENCY_LIMIT", "فهرست وابستگی Python بیش از حد بزرگ است.", 413);
  const rows = source.content.toString("utf8").split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith("#"));
  ensure(rows.length <= 80, "PYTHON_DEPENDENCY_LIMIT", "حداکثر ۸۰ وابستگی قفل‌شده در این محیط پشتیبانی می‌شود.", 413);
  const result = rows.map(line => {
    const match = /^([A-Za-z0-9][A-Za-z0-9_.-]{0,80})==([0-9][A-Za-z0-9_.+-]{0,60})$/.exec(line);
    ensure(match?.[1] && match[2], "PYTHON_REQUIREMENT_UNPINNED", "هر وابستگی باید name==version باشد؛ URL، دستور و نسخه شناور اجرا نمی‌شود.", 409);
    return { name: match[1].toLowerCase().replace(/[-_.]+/g, "-"), version: match[2] };
  });
  ensure(new Set(result.map(row => row.name)).size === result.length, "PYTHON_REQUIREMENT_DUPLICATE", "وابستگی تکراری مجاز نیست.", 409);
  return result;
}
export type Wheel = { filename: string; sha256: string; url: string; size: number };

export async function reusePythonWheels(requirements: readonly PythonRequirement[], source: string, directory: string, signal: AbortSignal): Promise<void> {
  const stat = await lstat(source), manifestPath = join(source, "manifest.json"), metadata = await lstat(manifestPath);
  ensure(stat.isDirectory() && !stat.isSymbolicLink() && metadata.isFile() && !metadata.isSymbolicLink() && metadata.size <= 65536,
    "PYTHON_WHEEL_CHANGED", "کش وابستگی معتبر نیست؛ اجرای پروژه شروع نشد.", 409);
  const raw: unknown = JSON.parse((await readFile(manifestPath, { signal })).toString("utf8"));
  ensure(Array.isArray(raw) && raw.length === requirements.length && raw.length <= 80, "PYTHON_WHEEL_CHANGED", "فهرست کش وابستگی تغییر کرده است.", 409);
  const manifest = raw.map(value => {
    const row = object(value), filename = string(row.filename, 220), sha256 = string(row.sha256, 64), size = row.size;
    ensure(/^[A-Za-z0-9_.+-]+\.whl$/.test(filename) && /^[a-f0-9]{64}$/.test(sha256) && typeof size === "number" && Number.isSafeInteger(size) && size > 0 && size <= 20 * 1024 * 1024,
      "PYTHON_WHEEL_CHANGED", "مشخصات کش وابستگی تغییر کرده است.", 409);
    return { filename, sha256, size, url: string(row.url, 1024) };
  });
  ensure(new Set(manifest.map(row => row.filename)).size === manifest.length && manifest.reduce((sum, row) => sum + row.size, 0) <= 128 * 1024 * 1024,
    "PYTHON_WHEEL_CHANGED", "حجم یا مسیر کش وابستگی معتبر نیست.", 409);
  const expected = requirements.map((row, index) => `${row.name}==${row.version} --hash=sha256:${manifest[index]?.sha256}`).join("\n");
  const pinned = await lstat(join(source, "requirements.txt"));
  ensure(pinned.isFile() && !pinned.isSymbolicLink() && pinned.size <= 32768 && await readFile(join(source, "requirements.txt"), "utf8") === expected,
    "PYTHON_WHEEL_CHANGED", "قفل کش با وابستگی همین منبع برابر نیست.", 409);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  for (const row of manifest) {
    const path = join(source, row.filename), file = await lstat(path);
    ensure(file.isFile() && !file.isSymbolicLink() && file.size === row.size, "PYTHON_WHEEL_CHANGED", "فایل کش وابستگی تغییر کرده است.", 409);
    const bytes = await readFile(path, { signal });
    ensure(bytes.length === row.size && createHash("sha256").update(bytes).digest("hex") === row.sha256,
      "PYTHON_WHEEL_CHANGED", "checksum کش وابستگی تغییر کرده است.", 409);
    await writeFile(join(directory, row.filename), bytes, { flag: "wx", mode: 0o600 });
  }
  await writeFile(join(directory, "requirements.txt"), expected, { flag: "wx", mode: 0o600 });
  await writeFile(join(directory, "manifest.json"), JSON.stringify(manifest), { flag: "wx", mode: 0o600 });
}
type Reader = (url: string, signal: AbortSignal, maxBytes: number) => Promise<Buffer>;
export const pythonRegistryRead: Reader = async (url, signal, maxBytes) => {
  const parsed = new URL(url);
  ensure(parsed.protocol === "https:" && ["pypi.org", "files.pythonhosted.org"].includes(parsed.hostname) && !parsed.port && !parsed.username && !parsed.password,
    "PYTHON_REGISTRY_DENIED", "منبع وابستگی Python مجاز نیست.", 403);
  try {
    const response = await fetch(url, { signal, redirect: "error", cache: "no-store" });
    ensure(response.ok, "PYTHON_REGISTRY_UNAVAILABLE", "دریافت وابستگی Python انجام نشد؛ source اصلاح نمی‌شود.", 502);
    const chunks: Buffer[] = []; let bytes = 0;
    for await (const chunk of response.body ?? []) {
      bytes += chunk.length;
      ensure(bytes <= maxBytes, "PYTHON_DEPENDENCY_LIMIT", "پاسخ مخزن Python بیش از سقف مجاز است.", 413);
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("PYTHON_REGISTRY_UNAVAILABLE", "ارتباط مخزن Python برقرار نشد؛ آزمون و انتشار تأیید نشد.", 502, true);
  }
};
export async function downloadPythonWheels(requirements: readonly PythonRequirement[], directory: string, signal: AbortSignal,
  take: () => void, read: Reader = pythonRegistryRead): Promise<void> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const manifest: Wheel[] = []; let total = 0;
  for (const requirement of requirements) {
    take();
    const metadata = object(JSON.parse((await read(`https://pypi.org/pypi/${requirement.name}/${requirement.version}/json`, signal, 2 * 1024 * 1024)).toString("utf8")));
    ensure(Array.isArray(metadata.urls), "PYTHON_REGISTRY_INVALID", "پاسخ مخزن Python معتبر نیست.", 502);
    const candidates = metadata.urls.map(object).filter(row => row.packagetype === "bdist_wheel" && row.yanked === false && typeof row.filename === "string" &&
      (/-(?:py2\.)?py3-none-any\.whl$/.test(row.filename) || /-cp312-cp312-manylinux[^/]*x86_64\.whl$/.test(row.filename) || /-cp3(?:8|9|10|11|12)-abi3-manylinux[^/]*x86_64\.whl$/.test(row.filename)));
    const item = candidates.sort((a, b) => String(a.filename).localeCompare(String(b.filename)))[0];
    ensure(item, "PYTHON_WHEEL_UNAVAILABLE", `wheel سازگار Python 3.12/Linux برای ${requirement.name}==${requirement.version} موجود نیست؛ sdist روی میزبان اجرا نمی‌شود.`, 409);
    const filename = string(item.filename, 220), sha256 = string(object(item.digests).sha256, 64), url = string(item.url, 1024), size = item.size;
    ensure(/^[A-Za-z0-9_.+-]+\.whl$/.test(filename) && /^[a-f0-9]{64}$/.test(sha256) && typeof size === "number" && Number.isSafeInteger(size) && size > 0 && size <= 20 * 1024 * 1024 && total + size <= 128 * 1024 * 1024 && new URL(url).hostname === "files.pythonhosted.org",
      "PYTHON_REGISTRY_INVALID", "مشخصات wheel معتبر و محدود نیست.", 502);
    take(); const content = await read(url, signal, size);
    ensure(content.length === size && createHash("sha256").update(content).digest("hex") === sha256,
      "PYTHON_WHEEL_CHANGED", "محتوای wheel با checksum مخزن برابر نیست.", 409);
    await writeFile(join(directory, filename), content, { flag: "wx", mode: 0o600 });
    total += size; manifest.push({ filename, sha256, url, size });
  }
  await writeFile(join(directory, "requirements.txt"), requirements.map((row, index) => `${row.name}==${row.version} --hash=sha256:${manifest[index]?.sha256}`).join("\n"), { flag: "wx", mode: 0o600 });
  await writeFile(join(directory, "manifest.json"), JSON.stringify(manifest), { flag: "wx", mode: 0o600 });
}
