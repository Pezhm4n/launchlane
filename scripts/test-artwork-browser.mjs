import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { startTestServer } from "./test-server.mjs";

const server = await startTestServer();
const browser = await chromium.launch();
const output = resolve(".artifacts/artwork", new Date().toISOString().replaceAll(":", "-"));
await mkdir(output, { recursive: true });
const errors = [], external = [], effects = [], states = [];
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "fa-IR", reducedMotion: "no-preference" });
const page = await context.newPage();
page.on("pageerror", error => errors.push(error.message));
page.on("request", request => { if (!["GET", "HEAD"].includes(request.method())) effects.push(new URL(request.url()).pathname); });
await context.route("**/*", route => {
  if (new URL(route.request().url()).origin !== server.origin) { external.push(route.request().url()); return route.abort(); }
  return route.continue();
});
const art = page.locator(".studio-launch-art"), trigger = page.getByRole("button", { name: "نمایش تعاملی مسیر پروژه تا لیارا", exact: true });
async function inspect(name, width) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: overflow at ${width}`);
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  assert.deepEqual(result.violations.map(row => ({ id: row.id, targets: row.nodes.map(node => node.target) })), [], name);
  states.push({ name, width, axeViolations: 0, horizontalOverflow: false });
}
async function complete() { await page.waitForFunction(() => document.querySelector(".studio-launch-art")?.dataset.playing === "false"); }
try {
  await page.goto(server.origin);
  await page.getByLabel("کلید ورود محلی", { exact: true }).fill(server.token);
  await page.getByRole("button", { name: "ورود به میز کار", exact: true }).click();
  await trigger.waitFor();
  await page.evaluate(async () => document.fonts.ready);
  await complete();
  effects.length = 0;
  await page.mouse.move(0, 0);
  await inspect("rest", 1280);
  await art.screenshot({ path: join(output, "after-rest.png") });

  await trigger.hover({ position: { x: 90, y: 150 } });
  await page.waitForFunction(() => Math.abs(Number(document.querySelector(".studio-launch-art").style.getPropertyValue("--art-x"))) > 0.1);
  await inspect("source-hover", 1280);
  await art.screenshot({ path: join(output, "after-hover.png") });
  await page.mouse.move(0, 0);
  await page.waitForFunction(() => document.querySelector(".studio-launch-art").style.getPropertyValue("--art-x") === "0");
  await trigger.click();
  await page.waitForFunction(() => document.querySelector(".studio-launch-art")?.dataset.playing === "true");
  const lead = art.locator('[data-art-flight="lead"]');
  const a = await lead.evaluate(node => getComputedStyle(node).offsetDistance);
  await page.waitForFunction(first => getComputedStyle(document.querySelector('[data-art-flight="lead"]')).offsetDistance !== first, a);
  await page.waitForFunction(() => {
    const p = parseFloat(getComputedStyle(document.querySelector('[data-art-flight="lead"]')).offsetDistance);
    return p > 35 && p < 85;
  });
  await art.screenshot({ path: join(output, "after-flight.png") });
  await complete();
  assert.equal(await art.getAttribute("data-activated"), "true");
  for (let n = 0; n < 4; n++) await trigger.click();
  await complete();

  await trigger.focus();
  await trigger.press("Tab");
  await page.keyboard.press("Shift+Tab");
  assert.equal(await trigger.evaluate(node => node.matches(":focus-visible")), true);
  assert.equal(await trigger.evaluate(node => getComputedStyle(node).outlineStyle), "solid");
  await inspect("keyboard-focus", 1280);
  await art.screenshot({ path: join(output, "after-focus.png") });
  for (const key of ["Enter", "Space"]) {
    await trigger.press(key);
    assert.equal(await art.getAttribute("data-playing"), "true");
    await complete();
    assert.equal(await trigger.evaluate(node => node === document.activeElement), true);
  }

  await trigger.click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await complete();
  await trigger.click();
  assert.equal(await art.getAttribute("data-playing"), "false");
  const reduced = await art.evaluate(node => ({ running: node.getAnimations({ subtree: true }).filter(animation => animation.playState === "running").length,
    matrices: [...node.querySelectorAll("g[transform]")].map(group => getComputedStyle(group).transform !== "none") }));
  assert.equal(reduced.running, 0);assert.deepEqual(reduced.matrices, [true, true]);
  await inspect("reduced-motion", 1280);
  await art.screenshot({ path: join(output, "after-reduced.png") });

  for (const width of [280, 360, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await inspect("responsive", width);
    assert.equal(await art.isVisible(), width >= 768, "Existing compact mobile layout stays unchanged");
    if (width === 768 || width === 360) await page.screenshot({ path: join(output, `after-${width}.png`), fullPage: true });
  }
  await page.evaluate(() => document.documentElement.style.fontSize = "200%");
  for (const width of [360, 1280]) { await page.setViewportSize({ width, height: 1000 }); await inspect("text-200", width); }
  await page.evaluate(() => document.documentElement.style.fontSize = "");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await trigger.click();
  await page.locator(".app-nav-link").filter({ hasText: "بررسی مشکل سایت" }).click();
  await art.waitFor({ state: "detached" });
  assert.deepEqual(effects, [], "Illustration interaction must not cause a server mutation or model request");
  assert.deepEqual(errors, []);assert.deepEqual(external, []);

  const touch = await browser.newContext({ viewport: { width: 1024, height: 900 }, isMobile: true, hasTouch: true, locale: "fa-IR", reducedMotion: "no-preference" });
  await touch.addCookies(await context.cookies());
  const touchPage = await touch.newPage();
  touchPage.on("pageerror", error => errors.push(error.message));
  touchPage.on("request", request => { if (!["GET", "HEAD"].includes(request.method())) effects.push(new URL(request.url()).pathname); });
  await touch.route("**/*", route => {
    if (new URL(route.request().url()).origin !== server.origin) { external.push(route.request().url()); return route.abort(); }
    return route.continue();
  });
  await touchPage.goto(server.origin);
  const touchArt = touchPage.locator(".studio-launch-art");
  await touchPage.getByRole("button", { name: "نمایش تعاملی مسیر پروژه تا لیارا", exact: true }).tap();
  await touchPage.waitForFunction(() => document.querySelector(".studio-launch-art")?.dataset.playing === "true");
  await touchPage.waitForFunction(() => document.querySelector(".studio-launch-art")?.dataset.playing === "false");
  assert.equal(await touchArt.evaluate(node => Number(node.style.getPropertyValue("--art-x") || "0")), 0);
  await touch.close();
  assert.deepEqual(errors, []);
  assert.deepEqual(effects, []);assert.deepEqual(external, []);
  await writeFile(join(output, "report.json"), JSON.stringify({ states, normalFlight: true, rapidReplay: true, enterAndSpace: true, preferenceChange: true,
    preservedProjection: true, pointerReset: true, touchReplay: true, unmountDuringFlight: true, effects, pageErrors: errors, externalRequests: external.length,
    evidence: "Actual built product in disposable operator state; live model/provider gates off. No cloud writes or deployments." }, null, 2));
  console.log(JSON.stringify({ states: states.length, pageErrors: errors.length, externalRequests: external.length, output }));
} finally { await context.close(); await browser.close(); await server.close(); }
