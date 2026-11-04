import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runnerFixture, runnerBuildInput } from "../helpers/runner-fixture.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import { createPublicationMission } from "../../src/server/application/publication-mission.ts";
import { driveAgentRun, decideAgentRepair } from "../../src/server/agent/runs.ts";
import { AgentRepository } from "../../src/server/agent/store.ts";
import type { ModelPort } from "../../src/server/agent/model.ts";

for (const leak of [false, true]) test(`reviewed signing inputs ${leak ? "reject a copied signing secret in compiled output" : "retain actual API signatures across four fresh workers"}`, { timeout: 600000 }, async () => {
  const f = await runnerFixture();
  try {
    const path = join(f.project, "server.cjs"), original = await readFile(path, "utf8"), oracle = await readFile(join(f.project, "oracle.test.cjs"));
    const listener = 'app.listen(3000, "0.0.0.0");'; assert.ok(original.includes(listener));
    await writeFile(path, `const {createHmac}=require('node:crypto');const assert=require('node:assert/strict');const signing=process.env.JWT_SECRET;assert.match(signing,/^[a-f0-9]{64}$/);\n${original.replace(listener,
      `(async()=>{const signature=createHmac('sha256',signing).update('isolated-signature-fixture').digest('hex');for(const pool of Object.values(pools)){await pool.query("INSERT INTO public.entries(id,label,note) VALUES(8,'signing fixture',$1) ON CONFLICT(id) DO NOTHING",[signature]);const row=(await pool.query('SELECT note FROM public.entries WHERE id=8')).rows[0];assert.equal(row.note,signature)}${listener}})().catch(()=>{console.error('disposable signing continuity failed');process.exit(1)});`)}`);
    if (leak) await writeFile(join(f.project, "oracle.test.cjs"), Buffer.concat([oracle, Buffer.from("\nrequire('node:fs').writeFileSync('dist/leaked-signing.txt',process.env.JWT_SECRET);\n")]));
    const flow = await prepareProjectFlow(f.config, f.store, f.session.actorId, { kind: "local", directory: "runner-service" }, AbortSignal.timeout(10000));
    const originalInput = await runnerBuildInput(), input = { ...originalInput, compatibilityDatabase: { ...originalInput.compatibilityDatabase,
      testSigningKeys: ["JWT_SECRET"], ...(leak ? { prepareArtifact: true } : {}), targets: originalInput.compatibilityDatabase.targets.map(target => ({ ...target, oracle: { ...target.oracle,
        persistence: [...target.oracle.persistence, { relation: "public.entries", key: { column: "id", value: 8 }, column: "note" }] } })) } };
    const { run } = await createPublicationMission(f.config, f.store, f.session, randomUUID(), { projectId: flow.id, sourceHash: flow.profile.sourceHash, path: "/", expectedText: "Runner lifecycle" }, AbortSignal.timeout(10000));
    let calls = 0;
    const model: ModelPort = { async complete(_messages, _tools, budget, signal) {
      budget.take("model", signal); calls++;
      return { content: null, usage: 1, calls: [{ id: `signing-${calls}`, type: "function", function: {
        name: calls === 1 ? "propose_project_build" : "finish_investigation", arguments: JSON.stringify(calls === 1 ? input : {
          state: "partially_completed", nextAction: "reply", message: "آزمون موقت پایان یافت؛ مقصد و دادهٔ واقعی تأیید نشده‌اند.", question: null,
        }),
      } }] };
    } };
    await driveAgentRun(f.config, f.store, f.session, run.id, { model });
    const repo = new AgentRepository(f.store), proposed = repo.get(f.session.actorId, run.id); assert.ok(proposed?.repair);
    assert.deepEqual(proposed.repair.build?.version === 7 ? proposed.repair.build.testDatabase && "testSigningKeys" in proposed.repair.build.testDatabase ? proposed.repair.build.testDatabase.testSigningKeys : null : null, ["JWT_SECRET"]);
    await decideAgentRepair(f.config, f.store, f.session, run.id, proposed.revision, proposed.repair.id, "approve");
    await driveAgentRun(f.config, f.store, f.session, run.id, { model });
    const result = repo.get(f.session.actorId, run.id); assert.ok(result?.repair);
    if (leak) {
      assert.equal(result.repair.state, "failed"); assert.equal(result.repair.afterTest?.databaseRunner, undefined);
      assert.equal(result.repair.artifact, null); assert.equal(result.repair.afterTest?.buildOutput, undefined);
      assert.equal(result.repair.errorCode, "BUILD_OUTPUT_SENSITIVE");
    } else {
      assert.equal(result.repair.state, "succeeded", result.repair.errorCode ?? "runner failed");
      const proof = result.repair.afterTest?.databaseRunner; assert.ok(proof);
      assert.equal(proof.applicationRuns, 2); assert.equal(proof.runnerRuns, 2);
      assert.ok(proof.targets.every(target => target.persistenceChecks === 2));
      assert.ok(result.repair.containerIds); assert.equal(result.repair.containerIds.length, 5);
      assert.ok((await readFile(join(f.project, "oracle.test.cjs"))).equals(oracle));
    }
    assert.equal(result.publication, null); assert.equal(f.store.db.prepare("SELECT count(*) n FROM actions").get()?.n, 0);
    assert.equal(result.repair.postgresExecutionStarted, undefined);
  } finally { f.close(); }
});
