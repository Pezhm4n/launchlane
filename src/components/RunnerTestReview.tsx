import type { DisposableTestDatabase } from "../contracts/test-database.ts";
import type { PostgresRunnerTestReceipt } from "../contracts/postgres-runner-test.ts";

export function RunnerTestReview({ database, receipt }: { database: Extract<DisposableTestDatabase, { version: 3 }>; receipt: PostgresRunnerTestReceipt | undefined }) {
  const number = new Intl.NumberFormat("fa-IR");
  return <section aria-labelledby="migration-test-title">
    <h4 id="migration-test-title">آزمون آماده‌سازی و دادهٔ چند دیتابیس</h4>
    <p>فرمان موجود پروژه <bdi>npm run {database.runner.script}</bdi> در worker محدود اجرا می‌شود. ترتیب و transactionها را همان runner پروژه مدیریت می‌کند؛ SQL اصلی تغییر نمی‌کند.</p>
    <p className="note">{number.format(database.targets.length)} دیتابیس با role و ورودی اتصال جدا روی یک PostgreSQL موقت ساخته می‌شوند. این تصمیم فقط دادهٔ ساختگی همین آزمون را پوشش می‌دهد؛ ساخت منابع واقعی، migration تولیدی و انتشار تصمیم جدا دارند.</p>
    <p>پس از خواندن مستقل schema و داده، آزمون اصلی برنامه باید در هر دیتابیس مقدار تازه بنویسد. اجرای دوبارهٔ runner باید همان مقدار را حفظ کند؛ سپس یک برنامهٔ تازه نیز همان داده را می‌خواند.</p>
    <ul>{database.targets.map(target => <li key={target.id}><bdi>{target.id}</bdi> — {target.environmentKeys.map(key => <bdi key={key}> {key} </bdi>)}</li>)}</ul>
    <details><summary>فرمان و hookها، معیار هر دیتابیس و هویت نسخه</summary>
      <pre dir="ltr"><code>{JSON.stringify({ runner: database.runner, targets: database.targets }, null, 2)}</code></pre>
    </details>
    {receipt ? <><p role="status">همان داده در همهٔ دیتابیس‌ها پس از اجرای دوبارهٔ runner و برنامه حفظ شد.</p>
      <dl className="profile-facts">{receipt.targets.map(target => <div key={target.id}><dt><bdi>{target.id}</bdi></dt><dd>{number.format(target.columnChecks)} ستون، {number.format(target.rowChecks)} ردیف و {number.format(target.persistenceChecks)} سنجش ماندگاری</dd></div>)}</dl>
      <p className="hint">این رسید، معیارهای دادهٔ انتخاب‌شده را تأیید می‌کند؛ اجرا نشدن دوبارهٔ تمام migrationها، restart دیتابیس، دیسک پایدار provider یا رفتار نسخهٔ عمومی را اثبات نمی‌کند.</p>
    </> : null}
  </section>;
}
