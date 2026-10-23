"use client";
import { useEffect, useRef, useState } from "react";
import { parseFolders, type FolderListing } from "../contracts/folders.ts";
import { api, ClientError } from "./api.ts";
import { planFolderUpload } from "../contracts/folder-upload.ts";
import { WorkspaceGlyph } from "./WorkspaceGlyph.tsx";

export function FolderPicker({
  csrf,
  initial,
  onSelect,
  onCancel,
  onUpload,
}: {
  csrf: string;
  initial: string;
  onSelect: (directory: string) => void;
  onCancel: () => void;
  onUpload: (form: FormData, signal: AbortSignal) => Promise<boolean>;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    heading = useRef<HTMLHeadingElement>(null);
  const pending = useRef<AbortController | null>(null);
  const listingRequest = useRef<AbortController | null>(null);
  const deviceInput = useRef<HTMLInputElement>(null), preview = useRef<HTMLHeadingElement>(null);
  const [chosen, setChosen] = useState<{ plan: ReturnType<typeof planFolderUpload>; files: File[] } | null>(null);
  const [uploading, setUploading] = useState(false), [browsing, setBrowsing] = useState(false);
  const [listing, setListing] = useState<FolderListing | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState({ directory: initial || ".", offset: 0 });
  useEffect(() => {
    const current = dialog.current;
    current?.showModal();
    return () => { pending.current?.abort(); listingRequest.current?.abort(); current?.close(); };
  }, []);
  useEffect(() => {
    if (!browsing || uploading) { setBusy(false); return; }
    const controller = new AbortController();
    listingRequest.current = controller;
    setBusy(true);
    setError(null);
    api("/api/projects/folders", parseFolders, { body: location, csrf, signal: controller.signal })
      .then((next) => {
        if (controller.signal.aborted) return;
        setListing(next);
        heading.current?.focus();
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setError(
            error instanceof ClientError
              ? error.message
              : "فهرست پوشه‌ها دریافت نشد. دوباره تلاش کنید.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => {
      controller.abort();
      if (listingRequest.current === controller) listingRequest.current = null;
    };
  }, [csrf, location, browsing, uploading]);
  function dismiss() { pending.current?.abort(); listingRequest.current?.abort(); onCancel(); }
  async function upload() {
    if (!chosen || uploading) return;
    const controller = new AbortController(); pending.current = controller;
    const form = new FormData();
    form.set("manifest", JSON.stringify({ name: chosen.plan.name, paths: chosen.plan.files.map(file => file.path) }));
    for (const [index, file] of chosen.plan.files.entries()) {
      const selected = chosen.files[file.index];
      if (selected) form.set(`file-${index}`, selected, selected.name);
    }
    setUploading(true); setError(null);
    try { await onUpload(form, controller.signal); }
    catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "ورود پوشه کامل نشد؛ دوباره انتخاب کنید.");
    } finally { if (pending.current === controller) pending.current = null; setUploading(false); }
  }
  return (
    <dialog
      ref={dialog}
      className="folder-dialog"
      aria-labelledby="folder-picker-title"
      aria-describedby="folder-picker-help"
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
    >
      <div className="section-heading">
        <h2 id="folder-picker-title">انتخاب پوشه پروژه</h2>
        <button type="button" className="button-quiet" onClick={dismiss}>
          <WorkspaceGlyph name="close" /> انصراف
        </button>
      </div>
      <p id="folder-picker-help">
        پوشهٔ خود برنامه را از رایانه انتخاب کنید. یک کپی برای بررسی وارد میز کار می‌شود؛ فایل اصلی شما تغییر نمی‌کند.
      </p>
      <section className="device-folder-choice" aria-labelledby="device-folder-title">
        <span className="device-folder-mark" aria-hidden="true"><FolderIcon /></span>
        <h3 id="device-folder-title">پروژه‌تان کجاست؟</h3>
        <p>پنجرهٔ انتخاب پوشهٔ رایانه را باز کنید و پوشهٔ برنامه را انتخاب کنید.</p>
        <input ref={deviceInput} type="file" multiple hidden {...{ webkitdirectory: "" }} aria-label="فایل‌های پوشه پروژه"
          onChange={event => {
            const files = Array.from(event.currentTarget.files || []);
            if (!files.length) return;
            try {
              const plan = planFolderUpload(files.map(file => ({ path: file.webkitRelativePath, size: file.size })));
              setChosen({ plan, files }); setError(null);
              requestAnimationFrame(() => preview.current?.focus());
            } catch (cause) { setError(cause instanceof Error ? cause.message : "این پوشه قابل بررسی نیست."); }
            event.currentTarget.value = "";
          }} />
        <button type="button" disabled={uploading} onClick={() => deviceInput.current?.click()}><FolderIcon />{chosen ? "انتخاب پوشه‌ای دیگر از رایانه" : "انتخاب پوشه از رایانه"}</button>
        <p className="hint">فایل‌های خصوصی مانند <bdi>.env</bdi> و پوشه‌های وابستگی وارد نمی‌شوند. فعلاً چیزی به لیارا ارسال نمی‌شود.</p>
      </section>
      {chosen ? <section className="folder-import-preview" aria-labelledby="folder-import-title">
        <div className="section-heading"><h3 id="folder-import-title" ref={preview} tabIndex={-1}><FolderIcon /><bdi>{chosen.plan.name}</bdi></h3><span className="badge badge-quiet">آمادهٔ بررسی محلی</span></div>
        <p>{new Intl.NumberFormat("fa-IR").format(chosen.plan.files.length)} فایل قابل بررسی · {new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(chosen.plan.bytes / 1024)} کیلوبایت</p>
        {chosen.plan.excluded ? <p className="hint">{new Intl.NumberFormat("fa-IR").format(chosen.plan.excluded)} فایل خصوصی یا اضافی کنار گذاشته شد.</p> : null}
        <button type="button" disabled={uploading} onClick={() => void upload()}><WorkspaceGlyph name={uploading ? "search" : "arrow"} />{uploading ? "در حال ورود و بررسی فایل‌ها…" : "بررسی این پروژه"}</button>
      </section> : null}
      {error ? <div role="alert" className="note note-danger"><p>{error}</p></div> : null}
      <details className="server-folder-choice" open={browsing} onToggle={event => setBrowsing(event.currentTarget.open)}>
        <summary><FolderIcon />انتخاب از پوشه‌های مجاز این نصب</summary>
        <p className="hint">این فهرست فقط پوشهٔ مجاز نصب را نشان می‌دهد. برای انتخاب از جای دیگری، دکمهٔ «انتخاب پوشه از رایانه» را بزنید.</p>
      <div aria-busy={busy || uploading}>
        <h3 ref={heading} tabIndex={-1}>
          {listing ? <bdi>{listing.name}</bdi> : "پوشه‌های پروژه"}
        </h3>
        {busy ? <p role="status">در حال خواندن پوشه‌ها…</p> : null}
        {listing ? (
          <>
            <div className="button-row">
              {listing.parent ? (
                <button
                  type="button"
                  className="button-secondary"
                  disabled={busy || uploading}
                  onClick={() => setLocation({ directory: listing.parent || ".", offset: 0 })}
                >
                  پوشه بالاتر
                </button>
              ) : null}
              <button type="button" disabled={busy || uploading} onClick={() => onSelect(listing.directory)}>
                انتخاب همین پوشه
              </button>
            </div>
            <p className="hint">
              {listing.hasPackage
                ? "فایل package.json در این پوشه وجود دارد؛ محتوای پروژه پس از انتخاب بررسی می‌شود."
                : "اگر پروژه داخل یکی از زیرپوشه‌هاست، ابتدا آن را باز کنید."}
            </p>
            {!listing.folders.length && !busy ? (
              <p className="empty-message">
                زیرپوشه قابل انتخابی وجود ندارد. می‌توانید همین پوشه را بررسی یا پوشه دیگری انتخاب
                کنید.
              </p>
            ) : null}
            <ul className="folder-list">
              {listing.folders.map((folder) => (
                <li key={folder.directory}>
                  <button
                    className="button-secondary"
                    type="button"
                    disabled={busy || uploading}
                    onClick={() => setLocation({ directory: folder.directory, offset: 0 })}
                  >
                    <FolderIcon />
                    <bdi>{folder.name}</bdi>
                    <span className="hint">
                      {folder.hasPackage ? "دارای فایل پروژه" : "باز کردن پوشه"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {listing.nextOffset !== null || location.offset > 0 ? (
              <div className="button-row">
                <button
                  type="button"
                  className="button-secondary"
                  disabled={busy || uploading || location.offset === 0}
                  onClick={() =>
                    setLocation({
                      directory: listing.directory,
                      offset: Math.max(0, location.offset - 50),
                    })
                  }
                >
                  پوشه‌های قبلی
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  disabled={busy || uploading || listing.nextOffset === null}
                  onClick={() =>
                    setLocation({ directory: listing.directory, offset: listing.nextOffset || 0 })
                  }
                >
                  پوشه‌های بیشتر
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
      </details>
    </dialog>
  );
}
export function FolderIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="control-icon"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
      <path d="M3 9h18" />
    </svg>
  );
}
