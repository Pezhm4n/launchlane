import semver from "semver";
import { fixtureCredentialLabel, maskNonCredentialSyntax, unitCredentialVector } from "./source-expressions.ts";

const sensitiveAssignment =
  /(\b[\w-]*(?:api[_-]?key|token|password|secret|authorization)[\w-]*["']?\s*[:=]\s*)("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s"',;}{]+)/gi;
const credentialUrl = /\b[a-z][a-z0-9+.-]*:\/\/[^\s/@:]+:[^\s/@]+@[^\s"'<>`]+/gi;
// Source contains package names and design prose such as "js-tokens" and "Motion tokens:".
// Credential keys still match, including camelCase/prefixed names; plural vocabulary does not.
const sourceSensitiveAssignment =
  /(\b[\w-]*(?:api[_-]?key|token|password|secret|authorization)(?:[_-]?(?:value|key|hash))?["']?\s*(?::|=(?!=|>))\s*)("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s"',;}{]+)/gi;

export function redact(value: string, secrets: readonly string[] = []): string {
  return scrub(value, secrets, sensitiveAssignment);
}

function scrub(value: string, secrets: readonly string[], assignment: RegExp, source = false, python = false, javascript = false, testPlaceholders = false, documentation = false, unitFixtures = false): string {
  let result = value
    .replace(credentialUrl, match => {
      if (javascript && testPlaceholders) {
        try {
          const url = new URL(match), host = url.hostname.toLowerCase();
          if (["user", "username"].includes(url.username) && ["pass", "password"].includes(url.password) &&
            (/\.(?:test|invalid|example)$/.test(host) || /(?:^|\.)example\.(?:com|net|org)$/.test(host))) return match;
        } catch { /* A malformed value is never a public fixture. */ }
      }
      return "[REDACTED_URL]";
    })
    .replace(/\bBearer\s+[^\s"'<>]+/gi, match => source && /^Bearer (?:token|tokens|JWT)[.,;:]?$/i.test(match) || javascript && (testPlaceholders && fixtureCredentialLabel(match.replace(/^Bearer\s+/i, "")) || unitFixtures && unitCredentialVector(match.replace(/^Bearer\s+/i, ""))) ? match : "Bearer [REDACTED]")
    .replace(assignment, (match, prefix: string, assigned: string, offset: number, original: string) => {
      const quote = assigned.startsWith('"') ? '"' : assigned.startsWith("'") ? "'" : "";
      // Public setup templates contain no credential; exact installed secrets are still checked below.
      const literal = quote ? assigned.slice(1, -1) : assigned;
      if (source && quote && literal === "") return match;
      if (javascript && testPlaceholders && quote && fixtureCredentialLabel(literal.replace(/^(?:Bearer|Basic)\s+/i, ""))) return match;
      if (javascript && unitFixtures && fixtureCredentialLabel(literal)) return match;
      if (javascript && unitFixtures && /^password(?:[_-]?hash)?["']?\s*:\s*$/i.test(prefix) && unitCredentialVector(literal)) return match;
      if (javascript && unitFixtures && quote && /^authorization["']?\s*[:=]/i.test(prefix) && /^Bearer\s+/i.test(literal) && unitCredentialVector(literal.replace(/^Bearer\s+/i, ""))) return match;
      // A literal omission marker in documentation is not a deployed credential.
      if (source && documentation && !quote && literal === "..." && !secrets.includes(literal)) return match;
      // Minified input-type maps use e.g. password:!0; a boolean/null expression contains no credential value.
      if (source && !quote && /^(?:true|false|null|undefined|!0|!1)$/.test(literal)) return match;
      // Public autocomplete alternatives in a complete ternary are UI labels, not credential-map keys.
      // Keep real assignments, object maps, operators and exact installed-secret checks conservative.
      if (javascript && quote && /^(?:new-password|current-password)["']?\s*:\s*$/.test(prefix) &&
        /^(?:new-password|current-password)$/.test(literal) && /\?\s*["']$/.test(original.slice(Math.max(0, offset - 128), offset)) &&
        /^\s*(?:[),;}\]]|$)/.test(original.slice(offset + match.length))) return match;
      // Test API keys may be explicit dummy labels or deliberately invalid words with spaces.
      if (source && testPlaceholders && quote && /api[_-]?key["']?\s*:\s*$/i.test(prefix) &&
        (/^(?:synthetic|dummy|fixture|test|fake|sample)[-_](?:[a-z]+[-_]*)+$/i.test(literal) || /^[A-Za-z]+(?: [A-Za-z]+)+$/.test(literal) && literal.length <= 32)) return match;
      // Deterministic request IDs in tests are public fixtures, never authentication-token fields.
      if (javascript && testPlaceholders && quote && /^token["']?\s*:\s*$/i.test(prefix) && /^(?:(?:page|request|search|result)[-_]?\d{1,6}|(?:new|old|stale|current|first|second|next|previous)[-_](?:page|request|search|result)|(?:page|request|search|result|manual|assistant)[-_](?:first|second|later|earlier))$/.test(literal)) return match;
      // A complete variable/member reference contains no literal credential; operators/defaults remain rejected.
      if (javascript && !quote && /^[A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*)*(?:\(\))?$/.test(assigned) && /^\s*(?:[,;}]|$)/.test(original.slice(offset + match.length))) return match;
      if (javascript && !quote && /^[A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*)*(?:\(\))?$/.test(assigned) && /^\s*(?:\|\||\?\?)\s*(?:null|undefined|(['"])\1)\s*(?:[,;}]|$)/.test(original.slice(offset + match.length))) return match;
      // Python annotations and variable expressions are not literal credentials. Known installed values are checked independently.
      if (python && (!quote && !/^\d/.test(assigned) || quote && literal === "")) return match;
      if (source && /^YOUR_(?:[A-Z]+_)*(?:KEY|TOKEN|SECRET|PASSWORD)$/.test(literal)) return match;
      return `${prefix}${quote}[REDACTED]${quote}`;
    })
    .replace(
      /-----BEGIN [\w ]*PRIVATE KEY-----[\s\S]*?(?:-----END [\w ]*PRIVATE KEY-----|$)/g,
      "[REDACTED_PRIVATE_KEY]",
    );
  for (const secret of secrets) {
    if (secret.length < 4) continue;
    // JSON/log escaping must not turn a known secret into apparently harmless evidence.
    for (const variant of new Set([secret, JSON.stringify(secret).slice(1, -1), encodeURIComponent(secret.toWellFormed())]))
      result = result.split(variant).join("[REDACTED]");
  }
  return result;
}

export function containsCredential(value: string, secrets: readonly string[] = []): boolean {
  return redact(value, secrets) !== value;
}

export function containsSourceCredential(value: string, secrets: readonly string[] = [], path = ""): boolean {
  for (const secret of secrets) if (secret.length >= 4 && [secret, JSON.stringify(secret).slice(1, -1), encodeURIComponent(secret.toWellFormed())].some(part => value.includes(part))) return true;
  if (path.endsWith(".sql")) {
    const normalized = value.replace(/^\s*--[^\r\n]*$/gm, line => line.replace(/postgres(?:ql)?:\/\/[A-Za-z_]\w{0,63}:(?:YOUR_)?PASS(?:WORD)?@(?:YOUR_)?HOST(?:NAME)?:PORT\/(?:YOUR_)?(?:DB|DBNAME|DATABASE)(?:\?sslmode=(?:require|verify-full|disable))?/gi, url => url.replace("://", "//")));
    return scrub(normalized, secrets, sourceSensitiveAssignment, true) !== normalized;
  }
  if (/(?:^|\/)(?:locales|translations|i18n)(?:\/[^/]+)*\/(?:translation|common|auth)\.json$/.test(path)) {
    try {
      const parsed: unknown = JSON.parse(value), stack: unknown[] = [parsed]; let seen = 0;
      while (stack.length) {
        const current = stack.pop(); if (++seen > 20000) break;
        if (!current || typeof current !== "object") continue;
        if (Array.isArray(current)) { stack.push(...current); continue; }
        for (const [key, text] of Object.entries(current)) {
          if (typeof text !== "string") { stack.push(text); continue; }
          const label = text.length <= 512 && (/[\p{Script=Arabic}]/u.test(text) || /\s/.test(text) || /^(?:password|token|authorization|authentication|secret)$/i.test(text)) &&
            !/\b(?:sk[-_]|gh[pousr]_|github_|eyJ)[A-Za-z0-9_-]{12,}|-----BEGIN|\bBearer\s+\S+/i.test(text);
          if (label && /(?:api[_-]?key|token|password|secret|authorization)(?:[_-]?(?:value|key|hash))?$/i.test(key))
            Object.defineProperty(current, key, { value: null, enumerable: true, configurable: true, writable: true });
        }
      }
      const normalized = JSON.stringify(parsed);
      return scrub(normalized, secrets, sourceSensitiveAssignment, true) !== normalized;
    } catch { /* Invalid translations retain the conservative source scan. */ }
  }
  if (/(?:^|\/)package(?:-lock)?\.json$/.test(path)) {
    // Npm packages such as jsonwebtoken/gtoken are dependency names, not credential fields.
    // Only actual semver values in the manifest's dependency maps receive this exception.
    for (const secret of secrets) if (secret.length >= 4 && [secret, JSON.stringify(secret).slice(1, -1), encodeURIComponent(secret.toWellFormed())].some(part => value.includes(part))) return true;
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const normalize = (manifest: object) => {
          const row: Record<string, unknown> = Object.fromEntries(Object.entries(manifest));
          for (const field of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
            const dependencies = row[field];
            if (!dependencies || typeof dependencies !== "object" || Array.isArray(dependencies)) continue;
            for (const [name, version] of Object.entries(dependencies)) if (/^(?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/.test(name) && typeof version === "string" && version.length <= 160 && semver.validRange(version) !== null)
              Object.defineProperty(dependencies, name, { value: null, enumerable: true, configurable: true, writable: true });
          }
        };
        normalize(parsed);
        if (path.endsWith("package-lock.json") && "packages" in parsed && parsed.packages && typeof parsed.packages === "object" && !Array.isArray(parsed.packages))
          for (const entry of Object.values(parsed.packages)) if (entry && typeof entry === "object" && !Array.isArray(entry)) normalize(entry);
        const normalized = JSON.stringify(parsed);
        return scrub(normalized, secrets, sourceSensitiveAssignment, true) !== normalized;
      }
    } catch { /* Invalid manifests retain the normal conservative scan below. */ }
  }
  const test = /(?:^|\/)(?:tests?|testing|unit|__tests__|e2e)(?:\/|$)|\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(path);
  const unitFixtures = /(?:^|\/)(?:unit|__tests__)(?:\/|$)|\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(path);
  if (/\.[cm]?[jt]sx?$/.test(path)) {
    const normalized = value.replace(/\b((?:[A-Za-z_$][\w$]*)?(?:api[_-]?key|token|password|secret|authorization))\s*:\s*string(?:\s*\|\s*(?:null|undefined))*\s*(?=[=;,) }\r\n])/gi, "$1 ");
    if (scrub(normalized, secrets, sourceSensitiveAssignment, true, false, true, test, false, unitFixtures) === normalized) return false;
    const expressions = maskNonCredentialSyntax(value, test);
    return scrub(expressions, secrets, sourceSensitiveAssignment, true, false, true, test, false, unitFixtures) !== expressions;
  }
  if (path.endsWith(".py")) {
    for (const secret of secrets) {
      if (secret.length >= 4 && [secret, JSON.stringify(secret).slice(1, -1), encodeURIComponent(secret.toWellFormed())].some(part => value.includes(part))) return true;
    }
    // Preserve assignment detection after a Python type annotation or dataclass default.
    const normalized = value.replace(/(\b\w*(?:api_key|token|password|secret)\s*(?::\s*str\s*)?=\s*)[rubf]{0,2}("""|''')([\s\S]*?)\2/gi,
      (_match, prefix: string, _quote: string, body: string) => `${prefix}${JSON.stringify(body)}`)
      .replace(/\b([A-Za-z_]\w*)\s*:\s*str\s*(?==)/g, "$1 ")
      .replace(/(\b\w*(?:api_key|token|password|secret)\s*=\s*)field\(\s*default\s*=/gi, "$1")
      .replace(/f(["'])(?:Bearer )?\{[A-Za-z_][A-Za-z0-9_.]*\}\1/g, "credential_reference")
      .replace(/([:=]\s*)[rubf]{1,2}(?=["'])/gi, "$1");
    return scrub(normalized, secrets, sourceSensitiveAssignment, true, true, false, test) !== normalized;
  }
  return scrub(value, secrets, sourceSensitiveAssignment, true, false, false, false, /\.mdx?$/.test(path)) !== value;
}
