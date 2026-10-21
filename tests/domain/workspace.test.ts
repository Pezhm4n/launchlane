import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { inspectProject } from "../../src/server/workspace/inspect.ts";
import { AppError } from "../../src/server/errors.ts";

const code = (expected: string) => (error: unknown) =>
  error instanceof AppError && error.code === expected;
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "launchlane-source-"));
  await mkdir(join(root, "app"));
  await writeFile(
    join(root, "app/package.json"),
    JSON.stringify({ engines: { node: "24.x" }, scripts: { start: "node server.mjs" } }),
  );
  await writeFile(
    join(root, "app/server.mjs"),
    "const port = process.env.PORT || 3000; const key = process.env.SERVICE_TOKEN; server.listen(port);",
  );
  return {
    root,
    async cleanup() {
      assert.ok(root.startsWith(join(tmpdir(), "launchlane-source-")));
      await rm(root, { recursive: true, force: true });
    },
  };
}

test("read-only Node inspection reports names, content hashes and a secret-free manifest", async () => {
  const f = await fixture();
  try {
    await writeFile(join(f.root, "app/.env.local"), "SERVICE_TOKEN=never-publish-this");
    await mkdir(join(f.root, "app/node_modules"));
    await writeFile(join(f.root, "app/node_modules/ignored.txt"), "dependency");
    const result = await inspectProject(f.root, "app");
    assert.equal(result.runtime, "node");
    assert.equal(result.port, 3000);
    assert.equal(result.nodeVersion, "24.x");
    assert.deepEqual(result.envNames, ["PORT", "SERVICE_TOKEN"]);
    assert.deepEqual(
      result.manifest.map((file) => file.path),
      ["package.json", "server.mjs"],
    );
    assert.equal(result.excludedCount, 2);
    assert.ok(!JSON.stringify(result).includes("never-publish-this"));
    const hash = result.sourceHash;
    await writeFile(
      join(f.root, "app/server.mjs"),
      `${await readFile(join(f.root, "app/server.mjs"), "utf8")}\n// new revision`,
    );
    assert.notEqual((await inspectProject(f.root, "app")).sourceHash, hash);
  } finally {
    await f.cleanup();
  }
});

test("missing and contradictory runtime/port facts stay unknown, and scripts never execute", async () => {
  const f = await fixture();
  try {
    await writeFile(
      join(f.root, "app/package.json"),
      JSON.stringify({
        scripts: { start: "node -e \"require('fs').writeFileSync('SHOULD_NOT_EXIST','bad')\"" },
      }),
    );
    await writeFile(join(f.root, "app/second.js"), "server.listen(8080);");
    const result = await inspectProject(f.root, "app");
    assert.equal(result.port, null);
    assert.ok(result.missing.length > 0);
    await assert.rejects(access(join(f.root, "app/SHOULD_NOT_EXIST")));
    await mkdir(join(f.root, "empty"));
    const empty = await inspectProject(f.root, "empty");
    assert.equal(empty.runtime, "unknown");
    assert.equal(empty.start, null);
    assert.equal(empty.port, null);
  } finally {
    await f.cleanup();
  }
});

test("traversal, private paths, symlink/junction escape and oversized files are denied", async () => {
  const f = await fixture();
  try {
    for (const directory of [
      "../app",
      "app/..",
      "/app",
      "C:/app",
      "app\\nested",
      ".local",
      "app/.env.local",
    ])
      await assert.rejects(inspectProject(f.root, directory), code("UNSAFE_PATH"));
    await mkdir(join(f.root, "outside"));
    await symlink(join(f.root, "outside"), join(f.root, "app/link"), "junction");
    await assert.rejects(inspectProject(f.root, "app"), code("UNSAFE_PATH"));
    await rm(join(f.root, "app/link"));
    await writeFile(join(f.root, "app/large.txt"), "x".repeat(512 * 1024 + 1));
    await assert.rejects(inspectProject(f.root, "app"), code("SOURCE_LIMIT"));
  } finally {
    await f.cleanup();
  }
});

test("credential-bearing source is rejected without returning its content; cancellation is explicit", async () => {
  const f = await fixture();
  try {
    await writeFile(join(f.root, "app/settings.json"), '{"password":"do-not-echo-value"}');
    await assert.rejects(
      inspectProject(f.root, "app"),
      (error: unknown) =>
        code("SENSITIVE_SOURCE")(error) && !String(error).includes("do-not-echo-value"),
    );
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      inspectProject(f.root, "app", { signal: controller.signal }),
      code("CANCELLED"),
    );
  } finally {
    await f.cleanup();
  }
});
