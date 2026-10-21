import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { lstat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { stripVTControlCharacters } from "node:util";
import type { ConnectionView } from "../../contracts/connections.ts";
import { object } from "../../contracts/validation.ts";
import type { Config } from "../config.ts";
import { AppError, ensure } from "../errors.ts";
import type { Store } from "../persistence/store.ts";
import {
  cliTransport,
  githubCommand,
  githubEnvironment,
  githubExecutable,
  type GitHubAuthSource,
} from "./cli.ts";
import { GitHubClient, secureGitHubStatus, type GitHubIdentity } from "./client.ts";

export type LoginView = {
  id: string;
  state:
    | "starting"
    | "awaiting_user"
    | "checking"
    | "confirm_account"
    | "connected"
    | "cancelled"
    | "expired"
    | "failed";
  expiresAt: number;
  userCode: string | null;
  verificationUrl: string | null;
  account: { login: string; name: string } | null;
  error: { code: string; message: string } | null;
};
type Challenge = { userCode: string; verificationUrl: string };
export type LoginDriver = (
  signal: AbortSignal,
  onChallenge: (challenge: Challenge) => void,
) => Promise<void>;
type Run = {
  actorId: string;
  controller: AbortController;
  view: LoginView;
  identity: GitHubIdentity | null;
  source: GitHubAuthSource;
};

export function parseDeviceChallenge(output: string): Challenge | null {
  const plain = stripVTControlCharacters(output);
  const code = /one-time code:\s*([A-Z0-9]{4}-[A-Z0-9]{4})\b/i.exec(plain)?.[1];
  const url = /https:\/\/[^\s<>]+/.exec(plain)?.[0];
  if (!code || !url) return null;
  ensure(
    url === "https://github.com/login/device",
    "GITHUB_LOGIN_PROTOCOL",
    "این نسخه ابزار، مسیر ورود پشتیبانی‌شده را ارائه نکرد. راه‌اندازی GitHub را بررسی کنید.",
    503,
  );
  return { userCode: code.toUpperCase(), verificationUrl: url };
}

export function deviceLogin(config: Config, actorId: string): LoginDriver {
  return async (signal, onChallenge) => {
    const env = await githubEnvironment(config, actorId, "cli_private");
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        githubExecutable(config),
        [
          "auth",
          "login",
          "--web",
          "--hostname",
          "github.com",
          "--git-protocol",
          "https",
          "--skip-ssh-key",
        ],
        { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"], signal },
      );
      let output = "",
        announced = false,
        settled = false;
      const startTimer = setTimeout(() => {
        child.kill();
        finish(
          new AppError(
            "GITHUB_LOGIN_TIMEOUT",
            "کد ورود GitHub دریافت نشد. اتصال شبکه این رایانه را بررسی و دوباره تلاش کنید؛ پروژه قبلی حفظ شده است.",
            504,
            true,
          ),
        );
      }, 30_000);
      startTimer.unref();
      const finish = (error?: AppError) => {
        if (settled) return;
        settled = true;
        clearTimeout(startTimer);
        output = "";
        error ? reject(error) : resolve();
      };
      const read = (part: Buffer) => {
        if (announced) return;
        output += part.toString("utf8");
        if (output.length > 16_384) {
          child.kill();
          finish(
            new AppError(
              "GITHUB_LOGIN_PROTOCOL",
              "پاسخ شروع ورود GitHub قابل استفاده نبود. دوباره تلاش کنید.",
              502,
            ),
          );
          return;
        }
        try {
          const challenge = parseDeviceChallenge(output);
          if (challenge) {
            announced = true;
            clearTimeout(startTimer);
            output = "";
            onChallenge(challenge);
          }
        } catch (error) {
          child.kill();
          finish(
            error instanceof AppError
              ? error
              : new AppError("GITHUB_LOGIN_PROTOCOL", "مسیر ورود GitHub قابل استفاده نیست.", 502),
          );
        }
      };
      child.stderr.on("data", read);
      child.stdout.on("data", read);
      child.once("error", () =>
        finish(
          new AppError(
            signal.aborted ? "CANCELLED" : "GITHUB_CLI_UNAVAILABLE",
            signal.aborted
              ? "ورود GitHub لغو شد."
              : "ابزار رسمی GitHub در دسترس نیست. راه‌اندازی اتصال را تکمیل کنید.",
            signal.aborted ? 409 : 503,
          ),
        ),
      );
      child.once("close", (code) =>
        finish(
          signal.aborted
            ? new AppError("CANCELLED", "ورود GitHub متوقف شد.", 409)
            : code === 0
              ? undefined
              : new AppError(
                  "GITHUB_LOGIN_FAILED",
                  "ورود GitHub کامل نشد؛ ممکن است دسترسی را رد کرده باشید یا ارتباط قطع شده باشد. دوباره متصل شوید.",
                  403,
                ),
        ),
      );
    });
  };
}

export async function checkGitHubIdentity(
  config: Config,
  actorId: string,
  source: GitHubAuthSource,
  signal: AbortSignal,
): Promise<GitHubIdentity> {
  const bytes = await githubCommand(
    config,
    actorId,
    source,
    ["auth", "status", "--hostname", "github.com", "--active", "--no-refresh", "--json", "hosts"],
    signal,
  );
  let raw: unknown;
  try {
    raw = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new AppError("GITHUB_RESPONSE_INVALID", "بررسی ورود GitHub کامل نشد.", 502);
  }
  const login = secureGitHubStatus(raw);
  const identity = await new GitHubClient(cliTransport(config, actorId, source)).identity(signal);
  ensure(
    identity.login === login,
    "GITHUB_ACCOUNT_CHANGED",
    "حساب GitHub هنگام اتصال عوض شد. دوباره متصل شوید.",
    409,
  );
  return identity;
}

export class GitHubLoginService {
  private runs = new Map<string, Run>();
  readonly config: Config;
  readonly store: Store;
  readonly dependencies: {
    driver?: (actorId: string) => LoginDriver;
    check?: (
      actorId: string,
      source: GitHubAuthSource,
      signal: AbortSignal,
    ) => Promise<GitHubIdentity>;
    timeoutMs?: number;
  };
  constructor(
    config: Config,
    store: Store,
    dependencies: {
      driver?: (actorId: string) => LoginDriver;
      check?: (
        actorId: string,
        source: GitHubAuthSource,
        signal: AbortSignal,
      ) => Promise<GitHubIdentity>;
      timeoutMs?: number;
    } = {},
  ) {
    this.config = config;
    this.store = store;
    this.dependencies = dependencies;
  }
  private check(actorId: string, source: GitHubAuthSource, signal: AbortSignal) {
    return (
      this.dependencies.check?.(actorId, source, signal) ??
      checkGitHubIdentity(this.config, actorId, source, signal)
    );
  }
  start(actorId: string): LoginView {
    for (const [id, run] of this.runs) {
      if (Date.now() >= run.view.expiresAt) {
        run.controller.abort();
        this.runs.delete(id);
      } else if (
        run.actorId === actorId &&
        !["failed", "expired", "cancelled", "connected"].includes(run.view.state)
      )
        return { ...run.view };
    }
    ensure(
      this.runs.size < 8,
      "GITHUB_LOGIN_LIMIT",
      "چند ورود هم‌زمان در حال انجام است. کمی بعد تلاش کنید.",
      429,
    );
    const existing = this.store.getConnection(actorId, "github");
    ensure(
      existing?.view.status !== "connected",
      "GITHUB_ALREADY_CONNECTED",
      "حساب GitHub متصل است. برای تغییر حساب، ابتدا اتصال آن را قطع کنید.",
      409,
    );
    const controller = new AbortController(),
      expiresAt = Date.now() + (this.dependencies.timeoutMs ?? 300_000);
    const view: LoginView = {
      id: randomUUID(),
      state: "starting",
      expiresAt,
      userCode: null,
      verificationUrl: null,
      account: null,
      error: null,
    };
    const run: Run = { actorId, controller, view, identity: null, source: "cli_private" };
    this.runs.set(view.id, run);
    const timer = setTimeout(
      () => {
        if (!["connected", "cancelled", "failed"].includes(view.state)) {
          controller.abort();
          view.state = "expired";
          view.userCode = null;
          view.verificationUrl = null;
        }
      },
      Math.max(1, expiresAt - Date.now()),
    );
    timer.unref();
    void (async () => {
      try {
        const driver = this.dependencies.driver?.(actorId) ?? deviceLogin(this.config, actorId);
        await driver(controller.signal, (challenge) => {
          if (!controller.signal.aborted) {
            view.state = "awaiting_user";
            view.userCode = challenge.userCode;
            view.verificationUrl = challenge.verificationUrl;
          }
        });
        ensure(!controller.signal.aborted, "CANCELLED", "ورود GitHub متوقف شد.", 409);
        view.state = "checking";
        view.userCode = null;
        view.verificationUrl = null;
        run.identity = await this.check(actorId, run.source, controller.signal);
        ensure(!controller.signal.aborted, "CANCELLED", "ورود GitHub متوقف شد.", 409);
        view.account = { login: run.identity.login, name: run.identity.name };
        view.state = "confirm_account";
      } catch (error) {
        if (!controller.signal.aborted) {
          view.state = "failed";
          const typed =
            error instanceof AppError
              ? error
              : new AppError("GITHUB_LOGIN_FAILED", "ورود GitHub کامل نشد. دوباره تلاش کنید.", 503);
          view.error = { code: typed.code, message: typed.message };
          // Only a newly-created private CLI configuration is disposable; never touch a system login.
          if (typed.code === "GITHUB_STORAGE_UNSAFE")
            await this.discardInsecurePrivateConfig(actorId);
        }
        view.userCode = null;
        view.verificationUrl = null;
      }
    })();
    return { ...view };
  }
  private async discardInsecurePrivateConfig(actorId: string) {
    try {
      const env = await githubEnvironment(this.config, actorId, "cli_private");
      if (!env.GH_CONFIG_DIR) return;
      const path = join(env.GH_CONFIG_DIR, "hosts.yml"),
        stat = await lstat(path);
      if (stat.isFile() && !stat.isSymbolicLink() && stat.size < 1_048_576) await unlink(path);
    } catch {
      /* No plaintext fallback is ever adopted as a connected account. */
    }
  }
  private run(actorId: string, id: string): Run {
    const run = this.runs.get(id);
    ensure(
      run && run.actorId === actorId,
      "GITHUB_LOGIN_EXPIRED",
      "این ورود دیگر فعال نیست. دوباره اتصال GitHub را شروع کنید.",
      410,
    );
    if (Date.now() >= run.view.expiresAt && run.view.state !== "connected") {
      run.controller.abort();
      run.view.state = "expired";
      run.view.userCode = null;
      run.view.verificationUrl = null;
    }
    return run;
  }
  status(actorId: string, id: string): LoginView {
    return { ...this.run(actorId, id).view };
  }
  cancel(actorId: string, id: string): LoginView {
    const run = this.run(actorId, id);
    ensure(
      run.view.state !== "connected",
      "GITHUB_ALREADY_CONNECTED",
      "برای جداکردن حساب از قطع اتصال استفاده کنید.",
      409,
    );
    run.controller.abort();
    run.view.state = "cancelled";
    run.view.userCode = null;
    run.view.verificationUrl = null;
    run.identity = null;
    run.view.account = null;
    return { ...run.view };
  }
  async confirm(actorId: string, id: string, signal: AbortSignal): Promise<ConnectionView> {
    const run = this.run(actorId, id);
    ensure(
      run.view.state === "confirm_account" && run.identity && !run.controller.signal.aborted,
      "GITHUB_LOGIN_NOT_READY",
      "ورود هنوز آماده تأیید حساب نیست.",
      409,
    );
    const identity = await this.check(
      actorId,
      run.source,
      AbortSignal.any([signal, run.controller.signal]),
    );
    ensure(
      !signal.aborted && !run.controller.signal.aborted && run.view.state === "confirm_account",
      "CANCELLED",
      "تأیید اتصال متوقف شد.",
      409,
    );
    ensure(
      identity.id === run.identity.id && identity.login === run.identity.login,
      "GITHUB_ACCOUNT_CHANGED",
      "حساب GitHub تغییر کرده است. دوباره متصل شوید.",
      409,
    );
    const view: ConnectionView = {
      provider: "github",
      status: "connected",
      identityId: identity.id,
      login: identity.login,
      displayName: identity.name,
      checkedAt: Date.now(),
      teamId: null,
      teamName: null,
      apps: [],
      selectedApp: null,
    };
    this.store.saveConnection(actorId, { view, source: run.source, ciphertext: null });
    run.view.state = "connected";
    return view;
  }
}

const state = globalThis as typeof globalThis & { launchlaneGitHubLogin?: GitHubLoginService };
export function githubLoginService(config: Config, store: Store): GitHubLoginService {
  state.launchlaneGitHubLogin ??= new GitHubLoginService(config, store);
  return state.launchlaneGitHubLogin;
}

export async function connectedGitHub(
  config: Config,
  store: Store,
  actorId: string,
  signal: AbortSignal,
): Promise<GitHubClient> {
  const saved = store.getConnection(actorId, "github");
  ensure(
    saved && saved.source !== "token",
    "GITHUB_AUTH_REQUIRED",
    "ابتدا حساب GitHub را متصل کنید.",
    403,
  );
  try {
    const identity = await checkGitHubIdentity(config, actorId, saved.source, signal);
    ensure(
      identity.id === saved.view.identityId && identity.login === saved.view.login,
      "GITHUB_ACCOUNT_CHANGED",
      "حساب فعال GitHub تغییر کرده است. برای حفظ امنیت، دوباره متصل شوید.",
      409,
    );
    return new GitHubClient(cliTransport(config, actorId, saved.source));
  } catch (error) {
    if (
      error instanceof AppError &&
      ["GITHUB_ACCOUNT_CHANGED", "GITHUB_AUTH_REQUIRED", "GITHUB_STORAGE_UNSAFE"].includes(
        error.code,
      )
    )
      store.saveConnection(actorId, {
        ...saved,
        view: { ...saved.view, status: "reauth_required" },
      });
    throw error;
  }
}

export function loginJson(bytes: Buffer): Record<string, unknown> {
  try {
    return object(JSON.parse(bytes.toString("utf8")));
  } catch {
    throw new AppError("GITHUB_RESPONSE_INVALID", "پاسخ ابزار رسمی GitHub معتبر نیست.", 502);
  }
}
