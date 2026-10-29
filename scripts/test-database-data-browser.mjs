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
import { sealCredential } from "../src/server/connections/credentials.ts";
import { fingerprint } from "../src/server/policy/action.ts";

// UI-only synthetic receipts/transport. Actual SQL and host scope checks have separate tests.
const baseline = process.env.LAUNCHLANE_TEST_DATA_BASELINE === "true", server = await startTestServer({ agentFixture: true });
const output = resolve(".artifacts/database-data", new Date().toISOString().replaceAll(":", "-"));
const browser = await chromium.launch({ headless: true }), context = await browser.newContext({ locale: "fa-IR", reducedMotion: "reduce" });
const page = await context.newPage(), results = [], errors = [], external = [];
let store;
try {
  await mkdir(output, { recursive: true });
  const actor = createHash("sha256").update(server.token).digest("hex").slice(0, 24), accountId = "b".repeat(24), appId = "c".repeat(24);
  const config = readConfig({ LAUNCHLANE_STATE_DIR: server.stateDir, LAUNCHLANE_WORKSPACE_ROOT: server.workspace, LAUNCHLANE_SESSION_SECRET: server.sessionSecret,
    LIARA_TEAM_ID: server.teamId, LAUNCHLANE_APP_ALLOWLIST: server.app });
  await mkdir(server.stateDir, { recursive: true });
  store = new Store(join(server.stateDir, "state.sqlite"));
  store.saveConnection(actor, { source: "token", ciphertext: sealCredential("synthetic-fixture-token", server.sessionSecret, actor, "liara"), view: {
    provider: "liara", status: "connected", identityId: accountId, displayName: "حساب آزمون", login: "fixture@example.test", teamId: server.teamId,
    teamName: "تیم آزمون", selectedApp: server.app, checkedAt: Date.now(), apps: [{ id: appId, name: server.app, platform: "node" }] } });
  const flow = await prepareProjectFlow(config, store, actor, { kind: "local", directory: "examples/node-service" }, AbortSignal.timeout(10000));
  assert.ok(flow.artifact);
  const spec = { version: 7, operation: "deploy", scope: { teamId: server.teamId, app: server.app }, accountId, targetAppId: appId,
    projectFlowId: flow.id, sourceHash: flow.profile.sourceHash, selectionHash: flow.selectionHash, artifactHash: flow.artifact.archiveHash,
    nodeVersion: flow.profile.nodeRuntime.version, args: { port: flow.profile.port, planId: "g2-standard" },
    workload: { origin: "https://sample-node.liara.run", path: "/", status: 200, assertion: { kind: "text", contains: "Runner lifecycle" } } };
  const action = store.createAction(actor, spec), verification = { version: 1, buildJobId: randomUUID(), testedSourceHash: flow.profile.sourceHash,
    planHash: "1".repeat(64), outputArtifactHash: "2".repeat(64), outputDirectory: "dist", apiChecks: [{ path: "/api/ready", status: 200, assertions: [{ pointer: ["connected"], equals: true }] }] };
  const full = { ...spec, version: 23, environment: null, verification };
  store.db.prepare("UPDATE actions SET spec=?,hash=?,state='succeeded',remote_id=? WHERE id=?").run(JSON.stringify(full), fingerprint({ actorId: actor, spec: full }), "fixture-release", action.id);
  store.db.prepare("INSERT INTO deployment_progress VALUES (?,?)").run(action.id, JSON.stringify({ stage: "release_accepted", sourceId: "fixture-source",
    releaseAcceptedAt: Date.now(), observation: { outcome: "verified", code: "WORKLOAD_VERIFIED", releaseId: "fixture-release", releaseState: "READY", status: 200, checkedAt: Date.now() } }));
  const repo = new AgentRepository(store), agentContext = currentAgentContext(config, store, actor), missionInput = { projectId: flow.id, sourceHash: flow.profile.sourceHash, path: "/", expectedText: "Runner lifecycle" };
  const run = repo.create(actor, randomUUID(), agentContext, "نسخه و داده را بررسی کن", { maxModelCalls: 24, maxToolCalls: 160, runTimeoutMs: 600000 },
    { kind: "publication", ...missionInput, identity: fingerprint({ input: missionInput, context: agentContext }) }).run;
  run.publication = store.getAction(action.id, actor); run.state = "partially_completed"; run.nextAction = "reply"; run.effect = "remote_changes_verified";
  addEvent(run, "assistant", "نسخه منتشر شد؛ بررسی مستقل داده هنوز جداست."); repo.save(actor, run);
  let latest = null, mode = "success", posts = 0, gets = 0;
  const observation = (baselineId = null) => ({ id: randomUUID(), actionId: action.id, releaseId: "fixture-release", artifactHash: flow.artifact.archiveHash, checkedAt: Date.now(),
    outcome: mode === "failed" ? "failed" : "verified", targets: ["auth", "profile"].map((id, i) => ({ id, databaseId: String(i + 4).repeat(24), serverMajor: 16,
      columnChecks: 5, rowChecks: 2, persistenceChecks: 1, schemaMatches: mode !== "failed", rowsMatch: true, persistencePresent: true, persistenceNonNull: true })),
    baselineId, comparison: baselineId ? mode === "failed" || latest?.outcome !== "verified" ? "not_comparable" : "same_selected_values" : "not_requested", migrationVerified: false, applicationWriteVerified: false, restartPersistenceVerified: false, remoteChanges: false });
  await context.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== server.origin) { external.push(url.origin); return route.abort(); }
    if (url.pathname !== "/api/projects/database-data") return route.continue();
    if (request.method() === "GET") { gets++;
      if (mode === "stored-error") return route.fulfill({ status: 503, json: { error: { code: "INTERNAL_UNAVAILABLE", message: "خواندن شاهد ذخیره‌شده موقتاً کامل نشد.", retryable: true, requestId: randomUUID() } } });
      return route.fulfill({ json: { available: true, enabled: mode !== "disabled", latest } }); }
    posts++; assert.equal(request.method(), "POST"); assert.ok(request.headers()["x-csrf-token"]);
    const input = request.postDataJSON(); assert.equal(input.actionId, action.id); assert.deepEqual(Object.keys(input).sort(), ["actionId", "baselineId"]);
    assert.ok(input.baselineId === null || input.baselineId === latest?.id);
    if (mode === "waiting") { await new Promise(resolve => setTimeout(resolve, 1500)); return route.fulfill({ json: observation() }).catch(() => undefined); }
    if (mode === "denied") return route.fulfill({ status: 409, json: { error: { code: "DATABASE_DATA_RELEASE_CHANGED", message: "نسخهٔ جاری تغییر کرده است؛ نسخهٔ فعال را انتخاب کنید.", retryable: false, requestId: randomUUID() } } });
    latest = observation(input.baselineId); return route.fulfill({ json: latest });
  });
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${server.origin}/?view=publish&project=${flow.id}`);
  await page.getByLabel("کلید ورود محلی", { exact: true }).fill(server.token); await page.getByRole("button", { name: "ورود به میز کار", exact: true }).click();
  const card = page.locator(".publication-journey .publication-card"); await card.getByText("سایت شما منتشر شد", { exact: true }).waitFor();
  const capture = async (width, state) => {
    await page.setViewportSize({ width, height: 900 }); await page.evaluate(async () => { await document.fonts.ready; });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze(); assert.deepEqual(axe.violations.map(row => row.id), []);
    await card.screenshot({ path: join(output, `${state}-${width}.png`) }); results.push({ width, state, overflow: false, axeViolations: 0 });
  };
  if (baseline) { for (const width of [320, 1280]) await capture(width, "before"); assert.equal(posts, 0); }
  else {
    const disclosure = card.locator(".database-data-check"), button = disclosure.getByRole("button", { name: "بررسی اتصال و داده", exact: true });
    await disclosure.getByText("بررسی دیتابیس‌های این نسخه", { exact: true }).click(); await button.waitFor();
    assert.equal(posts, 0); await button.focus(); await page.keyboard.press("Enter"); await disclosure.getByText("اتصال و معیارهای انتخاب‌شدهٔ داده تأیید شدند.", { exact: true }).waitFor();
    for (const width of [280, 320, 390, 768, 1280]) await capture(width, "verified");
    assert.equal(posts, 1); const previousGets = gets; await page.reload(); await card.waitFor(); await disclosure.getByText("بررسی دیتابیس‌های این نسخه", { exact: true }).click(); await button.waitFor(); assert.equal(posts, 1); assert.ok(gets > previousGets);
    await disclosure.getByRole("button", { name: "مقایسه با بررسی قبلی", exact: true }).click(); await disclosure.getByText("مقادیر انتخاب‌شده با بررسی قبلی برابرند؛ این مقایسه ماندگاری پس از restart را ثابت نمی‌کند.", { exact: true }).waitFor(); assert.equal(posts, 2);
    mode = "denied"; await button.click(); await disclosure.getByRole("alert").filter({ hasText: "نسخهٔ جاری تغییر کرده" }).waitFor(); await capture(320, "changed-release");
    mode = "failed"; await button.click(); await disclosure.getByText("دست‌کم یکی از معیارهای داده تأیید نشد.", { exact: true }).waitFor(); await capture(320, "failed");
    mode = "waiting"; await button.click(); const cancel = disclosure.getByRole("button", { name: "لغو بررسی", exact: true }); await cancel.waitFor(); await cancel.focus(); await page.keyboard.press("Enter"); await disclosure.getByRole("status").filter({ hasText: "بررسی لغو شد" }).waitFor();
    assert.equal(await button.evaluate(node => node === document.activeElement), true); await capture(320, "cancelled");
    mode = "stored-error"; const beforeRetry = posts; await page.reload(); await card.waitFor(); await disclosure.getByText("بررسی دیتابیس‌های این نسخه", { exact: true }).click();
    const retry = disclosure.getByRole("button", { name: "خواندن دوبارهٔ بررسی قبلی", exact: true }); await retry.waitFor(); await capture(320, "stored-error");
    mode = "success"; await retry.focus(); await page.keyboard.press("Enter"); await button.waitFor(); await disclosure.getByText("دست‌کم یکی از معیارهای داده تأیید نشد.", { exact: true }).waitFor(); assert.equal(posts, beforeRetry);
    mode = "disabled"; const beforeReload = posts; await page.reload(); await card.waitFor(); await disclosure.getByText("بررسی دیتابیس‌های این نسخه", { exact: true }).click(); await button.waitFor(); assert.equal(await button.isDisabled(), true); assert.equal(posts, beforeReload); await capture(320, "disabled");
  }
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  assert.equal(store.db.prepare("SELECT count(*) n FROM attempts").get().n, 0);
  const modelLog = (await readFile(server.modelLog, "utf8").catch(() => "")).trim(); assert.equal(modelLog, "");
  await writeFile(join(output, "summary.json"), JSON.stringify({ baseline, synthetic: true, actualSql: false, posts, results, errors, external }, null, 2));
  console.log(JSON.stringify({ output, baseline, states: results.length, posts, realModelCalls: 0, cloudWrites: 0 }));
} finally { store?.close(); await context.close(); await browser.close(); await server.close(); }
