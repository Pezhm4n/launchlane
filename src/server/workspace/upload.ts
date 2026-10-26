import { SOURCE_MAX_BYTES, SOURCE_MAX_FILES, sourceFileByteLimit, sourceFileLimitMessage } from "../../contracts/source-limits.ts";
import { exactKeys, object, string } from "../../contracts/validation.ts";
import { AppError, ensure } from "../errors.ts";
import { checkName, excludedPath, sourceFileAllowed } from "./paths.ts";
import type { SourceFile } from "./inspect.ts";
import { environmentFileMaxBytes, environmentFileNames, isEnvironmentFile } from "../../contracts/environment-files.ts";
import { parseEnvironmentFiles } from "../environment/import.ts";
import type { EnvironmentVariable } from "../../contracts/environment.ts";
import { filterSourceFiles } from "./source-ignore.ts";

const requestLimit = SOURCE_MAX_BYTES + 1024 * 1024;

export async function readFolderUpload(request: Request): Promise<{ name: string; files: SourceFile[]; environment: EnvironmentVariable[] }> {
  const type = request.headers.get("content-type") || "";
  ensure(/^multipart\/form-data; boundary=/i.test(type), "INVALID_CONTENT_TYPE", "پوشه باید با انتخاب‌گر فایل وارد شود.", 415);
  ensure(Number(request.headers.get("content-length") || 0) <= requestLimit, "SOURCE_LIMIT", "حجم پوشه بیشتر از سقف مجاز است.", 413);
  const reader = request.body?.getReader();
  ensure(reader, "INVALID_INPUT", "فایلی دریافت نشد.");
  const chunks: Uint8Array[] = [];
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]);
  const cancel = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener("abort", cancel, { once: true });
  let bytes = 0;
  try {
    while (true) {
      ensure(!signal.aborted, "CANCELLED", "ورود پوشه لغو شد.", 409);
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      ensure(bytes <= requestLimit, "SOURCE_LIMIT", "حجم پوشه بیشتر از سقف مجاز است.", 413);
      chunks.push(part.value);
    }
    ensure(!signal.aborted, "CANCELLED", "ورود پوشه لغو شد.", 409);
  } finally { signal.removeEventListener("abort", cancel); await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  let data: FormData;
  try { data = await new Response(Buffer.concat(chunks), { headers: { "content-type": type } }).formData(); }
  catch { throw new AppError("INVALID_UPLOAD", "فایل‌های پوشه کامل دریافت نشدند. پوشه را دوباره انتخاب کنید."); }
  const manifest = data.get("manifest");
  ensure(typeof manifest === "string" && manifest.length <= 256 * 1024, "INVALID_UPLOAD", "فهرست فایل‌ها معتبر نیست.");
  let parsed: unknown;
  try { parsed = JSON.parse(manifest); } catch { throw new AppError("INVALID_UPLOAD", "فهرست فایل‌ها معتبر نیست."); }
  const row = object(parsed); exactKeys(row, ["name", "paths", "environmentFiles"]);
  ensure(row.environmentFiles === undefined || Array.isArray(row.environmentFiles) && row.environmentFiles.length <= environmentFileNames.length, "INVALID_ENV_FILE", "فهرست فایل تنظیمات معتبر نیست.");
  const environmentNames: unknown[] = Array.isArray(row.environmentFiles) ? row.environmentFiles : [];
  ensure(environmentNames.every(name => typeof name === "string" && isEnvironmentFile(name)) && new Set(environmentNames).size === environmentNames.length, "INVALID_ENV_FILE", "فهرست فایل تنظیمات معتبر نیست.");
  const name = string(row.name, 160); checkName(name);
  ensure(Array.isArray(row.paths) && row.paths.length > 0 && row.paths.length <= SOURCE_MAX_FILES, "SOURCE_LIMIT", "پوشه باید بین یک تا هزار فایل قابل بررسی داشته باشد.", 413);
  const paths = row.paths.map(value => string(value, 240));
  const expected = new Set(["manifest", ...paths.map((_, index) => `file-${index}`), ...environmentNames.map((_, index) => `environment-${index}`)]);
  ensure([...data.keys()].length === expected.size && [...data.keys()].every(key => expected.has(key)), "INVALID_UPLOAD", "تعداد فایل‌ها با فهرست پوشه برابر نیست.");
  const seen = new Set<string>(), files: SourceFile[] = [];
  let sourceBytes = 0;
  for (const [index, path] of paths.entries()) {
    const parts = path.split("/");
    ensure(parts.length <= 16 && !/[\\:]/.test(path) && parts.every(part => part && part !== "." && part !== ".." && !excludedPath(part)), "UNSAFE_PATH", "مسیر یا فایل خصوصی در پوشه مجاز نیست.", 403);
    for (const part of parts) checkName(part);
    ensure(sourceFileAllowed(parts.at(-1) || "") && !seen.has(path.toLocaleLowerCase("en-US")), "INVALID_UPLOAD", "نوع یا نام تکراری فایل مجاز نیست.");
    seen.add(path.toLocaleLowerCase("en-US"));
    const file = data.get(`file-${index}`);
    ensure(file instanceof File, "INVALID_UPLOAD", "یکی از فایل‌های پوشه دریافت نشد.");
    ensure(file.size <= sourceFileByteLimit(path), "SOURCE_LIMIT", sourceFileLimitMessage(path), 413);
    sourceBytes += file.size;
    ensure(sourceBytes <= SOURCE_MAX_BYTES, "SOURCE_LIMIT", "فایل‌های قابل بررسی باید کمتر از ۲۰ مگابایت باشند.", 413);
    files.push({ path, content: Buffer.from(await file.arrayBuffer()) });
  }
  const environmentFiles = [];
  for (const [index, name] of environmentNames.entries()) {
    const file = data.get(`environment-${index}`);
    ensure(typeof name === "string" && file instanceof File && file.size <= environmentFileMaxBytes, "INVALID_ENV_FILE", "فایل تنظیمات معتبر نیست یا بیش از حد بزرگ است.");
    let content: string;
    try { content = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer()); }
    catch { throw new AppError("INVALID_ENV_FILE", "فایل تنظیمات باید متن UTF-8 معتبر باشد؛ مقدارها تغییر داده نمی‌شوند."); }
    environmentFiles.push({ name, content });
  }
  return { name, files: filterSourceFiles(files), environment: parseEnvironmentFiles(environmentFiles) };
}
