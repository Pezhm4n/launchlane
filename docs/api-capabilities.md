# قرارداد و وضعیت API لیارا

مسیر مرحله‌ای جدید از همان API محلی Agent استفاده می‌کند: POST /api/agent/runs با operation=publish، requestKey و publication {projectId,sourceHash,path,expectedText}. host context، ابزار و approval را مالک است. GET همان مسیر با project و kind=publication|conversation فقط replay scoped است؛ operation=question فقط read tools دارد. این‌ها endpoint لیارا نیستند. canonicalizationهای ActionSpec تاریخی و transport cloud تغییر نکرده‌اند. worker container محدود Node22 به معنی install/build عمومی یا env write نیست.

## توسعه Agent؛ وضعیت جاری و قراردادهای باز

برنامه Agent در [agent-experience](agent-experience.md) و A00–A19 تعریف شده است. ساخت Node app با شبکه موجود و ادامه به انتشار همان artifact اکنون ابزار محصول است و چرخه واقعی وب دارد؛ env runtime فرم/قرارداد و transport مصنوعی دارد ولی پذیرش زنده باز است؛ ساخت شبکه و resize هنوز بازند. وضعیت documented با implementation و شاهد زنده یکی نیست.

| قابلیت آینده | منبع قرارداد و نیاز تطبیق | وضعیت این طرح |
| --- | --- | --- |
| catalog و انتخاب plan/هزینه | اطلاعات واقعی حساب/تیم و منبع رسمی قیمت؛ unit و دوره صورتحساب | catalog و quote implemented/live-read؛ snapshot/واحد/زمان/جایگزین و credit یک ساعت پایه؛ approval ساخت همان quote را می‌بندد؛ ظرفیت benchmark نشده و resize باز |
| create app و تغییر plan | [PaaS](https://developers.liara.ir/pages/paas.md)، پاسخ واقعی حساب و ID پایدار | create محدود Node با v8/journal/هویت برگشتی و وب واقعی سنجیده شد؛ تغییر plan planned |
| update env | [Update envs](https://developers.liara.ir/pass/settings/update-envs.md) و CLI رسمی14ec35f؛ read فعلی، merged variables و احتمال restart | runtime Node با v9/migration10/reference رمز‌شده، claim/journal و readback exact قراردادی؛ پذیرش زنده، env ساخت محلی و CAS بیرونی باز؛ [ADR0013](decisions/0013-project-environment.md) |
| database/disk و اتصال امن | [DBaaS](https://developers.liara.ir/pages/dbaas.md) و PaaS disks؛ capability مورد استفاده با حساب بررسی شود | planned؛ credential تولیدشده از context مدل جدا |
| domain/HTTPS | [PaaS](https://developers.liara.ir/pages/paas.md) و [DNS](https://developers.liara.ir/pages/dns.md)، مالکیت و نتیجه واقعی | راهنمای محلی موجود؛ عملیات جدید planned |
| preview/rollback | ترکیب app/release/artifact/config قابل دسترس؛ feature آماده upstream فرض نشود | planned؛ AC29/30 و سنجش مستقل |

registry ابزار Agent، قرارداد داخلی host است؛ مدل path/host دلخواه Liara تولید نمی‌کند. عملیات واقعی از adapter معتبر با schema و scope عبور می‌کنند. وب‌اپ و MCP، application و policy یکسان را مصرف می‌کنند.

transport تشخیص تاریخی، ابزار تک‌منظوره evidence را حفظ می‌کند. runtime جدید Agent، registry چندابزاری و tool-result مطابق call ID دارد و با مدل واقعی منتخب در یک مسیر read و اصلاح محدود Node آزموده شده است؛ [گزارش Agent](evidence/agent-first-slice.md) حدود آن را ثبت می‌کند. parser و سقف feature قدیمی باز نشده‌اند. replay UI یا reconnect مدل را دوباره فراخوانی نمی‌کند. فرمان smoke فعلی همان آزمون محدود است؛ `test:browser` اکنون runner مجزای Agent با مدل مصنوعی و آزمون واقعی Node نیز دارد.

WorkloadContract v7، HTML/متن و فیلد scalar در API را با همان receipt و artifact/account/release بررسی می‌کند. JSON/revision مسیرهای تاریخی حفظ شده‌اند؛ پروژه عادی به endpoint مصنوعی مجبور نیست. command، env key یا endpoint بدون implementation، فرمان جاری محسوب نمی‌شود.

برش محلی T33، انتخاب کندی را به سه GET متوالی از همان origin/path مجاز متصل می‌کند؛ با دو کنترل هویت app و سایر خواندن‌ها، سقف لازم ده فراخوانی است. `https-get-body-v1` مدت اتصال تا پایان پاسخ کوتاه حداکثر 4096 بایت را با میلی‌ثانیه ثبت می‌کند؛ DNS و بارگذاری کامل صفحه در آن نیستند. مقایسه فقط برای سری کامل، مرتب، تازه، هم‌روش و همان حساب/app داخلی و fingerprint متن پاسخ **پس از redaction** انجام می‌شود. این fingerprint برابری همه محتوای اصلی یا محتوای محرمانه را اثبات نمی‌کند. تغییر پاسخ یا سری ناقص نتیجه نامشخص دارد؛ عدم هم‌پوشانی بازه فقط کمتر/بیشتربودن همین نمونه‌هاست، نه علت، ظرفیت، p95 یا رفع پایدار. parser واحد CPU/RAM همچنان unknown است؛ T33 زنده و AC10 کامل پذیرفته نشده‌اند. timeout با زمان صفر جایگزین و write یا retry ایجاد نمی‌شود.

آخرین تطبیق محدود در ۲۰۲۶-۱۰-۲۲ انجام شد. هویت/تیم، برنامه Node آزمایشی، upload، release/current و پاسخ همان workload با API واقعی بررسی شدند؛ [trace کنترل‌شده](evidence/controlled-live-cycle.md) جزئیات و محدودیت‌ها را ثبت می‌کند. `documented`، `implemented_contract` و `live_verified` وضعیت‌های متفاوت‌اند.

انتشار Agent با پیشنهاد v7، برنامه Node موجود یا تازه‌ساخته‌شده و approval مستقل انجام می‌شود؛ archive، شناسه داخلی مقصد، Node و oracle همان صفحه به تصمیم بسته‌اند. همان archive در multipart `file` ارسال و receipt پیش از release پایدار می‌شود. READY/current به‌تنهایی موفقیت نیست. مسیر دستی تاریخی v5 و شواهد v4/v5 در [آزمون restart](evidence/restart-live-cycle.md) محفوظ‌اند؛ [ساخت از وب](evidence/destination-provisioning.md) و [آماده‌سازی تا انتشار](evidence/project-preparation.md) شاهد نسخه جدیدند. network creation در محصول پیاده نیست.

انتخاب Node بر پایه [مستند رسمی](https://docs.liara.ir/paas/nodejs/how-tos/choose-version/) و CLI نصب‌شده 9.4.7 است: `node.version` در liara.json به `platformConfig.version` در release می‌رسد. catalog مستند شاخه‌های 8/10/12/14/16/18/20/22/24 و پیش‌فرض 22 را دارد؛ availability حساب برای همه آن‌ها سنجیده نشده است. محدوده semver کامل بررسی می‌شود؛ انتخاب major، نسخه دقیق patch محیط را اثبات نمی‌کند. ارسال صریح نسخه 22 در یک release واقعی v5 سنجیده شد؛ endpoint نوشته‌شده با process.versions.node، runtime را 22.23.3 گزارش کرد. سایر majorها، patchها و پروژه‌ها live verified نیستند.

در زیرساخت آزموده‌شده، logs از قرارداد v2 در CLI رسمی 9.4.7 می‌آیند و events ردیف lifecycle دارند. applets پاسخ500 داد؛ واحد metric/event و حفظ secretهای نامعلوم تأیید نشده‌اند. نرخ پایه ساخت از catalog واقعی می‌آید؛ هزینه نهایی و جانبی unknown است. gateهای Liara/mutation/model در نصب پیش‌فرض خاموش‌اند و فعال‌سازی مجازِ یک نصب، approval را حذف نمی‌کند.

## منابع معتبر

- [Liara API و احراز هویت](https://docs.liara.ir/references/api/about/): PaaS روی `https://api.liara.ir`؛ header از نوع `Authorization: Bearer TOKEN`؛ در حالت تیم پارامتر `teamID` لازم است.
- [مستندات توسعه‌دهندگان](https://developers.liara.ir/) و [فهرست](https://developers.liara.ir/llms.txt).
- [OpenAPI PaaS](https://developers.liara.ir/spec/paas.yaml)، snapshot در [liara-paas.openapi.yaml](sources/liara-paas.openapi.yaml)، SHA-256: `a8b8ab24c0b2decf8a67a93a9fc935f93846a991f999d0c4ebb7478a6fc4d56d`، ۵۴۲۹۰ بایت. این فایل reference است و runtime config محسوب نمی‌شود.

بازبینی تازه ۲۰۲۶-۱۰-۲۲ با فهرست رسمی و دانلود مجدد OpenAPI انجام شد؛ ۵۴۲۹۰ بایت و SHA-256 فعلی با snapshot بالا دقیقاً برابر بودند. endpoint تازه‌ای از توصیه CLI حدس زده نشد. CLI برای تطبیق قرارداد مفید است؛ اجرای آن جای application، approval و journal محصول را نمی‌گیرد. پورت6067 در release واقعی این برش با پاسخ200 همان workload سنجیده شد.
- [CLI رسمی](https://github.com/liara-cloud/cli) در صورت نیاز fallback؛ ساختار command در نسخه نصب‌شده با help بررسی شود. کلون تحقیقی آن خواندن جامع همه کد یا تست آن محسوب نمی‌شود.

## endpointهای مستند مرتبط

تمام مسیرهای جدول، **upstream Liara** هستند، نه API داخلی Launchlane. جدول، قرارداد مستند را از تطبیق محدود حساب واقعی جدا می‌کند؛ یک پاسخ معتبر، تأیید همه برنامه‌ها یا سلامت سایت نیست.

| Capability | روش و مسیر مستند | جزئیات مهم | وضعیت |
| --- | --- | --- | --- |
| فهرست و جزئیات app | `GET /v1/projects`، `GET /v1/projects/{name}` | app در scope کاربر؛ response validate شود | live_verified محدود به تیم و Node app آزمون |
| ساخت app | `POST /v1/projects` | schema مستند با bundle/هویت برگشتی واقعی تکمیل و در v8 بسته شده است؛ نبود required کامل در schema مجوز حدس نیست | bounded_live_verified / approval required؛ فقط Node/شبکه موجود |
| source upload | `POST /v2/projects/{name}/sources` | multipart، field `file`؛ نتیجه source filename با پسوند `.tar.gz`؛ manifest/hash و exclude secrets پیش از upload | live_verified محدود؛ approval required |
| release | `POST /v2/projects/{name}/releases` | body schema شامل `sourceID,port,type`؛ نتیجه `releaseID`؛ accepted پایان deploy نیست | live_verified پذیرش محدود؛ approval required |
| تاریخچه release | `GET /v1/projects/{name}/releases` | `page/count`، currentRelease و BUILDING/READY روی app آزمون تطبیق داده شدند | live_verified محدود |
| وضعیت applets | `GET /v1/projects/{name}/applets` | در app آزمون زیرساخت جدید، 500؛ سلامت استنتاج نمی‌شود | live_checked unavailable |
| restart | `POST /v1/projects/{name}/actions/restart` | HTTP 200 فقط پذیرش، بدون operation ID؛ journal مستقل v6، یک POST و readback همان app/release/page؛ پایان restart اثبات نمی‌شود | bounded_live acceptance + same-page 500 verified؛ completion unverified / approval required |
| resize | `POST /v1/projects/{name}/resize` | body `planID`؛ هزینه و برگشت‌پذیری فرض نشود | documented / approval required |
| env update | `POST /v1/projects/update-envs` | schema `project,variables:[{key,value}]`؛ merge/replace و اثر restart باید بررسی شود؛ مقادیر محرمانه log نشوند | documented / approval required |
| logs | `GET /v2/projects/{name}/logs`؛ قرارداد CLI 9.4.7 | start از تاریخ معتبر به Unix seconds؛ tuple نانوثانیه/JSON type و _entry؛ سقف 200 خط/20 گروه؛ v1 ISO since رد شد | live_verified محدود؛ v1 pure documentary parser محفوظ |
| events | `GET /v1/projects/{name}/events` | lifecycle action/status/time/release و شکل مستند metaData/values محدود parse می‌شوند؛ زمان خام unverified | live_verified shape محدود |
| summary | `GET /v1/projects/{name}/metrics/summary` | raw cpuUsage/memoryUsage در حساب دیده و parse شد؛ واحد و زمان هنوز unverified | live_checked؛ معنا unknown |
| CPU / RAM | `GET /v1/projects/{name}/metrics/cpu` و `/metrics/memory` | `since` عددی required؛ نبود دسترسی/نمونه، unknown است | documented / live unverified |
| دامنه | `GET /v1/domains`، `POST /v1/domains/set-project` | اتصال domain/project در schema با شناسه است؛ registrar و DNS provider جداست. راهنمای محلی `POST /api/domains/guide` فقط نام و مقصد ذخیره‌شده را اعتبارسنجی می‌کند؛ مقادیر رکورد یا وضعیت DNS نمی‌سازد | implemented local guide contract؛ API/DNS live unverified |
| هویت و catalog حساب | `GET /v1/me`؛ در حالت تیم با `teamID` | هویت/تیم و شکل planها تطبیق داده شدند؛ اطلاعات شخصی/کلیدهای پاسخ از parser عبور نمی‌کنند؛ catalog قیمت هنوز در پیشنهاد محصول مصرف نمی‌شود | live_verified محدود؛ قیمت محصول unknown |

نمونه غیررسمی ممکن است route، default base، rollback یا required field متفاوتی داشته باشد. تطبیق مستقیم با OpenAPI/CLI و پاسخ واقعی ضروری است. قابلیت rollback عمومی و idempotency write هنوز تأیید نشده‌اند و در scope پایه promise نمی‌شوند.

## گام اول پس از دریافت دسترسی

1. API token/team را از اتصال رمز‌شده یا env محلی ignored و app مجاز را از حساب متصل مشخص کنیم؛ budget خواندن محدود باشد. برای T20 به مدل نیازی نیست و gateهای mutation/model خاموش می‌مانند. password ورود حساب جای API token نیست.
2. یک read scope کوچک: account/team → app انتخابی → details/release/logs/metrics؛ response خام sanitized با timestamp و نسخه ذخیره شود.
3. شکل دقیق null/empty/error، pagination، timestamp و unit بررسی و fixture synthetic با contract واقعی تطبیق داده شود. secret/user data لازم نیست در repo ثبت شود.
4. T24 مستقل است و فقط با مجوز جداگانه مصرف مدل اجرا می‌شود: compatibility tool call با schema، خروجی structured و terminal/error؛ streaming فقط اگر استفاده می‌شود. نبود مدل مانع T20 نیست.
5. پس از پذیرش policy/session/storage/approval و تأیید کاربر، اولین write کوچک روی app مجاز اجرا و readback ثبت شود.

اختلال access، کار مستقل offline را متوقف نمی‌کند. capability unavailable باید reason و next step بدهد؛ UI نباید metric، موفقیت یا هزینه تولید کند. `.env.example` با `src/server/config.ts` هماهنگ است؛ gateهای mutation/model/Liara، scope، session، workspace و سقف‌ها مصرف و اعتبارسنجی می‌شوند.

## قرارداد خواندن و حفاظت اجرا

- مسیر ماندگار `/api/incidents/runs` شناسه داخلی app انتخاب‌شده را پیش و پس از جمع‌آوری با project تازه تطبیق می‌دهد. app هم‌نام با شناسه تازه پذیرفته نمی‌شود؛ خواندن اولیه project برای شاهد نام envها استفاده و خواندن نهایی جدا در budget حساب می‌شود. حالت کامل 8 tool call دارد. این fence اتمیک نیست و نسبت‌دادن هر log به یک release مشخص همچنان تأیید نشده است.
- پنجره خودکار تا deadline همان run امتداد دارد و در پایان به زمان واقعی snapshot محدود می‌شود؛ پنجره تاریخی صریح حفظ می‌شود. `collectedAt` زمان پایان جمع‌آوری است. انتظار header/body در read client و validation حساب با abort/deadline پایان می‌یابد؛ پاسخ دیررس یا لغو، نتیجه موفق یا اتصال ذخیره‌شده تولید نمی‌کند. توقف پردازش واقعی upstream از پایان انتظار client استنتاج نمی‌شود.

- `LiaraReadClient.releases`: فقط GET به میزبان ثابت PaaS؛ teamID و app allowlist در server، صفحه ۱–۱۰۰۰ و count ۱–۵۰؛ پاسخ محدود و validate شده. فقط UND_ERR_CONNECT_TIMEOUT یک retry شمارش‌شده با همان deadline دارد؛ 401/403، 429 و 5xx به failure مجزا تبدیل می‌شوند و empty تلقی نمی‌شوند. route خصوصی `/api/incidents/runs` از اتصال رمز‌شده و app انتخابی استفاده می‌کند؛ gate واقعی Liara مستقل و پیش‌فرض خاموش است.
- `project/logs/events/applets/metrics`: همان مرز scope، host، حجم، cancel/deadline و redaction را دارند. gate `LAUNCHLANE_ENABLE_LIVE_LIARA=false` پیش از budget و transport همه readها را می‌بندد. جزئیات پروژه فقط نام envها را برمی‌گرداند؛ value/encrypted/node IP/قیمت بدون واحد حذف می‌شوند. زمان commit، زمان deploy نیست؛ state applet نیز readiness workload را اثبات نمی‌کند.
- `LiaraReadClient.logs` فقط v2 را با تاریخ ISO معتبرِ ورودی و start عددیِ Unix seconds می‌خواند. parser، tuple نانوثانیه و wrapper JSON دارای type/_entry را با سقف گروه/خط/حجم validate و redaction می‌کند؛ انتخاب protocol یا endpoint از داده مدل ممکن نیست. parser مستند v1 مستقل باقی است و واحد زمان عددی آن حدس زده نمی‌شود؛ fallback شبکه اضافه نشده است.
- `WorkloadProbe`: فقط origin HTTPS مجاز همان app در تنظیم نصب یا انتخاب صریح حساب‌ها و مسیر بدون query؛ gate قبل از DNS، رد تمام پاسخ‌های DNS خصوصی/خاص، pin همان IP در lookup اتصال HTTPS با حفظ بررسی گواهی hostname، بدون redirect/retry، حداکثر15s و تقدم deadline کوتاه‌تر run، پیش‌فرض4KiB و سقف64KiB در ابزار Agent، بدون credential header. allowlist محافظه‌کار IP بر مبنای [رجیستری IPv4](https://www.iana.org/assignments/iana-ipv4-special-registry) و [IPv6](https://www.iana.org/assignments/iana-ipv6-special-registry) است؛ برخی استثناهای عمومی نیز عمداً رد می‌شوند. سیاست با [راهنمای SSRF](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) مقایسه شد. DNS/socket در suite خودکار تزریقی‌اند؛ TLS و workload همان app آزمایشی در چرخه زنده نیز بررسی شدند. durationMs مدت دریافت پاسخ محدود با هزینه TLS و بدون زمان DNS است؛ زمان کامل بارگذاری صفحه یا SLA کارایی محسوب نمی‌شود.
- registry مشترک application، `read_workload` برای path مجاز، `read_metrics` با واحد/زمان unknown و `read_logs` با پنجره1–60 دقیقه از شروع goal و omission صریح دارد. ID مقصد پیش/پس از داده و context پس از خواندن کنترل می‌شوند؛ خطای آرگومان پیش از provider به call ID همان ابزار برمی‌گردد. این‌ها ابزارهای حلقه Agent هستند؛ facade MCP هنوز پیاده نشده است. جزئیات real/synthetic در [گزارش تحقیق](evidence/agent-investigation.md).
- `parseMetricSummary`: با شکل pinned schema کار می‌کند؛ missing/null/empty همگی unknown، raw tuple به درصد/بایت/ثانیه تعبیر نمی‌شود. field و unit واقعی نیاز به T20 دارند.
- Source archive: محلی `tar.gz` از snapshot محدود ساخته و hash خود archive در ActionSpec ذخیره می‌شود؛ canonicalization نسخه‌های v1/v2/v3/v4 محفوظ و اجرای تازه محدود به v5 است. OpenAPI فقط `.gz` را برای multipart مستند می‌کند؛ فایل‌های `src/utils/create-archive.ts` و `src/services/tmp-dir.ts` در [CLI رسمی](https://github.com/liara-cloud/cli) مبنای انتخاب tar.gz بودند. adapter همان buffer تأییدشده را ارسال می‌کند. پذیرش این بسته و سه release واقعی v4 تطبیق داده شدند؛ حفظ secretها و انواع دیگر env همچنان unverified است.
- `BoxApiClient`: فقط `https://ai.boxapi.ir/ai/v1/chat/completions`، non-streaming، Bearer و بدون redirect/fallback. `LAUNCHLANE_ENABLE_LIVE_MODEL=false` پیش از transport و مصرف budget توقف می‌دهد. call/result ID، ابزار محدود read-only، app scope، terminal/truncation، خطا، cancellation و سقف حجم fixture-tested هستند. adapter با اقدام جداگانه analyze به گزارش همان run متصل است؛ claim پایدار پیش از هزینه و عدم replay پس از قطع/خطا enforce می‌شوند. یک diagnosis واقعی پیکربندی با oracle مستقل سنجیده شد؛ کیفیت عمومی و failureهای معنایی دیگر هنوز تأیید نشده‌اند.
- مبنای endpoint/auth، [مستند رسمی BoxAPI](https://boxapi.ir/docs/ai/) است. شکل `tool_calls` و `tool_call_id` از [قرارداد Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create) گرفته شده است. در T24، tool/result/terminal و `max_completion_tokens` با `gpt-6-luna` و `reasoning_effort=none` واقعاً کار کردند؛ بدون reasoning صریح، سرویس 400 داد. سایر مدل‌ها و semantics خطا/usage عمومی هنوز تأیید نشده‌اند. هیچ کلیدی به OpenAI ارسال نمی‌شود و SDK OpenAI نصب نشده است.
- fixtureها در `tests/domain/providers.test.ts` صریحاً synthetic هستند. `gpt-6-luna/none` انتخاب اولیه با یک diagnosis زنده محدود است؛ مقایسه مدل‌ها و سناریوهای دیگر به oracle مستقل و budget جدا نیاز دارند. streaming پیاده نشده است.

مسیر مدل فعلی، Chat Completions روی BoxAPI است؛ Responses یا provider دیگر fallback خودکار نیستند. فهرست مدل، سهم مصرف و واحد هزینه از حساب واقعی بررسی شوند؛ نرخ عمومی، هزینه قطعی این نصب را ثابت نمی‌کند. بودجه و مجوز هر اجرای واقعی در تنظیمات/رکورد محلی همان اجرا نگهداری می‌شوند.


## Catalog حساب پیش از انتخاب app

ابزارهای Agent `read_catalog` و `quote_resource_plan` از `LiaraAccountClient` و همان RunBudget پایدار استفاده می‌کنند. GET ثابت `/v1/me?teamID`، هویت حساب/تیم را validate می‌کند؛ مقادیر حساس profile/credential حذف می‌شوند. app انتخاب‌شده برای quote لازم نیست و تعویض حساب در حین read، context را باطل می‌کند. مجموع resource/bundle، صحیحِ صدم تومان و نرخ پایه تومان/ساعت است؛ هزینه جانبی و ظرفیت اندازه‌گیری‌شده از آن ساخته نمی‌شود. quote از زمان مشاهده ده دقیقه معتبر است. فقدان قیمت یا availability، پیشنهاد هزینه اجرایی نمی‌سازد. [شاهد catalog](evidence/agent-catalog.md) وضعیت واقعی و مصنوعی و gapهای AC20 را ثبت می‌کند. این ابزارها create، resize یا env write ندارند.


## ساخت مقصد محدود؛ ActionSpec v8

`POST /v1/projects?teamID` با name/planID/bundlePlanID/platform=node/network/readOnlyRootFilesystem به ID داخلی `projectID` پاسخ می‌دهد؛ این field با حساب واقعی تطبیق داده شد. application ساخت، actor/account/source/cost/network را پیش از claim بازبینی و ID را قبل از readback ذخیره می‌کند. GET همان نام باید همان ID و تنظیمات را برگرداند. نام موجود adopt نمی‌شود و پاسخ write نامعلوم، retry یا انتخاب بر اساس نام ایجاد نمی‌کند. حدود فعلی Node/پلن ایران/شبکه موجود، APIهای محلی و مرز real/synthetic در [شاهد مقصد](evidence/destination-provisioning.md) آمده‌اند؛ Agent/UI و ادامه به انتشار شاهد زنده دارند. env و network creation همچنان بازند.
