"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { WorkspaceGlyph } from "./WorkspaceGlyph.tsx";

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
      aria-label="باز کردن دستیار هوشمند" aria-controls="optional-assistant" aria-expanded={open}
      onClick={() => setOpen(true)}><span className="assistant-launcher-mark"><WorkspaceGlyph name="spark" /></span><span className="assistant-launcher-label">دستیار هوشمند</span></button>
    <dialog ref={panel} id="optional-assistant" className="assistant-float" aria-labelledby="assistant-float-title"
      onCancel={event => { event.preventDefault(); dismiss(); }}
      onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); dismiss(); } }}>
      <div className="assistant-float-heading">
        <div className="assistant-identity"><span className="assistant-avatar" aria-hidden="true"><WorkspaceGlyph name="spark" /></span><div><h2 id="assistant-float-title">دستیار هوشمند</h2><p className="hint">{projectName ?? "راهنمای انتخاب و انتشار پروژه"}</p></div></div>
        <button ref={close} type="button" className="button-quiet assistant-close" aria-label="بستن دستیار هوشمند" onClick={dismiss}><WorkspaceGlyph name="close" /></button>
      </div>
      <div className="assistant-float-content">{children}</div>
    </dialog>
  </>;
}
