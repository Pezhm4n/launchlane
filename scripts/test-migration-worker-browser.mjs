import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { startTestServer } from "./test-server.mjs";
import { Store } from "../src/server/persistence/store.ts";
import { AgentRepository } from "../src/server/agent/store.ts";

// Real browser -> authenticated HTTP -> Agent/job -> real Docker/PostgreSQL -> UI.
// Only the model transport is synthetic. There is no request/decision/receipt interception.
const server = await startTestServer({ agentFixture: true }), browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: "fa-IR", reducedMotion: "reduce" }), page = await context.newPage();
const output = resolve(".artifacts/migration-worker", new Date().toISOString().replaceAll(":", "-"));
await mkdir(output, { recursive: true }); const errors = [], external = []; let store, decision, decisionUrl, csrf;
page.on("pageerror", error => errors.push(error.message));
page.on("request", async request => {
  const url = new URL(request.url());
  if (url.origin !== server.origin) external.push(url.origin);
  if (request.method() === "POST" && /^\/api\/agent\/runs\/[a-f0-9-]{36}$/.test(url.pathname)) {
    const body = request.postDataJSON();
    if (body.operation === "repair-decision") { decision = body; decisionUrl = url.href; csrf = await request.headerValue("x-csrf-token"); }
  }
});
const calls = async () => { try { return (await readFile(server.modelLog, "utf8")).trim().split("\n").filter(Boolean).length; } catch { return 0; } };
const fixture = resolve("tests/fixtures/postgres-migration"), originals = await Promise.all(["001_entries.sql", "oracle.test.cjs"].map(path => readFile(join(fixture, path))));
try {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto(server.origin);
  await page.getByLabel("کلید ورود محلی", { exact: true }).fill(server.token);
  await page.getByRole("button", { name: "ورود به میز کار", exact: true }).click();
  await page.getByRole("button", { name: "انتخاب پوشه پروژه", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "انتخاب پوشه پروژه", exact: true });
  const chooser = page.waitForEvent("filechooser"); await picker.getByRole("button", { name: "انتخاب پوشه از رایانه", exact: true }).click();
  await (await chooser).setFiles(fixture);
  await picker.getByRole("button", { name: "بررسی این پروژه", exact: true }).click(); await picker.waitFor({ state: "detached" });
  await page.waitForURL(url => !!url.searchParams.get("project"));
  const projectId = new URL(page.url()).searchParams.get("project"); assert.ok(projectId);
  const actor = createHash("sha256").update(server.token).digest("hex").slice(0, 24);
  store = new Store(join(server.stateDir, "state.sqlite")); const repo = new AgentRepository(store), flow = store.getProjectFlow(actor, projectId);
  assert.ok(flow?.profile.fullstack); assert.equal(await calls(), 0); assert.equal(store.db.prepare("SELECT count(*) n FROM code_repair_jobs").get().n, 0);
  const journey = page.locator(".publication-journey");
  await journey.getByText("صفحه و نشانه مورد انتظار", { exact: true }).click(); await page.locator("#mission-expectation").fill("Migration lifecycle");
  await journey.getByRole("button", { name: "بررسی و آماده‌سازی انتشار", exact: true }).click();
  const review = page.locator('[aria-labelledby="migration-test-title"]'); await review.waitFor();
  const proposed = repo.forProject(actor, projectId, "publication"); assert.ok(proposed?.repair);
  assert.equal(proposed.state, "needs_approval"); assert.equal(proposed.repair.state, "proposed"); assert.deepEqual(proposed.repair.containerIds, []);
  assert.equal(proposed.repair.afterTest, null); assert.equal(proposed.repair.postgresFixtureId, undefined); assert.equal(await calls(), 1);
  assert.equal(await page.locator(".optional-chat:visible").count(), 0);
  const approve = journey.getByRole("button", { name: proposed.repair.validationOnly ? "تأیید ساخت و بررسی برنامه" : "تأیید اصلاح و اجرای آزمون", exact: true }); await approve.focus(); await approve.press("Enter");
  await review.getByText("همان داده پس از اجرای دوبارهٔ برنامه حفظ شد.", { exact: true }).waitFor({ timeout: 300000 });
  await page.waitForFunction(() => !document.querySelector('.publication-journey [aria-busy="true"]'), null, { timeout: 30000 });
  const deadline = Date.now() + 30000; let result = repo.get(actor, proposed.id);
  while (result?.state === "working" && Date.now() < deadline) { await page.waitForTimeout(100); result = repo.get(actor, proposed.id); }
  assert.ok(result?.repair?.afterTest?.databaseMigration); assert.equal(result.state, "partially_completed"); assert.equal(result.repair.state, "succeeded");
  const proof = result.repair.afterTest.databaseMigration;
  assert.equal(result.repair.baseRevision, flow.profile.sourceHash); assert.equal(proof.sourceHash, result.repair.postgresFixtureSourceHash); assert.equal(proof.files[0].sha256, createHash("sha256").update(originals[0]).digest("hex"));
  assert.equal(proof.applicationRuns, 2); assert.equal(proof.columnChecks, 3); assert.equal(proof.rowChecks, 1); assert.equal(proof.persistenceChecks, 1);
  assert.equal(proof.production, false); assert.equal(proof.databaseRestartVerified, false); assert.equal(result.repair.artifact, null); assert.equal(result.publication, null); assert.equal(result.effect, "no_remote_changes");
  assert.equal(result.repair.containerIds.length, 3); assert.equal(new Set(result.repair.containerIds).size, 3); assert.equal(result.repair.postgresExecutionStarted, undefined);
  assert.equal(store.db.prepare("SELECT count(*) n FROM actions").get().n, 0); assert.equal(await calls(), 2);
  assert.ok(decision && decisionUrl && csrf); assert.equal(decision.decision, "approve");
  const replay = await context.request.post(decisionUrl, { headers: { origin: server.origin, "x-csrf-token": csrf }, data: decision });
  assert.equal(replay.status(), 409); assert.equal((await replay.json()).error.code, "AGENT_CONFLICT");
  const before = { calls: await calls(), containers: result.repair.containerIds, usage: result.usage, limits: result.limits };
  await page.reload(); await page.locator('[aria-labelledby="migration-test-title"]').getByText("همان داده پس از اجرای دوبارهٔ برنامه حفظ شد.", { exact: true }).waitFor();
  result = repo.get(actor, proposed.id); assert.equal(await calls(), before.calls); assert.deepEqual(result.repair.containerIds, before.containers); assert.deepEqual(result.usage, before.usage); assert.deepEqual(result.limits, before.limits);
  for (const [i, path] of ["001_entries.sql", "oracle.test.cjs"].entries()) assert.ok((await readFile(join(fixture, path))).equals(originals[i]));
  assert.deepEqual(errors, []); assert.deepEqual(external, []); await page.screenshot({ path: join(output, "migration-worker-390.png"), fullPage: true });
  const summary = { projectId, runId: proposed.id, sourceHash: flow.profile.sourceHash, model: "synthetic", modelRequests: await calls(), apiDecisions: 1, replayStatus: replay.status(), containerCount: result.repair.containerIds.length, migration: proof, cloudWrites: 0, reloadReplayed: false, errors, external };
  await writeFile(join(output, "results.json"), JSON.stringify(summary, null, 2)); console.log(JSON.stringify({ ...summary, output }));
} catch (error) {
  const actor = createHash("sha256").update(server.token).digest("hex").slice(0, 24), flow = store?.getProjectFlow(actor), run = flow ? new AgentRepository(store).forProject(actor, flow.id, "publication") : null;
  await writeFile(join(output, "failure.json"), JSON.stringify({ error: String(error), state: run?.state, code: run?.errorCode, jobState: run?.repair?.state, jobError: run?.repair?.errorCode, events: run?.events, afterTest: run?.repair?.afterTest }, null, 2));
  await page.screenshot({ path: join(output, "failure.png"), fullPage: true }); throw error;
} finally { store?.close(); await context.close(); await browser.close(); await server.close(); }
