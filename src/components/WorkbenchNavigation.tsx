"use client";

import { Children, useCallback, useLayoutEffect, useRef, type ReactNode } from "react";

type IndicatorBounds = { x: number; y: number; width: number; height: number };

export function WorkbenchNavigation({ activeKey, children }: {
  activeKey: string;
  children: ReactNode;
}) {
  const navigation = useRef<HTMLElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);
  const target = useRef<IndicatorBounds | null>(null);
  const animation = useRef<Animation | null>(null);
  const previousKey = useRef(activeKey);

  const position = useCallback((animate: boolean) => {
    const nav = navigation.current;
    const pill = indicator.current;
    const selected = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !pill || !selected) return;
    document.documentElement.style.setProperty("--app-nav-height", `${nav.getBoundingClientRect().height}px`);
    const header = nav.closest(".app-top");
    if (header) document.documentElement.style.setProperty("--app-header-height", `${header.getBoundingClientRect().height}px`);
    const parent = nav.getBoundingClientRect();
    const next = selected.getBoundingClientRect();
    const bounds = {
      x: next.x - parent.x - nav.clientLeft,
      y: next.y - parent.y - nav.clientTop,
      width: next.width,
      height: next.height,
    };
    const previous = target.current;
    if (previous && bounds.x === previous.x && bounds.y === previous.y &&
      bounds.width === previous.width && bounds.height === previous.height) return;
    const current = previous ? pill.getBoundingClientRect() : null;
    animation.current?.cancel();
    Object.assign(pill.style, {
      left: `${bounds.x}px`, top: `${bounds.y}px`,
      width: `${bounds.width}px`, height: `${bounds.height}px`, opacity: "1",
    });
    target.current = bounds;
    if (animate && current && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const style = getComputedStyle(nav);
      const duration = style.getPropertyValue("--motion-tab-slide").trim();
      animation.current = pill.animate([
        { transform: `translate(${current.x - next.x}px, ${current.y - next.y}px) scale(${current.width / next.width}, ${current.height / next.height})` },
        { transform: "none" },
      ], {
        duration: Number.parseFloat(duration) * (duration.endsWith("ms") ? 1 : 1000),
        easing: style.getPropertyValue("--ease-tab-slide").trim(),
      });
    }
  }, []);

  useLayoutEffect(() => {
    position(previousKey.current !== activeKey);
    previousKey.current = activeKey;
  }, [activeKey, position]);

  useLayoutEffect(() => {
    const nav = navigation.current;
    if (!nav) return;
    const observer = new ResizeObserver(() => position(false));
    observer.observe(nav);
    const header = nav.closest(".app-top");
    if (header) observer.observe(header);
    for (const link of nav.querySelectorAll(".app-nav-link")) observer.observe(link);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const cancelMotion = () => { if (reduced.matches) animation.current?.cancel(); };
    reduced.addEventListener("change", cancelMotion);
    return () => {
      observer.disconnect();
      reduced.removeEventListener("change", cancelMotion);
      animation.current?.cancel();
      document.documentElement.style.removeProperty("--app-header-height");
      document.documentElement.style.removeProperty("--app-nav-height");
    };
  }, [position]);

  return (
    <nav ref={navigation} className="workbench-switch task-switch app-nav app-nav-motion"
      aria-label="بخش‌های میز کار" style={{ gridTemplateColumns: `repeat(${Children.count(children)}, minmax(0, 1fr))` }}>
      <span ref={indicator} className="nav-active-indicator" aria-hidden="true" />
      {children}
    </nav>
  );
}
