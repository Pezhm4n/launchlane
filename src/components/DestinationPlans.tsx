import type { DestinationRecommendation } from "../contracts/destination-recommendation.ts";
import styles from "./DestinationPlans.module.css";
import { WorkspaceGlyph } from "./WorkspaceGlyph.tsx";

const number = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 });
export function DestinationPlans({ recommendation, selected, disabled, onChange, changing }: {
  recommendation: DestinationRecommendation; selected: { planId: string; bundleId: string }; disabled: boolean;
  onChange?: (planId: string, bundleId: string) => void;
  changing?: boolean | undefined;
}) {
  return <div className={styles.plans} aria-busy={changing === true}>
    <div className={styles.intro}>
      <span className={styles.eyebrow}>انتخاب منابع برای پروژهٔ شما</span>
      <h4>پیشنهاد شروع برای <bdi>{recommendation.projectName}</bdi></h4>
      <p>{recommendation.summary}</p>
      {changing ? <p role="status"><WorkspaceGlyph name="loader" /> در حال بررسی قیمت و ثبت پلن انتخابی…</p> : null}
    </div>
    <fieldset className={styles.fieldset} disabled={disabled || !onChange}>
      <legend>پلن انتشار را انتخاب کنید</legend>
      <div className={styles.grid}>
        {recommendation.offers.map((offer, index) => {
          const active = offer.planId === selected.planId && offer.bundleId === selected.bundleId,
            recommended = offer.planId === recommendation.recommended.planId && offer.bundleId === recommendation.recommended.bundleId;
          return <label key={`${offer.planId}/${offer.bundleId}`} className={styles.option} data-selected={active}>
            <span className={styles.topline}>
              <input type="radio" name="destination-plan" checked={active} onChange={() => onChange?.(offer.planId, offer.bundleId)}
                aria-label={`${offer.planId}، ${number.format(offer.hourlyHundredthsToman / 100)} تومان در ساعت${recommended ? "، پیشنهاد شروع" : ""}`} />
              <span className={recommended ? styles.recommended : styles.region}>{recommended ? "پیشنهاد شروع" : offer.region === "iran" ? "ایران" : offer.region}</span>
            </span>
            <span className={styles.title}>{recommended ? "شروع کم‌هزینه" : `گزینهٔ ${number.format(index + 1)}`}</span>
            <span className={styles.price}>{number.format(offer.hourlyHundredthsToman / 100)}</span>
            <span className={styles.unit}>تومان در ساعت</span>
            <span className={styles.planName}><bdi>{offer.planId}</bdi> · <bdi>{offer.bundleId}</bdi></span>
            <span className={styles.selection}>{active ? "انتخاب فعلی" : "انتخاب این پلن"}</span>
          </label>;
        })}
      </div>
    </fieldset>
    <p className={styles.reason}>{recommendation.reason}</p>
    <p className="hint">هزینه از زمان ساخت تا حذف مقصد ادامه دارد. مالیات، ترافیک و فضای اضافه جدا هستند. تغییر پلن ابتدا پیشنهاد و تأیید قبلی را نامعتبر می‌کند؛ بدون تصمیم شما خریدی انجام نمی‌شود.</p>
  </div>;
}
