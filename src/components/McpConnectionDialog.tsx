"use client";
import { useEffect, useRef, useState } from "react";
import { parseMcpAccessFile, type McpAccessFile } from "../contracts/mcp-access-file.ts";
import { object } from "../contracts/validation.ts";
import { api, ClientError } from "./api.ts";
import { useDialogExit } from "./useDialogExit.ts";

export function McpConnectionDialog({ csrf, onClose, onSessionExpired }: {
  csrf: string; onClose: () => void; onSessionExpired: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null), exit = useDialogExit(dialog);
  const [missions, setMissions] = useState(true), [busy, setBusy] = useState(false);
  const [grant, setGrant] = useState<McpAccessFile | null>(null);
  const [local, setLocal] = useState(false), [error, setError] = useState(""), [downloaded, setDownloaded] = useState(false);
  useEffect(() => {
    const node = dialog.current;
    setLocal(location.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(location.hostname));
    node?.showModal(); return () => node?.close();
  }, []);
  const dismiss = () => { if (!busy) exit(onClose); };
  async function issue() {
    if (busy || grant || !local) return;
    setBusy(true); setError("");
    try {
      const result = await api("/api/mcp/access", (value) => parseMcpAccessFile({ ...object(value), url: `${location.origin}/api/mcp` }, location.origin),
        { method: "POST", csrf, body: { missions }, signal: AbortSignal.timeout(15_000) });
      setGrant(result);
    } catch (cause) {
      if (cause instanceof ClientError && cause.code === "AUTH_REQUIRED") { onSessionExpired(); return; }
      setError(cause instanceof ClientError ? cause.message : "پاسخ صدور دسترسی دریافت نشد. هیچ مأموریت یا انتشار تازه‌ای آغاز نشده است.");
    } finally { setBusy(false); }
  }
  function download() {
    if (!grant || grant.expiresAt <= Date.now()) { setError("این دسترسی منقضی شده است؛ پنجره را ببندید و دسترسی تازه‌ای بسازید."); return; }
    const url = URL.createObjectURL(new Blob([JSON.stringify(grant, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "launchlane-mcp-access.json"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); setDownloaded(true);
  }
  return <dialog ref={dialog} aria-labelledby="mcp-connect-title" aria-describedby="mcp-connect-help" onCancel={(event) => { event.preventDefault(); event.stopPropagation(); dismiss(); }}>
    <div className="section-heading"><h2 id="mcp-connect-title">اتصال MCP</h2><button type="button" className="button-quiet" disabled={busy} onClick={dismiss}>بستن اتصال MCP</button></div>
    <p id="mcp-connect-help">ابزار کدنویسی شما می‌تواند پروژه و مراحل همین حساب را از Launchlane بخواند. تصمیم‌های لازم همچنان در خود Launchlane تأیید می‌شوند.</p>
    {!local ? <p className="note">این اتصال در نسخهٔ فعلی فقط روی نصب محلی آماده است؛ دسترسی عمومی MCP هنوز فعال نیست.</p> : null}
    <fieldset disabled={busy || Boolean(grant) || !local}>
      <legend>محدودهٔ اتصال</legend>
      <label className="checkbox-row"><input type="checkbox" checked={missions} onChange={(event) => setMissions(event.target.checked)} />اجازهٔ شروع، ادامه و توقف مأموریت انتشار</label>
      <p className="hint">بدون این اجازه، اتصال فقط خواندنی است. صدور این فایل مدل یا انتشار را شروع نمی‌کند؛ شروع مأموریت بعدی می‌تواند از بودجهٔ موجود استفاده کند.</p>
    </fieldset>
    {!grant ? <button type="button" disabled={busy || !local} onClick={() => void issue()}>{busy ? "در حال صدور دسترسی…" : "ساخت دسترسی همین حساب"}</button> : <>
      <p className="note" role="status">دسترسی صادر شد؛ تا <time dateTime={new Date(grant.expiresAt).toISOString()}>{new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" }).format(grant.expiresAt)}</time> و تا زمان خروج از همین نشست معتبر است.</p>
      <button type="button" onClick={download}>{downloaded ? "دانلود دوبارهٔ همان فایل" : "دانلود فایل دسترسی MCP"}</button>
      {downloaded ? <p className="hint" role="status">دانلود آغاز شد. فایل را فقط برای تنظیم اتصال محلی نگه دارید؛ در گفتگو، مخزن یا پروژهٔ قابل انتشار قرار ندهید.</p> : null}
    </>}
    {error ? <p className="note note-danger" role="alert">{error}</p> : null}
    <details><summary>راهنمای اتصال به ابزار کدنویسی</summary><p className="hint">پس از دانلود، فایل با فرمان setup:mcp و گزینهٔ --from-file به پوشهٔ خصوصی نصب وارد می‌شود. Codex از bridge همین نصب استفاده می‌کند؛ فایل تنظیمات فقط مسیر فایل را نگه می‌دارد. این فایل حداکثر یک ساعت اعتبار دارد.</p></details>
  </dialog>;
}
