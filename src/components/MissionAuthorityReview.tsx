import type { MissionAuthority } from "../contracts/mission-authority.ts";
import type { AgentState } from "../contracts/agent.ts";

export function MissionAuthorityReview({ authority, runState, disabled, onDecision }: {
  authority: MissionAuthority; runState: AgentState; disabled: boolean; onDecision: (decision: "approve" | "reject") => void;
}) {
  const plan = authority.plan;
  return <section className="agent-repair publication-card" aria-labelledby="mission-authority-title">
    <h3 id="mission-authority-title">برنامهٔ انتشار و پیگیری خطا</h3>
    <p>نسخه‌ای جدا از پروژه ساخته و بررسی می‌شود. خطاهای قابل اصلاح در فایل‌های مشخص‌شده اصلاح می‌شوند و فقط بسته‌ای که آزمون را گذرانده به <bdi>{plan.target.app}</bdi> ارسال می‌شود.</p>
    <p>حداکثر {plan.maxBuildJobs} بررسی ساخت، {plan.maxRepairs} تلاش اصلاح و {plan.maxPublications} انتشار تا {new Date(plan.expiresAt).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })} مجاز است. بودجه قبلی مأموریت ادامه دارد.</p>
    <p>هزینهٔ پایهٔ پلن موجود {plan.cost.hourlyHundredthsToman / 100} تومان در ساعت است؛ مالیات، ترافیک و ذخیره‌سازی در این مبلغ نیست. ساخت منبع تازه، افزایش پلن و تغییر اطلاعات محرمانه مجاز نیست. مصرف مدل از سقف همین مأموریت محاسبه می‌شود. تغییر قیمت، مقصد، معیار آزمون، وابستگی‌ها یا خروج از حدود برنامه تصمیم تازه لازم دارد.</p>
    <details><summary>محدوده و اطلاعات فنی برنامه</summary>
      <dl className="profile-facts">
        <div><dt>حساب</dt><dd><bdi>{plan.target.accountId}</bdi></dd></div>
        <div><dt>پلن موجود</dt><dd><bdi>{plan.target.planId}</bdi></dd></div>
        <div><dt>معیار بررسی</dt><dd><bdi>{plan.build.workload.path}</bdi>، وضعیت {plan.build.workload.status}، همان نشانهٔ پاسخ برنامه</dd></div>
        <div><dt>سقف کل مأموریت</dt><dd>{plan.limits.maxModelCalls} درخواست مدل و {plan.limits.maxToolCalls} ابزار؛ حداکثر {plan.limits.runTimeoutMs / 1000} ثانیه اجرای فعال</dd></div>
      </dl>
      <p>فایل‌های مجاز اصلاح:</p><ul>{plan.allowedPaths.map(path => <li key={path}><bdi>{path}</bdi></li>)}</ul>
      <p>تست‌ها، تنظیمات ساخت و وابستگی‌ها ثابت می‌مانند. توقف سرور اختیار اجرای تازه را لغو می‌کند؛ نتیجهٔ نامعلوم پیش از هر ارسال دیگر بررسی می‌شود.</p>
    </details>
    {authority.state === "proposed" ? <div className="button-row">
      <button type="button" disabled={disabled} onClick={() => onDecision("approve")}>تأیید برنامه و شروع انتشار</button>
      <button type="button" className="button-secondary" disabled={disabled} onClick={() => onDecision("reject")}>رد برنامه</button>
    </div> : <p role="status">{runState === "completed" ? "برنامه پایان یافت؛ نتیجهٔ تأییدشده در کارت انتشار ثبت شده است."
      : authority.state !== "approved" || Date.now() >= plan.expiresAt ? "اختیار برنامه پایان یافته است؛ رسیدها حفظ شده‌اند."
      : runState === "working" || runState === "queued" ? "اختیار برنامه ثبت شده است؛ مراحل مجاز خودکار پیگیری می‌شوند."
      : "اجرا متوقف شده است؛ علت و تصمیم لازم در مراحل مأموریت ثبت شده‌اند."}</p>}
  </section>;
}
