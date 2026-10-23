import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { startTestServer } from "./test-server.mjs";
import { Store } from "../src/server/persistence/store.ts";
import { sealCredential } from "../src/server/connections/credentials.ts";
const server = await startTestServer({ staticFixture: true, workspaceConfigured: false }), browser = await chromium.launch({ headless: true }),
  context = await browser.newContext({ locale: "fa-IR", reducedMotion: "reduce" }), page = await context.newPage(), errors = [], states = [],
  output = resolve(".artifacts/static-publication", new Date().toISOString().replaceAll(":", "-")), directory = await mkdtemp(join(tmpdir(), "launchlane-static-browser-")), actor = createHash("sha256").update(server.token).digest("hex").slice(0, 24);
page.on("pageerror", error => errors.push(error.message));
await context.route("**/*", route => new URL(route.request().url()).origin === server.origin ? route.continue() : route.abort());
try {
  await mkdir(server.stateDir, { recursive: true });
  const store = new Store(join(server.stateDir, "state.sqlite")); store.saveConnection(actor, { source: "token", ciphertext: sealCredential("synthetic-static-liara-credential", server.sessionSecret, actor, "liara"), view: {
    provider: "liara", status: "connected", identityId: "b".repeat(24), displayName: "Static", login: "static@example.test", checkedAt: Date.now(), teamId: server.teamId, teamName: "آزمون",
    apps: [{ id: "c".repeat(24), name: server.app, platform: "static" }], selectedApp: server.app } });
  store.setProbeOrigin(actor, { teamId: server.teamId, app: server.app }, `https://${server.app}.liara.run`); store.close(); await mkdir(output, { recursive: true });
  await writeFile(join(directory, "index.html"), '<!DOCTYPE html><html><head><title>Login & Registration</title><link rel="stylesheet" href="style.css"></head><body><button>Login</button><script src="script.js"></script></body></html>');
  await writeFile(join(directory, "style.css"), "body{color:navy}"); await writeFile(join(directory, "script.js"), "document.body.dataset.ready='yes';");
  await page.goto(server.origin); await page.getByLabel("کلید ورود محلی", { exact: true }).fill(server.token); await page.getByRole("button", { name: "ورود به میز کار", exact: true }).click();
  await page.getByRole("button", { name: "انتخاب پوشه پروژه", exact: true }).click();
  const folder = page.getByRole("dialog", { name: "انتخاب پوشه پروژه", exact: true }), chooser = page.waitForEvent("filechooser");
  await folder.getByRole("button", { name: "انتخاب پوشه از رایانه", exact: true }).click(); await (await chooser).setFiles(directory);
  await folder.getByRole("button", { name: "بررسی این پروژه", exact: true }).click(); await folder.waitFor({ state: "detached" });
  const button = page.getByRole("button", { name: "بررسی و آماده‌سازی انتشار", exact: true }); await button.click();
  await page.getByRole("button", { name: "تأیید و انتشار این نسخه", exact: true }).waitFor({ timeout: 30000 });
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 }); await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => { window.scrollTo(0, 0); document.querySelector(".task-main")?.scrollTo(0, 0); });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: join(output, `publication-${width}.png`), fullPage: true });
    await writeFile(join(output, `controls-${width}.json`), JSON.stringify(await page.getByRole("button", { name: "تغییر پروژه", exact: true }).evaluateAll(nodes => nodes.map(node => ({ rect: node.getBoundingClientRect().toJSON(), style: getComputedStyle(node).cssText }))), null, 2));
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze(); assert.deepEqual(axe.violations.map(v => ({ id: v.id, targets: v.nodes.map(node => ({ target: node.target, html: node.html })) })), []);
    await page.screenshot({ path: join(output, `publication-${width}.png`), fullPage: true }); states.push({ width, axeViolations: 0 });
  }
  await page.reload(); await page.getByRole("button", { name: "تأیید و انتشار این نسخه", exact: true }).waitFor();
  const state = new Store(join(server.stateDir, "state.sqlite"));
  try { const runs = state.db.prepare("SELECT data_json FROM agent_runs").all().map(row => JSON.parse(row.data_json));
    assert.equal(runs.length, 1); assert.equal(runs[0].usage.modelCalls, 1); assert.equal(runs[0].question, null); assert.equal(runs[0].publication.spec.version, 15);
    assert.equal(state.db.prepare("SELECT count(*) n FROM code_repair_jobs").get().n, 0); assert.equal(runs[0].publication.attemptId, null);
  } finally { state.close(); }
  assert.deepEqual(errors, []); await writeFile(join(output, "result.json"), JSON.stringify({ states, pageErrors: errors, provider: "synthetic", liveDeployment: false }, null, 2));
  console.log(JSON.stringify({ output, states: states.length, pageErrors: errors.length, syntheticModelCalls: 1, publicationVersion: 15 }));
} finally { await context.close(); await browser.close(); await server.close(); assert.ok(resolve(directory).startsWith(join(tmpdir(), "launchlane-static-browser-"))); await rm(directory, { recursive: true, force: true }); }
