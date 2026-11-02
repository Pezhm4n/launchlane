import { parseFrontendRuntime, type FrontendRuntime } from "../../contracts/frontend-runtime.ts";
import { object } from "../../contracts/validation.ts";
import { ensure } from "../errors.ts";
import type { SourceFile } from "./inspect.ts";
import { angularOutput } from "./angular.ts";

export function frontendRuntime(pkg: Record<string, unknown>, liara: Record<string, unknown>, files: readonly SourceFile[]): FrontendRuntime | undefined {
  const deps = { ...object(pkg.devDependencies ?? {}), ...object(pkg.dependencies ?? {}) }, build = object(pkg.scripts ?? {}).build;
  if (pkg.workspaces !== undefined || deps.next || deps.nuxt || liara.platform === "node") return undefined;
  const candidates = [typeof deps.react === "string" && (deps.vite || deps["react-scripts"]) ? "react" : null,
    typeof deps.vue === "string" && (deps.vite || deps["@vue/cli-service"]) ? "vue" : null,
    typeof deps["@angular/core"] === "string" && deps["@angular/cli"] ? "angular" : null].filter(kind => kind !== null);
  if (!candidates.length) return undefined;
  ensure(candidates.length === 1, "FRONTEND_AMBIGUOUS", "بیش از یک رابط مستقل در این پوشه پیدا شد؛ زیرپوشه همان برنامه را انتخاب کنید.", 409);
  const kind = candidates[0];
  ensure(typeof build === "string" && build.trim(), "FRONTEND_BUILD_REQUIRED", "فرمان ساخت رابط در پروژه موجود نیست؛ آماده‌سازی فرمان build لازم است.", 409);
  const mirror = object(liara[kind ?? ""] ?? {}).mirror ?? false;
  if (kind === "react" || kind === "vue") return parseFrontendRuntime({ kind, nodeVersion: "20", mirror,
    builder: deps.vite ? "vite" : kind === "react" ? "react-scripts" : "vue-cli", outputDirectory: kind === "react" ? "build" : "dist" });
  const file = files.find(row => row.path === "angular.json");
  ensure(file, "FRONTEND_ROOT_REQUIRED", "تنظیمات Angular در پوشه انتخاب‌شده پیدا نشد؛ ریشه همان برنامه را انتخاب کنید.", 409);
  const config = object(JSON.parse(file.content.toString("utf8")));
  return parseFrontendRuntime({ kind: "angular", builder: "angular-cli", nodeVersion: "20", mirror,
    outputDirectory: angularOutput(object(config.projects), build) });
}
