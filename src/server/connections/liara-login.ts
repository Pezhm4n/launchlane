import { createHash } from "node:crypto";
import { exactKeys, object, string } from "../../contracts/validation.ts";
import type { Config } from "../config.ts";
import { AppError, ensure } from "../errors.ts";
import type { Store } from "../persistence/store.ts";
import { issueSession } from "../policy/session.ts";
import { abortable, boundedJson, transport, type Transport } from "../providers/http.ts";
import { parseLiaraIdentity, saveLiaraConnection } from "./liara.ts";

export function liaraActor(identityId: string): string {
  ensure(/^[a-f0-9]{24}$/.test(identityId), "LIARA_RESPONSE_INVALID", "هویت حساب قابل تأیید نیست.", 502);
  return createHash("sha256").update(`launchlane:liara:user:v1:${identityId}`).digest("hex").slice(0, 24);
}

export async function liaraSignIn(config: Config, store: Store, input: unknown, signal: AbortSignal, send: Transport = transport) {
  ensure(config.authMode === "liara" && config.authConfigured, "AUTH_METHOD_DENIED", "ورود با حساب لیارا در این نصب فعال نیست.", 403);
  const row = object(input), operation = string(row.operation, 16);
  ensure(operation === "check" || operation === "login", "INVALID_OPERATION", "درخواست ورود معتبر نیست.");
  exactKeys(row, operation === "check" ? ["operation", "email"] : ["operation", "email", "password", "totp"]);
  const email = string(row.email, 320).trim().toLowerCase();
  ensure(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), "EMAIL_INVALID", "ایمیل حساب لیارا را کامل وارد کنید؛ مانند name@example.com.");
  const password = operation === "login" ? string(row.password, 1024) : "";
  const totp = row.totp === undefined ? undefined : string(row.totp, 6);
  ensure(totp === undefined || /^\d{6}$/.test(totp), "TOTP_INVALID", "کد شش‌رقمی برنامهٔ تأیید دومرحله‌ای را وارد کنید.");
  store.rateLimitLogin(Date.now(), "liara:global", 60);
  store.rateLimitLogin(Date.now(), `liara:${createHash("sha256").update(email).digest("hex")}`, 10);
  const bounded = AbortSignal.any([signal, AbortSignal.timeout(20_000)]);
  const call = async (path: string, body?: Record<string, string>): Promise<unknown> => {
    try {
      return await abortable(async () => {
        const response = await send(`https://api.liara.ir${path}`, { method: body ? "POST" : "GET", redirect: "error", cache: "no-store", signal: bounded,
          headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
        if (!response.ok) {
          await response.body?.cancel();
          if (response.status === 400 || response.status === 401 || response.status === 403)
            throw new AppError("LIARA_LOGIN_FAILED", "ورود تأیید نشد. ایمیل، رمز و در صورت نیاز کد دومرحله‌ای را بررسی کنید.", 401);
          throw new AppError(response.status === 429 ? "LIARA_RATE_LIMIT" : "LIARA_UNAVAILABLE",
            response.status === 429 ? "تلاش ورود زیاد است؛ کمی بعد دوباره امتحان کنید." : "لیارا اکنون پاسخ نداد؛ کمی بعد دوباره وارد شوید.", response.status === 429 ? 429 : 502, true);
        }
        return await boundedJson(response, 1024 * 1024);
      }, bounded);
    } catch (error) {
      if (error instanceof AppError && !bounded.aborted) throw error;
      throw new AppError(signal.aborted ? "CANCELLED" : bounded.aborted ? "LIARA_TIMEOUT" : "LIARA_NETWORK",
        signal.aborted ? "ورود متوقف شد." : "ارتباط با لیارا کامل نشد؛ اینترنت را بررسی کنید و دوباره وارد شوید.", signal.aborted ? 409 : 502, !signal.aborted);
    }
  };
  try {
    const check = object(await call("/v1/login/check-if-exists", { email }));
    ensure(typeof check.exists === "boolean" && typeof check.socialCompleted === "boolean" && typeof check.twoFAEnabled === "boolean",
      "LIARA_RESPONSE_INVALID", "پاسخ ورود لیارا قابل تأیید نیست؛ اتصال ذخیره نشد.", 502);
    ensure(check.exists, "LIARA_LOGIN_FAILED", "ورود تأیید نشد. ایمیل و رمز حساب لیارا را بررسی کنید.", 401);
    ensure(check.socialCompleted, "LIARA_PASSWORD_REQUIRED", "این حساب هنوز رمز عبور ندارد. ابتدا در تنظیمات امنیت لیارا رمز تعیین کنید.", 409);
    if (operation === "check") return { twoFactorRequired: check.twoFAEnabled };
    ensure(!check.twoFAEnabled || totp, "LIARA_TOTP_REQUIRED", "کد شش‌رقمی برنامهٔ تأیید دومرحله‌ای را وارد کنید.", 409);
    // Same documented exchange as the official CLI. Password and TOTP are transient; only its token is sealed.
    const authenticated = object(await call("/v1/login?expiresIn=1y", { email, password, ...(check.twoFAEnabled && totp ? { twoFAType: "totp", totp } : {}) }));
    const token = string(authenticated.api_token, 4096);
    const identityResponse = await abortable(async () => {
      const response = await send("https://api.liara.ir/v1/me", { method: "GET", redirect: "error", cache: "no-store", signal: bounded,
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
      if (!response.ok) { await response.body?.cancel(); throw new AppError("LIARA_IDENTITY_UNVERIFIED", "ورود انجام شد اما هویت حساب تأیید نشد؛ دوباره وارد شوید.", 502); }
      return boundedJson(response, 1024 * 1024);
    }, bounded);
    const identity = parseLiaraIdentity(identityResponse), actor = liaraActor(identity.identityId);
    ensure(!bounded.aborted, "LIARA_IDENTITY_UNVERIFIED", "ورود متوقف شد؛ اتصال ثبت نشد.", 502);
    const previous = store.getConnection(actor, "liara");
    // Signing in does not change a destination or invalidate a running mission's selected team.
    const view = previous?.view.status === "connected" ? { ...previous.view, ...identity, checkedAt: Date.now() } : {
      provider: "liara" as const, status: "connected" as const, ...identity, checkedAt: Date.now(), teamId: null, teamName: null, apps: [], selectedApp: null };
    saveLiaraConnection({ ...config, teamId: view.teamId ?? "" }, store, actor, token, view, true);
    const signed = issueSession(actor, config, store);
    return { ...signed, twoFactorRequired: false };
  } catch (error) {
    if (bounded.aborted) throw new AppError(signal.aborted ? "CANCELLED" : "LIARA_TIMEOUT", "ورود کامل نشد؛ دوباره تلاش کنید.", signal.aborted ? 409 : 502, !signal.aborted);
    if (error instanceof AppError && error.code !== "INVALID_INPUT") throw error;
    throw new AppError("LIARA_RESPONSE_INVALID", "پاسخ ورود لیارا با این نسخه سازگار نیست؛ اتصال ذخیره نشد.", 502);
  }
}
