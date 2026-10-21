const sensitiveAssignment =
  /(\b[\w-]*(?:api[_-]?key|token|password|secret|authorization)[\w-]*["']?\s*[:=]\s*)("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s"',;}{]+)/gi;
const credentialUrl = /\b[a-z][a-z0-9+.-]*:\/\/[^\s/@:]+:[^\s/@]+@[^\s]+/gi;

export function redact(value: string, secrets: readonly string[] = []): string {
  let result = value
    .replace(credentialUrl, "[REDACTED_URL]")
    .replace(/\bBearer\s+[^\s"'<>]+/gi, "Bearer [REDACTED]")
    .replace(sensitiveAssignment, (_match, prefix: string, assigned: string) => {
      const quote = assigned.startsWith('"') ? '"' : assigned.startsWith("'") ? "'" : "";
      return `${prefix}${quote}[REDACTED]${quote}`;
    })
    .replace(
      /-----BEGIN [\w ]*PRIVATE KEY-----[\s\S]*?(?:-----END [\w ]*PRIVATE KEY-----|$)/g,
      "[REDACTED_PRIVATE_KEY]",
    );
  for (const secret of secrets)
    if (secret.length >= 4) result = result.split(secret).join("[REDACTED]");
  return result;
}

export function containsCredential(value: string, secrets: readonly string[] = []): boolean {
  return redact(value, secrets) !== value;
}
