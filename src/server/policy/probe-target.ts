import { isIP } from "node:net";
import { object } from "../../contracts/validation.ts";
import { AppError, ensure } from "../errors.ts";

export function parseProbeOrigins(
  raw: string | undefined,
  apps: readonly string[],
): Readonly<Record<string, string>> {
  if (!raw) return {};
  try {
    ensure(raw.length <= 8192, "CONFIG_INVALID", "فهرست مقصد بررسی بیش از سقف است.", 503);
    const entries = object(JSON.parse(raw)),
      result: Record<string, string> = {};
    ensure(
      Object.keys(entries).length <= 20,
      "CONFIG_INVALID",
      "تعداد مقصد بررسی بیش از سقف است.",
      503,
    );
    for (const [app, value] of Object.entries(entries)) {
      ensure(
        apps.includes(app) && typeof value === "string",
        "CONFIG_INVALID",
        "مقصد بررسی باید به برنامه مجاز متصل باشد.",
        503,
      );
      const url = new URL(value);
      ensure(
        url.protocol === "https:" &&
          url.origin === value &&
          !url.username &&
          !url.password &&
          !url.port &&
          !isIP(url.hostname) &&
          /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(url.hostname) &&
          url.hostname.includes(".") &&
          !url.hostname.endsWith(".localhost") &&
          !url.hostname.endsWith(".local"),
        "CONFIG_INVALID",
        "مقصد بررسی باید یک origin مشخص HTTPS عمومی باشد.",
        503,
      );
      result[app] = value;
    }
    return result;
  } catch (error) {
    if (error instanceof AppError && error.code === "CONFIG_INVALID") throw error;
    throw new AppError("CONFIG_INVALID", "فهرست مقصد بررسی معتبر نیست.", 503);
  }
}
