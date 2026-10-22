"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { Action, WorkspaceView } from "../contracts/domain.ts";
import { decodeAction } from "../contracts/client-decode.ts";
import type { IncidentRun } from "../contracts/incident-run.ts";
import { inWindow } from "../contracts/incident.ts";
import { canReadRestartResult, restartReadbackEvidence } from "../contracts/restart.ts";
import { object } from "../contracts/validation.ts";
import { api, ClientError } from "./api.ts";

type Job = "propose" | "approve" | "reject" | "execute" | "observe" | "refresh";
const unresolved = (action: Action) =>
  ["executing", "observing", "uncertain"].includes(action.state);
const decode = (value: unknown) => decodeAction(object(value).action);
const date = (value: number) =>
  new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeStyle: "short" }).format(value);

export function RestartPanel({
  run,
  workspace,
  active,
  disabled,
  onAction,
  onBusyChange,
  onRefresh,
  onConnect,
  onRecheck,
  onSessionExpired,
}: {
  run: IncidentRun;
  workspace: WorkspaceView;
  active: boolean;
  disabled: boolean;
  onAction: (action: Action) => void;
  onBusyChange: (busy: boolean) => void;
  onRefresh: () => Promise<WorkspaceView>;
  onConnect: () => void;
  onRecheck: () => void;
  onSessionExpired: () => void;
}) {
  const id = useId(),
    title = useRef<HTMLHeadingElement>(null),
    errorBox = useRef<HTMLDivElement>(null);
  const pending = useRef<AbortController | null>(null),
    focusResult = useRef(false);
  const [busy, setBusy] = useState<Job | null>(null),
    [error, setError] = useState<ClientError | null>(null),
    [notice, setNotice] = useState(""),
    [consentFor, setConsentFor] = useState<string | null>(null),
    [clock, setClock] = useState(Date.now),
    [waitingForReceipt, setWaitingForReceipt] = useState<string | null>(null);
  const connection = workspace.connections.liara,
    savedEvidence = run.after ?? run.evidence,
    actions = workspace.actions.filter(
      (row) =>
        row.spec.version === 6 &&
        row.spec.scope.teamId === run.evidence.scope.teamId &&
        row.spec.scope.app === run.evidence.scope.app,
    ),
    action =
      actions.find(unresolved) ??
      actions.find((row) => row.spec.version === 6 && row.spec.incidentRunId === run.id),
    spec = action?.spec.version === 6 ? action.spec : null,
    actionId = action?.id,
    actionExpiresAt = action?.expiresAt ?? null,
    consent = Boolean(action && consentFor === action.id),
    readback = action ? restartReadbackEvidence(action) : null,
    evidence =
      readback && readback.collectedAt > savedEvidence.collectedAt ? readback : savedEvidence;
  const sameApp =
      connection?.status === "connected" &&
      connection.teamId === run.evidence.scope.teamId &&
      connection.selectedApp === run.evidence.scope.app &&
      connection.apps.some((app) => app.name === connection.selectedApp && app.id === run.appId),
    sameTarget =
      sameApp &&
      (!spec ||
        (connection.identityId === spec.accountId &&
          workspace.features.probeOrigin === spec.target.origin)),
    expired = Boolean(
      action &&
        Math.max(clock, Date.now()) >= action.expiresAt &&
        ["awaiting_approval", "approved"].includes(action.state),
    ),
    evidenceFresh = Math.max(clock, Date.now()) - savedEvidence.collectedAt <= 900_000,
    errorObserved = evidence.entries.some(
      (entry) =>
        entry.state === "observed" &&
        inWindow(entry, evidence) &&
        entry.fact?.kind === "http" &&
        entry.fact.path === run.path &&
        entry.fact.origin === workspace.features.probeOrigin &&
        entry.fact.status >= 400,
    ),
    sameEvidence =
      !spec ||
      (spec.incidentRunId === run.id &&
        spec.target.path === run.path &&
        action &&
        action.createdAt >= savedEvidence.collectedAt),
    conflict = workspace.actions.find(
      (row) =>
        row.id !== action?.id &&
        row.spec.scope.teamId === run.evidence.scope.teamId &&
        row.spec.scope.app === run.evidence.scope.app &&
        unresolved(row),
    ),
    eligible =
      evidenceFresh && errorObserved && (run.symptom === "errors" || run.symptom === "unavailable"),
    blocked = disabled || busy !== null,
    canPrepare =
      sameApp &&
      eligible &&
      workspace.features.deployment &&
      !conflict &&
      !(action && unresolved(action)),
    canExecute =
      sameTarget &&
      sameEvidence &&
      eligible &&
      workspace.features.deployment &&
      !expired &&
      waitingForReceipt !== action?.id;
  const stateText = !action
    ? "اقدام اختیاری"
    : expired
      ? "مهلت تأیید گذشته"
      : action.state === "awaiting_approval"
        ? "منتظر تصمیم شما"
        : action.state === "approved"
          ? "تأیید ثبت شد؛ اجرا نشده"
          : action.state === "executing"
            ? "در انتظار پاسخ درخواست"
            : action.state === "uncertain"
              ? "پذیرش درخواست نامعلوم است"
              : action.state === "observing"
                ? "درخواست پذیرفته شد؛ نتیجه صفحه را بررسی کنید"
                : action.state === "succeeded"
                  ? "درخواست پذیرفته شد؛ صفحه پاسخ می‌دهد"
                  : action.state === "failed"
                    ? action.restart?.observation?.outcome === "not_started"
                      ? "درخواست ارسال نشده است"
                      : "نتیجه مورد انتظار تأیید نشد"
                    : action.state === "expired"
                      ? "مهلت تأیید گذشته"
                      : "اجرا نمی‌شود";
  const help = !sameApp
    ? "برای ادامه، همان حساب و برنامه این گزارش را انتخاب کنید."
    : conflict
      ? "نتیجه انتشار قبلی این برنامه هنوز روشن نیست؛ ابتدا آن را در بخش انتشار بررسی کنید."
      : !eligible
        ? "ابتدا خطای همین صفحه را دوباره بررسی کنید؛ پاسخ خطای تازه لازم است. این اقدام بهبود سرعت را نمی‌سنجد."
        : !workspace.features.deployment
          ? `${workspace.capabilities.mutations.reason} فعال‌کردن آن با مسئول نصب و در محدوده مجاز است؛ اتصال حساب به‌تنهایی اجازه اجرا نیست.`
          : !sameTarget || !sameEvidence
            ? "مقصد یا نتیجه بررسی تغییر کرده است؛ پیشنهاد تازه دریافت کنید."
            : expired
              ? "مهلت تأیید گذشته است؛ پیشنهاد تازه، تصمیم تازه می‌خواهد."
              : "";
  useEffect(() => {
    const deadlines = [
        savedEvidence.collectedAt + 900_001,
        ...(actionExpiresAt === null ? [] : [actionExpiresAt + 1]),
      ],
      timers = deadlines
        .filter((deadline) => deadline > Date.now())
        .map((deadline) => setTimeout(() => setClock(Date.now()), deadline - Date.now()));
    return () => timers.forEach(clearTimeout);
  }, [savedEvidence.collectedAt, actionExpiresAt]);
  useEffect(() => {
    if (error && active) errorBox.current?.focus();
    else if (!busy && focusResult.current && active) {
      focusResult.current = false;
      title.current?.focus();
    }
  }, [error, busy, active]);
  useEffect(
    () => () => {
      pending.current?.abort();
      pending.current = null;
      onBusyChange(false);
    },
    [onBusyChange],
  );
  useEffect(() => {
    if (!active || !actionId || action?.state !== "executing") return;
    let stopped = false,
      count = 0,
      timer: ReturnType<typeof setTimeout>;
    const read = async () => {
      try {
        await onRefresh();
      } catch (error: unknown) {
        if (!stopped && error instanceof ClientError && error.code === "AUTH_REQUIRED")
          onSessionExpired();
      }
      if (!stopped && ++count < 80) timer = setTimeout(read, 1500);
    };
    timer = setTimeout(read, 1500);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [active, actionId, action?.state, onRefresh, onSessionExpired]);

  async function job(operation: Job) {
    if (blocked || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(operation);
    onBusyChange(true);
    setError(null);
    setNotice("");
    if (operation === "execute" && action) setWaitingForReceipt(action.id);
    try {
      if (operation === "refresh") {
        const saved = await onRefresh();
        if (saved.actions.some((row) => row.id === waitingForReceipt && row.state !== "approved"))
          setWaitingForReceipt(null);
      } else {
        const result = await api(
          operation === "propose"
            ? "/api/actions/restart"
            : `/api/actions/${action?.id}/${operation === "approve" || operation === "reject" ? "decision" : operation}`,
          decode,
          {
            body:
              operation === "propose"
                ? { incidentRunId: run.id }
                : operation === "approve" || operation === "reject"
                  ? { hash: action?.hash, decision: operation }
                  : {},
            csrf: workspace.session.csrfToken,
            signal: controller.signal,
          },
        );
        if (!controller.signal.aborted) {
          onAction(result);
          if (operation === "execute") setWaitingForReceipt(null);
        }
      }
      if (controller.signal.aborted) return;
      focusResult.current = true;
      setNotice(
        operation === "approve"
          ? "تأیید ثبت شد؛ هنوز درخواستی به لیارا ارسال نشده است."
          : operation === "reject"
            ? "پیشنهاد رد شد؛ درخواستی ارسال نشد."
            : operation === "execute"
              ? "لیارا درخواست را پذیرفت. پاسخ همان صفحه را جدا بررسی کنید."
              : operation === "observe"
                ? "نتیجه تازه صفحه ذخیره شد؛ درخواست راه‌اندازی دوباره تکرار نشد."
                : "",
      );
    } catch (cause: unknown) {
      if (pending.current !== controller) return;
      if (cause instanceof ClientError && cause.code === "AUTH_REQUIRED") {
        onSessionExpired();
        return;
      }
      if (operation === "execute" || controller.signal.aborted) {
        try {
          const saved = await onRefresh();
          if (saved.actions.some((row) => row.id === action?.id && row.state !== "approved"))
            setWaitingForReceipt(null);
        } catch (refreshError: unknown) {
          if (refreshError instanceof ClientError && refreshError.code === "AUTH_REQUIRED") {
            onSessionExpired();
            return;
          }
        }
      }
      if (
        operation === "execute" &&
        cause instanceof ClientError &&
        [
          "MUTATIONS_DISABLED",
          "RESTART_TARGET_CHANGED",
          "RESTART_RELEASE_CHANGED",
          "INCIDENT_CHANGED",
          "RESTART_EVIDENCE_REQUIRED",
          "APPROVAL_EXPIRED",
          "APPROVAL_SESSION",
        ].includes(cause.code)
      )
        setWaitingForReceipt(null);
      if (controller.signal.aborted) {
        setNotice(
          operation === "execute"
            ? "انتظار متوقف شد. ممکن است درخواست ارسال شده باشد؛ وضعیت ذخیره‌شده را بخوانید و دوباره ارسال نکنید."
            : "انتظار متوقف شد؛ نتیجه قبلی حفظ شده است.",
        );
        focusResult.current = true;
      } else
        setError(
          cause instanceof ClientError
            ? cause
            : new ClientError(
                "RESTART_CONNECTION_FAILED",
                "پاسخ دریافت نشد. وضعیت ذخیره‌شده را بازخوانی کنید؛ برای اجرای دوباره پیشنهاد نسازید.",
              ),
        );
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setBusy(null);
        onBusyChange(false);
      }
    }
  }
  function decide(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (consent && canExecute) void job("approve");
  }
  const observed = action?.restart?.observation;
  return (
    <section className="panel restart-panel" aria-labelledby={`${id}-title`}>
      <div className="section-heading">
        <h2 id={`${id}-title`} tabIndex={-1} ref={title}>
          راه‌اندازی دوباره برنامه
        </h2>
        <span
          className={`badge ${action?.state === "uncertain" || action?.state === "failed" ? "badge-warning" : "badge-quiet"}`}
        >
          {stateText}
        </span>
      </div>
      <p>
        راه‌اندازی دوباره ممکن است دسترسی سایت را موقتاً قطع کند. خطای کد یا تنظیمات ناقص را اصلاح
        نمی‌کند؛ فقط با تصمیم شما انجام می‌شود.
      </p>
      {spec ? (
        <dl className="action-facts restart-facts">
          <div>
            <dt>برنامه و تیم</dt>
            <dd>
              <bdi>{spec.scope.app}</bdi> / {sameTarget ? connection?.teamName : "تیم همین گزارش"}
            </dd>
          </div>
          <div>
            <dt>صفحه‌ای که دوباره بررسی می‌شود</dt>
            <dd>
              <bdi translate="no">
                {spec.target.origin}
                {spec.target.path}
              </bdi>
            </dd>
          </div>
          <div>
            <dt>اثر تغییر</dt>
            <dd>درخواست راه‌اندازی دوباره نسخه فعلی؛ بدون انتشار فایل یا تغییر تنظیمات و پلن</dd>
          </div>
          <div>
            <dt>هزینه</dt>
            <dd>هزینه این درخواست از لیارا تأیید نشده است؛ منابع بزرگ‌تر خریداری نمی‌شوند.</dd>
          </div>
        </dl>
      ) : null}
      {spec && spec.incidentRunId !== run.id ? (
        <p className="note">
          این درخواست به بررسی قبلی همین برنامه مربوط است. نتیجه همان صفحه بالا را بخوانید تا وضعیت
          اقدام قبلی روشن شود.
        </p>
      ) : null}
      {action?.restart ? (
        <div className="note">
          <p>
            {action.restart.acceptedAt !== null ? (
              <>
                پذیرش درخواست در{" "}
                <time dateTime={new Date(action.restart.acceptedAt).toISOString()}>
                  {date(action.restart.acceptedAt)}
                </time>{" "}
                ثبت شد.
              </>
            ) : action.state === "uncertain" ? (
              "پاسخ قطعی پذیرش نداریم؛ پاسخ موفق سایت این ابهام را رفع نمی‌کند. ارسال دوباره بسته است."
            ) : (
              "هنوز رسید پذیرش درخواست ثبت نشده است."
            )}
          </p>
          {observed ? (
            <p>
              {observed.outcome === "responding"
                ? "همان صفحه با همان نسخه پاسخ موفق داد."
                : observed.outcome === "unhealthy"
                  ? "همان صفحه هنوز پاسخ موفق نمی‌دهد؛ علت اصلی را با شواهد بررسی کنید."
                  : observed.outcome === "changed"
                    ? "نسخه برنامه تغییر کرده است؛ نتیجه به درخواست قبلی نسبت داده نمی‌شود."
                    : observed.outcome === "not_started"
                      ? "ثبت مراحل نشان می‌دهد درخواست این اقدام شروع نشده بود؛ ارسال تازه تأیید تازه می‌خواهد."
                      : "پاسخ قابل اتکا برای صفحه نداریم. اتصال و وضعیت برنامه را بررسی و فقط نتیجه را دوباره بخوانید."}
              {observed.status !== null ? (
                <>
                  {" "}
                  پاسخ <bdi>{observed.status}</bdi>.
                </>
              ) : null}{" "}
              <time dateTime={new Date(observed.checkedAt).toISOString()}>
                {date(observed.checkedAt)}
              </time>
            </p>
          ) : null}
          <p className="hint">
            این بررسی پایان واقعی راه‌اندازی دوباره یا سلامت همه سایت را اثبات نمی‌کند. برای بررسی
            وضعیت اجرای برنامه،{" "}
            <a href="https://console.liara.ir/" target="_blank" rel="noreferrer">
              پنل لیارا
            </a>{" "}
            را باز کنید.
          </p>
        </div>
      ) : null}
      {help ? (
        <div id={`${id}-help`} className="note">
          <p>{help}</p>
          {!sameApp ? (
            <button
              type="button"
              className="button-secondary"
              disabled={blocked}
              onClick={onConnect}
            >
              انتخاب حساب و برنامه
            </button>
          ) : conflict ? (
            <a href="?view=publish">بررسی نتیجه انتشار قبلی</a>
          ) : !eligible ? (
            <button
              type="button"
              className="button-secondary"
              disabled={blocked || !workspace.features.serviceReads}
              onClick={onRecheck}
            >
              بررسی دوباره همین مشکل
            </button>
          ) : !workspace.features.deployment ? (
            <button
              type="button"
              className="button-secondary"
              disabled={blocked}
              onClick={() => void job("refresh")}
            >
              بازخوانی وضعیت دسترسی
            </button>
          ) : null}
        </div>
      ) : null}
      {waitingForReceipt === action?.id && !busy ? (
        <div className="note">
          <p>
            پاسخ درخواست قبلی هنوز روشن نیست. وضعیت ذخیره‌شده را بخوانید؛ دکمه اجرا تا دریافت وضعیت
            معتبر بسته است.
          </p>
          <button
            type="button"
            className="button-secondary"
            disabled={blocked}
            onClick={() => void job("refresh")}
          >
            بازخوانی وضعیت درخواست قبلی
          </button>
        </div>
      ) : null}
      {action?.state === "awaiting_approval" && !expired ? (
        <form onSubmit={decide}>
          <label className="radio-option">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsentFor(event.target.checked ? action.id : null)}
              disabled={blocked || !canExecute}
              required
            />
            وقفه احتمالی را می‌پذیرم و راه‌اندازی دوباره همین برنامه را تأیید می‌کنم.
          </label>
          <div className="button-row">
            <button
              type="submit"
              disabled={blocked || !canExecute || !consent}
              aria-describedby={`${id}-decision-help`}
            >
              ثبت تأیید راه‌اندازی دوباره
            </button>
            <button
              type="button"
              className="button-secondary"
              disabled={blocked || !sameTarget}
              onClick={() => void job("reject")}
            >
              رد پیشنهاد
            </button>
          </div>
          <p className="hint" id={`${id}-decision-help`}>
            برای ثبت تأیید، پذیرش وقفه را علامت بزنید. ثبت تأیید هنوز درخواست را اجرا نمی‌کند.
          </p>
        </form>
      ) : null}
      {action?.state === "approved" && !expired ? (
        <button
          type="button"
          disabled={blocked || !canExecute}
          aria-describedby={help ? `${id}-help` : undefined}
          onClick={() => void job("execute")}
        >
          اجرای راه‌اندازی دوباره
        </button>
      ) : null}
      {action && canReadRestartResult(action) ? (
        <button
          type="button"
          disabled={blocked || !sameTarget || !workspace.features.serviceReads}
          aria-describedby={!sameTarget && help ? `${id}-help` : undefined}
          onClick={() => void job("observe")}
        >
          بررسی پاسخ همان صفحه
        </button>
      ) : null}
      {action?.state === "executing" ? (
        <button
          type="button"
          className="button-secondary"
          disabled={blocked}
          onClick={() => void job("refresh")}
        >
          بازخوانی وضعیت درخواست
        </button>
      ) : null}
      {!action ||
      expired ||
      ["cancelled", "expired", "failed", "succeeded"].includes(action.state) ||
      (!sameEvidence && !unresolved(action)) ? (
        <div className="button-row">
          <button
            type="button"
            className="button-secondary"
            disabled={blocked || !canPrepare}
            aria-describedby={help ? `${id}-help` : undefined}
            onClick={() => void job("propose")}
          >
            {action ? "دریافت پیشنهاد تازه" : "بررسی پیشنهاد راه‌اندازی دوباره"}
          </button>
        </div>
      ) : null}
      {busy ? (
        <div className="note">
          <p role="status">
            {busy === "execute"
              ? "در انتظار پاسخ لیارا به درخواست…"
              : busy === "observe"
                ? "در حال خواندن پاسخ همان صفحه…"
                : "در حال ثبت و بررسی درخواست…"}
          </p>
          <button
            type="button"
            className="button-secondary"
            onClick={() => pending.current?.abort()}
          >
            توقف انتظار
          </button>
          {busy === "execute" ? (
            <p className="hint">
              توقف انتظار، درخواست ارسال‌شده را برنمی‌گرداند و اجازه ارسال دوباره نمی‌دهد.
            </p>
          ) : null}
        </div>
      ) : null}
      <div role="status" aria-live="polite" className="live-message compact-status">
        {notice}
      </div>
      {error ? (
        <div className="error-banner" role="alert" tabIndex={-1} ref={errorBox}>
          <p>{error.message}</p>
          <button
            type="button"
            className="button-secondary"
            disabled={blocked}
            onClick={() => void job("refresh")}
          >
            بازخوانی وضعیت ذخیره‌شده
          </button>
          {error.requestId ? (
            <details>
              <summary>شناسه پیگیری</summary>
              <code>{error.requestId}</code>
            </details>
          ) : null}
        </div>
      ) : null}
      {spec && action ? (
        <details>
          <summary>جزئیات نسخه و تأیید</summary>
          <p>
            نسخه فعلی: <bdi translate="no">{spec.targetReleaseId}</bdi>
          </p>
          <p>
            مهلت تأیید:{" "}
            <time dateTime={new Date(action.expiresAt).toISOString()}>
              {date(action.expiresAt)}
            </time>
          </p>
          <p className="hint">
            تأیید به همین حساب، برنامه، نسخه و گزارش مشکل مربوط است و فقط یک بار مصرف می‌شود.
          </p>
        </details>
      ) : null}
    </section>
  );
}
