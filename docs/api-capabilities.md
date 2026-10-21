# قرارداد و وضعیت API لیارا

بررسی مستندات عمومی در ۲۰۲۶-۱۰-۲۱؛ **هیچ درخواست احرازشده به API لیارا در این آماده‌سازی اجرا نشده است**. `documented` با `live_verified` فرق دارد.

به‌روزرسانی قرارداد محلی ۲۰۲۶-۱۰-۲۲: `LiaraDeployClient` اکنون source multipart با `file` و release JSON با `sourceID/port/type` را، فقط در workflow تأییدشده v4، پیاده می‌کند. origin/workload و پلن موجود در پیشنهاد بسته‌اند؛ resize/env/create انجام نمی‌شوند. هر write یک attempt شبکه دارد و شکست پس از احتمال ارسال uncertain است. journal SQLite مرحله source را پیش از release نگه می‌دارد. `observeDeployment` فقط readback همان release/current/READY و status/JSON revision همان صفحه است؛ واحد قیمت یا سلامت از accepted ساخته نمی‌شود. این قرارداد با transport مصنوعی آزموده شده و **پذیرش واقعی حساب/API هنوز unverified است**. هر دو gate Liara/mutation در نصب پیش‌فرض خاموش می‌مانند؛ gate model مستقل است.

## منابع معتبر

- [Liara API و احراز هویت](https://docs.liara.ir/references/api/about/): PaaS روی `https://api.liara.ir`؛ header از نوع `Authorization: Bearer TOKEN`؛ در حالت تیم پارامتر `teamID` لازم است.
- [مستندات توسعه‌دهندگان](https://developers.liara.ir/) و [فهرست](https://developers.liara.ir/llms.txt).
- [OpenAPI PaaS](https://developers.liara.ir/spec/paas.yaml)، snapshot در [liara-paas.openapi.yaml](sources/liara-paas.openapi.yaml)، SHA-256: `a8b8ab24c0b2decf8a67a93a9fc935f93846a991f999d0c4ebb7478a6fc4d56d`، ۵۴۲۹۰ بایت. این فایل reference است و runtime config محسوب نمی‌شود.
- [CLI رسمی](https://github.com/liara-cloud/cli) در صورت نیاز fallback؛ ساختار command در نسخه نصب‌شده با help بررسی شود. کلون تحقیقی آن خواندن جامع همه کد یا تست آن محسوب نمی‌شود.

## endpointهای مستند مرتبط

تمام مسیرهای جدول، **upstream Liara** هستند، نه API داخلی Launchlane. transport محدود project/release/logs/events/applets/summary و probe پیاده شده‌اند؛ هیچ درخواست واقعی Liara اجرا نشده است و جدول همچنان وضعیت زنده را بیان می‌کند.

| Capability | روش و مسیر مستند | جزئیات مهم | وضعیت |
| --- | --- | --- | --- |
| فهرست و جزئیات app | `GET /v1/projects`، `GET /v1/projects/{name}` | app در scope کاربر؛ response validate شود | documented / live unverified |
| ساخت app | `POST /v1/projects` | schema شامل `name,planID,platform,readOnlyRootFilesystem,network` است؛ نبود required کامل در schema مجوز حدس نیست | documented / approval required |
| source upload | `POST /v2/projects/{name}/sources` | multipart، field `file` با فایل `.gz`؛ نتیجه `sourceID`؛ manifest/hash و exclude secrets پیش از upload | documented / approval required |
| release | `POST /v2/projects/{name}/releases` | body schema شامل `sourceID,port,type`؛ نتیجه `releaseID`؛ accepted پایان deploy نیست | documented / approval required |
| تاریخچه release | `GET /v1/projects/{name}/releases` | `page` و `count` در spec required و default 1/10 هستند | documented / live unverified |
| وضعیت applets | `GET /v1/projects/{name}/applets` | معنی readiness/status باید با response واقعی روشن شود | documented / live unverified |
| restart | `POST /v1/projects/{name}/actions/restart` | ممکن است درخواست async باشد؛ اثر با readback بررسی شود | documented / approval required |
| resize | `POST /v1/projects/{name}/resize` | body `planID`؛ هزینه و برگشت‌پذیری فرض نشود | documented / approval required |
| env update | `POST /v1/projects/update-envs` | schema `project,variables:[{key,value}]`؛ merge/replace و اثر restart باید بررسی شود؛ مقادیر محرمانه log نشوند | documented / approval required |
| logs | `GET /v1/projects/{name}/logs` | `since` رشته و required است؛ واحد/فرمت دقیق live بررسی شود | documented / live unverified |
| events | `GET /v1/projects/{name}/events` | search، start/end اختیاری؛ spec timestamp عددی نمونه دارد؛ واحد را تأیید کنیم | documented / live unverified |
| summary | `GET /v1/projects/{name}/metrics/summary` | cpuUsage/memoryUsage آرایه‌هایی با `value` mixed number/string و applet؛ unit/ساختار time نیازمند بررسی | documented / live unverified |
| CPU / RAM | `GET /v1/projects/{name}/metrics/cpu` و `/metrics/memory` | `since` عددی required؛ نبود دسترسی/نمونه، unknown است | documented / live unverified |
| دامنه | `GET /v1/domains`، `POST /v1/domains/set-project` | اتصال domain/project در schema با شناسه است؛ registrar و DNS provider جداست | documented / guide first |
| هویت و catalog حساب | `GET /v1/me`؛ در حالت تیم با `teamID` | مستند حساب شامل اطلاعات حساس و planهاست؛ adapter فقط هویت مجاز را استخراج می‌کند؛ shape دقیق تیم و معنا/واحد قیمت هنوز تأیید نشده‌اند | documented / contract tested / live unverified |

نمونه غیررسمی ممکن است route، default base، rollback یا required field متفاوتی داشته باشد. تطبیق مستقیم با OpenAPI/CLI و پاسخ واقعی ضروری است. قابلیت rollback عمومی و idempotency write هنوز تأیید نشده‌اند و در scope پایه promise نمی‌شوند.

## گام اول پس از دریافت دسترسی

1. API token/team را از اتصال رمز‌شده یا env محلی ignored و app مجاز را از حساب متصل مشخص کنیم؛ budget خواندن محدود باشد. برای T20 به مدل نیازی نیست و gateهای mutation/model خاموش می‌مانند. password ورود حساب جای API token نیست.
2. یک read scope کوچک: account/team → app انتخابی → details/release/logs/metrics؛ response خام sanitized با timestamp و نسخه ذخیره شود.
3. شکل دقیق null/empty/error، pagination، timestamp و unit بررسی و fixture synthetic با contract واقعی تطبیق داده شود. secret/user data لازم نیست در repo ثبت شود.
4. T24 مستقل است و فقط با مجوز جداگانه مصرف مدل اجرا می‌شود: compatibility tool call با schema، خروجی structured و terminal/error؛ streaming فقط اگر استفاده می‌شود. نبود مدل مانع T20 نیست.
5. پس از پذیرش policy/session/storage/approval و تأیید کاربر، اولین write کوچک روی app مجاز اجرا و readback ثبت شود.

اختلال access، کار مستقل offline را متوقف نمی‌کند. capability unavailable باید reason و next step بدهد؛ UI نباید metric، موفقیت یا هزینه تولید کند. `.env.example` با `src/server/config.ts` هماهنگ است؛ gateهای mutation/model/Liara، scope، session، workspace و سقف‌ها مصرف و اعتبارسنجی می‌شوند.

## قرارداد پیاده‌شده آفلاین

- مسیر ماندگار `/api/incidents/runs` شناسه داخلی app انتخاب‌شده را پیش و پس از جمع‌آوری با project تازه تطبیق می‌دهد. app هم‌نام با شناسه تازه پذیرفته نمی‌شود؛ خواندن اولیه project برای شاهد نام envها استفاده و خواندن نهایی جدا در budget حساب می‌شود. حالت کامل 8 tool call دارد. این fence اتمیک نیست و نسبت‌دادن هر log به یک release مشخص همچنان تأیید نشده است.
- پنجره خودکار تا deadline همان run امتداد دارد و در پایان به زمان واقعی snapshot محدود می‌شود؛ پنجره تاریخی صریح حفظ می‌شود. `collectedAt` زمان پایان جمع‌آوری است. انتظار header/body در read client و validation حساب با abort/deadline پایان می‌یابد؛ پاسخ دیررس یا لغو، نتیجه موفق یا اتصال ذخیره‌شده تولید نمی‌کند. توقف پردازش واقعی upstream از پایان انتظار client استنتاج نمی‌شود.

- `LiaraReadClient.releases`: فقط GET به میزبان ثابت PaaS؛ teamID و app allowlist در server، صفحه ۱–۱۰۰۰ و count ۱–۵۰؛ پاسخ محدود و validate شده. بدون retry پنهان؛ 401/403، 429 و 5xx به failure مجزا تبدیل می‌شوند و empty تلقی نمی‌شوند. route خصوصی `/api/incidents/runs` از اتصال رمز‌شده و app انتخابی استفاده می‌کند؛ gate واقعی Liara مستقل و پیش‌فرض خاموش است.
- `project/logs/events/applets/metrics`: همان مرز scope، host، حجم، cancel/deadline و redaction را دارند. gate `LAUNCHLANE_ENABLE_LIVE_LIARA=false` پیش از budget و transport همه readها را می‌بندد. جزئیات پروژه فقط نام envها را برمی‌گرداند؛ value/encrypted/node IP/قیمت بدون واحد حذف می‌شوند. زمان commit، زمان deploy نیست؛ state applet نیز readiness workload را اثبات نمی‌کند.
- logs بر اساس OpenAPI v1، آرایه `type/datetime/message` است؛ CLI رسمی بررسی‌شده از v2 با `data/values` استفاده می‌کند. adapter آن‌ها را با حدس به هم تبدیل نمی‌کند. زمان عددی و tupleهای event تا T20 واحد نامعلوم دارند؛ فقط ISO دارای timezone صریح قابل مقایسه است. `since` هنوز caller-supplied مستند است و فرمت آن در حساب تأیید نشده است.
- `WorkloadProbe`: فقط origin HTTPS مجاز همان app در تنظیم نصب یا انتخاب صریح حساب‌ها و مسیر بدون query؛ gate قبل از DNS، رد تمام پاسخ‌های DNS خصوصی/خاص، pin همان IP در lookup اتصال HTTPS با حفظ بررسی گواهی hostname، بدون redirect/retry، حداکثر 5s/4KiB و بدون credential header. allowlist محافظه‌کار IP بر مبنای [رجیستری IPv4](https://www.iana.org/assignments/iana-ipv4-special-registry) و [IPv6](https://www.iana.org/assignments/iana-ipv6-special-registry) است؛ برخی استثناهای عمومی نیز عمداً رد می‌شوند. سیاست با [راهنمای SSRF](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) مقایسه شد. DNS/socket در آزمون‌ها تزریقی و مصنوعی‌اند؛ TLS و workload واقعی Liara هنوز تأیید نشده‌اند. durationMs مدت دریافت پاسخ محدود است و زمان کامل بارگذاری صفحه محسوب نمی‌شود.
- `parseMetricSummary`: با شکل pinned schema کار می‌کند؛ missing/null/empty همگی unknown، raw tuple به درصد/بایت/ثانیه تعبیر نمی‌شود. field و unit واقعی نیاز به T20 دارند.
- Source archive: محلی `tar.gz` از snapshot محدود ساخته و hash خود archive در ActionSpec ذخیره می‌شود؛ canonicalization نسخه‌های v1/v2/v3 محفوظ و اجرای تازه محدود به v4 است. OpenAPI فقط `.gz` را برای multipart مستند می‌کند؛ فایل‌های `src/utils/create-archive.ts` و `src/services/tmp-dir.ts` در [CLI رسمی](https://github.com/liara-cloud/cli) مبنای انتخاب tar.gz بودند. adapter جدید همان buffer تأییدشده را ارسال می‌کند؛ ساخت/خواندن بسته و transport مصنوعی آزموده‌اند، اما پذیرش tar.gz و semantics حفظ env در release واقعی همچنان live unverified هستند.
- `BoxApiClient`: فقط `https://ai.boxapi.ir/ai/v1/chat/completions`، non-streaming، Bearer و بدون redirect/fallback. `LAUNCHLANE_ENABLE_LIVE_MODEL=false` پیش از transport و مصرف budget توقف می‌دهد. call/result ID، ابزار محدود read-only، app scope، terminal/truncation، خطا، cancellation و سقف حجم fixture-tested هستند. adapter با اقدام جداگانه analyze به گزارش همان run متصل است؛ claim پایدار پیش از هزینه و عدم replay پس از قطع/خطا enforce می‌شوند. کیفیت diagnosis واقعی هنوز سنجیده نشده است.
- مبنای endpoint/auth، [مستند رسمی BoxAPI](https://boxapi.ir/docs/ai/) است. شکل `tool_calls` و `tool_call_id` از [قرارداد Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create) گرفته شده است. در T24، tool/result/terminal و `max_completion_tokens` با `gpt-6-luna` و `reasoning_effort=none` واقعاً کار کردند؛ بدون reasoning صریح، سرویس 400 داد. سایر مدل‌ها و semantics خطا/usage عمومی هنوز تأیید نشده‌اند. هیچ کلیدی به OpenAI ارسال نمی‌شود و SDK OpenAI نصب نشده است.
- fixtureها در `tests/domain/providers.test.ts` صریحاً synthetic هستند. `gpt-6-luna/none` فقط انتخاب سازگاری اولیه است؛ مدل مناسب diagnosis باید با oracle مستقل ارزیابی شود. streaming پیاده نشده است.

خبر فعال‌شدن اعتبار، فهرست مدل‌ها و سقف ۳ دلار از مالک در ۲۰۲۶-۱۰-۲۱ آمد. [صفحه برنامه BoxAPI](https://boxapi.ir/starcoach) در fetch عمومی قابل خواندن نبود؛ فهرست اختصاصی از متن ارائه‌شده مالک است، نه مشاهده مستقل حساب. مسیر مجاز این برنامه Chat Completions و Embeddings اعلام شده؛ Responses به‌عنوان workaround استفاده نشد. نرخ عمومی [مدل‌ها](https://boxapi.ir/docs/ai/models/) فقط برای انتخاب آزمایش کوچک بررسی شد و هزینه قطعی حساب از آن نتیجه نمی‌شود.
