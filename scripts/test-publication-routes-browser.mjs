import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { startTestServer } from "./test-server.mjs";
import { Store } from "../src/server/persistence/store.ts";
import { AgentRepository } from "../src/server/agent/store.ts";
import { readConfig } from "../src/server/config.ts";
import { sealCredential } from "../src/server/connections/credentials.ts";
import { GoalModelClient } from "../src/server/agent/model.ts";
import { createAgentRun, driveAgentRun } from "../src/server/agent/runs.ts";
import { executeAgentTool } from "../src/server/agent/tools.ts";
import { LiaraReadClient } from "../src/server/liara/client.ts";
import { WorkloadProbe } from "../src/server/liara/probe.ts";
import { publicationRouteChecks } from "../tests/helpers/publication-workload-fixture.ts";

// Actual application/Agent persistence and browser/HTTP replay. Provider, DNS/TLS,
// workload and model ports are controlled synthetic fixtures. The server's live gates stay off.
const server = await startTestServer(), browser = await chromium.launch({ headless: true }), context = await browser.newContext({ locale: "fa-IR", reducedMotion: "reduce" }), page = await context.newPage();
const output = resolve(".artifacts/publication-routes", new Date().toISOString().replaceAll(":", "-")); await mkdir(output, { recursive: true });
const errors = [], external = [], results = []; let store, client, modelRequests = 0, providerReads = 0, probes = 0;
page.on("pageerror", error => errors.push(error.message));
await context.route("**/*", route => { if (new URL(route.request().url()).origin !== server.origin) { external.push(new URL(route.request().url()).origin); return route.abort(); } return route.continue(); });
try {
  await page.goto(server.origin); await page.getByLabel("کلید ورود محلی", { exact: true }).fill(server.token); await page.getByRole("button", { name: "ورود به میز کار", exact: true }).click();
  await page.getByRole("button", { name: "امتحان با پروژه نمونه", exact: true }).click(); await page.locator("h1").filter({ hasText: "node-service" }).waitFor();
  const actor = createHash("sha256").update(server.token).digest("hex").slice(0, 24), appId = "c".repeat(24), accountId = "b".repeat(24), origin = "https://sample-node.liara.run", releaseId = "recorded-release";
  store = new Store(join(server.stateDir, "state.sqlite")); const flow = store.getProjectFlow(actor); assert.ok(flow?.artifact);
  const config = readConfig({ LAUNCHLANE_STATE_DIR: server.stateDir, LAUNCHLANE_WORKSPACE_ROOT: server.workspace, LAUNCHLANE_ORIGIN: server.origin,
    LAUNCHLANE_OPERATOR_TOKEN: server.token, LAUNCHLANE_SESSION_SECRET: server.sessionSecret, LIARA_TEAM_ID: server.teamId, LAUNCHLANE_APP_ALLOWLIST: server.app,
    LIARA_API_TOKEN: "synthetic-route-browser-credential", LAUNCHLANE_ENABLE_LIVE_LIARA: "true", LAUNCHLANE_ENABLE_LIVE_MODEL: "true",
    MODEL_API_KEY: "synthetic-route-browser-model", MODEL_ID: "gpt-6-luna" });
  store.saveConnection(actor, { source: "token", ciphertext: sealCredential(config.liaraToken, config.sessionSecret, actor, "liara"), view: {
    provider: "liara", status: "connected", identityId: accountId, displayName: "آزمون", login: "fixture@example.test", teamId: server.teamId, teamName: "آزمون", checkedAt: Date.now(),
    selectedApp: server.app, apps: [{ name: server.app, id: appId, platform: "node" }],
  } });
  const scope = { teamId: server.teamId, app: server.app }; store.setProbeOrigin(actor, scope, origin);
  const session = { id: randomUUID(), actorId: actor, csrfToken: "synthetic-route-session", expiresAt: Date.now() + 600000 }; store.saveSession(session);
  const action = store.createAction(actor, { version: 7, operation: "deploy", scope, accountId, targetAppId: appId, projectFlowId: flow.id,
    sourceHash: flow.profile.sourceHash, selectionHash: flow.selectionHash, artifactHash: flow.artifact.archiveHash, nodeVersion: flow.profile.nodeRuntime.version,
    args: { port: flow.profile.port, planId: "g2-standard" }, workload: { origin, path: "/", status: 200, assertion: { kind: "text", contains: "Order accepted" } } });
  store.decide(action.id, actor, session.id, action.hash, "approve"); store.claim(action.id, actor, session.id, action.spec);
  store.deploymentStep(action.id, actor, "upload_started"); store.deploymentStep(action.id, actor, "uploaded", "fixture-source.tar.gz");
  store.deploymentStep(action.id, actor, "release_started", "fixture-source.tar.gz"); store.receipt(action.id, actor, releaseId);
  await page.screenshot({ path: join(output, "before-observation.png"), fullPage: true });
  for (const mode of ["matched", "mismatch", "inconclusive"]) {
    let current = releaseId, turn = 0;
    const read = new LiaraReadClient(config, async (_url, init) => { assert.equal(init.method, "GET"); providerReads++;
      return Response.json(_url.includes("/releases") ? { currentRelease: current, total: 1, releases: [{ _id: releaseId, state: "READY", port: 3000 }] }
        : { project: { _id: appId, project_id: server.app, type: "node", status: "Running", planID: "g2-standard", envs: [] } }); });
    const probe = new WorkloadProbe({ ...config, probeOrigins: { [server.app]: origin } }, async () => [{ address: "93.184.216.34", family: 4 }], async url => {
      assert.equal(url.origin, origin); probes++; if (mode === "inconclusive") current = "replacement-release";
      const body = url.pathname === "/" ? "Order accepted" : url.pathname === "/api/orders" ? '{"summary":{"total":73}}' : JSON.stringify({ auth: { authenticated: mode !== "mismatch" } });
      return { status: 200, body, bytes: Buffer.byteLength(body), durationMs: 1, contentType: url.pathname === "/" ? "text/html" : "application/json" };
    });
    const model = new GoalModelClient(config, async (_url, init) => { modelRequests++; turn++;
      const body = JSON.parse(String(init.body)), actionId = turn === 2 ? JSON.parse(body.messages.at(-1).content).data.sourceComparison.recordedActionId : null;
      if (turn === 2) assert.equal(actionId, action.id);
      return Response.json({ choices: [{ finish_reason: "tool_calls", message: { role: "assistant", tool_calls: [{ id: randomUUID(), type: "function", function: turn === 1
      ? { name: "read_releases", arguments: "{}" } : turn === 2
      ? { name: "read_workload", arguments: JSON.stringify({ path: "/", publicationActionId: actionId, checks: publicationRouteChecks }) }
      : { name: "finish_investigation", arguments: JSON.stringify({ state: "partially_completed", message: "رسید خواندن مسیرها حفظ شد؛ انتشار تازه‌ای انجام نشده است.", question: null, nextAction: "reply" }) },
    }] } }], usage: { total_tokens: 20 } }); });
    const run = createAgentRun(config, store, session, randomUUID(), `بررسی مسیرهای نسخه؛ حالت ${mode}`, flow.id, "maintenance").run;
    await driveAgentRun(config, store, session, run.id, { model, tool: (name, args, c) => executeAgentTool(name, args, { ...c, read, probe }) });
    const repo = new AgentRepository(store), saved = repo.get(actor, run.id); assert.equal(saved.state, "partially_completed"); assert.equal(saved.effect, "no_remote_changes");
    const receipt = saved.messages.filter(message => message.role === "tool").map(message => JSON.parse(message.content)).find(result => result.ok && result.data?.contract === "publication-routes-v1")?.data;
    assert.ok(receipt); assert.equal(receipt.outcome, mode); assert.equal(receipt.actionId, action.id); assert.equal(receipt.releaseId, releaseId);
    assert.equal(receipt.artifactHash, flow.artifact.archiveHash); assert.equal(receipt.publicationVerified, false); assert.equal(saved.usage.modelCalls, 3);
    const notice = saved.events.find(event => event.tool === "read_workload" && event.notice)?.notice; assert.ok(notice);
    await page.goto(`${server.origin}/?view=publish&project=${flow.id}`); const journey = page.locator(".publication-journey");
    await journey.getByText("مراحل بررسی", { exact: true }).click(); await journey.getByText(notice, { exact: true }).waitFor();
    for (const width of [280, 320, 390, 768, 1280]) { await page.setViewportSize({ width, height: 844 }); await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze(); assert.deepEqual(axe.violations.map(row => row.id), []);
      results.push({ mode, width, overflow: false, axeViolations: 0 }); }
    await page.screenshot({ path: join(output, `${mode}-1280.png`), fullPage: true });
    const before = { modelRequests, providerReads, probes, usage: saved.usage, limits: saved.limits }; await page.reload();
    assert.deepEqual(repo.get(actor, run.id).usage, before.usage); assert.deepEqual(repo.get(actor, run.id).limits, before.limits);
    assert.deepEqual({ modelRequests, providerReads, probes }, { modelRequests: before.modelRequests, providerReads: before.providerReads, probes: before.probes });
    assert.equal(store.getAction(action.id, actor).state, "observing"); assert.equal(saved.publication, null);
  }
  const grant = await page.evaluate(async () => { const workspace = await (await fetch("/api/workspace")).json(); return (await fetch("/api/mcp/access", { method: "POST", headers: { "content-type": "application/json", "x-csrf-token": workspace.session.csrfToken }, body: JSON.stringify({ missions: false }) })).json(); });
  client = new Client({ name: "publication-route-regression", version: "1" }); await client.connect(new StreamableHTTPClientTransport(new URL(`${server.origin}/api/mcp`), { requestInit: { headers: { authorization: `Bearer ${grant.accessToken}` } } }));
  const tools = await client.listTools(), workload = tools.tools.find(tool => tool.name === "read_workload"); assert.ok(workload.inputSchema.properties.publicationActionId); assert.equal(workload.annotations.readOnlyHint, true);
  const denied = await client.callTool({ name: "read_workload", arguments: { path: "/", publicationActionId: action.id, checks: publicationRouteChecks } });
  assert.equal(denied.isError, true); assert.equal(JSON.parse(denied.content[0].text).error.code, "LIVE_LIARA_DISABLED");
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  const summary = { output, results, errors, external, modelRequests, providerReads, probes, realModelCalls: 0, cloudWrites: 0, replayReads: 0, mcpSchema: true, liveGateDenied: true };
  await writeFile(join(output, "report.json"), JSON.stringify(summary, null, 2)); console.log(JSON.stringify(summary));
} catch (error) {
  await writeFile(join(output, "failure.json"), JSON.stringify({ error: String(error), modelRequests, providerReads, probes, results }, null, 2));
  await page.screenshot({ path: join(output, "failure.png"), fullPage: true }); throw error;
} finally { await client?.close(); store?.close(); await context.close(); await browser.close(); await server.close(); }
