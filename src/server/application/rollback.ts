import { randomUUID } from "node:crypto";
import type { Action } from "../../contracts/domain.ts";
import type { ProjectFlow } from "../../contracts/project-flow.ts";
import { isWorkloadDeploymentSpec } from "../../contracts/deployment.ts";
import type { Config } from "../config.ts";
import { ensure } from "../errors.ts";
import type { Store } from "../persistence/store.ts";
import { fingerprint } from "../policy/action.ts";
import { object, string } from "../../contracts/validation.ts";
import { readArtifact } from "../workspace/archive.ts";
import { proposeWorkloadDeployment } from "./deployment.ts";

/**
 * Restore the exact bytes of a previously successful publication without re-reading the
 * mutable workspace. The historical flow/action/artifact must still agree, and the new
 * flow carries the source action/release in its approved selection hash. Current app
 * configuration and plan continue; schema/data compatibility is not proven by this step.
 */
export async function proposeRollback(
  config: Config,
  store: Store,
  actorId: string,
  actionId: string,
  signal: AbortSignal,
  dependencies: Parameters<typeof proposeWorkloadDeployment>[5] = {},
): Promise<{ flow: ProjectFlow; action: Action }> {
  // actionId is the historical publication to restore, never the action being replaced.

  ensure(config.enableMutations && config.enableLiveLiara, "MUTATIONS_DISABLED", "ساخت پیشنهاد بازگردانی در این نصب خاموش است.", 403);
  const connection = store.getConnection(actorId, "liara")?.view;
  ensure(connection?.status === "connected" && connection.teamId === config.teamId, "LIARA_AUTH_REQUIRED", "ابتدا حساب و تیم مقصد را متصل کنید.", 403);
  const app = connection.apps.find(row => row.name === connection.selectedApp);
  ensure(app, "LIARA_APP_REQUIRED", "برنامهٔ مقصد را از حساب‌ها انتخاب کنید.", 409);
  const historicalAction = store.getAction(actionId, actorId);
  ensure(isWorkloadDeploymentSpec(historicalAction.spec), "ROLLBACK_UNSUPPORTED", "این نسخه برای بازگردانی دقیق پشتیبانی نمی‌شود؛ فقط انتشارهای دارای معیار پاسخ قابل بازگردانی‌اند.", 409);
  const spec = historicalAction.spec, releaseId = historicalAction.remoteId;
  ensure(historicalAction.state === "succeeded" && spec.sourceHash && spec.artifactHash && releaseId &&
    historicalAction.deployment?.stage === "release_accepted",
    "ROLLBACK_NOT_ELIGIBLE", "فقط نسخه‌ای که انتشارش تأیید شده و رسید release دارد قابل بازگردانی است.", 409);
  ensure(spec.scope.teamId === connection.teamId && spec.scope.app === app.name && spec.targetAppId === app.id &&
    spec.accountId === connection.identityId,
    "ROLLBACK_TARGET_CHANGED", "این نسخه به برنامه یا حساب انتخاب‌شدهٔ فعلی تعلق ندارد.", 409);
  const historical = store.getProjectFlow(actorId, spec.projectFlowId);
  ensure(historical?.artifact && historical.selectionHash === spec.selectionHash &&
    historical.profile.sourceHash === spec.sourceHash && historical.artifact.archiveHash === spec.artifactHash,
    "ROLLBACK_SOURCE_UNAVAILABLE", "نسخهٔ منبع یا بستهٔ همان انتشار در دسترس نیست؛ بازگردانی انجام نشد.", 409);
  ensure(!historical.profile.fullstack,
    "ROLLBACK_UNSUPPORTED", "بازگردانی پروژه‌های fullstack/Worker به قرارداد سازگاری داده و storage نیاز دارد و در این مرحله انجام نمی‌شود.", 409);
  const artifact = store.getArtifact(actorId, spec.artifactHash);
  ensure(artifact.sourceHash === spec.sourceHash && artifact.archiveHash === spec.artifactHash,
    "ROLLBACK_ARTIFACT_CHANGED", "بستهٔ ذخیره‌شده با نسخهٔ تأییدشدهٔ همان انتشار برابر نیست.", 409);
  await readArtifact(config.stateDir, artifact);
  const selection = { kind: "artifact" as const, directory: "." as const, sourceFlowId: historical.id,
    sourceActionId: historicalAction.id, releaseId, artifactHash: spec.artifactHash };
  const flow: ProjectFlow = {
    displayName: `${historical.displayName ?? app.name} — بازگردانی نسخه`,
    id: randomUUID(),
    selection,
    selectionHash: fingerprint(selection),
    profile: historical.profile,
    artifact: historical.artifact,
    status: "ready",
    message: "نسخهٔ قبلی همین برنامه از بستهٔ تأییدشدهٔ ذخیره‌شده آماده می‌شود؛ فایل‌های فعلی پوشه خوانده نمی‌شوند.",
    updatedAt: Date.now(),
    actionId: null,
  };
  store.saveProjectFlow(actorId, flow);
  const action = await proposeWorkloadDeployment(config, store, actorId,
    { flowId: flow.id, app: app.name, port: spec.args.port, workload: spec.workload }, signal, dependencies);
  ensure(isWorkloadDeploymentSpec(action.spec), "ROLLBACK_PROPOSAL_CHANGED", "پیشنهاد بازگردانی معیار پاسخ ندارد.", 409);
  ensure(action.spec.projectFlowId === flow.id && action.spec.sourceHash === spec.sourceHash &&
    action.spec.artifactHash === spec.artifactHash && action.spec.scope.app === app.name && action.spec.targetAppId === app.id,
    "ROLLBACK_PROPOSAL_CHANGED", "پیشنهاد بازگردانی به همان بسته یا مقصد متصل نشد.", 409);
  return { flow, action };
}

/** Select the latest successful publication strictly before the displayed action. */
export async function proposePreviousRollback(
  config: Config,
  store: Store,
  actorId: string,
  beforeActionId: string,
  signal: AbortSignal,
  dependencies: Parameters<typeof proposeWorkloadDeployment>[5] = {},
): Promise<{ flow: ProjectFlow; action: Action }> {
  ensure(config.enableMutations && config.enableLiveLiara, "MUTATIONS_DISABLED", "ساخت پیشنهاد بازگردانی در این نصب خاموش است.", 403);
  const current = store.getAction(beforeActionId, actorId);
  const row = store.db.prepare(`SELECT id FROM actions
    WHERE actor_id=? AND app=? AND state='succeeded' AND rowid < (SELECT rowid FROM actions WHERE id=? AND actor_id=?)
      AND json_extract(spec,'$.version') IN (7,10,11,15,17,19,21,23,26)
    ORDER BY rowid DESC LIMIT 1`).get(actorId, current.spec.scope.app, beforeActionId, actorId);
  ensure(row, "ROLLBACK_NOT_ELIGIBLE", "برای این برنامه انتشار موفق قبلی پیدا نشد؛ بازگردانی معنا ندارد.", 409);
  return proposeRollback(config, store, actorId, string(object(row).id), signal, dependencies);
}
