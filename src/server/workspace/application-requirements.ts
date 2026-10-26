import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { posix } from "node:path";
import { applicationSourcePath, parseApplicationRequirements, type ApplicationRequirement, type ApplicationRequirementKind,
  type ApplicationRequirementNeed, type ApplicationRequirementsInspection } from "../../contracts/application-requirements.ts";
import { SOURCE_MAX_BYTES, SOURCE_MAX_CONFIG_BYTES, SOURCE_MAX_FILES, sourceFileByteLimit } from "../../contracts/source-limits.ts";
import { ensure } from "../errors.ts";
import { fingerprint } from "../policy/action.ts";
import type { SourceFile } from "./inspect.ts";

type Ast = Record<string, unknown> & { type: string };
type Context = { node: Ast; functionDepth: number; conditional: boolean };
const syntaxOnlyFields = new Set(["loc", "extra", "comments", "leadingComments", "trailingComments", "innerComments", "typeAnnotation", "typeParameters", "typeArguments", "returnType", "superTypeParameters", "implements", "predicate"]);
const leafNodes = new Set(["Identifier", "PrivateName", "StringLiteral", "NumericLiteral", "BooleanLiteral", "NullLiteral", "BigIntLiteral", "DecimalLiteral", "RegExpLiteral", "JSXIdentifier", "JSXText", "JSXNamespacedName"]);
const runtimeTypeScriptNodes = new Set(["TSAsExpression", "TSSatisfiesExpression", "TSTypeAssertion", "TSNonNullExpression", "TSInstantiationExpression", "TSParameterProperty", "TSEnumDeclaration", "TSEnumMember", "TSModuleDeclaration", "TSModuleBlock", "TSExportAssignment"]);
function executableNode(value: unknown): value is Ast {
  return node(value) && !leafNodes.has(value.type) && (!value.type.startsWith("TS") || runtimeTypeScriptNodes.has(value.type));
}
const parser: unknown = createRequire(import.meta.url)("next/dist/compiled/babel/parser.js");
const sum = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const directory = (path: string) => posix.dirname(path);
const namePattern = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;
const excludedSource = /(?:^|\/)(?:tests?|testing|__tests__|fixtures?|examples?|docs?|research|vendor|node_modules|\.git|context|feature-specs)(?:\/|$)|(?:^|\/)data\/source(?:\/|$)|\.(?:test|spec|cy)\.[cm]?[jt]sx?$/i;
function node(value: unknown): value is Ast { return !!value && typeof value === "object" && !Array.isArray(value) && "type" in value && typeof value.type === "string"; }
function key(value: unknown): string | null {
  return node(value) && value.type === "Identifier" && typeof value.name === "string" ? value.name
    : node(value) && value.type === "StringLiteral" && typeof value.value === "string" ? value.value : null;
}
function record(value: unknown): Record<string, unknown> | null { return value && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : null; }
function sourceText(file: SourceFile): string { return new TextDecoder("utf-8", { fatal: true }).decode(file.content); }

// JSONC is parsed as syntax, then reduced through JSON-only nodes. No eval or comment-stripping regex.
export function parseApplicationJsonc(source: string): unknown {
  ensure(parser && typeof parser === "object" && "parseExpression" in parser && typeof parser.parseExpression === "function", "APPLICATION_CONFIG_INVALID", "بررسی‌کننده تنظیمات در دسترس نیست.", 409);
  const root: unknown = parser.parseExpression(source);
  let count = 0;
  const reduce = (value: unknown, depth = 0): unknown => {
    ensure(node(value) && depth <= 32 && ++count <= 20000, "APPLICATION_CONFIG_INVALID", "تنظیمات باید JSONC محدود و معتبر باشند.", 409);
    ensure(!record(value.extra)?.parenthesized, "APPLICATION_CONFIG_INVALID", "تنظیمات باید JSONC باشند، نه عبارت JavaScript.", 409);
    if (value.type === "NullLiteral") return null;
    if (value.type === "BooleanLiteral") return value.value;
    if (value.type === "StringLiteral" && typeof value.start === "number" && typeof value.end === "number") {
      const raw = source.slice(value.start, value.end); ensure(raw.startsWith('"'), "APPLICATION_CONFIG_INVALID", "رشته JSONC باید نقل‌قول استاندارد داشته باشد.", 409);
      return JSON.parse(raw);
    }
    if ((value.type === "NumericLiteral" || value.type === "UnaryExpression" && value.operator === "-") && typeof value.start === "number" && typeof value.end === "number") {
      const raw = source.slice(value.start, value.end);
      ensure(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:e[+-]?[0-9]+)?$/i.test(raw) && Number.isFinite(Number(raw)), "APPLICATION_CONFIG_INVALID", "عدد JSONC معتبر نیست.", 409);
      return Number(raw);
    }
    if (value.type === "ArrayExpression" && Array.isArray(value.elements)) return value.elements.map(item => reduce(item, depth + 1));
    ensure(value.type === "ObjectExpression" && Array.isArray(value.properties), "APPLICATION_CONFIG_INVALID", "تنظیمات کد اجرایی نیستند.", 409);
    const result: Record<string, unknown> = {};
    for (const item of value.properties) {
      ensure(node(item) && item.type === "ObjectProperty" && item.computed === false && node(item.key) && item.key.type === "StringLiteral", "APPLICATION_CONFIG_INVALID", "کلید JSONC معتبر نیست.", 409);
      const name = reduce(item.key, depth + 1);
      ensure(typeof name === "string" && !Object.hasOwn(result, name), "APPLICATION_CONFIG_INVALID", "کلید JSONC تکراری یا معتبر نیست.", 409);
      Object.defineProperty(result, name, { value: reduce(item.value, depth + 1), enumerable: true, configurable: true });
    }
    return result;
  };
  return reduce(root);
}

/** Remove comments and string bodies for lexical Python/PHP evidence, preserving source positions. */
function codeShape(source: string, python: boolean): string {
  let shape = "", quote = "", triple = false, line = false, block = false;
  for (let i = 0; i < source.length; i++) {
    const character = source[i] ?? "", next = source[i + 1];
    if (line) { if (character === "\n") { line = false; shape += "\n"; } else shape += " "; continue; }
    if (block) { if (character === "*" && next === "/") { block = false; shape += "  "; i++; } else shape += character === "\n" ? "\n" : " "; continue; }
    if (quote) {
      if (character === "\\") { shape += "  "; i++; continue; }
      if (triple && source.slice(i, i + 3) === quote.repeat(3)) { shape += "   "; i += 2; quote = ""; triple = false; }
      else if (!triple && character === quote) { shape += " "; quote = ""; }
      else shape += character === "\n" ? "\n" : " ";
      continue;
    }
    if (character === "#" || !python && character === "/" && next === "/") { line = true; shape += " "; continue; }
    if (!python && character === "/" && next === "*") { block = true; shape += "  "; i++; continue; }
    if (character === '"' || character === "'" || !python && character === "`") { quote = character; triple = python && source.slice(i, i + 3) === character.repeat(3); shape += triple ? "   " : " "; if (triple) i += 2; continue; }
    shape += character;
  }
  ensure(!quote && !block, "APPLICATION_SOURCE_INVALID", "ساختار متن source کامل نیست.", 409); return shape;
}
const dependencyKinds: Readonly<Record<string, ApplicationRequirementKind>> = {
  pg: "postgresql", postgres: "postgresql", mysql2: "mysql", redis: "redis", ioredis: "redis", "better-sqlite3": "sqlite", sqlite3: "sqlite", duckdb: "duckdb",
  "@supabase/supabase-js": "supabase", "@supabase/ssr": "supabase", bullmq: "background_worker", "node-cron": "scheduler", openai: "external_model", "@anthropic-ai/sdk": "external_model",
};

/** Pure source evidence. Neither an executable plan nor a proof that a resource exists, connects, or is healthy. */
export function inspectApplicationRequirements(files: readonly SourceFile[]): ApplicationRequirementsInspection {
  ensure(Array.isArray(files) && files.length <= SOURCE_MAX_FILES, "APPLICATION_SOURCE_LIMIT", "تعداد فایل‌های source از سقف بررسی بیشتر است.", 413);
  const index = new Map<string, SourceFile>(), digests = new Map<string, string>(); let total = 0;
  for (const file of files) {
    const path = applicationSourcePath(file.path);
    ensure(!index.has(path) && Buffer.isBuffer(file.content) && !/(?:^|\/)\.env(?:\.|$)/i.test(path), "APPLICATION_SOURCE_INVALID", "فایل‌های source باید یکتا، محدود و بدون فایل env باشند.", 409);
    total += file.content.length; ensure(file.content.length <= sourceFileByteLimit(path) && total <= SOURCE_MAX_BYTES, "APPLICATION_SOURCE_LIMIT", "حجم source از سقف بررسی بیشتر است.", 413);
    index.set(path, file); digests.set(path, sum(file.content));
  }
  const manifest = [...index.values()].map(file => ({ path: file.path, bytes: file.content.length, sha256: digests.get(file.path) })).sort((a, b) => a.path.localeCompare(b.path, "en"));
  const sourceHash = fingerprint(manifest), findings = new Map<string, ApplicationRequirement>();
  const diagnostics: ApplicationRequirementsInspection["diagnostics"][number][] = [];
  const diagnostic = (code: ApplicationRequirementsInspection["diagnostics"][number]["code"], path: string) => {
    if (diagnostics.length < 128 && !diagnostics.some(item => item.code === code && item.paths.includes(path))) diagnostics.push({ code, paths: [path] });
  };
  const roots = [...index.keys()].filter(path => !excludedSource.test(path) && /(?:^|\/)(?:package\.json|composer\.json|pyproject\.toml|requirements(?:[-.][^/]+)?\.txt|setup\.py|setup\.cfg|go\.mod)$/.test(path)).map(directory).sort((a, b) => b.length - a.length);
  const consumer = (path: string) => roots.find(root => root !== "." && path.startsWith(`${root}/`)) ?? ".";
  const add = (kind: ApplicationRequirementKind, need: ApplicationRequirementNeed, path: string, offset: number, evidenceKind: "source" | "configuration" | "manifest", environmentKeys: readonly string[] = [], bindingNames: readonly string[] = []) => {
    const root = consumer(path), identity = `${root}\0${kind}`, file = index.get(path); if (!file) return;
    if (!findings.has(identity) && findings.size >= 128) { diagnostic("ANALYSIS_LIMIT", path); return; }
    const previous = findings.get(identity), rank = { unknown: 0, optional: 1, required: 2 };
    const evidence = { path, sha256: digests.get(path) ?? "", line: offset === 0 ? 1 : sourceText(file).slice(0, offset).split("\n").length, kind: evidenceKind };
    const entries = [...(previous?.evidence ?? [])];
    if (entries.length < 32 && !entries.some(item => item.path === evidence.path && item.line === evidence.line && item.kind === evidence.kind)) entries.push(evidence);
    const environment = [...new Set([...(previous?.environmentKeys ?? []), ...environmentKeys.filter(key => namePattern.test(key))])], names = [...new Set([...(previous?.bindingNames ?? []), ...bindingNames.filter(key => namePattern.test(key))])];
    if (environment.length > 128 || names.length > 128) diagnostic("ANALYSIS_LIMIT", path);
    findings.set(identity, { kind, consumerRoot: root, need: previous && rank[previous.need] > rank[need] ? previous.need : need,
      environmentKeys: environment.slice(0, 128).sort(), bindingNames: names.slice(0, 128).sort(), evidence: entries });
  };
  const bindings = new Map<string, Set<string>>(), workerEntries = new Map<string, string | null>();
  for (const file of files) {
    if (excludedSource.test(file.path)) continue;
    if (/(?:^|\/)package\.json$/.test(file.path) || /(?:^|\/)composer\.json$/.test(file.path)) {
      try {
        const pkg = record(JSON.parse(sourceText(file))); ensure(pkg, "APPLICATION_CONFIG_INVALID", "ساختار manifest معتبر نیست.");
        for (const name of Object.keys({ ...record(pkg.dependencies), ...record(pkg.optionalDependencies) })) { const kind = dependencyKinds[name]; if (kind) add(kind, "unknown", file.path, 0, "manifest"); }
        if (file.path.endsWith("composer.json") && pkg.type === "wordpress-plugin") add("wordpress_host", "required", file.path, 0, "manifest");
      } catch { diagnostic("CONFIG_INVALID", file.path); }
    }
    if (/(?:^|\/)wrangler(?:\.[A-Za-z0-9_-]+)?\.jsonc?$/.test(file.path)) {
      try {
        ensure(file.content.length <= SOURCE_MAX_CONFIG_BYTES, "APPLICATION_CONFIG_INVALID", "حجم تنظیمات زیاد است.");
        const config = record(parseApplicationJsonc(sourceText(file))); ensure(config, "APPLICATION_CONFIG_INVALID", "تنظیمات Worker معتبر نیست.");
        const root = directory(file.path), main = config.main;
        let entry: string | null = null;
        if (typeof main === "string") {
          applicationSourcePath(main); entry = root === "." ? main : `${root}/${main}`;
          if (!index.has(entry)) { diagnostic("ENTRY_MISSING", file.path); entry = null; }
        } else diagnostic("ENTRY_MISSING", file.path);
        add("cloudflare_worker", entry ? "required" : "unknown", file.path, 0, "configuration");
        workerEntries.set(consumer(file.path), entry);
        const selected = new Set<string>();
        if (config.d1_databases !== undefined) {
          ensure(Array.isArray(config.d1_databases) && config.d1_databases.length <= 64, "APPLICATION_CONFIG_INVALID", "ساختار binding معتبر نیست.");
          for (const input of config.d1_databases) {
            const value = record(input), binding = value?.binding; ensure(typeof binding === "string" && namePattern.test(binding), "APPLICATION_CONFIG_INVALID", "نام binding معتبر نیست.");
            selected.add(binding); add("cloudflare_d1", "unknown", file.path, 0, "configuration", [], [binding]);
          }
        }
        bindings.set(consumer(file.path), selected);
      } catch { diagnostic("CONFIG_INVALID", file.path); add("cloudflare_worker", "unknown", file.path, 0, "configuration"); }
    }
  }
  let walked = 0;
  for (const file of files) {
    if (excludedSource.test(file.path) || !/\.(?:[cm]?[jt]sx?|py|php)$/i.test(file.path)) continue;
    if (file.content.length > SOURCE_MAX_CONFIG_BYTES || walked >= 300000) { diagnostic("ANALYSIS_LIMIT", file.path); continue; }
    let text: string; try { text = sourceText(file); } catch { diagnostic("SOURCE_PARSE_FAILED", file.path); continue; }
    if (/\.[cm]?[jt]sx?$/i.test(file.path)) {
      try {
        ensure(parser && typeof parser === "object" && "parse" in parser && typeof parser.parse === "function", "APPLICATION_SOURCE_INVALID", "بررسی‌کننده source موجود نیست.");
        const ast: unknown = parser.parse(text, { sourceType: "unambiguous", plugins: ["typescript", "jsx", "decorators-legacy"] });
        ensure(node(ast), "APPLICATION_SOURCE_INVALID", "ساختار source معتبر نیست.");
        const pending: Context[] = [{ node: ast, functionDepth: 0, conditional: false }], nodes: Context[] = [], imports = new Map<string, { module: string; member: string }>();
        let fileWalked = 0;
        const requiredModule = (value: unknown, depth = 0): { module: string; member: string } | null => {
          if (!node(value) || depth > 8) return null;
          if (value.type === "CallExpression" && key(value.callee) === "require" && Array.isArray(value.arguments) && value.arguments.length === 1 && node(value.arguments[0]) && value.arguments[0].type === "StringLiteral" && typeof value.arguments[0].value === "string") return { module: value.arguments[0].value, member: "default" };
          if (value.type === "MemberExpression" && (value.computed === false || node(value.property) && value.property.type === "StringLiteral")) { const parent = requiredModule(value.object, depth + 1), member = key(value.property); return parent && member ? { module: parent.module, member } : null; }
          return null;
        };
        while (pending.length) {
          const current = pending.pop(); if (!current) break;
          if (++fileWalked > 50000 || ++walked > 300000) { diagnostic("ANALYSIS_LIMIT", file.path); break; }
          if (["VariableDeclarator", "CallExpression", "NewExpression", "OptionalCallExpression"].includes(current.node.type)) nodes.push(current);
          if (current.node.type === "ImportDeclaration" && current.node.importKind !== "type" && node(current.node.source) && typeof current.node.source.value === "string" && Array.isArray(current.node.specifiers)) {
            for (const specifier of current.node.specifiers) if (node(specifier) && specifier.importKind !== "type") { const local = key(specifier.local); if (local) imports.set(local, { module: current.node.source.value, member: specifier.type === "ImportSpecifier" ? key(specifier.imported) ?? "" : "default" }); }
          }
          if (current.node.type === "VariableDeclarator") {
            const imported = requiredModule(current.node.init), local = key(current.node.id);
            if (imported && local) imports.set(local, imported);
            else if (imported && node(current.node.id) && current.node.id.type === "ObjectPattern" && Array.isArray(current.node.id.properties)) for (const property of current.node.id.properties) {
              if (!node(property) || property.type !== "ObjectProperty") continue;
              const name = key(property.value), member = key(property.key); if (name && member) imports.set(name, { module: imported.module, member });
            }
          }
          const functionDepth = current.functionDepth + (["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression", "ObjectMethod", "ClassMethod"].includes(current.node.type) ? 1 : 0);
          for (const [field, child] of Object.entries(current.node)) {
            if (syntaxOnlyFields.has(field)) continue;
            const context = { functionDepth, conditional: current.conditional || current.node.type === "IfStatement" || current.node.type === "ConditionalExpression" || current.node.type === "LogicalExpression" };
            if (executableNode(child)) pending.push({ node: child, ...context }); else if (Array.isArray(child)) for (const item of child) if (executableNode(item)) pending.push({ node: item, ...context });
          }
        }
        const memberPath = (value: unknown, depth = 0): string[] | null => {
          if (!node(value) || depth > 16) return null;
          if (value.type === "Identifier") return typeof value.name === "string" ? [value.name] : null;
          if (value.type === "MetaProperty" && key(value.meta) === "import" && key(value.property) === "meta") return ["import", "meta"];
          if (["MemberExpression", "OptionalMemberExpression"].includes(value.type)) { const parent = memberPath(value.object, depth + 1), name = key(value.property); return parent && name && (value.computed === false || node(value.property) && value.property.type === "StringLiteral") ? [...parent, name] : null; }
          return null;
        };
        const aliases = new Map<string, unknown>();
        for (const { node: current } of nodes) if (current.type === "VariableDeclarator") { const name = key(current.id); if (name) aliases.set(name, current.init); }
        const environmentOf = (value: unknown, depth = 0, seen = new Set<string>()): string[] => {
          if (depth > 16) return [];
          if (Array.isArray(value)) return [...new Set(value.flatMap(item => environmentOf(item, depth + 1, seen)))];
          if (!node(value)) return [];
          const path = memberPath(value);
          if (path && (path.length === 3 && path[0] === "process" && path[1] === "env" || path.length === 4 && path.slice(0, 3).join(".") === "import.meta.env")) {
            const name = path.at(-1); return name && namePattern.test(name) ? [name] : [];
          }
          const name = value.type === "Identifier" ? key(value) : null;
          if (name && aliases.has(name) && !seen.has(name)) { const next = new Set(seen); next.add(name); return environmentOf(aliases.get(name), depth + 1, next); }
          return [...new Set(Object.entries(value).filter(([field]) => !syntaxOnlyFields.has(field)).flatMap(([, child]) => environmentOf(child, depth + 1, seen)))];
        };
        for (const { node: current, functionDepth, conditional } of nodes) {
          if (!["CallExpression", "NewExpression", "OptionalCallExpression"].includes(current.type)) continue;
          const path = memberPath(current.callee), direct = requiredModule(current.callee); if (!path && !direct) continue;
          const imported = direct ?? imports.get(path?.[0] ?? ""), module = imported?.module, method = path?.at(-1), member = direct ? direct.member : path?.length === 1 ? imported?.member : method;
          const need: ApplicationRequirementNeed = functionDepth > 0 || conditional ? "unknown" : "required", offset = typeof current.start === "number" ? current.start : 0;
          const emit = (kind: ApplicationRequirementKind, selected: ApplicationRequirementNeed = need) => add(kind, selected, file.path, offset, "source", environmentOf(current.arguments));
          if (module === "pg" && ["Pool", "Client"].includes(member ?? "") || module === "postgres") emit("postgresql");
          if ((module === "mysql2" || module === "mysql2/promise") && ["createPool", "createConnection"].includes(member ?? "")) emit("mysql");
          if (module === "ioredis" || module === "redis" && member === "createClient") emit("redis");
          if (module === "better-sqlite3" || module === "node:sqlite" && ["DatabaseSync", "Database"].includes(member ?? "")) { emit("sqlite"); emit("persistent_storage", "unknown"); }
          if (module === "duckdb" || module === "@duckdb/node-api") { emit("duckdb"); emit("persistent_storage", "unknown"); }
          if ((module === "@supabase/supabase-js" || module === "@supabase/ssr") && ["createClient", "createBrowserClient", "createServerClient"].includes(member ?? "")) emit("supabase");
          if (module === "bullmq" && member === "Worker") { emit("background_worker"); emit("redis"); }
          if ((module === "node-cron" || module === "cron") && ["schedule", "CronJob"].includes(member ?? "")) emit("scheduler");
          if (["openai", "@anthropic-ai/sdk"].includes(module ?? "") || module === "ai" && ["generateText", "streamText", "ToolLoopAgent"].includes(member ?? "")) emit("external_model", "unknown");
          if (["express", "fastify", "koa", "hono", "@hono/node-server", "@nestjs/core"].includes(module ?? "")) emit("backend_api");
          for (const binding of bindings.get(consumer(file.path)) ?? []) if (path?.includes(binding) && ["prepare", "batch", "exec"].includes(method ?? ""))
            add("cloudflare_d1", workerEntries.get(consumer(file.path)) === file.path ? "required" : "unknown", file.path, offset, "source", [], [binding]);
        }
      } catch { diagnostic("SOURCE_PARSE_FAILED", file.path); }
    } else {
      try {
        const python = file.path.endsWith(".py"), shape = codeShape(text, python), environmentKeys = new Set<string>();
        if (python) for (const match of shape.matchAll(/\bos\.(?:getenv|environ\.get)\s*\(/g)) {
          const name = /^\s*["']([A-Z][A-Z0-9_]{1,127})["']/.exec(text.slice((match.index ?? 0) + match[0].length))?.[1]; if (name) environmentKeys.add(name);
        }
        const emit = (kind: ApplicationRequirementKind, match: RegExpMatchArray, need: ApplicationRequirementNeed = "unknown") => add(kind, need, file.path, match.index ?? 0, "source", [...environmentKeys]);
        if (python) {
          const symbols = new Map<string, string>(), importedMembers = new Map<string, string>();
          for (const match of shape.matchAll(/^\s*from\s+([.A-Za-z_][\w.]*)\s+import\s+(?:\(([^)]{1,8192})\)|([^\r\n]{1,1000}))/gm)) {
            const module = match[1]; if (!module) continue;
            for (const part of (match[2] ?? match[3] ?? "").split(",")) {
              const item = /^\s*([A-Za-z_]\w*)(?:\s+as\s+([A-Za-z_]\w*))?\s*$/.exec(part), name = item?.[2] ?? item?.[1];
              if (name) { symbols.set(name, module); if (item?.[1]) importedMembers.set(name, item[1]); }
            }
          }
          for (const match of shape.matchAll(/^\s*import\s+([^\r\n]{1,1000})/gm)) for (const part of (match[1] ?? "").split(",")) {
            const item = /^\s*([A-Za-z_][\w.]*)(?:\s+as\s+([A-Za-z_]\w*))?\s*$/.exec(part), module = item?.[1], name = item?.[2] ?? module?.split(".")[0];
            if (module && name) symbols.set(name, module);
          }
          for (const match of shape.matchAll(/\b([A-Za-z_]\w*)(?:\.([A-Za-z_]\w*))?\s*\(/g)) {
            const module = symbols.get(match[1] ?? ""), method = match[2] ?? importedMembers.get(match[1] ?? "");
            if (["fastapi", "flask"].includes(module ?? "")) emit("backend_api", match);
            if (module === "sqlite3" && method === "connect") { emit("sqlite", match); emit("persistent_storage", match); }
            if (module === "duckdb" && method === "connect") { emit("duckdb", match); emit("persistent_storage", match); }
            if (/^(?:asyncpg|psycopg2?)(?:\.|$)/.test(module ?? "")) emit("postgresql", match);
            if (/^sqlalchemy(?:\.|$)/.test(module ?? "") && (method ? ["create_engine", "create_async_engine"].includes(method) : ["create_engine", "create_async_engine"].includes(match[1] ?? ""))) emit("relational_database", match);
            if (/^redis(?:\.|$)/.test(module ?? "")) emit("redis", match);
            if (module === "celery") emit("background_worker", match);
            if (module === "supabase") emit("supabase", match);
            if (["openai", "anthropic"].includes(module ?? "")) emit("external_model", match);
          }
          for (const match of shape.matchAll(/\bos\.path\.ismount\s*\(/g)) if (symbols.get("os") === "os") emit("persistent_storage", match);
        } else {
          const wordpress = /(?:^|\n)\s*\*?\s*Plugin Name\s*:/i.test(text.slice(0, 8192));
          if (wordpress) add("wordpress_host", "required", file.path, 0, "configuration");
          for (const match of shape.matchAll(/\b(add_action|register_activation_hook|wp_schedule_event|wp_next_scheduled|wp_remote_request|wpdb)\b\s*\(/g)) {
            if (wordpress) emit("wordpress_host", match, "required");
            else emit("wordpress_host", match);
            if (["wp_schedule_event", "wp_next_scheduled"].includes(match[1] ?? "")) emit("scheduler", match);
          }
          for (const match of shape.matchAll(/\$wpdb\s*->\s*(?:query|get_results|prepare|insert|update|delete)\s*\(/g)) { emit("mysql", match); emit("wordpress_host", match); }
          for (const match of shape.matchAll(/\bwpdb\b/g)) { emit("mysql", match); emit("wordpress_host", match); }
          for (const match of shape.matchAll(/\bnew\s+\\?PDO\s*\(/g)) emit("relational_database", match);
        }
      } catch { diagnostic("SOURCE_PARSE_FAILED", file.path); }
    }
  }
  return parseApplicationRequirements({ version: 1, sourceHash, verification: "source_only", requirements: [...findings.values()].sort((a, b) => a.consumerRoot.localeCompare(b.consumerRoot, "en") || a.kind.localeCompare(b.kind, "en")), diagnostics });
}
