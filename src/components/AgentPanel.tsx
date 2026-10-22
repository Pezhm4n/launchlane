"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { parseAgentView, type AgentView } from "../contracts/agent.ts";
import { object } from "../contracts/validation.ts";
import { api, ClientError } from "./api.ts";

function decodeRun(value: unknown): AgentView | null {
  const row = object(value);
  return row.run === null ? null : parseAgentView(row.run);
}
const stateLabels: Readonly<Record<AgentView["state"], string>> = {
  queued: "درخواست ثبت شد",
  working: "در حال بررسی",
  needs_input: "منتظر پاسخ شما",
  needs_approval: "منتظر تصمیم شما",
  partially_completed: "بررسی اولیه آماده است",
  failed: "بررسی کامل نشد",
  cancelled: "بررسی متوقف شد",
  interrupted: "بررسی قبلی قطع شد",
};

export function AgentPanel({
  projectId,
  projectName,
  csrf,
  enabled,
  disabled,
  activeView,
  onAccounts,
  onChooseProject,
  onGitHub,
  onReview,
  onExpired,
  onProjectChanged,
}: {
  projectId: string | null;
  projectName: string | null;
  csrf: string;
  enabled: boolean;
  disabled: boolean;
  activeView: boolean;
  onAccounts: (trigger: HTMLButtonElement) => void;
  onChooseProject: (trigger: HTMLButtonElement) => void;
  onGitHub: (trigger: HTMLButtonElement) => void;
  onReview: () => void;
  onExpired: () => void;
  onProjectChanged: (projectId: string) => Promise<void>;
}) {
  const [run, setRun] = useState<AgentView | null>(null),
    [draft, setDraft] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<ClientError | null>(null),
    [restoring, setRestoring] = useState(true),
    [hasNew, setHasNew] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null),
    transcript = useRef<HTMLElement>(null),
    latest = useRef<AgentView | null>(null),
    pending = useRef<AbortController | null>(null),
    submission = useRef<{ key: string; message: string; runId: string | null } | null>(null);
  const syncedProject = useRef<string | null>(null);
  const active = run?.state === "queued" || run?.state === "working",
    sameProject = !run || run.projectId === projectId;
  const runId = run?.id;
  const accept = useCallback((value: AgentView | null) => {
    if (value && latest.current?.id === value.id && value.revision < latest.current.revision)
      return;
    if (value && value.events.length > (latest.current?.events.length ?? 0)) setHasNew(true);
    latest.current = value;
    setRun(value);
  }, []);
  const failed = useCallback(
    (cause: unknown) => {
      if (cause instanceof ClientError && cause.code === "AUTH_REQUIRED") {
        onExpired();
        return;
      }
      setError(
        cause instanceof ClientError
          ? cause
          : new ClientError(
              "CONNECTION_FAILED",
              "ارتباط با برنامه کامل نشد. نتیجه‌های ثبت‌شده حفظ شده‌اند؛ وضعیت را دوباره دریافت کنید.",
            ),
      );
    },
    [onExpired],
  );
  useEffect(() => {
    const controller = new AbortController();
    api("/api/agent/runs", decodeRun, { signal: controller.signal })
      .then(accept)
      .catch((cause) => {
        if (!controller.signal.aborted) failed(cause);
      })
      .finally(() => {
        if (!controller.signal.aborted) setRestoring(false);
      });
    return () => controller.abort();
  }, [accept, failed]);
  useEffect(() => {
    if (!active || !runId || !activeView) return;
    const controller = new AbortController();
    let inFlight = false;
    const timer = window.setInterval(() => {
      if (inFlight) return;
      inFlight = true;
      api(`/api/agent/runs/${runId}`, decodeRun, { signal: controller.signal })
        .then(accept)
        .catch((cause) => {
          if (!controller.signal.aborted) failed(cause);
        })
        .finally(() => {
          inFlight = false;
        });
    }, 1000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [runId, active, activeView, accept, failed]);
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => {
    // A restored receipt must not override a project the user selected after that repair.
    if (
      run?.repair?.state !== "succeeded" ||
      run.repair.projectId !== projectId ||
      !run.projectId ||
      run.projectId === projectId ||
      syncedProject.current === run.projectId
    )
      return;
    syncedProject.current = run.projectId;
    onProjectChanged(run.projectId).catch((cause) => {
      syncedProject.current = null;
      failed(cause);
    });
  }, [run, projectId, onProjectChanged, failed]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = draft.trim();
    if (!message) {
      setError(new ClientError("EMPTY_GOAL", "کاری را که می‌خواهید برای پروژه انجام شود بنویسید."));
      input.current?.focus();
      return;
    }
    if (busy || active || restoring || disabled || !enabled || run?.state === "needs_approval")
      return;
    const continueRun =
      run && sameProject && (run.state === "needs_input" || run.state === "partially_completed")
        ? run
        : null;
    const previous = submission.current;
    const request =
      previous?.message === message && previous.runId === (continueRun?.id ?? null)
        ? previous
        : { key: crypto.randomUUID(), message, runId: continueRun?.id ?? null };
    submission.current = request;
    setBusy(true);
    setError(null);
    const controller = new AbortController();
    pending.current = controller;
    try {
      const result = await api(
        continueRun ? `/api/agent/runs/${continueRun.id}` : "/api/agent/runs",
        decodeRun,
        {
          csrf,
          signal: controller.signal,
          body: continueRun
            ? {
                operation: "message",
                revision: continueRun.revision,
                requestKey: request.key,
                message,
              }
            : { requestKey: request.key, goal: message, projectId },
        },
      );
      accept(result);
      setDraft("");
      submission.current = null;
    } catch (cause) {
      if (!controller.signal.aborted) failed(cause);
    } finally {
      setBusy(false);
      pending.current = null;
    }
  }
  async function refresh() {
    setError(null);
    try {
      accept(await api(run ? `/api/agent/runs/${run.id}` : "/api/agent/runs", decodeRun));
    } catch (cause) {
      failed(cause);
    }
  }
  async function cancel() {
    if (!run || busy) return;
    setBusy(true);
    setError(null);
    try {
      let current = await api(`/api/agent/runs/${run.id}`, decodeRun);
      for (let attempt = 0; current && attempt < 2; attempt++) {
        try {
          accept(
            await api(`/api/agent/runs/${run.id}`, decodeRun, {
              csrf,
              body: { operation: "cancel", revision: current.revision },
            }),
          );
          break;
        } catch (cause) {
          if (!(cause instanceof ClientError) || cause.code !== "AGENT_CONFLICT" || attempt === 1)
            throw cause;
          current = await api(`/api/agent/runs/${run.id}`, decodeRun);
          if (current?.state !== "working" && current?.state !== "queued") {
            accept(current);
            break;
          }
        }
      }
    } catch (cause) {
      failed(cause);
    } finally {
      setBusy(false);
    }
  }
  async function decideRepair(decision: "approve" | "reject") {
    if (!run?.repair || busy || disabled) return;
    setBusy(true);
    setError(null);
    try {
      accept(
        await api(`/api/agent/runs/${run.id}`, decodeRun, {
          csrf,
          body: {
            operation: "repair-decision",
            revision: run.revision,
            jobId: run.repair.id,
            decision,
          },
        }),
      );
    } catch (cause) {
      failed(cause);
    } finally {
      setBusy(false);
    }
  }
  const messages =
    run?.events.filter((event) => event.kind === "user" || event.kind === "assistant") ?? [];
  const action = run?.nextAction;
  return (
    <section className="panel agent-panel" aria-labelledby="agent-title" aria-busy={busy || active}>
      <div className="section-heading">
        <h2 id="agent-title">چه کاری برای پروژه‌تان انجام بدهم؟</h2>
        {run ? <span className="badge badge-quiet">{stateLabels[run.state]}</span> : null}
      </div>
      {run && !active && run.state !== "needs_approval" ? (
        <button
          type="button"
          className="button-quiet"
          disabled={disabled || busy}
          onClick={() => {
            accept(null);
            setError(null);
            submission.current = null;
            input.current?.focus();
          }}
        >
          گفت‌وگوی تازه
        </button>
      ) : null}
      <p className="hint agent-project-name">
        {projectName ? (
          <>
            پروژه: <bdi>{projectName}</bdi>
          </>
        ) : (
          "پروژه را انتخاب کنید و بگویید چه کاری لازم دارید."
        )}
      </p>
      <div className="button-row agent-project-actions">
        <button
          type="button"
          className="button-secondary"
          disabled={disabled || busy || active}
          onClick={(event) => onChooseProject(event.currentTarget)}
        >
          {projectName ? "تغییر پروژه" : "انتخاب پروژه"}
        </button>
        <button
          type="button"
          className="button-quiet"
          disabled={disabled || busy || active}
          onClick={(event) => onGitHub(event.currentTarget)}
        >
          انتخاب از GitHub
        </button>
      </div>
      {restoring ? <p role="status">در حال بازیابی گفت‌وگو…</p> : null}
      {run ? (
        <>
          <p className="agent-effect">تغییری در سایت منتشر نشده است.</p>
          {!sameProject ? (
            <p className="note">
              این گفت‌وگو برای پروژه قبلی است. پیام بعدی، بررسی تازه‌ای برای پروژه انتخاب‌شده آغاز
              می‌کند.
            </p>
          ) : null}
          <section
            ref={transcript}
            className="agent-transcript"
            aria-label="گفت‌وگوی پروژه"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users must reach this independently scrolling transcript.
            tabIndex={0}
          >
            {messages.map((event) => (
              <article
                key={event.sequence}
                className={event.kind === "user" ? "agent-user" : "agent-answer"}
              >
                <h3>{event.kind === "user" ? "درخواست شما" : "جمع‌بندی دستیار"}</h3>
                <p dir="auto">{event.message}</p>
              </article>
            ))}
          </section>
          {hasNew ? (
            <button
              type="button"
              className="button-quiet"
              onClick={() => {
                transcript.current?.scrollTo({
                  top: transcript.current.scrollHeight,
                  behavior: "instant",
                });
                transcript.current?.focus({ preventScroll: true });
                setHasNew(false);
              }}
            >
              رفتن به پیام تازه
            </button>
          ) : null}
          <p role="status" aria-live="polite" aria-atomic="true">
            {active
              ? run.events
                  .filter((event) => event.kind === "activity" || event.kind === "tool")
                  .at(-1)?.message
              : stateLabels[run.state]}
          </p>
          {run.question && sameProject ? <p className="note">{run.question}</p> : null}
          {run.repair ? (
            <section className="agent-repair" aria-labelledby="repair-title">
              <h3 id="repair-title">اصلاح نسخه جدا از پروژه</h3>
              <details open={run.state === "needs_approval"}>
                <summary>جزئیات اصلاح و رسید آزمون</summary>
                <p>{run.repair.goal}</p>
                <p className="hint">فقط این فایل‌ها قابل تغییرند:</p>
                <ul>
                  {run.repair.allowedPaths.map((path) => (
                    <li key={path}>
                      <bdi>{path}</bdi>
                    </li>
                  ))}
                </ul>
                <p className="hint">همین آزمون موجود، پیش و پس از اصلاح اجرا می‌شود:</p>
                <code dir="ltr">node --test {run.repair.testFiles.join(" ")}</code>
                <p className="hint">
                  فرمان در نسخه جدا با دسترسی محدود Node اجرا می‌شود. پوشه اصلی تغییر نمی‌کند. این
                  اجرا محیط مجازی با شبکه جدا نیست.
                </p>
                {run.repair.diff ? (
                  <pre dir="ltr">
                    <code>{run.repair.diff}</code>
                  </pre>
                ) : null}
                {run.repair.beforeTest ? (
                  <pre dir="ltr">
                    {run.repair.afterTest?.output ?? run.repair.beforeTest.output}
                  </pre>
                ) : null}
              </details>
              {run.state === "needs_approval" ? (
                <>
                  <p>
                    این تصمیم فقط اصلاح محلی و اجرای آزمون بالا را مجاز می‌کند. انتشار نیاز به تصمیم
                    جدا دارد.
                  </p>
                  <div className="button-row">
                    <button
                      type="button"
                      disabled={disabled || busy || !sameProject}
                      onClick={() => void decideRepair("approve")}
                    >
                      تأیید اصلاح و اجرای آزمون
                    </button>
                    <button
                      type="button"
                      className="button-secondary"
                      disabled={disabled || busy}
                      onClick={() => void decideRepair("reject")}
                    >
                      رد اصلاح
                    </button>
                  </div>
                </>
              ) : (
                <p role="status">{run.repair.message}</p>
              )}
              {run.repair.beforeTest || run.repair.afterTest ? (
                <dl className="profile-facts">
                  <div>
                    <dt>آزمون پیش از اصلاح</dt>
                    <dd>
                      {run.repair.beforeTest
                        ? run.repair.beforeTest.passed
                          ? "گذشت"
                          : "نگذشت"
                        : "اجرا نشده"}
                    </dd>
                  </div>
                  <div>
                    <dt>آزمون پس از اصلاح</dt>
                    <dd>
                      {run.repair.afterTest
                        ? run.repair.afterTest.passed
                          ? "گذشت"
                          : "نگذشت"
                        : "اجرا نشده"}
                    </dd>
                  </div>
                </dl>
              ) : null}
            </section>
          ) : null}
          {sameProject && action && action !== "reply" ? (
            <div className="button-row">
              <button
                type="button"
                disabled={disabled || busy || active}
                onClick={(event) => {
                  if (action === "connect_account" || action === "select_app")
                    onAccounts(event.currentTarget);
                  else if (action === "choose_project") onChooseProject(event.currentTarget);
                  else onReview();
                }}
              >
                {action === "connect_account"
                  ? "اتصال حساب"
                  : action === "select_app"
                    ? "انتخاب برنامه مقصد"
                    : action === "choose_project"
                      ? "انتخاب پروژه"
                      : "دیدن بررسی پروژه و ادامه انتشار"}
              </button>
            </div>
          ) : null}
          <details>
            <summary>مراحل بررسی</summary>
            <ol className="agent-events">
              {run.events
                .filter((event) => event.kind !== "user" && event.kind !== "assistant")
                .map((event) => (
                  <li key={event.sequence}>
                    <p>{event.message}</p>
                  </li>
                ))}
            </ol>
          </details>
        </>
      ) : null}
      {error ? (
        <div role="alert" className="note note-danger">
          <p>{error.message}</p>
          <button type="button" className="button-quiet" onClick={() => void refresh()}>
            دریافت وضعیت ثبت‌شده
          </button>
        </div>
      ) : null}
      <form onSubmit={(event) => void submit(event)}>
        <label htmlFor="agent-goal">{run && sameProject ? "پیام بعدی" : "هدف شما"}</label>
        <textarea
          ref={input}
          id="agent-goal"
          name="goal"
          autoComplete="off"
          dir="auto"
          maxLength={2000}
          placeholder="مثلاً این پروژه را برای انتشار بررسی کن…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={disabled || busy || active || run?.state === "needs_approval" || !enabled}
          aria-describedby="agent-help"
          aria-invalid={error?.code === "EMPTY_GOAL" || undefined}
        />
        <p id="agent-help" className="hint">
          مقدار محرمانه را در پیام ننویسید. این بررسی فایل‌ها و وضعیت مجاز را می‌خواند؛ تصمیم انتشار
          در مرحله جدا دریافت می‌شود.
        </p>
        <div className="button-row">
          <button
            type="submit"
            disabled={
              disabled || busy || restoring || active || run?.state === "needs_approval" || !enabled
            }
          >
            {busy ? "در حال ثبت…" : "ارسال درخواست"}
          </button>
          {active ? (
            <button
              type="button"
              className="button-secondary"
              disabled={busy || disabled}
              onClick={() => void cancel()}
            >
              توقف بررسی
            </button>
          ) : null}
        </div>
        {!enabled ? (
          <p className="note">
            دستیار در این نصب فعال نیست. مسئول نصب می‌تواند دسترسی آن را تنظیم کند؛ انتخاب پروژه و تب
            انتشار دستی در دسترس‌اند.
          </p>
        ) : null}
      </form>
    </section>
  );
}
