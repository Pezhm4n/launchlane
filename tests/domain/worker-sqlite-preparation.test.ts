import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { captureProject, type SourceFile } from "../../src/server/workspace/inspect.ts";
import { fullstackPreparation, prepareFullstackFiles } from "../../src/server/agent/fullstack-preparation.ts";
import { workerSqlitePaths, workerSqliteBuild, workerSqliteStart } from "../../src/server/agent/worker-sqlite-programs.ts";
import { fullstackTestCommand } from "../../src/contracts/fullstack.ts";
import { node24BuildImage, parseProjectBuildPlan } from "../../src/contracts/project-build.ts";
import { validateBuildPlan } from "../../src/server/agent/build-policy.ts";
import { preparationPaths } from "../../src/server/agent/preparation.ts";
import { fingerprint } from "../../src/server/policy/action.ts";
import { assertApplicationPublicationScope } from "../../src/server/policy/application-scope.ts";
import { fullstackVerification } from "../../src/server/application/fullstack-verification.ts";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";

const pkg = { name: "worker-fixture", type: "module", scripts: { build: "vite build", test: "vitest run" },
  dependencies: { hono: "4.6.0", react: "18.3.1" }, devDependencies: { vite: "5.4.8", esbuild: "0.21.5" } };
const config = { name: "worker-fixture", main: "worker/index.ts", compatibility_date: "2024-09-23",
  assets: { directory: "./dist", binding: "ASSETS", not_found_handling: "single-page-application", run_worker_first: ["/api/*"] },
  d1_databases: [{ binding: "DB", database_name: "fixture", database_id: "original-database-identity", migrations_dir: "migrations" }] };
const source = () => [
  ["package.json", JSON.stringify(pkg)], ["wrangler.jsonc", JSON.stringify(config)],
  ["package-lock.json", JSON.stringify({ lockfileVersion: 3, packages: { "": {}, "node_modules/fixture": { resolved: "https://registry.npmjs.org/fixture/-/fixture-1.0.0.tgz", integrity: `sha512-${Buffer.alloc(64, 1).toString("base64")}` } } })],
  ["worker/index.ts", "import {Hono} from 'hono';const app=new Hono();app.get('/api/health',c=>c.json({ready:!!c.env.SESSION_SECRET}));app.all('*',c=>c.env.ASSETS.fetch(c.req.raw));export default app;"],
  ["migrations/0001_init.sql", "CREATE TABLE events(id TEXT PRIMARY KEY);"],
  ["migrations/0008_day.sql", "ALTER TABLE events ADD COLUMN day TEXT;"], ["migrations/0008_plan.sql", "ALTER TABLE events ADD COLUMN plan TEXT;"],
  ["index.html", "<!doctype html><html>worker fixture</html>"],
].map(([path, content]) => { assert.ok(path && content);return { path, content: Buffer.from(content) }; });
async function put(root: string, files: readonly SourceFile[]) { for (const file of files) { await mkdir(join(root, file.path, ".."), { recursive: true });await writeFile(join(root, file.path), file.content); } }

test("Worker preparation binds exact Node24 programs while preserving original Worker, migrations, dependencies and tests", async () => {
  const root = await mkdtemp(join(tmpdir(), "launchlane-worker-"));try {
    await put(root, source());const captured = await captureProject(root, "."), profile = captured.profile;
    assert.equal(profile.fullstack?.workerSqlite?.kind, "worker-sqlite");assert.deepEqual(profile.fullstack?.workerSqlite?.requiredEnvironmentKeys, ["SESSION_SECRET"]);
    assert.equal(profile.fullstack?.requiresPreparation, true);assert.ok(profile.envNames.includes("SESSION_SECRET"));
    assert.throws(() => assertApplicationPublicationScope(profile), { code: "APPLICATION_TOPOLOGY_REQUIRED" });
    const plan = fullstackPreparation(captured.files, profile);assert.equal(plan.nodeVersion, "24");assert.equal(plan.startCommand, workerSqliteStart);assert.equal(plan.buildCommand, workerSqliteBuild);
    assert.deepEqual(plan.testScripts, ["test"]);assert.deepEqual(preparationPaths(captured.files, plan).sort(), ["package.json", "liara.json", ".launchlane-build.cjs", ".launchlane-build.json", ...Object.values(workerSqlitePaths)].sort());
    const prepared = prepareFullstackFiles(captured.files, profile, plan);
    for (const file of captured.files.filter(file => file.path !== "package.json")) assert.ok(prepared.find(row => row.path === file.path)?.content.equals(file.content), file.path);
    assert.ok((await readFile(join(root, "package.json"))).equals(captured.files.find(row => row.path === "package.json")?.content ?? Buffer.alloc(0)));
    const build = parseProjectBuildPlan({ version: 7, nodeVersion: "24", image: node24BuildImage, fullstack: plan, buildCommand: plan.buildCommand,
      startCommand: plan.startCommand, testCommand: fullstackTestCommand(plan), port: 3000, workload: { path: "/", status: 200, assertion: { kind: "text", contains: "worker fixture" } },
      apiChecks: [{ path: "/launchlane-health", status: 200, assertions: [{ pointer: ["databaseReady"], equals: true }] }], environment: null });
    assert.equal(validateBuildPlan(captured.files, profile, build).version, 7);assert.equal(fingerprint(parseProjectBuildPlan(build)), fingerprint(build));
    await put(root, prepared);const next = await captureProject(root, ".");assert.equal(next.profile.fullstack?.requiresPreparation, false);
    await writeFile(join(root, workerSqlitePaths.database), "module.exports={}");await assert.rejects(captureProject(root, "."), { code: "WORKER_PREPARATION_CHANGED" });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("unknown Cloudflare bindings, file collisions and incompatible runtimes do not become a prepared native app", async () => {
  const root = await mkdtemp(join(tmpdir(), "launchlane-worker-"));try {
    await put(root, source());const captured = await captureProject(root, ".");
    for (const changed of [{ ...config, kv_namespaces: [{ binding: "CACHE" }] }, { ...config, assets: { ...config.assets, html_handling: "auto-trailing-slash" } },
      { ...config, d1_databases: [{ ...config.d1_databases[0], remote: true }] }]) {
      await writeFile(join(root, "wrangler.jsonc"), JSON.stringify(changed));await assert.rejects(captureProject(root, "."), { code: "WORKER_BINDING_UNSUPPORTED" });
    }
    for (const engines of [{ node: "22.x" }, { node: "invalid" }]) {
      const files = captured.files.map(file => file.path === "package.json" ? { ...file, content: Buffer.from(JSON.stringify({ ...pkg, engines })) } : file);
      assert.throws(() => fullstackPreparation(files, captured.profile), { code: "FULLSTACK_NODE_CONFLICT" });
    }
    const plan = fullstackPreparation(captured.files, captured.profile);
    assert.throws(() => prepareFullstackFiles([...captured.files, { path: workerSqlitePaths.server, content: Buffer.from("existing owner file") }], captured.profile, plan), { code: "WORKER_PREPARATION_CHANGED" });
    assert.throws(() => prepareFullstackFiles(captured.files, captured.profile, { ...plan, workerSqlite: { ...plan.workerSqlite!, configHash: "a".repeat(64) } }), { code: "FULLSTACK_PREPARATION_CHANGED" });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("a source-only Worker with exact host programs still cannot publish without the durable successful build job", async () => {
  const f = await agentFixture();try {
    const directory = join(f.workspace, "worker");await put(directory, source());const captured = await captureProject(directory, "."), plan = fullstackPreparation(captured.files, captured.profile);
    await put(directory, prepareFullstackFiles(captured.files, captured.profile, plan));
    const flow = await prepareProjectFlow(f.config, f.store, f.session.actorId, { kind: "local", directory: "worker" }, AbortSignal.timeout(5000));
    await assert.rejects(fullstackVerification(f.store, f.config.stateDir, f.session.actorId, flow, f.config.sessionSecret), { code: "FULLSTACK_BUILD_REQUIRED" });
  } finally { f.close(); }
});
