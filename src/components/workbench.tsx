"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { Action, ActionState, WorkspaceView } from "../contracts/domain.ts";
import { decodeAction, decodeWorkspace } from "../contracts/client-decode.ts";
import {
  parseProjectFlow,
  type ProjectFlow,
  type ProjectSelection,
} from "../contracts/project-flow.ts";
import { object } from "../contracts/validation.ts";
import { api, ClientError } from "./api.ts";
import { FolderIcon, FolderPicker } from "./FolderPicker.tsx";
import { ConnectionDialog } from "./ConnectionDialog.tsx";
import { GitHubProjectPicker } from "./GitHubProjectPicker.tsx";
import { IncidentWorkbench } from "./IncidentWorkbench.tsx";

type FlowResult = { flow: ProjectFlow | null; action: Action | null };
function decodeFlow(value: unknown): FlowResult {
  const row = object(value);
  return {
    flow: row.flow === null ? null : parseProjectFlow(row.flow),
    action: row.action === null ? null : decodeAction(row.action),
  };
}
const number = (value: number) => new Intl.NumberFormat("fa-IR").format(value);
const stateNames: Record<ActionState, string> = {
  awaiting_approval: "منتظر تصمیم شما",
  approved: "تأیید ثبت شد؛ اجرا نشده",
  cancelled: "اجرا نمی‌شود",
  expired: "مهلت تأیید گذشته",
  executing: "در حال اجرا",
  observing: "در حال بررسی نتیجه",
  uncertain: "نتیجه اجرا نامعلوم",
  succeeded: "نتیجه تأیید شد",
  failed: "عملیات ناموفق بود",
};
function locationState() {
  const params = new URLSearchParams(window.location.search);
  return {
    mode: params.get("view") === "incident" ? ("incident" as const) : ("source" as const),
    project: /^[a-f0-9-]{36}$/.test(params.get("project") || "") ? params.get("project") : null,
  };
}
function projectName(flow: ProjectFlow): string {
  if (flow.displayName) return flow.displayName;
  return flow.selection.kind === "github"
    ? `${flow.selection.owner}/${flow.selection.name}${flow.selection.directory === "." ? "" : ` / ${flow.selection.directory}`}`
    : flow.selection.directory === "."
      ? "پوشه اصلی پروژه"
      : flow.selection.directory.split("/").at(-1) || "پروژه";
}

function Proposal({
  action,
  workspace,
  busy,
  expired,
  onDecision,
  onNewProposal,
  onOperation,
  onNextVersion,
}: {
  action: Action;
  workspace: WorkspaceView;
  busy: boolean;
  expired: boolean;
  onDecision: (action: Action, decision: "approve" | "reject") => void;
  onNewProposal: () => void;
  onOperation: (operation: "execute" | "observe") => void;
  onNextVersion: () => void;
}) {
  const state =
    action.expiresAt <= Date.now() &&
    (action.state === "awaiting_approval" || action.state === "approved")
      ? "expired"
      : action.state;
  return (
    <section className="panel proposal-panel" aria-labelledby="proposal-title">
      <div className="section-heading">
        <h2 id="proposal-title">پیشنهاد انتشار</h2>
        <span
          className={`badge ${state === "uncertain" || state === "failed" ? "badge-warning" : "badge-quiet"}`}
        >
          {stateNames[state]}
        </span>
      </div>
      <p>
        این نسخه از فایل‌های بررسی‌شده برای انتشار روی{" "}
        <strong>
          <bdi>{action.spec.scope.app}</bdi>
        </strong>{" "}
        آماده شده است.
      </p>
      <dl className="action-facts">
        <div>
          <dt>تیم مقصد</dt>
          <dd>{workspace.connections.liara?.teamName || "تیم مجاز این نصب"}</dd>
        </div>
        <div>
          <dt>برنامه مقصد</dt>
          <dd>
            <bdi>{action.spec.scope.app}</bdi>
          </dd>
        </div>
        <div>
          <dt>هزینه و پلن</dt>
          <dd>
            {action.spec.version === 4 ? (
              <>
                پلن فعلی <bdi>{action.spec.args.planId}</bdi> حفظ می‌شود؛ هزینه نامعلوم است
              </>
            ) : (
              "هنوز از لیارا تأیید نشده"
            )}
          </dd>
        </div>
        <div>
          <dt>اثر انتشار</dt>
          <dd>جایگزینی نسخه فعلی برنامه</dd>
        </div>
      </dl>
      <p className="note">
        ممکن است هنگام انتشار دسترسی سایت موقتاً قطع شود. قیمت و منابع مورد نیاز هنوز تأیید نشده‌اند.
        {action.spec.version === 4
          ? " این پیشنهاد فقط نسخه برنامه موجود را منتشر می‌کند؛ پلن و متغیرهای محیطی را تغییر نمی‌دهد."
          : " اجرای واقعی این پیشنهاد بسته است."}
      </p>
      {action.spec.version === 4 ? (
        <p className="hint">
          معیار نتیجه: پاسخ <bdi>{action.spec.workload.status}</bdi> از{" "}
          <bdi>{action.spec.workload.path}</bdi> با نسخه <bdi>{action.spec.workload.revision}</bdi>.
          آماده‌شدن release به‌تنهایی نتیجه موفق نیست.
        </p>
      ) : null}
      <p>
        تصمیم شما به همین مقصد و همین فایل‌ها مربوط است. تغییر پروژه، نسخه یا تنظیمات، پیشنهاد و
        تأیید تازه می‌خواهد.
      </p>
      {state === "awaiting_approval" ? (
        <>
          <div className="button-row">
            <button
              type="button"
              disabled={busy || expired}
              onClick={() => onDecision(action, "approve")}
            >
              تأیید پیشنهاد برای <bdi>{action.spec.scope.app}</bdi>
            </button>
            <button
              type="button"
              className="button-secondary"
              disabled={busy || expired}
              onClick={() => onDecision(action, "reject")}
            >
              رد این پیشنهاد
            </button>
          </div>
          <p className="hint">تأیید در این مرحله فقط تصمیم را ثبت می‌کند؛ هیچ فایلی ارسال نمی‌شود.</p>
        </>
      ) : state === "approved" ? (
        <>
          <p className="note">
            تصمیم شما ثبت شده است؛ انتشار اجرا نشده و سلامت سایت بررسی نشده است.
            {action.spec.version === 4
              ? " برای شروع، انتشار همین نسخه را انتخاب کنید."
              : " مسیر اجرای این پیشنهاد هنوز بسته است."}
          </p>
          {action.spec.version === 4 && workspace.features.deployment ? (
            <button type="button" disabled={busy || expired} onClick={() => onOperation("execute")}>
              انتشار این نسخه روی <bdi>{action.spec.scope.app}</bdi>
            </button>
          ) : null}
        </>
      ) : state === "uncertain" ? (
        <>
          <p className="note note-danger">
            اجرای دوباره مجاز نیست. ابتدا باید نتیجه همین عملیات از لیارا خوانده و مشخص شود.
          </p>
          {action.spec.version === 4 && workspace.features.serviceReads ? (
            <button type="button" disabled={busy || expired} onClick={() => onOperation("observe")}>
              بررسی نتیجه بدون ارسال دوباره
            </button>
          ) : null}
        </>
      ) : state === "observing" && action.spec.version === 4 ? (
        <>
          <p className="note">درخواست انتشار رسید دارد؛ پاسخ و نسخه سایت هنوز باید بررسی شوند.</p>
          <button
            type="button"
            disabled={busy || expired || !workspace.features.serviceReads}
            onClick={() => onOperation("observe")}
          >
            بررسی پاسخ و نسخه سایت
          </button>
        </>
      ) : state === "succeeded" ? (
        <button type="button" className="button-secondary" disabled={busy || expired} onClick={onNextVersion}>آماده‌سازی نسخه بعدی</button>
      ) : state === "cancelled" || state === "expired" || state === "failed" ? (
        <button
          type="button"
          className="button-secondary"
          disabled={busy || expired}
          onClick={onNewProposal}
        >
          دریافت پیشنهاد تازه
        </button>
      ) : null}
      {action.deployment ? (
        <div className="note" aria-live="polite">
          <p>
            {
              {
                claimed: "مجوز اجرا مصرف شده است.",
                upload_started: "ارسال بسته شروع شده؛ رسید کامل هنوز نداریم.",
                uploaded: "رسید بسته ذخیره شد؛ release هنوز رسید ندارد.",
                release_started: "درخواست release شروع شده؛ رسید کامل هنوز نداریم.",
                release_accepted: "رسید release ذخیره شده است؛ وضعیت سایت مستقل بررسی می‌شود.",
              }[action.deployment.stage]
            }
          </p>
          {action.deployment.observation ? (
            <p>
              {action.deployment.observation.outcome === "verified"
                ? "پاسخ و نسخه مورد انتظار همین صفحه تأیید شدند؛ این مشاهده فقط همین زمان و مسیر را پوشش می‌دهد."
                : action.deployment.observation.outcome === "not_started"
                  ? "انتشار نسخه شروع نشده است. وضعیت بارگذاری بسته ممکن است نامعلوم باشد؛ پیشنهاد تازه به تأیید دوباره نیاز دارد."
                  : action.deployment.observation.outcome === "failed"
                    ? "انتشار یا پاسخ مورد انتظار سایت تأیید نشد. رفع مشکل اعلام نمی‌شود."
                    : action.deployment.observation.outcome === "pending"
                      ? "آماده‌شدن release هنوز تأیید نشده است. کمی بعد فقط نتیجه را بررسی کنید."
                      : "داده کافی برای تأیید نتیجه نداریم. ارسال دوباره انجام نشد."}
            </p>
          ) : null}
        </div>
      ) : null}
      <details className="technical-details">
        <summary>جزئیات برای بررسی تخصصی</summary>
        <p>
          پورت برنامه: <bdi>{action.spec.args.port}</bdi>
        </p>
        <p>
          مهلت تصمیم:{" "}
          {new Intl.DateTimeFormat("fa-IR", { timeStyle: "short" }).format(action.expiresAt)}
        </p>
        <p className="hint">
          شناسه پیگیری پیشنهاد: <code>{action.id}</code>
        </p>
        {action.remoteId ? (
          <p>
            شناسه release: <bdi>{action.remoteId}</bdi>
          </p>
        ) : null}
        {action.deployment?.sourceId ? (
          <p>
            شناسه source: <bdi>{action.deployment.sourceId}</bdi>
          </p>
        ) : null}
      </details>
    </section>
  );
}

export function Workbench() {
  const [workspace, setWorkspace] = useState<WorkspaceView | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState<string | null>(null);
  const [mode, setMode] = useState<"source" | "incident">("source"),
    [flow, setFlow] = useState<ProjectFlow | null>(null),
    [action, setAction] = useState<Action | null>(null);
  const [token, setToken] = useState(""),
    [manualDirectory, setManualDirectory] = useState(""),
    [port, setPort] = useState("");
  const [workloadPath, setWorkloadPath] = useState("/"),
    [expectedRevision, setExpectedRevision] = useState("");
  const [folderOpen, setFolderOpen] = useState(false),
    [githubOpen, setGitHubOpen] = useState(false),
    [accountsOpen, setAccountsOpen] = useState(false);
  const [notice, setNotice] = useState(""),
    [error, setError] = useState<ClientError | null>(null),
    [projectError, setProjectError] = useState<ClientError | null>(null),
    [clock, setClock] = useState(0);
  const pending = useRef<AbortController | null>(null),
    navigation = useRef<AbortController | null>(null),
    activeFlow = useRef<string | null>(null);
  const folderTrigger = useRef<HTMLButtonElement>(null),
    githubTrigger = useRef<HTMLButtonElement>(null),
    accountsTrigger = useRef<HTMLButtonElement>(null),
    sampleTrigger = useRef<HTMLButtonElement>(null),
    manualTrigger = useRef<HTMLButtonElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null),
    errorBox = useRef<HTMLDivElement>(null),
    projectErrorBox = useRef<HTMLDivElement>(null),
    proposalHeading = useRef<HTMLDivElement>(null),
    loginHeading = useRef<HTMLHeadingElement>(null);
  const restoreFocus = useRef<"folder" | "github" | "accounts" | "sample" | "manual" | null>(null),
    focusResult = useRef(false),
    focusProposal = useRef(false),
    sessionNotice = useRef("");
  const expired = Boolean(workspace && clock >= workspace.session.expiresAt),
    disabled = busy !== null || expired;
  const onSessionExpired = useCallback(() => {
    sessionNotice.current = "expired";
    pending.current?.abort();
    setWorkspace(null);
    setAccountsOpen(false);
    setGitHubOpen(false);
    setFolderOpen(false);
    setNotice(
      "نشست شما پایان یافته است. دوباره وارد شوید؛ پیشرفت ذخیره‌شده پس از ورود بازیابی می‌شود.",
    );
  }, []);
  const fail = useCallback(
    (error: unknown) => {
      if (error instanceof ClientError && error.code === "AUTH_REQUIRED") {
        onSessionExpired();
        return;
      }
      setError(
        error instanceof ClientError
          ? error
          : new ClientError(
              "CONNECTION_FAILED",
              "پاسخ برنامه دریافت نشد. اتصال محلی را بررسی و دوباره تلاش کنید.",
            ),
      );
    },
    [onSessionExpired],
  );
  const refresh = useCallback(async () => {
    const data = await api("/api/workspace", decodeWorkspace);
    setWorkspace(data);
    setAction((current) =>
      current ? (data.actions.find((item) => item.id === current.id) ?? current) : null,
    );
    return data;
  }, []);
  const applyFlow = useCallback((data: FlowResult) => {
    const changed = activeFlow.current !== (data.flow?.id ?? null);
    setFlow(data.flow);
    setAction(data.action);
    setPort(data.flow?.profile.port === null || !data.flow ? "" : String(data.flow.profile.port));
    if (data.action?.spec.version === 4) {
      setWorkloadPath(data.action.spec.workload.path);
      setExpectedRevision(data.action.spec.workload.revision);
    } else if (changed) {
      setWorkloadPath("/");
      setExpectedRevision("");
    }
    activeFlow.current = data.flow?.id ?? null;
  }, []);
  const writeLocation = useCallback(
    (nextMode: "source" | "incident", project: string | null, replace = false) => {
      const url = new URL(window.location.href);
      const incident = url.searchParams.get("incident");
      const incidentMode = url.searchParams.get("incident_mode");
      url.search = "";
      url.searchParams.set("view", nextMode === "source" ? "publish" : "incident");
      if (project) url.searchParams.set("project", project);
      if (incident && /^[a-f0-9-]{36}$/.test(incident)) url.searchParams.set("incident", incident);
      if (incidentMode === "live" || incidentMode === "sample")
        url.searchParams.set("incident_mode", incidentMode);
      window.history[replace ? "replaceState" : "pushState"]({}, "", url);
    },
    [],
  );
  useEffect(() => {
    const controller = new AbortController(),
      state = locationState();
    setMode(state.mode);
    void Promise.allSettled([
      api("/api/workspace", decodeWorkspace, { signal: controller.signal }),
      api(`/api/project-flows${state.project ? `?id=${state.project}` : ""}`, decodeFlow, {
        signal: controller.signal,
      }),
    ]).then(([session, saved]) => {
      if (controller.signal.aborted) return;
      if (session.status === "fulfilled") {
        setWorkspace(session.value);
        if (saved.status === "fulfilled") {
          applyFlow(saved.value);
          writeLocation(state.mode, saved.value.flow?.id ?? null, true);
        } else fail(saved.reason);
      } else if (
        !(session.reason instanceof ClientError && session.reason.code === "AUTH_REQUIRED")
      )
        fail(session.reason);
      setLoading(false);
    });
    return () => {
      controller.abort();
      pending.current?.abort();
      navigation.current?.abort();
    };
  }, [fail, applyFlow, writeLocation]);
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 15_000);
    setClock(Date.now());
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    function pop() {
      const state = locationState();
      setMode(state.mode);
      setError(null);
      setProjectError(null);
      if (!workspace || state.project === activeFlow.current) return;
      pending.current?.abort();
      navigation.current?.abort();
      const controller = new AbortController();
      navigation.current = controller;
      api(`/api/project-flows${state.project ? `?id=${state.project}` : ""}`, decodeFlow, {
        signal: controller.signal,
      })
        .then((data) => {
          if (!controller.signal.aborted) applyFlow(data);
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) fail(error);
        });
    }
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, [workspace, fail, applyFlow]);
  useEffect(() => {
    if (error) errorBox.current?.focus();
  }, [error]);
  useEffect(() => {
    if (projectError) projectErrorBox.current?.focus();
  }, [projectError]);
  useEffect(() => {
    if (flow && focusResult.current) {
      focusResult.current = false;
      resultHeading.current?.focus();
    }
  }, [flow]);
  useEffect(() => {
    if (action && focusProposal.current) {
      focusProposal.current = false;
      proposalHeading.current?.focus();
    }
  }, [action]);
  useEffect(() => {
    if (!folderOpen && !githubOpen && !accountsOpen && !busy && restoreFocus.current) {
      const target = {
        folder: folderTrigger,
        github: githubTrigger,
        accounts: accountsTrigger,
        sample: sampleTrigger,
        manual: manualTrigger,
      }[restoreFocus.current];
      restoreFocus.current = null;
      target.current?.focus();
    }
  }, [folderOpen, githubOpen, accountsOpen, busy]);
  useEffect(() => {
    if (!loading && !workspace && sessionNotice.current) loginHeading.current?.focus();
  }, [loading, workspace]);
  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy("login");
    setError(null);
    const submitted = token;
    setToken("");
    try {
      await api("/api/session", () => true, { body: { token: submitted } });
      const state = locationState();
      const [data, saved] = await Promise.all([
        refresh(),
        api(`/api/project-flows${state.project ? `?id=${state.project}` : ""}`, decodeFlow),
      ]);
      setWorkspace(data);
      applyFlow(saved);
      writeLocation(mode, saved.flow?.id ?? null, true);
      setNotice(
        saved.flow
          ? "پروژه ذخیره‌شده بازیابی شد. فایل‌ها دوباره بررسی شدند."
          : "وارد شدید. پروژه‌تان را انتخاب کنید.",
      );
    } catch (error) {
      if (error instanceof ClientError && error.code === "AUTH_REQUIRED") setError(error);
      else fail(error);
    } finally {
      setBusy(null);
    }
  }
  async function signOut() {
    if (!workspace || busy) return;
    setBusy("logout");
    try {
      await api("/api/session", () => true, {
        method: "DELETE",
        csrf: workspace.session.csrfToken,
      });
      setWorkspace(null);
      setFlow(null);
      setAction(null);
      setNotice("از این نصب خارج شدید. برای ادامه دوباره وارد شوید.");
      writeLocation("source", null, true);
      setMode("source");
    } catch (error) {
      fail(error);
    } finally {
      setBusy(null);
    }
  }
  async function prepare(
    selection: ProjectSelection,
    origin: "folder" | "sample" | "manual" | "github",
    upstream?: AbortSignal,
  ): Promise<boolean> {
    if (!workspace || busy || expired || pending.current) return false;
    const controller = new AbortController();
    pending.current = controller;
    const signal = upstream ? AbortSignal.any([controller.signal, upstream]) : controller.signal;
    setBusy("prepare");
    setError(null);
    setProjectError(null);
    setNotice(
      selection.kind === "github"
        ? "در حال دریافت نسخه انتخاب‌شده و بررسی فایل‌ها…"
        : "در حال بررسی و آماده‌سازی محلی فایل‌های پروژه…",
    );
    try {
      const result = await api("/api/project-flows", decodeFlow, {
        body: { operation: "prepare", selection },
        csrf: workspace.session.csrfToken,
        signal,
      });
      if (signal.aborted) return false;
      focusResult.current = true;
      applyFlow(result);
      writeLocation("source", result.flow?.id ?? null);
      setMode("source");
      setNotice("فایل‌ها بررسی و نتیجه ذخیره شد. هیچ فایلی به لیارا ارسال نشده است.");
      return true;
    } catch (error) {
      if (signal.aborted) {
        restoreFocus.current = origin;
        setNotice(
          "درخواست متوقف شد. انتخاب قبلی حفظ شده است؛ برای اطمینان می‌توانید آخرین نتیجه را بازیابی کنید.",
        );
        return false;
      }
      if (error instanceof ClientError && error.code === "AUTH_REQUIRED") onSessionExpired();
      else
        setProjectError(
          error instanceof ClientError
            ? error
            : new ClientError(
                "PROJECT_UNAVAILABLE",
                "بررسی پروژه کامل نشد. پوشه یا اتصال را بررسی و دوباره تلاش کنید.",
              ),
        );
      setNotice("");
      if (origin === "github") throw error;
      return false;
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setBusy(null);
      }
    }
  }
  function cancelPrepare() {
    pending.current?.abort();
  }
  async function propose(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!workspace || !flow || disabled) return;
    setBusy("proposal");
    setError(null);
    try {
      const result = await api("/api/project-flows", decodeFlow, {
        body: {
          operation: workspace.features.deployment ? "propose-deploy" : "propose",
          id: flow.id,
          app: workspace.connections.liara?.selectedApp,
          port: port ? Number(port) : null,
          ...(workspace.features.deployment
            ? {
                workload: {
                  origin: workspace.features.probeOrigin,
                  path: workloadPath,
                  status: 200,
                  revision: expectedRevision,
                },
              }
            : {}),
        },
        csrf: workspace.session.csrfToken,
      });
      focusProposal.current = true;
      applyFlow(result);
      setNotice("پیشنهاد آماده است. مقصد، هزینه نامشخص و اثر تغییر را پیش از تصمیم بخوانید.");
      await refresh();
    } catch (error) {
      fail(error);
      const saved = await api(`/api/project-flows?id=${flow.id}`, decodeFlow).catch(() => null);
      if (saved) applyFlow(saved);
    } finally {
      setBusy(null);
    }
  }
  async function decide(selected: Action, decision: "approve" | "reject") {
    if (!workspace || disabled) return;
    setBusy("decision");
    setError(null);
    try {
      const next = await api(
        `/api/actions/${selected.id}/decision`,
        (value) => decodeAction(object(value).action),
        {
          body: { hash: selected.hash, decision },
          csrf: workspace.session.csrfToken,
        },
      );
      focusProposal.current = true;
      setAction(next);
      setNotice(
        decision === "approve"
          ? "تأیید ثبت شد. انتشار اجرا نشده است."
          : "پیشنهاد رد شد. تغییری انجام نشد.",
      );
      await refresh();
    } catch (error) {
      fail(error);
      if (flow) {
        const saved = await api(`/api/project-flows?id=${flow.id}`, decodeFlow).catch(() => null);
        if (saved) applyFlow(saved);
      }
    } finally {
      setBusy(null);
    }
  }
  async function deploymentOperation(operation: "execute" | "observe") {
    if (!workspace || !action || disabled || pending.current) return;
    const controller = new AbortController(),
      selectedFlow = flow?.id;
    pending.current = controller;
    setBusy(operation);
    setError(null);
    setNotice(
      operation === "execute"
        ? "در حال ارسال نسخه تأییدشده؛ پایان انتظار، اجرای دوباره را مجاز نمی‌کند."
        : "در حال خواندن نتیجه؛ فایلی دوباره ارسال نمی‌شود.",
    );
    try {
      const next = await api(
        `/api/actions/${action.id}/${operation}`,
        (value) => decodeAction(object(value).action),
        {
          body: {},
          csrf: workspace.session.csrfToken,
          signal: controller.signal,
        },
      );
      if (!controller.signal.aborted && selectedFlow === activeFlow.current) {
        focusProposal.current = true;
        setAction(next);
        setNotice(
          operation === "execute"
            ? "رسید انتشار ثبت شد. اکنون پاسخ و نسخه سایت را بررسی کنید."
            : "نتیجه بررسی ثبت شد.",
        );
      }
    } catch (error) {
      if (!controller.signal.aborted) fail(error);
      else setNotice("انتظار متوقف شد. وضعیت ذخیره‌شده را بخوانید؛ انتشار خودکار تکرار نمی‌شود.");
    } finally {
      if (selectedFlow === activeFlow.current && flow) {
        const saved = await api(`/api/project-flows?id=${flow.id}`, decodeFlow).catch(() => null);
        if (saved) {
          focusProposal.current = true;
          applyFlow(saved);
        }
      }
      if (pending.current === controller) {
        pending.current = null;
        setBusy(null);
      }
    }
  }
  const executingActionId = action?.id;
  useEffect(() => {
    if (busy !== "execute" || !executingActionId) return;
    const controller = new AbortController(),
      id = executingActionId;
    let inFlight = false;
    const timer = setInterval(() => {
      if (inFlight) return;
      inFlight = true;
      void api("/api/workspace", decodeWorkspace, { signal: controller.signal })
        .then((data) => {
          const current = data.actions.find((row) => row.id === id);
          if (!controller.signal.aborted && current) setAction(current);
        })
        .catch(() => undefined)
        .finally(() => {
          inFlight = false;
        });
    }, 1500);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [busy, executingActionId]);
  function navigate(next: "source" | "incident") {
    if (busy || mode === next) return;
    setMode(next);
    setError(null);
    setProjectError(null);
    setNotice("");
    writeLocation(next, flow?.id ?? null);
  }
  function openAccounts() {
    setAccountsOpen(true);
    restoreFocus.current = "accounts";
  }
  const liara = workspace?.connections.liara,
    connected = liara?.status === "connected",
    profile = flow?.profile;
  const effectiveState =
    action &&
    (action.state === "approved" || action.state === "awaiting_approval") &&
    action.expiresAt <= clock
      ? "expired"
      : action?.state;
  const step = !flow
    ? 0
    : flow.status !== "ready"
      ? 0
      : !connected || !liara.selectedApp
        ? 1
        : !action || ["cancelled", "expired", "failed"].includes(effectiveState || "")
          ? 2
          : effectiveState === "awaiting_approval"
            ? 3
            : effectiveState === "approved" || effectiveState === "executing"
              ? 4
              : 5;
  return (
    <>
      <header className="app-header">
        <a className="brand" href="/" aria-label="Launchlane، صفحه اصلی">
          <span className="brand-symbol" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span dir="ltr">
            Launchlane
            <span className="brand-subtitle">از پروژه تا انتشار، با تصمیم شما</span>
          </span>
        </a>
        {workspace ? (
          <div className="header-actions">
            <button
              type="button"
              className="button-quiet"
              ref={accountsTrigger}
              disabled={disabled}
              onClick={openAccounts}
            >
              حساب‌ها
            </button>
            <button
              type="button"
              className="button-quiet"
              disabled={busy !== null}
              onClick={() => void signOut()}
            >
              خروج
            </button>
          </div>
        ) : null}
      </header>
      <main id="main-content" className="app-main task-main">
        {workspace ? (
          <nav className="workbench-switch task-switch" aria-label="کار اصلی">
            <button
              type="button"
              className="button-secondary"
              aria-pressed={mode === "source"}
              disabled={busy !== null}
              onClick={() => navigate("source")}
            >
              انتشار پروژه
            </button>
            <button
              type="button"
              className="button-secondary"
              aria-pressed={mode === "incident"}
              disabled={busy !== null}
              onClick={() => navigate("incident")}
            >
              بررسی مشکل سایت
            </button>
          </nav>
        ) : null}
        <div className={`page-intro ${workspace ? "page-intro-compact" : ""}`}>
          <h1>
            {workspace ? (
              mode === "source" ? (
                "انتشار پروژه"
              ) : (
                "بررسی مشکل سایت"
              )
            ) : (
              <>
                پروژه‌تان را با <span>اطمینان منتشر کنید.</span>
              </>
            )}
          </h1>
          {!workspace ? (
            <p>پروژه را معرفی کنید، پیشنهاد را بفهمید و پیش از هر تغییر تصمیم بگیرید.</p>
          ) : null}
        </div>
        <div
          className="live-message compact-status"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {loading ? "در حال بازیابی میز کار…" : notice}
        </div>
        {error ? (
          <div
            className="error-banner"
            role="alert"
            aria-label="این مرحله کامل نشد"
            tabIndex={-1}
            ref={errorBox}
          >
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
          <div className="panel" aria-busy="true">
            <p>در حال آماده‌کردن میز کار…</p>
          </div>
        ) : !workspace ? (
          <div className="login-layout">
            <section className="panel login-panel" aria-labelledby="login-title">
              <h2 id="login-title" tabIndex={-1} ref={loginHeading}>
                وارد میز کار محلی شوید
              </h2>
              <p>
                برای دسترسی امن به فایل‌ها و حساب‌ها، کلید ورود همین نصب لازم است. این کلید با رمز
                ورود لیارا و GitHub تفاوت دارد.
              </p>
              <form onSubmit={signIn}>
                <label htmlFor="operator-token">کلید ورود محلی</label>
                <input
                  id="operator-token"
                  dir="ltr"
                  type="password"
                  autoComplete="current-password"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  required
                  maxLength={256}
                  disabled={busy !== null}
                  aria-describedby="login-help"
                  aria-invalid={error?.code === "AUTH_REQUIRED" || undefined}
                />
                <p id="login-help" className="hint">
                  کلید فقط برای ورود استفاده می‌شود و در مرورگر ذخیره نمی‌شود.
                </p>
                <button type="submit" disabled={busy !== null}>
                  {busy === "login" ? "در حال ورود…" : "ورود به میز کار"}
                </button>
              </form>
            </section>
            <aside className="setup-aside">
              <h2>اولین بار است؟</h2>
              <p>مسئول نصب یک‌بار راه‌اندازی محلی را انجام دهد:</p>
              <pre>
                <code>npm run setup:local</code>
              </pre>
              <p>کلید ورود در این فایل خصوصی است:</p>
              <code>.local/operator-access.txt</code>
            </aside>
          </div>
        ) : (
          <>
            {expired ? (
              <div className="note" role="alert">
                <p>
                  نشست شما پایان یافته است. پیشرفت ذخیره‌شده حفظ می‌شود؛ برای ادامه دوباره وارد شوید.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    sessionNotice.current = "expired";
                    onSessionExpired();
                  }}
                >
                  ورود دوباره
                </button>
              </div>
            ) : null}
            <div hidden={mode !== "source"}>
              <section
                className="panel project-choice"
                aria-labelledby="choose-project-title"
                aria-busy={busy === "prepare"}
              >
                <div className="section-heading">
                  <h2 id="choose-project-title">
                    {flow ? "پروژه انتخاب‌شده" : "پروژه‌تان را انتخاب کنید"}
                  </h2>
                  {flow?.selection.kind === "sample" ? (
                    <span className="badge badge-warning">پروژه نمونه</span>
                  ) : flow ? (
                    <span className="badge badge-quiet">
                      {flow.selection.kind === "github" ? "از GitHub" : "روی این رایانه"}
                    </span>
                  ) : null}
                </div>
                {flow ? (
                  <p className="selected-project">
                    <strong>
                      <bdi>{projectName(flow)}</bdi>
                    </strong>
                  </p>
                ) : null}
                <div className="project-picker-actions">
                  <button
                    type="button"
                    ref={folderTrigger}
                    disabled={disabled || workspace.capabilities.workspace.state !== "available"}
                    aria-describedby={projectError ? "project-error" : "project-choice-help"}
                    onClick={() => {
                      restoreFocus.current = "folder";
                      setFolderOpen(true);
                    }}
                  >
                    <FolderIcon />
                    {flow ? "تغییر پوشه پروژه" : "انتخاب پوشه پروژه"}
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    ref={githubTrigger}
                    disabled={disabled}
                    onClick={() => {
                      restoreFocus.current = "github";
                      setGitHubOpen(true);
                    }}
                  >
                    انتخاب از GitHub
                  </button>
                </div>
                <p id="project-choice-help" className="hint">
                  فایل‌های پروژه خودکار بررسی و برای پیشنهاد آماده می‌شوند. در این مرحله کد اجرا و
                  فایلی به لیارا ارسال نمی‌شود.
                </p>
                {workspace.capabilities.workspace.state !== "available" ? (
                  <p className="note">
                    پوشه‌های محلی این نصب هنوز تعیین نشده‌اند. از GitHub انتخاب کنید یا با پروژه نمونه
                    امتحان کنید.
                  </p>
                ) : null}
                {busy === "prepare" ? (
                  <button type="button" className="button-secondary" onClick={cancelPrepare}>
                    لغو بررسی پروژه
                  </button>
                ) : (
                  <div className="choice-secondary">
                    <button
                      type="button"
                      className="button-quiet"
                      ref={sampleTrigger}
                      disabled={disabled}
                      onClick={() =>
                        void prepare(
                          {
                            kind: "sample",
                            directory: "examples/node-service",
                          },
                          "sample",
                        )
                      }
                    >
                      امتحان با پروژه نمونه
                    </button>
                    {flow ? (
                      <button
                        type="button"
                        className="button-quiet"
                        disabled={disabled}
                        onClick={() => void prepare(flow.selection, "folder")}
                      >
                        بررسی دوباره پروژه
                      </button>
                    ) : null}
                  </div>
                )}
                {projectError ? (
                  <div
                    id="project-error"
                    role="alert"
                    aria-label="پروژه بررسی نشد"
                    ref={projectErrorBox}
                    tabIndex={-1}
                    className="note note-danger"
                  >
                    <p>{projectError.message}</p>
                    {projectError.requestId ? (
                      <details>
                        <summary>شناسه پیگیری</summary>
                        <code>{projectError.requestId}</code>
                      </details>
                    ) : null}
                  </div>
                ) : null}
                <details className="advanced-choice">
                  <summary>انتخاب با مسیر داخل پوشه مجاز</summary>
                  <p className="hint">
                    برای استفاده تخصصی؛ مسیر باید داخل محدوده مجاز همین نصب باشد. راه معمول، دکمه
                    انتخاب پوشه است.
                  </p>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void prepare({ kind: "local", directory: manualDirectory }, "manual");
                    }}
                  >
                    <label htmlFor="project-directory">پوشه پروژه</label>
                    <input
                      id="project-directory"
                      dir="ltr"
                      value={manualDirectory}
                      onChange={(event) => setManualDirectory(event.target.value)}
                      maxLength={240}
                      required
                      disabled={disabled}
                      aria-describedby={projectError ? "project-error" : undefined}
                      aria-invalid={Boolean(projectError) || undefined}
                    />
                    <button
                      type="submit"
                      className="button-secondary"
                      ref={manualTrigger}
                      disabled={disabled}
                    >
                      بررسی پوشه واردشده
                    </button>
                  </form>
                </details>
              </section>
              {flow && profile ? (
                <div className="workbench-grid project-review">
                  <div className="primary-column">
                    <section className="panel" aria-labelledby="profile-title">
                      <div className="section-heading">
                        <h2 id="profile-title" tabIndex={-1} ref={resultHeading}>
                          نتیجه بررسی پروژه
                        </h2>
                        <span
                          className={`badge ${flow.status === "ready" ? "badge-ok" : "badge-warning"}`}
                        >
                          {flow.status === "ready"
                            ? "فایل‌ها آماده‌اند"
                            : flow.status === "incomplete"
                              ? "نیاز به تکمیل پروژه"
                              : "نیاز به بررسی دوباره"}
                        </span>
                      </div>
                      {flow.message ? <p className="note">{flow.message}</p> : null}
                      <dl className="profile-facts">
                        <div>
                          <dt>نوع پروژه</dt>
                          <dd>
                            {profile.runtime === "node" ? <bdi>Node.js</bdi> : "هنوز شناسایی نشده"}
                          </dd>
                        </div>
                        <div>
                          <dt>فایل‌های قابل ارسال</dt>
                          <dd>{number(profile.manifest.length)} فایل</dd>
                        </div>
                        <div>
                          <dt>حجم فایل‌ها</dt>
                          <dd>{number(Math.ceil(profile.totalBytes / 1024))} کیلوبایت</dd>
                        </div>
                        <div>
                          <dt>آماده‌سازی محلی</dt>
                          <dd>{action?.deployment?.sourceId ? "رسید ارسال بسته ثبت شده" : action?.deployment ? "ارسال آغاز شده؛ رسید کامل نداریم" : flow.artifact ? "انجام شد؛ ارسال نشده" : "پس از تکمیل پروژه"}</dd>
                        </div>
                      </dl>
                      {profile.port !== null ? (
                        <p className="hint">
                          پورت <bdi>{profile.port}</bdi> از تنظیمات یا کد پروژه مشخص شد؛ نیازی به
                          واردکردن دوباره آن نیست.
                        </p>
                      ) : null}
                      <details className="manifest">
                        <summary>
                          فایل‌های قابل ارسال را ببینید ({number(profile.manifest.length)})
                        </summary>
                        <p className="hint">
                          فایل‌های خصوصی، پوشه وابستگی‌ها و تنظیمات محرمانه کنار گذاشته شده‌اند. فقط
                          این فایل‌ها در بسته محلی قرار دارند.
                        </p>
                        <ul className="file-manifest">
                          {profile.manifest.map((file) => (
                            <li key={file.path}>
                              <bdi>{file.path}</bdi>
                              <span>{number(file.bytes)} بایت</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                      <details className="technical-details">
                        <summary>تنظیمات شناسایی‌شده</summary>
                        <dl>
                          <div>
                            <dt>نسخه Node</dt>
                            <dd>
                              <bdi>{profile.nodeVersion || "در پروژه مشخص نشده"}</bdi>
                            </dd>
                          </div>
                          <div>
                            <dt>فرمان اجرا</dt>
                            <dd>
                              {profile.start ? (
                                <code>{profile.start}</code>
                              ) : (
                                "مشخص نشده؛ scripts.start در package.json را تکمیل کنید."
                              )}
                            </dd>
                          </div>
                          <div>
                            <dt>فرمان ساخت</dt>
                            <dd>
                              {profile.build ? <code>{profile.build}</code> : "در پروژه تعریف نشده"}
                            </dd>
                          </div>
                        </dl>
                        <p className="hint">
                          این فرمان‌ها فقط خوانده شده‌اند و هنگام بررسی اجرا نمی‌شوند.
                        </p>
                      </details>
                      {profile.envNames.length ? (
                        <div className="env-list">
                          <h3>تنظیمات برنامه که به بررسی نیاز دارند</h3>
                          <p className="hint">
                            نام این متغیرها در کد دیده شد؛ ضروری‌بودن یا مقدار آن‌ها از روی نام حدس
                            زده نمی‌شود. فایل خصوصی خوانده نشده است. تکمیل و ارسال امن مقادیر در این
                            نسخه هنوز آماده نیست.
                          </p>
                          <div>
                            {profile.envNames.map((name) => (
                              <code key={name}>{name}</code>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </section>
                    {!action && flow.status === "ready" ? (
                      <section className="panel" aria-labelledby="next-title">
                        <h2 id="next-title">
                          {!connected
                            ? "حساب مقصد را متصل کنید"
                            : !liara?.selectedApp
                              ? "برنامه مقصد را انتخاب کنید"
                              : "پیشنهاد انتشار را بررسی کنیم"}
                        </h2>
                        {!connected || !liara?.selectedApp ? (
                          <>
                            <p>فایل‌ها آماده‌اند. برای پیشنهاد مشخص، حساب و برنامه مقصد لازم است.</p>
                            <button type="button" disabled={disabled} onClick={openAccounts}>
                              {connected ? "انتخاب برنامه در لیارا" : "اتصال حساب لیارا"}
                            </button>
                          </>
                        ) : (
                          <form onSubmit={propose}>
                            <p>
                              مقصد: <strong>{liara.teamName}</strong> /{" "}
                              <bdi>{liara.selectedApp}</bdi>. پیشنهاد شامل فایل‌ها، اثر انتشار و
                              اطلاعات هزینه در دسترس خواهد بود.
                            </p>
                            {workspace.features.deployment ? (
                              <>
                                <label htmlFor="deployment-path">مسیر بررسی نسخه</label>
                                <input
                                  id="deployment-path"
                                  dir="ltr"
                                  value={workloadPath}
                                  onChange={(event) => setWorkloadPath(event.target.value)}
                                  required
                                  maxLength={200}
                                  disabled={disabled}
                                  aria-describedby="deployment-oracle-help"
                                />
                                <label htmlFor="deployment-revision">نسخه مورد انتظار</label>
                                <input
                                  id="deployment-revision"
                                  dir="ltr"
                                  value={expectedRevision}
                                  onChange={(event) => setExpectedRevision(event.target.value)}
                                  required
                                  maxLength={128}
                                  disabled={disabled}
                                  aria-describedby="deployment-oracle-help"
                                />
                                <p id="deployment-oracle-help" className="hint">
                                  همین مسیر باید JSON با فیلد revision و نسخه واردشده برگرداند. پاسخ
                                  ۲۰۰ از نسخه قبلی کافی نیست. نشانی سایت را در اتصال حساب‌ها مشخص
                                  کنید.
                                </p>
                              </>
                            ) : null}
                            {profile.port === null ? (
                              <>
                                <label htmlFor="project-port">پورت برنامه</label>
                                <input
                                  id="project-port"
                                  type="number"
                                  dir="ltr"
                                  min={1}
                                  max={65535}
                                  value={port}
                                  required
                                  disabled={disabled}
                                  onChange={(event) => setPort(event.target.value)}
                                  aria-describedby="port-help"
                                />
                                <p id="port-help" className="hint">
                                  پورت از کد مشخص نشد. عددی را وارد کنید که برنامه برای دریافت
                                  درخواست‌ها استفاده می‌کند؛ معمولاً در فایل اجرای پروژه آمده است.
                                </p>
                              </>
                            ) : (
                              <details>
                                <summary>اصلاح پورت تشخیص‌داده‌شده</summary>
                                <label htmlFor="project-port">پورت برنامه</label>
                                <input
                                  id="project-port"
                                  type="number"
                                  dir="ltr"
                                  min={1}
                                  max={65535}
                                  value={port}
                                  required
                                  disabled={disabled}
                                  onChange={(event) => setPort(event.target.value)}
                                />
                              </details>
                            )}
                            <button
                              type="submit"
                              disabled={
                                disabled ||
                                !port ||
                                (workspace.features.deployment && !expectedRevision)
                              }
                            >
                              {busy === "proposal"
                                ? "در حال آماده‌کردن پیشنهاد…"
                                : "دریافت پیشنهاد انتشار"}
                            </button>
                          </form>
                        )}
                      </section>
                    ) : null}
                    {action ? (
                      <div ref={proposalHeading} tabIndex={-1}>
                        <Proposal
                          action={action}
                          workspace={workspace}
                          busy={busy !== null}
                          expired={expired}
                          onDecision={(selected, decision) => void decide(selected, decision)}
                          onNewProposal={() => void propose()}
                          onOperation={(operation) => void deploymentOperation(operation)}
                          onNextVersion={() => void prepare(flow.selection, "folder")}
                        />
                        {busy === "execute" || busy === "observe" ? (
                          <button
                            type="button"
                            className="button-secondary"
                            onClick={() => pending.current?.abort()}
                          >
                            توقف انتظار
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <aside className="context-column">
                    <section className="panel" aria-labelledby="journey-title">
                      <h2 id="journey-title">قدم بعدی</h2>
                      <ol className="task-progress">
                        {[
                          "انتخاب و بررسی پروژه",
                          "حساب و برنامه مقصد",
                          "پیشنهاد قابل بررسی",
                          "تصمیم شما",
                          "اجرای انتشار",
                          "بررسی نتیجه سایت",
                        ].map((label, index) => (
                          <li
                            key={label}
                            aria-current={index === step ? "step" : undefined}
                            className={index === step ? "current" : index < step ? "visited" : ""}
                          >
                            <span className="step-number" aria-hidden="true">
                              {number(index + 1)}
                            </span>
                            {label}
                          </li>
                        ))}
                      </ol>
                      <p className="hint">
                        {action?.state === "uncertain"
                          ? "نتیجه نامعلوم است؛ اجرای تازه بسته می‌ماند."
                          : action?.state === "approved"
                            ? "تأیید ثبت شده، اما انتشار واقعی در این نصب هنوز آماده نیست."
                            : !connected
                              ? "بررسی محلی کامل است؛ اتصال حساب مرحله مستقل بعدی است."
                              : "هر مرحله فقط با نتیجه واقعی همان پروژه جلو می‌رود."}
                      </p>
                    </section>
                    <section className="panel">
                      <h2>مقصد انتشار</h2>
                      <p>
                        {connected ? (
                          <>
                            {liara?.teamName} /{" "}
                            <bdi>{liara?.selectedApp || "برنامه انتخاب نشده"}</bdi>
                          </>
                        ) : (
                          "حساب لیارا متصل نشده است."
                        )}
                      </p>
                      {connected ? (
                        <button
                          type="button"
                          className="button-secondary"
                          disabled={disabled}
                          onClick={openAccounts}
                        >
                          بررسی یا تغییر مقصد
                        </button>
                      ) : null}
                      <p className="hint">
                        هزینه، ارسال فایل و تغییر زیرساخت با اتصال حساب شروع نمی‌شوند.
                      </p>
                    </section>
                  </aside>
                </div>
              ) : null}
            </div>
            <div hidden={mode !== "incident"}>
              <IncidentWorkbench
                workspace={workspace}
                active={mode === "incident"}
                onConnect={openAccounts}
                onRefresh={refresh}
                disabled={expired}
                onSessionExpired={onSessionExpired}
              />
            </div>
            {folderOpen ? (
              <FolderPicker
                csrf={workspace.session.csrfToken}
                initial={flow?.selection.kind === "local" ? flow.selection.directory : "."}
                onSelect={(directory) => {
                  setFolderOpen(false);
                  restoreFocus.current = null;
                  void prepare({ kind: "local", directory }, "folder");
                }}
                onCancel={() => {
                  restoreFocus.current = "folder";
                  setFolderOpen(false);
                }}
              />
            ) : null}
            {accountsOpen ? (
              <ConnectionDialog
                workspace={workspace}
                purpose={mode}
                onRefresh={refresh}
                onGitHub={() => {
                  setAccountsOpen(false);
                  setGitHubOpen(true);
                  restoreFocus.current = "accounts";
                }}
                onClose={() => {
                  setAccountsOpen(false);
                  restoreFocus.current = "accounts";
                }}
                onSessionExpired={onSessionExpired}
              />
            ) : null}
            {githubOpen ? (
              <GitHubProjectPicker
                csrf={workspace.session.csrfToken}
                initialConnection={workspace.connections.github}
                onRefresh={refresh}
                onSelect={(selection, signal) => prepare(selection, "github", signal)}
                onClose={(selected) => {
                  setGitHubOpen(false);
                  restoreFocus.current = selected ? null : "github";
                }}
                onSessionExpired={onSessionExpired}
              />
            ) : null}
          </>
        )}
        <footer className="app-footer">
          <p>Launchlane · نتیجه هر عملیات باید با شواهد بررسی شود.</p>
        </footer>
      </main>
    </>
  );
}
