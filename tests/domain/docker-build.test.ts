import assert from "node:assert/strict";
import test from "node:test";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { extract } from "tar-stream";
import { dockerVerifierImage, parseDockerBuildPlan, type DockerBuildPlan } from "../../src/contracts/docker-build.ts";
import { dockerBuildSource, dockerWorkloadProgram, runDockerBuild } from "../../src/server/agent/docker-container.ts";
import { createDockerRuntime, localDockerEndpoint, localDockerRequest, operatorDockerEndpoint, type DockerEngineTransport } from "../../src/server/agent/docker-engine.ts";
import type { docker } from "../../src/server/agent/container.ts";
import { captureProject, type SourceFile } from "../../src/server/workspace/inspect.ts";
import { fingerprint } from "../../src/server/policy/action.ts";

const digest = "a".repeat(64), imageId = `sha256:${"d".repeat(64)}`, baseId = `sha256:${"b".repeat(64)}`;
const runtimeId = "e".repeat(64), verifierId = "f".repeat(64), jobId = "12345678-1234-4234-8234-123456789abc";
const dockerfile = `FROM ${dockerVerifierImage}\nWORKDIR /app\nCOPY server.mjs ./\nEXPOSE 8080\nCMD ["node","server.mjs"]\n`;
const source: SourceFile[] = [{ path: "Dockerfile", content: Buffer.from(dockerfile) }, { path: "server.mjs", content: Buffer.from("process.stdout.write('fixture');") }];
const sum = (data: Buffer) => createHash("sha256").update(data).digest("hex");
function planFor(files: readonly SourceFile[], baseImages = [dockerVerifierImage]): DockerBuildPlan {
  const manifest = files.map(file => ({ path: file.path, bytes: file.content.length, sha256: sum(file.content) })).sort((a, b) => a.path.localeCompare(b.path, "en"));
  const entry = files.find(file => file.path === "Dockerfile"); assert.ok(entry);
  return { version: 6, nodeVersion: null, image: null, sourceHash: fingerprint(manifest), baseImages, verifierImage: dockerVerifierImage,
    runtime: { kind: "docker", contextRoot: ".", dockerfile: "Dockerfile", dockerfileHash: sum(entry.content), port: 8080 },
    buildCommand: null, testCommand: null, startCommand: "liara-docker", port: 8080,
    workload: { path: "/health", status: 200, assertion: { kind: "text", contains: "exact-approved-version" } } };
}
const ok = (output = "") => ({ output, exitCode: 0, signal: null });
const imageMetadata = (id: string, labels: Record<string, unknown> = {}, digests: readonly string[] | null = null) => ({ id, os: "linux", architecture: "amd64", digests, labels, onBuild: null, volumes: null });
const flag = (args: readonly string[], name: string) => args[args.indexOf(name) + 1] ?? "";
function cliLabels(args: readonly string[]) {
  const result: Record<string, string> = {};
  args.forEach((arg, index) => { if (arg === "--label") { const value = args[index + 1] ?? "", at = value.indexOf("="); result[value.slice(0, at)] = value.slice(at + 1); } }); return result;
}
async function unpack(bytes: Buffer): Promise<Map<string, Buffer>> {
  const archive = extract(), files = new Map<string, Buffer>();
  const finished = new Promise<void>((resolve, reject) => { archive.once("finish", resolve); archive.once("error", reject); });
  archive.on("entry", (header, stream, next) => {
    assert.equal(header.type, "file"); assert.equal(header.mode, 0o644); const chunks: Buffer[] = [];
    stream.on("data", (data: unknown) => { assert.ok(Buffer.isBuffer(data)); chunks.push(data); }); stream.once("end", () => { files.set(header.name, Buffer.concat(chunks)); next(); }); stream.resume();
  }); archive.end(bytes); await finished; return files;
}
type Options = { lostBuild?: boolean; missingImage?: boolean; failedBuild?: boolean; unsafeBase?: boolean; wrongDigest?: boolean;
  probeMismatch?: boolean; malformedProbe?: boolean; lostRuntime?: boolean; replaceRuntime?: boolean; cleanupFails?: boolean; changeSource?: () => Promise<void> };
function transport(options: Options = {}) {
  const calls: string[][] = [], hosts: string[] = [], contexts: Buffer[] = [], runtimeBodies: Record<string, unknown>[] = [];
  const images = new Map<string, ReturnType<typeof imageMetadata>>([[dockerVerifierImage, imageMetadata(baseId, {}, [dockerVerifierImage.replace(/:[^/@]+@/, "@")])]]);
  const containers = new Map<string, { id: string; name: string; image: string; actualImage: string; labels: Record<string, unknown>; running: boolean; oom: boolean }>();
  let removals = 0;
  const command: typeof docker = async (args, _signal, _max, input) => {
    if (args[0] === "--host") { hosts.push(args[1] ?? ""); args = args.slice(2); }
    calls.push([...args]);
    if (args[0] === "context") return ok(JSON.stringify("unix:///fixture/docker.sock"));
    if (args[0] === "image" && args[1] === "inspect") {
      const reference = args.at(-1) ?? "", image = images.get(reference);
      if (!image) return { output: `Error response from daemon: No such image: ${reference}`, exitCode: 1, signal: null };
      return ok(JSON.stringify({ ...image, ...(options.unsafeBase && reference === dockerVerifierImage ? { onBuild: ["RUN unexpected"] } : {}),
        ...(options.wrongDigest && reference === dockerVerifierImage ? { digests: [`node@sha256:${"c".repeat(64)}`] } : {}) }));
    }
    if (args[0] === "build") {
      assert.ok(input); contexts.push(Buffer.from(input));
      if (!options.missingImage && !options.failedBuild) images.set(flag(args, "--tag"), imageMetadata(imageId, cliLabels(args)));
      await options.changeSource?.();
      if (options.lostBuild) return { output: "", exitCode: null, signal: "SIGTERM" };
      return options.failedBuild ? { output: "build failed", exitCode: 1, signal: null } : ok(imageId);
    }
    if (args[0] === "create") {
      assert.equal(args.includes(dockerVerifierImage), true); assert.equal(args.includes(imageId), false);
      containers.set(verifierId, { id: verifierId, name: `/${flag(args, "--name")}`, image: dockerVerifierImage, actualImage: baseId, labels: cliLabels(args), running: false, oom: false });
      return ok(`${verifierId}\n`);
    }
    if (args[0] === "inspect") {
      const reference = args.at(-1), row = [...containers.values()].find(item => item.id === reference || item.name === `/${reference}`);
      if (!row) return { output: `Error: No such container: ${reference}`, exitCode: 1, signal: null };
      if (!(flag(args, "--format").includes("actualImage"))) return ok(JSON.stringify({ id: row.id, name: row.name, image: row.image, labels: row.labels }));
      if (options.replaceRuntime && row.id === runtimeId && row.running) return ok(JSON.stringify({ ...row, labels: {} }));
      return ok(JSON.stringify(row));
    }
    if (args[0] === "start") {
      const row = containers.get(args.at(-1) ?? ""); assert.ok(row);
      if (row.id === verifierId) return ok(options.malformedProbe ? "application says success" : JSON.stringify({ version: 1, matched: !options.probeMismatch, status: 200 }));
      row.running = true; return ok(row.id);
    }
    if (args[0] === "rm") {
      removals++; if (options.cleanupFails) return { output: "daemon unavailable", exitCode: 1, signal: null };
      assert.ok(containers.delete(args.at(-1) ?? "")); return ok();
    }
    if (args[0] === "image" && args[1] === "rm") { assert.ok(images.delete(args.at(-1) ?? "")); return ok(); }
    assert.fail(`Unexpected command: ${args[0]}`);
  };
  const send: DockerEngineTransport = async (_endpoint, request) => {
    if (request.method === "GET") return { status: 200, body: Buffer.from(JSON.stringify({ ApiVersion: "1.52", MinAPIVersion: "1.44", Os: "linux" })) };
    assert.ok(request.body); const body = JSON.parse(request.body.toString("utf8")); runtimeBodies.push(body);
    const name = new URL(request.path, "http://localhost").searchParams.get("name");
    containers.set(runtimeId, { id: runtimeId, name: `/${name}`, image: body.Image, actualImage: imageId, labels: body.Labels, running: false, oom: false });
    if (options.lostRuntime) throw new Error("synthetic reply lost");
    return { status: 201, body: Buffer.from(JSON.stringify({ Id: runtimeId, Warnings: null })) };
  };
  return { command, send, calls, hosts, contexts, runtimeBodies, containers, get removals() { return removals; } };
}
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "launchlane-docker-build-"));
  for (const file of source) await writeFile(join(root, file.path), file.content);
  const captured = await captureProject(root, ".");
  return { root, files: captured.files, plan: planFor(captured.files), close: () => rm(root, { recursive: true, force: true }) };
}
function engine(mock: ReturnType<typeof transport>) { return { endpoint: localDockerEndpoint("unix:///fixture/docker.sock"), send: mock.send }; }

test("Docker build v6 binds source, pinned dependencies, verifier, port and workload without pretending an image exists", () => {
  const plan = planFor(source); assert.deepEqual(parseDockerBuildPlan(plan), plan);
  for (const changed of [{ ...plan, image: imageId }, { ...plan, nodeVersion: "22" }, { ...plan, port: 80 }, { ...plan, buildCommand: "npm run build" },
    { ...plan, testCommand: "true" }, { ...plan, startCommand: "sh" }, { ...plan, verifierImage: "node:latest" }, { ...plan, baseImages: ["node:latest"] },
    { ...plan, baseImages: [dockerVerifierImage, dockerVerifierImage] }, { ...plan, environment: [{ key: "VALUE", value: "not-a-reference" }] }, { ...plan, buildArgs: {} }]) assert.throws(() => parseDockerBuildPlan(changed));
  for (const changed of [{ ...plan, sourceHash: "b".repeat(64) }, { ...plan, runtime: { ...plan.runtime, dockerfileHash: digest } }]) assert.throws(() => dockerBuildSource(source, changed), { code: "DOCKER_SOURCE_CHANGED" });
});

test("Docker source review accepts only declared local stages and rejects hidden build authority before Docker is called", () => {
  assert.deepEqual(dockerBuildSource(source, planFor(source)), [dockerVerifierImage]);
  const multi = source.map(file => file.path === "Dockerfile" ? { ...file, content: Buffer.from(`FROM ${dockerVerifierImage} AS builder\nCOPY server.mjs /app/server.mjs\nFROM scratch\nCOPY --from=builder /app /app\nEXPOSE 8080\n`) } : file);
  assert.deepEqual(dockerBuildSource(multi, planFor(multi)), [dockerVerifierImage]);
  const denied = ["VOLUME /data", "ONBUILD RUN echo unexpected", "RUN --mount=type=secret,id=key cat /run/secrets/key", "RUN \\\n --network=host echo denied", "ARG IMAGE=unbound",
    "ADD https://example.com/private /app/", "COPY ../private /app/", "COPY [\"$OUTSIDE\",\"/app\"]", "COPY --from=external:latest /app /app", "RUN <<EOF\ncommands\nEOF"];
  for (const text of [`# syntax=docker/dockerfile:1\n${dockerfile}`, `# escape=\`\n${dockerfile}`, ...denied.map(line => `${dockerfile}\n${line}`), dockerfile.replace(dockerVerifierImage, "node:latest")]) {
    const files = source.map(file => file.path === "Dockerfile" ? { ...file, content: Buffer.from(text) } : file);
    assert.throws(() => dockerBuildSource(files, planFor(files)));
  }
  assert.throws(() => dockerBuildSource(source, { ...planFor(source), baseImages: [] }), { code: "DOCKER_BASE_CHANGED" });
});

test("the worker builds the exact captured tar and checks content through a separate isolated verifier with owned cleanup", async () => {
  const f = await fixture(), mock = transport(), ids: string[] = [];
  try {
    const result = await runDockerBuild(f.root, f.plan, AbortSignal.timeout(10000), id => ids.push(id), [], mock.command, engine(mock));
    assert.equal(result.exitCode, 0); assert.equal(result.workloadVerified, true); assert.equal(result.image, imageId); assert.equal(result.containerId, runtimeId);
    assert.equal(result.sourceHash, f.plan.sourceHash); assert.equal(result.dockerfileHash, f.plan.runtime.dockerfileHash); assert.deepEqual(ids, [runtimeId, verifierId]);
    assert.equal(mock.contexts.length, 1); const context = await unpack(mock.contexts[0] ?? Buffer.alloc(0));
    assert.deepEqual([...context.keys()].sort(), f.files.map(file => file.path).sort());
    for (const file of f.files) assert.equal(sum(context.get(file.path) ?? Buffer.alloc(0)), sum(file.content));
    const build = mock.calls.find(args => args[0] === "build"); assert.ok(build);
    for (const arg of ["--network=none", "--pull=false", "--no-cache", "--force-rm=true"]) assert.ok(build.includes(arg));
    assert.equal(mock.hosts.length, mock.calls.length); assert.deepEqual([...new Set(mock.hosts)], ["unix:///fixture/docker.sock"]);
    for (const key of ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY", "FTP_PROXY", "http_proxy", "https_proxy", "all_proxy", "no_proxy", "ftp_proxy"]) assert.ok(build.includes(`${key}=`));
    assert.equal(build.at(-1), "-"); assert.equal(flag(build, "--file"), "Dockerfile");
    assert.equal(mock.calls.some(args => args.includes("--mount") || args.includes("--publish") || args[0] === "pull" || args[0] === "prune"), false);
    assert.equal(mock.calls.filter(args => args[0] === "create").length, 1);
    const verifier = mock.calls.find(args => args[0] === "create"); assert.ok(verifier);
    assert.equal(flag(verifier, "--network"), `container:${runtimeId}`); assert.equal(flag(verifier, "--user"), "1000:1000");
    assert.equal(mock.containers.size, 0); assert.equal(mock.removals, 2);
  } finally { await f.close(); }
});

test("HTTP200 without the approved content, malformed receipts, missing cache and inherited ONBUILD cannot become success", async () => {
  for (const options of [{ probeMismatch: true }, { malformedProbe: true }, { unsafeBase: true }, { wrongDigest: true }]) {
    const f = await fixture(), mock = transport(options);
    try {
      const run = runDockerBuild(f.root, f.plan, AbortSignal.timeout(10000), undefined, [], mock.command, engine(mock));
      if (options.probeMismatch) { const result = await run; assert.equal(result.workloadVerified, false); assert.equal(result.exitCode, 73); }
      else await assert.rejects(run, { code: options.malformedProbe ? "DOCKER_PROBE_INVALID" : options.unsafeBase ? "SANDBOX_IMAGE_DENIED" : "DOCKER_BASE_NOT_CACHED" });
      if (options.unsafeBase || options.wrongDigest) assert.equal(mock.calls.some(args => args[0] === "build"), false);
    } finally { await f.close(); }
  }
});

test("lost build replies stay uncertain without replay even after a matching owned image can be removed", async () => {
  for (const missingImage of [true, false]) {
    const f = await fixture(), mock = transport({ lostBuild: true, missingImage });
    try {
      await assert.rejects(runDockerBuild(f.root, f.plan, AbortSignal.timeout(10000), undefined, [], mock.command, engine(mock)), { code: "SANDBOX_BUILD_UNCERTAIN", retryable: false });
      assert.equal(mock.calls.filter(args => args[0] === "build").length, 1); assert.equal(mock.runtimeBodies.length, 0);
    } finally { await f.close(); }
  }
});

test("known build failure, changed source and lost runtime responses stop before any replay", async () => {
  for (const mode of ["build", "source", "runtime"] as const) {
    const f = await fixture(), mock = transport({ failedBuild: mode === "build", lostRuntime: mode === "runtime", ...(mode === "source" ? { changeSource: () => writeFile(join(f.root, "server.mjs"), "process.stdout.write('changed');") } : {}) });
    try {
      await assert.rejects(runDockerBuild(f.root, f.plan, AbortSignal.timeout(10000), undefined, [], mock.command, engine(mock)), { code: mode === "build" ? "DOCKER_BUILD_FAILED" : mode === "source" ? "DOCKER_SOURCE_CHANGED" : "SANDBOX_RUNTIME_UNCERTAIN" });
      assert.equal(mock.calls.filter(args => args[0] === "build").length, 1); assert.equal(mock.runtimeBodies.length, mode === "runtime" ? 1 : 0);
      assert.equal(mock.containers.size, 0);
    } finally { await f.close(); }
  }
});

test("replacement ownership and cleanup errors never remove somebody else's worker or report a passed build", async () => {
  for (const options of [{ replaceRuntime: true }, { cleanupFails: true }]) {
    const f = await fixture(), mock = transport(options);
    try {
      await assert.rejects(runDockerBuild(f.root, f.plan, AbortSignal.timeout(10000), undefined, [], mock.command, engine(mock)), { code: "SANDBOX_CLEANUP_UNCONFIRMED" });
      if (options.replaceRuntime) assert.equal(mock.removals, 0);
    } finally { await f.close(); }
  }
});

test("runtime environment uses only an approved reference and local Engine JSON; no secret reaches argv, tar or receipt", async () => {
  const f = await fixture(), mock = transport(), privateValue = "synthetic-only-runtime-value\nwith=two-lines";
  try {
    const plan = { ...f.plan, environment: { actionId: jobId, fingerprint: digest, keys: ["APPLICATION_VALUE"] } };
    const result = await runDockerBuild(f.root, plan, AbortSignal.timeout(10000), undefined, [{ key: "APPLICATION_VALUE", value: privateValue }], mock.command, engine(mock));
    assert.equal(result.workloadVerified, true); assert.deepEqual(mock.runtimeBodies[0]?.Env, [`APPLICATION_VALUE=${privateValue}`]);
    assert.equal(JSON.stringify(mock.calls).includes(privateValue), false); assert.equal(JSON.stringify(result).includes(privateValue), false);
    assert.equal(mock.contexts.some(bytes => bytes.includes(Buffer.from(privateValue))), false);
    const denied = transport();
    await assert.rejects(runDockerBuild(f.root, f.plan, AbortSignal.timeout(10000), undefined, [{ key: "APPLICATION_VALUE", value: privateValue }], denied.command, engine(denied)), { code: "ENV_REFERENCE_CHANGED" });
    assert.equal(denied.calls.length, 0); assert.equal(denied.runtimeBodies.length, 0);
  } finally { await f.close(); }
});

test("only operator-selected Unix sockets and named pipes can carry Engine requests; project env cannot select a host", async () => {
  assert.deepEqual(localDockerEndpoint("unix:///var/run/docker.sock"), { socketPath: "/var/run/docker.sock" });
  assert.deepEqual(localDockerEndpoint("npipe:////./pipe/dockerDesktopLinuxEngine"), { socketPath: "\\\\.\\pipe\\dockerDesktopLinuxEngine" });
  for (const host of ["tcp://127.0.0.1:2375", "ssh://operator@host", "https://user:private@example.com", "unix:///tmp/../docker.sock", "npipe:////other/pipe/docker", "unix:///tmp/%2e%2e/docker.sock"])
    assert.throws(() => localDockerEndpoint(host), { code: "SANDBOX_ENGINE_UNSUPPORTED" });
  let reads = 0;
  const endpoint = await operatorDockerEndpoint(AbortSignal.timeout(1000), async args => { reads++; assert.equal(args.at(-1), "local-fixture"); return ok(JSON.stringify("npipe:////./pipe/local-fixture")); }, { DOCKER_CONTEXT: "local-fixture", DOCKER_HOST: "tcp://ignored.invalid" });
  assert.equal(endpoint.socketPath, "\\\\.\\pipe\\local-fixture"); assert.equal(reads, 1);
  await assert.rejects(operatorDockerEndpoint(AbortSignal.timeout(1000), async () => assert.fail("A selected explicit host needs no context command"), { DOCKER_HOST: "tcp://remote.invalid" }), { code: "SANDBOX_ENGINE_UNSUPPORTED" });
});

test("Engine create validates API range and keeps lost/error responses sanitized, bounded and single-send", async () => {
  const input = { name: `launchlane-docker-runtime-v1-${jobId}`, jobId, sourceHash: digest, dockerfileHash: digest, image: imageId, environment: [{ key: "APPLICATION_VALUE", value: "synthetic-private-value" }] };
  for (const mode of ["success", "old-api", "new-minimum", "windows", "lost", "malformed", "error"] as const) {
    let writes = 0; const bodyBuffers: Buffer[] = [];
    const send: DockerEngineTransport = async (_endpoint, request) => {
      if (request.method === "GET") return { status: 200, body: Buffer.from(JSON.stringify({ ApiVersion: mode === "old-api" ? "1.44" : "1.52", MinAPIVersion: mode === "new-minimum" ? "1.46" : "1.44", Os: mode === "windows" ? "windows" : "linux" })) };
      writes++; assert.ok(request.body); bodyBuffers.push(request.body);
      const body = JSON.parse(request.body.toString()); assert.equal(body.User, "1000:1000"); assert.equal(body.HostConfig.NetworkMode, "none"); assert.equal(body.HostConfig.ReadonlyRootfs, true); assert.deepEqual(body.HostConfig.Binds, []); assert.deepEqual(body.HostConfig.PortBindings, {});
      if (mode === "lost") throw new Error("synthetic-private-value");
      return { status: mode === "error" ? 500 : 201, body: Buffer.from(mode === "malformed" ? "synthetic-private-value" : JSON.stringify({ Id: runtimeId, Warnings: ["synthetic-private-value"] })) };
    };
    const pending = createDockerRuntime(input, AbortSignal.timeout(1000), { endpoint: localDockerEndpoint("unix:///fixture/docker.sock"), send });
    if (mode === "success") assert.deepEqual(await pending, { id: runtimeId, warningCount: 1 });
    else await assert.rejects(pending, (error: unknown) => { assert.ok(error instanceof Error); assert.equal(error.message.includes("synthetic-private-value"), false); return true; });
    assert.equal(writes, ["old-api", "new-minimum", "windows"].includes(mode) ? 0 : 1);
    for (const bodyBuffer of bodyBuffers) assert.equal(bodyBuffer.every(byte => byte === 0), true);
  }
});

test("the actual local-socket HTTP transport sends the Engine body without a CLI argument or host TCP listener", async () => {
  const name = `launchlane-unit-${randomUUID()}`, endpoint = { socketPath: process.platform === "win32" ? `\\\\.\\pipe\\${name}` : join(tmpdir(), `${name}.sock`) };
  const server = createServer((request, response) => { const chunks: Buffer[] = []; request.on("data", (chunk: Buffer) => chunks.push(chunk)); request.on("end", () => {
    assert.equal(request.headers.host, "localhost"); response.setHeader("content-type", "application/json");
    if (request.method === "GET") { assert.equal(request.url, "/version"); assert.equal(Buffer.concat(chunks).length, 0); response.end(JSON.stringify({ ApiVersion: "1.52", MinAPIVersion: "1.44", Os: "linux" })); }
    else {
      assert.equal(request.url, `/v1.45/containers/create?name=launchlane-docker-runtime-v1-${jobId}`);
      const body = JSON.parse(Buffer.concat(chunks).toString()); assert.deepEqual(body.Env, ["APPLICATION_VALUE=synthetic-runtime-line1\nline2=unchanged"]);
      assert.equal(body.HostConfig.ReadonlyRootfs, true); assert.equal(body.HostConfig.NetworkMode, "none");
      response.writeHead(201); response.end(JSON.stringify({ Id: runtimeId, Warnings: null }));
    }
  }); });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(endpoint.socketPath, resolve); });
  try {
    const result = await createDockerRuntime({ name: `launchlane-docker-runtime-v1-${jobId}`, jobId, sourceHash: digest, dockerfileHash: digest, image: imageId,
      environment: [{ key: "APPLICATION_VALUE", value: "synthetic-runtime-line1\nline2=unchanged" }] }, AbortSignal.timeout(2000), { endpoint });
    assert.deepEqual(result, { id: runtimeId, warningCount: 0 });
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});

test("local Engine transport bounds oversized responses and cancellation without exposing raw body or retrying", async () => {
  for (const mode of ["limit", "abort"] as const) {
    const name = `launchlane-unit-${randomUUID()}`, endpoint = { socketPath: process.platform === "win32" ? `\\\\.\\pipe\\${name}` : join(tmpdir(), `${name}.sock`) };
    let reads = 0;
    const server = createServer((_request, response) => { reads++; if (mode === "limit") response.end("synthetic-untrusted-private-value".repeat(2000)); });
    await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(endpoint.socketPath, resolve); });
    try {
      await assert.rejects(localDockerRequest(endpoint, { method: "GET", path: "/version", body: null }, AbortSignal.timeout(200)), (error: unknown) => {
        assert.ok(error instanceof Error); assert.equal(error.message.includes("synthetic-untrusted-private-value"), false); return true;
      }); assert.equal(reads, 1);
    } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
  }
});

test("the actual trusted verifier distinguishes correct content from an unrelated HTTP200", async () => {
  let body = "exact-approved-version";
  const server = createServer((_request, response) => { response.setHeader("content-type", "text/plain"); response.end(body); });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve)); const address = server.address(); assert.ok(address && typeof address === "object");
  const run = () => new Promise<{ code: number | null; output: string }>((resolve, reject) => {
    const child = spawn(process.execPath, ["-e", dockerWorkloadProgram, "--", JSON.stringify({ port: address.port, workload: planFor(source).workload })], { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
    let output = ""; child.stdout.on("data", (data: Buffer) => { output += data.toString(); }); child.once("error", reject); child.once("exit", code => resolve({ code, output }));
  });
  try {
    const good = await run(); assert.equal(good.code, 0); assert.equal(JSON.parse(good.output).matched, true);
    body = "unrelated-page-from-another-version";
    const unrelated = await run(); assert.equal(unrelated.code, 73); assert.deepEqual(JSON.parse(unrelated.output), { version: 1, matched: false, status: 200 });
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
