import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import type { ProjectProfile } from "../../src/contracts/domain.ts";
import { assertDockerRuntimeSource, parseDockerRuntime } from "../../src/contracts/docker-runtime.ts";
import { decodeAction, decodeProfile } from "../../src/contracts/client-decode.ts";
import { parseNativePlatformInspection } from "../../src/contracts/liara-platform.ts";
import { inspectNativePlatform } from "../../src/server/workspace/native-platform.ts";
import { actionPlatform } from "../../src/contracts/platform.ts";
import { canonical, fingerprint, parseActionSpec } from "../../src/server/policy/action.ts";

const uuid = "12345678-1234-4234-8234-123456789abc", digest = "a".repeat(64), scope = { teamId: "a".repeat(24), app: "sample-docker" };
const runtime = { kind: "docker" as const, contextRoot: "." as const, dockerfile: "deploy/Dockerfile", dockerfileHash: digest, port: 8080 };
const workload = { origin: "https://sample-docker.example.com", path: "/", status: 200, assertion: { kind: "text" as const, contains: "ready-exact-version" } };
const common = { scope, operation: "deploy", sourceHash: digest, args: { port: 8080, planId: "starter" } };
const binding = { artifactHash: "b".repeat(64), projectFlowId: uuid, selectionHash: "c".repeat(64) };
const deploy = { ...common, ...binding, version: 21, nodeVersion: null, accountId: "d".repeat(24), targetAppId: "e".repeat(24), runtime, environment: null, workload };
const provisionBase = { version: 8, operation: "create_app", scope, sourceHash: digest, ...binding,
  accountId: "d".repeat(24), previousAppId: null, nodeVersion: "22", networkId: "f".repeat(24), bundleId: "basic", readOnlyRootFilesystem: true,
  args: { port: null, planId: "starter" }, cost: { catalogFingerprint: digest, observedAt: 1000, expiresAt: 601000,
    hourlyHundredthsToman: 500, region: "iran", currency: "toman", period: "hour", extras: "tax_traffic_storage_not_included" } };
const provision = { ...provisionBase, version: 22, nodeVersion: null, runtime };
function action(spec: unknown) { return { id: uuid, actorId: "actor", spec, hash: digest, state: "awaiting_approval", createdAt: 1, expiresAt: 1000, attemptId: null, remoteId: null, errorCode: null }; }
function profile(): ProjectProfile {
  return { directory: ".", runtime: "docker", nodeVersion: null, dockerRuntime: runtime, port: 8080, start: "liara-docker", build: null,
    envNames: [], missing: [], manifest: [{ path: runtime.dockerfile, bytes: 100, sha256: digest }], sourceHash: digest, totalBytes: 100, excludedCount: 0, inspectedAt: new Date(0).toISOString() };
}
test("Docker runtime binds only an exact file under the selected immutable root and a real port", () => {
  assert.deepEqual(parseDockerRuntime(runtime), runtime);
  for (const dockerfile of ["/etc/Dockerfile", "../Dockerfile", "./Dockerfile", "a/../Dockerfile", "C:/Dockerfile", "a\\Dockerfile", "a//Dockerfile", "a\nDockerfile"])
    assert.throws(() => parseDockerRuntime({ ...runtime, dockerfile }));
  for (const value of [{ ...runtime, contextRoot: "../other" }, { ...runtime, port: 0 }, { ...runtime, port: 65536 }, { ...runtime, port: "8080" }, { ...runtime, dockerfileHash: "missing" }, { ...runtime, buildArgs: { SECRET: "forbidden" } }]) assert.throws(() => parseDockerRuntime(value));
});
test("the Dockerfile digest and selected port are checked against the persisted profile manifest", () => {
  assert.doesNotThrow(() => assertDockerRuntimeSource(profile(), runtime));
  for (const changed of [{ ...runtime, port: 8081 }, { ...runtime, dockerfileHash: "d".repeat(64) }, { ...runtime, dockerfile: "other/Dockerfile" }])
    assert.throws(() => assertDockerRuntimeSource(profile(), changed), { code: "DOCKER_RUNTIME_CHANGED" });
  assert.throws(() => assertDockerRuntimeSource({ ...profile(), manifest: [] }, runtime), { code: "DOCKER_RUNTIME_CHANGED" });
});
test("v21 and v22 preserve Docker identity through server and client parsers", () => {
  for (const input of [deploy, provision]) {
    const parsed = parseActionSpec(input);
    assert.equal(actionPlatform(parsed), "docker");
    assert.deepEqual(parsed, input); assert.deepEqual(decodeAction(action(input)).spec, input);
    assert.equal(fingerprint(parsed), fingerprint(input));
  }
  for (const input of [{ ...deploy, nodeVersion: "22" }, { ...deploy, args: { ...deploy.args, port: 3000 } }, { ...provision, nodeVersion: "22" }, { ...provision, contextRoot: "." }]) assert.throws(() => parseActionSpec(input));
});
test("every material Docker publication input changes the approval fingerprint", () => {
  const cases = [{ ...deploy, runtime: { ...runtime, dockerfileHash: "e".repeat(64) } }, { ...deploy, runtime: { ...runtime, dockerfile: "other/Dockerfile" } },
    { ...deploy, artifactHash: "f".repeat(64) }, { ...deploy, sourceHash: "e".repeat(64) }, { ...deploy, accountId: "b".repeat(24) },
    { ...deploy, targetAppId: "b".repeat(24) }, { ...deploy, runtime: { ...runtime, port: 9090 }, args: { ...deploy.args, port: 9090 } },
    { ...deploy, environment: { actionId: uuid, fingerprint: "f".repeat(64), keys: ["DATABASE_URL"] } }, { ...deploy, workload: { ...workload, path: "/status" } }];
  for (const input of cases) assert.notEqual(fingerprint(parseActionSpec(input)), fingerprint(deploy));
});
test("Docker profiles roundtrip without acquiring a Node or Python runtime", () => {
  assert.deepEqual(decodeProfile({ profile: profile() }), profile());
  assert.throws(() => decodeProfile({ profile: { ...profile(), nodeVersion: "22" } }));
  assert.throws(() => decodeProfile({ profile: { ...profile(), runtime: "node" } }));
  const inspected = inspectNativePlatform([{ path: "Dockerfile", content: Buffer.from("FROM nginx:alpine\nEXPOSE 8080") }]);
  assert.deepEqual(parseNativePlatformInspection(inspected), inspected);
  assert.deepEqual(decodeProfile({ profile: { ...profile(), nativeInspection: inspected } }).nativeInspection, inspected);
  assert.throws(() => parseNativePlatformInspection({ ...inspected, publishable: true }));
});
test("all twenty historical canonical forms keep their exact existing input bytes", () => {
  const oldWorkload = { origin: workload.origin, path: "/", status: 200, revision: "old-version" };
  const oldDeploy = { ...common, ...binding, targetAppId: "e".repeat(24) };
  const v7 = { ...oldDeploy, version: 7, accountId: "d".repeat(24), nodeVersion: "22", workload };
  const env = { actionId: uuid, fingerprint: digest, keys: ["DATABASE_URL"] };
  const python = { kind: "python", version: "3.12", command: ["python3", "main.py"] };
  const next = { kind: "next", version: "22", mirror: false };
  const frontend = { kind: "react", builder: "vite", nodeVersion: "20", outputDirectory: "build", mirror: false };
  const stat = { kind: "static", documentRoot: ".", entry: "index.html", port: 80 };
  const inputs: unknown[] = [
    { ...common, version: 1 }, { ...common, version: 2, artifactHash: binding.artifactHash }, { ...common, ...binding, version: 3 },
    { ...oldDeploy, version: 4, workload: oldWorkload }, { ...oldDeploy, version: 5, nodeVersion: "22", workload: oldWorkload },
    { version: 6, operation: "restart", scope, sourceHash: null, args: { port: null, planId: null }, accountId: "d".repeat(24), targetAppId: "e".repeat(24), targetPlanId: "starter", targetReleaseId: "release-old", incidentRunId: uuid, evidenceHash: digest, target: { origin: workload.origin, path: "/" } },
    v7, provisionBase,
    { ...common, ...binding, version: 9, operation: "update_env", accountId: "d".repeat(24), targetAppId: "e".repeat(24), agentRunId: uuid, secretRef: uuid, baseFingerprint: digest, effectiveFingerprint: digest, keys: ["DATABASE_URL"], secretKeys: ["DATABASE_URL"], args: { port: null, planId: "starter" } },
    { ...v7, version: 10, environment: env }, { ...v7, version: 11, nodeVersion: null, runtime: python, environment: null },
    { ...provisionBase, version: 12, nodeVersion: null, runtime: python },
    { ...common, ...binding, version: 13, operation: "create_network", accountId: "d".repeat(24), previousAppId: null, agentRunId: uuid, networkName: "ll-12345678-1234567890abcdef", args: { port: null, planId: null }, cost: { state: "unknown", amount: null, currency: null, period: null } },
    { version: 14, operation: "stop_app", scope, accountId: "d".repeat(24), targetAppId: "e".repeat(24), projectFlowId: uuid, sourceHash: digest, selectionHash: digest, args: { port: null, planId: "starter" }, requestKey: uuid },
    { ...v7, version: 15, nodeVersion: null, args: { port: 80, planId: "starter" }, runtime: stat }, { ...provisionBase, version: 16, nodeVersion: null, runtime: stat },
    { ...v7, version: 17, runtime: next, environment: null }, { ...provisionBase, version: 18, runtime: next },
    { ...v7, version: 19, nodeVersion: "20", args: { port: 80, planId: "starter" }, runtime: frontend, environment: null }, { ...provisionBase, version: 20, nodeVersion: "20", runtime: frontend },
  ];
  assert.equal(inputs.length, 20);
  for (const input of inputs) {
    const parsed = parseActionSpec(input);
    assert.equal(canonical(parsed), canonical(input), `Historical v${parsed.version} changed`);
    assert.equal(fingerprint(parsed), createHash("sha256").update(canonical(input)).digest("hex"));
  }
});
