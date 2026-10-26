import ignore from "ignore";
import { ensure } from "../server/errors.ts";

export type SourceIgnoreFile = Readonly<{ path: string; content: string }>;
export const ignoreFileMaxBytes = 16 * 1024;
export const ignoreFileMaxCount = 32;

/** Portable gitignore semantics; private-path policy is a separate, non-overridable boundary. */
export function sourceIgnore(files: readonly SourceIgnoreFile[]) {
  ensure(files.length <= ignoreFileMaxCount, "SOURCE_IGNORE_LIMIT", "تعداد فایل‌های قواعد بسته‌بندی بیش از سقف مجاز است.", 413);
  let bytes = 0, rules = 0;
  const seen = new Set<string>();
  const scopes = files.map(file => {
    const parts = file.path.split("/");
    ensure(parts.at(-1) === ".gitignore" && file.path.length <= 512 && parts.every(part => part && part !== "." && part !== ".." && !/[\\:\0]/.test(part)) && !seen.has(file.path),
      "SOURCE_IGNORE_INVALID", "مسیر قواعد بسته‌بندی معتبر نیست.", 409);
    seen.add(file.path);
    const size = new TextEncoder().encode(file.content).byteLength; bytes += size; rules += file.content.split(/\r?\n/).length;
    ensure(size <= ignoreFileMaxBytes && bytes <= 64 * 1024 && rules <= 2048, "SOURCE_IGNORE_LIMIT", "قواعد بسته‌بندی بیش از سقف بررسی هستند.", 413);
    return { directory: parts.slice(0, -1).join("/"), matcher: ignore({ ignorecase: false }).add(file.content) };
  }).sort((a, b) => a.directory.split("/").length - b.directory.split("/").length || a.directory.localeCompare(b.directory));
  return (path: string, directory = false): boolean => {
    const parts = path.replace(/\/$/, "").split("/");
    ensure(path.length <= 512 && parts.every(part => part && part !== "." && part !== ".." && !/[\\:\0]/.test(part)), "SOURCE_IGNORE_INVALID", "مسیر بررسی بسته‌بندی معتبر نیست.", 409);
    // A child cannot re-include a path whose parent directory was excluded.
    for (let depth = 1; depth <= parts.length; depth++) {
      const candidate = parts.slice(0, depth).join("/"), isDirectory = depth < parts.length || directory;
      let excluded = false;
      for (const scope of scopes) {
        if (scope.directory && !candidate.startsWith(`${scope.directory}/`)) continue;
        const relative = scope.directory ? candidate.slice(scope.directory.length + 1) : candidate;
        const result = scope.matcher.test(relative + (isDirectory ? "/" : ""));
        if (result.ignored) excluded = true;
        else if (result.unignored) excluded = false;
      }
      if (excluded) return true;
    }
    return false;
  };
}
