# کارهای باز Launchlane

[هدف محصول](project-overview.md) · [پذیرش](docs/acceptance.md) · [پشتیبانی](docs/platform-support.md) · [شواهد](docs/verification.md)

این فایل backlog جاری است. گزارش‌های اجرا، تعداد تست و تاریخچهٔ هر برش در مرجع موضوعیِ [شواهد](docs/verification.md) قرار دارند. وضعیت «پیاده‌شده» با پذیرش کامل پروژه یا provider یکسان نیست.

## اولویت‌های اجرایی

1. **برنامهٔ کامل و داده:** runner اصلی، baseline منبع، ورودی‌های مصنوعی صریح و تست API واقعی؛ سپس قرارداد مستقل migration/دادهٔ مقصد و سازگاری rollback.
2. **Topology:** root و componentهای مستقل backend/API/worker/queue consumer/scheduler با نیاز منابع واقعی؛ پذیرش یک frontend جای بقیه را نمی‌گیرد.
3. **۱۴ خانواده:** گسترش نسخه/config/dependency و بستن مرزهای raw corpus از همان Agent/web/MCP، artifact و workload اصلی.
4. **حلقهٔ شکست:** failure واقعی → تحقیق grounded → repair محدود → آزمون مستقل → تصمیم publication → همان رفتار روی release تازه.
5. **تحویل:** ارزیابی خوانندهٔ تازه/screen reader، نصب تمیز، برابری web/MCP و تنظیمات میزبانی/هزینه.

## نقشهٔ مأموریت با شناسه‌های ثابت

شناسه‌های A00–A19 برای trace با acceptance و تصمیم‌ها حفظ شده‌اند. جدول، وضعیت تجمیعی است؛ برای نتیجهٔ دقیق، گزارش revision مربوط را بخوانید.

| شناسه | حوزه | وضعیت و نخستین مرز باز |
| --- | --- | --- |
| A00 | مشخصات | اسناد مرجع و سطح شواهد موجود؛ حفظ لینک‌ها و پرهیز از گزارش مرحله‌ای تکراری |
| A01 | بازیابی شکاف | inventory اولیه انجام شده؛ بازبینی source/coverage برای هر برش ادامه دارد |
| A02 | موتور | registry typed، run پایدار، budget، cancel/recovery موجود؛ پذیرش عمومی همهٔ goalها باز |
| A03 | رابط | انتشار مرحله‌ای، پروژه‌ها، صفحهٔ حساب‌ها و چت اختیاری موجود؛ ارزیابی کاربر تازه باز |
| A04 | تصمیم استقرار | catalog/quote و تصمیم هزینه‌دار موجود؛ پوشش واقعی حساب/نسخه/قیمت عمومی باز |
| A05 | مقصد و env | provision، binding خصوصی و journal موجود؛ پذیرش زندهٔ تمام ترکیب منابع باز |
| A06 | اتصال کدنویسی | worker و adapter محدود با patch/test/artifact موجود؛ تعمیم ابزار/مدل و isolation باز |
| A07 | آماده‌سازی | start/port و buildهای مشخص موجود؛ repair عمومی config/dependency/root باز |
| A08 | انتشار هدف‌محور | مسیرهای artifact/release/workload موجود؛ complete-project acceptance باز |
| A09 | تحقیق پویا | ابزارهای grounded و نمونه‌های محدود زنده موجود؛ تعمیم و تشخیص علیّ metrics باز |
| A10 | اصلاح کامل | چند چرخهٔ محدود repair/publication موجود؛ شکست‌های تازه و redeploy/data عمومی باز |
| A11 | runtime | مسیرهای محدود تمام خانواده‌های هدف؛ نسخه‌ها، پیکربندی‌ها و پذیرش تولیدی کامل باز |
| A12 | preview | artifact و app آزمایشی کنترل‌شده؛ انتقال عمومی preview به مقصد نهایی باز |
| A13 | برگشت | بازنشر artifact تاریخی موجود؛ سازگاری داده و recovery عمومی باز |
| A14 | منابع و دامنه | network/database/disk/env و راهنمای دامنه موجود؛ SQL/migration مقصد، DNS و persistence کامل باز |
| A15 | بهینه‌سازی | مشاهده و گزارش محدود؛ نسبت‌دادن عملکرد/هزینه و اصلاح قابل‌سنجش باز |
| A16 | MCP | facade مشترک، grants و bridge موجود؛ پذیرش مستقل همهٔ clientها و مأموریت‌ها باز |
| A17 | کیفیت تعامل | responsive/keyboard/error/cancel/reload آزموده؛ reader/screen-reader تازه باز |
| A18 | ارزیابی زنده | چرخه‌های محدود با مصرف ثبت‌شده؛ پوشش تازهٔ تمام source/runtime/dataها باز |
| A19 | candidate | baseline یکپارچهٔ ثبت‌شده؛ هر release به نصب و معیارهای همان revision نیاز دارد |

## معیار بستن یک کار

- قابلیت از مسیر اصلی UI → application → policy → provider → Store/journal قابل استفاده باشد.
- ورودی، source/artifact/release، oracle و configuration دقیق ثبت شوند.
- regression مثبت، منفی و failure اصلی با معیار دست‌نخورده بررسی شوند؛ worker واقعی و UI واقعی در مرز لازم اجرا شوند.
- synthetic، اجرای محلی و provider زنده جدا گزارش شوند؛ prerequisite ناموجود یا unknown، pass نیست.
- scope، approval، budget، credential و دادهٔ همکار حفظ شوند؛ هیچ write مبهمی blind retry نشود.
- evidence و تصمیم جدید در مرجع موضوعی موجود افزوده شوند؛ فایل مستقل فقط برای نیاز خوانندهٔ مستقل ساخته شود.

آخرین baseline ثبت‌شدهٔ یکپارچه `f361346`: domain893 و HTTP50 و نه مجموعهٔ مرورگر؛ [حدود دقیق](docs/verification.md). این اعداد جای آزمون HEAD بعدی یا پذیرش کامل محصول را نمی‌گیرند.
