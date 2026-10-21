"use client";
import { useEffect, useRef, useState } from "react";
import { parseFolders, type FolderListing } from "../contracts/folders.ts";
import { api, ClientError } from "./api.ts";

export function FolderPicker({
  csrf,
  initial,
  onSelect,
  onCancel,
}: {
  csrf: string;
  initial: string;
  onSelect: (directory: string) => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    heading = useRef<HTMLHeadingElement>(null);
  const pending = useRef<AbortController | null>(null);
  const [listing, setListing] = useState<FolderListing | null>(null);
  const [busy, setBusy] = useState(true),
    [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState({ directory: initial || ".", offset: 0 });
  useEffect(() => {
    const current = dialog.current;
    current?.showModal();
    return () => current?.close();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    pending.current = controller;
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
      pending.current = null;
    };
  }, [csrf, location]);
  return (
    <dialog
      ref={dialog}
      className="folder-dialog"
      aria-labelledby="folder-picker-title"
      aria-describedby="folder-picker-help"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <div className="section-heading">
        <h2 id="folder-picker-title">انتخاب پوشه پروژه</h2>
        <button type="button" className="button-quiet" onClick={onCancel}>
          انصراف
        </button>
      </div>
      <p id="folder-picker-help">
        پوشه‌های مجاز همین رایانه را می‌بینید. فایل‌های دستگاه دیگری از طریق این انتخاب‌گر وارد نمی‌شوند.
      </p>
      <div aria-busy={busy}>
        <h3 ref={heading} tabIndex={-1}>
          {listing ? <bdi>{listing.name}</bdi> : "پوشه‌های پروژه"}
        </h3>
        {busy ? <p role="status">در حال خواندن پوشه‌ها…</p> : null}
        {error ? (
          <div role="alert" className="note note-danger">
            <p>{error}</p>
            <button
              type="button"
              className="button-secondary"
              onClick={() => setLocation({ directory: ".", offset: 0 })}
            >
              بازگشت به پوشه‌های مجاز
            </button>
          </div>
        ) : null}
        {listing ? (
          <>
            <div className="button-row">
              {listing.parent ? (
                <button
                  type="button"
                  className="button-secondary"
                  disabled={busy}
                  onClick={() => setLocation({ directory: listing.parent || ".", offset: 0 })}
                >
                  پوشه بالاتر
                </button>
              ) : null}
              <button type="button" disabled={busy} onClick={() => onSelect(listing.directory)}>
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
                    disabled={busy}
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
                  disabled={busy || location.offset === 0}
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
                  disabled={busy || listing.nextOffset === null}
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
        <details>
          <summary>پوشه پروژه‌ام در فهرست نیست</summary>
          <p>
            این نصب فقط به پوشه‌ای که هنگام راه‌اندازی مجاز شده دسترسی دارد. برای انتخاب پروژه‌ای بیرون
            از این فهرست، پوشه پروژه‌ها را در تنظیمات همین نصب تغییر دهید و برنامه را دوباره اجرا
            کنید. دسترسی کل دیسک مجاز نیست.
          </p>
        </details>
      </div>
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
