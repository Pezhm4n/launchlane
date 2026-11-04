import type { ProjectFlow } from "../../contracts/project-flow.ts";
import { parseCodeRepairJob, type CodeRepairJob } from "../../contracts/code-repair.ts";
import { preparesDatabaseArtifact, type DisposableTestDatabase } from "../../contracts/test-database.ts";
import { object, string } from "../../contracts/validation.ts";
import type { Store } from "../persistence/store.ts";
import { ensure } from "../errors.ts";
import { fingerprint } from "./action.ts";

export function completedBuildJob(store: Store, actor: string, id: string) {
  const row = store.db.prepare("SELECT state,data_json FROM code_repair_jobs WHERE id=? AND actor_id=? AND state='succeeded'").get(id, actor);
  ensure(row, "FULLSTACK_BUILD_REQUIRED", "رسید ساخت کامل این نسخه موجود نیست.", 409);
  const job = parseCodeRepairJob({ ...object(object(JSON.parse(string(row.data_json, 1024 * 1024))).job), state: row.state });
  ensure(job.id === id, "FULLSTACK_BUILD_REQUIRED", "رسید ذخیره‌شده متعلق به این ساخت نیست.", 409);
  return job;
}

/** Validate the durable receipt before using its data targets or reading its immutable bytes. */
export function verifiedFullstackRecord(flow: ProjectFlow, job: CodeRepairJob) {
  ensure(flow.profile.fullstack && !flow.profile.fullstack.requiresPreparation && flow.artifact && flow.selection.kind === "repair" && flow.selection.jobId === job.id,
    "FULLSTACK_BUILD_REQUIRED", "ساخت کامل، API مستقل و خروجی پایدار همان نسخه باید پیش از انتشار تأیید شوند.", 409);
  ensure(!(job.build?.version===7 && job.build.testDatabase && !preparesDatabaseArtifact(job.build.testDatabase)),"COMPATIBILITY_ARTIFACT_NOT_PUBLISHABLE","آزمون ساختگی جای بررسی نسخهٔ قابل انتشار با منابع واقعی را نمی‌گیرد.",409);
  const binding = job.publication, receipt = job.afterTest?.buildOutput;
  if (job.build?.version === 7 && job.build.testDatabase?.version === 4) ensure(job.afterTest?.databaseRunner?.planHash === fingerprint(job.build.testDatabase) &&
    job.afterTest.databaseRunner.sourceHash === binding?.testedSourceHash, "MIGRATION_RUNNER_RECEIPT_INVALID", "رسید دادهٔ انتخاب‌شده به برنامه و source همین بسته تعلق ندارد.", 409);
  ensure(job.build?.version === 7 && binding && receipt && job.afterTest?.passed && job.afterTest.exitCode === 0 && !job.afterTest.signal && job.execution === "container" && job.containerIds?.length &&
    job.artifact?.archiveHash === flow.artifact.archiveHash && job.artifact.sourceHash === flow.profile.sourceHash && binding.planHash === fingerprint(job.build) &&
    receipt.sourceHash === binding.testedSourceHash && receipt.planHash === binding.planHash && receipt.artifactHash === binding.outputArtifactHash &&
    job.build.startCommand === flow.profile.start && job.build.port === flow.profile.port && job.build.nodeVersion === flow.profile.nodeRuntime?.version &&
    job.build.fullstack.outputDirectory === flow.profile.fullstack.outputDirectory && flow.profile.build === "node .launchlane-build.cjs",
    "FULLSTACK_BUILD_REQUIRED", "بستهٔ نهایی باید به همان فرانت ساخته‌شده، API، نسخه Node و معیارهای مصوب متصل باشد.", 409);
  return { receipt, binding, build: job.build, artifact: flow.artifact };
}

export function assertTestedPostgresVersion(version: string, image: Extract<DisposableTestDatabase, { version: 4 }>["image"]) {
  const major = /^postgres:([1-9][0-9]*)-/.exec(image)?.[1];
  ensure(major && /^([1-9][0-9]*)(?:\.[0-9]+)*$/.exec(version)?.[1] === major,
    "DATABASE_BUILD_VERSION_MISMATCH", `بسته روی PostgreSQL ${major} آزموده شده است. نسخهٔ اصلی مقصد باید با آزمون همین بسته برابر باشد.`, 409);
}

/** An unknown static inference can be resolved only by the exact selected build and its data proof. */
export function testedResourceTarget(store: Store, actor: string, flow: ProjectFlow, consumerRoot: string,
  type: string, version: string, keys: readonly string[]) {
  const record = selectedDataBuild(store, actor, flow);
  if (!record) return null;
  const plan = record.databasePlan;
  ensure(type === "postgres" && consumerRoot === "." && plan.targets.some(target => fingerprint(target.environmentKeys) === fingerprint([...keys].sort())),
    "DATABASE_BUILD_TARGET_MISMATCH", "ورودی‌های منبع باید دقیقاً متعلق به یکی از دیتابیس‌های آزموده‌شدهٔ همین بسته باشند.", 409);
  assertTestedPostgresVersion(version, plan.image);
  return record;
}

export function selectedDataBuild(store: Store, actor: string, flow: ProjectFlow) {
  if (flow.selection.kind !== "repair" || !flow.profile.fullstack || flow.profile.fullstack.requiresPreparation) return null;
  const job = completedBuildJob(store, actor, flow.selection.jobId);
  if (job.build?.version !== 7 || job.build.testDatabase?.version !== 4) return null;
  const record = verifiedFullstackRecord(flow, job);
  return { ...record, databasePlan: job.build.testDatabase };
}
