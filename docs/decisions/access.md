# Access — architecture decisions

[Documentation](../README.md) · [Current support](../platform-support.md) · [Verification index](../verification.md)

These versioned records preserve the original decisions, source revisions, failures and evidence limits. Dates and passing counts apply only to the named snapshot, not the current release. Installation-specific locations and identities are omitted.

## Records

- [اتصال حساب‌ها در نصب محلی](#0001-account-connections)
- [0016 — ورود پوشه با مجوز مرورگر](#0016-browser-folder-import)
- [ADR 0017: MCP روی application موجود و یک مالک اجرای SQLite](#0017-shared-mcp-facade)
- [ADR0022 — Project library and private environment import](#0022-project-library-and-private-environment-import)
- [ADR0024 — ورود بازدیدکننده با هویت لیارا](#0024-liara-identity-login)

<a id="0001-account-connections"></a>

## اتصال حساب‌ها در نصب محلی

وضعیت: تصمیم مهندسی برای UX61/62؛ storage و backend ورود/catalog GitHub پیاده شده‌اند، اتصال محصول هنوز در حال تکمیل است. مبنا: `9437a05`، ۲۰۲۶-۱۰-۲۱.


<a id="0001-account-connections-مسئله-و-گزینهها"></a>

### مسئله و گزینه‌ها

کاربر باید از مرورگر حساب را متصل کند، بدون ثبت client یا فهم تنظیمات سرور. وب‌اپ فعلی یک نصب محلی با یک کاربر و محدوده مشخص است. اتصال جعلی، token در URL/مرورگر و وابستگی به credential ابزار Coding Agent پذیرفته نیستند.

برای GitHub، OAuth اختصاصی و GitHub App به ثبت و تنظیم واقعی مالک محصول نیاز دارند؛ در این نصب آماده نیستند. GitHub App دسترسی مخزن محدودتری می‌دهد و برای محصول عمومی گزینه مناسب‌تری است. در فرصت فعلی، [ورود رسمی GitHub CLI](https://cli.github.com/manual/gh_auth_login) مسیر اصلی است: ابزار ثبت‌شده و قابل اجراست و credential را خودش نگه می‌دارد. trade-off آن درخواست scopeهای عمومی ابزار رسمی است؛ UI باید روشن کند که دسترسی واقعی مخزن تابع مجوز حساب/سازمان است و خود Launchlane فقط عملیات خواندن محدود را ارائه می‌کند. client ID یا secret آن در محصول کپی نمی‌شود.

نسخه 2.103.0 از release رسمی دریافت و SHA-256 با digest همان asset در API رسمی تطبیق داده شد. در حالت non-interactive، [کد رسمی](https://github.com/cli/cli/blob/v2.103.0/internal/authflow/flow.go) code و نشانی واقعی device flow را خروجی می‌دهد؛ راه‌اندازی سرور callback توسط Launchlane لازم نیست. adapter باید actor/run/expiry و CSRF را کنترل کند، raw output را log نکند، نشانی ورود را validate کند و پس از grant هویت واقعی را بخواند. state/PKCE پروتکل اختصاصی در Launchlane بازسازی نمی‌شود. شروع pending flow هنوز اتصال حساب محسوب نمی‌شود.


<a id="0001-account-connections-liara-و-محدودیت-ورود-مرورگری"></a>

### Liara و محدودیت ورود مرورگری

[مستند رسمی](https://docs.liara.ir/references/cli/login/) ورود مرورگری CLI را عرضه می‌کند؛ این سند مجوز OAuth عمومی برای وب‌اپ مستقل نیست. در نسخه نصب‌شده 9.4.7، `lib/base.js:137` callback بدون host صریح loopback، state و سقف body ساخته می‌شود. یک spike با همان method و browser/HTTP/get-port مصنوعی نشان داد POST با Origin متفاوت، بدون state و body برابر 131160 بایت پاسخ 200 می‌گیرد. هیچ socket، مرورگر، حساب یا credential واقعی در این spike استفاده نشد.

بنابراین این callback داخل وب‌اپ کپی یا بدون کنترل اجرا نمی‌شود. مسیر انتخاب‌شده راهنمای کوتاه دریافت کلید از بخش API کنسول رسمی، ورود مستقیم کلید در فرم امن و اعتبارسنجی محدود هویت/تیم پیش از ذخیره اتصال است. استفاده از credential موجود CLI، اگر اضافه شود، فقط با انتخاب صریح کاربر و همان اعتبارسنجی است. هیچ رمز پنل به API یا مدل ارسال نمی‌شود. به‌عنوان حد مستند، [اطلاعات حساب](https://docs.liara.ir/references/api/get-info/) و PaaS در دسترس‌اند؛ shape تیم و حساب واقعی هنوز به خواندن زنده محدود نیاز دارند.


<a id="0001-account-connections-نگهداری-و-پیامد"></a>

### نگهداری و پیامد

SQLite اتصال را به actor می‌بندد. کلید لازم Liara فقط در ciphertext با AES-256-GCM و nonce تصادفی نگه داشته می‌شود؛ کلید رمزگشایی از secret سمت سرور با domain separation مشتق و actor/provider در AAD احراز می‌شوند. plaintext credential در metadata عمومی، browser storage، log یا مدل قرار نمی‌گیرد. تغییر secret نصب، نیاز به اتصال مجدد ایجاد می‌کند؛ fallback به plaintext وجود ندارد.

برای GitHub، credential در اختیار CLI/credential store سیستم می‌ماند؛ Launchlane هویت تأییدشده و روش استفاده را ثبت می‌کند. CLI طبق مستند ممکن است هنگام نبود credential store به فایل خصوصی fallback کند؛ این وضعیت باید در مسیر اتصال تشخیص داده شود و امن‌بودن keyring فرض نشود. قطع اتصال داخل Launchlane به معنای ابطال کلید یا خروج همه ابزارهای رایانه از سرویس نیست. تنظیمات مالی/اعتبار، approval عملیات زیرساخت و gate مدل مستقل می‌مانند.

در پیاده‌سازی فعلی، login فقط با GH_CONFIG_DIR اختصاصی actor، بدون shell، با محیط محدود و deadline پنج دقیقه اجرا می‌شود. تنها کد و نشانی دقیق device رسمی از خروجی استخراج می‌شوند؛ raw output ثبت نمی‌شود. اتصال پس از پایان CLI، auth status با no-refresh و خروجی بدون token، تطبیق tokenSource=keyring و /user و تأیید نام حساب توسط کاربر ذخیره می‌شود. fallback فایل اتصال موفق محسوب نمی‌شود و فقط hosts.yml همان ورود خصوصی پاک می‌شود؛ ورود سراسری سیستم حذف نمی‌شود. تأیید هم‌زمان، لغو، تغییر حساب و expiry نمی‌توانند اتصال تازه ثبت کنند. هر catalog هویت واقعی را دوباره تطبیق می‌دهد.

npm run setup:github روی Windows x64 نسخه pinned را داخل پوشه ignored نصب، SHA-256 را پیش از اجرا بررسی و فقط bin/gh.exe را استخراج می‌کند. این فرمان ورود یا grant ایجاد نمی‌کند. کلاینت OAuth ثبت‌شده متعلق به ابزار رسمی است؛ Launchlane از client ID یا callback ساختگی استفاده نمی‌کند. اتصال زنده حساب و دسترسی مخزن خصوصی هنوز به grant انسان و آزمون محدود نیاز دارند.

اعتبارسنجی صریح حساب لیارا سه GET محدود دارد: /v1/me، همان endpoint با teamID ثابت و /v1/projects همان تیم. این درخواست فقط پس از submit کاربر، session/Origin/CSRF معتبر انجام می‌شود. gate خواندن شواهد سرویس همچنان مستقل و پیش از تمام LiaraReadClientها enforce می‌شود؛ اتصال آن gate یا gate مدل/تغییر زیرساخت را فعال نمی‌کند. metadata اتصال با صفر درخواست provider خوانده می‌شود. پاسخ me فیلدهای هویتی و کلیدهای Object Storage دارد؛ فقط نام/هویت حساب و نام تیم استخراج می‌شوند و پاسخ خام ذخیره یا وارد مدل نمی‌شود. parser فعلی team._id/name را سخت‌گیرانه می‌خواهد؛ این shape در تست قراردادی مصنوعی پوشش دارد و تا تطبیق زنده تأییدشده نیست.

فهرست برنامه‌ها صرفاً discovery در تیم ثابت است. فقط انتخاب صریح یک برنامه محدوده عملیات همان actor را تعیین می‌کند؛ allowlist مدیر نصب، اگر تنظیم شده باشد، محدودیت بالادست باقی می‌ماند. قطع اتصال فقط credential رمز‌شده و ارتباط محلی را حذف می‌کند و کلید سرویس را ابطال نمی‌کند. اعتبار مالی یا هزینه پلن از موفقیت این GETها استنتاج نمی‌شود.

<a id="0016-browser-folder-import"></a>

## 0016 — ورود پوشه با مجوز مرورگر

وضعیت: پیاده‌شده؛ ۲۰۲۶-۱۰-۲۳. مرتبط با AC32 و انتخاب منبع در مسیر انتشار هدایت‌شده.

انتخاب‌گر پیشین فقط زیرپوشه‌های `LAUNCHLANE_WORKSPACE_ROOT` را می‌دید. افزودن مرور آزاد دیسک به سرور، مجوز آن را از محدودهٔ نصب فراتر می‌برد و در نصب راه‌دور هم رایانهٔ کاربر را نشان نمی‌داد.

تصمیم: انتخاب پوشه از طریق ورودی استاندارد `webkitdirectory` مرورگر انجام می‌شود. مرورگر فایل‌های خصوصی، وابستگی‌ها و موارد خارج از سیاست مشترک منبع را پیش از ساخت multipart کنار می‌گذارد. کاربر نام پوشه، تعداد و حجم فایل‌ها را می‌بیند و ورود را جداگانه آغاز می‌کند. سرور پس از احراز هویت، Origin و CSRF، بدنه، مسیر، نوع، تعداد و حجم فایل‌ها را مستقل بررسی می‌کند. کپی در `stateDir/uploaded-sources/<flow-id>` ذخیره و با همان بررسی منبع، تشخیص اطلاعات حساس و بستهٔ immutable موجود آماده می‌شود. مدل، اسکریپت پروژه و API لیارا در این مرحله اجرا نمی‌شوند.

این انتخاب دسترسی سرور به دیسک را گسترش نمی‌دهد؛ پروژهٔ اصلی تغییر نمی‌کند. به‌روزرسانی فایل‌های اصلی نیازمند انتخاب و ورود دوبارهٔ پوشه است. پوشه‌های خالی و metadata سیستم‌فایل در کپی منتقل نمی‌شوند؛ محتوای فایل‌های مجاز مبنای hash و تأیید انتشار است. سقف مشترک ۱۰۰۰ فایل و ۲۰ مگابایت، حداکثر ۱۶ نسخهٔ واردشده و timeout دریافت ۳۰ ثانیه است. مرور پوشهٔ مجاز نصب برای کاربرانی که از آن استفاده می‌کنند در بخش فرعی باقی می‌ماند. دیالوگ بومی سیستم توسط مرورگر نمایش داده می‌شود؛ پشتیبانی روی دستگاه و مرورگر فیزیکی فراتر از Chromium آزموده‌شده هنوز تأیید نشده است.

<a id="0017-shared-mcp-facade"></a>

## ADR 0017: MCP روی application موجود و یک مالک اجرای SQLite

تاریخ: ۲۰۲۶-۱۰-۲۳. وضعیت: برش نخست اجرا و آزموده‌شده؛ پذیرش کامل A16 و connector اجرایی هنوز باز است.

HTTP در `/api/mcp` داخل process همان وب‌اپ اجرا می‌شود. SDK رسمی `@modelcontextprotocol/server` و `@modelcontextprotocol/client` دقیقاً2.3.1 و چهارده dependency افزوده در lockfile ثبت‌اند. SDK نسخه نصب‌شده، `createMcpHandler` و transportهای واقعی از source/typeهای همان package بررسی شدند؛ کد مبتنی بر API تاریخی SDK1 نوشته نشده است. schema ابزار خواندن از `toolsForAgent` می‌آید و همان `executeAgentTool`، context fence، محدودیت source، redaction و provider adapter را اجرا می‌کند. schema تبدیل‌شده با Standard Schema خود SDK validate می‌شود.

ابزارهای lifecycle، wrapper روی `createPublicationMission`، `resumePublicationMission`، `AgentRepository` و `cancelAgentRun` هستند. مأموریت طولانی ID می‌دهد و با همان event/revision از MCP یا وب بازیابی می‌شود؛ reconnect، tools/list و خواندن progress هیچ درخواست مدل یا write تازه نمی‌سازند. ثبت تکراری از دو transport به همان مأموریت می‌پیوندد. بودجه مدل/worker/ابزار داخل AgentRun باقی می‌ماند؛ read موردی بیرون مأموریت همان بودجه محدود درخواست خواندن را دارد. عملیات publication، تصمیم و journal دیگری ندارد.

بازبینی پس ازb59eef9، مرز read مستقیم را نیز بست: مالک فعال، read موازی از transport دوم نمی‌پذیرد. read واقعی مأموریت متوقف‌شده همان usage/elapsed/limits پایدار را با CAS و reserve پیش از provider مصرف می‌کند؛ شکست reserve، revision خواندن معتبر رقیب را تغییر نمی‌دهد. replay state/events بدون مصرف مدل/ابزار می‌ماند. ورودی publication نیز schema مشترک با parser وب دارد؛ schema جدا با حد متفاوت نگه‌داری نمی‌شود.

یک subprocess مستقیم stdio که Store را باز کند، recovery و مالک write دوم می‌سازد. انتخاب، bridge با Client/Server رسمی SDK است: فقط پیام را به HTTP احرازشده می‌رساند؛ runtime، Store و credential مدل/لیارا را import نمی‌کند. stdout فقط protocol است و خطای اتصال عمومی به stderr می‌رود. bridge redirect را دنبال نمی‌کند و مقصدش فقط origin loopback با مسیر دقیق `/api/mcp` است. این تصمیم قابلیت عمومی public hosting یا OAuth نیست.

وب‌اپ پس از session/Host/Origin/CSRF، token جدا با audience مخصوص MCP صادر می‌کند. token به actor، نشست والد، نشست فرزند، انقضا و scope خواندن یا خواندن+مأموریت امضا شده است. عمر از نشست والد بیشتر نیست و حداکثر یک ساعت است؛ logout والد و revoke فرزند فوراً درخواست بعدی را رد می‌کنند. همان جدول sessions موجود reuse شده؛ migration یا canonicalization ActionSpec تغییر نکرد. token مدل/لیارا یا کلید ورود اپراتور در tool result قرار نمی‌گیرد. فایل دسترسی در `.local` خصوصی است و config میزبان فقط مسیر آن را دارد؛ مجوزهای filesystem/ACL نصب نیز باید خصوصی بمانند. credential یا scope تازه از پیام مدل ساخته نمی‌شود.

پس از7196471، اعتبار والد تا مأموریت پس‌زمینه هم منتقل شد: همان session policy پیش از خواندن خصوصی/شروع، مصرف allowance و پذیرش نتیجه دوباره بررسی می‌شود. مجوزی که هنگام HTTP معتبر بوده، اختیار دائمی run نیست. revoke پیش از dispatch هیچ درخواست مدل نمی‌سازد؛ revoke هنگام پاسخ، نتیجه دیررس را رد می‌کند و مصرف آغازشده را نگه می‌دارد. درخواست درحال پرواز لزوماً در لحظه logout قطع نمی‌شود؛ نتیجهٔ آن اختیار ادامه یا ارسال بعدی نمی‌سازد. قالب tokenv1 و ActionSpecهای تاریخی تغییر نکرده‌اند.

برای HTTP، نبود Origin از native client مجاز است؛ Origin حاضر، sec-fetch-site و Host با policy وب بررسی می‌شوند. صرف loopback دسترسی نمی‌سازد. body سقف16KiB دارد و SDK مذاکره نسخه، شناسه درخواست و framing JSON/SSE را انجام می‌دهد. لغو/قطع protocol با rollback یا لغو مأموریت برابر نیست؛ لغو مأموریت ابزار صریح و CAS همان run دارد. پیشرفت این برش با cursor رویداد پایدار خوانده می‌شود؛ notifications/tasks/elicitation به‌عنوان قابلیت آزموده ادعا نمی‌شوند.

این facade ابزار approve/execute و دریافت secret ندارد. کاربر تصمیم زیرساختی را در review URL همان انتشار می‌بیند؛ متن یا نتیجه میزبان نمی‌تواند approval جعل کند. این انتخاب برای برش نخست است؛ plan چندمرحله‌ای و تصمیم انسانی قابل‌اعتماد از میزبان، قرارداد و آزمون بعدی می‌خواهند. دسترسی خواندن نمی‌تواند publication، job یا تصمیم بسازد؛ دسترسی مأموریت نیز هزینه و authority تازه نمی‌سازد.

شاهد: domain310/310 با هم‌زمانی۲، HTTP36/36 پیش از افزوده‌شدن assertion نسخه و body، سپس MCP8/8 با آن assertionها، build و typecheck موفق. Codex واقعی0.163.0-alpha.11 از app-server در session موقت، discovery و سه tool call واقعی، رد scope و application مشترک را گذراند؛ هیچ turn/model اجرا نشد. این شاهد مستقل از اتصال اجرایی Launchlane→Codex است. CLIهای Claude Code و OpenCode در PATH و مسیرهای معمول بررسی‌شده یافت نشدند؛ اتصال زنده آن‌ها UNCONFIRMED است.

منابع: [SDK رسمی](https://github.com/modelcontextprotocol/typescript-sdk)، [transport](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)، [MCP در Codex](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)، [app-server](https://learn.chatgpt.com/docs/app-server)، [Claude Code](https://code.claude.com/docs/en/mcp) و [OpenCode](https://opencode.ai/docs/mcp-servers/). محدودیت آزمون میزبان‌ها در راهنمای MCP حفظ می‌شود.

<a id="0022-project-library-and-private-environment-import"></a>

## ADR0022 — Project library and private environment import

Status: implemented; candidate verification is recorded in the linked evidence.


<a id="0022-project-library-and-private-environment-import-decision"></a>

### Decision

Keep the two primary views. Add a small authenticated **پروژه‌های من** entry in the existing header, opening a modal library of persisted source snapshots and their latest publication mission. Listing, refreshing and opening never start a model, worker or cloud write. Twenty snapshots are returned per page, scoped to the actor. A recorded completed mission is historical evidence, not a fresh health assertion.

Opening another snapshot checks its current source bytes and immutable archive before changing the active pointer. In one SQLite transaction, the server checks execution ownership and unknown effects, validates any restored target against the connected account/team/app ID, cancels unused decisions, revokes program authorities, preserves history and switches the active source/target. Opening the already active snapshot is idempotent. Publication remains sequential by the owner's explicit preference; this does not claim independent concurrent mission contexts.

Environment configuration is separate from the source archive. The authenticated browser folder import includes known root environment files in distinct multipart fields. They are never written to the source workspace. An explicitly selected operator-local folder uses the existing canonical-path, symlink, opened-file identity and bounded-read checks. Inspection itself remains script-free; direct `inspectProject` still excludes private files.

Supported UTF-8 file overlays, in ascending priority, are `.env`, `.env.production`, `.env.local`, `.env.production.local`. Invalid UTF-8 fails instead of silently changing a password. Each file is limited to32KiB; merged values use existing128-key/4096-byte-per-value validation. Parsing uses installed Node24's literal `util.parseEnv`; no expansion, shell or project script runs. Nonstandard framework-specific file naming/expansion and ambiguous nested roots require further implementation.

Store merged values in the existing private `environment_inputs` vault using a distinct `source-v1` ciphertext format, separate encryption-key domain and authenticated binding to actor, flow ID and source hash. Snapshot activation and encrypted-input insertion share the `saveProjectFlow` transaction. Failed storage rolls back activation and removes an uncommitted uploaded snapshot. No new migration is required; historical ActionSpec/ciphertext bindings are unchanged. Inputs are usable for30days; retained encrypted values remain available to redaction after expiry.

Only names are returned to the browser/model-facing review. Importing does not grant a provider write. Required application keys pass through the existing v9 proposal, explicit decision, merge-preserving preflight, single claim, uncertain-write journal and configuration readback. The same verified environment reference then binds builds and publication. Existing target keys are preserved. The server reopens the source-bound input for submission; the browser never downloads stored values or copies them into hidden fields.

Execution-controlled keys such as `PORT` are excluded. Localhost addresses, unresolved `${…}`/`$(…)` references and unclassified short values are held for review rather than copied into production. `NEXT_PUBLIC_` keys still require explicit public classification. Database readiness and real application connectivity are separate obligations; importing a connection string does not prove either. A provider-configuration receipt does not prove a healthy release.


<a id="0022-project-library-and-private-environment-import-trade-offs-and-limits"></a>

### Trade-offs and limits

- Reusing the private vault avoids a second secret store. Its two input kinds must stay distinguished by authenticated binding and ciphertext version; importing a secret is not an approved environment action.
- A source snapshot is not a continuous device sync. New local changes need a fresh upload; existing deployed apps are not deleted when switching projects.
- GitHub archives continue excluding private environment files. A separate GitHub configuration/resource path remains necessary; this slice does not fetch secrets from arbitrary repository files.
- A local development database URL cannot be transformed into a valid hosted database without provisioning, access and a verified application connection. That capability remains in A05/A08, not silently inferred from this import.
- No all-runtime, live environment, fresh-reader or public multi-user hosting acceptance is implied.

Evidence: [project library and environment import](../evidence/interface.md#project-library-and-environment-import).

<a id="0024-liara-identity-login"></a>

## ADR0024 — ورود بازدیدکننده با هویت لیارا

تاریخ: ۲۰۲۶-۱۰-۲۳. وضعیت: implementation؛ پذیرش زندهٔ ورود و میزبانی عمومی باز است.


<a id="0024-liara-identity-login-مسئله-و-تصمیم"></a>

### مسئله و تصمیم

ورود اپراتور محلی برای کاربر سایت مناسب نیست. تغییر نام همان کلید، هویت چند کاربر را از هم جدا نمی‌کند. حالت صریح `LAUNCHLANE_AUTH_MODE=liara` به مسیر وب اضافه می‌شود؛ حالت `operator` پیش‌فرضِ سازگار با نصب خصوصی و آزمون‌های قبلی می‌ماند. origin عمومی فقط HTTPS و یک میزبان ثابت است. کلید امضای نشست همچنان تنظیم سرور است؛ کاربر آن را نمی‌بیند و وارد نمی‌کند.

منبع قرارداد، کد رسمی CLI لیارا است: [account/add.ts](https://github.com/liara-cloud/cli/blob/master/src/commands/account/add.ts)، [base.ts](https://github.com/liara-cloud/cli/blob/master/src/base.ts) و [team-command.ts](https://github.com/liara-cloud/cli/blob/master/src/team-command.ts)، بررسی در تاریخ بالا. ورود مرورگری CLI یک callback لوکال دارد؛ این بررسی، OAuth عمومیِ شخص ثالث با redirect دلخواه را اثبات نمی‌کند. مسیر انتخاب‌شده همان تعویض ایمیل/رمز CLI است، با `POST /v1/login/check-if-exists`، در صورت نیاز TOTP و سپس `POST /v1/login?expiresIn=1y`، بدون retry خودکار. هیچ کد CLI کپی یا dependency تازه‌ای اضافه نشده است. قرارداد upstream باید در تغییرات بعدی دوباره بررسی شود.

رمز و TOTP فقط برای همان درخواست استفاده می‌شوند؛ هیچ‌کدام در DB، مدل، journal، log یا source ذخیره نمی‌شوند. پاسخ خام upstream هم وارد خطای عمومی نمی‌شود. کلید `api_token` برگشتی پس از `/v1/me` معتبر، با AES-GCM موجود و AAD همان actor/provider ذخیره می‌شود. درخواست ورود بدنهٔ محدود، deadline و محدودیت پایدار درخواست کلی و هش ایمیل دارد. نشست یک‌ساعتهٔ موجود، HMAC، DB revocation، Origin/Host و CSRF حفظ می‌شوند؛ cookie روی HTTPS دارای Secure و همواره HttpOnly/SameSite=Strict است. این مسیر رضایت مالی یا مجوز انتشار ایجاد نمی‌کند. در حالت عمومی endpoint قدیمی کلید اپراتور و تعویض حساب با API key رد می‌شوند.

actor از هویت تأییدشدهٔ `/me` با namespace نسخه‌دار ساخته می‌شود، نه ایمیل ارسالی یا مقدار توکن. ورود مجدد با همان حساب به همان پروژه‌ها برمی‌گردد؛ اتصال حساب دیگر هویت تازه دارد. سابقهٔ اپراتور محلی خودکار به یک هویت تازه منتقل نمی‌شود؛ نشست‌های قدیمی با همان secret معتبر می‌مانند. login مجددِ همان actor، تیم/مقصد run جاری را تغییر نمی‌دهد؛ اجرای عملیات همچنان readback و اختیار مربوط به خود را لازم دارد.


<a id="0024-liara-identity-login-محدوده-حساب-و-موتور-مشترک"></a>

### محدودهٔ حساب و موتور مشترک

در حالت liara، config نصب، توکن ابری اپراتور، تیم، allowlist برنامه، probe مقصد، root فایل‌های میزبان و مسیر CLI اپراتور را به کاربر ارث نمی‌دهد. `actorConfig` در مرز authenticated وب و MCP، تیم را از connection همان actor تعیین می‌کند. provider token فقط در application متصل موجود باز می‌شود؛ طبقهٔ policy، approval، artifact، journal و budget عوض نمی‌شود. `cli_system` گیت‌هاب و اجرای حساب Codex سرور برای کاربر عمومی رد می‌شوند؛ اتصال خصوصی per-actor گیت‌هاب قرارداد قبلی را دارد. اصلاح عمومی، هم هنگام ساخت job و هم اجرای job ذخیره‌شده، container می‌خواهد؛ Node permission مستقیم میزبان جای sandbox عمومی نیست.

`/me` واقعی بدون `teamID`، user/plans برگرداند و team نداشت. بنابراین تیم پیش‌فرض اختراع نمی‌شود. تیم‌های واقعی با pagination محدود `GET /v2/teams?page=…&count=100` خوانده می‌شوند. کاربر داخل Launchlane انتخاب می‌کند؛ سرور membership و `/me?teamID` و apps همان تیم را پیش از ذخیره بررسی می‌کند. تغییر تیم، مجوزهای وابسته را طبق سرویس اتصال موجود نامعتبر می‌کند. حساب شخصیِ بدون تیم فعلاً blocked است؛ team ساختگی، تبدیل user ID به team ID یا انتقال بی‌اجازه به تیم مالک نصب مجاز نیست. ساخت تیم و پشتیبانی scope شخصی زیرکار بعدی A05 هستند.


<a id="0024-liara-identity-login-مرز-پذیرش-و-راهاندازی"></a>

### مرز پذیرش و راه‌اندازی

میزبانی عمومی هنوز با اضافه‌شدن این حالت کامل نمی‌شود. یک process باید مالک SQLite باشد؛ disk پایدار، secret ثابت، HTTPS، Host معتبر در reverse proxy، محدودیت حجم/نرخ لبه و sandbox مجاز باید در مقصد واقعی بررسی شوند. Docker socket عمومی یا mount گسترده پیشنهاد این تصمیم نیست. `start:hosted` صرفاً bind شبکه را فراهم می‌کند، شاهد امنیت یا آماده‌بودن مقصد نیست. گیت‌های انتشار/مدل پیش‌فرض خاموش‌اند و فقط با پیکربندی و اختیار معتبر باز می‌شوند. مصرف کل مدل و فضای ذخیرهٔ چندکاربره همچنان پذیرش مستقل A19 لازم دارند.

شاهد مستقل در [ورود لیارا](../evidence/access.md#liara-identity-login) نگهداری می‌شود. آزمون با transport کنترل‌شده، live password login یا پذیرش تمام runtimeها نامیده نمی‌شود. migration تازه لازم نبود: جداول sessions/account_connections/login_limits فعلی actor و bucket را از قبل نگه می‌دارند؛ هیچ migration یا canonicalization تاریخی بازنویسی نشده است.
