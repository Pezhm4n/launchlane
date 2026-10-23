import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { startTestServer } from "./test-server.mjs";
import { seedDestinationProposal } from "../tests/helpers/destination-proposal.mjs";
import { fingerprint } from "../src/server/policy/action.ts";

const baseline = process.argv.includes("--baseline"), server = await startTestServer({ agentFixture: true, destinationFixture: true }), browser = await chromium.launch({ headless: true }),
  context = await browser.newContext({ locale: "fa-IR", reducedMotion: "reduce" }), page = await context.newPage(), output = resolve(".artifacts/destination-plans", `${baseline ? "before-" : "after-"}${new Date().toISOString().replaceAll(":", "-")}`);
await mkdir(output, { recursive: true });
const errors = [], external = [], results = [];
page.on("pageerror", error => errors.push(error.message));
await context.route("**/*", route => {
  if (new URL(route.request().url()).origin !== server.origin) { external.push(route.request().url()); return route.abort(); }
  return route.continue();
});
let fixture;
async function layout(width, label) {
  await page.setViewportSize({ width, height: 900 });
  await page.evaluate(async () => { await document.fonts.ready; scrollTo(0, 0); });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${label}: overflow`);
  if (label.startsWith("assistant-")) {
    const dialog = page.getByRole("dialog", { name: "دستیار هوشمند", exact: true }),
      shell = await dialog.locator(".destination-card").evaluate(node => {
        const content = node.closest(".assistant-float-content"), host = node.parentElement.parentElement;
        return { contentWidth: content.clientWidth, hostWidth: host.clientWidth, horizontalOverflow: host.scrollWidth > host.clientWidth };
      });
    assert.ok(shell.hostWidth >= shell.contentWidth - 48, JSON.stringify(shell));
    assert.equal(shell.horizontalOverflow, false);
    for (const button of await dialog.getByRole("button", { name: /^(گفت‌وگو و راهنمایی|پیگیری انتشار و انتخاب پلن)$/ }).all())
      assert.ok((await button.boundingBox()).height <= 120, "Mode controls must remain compact above the scrollable publication");
  }
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  assert.deepEqual(axe.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) })), [], label);
  await page.screenshot({ path: join(output, `${label}-${width}.png`), fullPage: true });
  results.push({ width, label, axeViolations: 0, overflow: false });
}
try {
  fixture = await seedDestinationProposal(server);
  const flow = fixture.store.getProjectFlow(fixture.actor), input = { projectId: flow.id, sourceHash: flow.profile.sourceHash, path: "/", expectedText: null };
  fixture.run.mission = { ...input, kind: "publication", identity: fingerprint({ input, context: fixture.run.context }) };
  fixture.repository.save(fixture.actor, fixture.run);
  await page.goto(server.origin); await page.getByLabel("کلید ورود محلی", { exact: true }).fill(server.token);
  await page.getByRole("button", { name: "ورود به میز کار", exact: true }).click();
  const card = page.locator(".destination-card"); await card.getByRole("heading", { name: "ساخت مقصد تازه", exact: true }).waitFor();
  for (const width of [320, 390, 768, 1280]) await layout(width, "plan-choice");
  await page.getByRole("button", { name: "حساب‌ها", exact: true }).click();
  const accounts = page.getByRole("dialog", { name: "حساب‌ها و دسترسی", exact: true }); await accounts.waitFor();
  await layout(390, "empty-account"); await layout(1280, "empty-account");
  if (!baseline) {
    assert.equal(await accounts.getByText(/Launchlane در این مرحله برنامه جدید ایجاد نمی‌کند/).count(), 0);
    await accounts.getByRole("button", { name: "ادامه با پیشنهاد مقصد و پلن", exact: true }).click();
  } else await accounts.getByRole("button", { name: "بستن", exact: true }).click();
  await accounts.waitFor({ state: "detached" });
  if (!baseline) {
    await page.getByRole("button", { name: "باز کردن دستیار هوشمند", exact: true }).click();
    const assistant = page.getByRole("dialog", { name: "دستیار هوشمند", exact: true });
    await assistant.getByRole("button", { name: "پیگیری انتشار و انتخاب پلن", exact: true }).click();
    await assistant.locator(".destination-card").waitFor();
    assert.equal(await page.locator(".destination-card").count(), 1, "The assistant moves the existing review, without a second mission view");
    assert.equal(fixture.store.db.prepare("SELECT count(*) n FROM agent_runs").get().n, 1);
    const choice = card.getByRole("group", { name: "پلن انتشار را انتخاب کنید", exact: true });
    assert.equal(await choice.getByRole("radio").count(), 3);
    assert.equal(await choice.getByRole("radio").first().isChecked(), true);
    const first = fixture.repository.get(fixture.actor, fixture.run.id), beforeTokens = first.usage.modelCalls;
    const change = page.waitForResponse(response => response.url().endsWith(`/api/agent/runs/${first.id}`) && response.request().method() === "POST");
    let releaseChoice; const choiceGate = new Promise(done => { releaseChoice = done; });
    await page.route(`**/api/agent/runs/${first.id}`, async route => {
      if (route.request().method() === "POST" && route.request().postDataJSON().operation === "destination-choice") await choiceGate;
      await route.continue();
    });
    await choice.getByRole("radio").first().focus(); await choice.getByRole("radio").first().press("ArrowDown");
    await card.getByRole("status").filter({ hasText: "در حال بررسی قیمت و ثبت پلن انتخابی…" }).waitFor();
    assert.equal(await choice.getByRole("radio").first().isDisabled(), true);
    releaseChoice(); assert.equal((await change).status(), 200);
    const growth = choice.getByRole("radio", { name: /growth/ }); await growth.waitFor();
    await page.waitForFunction(label => [...document.querySelectorAll('input[type="radio"]')].some(input => input.getAttribute("aria-label") === label && input.checked), await growth.getAttribute("aria-label"));
    assert.equal(await growth.isChecked(), true);
    const revised = fixture.repository.get(fixture.actor, first.id); assert.notEqual(revised.destination.id, first.destination.id);
    assert.equal(revised.destination.spec.args.planId, "growth"); assert.equal(revised.usage.modelCalls, beforeTokens);
    assert.equal(fixture.store.getAction(first.destination.id, fixture.actor).state, "cancelled");
    for (const width of [320, 390, 768, 1280]) await layout(width, "assistant-plan-needs-new-consent");
    await assistant.getByRole("button", { name: "بستن دستیار هوشمند", exact: true }).click();
    await assistant.waitFor({ state: "hidden" });
    assert.equal(await card.getByRole("radio", { name: /growth/ }).isChecked(), true);
    assert.equal(await page.locator(".destination-card").count(), 1);
    await layout(1280, "same-plan-after-assistant-close");
    const before = fixture.repository.get(fixture.actor, first.id); await page.reload(); await card.waitFor();
    assert.equal(await card.getByRole("radio", { name: /growth/ }).isChecked(), true); assert.deepEqual(fixture.repository.get(fixture.actor, first.id).usage, before.usage);
    await page.evaluate(() => document.documentElement.style.fontSize = "200%"); await layout(320, "plan-text-200");
    await page.evaluate(() => document.documentElement.style.fontSize = "");
    await card.getByRole("button", { name: "رد ساخت مقصد", exact: true }).click(); await card.getByText("ساخت مقصد رد شد؛ برنامه‌ای ساخته نشد.", { exact: true }).waitFor();
    assert.equal(fixture.store.db.prepare("SELECT count(*) n FROM attempts").get().n, 0);
  }
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  await writeFile(join(output, "results.json"), JSON.stringify({ baseline, results, errors, external, providerWrites: 0, modelCalls: 0 }, null, 2));
  console.log(JSON.stringify({ states: results.length, output, baseline, providerWrites: 0, modelCalls: 0 }));
} finally { fixture?.store.close(); await context.close(); await browser.close(); await server.close(); }
