import assert from "node:assert/strict";
import { mock, test } from "node:test";
import type { ConnectionView } from "../../src/contracts/connections.ts";
import { parseDomainGuide, type DomainTarget } from "../../src/contracts/domain-guide.ts";
import {
  createDomainGuide,
  normalizeDomainHostname,
} from "../../src/server/application/domain-guide.ts";
import { readConfig } from "../../src/server/config.ts";
import { sealCredential } from "../../src/server/connections/credentials.ts";
import { AppError } from "../../src/server/errors.ts";
import { Store } from "../../src/server/persistence/store.ts";

const config = readConfig({
  LIARA_TEAM_ID: "a".repeat(24),
  LAUNCHLANE_APP_ALLOWLIST: "node-app",
  LAUNCHLANE_SESSION_SECRET: "domain-guide-test-only-".repeat(3),
  LIARA_API_TOKEN: "synthetic-private-liara-key",
  MODEL_API_KEY: "synthetic-private-model-key",
});
const view: ConnectionView = {
  provider: "liara",
  status: "connected",
  identityId: "private-account-id",
  displayName: "حساب آزمایشی",
  login: "synthetic@example.test",
  checkedAt: 100,
  teamId: config.teamId,
  teamName: "تیم آزمایشی",
  apps: [{ id: "internal-app", name: "node-app", platform: "node" }],
  selectedApp: "node-app",
};
const target: DomainTarget = { teamId: config.teamId, appId: "internal-app", app: "node-app" };
const request = (expectedTarget: DomainTarget | null = target) => ({
  hostname: "site.example.ir",
  dns: "existing",
  target: expectedTarget,
});
const code = (expected: string) => (error: unknown) =>
  error instanceof AppError && error.code === expected;
function save(store: Store, connection = view) {
  store.saveConnection("alice", {
    view: connection,
    source: "token",
    ciphertext: sealCredential(
      "sealed-test-only-credential",
      config.sessionSecret,
      "alice",
      "liara",
    ),
  });
}

test("domain names normalize case, final dot and international names without treating a URL or IP as a hostname", () => {
  assert.equal(normalizeDomainHostname("  Shop.Example.IR.  "), "shop.example.ir");
  assert.equal(normalizeDomainHostname("مثال.ir"), "xn--mgbh0fb.ir");
  assert.equal(
    normalizeDomainHostname(`${"a".repeat(63)}.example.com`),
    `${"a".repeat(63)}.example.com`,
  );
  for (const invalid of [
    "",
    "https://example.ir",
    "example.ir/path",
    "example.ir:443",
    "user@example.ir",
    "example.ir?token=private",
    "*.example.ir",
    "example..ir",
    "-example.ir",
    "example-.ir",
    `${"a".repeat(64)}.ir`,
    "127.0.0.1",
    "127.1",
    "0x7f000001",
    "[::1]",
    "localhost",
    "site.local",
    "site.internal",
    "site.test",
    "example.ir\u202e",
    "exa\u200bmple.ir",
    "example.ir\n",
    "example%2eir",
    "a".repeat(513),
  ]) {
    assert.throws(() => normalizeDomainHostname(invalid), code("DOMAIN_NAME_INVALID"), invalid);
  }
});

test("documented unsupported suffixes produce an actionable error without claiming ownership or availability", () => {
  for (const suffix of ["gq", "cf", "ga", "ml", "tk"])
    assert.throws(() => normalizeDomainHostname(`site.${suffix}`), code("DOMAIN_TLD_UNSUPPORTED"));
  assert.equal(normalizeDomainHostname("long-name.photography"), "long-name.photography");
});

test("a scoped guide uses saved account identity with all gates off, no upstream calls, no credential export and no authorization writes", () => {
  const store = new Store(":memory:"),
    transport = mock.method(globalThis, "fetch", () => {
      throw new Error("The guide must not contact an upstream service");
    });
  try {
    save(store);
    const before = JSON.stringify(store.db.prepare("SELECT * FROM account_connections").all());
    const guide = createDomainGuide(config, store, "alice", request(), 1000);
    assert.deepEqual(guide.target, {
      ...target,
      teamName: view.teamName,
      connectionCheckedAt: 100,
    });
    assert.equal(guide.connection, "selected");
    assert.equal(guide.verification, "not_checked");
    assert.equal(guide.preparedAt, 1000);
    assert.equal(guide.dns, "existing");
    assert.equal(transport.mock.callCount(), 0);
    assert.equal(
      JSON.stringify(store.db.prepare("SELECT * FROM account_connections").all()),
      before,
    );
    assert.equal(store.getProbeOrigin("alice", config.teamId, "node-app"), null);
    assert.deepEqual(store.listActions("alice"), []);
    const serialized = JSON.stringify(guide);
    for (const secret of [
      config.liaraToken,
      config.modelKey,
      config.sessionSecret,
      view.identityId,
      view.login,
      "sealed-test-only-credential",
      "node-app.liara.run",
    ])
      assert.ok(!serialized.includes(secret));
    assert.ok(!("records" in guide) && !("nameservers" in guide));
    assert.deepEqual(parseDomainGuide(guide), guide);
  } finally {
    transport.mock.restore();
    store.close();
  }
});

test("no connection, missing app and expired connection each give an honest general guide; another actor never receives the selected target", () => {
  const store = new Store(":memory:");
  try {
    assert.equal(
      createDomainGuide(config, store, "alice", request(null)).connection,
      "not_connected",
    );
    save(store, { ...view, selectedApp: null });
    assert.equal(
      createDomainGuide(config, store, "alice", request(null)).connection,
      "app_required",
    );
    save(store, { ...view, status: "reauth_required" });
    assert.equal(
      createDomainGuide(config, store, "alice", request(null)).connection,
      "reauth_required",
    );
    save(store);
    const otherActor = createDomainGuide(config, store, "bob", { ...request(null), dns: "liara" });
    assert.equal(otherActor.target, null);
    assert.equal(otherActor.connection, "not_connected");
    assert.equal(otherActor.dns, "liara");
  } finally {
    store.close();
  }
});

test("selection races, replaced app identity and disconnect never silently relabel a guide for another target", () => {
  const store = new Store(":memory:");
  try {
    save(store);
    assert.throws(
      () => createDomainGuide(config, store, "alice", request(null)),
      code("DOMAIN_TARGET_CHANGED"),
    );
    assert.throws(
      () => createDomainGuide(config, store, "alice", request({ ...target, app: "another-app" })),
      code("DOMAIN_TARGET_CHANGED"),
    );
    save(store, { ...view, apps: [{ id: "replaced-id", name: target.app, platform: "node" }] });
    assert.throws(
      () => createDomainGuide(config, store, "alice", request()),
      code("DOMAIN_TARGET_CHANGED"),
    );
    store.disconnectConnection("alice", "liara");
    assert.throws(
      () => createDomainGuide(config, store, "alice", request()),
      code("DOMAIN_TARGET_CHANGED"),
    );
  } finally {
    store.close();
  }
});

test("a different team or app outside the current allowlist fails closed rather than offering a misleading target", () => {
  const store = new Store(":memory:");
  try {
    save(store, { ...view, teamId: "b".repeat(24) });
    assert.throws(
      () => createDomainGuide(config, store, "alice", request()),
      code("LIARA_TEAM_MISMATCH"),
    );
    save(store, {
      ...view,
      selectedApp: "outside",
      apps: [{ id: "outside-id", name: "outside", platform: "node" }],
    });
    assert.throws(
      () => createDomainGuide(config, store, "alice", request(null)),
      code("LIARA_APP_REQUIRED"),
    );
    save(store, { ...view, apps: [] });
    assert.throws(
      () => createDomainGuide(config, store, "alice", request()),
      code("LIARA_APP_REQUIRED"),
    );
  } finally {
    store.close();
  }
});

test("unknown fields and invented successful verification cannot cross the domain guide protocol", () => {
  const store = new Store(":memory:");
  try {
    const guide = createDomainGuide(config, store, "alice", request(null));
    assert.throws(
      () => createDomainGuide(config, store, "alice", { ...request(null), execute: true }),
      code("INVALID_INPUT"),
    );
    assert.throws(
      () => createDomainGuide(config, store, "alice", { ...request(null), dns: "automatic" }),
      code("INVALID_INPUT"),
    );
    assert.throws(
      () => parseDomainGuide({ ...guide, verification: "connected" }),
      code("DOMAIN_GUIDE_INVALID"),
    );
    assert.throws(
      () => parseDomainGuide({ ...guide, connection: "selected" }),
      code("DOMAIN_GUIDE_INVALID"),
    );
    assert.throws(
      () => parseDomainGuide({ ...guide, hostname: "https://example.ir" }),
      code("DOMAIN_GUIDE_INVALID"),
    );
    assert.throws(
      () => parseDomainGuide({ ...guide, records: [{ type: "A", value: "127.0.0.1" }] }),
      code("INVALID_INPUT"),
    );
  } finally {
    store.close();
  }
});
