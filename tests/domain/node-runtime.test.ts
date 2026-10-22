import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { parseNodeRuntime, parseNodeVersion } from "../../src/contracts/node-runtime.ts";
import { decodeProfile } from "../../src/contracts/client-decode.ts";
import {
  prepareProjectFlow,
  restoreProjectFlow,
} from "../../src/server/application/project-flows.ts";
import { readConfig } from "../../src/server/config.ts";
import { AppError } from "../../src/server/errors.ts";
import { Store } from "../../src/server/persistence/store.ts";
import { inspectProject } from "../../src/server/workspace/inspect.ts";
import { resolveNodeRuntime } from "../../src/server/workspace/node-runtime.ts";

test("Node selection respects full ranges and explicit configuration without using the operator runtime", () => {
  for (const [engines, node, expected] of [
    [undefined, undefined, "22"],
    [{}, {}, "22"],
    [{ node: "24.x" }, undefined, "24"],
    [{ node: ">=24.15.0 <25" }, undefined, "24"],
    [{ node: "^20.11.0" }, undefined, "20"],
    [{ node: ">=18 <21" }, undefined, "20"],
    [{ node: "^18 || ^24" }, undefined, "24"],
    [{ node: "22 || 24" }, undefined, "22"],
    [{ node: ">=22 <25" }, { version: "24" }, "24"],
    [undefined, { version: "20" }, "20"],
  ]) {
    const result = resolveNodeRuntime(engines, node);
    assert.equal(result.version, expected, JSON.stringify({ engines, node }));
    assert.deepEqual(parseNodeRuntime(result), result);
  }
  assert.equal(resolveNodeRuntime(undefined, undefined).source, "liara-default");
  assert.equal(resolveNodeRuntime({ node: "24.x" }, undefined).source, "package.json");
  assert.equal(resolveNodeRuntime({ node: ">=22" }, { version: "24" }).source, "liara.json");
  const precise = resolveNodeRuntime({ node: ">=24.15.0 <25" }, undefined);
  assert.equal(precise.requirement, ">=24.15.0 <25");
  assert.match(precise.detail, /نسخه جزئی.*هنوز تأیید نشده/);
});

test("conflicting, unsupported, malformed and prerelease-only Node requirements never silently fall back", () => {
  for (const [engines, node] of [
    [{ node: "24.x" }, { version: "22" }],
    [{ node: ">=26" }, undefined],
    [{ node: "23.x" }, undefined],
    [{ node: "24.0.0-beta.1" }, undefined],
    [{ node: "lts/*" }, undefined],
    [{ node: "24; touch bad" }, undefined],
    [{ node: "" }, undefined],
    [{ node: 24 }, undefined],
    [{ node: null }, undefined],
    [null, undefined],
    [[], undefined],
    [undefined, null],
    [undefined, { version: 24 }],
    [undefined, { version: "24.x" }],
    [undefined, { version: "26" }],
    [undefined, { version: "../../24" }],
  ]) {
    const result = resolveNodeRuntime(engines, node);
    assert.equal(result.version, null, JSON.stringify({ engines, node }));
    assert.ok(result.detail.length > 20);
    assert.deepEqual(parseNodeRuntime(result), result);
  }
  assert.throws(
    () => parseNodeVersion("24.x"),
    (error: unknown) => error instanceof AppError && error.code === "NODE_VERSION_UNSUPPORTED",
  );
  assert.throws(() =>
    parseNodeRuntime({ version: "24", source: "host-runtime", requirement: null, detail: "bad" }),
  );
});

test("inspection keeps declared requirements and explicit Liara choice; conflicting files cannot become publish-ready", async () => {
  const root = await mkdtemp(join(tmpdir(), "launchlane-node-runtime-"));
  let store: Store | undefined;
  try {
    await mkdir(join(root, "app"));
    await mkdir(join(root, "state"));
    await writeFile(
      join(root, "app/package.json"),
      JSON.stringify({ engines: { node: ">=22 <25" }, scripts: { start: "node server.mjs" } }),
    );
    await writeFile(join(root, "app/server.mjs"), "server.listen(3000);");
    await writeFile(join(root, "app/liara.json"), JSON.stringify({ node: { version: "24" } }));
    const profile = await inspectProject(root, "app");
    assert.equal(profile.nodeVersion, ">=22 <25");
    assert.equal(profile.nodeRuntime?.version, "24");
    assert.equal(profile.nodeRuntime?.source, "liara.json");
    assert.deepEqual(decodeProfile({ profile }), profile);
    const { nodeRuntime: _oldRuntime, ...legacyProfile } = profile;
    assert.equal(decodeProfile({ profile: legacyProfile }).nodeRuntime, undefined);
    store = new Store(join(root, "state/state.sqlite"));
    const config = readConfig({
      LAUNCHLANE_WORKSPACE_ROOT: root,
      LAUNCHLANE_STATE_DIR: join(root, "state"),
    });
    const first = await prepareProjectFlow(
      config,
      store,
      "alice",
      { kind: "local", directory: "app" },
      AbortSignal.timeout(5000),
    );
    assert.equal(first.status, "ready");
    assert.ok(first.artifact);
    await writeFile(join(root, "app/liara.json"), JSON.stringify({ node: { version: "20" } }));
    const conflict = await prepareProjectFlow(
      config,
      store,
      "alice",
      { kind: "local", directory: "app" },
      AbortSignal.timeout(5000),
    );
    assert.equal(conflict.status, "incomplete");
    assert.equal(conflict.artifact, null);
    assert.match(conflict.message ?? "", /سازگار نیست/);
  } finally {
    store?.close();
    assert.ok(root.startsWith(join(tmpdir(), "launchlane-node-runtime-")));
    await rm(root, { recursive: true, force: true });
  }
});

test("restoring a historical profile without runtime selection requires fresh inspection, not a renewed approval", async () => {
  const root = await mkdtemp(join(tmpdir(), "launchlane-node-restore-"));
  let store: Store | undefined;
  try {
    await mkdir(join(root, "app"));
    await mkdir(join(root, "state"));
    await writeFile(
      join(root, "app/package.json"),
      JSON.stringify({ scripts: { start: "node server.mjs" } }),
    );
    await writeFile(join(root, "app/server.mjs"), "server.listen(3000);");
    store = new Store(join(root, "state/state.sqlite"));
    const config = readConfig({
      LAUNCHLANE_WORKSPACE_ROOT: root,
      LAUNCHLANE_STATE_DIR: join(root, "state"),
    });
    const flow = await prepareProjectFlow(
      config,
      store,
      "alice",
      { kind: "local", directory: "app" },
      AbortSignal.timeout(5000),
    );
    const { nodeRuntime: _oldRuntime, ...legacyProfile } = flow.profile;
    store.db
      .prepare("UPDATE project_flows SET profile_json=? WHERE id=?")
      .run(JSON.stringify(legacyProfile), flow.id);
    const restored = await restoreProjectFlow(config, store, "alice", AbortSignal.timeout(5000));
    assert.equal(restored?.status, "stale");
    assert.equal(restored?.actionId, null);
    assert.match(restored?.message ?? "", /نسخه Node.*بررسی تازه/);
    assert.equal(store.db.prepare("SELECT count(*) AS n FROM attempts").get()?.n, 0);
  } finally {
    store?.close();
    assert.ok(root.startsWith(join(tmpdir(), "launchlane-node-restore-")));
    await rm(root, { recursive: true, force: true });
  }
});
