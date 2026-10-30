# شواهد اعتبارسنجی Launchlane

این صفحه ورودی کوتاه شواهد است؛ نتیجهٔ هر آزمون فقط برای revision، ورودی و تنظیمات
همان گزارش معتبر است. **قرارداد مصنوعی، اجرای محلی واقعی و اجرای واقعی provider
سه سطح متفاوت‌اند.** جمع‌کردن تعداد تست‌های چند نسخه، full pass تازه ایجاد نمی‌کند.

## آماده‌سازی مستندات مخزن؛ ۲۰۲۶-۱۰-۳۰

روی پایهٔ `32bb2aa` و تغییرات مستندات/metadata: checker دو README صفرerror/warning؛
لینک‌های محلی سالم؛۵YAML parse و event/permission/SHAهای action با manifest رسمی
تطبیق داده شدند. رندر واقعی Mermaid12.2.0 و Markdown محلی با Chromium در۸ترکیب
دو زبان،390/1280 و light/dark، با تصویرها و لینک تعویض زبان و بدون overflow گذشت.
این تقریب محلی است؛ رندر خود GitHub یا اجرای hosted CI نیست. setup در فضای موقت
دو بار اجرا و حفظ کلیدهای مستقل، config معتبر و gateهای خاموش کنترل شد؛ هیچ provider
تماس نگرفت. lint صفرerror/48warning/22info بود. بررسی محدود۲۵۱۶blob تاریخچهٔ HEAD و
فایل‌های candidate با secretهای محلیِ شناخته‌شده و چهار الگوی token، فقط marker
ساختگی تست workspace را یافت؛ نبود secret ناشناخته یا امنیت جامع اثبات نمی‌شود.
build/domain/runtime تازه برای تغییر مستندات اجرا نشد؛ اعداد برش زیر تاریخی‌اند.

## آخرین برش داده

[بررسی مستقل PostgreSQL انتشار](evidence/postgres-data-observation.md) به implementation
ثبت‌شده در `32bb2aa` مربوط است: snapshot نهایی `data-read-r8`، Node24.18.0،
domain820/820، HTTP49/49، مرورگر داده10 حالت، guided54، typecheck، lint بدون error،
build با Webpack و3case واقعی Docker/SQL. اجرای runtime پس از تکمیل cache روی همان
بایت‌ها تکرار شد؛ failureهای قبلی در گزارش حفظ‌اند. مدل/provider مصنوعی بودند؛
SQL محلی واقعی بود. production migration، نوشتن برنامه و restart persistence
از آن نتیجه نمی‌شوند. این اعداد نتیجهٔ تازهٔ تغییرات مستندات نیستند.

## پیدا کردن شاهد مناسب

| مرز | گزارش و حدود |
| --- | --- |
| مسیر کاربر و انتشار هدایت‌شده | [guided publication](evidence/guided-publication.md)؛ مسیر وب و نمونه‌های محدود واقعی |
| تشخیص با مدل واقعی | [agent investigation](evidence/agent-investigation.md)؛ scope، درخواست‌ها و failureهای همان اجرا |
| ساخت و اصلاح | [project preparation](evidence/project-preparation.md)، [locked dependencies](evidence/locked-native-dependencies-20261026.md) |
| پلتفرم‌ها | [ماتریس جاری و افزوده‌های تاریخ‌دار](platform-support.md)؛ detection، worker و native publication جدا هستند |
| دادهٔ موقت و artifact | [runner اصلی](evidence/project-migration-runners.md)، [artifact آزموده‌شده](evidence/data-tested-artifact.md) |
| منابع و اتصال خصوصی | [ساخت منبع](evidence/managed-database.md)، [چند منبع](evidence/managed-database-targets.md)، [منبع موجود](evidence/existing-managed-database.md)؛ provider زندهٔ SQL ادعا نمی‌شود |
| rollback | [maintenance و artifact قبلی](evidence/agent-rollback-maintenance.md)؛ سازگاری schema/data مستقل است |
| MCP | [application مشترک](evidence/mcp-shared-application.md)، [میزبان مستقل](evidence/mcp-hosted-independent-20261025.md) |
| ورود و میزبانی | [هویت لیارا](evidence/liara-identity-login.md)، [release تاریخی میزبان](evidence/launchlane-hosted-release.md)؛ سلامت امروز نیست |

## اجرای بررسی تازه

فرمان‌ها و پیش‌نیاز دقیق در [AGENTS.md](../AGENTS.md) و مسیر کوتاه توسعه در
[CONTRIBUTING.md](../CONTRIBUTING.md) هستند. تست‌ها را متناسب با مرز تغییر انتخاب
کنید. آزمون synthetic، اجرای cloud، SQL تولیدی یا مصرف مدل را مجاز نمی‌کند.

گزارش تازه باید revision/hash، Node/dependency، ورودی و oracle، دستور، نتیجه و
failureهای حفظ‌شده را مشخص کند. ناتوانی در خواندن، timeout یا دادهٔ ناقص، نتیجهٔ
سالم تولید نمی‌کند. live فقط زمانی نوشته شود که همان provider/workload واقعاً
اجرا و نتیجه به همان artifact/release/scope متصل شده باشد.

## سوابق

[دفتر کامل اعتبارسنجی تا ۲۰۲۶-۱۰-۲۹](archive/verification-20261029.md) برای بازتولید
تصمیم‌ها و failureها حفظ شده است. گزارش‌های قدیمی معیار وضعیت فعلی نیستند؛ ابتدا
implementation و شواهد revision مرتبط را بخوانید. [معیارهای پذیرش](acceptance.md)
و [کارهای باقی‌مانده](../TASKS.md) تعریف موفقیت را مشخص می‌کنند.
