# تحقیق انتخابی Agent درباره خطای صفحه

تاریخ: ۲۰۲۶-۱۰-۲۲. برش پس از ab2fa8b تا14336e1؛ A09/AC25. وضعیت: خواندن‌های انتخابی با قراردادها، مدل واقعی و یک چرخه کنترل‌شده وب/PaaS برای دو پاسخ200/500 سنجیده شدند؛ تعمیم کیفیت و سناریوهای دیگر باز است. [ADR 0007](../decisions/0007-sre-read-evidence.md) چرایی و مرزها را ثبت می‌کند.

## رفتار پیاده‌شده

مدل می‌تواند read_workload را برای path همان app انتخاب‌شده و read_metrics را برای فرضیه مرتبط با منابع انتخاب کند. مدل host نمی‌دهد؛ origin از تنظیم مجاز همان actor/team/app می‌آید. همان WorkloadProbe، DNS عمومی و IP pin‌شده، TLS، منع redirect، مهلت شبکه۱۵ثانیه‌ای با تقدم deadline کوتاه‌تر run، سقف64KiB و redaction را نگه می‌دارد. preview مدل حداکثر۴۰۹۶ نویسه است و حذف محتوا مشخص می‌شود. یک نمونه زمان پاسخ، p95 یا ظرفیت نیست و تأیید artifact ایجاد نمی‌کند.

هویت داخلی app پیش/پس از داده و context پس از خواندن کنترل می‌شوند. read_logs با lookbackMinutes یک تا۶۰، پیام خارج از بازه، پاسخ خالی و حذف برای حجم را جدا گزارش می‌کند. بازه از پیش از شروع goal تا زمان دریافت خواندن است؛ شامل query یا host دلخواه نیست. rawPoints منابع با واحد/زمان unverified حفظ و برای مدل محدود می‌شوند؛ omittedPoints داده ناموجود را صفر یا سالم نمی‌کند. سقف24KiB نتیجه ابزار نیز حفظ شده است.

خواندن‌های workload، logs، metrics و releases، ورودی نامعتبر را در application پیش از provider رد و خطا را به همان call ID برمی‌گردانند. مدل می‌تواند در همان بودجه آرگومانش را اصلاح کند. JSON ناقص، ابزار ناشناخته و سایر قراردادهای strict تاریخی همچنان اجرا را متوقف می‌کنند؛ تکرار نامعتبر بودجه را نامحدود نمی‌کند. فیلد داخلی سیاست validation به provider ارسال نمی‌شود. این تغییر approval یا write ایجاد نمی‌کند.

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

## چرخه واقعی وب و PaaS در14336e1

در2026-10-22 از14:43 تا14:46 UTC، اتصال حساب از API محلی احرازهویت‌شده و انتخاب پروژه/تصمیم‌ها از مرورگر انجام شد. backend، قراردادها، انواع، dependencyها و تست تغییرکرده در export با79 فایلِ byte-identical نسبت به commit14336e1 تطبیق داده شدند. UI آن export ثابتِ پیش از4cee36d بود؛ این چرخه، پذیرش طراحی هم‌زمان main نیست. شبکه از واسط مستقیمِ خصوصی با VPN روشن استفاده کرد.

یک مقصد با ActionSpec v8، نام مشخص آزمون، small-g2/basic و شبکه موجود ساخته و ID/config آن خوانده شد. تصمیم جداگانه v7 دقیقاً همان archive/Node22 را منتشر کرد. میزبان نتیجه WORKLOAD_VERIFIED و همان HTTP200/متن orders service ready را ثبت کرد و GET عمومی مستقل نیز همان پاسخ را تأیید کرد. هر یک از create/upload/release فقط یک بار ارسال شدند؛ env و شبکه تازه ایجاد نشدند و source script در inspect اجرا نشد.

دو goal تازه صریحاً فقط تحقیق خواستند. مدل ابزار بعدی را انتخاب کرد؛ runner فهرست ثابت ابزارها را اجرا نکرد:

| درخواست | پاسخ واقعی و ترتیب انتخاب مدل | نتیجه و محدودیت |
| --- | --- | --- |
| خطای فعلی /orders | workload500، releases نامعتبر→اصلاح‌شده، logs، metrics؛ ۶ درخواست مدل | پاسخ ORDER_TOTAL_MISMATCH با actual36/expected73؛ لاگ تازه سازگار، READY ناکافی و CPU/RAM با واحد/زمان نامعلوم. علت کد بدون بررسی source قطعی اعلام نشد. |
| گزارش خطا برای / | workload200، logs، metrics نامعتبر→اصلاح‌شده؛ ۵ درخواست مدل | پاسخ orders service ready در همان مشاهده؛ لاگ500 مسیر سفارش‌ها به خرابی فعلی ریشه تعمیم نیافت؛ منابع unknown و یک نمونه پاسخ، ظرفیت/سلامت کلی تلقی نشد. |

هر دو partially_completed/no_remote_changes، question=null و بدون repair/destination/publication تازه پایان یافتند. تمام خواندن‌ها به همان ID محدود بودند. probeها62ms و82ms ثبت کردند؛ DNS در این نمونه زمان پاسخ لحاظ نشده است و این اعداد benchmark یا SLA نیستند. ورودی نامعتبر پیش از API رد شد و نتیجه هم‌بسته به مدل رسید؛ همان run توانست اصلاح کند. reload پس از انتشار و هر دو تحقیق، صفر model/write تازه داشت. مجموع چرخه۱۹ درخواست واقعی مدل و64,732 token گزارش‌شده بود؛ دفتر تجمعی همه تلاش‌های قبلی حفظ شد و سقف پولی reset نشد.

در پایان، ID مقصد دوباره تطبیق داده شد؛ یک DELETE و GET404، cleanup را تأیید کردند. سرور export بسته شد؛ primary3000 با مسیر مستقیم و gateهای مجاز فعال ماند. مقصد قدیمی با receipt نامعلوم نیز در یک GET مستقیم تازه404 بود؛ receipt اولیه uncertain ماند و create آن بازاجرا یا app هم‌نام پذیرفته/حذف نشد.

پس از اصلاح read_releases، ارزیابی جدا با مدل واقعی و provider مصنوعی نیز دو case200/500 را در۱۹ درخواست و52,251 token گزارش‌شده گذراند. در هر دو، release read نامعتبر اصلاح شد؛ انتخاب ابزار و خلاصه متفاوت بودند. این۱۹ درخواست مستقل از۱۹ درخواست چرخه PaaS بالاست. domain249/249، lint/typecheck/build، HTTP21/21 و Agent browser20 حالت با transport مصنوعی/Node tests واقعی روی همان export گذشتند. bootstrap نصب اصلی2/2 و browser اصلی با۲ درخواست واقعی مدل، render/reload و صفر page error نیز گذشتند. پس از پایان سرورهای آزمون، npm ci --prefer-offline --no-audit --no-fund در export جدا موفق شد؛ undici نصب‌شده7.30.1 بود و domain249/249، lint/typecheck/build و HTTP21/21 روی نصب تمیز نیز گذشتند. cache مجاز npm استفاده شد؛ این نصب سیستم‌عامل تازه نیست. پذیرش UI نهایی همکار همچنان باز است.

## failureهای حفظ‌شده و حدود تعمیم

درbbd45cb، چرخه تازه ساخت/انتشار با ID/config، همان archive و تصمیم جدا، HTTP200/متن اصلی و cleanup با ID و404 گذشت. این بار read_workload برای /orders پاسخ واقعی500 و ORDER_TOTAL_MISMATCH با actual=36 و expected=73 را در2.855s ثبت کرد؛ goal در درخواست بعدی مدل با INVALID_INPUT متوقف شد. نام و آرگومان همان فراخوانی ردشده در receipt اولیه ثبت نشده‌اند؛ آن را حدس نمی‌زنیم. سه بازپخش فقط‌مدل از همان شاهد500، بدون اجرای ابزار Liara، هر سه read_releases با کلید خارج قرارداد (`}` یا `call`) تولید کردند و در validation انتقال متوقف شدند. این بازتولید، نقص بازیابی همان خواندن را مشخص می‌کند؛ هیچ ادعای موفقیت SRE از این تلاش نشده است.

read_releases اکنون مانند سه خواندن SRE، exactKeys و required را در application و پیش از API کنترل می‌کند و خطای هم‌بسته به مدل برمی‌گرداند. مقادیر اصلی آرگومان بازپخش ذخیره نشده‌اند؛ regression شکل دو کلید مشاهده‌شده را با مقدار مصنوعی می‌سنجد. تست پیش از اصلاح failed بود و پس از آن، رد بدون API، اصلاح ورودی، یک خواندن واقعیِ قراردادی با دو کنترل هویت و صفر write را تأیید کرد. domain249/249، lint/typecheck/build و HTTP21/21 روی export با UI ثابت گذشتند. خطای JSON، ابزار ناشناخته، قراردادهای strict دیگر و approvalهای write تغییر نکرده‌اند.

برای ادامه روی شبکه این نصب، با درخواست مالک یک واسط خصوصی loopback راه‌اندازی شد که فقط API/model و میزبان دقیق آزمون را می‌پذیرد. socket خروجی Windows با [IP_UNICAST_IF](https://learn.microsoft.com/en-us/windows/win32/winsock/ipproto-ip-socket-options) به کارت فیزیکی مقید و مقدار همان گزینه بازخوانی می‌شود؛ TLS و SNI و اعتبارسنجی گواهی در client اصلی می‌مانند. DNS و proxy/default route/VPN سراسری تغییر نکرده‌اند. مسیر عادی در نمونه اولیه source مربوط به TUN و مسیر مقید source کارت فیزیکی داشت؛ پاسخ API بدون credential در یک نمونه از1.859s به0.500s رسید. این benchmark عمومی یا اثبات علت همه timeoutهای قبلی نیست. native fetch و همان pinnedHttps محصول با پاسخ401 بدون credential و رد توکن واسط/host/IP داخلی/DNS نامعتبر آزموده شدند. این راهکار خصوصیِ نصب Windows است، نه تنظیم پیش‌فرض محصول یا قابلیت شبکه عمومی.

primary main/dev با gateهای مجاز و همین مسیر مستقیم، هدف تازه inspect_project را با دو درخواست واقعی مدل از مرورگر اجرا کرد؛ response render، همان run پس از reload، صفر درخواست مدل برای reload و صفر page error تأیید شدند. UI این نصب شامل کار هم‌زمان همکار است و در commit این برش قرار نمی‌گیرد. چرخه تازه14336e1 در بخش بالا، شاهد جدا پس از اصلاح است؛ failure قبلی موفق نام‌گذاری نشده است.

درea08a40، مقصد تازه با ID واقعی ساخته و همان archive با تصمیم جدا منتشر شد. outcome=verified/WORKLOAD_VERIFIED و200 صفحه اصلی و متن درست، همراه خواندن مستقل عمومی تأیید شدند. reload مدل/write تازه نساخت و پس از تطبیق ID، حذف وabsence404 گذشتند. اما goal تحقیق /orders با PROBE_TIMEOUT پنج‌ثانیه‌ای پاسخ نگرفت؛ model در۵ درخواست و14,518 token گزارش‌شده، workload/release/logs/metrics را انتخاب و وضعیت صفحه و منابع را unknown نگه داشت. READY را سلامت و نبود خطا در log را علت تلقی نکرد. oracleِ مورد انتظار500 پاس نشد و case200 دوم اجرا نشد؛ این تلاش پذیرش کامل SRE نیست.

با توجه به handshakeهای5–7s اندازه‌گیری‌شده، cap انتقال probe از5s به15s تغییر کرد؛ status/محتوای مورد انتظار، عدم retry/redirect، scope، pin، redaction و deadline کوتاه‌تر run تغییر نکردند. پاسخ6s با همان500 در regression ابتدا روی کد قبلی PROBE_TIMEOUT داد، سپس در بودجه12s همان500 را حفظ کرد. این تنظیم، SLA سرعت یا سالم‌بودن پاسخ500 نیست. domain248/248، lint/typecheck/build و HTTP21/21 export ثابت گذشتند. SRE واقعی پس از این تنظیم هنوز در ادامه لازم است.

درb525c18، ساخت تا preflight و POST واحد پیش رفت ولی اتصال POST پس از10.655s نامعلوم شد؛ journal همان uncertain/request_started را حفظ و replay را بست. سه GET بعدیِ سازگار با Pool،404های7.014/0.500/1.067s دادند؛ نبودن فعلی app، receipt ازدست‌رفته را بازسازی نمی‌کند. [ADR 0009](../decisions/0009-liara-transport-pool.md) اندازه‌گیری TLS، Pool محدود فقط برای API و pin سازگار7.30.1 را ثبت می‌کند. ناسازگاری dispatcher8 با native fetch در تست واقعی محلی شکست خورد و به regression تبدیل شد. سه تست تازه، multipart/cancellation و POST بدون replay را روی HTTP واقعی محلی می‌سنجند. ادامه SRE روی مقصد تازه با journal و allowance جدا و همان دفتر تجمعی انجام می‌شود؛ create قبلی تکرار نمی‌شود.

تلاش وب بعد از83d961d از اتصال گذشت، اما بررسی وجود مقصد با PROVIDER_TRANSPORT متوقف شد؛ ۸ model call و صفر write ثبت شد. تکرار تازه با همان دفتر مصرف به پیشنهاد و تصمیم ساخت رسید، اما GET شبکه در preflight پس از10.491s با cause واقعی UND_ERR_CONNECT_TIMEOUT شکست خورد؛ باز هم create/upload/release صفر بود. این دو failure به موفقیت تبدیل نشده‌اند. [ADR 0008](../decisions/0008-bounded-read-recovery.md) یک تلاش مجدد فقط برای همین خطای GET، با signal و بودجه مشترک را ثبت می‌کند. برای claim ساخت/restart و ادامه انتشار، allowance write دوباره کنترل می‌شود. هشت regression تازه و domain244/244، lint/typecheck/build و HTTP21/21 export ثابت گذشتند. lost-create با همین cause همچنان یک write و عدم replay دارد. شاهد تازه وب/PaaS پس از این اصلاح در ادامه لازم است.

پیش از آزمون تازه وب، دو تلاش اتصال با LIARA_TIMEOUT و صفر model/write شکست خوردند. خواندن حساب، تیم و برنامه‌ها پشت سر هم از یک deadline پانزده‌ثانیه‌ای استفاده می‌کردند. اندازه‌گیری همزمان واقعی هر سه پاسخ200 را در8.935s نشان داد؛ زمان‌های جدا8.824/8.692/7.728s بودند. این سه GET مستقل اکنون همزمان و با همان deadline اجرا می‌شوند؛ تمام پاسخ‌ها پیش از ذخیره اعتبارسنجی و siblingها در شکست لغو می‌شوند. دو regression شروع همزمان، حفظ خطای تیم و عدم جایگزینی حساب با پاسخ دیررس را می‌سنجند. اتصال واقعی application پس از اصلاح در9.292s با سه200 و صفر write گذشت. domain236/236 و lint/typecheck/build export ثابت گذشتند. این شاهد اتصال است؛ سناریوی تحقیق وب/PaaS هنوز جدا لازم است.

خلاصه SRE outcome اجرایی نیست؛ source محلی بدون receipt متناظر، محتوای release را اثبات نمی‌کند. نتیجه رفع مشکل به تست/انتشار و همان رفتار نیاز دارد. واحد منابع، source نامرتبط، pagination/پنجره‌های خارج از محدوده، تضمین عمومی تشخیص و پوشش سرویس‌های دیگر هنوز پذیرفته نشده‌اند. مدل/ابزار و provider واقعی باید جدا شاهد داشته باشند.
