import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { startTestServer } from "./test-server.mjs";

const server = await startTestServer(), browser = await chromium.launch();
const output = resolve(".artifacts/github-readiness", new Date().toISOString().replaceAll(":", "-"));
await mkdir(output, { recursive: true });
const context = await browser.newContext({ locale: "fa-IR", reducedMotion: "reduce", viewport: { width: 1280, height: 900 } }), page = await context.newPage();
const errors = [], external = [], writes = [], states = [];
let mode = "real", release, metadataReads = 0;
page.on("pageerror", error => errors.push(error.message));
await context.route("**/*", async route => {
  const request = route.request(), url = new URL(request.url());
  if (url.origin !== server.origin) { external.push(url.origin); return route.abort(); }
  if (url.pathname !== "/api/connections/github") return route.continue();
  if (request.method() !== "GET") { writes.push(request.postDataJSON()?.operation); return route.abort(); }
  metadataReads++;
  if (mode === "missing") return route.fulfill({ json: { connection: null, toolReady: false } });
  if (mode === "delayed") await new Promise(resolve => { release = resolve; });
  return route.continue();
});
const dialog = page.getByRole("dialog", { name: "انتخاب پروژه از GitHub", exact: true });
const connect = () => dialog.getByRole("button", { name: "اتصال به GitHub", exact: true });
async function inspect(name, width) {
  assert.equal(await dialog.evaluate(node => node.matches(":modal")), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.equal(await dialog.evaluate(node => node.scrollWidth > node.clientWidth + 1), false);
  const axe = await new AxeBuilder({ page }).include("dialog.github-dialog").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  assert.deepEqual(axe.violations.map(row => ({ id: row.id, targets: row.nodes.map(node => node.target) })), [], name);
  states.push({ name, width, axeViolations: 0, overflow: false });
}
try {
  await page.goto(server.origin); await page.getByLabel("کلید ورود محلی", { exact: true }).fill(server.token);
  await page.getByRole("button", { name: "ورود به میز کار", exact: true }).click();
  await page.getByRole("button", { name: "انتخاب از GitHub", exact: true }).click();
  await connect().waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some(node => node.textContent.trim() === "اتصال به GitHub" && !node.disabled));
  assert.equal(metadataReads, 1, "Actual installed CLI --version enables the entry by default");
  assert.deepEqual(writes, [], "Opening the picker must not start account login");
  await inspect("installed-cli-ready", 1280);
  await page.screenshot({ path: join(output, "ready-1280.png") });
  await page.keyboard.press("Escape"); await dialog.waitFor({ state: "detached" });
  mode = "missing"; await page.getByRole("button", { name: "انتخاب از GitHub", exact: true }).click();
  const setup = dialog.getByRole("region", { name: "ابزار ورود GitHub آماده نیست", exact: true });
  await setup.waitFor(); assert.equal(await connect().isDisabled(), true);
  await setup.getByText("راهنمای مسئول نصب", { exact: true }).click();
  const retry = setup.getByRole("button", { name: "بررسی دوباره ابزار ورود", exact: true });
  const buttonBox = await retry.boundingBox(), commandBox = await setup.locator("code").boundingBox();
  assert.ok(commandBox.y > buttonBox.y + buttonBox.height + 12, "Command and action have separate rows with actual spacing");
  for (const width of [280, 320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 }); await inspect("unavailable-help-open", width);
    if ([390, 1280].includes(width)) await page.screenshot({ path: join(output, `unavailable-${width}.png`) });
  }
  await page.evaluate(() => document.documentElement.style.fontSize = "200%");
  await page.setViewportSize({ width: 320, height: 900 }); await inspect("enlarged-help", 320);
  await page.evaluate(() => document.documentElement.style.fontSize = "");
  await page.setViewportSize({ width: 1280, height: 900 });
  mode = "delayed"; const before = metadataReads;
  await retry.click(); await dialog.getByText("در حال بررسی ابزار ورود…", { exact: true }).waitFor();
  assert.equal(await connect().isDisabled(), true); await inspect("checking", 1280);
  assert.equal(metadataReads, before + 1);
  mode = "real"; release();
  await page.waitForFunction(() => document.activeElement?.textContent.trim() === "اتصال به GitHub" && !document.activeElement.disabled);
  assert.equal(await setup.count(), 0);
  await inspect("ready-after-recheck", 1280);
  assert.deepEqual(writes, []); assert.deepEqual(errors, []); assert.deepEqual(external, []);
  await page.keyboard.press("Escape"); await dialog.waitFor({ state: "detached" });
  await writeFile(join(output, "report.json"), JSON.stringify({ states, metadataReads, loginOrImportWrites: writes, pageErrors: errors, external,
    evidence: "Actual built picker and installed official CLI version read. Missing-tool/delayed browser metadata are synthetic. No account grant, real model or provider write." }, null, 2));
  console.log(JSON.stringify({ states: states.length, pageErrors: errors.length, externalRequests: external.length, loginOrImportWrites: writes.length, output }));
} finally { release?.(); await context.close(); await browser.close(); await server.close(); }
