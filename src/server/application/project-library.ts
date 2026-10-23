import { basename } from "node:path";
import type { ProjectFlow } from "../../contracts/project-flow.ts";
import type { ProjectSummary } from "../../contracts/project-library.ts";
import { string } from "../../contracts/validation.ts";
import { AgentRepository } from "../agent/store.ts";
import type { Config } from "../config.ts";
import type { Store } from "../persistence/store.ts";
import { ensure } from "../errors.ts";
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
export function listProjects(config: Config, store: Store, actorId: string, offset = 0) {
  const rows = store.db.prepare("SELECT id FROM project_flows WHERE actor_id=? ORDER BY updated_at DESC,rowid DESC LIMIT 21 OFFSET ?").all(actorId, offset);
  const active = store.getProjectFlow(actorId), repo = new AgentRepository(store);
  const projects = rows.slice(0, 20).map((row): ProjectSummary => {
    const flow = store.getProjectFlow(actorId, string(row.id, 36));
    ensure(flow, "NOT_FOUND", "پروژه پیدا نشد.", 404);
    const run = repo.forProject(actorId, flow.id, "publication");
    return { id: flow.id, name: libraryProjectName(config, flow), source: flow.selection.kind === "github" ? "GitHub" : flow.selection.kind === "upload" ? "از رایانه" : flow.selection.kind === "repair" ? "نسخه اصلاح‌شده" : "پوشهٔ این نصب",
      runtime: flow.profile.runtime, updatedAt: Math.max(flow.updatedAt, run?.updatedAt ?? 0), active: active?.id === flow.id,
      state: run?.state ?? flow.status, app: run?.context.target?.app ?? null, runId: run?.id ?? null };
  });
  return { projects, nextOffset: rows.length > 20 ? offset + 20 : null };
}
export async function openLibraryProject(config: Config, store: Store, actorId: string, id: string, signal: AbortSignal): Promise<ProjectFlow> {
  const flow = store.getProjectFlow(actorId, id);
  ensure(flow, "NOT_FOUND", "این پروژه پیدا نشد.", 404);
  if (store.getProjectFlow(actorId)?.id === flow.id) return { ...flow, displayName: libraryProjectName(config, flow) };
  store.assertAgentIdle(actorId, null, true);
  const location = projectRoot(config, flow), current = await inspectProject(location.root, location.directory, { signal,
    secrets: [config.liaraToken, config.modelKey, config.operatorToken, config.sessionSecret, ...projectSecretValues(store, config.sessionSecret, actorId)].filter(Boolean) });
  ensure(current.sourceHash === flow.profile.sourceHash, "PROJECT_CHANGED", "فایل‌های این نسخه تغییر کرده‌اند؛ پوشه را دوباره انتخاب کنید. سابقه حفظ شده است.", 409);
  if (flow.artifact) await readArtifact(config.stateDir, store.getArtifact(actorId, flow.artifact.archiveHash));
  ensure(!signal.aborted, "CANCELLED", "بازکردن پروژه متوقف شد.", 409);
  const run = new AgentRepository(store).forProject(actorId, flow.id, "publication");
  store.activateProjectFlow(actorId, id, run?.context.target ?? null);
  return { ...flow, displayName: libraryProjectName(config, flow) };
}
