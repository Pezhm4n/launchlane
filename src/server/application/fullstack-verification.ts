import type { ProjectFlow } from "../../contracts/project-flow.ts";
import { parseCodeRepairJob } from "../../contracts/code-repair.ts";
import { parseFullstackVerification, type FullstackVerification } from "../../contracts/fullstack.ts";
import { object, string } from "../../contracts/validation.ts";
import { ensure } from "../errors.ts";
import { fingerprint } from "../policy/action.ts";
import type { Store } from "../persistence/store.ts";
import { readBuildOutput } from "../agent/build-output-store.ts";
import { readArtifact } from "../workspace/archive.ts";
import { matchesPublishedBuildEnvironment } from "../environment/build.ts";
import { preparesDatabaseArtifact } from "../../contracts/test-database.ts";
import { assertPreparedDatabaseBindings } from "../environment/prepared-database.ts";

function completedBuildJob(store: Store, actor: string, id: string) {
  const row = store.db.prepare("SELECT state,data_json FROM code_repair_jobs WHERE id=? AND actor_id=? AND state='succeeded'").get(id, actor);
  ensure(row, "FULLSTACK_BUILD_REQUIRED", "رسید ساخت کامل این نسخه موجود نیست.", 409);
  return parseCodeRepairJob({ ...object(object(JSON.parse(string(row.data_json, 1024 * 1024))).job), state: row.state });
}

/** Release/HTTP/API evidence cannot turn a disposable data receipt into destination data proof. */
export function requiresProductionDataVerification(store: Store, actor: string, verification: FullstackVerification): boolean {
  const job = completedBuildJob(store, actor, verification.buildJobId), binding = job.publication;
  ensure(job.build?.version === 7 && binding && job.afterTest?.passed && binding.planHash === fingerprint(job.build) &&
    binding.planHash === verification.planHash && binding.testedSourceHash === verification.testedSourceHash && binding.outputArtifactHash === verification.outputArtifactHash &&
    job.build.fullstack.outputDirectory === verification.outputDirectory && fingerprint(job.build.apiChecks) === fingerprint(verification.apiChecks),
    "FULLSTACK_BUILD_REQUIRED", "نتیجهٔ انتشار باید به رسید ساخت و معیارهای همین نسخه تعلق داشته باشد.", 409);
  if (job.build.testDatabase?.version !== 4) return false;
  ensure(job.afterTest.databaseRunner?.planHash === fingerprint(job.build.testDatabase), "MIGRATION_RUNNER_RECEIPT_INVALID", "رسید داده به طرح همین بسته تعلق ندارد.", 409);
  return true;
}

/** Local immutable build evidence is separate from a cloud environment decision. */
export async function localFullstackVerification(store: Store, stateDir: string, actor: string, flow: ProjectFlow) {
  ensure(flow.profile.fullstack && !flow.profile.fullstack.requiresPreparation && flow.artifact && flow.selection.kind === "repair",
    "FULLSTACK_BUILD_REQUIRED", "ساخت کامل، API مستقل و خروجی پایدار همان نسخه باید پیش از انتشار تأیید شوند.", 409);
  const job = completedBuildJob(store, actor, flow.selection.jobId);
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
  await readBuildOutput(stateDir, receipt, { sourceHash: binding.testedSourceHash, planHash: binding.planHash });
  await readArtifact(stateDir, store.getArtifact(actor, flow.artifact.archiveHash));
  return { verification: parseFullstackVerification({ ...binding, buildJobId: job.id, outputDirectory: job.build.fullstack.outputDirectory, apiChecks: job.build.apiChecks }),
    build: job.build, testedAt: job.updatedAt };
}

export async function fullstackVerification(store: Store, stateDir: string, actor: string, flow: ProjectFlow, secret: string): Promise<FullstackVerification> {
  const evidence = await localFullstackVerification(store, stateDir, actor, flow);
  if (evidence.build.testDatabase?.version === 4) assertPreparedDatabaseBindings(store, secret, actor, flow, evidence.build.testDatabase);
  else ensure(matchesPublishedBuildEnvironment({ sessionSecret: secret }, store, actor, flow.id, evidence.build),
    "FULLSTACK_BUILD_REQUIRED", "بستهٔ نهایی باید به همان فرانت ساخته‌شده، API، نسخه Node و معیارهای مصوب متصل باشد.", 409);
  return evidence.verification;
}
