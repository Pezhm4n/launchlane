import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { Store } from "../../src/server/persistence/store.ts";
import { migrations } from "../../src/server/persistence/migrations.ts";
import { AgentRepository } from "../../src/server/agent/store.ts";

test("existing database request index appends migration 21 while preserving migrations 1-20 and sessions", () => {
  const root = mkdtempSync(join(tmpdir(), "launchlane-existing-database-migrate-")), path = join(root, "state.sqlite"), legacy = new DatabaseSync(path);
  legacy.exec("CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, checksum TEXT NOT NULL) STRICT");
  for (const migration of migrations.filter(m => m.version <= 20)) { legacy.exec(migration.sql); legacy.prepare("INSERT INTO schema_migrations VALUES(?,?)").run(migration.version, createHash("sha256").update(migration.sql).digest("hex")); }
  legacy.prepare("INSERT INTO sessions VALUES(?,?,?)").run("existing-database-session", "actor", Date.now() + 600000);
  const before = legacy.prepare("SELECT * FROM schema_migrations ORDER BY version").all(); legacy.close(); const upgraded = new Store(path);
  try {
    assert.deepEqual(upgraded.db.prepare("SELECT * FROM schema_migrations WHERE version<=20 ORDER BY version").all(), before);
    assert.equal(upgraded.sessionExists("existing-database-session", "actor", Date.now()), true);
    assert.ok(upgraded.db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='database_resource_request_keys'").get());
    const insert = upgraded.db.prepare("INSERT INTO actions(id,actor_id,spec,hash,state,team_id,app,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?)");
    insert.run("create", "actor", JSON.stringify({ version: 28, requestKey: "shared-request" }), "hash", "awaiting_approval", "team", "app", 0, 100);
    assert.throws(() => insert.run("attach", "actor", JSON.stringify({ version: 29, requestKey: "shared-request" }), "hash", "awaiting_approval", "team", "app", 0, 100), /UNIQUE/);
  } finally { upgraded.close(); const target = resolve(root); assert.ok(target.startsWith(join(tmpdir(), "launchlane-existing-database-migrate-"))); rmSync(target, { recursive: true, force: true }); }
});

test("bound database request index appends migration 20 without changing the first nineteen checksums or sessions", () => {
  const root = mkdtempSync(join(tmpdir(), "launchlane-bound-database-migrate-")), path = join(root, "state.sqlite"), legacy = new DatabaseSync(path);
  legacy.exec("CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, checksum TEXT NOT NULL) STRICT");
  for (const migration of migrations.filter(m => m.version <= 19)) { legacy.exec(migration.sql); legacy.prepare("INSERT INTO schema_migrations VALUES(?,?)").run(migration.version, createHash("sha256").update(migration.sql).digest("hex")); }
  legacy.prepare("INSERT INTO sessions VALUES(?,?,?)").run("prior-database-session", "actor", Date.now() + 600000);
  const before = legacy.prepare("SELECT * FROM schema_migrations ORDER BY version").all(); legacy.close(); const upgraded = new Store(path);
  try {
    assert.deepEqual(upgraded.db.prepare("SELECT * FROM schema_migrations WHERE version<=19 ORDER BY version").all(), before);
    assert.equal(upgraded.sessionExists("prior-database-session", "actor", Date.now()), true);
    assert.ok(upgraded.db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='database_bound_request_keys'").get());
    assert.equal(upgraded.db.prepare("SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1").get()?.version, migrations.at(-1)?.version);
  } finally { upgraded.close(); const target = resolve(root); assert.ok(target.startsWith(join(tmpdir(), "launchlane-bound-database-migrate-"))); rmSync(target, { recursive: true, force: true }); }
});

test("provision journal appends migration 9 without changing versions 1-8, sessions or stored agent context", () => {
  const root = mkdtempSync(join(tmpdir(), "launchlane-provision-migrate-")), path = join(root, "state.sqlite"), legacy = new DatabaseSync(path);
  legacy.exec("CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, checksum TEXT NOT NULL) STRICT");
  for (const migration of migrations.filter((m) => m.version <= 8)) {
    legacy.exec(migration.sql);
    legacy.prepare("INSERT INTO schema_migrations VALUES(?,?)").run(migration.version, createHash("sha256").update(migration.sql).digest("hex"));
  }
  legacy.prepare("INSERT INTO sessions VALUES(?,?,?)").run("old-session", "actor", Date.now() + 600000);
  const runId = "11111111-2222-4333-8444-555555555555", now = Date.now();
  const data = JSON.stringify({ id: runId, requestKey: "old-key", lastInputKey: "old-key", lastInput: "بررسی پروژه", revision: 1,
    projectId: null, state: "partially_completed", events: [], nextAction: "reply", question: null, effect: "no_remote_changes",
    repair: null, repairDecision: null, publication: null, context: { projectId: null, sourceHash: null, selectionHash: null, target: null },
    messages: [{ role: "user", content: "بررسی پروژه" }], limits: { maxModelCalls: 8, maxToolCalls: 12, runTimeoutMs: 120000 },
    usage: { modelCalls: 0, toolCalls: 0, observedTokens: 0, unknownModelCalls: 0, elapsedMs: 0 }, errorCode: null, createdAt: now, updatedAt: now });
  legacy.prepare("INSERT INTO agent_runs VALUES(?,?,?,?,?,?,?)").run(runId, "actor", "old-key", 1, "partially_completed", now, data);
  const before = legacy.prepare("SELECT * FROM schema_migrations ORDER BY version").all();
  legacy.close();
  const upgraded = new Store(path);
  try {
    assert.deepEqual(upgraded.db.prepare("SELECT * FROM schema_migrations WHERE version<=8 ORDER BY version").all(), before);
    assert.ok(upgraded.db.prepare("SELECT version FROM schema_migrations WHERE version=9").get());
    assert.equal(upgraded.db.prepare("SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1").get()?.version, migrations.at(-1)?.version);
    assert.equal(upgraded.db.prepare("SELECT COUNT(*) n FROM provision_progress").get()?.n, 0);
    assert.equal(upgraded.sessionExists("old-session", "actor", Date.now()), true);
    assert.equal(upgraded.db.prepare("SELECT data_json FROM agent_runs WHERE id=?").get(runId)?.data_json, data);
    assert.equal(new AgentRepository(upgraded).get("actor", runId)?.context.account, null);
  } finally {
    upgraded.close();
    const target = resolve(root); assert.ok(target.startsWith(join(tmpdir(), "launchlane-provision-migrate-")));
    rmSync(target, { recursive: true, force: true });
  }
});
