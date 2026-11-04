import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { posix, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const slug = text => text.toLowerCase().replace(/<[^>]+>/g, "").replace(/`/g, "")
  .replace(/[^\p{L}\p{N}_\s-]/gu, "").replace(/\s/g, "-");
const unquote = value => value.replace(/&amp;/g, "&");
function prose(source) {
  let fence = null;
  return source.split(/\r?\n/).map(line => {
    const marker = line.match(/^\s*(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1][0];
      else if (marker[1][0] === fence) fence = null;
      return "";
    }
    return fence ? "" : line;
  }).join("\n");
}
function anchors(source) {
  const result = new Set(), seen = new Map();
  for (const match of prose(source).matchAll(/<(?:a|h[1-6])\b[^>]*\b(?:id|name)=["']([^"']+)["']/gi)) result.add(match[1]);
  for (const line of prose(source).split("\n")) {
    const heading = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
    if (!heading) continue;
    const base = slug(heading[1]), index = seen.get(base) ?? 0;
    seen.set(base, index + 1); result.add(`${base}${index ? `-${index}` : ""}`);
  }
  return result;
}

export function auditDocumentation(root) {
  root = realpathSync(root);
  const listed = execFileSync("git", ["-C", root, "ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
  const files = [...new Set(listed)], known = new Set(files), documents = files.filter(name => /\.mdx?$/i.test(name) && existsSync(resolve(root, name)));
  const issues = [], cache = new Map();
  const read = name => {
    if (cache.has(name)) return cache.get(name);
    const path = resolve(root, name), canonical = realpathSync(path);
    if (!canonical.startsWith(root + sep) || statSync(canonical).size > 4 * 1024 * 1024) throw Error("Documentation path or size is outside the audit bounds");
    const text = readFileSync(canonical, "utf8"); cache.set(name, text); return text;
  };
  for (const name of documents) {
    const text = read(name);
    const localPath = /(?<![A-Za-z0-9])(?:[A-Za-z]:[\\/](?!\/)|\/(?:Users|home)\/[A-Za-z0-9._-]+\/)/;
    const credential = /box-ai-[A-Za-z0-9]{20,}|eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/;
    for (const [index, line] of text.split(/\r?\n/).entries()) {
      if (localPath.test(line)) issues.push({ file: name, line: index + 1, code: "machine-path" });
      if (credential.test(line)) issues.push({ file: name, line: index + 1, code: "credential-shaped-value" });
    }
    const content = prose(text), destinations = [
      ...[...content.matchAll(/!?\[[^\]\n]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g)].map(match => match[1]),
      ...[...content.matchAll(/<(?:a|img|source)\b[^>]*\b(?:href|src|srcset)=["']([^"']+)["']/gi)].map(match => match[1]),
      ...[...content.matchAll(/^\s{0,3}\[[^\]\n]+\]:\s*<?([^\s>]+)>?/gm)].map(match => match[1]),
    ];
    for (const raw of destinations) {
      let url;
      try { url = decodeURIComponent(unquote(raw)); }
      catch { issues.push({ file: name, code: "invalid-url-encoding" }); continue; }
      if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(url) || url.startsWith("//")) continue;
      const [path, fragment] = url.split("#"), clean = path.split("?")[0];
      const target = clean ? posix.normalize(posix.join(posix.dirname(name), clean)) : name;
      if (target.startsWith("../") || posix.isAbsolute(target) || !existsSync(resolve(root, target))) {
        issues.push({ file: name, code: "missing-local-target", target }); continue;
      }
      if (!statSync(resolve(root, target)).isDirectory() && !known.has(target)) {
        issues.push({ file: name, code: "target-case-or-untracked", target }); continue;
      }
      if (fragment && /\.mdx?$/i.test(target) && !anchors(read(target)).has(fragment)) issues.push({ file: name, code: "missing-anchor", target: `${target}#${fragment}` });
    }
  }
  return { documents: documents.length, issues };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = auditDocumentation(process.argv[2] ?? process.cwd());
  for (const issue of report.issues) console.error(JSON.stringify(issue));
  console.log(JSON.stringify({ documents: report.documents, errors: report.issues.length }));
  process.exitCode = report.issues.length ? 1 : 0;
}
