import { useEffect, useState } from "react";
import { WorkspaceGlyph } from "./WorkspaceGlyph.tsx";

function LaunchArtwork() {
  return <div className="studio-launch-art" aria-hidden="true">
    <svg viewBox="0 0 440 276" fill="none" className="studio-artboard" aria-hidden="true" focusable="false">
      <path className="studio-orbit" d="M38 178C-5 75 138-6 286 30c132 32 179 146 93 204-80 54-277 18-341-56Z" />
      <path className="studio-wire" d="M124 166h57c24 0 24-57 48-57h75" pathLength="1" />
      <path className="studio-wire studio-wire-secondary" d="M124 190h88c24 0 24-56 48-56h44" pathLength="1" />
      <path d="m37 185 168-97 190 110M63 201l168-97m-137 115 167-97m-135 116 168-97m-135 116 167-97m-232 7 132 76m-101-94 133 76m-101-94 133 77" className="studio-art-grid" />
      <g className="studio-source-float"><g className="studio-source-tile">
        <path d="m35 172 81-47 106 61-81 47-106-61Z" className="studio-art-surface" />
        <path d="m35 153 81-47 106 61-81 47-106-61Z" className="studio-art-surface" />
        <path d="m35 134 81-47 106 61v8l-81 47-106-61v-8Z" className="studio-art-surface" />
        <path d="m35 134 81-47 106 61-81 47-106-61Z" className="studio-source-surface" />
        <g transform="matrix(.866 .5 -.866 .5 116 110)">
          <path d="m10 4-10 10 10 10m32-20 10 10-10 10M29 0l-6 29" className="studio-code-lines" />
          <path d="M0 43h48m-48 8h30" className="studio-art-line" />
        </g>
      </g><text x="122" y="254" textAnchor="middle" className="studio-art-caption">پروژهٔ شما</text></g>
      <g className="studio-cloud-float"><g className="studio-cloud-tile">
        <path d="m267 91 69-40 70 40v44l-70 40-69-40V91Z" className="studio-cloud-side" />
        <path d="m267 91 69 40 70-40M336 131v44m-59-57 48 28m-48-14 48 28" className="studio-art-line" />
        <path d="m267 91 69-40 70 40-70 40-69-40Z" className="studio-art-surface studio-cloud-surface" />
        <g transform="matrix(.866 .5 -.866 .5 337 67)">
          <path d="M-15 28a12 12 0 1 1 2-24 16 16 0 0 1 31 1 12 12 0 0 1 0 23h-6M1 39V15m-8 8 8-8 8 8" className="studio-cloud-lines" />
        </g>
      </g><text x="338" y="195" textAnchor="middle" className="studio-art-caption studio-cloud-caption">روی لیارا</text></g>
      <g className="studio-approval-tile">
        <rect x="211" y="201" width="98" height="46" rx="12" className="studio-art-surface" />
        <path d="m227 224 5 5 9-11m12 6h36" className="studio-code-lines" />
      </g>
      <circle cx="217" cy="76" r="6" className="studio-art-dot" /><path d="m376 212 4-9 4 9 9 4-9 4-4 9-4-9-9-4 9-4Z" className="studio-art-star" />
    </svg>
  </div>;
}

export function WorkspaceIntro({ authenticated, projectName, mode, loading }: {
  authenticated: boolean; projectName: string | null; mode: "source" | "incident"; loading?: boolean;
}) {
  const [cachedName, setCachedName] = useState<string | null>(null);
  const [cachedAuth, setCachedAuth] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = sessionStorage.getItem("launchlane_cached_project");
      if (stored) setCachedName(stored);
      if (sessionStorage.getItem("launchlane_cached_auth") === "true") {
        setCachedAuth(true);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        if (authenticated) {
          sessionStorage.setItem("launchlane_cached_auth", "true");
          setCachedAuth(true);
        } else if (!loading && !authenticated) {
          sessionStorage.removeItem("launchlane_cached_auth");
          setCachedAuth(false);
        }
      } catch {}
    }
  }, [authenticated, loading]);

  const effectiveAuth = authenticated || (loading && cachedAuth);
  const effectiveProject = projectName ?? cachedName;
  const isPending = !mounted || loading;
  const welcome = mounted && !loading && !effectiveProject && mode === "source";

  return <div className={`page-intro studio-intro ${welcome ? "studio-intro-welcome" : "studio-intro-project"}`}>
    <div key={mode} className="studio-intro-copy">
      <p className="studio-eyebrow"><WorkspaceGlyph name={mode === "source" ? "cloud" : "search"} />{effectiveAuth ? mode === "source" ? "از پروژه تا اولین بازدید" : "یک نگاه دقیق به سایت شما" : "خوش آمدید به لانچ‌لین"}</p>
      <h1 tabIndex={-1}>{effectiveProject ? <><span className="studio-project-label">پروژهٔ شما</span><bdi className="studio-project-name" dir="auto">{effectiveProject}</bdi></> : isPending ? <>در حال بازیابی اطلاعات <span>میز کار…</span></> : mode === "incident" ? <>مشکل سایت را <span>روشن‌تر ببینید.</span></> : <>پروژه‌تان را <span>به وب برسانید.</span></>}</h1>
      {!effectiveProject && !isPending ? <p className="studio-description">{mode === "incident" ? "سایت را انتخاب کنید؛ وضعیت و نشانه‌های مشکل را قدم‌به‌قدم بررسی می‌کنیم."
        : effectiveAuth ? "از انتخاب فایل‌ها شروع کنید. قدم بعد را ما روشن می‌کنیم؛ تصمیم‌های مهم با شماست."
        : "پروژه را بررسی کنید، تغییرات را ببینید و با تصمیم خودتان منتشر کنید."}</p> : null}
      {welcome ? <p className="studio-assurance"><WorkspaceGlyph name="shield" />هیچ تغییری بدون تأیید شما منتشر نمی‌شود.</p> : null}
    </div>
    {welcome ? <LaunchArtwork /> : <div className="studio-context-mark" aria-hidden="true"><WorkspaceGlyph name={mode === "source" ? "code" : "search"} /></div>}
  </div>;
}
