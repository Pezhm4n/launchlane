import acorn from "next/dist/compiled/acorn/acorn.js";

type Ast = Record<string, unknown> & { type: string };
type Binding = { expression: Ast | null; declarationEnd: number; modified: boolean; scope: LexicalScope };
type LexicalScope = { parent: LexicalScope | null; functionScope: boolean; opaque: boolean; bindings: Map<string, Binding> };
function isAst(value: unknown): value is Ast {
  return typeof value === "object" && value !== null && !Array.isArray(value) && "type" in value && typeof value.type === "string";
}
function ast(value: unknown): Ast | null {
  return isAst(value) ? value : null;
}
function nodes(value: unknown): Ast[] {
  return Array.isArray(value) ? value.flatMap((item) => { const node = ast(item); return node ? [node] : []; }) : [];
}
function children(node: Ast): Ast[] {
  return Object.values(node).flatMap((value) => { const child = ast(value); return child ? [child] : nodes(value); });
}
function names(pattern: Ast | null): string[] {
  if (!pattern) return [];
  if (pattern.type === "Identifier" && typeof pattern.name === "string") return [pattern.name];
  if (pattern.type === "RestElement") return names(ast(pattern.argument));
  if (pattern.type === "AssignmentPattern") return names(ast(pattern.left));
  if (pattern.type === "ArrayPattern") return nodes(pattern.elements).flatMap(names);
  if (pattern.type === "ObjectPattern") return nodes(pattern.properties).flatMap((property) =>
    names(ast(property.type === "RestElement" ? property.argument : property.value)));
  return [];
}
function lookup(scope: LexicalScope, name: string): Binding | null {
  for (let current: LexicalScope | null = scope; current; current = current.parent) {
    if (current.opaque) return null;
    const binding = current.bindings.get(name);
    if (binding) return binding;
  }
  return null;
}
function unshadowedGlobal(scope: LexicalScope, name: string): boolean {
  for (let current: LexicalScope | null = scope; current; current = current.parent)
    if (current.opaque || current.bindings.has(name)) return false;
  return true;
}
function property(node: Ast | null): string | null {
  if (node?.type !== "MemberExpression") return null;
  const key = ast(node.property);
  return key?.type === "Identifier" && node.computed === false && typeof key.name === "string" ? key.name
    : key?.type === "Literal" && typeof key.value === "string" ? key.value : null;
}
function envPort(node: Ast | null, scope: LexicalScope): boolean {
  if (property(node) !== "PORT") return false;
  const env = ast(node?.object), process = ast(env?.object);
  return property(env) === "env" && process?.type === "Identifier" && process.name === "process" && unshadowedGlobal(scope, "process");
}

/** Static candidates only; this does not execute source or establish the actual runtime's port. */
export function sourcePorts(source: string): { ports: number[]; unresolved: boolean } {
  let tree: Ast | null = null;
  for (const sourceType of ["module", "script"] as const) {
    try { tree = ast(acorn.parse(source, { ecmaVersion: "latest", sourceType, allowHashBang: true })); break; }
    catch { /* Syntax not supported by this JavaScript parser remains unknown. */ }
  }
  if (!tree) return { ports: [], unresolved: /\blisten\s*(?:\?\.)?\s*\(/.test(source) };
  const root: LexicalScope = { parent: null, functionScope: true, opaque: false, bindings: new Map() },
    scopes = new WeakMap<Ast, LexicalScope>(), all: Ast[] = [], pending = [{ node: tree, scope: root }];
  function bind(scope: LexicalScope, name: string, expression: Ast | null = null, declarationEnd = 0) {
    const existing = scope.bindings.get(name);
    scope.bindings.set(name, { expression: existing ? null : expression, declarationEnd, modified: false, scope });
  }
  while (pending.length) {
    const next = pending.pop();
    if (!next) break;
    const node = next.node, parent = next.scope;
    if (all.length >= 200000) return { ports: [], unresolved: true };
    const isFunction = ["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"].includes(node.type);
    if (node.type === "FunctionDeclaration" || node.type === "ClassDeclaration")
      for (const name of names(ast(node.id))) bind(parent, name);
    const boundary = isFunction || ["BlockStatement", "StaticBlock", "CatchClause", "ForStatement", "ForOfStatement", "ForInStatement", "SwitchStatement", "ClassDeclaration", "ClassExpression", "WithStatement"].includes(node.type);
    const scope: LexicalScope = boundary ? { parent, functionScope: isFunction, opaque: node.type === "WithStatement" || node.type === "SwitchStatement", bindings: new Map() } : parent;
    scopes.set(node, scope); all.push(node);
    if (isFunction) {
      for (const parameter of nodes(node.params)) for (const name of names(parameter)) bind(scope, name);
      if (node.type === "FunctionExpression") for (const name of names(ast(node.id))) bind(scope, name);
    }
    if (node.type === "ClassExpression" || node.type === "ClassDeclaration")
      for (const name of names(ast(node.id))) bind(scope, name);
    if (node.type === "CatchClause") for (const name of names(ast(node.param))) bind(scope, name);
    if (node.type === "ImportDeclaration") for (const specifier of nodes(node.specifiers))
      for (const name of names(ast(specifier.local))) bind(scope, name);
    if (node.type === "VariableDeclaration") {
      let target = scope;
      if (node.kind === "var") while (!target.functionScope && target.parent) target = target.parent;
      for (const declaration of nodes(node.declarations)) {
        const id = ast(declaration.id), expression = node.kind === "const" && id?.type === "Identifier" ? ast(declaration.init) : null;
        for (const name of names(id)) bind(target, name, expression, typeof declaration.end === "number" ? declaration.end : 0);
      }
    }
    for (const child of children(node)) pending.push({ node: child, scope });
  }
  // Resolve writes before reads so a later mutation never turns an uncertain binding into a constant.
  const globalWrites = new Set<string>(); let envPortWritten = false;
  for (const node of all) if (node.type === "AssignmentExpression" || node.type === "UpdateExpression") {
    const scope = scopes.get(node);
    if (!scope) continue;
    const target = ast(node.type === "AssignmentExpression" ? node.left : node.argument);
    if (envPort(target, scope)) envPortWritten = true;
    const receiver = ast(target?.object), key = property(target);
    if (receiver?.type === "Identifier" && receiver.name === "globalThis" && unshadowedGlobal(scope, "globalThis") && key)
      globalWrites.add(key);
    for (const name of names(target)) {
      const binding = lookup(scope, name); if (binding) binding.modified = true; else globalWrites.add(name);
    }
  }
  function number(node: Ast | null, scope: LexicalScope, seen = new Set<Binding>()): number | null {
    if (!node) return null;
    if (node.type === "Literal") return typeof node.value === "number" && Number.isSafeInteger(node.value) && node.value >= 0 && node.value <= 65535 ? node.value : null;
    if (node.type === "Identifier" && typeof node.name === "string") {
      const binding = lookup(scope, node.name);
      if (!binding || binding.modified || seen.has(binding) || seen.size >= 32 ||
        typeof node.start !== "number" || node.start < binding.declarationEnd) return null;
      const next = new Set(seen); next.add(binding);
      return number(binding.expression, binding.scope, next);
    }
    if (node.type === "LogicalExpression" && (node.operator === "||" || node.operator === "??") &&
      !envPortWritten && !globalWrites.has("process") && envPort(ast(node.left), scope))
      return number(ast(node.right), scope, seen);
    const callee = ast(node.callee), args = nodes(node.arguments);
    if (node.type === "CallExpression" && callee?.type === "Identifier" && callee.name === "Number" &&
      unshadowedGlobal(scope, "Number") && !globalWrites.has("Number") && args.length === 1)
      return number(args[0] ?? null, scope, seen);
    if (node.type === "UnaryExpression" && node.operator === "+") return number(ast(node.argument), scope, seen);
    return null;
  }
  const ports = new Set<number>(); let unresolved = false;
  for (const node of all) if (node.type === "CallExpression" && property(ast(node.callee)) === "listen") {
    const scope = scopes.get(node), value = scope ? number(nodes(node.arguments)[0] ?? null, scope) : null;
    if (value === null) unresolved = true;
    else if (value > 0) ports.add(value);
  }
  return { ports: [...ports].sort((a, b) => a - b), unresolved };
}
