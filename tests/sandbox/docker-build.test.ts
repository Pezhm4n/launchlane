import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { captureProject } from "../../src/server/workspace/inspect.ts";
import { dockerProjectBuild } from "../../src/server/agent/build-policy.ts";
import { runDockerBuild } from "../../src/server/agent/docker-container.ts";
import { docker } from "../../src/server/agent/container.ts";
import { projectBuildImage } from "../../src/contracts/project-build.ts";

test("actual Docker build uses pinned cached input, probes a separate runtime and cleans only its owned IDs", { timeout: 150000 }, async () => {
  const workspace = await mkdtemp(join(tmpdir(), "launchlane-docker-actual-"));
  const ids: string[] = [];
  try {
    await writeFile(join(workspace, "Dockerfile"), `FROM ${projectBuildImage}\nWORKDIR /app\nCOPY server.mjs /app/server.mjs\nUSER 1000:1000\nEXPOSE 8080\nCMD ["node","/app/server.mjs"]\n`);
    await writeFile(join(workspace, "server.mjs"), "import http from 'node:http';http.createServer((_req,res)=>{res.setHeader('content-type','text/plain');res.end('actual isolated Docker workload')}).listen(8080,'0.0.0.0');\n");
    const source = await captureProject(workspace, "."), workload = { path: "/", status: 200 as const, assertion: { kind: "text" as const, contains: "actual isolated Docker workload" } };
    assert.equal(source.profile.runtime, "docker");
    const plan = dockerProjectBuild(source.files, source.profile, workload, null);
    const result = await runDockerBuild(workspace, plan, AbortSignal.timeout(120000), id => ids.push(id));
    assert.equal(result.exitCode, 0); assert.equal(result.workloadVerified, true); assert.equal(result.sourceHash, source.profile.sourceHash);
    assert.ok(ids.length >= 2); assert.match(result.image, /^sha256:[a-f0-9]{64}$/);
    for (const id of ids) assert.notEqual((await docker(["inspect", "--type", "container", "--format", "{{.Id}}", id], AbortSignal.timeout(5000), 1024)).exitCode, 0);
    const wrong = await runDockerBuild(workspace, { ...plan, workload: { ...workload, assertion: { kind: "text", contains: "a different application revision" } } }, AbortSignal.timeout(120000));
    assert.equal(wrong.exitCode, 73); assert.equal(wrong.workloadVerified, false, "HTTP200 is insufficient");
  } finally { await rm(workspace, { recursive: true, force: true }); }
});
