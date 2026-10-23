"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { parseProjectLibrary, type ProjectSummary } from "../contracts/project-library.ts";
import { api, ClientError } from "./api.ts";
import { FolderIcon } from "./FolderPicker.tsx";
import { WorkspaceGlyph } from "./WorkspaceGlyph.tsx";
import { useDialogExit } from "./useDialogExit.ts";
import styles from "./ProjectLibrary.module.css";

const states: Record<ProjectSummary["state"], string> = {
  ready: "آمادهٔ بررسی انتشار", incomplete: "نیازمند آماده‌سازی", stale: "نیازمند بررسی دوباره", unavailable: "فایل‌ها در دسترس نیستند",
  queued: "در انتظار اجرا", working: "در حال بررسی", needs_input: "نیازمند اطلاعات", needs_approval: "منتظر تصمیم شما", partially_completed: "بخشی انجام شده",
  completed: "مأموریت پایان یافته", failed: "نیازمند رسیدگی", cancelled: "متوقف‌شده", interrupted: "اجرا قطع شده",
};
export function ProjectLibrary({ disabled, csrf, onRemoved, onOpen, onNew, onClose, onExpired }: {
  disabled: boolean; csrf: string; onRemoved: (active: boolean) => Promise<void>; onOpen: (id: string) => Promise<void>; onNew: () => void; onClose: () => void; onExpired: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null), exit = useDialogExit(dialog), opening = useRef(false);
  const [projects, setProjects] = useState<ProjectSummary[]>([]), [offset, setOffset] = useState(0), [nextOffset, setNextOffset] = useState<number | null>(null),
    [loading, setLoading] = useState(true), [busy, setBusy] = useState<string | null>(null), [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<ProjectSummary | null>(null);
  const confirm = useRef<HTMLDialogElement>(null), cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (removing) { confirm.current?.showModal(); cancel.current?.focus(); } else confirm.current?.close(); }, [removing]);
  const failed = useCallback((cause: unknown) => {
    if (cause instanceof ClientError && cause.code === "AUTH_REQUIRED") onExpired();
    else setError(cause instanceof ClientError ? cause.message : "پروژه‌ها دریافت نشدند؛ دوباره تلاش کنید.");
  }, [onExpired]);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError(null);
    try {
      const result = await api(`/api/projects/library?offset=${offset}`, parseProjectLibrary, signal ? { signal } : {});
      if (!signal?.aborted) { setProjects(result.projects); setNextOffset(result.nextOffset); }
    } catch (cause) { if (!signal?.aborted) failed(cause); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [offset, failed]);
  useEffect(() => { const node = dialog.current; node?.showModal(); return () => node?.close(); }, []);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  function dismiss() { if (!opening.current) exit(onClose); }
  async function open(id: string) {
    if (opening.current || disabled && !projects.some(project => project.id === id && project.active)) return;
    opening.current = true; setBusy(id); setError(null);
    try { await onOpen(id); exit(onClose); }
    catch (cause) { failed(cause); }
    finally { opening.current = false; setBusy(null); }
  }
  async function remove() {
    if (!removing || opening.current || disabled) return;
    opening.current = true; setBusy(removing.id); setError(null);
    try {
      await api("/api/projects/library", value => value, { csrf, method: "DELETE", body: { id: removing.id, sourceHash: removing.sourceHash, confirmed: true } });
      const active = removing.active;
      setRemoving(null); await onRemoved(active); await load();
      requestAnimationFrame(() => dialog.current?.querySelector<HTMLButtonElement>("button")?.focus());
    } catch (cause) { setRemoving(null); failed(cause); }
    finally { opening.current = false; setBusy(null); }
  }
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="project-library-title" aria-describedby="project-library-help" onCancel={event => { event.preventDefault(); dismiss(); }}>
    <div className="section-heading"><h2 id="project-library-title"><FolderIcon /> پروژه‌های من</h2><button className="button-quiet" type="button" disabled={!!busy} onClick={dismiss}><WorkspaceGlyph name="close" />بستن پروژه‌های من</button></div>
    <p id="project-library-help" className={styles.intro}>پروژه‌ها و نسخه‌های قبلی اینجا می‌مانند. بازکردن یک پروژه، انتشار یا مصرف مدل را شروع نمی‌کند.</p>
    {disabled ? <p className="note">انتشارها یکی‌یکی انجام می‌شوند؛ پس از پایان یا توقف اجرای فعلی می‌توانید پروژهٔ دیگری باز کنید.</p> : null}
    {loading ? <p role="status">در حال دریافت پروژه‌ها…</p> : null}
    {error ? <p className="note note-danger" role="alert">{error}</p> : null}
    {!loading && !projects.length && !error ? <div className={styles.empty}><FolderIcon /><h3>اولین پروژه‌تان را بیاورید</h3><p>پوشهٔ رایانه یا مخزن GitHub را انتخاب کنید. نتیجه و ادامهٔ کار همین‌جا در دسترس می‌ماند.</p><button type="button" disabled={disabled} onClick={() => exit(onNew)}>انتخاب پروژهٔ تازه</button></div> : null}
    <ul className={styles.list} aria-busy={loading}>
      {projects.map(project => <li className={styles.item} data-active={project.active} key={project.id}>
        <div className={styles.row}><h3 className={styles.name}><bdi>{project.name}</bdi></h3>{project.active ? <span className="badge badge-quiet">پروژهٔ باز</span> : null}</div>
        <p className={styles.meta}>{project.source} · <bdi>{project.runtime}</bdi> · <time dateTime={new Date(project.updatedAt).toISOString()}>{new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(project.updatedAt)}</time></p>
        {project.app ? <p className={styles.meta}>مقصد ثبت‌شده: <bdi>{project.app}</bdi></p> : null}
        <div className={styles.row}><span>{states[project.state]}</span><div className={styles.actions}><button type="button" className="button-secondary" disabled={!!busy || disabled && !project.active} onClick={() => void open(project.id)} aria-label={`بازکردن ${project.name}`}>{busy === project.id ? "در حال انجام…" : "بازکردن پروژه"}<WorkspaceGlyph name="arrow" /></button>
          {project.removal === "local" ? <button type="button" className="button-danger" disabled={disabled || !!busy} aria-label={`حذف ${project.name}`} onClick={() => setRemoving(project)}><WorkspaceGlyph name="trash" />حذف</button> : null}</div></div>
        {project.removal !== "local" ? <p className={styles.meta}>{project.removal === "blocked" ? "نتیجهٔ یک عملیات مقصد هنوز روشن نیست؛ برای بررسی، پروژه را باز کنید." : "برای حذف، پروژه را باز کنید و از پنل انتشار، مقصد لیارا را متوقف و حذف کنید."}</p> : null}
        {project.state === "completed" ? <p className={styles.meta}>این وضعیت مربوط به آخرین اجراست؛ سلامت فعلی سایت دوباره باید بررسی شود.</p> : null}
      </li>)}
    </ul>
    <div className={styles.footer}>
      <button type="button" className="button-secondary" disabled={loading || !!busy} onClick={() => void load()}>به‌روزرسانی فهرست</button>
      {projects.length ? <button type="button" disabled={disabled || !!busy} onClick={() => exit(onNew)}>پروژهٔ تازه</button> : null}
      {offset > 0 ? <button type="button" className="button-secondary" disabled={loading || !!busy} onClick={() => setOffset(Math.max(0, offset - 20))}>پروژه‌های جدیدتر</button> : null}
      {nextOffset !== null ? <button type="button" className="button-secondary" disabled={loading || !!busy} onClick={() => setOffset(nextOffset)}>پروژه‌های قدیمی‌تر</button> : null}
    </div>
    {removing ? <dialog ref={confirm} className={styles.dialog} aria-labelledby="project-remove-title" aria-describedby="project-remove-help" onCancel={event => { event.preventDefault(); event.stopPropagation(); if (!busy) setRemoving(null); }}>
      <h2 id="project-remove-title">پروژه از فهرست حذف شود؟</h2><p id="project-remove-help"><bdi>{removing.name}</bdi> دیگر در «پروژه‌های من» نمایش داده نمی‌شود. پوشهٔ اصلی شما دست‌نخورده می‌ماند. رسیدهای امنیتی و عملیات برای جلوگیری از تکرار نگهداری می‌شوند.</p>
      <div className={styles.footer}><button ref={cancel} type="button" className="button-secondary" disabled={!!busy} onClick={() => setRemoving(null)}>انصراف از حذف</button><button type="button" className="button-danger" disabled={!!busy || disabled} onClick={() => void remove()}>{busy ? "در حال حذف…" : "بله، از فهرست حذف کن"}</button></div>
    </dialog> : null}
  </dialog>;
}
