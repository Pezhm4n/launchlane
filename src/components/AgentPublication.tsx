import type { Action } from "../contracts/domain.ts";
import { canReadDeploymentResult } from "../contracts/deployment.ts";

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
  if ((action.spec.version !== 7 && action.spec.version !== 10)) return null;
  const spec = action.spec,
    assertion = spec.workload.assertion;
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
          ? "مهلت این پیشنهاد تمام شده است؛ برای ادامه، درخواست تازه‌ای در گفت‌وگو بنویسید."
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
    <section className="agent-repair publication-card" aria-labelledby="publication-title">
      <h3 id="publication-title">{verified ? "انتشار بررسی شد" : "انتشار پروژه"}</h3>
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
            <dt>Node</dt>
            <dd>
              <bdi>{spec.nodeVersion}</bdi>
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
        <p role="status">{status}</p>
      )}
      {verified ? (
        <p>
          <a href={`${spec.workload.origin}${spec.workload.path}`} target="_blank" rel="noreferrer">
            دیدن صفحه بررسی‌شده
          </a>
        </p>
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
