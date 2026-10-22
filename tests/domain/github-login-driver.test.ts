import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { readConfig } from "../../src/server/config.ts";
import { AppError } from "../../src/server/errors.ts";
import { deviceLogin, parseDeviceChallenge } from "../../src/server/github/login.ts";

test("the real CLI clipboard output still identifies only the official device challenge", () => {
  const output =
    "! One-time code (ABCD-1234) copied to clipboard\nOpen this URL to continue in your web browser: https://github.com/login/device\n";
  assert.deepEqual(parseDeviceChallenge(output), {
    userCode: "ABCD-1234",
    verificationUrl: "https://github.com/login/device",
  });
  assert.throws(
    () => parseDeviceChallenge(output.replace("github.com", "example.com")),
    (error: unknown) => error instanceof AppError && error.code === "GITHUB_LOGIN_PROTOCOL",
  );
});

test("the actual login driver receives chunked child output without changing the clipboard and cancellation ends the process", async () => {
  const directory = mkdtempSync(join(tmpdir(), "launchlane-gh-driver-"));
  let copied = false,
    challenges = 0;
  const controller = new AbortController();
  try {
    const driver = deviceLogin(
      readConfig({ LAUNCHLANE_STATE_DIR: directory }),
      "actor",
      (args, env, signal) => {
        assert.equal(env.GH_TOKEN, undefined);
        assert.equal(env.MODEL_API_KEY, undefined);
        const child = spawn(
          process.execPath,
          [
            fileURLToPath(new URL("../helpers/github-login-child.mjs", import.meta.url)),
            "normal",
            ...args,
          ],
          { env, signal, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
        );
        child.stderr.on("data", (part: Buffer) => {
          copied ||= part.toString().includes("copied to clipboard");
        });
        return child;
      },
    );
    await assert.rejects(
      driver(controller.signal, (challenge) => {
        assert.equal(challenge.userCode, "ABCD-1234");
        assert.equal(challenge.verificationUrl, "https://github.com/login/device");
        challenges++;
        controller.abort();
      }),
      (error: unknown) => error instanceof AppError && error.code === "CANCELLED",
    );
    assert.equal(copied, false);
    assert.equal(challenges, 1);
  } finally {
    controller.abort();
    rmSync(directory, { recursive: true });
  }
});

test("the login driver rejects oversized output and an unexpected login host, and an unresponsive child can be cancelled", async () => {
  const directory = mkdtempSync(join(tmpdir(), "launchlane-gh-driver-"));
  try {
    for (const scenario of ["oversized", "wrong-host", "silent"]) {
      const driver = deviceLogin(
        readConfig({ LAUNCHLANE_STATE_DIR: directory }),
        "actor",
        (args, env, signal) =>
          spawn(
            process.execPath,
            [
              fileURLToPath(new URL("../helpers/github-login-child.mjs", import.meta.url)),
              scenario,
              ...args,
            ],
            { env, signal, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
          ),
      );
      let challenges = 0;
      await assert.rejects(
        driver(AbortSignal.timeout(scenario === "silent" ? 200 : 3000), () => {
          challenges++;
        }),
        (error: unknown) =>
          error instanceof AppError &&
          error.code === (scenario === "silent" ? "CANCELLED" : "GITHUB_LOGIN_PROTOCOL"),
      );
      assert.equal(challenges, 0);
    }
  } finally {
    rmSync(directory, { recursive: true });
  }
});
