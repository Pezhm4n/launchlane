import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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

const server = await startTestServer({ agentFixture: true }), browser = await chromium.launch({ headless: true }),
  context = await browser.newContext({ locale: "fa-IR", reducedMotion: "reduce" }), page = await context.newPage(),
  output = resolve(".artifacts/network-review", new Date().toISOString().replaceAll(":", "-"));
await mkdir(output, { recursive: true });
const errors = [], requests = [], layouts = [];
page.on("pageerror", error => errors.push(error.message));
page.on("request", request => { if (request.method() === "POST") requests.push(new URL(request.url()).pathname); });
await context.route("**/*", route => new URL(route.request().url()).origin === server.origin ? route.continue() : route.abort());
let store;
try {
  await page.goto(server.origin);
  await page.getByLabel("کلید ورود محلی", { exact: true }).fill(server.token);
  await page.getByRole("button", { name: "ورود به میز کار", exact: true }).click();
  await page.getByRole("button", { name: "امتحان با پروژه نمونه", exact: true }).click();
  await page.locator("h1").filter({ hasText: "node-service" }).waitFor();
  const actor = createHash("sha256").update(server.token).digest("hex").slice(0, 24), accountId = "b".repeat(24);
  store = new Store(join(server.stateDir, "state.sqlite"));
  const config = readConfig({ LAUNCHLANE_STATE_DIR: server.stateDir, LAUNCHLANE_WORKSPACE_ROOT: server.workspace,
    LAUNCHLANE_OPERATOR_TOKEN: server.token, LAUNCHLANE_SESSION_SECRET: server.sessionSecret, LIARA_TEAM_ID: server.teamId,
    LAUNCHLANE_APP_ALLOWLIST: server.app });
  store.saveConnection(actor, { source: "token", ciphertext: sealCredential("synthetic-network-test-key", server.sessionSecret, actor, "liara"),
    view: { provider: "liara", status: "connected", identityId: accountId, displayName: "حساب آزمایشی شبکه", login: "network@example.test",
      teamName: "تیم آزمایشی شبکه", teamId: server.teamId, checkedAt: Date.now(), apps: [], selectedApp: null } });
  const flow = store.getProjectFlow(actor), repo = new AgentRepository(store), selected = currentAgentContext(config, store, actor),
    input = { projectId: flow.id, sourceHash: flow.profile.sourceHash, path: "/", expectedText: "invoice service" },
    run = repo.create(actor, "synthetic-network-review-key", selected, "انتشار پروژه و تصمیم شبکه لازم", { maxModelCalls: 10, maxToolCalls: 30, runTimeoutMs: 120000 },
      { ...input, kind: "publication", identity: fingerprint({ input, context: selected }) }).run;
  const action = store.createAction(actor, { version: 13, operation: "create_network", scope: { teamId: server.teamId, app: server.app },
    sourceHash: flow.profile.sourceHash, artifactHash: flow.artifact.archiveHash, projectFlowId: flow.id, selectionHash: flow.selectionHash,
    accountId, previousAppId: null, agentRunId: run.id, networkName: "ll-12345678-1234567890abcdef", args: { port: null, planId: null },
    cost: { state: "unknown", amount: null, currency: null, period: null } });
  run.network = action; run.networkContinued = false; run.state = "needs_approval"; run.nextAction = null; repo.save(actor, run);
  await page.reload();
  const card = page.locator('section[aria-labelledby="network-title"]'), approve = card.getByRole("button", { name: "تأیید و ساخت شبکه", exact: true }),
    acknowledgment = card.getByRole("checkbox", { name: "هزینه مستقل شبکه مشخص نیست؛ ساخت همین یک شبکه را می‌پذیرم.", exact: true });
  await approve.waitFor(); assert.equal(await approve.isDisabled(), true);
  await acknowledgment.focus(); await acknowledgment.press("Space"); assert.equal(await approve.isEnabled(), true);
  await approve.focus(); assert.equal(await approve.evaluate(node => node === document.activeElement), true);
  const before = repo.get(actor, run.id).usage, beforeRequests = requests.length;
  await page.reload(); await approve.waitFor(); assert.equal(await approve.isDisabled(), true);
  assert.deepEqual(repo.get(actor, run.id).usage, before); assert.equal(requests.length, beforeRequests);
  for (const width of [320, 360, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 }); await page.evaluate(async () => { await document.fonts.ready; scrollTo(0, 0); });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    assert.deepEqual(axe.violations.map(item => item.id), []); layouts.push({ width, overflow: false, axeViolations: 0 });
  }
  await page.setViewportSize({ width: 360, height: 844 }); await page.screenshot({ path: join(output, "network-review-360.png"), fullPage: true });
  await card.getByRole("button", { name: "رد ساخت شبکه", exact: true }).focus();
  await card.getByRole("button", { name: "رد ساخت شبکه", exact: true }).press("Enter");
  await card.getByText("ساخت شبکه رد شد؛ درخواستی ارسال نشد.", { exact: true }).waitFor();
  assert.equal(store.getAction(action.id, actor).state, "cancelled"); assert.equal(store.db.prepare("SELECT COUNT(*) n FROM attempts").get().n, 0);
  assert.equal(repo.get(actor, run.id).id, run.id); assert.deepEqual(repo.get(actor, run.id).usage, before);
  assert.deepEqual(errors, []);
  await writeFile(join(output, "results.json"), JSON.stringify({ layouts, errors, model: "not_called", cloudWrites: 0, oracle: "review/explicit-checkbox/keyboard/refresh/rejection; synthetic action, no live creation" }, null, 2));
  console.log(JSON.stringify({ states: layouts.length, output, modelCalls: 0, cloudWrites: 0 }));
} finally { store?.close(); await context.close(); await browser.close(); await server.close(); }
