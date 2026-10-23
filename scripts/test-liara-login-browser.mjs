import assert from "node:assert/strict";
import { mkdir, writeFile, mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { startTestServer } from "./test-server.mjs";
const server = await startTestServer({ authFixture: true }), browser = await chromium.launch({ headless: true }),
  context = await browser.newContext({ locale: "fa-IR", reducedMotion: "reduce" }), page = await context.newPage(),
  output = resolve(".artifacts/liara-login", new Date().toISOString().replaceAll(":", "-")), errors = [], states = [],
  directory = await mkdtemp(join(tmpdir(), "launchlane-auth-browser-"));
page.on("pageerror", error => errors.push(error.message));
await context.route("**/*", route => new URL(route.request().url()).origin === server.origin ? route.continue() : route.abort());
async function layout(width, label) {
  await page.setViewportSize({ width, height: 900 }); await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, label);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  assert.deepEqual(axe.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })), [], label);
  await page.screenshot({ path: join(output, `${label}-${width}.png`), fullPage: true }); states.push({ label, width, axeViolations: 0 });
}
async function credentials(email = "alice@example.test", password = "synthetic-browser-password") {
  await page.getByLabel("ایمیل حساب لیارا", { exact: true }).fill(email); await page.getByLabel("رمز عبور", { exact: true }).fill(password);
  await page.getByRole("button", { name: "ورود و ادامه", exact: true }).click();
}
async function signOut() {
  const workspace = await page.evaluate(async () => (await fetch("/api/workspace")).json());
  assert.equal(await page.evaluate(async csrf => (await fetch("/api/session", { method: "DELETE", headers: { "x-csrf-token": csrf } })).status, workspace.session.csrfToken), 200);
  await page.goto(server.origin);
}
try {
  await mkdir(output, { recursive: true }); await page.goto(server.origin);
  await page.getByRole("heading", { name: "ورود با حساب لیارا", exact: true }).waitFor();
  for (const width of [280, 320, 390, 768, 1280]) await layout(width, "login");
  assert.equal(await page.getByText("کلید ورود محلی", { exact: true }).count(), 0); assert.equal((await page.content()).includes("operator-access.txt"), false);
  const pass = page.getByLabel("رمز عبور", { exact: true }); await pass.fill("visible-password-fixture");
  await page.getByRole("button", { name: "نمایش رمز عبور", exact: true }).click(); assert.equal(await pass.getAttribute("type"), "text");
  await page.getByRole("button", { name: "پنهان‌کردن رمز عبور", exact: true }).click(); assert.equal(await pass.getAttribute("type"), "password");
  await credentials("alice@example.test", "incorrect-fixture-password"); await page.getByRole("alert").filter({ hasText: "ورود تأیید نشد" }).waitFor();
  assert.equal(await pass.inputValue(), ""); await layout(320, "error");
  await credentials("twofactor@example.test"); await page.getByLabel("کد تأیید دومرحله‌ای", { exact: true }).waitFor();
  assert.equal(await page.getByLabel("کد تأیید دومرحله‌ای", { exact: true }).evaluate(n => n === document.activeElement), true);
  await layout(390, "two-factor"); await page.getByLabel("کد تأیید دومرحله‌ای", { exact: true }).fill("۱۲۳۴۵۶");
  assert.equal(await page.getByLabel("کد تأیید دومرحله‌ای", { exact: true }).inputValue(), "123456");
  await page.getByRole("button", { name: "تأیید کد و ورود", exact: true }).click();
  await page.getByRole("heading", { name: "کجا منتشر می‌کنید؟", exact: true }).waitFor();
  await page.getByRole("button", { name: "فضای آلیس", exact: true }).click(); await page.getByRole("heading", { name: "کجا منتشر می‌کنید؟", exact: true }).waitFor({ state: "detached" });
  await writeFile(join(directory, "package.json"), JSON.stringify({ engines: { node: "22" }, scripts: { start: "node server.mjs" } }));
  await writeFile(join(directory, "server.mjs"), "import http from 'node:http';http.createServer((q,s)=>s.end('ready')).listen(process.env.PORT||3000);");
  await page.getByRole("button", { name: "انتخاب پوشه پروژه", exact: true }).click();
  const folder = page.getByRole("dialog", { name: "انتخاب پوشه پروژه", exact: true }), chooser = page.waitForEvent("filechooser");
  await folder.getByRole("button", { name: "انتخاب پوشه از رایانه", exact: true }).click(); await (await chooser).setFiles(directory);
  await folder.getByRole("button", { name: "بررسی این پروژه", exact: true }).click(); await folder.waitFor({ state: "detached" });
  const aliceProject = await page.evaluate(async () => (await (await fetch("/api/project-flows")).json()).flow.id);
  await page.reload(); assert.equal(await page.evaluate(async () => (await (await fetch("/api/project-flows")).json()).flow.id), aliceProject);
  await layout(1280, "signed-in-project"); await signOut();
  await credentials("bob@example.test"); await page.getByRole("button", { name: "فضای باب", exact: true }).click();
  await page.getByRole("heading", { name: "کجا منتشر می‌کنید؟", exact: true }).waitFor({ state: "detached" });
  const isolation = await page.evaluate(async id => ({ current: (await (await fetch("/api/project-flows")).json()).flow, forbidden: (await fetch(`/api/project-flows?id=${id}`)).status,
    library: await (await fetch("/api/projects/library")).json(), workspace: await (await fetch("/api/workspace")).json() }), aliceProject);
  assert.equal(isolation.current, null); assert.equal(isolation.forbidden, 404); assert.equal(isolation.workspace.capabilities.scope.teamId, "d".repeat(24));
  assert.equal(JSON.stringify(isolation).includes(aliceProject), false);
  await signOut(); await credentials(); await page.getByRole("button", { name: "پروژه‌های من", exact: true }).waitFor();
  assert.equal(await page.evaluate(async () => (await (await fetch("/api/project-flows")).json()).flow.id), aliceProject);
  assert.deepEqual(errors, []); await writeFile(join(output, "result.json"), JSON.stringify({ states, pageErrors: errors, users: 2, projectIsolation: true, liveProvider: false }, null, 2));
  console.log(JSON.stringify({ output, states: states.length, users: 2, projectIsolation: true, pageErrors: errors.length, liveProvider: false }));
} finally { await context.close(); await browser.close(); await server.close(); assert.ok(resolve(directory).startsWith(join(tmpdir(), "launchlane-auth-browser-"))); await rm(directory, { recursive: true, force: true }); }
