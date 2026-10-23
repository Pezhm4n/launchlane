"use client";
import { useEffect, useRef } from "react";
import { WorkspaceGlyph } from "./WorkspaceGlyph.tsx";

export function SignOutDialog({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) {
      node.showModal();
    } else if (!open && node.open) {
      node.close();
    }
  }, [open]);

  function handleDismiss() {
    const node = dialog.current;
    if (!node) {
      onCancel();
      return;
    }
    node.dataset.closing = "true";
    const timer = setTimeout(() => {
      delete node.dataset.closing;
      onCancel();
    }, 200);
    node.addEventListener(
      "transitionend",
      () => {
        clearTimeout(timer);
        delete node.dataset.closing;
        onCancel();
      },
      { once: true }
    );
  }

  if (!open) return null;

  return (
    <dialog
      className="confirm-dialog account-dialog"
      ref={dialog}
      aria-labelledby="signout-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        handleDismiss();
      }}
    >
      <div className="section-heading">
        <h2 id="signout-dialog-title" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <WorkspaceGlyph name="close" />
          خروج از میز کار
        </h2>
        <button
          type="button"
          className="button-quiet"
          aria-label="انصراف و بستن پیام"
          onClick={handleDismiss}
        >
          بستن
        </button>
      </div>
      <p style={{ marginBlock: "var(--space-3)", lineHeight: "1.8" }}>
        آیا از خروج از میز کار اطمینان دارید؟ پیشرفت کار، تنظیمات و پروژه‌های شما روی این رایانه
        محفوظ می‌مانند و تغییری در برنامه‌های فعال لیارا ایجاد نمی‌شود.
      </p>
      <p className="hint" style={{ marginBlockEnd: "var(--space-5)" }}>
        برای ورود مجدد، کلید دسترسی محلی همین نصب مورد نیاز خواهد بود.
      </p>
      <div className="button-row" style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
        <button
          type="button"
          className="button-secondary"
          onClick={handleDismiss}
        >
          انصراف
        </button>
        <button
          type="button"
          className="button-danger"
          onClick={() => {
            onConfirm();
          }}
        >
          بله، خارج شو
        </button>
      </div>
    </dialog>
  );
}
