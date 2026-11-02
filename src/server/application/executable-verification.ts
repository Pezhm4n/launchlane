import type { ProjectFlow } from "../../contracts/project-flow.ts";
import type { Store } from "../persistence/store.ts";
import { assertExecutableJob } from "../policy/executable-artifact.ts";
import { executableOutputBytes } from "../agent/build-output-store.ts";
import { readArtifact } from "../workspace/archive.ts";
import { matchesPublishedBuildEnvironment } from "../environment/build.ts";
import { ensure } from "../errors.ts";
export { assertExecutableJob } from "../policy/executable-artifact.ts";

export async function localExecutableVerification(store: Store, stateDir: string, actor: string, flow: ProjectFlow) {
  const result = assertExecutableJob(store, actor, flow);
  await executableOutputBytes(stateDir, result.receipt);
  ensure(flow.artifact, "EXECUTABLE_BUILD_REQUIRED", "artifact موجود نیست.", 409);
  await readArtifact(stateDir, store.getArtifact(actor, flow.artifact.archiveHash)); return result;
}
export async function executableVerification(store: Store, stateDir: string, actor: string, flow: ProjectFlow, secret: string) {
  const result = await localExecutableVerification(store, stateDir, actor, flow);
  ensure(matchesPublishedBuildEnvironment({ sessionSecret: secret }, store, actor, flow.id, result.build), "EXECUTABLE_ENV_CHANGED", "تنظیمات انتشار با همان باینری آزموده‌شده برابر نیست.", 409);
  return result.verification;
}
