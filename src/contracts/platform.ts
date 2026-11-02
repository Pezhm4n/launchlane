import type { ActionSpec, ProjectProfile } from "./domain.ts";
export function actionPlatform(spec: ActionSpec): "node" | "python" | "static" | "next" | "react" | "vue" | "angular" | "docker" | "flask" | "django" {
  if (spec.version === 41 || spec.version === 42) return spec.runtime.kind;
  if ((spec.version === 21 || spec.version === 40 || spec.version === 43 || spec.version === 44) || spec.version === 22) return "docker";
  if (spec.version === 19 || spec.version === 20) return spec.runtime.kind;
  return spec.version === 17 || spec.version === 18 ? "next" : spec.version === 15 || spec.version === 16 ? "static" : spec.version === 11 || spec.version === 12 ? "python" : "node";
}
export function profilePlatform(profile: ProjectProfile) { return profile.pythonRuntime && profile.pythonRuntime.kind !== "python" ? profile.pythonRuntime.kind : profile.frontendRuntime?.kind ?? (profile.nextRuntime ? "next" : profile.runtime); }
