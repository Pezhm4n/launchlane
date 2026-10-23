import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { startTestServer } from "./test-server.mjs";

const server = await startTestServer({ agentFixture: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: "fa-IR", reducedMotion: "reduce" });
const page = await context.newPage();
const output = resolve(".artifacts/studio", new Date().toISOString().replaceAll(":", "-"));
await mkdir(output, { recursive: true });
const errors = [], external = [], posts = [], results = [];
page.on("pageerror", error => errors.push(error.message));
page.on("console", message => {
  if (message.type() === "error" && /hydration|hydrated|server rendered HTML/i.test(message.text())) errors.push(message.text());
});
page.on("request", request => {
  if (request.method() === "POST") posts.push(new URL(request.url()).pathname);
});
await context.route("**/*", route => {
  if (new URL(route.request().url()).origin !== server.origin) {
    external.push(route.request().url());
    return route.abort();
  }
  return route.continue();
});
const launcher = page.getByRole("button", { name: "باز کردن دستیار هوشمند", exact: true });
const dialog = page.getByRole("dialog", { name: "دستیار هوشمند", exact: true });
const chat = dialog.locator(".optional-chat"), input = chat.getByRole("textbox");
async function modelRequests() {
  try { return (await readFile(server.modelLog, "utf8")).split("\n").filter(Boolean).length; }
  catch (error) { if (error.code === "ENOENT") return 0; throw error; }
}
async function layout(width, name, height = 844) {
  await page.setViewportSize({ width, height });
  await page.evaluate(async () => { await document.fonts.ready; scrollTo(0, 0); });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name} at ${width}: page overflow`);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  assert.deepEqual(axe.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) })), [], name);
  results.push({ name, width, height, overflow: false, axeViolations: 0 });
}
async function chatGeometry() {
  const geometry = await dialog.evaluate(node => {
    const box = node.getBoundingClientRect(), form = node.querySelector(".agent-composer"), content = node.querySelector(".assistant-float-content");
    const formBox = form.getBoundingClientRect(), contentBox = content.getBoundingClientRect();
    return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: innerWidth, height: innerHeight,
      composerGap: contentBox.bottom - parseFloat(getComputedStyle(content).paddingBottom) - formBox.bottom,
      panelOverflow: node.scrollWidth > node.clientWidth, formOverflow: form.scrollWidth > form.clientWidth };
  });
  assert.ok(geometry.left >= 19 && geometry.top >= 15 && geometry.right <= geometry.width - 19 && geometry.bottom <= geometry.height - 15, JSON.stringify(geometry));
  assert.ok(Math.abs(geometry.composerGap) < 2, `the composer belongs at the bottom: ${JSON.stringify(geometry)}`);
  assert.equal(geometry.panelOverflow || geometry.formOverflow, false, "the panel and composer fit horizontally");
  const transcript = chat.locator(".agent-transcript");
  if (await transcript.count()) assert.ok(await transcript.evaluate(node => node.clientHeight) >= 44, "messages stay independently readable even with enlarged text");
  await input.scrollIntoViewIfNeeded();
  await input.fill("پیش‌نویس خوانا و قابل ویرایش");
  await chat.getByRole("button", { name: "ارسال درخواست", exact: true }).scrollIntoViewIfNeeded();
  assert.equal(await chat.getByRole("button", { name: "ارسال درخواست", exact: true }).isVisible(), true);
  const sendBox = await chat.getByRole("button", { name: "ارسال درخواست", exact: true }).boundingBox();
  assert.ok(sendBox.y >= geometry.top && sendBox.y + sendBox.height <= geometry.bottom, "send stays inside the visible panel after scrolling the composer");
}
async function openChat() { await launcher.click(); await dialog.waitFor(); await chat.locator(".agent-composer").waitFor(); }
async function closeChat() { await dialog.press("Escape"); await launcher.waitFor(); assert.equal(await launcher.evaluate(node => node === document.activeElement), true); }
try {
  await page.setViewportSize({ width: 360, height: 844 });
  await page.goto(server.origin);
  await page.getByLabel("کلید ورود محلی", { exact: true }).fill(server.token);
  await page.getByRole("button", { name: "ورود به میز کار", exact: true }).click();
  await page.getByRole("heading", { name: "پروژه‌تان را انتخاب کنید", exact: true }).waitFor();
  for (const width of [280, 320, 360, 390, 768, 1101, 1280]) {
    await layout(width, "source-choice");
    const choose = await page.getByRole("button", { name: "انتخاب پوشه پروژه", exact: true }).boundingBox();
    if (width < 768) assert.ok(choose.y + choose.height <= 844, "project choice stays in the first mobile viewport");
    const box = await launcher.boundingBox();
    assert.ok(box.x >= (width < 768 ? 20 : 32) - 1 && box.y + box.height <= 844 - (width < 768 ? 24 : 32) + 1);
    assert.ok(box.height >= 44);
    assert.equal(await launcher.innerText(), width < 768 ? "" : "دستیار هوشمند");
    assert.equal(await launcher.getAttribute("aria-label"), "باز کردن دستیار هوشمند");
    const logo = await page.locator('.studio-provider img[alt="لیارا"]').evaluate(async node => {
      await node.decode(); const box = node.getBoundingClientRect();
      return { loaded: node.naturalWidth > 0, width: box.width, height: box.height };
    });
    assert.ok(logo.loaded && logo.width <= 48 && logo.height <= 24, JSON.stringify(logo));
    if ([360, 1280].includes(width)) await page.screenshot({ path: join(output, `empty-${width}.png`), fullPage: true });
  }
  await page.evaluate(() => document.documentElement.style.fontSize = "200%");
  for (const width of [280, 320, 360]) await layout(width, "source-choice-text-200");
  await page.evaluate(() => document.documentElement.style.fontSize = "");
  await page.setViewportSize({ width: 1280, height: 844 });
  // Motion preferences must preserve the static projection matrices in the illustration.
  for (const motion of ["reduce", "no-preference"]) {
    await page.emulateMedia({ reducedMotion: motion });
    assert.deepEqual(await page.locator(".studio-artboard g[transform]").evaluateAll(nodes => nodes.map(node => getComputedStyle(node).transform === "none")), [false, false]);
    await page.locator(".studio-launch-art").hover();
    await page.waitForFunction(reduced => {
      const matrix = getComputedStyle(document.querySelector(".studio-cloud-tile")).transform;
      return reduced ? matrix === "none" : matrix !== "none";
    }, motion === "reduce");
    await page.mouse.move(0, 0);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "امتحان با پروژه نمونه", exact: true }).click();
  await page.locator("h1").filter({ hasText: "node-service" }).waitFor();
  for (const width of [320, 360, 390, 768, 1280]) {
    await layout(width, "selected-source");
    if ([360, 1280].includes(width)) await page.screenshot({ path: join(output, `selected-${width}.png`), fullPage: true });
  }
  const beforeOpen = posts.length;
  await openChat();
  assert.equal(await chat.getByRole("button", { name: "ارسال درخواست", exact: true }).isDisabled(), true);
  await chat.getByRole("button", { name: "قدم بعدی من چیست؟", exact: true }).click();
  assert.equal(await input.inputValue(), "قدم بعدی من چیست؟");
  assert.equal(await input.evaluate(node => node === document.activeElement), true);
  assert.equal(posts.length, beforeOpen, "opening the panel and choosing a starter must not start work");
  assert.equal(await modelRequests(), 0);
  for (const width of [280, 320, 360, 390, 768, 1280]) {
    await layout(width, "empty-chat", 680); await chatGeometry();
    if ([360, 1280].includes(width)) await page.screenshot({ path: join(output, `chat-empty-${width}.png`) });
  }
  await closeChat(); await openChat();
  assert.equal(await input.inputValue(), "پیش‌نویس خوانا و قابل ویرایش");
  await input.fill("آزمون قالب‌بندی پاسخ");
  await chat.getByRole("button", { name: "ارسال درخواست", exact: true }).click();
  await chat.locator(".md-heading").filter({ hasText: "نتیجه بررسی" }).waitFor();
  assert.equal(await chat.locator(".agent-answer .md-list li").count(), 2);
  const callsAfterAnswer = await modelRequests(); assert.ok(callsAfterAnswer > 0);
  for (const width of [280, 320, 360, 390, 768, 1280]) {
    await layout(width, "chat-history", 680); await chatGeometry();
    const scroll = await chat.locator(".agent-transcript").evaluate(node => {
      const before = node.scrollTop; node.scrollTop = 0; const top = node.scrollTop;
      node.scrollTop = node.scrollHeight; return { before, top, end: node.scrollTop, overflow: getComputedStyle(node).overflowY };
    });
    assert.equal(scroll.overflow, "auto"); assert.ok(scroll.end > scroll.top, "long answers scroll inside the transcript");
    if ([360, 1280].includes(width)) await page.screenshot({ path: join(output, `chat-history-${width}.png`) });
  }
  for (const width of [320, 360, 768, 1280]) { await layout(width, "short-chat", 480); await chatGeometry(); }
  await page.evaluate(() => document.documentElement.style.fontSize = "200%");
  for (const width of [320, 360, 768]) { await layout(width, "chat-text-200", 680); await chatGeometry(); }
  await page.evaluate(() => document.documentElement.style.fontSize = "");
  await closeChat();
  await page.getByRole("link", { name: "بررسی مشکل سایت", exact: true }).click();
  await page.getByRole("button", { name: "امتحان با نمونه اختلال", exact: true }).click();
  await page.getByRole("heading", { name: "نتیجه بررسی نمونه", exact: true }).waitFor();
  for (const width of [280, 320, 360, 390, 768, 1280]) {
    await layout(width, "incident-report");
    if ([360, 1280].includes(width)) await page.screenshot({ path: join(output, `incident-${width}.png`), fullPage: true });
  }
  await page.locator(".sample-comparison > summary").click();
  await page.getByRole("button", { name: "امتحان اصلاح مرتبط در نمونه", exact: true }).click();
  await page.locator(".incident-http").filter({ hasText: "HTTP 200" }).waitFor();
  await page.getByText("فرضیهٔ بررسی قبلی", { exact: false }).waitFor();
  assert.equal(await page.locator(".incident-analysis").evaluate(node => node.open), false, "the previous hypothesis cannot compete with the latest successful observation");
  for (const width of [360, 1101, 1280]) {
    await layout(width, "incident-after-readback");
    await page.screenshot({ path: join(output, `incident-after-${width}.png`), fullPage: true });
  }
  await page.reload(); await openChat();
  assert.equal(await input.inputValue(), "پیش‌نویس خوانا و قابل ویرایش");
  assert.equal(await modelRequests(), callsAfterAnswer, "reopening and reloading cannot replay the model run");
  assert.deepEqual(posts.filter(path => path.startsWith("/api/agent/runs")), ["/api/agent/runs"], "one explicit send starts one conversation");
  assert.equal(posts.some(path => /\/api\/(actions|deployments|restarts|environment|code-repair)/.test(path)), false);
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  await writeFile(join(output, "results.json"), JSON.stringify({ results, errors, external, modelRequests: callsAfterAnswer, provider: "synthetic", realCloudWrites: 0 }, null, 2));
  console.log(JSON.stringify({ states: results.length, browserErrors: errors.length, externalRequests: external.length, modelRequests: callsAfterAnswer, provider: "synthetic", realCloudWrites: 0, output }));
} catch (error) {
  await page.screenshot({ path: join(output, "failure.png"), fullPage: true }).catch(() => undefined);
  await writeFile(join(output, "failure.json"), JSON.stringify({ error: error.message, results, errors, external }, null, 2));
  console.error(`Studio evidence: ${output}`); throw error;
} finally { await context.close(); await browser.close(); await server.close(); }
