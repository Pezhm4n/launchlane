import assert from "node:assert/strict";
import { test } from "node:test";
import { dependencyFreeNode, validateBuildPlan } from "../../src/server/agent/build-policy.ts";
import { parseProjectBuildPlan, projectBuildImage } from "../../src/contracts/project-build.ts";
import { captureProject } from "../../src/server/workspace/inspect.ts";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { AppError } from "../../src/server/errors.ts";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import { readArtifact } from "../../src/server/workspace/archive.ts";
import { gunzipSync } from "node:zlib";

test("install=none requires zero dependency declarations and no lock; old locked plans retain their shape", async () => {
  const f = await agentFixture();
  try {
    const captured = await captureProject(f.workspace, "service"), base = { version: 1, nodeVersion: "22", image: projectBuildImage,
      buildCommand: null, testCommand: "node --test", startCommand: "node server.mjs", port: 3000,
      workload: { path: "/", status: 200, assertion: { kind: "text", contains: "invoice service" } } };
    assert.equal(dependencyFreeNode(captured.files), true);
    assert.equal("install" in parseProjectBuildPlan(base), false);
    const plan = parseProjectBuildPlan({ ...base, install: "none" });
    assert.deepEqual(validateBuildPlan(captured.files, captured.profile, plan), plan);
    for (const field of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
      const changed = captured.files.map(file => file.path === "package.json" ? { ...file, content: Buffer.from(JSON.stringify({ ...JSON.parse(file.content.toString("utf8")), [field]: { unknown: "1.0.0" } })) } : file);
      assert.throws(() => validateBuildPlan(changed, captured.profile, plan), (error: unknown) => error instanceof AppError && error.code === "BUILD_INSTALL_SCOPE");
    }
    for (const path of ["package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb"]) assert.equal(dependencyFreeNode([...captured.files, { path, content: Buffer.from("unusable lock") }]), false);
    assert.throws(() => parseProjectBuildPlan({ ...base, install: "skip-errors" }));
  } finally { f.close(); }
});

test("source archives retain extensionless license and attribution notices without admitting excluded credentials", async () => {
  const f = await agentFixture();
  try {
    writeFileSync(join(f.project, "LICENSE"), "Copyright (c) original project author\nMIT License\n");
    writeFileSync(join(f.project, "NOTICE"), "Attribution must travel with this source.\n");
    writeFileSync(join(f.project, "LICENSE-secret"), "must remain excluded\n");
    const flow = await prepareProjectFlow(f.config, f.store, f.session.actorId, { kind: "local", directory: "service" }, AbortSignal.timeout(5000));
    assert.ok(flow.artifact); assert.ok(flow.profile.manifest.some(file => file.path === "LICENSE"));
    assert.equal(flow.profile.manifest.some(file => file.path === "LICENSE-secret"), false);
    const tar = gunzipSync(await readArtifact(f.config.stateDir, flow.artifact));
    assert.ok(tar.includes(Buffer.from("Copyright (c) original project author"))); assert.ok(tar.includes(Buffer.from("Attribution must travel with this source.")));
    assert.equal(tar.includes(Buffer.from("must remain excluded")), false);
  } finally { f.close(); }
});
