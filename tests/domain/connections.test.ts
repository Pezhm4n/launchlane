import assert from "node:assert/strict";
import { test } from "node:test";
import type { ConnectionView } from "../../src/contracts/connections.ts";
import { openCredential, sealCredential } from "../../src/server/connections/credentials.ts";
import { AppError } from "../../src/server/errors.ts";
import { Store } from "../../src/server/persistence/store.ts";

const secret = "test-only-root-".repeat(4),
  token = "test-only-private-credential";
const view: ConnectionView = {
  provider: "liara",
  status: "connected",
  identityId: "user-1",
  displayName: "کاربر آزمایشی",
  login: "synthetic@example.test",
  checkedAt: Date.now(),
  teamId: "a".repeat(24),
  teamName: "تیم آزمایشی",
  apps: [],
  selectedApp: null,
};
const code = (expected: string) => (error: unknown) =>
  error instanceof AppError && error.code === expected;

test("credential encryption authenticates actor/provider and rejects tamper or a different installation key", () => {
  const sealed = sealCredential(token, secret, "alice", "liara");
  assert.ok(!sealed.includes(token));
  assert.equal(openCredential(sealed, secret, "alice", "liara"), token);
  assert.notEqual(sealCredential(token, secret, "alice", "liara"), sealed);
  for (const [actor, provider, key] of [
    ["bob", "liara", secret],
    ["alice", "github", secret],
    ["alice", "liara", "other-root-".repeat(5)],
  ] as const)
    assert.throws(
      () => openCredential(sealed, key, actor, provider),
      code("CREDENTIAL_STORAGE_INVALID"),
    );
  const parts = sealed.split(".");
  parts[3] = Buffer.from("tampered").toString("base64url");
  assert.throws(
    () => openCredential(parts.join("."), secret, "alice", "liara"),
    code("CREDENTIAL_STORAGE_INVALID"),
  );
  assert.throws(
    () => sealCredential(token, "weak", "alice", "liara"),
    code("CREDENTIAL_STORAGE_UNAVAILABLE"),
  );
});

test("connection persistence is actor-bound, excludes plaintext and disconnect does not imply provider revocation", () => {
  const store = new Store(":memory:");
  try {
    const ciphertext = sealCredential(token, secret, "alice", "liara");
    store.saveConnection("alice", { view, ciphertext, source: "token" });
    assert.equal(store.getConnection("bob", "liara"), null);
    assert.deepEqual(store.getConnection("alice", "liara")?.view, view);
    assert.ok(
      !JSON.stringify(store.db.prepare("SELECT * FROM account_connections").all()).includes(token),
    );
    assert.throws(
      () => store.saveConnection("alice", { view, ciphertext: token, source: "token" }),
      code("CONNECTION_INVALID"),
    );
    store.disconnectConnection("alice", "liara");
    assert.equal(store.getConnection("alice", "liara"), null);
  } finally {
    store.close();
  }
});
