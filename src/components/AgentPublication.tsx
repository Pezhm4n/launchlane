"use client";

import type { Action } from "../contracts/domain.ts";
import { canReadDeploymentResult } from "../contracts/deployment.ts";

export function AgentPublication({ action, waiting, disabled, onDecision, onObserve }: {
  action: Action;
  waiting: boolean;
  disabled: boolean;
  onDecision: (decision: "approve" | "reject") => void;
  onObserve: () => void;
}) {
  if (action.spec.version !== 7) return null;
  const spec = action.spec, assertion = spec.workload.assertion;
  const verified = action.state === "succeeded";
  return <section className="agent-repair" aria-labelledby="publication-title">
    <h3 id="publication-title">{verified ? "انتشار بررسی شد" : "انتشار پروژه"}</h3>
    <dl className="profile-facts">
      <div><dt>برنامه مقصد</dt><dd><bdi>{spec.scope.app}</bdi></dd></div>
      <div><dt>صفحه مورد بررسی</dt><dd><bdi>{spec.workload.path}</bdi></dd></div>
      <div><dt>پاسخ مورد انتظار</dt><dd>
        {assertion.kind === "text" ? <>متن «<bdi>{assertion.contains}</bdi>»</>
          : <><bdi>{assertion.field}</bdi> برابر <bdi>{JSON.stringify(assertion.equals)}</bdi></>}
        {" "}با وضعیت <bdi>{spec.workload.status}</bdi>
      </dd></div>
    </dl>
    <p className="hint">همین فایل‌های بررسی‌شده به برنامه موجود ارسال می‌شوند. پلن و تنظیمات برنامه عوض نمی‌شوند؛
      هزینه برنامه موجود ادامه دارد و مبلغ آن در این پیشنهاد تأیید نشده است. هنگام انتشار ممکن است دسترسی موقتاً قطع شود.</p>
    <details>
      <summary>اطلاعات فنی نسخه</summary>
      <dl className="profile-facts">
        <div><dt>Node</dt><dd><bdi>{spec.nodeVersion}</bdi></dd></div>
        <div><dt>پلن موجود</dt><dd><bdi>{spec.args.planId}</bdi></dd></div>
        <div><dt>اثر انگشت بسته</dt><dd><bdi>{spec.artifactHash}</bdi></dd></div>
      </dl>
      <p>معیار بالا فقط همین پاسخ را می‌سنجد. سلامت همه صفحه‌ها و رفتارهای برنامه از آن نتیجه نمی‌شود.</p>
    </details>
    {waiting && action.state === "awaiting_approval" ? <div className="button-row">
      <button type="button" disabled={disabled} onClick={() => onDecision("approve")}>تأیید و انتشار این نسخه</button>
      <button type="button" className="button-secondary" disabled={disabled} onClick={() => onDecision("reject")}>رد انتشار</button>
    </div> : <p role="status">{verified ? "نسخه جاری و پاسخ مورد انتظار تأیید شدند."
      : action.state === "failed" ? "انتشار به نتیجه مورد انتظار نرسید؛ جزئیات بررسی حفظ شده است."
      : action.state === "cancelled" ? "انتشار رد شد."
      : action.state === "expired" ? "مهلت پیشنهاد پایان یافته است؛ پیشنهاد تازه لازم است."
      : "نتیجه هنوز تأیید نشده است؛ رسید ارسال حفظ می‌شود."}</p>}
    {verified ? <p><a href={`${spec.workload.origin}${spec.workload.path}`} target="_blank" rel="noreferrer">دیدن صفحه بررسی‌شده</a></p> : null}
    {!waiting && canReadDeploymentResult(action) ? <button type="button" className="button-secondary" disabled={disabled} onClick={onObserve}>ادامه بررسی نتیجه انتشار</button> : null}
  </section>;
}
