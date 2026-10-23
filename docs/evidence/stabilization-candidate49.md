# تثبیت و تحویل candidate49 — ۲۰۲۶-۱۰-۲۳

وضعیت این برش: هستهٔ محلی و آزمون‌های مشخص زیر موفق‌اند و سرور اصلی همان خروجی را اجرا می‌کند. انتشار کامل ترب با دادهٔ پایدار، پذیرش عمومی همهٔ خانواده‌ها و اجرای تازهٔ Docker از این نتیجه حاصل نمی‌شوند.

## هویت نسخه و تغییرهای بسته‌شده

کد فعال `e1709301250afd85282c694d08d81a7d67dfe39f`، tree `8ca1526603660f0936474e45c4fc6463556922ec` و candidate49 است. export ایندکس ۳۸۲ فایل runtime/test/script/config دارد؛ digest آن `1bdb38f71b79d5d7bd68bedfe50cbe9dce14a626bc9685531936dea7ac2b6467` و اختلاف بایت با snapshot صفر است. parent زمان freeze برابر `69f38c9` بود؛ commit متناظر **tree کامل** برابر `e170930` است. commit بعدی مستندات، نسخهٔ کد سرو‌شده را تغییر نمی‌دهد.

تغییرات انباشته، پس از review و بررسی مربوط، در هفت کامیت موضوعی Conventional ثبت شدند:

- `d5a3a4d`: آزادکردن SQLite و پوشهٔ موقت متعلق به fixture هنگام شکست setup؛ بستن تکراری امن است. deadline و assertion قبلی حفظ شدند.
- `88518e2`: اتصال frontend بومی React/Vue/Angular و Node20 به قرارداد مشترک؛ حفظ `next.nodeVersion`، کشف env از referenceهای واقعی process و رد root دارای workspace به‌عنوان frontend آماده. پذیرش cloud این خانواده‌ها همچنان مستقل است.
- `f6a748f`: کاهش فقط متن source تکراری در درخواست مدل با حفظ رسید کامل برابر، ترتیب ابزار و history؛ دکمهٔ بستن پیشنهاد منقضی‌شده با همان تصمیم reject موجود.
- `d56c099`: خلاصهٔ مراحل و نتیجهٔ correlated، حفظ باز/بسته‌کردن دستی و نمایش برآورد ۲۴ساعت/۳۰روز از quote موجود با محاسبهٔ صحیح و بیان موارد خارج از قیمت.
- `1617fbd`: descriptor خواندنی ASGI/Vite، اعتبارسنجی مستقل manifest/بایت خروجی و قرارداد bootstrap محدود؛ foundation مستقل با `publishable:false`، بدون جایگزینی startup فعلی ترب.
- `69f38c9`: oracle واقعی script/stylesheet و MIME، خواندن محدود خروجی container و اصلاح cleanup تست پس از پاسخ گم‌شده با هویت دقیق. اتصال export به lifecycle و artifact نهایی هنوز انجام نشده است.
- `e170930`: آزمون مرورگر محصول کامل برای پیشنهاد منقضی‌شده، API واقعی تصمیم و ادامهٔ هدایت‌شده؛ افزوده‌شدن آن به دستورهای مرورگر و ثبت دستور تحویل موضوعی.

مقایسهٔ مرجع liara-copilot فقط مبنای انتخاب بهبود بود؛ کد یا asset آن کپی نشد. [گزارش مستقل مرجع](reference-improvements.md) و [مرز foundation ترکیبی](composite-preparation.md) تصمیم‌ها و شکست‌های اولیه را نگه می‌دارند.

## بررسی روی همین snapshot نهایی

| فرمان یا بررسی | نتیجهٔ مشاهده‌شده و مرز |
| --- | --- |
| `npm run build` | موفق؛ build تازهٔ candidate49، بدون کپی bundle/server از نسخهٔ قبل؛ هشدارهای tracing موجود حفظ‌اند |
| `npm run typecheck` | موفق؛ Next typegen و `tsc --noEmit` |
| `npm run lint` | صفر error؛ ۴۳ warning و ۱۳ info روی ۳۷۸ فایل؛ هشدارها رفع‌شده ادعا نمی‌شوند |
| `npm run test:domain` | ۴۴۱/۴۴۱؛ صفر fail/cancel/skip، حدود ۲۵۳٫۲۶ ثانیه؛ model/provider مصنوعی |
| `npm run test:http` | ۳۹/۳۹؛ صفر fail/cancel/skip، حدود ۲۲٫۰۶ ثانیه؛ سرور تولیدی مجزا و scope مصنوعی |
| بررسی host/VM در سه فایل sandbox | ۱۰/۱۰؛ parser/MIME مشترک worker، قرارداد bootstrap و exporter/cleanup میزبان؛ **اجرای واقعی Docker نیست** |
| `npm run test:publication-expiry` | ۴ حالت در ۳۶۰ و ۱۲۸۰؛ صفر page error/external/model/provider attempt؛ API واقعی محصول، state موقت و provider مصنوعی |
| `npm run test:login` | ۸ حالت/دو کاربر؛ جداسازی پروژه موفق، صفر page error؛ identity provider مصنوعی |
| `npm run test:destination-plans` | ۱۴ حالت؛ صفر model/provider write، quote و تعامل واقعی Chromium |
| `npm run test:platforms` | ۱۲ حالت؛ صفر error/external/model، نشان و چیدمان واقعی Chromium با profileهای محدود آزمون |

آزمون expiry، کنترل approve نامعتبر را غایب، مسیر keyboard از disclosure به close و Enter، تصمیم reject، وضعیت `needs_input`/`cancelled`، حفظ مصرف غیرصفر/limits/mission و reload بدون replay را بررسی می‌کند. ادامهٔ هدایت‌شده فعال است؛ دکمهٔ آن برای آغاز مأموریت تازه کلیک نشد. سناریوی موقت روی همان build نهایی اجرا شد؛ state اصلی برای ساختن این وضعیت seed نشد.

این‌ها suiteهای مشخص‌اند؛ `npm run check`، aggregate کامل `test:browser` یا ماتریس همهٔ Docker/runtimeها دوباره اجرا نشده‌اند. logهای دقیق `candidate-49-*.log` و هویت‌ها در evidence خصوصی همان مأموریت نگه‌داری می‌شوند.

۱۰ بررسی میزبان از `tests/sandbox/composite-bootstrap.test.ts`، `tests/sandbox/frontend-build.test.ts` و `tests/sandbox/frontend-export.test.ts` با انتخاب نام `^(composite bootstrap validates|the worker|host )` اجرا شدند؛ انتخاب موردها عمداً هیچ آزمون دارای اجرای Docker را شامل نمی‌شود.

## فعال‌سازی و حفظ state

در ۱۸:۴۰:۱۳ UTC سرور loopback پورت۳۰۰۰ از candidate46/`401abfc` به candidate49/`e170930` منتقل شد. پیش از stop، نبود action/run/job فعال یا uncertain بررسی، از SQLite بکاپ consistent گرفته و `quick_check` آن تأیید شد؛ env و launcher قبلی نیز خصوصی حفظ شدند. فقط process متعلق به همان listener متوقف شد.

پس از startup، مسیر حفاظت‌شده بدون session پاسخ۴۰۱ و صفحهٔ اصلی پاسخ۲۰۰ داد. ۹ فایل JS/CSS دریافت‌شده از سرور اصلی با فایل‌های candidate49 SHA256 برابر دارند و متن کنترل expiry در bundle سرو‌شده وجود دارد. بررسی مستقل Chromium در۳۶۰/۱۲۸۰ نیز هر۶ JS واقعاً loadشده، tree نسخه و ancestry کامیت `f6a748f` را تأیید کرد؛ صفر page error، تخطی گزارش‌شدهٔ axe، overflow و درخواست خارجی یا POST داشت. این probe فقط صفحهٔ ورود و هویت فایل‌های سرور را می‌سنجد؛ تعامل expiry با API در state موقت بالا بررسی شده است. رمز واقعی ارسال نشد.

تمام ردیف‌های هر۲۸ جدول state، شامل credential ciphertext، session، history و schema17، با بکاپ پیش از جابه‌جایی برابر ماندند؛ ۱۹ flow،۱۷ action و۲ connection حفظ شدند. hash فایل تنظیمات نیز برابر است. دفتر مصرف مدل و reserveهای قبلی حفظ شدند؛ درخواست زندهٔ تازهٔ مدل/لیارا صفر و allowance تازه ایجاد نشد. هزینهٔ زمان اجرای Codex و صورتحساب سرویس، اندازه‌گیری نشده‌اند.

## شکست‌های محفوظ و اولین مرزهای باز

- candidate47 آخرین full-domain برابر۴۰۹/۴۱۰ داشت؛ fixture پیش از assertion در archive/capture به deadline رسید. ۵۰ تکرار instrumentشده و subset موفق، علت تاریخی را اثبات نکردند. cleanup درست شد، timeout زیاد نشد و pass جدید۴۴۱/۴۴۱ مربوط به candidate49 است. candidate48 نیز۴۴۱/۴۴۱ داشت؛ اصلاح یک mkdir در harness expiry سبب snapshot تازه49 شد و بررسی‌های نهایی روی49 تکرار شدند.
- آزمون واقعی frontend Docker پیش از asset assertion پس از۱۲۵٫۴۹ثانیه با `SANDBOX_CLEANUP_UNCONFIRMED` متوقف شد. fixture export نیز پیش از export در مهلت۱۰ثانیهٔ start متوقف شد. منبع دقیق باقی‌مانده با name/label/image/ID تطبیق و حذف شد؛ علت latency همچنان UNCONFIRMED و actual export pass تازه موجود نیست.
- نخستین probe خصوصی primary، عنوان ثابت اشتباه را انتظار داشت؛ source عنوان صفحهٔ ورود را صریحاً تعیین می‌کند. فقط oracle خصوصی با source برابر و probe تکرار شد؛ محصول برای پاس‌کردن آن عوض نشد. شکست اصلی محفوظ است.
- مخزن ترب مستقل در این مدت تغییر کرد؛ آخرین مشاهدهٔ فقط‌خواندنی در این برش `24ffcaa03cc34cefc46d2ce824913f681152e46b` با تغییر باز اسناد بود. هیچ source، DB یا usage ledger آن تغییر/reset نشد. پیش از مأموریت بعد، revision و تغییرهای تازه باید مجدد pin شوند.
- مسیر لازم بعدی در خود محصول: runtime/start ترب فعلی، build و export واقعی frontend پیش از پایان container، اتصال بایت تأییدشده به artifact مشتق، دیسک و انتقال consistent دیتابیس/دفتر مصرف، سپس current-release/assets/رفتار واقعی و پایداری پس از restart/redeploy. foundation مستقل یا build محلی این مسیر را تکمیل نمی‌کند.
- AC28/همهٔ۱۴ خانواده همچنان partial است؛ native React/Vue/Angular/Next زنده و خانواده‌های باقیمانده پذیرش مستقل لازم دارند. MCP مشترک و شاهد محدود Codex قبلی، از connector اجرایی جدا هستند؛ connector Codex شاهد محدود قبلی دارد و اجرای زندهٔ Claude Code/OpenCode هنوز UNCONFIRMED است.

هیچ push، branch/worktree تازه، بازنویسی تاریخچه، preparation پنهان ترب یا reset داده انجام نشد. وضعیت Git تحویل باید پس از کامیت همین گزارش دوباره clean بررسی شود.
