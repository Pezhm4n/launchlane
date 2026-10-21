import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { browseFolders } from "../../src/server/workspace/browse.ts";
import { inspectProject } from "../../src/server/workspace/inspect.ts";
import { filesystemError } from "../../src/server/workspace/paths.ts";
import { AppError } from "../../src/server/errors.ts";
const signal = () => new AbortController().signal;
const code = (expected: string) => (error: unknown) =>
  error instanceof AppError && error.code === expected;

test("server-folder discovery is bounded, paginated, hides private paths and permits the approved root", async () => {
  const root = await mkdtemp(join(tmpdir(), "launchlane-picker-"));
  try {
    await writeFile(join(root, "package.json"), '{"scripts":{"start":"node server.mjs"}}');
    for (const name of [
      ".git",
      ".env-secrets",
      "node_modules",
      "empty",
      ...Array.from({ length: 51 }, (_, index) => `project-${String(index).padStart(2, "0")}`),
    ])
      await mkdir(join(root, name));
    await writeFile(join(root, "project-00/package.json"), "{}");
    const first = await browseFolders(root, ".", 0, signal());
    assert.equal(first.hasPackage, true);
    assert.equal(first.folders.length, 50);
    assert.equal(first.nextOffset, 50);
    assert.ok(first.folders.find((item) => item.name === "project-00")?.hasPackage);
    assert.ok(
      first.folders.every((item) => ![".git", ".env-secrets", "node_modules"].includes(item.name)),
    );
    const second = await browseFolders(root, ".", 50, signal());
    assert.equal(second.folders.length, 2);
    assert.equal(second.nextOffset, null);
    const empty = await browseFolders(root, "empty", 0, signal());
    assert.equal(empty.folders.length, 0);
    assert.equal(empty.parent, ".");
    const profile = await inspectProject(root, ".");
    assert.equal(profile.runtime, "node");
  } finally {
    assert.ok(root.startsWith(join(tmpdir(), "launchlane-picker-")));
    await rm(root, { recursive: true, force: true });
  }
});

test("missing, invalid, cancelled and escaped selections stay distinct and do not expose native paths", async () => {
  const root = await mkdtemp(join(tmpdir(), "launchlane-picker-"));
  try {
    await writeFile(join(root, "plain-file"), "data");
    await assert.rejects(browseFolders(root, "missing", 0, signal()), code("FOLDER_NOT_FOUND"));
    await assert.rejects(inspectProject(root, "missing"), code("FOLDER_NOT_FOUND"));
    for (const directory of ["../outside", "C:/", ".git", "a/../b"])
      await assert.rejects(browseFolders(root, directory, 0, signal()), code("UNSAFE_PATH"));
    await symlink(tmpdir(), join(root, "outside-link"), "junction");
    assert.equal(
      (await browseFolders(root, ".", 0, signal())).folders.some(
        (item) => item.name === "outside-link",
      ),
      false,
    );
    await assert.rejects(browseFolders(root, "outside-link", 0, signal()), code("UNSAFE_PATH"));
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(browseFolders(root, ".", 0, controller.signal), code("CANCELLED"));
    for (const nativeCode of ["EACCES", "EPERM"]) {
      const error = filesystemError({
        code: nativeCode,
        path: "private-path",
        message: "private-data",
      });
      assert.equal(error.code, "FOLDER_ACCESS_DENIED");
      assert.ok(!error.message.includes("private"));
    }
  } finally {
    assert.ok(root.startsWith(join(tmpdir(), "launchlane-picker-")));
    await rm(root, { recursive: true, force: true });
  }
});
