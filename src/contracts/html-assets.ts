import { ensure } from "../server/errors.ts";

// One document can legitimately reference dozens of chunks. The oracle is a bounded
// sample, never a crawler: only render-blocking/executable same-origin references are read.
export const htmlAssetLimit = 12;

export type HtmlAssetKind = "script" | "style";
export type HtmlAssetReference = Readonly<{ path: string; kind: HtmlAssetKind }>;
export type BlockedHtmlAsset = Readonly<{ path: string; kind: HtmlAssetKind; reason: "insecure" }>;
export type HtmlAssetPlan = Readonly<{
  references: readonly HtmlAssetReference[];
  blocked: readonly BlockedHtmlAsset[];
  external: number;
  invalid: number;
  omitted: number;
  inlineScripts: number;
}>;

function attribute(attributes: string, name: string): string | null {
  const pattern = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\x60]+))`, "i");
  const match = pattern.exec(attributes);
  const value = match?.[1] ?? match?.[2] ?? match?.[3];
  return value === undefined ? null : value;
}

function decodeAttribute(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&#38;", "&")
    .replaceAll("&#x26;", "&")
    .replaceAll("&#X26;", "&");
}

function safeAssetPath(value: string): boolean {
  const queryAt = value.indexOf("?");
  const pathname = queryAt === -1 ? value : value.slice(0, queryAt);
  const query = queryAt === -1 ? "" : value.slice(queryAt + 1);
  return /^\/(?:[A-Za-z0-9_./%~!$&'()*+,;=:@-]*)$/.test(pathname) &&
    !pathname.startsWith("//") &&
    !pathname.split("/").includes("..") &&
    pathname.length <= 400 &&
    /^(?:[A-Za-z0-9_./%~!$&'()*+,;=:@?-]*)$/.test(query) &&
    query.length <= 256;
}

function isInlineContent(attributes: string): boolean {
  const type = attribute(attributes, "type");
  if (!type) return false;
  const value = type.trim().toLowerCase();
  return value === "application/json" || value === "application/ld+json" ||
    value === "importmap" || value === "speculationrules" || value.startsWith("text/");
}

/**
 * Extract the bounded set of same-origin script and stylesheet references from an
 * already accepted HTML document. A reference is resolved against the exact document
 * path; cross-origin assets stay external, and cleartext same-host assets are reported
 * as blocked because a browser will refuse them on an HTTPS page.
 */
export function htmlAssetReferences(html: string, documentPath: string, origin: string): HtmlAssetPlan {
  ensure(documentPath.startsWith("/") && !documentPath.startsWith("//") && !documentPath.split("/").includes(".."),
    "PROBE_TARGET_DENIED", "مسیر سند بررسی معتبر نیست.", 403);
  let base = new URL(documentPath, origin);
  ensure(base.origin === origin, "PROBE_TARGET_DENIED", "مبدأ سند با مقصد بررسی برابر نیست.", 403);
  // A document <base> changes how every relative reference resolves; honoring it
  // prevents both false failures and a same-origin claim for an external target.
  const baseTag = /<base\b([^>]*)>/i.exec(html);
  if (baseTag) {
    const href = attribute(baseTag[1] ?? "", "href");
    if (href !== null) {
      try { base = new URL(decodeAttribute(href).trim(), base); } catch { /* an unusable base leaves the document base */ }
    }
  }
  const references: HtmlAssetReference[] = [];
  const blocked: BlockedHtmlAsset[] = [];
  const seen = new Set<string>();
  let external = 0, invalid = 0, omitted = 0, inlineScripts = 0;

  function add(raw: string, kind: HtmlAssetKind): void {
    const value = decodeAttribute(raw).trim();
    if (!value || value.startsWith("#")) return;
    if (/^(?:data|blob|javascript|mailto|tel|about):/i.test(value)) return;
    let url: URL;
    try { url = new URL(value, base); } catch { invalid++; return; }
    if (url.protocol === "http:") {
      const path = url.pathname + url.search;
      if (blocked.length < htmlAssetLimit) blocked.push({ path: path.length <= 400 ? path : "/", kind, reason: "insecure" });
      return;
    }
    if (url.origin !== origin) { external++; return; }
    if (url.protocol !== "https:") { invalid++; return; }
    const path = url.pathname + url.search;
    if (!safeAssetPath(path)) { invalid++; return; }
    if (seen.has(path)) return;
    seen.add(path);
    if (references.length >= htmlAssetLimit) { omitted++; return; }
    references.push({ path, kind });
  }

  const tags = /<!--[\s\S]*?-->|<script\b([^>]*)>([\s\S]*?)<\/script\s*>|<script\b([^>]*)\/?\s*>|<link\b([^>]*)\/?\s*>/gi;
  for (let match = tags.exec(html); match !== null; match = tags.exec(html)) {
    if (match[0].startsWith("<!--")) continue;
    const scriptAttributes = match[1] ?? match[3];
    if (scriptAttributes !== undefined) {
      const source = attribute(scriptAttributes, "src");
      if (source !== null) add(source, "script");
      else if (!isInlineContent(scriptAttributes)) inlineScripts++;
      continue;
    }
    const linkAttributes = match[4];
    if (linkAttributes === undefined) continue;
    const rel = attribute(linkAttributes, "rel");
    if (rel === null || !rel.toLowerCase().split(/\s+/).includes("stylesheet")) continue;
    const href = attribute(linkAttributes, "href");
    if (href !== null) add(href, "style");
  }
  return { references, blocked, external, invalid, omitted, inlineScripts };
}
