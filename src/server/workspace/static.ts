import { posix } from "node:path";
import { ensure } from "../errors.ts";
import type { SourceFile } from "./inspect.ts";

// Read-only readiness for plain files; deployed Nginx and browser behavior require their own verification.
export function validateStaticFiles(files: readonly SourceFile[], manifestPaths = files.map(file => file.path)): { localAssets: string[]; externalAssets: number } {
  const paths = new Set(manifestPaths), assets = new Set<string>(); let externalAssets = 0;
  const entry = files.find(file => file.path === "index.html");
  ensure(entry && /<(?:!doctype\s+html|html)[\s>]/i.test(entry.content.toString("utf8")), "STATIC_ENTRY_REQUIRED", "صفحهٔ اصلی معتبر سایت پیدا نشد؛ پوشهٔ دارای index.html را انتخاب کنید.", 409);
  for (const file of files) {
    if (!/\.(?:html?|css|m?js)$/i.test(file.path)) continue;
    const source = file.content.toString("utf8");
    if (/\.(?:m?js)$/i.test(file.path)) ensure(!/\b(?:require\s*\(|process\.env\b)|\b(?:import|export)\s+(?:[^;\n]*?\s+from\s*)?['"](?:node:|[A-Za-z@])/.test(source),
      "STATIC_BUILD_REQUIRED", "این فایل JavaScript به آماده‌سازی یا اجرای سرور نیاز دارد؛ انتشار فایل خام برای آن کافی نیست.", 409);
    const references = /\.css$/i.test(file.path) ? [...source.matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/gi)].map(match => match[1])
      : /\.html?$/i.test(file.path) ? [...source.matchAll(/<(?:script|img|link|source|video|audio)\b[^>]*?\b(?:src|href|poster)\s*=\s*['"]([^'"]+)['"]/gi)].map(match => match[1]) : [];
    for (const reference of references) {
      if (!reference || reference.startsWith("#") || reference.startsWith("data:")) continue;
      if (/^(?:https?:)?\/\//i.test(reference)) { externalAssets++; continue; }
      ensure(!/^[a-z][a-z\d+.-]*:/i.test(reference), "STATIC_ASSET_INVALID", "نشانی یکی از فایل‌های صفحه برای انتشار عمومی معتبر نیست.", 409);
      let path: string;
      try { path = decodeURIComponent(reference.split(/[?#]/)[0] ?? ""); } catch { path = ""; }
      if (!path) continue;
      const resolved = posix.normalize(path.startsWith("/") ? path.slice(1) : posix.join(posix.dirname(file.path), path));
      ensure(!resolved.startsWith("../") && paths.has(resolved), "STATIC_ASSET_MISSING", `فایل «${resolved.slice(0, 160)}» در پوشه نیست؛ صفحه بدون آن کامل نمایش داده نمی‌شود. فایل را همراه پروژه انتخاب کنید.`, 409);
      assets.add(resolved);
    }
  }
  return { localAssets: [...assets].sort(), externalAssets };
}
