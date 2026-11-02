import assert from "node:assert/strict";
import { test } from "node:test";
import { cp, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { componentTarget } from "../helpers/component-target.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import { CodeRepairAdapter } from "../../src/server/agent/code-repair.ts";
import { executeAgentTool, currentAgentContext } from "../../src/server/agent/tools.ts";
import { parseCodeRepairJob } from "../../src/contracts/code-repair.ts";
import { object } from "../../src/contracts/validation.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";
import { sourceBuildEnvironment } from "../../src/server/environment/build.ts";
import { assertExecutableJob } from "../../src/server/policy/executable-artifact.ts";
import { readArtifact } from "../../src/server/workspace/archive.ts";
import { compiledProof } from "../../src/server/agent/fullstack-artifact.ts";
import { goToolchainUrl, type GoReader } from "../../src/server/agent/go-source.ts";
import { goFixtureReader } from "../helpers/go-reader.ts";

test("actual Go module, original tests, compiled archive and fresh Docker/browser", async () => {
  const f = await agentFixture(); try {
    const directory = join(f.workspace, "go"), secret = randomUUID(); await cp(resolve("tests/fixtures/go-service"), directory, { recursive: true });
    await writeFile(join(directory, ".env"), `APP_LABEL=${secret}\n`);
    const config = { ...f.config, enableLocalRepair: true, maxToolCalls: 512 }, signal = AbortSignal.timeout(420000);
    const flow = await prepareProjectFlow(config, f.store, f.session.actorId, { kind: "local", directory: "go" }, signal);
    assert.equal(flow.profile.runtime, "go"); assert.equal(flow.status, "ready"); assert.ok(flow.profile.envNames.includes("APP_LABEL")); assert.ok(sourceBuildEnvironment(config, f.store, f.session.actorId, flow.id));
    const proposal = object(await executeAgentTool("propose_project_build", { path: "/orders", status: 200, assertion: { kind: "json", field: "total", equals: 73 } },
      { config, store: f.store, actorId: f.session.actorId, context: currentAgentContext(config, f.store, f.session.actorId), budget: new RunBudget(config), createdAt: Date.now(), signal }));
    const proposed = parseCodeRepairJob(proposal.repairProposal); assert.equal(proposed.build?.version, 11);
    const reader: GoReader = goFixtureReader;
    const adapter = new CodeRepairAdapter(config, f.store, undefined, undefined, {}, undefined, reader); adapter.approve(f.session.actorId, proposed.id);
    const job = await adapter.run(f.session.actorId, proposed.id, signal);
    assert.equal(job.state, "succeeded", JSON.stringify({ code: job.errorCode, message: job.message, receipt: job.afterTest }));
    assert.ok(job.artifact && job.publication); assert.equal(job.afterTest?.buildOutput?.version, 3); assert.equal(job.containerIds?.length, 2);
    assert.match(job.afterTest?.output ?? "", /fresh compiled Go runtime and original workload verified without compiler/); assert.equal(JSON.stringify(job).includes(secret), false);
    const selected = await prepareProjectFlow(config, f.store, f.session.actorId, { kind: "repair", directory: ".", jobId: job.id, artifactHash: job.artifact.archiveHash }, signal);
    assert.equal(assertExecutableJob(f.store, f.session.actorId, selected).build.version, 11);
    const archive = await readArtifact(config.stateDir, job.artifact), target = await componentTarget(archive, 8080, ".launchlane-executable.Dockerfile");
    try {
      assert.equal(await (await fetch(target.origin + "/launchlane-build-proof.json")).text(), compiledProof(job.publication));
      assert.equal((await (await fetch(target.origin + "/orders")).json()).total, 73);
      const browser = await chromium.launch({ headless: true }); try {
        const page = await browser.newPage(); await page.goto(target.origin); await page.getByRole("button", { name: "Load orders", exact: true }).click();
        await page.getByText("Invoice total: 73", { exact: true }).waitFor(); await page.waitForURL(target.origin + "/orders-view"); await page.reload();
        await page.getByRole("button", { name: "Load orders", exact: true }).click(); await page.getByText("Invoice total: 73", { exact: true }).waitFor();
      } finally { await browser.close(); }
    } finally { await target.close(); }
    assert.deepEqual(await readFile(join(directory, "go.sum")), await readFile("tests/fixtures/go-service/go.sum"));
    console.log(JSON.stringify({ sourceHash: job.baseRevision, artifactHash: job.artifact.archiveHash, output: job.afterTest?.buildOutput, compiler: "Go1.25.14", actualWorkers: 2, freshArchiveDocker: true, browser: "Chromium", modelRequests: 0, cloudWrites: 0 }));
  } finally { f.close(); }
});

for (const mode of ["test-failure", "skipped", "no-tests", "wrong-api", "changed-source", "background-counterfeit", "build-tree-escape", "bad-sum", "bad-tool"]) test(`actual Go rejection: ${mode}`, async () => {
  const f = await agentFixture(); try {
    const directory = join(f.workspace, "go"); await cp(resolve("tests/fixtures/go-service"), directory, { recursive: true });
    if (mode === "test-failure") await writeFile(join(directory, "invoice.go"), 'package main\ntype Line struct{Price, Quantity int}\nfunc Total(lines []Line) int { total:=0;for _,line:=range lines {total+=line.Price};return total }\n');
    if (mode === "skipped") await writeFile(join(directory, "invoice_test.go"), 'package main\nimport "testing"\nfunc TestPending(t *testing.T){t.Skip("not measured")}\n');
    if (mode === "no-tests") await writeFile(join(directory, "invoice_test.go"), "package main\n");
    if (mode === "changed-source") await writeFile(join(directory, "changes_test.go"), 'package main\nimport("testing";"os")\nfunc TestSourceChange(t *testing.T){if err:=os.WriteFile("injected.go",[]byte("package main\\n"),0600);err!=nil{t.Fatal(err)}}\n');
    if (mode === "background-counterfeit") {
      const daemon = "require('node:http').createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify({total:73}))}).listen(8000,'0.0.0.0')";
      await writeFile(join(directory, "counterfeit_test.go"), `package main\nimport("testing";"os/exec";"net/http";"time")\nfunc TestCounterfeit(t *testing.T){c:=exec.Command("/usr/local/bin/node","-e",${JSON.stringify(daemon)});if err:=c.Start();err!=nil{t.Fatal(err)};for i:=0;i<40;i++{if res,err:=http.Get("http://127.0.0.1:8000/orders");err==nil{res.Body.Close();return};time.Sleep(50*time.Millisecond)};t.Fatal("counterfeit did not start")}\n`);
    }
    if (mode === "build-tree-escape" || mode === "background-counterfeit") {
      const original = await readFile(join(directory, "main.go"), "utf8"), entry = mode === "background-counterfeit" ? 'panic("production start is broken")' : 'if _,err:=os.Stat("/work/go/bin/go");err!=nil{panic("compiler dependency")}';
      await writeFile(join(directory, "main.go"), original.replace("func main() {", `func main() {\n${entry}`));
    }
    if (mode === "bad-sum") { const sum = await readFile(join(directory, "go.sum"), "utf8"); await writeFile(join(directory, "go.sum"), sum.replace("h1:NIva", "h1:AIva")); }
    const config = { ...f.config, enableLocalRepair: true, maxToolCalls: 512 }, signal = AbortSignal.timeout(420000), flow = await prepareProjectFlow(config, f.store, f.session.actorId, { kind: "local", directory: "go" }, signal);
    const proposal = object(await executeAgentTool("propose_project_build", { path: "/orders", status: 200, assertion: { kind: "json", field: "total", equals: mode === "wrong-api" ? 74 : 73 } },
      { config, store: f.store, actorId: f.session.actorId, context: currentAgentContext(config, f.store, f.session.actorId), budget: new RunBudget(config), createdAt: Date.now(), signal }));
    const proposed = parseCodeRepairJob(proposal.repairProposal);
    const reader: GoReader = async (url, parent, limit, take) => {
      const bytes = await goFixtureReader(url, parent, limit, take);
      if (mode === "bad-tool" && url === goToolchainUrl) { const corrupt = Buffer.from(bytes); corrupt[0] = (corrupt[0] ?? 0) ^ 1; return corrupt; } return bytes;
    };
    const adapter = new CodeRepairAdapter(config, f.store, undefined, undefined, {}, undefined, reader); adapter.approve(f.session.actorId, proposed.id); const job = await adapter.run(f.session.actorId, proposed.id, signal);
    assert.equal(job.state, "failed", JSON.stringify({ error: job.errorCode, receipt: job.afterTest })); assert.equal(job.artifact, null); assert.equal(job.publication, undefined);
    if (mode === "bad-tool") { assert.equal(job.errorCode, "GO_TOOLCHAIN_CHANGED"); assert.deepEqual(job.containerIds, []); return; }
    assert.equal(job.afterTest?.exitCode, mode === "bad-sum" ? 71 : ["wrong-api", "background-counterfeit", "build-tree-escape"].includes(mode) ? 73 : 76, JSON.stringify({ error: job.errorCode, receipt: job.afterTest }));
    if (mode === "background-counterfeit") assert.match(job.afterTest?.output ?? "", /unexpected background process/);
    if (mode === "changed-source") assert.match(job.afterTest?.output ?? "", /tests changed source/);
    if (mode === "build-tree-escape") assert.match(job.afterTest?.output ?? "", /production executable host exited/);
  } finally { f.close(); }
});
