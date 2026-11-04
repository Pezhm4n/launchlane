import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runnerFixture } from "../helpers/runner-fixture.ts";
import { addModuleRunner } from "../helpers/module-runner-fixture.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import { captureProject } from "../../src/server/workspace/inspect.ts";
import { sourceMigrationModule } from "../../src/server/agent/postgres-module-runner.ts";
import { validateSourceRunner } from "../../src/server/agent/postgres-runner-test.ts";
import { executeAgentTool, currentAgentContext } from "../../src/server/agent/tools.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";
import { object } from "../../src/contracts/validation.ts";
import { parseCodeRepairJob } from "../../src/contracts/code-repair.ts";
import { parseMigrationModuleInput } from "../../src/contracts/postgres-module-runner.ts";
import { parseDisposableTestDatabase } from "../../src/contracts/test-database.ts";
import { fingerprint } from "../../src/server/policy/action.ts";

test("shared build proposal binds an existing module export, literal arguments and separate targets without execution", async () => {
  const f = await runnerFixture(); try {
    const input = await addModuleRunner(f.project);
    const flow = await prepareProjectFlow(f.config, f.store, f.session.actorId, { kind: "local", directory: "runner-service" }, AbortSignal.timeout(10000));
    const context = { config: f.config, store: f.store, actorId: f.session.actorId, context: currentAgentContext(f.config, f.store, f.session.actorId), createdAt: Date.now(), budget: new RunBudget(f.config), signal: AbortSignal.timeout(10000) };
    const job = parseCodeRepairJob(object(await executeAgentTool("propose_project_build", input, context)).repairProposal);
    assert.ok(job.build?.version === 7 && job.build.testDatabase?.version === 3);
    const plan = job.build.testDatabase; assert.ok("kind" in plan.runner);
    assert.equal(plan.runner.module.path, "migrate.mjs"); assert.equal(plan.runner.module.loader, "node");
    assert.deepEqual(plan.runner.module.targets, input.compatibilityDatabase.runnerModule.targets);
    assert.equal(fingerprint(parseDisposableTestDatabase(plan)), fingerprint(plan));
    assert.equal(job.state, "proposed"); assert.deepEqual(job.containerIds, []); assert.equal(job.afterTest, null);
    assert.equal(f.store.db.prepare("SELECT count(*) n FROM actions").get()?.n, 0);
    const files = (await captureProject(f.workspace, "runner-service", { signal: context.signal, secrets: [] })).files;
    validateSourceRunner(files, plan.runner);
    assert.throws(() => validateSourceRunner(files.map(file => file.path === "migrate.mjs" ? { ...file, content: Buffer.concat([file.content, Buffer.from("\n//changed")]) } : file), plan.runner), { code: "MIGRATION_RUNNER_CHANGED" });
    for (const extra of [{ runnerScript: "missing" }, { runnerModule: { ...input.compatibilityDatabase.runnerModule, loader: "node" } }, { environmentKeys: ["AUTH_DB_URL"] }])
      await assert.rejects(executeAgentTool("propose_project_build", { ...input, compatibilityDatabase: { ...input.compatibilityDatabase, ...extra } }, context));
    assert.throws(() => parseDisposableTestDatabase({ ...plan, targets: [...plan.targets].reverse() }), { code: "MIGRATION_MODULE_INVALID" });
    const failed = parseCodeRepairJob({ ...job, state: "failed", errorCode: "BUILD_TEST_FAILED", message: "controlled failure" });
    await assert.rejects(executeAgentTool("propose_project_build", { ...input, compatibilityDatabase: { ...input.compatibilityDatabase,
      runnerModule: { ...input.compatibilityDatabase.runnerModule, targets: [...input.compatibilityDatabase.runnerModule.targets].reverse() } } }, { ...context, buildJob: failed }));
    assert.equal(flow.profile.sourceHash, context.context.sourceHash);
  } finally { f.close(); }
});

test("module input rejects executable/connection values, Pool override, prototypes and unevidenced exports/options/literals", async () => {
  const f = await runnerFixture(); try {
    const input = (await addModuleRunner(f.project)).compatibilityDatabase.runnerModule;
    const ordered = parseMigrationModuleInput({ ...input, targets: [{ id: "auth", arguments: { z: null, Z: null, _option: null, a: null } }] });
    assert.deepEqual(Object.keys(ordered.targets[0]?.arguments ?? {}), ["Z", "_option", "a", "z"], "invocation hashes use locale-independent key ordering");
    const files = (await captureProject(f.workspace, "runner-service", { signal: AbortSignal.timeout(10000), secrets: [] })).files;
    for (const bad of [{ ...input, path: "../migrate.mjs" }, { ...input, exportName: "constructor" }, { ...input, poolProperty: "__proto__" }, { ...input, targets: [] },
      ...["postgresql://private", "DROP TABLE entries;", "process.exit(0)", { target: "auth" }, []].map(value => ({ ...input, targets: [{ id: "auth", arguments: { target: value } }] })),
      { ...input, targets: [{ id: "auth", arguments: { pool: "auth" } }] },
      { ...input, targets: [{ id: "auth", arguments: JSON.parse('{"__proto__":"auth"}') }] }]) assert.throws(() => parseMigrationModuleInput(bad));
    for (const bad of [{ ...input, exportName: "missing" }, { ...input, poolProperty: "database" }, { ...input, targets: [{ id: "auth", arguments: { target: "invented" } }] }, { ...input, targets: [{ id: "auth", arguments: { unknown: "auth" } }] }])
      assert.throws(() => sourceMigrationModule(files, bad), { code: "MIGRATION_MODULE_SOURCE_REQUIRED" });
  } finally { f.close(); }
});

test("TypeScript module runner preserves existing backend tsx/config and detects loader or config changes", async () => {
  const f = await runnerFixture(); try {
    const input = (await addModuleRunner(f.project)).compatibilityDatabase.runnerModule;
    await writeFile(join(f.project, "migrate.ts"), await readFile(join(f.project, "migrate.mjs")));
    await writeFile(join(f.project, "api.ts"), "const app=require('express')();app.listen(3000);");
    await writeFile(join(f.project, "tsconfig.backend.json"), '{"compilerOptions":{"target":"ES2022"}}');
    const path = join(f.project, "package.json"), pkg = object(JSON.parse(await readFile(path, "utf8")));
    object(pkg.scripts).server = "tsx --tsconfig tsconfig.backend.json api.ts"; object(pkg.devDependencies).tsx = "4.20.5";
    await writeFile(path, JSON.stringify(pkg));
    const files = (await captureProject(f.workspace, "runner-service", { signal: AbortSignal.timeout(10000), secrets: [] })).files;
    const request = { ...input, path: "migrate.ts" }, runner = sourceMigrationModule(files, request);
    assert.equal(runner.module.loader, "tsx"); assert.equal(runner.module.tsconfig?.path, "tsconfig.backend.json");
    const changed = files.map(file => file.path === "tsconfig.backend.json" ? { ...file, content: Buffer.from('{}') } : file);
    assert.throws(() => validateSourceRunner(changed, runner), { code: "MIGRATION_RUNNER_CHANGED" });
    assert.throws(() => sourceMigrationModule(files.filter(file => file.path !== "tsconfig.backend.json"), request), { code: "MIGRATION_MODULE_LOADER_REQUIRED" });
  } finally { f.close(); }
});
