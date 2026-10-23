import assert from "node:assert/strict";
import { test } from "node:test";
import { frontendRuntime } from "../../src/server/workspace/frontend.ts";
import { parseFrontendRuntime } from "../../src/contracts/frontend-runtime.ts";
import { parseProjectBuildPlan, nodeBuildRuntime } from "../../src/contracts/project-build.ts";

const vue = { kind: "vue", builder: "vite", nodeVersion: "20", outputDirectory: "dist", mirror: false } as const;
test("frontend variants require a supported builder and exact safe output root; names alone do not select a frontend", () => {
  assert.deepEqual(frontendRuntime({ dependencies: { vue: "3", vite: "7" }, scripts: { build: "vite build" } }, {}, []), vue);
  assert.equal(frontendRuntime({ dependencies: { react: "19" } }, {}, []), undefined);
  assert.equal(frontendRuntime({ dependencies: { react: "19", next: "16", vite: "7" }, scripts: { build: "next build" } }, {}, []), undefined);
  assert.equal(frontendRuntime({ dependencies: { vue: "3", nuxt: "4", vite: "7" }, scripts: { build: "nuxt build" } }, {}, []), undefined);
  assert.throws(() => frontendRuntime({ dependencies: { react: "19", vue: "3", vite: "7" }, scripts: { build: "vite build" } }, {}, []), { code: "FRONTEND_AMBIGUOUS" });
  for (const outputDirectory of ["../dist", "/dist", "dist/../../private", "dist//app", "dist/.hidden", "dist/app\\private", "dist/app:secret"]) assert.throws(() => parseFrontendRuntime({ ...vue, outputDirectory }));
  assert.throws(() => parseFrontendRuntime({ ...vue, nodeVersion: "24" }));
  assert.throws(() => parseFrontendRuntime({ ...vue, kind: "react" }));
});
test("Angular browser output follows the chosen application configuration; ambiguous and SSR workspaces stop explicitly", () => {
  const pkg = { dependencies: { "@angular/core": "20", "@angular/cli": "20" }, scripts: { build: "ng build" } },
    files = (projects: unknown) => [{ path: "angular.json", content: Buffer.from(JSON.stringify({ projects })) }],
    application = { projectType: "application", architect: { build: { builder: "@angular/build:application", defaultConfiguration: "production", options: { outputPath: "dist/dev" }, configurations: { production: { outputPath: { base: "dist/app", browser: "web" } } } } } };
  assert.equal(frontendRuntime(pkg, {}, files({ app: application }))?.outputDirectory, "dist/app/web");
  assert.throws(() => frontendRuntime(pkg, {}, files({ app: application, second: application })), { code: "FRONTEND_AMBIGUOUS" });
  const server = { ...application, architect: { build: { ...application.architect.build, options: { outputPath: "dist/server", ssr: true } } } };
  assert.throws(() => frontendRuntime(pkg, {}, files({ app: server })), { code: "FRONTEND_SSR_REQUIRED" });
});
test("frontend build plans bind the fixed image, output and host serving path without granting a shell start or skipping dependencies", () => {
  const input = { ...nodeBuildRuntime("20"), version: 5, frontend: vue, buildCommand: "vite build", testCommand: null, startCommand: "liara-frontend", port: 80,
    workload: { path: "/", status: 200, assertion: { kind: "text", contains: "Notes" } } };
  assert.deepEqual(parseProjectBuildPlan(input), input);
  for (const changes of [{ install: "none" }, { port: 3000 }, { nodeVersion: "22" }, { startCommand: "vite --host" }, { buildCommand: null }]) assert.throws(() => parseProjectBuildPlan({ ...input, ...changes }));
});
