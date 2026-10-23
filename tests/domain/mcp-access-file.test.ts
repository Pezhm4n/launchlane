import assert from "node:assert/strict";
import { test } from "node:test";
import { parseMcpAccessFile } from "../../src/contracts/mcp-access-file.ts";

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
