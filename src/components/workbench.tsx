"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type {
  Action,
  ActionState,
  Capability,
  ProjectProfile,
  SourceArtifact,
  WorkspaceView,
} from "../contracts/domain.ts";
import {
  decodeAction,
  decodeArtifact,
  decodeProfile,
  decodeWorkspace,
} from "../contracts/client-decode.ts";
import { object } from "../contracts/validation.ts";
import { api, ClientError } from "./api.ts";
import { IncidentWorkbench } from "./IncidentWorkbench.tsx";

const stateNames: Record<ActionState, string> = {
  awaiting_approval: "منتظر تصمیم شما",
  approved: "تأیید ثبت شد؛ اجرا نشده",
  cancelled: "رد شد؛ اجرا نشد",
  expired: "مهلت تأیید گذشته",
  executing: "در حال اجرا",
  observing: "در حال بررسی نتیجه",
  uncertain: "نتیجه اجرا نامعلوم",
  succeeded: "نتیجه تأیید شد",
  failed: "بررسی ناموفق بود",
};
const number = (value: number) => new Intl.NumberFormat("fa-IR").format(value);
const time = (value: number) =>
  new Intl.DateTimeFormat("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tehran",
  }).format(value);

function AccessRow({ title, item }: { title: string; item: Capability }) {
  return (
    <li className="access-row">
      <div>
        <strong>{title}</strong>
        <span className={`badge ${item.state === "available" ? "badge-ok" : "badge-quiet"}`}>
          {item.state === "available"
            ? "فعال محلی"
            : item.state === "unverified"
              ? "تأیید نشده"
              : "در انتظار"}
        </span>
      </div>
      <p>{item.reason}</p>
      <p className="hint">{item.nextStep}</p>
    </li>
  );
}

function ActionCard({
  action,
  disabled,
  onDecision,
}: {
  action: Action;
  disabled: boolean;
  onDecision: (action: Action, decision: "approve" | "reject") => void;
}) {
  return (
    <article className="action-card" aria-labelledby={`action-${action.id}`}>
      <div className="section-heading">
        <h3 id={`action-${action.id}`}>
          انتشار روی <bdi>{action.spec.scope.app}</bdi>
        </h3>
        <span
          className={`badge ${action.state === "uncertain" || action.state === "failed" ? "badge-warning" : "badge-quiet"}`}
        >
          {stateNames[action.state]}
        </span>
      </div>
      <dl className="action-facts">
        <div>
          <dt>مقصد</dt>
          <dd>
            <bdi>{action.spec.scope.app}</bdi>
          </dd>
        </div>
        <div>
          <dt>پورت</dt>
          <dd>
            <bdi>{action.spec.args.port}</bdi>
          </dd>
        </div>
        <div>
          <dt>پلن و هزینه</dt>
          <dd>هنوز تأیید نشده</dd>
        </div>
        <div>
          <dt>مهلت تأیید</dt>
          <dd>{time(action.expiresAt)} تهران</dd>
        </div>
      </dl>
      <details className="technical-details">
        <summary>شناسه تیم و اثر انگشت تأیید</summary>
        <dl>
          <dt>تیم</dt>
          <dd>
            <code>{action.spec.scope.teamId}</code>
          </dd>
          <dt>source SHA-256</dt>
          <dd>
            <code>{action.spec.sourceHash}</code>
          </dd>
          <dt>action SHA-256</dt>
          <dd>
            <code>{action.hash}</code>
          </dd>
          {action.spec.version === 2 && action.spec.artifactHash ? (
            <>
              <dt>archive SHA-256</dt>
              <dd>
                <code>{action.spec.artifactHash}</code>
              </dd>
            </>
          ) : null}
        </dl>
      </details>
      <p>
        این پیشنهاد به همین مقصد، پورت و محتوای پروژه متصل است. تغییر هرکدام به پیشنهاد و تأیید تازه
        نیاز دارد.
      </p>
      {action.spec.version === 1 ? (
        <p className="note">
          این پیشنهاد قدیمی به بسته source متصل نیست؛ برای انتشار باید پروژه را دوباره بررسی و
          پیشنهاد تازه بسازید.
        </p>
      ) : null}
      {action.state === "awaiting_approval" ? (
        <>
          <p className="note">
            تأیید فقط تصمیم شما را ذخیره می‌کند. انتشار واقعی تا آماده‌شدن اتصال و فعال‌شدن عملیات بسته
            می‌ماند.
          </p>
          <div className="button-row">
            <button type="button" disabled={disabled} onClick={() => onDecision(action, "approve")}>
              تأیید پیشنهاد انتشار روی <bdi>{action.spec.scope.app}</bdi>
            </button>
            <button
              type="button"
              className="button-secondary"
              disabled={disabled}
              onClick={() => onDecision(action, "reject")}
            >
              رد این پیشنهاد
            </button>
          </div>
        </>
      ) : action.state === "approved" ? (
        <p className="note">
          هیچ فایلی ارسال و هیچ سرویسی تغییر داده نشده است. برای اجرای واقعی، ابتدا اتصال و بودجه
          باید تأیید شوند.
        </p>
      ) : action.state === "uncertain" ? (
        <p className="note note-danger">
          اقدام تازه برای این برنامه مسدود است. نتیجه اقدام قبلی باید از سرویس خوانده و مشخص شود.
        </p>
      ) : null}
    </article>
  );
}

export function Workbench() {
  const [workbenchMode, setWorkbenchMode] = useState<"source" | "incident">("source");
  const [view, setView] = useState<WorkspaceView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [directory, setDirectory] = useState("examples/node-service");
  const [profile, setProfile] = useState<ProjectProfile | null>(null);
  const [artifact, setArtifact] = useState<SourceArtifact | null>(null);
  const [port, setPort] = useState("");
  const [app, setApp] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState<ClientError | null>(null);
  const [clock, setClock] = useState(0);
  const pending = useRef<AbortController | null>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const artifactHeading = useRef<HTMLHeadingElement>(null);
  const inspectTrigger = useRef<HTMLButtonElement>(null);
  const archiveTrigger = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<"inspect" | "archive" | null>(null);
  const errorBox = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    api("/api/workspace", decodeWorkspace, { signal: controller.signal })
      .then((data) => {
        setView(data);
        setApp(data.capabilities.scope.apps[0] || "");
      })
      .catch((error: unknown) => {
        if (
          !controller.signal.aborted &&
          error instanceof ClientError &&
          error.code !== "AUTH_REQUIRED"
        )
          setError(error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 15_000);
    setClock(Date.now());
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (error && !loading) errorBox.current?.focus();
  }, [error, loading]);
  useEffect(() => {
    if (profile) resultHeading.current?.focus();
  }, [profile]);
  useEffect(() => {
    if (artifact) artifactHeading.current?.focus();
  }, [artifact]);
  useEffect(() => {
    if (busy === null && returnFocus.current) {
      const target = returnFocus.current === "inspect" ? inspectTrigger : archiveTrigger;
      returnFocus.current = null;
      target.current?.focus();
    }
  }, [busy]);

  function fail(error: unknown) {
    if (error instanceof ClientError && error.code === "AUTH_REQUIRED") setView(null);
    setError(
      error instanceof ClientError
        ? error
        : new ClientError(
            "CONNECTION_FAILED",
            "پاسخ برنامه دریافت نشد؛ اتصال محلی را بررسی و دوباره تلاش کنید.",
          ),
    );
  }
  async function refresh() {
    const next = await api("/api/workspace", decodeWorkspace);
    setView(next);
    return next;
  }
  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy("login");
    setError(null);
    const submitted = token;
    setToken("");
    try {
      await api("/api/session", () => true, { body: { token: submitted } });
      const data = await refresh();
      setApp(data.capabilities.scope.apps[0] || "");
      setNotice("وارد شدید. بررسی محلی پروژه آماده است.");
    } catch (error) {
      fail(error);
    } finally {
      setBusy(null);
    }
  }
  async function signOut() {
    if (!view || busy) return;
    setBusy("logout");
    setError(null);
    try {
      await api("/api/session", () => true, {
        method: "DELETE",
        csrf: view.session.csrfToken,
      });
      setView(null);
      setProfile(null);
      setArtifact(null);
      setNotice("از حساب محلی خارج شدید.");
    } catch (error) {
      fail(error);
    } finally {
      setBusy(null);
    }
  }
  async function inspect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!view || busy) return;
    setBusy("inspect");
    setError(null);
    setProfile(null);
    setArtifact(null);
    setNotice("در حال خواندن فایل‌های مجاز؛ هیچ script اجرا نمی‌شود.");
    const controller = new AbortController();
    pending.current = controller;
    try {
      const result = await api("/api/projects/inspect", decodeProfile, {
        body: { directory },
        csrf: view.session.csrfToken,
        signal: controller.signal,
      });
      setProfile(result);
      setPort(result.port === null ? "" : String(result.port));
      setNotice("بررسی محلی کامل شد. اطلاعات پروژه و فهرست فایل‌ها را ببینید.");
    } catch (error) {
      if (controller.signal.aborted) {
        returnFocus.current = "inspect";
        setNotice("بررسی لغو شد؛ پیشنهادی ساخته و فایلی ارسال نشد.");
      } else {
        setNotice("");
        fail(error);
      }
    } finally {
      pending.current = null;
      setBusy(null);
    }
  }
  async function prepareSource() {
    if (!view || !profile || busy) return;
    setBusy("archive");
    setError(null);
    setArtifact(null);
    setNotice("در حال ساخت بسته از فایل‌های مجاز؛ هیچ فایلی ارسال نمی‌شود.");
    const controller = new AbortController();
    pending.current = controller;
    try {
      const result = await api("/api/projects/archive", decodeArtifact, {
        body: { directory: profile.directory, sourceHash: profile.sourceHash },
        csrf: view.session.csrfToken,
        signal: controller.signal,
      });
      setArtifact(result);
      setNotice("بسته source محلی آماده شد؛ هنوز به لیارا ارسال نشده است.");
    } catch (error) {
      if (controller.signal.aborted) {
        returnFocus.current = "archive";
        setNotice("آماده‌سازی متوقف شد؛ هیچ فایلی ارسال نشد. ساخت دوباره فقط محلی است.");
      } else {
        setNotice("");
        fail(error);
      }
    } finally {
      pending.current = null;
      setBusy(null);
    }
  }
  async function propose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!view || !profile || !artifact || busy) return;
    setBusy("proposal");
    setError(null);
    try {
      await api("/api/actions", (value) => decodeAction(object(value).action), {
        body: {
          directory: profile.directory,
          sourceHash: profile.sourceHash,
          artifactHash: artifact.archiveHash,
          app,
          port: Number(port),
        },
        csrf: view.session.csrfToken,
      });
      await refresh();
      setNotice("پیشنهاد ذخیره شد. مقصد، source و محدودیت‌ها را پیش از تصمیم بررسی کنید.");
    } catch (error) {
      fail(error);
    } finally {
      setBusy(null);
    }
  }
  async function decide(action: Action, decision: "approve" | "reject") {
    if (!view || busy) return;
    setBusy("decision");
    setError(null);
    try {
      await api(
        `/api/actions/${encodeURIComponent(action.id)}/decision`,
        (value) => decodeAction(object(value).action),
        { body: { hash: action.hash, decision }, csrf: view.session.csrfToken },
      );
      await refresh();
      setNotice(
        decision === "approve"
          ? "تأیید شما ثبت شد؛ عملیات واقعی هنوز غیرفعال است."
          : "پیشنهاد رد شد؛ چیزی اجرا نشد.",
      );
    } catch (error) {
      fail(error);
    } finally {
      setBusy(null);
    }
  }

  const latest = view?.actions[0];
  const step =
    latest?.state === "approved" ? 2 : latest && latest.state !== "cancelled" ? 1 : profile ? 1 : 0;
  const expired = view !== null && clock >= view.session.expiresAt;

  return (
    <>
      <header className={`app-header ${view ? "app-header-compact" : ""}`}>
        <a className="brand" href="/" aria-label="Launchlane، صفحه اصلی">
          <span className="brand-symbol" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span lang="en" dir="ltr">
            Launchlane<span className="brand-subtitle">مسیر روشن انتشار</span>
          </span>
        </a>
        <div className="header-actions">
          <span className="badge badge-quiet">محیط محلی · اتصال زنده تأیید نشده</span>
          {view ? (
            <button
              className="button-quiet"
              type="button"
              onClick={signOut}
              disabled={busy !== null}
            >
              خروج
            </button>
          ) : null}
        </div>
      </header>
      <main id="main-content" className="app-main">
        <div className={`page-intro ${view ? "page-intro-compact" : ""}`}>
          <p className="eyebrow">{view ? "میز کار محلی" : "از پروژه تا نتیجه، با شواهد"}</p>
          <h1>
            {view ? (
              workbenchMode === "incident" ? (
                <>
                  اختلال را با <span>شواهد بررسی کنید.</span>
                </>
              ) : (
                <>
                  پروژه را آماده <span>انتشار کنید.</span>
                </>
              )
            ) : (
              <>
                انتشار، قدم‌به‌قدم
                <br />
                <span>با تصمیم شما.</span>
              </>
            )}
          </h1>
          <p className="intro-text">
            {view
              ? workbenchMode === "incident"
                ? "از مشاهده خطا تا مقایسه نتیجه؛ فعلاً در یک تمرین صریح آفلاین."
                : "ابتدا پروژه را بررسی و مقصد انتشار را مشخص کنید."
              : "پروژه‌تان را بشناسید، پیشنهاد را بررسی کنید و پیش از هر تغییر تصمیم بگیرید. هر نتیجه باید شاهد داشته باشد."}
          </p>
        </div>
        {view ? (
          <nav className="workbench-switch" aria-label="ابزارهای میز کار">
            <button
              type="button"
              className="button-secondary"
              aria-pressed={workbenchMode === "source"}
              disabled={busy !== null}
              onClick={() => {
                setWorkbenchMode("source");
                setNotice("");
                setError(null);
              }}
            >
              آماده‌سازی انتشار
            </button>
            <button
              type="button"
              className="button-secondary"
              aria-pressed={workbenchMode === "incident"}
              disabled={busy !== null}
              onClick={() => {
                setWorkbenchMode("incident");
                setNotice("");
                setError(null);
              }}
            >
              بررسی اختلال
            </button>
          </nav>
        ) : null}
        {workbenchMode === "source" ? (
          <nav className="journey" aria-label="مسیر انتشار">
            <ol>
              {["شناخت پروژه", "پیشنهاد", "تأیید شما", "انتشار", "بررسی نتیجه"].map(
                (label, index) => (
                  <li
                    key={label}
                    className={index === step ? "current" : index < step ? "visited" : ""}
                    aria-current={index === step ? "step" : undefined}
                  >
                    <span className="step-number" aria-hidden="true">
                      {number(index + 1)}
                    </span>
                    <span>{label}</span>
                    {index >= 3 ? <span className="step-lock">نیازمند اتصال</span> : null}
                  </li>
                ),
              )}
            </ol>
          </nav>
        ) : null}
        <div className="live-message" role="status" aria-live="polite" aria-atomic="true">
          {loading ? "در حال بررسی نشست محلی…" : notice}
        </div>
        {error ? (
          <div
            className="error-banner"
            role="alert"
            aria-labelledby="error-title"
            tabIndex={-1}
            ref={errorBox}
          >
            <strong id="error-title">این مرحله کامل نشد</strong>
            <p>{error.message}</p>
            {error.requestId ? (
              <details>
                <summary>شناسه پیگیری</summary>
                <code>{error.requestId}</code>
              </details>
            ) : null}
            <button type="button" className="button-quiet" onClick={() => setError(null)}>
              بستن پیام
            </button>
          </div>
        ) : null}
        {loading ? (
          <div className="panel loading-panel" aria-busy="true">
            <span className="spinner" aria-hidden="true" />
            <p>در حال آماده‌کردن میز کار…</p>
          </div>
        ) : !view ? (
          <div className="login-layout">
            <section className="panel login-panel" aria-labelledby="login-title">
              <p className="eyebrow">شروع امن</p>
              <h2 id="login-title">وارد میز کار محلی شوید</h2>
              <p>
                برای دسترسی به فایل‌های پروژه، کلید ورود همین نصب لازم است. این کلید با رمز یا توکن
                لیارا تفاوت دارد.
              </p>
              <form onSubmit={signIn} aria-busy={busy === "login"}>
                <label htmlFor="operator-token">کلید ورود محلی</label>
                <input
                  id="operator-token"
                  type="password"
                  autoComplete="current-password"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  required
                  maxLength={256}
                  aria-describedby="login-help"
                  aria-invalid={error?.code === "AUTH_REQUIRED" || undefined}
                  disabled={busy !== null}
                  dir="ltr"
                />
                <p id="login-help" className="hint">
                  کلید فقط برای ورود استفاده می‌شود و در مرورگر ذخیره نمی‌شود.
                </p>
                <button disabled={busy !== null} type="submit">
                  {busy === "login" ? "در حال ورود…" : "ورود به میز کار"}
                </button>
              </form>
            </section>
            <aside className="setup-aside">
              <h2>اولین بار است؟</h2>
              <p>یک‌بار تنظیمات محلی را آماده کنید، سپس برنامه را دوباره اجرا کنید:</p>
              <pre>
                <code>npm run setup:local</code>
              </pre>
              <p>کلید ورود در فایل محلی زیر قرار می‌گیرد:</p>
              <code className="path-line">.local/operator-access.txt</code>
              <p className="hint">
                پروژه نمونه برای بررسی بدون هزینه در همین مخزن موجود است. هنوز انتشار یا تشخیص
                زنده‌ای انجام نمی‌شود.
              </p>
            </aside>
          </div>
        ) : workbenchMode === "incident" ? (
          <IncidentWorkbench
            csrf={view.session.csrfToken}
            disabled={expired}
            onSessionExpired={() => setView(null)}
          />
        ) : (
          <div className="workbench-grid">
            <div className="primary-column">
              {expired ? (
                <div className="note note-danger" role="alert">
                  نشست منقضی شده است. برای ادامه دوباره وارد شوید.
                </div>
              ) : null}
              <section className="panel inspect-panel" aria-labelledby="inspect-title">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">گام اول · فقط خواندن</p>
                    <h2 id="inspect-title">کدام پروژه را آماده کنیم؟</h2>
                  </div>
                  <span className="badge badge-ok">بدون هزینه API</span>
                </div>
                <p>
                  بررسی فقط محلی است؛ کدی اجرا یا ارسال نمی‌شود. فایل‌های env و مسیرهای حساس رایج کنار
                  گذاشته می‌شوند.
                </p>
                <form onSubmit={inspect} aria-busy={busy === "inspect"}>
                  <label htmlFor="project-directory">مسیر نسبی پوشه پروژه</label>
                  <input
                    id="project-directory"
                    value={directory}
                    onChange={(event) => {
                      setDirectory(event.target.value);
                      setProfile(null);
                      setArtifact(null);
                    }}
                    dir="ltr"
                    spellCheck={false}
                    autoComplete="off"
                    required
                    maxLength={240}
                    aria-describedby="directory-help"
                    disabled={busy !== null || expired}
                  />
                  <p id="directory-help" className="hint">
                    نمونه آماده: <bdi>examples/node-service</bdi>. مسیر کامل درایو وارد نکنید.
                  </p>
                  <div className="button-row">
                    <button
                      type="submit"
                      ref={inspectTrigger}
                      disabled={
                        busy !== null ||
                        expired ||
                        view.capabilities.workspace.state !== "available"
                      }
                    >
                      {busy === "inspect" ? "در حال بررسی پروژه…" : "بررسی پروژه"}
                    </button>
                    {busy === "inspect" ? (
                      <button
                        className="button-secondary"
                        type="button"
                        onClick={() => pending.current?.abort()}
                      >
                        لغو بررسی
                      </button>
                    ) : null}
                  </div>
                </form>
              </section>
              {profile ? (
                <section className="panel profile-panel" aria-labelledby="profile-title">
                  <div className="section-heading">
                    <h2 id="profile-title" ref={resultHeading} tabIndex={-1}>
                      آنچه از پروژه می‌دانیم
                    </h2>
                    <span className="badge badge-ok">شاهد: فایل محلی</span>
                  </div>
                  <p>
                    این نتیجه از بررسی فایل‌ها به دست آمده؛ اجرای برنامه و کافی‌بودن تنظیمات هنوز
                    بررسی نشده است.
                  </p>
                  <dl className="profile-facts">
                    <div>
                      <dt>محیط اجرا</dt>
                      <dd>
                        <bdi>{profile.runtime === "node" ? "Node.js" : "نامشخص"}</bdi>
                      </dd>
                    </div>
                    <div>
                      <dt>نسخه Node</dt>
                      <dd>
                        <bdi>{profile.nodeVersion || "نامشخص"}</bdi>
                      </dd>
                    </div>
                    <div>
                      <dt>پورت شناسایی‌شده</dt>
                      <dd>
                        <bdi>{profile.port || "نامشخص"}</bdi>
                      </dd>
                    </div>
                    <div>
                      <dt>حجم source مجاز</dt>
                      <dd>{number(profile.totalBytes)} بایت</dd>
                    </div>
                  </dl>
                  <div className="command-block">
                    <span>دستور start در پروژه؛ اجرا نشده</span>
                    <code>{profile.start || "تعریف نشده"}</code>
                  </div>
                  <div className="env-list">
                    <strong>نام متغیرهای شناسایی‌شده</strong>
                    {profile.envNames.length ? (
                      <div>
                        {profile.envNames.map((name) => (
                          <code key={name}>{name}</code>
                        ))}
                      </div>
                    ) : (
                      <p className="hint">
                        نامی شناسایی نشد؛ این نتیجه ثابت نمی‌کند برنامه به env نیاز ندارد.
                      </p>
                    )}
                  </div>
                  {profile.missing.length ? (
                    <div className="note">
                      <strong>پیش از انتشار روشن شود</strong>
                      <ul>
                        {profile.missing.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <details className="manifest">
                    <summary>
                      فهرست {number(profile.manifest.length)} فایل مجاز ·{" "}
                      {number(profile.excludedCount)} مورد کنار گذاشته شد
                    </summary>
                    <p className="hint">
                      بسته فقط از همین فایل‌ها ساخته می‌شود. پیش از ارسال، نبود فایل خصوصی در این
                      فهرست را هم بررسی کنید؛ هنوز چیزی به لیارا ارسال نشده است.
                    </p>
                    {/* biome-ignore lint/a11y/noNoninteractiveTabindex: The bounded scroll region must be reachable for keyboard horizontal scrolling. */}
                    <section className="table-scroll" tabIndex={0} aria-label="فهرست فایل‌های مجاز">
                      <table>
                        <thead>
                          <tr>
                            <th scope="col">فایل</th>
                            <th scope="col">بایت</th>
                            <th scope="col">SHA-256</th>
                          </tr>
                        </thead>
                        <tbody>
                          {profile.manifest.map((file) => (
                            <tr key={file.path}>
                              <td>
                                <bdi>{file.path}</bdi>
                              </td>
                              <td>{number(file.bytes)}</td>
                              <td>
                                <code>{file.sha256}</code>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </section>
                    <code className="hash-line">{profile.sourceHash}</code>
                  </details>
                  <div className="archive-preparation" aria-busy={busy === "archive"}>
                    <h3>بسته source را محلی آماده کنید</h3>
                    <p>
                      فهرست فایل‌ها را بررسی کنید. بسته بدون اجرای کد پروژه ساخته می‌شود و برای این
                      مرحله به حساب لیارا نیاز ندارید.
                    </p>
                    {artifact ? (
                      <div className="archive-result">
                        <h4 ref={artifactHeading} tabIndex={-1}>
                          بسته محلی آماده است؛ ارسال نشده
                        </h4>
                        <p>
                          <bdi>tar.gz</bdi> · {number(artifact.fileCount)} فایل ·{" "}
                          {number(artifact.bytes)} بایت
                        </p>
                        <details className="technical-details">
                          <summary>هش بسته قابل ارسال</summary>
                          <code className="hash-line">{artifact.archiveHash}</code>
                        </details>
                      </div>
                    ) : (
                      <div className="button-row">
                        <button
                          type="button"
                          ref={archiveTrigger}
                          onClick={prepareSource}
                          disabled={
                            busy !== null || expired || profile.runtime !== "node" || !profile.start
                          }
                        >
                          {busy === "archive" ? "در حال آماده‌سازی بسته…" : "آماده‌سازی بسته محلی"}
                        </button>
                        {busy === "archive" ? (
                          <button
                            type="button"
                            className="button-secondary"
                            onClick={() => pending.current?.abort()}
                          >
                            لغو آماده‌سازی
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>
                  <form
                    className="proposal-form"
                    onSubmit={propose}
                    aria-busy={busy === "proposal"}
                  >
                    <h3>پیشنهاد انتشار را آماده کنید</h3>
                    <p>
                      مسیر پیشنهادی برای این پروژه، انتشار source برنامه Node است. پلن، قیمت و
                      اعتبار هنوز از لیارا خوانده نشده‌اند.
                    </p>
                    <fieldset disabled={busy !== null || expired}>
                      <legend>برنامه مقصد در محدوده مجاز</legend>
                      {view.capabilities.scope.apps.length ? (
                        <div className="app-options">
                          {view.capabilities.scope.apps.map((name) => (
                            <label
                              className={`radio-option ${app === name ? "selected" : ""}`}
                              key={name}
                            >
                              <input
                                type="radio"
                                name="app"
                                value={name}
                                checked={app === name}
                                onChange={() => setApp(name)}
                              />
                              <bdi>{name}</bdi>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <p className="note">
                          مقصد لیارا هنوز آماده نیست. بررسی پروژه و ساخت بسته را همین حالا انجام
                          دهید؛ پس از آماده‌شدن حساب، یک app آزمایشی در محدوده مجاز انتخاب می‌شود.
                        </p>
                      )}
                    </fieldset>
                    <label htmlFor="deploy-port">پورت برنامه</label>
                    <input
                      id="deploy-port"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={65535}
                      value={port}
                      onChange={(event) => setPort(event.target.value)}
                      required
                      dir="ltr"
                      disabled={busy !== null || expired}
                      aria-describedby="port-help"
                    />
                    <p className="hint" id="port-help">
                      باید با پورتی که برنامه روی آن گوش می‌دهد برابر باشد.
                    </p>
                    <button
                      type="submit"
                      disabled={
                        busy !== null ||
                        expired ||
                        !app ||
                        !artifact ||
                        profile.runtime !== "node" ||
                        !profile.start
                      }
                    >
                      {busy === "proposal" ? "در حال ذخیره پیشنهاد…" : "ساخت پیشنهاد قابل بررسی"}
                    </button>
                    {!artifact ? (
                      <p className="hint">ابتدا بسته source را با دکمه بالا آماده کنید.</p>
                    ) : null}
                  </form>
                </section>
              ) : null}
              {view.actions.length ? (
                <section className="actions-section" aria-labelledby="actions-title">
                  <h2 id="actions-title">پیشنهادها و تصمیم‌ها</h2>
                  <p className="hint">
                    تأیید هر پیشنهاد یک‌بار مصرف و ده دقیقه معتبر است. تاریخچه پس از راه‌اندازی مجدد
                    حفظ می‌شود.
                  </p>
                  {view.actions.map((action) => (
                    <ActionCard
                      key={action.id}
                      action={
                        action.expiresAt <= clock &&
                        ["approved", "awaiting_approval"].includes(action.state)
                          ? { ...action, state: "expired" }
                          : action
                      }
                      disabled={busy !== null || expired}
                      onDecision={decide}
                    />
                  ))}
                </section>
              ) : null}
            </div>
            <aside className="context-column" aria-label="دسترسی و راهنمای کار">
              <section className="panel access-panel">
                <p className="eyebrow">مرزهای فعلی</p>
                <h2>چه چیزی آماده است؟</h2>
                <ul className="access-list">
                  <AccessRow title="پروژه محلی" item={view.capabilities.workspace} />
                  <AccessRow title="حساب لیارا" item={view.capabilities.liara} />
                  <AccessRow title="تحلیل BoxAPI" item={view.capabilities.model} />
                  <AccessRow title="انتشار و اصلاح" item={view.capabilities.mutations} />
                </ul>
              </section>
              <section className="help-panel">
                <h2>چرا نتیجه را بررسی می‌کنیم؟</h2>
                <p>
                  پذیرفته‌شدن درخواست انتشار کافی نیست. پس از اتصال، باید هم release و هم پاسخ همان
                  برنامه بررسی شوند.
                </p>
                <p className="hint">
                  اگر نتیجه اجرا نامعلوم بماند، اقدام دوباره متوقف می‌شود تا نتیجه قبلی روشن شود.
                </p>
              </section>
            </aside>
          </div>
        )}
        <footer className="app-footer">
          <span lang="en" dir="ltr">
            Launchlane
          </span>
          <p>پروژه محلی و تصمیم‌های شما؛ نتیجه واقعی فقط با شاهد.</p>
          <a href="/api/health" target="_blank" rel="noreferrer">
            وضعیت اجرای برنامه<span className="sr-only"> (در زبانه تازه)</span>
          </a>
        </footer>
      </main>
    </>
  );
}
