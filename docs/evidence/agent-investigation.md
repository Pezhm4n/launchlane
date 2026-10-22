# تحقیق انتخابی Agent درباره خطای صفحه

تاریخ: ۲۰۲۶-۱۰-۲۲. برش پس از ab2fa8b؛ A09/AC25. وضعیت: خواندن‌های انتخابی پیاده و با قراردادها و مدل واقعی سنجیده شدند؛ آزمون تازه provider واقعی این برش هنوز در ادامه لازم است. [ADR 0007](../decisions/0007-sre-read-evidence.md) چرایی و مرزها را ثبت می‌کند.

## رفتار پیاده‌شده

مدل می‌تواند read_workload را برای path همان app انتخاب‌شده و read_metrics را برای فرضیه مرتبط با منابع انتخاب کند. مدل host نمی‌دهد؛ origin از تنظیم مجاز همان actor/team/app می‌آید. همان WorkloadProbe، DNS عمومی و IP pin‌شده، TLS، منع redirect، timeout پنج‌ثانیه‌ای، سقف64KiB و redaction را نگه می‌دارد. preview مدل حداکثر۴۰۹۶ نویسه است و حذف محتوا مشخص می‌شود. یک نمونه زمان پاسخ، p95 یا ظرفیت نیست و تأیید artifact ایجاد نمی‌کند.

هویت داخلی app پیش/پس از داده و context پس از خواندن کنترل می‌شوند. read_logs با lookbackMinutes یک تا۶۰، پیام خارج از بازه، پاسخ خالی و حذف برای حجم را جدا گزارش می‌کند. بازه از پیش از شروع goal تا زمان دریافت خواندن است؛ شامل query یا host دلخواه نیست. rawPoints منابع با واحد/زمان unverified حفظ و برای مدل محدود می‌شوند؛ omittedPoints داده ناموجود را صفر یا سالم نمی‌کند. سقف24KiB نتیجه ابزار نیز حفظ شده است.

سه خواندن SRE، ورودی نامعتبر را در application پیش از provider رد و خطا را به همان call ID برمی‌گردانند. مدل می‌تواند در همان بودجه آرگومانش را اصلاح کند. JSON ناقص، ابزار ناشناخته و قراردادهای strict تاریخی همچنان اجرا را متوقف می‌کنند؛ تکرار نامعتبر بودجه را نامحدود نمی‌کند. فیلد داخلی سیاست validation به provider ارسال نمی‌شود. این تغییر approval یا write ایجاد نمی‌کند.

## regressionها

هفت آزمون جدید، path/host نامجاز و gate بسته با صفر provider/probe، تغییر ID پیش/پس از خواندن، انتخاب همزمان، DNS خصوصی، redaction، response preview، missing/empty/واحد نامعلوم، پاسخ upstream بزرگ، محدودیت context، 429 بدون retry، لاگ قدیمی/آینده/خالی/حجیم، اصلاح آرگومان، JSON ناقص و مصرف سقف با ورودی تکراری را می‌سنجند. domain کامل234/234، lint محدوده backend، typecheck، build و HTTP21/21 گذشتند. lint/build/HTTP روی export مستقل با UI ثابتِ پیش از4cee36d بودند؛ CSS و componentهای همکار در main در حال تغییرند و در این برش commit نمی‌شوند.

## ارزیابی با مدل واقعی و provider مصنوعی

دو ورودی با goal یکسان و پاسخ متفاوت صفحه اجرا شدند. فقط BoxAPI واقعی بود؛ Liara، DNS و HTTPS در این ارزیابی transport قراردادی مصنوعی داشتند و هیچ حساب ابری تغییر نکرد. نتیجه معتبر دوم،۱۹ فراخوانی مدل و53,128 token گزارش‌شده داشت:

| پاسخ فعلی | خواندن‌های انتخاب‌شده | نتیجه معنایی |
| --- | --- | --- |
| HTTP200 با لاگ اخیر500 | inspect، destination، workload، releases، status، logs، source و metrics | خطا در نمونه فعلی بازتولید نشد؛ گزارش اخیر علت را ثابت نمی‌کند و منابع unknown هستند |
| HTTP500 با release READY | inspect، destination، workload، releases، logs، metrics و سه source read | خطا اکنون مشاهده شد؛ اختلاف quantity در source/test فرضیه محتمل است و رابطه قطعی با500 تأیید نشده؛ داده منابع نامعلوم است |

مدل در هر دو مورد partially_completed/no_remote_changes برگشت، سؤال نامرتبط درباره مقصد و پیشنهاد write نداشت. متن، READY را سلامت صفحه و metric خالی را صفر/OOM تلقی نکرد. این دو case ارزیابی عمومی کیفیت مدل یا شاهد endpointهای Liara نیستند.

آزمون قبلی حفظ شد: case200 خلاصه محتاطانه داشت؛ case500 پس از probe، فیلد خارج قرارداد فرستاد و INVALID_INPUT گرفت. هیچ درخواست نامعتبر به provider نرسید و آن failure به success تغییر نام نداد. سیاست application validation و regressionهای bounded correction برای رفع همین مرز اضافه شدند. JSON ناقص و scope/identity نامعتبر همچنان fail closed باقی‌اند.

## مرز باز

درb525c18، ساخت تا preflight و POST واحد پیش رفت ولی اتصال POST پس از10.655s نامعلوم شد؛ journal همان uncertain/request_started را حفظ و replay را بست. سه GET بعدیِ سازگار با Pool،404های7.014/0.500/1.067s دادند؛ نبودن فعلی app، receipt ازدست‌رفته را بازسازی نمی‌کند. [ADR 0009](../decisions/0009-liara-transport-pool.md) اندازه‌گیری TLS، Pool محدود فقط برای API و pin سازگار7.30.1 را ثبت می‌کند. ناسازگاری dispatcher8 با native fetch در تست واقعی محلی شکست خورد و به regression تبدیل شد. سه تست تازه، multipart/cancellation و POST بدون replay را روی HTTP واقعی محلی می‌سنجند. ادامه SRE روی مقصد تازه با journal و allowance جدا و همان دفتر تجمعی انجام می‌شود؛ create قبلی تکرار نمی‌شود.

تلاش وب بعد از83d961d از اتصال گذشت، اما بررسی وجود مقصد با PROVIDER_TRANSPORT متوقف شد؛ ۸ model call و صفر write ثبت شد. تکرار تازه با همان دفتر مصرف به پیشنهاد و تصمیم ساخت رسید، اما GET شبکه در preflight پس از10.491s با cause واقعی UND_ERR_CONNECT_TIMEOUT شکست خورد؛ باز هم create/upload/release صفر بود. این دو failure به موفقیت تبدیل نشده‌اند. [ADR 0008](../decisions/0008-bounded-read-recovery.md) یک تلاش مجدد فقط برای همین خطای GET، با signal و بودجه مشترک را ثبت می‌کند. برای claim ساخت/restart و ادامه انتشار، allowance write دوباره کنترل می‌شود. هشت regression تازه و domain244/244، lint/typecheck/build و HTTP21/21 export ثابت گذشتند. lost-create با همین cause همچنان یک write و عدم replay دارد. شاهد تازه وب/PaaS پس از این اصلاح در ادامه لازم است.

پیش از آزمون تازه وب، دو تلاش اتصال با LIARA_TIMEOUT و صفر model/write شکست خوردند. خواندن حساب، تیم و برنامه‌ها پشت سر هم از یک deadline پانزده‌ثانیه‌ای استفاده می‌کردند. اندازه‌گیری همزمان واقعی هر سه پاسخ200 را در8.935s نشان داد؛ زمان‌های جدا8.824/8.692/7.728s بودند. این سه GET مستقل اکنون همزمان و با همان deadline اجرا می‌شوند؛ تمام پاسخ‌ها پیش از ذخیره اعتبارسنجی و siblingها در شکست لغو می‌شوند. دو regression شروع همزمان، حفظ خطای تیم و عدم جایگزینی حساب با پاسخ دیررس را می‌سنجند. اتصال واقعی application پس از اصلاح در9.292s با سه200 و صفر write گذشت. domain236/236 و lint/typecheck/build export ثابت گذشتند. این شاهد اتصال است؛ سناریوی تحقیق وب/PaaS هنوز جدا لازم است.

خلاصه SRE outcome اجرایی نیست؛ source محلی بدون receipt متناظر، محتوای release را اثبات نمی‌کند. نتیجه رفع مشکل به تست/انتشار و همان رفتار نیاز دارد. واحد منابع، source نامرتبط، pagination/پنجره‌های خارج از محدوده، تضمین عمومی تشخیص و پوشش سرویس‌های دیگر هنوز پذیرفته نشده‌اند. مدل/ابزار و provider واقعی باید جدا شاهد داشته باشند.
