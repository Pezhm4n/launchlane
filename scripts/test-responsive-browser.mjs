import assert from "node:assert/strict";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { startTestServer } from "./test-server.mjs";
import { reviewProject } from "./browser-project.mjs";

// Every CSS reference needs a declaration or an explicit fallback. Runtime
// variables with fallbacks remain valid; selectors/contrast are checked in Chromium.
const styleFiles = (await readdir("src", { recursive: true })).filter(path => path.endsWith(".css"));
const styles = await Promise.all(styleFiles.map(async path => ({ path, source: (await readFile(join("src", path), "utf8")).replace(/\/\*[\s\S]*?\*\//g, "") })));
const declarations = new Set(styles.flatMap(row => [...row.source.matchAll(/(--[\w-]+)\s*:/g)].map(match => match[1])));
const unresolved = styles.flatMap(row => [...row.source.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)].filter(match => !declarations.has(match[1])).map(match => ({ path: row.path, token: match[1] })));
assert.deepEqual(unresolved, [], "CSS variables must have declarations or explicit fallbacks");

const server = await startTestServer(), browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: "fa-IR", reducedMotion: "reduce" });
const page = await context.newPage(), errors = [], external = [], writes = [], states = [], failures = [];
const output = resolve(".artifacts/responsive", new Date().toISOString().replaceAll(":", "-"));
await mkdir(output, { recursive: true });
page.on("pageerror", error => errors.push(error.message));
page.on("request", request => { if (request.method() === "POST") writes.push(new URL(request.url()).pathname); });
await context.route("**/*", route => {
  if (new URL(route.request().url()).origin !== server.origin) { external.push(new URL(route.request().url()).host); return route.abort(); }
  return route.continue();
});
async function viewport(width, height = 740, zoom = false) {
  await page.setViewportSize({ width, height });
  await page.evaluate(async zoom => { document.documentElement.style.fontSize = zoom ? "200%" : ""; await document.fonts.ready; }, zoom);
  await page.waitForFunction(() => {
    const nav = document.querySelector(".app-nav");
    return !nav || Math.abs(nav.getBoundingClientRect().height - parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--app-nav-height"))) < 1;
  });
}
async function scan(name, width, { height = 740, zoom = false, modal = false } = {}) {
  await viewport(width, height, zoom);
  await page.evaluate(() => scrollTo(0, 0));
  const geometry = await page.evaluate(() => {
    const rect = node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
    const dialog = document.querySelector("dialog:modal"), project = document.querySelector(".project-summary");
    const projectStyle = project ? getComputedStyle(project) : null;
    return { pageWidth: document.documentElement.scrollWidth, viewport: innerWidth,
      projectStyle: projectStyle ? { radius: parseFloat(projectStyle.borderTopLeftRadius), shadow: projectStyle.boxShadow } : null,
      header: rect(document.querySelector(".app-top")), dialog: dialog ? { ...rect(dialog), overflow: dialog.scrollWidth > dialog.clientWidth + 1 } : null };
  });
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  const issues = axe.violations.map(row => ({ id: row.id, targets: row.nodes.map(node => node.target) }));
  if (name === "selected" && (!geometry.projectStyle || geometry.projectStyle.radius <= 0 || geometry.projectStyle.shadow === "none")) issues.push({ id: "project-surface-tokens" });
  if (geometry.pageWidth > geometry.viewport + 1) issues.push({ id: "page-overflow" });
  if (!modal && !zoom && width < 768 && geometry.header.height > 64) issues.push({ id: "header-wrap" });
  if (modal && (!geometry.dialog || geometry.dialog.top < -1 || geometry.dialog.bottom > height + 1 || geometry.dialog.overflow)) issues.push({ id: "dialog-bounds" });
  states.push({ name, width, height, zoom, geometry, issues });
  if (issues.length) failures.push({ name, width, height, zoom, issues });
  if ([280, 1280].includes(width) || zoom || height < 500) await page.screenshot({ path: join(output, `${name}-${width}-${height}${zoom ? "-zoom" : ""}.png`), fullPage: false });
}
async function keyboard(name, count, modal = false) {
  for (let index = 0; index < count; index++) {
    await page.keyboard.press("Tab");
    await page.evaluate(() => new Promise(requestAnimationFrame));
    const focus = await page.evaluate(modal => {
      const node = document.activeElement;
      if (!(node instanceof HTMLElement) || node === document.body) return null;
      const r = node.getBoundingClientRect(), x = Math.max(0, Math.min(innerWidth - 1, r.left + r.width / 2)), y = Math.max(0, Math.min(innerHeight - 1, r.top + r.height / 2));
      const hit = document.elementFromPoint(x, y);
      return { tag: node.tagName, id: node.id, className: node.getAttribute("class"),
        left: r.left, right: r.right, top: r.top, bottom: r.bottom,
        covered: !hit || !node.contains(hit), outside: r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1,
        escaped: modal && !node.closest("dialog:modal") };
    }, modal);
    if (focus && (focus.covered || focus.outside || focus.escaped)) failures.push({ name, index, focus });
  }
}
try {
  await page.goto(server.origin);
  await page.getByLabel("کلید ورود محلی", { exact: true }).fill(server.token);
  await page.getByRole("button", { name: "ورود به میز کار", exact: true }).click();
  await page.getByRole("button", { name: "امتحان با پروژه نمونه", exact: true }).waitFor();
  for (const width of [280, 320, 390, 767, 768, 1280]) await scan("empty", width);
  await scan("empty", 390, { zoom: true });
  await scan("empty", 320, { zoom: true });
  await viewport(390); await page.getByRole("button", { name: "امتحان با پروژه نمونه", exact: true }).click();
  await page.locator(".project-summary").waitFor();
  for (const width of [280, 320, 390, 767, 768, 1280]) await scan("selected", width);
  await scan("selected", 390, { zoom: true });
  await scan("selected", 320, { zoom: true });
  await viewport(320); await reviewProject(page);
  for (const width of [280, 320, 768, 959, 1280]) {
    await viewport(width);
    await page.getByRole("button", { name: "تغییر پروژه", exact: true }).focus();
    await keyboard(`publication-keyboard-${width}`, 35);
  }
  for (const [width, zoom] of [[280, true], [320, true], [640, false], [768, true]]) {
    await scan("short-publication", width, { height: 360, zoom });
    await page.getByRole("button", { name: "تغییر پروژه", exact: true }).focus();
    await keyboard(`short-publication-keyboard-${width}`, 35);
  }
  const dialogs = [
    { name: "library", trigger: "پروژه‌های من", title: "پروژه‌های من" },
    { name: "accounts", trigger: "حساب‌ها", title: "حساب‌ها و دسترسی" },
  ];
  for (const item of dialogs) {
    await viewport(390);
    await page.getByRole("button", { name: item.trigger, exact: true }).click();
    await page.getByRole("dialog", { name: item.title, exact: true }).waitFor();
    for (const width of [280, 390, 768, 1280]) await scan(item.name, width, { modal: true });
    await scan(item.name, 390, { modal: true, zoom: true });
    await scan(item.name, 320, { modal: true, zoom: true });
    await scan(item.name, 640, { modal: true, height: 360 });
    await viewport(320, 540); await keyboard(`${item.name}-keyboard`, 16, true);
    await page.keyboard.press("Escape");
    await page.getByRole("dialog", { name: item.title, exact: true }).waitFor({ state: "detached" });
    assert.equal(await page.getByRole("button", { name: item.trigger, exact: true }).evaluate(node => node === document.activeElement), true, `${item.name}: return focus`);
  }
  // The mobile account menu and desktop header lead to the same cancellable
  // sign-out decision. Dismissing it must preserve the session and focus.
  for (const width of [280, 390, 1280]) {
    await page.emulateMedia({ reducedMotion: width === 390 ? "no-preference" : "reduce" });
    await viewport(width);
    const mobile = width < 768;
    const trigger = page.getByRole("button", { name: mobile ? "حساب‌ها" : "خروج", exact: true });
    await trigger.click();
    if (mobile) await page.getByRole("dialog", { name: "حساب‌ها و دسترسی", exact: true }).getByRole("button", { name: "خروج از میز کار", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "خروج از میز کار", exact: true });
    await dialog.getByText("برای ورود مجدد، کلید دسترسی محلی همین نصب مورد نیاز خواهد بود.", { exact: true }).waitFor();
    await scan("signout", width, { modal: true });
    await scan("signout", width, { modal: true, zoom: true });
    await viewport(640, 360, true); await keyboard("signout-keyboard", 12, true);
    await viewport(width);
    await page.keyboard.press("Escape"); await dialog.waitFor({ state: "detached" });
    await page.waitForFunction(name => document.activeElement?.getAttribute("aria-label") === name || document.activeElement?.textContent?.trim() === name, mobile ? "حساب‌ها" : "خروج");
    assert.equal((await page.request.get(`${server.origin}/api/workspace`)).status(), 200);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await viewport(390);
  await page.getByRole("link", { name: "بررسی مشکل سایت", exact: true }).click();
  for (const width of [280, 320, 390, 768, 1280]) await scan("investigation", width);
  await scan("investigation", 390, { zoom: true });
  await scan("investigation", 320, { zoom: true });
  assert.equal(writes.some(path => path.startsWith("/api/agent/runs")), false, "Layout and navigation must not start a model run");
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  console.log(JSON.stringify({ states: states.length, failures, modelCalls: 0, providerWrites: 0, output }));
  assert.deepEqual(failures, []);
} finally {
  await writeFile(join(output, "results.json"), JSON.stringify({ states, failures, errors, external, modelCalls: 0, providerWrites: 0 }, null, 2));
  await context.close(); await browser.close(); await server.close();
}
