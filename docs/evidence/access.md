# Access — verification evidence

[Documentation](../README.md) · [Current support](../platform-support.md) · [Verification index](../verification.md)

These versioned records preserve the original decisions, source revisions, failures and evidence limits. Dates and passing counts apply only to the named snapshot, not the current release. Installation-specific locations and identities are omitted.

## Records

- [رفع تفاوت بستهٔ عمومی و نصب محلی — ۲۰۲۶-۱۰-۲۵](#hosted-parity-20261025)
- [میزبانی واقعی Launchlane روی لیارا — ۲۰۲۶-۱۰-۲۴](#launchlane-hosted-release)
- [ورود با حساب لیارا؛ A03/A05/A17/A19](#liara-identity-login)
- [MCP connection settings — 2026-11-04](#mcp-connection-ui)
- [اتصال MCP به HTTPS و آزمون مستقل — ۲۰۲۶-۱۰-۲۵](#mcp-hosted-independent-20261025)
- [انتشار واقعی MCP روی دامنهٔ عمومی — ۲۰۲۶-۱۰-۲۵](#mcp-public-release-20261025)
- [MCP و application مشترک؛ ۲۰۲۶-۱۰-۲۳](#mcp-shared-application)

<a id="hosted-parity-20261025"></a>

## رفع تفاوت بستهٔ عمومی و نصب محلی — ۲۰۲۶-۱۰-۲۵

این برش با دستور مالک، **بدون commit/staging و بدون تغییر ظاهر** انجام شد. HEAD همان `6937dfc9a6be4f53a134b55175a53d22512dcf29` است؛ کد Next فعال پایه27b14b5 و ingress4e5a55e ماندند. کاربر روشن کرد هنوز انتشار تازه‌ای را تست نکرده و منظورش برابری عملکرد خود Launchlane محلی/عمومی است؛ خطای نامشخص پروژه به‌عنوان failure مشاهده‌شده معرفی نشد.


<a id="hosted-parity-20261025-مشاهده-علت-و-اصلاح"></a>

### مشاهده، علت و اصلاح

در03:20UTC، VPS وب را۳۱ساعت، بدون restart/OOM، با حدود۲٫۸GB حافظهٔ available و۲۸GB دیسک آزاد اجرا می‌کرد. public DB یک اتصال و یک سابقه incident داشت ولی project/action/run/repair صفر بودند. نشانه‌ای از درخواست انتشار شکست‌خوردهٔ کاربر در این state نبود؛ نبودن رکورد به‌تنهایی علت خرابی نیست.

همان image تولیدی، با state جدا، شبکهٔ none و پاسخ هویت مصنوعیِ موجود پروژه، بررسی شد:

- ورود/session و workspace200؛ upload پنج فایل واقعی Login با201، profile Static، artifact و بازیابی همان flow با200 گذشت. این مسیر در baseline خراب نبود و application آن تغییر نکرد.
- انتخاب sample با404/FOLDER_NOT_FOUND شکست خورد. مسیر `examples/node-service` در runtime نبود: Docker context و COPY runtime آن را حمل نمی‌کردند. allowlist اکنون فقط همان نمونهٔ کنترل‌شده را می‌پذیرد و Dockerfile آن را کپی می‌کند.
- image قرارداد Node20 روی daemon وجود نداشت؛ دستور `docker image inspect` خطای No such image داد. worker عمداً `--pull=never` دارد، پس مسیر Node20/frontend نمی‌توانست از image غایب اجرا شود. همان image با digest قرارداد موجود دریافت شد. startup اکنون چهار image Node20/22/24/Python3.12 و خواندنی‌بودن دو فایل لازم نمونه را بررسی می‌کند؛ اختلال بستهٔ ناقص به liveness موفق تبدیل نمی‌شود.
- `require.resolve` عادی برای چند dependency در standalone نتیجه نداشت؛ اجرای واقعی upload موفق بود. این مشاهده به‌عنوان علت خرابی پذیرفته نشد و dependency اضافی یا کپی بی‌دلیل node_modules صورت نگرفت.


<a id="hosted-parity-20261025-هویت-نسخه-منتشرشده"></a>

### هویت نسخهٔ منتشرشده

image پایه: `sha256:0261aad88a1a8c39e5ef6a2ceb8bc99755c140a8e5304470cc303df47fd16e69`.

image فعال جدید: `sha256:a109b27fde37cfbf02b40b3ade96c17f2eddf052e4d39fff1ecb95f009423c6f`.

patch از بایت‌های working tree بدون commit freeze شد: digest manifest برابر `19602e67d1ca867bb48dd89d0a980d485dae9578a63e225d4b9a02af207fb110`، archive SHA256 برابر `67da475e20c9129560e81454b28baf4cd51a80e495dbc52e421772efa9e4104c` و اندازه۳۶۳۸بایت. image جدید فقط نمونه و startup را روی image پایهٔ دقیق اضافه می‌کند. سرور Next، assets و منطق UI بازسازی یا تعویض نشدند؛ Dockerfile اصلی نیز برای build بعدی اصلاح شد. بسته و manifest در `.local/hosting-launchlane-20261023/hotfix-20261025.*` خصوصی‌اند.


<a id="hosted-parity-20261025-اعتبارسنجی-و-انتشار"></a>

### اعتبارسنجی و انتشار

- `node --check scripts/start-hosted.mjs` و `git diff --check` موفق.
- `node --test tests/domain/model-budget.test.mjs tests/domain/hosted-ingress.test.mjs`:۹pass، صفرfail/skip/cancel؛ provider/model مصنوعی و هیچ اعتبار زنده مصرف نشد.
- startup واقعی image جدید روی همان VPS با authMode لیارا، originHTTPS، state جدا، Docker Linux و چهار image گذشت. شبکهٔ این محیط بسته و هویت synthetic بود؛ credential عمومی یا اپراتور کپی نشد.
- همان HTTP probe اکنون sample را201/ready با۳فایل و artifact، و Login را201/ready با۵فایل و artifact گرفت. GET همان flow200 بود. پس از restart همان محیط، ورود دوباره و بازیابی دقیق flow قبلی Login با همان ID/۵فایل/artifact/ready گذشت؛ publication ابری از این نتیجه حاصل نمی‌شود.
- runner واقعی همان `container.ts` بدون تغییر، از کد پایه، در orchestrator جدید به Docker اجرا شد: Node22 test، Node20 dependency-free build/start/GET با runtime=20، و Node24 همان معیار با runtime=24، هر سه exit0/signal=null. source/cache هم‌مسیر host bind بودند؛ containerهای worker با identity خودشان پاک شدند. این سنجش compiler عمومی React/Vue/Angular یا repair با مدل نیست.
- قبل از جابه‌جایی production، نبود کار فعال/نامعلوم بررسی و SQLite backup consistent از state و ledger گرفته شد. در نخستین export، `docker cp` فایل داخل tmpfs را پیدا نکرد؛ هنوز هیچ توقف/config write نشده بود. backupهای موجود با stream باینری خصوصی صادر شدند و همان مرحله ادامه یافت؛ DB یا journal reset نشد.
- claim خصوصی پیش از تعویض image ثبت شد؛ فقط web با همان compose و runtime env بازآفرینی شد. ingress، TLS، account scope و منابع پولی تغییر نکردند. image واقعی جدید healthy و OOM=false است؛ runtime config hash ثابت ماند.
- پس از startup و درخواست واقعی حفاظت‌شده، همهٔ ردیف‌های۲۸جدول state و۵جدول ledger با backup برابر و هر دو quick_check=ok بودند؛ این شاهد حفظ state موجود در یک rollout بیکار است. state عمومی هنگام baseline پروژه‌ای نداشت؛ حفظ archiveهای پروژهٔ عمومی از این مقایسه نتیجه نمی‌شود و بررسی Login در محیط جدا ثبت شده است.
- دامنهٔ **&lt;deployment-origin&gt; پاسخ200 دارد. هر۹asset واقعی JS/CSS قبل/بعد از نظر path، اندازه و SHA256 دقیقاً برابرند؛ درخواست عمومی بدون نشست به `/api/workspace` همچنان401/AUTH_REQUIRED است.

محیط‌های baseline و staging متعلق به همین بررسی متوقف شدند؛ داده‌ها و logهای خصوصی نگه‌داری شدند. container production و proxy فعال‌اند. هیچ source/DB/ledger ترب، سرور محلی یا history Git تغییر/reset نشد.


<a id="hosted-parity-20261025-مصرف-و-مرز-باز"></a>

### مصرف و مرز باز

دفتر مدل ثابت است: allowance۲دلار، ceiling calls۰٫۸۹۰۴، reserveها۰٫۹۰۹۶ و اختیار باقی‌ماندهٔ public۰٫۲دلار. model request زنده صفر، reserve/allowance تازه صفر و منبع پولی تازه صفر؛ دریافت image از همان VPS انجام شد. صورتحساب نهایی/ترافیک این برش اندازه‌گیری نشده است.

انتشار تازهٔ پروژه از نشست واقعی عمومی، GitHub OAuth، MCP عمومی، connector اجرایی بیرونی، compiler/انتشار زندهٔ تمام۱۴خانواده و ترب کامل **UNCONFIRMED** هستند. رفتار آزموده‌نشده «رفع‌شده» یا «برابر کامل با نصب شخصی» نامیده نمی‌شود؛ خصوصاً credentials و runtime شخصی مدیر نباید به public منتقل شوند.

<a id="launchlane-hosted-release"></a>

## میزبانی واقعی Launchlane روی لیارا — ۲۰۲۶-۱۰-۲۴

دامنهٔ قابل دسترس: **&lt;deployment-origin&gt; در `2026-10-23T20:45:20Z` صفحهٔ اصلی با عنوان Launchlane و هر۹ فایل JS/CSS با200 دریافت شدند. `GET /api/health` برابر200 و `GET /api/workspace` بدون نشست برابر401/AUTH_REQUIRED بود. این انتشار خود محصول است؛ انتشار تازهٔ پروژهٔ کاربر یا ترب از آن نتیجه نمی‌شود.


<a id="launchlane-hosted-release-هویت-و-ساختار-نصب"></a>

### هویت و ساختار نصب

- web: کد `27b14b5c78832abec4f2b3401c63b1a322dd7483`؛ image واقعی `sha256:0261aad88a1a8c39e5ef6a2ceb8bc99755c140a8e5304470cc303df47fd16e69`، خروجی standalone Next16.4.2 با Node24.18.0 و npm ci. بستهٔ Git allowlist با SHA256 `b529eaab2316dcd42be8405f3d327498e5faf0d805452e9ee97ce22541df622e` روی VPS ساخته شد؛ build محلی Docker پیش‌تر read-only metadata داده بود.
- VPS مجاز: Ubuntu24.04، پلن standard-plus-g2 با۴GB/دوCPU/۴۰GB؛ Docker29.1.3/Linux. web با کاربرnode، root read-only، state bind هم‌مسیر `/var/lib/launchlane` و socket خصوصی orchestrator اجرا می‌شود. Node22/24 و Python3.12 با digestهای قرارداد فعلی موجود و startup آن‌ها را inspect کرده است؛ job تازهٔ repair/build در این نصب اجرا نشده است.
- ingress: کد `4e5a55e798fb405dd95876217c0b9a0629a0d01c`؛ release فعال `<resource-id>`، source `c48677fc-8e10-415b-b0d0-b60165b669b5.tar.gz`، archive SHA256 `3452d385fbeeac3ae2be8222a23d90e986434e9543b81285a0ca2014a5908f91`؛ پلن small-g2/basic و Node24، پورت8080. READY در readback با پاسخ واقعی صفحه و assetها تکمیل شد؛ READY به‌تنهایی oracle نبود.
- لیارا TLS عمومی را خاتمه می‌دهد؛ ingress به Caddy روی8443 با CA و client certificate اختصاصی متصل است. `rejectUnauthorized:true` و client-auth روشن‌اند. web3000 و Docker API پورت عمومی ندارند. certificate سرور/client فعلی۳۰روزه و CA۹۰روزه‌اند؛ تمدید خودکار آن‌ها پیاده نشده است.
- gh رسمی Linux2.103.0 با checksum رسمی آرشیو، فقط executable و bind read-only نصب شد؛ `gh --version` داخل web همین نسخه را داد. هیچ credential/OAuth مدیر منتقل نشد.


<a id="launchlane-hosted-release-state-و-مصرف"></a>

### state و مصرف

نصب عمومی secret مستقل و state تازه دارد؛ DB محلی، archiveها، history، approvalهای single-use و credentialهای مدیر clone نشدند. پس از درخواست واقعی حفاظت‌شده، `state.sqlite` دارای۲۸جدول و `quick_check=ok` بود. دفتر مدل۵جدول و `quick_check=ok` دارد؛ هر دو داخل bind پایدار VPS هستند. restart/redeploy persistence عملی در این مرحله اجرا نشده و از وجود mount به‌عنوان شاهد restart استفاده نمی‌شود. بکاپ خارج VPS و بازیابی پس از از‌دست‌رفتن VPS هنوز تأیید نشده‌اند.

دفتر اصلی پیش از partition: allowance همان۲دلار، ceiling درخواست‌ها۰٫۸۹۰۴دلار، reserveهای تاریخی۰٫۶۸۷۸۶۶دلار و باقیمانده۰٫۴۲۱۷۳۴دلار. همهٔ ردیف‌ها با SQLite backup consistent حفظ و fingerprint زیر lock مقایسه شد. فقط reserve تخصیص append شد:۰٫۲دلار اختصاصی برای public و۰٫۲۲۱۷۳۴دلار برای نصب محلی. دو کپی حق خرج کل باقیمانده را ندارند؛ allowance تمدید/ایجاد نشد. readback guard در VPS دقیقاً۰٫۲دلار ماندهٔ مجاز داشت. این اعداد سقف محافظه‌کارانه‌اند، نه invoice یا اعتبار حساب. هیچ model request برای استقرار میزبان ارسال نشد؛ فعالیت هم‌زمان کاربر پیش از partition در baseline تازه منظور شده است.

برآورد پایهٔ VPS+IPv4+ingress از همان catalog مجاز حدود۵هزار تومن در ساعت و۸۴۰هزار تومن در۷روز است؛ مالیات/ترافیک و منابع قبلی جدا هستند. سقف قبلی۲میلیون تومان افزایش نیافت. میزان نهایی صورتحساب این استقرار هنوز اندازه‌گیری نشده است؛ منابع ساخته‌شده در journal خصوصی با ID ثبت‌اند.


<a id="launchlane-hosted-release-شکستها-و-اصلاحها"></a>

### شکست‌ها و اصلاح‌ها

- نام اولیهٔ VPS طولانی‌تر از حد کنسول بود و400 گرفت؛ readback خالی و نام کوتاه `launchlane-exec-1023` با همان منابع/مالکیت یک‌بار ساخته شد. SSH مستقیم در TUN timeout داشت؛ مسیر خصوصی همان میزبان از NIC فیزیکی، با host-key ثابت و بدون تغییر VPN سیستم برقرار شد.
- اولین source upload ورودی موفق بود؛ harness به‌اشتباه ID آن را hex24 انتظار داشت. شناسهٔ واقعی UUID.tar.gz حفظ شد و بدون upload دوباره، با readback نبود release، همان source منتشر شد.
- release اول READY بود اما درخواست واقعی421 می‌داد: Host عمومی با SNI خصوصی در mTLS برابر نبود. ingress اکنون Host داخلی برابر `launchlane-origin` می‌فرستد و Caddy Host عمومی ثابت را بازمی‌گرداند. درخواست داخلی با این تغییر200 شد؛ بررسی TLS/Host غیرفعال نشد.
- upload اصلاح‌شده در یک تلاش پاسخ `fetch failed` داد و receipt نداشت؛ journal آن uncertain باقی است. GET فهرست source در این حساب404 و readback release فقط v1 را نشان داد؛ هیچ release/env/resource write تکرار نشد. یک object immutable مستقل، با سقف یک upload و یک release جدید در مجوز استقرار موجود ثبت شد؛ احتمال باقی‌ماندن source orphan قبلی نامعلوم است. تلاش مستقل receipt داد و فقط همان receipt به releasev2 وصل شد. READY زودتر از جابه‌جایی واقعی ترافیک دیده شد؛421 گذرا حفظ و نهایتاً200 واقعی ثبت شد.
- طبق دستور مالک، suite تازه پس از توقف آزمون‌ها اجرا نشد. تغییر نهایی ingress syntax-check و diff-check شد؛ assertion موجود SNI/Host به قرارداد صحیح به‌روز شد ولی اجرای تازهٔ آن ادعا نمی‌شود.۹regression hosting و۳MCP وlint/typecheck مربوط به برش پیش از توقف، evidence تاریخی همان snapshotها هستند.


<a id="launchlane-hosted-release-محدوده-تحویل"></a>

### محدودهٔ تحویل

ورود با رمز/TOTP حساب واقعی از این دامنه، publication جدید از همان نشست عمومی، job واقعی build/repair، GitHub OAuth، persistence پس از restart، بار چندکاربر و تأیید همهٔ۱۴خانواده **UNCONFIRMED** هستند. API health همچنان liveness را گزارش می‌کند و integrations=unverified را به پذیرش کامل تبدیل نمی‌کند. MCP grant محلی و اتصال Codex جدا هستند؛ یک context واقعی گرفته شد ولی CLI پس از آن با UV_HANDLE_CLOSING خارج شد و اتصال کامل میزبان پذیرفته نیست. MCP عمومی از انتشار web حاصل نمی‌شود.

سرور محلی candidate53 از6a27c66 روی3000 و preview مستقل Login روی3011 حفظ شدند. تغییرات دادهٔ محلی ناشی از upload/کاربر حذف نشدند؛ دادهٔ اصلی ترب دست‌نخورده است. این نصب، مرزهای باز export/artifact/data/publication ترب یا ماتریس رسمی را نمی‌بندد. لینک داورها اکنون به صفحهٔ واقعی محصول وصل است، و ادعای «تمام قابلیت‌ها در production پذیرفته‌اند» مطرح نمی‌شود.

فایل‌های raw، journal، backup، partition و readback در پوشهٔ ignored `.local/hosting-launchlane-20261023` هستند؛ env، TLS key و credential در Git/image/source ingress قرار نگرفتند. راه‌اندازی و محل تنظیمات خصوصی در [راهنمای نصب](../hosted-access.md) آمده است.

<a id="liara-identity-login"></a>

## ورود با حساب لیارا؛ A03/A05/A17/A19


<a id="liara-identity-login-oracle"></a>

### oracle

فرم عمومی نباید کلید اپراتور یا دستور نصب از بازدیدکننده بخواهد. فقط پاسخ هویت واقعی provider می‌تواند actor/نشست ایجاد کند. خطای رمز/کد/شبکه نباید نشست ایجاد کند، خطا نباید پاسخ حساس را echo کند، و کاربر B نباید project/action/token کاربر A را دریافت کند. انتخاب تیم باید membership و هویت همان تیم را بخواند؛ انتخاب منبع و انتشار از application موجود عبور کنند. ورود موفق به‌تنهایی موفقیت انتشار نیست.


<a id="liara-identity-login-مشاهده-زنده-بدون-نوشتن-زیرساخت"></a>

### مشاهدهٔ زندهٔ بدون نوشتن زیرساخت

در `2026-10-23T13:43:51Z`، با اتصال ازقبل‌مجاز، `GET /v1/me` برابر 200 بود، user ID معتبر داشت و team برنگرداند. `POST /v1/login/check-if-exists` برای ایمیل همان حساب برابر 200 و دارای booleanهای `exists/socialCompleted/twoFAEnabled` بود. `GET /v2/teams?page=1&count=100` نیز 200، دو تیم، `totalTeams=2` و شکل `_id/name/color` داشت. هیچ رمز عبوری ارسال نشد، مدل فراخوانی نشد و منبعی ساخته نشد. جزئیات بدون secret در `.local/authority-mission/liara-auth-readonly.json` و probe مربوطه است. این مشاهدات فقط قرارداد read/check را تأیید می‌کنند؛ password exchange زنده UNCONFIRMED است.


<a id="liara-identity-login-وضعیت-آزمون"></a>

### وضعیت آزمون

آزمون domain جدید ورود، challenge، cookie Secure، revoke، config بدون fallback مالک نصب، دو actor و دو team، خطای upstream 400/401/403/429/500، پاسخ ناسازگار، cancellation و rate limit را پوشش می‌دهد. اجرای اولیهٔ مرتبط 24/24 شامل 11 تست تازهٔ ورود و 13 regression اتصال/session بود. شواهد candidate و مرورگر پس از اجرای نهایی در همین سند افزوده می‌شود.


<a id="liara-identity-login-مرز-باز"></a>

### مرز باز

حساب شخصیِ بدون تیم، ساخت تیم داخل محصول، ورود زنده با رمز/TOTP، اجرای end-to-end از دامنهٔ میزبانی واقعی، sandbox آن مقصد، محدودیت تجمیعی مصرف عمومی و همهٔ خانواده‌های runtime هنوز تأیید نشده‌اند. این برش مجوز اعلام آماده‌بودن عمومی یا «انتشار هر پروژه بدون مشکل» نیست. هزینهٔ مدل در این برش صفر است؛ allowance قبلی از نو شروع نشده است. دادهٔ اپراتور محلی حذف یا به حساب تازه نسبت داده نمی‌شود.


<a id="liara-identity-login-candidate38-و-محدودیت-regression"></a>

### candidate38 و محدودیت regression

Export ثابت از base `39a1e4f`، tree `a2f670882d399d8a294e92cd7d1f03663581e0ba`، 348 فایل runtime/test/config و digest `16eb01ed8506ba2224f9cc2e640cb154003d1d6f4ccb9f3fc87b2c881643d17a`، بدون اختلاف بایت ثبت شد. build و typecheck موفق، lint بدون error با39 warning/12 info، HTTP39/39 و مرورگر ورود8 حالت در280/320/390/768/1280 با0 خطای صفحه و0 axe violation گذشتند. دو هویت، TOTP و focus، رقم فارسی، نمایش رمز، خطای رمز و پاک‌شدن ورودی، انتخاب تیم، upload واقعی پوشه، reload، خروج و login مجدد، بازگشت تاریخچهٔ همان actor و رد پروژهٔ actor دیگر سنجیده شدند. transport حساب synthetic و فایل/Chromium واقعی‌اند؛ publication زنده اجرا نشد.

اجرای کامل domain381 تست داشت:380 pass و1 fail در `preparation.test.ts` با `fetch failed` آزمون HTTP محلی worker. اجرای جداگانهٔ اول نیز5/6 بود؛ harness تشخیصی با حفظ assertion و افزودن cause لاگ،1/1 شد و اجرای بدون تغییر فایل اصلی سپس6/6 گذشت. علت نوسان شبکه هنوز UNCONFIRMED است؛ این subset جای381/381 تازه نیست و concurrency علت قطعی معرفی نمی‌شود. خروجی شکست کامل و دو تکرار در گزارش‌های خصوصی candidate38 حفظ شدند. گیت kit طراحی نیز به محدودیت runtime/وابستگی kit خورد؛ امتیاز محصول یا pass تلقی نمی‌شود.

candidate36 در oracle پروژهٔ بیگانه،200 با flow=null گرفت؛ افشا مشاهده نشد، اما status درخواست explicit-ID نامناسب بود. oracle404 ضعیف نشد: route برای شناسهٔ ناموجود یا خارج از actor اکنون404 می‌دهد و مرورگر نهایی همان انتظار را گذراند. بررسی تصویر، معرفی تکراری بالای فرم را نشان داد؛ candidate38 یک معرفی و یک h1 دارد.

<a id="mcp-connection-ui"></a>

## MCP connection settings — 2026-11-04


<a id="mcp-connection-ui-problem-and-resulting-behavior"></a>

### Problem and resulting behavior

The old nested dialog had no shared dialog surface/size class, an oversized checkbox,
one access button and a technical paragraph standing in for the installation flow.
It did not select a client, provide copyable setup instructions, react to expiry or
explain the difference between an issued file and a connected external tool.

The rebuilt dialog uses the existing native modal, theme tokens, glyphs and exit
mechanism. Three native radio choices select Codex, Claude Code or OpenCode. Reading
is the default; optional mission permission explains the existing budget/approval
boundary. The visual connection strip shows the selected endpoints, not observed
host connectivity. No library, font, asset or package dependency was added.

After actual access issuance, the existing private JSON download opens a client-specific
guide. It contains a shell-quoted command bound to this origin and grant ID, the exact
snippet name generated by the existing CLI, the destination config and a copyable
`launchlane_context` request. Copy success/failure is explicit; read-only text fields
support selection/manual copying and content-sized rendering where supported. Long
enlarged content remains bounded and scrollable. Expiry hides old download/setup
controls and offers fresh issuance. Revocation has inline confirmation, failure and
already-absent handling. Escape cancels confirmation first; closing returns focus to
the MCP trigger in the accounts dialog.


<a id="mcp-connection-ui-shared-application-path"></a>

### Shared application path

`ConnectionDialog` → `McpConnectionDialog` → existing `api` → authenticated/CSRF-bound
`POST /api/mcp/access` → `issueMcpAccess` → existing session Store. Download uses the
validated `McpAccessFile`. Revocation uses the existing scoped `DELETE` endpoint.
Setup remains `scripts/setup-mcp.mjs` → official SDK identity/scope readback → private
file and the existing `mcpClientConfigurations`. No policy, execution engine,
provider adapter, migration, model call or renewal path was added.

The graph project was confirmed at `<private-validation>`, generation
`2026-10-21T19:24:24Z`. Task paths were not tracked/metadata-changed; scripts/docs were
excluded. Exact source, imports, the API implementation, CLI and tests supplied the
evidence; an empty graph result was not used as an absence claim.


<a id="mcp-connection-ui-exact-validation-scope"></a>

### Exact validation scope

The independent snapshot is
`<private-validation>`, candidate r6,
based on `f8fcc994fe4c4454b1d1cad18256f7e622bc2b5e` plus this slice. Concurrent schema
baseline work is excluded. Node24.18.0, Next16.4.2 and the installed pinned lockfile
dependencies were used. No operator config, real credential, database or ledger was
copied. Runtime manifest:
`4abf766e98e7b4bc5b8c24c9412b093f82c46c9f5480520a17eb0639482d0781`.
Webpack disk caching was disabled only in this validation copy following disk exhaustion;
the product build configuration is unchanged.

| Command | Final r6 result |
| --- | --- |
| `npm run build -- --webpack` | Passed, including TypeScript compilation |
| `npm run typecheck` | Passed |
| `npm run lint` | Zero errors,48warnings/22infos; changed runtime/test files have no diagnostics |
| `node --test tests/domain/mcp-setup-guide.test.ts tests/domain/mcp.test.ts tests/domain/mcp-access-file.test.ts tests/domain/mcp-connections.test.ts` | 14/14, zero failures/skips/cancellations |
| `node --test --test-concurrency=1 tests/http/mcp.test.mjs tests/http/mcp-hosted.test.mjs` | 14/14 including groups, zero failures/skips/cancellations |
| `node scripts/test-mcp-settings-browser.mjs` | 24 layout/accessibility states, zero page errors/external requests |

The browser uses the actual built UI and disposable SQLite issuance/download/revocation.
Widths280/320/390/768/1280,200%text,500px-height keyboard traversal, native modal
boundary, visible focused controls, confirmation cancel/Escape/focus return, all client
guides, copy/manual fallback, read-only default and optional mission scope were checked.
503/403/401, Clipboard denial, delayed issuance and the shortened UI expiry receipt are
synthetic cases. Real expiry/authorization semantics remain covered by domain/HTTP
tests. Tokens were absent from DOM, browser storage and copied setup text.

The HTTPS suite negotiates TLS with the actual SDK, imports three grants through the
actual CLI, runs the real stdio bridge, downloads/revokes access from Chromium and
verifies that revoked credentials fail. Its model/provider fixtures remain synthetic.
No real model allowance, cloud write, host configuration or active server was changed.


<a id="mcp-connection-ui-retained-failures-and-limitations"></a>

### Retained failures and limitations

- r1 build failed with `ENOSPC`. Four owned validation `.next/cache` directories were
  archived under `<private-validation>`;
  real data and concurrent work were preserved. The failed build is not a pass.
- r2 found actual horizontal overflow at320px/200%text. Grid minimum sizes, wrapping
  controls and the compact header were corrected without hiding overflow.
- The extended keyboard test found a partially clipped read-only field. A scoped,
  cancellable focus frame now reveals controls below the sticky header. The harness
  also distinguished native browser-chrome focus (`document.hasFocus() === false`)
  and the dialog container from background-page controls; full visibility remains
  required for every focused page control. Earlier failed logs/probes are retained.
- The design kit's separate self-test returned `12/52 checks passed = 23%`, exit1,
  including its missing Playwright dependency and kit fixture/hook failures. This is
  not a Launchlane score; installed product Chromium/axe checks above passed.
- This is local UI/application/SDK evidence, not installation acceptance of all three
  external hosts, live public-account connectivity, a complete domain/HTTP/sandbox
  aggregate or a deployment of the current online product. The file flow still has
  no durable grant inventory/token recovery after closing its dialog. Existing
  session logout revokes child access. Manual third-party configuration remains a
  documented step; the UI does not fabricate a connected state.

Private before/after screenshots, per-state reports, manifests and actual logs are in
`<private-validation>`. Only topical product/source/test/docs
changes belong in the commit. Shared documentation contains other ongoing work;
staging must include only this slice's own hunks.

<a id="mcp-hosted-independent-20261025"></a>

## اتصال MCP به HTTPS و آزمون مستقل — ۲۰۲۶-۱۰-۲۵

این برش با درخواست مالک برای تکمیل پیاده‌سازی و آزمون مستقل انجام شد. ورود به حساب شخصی، استقرار عمومی، تغییر بودجه، staging، commit و push انجام نشد. پایهٔ Git برابر `6937dfc9a6be4f53a134b55175a53d22512dcf29` است؛ نتیجه مربوط به working tree ثبت‌شده در این گزارش است، نه HEAD به‌تنهایی. تغییرهای قبلی hosting حفظ شدند.


<a id="mcp-hosted-independent-20261025-مسئله-و-تغییر"></a>

### مسئله و تغییر

- قرارداد فایل و پنجرهٔ MCP فقط HTTP محلی را می‌پذیرفتند؛ در نتیجه مسیر حساب وب عمومی قابل تکمیل نبود. اکنون HTTPS با دامنهٔ دقیق و مستقل از فایل دانلودشده پذیرفته می‌شود. HTTP همچنان محدود به loopback است؛ مسیر `/api/mcp`، نبود userinfo/query/fragment و انقضا/scope بررسی می‌شوند.
- setup گزینهٔ `--origin` دارد. واردکردن فایل مرورگر با این گزینه به `.env.local` یا credential محلی وابسته نیست. پیش از ذخیره، TLS، نام سرور، `launchlane_context` و scope واقعی بررسی می‌شوند. فایل موجود overwrite نمی‌شود؛ scope خواندن را نمی‌توان با `--missions` افزایش داد. ورود operator فقط به HTTP محلی ممکن است.
- سه snippet برای Codex، Claude Code و OpenCode با مسیر مطلق Node/bridge/access file و origin ثابت تولید می‌شوند. token در snippet یا خروجی CLI نیست و هیچ config کاربر ویرایش نمی‌شود. شکل آن‌ها با مستند رسمی میزبان‌ها تطبیق داده شده است؛ این به‌تنهایی آزمون runtime سه میزبان نیست.
- `process.exit(0)` پس از واردکردن فایل حذف شد. bridge نیز upstream/stdio را به‌شکل یک‌بارمصرف می‌بندد و خروج اجباری ندارد؛ خطاهای SDK به‌صورت خام وارد transcript نمی‌شوند. timeout ابزار، signal و پاسخ انقضا/لغو حفظ می‌شوند؛ bridge هیچ Store، worker یا credential سرویس مستقلی ندارد.
- reply موفق MCP علاوه بر متن JSON، `structuredContent` یکسان دارد. registry، scope، مأموریت، بودجه و اختیار انتشار همان application وب هستند؛ approve/execute جدیدی در MCP اضافه نشده است.
- در همان پنجرهٔ موجود و بدون تغییر CSS، صدور روی HTTPS و لغو همان فایل فعال شد. API لغو برای دسترسی ناموجود/منقضی/ازقبل‌لغوشده، `MCP_ACCESS_NOT_FOUND/404` می‌دهد؛ احراز هویت خود درخواست همچنان مستقل است. رابط در این حالت نشست معتبر را قطع نمی‌کند.


<a id="mcp-hosted-independent-20261025-هویت-نسخه-سنجیدهشده"></a>

### هویت نسخهٔ سنجیده‌شده

نسخهٔ plain export مستقل در `<private-isolated-export>` ساخته شد؛ branch یا Git worktree نیست. `.env.local`، state، ledger، آرشیوهای خصوصی و Git وارد snapshot نشدند. وابستگی‌های نصب‌شده کپی شدند؛ دانلود یا تغییر lockfile انجام نشد.

Build ID نهایی `s_u4vkof8dQ1eNBPH0-e4` است. hashهای SHA-256 دوازده فایل کد/آزمون این برش در نسخهٔ آزمون و working tree یکسان‌اند؛ digest فهرست `path:hash` برابر `6dacc6db69984f11a59b7a8a727c459b45f6916e6419fec1e66808979fcb1ad8` است. manifest و logهای موفق و ناموفق در مسیر خصوصی `.local/mcp-20261025/` نگه‌داری شدند؛ دادهٔ credential در Git نیست.


<a id="mcp-hosted-independent-20261025-اعتبارسنجی-نهایی"></a>

### اعتبارسنجی نهایی

| فرمان یا اجرا | نتیجه و معنای شاهد |
| --- | --- |
| `npm run build` | موفق؛ Next16.4.2/Turbopack و TypeScript؛ ده warning مربوط به filesystem tracing در `github/import.ts` باقی است |
| `npm run typecheck` | موفق روی build نهایی مستقل |
| Biome lint دوازده فایل تغییرکردهٔ کد/آزمون | موفق، بدون خطا؛ full lint کل مخزن در این برش ادعا نمی‌شود |
| `node --test tests/domain/mcp-access-file.test.ts tests/domain/mcp.test.ts tests/domain/mcp-connections.test.ts` | ۱۱pass، صفرfail/skip؛ فایل، signature/session/scope، actor، revocation و allowance مشترک |
| `node --test --test-concurrency=1 tests/http/mcp.test.mjs tests/http/mcp-hosted.test.mjs` | ۱۴pass شامل دو parent و دوازده subtest، صفرfail/skip؛ production application و SQLite واقعی، provider/model مصنوعی |
| `npm run smoke:mcp:codex` | Codex نصب‌شدهٔ `0.163.0-alpha.11.2`، app-server/stdio واقعی و snippet تولیدشده؛ discovery ده ابزار و سه tool call، شامل رد ابزار خارج scope؛ بدون `turn/start`، model یا cloud write؛ cleanup تأیید شد |

HTTPS با reverse proxy آزمایشی loopback، گواهی موقت SAN معتبر و ورود Liara مصنوعی اجرا شد. SDK و CLI از CA صریح استفاده کردند؛ اعتبارسنجی TLS خاموش نشد. Chromium فقط SPKI همان گواهی آزمایشی را پذیرفت. آزمون گواهی نامعتبر نیز import را رد کرد؛ این fixture شاهد HTTPS دامنهٔ عمومی نیست.

آزمون HTTP/HTTPS موارد زیر را واقعاً اجرا کرد:

- مذاکرهٔ SDK، ابزار واقعی، برابری reply متنی/ساخت‌یافته و رد permission بالاتر؛ HTTP version/body limit/request ID و Origin نامجاز نیز از suite قبلی حفظ شدند.
- سه import مستقل CLI با code0 و خروج طبیعی، فایل با فاصله در نام، config بدون token، عدم overwrite، رد origin دیگر، scope بالاتر و گواهی نامعتبر.
- رد bridge بدون origin ثابت HTTPS و با فایل منقضی؛ پایان عادی روی EOF، فراخوانی ابزار، لغو سمت سرور و دریافت `AUTH_REQUIRED` بدون افشای token.
- صدور، دانلود و لغو از UI واقعی Chromium؛ فایل متعلق به HTTPS همان نصب و scope انتخاب‌شده بود. token در DOM، localStorage یا sessionStorage نبود.
- عرض‌های۳۲۰/۱۲۸۰، صفر overflow صفحه و صفر نقض axe در dialog مورد سنجش؛ Escape، بازگشت فوکوس به دکمهٔ MCP و صفر pageerror. تصویر هر دو عرض بازبینی شد؛ این عددها فقط به همان حالات مربوط‌اند.
- لغو دوبارهٔ grant و وضعیت stale در UI بدون خروج از نشست معتبر؛ درخواست privileged بعدی همچنان200 و token لغوشده401 بود.
- redirect واقعی302 به مقصد آزمایشی؛ import شکست خورد و مقصد redirect هیچ درخواست دریافت نکرد. credential به مقصد بعدی فرستاده نشد.
- مأموریت مشترک وب/MCP، progress، reconnect/stdio، نداشتن مالک مدل دوم و باقی‌ماندن scope/بودجه در suite HTTP موجود.


<a id="mcp-hosted-independent-20261025-شکستها-و-اصلاح-harness"></a>

### شکست‌ها و اصلاح harness

ساخت نخست با junction وابستگی‌ها بین دو درایو با خطای resolution در Turbopack متوقف شد. کپی همان وابستگی‌های نصب‌شده به snapshot این محدودیت را رفع کرد؛ source یا تنظیم build برای پنهان‌کردن خطا تغییر نکرد.

اجرای اول HTTPS پیش از تماس با برنامه به مسیر پیش‌فرض خراب `openssl.cnf` سیستم برخورد کرد. config موقت مختص آزمون اضافه شد. اجرای بعدی با operator روی HTTPS، طبق policy موجود503 گرفت؛ fixture به authMode لیارا و exchange مصنوعی همان مسیر واقعی ورود تغییر کرد. policy production برای عبور آزمون ضعیف نشد. اصل این failureها در logها حفظ شده است.

سه import نهایی و خروج EOF bridge با موفقیت پایان یافتند و `UV_HANDLE_CLOSING` بازتولید نشد. این شاهدِ رفع رفتار مسیر آزموده‌شده پس از حذف خروج اجباری است؛ به‌تنهایی تحلیل علت native همهٔ خطاهای تاریخی ویندوز نیست.


<a id="mcp-hosted-independent-20261025-حدود-و-ادامه"></a>

### حدود و ادامه

نسخهٔ عمومی در این مرحله به‌روزرسانی نشد و نشست شخصی طبق انتخاب مالک استفاده نشد. پذیرش واقعی HTTPS عمومی با نشست حساب، runtime میزبان‌های Claude Code/OpenCode و turn مکالمه‌ای Codex همچنان UNCONFIRMED هستند. هر دو میزبان اخیر در PATH موجود نبودند؛ ابزار یا بسته‌ای برای آن‌ها نصب نشد. full domain/browser aggregate، همهٔ خانواده‌های لیارا، انتشار کامل ترب و connector اجرایی اصلاح از این برش نتیجه نمی‌شوند.

OAuth اختصاصی MCP، انتخاب source از MCP، incident goal مستقل، notification/task پیشرفته و پایش وضعیت میزبان با جدول `mcp_connections` در این برش پیاده نشده‌اند؛ آن جدول شاهد اتصال فعال نیست. web-to-coding-agent connector همچنان پذیرش جداگانهٔ AC26 دارد. A16/AC31 با این شواهد پیشرفت کرده‌اند و کامل اعلام نمی‌شوند.

فرمان اتصال عمومی و نگه‌داری credential در [راهنمای MCP](../mcp.md) است. گام بعد برای پذیرش عمومی: انتشار همین candidate از مسیر میزبانی موجود با حفظ state/ledger و بودجه، سپس grant از نشست واقعی و discovery/tool call میزبان روی همان دامنه. هیچ درخواست مدل واقعی، منبع پولی تازه یا نوشتن در ابر انجام نشد؛ allowance و ledger نصب اصلی تغییر نکردند.

<a id="mcp-public-release-20261025"></a>

## انتشار واقعی MCP روی دامنهٔ عمومی — ۲۰۲۶-۱۰-۲۵

طبق درخواست مستقیم مالک، اصلاحات MCP بدون commit، staging، push یا تغییر طراحی روی **&lt;deployment-origin&gt; فعال شدند. در04:57UTC، SDK و میزبان واقعی Codex روی همان دامنه و با فایل صادرشده از نشست واقعی کاربر بررسی شدند؛ این گزارش ادامهٔ [آزمون مستقل](access.md#mcp-hosted-independent-20261025) است.


<a id="mcp-public-release-20261025-نسخه-و-دامنه-تغییر"></a>

### نسخه و دامنهٔ تغییر

HEAD همچنان `6937dfc9a6be4f53a134b55175a53d22512dcf29` است. تغییرهای runtime نسبت به کد عمومی قبلی محدود به قرارداد فایل MCP، dialog موجود، پاسخ ساخت‌یافته و تفکیک خطای لغو grant از انقضای نشست‌اند. startup و نمونهٔ محصول، اصلاح hosting منتشرشدهٔ قبلی را حفظ کردند. CSS، public، lockfile، موتور انتشار و migrationها تغییر نکردند.

| هویت | مقدار |
| --- | --- |
| image قبلی | `sha256:a109b27fde37cfbf02b40b3ade96c17f2eddf052e4d39fff1ecb95f009423c6f` |
| image فعال | `sha256:8ed153b5b1c0ede4f4eec56ddbce675b31336fb2553d97fccabeb288a93b61f2` |
| Build ID فعال Linux | `7JRJo53Hmy4LFYYWf68L2` |
| digest manifest بایت‌های source،۲۴۷فایل | `88a8beef95e050d00dbb2cdd33649c762ebf804e933744154c1c936369905213` |
| SHA256 بستهٔ source | `243151ea198be9015f0702cbeafcaf808347dfc333d3c5203134ff57247f2337` |
| اندازهٔ archive | ۴۷۶٬۹۲۲بایت |

manifest، بسته، فرمان‌ها و logهای خصوصی در `.local/hosting-launchlane-20261023/mcp-*` و audit/backup سرور در `/root/launchlane-mcp-audit-20261025` نگه‌داری شدند. بسته allowlist است؛ credential، state، ledger، `.env` و probeهای آزمون در آن نیستند. label image به digest source مقید است؛ نداشتن commit به‌معنی نداشتن هویت artifact نیست.


<a id="mcp-public-release-20261025-ساخت-و-بررسی-پیش-از-rollout"></a>

### ساخت و بررسی پیش از rollout

ساخت نخست در `npm ci` به `ECONNRESET` شبکه رسید. همان کانتینر build متعلق به این اجرا متوقف شد؛ production در تمام این مرحله healthy ماند. لایهٔ نصب dependency از build قبلی همان سرور، `sha256:923a670ba2d151cb5b553469da8b0420c5fa78cf689d0ceb489b9dd5b66494f8`، استفاده شد. پیش از استفاده، hash کامل package/lock با source برابر و Node24.18.0، Next16.4.2 و TypeScript6.0.3 تطبیق داده شدند. سپس compile با `docker build --network none` و همان recipe runtime انجام شد؛ install تازه، تغییر dependency یا fallback به build ویندوز صورت نگرفت. hash recipe cache برابر `96738de42fbb600420a8bc23aa01e2a97b84245a3f0237450cf2a9ee7ce16bdf` است.

همین image Linux ابتدا در کانتینر جدا، با `network none`، state/secret جدا و hook ورود مصنوعی سنجیده شد. initialize، discovery ده ابزار متناسب با gates خاموش آن محیط، reply ساخت‌یافته، scope خواندن، revoke، revoke تکراری404، token لغوشده401 و معتبرماندن نشست وب200 گذشتند. کانتینر آزمون متوقف شد؛ hook یا state آن به production منتقل نشدند.

دو خطای harness پیش از این pass حفظ شدند: fetch محلی Host دلخواه را منتقل نکرد و403 گرفت؛ transport آزمون به `node:http` با Host صحیح تبدیل شد. سپس DELETE بدون Content-Length بدنه را حمل نکرد و400 گرفت؛ طول واقعی بدنه اضافه شد. policy و oracle محصول برای عبور این موارد تغییر نکردند.


<a id="mcp-public-release-20261025-حفظ-داده-ledger-و-اختیار-مصرف"></a>

### حفظ داده، ledger و اختیار مصرف

پیش از rollout نبود action/run/job/execution فعال یا نامعلوم بررسی شد. با API backup خود SQLite از state و ledger سازگار نسخهٔ خصوصی گرفته شد. claim یک‌بارمصرف با image/digest/دامنه، دستور مالک، expiry و صفر منبع پولی تازه پیش از تعویض image در journal ثبت شد. فقط سرویس web با همان compose/runtime جایگزین شد؛ مسیر rollback تنها image قبلی را برمی‌گرداند و DB را reset نمی‌کند.

بعد از rollout و دوباره بعد از تمام آزمون‌های عمومی و لغو grant:

- تمام رکوردهای هر۲۸جدول `state.sqlite` با backup برابر بودند؛ `quick_check=ok`.
- تمام رکوردهای هر۵جدول ledger برابر ماندند؛ جدول calls همان۴۴۸رکورد و reserveها همان۳رکورد را داشت؛ `quick_check=ok`.
- mount اصلی `/var/lib/launchlane`، کلید نشست و runtime config ثابت ماندند. hash config `645147da6d4807b56fcab6c716367f25df99636a737df483e99047b4b0091700` تغییر نکرد. proxy همان image قبل بود؛ هیچ fixture در `NODE_OPTIONS` production نبود.
- ledger همان authorized=`2`، calls ceiling=`0.8904`، reserves=`0.9096` و remaining≈`0.20`دلار را گزارش کرد. هیچ allowance، partition، reserve یا درخواست مدل تازه ایجاد نشد.
- web جدید healthy، restart0 و OOM=false بود. هیچ منبع زیرساختی تازه یا تغییر پلن ایجاد نشد.


<a id="mcp-public-release-20261025-آزمون-واقعی-روی-دامنه-عمومی"></a>

### آزمون واقعی روی دامنهٔ عمومی

کاربر شخصاً در مرورگر وارد لیارا شد؛ رمز یا کد در گفتگو یا script قرار نگرفت. نشست پس از تعویض web و reload باقی ماند. با تأیید صریح کاربر، از UI موجود grant **فقط‌خواندنی** صادر، دانلود و با setup روی رایانهٔ محلی تأیید شد. عمر grant به نشست والد و حداکثر یک ساعت مقید بود؛ mission permission نداشت.

| بررسی | نتیجهٔ مشاهده‌شده |
| --- | --- |
| HTTPS صفحه و assetها | root200 و هر۹asset عمومی200؛ hash بایت‌های CSS/فونت‌های حاضر در entry با قبل برابر |
| صدور و import واقعی | فایل متعلق به همین origin؛ نام سرور و scope واقعی با SDK بررسی شد؛ setup با exit0 و سه snippet بدون token پایان یافت |
| SDK رسمی HTTP روی public | initialize/discovery سیزده ابزار، `launchlane_context` موفق، برابری متن و `structuredContent` |
| scope و Origin | `launchlane_publish` با grant خواندن `TOOL_DENIED`؛ Origin خارجی403 |
| reconnect | اتصال تازه و خواندن وضعیت موجود؛ run=null/events=[] مطابق نبودن مأموریت در همان حساب؛ اجرای تازه‌ای آغاز نشد |
| bridge واقعی stdio به public | فراخوانی context موفق؛ خروج بدون افشای token |
| Codex واقعی | `codex-cli 0.163.0-alpha.11.2`، app-server/stdio با home موقت و config تولیدشده؛ سیزده ابزار و سه call واقعی context/publish-denied/mission موفق |
| مدل و write آزمون | هیچ `turn/start`، درخواست مدل یا mutation زیرساختی آغاز نشد؛ برابری ledger نیز این مرز را تأیید کرد |
| لغو | همان grant از UI لغو و درخواست بعدی با همان token روی public برابر401 شد؛ UI نشست والد را نگه داشت |
| دسترسی ناشناس | workspace بدون session401 ماند |

اجرای اول میزبان در پاک‌سازی home موقت ویندوز با EBUSY مواجه شد. cwd میزبان آزمون از home موقت جدا و انتظار cleanup اصلاح شد؛ بازاجرای کامل SDK/stdio/Codex موفق شد و هر دو home موقت پاک شدند. این خطای harness به‌عنوان شکست deployment یا موفقیت نادیده‌گرفته‌شده ثبت نشده است. config اصلی کاربر تغییر نکرد.


<a id="mcp-public-release-20261025-حدود-پذیرش"></a>

### حدود پذیرش

این شاهد، اتصال واقعی MCP خواندنی روی public با حساب و Codex واقعی، HTTPS، policy و revocation را می‌بندد. شروع مأموریت پولی، انتشار پروژهٔ تازه، repair از connector اجرایی، turn مکالمه‌ای Codex و runtime واقعی Claude Code/OpenCode در این rollout آزموده نشدند. شواهد قبلی publication و آزمون مستقل جای همین مرزها را نمی‌گیرند؛ پذیرش کلی A16/AC31 و ماتریس همهٔ خانواده‌ها همچنان گسترده‌تر است.

فایل آزمایشی دانلودشده و snippetهای آن اکنون به grant لغوشده اشاره می‌کنند. برای استفادهٔ عادی باید از «حساب‌ها ← اتصال MCP» دسترسی تازه با scope دلخواه ساخت و طبق [راهنما](../mcp.md) وارد کرد؛ هیچ credential دائمی یا تمدید بودجه ایجاد نشده است.

<a id="mcp-shared-application"></a>

## MCP و application مشترک؛ ۲۰۲۶-۱۰-۲۳

به‌روزرسانی `fb67971`: [Codex واقعی از ثبت مأموریت تا نتیجه زنده](agent.md#codex-publication-mission) با stdio→HTTP مشترک، تصمیم‌های وب، reconnect و replay پس از descendant اجرا شد. harness از RPC ابزار میزبان استفاده کرد و turn مکالمه‌ای مدل Codex نداشت؛ worker اصلاح همان داخلی است. این شاهد جدید، محدودیت تاریخی «فقط discovery/سه call» را برای همین میزبان و مأموریت تکمیل می‌کند، نه Claude/OpenCode یا connector اجرایی.

وضعیت A16/AC31: partial. این برش یک مسیر واقعی HTTP و stdio را به application موجود متصل می‌کند؛ پذیرش کل MCP، connector اجرایی یا مأموریت کامل Launchlane نیست.


<a id="mcp-shared-application-revision-و-configuration"></a>

### revision و configuration

پایه6ae5c383f536b6c839c034281997b7d83baaa9e4، Node24.18.0، Next16.4.2 و SDK رسمی client/server2.3.1. کپی ثابت زیر `.local/mcp-mission/candidate-01` از Git export شد؛ فقط backend/route/تست/bridge این برش و lockfile افزوده شدند. UI، source picker و فایل‌های هم‌زمان همکار وارد آن نشدند. build و server اصلی، credential/config، VPN و SQLite نصب اصلی تغییر نکردند. بررسی حساب اصلی فقط با SQLite readOnly و دو GET محدود انجام شد؛ Store/recovery آن نصب فراخوانی نشد.


<a id="mcp-shared-application-oracle-پیش-از-اجرا"></a>

### oracle پیش از اجرا

از همان پروژه انتخاب‌شده، inspect واقعی برگردد؛ secret یا مسیر بیرون manifest رد شود. یک publication از MCP در وب همان ID، source، معیار، state و receipt را داشته باشد. duplicate، disconnect و reconnect مدل/write تازه نسازند. grant خواندن نتواند mission، repair یا approval ایجاد کند. actor دیگر، Host/Origin نامعتبر، token خراب/منقضی/لغوشده و protocol ناسازگار رد شوند. stdio فقط protocol بنویسد و process آن Store مستقل باز نکند. برای Codex، discovery تنها کافی نیست: tool call واقعی و رد scope به application مشترک لازم است. هیچ turn مدل، cloud write یا worker dispatch در این oracle نیست.


<a id="mcp-shared-application-نتایج"></a>

### نتایج

| اجرا | نتیجه و مرز |
| --- | --- |
| build | تولیدی Turbopack موفق؛ مسیرهای `/api/mcp` و `/api/mcp/access` ساخته شدند؛ warning انتخاب workspace root در export تو‌در‌تو ثبت شد |
| typecheck | فرمان واقعی `npm run typecheck` روی همان کپی موفق؛ root `tsc --noEmit --incremental false` نیز موفق بود |
| lint | فایل‌های جدید9/9 بدون خطا؛ lint کل tree ترکیبی صفر error،34warning و9info داشت که شامل CSS هم‌زمان است؛ این نتیجه امتیاز UI نیست |
| domain اول | با هم‌زمانی پیش‌فرض308/310؛ دو deadline در caseهای قبلی optional chat/project-build تمام شدند؛ failure محفوظ است |
| domain کنترل‌شده | همان310تست با `node --test --test-concurrency=2 tests/domain/*.test.ts`،310/310 و صفر fail/skip؛ oracle یا deadline محصول تغییر نکرد |
| HTTP نهایی | `node --test tests/http/*.test.mjs`،37/37 و صفر fail/skip روی همان build؛ مدل/provider مصنوعی، HTTP و SQLite واقعی |
| MCP اختصاصی |8/8؛ HTTP+stdio واقعی SDK، request/result ID، header نسخه ناسازگار400، body بزرگ413، خواندن source، deny، mission مشترک، reconnect بدون مدل تازه، revoke و logout |
| browser | فرمان کامل هفت suite روی همان UI ثابت:75/27/27/22/38/5/39حالت؛ صفر pageerror و درخواست خارجی گزارش‌شده. مدل/cloud مصنوعی‌اند و طراحی ثبت‌نشده همکار از این اعداد پذیرش نمی‌گیرد |
| Codex واقعی |CLI0.163.0-alpha.11، app-server با home جدید و session ephemeral؛۱۰tool کشف و۳call واقعی context/denied publication/mission replay اجرا شدند. application مشترک و رد scope سنجیده شد؛ model0/cloud-write0؛ cleanup اجرای نهایی تأیید شد |
| حساب Liara |هویت/تیم و فهرست app واقعاً200؛ تیم مجاز تطبیق داشت و app count0 بود. این خواندن availability همه runtimeها، قیمت نهایی یا provisioning نیست |

سه regression domain به‌طور مشخص امضای audience، parent/child session و scope؛ دسترسی source/deny بدون side effect؛ و join/CAS/budget را می‌سنجند. قالب toolها از registry اصلی می‌آید؛ مسیر MCP نه اجرای shell دارد و نه مسیر approve/execute. token اپراتور یا provider در payloadهای عمومی نیست.

برای تکرار مرز میزبان، `npm run smoke:mcp:codex` ساخته شده است؛ فقط executable نصب‌شده را اجرا می‌کند، config/user home موجود را نمی‌خواند و هیچ `turn/start` نمی‌فرستد. خروجی `executableRepairTested:false` صریح است. CLIهای Claude Code و OpenCode در PATH و مسیرهای معمول بررسی‌شده یافت نشدند؛ این مشاهده به معنی اثبات نبودن آن‌ها در تمام دیسک نیست و اتصال زنده‌شان UNCONFIRMED است.


<a id="mcp-shared-application-شکستهای-حفظشده"></a>

### شکست‌های حفظ‌شده

- HTTP نخست5/7 بود؛ harness مسیر fixture را `directory` فرض کرده بود، در حالی که runner واقعی `workspace` عرضه می‌کند. assertion reconnect حذف نشد؛ مسیر با API واقعی runner اصلاح و سپس stdio گذشت.
- assertion تازه raw HTTP ابتدا پاسخ SSE را JSON فرض کرد. MCP هر دو framing را مجاز می‌داند؛ decoder تست content-type و data frame واقعی را می‌خواند و همان request ID را بررسی می‌کند. SDK client پیش‌تر SSE را درست می‌خواند؛ این شکستِ harness بود.
- Codex در دو spike نخست، discovery و calls را گذراند ولی cleanup Windows یک بار EBUSY و بار دیگر انتظار دوباره برای exit فرایندِ ازقبل‌بسته داشت. smoke نهایی EOF/exit/signal و cleanup همان fixture را اصلاح کرد و exit0 شد. پاک‌سازی دستی دو پوشهٔ قدیمی با `blocked by policy` رد شد؛ روش دیگری برای حذف همان‌ها اجرا نشد و آن دو مسیر در گزارش خصوصی باقی‌اند.
- دو خطای توسعهٔ نوع/لینت، تطبیق schema SDK و throw داخل finally بودند؛ schema با interface رسمی Standard Schema validate و cleanup در تابع خودش قرار گرفت. هیچ assertion/type برای دورزدن validation اضافه نشد.

logها در `.local/mcp-mission/`، با نام‌های `build-01.log`، `domain-01.log`، `domain-02.log`، `http-mcp-01.log` تا `05`، `http-all-final.log`، `typecheck-final.log`، `browser-final.log` و `codex-smoke-01.log` نگه‌داری می‌شوند؛ credential یا fixture خصوصی وارد Git نشده است. دفتر مصرف قبلی readOnly بررسی شد؛ سقف قبلی و allowance فاز پیشین reset نشدند. این برش مدل0، cloud-write0 و صرفاً دو GET واقعی حساب داشته است.


<a id="mcp-shared-application-اولین-مرزهای-باز"></a>

### اولین مرزهای باز

مأموریت طولانی به همان run/event/cursor متصل است، اما چرخه استقرار cloud از خود میزبان، decision continuation میان نشست‌های MCP/وب، انتخاب منبع از MCP، incident goal مستقل، notifications/tasks اختیاری و دو میزبان دیگر هنوز پذیرش جدا می‌خواهند. repair پیشنهادیِ نشست دیگری از همان مسیر review امن موجود عبور می‌کند؛ authority نشست گذشته به میزبان منتقل نمی‌شود.

چهار انتخاب Coding Agent، dispatch واقعی Codex/Claude/OpenCode، pairing سرویس اجرایی، reconciliation job نامعلوم و fallback broker هنوز implementation جدا می‌خواهند. worker داخلی Node/Python همان شواهد قبلی خودش را دارد؛ این تست‌ها شاهد اجرای تازهٔ آن یا fallback بیرونی نیستند. برنامه چندمرحله‌ای و پوشش همه runtimeها نیز از MCP نتیجه نمی‌شوند. [ماتریس capability](../platform-support.md)، [راهنمای تکرار](../mcp.md) و [ADR0017](../decisions/access.md#0017-shared-mcp-facade) این حدود را حفظ می‌کنند.


<a id="mcp-shared-application-تثبیت-روی-candidate-ترکیبی-پس-از-b59eef9"></a>

### تثبیت روی candidate ترکیبی پس از b59eef9

candidate تازه از b59eef9 ساخته شد؛ UI ثبت‌شده در6e54988 و parser مشترک publication را دارد. فقط fix زیر در server و regression آن افزوده شد. همه نتایج این بخش روی همین source ثابت‌اند؛ خروجی پایه قبلی با آن جمع نشده است.

بازبینی یک نقص بودجه یافت: read مستقیم MCP در هر درخواست RunBudget تازه می‌ساخت و allowance مأموریت متوقف‌شده را مصرف نمی‌کرد. اکنون مالک queued/working جلوی read موازی را می‌گیرد؛ مأموریت انتشار متوقف‌شده، شمارنده و زمان همان run را با reserve پیش از ابزار و CAS حفظ می‌کند. خواندن state/events مجانی و بدون مدل باقی است. regression نخست مسابقه دو read با یک سهم،0/1 شد: درخواست بازنده پس از شکست reserve نیز revision را تغییر می‌داد و نتیجه رقیب معتبر را نامعتبر می‌کرد. persist فقط پس از reserve موفق، علت را رفع کرد؛ دو read اکنون دقیقاً یک موفق و یک BUDGET_EXHAUSTED دارند، model allowance تمدید نمی‌شود و attempts صفر است. failure قبل از fix نگه‌داری شد.

اختلاف schema publication نیز جدا درb59eef9 رفع شد: همان schema قرارداد وب حد۲۴۰نویسه را عرضه می‌کند؛۲۴۰پذیرفته و۲۴۱بدون ساخت run رد می‌شود. تست یا deadline محصول برای پاس‌شدن تضعیف نشد. فرمان رسمی domain با `--test-concurrency=2` زمان‌بندی ثابت دارد؛ دو timeout با هم‌زمانی پیش‌فرضِ اجرای قبلی محفوظ‌اند. گذر همان تست‌ها با هم‌زمانی۲ با contention سازگار است، اما علت دقیق سخت‌افزاری اندازه‌گیری نشده است.

| بررسی تازه | نتیجه و حدود |
| --- | --- |
| نصب مستقل | `npm ci --offline --no-audit --no-fund` در export مستقل با node_modules واقعی،۶۱package نصب و exit0؛ lock همان commit است. این فقط نصب dependency است، نه پذیرش کل محصول از نصب تازه |
| build/typecheck/lint | فرمان‌های واقعی build و typecheck موفق؛ lint کل candidate صفرerror،۳۴warning و۹info. warningهای موجود UI حفظ‌اند |
| domain | فرمان واقعی `npm run test:domain`،۳۱۱/۳۱۱،صفرfail/skip؛ چهار regression اختصاصی MCP نیز۴/۴ |
| HTTP | `npm run test:http`،۳۷/۳۷،صفرfail/skip؛ transport/SQLite واقعی، مدل و cloud مصنوعی |
| browser | فرمان کامل `npm run test:browser`: هفت suite اصلی۷۵/۲۷/۲۷/۲۲/۳۸/۵/۴۳؛ سپس دو case انتخاب بومی پوشه در۳۶۰/۱۲۸۰ و۱۲case حرکت/تعامل. صفرpageerror و درخواست خارجی گزارش‌شده؛ بدون ادعای امتیاز UX یا کاربر تازه |
| sandbox | `npm run test:sandbox`: baseline fail→fix با Node22 واقعی،۵بررسی isolation و حذف۲container؛ سپس۹/۹شامل رد patch غلط، env محدود، build بومی tmpfs و Python آفلاین/رد wheel خراب/asset ناقص. مدل مصنوعی و cloud-write0 |
| locked build | `npm run test:build-sandbox`: دو case سالم/شکسته، npm ci/build/test/start/GET واقعی آفلاین با content cache معتبر؛ source اصلی محفوظ و artifact آزموده‌شده انتخاب شد. case env نیز۱/۱؛ هیچ image/package از شبکه دریافت نشد |
| setup | bootstrap۲/۲ و setup واقعی grant خواندن/مأموریت، رد overwrite و مسیر بیرون `.local`، token معتبر HTTP و نبودن token در stdout؛ config میزبان کاربر تغییر نکرد |
| Codex | `npm run smoke:mcp:codex` روی build تازه: discovery۱۰tool و۳call واقعی، scopeDenied/sharedApplication درست، model0/cloud-write0/executableRepairTested=false، cleanup verified |

logهای این candidate در `.local/mcp-mission/` با نام‌های `budget-final-build.log`، `budget-final-typecheck.log`، `combined-lint.log`، `domain-command-final.log`، `budget-final-http.log`، `combined-browser-final.log`، `final-sandbox.log`، `locked-build-final.log`، `final-codex-smoke.log` و `clean-install.log` هستند. `budget-race-before.log` شکست اولیه را حفظ می‌کند. این برش استقرار تازه لیارا یا اصلاح با مدل واقعی ندارد؛ شواهد تاریخی Node/Python همچنان محدود به همان اجراها هستند.


<a id="mcp-shared-application-لغو-اختیار-در-مأموریت-پسزمینه-پس-از7196471"></a>

### لغو اختیار در مأموریت پس‌زمینه؛ پس از7196471

بررسی دقیق‌تر نشان داد parent session در HTTP معتبرسنجی می‌شد، اما run صف‌شده فقط child session را می‌سنجید. regression روی source پیش از fix، با transport مصنوعی، پس از revoke والد یک درخواست مدل ساخت؛ oracle صفر بود و۱≠۰ثبت شد. counterexample در `auth-before.log` و source ثابت همان کپی نگه‌داری شد؛ هیچ درخواست مدل واقعی/هزینه/نوشتن ابری در بازتولید نبود.

McpAccess خصوصی اکنون شناسه والد معتبر را به همان loop می‌دهد. session policy مشترک، پیش از source/secret read، شروع، مصرف و پذیرش پاسخ، والد و فرزند را بررسی می‌کند. تست دو حالت revoke پیش از dispatch و هنگام پاسخ را می‌سنجد: اولی مدل۰، دومی دقیقاً۱ارسال مصنوعیِ آغازشده با مصرف محفوظ و پاسخ دیررسِ ردشده؛ attempts۰، run=failed/AUTH_REQUIRED و بدون artifact/approval تازه. actor مجاز دیگری نیز با نشست مستقل همچنان AGENT_NOT_FOUND می‌گیرد؛ oracle جداسازی actor حفظ شد.

برای این برش snapshot مستقل `.local/mcp-mission/auth-index-candidate` از index ساخته شد. source پایه7196471 و UI ثبت‌شده6e54988است؛ working tree جدید UI، package/runnerهای همکار و config نصب اصلی وارد آن نشدند. نتایج315domain/251browser در گزارش والد به همان commit تعلق دارند و با بررسی‌های این اصلاح به‌عنوان یک full pass تازه جمع نمی‌شوند. [قرارداد](../decisions/access.md#0017-shared-mcp-facade) محدودیت درخواست درحال‌پرواز و حفظ مصرف را توضیح می‌دهد.

اجرای نخست این اصلاح312/316بود: سه fixture پیش از ورود به منطق محصول به مهلت۳ثانیه‌ای archive خوردند؛ یک failure واقعی نیز recovery مقصد بود. کنترل کامل context در ابتدای loop، مقصد verified اما هنوز adoptنشده را زود رد می‌کرد. فقط کنترل authorization به ابتدای کار منتقل شد؛ adopt همان هویت از receipt موجود، پیش از تطبیق context، حفظ شد. آزمون crash/adoption تغییر نکرد و همراه MCP/Agent،۱۷/۱۷گذشت. patch نخست و failure کامل در `auth-initial.patch` و `auth-index-domain.log` محفوظ‌اند.

هم‌زمانی فایل‌های فرمان domain از۲به۱محدود شد؛ هیچ deadline، assertion، skip یا oracle محصول تغییر نکرد و raceهای درون case همچنان هم‌زمان اجرا می‌شوند. این انتخاب، زمان‌بندی محافظه‌کارانهٔ suite در محیط دارای کار هم‌زمان است؛ root cause دقیق فشار CPU/disk اندازه‌گیری نشده است. source نهایی دوباره در همان کپی آماده و در تمام بررسی‌های نهایی ثابت ماند.۲۶۵فایل با index تطبیق داشتند؛ fingerprint نهایی `4746f331a1c1f1465e2da5e9a9d0e93853336747678bd30245391eca7e0e08ab` است و identity جدا در `auth-index-identity.json` ثبت شد.

| بررسی نهایی این اصلاح | نتیجه و مرز |
| --- | --- |
| build/typecheck/lint | دو فرمان اول موفق؛ lint۲۶۳فایل،صفرerror و۳۴warning/۹info موجود |
| domain کامل | فرمان واقعی `npm run test:domain` با هم‌زمانی فایل۱،۳۱۶/۳۱۶،صفرfail/skip؛ شامل recovery مقصد و۵regression MCP |
| HTTP کامل | `npm run test:http`،۳۷/۳۷،صفرfail/skip |
| container مرتبط | `node --test tests/sandbox/agent-repair.test.ts`،۴/۴با Node22 واقعی، model مصنوعی، patch غلط مسدود و source اصلی محفوظ؛ این۴case جای اجرای تازه کل۹case نیست |
| guided browser مرتبط |۳۸حالت در۳۲۰/۳۶۰/۳۹۰/۷۶۸/۱۲۸۰؛ مرورگر واقعی، مدل/cloud مصنوعی؛ این خروجی full browser تازه۲۵۱حالت نیست |
| Codex واقعی | smoke رسمی همین برش، CLI0.163.0-alpha.11،discovery۱۰tool و۳call واقعی، رد scope و application مشترک؛ model0/cloud0/executableRepairTested=false و cleanup verified |

logها `auth-final-{build,typecheck,lint,domain,http,sandbox,guided,codex}.log` هستند. هیچ model/provider زنده، app، release یا database در این اصلاح ساخته یا تغییر نکرد. مجوز برنامه چندمرحله‌ای، تبار کامل artifact مشتق، connector اجرایی و همه پلتفرم‌ها هنوز پذیرش باز دارند.


<a id="mcp-shared-application-تطبیق-ترکیب-با-ui-ثبتشده-در560cc68"></a>

### تطبیق ترکیب با UI ثبت‌شده در560cc68

همکار، UI و runner موبایل را جدا در560cc68ثبت کرد؛ هیچ hunk آن در commit backend stage نشد. کپی تازهٔ `.local/mcp-mission/combined-final` از index جاری شامل همان UI و اصلاح authorization ساخته شد.۲۷۰فایل runtime با index مطابق بودند؛ fingerprint `d46be52d8167deb5ca045e46acbf796f59e2286441c1d10505a757520780ee54` در `combined-final-identity.json` ثبت است. build و typecheck موفق؛ lint۲۶۶فایل صفرerror/۳۶warning/۹info موجود؛ HTTP۳۷/۳۷؛ guided۳۸حالت و `npm run test:mobile`۱۰حالت با صفرpageerror/external request گزارش‌شده، فونت واقعی Geist و shimmer پیش‌فرض گذشتند. logها `combined-final-{build,typecheck,lint,http,guided,mobile}.log` هستند.

روی این ترکیب، کل domain/sandbox/browser دوباره اجرا نشد؛ نتایج۳۱۶/۴/۳۸/Codex۳و نتایج قدیمی‌تر۹/۲۵۱در snapshotهای قبلی خودشان باقی می‌مانند. این بررسی هدف‌دار، پذیرش کامل محصول، همه UI یا دستگاه فیزیکی نیست. source/runtime جدید پس از شروع این بررسی تغییر نکرد و code/state اصلی برای تست بازراه‌اندازی نشد.
