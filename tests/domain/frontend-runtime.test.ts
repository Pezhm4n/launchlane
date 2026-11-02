import assert from "node:assert/strict";
import { test } from "node:test";
import { frontendRuntime } from "../../src/server/workspace/frontend.ts";
import { parseFrontendRuntime } from "../../src/contracts/frontend-runtime.ts";
import { parseProjectBuildPlan, nodeBuildRuntime } from "../../src/contracts/project-build.ts";
import { containsSourceCredential } from "../../src/server/policy/redaction.ts";
import { angularFixtureFiles } from "../helpers/angular-fixture.ts";
import { inspectPnpmWorkspace } from "../../src/server/workspace/pnpm.ts";
import { sourcePnpmComponent } from "../../src/server/agent/pnpm-component.ts";

const vue = { kind: "vue", builder: "vite", nodeVersion: "20", outputDirectory: "dist", mirror: false } as const;
test("public pnpm snapshot package versions do not exempt credentials, URLs, arbitrary fields or known private values", () => {
  const lock = "lockfileVersion: '9.0'\nsnapshots:\n  '@inquirer/prompts@1.0.0':\n    dependencies:\n      '@inquirer/password': 5.2.5\n";
  assert.equal(containsSourceCredential(lock, [], "pnpm-lock.yaml"), false);
  for (const changed of [lock.replace("5.2.5", "actual-private-value"), lock + "password: actual-private-value\n", lock.replace("dependencies:", "custom:"), lock.replace("5.2.5", "https://user:pass@example.com/pkg.tgz")])
    assert.equal(containsSourceCredential(changed, [], "pnpm-lock.yaml"), true);
  assert.equal(containsSourceCredential(lock, ["5.2.5"], "pnpm-lock.yaml"), true);
  assert.equal(containsSourceCredential(lock, [], "settings.yaml"), true);
});
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

test("Angular CLI project/configuration/output overrides bind the actual compiler target and cannot hide SSR or a custom builder", () => {
  const target = { builder: "@angular/build:application", defaultConfiguration: "production", options: { outputPath: "dist/base" },
    configurations: { production: { outputPath: "dist/production" }, staging: { outputPath: { base: "dist/staging", browser: "web" } }, server: { ssr: true } } };
  const files = (build = target) => [{ path: "angular.json", content: Buffer.from(JSON.stringify({ projects: { app: { projectType: "application", architect: { build } } } })) }];
  const pkg = (build: string) => ({ dependencies: { "@angular/core": "22", "@angular/cli": "22" }, scripts: { build } });
  assert.equal(frontendRuntime(pkg("ng build app --configuration=staging"), {}, files())?.outputDirectory, "dist/staging/web");
  assert.equal(frontendRuntime(pkg("ng build --project app -c production,staging --output-path=dist/reviewed"), {}, files())?.outputDirectory, "dist/reviewed/browser");
  for (const command of ["ng build other", "ng build --configuration missing", "ng build --configuration staging --configuration production", "ng build --output-path", "ng build --ssr", "node wrapper.mjs"])
    assert.throws(() => frontendRuntime(pkg(command), {}, files()), { code: "FRONTEND_COMMAND_UNSUPPORTED" });
  assert.throws(() => frontendRuntime(pkg("ng build -c production,server"), {}, files()), { code: "FRONTEND_SSR_REQUIRED" });
  assert.throws(() => frontendRuntime(pkg("ng build"), {}, files({ ...target, builder: "custom:application" })), { code: "FRONTEND_BUILDER_UNSUPPORTED" });
});

test("the actual locked Angular member retains its root manager, compiler command and selected browser artifact", () => {
  const files = angularFixtureFiles(), workspace = inspectPnpmWorkspace(files); assert.ok(workspace);
  assert.equal(workspace.nodeVersion, "24"); assert.equal(workspace.packages[0]?.build, "pnpm -r build");
  const member = sourcePnpmComponent(files, workspace, "apps/web");
  assert.equal(member.kind, "static"); assert.equal(member.outputDirectory, "dist/staging/client"); assert.equal(member.testCommand, "node --test dist.test.mjs");
  assert.equal(workspace.packages.find(row => row.root === "apps/web")?.build, "ng build portal --configuration=staging");
});
test("frontend build plans bind the fixed image, output and host serving path without granting a shell start or skipping dependencies", () => {
  const input = { ...nodeBuildRuntime("20"), version: 5, frontend: vue, buildCommand: "vite build", testCommand: null, startCommand: "liara-frontend", port: 80,
    workload: { path: "/", status: 200, assertion: { kind: "text", contains: "Notes" } } };
  assert.deepEqual(parseProjectBuildPlan(input), input);
  for (const changes of [{ install: "none" }, { port: 3000 }, { nodeVersion: "22" }, { startCommand: "vite --host" }, { buildCommand: null }]) assert.throws(() => parseProjectBuildPlan({ ...input, ...changes }));
});
