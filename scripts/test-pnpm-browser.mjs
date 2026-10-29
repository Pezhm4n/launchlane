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
import { pnpmFixtureFiles } from "../tests/helpers/pnpm-fixture.ts";
import { inspectPnpmWorkspace } from "../src/server/workspace/pnpm.ts";
import { nodeBuildRuntime } from "../src/contracts/project-build.ts";

const baseline = process.env.LAUNCHLANE_PNPM_UI_BASELINE === "true", server = await startTestServer({ agentFixture: true });
const browser = await chromium.launch({ headless: true }), context = await browser.newContext({ locale: "fa-IR", reducedMotion: "reduce" }), page = await context.newPage();
const output = resolve(".artifacts/pnpm-review", `${baseline ? "before" : "after"}-${new Date().toISOString().replaceAll(":", "-")}`);
await mkdir(output, { recursive: true }); const errors = [], layouts = [], decisions = []; let store, runId, job, mode = "proposed";
page.on("pageerror", error => errors.push(error.message));
function view(run) {
  const succeeded = mode === "succeeded", failed = mode === "failed";
  return { ...run, state: mode === "proposed" ? "needs_approval" : "partially_completed", nextAction: null, repair: { ...job, state: mode,
    message: succeeded ? "ساخت بسته‌های workspace گذشت؛ تست و داده و انتشار تأیید نشده‌اند." : failed ? "ساخت بسته‌ها شکست خورد؛ lock اصلی حفظ شد." : "در انتظار تصمیم",
    afterTest: succeeded || failed ? { command: "pnpm install --frozen-lockfile; pnpm -r build", exitCode: failed ? 72 : 0, signal: null, durationMs: 1000,
      output: failed ? "original build failed" : "workspace compile only; tests, start, data and publication unverified", passed: succeeded } : null } };
}
await context.route("**/*", async route => {
  const request = route.request(), url = new URL(request.url()); if (url.origin !== server.origin) return route.abort();
  if (!runId || !url.pathname.startsWith("/api/agent/")) return route.continue();
  if (request.method() === "POST" && url.pathname === `/api/agent/runs/${runId}`) {
    const body = request.postDataJSON(); assert.equal(body.operation, "repair-decision"); assert.equal(body.jobId, job.id); decisions.push(body.decision);
    mode = body.decision === "reject" ? "cancelled" : "queued";
    const response = await context.request.get(`${server.origin}/api/agent/runs/${runId}`), payload = await response.json();
    return route.fulfill({ status: 200, json: { ...payload, run: view(payload.run) } });
  }
  const response = await route.fetch(); if (response.headers()["content-type"]?.includes("application/json")) { const payload = await response.json(); if (payload.run?.id === runId) return route.fulfill({ response, json: { ...payload, run: view(payload.run) } }); }
  return route.fulfill({ response });
});
try {
  await page.goto(server.origin); await page.getByLabel("کلید ورود محلی", { exact: true }).fill(server.token); await page.getByRole("button", { name: "ورود به میز کار", exact: true }).click();
  await page.getByRole("button", { name: "امتحان با پروژه نمونه", exact: true }).click(); await page.locator("h1").filter({ hasText: "node-service" }).waitFor();
  store = new Store(join(server.stateDir, "state.sqlite")); const actor = createHash("sha256").update(server.token).digest("hex").slice(0, 24), config = readConfig({ LAUNCHLANE_STATE_DIR: server.stateDir, LAUNCHLANE_WORKSPACE_ROOT: server.workspace, LAUNCHLANE_OPERATOR_TOKEN: server.token, LAUNCHLANE_SESSION_SECRET: server.sessionSecret });
  const flow = store.getProjectFlow(actor), selected = currentAgentContext(config, store, actor), input = { projectId: flow.id, sourceHash: flow.profile.sourceHash, path: "/", expectedText: "invoice service" }, repo = new AgentRepository(store),
    run = repo.create(actor, randomUUID(), selected, "ساخت workspace با package manager اصلی", { maxModelCalls: 10, maxToolCalls: 40, runTimeoutMs: 120000 }, { ...input, kind: "publication", identity: fingerprint({ input, context: selected }) }).run;
  runId = run.id; run.state = "needs_approval"; run.nextAction = null; repo.save(actor, run);
  const { files } = await pnpmFixtureFiles(), workspace = inspectPnpmWorkspace(files), now = Date.now();
  job = { id: randomUUID(), parentRunId: runId, projectId: flow.id, baseRevision: flow.profile.sourceHash, state: "proposed", goal: "ساخت بسته‌های workspace با lock ریشه؛ بدون شروع سرویس یا تست داده",
    allowedPaths: [], testFiles: [], changedPaths: [], diff: null, beforeTest: null, afterTest: null, artifact: null, errorCode: null, message: "در انتظار تصمیم", createdAt: now, updatedAt: now,
    validationOnly: true, execution: "container", containerIds: [], build: { ...nodeBuildRuntime("24"), version: 8, workspace, phase: "compile", buildCommand: "pnpm -r build", testCommand: null, startCommand: "pnpm-workspace-compile", port: 3000, environment: null,
      workload: { path: "/", status: 200, assertion: { kind: "text", contains: "invoice service" } } } };
  await page.reload(); const review = page.locator(".agent-repair"); await review.waitFor(); await review.getByText("جزئیات اصلاح و رسید آزمون", { exact: true }).click();
  for (const width of baseline ? [360, 1280] : [280, 320, 360, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 }); await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze(); assert.deepEqual(axe.violations.map(row => row.id), []); layouts.push({ width, overflow: false, axeViolations: 0 });
    if ([360, 1280].includes(width)) await page.screenshot({ path: join(output, `${width}.png`), fullPage: true });
  }
  if (!baseline) {
    assert.match(await review.textContent() ?? "", /pnpm 11.19.0/); assert.doesNotMatch(await review.textContent() ?? "", /npm ci --offline|GET \/|pnpm-workspace-compile/);
    await page.getByRole("button", { name: "تأیید ساخت و بررسی برنامه", exact: true }).press("Enter"); assert.equal(decisions[0], "approve");
    mode = "proposed"; await page.reload(); await page.getByRole("button", { name: "رد آماده‌سازی", exact: true }).press("Enter"); assert.equal(decisions[1], "reject");
    for (const state of ["succeeded", "failed"]) { mode = state; await page.reload(); await page.locator(".agent-repair").waitFor(); assert.equal(await page.getByText("سایت شما منتشر شد", { exact: true }).count(), 0); }
    await page.setViewportSize({ width: 320, height: 900 }); await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
  assert.deepEqual(errors, []); assert.equal(store.db.prepare("SELECT count(*) AS n FROM code_repair_jobs").get().n, 0);
  await writeFile(join(output, "results.json"), JSON.stringify({ baseline, layouts, decisions, errors, modelCalls: 0, cloudWrites: 0, decisionTransport: "synthetic", worker: "not_executed" }, null, 2)); console.log(JSON.stringify({ output, layouts, decisions, errors }));
} finally { store?.close(); await context.close(); await browser.close(); await server.close(); }
