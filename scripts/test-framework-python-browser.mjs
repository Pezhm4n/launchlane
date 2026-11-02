import { pythonBuildImage } from "../src/contracts/project-build.ts";
import { parseActionSpec } from "../src/server/policy/action.ts";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { startTestServer } from "./test-server.mjs";
import { Store } from "../src/server/persistence/store.ts";
import { AgentRepository } from "../src/server/agent/store.ts";
import { currentAgentContext } from "../src/server/agent/tools.ts";
import { readConfig } from "../src/server/config.ts";
import { fingerprint } from "../src/server/policy/action.ts";

const baseline = false, server = await startTestServer({ agentFixture: true });
const browser = await chromium.launch({ headless: true }), context = await browser.newContext({ locale: "fa-IR", reducedMotion: "reduce" }), page = await context.newPage();
const output = resolve(".artifacts/framework-review", `${baseline ? "before" : "after"}-${new Date().toISOString().replaceAll(":", "-")}`);
await mkdir(output, { recursive: true }); const errors = [], layouts = [], decisions = []; let store, runId, job, publication, mode = "proposed", family = "flask";
page.on("pageerror", error => errors.push(error.message));
function view(run) {
  const succeeded = mode === "succeeded", failed = mode === "failed";
  if (mode === "publication" || mode === "publication-rejected") return { ...run, state: mode === "publication" ? "needs_approval" : "partially_completed", nextAction: null, repair: null, publication: { ...publication, state: mode === "publication" ? "awaiting_approval" : "cancelled" } };
  return { ...run, state: mode === "proposed" ? "needs_approval" : "partially_completed", nextAction: null, repair: { ...job, state: mode,
    message: succeeded ? "runner اصلی و پاسخ WSGI بررسی شدند؛ داده و انتشار تأیید نشده‌اند." : failed ? "runner اصلی framework شکست خورد؛ source حفظ شد." : "در انتظار تصمیم",
    afterTest: succeeded || failed ? { command: "python3 -m unittest discover; python3 -m gunicorn web:app --bind 0.0.0.0:8000", exitCode: failed ? 76 : 0, signal: null, durationMs: 1000,
      output: failed ? "original framework tests failed" : "original framework tests and WSGI checked; data and publication unverified", passed: succeeded } : null } };
}
await context.route("**/*", async route => {
  const request = route.request(), url = new URL(request.url()); if (url.origin !== server.origin) return route.abort();
  if (!runId || !url.pathname.startsWith("/api/agent/")) return route.continue();
  if (request.method() === "POST" && url.pathname === `/api/agent/runs/${runId}`) {
    const body = request.postDataJSON(); if (body.operation === "publication-decision") { assert.equal(body.decision,"reject"); decisions.push(family+":publication-reject"); mode="publication-rejected"; const response=await context.request.get(`${server.origin}/api/agent/runs/${runId}`),payload=await response.json(); return route.fulfill({status:200,json:{...payload,run:view(payload.run)}}); } assert.equal(body.operation, "repair-decision"); assert.equal(body.jobId, job.id); decisions.push(body.decision);
    mode = body.decision === "reject" ? "cancelled" : "queued";
    const response = await context.request.get(`${server.origin}/api/agent/runs/${runId}`), payload = await response.json();
    return route.fulfill({ status: 200, json: { ...payload, run: view(payload.run) } });
  }
  const response = await route.fetch(); if (response.headers()["content-type"]?.includes("application/json")) { const payload = await response.json(); if (payload.run?.id === runId) return route.fulfill({ response, json: { ...payload, run: view(payload.run) } }); }
  return route.fulfill({ response });
});
try {
  await page.goto(server.origin); await page.getByLabel("کلید ورود محلی", { exact: true }).fill(server.token); await page.getByRole("button", { name: "ورود به میز کار", exact: true }).click();
  await page.getByRole("button", { name: "امتحان با پروژه نمونه", exact: true }).click(); await page.locator("h1").filter({ hasText: "node-service" }).waitFor();
  store = new Store(join(server.stateDir, "state.sqlite")); const actor = createHash("sha256").update(server.token).digest("hex").slice(0, 24), config = readConfig({ LAUNCHLANE_STATE_DIR: server.stateDir, LAUNCHLANE_WORKSPACE_ROOT: server.workspace, LAUNCHLANE_OPERATOR_TOKEN: server.token, LAUNCHLANE_SESSION_SECRET: server.sessionSecret });
  const flow = store.getProjectFlow(actor), selected = currentAgentContext(config, store, actor), input = { projectId: flow.id, sourceHash: flow.profile.sourceHash, path: "/", expectedText: "invoice service" }, repo = new AgentRepository(store),
    run = repo.create(actor, randomUUID(), selected, "بررسی runner اصلی و WSGI", { maxModelCalls: 10, maxToolCalls: 40, runTimeoutMs: 120000 }, { ...input, kind: "publication", identity: fingerprint({ input, context: selected }) }).run;
  runId = run.id; run.state = "needs_approval"; run.nextAction = null; repo.save(actor, run);
  const now=Date.now(), runtime={kind:family,version:"3.12",module:"web:app",port:8000,command:["python3","-m","gunicorn","web:app","--bind","0.0.0.0:8000"]};
  job={id:randomUUID(),parentRunId:runId,projectId:flow.id,baseRevision:flow.profile.sourceHash,state:"proposed",goal:"اجرای runner اصلی Flask",allowedPaths:[],testFiles:[],changedPaths:[],diff:null,beforeTest:null,afterTest:null,artifact:null,errorCode:null,message:"در انتظار تصمیم",createdAt:now,updatedAt:now,validationOnly:true,execution:"container",containerIds:[],build:{version:10,nodeVersion:null,image:pythonBuildImage,runtime,buildCommand:null,testCommand:"python3 -m unittest discover",startCommand:runtime.command.join(" "),port:8000,environment:null,workload:{path:"/orders",status:200,assertion:{kind:"json",field:"total",equals:73}}}};
  await page.reload(); const review = page.locator(".agent-repair"); await review.waitFor(); await review.getByText("جزئیات اصلاح و رسید آزمون", { exact: true }).click();
  for (const width of baseline ? [360, 1280] : [280, 320, 360, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 }); await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze(); assert.deepEqual(axe.violations.map(row => row.id), []); layouts.push({ width, overflow: false, axeViolations: 0 });
    if ([360, 1280].includes(width)) await page.screenshot({ path: join(output, `${width}.png`), fullPage: true });
  }
  if (!baseline) {
    assert.match(await review.textContent() ?? "", /python3 -m unittest discover/); assert.doesNotMatch(await review.textContent() ?? "", /npm ci/);
    await page.getByRole("button", { name: "تأیید ساخت و بررسی برنامه", exact: true }).press("Enter"); assert.equal(decisions[0], "approve");
    mode = "proposed"; await page.reload(); await page.getByRole("button", { name: "رد آماده‌سازی", exact: true }).press("Enter"); assert.equal(decisions[1], "reject");
    for (const state of ["succeeded", "failed"]) { mode = state; await page.reload(); await page.locator(".agent-repair").waitFor(); assert.equal(await page.getByText("سایت شما منتشر شد", { exact: true }).count(), 0); }
    await page.setViewportSize({ width: 320, height: 900 }); await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
  await page.evaluate(()=>document.documentElement.style.fontSize="");
  for(family of ["flask","django"]){
    const runtime={kind:family,version:"3.12",module:family==="flask"?"web:app":"siteconfig.wsgi:application",port:8000};runtime.command=["python3","-m","gunicorn",runtime.module,"--bind","0.0.0.0:8000"];
    const spec=parseActionSpec({version:41,operation:"deploy",scope:{teamId:"a".repeat(24),app:"framework-review"},sourceHash:flow.profile.sourceHash,artifactHash:"b".repeat(64),projectFlowId:flow.id,selectionHash:flow.selectionHash,accountId:"c".repeat(24),targetAppId:"d".repeat(24),nodeVersion:null,runtime,environment:null,args:{port:8000,planId:"starter"},workload:{origin:"https://framework-review.example.com",path:"/orders",status:200,assertion:{kind:"json",field:"total",equals:73}}});
    publication={id:randomUUID(),actorId:actor,spec,hash:fingerprint(spec),state:"awaiting_approval",expiresAt:Date.now()+60000,createdAt:Date.now(),attemptId:null,remoteId:null,errorCode:null};mode="publication";
    await page.reload(); const card=page.locator('[aria-labelledby="publication-title"]');await card.waitFor();
    const review=card.locator("details.publication-review");
    if(!await review.evaluate(element=>element.open))await review.locator(":scope > summary").click();
    await review.locator("details > summary").click();assert.match(await card.textContent(),new RegExp(family+" / Python"));
    for(const width of [280,390,1280]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);const axe=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze();assert.deepEqual(axe.violations.map(row=>row.id),[]);layouts.push({family,width,publication:true});}
    const reject=card.getByRole("button",{name:"رد انتشار",exact:true});
    await reject.press("Enter");await reject.waitFor({state:"hidden"});assert.ok(decisions.includes(family+":publication-reject"));
  }
  assert.deepEqual(errors, []); assert.equal(store.db.prepare("SELECT count(*) AS n FROM code_repair_jobs").get().n, 0);
  await writeFile(join(output, "results.json"), JSON.stringify({ baseline, layouts, decisions, errors, modelCalls: 0, cloudWrites: 0, decisionTransport: "synthetic", worker: "not_executed" }, null, 2)); console.log(JSON.stringify({ output, layouts, decisions, errors }));
} finally { await context.unrouteAll({behavior:"wait"});store?.close(); await context.close(); await browser.close(); await server.close(); }
