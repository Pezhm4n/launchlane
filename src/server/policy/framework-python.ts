import type { ProjectFlow } from "../../contracts/project-flow.ts";
import { parseCodeRepairJob } from "../../contracts/code-repair.ts";
import { object, string } from "../../contracts/validation.ts";
import type { Store } from "../persistence/store.ts";
import { ensure } from "../errors.ts";
import { fingerprint } from "./action.ts";

export function assertFrameworkBuild(store: Store, actor: string, flow: ProjectFlow) {
  ensure(flow.selection.kind === "repair" && flow.artifact, "FRAMEWORK_BUILD_REQUIRED", "ابتدا runner و پاسخ همین نسخه در worker باید بررسی شوند.", 409);
  const row = store.db.prepare("SELECT state,data_json FROM code_repair_jobs WHERE id=? AND actor_id=?").get(flow.selection.jobId, actor);
  ensure(row, "FRAMEWORK_BUILD_REQUIRED", "رسید worker همین کاربر موجود نیست.", 409);
  const job = parseCodeRepairJob({ ...object(object(JSON.parse(string(row.data_json, 1024 * 1024))).job), state: row.state });
  ensure(job.state === "succeeded" && job.build?.version === 10 && job.validationOnly && job.execution === "container" && job.containerIds?.length && job.afterTest?.passed && job.afterTest.exitCode === 0 && !job.afterTest.signal &&
    job.baseRevision === flow.profile.sourceHash && job.artifact?.archiveHash === flow.artifact.archiveHash && job.artifact.sourceHash === flow.profile.sourceHash && fingerprint(job.build.runtime) === fingerprint(flow.profile.pythonRuntime),
    "FRAMEWORK_BUILD_REQUIRED", "رسید framework با نسخه و خروجی انتخاب‌شده برابر نیست.", 409);
  return job.build;
}
