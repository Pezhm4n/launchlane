import { cp, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { agentFixture } from "./agent-fixture.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";

export const migrationBuildInput = {
  path: "/", status: 200, assertion: { kind: "text", contains: "Migration lifecycle" },
  apiChecks: [{ path: "/api/entry", status: 200, assertions: [{ pointer: ["id"], equals: 7 }, { pointer: ["label"], equals: "original datum" }] }],
  compatibilityDatabase: { environmentKeys: ["DATABASE_URL"], requiredRelations: ["public.entries"], migration: {
    sqlFiles: ["001_entries.sql"], columns: [
      { relation: "public.entries", name: "id", type: "integer", nullable: false },
      { relation: "public.entries", name: "label", type: "text", nullable: false },
      { relation: "public.entries", name: "note", type: "text", nullable: true },
    ], rows: [{ relation: "public.entries", key: { column: "id", value: 7 }, values: [{ column: "label", value: "original datum" }] }],
    persistence: [{ relation: "public.entries", key: { column: "id", value: 7 }, column: "note" }],
  } },
};
export async function migrationFixture() {
  const f = await agentFixture();
  try {
    const project = join(f.workspace, "migration-service"); await mkdir(project);
    await cp(resolve("tests/fixtures/postgres-migration"), project, { recursive: true });
    const config = { ...f.config, enableLocalRepair: true };
    const flow = await prepareProjectFlow(config, f.store, f.session.actorId, { kind: "local", directory: "migration-service" }, AbortSignal.timeout(10000));
    return { ...f, project, config, flow };
  } catch (error) { f.close(); throw error; }
}
