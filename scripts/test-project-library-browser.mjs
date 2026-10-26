import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { startTestServer } from "./test-server.mjs";
import { Store } from "../src/server/persistence/store.ts";
import { readConfig } from "../src/server/config.ts";
import { AgentRepository, addEvent } from "../src/server/agent/store.ts";
import { currentAgentContext } from "../src/server/agent/tools.ts";
import { sealCredential } from "../src/server/connections/credentials.ts";
import { fingerprint } from "../src/server/policy/action.ts";

const server = await startTestServer({ agentFixture: true, environmentFixture: true, activationFixture: true, workspaceConfigured: false }),
  browser = await chromium.launch({ headless: true }), context = await browser.newContext({ locale: "fa-IR", reducedMotion: "reduce" }),
  page = await context.newPage(), directory = await mkdtemp(join(tmpdir(), "launchlane-library-")), output = resolve(".artifacts/project-library", new Date().toISOString().replaceAll(":", "-")),
  actor = createHash("sha256").update(server.token).digest("hex").slice(0, 24),
  errors = [], external = [], states = [], privateValue = "folder-private-browser-fixture";
let store, repo;
page.on("pageerror", error => errors.push(error.message));
await context.route("**/*", route => new URL(route.request().url()).origin === server.origin ? route.continue() : (external.push(route.request().url()), route.abort()));
const config = readConfig({ LAUNCHLANE_STATE_DIR: server.stateDir, LAUNCHLANE_SESSION_SECRET: server.sessionSecret, LIARA_TEAM_ID: server.teamId });
async function layout(width, label) {
  await page.setViewportSize({ width, height: 900 }); await page.evaluate(async () => document.fonts.ready);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  assert.deepEqual(axe.violations.map(row => ({ id: row.id, targets: row.nodes.map(node => node.target) })), [], label);
  await page.screenshot({ path: join(output, `${label}-${width}.png`), fullPage: true }); states.push({ width, label, axeViolations: 0 });
}
async function library() { await page.getByRole("button", { name: "پروژه‌های من", exact: true }).click(); return page.getByRole("dialog", { name: "پروژه‌های من", exact: true }); }
try {
  await mkdir(server.stateDir, { recursive: true }); store = new Store(join(server.stateDir, "state.sqlite")); repo = new AgentRepository(store);
  await mkdir(output, { recursive: true }); await mkdir(join(directory, "book-service"));
  await writeFile(join(directory, "book-service/package.json"), JSON.stringify({ engines: { node: "22" }, scripts: { start: "node server.mjs" } }));
  await writeFile(join(directory, "book-service/server.mjs"), "import http from 'node:http';const ready=process.env.SERVICE_ACCESS;http.createServer((q,s)=>s.end(ready?'ready':'missing')).listen(process.env.PORT||3000);");
  await writeFile(join(directory, "book-service/.env"), `SERVICE_ACCESS=${privateValue}\nPORT=9876`);
  await page.goto(server.origin); await page.getByLabel("کلید ورود محلی", { exact: true }).fill(server.token); await page.getByRole("button", { name: "ورود به میز کار", exact: true }).click();
  let dialog = await library(); await dialog.getByText("اولین پروژه‌تان را بیاورید", { exact: true }).waitFor(); await layout(320, "empty");
  await dialog.getByRole("button", { name: "انتخاب پروژهٔ تازه", exact: true }).click(); await dialog.waitFor({ state: "detached" });
  await page.getByRole("button", { name: "انتخاب پوشه پروژه", exact: true }).click();
  const folder = page.getByRole("dialog", { name: "انتخاب پوشه پروژه", exact: true });
  const chooser = page.waitForEvent("filechooser"); await folder.getByRole("button", { name: "انتخاب پوشه از رایانه", exact: true }).click(); await (await chooser).setFiles(join(directory, "book-service"));
  await folder.getByText(/تنظیمات از/).waitFor(); await layout(390, "folder-env-preview");
  await folder.getByRole("button", { name: "بررسی این پروژه", exact: true }).click(); await folder.waitFor({ state: "detached" });
  const flow = store.getProjectFlow(actor); assert.equal(flow.selection.kind, "upload");
  assert.deepEqual(flow.profile.manifest.map(row => row.path), ["package.json", "server.mjs"]);
  assert.equal(JSON.stringify(store.db.prepare("SELECT * FROM environment_inputs").all()).includes(privateValue), false);
  store.saveConnection(actor, { source: "token", ciphertext: sealCredential("synthetic-liara-environment-fixture-credential", server.sessionSecret, actor, "liara"), view: {
    provider: "liara", status: "connected", identityId: "b".repeat(24), teamId: server.teamId, teamName: "تیم آزمون", displayName: "آزمون", login: "test@example.test", checkedAt: Date.now(),
    apps: [{ id: "c".repeat(24), name: server.app, platform: "node" }], selectedApp: server.app } });
  const input = { projectId: flow.id, sourceHash: flow.profile.sourceHash, path: "/", expectedText: "ready" }, sourceContext = currentAgentContext(config, store, actor),
    run = repo.create(actor, randomUUID(), sourceContext, "انتشار با تنظیمات پوشه", { maxModelCalls: 8, maxToolCalls: 30, runTimeoutMs: 600000 }, { ...input, kind: "publication", identity: fingerprint({ input, context: sourceContext }) }).run;
  run.state = "needs_input"; run.nextAction = "configure_env";
  addEvent(run, "activity", "خواندن پلن‌های حساب", { tool: "get_account_catalog", callId: "catalog-fixture" });
  addEvent(run, "tool", "خواندن پلن‌های حساب: نتیجه دریافت شد", { tool: "get_account_catalog", callId: "catalog-fixture", outcome: "succeeded" });
  addEvent(run, "activity", "بررسی تنظیمات باقی‌مانده", { tool: "inspect_project", callId: "environment-fixture" });
  addEvent(run, "tool", "بررسی تنظیمات باقی‌مانده: این مرحله کامل نشد", { tool: "inspect_project", callId: "environment-fixture", outcome: "failed" });
  repo.save(actor, run);
  assert.equal(sourceContext.target?.app, server.app);
  await page.reload(); const env = page.locator('section[aria-labelledby="environment-title"]');
  await env.getByRole("button", { name: "مرور و استفاده از تنظیمات پوشه", exact: true }).waitFor();
  await page.getByText("مراحل بررسی", { exact: true }).click();
  assert.equal(await page.locator('li[data-status="succeeded"]').count(), 1);
  assert.equal(await page.locator('li[data-status="failed"]').count(), 1);
  assert.equal(await page.getByText("خواندن پلن‌های حساب: نتیجه دریافت شد", { exact: true }).count(), 0);
  await page.getByText("مراحل بررسی", { exact: true }).click();
  assert.equal((await page.content()).includes(privateValue), false);
  await layout(320, "imported-env");
  await env.getByText("واردکردن یا تغییر دستی مقدارها", { exact: true }).click();
  const manual = env.locator("#environment-SERVICE_ACCESS");
  await manual.fill(privateValue); assert.equal(await manual.getAttribute("type"), "password");
  await env.getByRole("button", { name: "نمایش مقدار SERVICE_ACCESS", exact: true }).click();
  assert.equal(await manual.getAttribute("type"), "text"); assert.equal(await manual.inputValue(), privateValue);
  await env.getByRole("button", { name: "پنهان‌کردن مقدار SERVICE_ACCESS", exact: true }).click();
  assert.equal(await manual.getAttribute("type"), "password");
  await layout(320, "manual-env"); await layout(1280, "manual-env");
  await env.getByRole("button", { name: "مرور تغییر اطلاعات برنامه", exact: true }).click();
  await env.getByRole("button", { name: "رد این تغییر", exact: true }).click();
  await env.getByRole("button", { name: "مرور و استفاده از تنظیمات پوشه", exact: true }).click();
  await env.getByRole("button", { name: "تأیید و اعمال اطلاعات برنامه", exact: true }).click();
  await env.getByText("ذخیرهٔ تنظیمات مقصد بررسی شد. سلامت برنامه هنوز با این نتیجه تأیید نمی‌شود.", { exact: true }).waitFor();
  assert.equal((await page.content()).includes(privateValue), false);
  assert.equal(repo.get(actor, run.id).usage.modelCalls, 0);
  const before = store.db.prepare("SELECT count(*) n FROM agent_runs").get().n;
  dialog = await library(); await dialog.getByText("book-service", { exact: true }).waitFor();
  for (const width of [280, 320, 390, 768, 1280]) await layout(width, "history");
  await dialog.getByRole("button", { name: "بستن پروژه‌های من", exact: true }).click(); await dialog.waitFor({ state: "detached" });
  assert.equal(await page.getByRole("button", { name: "پروژه‌های من", exact: true }).evaluate(node => node === document.activeElement), true);
  // A second project is selected through the same application API; opening history must retain both.
  const second = await page.evaluate(async () => {
    const workspace = await (await fetch("/api/workspace")).json(), response = await fetch("/api/project-flows", { method: "POST", headers: { "content-type": "application/json", "x-csrf-token": workspace.session.csrfToken }, body: JSON.stringify({ operation: "prepare", selection: { kind: "sample", directory: "examples/node-service" } }) });
    if (!response.ok) throw Error("Second project selection failed"); return (await response.json()).flow.id;
  });
  await page.goto(`${server.origin}/?view=publish&project=${second}`); dialog = await library();
  await dialog.getByRole("button", { name: "بازکردن book-service", exact: true }).waitFor();
  assert.equal(await dialog.getByRole("listitem").count(), 2);
  await layout(390, "two-projects"); await layout(1280, "two-projects");
  await dialog.getByRole("button", { name: "بازکردن book-service", exact: true }).click(); await dialog.waitFor({ state: "detached" });
  assert.equal(store.getProjectFlow(actor).id, flow.id); assert.equal(store.getConnection(actor, "liara").view.selectedApp, server.app);
  await page.reload(); assert.equal(new URL(page.url()).searchParams.get("project"), flow.id);
  assert.equal(store.db.prepare("SELECT count(*) n FROM agent_runs").get().n, before);
  // Undeployed history can be removed only through an explicit modal confirmation.
  dialog = await library();
  const secondProject = (await page.request.get(`${server.origin}/api/projects/library`)).ok(); assert.equal(secondProject, true);
  const row = dialog.getByRole("listitem").filter({ hasText: "پوشهٔ این نصب" });
  await row.getByRole("button", { name: /حذف/ }).click();
  let confirmation = page.getByRole("dialog", { name: "پروژه از فهرست حذف شود؟", exact: true });
  assert.equal(await confirmation.getByRole("button", { name: "انصراف از حذف", exact: true }).evaluate(node => node === document.activeElement), true);
  await page.keyboard.press("Escape"); await confirmation.waitFor({ state: "detached" });
  await row.getByRole("button", { name: /حذف/ }).click();
  await confirmation.getByRole("button", { name: "انصراف از حذف", exact: true }).click();
  assert.equal(await dialog.getByRole("listitem").count(), 2);
  await row.getByRole("button", { name: /حذف/ }).click();
  await confirmation.getByRole("button", { name: "بله، از فهرست حذف کن", exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('dialog[open] li').length === 1);
  assert.equal(store.db.prepare("SELECT count(*) n FROM project_archives WHERE project_id=?").get(second).n, 1);
  await dialog.getByRole("button", { name: "بستن پروژه‌های من", exact: true }).click();
  // Stopping and deleting use the real application endpoints with a network-denying synthetic provider.
  const lifecycle = page.locator('details').filter({ has: page.locator('summary', { hasText: "مدیریت مقصد در لیارا" }) }).last();
  await page.getByText("مدیریت مقصد در لیارا", { exact: true }).click();
  await lifecycle.getByRole("button", { name: "توقف برنامه…", exact: true }).click();
  await lifecycle.getByRole("button", { name: "انصراف", exact: true }).waitFor();
  assert.equal((await readFile(server.modelLog, "utf8")).includes('"lifecycleWrite"'), false);
  await lifecycle.getByRole("button", { name: "تأیید توقف برنامه", exact: true }).click();
  await lifecycle.getByText("توقف و نبود نمونهٔ اجرایی تأیید شد.", { exact: true }).waitFor();
  await layout(390, "stopped-app");
  await lifecycle.getByRole("button", { name: "روشن‌کردن برنامه…", exact: true }).click();
  await lifecycle.getByText("برنامه را با پلن فعلی روشن کنیم؟", { exact: true }).waitFor();
  await lifecycle.getByText(/هزینهٔ پایه:/).waitFor();
  await page.waitForFunction(() => document.activeElement?.textContent === "انصراف");
  const beforeStart = (await readFile(server.modelLog, "utf8")).trim().split("\n").filter(Boolean).map(line => JSON.parse(line));
  assert.equal(beforeStart.filter(row => row.lifecycleWrite === "start").length, 0);
  await layout(320, "start-confirmation"); await layout(1280, "start-confirmation");
  await lifecycle.getByRole("button", { name: "انصراف", exact: true }).press("Enter");
  await lifecycle.getByRole("button", { name: "روشن‌کردن برنامه…", exact: true }).click();
  await lifecycle.getByRole("button", { name: "تأیید هزینه و روشن‌کردن برنامه", exact: true }).click();
  await lifecycle.getByText("روشن‌بودن برنامه در تنظیمات لیارا ثبت شد. پاسخ سایت هنوز تأیید نشده است.", { exact: true }).waitFor();
  await page.reload(); await page.getByText("مدیریت مقصد در لیارا", { exact: true }).click();
  await lifecycle.getByText("روشن‌بودن برنامه در تنظیمات لیارا ثبت شد. پاسخ سایت هنوز تأیید نشده است.", { exact: true }).waitFor();
  await lifecycle.getByRole("button", { name: "فعال‌کردن نشانی عمومی…", exact: true }).click();
  await lifecycle.getByText("نشانی عمومی برنامه را فعال کنیم؟", { exact: true }).waitFor();
  await lifecycle.getByText("https://sample-node.liara.run", { exact: true }).waitFor();
  await layout(390, "public-origin-confirmation");
  await lifecycle.getByRole("button", { name: "تأیید فعال‌کردن نشانی عمومی", exact: true }).click();
  await lifecycle.getByText("نشانی عمومی در تنظیمات لیارا فعال شد. پاسخ سایت هنوز تأیید نشده است.", { exact: true }).waitFor();
  // Preserve the successful activation oracle above, then exercise a distinct lost-response request.
  await writeFile(server.activationFailureMarker, "controlled synthetic provider failure");
  await lifecycle.getByRole("button", { name: "فعال‌کردن نشانی عمومی…", exact: true }).click();
  await lifecycle.getByRole("button", { name: "تأیید فعال‌کردن نشانی عمومی", exact: true }).click();
  await lifecycle.getByRole("status").filter({ hasText: "نتیجه هنوز قطعی نیست" }).waitFor();
  const uncertain = store.db.prepare("SELECT id,state FROM actions WHERE actor_id=? AND json_extract(spec,'$.version')=24 AND json_extract(spec,'$.operation')='enable_default_subdomain' ORDER BY rowid DESC LIMIT 1").get(actor);
  assert.equal(uncertain.state, "uncertain");
  await layout(390, "uncertain-public-origin");
  const cleanup = lifecycle.getByRole("button", { name: "مرور توقف برای پاک‌سازی مقصد…", exact: true });
  await cleanup.waitFor({ timeout: 5000 }); await cleanup.click();
  await lifecycle.getByRole("button", { name: "انصراف", exact: true }).waitFor();
  await layout(320, "compensating-stop-confirmation");
  await lifecycle.getByRole("button", { name: "تأیید توقف برنامه", exact: true }).click();
  await lifecycle.getByText("توقف و نبود نمونهٔ اجرایی تأیید شد.", { exact: true }).waitFor();
  await lifecycle.getByRole("button", { name: "حذف مقصد از لیارا…", exact: true }).click();
  await lifecycle.getByRole("button", { name: "تأیید حذف دائمی مقصد", exact: true }).click();
  await lifecycle.getByText("مقصد از لیارا حذف شد", { exact: true }).waitFor();
  assert.equal(store.getAction(uncertain.id, actor).state, "cancelled");
  assert.equal(store.getAction(uncertain.id, actor).errorCode, "DESTINATION_REMOVED");
  await page.reload(); await page.getByText("مدیریت مقصد در لیارا", { exact: true }).click();
  await page.getByText("مقصد از لیارا حذف شد", { exact: true }).waitFor();
  dialog = await library(); await dialog.getByRole("button", { name: "حذف book-service", exact: true }).click();
  confirmation = page.getByRole("dialog", { name: "پروژه از فهرست حذف شود؟", exact: true });
  await layout(320, "remove-confirmation");
  await confirmation.getByRole("button", { name: "بله، از فهرست حذف کن", exact: true }).click();
  await dialog.getByText("اولین پروژه‌تان را بیاورید", { exact: true }).waitFor();
  assert.equal(store.getProjectFlow(actor), null);
  const logs = (await readFile(server.modelLog, "utf8")).trim().split("\n").filter(Boolean).map(line => JSON.parse(line));
  assert.equal(logs.filter(row => row.environmentWrite).length, 1); assert.equal(logs.filter(row => row.model).length, 0);
  assert.deepEqual(logs.filter(row => row.lifecycleWrite).map(row => row.lifecycleWrite), ["stop", "start", "enable_default_subdomain", "enable_default_subdomain_uncertain", "stop", "delete"]);
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  await writeFile(join(output, "results.json"), JSON.stringify({ states, modelRequests: 0, syntheticEnvironmentWrites: 1, liveCloudWrites: 0, errors, external }, null, 2));
  console.log(JSON.stringify({ states: states.length, modelRequests: 0, syntheticEnvironmentWrites: 1, output }));
} catch (cause) {
  await page.screenshot({ path: join(output, "failure.png"), fullPage: true }).catch(() => undefined);
  throw cause;
} finally {
  store?.close(); await context.close(); await browser.close(); await server.close();
  assert.ok(resolve(directory).startsWith(join(tmpdir(), "launchlane-library-"))); await rm(directory, { recursive: true, force: true });
}
