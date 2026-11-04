import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { startTestServer } from "./test-server.mjs";

const server = await startTestServer(), browser = await chromium.launch();
const output = resolve(".artifacts/accounts-page", new Date().toISOString().replaceAll(":", "-"));
await mkdir(output, { recursive: true });
const context = await browser.newContext({ locale: "fa-IR", reducedMotion: "reduce", viewport: { width: 1280, height: 900 } }), page = await context.newPage();
const errors = [], external = [], mutations = [], states = [];
let mode = "real", release;
page.on("pageerror", error => errors.push(error.message));
await context.route("**/*", async route => {
  const request = route.request(), url = new URL(request.url());
  if (url.origin !== server.origin) { external.push(url.origin); return route.abort(); }
  if (!["GET", "HEAD"].includes(request.method())) mutations.push({ path: url.pathname, method: request.method() });
  if (url.pathname !== "/api/connections/liara" || request.method() !== "GET") return route.continue();
  if (mode === "delay") await new Promise(resolve => { release = resolve; });
  if (mode === "failure" || mode === "denied" || mode === "auth") return route.fulfill({ status: mode === "failure" ? 503 : mode === "denied" ? 403 : 401, json: { error: {
    code: mode === "failure" ? "UNAVAILABLE" : mode === "denied" ? "FORBIDDEN" : "AUTH_REQUIRED",
    message: "تنظیمات اتصال دریافت نشد؛ دوباره بررسی کنید.", retryable: mode === "failure", requestId: "accounts-page-fixture" } } });
  return route.continue();
});
const accounts = page.getByRole("region", { name: "حساب‌ها و دسترسی", exact: true });
const back = () => accounts.getByRole("button", { name: "بازگشت به فضای پروژه", exact: true });
const trigger = () => page.getByRole("button", { name: "حساب‌ها", exact: true });
async function scan(name, width, zoom = false, height = 900) {
  await page.setViewportSize({ width, height });
  await page.evaluate(async zoom => { document.documentElement.style.fontSize = zoom ? "200%" : ""; await document.fonts.ready; scrollTo(0, 0); }, zoom);
  assert.equal(await page.locator("dialog:modal").count(), 0, "Settings are a document page");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, name);
  assert.equal(await accounts.evaluate(node => node.scrollWidth > node.clientWidth + 1), false, name);
  assert.notEqual(await page.evaluate(() => getComputedStyle(document.documentElement).overflow), "hidden");
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  assert.deepEqual(axe.violations.map(row => ({ id: row.id, nodes: row.nodes.map(node => node.target) })), [], name);
  assert.equal(await page.getByRole("navigation", { name: "بخش‌های میز کار" }).getByRole("link").count(), 2);
  assert.equal(await trigger().getAttribute("aria-current"), "page");
  states.push({ name, width, zoom, height, axeViolations: 0, modal: false });
  if ([390, 1280].includes(width) || zoom) await page.screenshot({ path: join(output, `${name}-${width}${zoom ? "-zoom" : ""}.png`), fullPage: true });
}
try {
  // A direct settings URL survives authentication without starting an agent.
  await page.goto(`${server.origin}/?view=accounts&from=incident`);
  await page.getByLabel("کلید ورود محلی", { exact: true }).fill(server.token);
  await page.getByRole("button", { name: "ورود به میز کار", exact: true }).click();
  await accounts.waitFor(); assert.equal(new URL(page.url()).searchParams.get("view"), "accounts");
  await page.waitForFunction(() => document.activeElement?.id === "accounts-title");
  assert.match(await page.title(), /حساب‌ها و دسترسی/);
  await page.keyboard.press("Escape"); assert.equal(await accounts.isVisible(), true, "Escape is not page navigation");
  for (const width of [280, 320, 390, 768, 1280]) await scan("unconnected", width);
  await scan("enlarged", 320, true); await scan("enlarged", 768, true); await scan("short", 640, false, 360);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("navigation", { name: "تنظیمات حساب‌ها" }).getByRole("link", { name: "نشست و خروج", exact: true }).click();
  await accounts.getByRole("button", { name: "خروج از میز کار", exact: true }).click();
  const signout = page.getByRole("dialog", { name: "خروج از میز کار", exact: true }); await signout.waitFor();
  await page.keyboard.press("Escape"); await signout.waitFor({ state: "detached" });
  await page.waitForFunction(() => document.activeElement?.textContent.trim() === "خروج از میز کار");
  assert.equal(new URL(page.url()).searchParams.get("view"), "accounts");
  await accounts.getByRole("button", { name: "اتصال به GitHub و انتخاب مخزن", exact: true }).click();
  const github = page.getByRole("dialog", { name: "انتخاب پروژه از GitHub", exact: true }); await github.waitFor();
  await page.keyboard.press("Escape"); await github.waitFor({ state: "detached" });
  await page.waitForFunction(() => document.activeElement?.textContent.trim() === "اتصال به GitHub و انتخاب مخزن");
  assert.equal(await accounts.isVisible(), true);
  await back().click(); await accounts.waitFor({ state: "detached" });
  assert.equal(new URL(page.url()).searchParams.get("view"), "incident");
  await page.getByRole("link", { name: "انتشار پروژه", exact: true }).click();
  await page.getByRole("button", { name: "امتحان با پروژه نمونه", exact: true }).click();
  await page.locator(".project-summary").waitFor(); const project = new URL(page.url()).searchParams.get("project"); assert.ok(project);
  await trigger().click(); await accounts.waitFor();
  assert.equal(new URL(page.url()).searchParams.get("project"), project);
  await page.goBack(); await accounts.waitFor({ state: "detached" }); await page.locator(".project-summary").waitFor();
  await page.waitForFunction(() => document.activeElement?.textContent.trim() === "حساب‌ها");
  await page.goForward(); await accounts.waitFor();
  await page.reload(); await accounts.waitFor();
  assert.equal(new URL(page.url()).searchParams.get("project"), project); await scan("reloaded-selected-project", 1280);
  await back().click(); await accounts.waitFor({ state: "detached" });
  mode = "delay"; await trigger().click(); await accounts.getByText("در حال بررسی تنظیمات اتصال…", { exact: true }).waitFor(); await scan("loading", 390);
  mode = "failure"; release(); await accounts.getByRole("alert", { name: "اتصال حساب کامل نشد" }).waitFor();
  const retry = accounts.getByRole("button", { name: "بررسی دوباره تنظیمات اتصال", exact: true }); await retry.waitFor();
  assert.equal(await accounts.getByText("در حال بررسی تنظیمات اتصال…", { exact: true }).count(), 0);
  await scan("failure", 390); mode = "real"; await retry.click();
  await accounts.getByLabel("کلید دسترسی لیارا", { exact: true }).waitFor(); await scan("recovered", 1280);
  await back().click(); await accounts.waitFor({ state: "detached" }); mode = "denied"; await trigger().click();
  await retry.waitFor(); await scan("denied", 390);
  mode = "real"; await retry.click(); await accounts.getByLabel("کلید دسترسی لیارا", { exact: true }).waitFor();
  // Leaving while a read is pending must not restore a stale page or error.
  await back().click(); mode = "delay"; await trigger().click(); await accounts.getByText("در حال بررسی تنظیمات اتصال…", { exact: true }).waitFor();
  await back().click(); mode = "real"; release(); await page.locator(".project-summary").waitFor(); assert.equal(await accounts.count(), 0);
  mode = "auth"; await trigger().click(); await page.getByLabel("کلید ورود محلی", { exact: true }).waitFor();
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  assert.deepEqual(mutations.filter(row => !["/api/session", "/api/project-flows"].includes(row.path)), [], "Navigation never starts model, publication, GitHub login or grants");
  await writeFile(join(output, "report.json"), JSON.stringify({ states, errors, external, mutations, evidence: "Actual built page, session, source inspection and history; synthetic connection read failures. Zero real model/provider/GitHub login." }, null, 2));
  console.log(JSON.stringify({ states: states.length, errors: errors.length, externalRequests: external.length, output }));
} finally { release?.(); await context.close(); await browser.close(); await server.close(); }
