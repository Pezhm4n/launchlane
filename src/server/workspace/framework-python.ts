import { parseFrameworkPythonRuntime, type FrameworkPythonRuntime } from "../../contracts/framework-python.ts";
import type { NativePlatformInspection } from "../../contracts/liara-platform.ts";
import type { SourceFile } from "./inspect.ts";
import { object } from "../../contracts/validation.ts";
import { ensure } from "../errors.ts";

export function frameworkPythonRuntime(files: readonly SourceFile[], inspection: NativePlatformInspection, liara: Record<string, unknown>): FrameworkPythonRuntime | undefined {
  if (inspection.state !== "detected" || !["flask", "django"].includes(inspection.descriptor.platform)) return;
  const descriptor = inspection.descriptor, kind = descriptor.platform === "flask" ? "flask" : "django", config = object(liara[kind] ?? {});
  if (liara.platform !== kind || config.pythonVersion !== "3.12" || descriptor.port === null) return;
  ensure(descriptor.runtimeVersion === "3.12" && descriptor.port !== null && files.some(file => file.path === "requirements.txt") && !files.some(file => file.path === "pyproject.toml"),
    "FRAMEWORK_PREPARATION_REQUIRED", "نسخه 3.12، پورت و requirements قفل‌شده لازم‌اند؛ pyproject به آماده‌سازی مستقل نیاز دارد.", 409);
  ensure(config.mirror === false && config.timezone === undefined && config.geospatial === undefined, "FRAMEWORK_CONFIGURATION_UNSUPPORTED", "تنظیمات اضافهٔ framework باید جداگانه بررسی شوند؛ mirror باید صریحاً خاموش باشد.", 409);
  const requirements = files.find(file => file.path === "requirements.txt")?.content.toString() ?? "";
  ensure(/^gunicorn==[0-9]/im.test(requirements), "FRAMEWORK_SERVER_REQUIRED", "Gunicorn باید در requirements اصلی با نسخه دقیق موجود باشد.", 409);
  let module: string;
  if (kind === "flask") module = String(descriptor.configuration.appModule ?? "");
  else {
    ensure(config.collectStatic === false && config.modifySettings === false && config.compileMessages === false,
      "DJANGO_BUILD_EFFECTS_UNREVIEWED", "collectstatic، تغییر settings و compilemessages باید پیش از اجرا جداگانه بررسی شوند.", 409);
    const gateways = files.filter(file => file.path.endsWith("/wsgi.py") && /get_wsgi_application\s*\(/.test(file.content.toString()));
    ensure(gateways.length === 1, "FRAMEWORK_ENTRY_AMBIGUOUS", "یک ورودی WSGI مشخص برای Django لازم است.", 409);
    module = `${gateways[0]?.path.replace(/\.py$/, "").replaceAll("/", ".")}:application`;
  }
  const port = descriptor.port;
  return parseFrameworkPythonRuntime({ kind, version: "3.12", module, port, command: ["python3", "-m", "gunicorn", module, "--bind", `0.0.0.0:${port}`] });
}
