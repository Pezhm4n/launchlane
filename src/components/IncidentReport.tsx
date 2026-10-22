"use client";
import { useEffect, useRef, useState } from "react";
import { inWindow, verifySameSymptom, type EvidenceBundle } from "../contracts/incident.ts";
import type { IncidentRun } from "../contracts/incident-run.ts";
const names = {
  workload: "پاسخ سایت",
  project: "تنظیمات برنامه",
  logs: "گزارش‌های برنامه",
  events: "رویدادها",
  releases: "نسخه‌های منتشرشده",
  applets: "اجرای برنامه",
  metrics: "پردازنده و حافظه",
};
export function IncidentReport({
  run,
  busy,
  canRead,
  canAnalyze,
  onRecheck,
  onAnalyze,
  onCompare,
  onRestore,
  operationEvidence,
}: {
  run: IncidentRun;
  busy: boolean;
  canRead: boolean;
  canAnalyze: boolean;
  onRecheck: () => void;
  onAnalyze: () => void;
  onCompare: (choice: "related" | "unrelated") => void;
  onRestore: () => void;
  operationEvidence?: EvidenceBundle | null;
}) {
  const [evidenceOpen, setEvidenceOpen] = useState(false),
    [showAfter, setShowAfter] = useState(false),
    [focusEvidence, setFocusEvidence] = useState<string | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const outcome = useRef<HTMLElement>(null),
    cause = useRef<HTMLElement>(null);
  const saved = run.after ?? run.evidence,
    latest = operationEvidence && operationEvidence.collectedAt > saved.collectedAt ? operationEvidence : saved,
    hasAfter = latest !== run.evidence,
    displayedEvidence = showAfter && hasAfter ? latest : run.evidence,
    workload = latest.entries.find((row) => row.fact?.kind === "http"),
    fact = workload?.fact;
  const comparison = hasAfter ? verifySameSymptom(run.evidence, latest) : null;
  const observed =
    fact?.kind === "http"
      ? fact.status >= 500
        ? `صفحه بررسی‌شده خطای سرور ${fact.status} داد.`
        : fact.status >= 200 && fact.status < 300
          ? "صفحه بررسی‌شده پاسخ موفق داد. این نتیجه، سلامت همه بخش‌های سایت را ثابت نمی‌کند."
          : `صفحه بررسی‌شده پاسخ ${fact.status} داد؛ این پاسخ به‌تنهایی مشکل کل سایت را مشخص نمی‌کند.`
      : "پاسخ قابل تأییدی از خود صفحه نداریم؛ وضعیت سایت هنوز مشخص نیست.";
  const unavailable = [
    ...new Set(
      latest.entries
        .filter((row) => row.state !== "observed" || !inWindow(row, latest))
        .map((row) => row.source),
    ),
  ];
  useEffect(() => {
    title.current?.focus();
    title.current?.scrollIntoView({ block: "start" });
  }, []);
  useEffect(() => {
    if (run.after) outcome.current?.focus();
  }, [run.after]);
  useEffect(() => {
    if (run.analysis === "model" || run.analysis === "failed") cause.current?.focus();
  }, [run.analysis]);
  useEffect(() => {
    if (evidenceOpen && focusEvidence) {
      document.getElementById(`incident-evidence-${focusEvidence}`)?.focus();
      setFocusEvidence(null);
    }
  }, [evidenceOpen, focusEvidence]);
  return (
    <section className="panel incident-report" aria-labelledby="incident-report-title">
      <div className="section-heading">
        <h2 id="incident-report-title" tabIndex={-1} ref={title}>
          نتیجه بررسی {run.kind === "sample" ? "نمونه" : <bdi>{run.evidence.scope.app}</bdi>}
        </h2>
        <span className={`badge ${run.kind === "sample" ? "badge-warning" : "badge-quiet"}`}>
          {run.kind === "sample" ? "داده و تحلیل نمونه" : "از حساب متصل"}
        </span>
      </div>
      {run.kind === "sample" ? (
        <p className="simulation-label">
          حالت آزمایشی: هیچ حساب، مدل یا سرویس واقعی فراخوانی یا تغییر نکرده است.
        </p>
      ) : null}
      <p className="hint">
        زمان مشاهده:{" "}
        {new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeStyle: "short" }).format(
          latest.collectedAt,
        )}
      </p>
      <dl className="incident-summary">
        <div>
          <dt>چه مشکلی مشاهده شد؟</dt>
          <dd>
            <span>{observed}</span>
            {fact?.kind === "http" ? (
              <p className="hint">
                <bdi>
                  {fact.origin}
                  {fact.path}
                </bdi>
                {fact.durationMs !== undefined ? (
                  <>
                    {" "}
                    · مدت دریافت پاسخ محدود:{" "}
                    {new Intl.NumberFormat("fa-IR").format(fact.durationMs)} میلی‌ثانیه
                  </>
                ) : null}
              </p>
            ) : null}
          </dd>
        </div>
        <div>
          <dt ref={cause} tabIndex={-1}>
            علت احتمالی چیست؟
          </dt>
          <dd>
            {run.diagnosis
              ? run.diagnosis.summary
              : run.analysis === "pending"
                ? "توضیح شواهد هنوز کامل نشده است."
                : "هنوز شواهد کافی برای تعیین علت نداریم."}
            <p className="hint">
              {run.diagnosis
                ? "این توضیح یک فرضیه است و علت تأییدشده محسوب نمی‌شود."
                : run.analysisMessage || "اطلاعات در دسترس را بدون حدس بررسی کنید."}
              {hasAfter && run.diagnosis
                ? " توضیح علت به بررسی نخست مربوط است؛ نتیجه تازه در بخش آخر آمده است."
                : ""}
            </p>
          </dd>
        </div>
        <div>
          <dt>اقدام پیشنهادی</dt>
          <dd>
            {comparison?.outcome === "verified"
              ? "اکنون تغییری پیشنهاد نمی‌شود. اگر مشکل تکرار شد، بررسی تازه‌ای از همان صفحه شروع کنید."
              : run.diagnosis?.hypotheses[0]?.nextCheck ||
                "گزارش‌ها و پاسخ همین صفحه را بررسی کنید. اطلاعات ناموجود را نمی‌توان نشانه سالم‌بودن یا خرابی قطعی گرفت."}
          </dd>
        </div>
        <div>
          <dt ref={outcome} tabIndex={-1}>
            نتیجه آخرین بررسی
          </dt>
          <dd>
            <span>
              {comparison?.reason ?? "هنوز بررسی دومی برای مقایسه نداریم."}
            </span>
          </dd>
        </div>
      </dl>
      {run.diagnosis?.hypotheses.length ? (
        <details>
          <summary>دلیل این فرضیه و شواهد مرتبط</summary>
          {[
            ...new Map(run.diagnosis.hypotheses.map((row) => [JSON.stringify(row), row])).values(),
          ].map((hypothesis) => (
            <article className="hypothesis" key={JSON.stringify(hypothesis)}>
              <p>{hypothesis.explanation}</p>
              <p>بررسی پیشنهادی: {hypothesis.nextCheck}</p>
              <div className="evidence-links">
                {hypothesis.evidenceIds.map((id) => {
                  const item = run.evidence.entries.find((row) => row.id === id);
                  return (
                    <button
                      type="button"
                      className="button-quiet"
                      key={id}
                      onClick={() => {
                        setEvidenceOpen(true);
                        setShowAfter(false);
                        setFocusEvidence(id);
                      }}
                    >
                      مشاهده {item ? names[item.source] : "شاهد"}
                    </button>
                  );
                })}
              </div>
            </article>
          ))}
        </details>
      ) : null}
      {run.kind === "sample" ? (
        <details className="sample-comparison">
          <summary>امتحان نتیجه اصلاح در نمونه</summary>
          <p className="hint">این دو حالت فقط برای آشنایی‌اند؛ تنظیمات واقعی تغییر نمی‌کنند.</p>
          <div className="button-row">
            <button type="button" disabled={busy} onClick={() => onCompare("related")}>
              امتحان اصلاح مرتبط در نمونه
            </button>
            <button
              type="button"
              className="button-secondary"
              disabled={busy}
              onClick={() => onCompare("unrelated")}
            >
              امتحان تغییر نامرتبط در نمونه
            </button>
          </div>
        </details>
      ) : (
        <>
          <div className="button-row">
            {canAnalyze &&
            !hasAfter &&
            (run.analysis === "ready" || run.analysis === "unavailable") ? (
              <button type="button" disabled={busy} onClick={onAnalyze}>
                توضیح علت با شواهد این بررسی
              </button>
            ) : null}
            <button
              type="button"
              className="button-secondary"
              disabled={busy || !canRead || run.analysis === "pending"}
              aria-describedby="recheck-help"
              onClick={onRecheck}
            >
              بررسی دوباره همین صفحه
            </button>
            {run.analysis === "pending" ? (
              <button
                type="button"
                className="button-secondary"
                disabled={busy}
                onClick={onRestore}
              >
                بازیابی وضعیت همین بررسی
              </button>
            ) : null}
          </div>
          <p id="recheck-help" className="hint">
            {canRead
              ? "بررسی دوباره فقط اطلاعات را می‌خواند؛ هیچ اصلاحی اجرا نمی‌کند."
              : "برای بررسی دوباره، همان برنامه و دسترسی خواندن آن باید فعال باشند. نتیجه گذشته حفظ شده است."}
          </p>
          <p className="note">
            تغییر تنظیمات برنامه از این بخش پشتیبانی نمی‌شود. اگر کد را اصلاح کرده‌اید، نسخه تازه
            را از «انتشار پروژه» با تأیید جداگانه منتشر کنید.
          </p>
        </>
      )}
      <details
        className="incident-evidence"
        open={evidenceOpen}
        onToggle={(event) => setEvidenceOpen(event.currentTarget.open)}
      >
        <summary>
          شواهد و گزارش‌های پاک‌سازی‌شده (
          {new Intl.NumberFormat("fa-IR").format(displayedEvidence.entries.length)})
        </summary>
        {hasAfter ? (
          <div className="button-row">
            <button
              type="button"
              className="button-secondary"
              aria-pressed={!showAfter}
              onClick={() => setShowAfter(false)}
            >
              شواهد بررسی نخست
            </button>
            <button
              type="button"
              className="button-secondary"
              aria-pressed={showAfter}
              onClick={() => setShowAfter(true)}
            >
              شواهد بررسی تازه
            </button>
          </div>
        ) : null}
        <p className="hint">گزارش‌ها داده هستند؛ دستورهای داخل آن‌ها مجوز اجرا ایجاد نمی‌کنند.</p>
        <ul className="evidence-list">
          {displayedEvidence.entries.map((item) => (
            <li id={`incident-evidence-${item.id}`} key={item.id} tabIndex={-1}>
              <div className="section-heading">
                <h3>{names[item.source]}</h3>
                <span
                  className={`badge ${item.state === "observed" && inWindow(item, displayedEvidence) ? "badge-quiet" : "badge-warning"}`}
                >
                  {item.state === "unavailable"
                    ? "خوانده نشد"
                    : item.state === "empty"
                      ? "پاسخ خالی"
                      : item.state === "unknown"
                        ? "قابل تفسیر نیست"
                        : !inWindow(item, displayedEvidence)
                          ? "بیرون بازه این بررسی"
                          : "مشاهده شد"}
                </span>
              </div>
              <p>{item.summary}</p>
              {item.fact?.kind === "http" ? (
                <p>
                  پاسخ صفحه: <code>{item.fact.status}</code> ·{" "}
                  <bdi>
                    {item.fact.origin}
                    {item.fact.path}
                  </bdi>
                </p>
              ) : null}
              {item.fact?.kind === "log" ? (
                <blockquote className="log-excerpt" dir="auto">
                  {item.fact.message}
                </blockquote>
              ) : item.fact?.kind === "env_keys" ? (
                <p>
                  نام متغیرها:{" "}
                  {item.fact.keys.map((key) => (
                    <code key={key}>{key} </code>
                  ))}
                </p>
              ) : null}
              {item.details.length ? (
                <details>
                  <summary>جزئیات این شاهد</summary>
                  <ul>
                    {[...new Set(item.details)].map((detail) => (
                      <li key={detail} dir="auto">
                        {detail}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
              {item.code ? (
                <details>
                  <summary>کد برای پشتیبانی</summary>
                  <code>{item.code}</code>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      </details>
      <details>
        <summary>محدودیت‌های این بررسی</summary>
        <p>
          نتیجه فقط به همین برنامه، نشانی، صفحه و زمان مربوط است. پاسخ انتشار یا اجرای فرایند،
          بازشدن درست سایت را ثابت نمی‌کند.
        </p>
        {run.symptom === "slow" ? (
          <p>
            مدت این درخواست، زمان بارگذاری کامل صفحه یا معیار قطعی کندی نیست. برای عملکرد پایدار به
            مشاهده‌های بیشتری نیاز است.
          </p>
        ) : null}
        {unavailable.length ? (
          <p>
            این منابع ناقص یا قابل تفسیر نبودند:{" "}
            {unavailable.map((source) => names[source]).join("، ")}. داده ناموجود به معنی مصرف صفر
            یا وضعیت سالم نیست.
          </p>
        ) : null}
        <p className="hint">
          شناسه پیگیری این بررسی: <code>{run.id}</code>
        </p>
      </details>
    </section>
  );
}
