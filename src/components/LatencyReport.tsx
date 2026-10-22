import type { EvidenceBundle } from "../contracts/incident.ts";
import { summarizeLatency } from "../contracts/latency.ts";

const number = new Intl.NumberFormat("fa-IR");
export function LatencyReport({
  before,
  after,
}: {
  before: EvidenceBundle;
  after: EvidenceBundle | null;
}) {
  return (
    <section className="latency-report" aria-labelledby="latency-title">
      <h3 id="latency-title">زمان پاسخ همین صفحه</h3>
      <p className="hint">
        سه درخواست کوتاه و متوالی، بدون ورود به سایت؛ زمان اتصال تا دریافت پاسخ محدود اندازه‌گیری
        می‌شود. این عدد، زمان بازشدن کامل صفحه یا آزمون ظرفیت نیست.
      </p>
      <dl className="incident-summary">
        {[
          { label: "بررسی نخست", bundle: before },
          ...(after ? [{ label: "بررسی تازه", bundle: after }] : []),
        ].map(({ label, bundle }) => {
          const summary = summarizeLatency(bundle);
          return (
            <div key={label}>
              <dt>{label}</dt>
              <dd>
                {summary.state === "complete" &&
                summary.medianMs !== null &&
                summary.minMs !== null &&
                summary.maxMs !== null ? (
                  <>
                    <p>
                      میانه: <strong>{number.format(summary.medianMs)} میلی‌ثانیه</strong>
                    </p>
                    <p>
                      بازه: {number.format(summary.minMs)} تا {number.format(summary.maxMs)}{" "}
                      میلی‌ثانیه
                    </p>
                  </>
                ) : (
                  <p>{summary.reason}</p>
                )}
                <p className="hint">
                  تعداد پاسخ‌های زمان‌دار: {number.format(summary.samples.length)} از ۳
                </p>
                {summary.samples.length ? (
                  <details>
                    <summary>زمان تک‌تک پاسخ‌ها</summary>
                    <ol>
                      {summary.samples.map((sample) => (
                        <li key={sample.id}>
                          {number.format(sample.durationMs)} میلی‌ثانیه · پاسخ{" "}
                          <bdi>{sample.status}</bdi>
                        </li>
                      ))}
                    </ol>
                  </details>
                ) : null}
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="note">
        مصرف پردازنده و حافظه در این بررسی قابل تفسیر نیست. از این زمان‌ها، علت کندی یا نیاز به خرید
        پلن بزرگ‌تر نتیجه نمی‌شود.
      </p>
    </section>
  );
}
