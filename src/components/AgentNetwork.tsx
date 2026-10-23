"use client";
import { useEffect, useState } from "react";
import type { Action } from "../contracts/domain.ts";
import { canReadNetworkResult } from "../contracts/network.ts";

export function AgentNetwork({ action, waiting, disabled, resumable, onDecision, onObserve }: {
  action: Action; waiting: boolean; disabled: boolean; resumable: boolean;
  onDecision: (decision: "approve" | "reject", acknowledgeUnknownCost: boolean) => void; onObserve: () => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false), [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setTimeout(() => setNow(Date.now()), Math.max(1, Math.min(action.expiresAt - Date.now() + 1, 2147483647)));
    return () => window.clearTimeout(timer);
  }, [action.expiresAt]);
  if (action.spec.version !== 13) return null;
  const expired = action.state === "expired" || action.expiresAt <= now,
    pending = waiting && (action.state === "awaiting_approval" || action.state === "expired"),
    verified = action.state === "succeeded";
  const status = verified ? "هویت شبکه از حساب خوانده و تأیید شد؛ هنوز برنامه‌ای ساخته یا منتشر نشده است."
    : action.state === "cancelled" ? "ساخت شبکه رد شد؛ درخواستی ارسال نشد."
    : action.state === "failed" ? "ساخت شبکه تأیید نشد؛ رسید بررسی حفظ شده است."
    : action.state === "uncertain" ? "نتیجه نامعلوم است؛ ساخت تکرار نمی‌شود و فقط رسید قبلی قابل بررسی است."
    : action.state === "observing" ? "درخواست پذیرفته شد؛ هویت واقعی شبکه در حال بررسی است."
    : action.state === "executing" ? "درخواست ساخت همین شبکه آغاز شده است."
    : action.state === "approved" ? "تصمیم شما ثبت شد؛ ساخت در صف اجراست."
    : expired ? "مهلت این پیشنهاد تمام شده است؛ آن را ببندید و پیشنهاد تازه بگیرید."
    : "برای ساخت مقصد، شبکه لازم است و در این تیم شبکه‌ای موجود نیست.";
  return <section className="agent-repair destination-card" aria-labelledby="network-title">
    <h3 id="network-title">{verified ? "شبکه ساخته شد" : "ساخت شبکه موردنیاز"}</h3>
    <dl className="profile-facts">
      <div><dt>مقصد پروژه</dt><dd><bdi>{action.spec.scope.app}</bdi></dd></div>
      <div><dt>هزینه مستقل شبکه</dt><dd>نامشخص؛ تعرفه قابل تأیید در دسترس نیست</dd></div>
    </dl>
    <p>یک شبکه خصوصی در حساب و تیم متصل ساخته می‌شود. ساخت برنامه با پلن و هزینه مشخص، تصمیم بعدی است.</p>
    <p className="hint">هزینه نامشخص، رایگان محسوب نمی‌شود. طبق مستندات لیارا، شبکه بدون برنامه یا دیتابیس پس از مدتی خودکار حذف می‌شود.</p>
    <details><summary>نام شبکه، حساب و اعتبار پیشنهاد</summary>
      <dl className="profile-facts">
        <div><dt>نام یکتای شبکه</dt><dd><bdi>{action.spec.networkName}</bdi></dd></div>
        <div><dt>حساب / تیم</dt><dd><bdi>{action.spec.accountId} / {action.spec.scope.teamId}</bdi></dd></div>
        <div><dt>مهلت</dt><dd>{new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" }).format(action.expiresAt)}</dd></div>
        {action.network?.networkId ? <div><dt>شناسه شبکه تأییدشده</dt><dd><bdi>{action.network.networkId}</bdi></dd></div> : null}
      </dl>
    </details>
    <p role="status">{status}</p>
    {pending ? <>
      {!expired ? <label className="radio-option"><input type="checkbox" checked={acknowledged} disabled={disabled} onChange={event => setAcknowledged(event.target.checked)} /> هزینه مستقل شبکه مشخص نیست؛ ساخت همین یک شبکه را می‌پذیرم.</label> : null}
      <div className="button-row">
        {!expired ? <button type="button" disabled={disabled || !acknowledged} onClick={() => onDecision("approve", acknowledged)}>تأیید و ساخت شبکه</button> : null}
        <button type="button" className="button-secondary" disabled={disabled} onClick={() => onDecision("reject", false)}>{expired ? "بستن پیشنهاد منقضی‌شده" : "رد ساخت شبکه"}</button>
      </div>
    </> : null}
    {!waiting && (canReadNetworkResult(action) || resumable) ? <button type="button" className="button-secondary" disabled={disabled} onClick={onObserve}>بررسی نتیجه ساخت شبکه</button> : null}
  </section>;
}
