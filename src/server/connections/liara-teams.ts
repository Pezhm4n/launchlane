import { integer, object, string } from "../../contracts/validation.ts";
import type { Config } from "../config.ts";
import { AppError, ensure } from "../errors.ts";
import type { Store } from "../persistence/store.ts";
import { abortable, boundedJson, transport, type Transport } from "../providers/http.ts";
import { openCredential } from "./credentials.ts";
import { connectLiara } from "./liara.ts";

export async function liaraTeams(config: Config, store: Store, actor: string, signal: AbortSignal, send: Transport = transport) {
  const saved = store.getConnection(actor, "liara");
  ensure(config.authMode === "liara" && saved?.ciphertext && saved.view.status === "connected", "LIARA_AUTH_REQUIRED", "با حساب لیارا وارد شوید.", 403);
  const token = openCredential(saved.ciphertext, config.sessionSecret, actor, "liara"), bounded = AbortSignal.any([signal, AbortSignal.timeout(15_000)]);
  const teams: { id: string; name: string }[] = [];
  try {
    for (let page = 1; page <= 10; page++) {
      const raw = await abortable(async () => {
        const response = await send(`https://api.liara.ir/v2/teams?page=${page}&count=100`, { method: "GET", redirect: "error", cache: "no-store", signal: bounded,
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
        if (!response.ok) { await response.body?.cancel(); throw new AppError(response.status === 401 ? "LIARA_AUTH_REQUIRED" : "LIARA_UNAVAILABLE",
          response.status === 401 ? "نشست لیارا اعتبار ندارد؛ دوباره وارد شوید." : "فضاهای کاری دریافت نشدند؛ دوباره بررسی کنید.", response.status === 401 ? 401 : 502, response.status >= 500 || response.status === 429); }
        return object(await boundedJson(response, 1024 * 1024));
      }, bounded);
      ensure(Array.isArray(raw.teams) && raw.teams.length <= 100, "LIARA_RESPONSE_INVALID", "فهرست فضای کاری قابل تأیید نیست.", 502);
      const total = integer(raw.totalTeams, 0, 1000);
      for (const value of raw.teams) { const team = object(value), id = string(team._id, 24);
        ensure(/^[a-f0-9]{24}$/.test(id) && !teams.some(row => row.id === id), "LIARA_RESPONSE_INVALID", "هویت فضای کاری قابل تأیید نیست.", 502);
        teams.push({ id, name: string(team.name, 160) }); }
      ensure(teams.length <= total && (raw.teams.length > 0 || teams.length === total), "LIARA_RESPONSE_INVALID", "فهرست فضای کاری کامل دریافت نشد.", 502);
      if (teams.length === total) return teams;
    }
    throw new AppError("LIARA_RESPONSE_INVALID", "فهرست فضای کاری بیش از حد بزرگ است.", 502);
  } catch (error) {
    if (bounded.aborted) throw new AppError(signal.aborted ? "CANCELLED" : "LIARA_TIMEOUT", "دریافت فضای کاری کامل نشد؛ دوباره بررسی کنید.", 409);
    if (error instanceof AppError && error.code !== "INVALID_INPUT") throw error;
    throw new AppError("LIARA_RESPONSE_INVALID", "اطلاعات فضای کاری قابل تأیید نیست.", 502);
  }
}

export async function selectLiaraTeam(config: Config, store: Store, actor: string, teamId: string, signal: AbortSignal, send: Transport = transport) {
  store.assertAgentIdle(actor, null, true);
  const teams = await liaraTeams(config, store, actor, signal, send);
  ensure(teams.some(team => team.id === teamId), "LIARA_TEAM_DENIED", "این فضای کاری در حساب شما نیست. فهرست را تازه کنید.", 403);
  const saved = store.getConnection(actor, "liara");
  ensure(saved?.ciphertext, "LIARA_AUTH_REQUIRED", "دوباره وارد شوید.", 401);
  return connectLiara({ ...config, teamId }, store, actor, openCredential(saved.ciphertext, config.sessionSecret, actor, "liara"), signal, send);
}
