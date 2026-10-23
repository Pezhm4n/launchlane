import { resolve } from "node:path";
import { AppError, ensure } from "./errors.ts";
import { parseProbeOrigins } from "./policy/probe-target.ts";

export type Config = ReturnType<typeof readConfig>;

export const permittedChatModels: readonly string[] = [
  "gpt-6.1-sol",
  "gpt-6-astra",
  "gpt-6-luna",
  "gpt-6-sol",
  "gpt-5-mini",
  "gpt-5.6-luna",
  "gpt-5.6-terra",
  "gpt-5.6-sol",
  "gpt-5.4-mini",
  "gpt-5.3-codex",
];

type Environment = Readonly<Record<string, string | undefined>>;

function authenticationMode(value: string): "operator" | "liara" {
  ensure(value === "operator" || value === "liara", "CONFIG_INVALID", "روش ورود معتبر نیست.", 503);
  return value;
}

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
  const authMode = authenticationMode(env.LAUNCHLANE_AUTH_MODE || "operator");
  const origin = env.LAUNCHLANE_ORIGIN || "http://127.0.0.1:3000";
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new AppError("CONFIG_INVALID", "origin محلی معتبر نیست.", 503);
  }
  ensure(
    ((parsed.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname)) ||
      (authMode === "liara" && parsed.protocol === "https:")) &&
      parsed.origin === origin &&
      !parsed.username &&
      !parsed.password,
    "CONFIG_INVALID",
    "نشانی نصب باید محلی باشد؛ ورود عمومی به نشانی ثابت HTTPS نیاز دارد.",
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
  const modelReasoningEffort = env.MODEL_REASONING_EFFORT || "none";
  const modelId = env.MODEL_ID || "";
  ensure(
    !modelId || permittedChatModels.includes(modelId),
    "CONFIG_INVALID",
    "مدل انتخابی در فهرست مجاز Chat این نصب نیست.",
    503,
  );
  ensure(
    ["none", "low", "medium", "high"].includes(modelReasoningEffort),
    "CONFIG_INVALID",
    "سطح reasoning تنظیم‌شده معتبر نیست.",
    503,
  );
  ensure(
    (!operatorToken || operatorToken.length >= 32) &&
      (!sessionSecret || sessionSecret.length >= 32) &&
      (!operatorToken || operatorToken !== sessionSecret),
    "CONFIG_INVALID",
    "کلیدهای محلی باید مستقل و حداقل ۳۲ نویسه باشند.",
    503,
  );
  return {
    authMode,
    origin,
    operatorToken: authMode === "operator" ? operatorToken : "",
    sessionSecret,
    projectSecretValues: [] as readonly string[],
    authConfigured: sessionSecret.length >= 32 && (authMode === "liara" || operatorToken.length >= 32),
    // Runtime-only operator paths. Do not trace private workspace/state into a server build.
    workspaceRoot: authMode === "operator" && env.LAUNCHLANE_WORKSPACE_ROOT
      ? resolve(/* turbopackIgnore: true */ env.LAUNCHLANE_WORKSPACE_ROOT)
      : null,
    stateDir: resolve(/* turbopackIgnore: true */ env.LAUNCHLANE_STATE_DIR || ".data"),
    teamId: authMode === "operator" ? teamId : "",
    apps: authMode === "operator" ? [...new Set(apps)] : [],
    probeOrigins: parseProbeOrigins(authMode === "operator" ? env.LAUNCHLANE_PROBE_ORIGINS : undefined, authMode === "operator" ? apps : []),
    liaraBaseUrl: fixedUrl(env.LIARA_API_BASE_URL, "https://api.liara.ir"),
    liaraToken: authMode === "operator" ? env.LIARA_API_TOKEN || "" : "",
    githubCliPath: authMode === "operator" && env.LAUNCHLANE_GITHUB_CLI_PATH
      ? resolve(/* turbopackIgnore: true */ env.LAUNCHLANE_GITHUB_CLI_PATH)
      : "",
    modelBaseUrl: fixedUrl(env.MODEL_BASE_URL, "https://ai.boxapi.ir/ai/v1"),
    modelKey: env.MODEL_API_KEY || "",
    modelId,
    modelReasoningEffort,
    enableMutations: flag(env, "LAUNCHLANE_ENABLE_MUTATIONS"),
    enableLiveModel: flag(env, "LAUNCHLANE_ENABLE_LIVE_MODEL"),
    enableLiveLiara: flag(env, "LAUNCHLANE_ENABLE_LIVE_LIARA"),
    enableLocalRepair: flag(env, "LAUNCHLANE_ENABLE_LOCAL_REPAIR"),
    maxModelCalls: limit(env, "LAUNCHLANE_MAX_MODEL_CALLS", 8, 1, 8),
    maxToolCalls: limit(env, "LAUNCHLANE_MAX_TOOL_CALLS", 12, 1, 12),
    agentMaxModelCalls: limit(env, "LAUNCHLANE_AGENT_MAX_MODEL_CALLS", 24, 1, 24),
    // Dependency reads, a bounded repair and release readback share one durable allowance.
    agentMaxToolCalls: limit(env, "LAUNCHLANE_AGENT_MAX_TOOL_CALLS", 160, 1, 160),
    agentTimeoutMs: limit(env, "LAUNCHLANE_AGENT_TIMEOUT_MS", 600_000, 100, 900_000),
    runTimeoutMs: limit(env, "LAUNCHLANE_RUN_TIMEOUT_MS", 120_000, 100, 120_000),
    modelOutputTokens: limit(env, "LAUNCHLANE_MODEL_OUTPUT_TOKENS", 1024, 32, 4096),
  };
}
