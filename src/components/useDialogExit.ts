"use client";
import { useCallback, useRef, type RefObject } from "react";

export function useDialogExit(dialog: RefObject<HTMLDialogElement | null>) {
  const closing = useRef(false);
  return useCallback((finish: () => void) => {
    if (closing.current) return;
    const node = dialog.current;
    if (!node?.open || matchMedia("(prefers-reduced-motion: reduce)").matches) { finish(); return; }
    closing.current = true;
    // Keep the modal and focus boundary alive until the visible exit has finished.
    node.setAttribute("data-closing", "");
    node.inert = true;
    const animations = node.getAnimations();
    void Promise.allSettled(animations.map(animation => animation.finished)).then(() => {
      closing.current = false;
      if (!node.isConnected) return;
      node.close(); node.inert = false; node.removeAttribute("data-closing"); finish();
    });
  }, [dialog]);
}
