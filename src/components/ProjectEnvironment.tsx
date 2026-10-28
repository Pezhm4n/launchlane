"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { Action } from "../contracts/domain.ts";
import { decodeAction } from "../contracts/client-decode.ts";
import { environmentKey, isPublicClientEnvironmentKey } from "../contracts/environment.ts";
import { canGenerateSigningSecret, generateSigningSecret } from "../contracts/generated-secret.ts";
import { object, string } from "../contracts/validation.ts";
import { api, ClientError } from "./api.ts";
import { WorkspaceGlyph } from "./WorkspaceGlyph.tsx";
import styles from "./ProjectEnvironment.module.css";

function result(value: unknown) { return decodeAction(object(value).action); }
export function ProjectEnvironment({ runId, csrf, disabled, onContinue, onLockChanged, onExpired }: {
  runId: string; csrf: string; disabled: boolean; onContinue: () => void; onLockChanged: (locked: boolean) => void; onExpired: () => void;
}) {
  const [names, setNames] = useState<string[]>([]), [app, setApp] = useState(""), [action, setAction] = useState<Action | null>(null),
    [values, setValues] = useState<Record<string, string>>({}), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null);
  const key = useRef<string | null>(null);
  const [publicNames, setPublicNames] = useState<Record<string, boolean>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [generatedKeys, setGeneratedKeys] = useState<Record<string, boolean>>({});
  const [imported, setImported] = useState<{ available: string[]; needsReview: string[]; publicKeys: string[] }>({ available: [], needsReview: [], publicKeys: [] });
  const [database, setDatabase] = useState<{ hostname: string; keys: string[] } | null>(null);
  const failed = useCallback((cause: unknown) => {
    if (cause instanceof ClientError && cause.code === "AUTH_REQUIRED") onExpired();
    else setError(cause instanceof ClientError ? cause.message : "ارتباط کامل نشد؛ وضعیت ثبت‌شده را دریافت کنید.");
  }, [onExpired]);
  const load = useCallback(async (signal?: AbortSignal) => {
    const data = await api(`/api/project-environment?run=${runId}`, value => {
      const row = object(value);
      if (!Array.isArray(row.names)) throw new ClientError("INVALID_RESPONSE", "فهرست اطلاعات لازم معتبر نیست.");
      const source = object(row.imported), keys = (value: unknown) => { if (!Array.isArray(value)) throw new ClientError("INVALID_RESPONSE", "فهرست تنظیمات معتبر نیست."); return value.map(environmentKey); };
      const db = row.database === undefined || row.database === null ? null : object(row.database);
      return { names: row.names.map(environmentKey), app: string(row.app, 63), action: row.action === null ? null : decodeAction(row.action),
        database: db ? { hostname: string(db.hostname, 63), keys: keys(db.keys) } : null,
        imported: { available: keys(source.available), needsReview: keys(source.needsReview), publicKeys: keys(source.publicKeys) } };
    }, { ...(signal ? { signal } : {}) });
    if (signal?.aborted) return;
    setNames(data.names); setApp(data.app); setAction(data.action);
    setImported(data.imported);
    setDatabase(data.database);
    if (data.action && ["cancelled", "expired", "failed"].includes(data.action.state)) key.current = null;
  }, [runId]);
  useEffect(() => {
    const controller = new AbortController(); setValues({}); setVisible({}); setPublicNames({}); setGeneratedKeys({}); setAction(null); setLoading(true); key.current = null;
    void load(controller.signal).catch(cause => { if (!controller.signal.aborted) failed(cause); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [load, failed]);
  const locked = busy || !!action && ["awaiting_approval", "approved", "executing", "observing", "uncertain"].includes(action.state);
  const publicClientKeys = action?.spec.version === 9 ? action.spec.keys.filter(isPublicClientEnvironmentKey) : [];
  useEffect(() => { onLockChanged(locked); return () => onLockChanged(false); }, [locked, onLockChanged]);
  async function perform(operation: "decision" | "execute" | "observe", decision?: "approve" | "reject") {
    if (!action || busy || disabled) return;
    setBusy(true); setError(null);
    try {
      let current = await api("/api/project-environment", result, { csrf, body: { operation, actionId: action.id,
        ...(decision ? { decision, hash: action.hash } : {}) } });
      setAction(current);
      if (["cancelled", "failed", "expired"].includes(current.state)) key.current = null;
      if (current.state === "approved" && decision === "approve") {
        current = await api("/api/project-environment", result, { csrf, body: { operation: "execute", actionId: current.id } }); setAction(current);
      }
      if (current.state === "observing") setAction(await api("/api/project-environment", result, { csrf, body: { operation: "observe", actionId: current.id } }));
    } catch (cause) { failed(cause); await load().catch(failed); }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy || disabled) return;
    key.current ??= crypto.randomUUID(); setBusy(true); setError(null);
    const variables = names.filter(name => values[name]).map(name => ({ key: name, value: values[name], public: generatedKeys[name] ? false : publicNames[name] === true }));
    // Values belong only to this submission; neither restoration nor a draft cache may reveal them.
    setValues({}); setVisible({}); setGeneratedKeys({});
    try { setAction(await api("/api/project-environment", result, { csrf, body: { operation: "propose", runId, requestKey: key.current, variables } })); }
    catch (cause) { failed(cause); await load().catch(failed); key.current = null; }
    finally { setBusy(false); }
  }
  async function reviewDatabase() {
    if (busy || disabled || !database) return;
    key.current ??= crypto.randomUUID(); setBusy(true); setError(null);
    try { setAction(await api("/api/project-environment", result, { csrf, body: { operation: "propose-database", runId, requestKey: key.current } })); }
    catch (cause) { failed(cause); await load().catch(failed); key.current = null; }
    finally { setBusy(false); }
  }
  async function reviewImported() {
    if (busy || disabled) return;
    key.current ??= crypto.randomUUID(); setBusy(true); setError(null);
    try { setAction(await api("/api/project-environment", result, { csrf, body: { operation: "propose-import", runId, requestKey: key.current,
      publicKeys: imported.publicKeys.filter(name => publicNames[name]) } })); }
    catch (cause) { failed(cause); await load().catch(failed); key.current = null; }
    finally { setBusy(false); }
  }
  function generate(name: string) {
    if (disabled || busy || values[name] || publicNames[name] || !canGenerateSigningSecret(name) || imported.available.includes(name) || imported.needsReview.includes(name)) return;
    try {
      const value = generateSigningSecret();
      setValues(current => current[name] ? current : { ...current, [name]: value });
      setVisible(current => ({ ...current, [name]: false }));
      setPublicNames(current => ({ ...current, [name]: false }));
      setGeneratedKeys(current => ({ ...current, [name]: true })); setError(null);
    } catch { setError("ساخت مقدار امن در این مرورگر در دسترس نیست؛ مقدار مناسب برنامه را دستی وارد کنید."); }
  }
  return <section className={`agent-repair ${styles.panel}`} aria-labelledby="environment-title" aria-busy={busy}>
    <h3 id="environment-title">اطلاعات امن برنامه</h3>
    <p className={styles.intro}>تنظیمات <bdi>{app || "برنامه"}</bdi> اینجا امن نگهداری می‌شوند. تنظیمات پوشه، در صورت وجود، آمادهٔ استفاده‌اند؛ فقط موارد باقی‌مانده را تکمیل کنید.</p>
    {busy ? <p role="status" className={styles.status}><WorkspaceGlyph name="loader" />در حال بررسی همین تنظیمات…</p> : null}
    {loading ? <p role="status">در حال بازیابی وضعیت…</p> : null}
    {error ? <p className="note" role="alert">{error}</p> : null}
    {!loading && (!action || ["cancelled", "expired", "failed"].includes(action.state)) ? <form onSubmit={event => void submit(event)} autoComplete="off">
      {database ? <div className="note"><p>اتصال دیتابیس همین مأموریت، <bdi>{database.hostname}</bdi>، برای {database.keys.map(name => <bdi key={name}> {name} </bdi>)} آمادهٔ دریافت امن است. مقدار اتصال نمایش داده نمی‌شود؛ پیش از اعمال، تغییر را جدا تأیید می‌کنید.</p>
        <button type="button" disabled={disabled || busy} onClick={() => void reviewDatabase()}>آماده‌کردن اتصال امن دیتابیس</button></div> : null}
      {imported.available.length ? <div className="note"><p>این تنظیمات از پوشهٔ شما امن دریافت شده‌اند؛ لازم نیست مقدارها را دوباره وارد کنید: {imported.available.map(name => <bdi key={name}> {name} </bdi>)}</p>
        {imported.publicKeys.filter(name => imported.available.includes(name)).map(name => <label key={name} className="radio-option"><input type="checkbox" checked={publicNames[name] === true} onChange={event => setPublicNames(current => ({ ...current, [name]: event.target.checked }))} disabled={disabled || busy} />مقدار <bdi>{name}</bdi> عمومی است و در سایت دیده می‌شود.</label>)}
        <button type="button" disabled={disabled || busy || imported.publicKeys.filter(name => imported.available.includes(name)).some(name => !publicNames[name])} onClick={() => void reviewImported()}>مرور و استفاده از تنظیمات پوشه</button></div> : null}
      {imported.needsReview.length ? <p className="note">این تنظیمات پیش از استفاده در سایت زنده نیاز به بررسی دارند: {imported.needsReview.map(name => <bdi key={name}> {name} </bdi>)}. نشانی محلی، مقدار کوتاه یا ارجاع به متغیر دیگر خودکار اعمال نمی‌شود.</p> : null}
      <details open={!imported.available.length}><summary>واردکردن یا تغییر دستی مقدارها</summary>
      <div className={styles.fields}>{names.map(name => <div className={styles.field} key={name}><label htmlFor={`environment-${name}`}><bdi>{name}</bdi></label>
        <div className={styles.input}><input id={`environment-${name}`} type={visible[name] ? "text" : "password"} autoComplete="new-password" dir="ltr" minLength={publicNames[name] ? 0 : 4} maxLength={4096} value={values[name] ?? ""}
          aria-describedby={isPublicClientEnvironmentKey(name) ? `visibility-${name}` : canGenerateSigningSecret(name) ? `generation-help-${name}` : undefined}
          onChange={event => { setValues(current => ({ ...current, [name]: event.target.value })); setGeneratedKeys(current => ({ ...current, [name]: false })); }} disabled={disabled || busy} />
          <button className="button-quiet" type="button" aria-label={`${visible[name] ? "پنهان‌کردن" : "نمایش"} مقدار ${name}`} aria-pressed={visible[name] === true} disabled={disabled || busy}
            onClick={() => setVisible(current => ({ ...current, [name]: !current[name] }))}><WorkspaceGlyph name={visible[name] ? "eye-off" : "eye"} /></button></div>
        {isPublicClientEnvironmentKey(name) ? <p className="note" id={`visibility-${name}`}>مقدار این متغیر در فایل‌های سایت برای بازدیدکنندگان قابل دیدن است؛ رمز یا کلید محرمانه وارد نکنید.</p> : null}
        {canGenerateSigningSecret(name) ? <>
          <p className="hint" id={`generation-help-${name}`}>اگر برنامه برای امضا به مقدار تصادفی تازه نیاز دارد، آن را اینجا بسازید. جایگزینی کلید قبلی می‌تواند نشست‌ها و توکن‌های ورود را نامعتبر کند.</p>
          {!imported.available.includes(name) && !imported.needsReview.includes(name) ? <div className={styles.actions}><button type="button" className="button-secondary"
            aria-label={`ساخت مقدار تصادفی برای ${name}`} aria-describedby={`generation-help-${name}`}
            disabled={disabled || busy || !!values[name] || publicNames[name] === true} onClick={() => generate(name)}>ساخت مقدار تصادفی</button></div> : null}
          {generatedKeys[name] ? <p role="status" className="hint">مقدار تازه در همین فرم ساخته شد و هنوز اعمال نشده است. برای ادامه، تغییر را مرور کنید.</p> : null}
        </> : null}
        <label className={styles.visibility}><input type="checkbox" aria-label={`عمومی بودن ${name}`} checked={publicNames[name] === true} onChange={event => setPublicNames(current => ({ ...current, [name]: event.target.checked }))} disabled={disabled || busy || generatedKeys[name] === true} />این مقدار محرمانه نیست</label></div>)}</div>
      <p className="hint">مقدار محرمانه دست‌کم ۴ نویسه دارد. متغیرهای اجرایی مانند PORT توسط تنظیمات اجرا کنترل می‌شوند.</p>
      <div className={styles.actions}><button type="submit" disabled={disabled || busy || !names.some(name => values[name]) || names.some(name => values[name] && isPublicClientEnvironmentKey(name) && !publicNames[name])}><WorkspaceGlyph name="shield" />مرور تغییر اطلاعات برنامه</button></div>
      </details>
    </form> : null}
    {action?.spec.version === 9 ? <>
      <p>کلیدهای این تغییر: {action.spec.keys.map(name => <bdi key={name} className="environment-key"> {name} </bdi>)}. سایر کلیدهای موجود حفظ می‌شوند.</p>
      {publicClientKeys.length ? <p className="note">این کلیدها در خروجی مرورگر عمومی خواهند بود: {publicClientKeys.map(key => <bdi key={key}> {key} </bdi>)}. مقدار محرمانه برای آن‌ها مجاز نیست.</p> : null}
      {action.state === "awaiting_approval" ? <>
        <p className="note">این تغییر ممکن است برنامهٔ مقصد را دوباره راه‌اندازی کند. اجازهٔ انتشار یا تغییر پلن ایجاد نمی‌کند؛ نتیجهٔ اجرای برنامه جدا بررسی می‌شود.</p>
        <div className="button-row"><button type="button" disabled={disabled || busy} onClick={() => void perform("decision", "approve")}>تأیید و اعمال اطلاعات برنامه</button>
          <button className="button-secondary" type="button" disabled={disabled || busy} onClick={() => void perform("decision", "reject")}>رد این تغییر</button></div>
      </> : action.state === "approved" ? <div className="button-row"><button type="button" disabled={disabled || busy} onClick={() => void perform("execute")}>اجرای تغییر تأییدشده</button>
        <button type="button" className="button-secondary" disabled={disabled || busy} onClick={() => void perform("decision", "reject")}>لغو تصمیم و مرور دوباره</button></div>
        : action.state === "executing" ? <><p role="status">اجرای همین تغییر در جریان است؛ نتیجه هنوز قطعی نیست و درخواست دیگری ارسال نمی‌شود.</p>
          <button type="button" disabled={disabled || busy} onClick={() => void load().catch(failed)}>دریافت وضعیت همین تغییر</button></>
        : ["observing", "uncertain"].includes(action.state) ? <><p className="note">نتیجه هنوز قطعی نیست. ارسال تکرار نمی‌شود؛ وضعیت همان تغییر را بخوانید.</p><button type="button" disabled={disabled || busy} onClick={() => void perform("observe")}>بررسی نتیجه همین تغییر</button></>
          : action.state === "succeeded" ? <><p role="status">ذخیرهٔ تنظیمات مقصد بررسی شد. سلامت برنامه هنوز با این نتیجه تأیید نمی‌شود.</p><button type="button" disabled={disabled || busy} onClick={onContinue}>ادامه بررسی و انتشار</button></>
            : <p role="status">این تغییر اجرا نشده یا تأیید نشده است؛ می‌توانید اطلاعات را دوباره مرور کنید.</p>}
    </> : null}
    {error ? <div className={styles.actions}><button type="button" className="button-secondary" disabled={busy || disabled} onClick={() => void load().catch(failed)}><WorkspaceGlyph name="search" />دریافت وضعیت ثبت‌شده</button></div> : null}
  </section>;
}
