"use client";
import { useEffect, useRef, useState } from "react";
import { mcpOrigin, parseMcpAccessFile, type McpAccessFile } from "../contracts/mcp-access-file.ts";
import { object } from "../contracts/validation.ts";
import { api, ClientError } from "./api.ts";
import { useDialogExit } from "./useDialogExit.ts";

export function McpConnectionDialog({ csrf, onClose, onSessionExpired }: {
  csrf: string; onClose: () => void; onSessionExpired: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null), exit = useDialogExit(dialog);
  const [missions, setMissions] = useState(true), [busy, setBusy] = useState(false);
  const [grant, setGrant] = useState<McpAccessFile | null>(null);
  const [supported, setSupported] = useState(false), [error, setError] = useState(""), [downloaded, setDownloaded] = useState(false);
  useEffect(() => {
    const node = dialog.current;
    try { setSupported(mcpOrigin(location.origin) === location.origin); } catch { setSupported(false); }
    node?.showModal(); return () => node?.close();
  }, []);
  const dismiss = () => { if (!busy) exit(onClose); };
  async function issue() {
    if (busy || grant || !supported) return;
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
  async function revoke() {
    if (busy || !grant) return;
    setBusy(true); setError("");
    try {
      await api("/api/mcp/access", value => object(value), { method: "DELETE", csrf, body: { id: grant.id }, signal: AbortSignal.timeout(15_000) });
      setGrant(null); setDownloaded(false);
    } catch (cause) {
      if (cause instanceof ClientError && cause.code === "MCP_ACCESS_NOT_FOUND") { setGrant(null); setDownloaded(false); return; }
      if (cause instanceof ClientError && cause.code === "AUTH_REQUIRED") { onSessionExpired(); return; }
      setError("لغو دسترسی تأیید نشد؛ پیش از استفاده دوباره وضعیت اتصال را بررسی کنید.");
    } finally { setBusy(false); }
  }
  return <dialog ref={dialog} aria-labelledby="mcp-connect-title" aria-describedby="mcp-connect-help" onCancel={(event) => { event.preventDefault(); event.stopPropagation(); dismiss(); }}>
    <div className="section-heading"><h2 id="mcp-connect-title">اتصال MCP</h2><button type="button" className="button-quiet" disabled={busy} onClick={dismiss}>بستن اتصال MCP</button></div>
    <p id="mcp-connect-help">ابزار کدنویسی شما می‌تواند پروژه و مراحل همین حساب را از Launchlane بخواند. تصمیم‌های لازم همچنان در خود Launchlane تأیید می‌شوند.</p>
    {!supported ? <p className="note">اتصال MCP به HTTPS معتبر یا نصب محلی نیاز دارد.</p> : null}
    <fieldset disabled={busy || Boolean(grant) || !supported}>
      <legend>محدودهٔ اتصال</legend>
      <label className="checkbox-row"><input type="checkbox" checked={missions} onChange={(event) => setMissions(event.target.checked)} />اجازهٔ شروع، ادامه و توقف مأموریت انتشار</label>
      <p className="hint">بدون این اجازه، اتصال فقط خواندنی است. صدور این فایل مدل یا انتشار را شروع نمی‌کند؛ شروع مأموریت بعدی می‌تواند از بودجهٔ موجود استفاده کند.</p>
    </fieldset>
    {!grant ? <button type="button" disabled={busy || !supported} onClick={() => void issue()}>{busy ? "در حال صدور دسترسی…" : "ساخت دسترسی همین حساب"}</button> : <>
      <p className="note" role="status">دسترسی صادر شد؛ تا <time dateTime={new Date(grant.expiresAt).toISOString()}>{new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" }).format(grant.expiresAt)}</time> و تا زمان خروج از همین نشست معتبر است.</p>
      <button type="button" disabled={busy} onClick={download}>{downloaded ? "دانلود دوبارهٔ همان فایل" : "دانلود فایل دسترسی MCP"}</button>
      <button type="button" className="button-quiet" disabled={busy} onClick={() => void revoke()}>لغو همین دسترسی MCP</button>
      {downloaded ? <p className="hint" role="status">دانلود آغاز شد. فایل را فقط برای تنظیم اتصال محلی نگه دارید؛ در گفتگو، مخزن یا پروژهٔ قابل انتشار قرار ندهید.</p> : null}
    </>}
    {error ? <p className="note note-danger" role="alert">{error}</p> : null}
    <details><summary>راهنمای اتصال به ابزار کدنویسی</summary><p className="hint">پس از دانلود، فایل با فرمان setup:mcp، گزینهٔ --from-file و --origin همین سایت به پوشهٔ خصوصی نصب وارد می‌شود. فایل‌های تنظیم Codex، Claude Code و OpenCode بدون کلید خام آماده می‌شوند؛ فقط ورودی Launchlane را با تنظیمات موجود ادغام کنید. این فایل حداکثر یک ساعت و تا پایان نشست ورود معتبر است.</p></details>
  </dialog>;
}
