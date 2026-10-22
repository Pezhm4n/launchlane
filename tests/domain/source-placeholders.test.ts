import assert from "node:assert/strict";
import { test } from "node:test";
import { containsSourceCredential, redact } from "../../src/server/policy/redaction.ts";

test("documented YOUR credential templates do not prevent source selection", () => {
  for (const value of ["YOUR_API_KEY", "YOUR_VALID_KEY", "YOUR_ACCESS_TOKEN", "YOUR_PASSWORD", "YOUR_SESSION_SECRET"]) {
    for (const quote of ["", '"', "'"]) {
      assert.equal(containsSourceCredential(`BOXAPI_API_KEY=${quote}${value}${quote}`), false);
    }
  }
});

test("a template exception cannot hide an installed secret or a credential with a template prefix", () => {
  assert.equal(containsSourceCredential("apiKey=YOUR_API_KEY", ["YOUR_API_KEY"]), true);
  for (const value of ["YOUR_API_KEY_realCredential123", "YOUR_KEY123", "your_api_key", "YOUR_KEY-extra", "real-value-123", "YOUR_ARBITRARY_VALUE"]) {
    assert.equal(containsSourceCredential(`apiKey=${value}`), true, value);
  }
  assert.equal(containsSourceCredential("Authorization: Bearer YOUR_ACCESS_TOKEN"), true);
  assert.equal(containsSourceCredential("https://user:YOUR_PASSWORD@example.com"), true);
});

test("log redaction remains conservative even for setup-template strings", () => {
  assert.equal(redact('apiKey="YOUR_API_KEY"'), 'apiKey="[REDACTED]"');
  assert.equal(redact("token=YOUR_ACCESS_TOKEN"), "token=[REDACTED]");
});
