import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { agentFixture, repairCorrectSource } from "./agent-fixture.ts";
import { sealCredential } from "../../src/server/connections/credentials.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import { createPublicationMission } from "../../src/server/application/publication-mission.ts";
import { proposeMissionAuthority } from "../../src/server/application/mission-authority.ts";
import { driveAgentRun } from "../../src/server/agent/runs.ts";
import { AgentRepository } from "../../src/server/agent/store.ts";
import { GoalModelClient } from "../../src/server/agent/model.ts";
import { executeAgentTool } from "../../src/server/agent/tools.ts";
import { LiaraReadClient } from "../../src/server/liara/client.ts";
import { LiaraAccountClient } from "../../src/server/liara/catalog.ts";
import { LiaraDeployClient } from "../../src/server/liara/deploy.ts";
import { WorkloadProbe } from "../../src/server/liara/probe.ts";
import { ensure } from "../../src/server/errors.ts";
import { object, string, text } from "../../src/contracts/validation.ts";

export async function missionAuthorityFixture(ineffectiveFirst = false, withoutLock = false) {
  const f = await agentFixture(), actor = f.session.actorId, app = "authority-test", teamId = "a".repeat(24), appId = "b".repeat(24), origin = "https://authority-test.example.com";
  const config = { ...f.config, teamId, apps: [app], liaraToken: "synthetic-mission-provider-token", probeOrigins: { [app]: origin }, enableLiveLiara: true, enableMutations: true, enableLocalRepair: true, agentTimeoutMs: 600000 };
  writeFileSync(join(f.project, "package.json"), JSON.stringify({ name: "authority-test", version: "1.0.0", type: "module", engines: { node: "22.x" }, scripts: { start: "node server.mjs", build: "node --check server.mjs", test: "node --test invoice.test.mjs" } }));
  if (!withoutLock) writeFileSync(join(f.project, "package-lock.json"), JSON.stringify({ name: "authority-test", version: "1.0.0", lockfileVersion: 3, packages: { "": { name: "authority-test", version: "1.0.0", engines: { node: "22.x" } } } }));
  const flow = await prepareProjectFlow(config, f.store, actor, { kind: "local", directory: "service" }, AbortSignal.timeout(5000));
  f.store.saveConnection(actor, { source: "token", ciphertext: sealCredential("synthetic-mission-provider-token", config.sessionSecret, actor, "liara"), view: {
    provider: "liara", status: "connected", identityId: "mission-account", displayName: "آزمون", login: "test@example.test", teamId, teamName: "آزمون", checkedAt: Date.now(),
    selectedApp: app, apps: [{ id: appId, name: app, platform: "node" }] } });
  let sends = 0, patches = 0, turns = 0;
  const read = new LiaraReadClient(config, async url => Response.json(url.includes("/releases")
    ? { currentRelease: "mission-release", total: 1, releases: [{ _id: "mission-release", state: "READY", port: 3000 }] }
    : { project: { _id: appId, project_id: app, type: "node", status: "Running", planID: "existing-plan", envs: [] } }));
  const write = new LiaraDeployClient(config, async url => { sends++; return Response.json(url.includes("/sources") ? { sourceID: "mission-source.tar.gz" } : { releaseID: "mission-release" }); });
  const probe = new WorkloadProbe(config, async () => [{ address: "93.184.216.34", family: 4 }], async () => ({ status: 200, body: "invoice service", bytes: 15, durationMs: 2 }));
  const prices = { hourly: 100 };
  const account = new LiaraAccountClient(config, "mission-account", async url => Response.json(url.includes("/me")
    ? { user: { _id: "mission-account" }, team: { _id: teamId, balance: 10000 }, plans: { projects: { "existing-plan": { available: true, region: "iran", price: prices.hourly } }, projectBundlePlans: { "existing-plan": { basic: { available: true, price: 40 } } } } }
    : { project: { _id: appId, project_id: app, type: "node", planID: "existing-plan", bundlePlanID: "basic", network: { _id: "c".repeat(24) }, readOnlyRootFilesystem: true } }));
  const model = new GoalModelClient(config, async (_url, init) => {
    const packet = object(JSON.parse(String(init.body)));
    const tools = packet.tools, messages = packet.messages;
    ensure(Array.isArray(tools) && Array.isArray(messages), "INVALID_TEST_PACKET", "test packet invalid");
    let name: string, args: unknown;
    if (object(object(tools[0]).function).name === "submit_patch") {
      patches++;
      const input = object(JSON.parse(string(object(messages[1]).content, 100000))), files = input.files;
      ensure(Array.isArray(files), "INVALID_TEST_PACKET", "files missing");
      const source = object(files.find(file => object(file).path === "invoice.mjs"));
      name = "submit_patch"; args = { baseRevision: input.baseRevision, files: [{ path: "invoice.mjs", beforeHash: source.sha256,
        content: ineffectiveFirst && patches === 1 ? `${text(source.content, 24000)}\n// ineffective change retained as a failed regression\n` : repairCorrectSource }] };
    } else {
      turns++;
      if (turns === 1) { name = "propose_project_build"; args = { path: "/", status: 200, assertion: { kind: "text", contains: "invoice service" } }; }
      else if (turns === 2) { name = "read_project_file"; args = { path: "invoice.mjs" }; }
      else if (turns === 3 || ineffectiveFirst && turns === 4) { name = "propose_code_repair"; args = { goal: `تعداد اقلام در مبلغ فاکتور اعمال شود؛ تلاش ${turns - 2}.`, allowedPaths: ["invoice.mjs"], testFiles: [] }; }
      else { name = "propose_publication"; args = { path: "/", status: 200, assertion: { kind: "text", contains: "invoice service" } }; }
    }
    return Response.json({ choices: [{ finish_reason: "tool_calls", message: { role: "assistant", tool_calls: [{ id: randomUUID(), type: "function", function: { name, arguments: JSON.stringify(args) } }] } }], usage: { total_tokens: 60 } });
  });
  const dependencies = { model, authorityAccount: account, tool: (name: string, args: unknown, context: Parameters<typeof executeAgentTool>[2]) => executeAgentTool(name, args, { ...context, read }), deployment: { read, write, probe }, pollDelayMs: 1 };
  const repo = new AgentRepository(f.store), run = (await createPublicationMission(config, f.store, f.session, randomUUID(), { projectId: flow.id, sourceHash: flow.profile.sourceHash, path: "/", expectedText: "invoice service" }, AbortSignal.timeout(5000))).run;
  await driveAgentRun(config, f.store, f.session, run.id, dependencies);
  const pending = repo.get(actor, run.id);
  ensure(pending?.repair?.validationOnly, "INVALID_TEST_PACKET", "build proposal missing");
  const proposed = await proposeMissionAuthority(config, f.store, f.session, run.id, pending.revision, AbortSignal.timeout(5000), read, account);
  return { ...f, config, flow, repo, proposed, dependencies, prices, counts: () => ({ sends, patches, turns }) };
}
