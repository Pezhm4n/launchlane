# حذف پروژه، توقف/حذف مقصد و خطای فرم env — ۲۰۲۶-۱۰-۲۳

## Candidate و مرز شاهد

Candidate نهایی runtime: `candidate-35`، base `a838440791ce03a0b3b2271031785de2fffeb4b2`، tree `ef28adf03bea64e9ee7e462b08348b53925382f2`؛336 فایل runtime/test/config با digest `465aebf90be741b14562fe05848a4b9be0000129d354ba6989adef110de82eae` و صفر اختلاف. export از index خصوصیِ ثابت ساخته شد. تغییرات هم‌زمان و unstaged همکار در CSS و پنل‌ها وارد آن نشدند. افزودن این سند، TASKS و acceptance فقط مستندات را تغییر می‌دهد.

روی همین candidate35، build، typecheck و lint با صفر error،39 warning و12 info گذشتند.370/370 domain،39/39 HTTP،14 حالت مرورگر پروژه‌ها،12 حالت انتخاب پلن و54 حالت guided publication گذشتند. عرض‌های280/320/390/768/1280 در runner پروژه‌ها و320/360/390/768/1280 در guided پوشش داده شدند؛ axe/overflow و خطای صفحه طبق oracle runnerها بررسی شدند. تصویر فرم دستی320 و1280 و تأیید حذف320 نیز بازبینی بصری شدند. این subset مرتبط است؛ full aggregate همهٔ browser/sandbox/runtimeها در این revision اجرا نشده است. نتیجهٔ revisionهای مختلف به عنوان full pass واحد جمع نمی‌شود.

## Root cause فرم WELCOME_MESSAGE

خواندن مجاز و بدون write از `sample-welcome`، هویت مورد انتظار و فیلدهای env برابر `key,value,encrypted,_id` را نشان داد؛ مقدارها چاپ یا ذخیرهٔ عمومی نشدند. adapter این دادهٔ provider را به validator دقیق ورودی کاربر می‌داد و همان `INVALID_INPUT: ورودی دارای فیلد ناشناخته است` را به فرم برمی‌گرداند. خطا مربوط به متن واردشدهٔ کاربر نبود.

fixture قبلی فقط key/value داشت و این شکاف قرارداد را نمی‌دید. با افزودن metadata مشاهده‌شده،12 مورد از14 تست env در اجرای اولیه شکست خوردند. adapter اکنون key/value را در مرز provider استخراج می‌کند، نوع/تعداد/هویت را همچنان اعتبارسنجی می‌کند و encrypted=true را بدون شاهدِ قابل merge رد می‌کند. هر14 تست پس از اصلاح گذشتند. provider response خراب دیگر به صورت اشتباه به ورودی کاربر نسبت داده نمی‌شود. ادعای live env write از این read-only probe نتیجه نمی‌شود.

## رابط واقعی با provider مصنوعی

runner پروژه‌ها از مرورگر Chromium، پوشهٔ واقعی و API واقعی محصول استفاده می‌کند؛ hook شبکه هر میزبان بیرونیِ ثبت‌نشده را رد می‌کند. مقدار خصوصی پوشه از ورودی رمزگذاری‌شده به همان پیشنهاد/تأیید/merge/readback می‌رسد. مسیر دستی با metadata واقعی provider، دکمهٔ چشم، پنهان‌سازی دوباره و پاک‌شدن مقدار پس از submit بررسی می‌شود. screenshot مقدار واقعی کاربر ندارد.

حذف محلی با انصراف، Escape، focus روی انصراف، تأیید و refresh سنجیده می‌شود. مقصدِ دارای اثر ابری قبل از حذف از فهرست به توقف/حذف هدایت می‌شود. دو write مصنوعی stop/delete دقیقاً یک بار، بازخوانی و reload رسید و سپس حذف از فهرست بررسی می‌شوند. نوع receipt نمونه‌ها در این fixture `instances_absent` است؛ جای محدودیت زنده را نمی‌گیرد.

برای مراحل، یک activity و نتیجهٔ correlated به یک ردیف تبدیل می‌شوند. succeeded/failed از outcome میزبان یا JSON معتبر result همان call ID می‌آیند؛ متن آزاد تاریخچه، موفقیت محسوب نمی‌شود. تغییر پلن با نگه‌داشتن موقت درخواستِ واقعی در مرورگر تست می‌شود: پیام loading و disabled شدن انتخاب‌ها باید قبل از پاسخ دیده شوند. همان run در پنل دستیار و وب حفظ می‌شود؛ این delay، latency واقعی لیارا را اندازه‌گیری نمی‌کند.

## آزمون زندهٔ محدود؛ بدون مدل

برای آزمایش چرخهٔ عمر، یک سرویس کنترل‌شدهٔ کوچک Node22 بدون dependency ساخته شد؛ این پروژهٔ واقعیِ متنوع یا پذیرش یک runtime تازه نیست. source از API انتخاب/آماده‌سازی محصول وارد شد. oracle از ابتدا JSON با revision `lifecycle-v1` و status200 بود. اپ، کوچک‌ترین پلن منتخب این آزمون و شبکهٔ موجود، همگی به یک scope محدود شدند؛ hook مستقل هر نوع write را حداکثر یک بار مجاز می‌کرد.

| مورد | هویت / مشاهده |
| --- | --- |
| Candidate ایجاد و publication | candidate29، tree `5c2d6d579a61fd3184011dc22caa42a663f6fde6` |
| Candidate ادامهٔ همان receipt و حذف | candidate30، tree `a4b381cd14238bb56818d2c8991ee90c439e1aa5` |
| Source flow | `b56cf65e-6e6d-4b3f-8fa7-ef48ddec5c9a` |
| Source hash | `5e2fa67c163e1da55dbf111b2f9b8f8fd2d58d235dbb29c3eae791ab62d29f71` |
| Archive | `c0f10d7da40dd3dc6cf528880f16f127dfb80af8581ded2bab9f8aae29c87e15` |
| Destination action | `85f7776b-6a80-44ab-9edc-101561b9fcb7` |
| App | `launchlane-lifecycle-qa-102312` / `6adb58a572aa39a87aa76600` |
| Publication action / release | `bc347377-c911-4450-84f0-5f8a9965d8ed` / `6adb58a972aa39a87aa7688d` |
| Stop action | `f55cb9a1-f3e3-4db1-92f2-743f697b0330` |
| Delete action | `f9229a90-0cb8-406c-8a4a-4f4d4a11cc6d` |
| Native runtime / plan | Node22 / small-g2 + basic؛1041.66 تومان در ساعت، بدون مالیات/ترافیک/ذخیرهٔ اضافی |
| Existing network | `6adb127372aa39a87a921cc8`؛ شبکه‌ای ساخته یا حذف نشد |

Publication در اولین READY، پاسخ503 گرفت و به‌درستی failed/WORKLOAD_MISMATCH شد؛ این شکست حفظ شده است. بعداً همان سرویس از public origin پاسخ200 و JSON `status=healthy,revision=lifecycle-v1` داد. این خواندن مستقل، action شکست‌خورده را موفق نمی‌کند. فاصله با آماده‌شدن routing سازگار است؛ علت دقیق503 پایین‌دست اثبات نشده و سیاست bounded انتظار پس از READY هنوز شکاف A08 است.

Stop در12:57:46UTC یک POST انجام داد. همان ID با scale صفر خوانده شد؛ applets500 بود و candidate29 uncertain ماند. پس از اصلاح تفکیک receipt، candidate30 همان action را فقط با read ادامه داد و `verification=configuration` ثبت کرد. نبود نمونهٔ اجرایی زنده UNCONFIRMED است و UI آن را اعلام می‌کند. Delete در13:04:44UTC یک DELETE200 انجام داد؛ GET همان مقصد404 شد و در13:04:45UTC سابقهٔ source از library کنار رفت. URL قبلی لینک فعال نیست.

در مجموع یک create، یک upload، یک release، یک stop و یک delete واقعی ثبت شد؛ repair job در این سناریو وجود نداشت. مدل داخلی یا میزبان بیرونی اجرا نشد. تعرفه مشخص است؛ صورتحساب نهاییِ قابل انتساب به این برنامه، از اختلاف موجودی مشترک حساب نتیجه گرفته نمی‌شود و اندازه‌گیری نشده است. برنامه cleanup شده؛ شبکهٔ قبلی حفظ شده است.

خواندن مستقل با adapter خود candidate35 در13:21:18UTC نیز نبود همان app ID را تأیید کرد؛ write تازه‌ای انجام نشد. ledger جاری مدل78 درخواست/705123 توکن گزارش‌شده و سقف محافظه‌کارانه0.709037USD داشت. این سناریوی lifecycle صفر درخواست مدل داشت؛ مصرف هم‌زمان ledger به این تست نسبت داده نشده است. پس از دستور تازهٔ مالک، سقف قدیمی0.8 با سقف تجمعی2USD جایگزین شد؛ همهٔ rowها و baseline قبلی حفظ و تغییر اختیار جدا ثبت شد. باقی‌مانده در همان مشاهده1.290963USD است، نه بودجهٔ تکرارشونده برای subprocess/retry. مصرف اشتراک میزبان بیرونی و صورتحساب دقیق لیارا همچنان از این اعداد نتیجه نمی‌شود.

## شکست‌های محلیِ حفظ‌شده

- Candidate29 domain:366/367؛ یک آماده‌سازی source در fixture قدیمی با deadline سه‌ثانیه‌ای cancelled شد. rerun همان provision suite به تنهایی9/9 گذشت. علت timeout همچنان UNCONFIRMED است؛ concurrency1 علت را ثابت نمی‌کند.
- Candidate30:368/368 domain؛ HTTP38/39. تست تازه نشان داد operation ناشناخته قبل از lookup رد نمی‌شد و404 می‌داد. route اصلاح شد؛ oracle همان400/INVALID_OPERATION باقی ماند.
- Candidate32:369/369 domain. Candidate34 علاوه بر اصلاح route، همبستگی receiptهای قدیمی، scope حذف پروژهٔ غیرفعال و پذیرش پاسخ مستند204 حذف را دارد. نتایج نهایی جدا ثبت می‌شوند.
- Candidate34:370/370 domain و39/39 HTTP؛ مرورگر در Escape خطای واقعی bubbling پنجرهٔ حذف به library را یافت. parent هم بسته می‌شد؛ stopPropagation روی cancel پنجرهٔ فرزند اضافه شد. آزمون plan پس از response و قبل از commit شدن state به DOM، checked را زود می‌خواند؛ انتظارِ همان radio بررسی‌شده اضافه شد و assert اصلی حفظ شد. این‌ها full browser pass قبلی محسوب نمی‌شوند.

پوشش همهٔ خانواده‌ها، DB، connectorهای اجرایی Claude/OpenCode و پذیرش کامل مأموریت همچنان از این برش نتیجه نمی‌شود. [ADR0023](../decisions/0023-project-removal-and-stop-receipts.md) قرارداد و محدودیت‌ها را شرح می‌دهد.

## تحویل به نصب اصلی

Commit `9bb87c1` از نظر runtime با candidate35 یکسان است؛ فقط شش سند پذیرش/شاهد/طراحی به tree آزموده‌شده اضافه شده‌اند. در13:28:42UTC سرور اصلی `http://127.0.0.1:3000` روی همین candidate بررسی شد. پیش از راه‌اندازی، backup سازگار SQLite گرفته شد و queued/working run یا action در executing وجود نداشت. PID قدیمی دیگر وجود نداشت و پورت آزاد بود؛ مالک اجرای دوم روی دیتابیس شروع نشد.

state/workspace اصلی، secret نشست و اتصال‌ها حفظ شدند. schema17 و17 رکورد پروژه باقی ماندند؛ ciphertext همهٔ اتصال‌ها با backup یکسان بود. Chromium واقعی روی نصب اصلی، فهرست17 پروژه در390/1280، بازکردن تأیید حذف و Escape بدون بستن library، focus برگشتی و صفر page error را بررسی کرد. حذف یا انتشار واقعی در این بررسی انجام نشد؛ action/run تازه صفر بودند و نشست آزمایشی جداگانه لغو شد. فایل‌های ثبت‌نشدهٔ همکار وارد کامیت/نسخهٔ frozen نشدند. این handover پذیرش پروژهٔ واقعی تازه یا live env write محسوب نمی‌شود.
