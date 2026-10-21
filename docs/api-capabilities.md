# قرارداد و وضعیت API لیارا

بررسی مستندات عمومی در ۲۰۲۶-۱۰-۲۱؛ **هیچ درخواست احرازشده به API لیارا در این آماده‌سازی اجرا نشده است**. `documented` با `live_verified` فرق دارد.

## منابع معتبر

- [Liara API و احراز هویت](https://docs.liara.ir/references/api/about/): PaaS روی `https://api.liara.ir`؛ header از نوع `Authorization: Bearer TOKEN`؛ در حالت تیم پارامتر `teamID` لازم است.
- [مستندات توسعه‌دهندگان](https://developers.liara.ir/) و [فهرست](https://developers.liara.ir/llms.txt).
- [OpenAPI PaaS](https://developers.liara.ir/spec/paas.yaml)، snapshot در [liara-paas.openapi.yaml](sources/liara-paas.openapi.yaml)، SHA-256: `a8b8ab24c0b2decf8a67a93a9fc935f93846a991f999d0c4ebb7478a6fc4d56d`، ۵۴۲۹۰ بایت. این فایل reference است و runtime config محسوب نمی‌شود.
- [CLI رسمی](https://github.com/liara-cloud/cli) در صورت نیاز fallback؛ ساختار command در نسخه نصب‌شده با help بررسی شود. کلون تحقیقی آن خواندن جامع همه کد یا تست آن محسوب نمی‌شود.

## endpointهای مستند مرتبط

تمام مسیرهای جدول، **upstream Liara** هستند، نه API داخلی Launchlane. P1 اکنون transport محدود release read و parser متریک دارد؛ هیچ درخواست احرازشده واقعی اجرا نشده است و جدول همچنان وضعیت زنده را بیان می‌کند.

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
| catalog پلن و قیمت | در subset PaaS بررسی‌شده مسیر catalog جدا مشخص نشده | از CLI/منبع رسمی تاریخ‌دار یا ورودی کاربر بررسی شود؛ عدم مشاهده به معنی نبود در کل Liara نیست | unresolved |

نمونه غیررسمی ممکن است route، default base، rollback یا required field متفاوتی داشته باشد. تطبیق مستقیم با OpenAPI/CLI و پاسخ واقعی ضروری است. قابلیت rollback عمومی و idempotency write هنوز تأیید نشده‌اند و در scope پایه promise نمی‌شوند.

## گام اول پس از دریافت دسترسی

1. در env محلی ignored، token/team و مدل مجاز را تنظیم کنیم؛ budget و app آزمایشی مشخص باشند.
2. یک read scope کوچک: account/team → app انتخابی → details/release/logs/metrics؛ response خام sanitized با timestamp و نسخه ذخیره شود.
3. شکل دقیق null/empty/error، pagination، timestamp و unit بررسی و fixture synthetic با contract واقعی تطبیق داده شود. secret/user data لازم نیست در repo ثبت شود.
4. یک compatibility smoke کم‌مصرف مدل: tool call با schema، خروجی structured و terminal/error؛ streaming فقط اگر استفاده می‌شود. SDK بر اساس همین نتیجه انتخاب شود.
5. پس از پذیرش policy/session/storage/approval و تأیید کاربر، اولین write کوچک روی app مجاز اجرا و readback ثبت شود.

اختلال access، کار مستقل offline را متوقف نمی‌کند. capability unavailable باید reason و next step بدهد؛ UI نباید metric، موفقیت یا هزینه تولید کند. `.env.example` با `src/server/config.ts` هماهنگ است؛ gateهای mutation/model، scope، session، workspace و سقف‌ها اکنون مصرف و اعتبارسنجی می‌شوند.

## قرارداد پیاده‌شده آفلاین

- `LiaraReadClient.releases`: فقط GET به میزبان ثابت PaaS؛ teamID و app allowlist در server، صفحه ۱–۱۰۰۰ و count ۱–۵۰؛ پاسخ محدود و validate شده. بدون retry پنهان؛ 401/403، 429 و 5xx به failure مجزا تبدیل می‌شوند و empty تلقی نمی‌شوند. این client هنوز route عمومی برای تماس واقعی ندارد.
- `parseMetricSummary`: با شکل pinned schema کار می‌کند؛ missing/null/empty همگی unknown، raw tuple به درصد/بایت/ثانیه تعبیر نمی‌شود. field و unit واقعی نیاز به T20 دارند.
- `BoxApiClient`: فقط `https://ai.boxapi.ir/ai/v1/chat/completions`، non-streaming، Bearer و بدون redirect/fallback. `LAUNCHLANE_ENABLE_LIVE_MODEL=false` پیش از transport و مصرف budget توقف می‌دهد. call/result ID، ابزار محدود read-only، app scope، terminal/truncation، خطا، cancellation و سقف حجم fixture-tested هستند. این adapter هنوز به diagnosis محصول وصل نیست.
- مبنای endpoint/auth، [مستند رسمی BoxAPI](https://boxapi.ir/docs/ai/) است. شکل `tool_calls` و `tool_call_id` از [قرارداد Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create) گرفته شده است. در T24، tool/result/terminal و `max_completion_tokens` با `gpt-6-luna` و `reasoning_effort=none` واقعاً کار کردند؛ بدون reasoning صریح، سرویس 400 داد. سایر مدل‌ها و semantics خطا/usage عمومی هنوز تأیید نشده‌اند. هیچ کلیدی به OpenAI ارسال نمی‌شود و SDK OpenAI نصب نشده است.
- fixtureها در `tests/domain/providers.test.ts` صریحاً synthetic هستند. `gpt-6-luna/none` فقط انتخاب سازگاری اولیه است؛ مدل مناسب diagnosis باید با oracle مستقل ارزیابی شود. streaming پیاده نشده است.

خبر فعال‌شدن اعتبار، فهرست مدل‌ها و سقف ۳ دلار از مالک در ۲۰۲۶-۱۰-۲۱ آمد. [صفحه برنامه BoxAPI](https://boxapi.ir/starcoach) در fetch عمومی قابل خواندن نبود؛ فهرست اختصاصی از متن ارائه‌شده مالک است، نه مشاهده مستقل حساب. مسیر مجاز این برنامه Chat Completions و Embeddings اعلام شده؛ Responses به‌عنوان workaround استفاده نشد. نرخ عمومی [مدل‌ها](https://boxapi.ir/docs/ai/models/) فقط برای انتخاب آزمایش کوچک بررسی شد و هزینه قطعی حساب از آن نتیجه نمی‌شود.
