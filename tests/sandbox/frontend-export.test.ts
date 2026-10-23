import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { test } from "node:test";
import { projectBuildImage } from "../../src/contracts/project-build.ts";
import { exactKeys, object } from "../../src/contracts/validation.ts";
import { BUILD_OUTPUT_MAX_FILE_BYTES } from "../../src/server/agent/build-output.ts";
import { docker, type CommandResult } from "../../src/server/agent/container.ts";
import { decodeBuildOutputExport, exportBuildOutput } from "../../src/server/agent/container-output.ts";

const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const html = Buffer.from('<!doctype html><title>Export verified</title><script src="/assets/main.js"></script>');
function transport(entries: readonly (readonly [string, Buffer])[]) {
  return {
    version: 1,
    manifest: { version: 1, files: entries.map(([path, bytes]) => ({ path, type: "file", bytes: bytes.length, sha256: digest(bytes) })) },
    contents: entries.map(([path, bytes]) => ({ path, base64: bytes.toString("base64") })),
  };
}
const encode = (value: unknown) => Buffer.from(JSON.stringify(value));

test("host decoding preserves exact binary bytes and independently validates exported metadata", () => {
  const binary = Buffer.from([0, 255, 128, 239, 187, 191, 1]), input = transport([["index.html", html], ["assets/picture.png", binary]]);
  const result = decodeBuildOutputExport(encode(input));
  assert.deepEqual(result.manifest.map(file => file.path), ["assets/picture.png", "index.html"]);
  assert.deepEqual(result.files[0]?.content, binary);
  assert.equal(result.totalBytes, html.length + binary.length);
  binary.fill(42); assert.equal(result.files[0]?.content[0], 0);
  const wrongHash = structuredClone(input); const first = wrongHash.manifest.files[0]; assert.ok(first); first.sha256 = "0".repeat(64);
  assert.throws(() => decodeBuildOutputExport(encode(wrongHash)), { code: "BUILD_OUTPUT_MISMATCH" });
});

test("host decoding rejects malformed transport, noncanonical base64 and secret bytes without exposing their contents", () => {
  const input = transport([["index.html", html]]), first = input.contents[0]; assert.ok(first);
  for (const value of [null, {}, { ...input, unexpected: true }, { ...input, version: 2 }, { ...input, contents: [] },
    { ...input, contents: [first, first] }, { ...input, contents: [{ ...first, extra: true }] },
    ...["Zg", "Zh==", "Zg==\n", "_w==", "Zm9v====", "===="].map(base64 => ({ ...input, contents: [{ ...first, base64 }] }))]) {
    assert.throws(() => decodeBuildOutputExport(encode(value)), { code: "BUILD_OUTPUT_INVALID" });
  }
  assert.throws(() => decodeBuildOutputExport(Buffer.from([255])), { code: "BUILD_OUTPUT_INVALID" });
  const privateValue = "fixture-private-value-for-export-check";
  assert.throws(() => decodeBuildOutputExport(encode(transport([["index.html", html], ["assets/binary.png", Buffer.from(`\0${privateValue}\0`)]])), [privateValue]),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "BUILD_OUTPUT_SENSITIVE" && !error.message.includes(privateValue));
  assert.throws(() => decodeBuildOutputExport(encode(transport([["index.html", html], [".env", Buffer.from(privateValue)]]))), { code: "BUILD_OUTPUT_PRIVATE_FILE" });
  assert.throws(() => decodeBuildOutputExport(encode(transport([["index.html", html], ["APP.js", Buffer.from("one")], ["app.js", Buffer.from("two")]]))), { code: "BUILD_OUTPUT_PATH_DENIED" });
});

test("host export validates complete identities, relative roots and cancellation before contacting Docker", async () => {
  const id = "a".repeat(64), signal = new AbortController().signal;
  for (const invalid of ["a".repeat(12), "A".repeat(64), "--all", "worker-name", ` ${id}`])
    await assert.rejects(exportBuildOutput(invalid, "dist", signal), { code: "SANDBOX_ID_DENIED" });
  for (const invalid of ["", "/dist", "../dist", "apps/../dist", "dist/", "apps//dist", "C:/dist", "dist\\nested", ".", "dist;pwd", "a".repeat(241)])
    await assert.rejects(exportBuildOutput(id, invalid, signal), { code: "BUILD_OUTPUT_PATH_DENIED" });
  await assert.rejects(exportBuildOutput(id, "apps/web/dist", AbortSignal.abort()), { code: "CANCELLED" });
  await assert.rejects(exportBuildOutput(id, "dist", signal, ["x".repeat(65537)]), { code: "BUILD_OUTPUT_PRIVATE_SCOPE" });
});

const fixtureLabel = "frontend-export-test-v1";
async function reconcileFixture(name: string, command: typeof docker): Promise<string> {
  const inspected = await command(["inspect", "--type", "container", "--format",
    '{"id":{{json .Id}},"name":{{json .Name}},"image":{{json .Config.Image}},"labels":{{json .Config.Labels}}}', name], AbortSignal.timeout(5000), 8192);
  assert.equal(inspected.exitCode, 0, "Export fixture creation and identity reconciliation remain unconfirmed");
  const identity = object(JSON.parse(inspected.output)); exactKeys(identity, ["id", "name", "image", "labels"]);
  assert.ok(typeof identity.id === "string" && /^[a-f0-9]{64}$/.test(identity.id) && identity.name === `/${name}` &&
    identity.image === projectBuildImage && object(identity.labels)["ir.launchlane.worker"] === fixtureLabel,
    "Exact export fixture name, label, image and full identity are required before cleanup");
  return identity.id;
}

async function runningOutput(setup: string, run: (id: string) => Promise<void>, command: typeof docker = docker) {
  const name = `launchlane-export-test-${randomUUID()}`;
  let id: string | null = null, createAttempted = false, failure: { error: unknown } | null = null;
  try {
    createAttempted = true;
    const result = await command(["create", "--pull=never", "--log-driver", "none", "--name", name,
      "--label", `ir.launchlane.worker=${fixtureLabel}`, "--network", "none", "--read-only", "--cap-drop", "ALL",
      "--security-opt", "no-new-privileges", "--user", "1000:1000", "--cpus", "1", "--memory", "256m", "--memory-swap", "256m", "--pids-limit", "64",
      "--tmpfs", "/work:rw,nosuid,nodev,size=134217728,uid=1000,gid=1000,mode=0700", projectBuildImage,
      "/usr/local/bin/node", "-e", `const fs=require('node:fs');fs.mkdirSync('/work/project/dist',{recursive:true});${setup};fs.writeFileSync('/work/ready','ready');setInterval(()=>{},1000);`], AbortSignal.timeout(10000), 4096);
    if (/^[a-f0-9]{64}$/.test(result.output.trim())) id = result.output.trim();
    assert.equal(result.exitCode, 0, "The owned export fixture must be created with the cached pinned image");
    assert.ok(id, "The fixture create response must contain its complete identity");
    const started = await command(["start", id], AbortSignal.timeout(10000), 4096);
    assert.equal(started.exitCode, 0, "The exact owned fixture must start; a lost start response does not discard its identity");
    let ready = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      const result = await command(["exec", id, "/usr/local/bin/node", "-e", "process.exit(require('node:fs').existsSync('/work/ready')?0:1)"], AbortSignal.timeout(2000), 4096);
      if (result.exitCode === 0) { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.equal(ready, true, "The output fixture must finish before any export");
    await run(id);
    const state = await command(["inspect", "--format", "{{.State.Running}}", id], AbortSignal.timeout(5000), 4096);
    assert.equal(state.output.trim(), "true", "Exporter cleanup belongs to its caller and must leave the container running");
  } catch (error) {
    failure = { error };
  } finally {
    try {
      // A create timeout may follow a committed create; resolve only this unique name and exact ownership.
      if (!id && createAttempted) id = await reconcileFixture(name, command);
      if (id) {
        const removed = await command(["rm", "--force", id], AbortSignal.timeout(5000), 4096);
        assert.equal(removed.exitCode, 0, "Only the exact fixture container must be removed");
      }
    } catch (error) {
      failure = { error: failure ? new AggregateError([failure.error, error], "Export fixture failure and cleanup reconciliation remain recorded") : error };
    }
  }
  if (failure) throw failure.error;
}

test("host export fixture keeps its created identity when the detached start response is lost", async () => {
  const id = "a".repeat(64), calls: string[][] = [];
  const command = async (args: string[]): Promise<CommandResult> => {
    calls.push([...args]);
    if (args[0] === "create") return { output: id, exitCode: 0, signal: null };
    if (args[0] === "start") return { output: "", exitCode: null, signal: "SIGTERM" };
    assert.deepEqual(args, ["rm", "--force", id]); return { output: id, exitCode: 0, signal: null };
  };
  await assert.rejects(runningOutput("", async () => { assert.fail("An uncertain start cannot run an export"); }, command), /lost start response/);
  assert.deepEqual(calls.map(args => args[0]), ["create", "start", "rm"]);
});

test("host export fixture reconciles a lost create response by its unique name, label and pinned image before cleanup", async () => {
  const id = "b".repeat(64), calls: string[][] = []; let name: string | undefined;
  const command = async (args: string[]): Promise<CommandResult> => {
    calls.push([...args]);
    if (args[0] === "create") {
      name = args[args.indexOf("--name") + 1]; assert.ok(name);
      return { output: "", exitCode: null, signal: "SIGTERM" };
    }
    if (args[0] === "inspect") {
      assert.equal(args.at(-1), name);
      return { output: JSON.stringify({ id, name: `/${name}`, image: projectBuildImage, labels: { "ir.launchlane.worker": fixtureLabel } }), exitCode: 0, signal: null };
    }
    assert.deepEqual(args, ["rm", "--force", id]); return { output: id, exitCode: 0, signal: null };
  };
  await assert.rejects(runningOutput("", async () => { assert.fail("An uncertain create cannot start an export"); }, command), /must be created/);
  assert.deepEqual(calls.map(args => args[0]), ["create", "inspect", "rm"]);
});

test("host export fixture never removes a replacement identity or hides an unconfirmed cleanup", async () => {
  for (const mismatch of ["id", "name", "image", "label", "read_failure"]) {
    const calls: string[][] = []; let name: string | undefined;
    const command = async (args: string[]): Promise<CommandResult> => {
      calls.push([...args]);
      if (args[0] === "create") {
        name = args[args.indexOf("--name") + 1]; assert.ok(name);
        return { output: "", exitCode: null, signal: "SIGTERM" };
      }
      assert.equal(args[0], "inspect", "No destructive command is allowed for an unresolved identity");
      return { output: JSON.stringify({ id: mismatch === "id" ? "short-id" : "c".repeat(64), name: mismatch === "name" ? "/unrelated-fixture" : `/${name}`,
        image: mismatch === "image" ? "unrelated-image" : projectBuildImage, labels: { "ir.launchlane.worker": mismatch === "label" ? "unrelated-worker" : fixtureLabel } }),
        exitCode: mismatch === "read_failure" ? 1 : 0, signal: null };
    };
    await assert.rejects(runningOutput("", async () => { assert.fail("An unresolved fixture cannot run"); }, command),
      (error: unknown) => error instanceof AggregateError && error.errors.length === 2);
    assert.deepEqual(calls.map(args => args[0]), ["create", "inspect"]);
  }
});

test("Docker export reads real tmpfs binary/frontend bytes before the caller removes its container", async () => {
  const binary = Buffer.from([0, 255, 128, 23]), javascript = Buffer.from('document.body.dataset.ready="exported";');
  const expected = [["index.html", html], ["assets/main.js", javascript], ["assets/picture.png", binary]] as const;
  await runningOutput(`fs.mkdirSync('/work/project/dist/assets');for(const [path,base64] of ${JSON.stringify(expected.map(([path, bytes]) => [path, bytes.toString("base64")]))})fs.writeFileSync('/work/project/dist/'+path,Buffer.from(base64,'base64'));fs.mkdirSync('/work/project/apps/web',{recursive:true});fs.renameSync('/work/project/dist','/work/project/apps/web/dist');`, async id => {
    const result = await exportBuildOutput(id, "apps/web/dist", AbortSignal.timeout(10000));
    assert.equal(result.files.length, expected.length);
    for (const [path, bytes] of expected) assert.deepEqual(result.files.find(file => file.path === path)?.content, bytes);
    assert.deepEqual(result.manifest.map(file => file.sha256), result.files.map(file => digest(file.content)));
    const returned = result.files[0]; assert.ok(returned); returned.content.fill(42);
    const again = await exportBuildOutput(id, "apps/web/dist", AbortSignal.timeout(10000));
    for (const [path, bytes] of expected) assert.deepEqual(again.files.find(file => file.path === path)?.content, bytes);
  });
});

test("Docker export denies links, private files, aliases and resource limits in actual output trees", async () => {
  const cases = [
    { code: "BUILD_OUTPUT_TYPE_DENIED", setup: "fs.symlinkSync('/etc/passwd','/work/project/dist/leak.txt')" },
    { code: "BUILD_OUTPUT_TYPE_DENIED", setup: "fs.symlinkSync('/work','/work/project/dist/assets')" },
    { code: "BUILD_OUTPUT_TYPE_DENIED", setup: "fs.linkSync('/work/project/dist/index.html','/work/project/dist/alias.html')" },
    { code: "BUILD_OUTPUT_PRIVATE_FILE", setup: "fs.writeFileSync('/work/project/dist/.env','fixture-private-value')" },
    { code: "BUILD_OUTPUT_PATH_DENIED", setup: "fs.writeFileSync('/work/project/dist/app.js','one');fs.writeFileSync('/work/project/dist/APP.js','two')" },
    { code: "BUILD_OUTPUT_LIMIT", setup: `fs.writeFileSync('/work/project/dist/large.js','');fs.truncateSync('/work/project/dist/large.js',${BUILD_OUTPUT_MAX_FILE_BYTES + 1})` },
    { code: "BUILD_OUTPUT_LIMIT", setup: "for(let i=0;i<512;i++)fs.writeFileSync('/work/project/dist/'+i+'.js','')" },
    { code: "BUILD_OUTPUT_LIMIT", setup: `for(let i=0;i<4;i++){const file='/work/project/dist/'+i+'.js';fs.writeFileSync(file,'');fs.truncateSync(file,${BUILD_OUTPUT_MAX_FILE_BYTES})}` },
    { code: "BUILD_OUTPUT_PATH_DENIED", setup: "fs.renameSync('/work/project/dist','/work/elsewhere');fs.symlinkSync('/work/elsewhere','/work/project/dist')" },
  ];
  for (const entry of cases) await runningOutput(`fs.writeFileSync('/work/project/dist/index.html',${JSON.stringify(html.toString())});${entry.setup}`, async id => {
    await assert.rejects(exportBuildOutput(id, "dist", AbortSignal.timeout(10000)), { code: entry.code });
  });
});

test("Docker export cancellation and private-value rejection cannot return partial bytes or stop the caller's container", async () => {
  const secret = "fixture-known-private-export-value";
  await runningOutput(`fs.writeFileSync('/work/project/dist/index.html',${JSON.stringify(html.toString())});fs.writeFileSync('/work/project/dist/app.js',${JSON.stringify(secret)});`, async id => {
    await assert.rejects(exportBuildOutput(id, "dist", AbortSignal.timeout(10000), [secret]),
      (error: unknown) => error instanceof Error && "code" in error && error.code === "BUILD_OUTPUT_SENSITIVE" && !error.message.includes(secret));
    const controller = new AbortController(), pending = exportBuildOutput(id, "dist", controller.signal);
    const timer = setTimeout(() => controller.abort(), 5);
    try { await assert.rejects(pending, { code: "CANCELLED" }); } finally { clearTimeout(timer); }
  });
});
