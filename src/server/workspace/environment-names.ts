import { createRequire } from "node:module";
import { ensure } from "../errors.ts";

type Ast = Record<string, unknown> & { type: string };
type Scope = { parent: Scope | null; functionScope: boolean; names: Set<string>; processImports: Map<string, "process" | "env"> };
type PythonToken = { kind: "name" | "string" | "punct"; text: string; start: number; end: number; line: number };
const namePattern = /^[A-Z][A-Z0-9_]{0,63}$/;
const sourceLimit = 4 * 1024 * 1024;
const tokenLimit = 200000;
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function ast(value: unknown): Ast | null { return record(value) && typeof value.type === "string" ? { ...value, type: value.type } : null; }
function children(node: Ast): Ast[] {
  return Object.entries(node).filter(([key]) => !["comments", "tokens", "loc", "extra"].includes(key)).flatMap(([, value]) => {
    if (Array.isArray(value)) return value.flatMap(item => { const child = ast(item); return child ? [child] : []; });
    const child = ast(value); return child ? [child] : [];
  });
}
function bindingNames(value: unknown): string[] {
  const node = ast(value); if (!node) return [];
  if (node.type === "Identifier" && typeof node.name === "string") return [node.name];
  if (node.type === "RestElement") return bindingNames(node.argument);
  if (node.type === "AssignmentPattern") return bindingNames(node.left);
  if (node.type === "ObjectPattern" && Array.isArray(node.properties)) return node.properties.flatMap(value => { const item = ast(value); return item ? bindingNames(item.type === "RestElement" ? item.argument : item.value) : []; });
  return node.type === "ArrayPattern" && Array.isArray(node.elements) ? node.elements.flatMap(bindingNames) : [];
}
function property(value: unknown): string | null {
  const node = ast(value); if (!node || !["MemberExpression", "OptionalMemberExpression"].includes(node.type)) return null;
  const key = ast(node.property);
  return node.computed === false && key?.type === "Identifier" && typeof key.name === "string" ? key.name
    : node.computed === true && (key?.type === "StringLiteral" || key?.type === "Literal") && typeof key.value === "string" ? key.value : null;
}
function unbound(scope: Scope, name: string): boolean {
  for (let current: Scope | null = scope; current; current = current.parent) if (current.names.has(name)) return false;
  return true;
}
function bindingScope(scope: Scope, name: string): Scope | null {
  for (let current: Scope | null = scope; current; current = current.parent) if (current.names.has(name)) return current;
  return null;
}
const parser: unknown = createRequire(import.meta.url)("next/dist/compiled/babel/parser.js");
function javascriptNames(source: string): string[] {
  if (!record(parser) || typeof parser.parse !== "function") return [];
  let root: Ast | null;
  try { root = ast(parser.parse(source, { sourceType: "unambiguous", plugins: ["typescript", "jsx"], allowReturnOutsideFunction: true })); }
  catch { return []; }
  if (!root) return [];
  const top: Scope = { parent: null, functionScope: true, names: new Set(), processImports: new Map() }, scopes = new WeakMap<Ast, Scope>(), all: Ast[] = [], pending = [{ node: root, scope: top }];
  while (pending.length) {
    ensure(all.length < tokenLimit, "ENV_DISCOVERY_LIMIT", "بررسی نام تنظیمات این فایل از سقف مجاز بیشتر است.", 413);
    const next = pending.pop(); if (!next) break;
    const node = next.node, parent = next.scope;
    if (node.type === "TSImportEqualsDeclaration") for (const name of bindingNames(node.id)) parent.names.add(name);
    if (node.type.startsWith("TS") && !["TSAsExpression", "TSSatisfiesExpression", "TSNonNullExpression", "TSTypeAssertion"].includes(node.type)) continue;
    const isFunction = /^(?:FunctionDeclaration|FunctionExpression|ArrowFunctionExpression|ObjectMethod|ClassMethod|ClassPrivateMethod)$/.test(node.type);
    if (["FunctionDeclaration", "ClassDeclaration"].includes(node.type)) for (const name of bindingNames(node.id)) parent.names.add(name);
    const boundary = isFunction || ["BlockStatement", "CatchClause", "ForStatement", "ForOfStatement", "ForInStatement", "StaticBlock", "ClassExpression"].includes(node.type);
    const scope: Scope = boundary ? { parent, functionScope: isFunction, names: new Set(), processImports: new Map() } : parent;
    scopes.set(node, scope); all.push(node);
    if (isFunction) {
      if (Array.isArray(node.params)) for (const parameter of node.params) for (const name of bindingNames(parameter)) scope.names.add(name);
      if (node.type === "FunctionExpression") for (const name of bindingNames(node.id)) scope.names.add(name);
    }
    if (node.type === "CatchClause") for (const name of bindingNames(node.param)) scope.names.add(name);
    if (node.type === "ClassExpression") for (const name of bindingNames(node.id)) scope.names.add(name);
    if (node.type === "ImportDeclaration" && Array.isArray(node.specifiers)) {
      const importedSource = ast(node.source)?.value, builtin = importedSource === "process" || importedSource === "node:process";
      for (const value of node.specifiers) {
        const specifier = ast(value), imported = ast(specifier?.imported), importedName = imported?.name ?? imported?.value;
        for (const name of bindingNames(specifier?.local)) {
          scope.names.add(name);
          if (!builtin || node.importKind === "type" || specifier?.importKind === "type") continue;
          if (specifier?.type === "ImportDefaultSpecifier" || specifier?.type === "ImportNamespaceSpecifier" || importedName === "default") scope.processImports.set(name, "process");
          else if (importedName === "env") scope.processImports.set(name, "env");
        }
      }
    }
    if (node.type === "VariableDeclaration" && Array.isArray(node.declarations)) {
      let target = scope; if (node.kind === "var") while (!target.functionScope && target.parent) target = target.parent;
      for (const value of node.declarations) for (const name of bindingNames(ast(value)?.id)) target.names.add(name);
    }
    for (const child of children(node)) pending.push({ node: child, scope });
  }
  // A reassigned imported name cannot establish a builtin environment read.
  for (const node of all) if (node.type === "AssignmentExpression" || node.type === "UpdateExpression") {
    for (const name of bindingNames(node.type === "AssignmentExpression" ? node.left : node.argument)) bindingScope(scopes.get(node) ?? top, name)?.processImports.delete(name);
  }
  const globalProcessWritten = all.some(node => node.type === "AssignmentExpression" && bindingNames(node.left).includes("process") && unbound(scopes.get(node) ?? top, "process"));
  const names = new Set<string>();
  for (const node of all) {
    const key = property(node); if (!key || !namePattern.test(key)) continue;
    const scope = scopes.get(node) ?? top, target = ast(node.object);
    if (target?.type === "Identifier" && typeof target.name === "string" && bindingScope(scope, target.name)?.processImports.get(target.name) === "env") names.add(key);
    const env = ast(node.object); if (property(env) !== "env") continue;
    const receiver = ast(env?.object);
    if (receiver?.type === "Identifier" && typeof receiver.name === "string" &&
      (bindingScope(scope, receiver.name)?.processImports.get(receiver.name) === "process" || receiver.name === "process" && !globalProcessWritten && unbound(scope, "process"))) names.add(key);
    if (receiver?.type === "MetaProperty" && ast(receiver.meta)?.name === "import" && ast(receiver.property)?.name === "meta" && !["MODE", "BASE_URL", "DEV", "PROD", "SSR"].includes(key)) names.add(key);
  }
  return [...names];
}

function pythonTokens(source: string): PythonToken[] {
  const result: PythonToken[] = []; let offset = 0, line = 0;
  while (offset < source.length) {
    ensure(result.length < tokenLimit, "ENV_DISCOVERY_LIMIT", "بررسی نام تنظیمات این فایل از سقف مجاز بیشتر است.", 413);
    const char = source[offset] ?? "";
    if (/\s/.test(char)) { if (char === "\n") line++; offset++; continue; }
    if (char === "#") { while (offset < source.length && source[offset] !== "\n") offset++; continue; }
    const start = offset, startLine = line, prefix = /^(?:[rRuUbBfF]{1,2})?(?=['"])/.exec(source.slice(offset))?.[0];
    if (prefix !== undefined) {
      offset += prefix.length; const quote = source[offset] ?? "", triple = source.slice(offset, offset + 3) === quote.repeat(3), delimiter = triple ? quote.repeat(3) : quote;
      offset += delimiter.length; const valueStart = offset; let escaped = false, closed = false;
      while (offset < source.length) {
        if (source[offset] === "\\") { escaped = true; if (source[offset + 1] === "\n") line++; offset += 2; continue; }
        if (source.slice(offset, offset + delimiter.length) === delimiter) { closed = true; break; }
        if (source[offset] === "\n") line++; offset++;
      }
      const value = source.slice(valueStart, offset); offset += closed ? delimiter.length : 0;
      result.push({ kind: "string", text: closed && !escaped && !/[fFbB]/.test(prefix) ? value : "", start, end: offset, line: startLine }); continue;
    }
    const identifier = /^[A-Za-z_][A-Za-z0-9_]*/.exec(source.slice(offset))?.[0];
    if (identifier) { offset += identifier.length; result.push({ kind: "name", text: identifier, start, end: offset, line }); continue; }
    offset++; result.push({ kind: "punct", text: char, start, end: offset, line });
  }
  return result;
}
type PythonFunction = { name: string; parameter: string | null; start: number; body: number; end: number; indent: number; parent: PythonFunction | null };
function pythonNames(source: string): string[] {
  const tokens = pythonTokens(source), lines = source.split("\n"), indents = lines.map(line => /^\s*/.exec(line)?.[0].replaceAll("\t", "        ").length ?? 0),
    functions: PythonFunction[] = [], names = new Set<string>();
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]; if (token?.kind !== "name" || token.text !== "def" || tokens[index + 1]?.kind !== "name" || tokens[index + 2]?.text !== "(") continue;
    ensure(functions.length < 256, "ENV_DISCOVERY_LIMIT", "تعداد scopeهای Python این فایل بیشتر از سقف بررسی نام تنظیمات است.", 413);
    let depth = 0, colon = index + 2;
    for (; colon < tokens.length; colon++) { const text = tokens[colon]?.text; if (text === "(" || text === "[" || text === "{") depth++; else if (text === ")" || text === "]" || text === "}") depth--; else if (text === ":" && depth === 0) break; }
    if (!tokens[colon]) continue;
    const indent = indents[token.line] ?? 0; let end = tokens.length;
    for (let cursor = colon + 1; cursor < tokens.length; cursor++) { const item = tokens[cursor]; if (item && item.line > token.line && (indents[item.line] ?? 0) <= indent) { end = cursor; break; } }
    const parent = functions.filter(item => item.start < index && item.end > index).at(-1) ?? null;
    functions.push({ name: tokens[index + 1]?.text ?? "", parameter: tokens[index + 3]?.kind === "name" ? tokens[index + 3]?.text ?? null : null, start: index, body: colon + 1, end, indent, parent });
  }
  // A locally replaced os object cannot establish a process environment read.
  const osAmbiguous = tokens.some((token, index) => token.kind === "name" && token.text === "os" && (tokens[index + 1]?.text === "=" || tokens[index + 1]?.text === "as" || tokens[index - 1]?.text === "as" || tokens[index - 1]?.text === "def" ||
    tokens[index - 1]?.text === "import" && tokens.some(item => item.line === token.line && item.text === "from") ||
    tokens[index + 1]?.text === "." && ["getenv", "environ"].includes(tokens[index + 2]?.text ?? "") && (tokens[index + 3]?.text === "=" || tokens[index + 3]?.text === "." && tokens[index + 4]?.text === "get" && tokens[index + 5]?.text === "=") ||
    functions.some(fn => index > fn.start + 2 && index < fn.body && tokens[index - 1]?.text !== ".")));
  if (osAmbiguous) return [];
  function access(index: number): number | null {
    if (tokens[index]?.kind !== "name" || tokens[index]?.text !== "os" || tokens[index - 1]?.text === "." || tokens[index + 1]?.text !== ".") return null;
    if (tokens[index + 2]?.text === "getenv" && tokens[index + 3]?.text === "(") return index + 4;
    if (tokens[index + 2]?.text !== "environ") return null;
    if (tokens[index + 3]?.text === "[") return index + 4;
    return tokens[index + 3]?.text === "." && tokens[index + 4]?.text === "get" && tokens[index + 5]?.text === "(" ? index + 6 : null;
  }
  function completeArgument(index: number): boolean {
    return tokens[index - 1]?.text === "[" ? tokens[index + 1]?.text === "]" : tokens[index + 1]?.text === "," || tokens[index + 1]?.text === ")";
  }
  for (let index = 0; index < tokens.length; index++) { const argument = access(index), token = argument === null ? null : tokens[argument]; if (argument !== null && token?.kind === "string" && namePattern.test(token.text) && completeArgument(argument)) names.add(token.text); }
  for (const fn of functions) {
    if (!fn.parameter || tokens[fn.body]?.text !== "return" || access(fn.body + 1) === null) continue;
    const argument = access(fn.body + 1); if (argument === null || tokens[argument]?.kind !== "name" || tokens[argument]?.text !== fn.parameter || !completeArgument(argument)) continue;
    if (functions.filter(other => other.name === fn.name).length !== 1) continue;
    const rebound = tokens.some((token, index) => token.text === fn.name && (tokens[index + 1]?.text === "=" || tokens[index - 1]?.text === "as" ||
      functions.some(other => index > other.start + 2 && index < other.body)));
    if (rebound) continue;
    const ownerEnd = fn.parent?.end ?? tokens.length;
    for (let index = fn.end; index < ownerEnd; index++) {
      const token = tokens[index], argument = tokens[index + 2];
      if (token?.kind === "name" && token.text === fn.name && tokens[index - 1]?.text !== "." && tokens[index + 1]?.text === "(" && argument?.kind === "string" && namePattern.test(argument.text)) names.add(argument.text);
    }
  }
  return [...names];
}

/** Discovers literal environment keys without evaluating imports, scripts or values. Unsupported syntax stays unknown. */
export function sourceEnvironmentNames(source: string, path: string): string[] {
  ensure(Buffer.byteLength(source) <= sourceLimit, "ENV_DISCOVERY_LIMIT", "فایل برای بررسی نام تنظیمات بیش از حد بزرگ است.", 413);
  const names = path.endsWith(".py") ? pythonNames(source) : /\.[cm]?[jt]sx?$/.test(path) ? javascriptNames(source) : path.endsWith(".vue")
    ? [...source.replace(/<!--[\s\S]*?-->/g, "").matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)].flatMap(match => javascriptNames(match[1] ?? "")) : [];
  const unique = [...new Set(names)].sort();
  ensure(unique.length <= 128, "ENV_DISCOVERY_LIMIT", "تعداد نام تنظیمات این فایل بیشتر از سقف مجاز است.", 413);
  return unique;
}
