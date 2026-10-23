import type { ActionSpec, ProjectProfile } from "./domain.ts";
export function actionPlatform(spec: Pick<ActionSpec, "version">): "node" | "python" | "static" | "next" {
  return spec.version === 17 || spec.version === 18 ? "next" : spec.version === 15 || spec.version === 16 ? "static" : spec.version === 11 || spec.version === 12 ? "python" : "node";
}
export function profilePlatform(profile: ProjectProfile) { return profile.nextRuntime ? "next" : profile.runtime; }
