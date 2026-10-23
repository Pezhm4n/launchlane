import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { startTestServer } from "./test-server.mjs";
import { readConfig } from "../src/server/config.ts";
import { Store } from "../src/server/persistence/store.ts";
import { AgentRepository, addEvent } from "../src/server/agent/store.ts";
import { currentAgentContext } from "../src/server/agent/tools.ts";
import { prepareProjectFlow } from "../src/server/application/project-flows.ts";
import { proposeWorkloadDeployment } from "../src/server/application/deployment.ts";
import { LiaraReadClient } from "../src/server/liara/client.ts";
import { sealCredential } from "../src/server/connections/credentials.ts";
import { fingerprint } from "../src/server/policy/action.ts";

// Built product + disposable state; the existing fixture hook denies external service requests.
const output = resolve(".artifacts/agent-expiry", new Date().toISOString().replaceAll(":", "-"));
const results = [], errors = [], external = [], decisions = [];
let server, browser, store;
try {
  server = await startTestServer({ agentFixture: true });
  await mkdir(server.stateDir, { recursive: true });
  store = new Store(join(server.stateDir, "state.sqlite"));
  const actor = createHash("sha256").update(server.token).digest("hex").slice(0, 24);
  const config = readConfig({
    LAUNCHLANE_STATE_DIR: server.stateDir, LAUNCHLANE_WORKSPACE_ROOT: server.workspace,
    LAUNCHLANE_SESSION_SECRET: server.sessionSecret, LIARA_TEAM_ID: server.teamId,
    LAUNCHLANE_APP_ALLOWLIST: server.app, LIARA_API_TOKEN: "synthetic-expiry-publication-key",
    LAUNCHLANE_ENABLE_LIVE_LIARA: "true", LAUNCHLANE_ENABLE_MUTATIONS: "true",
    LAUNCHLANE_PROBE_ORIGINS: JSON.stringify({ [server.app]: "https://sample.example.com" }),
  });
  // Seeding uses the existing proposal service with an explicit synthetic read adapter.
  // The actual server retains mutation/live-service gates OFF throughout this test.
  store.saveConnection(actor, { source: "token", ciphertext: sealCredential(config.liaraToken, config.sessionSecret, actor, "liara"),
    view: { provider: "liara", status: "connected", identityId: "test-account", displayName: "حساب آزمون",
      login: "test@example.test", checkedAt: Date.now(), teamId: server.teamId, teamName: "تیم آزمون",
      selectedApp: server.app, apps: [{ id: "test-app-id", name: server.app, platform: "node" }] } });
  const flow = await prepareProjectFlow(config, store, actor, { kind: "local", directory: "examples/node-service" }, AbortSignal.timeout(5000));
  const repository = new AgentRepository(store);
  const read = new LiaraReadClient(config, async () => Response.json({ project: {
    _id: "test-app-id", project_id: server.app, type: "node", status: "Running", planID: "current-plan", envs: [],
  } }));
  async function seedExpiredPublication() {
    const action = await proposeWorkloadDeployment(config, store, actor, { flowId: flow.id, app: server.app, port: null,
      workload: { origin: "https://sample.example.com", path: "/orders", status: 200, assertion: { kind: "json", field: "total", equals: 81 } },
    }, AbortSignal.timeout(5000), { read });
    const now = Date.now();
    store.db.prepare("UPDATE actions SET created_at=?,expires_at=? WHERE id=? AND actor_id=?")
      .run(now - 120000, now - 60000, action.id, actor);
    // Age the synthetic proposal, then use the real expiry transition rather than inventing an outcome.
    store.listActions(actor);
    const context = currentAgentContext(config, store, actor), input = { projectId: flow.id, sourceHash: flow.profile.sourceHash, path: "/orders", expectedText: null };
    const run = repository.create(actor, randomUUID(), context, "این پروژه را منتشر کن", { maxModelCalls: 16, maxToolCalls: 80, runTimeoutMs: 600000 },
      { ...input, kind: "publication", identity: fingerprint({ input, context }) }).run;
    run.publication = store.getAction(action.id, actor);
    assert.equal(run.publication.state, "expired");
    run.state = "needs_approval";
    // A deliberately nonzero synthetic usage snapshot makes accidental budget reset observable.
    run.usage = { modelCalls: 2, toolCalls: 4, observedTokens: 100, unknownModelCalls: 0, elapsedMs: 23 };
    addEvent(run, "state", "پیشنهاد انتشار برای آزمون انقضا آماده است؛ ارسالی انجام نشده است.");
    repository.save(actor, run);
    return repository.get(actor, run.id);
  }
  async function modelRequests() {
    try { return (await readFile(server.modelLog, "utf8")).split("\n").filter(Boolean).length; }
    catch (error) { if (error.code === "ENOENT") return 0; throw error; }
  }
  function assertNoExecution() {
    assert.equal(store.db.prepare("SELECT count(*) n FROM attempts").get().n, 0);
    assert.equal(store.db.prepare("SELECT count(*) n FROM code_repair_jobs").get().n, 0);
  }
  await mkdir(output, { recursive: true });
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: "fa-IR", reducedMotion: "reduce" }), page = await context.newPage();
  // The UI handler is real; clipboard transport stays private to this disposable browser.
  await context.addInitScript(() => {
    window.__publicationCopyDenied = false;
    window.__publicationCopied = null;
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async text => {
      if (window.__publicationCopyDenied) throw new Error("Synthetic clipboard denial");
      window.__publicationCopied = text;
    } } });
  });
  page.setDefaultTimeout(15000);
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    if (request.method() === "POST" && new URL(request.url()).pathname.startsWith("/api/agent/runs")) {
      const body = request.postDataJSON();
      decisions.push({ operation: body.operation, decision: body.decision });
    }
  });
  let previewPublishedLink = false;
  const publishedUrl = "https://sample.example.com/orders";
  await context.route("**/*", route => {
    if (previewPublishedLink && route.request().url() === publishedUrl && route.request().isNavigationRequest())
      return route.fulfill({ status: 200, contentType: "text/html", body: '<!doctype html><html lang="fa"><title>صفحهٔ مقصد مصنوعی آزمون لینک</title><body>صفحهٔ مقصد مصنوعی آزمون لینک</body></html>' });
    if (new URL(route.request().url()).origin !== server.origin) { external.push(new URL(route.request().url()).origin); return route.abort(); }
    return route.continue();
  });
  const journey = page.locator(".publication-journey"), card = journey.locator(".publication-card");
  async function capture(width, state) {
    await page.evaluate(async () => { await document.fonts.ready; window.scrollTo(0, 0); });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${state}/${width}: overflow`);
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    assert.deepEqual(axe.violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) })), []);
    await page.screenshot({ path: join(output, `${state}-${width}.png`), fullPage: true });
    results.push({ width, state, axeViolations: 0, overflow: false });
  }
  for (const width of [360, 1280]) {
    const seeded = await seedExpiredPublication(); assert.ok(seeded?.publication);
    const callsBefore = await modelRequests(), decisionsBefore = decisions.length;
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${server.origin}/?view=publish&project=${flow.id}`);
    if (width === 360) {
      await page.getByLabel("کلید ورود محلی", { exact: true }).fill(server.token);
      await page.getByRole("button", { name: "ورود به میز کار", exact: true }).click();
    }
    const close = card.getByRole("button", { name: "بستن پیشنهاد منقضی‌شده", exact: true });
    await close.waitFor(); assert.equal(await close.isEnabled(), true);
    assert.equal(await card.getByRole("button", { name: "تأیید و انتشار این نسخه", exact: true }).count(), 0);
    assert.equal(await page.locator(".assistant-float[open]").count(), 0);
    assert.equal(await page.locator(".app-nav a").count(), 2);
    await capture(width, "expired");
    await card.locator("summary").last().focus(); await page.keyboard.press("Tab");
    assert.equal(await close.evaluate(node => node === document.activeElement), true);
    const responsePromise = page.waitForResponse(response => new URL(response.url()).pathname === `/api/agent/runs/${seeded.id}` &&
      response.request().method() === "POST" && response.request().postDataJSON().operation === "publication-decision");
    await page.keyboard.press("Enter");
    const response = await responsePromise; assert.equal(response.status(), 200);
    const returned = (await response.json()).run;
    assert.equal(returned.id, seeded.id); assert.equal(returned.state, "needs_input");
    assert.equal(returned.publication.state, "cancelled");
    await card.getByRole("status").filter({ hasText: "شما این انتشار را رد کردید." }).waitFor();
    assert.equal(await close.count(), 0);
    const resume = journey.getByRole("button", { name: "ادامه همان مأموریت", exact: true });
    await resume.waitFor(); assert.equal(await resume.isEnabled(), true);
    const persisted = repository.get(actor, seeded.id); assert.ok(persisted?.publication);
    assert.deepEqual(persisted.usage, seeded.usage); assert.deepEqual(persisted.limits, seeded.limits);
    assert.deepEqual(persisted.mission, seeded.mission); assert.equal(persisted.publication.attemptId, null);
    assert.equal(persisted.state, "needs_input"); assert.equal(persisted.nextAction, "reply");
    assert.equal(await modelRequests(), callsBefore); assertNoExecution();
    assert.deepEqual(decisions.slice(decisionsBefore), [{ operation: "publication-decision", decision: "reject" }]);
    await capture(width, "dismissed");
    await page.reload(); await resume.waitFor();
    assert.equal(await modelRequests(), callsBefore); assertNoExecution();
    assert.deepEqual(decisions.slice(decisionsBefore), [{ operation: "publication-decision", decision: "reject" }]);
  }
  // A synthetic read projection exercises the completed card without inventing a durable release or executing a write.
  await page.route("**/api/agent/runs**", async route => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch(), body = await response.json();
    if (body.run?.publication) {
      body.run.state = "completed"; body.run.nextAction = null; body.run.question = null;
      body.run.effect = "remote_changes_verified";
      body.run.publication.state = "succeeded";
      body.run.publication.remoteId = "e".repeat(24);
      body.run.publication.deployment = { stage: "release_accepted", sourceId: "synthetic-source", observation: {
        outcome: "verified", code: "WORKLOAD_VERIFIED", checkedAt: Date.now(), releaseId: "e".repeat(24), releaseState: "Ready", status: 200,
      } };
    }
    return route.fulfill({ response, json: body });
  });
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 900 }); await page.reload();
    await card.getByRole("heading", { name: "سایت شما منتشر شد", exact: true }).waitFor();
    const open = card.getByRole("link", { name: "باز کردن سایت", exact: true }), copy = card.getByRole("button", { name: "کپی لینک سایت", exact: true });
    assert.equal(await open.getAttribute("href"), publishedUrl); assert.equal(await open.getAttribute("target"), "_blank");
    assert.equal(await card.locator(".publication-review").evaluate(node => node.open), false);
    await copy.focus(); await page.keyboard.press("Enter");
    await card.getByRole("button", { name: "لینک کپی شد", exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.__publicationCopied), publishedUrl);
    await capture(width, "verified-copied");
    previewPublishedLink = true;
    const popupPromise = page.waitForEvent("popup"); await open.click(); const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded"); assert.equal(popup.url(), publishedUrl); await popup.close();
    await page.evaluate(() => { window.__publicationCopyDenied = true; });
    await card.getByRole("button", { name: "لینک کپی شد", exact: true }).click();
    await card.getByText("کپی خودکار در این مرورگر در دسترس نیست؛ نشانی بالا را انتخاب و کپی کنید.", { exact: true }).waitFor();
    await capture(width, "verified-copy-denied");
    assertNoExecution(); assert.equal(await modelRequests(), 0);
  }
  assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.equal(await modelRequests(), 0);
  await writeFile(join(output, "report.json"), JSON.stringify({ results, decisions, pageErrors: errors, external, modelRequests: 0,
    providerAttempts: 0, keyboardReject: true, usagePreserved: true, guidedContinuationAvailable: true,
    publicationSuccessReadProjection: "synthetic", clipboardTransport: "synthetic", publishedLinkOpensNewTab: true,
    limits: "The continuation control is enabled but not clicked. Success is a synthetic read projection; no deployment is executed or relabelled as live evidence. Clipboard success/denial uses the actual component with a disposable adapter." }, null, 2));
  console.log(JSON.stringify({ cases: results.length, viewports: [360, 1280], pageErrors: errors.length, externalRequests: external.length,
    modelRequests: 0, providerAttempts: 0, output }));
} finally {
  try { await browser?.close(); }
  finally { try { store?.close(); } finally { await server?.close(); } }
}
