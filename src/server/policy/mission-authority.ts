import type { Action, Session } from "../../contracts/domain.ts";
import type { CodeRepairJob } from "../../contracts/code-repair.ts";
import { parseCodeRepairJob } from "../../contracts/code-repair.ts";
import { parseMissionPlan, type MissionAuthority, type MissionPlan } from "../../contracts/mission-authority.ts";
import { object, string } from "../../contracts/validation.ts";
import type { Store } from "../persistence/store.ts";
import { ensure } from "../errors.ts";
import { fingerprint } from "./action.ts";

export function missionAuthority(store: Store, actor: string, runId: string): MissionAuthority | null {
  const row = store.db.prepare("SELECT * FROM mission_authorities WHERE actor_id=? AND run_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1").get(actor, runId);
  if (!row) return null;
  const state = row.state, plan = parseMissionPlan(JSON.parse(string(row.plan_json, 128 * 1024)));
  ensure((state === "proposed" || state === "approved" || state === "revoked") &&
    row.plan_hash === fingerprint({ actorId: actor, plan }) && plan.runId === runId,
    "PLAN_CHANGED", "قرارداد ذخیره‌شده برنامه تغییر کرده است.", 409);
  return { id: string(row.id, 36), hash: string(row.plan_hash, 64), state, plan };
}
export function assertMissionAuthority(store: Store, actor: string, sessionId: string, authority: MissionAuthority, now = Date.now()): MissionPlan {
  const current = missionAuthority(store, actor, authority.plan.runId), row = store.db.prepare("SELECT session_id FROM mission_authorities WHERE id=? AND actor_id=?").get(authority.id, actor);
  ensure(current?.id === authority.id && current.hash === authority.hash && current.state === "approved" &&
    row?.session_id === sessionId && store.sessionExists(sessionId, actor, now) && current.plan.expiresAt > now,
    "PLAN_AUTHORITY_EXPIRED", "اختیار برنامه رد یا منقضی شده یا به نشست دیگری تعلق دارد؛ ادامه اجرا به تصمیم تازه نیاز دارد.", 409);
  const owner = store.db.prepare("SELECT state,data_json FROM agent_runs WHERE id=? AND actor_id=?").get(current.plan.runId, actor);
  ensure(owner && (owner.state === "working" || owner.state === "queued" || owner.state === "needs_approval"), "PLAN_OWNER_CHANGED", "مأموریت این اختیار دیگر قابل اجرا نیست.", 409);
  const run = object(JSON.parse(string(owner.data_json, 512 * 1024))), usage = object(run.usage), context = object(run.context);
  const target = object(context.target);
  ensure(fingerprint(run.limits) === fingerprint(current.plan.limits) && Number(usage.modelCalls) <= current.plan.limits.maxModelCalls &&
    Number(usage.toolCalls) <= current.plan.limits.maxToolCalls && Number(usage.elapsedMs) < current.plan.limits.runTimeoutMs &&
    target.accountId === current.plan.target.accountId && target.teamId === current.plan.target.teamId && target.app === current.plan.target.app && target.appId === current.plan.target.appId,
    "PLAN_SCOPE_CHANGED", "مقصد یا بودجه مأموریت از اختیار مصوب خارج شده است.", 409);
  if (current.plan.version === 2 && current.plan.codingAgent.kind === "codex") {
    ensure(!store.db.prepare("SELECT job_id FROM coding_agent_executions WHERE actor_id=? AND state='uncertain' AND json_extract(data_json,'$.parentRunId')=? LIMIT 1")
      .get(actor, current.plan.runId), "CODING_EXECUTION_UNCERTAIN", "نتیجه اجرای بیرونی تعیین نشده است؛ اختیار انتشار یا worker دیگری فعال نمی‌شود.", 409);
  }
  return current.plan;
}
function jobEvidence(job: CodeRepairJob): string {
  return fingerprint({ id: job.id, parentRunId: job.parentRunId, projectId: job.projectId, baseRevision: job.baseRevision,
    build: job.build ?? null, allowedPaths: job.allowedPaths, testFiles: job.testFiles, changedPaths: job.changedPaths,
    diff: job.diff, afterTest: job.afterTest, artifact: job.artifact, execution: job.execution ?? null, state: job.state,
    ...(job.build?.version === 6 ? { builtImage: job.builtImage ?? null } : {}) });
}
export function missionJobScopeHash(job: CodeRepairJob): string {
  return fingerprint({ id: job.id, parentRunId: job.parentRunId, projectId: job.projectId, baseRevision: job.baseRevision,
    build: job.build ?? null, allowedPaths: job.allowedPaths, testFiles: job.testFiles, preparation: job.preparation ?? null,
    execution: job.execution ?? null, containerImage: job.containerImage ?? null, validationOnly: job.validationOnly ?? false });
}
function loadJob(store: Store, actor: string, id: string): CodeRepairJob {
  const row = store.db.prepare("SELECT state,data_json FROM code_repair_jobs WHERE id=? AND actor_id=?").get(id, actor);
  ensure(row, "PLAN_LINEAGE_INVALID", "رسید میزبان برای artifact در دسترس نیست.", 409);
  return parseCodeRepairJob({ ...object(object(JSON.parse(string(row.data_json, 512 * 1024))).job), state: row.state });
}
function assertJobScope(plan: MissionPlan, job: CodeRepairJob): void {
  ensure(job.parentRunId === plan.runId && job.execution === "container" && job.build &&
    fingerprint(job.build) === fingerprint(plan.build) && (plan.build.version === 6 ? job.containerImage === undefined : job.containerImage === plan.build.image) && !job.preparation &&
    (job.build.version !== 6 || job.state !== "succeeded" || /^sha256:[a-f0-9]{64}$/.test(job.builtImage ?? "")) &&
    job.allowedPaths.every(path => plan.allowedPaths.includes(path)) && job.changedPaths.every(path => job.allowedPaths.includes(path)) && job.testFiles.length === 0,
    "PLAN_REPAIR_SCOPE", "فرمان، محیط، آزمون یا فایل‌های اصلاح از محدوده برنامه بیرون‌اند.", 409);
}
export function assertArtifactLineage(store: Store, actor: string, authority: MissionAuthority, source: string, archive?: string, visited = new Set<string>()): void {
  const plan = authority.plan;
  if (source === plan.rootSourceHash && (archive === undefined || archive === plan.rootArtifactHash)) return;
  ensure(!visited.has(source) && visited.size < 8, "PLAN_LINEAGE_INVALID", "زنجیره منشأ artifact معتبر نیست.", 409);
  visited.add(source);
  const row = archive === undefined
    ? store.db.prepare("SELECT * FROM mission_artifacts WHERE authority_id=? AND source_hash=?").get(authority.id, source)
    : store.db.prepare("SELECT * FROM mission_artifacts WHERE authority_id=? AND source_hash=? AND archive_hash=?").get(authority.id, source, archive);
  ensure(row, "PLAN_LINEAGE_INVALID", "این نسخه از source و آزمون معتبر برنامه مشتق نشده است.", 409);
  const job = loadJob(store, actor, string(row.job_id, 36));
  assertJobScope(plan, job);
  ensure(job.state === "succeeded" && job.artifact?.sourceHash === source && job.artifact.archiveHash === row.archive_hash &&
    job.baseRevision === row.base_source_hash && row.evidence_hash === jobEvidence(job) &&
    job.afterTest?.passed && job.afterTest.exitCode === 0 && !job.afterTest.signal && (job.validationOnly || job.changedPaths.length > 0),
    "PLAN_LINEAGE_INVALID", "رسید patch، آزمون یا بسته مشتق‌شده معتبر نیست.", 409);
  assertArtifactLineage(store, actor, authority, job.baseRevision, undefined, visited);
}
export function recordMissionArtifact(store: Store, actor: string, sessionId: string, authority: MissionAuthority, job: CodeRepairJob): void {
  const plan = assertMissionAuthority(store, actor, sessionId, authority);
  assertJobScope(plan, job);
  const step = store.db.prepare("SELECT evidence_hash FROM mission_steps WHERE authority_id=? AND kind IN ('build','repair') AND subject_id=?").get(authority.id, job.id);
  ensure(step?.evidence_hash === missionJobScopeHash(job), "PLAN_STEP_REQUIRED", "این job از سهم تلاش‌های همان برنامه رزرو نشده است.", 409);
  ensure(job.state === "succeeded" && job.artifact && job.afterTest?.passed && job.afterTest.exitCode === 0 && !job.afterTest.signal,
    "PLAN_LINEAGE_INVALID", "بسته بدون آزمون مستقل موفق به اختیار متصل نمی‌شود.", 409);
  // The record supplied by a worker is never sufficient; compare with the host's durable receipt.
  ensure(jobEvidence(loadJob(store, actor, job.id)) === jobEvidence(job), "PLAN_LINEAGE_INVALID", "رسید میزبان با نتیجه دریافتی برابر نیست.", 409);
  assertArtifactLineage(store, actor, authority, job.baseRevision);
  if (job.artifact.sourceHash === plan.rootSourceHash && job.artifact.archiveHash === plan.rootArtifactHash) return;
  ensure(job.validationOnly || job.changedPaths.length > 0 && job.artifact.sourceHash !== job.baseRevision, "PLAN_NO_PROGRESS", "اصلاح نسخه تازه‌ای نساخته است؛ تلاش بی‌اثر منتشر نمی‌شود.", 409);
  store.db.prepare("INSERT INTO mission_artifacts VALUES (?,?,?,?,?,?)").run(authority.id, job.artifact.sourceHash, job.artifact.archiveHash, job.baseRevision, job.id, jobEvidence(job));
}
export function reserveMissionStep(store: Store, actor: string, session: Session, authority: MissionAuthority,
  kind: "build" | "repair" | "publication", subjectId: string, evidenceHash: string): void {
  const plan = assertMissionAuthority(store, actor, session.id, authority);
  const counts = store.db.prepare("SELECT count(*) AS count FROM mission_steps WHERE authority_id=? AND kind=?").get(authority.id, kind);
  const maximum = kind === "build" ? plan.maxBuildJobs : kind === "repair" ? plan.maxRepairs : plan.maxPublications;
  ensure(Number(counts?.count) < maximum, "PLAN_ATTEMPT_LIMIT", "سقف تلاش‌های مصوب این برنامه پر شده است؛ اجرا متوقف شد.", 409);
  store.db.prepare("INSERT INTO mission_steps VALUES (?,?,?,?,?)").run(authority.id, kind, subjectId, evidenceHash, Date.now());
}
export function assertMissionJob(store: Store, actor: string, sessionId: string, authority: MissionAuthority, job: CodeRepairJob): void {
  const plan = assertMissionAuthority(store, actor, sessionId, authority);
  assertJobScope(plan, job);
  assertArtifactLineage(store, actor, authority, job.baseRevision);
}
export function assertMissionJobExecution(store: Store, actor: string, sessionId: string, job: CodeRepairJob): void {
  const step = store.db.prepare("SELECT a.run_id,s.evidence_hash FROM mission_steps s JOIN mission_authorities a ON a.id=s.authority_id WHERE s.kind IN ('build','repair') AND s.subject_id=? AND a.actor_id=?").get(job.id, actor);
  if (!step) {
    ensure(!job.parentRunId || missionAuthority(store, actor, job.parentRunId)?.state !== "approved", "PLAN_STEP_REQUIRED", "job وابسته به برنامه باید پیش از اجرا سهم رزروشده داشته باشد.", 409);
    return;
  }
  const authority = missionAuthority(store, actor, string(step.run_id, 36));
  ensure(authority && step.evidence_hash === missionJobScopeHash(job), "PLAN_CHANGED", "محدوده job با برنامه مصوب برابر نیست.", 409);
  assertMissionJob(store, actor, sessionId, authority, job);
}
export function assertMissionPublication(store: Store, actor: string, sessionId: string, authority: MissionAuthority, action: Action): void {
  const plan = assertMissionAuthority(store, actor, sessionId, authority), spec = action.spec;
  ensure((spec.version === 7 || spec.version === 10 || spec.version === 11 || spec.version === 17 || spec.version === 19 || spec.version === 21) && spec.sourceHash && spec.operation === "deploy" &&
    spec.scope.teamId === plan.target.teamId && spec.scope.app === plan.target.app && spec.accountId === plan.target.accountId && spec.targetAppId === plan.target.appId &&
    spec.args.planId === plan.target.planId && spec.args.port === plan.build.port &&
    (spec.version !== 19 || plan.build.version === 5 && fingerprint(spec.runtime) === fingerprint(plan.build.frontend)) &&
    (spec.version === 21 ? plan.build.version === 6 && fingerprint(spec.runtime) === fingerprint(plan.build.runtime) : spec.version === 11 ? plan.build.version === 2 && fingerprint(spec.runtime) === fingerprint(plan.build.runtime) : plan.build.version !== 2 && plan.build.version !== 6 && spec.nodeVersion === plan.build.nodeVersion) &&
    fingerprint(spec.version === 10 || spec.version === 11 || spec.version === 17 || spec.version === 19 || spec.version === 21 ? spec.environment : null) === fingerprint(plan.build.environment ?? null) &&
    fingerprint(spec.workload) === fingerprint({ ...plan.build.workload, origin: plan.target.origin }),
    "PLAN_PUBLICATION_SCOPE", "مقصد، هزینه، نسخه اجرا، تنظیمات یا معیار سلامت از برنامه مصوب خارج است.", 409);
  assertArtifactLineage(store, actor, authority, spec.sourceHash, spec.artifactHash);
  const flow = store.getProjectFlow(actor, spec.projectFlowId);
  ensure(flow?.profile.sourceHash === spec.sourceHash && flow.artifact?.archiveHash === spec.artifactHash,
    "PLAN_LINEAGE_INVALID", "source و بسته منتخب با نسخه مشتق‌شده برابر نیستند.", 409);
  // Even an unchanged root must have completed this exact build under this authority.
  const steps = store.db.prepare("SELECT subject_id,evidence_hash FROM mission_steps WHERE authority_id=? AND kind IN ('build','repair')").all(authority.id);
  ensure(steps.some(step => {
    const job = loadJob(store, actor, string(step.subject_id, 36));
    return step.evidence_hash === missionJobScopeHash(job) && job.state === "succeeded" && job.artifact?.archiveHash === spec.artifactHash && job.artifact.sourceHash === spec.sourceHash &&
      job.afterTest?.passed && job.afterTest.exitCode === 0 && !job.afterTest.signal && fingerprint(job.build ?? null) === fingerprint(plan.build);
  }), "PLAN_BUILD_REQUIRED", "انتشار فقط برای همان بسته‌ای مجاز است که build و پاسخ برنامه را گذرانده باشد.", 409);
}
export function assertMissionActionClaim(store: Store, actor: string, sessionId: string, action: Action, now: number): void {
  const step = store.db.prepare("SELECT a.run_id,s.evidence_hash FROM mission_steps s JOIN mission_authorities a ON a.id=s.authority_id WHERE s.kind='publication' AND s.subject_id=? AND a.actor_id=?").get(action.id, actor);
  if (!step) return;
  const authority = missionAuthority(store, actor, string(step.run_id, 36));
  ensure(authority && step.evidence_hash === action.hash, "PLAN_CHANGED", "اقدام از برنامه مصوب مشتق نشده است.", 409);
  assertMissionAuthority(store, actor, sessionId, authority, now);
  assertMissionPublication(store, actor, sessionId, authority, action);
}
