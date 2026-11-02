import { ensure } from "../errors.ts";

/** Literal name discovery only; comments, string contents and member calls grant no inferred input. */
export function phpEnvironmentNames(source: string): string[] {
  const tokens: { kind: "name" | "string" | "punct"; text: string }[] = []; let offset = 0, active = false;
  while (offset < source.length) {
    ensure(tokens.length < 200000, "ENV_DISCOVERY_LIMIT", "بررسی نام تنظیمات PHP از سقف بیشتر است.", 413);
    if (!active) { const next = source.indexOf("<?", offset); if (next < 0) break; offset = next + (source.slice(next, next + 5).toLowerCase() === "<?php" ? 5 : 2); active = true; continue; }
    if (source.startsWith("?>", offset)) { active = false; offset += 2; continue; }
    const char = source[offset] ?? "";
    if (/\s/.test(char)) { offset++; continue; }
    if (source.startsWith("//", offset) || char === "#") { const end = source.indexOf("\n", offset); offset = end < 0 ? source.length : end; continue; }
    if (source.startsWith("/*", offset)) { const end = source.indexOf("*/", offset + 2); offset = end < 0 ? source.length : end + 2; continue; }
    if (source.startsWith("<<<", offset)) return []; // Heredoc/interpolation needs a separate syntax-aware contract.
    if (char === "'" || char === '"') { const quote = char, start = ++offset; let escaped = false; while (offset < source.length && source[offset] !== quote) { if (source[offset] === "\\") { escaped = true; offset++; } offset++; } tokens.push({ kind: "string", text: !escaped && offset < source.length ? source.slice(start, offset) : "" }); offset++; continue; }
    const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(source.slice(offset))?.[0];
    if (name) { tokens.push({ kind: "name", text: name }); offset += name.length; } else { tokens.push({ kind: "punct", text: char }); offset++; }
  }
  const names = new Set<string>();
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index], next = tokens[index + 1], argument = tokens[index + 2];
    if (token?.kind === "name" && ["getenv", "env"].includes(token.text) && !["$", "function"].includes(tokens[index - 1]?.text ?? "") && !(tokens[index - 1]?.text === ">" && tokens[index - 2]?.text === "-" || tokens[index - 1]?.text === ":" && tokens[index - 2]?.text === ":") && next?.text === "(" && argument?.kind === "string" && [")", ","].includes(tokens[index + 3]?.text ?? "") && /^[A-Z][A-Z0-9_]{0,63}$/.test(argument.text)) names.add(argument.text);
    if (token?.text === "$" && ["_ENV", "_SERVER"].includes(next?.text ?? "") && argument?.text === "[" && tokens[index + 3]?.kind === "string" && tokens[index + 4]?.text === "]") { const key = tokens[index + 3]?.text ?? ""; if (/^[A-Z][A-Z0-9_]{0,63}$/.test(key) && !(next?.text === "_SERVER" && /^(?:HTTP_|REQUEST_|SERVER_|REMOTE_|SCRIPT_|DOCUMENT_ROOT$|PHP_SELF$|QUERY_STRING$|PATH_INFO$|HTTPS$|GATEWAY_INTERFACE$)/.test(key))) names.add(key); }
  }
  return [...names].sort();
}
