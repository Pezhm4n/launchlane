import { createHash } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import { posix } from "node:path";
import { exactKeys, hash, hasControl, integer, object, string } from "../../contracts/validation.ts";
import { ensure } from "../errors.ts";

export const componentOutputLimits = { files: 8192, bytes: 96 * 1024 * 1024, file: 16 * 1024 * 1024, compressed: 16 * 1024 * 1024, wire: 140 * 1024 * 1024 } as const;
export type ComponentEntry = Readonly<{ path: string; type: "file"; bytes: number; sha256: string; executable: boolean }> | Readonly<{ path: string; type: "symlink"; target: string }>;
export type ComponentOutput = Readonly<{ version: 1; sourceHash: string; planHash: string; entries: readonly ComponentEntry[]; contents: readonly Readonly<{ path: string; base64: string }>[]; totalBytes: number }>;
const digest = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
export function componentPath(value: unknown): string {
  const path = string(value, 512);
  ensure(!path.startsWith("/") && !hasControl(path) && !/[\\:]/.test(path) && path.normalize("NFKC") === path && path.split("/").length <= 32 &&
    path.split("/").every(part => part && part !== "." && part !== ".." && part.trim() === part && !part.endsWith(".") && !/^(?:CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])(?:\.|$)/i.test(part) &&
      !/^(?:\.env(?:\..*)?|\.git|\.npmrc|\.netrc|\.ssh|\.aws|id_rsa|id_ed25519)$/i.test(part) &&
      !(/(?:credential|password|secret|access[-_]?token|api[-_]?key)/i.test(part) && !/\.(?:[cm]?[jt]sx?|py|php|go|rb|cs|fs|vb|java|rs|c|cpp|h|hpp|vue|svelte|astro)$/i.test(part))),
    "COMPONENT_OUTPUT_PATH", "مسیر خصوصی، بیرونی یا نام جایگزین در خروجی component مجاز نیست.", 409);
  return path;
}
export function validateComponentOutput(value: unknown, secrets: readonly string[] = []): ComponentOutput {
  const row = object(value); exactKeys(row, ["version", "sourceHash", "planHash", "entries", "contents", "totalBytes"]);
  ensure(row.version === 1 && Array.isArray(row.entries) && row.entries.length > 0 && row.entries.length <= componentOutputLimits.files && Array.isArray(row.contents),
    "COMPONENT_OUTPUT_INVALID", "فهرست خروجی component معتبر و محدود نیست.", 409);
  const names = new Map<string, ComponentEntry>(), folded = new Set<string>(), contents: { path: string; base64: string }[] = []; let totalBytes = 0;
  for (const input of row.entries) {
    const item = object(input), path = componentPath(item.path), key = path.toLowerCase();
    ensure(!folded.has(key), "COMPONENT_OUTPUT_PATH", "مسیر خروجی تکراری است.", 409); folded.add(key);
    if (item.type === "symlink") { exactKeys(item, ["path", "type", "target"]); names.set(path, { path, type: "symlink", target: componentPath(item.target) }); }
    else { exactKeys(item, ["path", "type", "bytes", "sha256", "executable"]);
      ensure(item.type === "file" && typeof item.executable === "boolean", "COMPONENT_OUTPUT_INVALID", "فقط فایل عادی و پیوند داخلیِ بررسی‌شده پذیرفته می‌شود.", 409);
      const bytes = integer(item.bytes, 0, componentOutputLimits.file); totalBytes += bytes;
      ensure(totalBytes <= componentOutputLimits.bytes, "COMPONENT_OUTPUT_LIMIT", "حجم خروجی component از سقف این بسته بیشتر است.", 413);
      names.set(path, { path, type: "file", bytes, sha256: hash(item.sha256), executable: item.executable });
    }
  }
  const directories = new Set<string>();
  for (const path of names.keys()) { let parent = posix.dirname(path); while (parent !== ".") { directories.add(parent); parent = posix.dirname(parent); } }
  for (const entry of names.values()) {
    let parent = posix.dirname(entry.path);
    while (parent !== ".") { ensure(!names.has(parent), "COMPONENT_OUTPUT_PATH", "فایل یا پیوند نمی‌تواند والد فایل دیگری باشد.", 409); parent = posix.dirname(parent); }
    if (entry.type === "symlink") {
      let parent = posix.dirname(entry.target); while (parent !== ".") { ensure(!names.has(parent), "COMPONENT_OUTPUT_PATH", "مقصد پیوند باید مسیر canonical همین بسته باشد.", 409); parent = posix.dirname(parent); }
      let target = entry.target; const seen = new Set([entry.path]);
      for (;;) { ensure(!seen.has(target), "COMPONENT_OUTPUT_PATH", "چرخهٔ پیوند در خروجی component مجاز نیست.", 409); seen.add(target);
        const next = names.get(target); if (next?.type === "symlink") { target = next.target; continue; }
        ensure(next?.type === "file" || directories.has(target), "COMPONENT_OUTPUT_PATH", "پیوند خروجی باید به بایت‌های همین بسته برسد.", 409); break;
      }
    }
  }
  ensure(row.contents.length === [...names.values()].filter(entry => entry.type === "file").length, "COMPONENT_OUTPUT_CHANGED", "فهرست بایت‌های خروجی برابر نیست.", 409);
  const loaded = new Set<string>();
  for (const input of row.contents) {
    const item = object(input); exactKeys(item, ["path", "base64"]); const path = componentPath(item.path), entry = names.get(path), encoded = item.base64;
    ensure(entry?.type === "file" && !loaded.has(path) && typeof encoded === "string" && encoded.length <= Math.ceil(componentOutputLimits.file / 3) * 4 && encoded.length % 4 === 0,
      "COMPONENT_OUTPUT_CHANGED", "بایت‌های خروجی با فایل‌ها برابر نیستند.", 409);
    const bytes = Buffer.from(encoded, "base64");
    ensure(bytes.toString("base64") === encoded && bytes.length === entry.bytes && digest(bytes) === entry.sha256 && !secrets.filter(Boolean).some(secret => bytes.includes(Buffer.from(secret))),
      "COMPONENT_OUTPUT_CHANGED", "بایت، hash یا محدودهٔ اطلاعات خصوصی خروجی معتبر نیست.", 409);
    loaded.add(path); contents.push({ path, base64: encoded });
  }
  ensure(row.totalBytes === totalBytes, "COMPONENT_OUTPUT_CHANGED", "حجم واقعی خروجی با رسید برابر نیست.", 409);
  return { version: 1, sourceHash: hash(row.sourceHash), planHash: hash(row.planHash), entries: [...names.values()].sort((a, b) => a.path.localeCompare(b.path, "en")), contents: contents.sort((a, b) => a.path.localeCompare(b.path, "en")), totalBytes };
}
export function encodeComponentOutput(output: ComponentOutput): Buffer {
  const bytes = gzipSync(Buffer.from(JSON.stringify(validateComponentOutput(output))), { level: 6 });
  ensure(bytes.length <= componentOutputLimits.compressed, "COMPONENT_OUTPUT_LIMIT", "بستهٔ فشردهٔ component از سقف انتشار بیشتر است.", 413); return bytes;
}
export function decodeComponentOutput(bytes: Buffer, secrets: readonly string[] = []): ComponentOutput {
  ensure(bytes.length <= componentOutputLimits.compressed, "COMPONENT_OUTPUT_LIMIT", "حجم انتقال خروجی بیش از سقف است.", 413);
  try { return validateComponentOutput(JSON.parse(gunzipSync(bytes, { maxOutputLength: componentOutputLimits.wire }).toString("utf8")), secrets); }
  catch (error) { if (error instanceof Error && "code" in error && typeof error.code === "string" && error.code.startsWith("COMPONENT_")) throw error;
    ensure(false, "COMPONENT_OUTPUT_INVALID", "ساختار انتقال خروجی component قابل بررسی نیست.", 409); }
}
