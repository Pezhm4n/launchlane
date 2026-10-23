import type { Action } from "../contracts/domain.ts";
import { canReadDeploymentResult } from "../contracts/deployment.ts";
import { useState } from "react";

function expectedValue(value: string | number | boolean | null) {
  return value === null ? "null" : String(value);
}

export function AgentPublication({
  action,
  waiting,
  disabled,
  onDecision,
  onObserve,
}: {
  action: Action;
  waiting: boolean;
  disabled: boolean;
  onDecision: (decision: "approve" | "reject") => void;
  onObserve: () => void;
}) {
  const [copy, setCopy] = useState<{ url: string; state: "copying" | "copied" | "failed" } | null>(null);
  if (action.spec.version !== 7 && action.spec.version !== 10 && action.spec.version !== 11 && action.spec.version !== 15 && action.spec.version !== 17 && action.spec.version !== 19) return null;
  const spec = action.spec,
    assertion = spec.workload.assertion,
    publishedUrl = `${spec.workload.origin}${spec.workload.path}`,
    copyState = copy?.url === publishedUrl ? copy.state : null;
  async function copyLink() {
    setCopy({ url: publishedUrl, state: "copying" });
    try {
      await navigator.clipboard.writeText(publishedUrl);
      setCopy({ url: publishedUrl, state: "copied" });
    } catch {
      setCopy({ url: publishedUrl, state: "failed" });
    }
  }
  const verified = action.state === "succeeded",
    awaiting = waiting && action.state === "awaiting_approval",
    inFlight =
      action.state === "approved" ||
      action.state === "executing" ||
      action.state === "observing" ||
      action.state === "uncertain",
    stopped = action.state === "cancelled" || action.state === "expired",
    failed = action.state === "failed";
  const status = verified
    ? "نسخه جاری و پاسخ مورد انتظار تأیید شدند."
    : failed
      ? "انتشار به نتیجه مورد انتظار نرسید؛ جزئیات بررسی حفظ شده است."
      : action.state === "cancelled"
        ? "شما این انتشار را رد کردید."
        : action.state === "expired"
          ? "مهلت این پیشنهاد تمام شده است؛ ادامهٔ انتشار به پیشنهاد تازه نیاز دارد."
          : action.state === "uncertain"
            ? "نتیجه ارسال نامعلوم است. دوباره ارسال نکنید؛ ابتدا نتیجه را از سرویس بخوانید."
            : action.state === "observing"
              ? "فایل‌ها ارسال شدند؛ پاسخ صفحه و نسخه جاری در حال بررسی است."
              : action.state === "executing"
                ? "فایل‌های همین پیشنهاد در حال ارسال هستند."
                : action.state === "approved"
                  ? "تصمیم شما ثبت شد و ارسال در صف اجراست."
                  : "این پیشنهاد هنوز تصمیم نشده است.";
  return (
    <section className="agent-repair publication-card" aria-labelledby="publication-title" data-verified={verified}>
      {verified ? <div className="publication-success">
        <div className="publication-success-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="m5 12 4 4L19 6" /></svg></div>
        <div className="publication-success-heading">
          <span className="publication-success-label">انتشار موفق</span>
          <h3 id="publication-title">سایت شما منتشر شد</h3>
          <p role="status">{status}</p>
        </div>
        <div className="publication-success-address">
          <span>نشانی سایت شما</span>
          <a href={publishedUrl} target="_blank" rel="noopener noreferrer"><bdi dir="ltr">{publishedUrl}</bdi></a>
        </div>
        <div className="button-row publication-success-actions">
          <a className="publication-open-site" href={publishedUrl} target="_blank" rel="noopener noreferrer">باز کردن سایت <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3h7v7m0-7L10 14M10 3H4v17h17v-6" /></svg></a>
          <button type="button" className="button-secondary" disabled={disabled || copyState === "copying"} onClick={copyLink}>
            {copyState === "copied" ? "لینک کپی شد" : copyState === "copying" ? "در حال کپی…" : "کپی لینک سایت"}
          </button>
        </div>
        <p className="hint publication-copy-status" aria-live="polite">{copyState === "copied" ? "نشانی سایت در حافظه کپی شد." : copyState === "failed" ? "کپی خودکار در این مرورگر در دسترس نیست؛ نشانی بالا را انتخاب و کپی کنید." : "باز کردن سایت در زبانهٔ تازه، انتشار دوباره‌ای آغاز نمی‌کند."}</p>
      </div> : <h3 id="publication-title">انتشار پروژه</h3>}
      <ol className="publication-steps" aria-label="مراحل انتشار">
        <li className="is-done">پیشنهاد ساخته شد</li>
        <li
          className={awaiting ? "is-current" : stopped ? "is-stopped" : "is-done"}
          aria-current={awaiting ? "step" : undefined}
        >
          تصمیم شما
        </li>
        <li
          className={
            verified ? "is-done" : failed ? "is-failed" : inFlight ? "is-current" : undefined
          }
          aria-current={inFlight ? "step" : undefined}
        >
          ارسال و بررسی
        </li>
        <li
          className={verified ? "is-done" : failed ? "is-failed" : undefined}
          aria-current={failed ? "step" : undefined}
        >
          نتیجه تأییدشده
        </li>
      </ol>
      <details className="publication-review" open={!verified}>
      <summary>{verified ? "جزئیات نسخه و معیار بررسی" : "مشخصات و معیار انتشار"}</summary>
      <dl className="profile-facts">
        <div>
          <dt>برنامه مقصد</dt>
          <dd>
            <bdi>{spec.scope.app}</bdi>
          </dd>
        </div>
        <div>
          <dt>صفحه مورد بررسی</dt>
          <dd>
            <bdi>{spec.workload.path}</bdi>
          </dd>
        </div>
      </dl>
      <div className="publication-criterion">
        <h4>معیار موفقیت</h4>
        <p>
          پاسخ با وضعیت <bdi>{spec.workload.status}</bdi> از صفحه <bdi>{spec.workload.path}</bdi>{" "}
          باید{" "}
          {assertion.kind === "text" ? (
            <>متن «<bdi>{assertion.contains}</bdi>» را داشته باشد.</>
          ) : (
            <>
              مقدار <bdi>{assertion.field}</bdi> را برابر{" "}
              <bdi>{expectedValue(assertion.equals)}</bdi> برگرداند.
            </>
          )}
        </p>
        <p className="hint">
          این معیار پیش از انتشار تعیین شده است. آماده‌شدن نسخه یا پاسخ فعلی سایت به‌تنهایی موفقیت
          نیست؛ هر سه باید با همین پیشنهاد بخوانند.
        </p>
      </div>
      <p className="hint">
        همین فایل‌های بررسی‌شده به برنامه موجود ارسال می‌شوند. پلن و تنظیمات برنامه عوض نمی‌شوند؛
        هزینه برنامه موجود ادامه دارد و مبلغ آن در این پیشنهاد تأیید نشده است. هنگام انتشار ممکن است
        دسترسی موقتاً قطع شود.
      </p>
      <details>
        <summary>اطلاعات فنی نسخه</summary>
        <dl className="profile-facts">
          <div>
            <dt>{spec.version === 15 ? "نوع انتشار" : spec.version === 19 ? `${{ react: "React", vue: "Vue", angular: "Angular" }[spec.runtime.kind]} / Node` : spec.version === 17 ? "Next.js / Node" : spec.version === 11 ? "Python" : "Node"}</dt>
            <dd>
              <code dir="ltr" className="ltr-code"><bdo dir="ltr">{spec.version === 15 ? "Static · Nginx لیارا" : spec.version === 11 ? spec.runtime.version : spec.nodeVersion}</bdo></code>
            </dd>
          </div>
          <div>
            <dt>پلن موجود</dt>
            <dd>
              <bdi>{spec.args.planId}</bdi>
            </dd>
          </div>
          <div>
            <dt>اثر انگشت بسته</dt>
            <dd>
              <bdi>{spec.artifactHash}</bdi>
            </dd>
          </div>
        </dl>
        <p>معیار بالا فقط همین پاسخ را می‌سنجد. سلامت همه صفحه‌ها و رفتارهای برنامه از آن نتیجه نمی‌شود.</p>
      </details>
      </details>
      {awaiting ? (
        <>
          <div className="button-row">
            <button type="button" disabled={disabled} onClick={() => onDecision("approve")}>
              تأیید و انتشار این نسخه
            </button>
            <button
              type="button"
              className="button-secondary"
              disabled={disabled}
              onClick={() => onDecision("reject")}
            >
              رد انتشار
            </button>
          </div>
          <p className="hint">
            با تأیید، فایل‌های همین پیشنهاد ارسال می‌شوند و نتیجه به‌صورت خودکار خوانده می‌شود.
          </p>
        </>
      ) : (
        verified ? null : <p role="status">{status}</p>
      )}
      {waiting && action.state === "expired" ? (
        <button
          type="button"
          className="button-secondary"
          disabled={disabled}
          onClick={() => onDecision("reject")}
        >
          بستن پیشنهاد منقضی‌شده
        </button>
      ) : null}
      {!waiting && canReadDeploymentResult(action) ? (
        <button
          type="button"
          className="button-secondary"
          disabled={disabled}
          onClick={onObserve}
        >
          ادامه بررسی نتیجه انتشار
        </button>
      ) : null}
    </section>
  );
}
