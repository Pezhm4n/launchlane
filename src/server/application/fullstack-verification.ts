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

export async function fullstackVerification(store: Store, stateDir: string, actor: string, flow: ProjectFlow, secret: string): Promise<FullstackVerification> {
  ensure(flow.profile.fullstack && !flow.profile.fullstack.requiresPreparation && flow.artifact && flow.selection.kind === "repair",
    "FULLSTACK_BUILD_REQUIRED", "ساخت کامل، API مستقل و خروجی پایدار همان نسخه باید پیش از انتشار تأیید شوند.", 409);
  const row = store.db.prepare("SELECT state,data_json FROM code_repair_jobs WHERE id=? AND actor_id=? AND state='succeeded'").get(flow.selection.jobId, actor);
  ensure(row, "FULLSTACK_BUILD_REQUIRED", "رسید ساخت کامل این نسخه موجود نیست.", 409);
  const job = parseCodeRepairJob({ ...object(object(JSON.parse(string(row.data_json, 1024 * 1024))).job), state: row.state });
  ensure(!(job.build?.version===7 && job.build.testDatabase),"COMPATIBILITY_ARTIFACT_NOT_PUBLISHABLE","آزمون ساختگی جای بررسی نسخهٔ قابل انتشار با منابع واقعی را نمی‌گیرد.",409);
  const binding = job.publication, receipt = job.afterTest?.buildOutput;
  ensure(job.build?.version === 7 && binding && receipt && job.afterTest?.passed && job.execution === "container" && job.containerIds?.length &&
    job.artifact?.archiveHash === flow.artifact.archiveHash && job.artifact.sourceHash === flow.profile.sourceHash && binding.planHash === fingerprint(job.build) &&
    receipt.sourceHash === binding.testedSourceHash && receipt.planHash === binding.planHash && receipt.artifactHash === binding.outputArtifactHash &&
    job.build.startCommand === flow.profile.start && job.build.port === flow.profile.port && job.build.nodeVersion === flow.profile.nodeRuntime?.version &&
    job.build.fullstack.outputDirectory === flow.profile.fullstack.outputDirectory && flow.profile.build === "node .launchlane-build.cjs" &&
    matchesPublishedBuildEnvironment({ sessionSecret: secret }, store, actor, flow.id, job.build),
    "FULLSTACK_BUILD_REQUIRED", "بستهٔ نهایی باید به همان فرانت ساخته‌شده، API، نسخه Node و معیارهای مصوب متصل باشد.", 409);
  await readBuildOutput(stateDir, receipt, { sourceHash: binding.testedSourceHash, planHash: binding.planHash });
  await readArtifact(stateDir, store.getArtifact(actor, flow.artifact.archiveHash));
  return parseFullstackVerification({ ...binding, buildJobId: job.id, outputDirectory: job.build.fullstack.outputDirectory, apiChecks: job.build.apiChecks });
}
