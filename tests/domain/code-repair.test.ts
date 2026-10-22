import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { object } from "../../src/contracts/validation.ts";
import {
  CodeRepairAdapter,
  repairConsent,
  runRepairTests,
} from "../../src/server/agent/code-repair.ts";
import { GoalModelClient } from "../../src/server/agent/model.ts";
import { readArtifact } from "../../src/server/workspace/archive.ts";
import { agentFixture, repairCorrectSource, repairBrokenSource } from "../helpers/agent-fixture.ts";

type Fixture = Awaited<ReturnType<typeof agentFixture>>;
function input(f: Fixture) {
  const scope = {
    projectId: f.flow.id,
    goal: "مقدار هر قلم فاکتور باید در تعداد آن ضرب شود؛ تعداد صفر و فاکتور خالی را هم حفظ کن.",
    allowedPaths: ["invoice.mjs"],
    testFiles: ["invoice.test.mjs"],
    expectedSourceHash: f.flow.profile.sourceHash,
  };
  return { ...scope, localWorkConsent: repairConsent(scope) };
}
function worker(
  f: Fixture,
  mode: "correct" | "unrelated" | "outside" | "base" | "stale" = "correct",
) {
  return new GoalModelClient(f.config, async (_url, init) => {
    const request = object(JSON.parse(String(init.body)));
    assert.ok(Array.isArray(request.messages));
    const packet = object(JSON.parse(String(object(request.messages[1]).content)));
    assert.ok(Array.isArray(packet.files));
    const original = packet.files.map(object).find((file) => file.path === "invoice.mjs");
    assert.ok(original);
    assert.ok(!JSON.stringify(request).includes("private-local-fixture-value"));
    assert.ok(!JSON.stringify(request).includes(f.config.modelKey));
    if (mode === "stale")
      writeFileSync(
        join(f.project, "invoice.mjs"),
        `${repairBrokenSource}// user changed source\n`,
      );
    return Response.json({
      choices: [
        {
          finish_reason: "tool_calls",
          message: {
            role: "assistant",
            tool_calls: [
              {
                id: randomUUID(),
                type: "function",
                function: {
                  name: "submit_patch",
                  arguments: JSON.stringify({
                    baseRevision: mode === "base" ? "0".repeat(64) : packet.baseRevision,
                    files: [
                      {
                        path: mode === "outside" ? "invoice.test.mjs" : "invoice.mjs",
                        beforeHash: original.sha256,
                        content:
                          mode === "unrelated"
                            ? `${repairBrokenSource}// unrelated comment\n`
                            : repairCorrectSource,
                      },
                    ],
                  }),
                },
              },
            ],
          },
        },
      ],
      usage: { total_tokens: 320 },
    });
  });
}

test("a real scoped workspace reproduces the bug, applies a model patch, reruns unchanged tests and archives the verified bytes", async () => {
  const f = await agentFixture();
  try {
    const adapter = new CodeRepairAdapter(f.config, f.store, worker(f)),
      job = await adapter.start(f.session.actorId, input(f), AbortSignal.timeout(3000));
    const result = await adapter.run(f.session.actorId, job.id, AbortSignal.timeout(10000));
    assert.equal(result.state, "succeeded", JSON.stringify(result));
    assert.equal(result.beforeTest?.passed, false);
    assert.match(result.beforeTest?.output ?? "", /73/);
    assert.equal(result.afterTest?.passed, true);
    assert.deepEqual(result.changedPaths, ["invoice.mjs"]);
    assert.match(result.diff ?? "", /line\.price \* line\.quantity/);
    assert.equal(result.baseRevision, f.flow.profile.sourceHash);
    assert.equal(readFileSync(join(f.project, "invoice.mjs"), "utf8"), repairBrokenSource);
    assert.ok(result.artifact);
    const archive = await readArtifact(
      f.config.stateDir,
      f.store.getArtifact(f.session.actorId, result.artifact.archiveHash),
    );
    assert.ok(archive.length > 0);
    assert.equal(
      adapter.status(f.session.actorId, job.id).artifact?.archiveHash,
      result.artifact.archiveHash,
    );
    assert.throws(() => adapter.status("other-actor", job.id));
    assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM attempts").get()?.n, 0);
  } finally {
    f.close();
  }
});

test("irrelevant, outside-scope, stale-base and concurrently changed source patches never create a deployable artifact", async () => {
  for (const mode of ["unrelated", "outside", "base", "stale"] as const) {
    const f = await agentFixture();
    try {
      const adapter = new CodeRepairAdapter(f.config, f.store, worker(f, mode)),
        job = await adapter.start(f.session.actorId, input(f), AbortSignal.timeout(3000));
      const result = await adapter.run(f.session.actorId, job.id, AbortSignal.timeout(10000));
      assert.equal(result.state, "failed");
      assert.equal(result.artifact, null);
      assert.equal(
        result.errorCode,
        mode === "unrelated"
          ? "REPAIR_TEST_FAILED"
          : mode === "outside"
            ? "REPAIR_PATH_DENIED"
            : "PROJECT_CHANGED",
      );
      if (mode === "unrelated") assert.equal(result.afterTest?.passed, false);
    } finally {
      f.close();
    }
  }
});

test("local-work scope consent, unchanged test files and the actual package test command are required", async () => {
  const f = await agentFixture();
  try {
    const adapter = new CodeRepairAdapter(f.config, f.store, worker(f)),
      scope = input(f);
    await assert.rejects(() =>
      adapter.start(
        f.session.actorId,
        { ...scope, localWorkConsent: "invalid" },
        AbortSignal.timeout(3000),
      ),
    );
    const changed = { ...scope, allowedPaths: ["invoice.mjs", "invoice.test.mjs"] };
    await assert.rejects(() =>
      adapter.start(
        f.session.actorId,
        { ...changed, localWorkConsent: repairConsent(changed) },
        AbortSignal.timeout(3000),
      ),
    );
    assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM code_repair_jobs").get()?.n, 0);
  } finally {
    f.close();
  }
});

test("cancelling a noncooperating coding provider preserves the failed baseline and cannot publish a late patch", async () => {
  const f = await agentFixture();
  try {
    let requested: () => void = () => undefined;
    const started = new Promise<void>((resolve) => {
      requested = resolve;
    });
    const model = new GoalModelClient(f.config, async () => {
        requested();
        return new Promise<Response>(() => {});
      }),
      adapter = new CodeRepairAdapter(f.config, f.store, model);
    const job = await adapter.start(f.session.actorId, input(f), AbortSignal.timeout(3000)),
      running = adapter.run(f.session.actorId, job.id, AbortSignal.timeout(10000));
    await started;
    adapter.cancel(f.session.actorId, job.id);
    const result = await running;
    assert.equal(result.state, "cancelled");
    assert.equal(result.artifact, null);
    assert.equal(result.beforeTest?.passed, false);
    await assert.rejects(() => adapter.run(f.session.actorId, job.id, AbortSignal.timeout(3000)));
  } finally {
    f.close();
  }
});

test("the Node test executor withholds parent filesystem, credentials, child process and worker grants", async () => {
  const f = await agentFixture();
  try {
    writeFileSync(
      join(f.project, "containment.test.mjs"),
      "import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {spawnSync} from 'node:child_process';test('containment',()=>{assert.equal(process.env.MODEL_API_KEY,undefined);assert.equal(process.env.NODE_OPTIONS,undefined);assert.throws(()=>readFileSync('../outside.txt'),{code:'ERR_ACCESS_DENIED'});assert.throws(()=>spawnSync(process.execPath,['--version']),{code:'ERR_ACCESS_DENIED'});});",
    );
    const result = await runRepairTests(
      f.project,
      ["containment.test.mjs"],
      AbortSignal.timeout(4000),
      [],
    );
    assert.equal(result.passed, true, result.output);
  } finally {
    f.close();
  }
});

test("an empty, skipped or early-exit test run is not a passing repair receipt", async () => {
  const f = await agentFixture();
  try {
    for (const content of [
      "// no acceptance cases\n",
      "process.exit(0);\n",
      "import {test} from 'node:test';test.skip('not executed',()=>{});\n",
    ]) {
      writeFileSync(join(f.project, "empty.test.mjs"), content);
      const result = await runRepairTests(
        f.project,
        ["empty.test.mjs"],
        AbortSignal.timeout(4000),
        [],
      );
      assert.equal(result.passed, false, result.output);
    }
  } finally {
    f.close();
  }
});

test("source-owned test filenames cannot be interpreted as Node command options", async () => {
  const f = await agentFixture();
  try {
    writeFileSync(
      join(f.project, "--help.test.mjs"),
      "import {test} from 'node:test';import assert from 'node:assert/strict';test('literal test filename',()=>assert.equal(2+3,5));\n",
    );
    const result = await runRepairTests(
      f.project,
      ["--help.test.mjs"],
      AbortSignal.timeout(4000),
      [],
    );
    assert.equal(result.passed, true, result.output);
  } finally {
    f.close();
  }
});
