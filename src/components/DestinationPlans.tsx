import type { DestinationRecommendation } from "../contracts/destination-recommendation.ts";
import styles from "./DestinationPlans.module.css";
import { WorkspaceGlyph } from "./WorkspaceGlyph.tsx";

const number = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 }),
  digits = Array.from({ length: 10 }, (_, digit) => integer.format(digit)),
  decimal = number.formatToParts(0.1).find(part => part.type === "decimal")?.value ?? "٫";
function formatHundredths(value: bigint): string {
  const whole = integer.format(value / 100n), remainder = value % 100n;
  if (remainder === 0n) return whole;
  const fraction = String(remainder).padStart(2, "0").replace(/0$/, "");
  return `${whole}${decimal}${[...fraction].map(digit => digits[Number(digit)]).join("")}`;
}
export function planCostProjection(hourlyHundredthsToman: number) {
  if (!Number.isSafeInteger(hourlyHundredthsToman) || hourlyHundredthsToman < 0) throw new RangeError("Expected a nonnegative integer hourly quote");
  const hourly = BigInt(hourlyHundredthsToman);
  return { day: formatHundredths(hourly * 24n), month: formatHundredths(hourly * 720n) };
}
function smallAmountWords(value: number): string {
  const small = ["صفر", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه", "ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده"],
    tens = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"],
    hundreds = ["", "صد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];
  if (value < 20) return small[value] ?? "";
  const scale = value >= 1000 ? 1000 : value >= 100 ? 100 : 10, whole = Math.floor(value / scale), rest = value % scale,
    prefix = scale === 1000 ? `${whole === 1 ? "" : `${small[whole]} `}هزار` : scale === 100 ? hundreds[whole] : tens[whole];
  return `${prefix}${rest ? ` و ${smallAmountWords(rest)}` : ""}`;
}
export function readablePlanCost(hourlyHundredthsToman: number, hours: 1 | 24 | 720 = 1): string {
  if (!Number.isSafeInteger(hourlyHundredthsToman) || hourlyHundredthsToman < 0) throw new RangeError("Expected a nonnegative integer hourly quote");
  const total = BigInt(hourlyHundredthsToman) * BigInt(hours);
  if (total === 0n) return "صفر تومن";
  if (total < 100n) return "کمتر از یک تومن";
  const rounded = (total + 50n) / 100n;
  if (rounded < 10000n) return `حدود ${smallAmountWords(Number(rounded))} تومن`;
  const scales = [[1000000000000n, "هزار میلیارد"], [1000000000n, "میلیارد"], [1000000n, "میلیون"], [1000n, "هزار"]] as const;
  for (const [unit, label] of scales) {
    const precision = unit === 1000n ? 1n : 10n, amount = (total * precision + unit * 50n) / (unit * 100n);
    if (rounded < unit && amount < precision) continue;
    const whole = amount / precision, fraction = amount % precision;
    return `حدود ${integer.format(whole)}${fraction ? `${decimal}${integer.format(fraction)}` : ""} ${label} تومن`;
  }
  throw new RangeError("Expected a displayable quote");
}
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
            recommended = offer.planId === recommendation.recommended.planId && offer.bundleId === recommendation.recommended.bundleId,
            hourly = readablePlanCost(offer.hourlyHundredthsToman);
          return <label key={`${offer.planId}/${offer.bundleId}`} className={styles.option} data-selected={active}>
            <span className={styles.topline}>
              <input type="radio" name="destination-plan" checked={active} onChange={() => onChange?.(offer.planId, offer.bundleId)}
                aria-label={`${offer.planId}، ${hourly} در ساعت${recommended ? "، پیشنهاد شروع" : ""}`} />
              <span className={recommended ? styles.recommended : styles.region}>{recommended ? "پیشنهاد شروع" : offer.region === "iran" ? "ایران" : offer.region}</span>
            </span>
            <span className={styles.title}>{recommended ? "شروع کم‌هزینه" : `گزینهٔ ${number.format(index + 1)}`}</span>
            <span className={styles.price}>{hourly}</span>
            <span className={styles.unit}>برای هر ساعت</span>
            <span className={styles.estimates}>
              <span className={styles.estimateLabel}>برآورد روشن‌ماندن پیوسته</span>
              <span className={styles.estimate}><span>۲۴ ساعت</span><span>{readablePlanCost(offer.hourlyHundredthsToman, 24)}</span></span>
              <span className={styles.estimate}><span>۳۰ روز</span><span>{readablePlanCost(offer.hourlyHundredthsToman, 720)}</span></span>
            </span>
            <span className={styles.planName}><bdi>{offer.planId}</bdi> · <bdi>{offer.bundleId}</bdi></span>
            <span className={styles.selection}>{active ? "انتخاب فعلی" : "انتخاب این پلن"}</span>
          </label>;
        })}
      </div>
    </fieldset>
    <details className={styles.exactCosts}>
      <summary>مبلغ دقیق پلن‌ها</summary>
      <dl>{recommendation.offers.map(offer => {
        const projection = planCostProjection(offer.hourlyHundredthsToman);
        return <div key={`${offer.planId}/${offer.bundleId}`}>
          <dt><bdi>{offer.planId}</bdi> · <bdi>{offer.bundleId}</bdi></dt>
          <dd>هر ساعت: <bdi>{formatHundredths(BigInt(offer.hourlyHundredthsToman))}</bdi> تومان؛ ۲۴ ساعت: <bdi>{projection.day}</bdi> تومان؛ ۳۰ روز: <bdi>{projection.month}</bdi> تومان</dd>
        </div>;
      })}</dl>
    </details>
    <p className={styles.reason}>{recommendation.reason}</p>
    <p className="hint">برآوردهای ۲۴ ساعت و ۳۰ روز با فرض روشن‌ماندن پیوسته و ثابت‌ماندن نرخ همین پیشنهاد محاسبه شده‌اند؛ صورتحساب واقعی ممکن است متفاوت باشد.</p>
    <p className="hint">هزینه از زمان ساخت تا حذف مقصد ادامه دارد. مالیات، ترافیک و فضای اضافه جدا هستند. تغییر پلن ابتدا پیشنهاد و تأیید قبلی را نامعتبر می‌کند؛ بدون تصمیم شما خریدی انجام نمی‌شود.</p>
  </div>;
}
