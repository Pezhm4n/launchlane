import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { cp, mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as pause } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { freeHttpTestPort } from "../tests/helpers/http-port.ts";

export async function startTestServer({ browserHost = "127.0.0.1", publicOrigin = "", agentFixture = false, environmentFixture = false, activationFixture = false, destinationFixture = false, workspaceConfigured = true, authFixture = false, staticFixture = false } = {}) {
  if (environmentFixture && !agentFixture) throw new Error("Environment fixture requires the network-denying test hook");
  if (activationFixture && !environmentFixture) throw new Error("Activation fixture requires the environment fixture");
  if (destinationFixture && !agentFixture) throw new Error("Destination fixture requires the network-denying test hook");
  if (!["127.0.0.1", "localhost"].includes(browserHost)) throw new Error("Unsupported loopback test host");
  if (publicOrigin) {
    const target = new URL(publicOrigin);
    if (target.protocol !== "https:" || !["127.0.0.1", "localhost"].includes(target.hostname) || target.origin !== publicOrigin)
      throw new Error("A public test origin must be exact loopback HTTPS");
  }
  const directory = await mkdtemp(join(tmpdir(), "launchlane-http-"));
  const workspace = join(directory, "workspace");
  await mkdir(join(workspace, "examples"), { recursive: true });
  await cp(resolve("examples/node-service"), join(workspace, "examples/node-service"), {
    recursive: true,
  });
  const port = await freeHttpTestPort();
  const backendOrigin = `http://${browserHost}:${port}`, origin = publicOrigin || backendOrigin,
    token = randomBytes(32).toString("base64url");
  const teamId = "a".repeat(24),
    app = "sample-node";
  const env = {
    ...process.env,
    NODE_ENV: "production",
    LAUNCHLANE_AUTH_MODE: "operator",
    PORT: String(port),
    LAUNCHLANE_ORIGIN: origin,
    LAUNCHLANE_OPERATOR_TOKEN: token,
    LAUNCHLANE_SESSION_SECRET: randomBytes(48).toString("base64url"),
    LAUNCHLANE_STATE_DIR: join(directory, "state"),
    LAUNCHLANE_WORKSPACE_ROOT: workspaceConfigured ? workspace : "",
    LAUNCHLANE_ENABLE_MUTATIONS: "false",
    LAUNCHLANE_ENABLE_LIVE_MODEL: "false",
    LAUNCHLANE_ENABLE_LOCAL_REPAIR: "false",
    LAUNCHLANE_ENABLE_LIVE_LIARA: "false",
    LAUNCHLANE_PROBE_ORIGINS: "",
    LAUNCHLANE_APP_ALLOWLIST: app,
    LIARA_TEAM_ID: teamId,
    LIARA_API_BASE_URL: "https://api.liara.ir",
    LIARA_API_TOKEN: "",
    MODEL_BASE_URL: "https://ai.boxapi.ir/ai/v1",
    MODEL_API_KEY: "",
    MODEL_ID: "",
    NODE_OPTIONS: "",
    ...(agentFixture?{
      LAUNCHLANE_ENABLE_LIVE_MODEL:"true",LAUNCHLANE_ENABLE_LOCAL_REPAIR:"true",
      MODEL_ID:"gpt-6-luna",MODEL_API_KEY:"synthetic-model-key-for-isolated-test-only",
      LAUNCHLANE_AGENT_FIXTURE_LOG:join(directory,"model.jsonl"),
      NODE_OPTIONS:`--import=${pathToFileURL(resolve("tests/helpers/agent-model-hook.mjs")).href}`,
    }:{}),
    ...(environmentFixture ? { LAUNCHLANE_ENABLE_MUTATIONS: "true", LAUNCHLANE_ENABLE_LIVE_LIARA: "true", LAUNCHLANE_ENVIRONMENT_FIXTURE: "true" } : {}),
    LAUNCHLANE_ACTIVATION_FIXTURE: activationFixture ? "true" : "false",
    LAUNCHLANE_ACTIVATION_FAILURE_MARKER: activationFixture ? join(directory, "activation-uncertain.fixture") : "",
    ...(destinationFixture ? { LAUNCHLANE_ENABLE_MUTATIONS: "true", LAUNCHLANE_ENABLE_LIVE_LIARA: "true", LAUNCHLANE_DESTINATION_FIXTURE: "true" } : {}),
    ...(authFixture ? { LAUNCHLANE_AUTH_MODE: "liara", NODE_OPTIONS: `--import=${pathToFileURL(resolve("tests/helpers/liara-auth-hook.mjs")).href}` } : {}),
    ...(staticFixture ? { LAUNCHLANE_ENABLE_MUTATIONS: "true", LAUNCHLANE_ENABLE_LIVE_MODEL: "true", LAUNCHLANE_ENABLE_LIVE_LIARA: "true",
      MODEL_ID: "gpt-6-luna", MODEL_API_KEY: "synthetic-static-fixture-key", NODE_OPTIONS: `--import=${pathToFileURL(resolve("tests/helpers/static-publication-hook.mjs")).href}` } : {}),
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
  let output = "", lastHealth = "not requested";
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
  const startupDeadline = Date.now() + 45_000;
  for (let attempt = 0; attempt < 100 && Date.now() < startupDeadline; attempt++) {
    if (child.exitCode !== null) {
      await close();
      throw new Error(`Isolated server failed: ${output.replaceAll(token, "[REDACTED]")}`);
    }
    try {
      // Cold route loading under concurrent Windows workloads measured over two seconds.
      // This bounds test-server readiness only; workload verification keeps its own contract.
      const response = await fetch(`${backendOrigin}/api/health`, { signal: AbortSignal.timeout(3000) });
      lastHealth = `HTTP ${response.status}`;
      if (response.ok)
        return {
          origin,
          backendOrigin,
          token,
          teamId,
          app,
          workspace,
          stateDir: env.LAUNCHLANE_STATE_DIR,
          sessionSecret: env.LAUNCHLANE_SESSION_SECRET,
          modelLog:agentFixture?env.LAUNCHLANE_AGENT_FIXTURE_LOG:null,
          activationFailureMarker: activationFixture ? env.LAUNCHLANE_ACTIVATION_FAILURE_MARKER : null,
          close,
        };
    } catch (error) {
      lastHealth = `${error.name}:${error.cause?.code ?? error.message}`;
      /* Wait for this local server only; never contact an external provider. */
    }
    await pause(100);
  }
  await close();
  throw new Error(`Isolated production server did not become available (${lastHealth}): ${output.replaceAll(token, "[REDACTED]")}`);
}
