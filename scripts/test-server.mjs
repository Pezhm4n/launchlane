import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { cp, mkdtemp, mkdir, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as pause } from "node:timers/promises";

export async function startTestServer() {
  const directory = await mkdtemp(join(tmpdir(), "launchlane-http-"));
  const workspace = join(directory, "workspace");
  await mkdir(join(workspace, "examples"), { recursive: true });
  await cp(resolve("examples/node-service"), join(workspace, "examples/node-service"), {
    recursive: true,
  });
  const probe = createServer();
  await new Promise((done) => probe.listen(0, "127.0.0.1", done));
  const port = probe.address().port;
  await new Promise((done) => probe.close(done));
  const origin = `http://127.0.0.1:${port}`,
    token = randomBytes(32).toString("base64url");
  const teamId = "a".repeat(24),
    app = "sample-node";
  const env = {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(port),
    LAUNCHLANE_ORIGIN: origin,
    LAUNCHLANE_OPERATOR_TOKEN: token,
    LAUNCHLANE_SESSION_SECRET: randomBytes(48).toString("base64url"),
    LAUNCHLANE_STATE_DIR: join(directory, "state"),
    LAUNCHLANE_WORKSPACE_ROOT: workspace,
    LAUNCHLANE_ENABLE_MUTATIONS: "false",
    LAUNCHLANE_ENABLE_LIVE_MODEL: "false",
    LAUNCHLANE_APP_ALLOWLIST: app,
    LIARA_TEAM_ID: teamId,
    LIARA_API_BASE_URL: "https://api.liara.ir",
    LIARA_API_TOKEN: "",
    MODEL_BASE_URL: "https://ai.boxapi.ir/ai/v1",
    MODEL_API_KEY: "",
    MODEL_ID: "",
  };
  const child = spawn(
    process.execPath,
    [
      resolve("node_modules/next/dist/bin/next"),
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    { env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
  );
  let output = "";
  for (const pipe of [child.stdout, child.stderr])
    pipe.on("data", (chunk) => {
      output = `${output}${chunk}`.slice(-6000);
    });
  async function close() {
    if (child.exitCode === null) {
      child.kill();
      await new Promise((done) => child.once("exit", done));
    }
    if (!resolve(directory).startsWith(join(tmpdir(), "launchlane-http-")))
      throw new Error("Unsafe test cleanup path");
    await rm(directory, { recursive: true, force: true });
  }
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) {
      await close();
      throw new Error(`Isolated server failed: ${output.replaceAll(token, "[REDACTED]")}`);
    }
    try {
      const response = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(500) });
      if (response.ok) return { origin, token, teamId, app, workspace, close };
    } catch {
      /* Wait for this local server only; never contact an external provider. */
    }
    await pause(100);
  }
  await close();
  throw new Error("Isolated production server did not become available.");
}
