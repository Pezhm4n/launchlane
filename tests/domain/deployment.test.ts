import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import type { Session } from "../../src/contracts/domain.ts";
import { decodeAction } from "../../src/contracts/client-decode.ts";
import {
  executeDeployment,
  observeDeployment,
  proposeDeployment,
} from "../../src/server/application/deployment.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import { sealCredential } from "../../src/server/connections/credentials.ts";
import { readConfig } from "../../src/server/config.ts";
import { AppError } from "../../src/server/errors.ts";
import { LiaraReadClient } from "../../src/server/liara/client.ts";
import { LiaraDeployClient } from "../../src/server/liara/deploy.ts";
import { WorkloadProbe } from "../../src/server/liara/probe.ts";
import { Store } from "../../src/server/persistence/store.ts";
import { parseActionSpec, fingerprint } from "../../src/server/policy/action.ts";
import type { Transport } from "../../src/server/providers/http.ts";

const scope = { teamId: "a".repeat(24), app: "test-node" };
const session: Session = {
  id: "deployment-session",
  actorId: "alice",
  csrfToken: "synthetic",
  expiresAt: Date.now() + 600_000,
};
const origin = "https://test-node.example.com";
const signal = () => AbortSignal.timeout(5000);
const code = (expected: string) => (error: unknown) =>
  error instanceof AppError && error.code === expected;
async function fixture(
  options: { write?: (url: string, init: RequestInit, store: Store) => Promise<Response> } = {},
) {
  const root = await mkdtemp(join(tmpdir(), "launchlane-deploy-")),
    stateDir = join(root, "state"),
    path = join(stateDir, "state.sqlite");
  await mkdir(stateDir);
  await mkdir(join(root, "app"));
  await writeFile(
    join(root, "app/package.json"),
    JSON.stringify({ scripts: { start: "node server.mjs" } }),
  );
  await writeFile(join(root, "app/server.mjs"), "app.listen(3000); // immutable, never executed");
  const config = readConfig({
    LAUNCHLANE_STATE_DIR: stateDir,
    LAUNCHLANE_WORKSPACE_ROOT: root,
    LAUNCHLANE_SESSION_SECRET: "synthetic-deployment-key-".repeat(3),
    LIARA_TEAM_ID: scope.teamId,
    LAUNCHLANE_APP_ALLOWLIST: scope.app,
    LIARA_API_TOKEN: "synthetic-paas-never-real",
    LAUNCHLANE_ENABLE_MUTATIONS: "true",
    LAUNCHLANE_ENABLE_LIVE_LIARA: "true",
    LAUNCHLANE_PROBE_ORIGINS: JSON.stringify({ [scope.app]: origin }),
  });
  let store = new Store(path),
    writes = 0,
    reads = 0,
    probeCalls = 0;
  store.saveConnection(session.actorId, {
    source: "token",
    ciphertext: sealCredential(config.liaraToken, config.sessionSecret, session.actorId, "liara"),
    view: {
      provider: "liara",
      status: "connected",
      identityId: "synthetic-user",
      displayName: "حساب آزمون",
      login: "synthetic@example.test",
      teamId: scope.teamId,
      teamName: "تیم آزمون",
      selectedApp: scope.app,
      apps: [{ id: "project-exact", name: scope.app, platform: "node" }],
      checkedAt: Date.now(),
    },
  });
  let projectId = "project-exact",
    planId = "current-plan",
    releaseState = "READY",
    currentRelease = "release-exact",
    body = '{"revision":"sample-v2"}',
    status = 200,
    readFailure = false,
    changeAfterProbe = false;
  const read = new LiaraReadClient(config, async (url) => {
    reads++;
    assert.equal(new URL(url).searchParams.get("teamID"), scope.teamId);
    if (readFailure) return new Response(null, { status: 403 });
    return Response.json(
      new URL(url).pathname.endsWith("/releases")
        ? {
            total: 1,
            currentRelease,
            releases: [{ _id: "release-exact", state: releaseState, port: 3000 }],
          }
        : {
            project: {
              _id: projectId,
              project_id: scope.app,
              type: "node",
              status: "Running",
              envs: [],
              planID: planId,
            },
          },
    );
  });
  const send: Transport = async (url, init) => {
    writes++;
    const action = store.getProjectFlow(session.actorId)?.actionId;
    assert.ok(action);
    const claimed = store.getAction(action, session.actorId);
    assert.equal(claimed.state, "executing");
    assert.ok(claimed.attemptId);
    assert.equal(new URL(url).searchParams.get("teamID"), scope.teamId);
    assert.equal(init.method, "POST");
    assert.equal(init.redirect, "error");
    assert.ok(new URL(url).pathname.startsWith(`/v2/projects/${scope.app}/`));
    if (new URL(url).pathname.endsWith("/sources")) {
      assert.equal(claimed.deployment?.stage, "upload_started");
      assert.ok(init.body instanceof FormData);
      assert.deepEqual([...init.body.keys()], ["file"]);
      const file = init.body.get("file");
      assert.ok(file instanceof Blob);
      const digest = createHash("sha256")
        .update(Buffer.from(await file.arrayBuffer()))
        .digest("hex");
      assert.equal(claimed.spec.version === 4 && claimed.spec.artifactHash, digest);
    } else {
      assert.equal(claimed.deployment?.stage, "release_started");
      assert.equal(claimed.deployment?.sourceId, "source-exact");
      assert.deepEqual(JSON.parse(String(init.body)), {
        sourceID: "source-exact",
        port: 3000,
        type: "node",
      });
    }
    if (options.write) return options.write(url, init, store);
    return Response.json(
      new URL(url).pathname.endsWith("/sources")
        ? { sourceID: "source-exact" }
        : { releaseID: "release-exact" },
    );
  };
  const probe = new WorkloadProbe(
    config,
    async () => [{ address: "93.184.216.34", family: 4 }],
    async (url) => {
      probeCalls++;
      assert.equal(url.pathname, "/checkout");
      if (changeAfterProbe) currentRelease = "another-release";
      return { status, body, bytes: Buffer.byteLength(body), durationMs: 3 };
    },
  );
  const flow = await prepareProjectFlow(
    config,
    store,
    session.actorId,
    { kind: "local", directory: "app" },
    signal(),
  );
  const input = {
    flowId: flow.id,
    app: scope.app,
    port: null,
    workload: { origin, path: "/checkout", status: 200, revision: "sample-v2" },
  };
  const action = await proposeDeployment(config, store, session.actorId, input, signal(), { read });
  const deps = { read, write: new LiaraDeployClient(config, send), probe };
  return {
    root,
    config,
    action,
    input,
    deps,
    get store() {
      return store;
    },
    get writes() {
      return writes;
    },
    get reads() {
      return reads;
    },
    get probeCalls() {
      return probeCalls;
    },
    approve() {
      return store.decide(action.id, session.actorId, session.id, action.hash, "approve");
    },
    set(values: {
      projectId?: string;
      planId?: string;
      state?: string;
      current?: string;
      body?: string;
      status?: number;
      readFailure?: boolean;
      changeAfterProbe?: boolean;
    }) {
      projectId = values.projectId ?? projectId;
      planId = values.planId ?? planId;
      releaseState = values.state ?? releaseState;
      currentRelease = values.current ?? currentRelease;
      body = values.body ?? body;
      status = values.status ?? status;
      readFailure = values.readFailure ?? readFailure;
      changeAfterProbe = values.changeAfterProbe ?? changeAfterProbe;
    },
    reopen() {
      store.close();
      store = new Store(path);
      store.recoverInterrupted();
    },
    async cleanup() {
      store.close();
      assert.ok(root.startsWith(join(tmpdir(), "launchlane-deploy-")));
      await rm(root, { recursive: true, force: true });
    },
  };
}

test("approved deployment sends the exact archive then a durable source receipt; only matching release and workload revision finish it", async () => {
  const f = await fixture();
  try {
    f.approve();
    const accepted = await executeDeployment(
      f.config,
      f.store,
      session,
      f.action.id,
      signal(),
      f.deps,
    );
    assert.equal(accepted.state, "observing");
    assert.equal(accepted.remoteId, "release-exact");
    assert.equal(f.writes, 2);
    assert.equal(accepted.deployment?.stage, "release_accepted");
    f.reopen();
    const verified = await observeDeployment(
      { ...f.config, enableMutations: false },
      f.store,
      session,
      f.action.id,
      signal(),
      f.deps,
    );
    assert.equal(verified.state, "succeeded");
    assert.equal(f.writes, 2);
    assert.equal(f.probeCalls, 1);
    assert.equal(verified.deployment?.observation?.code, "WORKLOAD_VERIFIED");
    assert.deepEqual(decodeAction(verified), verified);
    await assert.rejects(
      executeDeployment(f.config, f.store, session, f.action.id, signal(), f.deps),
      code("ACTION_CONFLICT"),
    );
    // A second revision on the same app needs a new artifact and approval.
    await writeFile(
      join(f.root, "app/server.mjs"),
      "app.listen(3000); // second immutable revision",
    );
    const flow = await prepareProjectFlow(
      f.config,
      f.store,
      session.actorId,
      { kind: "local", directory: "app" },
      signal(),
    );
    const second = await proposeDeployment(
      f.config,
      f.store,
      session.actorId,
      { ...f.input, flowId: flow.id },
      signal(),
      f.deps,
    );
    assert.equal(second.state, "awaiting_approval");
    assert.notEqual(second.spec.sourceHash, f.action.spec.sourceHash);
  } finally {
    await f.cleanup();
  }
});

test("rejection, expiry, changed source, app identity, plan, host and disabled gates cause zero writes and zero attempts", async () => {
  for (const variation of [
    "reject",
    "expiry",
    "source",
    "app",
    "plan",
    "host",
    "disabled",
    "read-disabled",
    "budget",
  ] as const) {
    const f = await fixture();
    try {
      let config = f.config;
      if (variation === "reject")
        f.store.decide(f.action.id, session.actorId, session.id, f.action.hash, "reject");
      else f.approve();
      if (variation === "expiry")
        f.store.db
          .prepare("UPDATE actions SET expires_at=? WHERE id=?")
          .run(Date.now() - 1, f.action.id);
      if (variation === "source")
        await writeFile(
          join(f.root, "app/server.mjs"),
          "app.listen(3000); // changed after approval",
        );
      if (variation === "app") f.set({ projectId: "recreated-app" });
      if (variation === "plan") f.set({ planId: "changed-plan" });
      if (variation === "host")
        config = {
          ...config,
          probeOrigins: { [scope.app]: "https://other.example.com" },
        };
      if (variation === "disabled") config = { ...config, enableMutations: false };
      if (variation === "read-disabled") config = { ...config, enableLiveLiara: false };
      if (variation === "budget") config = { ...config, maxToolCalls: 3 };
      await assert.rejects(
        executeDeployment(config, f.store, session, f.action.id, signal(), f.deps),
      );
      assert.equal(f.writes, 0, variation);
      assert.equal(f.store.db.prepare("SELECT count(*) n FROM attempts").get()?.n, 0, variation);
    } finally {
      await f.cleanup();
    }
  }
});

test("503 after an upload or release side effect never replays; checkpoint and uncertainty survive process recovery", async () => {
  for (const failAt of ["sources", "releases"]) {
    const f = await fixture({
      write: async (url) =>
        url.endsWith(`/${failAt}?teamID=${scope.teamId}`)
          ? new Response(null, { status: 503 })
          : Response.json({ sourceID: "source-exact" }),
    });
    try {
      f.approve();
      await assert.rejects(
        executeDeployment(f.config, f.store, session, f.action.id, signal(), f.deps),
        code("UPSTREAM_UNCERTAIN"),
      );
      assert.equal(f.writes, failAt === "sources" ? 1 : 2);
      f.reopen();
      const recovered = f.store.getAction(f.action.id, session.actorId);
      assert.equal(recovered.state, "uncertain");
      assert.equal(recovered.deployment?.sourceId, failAt === "sources" ? null : "source-exact");
      await assert.rejects(
        executeDeployment(f.config, f.store, session, f.action.id, signal(), f.deps),
        code("ACTION_CONFLICT"),
      );
      const observed = await observeDeployment(
        f.config,
        f.store,
        session,
        f.action.id,
        signal(),
        f.deps,
      );
      assert.equal(observed.state, "uncertain");
      assert.equal(observed.deployment?.observation?.code, "RELEASE_RECEIPT_MISSING");
      await assert.rejects(
        proposeDeployment(f.config, f.store, session.actorId, f.input, signal(), f.deps),
        code("UNRESOLVED_EFFECT"),
      );
      assert.equal(f.writes, failAt === "sources" ? 1 : 2);
    } finally {
      await f.cleanup();
    }
  }
});

test("double submit has one durable winner and at most one upload/release pair", async () => {
  const f = await fixture();
  try {
    f.approve();
    const result = await Promise.allSettled([
      executeDeployment(f.config, f.store, session, f.action.id, signal(), f.deps),
      executeDeployment(f.config, f.store, session, f.action.id, signal(), f.deps),
    ]);
    assert.equal(result.filter((row) => row.status === "fulfilled").length, 1);
    assert.equal(f.writes, 2);
    assert.equal(f.store.db.prepare("SELECT count(*) n FROM attempts").get()?.n, 1);
  } finally {
    await f.cleanup();
  }
});

test("READY is insufficient: 404, 500, wrong revision, liveness JSON, redirects and a release change cannot verify the deployment", async () => {
  for (const variation of [
    "404",
    "500",
    "wrong-revision",
    "liveness",
    "redirect",
    "release-change",
    "not-current",
    "pending",
    "build-fail",
    "403",
  ] as const) {
    const f = await fixture();
    try {
      f.approve();
      await executeDeployment(f.config, f.store, session, f.action.id, signal(), f.deps);
      if (variation === "404" || variation === "500") f.set({ status: Number(variation) });
      if (variation === "wrong-revision") f.set({ body: '{"revision":"sample-v1"}' });
      if (variation === "liveness") f.set({ body: '{"alive":true}' });
      if (variation === "redirect") f.set({ status: 302 });
      if (variation === "release-change") f.set({ changeAfterProbe: true });
      if (variation === "not-current") f.set({ current: "old-release" });
      if (variation === "pending") f.set({ state: "BUILDING" });
      if (variation === "build-fail") f.set({ state: "FAILED" });
      if (variation === "403") f.set({ readFailure: true });
      const result = await observeDeployment(
        f.config,
        f.store,
        session,
        f.action.id,
        signal(),
        f.deps,
      );
      assert.notEqual(result.state, "succeeded", variation);
      assert.notEqual(result.deployment?.observation?.outcome, "verified", variation);
      assert.equal(f.writes, 2);
      if (["pending", "not-current", "release-change", "403"].includes(variation))
        assert.equal(result.state, "observing", variation);
    } finally {
      await f.cleanup();
    }
  }
});

test("approval binds expected revision, path, app identity and plan without changing legacy canonicalization", async () => {
  const f = await fixture();
  try {
    f.approve();
    const spec = f.action.spec;
    assert.equal(spec.version, 4);
    if (spec.version !== 4) return;
    for (const changed of [
      { ...spec, targetAppId: "different-id" },
      { ...spec, workload: { ...spec.workload, revision: "other" } },
      { ...spec, workload: { ...spec.workload, path: "/healthz" } },
      { ...spec, args: { ...spec.args, planId: "other" } },
    ])
      assert.throws(
        () => f.store.claim(f.action.id, session.actorId, session.id, changed),
        code("STALE_ACTION"),
      );
    assert.throws(
      () =>
        parseActionSpec({
          ...spec,
          workload: { ...spec.workload, path: "//internal.example.com" },
        }),
      code("PROBE_TARGET_DENIED"),
    );
    assert.throws(
      () =>
        parseActionSpec({
          ...spec,
          workload: { ...spec.workload, approved: true },
        }),
      code("INVALID_INPUT"),
    );
    const legacy = {
      version: 3,
      scope,
      operation: "deploy",
      sourceHash: "b".repeat(64),
      artifactHash: "c".repeat(64),
      projectFlowId: "d".repeat(36),
      selectionHash: "e".repeat(64),
      args: { port: 3000, planId: null },
    };
    assert.equal(fingerprint(parseActionSpec(legacy)), fingerprint(legacy));
    assert.equal(f.writes, 0);
  } finally {
    await f.cleanup();
  }
});

test("failed or malformed upload responses make one send and cannot manufacture a release receipt or leak credentials", async () => {
  for (const kind of ["401", "429", "missing", "secret", "oversize"] as const) {
    const f = await fixture({
      write: async () => {
        if (kind === "401" || kind === "429") return new Response(null, { status: Number(kind) });
        if (kind === "oversize")
          return new Response("x".repeat(16_385), {
            headers: { "Content-Type": "application/json" },
          });
        return Response.json(
          kind === "secret" ? { sourceID: "synthetic-paas-never-real" } : { approved: true },
        );
      },
    });
    try {
      f.approve();
      await assert.rejects(
        executeDeployment(f.config, f.store, session, f.action.id, signal(), f.deps),
        (error: unknown) =>
          code("UPSTREAM_UNCERTAIN")(error) && !String(error).includes(f.config.liaraToken),
      );
      assert.equal(f.writes, 1);
      const action = f.store.getAction(f.action.id, session.actorId);
      assert.equal(action.remoteId, null);
      assert.equal(action.deployment?.sourceId, null);
      assert.ok(!JSON.stringify(action).includes(f.config.liaraToken));
    } finally {
      await f.cleanup();
    }
  }
});

test("cancellation of an unresponsive write is bounded, consumes approval and cannot be replayed", async () => {
  let started: () => void = () => undefined;
  const reached = new Promise<void>((resolve) => {
    started = resolve;
  });
  const f = await fixture({
    write: async () => {
      started();
      return new Promise<Response>(() => undefined);
    },
  });
  try {
    f.approve();
    const controller = new AbortController();
    const execution = executeDeployment(
      f.config,
      f.store,
      session,
      f.action.id,
      controller.signal,
      f.deps,
    );
    await reached;
    controller.abort();
    await assert.rejects(execution, code("UPSTREAM_UNCERTAIN"));
    assert.equal(f.store.getAction(f.action.id, session.actorId).state, "uncertain");
    assert.equal(f.writes, 1);
    assert.throws(() => f.store.recordDeploymentObservation(f.action.id, session.actorId, { outcome: "failed", code: "WRONG_GUESS", checkedAt: Date.now(), releaseId: null, releaseState: null, status: null }), code("EVIDENCE_MISMATCH"));
    await assert.rejects(
      executeDeployment(f.config, f.store, session, f.action.id, signal(), f.deps),
      code("ACTION_CONFLICT"),
    );
    assert.equal(f.writes, 1);
  } finally {
    await f.cleanup();
  }
});

test("disconnect after accepted upload preserves its receipt but prevents release", async () => {
  const f = await fixture({
    write: async (_url, _init, store) => {
      store.disconnectConnection(session.actorId, "liara");
      return Response.json({ sourceID: "source-exact" });
    },
  });
  try {
    f.approve();
    await assert.rejects(
      executeDeployment(f.config, f.store, session, f.action.id, signal(), f.deps),
      code("UPSTREAM_UNCERTAIN"),
    );
    assert.equal(f.writes, 1);
    assert.equal(
      f.store.getAction(f.action.id, session.actorId).deployment?.sourceId,
      "source-exact",
    );
  } finally {
    await f.cleanup();
  }
});

test("bounded observation can resume pending build after selecting a different source; it never renews or replays approval", async () => {
  const f = await fixture();
  try {
    f.approve();
    await executeDeployment(f.config, f.store, session, f.action.id, signal(), f.deps);
    f.set({ state: "BUILDING" });
    assert.equal(
      (await observeDeployment(f.config, f.store, session, f.action.id, signal(), f.deps)).state,
      "observing",
    );
    await prepareProjectFlow(
      f.config,
      f.store,
      session.actorId,
      { kind: "local", directory: "app" },
      signal(),
    );
    f.set({ state: "READY" });
    const result = await observeDeployment(
      f.config,
      f.store,
      session,
      f.action.id,
      signal(),
      f.deps,
    );
    assert.equal(result.state, "succeeded");
    assert.equal(f.writes, 2);
    assert.throws(
      () => f.store.finishObservation(f.action.id, session.actorId, "healthy"),
      code("DEPLOYMENT_OBSERVATION_REQUIRED"),
    );
  } finally {
    await f.cleanup();
  }
});

test("a plan change after accepted upload stops before release and retains the source receipt", async () => {
  let changePlan: () => void = () => undefined;
  const f = await fixture({ write: async () => { changePlan(); return Response.json({ sourceID: "source-exact" }); } });
  changePlan = () => f.set({ planId: "externally-changed-plan" });
  try {
    f.approve();
    await assert.rejects(executeDeployment(f.config, f.store, session, f.action.id, signal(), f.deps), code("UPSTREAM_UNCERTAIN"));
    assert.equal(f.writes, 1);
    const action = f.store.getAction(f.action.id, session.actorId);
    assert.equal(action.state, "uncertain");
    assert.equal(action.deployment?.sourceId, "source-exact");
    assert.equal(action.deployment?.stage, "uploaded");
  } finally { await f.cleanup(); }
});
