import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { readConfig, type Config } from "./config.ts";
import { Store, storageError } from "./persistence/store.ts";

type Runtime = { config: Config; store: Store };
// One operator-local process; keep the DB connection across Next development reloads.
const globalState = globalThis as typeof globalThis & { launchlaneRuntime?: Runtime };

export function getRuntime(): Runtime {
  const config = readConfig();
  if (globalState.launchlaneRuntime) return globalState.launchlaneRuntime;
  try {
    mkdirSync(config.stateDir, { recursive: true, mode: 0o700 });
    const store = new Store(join(config.stateDir, "state.sqlite"));
    store.recoverInterrupted();
    const runtime = { config, store };
    globalState.launchlaneRuntime = runtime;
    return runtime;
  } catch (error) {
    throw storageError(error);
  }
}
