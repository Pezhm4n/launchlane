import semver from "semver";
import { NODE_VERSIONS, type NodeRuntime } from "../../contracts/node-runtime.ts";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function resolveNodeRuntime(engines: unknown, node: unknown): NodeRuntime {
  const blocked = (
    source: NodeRuntime["source"],
    detail: string,
    requirement: string | null = null,
  ): NodeRuntime => ({ version: null, source, requirement, detail });
  if (engines !== undefined && !record(engines))
    return blocked(
      "package.json",
      "بخش engines در package.json معتبر نیست؛ آن را اصلاح و پروژه را دوباره بررسی کنید.",
    );
  if (node !== undefined && !record(node))
    return blocked(
      "liara.json",
      "بخش node در liara.json معتبر نیست؛ یک شیء با version مانند 24 تعیین کنید.",
    );
  const required = record(engines) ? engines.node : undefined;
  const configured = record(node) ? node.version : undefined;
  let requirement: string | null = null;
  if (required !== undefined) {
    if (
      typeof required !== "string" ||
      !required.trim() ||
      required.length > 128 ||
      !semver.validRange(required)
    )
      return blocked(
        "package.json",
        "محدوده نسخه Node در engines.node معتبر نیست؛ برای نمونه 24.x یا >=22 <25 بنویسید و دوباره بررسی کنید.",
      );
    requirement = required.trim();
  }
  const majorRange = (version: string) => `>=${version}.0.0 <${Number(version) + 1}.0.0-0`;
  const compatible = NODE_VERSIONS.filter(
    (version) => !requirement || semver.intersects(majorRange(version), requirement),
  );
  const source =
    configured !== undefined ? "liara.json" : requirement ? "package.json" : "liara-default";
  let version: NodeRuntime["version"];
  if (configured !== undefined) {
    version = NODE_VERSIONS.find((version) => version === configured) ?? null;
    if (!version)
      return blocked(
        source,
        "نسخه node.version در liara.json باید یکی از شاخه‌های مستند مانند رشته 22 یا 24 باشد؛ تنظیم را اصلاح و دوباره بررسی کنید.",
        requirement,
      );
    if (!compatible.includes(version))
      return blocked(
        source,
        "نسخه Node در liara.json با engines.node در package.json سازگار نیست؛ این دو تنظیم را هماهنگ و دوباره بررسی کنید.",
        requirement,
      );
  } else {
    // Prefer the documented provider default when allowed; never use this computer's Node.
    version = compatible.includes("22") ? "22" : (compatible.at(-1) ?? null);
    if (!version)
      return blocked(
        source,
        "محدوده Node پروژه با نسخه‌های مستند لیارا تطبیق ندارد؛ engines.node و نسخه‌های قابل استفاده را بررسی کنید.",
        requirement,
      );
  }
  const partial = requirement !== null && !semver.subset(majorRange(version), requirement);
  return {
    version,
    source,
    requirement,
    detail:
      source === "liara-default"
        ? "پروژه نسخه Node تعیین نکرده است؛ شاخه 22، پیش‌فرض مستند لیارا، برای پیشنهاد انتخاب شد."
        : `شاخه ${version} از ${source} انتخاب شد.${partial ? " پروژه نسخه جزئی مشخص‌تری می‌خواهد؛ این تنظیم فقط شاخه اصلی را تعیین می‌کند و نسخه جزئی محیط لیارا هنوز تأیید نشده است." : ""}`,
  };
}
