"use client";
import { useEffect, useRef, useState, type FocusEvent } from "react";
import { mcpOrigin, parseMcpAccessFile, type McpAccessFile } from "../contracts/mcp-access-file.ts";
import { object } from "../contracts/validation.ts";
import { api, ClientError } from "./api.ts";
import { mcpCheckPrompt, mcpClients, mcpSetupGuide, type McpClient, type McpShell } from "./mcp-setup-guide.ts";
import { useDialogExit } from "./useDialogExit.ts";
import { WorkspaceGlyph } from "./WorkspaceGlyph.tsx";
import styles from "./McpConnectionDialog.module.css";

function CopyText({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<"idle" | "copying" | "copied" | "failed">("idle");
  async function copy() {
    setState("copying");
    try { await navigator.clipboard.writeText(text); setState("copied"); }
    catch { setState("failed"); }
  }
  return <div className={styles.copyBlock}>
    <div className={styles.copyHeader}><span>{label}</span>
      <button type="button" className="button-quiet" aria-label={`کپی ${label}`} disabled={state === "copying"} onClick={() => void copy()}>
        <WorkspaceGlyph name={state === "copied" ? "check" : "copy"} />{state === "copied" ? "کپی شد" : state === "copying" ? "در حال کپی…" : "کپی"}
      </button>
    </div>
    <textarea readOnly aria-label={label} dir="auto" value={text} rows={3} onFocus={event => event.currentTarget.select()} />
    <span className={styles.copyFeedback} role="status">{state === "failed" ? "کپی خودکار در دسترس نیست؛ متن بالا را انتخاب و کپی کنید." : state === "copied" ? "متن در حافظه کپی شد." : ""}</span>
  </div>;
}

export function McpConnectionDialog({ csrf, onClose, onSessionExpired }: {
  csrf: string; onClose: () => void; onSessionExpired: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null), exit = useDialogExit(dialog);
  const focusFrame = useRef<number | null>(null);
  const pending = useRef<AbortController | null>(null), errorBox = useRef<HTMLParagraphElement>(null);
  const downloadButton = useRef<HTMLButtonElement>(null), issueButton = useRef<HTMLButtonElement>(null);
  const revokeButton = useRef<HTMLButtonElement>(null), cancelRevoke = useRef<HTMLButtonElement>(null);
  const [client, setClient] = useState<McpClient>("codex"), [shell, setShell] = useState<McpShell>("powershell");
  const [missions, setMissions] = useState(false), [busy, setBusy] = useState<"issue" | "revoke" | null>(null);
  const [grant, setGrant] = useState<McpAccessFile | null>(null), [now, setNow] = useState(Date.now);
  const [origin, setOrigin] = useState<string | null>(null), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [downloaded, setDownloaded] = useState(false), [guideOpen, setGuideOpen] = useState(false), [confirmRevoke, setConfirmRevoke] = useState(false);
  const selected = mcpClients.find(row => row.id === client) ?? mcpClients[0];
  const expired = Boolean(grant && grant.expiresAt <= now), usable = Boolean(grant && !expired);
  const guide = grant && origin ? mcpSetupGuide(origin, grant.id, client, shell) : null;

  useEffect(() => {
    const node = dialog.current;
    try { setOrigin(mcpOrigin(location.origin)); } catch { setOrigin(""); }
    node?.showModal();
    return () => { pending.current?.abort(); pending.current = null; if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current); node?.close(); };
  }, []);
  useEffect(() => {
    if (!grant) return;
    const update = () => setNow(Date.now());
    update();
    const timer = setTimeout(update, Math.max(0, grant.expiresAt - Date.now()) + 25);
    window.addEventListener("focus", update); document.addEventListener("visibilitychange", update);
    return () => { clearTimeout(timer); window.removeEventListener("focus", update); document.removeEventListener("visibilitychange", update); };
  }, [grant]);
  useEffect(() => { if (error) errorBox.current?.focus(); }, [error]);
  useEffect(() => { if (grant) downloadButton.current?.focus(); }, [grant]);
  useEffect(() => { if (confirmRevoke) cancelRevoke.current?.focus(); else revokeButton.current?.focus(); }, [confirmRevoke]);

  const dismiss = () => { if (!pending.current) exit(onClose); };
  function revealFocus(event: FocusEvent<HTMLDialogElement>) {
    const root = event.currentTarget, target = event.target;
    if (!(target instanceof HTMLElement) || target === root) return;
    if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
    focusFrame.current = requestAnimationFrame(() => {
      focusFrame.current = null;
      if (!root.isConnected || document.activeElement !== target) return;
      const header = root.querySelector("header");
      if (!header || header.contains(target)) return;
      const box = target.getBoundingClientRect(), panel = root.getBoundingClientRect();
      const top = header.getBoundingClientRect().bottom, bottom = panel.bottom - root.clientTop;
      if (box.top < top) root.scrollTop -= top - box.top;
      else if (box.bottom > bottom) root.scrollTop += box.bottom - bottom;
    });
  }
  function cancelConfirmation() { setConfirmRevoke(false); }
  async function issue() {
    if (pending.current || usable || !origin) return;
    const controller = new AbortController(); pending.current = controller;
    setBusy("issue"); setError(""); setNotice("");
    try {
      const result = await api("/api/mcp/access", value => parseMcpAccessFile({ ...object(value), url: `${origin}/api/mcp` }, origin),
        { method: "POST", csrf, body: { missions }, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) });
      if (controller.signal.aborted) return;
      setGrant(result); setNow(Date.now()); setDownloaded(false); setGuideOpen(false); setConfirmRevoke(false);
    } catch (cause) {
      if (controller.signal.aborted) return;
      if (cause instanceof ClientError && cause.code === "AUTH_REQUIRED") { onSessionExpired(); return; }
      setError(cause instanceof ClientError ? cause.message : "پاسخ صدور دسترسی دریافت نشد. مأموریت یا انتشار تازه‌ای آغاز نشده؛ اتصال اینترنت را بررسی و دوباره تلاش کنید.");
    } finally { if (pending.current === controller) { pending.current = null; setBusy(null); } }
  }
  function download() {
    if (!grant || grant.expiresAt <= Date.now()) { setNow(Date.now()); setError("این فایل منقضی شده است. دسترسی تازه‌ای بسازید و تنظیم ابزار را به‌روز کنید."); return; }
    try {
      const url = URL.createObjectURL(new Blob([JSON.stringify(grant, null, 2)], { type: "application/json" }));
      try { const link = document.createElement("a"); link.href = url; link.download = "launchlane-mcp-access.json"; link.click(); }
      finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
      setDownloaded(true); setGuideOpen(true); setError("");
    } catch { setError("دانلود فایل آغاز نشد؛ مجوز دانلود مرورگر را بررسی کنید و دوباره تلاش کنید."); }
  }
  async function revoke() {
    if (pending.current || !grant) return;
    const controller = new AbortController(); pending.current = controller;
    setBusy("revoke"); setError("");
    try {
      try {
        await api("/api/mcp/access", value => object(value), { method: "DELETE", csrf, body: { id: grant.id }, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) });
      } catch (cause) { if (!(cause instanceof ClientError && cause.code === "MCP_ACCESS_NOT_FOUND")) throw cause; }
      if (controller.signal.aborted) return;
      setGrant(null); setDownloaded(false); setGuideOpen(false); setConfirmRevoke(false);
      setNotice("دسترسی لغو شد. فایل قبلی دیگر قابل استفاده نیست؛ می‌توانید دسترسی تازه‌ای بسازید.");
      requestAnimationFrame(() => issueButton.current?.focus());
    } catch (cause) {
      if (controller.signal.aborted) return;
      if (cause instanceof ClientError && cause.code === "AUTH_REQUIRED") { onSessionExpired(); return; }
      setError("لغو دسترسی تأیید نشد. فایل قبلی را فعلاً استفاده نکنید و لغو را دوباره بررسی کنید.");
    } finally { if (pending.current === controller) { pending.current = null; setBusy(null); } }
  }

  return <dialog ref={dialog} className={`folder-dialog ${styles.dialog}`} aria-labelledby="mcp-connect-title" aria-describedby="mcp-connect-help" onFocusCapture={revealFocus}
    onCancel={event => { event.preventDefault(); event.stopPropagation(); if (confirmRevoke && !busy) cancelConfirmation(); else dismiss(); }}>
    <header className={styles.header}>
      <div><p className={styles.eyebrow}><WorkspaceGlyph name="branch" />از ابزار خودتان ادامه دهید</p><h2 id="mcp-connect-title">اتصال MCP</h2></div>
      <button type="button" className={`button-quiet ${styles.close}`} aria-label="بستن اتصال MCP" disabled={Boolean(busy)} onClick={dismiss}><WorkspaceGlyph name="close" /></button>
    </header>
    <div className={styles.body}>
      <p id="mcp-connect-help" className={styles.intro}>پروژه و پیشرفت کارتان را از ابزار کدنویسی دنبال کنید. تصمیم‌های مهم همچنان در Launchlane تأیید می‌شوند.</p>
      <div className={styles.connection} aria-hidden="true"><span><WorkspaceGlyph name="cloud" /><b>Launchlane</b></span><span className={styles.cable}><i /><i /><i /></span><span><WorkspaceGlyph name="code" /><b dir="ltr">{selected.name}</b></span></div>
      <ol className={styles.steps} aria-label="مراحل آماده‌سازی اتصال">{["انتخاب دسترسی", "دریافت فایل", "تنظیم ابزار"].map((label, index) => {
        const active = !usable ? 0 : downloaded ? 2 : 1;
        return <li key={label} aria-current={active === index ? "step" : undefined} data-done={index < active}><span>{index < active ? <WorkspaceGlyph name="check" /> : index + 1}</span>{label}</li>;
      })}</ol>
      <fieldset className={styles.clients} disabled={Boolean(busy)}><legend>با کدام ابزار کار می‌کنید؟</legend><div className={styles.clientOptions}>{mcpClients.map(row => <label key={row.id} className={styles.client}>
        <input type="radio" name="mcp-client" aria-label={row.name} value={row.id} checked={client === row.id} onChange={() => setClient(row.id)} /><span><b dir="ltr">{row.name}</b><small>{row.format}</small></span><WorkspaceGlyph name="check" />
      </label>)}</div></fieldset>
      <fieldset className={styles.permissions} disabled={Boolean(busy) || usable || !origin}><legend>چه دسترسی‌ای داشته باشد؟</legend>
        <div className={styles.readScope}><WorkspaceGlyph name="eye" /><span><strong>خواندن پروژه و وضعیت کار</strong><small>اطلاعات همین حساب؛ بدون شروع مأموریت</small></span><span className={styles.badge}>پایه</span></div>
        <label className={styles.missionScope}><input type="checkbox" checked={missions} onChange={event => setMissions(event.target.checked)} aria-describedby="mcp-missions-help" /><span><strong>شروع، ادامه و توقف مأموریت</strong><small id="mcp-missions-help">اختیاری؛ شروع مأموریت می‌تواند از بودجهٔ موجود استفاده کند. تأیید تغییرات حساس در Launchlane می‌ماند.</small></span></label>
        {usable ? <p className={styles.hint}>محدودهٔ فایل صادرشده ثابت است؛ برای تغییر آن، همین دسترسی را لغو کنید.</p> : null}
      </fieldset>
      {origin === "" ? <p className={styles.warning}><WorkspaceGlyph name="shield" />اتصال به HTTPS معتبر یا نصب محلی نیاز دارد. این نشانی برای ساخت دسترسی پشتیبانی نمی‌شود.</p> : null}
      {notice ? <p className={styles.notice} role="status"><WorkspaceGlyph name="check" />{notice}</p> : null}
      {error ? <p ref={errorBox} tabIndex={-1} className={styles.error} role="alert">{error}</p> : null}
      {grant ? <section className={styles.receipt} aria-label="فایل دسترسی صادرشده" data-expired={expired}>
        <div className={styles.receiptHeading}><WorkspaceGlyph name={expired ? "stop" : "shield"} /><strong role="status">{expired ? "این دسترسی منقضی شده است" : "فایل دسترسی آماده است"}</strong><span className={styles.badge}>{grant.missions ? "مأموریت و خواندن" : "فقط خواندن"}</span></div>
        <p>{expired ? "فایل قبلی را استفاده نکنید. دسترسی تازه بسازید و مسیر فایل را در تنظیم ابزار تغییر دهید." : <>حداکثر تا ساعت <time dateTime={new Date(grant.expiresAt).toISOString()}>{new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" }).format(grant.expiresAt)}</time> و تا پایان همین نشست معتبر است. خروج از حساب، این فایل را هم بی‌اعتبار می‌کند.</>}</p>
        {!expired ? <div className={styles.downloadActions}><button ref={downloadButton} type="button" disabled={Boolean(busy)} onClick={download}><WorkspaceGlyph name="down" />{downloaded ? "دانلود دوبارهٔ همان فایل" : "دانلود فایل دسترسی MCP"}</button><button type="button" className="button-secondary" onClick={() => setGuideOpen(value => !value)} aria-expanded={guideOpen} aria-controls="mcp-install-guide">{guideOpen ? "بستن راهنمای تنظیم" : "راهنمای تنظیم ابزار"}</button></div> : null}
        {downloaded && !expired ? <p className={styles.hint} role="status">دانلود آغاز شد؛ فایل را در پوشهٔ Downloads ذخیره کنید. فایل محرمانه است؛ آن را در چت، Git یا پروژهٔ قابل انتشار نگذارید.</p> : null}
      </section> : null}
      {!grant || expired ? <div className={styles.issue}><p className={styles.hint}>روی رایانهٔ ابزار، Node24 و نسخهٔ نصب‌شدهٔ Launchlane لازم است. ساخت فایل، مدل یا انتشار را شروع نمی‌کند.</p><button ref={issueButton} type="button" disabled={Boolean(busy) || !origin} onClick={() => void issue()}><WorkspaceGlyph name={busy === "issue" ? "loader" : "branch"} />{busy === "issue" ? "در حال صدور دسترسی…" : expired ? "ساخت دسترسی تازه" : "ساخت دسترسی همین حساب"}</button></div> : null}
      {grant && guide && !expired ? <section id="mcp-install-guide" className={styles.guide} hidden={!guideOpen} aria-labelledby="mcp-guide-title">
        <div className={styles.guideHeading}><h3 id="mcp-guide-title">ادامهٔ اتصال به <bdi>{selected.name}</bdi></h3><span className={styles.badge}>تنظیم در رایانهٔ شما</span></div>
        <ol className={styles.instructions}>
          <li><h4>راه‌اندازی را اجرا کنید</h4><p>ترمینال را در پوشهٔ نصب Launchlane باز کنید؛ این پوشه با پروژه‌ای که می‌خواهید منتشر کنید فرق دارد.</p><fieldset className={styles.shells}><legend>ترمینال شما</legend><div>{([{ value: "powershell", label: "Windows · PowerShell" }, { value: "posix", label: "macOS / Linux" }] as const).map(row => <label key={row.value}><input type="radio" name="mcp-shell" checked={shell === row.value} onChange={() => setShell(row.value)} /><span dir="ltr">{row.label}</span></label>)}</div></fieldset>
            <CopyText key={guide.command} text={guide.command} label="فرمان راه‌اندازی" /><p className={styles.hint}>اگر نام یا پوشهٔ دانلود عوض شده، مقدار بعد از <code dir="ltr">--from-file</code> را اصلاح کنید. فرمان، دسترسی را بررسی می‌کند و فایل تازه می‌سازد؛ فایل موجود را بازنویسی نمی‌کند.</p>
          </li>
          <li><h4>تنظیم مخصوص ابزار را اضافه کنید</h4><p>پس از موفقیت فرمان، ورودی Launchlane را از این فایل به تنظیم موجود ابزار اضافه کنید:</p><CopyText key={guide.snippet} text={guide.snippet} label="مسیر فایل تنظیم تولیدشده" /><p className={styles.hint}>مقصد در <bdi>{selected.name}</bdi>: <code dir="ltr">{selected.destination}</code>. فقط ورودی Launchlane را ادغام کنید؛ فایل تنظیمات قبلی را جایگزین نکنید.</p><a href={selected.docs} target="_blank" rel="noreferrer">راهنمای رسمی <bdi>{selected.name}</bdi><WorkspaceGlyph name="arrow" /></a></li>
          <li><h4>پاسخ ابزار را بررسی کنید</h4><p>ابزار را دوباره باز کنید یا اتصال MCP را بازخوانی کنید، سپس این درخواست را بدهید:</p><CopyText text={mcpCheckPrompt} label="درخواست بررسی اتصال" /><p className={styles.hint}>پاسخ باید پروژه و دسترسی همین حساب را نشان بدهد. ساخت یا دانلود فایل، به‌تنهایی اتصال ابزار را تأیید نمی‌کند.</p></li>
        </ol>
      </section> : null}
      <details className={styles.help}><summary>اگر اتصال برقرار نشد</summary><ul><li>Launchlane و نشست همین مرورگر باید باز و معتبر بمانند.</li><li>فایل منقضی شده؟ دسترسی تازه بسازید و مسیر فایل جدید را در تنظیم ابزار بگذارید.</li><li>ابزار پروژه‌ای نمی‌بیند؟ اول پروژه را در Launchlane انتخاب کنید.</li><li>خطای خواندن فایل؟ مسیر دانلود، Node24 و پوشهٔ اجرای فرمان را بررسی کنید.</li></ul></details>
      {grant ? <footer className={styles.footer}>{confirmRevoke ? <section className={styles.confirm} aria-labelledby="mcp-revoke-title"><h3 id="mcp-revoke-title">دسترسی همین فایل لغو شود؟</h3><p>ابزارهایی که از این فایل استفاده می‌کنند دیگر به حساب دسترسی ندارند. پروژه و پیشرفت ذخیره‌شده حذف نمی‌شوند.</p><div><button ref={cancelRevoke} type="button" className="button-secondary" disabled={Boolean(busy)} onClick={cancelConfirmation}>انصراف از لغو</button><button type="button" className="button-danger" disabled={Boolean(busy)} onClick={() => void revoke()}>{busy === "revoke" ? "در حال لغو…" : "بله، لغو دسترسی"}</button></div></section> : <><span>این فایل فقط برای همین حساب صادر شده است.</span><button ref={revokeButton} type="button" className={`button-quiet ${styles.revoke}`} disabled={Boolean(busy)} onClick={() => setConfirmRevoke(true)}><WorkspaceGlyph name="trash" />لغو همین دسترسی MCP</button></>}</footer> : null}
    </div>
  </dialog>;
}
