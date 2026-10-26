import { createRequire } from "node:module";
import { parseFullstackInspection, type FullstackInspection } from "../../contracts/fullstack.ts";
import { isPublicClientEnvironmentKey } from "../../contracts/environment.ts";
import { object } from "../../contracts/validation.ts";
import type { SourceFile } from "./inspect.ts";
import { inspectWorkerSqlite, preparedWorkerSqlite } from "./worker-sqlite.ts";
import { workerSqlitePaths, workerSqliteStart } from "../agent/worker-sqlite-programs.ts";

type Ast = Record<string, unknown> & { type: string };
const parser: unknown = createRequire(import.meta.url)("next/dist/compiled/babel/parser.js");
function node(value: unknown): value is Ast { return !!value && typeof value === "object" && "type" in value && typeof value.type === "string"; }
function outputDirectory(files: readonly SourceFile[]): string {
  const config = files.find(file => /^vite\.config\.[cm]?[jt]s$/.test(file.path));
  if (!config || !parser || typeof parser !== "object" || !("parse" in parser) || typeof parser.parse !== "function") return "dist";
  try {
    const root: unknown = parser.parse(config.content.toString("utf8"), { sourceType: "module", plugins: ["typescript"] }), stack: unknown[] = [root]; let count = 0;
    const outputs = new Set<string>();
    while (stack.length && count++ < 10000) {
      const current = stack.pop(); if (!node(current)) continue;
      if (current.type === "ObjectProperty" && node(current.key) && (current.key.name === "outDir" || current.key.value === "outDir") && node(current.value) && current.value.type === "StringLiteral" && typeof current.value.value === "string") outputs.add(current.value.value);
      for (const child of Object.values(current)) { if (node(child)) stack.push(child); else if (Array.isArray(child)) stack.push(...child.filter(node)); }
    }
    return outputs.size === 1 ? [...outputs][0] ?? "dist" : "dist";
  } catch { return "dist"; }
}
/** Source evidence only. A frontend dependency never proves the backend or databases are deployed. */
export function inspectFullstack(pkg: Record<string, unknown>, liara: Record<string, unknown>, files: readonly SourceFile[], envNames: readonly string[]): FullstackInspection | undefined {
  const deps = { ...object(pkg.dependencies ?? {}), ...object(pkg.devDependencies ?? {}) };
  const worker = inspectWorkerSqlite(pkg, files);
  if (worker) {
    const prepared = preparedWorkerSqlite(pkg, files), scripts = object(pkg.scripts ?? {});
    return parseFullstackInspection({ kind: "node-fullstack", frontend: deps.react ? "react" : "vue", outputDirectory: "dist", backendScript: "server",
      entryFile: workerSqlitePaths.server, startCommand: workerSqliteStart, packageRoots: ["."], publicEnvironmentKeys: [],
      privateEnvironmentKeys: worker.requiredEnvironmentKeys, requiresPreparation: !prepared || scripts.start !== workerSqliteStart || liara.platform !== "node", workerSqlite: worker });
  }
  if (!deps.vite || !(deps.react || deps.vue) || !["express", "fastify", "koa", "@hono/node-server"].some(name => typeof deps[name] === "string")) return undefined;
  const scripts = object(pkg.scripts ?? {}), candidates: { script: string; entry: string; command: string }[] = [];
  for (const [script, command] of Object.entries(scripts)) {
    if (typeof command !== "string" || !/^(?:start|server|start:server|start:api|backend|api)$/.test(script)) continue;
    const match = /^(?:node|tsx)(?:\s+--tsconfig\s+[A-Za-z0-9_./-]+\.json)?\s+([A-Za-z0-9_][A-Za-z0-9_./-]*\.[cm]?[jt]s)$/.exec(command);
    const entry = match?.[1]; if (!entry) continue;
    const file = files.find(file => file.path === entry);
    if (file && /\b(?:listen\s*\(|createServer\s*\(|express\s*\(|fastify\s*\()/.test(file.content.toString("utf8"))) candidates.push({ script, entry, command });
  }
  const unique = [...new Map(candidates.map(item => [item.command, item])).values()], explicit = [...new Map(candidates.filter(item => item.script !== "start").map(item => [item.command, item])).values()],
    backend = explicit.length === 1 ? explicit[0] : unique.length === 1 ? unique[0] : undefined;
  const packageRoots = [".", ...files.filter(file => file.path.endsWith("/package.json") && !/(?:^|\/)(?:tests?|fixtures?|examples?)\//.test(file.path)).map(file => file.path.slice(0, -13)).sort()];
  return parseFullstackInspection({ kind: "node-fullstack", frontend: deps.react ? "react" : "vue", outputDirectory: outputDirectory(files),
    backendScript: backend?.script ?? null, entryFile: backend?.entry ?? null, startCommand: backend?.command ?? null, packageRoots,
    publicEnvironmentKeys: envNames.filter(isPublicClientEnvironmentKey), privateEnvironmentKeys: envNames.filter(key => !isPublicClientEnvironmentKey(key)),
    requiresPreparation: !backend || scripts.start !== backend.command || liara.platform !== "node" });
}
