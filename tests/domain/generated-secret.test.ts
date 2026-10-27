import assert from "node:assert/strict";
import { test } from "node:test";
import { canGenerateSigningSecret, generateSigningSecret } from "../../src/contracts/generated-secret.ts";

test("only conventional private signing keys offer explicit generation; credentials, encryption and browser keys do not", () => {
  for (const key of ["SESSION_SECRET", "JWT_SECRET", "AUTH_SECRET", "NEXTAUTH_SECRET", "COOKIE_SECRET", "COOKIE_SIGNING_SECRET"])
    assert.equal(canGenerateSigningSecret(key), true);
  for (const key of ["API_KEY", "LIARA_TOKEN", "DATABASE_PASSWORD", "ENCRYPTION_KEY", "SECRET_KEY", "NEXT_PUBLIC_JWT_SECRET", "VITE_AUTH_SECRET", "REACT_APP_AUTH_SECRET", "jwt_secret", "PORT"])
    assert.equal(canGenerateSigningSecret(key), false);
});

test("generation requests exactly 32 bytes from WebCrypto and fails rather than using a weak fallback", t => {
  let requested = 0;
  t.mock.method(globalThis.crypto, "getRandomValues", (bytes: Uint8Array) => { requested += bytes.byteLength;bytes.fill(171);return bytes; });
  assert.equal(generateSigningSecret(), "ab".repeat(32));assert.equal(requested, 32);
  t.mock.restoreAll();
  t.mock.method(globalThis.crypto, "getRandomValues", () => { throw new Error("unavailable"); });
  assert.throws(() => generateSigningSecret(), /unavailable/);
});
