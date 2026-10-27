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
import { saveImportedEnvironment } from "../src/server/environment/import.ts";

// Real built components and authenticated APIs; all provider calls are denied or synthetic.
const output = resolve(".artifacts/environment-guidance", new Date().toISOString().replaceAll(":", "-"));
const states = [], pageErrors = [], external = [], operations = [];
let server, browser, store;
try {
  server = await startTestServer({ agentFixture: true, environmentFixture: true });
  await mkdir(server.stateDir, { recursive: true });
  store = new Store(join(server.stateDir, "state.sqlite"));
  const actor = createHash("sha256").update(server.token).digest("hex").slice(0, 24);
  const config = readConfig({ LAUNCHLANE_STATE_DIR: server.stateDir, LAUNCHLANE_WORKSPACE_ROOT: server.workspace,
    LAUNCHLANE_SESSION_SECRET: server.sessionSecret, LIARA_TEAM_ID: server.teamId });
  await mkdir(join(server.workspace, "signing-service"));
  await writeFile(join(server.workspace, "signing-service/package.json"), JSON.stringify({ name: "signing-service", engines: { node: "22" }, scripts: { start: "node server.mjs" } }));
  await writeFile(join(server.workspace, "signing-service/server.mjs"),
    "import http from 'node:http';const signing=process.env.JWT_SECRET;const session=process.env.SESSION_SECRET;const api=process.env.API_KEY;const publicSetting=process.env.VITE_PUBLIC_URL;http.createServer((q,s)=>s.end('ready')).listen(3000);\n");
  const flow = await prepareProjectFlow(config, store, actor, { kind: "local", directory: "signing-service" }, AbortSignal.timeout(5000));
  store.saveConnection(actor, { source: "token", ciphertext: sealCredential("synthetic-liara-environment-fixture-credential", server.sessionSecret, actor, "liara"), view: {
    provider: "liara", status: "connected", identityId: "b".repeat(24), teamId: server.teamId, teamName: "تیم آزمون", displayName: "آزمون", login: "test@example.test", checkedAt: Date.now(),
    apps: [{ id: "c".repeat(24), name: server.app, platform: "node" }], selectedApp: server.app } });
  const repo = new AgentRepository(store), context = currentAgentContext(config, store, actor),
    input = { projectId: flow.id, sourceHash: flow.profile.sourceHash, path: "/", expectedText: "ready" },
    run = repo.create(actor, randomUUID(), context, "بررسی تنظیمات برنامه", { maxModelCalls: 8, maxToolCalls: 30, runTimeoutMs: 600000 },
      { ...input, kind: "publication", identity: fingerprint({ input, context }) }).run;
  run.state = "needs_input";run.nextAction = "configure_env";
  const now = Date.now(), failedJob = { id: randomUUID(), parentRunId: run.id, projectId: flow.id, baseRevision: flow.profile.sourceHash,
    state: "failed", goal: "بررسی ساخت همین نسخه", allowedPaths: [], testFiles: [], changedPaths: [], diff: null, beforeTest: null,
    afterTest: { command: "npm run build", exitCode: 1, signal: null, durationMs: 10, passed: false, output: 'npm error Missing script: "start"' },
    artifact: null, errorCode: "BUILD_FAILED", message: "ساخت کامل نشد", createdAt: now, updatedAt: now };
  store.db.prepare("INSERT INTO code_repair_jobs VALUES(?,?,?,?,?)").run(failedJob.id, actor, "failed", now, JSON.stringify({ job: failedJob }));
  run.repair = failedJob;addEvent(run, "state", "تنظیمات باقی‌مانده را بررسی کنید.");repo.save(actor, run);
  browser = await chromium.launch({ headless: true });
  const browserContext = await browser.newContext({ locale: "fa-IR", reducedMotion: "reduce" }), page = await browserContext.newPage();
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("request", request => {
    if (new URL(request.url()).origin === server.origin && request.url().includes("/api/project-environment") && request.method() === "POST")
      operations.push(JSON.parse(request.postData()).operation);
  });
  await browserContext.route("**/*", route => {
    if (new URL(route.request().url()).origin === server.origin) return route.continue();
    external.push("blocked external request"); return route.abort();
  });
  await mkdir(output, { recursive: true });
  await page.goto(`${server.origin}/?view=publish`);await page.getByLabel("کلید ورود محلی", { exact: true }).fill(server.token);
  await page.getByRole("button", { name: "ورود به میز کار", exact: true }).click();
  const env = page.locator('section[aria-labelledby="environment-title"]'), jwt = env.locator("#environment-JWT_SECRET"),
    session = env.locator("#environment-SESSION_SECRET"), generator = env.getByRole("button", { name: "ساخت مقدار تصادفی برای JWT_SECRET", exact: true });
  await generator.waitFor();
  assert.equal(await env.getByRole("button", { name: "ساخت مقدار تصادفی برای API_KEY", exact: true }).count(), 0);
  assert.equal(await env.getByRole("button", { name: "ساخت مقدار تصادفی برای VITE_PUBLIC_URL", exact: true }).count(), 0);
  await session.fill("manual-signing-fixture-value");
  assert.equal(await env.getByRole("button", { name: "ساخت مقدار تصادفی برای SESSION_SECRET", exact: true }).isDisabled(), true);
  await page.evaluate(() => {
    const original = crypto.getRandomValues;
    window.__restoreSigningRandom = () => { Object.defineProperty(crypto, "getRandomValues", { configurable: true, value: original }); };
    Object.defineProperty(crypto, "getRandomValues", { configurable: true, value: () => { throw new Error("synthetic unavailable random source"); } });
  });
  await generator.click();await env.getByRole("alert").getByText("ساخت مقدار امن در این مرورگر در دسترس نیست؛ مقدار مناسب برنامه را دستی وارد کنید.", { exact: true }).waitFor();
  assert.equal(await jwt.inputValue(), "");assert.deepEqual(operations, []);
  await page.evaluate(() => { window.__restoreSigningRandom();delete window.__restoreSigningRandom; });
  await generator.focus();await page.keyboard.press("Enter");
  const generated = await jwt.inputValue();assert.match(generated, /^[a-f0-9]{64}$/);assert.equal(await jwt.getAttribute("type"), "password");
  assert.equal(await generator.isDisabled(), true);assert.equal(await env.getByRole("checkbox", { name: "عمومی بودن JWT_SECRET", exact: true }).isDisabled(), true);
  await session.fill("manual-signing-fixture-value-updated");
  assert.equal(await jwt.inputValue(), generated);assert.equal(await env.getByRole("checkbox", { name: "عمومی بودن JWT_SECRET", exact: true }).isDisabled(), true);
  assert.deepEqual(operations, []);assert.equal(store.db.prepare("SELECT count(*) n FROM actions").get().n, 0);
  await env.getByRole("button", { name: "نمایش مقدار JWT_SECRET", exact: true }).focus();await page.keyboard.press("Enter");
  assert.equal(await jwt.getAttribute("type"), "text");
  await env.getByRole("button", { name: "پنهان‌کردن مقدار JWT_SECRET", exact: true }).click();
  const guidance = page.getByLabel("راهنمای گزارش ناموفق", { exact: true });await guidance.getByText("فرمان شروع در گزارش پیدا نشده است.", { exact: true }).waitFor();
  async function capture(width, label) {
    await page.setViewportSize({ width, height: 950 });await page.evaluate(async () => document.fonts.ready);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${label}:${width}`);
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    assert.deepEqual(axe.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) })), [], `${label}:${width}`);
    await page.screenshot({ path: join(output, `${label}-${width}.png`), fullPage: true });states.push({ label, width, axeViolations: 0 });
  }
  for (const width of [280, 360, 768, 1280]) await capture(width, "generated-and-guidance");
  await page.setViewportSize({ width: 360, height: 950 });
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await capture(360, "text-200");
  await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
  // Reload loses unsent values. It must not generate, persist or submit one automatically.
  await page.reload();await generator.waitFor();assert.equal(await jwt.inputValue(), "");assert.equal(await session.inputValue(), "");
  assert.deepEqual(operations, []);await generator.click();
  const submitted = await jwt.inputValue();
  await env.getByRole("button", { name: "مرور تغییر اطلاعات برنامه", exact: true }).click();
  await env.getByRole("button", { name: "رد این تغییر", exact: true }).waitFor();
  assert.deepEqual(operations, ["propose"]);assert.equal(JSON.stringify(store.db.prepare("SELECT * FROM environment_inputs").all()).includes(submitted), false);
  assert.equal((await page.content()).includes(submitted), false);
  assert.equal(store.db.prepare("SELECT count(*) n FROM attempts").get().n, 0);
  await capture(360, "review");
  await env.getByRole("button", { name: "رد این تغییر", exact: true }).focus();await page.keyboard.press("Enter");
  await generator.waitFor();assert.equal(await jwt.inputValue(), "");
  assert.equal(store.db.prepare("SELECT count(*) n FROM attempts").get().n, 0);
  saveImportedEnvironment(config, store, actor, flow, [{ key: "SESSION_SECRET", value: "imported-signing-fixture-value" }]);
  await page.reload();await env.getByRole("button", { name: "مرور و استفاده از تنظیمات پوشه", exact: true }).waitFor();
  await env.getByText("واردکردن یا تغییر دستی مقدارها", { exact: true }).click();
  assert.equal(await env.getByRole("button", { name: "ساخت مقدار تصادفی برای SESSION_SECRET", exact: true }).count(), 0);
  assert.equal(await session.inputValue(), "");assert.equal((await page.content()).includes("imported-signing-fixture-value"), false);
  await capture(360, "imported-preserved");
  assert.equal(repo.get(actor, run.id).usage.modelCalls, 0);
  const logs = (await readFile(server.modelLog, "utf8").catch(() => "")).trim().split("\n").filter(Boolean).map(line => JSON.parse(line));
  assert.equal(logs.filter(row => row.environmentWrite || row.model).length, 0);
  assert.deepEqual(pageErrors, []);assert.deepEqual(external, []);
  await writeFile(join(output, "report.json"), JSON.stringify({ states, operations, pageErrors, externalRequests: 0, liveModelCalls: 0,
    providerWrites: 0, keyboardGenerationAndReject: true, randomBytes: 32, generatedValuesPersistedInPlaintext: false,
    manualValuePreserved: true, generatedValuePrivate: true, reloadClearsUnsubmittedValues: true, importedValueNotReplaced: true, unavailableCryptoFailsClosed: true, textEnlargement: "200%",
    evidence: "Built product and actual authenticated proposal/rejection; disposable synthetic source/state/provider transport. No deployment or live configuration is claimed." }, null, 2));
  console.log(JSON.stringify({ cases: states.length, pageErrors: 0, externalRequests: 0, providerWrites: 0, output }));
} finally {
  try { await browser?.close(); } finally { try { store?.close(); } finally { await server?.close(); } }
}
