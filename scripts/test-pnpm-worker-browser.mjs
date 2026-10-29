import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { startTestServer } from "./test-server.mjs";
import { Store } from "../src/server/persistence/store.ts";
import { AgentRepository } from "../src/server/agent/store.ts";
import { pnpmFixtureFiles, writePnpmFixture } from "../tests/helpers/pnpm-fixture.ts";
import { pnpmTarballs } from "../src/server/agent/pnpm-source.ts";
import { writeNpmCacheTarball } from "../src/server/agent/npm-cache.ts";

// Actual directory upload, mission, HTTP decision, Docker worker, reload and replay.
// Model transport alone is synthetic; no decision, job or receipt interception.
const server = await startTestServer({ agentFixture: true }), browser = await chromium.launch({ headless: true }),
  context = await browser.newContext({ locale: "fa-IR", reducedMotion: "reduce" }), page = await context.newPage();
const output = resolve(".artifacts/pnpm-worker", new Date().toISOString().replaceAll(":", "-")); await mkdir(output, { recursive: true });
const fixture = resolve(server.stateDir, "..", "pnpm-fixture"), { files } = await pnpmFixtureFiles();
const source = files.map(file => {
  if (file.path === "package.json") { const pkg = JSON.parse(file.content); delete pkg.devDependencies; return { ...file, content: Buffer.from(JSON.stringify(pkg)) }; }
  if (file.path === "pnpm-lock.yaml") return { ...file, content: Buffer.from("lockfileVersion: '9.0'\nsettings:\n  autoInstallPeers: true\n  excludeLinksFromLockfile: false\nimporters:\n  .: {}\n  apps/api:\n    dependencies:\n      '@fixture/shared':\n        specifier: workspace:*\n        version: link:../../packages/shared\n  packages/shared: {}\npackages: {}\nsnapshots: {}\n") };
  if (file.path === "packages/shared/build.cjs") return { ...file, content: Buffer.from("const fs=require('node:fs');fs.mkdirSync('dist',{recursive:true});fs.writeFileSync('dist/value.cjs','module.exports=73;');\n") };
  return file;
}); writePnpmFixture(fixture, source);
const errors = [], external = [], layouts = []; let store, decision, decisionUrl, csrf;
page.on("pageerror", error => errors.push(error.message));
page.on("request", async request => { const url = new URL(request.url()); if (url.origin !== server.origin) external.push(url.origin);
  if (request.method() === "POST" && /^\/api\/agent\/runs\/[a-f0-9-]{36}$/.test(url.pathname)) { const body = request.postDataJSON(); if (body.operation === "repair-decision") { decision = body; decisionUrl = url.href; csrf = await request.headerValue("x-csrf-token"); } } });
const calls = async () => { try { return (await readFile(server.modelLog, "utf8")).trim().split("\n").filter(Boolean).length; } catch { return 0; } };
try {
  if (process.env.LAUNCHLANE_TEST_PNPM_TARBALL) {
    const tool = pnpmTarballs(source).find(item => item.url.includes("/pnpm/-/")); assert.ok(tool);
    await writeNpmCacheTarball(join(server.stateDir, "npm-cache"), tool, await readFile(process.env.LAUNCHLANE_TEST_PNPM_TARBALL), AbortSignal.timeout(10000));
  }
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto(server.origin); await page.getByLabel("کلید ورود محلی", { exact: true }).fill(server.token); await page.getByRole("button", { name: "ورود به میز کار", exact: true }).click();
  await page.getByRole("button", { name: "انتخاب پوشه پروژه", exact: true }).click(); const picker = page.getByRole("dialog", { name: "انتخاب پوشه پروژه", exact: true });
  const chooser = page.waitForEvent("filechooser"); await picker.getByRole("button", { name: "انتخاب پوشه از رایانه", exact: true }).click(); await (await chooser).setFiles(fixture);
  await picker.getByRole("button", { name: "بررسی این پروژه", exact: true }).click(); await picker.waitFor({ state: "detached" }); await page.waitForURL(url => !!url.searchParams.get("project"));
  const projectId = new URL(page.url()).searchParams.get("project"), actor = createHash("sha256").update(server.token).digest("hex").slice(0, 24); store = new Store(join(server.stateDir, "state.sqlite"));
  const repo = new AgentRepository(store), flow = store.getProjectFlow(actor, projectId); assert.ok(flow.profile.pnpmWorkspace); assert.equal(flow.artifact, null); assert.equal(await calls(), 0);
  const journey = page.locator(".publication-journey"); await journey.getByText("صفحه و نشانه مورد انتظار", { exact: true }).click(); await page.locator("#mission-expectation").fill("Workspace lifecycle");
  await journey.getByRole("button", { name: "بررسی و آماده‌سازی انتشار", exact: true }).click(); const review = page.locator('[aria-labelledby="pnpm-build-title"]'); await review.waitFor();
  const proposed = repo.forProject(actor, projectId, "publication"); assert.equal(proposed.state, "needs_approval"); assert.equal(proposed.repair.build.version, 8); assert.equal(proposed.repair.build.phase, "compile"); assert.deepEqual(proposed.repair.containerIds, []);
  console.log(JSON.stringify({ stage: "review", runId: proposed.id, sourceHash: proposed.context.sourceHash }));
  assert.equal(await calls(), 1); await journey.getByRole("button", { name: "تأیید ساخت و بررسی برنامه", exact: true }).press("Enter");
  const deadline = Date.now() + 240000; let terminalState;
  while (Date.now() < deadline) {
    const response = await context.request.get(`${server.origin}/api/agent/runs/${proposed.id}`); assert.equal(response.status(), 200);
    terminalState = (await response.json()).run?.state;
    if (["partially_completed", "failed", "cancelled"].includes(terminalState)) break;
    await page.waitForTimeout(250);
  }
  assert.equal(terminalState, "partially_completed", "actual authenticated mission must finish before its receipt is inspected");
  await journey.getByRole("button", { name: "ادامه همان مأموریت", exact: true }).waitFor({ timeout: 30000 });
  const result = repo.get(actor, proposed.id); assert.equal(result.state, "partially_completed"); assert.equal(result.repair.state, "succeeded"); assert.equal(result.repair.artifact, null); assert.equal(result.publication, null);
  console.log(JSON.stringify({ stage: "receipt", state: result.state, workerState: result.repair.state, passed: result.repair.afterTest?.passed }));
  await journey.getByText("توضیح کامل بررسی", { exact: true }).click();
  await journey.getByRole("paragraph").filter({ hasText: "ساخت بسته‌ها با lock اصلی بررسی شد؛ تست، شروع سرویس، داده و انتشار هنوز تأیید نشده‌اند." }).waitFor();
  await journey.getByText("مراحل بررسی", { exact: true }).click();
  await journey.getByText("ساخت بسته‌های workspace گذشت؛ تست، اجرای سرویس، اتصال داده و انتشار هنوز بررسی نشده‌اند.", { exact: false }).waitFor();
  assert.equal(result.repair.containerIds.length, 1); assert.equal(result.repair.afterTest.passed, true); assert.match(result.repair.afterTest.output, /frozen root lock and all workspace importers preserved/);
  assert.equal(result.effect, "no_remote_changes"); assert.equal(store.db.prepare("SELECT count(*) AS n FROM actions").get().n, 0); assert.equal(await calls(), 2);
  assert.ok(decision && decisionUrl && csrf); const replay = await context.request.post(decisionUrl, { headers: { origin: server.origin, "x-csrf-token": csrf }, data: decision }); assert.equal(replay.status(), 409);
  const before = { usage: result.usage, limits: result.limits, containers: result.repair.containerIds, calls: await calls() }; await page.reload(); await review.waitFor();
  const after = repo.get(actor, proposed.id); assert.deepEqual(after.usage, before.usage); assert.deepEqual(after.limits, before.limits); assert.deepEqual(after.repair.containerIds, before.containers); assert.equal(await calls(), before.calls);
  for (const width of [280, 320, 390, 768, 1280]) { await page.setViewportSize({ width, height: 844 }); await page.evaluate(() => document.fonts.ready); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze(); assert.deepEqual(axe.violations.map(row => row.id), []); layouts.push({ width, overflow: false, axeViolations: 0 }); }
  for (const file of source) assert.ok((await readFile(join(fixture, file.path))).equals(file.content)); assert.deepEqual(errors, []); assert.deepEqual(external, []);
  await page.screenshot({ path: join(output, "pnpm-worker-1280.png"), fullPage: true }); const summary = { output, projectId, runId: proposed.id, sourceHash: flow.profile.sourceHash, modelRequests: await calls(), model: "synthetic", actualWorkers: 1, artifact: null, cloudWrites: 0, replayStatus: replay.status(), reloadReplayed: false, layouts, errors, external };
  await writeFile(join(output, "results.json"), JSON.stringify(summary, null, 2)); console.log(JSON.stringify(summary));
} catch (error) { const actor = createHash("sha256").update(server.token).digest("hex").slice(0, 24), flow = store?.getProjectFlow(actor), run = flow ? new AgentRepository(store).forProject(actor, flow.id, "publication") : null;
  await writeFile(join(output, "failure.json"), JSON.stringify({ error: String(error), state: run?.state, code: run?.errorCode, job: run?.repair, events: run?.events }, null, 2)); await page.screenshot({ path: join(output, "failure.png"), fullPage: true }); throw error;
} finally { store?.close(); await context.close(); await browser.close(); await server.close(); }
