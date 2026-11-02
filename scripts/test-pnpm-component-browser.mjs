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
import { registryTarball } from "../src/server/agent/npm-source.ts";
import { writeNpmCacheTarball } from "../src/server/agent/npm-cache.ts";
import { readArtifact } from "../src/server/workspace/archive.ts";
import { componentTarget } from "../tests/helpers/component-target.ts";
import { sealCredential } from "../src/server/connections/credentials.ts";

// Actual upload/Agent/HTTP decisions/worker/archive/Docker destination/workload/reload.
// Model, Liara and DNS/TLS routing are synthetic; no real model or cloud write.
const server = await startTestServer({ componentFixture: true }), browser = await chromium.launch({ headless: true }), context = await browser.newContext({ locale: "fa-IR", reducedMotion: "reduce" }), page = await context.newPage();
const output = resolve(".artifacts/pnpm-component", new Date().toISOString().replaceAll(":", "-")); await mkdir(output, { recursive: true });
let store, target, runId; const errors = [], layouts = [], external = [], decisions = [];
page.on("pageerror", error => errors.push(error.message));
await context.route("**/*", route => { if (new URL(route.request().url()).origin !== server.origin) { external.push(new URL(route.request().url()).origin); return route.abort(); } return route.continue(); });
page.on("request", request => { if (request.method() === "POST" && new URL(request.url()).pathname.startsWith("/api/agent/runs/")) { const body = request.postDataJSON(); if (["repair-decision", "publication-decision"].includes(body?.operation)) decisions.push({ url: request.url(), body, csrf: request.headers()["x-csrf-token"] }); } });
try {
  const fixture = resolve(server.stateDir, "..", "component-fixture"), source = (await pnpmFixtureFiles()).files.map(file => {
    if (file.path === "package.json") { const pkg = JSON.parse(file.content); delete pkg.devDependencies; return { ...file, content: Buffer.from(JSON.stringify(pkg)) }; }
    if (file.path === "apps/api/package.json") { const pkg = JSON.parse(file.content); pkg.scripts.start = "node dist/server.cjs"; return { ...file, content: Buffer.from(JSON.stringify(pkg)) }; }
    if (file.path === "pnpm-lock.yaml") return { ...file, content: Buffer.from("lockfileVersion: '9.0'\nsettings:\n  autoInstallPeers: true\n  excludeLinksFromLockfile: false\nimporters:\n  .: {}\n  apps/api:\n    dependencies:\n      '@fixture/shared':\n        specifier: workspace:*\n        version: link:../../packages/shared\n  packages/shared: {}\npackages: {}\nsnapshots: {}\n") };
    if (file.path === "packages/shared/build.cjs") return { ...file, content: Buffer.from(file.content.toString().replace("require('launchlane-fixture-value')", "73")) };
    if (file.path === "apps/api/build.cjs") return { ...file, content: Buffer.concat([file.content, Buffer.from("require('node:fs').copyFileSync('server.cjs','dist/server.cjs');\n")]) };
    if (file.path === "apps/api/server.cjs") return { ...file, content: Buffer.from(file.content.toString().replace("{total:require('./dist/value.cjs')}", "{label:'Component lifecycle',total:require('./value.cjs')}")) };
    return file;
  });
  writePnpmFixture(fixture, source);
  const tool = pnpmTarballs(source).find(item => item.url.includes("/pnpm/-/")); assert.ok(tool);
  const toolBytes = process.env.LAUNCHLANE_TEST_PNPM_TARBALL ? await readFile(process.env.LAUNCHLANE_TEST_PNPM_TARBALL) : await registryTarball(tool, AbortSignal.timeout(90000));
  await writeNpmCacheTarball(join(server.stateDir, "npm-cache"), tool, toolBytes, AbortSignal.timeout(10000));
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto(server.origin); await page.getByLabel("کلید ورود محلی", { exact: true }).fill(server.token); await page.getByRole("button", { name: "ورود به میز کار", exact: true }).click();
  const actor = createHash("sha256").update(server.token).digest("hex").slice(0, 24); store = new Store(join(server.stateDir, "state.sqlite"));
  store.saveConnection(actor, { source: "token", ciphertext: sealCredential("synthetic-component-provider", server.sessionSecret, actor, "liara"), view: { provider: "liara", status: "connected", identityId: "b".repeat(24), displayName: "آزمون مستقل", login: "fixture@example.test", teamId: server.teamId, teamName: "آزمون", selectedApp: server.app, apps: [{ id: "c".repeat(24), name: server.app, platform: "docker" }], checkedAt: Date.now() } });
  store.setProbeOrigin(actor, { teamId: server.teamId, app: server.app }, "https://sample-node.liara.run");
  await page.reload(); await page.getByRole("button", { name: "انتخاب پوشه پروژه", exact: true }).click(); const picker = page.getByRole("dialog", { name: "انتخاب پوشه پروژه", exact: true });
  const chooser = page.waitForEvent("filechooser"); await picker.getByRole("button", { name: "انتخاب پوشه از رایانه", exact: true }).click(); await (await chooser).setFiles(fixture); await picker.getByRole("button", { name: "بررسی این پروژه", exact: true }).click(); await picker.waitFor({ state: "detached" }); await page.waitForURL(url => !!url.searchParams.get("project"));
  const projectId = new URL(page.url()).searchParams.get("project"), repo = new AgentRepository(store), journey = page.locator(".publication-journey");
  await journey.getByText("صفحه و نشانه مورد انتظار", { exact: true }).click(); await page.locator("#mission-expectation").fill("Component lifecycle"); await journey.getByRole("button", { name: "بررسی و آماده‌سازی انتشار", exact: true }).click();
  const review = page.locator('[aria-labelledby="pnpm-build-title"]'); await review.waitFor(); const proposed = repo.forProject(actor, projectId, "publication"); assert.equal(proposed.repair.build.version, 9); runId = proposed.id; console.log(JSON.stringify({ stage: "component-review", runId }));
  assert.match(await review.textContent(), /تست‌های دیگر ریشه/); await page.screenshot({ path: join(output, "component-review-390.png"), fullPage: true });
  await journey.getByRole("button", { name: "تأیید ساخت و بررسی برنامه", exact: true }).press("Enter");
  const publication = page.locator('[aria-labelledby="publication-title"]'); await publication.getByRole("heading", { name: "انتشار بخش انتخاب‌شده", exact: true }).waitFor({ timeout: 240000 });
  const pending = repo.get(actor, runId); assert.equal(pending.repair.state, "succeeded"); assert.equal(pending.publication.spec.version, 40); assert.equal(pending.publication.state, "awaiting_approval");
  console.log(JSON.stringify({ stage: "publication-review", state: pending.repair.state }));
  const artifact = pending.repair.artifact; target = await componentTarget(await readArtifact(server.stateDir, store.getArtifact(actor, artifact.archiveHash)));
  await writeFile(join(server.stateDir, "component-target.json"), JSON.stringify({ origin: target.origin, archiveHash: artifact.archiveHash }));
  for (const width of [280, 320, 390, 768, 1280]) { await page.setViewportSize({ width, height: 844 }); await page.evaluate(() => document.fonts.ready); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze(); assert.deepEqual(axe.violations.map(row => row.id), []); layouts.push({ phase: "review", width, overflow: false, axeViolations: 0 }); }
  await publication.getByRole("button", { name: "تأیید و انتشار این نسخه", exact: true }).press("Enter");
  await publication.getByRole("heading", { name: "بخش انتخاب‌شده منتشر شد", exact: true }).waitFor({ timeout: 60000 });
  const finished = repo.get(actor, runId); assert.equal(finished.state, "partially_completed"); assert.equal(finished.publication.state, "succeeded"); assert.equal(finished.effect, "remote_changes_verified");
  assert.equal(finished.publication.spec.artifactHash, artifact.archiveHash); assert.equal(finished.repair.afterTest.buildOutput.artifactHash, finished.publication.spec.verification.outputArtifactHash);
  const originalDecisions = [...decisions]; assert.equal(originalDecisions.length, 2);
  for (const decision of originalDecisions) assert.equal((await context.request.post(decision.url, { headers: { origin: server.origin, "x-csrf-token": decision.csrf }, data: decision.body })).status(), 409);
  const before = { usage: finished.usage, limits: finished.limits, log: await readFile(server.modelLog, "utf8") }; await page.reload(); await publication.getByRole("heading", { name: "بخش انتخاب‌شده منتشر شد", exact: true }).waitFor();
  const restored = repo.get(actor, runId); assert.deepEqual(restored.usage, before.usage); assert.deepEqual(restored.limits, before.limits); assert.equal(await readFile(server.modelLog, "utf8"), before.log);
  for (const width of [280, 320, 390, 768, 1280]) { await page.setViewportSize({ width, height: 844 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze(); assert.deepEqual(axe.violations.map(row => row.id), []); layouts.push({ phase: "succeeded", width, overflow: false, axeViolations: 0 }); }
  await page.screenshot({ path: join(output, "component-published-1280.png"), fullPage: true }); for (const file of source) assert.ok((await readFile(join(fixture, file.path))).equals(file.content));
  const records = before.log.trim().split("\n").map(line => JSON.parse(line)); assert.equal(records.filter(row => row.model).length, 2); assert.equal(records.filter(row => row.provider === "POST").length, 2); assert.deepEqual(records.filter(row => row.probe).map(row => row.probe), ["/", "/launchlane-build-proof.json", "/api/value"]);
  assert.deepEqual(errors, []); assert.deepEqual(external, []); const summary = { output, runId, artifactHash: artifact.archiveHash, testedSourceHash: finished.repair.baseRevision, planHash: finished.publication.spec.verification.planHash, outputArtifactHash: finished.publication.spec.verification.outputArtifactHash, model: "synthetic", provider: "synthetic", actualWorker: true, actualArchiveDockerDestination: true, actualWorkload: true, cloudWrites: 0, decisions: originalDecisions.length, rejectedReplays: originalDecisions.length, layouts, errors };
  await writeFile(join(output, "results.json"), JSON.stringify(summary, null, 2)); console.log(JSON.stringify(summary));
} catch (error) { await writeFile(join(output, "overflow.json"), JSON.stringify(await page.evaluate(() => ({ viewport: innerWidth, scroll: document.documentElement.scrollWidth, elements: [...document.querySelectorAll("body *")].filter(el => { const r = el.getBoundingClientRect(); return r.width && (r.left < -1 || r.right > innerWidth + 1); }).map(el => ({ tag: el.tagName, class: el.className, text: el.textContent?.slice(0, 80), left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right, width: el.getBoundingClientRect().width })) })), null, 2)); await writeFile(join(output, "failure.json"), JSON.stringify({ error: String(error), run: runId && store ? new AgentRepository(store).get(createHash("sha256").update(server.token).digest("hex").slice(0, 24), runId) : null }, null, 2)); await page.screenshot({ path: join(output, "failure.png"), fullPage: true }); throw error; }
finally { await target?.close(); store?.close(); await context.close(); await browser.close(); await server.close(); }
