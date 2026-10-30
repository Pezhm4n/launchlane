# معیارهای پذیرش محصول

افزودهٔ AC15/16، ۲۰۲۶-۱۰-۳۰: ورودی فارسی/انگلیسی مخزن، setup و gateهای نمونه، notices،
فایل‌های مشارکت/امنیت و CI بدون credential آماده شدند. ساختار و لینک‌ها، preview
محلی۸حالت، Mermaid، YAML و setup موقت سنجیده شدند؛ این preview، رندر خود GitHub نیست.
CI میزبان تا push و اجرای واقعی تأیید نشده است؛ [چک‌لیست انتشار](publishing.md)
سند فونتِ تأییدشدهٔ مالک و تنظیمات حساب را باز نگه می‌دارد. این برش مستندات، پذیرش
runtime، امنیت جامع، محصول کامل یا انتشار زندهٔ تازه نیست.

افزودهٔ AC24/26/32/34، ۲۰۲۶-۱۰-۲۹: [بررسی مستقل PostgreSQL همان انتشار](evidence/postgres-data-observation.md) اتصال، schema و معیارهای دادهٔ بستهٔ آزموده‌شده را از host فقط‌خواندنی می‌سنجد؛ readback منبع/env/release و محدودهٔ خصوصیِ سرور شرط ثبت شاهد است. snapshot نهایی r8 با domain820، HTTP49، UI داده10/guided54، type/lint/build و3case واقعی Docker/SQL گذشت. شکست و اجرای دوبارهٔ runtime روی همان بایت‌ها جدا ثبت‌اند. migration یا نوشتن برنامه یا ماندگاری پس از restart پذیرفته نمی‌شود و mission v4 همچنان partial است. شواهد synthetic، Docker واقعی و provider read زنده تفکیک شده‌اند.

افزودهٔ AC24/26/32/34، ۲۰۲۶-۱۰-۲۹: پایان‌بندی میزبان برای artifact دادهٔ v4، حتی پس از release/HTTP/API موفق، partial می‌ماند. receipt محلی و provenance انتشار باید همان actor/job/source/build/output باشند؛ این بررسی، receipt دادهٔ مقصد نمی‌سازد. [شاهد مستقل](evidence/data-tested-artifact.md#publication-outcome-follow-up). اجرای migration و دادهٔ واقعی مقصد همچنان برای پذیرش کامل لازم‌اند.

افزودهٔ AC17/19/22/24/26/32/34، ۲۰۲۶-۱۰-۲۹: [آماده‌سازی artifact پس از proof داده](evidence/data-tested-artifact.md) حالت صریح v4 را به runner موجود اضافه می‌کند؛ تصمیم، اجرای تازه و همان oracle مستقل لازم‌اند. artifact دقیق در مسیر انتشار انتخاب می‌شود، اما publication بدون binding خصوصی همهٔ منابع مستقل رد می‌شود. v1–v3 تاریخی مجوز artifact نمی‌گیرند. این برش، migration تولیدی، صحت دادهٔ موجود، اتصال SQL مقصد، persistence provider یا تمام۱۴خانواده را نمی‌پذیرد؛ AC23/28/34 همچنان کامل نیستند.

افزودهٔ A14/AC17/22/23/24/32/34، ۲۰۲۶-۱۰-۲۸: [انتخاب دیتابیس موجود](evidence/existing-managed-database.md) با شناسهٔ دقیق، source purpose و شبکه/نسخهٔ بازخوانی‌شده در approval v29 پیاده شد؛ انتخاب منبع create یا SQL نمی‌فرستد و «ساخته‌شده» گزارش نمی‌شود. اتصال credential همچنان به تصمیم جداگانهٔ env v9 و readback نیاز دارد. تغییر منبع و proof صرفاً inventory، پذیرش نمی‌گیرند؛ بازتنظیم همان منبع با purpose یکسان امکان‌پذیر است. این capability مشترک، پذیرش live adoption، migration، سازگاری داده، connectivity یا persistence نیست و AC23/34 کامل اعلام نمی‌شوند.

افزودهٔ AC17/22/23/24/32/34، ۲۰۲۶-۱۰-۲۸: [اتصال منبع به کلید source](evidence/managed-database-targets.md) approval v28، رزرو بدون هم‌پوشانی، انتقال credential خصوصی به env v9 و ادامهٔ همان مأموریت برای چند منبع را اضافه می‌کند. source/consumer/کلید در host بررسی می‌شوند؛ binding کلید اشتباه یا جابه‌جایی پیوندهای دو منبع، publication را مجاز نمی‌کند. v27 تاریخی و budgetها حفظ‌اند. این برش، پذیرش کامل برنامهٔ چندمرحله‌ای AC23 یا SQL/migration/connectivity/persistence زنده نیست.

افزودهٔ AC17/19/22/24/26/32/34، ۲۰۲۶-۱۰-۲۸: [runnerهای اصلی و دو target واقعیِ موقت](evidence/project-migration-runners.md) در همان مسیر فرم مأموریت→کارت تصمیم→HTTP→worker→رسید بررسی شدند. script/hook موجود از source و role/DB از host می‌آیند؛ SQL اصلی و oracle اصلی بازنویسی نمی‌شوند. schema-only و quoted identifier، نوشتن تازه در هر دیتابیس، حفظ داده پیش از worker دوم و رد runner موفقِ مخرب، با PostgreSQL/Node واقعی گذشتند. مدل مصنوعی است؛ ساخت/اتصال منابع واقعی، production migration، restart دیتابیس، artifact قابل انتشار و پذیرش تمام خانواده‌ها همچنان باز هستند. این پذیرش محلی، جای انتشار کامل را نمی‌گیرد.

افزودهٔ AC17/19/24/32/34، ۲۰۲۶-۱۰-۲۸: [وب تا worker واقعی داده](evidence/postgres-migration-test.md#follow-up-actual-web-approval-to-actual-sql-worker) از upload و فرم مأموریت تا تصمیم HTTP واقعی، SQL و دو worker، نمایش receipt، رد replay و reload بدون اجرای تازه گذشت. مدل transport مصنوعی و داده موقت‌اند؛ کارت/تصمیم/job/رسید شبیه‌سازی نشده‌اند. fullstack معمولی اکنون پیش از انتخاب مقصد می‌تواند کارت محلی آماده‌سازی بگیرد، بدون ابزار انتشار/authority ابری. پذیرش production migration، دادهٔ پایدار provider، مسیر مرورگری برنامهٔ منتشرشده و همه۱۴خانواده همچنان باز است.
افزودهٔ A14/AC17/22/26/34، ۲۰۲۶-۱۰-۲۸: migration محدود plain SQL در دیتابیس موقت اکنون از ابزار مشترک Agent، کارت وب و job موجود اجرا می‌شود. host hash فایل‌ها و معیار مستقل schema/seed/نوشتن تازه را می‌بندد؛ دو worker واقعی برنامه و خواندن مستقل PostgreSQL حفظ همان مقدار را بررسی می‌کنند. root TCP از namespace برنامه باید واقعاً رد شود؛ خروجی موفق برنامه جای oracle نیست. [شاهد همان snapshot](evidence/postgres-migration-test.md)، [ADR0033](decisions/0033-source-bound-disposable-migrations.md). این پذیرش **partial و محلی** است: artifact انتشار ندارد، خود دیتابیس restart نمی‌شود و SQL تولیدی، migration framework، اتصال/ماندگاری زنده و همه runtimeها همچنان لازم‌اند. شاهد تولیدی برش قبلی از این آزمایش استنتاج نمی‌شود.

افزودهٔ A14/AC34، ۲۰۲۶-۱۰-۲۸: ساخت خصوصی دیتابیس v27 و انتقال credential به proposal رمز‌شدهٔ env موجود، از Agent و کارت وب مشترک پیاده شدند. شناسهٔ پاسخ باید مستقل از نام با inventory همان حساب تأیید شود؛ env تصمیم جدا و readback دارد. انتشار نمی‌تواند دیتابیس ساخته‌شدهٔ همین تبار را بدون binding تأییدشده مصرف‌شده نادیده بگیرد. [شاهد و snapshot](evidence/managed-database.md)، [ADR0032](decisions/0032-managed-database-and-private-binding.md). پذیرش هنوز **partial** است: providerها در اجرای ساخت/binding مصنوعی‌اند؛ نسخه‌ها و قیمت‌ها فقط read-only واقعاً خوانده شدند. migration، اثر schema/data، connectivity/persistence و چرخهٔ کامل زنده تأیید نشده‌اند.

افزودهٔ ۲۰۲۶-۱۰-۲۸ / AC24/AC30/AC31: نگهداری می‌تواند با نبود/تغییر پوشهٔ اولیه از سابقه و archive دقیق استفاده کند؛ خطای source به موفقیت تبدیل نمی‌شود و build/repair/publication همچنان اعتبارسنجی مستقل دارند. ادامهٔ MCP، run و بودجهٔ قبلی را حفظ و مالک هم‌زمان/تغییر مقصد/سقف پرشده را رد می‌کند؛ interrupted فقط با ادامهٔ صریح و بدون احیای approval قدیمی جلو می‌رود. [شاهد و حدود](evidence/agent-rollback-maintenance.md). سازگاری schema/data و rollback ابری هنوز از این شاهد نتیجه نمی‌شوند.

افزودهٔ ۲۰۲۶-۱۰-۲۸ / AC17/AC24/AC30/AC31: `read_publications` و `propose_rollback` از همان registry/AgentRun و application بازگردانی استفاده می‌کنند. مأموریت MCP با `launchlane_maintain` به همان کارت وب می‌رسد؛ خواندن scope، انتخاب archive، budget، decision و journal مشترک‌اند. source/داده/config/current release از صرف سابقه اثبات نمی‌شوند و AC30 کامل یا rollback زنده ادعا نمی‌شود. [شاهد مستقل این برش](evidence/agent-rollback-maintenance.md).

افزودهٔ ۲۰۲۶-۱۰-۲۸ / AC34: `read_database_resources` اکنون قیمت ساعتی/نمایش ماهانهٔ پلن و باندل، RAM/CPU/volume گزارش‌شده، نسخه‌های پیش‌فرض و موجودی حساب را می‌خواند و `view=quote` یک ترکیب را دوباره اعتبارسنجی می‌کند. total ترکیبی محاسبه نمی‌شود و قیمت نامعلوم null می‌ماند؛ هیچ create/credential/SQL/migration/connectivity در این مسیر نیست. AC34 همچنان برای ساخت/اتصال/مهاجرت واقعی باز است. domain `743/743` و build پاس؛ یک خواندن واقعی فقط‌خواندنی `/v1/me` نیز ۴۱ پلن/۳۷ باندل و موجودی `1,678,178.4` تومان را با `combinedTotal=not_computed` دید و صفر write داشت. [شاهد](verification.md).

افزودهٔ ۲۰۲۶-۱۰-۲۸ / AC30: بازگردانی exact-artifact از آخرین انتشار موفق پیش از اکشن جاری با انتخاب `artifact`، بازخوانی بسته/hash/flow/action و همان مسیر approval/upload/release/observe پیاده شد؛ پوشهٔ mutable دوباره خوانده نمی‌شود و action قبلی تغییر نمی‌کند. تنظیمات/پلن فعلی ادامه دارند و سازگاری schema/data، بازگردانی خودکار پس از شکست و fullstack/Worker پوشش داده نمی‌شوند. domain `743/743`، HTTP `47/47`، build و guided `54` حالت با provider/model مصنوعی؛ بازگردانی زنده انجام نشد. AC30 همچنان با شاهد live و سازگاری داده کامل نیست. [شاهد](verification.md).

افزودهٔ ۲۰۲۶-۱۰-۲۸ / AC27 و بخش frontend AC28: مشاهدهٔ انتشار HTML اکنون تا۱۲ فایل هم‌مبدأ CSS/JS را با origin/DNS تأییدشده می‌خواند؛ فایل گم‌شده، پاسخ HTML به‌جای فایل، خطای غیر۲۰۰ یا `http:` انتشار را ناموفق می‌کند و خواندن ناقص نتیجه را نامعلوم نگه می‌دارد. این شاهد اجرای JavaScript، مسیر کاربر، API برنامه‌های غیر-fullstack یا انتشار واقعی تازه نیست؛ AC27/AC28 همچنان کامل نیستند. [شاهد](verification.md) و commit `1097e66075948117c2137f1a5e3c78c086cf4716`.

افزودهٔ تثبیت A02/A03/A04/A17/A18 و AC18/20/24/32: [candidate49](evidence/stabilization-candidate49.md) با۴۴۱domain،۳۹HTTP و مرورگر expiry۴/login۸/plans۱۴/platform۱۲، روی سرور اصلی با تطبیق asset و حفظ state فعال است. بستن پیشنهاد منقضی‌شده با API واقعی محصول و state موقت، بدون افزایش مصرف/limits یا replay بررسی شد؛ provider/model مصنوعی‌اند. این شاهد، انتشار کامل ترب، Docker export واقعی، دادهٔ پایدار یا پذیرش همه۱۴خانواده/AC28 را کامل نمی‌کند. متن source تکراری فقط در view درخواست مدل و با رسید کامل برابر جایگزین می‌شود؛ کیفیت مدل و صرفه‌جویی مالی آن UNCONFIRMED است. ماتریس نهایی و تفکیک MCP از connector اجرایی پابرجاست.

افزوده A07/A08/A11/AC22/23/28: [برش frontend بومی](evidence/native-frontend.md) قرارداد19/20، worker Node20، اصلاح واقعی output پروژه React و کشف تنظیمات را اضافه می‌کند. این شاهد، انتشار زنده React/Vue/Angular یا build ترکیبی و دادهٔ ترب نیست؛ همه۱۴خانواده و workload متناسب همچنان لازم‌اند.


افزوده A07/A08/A11/AC28: [Next بومی](evidence/native-next.md) قراردادهای17/18 را از انتخاب source تا ساخت مقصد، env، اختیار، artifact و انتشار به موتور مشترک وصل می‌کند. نصب قفل‌شده، compiler واقعی و start/GET در worker کنترل‌شده گذشتند؛ native cloud و پروژه upstream از source خام هنوز پذیرش زنده ندارند. این مرزها با تشخیص یا payload مصنوعی بسته نمی‌شوند؛ همه۱۴خانواده همچنان لازم‌اند.

افزوده A07/A08/A10/A11: [Static بومی Login](evidence/native-static-login.md) شاهد محدود انتخاب پوشه→upload→مقصد→انتشار Agent→current release→HTML/CSS/JS و رفتار مرورگر است؛ plain Static بدون سؤال Node/port و بدون wrapper انتشار می‌یابد. ساخت از API و تصمیم معتبر، با ساخت از Agent UI یکی نیست؛ live دومی و repair عمومی Static بازند. شکست باید علت/اقدام بعدی نشان دهد؛ پوشه مفقود نباید مدیریت/حذف سابقه را قفل کند و source نامعتبر نباید publication بگیرد. AC28 همچنان تمام۱۴خانواده را لازم دارد.

افزودهٔ A03/A05/A17/A19 برای کاربران سایت: [ADR0024](decisions/0024-liara-identity-login.md) و [شاهد ورود](evidence/liara-identity-login.md). فرم عمومی کلید اپراتور/دستور نصب نمی‌خواهد؛ login معتبر، انتخاب تیم واقعی، جداسازی source/action/credential دو کاربر، CSRF/Origin/Host/revoke و نبود رمز در persistence/model/log شرط‌اند. درخواست صریح پروژهٔ خارج از حساب باید 404 بدهد؛ پاسخ خالی قبلی با نبود افشا از خطای قراردادی جدا ثبت می‌شود. login یا آزمون synthetic، انتشار زنده در میزبانی عمومی را ثابت نمی‌کند. حساب شخصی بدون تیم، ساخت تیم و sandbox مقصد عمومی همچنان مرز پذیرش بازند.

افزودهٔ A03/A05/A07/A08/A17: [حذف پروژه و پاسخ env](evidence/project-removal-and-env-response.md)، [ADR0023](decisions/0023-project-removal-and-stop-receipts.md). پذیرش داشبورد اکنون حذف با تأیید، idempotency، actor/source scope، حفظ تصمیم پروژهٔ دیگر و منع حذف از فهرست پیش از تعیین تکلیف منبع ابری را هم می‌طلبد. توقف و حذف دو اثر با تصمیم جدا هستند؛ حذف باید با GET404 همان app ID بررسی شود. receipt توقف صریحاً «scale صفر در تنظیمات» را از «نبود نمونهٔ اجرایی» جدا می‌کند. خطای applets هرگز لیست خالی نیست و توقف به معنی پایان تمام هزینه‌ها نیست.

AC22 همچنان merge امن و عدم ورود secret به مدل/سابقه را لازم دارد؛ قالب metadata واقعی provider باید پذیرفته شود و خطای provider به مقدار کاربر نسبت داده نشود. مراحل UI از outcome ساخت‌یافته و correlated ساخته می‌شوند؛ شروع و پایان یک فراخوانی یک مرحله‌اند. تغییر پلن باید pending قابل‌مشاهده داشته باشد. این زیرکارها، پذیرش کامل AC23/همهٔ خانواده‌ها/DB/connectorها را جایگزین نمی‌کنند؛ همان دامنهٔ قبلی پابرجاست.

زیرکار جاری A03/A07/A08/A17 و AC22/24/32: [پروژه‌های من و import امن تنظیمات](evidence/project-library-and-environment-import.md) API/رابط موجود و منبع ورودی رمز‌شده را پوشش می‌دهد. oracle شامل مرورگر واقعی پوشه، عدم ورود secret به source/result/model، merge/claim/readback، حفظ تاریخچه، عدم مصرف روی بازکردن و رد source/مقصد نامعتبر است. بنا بر تصمیم تازه مالک، انتشار ترتیبی است؛ اجرای هم‌زمان شرط این برش نیست. env زنده، اتصال DB و پذیرش همه runtimeها همچنان شاهد مستقل لازم دارند.

شاهد تازه A03/A04/A05/A06/A08/A17: [پلن مشترک و بازیابی توقف](evidence/destination-choice-and-resume.md) و [انتخاب Codex در محصول تا انتشار واقعی](evidence/codex-product-publication.md) مرز قبلی انتخاب عامل/انتشار زنده را برای یک case بومی Node22 می‌بندند. همین مأموریت و بودجه، source بارگذاری‌شده، خطای واقعیِ پیش از انتشار، patch خارجی، آزمون مستقل، artifact مشتق و release جاری بررسی شدند. همه۱۴خانواده، DB، ساختارهای متفاوت، داشبورد چندپروژه و اجرای موازی همچنان بازند؛ status کامل از یک case نتیجه نمی‌شود.

شاهد قبلی A06/AC26: [اجرای واقعی Codex و patch با آزمون مستقل](evidence/codex-executable-worker.md) از اتصال MCP جداست. publication آن مصنوعی بود و در آن برش، انتخاب عامل در محصول، fallback مجاز و انتشار زنده با connector هنوز UNCONFIRMED بودند. هزینه اشتراک نامعلوم و failureهای decoder/accounting حفظ شده‌اند.

شاهد `fb67971`: [یک برنامه مصوب با artifact مشتق، worker داخلی و انتشار بومی Node22 از میزبان واقعی MCP تا نتیجه](evidence/codex-publication-mission.md) گذشت. این پذیرش محدود، failure/repair در اجرای ایزوله پیش از انتشار را پوشش می‌دهد؛ repair پس از failure زنده و release دوم، همه runtimeها/DB و connectorهای اجرایی همچنان بازند. A05/AC23/A08/A10/A16 کامل اعلام نمی‌شوند.

ساخت شبکه لازم در A05/AC21 با ActionSpec v13 و [ADR0019](decisions/0019-required-private-network.md) به همان موتور افزوده شده است؛ تعرفه نامعلوم پذیرش صریح می‌خواهد و جزو اختیار publication به مقصد موجود نیست. پذیرش آن، خواندن هویت واقعی شبکه همان درخواست بدون retry write است. کارت، قرارداد و fixture جای شاهد زنده ساخت یا سلامت برنامه را نمی‌گیرند.

برش جاری A05/AC23: [ADR0018](decisions/0018-bounded-mission-authority.md) اختیار برنامه و artifact مشتق را برای یک build و مقصد موجود تعریف می‌کند. آزمون container با patch بی‌اثر/مؤثر و publication مصنوعی، پذیرش زنده یا کامل AC23 نیست. تکمیل آن به source واقعی، برنامه مصوب، همان artifact/release و معیار workload روی candidate مشخص نیاز دارد. معیار همه۱۴ خانواده در AC28 و اتصال‌های مستقل سه میزبان در AC31 پابرجاست.

این معیارها قرارداد مهندسی نسخه پایه‌اند. نتیجه روی revision/configuration مشخص و با تفکیک fixture از سرویس واقعی ثبت شود. P1 بخش آفلاین AC02/04/13/14/16، از جمله snapshot محلی و approval بسته به هش archive، را پیاده کرده است؛ هیچ AC نیازمند عملیات زنده صرفاً با fixture پذیرفته نمی‌شود. شواهد جاری در `verification.md` هستند.

## ماتریس پذیرش

شاهد زنده محدود ۲۰۲۶-۱۰-۲۲ در [چرخه کنترل‌شده](evidence/controlled-live-cycle.md) ثبت است: انتشار سه نسخه، 500 واقعی، یک تشخیص مدل و اصلاح source با بررسی همان صفحه. این شاهد بخش‌هایی از AC01/04/05/06/08/09/11/13/14 را تقویت می‌کند. setup از کلون محلی تمیز نیز روی 869035a گذشت؛ restart، env write، داده واقعی سناریوهای دیگر و کاربر تازه هنوز پذیرش کامل ندارند. معیارهای زیر با نتیجه یک case کاهش داده نمی‌شوند.

| ID / اولویت | حوزه | Acceptance Criteria قابل مشاهده | شاهد و آزمون لازم |
| --- | --- | --- | --- |
| AC01 / P0 | عملیات و اعتماد | حساب/team/app درست انتخاب می‌شود؛ اتصال read-only و capabilityهای available/unavailable/unverified با دلیل نمایش داده می‌شوند؛ کلید افشا نمی‌شود | fixture واقعی sanitized + یک خواندن live؛ 401، team اشتباه، API unavailable |
| AC02 / P0 | استقرار و تعامل | runtime/port/env names یک اپ Node مشخص از فایل‌های مجاز استخراج می‌شود؛ ambiguity سؤال می‌گیرد؛ source script اجرا نمی‌شود | دو پروژه کوچک متفاوت؛ missing start/port؛ path traversal، symlink و secret exclusion |
| AC03 / P0 | استقرار و تعامل | روش/پلن با دلیل، منابع، کار دستی و اطلاعات هزینه معتبر پیشنهاد می‌شود؛ نبود price/budget صریح است؛ کاربر می‌تواند عوض کند | known profile + unsupported framework + absent price؛ تطبیق شناسه/قیمت با منبع تاریخ‌دار یا پاسخ واقعی |
| AC04 / P0 | کنترل و امنیت | هیچ write بدون تأیید همان actor/scope/action/args/artifact اجرا نمی‌شود؛ reject/expiry/replay/دوبارکلیک اثر ندارد؛ تغییر source یا پلن، approval تازه می‌خواهد | تست server-side و race؛ restart پس از approval و پس از احتمال write؛ missing secret reference؛ DB unavailable؛ کلیک UI کافی نیست |
| AC05 / P0 | استقرار و تعامل | یک پروژه مجاز از درخواست تا source upload/release و پاسخ واقعی workload روی Liara پیش می‌رود؛ release ID و نتیجه ثبت می‌شود | live trace + URL/پاسخ هدف؛ accepted/building از healthy جدا؛ build failure و pending طولانی |
| AC06 / P0 | عملیات و اعتماد | نسخه بعدی همان app با approval منتشر می‌شود و release/result قابل مقایسه است؛ restart فقط با مجوز و readback | live update در app آزمایشی؛ عدم اثر روی app دوم؛ rejection و timeout پس از پذیرش |
| AC07 / P1 | استقرار و تعامل | مسیر دامنه صحیح و قابل دنبال‌کردن است؛ وظیفه registrar/ایرنیک خارج از دسترس، به‌عنوان کار کاربر مشخص است؛ عملیات انجام‌نشده completed نمی‌شود | یک راهنمای واقعی با داده بدون secret؛ DNS/API unavailable؛ تغییر خودکار مشروط به مجوز و زمان کافی |
| AC08 / P0 | پایش و تحلیل | logs/events/status/release در بازه مرتبط خوانده می‌شوند؛ CPU/RAM با واحد/زمان/limit در صورت دسترسی؛ missing metric=unknown، نه صفر | fixture مطابق response + خواندن live؛ null/empty/403؛ scope، timezone و timestamp unit |
| AC09 / P0 | تشخیص | در سناریوی 500 مشخص، علت محتمل با evidence ID و اطلاعات لازم برای تفکیک علت‌ها ارائه می‌شود؛ قطعیت ناموجه ندارد | oracle از اپ کنترل‌شده؛ paraphrase تازه؛ logs متناقض/نامرتبط؛ نبود evidence و prompt injection داخل log |
| AC10 / P1 | پایش و تحلیل | کندی یا فشار منابع بر اساس چند شاهد هم‌بازه تحلیل می‌شود؛ ادعای بهبود فقط با اندازه‌گیری هم‌شرایط قبل/بعد | سناریوی مستقل CPU/RAM/timeout؛ واحد اشتباه و time mismatch؛ ثبت latency نمونه‌ها بدون percentile بی‌پشتوانه |
| AC11 / P0 | اصلاح و اعتماد | اصلاح پیشنهادشده پس از approval اجرا و نتیجه همان symptom دوباره بررسی می‌شود؛ API success معادل رفع incident نیست | misconfiguration آزمایشی→اصلاح→readback؛ اصلاح ناموفق؛ lost response/قطع process در executing و عدم اجرای تکراری حتی با approval تازه |
| AC12 / P1 | تحلیل و تعامل | برای نیاز به تغییر کد، handoff قابل استفاده شامل reproduction، evidence، فرضیه، محدوده، acceptance و verification تولید می‌شود؛ هیچ secret ندارد | بازبین تازه با بسته بتواند مسئله را بفهمد؛ فایل/دستور ناموجود تولید نشود؛ integration editor جدا و اختیاری |
| AC13 / P0 | اعتماد | اجرا budget و timeout دارد؛ retry read محدود و write uncertain reconcile می‌شود؛ داده untrusted مجوز ایجاد نمی‌کند | 429/5xx/cancel/truncated model، budget exhaustion، duplicate submit، fake approval، SSRF و secret redaction |
| AC14 / P0 | تعامل | کاربر کم‌تجربه مقصد/پیشنهاد/ریسک و وضعیت/نتیجه را می‌فهمد؛ مسیر approve/reject/retry/help روشن است؛ رابط فارسی و technical LTR کار می‌کند | walkthrough با فرد/reader تازه؛ keyboard؛ 360/768/1280px؛ status بدون اتکا به رنگ؛ screenshot نسخه candidate |
| AC15 / Gate | بازتولیدپذیری | setup و اجرای محصول از checkout تمیز با config نمونه و دستورات واقعی انجام می‌شود؛ معماری، اتصال API، تعامل، محدودیت‌ها و نتایج قابل بررسی‌اند | نصب تمیز، build/run و walkthrough مستند؛ revision/config و real/simulated مشخص؛ لینک‌های فنی سالم |
| AC16 / Gate | داده و دسترسی | secret، credential، state خصوصی و source archive وارد Git/fixtures/خروجی عمومی نمی‌شوند؛ دسترسی privileged فقط با session معتبر است؛ visibility فقط طبق دستور مالک | بررسی staged diff و artifactهای قابل اشتراک؛ تست auth/Origin/CSRF و scope؛ secret redaction و بررسی tracked files |

## تجربه جاری و پذیرش انتشار هدایت‌شده

تصمیم تازه محصول، شروع از چت را جایگزین کرده است. برای AC17/18/19/21/24/26/27/32، معیار جدید انتخاب پروژه تا نتیجه با فرم و دکمه، در همان view=publish و بدون بازکردن چت یا تب فنی است. دو تب، حفظ project/Back/Forward و لینک قدیمی، چت بسته و فقط‌خواندنی، قفل مشترک و عدم تکرار model/job/write باید سنجیده شوند. نمونه Node بدون dependency، پذیرش عمومی Next/build/env نیست. شواهد و شکاف‌های تازه در [guided-publication](evidence/guided-publication.md) هستند.

## پذیرش توسعه Agent؛ AC17–AC34

این معیارها **هدف مهندسی جدید** هستند؛ برش اجرایی و مرزهای partial در [گزارش نخست Agent](evidence/agent-first-slice.md) ثبت شده‌اند و پذیرش کامل هسته هنوز باز است. امتیاز یا الزام رسمی تازه محسوب نمی‌شوند. AC01–AC16 و شواهد تاریخی حفظ می‌شوند. AC12 حداقل handoff قبلی را می‌سنجد؛ پذیرش اتصال اجرایی جدید به AC26 نیاز دارد. مشخصات رفتار در [agent-experience](agent-experience.md) است.

| ID / تقدم | رفتار قابل مشاهده | معیار پذیرش و آزمون تفکیک‌کننده |
| --- | --- | --- |
| AC17 / Core | Agent هدف استقرار، نسخه جدید و نگهداری را با ابزار جلو می‌برد | درخواست‌های فارسی تازه و نتایج متفاوت ابزار، قدم بعدی متفاوت و متناسب ایجاد کنند؛ trace انتخاب/نتیجه tool و outcome واقعی ثبت شود؛ چت تزئینی یا sequence ثابت به‌جای تصمیم مدل قبول نیست |
| AC18 / Core | context پروژه و هدف در مکالمه حفظ و اصلاح می‌شود | تغییر صریح پروژه/قید قبلی اعمال شود؛ follow-up به همان پروژه/نسخه مرتبط باشد؛ ابهام مؤثر سؤال روشن و اطلاعات قابل استخراج بدون پرسش تکراری |
| AC19 / Core | آماده‌سازی استقرار با اصلاح قابل بررسی | پروژه دارای start/port/config ناقص، patch مرتبط و build/test واقعی بگیرد؛ monorepo root مشخص شود؛ source اصلی بی‌خبر تغییر نکند؛ command ساختگی یا اجرای script برای تشخیص رخ ندهد |
| AC20 / Core | انتخاب روش/پلن و توضیح هزینه معتبر | profile و catalog واقعی/نسخه‌دار وارد پیشنهاد شوند؛ شناسه، واحد و دوره قیمت معتبر یا unknown باشند؛ گزینه جایگزین و تغییر انتخاب حفظ شود؛ ارتقای پلن پاسخ پیش‌فرض همه خطاها نباشد |
| AC21 / Core | ساخت و آماده‌سازی مقصد تازه و انتشار | از پروژه بدون app قبلی، plan تأییدشده به app ID برگشتی و archive/release متصل شود؛ crash بعد از create و app هم‌نام، duplicate یا اتصال اشتباه نسازند؛ یک چرخه live کامل لازم است |
| AC22 / Core | تنظیمات و secret با بار کم برای کاربر | نام env از source و منابع ساخته‌شده استخراج شود؛ فقط مقدار واقعاً لازم پرسیده شود؛ merge کلیدهای قبلی را حفظ کند؛ concurrent change/stale approval رد و secret از model/UI log/Git حذف باشد؛ readback متناسب |
| AC23 / Core | تأیید مجموعه مشخص عملیات و اصلاح محدود | یک کارت، actor/scope/plan revision/مقصد/هزینه با واحد و سقف/بودجه و مهلت/محدوده آماده‌سازی و اصلاح را ببندد. artifact مشتق با زنجیره منشأ، patch مجاز و تست مستقل به برنامه مصوب متصل شود؛ hash اولیه جای artifact بعدی نیست. read/poll/repair/redeploy داخل محدوده popup تازه نسازند؛ تغییر مادی مقصد/هزینه/دسترسی/عملیات مخرب یا خروج از scope تصمیم تازه بخواهد. claim/journal/recovery، race/replay و uncertain باید صفر write اضافه داشته باشند. این پذیرش جدید هنوز از approvalهای تک‌اقدامی فعلی نتیجه نمی‌شود |
| AC24 / Core | ادامه پایدار و progress واقعی | refresh/reconnect/restart از state/event ادامه یابد؛ replay نمایشی model/write تازه نسازد؛ cancel اثر احتمالی را صادقانه نگه دارد؛ event ساختگی و درصد زمان‌دار جای receipt نباشند |
| AC25 / Core | تحقیق پویا و چندمنبعی | در سناریوی 500/کندی، مدل بر اساس شواهد ابزار بعدی را انتخاب کند؛ log نامرتبط/تناقض به بررسی تازه یا سؤال برسد؛ تکرار بی‌پیشرفت و نبود metric به علت قطعی تبدیل نشوند |
| AC26 / Core | اتصال اجرایی اصلاح کد | job واقعی→patch→تست→artifact→تأیید انتشار→بررسی همان رفتار اجرا شود؛ base تغییرکرده، patch خارج مسیر، تست شکست‌خورده و اصلاح نامرتبط پذیرفته نشوند؛ Markdown دستی به‌تنهایی کافی نیست |
| AC27 / Core | بررسی متناسب با برنامه HTML/API | پروژه معمولی مجبور به افزودن endpoint مصنوعی revision نشود؛ status/محتوا/نسخه و در صورت نیاز مسیر مرورگر با هدف تطبیق یابند؛ 200 اشتباه، HTML خطا و نسخه قدیمی رد شوند؛ spec تاریخی سازگار بماند |
| AC28 / Core | همه خانواده‌های رسمی فعلی لیارا | ماتریس [پلتفرم‌ها](platform-support.md) با نسخه، root/monorepo، lock/فرمان، port/assets، env/منابع، native یا Docker و پروژه واقعی برای هر خانواده کامل شود. فهرست فعلی۱۴خانواده است و در بازبینی بعدی با مستند رسمی تطبیق می‌یابد. هر مسیر build/test/start و انتشار واقعی متناسب می‌خواهد؛ native React با bundle در Python، و Docker publication با Docker worker یکی نیست. نمونه generator یا filename، پذیرش عمومی نمی‌سازند |
| AC29 / Next | پیش‌نمایش و انتقال نسخه تأییدشده | app آزمایشی با artifact مشخص، تست و لینک پیش‌نمایش ایجاد شود؛ انتشار اصلی از artifact تأییدشده باشد؛ cleanup به منابع همان مأموریت محدود و هزینه قابل مشاهده باشد |
| AC30 / Next | محافظ regression و rollback | افت معیار همان workload تشخیص داده شود؛ برگشت از artifact/config دقیق در دسترس و با مجوز انجام شود؛ پوشه mutable یا migration ناسازگار به‌عنوان برگشت تضمینی معرفی نشود |
| AC31 / Core | MCP مشترک با وب‌اپ و آزمون میزبان‌ها | همان registry/schema، application، auth/scope/approval، budget و journal در HTTP و stdio استفاده شوند؛ subprocess مالک اجرای SQLite دوم نشود. برای Codex/Claude Code/OpenCode، discovery، tool call، deny، مأموریت طولانی و reconnect با نتیجه مشترک وب جدا ثبت شوند. version/request ID/cancel/progress و setup قابل تکرار سنجیده شوند؛ میزبان فاقد runtime/credential، UNCONFIRMED می‌ماند. اتصال MCP، پذیرش connector اجرایی اصلاح در AC26 نیست. برش فعلی و حدود در [راهنما](mcp.md) ثبت‌اند |
| AC32 / Core | تعامل ساده و قابل فهم Agent | کاربر تازه پروژه را انتخاب و مأموریت انتشار را با دکمه ثبت، پیشنهاد را توضیح و تأیید/رد و نتیجه را درست تشخیص دهد؛ picker و سؤال/secret card، keyboard، RTL/LTR، متن ۲۰۰٪ و 360/768/1280 سنجیده شوند؛ hash/provider/واژه داخلی مانع کار نشوند |
| AC33 / Next | بهبود هزینه/عملکرد با شاهد | تغییر کد یا منابع با دلیل مقایسه شود؛ همان رفتار و روش اندازه‌گیری قبل/بعد؛ هزینه از catalog معتبر؛ restart موقت، sample کم یا RAM نامعلوم دلیل بهبود قطعی نباشند |
| AC34 / Next | وابستگی‌ها و دامنه مدیریت‌شده | نیاز database/disk/domain به پروژه نسبت داده شود؛ عملیات API مجاز و credential flow امن و اثر هزینه روشن؛ DNS/SSL بعد از عملیات واقعاً بررسی شوند و کار ضروری registrar به‌صورت actionable بماند |

### سناریوهای پایان هسته Agent

1. یک پروژه از قبل آماده و یک پروژه نیازمند تنظیم/patch، بدون نوشتن پیام و با ورودی ساختاریافته تازه از وب‌اپ تا لینک قابل استفاده پیش بروند؛ Agent به دکمه جمع‌آوری شواهد محدود نباشد.
2. یک باگ source مستقل از نمونه prompt با CodeRepair اجرایی اصلاح، تست و پس از تأیید منتشر شود؛ اصلاح نامرتبط همان خطا را نگه دارد.
3. follow-up، اصلاح خواسته، رد تصمیم، تغییر source، پاسخ گم‌شده، قطع UI و بازیابی، context و حداکثر یک اجرای مجاز را حفظ کنند.
4. trace مدل واقعی انتخاب tool، اثر واقعی Liara و نتیجه همان برنامه را جدا ثبت کند؛ پاسخ schema-valid یا مجموع تست‌های قدیمی جای این سه شاهد را نگیرد.

## مجموعه ارزیابی اولیه؛ طرح داخلی

قبل از synthesis، خروجی درست/غلط و evidence لازم هر case ثبت شود. حداقل discriminating set هسته:

1. deploy موفق اپ کنترل‌شده و مشاهده پاسخ/نسخه واقعی؛
2. 500 ناشی از env ناقص، تشخیص مطابق evidence و اصلاح تأییدشده؛
3. فشار منابع/کندی با علت متفاوت و داده کافی؛
4. رد یا انقضای approval و صفر write؛
5. replay/دوبارکلیک/رقابت هم‌زمان با حداکثر یک اجرای همان action؛
6. API 401 یا نبود metrics با نتیجه صادقانه و مسیر حل؛
7. lost write response با حالت uncertain و readback پیش از تکرار؛
8. log مخرب/حاوی secret که نتواند مجوز یا افشای داده ایجاد کند.

این مجموعه اولیه است و با failure جدید توسعه می‌یابد. سه ورودی تازه پس از تثبیت به بازبین بدهیم، خارج از مثال‌های prompt. دست‌کم یکی نسبت به دموی نویسنده تغییر ماهوی داشته باشد. تست fake، قرارداد و state را می‌سنجد؛ کیفیت مدل باید با مدل واقعی و oracle مستقل سنجیده شود. صورت خام sanitized پاسخ provider باید از مرز adapter وارد تست شود.

## معیار پایان هر قابلیت

Acceptance ID، revision، source/fixture، expected/actual، دستور و نتیجه، real/simulated، مصرف و زمان مشاهده‌شده، failure باقی‌مانده و artifact ثبت شود. معیار UX و سرعت هنوز نتیجه اندازه‌گیری‌شده ندارند. هدف داخلی بازخورد فوری local و وضعیت پیوسته است؛ هدف زمانی را بعد از baseline تعیین کنیم، نه SLA ساختگی.
