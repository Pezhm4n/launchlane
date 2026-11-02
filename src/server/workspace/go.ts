import semver from "semver";
import { goToolchain, parseGoRuntime, type GoRuntime } from "../../contracts/go-runtime.ts";
import type { NativePlatformInspection } from "../../contracts/liara-platform.ts";
import type { SourceFile } from "./inspect.ts";
import { object } from "../../contracts/validation.ts";
import { ensure } from "../errors.ts";
import { inspectGoEnvironment } from "./go-environment.ts";

export function sourceGoRuntime(files: readonly SourceFile[], inspection: NativePlatformInspection, liara: Record<string, unknown>): GoRuntime | undefined {
  if (inspection.state !== "detected" || inspection.descriptor.platform !== "go" || liara.platform !== "go") return;
  const descriptor = inspection.descriptor, source = files.find(file => file.path === "go.mod"), config = object(liara.go ?? {});
  if (descriptor.runtimeVersion !== "1.25" || descriptor.port === null || config.mirror !== false) return;
  ensure(source && descriptor.runtimeVersion === "1.25" && descriptor.port !== null && config.mirror === false,
    "GO_PREPARATION_REQUIRED", "Go 1.25، پورت صریح و mirror خاموش برای این toolchain لازم‌اند.", 409);
  const mod = source.content.toString("utf8").replace(/\/\/[^\n]*/g, ""), entry = descriptor.entry;
  ensure(!files.some(file => file.path.endsWith("go.work") || file.path.endsWith("go.work.sum") || file.path !== "go.mod" && file.path.endsWith("/go.mod")),
    "GO_WORKSPACE_REQUIRED", "workspace یا moduleهای مستقل Go به انتخاب و برنامهٔ اجرای component نیاز دارند؛ flatten نمی‌شوند.", 409);
  ensure(!/^\s*(?:replace|exclude|tool)\b/m.test(mod), "GO_MODULE_CONFIGURATION_UNSUPPORTED", "replace، exclude و ابزارهای module باید جداگانه بررسی شوند.", 409);
  ensure(!/^\s*require\b/m.test(mod) || files.some(file => file.path === "go.sum" && file.content.length > 0), "GO_SUM_REQUIRED", "وابستگی‌های module به go.sum اصلی و کامل نیاز دارند؛ lock ساخته یا جایگزین نمی‌شود.", 409);
  for (const match of mod.matchAll(/^\s*(?:go|toolchain\s+go)\s*(1\.\d+(?:\.\d+)?)\s*$/gm)) {
    const required = match[1]?.split(".").length === 2 ? `${match[1]}.0` : match[1];
    ensure(required && semver.lte(required, goToolchain.version), "GO_TOOLCHAIN_UNAVAILABLE", "toolchain پروژه از نسخهٔ تثبیت‌شده جدیدتر است؛ نسخه ناسازگار اجرا نمی‌شود.", 409);
  }
  const go = files.filter(file => file.path.endsWith(".go")).map(file => ({ file, inspected: inspectGoEnvironment(file.content.toString()) }));
  const mains = go.filter(row => !row.file.path.endsWith("_test.go") && row.inspected.hasMain);
  ensure(!go.some(row => !row.file.path.endsWith("_test.go") && row.inspected.unresolved), "GO_ENVIRONMENT_DYNAMIC", "نام یا binding تنظیمات Go پویا یا مبهم است؛ قبل از اجرای خصوصی باید روشن شود.", 409);
  ensure(entry && mains.length === 1 && mains[0]?.file.path === entry, "GO_COMPONENT_SCOPE_REQUIRED", "یک برنامهٔ اجرایی Go لازم است؛ سایر workerها یا serverها حذف نمی‌شوند.", 409);
  ensure(!go.some(row => row.inspected.imports.some(imported => imported.path === "C")), "GO_CGO_UNSUPPORTED", "نیاز cgo و کتابخانه‌های native باید جداگانه آماده شود.", 409);
  const folder = entry.includes("/") ? `./${entry.slice(0, entry.lastIndexOf("/"))}` : ".";
  return parseGoRuntime({ kind: "go", version: goToolchain.version, packagePath: folder, port: descriptor.port });
}
