import assert from "node:assert/strict";
import { test } from "node:test";
import { mcpOrigin, parseMcpAccessFile } from "../../src/contracts/mcp-access-file.ts";
import { mcpClientConfigurations } from "../../scripts/mcp-client-config.ts";
import { resolve } from "node:path";

const now = 1_800_000_000_000, origin = "http://127.0.0.1:3000";
const sample = () => ({ url: `${origin}/api/mcp`, accessToken: "samplepayload.samplesignature", id: "sample-session-identifier", expiresAt: now + 3_600_000, missions: true });
test("browser-issued access preserves read/mission scope and expiry for the exact local origin", () => {
  assert.deepEqual(parseMcpAccessFile(sample(), origin, now), sample());
  assert.equal(parseMcpAccessFile({ ...sample(), missions: false }, origin, now).missions, false);
});
test("an imported grant cannot redirect credentials or change the configured app", () => {
  for (const url of ["https://untrusted.test/api/mcp", "http://127.0.0.1:4000/api/mcp", `${origin}/api/mcp?next=x`, `${origin}/api/mcp#x`, `${origin}/api/session`, "http://user:pass@127.0.0.1:3000/api/mcp", "file:///api/mcp"]) {
    assert.throws(() => parseMcpAccessFile({ ...sample(), url }, origin, now));
  }
});
test("expired, oversized, ambiguous and malformed access files fail closed", () => {
  for (const change of [{ expiresAt: now }, { expiresAt: now + 3_600_001 }, { accessToken: "x".repeat(2049) }, { accessToken: "invalid" }, { missions: "true" }, { id: "bad" }, { cookie: "not-accepted" }]) {
    assert.throws(() => parseMcpAccessFile({ ...sample(), ...change }, origin, now));
  }
  for (const value of [null, [], {}, "invalid"]) assert.throws(() => parseMcpAccessFile(value, origin, now));
});

test("hosted grants bind to the explicit HTTPS origin and reject downgrade, redirects and a different installation", () => {
  const hosted = "https://launchlane-live-1023.liara.run", grant = { ...sample(), url: `${hosted}/api/mcp` };
  assert.deepEqual(parseMcpAccessFile(grant, hosted, now), grant);
  for (const url of ["http://launchlane-live-1023.liara.run/api/mcp", "https://another.liara.run/api/mcp", `${hosted}/api/mcp?redirect=x`, `${hosted}/api/mcp#x`, "https://user:pass@launchlane-live-1023.liara.run/api/mcp"])
    assert.throws(() => parseMcpAccessFile({ ...grant, url }, hosted, now));
  for (const value of ["http://private.internal", "file:///tmp/mcp", `${hosted}/`, `${hosted}/other`, `${hosted}?x=y`, "https://user:pass@launchlane-live-1023.liara.run"])
    assert.throws(() => mcpOrigin(value));
});

test("host snippets pin the origin and local executable paths without embedding a credential", () => {
  const path = resolve(".local/mcp access with spaces.json"), bridge = resolve("scripts/mcp-stdio.mjs"), origin = "https://launchlane-live-1023.liara.run";
  const configurations = mcpClientConfigurations(path, origin, process.execPath, bridge);
  const claude = JSON.parse(configurations.claude).mcpServers.launchlane, opencode = JSON.parse(configurations.opencode).mcp.launchlane;
  assert.deepEqual(claude.args, [bridge]); assert.equal(claude.env.LAUNCHLANE_MCP_ACCESS_FILE, path);
  assert.equal(opencode.environment.LAUNCHLANE_MCP_ORIGIN, origin); assert.deepEqual(opencode.command, [process.execPath, bridge]);
  assert.ok(configurations.codex.includes(JSON.stringify(path))); assert.ok(configurations.codex.includes(JSON.stringify(origin)));
  for (const configuration of Object.values(configurations)) assert.ok(!configuration.includes(sample().accessToken));
  assert.throws(() => mcpClientConfigurations("relative.json", origin));
});
