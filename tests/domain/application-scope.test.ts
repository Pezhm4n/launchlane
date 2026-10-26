import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { captureProject } from "../../src/server/workspace/inspect.ts";
import { assertApplicationPublicationScope } from "../../src/server/policy/application-scope.ts";
import { decodeProfile } from "../../src/contracts/client-decode.ts";

test("a real Worker/D1 source tree retains its JSONC configuration and cannot be published as its Vite frontend", async () => {
  const root = await mkdtemp(join(tmpdir(), "launchlane-worker-scope-"));
  try {
    await mkdir(join(root, "worker"));
    await writeFile(join(root, "package.json"), JSON.stringify({ engines: { node: ">=22" }, dependencies: { react: "18.3.1", vite: "6.4.3", hono: "4.0.0" }, scripts: { start: "node frontend.cjs", build: "vite build" } }));
    await writeFile(join(root, "frontend.cjs"), "require('node:http').createServer().listen(3000)");
    await writeFile(join(root, "wrangler.jsonc"), '{\n// a standard JSONC file, not executable instructions\n"main":"worker/index.ts","d1_databases":[{"binding":"DB","database_name":"fixture","database_id":"fixture-id"}]\n}');
    await writeFile(join(root, "worker/index.ts"), "import {Hono} from 'hono';const app=new Hono();app.get('/api/health',async c=>{const token=c.req.param('token');return c.json(await c.env.DB.prepare('SELECT 1').first())});export default app;");
    const { profile, files } = await captureProject(root, ".");
    assert.ok(files.some(file => file.path === "wrangler.jsonc")); assert.equal(profile.frontendRuntime, undefined);
    assert.ok(profile.applicationRequirements?.requirements.some(requirement => requirement.kind === "cloudflare_worker" && requirement.need === "required"));
    assert.ok(profile.applicationRequirements?.requirements.some(requirement => requirement.kind === "cloudflare_d1"));
    assert.equal(profile.applicationRequirements?.sourceHash, profile.sourceHash); assert.deepEqual(decodeProfile({ profile }), profile);
    assert.throws(() => assertApplicationPublicationScope(profile), { code: "APPLICATION_TOPOLOGY_REQUIRED" });
    const inspection = profile.applicationRequirements; assert.ok(inspection);
    const entry = profile.manifest.find(file => file.path === "worker/index.ts"); assert.ok(entry);
    assert.throws(() => assertApplicationPublicationScope({ ...profile, applicationRequirements: { ...inspection, requirements: [{ kind: "backend_api", consumerRoot: "backend", need: "unknown", environmentKeys: [], bindingNames: [],
      evidence: [{ path: entry.path, sha256: entry.sha256, line: 1, kind: "source" }] }] } }), { code: "APPLICATION_TOPOLOGY_REQUIRED" }, "an unresolved second backend cannot be discharged by frontend success");
    assert.throws(() => assertApplicationPublicationScope({ ...profile, sourceHash: "f".repeat(64) }), { code: "APPLICATION_SOURCE_CHANGED" });
  } finally { await rm(root, { recursive: true, force: true }); }
});
