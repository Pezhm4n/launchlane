import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { setTimeout as pause } from "node:timers/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { startTestServer } from "./test-server.mjs";
import { Store } from "../src/server/persistence/store.ts";
import { AgentRepository } from "../src/server/agent/store.ts";

// Real browser -> authenticated HTTP -> Agent/job -> real Docker/PostgreSQL -> UI.
// Only the model transport is synthetic. There is no request/decision/receipt interception.
const signingMode = process.env.LAUNCHLANE_TEST_SIGNING_BROWSER === "true";
const baselineMode = signingMode || process.env.LAUNCHLANE_TEST_BASELINE_BROWSER === "true";
const artifactMode = process.env.LAUNCHLANE_TEST_DATA_ARTIFACT_BROWSER === "true", runnerMode = baselineMode || artifactMode || process.env.LAUNCHLANE_TEST_RUNNER_BROWSER === "true", expectedText = runnerMode ? "Runner lifecycle" : "Migration lifecycle",
  retainedText = runnerMode ? "همان داده در همهٔ دیتابیس‌ها پس از اجرای دوبارهٔ runner و برنامه حفظ شد." : "همان داده پس از اجرای دوبارهٔ برنامه حفظ شد.";
const server = await startTestServer({ agentFixture: true }), browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: "fa-IR", reducedMotion: "reduce" }), page = await context.newPage();
const output = resolve(baselineMode ? ".artifacts/baseline-worker" : artifactMode ? ".artifacts/data-artifact-worker" : runnerMode ? ".artifacts/runner-worker" : ".artifacts/migration-worker", new Date().toISOString().replaceAll(":", "-"));
await mkdir(output, { recursive: true }); const errors = [], external = []; let store, decision, decisionUrl, csrf, sessionCookie;
page.on("pageerror", error => errors.push(error.message));
page.on("request", async request => {
  const url = new URL(request.url());
  if (url.origin !== server.origin) external.push(url.origin);
  if (request.method() === "POST" && url.pathname === "/api/projects/database-baselines") csrf = await request.headerValue("x-csrf-token");
  if (request.method() === "POST" && /^\/api\/agent\/runs\/[a-f0-9-]{36}$/.test(url.pathname)) {
    const body = request.postDataJSON();
    if (body.operation === "repair-decision") { decision = body; decisionUrl = url.href; csrf = await request.headerValue("x-csrf-token"); }
  }
});
const calls = async () => { try { return (await readFile(server.modelLog, "utf8")).trim().split("\n").filter(Boolean).length; } catch { return 0; } };
const originalFixture = resolve(runnerMode ? "tests/fixtures/postgres-runner" : "tests/fixtures/postgres-migration"), fixture = baselineMode ? await mkdtemp(join(tmpdir(), "launchlane-baseline-fixture-")) : originalFixture, originalPaths = runnerMode ? ["001_entries.sql", "oracle.test.cjs", "migrate.cjs", "preflight.cjs"] : ["001_entries.sql", "oracle.test.cjs"], originals = await Promise.all(originalPaths.map(path => readFile(join(originalFixture, path)))), layouts = [];
if (baselineMode) {
  await cp(originalFixture, fixture, { recursive: true });
  await writeFile(join(fixture, ".env"), "JWT_SECRET=private_project_material_12345\n");
  const preflight = await readFile(join(fixture, "preflight.cjs"), "utf8");
  await writeFile(join(fixture, "preflight.cjs"), `${preflight}\nconst {Client}=require("pg");(async()=>{for(const key of ["AUTH_DB_URL","PROFILE_DB_URL"]){const c=new Client({connectionString:process.env[key]});await c.connect();try{await c.query("SELECT id FROM public.users LIMIT 0")}finally{await c.end()}}})().catch(e=>{console.error(e.message);process.exitCode=1});`);
  if (signingMode) {
    const server = await readFile(join(fixture, "server.cjs"), "utf8");
    await writeFile(join(fixture, "server.cjs"), `const signing=process.env.JWT_SECRET;require('node:assert/strict').match(signing,/^[a-f0-9]{64}$/);\n${server}`);
  }
}
async function layout(width, state) {
  await page.setViewportSize({ width, height: 844 }); await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze(); assert.deepEqual(axe.violations.map(row => row.id), []); layouts.push({ width, state, overflow: false, axeViolations: 0 });
}
try {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto(server.origin);
  await page.getByLabel("کلید ورود محلی", { exact: true }).fill(server.token);
  await page.getByRole("button", { name: "ورود به میز کار", exact: true }).click();
  await page.getByRole("button", { name: "انتخاب پوشه پروژه", exact: true }).click();
  sessionCookie = (await context.cookies(server.origin)).map(row => `${row.name}=${row.value}`).join("; ");
  const picker = page.getByRole("dialog", { name: "انتخاب پوشه پروژه", exact: true });
  const chooser = page.waitForEvent("filechooser"); await picker.getByRole("button", { name: "انتخاب پوشه از رایانه", exact: true }).click();
  await (await chooser).setFiles(fixture);
  await picker.getByRole("button", { name: "بررسی این پروژه", exact: true }).click(); await picker.waitFor({ state: "detached" });
  await page.waitForURL(url => !!url.searchParams.get("project"));
  const projectId = new URL(page.url()).searchParams.get("project"); assert.ok(projectId);
  const actor = createHash("sha256").update(server.token).digest("hex").slice(0, 24);
  store = new Store(join(server.stateDir, "state.sqlite")); const repo = new AgentRepository(store), flow = store.getProjectFlow(actor, projectId);
  assert.ok(flow?.profile.fullstack); assert.equal(await calls(), 0); assert.equal(store.db.prepare("SELECT count(*) n FROM code_repair_jobs").get().n, 0);
  if (baselineMode) {
    const panel = page.locator("details").filter({ has: page.locator("summary", { hasText: "ساختار اولیهٔ دیتابیس" }) });
    await panel.locator("summary").click();
    await panel.getByText("هنوز ساختار اولیه‌ای برای این نسخه وارد نشده است.", { exact: true }).waitFor();
    await panel.getByLabel("فایل SQL یا backup متنی").setInputFiles({ name: "invalid.sql", mimeType: "application/sql", buffer: Buffer.from([255]) });
    await panel.getByRole("button", { name: "بررسی جدول‌های فایل", exact: true }).click();
    await panel.getByRole("alert").filter({ hasText: "UTF-8" }).waitFor();
    let entered, release;
    const blocked = new Promise(resolve => { entered = resolve; }), held = new Promise(resolve => { release = resolve; });
    const intakeUrl = `${server.origin}/api/projects/database-baselines?projectId=${projectId}`;
    const delayPreview = async route => { entered(); await held; await route.continue().catch(() => undefined); };
    await page.route(intakeUrl, delayPreview);
    await panel.getByLabel("فایل SQL یا backup متنی").setInputFiles({ name: "cancel.sql", mimeType: "application/sql", buffer: Buffer.from("CREATE TABLE public.users(id uuid PRIMARY KEY);") });
    await panel.getByRole("button", { name: "بررسی جدول‌های فایل", exact: true }).click(); await blocked;
    assert.equal(await panel.locator("form").getAttribute("aria-busy"), "true");
    await panel.getByRole("button", { name: "لغو بررسی", exact: true }).click();
    await panel.getByRole("alert").filter({ hasText: "لغو شد" }).waitFor(); release(); await page.unroute(intakeUrl, delayPreview);
    assert.equal(store.db.prepare("SELECT count(*) n FROM database_baselines").get().n, 0);
    await panel.getByLabel("فایل SQL یا backup متنی").setInputFiles({ name: "auth-backup.sql", mimeType: "application/sql", buffer: Buffer.from("CREATE TABLE public.users(id uuid PRIMARY KEY);\nCOPY public.users(id) FROM stdin;\nprivate-row-must-not-be-imported\n\\.\n") });
    await panel.getByRole("button", { name: "بررسی جدول‌های فایل", exact: true }).click();
    const checkbox = panel.getByRole("checkbox", { name: "public.users", exact: true }); await checkbox.waitFor();
    for (const width of [280, 320, 390, 768, 1280]) await layout(width, "baseline-selection");
    await page.screenshot({ path: join(output, "baseline-selection-1280.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: join(output, "baseline-selection-390.png"), fullPage: true });
    await checkbox.focus(); await checkbox.press("Space");
    await panel.getByRole("button", { name: "ذخیرهٔ ساختار انتخاب‌شده", exact: true }).click();
    await panel.getByRole("status").waitFor();
    const records = store.db.prepare("SELECT * FROM database_baselines").all();
    assert.equal(records.length, 1); assert.ok(!JSON.stringify(records).includes("private-row-must-not-be-imported"));
    assert.equal(records[0].source_hash, flow.profile.sourceHash); assert.equal(await calls(), 0);
    assert.ok(csrf);
    const privateTable = "public.private_project_material_12345", privateSql = Buffer.from(`CREATE TABLE ${privateTable}(id uuid);`);
    for (const extra of [{}, { tables: JSON.stringify([privateTable]), requestKey: projectId }]) {
      const blocked = await context.request.post(intakeUrl, { headers: { origin: server.origin, "x-csrf-token": csrf }, multipart: { file: { name: "blocked.sql", mimeType: "application/sql", buffer: privateSql }, ...extra } });
      assert.equal(blocked.status(), 403); const rejected = await blocked.text(); assert.equal(JSON.parse(rejected).error.code, "SENSITIVE_SOURCE"); assert.ok(!rejected.includes("private_project_material_12345"));
    }
    const denied = await context.request.post(intakeUrl, { headers: { origin: server.origin, "x-csrf-token": "forged" }, multipart: { file: { name: "x.sql", mimeType: "application/sql", buffer: Buffer.from("CREATE TABLE public.users(id uuid);") } } });
    assert.equal(denied.status(), 403); assert.equal((await denied.json()).error.code, "CSRF_DENIED");
    for (const extra of [{ unexpected: "value" }, { tables: "invalid-json", requestKey: "invalid" }]) {
      const invalid = await context.request.post(intakeUrl, { headers: { origin: server.origin, "x-csrf-token": csrf }, multipart: { file: { name: "x.sql", mimeType: "application/sql", buffer: Buffer.from("CREATE TABLE public.users(id uuid);") }, ...extra } });
      assert.equal(invalid.status(), 400); assert.equal((await invalid.json()).error.code, "INVALID_INPUT");
    }
    assert.equal(store.db.prepare("SELECT count(*) n FROM database_baselines").get().n, 1);
    await page.reload(); await panel.locator("summary").click();
    await panel.getByRole("listitem").filter({ hasText: "public.users" }).waitFor();
  }
  const journey = page.locator(".publication-journey");
  await journey.getByText("صفحه و نشانه مورد انتظار", { exact: true }).click(); await page.locator("#mission-expectation").fill(expectedText);
  await journey.getByRole("button", { name: "بررسی و آماده‌سازی انتشار", exact: true }).click();
  const review = page.locator('[aria-labelledby="migration-test-title"]'); await review.waitFor();
  const proposed = repo.forProject(actor, projectId, "publication"); assert.ok(proposed?.repair);
  assert.equal(proposed.state, "needs_approval"); assert.equal(proposed.repair.state, "proposed"); assert.deepEqual(proposed.repair.containerIds, []);
  assert.equal(proposed.repair.afterTest, null); assert.equal(proposed.repair.postgresFixtureId, undefined); assert.equal(await calls(), baselineMode ? 2 : 1);
  assert.equal(await page.locator(".optional-chat:visible").count(), 0);
  if (signingMode) {
    assert.deepEqual(proposed.repair.build.testDatabase.testSigningKeys, ["JWT_SECRET"]);
    await review.getByText(/مقدار امضای تصادفی/).waitFor();
    assert.ok(!(await review.textContent() ?? "").includes("private_project_material_12345"));
  }
  if (runnerMode) for (const width of [280, 320, 390, 768, 1280]) await layout(width, "review");
  if (process.env.LAUNCHLANE_TEST_REJECT_BUILD === "true") {
    assert.ok(baselineMode, "reject-only case requires the schema intake fixture");
    const response = page.waitForResponse(row => row.request().method() === "POST" && row.url().includes("/api/agent/runs/") && row.request().postDataJSON()?.decision === "reject");
    const reject = journey.getByRole("button", { name: proposed.repair.validationOnly ? "رد آماده‌سازی" : "رد اصلاح", exact: true });
    await reject.focus(); await reject.press("Enter"); assert.equal((await response).status(), 200); await reject.waitFor({ state: "detached" });
    const result = repo.get(actor, proposed.id); assert.equal(result.state, "needs_input"); assert.equal(result.repair.state, "cancelled");
    assert.deepEqual(result.repair.containerIds, []); assert.equal(result.repair.afterTest, null); assert.equal(result.repair.artifact, null); assert.equal(result.publication, null);
    assert.ok(decision && decisionUrl && csrf); const replay = await context.request.post(decisionUrl, { headers: { origin: server.origin, "x-csrf-token": csrf }, data: decision }); assert.equal(replay.status(), 409);
    await page.reload(); await page.locator(".publication-journey").waitFor(); assert.equal(await calls(), 2);
    for (const width of [280, 320, 390, 768, 1280]) await layout(width, "rejected");
    await page.screenshot({ path: join(output, "rejected-1280.png"), fullPage: true }); assert.deepEqual(errors, []); assert.deepEqual(external, []);
    const summary = { scope: "schema intake and reviewed signing-key rejection; no worker or SQL", model: "synthetic", modelRequests: await calls(), workerExecutions: 0, cloudWrites: 0, replayStatus: replay.status(), layouts, output };
    await writeFile(join(output, "results.json"), JSON.stringify(summary, null, 2)); console.log(JSON.stringify(summary));
  } else {
  const approve = journey.getByRole("button", { name: proposed.repair.validationOnly ? "تأیید ساخت و بررسی برنامه" : "تأیید اصلاح و اجرای آزمون", exact: true }); await approve.focus(); await approve.press("Enter");
  await review.getByText(retainedText, { exact: true }).waitFor({ timeout: 300000 });
  await page.waitForFunction(() => !document.querySelector('.publication-journey [aria-busy="true"]'), null, { timeout: 30000 });
  const deadline = Date.now() + 30000; let result = repo.get(actor, proposed.id);
  while (result?.state === "working" && Date.now() < deadline) { await page.waitForTimeout(100); result = repo.get(actor, proposed.id); }
  const proof = runnerMode ? result?.repair?.afterTest?.databaseRunner : result?.repair?.afterTest?.databaseMigration;
  assert.ok(proof && result?.repair); assert.equal(result.state, "partially_completed"); assert.equal(result.repair.state, "succeeded");
  assert.equal(result.repair.baseRevision, flow.profile.sourceHash); assert.equal(proof.sourceHash, result.repair.postgresFixtureSourceHash);
  if (runnerMode) {
    assert.equal(result.repair.build.testDatabase.version, artifactMode ? 4 : 3); assert.equal(proof.runnerHash, result.repair.build.testDatabase.runner.sha256); assert.equal(proof.runnerRuns, 2);
    assert.deepEqual(proof.targets, [{ id: "auth", columnChecks: 5, rowChecks: 2, persistenceChecks: 1 }, { id: "profile", columnChecks: 5, rowChecks: 2, persistenceChecks: 1 }]);
  } else { assert.equal(proof.files[0].sha256, createHash("sha256").update(originals[0]).digest("hex")); assert.equal(proof.columnChecks, 3); assert.equal(proof.rowChecks, 1); assert.equal(proof.persistenceChecks, 1); }
  assert.equal(proof.applicationRuns, 2);
  assert.equal(proof.production, false); assert.equal(proof.databaseRestartVerified, false);
  if (artifactMode) { assert.ok(result.repair.artifact && result.repair.publication && result.repair.afterTest.buildOutput); const selected = store.getProjectFlow(actor); assert.equal(selected?.selection.kind, "repair"); assert.equal(selected?.artifact?.archiveHash, result.repair.artifact.archiveHash); }
  else assert.equal(result.repair.artifact, null);
  assert.equal(result.publication, null); assert.equal(result.effect, "no_remote_changes");
  assert.equal(result.repair.containerIds.length, runnerMode ? 5 : 3); assert.equal(new Set(result.repair.containerIds).size, runnerMode ? 5 : 3); assert.equal(result.repair.postgresExecutionStarted, undefined);
  assert.equal(store.db.prepare("SELECT count(*) n FROM actions").get().n, 0); assert.equal(await calls(), baselineMode ? 3 : 2);
  assert.ok(decision && decisionUrl && csrf); assert.equal(decision.decision, "approve");
  const replay = await context.request.post(decisionUrl, { headers: { origin: server.origin, "x-csrf-token": csrf }, data: decision });
  assert.equal(replay.status(), 409); assert.equal((await replay.json()).error.code, "AGENT_CONFLICT");
  const before = { calls: await calls(), containers: result.repair.containerIds, usage: result.usage, limits: result.limits };
  await page.reload(); await page.locator('[aria-labelledby="migration-test-title"]').getByText(retainedText, { exact: true }).waitFor();
  result = repo.get(actor, proposed.id); assert.equal(await calls(), before.calls); assert.deepEqual(result.repair.containerIds, before.containers); assert.deepEqual(result.usage, before.usage); assert.deepEqual(result.limits, before.limits);
  for (const [i, path] of originalPaths.entries()) assert.ok((await readFile(join(originalFixture, path))).equals(originals[i]));
  if (runnerMode) { for (const width of [280, 320, 390, 768, 1280]) await layout(width, "receipt"); await page.screenshot({ path: join(output, "runner-worker-1280.png"), fullPage: true }); await page.setViewportSize({ width: 390, height: 844 }); }
  assert.deepEqual(errors, []); assert.deepEqual(external, []); await page.screenshot({ path: join(output, "migration-worker-390.png"), fullPage: true });
  const summary = { projectId, runId: proposed.id, sourceHash: flow.profile.sourceHash, model: "synthetic", modelRequests: await calls(), apiDecisions: 1, replayStatus: replay.status(), containerCount: result.repair.containerIds.length, migration: proof, cloudWrites: 0, reloadReplayed: false, errors, external, layouts };
  await writeFile(join(output, "results.json"), JSON.stringify(summary, null, 2)); console.log(JSON.stringify({ ...summary, output }));
  }
} catch (error) {
  const actor = createHash("sha256").update(server.token).digest("hex").slice(0, 24), flow = store?.getProjectFlow(actor), run = flow ? new AgentRepository(store).forProject(actor, flow.id, "publication") : null;
  await writeFile(join(output, "failure.json"), JSON.stringify({ error: String(error), state: run?.state, code: run?.errorCode, runId: run?.id, jobId: run?.repair?.id, containerIds: run?.repair?.containerIds, fixtureId: run?.repair?.postgresFixtureId, jobState: run?.repair?.state, jobError: run?.repair?.errorCode, events: run?.events, afterTest: run?.repair?.afterTest }, null, 2));
  await page.screenshot({ path: join(output, "failure.png"), fullPage: true }).catch(() => undefined); throw error;
} finally {
  let preserveState = false;
  if (store && csrf && sessionCookie) {
    const actor = createHash("sha256").update(server.token).digest("hex").slice(0, 24), flow = store.getProjectFlow(actor), repo = new AgentRepository(store), run = flow ? repo.forProject(actor, flow.id, "publication") : null;
    if (run?.repair && ["working", "queued"].includes(run.state)) {
      try {
        const cancelled = await fetch(`${server.origin}/api/agent/runs/${run.id}`, { method: "POST", headers: { origin: server.origin, cookie: sessionCookie, "content-type": "application/json", "x-csrf-token": csrf }, body: JSON.stringify({ operation: "cancel", revision: run.revision }), signal: AbortSignal.timeout(5000) });
        const deadline = Date.now() + 15000; let settled = false;
        while (cancelled.ok && Date.now() < deadline) {
          const row = store.db.prepare("SELECT state,data_json FROM code_repair_jobs WHERE id=? AND actor_id=?").get(run.repair.id, actor), job = row ? JSON.parse(row.data_json).job : null;
          if (job && !["working", "queued"].includes(row.state) && !job.postgresExecutionStarted) { settled = true; break; }
          await pause(100);
        }
        preserveState = !settled;
      } catch { preserveState = true; }
      if (preserveState) await writeFile(join(output, "cleanup-uncertain.json"), JSON.stringify({ stateDir: server.stateDir, runId: run.id, jobId: run.repair.id, containerIds: run.repair.containerIds, cleanup: "unconfirmed" }, null, 2));
    }
  }
  store?.close(); await context.close(); await browser.close(); await server.close({ preserveState });
  if (baselineMode) await rm(fixture, { recursive: true, force: true });
}
