import { randomBytes } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

const path = resolve(".env.local"),
  accessPath = resolve(".local/operator-access.txt");
for (const candidate of [path, resolve(".local"), accessPath]) {
  if (existsSync(candidate) && lstatSync(candidate).isSymbolicLink())
    throw new Error("Refusing a linked configuration or access file.");
}
let source = existsSync(path) ? readFileSync(path, "utf8") : "";
const values = parseEnv(source);
function setMissing(key, value) {
  if (values[key]) return;
  const line = `${key}=${JSON.stringify(value)}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  source = pattern.test(source)
    ? source.replace(pattern, line)
    : `${source.replace(/\s*$/, "")}\n${line}\n`;
  values[key] = value;
}
setMissing("LAUNCHLANE_OPERATOR_TOKEN", randomBytes(32).toString("base64url"));
setMissing("LAUNCHLANE_SESSION_SECRET", randomBytes(48).toString("base64url"));
setMissing("LAUNCHLANE_ORIGIN", "http://127.0.0.1:3000");
setMissing("LAUNCHLANE_WORKSPACE_ROOT", process.cwd().replaceAll("\\", "/"));
setMissing("LAUNCHLANE_STATE_DIR", ".data");
setMissing("LAUNCHLANE_ENABLE_MUTATIONS", "false");
setMissing("LAUNCHLANE_ENABLE_LIVE_MODEL", "false");
mkdirSync(resolve(".local"), { recursive: true, mode: 0o700 });
writeFileSync(path, source, { mode: 0o600 });
writeFileSync(
  accessPath,
  `Launchlane local operator access\n\n${values.LAUNCHLANE_OPERATOR_TOKEN}\n\nKeep this file private. It is not a Liara or model credential. Restart the local server after setup.\n`,
  { mode: 0o600 },
);
console.info(
  "Local setup complete. Open .local/operator-access.txt locally for the login key. No provider was contacted. Restart the server.",
);
