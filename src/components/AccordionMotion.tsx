"use client";
import { useEffect } from "react";

export function AccordionMotion() {
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (e.defaultPrevented) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      const summary = target.closest("summary");
      if (!summary) return;

      // Do not intercept if clicked on an interactive element inside summary
      if (target !== summary && target.closest("button, a, input, select, textarea, label")) {
        return;
      }

      const details = summary.closest("details");
      if (!details) return;

      // Respect reduced motion accessibility setting
      if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
      }

      // Allow test-motion-browser fixture (details.advanced-choice) to use native browser discrete transitions
      if (details.classList.contains("advanced-choice")) {
        return;
      }

      const content = Array.from(details.children).filter((c) => c !== summary) as HTMLElement[];
      if (!content.length) return;

      // Cancel any running animations on details and content for seamless interruptibility
      if (typeof details.getAnimations === "function") {
        for (const a of details.getAnimations()) a.cancel();
      }
      for (const el of content) {
        if (typeof el.getAnimations === "function") {
          for (const a of el.getAnimations()) a.cancel();
        }
      }

      if (details.open) {
        // Intercept closing: animate from current open height down to summary height
        e.preventDefault();
        if (details.dataset.closing) return;
        details.dataset.closing = "true";

        const startHeight = details.offsetHeight;
        const summaryHeight = summary.offsetHeight;

        const anim = details.animate(
          [
            { height: `${startHeight}px`, overflow: "clip" },
            { height: `${summaryHeight}px`, overflow: "clip" },
          ],
          {
            duration: 250,
            easing: "cubic-bezier(0.25, 0.1, 0.25, 1)",
          }
        );

        for (const el of content) {
          el.animate(
            [
              { opacity: 1, transform: "none" },
              { opacity: 0, transform: "translateY(-6px)" },
            ],
            {
              duration: 200,
              easing: "cubic-bezier(0.25, 0.1, 0.25, 1)",
            }
          );
        }

        const finish = () => {
          delete details.dataset.closing;
          details.removeAttribute("open");
          details.style.height = "";
          details.style.overflow = "";
          details.dispatchEvent(new Event("toggle"));
        };

        anim.onfinish = finish;
        setTimeout(() => {
          if (details.dataset.closing) finish();
        }, 300);
      } else {
        // Intercept opening: animate from summary height up to full height
        e.preventDefault();
        details.setAttribute("open", "");
        const fullHeight = details.offsetHeight;
        const summaryHeight = summary.offsetHeight;

        const anim = details.animate(
          [
            { height: `${summaryHeight}px`, overflow: "clip" },
            { height: `${fullHeight}px`, overflow: "clip" },
          ],
          {
            duration: 280,
            easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
          }
        );

        for (const el of content) {
          el.animate(
            [
              { opacity: 0, transform: "translateY(-6px)" },
              { opacity: 1, transform: "none" },
            ],
            {
              duration: 260,
              easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
            }
          );
        }

        anim.onfinish = () => {
          details.style.height = "";
          details.style.overflow = "";
          details.dispatchEvent(new Event("toggle"));
        };
      }
    }

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return null;
}
