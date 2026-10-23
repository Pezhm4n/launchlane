"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { WorkspaceView } from "../contracts/domain.ts";
import { parseConnection } from "../contracts/connections.ts";
import { object } from "../contracts/validation.ts";
import { api, ClientError } from "./api.ts";
import { useDialogExit } from "./useDialogExit.ts";
import { McpConnectionDialog } from "./McpConnectionDialog.tsx";

export function ConnectionDialog({
  workspace,
  purpose,
  onRefresh,
  onGitHub,
  onClose,
  onSignOut,
  onSessionExpired,
}: {
  workspace: WorkspaceView;
  purpose: "source" | "incident";
  onRefresh: () => Promise<unknown>;
  onGitHub: () => void;
  onClose: () => void;
  onSignOut: () => void;
  onSessionExpired: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    errorBox = useRef<HTMLDivElement>(null),
    disconnectTrigger = useRef<HTMLButtonElement>(null),
    disconnectConfirm = useRef<HTMLButtonElement>(null),
    githubDisconnectTrigger = useRef<HTMLButtonElement>(null),
    githubDisconnectConfirm = useRef<HTMLButtonElement>(null),
    pending = useRef<AbortController | null>(null);
  const [key, setKey] = useState(""),
    [busy, setBusy] = useState<string | null>(null),
    [error, setError] = useState<ClientError | null>(null),
    [notice, setNotice] = useState(""),
    [lastAction, setLastAction] = useState<
      "connect" | "refresh" | "select" | "disconnect" | "site" | null
    >(null),
    [confirmDisconnect, setConfirmDisconnect] = useState(false),
    [confirmGitHubDisconnect, setConfirmGitHubDisconnect] = useState(false);
  const exit = useDialogExit(dialog);
  const [mcpOpen, setMcpOpen] = useState(false);
  const mcpTrigger = useRef<HTMLButtonElement>(null);
  const dismiss = () => { pending.current?.abort(); exit(onClose); };
  const [metadata, setMetadata] = useState<{
    configuredKey: boolean;
    teamConfigured: boolean;
  } | null>(null);
  const [enterKey, setEnterKey] = useState(false);
  const [pendingApp, setPendingApp] = useState<string | null>(null);
  const [site, setSite] = useState(workspace.features.probeOrigin || "");
  const liara = workspace.connections.liara,
    github = workspace.connections.github;
  useEffect(() => {
    setSite(liara?.selectedApp ? workspace.features.probeOrigin || "" : "");
  }, [workspace.features.probeOrigin, liara?.selectedApp]);
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    const controller = new AbortController();
    api(
      "/api/connections/liara",
      (value) => {
        const row = object(value);
        return {
          configuredKey: row.configuredKey === true,
          teamConfigured: row.teamConfigured === true,
        };
      },
      { signal: controller.signal },
    )
      .then(setMetadata)
      .catch((error: unknown) => {
        if (!controller.signal.aborted && error instanceof ClientError) {
          setError(error);
          if (error.code === "AUTH_REQUIRED") onSessionExpired();
        }
      });
    return () => {
      controller.abort();
      pending.current?.abort();
      node?.close();
    };
  }, [onSessionExpired]);
  useEffect(() => {
    if (error) errorBox.current?.focus();
  }, [error]);
  useEffect(() => {
    if (confirmDisconnect) disconnectConfirm.current?.focus();
  }, [confirmDisconnect]);
  useEffect(() => {
    if (confirmGitHubDisconnect) githubDisconnectConfirm.current?.focus();
  }, [confirmGitHubDisconnect]);
  async function disconnectGitHub() {
    if (busy || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy("disconnect");
    setError(null);
    setNotice("");
    try {
      await api("/api/connections/github", () => true, {
        method: "DELETE",
        csrf: workspace.session.csrfToken,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      await onRefresh();
      setNotice("اتصال GitHub از Launchlane حذف شد. دسترسی قبلی پاک شد.");
    } catch (error) {
      if (error instanceof ClientError && error.code === "AUTH_REQUIRED") onSessionExpired();
      else
        setError(
          error instanceof ClientError
            ? error
            : new ClientError("GITHUB_DISCONNECT_FAILED", "قطع اتصال GitHub کامل نشد."),
        );
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setBusy(null);
      }
    }
  }
  async function act(
    operation: "connect" | "refresh" | "select" | "disconnect" | "site",
    app?: string,
    suppliedKey?: string,
  ) {
    if (busy || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(operation);
    setError(null);
    setNotice("");
    setLastAction(null);
    try {
      if (operation === "disconnect")
        await api("/api/connections/liara", () => true, {
          method: "DELETE",
          csrf: workspace.session.csrfToken,
          signal: controller.signal,
        });
      else
        await api("/api/connections/liara", (value) => parseConnection(object(value).connection), {
          body: {
            operation,
            ...(operation === "select" ? { app } : {}),
            ...(suppliedKey ? { key: suppliedKey } : {}),
            ...(operation === "site" ? { origin: site } : {}),
          },
          csrf: workspace.session.csrfToken,
          signal: controller.signal,
        });
      if (controller.signal.aborted) return;
      await onRefresh();
      setNotice(
        operation === "disconnect"
          ? "اتصال از Launchlane حذف شد. کلید شما در لیارا همچنان معتبر است."
          : operation === "site"
            ? "نشانی برای بررسی ذخیره شد؛ هنوز درخواستی به سایت ارسال نشده است."
            : operation === "select"
              ? "برنامه مقصد انتخاب شد. هر تغییر حساس همچنان به تأیید شما نیاز دارد."
              : "حساب و تیم متصل شدند. در مسیر انتشار، مقصد تازه و پلن پیشنهادی پروژه را همین‌جا بررسی می‌کنید؛ اگر مقصدی دارید، از فهرست انتخاب کنید.",
      );
      setLastAction(operation);
      setEnterKey(false);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof ClientError) {
        setError(error);
        if (error.code === "AUTH_REQUIRED") onSessionExpired();
      } else
        setError(
          new ClientError(
            "CONNECTION_FAILED",
            "پاسخ اتصال دریافت نشد. وضعیت حساب را دوباره بررسی کنید.",
          ),
        );
      await onRefresh().catch(() => undefined);
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setBusy(null);
        setPendingApp(null);
      }
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = key.trim();
    setKey("");
    void act("connect", undefined, value);
  }
  return (
    <dialog
      className="folder-dialog account-dialog"
      ref={dialog}
      aria-labelledby="accounts-title"
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
    >
      <div className="section-heading">
        <h2 id="accounts-title">حساب‌ها و دسترسی</h2>
        <button type="button" className="button-quiet" onClick={dismiss}>
          بستن
        </button>
      </div>
      <p>
        ورود به این برنامه، اتصال حساب لیارا و اتصال GitHub سه دسترسی جدا هستند. اتصال حساب به‌تنهایی
        چیزی را منتشر یا تغییر نمی‌دهد.
      </p>
      <section aria-labelledby="liara-account-title" aria-busy={busy !== null}>
        <div className="section-heading">
          <h3 id="liara-account-title">حساب لیارا</h3>
          <span className={`badge ${liara?.status === "connected" ? "badge-ok" : "badge-warning"}`}>
            {busy
              ? "در حال بررسی…"
              : liara?.status === "connected"
                ? "متصل"
                : liara
                  ? "نیاز به اتصال دوباره"
                  : "متصل نشده"}
          </span>
        </div>
        {liara ? (
          <>
            <p>
              <strong>{liara.displayName}</strong> <bdi className="hint">{liara.login}</bdi>
            </p>
            <p>
              تیم: <strong>{liara.teamName}</strong>
            </p>
            <p className="hint">
              آخرین بررسی:{" "}
              {new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeStyle: "short" }).format(
                liara.checkedAt,
              )}
            </p>
          </>
        ) : (
          <p>
            برای انتخاب برنامه مقصد، حساب همان تیم را متصل کنید. بررسی فایل‌های پروژه بدون اتصال هم
            انجام می‌شود.
          </p>
        )}
        {liara?.status === "connected" ? (
          <>
            <fieldset disabled={busy !== null}>
              <legend>مقصدهای موجود در همین تیم</legend>
              {liara.apps.length ? (
                <div className="app-options">
                  {liara.apps.map((app) => (
                    <label key={app.id} className="radio-option">
                      <input
                        type="radio"
                        name="liara-app"
                        value={app.name}
                        checked={(pendingApp ?? liara.selectedApp) === app.name}
                        onChange={() => {
                          setPendingApp(app.name);
                          void act("select", app.name);
                        }}
                      />
                      <bdi>{app.name}</bdi>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="note">
                  <h4>اولین مقصد پروژه را در Launchlane بسازید</h4>
                  <p>این تیم هنوز برنامه‌ای ندارد. در مسیر انتشار، Launchlane بر اساس پروژهٔ انتخاب‌شده پلن و هزینه را پیشنهاد می‌دهد و پس از تصمیم شما، مقصد لازم را می‌سازد. نیازی به بازکردن کنسول لیارا نیست.</p>
                  <button type="button" disabled={busy !== null} onClick={dismiss}>ادامه با پیشنهاد مقصد و پلن</button>
                </div>
              )}
            </fieldset>
            {lastAction === "select" && notice ? (
              <p className="hint app-selection-feedback" role="status">
                {notice}
              </p>
            ) : null}
            {liara.selectedApp ? (
              <details
                className="site-address"
                open={purpose === "incident" && !workspace.features.probeOrigin}
              >
                <summary>
                  {workspace.features.probeOrigin
                    ? "نشانی سایت برای بررسی مشکل"
                    : "افزودن نشانی سایت (اختیاری برای انتشار)"}
                </summary>
                <p className="hint">
                  نشانی باید متعلق به برنامه <bdi>{liara.selectedApp}</bdi> باشد. فقط برای خواندن
                  پاسخ سایت استفاده می‌شود؛ دامنه یا تنظیمات لیارا تغییر نمی‌کند.
                </p>
                {workspace.features.probeOrigin ? (
                  <p>
                    نشانی ثبت‌شده: <bdi>{workspace.features.probeOrigin}</bdi>
                  </p>
                ) : null}
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void act("site");
                  }}
                >
                  <label htmlFor="site-origin">نشانی سایت</label>
                  <input
                    id="site-origin"
                    dir="ltr"
                    type="text"
                    inputMode="url"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={site}
                    placeholder="example.com یا https://example.com"
                    onChange={(event) => setSite(event.target.value)}
                    required
                    maxLength={512}
                    disabled={busy !== null}
                    aria-describedby={
                      error?.code.startsWith("SITE_")
                        ? "site-origin-help liara-connection-error"
                        : "site-origin-help"
                    }
                    aria-invalid={error?.code.startsWith("SITE_") || undefined}
                  />
                  <p id="site-origin-help" className="hint">
                    نشانی کامل یا دامنه را بدون مسیر صفحه وارد کنید؛ مثلاً example.com. اتصال امن
                    https لازم است و نشانی داخلی یا محلی قابل بررسی نیست.
                  </p>
                  <button
                    type="submit"
                    className="button-secondary"
                    disabled={busy !== null || !site.trim()}
                  >
                    ذخیره نشانی برای بررسی
                  </button>
                </form>
              </details>
            ) : null}
            <div className="button-row">
              <button
                type="button"
                className="button-secondary"
                disabled={busy !== null}
                onClick={() => void act("refresh")}
              >
                بررسی دوباره اتصال و برنامه‌ها
              </button>
              <button
                type="button"
                className="button-danger"
                ref={disconnectTrigger}
                disabled={busy !== null}
                aria-expanded={confirmDisconnect}
                onClick={() => setConfirmDisconnect(true)}
              >
                قطع اتصال لیارا
              </button>
            </div>
            {confirmDisconnect ? (
              <fieldset className="note note-danger" aria-labelledby="liara-disconnect-title">
                <legend id="liara-disconnect-title">اتصال لیارا از این میز کار قطع شود؟</legend>
                <p>
                  دسترسی این نصب و انتخاب برنامه فعلی از میز کار پاک می‌شود. برنامه‌ها و انتشارهای
                  شما در لیارا تغییری نمی‌کنند و کلید API شما معتبر می‌ماند.
                </p>
                <div className="button-row">
                  <button
                    type="button"
                    className="button-danger"
                    ref={disconnectConfirm}
                    disabled={busy !== null}
                    onClick={() => {
                      setConfirmDisconnect(false);
                      void act("disconnect");
                    }}
                  >
                    بله، اتصال را قطع کن
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    disabled={busy !== null}
                    onClick={() => {
                      setConfirmDisconnect(false);
                      disconnectTrigger.current?.focus();
                    }}
                  >
                    انصراف
                  </button>
                </div>
              </fieldset>
            ) : null}
          </>
        ) : metadata === null ? (
          <p role="status">در حال بررسی تنظیمات اتصال…</p>
        ) : !metadata.teamConfigured ? (
          <p className="note">
            تیم مجاز این نصب هنوز تعیین نشده است. مسئول راه‌اندازی باید تیم مقصد را مشخص کند؛
            می‌توانید بررسی پروژه را ادامه دهید.
          </p>
        ) : metadata.configuredKey && !enterKey ? (
          <div className="button-row">
            <button type="button" disabled={busy !== null} onClick={() => void act("connect")}>
              بررسی اتصال آماده‌شده این نصب
            </button>
            <button
              className="button-secondary"
              type="button"
              disabled={busy !== null}
              onClick={() => setEnterKey(true)}
            >
              استفاده از کلید دیگری
            </button>
          </div>
        ) : (
          <>
            <p className="hint">
              در{" "}
              <a
                href="https://docs.liara.ir/references/api/about/#کلید-دسترسی-به-api"
                target="_blank"
                rel="noreferrer"
              >
                راهنمای رسمی دریافت کلید
              </a>
              ، بخش API حساب لیارا را باز کنید و کلید دارای مدت اعتبار مناسب بسازید. کلید باید به
              همین تیم دسترسی داشته باشد.
            </p>
            <form onSubmit={submit}>
              <label htmlFor="liara-access-key">کلید دسترسی لیارا</label>
              <input
                id="liara-access-key"
                type="password"
                autoComplete="off"
                dir="ltr"
                value={key}
                onChange={(event) => setKey(event.target.value)}
                required
                maxLength={4096}
                disabled={busy !== null}
                aria-invalid={Boolean(error?.code.startsWith("LIARA_")) || undefined}
                aria-describedby={
                  error?.code.startsWith("LIARA_")
                    ? "liara-key-help liara-connection-error"
                    : "liara-key-help"
                }
              />
              <p id="liara-key-help" className="hint">
                این کلید با رمز ورود حساب تفاوت دارد. فقط برای ارتباط با لیارا استفاده و در همین نصب
                رمز‌شده نگهداری می‌شود.
              </p>
              <button type="submit" disabled={busy !== null || !key.trim()}>
                {busy ? "در حال بررسی حساب…" : "اتصال حساب لیارا"}
              </button>
            </form>
          </>
        )}
      </section>
      <div role="status" aria-live="polite" className="hint">
        {lastAction === "select" ? "" : notice}
      </div>
      {error ? (
        <div
          id="liara-connection-error"
          role="alert"
          aria-label="اتصال حساب کامل نشد"
          tabIndex={-1}
          ref={errorBox}
          className="error-banner"
        >
          <p>{error.message}</p>
          {error.requestId ? (
            <details>
              <summary>شناسه پیگیری</summary>
              <code>{error.requestId}</code>
            </details>
          ) : null}
        </div>
      ) : null}
      <section className="account-secondary" aria-labelledby="github-account-title">
        <div className="section-heading">
          <h3 id="github-account-title">GitHub</h3>
          <span className={`badge ${github?.status === "connected" ? "badge-ok" : "badge-quiet"}`}>
            {github?.status === "connected"
              ? "متصل"
              : github
                ? "نیاز به اتصال دوباره"
                : "متصل نشده"}
          </span>
        </div>
        <p>
          {github ? (
            <bdi>{github.login}</bdi>
          ) : (
            "اگر کد پروژه در GitHub است، حساب را متصل و مخزن را انتخاب کنید."
          )}
        </p>
        {github?.status === "connected" ? (
          <>
            {!confirmGitHubDisconnect ? (
              <div className="button-row">
                <button
                  type="button"
                  className="button-secondary"
                  disabled={busy !== null}
                  onClick={() => exit(onGitHub)}
                >
                  مخزن‌ها و انتخاب پروژه
                </button>
                <button
                  type="button"
                  className="button-danger"
                  ref={githubDisconnectTrigger}
                  disabled={busy !== null}
                  aria-expanded={confirmGitHubDisconnect}
                  onClick={() => setConfirmGitHubDisconnect(true)}
                >
                  قطع اتصال GitHub
                </button>
              </div>
            ) : (
              <fieldset className="note note-danger" aria-labelledby="github-disconnect-title">
                <legend id="github-disconnect-title">اتصال GitHub از این میز کار قطع شود؟</legend>
                <p>
                  اطلاعات ورود و دسترسی این نصب به مخازن GitHub پاک می‌شود. مخازن و کدهای شما در GitHub
                  هیچ تغییری نمی‌کنند.
                </p>
                <div className="button-row">
                  <button
                    type="button"
                    className="button-danger"
                    ref={githubDisconnectConfirm}
                    disabled={busy !== null}
                    onClick={() => {
                      setConfirmGitHubDisconnect(false);
                      void disconnectGitHub();
                    }}
                  >
                    بله، اتصال را قطع کن
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    disabled={busy !== null}
                    onClick={() => {
                      setConfirmGitHubDisconnect(false);
                      githubDisconnectTrigger.current?.focus();
                    }}
                  >
                    انصراف
                  </button>
                </div>
              </fieldset>
            )}
          </>
        ) : (
          <button
            type="button"
            className="button-secondary"
            disabled={busy !== null}
            onClick={() => exit(onGitHub)}
          >
            {github ? "نیاز به اتصال دوباره به GitHub" : "اتصال به GitHub و انتخاب مخزن"}
          </button>
        )}
      </section>
      <section className="account-secondary" aria-labelledby="mcp-account-title">
        <h3 id="mcp-account-title">اتصال ابزار کدنویسی</h3>
        <p className="hint">از ابزار کدنویسی خود، پروژه و مأموریت همین حساب را در Launchlane دنبال کنید.</p>
        <button type="button" className="button-secondary" ref={mcpTrigger} disabled={busy !== null} onClick={() => setMcpOpen(true)}>اتصال MCP</button>
      </section>
      {mcpOpen ? <McpConnectionDialog csrf={workspace.session.csrfToken} onSessionExpired={onSessionExpired}
        onClose={() => { setMcpOpen(false); requestAnimationFrame(() => mcpTrigger.current?.focus()); }} /> : null}
      <section className="account-secondary session-actions" aria-labelledby="session-title">
        <div className="section-heading">
          <h3 id="session-title">نشست این مرورگر</h3>
        </div>
        <p className="hint">
          اگر روی رایانه مشترک کار می‌کنید، در پایان خارج شوید. پیشرفت ذخیره‌شده از بین نمی‌رود.
        </p>
        <button
          type="button"
          className="button-secondary"
          disabled={busy !== null}
          onClick={() => exit(onSignOut)}
        >
          خروج از میز کار
        </button>
      </section>
    </dialog>
  );
}
