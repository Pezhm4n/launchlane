import assert from "node:assert/strict";
import { test } from "node:test";
import {
  inWindow,
  parseDiagnosis,
  parseEvidenceBundle,
  verifySameSymptom,
} from "../../src/contracts/incident.ts";
import { BoxApiClient } from "../../src/server/agent/boxapi.ts";
import { readConfig } from "../../src/server/config.ts";
import { AppError } from "../../src/server/errors.ts";
import { collectEvidence } from "../../src/server/incident/collect.ts";
import { diagnose } from "../../src/server/incident/diagnose.ts";
import {
  practiceComparison,
  practiceEvidence,
  runPractice,
} from "../../src/server/incident/practice.ts";
import { LiaraReadClient } from "../../src/server/liara/client.ts";
import { WorkloadProbe } from "../../src/server/liara/probe.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";

const signal = () => new AbortController().signal;
const code = (expected: string) => (error: unknown) =>
  error instanceof AppError && error.code === expected;
const evidence = practiceEvidence("configuration");
const config = readConfig({
  LIARA_TEAM_ID: evidence.scope.teamId,
  LAUNCHLANE_APP_ALLOWLIST: evidence.scope.app,
  MODEL_API_KEY: "synthetic-key",
  MODEL_ID: "gpt-6-luna",
});
const answer = {
  summary: "فرضیه پیکربندی؛ هنوز نیاز به بررسی دارد.",
  hypotheses: [
    {
      category: "configuration",
      explanation: "ممکن است متغیر خالی باشد.",
      evidenceIds: ["workload-1", "logs-1"],
      nextCheck: "مقدار را بدون نمایش بررسی کنید.",
    },
  ],
};
const tool = {
  choices: [
    {
      finish_reason: "tool_calls",
      message: {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "read_1",
            type: "function",
            function: {
              name: "get_service_evidence",
              arguments: JSON.stringify({ app: evidence.scope.app }),
            },
          },
        ],
      },
    },
  ],
};
const completed = (value: unknown) => ({
  choices: [
    { finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(value) } },
  ],
  usage: { total_tokens: 12 },
});

test("the bounded diagnosis workflow uses a scoped tool result, not an invented terminal answer", async () => {
  let calls = 0;
  const client = new BoxApiClient({ ...config, enableLiveModel: true }, async (_url, init) => {
    calls++;
    const body = JSON.parse(String(init.body));
    if (calls === 2) {
      const result = body.messages.at(-1);
      assert.equal(result.tool_call_id, "read_1");
      assert.equal(JSON.parse(result.content).mode, "simulated");
      assert.match(body.messages[0].content, /untrusted data/);
    }
    return Response.json(calls === 1 ? tool : completed(answer));
  });
  const budget = new RunBudget(config),
    result = await diagnose(evidence, client, budget, signal());
  assert.equal(result.status, "hypotheses");
  assert.equal(calls, 2);
  assert.equal(budget.toolCalls, 1);
  assert.ok(result.limitations.some((value) => value.includes("metrics-1")));
  assert.ok(!("confidence" in result) && !("approved" in result));
});

test("wrong citations, stale logs, unknown metrics and injected write fields cannot authorize a diagnosis", () => {
  for (const id of ["made-up", "metrics-1"])
    assert.throws(
      () =>
        parseDiagnosis(
          { ...answer, hypotheses: [{ ...answer.hypotheses[0], evidenceIds: [id] }] },
          evidence,
        ),
      code("DIAGNOSIS_UNGROUNDED"),
    );
  const stale = structuredClone(evidence);
  const staleLog = stale.entries[1];
  assert.ok(staleLog);
  staleLog.at = stale.window.start - 1;
  assert.throws(() => parseDiagnosis(answer, stale), code("DIAGNOSIS_UNGROUNDED"));
  assert.throws(
    () => parseDiagnosis({ ...answer, approved: true, tool: "restart" }, evidence),
    code("INVALID_INPUT"),
  );
  const duplicate = structuredClone(evidence);
  const duplicateLog = duplicate.entries[1];
  assert.ok(duplicateLog);
  duplicateLog.id = "workload-1";
  assert.throws(() => parseEvidenceBundle(duplicate), code("EVIDENCE_INVALID"));
});

test("model bypass, repeated tool use, cancellation and exhaustion terminate without a fallback", async () => {
  const direct = new BoxApiClient({ ...config, enableLiveModel: true }, async () =>
    Response.json(completed(answer)),
  );
  await assert.rejects(
    diagnose(evidence, direct, new RunBudget(config), signal()),
    code("DIAGNOSIS_UNGROUNDED"),
  );
  let calls = 0;
  const repeated = new BoxApiClient({ ...config, enableLiveModel: true }, async () => {
    calls++;
    return Response.json(tool);
  });
  await assert.rejects(
    diagnose(evidence, repeated, new RunBudget(config), signal()),
    code("TOOL_REPEAT_DENIED"),
  );
  assert.equal(calls, 2);
  const limited = { ...config, enableLiveModel: true, maxModelCalls: 1 };
  const once = new BoxApiClient(limited, async () => Response.json(tool));
  await assert.rejects(
    diagnose(evidence, once, new RunBudget(limited), signal()),
    code("BUDGET_EXHAUSTED"),
  );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    diagnose(evidence, direct, new RunBudget(config), controller.signal),
    code("CANCELLED"),
  );
});

test("a healthy different path, app, host, time or evidence mode never resolves the original symptom", () => {
  const correct = practiceComparison("configuration", "related");
  assert.equal(correct.verification.outcome, "verified");
  assert.equal(
    practiceComparison("configuration", "unrelated").verification.outcome,
    "still_failing",
  );
  for (const kind of ["path", "app", "host", "time", "mode"] as const) {
    const other = structuredClone(correct.after),
      item = other.entries[0];
    assert.ok(item);
    if (kind === "path" && item.fact?.kind === "http") item.fact.path = "/healthz";
    if (kind === "app") other.scope = { ...other.scope, app: "other" };
    if (kind === "host" && item.fact?.kind === "http")
      item.fact.origin = "https://other.example.com";
    if (kind === "time") item.at = correct.before.entries[0]?.at ?? null;
    if (kind === "mode") other.mode = "provider_contract";
    assert.equal(verifySameSymptom(correct.before, other).outcome, "inconclusive", kind);
  }
});

test("offline practice is explicitly scripted; contradictory and unavailable logs stay uncertain", async () => {
  for (const scenario of ["configuration", "contradictory", "insufficient"] as const) {
    const result = await runPractice(scenario, signal());
    assert.equal(result.providerRequests, 0);
    assert.equal(result.analysis, "scripted");
    assert.equal(result.evidence.mode, "simulated");
    assert.equal(
      result.diagnosis.status,
      scenario === "configuration" ? "hypotheses" : "insufficient_evidence",
    );
    if (scenario !== "configuration")
      assert.equal(practiceComparison(scenario, "related").verification.outcome, "still_failing");
  }
});

test("collection preserves partial errors, unknown units, stale log times and current release independently", async () => {
  const active = {
    ...config,
    enableLiveLiara: true,
    liaraToken: "synthetic-paas",
    probeOrigins: { [evidence.scope.app]: "https://practice-node.example.com" },
  };
  const client = new LiaraReadClient(active, async (url) => {
    const path = new URL(url).pathname;
    if (path.endsWith("/logs"))
      return Response.json([{ datetime: "2020-01-01T00:00:00Z", message: "old CONFIG_REQUIRED" }]);
    if (path.endsWith("/releases"))
      return Response.json({
        total: 8,
        currentRelease: "release-active",
        releases: [{ _id: "release-active", state: "READY" }],
      });
    if (path.endsWith("/events")) return new Response(null, { status: 401 });
    if (path.endsWith("/applets")) return Response.json({ applets: [] });
    if (path.endsWith("/summary")) return Response.json({ cpuUsage: null, memoryUsage: [] });
    return Response.json({
      project: {
        _id: "project-id",
        project_id: evidence.scope.app,
        type: "node",
        status: "Running",
        envs: [],
      },
    });
  });
  const probe = new WorkloadProbe(
    active,
    async () => [{ address: "93.184.216.34", family: 4 }],
    async () => ({ status: 500, body: "failed", bytes: 6, durationMs: 12 }),
  );
  const now = Date.now();
  const result = await collectEvidence(
    client,
    probe,
    {
      scope: evidence.scope,
      start: now - 300_000,
      end: now + 10_000,
      since: "documentary-since",
      path: "/",
    },
    new RunBudget(active),
    signal(),
  );
  assert.equal(new Set(result.entries.map((item) => item.id)).size, result.entries.length);
  assert.equal(result.entries.find((item) => item.source === "events")?.code, "PROVIDER_AUTH");
  assert.equal(result.entries.find((item) => item.source === "metrics")?.state, "unknown");
  assert.ok(
    result.entries.find((item) => item.source === "releases")?.summary.includes("release-active"),
  );
  const logs = result.entries.find((item) => item.source === "logs");
  assert.equal(logs?.at, Date.parse("2020-01-01T00:00:00Z"));
});

test("collection fences the selected app identity before reading evidence and again before returning it", async () => {
  const active = {
    ...config,
    enableLiveLiara: true,
    liaraToken: "synthetic-paas",
    probeOrigins: { [evidence.scope.app]: "https://practice-node.example.com" },
  };
  for (const changedAt of ["before", "during", "never", "historical"] as const) {
    let projectReads = 0,
      otherReads = 0,
      probes = 0;
    const client = new LiaraReadClient(active, async (url, init) => {
      assert.equal(init.method, "GET");
      const path = new URL(url).pathname;
      if (path === `/v1/projects/${evidence.scope.app}`) {
        projectReads++;
        return Response.json({
          project: {
            _id:
              changedAt === "before" || (changedAt === "during" && projectReads > 1)
                ? "recreated-app"
                : "selected-app-id",
            project_id: evidence.scope.app,
            type: "node",
            status: "Running",
            envs: [],
          },
        });
      }
      otherReads++;
      if (path.endsWith("/logs")) return Response.json([]);
      if (path.endsWith("/events")) return Response.json({ data: [] });
      if (path.endsWith("/releases"))
        return Response.json({ total: 0, currentRelease: null, releases: [] });
      if (path.endsWith("/applets")) return Response.json({ applets: [] });
      return Response.json({ cpuUsage: null, memoryUsage: [] });
    });
    const probe = new WorkloadProbe(
      active,
      async () => [{ address: "93.184.216.34", family: 4 }],
      async () => {
        probes++;
        return { status: 500, body: "failed", bytes: 6, durationMs: 12 };
      },
    );
    const now = Date.now(),
      end = changedAt === "historical" ? now - 300_000 : now + 10_000,
      budget = new RunBudget(active),
      result = collectEvidence(
        client,
        probe,
        {
          scope: evidence.scope,
          expectedAppId: "selected-app-id",
          start: end - 300_000,
          end,
          since: new Date(end - 300_000).toISOString(),
          path: "/orders",
        },
        budget,
        signal(),
      );
    if (changedAt === "never" || changedAt === "historical") {
      const snapshot = await result;
      assert.equal(snapshot.scope.app, evidence.scope.app);
      assert.equal(projectReads, 2);
      assert.equal(budget.toolCalls, 8);
      if (changedAt === "historical") {
        assert.equal(snapshot.window.end, end, "an explicit historical window is never renewed");
        const workload = snapshot.entries.find((entry) => entry.source === "workload");
        assert.ok(workload);
        assert.equal(inWindow(workload, snapshot), false);
        assert.equal(
          parseDiagnosis({ summary: "داده کافی نیست", hypotheses: [] }, snapshot).status,
          "insufficient_evidence",
        );
      }
    } else await assert.rejects(result, code("SCOPE_MISMATCH"), changedAt);
    if (changedAt === "before") {
      assert.equal(projectReads, 1);
      assert.equal(otherReads, 0);
      assert.equal(probes, 0);
    }
  }
});
