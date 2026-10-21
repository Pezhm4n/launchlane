import type { ConnectionView } from "../../contracts/connections.ts";
import { identifier, object, string } from "../../contracts/validation.ts";
import type { Config } from "../config.ts";
import { AppError, ensure } from "../errors.ts";
import type { Store } from "../persistence/store.ts";
import { abortable, boundedJson, transport, type Transport } from "../providers/http.ts";
import { openCredential, sealCredential } from "./credentials.ts";

function accountId(value: unknown): string {
  const id = string(value, 24);
  ensure(
    /^[a-f0-9]{24}$/.test(id),
    "LIARA_RESPONSE_INVALID",
    "شناسه پاسخ لیارا قابل تأیید نیست.",
    502,
  );
  return id;
}

export function parseLiaraIdentity(
  value: unknown,
): Pick<ConnectionView, "identityId" | "displayName" | "login"> {
  const user = object(object(value).user);
  // /me also includes identity documents and storage keys. Only these three fields may leave this boundary.
  return {
    identityId: accountId(user._id),
    displayName: string(user.fullname, 160),
    login: string(user.email, 320),
  };
}
export function parseLiaraTeam(value: unknown, expectedTeam: string): { id: string; name: string } {
  const team = object(object(value).team);
  const id = accountId(team._id);
  ensure(
    id === expectedTeam,
    "LIARA_TEAM_MISMATCH",
    "این اتصال متعلق به تیم مجاز این نصب نیست. کلید همان تیم را در لیارا دریافت کنید.",
    403,
  );
  return { id, name: string(team.name, 160) };
}
export function parseLiaraApps(
  value: unknown,
  allowlist: readonly string[],
): ConnectionView["apps"] {
  const rows = object(value).projects;
  ensure(
    Array.isArray(rows) && rows.length <= 100,
    "LIARA_RESPONSE_INVALID",
    "فهرست برنامه‌های این تیم کامل یا قابل تأیید نیست.",
    502,
  );
  const apps = rows
    .map((value: unknown) => {
      const row = object(value),
        name = identifier(row.project_id);
      ensure(
        /^[a-z0-9][a-z0-9-]{0,62}$/.test(name),
        "LIARA_RESPONSE_INVALID",
        "نام یکی از برنامه‌ها معتبر نیست.",
        502,
      );
      return { id: string(row._id, 128), name, platform: string(row.type, 64) };
    })
    .filter((app) => !allowlist.length || allowlist.includes(app.name));
  ensure(
    new Set(apps.map((app) => app.name)).size === apps.length,
    "LIARA_RESPONSE_INVALID",
    "هویت برنامه‌های تیم تکراری است.",
    502,
  );
  return apps;
}

export async function validateLiaraConnection(
  config: Config,
  token: string,
  signal: AbortSignal,
  send: Transport = transport,
): Promise<ConnectionView> {
  ensure(
    config.teamId,
    "LIARA_TEAM_UNCONFIGURED",
    "محدوده تیم این نصب هنوز تعیین نشده است. راه‌اندازی محلی را تکمیل کنید.",
    503,
  );
  ensure(
    token.length >= 16 &&
      token.length <= 4096 &&
      /^[!-~]+$/.test(token) &&
      !token.startsWith("Bearer "),
    "LIARA_KEY_INVALID",
    "فقط خود کلید دسترسی را بدون فاصله وارد کنید؛ رمز ورود حساب قابل استفاده نیست.",
  );
  const bounded = AbortSignal.any([signal, AbortSignal.timeout(15_000)]);
  const read = async (path: string): Promise<unknown> => {
    ensure(!bounded.aborted, "CANCELLED", "بررسی اتصال متوقف شد.", 409);
    try {
      return await abortable(async () => {
        const response = await send(`https://api.liara.ir${path}`, {
          method: "GET",
          redirect: "error",
          cache: "no-store",
          signal: bounded,
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        });
        if (!response.ok) {
          await response.body?.cancel();
          if (response.status === 401)
            throw new AppError(
              "LIARA_AUTH_REQUIRED",
              "این کلید معتبر نیست یا اعتبارش تمام شده است. کلید تازه‌ای از حساب لیارا دریافت کنید.",
              403,
            );
          if (response.status === 403)
            throw new AppError(
              "LIARA_ACCESS_DENIED",
              "این کلید اجازه خواندن تیم یا برنامه‌ها را ندارد. دسترسی همان تیم را در لیارا بررسی کنید.",
              403,
            );
          if (response.status === 429)
            throw new AppError(
              "LIARA_RATE_LIMIT",
              "سقف درخواست لیارا پر شده است. کمی بعد اتصال را دوباره بررسی کنید.",
              429,
              true,
            );
          throw new AppError(
            "LIARA_UNAVAILABLE",
            "لیارا اکنون پاسخ نداد. کلید ذخیره نشد؛ کمی بعد دوباره تلاش کنید.",
            502,
            response.status >= 500,
          );
        }
        const raw = await boundedJson(response, 1024 * 1024);
        ensure(
          !bounded.aborted,
          "CANCELLED",
          "پاسخ پس از پایان بررسی دریافت شد؛ اتصال ثبت نشد.",
          409,
        );
        return raw;
      }, bounded);
    } catch (error) {
      if (error instanceof AppError && !bounded.aborted) throw error;
      throw new AppError(
        bounded.aborted ? (signal.aborted ? "CANCELLED" : "LIARA_TIMEOUT") : "LIARA_NETWORK",
        bounded.aborted
          ? "بررسی اتصال کامل نشد. دوباره تلاش کنید."
          : "ارتباط با لیارا برقرار نشد. اینترنت را بررسی کنید و دوباره تلاش کنید.",
        bounded.aborted ? 409 : 502,
      );
    }
  };
  try {
    const identity = parseLiaraIdentity(await read("/v1/me"));
    const team = parseLiaraTeam(await read(`/v1/me?teamID=${config.teamId}`), config.teamId);
    const apps = parseLiaraApps(await read(`/v1/projects?teamID=${config.teamId}`), config.apps);
    return {
      provider: "liara",
      status: "connected",
      ...identity,
      checkedAt: Date.now(),
      teamId: team.id,
      teamName: team.name,
      apps,
      selectedApp: null,
    };
  } catch (error) {
    if (error instanceof AppError && error.code !== "INVALID_INPUT") throw error;
    throw new AppError(
      "LIARA_RESPONSE_INVALID",
      "ساختار اطلاعات حساب یا تیم با این نسخه سازگار نیست. اتصال ثبت نشد؛ شناسه پیگیری را برای پشتیبانی نگه دارید.",
      502,
    );
  }
}

export async function connectLiara(
  config: Config,
  store: Store,
  actorId: string,
  token: string,
  signal: AbortSignal,
  send?: Transport,
): Promise<ConnectionView> {
  // Explicit account validation is read-only. It does not enable gated service reads, writes or model calls.
  const view = await validateLiaraConnection(config, token, signal, send);
  ensure(!signal.aborted, "CANCELLED", "اتصال متوقف شد و ثبت نشد.", 409);
  const old = store.getConnection(actorId, "liara");
  const sameAccount = old?.view.identityId === view.identityId && old.view.teamId === view.teamId;
  const previousApp = old?.view.apps.find((app) => app.name === old.view.selectedApp);
  const selectedApp =
    sameAccount &&
    old?.view.status === "connected" &&
    previousApp &&
    view.apps.some((app) => app.name === previousApp.name && app.id === previousApp.id)
      ? previousApp.name
      : null;
  if (
    old &&
    (!sameAccount || old.view.status !== "connected" || old.view.selectedApp !== selectedApp)
  )
    store.invalidateProjectApproval(actorId);
  // A reused public app name must not inherit the previous app's local read target or consent.
  if (old?.view.teamId)
    for (const app of old.view.apps) {
      if (!sameAccount || !view.apps.some((next) => next.name === app.name && next.id === app.id))
        store.removeProbeOrigin(actorId, old.view.teamId, app.name);
    }
  return store.saveConnection(actorId, {
    view: { ...view, selectedApp },
    source: "token",
    ciphertext: sealCredential(token, config.sessionSecret, actorId, "liara"),
  });
}

export function connectedLiaraConfig(
  config: Config,
  store: Store,
  actorId: string,
  app?: string,
): Config {
  const saved = store.getConnection(actorId, "liara");
  ensure(
    saved?.view.status === "connected" && saved.ciphertext && saved.view.teamId === config.teamId,
    "LIARA_AUTH_REQUIRED",
    "ابتدا حساب لیارا را متصل کنید.",
    403,
  );
  ensure(
    saved.view.selectedApp &&
      (!app || app === saved.view.selectedApp) &&
      saved.view.apps.some((row) => row.name === saved.view.selectedApp) &&
      (!config.apps.length || config.apps.includes(saved.view.selectedApp)),
    "LIARA_APP_REQUIRED",
    "برنامه مقصد را از فهرست حساب متصل انتخاب کنید.",
    403,
  );
  try {
    return {
      ...config,
      liaraToken: openCredential(saved.ciphertext, config.sessionSecret, actorId, "liara"),
      apps: [saved.view.selectedApp],
    };
  } catch (error) {
    store.saveConnection(actorId, { ...saved, view: { ...saved.view, status: "reauth_required" } });
    store.invalidateProjectApproval(actorId);
    throw error;
  }
}
