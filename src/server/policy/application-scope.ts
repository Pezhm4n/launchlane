import type { ProjectProfile } from "../../contracts/domain.ts";
import { ensure } from "../errors.ts";

export function separateApplicationRequirements(profile: Pick<ProjectProfile, "applicationRequirements"> & Partial<Pick<ProjectProfile, "fullstack" | "start" | "build">>) {
  const compiledWorker = profile.fullstack?.workerSqlite && !profile.fullstack.requiresPreparation && profile.start === "node launchlane-worker-server.mjs" && profile.build === "node .launchlane-build.cjs";
  return profile.applicationRequirements?.requirements.filter(requirement => requirement.need !== "optional" &&
    ((requirement.kind === "cloudflare_worker" && !(compiledWorker && requirement.consumerRoot === ".")) || requirement.kind === "wordpress_host" || requirement.kind === "backend_api" && requirement.consumerRoot !== "." ||
      ["background_worker", "scheduler"].includes(requirement.kind) && requirement.consumerRoot !== ".")) ?? [];
}
/** A frontend artifact must not silently discharge the obligations of another runtime. */
export function assertApplicationPublicationScope(profile: ProjectProfile): void {
  const inspection = profile.applicationRequirements;
  if (!inspection) return; // Historical snapshots acquire no invented resource evidence.
  ensure(inspection.sourceHash === profile.sourceHash, "APPLICATION_SOURCE_CHANGED", "نیازهای برنامه متعلق به همین نسخهٔ source نیستند.", 409);
  ensure(!inspection.diagnostics.length, "APPLICATION_ANALYSIS_INCOMPLETE", "بخشی از نیازهای برنامه قابل بررسی نبود؛ نبود نتیجه به معنای نبود API یا منابع نیست.", 409);
  ensure(!separateApplicationRequirements(profile).length, "APPLICATION_TOPOLOGY_REQUIRED", "این پروژه بخش‌های اجرایی دیگری دارد. انتشار یک فرانت یا image بدون برنامه و سنجش آن بخش‌ها، انتشار کامل پروژه نیست.", 409);
}
