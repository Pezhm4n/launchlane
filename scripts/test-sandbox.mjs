import assert from "node:assert/strict";
import { readFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { agentFixture, repairBrokenSource, repairCorrectSource } from "../tests/helpers/agent-fixture.ts";
import { prepareProjectFlow } from "../src/server/application/project-flows.ts";
import { CodeRepairAdapter } from "../src/server/agent/code-repair.ts";
import { GoalModelClient } from "../src/server/agent/model.ts";

const f = await agentFixture();
try {
  appendFileSync(join(f.project, "invoice.test.mjs"), `
import fs from 'node:fs';import net from 'node:net';
test('container confines host files, environment, source writes and network',async()=>{
assert.equal(process.versions.node,'22.23.3');assert.equal(process.env.LIARA_API_TOKEN,undefined);assert.equal(process.env.MODEL_API_KEY,undefined);
assert.throws(()=>fs.readFileSync('/source/.env'));assert.throws(()=>fs.writeFileSync('/source/escape.txt','denied'));
await new Promise((resolve,reject)=>{const socket=net.connect({host:'1.1.1.1',port:443});socket.setTimeout(1000,()=>{socket.destroy();resolve()});socket.once('error',()=>resolve());socket.once('connect',()=>{socket.destroy();reject(new Error('unexpected external network'))})});
});\n`);
  const flow = await prepareProjectFlow(f.config, f.store, f.session.actorId, { kind: "local", directory: "service" }, AbortSignal.timeout(5000));
  const model = new GoalModelClient(f.config, async (_url, init) => {
    const request = JSON.parse(String(init.body)), packet = JSON.parse(request.messages[1].content), source = packet.files.find(file => file.path === "invoice.mjs");
    return Response.json({ choices: [{ finish_reason: "tool_calls", message: { role: "assistant", tool_calls: [{ id: randomUUID(), type: "function", function: {
      name: "submit_patch", arguments: JSON.stringify({ baseRevision: packet.baseRevision, files: [{ path: source.path, beforeHash: source.sha256, content: repairCorrectSource }] }),
    } }] } }], usage: { total_tokens: 320 } });
  });
  const adapter = new CodeRepairAdapter(f.config, f.store, model), job = await adapter.propose(f.session.actorId, {
    projectId: flow.id, goal: "تعداد هر قلم در مبلغ فاکتور اعمال شود؛ رفتار فاکتور خالی حفظ شود.",
    allowedPaths: ["invoice.mjs"], testFiles: ["invoice.test.mjs"], expectedSourceHash: flow.profile.sourceHash, execution: "container",
  }, AbortSignal.timeout(5000));
  adapter.approve(f.session.actorId, job.id);
  const result = await adapter.run(f.session.actorId, job.id, AbortSignal.timeout(120000));
  assert.equal(result.state, "succeeded", JSON.stringify(result));
  assert.equal(result.beforeTest.passed, false); assert.equal(result.afterTest.passed, true);
  assert.ok(result.artifact); assert.deepEqual(result.changedPaths, ["invoice.mjs"]);
  assert.equal(readFileSync(join(f.project, "invoice.mjs"), "utf8"), repairBrokenSource);
  assert.equal(result.containerIds.length, 2);
  for (const id of result.containerIds) {
    const inspection = spawnSync("docker", ["inspect", id], { encoding: "utf8", windowsHide: true, timeout: 10000 });
    assert.notEqual(inspection.status, 0, "only this job's containers must be removed");
  }
  console.log(JSON.stringify({ passed: true, model: "synthetic", tests: "actual Node22 container", failedBaseline: true, fixedArtifact: true, isolationChecks: 5, containersRemoved: 2 }));
} finally { f.close(); }
