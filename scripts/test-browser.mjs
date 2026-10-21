import assert from "node:assert/strict";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { startTestServer } from "./test-server.mjs";

const server = await startTestServer();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  reducedMotion: "reduce",
  locale: "fa-IR",
});
const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const output = resolve(".artifacts/p1", stamp);
await mkdir(output, { recursive: true });
const errors = [],
  blocked = [],
  results = [];
context.on("page", (page) => page.on("pageerror", (error) => errors.push(error.message)));
await context.route("**/*", (route) => {
  if (new URL(route.request().url()).origin !== server.origin) {
    blocked.push(new URL(route.request().url()).host);
    return route.abort();
  }
  return route.continue();
});
const page = await context.newPage();

async function layout(width, label) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  const geometry = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  assert.ok(
    geometry.content <= geometry.width + 1,
    `${label}: horizontal page overflow ${geometry.content - geometry.width}px at ${width}`,
  );
  const controls = await page
    .locator("button:visible, input:not([type=radio]):visible")
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
      impact: violation.impact,
      nodes: violation.nodes.map((node) => node.target),
    })),
    [],
    `${label}: accessibility violations`,
  );
  results.push({
    width,
    label,
    overflow: geometry.content - geometry.width,
    controls: controls.length,
    axeViolations: accessibility.violations.length,
  });
}

try {
  await page.setViewportSize({ width: 360, height: 844 });
  await page.goto(server.origin);
  await page.getByRole("heading", { name: "وارد میز کار محلی شوید" }).waitFor();
  assert.equal(await page.evaluate(() => document.fonts.check("16px IRANYekan")), true);
  await page.keyboard.press("Tab");
  assert.equal(await page.locator(":focus").textContent(), "رفتن به محتوای اصلی");
  await layout(360, "signed-out");
  assert.equal(
    await page.evaluate(() => {
      const face = [...document.fonts].find(
        (font) => font.family.replaceAll('"', "") === "IRANYekan",
      );
      return face?.status;
    }),
    "loaded",
    "the local IranYekan face must actually load, not only match a fallback family",
  );
  await page.screenshot({
    path: resolve(output, "signin-360.png"),
    fullPage: true,
  });
  await page.getByLabel("کلید ورود محلی", { exact: true }).fill(server.token);
  await page.getByRole("button", { name: "ورود به میز کار", exact: true }).click();
  await page.getByRole("heading", { name: "کدام پروژه را آماده کنیم؟" }).waitFor();
  assert.equal(await page.getByLabel("کلید ورود محلی", { exact: true }).count(), 0);

  for (const width of [280, 320, 360, 390, 414, 768, 1280]) {
    await page.setViewportSize({ width, height: width >= 768 ? 1000 : 844 });
    await page.goto(server.origin);
    await page.getByRole("heading", { name: "کدام پروژه را آماده کنیم؟" }).waitFor();
    await page.getByRole("button", { name: "بررسی پروژه", exact: true }).click();
    const heading = page.getByRole("heading", {
      name: "آنچه از پروژه می‌دانیم",
      exact: true,
    });
    await heading.waitFor();
    assert.equal(await heading.evaluate((element) => element === document.activeElement), true);
    await page.locator("details.manifest > summary").click();
    const region = page.getByRole("region", { name: "فهرست فایل‌های مجاز" });
    // Enter the scroll region through real keyboard navigation, which activates :focus-visible.
    await page.keyboard.press("Tab");
    assert.equal(await region.evaluate((element) => element === document.activeElement), true);
    assert.equal(
      await region.evaluate((element) => getComputedStyle(element).outlineStyle),
      "solid",
    );
    assert.ok(
      await page.locator(".env-list").getByText("WELCOME_MESSAGE", { exact: true }).isVisible(),
    );
    await layout(width, "inspected-manifest");
    assert.equal(
      await page.getByRole("button", { name: "ساخت پیشنهاد قابل بررسی", exact: true }).isDisabled(),
      true,
    );
    await page.getByRole("button", { name: "آماده‌سازی بسته محلی", exact: true }).click();
    await page.getByText("بسته محلی آماده است؛ ارسال نشده", { exact: true }).waitFor();
    assert.equal(
      await page
        .getByRole("heading", { name: "بسته محلی آماده است؛ ارسال نشده", exact: true })
        .evaluate((element) => element === document.activeElement),
      true,
    );
    assert.equal(
      await page.getByRole("button", { name: "ساخت پیشنهاد قابل بررسی", exact: true }).isEnabled(),
      true,
    );
    await page.getByText("هش بسته قابل ارسال", { exact: true }).click();
    await layout(width, "prepared-archive");
    if ([360, 768, 1280].includes(width))
      await page.screenshot({
        path: resolve(output, `inspected-${width}.png`),
        fullPage: true,
      });
    if (width === 360) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: resolve(output, "workbench-360-viewport.png"),
      });
    }
    if (width === 360 || width === 1280) {
      await page.getByRole("button", { name: "ساخت پیشنهاد قابل بررسی", exact: true }).click();
      const action = page.locator(".action-card").first();
      await action
        .getByRole("button", {
          name: `تأیید پیشنهاد انتشار روی ${server.app}`,
          exact: true,
        })
        .waitFor();
      if (width === 360) {
        await action.getByRole("button", { name: "رد این پیشنهاد", exact: true }).click();
        await action.getByText("رد شد؛ اجرا نشد", { exact: true }).waitFor();
      } else {
        await action
          .getByRole("button", {
            name: `تأیید پیشنهاد انتشار روی ${server.app}`,
            exact: true,
          })
          .click();
        await action.getByText("تأیید ثبت شد؛ اجرا نشده", { exact: true }).waitFor();
        await page.screenshot({
          path: resolve(output, "approved-1280.png"),
          fullPage: true,
        });
      }
      await layout(width, width === 360 ? "rejected" : "approved");
    }
  }
  await page.setViewportSize({ width: 360, height: 844 });
  await page.getByLabel("مسیر نسبی پوشه پروژه", { exact: true }).fill("../escape");
  await page.getByRole("button", { name: "بررسی پروژه", exact: true }).click();
  const errorAlert = page.getByRole("alert", {
    name: "این مرحله کامل نشد",
    exact: true,
  });
  await errorAlert.waitFor();
  assert.equal(await errorAlert.evaluate((element) => element === document.activeElement), true);
  await layout(360, "unsafe-path-error");
  await page.screenshot({
    path: resolve(output, "error-360.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "بستن پیام", exact: true }).click();
  await page.getByLabel("مسیر نسبی پوشه پروژه", { exact: true }).fill("examples/node-service");
  await page.route("**/api/projects/inspect", async (route) => {
    await new Promise((done) => setTimeout(done, 500));
    await route.continue().catch(() => undefined);
  });
  await page.getByRole("button", { name: "بررسی پروژه", exact: true }).click();
  await page.getByRole("button", { name: "لغو بررسی", exact: true }).click();
  await page
    .getByRole("status")
    .getByText("بررسی لغو شد؛ پیشنهادی ساخته و فایلی ارسال نشد.", {
      exact: true,
    })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "بررسی پروژه", exact: true })
      .evaluate((element) => element === document.activeElement),
    true,
  );
  await page.unroute("**/api/projects/inspect");
  // Preparing source must remain useful before a Liara app/account is configured.
  await page.route("**/api/workspace", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    data.capabilities.scope.apps = [];
    await route.fulfill({ response, json: data });
  });
  await page.goto(server.origin);
  await page.getByRole("heading", { name: "کدام پروژه را آماده کنیم؟" }).waitFor();
  await page.getByRole("button", { name: "بررسی پروژه", exact: true }).click();
  let releaseArchive;
  const heldArchive = new Promise((resolve) => {
    releaseArchive = resolve;
  });
  await page.route("**/api/projects/archive", async (route) => {
    await heldArchive;
    await route.continue().catch(() => undefined);
  });
  try {
    await page.getByRole("button", { name: "آماده‌سازی بسته محلی", exact: true }).click();
    await page.getByRole("button", { name: "لغو آماده‌سازی", exact: true }).waitFor();
    await layout(360, "preparing-archive");
    await page.getByRole("button", { name: "لغو آماده‌سازی", exact: true }).click();
    await page
      .getByRole("status")
      .getByText("آماده‌سازی متوقف شد؛ هیچ فایلی ارسال نشد. ساخت دوباره فقط محلی است.", {
        exact: true,
      })
      .waitFor();
    await layout(360, "cancelled-archive");
    assert.equal(
      await page
        .getByRole("button", { name: "آماده‌سازی بسته محلی", exact: true })
        .evaluate((element) => element === document.activeElement),
      true,
    );
  } finally {
    releaseArchive();
    await page.unroute("**/api/projects/archive");
  }
  await appendFile(
    join(server.workspace, "examples/node-service/server.mjs"),
    "\n// changed after UI inspection\n",
  );
  await page.getByRole("button", { name: "آماده‌سازی بسته محلی", exact: true }).click();
  await errorAlert.waitFor();
  await errorAlert
    .getByText("source پس از بررسی تغییر کرده است؛ دوباره بررسی کنید.", { exact: true })
    .waitFor();
  await layout(360, "stale-archive-error");
  await page.getByRole("button", { name: "بستن پیام", exact: true }).click();
  await page.getByRole("button", { name: "بررسی پروژه", exact: true }).click();
  await page.getByRole("button", { name: "آماده‌سازی بسته محلی", exact: true }).click();
  await page.getByText("بسته محلی آماده است؛ ارسال نشده", { exact: true }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "ساخت پیشنهاد قابل بررسی", exact: true }).isDisabled(),
    true,
  );
  await layout(360, "archive-without-liara-target");
  await page.unroute("**/api/workspace");
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await layout(1280, "text-200-percent");
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "";
  });
  await page.getByRole("button", { name: "بررسی اختلال", exact: true }).click();
  const incidentTitle = page.getByRole("heading", {
    name: "بررسی اختلال، از کجا شروع کنیم؟",
    exact: true,
  });
  await incidentTitle.waitFor();
  assert.equal(await incidentTitle.evaluate((element) => element === document.activeElement), true);
  async function openScenarioPicker() {
    const picker = page.locator("details.scenario-picker");
    if ((await picker.getAttribute("open")) === null) await picker.locator("summary").click();
  }
  for (const width of [280, 320, 360, 390, 414, 768, 1280]) {
    await page.setViewportSize({ width, height: width >= 768 ? 1000 : 844 });
    await openScenarioPicker();
    await page.getByRole("radio", { name: /تنظیمات ناقص/ }).check();
    await page.getByRole("button", { name: "بررسی سناریوی انتخابی", exact: true }).click();
    const evidenceTitle = page.getByRole("heading", { name: "شواهد همین اختلال", exact: true });
    await evidenceTitle.waitFor();
    assert.equal(
      await evidenceTitle.evaluate((element) => element === document.activeElement),
      true,
    );
    await layout(width, "incident-evidence");
    if ([360, 1280].includes(width))
      await page.screenshot({ path: resolve(output, `evidence-${width}.png`), fullPage: true });
    await page.getByRole("button", { name: "۳ · مقایسه", exact: true }).click();
    await page.getByRole("button", { name: "مقایسه با تغییر نامرتبط", exact: true }).click();
    await page.getByRole("heading", { name: "خطای ۵۰۰ در تمرین باقی ماند", exact: true }).waitFor();
    await layout(width, "incident-wrong-fix");
    await page.getByRole("button", { name: "مقایسه با اصلاح تنظیمات", exact: true }).click();
    const verified = page.getByRole("heading", {
      name: "همان درخواست در تمرین پاسخ موفق داد",
      exact: true,
    });
    await verified.waitFor();
    assert.equal(await verified.evaluate((element) => element === document.activeElement), true);
    await layout(width, "incident-same-symptom-verified");
    if ([360, 1280].includes(width))
      await page.screenshot({ path: resolve(output, `incident-${width}.png`), fullPage: true });
  }
  for (const scenario of ["شواهد متناقض", "شواهد ناکافی"]) {
    await page.setViewportSize({ width: 320, height: 844 });
    await openScenarioPicker();
    await page.getByRole("radio", { name: new RegExp(scenario) }).check();
    assert.equal(
      await page.getByRole("heading", { name: "شواهد همین اختلال", exact: true }).count(),
      0,
    );
    await page.getByRole("button", { name: "بررسی سناریوی انتخابی", exact: true }).click();
    await page.getByRole("heading", { name: "شواهد همین اختلال", exact: true }).waitFor();
    await page.getByRole("button", { name: "۲ · فرضیه", exact: true }).click();
    await page.getByText("شواهد برای تعیین علت کافی نیست.", { exact: true }).waitFor();
    await layout(
      320,
      scenario === "شواهد متناقض" ? "incident-conflicting-log" : "incident-insufficient",
    );
  }
  await page.getByRole("link", { name: "workload-1", exact: true }).click();
  assert.equal(
    await page
      .locator("#evidence-workload-1")
      .evaluate((element) => element === document.activeElement),
    true,
  );
  await layout(320, "incident-evidence-reference");
  let releasePractice;
  const practiceBarrier = new Promise((resolve) => {
    releasePractice = resolve;
  });
  await page.route("**/api/incidents/practice", async (route) => {
    await practiceBarrier;
    await route
      .fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "TEST_UNAVAILABLE",
            message: "پاسخ تمرین موقتاً در دسترس نیست.",
            requestId: "synthetic-request",
          },
        }),
      })
      .catch(() => undefined);
  });
  try {
    await openScenarioPicker();
    await page.getByRole("button", { name: "بررسی سناریوی انتخابی", exact: true }).click();
    await page.getByRole("button", { name: "لغو تمرین", exact: true }).waitFor();
    await layout(320, "incident-loading");
    await page.getByRole("button", { name: "لغو تمرین", exact: true }).click();
    assert.equal(
      await page
        .getByRole("button", { name: "بررسی سناریوی انتخابی", exact: true })
        .evaluate((element) => element === document.activeElement),
      true,
    );
    await layout(320, "incident-cancelled");
  } finally {
    releasePractice();
    await page.unroute("**/api/incidents/practice");
  }
  await page.route("**/api/incidents/practice", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "TEST_UNAVAILABLE",
          message: "پاسخ تمرین موقتاً در دسترس نیست.",
          requestId: "synthetic-request",
        },
      }),
    }),
  );
  await page.getByRole("button", { name: "بررسی سناریوی انتخابی", exact: true }).click();
  const practiceError = page.getByRole("alert").filter({ hasText: "تمرین کامل نشد" });
  await practiceError.waitFor();
  assert.equal(await practiceError.evaluate((element) => element === document.activeElement), true);
  await layout(320, "incident-error");
  await page.unroute("**/api/incidents/practice");
  await page.getByRole("button", { name: "تلاش دوباره", exact: true }).click();
  await page.getByRole("heading", { name: "شواهد همین اختلال", exact: true }).waitFor();
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await layout(1280, "incident-text-200-percent");
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "";
  });
  await page.getByRole("button", { name: "خروج", exact: true }).click();
  await page.getByRole("heading", { name: "وارد میز کار محلی شوید" }).waitFor();
  assert.deepEqual(errors, [], "No browser runtime errors");
  assert.deepEqual(blocked, [], "No external network requests");
  await writeFile(
    resolve(output, "results.json"),
    JSON.stringify(
      {
        evidence: "isolated local production UI; synthetic scope; no live provider",
        results,
        browserErrors: errors,
        externalRequests: blocked,
      },
      null,
      2,
    ),
  );
  console.info(
    JSON.stringify({
      state: "passed",
      surfaces: results.length,
      viewports: [280, 320, 360, 390, 414, 768, 1280],
      browserErrors: errors.length,
      externalRequests: blocked.length,
      output,
    }),
  );
} catch (error) {
  await page
    .screenshot({ path: resolve(output, "failure.png"), fullPage: true })
    .catch(() => undefined);
  throw error;
} finally {
  await context.close();
  await browser.close();
  await server.close();
}
