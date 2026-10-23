import { spawn } from "node:child_process";
import { isAbsolute, resolve } from "node:path";
import { readConfig } from "../src/server/config.ts";

const config = readConfig();
if (config.authMode !== "liara" || !config.authConfigured || !config.origin.startsWith("https:") || !process.env.LAUNCHLANE_STATE_DIR || !isAbsolute(process.env.LAUNCHLANE_STATE_DIR))
  throw Error("Hosted startup needs LAUNCHLANE_AUTH_MODE=liara, a fixed HTTPS LAUNCHLANE_ORIGIN, LAUNCHLANE_SESSION_SECRET and an absolute persistent LAUNCHLANE_STATE_DIR. See docs/hosted-access.md.");
const child = spawn(process.execPath, [resolve("node_modules/next/dist/bin/next"), "start", "--hostname", "0.0.0.0"], { stdio: "inherit", windowsHide: true });
process.on("SIGTERM", () => child.kill("SIGTERM"));
process.on("SIGINT", () => child.kill("SIGINT"));
child.on("error", () => { process.exitCode = 1; });
child.on("exit", code => { process.exitCode = code ?? 1; });
