import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Worker } from "node:worker_threads";
import { test } from "node:test";
import type { ActionSpec, Session } from "../../src/contracts/domain.ts";
import { readConfig } from "../../src/server/config.ts";
import { Store } from "../../src/server/persistence/store.ts";
import { executeApproved, observeAction } from "../../src/server/application/execute.ts";
import { AppError } from "../../src/server/errors.ts";
import { authorizeScope, parseActionSpec } from "../../src/server/policy/action.ts";
import { checkRequest, login, requireSession } from "../../src/server/policy/session.ts";

const scope = { teamId: "a".repeat(24), app: "sample-node" };
const spec: ActionSpec = {
  version: 1,
  scope,
  operation: "deploy",
  sourceHash: "b".repeat(64),
  args: { port: 3000, planId: null },
};
const session: Session = {
  id: "test-session",
  actorId: "operator",
  csrfToken: "test-csrf",
  expiresAt: Date.now() + 600_000,
};
const env = {
  LAUNCHLANE_OPERATOR_TOKEN: `operator-${"x".repeat(40)}`,
  LAUNCHLANE_SESSION_SECRET: `session-${"y".repeat(40)}`,
  LIARA_TEAM_ID: scope.teamId,
  LAUNCHLANE_APP_ALLOWLIST: scope.app,
};
const config = readConfig(env);
const code = (expected: string) => (error: unknown) =>
  error instanceof AppError && error.code === expected;

function temporary() {
  const directory = mkdtempSync(join(tmpdir(), "launchlane-state-"));
  return {
    directory,
    path: join(directory, "state.sqlite"),
    cleanup() {
      assert.ok(directory.startsWith(join(tmpdir(), "launchlane-state-")));
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

test("exact action, actor, scope, session, expiry and single-use approval are enforced", () => {
  const store = new Store(":memory:");
  try {
    const action = store.createAction(session.actorId, spec);
    assert.throws(
      () => store.claim(action.id, session.actorId, session.id, spec),
      code("ACTION_CONFLICT"),
    );
    assert.throws(
      () => store.decide(action.id, "another-actor", session.id, action.hash, "approve"),
      code("NOT_FOUND"),
    );
    assert.throws(
      () => store.decide(action.id, session.actorId, session.id, "c".repeat(64), "approve"),
      code("STALE_ACTION"),
    );
    store.decide(action.id, session.actorId, session.id, action.hash, "approve");
    assert.throws(
      () => store.claim(action.id, session.actorId, "another-session", spec),
      code("APPROVAL_SESSION"),
    );
    for (const changed of [
      { ...spec, sourceHash: "c".repeat(64) },
      { ...spec, args: { port: 8080, planId: null } },
      { ...spec, scope: { ...scope, app: "another-app" } },
      { ...spec, args: { port: 3000, planId: "larger-plan" } },
    ])
      assert.throws(
        () => store.claim(action.id, session.actorId, session.id, changed),
        code("STALE_ACTION"),
      );
    store.claim(action.id, session.actorId, session.id, spec);
    assert.throws(
      () => store.claim(action.id, session.actorId, session.id, spec),
      code("ACTION_CONFLICT"),
    );
    assert.throws(() => store.createAction(session.actorId, spec), code("UNRESOLVED_EFFECT"));
    const denied = store.createAction(session.actorId, {
      ...spec,
      scope: { ...scope, app: "second" },
    });
    store.decide(denied.id, session.actorId, session.id, denied.hash, "reject");
    assert.throws(
      () => store.claim(denied.id, session.actorId, session.id, denied.spec),
      code("ACTION_CONFLICT"),
    );
    const expired = store.createAction(
      session.actorId,
      { ...spec, scope: { ...scope, app: "third" } },
      Date.now() - 2000,
      1000,
    );
    assert.throws(
      () => store.decide(expired.id, session.actorId, session.id, expired.hash, "approve"),
      code("APPROVAL_EXPIRED"),
    );
    assert.throws(
      () => authorizeScope({ ...scope, teamId: "d".repeat(24) }, config),
      code("SCOPE_DENIED"),
    );
    assert.throws(
      () => parseActionSpec({ ...spec, operation: "shell", command: "restart" }),
      code("INVALID_INPUT"),
    );
  } finally {
    store.close();
  }
});

test("disabled mutation gate invokes zero provider calls and consumes no approval", async () => {
  const store = new Store(":memory:");
  try {
    const action = store.createAction(session.actorId, spec);
    store.decide(action.id, session.actorId, session.id, action.hash, "approve");
    let writes = 0;
    await assert.rejects(
      executeApproved({
        store,
        config,
        session,
        id: action.id,
        currentSpec: spec,
        signal: new AbortController().signal,
        adapter: {
          async execute() {
            writes++;
            return { remoteId: "release-a" };
          },
        },
      }),
      code("MUTATIONS_DISABLED"),
    );
    assert.equal(writes, 0);
    assert.equal(store.getAction(action.id, session.actorId).state, "approved");
  } finally {
    store.close();
  }
});

test("lost write response persists an attempt and blocks fresh actions even after restart", async () => {
  const spec: ActionSpec = {
    version: 1,
    scope,
    operation: "restart",
    sourceHash: null,
    args: { port: null, planId: null },
  };
  const temp = temporary();
  let store = new Store(temp.path);
  try {
    const action = store.createAction(session.actorId, spec);
    store.decide(action.id, session.actorId, session.id, action.hash, "approve");
    let writes = 0;
    await assert.rejects(
      executeApproved({
        store,
        config: { ...config, enableMutations: true },
        session,
        id: action.id,
        currentSpec: spec,
        signal: new AbortController().signal,
        adapter: {
          async execute(claimed) {
            assert.equal(store.getAction(claimed.id, session.actorId).state, "executing");
            writes++;
            throw new Error("response lost after server accepted the write");
          },
        },
      }),
      code("UPSTREAM_UNCERTAIN"),
    );
    assert.equal(writes, 1);
    store.close();
    store = new Store(temp.path);
    store.recoverInterrupted();
    assert.equal(store.getAction(action.id, session.actorId).state, "uncertain");
    assert.throws(() => store.createAction(session.actorId, spec), code("UNRESOLVED_EFFECT"));
    await observeAction(store, session, action.id, async () => ({
      scope,
      remoteId: null,
      evidenceId: "read-unknown",
      effect: "unknown",
    }));
    assert.throws(() => store.createAction(session.actorId, spec), code("UNRESOLVED_EFFECT"));
    await assert.rejects(
      observeAction(store, session, action.id, async () => ({
        scope,
        remoteId: "other",
        evidenceId: "unrelated",
        effect: "healthy",
      })),
      code("EVIDENCE_MISMATCH"),
    );
    await observeAction(store, session, action.id, async () => ({
      scope,
      remoteId: null,
      evidenceId: "verified-not-applied",
      effect: "not_applied",
    }));
    assert.equal(store.getAction(action.id, session.actorId).state, "failed");
    assert.equal(store.createAction(session.actorId, spec).state, "awaiting_approval");
  } finally {
    store.close();
    temp.cleanup();
  }
});

test("process interruption recovers executing, preserves observing and never repeats a write", () => {
  const temp = temporary();
  let store = new Store(temp.path);
  try {
    const first = store.createAction(session.actorId, spec);
    store.decide(first.id, session.actorId, session.id, first.hash, "approve");
    store.claim(first.id, session.actorId, session.id, spec);
    const secondSpec = { ...spec, scope: { ...scope, app: "second" } };
    const second = store.createAction(session.actorId, secondSpec);
    store.decide(second.id, session.actorId, session.id, second.hash, "approve");
    store.claim(second.id, session.actorId, session.id, secondSpec);
    store.receipt(second.id, session.actorId, "release-second");
    store.close();
    store = new Store(temp.path);
    assert.equal(store.recoverInterrupted(), 1);
    assert.equal(store.getAction(first.id, session.actorId).state, "uncertain");
    assert.equal(store.getAction(second.id, session.actorId).state, "observing");
    assert.throws(
      () => store.claim(first.id, session.actorId, session.id, spec),
      code("ACTION_CONFLICT"),
    );
  } finally {
    store.close();
    temp.cleanup();
  }
});

test("two independent SQLite connections racing to claim have exactly one winner", async () => {
  const temp = temporary();
  const store = new Store(temp.path);
  const workers: Worker[] = [];
  try {
    const action = store.createAction(session.actorId, spec);
    store.decide(action.id, session.actorId, session.id, action.hash, "approve");
    const tasks = [1, 2].map(
      () =>
        new Promise<string>((resolve, reject) => {
          const worker = new Worker(new URL("../helpers/claim-worker.mjs", import.meta.url), {
            workerData: { path: temp.path, action, session },
          });
          workers.push(worker);
          worker.on("message", (message: string) => {
            if (message === "ready") {
              if (++ready === 2)
                workers.forEach((w) => {
                  w.postMessage("claim");
                });
            } else resolve(message);
          });
          worker.on("error", reject);
        }),
    );
    let ready = 0;
    const results = await Promise.all(tasks);
    assert.deepEqual(results.sort(), ["ACTION_CONFLICT", "claimed"]);
    assert.equal(store.db.prepare("SELECT count(*) AS n FROM attempts").get()?.n, 1);
  } finally {
    await Promise.all(workers.map((worker) => worker.terminate()));
    store.close();
    temp.cleanup();
  }
});

test("session authentication checks origin/host/CSRF, tamper, expiry, logout and throttling", () => {
  const store = new Store(":memory:");
  try {
    const auth = login(config.operatorToken, config, store);
    const headers = {
      host: "127.0.0.1:3000",
      origin: config.origin,
      cookie: auth.cookie.split(";")[0] || "",
      "x-csrf-token": auth.session.csrfToken,
    };
    const request = (extra = {}) =>
      new Request(config.origin, {
        method: "POST",
        headers: { ...headers, ...extra },
      });
    assert.equal(requireSession(request(), config, store, true).id, auth.session.id);
    assert.throws(
      () => requireSession(request({ origin: "https://evil.test" }), config, store, true),
      code("ORIGIN_DENIED"),
    );
    assert.throws(
      () => checkRequest(request({ host: "evil.test" }), config, true),
      code("HOST_DENIED"),
    );
    assert.throws(
      () => requireSession(request({ "x-csrf-token": "forged" }), config, store, true),
      code("CSRF_DENIED"),
    );
    assert.throws(
      () => requireSession(request({ cookie: `${headers.cookie}x` }), config, store, true),
      code("AUTH_REQUIRED"),
    );
    assert.throws(
      () => requireSession(request(), config, store, true, auth.session.expiresAt),
      code("AUTH_REQUIRED"),
    );
    store.revokeSession(auth.session.id);
    assert.throws(() => requireSession(request(), config, store, true), code("AUTH_REQUIRED"));
    for (let n = 0; n < 4; n++)
      assert.throws(() => login("bad", config, store), code("AUTH_REQUIRED"));
    assert.throws(() => login("bad", config, store), code("RATE_LIMITED"));
  } finally {
    store.close();
  }
});

test("migration checksum drift and unavailable durable state fail closed", () => {
  const temp = temporary();
  const store = new Store(temp.path);
  store.db.prepare("UPDATE schema_migrations SET checksum='changed' WHERE version=1").run();
  store.close();
  try {
    assert.throws(() => new Store(temp.path), code("MIGRATION_MISMATCH"));
    assert.throws(() => new Store(join(temp.directory, "missing-parent", "state.sqlite")));
  } finally {
    temp.cleanup();
  }
});
