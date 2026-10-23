import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { startTestServer } from "./test-server.mjs";

const server = await startTestServer({ agentFixture: true }), browser = await chromium.launch();
const context = await browser.newContext({ locale: "fa-IR", viewport: { width: 375, height: 667 }, reducedMotion: "reduce", permissions: ["clipboard-read", "clipboard-write"] });
const output = resolve(".artifacts/chat-reading", new Date().toISOString().replaceAll(":", "-"));
await mkdir(output, { recursive: true });
const errors = [], external = [], registrations = [], states = [];
let run = null, failOnce = false;
const answer = Array.from({ length: 22 }, (_, i) => `بخش ${i + 1}: این پاسخ برای آزمون خواندن متن بلند است. پروژه را قدم‌به‌قدم بررسی کنید و پیش از هر تغییر، نتیجه و مقصد را ببینید.`).join("\n\n");
await context.addInitScript(() => {
  // Exercise visual-only keyboard resizing independently from layout viewport resizing.
  let size = null;
  const viewport = new EventTarget();
  Object.defineProperties(viewport, {
    height: { get: () => size?.height ?? innerHeight }, width: { get: () => innerWidth },
    offsetTop: { get: () => size?.offset ?? 0 }, offsetLeft: { get: () => 0 }, scale: { get: () => 1 },
  });
  Object.defineProperty(window, "visualViewport", { value: viewport });
  window.chatTestViewport = value => { size = value; viewport.dispatchEvent(new Event("resize")); };
  addEventListener("resize", () => viewport.dispatchEvent(new Event("resize")));
});
await context.route("**/*", route => {
  const url = new URL(route.request().url());
  if (url.origin !== server.origin) { external.push(url.host); return route.abort(); }
  if (!url.pathname.startsWith("/api/agent/runs")) return route.continue();
  if (route.request().method() === "POST") {
    const body = route.request().postDataJSON();
    if (body.operation === "cancel") { run = { ...run, state: "cancelled", revision: run.revision + 1 }; }
    else {
      registrations.push(body);
      if (failOnce) { failOnce = false; return route.fulfill({ status: 503, json: { error: { code: "PROVIDER_UNAVAILABLE", message: "ارتباط آزمایشی کامل نشد؛ دوباره تصمیم بگیرید.", retryable: true, requestId: randomUUID() } } }); }
      run = { id: randomUUID(), revision: 1, projectId: body.projectId, state: "working", nextAction: null, question: null, effect: "no_remote_changes", updatedAt: Date.now(), repair: null, publication: null, destination: null, destinationContinued: false, channel: "conversation",
        events: [{ sequence: 1, kind: "user", message: body.goal, at: Date.now() }, { sequence: 2, kind: "assistant", message: answer, at: Date.now() }] };
    }
  }
  return route.fulfill({ json: { run } });
});
const page = await context.newPage(); page.on("pageerror", error => errors.push(error.message));
const chat = page.getByRole("dialog", { name: "دستیار هوشمند", exact: true }), input = chat.getByRole("textbox"), transcript = chat.getByRole("log");
const send = chat.getByRole("button", { name: "ارسال درخواست", exact: true });
async function audit(name, { width = 375, height = 667, zoom = false, keyboard = null } = {}) {
  await page.setViewportSize({ width, height });
  await page.evaluate(async ({ zoom, keyboard }) => { document.documentElement.style.fontSize = zoom ? "200%" : ""; window.chatTestViewport(keyboard); await document.fonts.ready; }, { zoom, keyboard });
  await page.waitForFunction(() => {
    const panel = document.querySelector(".assistant-float");
    return Math.abs(parseFloat(getComputedStyle(panel).getPropertyValue("--assistant-viewport")) - visualViewport.height) < 1 && (innerWidth >= 768 || Math.abs(panel.getBoundingClientRect().height - visualViewport.height) < 2);
  });
  const geometry = await chat.evaluate(node => {
    const rect = element => { const b = element.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height, right: b.right, bottom: b.bottom }; };
    const log = node.querySelector('[role="log"]'), field = node.querySelector("textarea"), form = node.querySelector("form"), button = node.querySelector('button[type="submit"]'), text = node.querySelector(".agent-answer .rich-text");
    return { panel: rect(node), log: rect(log), input: rect(field), form: rect(form), send: rect(button), overflow: node.scrollWidth > node.clientWidth,
      textFont: parseFloat(getComputedStyle(text).fontSize), textColor: getComputedStyle(text).color, background: getComputedStyle(text.closest("article")).backgroundColor,
      inputFont: parseFloat(getComputedStyle(field).fontSize), copyGlyph: node.querySelector(".agent-message-copy svg").getBoundingClientRect().width, copyTarget: node.querySelector(".agent-message-copy").getBoundingClientRect().height,
      inputDirection: getComputedStyle(field).direction, alignment: getComputedStyle(field).textAlign, inputOverflow: getComputedStyle(field).overflowY,
      visibleTop: visualViewport.offsetTop, visibleBottom: visualViewport.offsetTop + visualViewport.height };
  });
  assert.equal(geometry.overflow, false, name);
  assert.ok(geometry.log.height >= 44 && geometry.send.y >= geometry.panel.y && geometry.send.bottom <= geometry.visibleBottom + 1, JSON.stringify({ name, geometry }));
  if (width < 768) assert.ok(Math.abs(geometry.panel.x) < 1 && Math.abs(geometry.panel.y - geometry.visibleTop) < 1 && Math.abs(geometry.panel.bottom - geometry.visibleBottom) < 1, name);
  if (!zoom && !keyboard && height >= 600) assert.ok(geometry.log.height / geometry.panel.height >= .65 && geometry.form.height <= 100 && geometry.input.height <= 48 && geometry.textFont === 14 && geometry.inputFont === 16 && geometry.copyGlyph <= 14 && geometry.copyTarget >= 44, JSON.stringify({ name, geometry }));
  const lum = color => {
    const values = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => { const x = value / 255; return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; });
    return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
  };
  const first = lum(geometry.textColor), second = lum(geometry.background), contrast = (Math.max(first, second) + .05) / (Math.min(first, second) + .05);
  assert.ok(contrast >= 4.5, `Measured answer contrast: ${contrast}`);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  assert.deepEqual(axe.violations.map(row => ({ id: row.id, nodes: row.nodes.map(node => node.target) })), []);
  states.push({ name, width, height, zoom, keyboard, contrast, ...geometry, axeViolations: 0 });
  await page.screenshot({ path: join(output, `${name}.png`) });
}
try {
  await page.goto(server.origin); await page.getByLabel("کلید ورود محلی", { exact: true }).fill(server.token); await page.getByRole("button", { name: "ورود به میز کار", exact: true }).click();
  await page.getByRole("button", { name: "امتحان با پروژه نمونه", exact: true }).click(); await page.locator(".project-summary").waitFor();
  await page.getByRole("button", { name: "باز کردن دستیار هوشمند", exact: true }).click();
  await input.fill("خواندن پاسخ"); await send.click(); await transcript.getByText("بخش 22:", { exact: false }).waitFor();
  for (const width of [280, 320, 375, 390, 768, 1024, 1440]) await audit(`reading-${width}`, { width });
  for (const width of [280, 375, 768]) await audit(`zoom-${width}`, { width, zoom: true });
  await audit("layout-keyboard", { height: 360 });
  await audit("visual-keyboard", { keyboard: { height: 340, offset: 60 } });
  await audit("reading-return");
  assert.equal(await input.getAttribute("rows"), "1");
  await input.fill(""); assert.equal(await input.evaluate(node => getComputedStyle(node).direction), "rtl");
  await input.fill("console.log('hello')"); assert.equal(await input.evaluate(node => getComputedStyle(node).direction), "ltr");
  await input.fill("متن فارسی"); assert.equal(await input.evaluate(node => getComputedStyle(node).direction), "rtl");
  await input.fill("یک خط\n".repeat(60));
  const grown = await input.boundingBox(); assert.ok(grown.height > 48 && grown.height <= 121);
  await input.fill(""); assert.ok((await input.boundingBox()).height <= 48);
  assert.equal(await chat.locator(".chat-key-hint").isVisible(), false);
  await transcript.evaluate(node => { node.scrollTop = 0; node.dispatchEvent(new Event("scroll")); });
  await chat.getByRole("button", { name: "آخرین پیام", exact: true }).waitFor();
  run = { ...run, revision: 2, events: [...run.events, { sequence: 3, kind: "assistant", message: "پیام تازه برای آزمون حفظ محل خواندن", at: Date.now() }] };
  await chat.getByRole("button", { name: /۱ پیام تازه؛ آخرین پیام/ }).waitFor();
  assert.ok(await transcript.evaluate(node => node.scrollTop < 2), "Incoming messages cannot jump an older reading position");
  await chat.getByRole("button", { name: /آخرین پیام/ }).click();
  assert.ok(await transcript.evaluate(node => node.scrollTop + node.clientHeight >= node.scrollHeight - 2));
  await chat.getByRole("button", { name: "توقف بررسی", exact: true }).click(); await chat.getByText("بررسی متوقف شد", { exact: true }).waitFor();
  assert.equal(await input.isEnabled(), true);
  await input.fill("خط اول"); await input.press("Shift+Enter"); assert.equal(await input.inputValue(), "خط اول\n");
  await input.dispatchEvent("keydown", { key: "Enter", isComposing: true }); assert.equal(registrations.length, 1);
  await input.fill("");
  await chat.getByRole("button", { name: "کپی پاسخ", exact: true }).first().click(); assert.equal((await page.evaluate(() => navigator.clipboard.readText())).replaceAll("\r\n", "\n"), answer);
  await page.setViewportSize({ width: 1440, height: 800 });
  await chat.getByRole("button", { name: "بزرگ‌کردن گفتگو", exact: true }).waitFor();
  const separation = await page.evaluate(() => ({ panel: document.querySelector(".assistant-float").getBoundingClientRect().right, content: document.querySelector(".app-main").getBoundingClientRect().left }));
  assert.ok(separation.content >= separation.panel, JSON.stringify(separation));
  assert.equal(await chat.evaluate(node => node.matches(":modal")), false);
  await page.locator(".brand").focus(); assert.equal(await page.locator(".brand").evaluate(node => node === document.activeElement), true);
  await chat.getByRole("button", { name: "بزرگ‌کردن گفتگو", exact: true }).click();
  const expanded = await chat.boundingBox(); assert.ok(expanded.width >= 800 && expanded.width <= 1000);
  assert.equal(await chat.evaluate(node => node.matches(":modal")), false);
  const centered = await chat.locator(".optional-chat").evaluate(node => {
    const column = node.getBoundingClientRect(), panel = node.closest("dialog").getBoundingClientRect();
    return Math.abs(column.left + column.width / 2 - panel.left - panel.width / 2);
  }); assert.ok(centered < 1, `Expanded conversation center differs by ${centered}px`);
  await page.screenshot({ path: join(output, "expanded-desktop.png") });
  await page.locator(".brand").focus(); assert.equal(await page.locator(".brand").evaluate(node => node === document.activeElement), true);
  const priorMinHeight = await page.locator("main").evaluate(node => { const value = node.style.minHeight; node.style.minHeight = "1800px"; return value; });
  await page.mouse.move(1400, 740); await page.mouse.wheel(0, 450); await page.waitForFunction(() => scrollY > 0);
  await page.locator("main").evaluate((node, value) => { node.style.minHeight = value; scrollTo(0, 0); }, priorMinHeight);
  await chat.getByRole("button", { name: "کوچک‌کردن گفتگو", exact: true }).click();
  await page.setViewportSize({ width: 375, height: 667 });
  await chat.getByRole("button", { name: "گفت‌وگوی تازه", exact: true }).click(); run = null; failOnce = true;
  await input.fill("آزمون خطا و تلاش مجدد"); await send.click(); await chat.getByRole("alert").waitFor();
  const failedKey = registrations.at(-1).requestKey;
  await chat.getByRole("button", { name: "ثبت دوباره همین درخواست", exact: true }).click(); await chat.getByRole("button", { name: "توقف بررسی", exact: true }).waitFor();
  assert.equal(registrations.at(-1).requestKey, failedKey);
  run = { ...run, revision: run.revision + 1, state: "failed" }; await chat.getByText("بررسی کامل نشد", { exact: true }).waitFor();
  await chat.getByRole("button", { name: "دریافت وضعیت ثبت‌شده", exact: true }).click();
  await input.fill("پیش‌نویس باقی می‌ماند");
  const outside = await page.locator(".brand").evaluate(node => node.getBoundingClientRect().height); assert.ok(outside > 0);
  const focusable = await chat.locator("button:visible:not(:disabled),textarea:visible").all();
  await focusable.at(-1).focus(); await page.keyboard.press("Tab");
  assert.equal(await chat.getByRole("button", { name: "بستن دستیار هوشمند", exact: true }).evaluate(node => node === document.activeElement), true);
  await page.keyboard.press("Shift+Tab"); assert.equal(await focusable.at(-1).evaluate(node => node === document.activeElement), true);
  await page.locator(".brand").evaluate(node => node.focus()); assert.equal(await chat.evaluate(node => node.contains(document.activeElement)), true);
  await chat.press("Escape"); const launcher = page.getByRole("button", { name: "باز کردن دستیار هوشمند", exact: true }); await launcher.waitFor(); assert.equal(await launcher.evaluate(node => node === document.activeElement), true);
  await launcher.click(); assert.equal(await input.inputValue(), "پیش‌نویس باقی می‌ماند");
  assert.equal(registrations.length, 3); assert.deepEqual(errors, []); assert.deepEqual(external, []);
  await writeFile(join(output, "results.json"), JSON.stringify({ states, errors, external, noScrollJump: true, retryKeyPreserved: true, cancelled: true, expanded: true, viewportSimulation: true, syntheticResponses: true }, null, 2));
  console.log(JSON.stringify({ states: states.length, errors: 0, external: 0, noScrollJump: true, retryKeyPreserved: true, cancelled: true, expanded: true, viewportSimulation: true, output }));
} catch (error) { await page.screenshot({ path: join(output, "failure.png") }); console.error(`Chat evidence: ${output}`); throw error; }
finally { await context.close(); await browser.close(); await server.close(); }
