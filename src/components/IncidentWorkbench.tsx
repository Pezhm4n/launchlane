"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { Action, WorkspaceView } from "../contracts/domain.ts";
import { parseIncidentRun, type IncidentRun, type Symptom } from "../contracts/incident-run.ts";
import { object } from "../contracts/validation.ts";
import { api, ClientError } from "./api.ts";
import { IncidentReport } from "./IncidentReport.tsx";
import { RestartPanel } from "./RestartPanel.tsx";
import { latestIncidentEvidence } from "../contracts/incident-evidence.ts";
const choices: { id: Symptom; title: string }[] = [
  { id: "unavailable", title: "سایت باز نمی‌شود" },
  { id: "errors", title: "خطا نشان می‌دهد" },
  { id: "slow", title: "کند شده است" },
  { id: "other", title: "مشکل دیگری دارد" },
];
const cases = [
  { id: "configuration", label: "نمونه خطای سرور و تنظیمات ناقص" },
  { id: "contradictory", label: "نمونه شواهد متفاوت و علت نامعلوم" },
  { id: "insufficient", label: "نمونه با گزارش‌های ناموجود" },
  { id: "latency", label: "نمونه مقایسه زمان پاسخ" },
] as const;
const decodeRun = (value: unknown) => {
  const raw = object(value).run;
  return raw === null ? null : parseIncidentRun(raw);
};
function readLocation() {
  const params = new URLSearchParams(window.location.search);
  return {
    kind: params.get("incident_mode") === "sample" ? ("sample" as const) : ("live" as const),
    id: /^[a-f0-9-]{36}$/.test(params.get("incident") || "") ? params.get("incident") : null,
  };
}
function writeLocation(kind: "live" | "sample", id: string | null, replace = false) {
  const url = new URL(window.location.href);
  url.searchParams.set("incident_mode", kind);
  id ? url.searchParams.set("incident", id) : url.searchParams.delete("incident");
  window.history[replace ? "replaceState" : "pushState"]({}, "", url);
}
export function IncidentWorkbench({
  workspace,
  active,
  disabled,
  onConnect,
  onRefresh,
  onSessionExpired,
  onAction,
}: {
  workspace: WorkspaceView;
  active: boolean;
  disabled: boolean;
  onConnect: () => void;
  onRefresh: () => Promise<WorkspaceView>;
  onSessionExpired: () => void;
  onAction: (action: Action) => void;
}) {
  const [kind, setKind] = useState<"live" | "sample">("live"),
    [live, setLive] = useState<IncidentRun | null>(null),
    [sample, setSample] = useState<IncidentRun | null>(null);
  const [symptom, setSymptom] = useState<Symptom>("unavailable"),
    [problem, setProblem] = useState(""),
    [path, setPath] = useState("/");
  const [loading, setLoading] = useState(true),
    [restartBusy, setRestartBusy] = useState(false),
    [busy, setBusy] = useState<string | null>(null),
    [error, setError] = useState<ClientError | null>(null),
    [notice, setNotice] = useState("");
  const pending = useRef<AbortController | null>(null),
    restoring = useRef<AbortController | null>(null),
    returnFocus = useRef(false);
  const returnTarget = useRef<HTMLElement | null>(null);
  const title = useRef<HTMLHeadingElement>(null),
    errorBox = useRef<HTMLDivElement>(null),
    primary = useRef<HTMLButtonElement>(null),
    sampleTrigger = useRef<HTMLButtonElement>(null);
  const current = kind === "live" ? live : sample,
    connection = workspace.connections.liara,
    scopeReady = connection?.status === "connected" && Boolean(connection.selectedApp);
  const operationEvidence = current ? latestIncidentEvidence(current, workspace.actions) : null;
  const sameApp =
    current?.kind === "sample" ||
    (scopeReady &&
      current?.evidence.scope.app === connection?.selectedApp &&
      Boolean(current?.appId) &&
      current?.appId === connection?.apps.find((app) => app.name === connection.selectedApp)?.id &&
      current?.evidence.scope.teamId === connection?.teamId);
  const canRead = scopeReady && workspace.features.serviceReads && Boolean(sameApp),
    blocked = disabled || busy !== null || loading || restartBusy;
  const accept = useCallback((run: IncidentRun | null, requestedKind: "live" | "sample") => {
    if (run?.kind === "sample") setSample(run);
    else if (run) {
      setLive(run);
      setSymptom(run.symptom);
      setProblem(run.problem);
      setPath(run.path);
    } else if (requestedKind === "sample") setSample(null);
    else setLive(null);
    if (run) setKind(run.kind);
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
              "INCIDENT_CONNECTION_FAILED",
              "پاسخ بررسی دریافت نشد. ورودی‌ها و نتیجه قبلی حفظ شده‌اند؛ دوباره تلاش کنید.",
            ),
      );
    },
    [onSessionExpired],
  );
  const restore = useCallback(
    async (requestedKind: "live" | "sample", id: string | null, signal: AbortSignal) => {
      const run = await api(
        `/api/incidents/runs?kind=${requestedKind}${id ? `&id=${id}` : ""}`,
        decodeRun,
        { signal },
      );
      if (!signal.aborted) {
        accept(run, requestedKind);
        if (run) writeLocation(run.kind, run.id, true);
      }
    },
    [accept],
  );
  useEffect(() => {
    const controller = new AbortController(),
      location = readLocation();
    restoring.current = controller;
    setKind(location.kind);
    setLoading(true);
    restore(location.kind, location.id, controller.signal)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) fail(error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    const pop = () => {
      pending.current?.abort();
      pending.current = null;
      setBusy(null);
      restoring.current?.abort();
      const next = readLocation(),
        controller = new AbortController();
      restoring.current = controller;
      setKind(next.kind);
      setError(null);
      setLoading(true);
      restore(next.kind, next.id, controller.signal)
        .catch((error: unknown) => {
          if (!controller.signal.aborted) fail(error);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    };
    window.addEventListener("popstate", pop);
    return () => {
      controller.abort();
      restoring.current?.abort();
      pending.current?.abort();
      window.removeEventListener("popstate", pop);
    };
  }, [restore, fail]);
  useEffect(() => {
    if (active) title.current?.focus();
  }, [active]);
  useEffect(() => {
    if (error) errorBox.current?.focus();
  }, [error]);
  useEffect(() => {
    if (busy === null && returnFocus.current) {
      returnFocus.current = false;
      if (returnTarget.current?.isConnected && !returnTarget.current.hasAttribute("disabled"))
        returnTarget.current.focus();
      else if (!primary.current?.disabled) primary.current?.focus();
      else sampleTrigger.current?.focus();
    }
  }, [busy]);
  useEffect(() => {
    if (current?.analysis !== "pending" || !active) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined,
      reads = 0;
    const check = async () => {
      try {
        const next = await api(`/api/incidents/runs?id=${current.id}`, decodeRun, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (next) accept(next, "live");
        if (next?.analysis === "pending" && ++reads < 30) timer = setTimeout(check, 2000);
        else if (next?.analysis === "pending")
          setNotice(
            "هنوز پاسخ نهایی نداریم. وضعیت همین بررسی را بازیابی کنید؛ تحلیل تکرار نمی‌شود.",
          );
      } catch (error) {
        if (!controller.signal.aborted) fail(error);
      }
    };
    timer = setTimeout(check, 1500);
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [current?.id, current?.analysis, active, accept, fail]);
  async function job(
    operation: "collect" | "sample" | "compare" | "recheck" | "analyze",
    body: Record<string, unknown>,
  ) {
    if (blocked || pending.current) return;
    returnTarget.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(operation);
    setError(null);
    setNotice("");
    try {
      const result = await api("/api/incidents/runs", decodeRun, {
        body: { operation, ...body },
        csrf: workspace.session.csrfToken,
        signal: controller.signal,
      });
      if (controller.signal.aborted || pending.current !== controller || !result) return;
      accept(result, operation === "sample" ? "sample" : kind);
      setKind(result.kind);
      writeLocation(result.kind, result.id);
      setNotice(
        result.kind === "sample"
          ? "نتیجه نمونه ذخیره شد؛ هیچ سرویس واقعی فراخوانی یا تغییر نکرد."
          : "اطلاعات در دسترس ثبت شد. پاسخ سایت، علت احتمالی و محدودیت‌ها را جدا بررسی کنید.",
      );
      if (operation === "collect") await onRefresh();
    } catch (error) {
      if (pending.current !== controller) return;
      if (controller.signal.aborted) {
        setNotice(
          operation === "analyze"
            ? "توضیح شواهد متوقف شد. وضعیت همین بررسی را بازیابی کنید؛ درخواست تکراری فرستاده نمی‌شود."
            : "درخواست متوقف شد. ورودی‌ها و نتیجه قبلی حفظ شده‌اند.",
        );
        returnFocus.current = true;
      } else fail(error);
      if (operation === "analyze" && current) {
        const saved = await api(`/api/incidents/runs?id=${current.id}`, decodeRun).catch(
          () => null,
        );
        if (pending.current === controller && saved) accept(saved, "live");
      }
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setBusy(null);
      }
    }
  }
  function collect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!connection?.selectedApp) return;
    void job("collect", { app: connection.selectedApp, symptom, problem, path });
  }
  function example(scenario: string = "configuration") {
    setKind("sample");
    void job("sample", { scenario });
  }
  function real() {
    setKind("live");
    setError(null);
    setNotice("");
    writeLocation("live", live?.id ?? null);
  }
  async function retrieve() {
    if (!current) return;
    const controller = new AbortController();
    setError(null);
    try {
      await restore(current.kind, current.id, controller.signal);
    } catch (error) {
      fail(error);
    }
  }
  return (
    <div className="incident-workbench primary-column">
      <section className="panel" aria-labelledby="incident-title" aria-busy={busy !== null}>
        <div className="section-heading">
          <h2 id="incident-title" tabIndex={-1} ref={title}>
            {kind === "sample" ? "آشنایی با یک نمونه" : "مشکل سایت را از کجا بررسی کنیم؟"}
          </h2>
          {kind === "sample" ? <span className="badge badge-warning">حالت آزمایشی</span> : null}
        </div>
        {kind === "sample" ? (
          <>
            <p>
              این نمونه، روش خواندن شواهد و بررسی نتیجه را نشان می‌دهد. علت‌ها از پیش نوشته شده‌اند و
              هیچ حساب واقعی بررسی نمی‌شود.
            </p>
            <button type="button" className="button-secondary" disabled={blocked} onClick={real}>
              بازگشت به بررسی سایت من
            </button>
            <details className="sample-cases">
              <summary>نمونه‌های دیگر یا شروع دوباره</summary>
              <div className="button-row">
                {cases.map((item) => (
                  <button
                    type="button"
                    className="button-secondary"
                    key={item.id}
                    disabled={blocked}
                    onClick={() => example(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </details>
          </>
        ) : !scopeReady ? (
          <>
            <p>
              برنامه‌ای از حساب لیارا انتخاب کنید تا اطلاعات همان سایت بررسی شود. اتصال حساب اجازه
              تغییر همه برنامه‌ها را نمی‌دهد.
            </p>
            <button type="button" ref={primary} disabled={blocked} onClick={onConnect}>
              {connection?.status === "connected" ? "انتخاب برنامه در لیارا" : "اتصال حساب لیارا"}
            </button>
          </>
        ) : (
          <>
            <div className="section-heading">
              <p>
                برنامه:{" "}
                <strong>
                  <bdi>{connection?.selectedApp}</bdi>
                </strong>{" "}
                / {connection?.teamName}
              </p>
              <button type="button" className="button-quiet" disabled={blocked} onClick={onConnect}>
                تغییر برنامه یا نشانی سایت
              </button>
            </div>
            {!workspace.features.probeOrigin ? (
              <div className="note">
                <p>
                  نشانی سایت برای بررسی پاسخ هنوز ثبت نشده است. گزارش‌های برنامه را می‌توان مستقل
                  خواند؛ برای بررسی خود صفحه، نشانی آن را اضافه کنید.
                </p>
                <button
                  type="button"
                  className="button-secondary"
                  disabled={blocked}
                  onClick={onConnect}
                >
                  ثبت نشانی سایت
                </button>
              </div>
            ) : (
              <p className="hint">
                نشانی بررسی: <bdi>{workspace.features.probeOrigin}</bdi>
              </p>
            )}
            <form onSubmit={collect}>
              <fieldset disabled={disabled || busy !== null}>
                <legend>چه مشکلی می‌بینید؟</legend>
                <div className="symptom-options">
                  {choices.map((choice) => (
                    <label className="radio-option" key={choice.id}>
                      <input
                        type="radio"
                        name="incident-symptom"
                        checked={symptom === choice.id}
                        onChange={() => setSymptom(choice.id)}
                      />
                      {choice.title}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label htmlFor="incident-problem">
                توضیح مشکل {symptom !== "other" ? "(اختیاری)" : ""}
              </label>
              <textarea
                id="incident-problem"
                value={problem}
                maxLength={1000}
                required={symptom === "other"}
                disabled={disabled || busy !== null}
                onChange={(event) => setProblem(event.target.value)}
                placeholder="مثلاً پس از انتشار، صفحه اصلی خطای سرور نشان می‌دهد."
                aria-describedby={
                  error?.code === "INCIDENT_SENSITIVE_INPUT" ||
                  error?.code === "INCIDENT_DESCRIPTION_REQUIRED"
                    ? "incident-description-help incident-error"
                    : "incident-description-help"
                }
                aria-invalid={
                  error?.code === "INCIDENT_SENSITIVE_INPUT" ||
                  error?.code === "INCIDENT_DESCRIPTION_REQUIRED" ||
                  undefined
                }
              />
              <p id="incident-description-help" className="hint">
                رمز، کلید دسترسی و اطلاعات شخصی را در توضیح وارد نکنید.
              </p>
              <details>
                <summary>مشکل در صفحه دیگری از سایت است</summary>
                <label htmlFor="incident-path">آدرس صفحه مورد نظر</label>
                <input
                  id="incident-path"
                  dir="ltr"
                  value={path}
                  maxLength={512}
                  onChange={(event) => setPath(event.target.value)}
                  disabled={disabled || busy !== null}
                  aria-describedby={
                    error?.code === "INCIDENT_PATH_INVALID"
                      ? "incident-path-help incident-error"
                      : "incident-path-help"
                  }
                  aria-invalid={error?.code === "INCIDENT_PATH_INVALID" || undefined}
                />
                <p id="incident-path-help" className="hint">
                  برای صفحه اصلی / کافی است؛ می‌توانید مسیر دیگری مثل /checkout یا آدرس همان سایت را
                  وارد کنید. بخش‌های دارای رمز یا پارامتر را حذف کنید.
                </p>
              </details>
              {symptom === "slow" ? <p className="hint" id="latency-collection-help">برای بررسی کندی، حداکثر سه درخواست کوتاه و متوالی به همین صفحه فرستاده می‌شود. تغییری در برنامه انجام نمی‌شود؛ زمان بارگذاری کامل صفحه اندازه‌گیری نمی‌شود.</p> : null}
              <button
                type="submit"
                ref={primary}
                disabled={blocked || !workspace.features.serviceReads}
                aria-describedby={
                  !workspace.features.serviceReads ? "incident-access-help" : symptom === "slow" ? "latency-collection-help" : undefined
                }
              >
                {busy === "collect" ? "در حال بررسی مشکل…" : "بررسی مشکل سایت"}
              </button>
            </form>
            {!workspace.features.serviceReads ? (
              <div id="incident-access-help" className="note">
                <p>
                  خواندن اطلاعات برنامه در این نصب هنوز فعال نشده است. پس از آماده‌شدن دسترسی، مسئول
                  نصب آن را فعال می‌کند؛ فعلاً نتیجه واقعی ساخته نمی‌شود.
                </p>
                <div className="button-row">
                  <button
                    type="button"
                    className="button-secondary"
                    disabled={blocked}
                    onClick={() => void onRefresh().catch(fail)}
                  >
                    بازخوانی وضعیت دسترسی
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    disabled={blocked}
                    onClick={onConnect}
                  >
                    بررسی اتصال حساب
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
        {kind === "live" ? (
          <div className="sample-entry">
            <p className="hint">می‌خواهید ابتدا روش کار را ببینید؟</p>
            <button
              type="button"
              className="button-quiet"
              ref={sampleTrigger}
              disabled={blocked}
              onClick={() => example()}
            >
              امتحان با نمونه اختلال
            </button>
          </div>
        ) : null}
        {loading ? <p role="status">در حال بازیابی نتیجه ذخیره‌شده…</p> : null}
        {busy ? (
          <>
            <p role="status">
              {busy === "sample" || busy === "compare"
                ? "در حال آماده‌کردن نتیجه نمونه…"
                : busy === "analyze"
                  ? "در حال توضیح شواهد همین بررسی…"
                  : "در حال خواندن اطلاعات مجاز برنامه…"}
            </p>
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                returnFocus.current = true;
                pending.current?.abort();
              }}
            >
              لغو بررسی
            </button>
          </>
        ) : null}
        <div className="live-message compact-status" role="status" aria-live="polite">
          {notice}
        </div>
        {error ? (
          <div
            id="incident-error"
            className="error-banner"
            role="alert"
            aria-label="بررسی مشکل کامل نشد"
            ref={errorBox}
            tabIndex={-1}
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
      </section>
      {current ? (
        <>
          {current.kind === "live" && !sameApp ? (
            <div className="note">
              <p>
                این نتیجه به برنامه قبلی <bdi>{current.evidence.scope.app}</bdi> مربوط است. برای
                برنامه فعلی، بررسی تازه‌ای شروع کنید یا همان برنامه قبلی را انتخاب کنید.
              </p>
              <button
                type="button"
                className="button-secondary"
                disabled={blocked}
                onClick={onConnect}
              >
                انتخاب برنامه
              </button>
            </div>
          ) : null}
          <IncidentReport
            key={current.id}
            run={current}
            busy={blocked}
            canRead={canRead}
            canAnalyze={Boolean(sameApp && workspace.features.analysis)}
            onAnalyze={() => void job("analyze", { id: current.id })}
            onRecheck={() => void job("recheck", { id: current.id })}
            onCompare={(choice) => void job("compare", { id: current.id, choice })}
            onRestore={() => void retrieve()}
            operationEvidence={operationEvidence}
            onSessionExpired={onSessionExpired}
          />
          {current.kind === "live" ? <RestartPanel key={`restart-${current.id}`} run={current} workspace={workspace}
            active={active} disabled={disabled || busy !== null || loading} onAction={onAction}
            onBusyChange={setRestartBusy} onRefresh={onRefresh} onConnect={onConnect}
            onRecheck={() => void job("recheck", { id: current.id })} onSessionExpired={onSessionExpired} /> : null}
        </>
      ) : kind === "sample" && !loading && !busy ? (
        <button type="button" ref={sampleTrigger} disabled={blocked} onClick={() => example()}>
          اجرای نمونه خطای سرور
        </button>
      ) : null}
    </div>
  );
}
