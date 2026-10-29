import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { componentUrl } from "../helpers/react-component.ts";
import type { Action, ActionSpec } from "../../src/contracts/domain.ts";
import type { AgentPublication } from "../../src/components/AgentPublication.tsx";
import type { AgentDestination } from "../../src/components/AgentDestination.tsx";
import { parseActionSpec } from "../../src/server/policy/action.ts";

async function component(path: string): Promise<Record<string, unknown>> { return import(await componentUrl(path)); }
const runtime = { kind: "python", version: "3.12", command: ["python3", "main.py"] } as const;
const common = { scope: { teamId: "a".repeat(24), app: "python-ui-test" }, sourceHash: "1".repeat(64), artifactHash: "2".repeat(64),
  projectFlowId: randomUUID(), selectionHash: "3".repeat(64), accountId: "b".repeat(24) };
function action(spec: ActionSpec): Action {
  return { id: randomUUID(), actorId: "ui-test", hash: "4".repeat(64), spec, state: "awaiting_approval", createdAt: Date.now(),
    expiresAt: Date.now() + 600000, attemptId: null, remoteId: null, errorCode: null };
}

test("Python, native Next and historical Node publication decisions render their approval and correct runtime", async () => {
  const loaded = await component("src/components/AgentPublication.tsx");
  assert.equal(typeof loaded.AgentPublication, "function");
  const Publication = loaded.AgentPublication as typeof AgentPublication;
  for (const version of [7, 10, 11, 17, 19]) {
    const spec = parseActionSpec({ ...common, version, operation: "deploy", targetAppId: "c".repeat(24), args: { port: version === 19 ? 80 : 8000, planId: "starter" },
      nodeVersion: version === 11 ? null : version === 19 ? "20" : "22", ...(version === 11 ? { runtime, environment: null } : version === 19 ? { runtime: { kind: "react", builder: "vite", nodeVersion: "20", outputDirectory: "build", mirror: false }, environment: null } : version === 17 ? { runtime: { kind: "next", version: "22", mirror: false }, environment: null } : version === 10 ? { environment: { actionId: randomUUID(), fingerprint: "6".repeat(64), keys: [] } } : {}),
      workload: { origin: "https://python-ui-test.liara.run", path: "/", status: 200, assertion: { kind: "text", contains: "ready" } } });
    const value = action(spec), props = { action: value, csrf: "synthetic-csrf", waiting: true, disabled: false, onDecision: () => {}, onObserve: () => {} };
    const pending = renderToStaticMarkup(createElement(Publication, props));
    assert.match(pending, /تأیید و انتشار این نسخه/); assert.match(pending, /رد انتشار/);
    assert.ok(pending.includes(version === 11 ? ">Python<" : version === 19 ? ">React / Node<" : version === 17 ? ">Next.js / Node<" : ">Node<")); assert.ok(pending.includes(version === 11 ? ">3.12<" : version === 19 ? ">20<" : ">22<"));
    const done = renderToStaticMarkup(createElement(Publication, { ...props, waiting: false, action: { ...value, state: "succeeded" } }));
    assert.match(done, /نسخه جاری و پاسخ مورد انتظار تأیید شدند/); assert.match(done, /باز کردن سایت/); assert.doesNotMatch(done, /تأیید و انتشار این نسخه/);
  }
});

test("Python, Next and Node destination decisions remain visible before creation", async () => {
  const loaded = await component("src/components/AgentDestination.tsx");
  assert.equal(typeof loaded.AgentDestination, "function");
  const Destination = loaded.AgentDestination as typeof AgentDestination;
  for (const version of [8, 12, 18, 20]) {
    const now = Date.now(), spec = parseActionSpec({ ...common, version, operation: "create_app", previousAppId: null,
      nodeVersion: version === 12 ? null : version === 20 ? "20" : "22", ...(version === 12 ? { runtime } : version === 20 ? { runtime: { kind: "vue", builder: "vite", nodeVersion: "20", outputDirectory: "dist", mirror: false } } : version === 18 ? { runtime: { kind: "next", version: "22", mirror: false } } : {}), networkId: "c".repeat(24), bundleId: "basic", readOnlyRootFilesystem: true,
      args: { port: null, planId: "starter" }, cost: { catalogFingerprint: "5".repeat(64), observedAt: now, expiresAt: now + 600000,
        hourlyHundredthsToman: 54000, region: "iran", currency: "toman", period: "hour", extras: "tax_traffic_storage_not_included" } });
    const html = renderToStaticMarkup(createElement(Destination, { action: action(spec), waiting: true, disabled: false, resumable: false, onDecision: () => {}, onObserve: () => {} }));
    assert.match(html, /تأیید هزینه و ساخت مقصد/); assert.match(html, /رد ساخت مقصد/); assert.match(html, /تومان در ساعت/);
  }
});
