import assert from "node:assert/strict";
import { test } from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import { CodeRepairAdapter } from "../../src/server/agent/code-repair.ts";
import { projectBuildImage, parseProjectBuildPlan } from "../../src/contracts/project-build.ts";

test("a reviewed build can execute its native tool in private tmpfs while the original source stays read-only", async () => {
  const f = await agentFixture();
  try {
    writeFileSync(join(f.project, "package.json"), JSON.stringify({ name: "native-tool-service", version: "1.0.0", type: "module", engines: { node: "22.x" }, scripts: { build: "node build.mjs", start: "node server.mjs" } }));
    writeFileSync(join(f.project, "package-lock.json"), JSON.stringify({ name: "native-tool-service", version: "1.0.0", lockfileVersion: 3, packages: { "": { name: "native-tool-service", version: "1.0.0" } } }));
    writeFileSync(join(f.project, "build.mjs"), "import{copyFileSync,chmodSync,writeFileSync}from'node:fs';import{spawnSync}from'node:child_process';copyFileSync(process.execPath,'native-node');chmodSync('native-node',0o700);const result=spawnSync('./native-node',['-e',\"process.stdout.write('native executable ready')\"],{encoding:'utf8'});if(result.status!==0)throw Error('native executable failed');writeFileSync('ready.txt',result.stdout);\n");
    writeFileSync(join(f.project, "server.mjs"), "import{createServer}from'node:http';import{readFileSync}from'node:fs';createServer((_req,res)=>res.end(readFileSync('ready.txt'))).listen(3000);\n");
    const flow = await prepareProjectFlow(f.config, f.store, f.session.actorId, { kind: "local", directory: "service" }, AbortSignal.timeout(5000)),
      build = parseProjectBuildPlan({ version: 1, nodeVersion: "22", image: projectBuildImage, buildCommand: "node build.mjs", testCommand: null, startCommand: "node server.mjs", port: 3000,
        workload: { path: "/", status: 200, assertion: { kind: "text", contains: "native executable ready" } } }),
      adapter = new CodeRepairAdapter({ ...f.config, enableLocalRepair: true }, f.store), signal = AbortSignal.timeout(120000);
    const proposal = await adapter.propose(f.session.actorId, { projectId: flow.id, expectedSourceHash: flow.profile.sourceHash,
      goal: "Verify the native build tool and original response", build, allowedPaths: [], testFiles: [], execution: "container", validationOnly: true }, signal);
    adapter.approve(f.session.actorId, proposal.id);
    const job = await adapter.run(f.session.actorId, proposal.id, signal);
    assert.equal(job.state, "succeeded", job.afterTest?.output); assert.equal(job.afterTest?.passed, true); assert.ok(job.artifact);
    assert.deepEqual(job.changedPaths, []);
  } finally { f.close(); }
});
