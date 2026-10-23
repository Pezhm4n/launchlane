import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { missionAuthorityFixture } from "../helpers/mission-authority-fixture.ts";
import { createPublicationMission, resumePublicationMission } from "../../src/server/application/publication-mission.ts";
import { proposeMissionAuthority, decideMissionAuthority } from "../../src/server/application/mission-authority.ts";
import { cancelAgentRun, driveAgentRun } from "../../src/server/agent/runs.ts";
import { AgentRepository } from "../../src/server/agent/store.ts";
import { toolsForAgent } from "../../src/server/agent/tools.ts";
import { Store } from "../../src/server/persistence/store.ts";
import { migrations } from "../../src/server/persistence/migrations.ts";
import { AppError } from "../../src/server/errors.ts";
import { CodeRepairAdapter } from "../../src/server/agent/code-repair.ts";
import { projectBuildImage } from "../../src/contracts/project-build.ts";

test("an old build-before-destination decision resumes its own paused owner without ignoring a competing decision", async () => {
  const f = await agentFixture();
  try {
    const config = { ...f.config, enableLocalRepair: true }, repo = new AgentRepository(f.store), run = (await createPublicationMission(config, f.store, f.session, randomUUID(), {
      projectId: f.flow.id, sourceHash: f.flow.profile.sourceHash, path: "/", expectedText: "invoice service" }, AbortSignal.timeout(5000))).run;
    run.state = "working"; repo.save(f.session.actorId, run);
    run.repair = await new CodeRepairAdapter(config, f.store).propose(f.session.actorId, { projectId: f.flow.id, parentRunId: run.id,
      expectedSourceHash: f.flow.profile.sourceHash, goal: "بررسی همان source", allowedPaths: [], testFiles: [], execution: "container", validationOnly: true,
      build: { version: 1, nodeVersion: "22", image: projectBuildImage, install: "none", buildCommand: null, testCommand: "node --test",
        startCommand: "node server.mjs", port: 3000, workload: { path: "/", status: 200, assertion: { kind: "text", contains: "invoice service" } } } }, AbortSignal.timeout(5000));
    run.state = "needs_approval"; run.usage.modelCalls = 5; run.usage.toolCalls = 5; run.usage.observedTokens = 23040; repo.save(f.session.actorId, run);
    const competingId = randomUUID(), competing = { ...run, id: competingId, requestKey: randomUUID(), repair: null };
    f.store.db.prepare("INSERT INTO agent_runs VALUES(?,?,?,?,?,?,?)").run(competingId, f.session.actorId, competing.requestKey, competing.revision, competing.state, competing.updatedAt, JSON.stringify(competing));
    await assert.rejects(resumePublicationMission(config, f.store, f.session, run.id, run.revision, randomUUID(), AbortSignal.timeout(5000)),
      (error: unknown) => error instanceof AppError && error.code === "AGENT_BUSY");
    f.store.db.prepare("DELETE FROM agent_runs WHERE id=?").run(competingId);
    const resumed = await resumePublicationMission(config, f.store, f.session, run.id, run.revision, randomUUID(), AbortSignal.timeout(5000));
    assert.equal(resumed.run.state, "queued"); assert.equal(resumed.run.repair, null); assert.equal(resumed.run.id, run.id);
    assert.deepEqual(resumed.run.usage, run.usage); assert.deepEqual(resumed.run.limits, run.limits);
    assert.equal(f.store.db.prepare("SELECT state FROM code_repair_jobs WHERE id=?").get(run.repair.id)?.state, "cancelled");
    assert.ok(resumed.run.messages.some(message => message.role === "user" && message.content.includes(`job ${run.repair?.id} was cancelled before execution`)));
    await driveAgentRun(config, f.store, f.session, run.id, { model: { complete: async (messages, tools, budget, signal) => {
      const state = messages.at(-1); assert.equal(state?.role, "system");
      assert.ok(state?.content?.includes('"repair":null,"destination":null,"network":null,"program":null'));
      assert.ok(!tools.some(tool => tool.function.name === "propose_project_build"));
      budget.take("model", signal);
      return { calls: [{ id: randomUUID(), type: "function", function: { name: "finish_investigation", arguments: JSON.stringify({
        state: "partially_completed", nextAction: "reply", question: null, message: "این پاسخ تأیید یا انتشار محسوب نمی‌شود." }) } }], content: null, usage: 9 };
    } } });
    assert.equal(repo.get(f.session.actorId, run.id)?.usage.modelCalls, 6);
  } finally { f.close(); }
});

test("cancelled publication resumes the same intent and remaining budget; duplicate resume does not register a new mission", async () => {
  const f = await agentFixture();
  try {
    const run = (await createPublicationMission(f.config, f.store, f.session, randomUUID(), { projectId: f.flow.id, sourceHash: f.flow.profile.sourceHash,
      path: "/", expectedText: "invoice ready" }, AbortSignal.timeout(5000))).run;
    const repo = new AgentRepository(f.store); run.usage.modelCalls = 3; run.usage.toolCalls = 7; run.usage.elapsedMs = 100; repo.save(f.session.actorId, run);
    const cancelled = cancelAgentRun(f.store, f.session.actorId, run.id, run.revision), key = randomUUID();
    const resumed = await resumePublicationMission(f.config, f.store, f.session, run.id, cancelled.revision, key, AbortSignal.timeout(5000));
    assert.equal(resumed.run.id, run.id); assert.equal(resumed.run.state, "queued"); assert.deepEqual(resumed.run.usage, run.usage);
    assert.deepEqual(resumed.run.limits, run.limits); assert.deepEqual(resumed.run.mission, run.mission);
    assert.equal((await resumePublicationMission(f.config, f.store, f.session, run.id, cancelled.revision, key, AbortSignal.timeout(5000))).created, false);
    assert.equal(f.store.db.prepare("SELECT count(*) n FROM agent_runs").get()?.n, 1); assert.equal(f.store.db.prepare("SELECT count(*) n FROM attempts").get()?.n, 0);
  } finally { f.close(); }
});

test("resume cannot race a cancelled but still running model owner", async () => {
  const f = await agentFixture();
  let release = () => {}, entered = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; }), ready = new Promise<void>(resolve => { entered = resolve; });
  try {
    const run = (await createPublicationMission(f.config, f.store, f.session, randomUUID(), { projectId: f.flow.id, sourceHash: f.flow.profile.sourceHash,
      path: "/", expectedText: "invoice ready" }, AbortSignal.timeout(5000))).run, repo = new AgentRepository(f.store);
    const work = driveAgentRun(f.config, f.store, f.session, run.id, { model: { complete: async (_messages, _tools, budget, signal) => {
      budget.take("model", signal); entered(); await gate; return { calls: [], content: "late response", usage: 5 };
    } } });
    await ready; const current = repo.get(f.session.actorId, run.id); assert.ok(current);
    const cancelled = cancelAgentRun(f.store, f.session.actorId, run.id, current.revision);
    await assert.rejects(resumePublicationMission(f.config, f.store, f.session, run.id, cancelled.revision, randomUUID(), AbortSignal.timeout(5000)),
      (error: unknown) => error instanceof AppError && error.code === "AGENT_STOPPING");
    release(); await work;
    const ended = repo.get(f.session.actorId, run.id); assert.ok(ended);
    const resumed = await resumePublicationMission(f.config, f.store, f.session, run.id, ended.revision, randomUUID(), AbortSignal.timeout(5000));
    assert.equal(resumed.run.state, "queued"); assert.equal(resumed.run.usage.modelCalls, 1);
  } finally { release(); f.close(); }
});

test("cancel/restart can propose a fresh program with the same parent budget while preserving old step authority and rejecting uncertain external work", async () => {
  const f = await missionAuthorityFixture(false, true);
  try {
    const old = f.proposed.authority; assert.ok(old);
    const queued = await decideMissionAuthority(f.config, f.store, f.session, f.proposed.id, f.proposed.revision, old.id, old.hash, "approve");
    const cancelled = cancelAgentRun(f.store, f.session.actorId, queued.id, queued.revision);
    assert.ok(cancelled.repair);
    f.store.db.prepare("INSERT INTO coding_agent_executions VALUES(?,?,'uncertain',?)").run(cancelled.repair.id, f.session.actorId, JSON.stringify({ parentRunId: queued.id }));
    await assert.rejects(resumePublicationMission(f.config, f.store, f.session, queued.id, cancelled.revision, randomUUID(), AbortSignal.timeout(5000)),
      (error: unknown) => error instanceof AppError && error.code === "MISSION_RECONCILIATION_REQUIRED");
    f.store.db.prepare("UPDATE coding_agent_executions SET state='returned' WHERE job_id=?").run(cancelled.repair.id);
    const resumed = await resumePublicationMission(f.config, f.store, f.session, queued.id, cancelled.revision, randomUUID(), AbortSignal.timeout(5000));
    assert.equal(resumed.run.repair, null); assert.deepEqual(resumed.run.usage, queued.usage);
    // Reuse the fixture's immutable source and unexecuted build contract to represent a new host proposal.
    const { CodeRepairAdapter } = await import("../../src/server/agent/code-repair.ts");
    const owner = f.repo.get(f.session.actorId, queued.id); assert.ok(owner); owner.state = "working"; f.repo.save(f.session.actorId, owner);
    const job = await new CodeRepairAdapter(f.config, f.store).propose(f.session.actorId, { projectId: f.flow.id, parentRunId: owner.id,
      expectedSourceHash: f.flow.profile.sourceHash, goal: "بررسی دوباره همان برنامه پس از توقف", allowedPaths: [], testFiles: [], execution: "container", build: old.plan.build, validationOnly: true }, AbortSignal.timeout(5000));
    owner.repair = job; owner.state = "needs_approval"; f.repo.save(f.session.actorId, owner);
    const next = await proposeMissionAuthority(f.config, f.store, f.session, owner.id, owner.revision, AbortSignal.timeout(5000), f.dependencies.deployment.read, f.dependencies.authorityAccount);
    assert.ok(next.authority); assert.notEqual(next.authority.id, old.id); assert.equal(next.authority.plan.revision, 2);
    assert.equal(f.store.db.prepare("SELECT state FROM mission_authorities WHERE id=?").get(old.id)?.state, "revoked");
    assert.equal(f.store.db.prepare("SELECT count(*) n FROM mission_steps WHERE authority_id=?").get(old.id)?.n, 1);
    await assert.rejects(decideMissionAuthority(f.config, f.store, f.session, next.id, next.revision, old.id, old.hash, "approve"), AppError);
    assert.equal(next.usage.modelCalls, queued.usage.modelCalls); assert.equal(f.counts().patches, 0); assert.equal(f.counts().sends, 0);
  } finally { f.close(); }
});

test("publication prerequisites hide executable build before destination without removing independent local source preparation", async () => {
  const f = await agentFixture();
  try {
    const config = { ...f.config, enableLiveLiara: true, enableMutations: true, enableLocalRepair: true };
    const names = (mission: boolean, target: boolean) => toolsForAgent(config, "build", target, mission).map(tool => tool.function.name);
    assert.equal(names(true, false).includes("propose_project_build"), false); assert.equal(names(true, false).includes("propose_destination"), true);
    assert.equal(names(true, true).includes("propose_project_build"), true); assert.equal(names(false, false).includes("propose_project_build"), true);
    assert.equal(toolsForAgent(config, "native", false, true).some(tool => tool.function.name === "propose_project_preparation"), true);
  } finally { f.close(); }
});

test("migration15 preserves populated v14 authority, step, artifact and historical hash bytes with valid foreign keys", () => {
  const directory = mkdtempSync(join(tmpdir(), "launchlane-authority-upgrade-")), path = join(directory, "state.sqlite"), db = new DatabaseSync(path);
  try {
    db.exec("PRAGMA foreign_keys=ON; CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,checksum TEXT NOT NULL) STRICT;");
    for (const migration of migrations.filter(item => item.version <= 14)) {
      db.exec(migration.sql); db.prepare("INSERT INTO schema_migrations VALUES(?,?)").run(migration.version, createHash("sha256").update(migration.sql).digest("hex"));
    }
    db.prepare("INSERT INTO agent_runs VALUES('run','actor','request',1,'cancelled',1,'{}')").run();
    db.prepare("INSERT INTO code_repair_jobs VALUES('job','actor','succeeded',1,'{}')").run();
    db.prepare("INSERT INTO mission_authorities VALUES('authority','actor','run',?,?,'revoked','session',1)").run('{"version":1,"historical":true}', "unchanged-hash");
    db.prepare("INSERT INTO mission_steps VALUES('authority','build','job','scope-hash',1)").run();
    db.prepare("INSERT INTO mission_artifacts VALUES('authority','source','archive','base','job','receipt-hash')").run(); db.close();
    const store = new Store(path);
    try {
      assert.equal(store.db.prepare("SELECT plan_json FROM mission_authorities").get()?.plan_json, '{"version":1,"historical":true}');
      assert.equal(store.db.prepare("SELECT plan_hash FROM mission_authorities").get()?.plan_hash, "unchanged-hash");
      assert.equal(store.db.prepare("SELECT evidence_hash FROM mission_steps").get()?.evidence_hash, "scope-hash");
      assert.equal(store.db.prepare("SELECT evidence_hash FROM mission_artifacts").get()?.evidence_hash, "receipt-hash");
      assert.deepEqual(store.db.prepare("PRAGMA foreign_key_check").all(), []);
      store.db.prepare("INSERT INTO mission_authorities VALUES('next','actor','run','{}','next-hash','proposed','session',2)").run();
    } finally { store.close(); }
  } finally { try { db.close(); } catch {} rmSync(directory, { recursive: true, force: true }); }
});
