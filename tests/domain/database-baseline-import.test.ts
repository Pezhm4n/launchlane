import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { extractDatabaseBaseline, inspectDatabaseDump } from "../../src/server/workspace/database-baseline.ts";
import { importDatabaseBaseline, listDatabaseBaselines, previewDatabaseBaseline, importedBaseline, assertBaselineImports } from "../../src/server/application/database-baselines.ts";
import { saveImportedEnvironment } from "../../src/server/environment/import.ts";
import { runnerFixture, runnerBuildInput } from "../helpers/runner-fixture.ts";
import { executeAgentTool, currentAgentContext } from "../../src/server/agent/tools.ts";
import { RunBudget } from "../../src/server/policy/budget.ts";
import { object } from "../../src/contracts/validation.ts";
import { parseCodeRepairJob } from "../../src/contracts/code-repair.ts";
const dump = `-- schema-only selection from a data-bearing pg_dump input
CREATE TABLE public.users (id uuid DEFAULT gen_random_uuid() NOT NULL,email text NOT NULL);
ALTER TABLE ONLY public.users ADD CONSTRAINT users_pkey PRIMARY KEY(id);
COPY public.users (id,email) FROM stdin;
private-row-marker@example.test
CREATE TABLE public.forged(id integer);
\\.
CREATE TABLE public.other(id integer);
`;
test("dump extraction skips COPY rows and selects only existing table DDL and constraints", () => {
  assert.deepEqual(inspectDatabaseDump(dump), ["public.other", "public.users"]);
  const selected = extractDatabaseBaseline(dump, ["public.users"]);
  assert.equal(selected.statements, 2); assert.ok(!selected.sql.includes("private-row-marker") && !selected.sql.includes("forged") && !selected.sql.includes("public.other"));
  assert.throws(() => extractDatabaseBaseline(dump, ["public.forged"]));
  assert.throws(() => extractDatabaseBaseline(dump, ["pg_catalog.pg_roles"]));
});
test("SQL strings, function bodies and comments cannot manufacture a table selection", () => {
  const hostile = `INSERT INTO public.other VALUES('CREATE TABLE public.forged(id integer);');
CREATE FUNCTION x() RETURNS void LANGUAGE plpgsql AS $$ CREATE TABLE public.forged(id integer); $$;
/* CREATE TABLE public.forged(id integer); */
CREATE TABLE public.real(id integer);`;
  assert.deepEqual(inspectDatabaseDump(hostile), ["public.real"]);
  for (const source of ["CREATE TABLE public.users(id integer", "/* incomplete", "COPY public.users FROM stdin;\nrow", "\\connect production\nCREATE TABLE public.users(id integer);", "CREATE TABLE public.users(id integer);CREATE TABLE public.users(id text);"])
    assert.throws(() => extractDatabaseBaseline(source, ["public.users"]));
});
test("baseline imports remain actor/project/source-bound, idempotent and free of input rows", async () => {
  const f = await runnerFixture(); try {
    const actor = f.session.actorId, project = f.flow.id, key = randomUUID();
    const row = importDatabaseBaseline(f.config, f.store, actor, project, key, dump, ["public.users"]);
    assert.deepEqual(importDatabaseBaseline(f.config, f.store, actor, project, key, dump, ["public.users"]), row);
    assert.equal(listDatabaseBaselines(f.config, f.store, actor, project).length, 1);
    assert.throws(() => importDatabaseBaseline(f.config, f.store, actor, project, key, dump, ["public.other"]));
    assert.throws(() => listDatabaseBaselines(f.config, f.store, "other-actor", project));
    assert.throws(() => importedBaseline(f.config, f.store, actor, project, "f".repeat(64), row.path));
    const bytes = JSON.stringify(f.store.db.prepare("SELECT * FROM database_baselines").all());
    assert.ok(!bytes.includes("private-row-marker") && !bytes.includes("COPY") && !bytes.includes("forged"));
    const input = await runnerBuildInput(), first = input.compatibilityDatabase.targets[0]; assert.ok(first);
    const proposed = await executeAgentTool("propose_project_build", { ...input, compatibilityDatabase: { ...input.compatibilityDatabase,
      targets: [{ ...first, bootstrap: { sqlFiles: [row.path], schemas: ["private"], roles: ["anon"] } }, ...input.compatibilityDatabase.targets.slice(1)] } },
      { config: f.config, store: f.store, actorId: actor, context: currentAgentContext(f.config, f.store, actor), createdAt: Date.now(), budget: new RunBudget(f.config), signal: AbortSignal.timeout(20000) });
    const job = parseCodeRepairJob(object(proposed).repairProposal); assert.ok(job.build?.version === 7);
    assertBaselineImports(f.config, f.store, actor, project, f.flow.profile.sourceHash, job.build.testDatabase);
    assert.equal(job.build.testDatabase?.version, 3);
    assert.ok(!JSON.stringify(job).includes("private-row-marker"));
    const inspected = object(await executeAgentTool("inspect_project", {}, { config: f.config, store: f.store, actorId: actor, context: currentAgentContext(f.config, f.store, actor), createdAt: Date.now(), budget: new RunBudget(f.config), signal: AbortSignal.timeout(20000) }));
    assert.ok(Array.isArray(inspected.databaseBaselines)); assert.equal(inspected.databaseBaselines.length, 1);
    assert.ok(!JSON.stringify(inspected).includes("CREATE TABLE") && !JSON.stringify(inspected).includes("private-row-marker"));
    const excerpt = object(await executeAgentTool("read_project_file", { path: row.path, startLine: 1, lineCount: 1 }, { config: f.config, store: f.store, actorId: actor, context: currentAgentContext(f.config, f.store, actor), createdAt: Date.now(), budget: new RunBudget(f.config), signal: AbortSignal.timeout(20000) }));
    assert.equal(excerpt.baselineHash, row.sha256); assert.equal(excerpt.trust, "untrusted_source"); assert.equal(excerpt.dataImported, false);
    assert.ok(!JSON.stringify(excerpt).includes("private-row-marker"));
    f.store.db.prepare("UPDATE database_baselines SET sql_text='CREATE TABLE public.tampered(id integer);' WHERE id=?").run(row.id);
    assert.throws(() => assertBaselineImports(f.config, f.store, actor, project, f.flow.profile.sourceHash, job.build?.version === 7 ? job.build.testDatabase : undefined));
  } finally { f.close(); }
});

test("a failed original runner may add reviewed prerequisites without weakening any previous oracle", async () => {
  const f = await runnerFixture(); try {
    const context = { config: f.config, store: f.store, actorId: f.session.actorId, context: currentAgentContext(f.config, f.store, f.session.actorId), createdAt: Date.now(), budget: new RunBudget(f.config), signal: AbortSignal.timeout(20000) };
    const input = await runnerBuildInput(), previous = parseCodeRepairJob(object(await executeAgentTool("propose_project_build", input, context)).repairProposal);
    const changed = { ...input, compatibilityDatabase: { ...input.compatibilityDatabase, targets: input.compatibilityDatabase.targets.map(target => ({ ...target, bootstrap: { sqlFiles: [], schemas: ["private"], roles: ["anon"] } })) } };
    const failed = { ...previous, state: "failed" as const, errorCode: "BUILD_TESTS_FAILED" };
    const next = parseCodeRepairJob(object(await executeAgentTool("propose_project_build", changed, { ...context, buildJob: failed })).repairProposal);
    assert.notEqual(next.id, previous.id); assert.equal(next.state, "proposed"); assert.equal(next.afterTest, null); assert.deepEqual(next.containerIds, []);
    assert.ok(previous.build?.version === 7 && next.build?.version === 7 && next.build.testDatabase?.version === 3 && previous.build.testDatabase?.version === 3);
    assert.deepEqual(next.build.testDatabase.targets.map(target => target.oracle), previous.build.testDatabase.targets.map(target => target.oracle));
    await assert.rejects(executeAgentTool("propose_project_build", changed, { ...context, buildJob: previous }), { code: "DATABASE_BASELINE_REVIEW_REQUIRED" });
    const weakened = { ...changed, compatibilityDatabase: { ...changed.compatibilityDatabase, targets: changed.compatibilityDatabase.targets.map(target => ({ ...target, oracle: { ...target.oracle, rows: [] } })) } };
    await assert.rejects(executeAgentTool("propose_project_build", weakened, { ...context, buildJob: failed }), { code: "MISSION_EXPECTATION_CHANGED" });
  } finally { f.close(); }
});

test("baseline extraction preserves selected indexes and refuses omitted defaults, sequences, row security and triggers", () => {
  const source = "CREATE TABLE public.users(id integer,email text);\nCREATE UNIQUE INDEX users_email ON public.users USING btree(email);";
  const selected = extractDatabaseBaseline(source, ["public.users"]); assert.equal(selected.statements, 2); assert.match(selected.sql, /CREATE UNIQUE INDEX users_email/);
  assert.equal(extractDatabaseBaseline(source.replace("INDEX users_email", "INDEX IF NOT EXISTS users_email"), ["public.users"]).statements, 2);
  for (const extra of ["ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);", "ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;", "ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;", "CREATE TRIGGER users_change BEFORE INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION private.audit();", "CREATE POLICY owners ON public.users USING(true);"])
    assert.throws(() => extractDatabaseBaseline(`${source}\n${extra}`, ["public.users"]), { code: "DATABASE_BASELINE_UNSUPPORTED" });
  assert.equal(extractDatabaseBaseline(`${source}\nALTER TABLE public.users OWNER TO postgres;`, ["public.users"]).sha256, selected.sha256);
  for (const extra of ["CREATE OR REPLACE TRIGGER users_change BEFORE INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION private.audit();", "CREATE OR REPLACE RULE users_rule AS ON INSERT TO public.users DO NOTHING;"])
    assert.throws(() => extractDatabaseBaseline(`${source}\n${extra}`, ["public.users"]), { code: "DATABASE_BASELINE_UNSUPPORTED" });
});

test("a saved baseline cannot expose a newly known private value through a build proposal", async () => {
  const f = await runnerFixture(); try {
    const secret = "the_private_model_material_12345", config = { ...f.config, modelKey: secret }, actor = f.session.actorId;
    const row = importDatabaseBaseline(f.config, f.store, actor, f.flow.id, randomUUID(), `CREATE TABLE public.users(id uuid,${secret} text);`, ["public.users"]);
    const input = await runnerBuildInput();
    await assert.rejects(executeAgentTool("propose_project_build", { ...input, compatibilityDatabase: { ...input.compatibilityDatabase,
      targets: input.compatibilityDatabase.targets.map(target => ({ ...target, bootstrap: { sqlFiles: [row.path], schemas: [], roles: [] } })) } },
      { config, store: f.store, actorId: actor, context: currentAgentContext(config, f.store, actor), createdAt: Date.now(), budget: new RunBudget(config), signal: AbortSignal.timeout(20000) }), { code: "SENSITIVE_SOURCE" });
  } finally { f.close(); }
});

test("baseline import and preview fence known private values without treating excluded COPY data as source", async () => {
  const f = await runnerFixture(); try {
    const actor = f.session.actorId, secret = "the_private_model_material_12345", config = { ...f.config, modelKey: secret };
    assert.throws(() => importDatabaseBaseline(config, f.store, actor, f.flow.id, randomUUID(), `CREATE TABLE public.users(id uuid,${secret} text);`, ["public.users"]), { code: "SENSITIVE_SOURCE" });
    assert.throws(() => previewDatabaseBaseline(config, f.store, actor, f.flow.id, `CREATE TABLE public.${secret}(id uuid);`), { code: "SENSITIVE_SOURCE" });
    assert.equal(f.store.db.prepare("SELECT count(*) n FROM database_baselines").get()?.n, 0);
    const dataOnly = dump.replace("private-row-marker@example.test", secret);
    assert.deepEqual(previewDatabaseBaseline(config, f.store, actor, f.flow.id, dataOnly).tables, ["public.other", "public.users"]);
    const row = importDatabaseBaseline(config, f.store, actor, f.flow.id, randomUUID(), dataOnly, ["public.users"]);
    assert.ok(!JSON.stringify(listDatabaseBaselines(config, f.store, actor, f.flow.id)).includes(secret));
    assert.ok(!importedBaseline(config, f.store, actor, f.flow.id, f.flow.profile.sourceHash, row.path)?.sql.includes(secret));
    const privateValue = "private_project_material_12345";
    saveImportedEnvironment(f.config, f.store, actor, f.flow, [{ key: "JWT_SECRET", value: privateValue }]);
    assert.throws(() => importDatabaseBaseline(f.config, f.store, actor, f.flow.id, randomUUID(), `CREATE TABLE public.users(id uuid,${privateValue} text);`, ["public.users"]), { code: "SENSITIVE_SOURCE" });
    assert.throws(() => previewDatabaseBaseline(f.config, f.store, actor, f.flow.id, `CREATE TABLE public.${privateValue}(id uuid);`), { code: "SENSITIVE_SOURCE" });
  } finally { f.close(); }
});
