import assert from "node:assert/strict";
import { test } from "node:test";
import { readConfig } from "../../src/server/config.ts";
import { LiaraAccountClient, parsePaaSCatalog, priceHundredths, quotePaaSOffer } from "../../src/server/liara/catalog.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";
import { AppError } from "../../src/server/errors.ts";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { sealCredential } from "../../src/server/connections/credentials.ts";
import { currentAgentContext, executeAgentTool } from "../../src/server/agent/tools.ts";

const teamId = "a".repeat(24), accountId = "b".repeat(24), key = "private-test-catalog-key";
const config = readConfig({ LIARA_TEAM_ID: teamId, LIARA_API_TOKEN: key, LAUNCHLANE_ENABLE_LIVE_LIARA: "true" });
const signal = () => AbortSignal.timeout(2000);
const code = (value: string) => (e: unknown) => e instanceof AppError && e.code === value;
function payload() {
  return { user: { _id: accountId, email: "private@example.test", accessToken: key },
    team: { _id: teamId, balance: 5000 }, plans: {
      projects: { small: { available: true, region: "iran", price: 659.72, RAM: { amount: 0.5 }, CPU: { amount: 0.5 } },
        medium: { available: true, region: "iran", price: 1000, RAM: { amount: 1 }, CPU: { amount: 1 } },
        discontinued: { available: false, price: 0 } },
      projectBundlePlans: { small: { basic: { available: true, price: 381.94 }, free: { available: false, price: 0 }, pro: { available: true, price: 700 } },
        medium: { basic: { available: true, price: 381.94 } } },
    } };
}

test("catalog uses exact decimal base rates and real availability, with separate unknown capacity and excluded extras", () => {
  const parsed = parsePaaSCatalog(payload(), { accountId, teamId }), quote = quotePaaSOffer(parsed, "small", "basic");
  assert.equal(quote.hourlyToman, "1041.66");
  assert.equal(quote.selected.hourlyHundredthsToman, 104166);
  assert.equal(quote.creditCoversOneBaseHour, true);
  assert.equal(quote.capacity, "unmeasured");
  assert.equal(quote.pricing.extras, "tax_traffic_storage_not_included");
  assert.ok(quote.alternatives.length > 0);
  assert.deepEqual(parsed.unavailablePlanIds, ["discontinued"]);
  assert.equal(priceHundredths(0.1), 10);
  assert.equal(priceHundredths(0.2), 20);
  assert.ok(!JSON.stringify(parsed).includes(key));
  assert.ok(!JSON.stringify(parsed).includes("private@example.test"));
  assert.throws(() => quotePaaSOffer(parsed, "small", "free"), code("PLAN_UNAVAILABLE"));
  assert.throws(() => quotePaaSOffer(parsed, "discontinued", "basic"), code("PLAN_UNAVAILABLE"));
  assert.throws(() => quotePaaSOffer(parsed, "small", "basic", parsed.observedAt + 600000), code("CATALOG_STALE"));
  assert.throws(() => quotePaaSOffer(parsed, "small", "basic", parsed.observedAt - 1), code("CATALOG_STALE"));
});

test("missing prices, insufficient balance and changed prices remain explicit; no unknown is converted to free", () => {
  const raw = payload();
  const original = parsePaaSCatalog(raw, { accountId, teamId });
  raw.team.balance = -1;
  raw.plans.projects.small.price = 900;
  const changed = parsePaaSCatalog(raw, { accountId, teamId }), quote = quotePaaSOffer(changed, "small", "basic");
  assert.notEqual(original.fingerprint, changed.fingerprint);
  assert.equal(quote.creditCoversOneBaseHour, false);
  const unknown = structuredClone(raw);
  const missing: Record<string, unknown> = unknown.plans.projects.small;
  delete missing.price;
  missing.RAM = null;
  missing.CPU = null;
  const parsed = parsePaaSCatalog(unknown, { accountId, teamId });
  assert.equal(parsed.offers.find((offer) => offer.planId === "small")?.hourlyHundredthsToman, null);
  assert.equal(parsed.offers.find((offer) => offer.planId === "small")?.resources.memoryAmount, null);
  assert.throws(() => quotePaaSOffer(parsed, "small", "basic"), code("PRICE_UNAVAILABLE"));
  for (const value of [-1, 0.001, Number.NaN, "100", Number.POSITIVE_INFINITY]) assert.throws(() => priceHundredths(value), code("CATALOG_INVALID"));
  assert.throws(() => parsePaaSCatalog(raw, { accountId: "c".repeat(24), teamId }), code("SCOPE_DENIED"));
  assert.throws(() => parsePaaSCatalog(raw, { accountId, teamId: "d".repeat(24) }), code("SCOPE_DENIED"));
});

test("account catalog transport is scoped, shares the budget and performs no hidden retry on upstream errors", async () => {
  let calls = 0;
  const budget = new RunBudget(config), client = new LiaraAccountClient(config, accountId, async (url, init) => {
    calls++;
    assert.equal(url, `https://api.liara.ir/v1/me?teamID=${teamId}`);
    assert.equal(init.method, "GET");
    assert.equal(init.redirect, "error");
    return Response.json(payload());
  });
  assert.equal((await client.catalog(budget, signal())).accountId, accountId);
  assert.equal(calls, 1);
  assert.equal(budget.toolCalls, 1);
  const deniedBudget = new RunBudget(config);
  await assert.rejects(new LiaraAccountClient({ ...config, enableLiveLiara: false }, accountId, async () => { calls++; throw new Error("must not send"); }).catalog(deniedBudget, signal()), code("LIVE_LIARA_DISABLED"));
  assert.equal(calls, 1);
  assert.equal(deniedBudget.toolCalls, 0);
  for (const status of [401, 429, 503]) {
    let sends = 0;
    await assert.rejects(new LiaraAccountClient(config, accountId, async () => { sends++; return new Response(null, { status }); }).catalog(new RunBudget(config), signal()), AppError);
    assert.equal(sends, 1);
  }
  await assert.rejects(new LiaraAccountClient(config, accountId, async () => new Promise<Response>(() => {})).catalog(new RunBudget({ ...config, runTimeoutMs: 30 }), signal()), code("BUDGET_EXHAUSTED"));
});

test("agent catalog works before app selection and rejects a connection changed during the read", async () => {
  const f = await agentFixture();
  try {
    const scoped = { ...f.config, teamId, liaraToken: key, enableLiveLiara: true }, connection = {
      source: "token" as const, ciphertext: sealCredential(key, scoped.sessionSecret, f.session.actorId, "liara"),
      view: { provider: "liara" as const, status: "connected" as const, identityId: accountId, displayName: "آزمون", login: "test@example.test",
        teamId, teamName: "آزمون", checkedAt: Date.now(), apps: [], selectedApp: null },
    };
    f.store.saveConnection(f.session.actorId, connection);
    const context = currentAgentContext(scoped, f.store, f.session.actorId);
    assert.equal(context.target, null);
    assert.equal(context.account?.accountId, accountId);
    const result = await executeAgentTool("read_catalog", {}, { config: scoped, store: f.store, actorId: f.session.actorId,
      context, createdAt: Date.now(), budget: new RunBudget(scoped), signal: signal(),
      account: new LiaraAccountClient(scoped, accountId, async () => Response.json(payload())) });
    assert.ok(typeof result === "object" && result !== null && "offers" in result);
    await assert.rejects(executeAgentTool("read_catalog", {}, { config: scoped, store: f.store, actorId: f.session.actorId,
      context, createdAt: Date.now(), budget: new RunBudget(scoped), signal: signal(),
      account: new LiaraAccountClient(scoped, accountId, async () => {
        f.store.saveConnection(f.session.actorId, { ...connection, view: { ...connection.view, identityId: "changed-account" } });
        return Response.json(payload());
      }) }), code("AGENT_CONTEXT_CHANGED"));
  } finally { f.close(); }
});
