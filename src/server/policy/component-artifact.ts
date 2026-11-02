import { createHash } from "node:crypto";
import type { ProjectFlow } from "../../contracts/project-flow.ts";
import { parseCodeRepairJob } from "../../contracts/code-repair.ts";
import { parseComponentVerification } from "../../contracts/pnpm-component.ts";
import { object, string } from "../../contracts/validation.ts";
import { ensure } from "../errors.ts";
import { fingerprint } from "./action.ts";
import type { Store } from "../persistence/store.ts";
import { componentHostProgram, componentDockerfile } from "../agent/component-program.ts";

/** A source marker is data. Only an actor-owned, successful worker job supplies authority. */
export function assertComponentJob(store: Store, actor: string, flow: ProjectFlow) {
  const verification = flow.profile.pnpmComponent;
  ensure(verification && flow.profile.dockerRuntime && flow.artifact && flow.selection.kind === "repair" && flow.selection.jobId === verification.buildJobId,
    "COMPONENT_BUILD_REQUIRED", "component باید از خروجی همان worker موفق انتخاب شود.", 409);
  const row = store.db.prepare("SELECT state,data_json FROM code_repair_jobs WHERE id=? AND actor_id=? AND state='succeeded'").get(verification.buildJobId, actor);
  ensure(row, "COMPONENT_BUILD_REQUIRED", "رسید worker همین کاربر موجود نیست.", 409);
  const job = parseCodeRepairJob({ ...object(object(JSON.parse(string(row.data_json, 1024 * 1024))).job), state: row.state }), receipt = job.afterTest?.buildOutput;
  ensure(job.build?.version === 9 && job.validationOnly && job.execution === "container" && job.containerIds?.length && job.afterTest?.passed && job.afterTest.exitCode === 0 && !job.afterTest.signal && receipt?.version === 2 &&
    job.artifact?.archiveHash === flow.artifact.archiveHash && job.artifact.sourceHash === flow.profile.sourceHash && job.publication &&
    job.build.sourceHash === verification.testedSourceHash && fingerprint(job.build) === verification.planHash && receipt.artifactHash === verification.outputArtifactHash &&
    receipt.sourceHash === verification.testedSourceHash && receipt.planHash === verification.planHash &&
    fingerprint(parseComponentVerification({ ...job.publication, buildJobId: job.id, component: job.build.component, apiChecks: job.build.apiChecks })) === fingerprint(verification),
    "COMPONENT_BUILD_REQUIRED", "تبار component، آزمون یا خروجی compiled با نسخهٔ انتخاب‌شده برابر نیست.", 409);
  const digest = (value: string) => createHash("sha256").update(value).digest("hex"), expected = {
    ".launchlane-component.cjs": componentHostProgram, ".launchlane-component.Dockerfile": componentDockerfile(job.build.image, job.build.port),
    ".launchlane-component.json": `${JSON.stringify({ version: 1, verification, port: job.build.port })}\n`,
  };
  ensure(flow.profile.port === job.build.port && flow.profile.dockerRuntime.dockerfile === ".launchlane-component.Dockerfile" &&
    Object.entries(expected).every(([path, content]) => flow.profile.manifest.some(file => file.path === path && file.sha256 === digest(content))),
    "COMPONENT_RUNTIME_CHANGED", "host یا Dockerfile generated با نسخهٔ آزموده‌شده برابر نیست.", 409);
  return { verification, build: job.build, receipt };
}
