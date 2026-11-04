import assert from "node:assert/strict";
import { cp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { planDeviceFolder } from "../../src/contracts/folder-upload.ts";
import { assertPublicNugetConfig } from "../../src/contracts/nuget-config.ts";
import { dockerProjectBuild } from "../../src/server/agent/build-policy.ts";
import { currentAgentContext, executeAgentTool, toolsForAgent } from "../../src/server/agent/tools.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import { saveImportedEnvironment } from "../../src/server/environment/import.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";
import { CodeRepairAdapter } from "../../src/server/agent/code-repair.ts";
import { parseCodeRepairJob } from "../../src/contracts/code-repair.ts";
import { object } from "../../src/contracts/validation.ts";
import { captureProject } from "../../src/server/workspace/inspect.ts";
import { readFolderUpload } from "../../src/server/workspace/upload.ts";
import { filterSourceFiles } from "../../src/server/workspace/source-ignore.ts";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { randomUUID } from "node:crypto";
import { createAgentRun, decideAgentRepair } from "../../src/server/agent/runs.ts";
import { AgentRepository } from "../../src/server/agent/store.ts";

const config = '<configuration><packageSources><clear/><add value="https://api.nuget.org/v3/index.json" key="nuget.org" protocolVersion="3"/></packageSources></configuration>';
const unsafe = config.replace("</configuration>", "<packageSourceCredentials><feed/></packageSourceCredentials></configuration>");

test("the shared Agent decision accepts Docker's source image recipe and rejects a substituted Node image", async () => {
  const f = await agentFixture();
  try {
    await cp("tests/fixtures/dotnet-orders", join(f.workspace, "orders"), { recursive: true });
    const config = { ...f.config, enableLocalRepair: true }, actor = f.session.actorId, signal = AbortSignal.timeout(10000);
    const flow = await prepareProjectFlow(config, f.store, actor, { kind: "local", directory: "orders" }, signal);
    const run = createAgentRun(config, f.store, f.session, randomUUID(), "بررسی برنامه", flow.id).run;
    const repo = new AgentRepository(f.store);
    run.state = "working";
    repo.save(actor, run);
    const proposed = object(await executeAgentTool("propose_project_build", {
      path: "/api/orders", status: 200, assertion: { kind: "json", field: "total", equals: 73 },
    }, { config, store: f.store, actorId: actor, context: run.context, parentRunId: run.id,
      createdAt: Date.now(), budget: new RunBudget(config), signal }));
    run.repair = parseCodeRepairJob(proposed.repairProposal);
    run.state = "needs_approval";
    run.repairDecision = { sessionId: f.session.id, expiresAt: Date.now() + 60000, consumed: false };
    repo.save(actor, run);
    f.store.db.prepare("UPDATE code_repair_jobs SET data_json=json_set(data_json,'$.job.containerImage',?) WHERE actor_id=? AND id=?").run("substituted-image", actor, run.repair.id);
    await assert.rejects(decideAgentRepair(config, f.store, f.session, run.id, run.revision, run.repair.id, "approve"), { code: "HISTORICAL_RUNNER_DISABLED" });
    f.store.db.prepare("UPDATE code_repair_jobs SET data_json=json_remove(data_json,'$.job.containerImage') WHERE actor_id=? AND id=?").run(actor, run.repair.id);
    const accepted = await decideAgentRepair(config, f.store, f.session, run.id, run.revision, run.repair.id, "approve");
    assert.equal(accepted.state, "queued"); assert.equal(accepted.repairDecision?.consumed, true);
    assert.deepEqual(accepted.repair?.containerIds, []);
  } finally { f.close(); }
});

test("public NuGet sources survive device and HTTP intake, while private config fails both boundaries", async () => {
  assertPublicNugetConfig(config);
  const kept = filterSourceFiles([
    { path: ".gitignore", content: Buffer.from("scratch/\n") },
    { path: "scratch/NuGet.Config", content: Buffer.from(unsafe) },
    { path: "NuGet.Config", content: Buffer.from(config) },
  ]);
  assert.deepEqual(kept.map(file => file.path), [".gitignore", "NuGet.Config"]);
  for (const value of [unsafe, config.replace("nuget.org/v3", "nuget.org/private?token=x/v3"),
    config.replace("<clear/>", "<!ENTITY x SYSTEM 'private'>"), config.replace('key="nuget.org"', 'key="nuget.org" key="nuget.org"')]) {
    assert.throws(() => assertPublicNugetConfig(value), { code: "NUGET_CONFIG_UNSUPPORTED" });
  }
  for (const value of [config, unsafe]) {
    const device = planDeviceFolder([{ webkitRelativePath: "Orders/NuGet.Config", size: value.length, text: async () => value }]);
    const form = new FormData();
    form.set("manifest", JSON.stringify({ name: "Orders", paths: ["NuGet.Config"] }));
    form.set("file-0", new Blob([value]), "NuGet.Config");
    const upload = () => readFolderUpload(new Request("http://localhost", { method: "POST", body: form }));
    if (value === config) {
      assert.deepEqual((await device).files, [{ path: "NuGet.Config", index: 0 }]);
      assert.equal((await upload()).files[0]?.content.toString(), config);
    } else {
      await assert.rejects(device, { code: "NUGET_CONFIG_UNSUPPORTED" });
      await assert.rejects(upload(), { code: "NUGET_CONFIG_UNSUPPORTED" });
    }
  }
});

test("the local Docker proposal binds the original .NET solution, package sources and literal stage configuration", async () => {
  const f = await agentFixture();
  try {
    const dir = join(f.workspace, "orders");
    await cp("tests/fixtures/dotnet-orders", dir, { recursive: true });
    const captured = await captureProject(dir, ".");
    for (const path of ["Orders.slnx", "NuGet.Config", "Orders/packages.lock.json", "Checks/packages.lock.json"]) {
      assert.ok(captured.profile.manifest.some(row => row.path === path), path);
    }
    const names = toolsForAgent({ ...f.config, enableLocalRepair: true }, "docker", false, true).map(tool => tool.function.name);
    assert.ok(names.includes("propose_project_build"));
    assert.ok(!names.includes("propose_publication"));
    const workload = { path: "/api/orders", status: 200, assertion: { kind: "json", field: "total", equals: 73 } } as const;
    const plan = dockerProjectBuild(captured.files, captured.profile, workload, null);
    assert.equal(plan.baseImages.length, 2);
    const original = await readFile(join(dir, "Dockerfile"), "utf8");
    for (const command of ["ARG BUILD_CONFIGURATION", "ARG HTTP_PROXY=Release", "ARG BUILD_CONFIGURATION=$PROXY"]) {
      await writeFile(join(dir, "Dockerfile"), original.replace("ARG BUILD_CONFIGURATION=Release", command));
      const changed = await captureProject(dir, ".");
      assert.throws(() => dockerProjectBuild(changed.files, changed.profile, workload, null), { code: "DOCKERFILE_AUTHORITY_DENIED" });
    }
    await writeFile(join(dir, "NuGet.Config"), unsafe);
    await assert.rejects(captureProject(dir, "."), { code: "NUGET_CONFIG_UNSUPPORTED" });
  } finally { f.close(); }
});

test("a Docker build before destination selection cannot silently omit a recorded runtime input", async () => {
  const f = await agentFixture();
  try {
    const directory = join(f.workspace, "orders"), signal = AbortSignal.timeout(10000);
    await cp("tests/fixtures/dotnet-orders", directory, { recursive: true });
    await writeFile(join(directory, "configuration.js"), "export const label = process.env.ORDERS_LABEL;");
    const config = { ...f.config, enableLocalRepair: true }, actor = f.session.actorId;
    const flow = await prepareProjectFlow(config, f.store, actor, { kind: "local", directory: "orders" }, signal);
    assert.ok(flow.profile.envNames.includes("ORDERS_LABEL"));
    const propose = () => executeAgentTool("propose_project_build", {
      path: "/api/orders", status: 200, assertion: { kind: "json", field: "total", equals: 73 },
    }, { config, store: f.store, actorId: actor, context: currentAgentContext(config, f.store, actor), createdAt: Date.now(), budget: new RunBudget(config), signal });
    const approved = parseCodeRepairJob(object(await propose()).repairProposal);
    const adapter = new CodeRepairAdapter(config, f.store);
    adapter.approve(actor, approved.id);
    saveImportedEnvironment(config, f.store, actor, flow, [{ key: "ORDERS_LABEL", value: "disposable-label" }]);
    await assert.rejects(propose(), { code: "DOCKER_ENV_TARGET_REQUIRED" });
    const refused = await adapter.run(actor, approved.id, signal);
    assert.equal(refused.errorCode, "DOCKER_ENV_TARGET_REQUIRED");
    assert.deepEqual(refused.containerIds, []);
    assert.equal(refused.artifact, null);
  } finally { f.close(); }
});
