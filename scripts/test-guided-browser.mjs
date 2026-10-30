import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, cp } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { startTestServer } from "./test-server.mjs";
import { Store } from "../src/server/persistence/store.ts";
import { AgentRepository } from "../src/server/agent/store.ts";
import { readConfig } from "../src/server/config.ts";
import { CodeRepairAdapter } from "../src/server/agent/code-repair.ts";
import { currentAgentContext } from "../src/server/agent/tools.ts";
import { projectBuildImage } from "../src/contracts/project-build.ts";
import { fingerprint } from "../src/server/policy/action.ts";
import { sealCredential } from "../src/server/connections/credentials.ts";
import { currentEnvironment } from "../src/server/environment/secrets.ts";
import { cancelAgentRun } from "../src/server/agent/runs.ts";

const server = await startTestServer({ agentFixture: true, environmentFixture: true }), browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: "fa-IR", reducedMotion: "reduce" }), page = await context.newPage();
const output = resolve(".artifacts/guided-publication", new Date().toISOString().replaceAll(":", "-"));
await mkdir(output, { recursive: true });
const errors = [], external = [], results = [], posts = [];
page.on("pageerror", error => errors.push(error.message));
page.on("request", request => { if (request.method() === "POST") posts.push(new URL(request.url()).pathname); });
await context.route("**/*", route => {
  if (new URL(route.request().url()).origin !== server.origin) { external.push(route.request().url()); return route.abort(); }
  return route.continue();
});
const journey = page.locator(".publication-journey"), chat = page.locator(".assistant-float .optional-chat"), launcher = page.getByRole("button", { name: "باز کردن دستیار هوشمند", exact: true });
let store;
async function modelRequests() {
  try { return (await readFile(server.modelLog, "utf8")).trim().split("\n").filter(Boolean).length; } catch { return 0; }
}
async function layout(width, name, height = 844) {
  await page.setViewportSize({ width, height });
  await page.evaluate(async () => { await document.fonts.ready; window.scrollTo(0, 0); });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  const outside = overflow ? await page.evaluate(() => [...document.querySelectorAll("body *")].map(node => {
    const bounds = node.getBoundingClientRect();
    return { tag: node.tagName, id: node.id, className: (node.getAttribute("class") ?? "").slice(0, 160), left: bounds.left, right: bounds.right, width: bounds.width };
  }).filter(bounds => bounds.left < -1 || bounds.right > innerWidth + 1).slice(-12)) : [];
  assert.equal(overflow, false, `${name}: overflow at ${width}px ${JSON.stringify(outside)}`);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  assert.deepEqual(axe.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) })), [], name);
  results.push({ width, height, name, axeViolations: 0, overflow: false });
}
async function openChat() { await launcher.click(); await page.getByRole("dialog", { name: "دستیار هوشمند", exact: true }).waitFor(); }
async function closeChat() { await page.getByRole("button", { name: "بستن دستیار هوشمند", exact: true }).click(); await launcher.waitFor(); }
async function freshChat() { const fresh = chat.getByRole("button", { name: "گفت‌وگوی تازه", exact: true }); if (await fresh.count()) await fresh.click(); }
async function sendQuestion(text) { await chat.getByRole("textbox").fill(text); await chat.getByRole("button", { name: "ارسال درخواست", exact: true }).click(); }
try {
  await page.setViewportSize({ width: 360, height: 844 });
  await page.goto(server.origin);
  await page.getByLabel("کلید ورود محلی", { exact: true }).fill(server.token);
  await page.getByRole("button", { name: "ورود به میز کار", exact: true }).click();
  await page.getByRole("heading", { name: "پروژه‌تان را انتخاب کنید", exact: true }).waitFor();
  await page.waitForURL(url => url.searchParams.get("view") === "publish");
  assert.equal(new URL(page.url()).searchParams.get("view"), "publish");
  assert.equal(await page.locator(".app-nav a").count(), 2);
  assert.equal(await page.getByRole("link", { name: "دستیار پروژه", exact: true }).count(), 0);
  assert.equal(await page.locator(".agent-composer:visible").count(), 0);
  assert.equal(await modelRequests(), 0);
  for (const width of [320, 360, 390, 768, 1280]) { await layout(width, "default-publication"); await page.screenshot({ path: join(output, `empty-${width}.png`), fullPage: true }); }
  await openChat();
  await chat.getByRole("textbox").fill("پیش‌نویس درباره پروژه");
  await page.getByRole("dialog", { name: "دستیار هوشمند", exact: true }).press("Escape");
  await launcher.waitFor();
  assert.equal(await launcher.evaluate(node => node === document.activeElement), true);
  const beforeNavigation = posts.length;
  await page.getByRole("link", { name: "بررسی مشکل سایت", exact: true }).click();
  await openChat(); assert.equal(await chat.getByRole("textbox").inputValue(), "پیش‌نویس درباره پروژه"); await closeChat();
  await page.goBack();
  assert.equal(posts.length, beforeNavigation);
  assert.equal(await modelRequests(), 0);
  await page.goto(`${server.origin}/?view=agent&project=invalid`);
  await page.getByRole("heading", { name: "پروژه‌تان را انتخاب کنید", exact: true }).waitFor();
  await page.waitForURL(url => url.searchParams.get("view") === "publish");
  assert.equal(new URL(page.url()).searchParams.get("view"), "publish"); assert.equal(new URL(page.url()).searchParams.get("project"), null);
  assert.equal(await page.locator(".assistant-float[open]").count(), 0);
  const choose = page.getByRole("button", { name: "انتخاب پوشه پروژه", exact: true });
  await choose.click(); const picker = page.getByRole("dialog", { name: "انتخاب پوشه پروژه", exact: true });
  await picker.press("Escape"); await picker.waitFor({ state: "detached" }); assert.equal(await choose.evaluate(node => node === document.activeElement), true);
  await page.getByRole("button", { name: "امتحان با پروژه نمونه", exact: true }).click();
  await page.locator("h1").filter({ hasText: "node-service" }).waitFor();
  await journey.getByText("در حال بازیابی وضعیت…", { exact: true }).waitFor({ state: "hidden" });
  const selected = new URL(page.url()).searchParams.get("project"); assert.ok(selected);
  assert.equal(await page.locator(".project-choice:visible").count(), 0);
  assert.equal(await page.locator(".agent-composer:visible").count(), 0);
  await journey.getByRole("button", { name: "بررسی و آماده‌سازی انتشار", exact: true }).click();
  await journey.locator(".badge").filter({ hasText: "منتظر پاسخ شما" }).waitFor();
  const actor = createHash("sha256").update(server.token).digest("hex").slice(0, 24);
  store = new Store(join(server.stateDir, "state.sqlite")); const repo = new AgentRepository(store);
  const run = repo.forProject(actor, selected, "publication"); assert.ok(run?.mission); assert.equal(run.effect, "no_remote_changes");
  assert.equal(await journey.getByRole("button", { name: "بررسی و آماده‌سازی انتشار", exact: true }).count(), 0, "a missing account has exactly one current action");
  await journey.getByRole("button", { name: "اتصال حساب", exact: true }).waitFor();
  for (const width of [320, 360, 390, 768, 1280]) await layout(width, "needs-account-without-chat");
  const previousCalls = await modelRequests(); await page.reload(); await journey.locator(".badge").filter({ hasText: "منتظر پاسخ شما" }).waitFor(); assert.equal(await modelRequests(), previousCalls);
  const pendingPublication = repo.get(actor, run.id); pendingPublication.state = "queued"; pendingPublication.nextAction = null; repo.save(actor, pendingPublication);
  const stoppedPublication = cancelAgentRun(store, actor, run.id, pendingPublication.revision);
  await page.reload(); await journey.getByRole("button", { name: "ادامه انتشار پس از توقف", exact: true }).waitFor();
  assert.equal(await modelRequests(), previousCalls); await layout(320, "cancelled-publication-has-a-next-action");
  await journey.getByRole("button", { name: "ادامه انتشار پس از توقف", exact: true }).click();
  await journey.locator(".badge").filter({ hasText: "منتظر پاسخ شما" }).waitFor();
  const resumedPublication = repo.get(actor, run.id); assert.equal(resumedPublication.id, run.id);
  assert.deepEqual(resumedPublication.limits, stoppedPublication.limits); assert.ok(resumedPublication.usage.modelCalls > stoppedPublication.usage.modelCalls);
  assert.equal(store.db.prepare("SELECT COUNT(*) n FROM agent_runs WHERE json_extract(data_json,'$.mission.kind')='publication'").get().n, 1);
  await openChat();
  await sendQuestion("آزمون قالب‌بندی پاسخ"); await chat.locator(".md-heading").filter({ hasText: "نتیجه بررسی" }).waitFor();
  assert.equal(await chat.locator(".agent-answer .md-list li").count(), 2); assert.equal(await chat.locator(".agent-answer img").count(), 0);
  assert.equal(await chat.locator(".code-block pre").getAttribute("dir"), "ltr");
  assert.equal(repo.forProject(actor, selected, "publication").id, run.id);
  assert.equal(await journey.locator(".badge").filter({ hasText: "منتظر پاسخ شما" }).count() > 0, true);
  for (const width of [320, 360, 390, 768, 1280]) {
    await layout(width, "optional-chat-with-history", 680);
    await page.screenshot({ path: join(output, `chat-${width}.png`), fullPage: true });
  }
  await page.evaluate(() => document.documentElement.style.fontSize = "200%"); await layout(360, "chat-text-200", 680); await page.evaluate(() => document.documentElement.style.fontSize = "");
  await freshChat(); await sendQuestion("آزمون خطای ارتباط"); await chat.locator(".badge").filter({ hasText: "بررسی کامل نشد" }).waitFor();
  assert.equal(repo.forProject(actor, selected, "conversation").errorCode, "PROVIDER_RATE_LIMIT");
  assert.equal(repo.forProject(actor, selected, "publication").id, run.id);
  await freshChat(); await sendQuestion("آزمون توقف"); await chat.getByRole("button", { name: "توقف بررسی", exact: true }).click(); await chat.locator(".badge").filter({ hasText: "بررسی متوقف شد" }).waitFor();
  const cancelledCount = await modelRequests(); await closeChat(); await page.reload(); await openChat(); await chat.locator(".badge").filter({ hasText: "بررسی متوقف شد" }).waitFor(); assert.equal(await modelRequests(), cancelledCount);
  await layout(320, "cancelled-chat-preserves-mission", 480); await closeChat();
  await page.goto(`${server.origin}/?view=agent&project=${selected}`); await journey.locator(".badge").filter({ hasText: "منتظر پاسخ شما" }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("project"), selected); assert.equal(await modelRequests(), cancelledCount);
  assert.equal(store.db.prepare("SELECT COUNT(*) n FROM attempts").get().n, 0);
  assert.equal(store.db.prepare("SELECT COUNT(*) n FROM code_repair_jobs").get().n, 0);
  await cp(resolve("tests/fixtures/locked-node-build"), join(server.workspace, "built-service"), { recursive: true });
  const built = await page.evaluate(async () => {
    const workspace = await (await fetch("/api/workspace")).json();
    const response = await fetch("/api/project-flows", { method: "POST", headers: { "content-type": "application/json", "x-csrf-token": workspace.session.csrfToken },
      body: JSON.stringify({ operation: "prepare", selection: { kind: "local", directory: "built-service" } }) });
    if (!response.ok) throw Error("Build fixture selection failed"); return (await response.json()).flow;
  });
  const config = readConfig({ LAUNCHLANE_STATE_DIR: server.stateDir, LAUNCHLANE_WORKSPACE_ROOT: server.workspace, LAUNCHLANE_SESSION_SECRET: server.sessionSecret });
  const build = { version: 1, nodeVersion: "22", image: projectBuildImage, buildCommand: built.profile.build, testCommand: "node --test invoice.test.mjs", startCommand: built.profile.start, port: built.profile.port,
    workload: { path: "/orders", status: 200, assertion: { kind: "json", field: "total", equals: 73 } } };
  const job = await new CodeRepairAdapter(config, store).propose(actor, { projectId: built.id, expectedSourceHash: built.profile.sourceHash,
    goal: "بررسی ساخت و پاسخ برنامه", allowedPaths: [], testFiles: [], execution: "container", build, validationOnly: true }, AbortSignal.timeout(5000));
  const input = { projectId: built.id, sourceHash: built.profile.sourceHash, path: "/orders", expectedText: null }, sourceContext = currentAgentContext(config, store, actor);
  const proposed = repo.create(actor, crypto.randomUUID(), sourceContext, "انتشار پروژه با ساخت قفل‌شده", { maxModelCalls: 16, maxToolCalls: 80, runTimeoutMs: 600000 },
    { ...input, kind: "publication", identity: fingerprint({ input, context: sourceContext }) }).run;
  proposed.repair = job; proposed.state = "needs_approval";
  proposed.repairDecision = { sessionId: store.db.prepare("SELECT id FROM sessions WHERE actor_id=?").get(actor).id, expiresAt: Date.now() + 600000, consumed: false };
  repo.save(actor, proposed);
  await page.goto(`${server.origin}/?view=publish&project=${built.id}`);
  await journey.getByRole("button", { name: "تأیید ساخت و بررسی برنامه", exact: true }).waitFor();
  for (const width of [320, 360, 390, 768, 1280]) {
    await layout(width, "locked-build-decision-without-chat");
    if (width === 360) await page.screenshot({ path: join(output, "build-decision-360.png"), fullPage: true });
  }
  assert.equal(await page.locator(".assistant-float[open]").count(), 0);
  await journey.locator(".agent-repair summary").click();
  await layout(320, "locked-build-command-details");
  await page.screenshot({ path: join(output, "build-details-320.png"), fullPage: true });
  assert.match(await journey.locator(".agent-repair code").textContent(), /npm ci --offline/);
  await journey.getByRole("button", { name: "رد آماده‌سازی", exact: true }).click();
  await journey.locator(".badge").filter({ hasText: "منتظر پاسخ شما" }).waitFor();
  const rejected = repo.get(actor, proposed.id); assert.equal(rejected.repair.state, "cancelled"); assert.deepEqual(rejected.repair.containerIds, []);
  await journey.getByRole("button", { name: "ادامه همان مأموریت", exact: true }).waitFor();
  assert.equal(await modelRequests(), cancelledCount); assert.equal(store.db.prepare("SELECT COUNT(*) n FROM attempts").get().n, 0);
  await mkdir(join(server.workspace, "environment-service"));
  await writeFile(join(server.workspace, "environment-service/package.json"), JSON.stringify({ name: "environment-service", version: "1.0.0", type: "module", engines: { node: "22.x" }, scripts: { build: "node build.mjs", start: "node server.mjs" } }));
  await writeFile(join(server.workspace, "environment-service/package-lock.json"), JSON.stringify({ name: "environment-service", version: "1.0.0", lockfileVersion: 3, packages: { "": { name: "environment-service", version: "1.0.0", engines: { node: "22.x" } } } }));
  await writeFile(join(server.workspace, "environment-service/build.mjs"), "console.log('build fixture');");
  await writeFile(join(server.workspace, "environment-service/server.mjs"), "import http from 'node:http'; const ready=process.env.SERVICE_ACCESS; const publicApi=process.env.NEXT_PUBLIC_WEB_API; const synchronizationApi=process.env.NEXT_PUBLIC_ACCOUNT_SYNCHRONIZATION_SERVICE_API; http.createServer((_req,res)=>res.end(ready?'ready':'missing')).listen(3000);");
  const envFlow = await page.evaluate(async () => {
    const workspace = await (await fetch("/api/workspace")).json();
    const response = await fetch("/api/project-flows", { method: "POST", headers: { "content-type": "application/json", "x-csrf-token": workspace.session.csrfToken }, body: JSON.stringify({ operation: "prepare", selection: { kind: "local", directory: "environment-service" } }) });
    if (!response.ok) throw Error("Environment fixture selection failed"); return (await response.json()).flow;
  });
  store.saveConnection(actor, { source: "token", ciphertext: sealCredential("synthetic-liara-environment-fixture-credential", server.sessionSecret, actor, "liara"), view: {
    provider: "liara", status: "connected", identityId: "b".repeat(24), teamId: server.teamId, teamName: "تیم آزمون", displayName: "آزمون", login: "test@example.test", checkedAt: Date.now(),
    apps: [{ id: "c".repeat(24), name: server.app, platform: "node" }], selectedApp: server.app } });
  const envConfig = { ...config, teamId: server.teamId }, envContext = currentAgentContext(envConfig, store, actor), envIntent = { projectId: envFlow.id, sourceHash: envFlow.profile.sourceHash, path: "/", expectedText: "ready" };
  const envRun = repo.create(actor, crypto.randomUUID(), envContext, "انتشار پروژه با اطلاعات امن", { maxModelCalls: 16, maxToolCalls: 80, runTimeoutMs: 600000 }, { ...envIntent, kind: "publication", identity: fingerprint({ input: envIntent, context: envContext }) }).run;
  envRun.state = "needs_input"; envRun.nextAction = "configure_env"; envRun.question = "اطلاعات لازم را در فرم امن تکمیل کنید."; repo.save(actor, envRun);
  await page.goto(`${server.origin}/?view=publish&project=${envFlow.id}`);
  const envPanel = page.locator('section[aria-labelledby="environment-title"]');
  await envPanel.getByLabel("SERVICE_ACCESS", { exact: true }).waitFor();
  assert.equal(await launcher.isVisible(), false, "secret entry must not overlap optional chat");
  assert.equal(await journey.getByRole("button", { name: "دیدن بررسی پروژه و ادامه انتشار", exact: true }).count(), 0);
  assert.equal(await journey.getByRole("button", { name: "ادامه همان مأموریت", exact: true }).count(), 0);
  const privateValue = "new-private-environment-fixture";
  await envPanel.getByLabel("SERVICE_ACCESS", { exact: true }).fill(privateValue);
  assert.equal(await envPanel.getByLabel("SERVICE_ACCESS", { exact: true }).getAttribute("type"), "password");
  async function fillPublicEnvironment() {
    await envPanel.getByLabel("NEXT_PUBLIC_WEB_API", { exact: true }).fill("https://public.example.test");
    await envPanel.getByRole("checkbox", { name: "عمومی بودن NEXT_PUBLIC_WEB_API", exact: true }).check();
    await envPanel.getByLabel("NEXT_PUBLIC_ACCOUNT_SYNCHRONIZATION_SERVICE_API", { exact: true }).fill("https://sync.example.test");
    await envPanel.getByRole("checkbox", { name: "عمومی بودن NEXT_PUBLIC_ACCOUNT_SYNCHRONIZATION_SERVICE_API", exact: true }).check();
  }
  await envPanel.getByLabel("NEXT_PUBLIC_WEB_API", { exact: true }).fill("https://public.example.test");
  assert.equal(await envPanel.getByRole("button", { name: "مرور تغییر اطلاعات برنامه", exact: true }).isDisabled(), true);
  await layout(320, "public-client-environment-requires-declaration");
  await fillPublicEnvironment();
  for (const width of [320, 360, 390, 768, 1280]) await layout(width, "secure-environment-form");
  await page.setViewportSize({ width: 360, height: 844 }); await page.screenshot({ path: join(output, "environment-form-360.png"), fullPage: true });
  await envPanel.getByRole("button", { name: "مرور تغییر اطلاعات برنامه", exact: true }).click();
  await envPanel.getByRole("button", { name: "تأیید و اعمال اطلاعات برنامه", exact: true }).waitFor();
  await envPanel.getByText(/این کلیدها در خروجی مرورگر عمومی خواهند بود/).waitFor();
  assert.equal(await page.getByText(privateValue, { exact: true }).count(), 0);
  const beforeEnvReload = await modelRequests(); await page.reload();
  await envPanel.getByRole("button", { name: "تأیید و اعمال اطلاعات برنامه", exact: true }).waitFor(); assert.equal(await modelRequests(), beforeEnvReload);
  assert.equal(await envPanel.locator('input[type="password"]').count(), 0);
  await layout(320, "secure-environment-review"); await page.screenshot({ path: join(output, "environment-review-320.png"), fullPage: true });
  const firstEnv = store.getAction(store.getProjectFlow(actor).actionId, actor); store.decide(firstEnv.id, actor, "previous-browser-session", firstEnv.hash, "approve");
  await page.reload(); await envPanel.getByRole("button", { name: "اجرای تغییر تأییدشده", exact: true }).waitFor();
  await envPanel.getByRole("button", { name: "اجرای تغییر تأییدشده", exact: true }).click();
  await envPanel.getByRole("alert").filter({ hasText: "نشست دیگری" }).waitFor();
  await layout(320, "old-session-environment-consent");
  await envPanel.getByRole("button", { name: "لغو تصمیم و مرور دوباره", exact: true }).click();
  await envPanel.getByLabel("SERVICE_ACCESS", { exact: true }).waitFor(); assert.equal(await envPanel.getByLabel("SERVICE_ACCESS", { exact: true }).inputValue(), "");
  await envPanel.getByLabel("SERVICE_ACCESS", { exact: true }).fill(privateValue); await fillPublicEnvironment(); await envPanel.getByRole("button", { name: "مرور تغییر اطلاعات برنامه", exact: true }).click();
  await envPanel.getByRole("button", { name: "تأیید و اعمال اطلاعات برنامه", exact: true }).waitFor();
  const unsent = store.getAction(store.getProjectFlow(actor).actionId, actor), ownSession = store.db.prepare("SELECT id FROM sessions WHERE actor_id=?").get(actor).id;
  store.decide(unsent.id, actor, ownSession, unsent.hash, "approve"); store.claim(unsent.id, actor, ownSession, unsent.spec);
  await page.reload(); await envPanel.getByRole("button", { name: "دریافت وضعیت همین تغییر", exact: true }).waitFor();
  assert.equal(await envPanel.getByRole("button", { name: "اجرای تغییر تأییدشده", exact: true }).count(), 0);
  await layout(360, "in-flight-environment-is-read-only");
  store.recoverInterrupted(); await envPanel.getByRole("button", { name: "دریافت وضعیت همین تغییر", exact: true }).click();
  await envPanel.getByRole("button", { name: "بررسی نتیجه همین تغییر", exact: true }).click();
  await envPanel.getByLabel("SERVICE_ACCESS", { exact: true }).waitFor(); assert.equal(store.getAction(unsent.id, actor).state, "failed");
  await envPanel.getByLabel("SERVICE_ACCESS", { exact: true }).fill(privateValue); await fillPublicEnvironment(); await envPanel.getByRole("button", { name: "مرور تغییر اطلاعات برنامه", exact: true }).click();
  await envPanel.getByRole("button", { name: "تأیید و اعمال اطلاعات برنامه", exact: true }).waitFor();
  await envPanel.getByRole("button", { name: "تأیید و اعمال اطلاعات برنامه", exact: true }).click();
  await envPanel.getByRole("button", { name: "ادامه بررسی و انتشار", exact: true }).waitFor();
  const envActionId = store.db.prepare("SELECT id FROM actions WHERE json_extract(spec,'$.version')=9 ORDER BY rowid DESC LIMIT 1").get().id;
  assert.equal(store.getAction(envActionId, actor).state, "succeeded");
  assert.equal((await readFile(server.modelLog, "utf8")).includes(privateValue), false);
  assert.equal((await readFile(server.modelLog, "utf8")).split("\n").filter(line => line.includes('"environmentWrite":true')).length, 1);
  assert.equal(await page.evaluate(() => Object.values(localStorage).some(value => value.includes("new-private-environment-fixture"))), false);
  await layout(360, "secure-environment-verified-without-chat");
  const envBuildPlan = { version: 1, nodeVersion: "22", image: projectBuildImage, buildCommand: envFlow.profile.build, testCommand: null, startCommand: envFlow.profile.start,
    port: envFlow.profile.port, workload: { path: "/", status: 200, assertion: { kind: "text", contains: "ready" } }, environment: currentEnvironment(store, server.sessionSecret, actor, envFlow.id) };
  const envJob = await new CodeRepairAdapter(envConfig, store).propose(actor, { projectId: envFlow.id, expectedSourceHash: envFlow.profile.sourceHash,
    goal: "بررسی ساخت با اطلاعات امن همان پروژه", allowedPaths: [], testFiles: [], execution: "container", build: envBuildPlan, validationOnly: true }, AbortSignal.timeout(5000));
  const envState = repo.get(actor, envRun.id); envState.repair = envJob; envState.state = "needs_approval"; envState.nextAction = null; envState.question = null;
  envState.repairDecision = { sessionId: store.db.prepare("SELECT id FROM sessions WHERE actor_id=?").get(actor).id, expiresAt: Date.now() + 600000, consumed: false }; repo.save(actor, envState);
  await page.reload(); await journey.getByRole("button", { name: "تأیید ساخت و بررسی برنامه", exact: true }).waitFor();
  await journey.getByText(/اجازهٔ استفاده از اطلاعات امن این کلیدها/).waitFor();
  assert.deepEqual((await journey.locator(".agent-repair .note bdi").allTextContents()).map(key => key.trim()).sort(), ["NEXT_PUBLIC_ACCOUNT_SYNCHRONIZATION_SERVICE_API", "NEXT_PUBLIC_WEB_API", "SERVICE_ACCESS"]);
  for (const width of [320, 360, 390, 768, 1280]) await layout(width, "environment-bound-build-consent");
  const codingAgentChoice = journey.getByLabel("اصلاح خطا با", { exact: true });
  await codingAgentChoice.evaluate(node => { node.style.fontSize = "200%"; });
  await layout(320, "environment-build-agent-choice-large-text");
  await page.screenshot({ path: join(output, "environment-agent-choice-large-text-320.png"), fullPage: true });
  await codingAgentChoice.evaluate(node => { node.style.removeProperty("font-size"); });
  await page.setViewportSize({ width: 320, height: 844 }); await page.screenshot({ path: join(output, "environment-build-decision-320.png"), fullPage: true });
  await page.setViewportSize({ width: 360, height: 844 }); await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: join(output, "environment-build-decision-360.png"), fullPage: true });
  await journey.getByRole("button", { name: "رد آماده‌سازی", exact: true }).click();
  await journey.locator(".badge").filter({ hasText: "منتظر پاسخ شما" }).waitFor(); assert.deepEqual(repo.get(actor, envRun.id).repair.containerIds, []);
  const programRun = repo.get(actor, envRun.id); programRun.state = "working"; repo.save(actor, programRun);
  const programJob = await new CodeRepairAdapter(envConfig, store).propose(actor, { projectId: envFlow.id, parentRunId: programRun.id,
    expectedSourceHash: envFlow.profile.sourceHash, goal: "بررسی برنامه انتشار با همان اطلاعات امن", allowedPaths: [], testFiles: [], execution: "container", build: envBuildPlan, validationOnly: true }, AbortSignal.timeout(5000));
  programRun.repair = programJob; programRun.state = "needs_approval"; programRun.repairDecision = { sessionId: ownSession, expiresAt: Date.now() + 600000, consumed: false }; repo.save(actor, programRun);
  await page.reload(); await journey.getByRole("button", { name: "بررسی برنامهٔ انتشار و اصلاح خودکار", exact: true }).click();
  const program = journey.locator('section[aria-labelledby="mission-authority-title"]');
  await program.getByRole("button", { name: "تأیید برنامه و شروع انتشار", exact: true }).waitFor();
  const internalProgram = repo.get(actor, envRun.id); assert.equal(internalProgram.authority.plan.version, 2);
  assert.equal(internalProgram.authority.plan.codingAgent.kind, "internal");
  await journey.getByRole("button", { name: "تغییر عامل پیش از تأیید", exact: true }).click();
  const agentChoice = journey.locator('section[aria-labelledby="coding-agent-title"]');
  const beforeAgentDraft = posts.length, modelBeforeAgentDraft = await modelRequests();
  await agentChoice.getByLabel("اصلاح خطا با", { exact: true }).selectOption("codex");
  assert.equal(await agentChoice.locator('option[value="claude"]').isDisabled(), true);
  assert.equal(await agentChoice.locator('option[value="opencode"]').isDisabled(), true);
  assert.equal(await agentChoice.getByRole("button", { name: "بررسی برنامهٔ انتشار و اصلاح خودکار", exact: true }).isDisabled(), true);
  assert.equal(await program.getByRole("button", { name: "تأیید برنامه و شروع انتشار", exact: true }).isDisabled(), true);
  for (const width of [320, 360, 390, 768, 1280]) await layout(width, "external-agent-explicit-cost-consent");
  assert.equal(posts.length, beforeAgentDraft); assert.equal(await modelRequests(), modelBeforeAgentDraft);
  await agentChoice.getByRole("checkbox", { name: /مصرف اشتراک Codex با قیمت نامعلوم/ }).check();
  await agentChoice.getByRole("button", { name: "بررسی برنامهٔ انتشار و اصلاح خودکار", exact: true }).focus();
  await agentChoice.getByRole("button", { name: "بررسی برنامهٔ انتشار و اصلاح خودکار", exact: true }).press("Enter");
  await program.getByText(/عامل اصلاح: Codex همین دستگاه/).waitFor();
  const externalProgram = repo.get(actor, envRun.id); assert.equal(externalProgram.authority.plan.revision, 2);
  assert.notEqual(externalProgram.authority.id, internalProgram.authority.id);
  assert.equal(store.db.prepare("SELECT plan_hash FROM mission_authority_history WHERE id=?").get(internalProgram.authority.id).plan_hash, internalProgram.authority.hash);
  const beforeExternalReload = await modelRequests(); await page.reload(); await program.getByText(/عامل اصلاح: Codex همین دستگاه/).waitFor();
  assert.equal(await modelRequests(), beforeExternalReload); assert.deepEqual(repo.get(actor, envRun.id).usage, externalProgram.usage);
  for (const width of [320, 360, 390, 768, 1280]) await layout(width, "external-agent-bound-program");
  await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: join(output, "codex-program-390.png"), fullPage: true });
  await journey.getByRole("button", { name: "تغییر عامل پیش از تأیید", exact: true }).click();
  await agentChoice.getByLabel("اصلاح خطا با", { exact: true }).selectOption("internal");
  await agentChoice.getByRole("button", { name: "بررسی برنامهٔ انتشار و اصلاح خودکار", exact: true }).click();
  await program.getByText(/عامل اصلاح: عامل داخلی Launchlane/).waitFor();
  assert.equal(repo.get(actor, envRun.id).authority.plan.revision, 3);
  const staleApproval = await page.evaluate(async ({ runId, authorityId, hash }) => {
    const workspace = await (await fetch("/api/workspace")).json();
    const current = await (await fetch(`/api/agent/runs/${runId}`)).json();
    const response = await fetch(`/api/agent/runs/${runId}`, { method: "POST", headers: { "content-type": "application/json", "x-csrf-token": workspace.session.csrfToken },
      body: JSON.stringify({ operation: "plan-decision", revision: current.run.revision, authorityId, hash, decision: "approve" }) });
    return { status: response.status, code: (await response.json()).error?.code };
  }, { runId: envRun.id, authorityId: externalProgram.authority.id, hash: externalProgram.authority.hash });
  assert.equal(staleApproval.status, 409); assert.equal(staleApproval.code, "PLAN_CONFLICT");
  assert.equal(store.db.prepare("SELECT count(*) n FROM coding_agent_executions").get().n, 0);
  await program.getByText(/۱۴۰|140/).waitFor();
  assert.equal(await journey.getByRole("button", { name: "تأیید ساخت و بررسی برنامه", exact: true }).count(), 0, "the program review has one approval scope");
  const beforeProgramReload = await modelRequests(), programBefore = repo.get(actor, envRun.id);
  await page.reload(); await program.getByRole("button", { name: "تأیید برنامه و شروع انتشار", exact: true }).waitFor();
  assert.equal(await modelRequests(), beforeProgramReload); assert.equal(repo.get(actor, envRun.id).authority.id, programBefore.authority.id);
  assert.deepEqual(repo.get(actor, envRun.id).usage, programBefore.usage);
  for (const width of [320, 360, 390, 768, 1280]) await layout(width, "bounded-publication-program-review");
  await page.setViewportSize({ width: 360, height: 844 }); await program.getByText("محدوده و اطلاعات فنی برنامه", { exact: true }).click();
  await program.getByRole("button", { name: "رد برنامه", exact: true }).focus();
  assert.equal(await program.getByRole("button", { name: "رد برنامه", exact: true }).evaluate(node => node === document.activeElement), true);
  await page.screenshot({ path: join(output, "program-review-360.png"), fullPage: true });
  await program.getByRole("button", { name: "رد برنامه", exact: true }).press("Enter");
  await program.getByText("اختیار برنامه پایان یافته است؛ رسیدها حفظ شده‌اند.", { exact: true }).waitFor();
  assert.equal(repo.get(actor, envRun.id).repair.state, "cancelled"); assert.deepEqual(repo.get(actor, envRun.id).repair.containerIds, []);
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  await writeFile(join(output, "results.json"), JSON.stringify({ results, errors, external, model: "synthetic", cloudWrites: 0 }, null, 2));
  console.log(JSON.stringify({ states: results.length, widths: [320,360,390,768,1280], model: "synthetic", cloudWrites: 0, output }));
} finally { store?.close(); await context.close(); await browser.close(); await server.close(); }
