# Agent — architecture decisions

[Documentation](../README.md) · [Current support](../platform-support.md) · [Verification index](../verification.md)

These versioned records preserve the original decisions, source revisions, failures and evidence limits. Dates and passing counts apply only to the named snapshot, not the current release. Installation-specific locations and identities are omitted.

## Records

- [ADR 0001 — Durable approvals in a single local process](#0001-local-workflow)
- [توقف پیش از شروع انتشار](#0002-stopped-before-release)
- [0002 — بررسی محدود پاسخ پس از READY](#0002-workload-propagation)
- [0006 — پایان گفتگو با ابزار دارای قرارداد](#0006-typed-agent-completion)
- [0007 — شواهد انتخابی SRE با همان سیاست مقصد](#0007-sre-read-evidence)
- [ADR 0008 — بازیابی محدود timeout اتصال در خواندن لیارا](#0008-bounded-read-recovery)
- [ADR 0009 — اتصال پایدار و محدود فقط برای API لیارا](#0009-liara-transport-pool)
- [0010 — انتشار مرحله‌ای با همان موتور Agent](#0010-guided-publication)
- [ADR0018 — اختیار محدود مأموریت و artifact مشتق‌شده](#0018-bounded-mission-authority)
- [ADR 0020 — Codex as a bounded patch provider](#0020-codex-packet-worker)
- [ADR 0021 — Shared destination choice and bounded publication recovery](#0021-destination-choice-and-resume)
- [ADR 0030 — Exact review of public test fixtures](#0030-exact-public-test-fixture-review)

<a id="0001-local-workflow"></a>

## ADR 0001 — Durable approvals in a single local process

Status: accepted, 2026-10-21. Applies to the P1 operator-local MVP.


<a id="0001-local-workflow-context"></a>

### Context

A request may be accepted by the provider before its response is lost. Process
memory cannot distinguish that case from an action that never started. A fresh
approval must not become permission to repeat a possibly committed write.


<a id="0001-local-workflow-decision"></a>

### Decision

Use native `node:sqlite`, verified on Node 24.18.0, with short `BEGIN IMMEDIATE`
transactions, WAL, FULL synchronous commits and checksummed append-only
migrations. Atomically consume approval and persist the unique attempt before
entering the provider callback. Bind approval to actor, session, team, app,
operation, exact arguments, source hash and expiry.

Recover interrupted `executing` actions as `uncertain`; preserve `observing` as a
read-only continuation. Block conflicting app actions until evidence resolves
the earlier effect. A missing secret, timeout or new approval cannot erase an
attempt. Durable storage failure closes mutation; there is no memory fallback.

Use one local server process. A shared database service, ORM and queue add
coordination and deployment cost without solving the current bounded workflow.
Multi-process ownership and durable worker execution require a separate design
before they are enabled.


<a id="0001-local-workflow-consequences-and-evidence"></a>

### Consequences and evidence

Tests cover independent SQLite connections racing to claim one action, expiry,
replay, lost response, process recovery and migration/storage failure. Those are
offline invariants. They do not establish provider idempotency or live deployment
success. The live executor is intentionally disconnected until the relevant
adapter and outcome verification are implemented.

<a id="0002-stopped-before-release"></a>

## توقف پیش از شروع انتشار

وضعیت: اجراشده، ۲۰۲۶-۱۰-۲۲.

بارگذاری source و درخواست release دو اثر مستقل‌اند. گم‌شدن پاسخ source نمی‌تواند سلامت یا شکست بارگذاری را ثابت کند؛ نگه‌داشتن هر توقف در همین مرحله به‌عنوان انتشار نامعلوم نیز راه بازیابی امن را بی‌دلیل می‌بندد.

در این workflow، `release_started` پیش از تنها POST انتشار پایدار می‌شود و transition آن فقط از action در حالت executing ممکن است. وقتی action به uncertain رسیده و journal هنوز claimed/upload_started/uploaded است، ادامه همان handler نمی‌تواند وارد release شود. observer پس از تطبیق تازه مقصد، نتیجه مستقل `not_started` را ثبت و attempt را ناموفق می‌بندد. وضعیت source یتیم ممکن است نامعلوم بماند؛ این نتیجه ادعای «هیچ write انجام نشده» یا سلامت سایت ندارد.

approval و attempt قبلی مصرف‌شده می‌مانند. اقدام تازه از پیشنهاد و تأیید تازه می‌گذرد. پس از `release_started`، نبود receipt همچنان uncertain است و write متعارض را می‌بندد؛ نبودن release در یک صفحه فهرست، دلیل کافی برای عدم اثر نیست. Store همین تفاوت را مستقل از observer enforce می‌کند. این تصمیم بر journal تک‌فرایندی فعلی تکیه دارد؛ جای reconciliation یک release واقعاً ارسال‌شده را نمی‌گیرد.

<a id="0002-workload-propagation"></a>

## 0002 — بررسی محدود پاسخ پس از READY

وضعیت: پذیرفته‌شده برای انتشار v7. تاریخ: ۲۰۲۶-۱۰-۲۲.


<a id="0002-workload-propagation-مسئله"></a>

### مسئله

در [آزمون واقعی Agent](../evidence/agent.md#agent-publication-live)، Liara برای release تازه READY/current برگرداند، اما HTTP عمومی ابتدا 503 و در به‌روزرسانی بعدی مدتی مقدار نسخه قبل را داد. همان پاسخ بعداً بدون write تازه به مقدار مصوب رسید. provider metadata و ترافیک HTTP، snapshot اتمیک مشترک ندارند؛ علت داخلی upstream از این داده‌ها اثبات نمی‌شود.

تحمیل endpoint مصنوعی revision به پروژه عادی با تجربه هدف محصول سازگار نیست. قبول صرف READY یا تغییر معیار به پاسخ موجود نیز نتیجه نادرست ایجاد می‌کند. شکست فوری هر mismatch، بررسی دستی تکراری می‌خواهد و مدل را زود به تحقیق نامرتبط می‌فرستد.


<a id="0002-workload-propagation-تصمیم"></a>

### تصمیم

زمان پذیرش release برای v7 در journal ثبت می‌شود. oracle مصوب حداکثر پنج دقیقه فرصت دارد؛ mismatch در این پنجره فقط pending است. Agent با backoff تا 20s، سقف تعداد خواندن و همان بودجه پایدار، نتیجه را می‌خواند. پس از پنجره، mismatch شکست است. هیچ read یا timeout مجوز upload/release تازه ایجاد نمی‌کند. نسخه‌های تاریخی بدون timestamp همان semantics قبل را دارند.


<a id="0002-workload-propagation-پیامد-و-trade-off"></a>

### پیامد و trade-off

انتظار می‌تواند اعلام یک خطای واقعی و پایدار را تا پنج دقیقه عقب بیندازد؛ در مقابل، propagation مشاهده‌شده باعث پیشنهاد انتشار یا اصلاح تکراری نمی‌شود. پنج دقیقه یک حد اجرایی انتخاب‌شده است، SLA یا زمان اندازه‌گیری‌شده همه برنامه‌ها نیست. کمبود بودجه یا پایان اجرای host باید نتیجه ناقص و رسید قابل بازخوانی بدهد.

وضعیت موفق فقط وقتی ثبت می‌شود که همان oracle HTTP برقرار باشد و release قبل و بعد probe همچنان current/READY بماند. این fence، اثبات رمزنگاری‌شده نسخه‌ای که هر درخواست HTTP را پاسخ داده نیست؛ اگر پاسخ نسخه‌های مختلف یکسان باشد، این ابزار فقط رفتار مورد انتظار و metadata انتشار را سنجیده است. برای رفتار متمایز قبل/بعد، oracle مستقل لازم است. تغییر معیار یا artifact همچنان تصمیم تازه می‌خواهد.

<a id="0006-typed-agent-completion"></a>

## 0006 — پایان گفتگو با ابزار دارای قرارداد

وضعیت: پذیرفته‌شده. تاریخ: ۲۰۲۶-۱۰-۲۲.


<a id="0006-typed-agent-completion-مسئله"></a>

### مسئله

در آزمون واقعی آماده‌سازی، وصله و همان تست پذیرش موفق شدند و artifact آزموده‌شده انتخاب شد، اما پاسخ پایانی مدل JSON مورد انتظار نبود. host آن را با MODEL_PROTOCOL رد کرد؛ پیام آخر موفقیت کار محلی را توضیح نداد. دستور متنی «فقط JSON برگردان» قرارداد کافی برای پاسخ مدل نبود.


<a id="0006-typed-agent-completion-تصمیم"></a>

### تصمیم

کنترل داخلی `finish_investigation` با schema صریح کنار ابزارهای application به مدل عرضه می‌شود. مدل خلاصه، سؤال ضروری و قدم بعدی را با همان پروتکل tool call می‌فرستد. host همچنان وجود evidence، state مجاز، nextAction، متن و secret redaction را کنترل می‌کند. این کنترل ابزار زیرساخت نیست، مجوز write نمی‌دهد و در registry کاربردی وب/MCP قرار نمی‌گیرد. پاسخ متنی JSON قدیمی برای سازگاری پذیرفته می‌شود، اما prompt تازه پایان دارای قرارداد را می‌خواهد.


<a id="0006-typed-agent-completion-پیامد"></a>

### پیامد

پایان مدل فقط needs_input یا partially_completed می‌سازد؛ completed و remote_changes_verified همچنان از رسید اجرایی و workload check سرور می‌آیند. آرگومان اضافه، موفقیت ساختگی و پایان بدون evidence رد می‌شوند. نتیجه به همان پیام پایانی پایدار تبدیل می‌شود؛ follow-up، reload و شمار بودجه به پروتکل موازی یا فراخوانی اضافه نیاز ندارند. این تغییر تضمین عمومی اطاعت مدل از schema نیست؛ ورودی نامعتبر همچنان failure صریح دارد.

<a id="0007-sre-read-evidence"></a>

## 0007 — شواهد انتخابی SRE با همان سیاست مقصد

وضعیت: پذیرفته‌شده برای خواندن محدود؛ پذیرش عمومی SRE باز است. تاریخ: ۲۰۲۶-۱۰-۲۲.


<a id="0007-sre-read-evidence-مسئله"></a>

### مسئله

Agent می‌توانست وضعیت، release و logs را بخواند، اما probe و metric در collector ثابتِ گزارش محصور بودند. برای مسئله‌ای مانند «READY ولی همین صفحه500 است»، مدل به مشاهده مستقیم همان صفحه و تمایز داده منابع ناموجود نیاز داشت. دریافت همه منابع در یک ترتیب ثابت جای انتخاب بر اساس نتیجه را نمی‌گیرد. خروجی بزرگ یا لاگ خارج از زمان نیز می‌تواند زمینه مدل را پر کند یا علت نامرتبط بسازد.


<a id="0007-sre-read-evidence-تصمیم"></a>

### تصمیم

read_workload و read_metrics در همان registry application اضافه شدند. probe فقط origin تأییدشده همان app و path محدود را می‌پذیرد؛ همان WorkloadProbe با pin DNS عمومی، سقف زمان/حجم، redaction و منع redirect استفاده می‌شود. هویت داخلی app پیش و پس از هر منبع و context محلی پس از خواندن کنترل می‌شوند. یک probe، نه تأیید انتشار است و نه اندازه‌گیری ظرفیت/p95. parser metric واحد/زمان نامعلوم را همچنان unknown نگه می‌دارد.

read_logs بازه محدود یک تا۶۰ دقیقه پیش از شروع goal را می‌پذیرد؛ پیام‌های خارج از بازه، پیام‌های حذف‌شده برای حجم و پاسخ واقعاً خالی از هم جدا می‌مانند. خروجی logs/metrics با شمار omission و سقف byte برای زمینه مدل خلاصه می‌شود. source، body و logs همچنان داده نامطمئن‌اند و اختیار ایجاد نمی‌کنند.

در ارزیابی واقعی مدل، فیلد اضافیِ یک خواندن باعث توقف transport پیش از application شد. برای سه خواندن SRE، validation کامل در application انجام و خطای ورودی به‌صورت tool-result با call ID صحیح به مدل برمی‌گردد. علامت داخلی argumentValidation به provider ارسال نمی‌شود. همان RunBudget، تکرار ورودی و deadline، فرصت اصلاح را محدود می‌کنند؛ مجوز یا write تازه‌ای ساخته نمی‌شود. JSON ناقص، ابزار ناشناخته و قراردادهای strict قبلی همچنان fail closed هستند. الگوی reply فقط برای applicationهایی مجاز است که پیش از provider هر ورودی را validate می‌کنند.


<a id="0007-sre-read-evidence-پیامد"></a>

### پیامد

application و مدل تشخیص تاریخی بازنویسی نمی‌شوند؛ toolها برای facade آینده MCP نیز قابل reuse هستند، اما خود MCP پیاده نشده است. رد شناسه/مقصد/زمان، داده ناموجود و خطای provider به نتیجه موفق تبدیل نمی‌شوند. تحقیق فعلاً outcome خواندنی دارد؛ علت قطعی، source متناظر با release و اثر اصلاح هنوز به شواهد و آزمون همان مرز نیاز دارند.

<a id="0008-bounded-read-recovery"></a>

## ADR 0008 — بازیابی محدود timeout اتصال در خواندن لیارا

تاریخ: 2026-10-22. وضعیت: پذیرفته و پیاده‌شده؛ شاهد تازه PaaS در گزارش تحقیق ثبت می‌شود.


<a id="0008-bounded-read-recovery-مسئله-و-شواهد"></a>

### مسئله و شواهد

در آزمون وب پس از83d961d، حساب/تیم و catalog واقعی خوانده شدند، اما یک GET بررسی مقصد پیش از پیشنهاد و سپس GET شبکه در پیش‌بررسی ساخت شکست خوردند. در تلاش دوم، transport نوع TypeError با cause.code=UND_ERR_CONNECT_TIMEOUT را پس از10.491s ثبت کرد. هیچ create/upload/release ارسال نشده بود. این خطا پاسخ منفی API یا رد مجوز نیست. متوقف‌کردن کل هدف روی یک timeout گذرا، پیشنهاد معتبر و تصمیم کاربر را بی‌دلیل بی‌نتیجه می‌کرد.


<a id="0008-bounded-read-recovery-تصمیم-و-trade-off"></a>

### تصمیم و trade-off

فقط LiaraAccountClient و LiaraReadClient برای GET و فقط همین کد خطای اتصال، یک تلاش مجدد پس از250ms دارند. همان URL، credential، scope و signal مهلت header/body استفاده می‌شود. هر ارسال از RunBudget مشترک یک tool call مصرف می‌کند؛ سقف یا مهلت reset نمی‌شود. POST نمی‌تواند وارد helper خواندن شود. خطای نامشخص، پاسخ HTTP از جمله401/429/5xx، schema نامعتبر، تمام‌شدن بودجه و لغو کاربر این retry را فعال نمی‌کنند. هیچ error cause یا متن خام شبکه به مدل/UI فرستاده نمی‌شود.

افزایش timeout عمومی، محدودیت داخلی اتصال fetch را حل نمی‌کرد و تأخیر همه failureها را بیشتر می‌کرد. retry عمومی، نوشته احتمالاً ثبت‌شده یا429 را هم می‌توانست بی‌اجازه تکرار کند. یک تلاش برای خطای مشاهده‌شده، دامنه کوچک‌تر و مصرف قابل حساب دارد؛ تضمین دسترسی شبکه نیست. شکست دوم همچنان خطای typed می‌دهد و موفقیت ساختگی تولید نمی‌کند. مسیر مستقل اعتبارسنجی اتصال، همان سه GET همزمان و deadline15s را نگه می‌دارد؛ این retry به آن افزوده نشده است.

پیش‌بررسی ساخت و restart پس از خواندن‌ها، allowance یک write را دوباره کنترل می‌کنند. انتشار پس از اولین identity read، برای upload، دومین identity read با حداکثر دو ارسال و release چهار tool call باقی می‌خواهد. بودجه ناکافی پیش از claim و صفر write متوقف می‌شود؛ approval از retry خواندن، تمدید یا دوباره مصرف نمی‌شود. timeout پس از احتمال write همچنان uncertain و محتاج readback است.


<a id="0008-bounded-read-recovery-پذیرش"></a>

### پذیرش

regressionها بازیابی یک timeout، توقف در دو timeout، scope و header ثابت، cancellation/deadline/سقف مشترک، عدم retry پاسخ HTTP/خطای نامشخص، رد POST، اعتبارسنجی داده پس از retry و بودجه پیش از claim در سه عملیات را می‌سنجند. lost-create fixture همین cause شبکه را پس از side effect مصنوعی می‌دهد و همچنان یک create، عدم replay و recovery نامعلوم را انتظار دارد. این‌ها قرارداد مصنوعی‌اند؛ کدگذاری واقعی یک timeout مشاهده شده است، اما رفع زنده سناریوی SRE به اجرای مستقل بعدی نیاز دارد.

<a id="0009-liara-transport-pool"></a>

## ADR 0009 — اتصال پایدار و محدود فقط برای API لیارا

تاریخ: 2026-10-22. وضعیت: پیاده‌شده؛ نتیجه تازه وب/PaaS جدا ثبت می‌شود.


<a id="0009-liara-transport-pool-مسئله"></a>

### مسئله

پس ازb525c18، پیش‌بررسی ساخت گذشت ولی POST ساخت با UND_ERR_CONNECT_TIMEOUT پس از10.655s پاسخ نداد. journal به uncertain/request_started/CREATE_RECEIPT_UNKNOWN رفت و ارسال تکرار نشد. بدون ID برگشتی، app هم‌نام قابل پذیرش یا حذف نیست. بررسی فقط‌خواندنی بعدی دو404 و یکECONNRESET داشت؛ رسید نامعلوم حفظ شد.

اندازه‌گیری HTTPS با اتصال تازه، DNS برابر1–17ms و TCP برابر6–24ms و TLS برابر5.232–6.821s را نشان داد. API پاسخ می‌داد، اما handshake در شبکه این آزمون به سقف داخلی اتصال نزدیک بود. این مشاهده محدود، تضمین پایداری شبکه یا اثبات اثر write نیست.


<a id="0009-liara-transport-pool-تصمیم"></a>

### تصمیم

transport پیش‌فرض برای origin دقیق https://api.liara.ir از یک Pool مشترک undici با حداکثر۴ اتصال، connectTimeout=30s، keepAliveTimeout=30s و keepAliveMaxTimeout=60s استفاده می‌کند. HTTP/1.1 حفظ شده است. credential، body، redirect:error، no-store و AbortSignal از همان درخواست می‌آیند؛ deadline کوتاه‌ترِ application همچنان مقدم است. dispatcher سراسری تغییر نمی‌کند؛ BoxAPI، probe سایت، loopback و host مشابه از این Pool استفاده نمی‌کنند. این لایه هیچ درخواست یا POST را retry نمی‌کند. سیاست محدود GET در ADR0008 جدا می‌ماند.

تغییر با [custom dispatcher رسمی Node24.18](https://nodejs.org/download/release/v24.18.0/docs/api/globals.html#custom-dispatcher) و گزینه‌های [Client نسخه7.30.1](https://github.com/nodejs/undici/blob/v7.30.1/docs/docs/api/Client.md) انجام شد. یک dependency دقیق7.30.1 به lockfile اضافه شد؛ dependency انتقالی تازه ندارد. در آزمون native، نسخه8.12.3 با fetch داخلی این Node، invalid onRequestStart method داد. تست واقعی HTTP محلی همان شکست را حفظ می‌کند؛ نسخه سازگار شاخه۷ انتخاب شد. تشخیص این ناسازگاری با mock ممکن نبود.

نوشتن یک client HTTP/multipart/TLS تازه، سطح خطای بیشتری داشت. استفاده از Pool مستند، تغییر محدودتری است؛ dependency و نگهداری نسخه هزینه آن است. افزایش کلی deadline، retry بی‌قید یا تغییر policy مجوز توجیهی نداشت. reuse اتصال، handshakeهای تکراری را کم می‌کند؛ خطای شبکه همچنان ممکن است.


<a id="0009-liara-transport-pool-شواهد-و-مرزها"></a>

### شواهد و مرزها

سه GET واقعی وضعیت مقصد قبلی با فاصله۶s، سه404 و زمان7.014/0.500/1.067s داشتند. این اندازه‌گیری محدودِ مسیر فقط‌خواندنی است؛ benchmark عمومی یا تأیید نتیجه POST نیست. receipt نامعلوم اولیه و دفتر مصرف حفظ شدند. هیچ app بدون ID پذیرفته یا حذف نشد و همان create بازاجرا نشد.

سه regression، انتخاب Pool فقط برای origin دقیق، عدم اشتراک credential/signal، حفظ multipart، POST واحد پس از پاسخ گم‌شده در wire واقعی محلی و cancellation واقعی fetch را می‌سنجند. موفقیت مدل یا cloud از این تست محلی استنتاج نمی‌شود. اعتبارسنجی SRE بعدی روی مقصد تازه با journal و allowance مشخص انجام می‌شود؛ دفتر مصرف قبلی reset نمی‌شود.

<a id="0010-guided-publication"></a>

## 0010 — انتشار مرحله‌ای با همان موتور Agent

وضعیت: تصمیم پذیرفته‌شده محصول؛ ۲۰۲۶-۱۰-۲۲. پیاده‌سازی و حدود آزمون در TASKS و verification ثبت می‌شوند.

مسیر پیش‌فرض `view=publish` است و ناوبری دقیقاً دو تب «انتشار پروژه» و «بررسی مشکل سایت» دارد. `view=agent` قدیمی به انتشار نگاشت می‌شود؛ صرف navigation یا reload هیچ کار اجرایی شروع نمی‌کند. چت فقط از launcher پایین چپ باز می‌شود و بسته‌شدنش کار سرور را متوقف نمی‌کند.

دکمه‌های جریان اصلی یک ورودی structured شامل انتخاب پروژه/نسخه، مقصد و معیار نتیجه می‌سازند. این ورودی در همان AgentRun پایدار می‌ماند؛ host اعتبار ورودی، idempotency، context، بودجه و مجوز را enforce می‌کند. ساختن prompt جای این قرارداد را نمی‌گیرد. مدل از همان registry برای تحقیق و اصلاح انتخاب می‌کند؛ applicationهای فعلی همچنان مالک archive، approval، write journal و readback هستند.

نمای اصلی فقط قدم جاری، تصمیم لازم و نتیجه واقعی را نشان می‌دهد. سابقه، diff، log و receipt فنی بازشدنی‌اند. مسیر شکست/اصلاح/آزمون/انتشار مجدد در انتشار باقی می‌ماند. تب فنی source را پیش‌شرط read نمی‌کند. پنل اختیاری، modal موبایل و nonmodal دسکتاپ است؛ هنگام dialog اصلی مزاحم نمی‌شود. الگوی تعامل گلستون فقط مرجع رفتاری است؛ کد یا backend آن کپی نمی‌شود.

اجرای عمومی npm/build به sandbox سیستم‌عامل نیاز دارد؛ worker قدیمی Node permission به‌تنهایی آن نیست. توسعه این مرز پشت همان CodeRepair adapter انجام می‌شود و رسیدهای تاریخی بازنویسی نمی‌شوند. وجود رابط جدید یا نتیجه مصنوعی، پذیرش عمومی Node/Next/env یا استقرار واقعی نیست.

<a id="0018-bounded-mission-authority"></a>

## ADR0018 — اختیار محدود مأموریت و artifact مشتق‌شده

به‌روزرسانی ۲۰۲۶-۱۰-۲۳: [چرخه زنده روی candidate06](../evidence/agent.md#codex-publication-mission) build fail، patch داخلی، آزمون مستقل و انتشار همان artifact را با یک برنامه مصوب گذراند؛ عبارت‌های UNCONFIRMED پایین، وضعیت تاریخی هنگام این ADR هستند. [ADR0020](agent.md#0020-codex-packet-worker) قرارداد v2 انتخاب عامل و تاریخچه بازبینی را اضافه می‌کند؛ canonicalization نسخه۱ و ActionSpecهای قبلی محفوظ است. پذیرش عمومی AC23، همه runtimeها و منابع وابسته همچنان بازند.

وضعیت: implemented_verified در محدودهٔ آزمون قطعی محلی؛ [شاهد candidate](../evidence/agent.md#mission-authority). این برش تمام AC23 نیست و انتشار زنده آن هنوز UNCONFIRMED است.


<a id="0018-bounded-mission-authority-مسئله-و-انتخاب"></a>

### مسئله و انتخاب

تصمیم‌های تک‌اقدامی، artifact دقیق را می‌بندند ولی قبل از build نمی‌توان hash یک اصلاح آینده را دانست. افزودن اختیار ضمنی به پیام مدل یا برابر فرض‌کردن hash اولیه و بسته بعدی، کنترل سرور را از بین می‌برد. قرارداد جداگانه `MissionPlan version=1, revision=1` یک تصمیم انسانی برای build، اصلاح محدود و انتشار به **یک مقصد موجود** می‌گیرد. ActionSpecهای v1–v12 و canonicalization آن‌ها تغییر نمی‌کنند؛ هر انتشار همچنان ActionSpec دقیق خودش را دارد.

برنامه root project/source/archive/selection، حساب/تیم/app ID، plan/bundle/network، origin، image، فرمان‌ها، environment reference، معیار workload، فایل‌های مجاز، تعداد build/repair/publication، سقف موجود مدل/ابزار/زمان و مهلت را می‌بندد. قیمت پایه از catalog زنده با واحد تومان/ساعت خوانده می‌شود؛ مبلغ نامعلوم جایگزین قیمت نمی‌شود. پیش از مجوز انتشار، metadata و قیمت همان ترکیب دوباره خوانده می‌شوند؛ تغییر قیمت یا مقصد تصمیم تازه لازم دارد. مالیات/ترافیک/ذخیره‌سازی در قیمت پایه نیستند. این اختیار منبع، env، migration، disk، database یا resize تازه نمی‌سازد و تضمین صورتحساب کل نیست. هزینه مدل هنوز با سقف تعداد/زمان مأموریت محدود می‌شود؛ سقف پولی محصول و connector بیرونی در این برش پیاده نیستند.


<a id="0018-bounded-mission-authority-اجرا-و-منشأ"></a>

### اجرا و منشأ

Migration11 فقط سه جدول append می‌کند: `mission_authorities`، `mission_steps` و `mission_artifacts`. هش برنامه actor-bound است. تصمیم با نشست انسانی، revision و hash بررسی می‌شود؛ تأیید برنامه، رزرو build اول، صف job و CAS مأموریت در یک transaction ثبت می‌شوند. تصمیم تکراری هیچ تلاش تازه‌ای نمی‌سازد.

Driver همان application موجود را ادامه می‌دهد. هر job جدید باید همان build/image/workload/environment و زیرمجموعه فایل‌های مصوب را داشته باشد؛ dependency، تست، تنظیمات سنجش و فرمان‌ها تغییر نمی‌کنند. هر تلاش پیش از اجرا رزرو می‌شود و worker اختیار/نشست/بودجه مشترک را پیش از claim، مصرف و ساخت artifact دوباره بررسی می‌کند. سقف پیش‌فرض این برنامه 3 build، 2 repair و 2 publication است؛ این‌ها انتخاب محصول در همین برش‌اند و قانون مسابقه نیستند.

فقط receipt موفق و پایدار میزبان، پس از کنترل patch و آزمون مستقل، می‌تواند source جدید را به base قبلی متصل کند. رکورد مشتق، job و base/source/archive و اثر انگشت receipt را نگه می‌دارد. قبل از publication و هنگام claim، زنجیره دوباره از jobهای actor-scoped خوانده می‌شود؛ ادعای worker، artifact قدیمی/بی‌تست و receipt دستکاری‌شده مجوز نیستند. root هم به build موفق همان بسته نیاز دارد. audit انتشار مشتق، `mission_authorized` و ارتباط با اختیار اصلی را نگه می‌دارد.

Write همچنان یک owner و attempt دارد. timeout نامعلوم وارد مشاهده می‌شود و outer loop هیچ upload/release را blind retry نمی‌کند. گذار مستقیم به job یا انتشار بعدی در همان driver و همان RunBudget است؛ برای مراحل داخل محدوده، دکمه ادامه لازم نیست. خروج از محدوده کارت تصمیم می‌سازد. تصمیم صریح تک‌اقدامی بعدی، اختیار برنامه قبلی را لغو می‌کند. cancel، تغییر context در حالت تصمیم و restart اختیار را لغو می‌کنند؛ restart آن را تمدید نمی‌کند. نتیجه عملیات نامعلوم پس از پایان اختیار همچنان قابل خواندن است.


<a id="0018-bounded-mission-authority-محدودیت-و-گزینه-ردشده"></a>

### محدودیت و گزینه ردشده

مجوز نامحدود «هر چیزی لازم شد» رد شد. حفظ یک تصمیم برای هر patch، مسیر بدون واسطه را نمی‌بست؛ جایگزین آن، برنامه محدود با تبار کنترل‌شده است. این نسخه فقط از پیشنهاد build با مقصد موجود شروع می‌شود. ساخت مقصد/منابع، آماده‌سازی entry یا lock مفقود و تغییر dependency هنوز به قراردادهای خودشان نیاز دارند. هیچ‌کدام از این حدود، پایان دامنه A05/A11/A14 نیستند.

آزمون قطعیِ container، build ناموفق، patch بی‌اثر با همان آزمون، اصلاح مؤثر، انتخاب artifact و publication را با مدل/PaaS مصنوعی اجرا می‌کند. این آزمون شاهد انتشار زنده نیست. گزارش candidate و اجرای زنده در evidence جدا نگه داشته می‌شوند. timeoutهای تاریخی fixture با محدودکردن concurrency علت‌یابی نشده‌اند و همچنان مسئله باز خود را دارند.

<a id="0020-codex-packet-worker"></a>

## ADR 0020 — Codex as a bounded patch provider

Status: accepted for the execution spike, 2026-10-23. Product selection and general connector acceptance remain open.

The existing worker retains source capture, its separate workspace, unchanged independent tests, patch validation, artifacts and mission policy. Codex supplies a replacement proposal through `ModelPort`; it cannot approve, declare tests successful, select an artifact or deploy. The installed interface is `codex-cli 0.163.0-alpha.11`, `codex exec --json --output-schema`, with separate existing ChatGPT authentication. The official CLI avoids a new SDK dependency; exact version matching fails closed on an unverified upgrade. MCP is a separate capability.

The native restricted Windows sandbox canary failed before execution: `Restricted read-only access requires the elevated Windows sandbox backend`. No elevation or broader permissions were attempted. This connector uses **packet-only** operation: host-supplied source/failure, ephemeral thread, ignored user configuration/rules, disabled device tools/MCP/agents/web, no inherited cloud/model credentials, restricted read profile and network policy. Actual install/build/test/start remain in the bounded Docker worker. Workspace-capable external execution is not verified.

The server checks actor, working job, parent, base, paths and canonical workspace. Version/auth reads and the model slot consume the same parent budget. Migration13 appends the execution receipt before dispatch; one job has one owner. Cancellation, crash, lost response or rejected operation leaves an uncertain receipt and stops further repair in that parent. It cannot start an internal worker in parallel. The host rejects command/file/MCP/web events and independently validates patch scope, hashes, tests and artifact.

The official SDK defines ErrorItem as a **non-fatal diagnostic**. The original decoder incorrectly rejected two actual responses. Failed jobs remain failed. A completed metadata-only receipt plus unchanged workspace permits usage settlement, not acceptance of a lost patch or fresh authority. The second parent used its remaining repair slot. An accounting defect also omitted external tokens and CLI reads; exact-once settlement retained original observations and did not renew limits or the expired session. Current receipts record accounting boundaries for crash reconciliation.

Subscription cost and underlying provider request/retry count are unavailable: unpriced/unconfirmed, never zero or a renewed BoxAPI allowance. At the spike boundary, per-mission choice/fallback consent, monetary budget handling, persisted final-result recovery and product-to-cloud acceptance remained required. The following extension implements choice/consent; its live acceptance is recorded separately.


<a id="0020-codex-packet-worker-product-choice-extension"></a>

### Product choice extension

MissionPlan v2 binds the internal/Codex choice, verified CLI version, explicit `gpt-6.1-sol` model, packet-only mode, acknowledgment of unpriced subscription use and optional pre-dispatch fallback. V1 parsing/canonicalization stays unchanged; old ActionSpecs are untouched. The web plan proposal invokes the same application service. Editing a proposed unexecuted plan increments its revision and changes its ID/hash; append-only migration14 archives the prior contract. Execution steps prevent replacement after approval. Old approvals cannot authorize the revised plan.

At execution, the common driver obtains the provider from the approved plan. Fallback accepts only unavailable executable, incompatible version or missing authentication **before** a durable external dispatch, and only with explicit plan permission. Budget, scope, refusal, revoked consent, cancellation and uncertain execution cannot trigger fallback. The original job, independent tests, artifact policy and parent budget continue. Claude Code/OpenCode are visibly unavailable until independently implemented; choosing Codex is not a connected/ready handshake claim.

Evidence: [actual executions](../evidence/agent.md#codex-executable-worker). Primary references: [non-interactive execution](https://learn.chatgpt.com/docs/non-interactive-mode), [configuration](https://learn.chatgpt.com/docs/config-file/config-reference), [permissions](https://learn.chatgpt.com/docs/agent-approvals-security), [official SDK event types](https://github.com/openai/codex/blob/main/sdk/typescript/src/items.ts). Installed help and probes take precedence over examples for another version.

<a id="0021-destination-choice-and-resume"></a>

## ADR 0021 — Shared destination choice and bounded publication recovery

Status: accepted for the bounded Node/Python publication flow, 2026-10-23. Broader runtime and live connector acceptance remain separate.

An empty account must not require app creation in Liara's console. The existing destination application creates the review card and, after a server-validated decision, the exact app. Structured publication resolves the destination before executable build work so the program can bind a real app, price and coding-agent choice. Independent local source preparation retains its existing contract.

The recommendation is derived from the selected source and the same fresh account catalog used by the proposal. It offers the least expensive available priced starting option and alternatives, with a source-specific runtime/build/env summary. It does not claim measured capacity or invent RAM/CPU units. Unknown prices stay unavailable for purchase. The public recommendation is bound to project, source, catalog fingerprint and exact selected price.

Changing a paused destination choice calls the same proposal application, charges its reads to the existing parent allowance and atomically cancels the previous action, creates the new action and updates the run through CAS. A stale run rolls back both actions. The same selection performs no read. No model call or infrastructure write follows from selecting a radio, refreshing, switching views or opening the assistant. Old approval cannot authorize the new choice.

The optional assistant uses the shared catalog/quote tools for price questions. Its explicit publication control displays the existing publication panel through a portal; it moves the same review and callbacks rather than creating another run, copy of the cards or execution engine. Closing it returns that view to the publication page. Plain conversation never grants consent, executes a proposal or claims successful publication.

Cancellation revokes program authority. Resuming retains the run ID, source, workload, usage and limits. The live controller must have stopped, and uncertain provider/external execution must be reconciled first. Pending unexpired destination/network decisions can be restored without model execution. Approved but unattempted actions are revoked before another continuation. An old build-before-target proposal is cancelled and replanned in the same parent. The owner being resumed is excluded from the competing-run check; another working run or decision is still rejected.

Append-only migration15 preserves historical program/step/artifact bytes and foreign keys while allowing a successor program after revocation. Each successor has a fresh ID and incremented revision; previous steps and derived artifact evidence remain attached to their original authority. It grants no fresh run allowance. ActionSpec canonicalization and historical MissionPlan v1/v2 contracts are unchanged.

Trade-off: this recommendation is a defensible low-cost starting point, not load sizing. Capacity recommendation needs actual workload measurements. Returning from cancellation may require a new program decision because cancellation withdrew consent; an unresolved write never becomes a retry button. The assistant's publication controls share the exact web instance, while its question thread remains read-only.

Acceptance and failures: [destination choice and recovery evidence](../evidence/operations.md#destination-choice-and-resume).

<a id="0030-exact-public-test-fixture-review"></a>

## ADR 0030 — Exact review of public test fixtures

Date: 2026-10-25. Status: implemented; used locally with explicit owner confirmation.

Some real projects contain intentionally public password/token examples in authentication tests. Inferring that all credentials in all test files are harmless would weaken the source boundary. Dropping or rewriting those tests would change the project being validated.

An operator can run `npm run review:source-fixtures -- --project <absolute-path> --file <test-path> ... --confirmed-public-test-fixtures` after explicit owner confirmation. The product records exact relative test paths and SHA-256 values with a seven-day maximum expiry. A domain-separated installation HMAC, bounded regular-file reads and atomic locked writes protect the private registry. Repeating an active identical review reuses it; recovery does not renew it.

Inspection retains the original bytes and records applied review IDs, hashes and expiry in the project profile and shared Agent/MCP inspection. A changed file, expired review, invalid signature or known installed/imported secret is not exempted. An inspector without an installation key has no review authority and uses ordinary strict scanning. The registry is operator configuration, never a model-supplied tool argument, cloud approval or budget allowance.

The registry lives under the configured private state directory as `source-fixture-reviews.json`. Do not commit it or copy its signature between installations with different keys. A public installation must validate a separately installed review with the same approved bytes and remaining expiry. See the evidence report for the three owner-confirmed Golestan files.
