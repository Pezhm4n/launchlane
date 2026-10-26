"use client";
import { useEffect, useState } from "react";
import type { Action } from "../contracts/domain.ts";
import { canReadDiskResult } from "../contracts/persistent-disk.ts";

export function AgentDisk({ action, waiting, disabled, resumable, onDecision, onObserve }: {
  action: Action; waiting: boolean; disabled: boolean; resumable: boolean;
  onDecision: (decision: "approve" | "reject") => void; onObserve: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const deadline = Math.min(action.expiresAt, action.spec.version === 25 ? action.spec.cost.expiresAt : action.expiresAt);
  useEffect(() => {
    const timer = window.setTimeout(() => setNow(Date.now()), Math.max(1, Math.min(deadline - Date.now() + 1, 2147483647)));
    return () => window.clearTimeout(timer);
  }, [deadline]);
  if (action.spec.version !== 25) return null;
  const spec = action.spec, expired = action.state === "expired" || deadline <= now,
    pending = waiting && (action.state === "awaiting_approval" || action.state === "expired"), verified = action.state === "succeeded";
  const status = verified ? "هویت و اندازه فضای پایدار تأیید شدند؛ ماندگاری داده پس از انتشار جدا بررسی می‌شود."
    : action.state === "cancelled" ? "ساخت فضای پایدار رد شد؛ درخواستی ارسال نشد."
    : action.state === "failed" ? "ساخت فضای پایدار تأیید نشد؛ رسید بررسی حفظ شده است."
    : action.state === "uncertain" ? "نتیجه نامعلوم است؛ ساخت تکرار نمی‌شود و فقط رسید همان درخواست بررسی می‌شود."
    : action.state === "observing" ? "درخواست دریافت شد؛ هویت و اندازه فضای پایدار در حال بررسی است."
    : action.state === "executing" ? "درخواست ساخت همین فضای پایدار آغاز شده است."
    : action.state === "approved" ? "تصمیم شما ثبت شد؛ ساخت در صف اجراست."
    : expired ? "اعتبار بررسی ظرفیت تمام شده است؛ این پیشنهاد را ببندید و پیشنهاد تازه بگیرید."
    : "این نسخه برای نگهداری داده‌ها پس از جایگزینی برنامه به فضای پایدار نیاز دارد.";
  return <section className="agent-repair destination-card" aria-labelledby="disk-title">
    <h3 id="disk-title">{verified ? "فضای پایدار آماده شد" : "فضای پایدار پروژه"}</h3>
    <dl className="profile-facts">
      <div><dt>برنامه مقصد</dt><dd><bdi>{spec.scope.app}</bdi></dd></div>
      <div><dt>فضای مورد استفاده</dt><dd>۱ گیگابایت از ظرفیت موجود برنامه</dd></div>
      <div><dt>اثر روی نرخ پایه</dt><dd>بدون افزایش پلن یا نرخ پایه فعلی</dd></div>
    </dl>
    <p>یک فضای تازه و خالی برای داده‌های همین نسخه ساخته می‌شود. اتصال آن به برنامه در پیشنهاد انتشار بررسی و تأیید می‌شود.</p>
    <p className="hint">هزینه فعلی برنامه ادامه دارد. آماده‌شدن فضا به معنی تأیید ماندگاری داده، پشتیبان‌گیری یا سلامت سایت نیست.</p>
    <details><summary>مشخصات فضا و اعتبار پیشنهاد</summary>
      <dl className="profile-facts">
        <div><dt>نام فضای تازه</dt><dd><bdi>{spec.disk.name}</bdi></dd></div>
        <div><dt>مسیر استفاده پس از انتشار</dt><dd><bdi>/data</bdi></dd></div>
        <div><dt>پلن فعلی</dt><dd><bdi>{spec.args.planId} / {spec.bundleId}</bdi></dd></div>
        <div><dt>مهلت</dt><dd>{new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" }).format(deadline)}</dd></div>
      </dl>
    </details>
    <p role="status">{status}</p>
    {pending ? <div className="button-row">
      {!expired ? <button type="button" disabled={disabled} onClick={() => onDecision("approve")}>تأیید و ساخت فضای پایدار</button> : null}
      <button type="button" className="button-secondary" disabled={disabled} onClick={() => onDecision("reject")}>{expired ? "بستن پیشنهاد منقضی‌شده" : "رد ساخت فضای پایدار"}</button>
    </div> : null}
    {!waiting && (canReadDiskResult(action) || resumable) ? <button type="button" className="button-secondary" disabled={disabled} onClick={onObserve}>بررسی نتیجه ساخت فضای پایدار</button> : null}
  </section>;
}
