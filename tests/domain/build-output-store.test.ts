import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { link, mkdtemp, mkdir, readFile, readdir, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { parseBuildOutputReceipt } from "../../src/contracts/build-output.ts";
import { validateBuildOutput } from "../../src/server/agent/build-output.ts";
import { persistBuildOutput, readBuildOutput } from "../../src/server/agent/build-output-store.ts";

const binding = { sourceHash: "1".repeat(64), planHash: "2".repeat(64) };
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
function output() {
  const files = new Map([["index.html", Buffer.from("<!doctype html><title>built app</title>")], ["asset.bin", Buffer.from([0, 128, 255])]]);
  return validateBuildOutput({ version: 1, files: [...files].map(([path, content]) => ({ path, type: "file", bytes: content.length, sha256: hash(content) })) }, files);
}

test("compiled bytes survive a new reader, bind source and plan, and cannot be changed through returned buffers", async () => {
  const state = await mkdtemp(join(tmpdir(), "launchlane-output-store-"));
  try {
    const built = output(), receipt = await persistBuildOutput(state, built, binding);
    assert.deepEqual(parseBuildOutputReceipt(JSON.parse(JSON.stringify(receipt))), receipt);
    built.files[0]?.content.fill(42);
    const restored = await readBuildOutput(state, receipt, binding);
    assert.deepEqual(restored.files.map(file => file.content), output().files.map(file => file.content));
    restored.files[0]?.content.fill(0);
    assert.deepEqual((await readBuildOutput(state, receipt, binding)).files.map(file => file.content), output().files.map(file => file.content));
    for (const expected of [{ ...binding, sourceHash: "3".repeat(64) }, { ...binding, planHash: "4".repeat(64) }])
      await assert.rejects(readBuildOutput(state, receipt, expected), { code: "BUILD_OUTPUT_BINDING_CHANGED" });
    assert.deepEqual(await readdir(join(state, "build-outputs")), [`${receipt.artifactHash}.json`]);
  } finally { await rm(state, { recursive: true, force: true }); }
});

test("a changed, missing, linked or forged output cannot become a durable success receipt", async () => {
  const state = await mkdtemp(join(tmpdir(), "launchlane-output-store-"));
  try {
    const receipt = await persistBuildOutput(state, output(), binding), path = join(state, "build-outputs", `${receipt.artifactHash}.json`), bytes = await readFile(path);
    await writeFile(path, Buffer.alloc(bytes.length, 42));
    await assert.rejects(readBuildOutput(state, receipt, binding), { code: "BUILD_OUTPUT_MISMATCH" });
    await assert.rejects(persistBuildOutput(state, output(), binding), { code: "BUILD_OUTPUT_MISMATCH" });
    await writeFile(path, bytes);
    const outside = join(state, "linked.json"); await link(path, outside);
    await assert.rejects(readBuildOutput(state, receipt, binding), { code: "BUILD_OUTPUT_MISMATCH" });
    await unlink(outside); await unlink(path);
    await assert.rejects(readBuildOutput(state, receipt, binding), { code: "BUILD_OUTPUT_UNAVAILABLE" });
    const built = output(); built.files[0]?.content.fill(42);
    await assert.rejects(persistBuildOutput(state, built, binding), { code: "BUILD_OUTPUT_MISMATCH" });
  } finally { await rm(state, { recursive: true, force: true }); }
});

test("a linked output directory cannot move generated assets outside the selected state root", async () => {
  const state = await mkdtemp(join(tmpdir(), "launchlane-output-store-")), other = await mkdtemp(join(tmpdir(), "launchlane-output-other-"));
  try {
    await symlink(other, join(state, "build-outputs"), process.platform === "win32" ? "junction" : "dir");
    await assert.rejects(persistBuildOutput(state, output(), binding), { code: "BUILD_OUTPUT_PATH_DENIED" });
    assert.deepEqual(await readdir(other), []);
    await unlink(join(state, "build-outputs"));
  } finally { await rm(state, { recursive: true, force: true }); await rm(other, { recursive: true, force: true }); }
});

test("concurrent identical writers share one verified file and leave no pending publication behind", async () => {
  const state = await mkdtemp(join(tmpdir(), "launchlane-output-store-"));
  try {
    const receipts = await Promise.all(Array.from({ length: 8 }, () => persistBuildOutput(state, output(), binding)));
    assert.ok(receipts.every(row => row.artifactHash === receipts[0]?.artifactHash));
    assert.deepEqual(await readdir(join(state, "build-outputs")), [`${receipts[0]?.artifactHash}.json`]);
  } finally { await rm(state, { recursive: true, force: true }); }
});

test("storage exhaustion rejects a new output without overwriting or deleting another receipt", async () => {
  const state = await mkdtemp(join(tmpdir(), "launchlane-output-store-"));
  try {
    const root = join(state, "build-outputs"); await mkdir(root);
    for (let i = 0; i < 32; i++) await writeFile(join(root, `${i}.json`), "owned-prior-output");
    await assert.rejects(persistBuildOutput(state, output(), binding), { code: "BUILD_OUTPUT_STORAGE_LIMIT" });
    assert.equal((await readdir(root)).length, 32);
  } finally { await rm(state, { recursive: true, force: true }); }
});

test("two concurrent outputs cannot both consume the last available storage slot", async () => {
  const state = await mkdtemp(join(tmpdir(), "launchlane-output-store-"));
  try {
    const root = join(state, "build-outputs"); await mkdir(root);
    for (let i = 0; i < 31; i++) await writeFile(join(root, `${i}.json`), "owned-prior-output");
    const results = await Promise.allSettled([persistBuildOutput(state, output(), binding), persistBuildOutput(state, output(), { ...binding, sourceHash: "3".repeat(64) })]);
    assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
    assert.equal((await readdir(root)).length, 32);
  } finally { await rm(state, { recursive: true, force: true }); }
});
