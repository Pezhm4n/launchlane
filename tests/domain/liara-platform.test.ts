import assert from "node:assert/strict";
import test from "node:test";
import { isDocumentedLiaraVersion, isLiaraPlatform, isNativeLiaraPlatform, liaraPlatformDocumentation, liaraPlatformDocumentationDate, liaraPlatforms } from "../../src/contracts/liara-platform.ts";

test("official platform snapshot covers fourteen distinct provider families", () => {
  assert.deepEqual([...liaraPlatforms].sort(), ["node", "next", "laravel", "php", "python", "django", "flask", "dotnet", "go", "react", "angular", "vue", "static", "docker"].sort());
  assert.equal(new Set(liaraPlatforms).size, 14);
  assert.equal(liaraPlatformDocumentationDate, "2026-10-25");
  for (const platform of liaraPlatforms) {
    const item = liaraPlatformDocumentation[platform], url = new URL(item.url);
    assert.equal(url.origin, "https://docs.liara.ir");
    assert.ok(url.pathname.endsWith("/how-tos/deploy-app/"));
    assert.ok(item.documentedDefault === null || item.versions?.includes(item.documentedDefault));
  }
});
test("runtime versions are platform-specific documentation rather than inherited worker support", () => {
  assert.equal(isDocumentedLiaraVersion("php", "8.4"), false);
  assert.equal(isDocumentedLiaraVersion("laravel", "8.4"), true);
  assert.equal(isDocumentedLiaraVersion("django", "3.13"), true);
  assert.equal(isDocumentedLiaraVersion("dotnet", "10.0"), true);
  assert.equal(isDocumentedLiaraVersion("go", "1.25"), true);
  assert.equal(isDocumentedLiaraVersion("react", "22"), false);
  assert.equal(isDocumentedLiaraVersion("docker", "22"), false);
  assert.equal(isDocumentedLiaraVersion("node", 22), false);
  for (const platform of ["react", "angular", "vue"] as const) assert.equal(liaraPlatformDocumentation[platform].selectableVersion, false);
  assert.equal(liaraPlatformDocumentation.next.versionField, "next.nodeVersion");
  assert.equal(liaraPlatformDocumentation.django.versionField, "django.pythonVersion");
  assert.equal(liaraPlatformDocumentation.laravel.versionField, "laravel.phpVersion");
});
test("unknown names and Docker-hosted languages do not become native platforms", () => {
  for (const value of ["java", "ruby", "rust", "netcore", "NodeJS", "__proto__", null, {}, 20]) assert.equal(isLiaraPlatform(value), false);
  assert.equal(isNativeLiaraPlatform("docker"), true);
  assert.equal(isNativeLiaraPlatform("python"), false);
  assert.equal(isNativeLiaraPlatform("node"), false);
});
