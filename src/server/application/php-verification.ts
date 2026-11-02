import type { ProjectFlow } from "../../contracts/project-flow.ts";
import type { Store } from "../persistence/store.ts";
import { assertPhpJob } from "../policy/php-artifact.ts";
import { componentOutputBytes } from "../agent/build-output-store.ts";
import { readArtifact } from "../workspace/archive.ts";
import { matchesPublishedBuildEnvironment } from "../environment/build.ts";
import { ensure } from "../errors.ts";
export { assertPhpJob } from "../policy/php-artifact.ts";

export async function localPhpVerification(store: Store, stateDir: string, actor: string, flow: ProjectFlow) {
  const result = assertPhpJob(store, actor, flow); await componentOutputBytes(stateDir, result.receipt);
  ensure(flow.artifact, "PHP_BUILD_REQUIRED", "artifact نصب PHP موجود نیست.", 409); await readArtifact(stateDir, store.getArtifact(actor, flow.artifact.archiveHash)); return result;
}
export async function phpVerification(store: Store, stateDir: string, actor: string, flow: ProjectFlow, secret: string) {
  const result = await localPhpVerification(store, stateDir, actor, flow); ensure(matchesPublishedBuildEnvironment({ sessionSecret: secret }, store, actor, flow.id, result.build), "PHP_ENV_CHANGED", "تنظیمات انتشار با نصب آزموده‌شده برابر نیست.", 409); return result.verification;
}
