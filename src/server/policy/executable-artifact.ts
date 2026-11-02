import { assertIndependentBuildWorkload } from "./build-workload.ts";
import { createHash } from "node:crypto";
import type { ProjectFlow } from "../../contracts/project-flow.ts";
import { parseCodeRepairJob } from "../../contracts/code-repair.ts";
import { object, string } from "../../contracts/validation.ts";
import { parseExecutableVerification } from "../../contracts/go-runtime.ts";
import type { Store } from "../persistence/store.ts";
import { ensure } from "../errors.ts";
import { fingerprint } from "./action.ts";
import { executableDockerfile, executableHostProgram } from "../agent/executable-program.ts";

export function assertExecutableJob(store: Store, actor: string, flow: ProjectFlow) {
  const verification = flow.profile.compiledExecutable;
  ensure(verification && flow.profile.dockerRuntime && flow.artifact && flow.selection.kind === "repair" && flow.selection.jobId === verification.buildJobId,
    "EXECUTABLE_BUILD_REQUIRED", "executable باید از خروجی همان worker موفق انتخاب شود.", 409);
  const row = store.db.prepare("SELECT state,data_json FROM code_repair_jobs WHERE actor_id=? AND id=? AND state='succeeded'").get(actor, verification.buildJobId);
  ensure(row, "EXECUTABLE_BUILD_REQUIRED", "رسید executable همین کاربر موجود نیست.", 409);
  const job = parseCodeRepairJob({ ...object(object(JSON.parse(string(row.data_json, 1024 * 1024))).job), state: row.state }), receipt = job.afterTest?.buildOutput;
  ensure(job.build?.version === 11 && job.validationOnly && job.execution === "container" && (job.containerIds?.length ?? 0) >= 2 && job.afterTest?.passed && job.afterTest.exitCode === 0 && !job.afterTest.signal && receipt?.version === 3 &&
    job.baseRevision === verification.testedSourceHash && job.build.sourceHash === verification.testedSourceHash && fingerprint(job.build) === verification.planHash &&
    receipt.sourceHash === verification.testedSourceHash && receipt.planHash === verification.planHash && receipt.artifactHash === verification.outputArtifactHash &&
    job.artifact?.archiveHash === flow.artifact.archiveHash && job.artifact.sourceHash === flow.profile.sourceHash && job.publication &&
    fingerprint(parseExecutableVerification({ ...job.publication, buildJobId: job.id, runtime: job.build.runtime })) === fingerprint(verification),
    "EXECUTABLE_BUILD_REQUIRED", "تبار باینری، تست و محیط تازه با artifact انتخاب‌شده برابر نیست.", 409);
  const expected = { ".launchlane-executable.cjs": executableHostProgram, ".launchlane-executable.Dockerfile": executableDockerfile(job.build.runtime),
    ".launchlane-executable.json": `${JSON.stringify({ version: 1, verification, port: job.build.port })}\n` };
  ensure(flow.profile.port === job.build.port && flow.profile.dockerRuntime.dockerfile === ".launchlane-executable.Dockerfile" && Object.entries(expected).every(([path, content]) => flow.profile.manifest.some(file => file.path === path && file.sha256 === createHash("sha256").update(content).digest("hex"))),
    "EXECUTABLE_RUNTIME_CHANGED", "recipe یا proxy نسخهٔ compiled تغییر کرده است.", 409);
  assertIndependentBuildWorkload(job.build);
  return { verification, build: job.build, receipt };
}
