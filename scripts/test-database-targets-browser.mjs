import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { startTestServer } from "./test-server.mjs";
import { Store } from "../src/server/persistence/store.ts";
import { AgentRepository } from "../src/server/agent/store.ts";
import { sealCredential } from "../src/server/connections/credentials.ts";
import { currentEnvironment, projectEnvironmentValues, openEnvironmentInput } from "../src/server/environment/secrets.ts";

// Actual web/HTTP/approval/journal/private binding; model and provider transports synthetic.
// No API interception, real model credit, cloud write, build or application SQL.
const server = await startTestServer({ agentFixture: true, databaseFixture: true }), browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: "fa-IR", reducedMotion: "reduce" }), page = await context.newPage();
const output = resolve(".artifacts/database-targets", new Date().toISOString().replaceAll(":", "-")), errors = [], external = [], leaks = [], layouts = [];
await mkdir(output, { recursive: true }); let store, latestDecision, csrf;
const lines = async path => { try { return (await readFile(path, "utf8")).trim().split("\n").filter(Boolean).map(row => JSON.parse(row)); } catch { return []; } };
page.on("pageerror", error => errors.push(error.message));
page.on("request", request => { const url = new URL(request.url()); if (url.origin !== server.origin && ["http:", "https:"].includes(url.protocol)) external.push(url.origin);
  if (request.method() === "POST" && url.pathname.startsWith("/api/")) { const body = request.postData() ?? ""; if (body.includes("synthetic-binding-secret")) leaks.push("request");
    if (url.pathname.startsWith("/api/agent/runs/") && request.postDataJSON()?.operation === "database-decision") { latestDecision = { url: request.url(), body: request.postDataJSON() }; csrf = request.headers()["x-csrf-token"]; } } });
page.on("response", async response => { if (response.url().startsWith(`${server.origin}/api/`) && response.headers()["content-type"]?.includes("application/json")) { try { if ((await response.text()).includes("synthetic-binding-secret")) leaks.push("response"); } catch {} } });
try {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto(server.origin); await page.getByLabel("کلید ورود محلی", { exact: true }).fill(server.token); await page.getByRole("button", { name: "ورود به میز کار", exact: true }).click();
  await page.getByRole("button", { name: "انتخاب پوشه پروژه", exact: true }).click(); const picker = page.getByRole("dialog", { name: "انتخاب پوشه پروژه", exact: true });
  const chooser = page.waitForEvent("filechooser"); await picker.getByRole("button", { name: "انتخاب پوشه از رایانه", exact: true }).click(); await (await chooser).setFiles(resolve("tests/fixtures/database-targets"));
  await picker.getByRole("button", { name: "بررسی این پروژه", exact: true }).click(); await picker.waitFor({ state: "detached" }); await page.waitForURL(url => !!url.searchParams.get("project"));
  const projectId = new URL(page.url()).searchParams.get("project"), actor = createHash("sha256").update(server.token).digest("hex").slice(0, 24); assert.ok(projectId);
  store = new Store(join(server.stateDir, "state.sqlite")); const repo = new AgentRepository(store), flow = store.getProjectFlow(actor, projectId); assert.ok(flow?.artifact);
  store.saveConnection(actor, { source: "token", ciphertext: sealCredential("synthetic-database-provider-key", server.sessionSecret, actor, "liara"), view: { provider: "liara", status: "connected", identityId: "b".repeat(24), displayName: "حساب آزمون", login: "fixture@example.test", teamName: "تیم آزمون", teamId: server.teamId, checkedAt: Date.now(), apps: [{ id: "c".repeat(24), name: server.app, platform: "node" }], selectedApp: server.app } });
  await page.reload(); const journey = page.locator(".publication-journey"); await journey.getByText("صفحه و نشانه مورد انتظار", { exact: true }).click(); await page.locator("#mission-expectation").fill("Two managed data targets");
  await journey.getByRole("button", { name: "بررسی و آماده‌سازی انتشار", exact: true }).click();
  const ids = [], envIds = []; let firstUrl;
  for (const [index, key] of ["AUTH_DB_URL", "PROFILE_DB_URL"].entries()) {
    const card = page.locator('section[aria-labelledby="database-title"]'), approve = card.getByRole("button", { name: "تأیید و ساخت دیتابیس", exact: true }); await approve.waitFor();
    assert.ok(await card.getByText(key, { exact: true }).count()); const pending = repo.forProject(actor, projectId, "publication"); assert.ok(pending?.database?.spec.version === 28); assert.deepEqual(pending.database.spec.bindingKeys, [key]); ids.push(pending.database.id);
    assert.equal((await lines(server.databaseLog)).filter(row => row.operation === "create_database").length, index);
    for (const width of [320, 390, 768, 1280]) { await page.setViewportSize({ width, height: 900 }); await page.evaluate(() => document.fonts.ready); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze(); assert.deepEqual(axe.violations.map(row => row.id), []); layouts.push({ key, width, overflow: false, axeViolations: 0 }); }
    await approve.focus(); await approve.press("Enter"); await page.getByRole("button", { name: "آماده‌کردن اتصال امن دیتابیس", exact: true }).waitFor();
    const run = repo.forProject(actor, projectId, "publication"); assert.equal(run.database.id, ids[index]); assert.equal(run.database.state, "succeeded"); assert.equal(run.nextAction, "configure_env");
    // In the second stage, the first successful env action must not hide the new resource's form.
    await page.getByRole("button", { name: "آماده‌کردن اتصال امن دیتابیس", exact: true }).click(); const env = page.locator('section[aria-labelledby="environment-title"]');
    const apply = env.getByRole("button", { name: "تأیید و اعمال اطلاعات برنامه", exact: true }); await apply.waitFor(); assert.equal((await lines(server.databaseLog)).filter(row => row.operation === "update_env").length, index);
    const record = store.db.prepare("SELECT id FROM actions WHERE actor_id=? AND json_extract(spec,'$.version')=9 ORDER BY rowid DESC LIMIT 1").get(actor), action = store.getAction(record.id, actor); assert.deepEqual(action.spec.keys, [key]); envIds.push(action.id);
    assert.equal((await page.locator("body").textContent() ?? "").includes("synthetic-binding-secret"), false); await apply.focus(); await apply.press("Enter");
    const next = env.getByRole("button", { name: "ادامه بررسی و انتشار", exact: true }); await next.waitFor(); assert.equal(store.getAction(action.id, actor).state, "succeeded");
    const reference = currentEnvironment(store, server.sessionSecret, actor, projectId); assert.ok(reference); const values = projectEnvironmentValues(store, server.sessionSecret, actor, projectId, reference);
    assert.equal(openEnvironmentInput(store, server.sessionSecret, actor, action.spec).find(row => row.key === "KEEP_KEY")?.value, "keep-existing-fixture-value");
    assert.equal((await lines(server.databaseLog)).filter(row => row.operation === "update_env").at(-1)?.preservedKeep, true);
    const url = values.find(row => row.key === "AUTH_DB_URL")?.value; if (!index) firstUrl = url; else assert.equal(url, firstUrl);
    await page.screenshot({ path: join(output, `database-${index + 1}-1280.png`), fullPage: true });
    const continuation = page.waitForResponse(response => response.url().startsWith(`${server.origin}/api/agent/runs/`) && response.request().method() === "POST");
    await next.click(); const continued = await continuation; assert.equal(continued.status(), 200);
  }
  const deadline = Date.now() + 30000; let final = repo.forProject(actor, projectId, "publication");
  while (final?.state !== "partially_completed" && Date.now() < deadline) { await page.waitForTimeout(100); final = repo.forProject(actor, projectId, "publication"); }
  assert.ok(final); assert.equal(final.state, "partially_completed"); assert.equal(final.usage.modelCalls, 5); assert.equal(final.publication, null); assert.equal(new Set(ids).size, 2);
  assert.equal(store.db.prepare("SELECT count(*) n FROM attempts").get().n, 4); const operations = await lines(server.databaseLog); assert.equal(operations.filter(row => row.operation === "create_database").length, 2); assert.equal(operations.filter(row => row.operation === "update_env").length, 2);
  assert.ok(latestDecision && csrf); const replay = await context.request.post(latestDecision.url, { headers: { origin: server.origin, "x-csrf-token": csrf }, data: latestDecision.body }); assert.equal(replay.status(), 409);
  const before = { usage: final.usage, limits: final.limits, calls: (await lines(server.modelLog)).length, operations: operations.length }; await page.reload(); await page.locator(".publication-journey").waitFor();
  final = repo.get(actor, final.id); assert.deepEqual(final.usage, before.usage); assert.deepEqual(final.limits, before.limits); assert.equal((await lines(server.modelLog)).length, before.calls); assert.equal((await lines(server.databaseLog)).length, before.operations);
  assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(leaks, []); const summary = { projectId, runId: final.id, sourceHash: flow.profile.sourceHash, databaseActions: ids, environmentActions: envIds, model: "synthetic", modelCalls: final.usage.modelCalls, provider: "synthetic", createCalls: 2, environmentWrites: 2, actualCloudWrites: 0, replayStatus: replay.status(), reloadReplayed: false, layouts, errors, external, leaks };
  await writeFile(join(output, "results.json"), JSON.stringify(summary, null, 2)); console.log(JSON.stringify({ ...summary, output }));
} catch (error) {
  const actor = createHash("sha256").update(server.token).digest("hex").slice(0, 24), run = store ? new AgentRepository(store).forProject(actor, store.getProjectFlow(actor)?.id ?? "", "publication") : null;
  await writeFile(join(output, "failure.json"), JSON.stringify({ state: run?.state, errorCode: run?.errorCode, nextAction: run?.nextAction, usage: run?.usage, events: run?.events.slice(-4), operations: await lines(server.databaseLog), modelCalls: (await lines(server.modelLog)).length }, null, 2));
  throw error;
} finally { store?.close(); await context.close(); await browser.close(); await server.close(); }
