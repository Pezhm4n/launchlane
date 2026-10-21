import { resolve } from "node:path";
import { AppError, ensure } from "./errors.ts";

export type Config = ReturnType<typeof readConfig>;

type Environment = Readonly<Record<string, string | undefined>>;

function flag(env: Environment, key: string): boolean {
  const value = env[key] ?? "false";
  ensure(
    value === "true" || value === "false",
    "CONFIG_INVALID",
    "مقدار gate باید true یا false باشد.",
    503,
  );
  return value === "true";
}

function limit(env: Environment, key: string, fallback: number, min: number, max: number): number {
  const raw = env[key];
  const value = raw === undefined || raw === "" ? fallback : Number(raw);
  ensure(
    Number.isSafeInteger(value) && value >= min && value <= max,
    "CONFIG_INVALID",
    "سقف اجرای محلی معتبر نیست.",
    503,
  );
  return value;
}

function fixedUrl(raw: string | undefined, expected: string): string {
  ensure(
    !raw || raw.replace(/\/$/, "") === expected,
    "CONFIG_INVALID",
    "مقصد سرویس با میزبان مجاز تطبیق ندارد.",
    503,
  );
  return expected;
}

export function readConfig(env: Environment = process.env) {
  const origin = env.LAUNCHLANE_ORIGIN || "http://127.0.0.1:3000";
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new AppError("CONFIG_INVALID", "origin محلی معتبر نیست.", 503);
  }
  ensure(
    parsed.protocol === "http:" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname) &&
      parsed.origin === origin &&
      !parsed.username &&
      !parsed.password,
    "CONFIG_INVALID",
    "این نسخه فقط روی origin محلی اجرا می‌شود.",
    503,
  );
  const teamId = env.LIARA_TEAM_ID || "";
  ensure(
    !teamId || /^[a-f0-9]{24}$/.test(teamId),
    "CONFIG_INVALID",
    "شناسه تیم تنظیم‌شده معتبر نیست.",
    503,
  );
  const apps = (env.LAUNCHLANE_APP_ALLOWLIST || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  ensure(
    apps.every((app) => /^[a-z0-9][a-z0-9-]{0,62}$/.test(app)),
    "CONFIG_INVALID",
    "فهرست برنامه‌های مجاز معتبر نیست.",
    503,
  );
  const operatorToken = env.LAUNCHLANE_OPERATOR_TOKEN || "";
  const sessionSecret = env.LAUNCHLANE_SESSION_SECRET || "";
  ensure(
    (!operatorToken || operatorToken.length >= 32) &&
      (!sessionSecret || sessionSecret.length >= 32) &&
      (!operatorToken || operatorToken !== sessionSecret),
    "CONFIG_INVALID",
    "کلیدهای محلی باید مستقل و حداقل ۳۲ نویسه باشند.",
    503,
  );
  return {
    origin,
    operatorToken,
    sessionSecret,
    authConfigured: operatorToken.length >= 32 && sessionSecret.length >= 32,
    // Runtime-only operator paths. Do not trace private workspace/state into a server build.
    workspaceRoot: env.LAUNCHLANE_WORKSPACE_ROOT
      ? resolve(/* turbopackIgnore: true */ env.LAUNCHLANE_WORKSPACE_ROOT)
      : null,
    stateDir: resolve(/* turbopackIgnore: true */ env.LAUNCHLANE_STATE_DIR || ".data"),
    teamId,
    apps: [...new Set(apps)],
    liaraBaseUrl: fixedUrl(env.LIARA_API_BASE_URL, "https://api.liara.ir"),
    liaraToken: env.LIARA_API_TOKEN || "",
    modelBaseUrl: fixedUrl(env.MODEL_BASE_URL, "https://ai.boxapi.ir/ai/v1"),
    modelKey: env.MODEL_API_KEY || "",
    modelId: env.MODEL_ID || "",
    enableMutations: flag(env, "LAUNCHLANE_ENABLE_MUTATIONS"),
    enableLiveModel: flag(env, "LAUNCHLANE_ENABLE_LIVE_MODEL"),
    maxModelCalls: limit(env, "LAUNCHLANE_MAX_MODEL_CALLS", 8, 1, 8),
    maxToolCalls: limit(env, "LAUNCHLANE_MAX_TOOL_CALLS", 12, 1, 12),
    runTimeoutMs: limit(env, "LAUNCHLANE_RUN_TIMEOUT_MS", 120_000, 100, 120_000),
    modelOutputTokens: limit(env, "LAUNCHLANE_MODEL_OUTPUT_TOKENS", 1024, 32, 4096),
  };
}
