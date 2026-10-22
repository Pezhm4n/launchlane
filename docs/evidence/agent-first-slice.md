# نخستین مسیر اجرایی Agent

تاریخ: ۲۰۲۶-۱۰-۲۲، Node 24.18.0، Next 16.4.2. پایه پیش از کار `ef5a3fb`، هسته `b3ebf55` و رابط `6d6926a` است. اصلاح‌های بعدی در `26d984c`، `e1c4c53` و `15aecaa` ثبت شدند. این گزارش پذیرش کامل A00–A19 یا AC17–AC34 نیست. مقادیر حساب، credential، بودجه شخصی و state اجرایی خصوصی در Git قرار ندارند.

## تطبیق A01 با source

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

## A06 و تصمیم runtime

نسخه نصب‌شده CLI برابر `0.163.0-alpha.10.2` و help واقعی `codex exec` بررسی شد. spike بدون credential و بدون request مدل، `wire_api="chat"` را در config رد کرد و `responses` خواست. این نتیجه فقط ناسازگاری همین اتصال با transport فعلی Chat را ثابت می‌کند؛ حالت Responses، حساب دیگر یا همه قابلیت‌های CLI بررسی نشده‌اند. worker محدود با provider مجاز پشت CodeRepairAdapter قرار گرفت. [ADR انتخاب worker](../decisions/0001-scoped-repair-worker.md) علت و trade-off را ثبت می‌کند.

## جریان و اختیار واقعی

کلاینت فقط goal، project reference، request key، expected revision و تصمیم محدود می‌فرستد؛ system/tool message یا نتیجه دلخواه را نمی‌سازد. `toolsForAgent` شش read و پیشنهاد اصلاحِ مشروط به gate دارد. هر نتیجه با call ID به همان درخواست مدل وصل می‌شود. نام ابزار، آرگومان، actor، source snapshot و هویت مقصد در host کنترل می‌شوند. خواندن release/log از هویت داخلی تازه app عبور می‌کند و نتیجه provider با داده خالی یکی نیست.

اجرای اصلاح سه مرحله دارد: پیشنهاد با snapshot جدا و بدون اجرای کد؛ تصمیم روی actor/session/revision/base/scope با اعتبار محدود؛ و سپس worker با آزمون شکست‌خورده اولیه، وصله و همان آزمون تغییرنکرده. worker و مدل اصلی سقف تجمعی model/tool/time همان run را مصرف می‌کنند. package، dependency، آزمون و فایل خارج scope قابل تغییر نیستند. خروج صفر بدون آزمون واقعی، آزمون skip یا early exit رسید موفق نمی‌سازد. پس از آزمون، source دوباره capture و با نسخه آزموده‌شده مقایسه می‌شود؛ همان archive به project selection نوع repair متصل است. source اصلی حفظ می‌شود.

اجرای آزمون shell ندارد؛ environment credential/NODE_OPTIONS به آن نمی‌رسد و permissionهای Node به workspace محدودند. child process، worker و addon مجاز نیستند. timeout و output cap اعمال می‌شوند. این روش **OS sandbox و جداسازی شبکه نیست**؛ gate پیش‌فرض خاموش است و استفاده از source خصمانه با ادعای مهار کامل پشتیبانی نمی‌شود.

## آزمون مدل و مرورگر واقعی

آزمون production ایزوله با مدل واقعی `gpt-6-luna` و `reasoning_effort=none`، mutation و Liara خاموش انجام شد. source، SQLite، picker، API، تصمیم و subprocess آزمون واقعی بودند. پاسخ مدل scripted نبود.

- درخواست انتشار برای پروژه آماده، `inspect_project→read_destination` را انتخاب کرد و نبود حساب مقصد را اعلام کرد. انتشار موفق ادعا نشد. reload هیچ request مدل تازه نساخت.
- درخواست مستقل درباره محاسبه فاکتور، source و آزمون مرتبط را خواند و پیشنهاد فقط `invoice.mjs` با آزمون موجود `invoice.test.mjs` داد. پیش از تصمیم، before/after test خالی بودند.
- پس از تصمیم در وب، baseline واقعی `26 !== 71` بود. worker قیمت را در تعداد هر قلم ضرب کرد؛ همان آزمون پس از اصلاح گذشت. archive ساخته و نسخه آزموده‌شده انتخاب شد؛ فایل اصلی همچنان خراب و دست‌نخورده ماند. مدل سپس مقصد را خواند و فقدان اتصال را قدم بعدی قرار داد. این run هفت درخواست مدل، شامل یک درخواست worker، و هفت ابزار مصرف کرد.
- دو goal این چرخه مجموعاً ده درخواست و ۱۲٬۹۴۲ توکن گزارش‌شده داشتند. usage گزارش provider، صورتحساب تأییدشده نیست. مصرف آزمایش‌های پیشین و نتیجه نامشخص نیز در journal خصوصی تجمعی حفظ شده‌اند.
- این چرخه یک ضعف معنایی هم نشان داد: بعد از اصلاح محلی، مقصد انتشار سؤال ضروری تلقی شد، با اینکه کاربر انتشار را عقب انداخته بود. در `15aecaa` مرز goal روشن‌تر شد. آزمون زنده تازه با تعداد صفر، چند قلم و اعشار، baseline مستقل `26.5 !== 81` و معیار اضافی فاکتور خالی/`3.75` داشت. worker همان آزمون را بدون تغییر گذراند؛ نتیجه محلی با question=null و nextAction=reply پایان یافت و مقصد خوانده نشد. دو goal این چرخه تازه ۹ درخواست و ۱۱٬۷۹۱ توکن گزارش‌شده داشتند؛ run اصلاح شش model و شش tool داشت. این شاهد، همان دو نمونه محدود را پوشش می‌دهد.
- harness زنده یک بار پیش از پایان worker، state queued/working را بررسی و assertion زودهنگام داد. GET مستقل بعدی، job succeeded، baseline ناموفق، آزمون موفق، انتخاب جدید و source اصلی را بررسی کرد؛ اجرای worker یا مدل replay نشد. شکست harness پنهان یا موفقیت کل هسته تلقی نشد.

در آزمون اولیه prompt، مدل برای readiness معمولی فایل‌های بیش از نیاز خواند. دستور «حداقل شواهد لازم برای هدف جاری» روشن‌تر شد؛ inspect شامل runtime/start/port/manifest است و برای انتشار معمولی audit منطق تجاری خواسته نمی‌شود. host نیز وجود سؤال/قدم ضروری را به needs_input تبدیل می‌کند؛ متن مدل به‌تنهایی terminal موفق تولید نمی‌کند. یک نمونه کنترل‌شده، ارزیابی عمومی کیفیت مدل نیست.

## regression و تعامل

candidate نهایی: `npm run check` شامل lint/typecheck، domain تازه ۱۸۴/۱۸۴ و bootstrap دو از دو بود؛ build و آخرین `test:http` با ۱۹/۱۹ نیز گذشتند. هیچ skip/failure در این اجراهای کامل نبود. انتقال فرم به تب مستقل، selector قدیمی `document.querySelector("form button[type=submit]")` در تست مرورگر را به composer پنهان می‌رساند؛ انتظار به همان دکمه جمع‌آوریِ کاربر منتقل شد، معیار enabled تغییر نکرد. یک خطای واقعی scroll accessibility نیز با امکان فوکوس transcript اصلاح شد؛ استثنای محلی lint دلیل دسترسی با صفحه‌کلید را کنار attribute توضیح می‌دهد.

دو counterexample دیگر پیش از اصلاح fail شدند: reload پس از انتخاب پروژه دیگر، رسید repair قدیمی را دوباره انتخاب می‌کرد؛ اکنون فقط base همان job قابل ارتقاست. نام آزمون `--help.test.mjs` نیز به‌عنوان option تفسیر می‌شد؛ separator قطعی `--` بین گزینه‌های Node و pathها قرار گرفت و preview/receipt با آن یکسان شد. آزمون جدید، اجرای literal همان فایل را با permissionهای محدود می‌سنجد.

suite جدید `scripts/test-agent-browser.mjs` از API و SQLite واقعی production با transport مصنوعی مدل استفاده می‌کند؛ اجرای Node و فایل‌ها واقعی‌اند. شروع پیش‌فرض بدون فرم‌های انتشار، حفظ draft میان تب‌ها/Back، picker و Escape/focus، reload بدون model replay، رد/تأیید اصلاح، رسید قبل/بعد، 429، cancel، 360/768/1280 و متن ۲۰۰٪ سنجیده می‌شوند. provider مصنوعی این suite شاهد اتصال مدل واقعی نیست؛ چرخه بالا آن مرز را جدا سنجید. نتایج candidate نهایی در verification ثبت می‌شوند.

## موارد باز و قدم بعد

A01 بسته شده است؛ A02/A03/A06/A17/A18 partial هستند. AC26 به انتشار تأییدشده و بررسی همان symptom نیاز دارد و بسته نشده است. ابزار publish/provision/env، هزینه معتبر در پیشنهاد Agent، plan approval چندمرحله‌ای، HTML workload، build/package-manager، streaming، MCP، OS sandbox، reader تازه و screen reader هنوز پذیرفته نشده‌اند. connection/context عوض‌شده مجوز ادامه روی انتخاب قبلی نیست؛ کاربر می‌تواند گفت‌وگوی تازه بسازد. پس از ثبت این برش، A04 و قرارداد plan برای A05/A08 مرز بعدی‌اند؛ current manual deployment و diagnosis، شاهد ضمنی کامل‌شدن آن‌ها نیستند.
