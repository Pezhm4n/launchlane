"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { Action } from "../contracts/domain.ts";
import { decodeAction } from "../contracts/client-decode.ts";
import { environmentKey } from "../contracts/environment.ts";
import { object, string } from "../contracts/validation.ts";
import { api, ClientError } from "./api.ts";

function result(value: unknown) { return decodeAction(object(value).action); }
export function ProjectEnvironment({ runId, csrf, disabled, onContinue, onLockChanged }: {
  runId: string; csrf: string; disabled: boolean; onContinue: () => void; onLockChanged: (locked: boolean) => void;
}) {
  const [names, setNames] = useState<string[]>([]), [app, setApp] = useState(""), [action, setAction] = useState<Action | null>(null),
    [values, setValues] = useState<Record<string, string>>({}), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null);
  const key = useRef<string | null>(null);
  const [publicNames, setPublicNames] = useState<Record<string, boolean>>({});
  const load = useCallback(async (signal?: AbortSignal) => {
    const data = await api(`/api/project-environment?run=${runId}`, value => {
      const row = object(value);
      if (!Array.isArray(row.names)) throw new ClientError("INVALID_RESPONSE", "فهرست اطلاعات لازم معتبر نیست.");
      return { names: row.names.map(environmentKey), app: string(row.app, 63), action: row.action === null ? null : decodeAction(row.action) };
    }, { ...(signal ? { signal } : {}) });
    if (signal?.aborted) return;
    setNames(data.names); setApp(data.app); setAction(data.action);
    if (data.action && ["cancelled", "expired", "failed"].includes(data.action.state)) key.current = null;
  }, [runId]);
  useEffect(() => {
    const controller = new AbortController(); setValues({}); setPublicNames({}); setAction(null); setLoading(true); key.current = null;
    void load(controller.signal).catch(() => { if (!controller.signal.aborted) setError("دریافت وضعیت کامل نشد؛ دوباره وضعیت را دریافت کنید."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [load]);
  const locked = busy || !!action && ["awaiting_approval", "approved", "executing", "observing", "uncertain"].includes(action.state);
  useEffect(() => { onLockChanged(locked); return () => onLockChanged(false); }, [locked, onLockChanged]);
  async function perform(operation: "decision" | "execute" | "observe", decision?: "approve" | "reject") {
    if (!action || busy || disabled) return;
    setBusy(true); setError(null);
    try {
      let current = await api("/api/project-environment", result, { csrf, body: { operation, actionId: action.id,
        ...(decision ? { decision, hash: action.hash } : {}) } });
      setAction(current);
      if (current.state === "cancelled") key.current = null;
      if (current.state === "approved" && decision === "approve") {
        current = await api("/api/project-environment", result, { csrf, body: { operation: "execute", actionId: current.id } }); setAction(current);
      }
      if (current.state === "observing") setAction(await api("/api/project-environment", result, { csrf, body: { operation: "observe", actionId: current.id } }));
    } catch (cause) { setError(cause instanceof ClientError ? cause.message : "ارتباط کامل نشد؛ وضعیت ثبت‌شده را دریافت کنید."); await load().catch(() => undefined); }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy || disabled) return;
    key.current ??= crypto.randomUUID(); setBusy(true); setError(null);
    const variables = names.filter(name => values[name]).map(name => ({ key: name, value: values[name], public: publicNames[name] === true }));
    // Values belong only to this submission; neither restoration nor a draft cache may reveal them.
    setValues({});
    try { setAction(await api("/api/project-environment", result, { csrf, body: { operation: "propose", runId, requestKey: key.current, variables } })); }
    catch (cause) { setError(cause instanceof ClientError ? cause.message : "ثبت اطلاعات کامل نشد؛ وضعیت را دریافت کنید."); await load().catch(() => undefined); key.current = null; }
    finally { setBusy(false); }
  }
  return <section className="agent-repair" aria-labelledby="environment-title">
    <h3 id="environment-title">اطلاعات امن برنامه</h3>
    <p>مقصد: <bdi>{app || "در حال دریافت…"}</bdi>. مقدارها وارد گفت‌وگو و سابقه عمومی نمی‌شوند. برای حفظ مقدار فعلی، کادر آن را خالی بگذارید.</p>
    {loading ? <p role="status">در حال بازیابی وضعیت…</p> : null}
    {error ? <p className="note" role="alert">{error}</p> : null}
    {!loading && (!action || ["cancelled", "expired", "failed"].includes(action.state)) ? <form onSubmit={event => void submit(event)} autoComplete="off">
      {names.map(name => <div key={name}><label htmlFor={`environment-${name}`}><bdi>{name}</bdi></label>
        <input id={`environment-${name}`} type="password" autoComplete="new-password" dir="ltr" minLength={publicNames[name] ? 0 : 4} maxLength={4096} value={values[name] ?? ""}
          onChange={event => setValues(current => ({ ...current, [name]: event.target.value }))} disabled={disabled || busy} />
        <label className="radio-option"><input type="checkbox" checked={publicNames[name] === true} onChange={event => setPublicNames(current => ({ ...current, [name]: event.target.checked }))} disabled={disabled || busy} />این مقدار عمومی است؛ مثلاً روشن/خاموش</label></div>)}
      <p className="hint">مقدار محرمانه دست‌کم ۴ نویسه دارد. متغیرهای اجرایی مانند PORT توسط تنظیمات اجرا کنترل می‌شوند.</p>
      <button type="submit" disabled={disabled || busy || !names.some(name => values[name])}>مرور تغییر اطلاعات برنامه</button>
    </form> : null}
    {action?.spec.version === 9 ? <>
      <p>کلیدهای این تغییر: {action.spec.keys.map(name => <bdi key={name} className="environment-key"> {name} </bdi>)}. سایر کلیدهای موجود حفظ می‌شوند.</p>
      {action.state === "awaiting_approval" ? <>
        <p className="note">این تغییر ممکن است برنامهٔ مقصد را دوباره راه‌اندازی کند. اجازهٔ انتشار یا تغییر پلن ایجاد نمی‌کند؛ نتیجهٔ اجرای برنامه جدا بررسی می‌شود.</p>
        <div className="button-row"><button type="button" disabled={disabled || busy} onClick={() => void perform("decision", "approve")}>تأیید و اعمال اطلاعات برنامه</button>
          <button className="button-secondary" type="button" disabled={disabled || busy} onClick={() => void perform("decision", "reject")}>رد این تغییر</button></div>
      </> : action.state === "approved" ? <button type="button" disabled={disabled || busy} onClick={() => void perform("execute")}>اجرای تغییر تأییدشده</button>
        : ["observing", "uncertain"].includes(action.state) ? <><p className="note">نتیجه هنوز قطعی نیست. ارسال تکرار نمی‌شود؛ وضعیت همان تغییر را بخوانید.</p><button type="button" disabled={disabled || busy} onClick={() => void perform("observe")}>بررسی نتیجه همین تغییر</button></>
          : action.state === "succeeded" ? <><p role="status">ذخیرهٔ تنظیمات مقصد بررسی شد. سلامت برنامه هنوز با این نتیجه تأیید نمی‌شود.</p><button type="button" disabled={disabled || busy} onClick={onContinue}>ادامه بررسی و انتشار</button></>
            : <p role="status">این تغییر اجرا نشده یا تأیید نشده است؛ می‌توانید اطلاعات را دوباره مرور کنید.</p>}
    </> : null}
    {error ? <button type="button" className="button-secondary" disabled={busy || disabled} onClick={() => void load().catch(() => setError("دریافت وضعیت کامل نشد."))}>دریافت وضعیت ثبت‌شده</button> : null}
  </section>;
}
