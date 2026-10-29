import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID, createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runnerFixture, runnerBuildInput } from "../helpers/runner-fixture.ts";
import { createPublicationMission } from "../../src/server/application/publication-mission.ts";
import { driveAgentRun, decideAgentRepair } from "../../src/server/agent/runs.ts";
import { AgentRepository } from "../../src/server/agent/store.ts";
import type { ModelPort } from "../../src/server/agent/model.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import { localFullstackVerification, fullstackVerification } from "../../src/server/application/fullstack-verification.ts";
import { readArtifact } from "../../src/server/workspace/archive.ts";
import { AppError } from "../../src/server/errors.ts";
import { bindDataArtifactResources } from "../helpers/data-artifact-bindings.ts";
import { publishDataArtifact } from "../helpers/data-artifact-publication.ts";

// Original runner, independent SQL/data observation, compiled frontend and original API tests are real.
// The model is synthetic. No production resource, SQL, model credit or cloud publication is used.
for (const leak of [false, true]) test(`data preparation ${leak ? "rejects temporary connection bytes in compiled output" : "selects an exact compiled artifact only after runner, replay and independent data proof"}`, { timeout: 600000 }, async () => {
  const f = await runnerFixture(); try {
    const original = await readFile(join(f.project, "migrate.cjs")), oracle = await readFile(join(f.project, "oracle.test.cjs"));
    if (leak) { const path = join(f.project, "index.html"); await writeFile(path, `${await readFile(path, "utf8")}\n<span>launchlane_target_0</span>\n`); }
    const flow = leak ? await prepareProjectFlow(f.config, f.store, f.session.actorId, { kind: "local", directory: "runner-service" }, AbortSignal.timeout(10000)) : f.flow;
    const base = await runnerBuildInput(), input = { ...base, compatibilityDatabase: { ...base.compatibilityDatabase, prepareArtifact: true } };
    const { run } = await createPublicationMission(f.config, f.store, f.session, randomUUID(), { projectId: flow.id, sourceHash: flow.profile.sourceHash, path: "/", expectedText: "Runner lifecycle" }, AbortSignal.timeout(10000));
    let calls = 0;
    const model: ModelPort = { async complete(messages, _tools, budget, signal) {
      budget.take("model", signal); calls++;
      if (!leak && calls === 2) assert.ok(messages.some(message => message.content?.includes('"selectedTestedArtifact":true') && message.content.includes('"productionDataVerified":false')));
      return { content: null, calls: [{ id: `data-artifact-${calls}`, type: "function", function: { name: calls === 1 ? "propose_project_build" : "finish_investigation", arguments: JSON.stringify(calls === 1 ? input
        : { state: "partially_completed", message: "نتیجهٔ ساخت محلی از اتصال، migration و دادهٔ مقصد جداست.", question: null, nextAction: "reply" }) } }], usage: 5 };
    } };
    const repo = new AgentRepository(f.store);
    await driveAgentRun(f.config, f.store, f.session, run.id, { model }); const pending = repo.get(f.session.actorId, run.id); assert.ok(pending?.repair?.build?.version === 7 && pending.repair.build.testDatabase?.version === 4);
    assert.equal(pending.repair.artifact, null); await decideAgentRepair(f.config, f.store, f.session, run.id, pending.revision, pending.repair.id, "approve");
    await driveAgentRun(f.config, f.store, f.session, run.id, { model }); const result = repo.get(f.session.actorId, run.id); assert.ok(result?.repair);
    const diagnostic = JSON.stringify({ state: result.state, error: result.errorCode, job: result.repair.state, code: result.repair.errorCode, output: result.repair.afterTest?.output, message: result.repair.message, events: result.events.slice(-3) });
    assert.equal(result.state, "partially_completed", diagnostic); assert.equal(result.publication, null); assert.equal(result.effect, "no_remote_changes");
    assert.equal(f.store.db.prepare("SELECT count(*) n FROM actions").get()?.n, 0);
    if (leak) { assert.equal(result.repair.state, "failed"); assert.equal(result.repair.errorCode, "BUILD_OUTPUT_SENSITIVE"); assert.equal(result.repair.artifact, null); assert.equal(result.repair.publication, undefined); }
    else {
      assert.equal(result.repair.state, "succeeded"); assert.ok(result.repair.artifact && result.repair.publication && result.repair.afterTest?.buildOutput && result.repair.afterTest.databaseRunner);
      const selected = f.store.getProjectFlow(f.session.actorId); assert.ok(selected?.selection.kind === "repair"); assert.equal(selected.artifact?.archiveHash, result.repair.artifact.archiveHash);
      const evidence = await localFullstackVerification(f.store, f.config.stateDir, f.session.actorId, selected); assert.equal(evidence.build.testDatabase?.version, 4);
      assert.equal(evidence.verification.outputArtifactHash, result.repair.afterTest.buildOutput.artifactHash); assert.equal(evidence.verification.testedSourceHash, result.repair.afterTest.databaseRunner.sourceHash);
      const bytes = await readArtifact(f.config.stateDir, f.store.getArtifact(f.session.actorId, result.repair.artifact.archiveHash)); assert.equal(createHash("sha256").update(bytes).digest("hex"), result.repair.artifact.archiveHash);
      await assert.rejects(fullstackVerification(f.store, f.config.stateDir, f.session.actorId, selected, f.config.sessionSecret), error => error instanceof AppError && error.code === "DATABASE_BINDING_REQUIRED");
      assert.equal(result.repair.afterTest.databaseRunner.production, false); assert.equal(result.repair.containerIds?.length, 5);
      const bound = await bindDataArtifactResources(f);
      assert.equal((await fullstackVerification(f.store, f.config.stateDir, f.session.actorId, selected, bound.config.sessionSecret)).outputArtifactHash, evidence.verification.outputArtifactHash);
      assert.equal(bound.actions.length, 2); assert.equal(f.store.db.prepare("SELECT count(*) n FROM actions").get()?.n, 4);
      await publishDataArtifact(f, bound.config, selected, result.repair, bound.values);
      assert.equal(f.store.db.prepare("SELECT count(*) n FROM actions").get()?.n, 5);
    }
    assert.ok((await readFile(join(f.project, "migrate.cjs"))).equals(original)); assert.ok((await readFile(join(f.project, "oracle.test.cjs"))).equals(oracle));
  } finally { f.close(); }
});
