import { useEffect, useState } from "react";
import { LaunchArtwork } from "./LaunchArtwork.tsx";
import { WorkspaceGlyph } from "./WorkspaceGlyph.tsx";

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
