"use client";
import { useLayoutEffect, useRef, type ReactNode } from "react";

export function WorkbenchView({ active, kind, children }: {
  active: boolean; kind: "source" | "incident"; children: ReactNode;
}) {
  const view = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = view.current;
    if (!active || !node) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return;
    const style = getComputedStyle(node), duration = style.getPropertyValue("--motion-view-enter").trim();
    const travel = style.getPropertyValue("--motion-view-travel").trim();
    // Reusing the mounted view preserves form state; CSS mount animations alone do not replay reliably.
    const durationMs = Number.parseFloat(duration) * (duration.endsWith("ms") ? 1 : 1000);
    const easing = style.getPropertyValue("--ease-panel-enter").trim() || "cubic-bezier(0.16, 1, 0.3, 1)";
    const viewAnimation = node.animate([
      { opacity: 0.4, transform: `translateX(${kind === "source" ? "" : "-"}${travel})` },
      { opacity: 1, transform: "none" },
    ], { duration: durationMs, easing });
    const panels = Array.from(node.querySelectorAll<HTMLElement>(".panel"));
    const panelAnimations = panels.map(p => p.animate([
      { opacity: 0.3, transform: "translateY(0.75rem)" },
      { opacity: 1, transform: "none" },
    ], { duration: durationMs, easing }));
    const animations = [viewAnimation, ...panelAnimations];
    const stop = () => { if (reduced.matches) for (const animation of animations) animation.cancel(); };
    reduced.addEventListener("change", stop);
    return () => { for (const animation of animations) animation.cancel(); reduced.removeEventListener("change", stop); };
  }, [active, kind]);
  return <div ref={view} className="workbench-view" data-view={kind} hidden={!active}>{children}</div>;
}
