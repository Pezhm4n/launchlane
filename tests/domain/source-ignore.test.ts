import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { sourceIgnore } from "../../src/contracts/source-ignore.ts";
import { planDeviceFolder } from "../../src/contracts/folder-upload.ts";
import { captureProject } from "../../src/server/workspace/inspect.ts";
import { filterSourceFiles } from "../../src/server/workspace/source-ignore.ts";

test("gitignore preserves nested negations, anchored paths, directory exclusions and case semantics", () => {
  const ignored = sourceIgnore([{ path: ".gitignore", content: "/root-only.txt\n*.md\ncache/\n!README.md\n" },
    { path: "docs/.gitignore", content: "!guide.md\n/hidden.txt\n" }]);
  assert.equal(ignored("root-only.txt"), true); assert.equal(ignored("docs/root-only.txt"), false);
  assert.equal(ignored("README.md"), false); assert.equal(ignored("readme.md"), true);
  assert.equal(ignored("docs/guide.md"), false); assert.equal(ignored("docs/other.md"), true);
  assert.equal(ignored("docs/hidden.txt"), true); assert.equal(ignored("docs/nested/hidden.txt"), false);
  assert.equal(ignored("cache/keep.js"), true);
  const blockedParent = sourceIgnore([{ path: ".gitignore", content: "cache/\n!cache/keep.js" }, { path: "cache/.gitignore", content: "!keep.js" }]);
  assert.equal(blockedParent("cache/keep.js"), true);
});
test("rules are bounded and cannot address external or ambiguous scopes", () => {
  for (const path of ["../.gitignore", "C:/.gitignore", "a\\b/.gitignore", ".gitignore/.gitignore"])
    if (path !== ".gitignore/.gitignore") assert.throws(() => sourceIgnore([{ path, content: "*" }]));
  assert.throws(() => sourceIgnore([{ path: ".gitignore", content: "x".repeat(16385) }]));
  assert.throws(() => sourceIgnore([{ path: ".gitignore", content: "\n".repeat(2049) }]));
  assert.throws(() => sourceIgnore([{ path: ".gitignore", content: "" }, { path: ".gitignore", content: "" }]));
});
test("device selection applies rules before size checks and keeps environment in the encrypted import lane", async () => {
  const entries = [{ path: ".gitignore", content: "backups/\n.env\n!.env\n!.agents/**\n" }, { path: "package.json", content: '{"scripts":{"start":"node app.js"}}' },
    { path: "app.js", content: "process.exit(0)" }, { path: ".env", content: "PRIVATE_TOKEN=private-input" }, { path: ".agents/note.md", content: "private instructions" }];
  const files = entries.map(entry => ({ webkitRelativePath: `app/${entry.path}`, size: Buffer.byteLength(entry.content), text: async () => entry.content }));
  files.push({ webkitRelativePath: "app/backups/large.json", size: 64 * 1024 * 1024, text: async () => { throw Error("ignored data must not be read"); } });
  const plan = await planDeviceFolder(files);
  assert.deepEqual(plan.files.map(file => file.path).sort(), [".gitignore", "app.js", "package.json"]);
  assert.deepEqual(plan.environmentFiles.map(file => file.name), [".env"]);
});
test("server capture and uploaded-source filtering agree and private exclusions cannot be undone", async () => {
  const root = await mkdtemp(join(tmpdir(), "launchlane-ignore-"));
  const files = [{ path: ".gitignore", content: "backups/\n!AGENTS.md\n!.env\n" }, { path: "package.json", content: '{"scripts":{"start":"node app.js"}}' },
    { path: "app.js", content: "// no execution during capture" }, { path: "backups/private.json", content: '{"password":"do-not-publish"}' },
    { path: ".env", content: "PRIVATE_TOKEN=never-publish" }, { path: "AGENTS.md", content: "private notes" }].map(file => ({ path: file.path, content: Buffer.from(file.content) }));
  try {
    for (const file of files) { await mkdir(join(root, file.path, ".."), { recursive: true }); await writeFile(join(root, file.path), file.content); }
    const captured = await captureProject(root, "."), filtered = filterSourceFiles(files);
    assert.deepEqual(captured.files.map(file => file.path).sort(), filtered.map(file => file.path).sort());
    assert.deepEqual(captured.files.map(file => file.path).sort(), [".gitignore", "app.js", "package.json"]);
  } finally { await rm(root, { recursive: true, force: true }); }
});
