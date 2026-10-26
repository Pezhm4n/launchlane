import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { node24BuildImage, parseProjectBuildPlan } from "../../src/contracts/project-build.ts";
import { workerSqliteProgramHash, workerSqliteStart, workerSqliteBuild } from "../../src/server/agent/worker-sqlite-programs.ts";
import { runContainerBuild, type docker } from "../../src/server/agent/container.ts";

test("private source inputs reach only the approved Worker stdin; the database is a bounded isolated test mount", async () => {
  const value = "controlled-private-worker-input", id = "a".repeat(64), calls: string[][] = [];
  const plan = parseProjectBuildPlan({ version: 7, nodeVersion: "24", image: node24BuildImage,
    fullstack: { version: 2, entryFile: "launchlane-worker-server.mjs", backendScript: "server", startCommand: workerSqliteStart, buildCommand: workerSqliteBuild,
      nodeVersion: "24", port: 3000, outputDirectory: "dist", packageRoots: ["."], outputPolicy: "compiled-v1", testScripts: [],
      workerSqlite: { version: 1, kind: "worker-sqlite", nodeVersion: "24", workerEntry: "worker/index.ts", databaseBinding: "DB", assetsBinding: "ASSETS", migrationsDirectory: "migrations",
        requiredEnvironmentKeys: ["SESSION_SECRET"], configHash: "b".repeat(64), programHash: workerSqliteProgramHash } },
    buildCommand: workerSqliteBuild, testCommand: null, startCommand: workerSqliteStart, port: 3000, workload: { path: "/", status: 200, assertion: { kind: "text", contains: "fixture" } },
    apiChecks: [{ path: "/launchlane-health", status: 200, assertions: [{ pointer: ["authenticationConfigured"], equals: true }] }], environment: null,
    sourceEnvironment: { version: 1, kind: "source_environment", projectId: randomUUID(), sourceHash: "c".repeat(64), fingerprint: "d".repeat(64), keys: ["SESSION_SECRET"] } });
  const command: typeof docker = async (args, _signal, _limit, input) => {
    calls.push(args);assert.equal(JSON.stringify(args).includes(value), false);
    if (args[0] === "create") return { output: id, exitCode: 0, signal: null };
    if (args[0] === "exec") { assert.ok(input?.includes(value));return { output: "controlled failed project oracle", exitCode: 73, signal: null }; }
    if (args[0] === "inspect") return { output: JSON.stringify({ Running: true, OOMKilled: false }), exitCode: 0, signal: null };
    return { output: "", exitCode: 0, signal: null };
  };
  const result = await runContainerBuild("/reviewed/source", "/reviewed/dependencies", plan, AbortSignal.timeout(5000), undefined, [{ key: "SESSION_SECRET", value }], { command });
  assert.equal(result.exitCode, 73);assert.equal(result.buildOutput, undefined);
  const create = calls.find(args => args[0] === "create");assert.ok(create);
  assert.ok(create.includes("/data:rw,nosuid,nodev,noexec,size=268435456,uid=1000,gid=1000,mode=0700"));
  assert.equal(create[create.indexOf("--network") + 1], "none");assert.ok(create.includes("--read-only"));assert.ok(create.includes("1000:1000"));
  assert.ok(create.includes("type=bind,source=/reviewed/source,target=/source,readonly"));
  assert.deepEqual(calls.at(-1), ["rm", "--force", id]);
  const before = calls.length;
  await assert.rejects(runContainerBuild("/reviewed/source", "/reviewed/dependencies", plan, AbortSignal.timeout(5000), undefined, [{ key: "UNREVIEWED", value }], { command }), { code: "ENV_REFERENCE_CHANGED" });
  assert.equal(calls.length, before, "changed input keys must fail before container creation");
});
