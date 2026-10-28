"use client";
import { useEffect, useState } from "react";
import type { Action } from "../contracts/domain.ts";
import { canReadDatabaseResult } from "../contracts/database-provision.ts";

export function AgentDatabase({ action, waiting, disabled, resumable, onDecision, onObserve }: {
  action: Action; waiting: boolean; disabled: boolean; resumable: boolean;
  onDecision: (decision: "approve" | "reject") => void; onObserve: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const deadline = Math.min(action.expiresAt, (action.spec.version === 27 || action.spec.version === 28) ? action.spec.cost.expiresAt : action.expiresAt);
  useEffect(() => {
    const timer = window.setTimeout(() => setNow(Date.now()), Math.max(1, Math.min(deadline - Date.now() + 1, 2147483647)));
    return () => window.clearTimeout(timer);
  }, [deadline]);
  if ((action.spec.version !== 27 && action.spec.version !== 28)) return null;
  const spec = action.spec, expired = action.state === "expired" || deadline <= now,
    pending = waiting && (action.state === "awaiting_approval" || action.state === "expired"), verified = action.state === "succeeded",
    number = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 8 });
  const status = verified ? "هویت دیتابیس تأیید شد؛ اتصال امن، migration و ماندگاری داده هنوز بررسی نشده‌اند."
    : action.state === "cancelled" ? "ساخت دیتابیس رد شد؛ درخواستی ارسال نشد."
    : action.state === "failed" ? "ساخت دیتابیس تأیید نشد؛ رسید بررسی حفظ شده است."
    : action.state === "uncertain" ? "نتیجه نامعلوم است؛ ساخت تکرار نمی‌شود و فقط رسید همان درخواست بررسی می‌شود."
    : action.state === "observing" ? "درخواست پذیرفته شد؛ هویت دیتابیس در حال بررسی است."
    : action.state === "executing" ? "درخواست ساخت همین دیتابیس آغاز شده است."
    : action.state === "approved" ? "تصمیم شما ثبت شد؛ ساخت در صف اجراست."
    : expired ? "اعتبار قیمت تمام شده است؛ پیشنهاد تازه لازم است."
    : "این بخش برنامه به دیتابیس نیاز دارد. ساخت با همین مشخصات و در شبکهٔ مقصد انجام می‌شود.";
  return <section className="agent-repair destination-card" aria-labelledby="database-title">
    <h3 id="database-title">{verified ? "دیتابیس ساخته شد" : "دیتابیس موردنیاز پروژه"}</h3>
    <dl className="profile-facts">
      <div><dt>برنامه مقصد</dt><dd><bdi>{spec.scope.app}</bdi></dd></div>
      <div><dt>نوع و نسخه</dt><dd><bdi>{spec.database.type} {spec.database.version}</bdi></dd></div>
      {spec.version === 28 ? <div><dt>اتصال این دیتابیس در برنامه</dt><dd>{spec.bindingKeys.map(key => <bdi key={key}> {key} </bdi>)}</dd></div> : null}
      <div><dt>هزینهٔ پلن</dt><dd>{number.format(spec.cost.planHourlyToman)} تومان در ساعت</dd></div>
      <div><dt>هزینهٔ بستهٔ امکانات</dt><dd>{number.format(spec.cost.bundleHourlyToman)} تومان در ساعت</dd></div>
      <div><dt>دسترسی شبکه</dt><dd>خصوصی، در شبکهٔ همین مقصد</dd></div>
    </dl>
    <p>یک دیتابیس تازه و خالی ساخته می‌شود. اتصال امن به برنامه و اجرای تغییرات ساختار داده، مرحله‌های بعدی با تصمیم جدا هستند.</p>
    {spec.version === 28 ? <p>کلیدهای اتصال فهرست‌شده به همین یک دیتابیس وصل می‌شوند؛ دیتابیس دیگر، پیشنهاد و تصمیم جدا دارد.</p> : null}
    <p className="hint">دو مؤلفهٔ قیمت از حساب خوانده شده‌اند؛ مبلغ نهایی محاسبه نشده است. مالیات، ترافیک و هزینه‌های دیگر نامشخص‌اند. پلن فعلی برنامه هم ادامه دارد.</p>
    <details><summary>مشخصات دیتابیس و اعتبار پیشنهاد</summary><dl className="profile-facts">
      <div><dt>بخش مصرف‌کننده</dt><dd><bdi>{spec.consumerRoot}</bdi></dd></div>
      <div><dt>نام دیتابیس</dt><dd><bdi>{spec.database.hostname}</bdi></dd></div>
      <div><dt>پلن و بسته</dt><dd><bdi>{spec.database.planId} / {spec.database.bundleId}</bdi></dd></div>
      <div><dt>شبکه</dt><dd><bdi>{spec.database.networkId}</bdi></dd></div>
      <div><dt>مهلت تصمیم</dt><dd>{new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" }).format(deadline)}</dd></div>
    </dl></details>
    <p role="status">{status}</p>
    {pending ? <div className="button-row">
      {!expired ? <button type="button" disabled={disabled} onClick={() => onDecision("approve")}>تأیید و ساخت دیتابیس</button> : null}
      <button type="button" className="button-secondary" disabled={disabled} onClick={() => onDecision("reject")}>{expired ? "بستن پیشنهاد منقضی‌شده" : "رد ساخت دیتابیس"}</button>
    </div> : null}
    {!waiting && (canReadDatabaseResult(action) || resumable) ? <button type="button" className="button-secondary" disabled={disabled} onClick={onObserve}>بررسی نتیجه ساخت دیتابیس</button> : null}
  </section>;
}
