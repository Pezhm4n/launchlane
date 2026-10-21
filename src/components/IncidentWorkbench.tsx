"use client";

import { useEffect, useRef, useState } from "react";
import {
  inWindow,
  parseDiagnosis,
  parseEvidenceBundle,
  verifySameSymptom,
  type Diagnosis,
  type EvidenceBundle,
  type Verification,
} from "../contracts/incident.ts";
import { object } from "../contracts/validation.ts";
import { ensure } from "../server/errors.ts";
import { api, ClientError } from "./api.ts";

type Practice = { evidence: EvidenceBundle; diagnosis: Diagnosis };
const scenarios = [
  {
    id: "configuration",
    title: "تنظیمات ناقص",
    description: "خطای ۵۰۰ همراه پیام پیکربندی؛ یک اصلاح مرتبط و یک اصلاح نامرتبط را مقایسه کنید.",
  },
  {
    id: "contradictory",
    title: "شواهد متناقض",
    description: "همان خطا با پیامی متفاوت؛ فرضیه قبلی باید دوباره بررسی شود.",
  },
  {
    id: "insufficient",
    title: "شواهد ناکافی",
    description: "خطا دیده می‌شود، اما logs در دسترس نیست؛ علت نامعلوم می‌ماند.",
  },
] as const;
const sourceNames = {
  workload: "پاسخ درخواست اصلی",
  project: "پیکربندی برنامه",
  logs: "پیام‌های برنامه",
  events: "رویدادها",
  releases: "انتشارها",
  applets: "اجرای برنامه",
  metrics: "CPU و RAM",
};
function decodePractice(value: unknown): Practice {
  const raw = object(value),
    evidence = parseEvidenceBundle(raw.evidence),
    diagnosis = object(raw.diagnosis);
  ensure(
    raw.analysis === "scripted" && raw.providerRequests === 0 && evidence.mode === "simulated",
    "RESPONSE_INVALID",
    "نوع تمرین روشن نیست.",
  );
  return {
    evidence,
    diagnosis: parseDiagnosis(
      { summary: diagnosis.summary, hypotheses: diagnosis.hypotheses },
      evidence,
    ),
  };
}
function decodeComparison(value: unknown): Verification {
  const raw = object(value),
    before = parseEvidenceBundle(raw.before),
    after = parseEvidenceBundle(raw.after);
  ensure(
    raw.simulated === true &&
      raw.changedInfrastructure === false &&
      before.mode === "simulated" &&
      after.mode === "simulated",
    "RESPONSE_INVALID",
    "مرز مقایسه تمرینی معتبر نیست.",
  );
  return verifySameSymptom(before, after);
}
const time = (value: number) =>
  new Intl.DateTimeFormat("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Tehran",
  }).format(value);

export function IncidentWorkbench({
  csrf,
  disabled,
  onSessionExpired,
}: {
  csrf: string;
  disabled: boolean;
  onSessionExpired: () => void;
}) {
  const [scenario, setScenario] = useState<string>("configuration");
  const [practice, setPractice] = useState<Practice | null>(null);
  const [comparison, setComparison] = useState<Verification | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [activeStep, setActiveStep] = useState<"evidence" | "diagnosis" | "comparison">("evidence");
  const returnFocus = useRef(false);
  const evidenceFocus = useRef<string | null>(null);
  const pending = useRef<AbortController | null>(null);
  const title = useRef<HTMLHeadingElement>(null),
    result = useRef<HTMLHeadingElement>(null),
    outcome = useRef<HTMLHeadingElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    errorBox = useRef<HTMLDivElement>(null);
  const diagnosisHeading = useRef<HTMLHeadingElement>(null),
    comparisonHeading = useRef<HTMLHeadingElement>(null),
    comparisonTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    title.current?.focus();
    return () => {
      pending.current?.abort();
      pending.current = null;
    };
  }, []);
  useEffect(() => {
    if (!practice) return;
    if (evidenceFocus.current) {
      document.getElementById(`evidence-${evidenceFocus.current}`)?.focus();
      evidenceFocus.current = null;
    } else
      (activeStep === "evidence"
        ? result
        : activeStep === "diagnosis"
          ? diagnosisHeading
          : comparisonHeading
      ).current?.focus();
  }, [practice, activeStep]);
  useEffect(() => {
    if (!busy && returnFocus.current) {
      returnFocus.current = false;
      (practice ? comparisonTrigger : trigger).current?.focus();
    }
  }, [busy, practice]);
  useEffect(() => {
    if (comparison) outcome.current?.focus();
  }, [comparison]);
  useEffect(() => {
    if (error) errorBox.current?.focus();
  }, [error]);
  async function run(choice?: "related" | "unrelated") {
    if (busy || disabled || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError(null);
    setNotice("");
    returnFocus.current = false;
    setComparison(null);
    if (!choice) {
      setActiveStep("evidence");
      setPractice(null);
      setComparison(null);
    }
    try {
      const options = {
        body: { scenario, ...(choice ? { choice } : {}) },
        csrf,
        signal: controller.signal,
      };
      if (choice) {
        const next = await api("/api/incidents/practice", decodeComparison, options);
        if (!controller.signal.aborted) setComparison(next);
      } else {
        const next = await api("/api/incidents/practice", decodePractice, options);
        if (!controller.signal.aborted) setPractice(next);
      }
    } catch (error) {
      if (pending.current !== controller) return;
      if (controller.signal.aborted) {
        setNotice("تمرین لغو شد؛ نتیجه‌ای ثبت یا اجرا نشد.");
        return;
      }
      if (error instanceof ClientError && error.code === "AUTH_REQUIRED") onSessionExpired();
      else
        setError(
          error instanceof ClientError ? error.message : "پاسخ تمرین دریافت نشد؛ دوباره تلاش کنید.",
        );
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  function cancel() {
    pending.current?.abort();
    pending.current = null;
    returnFocus.current = true;
    setBusy(false);
    setNotice("تمرین لغو شد؛ نتیجه‌ای ثبت یا اجرا نشد.");
  }
  return (
    <div className="incident-layout">
      <div className="primary-column">
        <section className="panel" aria-labelledby="incident-title" aria-busy={busy}>
          <p className="eyebrow">مشاهده · فرضیه · بررسی نتیجه</p>
          <h2 id="incident-title" ref={title} tabIndex={-1}>
            بررسی اختلال، از کجا شروع کنیم؟
          </h2>
          <p className="simulation-label">تمرین آفلاین · داده و تحلیل شبیه‌سازی‌شده</p>
          {!practice ? (
            <p>
              این محیط روش بررسی خطای ۵۰۰ را نشان می‌دهد. تحلیل از سناریوی ازپیش‌تعریف‌شده می‌آید؛ هیچ
              حساب، مدل یا زیرساخت واقعی فراخوانی نمی‌شود.
            </p>
          ) : null}
          <details open={!practice} className="scenario-picker">
            <summary>
              {practice
                ? `سناریو: ${scenarios.find((item) => item.id === scenario)?.title} · تغییر یا تکرار`
                : "انتخاب موقعیت برای تمرین"}
            </summary>
            <fieldset disabled={busy || disabled} className="scenario-options">
              <legend>یک موقعیت برای بررسی انتخاب کنید</legend>
              {scenarios.map((item) => (
                <label className="scenario-option" key={item.id}>
                  <input
                    type="radio"
                    name="incident-scenario"
                    value={item.id}
                    checked={scenario === item.id}
                    onChange={() => {
                      setScenario(item.id);
                      setPractice(null);
                      setComparison(null);
                      setError(null);
                      setNotice("");
                    }}
                  />
                  <span>
                    <strong>{item.title}</strong>
                    <span className="hint">{item.description}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="button-row">
              <button
                type="button"
                ref={trigger}
                aria-busy={busy && !practice}
                disabled={busy || disabled}
                onClick={() => run()}
              >
                {busy ? "در حال بررسی تمرین…" : "بررسی سناریوی انتخابی"}
              </button>
            </div>
          </details>
          {busy ? (
            <button type="button" className="button-secondary" onClick={cancel}>
              لغو تمرین
            </button>
          ) : null}
          {disabled ? (
            <p className="note" role="alert">
              نشست منقضی شده است؛ دوباره وارد شوید.
            </p>
          ) : null}
          <div className="live-message" role="status" aria-live="polite">
            {notice}
          </div>
          {error ? (
            <div className="error-banner" role="alert" tabIndex={-1} ref={errorBox}>
              <strong>تمرین کامل نشد</strong>
              <p>{error}</p>
              <button type="button" className="button-quiet" onClick={() => run()}>
                تلاش دوباره
              </button>
            </div>
          ) : null}
        </section>
        {practice ? (
          <>
            <nav className="incident-steps" aria-label="مراحل بررسی اختلال">
              {(
                [
                  ["evidence", "۱ · شواهد"],
                  ["diagnosis", "۲ · فرضیه"],
                  ["comparison", "۳ · مقایسه"],
                ] as const
              ).map(([step, label]) => (
                <button
                  key={step}
                  type="button"
                  className="button-secondary"
                  aria-pressed={activeStep === step}
                  disabled={busy}
                  onClick={() => setActiveStep(step)}
                >
                  {label}
                </button>
              ))}
            </nav>
            <section
              className="panel evidence-panel"
              aria-labelledby="evidence-title"
              hidden={activeStep !== "evidence"}
            >
              <div className="section-heading">
                <div>
                  <p className="eyebrow">۱ · آنچه مشاهده شده</p>
                  <h2 id="evidence-title" tabIndex={-1} ref={result}>
                    شواهد همین اختلال
                  </h2>
                </div>
                <span className="badge badge-warning">شبیه‌سازی</span>
              </div>
              <p>
                برنامه <bdi>{practice.evidence.scope.app}</bdi> · بازه{" "}
                {time(practice.evidence.window.start)} تا {time(practice.evidence.window.end)} تهران
              </p>
              <ul className="evidence-list">
                {practice.evidence.entries.map((entry) => (
                  <li key={entry.id} id={`evidence-${entry.id}`} tabIndex={-1}>
                    <div className="section-heading">
                      <strong>{sourceNames[entry.source]}</strong>
                      <span
                        className={`badge ${entry.state === "observed" ? "badge-quiet" : "badge-warning"}`}
                      >
                        {entry.state === "observed"
                          ? inWindow(entry, practice.evidence)
                            ? "داخل بازه"
                            : "زمان تأیید نشده یا خارج بازه"
                          : entry.state === "unavailable"
                            ? "در دسترس نیست"
                            : entry.state === "empty"
                              ? "پاسخ خالی"
                              : "نامعلوم"}
                      </span>
                    </div>
                    <p>{entry.summary}</p>
                    {entry.fact?.kind === "log" ? (
                      <blockquote className="log-excerpt" dir="ltr">
                        {entry.fact.message}
                      </blockquote>
                    ) : null}
                    <details>
                      <summary>منبع و جزئیات این شاهد</summary>
                      <code>{entry.id}</code>
                      {entry.details.map((detail) => (
                        <p key={detail}>{detail}</p>
                      ))}
                      {entry.code ? <code>{entry.code}</code> : null}
                      <p>
                        {entry.at === null
                          ? "زمان قابل مقایسه نداریم."
                          : `زمان: ${time(entry.at)} تهران`}
                      </p>
                    </details>
                  </li>
                ))}
              </ul>
              <button
                className="step-next"
                type="button"
                onClick={() => setActiveStep("diagnosis")}
              >
                بررسی فرضیه‌ها
              </button>
            </section>
            <section
              className="panel"
              aria-labelledby="diagnosis-title"
              hidden={activeStep !== "diagnosis"}
            >
              <p className="eyebrow">۲ · تفسیر شواهد</p>
              <h2 id="diagnosis-title" ref={diagnosisHeading} tabIndex={-1}>
                فرضیه و بررسی بعدی
              </h2>
              {practice.diagnosis.status === "insufficient_evidence" ? (
                <p className="note">شواهد برای تعیین علت کافی نیست.</p>
              ) : null}
              <p>{practice.diagnosis.summary}</p>
              {practice.diagnosis.hypotheses.map((hypothesis, index) => (
                <article
                  key={`${scenario}-${hypothesis.category}-${hypothesis.explanation}`}
                  className="hypothesis"
                >
                  <h3>
                    {index + 1}.{" "}
                    {hypothesis.category === "configuration"
                      ? "بررسی پیکربندی برنامه"
                      : "ادامه جمع‌آوری شواهد"}
                  </h3>
                  <p>{hypothesis.explanation}</p>
                  <p className="hint">
                    شواهد مرتبط:{" "}
                    {hypothesis.evidenceIds.map((id) => (
                      <a
                        key={id}
                        href={`#evidence-${id}`}
                        onClick={(event) => {
                          event.preventDefault();
                          evidenceFocus.current = id;
                          setActiveStep("evidence");
                        }}
                      >
                        <bdi>{id}</bdi>
                      </a>
                    ))}
                  </p>
                  <p>
                    <strong>گام بعد: </strong>
                    {hypothesis.nextCheck}
                  </p>
                </article>
              ))}
              <details>
                <summary>عدم قطعیت‌ها و محدودیت تشخیص</summary>
                <ul>
                  {practice.diagnosis.limitations.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </details>
              <button
                type="button"
                className="step-next"
                onClick={() => setActiveStep("comparison")}
              >
                رفتن به مقایسه نتیجه
              </button>
            </section>
            <section
              className="panel"
              aria-labelledby="comparison-title"
              aria-busy={busy}
              hidden={activeStep !== "comparison"}
            >
              <p className="eyebrow">۳ · آزمودن نتیجه همان درخواست</p>
              <h2 id="comparison-title" tabIndex={-1} ref={comparisonHeading}>
                اگر این اصلاح را انجام دهیم چه می‌شود؟
              </h2>
              <p>
                دو نتیجهٔ فرضی را مقایسه کنید. اصلاح تنظیمات در سناریوی اول مرتبط است؛ در سناریوهای
                دیگر موفقیت آن فرض نمی‌شود.
              </p>
              <div className="button-row">
                <button
                  type="button"
                  ref={comparisonTrigger}
                  disabled={busy || disabled}
                  onClick={() => run("related")}
                >
                  مقایسه با اصلاح تنظیمات
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  disabled={busy || disabled}
                  onClick={() => run("unrelated")}
                >
                  مقایسه با تغییر نامرتبط
                </button>
              </div>
              {comparison ? (
                <div
                  className={`comparison-outcome ${comparison.outcome === "verified" ? "comparison-verified" : "comparison-failed"}`}
                >
                  <h3 tabIndex={-1} ref={outcome}>
                    {comparison.outcome === "verified"
                      ? "همان درخواست در تمرین پاسخ موفق داد"
                      : comparison.outcome === "still_failing"
                        ? "خطای ۵۰۰ در تمرین باقی ماند"
                        : "نتیجه قابل تأیید نیست"}
                  </h3>
                  <p>{comparison.reason}</p>
                  <p className="hint">
                    خروجی شبیه‌سازی‌شده است؛ هیچ تنظیمات یا سرویس واقعی تغییر نکرد.
                  </p>
                </div>
              ) : null}
            </section>
          </>
        ) : null}
      </div>
      <aside className="context-column" aria-label="راهنمای بررسی اختلال">
        <section className="panel">
          <p className="eyebrow">برای بررسی واقعی</p>
          <h2>اتصال لیارا هنوز آماده نیست</h2>
          <details>
            <summary>پیش‌نیاز بررسی واقعی</summary>
            <p>
              بعد از آماده‌شدن دسترسی، شواهد فقط از تیم و برنامه مجاز خوانده می‌شوند. نام مدل، واحد
              metric یا نتیجهٔ انتشار از دادهٔ تمرین به حساب واقعی منتقل نمی‌شود.
            </p>
          </details>
          <button
            type="button"
            className="button-secondary"
            disabled
            aria-describedby="live-incident-reason"
          >
            بررسی اختلال واقعی
          </button>
          <p className="hint" id="live-incident-reason">
            تطبیق scope و قرارداد حساب لیارا باقی است. برای ادامهٔ تمرین نیازی به ساخت app یا شارژ
            نیست.
          </p>
        </section>
        <section className="help-panel">
          <h2>چه چیزی موفقیت را ثابت می‌کند؟</h2>
          <p>
            همان app، همان مسیر درخواست و یک مشاهدهٔ تازه بعد از اصلاح. موفقیت release یا زنده‌بودن
            process کافی نیست.
          </p>
          <p className="hint">
            برای هر تغییر واقعی ابتدا پیشنهاد دقیق و تأیید معتبر لازم است؛ سپس اثر آن خوانده می‌شود.
          </p>
        </section>
      </aside>
    </div>
  );
}
