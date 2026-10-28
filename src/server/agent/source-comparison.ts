import { isDeploymentSpec } from "../../contracts/deployment.ts";
import { string } from "../../contracts/validation.ts";
import type { Store } from "../persistence/store.ts";
import { AppError } from "../errors.ts";
import type { AgentContext } from "./store.ts";

type Relationship = "matching_recorded_source" | "different_recorded_source" | "unattributed_release" | "unknown_current_release";

/** Compare stored, accepted publication provenance; never infer running bytes or health. */
export function compareSelectedSource(store: Store, actorId: string, context: AgentContext, releaseId: string | null, observedAt: number) {
  if (!context.projectId || !context.sourceHash || !context.target) return null;
  const target = context.target;
  const base = { version: 1 as const, basis: "accepted_release_record" as const, projectId: context.projectId,
    selectedSourceHash: context.sourceHash, appId: target.appId, teamId: target.teamId, app: target.app,
    releaseId, observedAt, runtimeContent: "unverified" as const, workloadHealth: "unverified" as const };
  const unknown = (relationship: Relationship, reason: string) => ({ ...base, relationship, reason,
    recordedProjectId: null, recordedSourceHash: null, recordedArtifactHash: null });
  if (!releaseId) return unknown("unknown_current_release", "current_release_not_returned");
  const rows = store.db.prepare(`SELECT id FROM actions WHERE actor_id=? AND remote_id=?
    AND json_extract(spec,'$.operation')='deploy' AND json_extract(spec,'$.scope.teamId')=?
    AND json_extract(spec,'$.scope.app')=? AND json_extract(spec,'$.accountId')=?
    AND json_extract(spec,'$.targetAppId')=? LIMIT 2`).all(actorId, releaseId, target.teamId, target.app, target.accountId, target.appId);
  if (rows.length !== 1) return unknown("unattributed_release", rows.length ? "ambiguous_records" : "no_matching_scoped_record");
  try {
    const action = store.getAction(string(rows[0]?.id, 36), actorId);
    if (!isDeploymentSpec(action.spec) || !action.attemptId || action.remoteId !== releaseId ||
      action.deployment?.stage !== "release_accepted" || !action.deployment.sourceId ||
      !store.db.prepare("SELECT id FROM attempts WHERE id=? AND action_id=? AND remote_id=?").get(action.attemptId, action.id, releaseId))
      return unknown("unattributed_release", "accepted_source_and_release_receipt_missing");
    return { ...base, relationship: (action.spec.sourceHash === context.sourceHash ? "matching_recorded_source" : "different_recorded_source") as Relationship,
      reason: "accepted_publication_record_only", recordedProjectId: action.spec.projectFlowId,
      recordedSourceHash: action.spec.sourceHash, recordedArtifactHash: action.spec.artifactHash };
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    return unknown("unattributed_release", "stored_record_unavailable");
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function sourceComparisonNotice(result: unknown, context: AgentContext): string | null {
  if (!record(result) || result.ok !== true || !record(result.data) || !record(result.data.sourceComparison) || !context.target) return null;
  const comparison = result.data.sourceComparison;
  if (comparison.version !== 1 || comparison.basis !== "accepted_release_record" || comparison.projectId !== context.projectId ||
    comparison.selectedSourceHash !== context.sourceHash || comparison.appId !== context.target.appId ||
    comparison.teamId !== context.target.teamId || comparison.app !== context.target.app ||
    comparison.runtimeContent !== "unverified" || comparison.workloadHealth !== "unverified") return null;
  switch (comparison.relationship) {
    case "matching_recorded_source": return "در زمان این بررسی، سورس انتخاب‌شده با مبدأ انتشار ثبت‌شدهٔ نسخهٔ جاری مطابق بود؛ محتوای فعلی سرور و سلامت برنامه با این تطبیق تأیید نمی‌شوند.";
    case "different_recorded_source": return "در زمان این بررسی، نسخهٔ جاری به انتشار ثبت‌شدهٔ سورس دیگری مربوط بود. سورس انتخاب‌شده را کد در حال اجرای سایت فرض نکنید؛ سلامت برنامه جدا بررسی می‌شود.";
    case "unattributed_release": return "در زمان این بررسی، مبدأ سورس نسخهٔ جاری با سابقهٔ معتبر همین حساب و برنامه قابل تطبیق نبود. سورس انتخاب‌شده شاهد محتوای در حال اجرای سایت نیست.";
    case "unknown_current_release": return "در زمان این بررسی، شناسهٔ نسخهٔ جاری از سرویس دریافت نشد؛ جدیدترین نسخهٔ فهرست جای نسخهٔ جاری فرض نمی‌شود و سورس منتشرشده نامشخص می‌ماند.";
    default: return null;
  }
}
