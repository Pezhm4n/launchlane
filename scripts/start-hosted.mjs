import { execFileSync, spawn } from "node:child_process";
import { isAbsolute, resolve } from "node:path";
import { readConfig } from "../src/server/config.ts";
import { openModelBudget } from "./model-budget.mjs";
import { projectBuildImage, node24BuildImage, pythonBuildImage } from "../src/contracts/project-build.ts";

const config = readConfig();
const [major, minor] = process.versions.node.split(".").map(Number);
if (major !== 24 || minor < 15) throw Error("Hosted startup requires Node 24.15+ within 24.x.");
if (config.authMode !== "liara" || !config.authConfigured || !config.origin.startsWith("https:") || !process.env.LAUNCHLANE_STATE_DIR || !isAbsolute(process.env.LAUNCHLANE_STATE_DIR))
  throw Error("Hosted startup needs LAUNCHLANE_AUTH_MODE=liara, a fixed HTTPS LAUNCHLANE_ORIGIN, LAUNCHLANE_SESSION_SECRET and an absolute persistent LAUNCHLANE_STATE_DIR. See docs/hosted-access.md.");
if (config.enableLocalRepair) {
  const options = { encoding: "utf8", timeout: 15000, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] };
  if (execFileSync("docker", ["info", "--format", "{{.OSType}}"], options).trim() !== "linux")
    throw Error("Hosted build/repair requires the private Linux Docker engine.");
  for (const image of [projectBuildImage, node24BuildImage, pythonBuildImage])
    execFileSync("docker", ["image", "inspect", image, "--format", "{{.Id}}"], options);
}
const imports = [];
if (config.enableLiveModel) {
  const guard = openModelBudget(process.env.LAUNCHLANE_MODEL_LEDGER_PATH ?? "", process.env.LAUNCHLANE_MODEL_LEDGER_PHASE ?? "");
  guard.close();
  imports.push("--import", resolve("scripts/model-budget.mjs"));
}
const entry = process.argv.includes("--standalone") ? [resolve("server.js")] : [resolve("node_modules/next/dist/bin/next"), "start", "--hostname", "0.0.0.0"];
const child = spawn(process.execPath, [...imports, ...entry], {
  stdio: "inherit", windowsHide: true,
  env: { ...process.env, HOSTNAME: "0.0.0.0", LAUNCHLANE_MODEL_BUDGET_GUARD: config.enableLiveModel ? "true" : "false" },
});
process.on("SIGTERM", () => child.kill("SIGTERM"));
process.on("SIGINT", () => child.kill("SIGINT"));
child.on("error", () => { process.exitCode = 1; });
child.on("exit", code => { process.exitCode = code ?? 1; });
