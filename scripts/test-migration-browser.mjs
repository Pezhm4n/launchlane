import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { startTestServer } from "./test-server.mjs";
import { Store } from "../src/server/persistence/store.ts";
import { AgentRepository } from "../src/server/agent/store.ts";
import { currentAgentContext } from "../src/server/agent/tools.ts";
import { readConfig } from "../src/server/config.ts";
import { fingerprint } from "../src/server/policy/action.ts";

const baseline = process.env.LAUNCHLANE_MIGRATION_UI_BASELINE === "true";
const server = await startTestServer({ agentFixture: true }), browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: "fa-IR", reducedMotion: "reduce" }), page = await context.newPage(), errors = [], decisions = [], layouts = [];
const output = resolve(".artifacts/migration-review", `${baseline ? "before" : "after"}-${new Date().toISOString().replaceAll(":", "-")}`);
await mkdir(output, { recursive: true }); page.on("pageerror", error => errors.push(error.message));
let store, runId, job, mode = "proposed";
await context.route("**/*", async route => {
  const request = route.request(), url = new URL(request.url()); if (url.origin !== server.origin) return route.abort();
  if (!runId || !url.pathname.startsWith("/api/agent/")) return route.continue();
  if (request.method() === "POST" && url.pathname === `/api/agent/runs/${runId}`) {
    const body = request.postDataJSON(); decisions.push(body); assert.equal(body.operation, "repair-decision"); assert.equal(body.jobId, job.id);
    mode = body.decision === "reject" ? "cancelled" : "queued";
    const response = await context.request.get(`${server.origin}/api/agent/runs/${runId}`), payload = await response.json();
    return route.fulfill({ status: 200, json: { ...payload, run: view(payload.run) } });
  }
  const response = await route.fetch();
  if (response.headers()["content-type"]?.includes("application/json")) { const payload = await response.json(); if (payload.run?.id === runId) return route.fulfill({ response, json: { ...payload, run: view(payload.run) } }); }
  return route.fulfill({ response });
});
function view(run) {
  const succeeded = mode === "succeeded", failed = mode === "failed";
  const receipt = { command: "isolated SQL and original API oracle", exitCode: failed ? 73 : 0, signal: null, durationMs: 1200,
    output: failed ? "MIGRATION_PERSISTENCE_FAILED" : "independent schema/data and unchanged application tests passed", passed: !failed,
    ...(succeeded ? { databaseMigration: { kind: "disposable_postgres_migration", sourceHash: job.baseRevision, planHash: "2".repeat(64), files: job.build.testDatabase.migration.files,
      columnChecks: 3, rowChecks: 1, persistenceChecks: 1, applicationRuns: 2, replay: "unchanged", databaseRestartVerified: false, production: false, checkedAt: Date.now() } } : {}) };
  return { ...run, state: mode === "proposed" ? "needs_approval" : "partially_completed", nextAction: null, repair: { ...job, state: mode, ...(succeeded ? { postgresFixtureSourceHash: job.baseRevision } : {}),
    afterTest: succeeded || failed ? receipt : null, message: succeeded ? "اثر migration در دادهٔ موقت بررسی شد." : failed ? "داده پس از اجرای دوباره حفظ نشد." : "در انتظار تصمیم برای اجرای ایزوله" } };
}
try {
  await page.goto(server.origin); await page.getByLabel("کلید ورود محلی", { exact: true }).fill(server.token);
  await page.getByRole("button", { name: "ورود به میز کار", exact: true }).click(); await page.getByRole("button", { name: "امتحان با پروژه نمونه", exact: true }).click();
  await page.locator("h1").filter({ hasText: "node-service" }).waitFor();
  store = new Store(join(server.stateDir, "state.sqlite")); const actor = createHash("sha256").update(server.token).digest("hex").slice(0, 24);
  const config = readConfig({ LAUNCHLANE_STATE_DIR: server.stateDir, LAUNCHLANE_WORKSPACE_ROOT: server.workspace, LAUNCHLANE_OPERATOR_TOKEN: server.token, LAUNCHLANE_SESSION_SECRET: server.sessionSecret });
  const flow = store.getProjectFlow(actor), selected = currentAgentContext(config, store, actor), input = { projectId: flow.id, sourceHash: flow.profile.sourceHash, path: "/", expectedText: "invoice service" },
    repo = new AgentRepository(store), run = repo.create(actor, randomUUID(), selected, "آماده‌سازی و سنجش migration پروژه", { maxModelCalls: 10, maxToolCalls: 40, runTimeoutMs: 120000 },
      { ...input, kind: "publication", identity: fingerprint({ input, context: selected }) }).run;
  runId = run.id; run.state = "needs_approval"; run.nextAction = null; repo.save(actor, run);
  const fullstack = { version: 2, entryFile: "server.cjs", backendScript: "server", startCommand: "node server.cjs", buildCommand: "npm run build", port: 3000, nodeVersion: "22",
    outputDirectory: "dist", packageRoots: ["."], outputPolicy: "compiled-v1", testScripts: ["test:db"] };
  const migration = { files: [{ path: "001_entries.sql", sha256: "a".repeat(64) }], columns: [
    { relation: "public.entries", name: "id", type: "integer", nullable: false }, { relation: "public.entries", name: "label", type: "text", nullable: false }, { relation: "public.entries", name: "note", type: "text", nullable: true }],
    rows: [{ relation: "public.entries", key: { column: "id", value: 7 }, values: [{ column: "label", value: "original datum" }] }],
    persistence: [{ relation: "public.entries", key: { column: "id", value: 7 }, column: "note" }] };
  const now = Date.now(); job = { id: randomUUID(), parentRunId: runId, projectId: flow.id, baseRevision: flow.profile.sourceHash, state: "proposed", goal: "سنجش SQL، داده و اجرای دوبارهٔ برنامه در دیتابیس موقت",
    allowedPaths: [], testFiles: [], changedPaths: [], diff: null, beforeTest: null, afterTest: null, artifact: null, errorCode: null, message: "در انتظار تصمیم", createdAt: now, updatedAt: now,
    validationOnly: true, execution: "container", containerIds: [], build: { version: 7, nodeVersion: "22", image: "node:22.23.3-bookworm-slim@sha256:3ed98443660ff48413b5af19ecefce3b9d50845a901a43420d47cc63a9fddbe9",
      fullstack, buildCommand: fullstack.buildCommand, testCommand: "npm run test:db", startCommand: fullstack.startCommand, port: 3000, environment: null,
      workload: { path: "/", status: 200, assertion: { kind: "text", contains: "Migration lifecycle" } }, apiChecks: [{ path: "/api/entry", status: 200, assertions: [{ pointer: ["id"], equals: 7 }] }],
      testDatabase: { version: baseline ? 1 : 2, kind: "postgresql", purpose: "compatibility_test", image: "postgres:16-bookworm@sha256:e92e17ca202da4bb205f6f4a6c8cb30539edfbaa04987b506630f5d5851ff3c8",
        environmentKeys: ["DATABASE_URL"], requiredRelations: ["public.entries"], ...(baseline ? {} : { migration }) } } };
  await page.reload(); const review = page.locator('[aria-labelledby="migration-test-title"]');
  await page.getByRole("button", { name: "تأیید ساخت و بررسی برنامه", exact: true }).waitFor();
  if (baseline) { for (const width of [360, 1280]) { await page.setViewportSize({ width, height: 900 }); await page.screenshot({ path: join(output, `migration-before-${width}.png`), fullPage: true }); } assert.equal(await review.count(), 0); }
  else {
    await review.waitFor();
    for (const width of [280, 320, 360, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 }); await page.evaluate(() => document.fonts.ready); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze(); assert.deepEqual(axe.violations.map(row => row.id), []); layouts.push({ width, overflow: false, axeViolations: 0 });
    }
    await page.setViewportSize({ width: 360, height: 900 }); const approve = page.getByRole("button", { name: "تأیید ساخت و بررسی برنامه", exact: true }); await approve.focus();
    assert.equal(await approve.evaluate(node => node === document.activeElement), true); await page.screenshot({ path: join(output, "migration-after-360.png"), fullPage: true });
    await approve.press("Enter"); assert.equal(decisions[0]?.decision, "approve");
    mode = "proposed"; await page.reload(); await page.getByRole("button", { name: "رد آماده‌سازی", exact: true }).press("Enter"); assert.equal(decisions[1]?.decision, "reject");
    mode = "succeeded"; await page.reload(); await review.getByText("همان داده پس از اجرای دوبارهٔ برنامه حفظ شد.", { exact: true }).waitFor();
    await page.setViewportSize({ width: 1280, height: 900 }); await page.screenshot({ path: join(output, "migration-after-1280.png"), fullPage: true });
    mode = "failed"; await page.reload(); assert.equal(await review.getByText("همان داده پس از اجرای دوبارهٔ برنامه حفظ شد.", { exact: true }).count(), 0);
    assert.equal(store.db.prepare("SELECT count(*) n FROM code_repair_jobs").get().n, 0); assert.deepEqual(errors, []);
  }
  await writeFile(join(output, "results.json"), JSON.stringify({ baseline, layouts, decisions, errors, modelCalls: 0, providerWrites: 0 }, null, 2)); console.log(JSON.stringify({ baseline, output, layouts, errors }));
} finally { store?.close(); await context.close(); await browser.close(); await server.close(); }
