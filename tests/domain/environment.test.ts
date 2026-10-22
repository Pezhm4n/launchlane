import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import { createPublicationMission, resumePublicationMission } from "../../src/server/application/publication-mission.ts";
import { proposeEnvironment, executeEnvironment, observeEnvironment } from "../../src/server/application/environment.ts";
import { AgentRepository } from "../../src/server/agent/store.ts";
import { sealCredential } from "../../src/server/connections/credentials.ts";
import { LiaraEnvironmentClient } from "../../src/server/liara/environment.ts";
import { connectedLiaraConfig } from "../../src/server/connections/liara.ts";
import { currentEnvironment, environmentFingerprint, openEnvironmentInput, projectEnvironmentValues } from "../../src/server/environment/secrets.ts";
import { decodeAction } from "../../src/contracts/client-decode.ts";
import { AppError } from "../../src/server/errors.ts";
import { LiaraReadClient } from "../../src/server/liara/client.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";
import { redact } from "../../src/server/policy/redaction.ts";
import { proposeWorkloadDeployment, executeDeployment, observeDeployment } from "../../src/server/application/deployment.ts";
import { fingerprint, parseActionSpec } from "../../src/server/policy/action.ts";
import { LiaraDeployClient } from "../../src/server/liara/deploy.ts";
import { WorkloadProbe } from "../../src/server/liara/probe.ts";

const changedValue = "synthetic-new-private-environment", existingValue = "synthetic-existing-private-value";
const code = (name: string) => (error: unknown) => error instanceof AppError && error.code === name;
async function fixture() {
  const f = await agentFixture();
  writeFileSync(join(f.project, "server.mjs"), "import http from 'node:http';const service=process.env.SERVICE_ACCESS;http.createServer((_req,res)=>res.end(service?'ready':'missing')).listen(3000);\n");
  const config = { ...f.config, teamId: "a".repeat(24), enableLiveLiara: true, enableMutations: true }, actor = f.session.actorId, appId = "c".repeat(24), app = "environment-case";
  const flow = await prepareProjectFlow(config, f.store, actor, { kind: "local", directory: "service" }, AbortSignal.timeout(5000));
  f.store.saveConnection(actor, { source: "token", ciphertext: sealCredential("synthetic-environment-transport-token", config.sessionSecret, actor, "liara"), view: {
    provider: "liara", status: "connected", identityId: "b".repeat(24), teamId: config.teamId, teamName: "تیم آزمون", displayName: "آزمون", login: "test@example.test", checkedAt: Date.now(),
    apps: [{ name: app, id: appId, platform: "node" }], selectedApp: app } });
  const repo = new AgentRepository(f.store), run = (await createPublicationMission(config, f.store, f.session, randomUUID(), { projectId: flow.id, sourceHash: flow.profile.sourceHash, path: "/", expectedText: "ready" }, AbortSignal.timeout(5000))).run;
  run.state = "needs_input"; run.nextAction = "configure_env"; run.usage.modelCalls = 3; run.usage.toolCalls = 2; run.usage.elapsedMs = 100; repo.save(actor, run);
  let variables = [{ key: "EXISTING_PRIVATE", value: existingValue }], writes = 0, reads = 0, lose = false, invalid = false, targetId = appId;
  const bodies: unknown[] = [];
  const client = new LiaraEnvironmentClient(connectedLiaraConfig(config, f.store, actor, app), async (url, options) => {
    assert.equal(new URL(String(url)).origin, "https://api.liara.ir"); assert.equal(new URL(String(url)).searchParams.get("teamID"), config.teamId);
    if (options?.method === "POST") {
      writes++; const body = JSON.parse(String(options.body)); bodies.push(body); assert.equal(body.project, app); variables = body.variables;
      if (lose) throw new Error("lost sensitive transport body " + changedValue);
      return new Response("discarded provider content " + changedValue);
    }
    reads++; return Response.json({ project: { _id: targetId, project_id: app, type: "node", planID: "g2-standard", status: "running", envs: invalid ? [{ key: "EXISTING_PRIVATE", value: 9 }] : variables } });
  });
  return { ...f, config, flow, repo, run, actor, app, appId, client, bodies, get writes() { return writes; }, get reads() { return reads; },
    get lose() { return lose; }, set lose(value: boolean) { lose = value; }, get invalid() { return invalid; }, set invalid(value: boolean) { invalid = value; }, get targetId() { return targetId; }, set targetId(value: string) { targetId = value; },
    changeRemote: () => { variables.push({ key: "CONCURRENT_KEY", value: "another-new-value" }); }, signal: () => AbortSignal.timeout(5000),
    propose: (key = randomUUID()) => proposeEnvironment(config, f.store, f.session, run.id, key, [{ key: "SERVICE_ACCESS", value: changedValue }], AbortSignal.timeout(5000), { client }) };
}

test("environment approval binds encrypted merged values and verifies readback without leaking values or resetting mission allowance", async () => {
  const f = await fixture();
  try {
    const source = readFileSync(join(f.project, "server.mjs")), requestKey = randomUUID(), action = await f.propose(requestKey);
    assert.equal(f.writes, 0); assert.equal(action.spec.version, 9); assert.equal(f.reads, 1);
    assert.equal(JSON.stringify(decodeAction(action)).includes(changedValue), false); assert.equal(JSON.stringify(action).includes(existingValue), false);
    const stored = f.store.db.prepare("SELECT * FROM environment_inputs").get(); assert.ok(stored); assert.equal(JSON.stringify(stored).includes(changedValue), false);
    const repeated = await f.propose(requestKey); assert.equal(repeated.id, action.id); assert.equal(f.reads, 1);
    assert.equal(action.spec.version === 9 && action.spec.effectiveFingerprint === environmentFingerprint(f.config.sessionSecret, [
      { key: "EXISTING_PRIVATE", value: existingValue }, { key: "SERVICE_ACCESS", value: changedValue }]), true);
    f.store.decide(action.id, f.actor, f.session.id, action.hash, "approve");
    const accepted = await executeEnvironment(f.config, f.store, f.session, action.id, f.signal(), { client: f.client });
    assert.equal(accepted.state, "observing"); assert.equal(accepted.environment?.stage, "accepted"); assert.equal(f.writes, 1);
    assert.deepEqual(f.bodies[0], { project: f.app, variables: [{ key: "EXISTING_PRIVATE", value: existingValue }, { key: "SERVICE_ACCESS", value: changedValue }] });
    const checked = await observeEnvironment(f.config, f.store, f.session, action.id, f.signal(), { client: f.client });
    assert.equal(checked.state, "succeeded"); assert.equal(checked.environment?.outcome, "verified"); assert.equal(checked.remoteId, null);
    assert.equal(f.repo.get(f.actor, f.run.id)?.effect, "configuration_changed");
    await assert.rejects(executeEnvironment(f.config, f.store, f.session, action.id, f.signal(), { client: f.client }), code("ACTION_CONFLICT"));
    assert.equal(f.writes, 1); assert.equal(f.repo.get(f.actor, f.run.id)?.usage.modelCalls, 3); assert.equal(f.repo.get(f.actor, f.run.id)?.usage.toolCalls, 6);
    assert.deepEqual(readFileSync(join(f.project, "server.mjs")), source);
    const current = f.repo.get(f.actor, f.run.id); assert.ok(current);
    const resumed = await resumePublicationMission(f.config, f.store, f.session, current.id, current.revision, randomUUID(), f.signal());
    assert.equal(resumed.run.id, f.run.id); assert.equal(resumed.run.usage.modelCalls, 3); assert.equal(resumed.run.usage.toolCalls, 6);
    const scoped = connectedLiaraConfig(f.config, f.store, f.actor, f.app), logs = new LiaraReadClient(scoped, async () => Response.json({ data: [{ metaData: {}, values: [[String(BigInt(Date.parse("2026-10-22T12:00:00Z")) * 1000000n), JSON.stringify({ _entry: "echo " + changedValue, type: "stdout" })]] }] }));
    const evidence = await logs.logs({ app: f.app, teamId: f.config.teamId }, "2026-10-22T11:00:00Z", new RunBudget(f.config), f.signal());
    assert.equal(JSON.stringify(evidence).includes(changedValue), false);
  } finally { f.close(); }
});

test("a committed environment write with a lost response is reconciled by read only; mismatch stays locked", async () => {
  for (const changed of [false, true]) {
    const f = await fixture();
    try {
      const action = await f.propose(); f.store.decide(action.id, f.actor, f.session.id, action.hash, "approve"); f.lose = true;
      const unknown = await executeEnvironment(f.config, f.store, f.session, action.id, f.signal(), { client: f.client });
      assert.equal(unknown.state, "uncertain"); assert.equal(unknown.environment?.stage, "request_started");
      assert.equal(f.repo.get(f.actor, f.run.id)?.effect, "remote_changes_unverified");
      f.store.recoverInterrupted(); if (changed) f.changeRemote();
      const checked = await observeEnvironment(f.config, f.store, f.session, action.id, f.signal(), { client: f.client });
      assert.equal(checked.state, changed ? "uncertain" : "succeeded"); assert.equal(f.writes, 1);
      if (changed) assert.throws(() => f.store.assertAgentIdle(f.actor), code("UNRESOLVED_EFFECT"));
    } finally { f.close(); }
  }
});

test("changed base, wrong account/app, malformed existing values and scope extensions never reach environment write", async () => {
  for (const mode of ["base", "id", "invalid", "scope", "short"]) {
    const f = await fixture();
    try {
      if (mode === "scope" || mode === "short") {
        await assert.rejects(proposeEnvironment(f.config, f.store, f.session, f.run.id, randomUUID(), [{ key: mode === "scope" ? "NODE_OPTIONS" : "SERVICE_ACCESS", value: mode === "short" ? "abc" : changedValue }], f.signal(), { client: f.client }), code("ENV_SCOPE_DENIED"));
      } else {
        const action = await f.propose(); f.store.decide(action.id, f.actor, f.session.id, action.hash, "approve");
        if (mode === "base") f.changeRemote(); if (mode === "id") f.targetId = "d".repeat(24); if (mode === "invalid") f.invalid = true;
        await assert.rejects(executeEnvironment(f.config, f.store, f.session, action.id, f.signal(), { client: f.client }));
      }
      assert.equal(f.writes, 0); assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM attempts").get()?.n, 0);
    } finally { f.close(); }
  }
});

test("denial, expiry, a different session, changed input and closed gates cannot consume environment approval", async () => {
  for (const mode of ["deny", "expiry", "session", "input", "gate"]) {
    const f = await fixture();
    try {
      const requestKey = randomUUID(), action = await f.propose(requestKey);
      if (mode === "input") await assert.rejects(proposeEnvironment(f.config, f.store, f.session, f.run.id, requestKey, [{ key: "SERVICE_ACCESS", value: "different-private-value" }], f.signal(), { client: f.client }), code("IDEMPOTENCY_CONFLICT"));
      else {
        f.store.decide(action.id, f.actor, f.session.id, action.hash, mode === "deny" ? "reject" : "approve");
        if (mode === "expiry") f.store.db.prepare("UPDATE actions SET expires_at=1 WHERE id=?").run(action.id);
        await assert.rejects(executeEnvironment(mode === "gate" ? { ...f.config, enableMutations: false } : f.config, f.store,
          mode === "session" ? { ...f.session, id: "different-session" } : f.session, action.id, f.signal(), { client: f.client }));
      }
      assert.equal(f.writes, 0); assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM attempts").get()?.n, 0);
    } finally { f.close(); }
  }
});

test("encrypted inputs fail closed under ciphertext, key, actor or scope substitution", async () => {
  const f = await fixture();
  try {
    const action = await f.propose(); assert.equal(action.spec.version, 9); if (action.spec.version !== 9) return;
    const spec = action.spec;
    assert.throws(() => openEnvironmentInput(f.store, f.config.sessionSecret, "other-actor", spec));
    assert.throws(() => openEnvironmentInput(f.store, f.config.sessionSecret, f.actor, { ...spec, targetAppId: "d".repeat(24) }));
    assert.throws(() => openEnvironmentInput(f.store, "another-install-key-with-more-than-32-characters", f.actor, spec));
    f.store.db.prepare("UPDATE environment_inputs SET ciphertext=replace(ciphertext,'v1.','v2.') WHERE id=?").run(spec.secretRef);
    assert.throws(() => openEnvironmentInput(f.store, f.config.sessionSecret, f.actor, spec));
    assert.equal(f.writes, 0);
  } finally { f.close(); }
});

test("concurrent environment execution consumes one decision and one provider write", async () => {
  const f = await fixture();
  try {
    const action = await f.propose(); f.store.decide(action.id, f.actor, f.session.id, action.hash, "approve");
    const attempts = await Promise.allSettled([0, 1].map(() => executeEnvironment(f.config, f.store, f.session, action.id, f.signal(), { client: f.client })));
    assert.equal(attempts.filter(value => value.status === "fulfilled" && value.value.state === "observing").length, 1);
    assert.equal(f.writes, 1); assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM attempts").get()?.n, 1);
  } finally { f.close(); }
});

test("short explicitly public values remain encrypted and their classification is bound to the decision", async () => {
  const f = await fixture();
  try {
    const requestKey = randomUUID(), action = await proposeEnvironment(f.config, f.store, f.session, f.run.id, requestKey, [{ key: "SERVICE_ACCESS", value: "1", public: true }], f.signal(), { client: f.client });
    assert.equal(action.spec.version, 9); if (action.spec.version !== 9) return;
    assert.deepEqual(action.spec.secretKeys, []);
    assert.throws(() => f.store.assertAgentIdle(f.actor), code("UNRESOLVED_EFFECT"));
    await assert.rejects(proposeEnvironment(f.config, f.store, f.session, f.run.id, requestKey, [{ key: "SERVICE_ACCESS", value: "1", public: false }], f.signal(), { client: f.client }));
    assert.equal(f.writes, 0);
  } finally { f.close(); }
});

test("escaped environment values remain redacted in JSON and URL evidence", () => {
  const secret = 'private-value"with\nnewlines/and?query';
  const json = redact(JSON.stringify({ echo: secret }), [secret]);
  assert.deepEqual(JSON.parse(json), { echo: "[REDACTED]" });
  assert.equal(redact(encodeURIComponent(secret), [secret]), "[REDACTED]");
});

test("environment-bound publication preserves historical canonicalization and rejects changed configuration before upload", async () => {
  const f = await fixture();
  try {
    const action = await f.propose(); f.store.decide(action.id, f.actor, f.session.id, action.hash, "approve");
    await executeEnvironment(f.config, f.store, f.session, action.id, f.signal(), { client: f.client });
    await observeEnvironment(f.config, f.store, f.session, action.id, f.signal(), { client: f.client });
    const reference = currentEnvironment(f.store, f.config.sessionSecret, f.actor, f.flow.id); assert.ok(reference);
    assert.deepEqual(reference.keys, ["SERVICE_ACCESS"]);
    assert.deepEqual(projectEnvironmentValues(f.store, f.config.sessionSecret, f.actor, f.flow.id, reference), [{ key: "SERVICE_ACCESS", value: changedValue }]);
    const config = { ...f.config, probeOrigins: { [f.app]: `https://${f.app}.liara.run` } }, scoped = connectedLiaraConfig(config, f.store, f.actor, f.app),
      read = new LiaraReadClient(scoped, f.client.send), deps = { read, environment: f.client };
    const publication = await proposeWorkloadDeployment(config, f.store, f.actor, { flowId: f.flow.id, app: f.app, port: 3000,
      workload: { origin: config.probeOrigins[f.app], path: "/", status: 200, assertion: { kind: "text", contains: "ready" } } }, f.signal(), deps);
    assert.equal(publication.spec.version, 10); assert.equal(decodeAction(publication).hash, publication.hash);
    assert.deepEqual(parseActionSpec(publication.spec), publication.spec);
    if (publication.spec.version !== 10) return;
    const spec = publication.spec, { environment, ...rest } = spec, historical = { ...rest, version: 7 };
    assert.equal(fingerprint(parseActionSpec(historical)), fingerprint(historical));
    assert.throws(() => f.store.createAction(f.actor, { ...spec, environment: { ...environment, fingerprint: "0".repeat(64) } }), code("ENV_REFERENCE_CHANGED"));
    f.store.decide(publication.id, f.actor, f.session.id, publication.hash, "approve"); f.changeRemote(); let uploadCalls = 0;
    const invalidated = await executeDeployment(config, f.store, f.session, publication.id, f.signal(), { ...deps,
      write: new LiaraDeployClient(scoped, async () => { uploadCalls++; throw Error("must not upload"); }) });
    assert.equal(invalidated.state, "failed"); assert.equal(invalidated.errorCode, "ENV_REFERENCE_CHANGED");
    assert.equal(uploadCalls, 0); assert.equal(f.store.getAction(publication.id, f.actor).attemptId, null);
    assert.equal(f.writes, 1);
    const next = await prepareProjectFlow(config, f.store, f.actor, { kind: "local", directory: "service" }, f.signal());
    assert.equal(currentEnvironment(f.store, f.config.sessionSecret, f.actor, next.id), null, "another selection cannot inherit the secret reference");
    assert.throws(() => projectEnvironmentValues(f.store, f.config.sessionSecret, f.actor, next.id, reference), code("ENV_REFERENCE_CHANGED"));
  } finally { f.close(); }
});

test("environment-bound releases need the same current configuration on both sides of their workload check", async () => {
  for (const changeDuringProbe of [false, true]) {
    const f = await fixture();
    try {
      const environment = await f.propose(); f.store.decide(environment.id, f.actor, f.session.id, environment.hash, "approve");
      await executeEnvironment(f.config, f.store, f.session, environment.id, f.signal(), { client: f.client });
      await observeEnvironment(f.config, f.store, f.session, environment.id, f.signal(), { client: f.client });
      const config = { ...f.config, probeOrigins: { [f.app]: `https://${f.app}.liara.run` } }, scoped = connectedLiaraConfig(config, f.store, f.actor), writes: string[] = [];
      const read = new LiaraReadClient(scoped, async (url, options) => new URL(url).pathname.endsWith("/releases")
        ? Response.json({ currentRelease: "environment-release", total: 1, releases: [{ _id: "environment-release", state: "READY", port: 3000 }] }) : f.client.send(url, options));
      const deps = { read, environment: f.client, write: new LiaraDeployClient(scoped, async (url, options) => {
        assert.equal(options.method, "POST"); const source = new URL(url).pathname.endsWith("/sources"); writes.push(source ? "source" : "release");
        if (!source) { const body = JSON.parse(String(options.body)); assert.equal(body.platformConfig.version, f.flow.profile.nodeRuntime?.version); assert.equal(body.envs, undefined); }
        return Response.json(source ? { sourceID: "environment-source.tar.gz" } : { releaseID: "environment-release" });
      }), probe: new WorkloadProbe(scoped, async () => [{ address: "8.8.8.8", family: 4 }], async () => {
        if (changeDuringProbe) f.changeRemote(); return { status: 200, body: "ready", bytes: 5, durationMs: 1 };
      }) };
      const action = await proposeWorkloadDeployment(config, f.store, f.actor, { flowId: f.flow.id, app: f.app, port: 3000,
        workload: { origin: config.probeOrigins[f.app], path: "/", status: 200, assertion: { kind: "text", contains: "ready" } } }, f.signal(), deps);
      f.store.decide(action.id, f.actor, f.session.id, action.hash, "approve");
      const accepted = await executeDeployment(config, f.store, f.session, action.id, f.signal(), deps);
      assert.equal(accepted.spec.version, 10); assert.equal(accepted.state, "observing"); assert.ok(accepted.deployment?.releaseAcceptedAt);
      const observed = await observeDeployment(config, f.store, f.session, action.id, f.signal(), deps);
      assert.deepEqual(writes, ["source", "release"]);
      assert.equal(observed.state === "succeeded", !changeDuringProbe);
      assert.equal(observed.deployment?.observation?.code, changeDuringProbe ? "ENV_REFERENCE_CHANGED" : "WORKLOAD_VERIFIED");
    } finally { f.close(); }
  }
});
