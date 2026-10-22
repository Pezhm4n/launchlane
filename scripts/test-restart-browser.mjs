import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { startTestServer } from "./test-server.mjs";
import { Store } from "../src/server/persistence/store.ts";
import { sealCredential } from "../src/server/connections/credentials.ts";
import { restartRun, restartOrigin } from "../tests/helpers/restart-fixture.ts";
import { restartEvidenceHash } from "../src/server/policy/restart.ts";

// Controlled proposal/write/readback responses only. Actual local routes own login, decision and restore.
const server = await startTestServer(), browser = await chromium.launch({ headless: true }),
  context = await browser.newContext({ locale: "fa-IR", reducedMotion: "reduce" }),
  output = resolve(".artifacts/restart-ui", new Date().toISOString().replaceAll(":", "-"));
await mkdir(output, { recursive: true });
const errors = [], external = [], results = [];
context.on("page", (page) => {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (/same key|Encountered two children/.test(message.text())) errors.push(message.text()); });
});
await context.route("**/*", (route) => {
  if (new URL(route.request().url()).origin !== server.origin) { external.push(route.request().url()); return route.abort(); }
  return route.continue();
});
const page = await context.newPage(), actor = createHash("sha256").update(server.token).digest("hex").slice(0, 24);
const targetReleaseId = `release-${"long-revision-".repeat(8)}`;
let store, enabled = false, sends = 0, observationStatus = 500, mode = "accepted", proposalFailure = false;
let started = () => undefined, release = () => undefined;
function guard(handler) {
  return async (route) => {
    try { return await handler(route); }
    catch (error) {
      errors.push(`Fixture boundary: ${error.message}`);
      return route.fulfill({ status: 500, json: { error: { code: "FIXTURE_FAILURE", message: "آزمون مرز پاسخ شکست خورد.", requestId: "synthetic" } } }).catch(() => undefined);
    }
  };
}
async function state(label, width = 360) {
  assert.equal(await page.getByRole("region", { name: `نتیجه بررسی ${server.app}`, exact: true }).count(), 1, `${label}: report remains unique`);
  await page.setViewportSize({ width, height: width >= 768 ? 1000 : 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => document.fonts.ready);
  const geometry = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  if (geometry.content > geometry.viewport + 1) {
    const overflow = await page.evaluate(() => [...document.querySelectorAll("main *")].map((element) => ({ tag: element.tagName, class: element.className, text: element.textContent?.trim().slice(0, 100), rect: element.getBoundingClientRect().toJSON() })).filter((row) => row.rect.width > 0 && (row.rect.left < -1 || row.rect.right > document.documentElement.clientWidth + 1)));
    await writeFile(resolve(output, "overflow.json"), JSON.stringify({ label, geometry, overflow }, null, 2));
  }
  assert.ok(geometry.content <= geometry.viewport + 1, `${label}: overflow ${JSON.stringify(geometry)}`);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  assert.deepEqual(
    axe.violations.map((row) => ({ id: row.id, nodes: row.nodes.map((node) => node.target) })),
    [],
    label,
  );
  results.push({ label, width, ...geometry });
  if ([360, 768, 1280].includes(width)) await page.screenshot({ path: resolve(output, `${label}-${width}.png`), fullPage: true });
}
try {
  await mkdir(server.stateDir, { recursive: true });
  store = new Store(resolve(server.stateDir, "state.sqlite"));
  store.saveConnection(actor, {
    source: "token", ciphertext: sealCredential("synthetic-never-real", server.sessionSecret, actor, "liara"),
    view: { provider: "liara", status: "connected", identityId: "synthetic-user", displayName: "حساب آزمایشی رابط",
      login: "user@example.test", teamId: server.teamId, teamName: "تیم آزمایشی رابط برای پروژه‌ای با نام طولانی و چندبخشی", selectedApp: server.app,
      apps: [{ id: "project-exact", name: server.app, platform: "node" }], checkedAt: Date.now() },
  });
  store.setProbeOrigin(actor, { teamId: server.teamId, app: server.app }, restartOrigin);
  const fixture = restartRun(); fixture.evidence.scope = { teamId: server.teamId, app: server.app };
  fixture.path = `/orders/${"long-page-".repeat(12)}details`;
  fixture.evidence.entries[0].fact.path = fixture.path;
  const run = store.saveIncidentRun(actor, fixture);
  await page.route("**/api/workspace", guard(async (route) => {
    const response = await route.fetch();
    if (!response.ok()) return route.fulfill({ response });
    const value = await response.json();
    return route.fulfill({ json: { ...value, features: { ...value.features, deployment: enabled, serviceReads: enabled } } });
  }));
  await page.route("**/api/actions/restart", guard(async (route) => {
    assert.deepEqual(route.request().postDataJSON(), { incidentRunId: run.id });
    if (proposalFailure) return route.fulfill({ status: 503, json: { error: { code: "PROVIDER_UNAVAILABLE", message: "اطلاعات برنامه دریافت نشد. اتصال را بررسی کنید؛ پیشنهاد قبلی حفظ شده است.", requestId: "synthetic" } } });
    const current = store.getIncidentRun(actor, run.id);
    const action = store.createAction(actor, { version: 6, operation: "restart", scope: current.evidence.scope,
      sourceHash: null, args: { port: null, planId: null }, accountId: "synthetic-user", targetAppId: "project-exact",
      targetPlanId: "plan-exact", targetReleaseId, incidentRunId: run.id,
      evidenceHash: restartEvidenceHash(current), target: { origin: restartOrigin, path: run.path } });
    return route.fulfill({ status: 201, json: { action } });
  }));
  await page.route("**/api/actions/*/execute", guard(async (route) => {
    sends++;
    const id = new URL(route.request().url()).pathname.split("/")[3], action = store.getAction(id, actor),
      sessionId = store.db.prepare("SELECT approval_session_id FROM actions WHERE id=?").get(id).approval_session_id;
    store.claim(id, actor, sessionId, action.spec); store.startRestartRequest(id, actor);
    if (mode === "cancel") store.uncertain(id, actor);
    started(); await new Promise((done) => { release = done; });
    if (mode === "cancel") return route.fulfill({ status: 409, json: { error: { code: "UPSTREAM_UNCERTAIN", message: "پاسخ قطعی دریافت نشد.", requestId: "synthetic" } } }).catch(() => undefined);
    return route.fulfill({ json: { action: store.acceptRestart(id, actor) } });
  }));
  await page.route("**/api/actions/*/observe", guard(async (route) => {
    const id = new URL(route.request().url()).pathname.split("/")[3], action = store.getAction(id, actor),
      checkedAt = Math.max(Date.now(), (action.restart.observation?.checkedAt ?? 0) + 1);
    return route.fulfill({ json: { action: store.recordRestartObservation(id, actor, {
      outcome: observationStatus < 300 ? "responding" : "unhealthy", code: "RESTART_PAGE_CHECKED",
      checkedAt, observedAt: checkedAt, status: observationStatus, releaseId: targetReleaseId,
    }, action.restart.observation?.checkedAt ?? null) } });
  }));
  await page.goto(`${server.origin}/?view=incident`);
  await page.getByLabel("کلید ورود محلی").fill(server.token);
  await page.getByRole("button", { name: "ورود به میز کار", exact: true }).click();
  const panel = page.getByRole("region", { name: "راه‌اندازی دوباره برنامه", exact: true });
  const press = (name) => panel.getByRole("button", { name, exact: true }).and(page.locator("button:enabled")).press("Enter");
  await panel.getByRole("button", { name: "بررسی پیشنهاد راه‌اندازی دوباره", exact: true }).waitFor();
  assert.equal(await panel.getByRole("button", { name: "بررسی پیشنهاد راه‌اندازی دوباره", exact: true }).isEnabled(), false);
  await panel.getByText(/انتشار و تغییر زیرساخت در این نصب غیرفعال است/).waitFor();
  await state("disabled-access-has-next-step");
  enabled = true;
  await press("بازخوانی وضعیت دسترسی");
  await press("بررسی پیشنهاد راه‌اندازی دوباره");
  await panel.getByText("منتظر تصمیم شما", { exact: true }).waitFor();
  assert.equal(await panel.getByRole("button", { name: "ثبت تأیید راه‌اندازی دوباره", exact: true }).isEnabled(), false);
  await state("consent-is-specific");
  await panel.getByRole("checkbox").and(page.locator("input:enabled")).press("Space");
  await press("ثبت تأیید راه‌اندازی دوباره");
  await panel.getByText("تأیید ثبت شد؛ اجرا نشده", { exact: true }).waitFor(); assert.equal(sends, 0);
  await page.reload(); await panel.getByText("تأیید ثبت شد؛ اجرا نشده", { exact: true }).waitFor();
  for (const width of [280, 360, 559, 560, 768, 959, 960, 1280]) await state("approved-restored-no-send", width);
  await page.getByRole("link", { name: "انتشار پروژه", exact: true }).click();
  await page.getByRole("link", { name: "بررسی مشکل سایت", exact: true }).click();
  await panel.getByText("تأیید ثبت شد؛ اجرا نشده", { exact: true }).waitFor();
  await page.goBack(); await page.goForward();
  await panel.getByText("تأیید ثبت شد؛ اجرا نشده", { exact: true }).waitFor();
  let begin = new Promise((done) => { started = done; });
  await press("اجرای راه‌اندازی دوباره");
  await begin;
  await panel.getByRole("button", { name: "توقف انتظار", exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "بررسی مشکل سایت", exact: true }).last().isEnabled(), false);
  await state("one-request-in-flight"); release();
  await panel.getByText("درخواست پذیرفته شد؛ نتیجه صفحه را بررسی کنید", { exact: true }).waitFor();
  assert.equal(sends, 1);
  await state("accepted-is-not-completed");
  await press("بررسی پاسخ همان صفحه");
  await panel.getByText(/همان صفحه هنوز پاسخ موفق نمی‌دهد/).waitFor();
  await state("same-page-still-failing");
  const failedAction = store.listActions(actor).find((action) => action.spec.version === 6);
  proposalFailure = true; await press("دریافت پیشنهاد تازه");
  await panel.getByRole("alert").getByText(/پیشنهاد قبلی حفظ شده است/).waitFor();
  assert.equal(store.getAction(failedAction.id, actor).state, "failed"); assert.equal(sends, 1);
  await state("failed-proposal-keeps-prior-result");
  proposalFailure = false; await press("بازخوانی وضعیت ذخیره‌شده");
  observationStatus = 200;
  await press("بررسی پاسخ همان صفحه");
  await panel.getByText("درخواست پذیرفته شد؛ صفحه پاسخ می‌دهد", { exact: true }).waitFor();
  const report = page.getByRole("region", { name: `نتیجه بررسی ${server.app}`, exact: true });
  await report.getByText(/صفحه بررسی‌شده پاسخ موفق داد/).waitFor();
  await report.getByText(/همان صفحه در بررسی تازه پاسخ موفق داد/).waitFor();
  assert.equal(await panel.getByRole("button", { name: "دریافت پیشنهاد تازه", exact: true }).isEnabled(), false);
  await page.reload(); await panel.getByText("درخواست پذیرفته شد؛ صفحه پاسخ می‌دهد", { exact: true }).waitFor();
  await report.getByText(/صفحه بررسی‌شده پاسخ موفق داد/).waitFor();
  for (const width of [360, 768, 1280]) await state("responding-readback-restored", width);
  const restoredRun = await (await page.request.get(`${server.origin}/api/incidents/runs?id=${run.id}`, { headers: { origin: server.origin } })).json();
  assert.equal(restoredRun.run.evidence.entries[0].fact.status, 500);
  assert.equal(restoredRun.run.after.entries[0].fact.status, 200);
  const handoff = report.locator(".incident-handoff");
  await handoff.locator(":scope > summary").press("Enter");
  await handoff.getByRole("button", { name: "آماده‌سازی گزارش", exact: true }).press("Enter");
  await handoff.getByRole("heading", { name: "گزارش این بررسی آماده است", exact: true }).waitFor();
  await handoff.getByText("پیش‌نمایش محتوای فایل", { exact: true }).press("Enter");
  const markdown = await handoff.getByRole("textbox", { name: "محتوای گزارش برای اصلاح کد", exact: true }).inputValue();
  assert.match(markdown, /"observedStatus": 500/);
  assert.match(markdown, /"status": 200/);
  assert.match(markdown, /همان صفحه در بررسی تازه پاسخ موفق داد/);
  assert.match(markdown, /پاسخ 200 پایان restart یا علت تغییر را ثابت نمی‌کند/);
  assert.equal(markdown.includes(server.token), false);
  await state("handoff-matches-restored-same-page-observation", 360);
  await handoff.locator(":scope > summary").press("Enter");
  assert.equal(sends, 1);
  // Fresh controlled evidence, not an inferred new failure from the earlier operation.
  const fresh = structuredClone(run); const now = Date.now();
  fresh.evidence.collectedAt = now; fresh.evidence.window = { start: now - 1000, end: now };
  fresh.evidence.entries[0].at = now; store.saveIncidentRun(actor, fresh);
  await page.reload(); await press("دریافت پیشنهاد تازه");
  await press("رد پیشنهاد");
  await panel.getByText("اجرا نمی‌شود", { exact: true }).waitFor(); assert.equal(sends, 1);
  await press("دریافت پیشنهاد تازه");
  await panel.getByText("منتظر تصمیم شما", { exact: true }).waitFor();
  const expiring = store.listActions(actor).find((action) => action.spec.version === 6);
  store.db.prepare("UPDATE actions SET expires_at=? WHERE id=?").run(Date.now() + 1500, expiring.id);
  await page.reload(); await panel.getByText("مهلت تأیید گذشته", { exact: true }).waitFor();
  assert.equal(await panel.getByRole("button", { name: "اجرای راه‌اندازی دوباره", exact: true }).count(), 0);
  assert.equal(sends, 1); await state("expired-consent-cannot-execute");
  await press("دریافت پیشنهاد تازه");
  await panel.getByRole("checkbox").and(page.locator("input:enabled")).press("Space");
  await press("ثبت تأیید راه‌اندازی دوباره");
  await panel.getByText("تأیید ثبت شد؛ اجرا نشده", { exact: true }).waitFor();
  mode = "cancel"; begin = new Promise((done) => { started = done; });
  await press("اجرای راه‌اندازی دوباره");
  await begin; await panel.getByRole("button", { name: "توقف انتظار", exact: true }).click(); release();
  await panel.getByText("پذیرش درخواست نامعلوم است", { exact: true }).waitFor();
  assert.equal(await panel.getByRole("button", { name: "اجرای راه‌اندازی دوباره", exact: true }).count(), 0);
  await press("بررسی پاسخ همان صفحه");
  await panel.getByText("پذیرش درخواست نامعلوم است", { exact: true }).waitFor();
  await panel.getByText("همان صفحه با همان نسخه پاسخ موفق داد.", { exact: false }).waitFor();
  await page.reload(); await panel.getByText("پذیرش درخواست نامعلوم است", { exact: true }).waitFor();
  assert.equal(await panel.getByRole("button", { name: "دریافت پیشنهاد تازه", exact: true }).count(), 0);
  for (const width of [360, 768, 1280]) await state("lost-response-never-replays", width);
  await panel.locator("summary").filter({ hasText: "جزئیات نسخه و تأیید" }).press("Enter");
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  for (const width of [280, 360, 768, 959, 960]) await state("uncertain-text-200-percent", width);
  assert.equal(sends, 2); assert.deepEqual(errors, []); assert.deepEqual(external, []);
  assert.equal(await page.evaluate(() => localStorage.length), 0);
  await writeFile(resolve(output, "results.json"), JSON.stringify({ mode: "browser-upstream-fixtures", results, errors, external, sends, realProviderRequests: 0 }, null, 2));
  console.log(JSON.stringify({ states: results.length, widths: [...new Set(results.map((row) => row.width))], pageErrors: errors.length, externalRequests: external.length, artifact: output }));
} catch (error) {
  await writeFile(resolve(output, "failure-body.txt"), await page.locator("main").textContent() ?? "").catch(() => undefined);
  await page.screenshot({ path: resolve(output, "failure.png"), fullPage: true }).catch(() => undefined);
  await writeFile(resolve(output, "failure.json"), JSON.stringify({ error: error.message, results, errors, realProviderRequests: 0 }, null, 2));
  throw error;
} finally { release(); store?.close(); await browser.close(); await server.close(); }
