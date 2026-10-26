import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { downloadLockedTarballs, lockedTarballs, type LockedTarball } from "../../src/server/agent/npm-source.ts";
import { readNpmPlatformMetadata, writeNpmCacheTarball, writeNpmPlatformMetadata } from "../../src/server/agent/npm-cache.ts";

const bytes = Buffer.from("exact locked native package"), integrity = `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
function locked(libc?: string[]) {
  return lockedTarballs([{ path: "package-lock.json", content: Buffer.from(JSON.stringify({ lockfileVersion: 3,
    packages: { "node_modules/@example/native": { version: "1.2.3", resolved: "https://registry.npmjs.org/@example/native/-/native-1.2.3.tgz",
      integrity, optional: true, os: ["linux"], cpu: ["x64"], ...(libc ? { libc } : {}) } } })) }]);
}
function metadata(item: LockedTarball, libc: string[], change: Record<string, unknown> = {}) {
  return Buffer.from(JSON.stringify({ name: "@example/native", version: "1.2.3", os: ["linux"], cpu: ["x64"], libc,
    dist: { tarball: item.url, integrity: item.integrity }, ...change }));
}
async function inDirectory(work: (root: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "launchlane-npm-platform-"));
  try { await work(root); } finally { await rm(root, { recursive: true, force: true }); }
}

test("an omitted libc is resolved from the exact version metadata before downloading a native optional package", async () => {
  await inDirectory(async root => {
    const items = locked(), item = items[0]; assert.ok(item);
    let reservations = 0, downloads = 0;
    const total = await downloadLockedTarballs(items, root, AbortSignal.timeout(3000), () => { reservations++; }, async () => { downloads++; return bytes; },
      undefined, async identity => { assert.deepEqual(identity, { name: "@example/native", version: "1.2.3" }); return metadata(item, ["musl"]); });
    assert.equal(total, 0); assert.equal(reservations, 1); assert.equal(downloads, 0);
    assert.deepEqual(JSON.parse(await readFile(join(root, "manifest.json"), "utf8")), []);
    const selection = JSON.parse(await readFile(join(root, "platform-selection.json"), "utf8"));
    assert.equal(selection.libc, "glibc"); assert.equal(selection.decisions[0].compatible, false);
    assert.equal(selection.decisions[0].metadataHash, createHash("sha256").update(metadata(item, ["musl"])).digest("hex"));
  });
});

test("the same portable name with glibc metadata downloads and verifies the original locked bytes", async () => {
  await inDirectory(async root => {
    const items = locked(), item = items[0]; assert.ok(item); let reservations = 0;
    const total = await downloadLockedTarballs(items, root, AbortSignal.timeout(3000), () => { reservations++; }, async () => bytes,
      undefined, async () => metadata(item, ["glibc"]));
    assert.equal(total, bytes.length); assert.equal(reservations, 2);
    assert.deepEqual(await readFile(join(root, item.file)), bytes);
    assert.equal(JSON.parse(await readFile(join(root, "manifest.json"), "utf8")).length, 1);
    assert.equal(locked(["musl"]).length, 0);
    assert.equal(locked(["glibc"])[0]?.platformMetadata, undefined);
  });
});

test("unbound registry metadata cannot exclude or replace a locked package", async () => {
  for (const change of [{ name: "other" }, { version: "1.2.4" }, { dist: { tarball: "https://other.invalid/native.tgz", integrity } },
    { dist: { tarball: "https://registry.npmjs.org/@example/native/-/native-1.2.3.tgz", integrity: "changed" } }]) {
    await inDirectory(async root => {
      const items = locked(), item = items[0]; assert.ok(item);
      await assert.rejects(downloadLockedTarballs(items, root, AbortSignal.timeout(3000), () => {}, async () => { throw Error("tarball must not be read"); },
        undefined, async () => metadata(item, ["musl"], change)), { code: "BUILD_METADATA_CHANGED" });
      assert.deepEqual(await readdir(root), []);
    });
  }
});

test("a verified native cache hit needs neither metadata nor another HTTP reservation", async () => {
  await inDirectory(async root => {
    const items = locked(), item = items[0]; assert.ok(item);
    const cache = join(root, "cache"); await writeNpmCacheTarball(cache, item, bytes, AbortSignal.timeout(3000));
    const unavailable = async () => { throw Error("cache hit must remain offline"); };
    assert.equal(await downloadLockedTarballs(items, join(root, "job"), AbortSignal.timeout(3000), () => { throw Error("unnecessary HTTP reservation"); },
      unavailable, { root: cache }, unavailable), bytes.length);
  });
});

test("invalid or interrupted metadata fails before an executable tarball or manifest is published", async () => {
  await inDirectory(async root => {
    await assert.rejects(downloadLockedTarballs(locked(), join(root, "invalid"), AbortSignal.timeout(3000), () => {}, async () => bytes,
      undefined, async () => Buffer.from("not JSON")), { code: "BUILD_METADATA_INVALID" });
    const controller = new AbortController();
    const result = downloadLockedTarballs(locked(), join(root, "cancelled"), controller.signal, () => {}, async () => bytes, undefined,
      async () => { controller.abort(); return new Promise<Buffer>(() => {}); });
    await assert.rejects(result, { code: "CANCELLED" });
    assert.deepEqual(await readdir(join(root, "invalid")), []); assert.deepEqual(await readdir(join(root, "cancelled")), []);
  });
});

test("a persisted incompatible version stays excluded in a later offline job without another registry reservation", async () => {
  await inDirectory(async root => {
    const items = locked(), item = items[0]; assert.ok(item); const cache = { root: join(root, "cache") }; let requests = 0;
    await downloadLockedTarballs(items, join(root, "first"), AbortSignal.timeout(3000), () => { requests++; }, async () => { throw Error("incompatible tarball"); },
      cache, async () => metadata(item, ["musl"]));
    assert.equal(requests, 1);
    assert.equal(await downloadLockedTarballs(items, join(root, "second"), AbortSignal.timeout(3000), () => { throw Error("offline job must not reserve a request"); },
      async () => { throw Error("offline job must not download a tarball"); }, cache, async () => { throw Error("offline job must not refresh excluded metadata"); }), 0);
    assert.deepEqual(JSON.parse(await readFile(join(root, "second/manifest.json"), "utf8")), []);
    assert.deepEqual(await readNpmPlatformMetadata(cache.root, item, AbortSignal.timeout(3000)), metadata(item, ["musl"]));
  });
});

test("platform metadata is immutable, byte-verified and never redownloaded to conceal corruption", async () => {
  await inDirectory(async root => {
    const items = locked(), item = items[0]; assert.ok(item); const cache = { root: join(root, "cache") }, signal = AbortSignal.timeout(3000);
    await writeNpmPlatformMetadata(cache.root, item, metadata(item, ["musl"]), signal);
    await assert.rejects(writeNpmPlatformMetadata(cache.root, item, metadata(item, ["glibc"]), signal), { code: "BUILD_METADATA_CHANGED" });
    const directory = `${cache.root}-platform-v1`, name = (await readdir(directory)).find(name => name.endsWith(".tgz")); assert.ok(name);
    await writeFile(join(directory, name), "corrupted record"); let reads = 0;
    await assert.rejects(downloadLockedTarballs(items, join(root, "corrupt"), signal, () => { reads++; }, async () => bytes, cache,
      async () => { reads++; return metadata(item, ["musl"]); }), { code: "BUILD_METADATA_INVALID" });
    assert.equal(reads, 0); assert.deepEqual(await readdir(join(root, "corrupt")), []);
  });
});
