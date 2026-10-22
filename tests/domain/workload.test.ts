import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { freeHttpTestPort, isHttpTestPort } from "../helpers/http-port.ts";

async function sample(message: string | undefined) {
  const port = await freeHttpTestPort();
  const env: NodeJS.ProcessEnv = { ...process.env, PORT: String(port) };
  delete env.WELCOME_MESSAGE;
  if (message !== undefined) env.WELCOME_MESSAGE = message;
  const child = spawn(
    process.execPath,
    [fileURLToPath(new URL("../../examples/node-service/server.mjs", import.meta.url))],
    { env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
  );
  let logs = "";
  child.stdout.setEncoding("utf8");
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("Sample did not start"));
    }, 10_000);
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.stdout.on("data", (chunk: string) => {
      logs += chunk;
      if (logs.includes('"event":"listening"')) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });
  return {
    base: `http://127.0.0.1:${port}`,
    logs: () => logs,
    async close() {
      child.kill();
      await new Promise<void>((resolve) => child.once("exit", () => resolve()));
    },
  };
}

test("local HTTP oracles reject Fetch-blocked ports without rejecting safe neighbouring ports", () => {
  for (const port of [0, 6000, 6667, 10080, -1, 65_536, 3000.5])
    assert.equal(isHttpTestPort(port), false);
  for (const port of [3000, 6001, 10081, 49_152, 65_535]) assert.equal(isHttpTestPort(port), true);
});

test("controlled incident oracle checks the same workload: liveness 200 is insufficient, wrong fix stays 500, correct config yields 200", async () => {
  for (const [message, expected] of [
    [undefined, 500],
    ["", 500],
    ["test-only-value", 200],
  ] as const) {
    const service = await sample(message);
    try {
      const alive = await fetch(`${service.base}/healthz`, { signal: AbortSignal.timeout(5000) });
      assert.equal(alive.status, 200);
      const workload = await fetch(service.base, { signal: AbortSignal.timeout(5000) });
      assert.equal(workload.status, expected);
      const body: unknown = await workload.json();
      assert.deepEqual(
        body,
        expected === 200
          ? { status: "healthy", revision: "sample-v1" }
          : { error: "CONFIG_REQUIRED", revision: "sample-v1" },
      );
      if (message)
        assert.ok(!JSON.stringify(body).includes(message) && !service.logs().includes(message));
    } finally {
      await service.close();
    }
  }
});
