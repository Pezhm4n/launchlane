import assert from "node:assert/strict";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { readConfig } from "../../src/server/config.ts";
import {
  connectLiara,
  connectedLiaraConfig,
  parseLiaraTeam,
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
test("live Liara team responses use teamName and preserve exact team identity", () => {
  const response = {
    team: {
      _id: team,
      teamName: "تیم آزمون",
      isTeam: true,
      balance: 2000000,
      teamCreator: { email: "must-not-leave-boundary@example.test" },
      teamMemberPermissions: ["apps.read"],
    },
  };
  assert.deepEqual(parseLiaraTeam(response, team), { id: team, name: "تیم آزمون" });
  assert.throws(() => parseLiaraTeam(response, "b".repeat(24)), code("LIARA_TEAM_MISMATCH"));
  assert.throws(() => parseLiaraTeam({ team: { _id: team, name: "synthetic-old-shape" } }, team));
});

test("cancelling account validation bounds a transport or body that ignores abort and saves no connection", async () => {
  const store = new Store(":memory:");
  try {
    for (const stage of ["headers", "body"] as const) {
      let calls = 0;
      const controller = new AbortController(),
        timer = setTimeout(() => controller.abort(), 10);
      try {
        const outcome = await Promise.race([
          connectLiara(config, store, "alice", key, controller.signal, async () => {
            calls++;
            if (stage === "headers") return new Promise<Response>(() => undefined);
            return new Response(new ReadableStream({ start() {} }), {
              headers: { "Content-Type": "application/json" },
            });
          }).then(
            () => "unexpected_success",
            (error: unknown) => (error instanceof AppError ? error.code : "unexpected_error"),
          ),
          delay(500, "hung"),
        ]);
        assert.equal(outcome, "CANCELLED", stage);
        assert.equal(calls, 3);
        assert.equal(store.getConnection("alice", "liara"), null);
      } finally {
        clearTimeout(timer);
        controller.abort();
      }
    }
  } finally {
    store.close();
  }
});
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
              team: { _id: wrongTeam ? "b".repeat(24) : team, teamName: "تیم نمونه" },
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

test("independent connection reads start together and persist only after all three validate", async () => {
  const store = new Store(":memory:"),
    started: string[] = [],
    gate = Promise.withResolvers<void>(),
    reply = transport([]);
  try {
    const connected = connectLiara(
      config,
      store,
      "alice",
      key,
      AbortSignal.timeout(1000),
      async (url, init) => {
        started.push(url);
        assert.equal(store.getConnection("alice", "liara"), null);
        if (started.length === 3) gate.resolve();
        await gate.promise;
        return reply(url, init);
      },
    );
    assert.equal(started.length, 3);
    assert.equal(store.getConnection("alice", "liara"), null);
    const view = await connected;
    assert.equal(view.status, "connected");
    assert.equal(view.teamId, team);
    assert.deepEqual(view.apps.map((app) => app.name), ["sample-app"]);
    assert.deepEqual(store.getConnection("alice", "liara")?.view, view);
  } finally {
    gate.resolve();
    store.close();
  }
});

test("a failed team read cancels siblings, preserves its typed error and cannot replace a saved account late", async () => {
  const store = new Store(":memory:"),
    late = Promise.withResolvers<void>(),
    signals: AbortSignal[] = [],
    reply = transport([]);
  try {
    await connectLiara(config, store, "alice", key, AbortSignal.timeout(1000), reply);
    const previous = store.getConnection("alice", "liara");
    await assert.rejects(
      connectLiara(config, store, "alice", key, AbortSignal.timeout(1000), async (url, init) => {
        assert.ok(init.signal);
        signals.push(init.signal);
        if (url.includes("/me?"))
          return Response.json({ team: { _id: "b".repeat(24), teamName: "different team" } });
        await late.promise;
        return reply(url, init);
      }),
      code("LIARA_TEAM_MISMATCH"),
    );
    assert.equal(signals.length, 3);
    assert.ok(signals.every((signal) => signal.aborted));
    assert.deepEqual(store.getConnection("alice", "liara"), previous);
    late.resolve();
    await delay(0);
    assert.deepEqual(store.getConnection("alice", "liara"), previous);
  } finally {
    late.resolve();
    store.close();
  }
});
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
    assert.equal(calls.length, 3);
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
