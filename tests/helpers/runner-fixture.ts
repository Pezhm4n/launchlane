import { cp, mkdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { agentFixture } from "./agent-fixture.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";

export async function runnerBuildInput(seedless = false) {
  const checksum = createHash("sha256").update(await readFile(resolve("tests/fixtures/postgres-runner/001_entries.sql"))).digest("hex");
  return { path: "/", status: 200, assertion: { kind: "text", contains: "Runner lifecycle" },
    apiChecks: seedless ? ["auth", "profile"].map(target => ({ path: `/api/ready/${target}`, status: 200, assertions: [{ pointer: ["connected"], equals: true }] })) : [{ path: "/api/entry/auth", status: 200, assertions: [{ pointer: ["label"], equals: "identity datum" }] }, { path: "/api/entry/profile", status: 200, assertions: [{ pointer: ["label"], equals: "profile datum" }] }],
    compatibilityDatabase: { runnerScript: "db:migrate", targets: [
      { id: "auth", environmentKeys: ["AUTH_DB_URL"], label: "identity datum" }, { id: "profile", environmentKeys: ["PROFILE_DB_URL"], label: "profile datum" },
    ].map(target => ({ id: target.id, environmentKeys: target.environmentKeys, requiredRelations: seedless ? ["public.Records"] : ["public.entries", "public.schema_migrations"], oracle: {
      columns: [{ relation: "public.entries", name: "id", type: "integer", nullable: false }, { relation: "public.entries", name: "label", type: "text", nullable: false }, { relation: "public.entries", name: "note", type: "text", nullable: true }, { relation: "public.schema_migrations", name: "version", type: "text", nullable: false }, { relation: "public.schema_migrations", name: "checksum", type: "text", nullable: false }].filter(column => !seedless || column.relation === "public.entries").map(column => seedless ? { ...column, relation: "public.Records", name: column.name === "note" ? "noteValue" : column.name } : column),
      rows: seedless ? [] : [{ relation: "public.entries", key: { column: "id", value: 7 }, values: [{ column: "label", value: target.label }] }, { relation: "public.schema_migrations", key: { column: "version", value: "001_entries.sql" }, values: [{ column: "checksum", value: checksum }] }],
      persistence: [{ relation: seedless ? "public.Records" : "public.entries", key: { column: "id", value: 7 }, column: seedless ? "noteValue" : "note" }],
    } })) } };
}
export async function runnerFixture(seedless = false) {
  const f = await agentFixture(); try {
    const project = join(f.workspace, "runner-service"); await mkdir(project); await cp(resolve("tests/fixtures/postgres-runner"), project, { recursive: true });
    if (seedless) await cp(resolve("tests/fixtures/postgres-runner-empty"), project, { recursive: true });
    const config = { ...f.config, enableLocalRepair: true }, flow = await prepareProjectFlow(config, f.store, f.session.actorId, { kind: "local", directory: "runner-service" }, AbortSignal.timeout(10000));
    return { ...f, project, config, flow };
  } catch (error) { f.close(); throw error; }
}
