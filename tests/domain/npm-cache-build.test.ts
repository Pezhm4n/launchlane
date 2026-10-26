import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { downloadLockedTarballs, lockedTarballs } from "../../src/server/agent/npm-source.ts";
import { readConfig } from "../../src/server/config.ts";

test("verified public npm cache reuses locked bytes across jobs without spending another network call", async () => {
  const directory = await mkdtemp(join(tmpdir(), "launchlane-cache-build-"));
  try {
    const bytes = Buffer.from("synthetic immutable public package"), integrity = `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
    const items = lockedTarballs([{path:"package-lock.json",content:Buffer.from(JSON.stringify({lockfileVersion:3,packages:{"node_modules/public-package":{resolved:"https://registry.npmjs.org/public-package/-/public-package-1.0.0.tgz",integrity}}}))}]);
    const item = items[0]; assert.ok(item); const root = join(directory,"cache"); let charged = 0, network = 0;
    const read = async () => {network++;return bytes;};
    await downloadLockedTarballs(items,join(directory,"job-a"),AbortSignal.timeout(5000),()=>{charged++;},read,{root});
    assert.equal(charged,1); assert.equal(network,1);
    await downloadLockedTarballs(items,join(directory,"job-b"),AbortSignal.timeout(5000),()=>{throw Error("cache hit must not reserve HTTP allowance");},async()=>{throw Error("cache hit must not read the registry");},{root});
    assert.deepEqual(await readFile(join(directory,"job-b",item.file)),bytes);
    assert.equal(JSON.parse(await readFile(join(directory,"job-b/manifest.json"),"utf8")).length,1);
    await writeFile(join(root,item.file),Buffer.from("corrupted cached content"));
    await assert.rejects(downloadLockedTarballs(items,join(directory,"job-corrupt"),AbortSignal.timeout(5000),()=>{charged++;},read,{root}));
    assert.equal(charged,1); assert.equal(network,1); assert.deepEqual(await readdir(join(directory,"job-corrupt")),[]);
  } finally {await rm(directory,{recursive:true,force:true});}
});

test("an explicitly configured operator content cache is read-only and an invalid cache path is rejected", async () => {
  const directory = await mkdtemp(join(tmpdir(), "launchlane-cache-content-"));
  try {
    const bytes = Buffer.from("synthetic npm content-v2 bytes"), digest = createHash("sha512").update(bytes).digest(), hex = digest.toString("hex"), integrity = `sha512-${digest.toString("base64")}`;
    const items = lockedTarballs([{path:"package-lock.json",content:Buffer.from(JSON.stringify({lockfileVersion:3,packages:{"node_modules/public-package":{resolved:"https://registry.npmjs.org/public-package/-/public-package-1.0.0.tgz",integrity}}}))}]);
    const operatorContentRoot = join(directory,"operator-cache"), parent = join(operatorContentRoot,"content-v2/sha512",hex.slice(0,2),hex.slice(2,4)), file = join(parent,hex.slice(4));
    await mkdir(parent,{recursive:true});await writeFile(file,bytes);
    await downloadLockedTarballs(items,join(directory,"job"),AbortSignal.timeout(5000),()=>{throw Error("operator hit must not reserve HTTP allowance");},async()=>{throw Error("operator hit must not use registry");},{root:join(directory,"cache"),operatorContentRoot});
    assert.deepEqual(await readFile(file),bytes); assert.equal(readConfig({LAUNCHLANE_NPM_CONTENT_CACHE:operatorContentRoot}).npmContentCache,operatorContentRoot);
    assert.throws(()=>readConfig({LAUNCHLANE_NPM_CONTENT_CACHE:"invalid\0cache"}),{code:"CONFIG_INVALID"});
  } finally {await rm(directory,{recursive:true,force:true});}
});
