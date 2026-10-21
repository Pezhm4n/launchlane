import assert from "node:assert/strict";
import { test } from "node:test";
import { readConfig } from "../../src/server/config.ts";
import {
  connectLiara,
  connectedLiaraConfig,
  validateLiaraConnection,
} from "../../src/server/connections/liara.ts";
import { AppError } from "../../src/server/errors.ts";
import { Store } from "../../src/server/persistence/store.ts";
import type { Transport } from "../../src/server/providers/http.ts";

const team = "a".repeat(24),
  key = "synthetic-account-key-never-real",
  secret = "synthetic-root-".repeat(4);
const config = readConfig({
  LIARA_TEAM_ID: team,
  LAUNCHLANE_SESSION_SECRET: secret,
  LAUNCHLANE_ENABLE_LIVE_LIARA: "false",
});
const code = (expected: string) => (error: unknown) =>
  error instanceof AppError && error.code === expected;
function transport(calls: string[], wrongTeam = false): Transport {
  return async (url, init) => {
    calls.push(url);
    assert.equal(new Headers(init.headers).get("Authorization"), `Bearer ${key}`);
    assert.equal(init.method, "GET");
    assert.equal(init.redirect, "error");
    return Response.json(
      url.includes("/projects")
        ? {
            projects: [
              {
                _id: "app-internal",
                project_id: "sample-app",
                type: "node",
                envs: [{ key: "PRIVATE", value: "discard-private-setting" }],
              },
            ],
          }
        : url.includes("teamID")
          ? {
              team: { _id: wrongTeam ? "b".repeat(24) : team, name: "تیم نمونه" },
              privateMemberDetails: "discard-member-private",
            }
          : {
              user: {
                _id: "c".repeat(24),
                fullname: "حساب نمونه",
                email: "synthetic@example.test",
                nationalCode: "discard-identity",
                storage: { secretKey: "discard-storage-key" },
              },
            },
    );
  };
}
test("explicit Liara connection verifies identity and the fixed team before encrypted storage; selection grants one app only", async () => {
  const calls: string[] = [],
    store = new Store(":memory:");
  try {
    const view = await connectLiara(
      config,
      store,
      "alice",
      key,
      AbortSignal.timeout(2000),
      transport(calls),
    );
    assert.deepEqual(calls, [
      "https://api.liara.ir/v1/me",
      `https://api.liara.ir/v1/me?teamID=${team}`,
      `https://api.liara.ir/v1/projects?teamID=${team}`,
    ]);
    assert.equal(view.selectedApp, null);
    assert.ok(!JSON.stringify(view).includes("discard-"));
    assert.ok(
      !JSON.stringify(store.db.prepare("SELECT * FROM account_connections").all()).includes(key),
    );
    assert.throws(() => connectedLiaraConfig(config, store, "alice"), code("LIARA_APP_REQUIRED"));
    const saved = store.getConnection("alice", "liara");
    assert.ok(saved);
    store.saveConnection("alice", { ...saved, view: { ...view, selectedApp: "sample-app" } });
    const effective = connectedLiaraConfig(config, store, "alice", "sample-app");
    assert.equal(effective.liaraToken, key);
    assert.deepEqual(effective.apps, ["sample-app"]);
    assert.equal(effective.enableLiveLiara, false);
    assert.throws(
      () => connectedLiaraConfig(config, store, "bob", "sample-app"),
      code("LIARA_AUTH_REQUIRED"),
    );
    assert.throws(
      () => connectedLiaraConfig(config, store, "alice", "different-app"),
      code("LIARA_APP_REQUIRED"),
    );
    assert.throws(
      () => connectedLiaraConfig({ ...config, apps: ["different-app"] }, store, "alice"),
      code("LIARA_APP_REQUIRED"),
    );
  } finally {
    store.close();
  }
});
test("wrong Liara team, invalid credentials, denied permissions, limits and cancellation never register a connection", async () => {
  const calls: string[] = [],
    store = new Store(":memory:");
  try {
    await assert.rejects(
      connectLiara(config, store, "alice", key, AbortSignal.timeout(2000), transport(calls, true)),
      code("LIARA_TEAM_MISMATCH"),
    );
    assert.equal(calls.length, 2);
    assert.equal(store.getConnection("alice", "liara"), null);
    let upstream = 0;
    await assert.rejects(
      validateLiaraConnection(config, "Bearer invalid-key", AbortSignal.timeout(2000), async () => {
        upstream++;
        return Response.json({});
      }),
      code("LIARA_KEY_INVALID"),
    );
    assert.equal(upstream, 0);
    for (const [status, expected] of [
      [401, "LIARA_AUTH_REQUIRED"],
      [403, "LIARA_ACCESS_DENIED"],
      [429, "LIARA_RATE_LIMIT"],
      [503, "LIARA_UNAVAILABLE"],
    ] as const)
      await assert.rejects(
        connectLiara(config, store, "alice", key, AbortSignal.timeout(2000), async () =>
          Response.json({ message: key }, { status }),
        ),
        code(expected),
      );
    const controller = new AbortController();
    await assert.rejects(
      connectLiara(config, store, "alice", key, controller.signal, async () => {
        controller.abort();
        return Response.json({ user: {} });
      }),
      code("CANCELLED"),
    );
    await assert.rejects(
      validateLiaraConnection(config, key, AbortSignal.timeout(2000), async () =>
        Response.json({ user: { apiKey: key } }),
      ),
      code("LIARA_RESPONSE_INVALID"),
    );
    assert.equal(store.getConnection("alice", "liara"), null);
  } finally {
    store.close();
  }
});
