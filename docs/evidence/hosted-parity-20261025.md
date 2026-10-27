# رفع تفاوت بستهٔ عمومی و نصب محلی — ۲۰۲۶-۱۰-۲۵

این برش با دستور مالک، **بدون commit/staging و بدون تغییر ظاهر** انجام شد. HEAD همان `6937dfc9a6be4f53a134b55175a53d22512dcf29` است؛ کد Next فعال پایه27b14b5 و ingress4e5a55e ماندند. کاربر روشن کرد هنوز انتشار تازه‌ای را تست نکرده و منظورش برابری عملکرد خود Launchlane محلی/عمومی است؛ خطای نامشخص پروژه به‌عنوان failure مشاهده‌شده معرفی نشد.

## مشاهده، علت و اصلاح

در03:20UTC، VPS وب را۳۱ساعت، بدون restart/OOM، با حدود۲٫۸GB حافظهٔ available و۲۸GB دیسک آزاد اجرا می‌کرد. public DB یک اتصال و یک سابقه incident داشت ولی project/action/run/repair صفر بودند. نشانه‌ای از درخواست انتشار شکست‌خوردهٔ کاربر در این state نبود؛ نبودن رکورد به‌تنهایی علت خرابی نیست.

همان image تولیدی، با state جدا، شبکهٔ none و پاسخ هویت مصنوعیِ موجود پروژه، بررسی شد:

- ورود/session و workspace200؛ upload پنج فایل واقعی Login با201، profile Static، artifact و بازیابی همان flow با200 گذشت. این مسیر در baseline خراب نبود و application آن تغییر نکرد.
- انتخاب sample با404/FOLDER_NOT_FOUND شکست خورد. مسیر `examples/node-service` در runtime نبود: Docker context و COPY runtime آن را حمل نمی‌کردند. allowlist اکنون فقط همان نمونهٔ کنترل‌شده را می‌پذیرد و Dockerfile آن را کپی می‌کند.
- image قرارداد Node20 روی daemon وجود نداشت؛ دستور `docker image inspect` خطای No such image داد. worker عمداً `--pull=never` دارد، پس مسیر Node20/frontend نمی‌توانست از image غایب اجرا شود. همان image با digest قرارداد موجود دریافت شد. startup اکنون چهار image Node20/22/24/Python3.12 و خواندنی‌بودن دو فایل لازم نمونه را بررسی می‌کند؛ اختلال بستهٔ ناقص به liveness موفق تبدیل نمی‌شود.
- `require.resolve` عادی برای چند dependency در standalone نتیجه نداشت؛ اجرای واقعی upload موفق بود. این مشاهده به‌عنوان علت خرابی پذیرفته نشد و dependency اضافی یا کپی بی‌دلیل node_modules صورت نگرفت.

## هویت نسخهٔ منتشرشده

image پایه: `sha256:0261aad88a1a8c39e5ef6a2ceb8bc99755c140a8e5304470cc303df47fd16e69`.

image فعال جدید: `sha256:a109b27fde37cfbf02b40b3ade96c17f2eddf052e4d39fff1ecb95f009423c6f`.

patch از بایت‌های working tree بدون commit freeze شد: digest manifest برابر `19602e67d1ca867bb48dd89d0a980d485dae9578a63e225d4b9a02af207fb110`، archive SHA256 برابر `67da475e20c9129560e81454b28baf4cd51a80e495dbc52e421772efa9e4104c` و اندازه۳۶۳۸بایت. image جدید فقط نمونه و startup را روی image پایهٔ دقیق اضافه می‌کند. سرور Next، assets و منطق UI بازسازی یا تعویض نشدند؛ Dockerfile اصلی نیز برای build بعدی اصلاح شد. بسته و manifest در `.local/hosting-launchlane-20261023/hotfix-20261025.*` خصوصی‌اند.

## اعتبارسنجی و انتشار

- `node --check scripts/start-hosted.mjs` و `git diff --check` موفق.
- `node --test tests/domain/model-budget.test.mjs tests/domain/hosted-ingress.test.mjs`:۹pass، صفرfail/skip/cancel؛ provider/model مصنوعی و هیچ اعتبار زنده مصرف نشد.
- startup واقعی image جدید روی همان VPS با authMode لیارا، originHTTPS، state جدا، Docker Linux و چهار image گذشت. شبکهٔ این محیط بسته و هویت synthetic بود؛ credential عمومی یا اپراتور کپی نشد.
- همان HTTP probe اکنون sample را201/ready با۳فایل و artifact، و Login را201/ready با۵فایل و artifact گرفت. GET همان flow200 بود. پس از restart همان محیط، ورود دوباره و بازیابی دقیق flow قبلی Login با همان ID/۵فایل/artifact/ready گذشت؛ publication ابری از این نتیجه حاصل نمی‌شود.
- runner واقعی همان `container.ts` بدون تغییر، از کد پایه، در orchestrator جدید به Docker اجرا شد: Node22 test، Node20 dependency-free build/start/GET با runtime=20، و Node24 همان معیار با runtime=24، هر سه exit0/signal=null. source/cache هم‌مسیر host bind بودند؛ containerهای worker با identity خودشان پاک شدند. این سنجش compiler عمومی React/Vue/Angular یا repair با مدل نیست.
- قبل از جابه‌جایی production، نبود کار فعال/نامعلوم بررسی و SQLite backup consistent از state و ledger گرفته شد. در نخستین export، `docker cp` فایل داخل tmpfs را پیدا نکرد؛ هنوز هیچ توقف/config write نشده بود. backupهای موجود با stream باینری خصوصی صادر شدند و همان مرحله ادامه یافت؛ DB یا journal reset نشد.
- claim خصوصی پیش از تعویض image ثبت شد؛ فقط web با همان compose و runtime env بازآفرینی شد. ingress، TLS، account scope و منابع پولی تغییر نکردند. image واقعی جدید healthy و OOM=false است؛ runtime config hash ثابت ماند.
- پس از startup و درخواست واقعی حفاظت‌شده، همهٔ ردیف‌های۲۸جدول state و۵جدول ledger با backup برابر و هر دو quick_check=ok بودند؛ این شاهد حفظ state موجود در یک rollout بیکار است. state عمومی هنگام baseline پروژه‌ای نداشت؛ حفظ archiveهای پروژهٔ عمومی از این مقایسه نتیجه نمی‌شود و بررسی Login در محیط جدا ثبت شده است.
- دامنهٔ **https://launchlane-live-1023.liara.run/?view=publish** پاسخ200 دارد. هر۹asset واقعی JS/CSS قبل/بعد از نظر path، اندازه و SHA256 دقیقاً برابرند؛ درخواست عمومی بدون نشست به `/api/workspace` همچنان401/AUTH_REQUIRED است.

محیط‌های baseline و staging متعلق به همین بررسی متوقف شدند؛ داده‌ها و logهای خصوصی نگه‌داری شدند. container production و proxy فعال‌اند. هیچ source/DB/ledger ترب، سرور محلی یا history Git تغییر/reset نشد.

## مصرف و مرز باز

دفتر مدل ثابت است: allowance۲دلار، ceiling calls۰٫۸۹۰۴، reserveها۰٫۹۰۹۶ و اختیار باقی‌ماندهٔ public۰٫۲دلار. model request زنده صفر، reserve/allowance تازه صفر و منبع پولی تازه صفر؛ دریافت image از همان VPS انجام شد. صورتحساب نهایی/ترافیک این برش اندازه‌گیری نشده است.

انتشار تازهٔ پروژه از نشست واقعی عمومی، GitHub OAuth، MCP عمومی، connector اجرایی بیرونی، compiler/انتشار زندهٔ تمام۱۴خانواده و ترب کامل **UNCONFIRMED** هستند. رفتار آزموده‌نشده «رفع‌شده» یا «برابر کامل با نصب شخصی» نامیده نمی‌شود؛ خصوصاً credentials و runtime شخصی مدیر نباید به public منتقل شوند.
