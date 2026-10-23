const sensitiveAssignment =
  /(\b[\w-]*(?:api[_-]?key|token|password|secret|authorization)[\w-]*["']?\s*[:=]\s*)("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s"',;}{]+)/gi;
const credentialUrl = /\b[a-z][a-z0-9+.-]*:\/\/[^\s/@:]+:[^\s/@]+@[^\s]+/gi;
// Source contains package names and design prose such as "js-tokens" and "Motion tokens:".
// Credential keys still match, including camelCase/prefixed names; plural vocabulary does not.
const sourceSensitiveAssignment =
  /(\b[\w-]*(?:api[_-]?key|token|password|secret|authorization)(?:[_-]?(?:value|key|hash))?["']?\s*[:=]\s*)("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s"',;}{]+)/gi;

export function redact(value: string, secrets: readonly string[] = []): string {
  return scrub(value, secrets, sensitiveAssignment);
}

function scrub(value: string, secrets: readonly string[], assignment: RegExp, source = false, python = false, javascript = false, testPlaceholders = false): string {
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
    .replace(/\bBearer\s+[^\s"'<>]+/gi, "Bearer [REDACTED]")
    .replace(assignment, (match, prefix: string, assigned: string, offset: number, original: string) => {
      const quote = assigned.startsWith('"') ? '"' : assigned.startsWith("'") ? "'" : "";
      // Public setup templates contain no credential; exact installed secrets are still checked below.
      const literal = quote ? assigned.slice(1, -1) : assigned;
      // Minified input-type maps use e.g. password:!0; a boolean/null expression contains no credential value.
      if (source && !quote && /^(?:true|false|null|undefined|!0|!1)$/.test(literal)) return match;
      // Test API keys may be explicit dummy labels or deliberately invalid words with spaces.
      if (source && testPlaceholders && quote && /api[_-]?key["']?\s*:\s*$/i.test(prefix) &&
        (/^(?:synthetic|dummy|fixture|test|fake|sample)[-_](?:[a-z]+[-_]*)+$/i.test(literal) || /^[A-Za-z]+(?: [A-Za-z]+)+$/.test(literal) && literal.length <= 32)) return match;
      // Deterministic request IDs in tests are public fixtures, never authentication-token fields.
      if (javascript && testPlaceholders && quote && /^token["']?\s*:\s*$/i.test(prefix) && /^(?:(?:page|request|search|result)[-_]?\d{1,6}|(?:new|old|stale|current|first|second|next|previous)[-_](?:page|request|search|result)|(?:page|request|search|result|manual|assistant)[-_](?:first|second|later|earlier))$/.test(literal)) return match;
      // A complete variable/member reference contains no literal credential; operators/defaults remain rejected.
      if (javascript && !quote && /^[A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*)*(?:\(\))?$/.test(assigned) && /^\s*(?:[,;}]|$)/.test(original.slice(offset + match.length))) return match;
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
  const test = /(?:^|\/)(?:tests?|unit|__tests__)(?:\/|$)|\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(path);
  if (/\.[cm]?[jt]sx?$/.test(path)) {
    const normalized = value.replace(/\b([A-Za-z_$][\w$]*(?:api_key|token|password|secret|authorization))\s*:\s*string\s*(?==)/gi, "$1 ");
    return scrub(normalized, secrets, sourceSensitiveAssignment, true, false, true, test) !== normalized;
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
  return scrub(value, secrets, sourceSensitiveAssignment, true) !== value;
}
