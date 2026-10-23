# ADR0025 — انتشار بومی فایل‌های Static

تاریخ: ۲۰۲۶-۱۰-۲۳. وضعیت: implemented؛ [شاهد بومی Login](../evidence/native-static-login.md) با مرز API-create و Agent-publication تأیید شد؛ repair عمومی و Agent-create زنده بازند.

## مسئله و مسیر

پروژهٔ واقعی `I:\Computer\dev\Web\Login`، HTML/CSS/JavaScript مرورگر است؛ package/start یا runtime Node ندارد. پیشنهاد مقصد قبلی با PROJECT_INCOMPLETE رد شد و مدل با سؤال Static یا Node و port، allowance را مصرف کرد. محدودیت مقصد Node/Python باید در implementation برطرف شود، نه به کاربر عادی منتقل شود.

پلتفرم بومی Static لیارا، با پورت80 و Nginx مدیریت‌شده، مسیر انتخابی است. [مستند رسمی](https://docs.liara.ir/paas/static/getting-started/) و [port CLI](https://github.com/liara-cloud/cli/blob/master/src/utils/get-port.ts)، به‌همراه [deploy CLI](https://github.com/liara-cloud/cli/blob/master/src/commands/deploy.ts) در تاریخ تصمیم بررسی شدند. release از `type=static` و `platformConfig={}` استفاده می‌کند؛ نسخهٔ زبان اختراع نمی‌شود. wrapper Node یا Docker worker، شاهد انتشار بومی Static نیست و این تصمیم از آن‌ها استفاده نمی‌کند.

در inspect بدون اجرای script، وجود سند HTML معتبر در index.html، نبود manifest/فایل سرورِ متعارض و وجود assetهای محلی بررسی می‌شود. JS با dependency سروری/bare import شناخته‌شده برای انتشار خام رد می‌شود؛ این بررسی parser کامل مرورگر یا اثبات موفقیت همهٔ generatorها نیست. منبع دارای package/build باید مسیر build خودش را طی کند. مسیر زیرپوشه از انتخاب منبع موجود می‌آید. فایل‌های IDE کنار credential/cache کنار گذاشته می‌شوند. capture و archive همان فایل‌های اصلی است و هیچ فایل اجرایی ساخته یا اصل پوشه تغییر داده نمی‌شود.

## قرارداد و اختیار

ActionSpec v15، انتشار Static را به actor، account/team/app ID، source/selection/artifact، port80، WorkloadContract و پلن متصل می‌کند. v16، ساخت مقصد Static را با همان catalog/cost/network و previous destination قراردادهای پیشین عرضه می‌کند. پارس و decode تاریخی v1–v14 و hashهایشان حفظ می‌شوند. journal، claim، idempotency، readback و جلوگیری از retry نتیجهٔ نامعلوم همان سرویس‌ها هستند؛ schema JSON فعلی migration تازه لازم ندارد.

فایل‌های plain Static فرمان نصب/build/start کاربر ندارند؛ نبود این فرمان‌ها به سؤال فنی یا job ساخت Node تبدیل نمی‌شود. در مأموریت Static ابزارهای ساخت/اصلاح Node نمایش داده نمی‌شوند. پیش از انتشار، همان artifact و معیار پاسخ یک تصمیم صریح دارند؛ مجوز build یا اصلاح Node به Static منتقل نمی‌شود. این برش، دامنهٔ برنامهٔ artifact مشتق یا repair عمومی Static را کامل اعلام نمی‌کند. هزینهٔ ساخت مقصد همچنان تصمیم جدا و واقعی دارد.

موفقیت به current release و پاسخ همان صفحه وابسته است. HTML200 کافی نیست: برای پروژهٔ واقعی باید CSS/JS، رفتار DOM، console و موبایل هم بررسی شوند. CDN بیرونی، API ورود واقعی یا ثبت‌نام از فرم ظاهری استنتاج نمی‌شود. وضعیت Nginx/نسخهٔ مدیریت‌شدهٔ provider از مقدار ساختگی پر نمی‌شود.

## حلقهٔ خطا و سابقه

علت شکست و قدم بعدی از error ساخت‌یافتهٔ correlated در AgentView عرضه می‌شوند؛ message آزاد اثبات شکست/موفقیت نیست و تاریخچه برای backfill بازنویسی نمی‌شود. runtime ساختِ واقعاً ناموجود و اقدام بدون پیشرفت، پیش از سؤال/تکرار تازه متوقف می‌شوند؛ کلید تکرار از canonical arguments ساخته می‌شود. این توقف مانع خرج بی‌اثر است و جای پیاده‌سازی نسخه‌های دیگر نیست. رفع Node24 و خانواده‌های دیگر در همان ماتریس الزامی باز می‌مانند.

پوشهٔ مفقود مانع بازکردن سابقه برای مدیریت ID-bound مقصد نمی‌شود. record به unavailable می‌رود و approvalهای وابسته نامعتبر می‌شوند؛ انتشار همچنان به inspect/source معتبر نیاز دارد. حذف از فهرست، وجود یا نتیجهٔ نامعلوم منبع ابری را پنهان نمی‌کند؛ مسیر توقف/حذف قبلی حفظ می‌شود.
