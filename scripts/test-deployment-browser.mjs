import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { startTestServer } from "./test-server.mjs";
import { Store } from "../src/server/persistence/store.ts";
import { sealCredential } from "../src/server/connections/credentials.ts";

// Browser-only upstream fixtures; actual isolated production routes own auth, source, approval and recovery.
const server = await startTestServer(),
  browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  locale: "fa-IR",
  reducedMotion: "reduce",
});
const output = resolve(".artifacts/deployment-ui", new Date().toISOString().replaceAll(":", "-"));
await mkdir(output, { recursive: true });
const errors = [],
  external = [],
  results = [];
context.on("page", (page) => page.on("pageerror", (error) => errors.push(error.message)));
await context.route("**/*", (route) => {
  if (new URL(route.request().url()).origin !== server.origin) {
    external.push(route.request().url());
    return route.abort();
  }
  return route.continue();
});
const page = await context.newPage(),
  actor = createHash("sha256").update(server.token).digest("hex").slice(0, 24);
let store;
function guard(handler) {
  return async (route) => {
    try { return await handler(route); }
    catch (error) {
      errors.push(`Fixture boundary: ${error.message}`);
      return route.fulfill({ status: 500, json: { error: { code: "FIXTURE_FAILURE", message: "آزمون مرز پاسخ شکست خورد.", retryable: false, requestId: "synthetic" } } }).catch(() => undefined);
    }
  };
}
let executionMode = "accepted",
  observation = "pending",
  sends = 0;
let fixtureRevision = "sample-v2";
let started = () => undefined,
  release = () => undefined;
async function state(label, width = 360) {
  await page.setViewportSize({ width, height: width >= 768 ? 1000 : 844 });
  await page.evaluate(() => document.fonts.ready);
  const geometry = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth,
    overflow: [...document.querySelectorAll("body *")].filter((element) => { const rect = element.getBoundingClientRect(); return rect.width > 0 && (rect.left < -1 || rect.right > document.documentElement.clientWidth + 1); }).map((element) => ({ tag: element.tagName, class: element.className, text: element.textContent?.trim().slice(0, 120), width: element.getBoundingClientRect().width, left: element.getBoundingClientRect().left })).slice(0, 20),
  }));
  if (geometry.content > geometry.viewport + 1) await writeFile(resolve(output, "overflow.json"), JSON.stringify({ label, geometry }, null, 2));
  assert.ok(geometry.content <= geometry.viewport + 1, label);
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  assert.deepEqual(
    axe.violations.map((row) => row.id),
    [],
    label,
  );
  results.push({ label, width });
  if ([360, 768, 1280].includes(width))
    await page.screenshot({
      path: resolve(output, `${label}-${width}.png`),
      fullPage: true,
    });
}
try {
  await mkdir(server.stateDir, { recursive: true });
  store = new Store(resolve(server.stateDir, "state.sqlite"));
  store.saveConnection(actor, {
    source: "token",
    ciphertext: sealCredential("synthetic-never-real", server.sessionSecret, actor, "liara"),
    view: {
      provider: "liara",
      status: "connected",
      identityId: "synthetic-user",
      login: "user@example.test",
      displayName: "حساب آزمون",
      teamId: server.teamId,
      teamName: "تیم آزمون",
      selectedApp: server.app,
      apps: [{ id: "synthetic-app", name: server.app, platform: "node" }],
      checkedAt: Date.now(),
    },
  });
  store.setProbeOrigin(
    actor,
    { teamId: server.teamId, app: server.app },
    "https://sample.example.com",
  );
  await page.route("**/api/workspace", guard(async (route) => {
    const response = await route.fetch();
    if (!response.ok()) return route.fulfill({ response });
    const value = await response.json();
    return route.fulfill({
      json: {
        ...value,
        features: { ...value.features, deployment: true, serviceReads: true },
      },
    });
  }));
  await page.route("**/api/project-flows", guard(async (route) => {
    if (
      route.request().method() !== "POST" ||
      route.request().postDataJSON().operation !== "propose-deploy"
    )
      return route.continue();
    const input = route.request().postDataJSON(),
      flow = store.getProjectFlow(actor);
    assert.ok(flow?.artifact);
    assert.deepEqual(input.workload, {
      origin: "https://sample.example.com",
      path: "/checkout",
      status: 200,
      revision: fixtureRevision,
    });
    const action = store.createAction(actor, {
      version: 4,
      operation: "deploy",
      scope: { teamId: server.teamId, app: server.app },
      sourceHash: flow.profile.sourceHash,
      artifactHash: flow.artifact.archiveHash,
      projectFlowId: flow.id,
      selectionHash: flow.selectionHash,
      targetAppId: "synthetic-app",
      args: { port: input.port, planId: "existing-plan" },
      workload: input.workload,
    });
    return route.fulfill({
      status: 201,
      json: { action, flow: store.getProjectFlow(actor) },
    });
  }));
  await page.route("**/api/actions/*/execute", guard(async (route) => {
    sends++;
    const id = new URL(route.request().url()).pathname.split("/")[3],
      action = store.getAction(id, actor);
    const session = store.db
      .prepare("SELECT approval_session_id FROM actions WHERE id=?")
      .get(id).approval_session_id;
    store.claim(id, actor, session, action.spec);
    store.deploymentStep(id, actor, "upload_started");
    if (executionMode === "cancel") store.uncertain(id, actor);
    else store.deploymentStep(id, actor, "uploaded", "synthetic-source");
    started();
    await new Promise((done) => {
      release = done;
    });
    if (executionMode === "cancel")
      return route
        .fulfill({
          status: 409,
          json: {
            error: {
              code: "UPSTREAM_UNCERTAIN",
              message: "پاسخ قطعی دریافت نشد.",
              retryable: false,
              requestId: "synthetic",
            },
          },
        })
        .catch(() => undefined);
    store.deploymentStep(id, actor, "release_started", "synthetic-source");
    return route.fulfill({
      json: { action: store.receipt(id, actor, "synthetic-release") },
    });
  }));
  await page.route("**/api/actions/*/observe", guard(async (route) => {
    const id = new URL(route.request().url()).pathname.split("/")[3];
    const old = store.getAction(id, actor);
    const result = {
      outcome: observation,
      code:
        observation === "verified"
          ? "WORKLOAD_VERIFIED"
          : observation === "failed"
            ? "WORKLOAD_MISMATCH"
            : observation === "not_started"
              ? "RELEASE_NOT_STARTED"
            : "RELEASE_PENDING",
      checkedAt: Math.max(Date.now(), (old.deployment.observation?.checkedAt || 0) + 1),
      releaseId: old.remoteId,
      releaseState: observation === "not_started" ? null : observation === "pending" ? "BUILDING" : "READY",
      status: observation === "pending" || observation === "not_started" ? null : 200,
    };
    return route.fulfill({
      json: { action: store.recordDeploymentObservation(id, actor, result) },
    });
  }));
  await page.goto(server.origin);
  await page.getByLabel("کلید ورود محلی", { exact: true }).fill(server.token);
  await page.getByRole("button", { name: "ورود به میز کار", exact: true }).click();
  await page.getByRole("button", { name: "امتحان با پروژه نمونه", exact: true }).click();
  await page.getByRole("heading", { name: "نتیجه بررسی پروژه", exact: true }).waitFor();
  await page.getByLabel("مسیر بررسی نسخه", { exact: true }).fill("/checkout");
  await page.getByLabel("نسخه مورد انتظار", { exact: true }).fill("sample-v2");
  for (const width of [280, 360, 768, 1280]) await state("explicit-workload-oracle", width);
  await page.getByRole("button", { name: "دریافت پیشنهاد انتشار", exact: true }).press("Enter");
  await page.getByRole("heading", { name: "پیشنهاد انتشار", exact: true }).waitFor();
  await state("v4-decision-cost-unknown");
  await page
    .getByRole("button", {
      name: `تأیید پیشنهاد برای ${server.app}`,
      exact: true,
    })
    .press("Enter");
  await page.getByText("تأیید ثبت شد؛ اجرا نشده", { exact: true }).waitFor();
  assert.equal(sends, 0);
  await page.reload();
  await page.getByText("تأیید ثبت شد؛ اجرا نشده", { exact: true }).waitFor();
  await state("approved-is-not-executed");
  const begin = new Promise((done) => {
    started = done;
  });
  await page
    .getByRole("button", {
      name: `انتشار این نسخه روی ${server.app}`,
      exact: true,
    })
    .press("Enter");
  await begin;
  await page.getByRole("button", { name: "توقف انتظار", exact: true }).waitFor();
  await page.getByText("رسید بسته ذخیره شد؛ release هنوز رسید ندارد.", { exact: true }).waitFor();
  await state("durable-upload-progress");
  release();
  await page.getByRole("button", { name: "بررسی پاسخ و نسخه سایت", exact: true }).waitFor();
  await state("accepted-awaits-workload");
  await page.getByRole("button", { name: "بررسی پاسخ و نسخه سایت", exact: true }).press("Enter");
  await page
    .getByText("آماده‌شدن release هنوز تأیید نشده است. کمی بعد فقط نتیجه را بررسی کنید.", {
      exact: true,
    })
    .waitFor();
  await state("build-pending-manual-readback");
  observation = "failed";
  await page.getByRole("button", { name: "بررسی پاسخ و نسخه سایت", exact: true }).press("Enter");
  await page
    .getByText("انتشار یا پاسخ مورد انتظار سایت تأیید نشد. رفع مشکل اعلام نمی‌شود.", { exact: true })
    .waitFor();
  await state("ready-with-wrong-version-is-failed");
  assert.equal(sends, 1);
  await page.getByRole("button", { name: "دریافت پیشنهاد تازه", exact: true }).click();
  // The form is explicit state, while the saved action retains its immutable expected revision.
  await page
    .getByRole("button", {
      name: `تأیید پیشنهاد برای ${server.app}`,
      exact: true,
    })
    .click();
  const nextBegin = new Promise((done) => {
    started = done;
  });
  await page
    .getByRole("button", {
      name: `انتشار این نسخه روی ${server.app}`,
      exact: true,
    })
    .click();
  await nextBegin;
  release();
  await page.getByRole("button", { name: "بررسی پاسخ و نسخه سایت", exact: true }).waitFor();
  observation = "verified";
  await page.getByRole("button", { name: "بررسی پاسخ و نسخه سایت", exact: true }).click();
  await page.getByText("نتیجه تأیید شد", { exact: true }).waitFor();
  for (const width of [360, 768, 1280]) await state("matching-workload-verified", width);
  await page.getByRole("button", { name: "آماده‌سازی نسخه بعدی", exact: true }).click();
  await page.getByLabel("مسیر بررسی نسخه", { exact: true }).fill("/checkout");
  fixtureRevision = "sample-v3";
  await page.getByLabel("نسخه مورد انتظار", { exact: true }).fill(fixtureRevision);
  await page.getByRole("button", { name: "دریافت پیشنهاد انتشار", exact: true }).click();
  await page
    .getByRole("button", {
      name: `تأیید پیشنهاد برای ${server.app}`,
      exact: true,
    })
    .click();
  executionMode = "cancel";
  const cancelBegin = new Promise((done) => {
    started = done;
  });
  await page
    .getByRole("button", {
      name: `انتشار این نسخه روی ${server.app}`,
      exact: true,
    })
    .click();
  await cancelBegin;
  await page.getByRole("button", { name: "توقف انتظار", exact: true }).click();
  release();
  await page.getByText("نتیجه اجرا نامعلوم", { exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole("button", {
        name: `انتشار این نسخه روی ${server.app}`,
        exact: true,
      })
      .count(),
    0,
  );
  await page.getByRole("button", { name: "بررسی نتیجه بدون ارسال دوباره", exact: true }).waitFor();
  await page.reload();
  await page.getByText("نتیجه اجرا نامعلوم", { exact: true }).waitFor();
  await state("cancel-recovery-no-blind-retry");
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await state("uncertain-text-200-percent", 360);
  observation = "not_started";
  await page.getByRole("button", { name: "بررسی نتیجه بدون ارسال دوباره", exact: true }).press("Enter");
  await page.getByText("انتشار نسخه شروع نشده است. وضعیت بارگذاری بسته ممکن است نامعلوم باشد؛ پیشنهاد تازه به تأیید دوباره نیاز دارد.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "دریافت پیشنهاد تازه", exact: true }).waitFor();
  for (const width of [360, 768, 1280]) await state("stopped-before-release-needs-new-approval", width);
  assert.equal(sends, 3);
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  assert.equal(await page.evaluate(() => localStorage.length), 0);
  await writeFile(
    resolve(output, "results.json"),
    JSON.stringify(
      {
        mode: "browser-upstream-fixtures",
        results,
        errors,
        external,
        sends,
        realProviderRequests: 0,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      states: results.length,
      widths: [...new Set(results.map((row) => row.width))],
      pageErrors: errors.length,
      externalRequests: external.length,
      artifact: output,
    }),
  );
} catch (error) {
  await page.screenshot({ path: resolve(output, "failure.png"), fullPage: true }).catch(() => undefined);
  await writeFile(resolve(output, "failure.json"), JSON.stringify({ error: error.message, results, errors, realProviderRequests: 0 }, null, 2));
  throw error;
} finally {
  release();
  store?.close();
  await browser.close();
  await server.close();
}
