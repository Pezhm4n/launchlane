import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { readConfig } from "../../src/server/config.ts";
import { githubEnvironment, githubExecutable } from "../../src/server/github/cli.ts";
import { AppError } from "../../src/server/errors.ts";

test("default GitHub resolution reuses installed CLI and never ignores an explicit tool path", () => {
  const directory = mkdtempSync(join(tmpdir(), "launchlane-gh-resolution-")), previous = process.cwd();
  try {
    process.chdir(directory);
    assert.equal(githubExecutable(readConfig({})), "gh", "PATH works when the private Windows binary is absent");
    mkdirSync(resolve(".local/tools/github"), { recursive: true });
    writeFileSync(resolve(".local/tools/github/gh.exe"), "selection-only fixture; never executed");
    assert.equal(githubExecutable(readConfig({})), process.platform === "win32" ? resolve(".local/tools/github/gh.exe") : "gh");
    const path = resolve("explicit missing gh.exe");
    for (const mode of ["operator", "liara"]) {
      const config = readConfig({ LAUNCHLANE_AUTH_MODE: mode, LAUNCHLANE_GITHUB_CLI_PATH: path });
      assert.equal(config.githubCliPath, path);
      assert.equal(githubExecutable(config), path, "A configured path must not silently select another executable");
    }
  } finally { process.chdir(previous); assert.ok(directory.startsWith(join(tmpdir(), "launchlane-gh-resolution-"))); rmSync(directory, { recursive: true, force: true }); }
});
test("a shared hosted executable still uses separate private actor configuration and cannot adopt system credentials", async () => {
  const directory = mkdtempSync(join(tmpdir(), "launchlane-gh-resolution-"));
  try {
    const config = readConfig({ LAUNCHLANE_AUTH_MODE: "liara", LAUNCHLANE_STATE_DIR: directory, LAUNCHLANE_GITHUB_CLI_PATH: resolve(directory, "gh") });
    const a = await githubEnvironment(config, "actor-a", "cli_private"), b = await githubEnvironment(config, "actor-b", "cli_private");
    assert.notEqual(a.GH_CONFIG_DIR, b.GH_CONFIG_DIR);
    for (const env of [a, b]) { assert.equal(env.GH_TOKEN, undefined); assert.equal(env.GITHUB_TOKEN, undefined); assert.equal(env.MODEL_API_KEY, undefined); assert.equal(env.LIARA_API_TOKEN, undefined); }
    await assert.rejects(githubEnvironment(config, "actor-a", "cli_system"), error => error instanceof AppError && error.code === "GITHUB_SCOPE_DENIED");
  } finally { assert.ok(directory.startsWith(join(tmpdir(), "launchlane-gh-resolution-"))); rmSync(directory, { recursive: true, force: true }); }
});
