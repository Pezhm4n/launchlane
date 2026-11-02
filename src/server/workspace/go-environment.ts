import { ensure } from "../errors.ts";
type Token = { kind: "name" | "string" | "punct"; text: string };

/** Bounded lexical discovery only. Ambiguous bindings/dynamic keys grant no inferred input. */
export function inspectGoEnvironment(source: string): { names: string[]; unresolved: boolean; imports: { path: string; alias: string }[]; hasMain: boolean } {
  const tokens: Token[] = []; let offset = 0;
  while (offset < source.length) {
    ensure(tokens.length < 200000, "ENV_DISCOVERY_LIMIT", "بررسی نام تنظیمات Go بیش از سقف است.", 413);
    const char = source[offset] ?? "";
    if (/\s/.test(char)) { offset++; continue; }
    if (source.startsWith("//", offset)) { const end = source.indexOf("\n", offset); offset = end < 0 ? source.length : end; continue; }
    if (source.startsWith("/*", offset)) { const end = source.indexOf("*/", offset + 2); offset = end < 0 ? source.length : end + 2; continue; }
    if (char === '"' || char === "`" || char === "'") {
      const quote = char; offset++; const start = offset; let escaped = false;
      while (offset < source.length && source[offset] !== quote) { if (quote !== "`" && source[offset] === "\\") { escaped = true; offset++; } offset++; }
      tokens.push({ kind: quote === "'" ? "punct" : "string", text: !escaped && offset < source.length ? source.slice(start, offset) : "" }); offset++; continue;
    }
    const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(source.slice(offset))?.[0];
    if (name) { tokens.push({ kind: "name", text: name }); offset += name.length; } else { tokens.push({ kind: "punct", text: char }); offset++; }
  }
  const aliases = new Set<string>(), imports: { path: string; alias: string }[] = []; let unresolved = false;
  for (let index = 0; index < tokens.length; index++) if (tokens[index]?.text === "import" && tokens[index]?.kind === "name") {
    const grouped = tokens[index + 1]?.text === "("; let cursor = index + 1;
    if (grouped) cursor++;
    for (; cursor < tokens.length; cursor++) {
      const token = tokens[cursor]; if (token?.kind === "string") {
        const previous = tokens[cursor - 1], parts = token.text.split("/"), last = parts.at(-1) ?? "", base = /^v[0-9]+$/.test(last) ? parts.at(-2) ?? "" : last;
        const alias = previous?.kind === "name" && previous.text !== "import" ? previous.text : previous?.text === "." ? "." : base.replace(/^go-/, "").replace(/[^A-Za-z0-9_]/g, "");
        imports.push({ path: token.text, alias });
        if (token.text === "os") { const previous = tokens[cursor - 1]; if (previous?.text === ".") unresolved = true; else aliases.add(previous?.kind === "name" && previous.text !== "import" ? previous.text : "os"); }
        if (!grouped) break;
      }
      if (grouped && token?.text === ")") break;
    }
  }
  const names = new Set<string>();
  for (const alias of aliases) {
    if (alias === "_") continue;
    const shadowed = tokens.some((token, index) => token.text === alias && (tokens[index - 1]?.text === "var" || tokens[index + 1]?.text === ":" || tokens[index + 1]?.text === "=" || tokens[index - 1]?.text === "(" && tokens[index + 1]?.kind === "name"));
    for (let index = 0; index < tokens.length; index++) {
      if (tokens[index]?.text !== alias || tokens[index - 1]?.text === "." || tokens[index + 1]?.text !== "." || !["Getenv", "LookupEnv"].includes(tokens[index + 2]?.text ?? "") || tokens[index + 3]?.text !== "(") continue;
      const argument = tokens[index + 4];
      if (shadowed || argument?.kind !== "string" || !/^[A-Z][A-Z0-9_]{0,63}$/.test(argument.text) || tokens[index + 5]?.text !== ")") unresolved = true;
      else names.add(argument.text);
    }
  }
  const hasMain = tokens.some((token, index) => token.kind === "name" && token.text === "func" && tokens[index + 1]?.kind === "name" && tokens[index + 1]?.text === "main" && tokens[index + 2]?.text === "(");
  return { names: [...names].sort(), unresolved, imports, hasMain };
}
