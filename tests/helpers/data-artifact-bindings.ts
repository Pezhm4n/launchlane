import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { runnerFixture } from "./runner-fixture.ts";
import { sealCredential } from "../../src/server/connections/credentials.ts";
import { LiaraDatabaseReadClient } from "../../src/server/liara/database-read.ts";
import { LiaraAccountClient } from "../../src/server/liara/catalog.ts";
import { LiaraDatabaseCredentialsClient } from "../../src/server/liara/database-credentials.ts";
import { LiaraEnvironmentClient } from "../../src/server/liara/environment.ts";
import { createPublicationMission } from "../../src/server/application/publication-mission.ts";
import { driveAgentRun, decideAgentDatabase, continueAgentRun } from "../../src/server/agent/runs.ts";
import { executeAgentTool } from "../../src/server/agent/tools.ts";
import { AgentRepository } from "../../src/server/agent/store.ts";
import { proposeDatabaseEnvironment } from "../../src/server/application/database-environment.ts";
import { executeEnvironment, observeEnvironment } from "../../src/server/application/environment.ts";
import type { ModelPort } from "../../src/server/agent/model.ts";

/** Real application/approval/Store transitions; only integration transports and goal model are synthetic. */
export async function bindDataArtifactResources(f: Awaited<ReturnType<typeof runnerFixture>>, collapse = false) {
  const team = "a".repeat(24), accountId = "b".repeat(24), appId = "c".repeat(24), network = "d".repeat(24), app = "prepared-data-consumer";
  const config = { ...f.config, teamId: team, apps: [app], enableLiveLiara: true, enableMutations: true, liaraToken: "synthetic-prepared-database-key" };
  f.store.saveConnection(f.session.actorId, { source: "token", ciphertext: sealCredential(config.liaraToken, config.sessionSecret, f.session.actorId, "liara"), view: {
    provider: "liara", status: "connected", identityId: accountId, displayName: "Fixture", login: "fixture@example.test", teamName: "Fixture", teamId: team,
    checkedAt: Date.now(), selectedApp: app, apps: [{ id: appId, name: app, platform: "node" }],
  } });
  const ids = collapse ? ["e".repeat(24)] : ["e".repeat(24), "f".repeat(24)], resources = ids.map((id, i) => ({ _id: id, hostname: `existing-data-${i}`, type: "postgres", planID: "small", bundlePlanID: "basic" }));
  const read = new LiaraDatabaseReadClient(config, accountId, async url => new URL(url).pathname === "/v1/me"
    ? Response.json({ user: { _id: accountId }, team: { _id: team, balance: 0 }, databaseVersions: { postgres: [{ value: "16.4" }] }, plans: { databases: { small: { available: true, supports: ["postgres"], price: 100 } }, databaseBundlePlans: { small: { basic: { available: true, price: 10 } } } } })
    : Response.json({ databases: resources }));
  const account = new LiaraAccountClient(config, accountId, async url => new URL(url).pathname === `/v1/projects/${app}`
    ? Response.json({ project: { _id: appId, project_id: app, type: "node", planID: "app-small", bundlePlanID: "basic", network: { _id: network }, readOnlyRootFilesystem: true } })
    : Response.json({ networks: [{ _id: network, name: "fixture" }] }));
  const credentials = new LiaraDatabaseCredentialsClient(config, async url => { const resource = resources.find(row => new URL(url).pathname.endsWith(row._id)); assert.ok(resource);
    return Response.json({ database: { id: resource._id, hostname: resource.hostname, type: "postgres", version: "16.4", planID: "small", publicNetwork: false, network: { _id: network }, metaData: { privateNetwork: true }, username: "postgres", root_password: `synthetic-private-${resource._id}`, dbName: "postgres", internalPort: 5432 } }); });
  let values: { key: string; value: string }[] = [];
  const environment = new LiaraEnvironmentClient(config, async (_url, init) => { if (init.method === "POST") { values = JSON.parse(String(init.body)).variables; return Response.json({}); }
    return Response.json({ project: { _id: appId, project_id: app, type: "node", planID: "app-small", envs: values } }); });
  const flow = f.store.getProjectFlow(f.session.actorId); assert.ok(flow);
  const { run } = await createPublicationMission(config, f.store, f.session, randomUUID(), { projectId: flow.id, sourceHash: flow.profile.sourceHash, path: "/", expectedText: "Runner lifecycle" }, AbortSignal.timeout(10000));
  const repo = new AgentRepository(f.store); let slot = 0, calls = 0;
  const model: ModelPort = { async complete(_messages, _tools, budget, signal) { budget.take("model", signal); calls++;
    const name = calls % 2 === 1 ? "propose_database_attachment" : "finish_investigation";
    return { content: null, calls: [{ id: `data-bind-${calls}`, type: "function", function: { name, arguments: JSON.stringify(name === "propose_database_attachment"
      ? { consumerRoot: ".", databaseId: ids[collapse ? 0 : slot], bindingKeys: [slot ? "PROFILE_DB_URL" : "AUTH_DB_URL"] }
      : { state: "needs_input", nextAction: "configure_env", question: null, message: "اتصال تنظیمات از دادهٔ مقصد جداست." }) } }], usage: 4 };
  } };
  const tool = (name: string, args: unknown, c: Parameters<typeof executeAgentTool>[2]) => executeAgentTool(name, args, { ...c, database: read, account, databaseCredentials: credentials });
  const actions: string[] = [];
  for (slot = 0; slot < 2; slot++) {
    if (slot) { const previous = repo.get(f.session.actorId, run.id); assert.ok(previous); continueAgentRun(config, f.store, f.session, run.id, previous.revision, randomUUID(), "منبع بعدی همان پروژه را متصل کن"); }
    await driveAgentRun(config, f.store, f.session, run.id, { model, tool, database: { read, account, credentials }, pollDelayMs: 0 });
    const pending = repo.get(f.session.actorId, run.id); assert.ok(pending?.database); actions.push(pending.database.id);
    await decideAgentDatabase(config, f.store, f.session, run.id, pending.revision, pending.database.id, "approve");
    await driveAgentRun(config, f.store, f.session, run.id, { model, tool, database: { read, account, credentials }, pollDelayMs: 0 });
    const binding = await proposeDatabaseEnvironment(config, f.store, f.session, run.id, randomUUID(), AbortSignal.timeout(10000), { read, account, credentials, environment });
    f.store.decide(binding.id, f.session.actorId, f.session.id, binding.hash, "approve");
    await executeEnvironment(config, f.store, f.session, binding.id, AbortSignal.timeout(10000), { client: environment });
    await observeEnvironment(config, f.store, f.session, binding.id, AbortSignal.timeout(10000), { client: environment });
  }
  return { config, actions, values };
}
