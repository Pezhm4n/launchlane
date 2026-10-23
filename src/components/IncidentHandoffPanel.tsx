"use client";
import { useEffect, useId, useRef, useState } from "react";
import { parseIncidentHandoff, type IncidentHandoff } from "../contracts/incident-handoff.ts";
import { object } from "../contracts/validation.ts";
import { api, ClientError } from "./api.ts";

export function IncidentHandoffPanel({
  runId,
  mode,
  disabled,
  onSessionExpired,
}: {
  runId: string;
  mode: "live" | "sample";
  disabled: boolean;
  onSessionExpired: () => void;
}) {
  const [report, setReport] = useState<{ document: IncidentHandoff; url: string } | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState<ClientError | null>(null),
    [notice, setNotice] = useState("");
  const pending = useRef<AbortController | null>(null),
    blobUrl = useRef<string | null>(null),
    trigger = useRef<HTMLButtonElement>(null),
    result = useRef<HTMLHeadingElement>(null),
    returnFocus = useRef(false);
  const helpId = useId(),
    titleId = useId();
  useEffect(
    () => () => {
      pending.current?.abort();
      if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
    },
    [],
  );
  useEffect(() => {
    if (report) {
      result.current?.focus();
      result.current?.scrollIntoView({ block: "start" });
    }
  }, [report]);
  useEffect(() => {
    if (!loading && returnFocus.current) {
      returnFocus.current = false;
      trigger.current?.focus({ preventScroll: true });
      // Cancelling shortens this section; keep its summary below the sticky navigation.
      trigger.current?.closest("details")?.scrollIntoView({ block: "start" });
    }
  }, [loading]);
  function cancel(focus: boolean) {
    pending.current?.abort();
    pending.current = null;
    returnFocus.current = focus;
    setLoading(false);
    setNotice("آماده‌سازی گزارش متوقف شد. نتیجه بررسی حفظ شده است.");
  }
  async function prepare() {
    if (pending.current || disabled) return;
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true);
    setError(null);
    setNotice("");
    try {
      const document = await api(
        `/api/incidents/handoff?id=${encodeURIComponent(runId)}`,
        (value) => {
          const decoded = parseIncidentHandoff(object(value).handoff);
          if (decoded.runId !== runId || decoded.mode !== mode)
            throw new ClientError(
              "HANDOFF_MISMATCH",
              "گزارش مربوط به این بررسی نیست. نتیجه بررسی را دوباره باز کنید.",
            );
          return decoded;
        },
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(
        new Blob([document.markdown], { type: "text/markdown;charset=utf-8" }),
      );
      if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
      blobUrl.current = url;
      setReport({ document, url });
      setNotice("گزارش آماده است. پیش از دریافت یا اشتراک، محتوای فایل را بازبینی کنید.");
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof ClientError && error.code === "AUTH_REQUIRED") {
        onSessionExpired();
        return;
      }
      setError(
        error instanceof ClientError
          ? error
          : new ClientError(
              "HANDOFF_UNAVAILABLE",
            "گزارش دریافت نشد. نتیجه بررسی حفظ شده است؛ دوباره تلاش کنید.",
            ),
      );
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setLoading(false);
      }
    }
  }
  return (
    <details
      className="incident-handoff"
      onToggle={(event) => {
        if (!event.currentTarget.open && pending.current) cancel(false);
      }}
    >
      <summary>گزارش برای اصلاح کد</summary>
      <p id={helpId} className="hint">
        گزارش همین بررسی را برای برنامه‌نویس یا Coding Agent آماده کنید. فایل شامل شواهد و معیار
        اصلاح است؛ برنامه تغییر نمی‌کند و چیزی به بیرون ارسال نمی‌شود.
      </p>
      {mode === "sample" ? (
        <p className="simulation-label">فایل این نمونه نیز آزمایشی است؛ گزارش سایت شما نیست.</p>
      ) : null}
      {disabled ? (
        <p className="hint">پس از پایان کار در حال اجرا می‌توانید گزارش را آماده کنید.</p>
      ) : null}
      <div className="button-row">
        <button
          type="button"
          className="button-secondary"
          ref={trigger}
          disabled={disabled || loading}
          aria-describedby={helpId}
          onClick={() => void prepare()}
        >
          {loading
            ? "در حال آماده‌کردن گزارش…"
            : report
              ? "آماده‌سازی دوباره گزارش"
              : "آماده‌سازی گزارش"}
        </button>
        {loading ? (
          <button type="button" className="button-quiet" onClick={() => cancel(true)}>
            توقف آماده‌سازی گزارش
          </button>
        ) : null}
      </div>
      <p role="status" className="hint">
        {loading ? "در حال آماده‌کردن گزارش از نتیجه ذخیره‌شده…" : notice}
      </p>
      {error ? (
        <div className="error-box" role="alert">
          <p>{error.message}</p>
          {error.requestId ? (
            <details>
              <summary>شناسه پیگیری برای پشتیبانی</summary>
              <code>{error.requestId}</code>
            </details>
          ) : null}
        </div>
      ) : null}
      {report ? (
        <section aria-labelledby={titleId}>
          <h3 id={titleId} ref={result} tabIndex={-1}>
            گزارش {mode === "sample" ? "نمونه" : "این بررسی"} آماده است
          </h3>
          <p className="hint">
            زمان آماده‌سازی:{" "}
            {new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeStyle: "short" }).format(
              report.document.generatedAt,
            )}
          </p>
          <div className="button-row">
            <a className="button-link" href={report.url} download={report.document.filename}>
              دریافت فایل گزارش
            </a>
          </div>
          <details>
            <summary>پیش‌نمایش محتوای فایل</summary>
            <textarea
              className="handoff-preview"
              dir="auto"
              readOnly
              rows={10}
              aria-label="محتوای گزارش برای اصلاح کد"
              value={report.document.markdown}
            />
          </details>
          <p className="hint">
            اطلاعات فایل به زمان بررسی مربوط است. نام‌های پروژه و داده‌های کسب‌وکار را پیش از اشتراک
            بازبینی کنید؛ قالب‌های ناشناخته اطلاعات محرمانه ممکن است به بررسی نیاز داشته باشند.
          </p>
        </section>
      ) : null}
    </details>
  );
}
