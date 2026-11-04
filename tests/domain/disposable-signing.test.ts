import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseDisposableTestDatabase } from "../../src/contracts/test-database.ts";
import { parseCodeRepairJob } from "../../src/contracts/code-repair.ts";
import { object } from "../../src/contracts/validation.ts";
import { fingerprint } from "../../src/server/policy/action.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";
import { disposableDatabaseProgram, disposableSigningValues } from "../../src/server/agent/test-database.ts";
import { currentAgentContext, executeAgentTool } from "../../src/server/agent/tools.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import { runnerFixture, runnerBuildInput } from "../helpers/runner-fixture.ts";
import { runContainerBuild, type docker } from "../../src/server/agent/container.ts";
import type { PostgresFixtureBinding } from "../../src/server/agent/postgres-fixture.ts";
import { sandboxProxyKeys } from "../../src/server/agent/docker-proxy.ts";

async function fixture() {
  const f = await runnerFixture();
  try {
    const input = await runnerBuildInput(), context = () => ({ config: f.config, store: f.store, actorId: f.session.actorId,
      context: currentAgentContext(f.config, f.store, f.session.actorId), createdAt: Date.now(), budget: new RunBudget(f.config), signal: AbortSignal.timeout(15000) });
    return { ...f, input, context };
  } catch (error) { f.close(); throw error; }
}

test("disposable signing keys require actual source reads and a reviewed proposal; host values never enter the plan", async () => {
  const f = await fixture(); try {
    const args = { ...f.input, compatibilityDatabase: { ...f.input.compatibilityDatabase, testSigningKeys: ["JWT_SECRET"] } };
    await assert.rejects(executeAgentTool("propose_project_build", args, f.context()), { code: "TEST_SIGNING_SOURCE_REQUIRED" });
    const server = join(f.project, "server.cjs"); await writeFile(server, `${await readFile(server, "utf8")}\nconst signing=process.env.JWT_SECRET;\n`);
    await prepareProjectFlow(f.config, f.store, f.session.actorId, { kind: "local", directory: "runner-service" }, AbortSignal.timeout(10000));
    const job = parseCodeRepairJob(object(await executeAgentTool("propose_project_build", args, f.context())).repairProposal);
    assert.ok(job.build?.version === 7 && job.build.testDatabase?.version === 3);
    assert.deepEqual(job.build.testDatabase.testSigningKeys, ["JWT_SECRET"]);
    assert.equal(job.state, "proposed"); assert.deepEqual(job.containerIds, []); assert.equal(job.afterTest, null);
    for (const value of [f.config.modelKey, f.config.operatorToken, f.config.sessionSecret]) assert.ok(!JSON.stringify(job).includes(value));
    const historical = { ...job.build.testDatabase }; delete historical.testSigningKeys;
    assert.equal(fingerprint(parseDisposableTestDatabase(historical)), fingerprint(historical));
    for (const testSigningKeys of [[], ["JWT_SECRET", "JWT_SECRET"], ["MODEL_API_KEY"], ["DATABASE_URL"], ["NEXT_PUBLIC_AUTH_SECRET"], [{ key: "JWT_SECRET", value: "not-accepted" }]])
      assert.throws(() => parseDisposableTestDatabase({ ...historical, testSigningKeys }), { code: "TEST_SIGNING_KEYS_INVALID" });
    await assert.rejects(executeAgentTool("propose_project_build", f.input, { ...f.context(), buildJob: job }), { code: "DATABASE_BASELINE_REVIEW_REQUIRED" });
    const failed = parseCodeRepairJob({ ...job, state: "failed", errorCode: "BUILD_TEST_FAILED", message: "controlled failed signing setup" });
    const next = parseCodeRepairJob(object(await executeAgentTool("propose_project_build", f.input, { ...f.context(), buildJob: failed })).repairProposal);
    assert.notEqual(next.id, job.id); assert.equal(next.state, "proposed"); assert.equal(next.afterTest, null);
    assert.ok(next.build?.version === 7 && next.build.testDatabase?.version === 3);
    assert.equal(next.build.testDatabase.testSigningKeys, undefined);
    assert.deepEqual(next.build.testDatabase.targets, job.build.testDatabase.targets);
  } finally { f.close(); }
});

test("fixture signing values stay stable across fresh worker inputs, differ across fixtures and reject mismatched payloads", async () => {
  const f = await fixture(); try {
    const job = parseCodeRepairJob(object(await executeAgentTool("propose_project_build", f.input, f.context())).repairProposal);
    assert.ok(job.build?.version === 7 && job.build.testDatabase?.version === 3);
    const plan = parseDisposableTestDatabase({ ...job.build.testDatabase, testSigningKeys: ["JWT_SECRET", "SESSION_SECRET"] });
    const values = disposableSigningValues(plan), other = disposableSigningValues(plan);
    assert.deepEqual(values.map(row => row.key), ["JWT_SECRET", "SESSION_SECRET"]);
    assert.ok(values.every((row, i) => /^[a-f0-9]{64}$/.test(row.value) && row.value !== other[i]?.value));
    const fixture = { host: "127.0.0.1", port: 5432, database: "launchlane_fixture", user: "launchlane_fixture", authentication: "isolated_trust",
      targets: job.build.testDatabase.targets.map((target, i) => ({ id: target.id, database: `launchlane_target_${i}`, user: `launchlane_app_${i}` })) };
    const worker = (testSigningValues: unknown, runnerPhase = false) => {
      const run: unknown = runInNewContext(`${disposableDatabaseProgram};disposableDatabaseValues`, {});
      assert.equal(typeof run, "function"); if (typeof run !== "function") throw Error("Worker missing");
      return object(run({ testDatabase: plan }, { environment: [], testDatabase: fixture, testSigningValues, ...(runnerPhase ? { runnerPhase: true } : {}) }));
    };
    const first = worker(values), second = worker(values);
    assert.deepEqual(JSON.parse(JSON.stringify(first)), JSON.parse(JSON.stringify(second)));
    for (const row of values) assert.equal(first[row.key], row.value);
    assert.equal(first.AUTH_DB_URL, "postgresql://launchlane_app_0@127.0.0.1:5432/launchlane_target_0");
    for (const changed of [[], values.slice(1), [...values, values[0]], values.map(row => ({ ...row, value: "real-or-missing-value" })), values.map(row => ({ ...row, key: "MODEL_API_KEY" }))])
      assert.throws(() => worker(changed), /invalid disposable signing inputs/);
    assert.equal(worker([], true).JWT_SECRET, undefined);
    assert.throws(() => worker(values, true), /invalid disposable signing inputs/);
    assert.ok(!JSON.stringify(plan).includes(values[0]?.value ?? "never-empty"));
  } finally { f.close(); }
});

test("Node worker transport sends reviewed disposable values only through stdin and redacts their output", async () => {
  const f = await fixture(); try {
    const job = parseCodeRepairJob(object(await executeAgentTool("propose_project_build", f.input, f.context())).repairProposal);
    assert.ok(job.build?.version === 7 && job.build.testDatabase?.version === 3);
    const database = parseDisposableTestDatabase({ ...job.build.testDatabase, testSigningKeys: ["JWT_SECRET"] });
    assert.ok(database.version === 3);
    const build = { ...job.build, testDatabase: database }, values = disposableSigningValues(database), value = values[0]?.value; assert.ok(value);
    const id = "e".repeat(64), sourceHash = f.flow.profile.sourceHash;
    const bound: PostgresFixtureBinding = { jobId: job.id, sourceHash, containerId: "d".repeat(64), networkMode: `container:${"d".repeat(64)}`,
      host: "127.0.0.1", port: 5432, database: "launchlane_fixture", user: "launchlane_fixture", authentication: "isolated_trust",
      targets: database.targets.map((target, i) => ({ id: target.id, database: `launchlane_target_${i}`, user: `launchlane_app_${i}` })) };
    let exists = false, executions = 0; const buffers: Buffer[] = [];
    const command: typeof docker = async (args, _signal, _max, input) => {
      assert.ok(!JSON.stringify(args).includes(value));
      const a = args.slice(2), result = (output = "", exitCode = 0) => ({ output, exitCode, signal: null });
      if (a[0] === "create") { exists = true; return result(id); }
      if (a[0] === "start") return result(id);
      if (a[0] === "inspect") {
        if (!exists) return result(`Error: No such container: ${id}`, 1);
        if (a.includes("{{json .State}}")) return result(JSON.stringify({ Running: true, OOMKilled: false }));
        return result(JSON.stringify({ id, name: `/launchlane-build-${job.id}`, image: build.image,
          labels: { "ir.launchlane.worker": "locked-build-v1", "ir.launchlane.job": job.id, "ir.launchlane.source": sourceHash },
          env: sandboxProxyKeys.map(key => `${key}=`), network: bound.networkMode, ports: null }));
      }
      if (a[0] === "exec") {
        assert.ok(input); const payload = JSON.parse(input.toString()); assert.deepEqual(payload.testSigningValues ?? [], executions % 2 === 0 ? [] : values);
        assert.deepEqual(payload.environment, []); assert.equal(payload.runnerPhase, executions % 2 === 0 ? true : undefined);
        buffers.push(input); executions++; return result(payload.testSigningValues?.length ? `output ${value}` : "migration has no signing inputs");
      }
      if (a[0] === "rm") { exists = false; return result(id); }
      throw Error(`Unexpected worker command ${a[0]}`);
    };
    const options = { command, endpoint: { socketPath: "/var/run/docker.sock" }, fixture: bound, expectedJobId: job.id, expectedSourceHash: sourceHash, testSigningValues: values };
    for (let i = 0; i < 4; i++) {
      const receipt = await runContainerBuild(f.project, f.directory, build, AbortSignal.timeout(3000), undefined, [], { ...options, ...(i % 2 === 0 ? { runnerPhase: true, testSigningValues: [] } : {}) });
      assert.equal(receipt.exitCode, 0); assert.equal(receipt.buildOutput, undefined); assert.ok(!receipt.output.includes(value));
    }
    assert.equal(executions, 4); assert.ok(buffers.every(buffer => buffer.every(byte => byte === 0)));
    await assert.rejects(runContainerBuild(f.project, f.directory, build, AbortSignal.timeout(3000), undefined, [], { ...options, testSigningValues: [] }), { code: "TEST_SIGNING_INPUT_CHANGED" });
    await assert.rejects(runContainerBuild(f.project, f.directory, job.build, AbortSignal.timeout(3000), undefined, [], options), { code: "TEST_SIGNING_INPUT_CHANGED" });
    await assert.rejects(runContainerBuild(f.project, f.directory, build, AbortSignal.timeout(3000), undefined, [], { ...options, runnerPhase: true }), { code: "TEST_SIGNING_INPUT_CHANGED" });
  } finally { f.close(); }
});
