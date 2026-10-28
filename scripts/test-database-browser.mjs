import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { startTestServer } from "./test-server.mjs";
import { Store } from "../src/server/persistence/store.ts";
import { AgentRepository } from "../src/server/agent/store.ts";
import { currentAgentContext } from "../src/server/agent/tools.ts";
import { readConfig } from "../src/server/config.ts";
import { fingerprint } from "../src/server/policy/action.ts";
import { sealCredential } from "../src/server/connections/credentials.ts";

// Synthetic decision views; no model or provider execution is authorized by this harness.
const baseline = process.env.LAUNCHLANE_DATABASE_UI_BASELINE === "true";
const output = resolve(".artifacts/database-review", `${baseline ? "before" : "after"}-${new Date().toISOString().replaceAll(":", "-")}`);
const server = await startTestServer({ agentFixture: true }), browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: "fa-IR", reducedMotion: "reduce" }), page = await context.newPage();
const errors = [], decisions = [], layouts = []; let store, runId, action, envAction, mode = "awaiting_approval";
await mkdir(output, { recursive: true }); page.on("pageerror", error => errors.push(error.message));
function view(run) {
  return { ...run, state: ["awaiting_approval", "expired"].includes(mode) ? "needs_approval" : "needs_input", nextAction: mode === "succeeded" ? "configure_env" : null,
    database: { ...action, state: mode, expiresAt: mode === "expired" ? Date.now() - 1000 : action.expiresAt,
      ...(["uncertain", "succeeded"].includes(mode) ? { attemptId: "ui-only-attempt", database: { stage: mode === "succeeded" ? "created" : "request_started",
        acceptedAt: mode === "succeeded" ? Date.now() : null, databaseId: mode === "succeeded" ? "e".repeat(24) : null,
        observation: { checkedAt: Date.now(), outcome: mode === "succeeded" ? "identity_verified" : "inconclusive", code: "UI_VIEW" } } } : {}) }, databaseContinued: false };
}
await context.route("**/*", async route => {
  const request = route.request(), url = new URL(request.url()); if (url.origin !== server.origin) return route.abort();
  if (runId && url.pathname === "/api/project-environment") {
    if (request.method() === "GET") return route.fulfill({ status: 200, json: { names: ["DATABASE_URL"], app: server.app, action: envAction ?? null,
      imported: { available: [], needsReview: [], publicKeys: [] }, database: { actionId: action.id, hostname: action.spec.database.hostname, keys: ["DATABASE_URL"] } } });
    const body = request.postDataJSON(); decisions.push(body);
    if (body.operation === "propose-database") {
      assert.deepEqual(Object.keys(body).sort(), ["operation", "requestKey", "runId"]); assert.equal(body.runId, runId);
      envAction = { ...action, id: randomUUID(), state: "awaiting_approval", spec: { version: 9, operation: "update_env", scope: action.spec.scope,
        projectFlowId: action.spec.projectFlowId, sourceHash: action.spec.sourceHash, artifactHash: action.spec.artifactHash, selectionHash: action.spec.selectionHash,
        accountId: action.spec.accountId, targetAppId: action.spec.targetAppId, agentRunId: runId, secretRef: body.requestKey,
        baseFingerprint: "2".repeat(64), effectiveFingerprint: "3".repeat(64), keys: ["DATABASE_URL"], secretKeys: ["DATABASE_URL"], args: { port: null, planId: "small" } } };
    } else { assert.equal(body.operation, "decision"); assert.equal(body.decision, "reject"); envAction = { ...envAction, state: "cancelled" }; }
    return route.fulfill({ status: 200, json: { action: envAction } });
  }
  if (!runId || !url.pathname.startsWith("/api/agent/")) return route.continue();
  if (request.method() === "POST" && url.pathname === `/api/agent/runs/${runId}`) {
    const body = request.postDataJSON(); decisions.push(body);
    if (body.operation === "database-decision") { assert.equal(body.actionId, action.id); mode = body.decision === "reject" ? "cancelled" : "approved"; }
    else { assert.equal(body.operation, "database-observe"); mode = "succeeded"; }
    const response = await context.request.get(`${server.origin}/api/agent/runs/${runId}`), payload = await response.json();
    return route.fulfill({ status: 200, json: { ...payload, run: view(payload.run) } });
  }
  const response = await route.fetch();
  if (response.headers()["content-type"]?.includes("application/json")) { const payload = await response.json(); if (payload.run?.id === runId) return route.fulfill({ response, json: { ...payload, run: view(payload.run) } }); }
  return route.fulfill({ response });
});
try {
  await page.goto(server.origin); await page.getByLabel("کلید ورود محلی", { exact: true }).fill(server.token);
  await page.getByRole("button", { name: "ورود به میز کار", exact: true }).click(); await page.getByRole("button", { name: "امتحان با پروژه نمونه", exact: true }).click();
  await page.locator("h1").filter({ hasText: "node-service" }).waitFor();
  store = new Store(join(server.stateDir, "state.sqlite")); const actor = createHash("sha256").update(server.token).digest("hex").slice(0, 24), accountId = "b".repeat(24), targetId = "c".repeat(24);
  const config = readConfig({ LAUNCHLANE_STATE_DIR: server.stateDir, LAUNCHLANE_WORKSPACE_ROOT: server.workspace, LAUNCHLANE_OPERATOR_TOKEN: server.token,
    LAUNCHLANE_SESSION_SECRET: server.sessionSecret, LIARA_TEAM_ID: server.teamId, LAUNCHLANE_APP_ALLOWLIST: server.app });
  store.saveConnection(actor, { source: "token", ciphertext: sealCredential("synthetic-database-ui-key", server.sessionSecret, actor, "liara"), view: {
    provider: "liara", status: "connected", identityId: accountId, displayName: "حساب آزمون", login: "database@example.test", teamName: "تیم آزمون", teamId: server.teamId,
    checkedAt: Date.now(), apps: [{ id: targetId, name: server.app, platform: "node" }], selectedApp: server.app } });
  const flow = store.getProjectFlow(actor), repo = new AgentRepository(store), selected = currentAgentContext(config, store, actor),
    input = { projectId: flow.id, sourceHash: flow.profile.sourceHash, path: "/", expectedText: "invoice service" },
    run = repo.create(actor, randomUUID(), selected, "آماده‌سازی دیتابیس موردنیاز پروژه", { maxModelCalls: 10, maxToolCalls: 40, runTimeoutMs: 120000 },
      { ...input, kind: "publication", identity: fingerprint({ input, context: selected }) }).run;
  runId = run.id; run.state = "needs_approval"; run.nextAction = null; repo.save(actor, run);
  const now = Date.now(); action = { id: randomUUID(), actorId: actor, hash: "1".repeat(64), createdAt: now, expiresAt: now + 600000,
    state: "awaiting_approval", attemptId: null, remoteId: null, errorCode: null, spec: { version: 27, operation: "create_database", scope: { teamId: server.teamId, app: server.app },
      accountId, targetAppId: targetId, projectFlowId: flow.id, sourceHash: flow.profile.sourceHash, artifactHash: flow.artifact.archiveHash, selectionHash: flow.selectionHash,
      requestKey: randomUUID(), agentRunId: run.id, consumerRoot: ".", args: { port: null, planId: "small" },
      database: { hostname: "ll-database-fixture", type: "postgres", version: "16.4", planId: "small", bundleId: "basic", networkId: "d".repeat(24), publicNetwork: false },
      cost: { planHourlyToman: 100.25, bundleHourlyToman: 10.5, combinedTotal: "not_computed", extras: "unknown", expiresAt: now + 600000 } } };
  await page.reload(); const card = page.locator('section[aria-labelledby="database-title"]');
  if (baseline) {
    for (const width of [360, 1280]) { await page.setViewportSize({ width, height: 900 }); await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: join(output, `database-before-${width}.png`), fullPage: true }); }
    assert.equal(await card.count(), 0);
  } else {
    const approve = card.getByRole("button", { name: "تأیید و ساخت دیتابیس", exact: true }); await approve.waitFor();
    for (const width of [320, 360, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 }); await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze(); assert.deepEqual(axe.violations.map(row => row.id), []);
      layouts.push({ width, overflow: false, axeViolations: 0 });
    }
    await page.setViewportSize({ width: 360, height: 900 }); await approve.focus(); assert.equal(await approve.evaluate(node => node === document.activeElement), true);
    await page.screenshot({ path: join(output, "database-after-360.png"), fullPage: true }); await approve.press("Enter"); await card.getByText("تصمیم شما ثبت شد؛ ساخت در صف اجراست.", { exact: true }).waitFor();
    mode = "awaiting_approval"; await page.reload(); await approve.waitFor();
    await card.getByRole("button", { name: "رد ساخت دیتابیس", exact: true }).press("Enter"); await card.getByText("ساخت دیتابیس رد شد؛ درخواستی ارسال نشد.", { exact: true }).waitFor();
    mode = "expired"; await page.reload(); await card.getByRole("button", { name: "بستن پیشنهاد منقضی‌شده", exact: true }).waitFor(); assert.equal(await approve.count(), 0);
    mode = "uncertain"; await page.reload(); await card.getByRole("button", { name: "بررسی نتیجه ساخت دیتابیس", exact: true }).waitFor(); assert.equal(await approve.count(), 0);
    await card.getByRole("button", { name: "بررسی نتیجه ساخت دیتابیس", exact: true }).click(); await card.getByText("هویت دیتابیس تأیید شد؛ اتصال امن، migration و ماندگاری داده هنوز بررسی نشده‌اند.", { exact: true }).waitFor();
    await page.getByRole("button", { name: "آماده‌کردن اتصال امن دیتابیس", exact: true }).click();
    const env = page.locator('section[aria-labelledby="environment-title"]'); await env.getByRole("button", { name: "تأیید و اعمال اطلاعات برنامه", exact: true }).waitFor();
    assert.equal(await env.locator('input[type="password"]').count(), 0);
    await env.getByRole("button", { name: "رد این تغییر", exact: true }).press("Enter"); await env.getByRole("button", { name: "آماده‌کردن اتصال امن دیتابیس", exact: true }).waitFor();
    await page.setViewportSize({ width: 1280, height: 900 }); await page.screenshot({ path: join(output, "database-after-1280.png"), fullPage: true });
    assert.equal(decisions.length, 5); assert.deepEqual(errors, []); assert.equal(store.db.prepare("SELECT count(*) n FROM attempts").get().n, 0);
  }
  await writeFile(join(output, "results.json"), JSON.stringify({ baseline, layouts, errors, decisions, modelCalls: 0, cloudWrites: 0 }, null, 2));
  console.log(JSON.stringify({ baseline, output, layouts, errors, modelCalls: 0, cloudWrites: 0 }));
} finally { store?.close(); await context.close(); await browser.close(); await server.close(); }
