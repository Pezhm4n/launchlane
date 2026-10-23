import { basename } from "node:path";
import type { ProjectFlow } from "../../contracts/project-flow.ts";
import type { ProjectSummary } from "../../contracts/project-library.ts";
import { string } from "../../contracts/validation.ts";
import { AgentRepository } from "../agent/store.ts";
import type { Config } from "../config.ts";
import type { Store } from "../persistence/store.ts";
import { AppError, ensure } from "../errors.ts";
import { inspectProject } from "../workspace/inspect.ts";
import { readArtifact } from "../workspace/archive.ts";
import { projectSecretValues } from "../environment/secrets.ts";
import { projectRoot } from "./project-flows.ts";

export function libraryProjectName(config: Config, flow: ProjectFlow): string {
  const source = flow.selection;
  return source.kind === "upload" ? source.name : source.kind === "repair" ? "نسخه اصلاح‌شده پروژه" : source.kind === "github"
    ? `${source.owner}/${source.name}${source.directory === "." ? "" : ` / ${source.directory}`}`
    : basename(source.directory === "." ? config.workspaceRoot || "پروژه" : source.directory);
}
function libraryTarget(store: Store, actorId: string, projectId: string) {
  let target = new AgentRepository(store).forProject(actorId, projectId, "publication")?.context.target ?? null;
  if (!target) {
    const row = store.db.prepare("SELECT id FROM actions WHERE actor_id=? AND json_extract(spec,'$.projectFlowId')=? AND json_extract(spec,'$.operation') IN ('deploy','create_app') ORDER BY rowid DESC LIMIT 1").get(actorId, projectId);
    const action = row ? store.getAction(string(row.id, 36), actorId) : null, connection = store.getConnection(actorId, "liara")?.view;
    if (action) {
      const spec = action.spec, id = "targetAppId" in spec ? spec.targetAppId : action.provision?.appId;
      if (connection && id && connection.teamId === spec.scope.teamId && connection.apps.some(app => app.id === id && app.name === spec.scope.app)) {
        target = { accountId: "accountId" in spec ? spec.accountId : connection.identityId, teamId: spec.scope.teamId, appId: id, app: spec.scope.app };
      }
    }
  }
  if (target && store.db.prepare("SELECT id FROM actions WHERE actor_id=? AND state='succeeded' AND json_extract(spec,'$.version')=14 AND json_extract(spec,'$.operation')='delete_app' AND json_extract(spec,'$.targetAppId')=? AND team_id=? LIMIT 1").get(actorId, target.appId, target.teamId)) return null;
  return target;
}
export function listProjects(config: Config, store: Store, actorId: string, offset = 0) {
  const rows = store.db.prepare("SELECT f.id FROM project_flows f WHERE f.actor_id=? AND NOT EXISTS (SELECT 1 FROM project_archives a WHERE a.project_id=f.id) ORDER BY f.updated_at DESC,f.rowid DESC LIMIT 21 OFFSET ?").all(actorId, offset);
  const active = store.getProjectFlow(actorId), repo = new AgentRepository(store);
  const projects = rows.slice(0, 20).map((row): ProjectSummary => {
    const flow = store.getProjectFlow(actorId, string(row.id, 36));
    ensure(flow, "NOT_FOUND", "پروژه پیدا نشد.", 404);
    const run = repo.forProject(actorId, flow.id, "publication");
    return { id: flow.id, name: libraryProjectName(config, flow), source: flow.selection.kind === "github" ? "GitHub" : flow.selection.kind === "upload" ? "از رایانه" : flow.selection.kind === "repair" ? "نسخه اصلاح‌شده" : "پوشهٔ این نصب",
      runtime: flow.profile.runtime, updatedAt: Math.max(flow.updatedAt, run?.updatedAt ?? 0), active: active?.id === flow.id,
      state: run?.state ?? flow.status, app: libraryTarget(store, actorId, flow.id)?.app ?? null, runId: run?.id ?? null, sourceHash: flow.profile.sourceHash, removal: store.projectRemoval(actorId, flow.id) };
  });
  return { projects, nextOffset: rows.length > 20 ? offset + 20 : null };
}
export async function openLibraryProject(config: Config, store: Store, actorId: string, id: string, signal: AbortSignal): Promise<ProjectFlow> {
  const flow = store.getProjectFlow(actorId, id);
  ensure(flow, "NOT_FOUND", "این پروژه پیدا نشد.", 404);
  ensure(!store.db.prepare("SELECT project_id FROM project_archives WHERE project_id=? AND actor_id=?").get(id, actorId), "PROJECT_ARCHIVED", "این پروژه از فهرست حذف شده است؛ پوشه را دوباره انتخاب کنید.", 409);
  if (store.getProjectFlow(actorId)?.id === flow.id) return { ...flow, displayName: libraryProjectName(config, flow) };
  store.assertAgentIdle(actorId, null, true);
  let current: ProjectFlow["profile"];
  try {
    const location = projectRoot(config, flow);
    current = await inspectProject(location.root, location.directory, { signal,
      secrets: [config.liaraToken, config.modelKey, config.operatorToken, config.sessionSecret, ...projectSecretValues(store, config.sessionSecret, actorId)].filter(Boolean) });
  } catch (error) {
    if (signal.aborted || !(error instanceof AppError) || !["FOLDER_NOT_FOUND", "SOURCE_CHANGED", "FOLDER_ACCESS_DENIED", "WORKSPACE_UNCONFIGURED", "FILESYSTEM_UNAVAILABLE"].includes(error.code)) throw error;
    // Missing source blocks publication, while the actor still needs its ID-bound destination controls.
    store.activateProjectFlow(actorId, id, libraryTarget(store, actorId, flow.id));
    const unavailable = store.staleProjectFlow(actorId, id, "فایل‌های این نسخه در دسترس نیستند. برای انتشار، پوشه را دوباره انتخاب کنید؛ مدیریت مقصد و حذف سابقه همچنان در دسترس است.", "unavailable");
    return { ...unavailable, displayName: libraryProjectName(config, unavailable) };
  }
  ensure(current.sourceHash === flow.profile.sourceHash, "PROJECT_CHANGED", "فایل‌های این نسخه تغییر کرده‌اند؛ پوشه را دوباره انتخاب کنید. سابقه حفظ شده است.", 409);
  if (flow.artifact) await readArtifact(config.stateDir, store.getArtifact(actorId, flow.artifact.archiveHash));
  ensure(!signal.aborted, "CANCELLED", "بازکردن پروژه متوقف شد.", 409);
  store.activateProjectFlow(actorId, id, libraryTarget(store, actorId, flow.id));
  return { ...flow, displayName: libraryProjectName(config, flow) };
}
