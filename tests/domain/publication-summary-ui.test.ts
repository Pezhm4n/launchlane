import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transpileModule, ModuleKind, JsxEmit } from "typescript";
import type { AgentEvent, AgentView } from "../../src/contracts/agent.ts";
import type * as StepModule from "../../src/components/AgentSteps.tsx";
import type * as PlanModule from "../../src/components/DestinationPlans.tsx";

// Node cannot import trusted TSX/CSS directly; preserve their component graph for render assertions.
async function componentUrl(path: string): Promise<string> {
  const absolute = resolve(path), source = await readFile(absolute, "utf8");
  if (absolute.endsWith(".module.css")) {
    const classes = Object.fromEntries([...source.matchAll(/\.([A-Za-z][A-Za-z0-9_-]*)/g)].map(match => [match[1], match[1]]));
    return `data:text/javascript;base64,${Buffer.from(`export default ${JSON.stringify(classes)}`).toString("base64")}`;
  }
  let code = transpileModule(source, { compilerOptions: { module: ModuleKind.ESNext, jsx: JsxEmit.ReactJSX } }).outputText;
  for (const match of [...code.matchAll(/from ["']([^"']+)["']/g)]) {
    const specifier = match[1]; assert.ok(specifier);
    const target = specifier.startsWith(".") ? resolve(dirname(absolute), specifier) : null,
      url = target ? /\.(?:tsx|module\.css)$/.test(target) ? await componentUrl(target) : pathToFileURL(target).href : import.meta.resolve(specifier);
    code = code.replace(match[0], `from ${JSON.stringify(url)}`);
  }
  return `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
}
const steps: typeof StepModule = await import(await componentUrl("src/components/AgentSteps.tsx")),
  plans: typeof PlanModule = await import(await componentUrl("src/components/DestinationPlans.tsx"));
function run(events: AgentEvent[]): AgentView {
  return { id: "summary-case", revision: 1, projectId: "project-case", state: "working", events, nextAction: null, question: null,
    updatedAt: 1, effect: "no_remote_changes", repair: null, publication: null, destination: null, destinationContinued: false };
}
const events: AgentEvent[] = [
  { sequence: 1, kind: "activity", message: "خواندن قیمت", at: 1, callId: "quote" },
  { sequence: 2, kind: "tool", message: "قیمت دریافت شد", at: 2, callId: "quote", outcome: "succeeded" },
  { sequence: 3, kind: "activity", message: "بررسی فایل‌های ساخته‌شده", at: 3, callId: "assets" },
  { sequence: 4, kind: "tool", message: "بررسی کامل نشد", at: 4, callId: "assets", outcome: "failed", failure: {
    code: "ASSET_MISSING", message: "فایل رابط در خروجی ساخت موجود نیست.", nextStep: "مسیر خروجی ساخت باید اصلاح و دوباره بررسی شود." } },
  { sequence: 5, kind: "assistant", message: "تمام شد؛ همه تست‌ها گذشتند", at: 5 },
  { sequence: 6, kind: "activity", message: "دریافت وضعیت ثبت‌شده", at: 6, callId: "readback" },
];
test("the step summary counts correlated host results once and keeps the current pending action distinct from model prose", () => {
  const derived = steps.publicationSteps(events, true);
  assert.equal(derived.length, 3);
  assert.deepEqual(steps.publicationStepSummary(derived), { succeeded: 1, failed: 1, pending: "دریافت وضعیت ثبت‌شده" });
  const unproven = steps.publicationSteps([{ sequence: 1, kind: "tool", message: "همه تست‌ها گذشتند", at: 1 }], false);
  assert.deepEqual(steps.publicationStepSummary(unproven), { succeeded: 0, failed: 0, pending: null });
});
test("a restored failure opens its readable cause and next action; a fresh successful run starts compact", () => {
  const failed = renderToStaticMarkup(createElement(steps.AgentSteps, { run: run(events), active: true }));
  assert.match(failed, /^<details[^>]*open=""/);
  assert.match(failed, /۱ انجام شد/); assert.match(failed, /۱ ناموفق/);
  assert.match(failed, /مسیر خروجی ساخت باید اصلاح و دوباره بررسی شود/);
  assert.doesNotMatch(failed, /تمام شد؛ همه تست‌ها گذشتند|٪/);
  const successful = renderToStaticMarkup(createElement(steps.AgentSteps, { run: run(events.slice(0, 2)), active: false }));
  assert.doesNotMatch(successful, /^<details[^>]*open=/);
});
test("24-hour and 30-day estimates retain integer-quote precision, including sub-toman rates and large totals", () => {
  assert.deepEqual(plans.planCostProjection(104166), { day: "۲۴٬۹۹۹٫۸۴", month: "۷۴۹٬۹۹۵٫۲" });
  assert.deepEqual(plans.planCostProjection(1), { day: "۰٫۲۴", month: "۷٫۲" });
  assert.deepEqual(plans.planCostProjection(0), { day: "۰", month: "۰" });
  assert.deepEqual(plans.planCostProjection(1_000_000_000_000_001), { day: "۲۴۰٬۰۰۰٬۰۰۰٬۰۰۰٬۰۰۰٫۲۴", month: "۷٬۲۰۰٬۰۰۰٬۰۰۰٬۰۰۰٬۰۰۷٫۲" });
  for (const invalid of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => plans.planCostProjection(invalid), RangeError);
});
test("plan cards identify derived continuous-runtime estimates and keep the same quoted source and exclusions", () => {
  const html = renderToStaticMarkup(createElement(plans.DestinationPlans, { recommendation: { version: 1, projectId: "project-case", sourceHash: "a".repeat(64), catalogFingerprint: "b".repeat(64),
    observedAt: 1, projectName: "فروشگاه", summary: "پروژه بررسی شد", reason: "پیشنهاد شروع", capacity: "unmeasured", recommended: { planId: "starter", bundleId: "basic" },
    offers: [{ planId: "starter", bundleId: "basic", region: "iran", hourlyHundredthsToman: 104166 }] }, selected: { planId: "starter", bundleId: "basic" }, disabled: false, onChange: () => {} }));
  assert.match(html, /برآورد روشن‌ماندن پیوسته/); assert.match(html, /۲۴٬۹۹۹٫۸۴/); assert.match(html, /۷۴۹٬۹۹۵٫۲/);
  assert.match(html, /ثابت‌ماندن نرخ همین پیشنهاد/); assert.match(html, /مالیات، ترافیک و فضای اضافه جدا هستند/);
  assert.doesNotMatch(html, /قیمت ماهانهٔ رسمی|ظرفیت اندازه‌گیری‌شده/);
});
