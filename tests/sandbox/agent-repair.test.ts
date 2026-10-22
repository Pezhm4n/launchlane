import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { object } from "../../src/contracts/validation.ts";
import { GoalModelClient, type FunctionCall } from "../../src/server/agent/model.ts";
import { createAgentRun, decideAgentRepair, driveAgentRun } from "../../src/server/agent/runs.ts";
import { AgentRepository } from "../../src/server/agent/store.ts";
import { AppError } from "../../src/server/errors.ts";
import { readArtifact } from "../../src/server/workspace/archive.ts";
import { agentFixture, repairBrokenSource, repairCorrectSource } from "../helpers/agent-fixture.ts";

function tool(name: string, args: unknown = {}) {
  const call: FunctionCall = {
    id: randomUUID(),
    type: "function",
    function: { name, arguments: JSON.stringify(args) },
  };
  return Response.json({
    choices: [{ finish_reason: "tool_calls", message: { role: "assistant", tool_calls: [call] } }],
    usage: { total_tokens: 40 },
  });
}
function scriptedModel(f: Awaited<ReturnType<typeof agentFixture>>, wrongPatch = false) {
  let requests = 0,
    main = 0;
  const model = new GoalModelClient(f.config, async (_url, init) => {
    requests++;
    const body = object(JSON.parse(String(init.body)));
    assert.ok(Array.isArray(body.tools));
    if (JSON.stringify(body.tools).includes('"submit_patch"')) {
      assert.ok(Array.isArray(body.messages));
      const request = object(JSON.parse(String(object(body.messages.at(-1)).content)));
      return tool("submit_patch", {
        baseRevision: request.baseRevision,
        files: [
          {
            path: "invoice.mjs",
            beforeHash: createHash("sha256").update(repairBrokenSource).digest("hex"),
            content: wrongPatch
              ? repairBrokenSource.replace("line.price", "line.price + 1")
              : repairCorrectSource,
          },
        ],
      });
    }
    main++;
    if (main === 1) return tool("inspect_project");
    if (main === 2) return tool("read_project_file", { path: "invoice.mjs" });
    if (main === 3) return tool("read_project_file", { path: "invoice.test.mjs" });
    if (main === 4)
      return tool("propose_code_repair", {
        goal: "تعداد هر کالا در جمع فاکتور اعمال شود.",
        allowedPaths: ["invoice.mjs"],
        testFiles: ["invoice.test.mjs"],
      });
    assert.ok(
      Array.isArray(body.messages) &&
        body.messages.some((message) =>
          String(object(message).content).includes('"afterPassed":true'),
        ),
    );
    return Response.json({
      choices: [
        {
          finish_reason: "stop",
          message: {
            role: "assistant",
            content: JSON.stringify({
              state: "partially_completed",
              message: "نسخه جدا آزمون را گذراند. انتشار انجام نشده است.",
              question: null,
              nextAction: "reply",
            }),
          },
        },
      ],
      usage: { total_tokens: 30 },
    });
  });
  return { model, requests: () => requests };
}
async function proposed(f: Awaited<ReturnType<typeof agentFixture>>) {
  f.config.enableLocalRepair = true;
  const scripted = scriptedModel(f),
    created = createAgentRun(
      f.config,
      f.store,
      f.session,
      randomUUID(),
      "خطای محاسبه فاکتور را بررسی و اصلاح کن",
      f.flow.id,
    );
  await driveAgentRun(f.config, f.store, f.session, created.run.id, { model: scripted.model });
  const repo = new AgentRepository(f.store),
    run = repo.get(f.session.actorId, created.run.id);
  assert.ok(
    run?.repair,
    JSON.stringify({
      error: run?.errorCode,
      tool: run?.messages.filter((message) => message.role === "tool").at(-1),
    }),
  );
  assert.equal(run.state, "needs_approval");
  assert.equal(run.repair.state, "proposed");
  assert.equal(run.repair.beforeTest, null);
  assert.equal(run.repair.afterTest, null);
  assert.equal(scripted.requests(), 4);
  return { run, repo, jobId: run.repair.id, ...scripted };
}
const errorCode = (code: string) => (error: unknown) =>
  error instanceof AppError && error.code === code;

test("a local-work decision that expires in the queue cannot start a container", async () => {
  const f = await agentFixture();
  try {
    const p = await proposed(f);
    const queued = await decideAgentRepair(f.config, f.store, f.session, p.run.id, p.run.revision, p.jobId, "approve");
    assert.ok(queued.repairDecision); queued.repairDecision.expiresAt = 0;
    p.repo.save(f.session.actorId, queued);
    await driveAgentRun(f.config, f.store, f.session, queued.id, { model: p.model });
    const result = p.repo.get(f.session.actorId, queued.id);
    assert.equal(result?.errorCode, "REPAIR_APPROVAL_EXPIRED"); assert.equal(result?.state, "failed");
    assert.deepEqual(result?.repair?.containerIds, []); assert.equal(result?.repair?.beforeTest, null);
    assert.equal(readFileSync(join(f.project, "invoice.mjs"), "utf8"), repairBrokenSource);
  } finally { f.close(); }
});

test("an approved agent repair executes actual tests and selects exactly the tested artifact under the same cumulative budget", async () => {
  const f = await agentFixture();
  try {
    const p = await proposed(f);
    for (let i = 0; i < 3; i++)
      assert.equal(p.repo.get(f.session.actorId, p.run.id)?.repair?.beforeTest, null);
    assert.equal(p.requests(), 4);
    const queued = await decideAgentRepair(
      f.config,
      f.store,
      f.session,
      p.run.id,
      p.run.revision,
      p.jobId,
      "approve",
    );
    await assert.rejects(
      () =>
        decideAgentRepair(
          f.config,
          f.store,
          f.session,
          p.run.id,
          p.run.revision,
          p.jobId,
          "approve",
        ),
      errorCode("AGENT_CONFLICT"),
    );
    await driveAgentRun(f.config, f.store, f.session, queued.id, { model: p.model });
    const result = p.repo.get(f.session.actorId, queued.id);
    assert.ok(result?.repair?.artifact);
    assert.equal(
      result.state,
      "partially_completed",
      JSON.stringify({
        error: result.errorCode,
        event: result.events.at(-1),
        repair: result.repair,
      }),
    );
    assert.equal(result.repair.state, "succeeded");
    assert.equal(result.repair.beforeTest?.passed, false);
    assert.equal(result.repair.afterTest?.passed, true);
    assert.equal(result.usage.modelCalls, 6);
    assert.equal(result.usage.toolCalls, 6);
    assert.equal(result.usage.unknownModelCalls, 0);
    assert.equal(p.requests(), 6);
    assert.equal(result.effect, "no_remote_changes");
    const selected = f.store.getProjectFlow(f.session.actorId);
    assert.equal(selected?.id, result.projectId);
    assert.equal(selected?.selection.kind, "repair");
    assert.equal(selected?.artifact?.archiveHash, result.repair.artifact.archiveHash);
    assert.ok((await readArtifact(f.config.stateDir, result.repair.artifact)).length > 0);
    assert.equal(readFileSync(join(f.project, "invoice.mjs"), "utf8"), repairBrokenSource);
    assert.equal(f.store.db.prepare("SELECT COUNT(*) AS count FROM attempts").get()?.count, 0);
  } finally {
    f.close();
  }
});

test("reject, expired approval, different session, changed source and closed gate never execute the queued repair", async () => {
  for (const boundary of ["reject", "expiry", "session", "source", "gate"] as const) {
    const f = await agentFixture();
    try {
      const p = await proposed(f);
      assert.ok(p.run.repair);
      if (boundary === "expiry") {
        assert.ok(p.run.repairDecision);
        p.run.repairDecision.expiresAt = Date.now() - 1;
        p.repo.save(f.session.actorId, p.run);
      }
      if (boundary === "source")
        writeFileSync(join(f.project, "invoice.mjs"), "// externally changed\n");
      if (boundary === "gate") f.config.enableLocalRepair = false;
      if (boundary === "reject") {
        const rejected = await decideAgentRepair(
          f.config,
          f.store,
          f.session,
          p.run.id,
          p.run.revision,
          p.run.repair.id,
          "reject",
        );
        assert.equal(rejected.state, "needs_input");
        assert.equal(rejected.repair?.state, "cancelled");
      } else {
        await assert.rejects(
          () =>
            decideAgentRepair(
              f.config,
              f.store,
              boundary === "session" ? { ...f.session, id: "other-session" } : f.session,
              p.run.id,
              p.run.revision,
              p.jobId,
              "approve",
            ),
          errorCode(
            boundary === "source"
              ? "PROJECT_CHANGED"
              : boundary === "gate"
                ? "REPAIR_DISABLED"
                : "REPAIR_APPROVAL_EXPIRED",
          ),
        );
      }
      await driveAgentRun(f.config, f.store, f.session, p.run.id, { model: p.model });
      assert.equal(p.requests(), 4);
      assert.equal(p.repo.get(f.session.actorId, p.run.id)?.repair?.beforeTest, null);
      assert.equal(f.store.getProjectFlow(f.session.actorId)?.id, f.flow.id);
    } finally {
      f.close();
    }
  }
});

test("a wrong worker patch fails the same existing test and cannot select a replacement project", async () => {
  const f = await agentFixture();
  try {
    const p = await proposed(f),
      bad = scriptedModel(f, true);
    await decideAgentRepair(
      f.config,
      f.store,
      f.session,
      p.run.id,
      p.run.revision,
      p.jobId,
      "approve",
    );
    await driveAgentRun(f.config, f.store, f.session, p.run.id, { model: bad.model });
    const result = p.repo.get(f.session.actorId, p.run.id);
    assert.equal(result?.state, "failed");
    assert.equal(result?.repair?.afterTest?.passed, false);
    assert.equal(result?.repair?.artifact, null);
    assert.equal(f.store.getProjectFlow(f.session.actorId)?.id, f.flow.id);
    assert.equal(result?.usage.modelCalls, 5);
  } finally {
    f.close();
  }
});
