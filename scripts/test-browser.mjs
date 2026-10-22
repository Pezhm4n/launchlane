import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { Store } from "../src/server/persistence/store.ts";
import { sealCredential } from "../src/server/connections/credentials.ts";
import { startTestServer } from "./test-server.mjs";
import { importedProject, incidentResponse } from "./browser-fixtures.mjs";

const server = await startTestServer(),
  browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ reducedMotion: "reduce", locale: "fa-IR" });
const output = resolve(
  ".artifacts/ux",
  new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-"),
);
await mkdir(output, { recursive: true });
const errors = [],
  external = [],
  results = [],
  providerFixtures = [];
context.on("page", (page) => {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && /hydration|hydrated|server rendered HTML/i.test(message.text())) errors.push(message.text());
  });
});
// Model the reported RTL marker being added before hydration, without suppressing React diagnostics.
await context.addInitScript(() => {
  const mark = () => {
    if (!document.documentElement) return;
    document.documentElement.classList.add("rtl-enabled");
    observer.disconnect();
  };
  const observer = new MutationObserver(mark);
  observer.observe(document, { childList: true, subtree: true });
  mark();
});
await context.route("**/*", (route) => {
  if (new URL(route.request().url()).origin !== server.origin) {
    external.push(new URL(route.request().url()).host);
    return route.abort();
  }
  return route.continue();
});
const page = await context.newPage(),
  actorId = createHash("sha256").update(server.token).digest("hex").slice(0, 24);
let store;
const liaraFixture = {
  provider: "liara",
  status: "connected",
  identityId: "synthetic-liara-identity",
  displayName: "حساب آزمایشی",
  login: "synthetic@example.test",
  checkedAt: Date.now(),
  teamId: server.teamId,
  teamName: "تیم آزمایشی",
  apps: [{ id: "synthetic-app", name: server.app, platform: "node" }],
  selectedApp: null,
};
async function layout(width, label) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  const geometry = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  assert.ok(geometry.content <= geometry.width + 1, `${label}: page overflow at ${width}`);
  const controls = await page
    .locator("button:visible, input:not([type=radio]):visible, .button-link:visible")
    .evaluateAll((elements) =>
      elements.map((element) => ({
        text: element.textContent?.trim().slice(0, 80),
        height: element.getBoundingClientRect().height,
        width: element.getBoundingClientRect().width,
      })),
    );
  assert.ok(
    controls.every((item) => item.height >= 44 && item.width >= 44),
    `${label}: small control ${JSON.stringify(controls.filter((item) => item.height < 44 || item.width < 44))}`,
  );
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  assert.deepEqual(
    accessibility.violations.map((violation) => ({
      id: violation.id,
      nodes: violation.nodes.map((node) => node.target),
    })),
    [],
    `${label}: accessibility`,
  );
  results.push({
    width,
    label,
    overflow: geometry.content - geometry.width,
    controls: controls.length,
    axeViolations: accessibility.violations.length,
  });
}
const heading = () => page.getByRole("heading", { name: "نتیجه بررسی پروژه", exact: true });
async function sample() {
  const previous = page.url();
  await page.getByRole("button", { name: "امتحان با پروژه نمونه", exact: true }).click();
  await page.waitForURL((url) => url.href !== previous);
  await heading().waitFor();
  await page.getByText("فایل‌ها آماده‌اند", { exact: true }).waitFor();
  await page.evaluate(() => window.scrollTo({ top: 0 }));
}
async function closeDialog(name) {
  await page.getByRole("dialog", { name, exact: true }).press("Escape");
  await page.getByRole("dialog", { name, exact: true }).waitFor({ state: "detached" });
}

try {
  await page.setViewportSize({ width: 360, height: 844 });
  await page.goto(`${server.origin}/?view=publish`);
  await page.getByRole("heading", { name: "وارد میز کار محلی شوید", exact: true }).waitFor();
  await page.keyboard.press("Tab");
  assert.equal(await page.locator(":focus").textContent(), "رفتن به محتوای اصلی");
  await layout(360, "signed-out");
  await page.getByLabel("کلید ورود محلی", { exact: true }).fill("invalid-local-key");
  await page.getByRole("button", { name: "ورود به میز کار", exact: true }).click();
  await page.getByRole("alert", { name: "این مرحله کامل نشد", exact: true }).waitFor();
  assert.ok(
    (
      await page.getByRole("alert", { name: "این مرحله کامل نشد", exact: true }).textContent()
    ).includes("کلید ورود محلی درست نیست"),
  );
  await page.getByLabel("کلید ورود محلی", { exact: true }).fill(server.token);
  await page.getByRole("button", { name: "ورود به میز کار", exact: true }).click();
  await page.getByRole("heading", { name: "پروژه‌تان را انتخاب کنید", exact: true }).waitFor();
  store = new Store(join(server.stateDir, "state.sqlite"));
  const folderButton = page.getByRole("button", { name: "انتخاب پوشه پروژه", exact: true });
  const choice = await folderButton.evaluate((element) => ({
    top: element.getBoundingClientRect().top + window.scrollY,
    height: window.innerHeight,
  }));
  assert.ok(
    choice.top < choice.height,
    "primary folder selection must be in the first mobile viewport",
  );
  assert.equal(await page.getByRole("link", { name: "وضعیت اجرای برنامه" }).count(), 0);
  await layout(360, "empty-workbench");
  await page.screenshot({ path: resolve(output, "choose-360.png"), fullPage: true });
  await folderButton.press("Enter");
  const folders = page.getByRole("dialog", { name: "انتخاب پوشه پروژه", exact: true });
  await folders.waitFor();
  await folders.getByRole("button", { name: /examples/ }).click();
  await folders.getByRole("button", { name: /node-service/ }).click();
  await folders.getByRole("button", { name: "انتخاب همین پوشه", exact: true }).click();
  await heading().waitFor();
  assert.ok((await page.locator(".selected-project").textContent()).includes("node-service"));
  const navLinks = page.locator(".app-nav .app-nav-link");
  assert.equal(await navLinks.count(), 3);
  assert.equal(
    await navLinks.filter({ hasText: "انتشار پروژه" }).getAttribute("aria-current"),
    "page",
  );
  const navTops = await navLinks.evaluateAll((nodes) =>
    nodes.map((node) => Math.round(node.getBoundingClientRect().top)),
  );
  assert.equal(new Set(navTops).size, 1, "workbench navigation must stay on one row");
  const shell = await page.evaluate(() => {
    const height = (selector) =>
      Math.round(document.querySelector(selector)?.getBoundingClientRect().height ?? 0);
    return {
      top: height(".app-top"),
      header: height(".app-header"),
      brand: height(".brand"),
      actions: height(".header-actions"),
      context: height(".app-context"),
      nav: height(".app-nav"),
      link: height(".app-nav-link"),
    };
  });
  assert.ok(shell.top <= 150, `mobile shell must stay compact: ${JSON.stringify(shell)}`);
  const strip = page.locator(".journey-strip");
  await strip.waitFor();
  assert.ok((await page.locator(".app-context").textContent()).includes("node-service"));
  assert.match(await strip.locator(".journey-strip-current").textContent(), /حساب و برنامه مقصد/);
  assert.equal(await strip.locator(".journey-strip-dots .current").count(), 1);
  await page.evaluate(() => window.scrollTo(0, 600));
  assert.equal(
    await page.locator(".app-top").evaluate((node) => Math.round(node.getBoundingClientRect().top)),
    0,
    "mobile shell must stay visible while scrolling",
  );
  assert.equal(await page.locator(".app-context").isVisible(), true);
  await page.evaluate(() => window.scrollTo(0, 0));
  assert.equal(await page.getByRole("button", { name: /ساخت بسته/ }).count(), 0);
  assert.equal(await page.getByLabel("پورت برنامه", { exact: true }).count(), 0);
  assert.equal(await heading().evaluate((element) => element === document.activeElement), true);
  await page.getByRole("button", { name: "تغییر پوشه پروژه", exact: true }).click();
  await folders.waitFor();
  await closeDialog("انتخاب پوشه پروژه");
  assert.equal(await heading().isVisible(), true);
  assert.equal(
    await page
      .getByRole("button", { name: "تغییر پوشه پروژه", exact: true })
      .evaluate((element) => element === document.activeElement),
    true,
  );
  const firstUrl = page.url();
  await page.reload();
  await heading().waitFor();
  assert.equal(page.url(), firstUrl);
  await layout(360, "local-project-restored-and-cancel-preserved");
  await page.getByRole("link", { name: "بررسی مشکل سایت", exact: true }).click();
  await page
    .getByRole("heading", { name: "مشکل سایت را از کجا بررسی کنیم؟", exact: true })
    .waitFor();
  await page.getByRole("link", { name: "انتشار پروژه", exact: true }).click();
  await heading().waitFor();
  assert.equal(
    new URL(page.url()).searchParams.get("project"),
    new URL(firstUrl).searchParams.get("project"),
  );
  await page.goBack();
  await page
    .getByRole("heading", { name: "مشکل سایت را از کجا بررسی کنیم؟", exact: true })
    .waitFor();
  await page.goForward();
  await heading().waitFor();
  await page.locator(".manifest summary").click();
  const manifest = await page.locator(".file-manifest").textContent();
  assert.ok(manifest.includes("package.json"));
  assert.ok(!/[a-f0-9]{64}/.test(manifest), "file review must not require reading hashes");
  await page.locator(".advanced-choice summary").click();
  await page.getByLabel("پوشه پروژه", { exact: true }).fill("missing-folder");
  await page.getByRole("button", { name: "بررسی پوشه واردشده", exact: true }).click();
  await page.getByRole("alert", { name: "پروژه بررسی نشد", exact: true }).waitFor();
  assert.ok((await page.locator("#project-error").textContent()).includes("این پوشه پیدا نشد"));
  assert.equal(await heading().isVisible(), true);
  assert.equal(
    await page.locator("#project-directory").getAttribute("aria-describedby"),
    "project-error",
  );
  await layout(360, "missing-folder-preserves-valid-project");
  for (const width of [280, 320, 360, 390, 414, 559, 560, 768, 1280]) {
    await page.setViewportSize({ width, height: width >= 768 ? 1000 : 844 });
    await sample();
    await layout(width, "sample-project-reviewed");
    assert.equal(await page.getByText("پروژه نمونه", { exact: true }).isVisible(), true);
    assert.equal(
      await page
        .getByText(/BoxAPI|توکن PaaS|SHA-256|token budget|adapter/)
        .filter({ visible: true })
        .count(),
      0,
    );
    await page.locator(".manifest summary").click();
    await layout(width, "file-list-without-hashes");
    await page.screenshot({ path: resolve(output, `review-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 360, height: 844 });
  // A controlled authentication response seeds only the isolated SQLite database. No key leaves loopback.
  await page.route("**/api/connections/liara", async (route) => {
    const request = route.request();
    if (request.method() !== "POST") return route.continue();
    const body = request.postDataJSON();
    if (body.operation !== "connect" || body.key !== "synthetic-browser-connection-key")
      return route.continue();
    providerFixtures.push("liara-account-verified-fixture");
    store.saveConnection(actorId, {
      view: liaraFixture,
      source: "token",
      ciphertext: sealCredential(body.key, server.sessionSecret, actorId, "liara"),
    });
    return route.fulfill({ json: { connection: liaraFixture } });
  });
  await page.getByRole("button", { name: "حساب‌ها", exact: true }).click();
  const accounts = page.getByRole("dialog", { name: "حساب‌ها و دسترسی", exact: true });
  await accounts.getByLabel("کلید دسترسی لیارا", { exact: true }).waitFor();
  assert.equal(
    await accounts.getByRole("button", { name: "خروج از میز کار", exact: true }).isVisible(),
    true,
    "mobile users must reach sign-out from the account dialog",
  );
  assert.equal(
    await page.evaluate(() => getComputedStyle(document.documentElement).overflow),
    "hidden",
    "background page must not scroll behind a dialog",
  );
  await layout(360, "liara-connection-form");
  await accounts.getByLabel("کلید دسترسی لیارا", { exact: true }).fill("short");
  await accounts.getByRole("button", { name: "اتصال حساب لیارا", exact: true }).click();
  await accounts.getByRole("alert", { name: "اتصال حساب کامل نشد" }).waitFor();
  assert.equal(
    await accounts.getByLabel("کلید دسترسی لیارا", { exact: true }).getAttribute("aria-invalid"),
    "true",
  );
  await layout(360, "liara-key-field-error");
  await accounts
    .getByLabel("کلید دسترسی لیارا", { exact: true })
    .fill("synthetic-browser-connection-key");
  await accounts.getByRole("button", { name: "اتصال حساب لیارا", exact: true }).click();
  await accounts.getByLabel(server.app, { exact: true }).waitFor();
  assert.equal(await accounts.getByLabel("کلید دسترسی لیارا", { exact: true }).count(), 0);
  await accounts.getByLabel(server.app, { exact: true }).check();
  await accounts
    .getByText("برنامه مقصد انتخاب شد. هر تغییر حساس همچنان به تأیید شما نیاز دارد.", {
      exact: true,
    })
    .waitFor();
  assert.equal(await accounts.locator(".app-selection-feedback").isVisible(), true);
  await layout(360, "connected-account-and-narrow-app-selection-fixture");
  await accounts.locator(".site-address summary").click();
  await accounts.getByLabel("نشانی سایت", { exact: true }).fill("http://127.0.0.1");
  await accounts.getByRole("button", { name: "ذخیره نشانی برای بررسی", exact: true }).click();
  await accounts.getByRole("alert", { name: "اتصال حساب کامل نشد" }).waitFor();
  assert.equal(
    await accounts.getByLabel("نشانی سایت", { exact: true }).getAttribute("aria-invalid"),
    "true",
  );
  await layout(360, "site-origin-rejects-internal-address");
  await accounts.getByLabel("نشانی سایت", { exact: true }).fill("sample.example.com");
  await accounts.getByRole("button", { name: "ذخیره نشانی برای بررسی", exact: true }).click();
  await accounts
    .getByText("نشانی برای بررسی ذخیره شد؛ هنوز درخواستی به سایت ارسال نشده است.", { exact: true })
    .waitFor();
  assert.equal(
    store.getProbeOrigin(actorId, server.teamId, server.app),
    "https://sample.example.com",
  );
  await closeDialog("حساب‌ها و دسترسی");
  assert.notEqual(
    await page.evaluate(() => getComputedStyle(document.documentElement).overflow),
    "hidden",
    "page scrolling must return after the dialog closes",
  );
  await page.getByRole("button", { name: "دریافت پیشنهاد انتشار", exact: true }).click();
  await page.getByRole("heading", { name: "پیشنهاد انتشار", exact: true }).waitFor();
  await layout(360, "proposal-with-cost-unknown");
  await page.getByRole("button", { name: "رد این پیشنهاد", exact: true }).click();
  await page.getByText("اجرا نمی‌شود", { exact: true }).waitFor();
  await page.getByRole("button", { name: "دریافت پیشنهاد تازه", exact: true }).click();
  await page.getByRole("button", { name: `تأیید پیشنهاد برای ${server.app}`, exact: true }).click();
  await page.getByText("تأیید ثبت شد؛ اجرا نشده", { exact: true }).waitFor();
  await layout(360, "approval-is-not-deployment");
  await page.reload();
  await page.getByText("تأیید ثبت شد؛ اجرا نشده", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: /اجرای انتشار/ }).count(), 0);
  const action = store.listActions(actorId)[0];
  assert.ok(action);
  const session = store.db
    .prepare("SELECT approval_session_id FROM actions WHERE id=?")
    .get(action.id).approval_session_id;
  store.claim(action.id, actorId, session, action.spec);
  await page.reload();
  await page.getByText("در حال اجرا", { exact: true }).waitFor();
  await layout(360, "executing-fixture");
  store.uncertain(action.id, actorId);
  await page.reload();
  await page.getByText("نتیجه اجرا نامعلوم", { exact: true }).waitFor();
  await layout(360, "uncertain-has-no-blind-retry-fixture");
  // Only isolated persisted state is exercised; no adapter or infrastructure request runs.
  store.finishObservation(action.id, actorId, "not_applied");
  await appendFile(
    join(server.workspace, "examples/node-service/server.mjs"),
    "\n// changed synthetic source\n",
  );
  await page.getByRole("button", { name: "تغییر پوشه پروژه", exact: true }).click();
  await folders.getByRole("button", { name: /examples/ }).click();
  await folders.getByRole("button", { name: /node-service/ }).click();
  const oldProject = new URL(page.url()).searchParams.get("project");
  await folders.getByRole("button", { name: "انتخاب همین پوشه", exact: true }).click();
  await page.waitForURL((url) => url.searchParams.get("project") !== oldProject);
  await heading().waitFor();
  const restoredFlow = store.getProjectFlow(actorId);
  assert.ok(restoredFlow);
  assert.equal(restoredFlow.selection.kind, "local");
  await appendFile(
    join(server.workspace, "examples/node-service/server.mjs"),
    "\n// changed after inspection\n",
  );
  await page.reload();
  await page.getByText("نیاز به بررسی دوباره", { exact: true }).waitFor();
  await layout(360, "stale-source-invalidates-proposal");

  await page.getByRole("link", { name: "بررسی مشکل سایت", exact: true }).click();
  const incidentTitle = page.getByRole("heading", {
    name: "مشکل سایت را از کجا بررسی کنیم؟",
    exact: true,
  });
  await incidentTitle.waitFor();
  const collectButton = page
    .locator("form")
    .getByRole("button", { name: "بررسی مشکل سایت", exact: true });
  assert.equal(await collectButton.isEnabled(), false);
  await page.getByRole("button", { name: "بازخوانی وضعیت دسترسی", exact: true }).waitFor();
  await layout(360, "ordinary-incident-disabled-with-actionable-access");
  await page.getByRole("button", { name: "امتحان با نمونه اختلال", exact: true }).click();
  const incidentReport = page.getByRole("region", { name: "نتیجه بررسی نمونه", exact: true });
  await incidentReport.waitFor();
  const incidentId = new URL(page.url()).searchParams.get("incident");
  assert.ok(incidentId);
  await incidentReport.getByText("دلیل این فرضیه و شواهد مرتبط", { exact: true }).click();
  await incidentReport
    .getByRole("button", { name: "مشاهده گزارش‌های برنامه", exact: true })
    .press("Enter");
  assert.equal(
    await page
      .locator("#incident-evidence-logs-1")
      .evaluate((element) => element === document.activeElement),
    true,
  );
  await layout(360, "sample-hypothesis-links-focus-exact-evidence");
  await incidentReport.locator(".incident-evidence summary").first().click();
  await incidentReport.locator(".sample-comparison summary").click();
  await incidentReport
    .getByRole("button", { name: "امتحان تغییر نامرتبط در نمونه", exact: true })
    .click();
  await incidentReport.getByText(/همان صفحه هنوز خطای سرور دارد/).waitFor();
  await incidentReport
    .getByRole("button", { name: "امتحان اصلاح مرتبط در نمونه", exact: true })
    .click();
  await incidentReport
    .getByText(/همان صفحه در بررسی تازه پاسخ موفق داد/)
    .waitFor();
  for (const width of [280, 320, 360, 390, 414, 559, 560, 768, 1280]) {
    await page.setViewportSize({ width, height: width >= 768 ? 1000 : 844 });
    await layout(width, "persisted-sample-incident-report");
    if ([360, 768, 1280].includes(width))
      await page.screenshot({ path: resolve(output, `incident-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 360, height: 844 });
  const handoffPanel = page.locator(".incident-handoff");
  await handoffPanel.locator(":scope > summary").press("Enter");
  await handoffPanel.getByRole("button", { name: "آماده‌سازی گزارش", exact: true }).press("Enter");
  const handoffTitle = handoffPanel.getByRole("heading", { name: "گزارش نمونه آماده است", exact: true });
  await handoffTitle.waitFor();
  assert.equal(await handoffTitle.evaluate((element) => element === document.activeElement), true);
  await handoffPanel.getByText("پیش‌نمایش محتوای فایل", { exact: true }).press("Enter");
  const exportedMarkdown = await handoffPanel.getByRole("textbox", { name: "محتوای گزارش برای اصلاح کد", exact: true }).inputValue();
  assert.match(exportedMarkdown, /حالت آزمایشی/);
  assert.match(exportedMarkdown, /همان صفحه در بررسی تازه پاسخ موفق داد/);
  assert.equal(exportedMarkdown.includes(server.token), false);
  const downloadStarted = page.waitForEvent("download");
  await handoffPanel.getByRole("link", { name: "دریافت فایل گزارش", exact: true }).press("Enter");
  const handoffDownload = await downloadStarted;
  assert.equal(handoffDownload.suggestedFilename(), `launchlane-incident-${incidentId}.md`);
  assert.equal(await readFile(await handoffDownload.path(), "utf8"), exportedMarkdown);
  for (const width of [280, 360, 559, 560, 768, 959, 960, 1280]) {
    await page.setViewportSize({ width, height: width >= 768 ? 1000 : 844 });
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    await layout(width, "handoff-preview-and-download-text-200-percent");
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
  await page.setViewportSize({ width: 360, height: 844 });
  const oldDownload = await handoffPanel.getByRole("link", { name: "دریافت فایل گزارش", exact: true }).getAttribute("href");
  let handoffFault = "failure", handoffRelease, handoffStarted;
  await page.route(/\/api\/incidents\/handoff\?/, async (route) => {
    if (handoffFault === "auth") return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: { code: "AUTH_REQUIRED", message: "برای ادامه وارد شوید.", requestId: "synthetic-session-expired", retryable: false } }) });
    if (handoffFault === "failure") return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "HANDOFF_UNAVAILABLE", message: "گزارش دریافت نشد؛ دوباره تلاش کنید.", requestId: "synthetic-export-request", retryable: true } }) });
    if (handoffFault === "hold") {
      handoffStarted();
      await new Promise((done) => { handoffRelease = done; });
      return route.abort().catch(() => undefined);
    }
    return route.continue();
  });
  await handoffPanel.getByRole("button", { name: "آماده‌سازی دوباره گزارش", exact: true }).press("Enter");
  await handoffPanel.getByRole("alert").waitFor();
  assert.equal(await handoffPanel.getByRole("link", { name: "دریافت فایل گزارش", exact: true }).getAttribute("href"), oldDownload);
  await layout(360, "handoff-error-preserves-existing-file-and-report");
  handoffFault = "hold";
  const handoffPending = new Promise((done) => { handoffStarted = done; });
  await handoffPanel.getByRole("button", { name: "آماده‌سازی دوباره گزارش", exact: true }).press("Enter");
  await handoffPending;
  assert.equal(await handoffPanel.getByRole("button", { name: "در حال آماده‌کردن گزارش…", exact: true }).isEnabled(), false);
  await layout(360, "handoff-one-request-loading-and-cancel");
  await handoffPanel.getByRole("button", { name: "توقف آماده‌سازی گزارش", exact: true }).press("Enter");
  handoffRelease(); handoffFault = "none";
  await handoffPanel.getByRole("status").getByText(/آماده‌سازی گزارش متوقف شد/).waitFor();
  assert.equal(await handoffPanel.getByRole("link", { name: "دریافت فایل گزارش", exact: true }).getAttribute("href"), oldDownload);
  assert.equal(await handoffPanel.getByRole("button", { name: "آماده‌سازی دوباره گزارش", exact: true }).evaluate((element) => element === document.activeElement), true);
  await layout(360, "handoff-cancel-preserves-file-and-returns-focus");
  await page.reload(); await incidentReport.waitFor();
  assert.equal(await handoffPanel.getByRole("link", { name: "دریافت فایل گزارش", exact: true }).count(), 0);
  await handoffPanel.locator(":scope > summary").press("Enter");
  await handoffPanel.getByRole("button", { name: "آماده‌سازی گزارش", exact: true }).press("Enter");
  await handoffTitle.waitFor();
  await layout(360, "handoff-recreated-from-durable-report-after-reload");
  handoffFault = "auth";
  await handoffPanel.getByRole("button", { name: "آماده‌سازی دوباره گزارش", exact: true }).press("Enter");
  await page.getByLabel("کلید ورود محلی", { exact: true }).waitFor();
  await page.getByLabel("کلید ورود محلی", { exact: true }).fill(server.token);
  await page.getByRole("button", { name: "ورود به میز کار", exact: true }).press("Enter");
  await incidentReport.waitFor(); handoffFault = "none";
  assert.equal(new URL(page.url()).searchParams.get("incident"), incidentId);
  assert.equal(await handoffPanel.getByRole("link", { name: "دریافت فایل گزارش", exact: true }).count(), 0);
  await layout(360, "handoff-session-expiry-preserves-incident-and-clears-preview");
  await page.getByRole("link", { name: "انتشار پروژه", exact: true }).click();
  await heading().waitFor();
  await page.getByRole("link", { name: "بررسی مشکل سایت", exact: true }).click();
  await incidentReport.waitFor();
  assert.equal(new URL(page.url()).searchParams.get("incident"), incidentId);
  await page.reload();
  await incidentReport.waitFor();
  await incidentReport
    .getByText(/همان صفحه در بررسی تازه پاسخ موفق داد/)
    .waitFor();
  await page.getByRole("button", { name: "بازگشت به بررسی سایت من", exact: true }).click();
  await incidentTitle.waitFor();
  await page.goBack();
  await incidentReport.waitFor();
  await page.goForward();
  await incidentTitle.waitFor();

  await page.getByRole("button", { name: "امتحان با نمونه اختلال", exact: true }).click();
  await incidentReport.waitFor();
  await page.getByText("نمونه‌های دیگر یا شروع دوباره", { exact: true }).click();
  await page.getByRole("button", { name: "نمونه مقایسه زمان پاسخ", exact: true }).press("Enter");
  const latency = page.getByRole("region", { name: "زمان پاسخ همین صفحه", exact: true });
  await latency.waitFor();
  assert.match(await latency.textContent(), /۸۷۰/);
  assert.equal(await incidentReport.getByText(/صفحه بررسی‌شده پاسخ موفق داد/).count(), 0);
  await incidentReport.locator(".sample-comparison summary").click();
  await incidentReport.getByRole("button", { name: "امتحان تغییر نامرتبط در نمونه", exact: true }).press("Enter");
  await incidentReport.getByText(/بازه زمان نمونه‌های قبل و بعد هم‌پوشانی دارد/).waitFor();
  await incidentReport.getByRole("button", { name: "امتحان اصلاح مرتبط در نمونه", exact: true }).click();
  await incidentReport.getByText(/فقط همین نمونه‌ها سریع‌تر پاسخ دادند/).waitFor();
  const latencyId = new URL(page.url()).searchParams.get("incident");
  await page.reload();
  await latency.waitFor();
  assert.equal(new URL(page.url()).searchParams.get("incident"), latencyId);
  for (const width of [360, 767, 768, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    await latency.locator("details summary").first().click();
    await layout(width, "latency-sample-restored-comparison");
    if ([360, 1280].includes(width)) await page.screenshot({ path: resolve(output, `latency-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 360, height: 1000 });
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await layout(360, "latency-text-200-percent");
  await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
  assert.ok(!(await incidentReport.textContent()).includes("a".repeat(64)));
  const completeLatency = store.getIncidentRun(actorId, latencyId);
  assert.ok(completeLatency?.after);
  store.saveIncidentRun(actorId, {
    ...completeLatency,
    after: { ...completeLatency.after, entries: completeLatency.after.entries.slice(0, 1) },
  });
  await page.reload();
  await latency.waitFor();
  await incidentReport.getByText(/برای مقایسه، هر دو بررسی باید سه پاسخ معتبر/).waitFor();
  assert.match(await latency.textContent(), /سه پاسخ قابل مقایسه ثبت نشده/);
  assert.equal(await latency.getByText(/میانه:/).count(), 1, "An incomplete fresh series cannot manufacture a median");
  await layout(360, "latency-partial-series-remains-inconclusive");
  const partialLatency = store.getIncidentRun(actorId, latencyId);
  assert.ok(partialLatency?.after);
  partialLatency.after = structuredClone(completeLatency.after);
  const failedResponse = partialLatency.after.entries[2];
  assert.equal(failedResponse.fact.kind, "http");
  failedResponse.fact.status = 500;
  store.saveIncidentRun(actorId, partialLatency);
  await page.reload();
  await incidentReport.getByText(/صفحه بررسی‌شده خطای سرور 500 داد/).waitFor();
  await layout(360, "latency-series-server-error-remains-visible");
  await page.getByRole("button", { name: "بازگشت به بررسی سایت من", exact: true }).click();
  await incidentTitle.waitFor();

  let controlledReads = false,
    incidentStatus = 500,
    failIncident = false,
    holdIncident = false;
  let pendingIncident, startedIncident;
  await page.route("**/api/workspace", async (route) => {
    if (!controlledReads) return route.continue();
    const response = await route.fetch(),
      value = await response.json();
    return route.fulfill({
      json: { ...value, features: { ...value.features, serviceReads: true } },
    });
  });
  await page.route("**/api/incidents/runs", async (route) => {
    if (!controlledReads || route.request().method() !== "POST") return route.continue();
    const input = route.request().postDataJSON();
    if (!["collect", "recheck"].includes(input.operation)) return route.continue();
    providerFixtures.push(`incident-${input.operation}-controlled-reader`);
    if (holdIncident) {
      startedIncident?.();
      await new Promise((done) => {
        pendingIncident = done;
      });
      return route
        .fulfill({
          status: 409,
          json: {
            error: {
              code: "CANCELLED",
              message: "بررسی متوقف شد.",
              retryable: false,
              requestId: "synthetic-cancel",
            },
          },
        })
        .catch(() => undefined);
    }
    if (failIncident)
      return route.fulfill({
        status: 502,
        json: {
          error: {
            code: "PROVIDER_UNAVAILABLE",
            message: "اطلاعات برنامه دریافت نشد. کمی بعد دوباره بررسی کنید.",
            retryable: true,
            requestId: "synthetic-request",
          },
        },
      });
    try {
      const run = await incidentResponse(server, store, actorId, input, incidentStatus);
      return route.fulfill({ json: { run } });
    } catch (error) {
      return route.fulfill({
        status: error.status || 500,
        json: {
          error: {
            code: error.code,
            message: error.message,
            retryable: false,
            requestId: "synthetic-validation",
          },
        },
      });
    }
  });
  controlledReads = true;
  await page.getByRole("button", { name: "بازخوانی وضعیت دسترسی", exact: true }).click();
  await page.waitForFunction(
    (button) => button instanceof HTMLButtonElement && !button.disabled,
    await collectButton.elementHandle(),
  );
  await page.getByLabel("کند شده است", { exact: true }).check();
  await page.getByText(/برای بررسی کندی، حداکثر سه درخواست کوتاه و متوالی/).waitFor();
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: width >= 768 ? 1000 : 844 });
    await layout(width, "ordinary-incident-app-and-symptom-form-fixture");
  }
  await page.setViewportSize({ width: 360, height: 844 });
  await page.getByLabel("خطا نشان می‌دهد", { exact: true }).check();
  await page
    .getByLabel("توضیح مشکل (اختیاری)", { exact: true })
    .fill("بعد از انتشار، صفحه اصلی خطا می‌دهد.");
  await collectButton.click();
  const liveReport = page.getByRole("region", { name: `نتیجه بررسی ${server.app}`, exact: true });
  await liveReport.waitFor();
  await liveReport.getByText("صفحه بررسی‌شده خطای سرور 500 داد.", { exact: true }).waitFor();
  assert.equal(await liveReport.getByText("از حساب متصل", { exact: true }).isVisible(), true);
  assert.equal(await liveReport.getByRole("button", { name: "توضیح علت با هوش مصنوعی", exact: true }).isEnabled(), false);
  await liveReport.getByText(/فعال‌کردن این قابلیت به تنظیمات مسئول نصب نیاز دارد/).waitFor();
  const liveId = new URL(page.url()).searchParams.get("incident");
  incidentStatus = 200;
  await liveReport.getByRole("button", { name: "بررسی دوباره همین صفحه", exact: true }).click();
  await liveReport.getByText(/همان صفحه در بررسی تازه پاسخ موفق داد/).waitFor();
  await layout(360, "ordinary-incident-controlled-read-and-same-page-recheck");
  await page.reload();
  await liveReport.waitFor();
  assert.equal(new URL(page.url()).searchParams.get("incident"), liveId);
  failIncident = true;
  await collectButton.click();
  await page.getByRole("alert", { name: "بررسی مشکل کامل نشد", exact: true }).waitFor();
  assert.equal(await liveReport.isVisible(), true);
  assert.equal(
    await page.getByLabel("توضیح مشکل (اختیاری)", { exact: true }).inputValue(),
    "بعد از انتشار، صفحه اصلی خطا می‌دهد.",
  );
  await layout(360, "failed-investigation-preserves-input-and-result");
  failIncident = false;
  holdIncident = true;
  const incidentStarted = new Promise((done) => {
    startedIncident = done;
  });
  await collectButton.click();
  await incidentStarted;
  await page.getByRole("button", { name: "لغو بررسی", exact: true }).click();
  await page
    .getByText("درخواست متوقف شد. ورودی‌ها و نتیجه قبلی حفظ شده‌اند.", { exact: true })
    .waitFor();
  pendingIncident?.();
  holdIncident = false;
  assert.equal(new URL(page.url()).searchParams.get("incident"), liveId);
  await layout(360, "cancel-investigation-keeps-last-result");
  await context.clearCookies();
  await page.reload();
  await page.getByRole("heading", { name: "وارد میز کار محلی شوید", exact: true }).waitFor();
  await page.getByLabel("کلید ورود محلی", { exact: true }).fill(server.token);
  await page.getByRole("button", { name: "ورود به میز کار", exact: true }).click();
  await liveReport.waitFor();
  assert.equal(new URL(page.url()).searchParams.get("incident"), liveId);
  controlledReads = false;
  await page.getByRole("link", { name: "انتشار پروژه", exact: true }).click();
  await heading().waitFor();

  let githubLogin = null,
    githubConnection = null,
    repositoryPage = 1;
  const ghIdentity = {
    provider: "github",
    status: "connected",
    identityId: "7",
    displayName: "Synthetic GitHub",
    login: "synthetic-octocat",
    checkedAt: Date.now(),
    teamId: null,
    teamName: null,
    apps: [],
    selectedApp: null,
  };
  const revision = "c".repeat(40),
    longName = `node-project-${"long-name-".repeat(6)}`;
  await page.route("**/api/connections/github", async (route) => {
    const request = route.request();
    if (request.method() === "GET")
      return route.fulfill({ json: { connection: githubConnection, toolReady: true } });
    if (request.method() === "DELETE") {
      githubConnection = null;
      return route.fulfill({ json: { disconnected: true, providerRevoked: false } });
    }
    const body = request.postDataJSON();
    providerFixtures.push(`github-${body.operation}`);
    if (body.operation === "start") {
      githubLogin = {
        id: randomUUID(),
        state: "awaiting_user",
        expiresAt: Date.now() + 300000,
        userCode: "ABCD-1234",
        verificationUrl: "https://github.com/login/device",
        account: null,
        error: null,
      };
      return route.fulfill({ json: { login: githubLogin } });
    }
    if (body.operation === "status")
      return route.fulfill({
        json: {
          login: {
            ...githubLogin,
            state: "confirm_account",
            userCode: null,
            verificationUrl: null,
            account: { login: ghIdentity.login, name: ghIdentity.displayName },
          },
        },
      });
    if (body.operation === "cancel")
      return route.fulfill({
        json: {
          login: { ...githubLogin, state: "cancelled", userCode: null, verificationUrl: null },
        },
      });
    if (body.operation === "confirm") {
      githubConnection = ghIdentity;
      return route.fulfill({ json: { connection: ghIdentity } });
    }
    if (body.operation === "repositories") {
      repositoryPage = body.page;
      return route.fulfill({
        json: {
          repositories:
            body.page === 1
              ? [
                  {
                    id: 7,
                    owner: "synthetic-octocat",
                    name: longName,
                    private: true,
                    defaultBranch: "main",
                  },
                ]
              : [
                  {
                    id: 8,
                    owner: "synthetic-octocat",
                    name: "other-project",
                    private: false,
                    defaultBranch: "main",
                  },
                ],
          nextPage: body.page === 1 ? 2 : null,
          scannedPages: 1,
        },
      });
    }
    if (body.operation === "branches")
      return route.fulfill({
        json: {
          branches: [
            { name: "main", commit: revision },
            { name: "feature/fix", commit: "d".repeat(40) },
          ],
          nextPage: null,
        },
      });
    if (body.operation === "folders")
      return route.fulfill({
        json: {
          folders: body.directory === "." ? ["apps"] : body.directory === "apps" ? ["web"] : [],
        },
      });
    return route.fulfill({
      status: 403,
      json: {
        error: {
          code: "GITHUB_ACCESS_DENIED",
          message: "مجوز این مخزن کافی نیست. مجوز سازمان را بررسی کنید.",
          retryable: false,
          requestId: "synthetic-request",
        },
      },
    });
  });
  await page.getByRole("button", { name: "انتخاب از GitHub", exact: true }).click();
  const github = page.getByRole("dialog", { name: "انتخاب پروژه از GitHub", exact: true });
  await github.getByRole("button", { name: "اتصال به GitHub", exact: true }).click();
  await github.getByRole("link", { name: "باز کردن صفحه ورود GitHub", exact: true }).waitFor();
  assert.equal(
    await github
      .getByRole("link", { name: "باز کردن صفحه ورود GitHub", exact: true })
      .getAttribute("href"),
    "https://github.com/login/device",
  );
  await layout(360, "github-official-device-challenge-fixture");
  await github.getByRole("button", { name: "اتصال همین حساب", exact: true }).click();
  await github.getByRole("button", { name: new RegExp(longName) }).waitFor();
  await github.getByRole("button", { name: "مخزن‌های بیشتر", exact: true }).click();
  await github.getByRole("button", { name: /other-project/ }).waitFor();
  assert.equal(repositoryPage, 2);
  await layout(360, "github-private-repository-pagination-fixture");
  await github.getByLabel("جست‌وجوی مخزن‌های در دسترس", { exact: true }).fill("node");
  await github.getByRole("button", { name: "جست‌وجو", exact: true }).click();
  await github.getByRole("button", { name: new RegExp(longName) }).click();
  await github.getByRole("button", { name: "main · پیش‌فرض مخزن", exact: true }).click();
  await github.getByRole("button", { name: "apps", exact: true }).click();
  await github.getByRole("button", { name: "web", exact: true }).click();
  // The folder response replaces the clicked row; measure the completed selection, not that detached row.
  await github.getByText("apps/web", { exact: true }).waitFor();
  await github.getByRole("button", { name: "انتخاب این پوشه و بررسی پروژه", exact: true }).and(page.locator("button:enabled")).waitFor();
  assert.equal(await github.getByRole("button", { name: "web", exact: true }).count(), 0);
  await layout(360, "github-branch-and-subfolder-fixture");
  let importMode = "error",
    releaseImport,
    importStarted;
  const previousProject = new URL(page.url()).searchParams.get("project");
  await page.route("**/api/project-flows", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const body = route.request().postDataJSON();
    if (body.operation !== "prepare" || body.selection.kind !== "github") return route.continue();
    providerFixtures.push(`github-import-${importMode}`);
    if (importMode === "error")
      return route.fulfill({
        status: 403,
        json: {
          error: {
            code: "GITHUB_ACCESS_DENIED",
            message: "اجازه دریافت این مخزن کافی نیست. دسترسی مخزن را بررسی کنید.",
            retryable: false,
            requestId: "synthetic-import-denied",
          },
        },
      });
    if (importMode === "cancel") {
      importStarted?.();
      await new Promise((done) => {
        releaseImport = done;
      });
      return route.abort().catch(() => undefined);
    }
    const flow = await importedProject(server, store, actorId, body.selection);
    return route.fulfill({ json: { flow, action: null } });
  });
  const importButton = github.getByRole("button", {
    name: "انتخاب این پوشه و بررسی پروژه",
    exact: true,
  });
  await importButton.click();
  await github.getByRole("alert", { name: "GitHub کامل نشد", exact: true }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("project"), previousProject);
  await layout(360, "github-download-denied-preserves-project-fixture");
  importMode = "cancel";
  const importing = new Promise((done) => {
    importStarted = done;
  });
  await importButton.click();
  await importing;
  await github.getByRole("button", { name: "لغو دریافت پروژه", exact: true }).click();
  await github
    .getByText("دریافت پروژه متوقف شد. پروژه قبلی حفظ شده است.", { exact: true })
    .waitFor();
  releaseImport?.();
  assert.equal(new URL(page.url()).searchParams.get("project"), previousProject);
  assert.equal(await importButton.evaluate((element) => element === document.activeElement), true);
  await layout(360, "github-download-cancel-restores-focus-fixture");
  importMode = "success";
  await importButton.click();
  await github.waitFor({ state: "detached" });
  await heading().waitFor();
  const imported = store.getProjectFlow(actorId);
  assert.equal(imported.selection.kind, "github");
  assert.equal(imported.selection.revision, revision);
  assert.equal(imported.selection.directory, "apps/web");
  assert.deepEqual(
    imported.profile.manifest.map((row) => row.path),
    ["package.json", "server.mjs"],
  );
  await page.reload();
  await heading().waitFor();
  assert.equal(new URL(page.url()).searchParams.get("project"), imported.id);
  await layout(360, "github-import-restored-pinned-snapshot-fixture");
  await page.getByRole("button", { name: "انتخاب پوشه محلی", exact: true }).click();
  await page.getByRole("dialog", { name: "انتخاب پوشه پروژه", exact: true }).waitFor();
  await closeDialog("انتخاب پوشه پروژه");
  assert.equal(new URL(page.url()).searchParams.get("project"), imported.id);
  await page.getByRole("button", { name: "تغییر انتخاب GitHub", exact: true }).click();
  await github.getByRole("button", { name: new RegExp(longName) }).waitFor();
  await github.getByRole("button", { name: "قطع اتصال GitHub", exact: true }).click();
  await github.getByRole("button", { name: "بله، اتصال را قطع کن", exact: true }).click();
  await github.getByRole("button", { name: "اتصال به GitHub", exact: true }).waitFor();
  await closeDialog("انتخاب پروژه از GitHub");
  await page.setViewportSize({ width: 768, height: 1000 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await layout(768, "text-200-percent");
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "";
  });
  assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), []);
  assert.deepEqual(external, []);
  assert.deepEqual(errors, []);
  await writeFile(
    resolve(output, "report.json"),
    JSON.stringify(
      {
        evidence: "isolated_local_and_controlled_provider_fixtures",
        upstreamAccountsVerified: false,
        providerFixtures,
        choice,
        results,
        errors,
        external,
      },
      null,
      2,
    ),
  );
  console.info(
    JSON.stringify({
      output,
      checkedStates: results.length,
      widths: [...new Set(results.map((row) => row.width))],
      browserErrors: errors.length,
      externalRequests: external.length,
      realAccountVerified: false,
    }),
  );
} catch (error) {
  await page
    .screenshot({ path: resolve(output, "failure.png"), fullPage: true })
    .catch(() => undefined);
  await writeFile(
    resolve(output, "failure.json"),
    JSON.stringify(
      { error: error instanceof Error ? error.message : "Unknown", results, errors, external },
      null,
      2,
    ),
  );
  console.error(`Browser evidence: ${output}`);
  throw error;
} finally {
  store?.close();
  await context.close();
  await browser.close();
  await server.close();
}
