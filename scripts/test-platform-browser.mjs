import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { startTestServer } from "./test-server.mjs";

const server = await startTestServer(), browser = await chromium.launch();
const context = await browser.newContext({ locale: "fa-IR", reducedMotion: "reduce" }), page = await context.newPage();
const output = resolve(".artifacts/platform-ui", new Date().toISOString().replaceAll(":", "-")); await mkdir(output, { recursive: true });
const errors = [], external = [], posts = [], states = []; let runtime = "node";
page.on("pageerror", error => errors.push(error.message)); page.on("request", request => { if (request.method() === "POST") posts.push(new URL(request.url()).pathname); });
await context.route("**/*", route => { if (new URL(route.request().url()).origin !== server.origin) { external.push(route.request().url()); return route.abort(); } return route.continue(); });
async function check(width, zoom = false) {
  await page.setViewportSize({ width, height: 800 });
  await page.evaluate(async zoom => { document.documentElement.style.fontSize = zoom ? "200%" : ""; await document.fonts.ready; scrollTo(0, 0); }, zoom);
  const badge = page.locator(".project-summary .platform-badge");
  if (runtime === "unknown") assert.equal(await badge.count(), 0, "Unknown inspection cannot acquire a brand from manifest filenames");
  else {
    assert.equal(await badge.getAttribute("data-platform"), runtime); assert.equal(await badge.isVisible(), true); assert.equal((await badge.textContent()).trim(), runtime === "node" ? "Node.js" : "Python");
    assert.ok(await badge.locator(".platform-mark").evaluate((node, kind) => getComputedStyle(node).maskImage.includes(`/icon/platform/${kind}.svg`), runtime));
    await page.waitForFunction(kind => performance.getEntriesByType("resource").some(entry => entry.name.endsWith(`/icon/platform/${kind}.svg`) && entry.responseEnd > 0), runtime);
  }
  const geometry = await page.evaluate(() => {
    const nav = document.querySelector(".app-nav").getBoundingClientRect();
    return { overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, navCenter: nav.left + nav.width / 2, viewportCenter: document.documentElement.clientWidth / 2, navBottom: nav.bottom, viewportHeight: innerHeight };
  });
  assert.equal(geometry.overflow, false);
  if (width >= 768) assert.ok(Math.abs(geometry.navCenter - geometry.viewportCenter) < 1, JSON.stringify(geometry));
  else assert.ok(Math.abs(geometry.navBottom - geometry.viewportHeight) < 1);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  assert.deepEqual(axe.violations.map(row => ({ id: row.id, nodes: row.nodes.map(node => node.target) })), []);
  states.push({ width, zoom, runtime, ...geometry, axeViolations: 0 });
  await page.screenshot({ path: join(output, `${runtime}-${width}${zoom ? "-zoom" : ""}.png`), fullPage: true });
}
try {
  await page.goto(server.origin); await page.getByLabel("کلید ورود محلی", { exact: true }).fill(server.token); await page.getByRole("button", { name: "ورود به میز کار", exact: true }).click();
  await page.getByRole("button", { name: "امتحان با پروژه نمونه", exact: true }).click(); await page.locator(".project-summary").waitFor();
  for (const width of [375, 768, 1024, 1280, 1920]) await check(width);
  await check(320, true); await page.evaluate(() => document.documentElement.style.fontSize = "");
  await page.route("**/api/project-flows*", async route => {
    const response = await route.fetch(), value = await response.json();
    if (value.flow) { value.flow.profile.runtime = runtime; delete value.flow.profile.pythonRuntime; delete value.flow.profile.nodeRuntime; }
    return route.fulfill({ response, json: value });
  });
  for (runtime of ["python", "unknown"]) { await page.reload(); await page.locator(".project-summary").waitFor(); for (const width of [375, 1024, 1920]) await check(width); }
  assert.equal(posts.some(path => /\/api\/(agent|actions|deployments|restarts)/.test(path)), false); assert.deepEqual(errors, []); assert.deepEqual(external, []);
  await writeFile(join(output, "results.json"), JSON.stringify({ states, errors, external, modelRequests: 0, syntheticProfiles: ["python", "unknown"] }, null, 2));
  console.log(JSON.stringify({ states: states.length, errors: 0, external: 0, modelRequests: 0, output }));
} catch (error) { await page.screenshot({ path: join(output, "failure.png") }); console.error(`Platform evidence: ${output}`); throw error; }
finally { await context.close(); await browser.close(); await server.close(); }
