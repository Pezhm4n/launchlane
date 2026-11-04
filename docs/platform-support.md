# پشتیبانی پلتفرم‌ها

[راهنمای نصب](setup.md) · [معیارهای پذیرش](acceptance.md) · [شواهد](verification.md)

این جدول قابلیت خود Launchlane را توصیف می‌کند؛ فهرست نسخه‌های در دسترس یک حساب لیارا نیست. نسخه، پلن، قیمت، شبکه و امکان ایجاد منبع باید هنگام پیشنهاد از حساب و source واقعی تطبیق داده شوند. تشخیص یک manifest، اجرای پروژه یا انتشار سالم آن را ثابت نمی‌کند.

## مسیرهای پیاده‌شده و حدود آن‌ها

همهٔ خانواده‌های زیر در دامنهٔ محصول‌اند. هر مسیر همچنان به تنظیمات صریح، source سازگار، آزمون اصلی و worker مجاز نیاز دارد. واژهٔ «محلی» یعنی اجرای واقعی روی میزبان/کانتینر آزمایش؛ transport مدل یا لیارا ممکن است مصنوعی باشد.

| خانواده | مسیر موجود | آنچه شاهد دارد | مرزهای باز |
| --- | --- | --- | --- |
| Node.js | npm lock v3، Node20/22/24؛ pnpm11.19 workspace با runtime سازگار | install/build/test/start محدود؛ artifact و چند چرخهٔ native Node22 زنده | نسخه‌ها و دستورهای عمومی، تمام dependencyها و پذیرش هر repository |
| Next.js | آماده‌سازی و publication بومی با نسخهٔ Node صریح؛ compiler کنترل‌شده | npm build/test و قرارداد native در نمونهٔ محدود | pnpm Next/SSR عمومی، raw corpus و native cloud برای پروژه‌های دلخواه |
| React | native frontend و component کامپایل‌شدهٔ pnpm/Vite | compiler واقعی، تست اصلی، archive دقیق و مرورگر | کل topology، backend/data همراه و native cloud عمومی |
| Vue | Vite/Vue SFC در مسیر component اصلی workspace | compiler واقعی، output صریح، archive، مرورگر و failureها | SSR، چند app، تنظیمات/نسخه‌های عمومی و پذیرش کل پروژه |
| Angular | انتخاب project/config/output واقعی Angular CLI و component pnpm | AOT واقعی، تست اصلی، archive و route مرورگر | SSR، builder سفارشی، چند component و native cloud |
| Static | index/assets ساده بدون اجرای build؛ خروجی static آزموده‌شدهٔ component | نمونهٔ native زنده و آزمون فایل‌ها/مرورگر | هر bundler، repair عمومی و اعتبار سرویس‌های پنهان پشت frontend |
| Python | Python3.12 با requirements تثبیت‌شده، wheel hash و start صریح | install آفلاین، compile/tests/start؛ FastAPI آماده‌شده با انتشار زندهٔ محدود | pyproject/نسخه‌های دیگر، monorepo خام و تغییر عمومی dependency |
| Django | Python3.12، تنظیمات صریح WSGI/Gunicorn و runner اصلی framework | worker واقعی، Agent/web و قرارداد publication | settings/static/messages خودکار، migration و دادهٔ مقصد، provider زنده |
| Flask | Python3.12، WSGI/Gunicorn و تست اصلی | install/tests/API واقعی و مسیر مشترک Agent/web | entryهای مبهم، نسخه‌های عمومی و اتصال داده/انتشار زنده |
| PHP | PHP8.3.36، Composer2.11.1، lock/hooks/PHPUnit و Apache تازه | vendor دقیق و archive قابل انتشار در Docker | PHP بدون Composer، extension/config عمومی، WordPress و native PHP cloud |
| Laravel | همان مسیر PHP با artisan/public و تنظیمات تست صریح | Laravel API و vendor نصب‌شده، Agent/web/Docker | frontend، queue/scheduler، migration/data و native Laravel cloud |
| .NET | Dockerfile اصلی ASP.NET10 با SDK10.0.403/runtime10.0.14 و lock | SDK/tests/publish اصلی و Agent/web/Docker | native بدون Dockerfile، NuGet خارجی، تحویل دقیق DLL و داده/انتشار زنده |
| Go | Go1.25.14، go.mod/go.sum، تست اصلی و باینری در worker تازه | باینری دقیق، archive، Docker و مرورگر | cgo، workspaces، نسخه‌های دیگر و native Go rebuild |
| Docker | Dockerfile/context صریح، worker محدود و publication نسخه‌دار | build/workload محلی و مسیر Agent/web در نمونه‌های مشخص | هر Dockerfile، دسترسی شبکه/ابزار دلخواه و پذیرش production عمومی |

جزئیات نسخه‌ها و image/toolهای تثبیت‌شده در `src/contracts/project-build.ts`، `pnpm-workspace.ts`، `go-runtime.ts` و `php-runtime.ts` قرار دارند. [گزارش‌های runtime](evidence/runtime.md) revision، فرمان، oracle و failure هر نمونه را نگه می‌دارند. [تصمیم‌های runtime](decisions/runtime.md) علت محدودیت‌ها را توضیح می‌دهند.

## Root، workspace و artifact

- ریشه و component اجرایی باید از manifest، lock و استفادهٔ واقعی source مشخص شوند. نام پروژه مسیر production را انتخاب نمی‌کند.
- pnpm، root lock و importerها را حفظ می‌کند؛ flatten کردن workspace یا جایگزینی lock با npm، راه عبور آزمون نیست.
- compile-only رسید build دارد و artifact قابل انتشار نمی‌سازد. موفقیت یک component، پذیرش کل monorepo نیست.
- خروجی‌های compiled/static/vendor به job/source/plan/output/archive مصوب بسته می‌شوند. انتشار Dockerfile اصلی .NET بازساخت همان source است و گواه برابری بایت DLL تولیدشده نیست.
- تست‌های موجود پروژه و معیار رفتار مستقل حفظ می‌شوند. شکست build، cache، runtime یا oracle باید typed و قابل‌اقدام بماند.

## منابع داده و اجزای مستقل

منابع نام‌دار، اتصال به منبع موجود، env رمز‌شده، runner و schema baseline در [مسیر داده](evidence/database.md) و [تصمیم‌های آن](decisions/database.md) مستندند. منبع موقت و secret مصنوعی اختیار SQL یا migration تولیدی نمی‌دهند. دادهٔ مقصد، اتصال برنامه و persistence باید جداگانه سنجیده شوند.

backend/API، worker، queue consumer و scheduler را نمی‌توان با موفقیت frontend حذف‌شده فرض کرد. orchestration عمومی تمام componentها و وابستگی‌های آن‌ها هنوز پذیرش کامل ندارد. [Corpus](deployment-corpus.md) و [A11/A14](../TASKS.md) این مرز را نگه می‌دارند.

## پذیرش کامل یک خانواده

پروژهٔ واقعی باید از مسیر مشترک وب/Agent و MCP وارد شود؛ runtime و منابع لازم آماده شوند؛ artifact/release دقیق منتشر شود؛ رفتار اصلی، route/assets و در صورت وجود اثر داده بررسی شوند؛ شکست معنادار و مسیر repair/redeploy نیز سنجیده شوند. HTTP200، READY یا upload موفق به‌تنهایی کافی نیستند.

پذیرش تولیدی کامل تمام ۱۴ خانواده باز است. نسخه‌های قدیمی یا فهرست‌شده در مستند provider، تضمین سازگاری یا توصیهٔ استفاده نیستند. برای اجرای آزمون‌ها، پیش‌نیازهای [AGENTS.md](../AGENTS.md) و راهنمای [نصب](setup.md) را رعایت کنید؛ Docker یا credential ناموجود، نتیجهٔ pass نیست.
