import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeAction } from "../../src/contracts/client-decode.ts";
import { restartReadbackEvidence } from "../../src/contracts/restart.ts";
import { verifySameSymptom } from "../../src/contracts/incident.ts";
import {
  executeRestart,
  observeRestart,
  proposeRestart,
} from "../../src/server/application/restart.ts";
import { AppError } from "../../src/server/errors.ts";
import { LiaraRestartClient } from "../../src/server/liara/restart.ts";
import { WorkloadProbe } from "../../src/server/liara/probe.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";
import { parseActionSpec } from "../../src/server/policy/action.ts";
import { restartFixture, restartSession as session } from "../helpers/restart-fixture.ts";

const signal = () => AbortSignal.timeout(3000);
const code = (expected: string) => (error: unknown) =>
  error instanceof AppError && error.code === expected;
const propose = (f: ReturnType<typeof restartFixture>) =>
  proposeRestart(f.config, f.store, session.actorId, f.run.id, signal(), f.deps);
async function approved(f: ReturnType<typeof restartFixture>) {
  const action = await propose(f);
  return f.store.decide(action.id, session.actorId, session.id, action.hash, "approve");
}

test("restart binds account, app, current release and incident; acceptance is not a release or a completed restart", async () => {
  const f = restartFixture();
  try {
    const action = await approved(f);
    assert.equal(action.spec.version, 6);
    assert.equal(action.spec.sourceHash, null);
    assert.deepEqual(decodeAction(action), action);
    assert.deepEqual(f.counts, { reads: 2, writes: 0, probes: 0 });
    const accepted = await executeRestart(f.config, f.store, session, action.id, signal(), f.deps);
    assert.equal(accepted.state, "observing");
    assert.equal(accepted.remoteId, null);
    assert.equal(accepted.restart?.stage, "accepted");
    assert.equal(accepted.restart?.observation, null);
    assert.deepEqual(f.counts, { reads: 4, writes: 1, probes: 0 });
    f.reopen();
    assert.equal(f.store.getAction(action.id, session.actorId).restart?.stage, "accepted");
    f.state.status = 500;
    const failed = await observeRestart(f.config, f.store, session, action.id, signal(), f.deps);
    assert.equal(failed.state, "failed");
    assert.equal(failed.restart?.observation?.status, 500);
    f.state.status = 200;
    const responding = await observeRestart(
      f.config,
      f.store,
      session,
      action.id,
      signal(),
      f.deps,
    );
    assert.equal(responding.state, "succeeded");
    assert.equal(responding.restart?.observation?.outcome, "responding");
    assert.equal(responding.remoteId, null);
    const evidence = restartReadbackEvidence(responding);
    assert.ok(evidence);
    assert.equal(verifySameSymptom(f.run.evidence, evidence).outcome, "verified");
    const historical = decodeAction({ ...responding, restart: { ...responding.restart,
      observation: { ...responding.restart?.observation, observedAt: undefined } } });
    assert.equal(historical.hash, responding.hash);
    assert.equal(restartReadbackEvidence(historical), null);
    assert.throws(() => decodeAction({ ...responding, restart: { ...responding.restart,
      observation: { ...responding.restart?.observation, observedAt: (responding.restart?.observation?.checkedAt ?? 0) + 1 } } }));
    assert.equal(f.counts.writes, 1);
    await assert.rejects(
      executeRestart(f.config, f.store, session, action.id, signal(), f.deps),
      code("ACTION_CONFLICT"),
    );
    assert.equal(f.counts.writes, 1);
  } finally {
    f.cleanup();
  }
});

test("restart gates, cancellation, insufficient budget, actor, session, denial and expiry stop before the only write", async (t) => {
  for (const scenario of [
    "gate",
    "liveGate",
    "cancel",
    "budget",
    "actor",
    "session",
    "deny",
    "expired",
  ] as const)
    await t.test(scenario, async () => {
      const f = restartFixture();
      try {
        const action = await propose(f);
        f.store.decide(
          action.id,
          session.actorId,
          session.id,
          action.hash,
          scenario === "deny" ? "reject" : "approve",
        );
        if (scenario === "expired")
          f.store.db
            .prepare("UPDATE actions SET expires_at=? WHERE id=?")
            .run(Date.now() - 1, action.id);
        const changed =
          scenario === "gate"
            ? { ...f.config, enableMutations: false }
            : scenario === "liveGate"
              ? { ...f.config, enableLiveLiara: false }
              : scenario === "budget"
                ? { ...f.config, maxToolCalls: 2 }
                : f.config;
        const before = f.counts;
        await assert.rejects(
          executeRestart(
            changed,
            f.store,
            scenario === "actor"
              ? { ...session, actorId: "other" }
              : scenario === "session"
                ? { ...session, id: "other-session" }
                : session,
            action.id,
            scenario === "cancel" ? AbortSignal.abort() : signal(),
            f.deps,
          ),
        );
        assert.equal(f.counts.writes, 0);
        assert.equal(f.store.getAction(action.id, session.actorId).attemptId, null);
        if (["gate", "liveGate", "cancel", "budget", "actor", "deny", "expired"].includes(scenario))
          assert.equal(f.counts.reads, before.reads);
      } finally {
        f.cleanup();
      }
    });
});

test("changed account, same-name app, plan, release, origin or incident cannot inherit restart approval", async (t) => {
  for (const scenario of ["account", "app", "plan", "release", "origin", "incident"] as const)
    await t.test(scenario, async () => {
      const f = restartFixture();
      try {
        const action = await approved(f);
        if (scenario === "account")
          f.store.saveConnection(session.actorId, {
            ...f.connection,
            view: { ...f.connection.view, identityId: "another-user" },
          });
        if (scenario === "app") f.state.projectId = "recreated-app";
        if (scenario === "plan") f.state.planId = "changed-plan";
        if (scenario === "release") f.state.releaseId = "changed-release";
        if (scenario === "incident")
          f.store.saveIncidentRun(session.actorId, {
            ...f.run,
            after: { ...f.run.evidence, collectedAt: f.run.evidence.collectedAt + 1 },
          });
        await assert.rejects(
          executeRestart(
            scenario === "origin"
              ? { ...f.config, probeOrigins: { "test-node": "https://elsewhere.example.com" } }
              : f.config,
            f.store,
            session,
            action.id,
            signal(),
            f.deps,
          ),
        );
        assert.equal(f.counts.writes, 0);
        assert.equal(f.store.getAction(action.id, session.actorId).attemptId, null);
      } finally {
        f.cleanup();
      }
    });
});

test("double execution claims once and a new restart proposal cancels old unused approvals", async () => {
  const f = restartFixture();
  try {
    const old = await approved(f),
      action = await approved(f);
    assert.equal(f.store.getAction(old.id, session.actorId).state, "cancelled");
    const results = await Promise.allSettled(
      [1, 2].map(() => executeRestart(f.config, f.store, session, action.id, signal(), f.deps)),
    );
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(f.counts.writes, 1);
  } finally {
    f.cleanup();
  }
});

test("401, 409, 429, 5xx, unexpected success, lost headers and cancellation never replay a possibly sent restart", async (t) => {
  for (const scenario of [401, 409, 429, 503, 202, "lost", "cancel"] as const)
    await t.test(String(scenario), async () => {
      const f = restartFixture(async (_url, init) => {
        if (scenario === "lost") throw new Error("accepted by provider; response lost");
        if (scenario === "cancel")
          return new Promise<Response>((_resolve, reject) =>
            init.signal?.addEventListener("abort", () => reject(new Error("lost after abort")), {
              once: true,
            }),
          );
        return new Response(null, { status: scenario });
      });
      try {
        const action = await approved(f);
        await assert.rejects(
          executeRestart(
            f.config,
            f.store,
            session,
            action.id,
            scenario === "cancel" ? AbortSignal.timeout(40) : signal(),
            f.deps,
          ),
          code("UPSTREAM_UNCERTAIN"),
        );
        f.reopen();
        const observed = await observeRestart(
          f.config,
          f.store,
          session,
          action.id,
          signal(),
          f.deps,
        );
        assert.equal(observed.restart?.observation?.outcome, "responding");
        assert.equal(observed.state, "uncertain");
        assert.equal(observed.restart?.acceptedAt, null);
        assert.throws(
          () => f.store.createAction(session.actorId, action.spec),
          code("UNRESOLVED_EFFECT"),
        );
        assert.throws(() => f.store.finishObservation(action.id, session.actorId, "healthy"));
        assert.throws(
          () => f.store.receipt(action.id, session.actorId, "invented-release"),
          code("RESTART_RECEIPT_REQUIRED"),
        );
        await assert.rejects(
          executeRestart(f.config, f.store, session, action.id, signal(), f.deps),
          code("ACTION_CONFLICT"),
        );
        assert.equal(f.counts.writes, 1);
      } finally {
        f.cleanup();
      }
    });
});

test("interruption before request start can resolve as not sent; after start it remains uncertain", async (t) => {
  for (const started of [false, true])
    await t.test(String(started), async () => {
      const f = restartFixture();
      try {
        const action = await approved(f);
        f.store.claim(action.id, session.actorId, session.id, action.spec);
        if (started) f.store.startRestartRequest(action.id, session.actorId);
        f.reopen();
        const observed = await observeRestart(
          f.config,
          f.store,
          session,
          action.id,
          signal(),
          f.deps,
        );
        assert.equal(observed.state, started ? "uncertain" : "failed");
        if (!started) assert.equal(observed.restart?.observation?.outcome, "not_started");
        assert.equal(f.counts.writes, 0);
      } finally {
        f.cleanup();
      }
    });
});

test("a changed release during the probe, redirect or provider failure cannot establish same-page response", async (t) => {
  for (const scenario of ["release", "redirect", "provider"] as const)
    await t.test(scenario, async () => {
      const f = restartFixture();
      try {
        const action = await approved(f);
        await executeRestart(f.config, f.store, session, action.id, signal(), f.deps);
        f.state.changeAfterProbe = scenario === "release";
        f.state.status = scenario === "redirect" ? 302 : 200;
        f.state.readStatus = scenario === "provider" ? 401 : 200;
        const observed = await observeRestart(
          f.config,
          f.store,
          session,
          action.id,
          signal(),
          f.deps,
        );
        assert.notEqual(observed.state, "succeeded");
        assert.notEqual(observed.restart?.observation?.outcome, "responding");
        assert.equal(f.counts.writes, 1);
      } finally {
        f.cleanup();
      }
    });
});

test("restart rejects stale evidence, samples, healthy pages, unrelated pages and unsupported symptoms", async (t) => {
  for (const scenario of ["stale", "sample", "healthy", "path", "slow"] as const)
    await t.test(scenario, async () => {
      const f = restartFixture();
      try {
        const run = f.run;
        if (scenario === "stale") run.evidence.collectedAt = Date.now() - 900_001;
        if (scenario === "sample") {
          run.kind = "sample";
          run.evidence.mode = "simulated";
          run.scenario = "configuration";
        }
        if (scenario === "healthy") {
          const fact = run.evidence.entries[0]?.fact;
          assert.equal(fact?.kind, "http");
          if (fact?.kind === "http") fact.status = 200;
        }
        if (scenario === "path") run.path = "/healthz";
        if (scenario === "slow") run.symptom = "slow";
        f.store.saveIncidentRun(session.actorId, run);
        await assert.rejects(propose(f));
        assert.equal(f.counts.writes, 0);
      } finally {
        f.cleanup();
      }
    });
});

test("the transport fails closed with zero sends when either gate is off, and bounds an abort-ignoring send", async () => {
  const f = restartFixture();
  try {
    const action = await approved(f);
    assert.equal(action.spec.version, 6);
    if (action.spec.version !== 6) throw new Error("expected restart");
    let sends = 0;
    for (const config of [
      { ...f.config, enableMutations: false },
      { ...f.config, enableLiveLiara: false },
    ]) {
      const client = new LiaraRestartClient(config, async () => {
        sends++;
        return new Response(null);
      });
      await assert.rejects(
        client.restart(action.spec, new RunBudget(config), signal()),
        code("MUTATIONS_DISABLED"),
      );
    }
    assert.equal(sends, 0);
    const client = new LiaraRestartClient(f.config, () => {
      sends++;
      return new Promise<Response>(() => undefined);
    });
    const timer = setTimeout(() => undefined, 300);
    try {
      await assert.rejects(
        client.restart(action.spec, new RunBudget(f.config), AbortSignal.timeout(30)),
      );
    } finally {
      clearTimeout(timer);
    }
    assert.equal(sends, 1);
    assert.throws(() => parseActionSpec({ ...action.spec, sourceHash: "b".repeat(64) }));
    assert.throws(() => parseActionSpec({ ...action.spec, command: "do anything" }));
  } finally {
    f.cleanup();
  }
});

test("storage claim failure prevents the side effect and migration 7 preserves the first six checksums and old actions", async (t) => {
  const f = restartFixture();
  try {
    const old = f.store.createAction(session.actorId, {
      version: 1,
      operation: "restart",
      scope: { teamId: "a".repeat(24), app: "legacy-app" },
      sourceHash: null,
      args: { port: null, planId: null },
    });
    const checksums = f.store.db
      .prepare("SELECT * FROM schema_migrations WHERE version<=6 ORDER BY version")
      .all();
    f.store.db.exec("DROP TABLE restart_progress; DELETE FROM schema_migrations WHERE version=7;");
    f.reopen();
    assert.deepEqual(
      f.store.db.prepare("SELECT * FROM schema_migrations WHERE version<=6 ORDER BY version").all(),
      checksums,
    );
    assert.equal(f.store.getAction(old.id, session.actorId).hash, old.hash);
    assert.equal(f.store.db.prepare("SELECT COUNT(*) AS n FROM schema_migrations").get()?.n, 7);
    const action = await approved(f);
    t.mock.method(f.store, "claim", () => {
      throw new AppError("STORAGE_UNAVAILABLE", "synthetic storage failure", 503);
    });
    await assert.rejects(
      executeRestart(f.config, f.store, session, action.id, signal(), f.deps),
      code("STORAGE_UNAVAILABLE"),
    );
    assert.equal(f.counts.writes, 0);
    assert.equal(f.store.getAction(action.id, session.actorId).attemptId, null);
  } finally {
    f.cleanup();
  }
});

test("an older concurrent read cannot overwrite a newer same-page observation", async () => {
  const f = restartFixture();
  try {
    const action = await approved(f);
    await executeRestart(f.config, f.store, session, action.id, signal(), f.deps);
    let resume: () => void = () => undefined;
    const waiting = new Promise<void>((resolve) => {
      resume = resolve;
    });
    let entered: () => void = () => undefined;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let probes = 0;
    f.deps.probe = new WorkloadProbe(
      f.config,
      async () => [{ address: "93.184.216.34", family: 4 }],
      async () => {
        const ordinal = ++probes;
        if (ordinal === 1) {
          entered();
          await waiting;
        }
        return { status: ordinal === 1 ? 500 : 200, body: "bounded", bytes: 7, durationMs: 1 };
      },
    );
    const earlier = observeRestart(f.config, f.store, session, action.id, signal(), f.deps);
    await started;
    const newer = await observeRestart(f.config, f.store, session, action.id, signal(), f.deps);
    assert.equal(newer.restart?.observation?.status, 200);
    resume();
    await assert.rejects(earlier, code("EVIDENCE_MISMATCH"));
    assert.equal(f.store.getAction(action.id, session.actorId).restart?.observation?.status, 200);
    assert.equal(f.counts.writes, 1);
  } finally {
    f.cleanup();
  }
});

test("disabling service reads after acceptance prevents even an injected observer from calling upstream", async () => {
  const f = restartFixture();
  try {
    const action = await approved(f);
    await executeRestart(f.config, f.store, session, action.id, signal(), f.deps);
    const before = f.counts;
    await assert.rejects(observeRestart({ ...f.config, enableLiveLiara: false }, f.store, session, action.id, signal(), f.deps), code("LIVE_LIARA_DISABLED"));
    assert.deepEqual(f.counts, before);
    assert.equal(f.store.getAction(action.id, session.actorId).state, "observing");
  } finally { f.cleanup(); }
});
