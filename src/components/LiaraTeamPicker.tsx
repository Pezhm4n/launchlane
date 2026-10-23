"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { object, string } from "../contracts/validation.ts";
import { api, ClientError } from "./api.ts";
import styles from "./LiaraSignIn.module.css";

export function LiaraTeamPicker({ csrf, onSelected }: { csrf: string; onSelected: () => Promise<unknown> }) {
  const [teams, setTeams] = useState<{ id: string; name: string }[] | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState<string | null>(null), pending = useRef(false);
  const load = useCallback(async (signal?: AbortSignal) => {
    setError("");
    try { setTeams(await api("/api/connections/liara/teams", value => { const rows = object(value).teams;
      if (!Array.isArray(rows)) throw new Error("Invalid teams");
      return rows.map(value => { const row = object(value); return { id: string(row.id, 24), name: string(row.name, 160) }; }); }, signal ? { signal } : {})); }
    catch (failure) { if (!signal?.aborted) setError(failure instanceof ClientError ? failure.message : "فضاهای کاری دریافت نشدند؛ دوباره بررسی کنید."); }
  }, []);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  async function select(id: string) {
    if (pending.current) return; pending.current = true; setBusy(id); setError("");
    try { await api("/api/connections/liara/teams", () => true, { csrf, body: { teamId: id } }); await onSelected(); }
    catch (failure) { setError(failure instanceof ClientError ? failure.message : "انتخاب ثبت نشد؛ دوباره بررسی کنید."); }
    finally { setBusy(null); pending.current = false; }
  }
  return <section className={styles.card} aria-labelledby="team-picker-title">
    <h2 id="team-picker-title">کجا منتشر می‌کنید؟</h2><p>فضای کاری حساب لیارا را انتخاب کنید. برنامه‌ها و پلن‌های همین فضا را برای پروژه‌تان بررسی می‌کنیم؛ هنوز چیزی ساخته یا منتشر نمی‌شود.</p>
    {error ? <p role="alert">{error}</p> : null}
    {!teams && !error ? <p role="status">در حال دریافت فضاهای کاری شما…</p> : null}
    <div className={styles.links}>{teams?.map(team => <button type="button" key={team.id} disabled={busy !== null} onClick={() => void select(team.id)} aria-busy={busy === team.id}>{busy === team.id ? "در حال بررسی…" : team.name}</button>)}</div>
    {teams?.length === 0 ? <p>در این حساب هنوز فضای کاری تیمی پیدا نشد. انتشار با حساب شخصی در این نسخه هنوز آماده نیست؛ پروژه و حساب شما حفظ می‌شوند.</p> : null}
    {error ? <button type="button" className="button-secondary" disabled={busy !== null} onClick={() => void load()}>بررسی دوباره</button> : null}
  </section>;
}
