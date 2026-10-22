import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { setTimeout as pause } from "node:timers/promises";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";
import { Store } from "../src/server/persistence/store.ts";
import { AgentRepository } from "../src/server/agent/store.ts";
import { repairBrokenSource } from "../tests/helpers/agent-fixture.ts";
import { startTestServer } from "./test-server.mjs";
import { readConfig } from "../src/server/config.ts";
import { sealCredential } from "../src/server/connections/credentials.ts";
import { currentAgentContext } from "../src/server/agent/tools.ts";
import { proposeWorkloadDeployment } from "../src/server/application/deployment.ts";
import { LiaraReadClient } from "../src/server/liara/client.ts";

const server = await startTestServer({ agentFixture: true }),
  browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: "fa-IR", reducedMotion: "reduce" });
const output = resolve(".artifacts/agent-ui", new Date().toISOString().replaceAll(":", "-"));
await mkdir(output, { recursive: true });
const results = [],
  errors = [],
  external = [];
context.on("page", (page) => page.on("pageerror", (error) => errors.push(error.message)));
await context.route("**/*", (route) => {
  const url = new URL(route.request().url());
  if (url.origin !== server.origin) {
    external.push(url.host);
    return route.abort();
  }
  return route.continue();
});
const page = await context.newPage(),
  panel = page.locator(".agent-panel"),
  goal = panel.getByRole("textbox");
const actor = createHash("sha256").update(server.token).digest("hex").slice(0, 24);
let store;
async function modelRequests() {
  try {
    return (await readFile(server.modelLog, "utf8")).trim().split("\n").filter(Boolean).length;
  } catch {
    return 0;
  }
}
async function badge(text) {
  await panel.locator(".badge").filter({ hasText: text }).waitFor();
}
async function submit(text) {
  await goal.fill(text);
  await panel.getByRole("button", { name: "ارسال درخواست", exact: true }).click();
}
async function fresh() {
  await panel.getByRole("button", { name: "گفت‌وگوی تازه", exact: true }).click();
}
async function layout(width, label) {
  await page.setViewportSize({ width, height: 900 });
  await page.evaluate(async () => document.fonts.ready);
  const geometry = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  assert.ok(geometry.content <= geometry.viewport, `${label}: horizontal overflow`);
  const controls = await panel.locator("button:visible,textarea:visible").evaluateAll((nodes) =>
    nodes.map((node) => ({
      width: node.getBoundingClientRect().width,
      height: node.getBoundingClientRect().height,
    })),
  );
  assert.ok(
    controls.every((control) => control.width >= 44 && control.height >= 44),
    `${label}: small target`,
  );
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  assert.deepEqual(
    axe.violations.map((row) => ({ id: row.id, nodes: row.nodes.map((node) => node.target) })),
    [],
    `${label}: accessibility`,
  );
  results.push({
    width,
    label,
    overflow: geometry.content - geometry.viewport,
    axeViolations: axe.violations.length,
  });
}
try {
  const project = join(server.workspace, "invoice-service");
  await mkdir(project);
  await writeFile(
    join(project, "package.json"),
    JSON.stringify({
      name: "invoice-service",
      type: "module",
      engines: { node: ">=22" },
      scripts: { start: "node server.mjs", test: "node --test" },
    }),
  );
  await writeFile(
    join(project, "server.mjs"),
    "import http from 'node:http';http.createServer((_req,res)=>res.end('invoices')).listen(3000);\n",
  );
  await writeFile(join(project, "invoice.mjs"), repairBrokenSource);
  await writeFile(
    join(project, "invoice.test.mjs"),
    "import {test} from 'node:test';import assert from 'node:assert/strict';import {invoiceTotal} from './invoice.mjs';test('quantity, zero, decimals and empty invoice',()=>{assert.equal(invoiceTotal([{price:13,quantity:3},{price:4,quantity:0},{price:2.5,quantity:2}]),44);assert.equal(invoiceTotal([]),0);});\n",
  );
  await page.setViewportSize({ width: 360, height: 844 });
  await page.goto(server.origin);
  await page.getByLabel("کلید ورود محلی", { exact: true }).fill(server.token);
  await page.getByRole("button", { name: "ورود به میز کار", exact: true }).click();
  await page.getByRole("heading", { name: "دستیار پروژه", level: 1, exact: true }).waitFor();
  await panel.getByText("در حال بازیابی گفت‌وگو…", { exact: true }).waitFor({ state: "hidden" });
  assert.equal(await page.locator(".project-choice:visible").count(), 0);
  assert.equal(
    await page.getByRole("heading", { name: "نتیجه بررسی پروژه", exact: true }).isVisible(),
    false,
  );
  assert.equal(await page.getByLabel("پورت برنامه", { exact: true }).isVisible(), false);
  for (const width of [360, 768, 1280]) {
    await layout(width, "default-agent-tab");
    await page.screenshot({ path: join(output, `agent-empty-${width}.png`), fullPage: true });
  }
  await goal.fill("متن ناتمام من برای پروژه");
  await page.getByRole("button", { name: "انتشار پروژه", exact: true }).click();
  await page.getByRole("heading", { name: "پروژه‌تان را انتخاب کنید", exact: true }).waitFor();
  assert.equal(await panel.isVisible(), false);
  await page.goBack();
  await panel.waitFor();
  assert.equal(await goal.inputValue(), "متن ناتمام من برای پروژه");
  const picker = panel.getByRole("button", { name: "انتخاب پروژه", exact: true });
  await picker.focus();
  await picker.press("Enter");
  const folder = page.getByRole("dialog", { name: "انتخاب پوشه پروژه", exact: true });
  await folder.waitFor();
  await folder.press("Escape");
  await folder.waitFor({ state: "detached" });
  assert.equal(await picker.evaluate((node) => node === document.activeElement), true);
  await picker.click();
  await folder.getByRole("button", { name: /invoice-service/ }).click();
  await folder.getByRole("button", { name: "انتخاب همین پوشه", exact: true }).click();
  await panel.locator(".agent-project-name").filter({ hasText: "invoice-service" }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("view"), "agent");
  assert.equal(await page.locator(".project-choice:visible").count(), 0);
  assert.equal(await goal.inputValue(), "متن ناتمام من برای پروژه");
  await submit("این پروژه را برای انتشار بررسی کن");
  await badge("منتظر پاسخ شما");
  await panel.getByRole("button", { name: "اتصال حساب", exact: true }).waitFor();
  const beforeReload = await modelRequests();
  assert.equal(beforeReload, 3);
  await page.reload();
  await badge("منتظر پاسخ شما");
  assert.equal(await modelRequests(), beforeReload);
  const connection = panel.getByRole("button", { name: "اتصال حساب", exact: true });
  await connection.focus();
  await connection.press("Enter");
  const accounts = page.getByRole("dialog", { name: "حساب‌ها و دسترسی", exact: true });
  await accounts.waitFor();
  await accounts.press("Escape");
  await accounts.waitFor({ state: "detached" });
  assert.equal(await connection.evaluate((node) => node === document.activeElement), true);
  await layout(360, "tool-result-and-reload-without-replay");
  await fresh();
  await submit("خطای تعداد در فاکتور را اصلاح کن");
  await badge("منتظر تصمیم شما");
  store = new Store(join(server.stateDir, "state.sqlite"));
  let run = new AgentRepository(store).get(actor);
  assert.equal(run.repair.beforeTest, null);
  const proposalRequests = await modelRequests();
  await page.reload();
  await badge("منتظر تصمیم شما");
  assert.equal(await modelRequests(), proposalRequests);
  await layout(360, "pending-local-repair-no-execution");
  await panel.getByRole("button", { name: "رد اصلاح", exact: true }).click();
  await badge("منتظر پاسخ شما");
  run = new AgentRepository(store).get(actor);
  assert.equal(run.repair.state, "cancelled");
  assert.equal(run.repair.beforeTest, null);
  assert.equal(await modelRequests(), proposalRequests);
  await fresh();
  await submit("خطای تعداد در فاکتور را اصلاح کن");
  await badge("منتظر تصمیم شما");
  await panel.getByRole("button", { name: "تأیید اصلاح و اجرای آزمون", exact: true }).click();
  await badge("بررسی اولیه آماده است");
  run = new AgentRepository(store).get(actor);
  assert.equal(run.repair.state, "succeeded");
  assert.equal(run.repair.beforeTest.passed, false);
  assert.equal(run.repair.afterTest.passed, true);
  assert.equal(run.usage.modelCalls, 6);
  assert.equal(run.usage.toolCalls, 6);
  assert.equal(await readFile(join(project, "invoice.mjs"), "utf8"), repairBrokenSource);
  await panel.locator(".agent-project-name").filter({ hasText: "نسخه اصلاح‌شده پروژه" }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("project"), run.projectId);
  for (const width of [360, 768, 1280]) {
    await layout(width, "verified-local-repair");
    await page.screenshot({ path: join(output, `agent-repair-${width}.png`), fullPage: true });
  }
  await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
  await layout(360, "text-200-percent");
  await page.evaluate(() => (document.documentElement.style.fontSize = ""));
  await panel.getByRole("button", { name: "تغییر پروژه", exact: true }).click();
  await folder.getByRole("button", { name: /examples/ }).click();
  await folder.getByRole("button", { name: /node-service/ }).click();
  await folder.getByRole("button", { name: "انتخاب همین پوشه", exact: true }).click();
  await panel.locator(".agent-project-name").filter({ hasText: "node-service" }).waitFor();
  const explicitlySelected = new URL(page.url()).searchParams.get("project"),
    callsBeforeProjectReload = await modelRequests();
  await page.reload();
  await panel.getByText(/این گفت‌وگو برای پروژه قبلی است/).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("project"), explicitlySelected);
  assert.ok((await panel.locator(".agent-project-name").textContent()).includes("node-service"));
  assert.equal(await modelRequests(), callsBeforeProjectReload);
  await layout(360, "explicit-project-change-survives-repair-replay");
  await fresh();
  await submit("آزمون خطای ارتباط");
  await badge("بررسی کامل نشد");
  assert.equal(new AgentRepository(store).get(actor).errorCode, "PROVIDER_RATE_LIMIT");
  await layout(360, "provider-error-preserves-events");
  await fresh();
  const countBeforeCancel = await modelRequests();
  await submit("آزمون توقف");
  const deadline = Date.now() + 5000;
  while ((await modelRequests()) === countBeforeCancel && Date.now() < deadline) await pause(50);
  assert.ok((await modelRequests()) > countBeforeCancel);
  await panel.getByRole("button", { name: "توقف بررسی", exact: true }).click();
  await badge("بررسی متوقف شد");
  const cancelledCount = await modelRequests();
  await page.reload();
  await badge("بررسی متوقف شد");
  assert.equal(await modelRequests(), cancelledCount);
  await layout(360, "cancel-and-reload-without-replay");
  assert.equal(store.db.prepare("SELECT COUNT(*) AS count FROM attempts").get().count, 0);
  // Seed only the proposal boundary; the server keeps its mutation gate off throughout this UI test.
  const publicationConfig = readConfig({
    LAUNCHLANE_STATE_DIR: server.stateDir, LAUNCHLANE_WORKSPACE_ROOT: server.workspace,
    LAUNCHLANE_SESSION_SECRET: server.sessionSecret, LIARA_TEAM_ID: server.teamId,
    LAUNCHLANE_APP_ALLOWLIST: server.app, LIARA_API_TOKEN: "synthetic-publication-key",
    LAUNCHLANE_ENABLE_LIVE_LIARA: "true", LAUNCHLANE_ENABLE_MUTATIONS: "true",
    LAUNCHLANE_PROBE_ORIGINS: JSON.stringify({ [server.app]: "https://sample.example.com" }),
  });
  store.saveConnection(actor, { source: "token", ciphertext: sealCredential(publicationConfig.liaraToken,
    publicationConfig.sessionSecret, actor, "liara"), view: {
      provider: "liara", status: "connected", identityId: "test-account", displayName: "حساب آزمون",
      login: "test@example.test", checkedAt: Date.now(), teamId: server.teamId, teamName: "تیم آزمون",
      selectedApp: server.app, apps: [{ id: "test-app-id", name: server.app, platform: "node" }],
    } });
  const publication = await proposeWorkloadDeployment(publicationConfig, store, actor, {
    flowId: explicitlySelected, app: server.app, port: null,
    workload: { origin: "https://sample.example.com", path: "/orders", status: 200,
      assertion: { kind: "json", field: "total", equals: 81 } },
  }, AbortSignal.timeout(3000), { read: new LiaraReadClient(publicationConfig, async () => Response.json({
    project: { _id: "test-app-id", project_id: server.app, type: "node", status: "Running", planID: "current-plan", envs: [] },
  })) });
  const repository = new AgentRepository(store), publicationRun = repository.create(actor, randomUUID(),
    currentAgentContext(publicationConfig, store, actor), "این نسخه را منتشر کن", { maxModelCalls: 16, maxToolCalls: 80, runTimeoutMs: 600000 }).run;
  publicationRun.publication = publication;
  publicationRun.state = "needs_approval";
  repository.save(actor, publicationRun);
  const beforePublicationReload = await modelRequests();
  await page.reload();
  await badge("منتظر تصمیم شما");
  const approvePublication = panel.getByRole("button", { name: "تأیید و انتشار این نسخه", exact: true });
  for (const width of [360, 768, 1280]) {
    await layout(width, "publication-decision");
    await page.screenshot({ path: join(output, `agent-publication-${width}.png`), fullPage: true });
  }
  await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
  await layout(360, "publication-text-200-percent");
  await page.evaluate(() => (document.documentElement.style.fontSize = ""));
  await approvePublication.focus();
  await approvePublication.press("Enter");
  await panel.getByRole("alert").getByText("انتشار واقعی در این نصب خاموش است.", { exact: true }).waitFor();
  assert.equal(store.getAction(publication.id, actor).state, "awaiting_approval");
  await panel.getByRole("button", { name: "رد انتشار", exact: true }).click();
  await badge("منتظر پاسخ شما");
  assert.equal(store.getAction(publication.id, actor).state, "cancelled");
  assert.equal(await modelRequests(), beforePublicationReload);
  assert.equal(store.db.prepare("SELECT COUNT(*) AS count FROM attempts").get().count, 0);
  await layout(360, "rejected-publication-no-execution");
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  await writeFile(
    join(output, "results.json"),
    JSON.stringify(
      {
        transport: "synthetic-model",
        tests: "actual-isolated-node",
        results,
        errors,
        external,
        modelRequests: await modelRequests(),
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      states: results.length,
      widths: [360, 768, 1280],
      model: "synthetic",
      nodeTests: "actual",
      output,
    }),
  );
} finally {
  store?.close();
  await context.close();
  await browser.close();
  await server.close();
}
