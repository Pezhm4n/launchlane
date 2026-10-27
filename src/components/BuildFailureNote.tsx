import type { CodeRepairJob } from "../contracts/code-repair.ts";
import { buildFailureSignals } from "../contracts/build-failure-signals.ts";

export function BuildFailureNote({ job }: { job: CodeRepairJob }) {
  const receipt = job.afterTest ?? job.beforeTest;
  if (job.state !== "failed" || !receipt || receipt.passed) return null;
  const signals = buildFailureSignals(receipt.output.split(/\r?\n/));
  if (!signals.length) return null;
  return <section className="note" aria-label="راهنمای گزارش ناموفق">
    <p>در گزارش ناموفق این نشانه‌ها دیده شد. علت قطعی هنوز تأیید نشده است.</p>
    <ul>{signals.map(signal => <li key={signal.code}><p>{signal.message}</p><p>{signal.nextCheck}</p></li>)}</ul>
    <p className="hint">برای متن و شمارهٔ خط، جزئیات رسید آزمون را ببینید. این راهنما اجازهٔ تغییر یا اجرای دوباره ایجاد نمی‌کند.</p>
  </section>;
}
