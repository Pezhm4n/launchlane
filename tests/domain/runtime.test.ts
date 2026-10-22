import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { readConfig } from "../../src/server/config.ts";
import { AppError } from "../../src/server/errors.ts";
import { migrations } from "../../src/server/persistence/migrations.ts";
import { resolveRuntime } from "../../src/server/runtime.ts";

test("a real process startup upgrades a v6 database without losing sessions or rewriting applied checksums", () => {
  const directory = mkdtempSync(join(tmpdir(), "launchlane-runtime-"));
  const path = join(directory, "state.sqlite"),
    legacy = new DatabaseSync(path);
  legacy.exec(
    "CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, checksum TEXT NOT NULL) STRICT",
  );
  for (const migration of migrations.filter((row) => row.version <= 6)) {
    legacy.exec(migration.sql);
    legacy
      .prepare("INSERT INTO schema_migrations VALUES (?,?)")
      .run(migration.version, createHash("sha256").update(migration.sql).digest("hex"));
  }
  legacy
    .prepare("INSERT INTO sessions VALUES (?,?,?)")
    .run("preserved-session", "actor", Date.now() + 600_000);
  const before = legacy.prepare("SELECT * FROM schema_migrations ORDER BY version").all();
  legacy.close();
  const runtime = resolveRuntime(readConfig({ LAUNCHLANE_STATE_DIR: directory }));
  try {
    assert.deepEqual(
      runtime.store.db
        .prepare("SELECT * FROM schema_migrations WHERE version<=6 ORDER BY version")
        .all(),
      before,
    );
    assert.ok(
      runtime.store.db.prepare("SELECT 1 FROM sqlite_master WHERE name='restart_progress'").get(),
    );
    assert.equal(runtime.store.sessionExists("preserved-session", "actor", Date.now()), true);
  } finally {
    runtime.store.close();
    rmSync(directory, { recursive: true });
  }
});

test("HMR refuses an old runtime contract without reopening, recovering or discarding durable state; refreshed gates do not reuse stale config", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "launchlane-runtime-"));
  const config = readConfig({
    LAUNCHLANE_STATE_DIR: directory,
    LAUNCHLANE_ENABLE_LIVE_MODEL: "true",
  });
  const runtime = resolveRuntime(config);
  try {
    const recovery = t.mock.method(runtime.store, "recoverInterrupted");
    runtime.store.saveSession({
      id: "retained",
      actorId: "actor",
      csrfToken: "test",
      expiresAt: Date.now() + 600_000,
    });
    for (const cached of [
      { ...runtime, schemaKey: "pre-upgrade" },
      { config: runtime.config, store: runtime.store },
    ]) {
      assert.throws(
        () => resolveRuntime(config, cached),
        (error: unknown) => error instanceof AppError && error.code === "RUNTIME_RESTART_REQUIRED",
      );
    }
    assert.throws(
      () => resolveRuntime({ ...config, stateDir: join(directory, "different") }, runtime),
      (error: unknown) => error instanceof AppError && error.code === "RUNTIME_RESTART_REQUIRED",
    );
    const fresh = resolveRuntime({ ...config, enableLiveModel: false }, runtime);
    assert.equal(fresh.config.enableLiveModel, false);
    assert.equal(fresh.store, runtime.store);
    assert.equal(fresh.store.sessionExists("retained", "actor", Date.now()), true);
    assert.equal(recovery.mock.callCount(), 0);
  } finally {
    runtime.store.close();
    rmSync(directory, { recursive: true });
  }
});
