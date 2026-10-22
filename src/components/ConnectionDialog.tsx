"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { WorkspaceView } from "../contracts/domain.ts";
import { parseConnection } from "../contracts/connections.ts";
import { object } from "../contracts/validation.ts";
import { api, ClientError } from "./api.ts";

export function ConnectionDialog({
  workspace,
  purpose,
  onRefresh,
  onGitHub,
  onClose,
  onSessionExpired,
}: {
  workspace: WorkspaceView;
  purpose: "source" | "incident";
  onRefresh: () => Promise<unknown>;
  onGitHub: () => void;
  onClose: () => void;
  onSessionExpired: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    errorBox = useRef<HTMLDivElement>(null),
    disconnectTrigger = useRef<HTMLButtonElement>(null),
    disconnectConfirm = useRef<HTMLButtonElement>(null),
    pending = useRef<AbortController | null>(null);
  const [key, setKey] = useState(""),
    [busy, setBusy] = useState<string | null>(null),
    [error, setError] = useState<ClientError | null>(null),
    [notice, setNotice] = useState(""),
    [confirmDisconnect, setConfirmDisconnect] = useState(false);
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
              : "حساب و تیم بررسی و اتصال ثبت شد. اکنون برنامه مقصد را انتخاب کنید.",
      );
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
        onClose();
      }}
    >
      <div className="section-heading">
        <h2 id="accounts-title">حساب‌ها و دسترسی</h2>
        <button type="button" className="button-quiet" onClick={onClose}>
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
              <legend>برنامه‌ای که اجازه بررسی و آماده‌سازی انتشار آن را می‌دهید</legend>
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
                <p className="note">
                  هنوز برنامه مجازی در این تیم پیدا نشد. اگر برنامه را تازه ساخته‌اید، فهرست را
                  دوباره بررسی کنید. Launchlane در این مرحله برنامه جدید ایجاد نمی‌کند.
                </p>
              )}
            </fieldset>
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
                  <label htmlFor="site-origin">نام سایت</label>
                  <input
                    id="site-origin"
                    dir="ltr"
                    type="text"
                    inputMode="url"
                    value={site}
                    placeholder="example.com"
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
                    نام سایت را بدون مسیر صفحه وارد کنید. اتصال امن لازم است؛ نشانی داخلی و محلی
                    قابل بررسی نیست.
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
        {notice}
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
        <button
          type="button"
          className="button-secondary"
          disabled={busy !== null}
          onClick={onGitHub}
        >
          {github?.status === "connected"
            ? "مخزن‌ها و مدیریت اتصال GitHub"
            : "اتصال به GitHub و انتخاب مخزن"}
        </button>
      </section>
    </dialog>
  );
}
