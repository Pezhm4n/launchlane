# شواهد اعتبارسنجی

[فهرست مستندات](README.md) · [پشتیبانی خانواده‌ها](platform-support.md) · [پذیرش](acceptance.md)

## سطح شواهد

| سطح | چه چیزی سنجیده شده است؟ | چه چیزی نتیجه نمی‌شود؟ |
| --- | --- | --- |
| بررسی source | قرارداد، caller، config و محدودیت کد | اجرای فرمان یا صحت provider |
| transport مصنوعی | policy، scope، approval، journal و failure مشخص | کیفیت مدل یا عملیات ابری واقعی |
| اجرای محلی واقعی | ابزار، worker، SQL یا Chromium در محیط مستقل | سازگاری مقصد و persistence تولیدی |
| provider زنده | همان حساب/app/release/workload ثبت‌شده | تعمیم به پروژه‌ها، نسخه‌ها یا خانواده‌های دیگر |

هر نتیجه فقط برای revision، artifact، تنظیمات و oracle همان گزارش معتبر است. گزارش تاریخیِ «در حال اجرا» وضعیت امروز یک سرور را تضمین نمی‌کند. یک test غیرفعال، prerequisite ناموجود یا نتیجهٔ نامعلوم pass نیست.

تابع migration اصلی، ۲۰۲۶-۱۱-۰۴: candidate نهایی `database-module-r4` بر پایهٔ51f99e3، domain905/905، HTTP50/50، type/lint/build، فراخوانی export اصلی گلستان/tsconfig/۱۲SQL و مسیر واقعی وب→تصمیم→worker→SQL/API در۱۵layout را گذراند. رگرسیون‌های Docker مکمل r3 در [گزارش دقیق](evidence/database.md#source-module-runners) جدا ثبت‌اند؛ نتیجهٔ آن‌ها به r4 تعمیم داده نمی‌شود. بررسی نهایی۴۰سند و سه regression مستندات نیز مستقل گذشتند. مدل/provider مصنوعی‌اند و هیچ write روی دیتابیس اصلی یا لیارا انجام نشد.

داده و ورودی امضای برنامه، ۲۰۲۶-۱۱-۰۴: candidate r3 بر پایهٔ1af6a15 با manifest دقیق، domain899/899، HTTP50/50، typecheck/lint/build، مرورگر review15/guided57 و actual PostgreSQL/signing3/3 را گذراند. مسیر وب→پنج کانتینر و رگرسیون runner اصلی گلستان/۱۲SQL/artifact نیز روی همان source پاس شدند. ادغام مستندات807a32c و docs-check/سه تست آن مستقل‌اند؛ نتیجهٔ ترکیبی902 ادعا نمی‌شود. [فرمان‌ها، scope و failureهای نگه‌داشته‌شده](evidence/database.md#disposable-application-inputs). هیچ مصرف واقعی مدل، write ابری، migration تولیدی یا پذیرش کامل API اصلی انجام نشد.

## baseline یکپارچهٔ ثبت‌شده

این اعداد، شاهد تاریخی source `f361346` در ۲۰۲۶-۱۱-۰۴ با Node24.18.0 هستند؛ نتیجهٔ خودکار HEAD آینده یا CI نیستند:

- `npm ci`، lint بدون error، typecheck و build واقعی پوشهٔ اصلی گذشتند.
- domain893/893 و HTTP50/50، بدون failure/skip، گذشتند.
- Chromium واقعی: حساب‌ها13، responsive47، کتابخانه19، ورود10/دو actor، lifecycle3، MCP24، پلن14، guided57 و baseline intake/reject15.
- baseline تصمیم ردشده را با replay409 حفظ کرد و worker/SQL اجرا نکرد. transport مدل/provider مصنوعی بود.
- build `m5FSXET2TnE0UVFFqk-un` با تطبیق بایت 9 فایل JS/CSS محلی بررسی شد؛ این انتشار تازه روی لیارا نبود.

[شرح ادغام و failureهای حفظ‌شده](evidence/operations.md#worktree-integration) و [رابط حساب‌ها](evidence/interface.md#accounts-page) جزئیات این snapshot را دارند.

## تصاویر README و اولین اجرا

تصاویر تازه از برنامهٔ واقعی و source `1af6a15` در نشست operator موقت ثبت شده‌اند؛ source اجرایی با baseline بالا یکسان است. `setup:local` در پوشهٔ مستقل اجرا و تولید دو کلید متفاوت بدون چاپ token بررسی شد. انتخاب نمونه، بررسی source و صفحهٔ حساب‌ها واقعی‌اند؛ metadata اتصال GitHub مصنوعی است و model/provider write صفر است. [منبع تصاویر و فرمان بازتولید](assets/readme/README.md).

بازآرایی مستندات در همین مبنا، ۱۵۲ فایل Markdown را به ۴۰ فایل رساند؛ متن ۱۲۴ گزارش/تصمیم با revision، failure و شناسهٔ ثابت در مراجع موضوعی حفظ شد. بررسی مستقل حفظ محتوا گذشت. `docs:check` روی ۴۰ سند صفر خطا، سه regression مثبت/منفی آن موفق، و checker اسکیل README روی هر دو زبان صفر خطا/هشدار داشت. build و capture واقعی مستقل نیز موفق بودند؛ این بررسی‌های مستندات پذیرش تازهٔ provider نیستند.

## گزارش‌های موضوعی

| گزارش | محتوا |
| --- | --- |
| [Runtime](evidence/runtime.md) | npm/pnpm، frontend، Python/framework، PHP، Go، .NET/Docker؛ artifact و failure |
| [داده](evidence/database.md) | منابع و binding، SQL/runner، baseline، مشاهدهٔ داده و persistence محدود |
| [Agent و اصلاح](evidence/agent.md) | انتخاب ابزار، budget، مأموریت، coding adapter و repair |
| [رابط](evidence/interface.md) | ناوبری، حساب‌ها، پروژه‌ها، env، قیمت، دسترس‌پذیری و lifecycle |
| [دسترسی و MCP](evidence/access.md) | هویت، grants، bridge و میزبانی |
| [انتشار و عملیات](evidence/operations.md) | مقصد، release، workload، restart، rollback و failure provider |
| [Corpus](evidence/corpus.md) | پروژه‌های چندبخشی و مرزهای مشاهده‌شده |
| [مراجع](evidence/references.md) | provenance و بهبودهای منتخب از مراجع |

شناسهٔ ADR، commit، ورودی، فرمان، oracle، failure و محدودیت هر آزمایش در همان بخش حفظ شده است. [آرشیو قدیمی](archive/verification-20261029.md) جزئیات قبل از این baseline را نگه می‌دارد؛ تعداد تست‌های آن نتیجهٔ امروز نیست.

## بازتولید مناسب

از ریشهٔ checkout، با پیش‌نیازهای [مشارکت](../CONTRIBUTING.md):

```sh
npm run docs:check
npm run lint
npm run typecheck
npm run test:domain
npm run build
npx playwright install chromium
npm run test:http
```

HTTP سرور خود را می‌سازد؛ smoke جداگانه به سرور فعال نیاز دارد. تست UI/worker را متناسب با مرز تغییر از [AGENTS.md](../AGENTS.md) انتخاب کنید. در کار هم‌زمان، build/HTTP/browser/Docker را با قفل انحصاری مشترک اجرا کنید.

## موارد تأییدنشده

پذیرش تمام ۱۴ خانواده، topology عمومی چندcomponent/worker/scheduler، migration و persistence کامل مقصد و runtimeهای خارج از تنظیمات آزموده‌شده بازند. خرابی محیط Docker یا اسکریپت تاریخیِ assistant-first به معنی اجرای موفق نیست. خودآزمایی مستقل کیت طراحی نیز پذیرش Launchlane را تعیین نمی‌کند. وضعیت موردی در گزارش‌های بالا و [کارهای باز](../TASKS.md) ثبت است؛ مدل، receipt یا approval را تولید نمی‌کند.
