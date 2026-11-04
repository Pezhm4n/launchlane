import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { parsePostgresBootstrap } from "../../src/contracts/postgres-bootstrap.ts";
import { baselineSource } from "../../src/server/agent/postgres-baseline.ts";

const content = Buffer.from("CREATE TABLE public.users(id uuid DEFAULT gen_random_uuid() NOT NULL,email text NOT NULL);\nALTER TABLE ONLY public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);");
const file = { path: "baseline/users.sql", content }, sha256 = createHash("sha256").update(content).digest("hex");
const setup = { files: [{ path: file.path, sha256 }], schemas: ["private"], roles: ["anon", "postgres"] };
test("a baseline binds exact source bytes and preserves schema DDL without data", () => {
  assert.equal(baselineSource([file], parsePostgresBootstrap(setup)), content.toString());
  assert.throws(() => baselineSource([{ ...file, content: Buffer.from("CREATE TABLE public.other(id integer);") }], setup));
  assert.throws(() => baselineSource([], setup));
  assert.throws(() => parsePostgresBootstrap({ ...setup, privileged: true }));
});
test("baseline metadata cannot name protected identities, duplicate files or inject SQL", () => {
  for (const role of ["launchlane_fixture", "launchlane_observer", "pg_read_all_data", "public", "information_schema", "x;GRANT", "Root"])
    assert.throws(() => parsePostgresBootstrap({ ...setup, roles: [role] }));
  for (const files of [[...setup.files, ...setup.files], [{ path: "../users.sql", sha256 }], [{ path: ".env", sha256 }]])
    assert.throws(() => parsePostgresBootstrap({ ...setup, files }));
});
test("data dumps, privilege changes and executable SQL cannot become source baselines", () => {
  for (const source of ["INSERT INTO public.users VALUES(1);", "COPY public.users FROM stdin;", "DO $$ BEGIN END $$;", "GRANT ALL ON public.users TO anon;", "CREATE TABLE public.x AS SELECT 1;", "DELETE FROM public.users;", "SELECT pg_read_file('/tmp/x');"]) {
    const content = Buffer.from(source), file = { path: "baseline.sql", content };
    assert.throws(() => baselineSource([file], { files: [{ path: file.path, sha256: createHash("sha256").update(content).digest("hex") }], schemas: [], roles: [] }));
  }
});
