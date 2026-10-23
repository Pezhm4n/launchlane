import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { startTestServer } from "./test-server.mjs";

const server = await startTestServer({ agentFixture: true }), browser = await chromium.launch();
const output = resolve(".artifacts/mobile", new Date().toISOString().replaceAll(":", "-"));
await mkdir(output, { recursive: true });
const errors = [], external = [], posts = [], states = [];
const context = await browser.newContext({ viewport: { width: 375, height: 667 }, locale: "fa-IR", reducedMotion: "no-preference" });
await context.route("**/*", route => {
  if (new URL(route.request().url()).origin !== server.origin) { external.push(route.request().url()); return route.abort(); }
  return route.continue();
});
const page = await context.newPage();
page.on("pageerror", error => errors.push(error.message));
page.on("request", request => { if (request.method() === "POST") posts.push(new URL(request.url()).pathname); });
const launcher = page.getByRole("button", { name: "باز کردن دستیار هوشمند", exact: true });
async function measure(width, textZoom = false) {
  await page.setViewportSize({ width, height: 667 });
  await page.evaluate(async zoom => { document.documentElement.style.fontSize = zoom ? "200%" : ""; await document.fonts.ready; scrollTo(0, 0); }, textZoom);
  await page.waitForFunction(() => Math.abs(Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--app-nav-height")) - document.querySelector(".app-nav").getBoundingClientRect().height) < 1);
  const metrics = await page.evaluate(() => {
    const rect = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
    const field = document.querySelector(".publication-start button"), panel = document.querySelector(".publication-journey");
    return { viewport: innerHeight, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      header: rect(".app-top"), nav: rect(".app-nav"), launcher: rect(".assistant-launcher"), label: rect(".studio-project-label"), name: rect(".studio-project-name"),
      direction: getComputedStyle(document.querySelector(".studio-project-name")).direction,
      nameAlignment: getComputedStyle(document.querySelector(".studio-project-name")).textAlign,
      bodyFont: Number.parseFloat(getComputedStyle(document.body).fontSize), titleFont: Number.parseFloat(getComputedStyle(document.querySelector("h1")).fontSize),
      buttonFont: Number.parseFloat(getComputedStyle(field).fontSize), panelPadding: Number.parseFloat(getComputedStyle(panel).paddingInlineStart),
      selected: document.querySelectorAll('.app-nav-link[aria-current="page"]').length,
      overflowElements: [...document.querySelectorAll("body *")].filter(node => {
        const box = node.getBoundingClientRect(); return box.width && (box.left < -1 || box.right > innerWidth + 1);
      }).slice(0, 12).map(node => ({ tag: node.tagName, class: node.className, width: node.getBoundingClientRect().width })),
    };
  });
  assert.ok(metrics.overflow <= 1, JSON.stringify(metrics));
  assert.equal(metrics.selected, 1); assert.equal(metrics.direction, "ltr"); assert.equal(metrics.nameAlignment, "right");
  assert.ok(metrics.name.top >= metrics.label.bottom, "The project name must be a separate bidi-safe block");
  if (width < 768) {
    assert.ok(metrics.nav.bottom <= metrics.viewport + 1 && metrics.nav.bottom >= metrics.viewport - 1, "Mobile tabs belong at the viewport bottom");
    const iconTarget = textZoom ? 88 : 44;
    assert.ok(metrics.launcher.bottom <= metrics.nav.top - 12 && metrics.launcher.width >= iconTarget && metrics.launcher.width <= iconTarget + 4, "The icon launcher must fit above the tab bar and respect text enlargement");
    assert.equal(await launcher.innerText(), "");
    if (!textZoom) assert.ok(metrics.header.height <= 64 && metrics.bodyFont <= 14 && metrics.titleFont <= 20 && metrics.buttonFont <= 14 && metrics.panelPadding <= 16, JSON.stringify(metrics));
  } else { assert.ok(metrics.nav.bottom <= metrics.header.bottom); assert.equal(await launcher.innerText(), "دستیار هوشمند"); }
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  assert.deepEqual(axe.violations.map(row => ({ id: row.id, nodes: row.nodes.map(node => node.target) })), []);
  states.push({ width, textZoom, ...metrics, axeViolations: 0 });
  await page.screenshot({ path: join(output, `project-${width}${textZoom ? "-zoom" : ""}.png`) });
}
try {
  await page.goto(server.origin);
  await page.getByLabel("کلید ورود محلی", { exact: true }).fill(server.token);
  await page.getByRole("button", { name: "ورود به میز کار", exact: true }).click();
  await launcher.waitFor();
  const shine = await launcher.evaluate(node => new Promise(resolve => {
    const frames = [], start = performance.now();
    const sample = () => { frames.push(getComputedStyle(node, "::after").transform); if (performance.now() - start < 2100) requestAnimationFrame(sample); else resolve(frames); };
    requestAnimationFrame(sample);
  }));
  assert.ok(new Set(shine).size > 1, "Default shimmer must visibly move without hover");
  await page.getByRole("button", { name: "امتحان با پروژه نمونه", exact: true }).click();
  await page.locator(".project-summary").waitFor();
  await page.route("**/api/project-flows*", async route => {
    const response = await route.fetch(), value = await response.json();
    if (value.flow) value.flow.displayName = "Pezhm4n/challenge-1-zarinpal";
    return route.fulfill({ response, json: value });
  });
  await page.reload(); await page.locator(".studio-project-name").filter({ hasText: "Pezhm4n/" }).waitFor();
  for (const width of [280, 320, 375, 390, 767, 768, 1024]) await measure(width);
  for (const width of [280, 375]) await measure(width, true);
  await measure(375);
  await page.evaluate(async () => { await document.fonts.load("650 18px Geist", "Pezhm4n/challenge"); });
  const cdp = await context.newCDPSession(page); await cdp.send("DOM.enable"); await cdp.send("CSS.enable");
  const documentNode = await cdp.send("DOM.getDocument");
  const node = await cdp.send("DOM.querySelector", { nodeId: documentNode.root.nodeId, selector: ".studio-project-name" });
  const rendered = await cdp.send("CSS.getPlatformFontsForNode", { nodeId: node.nodeId });
  assert.ok(rendered.fonts.some(font => /geist/i.test(font.familyName) && font.isCustomFont && font.glyphCount > 0), JSON.stringify(rendered));
  await launcher.click();
  const chat = page.getByRole("dialog", { name: "دستیار هوشمند", exact: true });
  await chat.getByRole("textbox").fill("پیش‌نویس من"); await chat.press("Escape"); await launcher.waitFor();
  await page.getByRole("link", { name: "بررسی مشکل سایت", exact: true }).click();
  await launcher.click(); await chat.waitFor(); assert.equal(await chat.getByRole("textbox").inputValue(), "پیش‌نویس من");
  await chat.press("Escape"); await launcher.waitFor();
  assert.equal(posts.some(path => /\/api\/agent\/runs/.test(path)), false, "Typography, tab changes and a draft cannot start model work");
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  const result = { states, errors, external, renderedFont: rendered.fonts, defaultShineMoving: true, preservedDraft: true, modelRequests: 0, output };
  await writeFile(join(output, "results.json"), JSON.stringify(result, null, 2)); console.log(JSON.stringify({ states: states.length, browserErrors: 0, externalRequests: 0, renderedFont: "Geist", defaultShineMoving: true, output }));
} catch (error) { await page.screenshot({ path: join(output, "failure.png") }); console.error(`Mobile evidence: ${output}`); throw error; }
finally { await context.close(); await browser.close(); await server.close(); }
