import { createHash, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { readConfig } from "../../src/server/config.ts";
import { Store } from "../../src/server/persistence/store.ts";
import { AgentRepository, addEvent } from "../../src/server/agent/store.ts";
import { currentAgentContext } from "../../src/server/agent/tools.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import { proposeDestination } from "../../src/server/application/provision.ts";
import { LiaraAccountClient } from "../../src/server/liara/catalog.ts";
import { sealCredential } from "../../src/server/connections/credentials.ts";

// A proposal fixture has no provider writes. Its production server keeps all live-service gates off.
export async function seedDestinationProposal(server) {
  const actor = createHash("sha256").update(server.token).digest("hex").slice(0, 24), accountId = "b".repeat(24), networkId = "c".repeat(24);
  const config = readConfig({ LAUNCHLANE_STATE_DIR: server.stateDir, LAUNCHLANE_WORKSPACE_ROOT: server.workspace,
    LAUNCHLANE_SESSION_SECRET: server.sessionSecret, LIARA_TEAM_ID: server.teamId, LAUNCHLANE_APP_ALLOWLIST: server.app,
    LIARA_API_TOKEN: "synthetic-destination-credential", LAUNCHLANE_ENABLE_LIVE_LIARA: "true", LAUNCHLANE_ENABLE_MUTATIONS: "true" });
  mkdirSync(server.stateDir, { recursive: true });
  const store = new Store(join(server.stateDir, "state.sqlite"));
  try {
    store.saveConnection(actor, { source: "token", ciphertext: sealCredential(config.liaraToken, config.sessionSecret, actor, "liara"),
      view: { provider: "liara", status: "connected", identityId: accountId, displayName: "حساب آزمون", login: "test@example.test",
        teamId: server.teamId, teamName: "تیم آزمون", checkedAt: Date.now(), apps: [], selectedApp: null } });
    const flow = await prepareProjectFlow(config, store, actor, { kind: "local", directory: "examples/node-service" }, AbortSignal.timeout(5000));
    const read = new LiaraAccountClient(config, accountId, async (url) => {
      const path = new URL(url).pathname;
      if (path === "/v1/me") return Response.json({ user: { _id: accountId }, team: { _id: server.teamId, balance: 10000 },
        plans: { projects: { starter: { available: true, region: "iran", price: 500 } }, projectBundlePlans: { starter: { basic: { available: true, price: 40 } } } } });
      if (path === "/v1/networks") return Response.json({ networks: [{ _id: networkId, name: "existing-network" }] });
      if (path === `/v1/projects/${server.app}`) return new Response(null, { status: 404 });
      throw new Error("Unexpected proposal read");
    });
    const action = await proposeDestination(config, store, actor, { flowId: flow.id, app: server.app, planId: "starter", bundleId: "basic", networkId }, AbortSignal.timeout(5000), { read });
    const repository = new AgentRepository(store), run = repository.create(actor, randomUUID(), currentAgentContext(config, store, actor), "مقصد تازه بساز و هزینه را پیش از ساخت نشان بده", { maxModelCalls: 16, maxToolCalls: 80, runTimeoutMs: 600000 }).run;
    run.destination = action;
    run.state = "needs_approval";
    addEvent(run, "assistant", "پیشنهاد ساخت مقصد آماده است؛ نام و هزینه را بررسی کنید. انتشار تصمیم جدا دارد.");
    repository.save(actor, run);
    return { store, repository, actor, run, action };
  } catch (error) { store.close(); throw error; }
}
