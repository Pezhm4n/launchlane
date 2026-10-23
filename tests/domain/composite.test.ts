import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import type { SourceFile } from "../../src/server/workspace/inspect.ts";
import { inspectCompositeProject } from "../../src/server/workspace/composite.ts";
import { fingerprint } from "../../src/server/policy/action.ts";

const pins = "# Existing resolved dependencies; no version changes\nfastapi==0.157.0\nstarlette==1.9.0\nuvicorn==0.54.0\n";
const api = 'from fastapi import FastAPI\nfrom services.api.catalogue import Catalogue\n\ndef create_app(database=None):\n    application = FastAPI(title="Catalogue")\n    return application\n\napp = create_app()\n';
const pkg = { name: "catalogue-web", private: true, scripts: { build: "npm run typecheck && vite build", typecheck: "tsc --noEmit" }, devDependencies: { vite: "8.3.5" } };
function source(path: string, content: string | object): SourceFile {
  return { path, content: Buffer.from(typeof content === "string" ? content : JSON.stringify(content)) };
}
function fixture(): SourceFile[] {
  return [source("requirements.lock.txt", pins), source("services/api/main.py", api), source("services/api/catalogue.py", "class Catalogue: pass\n"),
    source("clients/web/package.json", pkg), source("clients/web/package-lock.json", { lockfileVersion: 3, packages: { "": pkg,
      "node_modules/vite": { version: "8.3.5", resolved: "https://registry.npmjs.org/vite/-/vite-8.3.5.tgz", integrity: `sha512-${Buffer.alloc(64, 1).toString("base64")}` } } }),
    source("clients/web/index.html", '<div id="root"></div><script type="module" src="/src/main.ts"></script>'), source("clients/web/src/main.ts", "document.title='Catalogue';\n"),
    source("clients/web/vite.config.mjs", "import { defineConfig } from 'vite';\nexport default defineConfig({ build: { rolldownOptions: { input: { index: 'index.html', design: 'design.html' } } } });\n")];
}
function replace(files: readonly SourceFile[], path: string, content: string | object): SourceFile[] {
  return files.map(file => file.path === path ? source(path, content) : file);
}
function code(files: readonly SourceFile[]): string {
  const result = inspectCompositeProject(files);
  assert.equal(result.status, "unsupported");
  if (result.status !== "unsupported") throw new Error("expected unsupported result");
  return result.code;
}

test("composite descriptor keeps the repository root and exact source/lock provenance without claiming an artifact", () => {
  const files = fixture(), before = files.map(file => ({ path: file.path, hash: createHash("sha256").update(file.content).digest("hex") }));
  const result = inspectCompositeProject(files);
  assert.equal(result.status, "detected");
  if (result.status !== "detected") throw new Error("descriptor missing");
  const descriptor = result.descriptor;
  assert.equal(descriptor.publishable, false);
  assert.equal(descriptor.sourceRoot, ".");
  assert.equal(descriptor.backend.entryPath, "services/api/main.py");
  assert.equal(descriptor.backend.module, "services.api.main");
  assert.equal(descriptor.backend.exportName, "app");
  assert.equal(descriptor.backend.framework, "fastapi");
  assert.equal(descriptor.backend.staticMountDetected, false);
  assert.deepEqual(descriptor.backend.requirements, { sourcePath: "requirements.lock.txt", targetPath: "requirements.txt", requiresCopy: true,
    sha256: createHash("sha256").update(pins).digest("hex"), manifestSha256: null, pins: [{ name: "fastapi", version: "0.157.0" }, { name: "starlette", version: "1.9.0" }, { name: "uvicorn", version: "0.54.0" }] });
  assert.equal(descriptor.frontend.directory, "clients/web");
  assert.equal(descriptor.frontend.outputDirectory, "dist");
  assert.equal(descriptor.frontend.lockPath, "clients/web/package-lock.json");
  assert.equal(descriptor.frontend.lockedTarballs, 1);
  assert.equal(descriptor.frontend.buildCommand, pkg.scripts.build);
  assert.deepEqual(descriptor.preparation.command, ["python3", "launchlane_main.py"]);
  assert.equal(descriptor.preparation.accessLog, false);
  const manifest = files.map(file => ({ path: file.path, bytes: file.content.length, sha256: createHash("sha256").update(file.content).digest("hex") })).sort((a, b) => a.path.localeCompare(b.path, "en"));
  assert.equal(descriptor.sourceHash, fingerprint(manifest));
  assert.deepEqual(files.map(file => ({ path: file.path, hash: createHash("sha256").update(file.content).digest("hex") })), before);
});

test("direct ASGI instances and aliases are recognized; comments, strings and test apps are not declarations", () => {
  for (const declaration of ["from fastapi import FastAPI as Service\napplication = Service()\n", "from starlette.applications import Starlette\napplication = Starlette()\n"]) {
    const result = inspectCompositeProject(replace(fixture(), "services/api/main.py", declaration));
    assert.equal(result.status, "detected");
    if (result.status === "detected") assert.equal(result.descriptor.backend.exportName, "application");
  }
  assert.equal(code(replace(fixture(), "services/api/main.py", '# from fastapi import FastAPI\n"""\nfrom fastapi import FastAPI\napp = FastAPI()\n"""\n')), "COMPOSITE_ASGI_REQUIRED");
  assert.equal(inspectCompositeProject([...fixture(), source("tests/test_api.py", "from fastapi import FastAPI\napp = FastAPI()\n")]).status, "detected");
  const mounted = inspectCompositeProject(replace(fixture(), "services/api/main.py", `${api}\napp.mount('/', StaticFiles(directory='existing-public', html=True))\n`));
  assert.equal(mounted.status, "detected");
  if (mounted.status === "detected") assert.equal(mounted.descriptor.backend.staticMountDetected, true);
});

test("a second real ASGI entry or Vite leaf is an ambiguity, never an arbitrary selection", () => {
  assert.equal(code([...fixture(), source("other.py", "from fastapi import FastAPI\napp = FastAPI()\n")]), "COMPOSITE_ASGI_AMBIGUOUS");
  assert.equal(code([...fixture(), source("other/web/package.json", pkg)]), "COMPOSITE_FRONTEND_AMBIGUOUS");
  assert.equal(code([...fixture(), source("package.json", { workspaces: ["clients/*"] })]), "COMPOSITE_ROOT_WORKSPACE_UNSUPPORTED");
  assert.equal(code(replace(fixture(), "services/api/main.py", Array.from({ length: 9 }, (_, index) => `from fastapi import FastAPI as Service${index}`).join("\n"))), "COMPOSITE_ASGI_COMPLEXITY_LIMIT");
});

test("Python dependencies must be present, pinned, complete for ASGI and consistent with a second manifest", () => {
  assert.equal(code(fixture().filter(file => file.path !== "requirements.lock.txt")), "COMPOSITE_REQUIREMENTS_REQUIRED");
  for (const value of ["fastapi>=0.1\n", "-r external.txt\n", "https://private.test/dependency.whl\n"]) assert.equal(code(replace(fixture(), "requirements.lock.txt", value)), "PYTHON_REQUIREMENT_UNPINNED");
  assert.equal(code(replace(fixture(), "requirements.lock.txt", "fastapi==0.157.0\n")), "COMPOSITE_ASGI_DEPENDENCIES_REQUIRED");
  assert.equal(code([...fixture(), source("requirements.txt", pins.replace("uvicorn==0.54.0", "uvicorn==0.53.0"))]), "COMPOSITE_REQUIREMENTS_CONFLICT");
  const result = inspectCompositeProject([...fixture(), source("requirements.txt", pins)]);
  assert.equal(result.status, "detected");
  if (result.status === "detected") assert.equal(result.descriptor.backend.requirements.requiresCopy, false);
  assert.equal(code(replace(fixture(), "requirements.lock.txt", "starlette==1.9.0\nuvicorn==0.54.0\n")), "COMPOSITE_ASGI_DEPENDENCIES_REQUIRED");
});

test("a single root requirements include is provenance-bound and flattened only as an explicit preparation", () => {
  const include = "# Use the existing resolved pins\n-r requirements.lock.txt\n", result = inspectCompositeProject([...fixture(), source("requirements.txt", include)]);
  assert.equal(result.status, "detected");
  if (result.status === "detected") {
    assert.equal(result.descriptor.backend.requirements.requiresCopy, true);
    assert.equal(result.descriptor.backend.requirements.sourcePath, "requirements.lock.txt");
    assert.equal(result.descriptor.backend.requirements.manifestSha256, createHash("sha256").update(include).digest("hex"));
  }
  for (const value of ["-r ../requirements.lock.txt\n", "-r https://other.test/requirements.lock.txt\n", "-r requirements.lock.txt\nfastapi==0.157.0\n", "-r other.txt\n"])
    assert.equal(code([...fixture(), source("requirements.txt", value)]), "PYTHON_REQUIREMENT_UNPINNED");
});

test("missing root import context and generated target conflicts stop preparation", () => {
  const leaf = fixture().map(file => ({ ...file, path: file.path.replace(/^services\/api\//, "") }));
  assert.equal(code(leaf), "COMPOSITE_SOURCE_ROOT_REQUIRED");
  for (const path of ["launchlane_main.py", "launchlane-public/index.html"]) assert.equal(code([...fixture(), source(path, "existing user content")]), "COMPOSITE_GENERATED_PATH_CONFLICT");
});

test("frontend source, lock integrity and existing command are checked without running them", () => {
  assert.equal(code(fixture().filter(file => file.path !== "clients/web/index.html")), "COMPOSITE_VITE_SOURCE_REQUIRED");
  assert.equal(code(fixture().filter(file => file.path !== "clients/web/package-lock.json")), "COMPOSITE_VITE_SOURCE_REQUIRED");
  assert.equal(code(replace(fixture(), "clients/web/package.json", { ...pkg, devDependencies: { vite: "9.0.0" } })), "COMPOSITE_FRONTEND_LOCK_CHANGED");
  assert.equal(code(replace(fixture(), "clients/web/package.json", { ...pkg, scripts: { build: "vite build --outDir ../server" } })), "COMPOSITE_VITE_BUILD_UNSUPPORTED");
  assert.equal(code(replace(fixture(), "clients/web/package-lock.json", "not-json")), "COMPOSITE_MANIFEST_INVALID");
});

test("Vite output must be a static independent relative directory; dynamic or server output is unsupported", () => {
  const path = "clients/web/vite.config.mjs";
  const result = inspectCompositeProject(replace(fixture(), path, "export default { build: { outDir: 'browser-output' } };"));
  assert.equal(result.status, "detected");
  if (result.status === "detected") assert.equal(result.descriptor.frontend.outputDirectory, "browser-output");
  for (const config of ["export default defineConfig(loadConfiguration());", "export default () => ({build:{}});", "export default { build: productionBuild };",
    "export default { root: 'src', build: {} };", "export default { build: { ssr: true } };", "export default { ...defaults };",
    "export default { build: { outDir: process.env.OUTPUT } };", "export default { build: { outDir: 'dist' + suffix } };", "export default { ['build']: buildConfig };", "export default { build: { 'outDir': output } };",
    "export default { build: { outDir: '../outside' } };", "export default { build: { outDir: '/outside' } };", "export default { build: { outDir: 'src' } };" ]) {
    assert.match(code(replace(fixture(), path, config)), /^COMPOSITE_VITE_(?:CONFIG|OUTPUT)_UNSUPPORTED$/);
  }
  assert.equal(code([...fixture(), source("clients/web/vite.config.ts", "export default {};")]), "COMPOSITE_VITE_CONFIG_AMBIGUOUS");
});

test("descriptor has bounded safe input and its hash changes with backend, frontend, config or lock bytes", () => {
  const base = inspectCompositeProject(fixture());
  assert.equal(base.status, "detected");
  if (base.status !== "detected") throw new Error("missing descriptor");
  for (const path of ["services/api/catalogue.py", "clients/web/src/main.ts", "clients/web/vite.config.mjs", "requirements.lock.txt"]) {
    const files = fixture(), file = files.find(row => row.path === path);
    assert.ok(file);
    const changed = inspectCompositeProject(replace(files, path, `${file.content.toString("utf8")}\n`));
    assert.equal(changed.status, "detected");
    if (changed.status === "detected") assert.notEqual(changed.descriptor.sourceHash, base.descriptor.sourceHash);
  }
  for (const path of ["../outside.py", "/outside.py", "some\\file.py", "C:/outside.py", "a//file.py"]) assert.equal(code([...fixture(), source(path, "")]), "COMPOSITE_SOURCE_INVALID");
  assert.equal(code([...fixture(), fixture()[0] ?? source("fallback", "")]), "COMPOSITE_SOURCE_INVALID");
  assert.equal(code([...fixture(), source("large.py", "x".repeat(4 * 1024 * 1024 + 1))]), "COMPOSITE_SOURCE_INVALID");
  assert.equal(inspectCompositeProject([source("main.py", "print('no frontend')")]).status, "not_applicable");
});
