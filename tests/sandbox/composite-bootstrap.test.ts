import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { compositeBootstrapSource } from "../../src/server/workspace/composite-bootstrap.ts";
import { parseProjectBuildPlan, pythonBuildImage } from "../../src/contracts/project-build.ts";
import { runPythonBuild } from "../../src/server/agent/python-container.ts";

test("composite bootstrap validates exact entry identity and a dedicated relative output path", () => {
  const source = compositeBootstrapSource({ module: "apps.api.main", exportName: "app" });
  assert.match(source, /import_module\("apps.api.main"\), "app"/);
  assert.match(source, /"launchlane-public"/);
  assert.match(source, /host='0.0.0.0', port=8000, access_log=False/);
  assert.match(source, /html=True, follow_symlink=False/);
  for (const module of ["launchlane_entry", "launchlane_entry.app", "apps..main", "apps/main", "os;bad", "class.main", ".main"])
    assert.throws(() => compositeBootstrapSource({ module, exportName: "app" }));
  for (const exportName of ["app()", "app.value", "class", ""])
    assert.throws(() => compositeBootstrapSource({ module: "main", exportName }));
  for (const publicDirectory of [".", "../dist", "/dist", "C:/dist", "dist\\public", "dist//public", ".env", "src", "api"])
    assert.throws(() => compositeBootstrapSource({ module: "main", exportName: "app", publicDirectory }));
  assert.throws(() => compositeBootstrapSource({ module: "main", exportName: "app", command: "ignored" }));
});

test("offline Python composite preserves API errors and serves only compiled public assets", {
  skip: process.env.LAUNCHLANE_TEST_PYTHON_WHEELS ? false : "Set LAUNCHLANE_TEST_PYTHON_WHEELS to an existing verified offline FastAPI/httpx/uvicorn wheel cache; no download is performed",
  timeout: 120000,
}, async () => {
  const directory = await mkdtemp(join(tmpdir(), "launchlane-composite-"));
  try {
    const project = join(directory, "project");
    await mkdir(join(project, "launchlane-public", "assets"), { recursive: true });
    await mkdir(join(project, "launchlane-public", "api"));
    await mkdir(join(project, "launchlane-public", "src"));
    await writeFile(join(project, "launchlane_entry.py"), compositeBootstrapSource({ module: "application", exportName: "app" }));
    await writeFile(join(project, "application.py"), `from fastapi import FastAPI, HTTPException
app = FastAPI()
@app.get('/api/health')
def health(): return {'status': 'alive'}
@app.get('/api/broken')
def broken(): raise HTTPException(status_code=503, detail='catalogue unavailable')
`);
    await writeFile(join(project, "launchlane-public", "index.html"), '<title>CompositeVerified</title><script src="/assets/app.js"></script><link rel="stylesheet" href="/assets/app.css">');
    await writeFile(join(project, "launchlane-public", "assets", "app.js"), "window.compiled = true;");
    await writeFile(join(project, "launchlane-public", "assets", "app.css"), "body{color:black}");
    for (const file of [".env", "catalogue.sqlite3", "bundle.js.map", "src/leak.js", "api/index.html"])
      await writeFile(join(project, "launchlane-public", file), "must not be exposed");
    await writeFile(join(project, "launchlane-public", "source.py"), "PRIVATE = True\n");
    await writeFile(join(project, "private.sqlite3"), "outside public directory");
    await writeFile(join(project, "test_bootstrap.py"), `import importlib, unittest
from pathlib import Path
from fastapi.testclient import TestClient
from launchlane_entry import app
class CompositeTests(unittest.TestCase):
    def test_assets_and_api(self):
        with TestClient(app) as client:
            self.assertIn('CompositeVerified', client.get('/').text)
            javascript = client.get('/assets/app.js')
            self.assertEqual(javascript.status_code, 200)
            self.assertIn('javascript', javascript.headers['content-type'])
            self.assertEqual(client.get('/api/health').json(), {'status': 'alive'})
            failed = client.get('/api/broken')
            self.assertEqual(failed.status_code, 503)
            self.assertEqual(failed.json(), {'detail': 'catalogue unavailable'})
            self.assertEqual(client.post('/api/health').status_code, 405)
            for method in ('get', 'post', 'delete'):
                missing = getattr(client, method)('/api/missing')
                self.assertEqual(missing.status_code, 404)
                self.assertEqual(missing.json(), {'detail': 'Not Found'})
            for path in ('/assets/missing.js', '/missing', '/.env', '/source.py', '/catalogue.sqlite3', '/bundle.js.map', '/src/leak.js', '/private.sqlite3', '/%2e%2e/private.sqlite3'):
                missing = client.get(path)
                self.assertEqual(missing.status_code, 404, path)
                self.assertNotIn('CompositeVerified', missing.text)
    def test_root_route_conflict(self):
        Path('conflicting.py').write_text("from fastapi import FastAPI\\napp=FastAPI()\\n@app.get('/')\\ndef root(): return {'existing':True}\\n")
        template = Path('launchlane_entry.py').read_text()
        Path('conflict_bootstrap.py').write_text(template.replace('import_module("application")', 'import_module("conflicting")'))
        with self.assertRaisesRegex(RuntimeError, 'conflicts with an existing root'):
            importlib.import_module('conflict_bootstrap')
`);
    const plan = parseProjectBuildPlan({ version: 2, nodeVersion: null, image: pythonBuildImage,
      runtime: { kind: "python", version: "3.12", command: ["python3", "launchlane_entry.py"] },
      buildCommand: null, testCommand: null, startCommand: "python3 launchlane_entry.py", port: 8000,
      workload: { path: "/", status: 200, assertion: { kind: "text", contains: "<title>CompositeVerified</title>" } } });
    if (plan.version !== 2) throw Error("Expected Python build plan");
    const wheels = process.env.LAUNCHLANE_TEST_PYTHON_WHEELS;
    if (!wheels) throw Error("Offline wheel cache is required");
    const result = await runPythonBuild(project, resolve(wheels), plan, ["test_bootstrap.py"], AbortSignal.timeout(110000));
    assert.equal(result.exitCode, 0, result.output);
    assert.match(result.output, /Ran 2 tests/);
    assert.match(result.output, /verified 2 same-origin assets/);
    assert.equal(result.output.includes('"GET /'), false, "Uvicorn access logs are disabled");
  } finally { await rm(directory, { recursive: true, force: true }); }
});
