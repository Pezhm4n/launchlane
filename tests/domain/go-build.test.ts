import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { goFixture } from "../helpers/go-fixture.ts";
import { parseProjectBuildPlan } from "../../src/contracts/project-build.ts";
import { assertExecutableJob } from "../../src/server/policy/executable-artifact.ts";
import { proposeWorkloadDeployment, executeDeployment, observeDeployment } from "../../src/server/application/deployment.ts";
import { proposeDestination, executeDestination, observeDestination } from "../../src/server/application/provision.ts";
import { sealCredential } from "../../src/server/connections/credentials.ts";
import { LiaraReadClient } from "../../src/server/liara/client.ts";
import { LiaraDeployClient } from "../../src/server/liara/deploy.ts";
import { LiaraAccountClient } from "../../src/server/liara/catalog.ts";
import { LiaraProvisionClient } from "../../src/server/liara/provision.ts";
import { WorkloadProbe } from "../../src/server/liara/probe.ts";
import { compiledProof } from "../../src/server/agent/fullstack-artifact.ts";
import { toolsForAgent } from "../../src/server/agent/tools.ts";
import { decodeAction, decodeProfile } from "../../src/contracts/client-decode.ts";
import { parseActionSpec } from "../../src/server/policy/action.ts";
import { inspectGoEnvironment } from "../../src/server/workspace/go-environment.ts";
import { goModuleRequests, goRegistryRead, prepareGoDependencies } from "../../src/server/agent/go-source.ts";
import { goToolchain } from "../../src/contracts/go-runtime.ts";
import { assertGoEnvironment } from "../../src/server/agent/go-container.ts";
import { gunzipSync } from "node:zlib";
import { readArtifact } from "../../src/server/workspace/archive.ts";
import { captureProject } from "../../src/server/workspace/inspect.ts";
import { inspectApplicationRequirements } from "../../src/server/workspace/application-requirements.ts";
import { assertApplicationPublicationScope } from "../../src/server/policy/application-scope.ts";

const signal = () => AbortSignal.timeout(5000), account = "a".repeat(24), team = "b".repeat(24), appId = "c".repeat(24), app = "compiled-go", origin = "https://compiled-go.example.com";
const nativeFetch = globalThis.fetch;
before(() => { globalThis.fetch = async () => { throw Error("External request denied in Go domain regression"); }; });
after(() => { globalThis.fetch = nativeFetch; });
function connect(f: Awaited<ReturnType<typeof goFixture>>, selected = true) {
  const config = { ...f.config, apps: [app], teamId: team, enableMutations: true, enableLiveLiara: true, liaraToken: "synthetic-go-provider", probeOrigins: { [app]: origin } };
  f.store.saveConnection(f.session.actorId, { source: "token", ciphertext: sealCredential(config.liaraToken, config.sessionSecret, f.session.actorId, "liara"), view: { provider: "liara", status: "connected", identityId: account,
    displayName: "Fixture", login: "fixture@example.test", teamId: team, teamName: "Fixture", checkedAt: Date.now(), apps: selected ? [{ id: appId, name: app, platform: "docker" }] : [], selectedApp: selected ? app : null } }); return config;
}
test("Go source, env and module identities stay literal, bounded and non-shell", async () => {
  assert.deepEqual(inspectGoEnvironment('import runtimeos "os"\n// runtimeos.Getenv("COMMENT")\nfunc main(){runtimeos.Getenv("APP_LABEL");runtimeos.LookupEnv(`DATABASE_URL`)}').names, ["APP_LABEL", "DATABASE_URL"]);
  assert.equal(inspectGoEnvironment('import "os"\nfunc main(){os.Getenv("PREFIX_"+key)}').unresolved, true);
  assert.equal(inspectGoEnvironment('import "os"\nfunc f(os Replacement){os.Getenv("FAKE")}').unresolved, true);
  assert.deepEqual(inspectGoEnvironment('package main\nfunc main(){custom.Getenv("FAKE")}').names, []);
  assert.throws(() => assertGoEnvironment([{ key: "GOFLAGS", value: "-toolexec=/tmp/unreviewed" }]), { code: "GO_ENVIRONMENT_UNSUPPORTED" });
  assert.doesNotThrow(() => assertGoEnvironment([{ key: "GOOGLE_PROJECT", value: "fixture" }]));
  const files = [{ path: "go.sum", content: await readFile("tests/fixtures/go-service/go.sum") }]; assert.equal(goModuleRequests(files).length, 1);
  assert.throws(() => goModuleRequests([{ path: "go.sum", content: Buffer.from("../../outside v1.0.0 h1:" + "a".repeat(43) + "=\n") }]));
  const f = await goFixture(); try {
    assert.deepEqual(decodeProfile({ profile: f.original.profile }).goRuntime, f.original.profile.goRuntime);
    const alternate = parseProjectBuildPlan({ ...f.build, runtime: { ...f.build.runtime, port: 8080 }, port: 8081 }); assert.equal(alternate.port, 8081);
    assert.throws(() => parseProjectBuildPlan({ ...f.build, testCommand: "true" }), { code: "GO_BUILD_CHANGED" });
    assert.throws(() => parseProjectBuildPlan({ ...f.build, runtime: { ...f.build.runtime, packagePath: ".; echo injected" } }));
    const names = toolsForAgent({ ...f.config, enableLocalRepair: true }, "compiled", false, true).map(tool => tool.function.name); assert.equal(names.includes("propose_project_build"), true); assert.equal(names.includes("propose_publication"), false);
    assert.throws(() => assertExecutableJob(f.store, "foreign", f.selected), { code: "EXECUTABLE_BUILD_REQUIRED" });
    await writeFile(join(f.workspace, "go", "go.work"), "go 1.25.0\nuse .\n");
    await assert.rejects(captureProject(f.workspace, "go"), { code: "GO_WORKSPACE_REQUIRED" });
  } finally { f.close(); }
});

test("Go requirements retain API, PostgreSQL, Redis and scheduler obligations through the shared source contract", async () => {
  const source = Buffer.from('package main\nimport ("net/http"; pg "github.com/jackc/pgx/v5/pgxpool"; "github.com/redis/go-redis/v9"; "github.com/robfig/cron/v3"; "os")\nfunc main(){pg.New(ctx,os.Getenv("DATABASE_URL"));redis.NewClient(options);cron.New();http.ListenAndServe(":8000",nil)}');
  const result = inspectApplicationRequirements([{ path: "go.mod", content: Buffer.from("module example.test/service\ngo 1.25.0\n") }, { path: "main.go", content: source }]);
  assert.deepEqual(result.diagnostics, []); for (const kind of ["backend_api", "postgresql", "redis", "scheduler"]) assert.ok(result.requirements.some(row => row.kind === kind));
  assert.ok(result.requirements.find(row => row.kind === "postgresql")?.environmentKeys.includes("DATABASE_URL"));
  const f = await goFixture(); try { assert.throws(() => assertApplicationPublicationScope({ ...f.original.profile, applicationRequirements: { ...result, sourceHash: f.original.profile.sourceHash } }), { code: "GO_COMPONENT_SCOPE_REQUIRED" }); } finally { f.close(); }
});

for (const wrongProof of [false, true]) test(`compiled Go publication: original workload, archive, approval and version proof (${wrongProof ? "mismatch" : "verified"})`, async () => {
  const f = await goFixture(); try {
    const config = connect(f), read = new LiaraReadClient(config, async url => Response.json(new URL(url).pathname.endsWith("/releases") ? { total: 1, currentRelease: "go-release", releases: [{ _id: "go-release", state: "READY", port: 8080 }] } : { project: { _id: appId, project_id: app, type: "docker", status: "Running", planID: "starter", envs: [] } }));
    const action = await proposeWorkloadDeployment(config, f.store, f.session.actorId, { flowId: f.selected.id, app, port: null, workload: { origin, ...f.build.workload } }, signal(), { read });
    assert.equal(action.spec.version, 43); assert.deepEqual(decodeAction(action).spec, action.spec); assert.deepEqual(parseActionSpec(action.spec), action.spec);
    const spec = action.spec; assert.ok(spec.version === 43);
    assert.throws(() => f.store.createAction(f.session.actorId, { ...spec, workload: { ...spec.workload, assertion: { kind: "json", field: "total", equals: 1 } } }), { code: "EXECUTABLE_BUILD_REQUIRED" });
    const { verification: _verification, ...unbound } = spec; assert.throws(() => f.store.createAction(f.session.actorId, { ...unbound, version: 21 }), { code: "EXECUTABLE_BUILD_REQUIRED" });
    let writes = 0; const write = new LiaraDeployClient(config, async (url, request) => {
      writes++; if (new URL(url).pathname.endsWith("/sources")) return Response.json({ sourceID: "go-source" });
      const body = JSON.parse(String(request.body)); assert.equal(body.type, "docker"); assert.deepEqual(body.build, { dockerfile: ".launchlane-executable.Dockerfile" }); assert.deepEqual(body.platformConfig, {}); return Response.json({ releaseID: "go-release" });
    });
    await assert.rejects(executeDeployment(config, f.store, f.session, action.id, signal(), { read, write })); assert.equal(writes, 0);
    f.store.decide(action.id, f.session.actorId, f.session.id, action.hash, "approve"); await executeDeployment(config, f.store, f.session, action.id, signal(), { read, write }); assert.equal(writes, 2);
    const probe = new WorkloadProbe(config, async () => [{ address: "93.184.216.34", family: 4 }], async request => ({ status: 200, body: request.pathname === "/launchlane-build-proof.json" ? wrongProof ? "wrong release" : compiledProof(f.job.publication) : '{"total":73}', bytes: 12, durationMs: 1, contentType: "application/json" }));
    const checked = await observeDeployment(config, f.store, f.session, action.id, signal(), { read, probe }); assert.equal(checked.state, wrongProof ? "failed" : "succeeded");
    await assert.rejects(executeDeployment(config, f.store, f.session, action.id, signal(), { read, write })); assert.equal(writes, 2);
  } finally { f.close(); }
});

test("compiled Go destination uses local evidence before cloud env, while publication requires the reviewed values", async () => {
  const f = await goFixture(true); try {
    const config = connect(f, false), network = "d".repeat(24); let exists = false, writes = 0;
    const read = new LiaraAccountClient(config, account, async url => {
      const path = new URL(url).pathname;
      if (path === "/v1/me") return Response.json({ user: { _id: account }, team: { _id: team, balance: 10000 }, plans: { projects: { starter: { available: true, region: "iran", price: 500 } }, projectBundlePlans: { starter: { basic: { available: true, price: 40 } } } } });
      if (path === "/v1/networks") return Response.json({ networks: [{ _id: network, name: "fixture" }] });
      return exists ? Response.json({ project: { _id: appId, project_id: app, type: "docker", planID: "starter", bundlePlanID: "basic", network: { _id: network }, readOnlyRootFilesystem: true } }) : new Response(null, { status: 404 });
    });
    const write = new LiaraProvisionClient(config, async (_url, request) => { writes++; assert.equal(JSON.parse(String(request.body)).platform, "docker"); exists = true; return Response.json({ projectID: appId }); });
    const action = await proposeDestination(config, f.store, f.session.actorId, { flowId: f.selected.id, app, planId: "starter", bundleId: "basic", networkId: network }, signal(), { read, write }); assert.equal(action.spec.version, 22);
    f.store.decide(action.id, f.session.actorId, f.session.id, action.hash, "approve"); await executeDestination(config, f.store, f.session, action.id, signal(), { read, write }); assert.equal((await observeDestination(config, f.store, f.session, action.id, signal(), { read, write })).state, "succeeded"); assert.equal(writes, 1);
    const targetRead = new LiaraReadClient(config, async () => Response.json({ project: { _id: appId, project_id: app, type: "docker", status: "Running", planID: "starter", envs: [] } }));
    await assert.rejects(proposeWorkloadDeployment(config, f.store, f.session.actorId, { flowId: f.selected.id, app, port: null, workload: { origin, ...f.build.workload } }, signal(), { read: targetRead }), { code: "EXECUTABLE_ENV_CHANGED" });
    const bytes = await readArtifact(config.stateDir, f.job.artifact); assert.equal(gunzipSync(bytes).includes(Buffer.from(f.secret)), false);
    await writeFile(join(config.stateDir, "build-outputs", `${f.receipt.artifactHash}.executable.gz`), "corrupted");
    await assert.rejects(proposeDestination(config, f.store, f.session.actorId, { flowId: f.selected.id, app, planId: "starter", bundleId: "basic", networkId: network }, signal(), { read, write }), { code: "BUILD_OUTPUT_MISMATCH" }); assert.equal(writes, 1);
  } finally { f.close(); }
});

test("Go registry denies changed origins before I/O and never replaces a corrupt pinned cache", async () => {
  let reads = 0;
  for (const url of ["http://proxy.golang.org/module", "https://localhost/module", "https://proxy.golang.org.evil.test/module", "https://user:password@proxy.golang.org/module", "https://mirrors.aliyun.com/golang/other.tar.gz"]) {
    await assert.rejects(goRegistryRead(url, signal(), 1024, () => reads++), { code: "GO_REGISTRY_DENIED" });
  }
  assert.equal(reads, 0);
  const f = await goFixture(); try {
    await writeFile(join(f.config.stateDir, `go-${goToolchain.sha256}.tar.gz`), "changed public tool cache");
    await assert.rejects(prepareGoDependencies([], join(f.workspace, "dependencies"), f.config.stateDir, signal(), () => reads++, async () => { reads++; throw Error("network must not replace corrupt bytes"); }), { code: "GO_TOOLCHAIN_CHANGED" });
    assert.equal(reads, 0);
  } finally { f.close(); }
});
