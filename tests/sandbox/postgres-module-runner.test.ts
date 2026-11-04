import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runnerFixture } from "../helpers/runner-fixture.ts";
import { addModuleRunner } from "../helpers/module-runner-fixture.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import { createPublicationMission } from "../../src/server/application/publication-mission.ts";
import { driveAgentRun, decideAgentRepair } from "../../src/server/agent/runs.ts";
import { AgentRepository } from "../../src/server/agent/store.ts";
import type { ModelPort } from "../../src/server/agent/model.ts";

for (const fail of [false, true]) test(`source module runner ${fail ? "fails before application when the original export throws" : "retains original SQL and API data across four fresh workers"}`, { timeout: 600000 }, async () => {
  const f = await runnerFixture(); try {
    const oracle = await readFile(join(f.project, "oracle.test.cjs")), sql = await readFile(join(f.project, "001_entries.sql"));
    const input = await addModuleRunner(f.project);
    if (fail) {
      const path = join(f.project, "migrate.mjs"); await writeFile(path, (await readFile(path, "utf8")).replace("const label=labels[target];", "throw Error('original module rejection');const label=labels[target];"));
    }
    const flow = await prepareProjectFlow(f.config, f.store, f.session.actorId, { kind: "local", directory: "runner-service" }, AbortSignal.timeout(10000));
    const { run } = await createPublicationMission(f.config, f.store, f.session, randomUUID(), { projectId: flow.id, sourceHash: flow.profile.sourceHash, path: "/", expectedText: "Runner lifecycle" }, AbortSignal.timeout(10000));
    let calls = 0;
    const model: ModelPort = { async complete(_messages, _tools, budget, signal) {
      budget.take("model", signal); calls++;
      return { content: null, usage: 1, calls: [{ id: `module-${calls}`, type: "function", function: {
        name: calls === 1 ? "propose_project_build" : "finish_investigation", arguments: JSON.stringify(calls === 1 ? input : {
          state: "partially_completed", nextAction: "reply", message: "آزمون موقت پایان یافت؛ دادهٔ مقصد تأیید نشده است.", question: null,
        }),
      } }] };
    } };
    const repo = new AgentRepository(f.store);
    await driveAgentRun(f.config, f.store, f.session, run.id, { model });
    const proposed = repo.get(f.session.actorId, run.id); assert.ok(proposed?.repair);
    assert.equal(proposed.repair.state, "proposed"); assert.deepEqual(proposed.repair.containerIds, []);
    await decideAgentRepair(f.config, f.store, f.session, run.id, proposed.revision, proposed.repair.id, "approve");
    await driveAgentRun(f.config, f.store, f.session, run.id, { model });
    const result = repo.get(f.session.actorId, run.id), job = result?.repair; assert.ok(job); assert.ok(job.containerIds);
    if (fail) {
      assert.equal(job.state, "failed"); assert.equal(job.afterTest?.passed, false);
      assert.equal(job.afterTest?.databaseRunner, undefined); assert.equal(job.containerIds.length, 2);
      assert.ok(job.afterTest?.output.includes("original module rejection")); assert.equal(job.artifact, null);
    } else {
      assert.equal(job.state, "succeeded", job.afterTest?.output ?? job.errorCode ?? "missing proof");
      assert.equal(job.afterTest?.databaseRunner?.runnerRuns, 2); assert.equal(job.afterTest?.databaseRunner?.applicationRuns, 2);
      assert.deepEqual(job.afterTest?.databaseRunner?.targets.map(target => target.id), ["auth", "profile"]);
      assert.equal(job.containerIds.length, 5); assert.equal(job.artifact, null);
    }
    assert.equal(result?.publication, null); assert.equal(f.store.db.prepare("SELECT count(*) n FROM actions").get()?.n, 0);
    assert.ok((await readFile(join(f.project, "oracle.test.cjs"))).equals(oracle)); assert.ok((await readFile(join(f.project, "001_entries.sql"))).equals(sql));
  } finally { f.close(); }
});
