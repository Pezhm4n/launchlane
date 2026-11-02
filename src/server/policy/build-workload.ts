import type { ProjectBuildPlan } from "../../contracts/project-build.ts";
import { ensure } from "../errors.ts";

/** The generated proof correlates bytes; it cannot stand in for application behavior. */
export function assertIndependentBuildWorkload(plan: Pick<ProjectBuildPlan, "version" | "workload">): void {
  if (![7, 9, 11, 12].includes(plan.version)) return;
  const path = new URL(plan.workload.path, "https://build.invalid").pathname;
  ensure(path !== "/launchlane-build-proof.json", "BUILD_WORKLOAD_RESERVED", "گواه داخلی build جای رفتار واقعی برنامه نیست؛ مسیر اصلی صفحه یا API لازم است.", 409);
}
