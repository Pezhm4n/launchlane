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

// UI-only provider/run views. Domain tests own source/storage/approval policy;
// this harness never treats a rendered card as evidence of a cloud write.
const baseline = process.env.LAUNCHLANE_DISK_UI_BASELINE === "true";
const output = resolve(".artifacts/disk-review", `${baseline ? "before" : "after"}-${new Date().toISOString().replaceAll(":", "-")}`);
const server = await startTestServer({ agentFixture: true }), browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: "fa-IR", reducedMotion: "reduce" }), page = await context.newPage();
const errors = [], decisions = [], layouts = [];let store, runId, action, mode = "awaiting_approval";
await mkdir(output, { recursive: true });page.on("pageerror", error => errors.push(error.message));
await context.route("**/*", async route => {
  const request = route.request(), url = new URL(request.url());
  if (url.origin !== server.origin) return route.abort();
  if (!runId || !url.pathname.startsWith("/api/agent/")) return route.continue();
  if (request.method() === "POST" && url.pathname === `/api/agent/runs/${runId}`) {
    const body = request.postDataJSON();decisions.push(body);
    assert.equal(body.actionId, action.id);assert.equal(body.operation, "disk-decision");
    mode = body.decision === "reject" ? "cancelled" : "approved";
    const response = await context.request.get(`${server.origin}/api/agent/runs/${runId}`), payload = await response.json();
    return route.fulfill({ status: 200, json: { ...payload, run: view(payload.run) } });
  }
  const response = await route.fetch();
  if (response.headers()["content-type"]?.includes("application/json")) {
    const payload = await response.json();
    if (payload.run?.id === runId) return route.fulfill({ response, json: { ...payload, run: view(payload.run) } });
  }
  return route.fulfill({ response });
});
function view(run) {
  const expired = mode === "expired";
  return { ...run, state: ["awaiting_approval", "expired"].includes(mode) ? "needs_approval" : "partially_completed", nextAction: null,
    disk: { ...action, state: mode, expiresAt: expired ? Date.now() - 1000 : action.expiresAt,
      ...(mode === "uncertain" ? { attemptId: "ui-only-attempt", disk: { stage: "request_started", checkedAt: Date.now(), outcome: "inconclusive", diskId: null } } : {}) }, diskContinued: false };
}
try {
  await page.goto(server.origin);await page.getByLabel("کلید ورود محلی", { exact: true }).fill(server.token);
  await page.getByRole("button", { name: "ورود به میز کار", exact: true }).click();
  await page.getByRole("button", { name: "امتحان با پروژه نمونه", exact: true }).click();
  await page.locator("h1").filter({ hasText: "node-service" }).waitFor();
  store = new Store(join(server.stateDir, "state.sqlite"));
  const actor = createHash("sha256").update(server.token).digest("hex").slice(0, 24), accountId = "b".repeat(24), targetId = "d".repeat(24);
  const config = readConfig({ LAUNCHLANE_STATE_DIR: server.stateDir, LAUNCHLANE_WORKSPACE_ROOT: server.workspace, LAUNCHLANE_OPERATOR_TOKEN: server.token,
    LAUNCHLANE_SESSION_SECRET: server.sessionSecret, LIARA_TEAM_ID: server.teamId, LAUNCHLANE_APP_ALLOWLIST: server.app });
  store.saveConnection(actor, { source: "token", ciphertext: sealCredential("synthetic-disk-ui-key", server.sessionSecret, actor, "liara"), view: {
    provider: "liara", status: "connected", identityId: accountId, displayName: "حساب آزمون", login: "disk@example.test", teamName: "تیم آزمون", teamId: server.teamId,
    checkedAt: Date.now(), apps: [{ id: targetId, name: server.app, platform: "node" }], selectedApp: server.app } });
  const flow = store.getProjectFlow(actor), repo = new AgentRepository(store), selected = currentAgentContext(config, store, actor),
    input = { projectId: flow.id, sourceHash: flow.profile.sourceHash, path: "/", expectedText: "invoice service" },
    run = repo.create(actor, randomUUID(), selected, "بررسی رابط تصمیم فضای پایدار", { maxModelCalls: 10, maxToolCalls: 40, runTimeoutMs: 120000 },
      { ...input, kind: "publication", identity: fingerprint({ input, context: selected }) }).run;
  runId = run.id;run.state = "needs_approval";run.nextAction = null;repo.save(actor, run);
  const now = Date.now();action = { id: randomUUID(), actorId: actor, hash: "1".repeat(64), createdAt: now, expiresAt: now + 600000,
    state: "awaiting_approval", attemptId: null, remoteId: null, errorCode: null, spec: { version: 25, operation: "create_disk", scope: { teamId: server.teamId, app: server.app },
      accountId, targetAppId: targetId, projectFlowId: flow.id, sourceHash: flow.profile.sourceHash, artifactHash: flow.artifact.archiveHash, selectionHash: flow.selectionHash,
      requestKey: randomUUID(), agentRunId: run.id, args: { port: null, planId: "small-g2" }, bundleId: "basic", disk: { name: "ll-data-0123456789abcdef", sizeGB: 1, mountTo: "/data" },
      expected: { inventoryHash: "2".repeat(64), reservedGB: 0, capacityGB: 5, maxDisks: 2 }, cost: { effect: "existing_plan_unchanged", incrementalHourlyHundredthsToman: 0, catalogFingerprint: "3".repeat(64), observedAt: now, expiresAt: now + 600000 } } };
  await page.reload();
  const card = page.locator('section[aria-labelledby="disk-title"]');
  if (baseline) {
    for (const width of [360, 1280]) { await page.setViewportSize({ width, height: 900 });await page.evaluate(() => document.fonts.ready);await page.screenshot({ path: join(output, `disk-before-${width}.png`), fullPage: true }); }
    assert.equal(await card.count(), 0);console.log(JSON.stringify({ baseline: true, output, diskCardPresent: false }));
  } else {
    const approve = card.getByRole("button", { name: "تأیید و ساخت فضای پایدار", exact: true });await approve.waitFor();
    for (const width of [280, 320, 360, 414, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();assert.deepEqual(axe.violations.map(row => row.id), []);
      layouts.push({ width, overflow: false, axeViolations: 0 });
    }
    await page.setViewportSize({ width: 360, height: 900 });
    for (const state of ["hover", "focus"]) {
      if (state === "hover") await approve.hover();else await approve.focus();
      const axe = await new AxeBuilder({ page }).include('section[aria-labelledby="disk-title"]').withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();assert.deepEqual(axe.violations.map(row => row.id), []);
    }
    assert.equal(await approve.evaluate(node => node === document.activeElement), true);
    assert.equal(await approve.evaluate(node => { const box = node.getBoundingClientRect(), hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);return hit === node || node.contains(hit); }), true);
    await page.screenshot({ path: join(output, "disk-controls-focus-360.png") });
    await page.evaluate(() => scrollTo(0, 0));await page.screenshot({ path: join(output, "disk-after-360.png"), fullPage: true });
    await approve.press("Enter");await card.getByText("تصمیم شما ثبت شد؛ ساخت در صف اجراست.", { exact: true }).waitFor();
    mode = "awaiting_approval";await page.reload();await approve.waitFor();
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
    await card.getByRole("button", { name: "رد ساخت فضای پایدار", exact: true }).press("Enter");await card.getByText("ساخت فضای پایدار رد شد؛ درخواستی ارسال نشد.", { exact: true }).waitFor();
    assert.equal(decisions.length, 2);assert.equal(decisions[0].decision, "approve");assert.equal(decisions[1].decision, "reject");
    mode = "expired";await page.reload();await card.getByRole("button", { name: "بستن پیشنهاد منقضی‌شده", exact: true }).waitFor();assert.equal(await approve.count(), 0);
    mode = "uncertain";await page.reload();await card.getByRole("button", { name: "بررسی نتیجه ساخت فضای پایدار", exact: true }).waitFor();assert.equal(await approve.count(), 0);
    assert.equal(store.db.prepare("SELECT count(*) n FROM attempts").get().n, 0);assert.deepEqual(errors, []);
    console.log(JSON.stringify({ output, layouts, errors, modelCalls: 0, cloudWrites: 0, evidence: "UI-only synthetic action views and decision transport; domain/server storage checks are separate" }));
  }
  await writeFile(join(output, "results.json"), JSON.stringify({ baseline, layouts, errors, decisions, modelCalls: 0, cloudWrites: 0 }, null, 2));
} finally { store?.close();await context.close();await browser.close();await server.close(); }
