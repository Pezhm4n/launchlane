"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Action } from "../contracts/domain.ts";
import { decodeAction } from "../contracts/client-decode.ts";
import { object, string } from "../contracts/validation.ts";
import { api, ClientError } from "./api.ts";
import { WorkspaceGlyph } from "./WorkspaceGlyph.tsx";
import styles from "./ProjectLifecycle.module.css";

const decode = (value: unknown) => { const row = object(value); return row.action === null ? null : decodeAction(row.action); };
export function ProjectLifecycle({ projectId, csrf, disabled, onLockChanged, onExpired, onChanged }: {
  projectId: string; csrf: string; disabled: boolean; onLockChanged: (locked: boolean) => void; onExpired: () => void; onChanged: () => Promise<void>;
}) {
  const [app, setApp] = useState<string | null>(null), [action, setAction] = useState<Action | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const pending = useRef(false), key = useRef<{ effect: string; value: string } | null>(null);
  const failed = useCallback((cause: unknown) => { if (cause instanceof ClientError && cause.code === "AUTH_REQUIRED") onExpired(); else setError(cause instanceof ClientError ? cause.message : "ارتباط کامل نشد؛ وضعیت همین درخواست را دریافت کنید."); }, [onExpired]);
  const load = useCallback(async (signal?: AbortSignal) => {
    const result = await api(`/api/projects/lifecycle?project=${projectId}`, value => { const row = object(value); return { action: decode(value), app: row.app === null ? null : string(row.app, 63) }; }, signal ? { signal } : {});
    if (!signal?.aborted) { setAction(result.action); setApp(result.app); }
  }, [projectId]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal).catch(cause => { if (!controller.signal.aborted) failed(cause); }); return () => controller.abort(); }, [load, failed]);
  const unresolved = !!action && ["awaiting_approval", "approved", "executing", "observing", "uncertain"].includes(action.state);
  useEffect(() => { onLockChanged(busy || unresolved); return () => onLockChanged(false); }, [busy, unresolved, onLockChanged]);
  async function request(operation: "propose" | "decision" | "execute" | "observe", effect?: "stop_app" | "delete_app", decision?: "approve" | "reject") {
    if (disabled || pending.current) return;
    pending.current = true; setBusy(true); setError(null);
    try {
      if (effect && key.current?.effect !== effect) key.current = { effect, value: crypto.randomUUID() };
      let current = await api("/api/projects/lifecycle", decode, { csrf, body: operation === "propose"
        ? { operation, projectId, effect, requestKey: key.current?.value }
        : { operation, actionId: action?.id, ...(decision ? { decision, hash: action?.hash } : {}) } });
      setAction(current);
      if (decision === "approve" && current?.state === "approved") { current = await api("/api/projects/lifecycle", decode, { csrf, body: { operation: "execute", actionId: current.id } }); setAction(current); }
      if (current?.state === "observing") { current = await api("/api/projects/lifecycle", decode, { csrf, body: { operation: "observe", actionId: current.id } }); setAction(current); }
      if (current && ["succeeded", "cancelled", "expired", "failed"].includes(current.state)) key.current = null;
      if (current?.state === "succeeded") { await onChanged(); await load(); }
    } catch (cause) { failed(cause); await load().catch(failed); }
    finally { pending.current = false; setBusy(false); }
  }
  const removed = action?.spec.version === 14 && action.spec.operation === "delete_app" && action.state === "succeeded";
  const stopped = action?.spec.version === 14 && action.spec.operation === "stop_app" && action.state === "succeeded";
  if (!app && !removed && !error) return null;
  return <details className={styles.panel}><summary><WorkspaceGlyph name="stop" />مدیریت توقف و حذف مقصد</summary>
    <div className={styles.content} aria-busy={busy}>
      <h3>{removed ? "مقصد از لیارا حذف شد" : <>مدیریت <bdi>{app}</bdi></>}</h3>
      <p>{removed ? "حذف با خواندن دوبارهٔ لیارا تأیید شد. اکنون می‌توانید پروژه را از «پروژه‌های من» حذف کنید." : "توقف، اجرای سایت را قطع می‌کند. برای حذف پروژه، پس از تأیید توقف، مقصد آن را از همین‌جا حذف کنید."}</p>
      {!removed ? <p className="hint">توقف به معنی پایان همهٔ هزینه‌ها نیست. دیسک، دیتابیس و منابع جداگانه با این کار حذف نمی‌شوند. حذف مقصد، نسخه‌ها و تنظیمات همان برنامه را از لیارا پاک می‌کند؛ برگشت خودکار ندارد.</p> : null}
      {error ? <p className="note note-danger" role="alert">{error}</p> : null}
      {busy ? <p role="status"><WorkspaceGlyph name="loader" />در حال بررسی همین درخواست…</p> : null}
      {action?.state === "awaiting_approval" ? <div className={styles.confirm}>
        <h4>{action.spec.operation === "delete_app" ? "مقصد را برای همیشه حذف کنیم؟" : "اجرای سایت را متوقف کنیم؟"}</h4>
        <p>این تصمیم فقط برای <bdi>{action.spec.scope.app}</bdi> در حساب و تیم متصل است. {action.spec.operation === "delete_app" ? "نسخه‌ها و تنظیمات برنامه از لیارا حذف می‌شوند." : "بازدیدکنندگان به سایت دسترسی نخواهند داشت؛ فایل‌ها و تنظیمات برنامه حفظ می‌شوند."}</p>
        <div className={styles.actions}><button type="button" className="button-secondary" disabled={disabled || busy} onClick={() => void request("decision", undefined, "reject")}>انصراف</button><button type="button" className="button-danger" disabled={disabled || busy} onClick={() => void request("decision", undefined, "approve")}>{action.spec.operation === "delete_app" ? "تأیید حذف دائمی مقصد" : "تأیید توقف برنامه"}</button></div>
      </div> : action?.state === "approved" ? <button type="button" className="button-danger" disabled={disabled || busy} onClick={() => void request("execute")}>اجرای تصمیم ثبت‌شده</button>
        : action && ["executing", "observing", "uncertain"].includes(action.state) ? <><p role="status">نتیجه هنوز قطعی نیست؛ درخواست دیگری ارسال نمی‌شود.</p><button type="button" className="button-secondary" disabled={disabled || busy} onClick={() => action.state === "executing" ? void load().catch(failed) : void request("observe")}>بررسی نتیجهٔ همین درخواست</button></>
          : !removed ? <div className={styles.actions}>{stopped ? <p role="status">{action?.lifecycle?.verification === "instances_absent" ? "توقف و نبود نمونهٔ اجرایی تأیید شد." : "توقف در تنظیمات لیارا ثبت شد. فهرست نمونه‌های اجرایی در دسترس نیست؛ خاموشی کامل آن‌ها تأیید نشده است."}</p> : null}<button type="button" className="button-danger" disabled={disabled || busy} onClick={() => void request("propose", stopped ? "delete_app" : "stop_app")}><WorkspaceGlyph name={stopped ? "trash" : "stop"} />{stopped ? "حذف مقصد از لیارا…" : "توقف برنامه…"}</button></div> : null}
      {action ? <details><summary>رسید مدیریت مقصد</summary><p>وضعیت: <bdi>{action.state}</bdi></p><p>شناسه: <bdi>{action.id}</bdi></p>{action.lifecycle?.checkedAt ? <p>زمان بررسی: {new Date(action.lifecycle.checkedAt).toLocaleString("fa-IR")}</p> : null}</details> : null}
    </div>
  </details>;
}
