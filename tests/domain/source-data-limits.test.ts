import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { test } from "node:test";
import { planFolderUpload } from "../../src/contracts/folder-upload.ts";
import { SOURCE_MAX_BYTES, SOURCE_MAX_CONFIG_BYTES, SOURCE_MAX_DATA_FILE_BYTES, SOURCE_MAX_FILE_BYTES } from "../../src/contracts/source-limits.ts";
import { readFolderUpload } from "../../src/server/workspace/upload.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import { readArtifact } from "../../src/server/workspace/archive.ts";
import { agentFixture } from "../helpers/agent-fixture.ts";

test("large JSON data and SVG assets have a bounded allowance without enlarging executable source or root configuration", () => {
  for (const path of ["public/large.svg", "data/generated/chunks.json"]) {
    assert.equal(planFolderUpload([{ path: `project/${path}`, size: SOURCE_MAX_DATA_FILE_BYTES }]).bytes, SOURCE_MAX_DATA_FILE_BYTES);
    assert.throws(() => planFolderUpload([{ path: `project/${path}`, size: SOURCE_MAX_DATA_FILE_BYTES + 1 }]), { code: "SOURCE_LIMIT" });
  }
  for (const path of ["server.ts", "script.py", "index.html", "large.json"])
    assert.throws(() => planFolderUpload([{ path: `project/${path}`, size: SOURCE_MAX_FILE_BYTES + 1 }]), { code: "SOURCE_LIMIT" });
  for (const path of ["package.json", "liara.json"])
    assert.throws(() => planFolderUpload([{ path: `project/${path}`, size: SOURCE_MAX_CONFIG_BYTES + 1 }]), { code: "SOURCE_LIMIT" });
});

test("a larger data file never raises the unchanged aggregate source bound or admits private files", () => {
  assert.equal(SOURCE_MAX_BYTES, 20 * 1024 * 1024);
  assert.throws(() => planFolderUpload([{ path: "project/data/a.json", size: SOURCE_MAX_DATA_FILE_BYTES },
    { path: "project/data/b.json", size: SOURCE_MAX_BYTES - SOURCE_MAX_DATA_FILE_BYTES + 1 }]), { code: "SOURCE_LIMIT" });
  const plan = planFolderUpload([{ path: "project/public/catalog.json", size: SOURCE_MAX_FILE_BYTES + 1 },
    { path: "project/.env", size: 20 }, { path: "project/private.key", size: 20 }, { path: "project/database.sqlite", size: 20 }]);
  assert.deepEqual(plan.files.map(file => file.path), ["public/catalog.json"]); assert.equal(plan.environmentFiles.length, 1);
});

test("actual multipart upload, captured profile decoding and immutable archive preserve a multi-megabyte runtime artifact", async () => {
  const f = await agentFixture();
  try {
    const data = Buffer.from(JSON.stringify({ revision: "bounded-data", payload: "x".repeat(6 * 1024 * 1024) }));
    const files = [{ path: "package.json", bytes: Buffer.from(JSON.stringify({ engines: { node: "22.x" }, scripts: { start: "node server.mjs" } })) },
      { path: "server.mjs", bytes: Buffer.from("require('node:http').createServer(()=>{}).listen(3000)") },
      { path: "public/catalog.json", bytes: data }];
    const planned = planFolderUpload(files.map(file => ({ path: `project/${file.path}`, size: file.bytes.length })));
    const body = new FormData(); body.set("manifest", JSON.stringify({ name: planned.name, paths: planned.files.map(file => file.path) }));
    for (const [index, file] of files.entries()) body.set(`file-${index}`, new File([file.bytes], file.path));
    const received = await readFolderUpload(new Request("http://127.0.0.1/api/projects/folder", { method: "POST", body }));
    assert.deepEqual(received.files.find(file => file.path === "public/catalog.json")?.content, data);
    const flow = await prepareProjectFlow(f.config, f.store, f.session.actorId, { kind: "upload", directory: ".", name: received.name },
      AbortSignal.timeout(10000), undefined, undefined, received.files);
    const entry = flow.profile.manifest.find(file => file.path === "public/catalog.json");
    assert.equal(entry?.bytes, data.length); assert.equal(entry?.sha256, createHash("sha256").update(data).digest("hex"));
    assert.equal(f.store.getProjectFlow(f.session.actorId, flow.id)?.profile.sourceHash, flow.profile.sourceHash);
    assert.ok(flow.artifact); const archive = await readArtifact(f.config.stateDir, flow.artifact);
    assert.equal(gunzipSync(archive).includes(data), true);
  } finally { f.close(); }
});
