import type { Action } from "../contracts/domain.ts";
import { useEffect, useState } from "react";
import { canReadDestinationResult, isProvisionSpec } from "../contracts/provision.ts";
import type { DestinationRecommendation } from "../contracts/destination-recommendation.ts";
import { DestinationPlans } from "./DestinationPlans.tsx";

const number = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 });
export function AgentDestination({ action, waiting, disabled, resumable, onDecision, onObserve, recommendation, onPlanChange, changingPlan }: {
  action: Action; waiting: boolean; disabled: boolean; resumable: boolean;
  onDecision: (decision: "approve" | "reject") => void; onObserve: () => void;
  recommendation?: DestinationRecommendation | null; onPlanChange?: (planId: string, bundleId: string) => void;
  changingPlan?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setTimeout(() => setNow(Date.now()), Math.max(1, Math.min(action.expiresAt - Date.now() + 1, 2147483647)));
    return () => window.clearTimeout(timer);
  }, [action.expiresAt]);
  if (!isProvisionSpec(action.spec)) return null;
  const spec = action.spec, verified = action.state === "succeeded",
    expired = action.state === "expired" || action.expiresAt <= now,
    pending = waiting && (action.state === "awaiting_approval" || action.state === "expired");
  const status = verified ? "مقصد و تنظیمات آن تأیید شدند؛ فایل‌ها هنوز با این تصمیم منتشر نمی‌شوند."
    : action.state === "cancelled" ? "ساخت مقصد رد شد؛ برنامه‌ای ساخته نشد."
    : action.state === "failed" ? "ساخت مقصد با تنظیمات مورد انتظار تأیید نشد؛ رسید بررسی حفظ شده است."
    : action.state === "uncertain" ? "نتیجه ساخت نامعلوم است؛ فقط رسید قبلی بررسی می‌شود و ساخت تکرار نمی‌شود."
    : action.state === "observing" ? "رسید ساخت دریافت شد؛ هویت و تنظیمات مقصد در حال بررسی است."
    : action.state === "executing" ? "درخواست ساخت همین مقصد آغاز شده است."
    : action.state === "approved" ? "تصمیم شما ثبت شد؛ ساخت در صف اجراست."
    : expired ? "اعتبار برآورد تمام شده است؛ این پیشنهاد را ببندید و درخواست تازه‌ای بفرستید."
    : "هنوز برنامه‌ای ساخته نشده است؛ ابتدا نام و هزینه را بررسی کنید.";
  return (
    <section className="agent-repair destination-card" aria-labelledby="destination-title">
      <h3 id="destination-title">{verified ? "مقصد ساخته شد" : "ساخت مقصد تازه"}</h3>
      {recommendation ? <DestinationPlans recommendation={recommendation} selected={{ planId: spec.args.planId, bundleId: spec.bundleId }}
        disabled={disabled || !pending || expired} changing={changingPlan === true} {...(onPlanChange ? { onChange: onPlanChange } : {})} /> : null}
      {!recommendation ? <dl className="profile-facts">
        <div><dt>نام برنامه</dt><dd><bdi>{spec.scope.app}</bdi></dd></div>
        <div><dt>هزینه پایه</dt><dd>{number.format(spec.cost.hourlyHundredthsToman / 100)} تومان در ساعت</dd></div>
        <div><dt>موقعیت</dt><dd>{spec.cost.region === "iran" ? "ایران" : spec.cost.region}</dd></div>
      </dl> : null}
      <p>مقصد <bdi>{spec.scope.app}</bdi> در حساب متصل ساخته می‌شود. سپس ساخت، اصلاح مجاز و انتشار پروژه با برنامه‌ای روشن و تصمیم شما پیگیری می‌شود.</p>
      {!recommendation ? <p className="hint">هزینه پایه از زمان ساخت تا حذف برنامه ادامه دارد. مالیات، ترافیک و فضای اضافه در نرخ بالا حساب نشده‌اند؛ این مبلغ صورتحساب نهایی نیست. نیاز واقعی پروژه به منابع هنوز اندازه‌گیری نشده است.</p> : null}
      <details>
        <summary>پلن، شبکه و اعتبار برآورد</summary>
        <dl className="profile-facts">
          <div><dt>پلن / بسته امکانات</dt><dd><bdi>{spec.args.planId} / {spec.bundleId}</bdi></dd></div>
          <div><dt>شبکه موجود</dt><dd><bdi>{spec.networkId}</bdi></dd></div>
          <div><dt>اعتبار پیشنهاد</dt><dd>{new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" }).format(action.expiresAt)}</dd></div>
          {action.provision?.appId ? <div><dt>شناسه تأییدشده مقصد</dt><dd><bdi>{action.provision.appId}</bdi></dd></div> : null}
        </dl>
        <p>انتخاب پلن به معنی تضمین ظرفیت آن نیست. ساخت، هویت و تنظیمات مقصد را بررسی می‌کند؛ بررسی پاسخ سایت پس از انتشار انجام می‌شود.</p>
      </details>
      <p role="status">{status}</p>
      {pending ? <div className="button-row">
        {!expired ? <button type="button" disabled={disabled} onClick={() => onDecision("approve")}>تأیید هزینه و ساخت مقصد</button> : null}
        <button type="button" className="button-secondary" disabled={disabled} onClick={() => onDecision("reject")}>{expired ? "بستن پیشنهاد منقضی‌شده" : "رد ساخت مقصد"}</button>
      </div> : null}
      {!waiting && (canReadDestinationResult(action) || resumable) ? <button type="button" className="button-secondary" disabled={disabled} onClick={onObserve}>ادامه بررسی نتیجه ساخت</button> : null}
    </section>
  );
}
