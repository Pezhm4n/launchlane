import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { parseApplicationRequirements } from "../../src/contracts/application-requirements.ts";
import { SOURCE_MAX_BYTES, SOURCE_MAX_FILES } from "../../src/contracts/source-limits.ts";
import { inspectApplicationRequirements } from "../../src/server/workspace/application-requirements.ts";
import type { SourceFile } from "../../src/server/workspace/inspect.ts";
import { fingerprint } from "../../src/server/policy/action.ts";

const files = (values: Record<string, string>): SourceFile[] => Object.entries(values).map(([path, value]) => ({ path, content: Buffer.from(value) }));
const pkg = (dependencies: Record<string, string> = {}) => JSON.stringify({ name: "neutral-fixture", dependencies });
const requirement = (input: ReturnType<typeof inspectApplicationRequirements>, kind: string, root = ".") => input.requirements.find(row => row.kind === kind && row.consumerRoot === root);

test("requirements bind the current whole source manifest without claiming execution or availability", () => {
  const source = files({ "package.json": pkg({ pg: "8.0.0" }), "server.ts": "import {Pool as DatabasePool} from 'pg'; const pool=new DatabasePool({connectionString:process.env.DATABASE_URL});" });
  const result = inspectApplicationRequirements(source);
  assert.equal(result.verification, "source_only"); assert.deepEqual(parseApplicationRequirements(result), result);
  assert.equal(result.sourceHash, fingerprint(source.map(file => ({ path: file.path, bytes: file.content.length, sha256: createHash("sha256").update(file.content).digest("hex") })).sort((a, b) => a.path.localeCompare(b.path, "en"))));
  assert.equal(requirement(result, "postgresql")?.need, "required"); assert.deepEqual(requirement(result, "postgresql")?.environmentKeys, ["DATABASE_URL"]);
  assert.notEqual(inspectApplicationRequirements([...source, ...files({ "public/style.css": "body{color:blue}" })]).sourceHash, result.sourceHash);
  for (const value of [{ ...result, verification: "verified" }, { ...result, ready: true }, { ...result, requirements: result.requirements.map(row => ({ ...row, credential: "synthetic-private" })) }]) assert.throws(() => parseApplicationRequirements(value));
});

test("dependency hints and unused imports stay unknown instead of proving that resources are required or connected", () => {
  const result = inspectApplicationRequirements(files({ "package.json": pkg({ pg: "8.0.0", ioredis: "5.0.0" }), "server.ts": "import {Pool} from 'pg'; import Redis from 'ioredis'; export const title='no constructor runs';" }));
  assert.equal(requirement(result, "postgresql")?.need, "unknown"); assert.equal(requirement(result, "redis")?.need, "unknown");
  assert.equal(inspectApplicationRequirements(files({ "package.json": JSON.stringify({ devDependencies: { pg: "8.0.0" } }) })).requirements.length, 0);
});

test("function-local or conditional resource use records uncertainty and preserves each actual consumer root", () => {
  const result = inspectApplicationRequirements(files({ "package.json": pkg(), "apps/api/package.json": pkg({ pg: "8.0.0" }), "apps/web/package.json": pkg({ react: "19.0.0" }),
    "apps/api/src/database.ts": "import {Pool} from 'pg'; export function createPool(){return new Pool({connectionString:process.env.DATABASE_URL})}", "apps/web/src/page.tsx": "export default function Page(){return <h1>Web</h1>}" }));
  assert.equal(requirement(result, "postgresql", "apps/api")?.need, "unknown"); assert.equal(requirement(result, "postgresql", "apps/web"), undefined);
  assert.equal(requirement(result, "postgresql"), undefined);
});

test("CommonJS modules, destructuring and member aliases retain actual provider calls", () => {
  for (const code of ["const pg=require('pg');const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});", "const {Pool:DatabasePool}=require('pg');const pool=new DatabasePool({connectionString:process.env.DATABASE_URL});", "const DatabasePool=require('pg').Pool;const pool=new DatabasePool({connectionString:process.env.DATABASE_URL});", "const pool=new (require('pg').Pool)({connectionString:process.env.DATABASE_URL});"])
    assert.equal(requirement(inspectApplicationRequirements(files({ "server.cjs": code })), "postgresql")?.need, "required");
});

test("a Vite frontend cannot erase a configured Hono Worker and its actual D1 binding", () => {
  const result = inspectApplicationRequirements(files({ "package.json": pkg({ react: "19.0.0", vite: "7.0.0", hono: "4.0.0" }), "wrangler.jsonc": '{/* not a URL parser */"main":"worker/index.ts","d1_databases":[{"binding":"DB","database_id":"opaque-account-id"}],}',
    "worker/index.ts": "import {Hono} from 'hono'; const app=new Hono(); app.get('/api/data',c=>c.env.DB.prepare('SELECT 1').all()); export default app;", "src/app.tsx": "export default function App(){return <h1>Frontend</h1>}" }));
  assert.equal(requirement(result, "cloudflare_worker")?.need, "required"); assert.equal(requirement(result, "cloudflare_d1")?.need, "required");
  assert.deepEqual(requirement(result, "cloudflare_d1")?.bindingNames, ["DB"]); assert.ok(requirement(result, "backend_api"));
  assert.equal(requirement(result, "postgresql"), undefined); assert.equal(JSON.stringify(result).includes("opaque-account-id"), false);
});

test("JSONC preserves URLs, comment-looking strings and trailing commas while omitting configuration values", () => {
  const result = inspectApplicationRequirements(files({ "package.json": pkg(), "wrangler.jsonc": '{\n// a real comment\n"main":"worker.ts", "vars":{"PUBLIC_URL":"https://example.com/a//b/*value*/","API_KEY":"synthetic-private-config"}, "d1_databases":[{"binding":"DB",}],\n}',
    "worker.ts": "export default {fetch(request,env){return env.DB.prepare('SELECT 1').first()}};" }));
  assert.equal(result.diagnostics.length, 0); assert.equal(requirement(result, "cloudflare_d1")?.need, "required");
  assert.equal(JSON.stringify(result).includes("synthetic-private-config"), false); assert.equal(JSON.stringify(result).includes("https://"), false);
});

test("invalid or executable-looking JSONC never runs and missing Worker files remain explicit", () => {
  for (const config of ['{"main":(globalThis.requirementsExecuted=true)}', '{main:"worker.ts"}', '{"main":"worker.ts","main":"other.ts"}', '{"main":"worker.ts","vars":{...process.env}}', '({"main":"worker.ts"})', '{"main":"../outside.ts"}']) {
    const result = inspectApplicationRequirements(files({ "wrangler.jsonc": config, "worker.ts": "export default {}" }));
    assert.ok(result.diagnostics.some(row => row.code === "CONFIG_INVALID")); assert.equal(requirement(result, "cloudflare_worker")?.need, "unknown");
  }
  assert.equal(Object.hasOwn(globalThis, "requirementsExecuted"), false);
  const absent = inspectApplicationRequirements(files({ "wrangler.jsonc": '{"main":"missing.ts","d1_databases":[{"binding":"DB"}]}' }));
  assert.equal(requirement(absent, "cloudflare_worker")?.need, "unknown"); assert.equal(requirement(absent, "cloudflare_d1")?.need, "unknown"); assert.ok(absent.diagnostics.some(row => row.code === "ENTRY_MISSING"));
});

test("D1 declarations are not satisfied by an unrelated file or guessed database port", () => {
  const result = inspectApplicationRequirements(files({ "wrangler.jsonc": '{"main":"worker.ts","d1_databases":[{"binding":"DB"}]}', "worker.ts": "export default {}", "unrelated.ts": "export function example(c){return c.env.DB.prepare('SELECT 1').all()}" }));
  assert.equal(requirement(result, "cloudflare_d1")?.need, "unknown");
  assert.equal(JSON.stringify(result).includes("5432"), false);
});

test("Supabase SDK calls retain the actual external service instead of becoming an ordinary PostgreSQL database", () => {
  const result = inspectApplicationRequirements(files({ "package.json": pkg({ next: "16.0.0", "@supabase/ssr": "1.0.0" }),
    "src/server/client.ts": "import {createServerClient as create} from '@supabase/ssr'; export function make(){return create(process.env.SUPABASE_URL,process.env.SUPABASE_PUBLISHABLE_KEY,{})}" }));
  assert.ok(requirement(result, "supabase")); assert.equal(requirement(result, "postgresql"), undefined);
  assert.deepEqual(requirement(result, "supabase")?.environmentKeys, ["SUPABASE_PUBLISHABLE_KEY", "SUPABASE_URL"]);
});

test("environment inputs follow constructor arguments and local aliases without collecting unrelated secrets", () => {
  const result = inspectApplicationRequirements(files({ "package.json": pkg(), "server.ts": "import {Pool} from 'pg'; const ignored=process.env.UNRELATED_INPUT; const url=process.env.DATABASE_URL; const options={connectionString:url}; const pool=new Pool(options);" }));
  assert.deepEqual(requirement(result, "postgresql")?.environmentKeys, ["DATABASE_URL"]);
  assert.equal(JSON.stringify(result).includes("UNRELATED_INPUT"), false);
});

test("Redis queues and schedulers remain separate from browser Web Workers", () => {
  const result = inspectApplicationRequirements(files({ "package.json": pkg(), "worker.ts": "import {Worker as QueueWorker} from 'bullmq'; import cron from 'node-cron'; const worker=new QueueWorker('queue',async()=>{}, {connection:{host:process.env.REDIS_HOST}}); cron.schedule('* * * * *',()=>{});", "public/browser.js": "const worker=new Worker('/browser-worker.js');" }));
  assert.equal(requirement(result, "background_worker")?.need, "required"); assert.ok(requirement(result, "redis")); assert.equal(requirement(result, "scheduler")?.need, "required");
  assert.equal(inspectApplicationRequirements(files({ "app.js": "const worker=new Worker('/browser-worker.js');" })).requirements.length, 0);
});

test("separate Python API, SQL/file storage and queue evidence survive a Next frontend root", () => {
  const result = inspectApplicationRequirements(files({ "package.json": pkg({ next: "16.0.0" }), "backend/pyproject.toml": '[project]\nname="service"',
    "backend/app/main.py": "from fastapi import FastAPI\nimport sqlite3\nimport duckdb\nfrom celery import Celery\napp=FastAPI()\nmeta=sqlite3.connect(path)\ndata=duckdb.connect(database)\nworker=Celery()\n" }));
  for (const kind of ["backend_api", "sqlite", "duckdb", "persistent_storage", "background_worker"]) assert.ok(requirement(result, kind, "backend"));
  assert.equal(requirement(result, "sqlite"), undefined);
});

test("WordPress plugin metadata, database use and cron cannot become a Vite-only or plain PHP deployment", () => {
  const result = inspectApplicationRequirements(files({ "package.json": pkg({ vite: "7.0.0" }), "composer.json": JSON.stringify({ type: "wordpress-plugin" }),
    "plugin.php": "<?php\n/*\nPlugin Name: Neutral Plugin\n*/\nadd_action('init','register');\nglobal $wpdb; $wpdb->query($query);\nwp_schedule_event($at,'hourly','neutral');" }));
  assert.equal(requirement(result, "wordpress_host")?.need, "required"); assert.ok(requirement(result, "mysql")); assert.ok(requirement(result, "scheduler"));
  assert.equal(requirement(result, "postgresql"), undefined);
});

test("driver-neutral SQLAlchemy and PDO calls retain a database requirement without guessing PostgreSQL", () => {
  const result = inspectApplicationRequirements(files({ "backend/app.py": "from sqlalchemy.ext.asyncio import create_async_engine\nengine=create_async_engine(settings.database_url)\n", "plugin/connection.php": "<?php $connection=new PDO($dsn);" }));
  assert.equal(requirement(result, "relational_database")?.need, "unknown"); assert.equal(requirement(result, "postgresql"), undefined); assert.equal(requirement(result, "mysql"), undefined);
});

test("normal multiline Python imports and TypeScript decorators retain source evidence without executing either project", () => {
  const result = inspectApplicationRequirements(files({ "backend/database.py": "from sqlalchemy.ext.asyncio import (\n AsyncSession,\n create_async_engine as create,\n)\nimport os, sqlite3 as store\nengine=create(settings.database_url)\nmeta=store.connect(path)\nif not os.path.ismount(root): raise ValueError('mount required')\n", "server/database.ts": "import {Injectable} from '@nestjs/common'; import {Pool} from 'pg'; @Injectable() export class DatabaseService {constructor(){const pool=new Pool({connectionString:process.env.DATABASE_URL})}}" }));
  assert.ok(requirement(result, "relational_database")); assert.ok(requirement(result, "sqlite")); assert.ok(requirement(result, "persistent_storage")); assert.ok(requirement(result, "postgresql")); assert.deepEqual(result.diagnostics, []);
});

test("provider package metadata never authorizes a model call and file storage is not automatically healthy", () => {
  const result = inspectApplicationRequirements(files({ "package.json": pkg({ openai: "6.0.0" }), "service.ts": "import OpenAI from 'openai'; import {DatabaseSync} from 'node:sqlite'; const client=new OpenAI({apiKey:process.env.AI_API_KEY}); const db=new DatabaseSync(':memory:');" }));
  assert.equal(requirement(result, "external_model")?.need, "unknown"); assert.equal(requirement(result, "persistent_storage")?.need, "unknown");
  assert.equal(result.verification, "source_only");
});

test("docs, tests, vendored source, string examples and Python comments cannot manufacture production requirements", () => {
  const result = inspectApplicationRequirements(files({ "package.json": pkg(), "docs/example.ts": "import {Pool} from 'pg'; new Pool();", "src/api.test.ts": "import {Pool} from 'pg'; new Pool();", "data/source/upstream/server.ts": "import {Pool} from 'pg'; new Pool();", "vendor/database.py": "import sqlite3\nsqlite3.connect(path)",
    "server.ts": "// import {Pool} from 'pg'; new Pool();\nconst example=\"import Redis from 'ioredis'; new Redis()\";", "app.py": '# import sqlite3\nexample="sqlite3.connect(path)"\n', "info.php": "<?php /* wp_schedule_event(1,'hourly','demo'); */ $example='wpdb->query()';" }));
  assert.deepEqual(result.requirements, []); assert.deepEqual(result.diagnostics, []);
});

test("malformed code and oversized analysis are visible gaps, never a negative capability claim", () => {
  const result = inspectApplicationRequirements(files({ "package.json": pkg({ pg: "8.0.0" }), "server.ts": "import {Pool from 'pg'; new Pool();", "large.ts": " ".repeat(512 * 1024 + 1), "broken.py": 'import sqlite3\nvalue="unterminated\n' }));
  assert.ok(result.diagnostics.some(row => row.code === "SOURCE_PARSE_FAILED" && row.paths.includes("server.ts")));
  assert.ok(result.diagnostics.some(row => row.code === "SOURCE_PARSE_FAILED" && row.paths.includes("broken.py")));
  assert.ok(result.diagnostics.some(row => row.code === "ANALYSIS_LIMIT")); assert.equal(requirement(result, "postgresql")?.need, "unknown");
});

test("source paths, size, encoding, duplication and private env files retain the import bounds", () => {
  for (const path of ["../server.ts", "a/../server.ts", "/server.ts", "C:/server.ts", "a\\server.ts", ".env.local"]) assert.throws(() => inspectApplicationRequirements(files({ [path]: "data" })));
  assert.throws(() => inspectApplicationRequirements([...files({ "server.ts": "one" }), ...files({ "server.ts": "two" })]));
  assert.throws(() => inspectApplicationRequirements(Array.from({ length: SOURCE_MAX_FILES + 1 }, (_, i) => ({ path: `f${i}.txt`, content: Buffer.alloc(0) }))));
  assert.throws(() => inspectApplicationRequirements([{ path: "server.ts", content: Buffer.alloc(4 * 1024 * 1024 + 1) }]));
  assert.throws(() => inspectApplicationRequirements(Array.from({ length: 6 }, (_, i) => ({ path: `file${i}.bin`, content: Buffer.alloc(Math.floor(SOURCE_MAX_BYTES / 5)) }))));
  const result = inspectApplicationRequirements([{ path: "server.ts", content: Buffer.from([0xff]) }]); assert.ok(result.diagnostics.some(row => row.code === "SOURCE_PARSE_FAILED"));
});

test("source evidence line numbers use text offsets correctly after Persian and Unicode content", () => {
  const result = inspectApplicationRequirements(files({ "server.ts": "// بررسی منبع و داده\nimport {Pool} from 'pg';\nconst pool = new Pool({connectionString:process.env.DATABASE_URL});\n" }));
  assert.equal(requirement(result, "postgresql")?.evidence.find(item => item.kind === "source")?.line, 3);
});

test("large inert data and type metadata do not exhaust executable analysis before a later backend", () => {
  const source = Array.from({ length: 12 }, (_, i) => ({ path: `src/data${i}.ts`, content: Buffer.from(`export const values=[${"123,".repeat(30000)}]; type Names = ${"'label'|".repeat(4000)} never;`) }));
  const result = inspectApplicationRequirements([...source, ...files({ "z-server.ts": "import {Pool} from 'pg'; const pool=new Pool({connectionString:process.env.DATABASE_URL});" })]);
  assert.deepEqual(result.diagnostics, []);
  assert.equal(requirement(result, "postgresql")?.need, "required");
});

test("runtime TypeScript wrappers, enums, namespaces and JSX expressions retain calls while types do not", () => {
  const result = inspectApplicationRequirements(files({ "server.tsx": "import {Pool} from 'pg'; import type Redis from 'ioredis'; type Example=typeof import('redis'); const first=(new Pool({connectionString:process.env.FIRST_DB}) as unknown)!; enum Value { First = new Pool().totalCount } namespace Server { export const second=new Pool({connectionString:process.env.SECOND_DB}); } const page=<main>{new Pool()}</main>;" }));
  assert.deepEqual(result.diagnostics, []);
  assert.equal(requirement(result, "postgresql")?.evidence.filter(row => row.kind === "source").length, 1);
  assert.deepEqual(requirement(result, "postgresql")?.environmentKeys, ["FIRST_DB", "SECOND_DB"]);
  assert.equal(requirement(result, "redis"), undefined);
});

test("requirements and setup metadata identify an independent Python consumer beneath a frontend", () => {
  for (const manifest of ["requirements.txt", "requirements-prod.txt", "requirements.dev.txt", "setup.py", "setup.cfg"]) {
    const result = inspectApplicationRequirements(files({ "package.json": pkg({next:"16.0.0"}), [`backend/${manifest}`]: "# source marker", "backend/main.py": "from fastapi import FastAPI\napp=FastAPI()\n" }));
    assert.ok(requirement(result, "backend_api", "backend"), manifest);
    assert.equal(requirement(result, "backend_api"), undefined);
  }
});
