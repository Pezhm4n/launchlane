"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export function FloatingAssistant({ children, blocked, projectName }: {
  children: ReactNode; blocked: boolean; projectName: string | null;
}) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDialogElement>(null), launcher = useRef<HTMLButtonElement>(null), close = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    const node = panel.current;
    if (!node) return;
    if (!open || blocked) {
      node.close();
      if (blocked && open) setOpen(false);
      if (!open && !blocked && wasOpen.current) launcher.current?.focus();
      wasOpen.current = open;
      return;
    }
    wasOpen.current = true;
    const media = window.matchMedia("(max-width: 767px)");
    function show() {
      if (!node) return;
      if (node.open) node.close();
      if (media.matches) node.showModal(); else node.show();
      close.current?.focus();
    }
    show();
    media.addEventListener("change", show);
    return () => media.removeEventListener("change", show);
  }, [open, blocked]);
  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () => {
      panel.current?.style.setProperty("--assistant-viewport", `${viewport?.height ?? window.innerHeight}px`);
      panel.current?.style.setProperty("--assistant-offset", `${viewport?.offsetTop ?? 0}px`);
    };
    resize();
    viewport?.addEventListener("resize", resize);
    viewport?.addEventListener("scroll", resize);
    return () => { viewport?.removeEventListener("resize", resize); viewport?.removeEventListener("scroll", resize); };
  }, []);
  function dismiss() {
    setOpen(false);
  }
  return <>
    <button ref={launcher} type="button" className="assistant-launcher" hidden={blocked || open}
      aria-label="باز کردن راهنمای پروژه" aria-controls="optional-assistant" aria-expanded={open}
      onClick={() => setOpen(true)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 4h14v12H11l-5 4v-4H5z" /><path d="M10 8.5a2 2 0 0 1 4 .5c0 1.5-2 1.5-2 3M12 14h.01" /></svg><span className="sr-only">راهنمای پروژه</span></button>
    <dialog ref={panel} id="optional-assistant" className="assistant-float" aria-labelledby="assistant-float-title"
      onCancel={event => { event.preventDefault(); dismiss(); }}
      onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); dismiss(); } }}>
      <div className="assistant-float-heading">
        <div><h2 id="assistant-float-title">راهنمای پروژه</h2><p className="hint">{projectName ?? "پروژه انتخاب نشده"}</p></div>
        <button ref={close} type="button" className="button-quiet" aria-label="بستن راهنمای پروژه" onClick={dismiss}>بستن</button>
      </div>
      <div className="assistant-float-content">{children}</div>
    </dialog>
  </>;
}
