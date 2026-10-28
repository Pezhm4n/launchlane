import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { setTimeout as pause } from "node:timers/promises";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { startTestServer } from "./test-server.mjs";
import { Store } from "../src/server/persistence/store.ts";
import { AgentRepository } from "../src/server/agent/store.ts";
import { sealCredential } from "../src/server/connections/credentials.ts";

const server = await startTestServer({ agentFixture: true, environmentFixture: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: "fa-IR", reducedMotion: "reduce" });
const page = await context.newPage(), output = resolve(".artifacts/maintenance", new Date().toISOString().replaceAll(":", "-"));
await mkdir(output, { recursive: true });
const errors = [], external = [], results = [];
page.on("pageerror", error => errors.push(error.message));
await context.route("**/*", route => {
  if (new URL(route.request().url()).origin !== server.origin) { external.push(route.request().url()); return route.abort(); }
  return route.continue();
});
const decoded = result => JSON.parse(result.content[0].text).data;
const requests = async () => (await readFile(server.modelLog, "utf8").catch(() => "")).trim().split("\n").filter(Boolean);
let store, client;
try {
  await page.goto(server.origin);
  await page.getByLabel("کلید ورود محلی", { exact: true }).fill(server.token);
  await page.getByRole("button", { name: "ورود به میز کار", exact: true }).click();
  await page.getByRole("button", { name: "امتحان با پروژه نمونه", exact: true }).click();
  await page.locator("h1").filter({ hasText: "node-service" }).waitFor();
  const actor = createHash("sha256").update(server.token).digest("hex").slice(0, 24);
  store = new Store(join(server.stateDir, "state.sqlite"));
  const flow = store.getProjectFlow(actor), scope = { teamId: server.teamId, app: server.app }, origin = "https://sample-node.liara.run";
  assert.ok(flow?.artifact);
  store.saveConnection(actor, { source: "token", ciphertext: sealCredential("synthetic-fixture-credential", server.sessionSecret, actor, "liara"),
    view: { provider: "liara", status: "connected", identityId: "b".repeat(24), displayName: "آزمون", login: "fixture@example.test", teamId: server.teamId,
      teamName: "آزمون", checkedAt: Date.now(), selectedApp: server.app, apps: [{ name: server.app, id: "c".repeat(24), platform: "node" }] } });
  store.setProbeOrigin(actor, scope, origin);
  // Historical receipt fixture; the domain suite exercises actual synthetic publication/journal transitions.
  const historical = store.createAction(actor, { version: 7, operation: "deploy", scope, accountId: "b".repeat(24), targetAppId: "c".repeat(24),
    projectFlowId: flow.id, sourceHash: flow.profile.sourceHash, selectionHash: flow.selectionHash, artifactHash: flow.artifact.archiveHash,
    nodeVersion: flow.profile.nodeRuntime.version, args: { port: flow.profile.port, planId: "g2-standard" },
    workload: { origin, path: "/orders", status: 200, assertion: { kind: "text", contains: "Order accepted" } } });
  store.db.prepare("UPDATE actions SET state='succeeded',remote_id='previous-release' WHERE id=?").run(historical.id);
  store.db.prepare("INSERT INTO deployment_progress VALUES (?,?)").run(historical.id,
    JSON.stringify({ stage: "release_accepted", sourceId: "previous.tar.gz", releaseAcceptedAt: Date.now(), observation: null }));
  const grant = await page.evaluate(async () => {
    const workspace = await (await fetch("/api/workspace")).json();
    const response = await fetch("/api/mcp/access", { method: "POST", headers: { "content-type": "application/json", "x-csrf-token": workspace.session.csrfToken }, body: JSON.stringify({ missions: true }) });
    if (!response.ok) throw Error("MCP fixture access failed"); return response.json();
  });
  client = new Client({ name: "maintenance-regression", version: "1" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${server.origin}/api/mcp`), { requestInit: { headers: { authorization: `Bearer ${grant.accessToken}` } } }));
  const input = { requestKey: randomUUID(), goal: "آزمون نگهداری و بازگردانی نسخه" };
  const initial = decoded(await client.callTool({ name: "launchlane_maintain", arguments: input }));
  assert.ok(initial.run?.id);
  let ready;
  for (let i = 0; i < 80; i++) {
    ready = decoded(await client.callTool({ name: "launchlane_mission", arguments: { id: initial.run.id } }));
    if (ready.run.state === "needs_approval") break;
    assert.ok(!["failed", "interrupted"].includes(ready.run.state), JSON.stringify(ready.run));
    await pause(100);
  }
  assert.equal(ready.run.state, "needs_approval");
  assert.equal(ready.run.publication.spec.artifactHash, historical.spec.artifactHash);
  assert.equal(new AgentRepository(store).get(actor, initial.run.id)?.usage.modelCalls, 2);
  const replay = decoded(await client.callTool({ name: "launchlane_maintain", arguments: input }));
  assert.equal(replay.run.id, initial.run.id);
  await page.goto(ready.reviewUrl);
  const reject = page.getByRole("button", { name: "رد انتشار", exact: true });
  await reject.waitFor();
  for (const width of [320, 360, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(async () => { await document.fonts.ready; });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    assert.deepEqual(axe.violations.map(row => row.id), []);
    results.push({ width, state: "rollback-decision", overflow: false, axeViolations: 0 });
    await page.screenshot({ path: join(output, `rollback-${width}.png`), fullPage: true });
  }
  await page.reload(); await reject.waitFor();
  assert.equal((await requests()).length, 2);
  await reject.focus(); await page.keyboard.press("Enter");
  await reject.waitFor({ state: "hidden" });
  assert.equal(new AgentRepository(store).get(actor, initial.run.id)?.publication?.state, "cancelled");
  assert.equal(store.db.prepare("SELECT COUNT(*) n FROM attempts").get().n, 0);
  assert.equal((await requests()).length, 2);
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  await writeFile(join(output, "report.json"), JSON.stringify({ results, errors, external, realModelCalls: 0, cloudWrites: 0, modelRequests: 2, keyboardReject: true, reloadReplayed: false }, null, 2));
  console.log(JSON.stringify({ output, states: results.length, modelRequests: 2, realModelCalls: 0, cloudWrites: 0 }));
} finally { await client?.close(); store?.close(); await context.close(); await browser.close(); await server.close(); }
