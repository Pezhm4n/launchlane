import type { CodeRepairJob } from "../contracts/code-repair.ts";

export function MigrationTestReview({ job }: { job: CodeRepairJob }) {
  const database = job.build?.version === 7 ? job.build.testDatabase : undefined;
  if (database?.version !== 2) return null;
  const migration = database.migration, receipt = job.afterTest?.passed ? job.afterTest.databaseMigration : undefined,
    number = new Intl.NumberFormat("fa-IR");
  return <section aria-labelledby="migration-test-title">
    <h4 id="migration-test-title">آزمون تغییرات ساختار و داده</h4>
    <p>{number.format(migration.files.length)} فایل SQL همین نسخه، به ترتیب زیر و با دسترسی محدود در دیتابیس موقت اجرا می‌شوند. schema و داده مستقل از خروجی برنامه خوانده می‌شوند؛ سپس برنامه در محیط تازه دوباره اجرا می‌شود.</p>
    <p className="note">آزمون اصلی باید دادهٔ تازه بنویسد و همان داده در اجرای دوم حفظ شود. این تصمیم فقط آزمون ایزوله با دادهٔ ساختگی را مجاز می‌کند؛ دیتابیس واقعی پروژه، انتشار و راه‌اندازی دوبارهٔ خود دیتابیس تصمیم و سنجش جدا دارند.</p>
    <ol>{migration.files.map(file => <li key={file.path}><bdi>{file.path}</bdi></li>)}</ol>
    <details><summary>ستون‌ها، دادهٔ مورد انتظار و هویت فایل‌ها</summary>
      <p>کلیدهای اتصال موقت: {database.environmentKeys.map(key => <bdi key={key}> {key} </bdi>)}. در این آزمون مقدار واقعی یا تنظیمات پنهان پروژه تزریق نمی‌شود.</p>
      <pre dir="ltr"><code>{JSON.stringify({ columns: migration.columns, rows: migration.rows, persistence: migration.persistence, files: migration.files }, null, 2)}</code></pre>
    </details>
    {receipt ? <><p role="status">همان داده پس از اجرای دوبارهٔ برنامه حفظ شد.</p><dl className="profile-facts">
      <div><dt>ستون‌های بررسی‌شده</dt><dd>{number.format(receipt.columnChecks)}</dd></div>
      <div><dt>ردیف‌های بررسی‌شده</dt><dd>{number.format(receipt.rowChecks)}</dd></div>
      <div><dt>سنجش‌های نوشتن و ماندگاری</dt><dd>{number.format(receipt.persistenceChecks)}</dd></div>
      <div><dt>اجرای مستقل برنامه</dt><dd>{number.format(receipt.applicationRuns)}</dd></div>
    </dl><p className="hint">همان فایل‌ها بدون اجرای دوبارهٔ تغییرات اعمال‌شده بررسی شدند. این رسید، ماندگاری پس از restart دیتابیس یا رفتار نسخهٔ عمومی را تأیید نمی‌کند.</p></> : null}
  </section>;
}
