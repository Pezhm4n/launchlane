import assert from "node:assert/strict";
import { test } from "node:test";
import { cp, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID, randomBytes } from "node:crypto";
import { chromium } from "playwright";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { componentTarget } from "../helpers/component-target.ts";
import { phpFixtureReader } from "../helpers/php-reader.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import { executeAgentTool, currentAgentContext } from "../../src/server/agent/tools.ts";
import { CodeRepairAdapter } from "../../src/server/agent/code-repair.ts";
import { parseCodeRepairJob } from "../../src/contracts/code-repair.ts";
import { object } from "../../src/contracts/validation.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";
import { assertPhpJob } from "../../src/server/policy/php-artifact.ts";
import { readArtifact } from "../../src/server/workspace/archive.ts";
import { compiledProof } from "../../src/server/agent/fullstack-artifact.ts";
import { composerToolUrl, type PhpReader } from "../../src/server/agent/php-source.ts";

test("actual PHP Composer lock, PHPUnit, installed archive and fresh Apache/browser", async () => {
  const f = await agentFixture(); try {
    const directory = join(f.workspace, "php"), secret = randomUUID(); await cp(resolve("tests/fixtures/php-service"), directory, { recursive: true }); await writeFile(join(directory, ".env"), `APP_LABEL=${secret}\n`);
    const config = { ...f.config, enableLocalRepair: true, maxToolCalls: 512 }, signal = AbortSignal.timeout(360000);
    const flow = await prepareProjectFlow(config, f.store, f.session.actorId, { kind: "local", directory: "php" }, signal);
    assert.equal(flow.profile.runtime, "php"); assert.equal(flow.status, "ready"); assert.ok(flow.profile.envNames.includes("APP_LABEL")); assert.ok(flow.profile.manifest.some(file => file.path === "public/.htaccess"));
    const proposal = object(await executeAgentTool("propose_project_build", { path: "/api/orders", status: 200, assertion: { kind: "json", field: "total", equals: 73 } }, { config, store: f.store, actorId: f.session.actorId, context: currentAgentContext(config, f.store, f.session.actorId), budget: new RunBudget(config), createdAt: Date.now(), signal }));
    const proposed = parseCodeRepairJob(proposal.repairProposal); assert.equal(proposed.build?.version, 12);
    const adapter = new CodeRepairAdapter(config, f.store, undefined, undefined, {}, undefined, undefined, phpFixtureReader); adapter.approve(f.session.actorId, proposed.id); const job = await adapter.run(f.session.actorId, proposed.id, signal);
    assert.equal(job.state, "succeeded", JSON.stringify({ code: job.errorCode, message: job.message, receipt: job.afterTest })); assert.ok(job.artifact && job.publication); assert.equal(job.containerIds?.length, 2); assert.equal(job.afterTest?.buildOutput?.version, 2); assert.equal(JSON.stringify(job).includes(secret), false);
    assert.match(job.afterTest?.output ?? "", /fresh installed PHP Apache workload verified without Composer/);
    const selected = await prepareProjectFlow(config, f.store, f.session.actorId, { kind: "repair", directory: ".", jobId: job.id, artifactHash: job.artifact.archiveHash }, signal); assert.equal(assertPhpJob(f.store, f.session.actorId, selected).build.version, 12);
    const target = await componentTarget(await readArtifact(config.stateDir, job.artifact), 8080, ".launchlane-php.Dockerfile"); try {
      assert.equal(await (await fetch(target.origin + "/launchlane-build-proof.json")).text(), compiledProof(job.publication)); assert.equal((await (await fetch(target.origin + "/api/orders")).json()).total, 73);
      const browser = await chromium.launch({ headless: true }); try { const page = await browser.newPage(); await page.goto(target.origin); await page.getByRole("button", { name: "Load orders", exact: true }).click(); await page.getByText("Invoice total: 73", { exact: true }).waitFor(); await page.waitForURL(target.origin + "/orders-view"); await page.reload(); await page.getByRole("button", { name: "Load orders", exact: true }).click(); await page.getByText("Invoice total: 73", { exact: true }).waitFor(); } finally { await browser.close(); }
    } finally { await target.close(); }
    assert.deepEqual(await readFile(join(directory, "composer.lock")), await readFile("tests/fixtures/php-service/composer.lock")); console.log(JSON.stringify({ sourceHash: job.baseRevision, artifactHash: job.artifact.archiveHash, output: job.afterTest?.buildOutput, actualWorkers: 2, runtime: "PHP8.3.36/Apache", browser: "Chromium", modelRequests: 0, cloudWrites: 0 }));
  } finally { f.close(); }
});

test("actual Laravel hooks, framework route tests, installed production archive and fresh Apache", async () => {
  const f = await agentFixture(); try {
    const directory = join(f.workspace, "laravel"), secret = randomUUID(), key = `base64:${randomBytes(32).toString("base64")}`; await cp(resolve("tests/fixtures/laravel-service"), directory, { recursive: true }); await writeFile(join(directory, ".env"), `APP_LABEL=${secret}\nAPP_KEY=${key}\n`);
    const config = { ...f.config, enableLocalRepair: true, maxToolCalls: 512 }, signal = AbortSignal.timeout(360000), flow = await prepareProjectFlow(config, f.store, f.session.actorId, { kind: "local", directory: "laravel" }, signal);
    assert.equal(flow.profile.phpRuntime?.kind, "laravel"); assert.ok(flow.profile.envNames.includes("APP_KEY"));
    const proposal = object(await executeAgentTool("propose_project_build", { path: "/api/orders", status: 200, assertion: { kind: "json", field: "total", equals: 73 } }, { config, store: f.store, actorId: f.session.actorId, context: currentAgentContext(config, f.store, f.session.actorId), budget: new RunBudget(config), createdAt: Date.now(), signal })), proposed = parseCodeRepairJob(proposal.repairProposal);
    const adapter = new CodeRepairAdapter(config, f.store, undefined, undefined, {}, undefined, undefined, phpFixtureReader); adapter.approve(f.session.actorId, proposed.id); const job = await adapter.run(f.session.actorId, proposed.id, signal);
    assert.equal(job.state, "succeeded", JSON.stringify({ code: job.errorCode, message: job.message, receipt: job.afterTest })); assert.ok(job.artifact && job.publication); assert.equal(job.containerIds?.length, 2); assert.match(job.afterTest?.output ?? "", /artisan package:discover/); assert.match(job.afterTest?.output ?? "", /OK \(4 tests, 5 assertions\)/); assert.match(job.afterTest?.output ?? "", /fresh installed PHP Apache workload verified/);
    assert.equal(JSON.stringify(job).includes(secret), false); assert.equal(JSON.stringify(job).includes(key), false);
    const selected = await prepareProjectFlow(config, f.store, f.session.actorId, { kind: "repair", directory: ".", jobId: job.id, artifactHash: job.artifact.archiveHash }, signal); assert.equal(assertPhpJob(f.store, f.session.actorId, selected).build.runtime.kind, "laravel");
    const archive = await readArtifact(config.stateDir, job.artifact), target = await componentTarget(archive, 8080, ".launchlane-php.Dockerfile"); try {
      assert.equal(await (await fetch(target.origin + "/launchlane-build-proof.json")).text(), compiledProof(job.publication)); assert.equal((await (await fetch(target.origin + "/api/orders")).json()).total, 73);
    } finally { await target.close(); }
    assert.deepEqual(await readFile(join(directory, "composer.lock")), await readFile("tests/fixtures/laravel-service/composer.lock")); console.log(JSON.stringify({ family: "laravel", sourceHash: job.baseRevision, artifactHash: job.artifact.archiveHash, output: job.afterTest?.buildOutput, actualWorkers: 2, originalHooks: true, frameworkTests: 4, freshApache: true, modelRequests: 0, cloudWrites: 0 }));
  } finally { f.close(); }
});

for (const mode of ["test-failure", "skipped", "no-tests", "wrong-api", "changed-source", "background-counterfeit", "build-tree-escape", "source-exposure", "stale-lock", "bad-tool", "tool-environment", "database-output"]) test(`actual PHP rejection: ${mode}`, async () => {
  const f = await agentFixture(); try {
    const directory = join(f.workspace, "php"); await cp(resolve("tests/fixtures/php-service"), directory, { recursive: true });
    if (mode === "test-failure") { const file = join(directory, "src/Invoice.php"), text = await readFile(file, "utf8"); await writeFile(file, text.replace("$line['price'] * $line['quantity']", "$line['price']")); }
    if (mode === "skipped") await writeFile(join(directory, "tests/InvoiceTest.php"), "<?php final class InvoiceTest extends PHPUnit\\Framework\\TestCase {public function testPending():void{$this->markTestSkipped('not measured');}}\n");
    if (mode === "no-tests") await writeFile(join(directory, "tests/InvoiceTest.php"), "<?php // No tests declared\n");
    if (mode === "database-output") await writeFile(join(directory, "tests/DataTest.php"), "<?php final class DataTest extends PHPUnit\\Framework\\TestCase {public function testData():void{file_put_contents(__DIR__.'/../vendor/runtime.sqlite','test-only-data');self::assertTrue(true);}}\n");
    if (mode === "changed-source") await writeFile(join(directory, "tests/ChangesTest.php"), "<?php final class ChangesTest extends PHPUnit\\Framework\\TestCase {public function testChange():void{file_put_contents(__DIR__.'/../public/injected.php','<?php echo 73;');self::assertTrue(true);}}\n");
    if (mode === "background-counterfeit") {
      await writeFile(join(directory, "tests/daemon.php"), '<?php header("Content-Type: application/json");echo json_encode(["total"=>73]);\n');
      await writeFile(join(directory, "tests/CounterfeitTest.php"), "<?php final class CounterfeitTest extends PHPUnit\\Framework\\TestCase {public function testDaemon():void{exec('/usr/local/bin/php -S 0.0.0.0:8080 tests/daemon.php >/dev/null 2>&1 &');usleep(200000);self::assertTrue(true);}}\n");
      await writeFile(join(directory, "public/index.php"), '<?php throw new RuntimeException("production start broken");\n');
    }
    if (mode === "build-tree-escape") { const file = join(directory, "public/index.php"), text = await readFile(file, "utf8"); await writeFile(file, text.replace("require __DIR__", "if(!is_file('/input/composer.phar')){http_response_code(500);exit('compiler cache required');}\nrequire __DIR__")); }
    if (mode === "source-exposure") { const file = join(directory, "public/.htaccess"); await writeFile(file, (await readFile(file, "utf8")) + "\n<FilesMatch \\.php$>\nSetHandler none\n</FilesMatch>\n"); }
    if (mode === "stale-lock") { const file = join(directory, "composer.json"), pkg = JSON.parse(await readFile(file, "utf8")); pkg.require["psr/log"] = "^3.0"; await writeFile(file, JSON.stringify(pkg)); }
    if (mode === "tool-environment") { const file = join(directory, "public/index.php"); await writeFile(file, (await readFile(file, "utf8")).replace("getenv('APP_LABEL')", "getenv('COMPOSER_AUTH')")); await writeFile(join(directory, ".env"), "COMPOSER_AUTH=private-fixture-tool-input\n"); }
    const config = { ...f.config, enableLocalRepair: true, maxToolCalls: 512 }, signal = AbortSignal.timeout(360000);
    const flow = await prepareProjectFlow(config, f.store, f.session.actorId, { kind: "local", directory: "php" }, signal), workload = mode === "source-exposure" ? { path: "/", status: 200, assertion: { kind: "text", contains: "PHP invoice" } } : { path: "/api/orders", status: 200, assertion: { kind: "json", field: "total", equals: mode === "wrong-api" ? 74 : 73 } };
    const proposal = object(await executeAgentTool("propose_project_build", workload, { config, store: f.store, actorId: f.session.actorId, context: currentAgentContext(config, f.store, f.session.actorId), budget: new RunBudget(config), createdAt: Date.now(), signal })), proposed = parseCodeRepairJob(proposal.repairProposal);
    const reader: PhpReader = async (url, parent, limit, take) => { const bytes = await phpFixtureReader(url, parent, limit, take); if (mode === "bad-tool" && url === composerToolUrl) { const changed = Buffer.from(bytes); changed[0] = (changed[0] ?? 0) ^ 1; return changed; } return bytes; };
    const adapter = new CodeRepairAdapter(config, f.store, undefined, undefined, {}, undefined, undefined, reader); adapter.approve(f.session.actorId, proposed.id); const job = await adapter.run(f.session.actorId, proposed.id, signal);
    assert.equal(job.state, "failed", JSON.stringify({ code: job.errorCode, receipt: job.afterTest })); assert.equal(job.artifact, null); assert.equal(job.publication, undefined);
    if (mode === "tool-environment") { assert.equal(job.errorCode, "PHP_ENVIRONMENT_UNSUPPORTED"); assert.deepEqual(job.containerIds, []); return; }
    if (mode === "bad-tool") { assert.equal(job.errorCode, "PHP_TOOLCHAIN_CHANGED"); assert.deepEqual(job.containerIds, []); return; }
    assert.equal(job.afterTest?.exitCode, mode === "database-output" ? 72 : mode === "stale-lock" ? 71 : ["wrong-api", "build-tree-escape", "source-exposure"].includes(mode) ? 73 : 76, JSON.stringify({ code: job.errorCode, receipt: job.afterTest }));
    if (mode === "background-counterfeit") assert.match(job.afterTest?.output ?? "", /unexpected background process/);
    if (mode === "changed-source") assert.match(job.afterTest?.output ?? "", /source gained an unreviewed file/);
    assert.deepEqual(await readFile(join(directory, "composer.lock")), await readFile("tests/fixtures/php-service/composer.lock"));
    assert.equal(flow.profile.runtime, "php");
  } finally { f.close(); }
});
