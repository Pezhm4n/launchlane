import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { missionAuthorityFixture } from "../helpers/mission-authority-fixture.ts";
import { decideMissionAuthority } from "../../src/server/application/mission-authority.ts";
import { driveAgentRun } from "../../src/server/agent/runs.ts";
import { parseCodeRepairJob } from "../../src/contracts/code-repair.ts";
import { createPublicationMission } from "../../src/server/application/publication-mission.ts";
import { randomUUID } from "node:crypto";

for (const version of ["22", "24"] as const) test(`one Node${version} plan drives actual isolated build failure, rejects an ineffective patch, repairs, tests and publishes only its exact artifact without another decision`, async () => {
  const f = await missionAuthorityFixture(true, false, version), authority = f.proposed.authority, actor = f.session.actorId;
  try {
    assert.ok(authority); assert.equal(authority.state, "proposed");
    assert.equal(authority.plan.build.nodeVersion, version);
    const original = readFileSync(join(f.project, "invoice.mjs"), "utf8");
    assert.equal(f.counts().sends, 0); assert.equal(f.counts().patches, 0);
    await decideMissionAuthority(f.config, f.store, f.session, f.proposed.id, f.proposed.revision, authority.id, authority.hash, "approve");
    await driveAgentRun(f.config, f.store, f.session, f.proposed.id, f.dependencies);
    const run = f.repo.get(actor, f.proposed.id);
    assert.ok(run); assert.equal(run.state, "completed", JSON.stringify(run));
    assert.equal(run.effect, "remote_changes_verified"); assert.equal(f.counts().patches, 2); assert.equal(f.counts().sends, 2);
    const jobs = f.store.db.prepare("SELECT data_json,state FROM code_repair_jobs WHERE actor_id=? ORDER BY rowid").all(actor)
      .map(row => parseCodeRepairJob({ ...JSON.parse(String(row.data_json)).job, state: row.state }));
    assert.equal(jobs.length, 3); assert.equal(jobs[0]?.validationOnly, true); assert.equal(jobs[0]?.state, "failed");
    assert.equal(jobs[1]?.state, "failed"); assert.equal(jobs[1]?.afterTest?.passed, false); assert.equal(jobs[1]?.artifact, null);
    assert.equal(jobs[2]?.state, "succeeded"); assert.equal(jobs[2]?.beforeTest?.passed, false); assert.equal(jobs[2]?.afterTest?.passed, true);
    assert.ok(run.repair?.artifact); assert.equal(run.publication?.spec.version, 7);
    assert.ok(run.publication && "artifactHash" in run.publication.spec);
    assert.equal(run.publication.spec.artifactHash, run.repair.artifact.archiveHash);
    assert.notEqual(run.repair.artifact.sourceHash, authority.plan.rootSourceHash);
    assert.equal(f.store.db.prepare("SELECT count(*) n FROM mission_artifacts").get()?.n, 1);
    assert.equal(f.store.db.prepare("SELECT count(*) n FROM mission_steps").get()?.n, 4);
    assert.equal(readFileSync(join(f.project, "invoice.mjs"), "utf8"), original);
    const before = f.counts(); await driveAgentRun(f.config, f.store, f.session, run.id, f.dependencies);
    const replay = await createPublicationMission(f.config, f.store, f.session, randomUUID(), { projectId: f.flow.id, sourceHash: f.flow.profile.sourceHash, path: "/", expectedText: "invoice service" }, AbortSignal.timeout(5000));
    assert.equal(replay.created, false); assert.equal(replay.run.id, run.id); assert.deepEqual(replay.run.usage, run.usage);
    assert.deepEqual(f.counts(), before); assert.equal(f.store.db.prepare("SELECT count(*) n FROM attempts").get()?.n, 1);
  } finally { f.close(); }
});

test("a raw dependency-free project without a manufactured lockfile follows the same bounded repair and publication path", async () => {
  const f = await missionAuthorityFixture(false, true), authority = f.proposed.authority;
  try {
    assert.ok(authority); assert.equal(authority.plan.build.version, 1); assert.equal(authority.plan.build.install, "none");
    await decideMissionAuthority(f.config, f.store, f.session, f.proposed.id, f.proposed.revision, authority.id, authority.hash, "approve");
    await driveAgentRun(f.config, f.store, f.session, f.proposed.id, f.dependencies);
    const run = f.repo.get(f.session.actorId, f.proposed.id); assert.ok(run);
    assert.equal(run.state, "completed", JSON.stringify(run)); assert.equal(f.counts().patches, 1);
    assert.ok(run.repair?.afterTest?.passed); assert.match(run.repair.afterTest.command, /^no dependencies to install/);
    const flow = f.store.getProjectFlow(f.session.actorId); assert.ok(flow);
    assert.equal(flow.profile.manifest.some(file => file.path === "package-lock.json"), false);
    assert.ok(run.publication && "artifactHash" in run.publication.spec); assert.equal(run.publication.spec.artifactHash, run.repair.artifact?.archiveHash);
    assert.equal(f.counts().sends, 2);
  } finally { f.close(); }
});
