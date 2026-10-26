import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { link, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { test } from "node:test";
import { watch } from "node:fs";
import { AppError } from "../../src/server/errors.ts";
import { npmCacheByteLimit, npmCacheEntryLimit, readNpmCacheTarball, readNpmContentCacheTarball, writeNpmCacheTarball } from "../../src/server/agent/npm-cache.ts";
import type { LockedTarball } from "../../src/server/agent/npm-source.ts";

const header = "LAUNCHLANE_NPM_CACHE_V1\n", signal = () => AbortSignal.timeout(5000);
const code = (expected: string) => (error: unknown) => error instanceof AppError && error.code === expected;
function item(bytes: Buffer, algorithm: "sha256" | "sha512" = "sha512"): LockedTarball {
  const digest = createHash(algorithm).update(bytes).digest("base64"), integrity = `${algorithm}-${digest}`;
  return { url: "https://registry.npmjs.org/launchlane-fixture/-/launchlane-fixture-1.0.0.tgz", algorithm, digest, integrity,
    file: `${createHash("sha256").update(integrity).digest("hex")}.tgz` };
}
function contentPath(root: string, value: LockedTarball) {
  const hex = Buffer.from(value.digest, "base64").toString("hex");
  return join(root, "content-v2", value.algorithm, hex.slice(0, 2), hex.slice(2, 4), hex.slice(4));
}
async function fixture() {
  const base = await realpath(tmpdir()), folder = await realpath(await mkdtemp(join(base, "launchlane-cache-test-")));
  return { folder, root: join(folder, "private", "npm-cache"), close: async () => {
    const path = relative(base, folder); assert.ok(path.startsWith("launchlane-cache-test-") && !path.includes(".."));
    await rm(folder, { recursive: true, force: true });
  } };
}

test("private cache returns exact SHA512/SHA256 content and idempotent writes never duplicate reservations", async () => {
  const f = await fixture();
  try {
    for (const algorithm of ["sha512", "sha256"] as const) {
      const bytes = Buffer.from(`public fixture ${algorithm}`), locked = item(bytes, algorithm);
      assert.equal(await readNpmCacheTarball(f.root, locked, signal()), null);
      await writeNpmCacheTarball(f.root, locked, bytes, signal());
      assert.deepEqual(await readNpmCacheTarball(f.root, locked, signal()), bytes);
      const quota = await readFile(join(f.root, ".quota-v1"));
      await writeNpmCacheTarball(f.root, locked, bytes, signal());
      assert.deepEqual(await readFile(join(f.root, ".quota-v1")), quota);
      assert.equal((await lstat(join(f.root, locked.file))).nlink, 1);
    }
    assert.equal((await readdir(f.root)).some(name => name.startsWith(".pending-") || name === ".write-lock"), false);
  } finally { await f.close(); }
});
test("only missing content is a miss; corrupt content raises integrity before a replacement write", async () => {
  const f = await fixture(), bytes = Buffer.from("public fixture"), locked = item(bytes);
  try {
    await writeNpmCacheTarball(f.root, locked, bytes, signal()); await writeFile(join(f.root, locked.file), "corrupt bytes");
    await assert.rejects(readNpmCacheTarball(f.root, locked, signal()), code("BUILD_INTEGRITY_MISMATCH"));
    await assert.rejects(writeNpmCacheTarball(f.root, locked, bytes, signal()), code("BUILD_INTEGRITY_MISMATCH"));
    assert.equal(await readFile(join(f.root, locked.file), "utf8"), "corrupt bytes");
  } finally { await f.close(); }
});
test("content-v2 lookup reads only the explicit _cacache root and locked digest path, without modifying npm state", async () => {
  const f = await fixture();
  try {
    const cache = join(f.folder, "operator-cacache");
    for (const algorithm of ["sha512", "sha256"] as const) {
      const bytes = Buffer.from(`official layout ${algorithm}`), locked = item(bytes, algorithm), path = contentPath(cache, locked);
      await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes);
      const before = await lstat(path, { bigint: true });
      assert.deepEqual(await readNpmContentCacheTarball(cache, locked, signal()), bytes);
      const after = await lstat(path, { bigint: true }); assert.equal(after.mtimeNs, before.mtimeNs); assert.equal(after.ctimeNs, before.ctimeNs);
      assert.equal(await readNpmContentCacheTarball(join(cache, "content-v2"), locked, signal()), null, "no parent discovery or path guessing");
    }
    assert.deepEqual(await readdir(cache), ["content-v2"]);
  } finally { await f.close(); }
});
test("bad content-v2 bytes and unknown root never become a successful or implicitly downloaded package", async () => {
  const f = await fixture(), locked = item(Buffer.from("locked content"));
  try {
    const cache = join(f.folder, "operator"), path = contentPath(cache, locked); await mkdir(dirname(path), { recursive: true }); await writeFile(path, "wrong");
    await assert.rejects(readNpmContentCacheTarball(cache, locked, signal()), code("BUILD_INTEGRITY_MISMATCH"));
    assert.equal(await readNpmContentCacheTarball(join(f.folder, "absent"), locked, signal()), null);
  } finally { await f.close(); }
});
test("lock identity, filename, algorithm, public registry and explicit absolute root are validated before filesystem writes", async () => {
  const f = await fixture(), bytes = Buffer.from("locked input"), locked = item(bytes);
  try {
    for (const changed of [{ ...locked, file: "../escape.tgz" }, { ...locked, file: `${"0".repeat(64)}.tgz` }, { ...locked, digest: "" },
      { ...locked, integrity: `${locked.integrity} ` }]) await assert.rejects(writeNpmCacheTarball(f.root, changed, bytes, signal()), code("BUILD_INTEGRITY_REQUIRED"));
    for (const url of ["https://example.invalid/file.tgz", "https://registry.npmjs.org/file.tgz?token=fixture", "https://user:fixture@registry.npmjs.org/file.tgz"])
      await assert.rejects(readNpmCacheTarball(f.root, { ...locked, url }, signal()), code("BUILD_REGISTRY_DENIED"));
    await assert.rejects(readNpmCacheTarball("relative-cache", locked, signal()), code("NPM_CACHE_PATH_DENIED"));
    await assert.rejects(writeNpmCacheTarball(f.root, locked, Buffer.from("wrong bytes"), signal()), code("BUILD_INTEGRITY_MISMATCH"));
    assert.deepEqual(await readdir(f.folder), []);
  } finally { await f.close(); }
});
test("symlinked directories and hardlinked tarballs fail closed in both cache layouts", async () => {
  const f = await fixture(), bytes = Buffer.from("public inode fixture"), locked = item(bytes);
  try {
    const actual = join(f.folder, "actual"), alias = join(f.folder, "alias"); await mkdir(actual); await symlink(actual, alias, process.platform === "win32" ? "junction" : "dir");
    await assert.rejects(writeNpmCacheTarball(join(alias, "cache"), locked, bytes, signal()), code("NPM_CACHE_PATH_DENIED"));
    await assert.rejects(readNpmContentCacheTarball(alias, locked, signal()), code("NPM_CACHE_PATH_DENIED"));
    await writeNpmCacheTarball(f.root, locked, bytes, signal()); await link(join(f.root, locked.file), join(f.folder, "second-link"));
    await assert.rejects(readNpmCacheTarball(f.root, locked, signal()), code("NPM_CACHE_PATH_DENIED"));
    const official = contentPath(actual, locked); await mkdir(dirname(official), { recursive: true }); await link(join(f.root, locked.file), official);
    await assert.rejects(readNpmContentCacheTarball(actual, locked, signal()), code("NPM_CACHE_PATH_DENIED"));
  } finally { await f.close(); }
});
test("cancelled operations create no state and queued readers cannot mistake a partial write for a hit", async () => {
  const f = await fixture(), bytes = Buffer.from("queue fixture"), locked = item(bytes), stopped = new AbortController(); stopped.abort();
  try {
    await assert.rejects(writeNpmCacheTarball(f.root, locked, bytes, stopped.signal), code("CANCELLED"));
    await assert.rejects(readNpmCacheTarball(f.root, locked, stopped.signal), code("CANCELLED"));
    await assert.rejects(readNpmContentCacheTarball(f.root, locked, stopped.signal), code("CANCELLED"));
    assert.deepEqual(await readdir(f.folder), []);
    const writing = writeNpmCacheTarball(f.root, locked, bytes, signal()), reading = readNpmCacheTarball(f.root, locked, signal());
    await writing; assert.deepEqual(await reading, bytes);
  } finally { await f.close(); }
});

test("cancelling an active cache write settles only after its owned lock and temporary file are cleaned up", async () => {
  const f = await fixture(), controller = new AbortController();await mkdir(f.root, { recursive: true });
  const watcher = watch(f.root, (_event, name) => { if (name === ".write-lock") controller.abort(); });
  try {
    const bytes = Buffer.alloc(8 * 1024 * 1024, 42);
    await assert.rejects(writeNpmCacheTarball(f.root, item(bytes), bytes, controller.signal), code("CANCELLED"));
    assert.equal(controller.signal.aborted, true);
    const files = await readdir(f.root);
    assert.equal(files.some(name => name === ".write-lock" || name.startsWith(".pending-")), false, "the rejected operation must already have finished cleanup");
    const next = Buffer.from("after cancellation");await writeNpmCacheTarball(f.root, item(next), next, signal());
    assert.deepEqual(await readNpmCacheTarball(f.root, item(next), signal()), next);
  } finally { watcher.close();await f.close(); }
});
test("concurrent writers serialize publication and quota reservation, including identical-content collisions", async () => {
  const f = await fixture();
  try {
    const bytes = [Buffer.from("one"), Buffer.from("two"), Buffer.from("one"), Buffer.from("three")];
    await Promise.all(bytes.map(value => writeNpmCacheTarball(f.root, item(value), value, signal())));
    for (const value of bytes) assert.deepEqual(await readNpmCacheTarball(f.root, item(value), signal()), value);
    const lines = (await readFile(join(f.root, ".quota-v1"), "utf8")).slice(header.length).trim().split("\n").filter(line => line !== "INITIALIZED"); assert.equal(lines.length, 3);
    assert.equal((await readdir(f.root)).length, 4);
  } finally { await f.close(); }
});
test("interrupted/deleted reservations stay charged and the same content can resume without resetting quota", async () => {
  const f = await fixture(), bytes = Buffer.from("reserved immutable content"), locked = item(bytes);
  try {
    await writeNpmCacheTarball(f.root, locked, bytes, signal()); const quota = await readFile(join(f.root, ".quota-v1"));
    await unlink(join(f.root, locked.file)); await writeNpmCacheTarball(f.root, locked, bytes, signal());
    assert.deepEqual(await readFile(join(f.root, ".quota-v1")), quota); assert.deepEqual(await readNpmCacheTarball(f.root, locked, signal()), bytes);
  } finally { await f.close(); }
});
test("bounded entry quota uses conservative reservations without creating thousands of physical packages or eviction", async () => {
  const f = await fixture(), bytes = Buffer.from("new package"), locked = item(bytes);
  try {
    await mkdir(f.root, { recursive: true });
    const records = Array.from({ length: npmCacheEntryLimit }, (_, index) => `${index.toString(16).padStart(64, "0")}.tgz 0\n`).join("");
    const index = `${header}${records}INITIALIZED\n`;
    await writeFile(join(f.root, ".quota-v1"), index);
    await assert.rejects(writeNpmCacheTarball(f.root, locked, bytes, signal()), code("NPM_CACHE_LIMIT"));
    assert.equal(await readFile(join(f.root, ".quota-v1"), "utf8"), index); assert.deepEqual(await readdir(f.root), [".quota-v1"]);
  } finally { await f.close(); }
});
test("byte quota includes reserved metadata and never resets an interrupted reservation", async () => {
  const f = await fixture(), bytes = Buffer.from("new package"), locked = item(bytes);
  try {
    await mkdir(f.root, { recursive: true }); const unit = 64 * 1024 * 1024, overhead = 512 * 1024;
    const records = Array.from({ length: 8 }, (_, index) => `${index.toString(16).padStart(64, "0")}.tgz ${index === 7 ? npmCacheByteLimit - 7 * unit - overhead : unit}\n`).join("");
    const index = `${header}${records}INITIALIZED\n`;
    await writeFile(join(f.root, ".quota-v1"), index);
    await assert.rejects(writeNpmCacheTarball(f.root, locked, bytes, signal()), code("NPM_CACHE_LIMIT"));
    assert.equal(await readFile(join(f.root, ".quota-v1"), "utf8"), index); assert.deepEqual(await readdir(f.root), [".quota-v1"]);
  } finally { await f.close(); }
});
test("stale write locks and malformed quota are explicit failures, not misses or automatic resets", async () => {
  const f = await fixture(), bytes = Buffer.from("new package"), locked = item(bytes);
  try {
    await mkdir(f.root, { recursive: true }); await writeFile(join(f.root, ".write-lock"), "");
    await assert.rejects(readNpmCacheTarball(f.root, locked, signal()), code("NPM_CACHE_BUSY"));
    await assert.rejects(writeNpmCacheTarball(f.root, locked, bytes, signal()), code("NPM_CACHE_BUSY"));
    assert.deepEqual(await readdir(f.root), [".write-lock"]); await unlink(join(f.root, ".write-lock"));
    await writeFile(join(f.root, ".quota-v1"), `${header}unfinished record`);
    await assert.rejects(writeNpmCacheTarball(f.root, locked, bytes, signal()), code("NPM_CACHE_UNAVAILABLE"));
    assert.equal(await readFile(join(f.root, ".quota-v1"), "utf8"), `${header}unfinished record`);
    await writeFile(join(f.root, ".quota-v1"), header);
    await assert.rejects(writeNpmCacheTarball(f.root, locked, bytes, signal()), code("NPM_CACHE_UNAVAILABLE"), "a header-only interrupted initialization is not an empty initialized cache");
  } finally { await f.close(); }
});
test("an existing private namespace is scanned once and an unrelated file is never deleted to make room", async () => {
  const f = await fixture(), old = Buffer.from("old cache entry"), fresh = Buffer.from("new cache entry");
  try {
    await mkdir(f.root, { recursive: true }); await writeFile(join(f.root, item(old).file), old);
    await writeNpmCacheTarball(f.root, item(fresh), fresh, signal());
    const index = await readFile(join(f.root, ".quota-v1"), "utf8"); assert.ok(index.includes(item(old).file)); assert.ok(index.includes(item(fresh).file));
    const unrelated = join(f.folder, "other-cache"); await mkdir(unrelated); await writeFile(join(unrelated, "operator-note.txt"), "keep this");
    await assert.rejects(writeNpmCacheTarball(unrelated, item(fresh), fresh, signal()), code("NPM_CACHE_LIMIT"));
    assert.equal(await readFile(join(unrelated, "operator-note.txt"), "utf8"), "keep this");
  } finally { await f.close(); }
});
test("even an idempotent writer cannot ignore corrupt quota or an existing writer lock", async () => {
  const f = await fixture(), bytes = Buffer.from("existing cache content"), locked = item(bytes);
  try {
    await writeNpmCacheTarball(f.root, locked, bytes, signal());
    await writeFile(join(f.root, ".quota-v1"), header);
    assert.deepEqual(await readNpmCacheTarball(f.root, locked, signal()), bytes, "a valid immutable read does not change quota");
    await assert.rejects(writeNpmCacheTarball(f.root, locked, bytes, signal()), code("NPM_CACHE_UNAVAILABLE"));
    await writeFile(join(f.root, ".write-lock"), "");
    await assert.rejects(writeNpmCacheTarball(f.root, locked, bytes, signal()), code("NPM_CACHE_BUSY"));
  } finally { await f.close(); }
});
