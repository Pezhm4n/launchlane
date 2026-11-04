import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { parseMigrationModuleInput, parseMigrationModule, type MigrationModuleInput } from "../../contracts/postgres-module-runner.ts";
import type { PostgresMigrationRunner } from "../../contracts/postgres-runner-test.ts";
import { object } from "../../contracts/validation.ts";
import type { SourceFile } from "../workspace/inspect.ts";
import { inspectFullstack } from "../workspace/fullstack.ts";
import { ensure } from "../errors.ts";

type Ast = Record<string, unknown> & { type: string };
const parser: unknown = createRequire(import.meta.url)("next/dist/compiled/babel/parser.js");
function node(value: unknown): value is Ast { return !!value && typeof value === "object" && "type" in value && typeof value.type === "string"; }
const digest = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
export function migrationModuleInput(runner: Extract<PostgresMigrationRunner, { kind: "module" }>): MigrationModuleInput {
  const { path, exportName, poolProperty, targets } = runner.module; return { path, exportName, poolProperty, targets };
}
/** A bounded invocation descriptor, not generated migration code. Original SQL/transactions remain source-owned. */
export function sourceMigrationModule(files: readonly SourceFile[], value: unknown): Extract<PostgresMigrationRunner, { kind: "module" }> {
  const input = parseMigrationModuleInput(value), file = files.find(file => file.path === input.path);
  ensure(file && file.content.length <= 512 * 1024 && parser && typeof parser === "object" && "parse" in parser && typeof parser.parse === "function", "MIGRATION_MODULE_SOURCE_REQUIRED", "ماژول migration باید در source قابل‌بررسی باشد.", 409);
  let parsed: unknown;
  try { parsed = parser.parse(file.content.toString("utf8"), { sourceType: "module", plugins: ["typescript"] }); }
  catch { ensure(false, "MIGRATION_MODULE_SOURCE_REQUIRED", "ساختار ماژول قابل‌بررسی نیست؛ کدی اجرا نشد.", 409); }
  const root = node(parsed) && node(parsed.program) ? parsed.program : undefined;
  ensure(root && Array.isArray(root.body), "MIGRATION_MODULE_SOURCE_REQUIRED", "ساختار ماژول معتبر نیست.", 409);
  const functions: Ast[] = [];
  for (const entry of root.body) {
    if (!node(entry) || entry.type !== "ExportNamedDeclaration" || !node(entry.declaration)) continue;
    const declaration = entry.declaration;
    if (declaration.type === "FunctionDeclaration" && node(declaration.id) && declaration.id.name === input.exportName) functions.push(declaration);
    if (declaration.type === "VariableDeclaration" && Array.isArray(declaration.declarations)) for (const part of declaration.declarations) {
      if (node(part) && node(part.id) && part.id.name === input.exportName && node(part.init) && ["ArrowFunctionExpression", "FunctionExpression"].includes(part.init.type)) functions.push(part.init);
    }
  }
  ensure(functions.length === 1, "MIGRATION_MODULE_SOURCE_REQUIRED", "تابع exportشده باید مستقیماً در همین فایل تعریف شده باشد.", 409);
  const parameters = functions[0]?.params;
  const first = Array.isArray(parameters) ? parameters[0] : undefined;
  const parameter = node(first) && first.type === "AssignmentPattern" ? first.left : first;
  ensure(Array.isArray(parameters) && parameters.length === 1 && node(parameter) && parameter.type === "ObjectPattern" && Array.isArray(parameter.properties), "MIGRATION_MODULE_SOURCE_REQUIRED", "این adapter فقط تابعی با یک گزینهٔ object و Pool صریح را اجرا می‌کند.", 409);
  const properties = new Set(parameter.properties.flatMap(part => node(part) && part.type === "ObjectProperty" && part.computed === false && node(part.key) && typeof part.key.name === "string" ? [part.key.name] : []));
  ensure(properties.has(input.poolProperty) && input.targets.every(target => Object.keys(target.arguments).every(key => properties.has(key))), "MIGRATION_MODULE_SOURCE_REQUIRED", "Pool و گزینه‌ها باید در امضای تابع source وجود داشته باشند.", 409);
  const literals = new Set<string>(); const stack: unknown[] = [root]; let count = 0;
  while (stack.length && count++ < 40000) {
    const current = stack.pop(); if (!node(current)) continue;
    if (["StringLiteral", "BooleanLiteral", "NumericLiteral", "NullLiteral"].includes(current.type)) literals.add(JSON.stringify(current.type === "NullLiteral" ? null : current.value));
    for (const [key, child] of Object.entries(current)) {
      if (["loc", "start", "end", "extra", "comments"].includes(key)) continue;
      if (node(child)) stack.push(child); else if (Array.isArray(child)) stack.push(...child.filter(node));
    }
  }
  ensure(stack.length === 0 && input.targets.every(target => Object.values(target.arguments).flatMap(value => Array.isArray(value) ? value : [value]).every(value => literals.has(JSON.stringify(value)))), "MIGRATION_MODULE_SOURCE_REQUIRED", "literal آرگومان باید در خود ماژول دیده شده باشد؛ این بررسی جای سنجش اثر داده را نمی‌گیرد.", 409);
  const pkgFile = files.find(file => file.path === "package.json"); ensure(pkgFile, "MIGRATION_MODULE_SOURCE_REQUIRED", "package اصلی لازم است.", 409);
  const pkg = object(JSON.parse(pkgFile.content.toString("utf8"))), typescript = /\.[cm]?ts$/.test(input.path);
  let tsconfig: { path: string; sha256: string } | undefined;
  if (typescript) {
    const deps = { ...object(pkg.dependencies ?? {}), ...object(pkg.devDependencies ?? {}) }, backend = inspectFullstack(pkg, {}, files, [])?.startCommand;
    ensure(typeof deps.tsx === "string" && typeof backend === "string" && backend.startsWith("tsx "), "MIGRATION_MODULE_LOADER_REQUIRED", "TypeScript از tsx و پیکربندی موجود backend استفاده می‌کند؛ dependency اضافه نمی‌شود.", 409);
    const path = /^tsx\s+--tsconfig\s+([A-Za-z0-9_./-]+\.json)\s/.exec(backend)?.[1];
    if (path) { const config = files.find(file => file.path === path); ensure(config, "MIGRATION_MODULE_LOADER_REQUIRED", "tsconfig اصلی لازم است.", 409); tsconfig = { path, sha256: digest(config.content) }; }
  }
  const module = parseMigrationModule({ ...input, sourceHash: digest(file.content), loader: typescript ? "tsx" : "node", ...(tsconfig ? { tsconfig } : {}) });
  return { kind: "module", module, sha256: digest(JSON.stringify({ version: 1, module })) };
}

// Fixed code, executed only inside the existing network-none disposable worker.
export const migrationModuleProgram = `async function runMigrationModule(plan,values,env){
const runner=plan.testDatabase.runner,module=runner.module;
if(createHash('sha256').update(JSON.stringify({version:1,module})).digest('hex')!==runner.sha256)throw Error('migration module descriptor changed');
for(const item of [{path:module.path,sha256:module.sourceHash},...(module.tsconfig?[module.tsconfig]:[])]){const path='/work/project/'+item.path;if(fs.lstatSync(path).isSymbolicLink()||createHash('sha256').update(fs.readFileSync(path)).digest('hex')!==item.sha256)throw Error('migration module source changed')}
if(JSON.stringify(module.targets.map(t=>t.id))!==JSON.stringify(plan.testDatabase.targets.map(t=>t.id)))throw Error('migration module targets changed');
const program="import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';const require=createRequire('/work/project/package.json');const {Pool}=require('pg');const input=JSON.parse(process.argv[2]);const source=await import(pathToFileURL('/work/project/'+input.module.path).href);const run=source[input.module.exportName];if(typeof run!=='function')throw Error('migration export is not callable');for(const target of input.module.targets){const binding=input.targets.find(t=>t.id===target.id);if(!binding)throw Error('migration binding missing');const pool=new Pool({connectionString:process.env[binding.environmentKeys[0]],ssl:false,max:1,connectionTimeoutMillis:2000,query_timeout:30000,statement_timeout:30000,application_name:'launchlane-disposable-module'});try{await run({...target.arguments,[input.module.poolProperty]:pool})}finally{await pool.end()}}";
fs.writeFileSync('/work/launchlane-module-runner.mjs',program,{flag:'wx'});
const args=[...(module.tsconfig?['--tsconfig',module.tsconfig.path]:[]),'/work/launchlane-module-runner.mjs',JSON.stringify({module,targets:plan.testDatabase.targets.map(t=>({id:t.id,environmentKeys:t.environmentKeys}))})];
await new Promise((resolve,reject)=>{const child=spawn(module.loader==='tsx'?'/work/project/node_modules/.bin/tsx':'node',args,{cwd:'/work/project',env:{...env,...values,NODE_ENV:'test'},stdio:['ignore','inherit','inherit']});child.once('error',reject);child.once('close',code=>code===0?resolve():reject(Error('migration module exited '+code)))});
}`;
