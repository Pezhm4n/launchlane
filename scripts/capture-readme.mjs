import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseEnv } from "node:util";
import { chromium } from "playwright";
import { startTestServer } from "./test-server.mjs";

// Real built UI, disposable operator state, no model or provider execution.
const assets = resolve("docs/assets/readme");
const setupRoot = await mkdtemp(join(tmpdir(), "launchlane-readme-setup-"));
const server = await startTestServer();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: "fa-IR", reducedMotion: "reduce", viewport: { width: 1280, height: 960 } });
const page = await context.newPage(), errors = [], external = [], writes = [];
page.on("pageerror", error => errors.push(error.message));
await context.route("**/*", route => {
  const request = route.request(), url = new URL(request.url());
  if (url.origin !== server.origin) { external.push(url.origin); return route.abort(); }
  if (!["GET", "HEAD"].includes(request.method())) writes.push(url.pathname);
  // Do not inspect the capture machine's GitHub login or CLI configuration.
  if (url.pathname === "/api/connections/github") return route.fulfill({ json: { connection: null, toolReady: false } });
  return route.continue();
});
try {
  const setupOutput = execFileSync(process.execPath, [resolve("scripts/setup-local.mjs")], { cwd: setupRoot, encoding: "utf8" });
  assert.match(setupOutput, /Local setup complete/);
  const settings = parseEnv(await readFile(join(setupRoot, ".env.local"), "utf8"));
  assert.ok(settings.LAUNCHLANE_OPERATOR_TOKEN.length >= 32);
  assert.ok(settings.LAUNCHLANE_SESSION_SECRET.length >= 32);
  assert.notEqual(settings.LAUNCHLANE_OPERATOR_TOKEN, settings.LAUNCHLANE_SESSION_SECRET);
  assert.ok((await readFile(join(setupRoot, ".local/operator-access.txt"), "utf8")).includes(settings.LAUNCHLANE_OPERATOR_TOKEN));
  assert.equal(setupOutput.includes(settings.LAUNCHLANE_OPERATOR_TOKEN), false);
  await mkdir(assets, { recursive: true });
  await page.goto(server.origin);
  await page.getByLabel("کلید ورود محلی", { exact: true }).fill(server.token);
  await page.getByRole("button", { name: "ورود به میز کار", exact: true }).click();
  await page.getByRole("button", { name: "امتحان با پروژه نمونه", exact: true }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(assets, "publication.png"), fullPage: true });
  await page.getByRole("button", { name: "امتحان با پروژه نمونه", exact: true }).click();
  await page.locator("h1").filter({ hasText: "node-service" }).waitFor();
  await page.locator(".publication-journey").waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(assets, "inspection.png"), fullPage: true });
  await page.getByRole("button", { name: "حساب‌ها", exact: true }).click();
  await page.getByRole("region", { name: "حساب‌ها و دسترسی", exact: true }).waitFor();
  await page.screenshot({ path: join(assets, "accounts.png"), fullPage: true });
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  assert.equal(writes.some(path => path.startsWith("/api/agent/") || path === "/api/projects/lifecycle"), false);
  const files = {};
  for (const name of ["publication.png", "inspection.png", "accounts.png"]) files[name] = createHash("sha256").update(await readFile(join(assets, name))).digest("hex");
  await mkdir(resolve(".local"), { recursive: true });
  const receipt = { source: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), buildId: (await readFile(".next/BUILD_ID", "utf8")).trim(), viewport: { width: 1280, height: 960 }, files, setup: "executed in disposable directory", ui: "actual source inspection and accounts page", githubMetadata: "synthetic disconnected state", modelCalls: 0, providerWrites: 0, errors, external };
  await writeFile(resolve(".local/readme-capture.json"), JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt));
} finally {
  await context.close(); await browser.close(); await server.close();
  assert.ok(resolve(setupRoot).startsWith(join(tmpdir(), "launchlane-readme-setup-")));
  await rm(setupRoot, { recursive: true, force: true });
}
