import {reviewProject,editProject} from "./browser-project.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";
import { sealCredential } from "../src/server/connections/credentials.ts";
import { Store } from "../src/server/persistence/store.ts";
import { startTestServer } from "./test-server.mjs";

const server = await startTestServer(),
  browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: "fa-IR", reducedMotion: "reduce" });
const output = resolve(".artifacts/domain-ui", new Date().toISOString().replaceAll(":", "-"));
await mkdir(output, { recursive: true });
const errors = [],
  external = [],
  results = [],
  requests = [];
context.on("page", (page) => page.on("pageerror", (error) => errors.push(error.message)));
await context.route("**/*", (route) => {
  const url = new URL(route.request().url());
  if (url.origin !== server.origin) {
    external.push(url.host);
    return route.abort();
  }
  if (url.pathname === "/api/domains/guide") requests.push(route.request().postDataJSON());
  return route.continue();
});
const page = await context.newPage(),
  actorId = createHash("sha256").update(server.token).digest("hex").slice(0, 24);
let store;
const region = page.getByRole("region", { name: "اتصال دامنه دلخواه", exact: true });
const summary = region.locator(":scope > details > summary");
const submit = region.getByRole("button", { name: "دیدن راهنمای دامنه", exact: true });
const heading = () => region.getByRole("heading", { name: /^راهنمای اتصال / });
async function layout(width, label) {
  await page.setViewportSize({ width, height: 900 });
  await page.evaluate(async () => { await document.fonts.ready; window.scrollTo(0, 0); });
  const dimensions = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  assert.ok(
    dimensions.content <= dimensions.width,
    `${label}: horizontal overflow ${JSON.stringify(dimensions)}`,
  );
  const controls = await region
    .locator(
      "button:visible, input:not([type=radio]):visible, .button-link:visible, .domain-dns-choice label:visible",
    )
    .evaluateAll((nodes) =>
      nodes.map((node) => ({
        text: node.textContent?.slice(0, 80),
        width: node.getBoundingClientRect().width,
        height: node.getBoundingClientRect().height,
      })),
    );
  assert.ok(
    controls.every((row) => row.width >= 44 && row.height >= 44),
    `${label}: small control ${JSON.stringify(controls)}`,
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
    overflow: dimensions.content - dimensions.width,
    axeViolations: axe.violations.length,
  });
}
async function prepare(hostname) {
  if (hostname !== undefined) await region.getByLabel("نام دامنه", { exact: true }).fill(hostname);
  await submit.click();
  await reviewProject(page);
  await page.waitForFunction(() => document.activeElement?.matches(".domain-guide-result h3"));
  const focusBox = await heading().boundingBox();
  assert.ok(focusBox && focusBox.y >= 6, "The focused guide heading and its outline must remain inside the viewport");
}
function saveConnection(changes = {}) {
  const view = {
    provider: "liara",
    status: "connected",
    identityId: "synthetic-identity",
    displayName: "حساب آزمایشی",
    login: "synthetic@example.test",
    checkedAt: Date.now(),
    teamId: server.teamId,
    teamName: "تیم آزمایشی با نام طولانی برای بررسی درست شکستن خطوط در نمایش مقصد انتشار",
    apps: [{ id: "synthetic-app-id", name: server.app, platform: "node" }],
    selectedApp: server.app,
    ...changes,
  };
  store.saveConnection(actorId, {
    view,
    source: "token",
    ciphertext: sealCredential("synthetic-token-only", server.sessionSecret, actorId, "liara"),
  });
}
try {
  await page.goto(`${server.origin}/?view=publish`);
  await page.getByLabel("کلید ورود محلی", { exact: true }).fill(server.token);
  await page.getByRole("button", { name: "ورود به میز کار", exact: true }).click();
  await page.getByRole("button", { name: "امتحان با پروژه نمونه", exact: true }).click();
  await reviewProject(page);
  store = new Store(join(server.stateDir, "state.sqlite"));
  await summary.press("Enter");
  await region.getByLabel("نام دامنه", { exact: true }).waitFor();
  await layout(360, "empty-guide");
  await submit.press("Enter");
  await region.locator(".field-error").waitFor();
  assert.equal(
    await region.getByLabel("نام دامنه", { exact: true }).getAttribute("aria-invalid"),
    "true",
  );
  assert.equal(await page.locator(":focus").getAttribute("name"), "domain");
  await page.evaluate(() => window.scrollTo({ top: 0 }));
  await layout(360, "inline-name-error");
  await prepare("Shop.Example.IR.");
  assert.match(await heading().textContent(), /shop\.example\.ir/);
  await region.getByText("اتصال دامنه بررسی نشده", { exact: true }).waitFor();
  assert.match(await region.textContent(), /حساب لیارا هنوز متصل نشده/);
  assert.equal(await region.getByText("shop.example.ir.liara.run", { exact: true }).count(), 0);
  const connect = region.getByRole("button", { name: "بررسی اتصال لیارا", exact: true });
  await connect.press("Enter");
  const dialog = page.getByRole("dialog", { name: "حساب‌ها و دسترسی", exact: true });
  await dialog.waitFor();
  await dialog.press("Escape");
  await dialog.waitFor({ state: "detached" });
  assert.equal(await page.locator(":focus").textContent(), "بررسی اتصال لیارا");
  await layout(360, "general-guide-and-focus-return");

  await context.route("**/api/domains/guide", (route) =>
    route.fulfill({
      status: 503,
      json: {
        error: {
          code: "DOMAIN_GUIDE_UNAVAILABLE",
          message: "راهنما دریافت نشد؛ دوباره تلاش کنید.",
          retryable: true,
          requestId: "synthetic-domain-request",
        },
      },
    }),
  );
  await submit.click();
  await region.getByRole("alert", { name: "راهنمای دامنه آماده نشد", exact: true }).waitFor();
  assert.equal(await heading().count(), 1);
  assert.equal(
    await region.getByLabel("نام دامنه", { exact: true }).inputValue(),
    "Shop.Example.IR.",
  );
  await layout(360, "failed-read-keeps-valid-guide");
  await context.unroute("**/api/domains/guide");
  let releaseRead, started;
  const pendingRead = new Promise((done) => {
    started = done;
  });
  await context.route("**/api/domains/guide", async (route) => {
    started();
    await new Promise((done) => {
      releaseRead = done;
    });
    await route.continue().catch(() => undefined);
  });
  await submit.click();
  await pendingRead;
  assert.equal(
    await region
      .getByRole("button", { name: "در حال آماده‌کردن راهنما…", exact: true })
      .isDisabled(),
    true,
  );
  await layout(360, "loading-single-request");
  await region.getByRole("button", { name: "لغو آماده‌سازی راهنما", exact: true }).click();
  releaseRead();
  await submit.waitFor();
  assert.equal(await heading().count(), 1);
  await page.waitForFunction(() => document.activeElement?.textContent === "دیدن راهنمای دامنه");
  await context.unroute("**/api/domains/guide");
  await layout(360, "cancel-keeps-guide-and-focus");

  await region
    .getByRole("radio", { name: "می‌خواهم از DNS لیارا استفاده کنم", exact: true })
    .check();
  assert.equal(await heading().count(), 0);
  await prepare("مثال.ir");
  assert.match(await heading().textContent(), /xn--mgbh0fb\.ir/);
  assert.match(await region.textContent(), /ایرنیک/);
  assert.match(await region.textContent(), /نیم‌سرورهایی را که همان صفحه نشان می‌دهد/);
  await layout(360, "international-domain-liara-dns");
  await page.getByRole("link", { name: "بررسی مشکل سایت", exact: true }).click();
  await page.getByRole("link", { name: "انتشار پروژه", exact: true }).click();
  assert.equal(await heading().count(), 1);

  saveConnection();
  await page.reload();
  await reviewProject(page);
  await reviewProject(page);
  await summary.press("Enter");
  const longHostname = `${"a".repeat(63)}.${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(57)}.ir`;
  await prepare(longHostname);
  assert.equal(requests.at(-1).target.appId, "synthetic-app-id");
  assert.match(await region.textContent(), new RegExp(server.app));
  assert.equal(
    await region.getByRole("button", { name: "بررسی اتصال لیارا", exact: true }).count(),
    0,
  );
  for (const width of [280, 320, 360, 559, 560, 768, 959, 960, 1280]) {
    await layout(width, "selected-target-long-domain");
    if ([360, 768, 1280].includes(width))
      await region.screenshot({ path: resolve(output, `guide-${width}.png`) });
  }
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  for (const width of [280, 360, 768, 1280]) await layout(width, "text-200-percent");
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "";
  });
  saveConnection({ selectedApp: null });
  await submit.click();
  await region.getByRole("alert", { name: "راهنمای دامنه آماده نشد", exact: true }).waitFor();
  assert.equal(await heading().count(), 0);
  assert.equal(await region.getByLabel("نام دامنه", { exact: true }).inputValue(), longHostname);
  await region.getByRole("button", { name: "به‌روزرسانی مقصد", exact: true }).click();
  await region
    .getByRole("status")
    .getByText(/اطلاعات حساب تغییر کرد/)
    .waitFor();
  assert.equal(await region.getByLabel("نام دامنه", { exact: true }).inputValue(), longHostname);
  await prepare();
  assert.match(await region.textContent(), /هنوز برنامه مقصد انتخاب نشده/);
  await layout(360, "changed-target-invalidates-guide-keeps-name");
  saveConnection({ status: "reauth_required" });
  await page.reload();
  await reviewProject(page);
  await reviewProject(page);
  await summary.press("Enter");
  await prepare("example.ir");
  assert.match(await region.textContent(), /اتصال لیارا نیاز به بررسی دوباره دارد/);
  await layout(360, "account-reauth-required");
  assert.equal(store.getProbeOrigin(actorId, server.teamId, server.app), null);
  assert.deepEqual(store.listActions(actorId), []);
  assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), []);
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  await writeFile(
    resolve(output, "report.json"),
    JSON.stringify(
      {
        evidence: "isolated_production_http_and_synthetic_saved_account",
        accountOrDnsLiveVerified: false,
        results,
        errors,
        external,
        guideRequests: requests.length,
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
      accountOrDnsLiveVerified: false,
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
  console.error(`Domain browser evidence: ${output}`);
  throw error;
} finally {
  store?.close();
  await context.close();
  await browser.close();
  await server.close();
}
