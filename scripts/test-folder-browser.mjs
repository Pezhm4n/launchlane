import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, basename } from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { startTestServer } from "./test-server.mjs";
import { editProject, reviewProject } from "./browser-project.mjs";

const directory = await mkdtemp(join(tmpdir(), "launchlane-native-folder-"));
const server = await startTestServer({ workspaceConfigured: false });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: "fa-IR", reducedMotion: "reduce" });
const output = resolve(".artifacts/folder", new Date().toISOString().replaceAll(":", "-"));
const external = [], errors = [], requests = [], states = [];
await context.route("**/*", route => {
  if (new URL(route.request().url()).origin !== server.origin) { external.push(route.request().url()); return route.abort(); }
  return route.continue();
});
context.on("page", page => page.on("pageerror", error => errors.push(error.message)));
const page = await context.newPage();
page.on("request", request => { if (new URL(request.url()).pathname === "/api/projects/upload") requests.push(request.postDataBuffer()); });
try {
  await mkdir(output, { recursive: true }); await mkdir(join(directory, "node_modules/pkg"), { recursive: true });
  const source = "import http from 'node:http'; http.createServer((q,s)=>s.end('ready')).listen(process.env.PORT || 3000);";
  await writeFile(join(directory, "package.json"), JSON.stringify({ engines: { node: "22" }, scripts: { start: "node server.mjs" } }));
  await writeFile(join(directory, "server.mjs"), source);
  await writeFile(join(directory, ".env.local"), "PRIVATE_MARKER_MUST_STAY_ON_DEVICE=fixture-only");
  await writeFile(join(directory, "node_modules/pkg/index.js"), "DEPENDENCY_MARKER_MUST_STAY_ON_DEVICE");
  assert.ok(!directory.startsWith(server.workspace));
  await page.goto(server.origin);
  await page.getByLabel("کلید ورود محلی", { exact: true }).fill(server.token);
  await page.getByRole("button", { name: "ورود به میز کار", exact: true }).click();
  const trigger = () => page.getByRole("button", { name: /^(انتخاب پوشه پروژه|تغییر پوشه پروژه)$/ });
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    if (width === 1280) await editProject(page);
    await trigger().click();
    const dialog = page.getByRole("dialog", { name: "انتخاب پوشه پروژه", exact: true });
    const chooser = page.waitForEvent("filechooser");
    await dialog.getByRole("button", { name: "انتخاب پوشه از رایانه", exact: true }).click();
    await (await chooser).setFiles(directory);
    await dialog.getByRole("heading", { name: basename(directory), exact: true }).waitFor();
    assert.equal(requests.length, width === 360 ? 0 : 1, "selection is a local preview until the user continues");
    await dialog.getByText("۲ فایل قابل بررسی", { exact: false }).waitFor();
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    assert.deepEqual(axe.violations.map(row => row.id), []);
    assert.ok(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1));
    await page.screenshot({ path: join(output, `folder-${width}.png`), fullPage: true });
    await dialog.getByRole("button", { name: "بررسی این پروژه", exact: true }).click();
    await dialog.waitFor({ state: "detached" });
    await reviewProject(page); await page.getByText("فایل‌ها آماده‌اند", { exact: true }).waitFor();
    assert.equal(await readFile(join(directory, "server.mjs"), "utf8"), source);
    await page.reload(); await page.locator(".project-summary").getByText(basename(directory), { exact: true }).waitFor();
    await editProject(page); await trigger().click(); await dialog.press("Escape"); await dialog.waitFor({ state: "detached" });
    assert.equal(await trigger().evaluate(node => document.activeElement === node), true);
    states.push({ width, actualDirectoryChooser: true, outsideWorkspace: true, originalPreserved: true, reload: true, keyboardCancel: true, axeViolations: 0 });
  }
  assert.equal(requests.length, 2);
  for (const body of requests) {
    assert.ok(!body.includes(Buffer.from("PRIVATE_MARKER_MUST_STAY_ON_DEVICE")));
    assert.ok(!body.includes(Buffer.from("DEPENDENCY_MARKER_MUST_STAY_ON_DEVICE")));
  }
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  const result = { states, externalRequests: external.length, pageErrors: errors.length, output };
  await writeFile(join(output, "results.json"), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
} finally {
  await context.close(); await browser.close(); await server.close();
  assert.ok(resolve(directory).startsWith(join(tmpdir(), "launchlane-native-folder-")));
  await rm(directory, { recursive: true, force: true });
}
