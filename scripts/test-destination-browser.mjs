import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";
import { startTestServer } from "./test-server.mjs";
import { seedDestinationProposal } from "../tests/helpers/destination-proposal.mjs";
import { fingerprint } from "../src/server/policy/action.ts";

const server = await startTestServer({ agentFixture: true }), browser = await chromium.launch({ headless: true }),
  context = await browser.newContext({ locale: "fa-IR", reducedMotion: "reduce" }), output = resolve(".artifacts/destination-ui", new Date().toISOString().replaceAll(":", "-"));
await mkdir(output, { recursive: true });
const page = await context.newPage(), errors = [], external = [], results = [];
page.on("pageerror", (error) => errors.push(error.message));
await context.route("**/*", (route) => {
  if (new URL(route.request().url()).origin !== server.origin) { external.push(route.request().url()); return route.abort(); }
  return route.continue();
});
let fixture;
async function layout(width, label) {
  await page.setViewportSize({ width, height: 900 });
  await page.evaluate(async () => { await document.fonts.ready; window.scrollTo(0, 0); });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 0, `${label} overflow`);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  assert.deepEqual(axe.violations.map((item) => ({ id: item.id, nodes: item.nodes.map((node) => node.target) })), []);
  const targets = await page.locator(".destination-card button:visible").evaluateAll((nodes) => nodes.map((node) => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));
  assert.ok(targets.every((target) => target.width >= 44 && target.height >= 44));
  await page.screenshot({ path: join(output, `${label}-${width}.png`), fullPage: true });
  results.push({ label, width, overflow, axeViolations: axe.violations.length });
}
try {
  fixture = await seedDestinationProposal(server);
  const flow = fixture.store.getProjectFlow(fixture.actor);
  const input = { projectId: flow.id, sourceHash: flow.profile.sourceHash, path: "/", expectedText: null };
  fixture.run.mission = { ...input, kind: "publication", identity: fingerprint({ input, context: fixture.run.context }) };
  fixture.repository.save(fixture.actor, fixture.run);
  await page.goto(server.origin);
  await page.getByLabel("کلید ورود محلی", { exact: true }).fill(server.token);
  await page.getByRole("button", { name: "ورود به میز کار", exact: true }).click();
  const card = page.locator(".destination-card");
  await card.getByRole("heading", { name: "ساخت مقصد تازه", exact: true }).waitFor();
  await card.getByRole("button", { name: "تأیید هزینه و ساخت مقصد", exact: true }).waitFor();
  const plans = card.getByRole("group", { name: "پلن انتشار را انتخاب کنید", exact: true });
  assert.equal(await plans.getByRole("radio").count(), 3);
  // Independent fixture totals: plan=500/1000/1500 + basic=40 toman/hour.
  // Keep hourly/day/month checks scoped to each offer; disclosure text alone is insufficient.
  for (const expected of [
    { plan: "starter", hourly: "۵۴۰", day: "۱۲٬۹۶۰ تومان", month: "۳۸۸٬۸۰۰ تومان" },
    { plan: "growth", hourly: "۱٬۰۴۰", day: "۲۴٬۹۶۰ تومان", month: "۷۴۸٬۸۰۰ تومان" },
    { plan: "scale", hourly: "۱٬۵۴۰", day: "۳۶٬۹۶۰ تومان", month: "۱٬۱۰۸٬۸۰۰ تومان" },
  ]) {
    const offer = plans.locator("label").filter({ has: page.getByRole("radio", { name: new RegExp(`^${expected.plan}،`) }) });
    await offer.getByText("در هر ساعت", { exact: true }).waitFor();
    await offer.getByText(expected.hourly, { exact: true }).waitFor();
    await offer.getByText("تومان", { exact: true }).waitFor();
    await offer.getByText(expected.day, { exact: true }).waitFor();
    await offer.getByText(expected.month, { exact: true }).waitFor();
    assert.doesNotMatch(await offer.textContent(), /حدود|تومن|هزار|میلیون/);
  }
  await card.getByText("مبلغ دقیق پلن‌ها", { exact: true }).click();
  // Independent fixture: starter=500 + basic=40 toman/hour; 24/720 continuous hours.
  await card.getByText("هر ساعت: ۵۴۰ تومان؛ ۲۴ ساعت: ۱۲٬۹۶۰ تومان؛ ۳۰ روز: ۳۸۸٬۸۰۰ تومان", { exact: true }).waitFor();
  assert.match(await card.textContent(), /هنوز اندازه‌گیری نشده/);
  for (const width of [360, 768, 1280]) await layout(width, "creation-proposal");
  await page.reload();
  await card.waitFor();
  await card.getByRole("button", { name: "تأیید هزینه و ساخت مقصد", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: /خاموش/ }).waitFor();
  assert.equal(fixture.store.db.prepare("SELECT COUNT(*) AS n FROM attempts").get().n, 0);
  await layout(360, "disabled-create-keeps-proposal");
  fixture.store.db.prepare("UPDATE actions SET expires_at=0 WHERE id=?").run(fixture.action.id);
  await page.reload();
  await card.getByRole("button", { name: "بستن پیشنهاد منقضی‌شده", exact: true }).waitFor();
  assert.equal(await card.getByRole("button", { name: "تأیید هزینه و ساخت مقصد", exact: true }).count(), 0);
  await layout(360, "expired-create-can-be-dismissed");
  await card.getByRole("button", { name: "بستن پیشنهاد منقضی‌شده", exact: true }).click();
  await card.getByText("ساخت مقصد رد شد؛ برنامه‌ای ساخته نشد.", { exact: true }).waitFor();
  assert.equal(fixture.store.getAction(fixture.action.id, fixture.actor).state, "cancelled");
  assert.equal(fixture.store.db.prepare("SELECT COUNT(*) AS n FROM attempts").get().n, 0);
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  await writeFile(join(output, "results.json"), JSON.stringify({ boundary: "synthetic proposal; real local HTTP/browser; all provider writes disabled", results, errors, external }, null, 2));
  console.log(JSON.stringify({ states: results.length, providerWrites: 0, output }));
} finally { fixture?.store.close(); await context.close(); await browser.close(); await server.close(); }
