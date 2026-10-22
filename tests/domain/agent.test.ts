import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { object } from "../../src/contracts/validation.ts";
import { GoalModelClient, type FunctionCall } from "../../src/server/agent/model.ts";
import {
  createAgentRun,
  driveAgentRun,
  continueAgentRun,
  cancelAgentRun,
} from "../../src/server/agent/runs.ts";
import { AgentRepository, agentView } from "../../src/server/agent/store.ts";
import { AppError } from "../../src/server/errors.ts";
import { agentFixture } from "../helpers/agent-fixture.ts";

const call = (name: string, args: unknown = {}, id = randomUUID()): FunctionCall => ({
  id,
  type: "function",
  function: { name, arguments: JSON.stringify(args) },
});
const toolResponse = (calls: FunctionCall[]) =>
  Response.json({
    choices: [{ finish_reason: "tool_calls", message: { role: "assistant", tool_calls: calls } }],
    usage: { total_tokens: 70 },
  });
const finalResponse = (nextAction = "connect_account") =>
  Response.json({
    choices: [
      {
        finish_reason: "stop",
        message: {
          role: "assistant",
          content: JSON.stringify({
            state: "needs_input",
            message: "فایل‌های پروژه بررسی شدند؛ انتشار انجام نشده است.",
            question: "حساب مقصد را متصل کنید.",
            nextAction,
          }),
        },
      },
    ],
    usage: { total_tokens: 50 },
  });
const code = (expected: string) => (error: unknown) =>
  error instanceof AppError && error.code === expected;

test("the goal loop reads actual project results, branches to a file only when incomplete, and persists correlated tool receipts", async () => {
  for (const incomplete of [false, true]) {
    const f = await agentFixture(incomplete),
      names: string[] = [];
    try {
      const model = new GoalModelClient(f.config, async (_url, init) => {
        const request = object(JSON.parse(String(init.body)));
        assert.ok(!JSON.stringify(request).includes("private-local-fixture-value"));
        assert.equal(request.parallel_tool_calls, false);
        assert.ok(Array.isArray(request.messages));
        const last = object(request.messages.at(-1));
        if (last.role === "user") {
          names.push("inspect_project");
          return toolResponse([call("inspect_project")]);
        }
        assert.equal(last.role, "tool");
        const result = object(JSON.parse(String(last.content)));
        const data = object(result.data);
        if ("runtime" in data) {
          const next = data.start ? "read_destination" : "read_project_file";
          names.push(next);
          return toolResponse([
            call(next, next === "read_project_file" ? { path: "package.json" } : {}),
          ]);
        }
        if ("path" in data) {
          names.push("read_destination");
          return toolResponse([call("read_destination")]);
        }
        return finalResponse();
      });
      const created = createAgentRun(
        f.config,
        f.store,
        f.session,
        randomUUID(),
        "این برنامه را برای انتشار بررسی کن",
        f.flow.id,
      );
      await driveAgentRun(f.config, f.store, f.session, created.run.id, { model });
      const repo = new AgentRepository(f.store),
        run = repo.get(f.session.actorId, created.run.id);
      assert.ok(run);
      assert.equal(run.state, "needs_input");
      assert.equal(run.effect, "no_remote_changes");
      assert.equal(run.nextAction, "connect_account");
      assert.deepEqual(
        names,
        incomplete
          ? ["inspect_project", "read_project_file", "read_destination"]
          : ["inspect_project", "read_destination"],
      );
      assert.equal(run.usage.modelCalls, names.length + 1);
      assert.equal(run.usage.toolCalls, names.length);
      assert.equal(run.usage.unknownModelCalls, 0);
      const calls = run.messages.flatMap((message) =>
        message.role === "assistant" ? (message.tool_calls ?? []) : [],
      );
      const results = run.messages.filter((message) => message.role === "tool");
      assert.deepEqual(
        results.map((result) => result.tool_call_id),
        calls.map((call) => call.id),
      );
      const snapshot = JSON.stringify(agentView(run));
      for (let i = 0; i < 3; i++) {
        const replay = repo.get(f.session.actorId, run.id);
        assert.ok(replay);
        assert.equal(JSON.stringify(agentView(replay)), snapshot);
      }
      assert.equal(repo.get("another-actor", run.id), null);
      assert.ok(!snapshot.includes("sourceHash"));
    } finally {
      f.close();
    }
  }
});

test("create and follow-up idempotency preserve the same run and cumulative budget; stale context never calls the model", async () => {
  const f = await agentFixture();
  try {
    const key = randomUUID(),
      goal = "پروژه را بررسی کن",
      first = createAgentRun(f.config, f.store, f.session, key, goal, f.flow.id);
    assert.equal(createAgentRun(f.config, f.store, f.session, key, goal, f.flow.id).created, false);
    assert.throws(
      () => createAgentRun(f.config, f.store, f.session, key, "هدف دیگر", f.flow.id),
      code("IDEMPOTENCY_CONFLICT"),
    );
    const model = new GoalModelClient(f.config, async (_url, init) => {
      const body = object(JSON.parse(String(init.body)));
      assert.ok(Array.isArray(body.messages));
      return object(body.messages.at(-1)).role === "user"
        ? toolResponse([call("read_destination")])
        : finalResponse();
    });
    await driveAgentRun(f.config, f.store, f.session, first.run.id, { model });
    const repo = new AgentRepository(f.store),
      saved = repo.get(f.session.actorId, first.run.id);
    assert.ok(saved);
    const before = saved.usage.modelCalls;
    const messageKey = randomUUID();
    continueAgentRun(
      f.config,
      f.store,
      f.session,
      saved.id,
      saved.revision,
      messageKey,
      "فعلاً فقط شرایط را توضیح بده",
    );
    assert.equal(
      continueAgentRun(
        f.config,
        f.store,
        f.session,
        saved.id,
        saved.revision,
        messageKey,
        "فعلاً فقط شرایط را توضیح بده",
      ).created,
      false,
    );
    await driveAgentRun(f.config, f.store, f.session, saved.id, { model });
    assert.equal(repo.get(f.session.actorId, saved.id)?.usage.modelCalls, before + 2);
    const another = createAgentRun(
      f.config,
      f.store,
      f.session,
      randomUUID(),
      "شروع تازه",
      f.flow.id,
    );
    writeFileSync(join(f.project, "server.mjs"), "// changed base\n");
    let requests = 0;
    await driveAgentRun(f.config, f.store, f.session, another.run.id, {
      model: new GoalModelClient(f.config, async () => {
        requests++;
        return toolResponse([call("inspect_project")]);
      }),
    });
    assert.equal(requests, 0);
    assert.equal(repo.get(f.session.actorId, another.run.id)?.errorCode, "PROJECT_CHANGED");
    const changed = createAgentRun(
      f.config,
      f.store,
      f.session,
      randomUUID(),
      "بررسی قبلی را ادامه بده",
      f.flow.id,
    );
    f.store.staleProjectFlow(f.session.actorId, f.flow.id, "changed");
    // A selected flow's source hash is checked by the actual inspect tool, not by GET replay.
    await driveAgentRun(f.config, f.store, f.session, changed.run.id, {
      model: new GoalModelClient(f.config, async () => toolResponse([call("inspect_project")])),
    });
    assert.equal(repo.get(f.session.actorId, changed.run.id)?.state, "failed");
  } finally {
    f.close();
  }
});

test("provider 429, truncation, unknown tools and malformed arguments fail without retry or an execution success", async () => {
  const cases = [
    { response: () => new Response("", { status: 429 }), error: "PROVIDER_RATE_LIMIT" },
    {
      response: () =>
        Response.json({
          choices: [{ finish_reason: "length", message: { role: "assistant", content: "{}" } }],
        }),
      error: "MODEL_INCOMPLETE",
    },
    { response: () => toolResponse([call("deploy_without_approval")]), error: "TOOL_DENIED" },
    {
      response: () => toolResponse([call("inspect_project", { role: "system" })]),
      error: "INVALID_INPUT",
    },
  ];
  for (const item of cases) {
    const f = await agentFixture();
    try {
      let requests = 0;
      const run = createAgentRun(
        f.config,
        f.store,
        f.session,
        randomUUID(),
        "انتشار پروژه",
        f.flow.id,
      ).run;
      await driveAgentRun(f.config, f.store, f.session, run.id, {
        model: new GoalModelClient(f.config, async () => {
          requests++;
          return item.response();
        }),
      });
      const saved = new AgentRepository(f.store).get(f.session.actorId, run.id);
      assert.equal(requests, 1);
      assert.equal(saved?.state, "failed");
      assert.equal(saved?.errorCode, item.error);
      assert.equal(saved?.usage.modelCalls, 1);
      assert.equal(saved?.usage.unknownModelCalls, 1);
      assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM attempts").get()?.n, 0);
    } finally {
      f.close();
    }
  }
});

test("cancel stops a noncooperating model wait; durable recovery and event reads never replay a request", async () => {
  const f = await agentFixture();
  try {
    let requests = 0;
    const entered=Promise.withResolvers<void>();
    const run = createAgentRun(
        f.config,
        f.store,
        f.session,
        randomUUID(),
        "وضعیت پروژه",
        f.flow.id,
      ).run,
      repo = new AgentRepository(f.store);
    const running = driveAgentRun(f.config, f.store, f.session, run.id, {
      model: new GoalModelClient(f.config, async () => {
        requests++;
        entered.resolve();
        return new Promise<Response>(() => {});
      }),
    });
    await entered.promise;
    const current = repo.get(f.session.actorId, run.id);
    assert.ok(current);
    cancelAgentRun(f.store, f.session.actorId, run.id, current.revision);
    await running;
    assert.equal(requests, 1);
    assert.equal(repo.get(f.session.actorId, run.id)?.state, "cancelled");
    const next = createAgentRun(
      f.config,
      f.store,
      f.session,
      randomUUID(),
      "درخواست بعدی",
      f.flow.id,
    ).run;
    repo.claim(f.session.actorId, next.id);
    repo.recover();
    assert.equal(repo.get(f.session.actorId, next.id)?.state, "interrupted");
    await driveAgentRun(f.config, f.store, f.session, next.id, {
      model: new GoalModelClient(f.config, async () => {
        requests++;
        return finalResponse();
      }),
    });
    assert.equal(requests, 1);
  } finally {
    f.close();
  }
});

test("a model final sentence without a tool receipt and secret-bearing user input cannot become a completed goal", async () => {
  const f = await agentFixture();
  try {
    assert.throws(
      () =>
        createAgentRun(
          f.config,
          f.store,
          f.session,
          randomUUID(),
          `use ${f.config.modelKey}`,
          f.flow.id,
        ),
      code("SENSITIVE_INPUT"),
    );
    const run = createAgentRun(
      f.config,
      f.store,
      f.session,
      randomUUID(),
      "کار را انجام بده",
      f.flow.id,
    ).run;
    await driveAgentRun(f.config, f.store, f.session, run.id, {
      model: new GoalModelClient(f.config, async () => finalResponse()),
    });
    assert.equal(
      new AgentRepository(f.store).get(f.session.actorId, run.id)?.errorCode,
      "OUTCOME_UNVERIFIED",
    );
  } finally {
    f.close();
  }
});
