import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import {
  validateBuildOutput, BUILD_OUTPUT_MAX_BYTES, BUILD_OUTPUT_MAX_FILE_BYTES, BUILD_OUTPUT_MAX_FILES,
} from "../../src/server/agent/build-output.ts";

const digest = (content: Uint8Array) => createHash("sha256").update(content).digest("hex");
function input(entries: readonly (readonly [string, Buffer])[]) {
  const contents = new Map(entries), manifest = { version: 1, files: entries.map(([path, content]) => ({ path, type: "file", bytes: content.byteLength, sha256: digest(content) })) };
  return { contents, manifest };
}
const page = Buffer.from("<!doctype html><title>Original app</title>");

test("build output validation sorts exact byte snapshots and keeps a larger frontend chunk without exposing caller mutations", () => {
  const javascript = Buffer.alloc(584 * 1024, 97), { contents, manifest } = input([["assets/main.js", javascript], ["index.html", page], ["assets/empty.css", Buffer.alloc(0)]]);
  const result = validateBuildOutput(manifest, contents);
  assert.deepEqual(result.manifest.map(file => file.path), ["assets/empty.css", "assets/main.js", "index.html"]);
  assert.deepEqual(result.files.map(file => file.path), result.manifest.map(file => file.path));
  assert.equal(result.totalBytes, page.length + javascript.length);
  assert.equal(digest(result.files[1]?.content ?? Buffer.alloc(0)), manifest.files[0]?.sha256);
  assert.deepEqual(validateBuildOutput({ ...manifest, files: [...manifest.files].reverse() }, new Map(contents)).manifest, result.manifest);
  javascript.fill(98); assert.equal(result.files[1]?.content[0], 97);
  assert.throws(() => validateBuildOutput(manifest, contents), { code: "BUILD_OUTPUT_MISMATCH" });
});

test("tampered bytes, hashes, missing or extra content and size mismatches cannot become an output receipt", () => {
  const { contents, manifest } = input([["index.html", page], ["app.js", Buffer.from("console.log('ready')")]]);
  const corrupted = new Map(contents); corrupted.set("app.js", Buffer.alloc(contents.get("app.js")?.length ?? 0, 42));
  assert.throws(() => validateBuildOutput(manifest, corrupted), { code: "BUILD_OUTPUT_MISMATCH" });
  const missing = new Map(contents); missing.delete("app.js"); assert.throws(() => validateBuildOutput(manifest, missing), { code: "BUILD_OUTPUT_MISMATCH" });
  const extra = new Map(contents); extra.set("hidden.js", Buffer.alloc(0)); assert.throws(() => validateBuildOutput(manifest, extra), { code: "BUILD_OUTPUT_MISMATCH" });
  const shorter = new Map(contents); shorter.set("app.js", Buffer.from("short")); assert.throws(() => validateBuildOutput(manifest, shorter), { code: "BUILD_OUTPUT_MISMATCH" });
  assert.throws(() => validateBuildOutput({ ...manifest, files: manifest.files.map(file => ({ ...file, sha256: "0".repeat(64) })) }, contents), { code: "BUILD_OUTPUT_MISMATCH" });
});

test("absolute, traversal, Windows, encoded and noncanonical output paths are denied", () => {
  for (const path of ["/index.html", "../index.html", "assets/../../index.html", "C:/index.html", "C:\\index.html", "\\\\server\\index.html", "./index.html", "assets//app.js", "assets/./app.js", "assets\\app.js", "assets/app.js:stream", "%2e%2e/index.html", "assets/app.js.", "assets/app.js ", "NUL.txt", "assets/COM1.js", "assets/COM².js", "assets/cafe\u0301.js"]) {
    const { manifest, contents } = input([["index.html", page], [path, Buffer.from("content")]]);
    assert.throws(() => validateBuildOutput(manifest, contents), { name: "AppError" }, path);
  }
});

test("case, compatibility and file-directory aliases cannot produce conflicting host destinations", () => {
  for (const paths of [["assets/app.js", "assets/APP.js"], ["assets/Ｋ.js", "assets/K.js"], ["assets", "assets/main.js"], ["ASSETS", "assets/main.js"]]) {
    const { manifest, contents } = input([["index.html", page], ...paths.map<readonly [string, Buffer]>(path => [path, Buffer.from("content")])]);
    assert.throws(() => validateBuildOutput(manifest, contents), { code: "BUILD_OUTPUT_PATH_DENIED" });
  }
  const { manifest, contents } = input([["index.html", page]]);
  assert.throws(() => validateBuildOutput({ ...manifest, files: [...manifest.files, ...manifest.files] }, contents), { code: "BUILD_OUTPUT_PATH_DENIED" });
});

test("symlinks, hardlinks, directories, special files and unknown metadata are rejected without reading content", () => {
  const { manifest, contents } = input([["index.html", page]]);
  for (const type of ["symlink", "link", "directory", "fifo", "character-device", "socket"]) assert.throws(() => validateBuildOutput({ ...manifest, files: [{ ...manifest.files[0], type }] }, contents), { code: "BUILD_OUTPUT_TYPE_DENIED" });
  assert.throws(() => validateBuildOutput({ ...manifest, files: [{ ...manifest.files[0], linkname: "../private" }] }, contents), { code: "BUILD_OUTPUT_INVALID" });
  assert.throws(() => validateBuildOutput({ ...manifest, root: "/private" }, contents), { code: "BUILD_OUTPUT_INVALID" });
});

test("private config, environment, database and credential files are excluded from public build bytes", () => {
  for (const path of [".env", ".env.production", ".git/config", ".local/catalogue.sqlite3", "catalogue.db", "catalogue.sqlite", "data/catalogue.sqlite3", "private/data.json", "nested/__private__/app.js", ".npmrc", "id_rsa", "credentials.json", "package.json", "package-lock.json", "requirements.lock.txt", "Dockerfile", "app.log", "backup.zip"]) {
    const { manifest, contents } = input([["index.html", page], [path, Buffer.from("private")]]);
    assert.throws(() => validateBuildOutput(manifest, contents), { code: "BUILD_OUTPUT_PRIVATE_FILE" }, path);
  }
});

test("index.html is exact, required and nonempty; malformed manifests stay typed failures", () => {
  for (const entries of [[["app.js", Buffer.from("ready")]], [["INDEX.HTML", page]], [["index.html", Buffer.alloc(0)]]] as const) {
    const { manifest, contents } = input(entries); assert.throws(() => validateBuildOutput(manifest, contents), { code: "BUILD_OUTPUT_INDEX_REQUIRED" });
  }
  for (const manifest of [null, [], { version: 2, files: [] }, { version: 1, files: "files" }, { version: 1, files: [{ path: "index.html", type: "file", bytes: -1, sha256: "not-a-hash" }] }]) assert.throws(() => validateBuildOutput(manifest, new Map()), { code: "BUILD_OUTPUT_INVALID" });
});

test("declared size and count limits are enforced before content copying, including aggregate overflow", () => {
  const { manifest, contents } = input([["index.html", page]]), index = manifest.files[0];
  assert.throws(() => validateBuildOutput({ version: 1, files: [] }, new Map()), { code: "BUILD_OUTPUT_LIMIT" });
  assert.throws(() => validateBuildOutput({ version: 1, files: Array.from({ length: BUILD_OUTPUT_MAX_FILES + 1 }, () => index) }, contents), { code: "BUILD_OUTPUT_LIMIT" });
  assert.throws(() => validateBuildOutput({ version: 1, files: [{ ...index, bytes: BUILD_OUTPUT_MAX_FILE_BYTES + 1 }] }, contents), { code: "BUILD_OUTPUT_LIMIT" });
  const oversized = Array.from({ length: BUILD_OUTPUT_MAX_BYTES / BUILD_OUTPUT_MAX_FILE_BYTES }, (_, i) => ({ path: `assets/${i}.js`, type: "file", bytes: BUILD_OUTPUT_MAX_FILE_BYTES, sha256: "0".repeat(64) }));
  assert.throws(() => validateBuildOutput({ version: 1, files: [...oversized, index] }, contents), { code: "BUILD_OUTPUT_LIMIT" });
});

test("exact count, per-file and total byte boundaries are accepted without copying bytes outside an input view", () => {
  const many = input([["index.html", page], ...Array.from({ length: BUILD_OUTPUT_MAX_FILES - 1 }, (_, i): readonly [string, Buffer] => [`assets/${i}.js`, Buffer.alloc(0)])]);
  assert.equal(validateBuildOutput(many.manifest, many.contents).files.length, BUILD_OUTPUT_MAX_FILES);
  const largest = Buffer.alloc(BUILD_OUTPUT_MAX_FILE_BYTES, 97), maximal = input([["index.html", largest], ["one.js", largest], ["two.js", largest], ["three.js", largest]]);
  assert.equal(validateBuildOutput(maximal.manifest, maximal.contents).totalBytes, BUILD_OUTPUT_MAX_BYTES);
  const surrounding = Buffer.concat([Buffer.from("private prefix"), page, Buffer.from("private suffix")]), view = new Uint8Array(surrounding.buffer, surrounding.byteOffset + 14, page.length), single = input([["index.html", page]]);
  const result = validateBuildOutput(single.manifest, new Map([["index.html", view]]));
  assert.deepEqual(result.files[0]?.content, page); assert.equal(result.totalBytes, page.length);
});
