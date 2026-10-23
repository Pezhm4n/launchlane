import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readdir, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { planFolderUpload } from "../../src/contracts/folder-upload.ts";
import { SOURCE_MAX_FILE_BYTES } from "../../src/contracts/source-limits.ts";
import { readFolderUpload } from "../../src/server/workspace/upload.ts";
import { prepareProjectFlow, restoreProjectFlow } from "../../src/server/application/project-flows.ts";
import { Store } from "../../src/server/persistence/store.ts";
import { readConfig } from "../../src/server/config.ts";
import { AppError } from "../../src/server/errors.ts";

const code = (value: string) => (error: unknown) => error instanceof AppError && error.code === value;
function request(paths: string[], contents = paths.map(() => "hello"), extra?: (form: FormData) => void) {
  const form = new FormData(); form.set("manifest", JSON.stringify({ name: "my-project", paths }));
  for (const [index, path] of paths.entries()) form.set(`file-${index}`, new Blob([contents[index] || ""]), path.split("/").at(-1));
  extra?.(form); return new Request("http://localhost/api/projects/upload", { method: "POST", body: form });
}
test("folder preview excludes private files and dependencies before constructing the request", () => {
  const plan = planFolderUpload([
    { path: "project/package.json", size: 80 }, { path: "project/src/server.mjs", size: 120 },
    { path: "project/.env.local", size: 100 }, { path: "project/node_modules/pkg/index.js", size: 500 },
    { path: "project/.git/config", size: 100 }, { path: "project/database.sqlite", size: 300 },
  ]);
  assert.deepEqual(plan, { name: "project", files: [{ index: 0, path: "package.json" }, { index: 1, path: "src/server.mjs" }], bytes: 200, excluded: 4 });
  assert.throws(() => planFolderUpload([{ path: "project/../outside.js", size: 1 }]), code("UNSAFE_PATH"));
  assert.throws(() => planFolderUpload([{ path: "project/a.js", size: SOURCE_MAX_FILE_BYTES + 1 }]), code("SOURCE_LIMIT"));
  assert.throws(() => planFolderUpload([{ path: "project/a.js", size: 1 }, { path: "project/A.js", size: 1 }]), code("INVALID_FOLDER"));
  assert.equal(planFolderUpload([{ path: "project/a.js", size: 1 }, { path: "project/node_modules/@scope/pkg/a!b.js", size: 1 }]).excluded, 1);
});
test("server independently rejects private, absolute, traversal, duplicate and mismatched multipart files", async () => {
  for (const path of ["../a.js", "/a.js", "C:/a.js", "src\\a.js", ".env", "node_modules/pkg/a.js"])
    await assert.rejects(readFolderUpload(request([path])), code("UNSAFE_PATH"));
  await assert.rejects(readFolderUpload(request(["a.js", "A.js"])), code("INVALID_UPLOAD"));
  await assert.rejects(readFolderUpload(request(["a.js"], ["hello"], form => form.append("file-0", new Blob(["extra"])))), code("INVALID_UPLOAD"));
  await assert.rejects(readFolderUpload(request(["a.js"], ["x".repeat(SOURCE_MAX_FILE_BYTES + 1)])), code("SOURCE_LIMIT"));
  await assert.rejects(readFolderUpload(new Request("http://localhost", { method: "POST", body: "{}", headers: { "content-type": "application/json" } })), code("INVALID_CONTENT_TYPE"));
});
test("multipart reading stops at its stream bound and honors cancellation before parsing", async () => {
  const headers = { "content-type": "multipart/form-data; boundary=fixture" };
  const controller = new AbortController(); controller.abort();
  const cancelled = new Request("http://localhost", { method: "POST", body: "unused", headers, signal: controller.signal });
  await assert.rejects(readFolderUpload(cancelled), code("CANCELLED"));
  const oversized = new Request("http://localhost", { method: "POST", body: new Uint8Array(22 * 1024 * 1024), headers });
  await assert.rejects(readFolderUpload(oversized), code("SOURCE_LIMIT"));
});
test("a browser-selected folder becomes an inspectable private snapshot without changing workspace permission", async () => {
  const directory = await mkdtemp(join(tmpdir(), "launchlane-folder-upload-"));
  const config = readConfig({ LAUNCHLANE_STATE_DIR: directory, LAUNCHLANE_OPERATOR_TOKEN: "operator-fixture-value-long-enough-123", LAUNCHLANE_SESSION_SECRET: "session-fixture-value-long-enough-123" });
  const store = new Store(join(directory, "state.sqlite")), signal = () => AbortSignal.timeout(10000);
  try {
    const input = await readFolderUpload(request(["package.json", "server.mjs"], [JSON.stringify({ engines: { node: "22" }, scripts: { start: "node server.mjs", preinstall: "node must-not-run.mjs" } }), "import http from 'node:http'; http.createServer((req,res)=>res.end('ready')).listen(process.env.PORT || 3000);"]));
    assert.equal(config.workspaceRoot, null);
    const flow = await prepareProjectFlow(config, store, "actor", { kind: "upload", name: input.name, directory: "." }, signal(), undefined, undefined, input.files);
    assert.equal(flow.status, "ready"); assert.ok(flow.artifact);
    assert.deepEqual(flow.profile.manifest.map(row => row.path), ["package.json", "server.mjs"]);
    assert.equal((await restoreProjectFlow(config, store, "actor", signal(), flow.id))?.status, "ready");
    assert.equal(await readFile(join(directory, "uploaded-sources", flow.id, "server.mjs"), "utf8"), input.files[1]?.content.toString());
    assert.equal(config.workspaceRoot, null);
    await assert.rejects(prepareProjectFlow(config, store, "actor", flow.selection, signal()), code("UPLOAD_REQUIRED"));
    await assert.rejects(prepareProjectFlow(config, store, "actor", flow.selection, signal(), undefined, undefined,
      [{ path: "server.mjs", content: Buffer.from(`const text = '${config.operatorToken}';`) }]), code("SENSITIVE_SOURCE"));
    assert.equal(store.getProjectFlow("actor")?.id, flow.id);
    assert.deepEqual(await readdir(join(directory, "uploaded-sources")), [flow.id]);
  } finally { store.close(); await rm(directory, { recursive: true, force: true }); }
});
