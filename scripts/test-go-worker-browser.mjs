import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { chromium } from "playwright";
import { startTestServer } from "./test-server.mjs";
import { Store } from "../src/server/persistence/store.ts";
import { AgentRepository } from "../src/server/agent/store.ts";
import { readArtifact } from "../src/server/workspace/archive.ts";
import { assertExecutableJob } from "../src/server/policy/executable-artifact.ts";

// Actual upload, mission, authenticated decisions, Go compiler and fresh runtime and selected source archive.
// Only model responses are synthetic. Public pinned module reads are allowed; cloud writes are denied.
const output = resolve(".artifacts/go-worker", new Date().toISOString().replaceAll(":", "-"));
await mkdir(output, { recursive: true });
const receipts = [];
for (const family of ["go"]) {
  const server = await startTestServer({ agentFixture: true, goFixture: true });
  const browser = await chromium.launch({ headless: true }), context = await browser.newContext({ locale: "fa-IR", reducedMotion: "reduce" }), page = await context.newPage();
  const errors = [], external = []; let store, runId, decision, decisionUrl, csrf;
  const fixture = resolve(server.stateDir, "..", family), secret = randomUUID();
  await cp(resolve("tests/fixtures", "go-service"), fixture, { recursive: true });
  if (family === "go") await writeFile(join(fixture, ".env"), `APP_LABEL=${secret}\n`);
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", async request => {
    const url = new URL(request.url()); if (url.origin !== server.origin) external.push(url.origin);
    if (request.method() === "POST" && /^\/api\/agent\/runs\/[a-f0-9-]{36}$/.test(url.pathname)) {
      const body = request.postDataJSON(); if (body.operation === "repair-decision") { decision = body; decisionUrl = url.href; csrf = await request.headerValue("x-csrf-token"); }
    }
  });
  try {
    await page.setViewportSize({ width: 390, height: 844 }); await page.goto(server.origin);
    await page.getByLabel("کلید ورود محلی", { exact: true }).fill(server.token); await page.getByRole("button", { name: "ورود به میز کار", exact: true }).click();
    await page.getByRole("button", { name: "انتخاب پوشه پروژه", exact: true }).click(); const picker = page.getByRole("dialog", { name: "انتخاب پوشه پروژه", exact: true });
    const chooser = page.waitForEvent("filechooser"); await picker.getByRole("button", { name: "انتخاب پوشه از رایانه", exact: true }).click(); await (await chooser).setFiles(fixture);
    await picker.getByRole("button", { name: "بررسی این پروژه", exact: true }).click(); await picker.waitFor({ state: "detached" }); await page.waitForURL(url => !!url.searchParams.get("project"));
    const projectId = new URL(page.url()).searchParams.get("project"), actor = createHash("sha256").update(server.token).digest("hex").slice(0, 24);
    store = new Store(join(server.stateDir, "state.sqlite")); const repo = new AgentRepository(store), original = store.getProjectFlow(actor, projectId);
    assert.equal(original.profile.goRuntime.kind, family); assert.equal(original.selection.kind, "upload");
    assert.equal(store.db.prepare("SELECT count(*) AS n FROM code_repair_jobs").get().n, 0);
    const journey = page.locator(".publication-journey"); await journey.getByText("صفحه و نشانه مورد انتظار", { exact: true }).click();
    await page.locator("#mission-path").fill("/orders"); await page.locator("#mission-expectation").fill("73}");
    await journey.getByRole("button", { name: "بررسی و آماده‌سازی انتشار", exact: true }).click();
    const review = page.locator(".agent-repair"); await review.waitFor(); const proposed = repo.forProject(actor, projectId, "publication"); runId = proposed.id;
    assert.equal(proposed.state, "needs_approval"); assert.equal(proposed.repair.build.version, 11); assert.equal(proposed.repair.build.runtime.kind, family); assert.deepEqual(proposed.repair.containerIds, []);
    console.log(JSON.stringify({ family, stage: "review", sourceHash: original.profile.sourceHash }));
    await journey.getByRole("button", { name: "تأیید ساخت و بررسی برنامه", exact: true }).press("Enter");
    const deadline = Date.now() + 240000; let state;
    while (Date.now() < deadline) {
      const response = await context.request.get(`${server.origin}/api/agent/runs/${runId}`); assert.equal(response.status(), 200);
      state = (await response.json()).run?.state; if (["partially_completed", "failed", "cancelled"].includes(state)) break;
      await page.waitForTimeout(250);
    }
    assert.equal(state, "partially_completed"); const result = repo.get(actor, runId), job = result.repair;
    assert.equal(job.state, "succeeded", JSON.stringify({ error: job.errorCode, message: job.message, receipt: job.afterTest }));
    assert.equal(job.afterTest.passed, true); assert.equal(job.containerIds.length, 2); assert.match(job.afterTest.output, /fresh compiled Go runtime and original workload verified without compiler/);
    assert.equal(result.publication, null); assert.equal(result.effect, "no_remote_changes"); assert.equal(store.db.prepare("SELECT count(*) AS n FROM actions").get().n, 0);
    const selected = store.getProjectFlow(actor, result.projectId); assert.equal(selected.selection.kind, "repair"); assert.equal(selected.artifact.archiveHash, job.artifact.archiveHash);
    assert.equal(assertExecutableJob(store, actor, selected).build.runtime.kind, family);
    const archive = gunzipSync(await readArtifact(server.stateDir, selected.artifact));
    assert.equal(archive.includes(Buffer.from(secret)), false); assert.equal(JSON.stringify(result).includes(secret), false);
    assert.ok(decision && decisionUrl && csrf); const replay = await context.request.post(decisionUrl, { headers: { origin: server.origin, "x-csrf-token": csrf }, data: decision }); assert.equal(replay.status(), 409);
    const calls = (await readFile(server.modelLog, "utf8")).trim().split("\n").length; assert.equal(calls, 2);
    await page.reload(); await review.waitFor(); const reloaded = repo.get(actor, runId);
    assert.deepEqual(reloaded.usage, result.usage); assert.deepEqual(reloaded.repair.containerIds, job.containerIds); assert.equal((await readFile(server.modelLog, "utf8")).trim().split("\n").length, calls);
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    await page.screenshot({ path: join(output, `${family}-receipt.png`), fullPage: true });
    receipts.push({ family, sourceHash: original.profile.sourceHash, artifactHash: job.artifact.archiveHash, image: job.containerImage, model: "synthetic", modelRequests: calls, actualWorkers: 2, cloudWrites: 0, replayStatus: replay.status(), reloadReplayed: false });
    console.log(JSON.stringify(receipts.at(-1)));
  } catch (error) {
    const actor = createHash("sha256").update(server.token).digest("hex").slice(0, 24), flow = store?.getProjectFlow(actor), repo = store ? new AgentRepository(store) : null,
      run = runId ? repo.get(actor, runId) : flow ? repo.forProject(actor, flow.id, "publication") : null;
    await writeFile(join(output, `${family}-failure.json`), JSON.stringify({ error: String(error), state: run?.state, job: run?.repair, events: run?.events }, null, 2));
    await page.screenshot({ path: join(output, `${family}-failure.png`), fullPage: true }); throw error;
  } finally { store?.close(); await context.close(); await browser.close(); await server.close(); }
}
await writeFile(join(output, "results.json"), JSON.stringify({ output, receipts }, null, 2)); console.log(JSON.stringify({ output, receipts }));
