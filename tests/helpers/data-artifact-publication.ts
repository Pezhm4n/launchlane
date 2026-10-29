import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import type { runnerFixture } from "./runner-fixture.ts";
import type { Config } from "../../src/server/config.ts";
import type { ProjectFlow } from "../../src/contracts/project-flow.ts";
import type { CodeRepairJob } from "../../src/contracts/code-repair.ts";
import type { EnvironmentVariable } from "../../src/contracts/environment.ts";
import type { ModelPort } from "../../src/server/agent/model.ts";
import { LiaraReadClient } from "../../src/server/liara/client.ts";
import { LiaraDeployClient } from "../../src/server/liara/deploy.ts";
import { LiaraEnvironmentClient } from "../../src/server/liara/environment.ts";
import { WorkloadProbe } from "../../src/server/liara/probe.ts";
import { readBuildOutput } from "../../src/server/agent/build-output-store.ts";
import { compiledProof, compiledProofPath } from "../../src/server/agent/fullstack-artifact.ts";
import { fullstackVerification } from "../../src/server/application/fullstack-verification.ts";
import { createAgentRun, driveAgentRun, decideAgentPublication } from "../../src/server/agent/runs.ts";
import { executeAgentTool } from "../../src/server/agent/tools.ts";
import { AgentRepository } from "../../src/server/agent/store.ts";

/** Actual Agent/approval/journal/observation; provider and public workload transports are synthetic. */
export async function publishDataArtifact(f: Awaited<ReturnType<typeof runnerFixture>>, base: Config,
  selected: ProjectFlow, job: CodeRepairJob, values: readonly EnvironmentVariable[]) {
  const connection = f.store.getConnection(f.session.actorId, "liara")?.view, app = connection?.apps.find(row => row.name === connection.selectedApp);
  assert.ok(connection && app && job.publication && job.artifact && job.afterTest?.buildOutput);
  const origin = `https://${app.name}.example.com`, config = { ...base, probeOrigins: { [app.name]: origin } };
  const output = await readBuildOutput(config.stateDir, job.afterTest.buildOutput, { sourceHash: job.publication.testedSourceHash, planHash: job.publication.planHash });
  const files = new Map(output.files.map(file => [`/${file.path}`, file.content.toString("utf8")]));
  const verification = await fullstackVerification(f.store, config.stateDir, f.session.actorId, selected, config.sessionSecret);
  const read = new LiaraReadClient(config, async url => Response.json(new URL(url).pathname.endsWith("/releases")
    ? { total: 1, currentRelease: "data-artifact-release", releases: [{ _id: "data-artifact-release", state: "READY", port: 3000 }] }
    : { project: { _id: app.id, project_id: app.name, type: "node", status: "Running", envs: values, planID: "app-small" } }));
  const environment = new LiaraEnvironmentClient(config, async (_url, request) => {
    assert.equal(request.method, "GET");
    return Response.json({ project: { _id: app.id, project_id: app.name, type: "node", envs: values, planID: "app-small" } });
  });
  let writes = 0, modelCalls = 0;
  const writer = new LiaraDeployClient(config, async (url, request) => {
    writes++;
    if (new URL(url).pathname.endsWith("/sources")) {
      assert.ok(request.body instanceof FormData); const archive = request.body.get("file"); assert.ok(archive instanceof Blob);
      assert.equal(createHash("sha256").update(Buffer.from(await archive.arrayBuffer())).digest("hex"), job.artifact?.archiveHash);
      return Response.json({ sourceID: "data-artifact-source" });
    }
    return Response.json({ releaseID: "data-artifact-release" });
  });
  const probe = new WorkloadProbe(config, async () => [{ address: "93.184.216.34", family: 4 }], async url => {
    const api = url.pathname.startsWith("/api/entry/"), body = url.pathname === compiledProofPath ? compiledProof(verification)
      : api ? JSON.stringify({ label: url.pathname.endsWith("/auth") ? "identity datum" : "profile datum" }) : files.get(url.pathname === "/" ? "/index.html" : url.pathname) ?? "";
    return { status: 200, body, bytes: Buffer.byteLength(body), durationMs: 1,
      contentType: api ? "application/json" : url.pathname.endsWith(".js") ? "application/javascript" : url.pathname.endsWith(".css") ? "text/css" : "text/html" };
  });
  const model: ModelPort = { async complete(_messages, _tools, budget, signal) { budget.take("model", signal); modelCalls++;
    return { content: null, calls: [{ id: `publish-data-${modelCalls}`, type: "function", function: { name: "propose_publication", arguments: JSON.stringify({ path: "/", status: 200, assertion: { kind: "text", contains: "Runner lifecycle" } }) } }], usage: 5 };
  } };
  const run = createAgentRun(config, f.store, f.session, randomUUID(), "نسخهٔ آزموده‌شده را با بررسی داده منتشر کن", selected.id).run;
  const dependencies = { model, tool: (name: string, args: unknown, context: Parameters<typeof executeAgentTool>[2]) => executeAgentTool(name, args, { ...context, read, environment }), deployment: { read, write: writer, probe, environment }, pollDelayMs: 0 };
  await driveAgentRun(config, f.store, f.session, run.id, dependencies);
  const repo = new AgentRepository(f.store), pending = repo.get(f.session.actorId, run.id);
  assert.ok(pending?.publication, JSON.stringify({ state: pending?.state, code: pending?.errorCode, events: pending?.events.slice(-3), results: pending?.messages.filter(message => message.role === "tool").slice(-2).map(message => message.content) }));
  assert.equal(pending.state, "needs_approval"); assert.equal(writes, 0);
  await decideAgentPublication(config, f.store, f.session, run.id, pending.revision, pending.publication.id, "approve");
  await driveAgentRun(config, f.store, f.session, run.id, dependencies);
  const result = repo.get(f.session.actorId, run.id); assert.ok(result?.publication);
  assert.equal(result.publication.state, "succeeded"); assert.equal(result.publication.deployment?.observation?.code, "WORKLOAD_VERIFIED");
  assert.equal(result.state, "partially_completed"); assert.equal(result.nextAction, "reply"); assert.equal(result.effect, "remote_changes_verified");
  assert.ok(result.events.some(event => event.kind === "assistant" && event.message.includes("دادهٔ واقعی مقصد هنوز مستقل بررسی نشده‌اند")));
  assert.equal(writes, 2); assert.equal(modelCalls, 1);
  const recovered = new AgentRepository(f.store).get(f.session.actorId, run.id); assert.ok(recovered);
  assert.equal(recovered.state, "partially_completed"); assert.deepEqual(recovered.usage, result.usage); assert.deepEqual(recovered.limits, result.limits);
  return { config, action: result.publication, read, environment, runId: run.id };
}
