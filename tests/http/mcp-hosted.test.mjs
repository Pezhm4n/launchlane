import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";
import { startTestServer } from "../../scripts/test-server.mjs";
import { httpsFixture } from "../helpers/https-fixture.mjs";

function run(args, env = {}) {
  return new Promise((done, reject) => {
    const child = spawn(process.execPath, args, { env: { ...process.env, ...env }, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    let stdout = "", stderr = "";
    child.stdout.on("data", bytes => { stdout += bytes; }); child.stderr.on("data", bytes => { stderr += bytes; });
    const timer = setTimeout(() => { child.kill(); reject(Error("MCP subprocess failed to exit within 20 seconds")); }, 20000);
    child.once("error", error => { clearTimeout(timer); reject(error); });
    child.once("close", (code, signal) => { clearTimeout(timer); done({ code, signal, stdout, stderr }); });
    child.stdin.end();
  });
}

test("hosted HTTPS grants, CLI import, bridge lifecycle and browser revocation use the actual application", { timeout: 150000 }, async t => {
  const tls = await httpsFixture();
  let server, browser;
  const clients = [], directory = resolve(".local", `mcp-regression-${randomUUID()}`);
  try {
    server = await startTestServer({ publicOrigin: tls.origin, authFixture: true }); tls.setBackend(server.backendOrigin);
    await mkdir(directory, { recursive: true });
    const web = (path, body, method = body === undefined ? "GET" : "POST", cookie = "", csrf = "") => tls.fetch(tls.origin + path, {
      method, signal: AbortSignal.timeout(15000), headers: { origin: tls.origin, cookie, "x-csrf-token": csrf, ...(body === undefined ? {} : { "content-type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const login = await web("/api/session/liara", { operation: "login", email: "alice@example.test", password: "synthetic-browser-password" }); assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0], csrf = (await (await web("/api/workspace", undefined, "GET", cookie)).json()).session.csrfToken;
    const issue = async () => {
      const response = await web("/api/mcp/access", { missions: false }, "POST", cookie, csrf); assert.equal(response.status, 201);
      return { ...await response.json(), url: `${tls.origin}/api/mcp` };
    };
    const access = await issue(), input = join(directory, "browser download.json");
    await writeFile(input, JSON.stringify(access));
    await t.test("TLS-verified SDK negotiates HTTPS, preserves structured replies and refuses an elevated tool", async () => {
      const client = new Client({ name: "https-regression", version: "1" }); clients.push(client);
      await client.connect(new StreamableHTTPClientTransport(new URL(access.url), { requestInit: { headers: { authorization: `Bearer ${access.accessToken}` } }, fetch: tls.fetch }));
      assert.equal(client.getServerVersion().name, "launchlane");
      assert.ok(!(await client.listTools()).tools.some(tool => tool.name === "launchlane_publish"));
      const result = await client.callTool({ name: "launchlane_context", arguments: {} });
      assert.deepEqual(result.structuredContent, JSON.parse(result.content[0].text));
      assert.equal(result.structuredContent.data.missionsAllowed, false);
      assert.equal((await client.callTool({ name: "launchlane_publish", arguments: {} })).isError, true);
    });
    await t.test("three CLI imports exit naturally and generate secret-free host snippets without overwriting files", async () => {
      for (let i = 0; i < 3; i++) {
        const output = join(directory, `import ${i}.json`), args = [resolve("scripts/setup-mcp.mjs"), "--from-file", input, "--origin", tls.origin, "--output", output];
        const result = await run(args, { NODE_EXTRA_CA_CERTS: tls.certPath });
        assert.equal(result.code, 0, result.stderr); assert.equal(result.signal, null);
        assert.ok(!`${result.stdout}${result.stderr}`.includes(access.accessToken));
        assert.ok(!result.stderr.includes("UV_HANDLE_CLOSING"));
        assert.deepEqual(JSON.parse(await readFile(output, "utf8")), access);
        for (const suffix of ["codex.toml", "claude.json", "opencode.json"]) {
          const snippet = await readFile(`${output}.${suffix}`, "utf8");
          assert.ok(snippet.includes(tls.origin)); assert.ok(!snippet.includes(access.accessToken));
        }
        assert.equal((await run(args, { NODE_EXTRA_CA_CERTS: tls.certPath })).code, 1);
        assert.deepEqual(JSON.parse(await readFile(output, "utf8")), access);
      }
      assert.equal((await run([resolve("scripts/setup-mcp.mjs"), "--from-file", input, "--origin", "https://wrong.example", "--output", join(directory, "wrong.json")])).code, 1);
      assert.equal((await run([resolve("scripts/setup-mcp.mjs"), "--missions", "--from-file", input, "--origin", tls.origin, "--output", join(directory, "elevated.json")])).code, 1);
      assert.equal((await run([resolve("scripts/setup-mcp.mjs"), "--from-file", input, "--origin", tls.origin, "--output", join(directory, "untrusted-certificate.json")], { NODE_EXTRA_CA_CERTS: "" })).code, 1);
    });
    await t.test("HTTPS stdio requires the pinned origin, closes cleanly on EOF and sanitizes revoked access", async () => {
      const base = { LAUNCHLANE_MCP_ACCESS_FILE: input, NODE_EXTRA_CA_CERTS: tls.certPath };
      assert.equal((await run([resolve("scripts/mcp-stdio.mjs")], { ...base, LAUNCHLANE_MCP_ORIGIN: "" })).code, 1);
      const eof = await run([resolve("scripts/mcp-stdio.mjs")], { ...base, LAUNCHLANE_MCP_ORIGIN: tls.origin });
      assert.equal(eof.code, 0, eof.stderr); assert.equal(eof.stdout, "");
      const expired = join(directory, "expired.json");
      await writeFile(expired, JSON.stringify({ ...access, expiresAt: Date.now() - 1 }));
      const refused = await run([resolve("scripts/mcp-stdio.mjs")], { ...base, LAUNCHLANE_MCP_ACCESS_FILE: expired, LAUNCHLANE_MCP_ORIGIN: tls.origin });
      assert.equal(refused.code, 1); assert.ok(!refused.stderr.includes(access.accessToken));
      const client = new Client({ name: "https-stdio-regression", version: "1" }); clients.push(client);
      const transport = new StdioClientTransport({ command: process.execPath, args: [resolve("scripts/mcp-stdio.mjs")], env: { ...base, LAUNCHLANE_MCP_ORIGIN: tls.origin }, stderr: "pipe" });
      let errors = ""; transport.stderr?.on("data", bytes => { errors += bytes; });
      await client.connect(transport);
      assert.equal((await client.callTool({ name: "launchlane_context", arguments: {} })).structuredContent.data.missionsAllowed, false);
      assert.equal((await web("/api/mcp/access", { id: access.id }, "DELETE", cookie, csrf)).status, 200);
      assert.equal((await web("/api/mcp/access", { id: access.id }, "DELETE", cookie, csrf)).status, 404);
      assert.equal((await web("/api/workspace", undefined, "GET", cookie)).status, 200);
      const denied = await client.callTool({ name: "launchlane_context", arguments: {} });
      assert.equal(denied.isError, true); assert.equal(JSON.parse(denied.content[0].text).error.code, "AUTH_REQUIRED");
      await client.close(); assert.ok(!errors.includes(access.accessToken));
    });
    await t.test("real Chromium on HTTPS issues, downloads and revokes a grant without exposing it in DOM or browser storage", async () => {
      browser = await chromium.launch({ headless: true, args: [`--ignore-certificate-errors-spki-list=${tls.fingerprint}`] });
      const context = await browser.newContext({ locale: "fa-IR", reducedMotion: "reduce", acceptDownloads: true });
      const separator = cookie.indexOf("=");
      await context.addCookies([{ name: cookie.slice(0, separator), value: cookie.slice(separator + 1), url: tls.origin, secure: true, httpOnly: true, sameSite: "Strict" }]);
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await context.route("**/*", route => new URL(route.request().url()).origin === tls.origin ? route.continue() : route.abort());
      await page.goto(`${tls.origin}/?view=publish`);
      await page.getByRole("button", { name: "فضای آلیس", exact: true }).click();
      await page.getByRole("heading", { name: "کجا منتشر می‌کنید؟", exact: true }).waitFor({ state: "detached" });
      await page.getByRole("button", { name: "حساب‌ها", exact: true }).click();
      await page.getByRole("button", { name: "اتصال MCP", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "اتصال MCP", exact: true });
      await dialog.getByRole("checkbox").uncheck();
      await dialog.getByRole("button", { name: "ساخت دسترسی همین حساب", exact: true }).click();
      const download = page.waitForEvent("download"); await dialog.getByRole("button", { name: "دانلود فایل دسترسی MCP", exact: true }).click();
      const downloaded = JSON.parse(await readFile(await (await download).path(), "utf8"));
      assert.equal(downloaded.url, `${tls.origin}/api/mcp`); assert.equal(downloaded.missions, false);
      assert.ok(!(await page.content()).includes(downloaded.accessToken));
      assert.ok(!(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).includes(downloaded.accessToken));
      const screenshots = resolve(".artifacts/mcp-20261025"); await mkdir(screenshots, { recursive: true });
      for (const width of [320, 1280]) {
        await page.setViewportSize({ width, height: 900 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        const accessibility = await new AxeBuilder({ page }).include("dialog[aria-labelledby=mcp-connect-title]").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
        assert.deepEqual(accessibility.violations.map(violation => ({ id: violation.id, targets: violation.nodes.map(node => node.target) })), []);
        await page.screenshot({ path: join(screenshots, `mcp-${width}.png`) });
      }
      await dialog.getByRole("button", { name: "لغو همین دسترسی MCP", exact: true }).click();
      await dialog.getByRole("button", { name: "ساخت دسترسی همین حساب", exact: true }).waitFor();
      const revoked = await tls.fetch(downloaded.url, { method: "POST", headers: { authorization: `Bearer ${downloaded.accessToken}`, "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) });
      assert.equal(revoked.status, 401);
      await dialog.getByRole("button", { name: "ساخت دسترسی همین حساب", exact: true }).click();
      const secondDownload = page.waitForEvent("download"); await dialog.getByRole("button", { name: "دانلود فایل دسترسی MCP", exact: true }).click();
      const stale = JSON.parse(await readFile(await (await secondDownload).path(), "utf8"));
      assert.equal((await web("/api/mcp/access", { id: stale.id }, "DELETE", cookie, csrf)).status, 200);
      await dialog.getByRole("button", { name: "لغو همین دسترسی MCP", exact: true }).click();
      await dialog.getByRole("button", { name: "ساخت دسترسی همین حساب", exact: true }).waitFor();
      assert.equal(await dialog.getByRole("alert").count(), 0);
      await page.keyboard.press("Escape"); await dialog.waitFor({ state: "detached" });
      await page.waitForFunction(() => document.activeElement?.textContent === "اتصال MCP");
      assert.deepEqual(errors, []); await context.close();
    });
    await t.test("an HTTP redirect never forwards the access token to the redirect destination", async () => {
      const fresh = await issue(), path = join(directory, "redirect.json");
      await writeFile(path, JSON.stringify(fresh));
      let sourceRequests = 0, destinationRequests = 0;
      const redirect = createServer((request, response) => {
        if (request.url === "/trap") { destinationRequests++; response.writeHead(500).end(); }
        else { sourceRequests++; response.writeHead(302, { location: `${tls.origin}/trap` }).end(); }
      });
      await new Promise(done => redirect.listen(0, "127.0.0.1", done));
      tls.setBackend(`http://127.0.0.1:${redirect.address().port}`);
      try {
        const result = await run([resolve("scripts/setup-mcp.mjs"), "--from-file", path, "--origin", tls.origin, "--output", join(directory, "redirect-output.json")], { NODE_EXTRA_CA_CERTS: tls.certPath });
        assert.equal(result.code, 1); assert.ok(sourceRequests > 0); assert.equal(destinationRequests, 0);
        assert.ok(!`${result.stdout}${result.stderr}`.includes(fresh.accessToken));
      } finally {
        tls.setBackend(server.backendOrigin); redirect.closeAllConnections(); await new Promise(done => redirect.close(done));
      }
    });
  } finally {
    await browser?.close(); await Promise.allSettled(clients.map(client => client.close()));
    await tls.close(); await server?.close();
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
