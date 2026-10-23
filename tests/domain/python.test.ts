import assert from "node:assert/strict";
import { test } from "node:test";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { prepareProjectFlow, restoreProjectFlow } from "../../src/server/application/project-flows.ts";
import { captureProject } from "../../src/server/workspace/inspect.ts";
import { parsePythonRuntime } from "../../src/contracts/python-runtime.ts";
import { parseProjectBuildPlan, pythonBuildImage } from "../../src/contracts/project-build.ts";
import { downloadPythonWheels, pythonRequirements } from "../../src/server/agent/python-source.ts";
import { fingerprint, parseActionSpec } from "../../src/server/policy/action.ts";
import { decodeAction } from "../../src/contracts/client-decode.ts";
import { LiaraDeployClient } from "../../src/server/liara/deploy.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";
import { validateBuildPlan, validateBuildRepairPaths } from "../../src/server/agent/build-policy.ts";
import { CodeRepairAdapter } from "../../src/server/agent/code-repair.ts";
import { isApplicationEnvironmentKey } from "../../src/contracts/environment.ts";
import { containsSourceCredential } from "../../src/server/policy/redaction.ts";
import { createAgentRun, driveAgentRun } from "../../src/server/agent/runs.ts";
import type { ModelPort } from "../../src/server/agent/model.ts";
import { AgentRepository } from "../../src/server/agent/store.ts";

const runtime = { kind: "python", version: "3.12", command: ["python3", "main.py"] } as const;
const scope = { teamId: "a".repeat(24), app: "python-test" };
const workload = { origin: "https://python-test.liara.run", path: "/orders", status: 200, assertion: { kind: "json", field: "total", equals: 73 } } as const;

test("Python inspection archives actual source, omits database/venv and invalidates changed source", async () => {
  const f = await agentFixture();
  try {
    const project = join(f.workspace, "python");
    await cp(resolve("tests/fixtures/python-service"), project, { recursive: true });
    await mkdir(join(project, ".venv"));
    await writeFile(join(project, ".venv", "private.py"), "DO_NOT_EXPORT");
    await writeFile(join(project, "catalogue.sqlite3"), "DO_NOT_EXPORT");
    await writeFile(join(project, "env.py"), "import os\nx=os.getenv('APPLICATION_MODE')\n");
    const flow = await prepareProjectFlow(f.config, f.store, f.session.actorId, { kind: "local", directory: "python" }, AbortSignal.timeout(3000));
    assert.equal(flow.status, "ready"); assert.ok(flow.artifact); assert.equal(flow.profile.runtime, "python");
    assert.deepEqual(flow.profile.pythonRuntime, runtime); assert.equal(flow.profile.nodeVersion, null);
    assert.deepEqual(flow.profile.envNames, ["APPLICATION_MODE"]);
    assert.equal(flow.profile.manifest.some(file => /venv|sqlite/.test(file.path)), false);
    await writeFile(join(project, "invoice.py"), "def invoice_total(lines): return 0\n");
    assert.equal((await restoreProjectFlow(f.config, f.store, f.session.actorId, AbortSignal.timeout(3000), flow.id))?.status, "stale");
  } finally { f.close(); }
});

test("Python commands, dependency sources and runner overrides are constrained", () => {
  for (const command of [["sh", "main.py"], ["python3", "../main.py"], ["python3", "main.py;curl"], ["python3", "-c", "print(1)"], ["python3", "-m", "pip"]])
    assert.throws(() => parsePythonRuntime({ ...runtime, command }));
  assert.throws(() => parsePythonRuntime({ ...runtime, version: "3.13" }), { code: "PYTHON_VERSION_UNSUPPORTED" });
  for (const value of ["fastapi", "fastapi>=1", "-r elsewhere.txt", "https://other.test/file.whl", "fastapi==1\nFastapi==1"])
    assert.throws(() => pythonRequirements([{ path: "requirements.txt", content: Buffer.from(value) }]));
  assert.deepEqual(pythonRequirements([{ path: "requirements.txt", content: Buffer.from("# comment\nfastapi==0.157.0\n") }]), [{ name: "fastapi", version: "0.157.0" }]);
  for (const path of ["requirements.txt", "liara.json", "test_invoice.py", "tests/test_api.py", "pyproject.toml"])
    assert.throws(() => validateBuildRepairPaths([path]), { code: "BUILD_ORACLE_CHANGED" });
  for (const key of ["PYTHONPATH", "PYTHONHOME", "PIP_INDEX_URL", "LD_PRELOAD"]) assert.equal(isApplicationEnvironmentKey(key), false);
});

test("Python credential references and annotations are accepted; real literal and known secrets stay blocked", () => {
  for (const source of ['api_key: str = field(default="", repr=False)', 'api_key = settings.api_key', 'headers={"Authorization": f"Bearer {self.settings.api_key}"}']) {
    assert.equal(containsSourceCredential(source, [], "app.py"), false, source);
  }
  for (const source of ['api_key: str = "private-value"', 'api_key: str = field(default="private-value", repr=False)', 'api_key = f"private-value"', 'api_key = b"private-value"', 'headers={"Authorization": "Bearer private-value"}', 'password = 12345'])
    assert.equal(containsSourceCredential(source, [], "app.py"), true, source);
  assert.equal(containsSourceCredential('api_key = settings.api_key', ['settings.api_key'], "app.py"), true);
  assert.equal(containsSourceCredential('token = "private-value"', [], "app.py"), true);
  assert.equal(containsSourceCredential('api_key = """private-value"""', [], "app.py"), true);
  assert.equal(containsSourceCredential("token = '''private\nvalue'''", [], "app.py"), true);
});

test("wheel downloads verify provider hashes before use and reject corrupted bytes", async () => {
  const f = await agentFixture(), content = Buffer.from("synthetic wheel"), sha256 = createHash("sha256").update(content).digest("hex");
  const metadata = Buffer.from(JSON.stringify({ urls: [{ packagetype: "bdist_wheel", yanked: false, filename: "fixture-1.0-py3-none-any.whl", digests: { sha256 }, size: content.length, url: "https://files.pythonhosted.org/packages/fixture.whl" }] }));
  try {
    let calls = 0;
    await downloadPythonWheels([{ name: "fixture", version: "1.0" }], join(f.directory, "wheels"), AbortSignal.timeout(3000), () => { calls++; }, async url => url.endsWith("/json") ? metadata : content);
    assert.equal(calls, 2);
    assert.equal(await readFile(join(f.directory, "wheels/requirements.txt"), "utf8"), `fixture==1.0 --hash=sha256:${sha256}`);
    await assert.rejects(downloadPythonWheels([{ name: "fixture", version: "1.0" }], join(f.directory, "corrupt"), AbortSignal.timeout(3000), () => {}, async url => url.endsWith("/json") ? metadata : Buffer.from("wrong")), { code: "PYTHON_WHEEL_CHANGED" });
  } finally { f.close(); }
});

test("Python 3.12 accepts the real dual Python tag but rejects wheels for another runtime or architecture", async () => {
  const f = await agentFixture(), content = Buffer.from("synthetic timezone wheel"), sha256 = createHash("sha256").update(content).digest("hex");
  const row = (filename: string) => ({ packagetype: "bdist_wheel", yanked: false, filename, digests: { sha256 }, size: content.length, url: "https://files.pythonhosted.org/packages/tzdata.whl" });
  try {
    const filename = "tzdata-2026.2-py2.py3-none-any.whl";
    await downloadPythonWheels([{ name: "tzdata", version: "2026.2" }], join(f.directory, "dual-tag"), AbortSignal.timeout(3000), () => {},
      async url => url.endsWith("/json") ? Buffer.from(JSON.stringify({ urls: [row(filename)] })) : content);
    assert.deepEqual(await readFile(join(f.directory, "dual-tag", filename)), content);
    let downloads = 0;
    await assert.rejects(downloadPythonWheels([{ name: "fixture", version: "1.0" }], join(f.directory, "wrong-runtime"), AbortSignal.timeout(3000), () => {}, async url => {
      if (!url.endsWith("/json")) { downloads++; return content; }
      return Buffer.from(JSON.stringify({ urls: [row("fixture-1.0-cp313-cp313-manylinux_2_17_x86_64.whl"), row("fixture-1.0-cp312-cp312-manylinux_2_17_aarch64.whl")] }));
    }), { code: "PYTHON_WHEEL_UNAVAILABLE" });
    assert.equal(downloads, 0);
  } finally { f.close(); }
});

test("Python approval binds runtime, exact archive, workload and official release fields", async () => {
  const spec = parseActionSpec({ version: 11, operation: "deploy", scope, sourceHash: "1".repeat(64), artifactHash: "2".repeat(64), projectFlowId: "12345678-1234-1234-1234-123456789012", selectionHash: "3".repeat(64), accountId: "b".repeat(24), targetAppId: "c".repeat(24), args: { port: 8000, planId: "small" }, nodeVersion: null, runtime, environment: null, workload });
  assert.equal(spec.version, 11); if (spec.version !== 11) throw Error("wrong contract");
  const decoded = decodeAction({ id: "action", actorId: "actor", hash: fingerprint(spec), spec, state: "awaiting_approval", createdAt: 1, expiresAt: 2, attemptId: null, remoteId: null, errorCode: null });
  assert.deepEqual(decoded.spec, spec);
  assert.throws(() => parseActionSpec({ ...spec, nodeVersion: "22" }));
  assert.throws(() => parseActionSpec({ ...spec, approved: true }));
  assert.notEqual(fingerprint(spec), fingerprint({ ...spec, runtime: { ...runtime, command: ["python3", "other.py"] } }));
  const f = await agentFixture();
  try {
    let sent: unknown;
    const config = { ...f.config, enableMutations: true, enableLiveLiara: true, teamId: scope.teamId, apps: [scope.app], liaraToken: "synthetic" };
    const client = new LiaraDeployClient(config, async (_url, init) => { sent = JSON.parse(String(init.body)); return Response.json({ releaseID: "release-python" }); });
    assert.equal(await client.release(spec, "source-python", new RunBudget(config), AbortSignal.timeout(3000)), "release-python");
    assert.deepEqual(sent, { sourceID: "source-python", port: 8000, type: "python", platformConfig: { version: "3.12" }, args: ["python3 main.py"] });
  } finally { f.close(); }
});

test("Python build/repair proposal uses immutable commands and a separate bounded workspace", async () => {
  const f = await agentFixture();
  try {
    const project = join(f.workspace, "python"); await cp(resolve("tests/fixtures/python-service"), project, { recursive: true });
    const flow = await prepareProjectFlow(f.config, f.store, f.session.actorId, { kind: "local", directory: "python" }, AbortSignal.timeout(3000));
    const capture = await captureProject(f.workspace, "python"), build = parseProjectBuildPlan({ version: 2, nodeVersion: null, runtime, image: pythonBuildImage, buildCommand: null, testCommand: null, startCommand: "python3 main.py", port: 8000, workload: { path: "/orders", status: 200, assertion: workload.assertion } });
    assert.deepEqual(validateBuildPlan(capture.files, capture.profile, build), build);
    const adapter = new CodeRepairAdapter({ ...f.config, enableLocalRepair: true }, f.store);
    const job = await adapter.propose(f.session.actorId, { projectId: flow.id, goal: "Apply quantity correctly", expectedSourceHash: flow.profile.sourceHash, execution: "container", build, allowedPaths: ["invoice.py"], testFiles: ["test_invoice.py"] }, AbortSignal.timeout(3000));
    assert.equal(job.state, "proposed"); assert.equal(job.containerImage, pythonBuildImage); assert.equal(job.beforeTest, null);
    await assert.rejects(adapter.propose(f.session.actorId, { projectId: flow.id, goal: "Weaken tests", expectedSourceHash: flow.profile.sourceHash, execution: "container", build, allowedPaths: ["test_invoice.py"], testFiles: [] }, AbortSignal.timeout(3000)), { code: "BUILD_ORACLE_CHANGED" });
  } finally { f.close(); }
});

test("the actual agent loop exposes Python build approval before any script or cloud write", async () => {
  const f = await agentFixture();
  try {
    await cp(resolve("tests/fixtures/python-service"), join(f.workspace, "python"), { recursive: true });
    const config = { ...f.config, enableLocalRepair: true }, flow = await prepareProjectFlow(config, f.store, f.session.actorId, { kind: "local", directory: "python" }, AbortSignal.timeout(3000));
    const { run } = createAgentRun(config, f.store, f.session, "python-build-loop", "Prepare the Python /orders page, expected total 73", flow.id);
    const model: ModelPort = { async complete(_messages, tools, budget, signal) {
      assert.ok(tools.some(tool => tool.function.name === "propose_project_build"));
      assert.equal(tools.some(tool => tool.function.name === "propose_project_preparation"), false);
      budget.take("model", signal);
      return { content: null, usage: 10, calls: [{ id: "python-build", type: "function", function: { name: "propose_project_build", arguments: JSON.stringify({ path: "/orders", status: 200, assertion: workload.assertion }) } }] };
    } };
    await driveAgentRun(config, f.store, f.session, run.id, { model });
    const result = new AgentRepository(f.store).get(f.session.actorId, run.id);
    assert.equal(result?.state, "needs_approval"); assert.equal(result.repair?.build?.version, 2);
    assert.equal(result.repair?.afterTest, null); assert.equal(result.repair?.containerIds?.length, 0);
  } finally { f.close(); }
});
