import { mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { readConfig, type Config } from "./config.ts";
import { Store, storageError } from "./persistence/store.ts";
import { migrations } from "./persistence/migrations.ts";
import { ensure } from "./errors.ts";

type CachedRuntime = { config: Config; store: Store; schemaKey?: string };
type Runtime = CachedRuntime & { schemaKey: string };
// Keep this stable across route bundles, but invalidate cached Store contracts when migrations change.
const schemaKey = createHash("sha256").update(JSON.stringify(migrations)).digest("hex");
const globalState = globalThis as typeof globalThis & { launchlaneRuntime?: CachedRuntime };

export function resolveRuntime(config: Config, cached?: CachedRuntime): Runtime {
  if (cached) {
    // HMR is not a process restart: reopening here could interrupt an in-flight operation or run recovery twice.
    ensure(
      cached.schemaKey === schemaKey && cached.config.stateDir === config.stateDir,
      "RUNTIME_RESTART_REQUIRED",
      "نسخه سرور یا محل ذخیره‌سازی تغییر کرده است. سرور محلی را متوقف و دوباره با npm run dev یا npm start اجرا کنید؛ داده‌ها را حذف نکنید.",
      503,
    );
    return { ...cached, config, schemaKey };
  }
  try {
    mkdirSync(config.stateDir, { recursive: true, mode: 0o700 });
    const store = new Store(join(config.stateDir, "state.sqlite"));
    store.recoverInterrupted();
    return { config, store, schemaKey };
  } catch (error) {
    throw storageError(error);
  }
}

export function getRuntime(): Runtime {
  const runtime = resolveRuntime(readConfig(), globalState.launchlaneRuntime);
  globalState.launchlaneRuntime = runtime;
  return runtime;
}
