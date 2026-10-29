"use client";
import { BuildFailureNote } from "./BuildFailureNote.tsx";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { parseAgentView, type AgentView } from "../contracts/agent.ts";
import { object } from "../contracts/validation.ts";
import { api, ClientError } from "./api.ts";
import { AgentPublication } from "./AgentPublication.tsx";
import { MissionAuthorityReview } from "./MissionAuthorityReview.tsx";
import { CodingAgentSelection } from "./CodingAgentSelection.tsx";
import type { CodingAgentChoice } from "../contracts/coding-agent.ts";
import { AgentDestination } from "./AgentDestination.tsx";
import { AgentNetwork } from "./AgentNetwork.tsx";
import { AgentDisk } from "./AgentDisk.tsx";
import { AgentDatabase } from "./AgentDatabase.tsx";
import { MigrationTestReview } from "./MigrationTestReview.tsx";
import { RichText } from "./RichText.tsx";
import { FloatingAssistant } from "./FloatingAssistant.tsx";
import { ProjectEnvironment } from "./ProjectEnvironment.tsx";
import { AgentSteps } from "./AgentSteps.tsx";
import { ProjectLifecycle } from "./ProjectLifecycle.tsx";
import { ChatWelcome } from "./ChatWelcome.tsx";
import { WorkspaceGlyph } from "./WorkspaceGlyph.tsx";
import assistantStyles from "./AssistantPublication.module.css";

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
      aria-label={state === "copied" ? "کپی شد" : state === "failed" ? "کپی نشد" : "کپی پاسخ"}
      onClick={() => void copy()}
    >
      <WorkspaceGlyph name={state === "copied" ? "check" : "copy"} />
      <span className="sr-only" role="status">{state === "copied" ? "کپی شد" : state === "failed" ? "کپی نشد" : "کپی پاسخ"}</span>
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
  projectHash,
  blocked = false,
  guided = false,
  onLockChanged,
  accountReady = false,
  appSelected = false,
  chatOnly = false,
  onChatLockChanged,
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
  projectHash?: string | undefined;
  blocked?: boolean;
  guided?: boolean;
  onLockChanged?: (locked: boolean) => void;
  accountReady?: boolean;
  appSelected?: boolean;
  chatOnly?: boolean;
  onChatLockChanged?: (locked: boolean) => void;
}) {
  const [run, setRun] = useState<AgentView | null>(null),
    [draft, setDraft] = useState(""),
    [busy, setBusy] = useState(false),
    [changingPlan, setChangingPlan] = useState(false),
    [error, setError] = useState<ClientError | null>(null),
    [restoring, setRestoring] = useState(true),
    [newCount, setNewCount] = useState(0),
    [awayFromEnd, setAwayFromEnd] = useState(false),
    [announcement, setAnnouncement] = useState(""),
    [now, setNow] = useState(() => Date.now()),
    [retryable, setRetryable] = useState<{ message: string; projectId: string | null } | null>(
      null,
    );
  const [missionPath, setMissionPath] = useState("/"), [expectedText, setExpectedText] = useState("");
  const [environmentLocked, setEnvironmentLocked] = useState(false);
  const [lifecycleLocked, setLifecycleLocked] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false), [assistantPublication, setAssistantPublication] = useState(false);
  const assistantPublicationHost = useRef<HTMLDivElement>(null);
  const publicationInAssistant = guided && assistantOpen && assistantPublication;
  const [editingAgentFor, setEditingAgentFor] = useState<string | null>(null);
  const editingAgent = !!run && editingAgentFor === run.id;
  useEffect(() => {
    if (publicationInAssistant) document.getElementById("publication-agent-title")?.focus();
  }, [publicationInAssistant]);
  const missionKey = useRef<{ input: string; key: string } | null>(null);
  const resumeKey = useRef<{ revision: number; key: string } | null>(null);
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
  const previousProject = useRef(projectId);
  const resizeComposer = useCallback((value: string) => {
    const node = input.current;
    if (!node?.clientWidth || node.value !== value) return;
    const style = getComputedStyle(node);
    // A hidden dialog has no usable width; ResizeObserver fits it once it becomes visible.
    node.style.height = "0px";
    const border = Number.parseFloat(style.borderTopWidth) + Number.parseFloat(style.borderBottomWidth);
    node.style.height = `${Math.max(Number.parseFloat(style.minHeight), Math.min(node.scrollHeight + border, Number.parseFloat(style.maxHeight)))}px`;
  }, []);
  useLayoutEffect(() => { if (!guided) resizeComposer(draft); }, [draft, guided, resizeComposer]);
  useEffect(() => {
    const node = input.current;
    if (guided || !enabled || run?.state === "needs_approval" || !node) return;
    let width = -1;
    const observer = new ResizeObserver(entries => {
      const next = entries[0]?.contentRect.width;
      if (next !== width) { width = next ?? -1; resizeComposer(node.value); }
    });
    observer.observe(node);
    resizeComposer(node.value);
    return () => observer.disconnect();
  }, [guided, enabled, run?.state, resizeComposer]);
  useEffect(() => {
    if (guided && activeView && projectId && previousProject.current !== projectId) document.getElementById("publication-agent-title")?.focus();
    previousProject.current = projectId;
  }, [projectId, guided, activeView]);
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
    accept(null);
    setRestoring(true);
    api(`/api/agent/runs?project=${projectId ?? "none"}${guided ? "&kind=publication" : chatOnly ? "&kind=conversation" : ""}`, decodeRun, { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) accept(value); })
      .catch((cause) => {
        if (!controller.signal.aborted) failed(cause);
      })
      .finally(() => {
        if (!controller.signal.aborted) setRestoring(false);
      });
    return () => controller.abort();
  }, [accept, failed, projectId, guided, chatOnly]);
  useEffect(() => {
    onLockChanged?.(busy || active || environmentLocked || lifecycleLocked || ["approved", "executing", "observing", "uncertain"].includes(run?.publication?.state ?? "") || ["approved", "executing", "observing", "uncertain"].includes(run?.destination?.state ?? ""));
  }, [busy, active, environmentLocked, lifecycleLocked, run?.publication?.state, run?.destination?.state, onLockChanged]);
  useEffect(() => {
    if (!active || !runId) return;
    const controller = new AbortController();
    let inFlight = false;
    const timer = window.setInterval(() => {
      if (inFlight) return;
      inFlight = true;
      api(`/api/agent/runs/${runId}`, decodeRun, { signal: controller.signal })
        .then(value => { if (!controller.signal.aborted) accept(value); })
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
  }, [runId, active, accept, failed]);
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
      setAwayFromEnd(false);
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
  async function startPublication(event?: FormEvent) {
    event?.preventDefault();
    if (!projectId || !projectHash || busy || active || disabled || !enabled || restoring) return;
    const publication = { projectId, sourceHash: projectHash, path: missionPath, expectedText: expectedText.trim() || null };
    const encoded = JSON.stringify(publication);
    if (missionKey.current?.input !== encoded) missionKey.current = { input: encoded, key: crypto.randomUUID() };
    setBusy(true); setError(null);
    try {
      accept(await api("/api/agent/runs", decodeRun, { csrf,
        body: { operation: "publish", requestKey: missionKey.current.key, publication } }));
    } catch (cause) { failed(cause); }
    finally { setBusy(false); }
  }
  async function send(message: string) {
    if (busy || active || restoring || disabled || !enabled || run?.state === "needs_approval")
      return;
    const continueRun =
      run && sameProject && (!chatOnly || run.channel === "conversation") && (run.state === "needs_input" || run.state === "partially_completed")
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
            : { requestKey: request.key, goal: message, projectId, ...(chatOnly ? { operation: "question" } : {}) },
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
  async function resumePublication() {
    if (!run?.mission || busy || active || disabled || !enabled) return;
    setBusy(true); setError(null);
    try {
      const current = await api(`/api/agent/runs/${run.id}`, decodeRun);
      if (!current) return;
      if (resumeKey.current?.revision !== current.revision) resumeKey.current = { revision: current.revision, key: crypto.randomUUID() };
      accept(await api(`/api/agent/runs/${run.id}`, decodeRun, { csrf, body: { operation: "resume-publication", revision: current.revision, requestKey: resumeKey.current.key } }));
    } catch (cause) { failed(cause); }
    finally { setBusy(false); }
  }
  async function refresh() {
    setRetryable(null);
    setError(null);
    try {
      const value = await api(run ? `/api/agent/runs/${run.id}` : `/api/agent/runs?project=${projectId ?? "none"}${guided ? "&kind=publication" : chatOnly ? "&kind=conversation" : ""}`, decodeRun);
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
  async function planRequest(decision?: "approve" | "reject", codingAgent?: CodingAgentChoice) {
    if (!run || busy || disabled) return;
    setBusy(true); setError(null);
    try {
      accept(await api(`/api/agent/runs/${run.id}`, decodeRun, { csrf, body: decision && run.authority
        ? { operation: "plan-decision", revision: run.revision, authorityId: run.authority.id, hash: run.authority.hash, decision }
        : { operation: "plan-proposal", revision: run.revision, ...(codingAgent ? { codingAgent } : {}) } }));
      setEditingAgentFor(null);
    } catch (cause) { failed(cause); }
    finally { setBusy(false); }
  }
  async function databaseRequest(decision?: "approve" | "reject") {
    if (!run?.database || busy || disabled) return;
    setRetryable(null); setBusy(true); setError(null);
    try { accept(await api(`/api/agent/runs/${run.id}`, decodeRun, { csrf,
      body: decision ? { operation: "database-decision", revision: run.revision, actionId: run.database.id, decision } : { operation: "database-observe", revision: run.revision },
    })); } catch (cause) { failed(cause); } finally { setBusy(false); }
  }
  async function diskRequest(decision?: "approve" | "reject") {
    if (!run?.disk || busy || disabled) return;
    setRetryable(null);setBusy(true);setError(null);
    try { accept(await api(`/api/agent/runs/${run.id}`, decodeRun, { csrf,
      body: decision ? { operation: "disk-decision", revision: run.revision, actionId: run.disk.id, decision } : { operation: "disk-observe", revision: run.revision },
    })); } catch (cause) { failed(cause); } finally { setBusy(false); }
  }
  async function networkRequest(decision?: "approve" | "reject", acknowledgeUnknownCost = false) {
    if (!run?.network || busy || disabled) return;
    setRetryable(null); setBusy(true); setError(null);
    try {
      accept(await api(`/api/agent/runs/${run.id}`, decodeRun, { csrf,
        body: decision ? { operation: "network-decision", revision: run.revision, actionId: run.network.id, decision, acknowledgeUnknownCost }
          : { operation: "network-observe", revision: run.revision },
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
  async function destinationChoice(planId: string, bundleId: string) {
    if (!run?.destination || busy || disabled) return;
    setBusy(true); setChangingPlan(true); setError(null);
    try { accept(await api(`/api/agent/runs/${run.id}`, decodeRun, { csrf,
      body: { operation: "destination-choice", revision: run.revision, planId, bundleId } })); }
    catch (cause) { failed(cause); }
    finally { setBusy(false); setChangingPlan(false); }
  }
  function follow() {
    const node = transcript.current;
    if (!node) return;
    following.current = node.scrollHeight - node.scrollTop - node.clientHeight <= 48;
    setAwayFromEnd(!following.current);
    if (following.current) setNewCount(0);
  }
  function goToLatest() {
    const node = transcript.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
    following.current = true;
    setAwayFromEnd(false);
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
  const runEffect = run ? <p className="agent-effect">{run.effect === "remote_changes_verified" ? "نسخه منتشرشده و پاسخ مورد انتظار بررسی شدند."
    : run.effect === "configuration_changed" ? "تنظیمات برنامه ذخیره و بررسی شد؛ نسخه تازه و سلامت آن هنوز جدا بررسی می‌شوند."
    : run.effect === "disk_created" ? "فضای پایدار تأیید شد؛ انتشار و ماندگاری داده هنوز جدا بررسی می‌شوند."
    : run.effect === "database_created" ? "هویت دیتابیس تأیید شد؛ اتصال و بررسی داده هنوز باقی است."
    : run.effect === "destination_created" ? "مقصد ساخته و تنظیمات آن تأیید شد؛ انتشار هنوز جداگانه بررسی می‌شود."
    : run.effect === "network_created" ? "شبکه با هویت واقعی تأیید شد؛ ساخت مقصد و انتشار هنوز انجام نشده‌اند."
    : run.effect === "remote_changes_unverified" ? "ارسال به سرویس آغاز شده است؛ نتیجه نهایی هنوز تأیید نشده است."
    : "تغییری در سایت منتشر نشده است."}</p> : null;
  const runSteps = run ? <AgentSteps run={run} active={active} /> : null;
  const errorNotice = error ? (
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
      ) : null;
  const progressIndicator = active ? (
            <div className="agent-progress">
              <p role="status" aria-live="polite" aria-atomic="true" className="hint">
                <span className="agent-activity" aria-hidden="true">
                  <span className="agent-dot" />
                  <span className="agent-dot" />
                  <span className="agent-dot" />
                </span>
                {progress ?? "در حال بررسی درخواست…"}
              </p>
              <span className="hint agent-elapsed" aria-hidden="true">
                {formatElapsed(now - startedAt)} از شروع بررسی
              </span>
            </div>
          ) : null;
  const conversation = run && sameProject ? <div className="chat-transcript-region">
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
                        {event.kind === "assistant" ? <WorkspaceGlyph name="spark" /> : null}
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
            {chatOnly ? <div className="chat-run-context">{runEffect}{runSteps}</div> : null}
            {chatOnly && run.state === "failed" ? <p className="note">پاسخ کامل نشد؛ نتیجه‌های پیشین حفظ شده‌اند. <button type="button" className="button-quiet" disabled={busy} onClick={() => void refresh()}>دریافت وضعیت ثبت‌شده</button></p> : null}
            {chatOnly ? errorNotice : null}
            {chatOnly ? progressIndicator : null}
          </section>
          {awayFromEnd ? (
            <button type="button" className="button-quiet chat-latest" aria-label={newCount ? `${new Intl.NumberFormat("fa-IR").format(newCount)} پیام تازه؛ آخرین پیام` : "آخرین پیام"} onClick={goToLatest}>
              آخرین پیام <WorkspaceGlyph name="down" />
            </button>
          ) : null}
</div> : null;
  const composer = enabled && run?.state !== "needs_approval" ? (
        <form className="agent-composer" onSubmit={(event) => void submit(event)}>
          <label className="sr-only" htmlFor="agent-goal">{run && sameProject ? "پیام بعدی" : "سؤال شما"}</label>
          <div className="composer-input-row">
          <textarea
            ref={input}
            id="agent-goal"
            name="goal"
            autoComplete="off"
            dir="auto"
            rows={1}
            enterKeyHint="send"
            maxLength={2000}
            placeholder="پیام شما…"
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
          {active ? (
            <p id="agent-active-help" className="sr-only">
              بررسی در حال اجراست؛ نوشتن آزاد است و ارسال پس از پایان ممکن می‌شود.
            </p>
          ) : null}
          <div className="button-row">
            <button
              type="submit"
              aria-label="ارسال درخواست"
              disabled={disabled || busy || restoring || active || !draft.trim()}
              aria-describedby={active ? "agent-active-help" : undefined}
            >
              {busy ? <span className="agent-dot" aria-hidden="true" /> : <WorkspaceGlyph name="send" />}
            </button>
            {active ? (
              <button
                type="button"
                className="button-secondary"
                aria-label="توقف بررسی"
                disabled={busy || disabled}
                onClick={() => void cancel()}
              >
                <WorkspaceGlyph name="stop" />
              </button>
            ) : null}
          </div>
          </div>
          <p id="agent-help" className="hint composer-toolbar">
            <span>رمز یا کلید وارد نکنید.</span><span className="chat-key-hint">Enter ارسال · Shift+Enter خط تازه</span>
          </p>
        </form>
      ) : null;
  const panel = <section className={`panel agent-panel ${guided ? "publication-journey" : "optional-chat"}`} hidden={guided && (!activeView || !projectId)} aria-labelledby={guided ? "publication-agent-title" : "agent-title"} aria-busy={busy || active}>
      <div className="section-heading">
        <h2 id={guided ? "publication-agent-title" : "agent-title"} tabIndex={-1}>{guided ? "آماده‌سازی و انتشار پروژه" : "گفت‌وگوی پروژه"}</h2>
        {run ? <span className="badge badge-quiet">{stateLabels[run.state]}</span> : null}
      {!guided && run && !active && run.state !== "needs_approval" ? (
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
      </div>
      <div className="button-row agent-project-actions" hidden={guided || chatOnly}>
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
      {!guided && !run && !error && !restoring && enabled ? (
        <ChatWelcome projectName={projectName} disabled={disabled || busy || active} onPick={question => { setDraft(question); input.current?.focus(); }} />
      ) : null}
      {restoring ? <p role="status">در حال بازیابی وضعیت…</p> : null}
      {guided && enabled && projectId && !restoring && !active && !run?.mission ? (
        <form onSubmit={event => void startPublication(event)} className="publication-start">
          <p>روش اجرای پروژه و مقصد بررسی می‌شوند. تغییرات لازم و هزینه پیش از اجرا برای تصمیم شما نمایش داده می‌شوند.</p>
          <details><summary>صفحه و نشانه مورد انتظار</summary>
            <label htmlFor="mission-path">کدام صفحه را بررسی کنیم؟</label>
            <input id="mission-path" dir="ltr" value={missionPath} onChange={event => setMissionPath(event.target.value)} maxLength={200} required disabled={busy || disabled} />
            <label htmlFor="mission-expectation">متنی که باید در پاسخ باشد (اختیاری)</label>
            <input id="mission-expectation" value={expectedText} onChange={event => setExpectedText(event.target.value)} maxLength={240} disabled={busy || disabled} />
            <p className="hint">پیش‌فرض صفحه اصلی است. اگر نشانه را وارد نکنید، از فایل‌های همان صفحه استخراج می‌شود.</p>
          </details>
          <button type="submit" disabled={busy || disabled}>{busy ? "در حال ثبت…" : "بررسی و آماده‌سازی انتشار"}</button>
        </form>
      ) : null}
      {guided && run?.mission && run.nextAction !== "configure_env" && !active && (["needs_input", "partially_completed", "failed", "interrupted", "cancelled"].includes(run.state) || run.state === "needs_approval" && !appSelected && run.repair?.validationOnly && run.repair.state === "proposed" && !run.authority) &&
        ![run.publication?.state, run.destination?.state, run.network?.state].some(state => state === "executing" || state === "observing" || state === "uncertain") &&
        (run.state === "cancelled" || run.nextAction !== "connect_account" || accountReady) && (run.state === "cancelled" || run.nextAction !== "select_app" || appSelected) ?
        <button type="button" disabled={busy || disabled || restoring} onClick={() => void resumePublication()}>{busy ? "در حال ثبت ادامه…" : run.state === "cancelled" ? "ادامه انتشار پس از توقف" : "ادامه همان مأموریت"}</button> : null}
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
      {run && sameProject ? (
        <>
          {!guided ? conversation : null}
          {guided && !active && run.events.filter(event => event.kind === "assistant").at(-1)?.message ? <div className="mission-summary"><p>{run.nextAction === "configure_env" ? "پروژه بررسی شد. برای ادامه، تنظیمات باقی‌ماندهٔ برنامه را تکمیل کنید." : run.state === "completed" ? "نتیجهٔ بررسی انتشار آماده است؛ نسخه و پاسخ سایت را در کارت زیر ببینید." : "نتیجهٔ بررسی آماده است. اقدام بعدی را در کارت‌های زیر دنبال کنید."}</p><details><summary>توضیح کامل بررسی</summary><RichText text={run.events.filter(event => event.kind === "assistant").at(-1)?.message ?? ""} /></details></div> : null}
          {!chatOnly ? runEffect : null}
          {!chatOnly && run.state === "failed" ? (
            <p className="note">
              این مرحله کامل نشد. رسیدها و نتیجه‌های مراحل پیشین حفظ شده‌اند؛ برای ادامه،
              خطای ثبت‌شده را در مراحل بررسی ببینید و وضعیت را دوباره دریافت کنید. هیچ عملیات ابری خودکار تکرار نمی‌شود.
            </p>
          ) : null}
          {!sameProject ? (
            <p className="note">
              این گفت‌وگو برای پروژه قبلی است. پیام بعدی، بررسی تازه‌ای برای پروژه انتخاب‌شده آغاز
              می‌کند.
            </p>
          ) : null}
          {!chatOnly ? progressIndicator : null}
          <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {announcement}
          </p>
          {run.question && sameProject ? <p className="note">{run.question}</p> : null}
          {guided && run.mission && run.nextAction === "configure_env" && !active && sameProject ? <ProjectEnvironment key={run.id} runId={run.id} csrf={csrf} disabled={disabled || busy}
            onLockChanged={setEnvironmentLocked} onExpired={onExpired} onContinue={() => void resumePublication()} /> : null}
          {run.repair ? (
            <section className="agent-repair" aria-labelledby="repair-title">
              <h3 id="repair-title">{run.repair.validationOnly ? "بررسی ساخت و اجرای پروژه" : "اصلاح نسخه جدا از پروژه"}</h3>
              <BuildFailureNote job={run.repair} />
              <MigrationTestReview job={run.repair} />
              <details>
                <summary>جزئیات اصلاح و رسید آزمون</summary>
                <p>{run.repair.goal}</p>
                <p className="hint">{run.repair.validationOnly ? "فایل‌های پروژه در این مرحله تغییر نمی‌کنند." : "فقط این فایل‌ها قابل تغییرند:"}</p>
                <ul>
                  {run.repair.allowedPaths.map((path) => (
                    <li key={path}>
                      <bdi>{path}</bdi>
                    </li>
                  ))}
                </ul>
                <p className="hint">{run.repair.validationOnly ? run.repair.build?.version === 1 && run.repair.build.install === "none" ? "وابستگی اعلام‌شده‌ای وجود ندارد؛ فرمان ساخت و اجرا و پاسخ مورد انتظار بررسی می‌شوند:" : "نصب قفل‌شده، فرمان ساخت و اجرای موجود و پاسخ مورد انتظار بررسی می‌شوند:" : "همین معیار موجود، پیش و پس از اصلاح اجرا می‌شود:"}</p>
                <code dir="ltr">{run.repair.build?.version === 2 ? `pip install --no-index --require-hashes; compileall; unittest ${run.repair.testFiles.join(" ")}; start: ${run.repair.build.startCommand}; GET ${run.repair.build.workload.path}` : run.repair.build ? `${run.repair.build.install === "none" ? "no dependencies to install" : "npm ci --offline"}${run.repair.build.buildCommand ? `; build: ${run.repair.build.buildCommand}` : ""}${run.repair.build.testCommand ? `; test: ${run.repair.build.testCommand}` : ""}; start: ${run.repair.build.startCommand}; GET ${run.repair.build.workload.path}` : `node --test -- ${run.repair.testFiles.join(" ")}`}</code>
                <p className="hint">
                  {run.repair.execution === "container" ? "آزمون در container محدود، بدون شبکه و بدون دسترسی نوشتن به پوشه اصلی اجرا می‌شود." : "فرمان در نسخه جدا با دسترسی محدود Node اجرا می‌شود. این روش شبکه جدا یا sandbox سیستم‌عامل نیست."} پوشه اصلی تغییر نمی‌کند.
                </p>
                {run.repair.diff ? (
                  <pre dir="ltr">
                    <code>{run.repair.diff}</code>
                  </pre>
                ) : null}
                {run.repair.beforeTest || run.repair.afterTest ? (
                  <pre dir="ltr">
                    {run.repair.afterTest?.output ?? run.repair.beforeTest?.output}
                  </pre>
                ) : null}
              </details>
              {run.state === "needs_approval" && run.repair.state === "proposed" && run.authority?.state !== "proposed" ? (
                <>
                  <p>
                    این تصمیم فقط {run.repair.validationOnly ? "نصب و بررسی ساخت و اجرای نسخه جدا" : "اصلاح محلی و اجرای معیار بالا"} را مجاز می‌کند. انتشار نیاز به تصمیم
                    جدا دارد.
                  </p>
                  {run.repair.build?.environment?.keys.length ? <p className="note">اجازهٔ استفاده از اطلاعات امن این کلیدها در ساخت، آزمون و اجرای نسخه جدا نیز در همین تصمیم است: {run.repair.build.environment.keys.map(key => <bdi key={key}> {key} </bdi>)}. مقدارها نمایش داده نمی‌شوند.</p> : null}
                  <div className="button-row">
                    <button
                      type="button"
                      disabled={disabled || busy || !sameProject}
                      onClick={() => void decideRepair("approve")}
                    >
                      {run.repair.validationOnly ? "تأیید ساخت و بررسی برنامه" : "تأیید اصلاح و اجرای آزمون"}
                    </button>
                    <button
                      type="button"
                      className="button-secondary"
                      disabled={disabled || busy}
                      onClick={() => void decideRepair("reject")}
                    >
                      {run.repair.validationOnly ? "رد آماده‌سازی" : "رد اصلاح"}
                    </button>
                  </div>
                </>
              ) : (
                <p role="status">{run.publication?.attemptId ? "اصلاح و آزمون‌های محلی گذشتند؛ وضعیت انتشار در کارت زیر ثبت شده است." : run.repair.message}</p>
              )}
              {run.repair.beforeTest || run.repair.afterTest ? (
                <dl className="profile-facts">
                  {!run.repair.validationOnly ? <div>
                    <dt>آزمون پیش از اصلاح</dt>
                    <dd>
                      {run.repair.beforeTest
                        ? run.repair.beforeTest.passed
                          ? "گذشت"
                          : "نگذشت"
                        : "اجرا نشده"}
                    </dd>
                  </div> : null}
                  <div>
                    <dt>{run.repair.validationOnly ? "ساخت و پاسخ برنامه" : "آزمون پس از اصلاح"}</dt>
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
          {run.authority ? <>
            <MissionAuthorityReview authority={run.authority} runState={run.state} disabled={disabled || busy || active || !sameProject || editingAgent}
              onDecision={decision => void planRequest(decision)} />
            {run.authority.state === "proposed" && run.state === "needs_approval" ? editingAgent
              ? <CodingAgentSelection key={run.authority.id} selected={run.authority.plan.version === 2 ? run.authority.plan.codingAgent : { kind: "internal" }}
                  disabled={disabled || busy || !sameProject} onPropose={choice => void planRequest(undefined, choice)} onCancel={() => setEditingAgentFor(null)} />
              : <button type="button" className="button-secondary" disabled={disabled || busy || !sameProject} onClick={() => setEditingAgentFor(run.id)}>تغییر عامل پیش از تأیید</button> : null}
          </> : run.mission && run.repair?.validationOnly && run.state === "needs_approval" && appSelected ? (
              <CodingAgentSelection key={run.repair.id} disabled={disabled || busy || !sameProject} onPropose={choice => void planRequest(undefined, choice)} />
            ) : null}
          {run.network && !run.networkContinued ? <AgentNetwork key={run.network.id} action={run.network} waiting={run.state === "needs_approval"}
            disabled={disabled || busy || active || !sameProject} resumable={run.network.state === "succeeded" && !run.networkContinued}
            onDecision={(decision, acknowledged) => void networkRequest(decision, acknowledged)} onObserve={() => void networkRequest()} /> : null}
          {run.destination && !run.destinationContinued ? <AgentDestination action={run.destination} recommendation={run.destinationRecommendation ?? null}
            changingPlan={changingPlan} onPlanChange={(planId, bundleId) => void destinationChoice(planId, bundleId)} waiting={run.state === "needs_approval" && (run.destination.state === "awaiting_approval" || run.destination.state === "expired")}
            disabled={disabled || busy || active || !sameProject}
            resumable={run.destination.state === "succeeded" && !run.destinationContinued}
            onDecision={(decision) => void destinationRequest(decision)}
            onObserve={() => void destinationRequest()} /> : null}
          {run.database && !run.databaseContinued ? <AgentDatabase key={run.database.id} action={run.database} waiting={run.state === "needs_approval"}
            disabled={disabled || busy || active || !sameProject} resumable={run.database.state === "succeeded" && !run.databaseContinued}
            onDecision={decision => void databaseRequest(decision)} onObserve={() => void databaseRequest()} /> : null}
          {run.disk && !run.diskContinued ? <AgentDisk key={run.disk.id} action={run.disk} waiting={run.state === "needs_approval"}
            disabled={disabled || busy || active || !sameProject} resumable={run.disk.state === "succeeded" && !run.diskContinued}
            onDecision={decision => void diskRequest(decision)} onObserve={() => void diskRequest()} /> : null}
          {run.publication ? <AgentPublication action={run.publication} csrf={csrf} waiting={run.state === "needs_approval"}
            disabled={disabled || busy || active || !sameProject}
            onDecision={(decision) => void publicationRequest(decision)}
            onObserve={() => void publicationRequest()} /> : null}
          {sameProject && action && action !== "reply" && action !== "review_project" && action !== "configure_env" && !(guided && ((action === "connect_account" && accountReady) || (action === "select_app" && appSelected))) ? (
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
          {guided && active ? <button type="button" className="button-secondary" disabled={busy || disabled} onClick={() => void cancel()}>توقف ادامه عملیات</button> : null}
          {guided && run.state === "needs_input" && run.question && action === "reply" ? <form onSubmit={event => void submit(event)}>
            <label htmlFor="publication-answer">اطلاعات موردنیاز برای ادامه</label>
            <textarea id="publication-answer" value={draft} onChange={event => setDraft(event.target.value)} rows={2} maxLength={2000} required disabled={busy || disabled} />
            <p className="hint">مقدار محرمانه وارد نکنید.</p>
            <button type="submit" disabled={busy || disabled}>ثبت اطلاعات و ادامه</button>
          </form> : null}
          {!chatOnly ? runSteps : null}
        </>
      ) : null}
      {guided && projectId ? <ProjectLifecycle key={projectId} projectId={projectId} csrf={csrf} disabled={disabled || busy || active || environmentLocked || run?.state === "needs_approval"}
        onLockChanged={setLifecycleLocked} onExpired={onExpired} onChanged={() => onProjectChanged(projectId)} /> : null}
      {!chatOnly || !run || !sameProject ? errorNotice : null}
      {!guided ? composer : null}
    </section>;
  return (<>
    {publicationInAssistant && assistantPublicationHost.current ? createPortal(panel, assistantPublicationHost.current) : panel}
    {publicationInAssistant ? <p className="note">همان مأموریت انتشار در دستیار باز است. بستن دستیار، اجرای آن را متوقف نمی‌کند.</p> : null}
    {guided ? <FloatingAssistant blocked={blocked || !publicationInAssistant && (environmentLocked || run?.nextAction === "configure_env")} projectName={projectName} onOpenChanged={setAssistantOpen}>
      <div className={assistantStyles.shell}>
      <div className={assistantStyles.navigation}>
        <button
          type="button"
          className={assistantStyles.tabButton}
          aria-label="گفت‌وگو و راهنمایی"
          aria-pressed={!assistantPublication}
          data-active={!assistantPublication}
          onClick={() => setAssistantPublication(false)}
        >
          {!assistantPublication ? <span className={assistantStyles.activeDot} aria-hidden="true" /> : null}
          <span>گفت‌وگو و راهنمایی</span>
        </button>
        <button
          type="button"
          className={assistantStyles.tabButton}
          aria-label={run?.mission ? "پیگیری انتشار و انتخاب پلن" : "انتشار همین پروژه"}
          aria-pressed={assistantPublication}
          data-active={assistantPublication}
          disabled={!projectId}
          onClick={() => setAssistantPublication(true)}
        >
          {assistantPublication ? <span className={assistantStyles.activeDot} aria-hidden="true" /> : null}
          <span>{run?.mission ? "پیگیری انتشار و انتخاب پلن" : "انتشار همین پروژه"}</span>
        </button>
      </div>
      {assistantPublication ? <p className={assistantStyles.hint}>همان مأموریت صفحهٔ انتشار، با همان تصمیم‌ها و پیشرفت.</p> : null}
      <div ref={assistantPublicationHost} className={assistantStyles.publication} />
      <div hidden={assistantPublication} className={assistantStyles.chat}>
      <AgentPanel projectId={projectId} projectName={projectName} csrf={csrf} enabled={enabled} disabled={disabled}
        activeView chatOnly onAccounts={onAccounts} onChooseProject={onChooseProject} onGitHub={onGitHub} onReview={onReview}
        onManualPublish={onManualPublish} onExpired={onExpired} onProjectChanged={onProjectChanged}
        {...(onChatLockChanged ? { onLockChanged: onChatLockChanged } : {})} />
      </div>
      </div>
    </FloatingAssistant> : null}
    </>
  );
}
