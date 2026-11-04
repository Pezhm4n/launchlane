import assert from "node:assert/strict";
import { cp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { parseCodeRepairJob } from "../../src/contracts/code-repair.ts";
import { object } from "../../src/contracts/validation.ts";
import { CodeRepairAdapter } from "../../src/server/agent/code-repair.ts";
import { currentAgentContext, executeAgentTool } from "../../src/server/agent/tools.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";
import { LiaraReadClient } from "../../src/server/liara/client.ts";
import { sealCredential } from "../../src/server/connections/credentials.ts";
import { parseActionSpec } from "../../src/server/policy/action.ts";
import { agentFixture } from "../helpers/agent-fixture.ts";

for (const scenario of ["release", "original-test-failure", "wrong-route-result"]) {
  test(`original ASP.NET solution through the shared Agent and Docker worker: ${scenario}`, async () => {
    const f = await agentFixture();
    try {
      const directory = join(f.workspace, "orders");
      await cp("tests/fixtures/dotnet-orders", directory, { recursive: true });
      if (scenario === "original-test-failure") {
        const path = join(directory, "Orders/Invoice.cs");
        await writeFile(path, (await readFile(path, "utf8")).replace("line.Price * line.Quantity", "line.Price"));
      }
      const config = { ...f.config, enableLocalRepair: true };
      const signal = AbortSignal.timeout(180000), actor = f.session.actorId;
      const flow = await prepareProjectFlow(config, f.store, actor, { kind: "local", directory: "orders" }, signal);
      const proposed = object(await executeAgentTool("propose_project_build", {
        path: "/api/orders", status: 200,
        assertion: { kind: "json", field: "total", equals: scenario === "wrong-route-result" ? 74 : 73 },
      }, { config, store: f.store, actorId: actor, context: currentAgentContext(config, f.store, actor),
        createdAt: Date.now(), budget: new RunBudget(config), signal }));
      const proposal = parseCodeRepairJob(proposed.repairProposal);
      assert.equal(proposal.build?.version, 6);
      const adapter = new CodeRepairAdapter(config, f.store);
      adapter.approve(actor, proposal.id);
      const job = await adapter.run(actor, proposal.id, signal);
      if (scenario === "release") {
        assert.equal(job.state, "succeeded", JSON.stringify({ code: job.errorCode, test: job.afterTest }));
        assert.match(job.builtImage ?? "", /^sha256:[a-f0-9]{64}$/);
        assert.equal(job.artifact?.sourceHash, flow.profile.sourceHash);
        assert.ok(job.artifact);
        const selected = await prepareProjectFlow(config, f.store, actor, { kind: "repair", directory: ".", jobId: job.id, artifactHash: job.artifact.archiveHash }, signal);
        assert.equal(selected.artifact?.archiveHash, job.artifact.archiveHash);
        const app = "orders-fixture", team = "a".repeat(24), id = "b".repeat(24);
        const publication = { ...config, apps: [app], teamId: team, liaraToken: "synthetic-test-only",
          enableMutations: true, enableLiveLiara: true, probeOrigins: { [app]: `https://${app}.example.com` } };
        f.store.saveConnection(actor, {
          source: "token", ciphertext: sealCredential(publication.liaraToken, publication.sessionSecret, actor, "liara"),
          view: { provider: "liara", status: "connected", identityId: "fixture-account", login: "fixture@example.test",
            displayName: "Fixture", teamId: team, teamName: "Fixture", selectedApp: app,
            apps: [{ id, name: app, platform: "docker" }], checkedAt: Date.now() },
        });
        const read = new LiaraReadClient(publication, async (url, init) => {
          assert.equal(new URL(url).pathname, `/v1/projects/${app}`);
          assert.equal(init.method, "GET");
          return Response.json({ project: { _id: id, project_id: app, type: "docker", status: "Running", envs: [], planID: "fixture-plan" } });
        });
        const propose = (total: number) => executeAgentTool("propose_publication", {
          path: "/api/orders", status: 200, assertion: { kind: "json", field: "total", equals: total },
        }, { config: publication, store: f.store, actorId: actor, context: currentAgentContext(publication, f.store, actor),
          createdAt: Date.now(), budget: new RunBudget(publication), signal, read });
        await assert.rejects(propose(74), { code: "PROJECT_BUILD_REQUIRED" });
        const action = object(object(await propose(73)).publicationProposal);
        const spec = parseActionSpec(action.spec);
        assert.equal(spec.version, 21);
        assert.equal(spec.artifactHash, job.artifact.archiveHash);
        assert.equal(action.state, "awaiting_approval");
        console.log(JSON.stringify({ scenario, source: flow.profile.sourceHash, image: job.builtImage, archive: job.artifact.archiveHash }));
      } else {
        assert.equal(job.state, "failed");
        assert.equal(job.artifact, null);
        if (scenario === "original-test-failure") assert.equal(job.errorCode, "DOCKER_BUILD_FAILED");
        else assert.equal(job.afterTest?.exitCode, 73);
      }
    } finally { f.close(); }
  });
}
