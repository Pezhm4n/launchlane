import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { assertDockerExecutionSettled } from "../../src/server/agent/code-repair.ts";
import { missionJobScopeHash } from "../../src/server/policy/mission-authority.ts";
import { parseCodeRepairJob } from "../../src/contracts/code-repair.ts";
import { dockerVerifierImage } from "../../src/contracts/docker-build.ts";

test("a lost daemon execution blocks the next sandbox even before its caller can save an interrupted state", async () => {
  const f = await agentFixture(), id = randomUUID(), next = randomUUID();
  try {
    const job = { build: { version: 6 }, dockerExecutionStarted: true, errorCode: null };
    f.store.db.prepare("INSERT INTO code_repair_jobs VALUES (?,?,?,?,?)").run(id, "another-actor", "working", Date.now(), JSON.stringify({ job }));
    assert.doesNotThrow(() => assertDockerExecutionSettled(f.store), "a running owner can still have proposals queued");
    assert.doesNotThrow(() => assertDockerExecutionSettled(f.store, id));
    assert.throws(() => assertDockerExecutionSettled(f.store, next), { code: "SANDBOX_RECONCILIATION_REQUIRED" }, "the released semaphore cannot authorize a second daemon write before settlement");
    f.store.db.prepare("UPDATE code_repair_jobs SET state='interrupted' WHERE id=?").run(id);
    assert.throws(() => assertDockerExecutionSettled(f.store), { code: "SANDBOX_RECONCILIATION_REQUIRED" });
    f.store.db.prepare("UPDATE code_repair_jobs SET data_json=? WHERE id=?").run(JSON.stringify({ job: { build: { version: 6 }, errorCode: null } }), id);
    assert.doesNotThrow(() => assertDockerExecutionSettled(f.store), "a queued job interrupted before engine entry has no daemon write to replay");
    f.store.db.prepare("UPDATE code_repair_jobs SET data_json=? WHERE id=?").run(JSON.stringify({ job: { build: { version: 6 }, errorCode: "SANDBOX_BUILD_UNCERTAIN" } }), id);
    assert.throws(() => assertDockerExecutionSettled(f.store), { code: "SANDBOX_RECONCILIATION_REQUIRED" });
  } finally { f.close(); }
});
test("the built Docker image is outcome evidence and cannot mutate the preapproved job scope", () => {
  const job = parseCodeRepairJob({ id: randomUUID(), parentRunId: null, projectId: randomUUID(), baseRevision: "1".repeat(64), state: "proposed", goal: "Controlled Docker job",
    allowedPaths: [], testFiles: [], changedPaths: [], diff: null, beforeTest: null, afterTest: null, artifact: null, errorCode: null, message: "fixture", createdAt: Date.now(), updatedAt: Date.now(), execution: "container", containerIds: [],
    build: { version: 6, nodeVersion: null, image: null, runtime: { kind: "docker", contextRoot: ".", dockerfile: "Dockerfile", dockerfileHash: "2".repeat(64), port: 8080 },
      sourceHash: "1".repeat(64), baseImages: [], verifierImage: dockerVerifierImage, buildCommand: null, testCommand: null, startCommand: "liara-docker", port: 8080,
      workload: { path: "/", status: 200, assertion: { kind: "text", contains: "controlled workload" } } }, validationOnly: true });
  const before = missionJobScopeHash(job), after = parseCodeRepairJob({ ...job, builtImage: `sha256:${"3".repeat(64)}`, dockerExecutionStarted: true });
  assert.equal(missionJobScopeHash(after), before); assert.equal(after.containerImage, undefined); assert.ok(after.builtImage);
  assert.throws(() => parseCodeRepairJob({ ...job, builtImage: "floating:latest" }));
});
