import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { startTestServer } from "./test-server.mjs";
import { Store } from "../src/server/persistence/store.ts";
import { AgentRepository } from "../src/server/agent/store.ts";

const server = await startTestServer({ agentFixture: true }), browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: "fa-IR", reducedMotion: "reduce" }), page = await context.newPage();
const output = resolve(".artifacts/guided-publication", new Date().toISOString().replaceAll(":", "-"));
await mkdir(output, { recursive: true });
const errors = [], external = [], results = [], posts = [];
page.on("pageerror", error => errors.push(error.message));
page.on("request", request => { if (request.method() === "POST") posts.push(new URL(request.url()).pathname); });
await context.route("**/*", route => {
  if (new URL(route.request().url()).origin !== server.origin) { external.push(route.request().url()); return route.abort(); }
  return route.continue();
});
const journey = page.locator(".publication-journey"), chat = page.locator(".assistant-float .optional-chat"), launcher = page.getByRole("button", { name: "باز کردن راهنمای پروژه", exact: true });
let store;
async function modelRequests() {
  try { return (await readFile(server.modelLog, "utf8")).trim().split("\n").filter(Boolean).length; } catch { return 0; }
}
async function layout(width, name, height = 844) {
  await page.setViewportSize({ width, height });
  await page.evaluate(async () => document.fonts.ready);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name}: overflow`);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  assert.deepEqual(axe.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) })), [], name);
  results.push({ width, height, name, axeViolations: 0, overflow: false });
}
async function openChat() { await launcher.click(); await page.getByRole("dialog", { name: "راهنمای پروژه", exact: true }).waitFor(); }
async function closeChat() { await page.getByRole("button", { name: "بستن راهنمای پروژه", exact: true }).click(); await launcher.waitFor(); }
async function freshChat() { const fresh = chat.getByRole("button", { name: "گفت‌وگوی تازه", exact: true }); if (await fresh.count()) await fresh.click(); }
async function sendQuestion(text) { await chat.getByRole("textbox").fill(text); await chat.getByRole("button", { name: "ارسال درخواست", exact: true }).click(); }
try {
  await page.setViewportSize({ width: 360, height: 844 });
  await page.goto(server.origin);
  await page.getByLabel("کلید ورود محلی", { exact: true }).fill(server.token);
  await page.getByRole("button", { name: "ورود به میز کار", exact: true }).click();
  await page.getByRole("heading", { name: "پروژه‌تان را انتخاب کنید", exact: true }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("view"), "publish");
  assert.equal(await page.locator(".app-nav a").count(), 2);
  assert.equal(await page.getByRole("link", { name: "دستیار پروژه", exact: true }).count(), 0);
  assert.equal(await page.locator(".agent-composer:visible").count(), 0);
  assert.equal(await modelRequests(), 0);
  for (const width of [320, 360, 390, 768, 1280]) { await layout(width, "default-publication"); await page.screenshot({ path: join(output, `empty-${width}.png`), fullPage: true }); }
  await openChat();
  await chat.getByRole("textbox").fill("پیش‌نویس درباره پروژه");
  await page.getByRole("dialog", { name: "راهنمای پروژه", exact: true }).press("Escape");
  await launcher.waitFor();
  assert.equal(await launcher.evaluate(node => node === document.activeElement), true);
  const beforeNavigation = posts.length;
  await page.getByRole("link", { name: "بررسی مشکل سایت", exact: true }).click();
  await openChat(); assert.equal(await chat.getByRole("textbox").inputValue(), "پیش‌نویس درباره پروژه"); await closeChat();
  await page.goBack();
  assert.equal(posts.length, beforeNavigation);
  assert.equal(await modelRequests(), 0);
  await page.goto(`${server.origin}/?view=agent&project=invalid`);
  await page.getByRole("heading", { name: "پروژه‌تان را انتخاب کنید", exact: true }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("view"), "publish"); assert.equal(new URL(page.url()).searchParams.get("project"), null);
  assert.equal(await page.locator(".assistant-float[open]").count(), 0);
  const choose = page.getByRole("button", { name: "انتخاب پوشه پروژه", exact: true });
  await choose.click(); const picker = page.getByRole("dialog", { name: "انتخاب پوشه پروژه", exact: true });
  await picker.press("Escape"); await picker.waitFor({ state: "detached" }); assert.equal(await choose.evaluate(node => node === document.activeElement), true);
  await page.getByRole("button", { name: "امتحان با پروژه نمونه", exact: true }).click();
  await page.locator("h1").filter({ hasText: "node-service" }).waitFor();
  await journey.getByText("در حال بازیابی وضعیت…", { exact: true }).waitFor({ state: "hidden" });
  const selected = new URL(page.url()).searchParams.get("project"); assert.ok(selected);
  assert.equal(await page.locator(".project-choice:visible").count(), 0);
  assert.equal(await page.locator(".agent-composer:visible").count(), 0);
  await journey.getByRole("button", { name: "بررسی و آماده‌سازی انتشار", exact: true }).click();
  await journey.locator(".badge").filter({ hasText: "منتظر پاسخ شما" }).waitFor();
  const actor = createHash("sha256").update(server.token).digest("hex").slice(0, 24);
  store = new Store(join(server.stateDir, "state.sqlite")); const repo = new AgentRepository(store);
  const run = repo.forProject(actor, selected, "publication"); assert.ok(run?.mission); assert.equal(run.effect, "no_remote_changes");
  assert.equal(await journey.getByRole("button", { name: "بررسی و آماده‌سازی انتشار", exact: true }).count(), 0, "a missing account has exactly one current action");
  await journey.getByRole("button", { name: "اتصال حساب", exact: true }).waitFor();
  for (const width of [320, 360, 390, 768, 1280]) await layout(width, "needs-account-without-chat");
  const previousCalls = await modelRequests(); await page.reload(); await journey.locator(".badge").filter({ hasText: "منتظر پاسخ شما" }).waitFor(); assert.equal(await modelRequests(), previousCalls);
  await openChat();
  await sendQuestion("آزمون قالب‌بندی پاسخ"); await chat.locator(".md-heading").filter({ hasText: "نتیجه بررسی" }).waitFor();
  assert.equal(await chat.locator(".agent-answer .md-list li").count(), 2); assert.equal(await chat.locator(".agent-answer img").count(), 0);
  assert.equal(await chat.locator(".code-block pre").getAttribute("dir"), "ltr");
  assert.equal(repo.forProject(actor, selected, "publication").id, run.id);
  assert.equal(await journey.locator(".badge").filter({ hasText: "منتظر پاسخ شما" }).count() > 0, true);
  for (const width of [320, 360, 390, 768, 1280]) {
    await layout(width, "optional-chat-with-history", 680);
    await page.screenshot({ path: join(output, `chat-${width}.png`), fullPage: true });
  }
  await page.evaluate(() => document.documentElement.style.fontSize = "200%"); await layout(360, "chat-text-200", 680); await page.evaluate(() => document.documentElement.style.fontSize = "");
  await freshChat(); await sendQuestion("آزمون خطای ارتباط"); await chat.locator(".badge").filter({ hasText: "بررسی کامل نشد" }).waitFor();
  assert.equal(repo.forProject(actor, selected, "conversation").errorCode, "PROVIDER_RATE_LIMIT");
  assert.equal(repo.forProject(actor, selected, "publication").id, run.id);
  await freshChat(); await sendQuestion("آزمون توقف"); await chat.getByRole("button", { name: "توقف بررسی", exact: true }).click(); await chat.locator(".badge").filter({ hasText: "بررسی متوقف شد" }).waitFor();
  const cancelledCount = await modelRequests(); await closeChat(); await page.reload(); await openChat(); await chat.locator(".badge").filter({ hasText: "بررسی متوقف شد" }).waitFor(); assert.equal(await modelRequests(), cancelledCount);
  await layout(320, "cancelled-chat-preserves-mission", 480); await closeChat();
  await page.goto(`${server.origin}/?view=agent&project=${selected}`); await journey.locator(".badge").filter({ hasText: "منتظر پاسخ شما" }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("project"), selected); assert.equal(await modelRequests(), cancelledCount);
  assert.equal(store.db.prepare("SELECT COUNT(*) n FROM attempts").get().n, 0);
  assert.equal(store.db.prepare("SELECT COUNT(*) n FROM code_repair_jobs").get().n, 0);
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  await writeFile(join(output, "results.json"), JSON.stringify({ results, errors, external, model: "synthetic", cloudWrites: 0 }, null, 2));
  console.log(JSON.stringify({ states: results.length, widths: [320,360,390,768,1280], model: "synthetic", cloudWrites: 0, output }));
} finally { store?.close(); await context.close(); await browser.close(); await server.close(); }
