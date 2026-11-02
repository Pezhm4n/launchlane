import { assertIndependentBuildWorkload } from "./build-workload.ts";
import { createHash } from "node:crypto";
import type { ProjectFlow } from "../../contracts/project-flow.ts";
import { parseCodeRepairJob } from "../../contracts/code-repair.ts";
import { parsePhpVerification } from "../../contracts/php-runtime.ts";
import { object, string } from "../../contracts/validation.ts";
import type { Store } from "../persistence/store.ts";
import { ensure } from "../errors.ts";
import { fingerprint } from "./action.ts";
import { phpEnvelopeFiles } from "../agent/php-program.ts";

export function assertPhpJob(store: Store, actor: string, flow: ProjectFlow) {
  const verification = flow.profile.installedPhp;
  ensure(verification && flow.profile.dockerRuntime && flow.artifact && flow.selection.kind === "repair" && flow.selection.jobId === verification.buildJobId, "PHP_BUILD_REQUIRED", "PHP باید از خروجی همان worker موفق انتخاب شود.", 409);
  const row = store.db.prepare("SELECT state,data_json FROM code_repair_jobs WHERE actor_id=? AND id=? AND state='succeeded'").get(actor, verification.buildJobId);
  ensure(row, "PHP_BUILD_REQUIRED", "رسید PHP همین کاربر موجود نیست.", 409);
  const job = parseCodeRepairJob({ ...object(object(JSON.parse(string(row.data_json, 1024 * 1024))).job), state: row.state }), receipt = job.afterTest?.buildOutput;
  ensure(job.build?.version === 12 && job.validationOnly && job.execution === "container" && (job.containerIds?.length ?? 0) >= 2 && job.afterTest?.passed && job.afterTest.exitCode === 0 && !job.afterTest.signal && receipt?.version === 2 &&
    job.baseRevision === verification.testedSourceHash && job.build.sourceHash === verification.testedSourceHash && fingerprint(job.build) === verification.planHash && receipt.sourceHash === verification.testedSourceHash && receipt.planHash === verification.planHash && receipt.artifactHash === verification.outputArtifactHash &&
    job.artifact?.archiveHash === flow.artifact.archiveHash && job.artifact.sourceHash === flow.profile.sourceHash && job.publication && fingerprint(parsePhpVerification({ ...job.publication, buildJobId: job.id, runtime: job.build.runtime })) === fingerprint(verification), "PHP_BUILD_REQUIRED", "تبار نصب، تست، محیط تازه و artifact برابر نیست.", 409);
  ensure(flow.profile.port === job.build.port && flow.profile.dockerRuntime.dockerfile === ".launchlane-php.Dockerfile" && phpEnvelopeFiles(verification).every(file => flow.profile.manifest.some(item => item.path === file.path && item.sha256 === createHash("sha256").update(file.content).digest("hex"))), "PHP_RUNTIME_CHANGED", "recipe یا bootstrap نصب PHP تغییر کرده است.", 409);
  assertIndependentBuildWorkload(job.build);
  return { verification, build: job.build, receipt };
}
