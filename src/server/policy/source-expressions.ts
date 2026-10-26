import { createRequire } from "node:module";

type Ast = Record<string, unknown> & { type: string };
const parser: unknown = createRequire(import.meta.url)("next/dist/compiled/babel/parser.js");
const sensitiveName = /(?:api[_-]?key|token|password|secret|authorization)(?:[_-]?(?:value|key|hash))?$/i;
export function fixtureCredentialLabel(value: unknown): boolean {
  return typeof value === "string" && value.length <= 160 && !/^(?:sk[-_]|pk[-_]|gh[pousr]_|github_|AKIA|eyJ)/i.test(value) &&
    /^[a-z0-9_.!-]+$/i.test(value) &&
    (/(?:^|[-_.])(?:test|fixture|synthetic|dummy|fake|sample|wrong|invalid|expired|malformed|garbage|leak)(?:[-_.!]|$)/i.test(value) || /^not-(?:[a-z]+-)*(?:token|jwt|bearer)$/.test(value));
}
export function unitCredentialVector(value: string): boolean {
  // Public test vectors, not a length/character exemption for arbitrary credentials.
  return ["hashed", "hash", "password123", "ValidPassword123!", "NewPassword123!", "OldPassword123!", "WrongPassword123!"].includes(value);
}
function node(value: unknown): value is Ast {
  return !!value && typeof value === "object" && !Array.isArray(value) && "type" in value && typeof value.type === "string";
}
function property(value: unknown): string | null {
  if (!node(value)) return null;
  return value.type === "Identifier" && typeof value.name === "string" ? value.name
    : value.type === "StringLiteral" && typeof value.value === "string" ? value.value : null;
}
function componentFunction(name: string, value: unknown): boolean {
  if (!/^[A-Z][A-Za-z0-9_]*$/.test(name) || !node(value) || !["ArrowFunctionExpression", "FunctionExpression"].includes(value.type) || !node(value.body)) return false;
  const jsx = (input: unknown, depth = 0): boolean => node(input) && depth < 16 &&
    (["JSXElement", "JSXFragment", "NullLiteral"].includes(input.type) || input.type === "ConditionalExpression" && jsx(input.consequent, depth + 1) && jsx(input.alternate, depth + 1));
  if (value.body.type !== "BlockStatement") return jsx(value.body);
  const pending = [value.body]; let visited = 0, returns = 0;
  while (pending.length) {
    const current = pending.pop(); if (!current || ++visited > 10000) return false;
    if (current !== value.body && ["ArrowFunctionExpression", "FunctionExpression", "FunctionDeclaration", "ObjectMethod", "ClassMethod"].includes(current.type)) continue;
    if (current.type === "ReturnStatement") { returns++; if (!jsx(current.argument)) return false; }
    for (const [field, child] of Object.entries(current)) {
      if (["loc", "extra", "comments", "leadingComments", "trailingComments", "innerComments"].includes(field)) continue;
      if (node(child)) pending.push(child); else if (Array.isArray(child)) for (const item of child) if (node(item)) pending.push(item);
    }
  }
  return returns > 0;
}
function joiSchema(value: unknown, depth = 0): boolean {
  if (!node(value) || depth > 32) return false;
  if (value.type === "Identifier") return value.name === "Joi";
  if (value.type === "MemberExpression") return value.computed === false && ["string", "number", "boolean", "object", "array", "min", "max", "required", "optional", "allow", "empty", "messages", "label", "pattern", "email", "uri", "trim", "lowercase", "uppercase", "valid", "invalid", "length"].includes(property(value.property) ?? "") && joiSchema(value.object, depth + 1);
  return value.type === "CallExpression" && joiSchema(value.callee, depth + 1);
}
function jwtClaims(value: unknown, depth: number, fixtures: boolean): boolean {
  if (!node(value) || value.type !== "ObjectExpression" || !Array.isArray(value.properties)) return false;
  const claims = new Set(["sub", "userId", "email", "type", "role", "iss", "aud", "iat", "exp", "nbf", "jti", "version"]);
  return value.properties.every(item => {
    if (!node(item)) return false;
    if (item.type === "SpreadElement") return reference(item.argument, depth + 1, fixtures);
    if (item.type !== "ObjectProperty") return false;
    if (reference(item.value, depth + 1, fixtures)) return true;
    return claims.has(property(item.key) ?? "") && node(item.value) &&
      (item.value.type === "StringLiteral" && typeof item.value.value === "string" && item.value.value.length <= 256 ||
        item.value.type === "NumericLiteral" && typeof item.value.value === "number" && Number.isFinite(item.value.value));
  });
}
function reference(value: unknown, depth = 0, fixtures = false): boolean {
  if (!node(value) || depth > 24) return false;
  if (joiSchema(value)) return true;
  if (value.type === "Identifier" || value.type === "ThisExpression" || value.type === "NullLiteral" || value.type === "BooleanLiteral") return true;
  if (value.type === "StringLiteral") return value.value === "" || fixtures && fixtureCredentialLabel(value.value);
  if (value.type === "AwaitExpression") return reference(value.argument, depth + 1, fixtures);
  if (value.type === "TemplateLiteral" && Array.isArray(value.quasis) && Array.isArray(value.expressions)) return value.expressions.every(item => reference(item, depth + 1, fixtures)) && value.quasis.every(item => node(item) && item.value && typeof item.value === "object" && "cooked" in item.value && typeof item.value.cooked === "string" && /^(?:\s*|Bearer |Basic )$/.test(item.value.cooked));
  if (value.type === "BinaryExpression" && value.operator === "+" && node(value.left) && value.left.type === "StringLiteral" && ["Bearer ", "Basic "].includes(String(value.left.value))) return reference(value.right, depth + 1, fixtures);
  if (value.type === "ArrowFunctionExpression") return reference(value.body, depth + 1, fixtures);
  if (value.type === "BlockStatement") {
    const pending = [value]; let visited = 0;
    while (pending.length) {
      const current = pending.pop(); if (!current || ++visited > 10000) return false;
      if (current !== value && ["ArrowFunctionExpression", "FunctionExpression", "FunctionDeclaration"].includes(current.type)) continue;
      if (current.type === "ReturnStatement") {
        if (!current.argument || node(current.argument) && current.argument.type === "ObjectExpression") continue;
        if (!reference(current.argument, depth + 1, fixtures)) return false;
      }
      for (const [key, child] of Object.entries(current)) {
        if (["loc", "extra", "comments", "leadingComments", "trailingComments"].includes(key)) continue;
        if (node(child)) pending.push(child);
        else if (Array.isArray(child)) for (const item of child) if (node(item)) pending.push(item);
      }
    }
    return true;
  }
  if (value.type === "ObjectExpression" && Array.isArray(value.properties)) return value.properties.every(item => {
    if (!node(item)) return false;
    if (item.type === "SpreadElement") return reference(item.argument, depth + 1, fixtures);
    if (item.type !== "ObjectProperty") return false;
    if (reference(item.value, depth + 1, fixtures)) return true;
    if (["sub", "userId", "role", "audience", "issuer"].includes(property(item.key) ?? "") && node(item.value) && item.value.type === "StringLiteral") return true;
    return property(item.key) === "expiresIn" && node(item.value) && item.value.type === "StringLiteral" && typeof item.value.value === "string" && /^-?\d{1,6}[smhd]$/.test(item.value.value);
  });
  if (value.type === "UnaryExpression" && value.operator === "!") return reference(value.argument, depth + 1, fixtures);
  if (value.type === "BinaryExpression" && ["===", "!==", "==", "!=", ">", ">=", "<", "<=", "in", "instanceof"].includes(String(value.operator))) return true;
  if (value.type === "BinaryExpression" && ["+", "-", "*", "/", "%"].includes(String(value.operator))) return (
    [value.left, value.right].every(operand => reference(operand, depth + 1, fixtures) || node(operand) && operand.type === "NumericLiteral") &&
    [value.left, value.right].some(operand => reference(operand, depth + 1, fixtures)));
  if (["TSAsExpression", "TSNonNullExpression", "TSSatisfiesExpression", "TypeCastExpression"].includes(value.type)) return reference(value.expression, depth + 1, fixtures);
  if (["MemberExpression", "OptionalMemberExpression"].includes(value.type))
    return reference(value.object, depth + 1, fixtures) && (value.computed === false || property(value.property) !== null || node(value.property) && value.property.type === "NumericLiteral");
  if (["LogicalExpression", "ConditionalExpression"].includes(value.type)) return value.type === "LogicalExpression"
    ? reference(value.left, depth + 1, fixtures) && reference(value.right, depth + 1, fixtures)
    : reference(value.consequent, depth + 1, fixtures) && reference(value.alternate, depth + 1, fixtures);
  if (["CallExpression", "OptionalCallExpression", "NewExpression"].includes(value.type) && Array.isArray(value.arguments)) {
    const callee = value.callee;
    const headerRead = node(callee) && ["MemberExpression", "OptionalMemberExpression"].includes(callee.type) && ["get", "header", "getHeader"].includes(property(callee.property) ?? "");
    const patternCall = node(callee) && ["MemberExpression", "OptionalMemberExpression"].includes(callee.type) && ["split", "match", "search", "replace", "test", "exec"].includes(property(callee.property) ?? "");
    const method = node(callee) && ["MemberExpression", "OptionalMemberExpression"].includes(callee.type) ? property(callee.property) : property(callee);
    const cryptoCall = method !== null && ["createHash", "createHmac", "digest", "toString"].includes(method);
    const storageRead = method === "getItem" && node(callee) && ["localStorage", "sessionStorage"].includes(property(callee.object) ?? "");
    const receiver = node(callee) && node(callee.object) ? property(callee.object) ?? property(callee.object.property) : null;
    const inputRead = ["param", "query", "getParam", "getQuery"].includes(method ?? "") && ["req", "request", "params", "query"].includes(receiver ?? "") || method === "get" && receiver === "searchParams";
    if (method === "sign" && node(callee) && ["jwt", "jsonwebtoken"].includes(property(callee.object) ?? "")) {
      const args = value.arguments;
      return args.length >= 2 && args.length <= 3 && jwtClaims(args[0], depth + 1, fixtures) && reference(args[1], depth + 1, fixtures) &&
        (args.length === 2 || reference(args[2], depth + 1, fixtures));
    }
    return reference(callee, depth + 1, fixtures) && value.arguments.every(argument => reference(argument, depth + 1, fixtures) ||
      headerRead && node(argument) && argument.type === "StringLiteral" && ["authorization", "cookie"].includes(String(argument.value).toLowerCase()) ||
      patternCall && node(argument) && (argument.type === "RegExpLiteral" || argument.type === "StringLiteral" && typeof argument.value === "string" && /^\s*$/.test(argument.value)) ||
      cryptoCall && node(argument) && argument.type === "StringLiteral" && ["sha256", "sha384", "sha512", "hex", "base64", "base64url", "utf8"].includes(String(argument.value)) ||
      ["min", "max", "length", "randomBytes"].includes(method ?? "") && node(argument) && argument.type === "NumericLiteral" ||
      method === "hash" && node(callee) && property(callee.object) === "bcrypt" && node(argument) && argument.type === "NumericLiteral" ||
      storageRead && node(argument) && argument.type === "StringLiteral" && /^(?:auth[-_]?token|access[-_]?token|token|jwt)$/i.test(String(argument.value)) ||
      inputRead && node(argument) && argument.type === "StringLiteral" && /^(?:api[_-]?key|access_token|refresh_token|token|password|authorization|secret)$/i.test(String(argument.value)) ||
      node(argument) && argument.type === "StringLiteral" && typeof argument.value === "string" && /^\/(?!\/)[A-Za-z0-9_./-]*$/.test(argument.value));
  }
  return false;
}

/** Classify syntax only; this never imports or runs a project's code. Raw bytes stay unchanged. */
export function maskNonCredentialSyntax(source: string, fixtures = false): string {
  if (!parser || typeof parser !== "object" || !("parse" in parser) || typeof parser.parse !== "function") return source;
  try {
    const root: unknown = parser.parse(source, { sourceType: "unambiguous", plugins: ["typescript", "jsx"], allowReturnOutsideFunction: true });
    if (!node(root)) return source;
    const stack = [root], ranges: { start: number; end: number }[] = [];
    let visited = 0;
    const mask = (value: unknown) => {
      if (node(value) && typeof value.start === "number" && typeof value.end === "number" && value.start >= 0 && value.end > value.start && value.end <= source.length)
        ranges.push({ start: value.start, end: value.end });
    };
    while (stack.length) {
      const current = stack.pop(); if (!current || ++visited > 100000) return source;
      // This colon belongs to a conditional branch, never to a credential property/assignment.
      if (current.type === "ConditionalExpression" && reference(current.consequent, 0, fixtures)) {
        let consequent = current.consequent;
        if (node(consequent) && ["MemberExpression", "OptionalMemberExpression"].includes(consequent.type)) consequent = consequent.property;
        if (sensitiveName.test(property(consequent) ?? "")) mask(consequent);
      }
      // SQL parameters are placeholders; mask only the column name, leaving literal values scannable.
      if ((current.type === "StringLiteral" || current.type === "TemplateLiteral" && Array.isArray(current.expressions) && current.expressions.length === 0) &&
        typeof current.start === "number" && typeof current.end === "number") {
        const raw = source.slice(current.start + 1, current.end - 1);
        const label = /\b(password|token|secret|api[_-]?key|authorization):\s*$/i.exec(raw);
        if (label?.[1]) ranges.push({ start: current.start + 1 + label.index, end: current.start + 1 + label.index + label[1].length });
        if (/^\s*(?:UPDATE|SELECT|INSERT|DELETE)\b/i.test(raw)) for (const match of raw.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:\$[1-9][0-9]*(?![A-Za-z0-9_])|COALESCE\s*\(\s*\$[1-9][0-9]*\s*,\s*\1\s*\))/gi)) {
          if (match.index !== undefined && match[1] && sensitiveName.test(match[1])) ranges.push({ start: current.start + 1 + match.index, end: current.start + 1 + match.index + match[1].length });
        }
      }
      if (current.type === "SwitchCase" && node(current.test) && current.test.type === "StringLiteral" &&
        typeof current.test.value === "string" && /^[A-Za-z_][A-Za-z0-9_.-]{0,79}$/.test(current.test.value)) mask(current.test);
      if (current.type === "TemplateLiteral" && Array.isArray(current.quasis) && Array.isArray(current.expressions)) {
        for (let index = 0; index < current.expressions.length; index++) {
          const quasi = current.quasis[index];
          if (!node(quasi) || typeof quasi.start !== "number" || typeof quasi.end !== "number" || !reference(current.expressions[index], 0, fixtures)) continue;
          const raw = source.slice(quasi.start, quasi.end), match = /(?:\b[\w-]*(?:api[_-]?key|token|password|secret|authorization)\s*[:=]\s*["']?|\bBearer\s+)$/.exec(raw);
          if (match) ranges.push({ start: quasi.end - match[0].length, end: quasi.end });
        }
      }
      if (current.type === "TSPropertySignature" || current.type === "TSMethodSignature" || current.type === "TSTypeAliasDeclaration") {
        const key = current.key ?? current.id; if (sensitiveName.test(property(key) ?? "")) mask(key);
      }
      if (["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression", "ObjectMethod", "ClassMethod", "TSFunctionType", "TSCallSignatureDeclaration", "TSMethodSignature", "TSConstructSignatureDeclaration"].includes(current.type)) {
        const parameters = current.params ?? current.parameters;
        if (Array.isArray(parameters)) for (const parameter of parameters) if (node(parameter) && parameter.type === "Identifier" && parameter.typeAnnotation && sensitiveName.test(property(parameter) ?? "")) mask(parameter);
      }
      let key = current.type === "VariableDeclarator" ? current.id : current.type === "ObjectProperty" ? current.key : current.type === "AssignmentExpression" || current.type === "AssignmentPattern" ? current.left : null;
      if (node(key) && ["MemberExpression", "OptionalMemberExpression"].includes(key.type) && (key.computed === false || node(key.property) && key.property.type === "StringLiteral")) key = key.property;
      const value = current.type === "VariableDeclarator" ? current.init : current.type === "ObjectProperty" ? current.value : current.right;
      if (key && sensitiveName.test(property(key) ?? "") && (reference(value, 0, fixtures) || current.type === "VariableDeclarator" && componentFunction(property(key) ?? "", value))) mask(key);
      for (const [field, child] of Object.entries(current)) {
        if (["comments", "leadingComments", "trailingComments", "innerComments", "loc", "extra", "tokens"].includes(field)) continue;
        if (node(child)) stack.push(child);
        else if (Array.isArray(child)) for (const item of child) if (node(item)) stack.push(item);
      }
    }
    let normalized = source;
    for (const range of ranges.sort((a, b) => b.start - a.start))
      normalized = normalized.slice(0, range.start) + "_".repeat(range.end - range.start) + normalized.slice(range.end);
    return normalized;
  } catch { return source; }
}
