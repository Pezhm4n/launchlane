import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { LiaraAccountClient } from "../../src/server/liara/catalog.ts";
import { proposeDestination } from "../../src/server/application/provision.ts";
import { reviseAgentDestination } from "../../src/server/application/agent-destination.ts";
import { parseDestinationRecommendation, type DestinationRecommendation } from "../../src/contracts/destination-recommendation.ts";
import { sealCredential } from "../../src/server/connections/credentials.ts";
import { createPublicationMission } from "../../src/server/application/publication-mission.ts";
import { AgentRepository, agentView } from "../../src/server/agent/store.ts";
import { parseAgentView } from "../../src/contracts/agent.ts";
import { AppError } from "../../src/server/errors.ts";

async function fixture() {
  const f = await agentFixture(), accountId = "b".repeat(24), teamId = "a".repeat(24), networkId = "c".repeat(24), app = "new-app",
    config = { ...f.config, teamId, apps: [app], liaraToken: "synthetic-plans-credential", enableLiveLiara: true, enableMutations: true };
  f.store.saveConnection(f.session.actorId, { source: "token", ciphertext: sealCredential(config.liaraToken, config.sessionSecret, f.session.actorId, "liara"),
    view: { provider: "liara", status: "connected", identityId: accountId, displayName: "تیم آزمون", login: "test@example.test", checkedAt: Date.now(),
      teamId, teamName: "آزمون", apps: [], selectedApp: null } });
  let reads = 0, beforeMetadata = () => {};
  const read = new LiaraAccountClient(config, accountId, async (url, input) => {
    assert.equal(input.method, "GET"); reads++;
    const path = new URL(url).pathname;
    if (path === "/v1/me") return Response.json({ user: { _id: accountId }, team: { _id: teamId, balance: 10000 }, plans: {
      projects: { budget: { available: true, region: "iran", price: 100 }, growth: { available: true, region: "iran", price: 250 }, unknown: { available: true, region: "iran" } },
      projectBundlePlans: { budget: { basic: { available: true, price: 20 } }, growth: { basic: { available: true, price: 20 } }, unknown: { basic: { available: true, price: 20 } } } } });
    if (path === "/v1/networks") return Response.json({ networks: [{ _id: networkId, name: "existing" }] });
    assert.equal(path, `/v1/projects/${app}`); beforeMetadata(); return new Response(null, { status: 404 });
  });
  let recommendation: DestinationRecommendation | null = null;
  const action = await proposeDestination(config, f.store, f.session.actorId, { flowId: f.flow.id, app, planId: "budget", bundleId: "basic", networkId }, AbortSignal.timeout(5000),
    { read, onRecommendation: value => { recommendation = value; } });
  const repo = new AgentRepository(f.store), run = (await createPublicationMission(config, f.store, f.session, randomUUID(), {
    projectId: f.flow.id, sourceHash: f.flow.profile.sourceHash, path: "/", expectedText: "invoice ready" }, AbortSignal.timeout(5000))).run;
  const verifiedRecommendation = parseDestinationRecommendation(recommendation);
  run.state = "needs_approval"; run.destination = action; run.destinationRecommendation = verifiedRecommendation; repo.save(f.session.actorId, run);
  return { ...f, config, read, action, run, repo, recommendation: verifiedRecommendation, reads: () => reads, setRace: (callback: () => void) => { beforeMetadata = callback; } };
}
test("the project-bound recommendation uses actual available prices and reports unmeasured capacity instead of fabricated requirements", async () => {
  const f = await fixture();
  try {
    assert.ok(f.recommendation); assert.equal(f.recommendation.sourceHash, f.flow.profile.sourceHash); assert.equal(f.recommendation.capacity, "unmeasured");
    assert.equal(f.recommendation.recommended.planId, "budget"); assert.match(f.recommendation.summary, /Node.js 22/);
    assert.deepEqual(f.recommendation.offers.map(offer => offer.hourlyHundredthsToman), [12000, 27000]);
    assert.equal(f.recommendation.offers.some(offer => offer.planId === "unknown"), false);
    assert.deepEqual(parseAgentView(agentView(f.run)).destinationRecommendation, f.recommendation);
    assert.throws(() => parseAgentView({ ...agentView(f.run), destinationRecommendation: { ...f.recommendation, sourceHash: "0".repeat(64) } }), AppError);
    assert.throws(() => parseDestinationRecommendation({ ...f.recommendation, offers: [...f.recommendation.offers, f.recommendation.offers[0]] }), AppError);
  } finally { f.close(); }
});
test("choosing another plan atomically revokes old consent and binds a fresh price without models, cloud writes or another parent budget", async () => {
  const f = await fixture();
  try {
    const revised = await reviseAgentDestination(f.config, f.store, f.session, f.run.id, f.run.revision, "growth", "basic", AbortSignal.timeout(5000), f.read);
    assert.ok(revised.destination); assert.notEqual(revised.destination.id, f.action.id); assert.equal(f.store.getAction(f.action.id, f.session.actorId).state, "cancelled");
    assert.equal(revised.destination.state, "awaiting_approval"); assert.equal(revised.destination.spec.args.planId, "growth"); assert.equal(revised.usage.modelCalls, 0);
    assert.equal(revised.usage.toolCalls, 3); assert.deepEqual(revised.limits, f.run.limits); assert.equal(f.store.db.prepare("SELECT count(*) n FROM attempts").get()?.n, 0);
    await assert.rejects(import("../../src/server/agent/runs.ts").then(({ decideAgentDestination }) => decideAgentDestination(f.config, f.store, f.session,
      revised.id, revised.revision, f.action.id, "approve")), AppError);
    const before = f.reads(), same = await reviseAgentDestination(f.config, f.store, f.session, revised.id, revised.revision, "growth", "basic", AbortSignal.timeout(5000), f.read);
    assert.equal(f.reads(), before); assert.equal(same.destination?.id, revised.destination.id); assert.deepEqual(same.usage, revised.usage);
  } finally { f.close(); }
});
test("a concurrent mission change rolls back plan replacement and preserves the old decision; unknown price cannot become zero", async () => {
  const f = await fixture();
  try {
    f.setRace(() => { const concurrent = f.repo.get(f.session.actorId, f.run.id); assert.ok(concurrent); f.repo.save(f.session.actorId, concurrent); });
    await assert.rejects(reviseAgentDestination(f.config, f.store, f.session, f.run.id, f.run.revision, "growth", "basic", AbortSignal.timeout(5000), f.read),
      (error: unknown) => error instanceof AppError && error.code === "AGENT_CONFLICT");
    assert.equal(f.store.getAction(f.action.id, f.session.actorId).state, "awaiting_approval"); assert.equal(f.store.db.prepare("SELECT count(*) n FROM actions").get()?.n, 1);
    f.setRace(() => {}); const current = f.repo.get(f.session.actorId, f.run.id); assert.ok(current);
    await assert.rejects(reviseAgentDestination(f.config, f.store, f.session, current.id, current.revision, "unknown", "basic", AbortSignal.timeout(5000), f.read),
      (error: unknown) => error instanceof AppError && error.code === "PRICE_UNAVAILABLE");
    assert.equal(f.store.getAction(f.action.id, f.session.actorId).state, "awaiting_approval"); assert.equal(f.store.db.prepare("SELECT count(*) n FROM attempts").get()?.n, 0);
  } finally { f.close(); }
});
