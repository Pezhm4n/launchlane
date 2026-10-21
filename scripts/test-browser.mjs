import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { Store } from "../src/server/persistence/store.ts";
import { sealCredential } from "../src/server/connections/credentials.ts";
import { startTestServer } from "./test-server.mjs";

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
context.on("page", (page) => page.on("pageerror", (error) => errors.push(error.message)));
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
}
async function closeDialog(name) {
  await page.getByRole("dialog", { name, exact: true }).press("Escape");
  await page.getByRole("dialog", { name, exact: true }).waitFor({ state: "detached" });
}

try {
  await page.setViewportSize({ width: 360, height: 844 });
  await page.goto(server.origin);
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
  await page.getByRole("button", { name: "بررسی مشکل سایت", exact: true }).click();
  await page
    .getByRole("heading", { name: "بررسی اختلال، از کجا شروع کنیم؟", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "انتشار پروژه", exact: true }).click();
  await heading().waitFor();
  assert.equal(
    new URL(page.url()).searchParams.get("project"),
    new URL(firstUrl).searchParams.get("project"),
  );
  await page.goBack();
  await page
    .getByRole("heading", { name: "بررسی اختلال، از کجا شروع کنیم؟", exact: true })
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
  await layout(360, "connected-account-and-narrow-app-selection-fixture");
  await closeDialog("حساب‌ها و دسترسی");
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
  await layout(360, "github-branch-and-subfolder-fixture");
  await github.getByRole("button", { name: "تغییر مخزن", exact: true }).click();
  await github.getByRole("button", { name: "قطع اتصال GitHub", exact: true }).click();
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
