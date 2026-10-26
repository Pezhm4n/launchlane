import assert from "node:assert/strict";
import { test } from "node:test";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import { proposeWorkloadDeployment } from "../../src/server/application/deployment.ts";
import { LiaraReadClient } from "../../src/server/liara/client.ts";
import { LiaraDeployClient } from "../../src/server/liara/deploy.ts";
import { sealCredential } from "../../src/server/connections/credentials.ts";
import { connectedLiaraConfig } from "../../src/server/connections/liara.ts";
import { fingerprint, parseActionSpec } from "../../src/server/policy/action.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";
import { agentFixture } from "../helpers/agent-fixture.ts";

test("Next source omission preserves Liara's documented mirror default through archive, proposal and release; explicit false stays false", async () => {
  for (const mirror of [undefined, false, true]) {
    const f = await agentFixture();
    try {
      const team = "a".repeat(24), app = "native-next-fixture", actor = f.session.actorId;
      const config = { ...f.config, teamId: team, apps: [app], enableMutations: true, enableLiveLiara: true, probeOrigins: { [app]: `https://${app}.liara.run` } };
      f.store.saveConnection(actor, { source: "token", ciphertext: sealCredential("synthetic-next-provider-key", config.sessionSecret, actor, "liara"), view: {
        provider: "liara", status: "connected", identityId: "b".repeat(24), teamId: team, teamName: "test", displayName: "test", login: "test@example.test", checkedAt: Date.now(), selectedApp: app, apps: [{ id: "c".repeat(24), name: app, platform: "next" }] } });
      const flow = await prepareProjectFlow(config, f.store, actor, { kind: "upload", directory: ".", name: app }, AbortSignal.timeout(10000), undefined, undefined, [
        { path: "package.json", content: Buffer.from(JSON.stringify({ dependencies: { next: "16.3.1", react: "19.2.8", "react-dom": "19.2.8" }, scripts: { build: "next build", start: "next start" } })) },
        { path: "liara.json", content: Buffer.from(JSON.stringify({ app, platform: "next", port: 3000, ...(mirror === undefined ? {} : { next: { mirror } }) })) },
        { path: "app/page.tsx", content: Buffer.from('export default function Page(){return <h1>Native Next</h1>}') },
      ]);
      assert.equal(flow.profile.nextRuntime?.mirror, mirror ?? true); assert.ok(flow.artifact);
      const scoped = connectedLiaraConfig(config, f.store, actor, app), read = new LiaraReadClient(scoped, async () => Response.json({ project: {
        _id: "c".repeat(24), project_id: app, type: "next", status: "ACTIVE", planID: "small-g2", envs: [] } }));
      const action = await proposeWorkloadDeployment(config, f.store, actor, { flowId: flow.id, app, port: 3000,
        workload: { origin: `https://${app}.liara.run`, path: "/", status: 200, assertion: { kind: "text", contains: "Native Next" } } }, AbortSignal.timeout(5000), { read });
      assert.ok(action.spec.version === 17); assert.equal(action.spec.runtime.mirror, mirror ?? true); assert.equal(action.spec.artifactHash, flow.artifact.archiveHash);
      const old = { ...action.spec, runtime: { ...action.spec.runtime, mirror: false } }, previous = fingerprint({ actorId: actor, spec: old });
      assert.deepEqual(parseActionSpec(old), old); assert.equal(fingerprint({ actorId: actor, spec: parseActionSpec(old) }), previous, "stored v17 false is never reinterpreted as the new source default");
      const writer = new LiaraDeployClient(scoped, async (_url, options) => {
        assert.equal(options.method, "POST");
        const body: unknown = JSON.parse(String(options.body)); assert.ok(body && typeof body === "object" && "platformConfig" in body);
        assert.deepEqual(body.platformConfig, { nodeVersion: "22", mirror: mirror ?? true });
        return Response.json({ releaseID: "d".repeat(24) });
      });
      await writer.release(action.spec, "source-fixture", new RunBudget(scoped), AbortSignal.timeout(5000));
    } finally { f.close(); }
  }
});
