import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { startTestServer } from "./test-server.mjs";

const server = await startTestServer(), browser = await chromium.launch();
const output = resolve(".artifacts/mcp-settings", new Date().toISOString().replaceAll(":", "-"));
await mkdir(output, { recursive: true });
const context = await browser.newContext({ locale: "fa-IR", reducedMotion: "reduce", viewport: { width: 1280, height: 900 }, acceptDownloads: true });
await context.grantPermissions(["clipboard-read", "clipboard-write"]);
const page = await context.newPage(), errors = [], external = [], states = [], requests = [], grants = [];
let mode = "real", release;
page.on("pageerror", error => errors.push(error.message));
await context.route("**/*", async route => {
  const request = route.request(), url = new URL(request.url());
  if (url.origin !== server.origin) { external.push(url.origin); return route.abort(); }
  if (url.pathname !== "/api/mcp/access") return route.continue();
  requests.push({ method: request.method(), missions: request.method() === "POST" ? request.postDataJSON().missions : undefined });
  if (mode === "delay") await new Promise(resolve => { release = resolve; });
  const failure = mode === "failure" || mode === "revoke-failure" && request.method() === "DELETE";
  if (failure || mode === "denied" || mode === "auth") return route.fulfill({ status: failure ? 503 : mode === "denied" ? 403 : 401, json: { error: {
    code: failure ? "UNAVAILABLE" : mode === "denied" ? "FORBIDDEN" : "AUTH_REQUIRED", message: failure ? "سرویس موقتاً در دسترس نیست؛ دوباره تلاش کنید." : "دسترسی این نشست مجاز نیست.", retryable: failure, requestId: "ui-fixture" } } });
  const response = await route.fetch();
  if (request.method() === "POST" && response.ok()) {
    const grant = await response.json(); grants.push(grant);
    if (mode === "expiry") return route.fulfill({ response, json: { ...grant, expiresAt: Date.now() + 6000 } });
  }
  return route.fulfill({ response });
});
const dialog = page.getByRole("dialog", { name: "اتصال MCP", exact: true });
const create = () => dialog.getByRole("button", { name: "ساخت دسترسی همین حساب", exact: true });
async function inspect(name, width) {
  assert.equal(await dialog.evaluate(node => node.matches(":modal")), true, name);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, name);
  assert.equal(await dialog.evaluate(node => node.scrollWidth > node.clientWidth + 1), false, `${name}: dialog overflow`);
  const rect = await dialog.boundingBox(); assert.ok(rect.x >= 0 && rect.x + rect.width <= width + 1, name);
  const result = await new AxeBuilder({ page }).include("dialog[aria-labelledby=mcp-connect-title]").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  assert.deepEqual(result.violations.map(row => ({ id: row.id, targets: row.nodes.map(node => node.target) })), [], name);
  states.push({ name, width, axeViolations: 0, overflow: false });
}
async function layouts(name) {
  for (const width of [280, 320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 }); await inspect(name, width);
    await dialog.evaluate(node => { node.scrollTop = 0; });
    if ([390, 1280].includes(width)) await page.screenshot({ path: join(output, `${name}-${width}.png`) });
  }
}
async function download() {
  const event = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "دانلود فایل دسترسی MCP", exact: true }).click();
  const file = await event; assert.equal(file.suggestedFilename(), "launchlane-mcp-access.json");
  return JSON.parse(await readFile(await file.path(), "utf8"));
}
async function keyboardCycle() {
  await dialog.getByRole("button", { name: "بستن اتصال MCP", exact: true }).focus();
  for (let index = 0; index < 22; index++) {
    await page.keyboard.press("Tab");
    // Chromium may move Tab to browser chrome; background page controls remain inert.
    const boundary = await dialog.evaluate(root => ({ documentFocused: document.hasFocus(), body: document.activeElement === document.body,
      root: document.activeElement === root, inside: root.contains(document.activeElement) }));
    if (!boundary.documentFocused) { assert.equal(boundary.body, true); continue; }
    assert.equal(boundary.inside, true, "A focused page control stays inside the native modal");
    if (boundary.root) continue;
    await page.waitForFunction(() => {
      const root = document.querySelector("dialog[aria-labelledby=mcp-connect-title]"), node = document.activeElement;
      if (!root?.contains(node)) return false;
      const box = node.getBoundingClientRect(), panel = root.getBoundingClientRect(), header = root.querySelector("header");
      return box.top >= (header.contains(node) ? panel.top : header.getBoundingClientRect().bottom) - 1 && box.bottom <= panel.bottom + 1;
    }, undefined, { timeout: 3000 });
    const focus = await dialog.evaluate(root => {
      const node = document.activeElement, box = node.getBoundingClientRect(), panel = root.getBoundingClientRect();
      const header = root.querySelector("header");
      return { inside: root.contains(node), top: box.top, bottom: box.bottom, panelBottom: panel.bottom, minimumTop: header.contains(node) ? panel.top : header.getBoundingClientRect().bottom };
    });
    assert.ok(focus.inside, "Tab stays inside the native modal");
    assert.ok(focus.top >= focus.minimumTop - 1 && focus.bottom <= focus.panelBottom + 1, `Focused control remains visible: ${JSON.stringify(focus)}`);
  }
}
async function revoke() {
  await dialog.getByRole("button", { name: "لغو همین دسترسی MCP", exact: true }).click();
  await dialog.getByRole("button", { name: "بله، لغو دسترسی", exact: true }).click();
  await create().waitFor();
}
try {
  await page.goto(server.origin);
  await page.getByLabel("کلید ورود محلی", { exact: true }).fill(server.token);
  await page.getByRole("button", { name: "ورود به میز کار", exact: true }).click();
  await page.getByRole("button", { name: "حساب‌ها", exact: true }).click();
  await page.getByRole("button", { name: "اتصال MCP", exact: true }).click();
  await dialog.waitFor(); await page.evaluate(() => document.fonts.ready);
  assert.equal(await dialog.getByRole("checkbox").isChecked(), false);
  for (const name of ["OpenCode", "Claude Code", "Codex"]) await dialog.getByRole("radio", { name, exact: true }).check();
  assert.equal(requests.length, 0, "client selection does not issue access");
  await layouts("choose");
  mode = "delay"; await create().click();
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some(node => node.textContent.includes("در حال صدور دسترسی")));
  assert.equal(await dialog.getByRole("button", { name: "بستن اتصال MCP", exact: true }).isDisabled(), true);
  assert.equal(await dialog.getByRole("checkbox").isDisabled(), true);
  await inspect("issuing", 1280); assert.equal(requests.filter(row => row.method === "POST").length, 1);
  mode = "real"; release();
  await dialog.getByRole("button", { name: "دانلود فایل دسترسی MCP", exact: true }).waitFor();
  assert.equal(requests.at(-1).missions, false); await layouts("issued");
  const access = await download(); assert.equal(access.missions, false); assert.equal(access.url, `${server.origin}/api/mcp`);
  await dialog.getByRole("heading", { name: "ادامهٔ اتصال به Codex", exact: true }).waitFor(); await layouts("guide");
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await dialog.getByLabel("فرمان راه‌اندازی", { exact: true }).evaluate(node => node.scrollHeight > node.clientHeight + 1), false, "The normal-size command is fully readable without a nested scroll");
    await dialog.locator("#mcp-install-guide").evaluate(node => {
      const root = node.closest("dialog"); root.scrollTop += node.getBoundingClientRect().top - root.querySelector("header").getBoundingClientRect().bottom - 16;
    });
    await page.screenshot({ path: join(output, `setup-${width}.png`) });
  }
  for (const [name, suffix] of [["Codex", "codex.toml"], ["Claude Code", "claude.json"], ["OpenCode", "opencode.json"]]) {
    await dialog.getByRole("radio", { name, exact: true }).check();
    const file = dialog.getByLabel("مسیر فایل تنظیم تولیدشده", { exact: true });
    assert.ok((await file.inputValue()).endsWith(`.json.${suffix}`));
    await dialog.getByRole("button", { name: "کپی مسیر فایل تنظیم تولیدشده", exact: true }).click();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), await file.inputValue());
  }
  await dialog.getByRole("radio", { name: "macOS / Linux", exact: true }).check();
  await dialog.getByRole("button", { name: "کپی فرمان راه‌اندازی", exact: true }).click();
  const command = await page.evaluate(() => navigator.clipboard.readText());
  assert.ok(command.includes(`--origin '${server.origin}'`)); assert.ok(command.includes(`.local/mcp-${access.id}.json`));
  await page.evaluate(() => { Object.defineProperty(navigator.clipboard, "writeText", { configurable: true, value: async () => { throw new DOMException("denied", "NotAllowedError"); } }); });
  await dialog.getByRole("button", { name: "کپی درخواست بررسی اتصال", exact: true }).click();
  await dialog.getByText("کپی خودکار در دسترس نیست؛ متن بالا را انتخاب و کپی کنید.", { exact: true }).waitFor(); await inspect("clipboard-denied", 1280);
  const text = dialog.getByLabel("درخواست بررسی اتصال", { exact: true }); await text.focus();
  assert.equal(await text.evaluate(node => node.selectionEnd - node.selectionStart), (await text.inputValue()).length);
  await page.evaluate(() => document.documentElement.style.fontSize = "200%");
  for (const width of [320, 1280]) { await page.setViewportSize({ width, height: 900 }); await inspect("text-200", width); }
  await page.evaluate(() => document.documentElement.style.fontSize = "");
  await page.setViewportSize({ width: 1280, height: 500 }); await inspect("short-landscape", 1280); await keyboardCycle();
  await page.setViewportSize({ width: 1280, height: 900 });
  await dialog.getByRole("button", { name: "لغو همین دسترسی MCP", exact: true }).click();
  await page.waitForFunction(() => document.activeElement?.textContent === "انصراف از لغو");
  const deletes = requests.filter(row => row.method === "DELETE").length; await page.keyboard.press("Escape");
  assert.equal(requests.filter(row => row.method === "DELETE").length, deletes);
  await page.waitForFunction(() => document.activeElement?.textContent?.includes("لغو همین دسترسی MCP"));
  assert.equal(await dialog.isVisible(), true);
  await dialog.getByRole("button", { name: "لغو همین دسترسی MCP", exact: true }).click(); mode = "revoke-failure";
  await dialog.getByRole("button", { name: "بله، لغو دسترسی", exact: true }).click();
  await dialog.getByRole("alert").waitFor(); await inspect("revocation-failed", 1280);
  assert.equal(await dialog.getByRole("button", { name: "دانلود دوبارهٔ همان فایل", exact: true }).count(), 1);
  mode = "real"; await dialog.getByRole("button", { name: "بله، لغو دسترسی", exact: true }).click(); await create().waitFor();
  for (const failure of ["failure", "denied"]) {
    mode = failure; await create().click(); await dialog.getByRole("alert").waitFor();
    await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "alert"); await inspect(failure, 1280);
  }
  mode = "expiry"; await create().click(); await download();
  await dialog.getByText("این دسترسی منقضی شده است", { exact: true }).waitFor({ timeout: 15000 });
  assert.equal(await dialog.getByRole("button", { name: "دانلود دوبارهٔ همان فایل", exact: true }).count(), 0); await inspect("expired", 1280);
  await dialog.getByRole("checkbox").check(); mode = "real";
  await dialog.getByRole("button", { name: "ساخت دسترسی تازه", exact: true }).click();
  const mission = await download(); assert.equal(mission.missions, true); assert.notEqual(mission.id, access.id);
  for (const grant of grants) {
    assert.ok(!(await page.content()).includes(grant.accessToken));
    assert.ok(!(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).includes(grant.accessToken));
    assert.ok(!command.includes(grant.accessToken));
  }
  await revoke(); await page.keyboard.press("Escape"); await dialog.waitFor({ state: "detached" });
  await page.waitForFunction(() => document.activeElement?.textContent === "اتصال MCP");
  assert.equal(await page.getByRole("dialog", { name: "حساب‌ها و دسترسی", exact: true }).isVisible(), true);
  await page.getByRole("button", { name: "اتصال MCP", exact: true }).click(); mode = "auth"; await create().click();
  await page.getByLabel("کلید ورود محلی", { exact: true }).waitFor();
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  await writeFile(join(output, "report.json"), JSON.stringify({ states, pageErrors: errors, external, accessRequests: requests,
    evidence: "Built UI and disposable SQLite grants/download/revocation are actual; error/expiry transports are synthetic. No live model, cloud write or external host installation." }, null, 2));
  console.log(JSON.stringify({ states: states.length, pageErrors: errors.length, externalRequests: external.length, output }));
} finally { release?.(); await context.close(); await browser.close(); await server.close(); }
