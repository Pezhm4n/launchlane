import { componentPath, validateComponentOutput } from "../../src/server/agent/component-output.ts";
import { createHash } from "node:crypto";
import { composerTool } from "../../src/contracts/php-runtime.ts";
import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { phpFixture } from "../helpers/php-fixture.ts";
import { parseProjectBuildPlan } from "../../src/contracts/project-build.ts";
import { phpEnvironmentNames } from "../../src/server/workspace/php-environment.ts";
import { assertPhpEnvironment } from "../../src/server/agent/php-container.ts";
import { phpDistRequests, phpRegistryRead, preparePhpDependencies } from "../../src/server/agent/php-source.ts";
import { assertPhpJob } from "../../src/server/policy/php-artifact.ts";
import { captureProject } from "../../src/server/workspace/inspect.ts";
import { decodeProfile, decodeAction } from "../../src/contracts/client-decode.ts";
import { parseActionSpec } from "../../src/server/policy/action.ts";
import { toolsForAgent } from "../../src/server/agent/tools.ts";
import { proposeWorkloadDeployment, executeDeployment, observeDeployment } from "../../src/server/application/deployment.ts";
import { LiaraReadClient } from "../../src/server/liara/client.ts";
import { LiaraDeployClient } from "../../src/server/liara/deploy.ts";
import { sealCredential } from "../../src/server/connections/credentials.ts";
import { WorkloadProbe } from "../../src/server/liara/probe.ts";
import { compiledProof } from "../../src/server/agent/fullstack-artifact.ts";

const signal = () => AbortSignal.timeout(5000), account = "a".repeat(24), team = "b".repeat(24), appId = "c".repeat(24), app = "installed-php", origin = "https://installed-php.example.com";
const nativeFetch = globalThis.fetch;
before(() => { globalThis.fetch = async () => { throw Error("External request denied in PHP domain regression"); }; });
after(() => { globalThis.fetch = nativeFetch; });
function connect(f: Awaited<ReturnType<typeof phpFixture>>) {
  const config = { ...f.config, apps: [app], teamId: team, enableMutations: true, enableLiveLiara: true, liaraToken: "synthetic-php-provider", probeOrigins: { [app]: origin } };
  f.store.saveConnection(f.session.actorId, { source: "token", ciphertext: sealCredential(config.liaraToken, config.sessionSecret, f.session.actorId, "liara"), view: { provider: "liara", status: "connected", identityId: account, displayName: "Fixture", login: "fixture@example.test", teamId: team, teamName: "Fixture", checkedAt: Date.now(), apps: [{ id: appId, name: app, platform: "docker" }], selectedApp: app } }); return config;
}
function reader(config: ConstructorParameters<typeof LiaraReadClient>[0]) { return new LiaraReadClient(config, async url => Response.json(new URL(url).pathname.endsWith("/releases") ? { total: 1, currentRelease: "php-release", releases: [{ _id: "php-release", state: "READY", port: 8080 }] } : { project: { _id: appId, project_id: app, type: "docker", status: "Running", planID: "starter", envs: [] } })); }

test("PHP discovery retains literal inputs and original Composer/PHPUnit configuration without flattening", async () => {
  assert.deepEqual(phpEnvironmentNames("<?php /* getenv('COMMENT') */ $data=['configured'=>getenv('APP_LABEL')]; $_ENV['DATABASE_URL']; $_SERVER['REQUEST_URI']; $object->getenv('MEMBER');"), ["APP_LABEL", "DATABASE_URL"]);
  assert.deepEqual(phpEnvironmentNames("<p>getenv('HTML')</p><?php $text=\"getenv('STRING')\"; # getenv('COMMENT')\ngetenv('APP_LABEL');"), ["APP_LABEL"]);
  assert.throws(() => assertPhpEnvironment([{ key: "COMPOSER_AUTH", value: "not forwarded" }]), { code: "PHP_ENVIRONMENT_UNSUPPORTED" });
  let reads = 0; await assert.rejects(phpRegistryRead("https://localhost/private.zip", signal(), 1024, () => reads++), { code: "PHP_REGISTRY_DENIED" }); assert.equal(reads, 0);
  assert.equal(phpDistRequests([{ path: "composer.lock", content: await readFile("tests/fixtures/php-service/composer.lock") }]).length, 28);
  const malicious = JSON.parse(await readFile("tests/fixtures/php-service/composer.lock", "utf8")); malicious.packages[0].name = "../.."; assert.throws(() => phpDistRequests([{ path: "composer.lock", content: Buffer.from(JSON.stringify(malicious)) }]), { code: "PHP_LOCK_UNSUPPORTED" });
  const f = await phpFixture(); try {
    assert.deepEqual(decodeProfile({ profile: f.original.profile }).phpRuntime, f.original.profile.phpRuntime);
    assert.throws(() => parseProjectBuildPlan({ ...f.build, buildCommand: "composer update" }), { code: "PHP_BUILD_CHANGED" });
    for (const path of ["/launchlane-build-proof.json?x=1", "/%6caunchlane-build-proof.json"]) assert.throws(() => parseProjectBuildPlan({ ...f.build, workload: { ...f.build.workload, path } }), { code: "PROBE_TARGET_DENIED" });
    assert.throws(() => parseProjectBuildPlan({ ...f.build, workload: { ...f.build.workload, path: "/./launchlane-build-proof.json" } }), { code: "PHP_BUILD_CHANGED" });
    assert.throws(() => assertPhpJob(f.store, "foreign", f.selected), { code: "PHP_BUILD_REQUIRED" });
    assert.equal(toolsForAgent({ ...f.config, enableLocalRepair: true }, "compiled", false, true).some(tool => tool.function.name === "propose_project_build"), true);
    await writeFile(join(f.workspace, "php", "package.json"), JSON.stringify({ scripts: { build: "vite build" } }));
    await assert.rejects(captureProject(f.workspace, "php"), { code: "PHP_FRONTEND_BUILD_REQUIRED" });
  } finally { f.close(); }
});

for (const wrongProof of [false, true]) test(`installed PHP publication preserves original workload and exact proof (${wrongProof ? "mismatch" : "verified"})`, async () => {
  const f = await phpFixture(); try {
    const config = connect(f), read = reader(config), action = await proposeWorkloadDeployment(config, f.store, f.session.actorId, { flowId: f.selected.id, app, port: null, workload: { origin, ...f.build.workload } }, signal(), { read });
    assert.equal(action.spec.version, 44); assert.deepEqual(decodeAction(action).spec, action.spec); assert.deepEqual(parseActionSpec(action.spec), action.spec); const spec = action.spec; assert.ok(spec.version === 44);
    const { verification: _verification, ...unbound } = spec; assert.throws(() => f.store.createAction(f.session.actorId, { ...unbound, version: 21 }), { code: "PHP_BUILD_REQUIRED" });
    assert.throws(() => f.store.createAction(f.session.actorId, { ...spec, workload: { ...spec.workload, assertion: { kind: "json", field: "total", equals: 1 } } }), { code: "PHP_BUILD_REQUIRED" });
    let writes = 0; const write = new LiaraDeployClient(config, async (url, request) => { writes++; if (new URL(url).pathname.endsWith("/sources")) return Response.json({ sourceID: "php-source" }); const body = JSON.parse(String(request.body)); assert.equal(body.type, "docker"); assert.deepEqual(body.build, { dockerfile: ".launchlane-php.Dockerfile" }); assert.deepEqual(body.platformConfig, {}); return Response.json({ releaseID: "php-release" }); });
    await assert.rejects(executeDeployment(config, f.store, f.session, action.id, signal(), { read, write })); assert.equal(writes, 0);
    f.store.decide(action.id, f.session.actorId, f.session.id, action.hash, "approve"); await executeDeployment(config, f.store, f.session, action.id, signal(), { read, write }); assert.equal(writes, 2);
    const probe = new WorkloadProbe(config, async () => [{ address: "93.184.216.34", family: 4 }], async request => ({ status: 200, body: request.pathname === "/launchlane-build-proof.json" ? wrongProof ? "wrong release" : compiledProof(f.job.publication) : '{"total":73}', bytes: 12, durationMs: 1, contentType: "application/json" }));
    assert.equal((await observeDeployment(config, f.store, f.session, action.id, signal(), { read, probe })).state, wrongProof ? "failed" : "succeeded");
    await assert.rejects(executeDeployment(config, f.store, f.session, action.id, signal(), { read, write })); assert.equal(writes, 2);
  } finally { f.close(); }
});

test("PHP publication cannot detach the original private build environment", async () => {
  const f = await phpFixture(true); try { const config = connect(f); await assert.rejects(proposeWorkloadDeployment(config, f.store, f.session.actorId, { flowId: f.selected.id, app, port: null, workload: { origin, ...f.build.workload } }, signal(), { read: reader(config) }), { code: "PHP_ENV_CHANGED" }); } finally { f.close(); }
});

test("PHP rejects a changed cached tool before reading or replacing it", async () => {
  const f=await phpFixture();try{
    await writeFile(join(f.config.stateDir,`php-tool-${composerTool.sha256}`),"changed public tool");let reads=0;
    await assert.rejects(preparePhpDependencies([],join(f.config.stateDir,"deps"),f.config.stateDir,signal(),()=>reads++,async()=>{reads++;throw Error("must not replace corrupt bytes");}),{code:"PHP_TOOLCHAIN_CHANGED"});assert.equal(reads,0);
  }finally{f.close();}
});

test("code under sensitive-named namespaces remains code while private data and input bytes stay blocked", () => {
  assert.equal(componentPath("vendor/framework/Auth/Passwords/PasswordBroker.php"),"vendor/framework/Auth/Passwords/PasswordBroker.php");
  for(const path of ["credentials/private.json","credentials.php/private.json","vendor/framework/.env","vendor/framework/.ssh/id_rsa"])assert.throws(()=>componentPath(path),{code:"COMPONENT_OUTPUT_PATH"});
  const bytes=Buffer.from("private-fixture-output"),path="vendor/framework/Auth/Passwords/PasswordBroker.php";
  assert.throws(()=>validateComponentOutput({version:1,sourceHash:"a".repeat(64),planHash:"b".repeat(64),entries:[{path,type:"file",bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex"),executable:false}],contents:[{path,base64:bytes.toString("base64")}],totalBytes:bytes.length},["private-fixture-output"]),{code:"COMPONENT_OUTPUT_CHANGED"});
});
