import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { cpSync, readFileSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { agentFixture } from "../tests/helpers/agent-fixture.ts";
import { createPublicationMission } from "../src/server/application/publication-mission.ts";
import { prepareProjectFlow } from "../src/server/application/project-flows.ts";
import { driveAgentRun, decideAgentRepair } from "../src/server/agent/runs.ts";
import { AgentRepository } from "../src/server/agent/store.ts";
import { GoalModelClient } from "../src/server/agent/model.ts";
import { registryTarball } from "../src/server/agent/npm-source.ts";

const cache = process.env.LAUNCHLANE_TEST_NPM_CACHE;
const tarballReader = cache ? async (item) => {
  const hex = Buffer.from(item.digest, "base64").toString("hex");
  return readFile(join(cache, "_cacache", "content-v2", item.algorithm, hex.slice(0, 2), hex.slice(2, 4), hex.slice(4)));
} : registryTarball;
const results = [];
for (const broken of [false, true]) {
  const f = await agentFixture();
  try {
    const config = { ...f.config, enableLocalRepair: true }, project = join(f.workspace, "built-service");
    cpSync(resolve("tests/fixtures/locked-node-build"), project, { recursive: true });
    const original = readFileSync(join(project, "invoice.mjs"), "utf8");
    if (broken) writeFileSync(join(project, "invoice.mjs"), original.replace("line.price*line.quantity", "line.price"));
    const baseline = readFileSync(join(project, "invoice.mjs"), "utf8");
    const flow = await prepareProjectFlow(config, f.store, f.session.actorId, { kind: "local", directory: "built-service" }, AbortSignal.timeout(5000));
    const publication = { projectId: flow.id, sourceHash: flow.profile.sourceHash, path: "/orders", expectedText: null };
    const { run: registered } = await createPublicationMission(config, f.store, f.session, randomUUID(), publication, AbortSignal.timeout(5000));
    let turns = 0, patches = 0;
    const model = new GoalModelClient(config, async (_url, init) => {
      const packet = JSON.parse(String(init.body));
      let name, args;
      if (packet.tools[0].function.name === "submit_patch") {
        patches++;
        const input = JSON.parse(packet.messages[1].content), source = input.files.find(file => file.path === "invoice.mjs");
        name = "submit_patch"; args = { baseRevision: input.baseRevision, files: [{ path: source.path, beforeHash: source.sha256, content: original }] };
      } else {
        turns++;
        if (turns === 1) { name = "propose_project_build"; args = { path: "/orders", status: 200, assertion: { kind: "json", field: "total", equals: 73 } }; }
        else if (broken && turns === 2) { name = "read_project_file"; args = { path: "invoice.mjs" }; }
        else if (broken && turns === 3) { name = "propose_code_repair"; args = { goal: "تعداد هر قلم در مبلغ فاکتور لحاظ شود و معیار مبلغ ۷۳ حفظ شود.", allowedPaths: ["invoice.mjs"], testFiles: [] }; }
        else { name = "finish_investigation"; args = { state: "partially_completed", message: "ساخت و پاسخ نسخه جدا بررسی شد؛ انتشار در این آزمون اجرا نمی‌شود.", question: null, nextAction: "reply" }; }
      }
      return Response.json({ choices: [{ finish_reason: "tool_calls", message: { role: "assistant", tool_calls: [{ id: randomUUID(), type: "function", function: { name, arguments: JSON.stringify(args) } }] } }], usage: { total_tokens: 100 } });
    });
    const repo = new AgentRepository(f.store), dependencies = { model, tarballReader };
    await driveAgentRun(config, f.store, f.session, registered.id, dependencies);
    let run = repo.get(f.session.actorId, registered.id);
    assert.equal(run.state, "needs_approval"); assert.equal(run.repair.validationOnly, true);
    assert.deepEqual(run.repair.containerIds, []); assert.equal(run.repair.afterTest, null);
    const firstCheckId = run.repair.id;
    await decideAgentRepair(config, f.store, f.session, run.id, run.revision, run.repair.id, "approve");
    await driveAgentRun(config, f.store, f.session, run.id, dependencies);
    run = repo.get(f.session.actorId, run.id);
    const buildCheck = JSON.parse(f.store.db.prepare("SELECT data_json FROM code_repair_jobs WHERE id=? AND actor_id=?").get(firstCheckId, f.session.actorId).data_json).job;
    assert.equal(buildCheck.validationOnly, true); assert.equal(buildCheck.afterTest.passed, !broken);
    if (broken) {
      assert.equal(run.state, "needs_approval", JSON.stringify(run));
      assert.equal(run.repair.validationOnly, undefined); assert.equal(run.repair.build.workload.assertion.equals, 73);
      await decideAgentRepair(config, f.store, f.session, run.id, run.revision, run.repair.id, "approve");
      await driveAgentRun(config, f.store, f.session, run.id, dependencies);
      run = repo.get(f.session.actorId, run.id);
      assert.equal(run.repair.beforeTest.passed, false); assert.equal(run.repair.beforeTest.exitCode, 76); assert.deepEqual(run.repair.changedPaths, ["invoice.mjs"]); assert.equal(patches, 1);
    }
    assert.equal(run.state, "partially_completed", JSON.stringify(run)); assert.equal(run.repair.state, "succeeded");
    assert.equal(run.repair.afterTest.passed, true); assert.ok(run.repair.artifact);
    assert.equal(run.repair.build.testCommand, "node --test invoice.test.mjs"); assert.match(run.repair.afterTest.output, /# pass 1/);
    const selected = f.store.getProjectFlow(f.session.actorId);
    assert.equal(selected.selection.kind, "repair"); assert.equal(selected.artifact.archiveHash, run.repair.artifact.archiveHash);
    assert.equal(readFileSync(join(project, "invoice.mjs"), "utf8"), baseline);
    assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM attempts").get().n, 0);
    const ids = f.store.db.prepare("SELECT data_json FROM code_repair_jobs WHERE actor_id=?").all(f.session.actorId)
      .flatMap(row => JSON.parse(row.data_json).job.containerIds ?? []);
    for (const id of ids) {
      assert.match(id, /^[a-f0-9]{64}$/);
      const inspected = spawnSync("docker", ["inspect", id], { windowsHide: true, encoding: "utf8", timeout: 10000 });
      assert.notEqual(inspected.status, 0, `Own container still exists: ${id}`);
    }
    results.push({ broken, commands: "actual offline npm ci/build/test/start/GET in Node22", model: "synthetic", sourcePreserved: true,
      containersRemoved: ids.length, selectedTestedArtifact: true, archive: run.repair.artifact.archiveHash,
      source: createHash("sha256").update(baseline).digest("hex"), firstCheckWasValidation: buildCheck.validationOnly === true });
  } finally { f.close(); }
}
console.log(JSON.stringify({ passed: true, dependencySource: cache ? "verified npm content cache" : "actual registry download", cloudWrites: 0, results }));
