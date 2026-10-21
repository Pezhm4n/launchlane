import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Session } from "../../contracts/domain.ts";
import { object } from "../../contracts/validation.ts";
import type { Config } from "../config.ts";
import { AppError, ensure } from "../errors.ts";
import type { Store } from "../persistence/store.ts";

const COOKIE = "launchlane_session";
const TTL = 60 * 60_000;

export function safeEqual(a: string, b: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}

export function checkRequest(request: Request, config: Config, write: boolean): void {
  const origin = new URL(config.origin);
  ensure(
    request.headers.get("host") === origin.host,
    "HOST_DENIED",
    "میزبان درخواست مجاز نیست.",
    403,
  );
  // Forwarded headers are never trusted by this operator-local application.
  const fetchSite = request.headers.get("sec-fetch-site");
  ensure(
    !fetchSite || fetchSite === "same-origin" || fetchSite === "none",
    "ORIGIN_DENIED",
    "درخواست باید از همین برنامه باشد.",
    403,
  );
  const suppliedOrigin = request.headers.get("origin");
  ensure(
    write ? suppliedOrigin === config.origin : !suppliedOrigin || suppliedOrigin === config.origin,
    "ORIGIN_DENIED",
    "مبدأ درخواست با برنامه تطبیق ندارد.",
    403,
  );
}

function signature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function csrfFor(id: string, secret: string): string {
  return signature(`csrf:${id}`, secret);
}

export function login(
  token: string,
  config: Config,
  store: Store,
  now = Date.now(),
): { session: Session; cookie: string } {
  ensure(config.authConfigured, "AUTH_UNCONFIGURED", "ابتدا تنظیمات ورود محلی را آماده کنید.", 503);
  store.rateLimitLogin(now);
  ensure(
    token.length <= 256 && safeEqual(token, config.operatorToken),
    "AUTH_REQUIRED",
    "کلید ورود محلی درست نیست.",
    401,
  );
  const id = randomBytes(24).toString("base64url");
  const actorId = createHash("sha256").update(config.operatorToken).digest("hex").slice(0, 24);
  const session = {
    id,
    actorId,
    csrfToken: csrfFor(id, config.sessionSecret),
    expiresAt: now + TTL,
  };
  const payload = Buffer.from(
    JSON.stringify({ id, actorId, expiresAt: session.expiresAt }),
  ).toString("base64url");
  store.saveSession(session);
  return {
    session,
    cookie: `${COOKIE}=${payload}.${signature(payload, config.sessionSecret)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${TTL / 1000}`,
  };
}

export function requireSession(
  request: Request,
  config: Config,
  store: Store,
  write = false,
  now = Date.now(),
): Session {
  checkRequest(request, config, write);
  ensure(config.authConfigured, "AUTH_UNCONFIGURED", "ابتدا تنظیمات ورود محلی را آماده کنید.", 503);
  const token = (request.headers.get("cookie") || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  ensure(token && token.length < 1024, "AUTH_REQUIRED", "برای ادامه وارد شوید.", 401);
  const [payload, signed, extra] = token.split(".");
  ensure(
    payload && signed && !extra && safeEqual(signed, signature(payload, config.sessionSecret)),
    "AUTH_REQUIRED",
    "نشست معتبر نیست؛ دوباره وارد شوید.",
    401,
  );
  let raw: Record<string, unknown>;
  try {
    raw = object(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
  } catch {
    throw new AppError("AUTH_REQUIRED", "نشست معتبر نیست؛ دوباره وارد شوید.", 401);
  }
  ensure(
    typeof raw.id === "string" &&
      typeof raw.actorId === "string" &&
      typeof raw.expiresAt === "number" &&
      raw.expiresAt > now &&
      raw.expiresAt <= now + TTL &&
      store.sessionExists(raw.id, raw.actorId, now),
    "AUTH_REQUIRED",
    "نشست منقضی یا لغو شده است؛ دوباره وارد شوید.",
    401,
  );
  const csrfToken = csrfFor(raw.id, config.sessionSecret);
  if (write)
    ensure(
      safeEqual(request.headers.get("x-csrf-token") || "", csrfToken),
      "CSRF_DENIED",
      "درخواست تأیید معتبر نیست؛ صفحه را تازه کنید.",
      403,
    );
  return { id: raw.id, actorId: raw.actorId, csrfToken, expiresAt: raw.expiresAt };
}

export const logoutCookie = `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
