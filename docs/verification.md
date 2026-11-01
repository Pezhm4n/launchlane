# شواهد اعتبارسنجی Launchlane

## آماده‌بودن دیالوگ پس از تغییر عرض؛ ۲۰۲۶-۱۱-۰۱

[اجرای19a4388](https://github.com/Pezhm4n/launchlane/actions/runs/41319062935) در assertion
حالت چت پس از resize شکست خورد. probe آماده‌بودن mode و viewport را انتظار می‌کشد؛
assertion و timeout ثابت‌اند. r7 روی app/build همان r5، lint دو فایل، سه chat13 و
responsive47 را گذراند؛ اعضای۱۴runner ثابت‌اند و دو probe مرتبط ابتدا اجرا می‌شوند.

## همگامی فوکوس در CI؛ ۲۰۲۶-۱۱-۰۱

[اجرای05eea02](https://github.com/Pezhm4n/launchlane/actions/runs/41317995225) در آخرین
runner روی assertion فوریِ focus شکست خورد؛ مراحل قبلی موفق بودند. تست به وضعیت
واقعی بازگشت focus همگام شد؛ app و timeout و assertion ثابت‌اند. lint فایل و سه
responsive47 محلی با app/build همان r5 گذشتند؛ [تفکیک شواهد](evidence/responsive-ui.md#linux-synchronization-follow-up).

## پیگیری تم مشترک؛ ۲۰۲۶-۱۱-۰۱

[توکن‌های رابط](evidence/responsive-ui.md#shared-theme-follow-up): r5 روی runtime
259fe85 با پنج تعریف CSS و guard ارجاع‌ها/سطح محاسبه‌شده/hover واقعی، typecheck/build،
lint صفرerror/48warning/22info و responsive47/plans14/chat13/guided57/login10 را
گذرانده است. ماتریس کامل r4 زیر به این revision تعمیم داده نمی‌شود. هزینهٔ مدل و
عملیات واقعی provider صفر؛ نتیجهٔ Linux به workflow همان HEAD متصل خواهد شد.

## پایداری رابط و responsive؛ ۲۰۲۶-۱۱-۰۱

[شاهد این برش](evidence/responsive-ui.md): candidate مستقل r4 بر پایهٔ15f2912،
Windows/Node24.18.0 با lock موجود؛ domain820/820، HTTP49/49، هر۲۷مجموعهٔ مرورگر،
typecheck/build و lint صفرerror/48warning/22info گذشتند. responsive47، guided57،
ورود۱۰، mobile10 و chat13 دامنه‌های جدا هستند. شکست‌های baseline/r1/r2/r3 با pass
نهایی مخلوط نشده‌اند. مدل/provider مصنوعی‌اند؛ هزینهٔ مدل و عملیات واقعی لیارا صفر.
پیگیری توکن‌های مشترک و شاهد Linux نسخهٔ جدید جدا ثبت می‌شوند.

این صفحه ورودی کوتاه شواهد است؛ نتیجهٔ هر آزمون فقط برای revision، ورودی و تنظیمات
همان گزارش معتبر است. **قرارداد مصنوعی، اجرای محلی واقعی و اجرای واقعی provider
سه سطح متفاوت‌اند.** جمع‌کردن تعداد تست‌های چند نسخه، full pass تازه ایجاد نمی‌کند.

## آماده‌سازی مستندات مخزن؛ ۲۰۲۶-۱۰-۳۰

پیگیری کنترل عامل: [Actions پایهٔ624c401](https://github.com/Pezhm4n/launchlane/actions/runs/41012078637)
باز هم در consent ساخت عرض320 شکست خورد؛ سایر مراحل پیشین موفق بودند. کنترل بومی
بدون محدودیت عرض در تست مستقل متن200٪، عرض515px در parent258px گرفت. پس از محدودکردن
عرض و ارث‌بری فونت، snapshot `mobile-agent-r2` روی Windows/Node24.18.0 با build،
typecheck، lint صفرerror/48warning/22info، guided55 در پنج عرض با axe و HTTP49/49
گذشت؛ تصویر320 با متن بزرگ بررسی شد. oracleهای قبلی حفظ‌اند و failure فقط tag/id/class
و مختصات حداکثر12عنصر را ثبت می‌کند، نه متن/مقدار. build محلیِ قطع‌شده نتیجه محسوب نشد؛
اجرای نهایی مستقل است. آماده‌سازی Docker/Linux پیش از app test به403 منطقه‌ای دانلود
مرورگر رسید و شاهد محصول نیست. نتیجهٔ Linux از Actions همان commit خوانده می‌شود.

پیگیری responsive: [اجرای Linux پایهٔ b2c17fa](https://github.com/Pezhm4n/launchlane/actions/runs/41010431767)
domain820/820، build و HTTP49/49 را گذراند ولی در کارت تأیید ساختِ دارای env دچار
overflow شد. نام محیطی بلند، همین نقص ذاتیِ اندازهٔ grid/متن بدون شکست را روی Windows
بازتولید کرد. پس از اصلاح CSS و تقویت fixture با حفظ نام‌های کوتاه قبلی، snapshot
`mobile-env-r1` بر پایهٔ b2c17fa، build/typecheck/lint بدون error، guided54 با axe و
overflow در320/360/390/768/1280 و HTTP49/49 را گذراند. تصاویر واقعی320 مرور تنظیمات
و رضایت ساخت بررسی شدند؛ مدل/provider مصنوعی‌اند. این نتیجهٔ محلی جای نتیجهٔ اجرای
Actions همان commit را نمی‌گیرد؛ منطق approval، داده و ابزارها تغییر نکرد.

پیگیری CI پایهٔ `37cd6af`: اجرای GitHub نشان داد suite HTTP به Chromium نیاز دارد،
اما workflow نصب آن را پس از همان suite قرار داده بود. نصب به پس از `npm ci` منتقل
شد. روی Windows/Node24.18.0، build ایزولهٔ موجود با۵۵۱فایل اجرایی/test/config و
dependencyهای دقیق candidate تطبیق داده شد؛ نصب مرورگر و سپس HTTP49/49 در33.619s
و guided54 در320/360/390/768/1280 گذشتند. مدل/provider مصنوعی، مرورگر/سرور واقعی و
cloud write صفر بودند. lint صفرerror/48warning/22info، YAML و تقدم نصب بر دو suite
و checker دو README گذشتند. نتیجهٔ Ubuntu از workflow همان commit بررسی می‌شود؛
pass محلی به نتیجهٔ Linux تعمیم داده نمی‌شود. هیچ تستی skip یا ضعیف نشد.

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
