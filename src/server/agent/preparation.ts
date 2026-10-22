import type { NodePreparation } from "../../contracts/preparation.ts";
import { object } from "../../contracts/validation.ts";
import { ensure } from "../errors.ts";
import { fingerprint } from "../policy/action.ts";
import type { SourceFile } from "../workspace/inspect.ts";

function json(files: readonly SourceFile[], path: string): Record<string, unknown> {
  const file = files.find((file) => file.path === path);
  ensure(file, "PREPARATION_FILE_REQUIRED", `فایل «${path}» در پروژه نیست.`, 409);
  return object(JSON.parse(file.content.toString("utf8")));
}
export function preparationPaths(files: readonly SourceFile[], plan: NodePreparation): string[] {
  const pkg = json(files, "package.json");
  ensure(pkg.workspaces === undefined, "PREPARATION_LEAF_REQUIRED", "زیرپوشه همان برنامه را انتخاب کنید؛ فرمان ریشه monorepo تغییر نمی‌کند.", 409);
  ensure([pkg.dependencies, pkg.devDependencies, pkg.optionalDependencies].every((value) => value === undefined || Object.keys(object(value)).length === 0),
    "PREPARATION_BUILD_UNSUPPORTED", "این قرارداد برای Node بدون dependency است؛ نصب و build به executor جدا نیاز دارد.", 409);
  ensure(files.some((file) => file.path === plan.entryFile), "PREPARATION_ENTRY_DENIED", "فایل ورودی باید در source موجود باشد.", 409);
  return ["package.json", plan.entryFile, ...(files.some((file) => file.path === "liara.json") ? ["liara.json"] : [])];
}
function withoutStart(pkg: Record<string, unknown>) {
  const scripts = object(pkg.scripts), { start: _start, ...unchanged } = scripts;
  return { ...pkg, scripts: unchanged };
}
export function validatePreparationPatch(before: readonly SourceFile[], after: readonly SourceFile[], plan: NodePreparation): void {
  const original = json(before, "package.json"), changed = json(after, "package.json");
  // The approval permits one explicit start command, not authority to rewrite the package's executable surface.
  ensure(object(changed.scripts).start === plan.startCommand && fingerprint(withoutStart(original)) === fingerprint(withoutStart(changed)),
    "REPAIR_COMMAND_CHANGED", "فقط فرمان start مصوب قابل تغییر است؛ تست‌ها، engine، scriptهای دیگر و dependencyها باید حفظ شوند.", 409);
  const oldConfig = before.find((file) => file.path === "liara.json");
  if (oldConfig) {
    const { port: _oldPort, ...oldRest } = json(before, "liara.json"),
      { port, ...newRest } = json(after, "liara.json");
    ensure(port === plan.port && fingerprint(oldRest) === fingerprint(newRest),
      "REPAIR_COMMAND_CHANGED", "در تنظیمات موجود فقط پورت مصوب قابل تغییر است.", 409);
  }
}
