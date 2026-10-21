# شواهد اعتبارسنجی Launchlane

بخش نخست، سابقه P0 است؛ بخش P1 پایین همین فایل شواهد جاری را نگه می‌دارد. نتایج bootstrap جای قابلیت محصول و fixture جای اتصال زنده نیست.

## محیط و شرایط

- تاریخ: 2026-10-21؛ Windows PowerShell؛ Node 24.18.0، npm 11.16.0.
- نسخه دقیق وابستگی‌ها: `package-lock.json`؛ Next 16.4.2، React 19.3.1، TypeScript 6.0.3، Biome 2.6.2.
- هیچ credential، مدل یا درخواست احرازشده Liara استفاده نشد.
- HTTP smoke فقط loopback را می‌پذیرد و server در حال اجرا لازم دارد.

## نتایج

| بررسی | دستور/شرط | نتیجه |
| --- | --- | --- |
| نصب از lockfile | `npm ci` | موفق؛ نصب تمیز وابستگی‌ها از lockfile |
| Lint | `npm run lint` | موفق؛ exit 0 |
| Type check | `npm run typecheck` | موفق؛ exit 0 |
| Production build | `npm run build` | موفق؛ exit 0 |
| Production HTTP smoke | `npm start -- --port 3147` و `TEST_BASE_URL=http://127.0.0.1:3147` سپس `npm test` | 2 passed، 0 failed، 0 skipped؛ پاسخ entry/health و no-store/نبود x-powered-by |
| Development HTTP smoke | `npm run dev -- --port 3148` و `TEST_BASE_URL=http://127.0.0.1:3148` سپس `npm run check` | lint/typecheck موفق؛ همان 2 smoke passed، 0 failed/skipped؛ 2 مورد مجزا هستند، نه 4 تست محصول |
| ثبات دستورالعمل محلی | اجرای dev با `agentRules: false` | فایل AGENTS تحت مدیریت پروژه ماند؛ تولید خودکار framework غیرفعال است |
| لینک‌های مستندات | بررسی 9 Markdown فنی با خواندن مسیر نسبی | 0 لینک شکسته یا وابسته به یادداشت محلی خصوصی |
| Dependency audit | `npm audit --json` | 0 advisory در prod/dev؛ کنترل وابستگی‌ها، نه اثبات امنیت محصول |
| SQLite runtime probe | import ماژول `node:sqlite` و query در حافظه | نسخه SQLite 3.53.1؛ فقط سازگاری این runtime، نه تست storage آینده |

## بازبینی اسناد

یک reader مستقل، اسناد فنی را بدون اتکا به یادداشت‌های خصوصی و سپس handoff محلی را خواند. ابهام ترتیب recovery پس از write، وابستگی UI به گیت نهایی و جداسازی spike لیارا/مدل اصلاح و دوباره بررسی شدند. این بررسی فقط وضوح و سازگاری مدارک را می‌سنجد؛ هیچ آزمون runtime جدید از آن نتیجه نمی‌شود.

## مرزهای تأییدنشده

- صحت قرارداد با حساب واقعی، team/app، timestamp/unit و خطاهای provider؛
- tool calling و کیفیت مدل، هزینه و quota؛
- upload/release/readiness و درخواست workload روی Liara؛
- رعایت approval/auth/Origin/CSRF و persistence در runtime محصول آینده؛
- تشخیص معنایی خطا، اثر اصلاح، عملکرد و تجربه کاربر؛
- ظاهر نهایی، responsive و accessibility محصول.

هنگام پیاده‌سازی هر قابلیت، revision/config، داده ورودی، expected/actual، فرمان و نتیجه، real/simulated و محدودیت باقی‌مانده را ثبت کنید. نتایج bootstrap را به readiness محصول تعمیم ندهید.

## P1 — میز کار محلی و مرزهای اجرا، ۲۰۲۶-۱۰-۲۱

پایه‌های موضوعی: `917819a` (session/approval) و `de06ac7` (source/provider contracts)، به‌همراه UI و اسناد همین commit. Node 24.18.0، Windows؛ Next 16.4.2 و package-lock همین candidate. هر دو gate زنده false. HTTP/مرورگر با scope و login موقت، provider key خالی و DB/workspace موقت اجرا شدند. هیچ درخواست مدل یا Liara در این مجموعه نیست.

| بررسی | فرمان و شرط | نتیجه و مرز شاهد |
| --- | --- | --- |
| Lint | `npm run lint` | pass؛ بدون explicit any یا خاموش‌کردن آن rule |
| Type/build | `npm run typecheck`، `npm run build` | pass؛ همه routeهای موجود ساخته شدند؛ بدون نیاز به API key |
| Domain | `npm run test:domain` | 20 passed، 0 failed/skipped؛ policy/session، race دو connection، crash/lost response، migration/storage failure، source safety، budget، protocol و workload oracle |
| HTTP تولیدی ایزوله | `npm run test:http` پس از build | 6 subtest + 1 parent passed، 0 fail/skip؛ auth/Host/Origin/CSRF، app mismatch، source change، decision/replay، mutation gate و logout |
| Browser تولیدی ایزوله | `npm run test:browser` | 11 حالت؛ 320/360/390/414/768/1280 و text 200٪؛ overflow صفحه 0، browser error 0، external request 0 و axe violation 0 در حالت‌های سنجیده‌شده |
| Bootstrap | server تولیدی loopback با `npm start`، سپس `npm test` | 2 passed، 0 fail/skip؛ liveness و entry، نه شاهد deploy |
| Local setup | `npm run setup:local` | config موجود حفظ شد؛ کلید محلی جدا تولید و فقط در فایل ignored نوشته شد؛ مقدار در stdout نیامد |
| Build traces | parse ده فایل `.nft.json` و بررسی private path | 0 reference به `.local/.data/.artifacts/.env*` در traceهای سنجیده‌شده |

آخرین artifact رابط در زمان این ثبت: `.artifacts/p1/2026-10-21T16-12-24-811Z/` محلی؛ `results.json`، تصاویر ورود، profile/manifest، تأیید و خطا. نسخه تیره با IRANYekan و بدون وابستگی فونت خارجی اجرا شد. UI شامل اصلاح header/عنوان کوچک‌تر پس از ورود برای دسترسی زودتر به کار اصلی در موبایل است. این artifactها داده حساب واقعی ندارند و وارد Git نمی‌شوند.

معنای oracle محلی: همان `/` و revision نمونه با env غایب 500، env خالی/اصلاح ناموفق 500 و مقدار درست 200 داد؛ `/healthz` در هر سه حالت 200 بود. source sample تحت کنترل پروژه است. نتیجه، سازگاری Liara یا استدلال مدل درباره علت را اثبات نمی‌کند.

### failureهای حفظ‌شده و علت اصلاح

- axe در حالت focus لینک skip، پوشانده‌شدن لوگو را `target-size` گزارش کرد. لینک هنگام focus وارد flow می‌شود تا روی هدف دیگر نیفتد؛ همان حالت دوباره pass شد.
- آزمون Host با `fetch` ابتدا به 200 رسید. probe مستقل نشان داد Node هدر Host داده‌شده را بازنویسی می‌کند. تست به `node:http` تغییر کرد تا Host مخرب واقعاً روی wire ارسال شود؛ 403 از boundary محصول تأیید شد.
- کنترل focus از مسیر pointer/programmatic با `:focus-visible` یکسان نیست؛ regression اکنون Tab واقعی از summary به scroll region را بررسی می‌کند. Next route announcer نیز alert جدا دارد؛ alert خطای برنامه نام accessible مستقل گرفته است.
- build اولیه از مسیر dynamic state هشدار tracing تمام پروژه داد؛ مسیرهای runtime با annotation نسخه نصب‌شده از tracing خارج شدند. build بعدی بدون آن هشدار و traceها بدون private reference بودند.
- parser متن مدل در self-review برای متن چندخطی اصلاح و regression اضافه شد؛ payload بزرگ و پاسخ دیررس پس از cancel به موفقیت تبدیل نمی‌شوند.

### محدودیت‌های جاری

گراف اولیه نسل `2026-10-21T14:08:53Z` در Tier 2 خوانده شد؛ coverage برای مسیرهای اولیه metadata_changed و docs/tests excluded داشت، پس source مستقیم خوانده شد. در بازبینی نهایی transport گراف قطع بود؛ coverage تازه برای فایل‌های اضافه‌شده قابل تأیید نیست و نتیجه نهایی بر exact source/diff و اجرا متکی است.

screen reader واقعی، walkthrough فرد تازه، تمام stateهای provider، زمان/واحد metric واقعی، archive/upload، env secret reference، اجرای چند process، SSRF-safe probe و deployment/diagnosis/correction زنده هنوز تأیید/تکمیل نشده‌اند. هیچ نمره آمادگی یا نتیجه مسابقه از این تست‌ها استخراج نمی‌شود.

## T24 — نخستین smoke واقعی BoxAPI

Runtime پایه `fec8938` با اصلاح transport/config در working tree؛ `gpt-6-luna`، میزبان ثابت BoxAPI، Chat Completions non-streaming، output cap=512 و timeout=30s. هیچ درخواست Liara انجام نشد. داده ارسالی فقط protocol-smoke مصنوعی است و شامل source/log/account واقعی نیست.

- 16:15:49 UTC: یک درخواست، HTTP 400، 5.526s؛ جزئیات در نسخه نخست ثبت نشده بود. consumption و مبلغ unknown.
- 16:17:11 UTC: یک درخواست تشخیصی همان case، HTTP 400، 2.799s؛ سرویس ناسازگاری tools با reasoning پیش‌فرض gpt-6-luna در Chat Completions را اعلام کرد. پاسخ sanitizer شد؛ retry خودکار وجود نداشت.
- اصلاح: `MODEL_REASONING_EFFORT=none` به‌صورت صریح، `PROVIDER_REJECTED` برای 400/422 و regression روی body واقعی transport. endpoint، مدل و oracle تغییر نکردند. Responses به دلیل نبودن در فهرست endpointهای این اعتبار استفاده نشد.
- 16:18:21 UTC: دو درخواست HTTP 200، tool-call واقعی→result همان ID→JSON terminal با app/evidenceId/status/outcome مطابق oracle؛ 616 total tokens گزارش‌شده، 10.505s کل run. preflight cancel هیچ upstream اضافه‌ای نداشت. توقف پردازش/عدم billing پس از in-flight cancel آزموده نشده است.

گزارش‌های sanitize شده در `.artifacts/model/2026-10-21T16-15-49-733Z/`، `2026-10-21T16-17-11-767Z/` و `2026-10-21T16-18-21-569Z/` محلی نگه داشته شدند. در این سه run مجموعاً چهار HTTP attempt وجود داشت؛ usage فقط برای دو درخواست موفق گزارش شد و خطاها رایگان فرض نمی‌شوند. این سه snapshot را یک ارزیابی مدل یا accuracy عمومی نمی‌نامیم.

پس از smoke، مدل‌های مجاز Chat در config/client محدود و CLI به حداکثر دو درخواست کاهش یافت. `npm run smoke:model -- --live` صریحاً opt-in است؛ automatic check آن را اجرا نمی‌کند و gate ذخیره‌شده false می‌ماند. تغییر scope آزمون fixture یا انتخاب مدل/endpoint fallback پنهان وجود ندارد. اعتبارسنجی candidate نهایی در رکورد بعدی جدا ثبت خواهد شد.

### snapshot روی candidate `a697eba`

`a697eba9480d0dd5ac7326280963c50601565ae6`، همان model/protocol/reasoning/output cap و oracle قبلی. `npm run smoke:model -- --live` در 16:25:57 UTC: دو پاسخ 200، همان tool/result/terminal معتبر، 616 total tokens گزارش‌شده و 25.104s زمان کل. preflight cancel صفر درخواست اضافه داشت؛ in-flight provider cancellation و مبلغ کسرشده همچنان unverified هستند. گزارش محلی `.artifacts/model/2026-10-21T16-25-57-204Z/report.json`.

در مجموع snapshotهای ثبت‌شده T24 شش HTTP attempt بوده است: دو خطای 400 و چهار پاسخ موفق. usage دو run موفق هرکدام 616 است؛ usage/هزینه خطاها unknown می‌ماند. runهای جدا به accuracy یا latency میانگین عمومی تبدیل نمی‌شوند. روی همین candidate، lint/type/build، 20 domain، 7 HTTP (با parent)، 2 bootstrap و 11 حالت مرورگر pass بودند. artifact مرورگر `.artifacts/p1/2026-10-21T16-25-59-179Z/` است. export فقط از Git در پوشه موقت، setup محلی و `npm run build` بدون provider key هم اجرا و exit 0 مشاهده شد؛ این شاهد به revision قبل از archive مربوط است.

## P1 — archive واقعی محلی و approval v2

پایه `a697eba` + working tree همین برش؛ Node 24.18.0، npm 11.16.0، tar-stream 3.2.2 از lockfile. AC02/04/13/14/16؛ Skills مؤثر: competition-agent-engineer، ux-ui-agent-skills (قواعد accessibility/RTL) و webapp-testing. هیچ درخواست تازه مدل یا Liara در این برش وجود ندارد؛ تمام adapterهای اجرای تست مصنوعی و scopeها موقت‌اند. بسته واقعاً ساخته و خوانده می‌شود، اما upload/deploy لیارا انجام نشده است.

| بررسی | فرمان/شرط | نتیجه و مرز |
| --- | --- | --- |
| Lint/type/build | `npm run lint`، `npm run typecheck`، `npm run build` | pass؛ route archive تولید شد؛ explicit any یا bypass تازه وجود ندارد |
| Domain | `npm run test:domain` | 26 pass، 0 fail/skip؛ 6 case جدید archive علاوه بر 20 case موجود |
| HTTP ایزوله | `npm run test:http` | 7 subtest + 1 parent pass، 0 fail/skip؛ archive auth/CSRF، hash جعلی، source تغییرکرده، receipt mismatch و approval v2 |
| Browser ایزوله | `npm run test:browser` | 23 حالت در 280/320/360/390/414/768/1280 و متن 200٪؛ overflow صفحه 0، browser error 0، external request 0 و axe violation 0 در حالت‌های سنجیده‌شده |
| Bootstrap تولیدی | `npm start` روی loopback، سپس `npm test` | 2 pass، 0 fail/skip؛ شاهد entry/liveness و نه سرویس بیرونی |
| Decoder مستقل | `node .local/verify-source-archive.mjs .artifacts/source/2026-10-21T16-56-10-465Z/source.tar.gz`؛ ابزار موقت محلی، وارد Git نمی‌شود | Python tarfile: هر 4 entry و بایت/hash دقیقاً با manifest برابر؛ Unicode و مسیر بلند؛ bsdtar: بایت فایل‌های ASCII برابر؛ بدون شبکه |

artifact مرورگر نهایی `.artifacts/p1/2026-10-21T17-01-48-065Z/` و decoder `.artifacts/source/2026-10-21T16-57-23-878Z/report.json` هستند. IRANYekan واقعاً با FontFace loaded بررسی شده است. فوکوس پس از بسته‌سازی به heading نتیجه و پس از لغو هر read به دکمه شروع همان مرحله برمی‌گردد؛ keyboard assertion هر سه مسیر pass شد. بدون app لیارا، بسته آماده می‌شود اما ساخت پیشنهاد غیرفعال می‌ماند.

معیار archive: regular fileهای داخل tar دقیقاً همان path/byte/hash manifest، بدون env/dependency؛ metadata ثابت، تغییر صرف timestamp بدون تغییر archive hash، receipt actor-bound پس از reopen و blob بدون receipt فاقد مجوز. فایل حذف‌شده/هم‌اندازه ولی خراب، تغییر archive hash، پوشه junction و سقف نگهداری پیش از attempt/provider رد شدند. ویرایش workspace پس از approval، snapshot تأییدشده را تغییر نداد؛ adapter مصنوعی همان buffer را گرفت و receipt تنها به observing رسید. history v1 با hash قبلی پس از migration 2 خوانده شد؛ deploy v1 صفر provider call داشت.

### failureهای این برش و شواهد اصلاح

- در سنجش loading، تأخیر ثابت 500ms پاسخ fixture گاهی پیش از کلیک لغو تمام می‌شد. همان oracle حفظ شد و transport تست تا تصمیم لغو نگه داشته شد؛ state و بازگشت فوکوس دوباره pass شدند.
- bsdtar ویندوز نام فارسی را در stdout به `?` نمایش داد؛ hash/بایت archive تغییر نکرد. همان فایل اولیه با Python tarfile مستقل خوانده و تمام نام‌ها/بایت‌ها/hashها درست بودند. `originalFailedArchiveUnchanged=true` و `windowsTarDisplayLoss=true` در report محفوظ‌اند؛ نمایش Unicode ابزار ویندوز تأییدشده نامیده نمی‌شود.
- بازبینی UI، حذف‌شدن دکمه متمرکز پس از نتیجه را یافت. heading نتیجه و بازگشت فوکوس پس از cancel اضافه و با DOM واقعی بررسی شدند؛ صرف live message جای حفظ focus نیست.

گراف دوباره در دسترس بود اما coverage همان generation قدیمی، فایل‌های تازه not_tracked و docs excluded را نشان داد؛ تلاش پوشش تکمیلی به Transport closed رسید. exact source/import/diff و اجرای مستقیم مبنای نتیجه‌اند. NTFS/hard-link در این میزبان سنجیده شد؛ filesystem دیگر، چند process، screen reader انسانی و walkthrough تازه هنوز unconfirmed هستند. نگهداری archive سقف دارد ولی پاک‌سازی خودکار ندارد. env secret-reference، provider write adapter، probe امن، تشخیص و اصلاح زنده باقی‌اند؛ کار بعد مستقل قرارداد evidence و failures است.

### بازتولید از Git روی `7ba2a2a`

Candidate اجرایی: `7ba2a2a5c0b9b0cec1d51e6303a2dd58777894b3`. با `git archive` فقط فایل‌های tracked به پوشه موقت تازه منتقل شدند؛ env، DB، source archive و اسناد خصوصی workspace وارد export نشدند. روی همان Node/npm و Chromium نصب‌شده این میزبان، `npm ci` → `npm run setup:local` → `npm run build` → `npm run test:domain` → `npm run test:http` → `npm run test:browser` همگی exit 0 دادند. کلیدهای provider خالی و هر دو gate false تأیید شدند؛ setup فقط credential محلی همان export را ایجاد کرد.

در این اجرای مستقل: domain برابر 26 pass، HTTP برابر 7 subtest + 1 parent pass و مرورگر برابر 23 حالت/7 عرض، با 0 fail/skip، browser error، external request و axe violation در دامنه سنجیده‌شده. این اعداد اجرای تازه‌اند و از جمع runها ساخته نشده‌اند. streaming enumeration نیز پیش از materialize شدن پوشه، سقف entry را enforce می‌کند؛ capture فقط بایت واقعی را نگه می‌دارد، نه buffer موقت کامل هر فایل.

گزارش قدم‌ها، logها و تصاویر کپی‌شده در `.artifacts/repro/7ba2a2a5c0b9b0cec1d51e6303a2dd58777894b3/` محلی‌اند. حذف دو checkout موقت توسط policy محیط با `blocked by policy` رد شد؛ نگه داشته شدند و روش جایگزین حذف اجرا نشد. فایل خصوصی آن‌ها وارد Git نمی‌شود. بررسی 9 سند فنی/20 لینک نسبی: 0 لینک شکسته یا وابسته به فایل private. parse تعداد 11 build trace: 0 reference به `.local/.data/.artifacts/.env*`. پیش از commit source، 30 فایل staged و 11 فایل client بررسی شدند: 0 مسیر خصوصی و 0 تطابق با secretهای env تنظیم‌شده. این بررسی جای security audit جامع یا کشف همه انواع secret را نمی‌گیرد.
