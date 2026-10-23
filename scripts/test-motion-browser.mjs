import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { startTestServer } from "./test-server.mjs";

const server = await startTestServer({ agentFixture: true });
const browser = await chromium.launch();
const output = resolve(".artifacts/motion", new Date().toISOString().replaceAll(":", "-"));
await mkdir(output, { recursive: true });
const errors = [], external = [], results = [];
try {
  for (const reducedMotion of ["no-preference", "reduce"]) {
    const context = await browser.newContext({ locale: "fa-IR", reducedMotion });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", (route) => {
      if (new URL(route.request().url()).origin !== server.origin) {
        external.push(new URL(route.request().url()).host);
        return route.abort();
      }
      return route.continue();
    });
    await page.goto(server.origin);
    await page.getByLabel("کلید ورود محلی", { exact: true }).fill(server.token);
    await page.getByRole("button", { name: "ورود به میز کار", exact: true }).click();
    await page.locator(".app-nav").waitFor();
    const indicator = page.locator(".nav-active-indicator");
    assert.equal(await indicator.count(), 1, "One persistent indicator must slide between active tabs");
    assert.equal(await indicator.getAttribute("aria-hidden"), "true");
    for (const width of [280, 360, 559, 560, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(async () => document.fonts.ready);
      await page.waitForFunction(() => {
        const pill = document.querySelector(".nav-active-indicator").getBoundingClientRect();
        const link = document.querySelector('.app-nav-link[aria-current="page"]').getBoundingClientRect();
        return Math.abs(pill.x - link.x) < 1 && Math.abs(pill.width - link.width) < 1 && Math.abs(pill.y - link.y) < 1;
      });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Overflow at ${width}`);
      const before = await page.locator(".app-nav-link").evaluateAll((links) => links.map((link) => {
        const r = link.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      }));
      await page.evaluate(() => {
        window.motionSamples = [];
        document.querySelector(".app-nav").addEventListener("click", () => {
          const start = performance.now();
          function sample() {
            const pill = document.querySelector(".nav-active-indicator");
            const panel = [...document.querySelectorAll("main .panel")].find((e) => e.getBoundingClientRect().height > 0);
            window.motionSamples.push({
              t: performance.now() - start, x: pill.getBoundingClientRect().x,
              moving: pill.getAnimations().some((a) => a.playState === "running"),
              panelY: panel ? new DOMMatrixReadOnly(getComputedStyle(panel).transform).m42 : 0,
            });
            if (performance.now() - start < 400) requestAnimationFrame(sample);
          }
          requestAnimationFrame(sample);
        }, { once: true });
      });
      const inactive = page.locator('.app-nav-link:not([aria-current="page"])').first();
      await inactive.click();
      await page.waitForFunction(() => window.motionSamples.at(-1)?.t >= 400);
      const samples = await page.evaluate(() => window.motionSamples);
      if (reducedMotion === "no-preference") {
        assert.ok(samples.some((s) => s.moving), `No sliding indicator at ${width}`);
        assert.ok(Math.max(...samples.map((s) => s.x)) - Math.min(...samples.map((s) => s.x)) > 20, `Indicator did not travel at ${width}`);
        assert.ok(samples.some((s) => s.panelY > 6), `Tab content entrance is imperceptible at ${width}`);
      } else {
        assert.ok(samples.every((s) => !s.moving && Math.abs(s.panelY) < 0.1), `Reduced motion not respected at ${width}`);
      }
      assert.deepEqual(await page.locator(".app-nav-link").evaluateAll((links) => links.map((link) => {
        const r = link.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      })), before, "Selection must not move or resize navigation controls");
      results.push({ width, reducedMotion, movingFrames: samples.filter((s) => s.moving).length });
    }
    await page.setViewportSize({ width: 280, height: 900 });
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    await page.evaluate(async () => document.fonts.ready);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Overflow at 200% text size");
    await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
    await page.setViewportSize({ width: 1280, height: 900 });
    for (let i = 0; i < 10; i++) await page.locator('.app-nav-link:not([aria-current="page"])').first().click();
    await page.waitForFunction(() => !document.querySelector(".nav-active-indicator").getAnimations().some((a) => a.playState === "running"));
    assert.equal(await page.locator('.app-nav-link[aria-current="page"]').count(), 1);
    await page.getByRole("link", { name: "انتشار پروژه", exact: true }).click();
    const details = page.locator("details.advanced-choice");
    await details.locator("summary").click();
    await page.getByLabel("پوشه پروژه", { exact: true }).click();
    await page.getByLabel("پوشه پروژه", { exact: true }).pressSequentially("examples/node-service", { delay: 10 });
    assert.equal(await page.getByLabel("پوشه پروژه", { exact: true }).inputValue(), "examples/node-service");
    await page.waitForTimeout(280);
    // Sample on the browser clock: host-side sleeps can miss every intermediate frame under load.
    await details.evaluate(node => {
      window.closingSamples = [];
      node.querySelector("summary").addEventListener("click", () => {
        const started = performance.now();
        function sample() {
          const style = getComputedStyle(node, "::details-content");
          window.closingSamples.push({ at: performance.now() - started, opacity: Number(style.opacity), visibility: style.contentVisibility, height: Number.parseFloat(style.blockSize) });
          if (performance.now() - started < 400) requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
      }, { once: true });
    });
    await details.locator("summary").click();
    assert.equal(await details.getAttribute("open"), null);
    await page.waitForFunction(() => window.closingSamples.at(-1)?.at >= 400);
    const closing = await page.evaluate(() => window.closingSamples);
    if (reducedMotion === "no-preference") {
      assert.ok(closing.some(frame => frame.opacity > 0 && frame.opacity < 1 && frame.visibility === "visible"), "Details must visibly fade before disappearing");
      assert.ok(closing.some(frame => frame.height > 0) && closing.at(-1).height === 0, "The accordion must interpolate its height and finish closed");
    } else assert.ok(closing.every(frame => frame.opacity === 0 && frame.height === 0));
    assert.equal(await page.getByLabel("پوشه پروژه", { exact: true }).isVisible(), false);
    await details.locator("summary").click();
    assert.equal(await page.getByLabel("پوشه پروژه", { exact: true }).inputValue(), "examples/node-service");
    for (let i = 0; i < 6; i++) await details.locator("summary").click();
    await details.locator("summary").click();
    await page.getByRole("button", { name: "انتخاب پوشه پروژه", exact: true }).click();
    await page.locator("dialog[open]").waitFor();
    await page.waitForFunction(() => getComputedStyle(document.querySelector(".folder-dialog")).opacity === "1");
    await page.locator(".folder-dialog").evaluate(node => {
      window.dialogSamples = [];
      node.addEventListener("cancel", () => {
        const start = performance.now();
        function sample() {
          window.dialogSamples.push({ at: performance.now() - start, connected: node.isConnected, opacity: Number(getComputedStyle(node).opacity), open: node.open });
          if (performance.now() - start < 400) requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
      }, { once: true });
    });
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => window.dialogSamples.at(-1)?.at >= 400);
    const exit = await page.evaluate(() => window.dialogSamples);
    if (reducedMotion === "no-preference") assert.ok(exit.some(frame => frame.connected && frame.open && frame.opacity > 0 && frame.opacity < 1), "The modal must stay mounted during its visible exit");
    assert.equal(exit.at(-1).connected, false);
    assert.equal(await page.locator("dialog[open]").count(), 0);
    assert.equal(await page.getByRole("button", { name: "انتخاب پوشه پروژه", exact: true }).evaluate(node => node === document.activeElement), true);
    const shine = await page.locator(".assistant-launcher").evaluate(node => getComputedStyle(node, "::after").animationName);
    assert.equal(shine === "none", reducedMotion === "reduce");
    await page.locator(".studio-launch-art").waitFor();
    const floating = page.locator(".studio-cloud-float");
    const initial = await floating.evaluate(node => getComputedStyle(node).transform);
    await page.waitForTimeout(300);
    const after = await floating.evaluate(node => getComputedStyle(node).transform);
    assert.equal(initial === after, reducedMotion === "reduce", "Ambient illustration motion must stop with reduced motion");
    await page.getByRole("button", { name: "باز کردن دستیار هوشمند", exact: true }).click();
    const assistant = page.getByRole("dialog", { name: "دستیار هوشمند", exact: true });
    await assistant.getByRole("textbox").click();
    await assistant.getByRole("textbox").pressSequentially("پیش‌نویس من");
    await assistant.getByRole("button", { name: "بستن دستیار هوشمند", exact: true }).click();
    await page.getByRole("button", { name: "باز کردن دستیار هوشمند", exact: true }).waitFor();
    await page.getByRole("button", { name: "باز کردن دستیار هوشمند", exact: true }).click();
    assert.equal(await assistant.getByRole("textbox").inputValue(), "پیش‌نویس من");
    await assistant.press("Escape");
    await page.getByRole("button", { name: "باز کردن دستیار هوشمند", exact: true }).waitFor();
    await writeFile(resolve(output, `frames-${reducedMotion}.json`), JSON.stringify({ closing, exit, initial, after, shine }, null, 2));
    const violations = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    assert.deepEqual(violations.violations.map((v) => v.id), []);
    await page.screenshot({ path: resolve(output, `tabs-${reducedMotion}.png`) });
    await context.close();
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  await writeFile(resolve(output, "results.json"), JSON.stringify({ results, errors, external }, null, 2));
  console.log(JSON.stringify({ cases: results.length, rapidTabClicks: 20, reducedMotion: true, errors: errors.length, external: external.length, output }));
} finally {
  await browser.close();
  await server.close();
}
