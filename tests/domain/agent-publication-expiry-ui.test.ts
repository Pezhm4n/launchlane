import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JsxEmit, ModuleKind, transpileModule } from "typescript";
import type { Action } from "../../src/contracts/domain.ts";
import type * as PublicationModule from "../../src/components/AgentPublication.tsx";

const source = await readFile(resolve("src/components/AgentPublication.tsx"), "utf8");
const code = transpileModule(source, { compilerOptions: { module: ModuleKind.ESNext, jsx: JsxEmit.ReactJSX } }).outputText
  .replace('"react/jsx-runtime"', JSON.stringify(import.meta.resolve("react/jsx-runtime")))
  .replace('"react"', JSON.stringify(import.meta.resolve("react")))
  .replace('"../contracts/deployment.ts"', JSON.stringify(pathToFileURL(resolve("src/contracts/deployment.ts")).href));
const { AgentPublication }: typeof PublicationModule = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);

function action(state: Action["state"]): Action {
  return { id: "expired-publication", actorId: "synthetic-actor", hash: "a".repeat(64), state,
    createdAt: 1, expiresAt: 2, attemptId: null, remoteId: null, errorCode: null, spec: {
      version: 7, operation: "deploy", scope: { teamId: "synthetic-team", app: "synthetic-site" },
      sourceHash: "b".repeat(64), artifactHash: "c".repeat(64), projectFlowId: "synthetic-project",
      selectionHash: "d".repeat(64), accountId: "synthetic-account", targetAppId: "synthetic-app", nodeVersion: "22",
      args: { port: 3000, planId: "existing-plan" },
      workload: { origin: "https://synthetic-site.example.com", path: "/orders", status: 200, assertion: { kind: "text", contains: "سفارش‌ها" } },
    } };
}
function render(state: Action["state"], waiting = true, disabled = false) {
  return renderToStaticMarkup(createElement(AgentPublication, { action: action(state), waiting, disabled, onDecision: () => {}, onObserve: () => {} }));
}

test("an expired pending publication can be closed in the guided flow while approval remains unavailable", () => {
  const html = render("expired");
  assert.match(html, /بستن پیشنهاد منقضی‌شده/);
  assert.match(html, /پیشنهاد تازه/);
  assert.doesNotMatch(html, /در گفت‌وگو|تأیید و انتشار این نسخه|رد انتشار/);
  assert.match(html, /role="status"/);
  assert.match(html, /سفارش‌ها/); assert.match(html, /\/orders/);
});

test("a current proposal retains its existing approve and reject controls and pending decisions disable both", () => {
  assert.match(render("awaiting_approval"), /تأیید و انتشار این نسخه/);
  assert.match(render("awaiting_approval"), /رد انتشار/);
  assert.equal((render("awaiting_approval", true, true).match(/disabled=""/g) ?? []).length, 2);
  assert.equal((render("expired", true, true).match(/disabled=""/g) ?? []).length, 1);
});

test("historical, cancelled and uncertain cards cannot acquire an expired-decision control or claim success", () => {
  assert.doesNotMatch(render("expired", false), /بستن پیشنهاد منقضی‌شده|تأیید و انتشار این نسخه/);
  for (const state of ["cancelled", "uncertain", "executing", "failed"] as const) {
    const html = render(state);
    assert.doesNotMatch(html, /بستن پیشنهاد منقضی‌شده|تأیید و انتشار این نسخه|باز کردن سایت|publication-success-address/);
  }
  assert.match(render("uncertain"), /نتیجه ارسال نامعلوم/);
});

test("verified publication leads with the exact approved URL, usable site and copy actions, and collapsed review details", () => {
  const html = render("succeeded", false);
  assert.match(html, /سایت شما منتشر شد/); assert.match(html, /انتشار موفق/);
  assert.match(html, /https:\/\/synthetic-site\.example\.com\/orders/);
  assert.match(html, /باز کردن سایت/); assert.match(html, /کپی لینک سایت/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /<details class="publication-review">/);
  assert.doesNotMatch(html, /تأیید و انتشار این نسخه/);
  for (const state of ["approved", "executing", "observing", "uncertain", "failed", "expired", "cancelled"] as const)
    assert.doesNotMatch(render(state), /سایت شما منتشر شد|نشانی سایت شما|باز کردن سایت|کپی لینک سایت/);
});
