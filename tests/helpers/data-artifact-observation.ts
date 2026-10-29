import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { runnerFixture } from "./runner-fixture.ts";
import type { bindDataArtifactResources } from "./data-artifact-bindings.ts";
import type { publishDataArtifact } from "./data-artifact-publication.ts";
import type { PostgresObserver } from "../../src/server/liara/postgres-observer.ts";
import { observeDatabaseData, databaseDataState } from "../../src/server/application/database-data.ts";
import { executeAgentTool, currentAgentContext } from "../../src/server/agent/tools.ts";
import { LiaraReadClient } from "../../src/server/liara/client.ts";
import { LiaraEnvironmentClient } from "../../src/server/liara/environment.ts";
import { LiaraDatabaseCredentialsClient } from "../../src/server/liara/database-credentials.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";
import { AppError } from "../../src/server/errors.ts";

/** Actual artifact/application/approval/provider-readback path; provider HTTP is synthetic, SQL uses the passed actual observer. */
export async function checkDataArtifact(f: Awaited<ReturnType<typeof runnerFixture>>, bound: Awaited<ReturnType<typeof bindDataArtifactResources>>,
  published: Awaited<ReturnType<typeof publishDataArtifact>>, observer: PostgresObserver, mutateData: () => Promise<void>) {
  const route = { accountId: "b".repeat(24), teamId: "a".repeat(24), networkId: "d".repeat(24) };
  const config = { ...published.config, enableDatabaseDataReads: true, databaseReadNetworks: [route] }, actor = f.session.actorId, id = published.action.id,
    deps = { database: bound.read, credentials: bound.credentials, account: bound.account, read: published.read, environment: published.environment, observer },
    signal = () => AbortSignal.timeout(30000), count = () => f.store.db.prepare("SELECT count(*) n FROM database_data_observations").get()?.n;
  assert.deepEqual(databaseDataState(config, f.store, actor, id), { available: true, enabled: true, latest: null });
  for (const routes of [[], [{ ...route, accountId: "0".repeat(24) }], [{ ...route, teamId: "0".repeat(24) }], [{ ...route, networkId: "0".repeat(24) }]]) {
    const denied = { ...config, databaseReadNetworks: routes }, budget = new RunBudget({ ...config, maxToolCalls: 120 });
    assert.equal(databaseDataState(denied, f.store, actor, id).enabled, false);
    await assert.rejects(observeDatabaseData(denied, f.store, actor, id, null, signal(), { ...deps, budget }), value => value instanceof AppError && value.code === "DATABASE_DATA_NETWORK_NOT_AUTHORIZED");
    assert.equal(budget.toolCalls, 0, "Network scope must be rejected before provider credentials or SQL are requested");
  }
  const first = await observeDatabaseData(config, f.store, actor, id, null, signal(), deps);
  assert.equal(first.outcome, "verified"); assert.equal(first.targets.length, 2); assert.equal(first.comparison, "not_requested");
  assert.equal(first.migrationVerified, false); assert.equal(first.applicationWriteVerified, false); assert.equal(first.restartPersistenceVerified, false);
  const second = await observeDatabaseData(config, f.store, actor, id, first.id, signal(), deps);
  assert.equal(second.comparison, "same_selected_values");
  assert.equal(databaseDataState(config, f.store, actor, id).latest?.id, second.id); assert.equal(count(), 2);
  await mutateData();
  const changed = await executeAgentTool("read_database_data", { actionId: id, baselineId: second.id }, { config, store: f.store, actorId: actor,
    context: currentAgentContext(config, f.store, actor), createdAt: Date.now(), budget: new RunBudget({ ...config, maxToolCalls: 120 }), signal: signal(),
    database: bound.read, databaseCredentials: bound.credentials, account: bound.account, read: published.read, environment: published.environment, postgresObserver: observer });
  assert.ok(typeof changed === "object" && changed !== null && "comparison" in changed); assert.equal(changed.comparison, "selected_values_changed"); assert.equal(count(), 3);
  const bytes = JSON.stringify(changed), privateRows = f.store.db.prepare("SELECT private_json FROM database_data_observations WHERE actor_id=?").all(actor);
  assert.ok(!bytes.includes("privatePersistence") && !bytes.includes("postgresql://") && !bytes.includes("synthetic-private"));
  assert.ok(privateRows.length === 3 && privateRows.every(row => typeof row.private_json === "string" && !bytes.includes(row.private_json)));
  const error = (code: string) => (value: unknown) => value instanceof AppError && value.code === code;
  await assert.rejects(observeDatabaseData(config, f.store, actor, id, randomUUID(), signal(), deps), error("DATABASE_DATA_BASELINE_CHANGED"));
  await assert.rejects(observeDatabaseData(config, f.store, "another-actor", id, null, signal(), deps));
  const wrongRelease = new LiaraReadClient(config, async () => Response.json({ total: 1, currentRelease: "different-release", releases: [{ _id: "different-release", state: "READY", port: 3000 }] }));
  await assert.rejects(observeDatabaseData(config, f.store, actor, id, null, signal(), { ...deps, read: wrongRelease }), error("DATABASE_DATA_RELEASE_CHANGED"));
  const wrongEnv = new LiaraEnvironmentClient(config, async () => Response.json({ project: { _id: "c".repeat(24), project_id: config.apps[0], type: "node", planID: "app-small", envs: [] } }));
  await assert.rejects(observeDatabaseData(config, f.store, actor, id, null, signal(), { ...deps, environment: wrongEnv }), error("DATABASE_DATA_ENV_CHANGED"));
  const lostPrivateDetail = new LiaraDatabaseCredentialsClient(config, async () => Response.json({ database: { id: "0".repeat(24) } }));
  await assert.rejects(observeDatabaseData(config, f.store, actor, id, null, signal(), { ...deps, credentials: lostPrivateDetail }), error("DATABASE_CREDENTIALS_UNAVAILABLE"));
  const missingNetwork = new LiaraDatabaseCredentialsClient(config, async (url, init) => {
    const response = await bound.credentials.send(url, init), value: unknown = await response.json();
    assert.ok(value && typeof value === "object" && "database" in value && value.database && typeof value.database === "object");
    const { network: _network, ...details } = { ...value.database, network: "network" in value.database ? value.database.network : undefined };
    return Response.json({ ...value, database: details });
  });
  await assert.rejects(observeDatabaseData(config, f.store, actor, id, null, signal(), { ...deps, credentials: missingNetwork }), error("DATABASE_DATA_RESOURCE_UNVERIFIED"));
  const lateRelease = new LiaraReadClient(config, async () => Response.json({ total: 1, currentRelease: "different-release", releases: [] }));
  let reads = 0;
  const during = new LiaraReadClient(config, async (url, init) => { reads++; return reads === 1 ? published.read.send(url, init) : lateRelease.send(url, init); });
  await assert.rejects(observeDatabaseData(config, f.store, actor, id, null, signal(), { ...deps, read: during }), error("DATABASE_DATA_RELEASE_CHANGED"));
  assert.equal(count(), 3, "inconclusive scope/env/identity failures must not manufacture data receipts");
  const action = f.store.getAction(id, actor); assert.equal(action.state, "succeeded"); assert.equal(action.remoteId, published.action.remoteId);
  assert.equal(f.store.db.prepare("SELECT count(*) n FROM actions").get()?.n, 5);
}
