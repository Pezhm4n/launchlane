import assert from "node:assert/strict";
import test from "node:test";
import type { NativeLiaraPlatform, NativePlatformDescriptor } from "../../src/contracts/liara-platform.ts";
import { inspectNativePlatform } from "../../src/server/workspace/native-platform.ts";
import type { SourceFile } from "../../src/server/workspace/inspect.ts";

function source(value: Record<string, string | object>): SourceFile[] {
  return Object.entries(value).map(([path, content]) => ({ path, content: Buffer.from(typeof content === "string" ? content : JSON.stringify(content)) }));
}
function detected(files: SourceFile[], platform: NativeLiaraPlatform, liara?: unknown): NativePlatformDescriptor {
  const result = inspectNativePlatform(files, liara);
  assert.equal(result.state, "detected", JSON.stringify(result));
  if (result.state !== "detected") throw Error("Expected descriptor");
  assert.equal(result.publishable, false); assert.equal(result.descriptor.publishable, false);
  assert.equal(result.descriptor.platform, platform);
  assert.equal(result.descriptor.startCommand, null); assert.equal(result.descriptor.buildCommand, null);
  assert.ok(result.descriptor.requirements.some(item => item.code === "NATIVE_EXECUTION_REQUIRED"));
  return result.descriptor;
}
function denied(files: SourceFile[], code: string, liara?: unknown) {
  const result = inspectNativePlatform(files, liara);
  assert.equal(result.state, "unsupported", JSON.stringify(result));
  if (result.state !== "unsupported") throw Error("Expected unsupported result");
  assert.equal(result.publishable, false); assert.equal(result.issues[0]?.code, code);
  return result;
}
const php = { "composer.json": { require: { php: "^8.3" } }, "composer.lock": {}, "index.php": "<?php echo 'ready';" };
const laravel = { "composer.json": { require: { php: "^8.2", "laravel/framework": "^11.0" } }, "composer.lock": {}, artisan: "<?php // management", "public/index.php": "<?php // front controller" };
const go = { "go.mod": "module example.test/service\n\ngo 1.24.0\n", "cmd/http/boot.go": "package main\nfunc main() {}" };
const dotnet = { "apps/Portal/Portal.csproj": '<Project Sdk="Microsoft.NET.Sdk.Web"><PropertyGroup><TargetFramework>net9.0</TargetFramework></PropertyGroup></Project>' };
const flask = { "requirements.txt": "Flask==3.1.2", "service/http.py": "from flask import Flask as Server\napplication = Server(__name__)\n" };
const django = { "requirements.txt": "Django==5.1.3", "manage.py": 'from django.core.management import execute_from_command_line\nexecute_from_command_line()\n', "website/wsgi.py": "from django.core.wsgi import get_wsgi_application\napplication = get_wsgi_application()" };

test("PHP evidence and a unique Composer branch are inferred without running or altering files", () => {
  const files = source(php), before = files.map(file => Buffer.from(file.content));
  const descriptor = detected(files, "php");
  assert.equal(descriptor.runtimeVersion, "8.3"); assert.equal(descriptor.versionSource, "manifest");
  assert.equal(descriptor.entry, "index.php"); assert.equal(descriptor.port, null);
  for (let i = 0; i < files.length; i++) assert.deepEqual(files[i]?.content, before[i]);
});
test("Laravel remains distinct from PHP and preserves its frontend and resource boundaries", () => {
  const descriptor = detected(source({ ...laravel, "package.json": { scripts: { build: "vite build" } } }), "laravel", { laravel: { phpVersion: "8.4", composerMirror: false } });
  assert.equal(descriptor.runtimeVersion, "8.4"); assert.equal(descriptor.configuration.phpVersion, "8.4");
  assert.equal(descriptor.entry, "public/index.php");
  assert.ok(descriptor.requirements.some(item => item.code === "NATIVE_FRONTEND_BUILD"));
  assert.ok(descriptor.requirements.some(item => item.code === "NATIVE_LARAVEL_RESOURCES"));
});
test("custom Go entry names and module versions are retained", () => {
  const descriptor = detected(source(go), "go", { port: 8080 });
  assert.equal(descriptor.entry, "cmd/http/boot.go"); assert.equal(descriptor.runtimeVersion, "1.24");
  assert.equal(descriptor.port, 8080); assert.equal(descriptor.configuration.mainFile, "cmd/http/boot.go");
});
test("the unique .NET web project supplies its framework without assuming a solution name", () => {
  const descriptor = detected(source({ ...dotnet, "global.json": { sdk: { version: "9.0.204" } } }), "dotnet");
  assert.equal(descriptor.entry, "apps/Portal/Portal.csproj"); assert.equal(descriptor.runtimeVersion, "9.0");
  assert.ok(descriptor.requirements.some(item => item.code === "NATIVE_DOTNET_SDK_CHECK"));
});
test("Flask detects custom modules and instance aliases instead of assuming app.py:app", () => {
  const descriptor = detected(source(flask), "flask", { flask: { pythonVersion: "3.13", mirror: false } });
  assert.equal(descriptor.entry, "service/http.py"); assert.equal(descriptor.configuration.appModule, "service.http:application");
  assert.equal(descriptor.configuration.pythonVersion, "3.13"); assert.equal(descriptor.configuration.mirror, false);
});
test("Django management and gateway evidence do not authorize migrations or collectstatic", () => {
  const descriptor = detected(source(django), "django", { django: { pythonVersion: "3.12", modifySettings: false } });
  assert.equal(descriptor.entry, "manage.py"); assert.ok(descriptor.evidence.some(item => item.path === "website/wsgi.py"));
  assert.ok(descriptor.requirements.some(item => item.code === "NATIVE_DJANGO_RESOURCES"));
});
test("Docker port candidates come from the final stage and honor an explicit application port", () => {
  const files = source({ "deploy/Containerfile": "FROM golang:1.24 AS build\nEXPOSE 5000\nFROM alpine:3.22\nEXPOSE 8080/tcp # actual candidate\nCMD [\"/service\"]" });
  const config = { platform: "docker", build: { dockerfile: "./deploy/Containerfile" } };
  assert.equal(detected(files, "docker", config).port, 8080);
  assert.equal(detected(files, "docker", { ...config, port: 9090 }).port, 9090);
});
test("existing Node, Python, frontend and Static detectors retain their own routes", () => {
  for (const files of [source({ "package.json": { scripts: { start: "node app.js" } }, Dockerfile: "FROM node:22" }), source({ "server.py": "from fastapi import FastAPI\napp = FastAPI()", Dockerfile: "FROM python:3.12" }), source({ "index.html": "<!doctype html><h1>Ready</h1>" })])
    assert.equal(inspectNativePlatform(files).state, "not_applicable");
  assert.equal(inspectNativePlatform(source(php), { platform: "node" }).state, "not_applicable");
});
test("a Docker alternative never silently overrides an identified native platform", () => {
  const files = source({ ...php, Dockerfile: "FROM php:8.3-apache" });
  assert.equal(detected(files, "php").runtimeVersion, "8.3");
  assert.equal(detected(files, "docker", { platform: "docker", port: 80 }).runtimeVersion, null);
});
test("ambiguous runtimes, commands and entries require a meaningful choice", () => {
  denied(source({ ...php, ...go }), "NATIVE_PLATFORM_AMBIGUOUS");
  denied(source({ ...php, "package.json": { scripts: { start: "node server.js" } } }), "NATIVE_PLATFORM_AMBIGUOUS");
  denied(source({ ...go, "cmd/worker/job.go": "package main\nfunc main(){}" }), "NATIVE_ENTRY_AMBIGUOUS");
  const chosen = detected(source({ ...go, "cmd/worker/job.go": "package main\nfunc main(){}" }), "go", { go: { mainFile: "cmd/worker/job.go" } });
  assert.equal(chosen.entry, "cmd/worker/job.go");
});
test("Go declaration-like comments and strings do not create an executable entry", () => {
  denied(source({ "go.mod": go["go.mod"], "sample.go": 'package docs\n// package main\n// func main(){}\nconst example = `package main\nfunc main(){}`' }), "NATIVE_ENTRY_AMBIGUOUS");
});
test("documented provider versions and project requirements are both enforced", () => {
  denied(source(php), "NATIVE_VERSION_UNDOCUMENTED", { php: { version: "8.4" } });
  denied(source(php), "NATIVE_VERSION_CONFLICT", { php: { version: "8.2" } });
  denied(source({ ...go, "go.mod": "module example.test/service\ngo 1.26\n" }), "NATIVE_VERSION_UNDOCUMENTED");
  denied(source({ ...go, "go.mod": `${go["go.mod"]}toolchain go1.25.1\n` }), "NATIVE_VERSION_CONFLICT");
  denied(source(dotnet), "NATIVE_VERSION_CONFLICT", { dotnet: { version: "8.0" } });
});
test("unspecified or broad versions do not silently acquire a documented or CLI default", () => {
  const descriptor = detected(source(laravel), "laravel");
  assert.equal(descriptor.runtimeVersion, null); assert.equal(descriptor.versionSource, "unspecified");
  assert.ok(descriptor.requirements.some(item => item.code === "NATIVE_VERSION_REQUIRED"));
});
test(".NET multiple projects, multiple targets, non-web projects and Windows targets stay explicit", () => {
  denied(source({ ...dotnet, "Another.csproj": dotnet["apps/Portal/Portal.csproj"] }), "NATIVE_ENTRY_AMBIGUOUS");
  const selected = detected(source({ ...dotnet, "Another.csproj": dotnet["apps/Portal/Portal.csproj"] }), "dotnet", { dotnet: { csprojectFile: "Another.csproj" } });
  assert.equal(selected.entry, "Another.csproj");
  for (const framework of ["net8.0-windows", "net8.0;net9.0", "$(Target)"])
    denied(source({ "Web.csproj": `<Project Sdk="Microsoft.NET.Sdk.Web"><TargetFrameworks>${framework}</TargetFrameworks></Project>` }), "NATIVE_DOTNET_TARGET_REQUIRED");
  denied(source({ "Library.csproj": '<Project Sdk="Microsoft.NET.Sdk"><TargetFramework>net8.0</TargetFramework></Project>' }), "NATIVE_ENTRY_AMBIGUOUS");
});
test("Flask factories are not confused with local app variables or comment examples", () => {
  const factory = source({ "requirements.txt": "Flask", "factory.py": 'from flask import Flask\n# app = Flask(__name__)\ndef create_site():\n    local_app = Flask(__name__)\n    return local_app\n' });
  denied(factory, "NATIVE_ENTRY_AMBIGUOUS");
  const descriptor = detected(factory, "flask", { flask: { appModule: "factory:create_site()", pythonVersion: "3.12" } });
  assert.equal(descriptor.configuration.appModule, "factory:create_site()");
  assert.ok(descriptor.requirements.some(item => item.code === "NATIVE_PYTHON_IMPORT_CHECK"));
});
test("missing or escaped configured entries never become valid runtime references", () => {
  denied(source(go), "NATIVE_ENTRY_PATH_INVALID", { go: { mainFile: "../private/main.go" } });
  denied(source(dotnet), "NATIVE_ENTRY_MISSING", { dotnet: { csprojectFile: "missing.csproj" } });
  denied(source(flask), "NATIVE_ENTRY_MISSING", { flask: { appModule: "absent:app" } });
  denied(source({ Dockerfile: "FROM nginx:alpine" }), "NATIVE_ENTRY_PATH_INVALID", { platform: "docker", build: { dockerfile: "C:/secret/Dockerfile" } });
  denied(source({ Dockerfile: "FROM nginx:alpine" }), "NATIVE_ENTRY_MISSING", { platform: "docker", build: { dockerfile: "missing/Dockerfile" } });
});
test("multiple, UDP or variable Docker exposes do not become guessed HTTP ports", () => {
  for (const line of ["EXPOSE 80 8080", "EXPOSE 9090/udp", "EXPOSE $PORT", "EXPOSE 70000"])
    assert.equal(detected(source({ Dockerfile: `FROM nginx:alpine\n${line}` }), "docker").port, null);
  const descriptor = detected(source({ Dockerfile: "FROM nginx:alpine", "compose.yaml": "services: {}" }), "docker");
  assert.ok(descriptor.requirements.some(item => item.code === "NATIVE_COMPOSE_SERVICES"));
});
test("Docker context catches omitted entry scripts and unsafe or remote build inputs", () => {
  denied(source({ Dockerfile: "FROM alpine:3.22\nCOPY launch.sh /app/launch.sh" }), "NATIVE_DOCKER_CONTEXT_MISSING");
  const descriptor = detected(source({ Dockerfile: 'FROM alpine:3.22\nCOPY ["launch.sh", "/app/launch.sh"]', "launch.sh": "#!/bin/sh\nexec /app/service" }), "docker");
  assert.equal(descriptor.entry, "Dockerfile");
  denied(source({ Dockerfile: "FROM alpine:3.22\nCOPY ../private /app" }), "NATIVE_ENTRY_PATH_INVALID");
  denied(source({ Dockerfile: "FROM alpine:3.22\nADD https://example.test/runtime /app/runtime" }), "NATIVE_DOCKER_REMOTE_INPUT");
  detected(source({ Dockerfile: "FROM alpine:3.22 AS build\nFROM scratch\nCOPY --from=build /bin /bin" }), "docker");
  detected(source({ Dockerfile: "FROM alpine:3.22 AS build\nFROM scratch\nCOPY --chown=1000:1000 --from=build /bin /bin" }), "docker");
});
test("Flask package initialization and normal Python import forms retain their actual module", () => {
  for (const code of ["import flask as framework\napplication = framework.Flask(__name__)\n", "from flask import (\n    request,\n    Flask as WebServer,\n)\napplication = WebServer(__name__)\n"]) {
    const descriptor = detected(source({ "requirements.txt": "Flask==3.1.2", "website/__init__.py": code }), "flask");
    assert.equal(descriptor.configuration.appModule, "website:application");
    assert.equal(descriptor.entry, "website/__init__.py");
  }
});
test("comment examples and externally supplied configuration do not manufacture source evidence", () => {
  const descriptor = detected(source(php), "php", { php: { version: "8.3" } });
  assert.equal(descriptor.evidence.some(item => item.path === "liara.json"), false);
  assert.ok(descriptor.requirements.some(item => item.code === "NATIVE_CONFIGURATION_BINDING"));
  denied(source({ "Library.csproj": '<Project Sdk="Microsoft.NET.Sdk"><Description>Microsoft.NET.Sdk.Web</Description><TargetFramework>net9.0</TargetFramework></Project>' }), "NATIVE_ENTRY_AMBIGUOUS");
  const module = detected(source({ ...go, "go.mod": "/*\ngo 1.25\n*/\nmodule example.test/service\ngo 1.24\n" }), "go");
  assert.equal(module.runtimeVersion, "1.24");
});
test("malformed and untrusted metadata returns bounded diagnostics without raw values", () => {
  const sentinel = "private-value-must-not-be-returned";
  const files = source({ ...php, "composer.json": `{"require": ${sentinel}` });
  assert.equal(JSON.stringify(denied(files, "NATIVE_MANIFEST_INVALID")).includes(sentinel), false);
  const descriptor = detected(source(php), "php", { php: { version: "8.3", password: sentinel } });
  assert.equal(JSON.stringify(descriptor).includes(sentinel), false);
  assert.ok(descriptor.requirements.some(item => item.code === "NATIVE_CONFIGURATION_REVIEW"));
  denied(source(php), "NATIVE_PLATFORM_UNKNOWN", { platform: sentinel });
  denied(source(php), "NATIVE_PORT_INVALID", { port: 0 });
  denied(source(php), "NATIVE_CONFIGURATION_INVALID", { php: { composerMirror: "yes" } });
});
test("source boundaries reject duplicate, unsafe and oversized input", () => {
  denied([...source(php), ...source({ "index.php": "other" })], "NATIVE_SOURCE_PATH_INVALID");
  denied(source({ "../index.php": "<?php" }), "NATIVE_SOURCE_PATH_INVALID");
  denied([{ path: "index.php", content: Buffer.alloc(4 * 1024 * 1024 + 1) }], "NATIVE_SOURCE_LIMIT");
});
