import { randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import type { Action, ActionSpec } from "../../contracts/domain.ts";
import type { ProjectFlow, ProjectSelection } from "../../contracts/project-flow.ts";
import type { Config } from "../config.ts";
import { connectedLiaraConfig } from "../connections/liara.ts";
import { AppError, ensure } from "../errors.ts";
import type { GitHubClient } from "../github/client.ts";
import { discardGitHubSource, persistGitHubSource, projectSubdirectory, unpackGitHubArchive } from "../github/import.ts";
import { connectedGitHub } from "../github/login.ts";
import type { Store } from "../persistence/store.ts";
import { authorizeScope, fingerprint } from "../policy/action.ts";
import { inspectProject } from "../workspace/inspect.ts";
import type { SourceFile } from "../workspace/inspect.ts";
import { readArtifact } from "../workspace/archive.ts";
import { prepareArchive } from "./prepare-source.ts";
import { parseCodeRepairJob } from "../../contracts/code-repair.ts";
import { object, string } from "../../contracts/validation.ts";
import { projectEnvironmentValues, projectSecretValues } from "../environment/secrets.ts";

let preparing = false;
export function projectRoot(
  config: Config,
  flow: Pick<ProjectFlow, "id" | "selection">,
): { root: string; directory: string } {
  if (flow.selection.kind === "github")
    return { root: join(config.stateDir, "github-sources", flow.id), directory: "." };
  if (flow.selection.kind === "upload")
    return { root: join(config.stateDir, "uploaded-sources", flow.id), directory: "." };
  if(flow.selection.kind==="repair") return {root:join(config.stateDir,"repair-workspaces",flow.selection.jobId),directory:"."};
  if (flow.selection.kind === "sample")
    return { root: resolve(/* turbopackIgnore: true */ "."), directory: "examples/node-service" };
  ensure(
    config.workspaceRoot,
    "WORKSPACE_UNCONFIGURED",
    "پوشه مجاز پروژه‌ها روی این نصب تعیین نشده است. می‌توانید پروژه را از GitHub انتخاب کنید یا با نمونه امتحان کنید.",
    503,
  );
  return { root: config.workspaceRoot, directory: flow.selection.directory };
}
function secrets(config: Config, store: Store, actorId: string): string[] {
  return [config.liaraToken, config.modelKey, config.operatorToken, config.sessionSecret, ...projectSecretValues(store, config.sessionSecret, actorId)].filter(
    Boolean,
  );
}

export async function prepareProjectFlow(
  config: Config,
  store: Store,
  actorId: string,
  selection: ProjectSelection,
  signal: AbortSignal,
  github?: GitHubClient,
  ownerRunId?: string,
  uploadedFiles?: readonly SourceFile[],
): Promise<ProjectFlow> {
  ensure(
    !preparing,
    "SOURCE_BUSY",
    "یک پروژه در حال آماده‌سازی است. پس از پایان یا لغو آن، دوباره انتخاب کنید.",
    429,
  );
  preparing = true;
  const id = randomUUID();
  let imported = false;
  try {
    if (selection.kind === "upload") {
      ensure(uploadedFiles?.length, "UPLOAD_REQUIRED", "پوشه را از رایانه انتخاب و فایل‌ها را برای بررسی وارد کنید.");
      await persistGitHubSource(config.stateDir, id, uploadedFiles, signal, "uploaded-sources");
      imported = true;
    }
    if(selection.kind==="repair") {
      const row=store.db.prepare("SELECT data_json,state FROM code_repair_jobs WHERE actor_id=? AND id=?").get(actorId,selection.jobId);
      ensure(row,"REPAIR_NOT_FOUND","نسخه اصلاح‌شده در دسترس نیست.",404);
      const record=object(JSON.parse(string(row.data_json,512*1024))),job=parseCodeRepairJob({...object(record.job),state:row.state});
      ensure(job.state==="succeeded"&&job.artifact?.archiveHash===selection.artifactHash,"REPAIR_UNVERIFIED","فقط اصلاحی که آزمون و بسته معتبر دارد قابل انتخاب است.",409);
    }
    if (selection.kind === "sample")
      ensure(
        selection.directory === "examples/node-service",
        "INVALID_INPUT",
        "پروژه نمونه معتبر نیست.",
      );
    if (selection.kind === "github") {
      projectSubdirectory(selection.directory);
      const client = github ?? (await connectedGitHub(config, store, actorId, signal));
      const repository = await client.repository(
        selection.owner,
        selection.name,
        selection.repositoryId,
        signal,
      );
      const revision = await client.revision(repository, selection.branch, signal);
      ensure(
        revision === selection.revision,
        "GITHUB_BRANCH_CHANGED",
        "نسخه شاخه پس از انتخاب تغییر کرده است. شاخه را تازه و نسخه جدید را انتخاب کنید.",
        409,
      );
      const files = await unpackGitHubArchive(
        await client.archive(repository, revision, signal),
        selection.directory,
        signal,
      );
      await persistGitHubSource(config.stateDir, id, files, signal);
      imported = true;
    }
    const location = projectRoot(config, { id, selection }),
      privateValues = secrets(config, store, actorId);
    const profile = await inspectProject(location.root, location.directory, {
      signal,
      secrets: privateValues,
    });
    if(selection.kind==="repair") ensure(store.getArtifact(actorId,selection.artifactHash).sourceHash===profile.sourceHash,"REPAIR_ARTIFACT_CHANGED","فایل‌های اصلاح‌شده با نسخه آزموده‌شده برابر نیستند.",409);
    const artifact =
      profile.start && (profile.runtime === "node" && profile.nodeRuntime?.version || profile.runtime === "python" && profile.pythonRuntime)
        ? await prepareArchive({
            store,
            stateDir: config.stateDir,
            workspaceRoot: location.root,
            actorId,
            directory: location.directory,
            sourceHash: profile.sourceHash,
            signal,
            secrets: privateValues,
          })
        : null;
    ensure(!signal.aborted, "CANCELLED", "بررسی پروژه متوقف شد؛ انتخاب قبلی حفظ شده است.", 409);
    if (ownerRunId) ensure(selection.kind === "repair" && store.db.prepare(
      "SELECT id FROM agent_runs WHERE id=? AND actor_id=? AND state='working' AND json_extract(data_json,'$.repair.id')=?",
    ).get(ownerRunId, actorId, selection.jobId), "AGENT_CONFLICT", "انتخاب نسخه آزموده‌شده متعلق به مأموریت فعال نیست.", 409);
    else store.assertAgentIdle(actorId, null, true);
    return store.saveProjectFlow(actorId, {
      id,
      selection,
      selectionHash: fingerprint(selection),
      profile,
      artifact,
      status: artifact ? "ready" : "incomplete",
      message: artifact
        ? null
        : profile.runtime === "node" && profile.start && !profile.nodeRuntime?.version
          ? profile.nodeRuntime?.detail || "نسخه Node را در تنظیمات پروژه تعیین کنید."
        : profile.manifest.length === 0
          ? "این پوشه خالی است یا فایل پروژه قابل بررسی ندارد. پوشه همان برنامه Node یا Python را انتخاب کنید."
          : "پوشه همان برنامه Node با start مشخص یا Python با فرمان مستقیم و تنظیمات معتبر را انتخاب کنید؛ در پروژه چندبخشی، زیرپوشه همان برنامه لازم است.",
      updatedAt: Date.now(),
      actionId: null,
    });
  } catch (error) {
    if (imported) {
      try {
        // A committed flow owns its snapshot, including when a response is lost after persistence.
        if (!store.getProjectFlow(actorId, id)) await discardGitHubSource(config.stateDir, id, selection.kind === "upload" ? "uploaded-sources" : "github-sources");
      } catch {
        throw new AppError("GITHUB_CLEANUP_UNAVAILABLE", "بررسی پروژه کامل نشد و پاک‌سازی فایل‌های موقت ممکن نبود. پروژه قبلی حفظ شده است؛ از مسئول نصب برای بررسی فضای ذخیره‌سازی کمک بگیرید.", 503);
      }
    }
    throw error;
  } finally {
    preparing = false;
  }
}

export async function restoreProjectFlow(
  config: Config,
  store: Store,
  actorId: string,
  signal: AbortSignal,
  id?: string,
): Promise<ProjectFlow | null> {
  const flow = store.getProjectFlow(actorId, id);
  if (!flow) return null;
  const active = store.getProjectFlow(actorId);
  if (active?.id !== flow.id)
    return {
      ...flow,
      status: "stale",
      message:
        "این نتیجه مربوط به انتخاب قبلی پروژه است. برای ادامه، پروژه را دوباره انتخاب و بررسی کنید.",
    };
  if (flow.status === "stale") return flow;
  try {
    const location = projectRoot(config, flow);
    const current = await inspectProject(location.root, location.directory, {
      signal,
      secrets: secrets(config, store, actorId),
    });
    if (current.sourceHash !== flow.profile.sourceHash)
      return store.staleProjectFlow(
        actorId,
        flow.id,
        "فایل‌های پروژه پس از بررسی تغییر کرده‌اند. پیش از ادامه، پروژه را دوباره بررسی کنید.",
      );
    if (flow.status === "ready" && (current.runtime === "unknown" || !current.start))
      return store.staleProjectFlow(actorId, flow.id, current.missing[0] || "پروژه با محدوده پشتیبانی‌شده این نسخه تطبیق ندارد؛ پوشه همان برنامه را دوباره انتخاب کنید.");
    if (flow.status === "ready" && (current.runtime !== flow.profile.runtime || (current.runtime === "python"
      ? fingerprint(current.pythonRuntime) !== fingerprint(flow.profile.pythonRuntime)
      : !current.nodeRuntime?.version || flow.profile.nodeRuntime?.version !== current.nodeRuntime.version)))
      return store.staleProjectFlow(actorId, flow.id, "نسخه Node این نتیجه نیاز به بررسی تازه دارد؛ پروژه را دوباره بررسی و پیشنهاد تازه دریافت کنید.");
    if (flow.artifact)
      await readArtifact(config.stateDir, store.getArtifact(actorId, flow.artifact.archiveHash));
    // Restoring a result never renews an approval or revives a previously invalidated flow.
    return { ...flow, profile: current };
  } catch (error) {
    if (signal.aborted) throw new AppError("CANCELLED", "بازیابی پروژه لغو شد.", 409);
    const message =
      error instanceof AppError
        ? error.message
        : "فایل‌های پروژه اکنون در دسترس نیستند. پوشه را دوباره انتخاب کنید.";
    return store.staleProjectFlow(actorId, flow.id, message, "unavailable");
  }
}

export async function validateProjectAction(
  config: Config,
  store: Store,
  actorId: string,
  spec: ActionSpec,
  signal: AbortSignal,
): Promise<void> {
  if (spec.version !== 3 && spec.version !== 4 && spec.version !== 5 && (spec.version !== 7 && spec.version !== 10 && spec.version !== 11) && (spec.version !== 8 && spec.version !== 12) && spec.version !== 9) return;
  const flow = await restoreProjectFlow(config, store, actorId, signal, spec.projectFlowId);
  ensure(
    flow?.status === "ready",
    "PROJECT_CHANGED",
    flow?.message || "پروژه را دوباره بررسی کنید.",
    409,
  );
  store.assertProjectAction(actorId, spec);
  if (spec.version === 10 || spec.version === 11 && spec.environment !== null) projectEnvironmentValues(store, config.sessionSecret, actorId, spec.projectFlowId, spec.environment);
  if (spec.version === 11 || spec.version === 12) ensure(fingerprint(flow.profile.pythonRuntime) === fingerprint(spec.runtime), "PYTHON_RUNTIME_CHANGED", "تنظیمات اجرای Python تغییر کرده است؛ پیشنهاد تازه لازم است.", 409);
  else ensure((spec.version !== 5 && (spec.version !== 7 && spec.version !== 10) && spec.version !== 8) || flow.profile.nodeRuntime?.version === spec.nodeVersion, "NODE_VERSION_CHANGED", "نسخه Node پیشنهاد با پروژه برابر نیست؛ پیشنهاد تازه دریافت کنید.", 409);
}

export async function proposeProjectFlow(
  config: Config,
  store: Store,
  actorId: string,
  id: string,
  app: string,
  overridePort: number | null,
  signal: AbortSignal,
): Promise<Action> {
  const flow = await restoreProjectFlow(config, store, actorId, signal, id);
  ensure(
    flow?.status === "ready" && flow.artifact,
    "PROJECT_INCOMPLETE",
    flow?.message || "ابتدا پروژه را انتخاب و بررسی کنید.",
    409,
  );
  const target = connectedLiaraConfig(config, store, actorId, app),
    scope = { teamId: target.teamId, app };
  authorizeScope(scope, target);
  const port = overridePort ?? flow.profile.port;
  ensure(
    port && Number.isInteger(port) && port >= 1 && port <= 65535,
    "PROJECT_PORT_REQUIRED",
    "پورت برنامه از کد مشخص نشد. پورت مورد استفاده برنامه را وارد کنید.",
  );
  ensure(!signal.aborted, "CANCELLED", "آماده‌سازی پیشنهاد لغو شد.", 409);
  return store.createAction(actorId, {
    version: 3,
    scope,
    operation: "deploy",
    sourceHash: flow.profile.sourceHash,
    artifactHash: flow.artifact.archiveHash,
    projectFlowId: flow.id,
    selectionHash: flow.selectionHash,
    args: { port, planId: null },
  });
}
