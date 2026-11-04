import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { chromium } from "playwright";
import { startTestServer } from "./test-server.mjs";
import { Store } from "../src/server/persistence/store.ts";
import { AgentRepository } from "../src/server/agent/store.ts";
import { readArtifact } from "../src/server/workspace/archive.ts";
import { sealCredential } from "../src/server/connections/credentials.ts";
import { componentTarget } from "../tests/helpers/component-target.ts";

// Actual upload, mission, authenticated decisions, ASP.NET release build and independently probed runtime.
// --publication adds an isolated Docker destination. Model, Liara and public routing use test transports.
const publish = process.argv.includes("--publication");
const output = resolve(".artifacts/dotnet-docker", new Date().toISOString().replaceAll(":", "-"));
await mkdir(output, { recursive: true });
const receipts = [];
{
  const family = "dotnet";
  const server = await startTestServer(publish ? { componentFixture: true, dotnetPublicationFixture: true } : { agentFixture: true });
  const browser = await chromium.launch({ headless: true }), context = await browser.newContext({ locale: "fa-IR", reducedMotion: "reduce" }), page = await context.newPage();
  const errors = [], external = [], decisions = []; let store, runId, target;
  const actor = createHash("sha256").update(server.token).digest("hex").slice(0, 24);
  const fixture = resolve(server.stateDir, "..", family);
  await cp(resolve("tests/fixtures", "dotnet-orders"), fixture, { recursive: true });
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", async request => {
    const url = new URL(request.url()); if (url.origin !== server.origin) external.push(url.origin);
    if (request.method() === "POST" && /^\/api\/agent\/runs\/[a-f0-9-]{36}$/.test(url.pathname)) {
      const body = request.postDataJSON();
      if (["repair-decision", "publication-decision"].includes(body.operation))
        decisions.push({ body, url: url.href, csrf: await request.headerValue("x-csrf-token") });
    }
  });
  try {
    await page.setViewportSize({ width: 390, height: 844 }); await page.goto(server.origin);
    await page.getByLabel("کلید ورود محلی", { exact: true }).fill(server.token); await page.getByRole("button", { name: "ورود به میز کار", exact: true }).click();
    store = new Store(join(server.stateDir, "state.sqlite"));
    if (publish) {
      store.saveConnection(actor, { source: "token", ciphertext: sealCredential("synthetic-component-provider", server.sessionSecret, actor, "liara"),
        view: { provider: "liara", status: "connected", identityId: "b".repeat(24), displayName: "آزمون مستقل", login: "fixture@example.test",
          teamId: server.teamId, teamName: "آزمون", selectedApp: server.app, apps: [{ id: "c".repeat(24), name: server.app, platform: "docker" }], checkedAt: Date.now() } });
      store.setProbeOrigin(actor, { teamId: server.teamId, app: server.app }, "https://sample-node.liara.run");
      await page.reload();
    }
    await page.getByRole("button", { name: "انتخاب پوشه پروژه", exact: true }).click(); const picker = page.getByRole("dialog", { name: "انتخاب پوشه پروژه", exact: true });
    const chooser = page.waitForEvent("filechooser"); await picker.getByRole("button", { name: "انتخاب پوشه از رایانه", exact: true }).click(); await (await chooser).setFiles(fixture);
    await picker.getByRole("button", { name: "بررسی این پروژه", exact: true }).click(); await picker.waitFor({ state: "detached" }); await page.waitForURL(url => !!url.searchParams.get("project"));
    const projectId = new URL(page.url()).searchParams.get("project");
    const repo = new AgentRepository(store), original = store.getProjectFlow(actor, projectId);
    assert.equal(original.profile.runtime, "docker"); assert.equal(original.selection.kind, "upload");
    assert.equal(store.db.prepare("SELECT count(*) AS n FROM code_repair_jobs").get().n, 0);
    const journey = page.locator(".publication-journey"); await journey.getByText("صفحه و نشانه مورد انتظار", { exact: true }).click();
    await page.locator("#mission-path").fill("/orders/summary"); await page.locator("#mission-expectation").fill("invoice:73");
    await journey.getByRole("button", { name: "بررسی و آماده‌سازی انتشار", exact: true }).click();
    const review = page.locator('[aria-labelledby="repair-title"]'); await review.waitFor(); const proposed = repo.forProject(actor, projectId, "publication"); runId = proposed.id;
    assert.equal(proposed.state, "needs_approval"); assert.equal(proposed.repair.build.version, 6); assert.equal(proposed.repair.build.runtime.kind, "docker"); assert.deepEqual(proposed.repair.containerIds, []);
    await review.getByText("جزئیات اصلاح و رسید آزمون", { exact: true }).press("Enter");
    await review.locator("code").filter({ hasText: "docker build --network=none" }).waitFor();
    assert.ok((await review.textContent()).includes("docker build --network=none -f Dockerfile -; GET /orders/summary"));
    assert.ok(!(await review.textContent()).includes("npm ci"));
    console.log(JSON.stringify({ family, stage: "review", sourceHash: original.profile.sourceHash }));
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await review.getByRole("button", { name: "تأیید ساخت و بررسی برنامه", exact: true }).waitFor();
    }
    const buildDecision = page.waitForResponse(response => response.request().method() === "POST" && response.url() === `${server.origin}/api/agent/runs/${runId}`);
    await journey.getByRole("button", { name: "تأیید ساخت و بررسی برنامه", exact: true }).press("Enter");
    const acceptedBuild = await buildDecision;
    assert.equal(acceptedBuild.status(), 200, await acceptedBuild.text());
    const publication = page.locator('[aria-labelledby="publication-title"]');
    if (publish) {
      await publication.getByRole("heading", { name: "انتشار پروژه", exact: true }).waitFor({ timeout: 240000 });
      const pending = repo.get(actor, runId);
      assert.equal(pending.publication.state, "awaiting_approval"); assert.equal(pending.publication.spec.version, 21);
      assert.equal(pending.publication.spec.artifactHash, pending.repair.artifact.archiveHash);
      target = await componentTarget(await readArtifact(server.stateDir, pending.repair.artifact), 8080, "Dockerfile", "/api/orders");
      await writeFile(join(server.stateDir, "component-target.json"), JSON.stringify({ origin: target.origin, archiveHash: pending.repair.artifact.archiveHash }));
      await publication.getByRole("button", { name: "تأیید و انتشار این نسخه", exact: true }).press("Enter");
      await publication.getByRole("heading", { name: "سایت شما منتشر شد", exact: true }).waitFor({ timeout: 60000 });
      const orders = await browser.newPage();
      try {
        assert.equal((await orders.goto(`${target.origin}/orders/summary`)).status(), 200);
        assert.equal((await orders.locator("body").innerText()).trim(), "invoice:73");
        const response = await orders.goto(`${target.origin}/api/orders`);
        assert.equal(response.status(), 200); assert.deepEqual(await response.json(), { total: 73 });
      } finally { await orders.close(); }
    } else {
      const deadline = Date.now() + 240000;
      while (!["partially_completed", "needs_input", "failed", "cancelled"].includes(repo.get(actor, runId)?.state)) {
        assert.ok(Date.now() < deadline, "the approved local mission did not settle");
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }
    const result = repo.get(actor, runId), job = result.repair;
    assert.equal(result.state, publish ? "completed" : "partially_completed");
    assert.equal(job.state, "succeeded", JSON.stringify({ error: job.errorCode, message: job.message, receipt: job.afterTest }));
    assert.equal(job.afterTest.passed, true); assert.equal(job.containerIds.length, 2); assert.match(job.afterTest.output, /approved workload content and status verified/);
    assert.equal(result.effect, publish ? "remote_changes_verified" : "no_remote_changes");
    if (publish) assert.equal(result.publication.state, "succeeded");
    else { assert.equal(result.publication, null); assert.equal(store.db.prepare("SELECT count(*) AS n FROM actions").get().n, 0); }
    const selected = store.getProjectFlow(actor, result.projectId); assert.equal(selected.selection.kind, "repair"); assert.equal(selected.artifact.archiveHash, job.artifact.archiveHash);
    const archive = gunzipSync(await readArtifact(server.stateDir, selected.artifact));
    assert.ok(archive.includes(Buffer.from("Orders.slnx"))); assert.ok(archive.includes(Buffer.from("NuGet.Config")));
    const approved = [...decisions]; assert.equal(approved.length, publish ? 2 : 1);
    for (const decision of approved) assert.equal((await context.request.post(decision.url, { headers: { origin: server.origin, "x-csrf-token": decision.csrf }, data: decision.body })).status(), 409);
    const history = await readFile(server.modelLog, "utf8"), records = history.trim().split("\n").map(line => JSON.parse(line));
    assert.equal(publish ? records.filter(row => row.model).length : records.length, 2);
    if (publish) {
      assert.equal(records.filter(row => row.provider === "POST").length, 2);
      assert.deepEqual(records.filter(row => row.probe).map(row => row.probe), ["/orders/summary"]);
    }
    await page.reload();
    if (publish) await publication.getByRole("heading", { name: "سایت شما منتشر شد", exact: true }).waitFor();
    else await review.waitFor();
    const reloaded = repo.get(actor, runId);
    assert.deepEqual(reloaded.usage, result.usage); assert.deepEqual(reloaded.repair.containerIds, job.containerIds); assert.equal(await readFile(server.modelLog, "utf8"), history);
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    await page.screenshot({ path: join(output, `${family}-receipt.png`), fullPage: true });
    receipts.push({ family, runId, sourceHash: original.profile.sourceHash, artifactHash: job.artifact.archiveHash, image: job.builtImage, model: "synthetic", modelRequests: 2, actualWorkers: 2, archiveRebuiltAtDestination: publish, cloudWrites: 0, replaysRejected: approved.length, reloadReplayed: false });
    console.log(JSON.stringify(receipts.at(-1)));
  } catch (error) {
    const actor = createHash("sha256").update(server.token).digest("hex").slice(0, 24), flow = store?.getProjectFlow(actor), repo = store ? new AgentRepository(store) : null,
      run = runId ? repo.get(actor, runId) : flow ? repo.forProject(actor, flow.id, "publication") : null;
    await writeFile(join(output, `${family}-failure.json`), JSON.stringify({ error: String(error), state: run?.state, job: run?.repair, events: run?.events }, null, 2));
    await page.screenshot({ path: join(output, `${family}-failure.png`), fullPage: true }); throw error;
  } finally { await target?.close(); store?.close(); await context.close(); await browser.close(); await server.close(); }
}
await writeFile(join(output, "results.json"), JSON.stringify({ output, receipts }, null, 2)); console.log(JSON.stringify({ output, receipts }));
