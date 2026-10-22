import assert from "node:assert/strict";
import { test } from "node:test";
import { inWindow, parseEvidenceBundle, verifySameSymptom } from "../../src/contracts/incident.ts";
import { readConfig } from "../../src/server/config.ts";
import { sealCredential } from "../../src/server/connections/credentials.ts";
import { AppError } from "../../src/server/errors.ts";
import { practiceEvidence } from "../../src/server/incident/practice.ts";
import { compareLatency, summarizeLatency } from "../../src/contracts/latency.ts";
import { createIncidentHandoff } from "../../src/server/incident/handoff.ts";
import {
  analyzeIncidentRun,
  comparePracticeRun,
  createLiveIncidentRun,
  createPracticeRun,
  recheckIncidentRun,
} from "../../src/server/incident/runs.ts";
import { Store } from "../../src/server/persistence/store.ts";
import { WorkloadProbe } from "../../src/server/liara/probe.ts";
import type { ModelTurn } from "../../src/server/agent/boxapi.ts";
const scope = { teamId: "a".repeat(24), app: "sample-app" },
  origin = "https://sample.example.com",
  token = "synthetic-liara-secret-for-tests";
const code = (expected: string) => (error: unknown) =>
  error instanceof AppError && error.code === expected;
const signal = () => AbortSignal.timeout(3000);
function fixture() {
  const store = new Store(":memory:"),
    config = readConfig({
      LIARA_TEAM_ID: scope.teamId,
      LAUNCHLANE_APP_ALLOWLIST: scope.app,
      LAUNCHLANE_SESSION_SECRET: "synthetic-root-".repeat(4),
      LAUNCHLANE_ENABLE_LIVE_LIARA: "true",
      LAUNCHLANE_ENABLE_LIVE_MODEL: "true",
      MODEL_API_KEY: "synthetic-model-key-never-real",
      MODEL_ID: "gpt-6-luna",
    });
  store.saveConnection("alice", {
    source: "token",
    ciphertext: sealCredential(token, config.sessionSecret, "alice", "liara"),
    view: {
      provider: "liara",
      status: "connected",
      identityId: "synthetic-user",
      displayName: "حساب آزمون",
      login: "synthetic@example.test",
      checkedAt: Date.now(),
      teamId: scope.teamId,
      teamName: "تیم آزمون",
      selectedApp: scope.app,
      apps: [{ id: "synthetic-app", name: scope.app, platform: "node" }],
    },
  });
  store.setProbeOrigin("alice", scope, origin);
  return { store, config };
}
function evidence(now = Date.now(), status = 500, host = origin) {
  const base = practiceEvidence("configuration", now);
  return parseEvidenceBundle({
    ...base,
    mode: "provider_contract",
    scope,
    entries: base.entries.map((entry) =>
      entry.fact?.kind === "http"
        ? { ...entry, fact: { ...entry.fact, origin: host, status, durationMs: 22 } }
        : entry.fact?.kind === "log"
          ? {
              ...entry,
              fact: {
                kind: "log",
                message: `CONFIG_REQUIRED: WELCOME_MESSAGE is missing; API_KEY=${token}`,
              },
            }
          : entry,
    ),
  });
}
const input = {
  app: scope.app,
  symptom: "errors" as const,
  problem: "صفحه اصلی خطای سرور دارد",
  path: "/",
};

test("a saved latency sample restores all measurements, isolates actors and exports a cautious same-page comparison without internal fingerprints", async () => {
  const store = new Store(":memory:");
  try {
    const run = await createPracticeRun(store, "alice", "latency", signal());
    assert.equal(run.symptom, "slow");
    const restored = store.getIncidentRun("alice", run.id);
    assert.ok(restored);
    assert.equal(summarizeLatency(restored.evidence).state, "complete");
    assert.equal(store.getIncidentRun("bob", run.id), null);
    const unchanged = comparePracticeRun(store, "alice", run.id, "unrelated");
    assert.ok(unchanged.after);
    assert.equal(compareLatency(run.evidence, unchanged.after).outcome, "overlapping");
    const faster = comparePracticeRun(store, "alice", run.id, "related");
    assert.ok(faster.after);
    assert.equal(compareLatency(run.evidence, faster.after).outcome, "lower_observed");
    assert.equal(verifySameSymptom(run.evidence, faster.after).outcome, "inconclusive");
    const exported = createIncidentHandoff(readConfig({}), store, "alice", run.id).markdown;
    assert.match(exported, /میلی‌ثانیه/);
    assert.match(exported, /رفع پایدار کندی تأیید نشده/);
    assert.ok(!exported.includes("a".repeat(64)));
    assert.ok(!exported.includes("practice-app"));
  } finally { store.close(); }
});

test("the default incident reader retains a fresh business-path symptom after a slow authorized read", async (t) => {
  const f = fixture(),
    now = Date.now();
  t.mock.timers.enable({ apis: ["Date"], now });
  let projectReads = 0;
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.equal(init.method, "GET");
    const target = new URL(url);
    assert.equal(target.origin, "https://api.liara.ir");
    assert.equal(target.searchParams.get("teamID"), scope.teamId);
    if (target.pathname === `/v1/projects/${scope.app}`) {
      projectReads++;
      if (projectReads === 1) t.mock.timers.tick(20_000);
      return Response.json({
        project: {
          _id: "synthetic-app",
          project_id: scope.app,
          type: "node",
          status: "Running",
          envs: [],
        },
      });
    }
    if (target.pathname.endsWith("/logs")) return Response.json([]);
    if (target.pathname.endsWith("/events")) return Response.json({ data: [] });
    if (target.pathname.endsWith("/releases"))
      return Response.json({ total: 0, currentRelease: null, releases: [] });
    if (target.pathname.endsWith("/applets")) return Response.json({ applets: [] });
    return Response.json({ cpuUsage: null, memoryUsage: [] });
  });
  t.mock.method(WorkloadProbe.prototype, "check", async () => {
    await Promise.resolve();
    return {
      scope,
      origin,
      path: "/orders",
      status: 500,
      outcome: "response",
      observedAt: Date.now(),
      durationMs: 12,
      body: "failed",
      bytes: 6,
    };
  });
  try {
    const run = await createLiveIncidentRun(
      f.config,
      f.store,
      "alice",
      { ...input, path: "/orders" },
      signal(),
    );
    const symptom = run.evidence.entries.find((entry) => entry.fact?.kind === "http");
    assert.ok(symptom);
    assert.equal(inWindow(symptom, run.evidence), true);
    assert.equal(run.evidence.collectedAt, now + 20_000);
    assert.equal(run.evidence.window.end, run.evidence.collectedAt);
    assert.equal(projectReads, 2);
    assert.equal(run.appId, "synthetic-app");
  } finally {
    f.store.close();
  }
});

test("incident practice is actor-bound and its persisted comparison uses the original observation", async () => {
  const store = new Store(":memory:");
  try {
    const run = await createPracticeRun(store, "alice", "configuration", signal());
    assert.equal(store.getIncidentRun("bob", run.id), null);
    assert.equal(store.getIncidentRun("alice", undefined, "live"), null);
    assert.throws(() => comparePracticeRun(store, "bob", run.id, "related"), code("NOT_FOUND"));
    const wrong = comparePracticeRun(store, "alice", run.id, "unrelated");
    assert.ok(wrong.after);
    assert.equal(verifySameSymptom(run.evidence, wrong.after).outcome, "still_failing");
    const right = comparePracticeRun(store, "alice", run.id, "related");
    assert.ok(right.after);
    assert.equal(right.evidence.collectedAt, run.evidence.collectedAt);
    assert.equal(verifySameSymptom(run.evidence, right.after).outcome, "verified");
    assert.equal(right.analysis, "scripted");
  } finally {
    store.close();
  }
});
test("real incident entry validates access and fixed targets, redacts persisted evidence and never sends a disabled request", async () => {
  const f = fixture();
  let reads = 0;
  const reader = async () => {
    reads++;
    return evidence();
  };
  try {
    await assert.rejects(
      createLiveIncidentRun(
        { ...f.config, enableLiveLiara: false },
        f.store,
        "alice",
        input,
        signal(),
        reader,
      ),
      code("LIVE_LIARA_DISABLED"),
    );
    assert.equal(reads, 0);
    await assert.rejects(
      createLiveIncidentRun(f.config, f.store, "bob", input, signal(), reader),
      code("LIARA_AUTH_REQUIRED"),
    );
    assert.equal(reads, 0);
    await assert.rejects(
      createLiveIncidentRun(
        f.config,
        f.store,
        "alice",
        { ...input, problem: `API_KEY=${token}` },
        signal(),
        reader,
      ),
      code("INCIDENT_SENSITIVE_INPUT"),
    );
    assert.equal(reads, 0);
    await assert.rejects(
      createLiveIncidentRun(
        f.config,
        f.store,
        "alice",
        { ...input, path: "https://different.example.com/" },
        signal(),
        reader,
      ),
      code("INCIDENT_PATH_INVALID"),
    );
    assert.equal(reads, 0);
    const run = await createLiveIncidentRun(f.config, f.store, "alice", input, signal(), reader);
    assert.equal(reads, 1);
    assert.equal(run.analysis, "ready");
    assert.ok(!JSON.stringify(run).includes(token));
    assert.ok(
      !JSON.stringify(f.store.db.prepare("SELECT * FROM incident_runs").all()).includes(token),
    );
    const http = run.evidence.entries.find((row) => row.fact?.kind === "http")?.fact;
    assert.equal(http?.kind === "http" ? http.durationMs : null, 22);
    await assert.rejects(
      createLiveIncidentRun(f.config, f.store, "alice", input, signal(), async () =>
        evidence(Date.now(), 500, "https://wrong.example.com"),
      ),
      code("EVIDENCE_MISMATCH"),
    );
  } finally {
    f.store.close();
  }
});
test("analysis claim is durable before the first model request and duplicate, disabled or interrupted analysis cannot replay", async () => {
  const f = fixture();
  let calls = 0;
  try {
    const run = await createLiveIncidentRun(f.config, f.store, "alice", input, signal(), async () =>
      evidence(),
    );
    const client = {
      async complete(
        messages: readonly { role: string }[],
        budget: { take: (kind: "model", signal: AbortSignal) => void },
        requestSignal: AbortSignal,
      ): Promise<ModelTurn> {
        budget.take("model", requestSignal);
        calls++;
        assert.equal(f.store.getIncidentRun("alice", run.id)?.analysis, "pending");
        return messages.some((row) => row.role === "tool")
          ? {
              state: "completed",
              content: JSON.stringify({
                summary: "تنظیمات باید بررسی شوند",
                hypotheses: [
                  {
                    category: "configuration",
                    explanation: `پیام برنامه مرتبط است؛ secret=${token}`,
                    evidenceIds: ["logs-1", "workload-1"],
                    nextCheck: "وجود تنظیمات را بررسی کنید",
                  },
                ],
              }),
              usage: 10,
            }
          : {
              state: "tool_calls",
              calls: [
                { id: "read-evidence", name: "get_service_evidence", args: { app: scope.app } },
              ],
              usage: 10,
            };
      },
    };
    await assert.rejects(
      analyzeIncidentRun(
        { ...f.config, enableLiveModel: false },
        f.store,
        "alice",
        run.id,
        signal(),
        client,
      ),
      code("ANALYSIS_UNAVAILABLE"),
    );
    assert.equal(calls, 0);
    const running = analyzeIncidentRun(f.config, f.store, "alice", run.id, signal(), client);
    await assert.rejects(
      analyzeIncidentRun(f.config, f.store, "alice", run.id, signal(), client),
      code("INCIDENT_ANALYSIS_CONFLICT"),
    );
    const completed = await running;
    assert.equal(completed.analysis, "model");
    assert.equal(calls, 2);
    assert.ok(!JSON.stringify(completed).includes(token));
    const cancelled = await createLiveIncidentRun(
      f.config,
      f.store,
      "alice",
      input,
      signal(),
      async () => evidence(),
    );
    const controller = new AbortController();
    await assert.rejects(
      analyzeIncidentRun(f.config, f.store, "alice", cancelled.id, controller.signal, {
        complete: async () => {
          controller.abort();
          return { state: "completed", content: "late response", usage: null };
        },
      }),
      code("CANCELLED"),
    );
    assert.equal(f.store.getIncidentRun("alice", cancelled.id)?.analysis, "failed");
    await assert.rejects(
      analyzeIncidentRun(f.config, f.store, "alice", run.id, signal(), client),
      code("INCIDENT_ANALYSIS_CONFLICT"),
    );
    assert.equal(calls, 2);
    const next = await createLiveIncidentRun(
      f.config,
      f.store,
      "alice",
      input,
      signal(),
      async () => evidence(),
    );
    f.store.claimIncidentAnalysis("alice", next.id);
    f.store.recoverInterrupted();
    assert.equal(f.store.getIncidentRun("alice", next.id)?.analysis, "failed");
    await assert.rejects(
      analyzeIncidentRun(f.config, f.store, "alice", next.id, signal(), client),
      code("INCIDENT_ANALYSIS_CONFLICT"),
    );
    assert.equal(calls, 2);
  } finally {
    f.store.close();
  }
});
test("recheck preserves the same app, page and approved host and rejects changed destinations before transport", async () => {
  const f = fixture();
  let reads = 0;
  try {
    const before = evidence(),
      run = await createLiveIncidentRun(
        f.config,
        f.store,
        "alice",
        input,
        signal(),
        async () => before,
      );
    const checked = await recheckIncidentRun(
      f.config,
      f.store,
      "alice",
      run.id,
      signal(),
      async (_config, request) => {
        reads++;
        assert.equal(request.app, input.app);
        assert.equal(request.path, input.path);
        return evidence(before.collectedAt + 1000, 200);
      },
    );
    assert.ok(checked.after);
    assert.equal(verifySameSymptom(checked.evidence, checked.after).outcome, "verified");
    await assert.rejects(
      analyzeIncidentRun(f.config, f.store, "alice", checked.id, signal(), {
        complete: async () => {
          throw new Error("must not call");
        },
      }),
      code("INCIDENT_CHANGED"),
    );
    f.store.setProbeOrigin("alice", scope, "https://new.example.com");
    await assert.rejects(
      recheckIncidentRun(f.config, f.store, "alice", run.id, signal(), async () => {
        reads++;
        return evidence();
      }),
      code("INCIDENT_TARGET_CHANGED"),
    );
    assert.equal(reads, 1);
    assert.throws(() => f.store.setProbeOrigin("bob", scope, origin), code("SCOPE_DENIED"));
    f.store.setProbeOrigin("alice", scope, origin);
    const saved = f.store.getConnection("alice", "liara");
    assert.ok(saved);
    f.store.saveConnection("alice", {
      ...saved,
      view: { ...saved.view, apps: [{ id: "recreated-app", name: scope.app, platform: "node" }] },
    });
    await assert.rejects(
      recheckIncidentRun(f.config, f.store, "alice", run.id, signal(), async () => {
        reads++;
        return evidence();
      }),
      code("SCOPE_DENIED"),
    );
    assert.throws(() => f.store.claimIncidentAnalysis("alice", run.id), code("SCOPE_DENIED"));
    assert.equal(reads, 1);
    assert.throws(
      () => f.store.setProbeOrigin("alice", scope, "http://127.0.0.1"),
      code("CONFIG_INVALID"),
    );
  } finally {
    f.store.close();
  }
});
