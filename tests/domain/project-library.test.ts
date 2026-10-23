import assert from "node:assert/strict";
import { test } from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { agentFixture } from "../helpers/agent-fixture.ts";
import { prepareProjectFlow } from "../../src/server/application/project-flows.ts";
import { listProjects, openLibraryProject } from "../../src/server/application/project-library.ts";
import { parseProjectLibrary } from "../../src/contracts/project-library.ts";
import { AppError } from "../../src/server/errors.ts";
import { sealCredential } from "../../src/server/connections/credentials.ts";

const code = (expected: string) => (error: unknown) => error instanceof AppError && error.code === expected;
test("project library isolates actors and opens the original snapshot without creating runs, actions, artifacts or renewing budgets", async () => {
  const f = await agentFixture(), actor = f.session.actorId;
  try {
    const second = await prepareProjectFlow(f.config, f.store, actor, { kind: "local", directory: "service" }, AbortSignal.timeout(5000));
    const before = ["project_flows", "actions", "agent_runs", "source_artifacts"].map(table => f.store.db.prepare(`SELECT count(*) n FROM ${table}`).get()?.n);
    const result = parseProjectLibrary(listProjects(f.config, f.store, actor));
    assert.equal(result.projects.length, 2); assert.equal(result.projects[0]?.id, second.id); assert.equal(result.projects[0]?.active, true);
    assert.deepEqual(listProjects(f.config, f.store, "another-actor").projects, []);
    await assert.rejects(openLibraryProject(f.config, f.store, "another-actor", f.flow.id, AbortSignal.timeout(5000)), code("NOT_FOUND"));
    const opened = await openLibraryProject(f.config, f.store, actor, f.flow.id, AbortSignal.timeout(5000));
    assert.equal(opened.id, f.flow.id); assert.equal(f.store.getProjectFlow(actor)?.id, f.flow.id);
    await openLibraryProject(f.config, f.store, actor, f.flow.id, AbortSignal.timeout(5000));
    assert.deepEqual(["project_flows", "actions", "agent_runs", "source_artifacts"].map(table => f.store.db.prepare(`SELECT count(*) n FROM ${table}`).get()?.n), before);
    assert.equal(listProjects(f.config, f.store, actor).projects.find(row => row.id === f.flow.id)?.active, true);
  } finally { f.close(); }
});
test("opening a changed historical source fails without changing the active project", async () => {
  const f = await agentFixture(), actor = f.session.actorId;
  try {
    const second = await prepareProjectFlow(f.config, f.store, actor, { kind: "local", directory: "service" }, AbortSignal.timeout(5000));
    writeFileSync(join(f.project, "server.mjs"), "console.log('changed');");
    await assert.rejects(openLibraryProject(f.config, f.store, actor, f.flow.id, AbortSignal.timeout(5000)), code("PROJECT_CHANGED"));
    assert.equal(f.store.getProjectFlow(actor)?.id, second.id);
  } finally { f.close(); }
});
test("switching projects preserves history but invalidates unused decisions; uncertain actions block switching", async () => {
  const f = await agentFixture(), actor = f.session.actorId;
  try {
    const second = await prepareProjectFlow(f.config, f.store, actor, { kind: "local", directory: "service" }, AbortSignal.timeout(5000));
    assert.ok(second.artifact);
    f.store.saveConnection(actor, { source: "token", ciphertext: sealCredential("fixture-credential", f.config.sessionSecret, actor, "liara"), view: { provider: "liara", status: "connected", identityId: "b".repeat(24), teamId: "a".repeat(24), teamName: "test", displayName: "test", login: "test@example.test", checkedAt: Date.now(), selectedApp: "app", apps: [{ name: "app", id: "c".repeat(24), platform: "node" }] } });
    const action = f.store.createAction(actor, { version: 3, operation: "deploy", scope: { teamId: "a".repeat(24), app: "app" },
      projectFlowId: second.id, selectionHash: second.selectionHash, sourceHash: second.profile.sourceHash, artifactHash: second.artifact.archiveHash, args: { port: 3000, planId: null } });
    f.store.db.prepare("UPDATE actions SET state='uncertain' WHERE id=?").run(action.id);
    await assert.rejects(openLibraryProject(f.config, f.store, actor, f.flow.id, AbortSignal.timeout(5000)), code("UNRESOLVED_EFFECT"));
    assert.equal(f.store.getProjectFlow(actor)?.id, second.id);
    f.store.db.prepare("UPDATE actions SET state='awaiting_approval' WHERE id=?").run(action.id);
    await openLibraryProject(f.config, f.store, actor, f.flow.id, AbortSignal.timeout(5000));
    assert.equal(f.store.getAction(action.id, actor).state, "cancelled");
    assert.ok(f.store.getProjectFlow(actor, second.id));
  } finally { f.close(); }
});
