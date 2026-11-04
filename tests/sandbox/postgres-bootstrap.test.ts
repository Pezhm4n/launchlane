import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { withPostgresFixture } from "../../src/server/agent/postgres-fixture.ts";

test("approved disposable bootstrap preserves independent ordinary target roles and protects admin identities", { timeout: 120000 }, async () => {
  await withPostgresFixture({ jobId: randomUUID(), sourceHash: "a".repeat(64), migration: true, targets: ["auth", "prof"], signal: AbortSignal.timeout(100000), onCreated() {} }, async (_binding, signal, sql) => {
    assert.ok(sql.bootstrap);
    const setup = { files: [], schemas: ["private"], roles: ["anon", "authenticated", "postgres"] };
    const auth = await sql.bootstrap("auth", setup, "CREATE TABLE public.users(id uuid PRIMARY KEY,email text NOT NULL);", signal);
    assert.equal(auth.exitCode, 0, auth.output);
    const prof = await sql.bootstrap("prof", { ...setup, schemas: [] }, "CREATE TABLE public.reviews(id integer PRIMARY KEY);", signal);
    assert.equal(prof.exitCode, 0, prof.output);
    const replaySchema = await sql.bootstrap("auth", { files: [], schemas: [], roles: ["anon"] }, "CREATE SCHEMA IF NOT EXISTS private;", signal);
    assert.equal(replaySchema.exitCode, 0, replaySchema.output);
    const deniedSchema = await sql.bootstrap("prof", { files: [], schemas: [], roles: ["anon"] }, "CREATE SCHEMA forbidden;", signal);
    assert.notEqual(deniedSchema.exitCode, 0);
    const roles = await sql.read("SELECT bool_and(NOT(rolsuper OR rolcreaterole OR rolcreatedb OR rolbypassrls OR rolcanlogin)) FROM pg_catalog.pg_roles WHERE rolname IN ('anon','authenticated','postgres');", signal, "auth");
    assert.equal(roles.output.trim(), "t");
    const isolation = await sql.read("SELECT to_regclass('public.users') IS NULL AND to_regclass('public.reviews') IS NOT NULL;", signal, "prof");
    assert.equal(isolation.output.trim(), "t");
    await assert.rejects(sql.bootstrap("other", setup, "", signal));
    await assert.rejects(sql.bootstrap("auth", { ...setup, roles: ["launchlane_fixture"] }, "", signal));
    const readOnly = await sql.read("INSERT INTO public.users VALUES(gen_random_uuid(),'fixture@example.test');", signal, "auth");
    assert.notEqual(readOnly.exitCode, 0);
  });
});
