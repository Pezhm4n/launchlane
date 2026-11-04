# Runtime — architecture decisions

[Documentation](../README.md) · [Current support](../platform-support.md) · [Verification index](../verification.md)

These versioned records preserve the original decisions, source revisions, failures and evidence limits. Dates and passing counts apply only to the named snapshot, not the current release. Installation-specific locations and identities are omitted.

## Records

- [ADR 0001 — worker محدود برای اصلاح کد](#0001-scoped-repair-worker)
- [0004 — قرارداد جدا برای آماده‌سازی فرمان Node](#0004-reviewed-node-preparation)
- [0005 — استخراج پورت از binding ثابت به‌جای تطبیق متن](#0005-static-port-bindings)
- [0011 — حفظ worker و افزودن اجرای محدود container](#0011-container-worker)
- [0012 — نصب قفل‌شده و بررسی build/start در همان worker](#0012-locked-project-build)
- [ADR 0013: مقدارهای محیطی با مرجع رمز‌شده و تصمیم مستقل](#0013-project-environment)
- [ADR 0014: اتصال همان env به ساخت، انتشار و بررسی پاسخ](#0014-build-environment-binding)
- [ADR 0015: انتشار بومی Python و worker ایزوله با wheel قفل‌شده](#0015-python-publication-worker)
- [ADR0026 — محیط ساخت Node24 با همان اختیار و worker](#0026-node24-isolated-build)
- [ADR0027 — Next بومی با worker و policy مشترک](#0027-native-next-publication)
- [ADR0028 — native frontend build, bounded Node20 and environment discovery](#0028-native-frontend-build)
- [ADR 0029 — Docker and compiled fullstack artifacts](#0029-docker-and-compiled-fullstack-publication)
- [ADR0045 — Source-bound pnpm workspace execution](#0045-source-bound-pnpm-workspaces)
- [ADR0047 — Exact compiled pnpm component artifacts](#0047-exact-compiled-pnpm-components)
- [ADR0048 — Flask/Django execution](#0048-framework-python-execution)
- [ADR0049 — Compiled Go through the existing publication path](#0049-exact-compiled-go-publication)
- [ADR0050 — Installed PHP/Laravel through the existing publication path](#0050-installed-php-and-laravel-artifacts)

<a id="0001-scoped-repair-worker"></a>

## ADR 0001 — worker محدود برای اصلاح کد

وضعیت: پذیرفته برای برش نخست A06؛ ۲۰۲۶-۱۰-۲۲.


<a id="0001-scoped-repair-worker-زمینه"></a>

### زمینه

محصول به اتصال اجرایی patch/test نیاز دارد و transport مجاز فعلی Chat Completions است. CLI نصب‌شده Codex `0.163.0-alpha.10.2` در spike واقعی، wire نوع chat را پیش از شبکه رد کرد. [مستند اجرای غیرتعاملی](https://developers.openai.com/codex/noninteractive/) و [مرجع config](https://developers.openai.com/codex/config-reference/) بررسی شدند. وجود CLI یا help، سازگاری اجرایی با provider فعلی را ثابت نمی‌کند. تغییر provider یا استفاده از حساب دیگری برای این برش انتخاب نشد.


<a id="0001-scoped-repair-worker-گزینهها-و-تصمیم"></a>

### گزینه‌ها و تصمیم

تعویق اصلاح تا فراهم‌شدن runtime دیگر، اولین مرز مهم محصول را باز می‌گذاشت. Markdown handoff نیز patch/test برگشتی ندارد. بنابراین یک worker محدود با همان provider پشت CodeRepairAdapter انتخاب شد: یک فراخوانی تولید replacements، validation مستقل host، اجرای آزمون موجود، artifact و receipt. مسئولیت انتخاب هدف/ابزار با Agent اصلی می‌ماند؛ worker مالک shell یا approval نیست.

این قرارداد عمداً فقط فایل موجود و آزمون مستقیم Node دارد. توسعه بی‌درنگ آن به npm/build/install، دامنه اجرای source را بسیار بزرگ می‌کرد و به سیاست command، dependency، شبکه و sandbox جدا نیاز داشت. محدودیت فعلی قابلیت عمومی Coding Agent یا محیط مهارشده خصمانه معرفی نمی‌شود.


<a id="0001-scoped-repair-worker-پیامدها-و-بازبینی"></a>

### پیامدها و بازبینی

مزیت، یک مسیر قابل آزمون با بودجه مشترک، base دقیق و same-test oracle است. هزینه، محدودبودن دامنه اصلاح و نبود OS/network isolation است. gate پیش‌فرض خاموش و scope/test پیش از اجرا قابل تصمیم‌اند. هر تغییر command/dependency یا افزودن runtime باید قرارداد و تست جدید داشته باشد. وقتی runtime رسمی با provider مجاز و isolation مناسب واقعاً آزموده شود، می‌تواند همین adapter را جایگزین کند؛ UI و policy نباید موتور دوم بسازند. راه کار سیستم در ARCHITECTURE و شواهد اجرا در گزارش Agent ثبت می‌شوند.


<a id="0001-scoped-repair-worker-بازبینی-مأموریت-کامل-۲۰۲۶-۱۰-۲۳"></a>

### بازبینی مأموریت کامل؛ ۲۰۲۶-۱۰-۲۳

محدودیت‌های تاریخی بالا با ADR0011/0012/0014/0015 در حوزه container، build و Python گسترش یافته‌اند؛ «فقط Node مستقیم» توصیف امروز همه worker نیست. CodeRepairJob، base/scope، budget، containment، لغو، آزمون مستقل و artifact receipt حفظ می‌شوند. محدودیت واقعی باقی‌مانده، آماده‌سازی raw/monorepo، تغییر dependency/command و connector اجرایی سه میزبان است؛ این‌ها الزام دائمی محصول نیستند.

[OpenHands Software Agent SDK](https://github.com/OpenHands/software-agent-sdk) APIهای Python/TypeScript/REST و Agent Server برای workspace اجرا دارد؛ جایگزینی فعلی، سرویس و runtime/permission/dependency تازه می‌خواهد و هیچ اجرای واقعی مقایسه‌ای در این نصب انجام نشده است. [mini-swe-agent](https://github.com/SWE-agent/mini-swe-agent) حلقه ساده و shell/subprocess دارد؛ سادگی حلقه، به‌تنهایی محدودیت command/network/receipt را حل نمی‌کند. هیچ کد از این دو پروژه اقتباس نشده است.

انتخاب اجرایی فعلی حفظ worker موجود و اتصال host از پشت همان قرارداد است. افزودن SDK تازه تا وقتی یک شکاف مشخص را با اجرای sandbox و receipt مستقل نبندد، توجیه ندارد. این تصمیم صرفه‌جویی اندازه‌گیری‌شده یا برتری عمومی worker نیست. spike واقعی جدید با Codex0.163.0-alpha.11 فقط MCP→application، discovery و سه فراخوانی بدون مدل را اثبات کرد؛ dispatch اصلاح، هزینه/مصرف، cancel/recovery و محدودیت ابزار هر connector هنوز آزمون جدا می‌خواهند. API رسمی جدید app-server، اجرای برنامه‌نویسی‌شده Claude Code و OpenCode SDK بررسی شده‌اند؛ CLI دو میزبان اخیر در PATH و مسیرهای معمولِ بررسی‌شده نبود. Markdown یا MCP discovery جای این مرز اجرایی قرار نمی‌گیرد.

پیش‌نیاز اختیار چندمرحله‌ای در برش بعدی صریح شد: jobهای تازه Agent، `parentRunId` تولیدشدهٔ host را در consent و packet نگه می‌دارند. claim/مصرف/ساخت artifact به همان والد، source، job و RunBudget پایدار وابسته‌اند؛ adapter وابسته نمی‌تواند بودجه تازه‌ای بسازد. بازبینی تصمیم منقضی، والد را حفظ می‌کند و هیچ مصرف یا تأییدی را تمدید نمی‌کند. تاریخچه optional/null خوانده می‌شود؛ ActionSpec/migration قبلی تغییر نکرد. [شاهد و regression](../evidence/agent.md#repair-parent-binding) مرز این تغییر را از plan approval و dispatch میزبان بیرونی جدا می‌کند.

<a id="0004-reviewed-node-preparation"></a>

## 0004 — قرارداد جدا برای آماده‌سازی فرمان Node

وضعیت: پذیرفته‌شده برای Node بدون dependency و با تست مستقیم موجود. تاریخ: ۲۰۲۶-۱۰-۲۲.


<a id="0004-reviewed-node-preparation-مسئله"></a>

### مسئله

قرارداد اصلاح باگ، package.json را ثابت نگه می‌داشت تا مدل نتواند با تغییر test/script/dependency، آزمون را دور بزند یا دامنه اجرای محلی را گسترش دهد. همین invariant، افزودن start مفقود را هم رد می‌کرد. حذف عمومی این کنترل، اختیار بیشتری از هدف آماده‌سازی به worker می‌داد.


<a id="0004-reviewed-node-preparation-تصمیم"></a>

### تصمیم

`propose_project_preparation` یک برنامه محدود شامل فایل JavaScript موجود، پورت و فرمان دقیقِ مشتق‌شده `node <entry>` می‌سازد. این برنامه داخل همان CodeRepairJob، consent و تصمیم محلی ثبت می‌شود؛ executor یا approval engine موازی ساخته نمی‌شود. فقط scripts.start، entry مصوب و port در liara.json موجود می‌توانند تغییر کنند. سایر package fields، تست‌ها، engine، scriptها، dependencyها و config ثابت می‌مانند. قرارداد قدیمی بدون این برنامه همچنان تغییر package.json را رد می‌کند.


<a id="0004-reviewed-node-preparation-پیامد"></a>

### پیامد

این راه، پروژه native Node با تست پذیرش موجود را پشتیبانی می‌کند؛ command دلخواه، نصب dependency، build عمومی، ایجاد فایل، root monorepo و engine نامعلوم پذیرفته نمی‌شوند. برای monorepo باید leaf واقعی انتخاب شود. تست قبل باید failure را بازتولید کند؛ همان تست بعد از patch باید بگذرد و profile دوباره فرمان/پورت/نسخه معلوم را تأیید کند. archive از همان bytes ساخته و source اصلی حفظ می‌شود. Docker/build executor و پوشش پروژه بدون تست، قرارداد و شواهد جدا لازم دارند؛ یک test runner روی میزبان، sandbox سیستم‌عامل ادعا نمی‌شود.

<a id="0005-static-port-bindings"></a>

## 0005 — استخراج پورت از binding ثابت به‌جای تطبیق متن

وضعیت: پذیرفته‌شده. تاریخ: ۲۰۲۶-۱۰-۲۲.


<a id="0005-static-port-bindings-مسئله"></a>

### مسئله

در آزمون واقعی A07، worker start را درست افزود و همان تست HTTP گذشت، اما `.listen(6067)` را به `.listen(port)` با `export const port=6067` تبدیل کرد. regex قبلی این binding معتبر را نمی‌فهمید و host به‌درستی artifact را به‌دلیل port نامعلوم رد کرد. واداشتن مدل به literal یا حذف شرط readiness، root cause را حل نمی‌کرد.


<a id="0005-static-port-bindings-تصمیم-و-trade-off"></a>

### تصمیم و trade-off

پورت‌های فراخوانی listen از AST JavaScript و scopeهای lexical استخراج می‌شوند. فقط literal عددی، const قابل حل و fallback صریح PORT پشتیبانی می‌شوند؛ shadowing، mutation، binding متغیر، import، TDZ و expression نامعلوم قطعی نمی‌شوند. source اجرا نمی‌شود. comment/string و پورت تصادفی صفر، candidate استقرار نمی‌سازند. تعارض یا listener حل‌نشده، inference را unknown نگه می‌دارد؛ port صریح liara.json همچنان configuration انتخاب‌شده است، نه شاهد اجرای موفق.

Acorn8.14.0 که داخل Next16.4.2 نصب و pin شده بود reuse شد. dependency جدید و parser اختصاصی زبان ساخته نشد. مسیر compiled داخلی Next بخشی از API عمومی آن نیست؛ upgrade Next باید import/parser و regressionهای این مرز را دوباره بسنجد. AST در مرز unknown دریافت و ساختار nodeها narrow می‌شود؛ هیچ any یا double assertion لازم نیست. پشتیبانی کامل TypeScript/JSX یا حل expression دلخواه ادعا نمی‌شود. این‌ها candidateهای static هستند؛ tests و پاسخ واقعی برنامه همچنان لازم‌اند.

<a id="0011-container-worker"></a>

## 0011 — حفظ worker و افزودن اجرای محدود container

وضعیت: پذیرفته برای اصلاح Node22 با آزمون مستقیم موجود؛ ۲۰۲۶-۱۰-۲۲. این تصمیم پذیرش dependency/build عمومی نیست.


<a id="0011-container-worker-بررسی-گزینهها"></a>

### بررسی گزینه‌ها

منابع رسمی در همین تاریخ خوانده شدند؛ نسخه از فایل source گرفته شد، نه امتیاز benchmark:

| گزینه | شاهد و تناسب | هزینه و مرز ادغام |
| --- | --- | --- |
| OpenHands SDK 1.57.0 | [نسخه و وابستگی‌ها](https://github.com/OpenHands/software-agent-sdk/blob/main/openhands-sdk/pyproject.toml)، [persistence](https://docs.openhands.dev/sdk/guides/convo-persistence)، [metrics](https://docs.openhands.dev/sdk/guides/metrics) و [confirmation](https://docs.openhands.dev/sdk/guides/security) | Python/REST و Agent Server گزینه قابل توسعه‌اند؛ برای TypeScript فعلی، bridge و تطبیق event، cancellation، retry و دفتر مصرف لازم است. سازگاری واقعی با BoxAPI و policy این نصب آزموده نشد. |
| mini-swe-agent 2.4.6 | [نسخه](https://github.com/SWE-agent/mini-swe-agent/blob/main/src/minisweagent/__init__.py) و [source محیط Docker](https://mini-swe-agent.com/latest/reference/environments/docker/) | محیط command و cleanup دارد؛ پیش‌فرض interpreter آن bash و run_args آن فقط rm است. resource/network policy و patch/test validation Launchlane همچنان باید در host enforce شوند. نصب و اجرای runtime آن در این برش انجام نشد. |
| worker موجود + executor محدود | job، source base، scope، budget، patch، same-test oracle و artifact قبلاً وجود داشتند | یک provider و یک policy حفظ می‌شوند؛ shell دلخواه مدل لازم نیست. توسعه عمومی build/dependency هنوز قرارداد جدا می‌خواهد. |

هر دو پروژه [OpenHands](https://github.com/OpenHands/software-agent-sdk/blob/main/LICENSE) و [mini-swe-agent](https://github.com/SWE-agent/mini-swe-agent/blob/main/LICENSE.md) MIT هستند. کدی از آن‌ها کپی یا dependency آن‌ها نصب نشد. الگوی پنل گلستون نیز صرفاً مرجع رفتار بود و کد یا منطق آن وارد نشد.


<a id="0011-container-worker-تصمیم-و-spike-اجرایی"></a>

### تصمیم و spike اجرایی

همان CodeRepairAdapter و یک درخواست patch حفظ شدند. برای مأموریت دکمه‌ای، host اجرای container را در consent/job می‌بندد. image رسمی Node22.23.3 با digest ثابت، بدون pull خودکار، فقط mount همان workspace به‌صورت read-only، root read-only، user1000، network none، CPU1، RAM256MiB، pids64 و tmpfs64MiB استفاده می‌شود. کد به نسخه tmpfs کپی می‌شود؛ Docker socket، home و credential میزبان در دسترس نیستند. watch‌dog20s فرایند container را محدود می‌کند؛ مهلت میزبان انتقال/راه‌اندازی و خروجی نیز محدودند.

شناسه کامل برگشتی پیش از start در job ثبت می‌شود. فقط همان شناسه در cleanup حذف می‌شود؛ enumerate یا توقف containerهای دیگر نداریم. timeout یا cleanup نامعلوم، artifact موفق نمی‌سازد. crash می‌تواند job را interrupted و نیازمند بررسی receipt باقی بگذارد؛ resume خودکار script یا write وجود ندارد. این مرز با یک daemon مقاوم چندفرایندی اشتباه نشود.

`npm run test:sandbox` واقعاً baseline fail، patch مصنوعی، همان تست pass، حفظ source اصلی، نبود credential/نوشتن mount/شبکه و حذف دو container را سنجید. چرخه بعدی با مدل واقعی نیز فقط invoice.mjs را اصلاح کرد، دو آزمون Node22 را گذراند و همان artifact را به Liara فرستاد. جزئیات در [گزارش انتشار](../evidence/interface.md#guided-publication) هستند. نخستین آزمون تحت بار هم‌زمان در cleanup timeout شکست خورد؛ نبود container با همان ID بعداً خوانده شد و آن failure حفظ شد.


<a id="0011-container-worker-حدود-و-بازنگری"></a>

### حدود و بازنگری

فرمان npm/install/build، تغییر dependency، ساخت تست تازه و پروژه بدون تست همچنان پشتیبانی عمومی ندارند. اجرای تاریخی Node permission برای سازگاری حفظ شده و sandbox سیستم‌عامل معرفی نمی‌شود. اگر harness بیرونی با مدل مجاز و budget/cancellation/receipt مشترک spike موفق بدهد، می‌تواند پشت همین adapter جایگزین شود؛ UI و cloud policy مستقل دیگری ساخته نمی‌شوند.

<a id="0012-locked-project-build"></a>

## 0012 — نصب قفل‌شده و بررسی build/start در همان worker

وضعیت: پذیرفته برای npm lockfile v3، Node22 و scope فعلی؛ ۲۰۲۶-۱۰-۲۲. پذیرش عمومی Next، env و تغییر dependency هنوز کامل نیست.


<a id="0012-locked-project-build-دلیل-و-انتخاب"></a>

### دلیل و انتخاب

آزمون مستقیم Node در ADR0011 برای پروژه دارای dependency یا build کافی نبود. افزودن shell مدل یا اجرای npm روی میزبان، مرز اجرای source غیرقابل اعتماد را از بین می‌برد. همان CodeRepairJob، تصمیم دارای نشست/expiry، claim، بودجه، worker وصله و artifact حفظ شدند؛ برنامه ساخت یک قرارداد مستقل داخل همین job است.

برنامه سمت host از source استخراج می‌شود: image دقیق Node22.23.3، build/start و test موجود، پورت و همان path/status/assertion. job بررسی اولیه اجازه ویرایش ندارد. بعد از شکست اجراشدهٔ build یا رفتار برنامه، اصلاح محدود می‌تواند همان برنامه و معیار را دوباره اجرا کند. دریافت dependency، integrity، timeout، OOM یا مشکل sandbox به‌خودی‌خود مجوز ویرایش source نیست. تغییر script/dependency، فایل آزمون یا تنظیمات سنجش در این قرارداد اصلاح عمومی مجاز نیست.

دانلود فقط tarball عمومی registry رسمی npm، HTTPS با DNS عمومی pin‌شده و integrity قفل‌شده است. سقف ۵۱۲ ورودی lock، ۶۴MiB هر tarball، ۳۸۴MiB مجموع و چهار دریافت هم‌زمان است؛ هر خواندن از همان budget کم می‌کند. redirect، registry دارای credential، git/file dependency و workspace link رد می‌شوند. npm داخل container از cache تاییدشده، `ci --offline` و scriptهای همان پروژه استفاده می‌کند؛ dependency و script شبکه ندارند. [npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci/) برای lock ناسازگار شکست می‌خورد؛ [cache](https://docs.npmjs.com/cli/v7/commands/npm-cache/) جای تغییر lockfile نیست.

فقط source و tarballهای همین job به‌صورت read-only mount می‌شوند. root read-only، user1000، cap-drop، no-new-privileges، network none، CPU1، RAM/swap2GiB، pids128 و tmpfs1GiB هستند. watchdog اجرای برنامه۱۱۰s، allowance هر container۱۲۰s و کل job حداکثر۳۶۰s و درون سقف تجمعی Agent است. Docker socket و credential میزبان mount یا inherit نمی‌شوند. شناسه پیش از start ثبت و فقط همان ID پاک می‌شود. artifact از source اصلی آزموده‌شده است؛ خروجی build یا dependency ساخته‌شده در container به‌عنوان source صادر نمی‌شود. استقرار همان source و lock را مجدداً build می‌کند و workload ابری هنوز باید جدا سنجیده شود.

مرحله start با `NODE_ENV=production` و PORT مصوب اجرا می‌شود؛ install/build dependencyهای لازم را نگه می‌دارند. envهای خصوصی پروژه در این برش تزریق نمی‌شوند. receipt زمان واقعی را ثبت می‌کند؛ timeout/OOM یا خروجی محدودشده با تست شکست‌خوردهٔ قابل اصلاح یکی نیستند.

مدل همچنان سقف۱۶ ابزار شامل completion دارد. آماده‌سازی محدود Node بدون dependency و build قفل‌شده، دو ابزار جایگزین متناسب با source هستند؛ هر دو در registry مشترک validate می‌شوند. API قدیمی هدف نیز برای job تازه container می‌سازد. runner permission تاریخی برای خواندن/آزمون قراردادهای قدیمی باقی است؛ مسیر Agent تصمیم یا اجرای تازه‌ای با آن نمی‌پذیرد.

ادامه پس از تکمیل حساب، رد تصمیم یا failure یک درخواست structured به همان run است. در تکمیل اولیه حساب و پیش از اثر remote، context حساب با source ثابت قابل تطبیق است؛ انتخاب مادی دیگر منتقل نمی‌شود. شمار مدل/ابزار و زمان مصرف‌شده reset نمی‌شوند. دو nonce برای همان revision یک ادامه می‌سازند. job قدیمی منقضی‌شده لغو می‌شود؛ ادامه، approval تازه تولید نمی‌کند. retry صریح failure دریافت dependency یک proposal تازه با همان plan/criterion و همان بودجه اجازه می‌دهد، نه ویرایش کد یا تکرار خودکار build شکست‌خورده.


<a id="0012-locked-project-build-شاهد-و-محدودیت"></a>

### شاهد و محدودیت

`test:build-sandbox` با transport مدل مصنوعی و dependency واقعی دارای integrity، npm install/build/start و GET را در Docker واقعی اجرا می‌کند: پروژه سالم، و پروژه دارای باگ با fail→وصله محدود→همان معیار pass. source اصلی و artifact دقیق سنجیده و containerهای همان job حذف شدند. این شاهد مدل واقعی یا cloud نیست. سه regression تصمیم/اصلاح که اکنون container لازم دارند، به `tests/sandbox` منتقل شدند؛ از suite حذف نشده‌اند.

spike Next با lock نسخه‌های موجود آغاز شد. بسته‌های کوچک و خود Next از cache تطبیق داشتند؛ دریافت چند tarball از جمله compiler لینوکس در مسیر عادی و مسیر خصوصی نصب timeout شد. scope VPN/route سراسری تغییر نکرد. این failure محفوظ است و Next به‌عنوان build تاییدشده معرفی نمی‌شود. نصب خصوصی، install نیازمند شبکه، env ساخت/runtime، monorepo بدون lock مستقل، runtime دیگر و تغییر dependency/command در اصلاح، قرارداد و شاهد بعدی می‌خواهند.


<a id="0012-locked-project-build-ادامه-۲۰۲۶-۱۰-۲۳-برنامه-node-بدون-وابستگی"></a>

### ادامه ۲۰۲۶-۱۰-۲۳؛ برنامه Node بدون وابستگی

وجود package-lock شرطِ نصب قفل‌شده است، نه نیاز یک برنامه بدون dependency. برنامه build نسخه1 فیلد اختیاری `install=none` دارد؛ نبود این فیلد شکل قراردادهای قبلی و hash آن‌ها را حفظ می‌کند. host فقط وقتی آن را می‌سازد و دوباره می‌پذیرد که package.json تک‌بسته باشد، dependencies/devDependencies/optionalDependencies/peerDependencies خالی باشند و هیچ lockfile شناخته‌شده‌ای وجود نداشته باشد. lock خراب یا dependency اعلام‌شده با skip نصب دور زده نمی‌شود؛ Python نیز این گزینه را نمی‌پذیرد.

همان container، محدودیت‌ها، build/test/start موجود، معیار response و CodeRepairJob استفاده می‌شوند؛ source یا lockfile ساختگی ایجاد نمی‌شود. هر مأموریت structured حتی برای Node بدون dependency، قبل از publication رسید واقعی همین build/start/workload را لازم دارد. وقتی start/port هنوز روشن نیست، ابزار آماده‌سازی محدود قبلی باقی می‌ماند. نبود build script به معنی اجرای build ساختگی نیست؛ start و workload مستقل همچنان بررسی می‌شوند. receipt و جزئیات UI می‌گویند نصب لازم نبود.

archive اکنون LICENSE/LICENCE/COPYING/NOTICE بدون پسوند را نیز با همان کنترل مسیر/secret حفظ می‌کند تا attribution با source همراه بماند؛ نام حساس همچنان مستثناست. آزمون archive، حضور copyright و نبود فایل حساس را بررسی می‌کند. candidate05 ثابت،322domain،37HTTP،6container مرتبط و43حالت guided browser را با build/typecheck و lint بدونerror/35warning/9info گذراند؛ مدل و PaaS آن آزمون‌ها مصنوعی‌اند. شاهد زندهٔ source بدون lock و MCP تا نتیجه هنوز جداگانه لازم است؛ این تغییر پذیرش عمومی Next یا تمام runtimeها نیست.

<a id="0013-project-environment"></a>

## ADR 0013: مقدارهای محیطی با مرجع رمز‌شده و تصمیم مستقل

وضعیت: پیاده‌سازی runtime Node و آزمون قراردادی؛ پذیرش زنده و تزریق در build محلی هنوز جداست. ۲۰۲۶-۱۰-۲۲.

فرم داخل انتشار، مقدار را از چت جدا می‌کند. کلید از source همان پروژه می‌آید؛ actor، حساب، تیم، ID داخلی app، پلن، source/archive، run و زمان اعتبار در ActionSpec v9 بسته می‌شوند. تنظیمات runner مانند PORT و NODE_OPTIONS در این قرارداد پذیرفته نمی‌شوند. کاربر عمومی یا محرمانه‌بودن مقدار را مشخص می‌کند؛ پیش‌فرض محرمانه است. مقدار محرمانه زیر چهار نویسه در این مسیر پذیرفته نیست، چون حذف متنی قابل اتکای آن از شاهد فراهم نیست. کادر خالی در UI یعنی حفظ مقدار قبلی؛ حذف کلید و خالی‌کردن مقدار از UI این برش ارائه نشده‌اند.

مقدارها فقط در ورودی فرم و trusted executor وجود دارند. SQLite نسخه۱۰، envelope با AES-256-GCM و AAD کل actor/spec را نگه می‌دارد. کلید از secret نصب مشتق می‌شود؛ reference در UI فقط ID تصادفی است. اثر انگشت کل پیکربندی HMAC است تا مقدار کم‌آنتروپی از hash عمومی حدس زده نشود. spec، audit، مدل، نتیجه HTTP و readback عمومی فقط نام کلید و وضعیت دارند. مقادیر محرمانهٔ دریافت‌شده در حداکثر۱۲۸ تغییر اخیر actor به redaction شواهد Liara، workload و مدل افزوده می‌شوند؛ این کنترل، رمزگذاری log در برنامه مشتری یا جلوگیری از تبدیل دلخواه secret توسط کد مشتری نیست.

CLI رسمی لیارا در commit `14ec35f79d703a09a5e3abbb22ba59239cdde80d`، [env set](https://github.com/liara-cloud/cli/blob/14ec35f79d703a09a5e3abbb22ba59239cdde80d/src/commands/env/set.ts) و env unset، ابتدا GET پروژه و سپس POST ثابت `/v1/projects/update-envs` با فهرست کامل variables دارند. پیام و تصمیم CLI احتمال restart را آشکار می‌کنند. بنابراین executor فهرست موجود را در حافظه می‌خواند، فقط کلیدهای مشخص را جایگزین و همان فهرست ادغام‌شده را رمز می‌کند؛ هنگام اجرا دوباره plan/ID/HMAC مبنا تطبیق داده می‌شود. داده ناقص، encrypted-only یا مقدار نامعتبر، write ایجاد نمی‌کند. API مستندشده CAS/ETag اتمیک برای این عملیات نشان نمی‌دهد؛ فاصلهٔ read نهایی تا write نسبت به یک نویسنده بیرونی اتمیک نیست و باید به‌عنوان محدودیت provider حفظ شود.

مجوز موجود store به‌جای موتور دوم استفاده می‌شود. input پیش از پیشنهاد ذخیره و فقط یک بار به action متصل می‌شود. claim و journal مرحلهٔ request_started پیش از transport ماندگارند. هیچ پاسخ گم‌شده، restart پردازش یا refresh اجازهٔ POST دوم ندارد. readback دقیق تمام کلید/مقدارهای ادغام‌شده فقط وضعیت configuration را تأیید می‌کند؛ restart کامل، release یا سلامت workload از آن استنتاج نمی‌شود. داده متفاوت/خواندن ناموفق uncertain می‌ماند؛ مرحله claimed بدون درخواست ثبت‌شده به not_started می‌رسد. تغییر scope، source و تصمیم‌های مادی از همان fenceها استفاده می‌کند و قفل نتیجهٔ نامعلوم حفظ می‌شود.

ادامه و خواندن/نوشتن env سهمیه همان mission را مصرف می‌کنند؛ هیچ budget تازه‌ای با فرم یا reload ساخته نمی‌شود. کاربر پس از configuration verified، همان مأموریت را با دکمه ادامه می‌دهد. گذرگاه HTTP/مرورگر فقط با transport مصنوعی در سرور disposable آزموده می‌شود؛ درخت اصلی، سرور زنده، دفتر مصرف و اتصال ایجنت تست دست‌نخورده می‌مانند. اتصال ساخت محلی در [ADR0014](runtime.md#0014-build-environment-binding) تکمیل شده است؛ تغییر provider بیرونی هم‌زمان، پاک‌سازی/چرخش secret و پذیرش واقعی این write هنوز شاهد تکمیلی می‌خواهند.

نشست تازه اختیار اجرای grant قبلی را نمی‌گیرد؛ actor احراز‌شده می‌تواند فقط approval محیطیِ approved و بدون attempt را با hash همان پیشنهاد لغو کند. پس از claim، لغو به معنی پس‌گرفتن write نیست و رد می‌شود. حالت executing فقط وضعیت‌خوانی نشان می‌دهد؛ بازیابی مرحله claimed بدون request_started به not_started می‌رسد. input قبلی بازنمایی و nonce قبلی برای پیشنهاد تازه استفاده نمی‌شود. خطای AUTH_REQUIRED از فرم، همان مسیر ورود برنامه را فعال می‌کند. این revocation مسیر تازه‌ای برای grant یا ارسال دوباره نیست.

Next 16.4.2 در مستند نصب‌شدهٔ `next/dist/docs/01-app/02-guides/environment-variables.md` تصریح می‌کند که مقدارهای `NEXT_PUBLIC_` هنگام build وارد JavaScript مرورگر می‌شوند. بنابراین فرم هشدار افشا دارد و برای مقدار پُرشده، اعلام صریح عمومی‌بودن لازم است؛ پیش‌فرض محرمانه به معنی پذیرش secret برای این نام‌ها نیست. همین قاعده پیش از پیشنهاد، تأیید، اجرا و استفاده از مرجع محیط در build اعمال می‌شود. parser تاریخی v9 خواندنی می‌ماند، اما grant قدیمی با چنین secretKey اجازهٔ write یا استفاده در build نمی‌گیرد. این کنترل تشخیص معنایی محرمانگی مقدار عمومیِ اعلام‌شده نیست؛ credentialهای نصب همچنان مستقل رد می‌شوند.

چون snapshot محیط کلیدهای قبلی مقصد را هم حفظ می‌کند، redaction علاوه بر secretهای صریح، مقدارهای موروثیِ حداقل هشت‌نویسه با نام credential مانند TOKEN، PRIVATE، PASSWORD یا API_KEY را هم می‌پوشاند. کلید صریحاً عمومی و نام عمومی Next از این heuristic کنار می‌روند تا مقدار رایج عمومی شواهد را تخریب نکند. این قاعدهٔ محدود جای طبقه‌بندی کامل داده‌های قبلی یا اثبات نبودن تبدیل secret در کد مشتری را نمی‌گیرد.

<a id="0014-build-environment-binding"></a>

## ADR 0014: اتصال همان env به ساخت، انتشار و بررسی پاسخ

وضعیت: پیاده و دارای case محدود Docker Node22 با مقدار و مدل/ابر مصنوعی؛ پذیرش تازهٔ Next/GitHub و env زنده باز است. ۲۰۲۶-۱۰-۲۲.

تأیید configuration به‌تنهایی کافی نیست: build ممکن است به مقدار قبلی وابسته باشد. برنامه build اکنون reference شامل action ID، HMAC configuration و نام کلیدهای مورد استفاده دارد. نبود property در قراردادهای تاریخی حفظ می‌شود؛ consent قدیمی بی‌دلیل hash تازه نمی‌گیرد. host reference را از configuration تأییدشده همان actor/project/account/app می‌سازد؛ مدل value یا reference دلخواه انتخاب نمی‌کند. تبار نسخه‌های آزموده‌شده تا هشت گام بررسی می‌شود؛ cycle، parent گم‌شده یا scope متفاوت fail closed است. انتخاب مستقل پروژه reference قبلی را به ارث نمی‌برد.

worker قبل از download و پیش از اجرای هر معیار، مرجع را با state فعلی تطبیق می‌دهد. فقط کلیدهای لازمِ موجود در source از snapshot رمز‌شده باز می‌شوند؛ PORT/NODE_ENV، PATH/HOME، گزینه‌های Node/npm و سایر تنظیمات runner از آن جدا هستند. فرم و inspector از همان فیلتر نام استفاده می‌کنند. کارت build استفاده از این کلیدها در install/build/test/start نسخه جدا را صریحاً مجاز می‌کند. credentialهای نصب، مدل و لیارا به کد مشتری داده نمی‌شوند.

مقدار از pipe ورودی Docker start می‌رود. command line، Docker Env، mount، فایل source یا فایل موقت میزبان حامل secret نیستند. container بدون TTY و با log driver none ساخته می‌شود؛ خروجی attach پیش از ذخیره receipt با مقادیر شناخته‌شده و شکل JSON/URL آن‌ها پاک می‌شود. byte buffer میزبان پس از ارسال صفر می‌شود؛ پاک‌شدن تضمینی همه کپی‌های string از حافظه JS ادعا نمی‌شود. کد مشتری همچنان می‌تواند secret مجاز خودش را تبدیل یا در خروجی خودش چاپ کند؛ network none، tmpfs و حذف container مرز این آزمون محلی‌اند. artifact همان source/lock آزموده‌شده است؛ خروجی کامپایل tmpfs به‌عنوان بسته باینری منتشر نمی‌شود و provider دوباره source را می‌سازد.

ActionSpec v10 همان قیود v7 را با reference env در hash مجوز می‌بندد؛ parser/client v1–v9 تاریخی محفوظ‌اند و migration تازه‌ای برای JSON spec لازم نیست. source/image/فرمان/معیار/env receipt همگی پیش‌نیاز پیشنهاد هدایت‌شده‌اند. env تغییرکرده، build قبلی را معتبر نمی‌کند؛ تغییر ورودی واقعی نسبت به build ناموفق، evidence تازه برای بررسی دوباره است و به معنی تغییر oracle نیست.

executor هنگام پیشنهاد، پیش از upload و پیش از release، HMAC تمام configuration مقصد را بازمی‌خواند؛ در readback موفق نیز دو سوی probe همین fence حفظ می‌شود. تغییر پیش از claim، مجوز استفاده‌نشده را با ENV_REFERENCE_CHANGED نامعتبر می‌کند؛ تغییر پس از claim، journal و uncertainty را حفظ می‌کند و write تکرار نمی‌شود. حالت configuration_changed از no_remote_changes و workload verified جداست تا ادامهٔ مأموریت، تغییر قبلی را نادیده نگیرد. این read/writeها همان بودجه run را مصرف می‌کنند. provider برای env CAS اتمیک مستند ندارد؛ این fenceها تراکنش اتمیک با نویسنده بیرونی یا اثبات همه اثرهای داده‌ای نیستند.

شاهد مستقل: اجرای واقعی npm ci/build/تست موجود/start و GET در Node22، echo مصنوعی redacted، archive بدون مقدار، حفظ source و حذف ID همان container. cloud/model transport این case مصنوعی است. دو case build سالم و fail→patch→همان تست pass نیز با runner stdin تازه دوباره اجرا شدند. تست‌های v10، تغییر قبل از upload و تغییر پس از HTTP200 را رد می‌کنند؛ configuration ثابت با release جاری و workload درست می‌گذرد. این‌ها پذیرش کامل arbitrary projects، private registry، envهای runner، network آزمون یا کیفیت عمومی مدل نیستند.

<a id="0015-python-publication-worker"></a>

## ADR 0015: انتشار بومی Python و worker ایزوله با wheel قفل‌شده

وضعیت: پیاده‌سازی، آزمون محلی و پذیرش محدود مدل/Liara روی کپی آمادهٔ ترب؛ [گزارش و حدود](../evidence/runtime.md#python-real-project). ۲۰۲۶-۱۰-۲۳.

مسیر Node به قرارداد runtime و آزمون Node وابسته بود. Python با نام جعلی Node یا پوستهٔ Node منتشر نمی‌شود: ActionSpec v11 برای انتشار و v12 برای ساخت مقصد، runtime Python، فرمان argv، source/archive، حساب، ID مقصد، پلن و معیار workload را در مجوز می‌بندند. `nodeVersion:null` در این دو نسخه صریح است. canonicalization نسخه‌های ۱ تا ۱۰ تغییر نمی‌کند؛ جدول و موتور مجوز تازه‌ای وجود ندارد. journal، claim، uncertainty و readback همان applicationهای موجودند. مجوز ساخت، مجوز انتشار نیست.

در این برش فقط Python 3.12/Linux x86_64 و اجرای مستقیم `python3 <file.py>` یا uvicorn با module/host/port مشخص پذیرفته می‌شوند. inspection فقط فایل می‌خواند؛ فرمان shell، pip و import پروژه برای شناسایی اجرا نمی‌شوند. فایل `.py` و تنظیمات TOML قابل capture هستند؛ `.venv`، `venv`، cache، env، credential و SQLite در archive نیستند. requirements.txt ریشه باید نسخه‌های دقیق و تمام وابستگی‌ها را داشته باشد؛ نبود آن برای سرویس استاندارد بدون وابستگی مجاز است. تبدیل خودکار pyproject، نصب sdist، private index، dependency edit و آماده‌سازی عمومی پروژهٔ Python هنوز قابلیت این قرارداد نیستند.

host از JSON رسمی PyPI، wheel سازگار و checksum SHA-256 را می‌گیرد؛ نام، URL، اندازه و bytes بررسی می‌شوند. فقط فایل‌های binary wheel از files.pythonhosted.org دریافت می‌شوند. pip در محیط اجرا به شبکه دسترسی ندارد و با `--no-index --no-deps --only-binary=:all: --require-hashes` نصب می‌کند؛ `pip check` سازگاری dependencyها را می‌سنجد. image موجود Python با digest ثابت در برنامه و consent بسته است. این محدودیت دربارهٔ binary wheel به معنی اعتماد به کد dependency نیست؛ import و اجرای آن‌ها نیز در محیط ایزوله صورت می‌گیرد.

Docker بدون شبکه، با source و wheelهای فقط‌خواندنی، کاربر غیر root، حذف capability، no-new-privileges، سقف زمان/حافظه/PID/خروجی و tmpfs اجرا می‌شود. tmpfs به `exec` نیاز دارد، چون loader باید فایل shared object در wheelهایی مانند pydantic-core را map کند؛ noexec به خطای واقعی `failed to map segment` منجر شد. این انتخاب با حفظ سایر مرزهای محیط و آزمون واقعی dependency باینری انجام شد. کلیدهای PYTHON/PIP/LD جزو env برنامه پذیرفته نیستند. envهای مجاز همان reference بررسی‌شده را از stdin می‌گیرند و وارد archive یا command line نمی‌شوند.

worker، compile، آزمون‌های unittest مشخص و بدون تغییر، و شروع برنامه و GET همان workload را انجام می‌دهد. شکست dependency یا sandbox مجوز patch نیست. patch فقط فایل‌های موجود و صریحاً مجاز را عوض می‌کند؛ requirements، تنظیمات اجرا و تست‌ها از محدوده تغییر خارج‌اند. رسید پیش/پس، diff و archive ثبت می‌شوند؛ انتخاب نسخهٔ اصلاح‌شده باید همان archive آزموده‌شده باشد. انتشار بعدی تصمیم مستقل دارد و موفقیت به release جاری/READY و پاسخ معنایی همان مسیر، با readback پیش و پس از probe نیاز دارد.

برای فایل واقعی API ترب با حجم ۱۳٬۴۹۸ بایت، بازگرداندن کل فایل با سقف خروجی مدل مناسب نبود. `submit_patch.files[].replacements` بخش before/after را روی hash همان فایل اعمال می‌کند؛ match مفقود، تکراری یا حتی هم‌پوشان رد می‌شود. فقط newline یکنواخت LF/CRLF برای snippet سازگار می‌شود و hash همچنان bytes پایه را می‌بندد. content تاریخی برای فایل کوچک خواندنی می‌ماند. محدودهٔ متن UTF-8 پیش از پیشنهاد بررسی می‌شود: هر فایل حداکثر ۲۴ KiB و مجموع ۴۸ KiB؛ سقف کل درخواست مدل مستقل حفظ می‌شود. فایل باینری یا وصلهٔ خارج از محدوده به مدل/انتشار راه نمی‌یابد.

همین مرز tmpfs برای build در Node نیز لازم بود: نصب واقعی ۲۶ package فرانت‌اند ترب گذشت ولی `tsc: Permission denied` ساخت را متوقف کرد؛ با exec داخل همان containment، typecheck، Vite build، start و GET واقعی گذشتند. این شاهد Node/Vite است و پذیرش عمومی Next نیست. سهم ابزار مأموریت تازه ۱۶۰ است تا خواندن dependency، اصلاح محدود و بررسی release در یک دفتر جا شوند؛ یک اجرای واقعی با تلاش ناموفق و ادامه، ۱۲۶ واحد مصرف کرد. سهم ثبت‌شدهٔ run قدیمی، با refresh یا تغییر پیش‌فرض تمدید نمی‌شود.

اسکن منبع Python میان type annotation، ارجاع به متغیر credential و literal فرق می‌گذارد. این تشخیص محافظه‌کارِ متنی، اثبات نبودن تمام انواع secret یا بازسازی دادهٔ مبهم نیست؛ مقادیر واقعی شناخته‌شده مستقل از normalization مسدود می‌شوند. تست regression برای annotation، مقدار literal، dataclass default، قالب هدر و مقدار نصب‌شده وجود دارد؛ redaction لاگ همچنان مستقل و محافظه‌کار است.

مبنای provider: [نسخه‌های Python](https://docs.liara.ir/paas/python/how-tos/choose-version/)، [استقرار Python](https://docs.liara.ir/paas/python/how-tos/deploy-app/)، [FastAPI](https://docs.liara.ir/paas/python/related-apps/fastapi/) و [پیاده‌سازی deploy در CLI رسمی](https://github.com/liara-cloud/cli/blob/master/src/commands/deploy.ts)، بررسی‌شده در همین تاریخ. release با `type:python`، `platformConfig.version` و `args` صریح ساخته می‌شود. این منابع شکل درخواست را پشتیبانی می‌کنند؛ پذیرش واقعی حساب و workload به شاهد زندهٔ جدا نیاز دارد.

آزمون مستقل `node --test tests/sandbox/python-build.test.ts` با مدل مصنوعی، اجرای واقعی Python/Docker و سه assertion بدون تغییر، خطا را بازتولید و patch مرتبط را آزمود و همان artifact را انتخاب کرد؛ source اصلی حفظ شد. اجرای محلی API واقعی ترب با ۱۸ wheel قفل‌شده و بدون دیتابیس، `/openapi.json` را گذراند. این مشاهده، جست‌وجوی محصول/داده یا مدل داخلی ترب را تأیید نمی‌کند. شواهد Liara و مدل واقعی به‌صورت جدا ثبت می‌شوند.



<a id="0015-python-publication-worker-تکمیل-مبتنی-بر-اجرای-واقعی"></a>

### تکمیل مبتنی بر اجرای واقعی

HTTP200 صفحهٔ HTML برای پذیرش UI کافی نبود: وصلهٔ مدل، HTML را ارائه می‌کرد ولی script، سپس font و icon همچنان 404 بودند. runner Python منابع HTML/CSS هم‌مبدأ را با سقف ۱۶ فایل، ۵۱۲ KiB هر فایل، ۲ MiB مجموع و عمق محدود بررسی می‌کند؛ منابع خارجی unverified می‌مانند. این بررسی جای browser یا صحت تمام مسیرها را نمی‌گیرد. قبل/بعد واقعی و آزمون مستقل ترب در گزارش ثبت‌اند.

worker فقط متن فایل‌های مصوب را می‌گیرد و فهرست حداکثر ۱۲۸ نام/۸ KiB را برای grounding مسیرها می‌بیند. فهرست، مجوز ویرایش تازه نیست. این انتخاب از ارسال کل bundle یا حدس مسیر ناموجود جلوگیری می‌کند.

برای ادامهٔ اصلاح، wheel فقط از artifact موفقِ والد که دقیقاً انتخاب فعلی است reuse می‌شود. lock، manifest، اندازه و checksum تمام bytes دوباره بررسی می‌شوند؛ تغییر dependency یا کش دیگر به این مسیر راه ندارد. این کار دو دریافت تکراری ۳۶ واحدی را در اجرای واقعی حذف کرد و شمارندهٔ run بدون تمدید در ۱۱۴ ماند.

سقف پیش‌فرض run جدید ۲۴ درخواست مدل و۱۶۰ ابزار با۶۰۰٬۰۰۰ میلی‌ثانیه است. اجرای واقعی بازیابی ۱۷ درخواست مصرف کرد؛ سقف قبلی۱۶ این مسیر را نمی‌بست. مقدار هر run قدیمی از receipt خودش خوانده می‌شود. feedback محدود برای ادامه، صرفاً دادهٔ تازه است؛ source، workload، بودجه و authority قبلی را تغییر نمی‌دهد.

کارت‌های v11/v12 همان componentهای تصمیم قبلی‌اند؛ guard و برچسب runtime اصلاح شد. پیام تاریخیِ job پس از شروع publication به کارت وضعیت انتشار ارجاع می‌دهد. redesign هم‌زمان در این تغییر وارد نشده است.

<a id="0026-node24-isolated-build"></a>

## ADR0026 — محیط ساخت Node24 با همان اختیار و worker

تاریخ: ۲۰۲۶-۱۰-۲۳. وضعیت: implemented، اجرای container واقعی تأیید؛ انتشار زنده Node24 در این برش UNCONFIRMED.

مأموریت واقعی کاربر با engines Node24 چهار بار به worker Node22 رسید و BUILD_RUNTIME_UNSUPPORTED داد. سؤال برای فراهم‌کردن محیط ناسازگار، تصمیم معمول مهندسی را به کاربر منتقل می‌کرد. image رسمی `node:24.18.0-bookworm-slim` از registry با digest `sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d` بررسی و دریافت شد؛ linux/amd64 manifest نیز مشاهده شد. این image در bootstrap اپراتور آماده می‌شود؛ runtime هیچ pull ضمنی یا shell میزبان برای کد کاربر ندارد.

ProjectBuildPlan v3، Node24 و همین digest را به هم متصل می‌کند؛ v1 Node22 و v2 Python بدون تغییر parse/canonical باقی می‌مانند. انتخاب از source/engines و نسخهٔ دقیق image انجام می‌شود؛ قید ناسازگار مانند Node24.99 روی24.18 پذیرفته نیست. image دلخواه مدل یا جابه‌جایی image22/24 رد است. API/وب/MCP همان ابزار proposal، approval، scope، deadline، budget و journal قبلی را مصرف می‌کنند؛ انتخاب image سؤال جدید کاربر نیست.

runner install/build/test/start/GET از image مصوب plan استفاده می‌کند؛ workspace/tarballs فقط read-only، work private tmpfs، شبکه none، cap-drop، user1000، CPU1، memory2GiB، pid128 و cancellation/cleanup با ID دقیق حفظ می‌شوند. test-only قدیمی بدون build همچنان image22 دارد؛ Node24 از برنامهٔ build معتبر استفاده می‌کند. مجوز تاریخی image22 هرگز به image24 تبدیل نمی‌شود. mission authority، تبار artifact، patch غیرمؤثر و publication همان artifact از همان policy می‌گذرند؛ migration تازه‌ای برای JSON contract لازم نیست.

آزمون واقعی Node22 و Node24، نصب آفلاین، اجرای executable در tmpfs و assert نسخه دقیق را گذراند. چرخهٔ container در هر دو نسخه، baseline failure→patch بی‌اثرِ ردشده→patch مؤثر→آزمون اصلی→artifact→publication مصنوعی را با یک اختیار گذراند؛ سورس اصلی محفوظ ماند. این شاهد worker است؛ Docker publication یا Next/React/PHP را اثبات نمی‌کند. فرمان‌های بازتولید: `node --test tests/sandbox/native-build.test.ts tests/sandbox/mission-authority.test.ts` پس از آماده‌سازی imageهای pinned. setup عمومی build service، نسخه‌های Node دیگر و dependency managerهای دیگر هنوز در A07/A11 بازند.

<a id="0027-native-next-publication"></a>

## ADR0027 — Next بومی با worker و policy مشترک

تاریخ: ۲۰۲۶-۱۰-۲۳. وضعیت: implementation؛ compiler واقعی کنترل‌شده تأیید، پروژه upstream و انتشار بومی زنده هنوز UNCONFIRMED.

Next یک نام نمایشی برای Node نیست: مقصد و release باید platform/type برابر next داشته باشند. [راهنمای رسمی](https://docs.liara.ir/paas/nextjs/how-tos/deploy-app/) نصب dependency، build، start و platformConfig نسخه/تنظیم mirror را تعریف می‌کند؛ API/CLI نسخه‌های20/22/24 را مستند می‌کنند. Launchlane source دارای dependency next، start مربوط و ساختار app/pages را بدون اجرا بررسی می‌کند؛ Node major از قید source و liara.next می‌آید. پورت start معمول3000 استخراج می‌شود؛ runtime سیستم کاربر ملاک نیست. liara.platform=node صریح، انتخاب مسیر Node قبلی است.

ActionSpec17 انتشار و18 ساخت، NextRuntime شامل version/mirror را به source، account/team/app ID، cost/network، artifact، workload و env reference متصل می‌کنند. محیط build22 یا24 از قرارداد worker می‌آید. mirror از source حفظ و در نبود آن false انتخاب می‌شود تا registry رسمی با دریافت dependency مستقل هم‌راستا باشد؛ این گزینه در hash و تصمیم ثبت است. پارس/bytes قراردادهای1–16 و BuildPlan1–3 تغییر نمی‌کنند. platform helper فقط قرارداد مشترک application/persistence/provider را تفسیر می‌کند؛ policy یا engine موازی ندارد.

مقصد Node نمی‌تواند جای Next readback شود. archive، claim، یک مالک write، unknown-result/readback، deadline، session و same-artifact verification حفظ شده‌اند. env در17 nullable و در حالت موجود، قبل/بعد workload به همان configuration متصل است؛ merge از سرویس قبلی می‌آید. اختیار چندمرحله‌ای نیز ID/source/build/workload/lineage مصوب را لازم دارد؛ runtime ادعاشدهٔ مدل مجوز نیست. journal JSON migration تازه لازم ندارد.

Next وابسته به همان install/build/test/start واقعی است؛ نمایش badge یا native payload پذیرش خانواده نیست. compiler16.4.2 در image دقیق Node22، npm ci آفلاین با tarballهای integrity-bound، build webpack، start و GET معیار اصلی را گذراند؛ این case کنترل‌شده چهار فایل است و پروژه واقعی عمومی نامیده نمی‌شود. attempt اول runner خصوصی budget پیش‌فرض12 و آرگومان اشتباه reader داشت؛ failure حفظ و در اجرای تازهٔ فاقد هزینه، بودجه160/reader درست استفاده شد. allowance مأموریت کاربر reset نشد.

بررسی source خام عمومی Lingua Loop در commit c2d05a6f539a4b47bb6872c696b9b5f4aee5800e آغاز شد؛ MIT و license فونت‌ها حفظ شدند. env member references در actions.ts بی‌جهت credential شناخته می‌شدند؛ فقط reference کامل JavaScript با delimiter، بدون default/operator، مجاز شد. literal، typed secret، exact installed secret و JSON credential همچنان رد می‌شوند؛ log redaction تغییر نکرد. سپس tests/telegram.test.ts به‌علت credential-like fixture رد شد؛ آن را حذف/تغییر یا سالم اعلام نکردیم. lock این پروژه557 ورودی دارد و از سقف فعلی512 نیز بیشتر است. این دو مرز آماده‌سازی باید در A07 رفع شوند؛ پروژه upstream از source خام هنوز منتشر نشده است. شبکهٔ مورد نیاز build/font، managerهای دیگر و Next20 worker نیز مرزهای بازند.

<a id="0028-native-frontend-build"></a>

## ADR0028 — native frontend build, bounded Node20 and environment discovery

Date: 2026-10-23. Status: implemented; native cloud acceptance remains open.


<a id="0028-native-frontend-build-decision"></a>

### Decision

Reuse the existing source, approval, mission authority, journal and publication engine for native React, Vue and Angular. ActionSpec19/20 bind framework, builder, output directory, mirror and fixed native Node20 to the exact source/artifact and destination. Historical ActionSpec1–18 bytes remain unchanged. Native Next keeps17/18, but its provider configuration is corrected to the documented `next.nodeVersion` field; the previous synthetic fixture had repeated the wrong `version` field.

Inspection does not execute scripts. Framework and build configuration must be supported and unambiguous. Angular SSR/multiple applications and conflicting frameworks are rejected with a preparation boundary. A platform label is not evidence of a successful compiler or release.

BuildPlan4 selects pinned Node20.20.2; BuildPlan5 additionally binds native frontend output. The isolated runner installs integrity-verified locked packages offline, runs actual build/tests and serves the actual output with a host-owned static server. Referenced local JS/CSS must exist, have the expected MIME and fit byte limits. A fallback HTML response cannot prove a missing asset. Source mounts stay read-only; no host shell, network, Docker socket or credentials are granted. Built output is not yet exported for composite Python applications.

The default tool ceiling becomes1024, maximum4096, and the npm lock-entry ceiling2048. A real upstream React lock required169 deduplicated package reads, exceeding the former160 tool limit. Time/model/currency limits and per-package/aggregate byte limits remain enforced; persisted old limits do not renew. This is not a new spending allowance.

Environment discovery parses real static JS/TS accesses and bounded Python helper calls instead of scanning arbitrary text. Comments, strings and shadowed objects are not environment requirements. Names do not imply requiredness. VITE_/REACT_APP_/NEXT_PUBLIC_ need explicit acknowledgement of browser exposure; raw values still use encrypted scoped forms.


<a id="0028-native-frontend-build-evidence-and-remaining-boundary"></a>

### Evidence and remaining boundary

See [native frontend evidence](../evidence/runtime.md#native-frontend). Native cloud releases, real Vue/Angular compilers, browser application behavior and composite Torob data/publication require separate proof. Supporting these contracts does not establish all14 required families.

Official version sources: [React](https://docs.liara.ir/paas/react/how-tos/choose-version/), [Angular](https://docs.liara.ir/paas/angular/how-tos/choose-version/), [Next](https://docs.liara.ir/paas/nextjs/how-tos/choose-version/).

<a id="0029-docker-and-compiled-fullstack-publication"></a>

## ADR 0029 — Docker and compiled fullstack artifacts

Date: 2026-10-25. Status: implemented in the working tree; public rollout and real Golestan acceptance remain open.

The prior frontend classifier could select a browser build while an independent API or database was still required. A successful image build or one HTTP 200 did not establish a complete deployment. The existing deployment approval, journal, provider and artifact services remain the execution boundary.

- Docker uses ProjectBuildPlan v6, ActionSpec v21 for publication and v22 for destination creation. The captured Dockerfile and context bind the plan. Cached digest-pinned base images, operator-local Engine endpoints, explicit resource bounds and identity-bound cleanup are required. An independently controlled verifier checks the runtime; container output cannot manufacture success. The durable job ID identifies execution before the daemon call. An unsettled execution blocks another worker rather than retrying an uncertain write.
- Mixed Vite/Node projects use ProjectBuildPlan v7. The host derives the actual backend start, output directory, compatible Node 22/24 version and root/nested npm locks. Only the private product workspace is prepared. Root lifecycle hooks need a separate reviewed capability; they are not silently removed. Existing test scripts remain unchanged and reported skips or absent tests reject the build.
- Private runtime configuration is excluded from frontend build and injected only at start. Build output is exported before worker cleanup and validated in the existing durable output store. The final archive contains those exact bytes and a fixed verifier, replacing a cloud rebuild with integrity verification. Generated files have explicit provenance and cannot receive an old mission's broad code-edit authority.
- ActionSpec v23 binds the tested source, plan, output receipt, environment reference and independent API criteria. Observation checks the current release, original workload, build proof, public JavaScript/CSS hashes and nested API results. HTTP 200 with a stale proof, wrong asset or unhealthy API is a failure.
- Multi-step mission authority does not yet support v7 preparation. It fails before approval; the supported path uses explicit local preparation/build and exact-artifact publication decisions. Historical ActionSpec canonicalization remains unchanged.

Source-derived application requirements describe components and resources without asserting availability. Unresolved separate runtimes or analysis gaps block a misleading single-component publication. PostgreSQL, Supabase, Cloudflare D1, WordPress, queues and durable file storage are distinct requirements. The database adapter currently reads account-scoped inventory/capabilities only; credentials, provisioning, migration and connectivity are not implemented by that read.

The npm tarball reader can reuse a private content-addressed cache or an explicitly configured operator `_cacache` root. Every hit is integrity-checked; only an actual registry miss consumes the existing request budget. Cache corruption is an error, not permission to redownload or renew the run. Job-specific size, manifest and immutable tarball validation remain unchanged. The private cache has a 512 MiB logical byte quota (including a bounded quota-index reserve), 4,096 entries and a 64 MiB item limit. Reservations append before publication and are not automatically released on crash/deletion; stale locks and invalid metadata require operator reconciliation. No cache eviction, allowance reset, automatic host-cache discovery or private-environment storage was added.

See [implementation evidence](../evidence/database.md#managed-fullstack-20261025). Controlled sandbox and synthetic provider tests do not establish a real Golestan deployment or support for every official Liara family.

<a id="0045-source-bound-pnpm-workspaces"></a>

## ADR0045 — Source-bound pnpm workspace execution

Date: 2026-10-28. Status: implemented; bounded local worker evidence, no provider publication acceptance.

The Factory feed corpus uses a shared pnpm lock, workspace links, a Vite frontend, Nest API and shared contracts. Selecting a leaf without its root lock, rewriting an npm lock or flattening these packages changes the application being tested. Existing npm/fullstack/data plans remain unchanged.

ProjectBuildPlan v8 binds the original packageManager, pinned pnpm 11.19.0 registry integrity, every package manifest, workspace configuration, root lock and compatible exact Node22/24 image. The host discovers every importer and validates local workspace links, source specifiers and common Node constraints. Conflicting locks, stale importers, unsupported settings, hooks, registries or engines fail explicitly. A bounded YAML parser is a direct pinned dependency; aliases and duplicate keys are rejected. No SQLite migration or ActionSpec version is added.

The existing propose_project_build, CodeRepairJob, review decision, cumulative budget and container runner own execution. The manager itself is installed from independently integrity-checked registry bytes in the private worker. Its frozen install uses an internal loopback registry serving only approved verified tarballs and official metadata. The Docker network stays none, source and dependency mounts stay read-only, and host credentials are absent. pnpm11's release-age policy stays enabled; missing identity/integrity/time metadata fails rather than manufacturing an old release date. Original root build/test/start commands and declared workspace settings are preserved. A postinstall that changes a reviewed manifest or lock is rejected before build.

When there is no root start command, compile-only mode runs the existing root build, without private data inputs. It explicitly runs no tests/start/workload and produces no publication artifact. This permits useful component compiler evidence before data-resource integration while preserving every unresolved component and database requirement. When root start exists, runtime mode executes original build/tests/start and the independent original workload, rejecting skipped checks. The existing source artifact service binds that tested source. This does not export compiled workspace bytes or prove a complete component topology.

The native Node provider documents npm installation. A pnpm local receipt therefore cannot authorize this incompatible publication route: publication fails with PNPM_PUBLICATION_ROUTE_REQUIRED. The next boundary is a compiled component artifact/publication contract that preserves the workspace and exact output provenance, followed by independent API/browser/worker workloads and the data binding owned by the parallel data path. A compiler result is not ledger correctness, database connectivity or persistence.

The implementation deliberately rejects unsupported pnpm versions instead of substituting a global installation or changing the source pin. More versions can add checked tool identities and runtime constraints later. Metadata downloads consume the existing tool allowance and have per-response and aggregate bounds. Registry/network failures are preparation failures, not permission for source repair.

Official references checked for this slice: [pnpm11 install](https://pnpm.io/11.x/cli/install), [workspace semantics](https://pnpm.io/11.x/workspaces), [Liara Node deployment](https://docs.liara.ir/paas/nodejs/how-tos/deploy-app/). The pinned package's executable source was also read to reconcile its actual supply-chain checks. See [evidence](../evidence/runtime.md#pnpm-workspaces).

<a id="0047-exact-compiled-pnpm-components"></a>

## ADR0047 — Exact compiled pnpm component artifacts

Date: 2026-10-29. Status: implemented; acceptance and limitations in [the evidence](../evidence/runtime.md#pnpm-components).

The existing pnpm8 compile receipt preserves the original workspace but grants no artifact or publication authority. Native npm publication cannot consume a pnpm lock. Publishing a frontend alone also cannot complete a source with independent APIs or workers.

ProjectBuildPlan9 appends an explicit workspace member, original source hash, source-derived start/output and independent API criteria to the same build application. `propose_project_build` accepts `componentRoot` and an optional reviewed internal port. The original frozen root install/build remain intact. The selected member's original test command runs when declared; absent tests are disclosed. Other root/component tests and data effects remain unverified. Retries retain the original component and API oracle. This slice permits validation and deterministic packaging; model source repair for plan9 remains unsupported.

The network-none worker packages installed production/optional/peer dependencies, including declared root production dependencies used through Node's ancestor resolution. Internal workspace/virtual-store links retain their relative topology; external links, private paths, cycles between link entries, changed bytes and oversized outputs fail closed. Dev dependencies are available to the original compiler but excluded from the runtime closure unless also required for production. Static output contains the actual built directory. The worker rejects background processes after the original tests, removes its disposable install/build/tool trees, then materializes and starts the exported closure with a clean production environment. It checks shutdown and unchanged exported bytes before issuing a receipt. Neither a lingering test server nor an absolute reference into the former build tree can substitute for the compiled runtime.

BuildOutputReceipt2 records a bounded gzip payload with source/plan/file hashes and executable/link metadata. It uses the existing output store, serialization, quota and CodeRepairJob. Receipt1 and its frontend limits are preserved. No SQLite migration, second registry, runner, budget or policy engine is added.

Deterministic packaging adds a pinned-image Dockerfile, fixed materializer/host and component manifest to a private derived copy. Original package/workspace/lock bytes remain; an existing `liara.json` is preserved as `liara.original.json`. Opaque compiled bytes enter the archive after source capture, as with existing fullstack compiled output. They cannot replace source paths. The final archive hash binds the full payload. The runtime image performs only materialization/hash checking and starts as uid1000 against root-owned read-only code. It does not install or recompile. A fixed host proxies the unchanged direct Node entry on its reviewed internal port, or serves static assets, and exposes the version proof. CLI starts and pre/post-start hooks require a separate executable contract and are rejected here.

ActionSpec40 extends the existing Docker21 publication with component verification. Docker destination creation reuses22. Application and Store boundaries require the actor-owned successful container job, original plan, persisted output, exact selected archive and fixed host/Dockerfile hashes. An uploaded manifest has no authority. Existing environment/database binding interfaces remain in force. Historical ActionSpec canonicalization is unchanged;29–39 remain available to the data lane.

Observation checks the original primary workload, exact proof and independent APIs; static JS/CSS references must match the saved output hashes. Existing current/READY release, app/account/environment fences and uncertainty/replay journals remain authoritative. A successful component publication ends the Agent run as `partially_completed`, with an explicit whole-workspace/data limitation. It does not discharge the remaining source requirements.

The [official Liara Docker route](https://docs.liara.ir/paas/docker/how-tos/deploy-app/) accepts a selected Dockerfile; the existing adapter sends its established `build.dockerfile` payload. Account availability and an actual Liara release remain unconfirmed. The [current pnpm deploy page](https://pnpm.io/cli/deploy) describes newer pnpm releases; its behavior cannot be assumed for pinned11.19.0. Exporting the actually installed closure avoids a second resolution, a source config rewrite or a lock replacement.

This envelope advances compiled Node and browser components and is reusable engineering groundwork for the fourteen-family mission. It does not establish native PHP/Laravel/.NET/Go/Django/Flask execution, background-consumer effects, production migrations or complete acceptance of Factory feed.

<a id="0048-framework-python-execution"></a>

## ADR0048 — Flask/Django execution

2026-11-02: reuse the Python worker, Agent/web registry, approvals and journals.
Plan10 binds Python3.12, Gunicorn WSGI entry/port and the original framework runner; Action41/42 preserve family identity for publication/destination. Legacy2/11/12 remain unchanged.
Native configuration must be explicit; dependency versions are pinned and wheels hash-checked. Django settings/static/message mutations and source repair are unsupported in this slice; data authority is unchanged.
Publication requires the successful actor-owned source artifact, original workload and matching reviewed environment. Destination creation checks local build evidence independently of future cloud env.
[Checks and limits](../evidence/runtime.md#framework-python). Live Liara is unavailable; no cloud/model write is tested or authorized here.

<a id="0049-exact-compiled-go-publication"></a>

## ADR0049 — Compiled Go through the existing publication path

Accepted, 2026-11-02. Plan11 runs the original module lock and Go tests with SHA-pinned Go1.25.14 in the existing network-none worker. A second fresh worker tests the exported binary without the compiler/cache/build tree; failed, skipped or absent tests cannot produce an artifact.

Receipt3 and the selected archive bind actor/job/source/plan/binary/recipe. Docker destination22 and publication43 reuse existing approval, environment, journal and release/workload checks; the destination does not reinstall modules or compile source. A fixed host serves the compiled proof and proxies to the original Go port.

Trade-off: an exact Linux/amd64 pure-Go binary and fixed Docker envelope are reproducible locally; this adds a Node host and supports one explicit executable, not native Liara rebuilding, cgo, Go workspaces, source repair or independent workers. Data requirements remain in the existing source contract; no migration, resource authority or second engine is added. [Evidence and remaining limits](../evidence/runtime.md#go-compiled-runtime).

<a id="0050-installed-php-and-laravel-artifacts"></a>

## ADR0050 — Installed PHP/Laravel through the existing publication path

Accepted, 2026-11-02. Plan12 uses pinned PHP8.3.36/Apache, Composer2.11.1 and a checksum-verified Debian unzip tool. It retains the original Composer lock, scripts/hooks and PHPUnit configuration, checks actual platform requirements and exports the production vendor closure after removing dev dependencies through Composer itself.

A second network-none worker tests the installed bytes with Apache without Composer/cache. Receipt2 and the existing archive/output store bind actor/job/source/plan/vendor/recipe. Docker destination22 and publication44 reuse existing approvals, environment verification and journals; destination installation is unnecessary. No root dependency, SQLite migration or data authority is added.

Trade-offs: one explicit document root/version and PHPUnit runner are supported; separate frontend builds, background components, custom repositories/configuration, other versions and Composerless PHP remain open. Code leaves under namespaces such as Auth/Passwords stay code; private data paths and private input bytes remain blocked. Generated build proof cannot substitute for application behavior in compiled builds or artifact selection. [Evidence](../evidence/runtime.md#php-installed-runtime).
