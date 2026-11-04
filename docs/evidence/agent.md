# Agent — verification evidence

[Documentation](../README.md) · [Current support](../platform-support.md) · [Verification index](../verification.md)

These versioned records preserve the original decisions, source revisions, failures and evidence limits. Dates and passing counts apply only to the named snapshot, not the current release. Installation-specific locations and identities are omitted.

## Records

- [خواندن catalog و برآورد پلن از Agent](#agent-catalog)
- [نخستین مسیر اجرایی Agent](#agent-first-slice)
- [تحقیق انتخابی Agent درباره خطای صفحه](#agent-investigation)
- [انتشار و اصلاح واقعی از گفت‌وگو](#agent-publication-live)
- [Exact-artifact rollback through the shared Agent — 2026-10-28](#agent-rollback-maintenance)
- [Executable Codex worker — bounded evidence, 2026-10-23](#codex-executable-worker)
- [Product-selected Codex repair through native Liara publication — 2026-10-23](#codex-product-publication)
- [Codex MCP → one real publication and repair mission](#codex-publication-mission)
- [انتخاب عامل و fallback در برنامه — ۲۰۲۶-۱۰-۲۳](#coding-agent-selection)
- [برنامهٔ محدود انتشار و artifact مشتق‌شده — ۲۰۲۶-۱۰-۲۳](#mission-authority)
- [پیوند اصلاح به مأموریت والد؛ ۲۰۲۶-۱۰-۲۳](#repair-parent-binding)
- [آماده‌سازی محدود پروژه Node](#project-preparation)
- [Source investigation, failed-build guidance and secure setup — 2026-10-27](#source-investigation-and-setup-20261027)

<a id="agent-catalog"></a>

## خواندن catalog و برآورد پلن از Agent

تاریخ: ۲۰۲۶-۱۰-۲۲. این شاهد مربوط به حساب آزمایش‌شده و همان زمان است؛ قیمت یا availability عمومی و دائمی نیست.

`LiaraAccountClient` فقط `/v1/me?teamID=...` میزبان ثابت را می‌خواند و ID حساب و تیم را با اتصال انتخاب‌شده تطبیق می‌دهد. schema نسخه‌دار، fingerprint، زمان مشاهده و اعتبار ده‌دقیقه‌ای برآورد وجود دارد. rate منابع و bundle به‌صورت صحیح در صدم تومان جمع می‌شوند؛ رقم نامعلوم صفر نمی‌شود. واحد پایه تومان/ساعت با [قیمت‌های رسمی](https://liara.ir/pricing/) تطبیق داده شد. ظرفیت‌های خام provider به GB یا نیاز اندازه‌گیری‌شده پروژه تعبیر نمی‌شوند. مالیات، ترافیک و ذخیره‌سازی در این برآورد پایه منظور نشده‌اند؛ این برآورد invoice نیست.

خواندن واقعی account-matched، 24 ترکیب موجود و 34 plan غیرموجود را برگرداند. پیشنهاد `small-g2/basic` در snapshot، 1041.66 تومان/ساعت بود. مدل واقعی در runtime Agent، بدون app انتخاب‌شده و با mutation/repair خاموش، `read_destination`، `read_catalog` و دو `quote_resource_plan` را از نتیجه انتخاب کرد. سپس در پنج درخواست مدل، همین گزینه و `medium-g2/basic` با نرخ 1805.55 را پیشنهاد کرد، واحد و دوره و هزینه‌های خارج برآورد را توضیح داد و ظرفیت را نامعلوم نگه داشت. state نهایی partial/reply با question=null بود. هیچ app، env یا deployment ساخته نشد. این چرخه مستقیم runtime/application بود؛ سناریوی مرورگر تازه برای این دو ابزار اجرا نشد.

context حساب مستقل از انتخاب app پایدار می‌شود؛ تغییر اتصال در حین read، نتیجه را رد می‌کند. رکوردهای قبلی با app متصل، هویت حساب را از target تاریخی بازیابی می‌کنند. idempotency با canonical fingerprint مقایسه می‌شود و به ترتیب keyهای JSON وابسته نیست. این تغییر، موتور approval یا semantics اقدامات تاریخی را عوض نمی‌کند.

چهار regression تازه، نرخ اعشاری و bundle، گزینه غیرموجود/قیمت نامعلوم، اعتبار ناکافی، stale/future timestamp، تغییر قیمت، account mix-up، 401/429/503، timeout و gate خاموش را پوشش می‌دهند. مجموعه domain تازه 199/199 بدون skip و lint/typecheck گذشت. build و HTTP19/19 روی export پایه `f94d44b` با فایل‌های backend جاری و UI همان export اجرا شدند؛ پنج suite مرورگر همان export نیز 75/27/27/22/17 حالت را گذراندند؛ این شاهد، ارزیابی نسخه در حال بازآرایی UI نیست.

A04 هنوز partial است: انتخاب ظرفیت پروژه benchmark نشده، دو profile مستقل مقایسه نشده‌اند و برآورد هنوز approval ساخت یا resize نیست. ابزار ساخت مقصد، تغییر plan و تنظیم env جداگانه به قرارداد و journal اجرایی نیاز دارند.

<a id="agent-first-slice"></a>

## نخستین مسیر اجرایی Agent

تاریخ: ۲۰۲۶-۱۰-۲۲، Node 24.18.0، Next 16.4.2. پایه پیش از کار `ef5a3fb`، هسته `b3ebf55` و رابط `6d6926a` است. اصلاح‌های بعدی در `26d984c`، `e1c4c53` و `15aecaa` ثبت شدند. این گزارش پذیرش کامل A00–A19 یا AC17–AC34 نیست. مقادیر حساب، credential، بودجه شخصی و state اجرایی خصوصی در Git قرار ندارند.


<a id="agent-first-slice-تطبیق-a01-با-source"></a>

### تطبیق A01 با source

گراف موجود به نسل ۲۰۲۶-۱۰-۲۱ مربوط بود و پوشش فایل‌های جدید را نداشت؛ برای نتیجه‌های این برش، source دقیق، caller و تست خوانده شدند. absence در graph شاهد نبود قابلیت تلقی نشد. اصلاحات GitHub و runtime/ورود موجود حفظ شدند.

| مرز | وضعیت فعلی و شاهد | شکاف بعدی |
| --- | --- | --- |
| انتخاب source، inspect و archive | implemented_verified؛ application/project-flows، workspace/inspect و archive، آزمون‌های قبلی و regression جاری | پشتیبانی آماده‌سازی runtimeهای بیشتر |
| approval/attempt/deploy/restart موجود | implemented_verified در محدوده تاریخی خود؛ canonicalization v1–v6 حفظ شد | plan چندمرحله‌ای، create/env و نتیجه عمومی HTML |
| حلقه goal→model→tool→result | implemented_verified برای read و اصلاح محدود؛ agent/runs/model/tools، fixture نتیجه‌محور و trace مدل واقعی | ابزار استقرار و completion هدف از خود گفت‌وگو |
| persistence و بازیابی Agent | implemented_verified برای CAS، idempotency، replay، cancel و interrupted؛ migration 8 و agent.test | ادامه خودکار امن اجرای قطع‌شده و planهای چندمرحله‌ای |
| رابط مکالمه | implemented_verified برای تب مستقل، picker و تصمیم اصلاح؛ مسیر واقعی وب و suite مرورگر | فهم با reader تازه، screen reader، secret/provision cards |
| اتصال کدنویسی | implemented_verified برای یک قرارداد محدود native Node؛ job، وصله، آزمون واقعی و artifact | build/dependency، sandbox سیستم‌عامل، runtimeهای دیگر |
| چرخه کامل AC26 | partial؛ نسخه آزموده‌شده انتخاب و آماده مسیر انتشار موجود می‌شود | تأیید انتشار و بررسی همان رفتار سایت از همین job هنوز انجام نشده |
| catalog/provision/env/preview/rollback/MCP | missing در registry Agent این برش؛ ابزار read موجود جای این قابلیت‌ها نیست | A04/A05/A08 و سپس وابستگی‌های A11–A16 |


<a id="agent-first-slice-a06-و-تصمیم-runtime"></a>

### A06 و تصمیم runtime

نسخه نصب‌شده CLI برابر `0.163.0-alpha.10.2` و help واقعی `codex exec` بررسی شد. spike بدون credential و بدون request مدل، `wire_api="chat"` را در config رد کرد و `responses` خواست. این نتیجه فقط ناسازگاری همین اتصال با transport فعلی Chat را ثابت می‌کند؛ حالت Responses، حساب دیگر یا همه قابلیت‌های CLI بررسی نشده‌اند. worker محدود با provider مجاز پشت CodeRepairAdapter قرار گرفت. [ADR انتخاب worker](../decisions/runtime.md#0001-scoped-repair-worker) علت و trade-off را ثبت می‌کند.


<a id="agent-first-slice-جریان-و-اختیار-واقعی"></a>

### جریان و اختیار واقعی

کلاینت فقط goal، project reference، request key، expected revision و تصمیم محدود می‌فرستد؛ system/tool message یا نتیجه دلخواه را نمی‌سازد. `toolsForAgent` شش read و پیشنهاد اصلاحِ مشروط به gate دارد. هر نتیجه با call ID به همان درخواست مدل وصل می‌شود. نام ابزار، آرگومان، actor، source snapshot و هویت مقصد در host کنترل می‌شوند. خواندن release/log از هویت داخلی تازه app عبور می‌کند و نتیجه provider با داده خالی یکی نیست.

اجرای اصلاح سه مرحله دارد: پیشنهاد با snapshot جدا و بدون اجرای کد؛ تصمیم روی actor/session/revision/base/scope با اعتبار محدود؛ و سپس worker با آزمون شکست‌خورده اولیه، وصله و همان آزمون تغییرنکرده. worker و مدل اصلی سقف تجمعی model/tool/time همان run را مصرف می‌کنند. package، dependency، آزمون و فایل خارج scope قابل تغییر نیستند. خروج صفر بدون آزمون واقعی، آزمون skip یا early exit رسید موفق نمی‌سازد. پس از آزمون، source دوباره capture و با نسخه آزموده‌شده مقایسه می‌شود؛ همان archive به project selection نوع repair متصل است. source اصلی حفظ می‌شود.

اجرای آزمون shell ندارد؛ environment credential/NODE_OPTIONS به آن نمی‌رسد و permissionهای Node به workspace محدودند. child process، worker و addon مجاز نیستند. timeout و output cap اعمال می‌شوند. این روش **OS sandbox و جداسازی شبکه نیست**؛ gate پیش‌فرض خاموش است و استفاده از source خصمانه با ادعای مهار کامل پشتیبانی نمی‌شود.


<a id="agent-first-slice-آزمون-مدل-و-مرورگر-واقعی"></a>

### آزمون مدل و مرورگر واقعی

آزمون production ایزوله با مدل واقعی `gpt-6-luna` و `reasoning_effort=none`، mutation و Liara خاموش انجام شد. source، SQLite، picker، API، تصمیم و subprocess آزمون واقعی بودند. پاسخ مدل scripted نبود.

- درخواست انتشار برای پروژه آماده، `inspect_project→read_destination` را انتخاب کرد و نبود حساب مقصد را اعلام کرد. انتشار موفق ادعا نشد. reload هیچ request مدل تازه نساخت.
- درخواست مستقل درباره محاسبه فاکتور، source و آزمون مرتبط را خواند و پیشنهاد فقط `invoice.mjs` با آزمون موجود `invoice.test.mjs` داد. پیش از تصمیم، before/after test خالی بودند.
- پس از تصمیم در وب، baseline واقعی `26 !== 71` بود. worker قیمت را در تعداد هر قلم ضرب کرد؛ همان آزمون پس از اصلاح گذشت. archive ساخته و نسخه آزموده‌شده انتخاب شد؛ فایل اصلی همچنان خراب و دست‌نخورده ماند. مدل سپس مقصد را خواند و فقدان اتصال را قدم بعدی قرار داد. این run هفت درخواست مدل، شامل یک درخواست worker، و هفت ابزار مصرف کرد.
- دو goal این چرخه مجموعاً ده درخواست و ۱۲٬۹۴۲ توکن گزارش‌شده داشتند. usage گزارش provider، صورتحساب تأییدشده نیست. مصرف آزمایش‌های پیشین و نتیجه نامشخص نیز در journal خصوصی تجمعی حفظ شده‌اند.
- این چرخه یک ضعف معنایی هم نشان داد: بعد از اصلاح محلی، مقصد انتشار سؤال ضروری تلقی شد، با اینکه کاربر انتشار را عقب انداخته بود. در `15aecaa` مرز goal روشن‌تر شد. آزمون زنده تازه با تعداد صفر، چند قلم و اعشار، baseline مستقل `26.5 !== 81` و معیار اضافی فاکتور خالی/`3.75` داشت. worker همان آزمون را بدون تغییر گذراند؛ نتیجه محلی با question=null و nextAction=reply پایان یافت و مقصد خوانده نشد. دو goal این چرخه تازه ۹ درخواست و ۱۱٬۷۹۱ توکن گزارش‌شده داشتند؛ run اصلاح شش model و شش tool داشت. این شاهد، همان دو نمونه محدود را پوشش می‌دهد.
- harness زنده یک بار پیش از پایان worker، state queued/working را بررسی و assertion زودهنگام داد. GET مستقل بعدی، job succeeded، baseline ناموفق، آزمون موفق، انتخاب جدید و source اصلی را بررسی کرد؛ اجرای worker یا مدل replay نشد. شکست harness پنهان یا موفقیت کل هسته تلقی نشد.

در آزمون اولیه prompt، مدل برای readiness معمولی فایل‌های بیش از نیاز خواند. دستور «حداقل شواهد لازم برای هدف جاری» روشن‌تر شد؛ inspect شامل runtime/start/port/manifest است و برای انتشار معمولی audit منطق تجاری خواسته نمی‌شود. host نیز وجود سؤال/قدم ضروری را به needs_input تبدیل می‌کند؛ متن مدل به‌تنهایی terminal موفق تولید نمی‌کند. یک نمونه کنترل‌شده، ارزیابی عمومی کیفیت مدل نیست.


<a id="agent-first-slice-regression-و-تعامل"></a>

### regression و تعامل

candidate نهایی: `npm run check` شامل lint/typecheck، domain تازه ۱۸۴/۱۸۴ و bootstrap دو از دو بود؛ build و آخرین `test:http` با ۱۹/۱۹ نیز گذشتند. هیچ skip/failure در این اجراهای کامل نبود. انتقال فرم به تب مستقل، selector قدیمی `document.querySelector("form button[type=submit]")` در تست مرورگر را به composer پنهان می‌رساند؛ انتظار به همان دکمه جمع‌آوریِ کاربر منتقل شد، معیار enabled تغییر نکرد. یک خطای واقعی scroll accessibility نیز با امکان فوکوس transcript اصلاح شد؛ استثنای محلی lint دلیل دسترسی با صفحه‌کلید را کنار attribute توضیح می‌دهد.

دو counterexample دیگر پیش از اصلاح fail شدند: reload پس از انتخاب پروژه دیگر، رسید repair قدیمی را دوباره انتخاب می‌کرد؛ اکنون فقط base همان job قابل ارتقاست. نام آزمون `--help.test.mjs` نیز به‌عنوان option تفسیر می‌شد؛ separator قطعی `--` بین گزینه‌های Node و pathها قرار گرفت و preview/receipt با آن یکسان شد. آزمون جدید، اجرای literal همان فایل را با permissionهای محدود می‌سنجد.

suite جدید `scripts/test-agent-browser.mjs` از API و SQLite واقعی production با transport مصنوعی مدل استفاده می‌کند؛ اجرای Node و فایل‌ها واقعی‌اند. شروع پیش‌فرض بدون فرم‌های انتشار، حفظ draft میان تب‌ها/Back، picker و Escape/focus، reload بدون model replay، رد/تأیید اصلاح، رسید قبل/بعد، 429، cancel، 360/768/1280 و متن ۲۰۰٪ سنجیده می‌شوند. provider مصنوعی این suite شاهد اتصال مدل واقعی نیست؛ چرخه بالا آن مرز را جدا سنجید. نتایج candidate نهایی در verification ثبت می‌شوند.


<a id="agent-first-slice-موارد-باز-و-قدم-بعد"></a>

### موارد باز و قدم بعد

A01 بسته شده است؛ A02/A03/A06/A17/A18 partial هستند. AC26 به انتشار تأییدشده و بررسی همان symptom نیاز دارد و بسته نشده است. ابزار publish/provision/env، هزینه معتبر در پیشنهاد Agent، plan approval چندمرحله‌ای، HTML workload، build/package-manager، streaming، MCP، OS sandbox، reader تازه و screen reader هنوز پذیرفته نشده‌اند. connection/context عوض‌شده مجوز ادامه روی انتخاب قبلی نیست؛ کاربر می‌تواند گفت‌وگوی تازه بسازد. پس از ثبت این برش، A04 و قرارداد plan برای A05/A08 مرز بعدی‌اند؛ current manual deployment و diagnosis، شاهد ضمنی کامل‌شدن آن‌ها نیستند.

<a id="agent-investigation"></a>

## تحقیق انتخابی Agent درباره خطای صفحه

تاریخ: ۲۰۲۶-۱۰-۲۲. برش پس از ab2fa8b تا14336e1؛ A09/AC25. وضعیت: خواندن‌های انتخابی با قراردادها، مدل واقعی و یک چرخه کنترل‌شده وب/PaaS برای دو پاسخ200/500 سنجیده شدند؛ تعمیم کیفیت و سناریوهای دیگر باز است. [ADR 0007](../decisions/agent.md#0007-sre-read-evidence) چرایی و مرزها را ثبت می‌کند.


<a id="agent-investigation-رفتار-پیادهشده"></a>

### رفتار پیاده‌شده

مدل می‌تواند read_workload را برای path همان app انتخاب‌شده و read_metrics را برای فرضیه مرتبط با منابع انتخاب کند. مدل host نمی‌دهد؛ origin از تنظیم مجاز همان actor/team/app می‌آید. همان WorkloadProbe، DNS عمومی و IP pin‌شده، TLS، منع redirect، مهلت شبکه۱۵ثانیه‌ای با تقدم deadline کوتاه‌تر run، سقف64KiB و redaction را نگه می‌دارد. preview مدل حداکثر۴۰۹۶ نویسه است و حذف محتوا مشخص می‌شود. یک نمونه زمان پاسخ، p95 یا ظرفیت نیست و تأیید artifact ایجاد نمی‌کند.

هویت داخلی app پیش/پس از داده و context پس از خواندن کنترل می‌شوند. read_logs با lookbackMinutes یک تا۶۰، پیام خارج از بازه، پاسخ خالی و حذف برای حجم را جدا گزارش می‌کند. بازه از پیش از شروع goal تا زمان دریافت خواندن است؛ شامل query یا host دلخواه نیست. rawPoints منابع با واحد/زمان unverified حفظ و برای مدل محدود می‌شوند؛ omittedPoints داده ناموجود را صفر یا سالم نمی‌کند. سقف24KiB نتیجه ابزار نیز حفظ شده است.

خواندن‌های workload، logs، metrics و releases، ورودی نامعتبر را در application پیش از provider رد و خطا را به همان call ID برمی‌گردانند. مدل می‌تواند در همان بودجه آرگومانش را اصلاح کند. JSON ناقص، ابزار ناشناخته و سایر قراردادهای strict تاریخی همچنان اجرا را متوقف می‌کنند؛ تکرار نامعتبر بودجه را نامحدود نمی‌کند. فیلد داخلی سیاست validation به provider ارسال نمی‌شود. این تغییر approval یا write ایجاد نمی‌کند.


<a id="agent-investigation-regressionها"></a>

### regressionها

هفت آزمون جدید، path/host نامجاز و gate بسته با صفر provider/probe، تغییر ID پیش/پس از خواندن، انتخاب همزمان، DNS خصوصی، redaction، response preview، missing/empty/واحد نامعلوم، پاسخ upstream بزرگ، محدودیت context، 429 بدون retry، لاگ قدیمی/آینده/خالی/حجیم، اصلاح آرگومان، JSON ناقص و مصرف سقف با ورودی تکراری را می‌سنجند. domain کامل234/234، lint محدوده backend، typecheck، build و HTTP21/21 گذشتند. lint/build/HTTP روی export مستقل با UI ثابتِ پیش از4cee36d بودند؛ CSS و componentهای همکار در main در حال تغییرند و در این برش commit نمی‌شوند.


<a id="agent-investigation-ارزیابی-با-مدل-واقعی-و-provider-مصنوعی"></a>

### ارزیابی با مدل واقعی و provider مصنوعی

دو ورودی با goal یکسان و پاسخ متفاوت صفحه اجرا شدند. فقط BoxAPI واقعی بود؛ Liara، DNS و HTTPS در این ارزیابی transport قراردادی مصنوعی داشتند و هیچ حساب ابری تغییر نکرد. نتیجه معتبر دوم،۱۹ فراخوانی مدل و53,128 token گزارش‌شده داشت:

| پاسخ فعلی | خواندن‌های انتخاب‌شده | نتیجه معنایی |
| --- | --- | --- |
| HTTP200 با لاگ اخیر500 | inspect، destination، workload، releases، status، logs، source و metrics | خطا در نمونه فعلی بازتولید نشد؛ گزارش اخیر علت را ثابت نمی‌کند و منابع unknown هستند |
| HTTP500 با release READY | inspect، destination، workload، releases، logs، metrics و سه source read | خطا اکنون مشاهده شد؛ اختلاف quantity در source/test فرضیه محتمل است و رابطه قطعی با500 تأیید نشده؛ داده منابع نامعلوم است |

مدل در هر دو مورد partially_completed/no_remote_changes برگشت، سؤال نامرتبط درباره مقصد و پیشنهاد write نداشت. متن، READY را سلامت صفحه و metric خالی را صفر/OOM تلقی نکرد. این دو case ارزیابی عمومی کیفیت مدل یا شاهد endpointهای Liara نیستند.

آزمون قبلی حفظ شد: case200 خلاصه محتاطانه داشت؛ case500 پس از probe، فیلد خارج قرارداد فرستاد و INVALID_INPUT گرفت. هیچ درخواست نامعتبر به provider نرسید و آن failure به success تغییر نام نداد. سیاست application validation و regressionهای bounded correction برای رفع همین مرز اضافه شدند. JSON ناقص و scope/identity نامعتبر همچنان fail closed باقی‌اند.


<a id="agent-investigation-چرخه-واقعی-وب-و-paas-در14336e1"></a>

### چرخه واقعی وب و PaaS در14336e1

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


<a id="agent-investigation-failureهای-حفظشده-و-حدود-تعمیم"></a>

### failureهای حفظ‌شده و حدود تعمیم

درbbd45cb، چرخه تازه ساخت/انتشار با ID/config، همان archive و تصمیم جدا، HTTP200/متن اصلی و cleanup با ID و404 گذشت. این بار read_workload برای /orders پاسخ واقعی500 و ORDER_TOTAL_MISMATCH با actual=36 و expected=73 را در2.855s ثبت کرد؛ goal در درخواست بعدی مدل با INVALID_INPUT متوقف شد. نام و آرگومان همان فراخوانی ردشده در receipt اولیه ثبت نشده‌اند؛ آن را حدس نمی‌زنیم. سه بازپخش فقط‌مدل از همان شاهد500، بدون اجرای ابزار Liara، هر سه read_releases با کلید خارج قرارداد (`}` یا `call`) تولید کردند و در validation انتقال متوقف شدند. این بازتولید، نقص بازیابی همان خواندن را مشخص می‌کند؛ هیچ ادعای موفقیت SRE از این تلاش نشده است.

read_releases اکنون مانند سه خواندن SRE، exactKeys و required را در application و پیش از API کنترل می‌کند و خطای هم‌بسته به مدل برمی‌گرداند. مقادیر اصلی آرگومان بازپخش ذخیره نشده‌اند؛ regression شکل دو کلید مشاهده‌شده را با مقدار مصنوعی می‌سنجد. تست پیش از اصلاح failed بود و پس از آن، رد بدون API، اصلاح ورودی، یک خواندن واقعیِ قراردادی با دو کنترل هویت و صفر write را تأیید کرد. domain249/249، lint/typecheck/build و HTTP21/21 روی export با UI ثابت گذشتند. خطای JSON، ابزار ناشناخته، قراردادهای strict دیگر و approvalهای write تغییر نکرده‌اند.

برای ادامه روی شبکه این نصب، با درخواست مالک یک واسط خصوصی loopback راه‌اندازی شد که فقط API/model و میزبان دقیق آزمون را می‌پذیرد. socket خروجی Windows با [IP_UNICAST_IF](https://learn.microsoft.com/en-us/windows/win32/winsock/ipproto-ip-socket-options) به کارت فیزیکی مقید و مقدار همان گزینه بازخوانی می‌شود؛ TLS و SNI و اعتبارسنجی گواهی در client اصلی می‌مانند. DNS و proxy/default route/VPN سراسری تغییر نکرده‌اند. مسیر عادی در نمونه اولیه source مربوط به TUN و مسیر مقید source کارت فیزیکی داشت؛ پاسخ API بدون credential در یک نمونه از1.859s به0.500s رسید. این benchmark عمومی یا اثبات علت همه timeoutهای قبلی نیست. native fetch و همان pinnedHttps محصول با پاسخ401 بدون credential و رد توکن واسط/host/IP داخلی/DNS نامعتبر آزموده شدند. این راهکار خصوصیِ نصب Windows است، نه تنظیم پیش‌فرض محصول یا قابلیت شبکه عمومی.

primary main/dev با gateهای مجاز و همین مسیر مستقیم، هدف تازه inspect_project را با دو درخواست واقعی مدل از مرورگر اجرا کرد؛ response render، همان run پس از reload، صفر درخواست مدل برای reload و صفر page error تأیید شدند. UI این نصب شامل کار هم‌زمان همکار است و در commit این برش قرار نمی‌گیرد. چرخه تازه14336e1 در بخش بالا، شاهد جدا پس از اصلاح است؛ failure قبلی موفق نام‌گذاری نشده است.

درea08a40، مقصد تازه با ID واقعی ساخته و همان archive با تصمیم جدا منتشر شد. outcome=verified/WORKLOAD_VERIFIED و200 صفحه اصلی و متن درست، همراه خواندن مستقل عمومی تأیید شدند. reload مدل/write تازه نساخت و پس از تطبیق ID، حذف وabsence404 گذشتند. اما goal تحقیق /orders با PROBE_TIMEOUT پنج‌ثانیه‌ای پاسخ نگرفت؛ model در۵ درخواست و14,518 token گزارش‌شده، workload/release/logs/metrics را انتخاب و وضعیت صفحه و منابع را unknown نگه داشت. READY را سلامت و نبود خطا در log را علت تلقی نکرد. oracleِ مورد انتظار500 پاس نشد و case200 دوم اجرا نشد؛ این تلاش پذیرش کامل SRE نیست.

با توجه به handshakeهای5–7s اندازه‌گیری‌شده، cap انتقال probe از5s به15s تغییر کرد؛ status/محتوای مورد انتظار، عدم retry/redirect، scope، pin، redaction و deadline کوتاه‌تر run تغییر نکردند. پاسخ6s با همان500 در regression ابتدا روی کد قبلی PROBE_TIMEOUT داد، سپس در بودجه12s همان500 را حفظ کرد. این تنظیم، SLA سرعت یا سالم‌بودن پاسخ500 نیست. domain248/248، lint/typecheck/build و HTTP21/21 export ثابت گذشتند. SRE واقعی پس از این تنظیم هنوز در ادامه لازم است.

درb525c18، ساخت تا preflight و POST واحد پیش رفت ولی اتصال POST پس از10.655s نامعلوم شد؛ journal همان uncertain/request_started را حفظ و replay را بست. سه GET بعدیِ سازگار با Pool،404های7.014/0.500/1.067s دادند؛ نبودن فعلی app، receipt ازدست‌رفته را بازسازی نمی‌کند. [ADR 0009](../decisions/agent.md#0009-liara-transport-pool) اندازه‌گیری TLS، Pool محدود فقط برای API و pin سازگار7.30.1 را ثبت می‌کند. ناسازگاری dispatcher8 با native fetch در تست واقعی محلی شکست خورد و به regression تبدیل شد. سه تست تازه، multipart/cancellation و POST بدون replay را روی HTTP واقعی محلی می‌سنجند. ادامه SRE روی مقصد تازه با journal و allowance جدا و همان دفتر تجمعی انجام می‌شود؛ create قبلی تکرار نمی‌شود.

تلاش وب بعد از83d961d از اتصال گذشت، اما بررسی وجود مقصد با PROVIDER_TRANSPORT متوقف شد؛ ۸ model call و صفر write ثبت شد. تکرار تازه با همان دفتر مصرف به پیشنهاد و تصمیم ساخت رسید، اما GET شبکه در preflight پس از10.491s با cause واقعی UND_ERR_CONNECT_TIMEOUT شکست خورد؛ باز هم create/upload/release صفر بود. این دو failure به موفقیت تبدیل نشده‌اند. [ADR 0008](../decisions/agent.md#0008-bounded-read-recovery) یک تلاش مجدد فقط برای همین خطای GET، با signal و بودجه مشترک را ثبت می‌کند. برای claim ساخت/restart و ادامه انتشار، allowance write دوباره کنترل می‌شود. هشت regression تازه و domain244/244، lint/typecheck/build و HTTP21/21 export ثابت گذشتند. lost-create با همین cause همچنان یک write و عدم replay دارد. شاهد تازه وب/PaaS پس از این اصلاح در ادامه لازم است.

پیش از آزمون تازه وب، دو تلاش اتصال با LIARA_TIMEOUT و صفر model/write شکست خوردند. خواندن حساب، تیم و برنامه‌ها پشت سر هم از یک deadline پانزده‌ثانیه‌ای استفاده می‌کردند. اندازه‌گیری همزمان واقعی هر سه پاسخ200 را در8.935s نشان داد؛ زمان‌های جدا8.824/8.692/7.728s بودند. این سه GET مستقل اکنون همزمان و با همان deadline اجرا می‌شوند؛ تمام پاسخ‌ها پیش از ذخیره اعتبارسنجی و siblingها در شکست لغو می‌شوند. دو regression شروع همزمان، حفظ خطای تیم و عدم جایگزینی حساب با پاسخ دیررس را می‌سنجند. اتصال واقعی application پس از اصلاح در9.292s با سه200 و صفر write گذشت. domain236/236 و lint/typecheck/build export ثابت گذشتند. این شاهد اتصال است؛ سناریوی تحقیق وب/PaaS هنوز جدا لازم است.

خلاصه SRE outcome اجرایی نیست؛ source محلی بدون receipt متناظر، محتوای release را اثبات نمی‌کند. نتیجه رفع مشکل به تست/انتشار و همان رفتار نیاز دارد. واحد منابع، source نامرتبط، pagination/پنجره‌های خارج از محدوده، تضمین عمومی تشخیص و پوشش سرویس‌های دیگر هنوز پذیرفته نشده‌اند. مدل/ابزار و provider واقعی باید جدا شاهد داشته باشند.

<a id="agent-publication-live"></a>

## انتشار و اصلاح واقعی از گفت‌وگو


<a id="agent-publication-live-مرز-اجرای-ثبتشده"></a>

### مرز اجرای ثبت‌شده

در ۲۰۲۶-۱۰-۲۲، export مستقل و clean از `f94d44b` با lockfile همان revision نصب و build شد. state، workspace، نشست و gateهای آزمون از نصب اپراتور جدا بودند. یک app آزمایشی Node موجود، تنها مقصد مجاز بود. ساخت و حذف آن در harness کنترل‌شده انجام شد؛ ساخت مقصد هنوز ابزار محصول نیست. هیچ تنظیم env، تغییر پلن یا restart انجام نشد.

درخواست‌های فارسی از مرورگر به مدل واقعی BoxAPI با `gpt-6-luna/none`، ابزار typed، تصمیم رابط، application انتشار، upload/release واقعی و probe همان صفحه رسیدند. سناریوها و oracle پیش از درخواست مدل ثبت شده بودند.


<a id="agent-publication-live-پروژه-آماده-و-صفحه-html"></a>

### پروژه آماده و صفحه HTML

مدل پروژه و فایل مربوط را خواند و انتشار صفحه `/` با پاسخ 200 و متن `Orders are ready` را پیشنهاد کرد. کاربر کارت همان مقصد و معیار را تأیید کرد. بسته immutable ارسال و receipt هر دو مرحله ذخیره شد. Liara، release را READY/current اعلام کرد ولی پاسخ عمومی ابتدا 503 بود؛ Agent آن را موفق اعلام نکرد و سپس لاگ و release را بررسی کرد. لاگ اولیه خالی بود و علت قطعی ساخته نشد.

چند دقیقه بعد، بدون هیچ upload/release یا تنظیم تازه، همان صفحه 200 و متن مصوب را داد. «ادامه بررسی نتیجه انتشار» در همان رابط، همان action را فقط بازخوانی و `completed` کرد. این readback درخواست مدل تازه‌ای نساخت. این شاهد تقدم READY بر پاسخ‌دهی عمومی در همین چرخه است؛ علت دقیق تأخیر در شبکه یا زیرساخت اندازه‌گیری نشده است.


<a id="agent-publication-live-اصلاح-واقعی-و-بررسی-همان-رفتار"></a>

### اصلاح واقعی و بررسی همان رفتار

در `/checkout`، جمع قیمت‌ها بدون اعمال تعداد برابر 18.25 بود؛ oracle از پیش تعیین‌شده برای داده‌های موجود 74 بود. هدف تازه، اصلاح محدود `cart.mjs`، اجرای همان `cart.test.mjs` و انتشار نتیجه روی همان app بود. مدل source و آزمون موجود را خواند، محدوده را پیشنهاد کرد و پس از تصمیم کاربر، worker واقعی وصله را در workspace جدا تولید کرد.

- آزمون unchanged پیش از اصلاح شکست خورد و پس از اصلاح گذشت؛ تعداد صفر، اعشار و سبد خالی نیز در آن بودند.
- فقط `cart.mjs` تغییر کرد. source اصلی دست‌نخورده ماند.
- archive ساخته‌شده از نسخه آزموده‌شده دقیقاً با `artifactHash` پیشنهاد انتشار بعدی برابر بود.
- کاربر انتشار آن artifact را جداگانه تأیید کرد. یک upload و یک release تازه انجام شد.
- با وجود READY/current نسخه تازه، اولین پاسخ 200 هنوز مقدار قبلی را نشان داد؛ oracle به‌درستی آن را قبول نکرد.
- پس از تغییر پاسخ عمومی، readback همان action از رابط، status=200 و `total=74` را با fence دوباره release ثبت کرد و Agent به `completed` رسید. readback و reload هیچ write یا درخواست مدل تازه‌ای نساختند.

محیط واقعاً اجراشده در پاسخ کنترل‌شده، Node 22.23.3 گزارش کرد. این شاهد فقط همین برنامه و رفتار است؛ تعمیم به پروژه، framework، dependency یا sandbox دیگر معتبر نیست. کاربر در این سناریو فایل مجاز، آزمون موجود و معیار نتیجه را می‌دانست؛ کشف مستقل همه این ورودی‌ها سنجیده نشده است.


<a id="agent-publication-live-شکستها-مصرف-و-cleanup"></a>

### شکست‌ها، مصرف و cleanup

هر دو failure میانی و خروجی اصلی آزمون ناموفق حفظ شدند. محافظ خصوصی بودجه تجمعی، یک درخواست مدل دیگر را پیش از ارسال متوقف کرد؛ خطای نمایشی `MODEL_TRANSPORT` از همین guard بود و outage مدل محسوب نمی‌شود. نتیجه با readback همان انتشار، بدون درخواست مدل اضافی بسته شد. در این چرخه 14 درخواست واقعی مدل و 27,458 توکن گزارش‌شده ثبت شد؛ هزینه/بودجه حساب فقط در journal خصوصی نگهداری می‌شود و مقدار رزرو، invoice تلقی نمی‌شود.

PaaS journal شامل 54 GET، یک create، دو upload، دو release و یک delete بود؛ این شمار شامل درخواست‌های مستقیم HTTPS workload و مدل نیست. create/delete متعلق به harness بودند. حذف فقط پس از تطبیق ID app ساخته‌شده انجام و نبود آن در فهرست حساب تأیید شد. سرور موقت متوقف شد و gateهای نصب اپراتور خاموش ماندند. app یا deployment آزمایشی فعال باقی نماند؛ شبکه قبلی تغییر نکرد.

تصاویر تصمیم و نتیجه در `.artifacts/agent-publication-live/` و لاگ/receipt خصوصی در محل ignored آزمون حفظ شدند. secret، source archive، دیتابیس و هویت حساب وارد Git نشده‌اند.


<a id="agent-publication-live-تغییر-پس-از-آزمون-و-حدود-پذیرش"></a>

### تغییر پس از آزمون و حدود پذیرش

این failure واقعی به انتظار محدود پس از پذیرش release در v7 منجر شد: mismatch تا پنج دقیقه با حفظ همان oracle، pending است و با backoff فقط خوانده می‌شود؛ پس از مهلت، mismatch پایدار شکست می‌خورد. قرارداد تاریخی v5 تغییر نکرد. [ADR](../decisions/agent.md#0002-workload-propagation) دلیل و trade-off را ثبت می‌کند. regression تازه، 503→200 درست، 200 قدیمی→متن درست و 503 پایدار پس از مهلت را می‌سنجد. این زمان‌بندی تازه در همان چرخه زنده دوباره اجرا نشد؛ شاهد زنده متعلق به `f94d44b` و readback صریح است.

AC26/27 برای این اصلاح محدود و مقصد موجود، شاهد واقعی رفت‌وبرگشت دارند. A05 و پذیرش ساخت app/env از Agent، کشف خودکار تست یا build عمومی، کاربر تازه، runtimeهای دیگر، استقرار عمومی و تکمیل هسته کامل همچنان بازند. وضعیت تصمیم، اجرا و نتیجه با هم یکی نشده‌اند.

<a id="agent-rollback-maintenance"></a>

## Exact-artifact rollback through the shared Agent — 2026-10-28


<a id="agent-rollback-maintenance-workspace-independent-maintenance-and-continuation"></a>

### Workspace-independent maintenance and continuation

Follow-up on `69413935f8b50d6d92e3535c4a58b04dc66387da`: maintenance service reads and historical-archive rollback no longer depend on reopening the selected mutable folder at driver startup. Source/file/build/repair/publication applications still validate the actual selected source at their own boundary. A source tool's `PROJECT_CHANGED` becomes a correlated failed result for the maintenance model to reason about; `AGENT_CONTEXT_CHANGED`, cancellation, exhausted budget and denied scope remain fatal. Ordinary publication/question startup behavior is unchanged. Cached profile metadata is explicitly not fresh source evidence.

`launchlane_resume` now continues paused or process-interrupted maintenance through the same `continueAgentRun` used by web messages. It preserves run ID, limits, counters, remaining elapsed allowance and receipts; duplicate keys schedule once. A competing owner, stale context or exhausted budget cannot resume it. Process recovery still cancels unused publication approvals and retains uncertain effects; continuing never grants a new approval or repeats an accepted write. Pending decisions use their existing web decision controls, and terminal failed/cancelled maintenance is not silently reopened by this path.

Candidate `maintenance-r5`, Node24.18.0/npm11.16.0/Next16.4.2 with existing pinned dependencies, has runtime source/package SHA256 `ce61dadc8e20e8d728eafbfaa76de1970db4ebae93f557e2a2effaa5b8fda18a`. The initial targeted command `node --test tests/domain/agent-publication.test.ts tests/domain/mcp.test.ts tests/domain/agent-conversation.test.ts` passed25/25. It includes changed/missing source, source-read failure followed by exact archived publication with the unchanged oracle, target drift before model/write, restart continuation, duplicate resume, competing owners and exhaustion. The same r5 export subsequently passed751/751 domain, typecheck, lint (zero errors/48warnings/20infos), Webpack production build,47/47 HTTP and five missing-source browser review states. Browser artifacts are in `candidate-maintenance-r5/.artifacts/maintenance/2026-10-28T10-49-42.949Z/` under the private coordination directory. These r5 results are historical, not a fresh r6 pass.

The r5 real-model probe uses that exact runtime source and the active `gpt-6-luna/none`,1024 output tokens. It moved only its owned temporary fixture folder after seeding a synthetic successful historical publication. The goal loop selected `read_publications` then `propose_rollback`: two actual model requests,8323reported tokens,10367ms, three counted tools, exact archive and `awaiting_approval`; the decision was then rejected. The provider/history were synthetic, with zero real cloud writes. Conservative ceiling$0.008377; no allowance or reserve renewal. At r5, accumulated work was eight actual requests/32609reported tokens, ceiling$0.032839; local remaining ceiling$0.188895, allowance$2 and prior reserves$0.887866 unchanged. These are ledger ceilings, not provider invoice or BoxAPI account-balance verification.

Final candidate `maintenance-r6` adds a16KiB row budget to the twenty-record history page. The cursor is the last record actually returned; a byte-limited page never skips later records. A regression uses long UTF-8 criteria and checks full traversal with no missing/duplicate IDs and a bounded response. Final runtime source/package SHA256: `18e33b1751de7a14e136b2f841c9815a1ecfb262e8e65ce4e98c9560b2b0bb27` on the same base6941393 and pinned runtime/dependencies.

| Command on final r6 | Observed result |
| --- | --- |
| `npm run test:domain` |752/752, zero fail/skip/cancel,249832ms |
| `npm run typecheck` |route generation and tsc passed |
| `npm run lint` |exit0, zero errors,48warnings/20infos |
| `npm run build -- --webpack` |passed |
| `npm run test:http` |47/47, zero fail/skip/cancel,23197ms |
| `node scripts/test-maintenance-browser.mjs` |actual SDK→Agent→artifact decision→web keyboard rejection/reload in five widths320/360/390/768/1280, with the original disposable source folder moved; zero measured axe violations/overflow/page errors/external browser requests and zero cloud writes |

Final browser report/screenshots: `candidate-maintenance-r6/.artifacts/maintenance/2026-10-28T10-58-47.413Z/` under `<private-validation>`;360/1280 images inspected. All rows in this table belong to r6. The model/provider in these suites are synthetic; the actual-model probe is listed separately below. No new Docker worker execution or full aggregate browser run is inferred.

The exact-r6 real-model probe, again with its owned original fixture folder moved, selected history then rollback in two requests/8372reported tokens/9045ms and three tools. The exact archive reached `awaiting_approval` and was rejected with zero real cloud writes. Ceiling$0.008427. Accumulated across this work: ten actual requests/40981reported tokens, conservative ceiling$0.041266; local remaining ceiling$0.180468. Allowance$2 and prior reserves$0.887866 remain unchanged. The synthetic receipt is not proof of a current remote release, live rollback, data compatibility or general model quality across multiple candidate histories.

This supersedes the original-folder startup limitation recorded in the historical r4 section below. Managed DB provision/binding/migration, browser-route workloads, fullstack/data-safe rollback and a live provider rollback remain separate open boundaries.


<a id="agent-rollback-maintenance-problem-and-product-behavior"></a>

### Problem and product behavior

Commit `9d66e5e` already implements rollback through an immutable artifact flow and the normal publication service. This slice connects that existing capability to the actual goal loop and MCP. It does not implement a second rollback executor.

- `read_publications` returns twenty successful historical publication records at a time, scoped to actor, account, team, public app name and internal app ID. `nextBeforeActionId` resumes in insertion order. History is not the current remote release, current health or data compatibility.
- For an explicit rollback goal, `propose_rollback(actionId)` reuses `proposeRollback`. The host verifies the historical receipt/flow/archive, adopts the artifact flow into the same AgentRun before further budget persistence and creates an ordinary publication decision.
- A `maintenance` channel persists in the existing run JSON. No migration or ActionSpec canonicalization changes. Maintenance progress and publication decisions are restored in the publication tab; the optional question channel stays read-only.
- `launchlane_maintain(requestKey, goal)` uses the same `createAgentRun`/driver, session scope, durable usage and configured model as the web API `POST /api/agent/runs` with `operation=maintain`. A repeated registration joins the same run, including after host-owned artifact selection. MCP still has no approve/execute tool.
- The review URL opens the existing publication card. The host explains that current configuration/plan continue and schema/data compatibility is unverified. Approval/rejection, claim, upload/release and observation use the existing services and journals.
- Ordinary structured publication and question tools cannot acquire rollback authority. An active unrelated mission blocks standalone rollback. The previous-version selector now filters account/team/internal identity before choosing a candidate, instead of selecting by public name alone and rejecting the wrong account afterwards.


<a id="agent-rollback-maintenance-acceptance-and-configuration"></a>

### Acceptance and configuration

Partial AC30, AC31, AC24 and AC17. Base: `e125a38bfcfd1d3bf0b44259b36a903e370cbb0f`. Final candidate `rollback-r4` is an independent same-drive export of tracked files and this slice, with the installed pinned dependency tree linked read-only by convention. Node24.18.0, npm11.16.0, Next16.4.2. Runtime source/package SHA256: `f55350a7dbfb173b183db66daeee43a58f2014e205161adb530ed988ff089d6e`. The private per-file manifest and command logs are in `<private-validation>` and are not product inputs.

| Command on r4 | Observed result |
| --- | --- |
| `npm run test:domain` |748/748, zero fail/skip/cancel,264179ms; includes context adoption, exact bytes/unchanged oracle, scope/cursor separation, schema bounds, duplicate registration, denied/revoked grants and one-share/two-read persistent-budget race |
| `npm run typecheck` |passed, including route generation |
| `npm run lint` |exit0,48warnings and20infos, zero errors |
| `npm run build -- --webpack` |passed |
| `npm run test:http` |47/47, zero fail/skip/cancel,18202ms; isolated production servers and local HTTPS/SDK/stdio fixture |
| `node scripts/test-maintenance-browser.mjs` |five states at320/360/390/768/1280; actual SDK maintenance registration, duplicate join, shared loop/tool results, web review, keyboard rejection and reload; zero axe violations, overflow, page errors and external browser requests in measured states |

Browser artifacts: `<private-validation>`. The360/1280 screenshots were inspected. The browser's model transport and historical/provider fixtures are synthetic; its two model requests are not real-model requests. The first browser attempt incorrectly accessed private usage through the public AgentView and failed before reviewing the UI. The corrected harness checks usage in the disposable Store; no public API field was added. Runtime source was unchanged between those browser attempts. No fresh full aggregate browser or Docker execution is claimed for this slice.


<a id="agent-rollback-maintenance-real-model-boundary"></a>

### Real model boundary

The installed configuration was read without printing credentials: `gpt-6-luna`, `reasoning_effort=none`, output limit1024. The model test uses the normal `GoalModelClient`, `driveAgentRun`, tool registry, Store and rollback/publication application path. Its source, Liara reads, historical publication and provider writes are disposable synthetic fixtures. No human approval for live publication was created and no real cloud write occurred.

The pre-existing local financial partition was read and consumed through `openModelBudget`; neither the two-dollar allowance nor prior reserves were changed. The separately reserved hosted partition was preserved. Prices/account balance and this conservative model ceiling are not invoices.

The final real-model probe was on r3, source/package SHA256 `355c20028f70bfa0a1feb3257c29a469527bcfeff722fcc6930f1c4767643cd4`: two requests,8098reported tokens,8641ms, three counted tool operations, `read_publications` followed by `propose_rollback`, exact historical archive and `awaiting_approval`. Its conservative receipt ceiling was$0.008159. It then rejected the exact decision without sending publication. The later r4 changes accept multiline maintenance goals through the same text parser as web and add a paused-maintenance budget regression; this real-model probe is not relabelled as an r4 run.

Across the first slice's three real-model probes, six requests reported24286tokens and consumed a conservative$0.024462 from the existing local partition. At that point, remaining local ceiling was$0.197272; allowance$2 and prior reserves$0.887866 stayed unchanged. The original failed harness cleanup remains recorded separately: two real model requests reached `awaiting_approval`, then `cancelAgentRun` correctly rejected cancellation of a pending decision. The test fixture closed in `finally`. The corrected harness rejects the exact decision through `decideAgentPublication`; it does not broaden cancellation or retry a cloud write.


<a id="agent-rollback-maintenance-failures-retained"></a>

### Failures retained

- The first full domain run was746/747. A no-destination network test retained its sixteen-tool limit and rejected the extra, inapplicable history definition. History/rollback are now offered only with a selected target; the oracle and count limit were preserved.
- Candidate r2 passed747/747 domain. Its first build then caught insufficient TypeScript narrowing in the new test before reading `artifactHash`; the assertions now narrow through `isWorkloadDeploymentSpec`. This build is a failure, not a production artifact.
- A snapshot copy command initially used a repository-relative destination from the snapshot working directory. It failed before overwriting anything; the harness copy was repeated using absolute paths. It is not a failed project assertion.


<a id="agent-rollback-maintenance-still-open-and-next-executable-boundaries"></a>

### Still open and next executable boundaries

- Managed DB provisioning, encrypted credential binding, migrations, connectivity and persistence remain AC34 work. A fresh read-only `/v1/me` on2026-10-28 revalidated the previously evidenced account/team and reported nine database engine families, including PostgreSQL18.4/17.10/16.14/15.18/14.23/13.23. That catalog is not a provision or data-plane receipt.
- The temporary public deployment returned503 for `/`, `/api/health` and `/api/workspace` at10:19:54–10:19:58UTC on2026-10-28, and again at10:59:34–10:59:38UTC. No deployment, restart or public-state change was performed. Local acceptance does not repair or verify that release.
- Fullstack/Worker rollback, schema/data/config compatibility, automatic regression-triggered rollback, browser-route workloads and a fresh live Liara rollback remain unverified/unimplemented as applicable. Current configuration and resources continue; the historical artifact is not a database backup.
- Maintenance still initially validates a selected mutable source before starting the model. Recovery when that original folder is changed/unavailable is the next specific boundary; source reads/build/repair must retain their own source validation when that startup dependency is removed.

The graph generation was2026-10-21, with new paths `not_tracked`. Discovery and coverage were requested first; current source/imports/tests supplied the material evidence. Graph absence was not treated as capability absence.

<a id="codex-executable-worker"></a>

## Executable Codex worker — bounded evidence, 2026-10-23

This is Launchlane → Codex execution, independently of Codex → Launchlane MCP. An actual external patch round trip passed real unchanged Node22 tests and continued the same bounded parent. Planning/publication transports were synthetic; this is **not** live external-agent publication or acceptance of a UI selector. A06/AC26 remains partial.


<a id="codex-executable-worker-candidate-configuration-and-oracle"></a>

### Candidate, configuration and oracle

Base `195f7e4` plus the owned worker patch under development. Live probes preceded the final accounting changes; private runtime hashes and original outputs are retained under `.local/codex-executable/`. Do not present these as a live pass on a later frozen candidate.

Installed `codex-cli 0.163.0-alpha.11`, separate existing ChatGPT authentication, packet-only ephemeral execution, disabled device tools and no inherited model/cloud credentials. The restricted Windows sandbox probe failed before its canary because the elevated backend is unavailable. There was no escalation or host-shell fallback. See [ADR0020](../decisions/agent.md#0020-codex-packet-worker).

The controlled invoice source had a quantity fault. The predeclared oracle required total73 and retained empty, zero-quantity and decimal cases. Only `invoice.mjs` was editable. The host reproduced the failure, sent the correlated source/base/failure packet, applied a replacement independently and ran unchanged tests/build/start/workload in the pinned Node22 container. Tests and original source were not overwritten.


<a id="codex-executable-worker-observed-executions-including-failures"></a>

### Observed executions, including failures

| Probe | Actual result | Subsequent action |
| --- | --- | --- |
| 01, `bfe3433b-434b-4c6a-9c18-b47a49b2d52a` | CLI closed; host rejected non-fatal ErrorItem. Usage not retained, remains unknown; no artifact/publication. Old driver consumed synthetic planning slots until budget stop. | Preserve unknown cost/failure; stop parent immediately on uncertain execution. Do not retry this job. |
| 02, `ba152b84-448a-4a58-8eff-e558a5d1c4d3` | Same decoder defect; completed metadata-only response,13317 tokens. Driver stopped without fallback/artifact. | Verify SDK semantics and fix decoder. Reconcile completed metadata/no device operation and unchanged workspace only. Job remains failed; lost patch is not accepted. |
| 03, `dac2d2ce-7a33-4d2d-8171-5a501776340c` | Actual patch,13351 tokens, only invoice.mjs changed, before failed/after passed, exact derived artifact selected. | Same parent/authority, remaining second repair slot; continuation and two publication writes used synthetic transport. No new program or budget. |

Parent02/03 `9b3f88cd-3a18-4729-9e9b-9d4f7a141610`; authority `187658b7-6cda-4b0e-aabf-3cedb5b97513`; successful job `1a2a02a1-fa53-4a56-86e2-c3b8a2b38902`.

Root `5d488e5af1f4bc6964450f7a9b8003d5502f186472e4c1a71d6c2d547c8cbfdd`; derived source `fd5c323de9ec0a6622894628094d85d10073412694f179962e25b03398e9dee9`; archive `90fec298e81d22af87ed1745fb351c7b916a3d39e935cbc8f2d9b9005cd86ed3`. No real app/release or cloud cleanup exists for this spike.


<a id="codex-executable-worker-usage-and-recovery"></a>

### Usage and recovery

Three actual Codex executions,26668 known tokens plus unknown probe01 usage. Subscription cost and underlying request/retry count remain unknown. No new BoxAPI calls/allowance were used. The earlier0.240970USD remainder is **BoxAPI-only**, not a balance including unpriced subscription use.

Accounting initially showed13617 parent tokens after03. Separate corrective receipts, preserving that failure, produce26968 tokens:26668 actual Codex plus300 synthetic planner tokens. Four version/auth reads were charged. Final same-parent usage:7 model slots,28 tools,26968 tokens, unknown0,69274ms. Seven slots are not seven actual HTTP model requests. Limits24/160/600000ms and authority are unchanged. The original session remained expired; a new fixture session permitted historical receipt settlement only. Replaying settlement added no usage/executions. Probe01's separate unknown cost remains unresolved.

Regressions cover operation denial, diagnostics, duplicate dispatch, credential isolation, usage reservations, rejected-result reconciliation, crash/uncertain blocking and exact-once accounting without renewed authority. Final candidate regression is recorded separately; it does not retroactively make these pre-final probes a fresh live candidate pass.

First remaining boundaries: product selection and versioned authority, permitted pre-dispatch fallback with a real job, persisted final-patch recovery, monetary handling of unpriced accounts, actual external-worker publication/cancellation/reconnect and independent Claude Code/OpenCode execution. MCP connectivity closes none of these boundaries.

<a id="codex-product-publication"></a>

## Product-selected Codex repair through native Liara publication — 2026-10-23

Result: a bounded real Node22 case passed. Codex MCP resumed the existing web mission; the web cost/program decisions selected executable Codex, the original workload failed in the container, Codex returned a scoped patch, the host independently tested it, and the exact derived artifact was published and verified. The app was subsequently deleted with ID-bound readback. Its former URL is not an active demo.


<a id="codex-product-publication-configuration-and-oracle"></a>

### Configuration and oracle

Live candidate16 is a frozen index export on base `086c5d1`, tree `75691099e75b11425345c741e30874df2cf47072`. Its310 runtime/test/config files match digest `98421a054729b18fe55ad50ba06855521efafc31a8f25f57f0663b8f3756137d`. Concurrent unstaged UI changes were excluded. Final regression candidate17 changes only the synthetic model hook's treatment of system messages; application source is identical. Its separate check results are recorded in [choice/recovery evidence](operations.md#destination-choice-and-resume).

The source is the existing MIT-licensed functional bookshop demo, `ssepehrnoush/liara-copilot`, revision `f42b339ef0f5be6804337385531d5833eb23625b`, directory `demo/shop-v1`. It has4 source/license files, no declared dependencies and no lockfile. The controlled fault replaces `n.toLocaleString('fa-IR')` with `n.missingNumberFormatter('fa-IR')`. It was declared before the original upload; no external start, config, lockfile, bundle or dependency preparation was performed. The original faulty device copy remained unchanged.

The source was entered using the browser folder-upload path in the original attempt. Continuations did not upload a second source or register a new mission. The mandatory unchanged build criterion was `GET /`, status200 and the text `تازه‌های کتاب‌فروشی`. Additional post-publication checks required24 rendered book cards, the title `باغ شبانه`,50 products from `/api/products` with the first price85000, and `{ok:true}` at `/health`. READY, an old release or a URL alone could not pass.

| Identity | Recorded value |
| --- | --- |
| Original source flow | `7e5923d9-a0c9-4e1d-9554-6893dcf35886` |
| Original source hash | `3bd2b626ea2994e3031d811e8bab729194bf33f6567a20c1feab49f88f121b7a` |
| Original archive | `fdc63128981ab13acc1d091b4322d49bcd040241bb9f304ab23628f17eb7c40c` |
| Parent mission | `2b7a96df-0803-4fc5-a2bc-6f22f03a9ebf` |
| Destination action | `c27a104f-0411-492a-acd0-c908b5514d69` |
| App name / returned ID | `launchlane-codex-qa-1023` / `<resource-id>` |
| Existing private network | `<resource-id>`; no new network write |
| Program | `00bf4adc-82a6-435c-96c1-a6c67a8e23e5`, MissionPlan v2 |
| Initial isolated build job | `95ab83d1-e48c-432a-ba7a-ea4317693614` |
| Repair job | `3f77c963-4cb6-4979-bb98-bb2f6549fa8c` |
| External execution | `b0e8dcd1-802b-43a0-ab79-bd928adf8f1e` |
| Derived selected flow | `425cce9d-afde-4af2-9c68-1cd412ef9114` |
| Derived source hash | `2b5899e4c7d3053084d1c1fcdd1854961d010d1d40ab542c5fe12837f91cbc11` |
| Tested/published archive | `69cd640ae4571e3d48a2624d403cf0e91d862d4bedc575f90af58ce65c19e107` |
| Publication action | `896e78ed-380a-4068-8d8a-046c1402df1d` |
| Native release / observed current release | `<resource-id>` / same ID |

The live program bound `small-g2/basic` at1041.66toman per base hour, without tax/traffic/storage extras. It allowed at most3 build jobs,2 repairs and2 publications within the original20 model slots/160 tools/600000ms. Codex used `codex-cli 0.163.0-alpha.11`, model `gpt-6.1-sol`, packet-only mode, separate existing ChatGPT authentication and explicit unpriced subscription acknowledgment. Pre-dispatch fallback was deliberately unchecked; no internal patch worker ran in parallel.


<a id="codex-product-publication-actual-chain"></a>

### Actual chain

The original run retained5 consumed planner calls. A first continuation hit the self-owner idle-check defect without a model/cloud write. After that fix, one real model response still treated a cancelled build as pending consent and asked a prose approval question; no write occurred. Current host decision state and the cancellation receipt were made authoritative in model context. These failures and the additional call remain in the same parent; no allowance was renewed.

On candidate16, actual Codex app-server MCP reconnected, joined and resumed that parent. It read progress through the same application and returned the web review URL. There were131 MCP lifecycle calls including polling; these did not manufacture model allowance or another write. The host harness used actual MCP RPCs and zero conversational host model turns; it does not evaluate Codex's natural-language tool selection.

Two human decisions were exercised through the real web cards: destination cost/create, then the program with executable Codex selected. Provider journaling recorded exactly one app create, one source upload and one release create. No network, resize, environment or database write occurred. After program approval there was no additional approval, continue click or log copying between build failure, repair, tests and publication.

Pinned Node22 Docker execution reproduced `TypeError: n.missingNumberFormatter is not a function` and HTTP500; the unchanged workload failed with exit73. Actual Codex returned a patch changing only `server.js`; the host verified base/path/hash scope and reran the original start/workload in the isolated workspace. It passed with exit0. The four-file derived archive is different from the original and exactly matches the publication contract. This was native Node publication; Docker was the local build/test worker, not a Docker publication.

The provider initially reported startup without a successful workload. The same publication remained observing; no source or release write was repeated. It completed only after the expected page and the exact current release matched. Independent HTML/API/health checks passed. Real Chromium at390 and1280 widths rendered24 cards, had no horizontal page overflow and reported no page errors. This is not a complete user interaction or accessibility audit of the upstream demo.


<a id="codex-product-publication-consumption-and-cleanup"></a>

### Consumption and cleanup

The final parent used13 model slots,49 tools and132678 reported tokens, with zero unknown model calls and232093ms of recorded execution time. The model slots comprise12 planner requests accumulated across the original attempt and recoveries, plus one executable Codex call. Codex reported24307 tokens; subscription money and underlying service retry/request counts remain unpriced/unconfirmed.

The successful continuation added6 BoxAPI requests/79322 tokens and a conservative ceiling of0.079602USD. Including the one prior unsuccessful response, this slice added7 requests/85331 tokens and0.085843USD. The unchanged historical phase allowance is0.8USD; cumulative BoxAPI-only usage is70 requests/664482 tokens/0.668007USD, leaving0.131993USD under that ceiling. This remainder does not include unknown subscription pricing and is not a fresh allowance.

The app was absent before creation. Cleanup matched the returned ID from its creation journal, issued one DELETE with HTTP200 at10:38:46UTC and verified GET404 at10:38:47UTC. An independent account read at10:40:01UTC still found404. The balance changed from1983958.8 to1982813toman; the1145.8 difference is an account observation, not an attributed invoice or a new spending permission. The pre-existing private network remains listed; provider garbage collection is still unconfirmed. No undocumented network deletion was attempted.


<a id="codex-product-publication-remaining-acceptance-boundaries"></a>

### Remaining acceptance boundaries

This proves one declared-fault upstream demo through browser upload, real planner, product-selected executable Codex, unchanged independent workload, native Liara release and cleanup. It does not establish arbitrary raw repositories, general monorepos/dependency repair, all14 families, live database/env/migrations, incident repair after a failed cloud release, public multi-user hosting or parallel projects. Claude Code/OpenCode MCP and executable connectors remain independently unconfirmed. Bounded internal fallback and ineffective-patch rejection have separate actual-container tests with synthetic model/cloud transports; those are not a live external-to-internal fallback claim.

<a id="codex-publication-mission"></a>

## Codex MCP → one real publication and repair mission

Date: 2026-10-23. Code revision: `fb67971`, following `695773d` (bounded authority) and `fdf4c7f` (dependency-free build). The executed production export is candidate-06, index tree `2622f352628d3485fa9259b5a66c4a20edb4fd37`; its 294 runtime/test/script/assets/config files match digest `1538a5a0731f4a9eabfb17cf32461b1137ba87bc7105aa9ef495f9bd72c40596`. The later commit only adds evidence text. Concurrent uncommitted UI work was excluded and preserved.


<a id="codex-publication-mission-source-and-oracle-defined-before-execution"></a>

### Source and oracle, defined before execution

Source is the functional bookshop demo at [`liara-copilot/demo/shop-v1`](https://github.com/ssepehrnoush/liara-copilot/tree/f42b339ef0f5be6804337385531d5833eb23625b/demo/shop-v1), revision `f42b339ef0f5be6804337385531d5833eb23625b`, under MIT, copyright 2026 ssepehrnoush. The upstream checkout stayed unchanged. A separate raw copy retained `server.js`, `catalog.js`, `package.json` and the original LICENSE. The declared controlled fault replaces the existing price formatter with `n.missingNumberFormatter('fa-IR')`; no deployment configuration, lockfile, generated entrypoint, bundle or manual fix was added outside the product. This is a controlled upstream demo, not acceptance of arbitrary customer repositories or raw monorepos.

The original page criterion was `/`, HTTP200, containing `تازه‌های کتاب‌فروشی`. Independent readback additionally requires 24 book cards, first title `باغ شبانه`; `/api/products` must contain 50 products, first title `باغ شبانه` and price85000; `/health` must return `ok=true`. The current release must equal the exact publication receipt. A successful upload, CLI exit or READY cannot satisfy this oracle. Node22 is selected from the actual `engines >=20`, start is the existing `node server.js`, port3000. There are no dependencies, lockfile or compile/build script: install is host-validated `none`, and the real isolated start/workload check is executed. No nonexistent compilation step is claimed.


<a id="codex-publication-mission-actual-product-path"></a>

### Actual product path

Chromium's native folder chooser uploaded the raw copy through Launchlane. The optional chat stayed closed. The actual installed Codex `0.163.0-alpha.11` app-server, a dedicated temporary home and ephemeral session used Launchlane's real stdio MCP bridge and HTTP application. Its supported `mcpServer/tool/call` RPC invoked `launchlane_context`, `launchlane_publish` and `launchlane_mission`. This is an actual Codex MCP client path; the test harness selected the tool calls, with zero Codex conversational model turns. It is separate from an executable Codex repair connector.

The connected team had no networks. The agent proposed a v13 network; after the operator explicitly authorized its unknown independent tariff, the real web card recorded that acknowledgment. Exactly one POST created it, then account/list reads established the nonce name and actual ID. A separate destination card approved the fresh `small-g2/basic` rate of1041.66toman/hour, excluding tax/traffic/storage. A third card approved one bounded publication program: same project/account/app/price/workload, Node22 image, allowed source paths, up to3 build jobs,2 repairs,2 publications and the existing20 model/160 tool/600000ms run limits. These are product limits for this test, not contest rules.

After that program decision there was no additional repair/publication approval, continue click or log copying. The actual isolated check failed on HTTP500 with `TypeError: n.missingNumberFormatter is not a function`, exit73 (workload stage). The driver supplied that receipt to the internal real-model worker. The patch changed only `server.js`, to `Number(n).toLocaleString('fa-IR')`. Host checks validated base/hash, scope, unchanged package/commands and the original criterion. The same independent check failed before the patch and passed after it, exit0. Only those verified bytes became the derived artifact and native Liara publication.

The first READY observations returned HTTP502 during service startup. They remained `WORKLOAD_STARTING`; no code was changed and no write was repeated. The same accepted release later returned the intended HTML, its actual current-release identity and matching workload. The run completed with `remote_changes_verified`. Host usage was11 model calls (including the internal worker),56 tools,97039 reported tokens,282280ms and zero unknown model usage. Original files still contain the seeded fault; only the isolated descendant was published.


<a id="codex-publication-mission-correlated-identities"></a>

### Correlated identities

| Evidence | Recorded identity |
| --- | --- |
| AgentRun | `6b5922c9-8282-450c-84ec-6e0b595b3ae5` |
| Root source | `3bd2b626ea2994e3031d811e8bab729194bf33f6567a20c1feab49f88f121b7a` |
| Root archive | `fdc63128981ab13acc1d091b4322d49bcd040241bb9f304ab23628f17eb7c40c` |
| Failed validation job | `61901e8c-402a-4af4-9912-1e2eae474499` |
| Successful repair job, same parent/base | `d7f60eff-bc6a-4bd6-8fdf-83cc915e40a3` |
| Derived source | `c386d2d9604a064ffdf4b5367c7430be313cfe2d23bb713e9639da48aced1131` |
| Published derived archive,3115bytes/4files | `c88cd91a5552301be30ce37bf63af41e46de118b0e8bdcf9c31500dca187efa1` |
| App name / actual returned ID | `launchlane-plan-qa-1023` / `<resource-id>` |
| Network actual ID | `<resource-id>` |
| Publication action | `0733c08b-af0c-4693-95c0-7db3d6571146` |
| Provider source receipt | `22efa8f4-393b-499e-bd21-71692c9ff5bf.tar.gz` |
| Release, independently current | `<resource-id>` |


<a id="codex-publication-mission-replay-browser-consumption-and-cleanup"></a>

### Replay, browser, consumption and cleanup

The duplicate host registration joined the same run. Disconnect/reconnect while awaiting a human decision preserved the ID and exact usage. An unregistered publication tool was denied. After selecting the descendant and completing publication, a new request key with the original typed input again joined that run with no new model call, attempt or usage. These reads and both transports use the same SQLite owner; the stdio bridge opened no independent write engine.

Independent HTTPS readback returned200 for all three paths and the stated semantic data. Chromium checked390px and1280px: 24 cards, no overflow, keyboard focus and Enter navigation, zero console errors, zero page errors and zero failed requests. This project has one inline stylesheet, no external scripts or stylesheets; it does not prove a compiled frontend's asset pipeline. Mobile screenshots were visually inspected.

The same pre-existing `python-20261023` model allowance was used:47→58 aggregate requests,459072→556111 tokens, conservative ceiling$0.461534→$0.559030 of the existing$0.80 grant. This run added11 requests/97039 tokens/$0.097496 conservative ceiling; remaining$0.240970. This is not a provider invoice. Unknown reservations and the earlier historical ledger remain intact. Liara balance read1985104.6→1983958.8toman; the difference1145.8toman is an account observation, not an attributed invoice or a new spending allowance. Native TLS worked; no VPN, system proxy, route or global network configuration changed.

The app was deleted once after matching its returned/journaled ID; DELETE200 and independent GET404 confirmed cleanup at07:59:06UTC. Its URL is no longer an active delivery. At08:04:39UTC the exact now-unused network was still listed; its documented provider garbage collection remains **UNCONFIRMED**, with no invented network-delete API or blind delete retry. Private receipts, failed attempts, source archives and credential files are retained outside Git.

Two earlier attempts remain failures: candidate-05 found `networks=[]` before writes/model, and the first candidate-06 harness observed a source-picker hydration race before any mission/write/model. The harness now waits for the restored selected project's actual heading before opening its edit controls. This corrects the harness's interaction precondition; it does not erase those failures or establish a general UI readiness guarantee.


<a id="codex-publication-mission-acceptance-boundary"></a>

### Acceptance boundary

This proves one complete guided/MCP/internal-repair/native-Node22 program with a derived artifact, plus actual missing-network and destination provisioning. A05/AC23/A08/A10 remain partial: arbitrary raw preparation, dependency edits, live failure after publication followed by a second repaired release, resources/database, the other runtime families and money enforcement in the general product are not established. An ineffective patch was stopped by the unchanged actual container test in candidate-06 with a synthetic worker; this live run used one effective worker patch. Claude Code/OpenCode MCP and all three executable connectors remain independently UNCONFIRMED. Internal default repair is now live-tested in this program; fallback from an unavailable or uncertain external worker still needs its own execution test.

<a id="coding-agent-selection"></a>

## انتخاب عامل و fallback در برنامه — ۲۰۲۶-۱۰-۲۳

MissionPlan v2 انتخاب عامل داخلی یا Codex، نسخه و مدل صریح، پذیرش مصرف اشتراک با قیمت نامعلوم و اجازه اختیاری fallback پیش از dispatch را به همان تصمیم سمت سرور متصل می‌کند. نسخه۱ و hashهای قبلی محفوظ‌اند. migration14 فقط تاریخچه بازبینی را اضافه می‌کند. تغییر برنامه اجرا‌نشده، ID/hash/revision تازه می‌سازد؛ تأیید قدیمی رد می‌شود. Claude Code و OpenCode هنوز آماده اتصال اجرایی معرفی نمی‌شوند.

Candidate10 روی پایه037185e و tree `293ae89f082281ac4fa3325adb3998d6d0269521` ثابت شد؛۳۰۲فایل runtime/test/config با digest `400823e1982a5e9989b2995ae732b1c264e6835fa5bd13a1c1c23b46c0c26eb8` منطبق‌اند و UI همکار در آن نیست. build/typecheck/lint بدونerror با35warning/9info،341domain،38HTTP،53حالت guided browser و2container مرتبط fallback روی همان export گذشتند. مرورگر، consent هزینه، keyboard،320/360/390/768/1280، refresh بدون مصرف تازه، تاریخچه و رد approval قدیمی را سنجید؛ تصویر390 بازبینی شد. این full aggregate همه browser/runtimeها نیست. candidate08 پیشین8container مرتبط را داشت؛ این عدد با candidate10 جمع نمی‌شود. candidate09 پیش از build در lint برای dependency غیرضروری hook شکست؛ اصلاح با state متعلق به run انجام شد و failure نگه داشته شد.

در container واقعی، executable عمداً ناموجود Codex پیش از dispatch تشخیص داده شد؛ همان job با وصله‌ساز مصنوعی داخلی، آزمون مستقل Node22 و publication مصنوعی ادامه یافت. در سناریوی پاسخ گم‌شده پس از dispatch، مأموریت بدون patch داخلی و بدون انتشار متوقف ماند. بودجه و authority تازه نشدند. این پذیرشِ bounded fallback است؛ مدل داخلی زنده در این تست اجرا نشد.

آزمون زنده محصول روی همین candidate با upload خام همان upstream bookshop/fault اعلام‌شده شروع شد؛ app تازه از پیش404 بود و همان شبکه قبلی خوانده شد. مدل۵درخواست و23040token مصرف کرد؛ cloud write و Codex execution هر دو0. مدل پیش از پیشنهاد مقصد، build پیشنهاد داد؛ harness پیش از تصمیم/اجرا متوقف شد. این یک شکاف واقعی جریان است: اتصال برنامه و عامل به مقصد هنوز ممکن نبود. run `2b7a96df-0803-4fc5-a2bc-6f22f03a9ebf` و مصرف آن حفظ شده‌اند؛ قرار نیست ادامه آن allowance تازه بسازد. هنوز انتشار زنده با انتخاب Codex تأیید نشده است.

مصرف تجمعی همان phase قدیمی BoxAPI پس از این تلاش63درخواست/579151token و ceiling محافظه‌کارانه0.582164USD است؛ از0.8USD تاریخی،0.217836USD باقی می‌ماند. اشتراک Codexِ probeهای پیشین جدا و unpriced است؛ هزینه0 ادعا نمی‌شود. ادامه اجرایی باید شکاف مقصد داخل محصول و سفارش مراحل را رفع کند و همین مأموریت را ادامه دهد؛ محدودیت فعلی پایان A06/A08 نیست.

<a id="mission-authority"></a>

## برنامهٔ محدود انتشار و artifact مشتق‌شده — ۲۰۲۶-۱۰-۲۳

به‌روزرسانی `fb67971`: [یک چرخه زنده Codex MCP→برنامه مصوب→خطای واقعی→worker داخلی→artifact مشتق→انتشار بومی Node22→نسخه و رفتار صحیح](agent.md#codex-publication-mission) اکنون ثبت شده است. نتیجه محلی قبلی و failureها در ادامه حفظ شده‌اند. A05/AC23 و چرخه عمومی A08/A10 کامل اعلام نمی‌شوند؛ دامنه تمام۱۴ خانواده، منابع وابسته و connector اجرایی هر سه میزبان پابرجاست.


<a id="mission-authority-رفتار-و-oracle"></a>

### رفتار و oracle

از یک source انتخاب‌شده با خطای مبلغ فاکتور، یک مأموریت انتشار و پیشنهاد build واقعی ساخته می‌شود. قبل از اجرای مدل مصنوعی، oracle ثابت است: آزمون اصلی همان source باید تعداد اقلام را در مبلغ لحاظ کند؛ build/start و GET باید نشانه `invoice service` را در همان مسیر بدهند. برنامه فقط همین مقصد، image، فرمان‌ها، env reference و معیار را با حداکثر 2 repair و 2 publication پوشش می‌دهد. این عدد محدودیت محصول در این برش است، نه قانون رسمی مسابقه.

`tests/sandbox/mission-authority.test.ts` یک تصمیم می‌دهد و سپس driver بدون تصمیم/دکمه ادامه تازه این زنجیره را اجرا می‌کند: build واقعی ناموفق در Node22/Docker، دریافت خطا، job اول، patch بی‌اثر، همان آزمون ناموفق و بدون artifact، job دوم، patch مؤثر، همان آزمون موفق، artifact تازه، انتخاب همان بسته و publication با همان hash. npm/build/test/start/GET، فایل و SQLite واقعی‌اند؛ مدل، DNS/probe لیارا و transport نوشتن مصنوعی‌اند. بنابراین این آزمون شاهد Docker publication یا PaaS زنده نیست. original source تغییر نمی‌کند؛ replay مأموریت و درخواست اولیه پس از انتخاب descendant، صفر مدل/attempt تازه دارند.

آزمون‌های domain، actor/session/hash/revision، rollback تصمیم+رزرو، replay، job خارج محدوده، دستور تغییرکرده، ancestry اثبات‌نشده، سقف تلاش، نشست لغوشده، root بدون build، قیمت تغییرکرده، reject و recovery را پوشش می‌دهند. ActionSpecهای تاریخی عوض نشده‌اند. برنامه تنها از پیشنهاد build هم‌بسته به مأموریت، برای مقصد موجود شروع می‌شود؛ آماده‌سازی عمومی dependency/entry، ساخت resource و اختیار پولی محصول در این برش نیستند.


<a id="mission-authority-candidateها-و-شکستهای-حفظشده"></a>

### candidateها و شکست‌های حفظ‌شده

- پایه کد اولیه `50f4076`؛ UI هم‌زمان در `ef54058` جدا commit شد و در candidateهای بعدی حاضر است. کار UI در commit backend stage نشده است.
- candidate01 روی export ثابت index، build/typecheck و lint بدون error با36warning/9info،320domain،37HTTP،5container مرتبط و38حالت guided browser را گذراند. این candidate قبل از دو guard نهایی scope و تکمیل کارت جدید است.
- candidate02،320domain داشت؛ آزمون کارت برنامه در انتظار دکمه timeout شد. مقصد fixture نشانی probe ذخیره‌شده نداشت؛ صرف selectedApp برای آغاز برنامه کافی نبود. برنامه اکنون فقط با readback رسمی `defaultSubdomain=true`، origin همان app را خودکار ثبت می‌کند؛ در غیر این صورت `PROBE_UNCONFIGURED` با اقدام لازم می‌دهد. metadata، fixture و oracle ضعیف نشدند.
- candidate03، build/typecheck و lint با صفرerror/35warning/9info،320domain و43حالت guided browser در320/360/390/768/1280 را گذراند. کارت قیمت با واحد، محدوده، focus واقعی، reload بدون مدل/بودجه تازه و reject از مسیر HTTP بررسی شد؛ screenshot موبایل دیده شد. برنامه زنده اجرا نشد. پس از این snapshot، فقط راهنمای مدل درباره اختیار برنامه مصوب روشن‌تر شد؛ نتایج candidate نهایی جدا ثبت می‌شوند.
- candidate04 نهایی با278فایل runtime/test/script مطابق index و digest `eb584d7af09ac4089dbd3d7f925036f4279811ad77cd7e1366c2b1de94fa919d` ثبت شد؛ build/typecheck و lint با صفرerror/35warning/9info،22domain مرتبط،37HTTP،5container مرتبط و43حالت guided browser گذشتند. این subset به‌عنوان320domain یا full browser تازه جمع نمی‌شود. export مستقل، UI کامیت `ef54058` را دارد؛ فایل‌ها و hunkهای باز بعدی همکار در candidate نیستند. هیچ مدل یا Liara واقعی در این pass استفاده نشد.
- نخستین دو اجرای container به‌علت دو نقص fixture، پیش از هدف آزمون شکست خوردند: credential مصنوعی در config client نبود و پاسخ مصنوعی `status` نداشت. پس از اصلاح شکل fixture، چرخه کامل تا نتیجه پیش رفت.
- oracle نخستِ patch بی‌اثر آن را پیش از آزمون با `string()` تک‌خطی رد می‌کرد؛ متن چندخطی source به `text()` منتقل شد. failure معتبر حفظ شد؛ سپس همان patch واقعاً آزمون را شکست داد (`REPAIR_TEST_FAILED`, exit76) و patch دوم همان آزمون را گذراند. معیار مبلغ و پاسخ تغییر نکردند.
- kit طراحی روی همین نصب `RESULT: 0/52` و `MODULE_NOT_FOUND` داشت؛ این خودآزمون kit امتیاز محصول و gate موفق نیست. مرورگر و axe نصب‌شده پروژه برای UI واقعی استفاده شدند.
- timeoutهای قدیمی fixture و تغییر concurrency1 جدا و باز می‌مانند؛ pass این candidate علت آن timeoutها را ثابت نمی‌کند.

گزارش‌ها، exportها و تصاویر قابل بازتولید در مسیر خصوصی `.local/authority-mission/` هستند؛ source archive، credential و state خصوصی وارد Git نمی‌شوند. آزمون قطعی مدل یا cloud واقعی مصرف نکرده است. برای آزمون زنده بعدی باید source/revision/artifact/job/app/release، workload و cleanup همان اجرا جدا ثبت شوند.

<a id="repair-parent-binding"></a>

## پیوند اصلاح به مأموریت والد؛ ۲۰۲۶-۱۰-۲۳

وضعیت A06/AC26 و پیش‌نیاز A05/AC23: implemented_verified در محدودهٔ زیر. اختیار چندمرحله‌ای، connector بیرونی و fallback از این شاهد نتیجه نمی‌شوند.


<a id="repair-parent-binding-مسئله-و-تغییر"></a>

### مسئله و تغییر

پیش از این برش، AgentRun به job اشاره می‌کرد و worker در مسیر معمول همان RunBudget را می‌گرفت؛ خود CodeRepairJob شناسهٔ والد نداشت. اجرای مستقیم adapter نیز می‌توانست RunBudget مستقلی بسازد. این مشاهده به معنی وقوع مصرف اضافی در چرخه‌های زنده تاریخی نیست؛ مسیر معمول آن چرخه‌ها بودجه مشترک داشت.

اکنون host شناسهٔ run را در context خصوصی ابزار می‌گذارد؛ مدل فیلدی برای انتخاب یا تعویض والد ندارد. build، preparation، repair و بازبینی امن تصمیم منقضی، `parentRunId` را ثبت و در همان consent محلی bind می‌کنند. job و worker packet دارای job ID، parent run، base، scope، oracle و artifact هستند. شمارنده/مهلت همچنان در مأموریت و receipt اجرای موجود قرار دارند؛ دفتر مصرف تازه‌ای ساخته نشده است.

worker قبل از claim و هر مصرف، والد working، پروژه/source همان job، اشارهٔ والد به همین job و تصمیم مصرف‌شده و منقضی‌نشده با نشست معتبر را بررسی می‌کند. سقف، شمارنده و deadline RunBudget باید با باقی‌ماندهٔ پایدار همان والد سازگار باشند؛ نبود بودجه، افزایش سقف، صفرکردن مصرف یا تمدید deadline رد می‌شود. پس از پاسخ مدل و پیش از ساخت artifact نیز مالکیت دوباره بررسی می‌شود. CAS قبلی job، isolation، same-test oracle و بررسی مستقل بسته حفظ‌اند. job لغوشده/نامعلوم خودکار با worker دیگری جایگزین نمی‌شود.

فیلد جدید برای تاریخچه optional است؛ jobهای قدیمی بدون والد با null خوانده می‌شوند و fingerprint consent بدون این فیلد همان قالب قبلی را دارد. ActionSpec1–12 و migrationهای1–10 تغییر نکردند. این سازگاری، مجوز اجرای runner تاریخی میزبان یا انتقال تأیید نشست دیگر نیست؛ gate و review موجود برقرارند. برنامهٔ چندمرحله‌ای آینده همچنان قرارداد نسخه‌دار، migration اختیار و تبار artifact مستقل می‌خواهد؛ این برش آن برنامه را اجرا یا تصویب نمی‌کند.


<a id="repair-parent-binding-oracle-و-بررسی"></a>

### oracle و بررسی

پیش از اجرا انتظار تعریف شد: والد واقعی باید از host بیاید؛ actor دیگر/شناسه ساختگی/ورودی مدل نتواند آن را تعیین کند؛ job وابسته بدون بودجه مشترک یا با parent لغوشده، job جایگزین، source دیگر و اختیار مصرف‌نشده حتی container آغاز نکند. بازبینی اختیار منقضی باید job تازهٔ همان والد را بسازد، قبلی را لغو کند و مصرف را نگه دارد. مسیر مثبت باید واقعاً همان آزمون Node22 را fail→patch→pass کند و فقط artifact آزموده‌شده را برگزیند؛ patch غلط همچنان رد شود.

پایه d11a803 با UI ثبت‌شده6e54988، Node24.18.0 و imageهای تثبیت‌شده موجود. کپی ثابت `.local/mcp-mission/final-candidate` فقط چهار source backend/contract و دو تست این برش را دریافت کرد. فایل‌های UI در حال تغییرِ همکار و config/state اصلی وارد آن نشدند. مدل و Liara در تمام تست‌های این بخش مصنوعی‌اند؛ Docker، Node22، Python3.12، HTTP، SQLite و مرورگر واقعی‌اند.

| بررسی | نتیجه |
| --- | --- |
| domain هدف‌دار |۱۶/۱۶؛ سپس review/parent۶/۶ با case واقعی انقضا؛ بدون cloud/model واقعی |
| domain کامل candidate | `npm run test:domain`،۳۱۵/۳۱۵،صفرfail/skip |
| sandbox کامل candidate | `npm run test:sandbox`: baseline/fix واقعی و۵بررسی isolation؛ سپس۹/۹،شامل Node22/رد patch غلط/env محدود/Python/رد wheel خراب/asset ناقص |
| build | تولیدی Turbopack موفق؛ warning root در export تو‌در‌تو محفوظ |
| lint | شش فایل تغییرکرده بدون error/warning؛ این نتیجه lint تمام UI هم‌زمان نیست |

فرمان مستقیم tsc در tree مشترک ابتدا خطای JSX در `workbench.tsx` در حال تغییر همکار داد؛ آن فایل تغییر داده نشد. نوع/build candidate ثابت مرجع این برش است. regression جدید نخست۱۵/۱۶بود: fixture «جایگزینی job» به ID ناموجود اشاره می‌کرد و به‌درستی STORAGE_INVALID می‌گرفت؛ fixture با job واقعی جایگزین شد تا همان شاخهٔ مالکیت، با REPAIR_PARENT_CHANGED، سنجیده شود. oracle «صفر claim/container و حفظ scope» تغییر نکرد.

logها در `.local/mcp-mission/` با نام‌های `repair-parent-domain.log`، `repair-review-parent.log`، `repair-parent-sandbox.log` و `parent-final-{build,domain,sandbox,typecheck,http,browser}.log` نگه‌داری می‌شوند. نتیجهٔ هر فرمان تکمیلی پس از پایان جدا ثبت می‌شود؛ شروع فرمان شاهد پاس نیست.


<a id="repair-parent-binding-snapshot-نهایی-index-پس-از-کنترل-نشست"></a>

### snapshot نهایی index؛ پس از کنترل نشست

کنترل لغوشدن نشست انسانی نیز پیش از claim/مصرف به worker اضافه شد؛ case منفی آن بدون آغاز container گذشت. سپس با `git checkout-index` کپی مستقل `.local/mcp-mission/parent-index-candidate` ساخته شد.۲۶۵فایل source/runtime/test/script/public/config با index تطبیق داده شدند؛ با درنظرگرفتن EOL متن Git، هیچ اختلافی نبود. fingerprint این مجموعه `2192e5f9887e6c8a749f73037f22438f946131345c7b31eac8510ed745d4007b` است. هیچ source این کپی حین اجرا تغییر نکرد؛ runnerهای جدید UI همکار نیز وارد آن نشدند.

| بررسی نهایی | نتیجه |
| --- | --- |
| build و typecheck | هر دو فرمان رسمی موفق |
| lint کل snapshot |۲۶۳فایل،صفرerror؛۳۴warning و۹info موجود حفظ شدند |
| domain نخست |۳۱۴/۳۱۵؛ fixture آزمون environment پیش از بررسی configuration و در ساخت archive به مهلت۳ثانیه‌ای خورد |
| domain تکرار کامل |پس از پایان build/Docker، همان `npm run test:domain` و همان۳۱۵تست،۳۱۵/۳۱۵ و صفرfail/skip؛ assertion/deadline/fixture تغییر نکرد |
| HTTP |۳۷/۳۷،صفرfail/skip؛ application/SQLite/transport واقعی و provider مصنوعی |
| sandbox |۹/۹به‌علاوه baseline/fix و۵بررسی isolation؛ Node22 و Python3.12 واقعی، packet با job/parent ID درست، patch غلط مسدود و source اصلی محفوظ |
| browser کامل | `npm run test:browser`،هفت suite۷۵/۲۷/۲۷/۲۲/۳۸/۵/۴۳،پوشه۲ و motion۱۲؛۲۵۱حالت،صفرpageerror/external request گزارش‌شده؛ transport مدل/cloud مصنوعی، تعامل مرورگر واقعی |

خطای۳۱۴/۳۱۵در `parent-index-domain.log` و تکرار کامل در `parent-index-domain-rerun.log` هر دو حفظ شدند. همراهی شکست با اجرای سنگین با فرض contention سازگار است؛ مصرف CPU/disk در آن لحظه اندازه‌گیری نشده و root cause قطعی سخت‌افزاری اعلام نمی‌شود. این failure از سوابق با pass بعدی حذف نشده است. سایر logهای نهایی `parent-index-{build,typecheck,lint,http,sandbox,browser}.log` و identity در `parent-index-identity.json` هستند.

<a id="project-preparation"></a>

## آماده‌سازی محدود پروژه Node

تاریخ: ۲۰۲۶-۱۰-۲۲. دامنه: Node بدون dependency، فایل ورودی و نسخه Node معلوم، تست مستقیم موجود و تغییر start/port. وضعیت اولیه A07، نبود اختیار اصلاح script در CodeRepair بود؛ آن محدودیت برای اصلاح باگ عمومی حفظ شد و برنامه جدا افزوده شد.

`propose_project_preparation` از entry و port، فرمان دقیق را در host می‌سازد؛ نام فایل نمی‌تواند interpreter option، shell command، traversal یا تست پذیرش باشد. محدوده تغییر از source استخراج می‌شود. goal نمایش‌داده‌شده فرمان و پورت را پیش از تصمیم توضیح می‌دهد. همان CodeRepair/تصمیم/RunBudget/نسخه جدا استفاده می‌شوند؛ هیچ عملیات cloud یا نصب dependency در این برش نیست.

پنج regression جدید، start مفقود، start اشتباه، پورت ناسازگار در entry/liara.json و leaf واقعی monorepo را با اجرای Node و پاسخ HTTP محلی می‌سنجند. baseline fail و همان تست unchanged پس از patch pass می‌شود؛ source اصلی و فایل تست حفظ می‌شوند. command/script/dependency/engine/config خارج برنامه، consent پورت دیگر، root monorepo و dependency موجود رد می‌شوند. قرارداد قدیمی حتی با تستی که پس از تغییر start می‌گذرد، تغییر package را رد می‌کند. مجموعه کامل domain220/220، lint و typecheck گذشتند؛ model transport این regressionها مصنوعی و اجرای Node/HTTP واقعی است. اجرای worker روی Node میزبان24.18.0 است؛ انتخاب Node22 پروژه به‌تنهایی اثبات اجرای تست با22 نیست.

در مرحله اولیه، چرخه جدید مدل واقعی، مرورگر و target runtime هنوز UNCONFIRMED بودند؛ شواهد تازه پایین همین گزارش آمده‌اند. build عمومی همچنان باز است. Docker Desktop نصب بود ولی engine خاموش بود؛ engine راه افتاد و image رسمی `node:22.23.3-bookworm-slim` با digest ثابت `sha256:3ed98443660ff48413b5af19ecefce3b9d50845a901a43420d47cc63a9fddbe9` واقعاً `v22.23.3` برگرداند. این فقط spike runtime است؛ محصول هنوز از Docker برای job استفاده نمی‌کند. containerها/سرویس‌های موجود پروژه‌های دیگر تغییر یا پاک نمی‌شوند.

این قابلیت عمومیِ ساخت پروژه یا اجرای هر script نیست. پروژه بدون تست، dependency/build، فایل جدید و frameworkهای دیگر هنوز به قرارداد اجرای جدا نیاز دارند. پس از موفقیت محلی، انتشار به همان artifact و approval مجزا متصل است. [تصمیم معماری](../decisions/runtime.md#0004-reviewed-node-preparation) چرایی حفظ مرز scripts را ثبت می‌کند.


<a id="project-preparation-نخستین-ورودی-واقعی-و-failure-حفظشده"></a>

### نخستین ورودی واقعی و failure حفظ‌شده

در export مربوط به bb06e41، مدل واقعی از وب، inspect و سه file read را انتخاب کرد و برنامه آماده‌سازی با تست موجود پیشنهاد داد. تصمیم در مرورگر ثبت و worker با مدل واقعی اجرا شد. شش درخواست مدل مصرف شد. baseline به‌علت start مفقود fail شد؛ بعد از patch همان تست و HTTP محلی pass شدند. با این حال worker عدد literal در listen را به const reference تبدیل کرد و regex قدیمی پورت را unknown کرد. host، PREPARATION_UNVERIFIED داد، artifact نساخت و source اصلی را تغییر نداد. این failure اجرای موفق قابلیت محسوب نمی‌شود.

اصلاح root cause با AST و bindingهای lexical، بدون اجرای source و بدون dependency تازه انجام شد؛ ورودی واقعی در regression باقی ماند. shadowing، mutation، imports، TDZ، comments/strings و listener متعارض/نامعلوم نیز آزموده شدند. domain کامل224/224، lint/typecheck، build و HTTP21/21 گذشتند. Number روی fallback صریح نیز با حفظ unknown در shadow/mutation پشتیبانی شد تا نمونه تاریخی regress نشود. [ADR](../decisions/runtime.md#0005-static-port-bindings) محدودیت parser و وابستگی به Next pin‌شده را ثبت می‌کند. تکرارهای بعدی نیز failureهای مستقل داشتند؛ اصلاح و نتیجه نهایی در ادامه ثبت شده است.


<a id="project-preparation-دو-آمادهسازی-واقعی-پس-از-ae9a5f9"></a>

### دو آماده‌سازی واقعی پس از ae9a5f9

نسخه اجرایی شامل bb06e41، cb935da، e5832ef و ae9a5f9 بود؛ UI export پیش از 4cee36d ثابت نگه داشته شد تا کار همزمان رابط وارد شاهد backend نشود. در دو پروژه تازه، مدل واقعاً inspect، فایل‌های مرتبط و ابزار آماده‌سازی را انتخاب کرد. هر تصمیم محلی در مرورگر ثبت شد. مدل و worker هر دو از BoxAPI واقعی استفاده کردند؛ چهارده درخواست و 32,436 token گزارش‌شده برای این دو چرخه ثبت شدند.

| پروژه | ورودی | تغییر مدل | نتیجه مستقل |
| --- | --- | --- | --- |
| calendar-start | start مفقود، پورت6067، تست موجود | فقط package.json؛ start دقیق node server.mjs | همان تست ابتدا fail و بعد pass؛ artifact انتخاب‌شده روی Node22.23.3 پاسخ200/calendar-ready داد |
| checkout-settings | پورت entry برابر9393، config برابر9292، هدف6068 | فقط server.mjs و liara.json؛ custom.retain و فرمان start حفظ شدند | همان تست ابتدا fail و بعد pass؛ همان نسخه با npm start روی Node22.23.3 پاسخ200/checkout-settings-ready داد |

اجرای محصول، Node24 permission runner در workspace جدا بود. راستی‌آزمایی مستقل، همان workspace را به image رسمی با digest ثابت و mount فقط‌خواندنی داد؛ direct Node test و npm --ignore-scripts start واقعاً اجرا شدند. container بدون network خارجی، با user غیرریشه و محدودیت حافظه/CPU/process بود و probe داخل همان container انجام شد. این شاهد target runtime است و به معنی داشتن Docker executor در محصول نیست. source و تست اصلی در هر دو مورد حفظ شدند، hash نسخه منتخب با artifact آزموده‌شده برابر بود، reload صفر فراخوانی مدل تازه داشت و هر دو container و سرور موقت پاک/متوقف شدند. هیچ Liara read/write برای این دو آزمون انجام نشد. تصاویر proposal/result در 360 و1280 در .artifacts/preparation-live نگهداری شدند.

دو شکست دیگر هم به موفقیت تبدیل نشدند: REPAIR_NO_CHANGE پیش از نوشتن وصله، و MODEL_PROTOCOL پس از موفقیت کار محلی. اولی با normalization فایل‌های مجازِ بدون تغییر و حفظ رد وصله کاملاً بی‌اثر پوشش داده شد؛ دومی با finish_investigation دارای schema و کنترل outcome سرور اصلاح شد. domain227/227، lint/typecheck، build و HTTP21/21 روی export ثابت گذشتند. این شمارها جای آزمون عمومی پروژه‌های دارای dependency/build یا بدون تست را نمی‌گیرند.


<a id="project-preparation-یک-درخواست-واقعی-از-پروژه-ناآماده-تا-سایت-پاسخگو"></a>

### یک درخواست واقعی از پروژه ناآماده تا سایت پاسخ‌گو

همان export اجرایی ae9a5f9 با UI ثابتِ پیش از 4cee36d، state/workspace/allowlist جدا و مدل/PaaS واقعی اجرا شد. fixture از source اصلی calendar-start که هنوز start نداشت گرفته شد. تنها یک هدف فارسی در مرورگر ثبت شد: آماده‌سازی با فرمان node server.mjs، پورت6067 و همان تست موجود، سپس ساخت مقصد با پلن small-g2/basic و انتشار صفحه‌ای با status200 و متن calendar-ready. تصمیم اصلاح محلی، ساخت/هزینه و انتشار هر کدام در وب ثبت شدند؛ اتصال حساب از API احرازشده محلی انجام شد.

مدل پس از inspect و سه خواندن فایل، آماده‌سازی را پیشنهاد داد. worker واقعی start را اصلاح کرد؛ baseline fail و همان تست pass شد و artifact انتخاب شد. سپس خود مدل از نتیجه به destination/catalog/networks/quote و proposal ساخت رسید. یک create انجام شد و ID/config برگشتی انتخاب شدند. proposal انتشار v7، همان hash artifact اصلاح‌شده و همان ID را داشت. پس از تصمیم سوم، دقیقاً یک upload و یک release انجام شدند. source اصلی تغییر نکرد.

READY ابتدا با HTTP503 همراه بود؛ host آن را pending/WORKLOAD_STARTING نگه داشت. همان readback محدود به پاسخ200 و متن درست رسید و run فقط آن‌وقت completed/remote_changes_verified شد. خواندن مستقل عمومی نیز همین پاسخ را تأیید کرد. چرخه، ۱۲ درخواست واقعی مدل، 46,780 token گزارش‌شده، ۴۵ tool call و 191,787ms زمان فعال داشت. readback دستی و تغییر oracle صفر بودند. reload مدل یا write تازه نساخت. دفتر PaaS این آزمون ۳۶ GET شامل setup/cleanup، یک create، یک upload، یک release و یک DELETE دارد؛ این شمار، همه HTTPهای workload/model نیست.

پاک‌سازی، ID را دوباره تطبیق داد، همان app آزمایشی را حذف کرد و absence404 گرفت. سرور موقت متوقف شد؛ container موقتی باقی نماند. env write و network creation صفر بودند. تصاویر سه تصمیم و نتیجه در 360/1280 در .artifacts/preparation-publication-live بازبینی شدند؛ credential، state، source و دفتر مصرف در .local باقی ماندند. این شاهد یک Node بدون dependency با تست موجود و شبکه موجود است؛ پوشش build، env، پروژه بدون تست، preview، rollback یا MCP از آن نتیجه نمی‌شود.


<a id="project-preparation-نصب-اصلی-و-تفاوت-آن-با-سرور-آزمون"></a>

### نصب اصلی و تفاوت آن با سرور آزمون

پس از درخواست صریح مالک برای فعال‌بودن دستیار، چهار gate نصب اصلی فعال و همان سرور loopback با حفظ credential/state بازراه‌اندازی شد. از وب اصلی روی پورت3000، پروژه examples/node-service انتخاب و درخواست فقط‌خواندنی ارسال شد. دو درخواست واقعی مدل، 5,193 token گزارش‌شده، inspect_project واقعی، پایان دارای قرارداد و reload بدون فراخوانی مدل تازه سنجیده شدند؛ صفر pageerror ثبت شد. serviceReads و analysis در API واقعی true بودند و پیام خاموش‌بودن نمایش داده نشد. deployment برای حساب/مقصد وصل‌نشده همچنان false است؛ روشن‌بودن gate، اتصال و approval تولید نمی‌کند.

این اجرا از main با UI همزمانِ در حال بازآرایی بود؛ نتیجه یک مرور کارکردی همین درخواست است و جای acceptance کامل UI جدید را نمی‌گیرد. شمار requestهای شکست ابزار مرورگر پیش از ارسال هدف، مصرف مدل همین نصب محسوب نشد. کنترل تجمعی مصرف آزمون‌ها در فرایند اصلی نیز فعال بود و سقف برای سرور یا retry از نو شروع نشد. حالت پیش‌فرض checkout تازه همچنان off است و فعال‌کردن مجاز نصب در README توضیح داده شده است.

<a id="source-investigation-and-setup-20261027"></a>

## Source investigation, failed-build guidance and secure setup — 2026-10-27

Scope: A02/A03/A07/A17 and AC18/22/24/25/32; bounded local acceptance. Technical reference provenance and coverage remain in the ignored operator-local review packet. No reference code or assets were copied and no dependency was added.


<a id="source-investigation-and-setup-20261027-current-source-and-ownership"></a>

### Current source and ownership

The mission began on `main@017298e5675b8a0d1a3a95f8499f1ce4cb45bf8e` with a nonempty shared index. Another agent advanced HEAD to `f6ef04f178051d8e1e481994073bc7309f1812c0` and staged a subsequent preparation slice during this work. These changes were preserved. That reference-review run performed no staging, commit, push, checkout, production activation or live provider/model operation. The later owner-authorized commit audit is recorded separately below.

Graph discovery and coverage initially returned `Transport closed`; direct current source/import reads supplied the evidence. After transport recovery, generation `2026-10-21T19:24:24Z` still reported current Agent/UI/MCP files as not_tracked and redaction/read-contracts as metadata_changed. Current source remains authoritative. Earlier cumulative documentation is not treated as proof that a currently implemented path is absent. The previous duplicate-source context projection and expired-publication close control remain in use.


<a id="source-investigation-and-setup-20261027-1-read-a-relevant-part-of-a-large-source-file"></a>

### 1. Read a relevant part of a large source file

Baseline: `read_project_file` rejected any file over20KiB even when inspection had accepted it in the immutable manifest. That could prevent investigating a large source file.

The same registry tool now accepts optional1-based `startLine` and `lineCount` (1–200, default80). Full reads keep their original four-field response and20KiB limit. A ranged read returns at most20KiB of complete UTF-8 lines, `totalLines`, `endLine`, `hasMore` and `nextStartLine`. An oversized individual line is rejected rather than silently clipped. Line numbers explicitly refer to **redacted text**, since redaction can remove embedded newlines.

Validation of bounds happens before source I/O or budget consumption. Manifest membership, actor/context, full captured source hash, UTF-8/binary checks and the existing read budget remain enforced. Redaction occurs before slicing so a secret spanning a boundary cannot leak in pieces. Ranged results carry extra metadata and cannot enter the existing strict duplicate-full-source projection. Unique chunks and tool-call/result pairs are preserved. The selected source is not proof of the bytes in a deployed release.

Use: the internal agent or an authorized MCP reader calls `read_project_file` with the same selected project and, for example, `{ "path": "server.mjs", "startLine": 201, "lineCount": 80 }`. No new tool, policy, execution engine or source mutation is introduced.


<a id="source-investigation-and-setup-20261027-2-explain-recognizable-failed-build-evidence"></a>

### 2. Explain recognizable failed-build evidence

Baseline: build logs and failed worker receipts were available, but the person had to interpret raw npm/Python/compiler output inside technical details.

A shared pure classifier now reports at most three signature observations and a bounded next check for missing start scripts, lock mismatch, dependency resolution, missing modules, Python distributions, TypeScript errors, registry rejection, incomplete offline cache and network failures. Both stdout and stderr entries can supply evidence. Provider results retain exact release/app fences, redaction, returned-window/omission metadata and untrusted-data status. Signals are derived only from returned entries; an omitted or out-of-window error cannot become a signal.

The guided publication repair card displays this guidance only for a failed job with a failed current receipt. It does not reuse a failed baseline when the later receipt passed. Successful, active, cancelled, interrupted and proposed jobs acquire no failure note. The note labels the cause unconfirmed and keeps the original receipt disclosure available. Shared `read_build_logs` exposes the same static guidance through Agent/MCP. No source repair, dependency change, oracle change or retry is authorized by a matching log string.

Use: after a failed build/test, open the existing publication card; the next check appears above the receipt details. For a cloud release, the existing agent/MCP `read_build_logs` result includes scoped observations and their limitation.


<a id="source-investigation-and-setup-20261027-3-explicit-fresh-signing-values-in-the-secure-form"></a>

### 3. Explicit fresh signing values in the secure form

Baseline: people had to invent a value or use an external tool for a fresh application signing secret.

The existing secure environment form offers an explicit WebCrypto32-byte random value for a conservative allowlist of conventional signing/session names: `SESSION_SECRET`, `JWT_SECRET`, `AUTH_SECRET`, `NEXTAUTH_SECRET`, `COOKIE_SECRET`, `COOKIE_SIGNING_SECRET`. This is a user-selected convenience with conditional usage text, **not semantic detection that the program needs a generated secret**. External API credentials, database passwords, encryption keys, generic `SECRET_KEY`, runtime variables and public frontend names receive no generator.

Generation only fills an empty field. It does not replace a manual value, an imported available value or a value awaiting import review. The form warns that replacing an existing signing key can invalidate sessions/tokens; existing remote values are not fetched into the browser. Generated values start hidden and private, cannot be relabeled public while unchanged, and use no draft/localStorage cache. Reload clears unsent values. Unavailable WebCrypto shows an actionable failure and uses no weak fallback. Generation itself sends no request and creates no approval or write.

Use: publication → missing configuration → secure form → conditional “ساخت مقدار تصادفی” → “مرور تغییر اطلاعات برنامه” → the existing v9 review/approval. Reject/expiry/uncertain/readback retain their existing ownership. Configuration readback is not application health, and this mission does not accept live environment writes.


<a id="source-investigation-and-setup-20261027-4-known-secret-encoding-consistency"></a>

### 4. Known-secret encoding consistency

Baseline: raw, JSON-escaped and canonical URL-encoded installed values were scrubbed, while equivalent percent-escape casing and form encoding could escape both redaction and source rejection.

The existing redactor and unconditional known-value source check now share exact patterns for raw/JSON, `encodeURIComponent`, and `application/x-www-form-urlencoded` forms. Only hexadecimal characters in percent escapes are case-insensitive; raw values remain case-sensitive and literal plus/space semantics are preserved. Known values still take precedence over source-fixture, package, translation and Python syntax exceptions. No entire-output decoding, arbitrary Unicode normalization, raw case folding, base64 substring matching or broad short-value exemption was added. This is not a claim to detect every possible encoding or previously unknown secret.

The change is active at the existing provider-evidence, model-request and source/archive-intake boundaries. No new credential is read, stored or exposed.


<a id="source-investigation-and-setup-20261027-5-compare-selected-source-with-recorded-publication-provenance"></a>

### 5. Compare selected source with recorded publication provenance

Baseline: the release reader exposed the provider's current-release ID, while accepted publication records already retained actor/account/team/internal-app identity, source/archive hashes and the release receipt. The reader did not connect those facts, so a selected future source could be mistaken for the running release's source.

The same `read_releases` now adds a read-only comparison against one unambiguous accepted publication record. It uses the actual `currentRelease` field, never the newest READY release. Actor, account, team, public app name and internal app ID must match; the existing Store validates the action fingerprint, and the accepted source/release journal plus matching attempt receipt are required. Missing, corrupt, conflicting, foreign or unattributed records stay unknown. A saved failed workload may still have known publication provenance; this does not make its workload healthy.

The original three-provider-read budget and before/after app-identity fence are unchanged. There is no extra provider/model request, archive read, approval, mutation, migration or allowance. No selected source is required for a service-only investigation. Technical results carry source/archive identity; the correlated step shows a short host-authored Persian notice. Replay reads stored events without repeating investigation. A comparison is explicitly limited to an accepted **recorded source**, not proof of current runtime bytes, configuration or health. It neither selects an old artifact nor authorizes a rollback.

Use: when the agent investigates releases of the selected service, open the existing “مراحل بررسی” disclosure. It distinguishes matching recorded source, different recorded source, unattributed release and missing current-release identity. The same result is exposed through the shared MCP reader. Historical events without this optional notice remain readable.


<a id="source-investigation-and-setup-20261027-validation-and-limits"></a>

### Validation and limits

Fresh final validation used frozen snapshot `r6`, base `1db39019174d8bd9bd5e83cc937cb79f869dd917`, manifest `f9ffb051c520ed8e30cd7fe5e0ed5121f5e5513cb383083e194de976b98447da`, Node24.18.0 and the existing pinned dependencies. Disposable SQLite/state, synthetic provider/model transports and isolated loopback ports were used. No credentials, `.env.local`, production database, budget ledger or active server were copied or modified. The earlier owner-authorized four-slice audit remains separate below.

| Actual command | Fresh r6 outcome |
|---|---|
| `npm run lint` | Exit0; zero errors,48warnings,20infos |
| `npm run typecheck` | Passed route generation and TypeScript |
| `npm run build -- --webpack` | Passed installed Next16.4.2 production build |
| `npm run test:domain` |726/726 passed;0fail/skip/cancel;229005.9982ms |
| `npm run test:http` |46/46 passed;0fail/skip/cancel;15892.5161ms |
| `node scripts/test-environment-guidance-browser.mjs` |7recorded states,280/360/768/1280 and200%text;0pageerrors/externalrequests/providerwrites |
| `git diff --check` | No whitespace errors; existing Windows line-ending notices only |

The browser used actual built components and authenticated proposal/rejection APIs; it exercised unavailable WebCrypto, keyboard generation/rejection, manual/imported-value preservation, private generated values, encrypted submission, reload clearing, failed-receipt guidance and a scoped recorded-source notice. An independent reader reviewed the fifth helper, callers and tests, matched13 current software files to r6 and found no blocking issue. Full aggregate browser suites, physical mobile keyboard, fresh live provider/model behavior and production rollout are not implied.

The earlier r5 full-domain attempt was interrupted without a final receipt and was not counted; a separate completed r5 run passed721/721 for the original four changes. The final five-change claim above is entirely the fresh r6 run. One r6 launcher started before the dependency junction finished and reported missing Biome; waiting for snapshot completion fixed orchestration without installing anything. No check from that failed launch is counted.

Earlier attempts are retained: a test initially expected recursively JSON-encoded values beyond the stated scope; the fixture was corrected to test the actual raw/one-level JSON/URL/form representations. The first no-emit check found an inferred nullable cursor type in a new test, corrected with an explicit type. Targeted lint caught an unsupported ARIA label on a generic element; the note now uses a named semantic section. A C-drive snapshot with an I-drive dependency junction failed module resolution before compilation; the same source was then built in a separate I-drive snapshot. None of these orchestration/test failures is counted as a product pass.

Unconfirmed boundaries: live model reasoning/monetary savings, actual Liara build-log variations beyond validated fixtures, live environment updates, actual runtime source-content identity, runtime browser workload execution, DNS/database provisioning/restore and complete platform acceptance. Recorded publication-source comparison is a narrower implemented boundary. Larger lifecycle proposals remain separate scoped work and do not weaken original workload or approval contracts.


<a id="source-investigation-and-setup-20261027-owner-authorized-commit-verification--2026-10-27"></a>

### Owner-authorized commit verification — 2026-10-27

The owner requested topical Conventional Commits for the remaining changes, with existing and concurrent work preserved. The audit froze 38 changed files on base `1aca4ff7fa091b2bf7d86b46fc1f65b0d63338da` and validated a separate 595-file export using the existing pinned dependencies. Candidate fingerprint: `1a548f3bf3457bf964216d6500bade56dc1a45dd0e714ba80d0d7d775b91ecd9` (SHA-256 of the base revision and sorted changed-path/blob bindings). No credential, real SQLite state or budget ledger was exported. The source files were committed from those frozen Git blobs, so later working-tree edits would remain unstaged. Only these verification/task documents were updated after validation; runtime bytes did not change.

Fresh checks on that export:

- `npm run lint`: zero errors, 48 warnings and 20 informational diagnostics.
- `npm run typecheck`: passed.
- `npm run test:domain`: 721/721 passed, zero failures/skips (220,192 ms).
- `npm run build -- --webpack`: passed.
- `npm run test:http`: 46/46 passed, zero failures/skips (18,248 ms), including the actual local HTTPS/SDK/stdio/browser MCP fixture.
- `node scripts/test-environment-guidance-browser.mjs`: seven recorded responsive/enlarged-text/review/import states passed, zero page errors, external browser requests or provider writes. Keyboard generation/rejection, unavailable WebCrypto, manual/imported-value preservation, encrypted proposal and reload clearing were exercised.
- Staged diffs and file lists were checked before each commit; no ignored working packet, secret file, archive, generated output or dependency tree was staged.

These are local/synthetic-provider acceptance checks. No Docker image build, live model/provider operation, new allowance, deployment or production-state change was performed by this commit audit. Historical public-release and worker evidence retain their original dates and scopes. The full aggregate browser suite and fresh live deployment are not inferred from these checks.
