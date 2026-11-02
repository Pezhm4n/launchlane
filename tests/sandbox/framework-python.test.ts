import assert from "node:assert/strict";
import { test } from "node:test";
import { cp, writeFile, readFile, appendFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import { parseProjectBuildPlan, pythonBuildImage } from "../../src/contracts/project-build.ts";
import { CodeRepairAdapter } from "../../src/server/agent/code-repair.ts";
import { sourceBuildEnvironment } from "../../src/server/environment/build.ts";
import { assertFrameworkBuild } from "../../src/server/policy/framework-python.ts";
import { readArtifact } from "../../src/server/workspace/archive.ts";
import { gunzipSync } from "node:zlib";

for (const kind of ["flask", "django"]) for (const mode of ["passed", "test-failure", "wrong-workload", "skipped", "no-tests", "background-counterfeit"]) test(`actual ${kind} original runner and WSGI: ${mode}`, async () => {
  const f = await agentFixture(); try {
    const directory = join(f.workspace, kind); await cp(resolve("tests/fixtures", `${kind}-service`), directory, { recursive: true });
    if (kind === "django") await writeFile(join(directory, ".env"), `DJANGO_SECRET_KEY=${randomUUID()}\n`);
    if (mode === "test-failure") await writeFile(join(directory, "invoice.py"), 'def total(lines):\n    return sum(line["price"] for line in lines)\n');
    if (mode === "no-tests") await writeFile(join(directory, "test_invoice.py"), "# No tests were supplied.\n");
    if (mode === "skipped") await writeFile(join(directory, "test_invoice.py"), 'import unittest\nclass Tests(unittest.TestCase):\n    @unittest.skip("not verified")\n    def test_quantity(self): pass\n');
    if (mode === "background-counterfeit") {
      const daemon = 'from http.server import BaseHTTPRequestHandler, HTTPServer\nclass Handler(BaseHTTPRequestHandler):\n def do_GET(self):\n  self.send_response(200);self.end_headers();self.wfile.write(b\'{"total":73}\')\nHTTPServer(("0.0.0.0",8000),Handler).serve_forever()';
      await appendFile(join(directory, "test_invoice.py"), `\nimport subprocess,sys,time,urllib.request\n_counterfeit=subprocess.Popen([sys.executable,"-c",${JSON.stringify(daemon)}],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)\nfor _ in range(40):\n try:\n  with urllib.request.urlopen("http://127.0.0.1:8000/orders",timeout=.1) as response:\n   assert response.read()==b'{"total":73}'\n  break\n except OSError: time.sleep(.05)\nelse: raise RuntimeError("counterfeit fixture failed to start")\n`);
      await appendFile(join(directory, kind === "flask" ? "web.py" : "siteconfig/wsgi.py"), '\nraise RuntimeError("production start is broken")\n');
    }
    const config = { ...f.config, enableLocalRepair: true, maxToolCalls: 80 }, signal = AbortSignal.timeout(180000),
      flow = await prepareProjectFlow(config, f.store, f.session.actorId, { kind: "local", directory: kind }, signal);
    assert.equal(flow.profile.pythonRuntime?.kind, kind); assert.ok(flow.profile.start);
    const sourceEnvironment = sourceBuildEnvironment(config, f.store, f.session.actorId, flow.id);
    const build = parseProjectBuildPlan({ version: 10, nodeVersion: null, image: pythonBuildImage, runtime: flow.profile.pythonRuntime,
      buildCommand: null, testCommand: kind === "django" ? "python3 manage.py test" : "python3 -m unittest discover", startCommand: flow.profile.start, port: 8000,
      workload: { path: "/orders", status: 200, assertion: { kind: "json", field: "total", equals: mode === "wrong-workload" ? 74 : 73 } }, ...(sourceEnvironment ? { sourceEnvironment } : {}) });
    const adapter = new CodeRepairAdapter(config, f.store), proposal = await adapter.propose(f.session.actorId, {
      projectId: flow.id, expectedSourceHash: flow.profile.sourceHash, goal: "Run original framework tests and production WSGI", execution: "container", validationOnly: true,
      allowedPaths: [], testFiles: [], build }, signal);
    adapter.approve(f.session.actorId, proposal.id); const job = await adapter.run(f.session.actorId, proposal.id, signal);
    if (mode !== "passed") { assert.equal(job.state, "failed", JSON.stringify({ code: job.errorCode, message: job.message })); assert.equal(job.artifact, null);
      assert.equal(job.afterTest?.exitCode, ["wrong-workload", "background-counterfeit"].includes(mode) ? 73 : 76, JSON.stringify({ code: job.errorCode, output: job.afterTest?.output }));
      if (mode === "background-counterfeit") assert.match(job.afterTest?.output ?? "", /unexpected background process/); return; }
    assert.equal(job.state, "succeeded", JSON.stringify({ code: job.errorCode, message: job.message, output: job.afterTest?.output })); assert.ok(job.artifact);
    assert.match(job.afterTest?.output ?? "", /Ran [1-9][0-9]* tests?/); assert.match(job.afterTest?.output ?? "", /original workload verified/);
    const selected = await prepareProjectFlow(config, f.store, f.session.actorId, { kind: "repair", directory: ".", jobId: job.id, artifactHash: job.artifact.archiveHash }, signal);
    assert.equal(assertFrameworkBuild(f.store, f.session.actorId, selected).version, 10);
    if (kind === "django") {
      const secret = (await readFile(join(directory, ".env"), "utf8")).trim().split("=")[1]; assert.ok(secret);
      assert.equal(JSON.stringify(job).includes(secret), false); assert.equal(gunzipSync(await readArtifact(config.stateDir, job.artifact)).includes(Buffer.from(secret)), false);
    }
    assert.deepEqual(await readFile(join(directory, "invoice.py")), await readFile(join("tests/fixtures", `${kind}-service`, "invoice.py")));
    console.log(JSON.stringify({ kind, sourceHash: flow.profile.sourceHash, artifactHash: job.artifact.archiveHash, image: job.containerImage, tests: job.afterTest?.passed }));
  } finally { f.close(); }
});
