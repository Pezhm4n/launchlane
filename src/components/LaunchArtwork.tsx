"use client";

import { useCallback, useEffect, useRef, useState, type AnimationEvent, type PointerEvent } from "react";
import styles from "./LaunchArtwork.module.css";

/** An interactive illustration only: never starts a publication or an agent run. */
export function LaunchArtwork() {
  const root = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);
  const [sequence, setSequence] = useState(0);
  const [playing, setPlaying] = useState(false);

  const resetPointer = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    root.current?.style.setProperty("--art-x", "0");
    root.current?.style.setProperty("--art-y", "0");
  }, []);

  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => {
      resetPointer();
      if (preference.matches) setPlaying(false);
    };
    preference.addEventListener("change", change);
    window.addEventListener("blur", resetPointer);
    return () => {
      preference.removeEventListener("change", change);
      window.removeEventListener("blur", resetPointer);
      resetPointer();
    };
  }, [resetPointer]);

  function followPointer(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "touch" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const { clientX, clientY } = event;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      if (!root.current) return;
      const box = root.current.getBoundingClientRect();
      const x = Math.max(-1, Math.min(1, (clientX - box.left) / box.width * 2 - 1));
      const y = Math.max(-1, Math.min(1, (clientY - box.top) / box.height * 2 - 1));
      root.current.style.setProperty("--art-x", x.toFixed(3));
      root.current.style.setProperty("--art-y", y.toFixed(3));
    });
  }

  function replay() {
    setSequence(value => value + 1);
    setPlaying(!matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function finish(event: AnimationEvent<HTMLDivElement>) {
    if (event.target instanceof Element && event.target.getAttribute("data-art-flight") === "lead") setPlaying(false);
  }

  return <div ref={root} className={`studio-launch-art ${styles.artwork}`} data-playing={playing} data-activated={sequence > 0} onAnimationEnd={finish}>
    <button type="button" className={`button-quiet ${styles.trigger}`} aria-label="نمایش تعاملی مسیر پروژه تا لیارا"
      onPointerMove={followPointer} onPointerLeave={resetPointer} onPointerCancel={resetPointer} onBlur={resetPointer} onClick={replay}>
      <span className={styles.stage}>
        <svg viewBox="0 0 440 276" fill="none" className="studio-artboard" aria-hidden="true" focusable="false">
          <g key={sequence} className={playing ? styles.sequence : undefined}>
            <path className={`studio-orbit ${styles.orbit}`} d="M38 178C-5 75 138-6 286 30c132 32 179 146 93 204-80 54-277 18-341-56Z" />
            <ellipse cx="337" cy="112" rx="79" ry="45" className={styles.halo} />
            <path className="studio-wire" d="M124 166h57c24 0 24-57 48-57h75" pathLength="1" />
            <path className="studio-wire studio-wire-secondary" d="M124 190h88c24 0 24-56 48-56h44" pathLength="1" />
            <path d="m37 185 168-97 190 110M63 201l168-97m-137 115 167-97m-135 116 168-97m-135 116 167-97m-232 7 132 76m-101-94 133 76m-101-94 133 77" className="studio-art-grid" />
            <g className={`studio-source-float ${styles.sourceZone}`}>
              <g className="studio-source-tile">
                <path d="m35 172 81-47 106 61-81 47-106-61Z" className={`studio-art-surface ${styles.bottomLayer}`} />
                <path d="m35 153 81-47 106 61-81 47-106-61Z" className={`studio-art-surface ${styles.middleLayer}`} />
                <g className={styles.sourceLid}>
                  <path d="m35 134 81-47 106 61v8l-81 47-106-61v-8Z" className="studio-art-surface" />
                  <path d="m35 134 81-47 106 61-81 47-106-61Z" className="studio-source-surface" />
                  <g transform="matrix(.866 .5 -.866 .5 116 110)">
                    <path d="m10 4-10 10 10 10m32-20 10 10-10 10M29 0l-6 29" className={`studio-code-lines ${styles.code}`} />
                    <path d="M0 43h48m-48 8h30" className="studio-art-line" />
                  </g>
                </g>
              </g>
              <text x="122" y="254" textAnchor="middle" className="studio-art-caption">پروژهٔ شما</text>
            </g>
            <g className={`studio-cloud-float ${styles.cloudZone}`}>
              <g className="studio-cloud-tile">
                <path d="m267 91 69-40 70 40v44l-70 40-69-40V91Z" className="studio-cloud-side" />
                <path d="m267 91 69 40 70-40M336 131v44m-59-57 48 28m-48-14 48 28" className="studio-art-line" />
                <path d="m267 91 69-40 70 40-70 40-69-40Z" className="studio-art-surface studio-cloud-surface" />
                <g transform="matrix(.866 .5 -.866 .5 337 67)">
                  <path d="M-15 28a12 12 0 1 1 2-24 16 16 0 0 1 31 1 12 12 0 0 1 0 23h-6M1 39V15m-8 8 8-8 8 8" className={`studio-cloud-lines ${styles.cloudIcon}`} />
                </g>
              </g>
              <text x="338" y="195" textAnchor="middle" className="studio-art-caption studio-cloud-caption">روی لیارا</text>
            </g>
            <g className={`studio-approval-tile ${styles.approval}`}>
              <rect x="211" y="201" width="98" height="46" rx="12" className="studio-art-surface" />
              <path d="m227 224 5 5 9-11" pathLength="1" className={`studio-code-lines ${styles.check}`} />
              <path d="M253 224h36" className="studio-code-lines" />
            </g>
            <circle cx="217" cy="76" r="6" className="studio-art-dot" />
            <path d="m376 212 4-9 4 9 9 4-9 4-4 9-4-9-9-4 9-4Z" className={`studio-art-star ${styles.spark}`} />
            <circle r="5" className={`${styles.packet} ${styles.packetLead}`} data-art-flight="lead" />
            <circle r="3" className={`${styles.packet} ${styles.packetTrail}`} />
          </g>
        </svg>
      </span>
      <span className={styles.hint} aria-hidden="true"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false"><path d="M15.5 6a6 6 0 1 0 .3 7M16 2v5h-5" /></svg>برای دیدن مسیر کلیک کنید</span>
    </button>
  </div>;
}
