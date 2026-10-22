"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { parseAgentView, type AgentView } from "../contracts/agent.ts";
import { object } from "../contracts/validation.ts";
import { api, ClientError } from "./api.ts";
import { AgentPublication } from "./AgentPublication.tsx";
import { AgentDestination } from "./AgentDestination.tsx";
import { RichText } from "./RichText.tsx";

function decodeRun(value: unknown): AgentView | null {
  const row = object(value);
  return row.run === null ? null : parseAgentView(row.run);
}
function CopyMessage({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );
  async function copy() {
    if (timer.current !== null) window.clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    timer.current = window.setTimeout(() => setState("idle"), 1800);
  }
  return (
    <button
      type="button"
      className="button-quiet agent-message-copy"
      onClick={() => void copy()}
    >
      {state === "copied" ? "کپی شد" : state === "failed" ? "کپی نشد" : "کپی پاسخ"}
    </button>
  );
}
function messageTime(at: number) {
  if (!at) return null;
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return null;
  const sameDay = date.toDateString() === new Date().toDateString();
  return {
    label: new Intl.DateTimeFormat(
      "fa-IR",
      sameDay
        ? { hour: "2-digit", minute: "2-digit" }
        : { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" },
    ).format(date),
    iso: date.toISOString(),
  };
}
function formatElapsed(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  const number = new Intl.NumberFormat("fa-IR");
  return minutes > 0
    ? `${number.format(minutes)} دقیقه و ${number.format(rest)} ثانیه`
    : `${number.format(seconds)} ثانیه`;
}
function summarize(message: string) {
  const clean = message.replace(/\s+/g, " ").trim();
  return clean.length <= 420 ? clean : `${clean.slice(0, 420)}… ادامه پاسخ در گفتگو آماده است.`;
}
const stateLabels: Readonly<Record<AgentView["state"], string>> = {
  queued: "درخواست ثبت شد",
  working: "در حال بررسی",
  needs_input: "منتظر پاسخ شما",
  needs_approval: "منتظر تصمیم شما",
  partially_completed: "بررسی اولیه آماده است",
  completed: "نتیجه بررسی و تأیید شد",
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
  onManualPublish,
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
  onManualPublish: () => void;
  onExpired: () => void;
  onProjectChanged: (projectId: string) => Promise<void>;
}) {
  const [run, setRun] = useState<AgentView | null>(null),
    [draft, setDraft] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<ClientError | null>(null),
    [restoring, setRestoring] = useState(true),
    [newCount, setNewCount] = useState(0),
    [announcement, setAnnouncement] = useState(""),
    [now, setNow] = useState(() => Date.now()),
    [retryable, setRetryable] = useState<{ message: string; projectId: string | null } | null>(
      null,
    );
  const input = useRef<HTMLTextAreaElement>(null),
    transcript = useRef<HTMLElement>(null),
    latest = useRef<AgentView | null>(null),
    pending = useRef<AbortController | null>(null),
    submission = useRef<{ key: string; message: string; runId: string | null } | null>(null),
    following = useRef(true),
    seen = useRef({ runId: null as string | null, messages: 0 }),
    wasActive = useRef(false),
    draftLoaded = useRef<string | null>(null),
    draftSkipSave = useRef(false),
    draftValue = useRef("");
  const syncedProject = useRef<string | null>(null);
  const draftKey = `launchlane:agent:draft:${projectId ?? "none"}`,
    emptyProjectKey = "launchlane:agent:draft:none";
  const active = run?.state === "queued" || run?.state === "working",
    sameProject = !run || run.projectId === projectId;
  const runId = run?.id;
  const accept = useCallback((value: AgentView | null) => {
    if (value && latest.current?.id === value.id && value.revision < latest.current.revision)
      return;
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
    const node = transcript.current;
    if (!node || !run) return;
    const messagesNow = run.events.filter(
      (event) => event.kind === "user" || event.kind === "assistant",
    ).length;
    if (seen.current.runId !== run.id) {
      seen.current = { runId: run.id, messages: messagesNow };
      following.current = true;
      setNewCount(0);
      node.scrollTop = node.scrollHeight;
      return;
    }
    const added = Math.max(0, messagesNow - seen.current.messages);
    seen.current = { runId: run.id, messages: messagesNow };
    if (following.current) {
      setNewCount(0);
      node.scrollTop = node.scrollHeight;
    } else if (added > 0) {
      setNewCount((count) => count + added);
    }
  }, [run]);
  useEffect(() => {
    const isActive = run?.state === "queued" || run?.state === "working";
    if (isActive && !wasActive.current) setAnnouncement("");
    if (wasActive.current && !isActive && run) {
      const answer = run.events.filter((event) => event.kind === "assistant").at(-1)?.message;
      const message = run.state === "needs_input" && run.question ? run.question : answer;
      setAnnouncement(message ? summarize(message) : stateLabels[run.state]);
    }
    wasActive.current = isActive;
  }, [run]);
  useEffect(() => {
    const carried = draftValue.current,
      carry = draftLoaded.current === emptyProjectKey && carried.trim().length > 0;
    draftSkipSave.current = true;
    draftLoaded.current = draftKey;
    if (carry) {
      try {
        window.sessionStorage.setItem(draftKey, carried);
      } catch {
        // The current draft stays in memory when storage is unavailable.
      }
      return;
    }
    try {
      setDraft(window.sessionStorage.getItem(draftKey) ?? "");
    } catch {
      setDraft("");
    }
  }, [draftKey]);
  useEffect(() => {
    draftValue.current = draft;
    if (draftSkipSave.current) {
      draftSkipSave.current = false;
      return;
    }
    if (draftLoaded.current !== draftKey) return;
    try {
      window.sessionStorage.setItem(draftKey, draft);
    } catch {
      // Draft persistence is a convenience; the form still works without storage.
    }
  }, [draft, draftKey]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the measured field height changes with its value and disabled state.
  useEffect(() => {
    const node = input.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 160)}px`;
  }, [draft, enabled]);
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
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
    await send(message);
  }
  async function send(message: string) {
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
    setRetryable(null);
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
      if (!controller.signal.aborted) {
        const expired = cause instanceof ClientError && cause.code === "AUTH_REQUIRED";
        // Only the initial idempotent registration may be replayed automatically. Continuing a run
        // or deciding a publication requires a status read or a new explicit decision.
        const replaySafe = !(cause instanceof ClientError) || cause.retryable;
        if (!continueRun && !expired && replaySafe) setRetryable({ message, projectId });
        failed(cause);
      }
    } finally {
      setBusy(false);
      pending.current = null;
    }
  }
  async function refresh() {
    setRetryable(null);
    setError(null);
    try {
      const value = await api(run ? `/api/agent/runs/${run.id}` : "/api/agent/runs", decodeRun);
      accept(value);
      if (value) submission.current = null;
    } catch (cause) {
      failed(cause);
    }
  }
  async function cancel() {
    if (!run || busy) return;
    setRetryable(null);
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
    setRetryable(null);
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
  async function publicationRequest(decision?: "approve" | "reject") {
    if (!run?.publication || busy || disabled) return;
    setRetryable(null);
    setBusy(true);
    setError(null);
    try {
      accept(await api(`/api/agent/runs/${run.id}`, decodeRun, { csrf,
        body: decision ? { operation: "publication-decision", revision: run.revision, actionId: run.publication.id, decision }
          : { operation: "publication-observe", revision: run.revision },
      }));
    } catch (cause) { failed(cause); }
    finally { setBusy(false); }
  }
  async function destinationRequest(decision?: "approve" | "reject") {
    if (!run?.destination || busy || disabled) return;
    setRetryable(null);
    setBusy(true);
    setError(null);
    try {
      accept(await api(`/api/agent/runs/${run.id}`, decodeRun, { csrf,
        body: decision ? { operation: "destination-decision", revision: run.revision, actionId: run.destination.id, decision }
          : { operation: "destination-observe", revision: run.revision },
      }));
    } catch (cause) { failed(cause); }
    finally { setBusy(false); }
  }
  function follow() {
    const node = transcript.current;
    if (!node) return;
    following.current = node.scrollHeight - node.scrollTop - node.clientHeight <= 48;
    if (following.current) setNewCount(0);
  }
  function goToLatest() {
    const node = transcript.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
    following.current = true;
    setNewCount(0);
    node.focus({ preventScroll: true });
  }
  const messages =
    run?.events.filter((event) => event.kind === "user" || event.kind === "assistant") ?? [];
  const progress = run?.events
    .filter((event) => event.kind === "activity" || event.kind === "tool")
    .at(-1)?.message;
  const startedAt = run?.events.find((event) => event.at > 0)?.at ?? now;
  const action = run?.nextAction;
  return (
    <section className="panel agent-panel" aria-labelledby="agent-title" aria-busy={busy || active}>
      <div className="section-heading">
        <h2 id="agent-title">چه کاری انجام بدهم؟</h2>
        {run ? <span className="badge badge-quiet">{stateLabels[run.state]}</span> : null}
      </div>
      {run && !active && run.state !== "needs_approval" ? (
        <div className="agent-new-conversation">
          <button
            type="button"
            className="button-quiet"
            disabled={disabled || busy}
            aria-describedby="agent-new-conversation-help"
            onClick={() => {
              accept(null);
              setError(null);
              setRetryable(null);
              submission.current = null;
              seen.current = { runId: null, messages: 0 };
              setNewCount(0);
              input.current?.focus();
            }}
          >
            گفت‌وگوی تازه
          </button>
          <span id="agent-new-conversation-help" className="hint">
            نمای فعلی بسته می‌شود؛ سابقه قبلی حذف نمی‌شود.
          </span>
        </div>
      ) : null}
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
      {!run && !restoring && enabled ? (
        <p className="hint agent-empty">
          {projectName
            ? "هدف را در کادر پایین بنویسید؛ مثلاً «این پروژه را بررسی کن و برای انتشار آماده کن»."
            : "برای شروع، ابتدا پروژه را انتخاب کنید؛ سپس هدف را در کادر پایین بنویسید."}
        </p>
      ) : null}
      {restoring ? <p role="status">در حال بازیابی گفت‌وگو…</p> : null}
      {!enabled ? (
        <section className="note agent-unavailable" aria-labelledby="agent-unavailable-title">
          <h3 id="agent-unavailable-title">دستیار در این نصب خاموش است</h3>
          <p>
            این وضعیت عمدی است. برای محافظت از حساب و هزینه، دستیار و عملیات واقعی به‌صورت خودکار
            روشن نمی‌شوند و این صفحه تنها وضعیت نصب را نشان می‌دهد.
          </p>
          <p>
            می‌توانید همین حالا پروژه را دستی بررسی کنید. انتشار همچنان پیشنهاد، تأیید و بررسی نتیجه
            جداگانه دارد.
          </p>
          <div className="button-row">
            <button type="button" onClick={onManualPublish} disabled={disabled || busy}>
              ادامه با انتشار دستی
            </button>
          </div>
        </section>
      ) : null}
      {run ? (
        <>
          <p className="agent-effect">{run.effect === "remote_changes_verified" ? "نسخه منتشرشده و پاسخ مورد انتظار بررسی شدند."
            : run.effect === "destination_created" ? "مقصد ساخته و تنظیمات آن تأیید شد؛ انتشار هنوز جداگانه بررسی می‌شود."
            : run.effect === "remote_changes_unverified" ? "ارسال به سرویس آغاز شده است؛ نتیجه نهایی هنوز تأیید نشده است."
            : "تغییری در سایت منتشر نشده است."}</p>
          {run.state === "failed" ? (
            <p className="note">
              این بررسی کامل نشد و نتیجه‌ای تأیید نشد. نتیجه‌های ثبت‌شده حفظ شده‌اند؛ برای ادامه،
              هدف را در کادر پایین دوباره بنویسید. درخواست تازه جدا ثبت می‌شود.
            </p>
          ) : null}
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
            role="log"
            aria-live="off"
            onScroll={follow}
            // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users must reach this independently scrolling transcript.
            tabIndex={0}
          >
            {messages.length === 0 ? (
              <p className="hint agent-empty">
                {active ? "در حال آماده‌سازی پاسخ…" : "هنوز پیامی در این گفت‌وگو نیست."}
              </p>
            ) : (
              messages.map((event) => {
                const time = messageTime(event.at);
                return (
                  <article
                    key={event.sequence}
                    className={event.kind === "user" ? "agent-user" : "agent-answer"}
                    aria-label={event.kind === "user" ? "درخواست شما" : "پاسخ دستیار"}
                  >
                    <div className="agent-message-meta">
                      <span className="agent-message-role">
                        {event.kind === "user" ? "شما" : "دستیار"}
                      </span>
                      {time ? <time dateTime={time.iso}>{time.label}</time> : null}
                      {event.kind === "assistant" ? <CopyMessage text={event.message} /> : null}
                    </div>
                    {event.kind === "user" ? (
                      <p className="agent-message-text" dir="auto">
                        {event.message}
                      </p>
                    ) : (
                      <RichText text={event.message} />
                    )}
                  </article>
                );
              })
            )}
          </section>
          {newCount > 0 ? (
            <button type="button" className="button-quiet" onClick={goToLatest}>
              {new Intl.NumberFormat("fa-IR").format(newCount)} پیام تازه
            </button>
          ) : null}
          {active ? (
            <div className="agent-progress">
              <p role="status" aria-live="polite" aria-atomic="true" className="hint">
                {progress ?? "در حال بررسی درخواست…"}
              </p>
              <span className="hint agent-elapsed" aria-hidden="true">
                {formatElapsed(now - startedAt)} از شروع بررسی
              </span>
            </div>
          ) : null}
          <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {announcement}
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
                <code dir="ltr">node --test -- {run.repair.testFiles.join(" ")}</code>
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
              {run.state === "needs_approval" && run.repair.state === "proposed" ? (
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
          {run.destination ? <AgentDestination action={run.destination} waiting={run.state === "needs_approval" && (run.destination.state === "awaiting_approval" || run.destination.state === "expired")}
            disabled={disabled || busy || active || !sameProject}
            resumable={run.destination.state === "succeeded" && !run.destinationContinued}
            onDecision={(decision) => void destinationRequest(decision)}
            onObserve={() => void destinationRequest()} /> : null}
          {run.publication ? <AgentPublication action={run.publication} waiting={run.state === "needs_approval"}
            disabled={disabled || busy || active || !sameProject}
            onDecision={(decision) => void publicationRequest(decision)}
            onObserve={() => void publicationRequest()} /> : null}
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
        <div id="agent-error" role="alert" className="note note-danger">
          <p>{error.message}</p>
          <div className="button-row">
            {retryable && retryable.projectId === projectId && !active ? (
              <button
                type="button"
                disabled={busy || disabled}
                aria-describedby="agent-retry-help"
                onClick={() => {
                  setDraft(retryable.message);
                  void send(retryable.message);
                }}
              >
                ثبت دوباره همین درخواست
              </button>
            ) : null}
            {error.code !== "EMPTY_GOAL" ? (
              <button
                type="button"
                className="button-quiet"
                disabled={busy}
                onClick={() => void refresh()}
              >
                دریافت وضعیت ثبت‌شده
              </button>
            ) : null}
          </div>
          {retryable && retryable.projectId === projectId && !active ? (
            <p id="agent-retry-help" className="hint">
              همان شناسه درخواست قبلی دوباره فرستاده می‌شود؛ اگر درخواست ثبت شده باشد، اجرای تکراری
              ساخته نمی‌شود.
            </p>
          ) : null}
        </div>
      ) : null}
      {enabled && run?.state !== "needs_approval" ? (
        <form className="agent-composer" onSubmit={(event) => void submit(event)}>
          <label htmlFor="agent-goal">{run && sameProject ? "پیام بعدی" : "هدف شما"}</label>
          <textarea
            ref={input}
            id="agent-goal"
            name="goal"
            autoComplete="off"
            dir="auto"
            rows={2}
            enterKeyHint="send"
            maxLength={2000}
            placeholder="مثلاً این پروژه را برای انتشار بررسی کن…"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key !== "Enter" ||
                event.shiftKey ||
                event.nativeEvent.isComposing ||
                active ||
                busy
              )
                return;
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }}
            disabled={disabled || busy}
            aria-describedby={[
              "agent-help",
              active ? "agent-active-help" : "",
              error ? "agent-error" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-invalid={error?.code === "EMPTY_GOAL" || undefined}
          />
          <p id="agent-help" className="hint">
            رمز یا کلید وارد نکنید · Enter ارسال · Shift+Enter خط تازه
          </p>
          {active ? (
            <p id="agent-active-help" className="hint">
              بررسی در حال اجراست؛ نوشتن آزاد است و ارسال پس از پایان ممکن می‌شود.
            </p>
          ) : null}
          <div className="button-row">
            <button
              type="submit"
              disabled={disabled || busy || restoring || active}
              aria-describedby={active ? "agent-active-help" : undefined}
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
        </form>
      ) : null}
    </section>
  );
}
