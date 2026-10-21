import { spawn } from "node:child_process";
import { mkdir, lstat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { stripVTControlCharacters } from "node:util";
import type { Config } from "../config.ts";
import { AppError, ensure } from "../errors.ts";
import { fingerprint } from "../policy/action.ts";

export type GitHubAuthSource = "cli_private" | "cli_system";
export type GitHubResponse = {
  status: number;
  body: Buffer;
  hasNext: boolean;
  rateLimited: boolean;
};
export type GitHubTransport = (
  path: string,
  signal: AbortSignal,
  maxBytes?: number,
) => Promise<GitHubResponse>;

export async function githubEnvironment(
  config: Config,
  actorId: string,
  source: GitHubAuthSource,
): Promise<NodeJS.ProcessEnv> {
  const env: NodeJS.ProcessEnv = { NODE_ENV: "production" };
  // Provider/model keys, debug flags and arbitrary shell configuration never enter the child.
  for (const name of [
    "PATH",
    "SystemRoot",
    "WINDIR",
    "APPDATA",
    "LOCALAPPDATA",
    "TEMP",
    "TMP",
    "USERPROFILE",
    "HOME",
    "XDG_CONFIG_HOME",
    "XDG_DATA_HOME",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "NO_PROXY",
    "SSL_CERT_FILE",
    "SSL_CERT_DIR",
  ])
    if (process.env[name]) env[name] = process.env[name];
  if (source === "cli_private") {
    const path = join(config.stateDir, "github-cli", fingerprint({ actorId }));
    for (const directory of [config.stateDir, join(config.stateDir, "github-cli"), path]) {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const stat = await lstat(directory);
      ensure(
        stat.isDirectory() && !stat.isSymbolicLink(),
        "CREDENTIAL_STORAGE_UNAVAILABLE",
        "پوشه امن اتصال GitHub در دسترس نیست.",
        503,
      );
    }
    env.GH_CONFIG_DIR = path;
  }
  return {
    ...env,
    GH_PROMPT_DISABLED: "1",
    GH_NO_UPDATE_NOTIFIER: "1",
    GH_NO_EXTENSION_UPDATE_NOTIFIER: "1",
    GH_TELEMETRY: "0",
    NO_COLOR: "1",
    GH_HOST: "github.com",
  };
}

export function githubExecutable(config: Config): string {
  return (
    config.githubCliPath ||
    (process.platform === "win32"
      ? resolve(/* turbopackIgnore: true */ ".local/tools/github/gh.exe")
      : "gh")
  );
}

export function parseGhResponse(bytes: Buffer): GitHubResponse {
  const boundary =
    bytes.indexOf("\r\n\r\n") >= 0 ? bytes.indexOf("\r\n\r\n") : bytes.indexOf("\n\n");
  ensure(
    boundary > 0 && boundary <= 16_384,
    "GITHUB_RESPONSE_INVALID",
    "پاسخ GitHub کامل نیست.",
    502,
  );
  const headers = bytes.subarray(0, boundary).toString("utf8"),
    delimiter = bytes.subarray(boundary, boundary + 4).toString() === "\r\n\r\n" ? 4 : 2;
  const match = /^HTTP\/[\d.]+ (\d{3})/.exec(headers);
  ensure(match, "GITHUB_RESPONSE_INVALID", "وضعیت پاسخ GitHub معتبر نیست.", 502);
  const status = Number(match[1]);
  return {
    status,
    body: bytes.subarray(boundary + delimiter),
    hasNext: /^link:.*rel="next"/im.test(headers),
    rateLimited:
      /^x-ratelimit-remaining:\s*0\s*$/im.test(headers) || /^retry-after:/im.test(headers),
  };
}

export function classifyGitHub(response: GitHubResponse): void {
  if (response.status >= 200 && response.status < 300) return;
  if (response.status === 401)
    throw new AppError("GITHUB_AUTH_REQUIRED", "ورود GitHub معتبر نیست. دوباره متصل شوید.", 403);
  if (response.status === 429 || (response.status === 403 && response.rateLimited))
    throw new AppError(
      "GITHUB_RATE_LIMIT",
      "سقف درخواست GitHub پر شده است. کمی بعد ادامه دهید.",
      429,
      true,
    );
  if (response.status === 403)
    throw new AppError(
      "GITHUB_ACCESS_DENIED",
      "این حساب اجازه خواندن مخزن را ندارد. مجوز مخزن یا سازمان را در GitHub بررسی کنید.",
      403,
    );
  if (response.status === 404)
    throw new AppError(
      "GITHUB_NOT_FOUND",
      "مخزن یا شاخه پیدا نشد یا اجازه دسترسی ندارید. فهرست را تازه کنید و دوباره انتخاب کنید.",
      404,
    );
  if (response.status === 409)
    throw new AppError(
      "GITHUB_EMPTY_REPOSITORY",
      "مخزن هنوز نسخه‌ای برای دریافت ندارد. ابتدا کد پروژه را در GitHub قرار دهید.",
      409,
    );
  throw new AppError(
    "GITHUB_UNAVAILABLE",
    "پاسخ GitHub دریافت نشد. انتخاب فعلی حفظ شده است؛ دوباره تلاش کنید.",
    502,
    response.status >= 500,
  );
}

export function cliTransport(
  config: Config,
  actorId: string,
  source: GitHubAuthSource,
): GitHubTransport {
  return async (path, signal, maxBytes = 1024 * 1024) => {
    ensure(
      Number.isSafeInteger(maxBytes) && maxBytes > 0 && maxBytes <= 25_165_824,
      "GITHUB_INPUT_INVALID",
      "سقف دریافت GitHub معتبر نیست.",
    );
    ensure(
      path.startsWith("/") && !path.startsWith("//") && !/[\r\n]/.test(path) && path.length <= 1024,
      "GITHUB_INPUT_INVALID",
      "درخواست GitHub معتبر نیست.",
    );
    const env = await githubEnvironment(config, actorId, source),
      boundedSignal = AbortSignal.any([
        signal,
        AbortSignal.timeout(maxBytes > 1024 * 1024 ? 90_000 : 20_000),
      ]);
    ensure(!boundedSignal.aborted, "CANCELLED", "دریافت از GitHub لغو شد.", 409);
    const bytes = await new Promise<Buffer>((resolvePromise, reject) => {
      const child = spawn(
        githubExecutable(config),
        [
          "api",
          "--hostname",
          "github.com",
          "--method",
          "GET",
          "--include",
          "-H",
          "Accept: application/vnd.github+json",
          "-H",
          "X-GitHub-Api-Version: 2026-03-10",
          path.slice(1),
        ],
        { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"], signal: boundedSignal },
      );
      const chunks: Buffer[] = [];
      let size = 0,
        failure = "",
        settled = false;
      const finish = (error?: AppError) => {
        if (settled) return;
        settled = true;
        if (error) reject(error);
        else resolvePromise(Buffer.concat(chunks));
      };
      child.stdout.on("data", (part: Buffer) => {
        size += part.length;
        if (size > maxBytes + 16_384) {
          child.kill();
          finish(
            new AppError(
              "GITHUB_DOWNLOAD_LIMIT",
              "حجم دریافت مخزن بیش از سقف مجاز است. زیرپوشه کوچک‌تری انتخاب کنید.",
              413,
            ),
          );
        } else chunks.push(part);
      });
      child.stderr.on("data", (part: Buffer) => {
        failure = stripVTControlCharacters((failure + part.toString()).slice(-4096));
      });
      child.once("error", (error) => {
        const missing = "code" in error && error.code === "ENOENT";
        finish(
          new AppError(
            boundedSignal.aborted
              ? "CANCELLED"
              : missing
                ? "GITHUB_CLI_UNAVAILABLE"
                : "GITHUB_NETWORK",
            boundedSignal.aborted
              ? "دریافت از GitHub متوقف شد."
              : missing
                ? "ابزار ورود رسمی GitHub روی این نصب آماده نیست. راه‌اندازی اتصال را تکمیل کنید."
                : "ارتباط با GitHub برقرار نشد. اتصال شبکه را بررسی کنید.",
            boundedSignal.aborted ? 409 : 503,
          ),
        );
      });
      child.once("close", (code) => {
        if (boundedSignal.aborted)
          finish(
            new AppError(
              signal.aborted ? "CANCELLED" : "GITHUB_TIMEOUT",
              "دریافت از GitHub کامل نشد. انتخاب قبلی حفظ شده است.",
              409,
            ),
          );
        else if (code !== 0 && !chunks.length)
          finish(
            new AppError(
              /auth login|not logged|authentication/i.test(failure)
                ? "GITHUB_AUTH_REQUIRED"
                : "GITHUB_NETWORK",
              "اتصال GitHub معتبر یا در دسترس نیست. اتصال را بررسی و دوباره تلاش کنید.",
              403,
            ),
          );
        else finish();
        failure = "";
      });
    });
    ensure(
      !boundedSignal.aborted,
      signal.aborted ? "CANCELLED" : "GITHUB_TIMEOUT",
      "پاسخ GitHub پس از پایان دریافت رسید.",
      409,
    );
    const response = parseGhResponse(bytes);
    classifyGitHub(response);
    return response;
  };
}

export async function githubCommand(
  config: Config,
  actorId: string,
  source: GitHubAuthSource,
  args: readonly string[],
  signal: AbortSignal,
): Promise<Buffer> {
  const env = await githubEnvironment(config, actorId, source);
  const bounded = AbortSignal.any([signal, AbortSignal.timeout(20_000)]);
  return new Promise((resolvePromise, reject) => {
    const child = spawn(githubExecutable(config), [...args], {
      env,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      signal: bounded,
    });
    const chunks: Buffer[] = [];
    let bytes = 0,
      settled = false;
    const finish = (error?: AppError) => {
      if (settled) return;
      settled = true;
      error ? reject(error) : resolvePromise(Buffer.concat(chunks));
    };
    child.stdout.on("data", (part: Buffer) => {
      bytes += part.length;
      if (bytes > 65_536) {
        child.kill();
        finish(
          new AppError("GITHUB_RESPONSE_INVALID", "پاسخ ورود GitHub بیش از حد بزرگ بود.", 502),
        );
      } else chunks.push(part);
    });
    // Discard raw stderr: auth errors can include configuration paths and credentials.
    child.stderr.resume();
    child.once("error", (error) =>
      finish(
        new AppError(
          bounded.aborted ? "CANCELLED" : "GITHUB_CLI_UNAVAILABLE",
          "ابزار رسمی GitHub آماده یا در دسترس نیست. راه‌اندازی اتصال را بررسی کنید.",
          "code" in error && error.code === "ENOENT" ? 503 : 409,
        ),
      ),
    );
    child.once("close", (code) =>
      finish(
        bounded.aborted
          ? new AppError(
              signal.aborted ? "CANCELLED" : "GITHUB_TIMEOUT",
              "بررسی اتصال GitHub کامل نشد. دوباره تلاش کنید.",
              409,
            )
          : code === 0
            ? undefined
            : new AppError(
                "GITHUB_AUTH_REQUIRED",
                "ورود GitHub معتبر نیست. دوباره متصل شوید.",
                403,
              ),
      ),
    );
  });
}
