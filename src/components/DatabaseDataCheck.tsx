"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { parseDatabaseDataObservation, parseDatabaseDataState, type DatabaseDataState } from "../contracts/database-data.ts";
import { api, ClientError } from "./api.ts";

/** Reading stored state on mount never performs another SQL observation. */
export function DatabaseDataCheck({ actionId, csrf, disabled }: { actionId: string; csrf: string; disabled: boolean }) {
  const [state, setState] = useState<DatabaseDataState | null>(null), [busy, setBusy] = useState(false),
    [message, setMessage] = useState<string | null>(null), [error, setError] = useState<string | null>(null);
  const pending = useRef<AbortController | null>(null), button = useRef<HTMLButtonElement>(null), restoreFocus = useRef(false);
  const loadStored = useCallback((controller: AbortController) => {
    setState(null); setError(null); setMessage(null); setBusy(false);
    void api(`/api/projects/database-data?actionId=${actionId}`, parseDatabaseDataState, { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) setState(value); })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof ClientError ? reason.message : "خواندن بررسی قبلی داده کامل نشد؛ دوباره آن را بخوانید."); });
  }, [actionId]);
  useEffect(() => {
    const controller = new AbortController(); loadStored(controller);
    return () => { controller.abort(); pending.current?.abort(); };
  }, [loadStored]);
  useEffect(() => {
    if (!busy && restoreFocus.current) { restoreFocus.current = false; button.current?.focus(); }
  }, [busy]);
  if (state?.available === false) return null;
  async function check(compare = false) {
    if (!state || disabled || busy || !state.enabled) return;
    const controller = new AbortController(); pending.current = controller; setBusy(true); setMessage(null); setError(null);
    try {
      const observation = await api("/api/projects/database-data", parseDatabaseDataObservation, { csrf, signal: controller.signal,
        body: { actionId, baselineId: compare ? state.latest?.id ?? null : null } });
      if (!controller.signal.aborted) setState({ ...state, latest: observation });
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof ClientError ? reason.message : "بررسی اتصال یا داده کامل نشد؛ موفقیت تأیید نشده است.");
    } finally {
      if (!controller.signal.aborted) { pending.current = null; setBusy(false); }
    }
  }
  function cancel() {
    pending.current?.abort(); pending.current = null; restoreFocus.current = true; setBusy(false); setMessage("بررسی لغو شد؛ نتیجهٔ تازه تأیید نشده است.");
  }
  const latest = state?.latest, number = (value: number) => new Intl.NumberFormat("fa-IR").format(value);
  return <details className="technical-details database-data-check">
    <summary>بررسی دیتابیس‌های این نسخه</summary>
    <p>اتصال و معیارهای دادهٔ همین بسته با خواندن محدود و مستقل سنجیده می‌شوند. migration یا داده‌ای تغییر نمی‌کند.</p>
    {!state && !error ? <p role="status">در حال خواندن بررسی‌های ذخیره‌شده…</p> : null}
    {state && !state.enabled ? <p className="hint">بررسی مستقیم داده در این نصب فعال نیست. میزبان Launchlane باید دسترسی خصوصی به شبکهٔ همین دیتابیس‌ها داشته باشد؛ مسئول نصب می‌تواند این قابلیت را پس از بررسی اتصال فعال کند.</p> : null}
    {latest ? <div className="note">
      <p role="status">{latest.outcome === "verified" ? "اتصال و معیارهای انتخاب‌شدهٔ داده تأیید شدند." : "دست‌کم یکی از معیارهای داده تأیید نشد."}</p>
      <p className="hint">آخرین مشاهده: {new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeStyle: "short" }).format(latest.checkedAt)}؛ وضعیت جاری با این مشاهدهٔ ذخیره‌شده تضمین نمی‌شود.</p>
      <ul>{latest.targets.map(target => <li key={target.id}><bdi>{target.id}</bdi>: {number(target.columnChecks)} ستون، {number(target.rowChecks)} معیار ردیف و {number(target.persistenceChecks)} مقدار state خوانده شد؛ {target.schemaMatches && target.rowsMatch && target.persistencePresent && target.persistenceNonNull ? "معیارها برابرند" : "معیارها کامل تأیید نشدند"}.</li>)}</ul>
      {latest.comparison === "same_selected_values" ? <p>مقادیر انتخاب‌شده با بررسی قبلی برابرند؛ این مقایسه ماندگاری پس از restart را ثابت نمی‌کند.</p>
        : latest.comparison === "selected_values_changed" ? <p>مقادیر انتخاب‌شده نسبت به بررسی قبلی تغییر کرده‌اند؛ علت تغییر هنوز مشخص نیست.</p>
          : latest.comparison === "not_comparable" ? <p>معیارهای یکی از دو بررسی کامل تأیید نشده‌اند؛ برابری مقدارها اعلام نمی‌شود.</p> : null}
      <p className="hint">اجرای migration، نوشتن واقعی برنامه و ماندگاری پس از restart هنوز جداگانه باید اثبات شوند.</p>
    </div> : state ? <p className="hint">هنوز بررسی مستقلی برای دادهٔ این انتشار ثبت نشده است.</p> : null}
    {error ? <p className="error-message" role="alert">{error}</p> : null}
    {message ? <p role="status">{message}</p> : null}
    <div className="button-row">
      {!state && error ? <button type="button" className="button-secondary" disabled={disabled} onClick={() => { const controller = new AbortController(); pending.current = controller; loadStored(controller); }}>خواندن دوبارهٔ بررسی قبلی</button> : null}
      <button ref={button} type="button" className="button-secondary" disabled={disabled || busy || !state?.enabled} onClick={() => void check()}>
        {busy ? "در حال بررسی اتصال و داده…" : "بررسی اتصال و داده"}
      </button>
      {latest ? <button type="button" className="button-secondary" disabled={disabled || busy || !state?.enabled} onClick={() => void check(true)}>مقایسه با بررسی قبلی</button> : null}
      {busy ? <button type="button" className="button-secondary" onClick={cancel}>لغو بررسی</button> : null}
    </div>
  </details>;
}
