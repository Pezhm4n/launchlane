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

## T11/T30 — قرارداد خواندن و probe مستقل از حساب

پایه `7db15be` + working tree همین برش؛ Node 24.18.0/npm 11.16.0؛ AC01/08/13. Skill مؤثر competition-agent-engineer (runtime/evaluation). generation قبلی گراف این مسیرها را پوشش نمی‌داد؛ index_status و check_index_coverage فعلی هر دو Transport closed دادند. source دقیق، importها، OpenAPI pinned و مسیر logs در CLI رسمی مبنای بررسی‌اند؛ گراف شاهد کامل بودن نیست.

project/release/logs/events/applets/summary، scope و teamID مشترک، خطای typed، حذف env values و DNS-pinned HTTPS probe پیاده شدند. gate مستقل Liara پیش از budget/transport/DNS کنترل می‌شود. فقط ISO با timezone صریح به زمان قابل مقایسه تبدیل می‌شود؛ tuple عددی و unit متریک unknown می‌مانند. logs v1 با v2 در CLI اختلاف مستند دارد؛ تبدیل حدسی یا fallback انجام نمی‌شود.

`npm run lint`، `npm run typecheck`، `npm run build`: pass. `npm run test:domain`: 36 pass/0 fail/skip؛ `npm run test:http`: 7 subtest + 1 parent pass/0 fail/skip. ده case جدید، gate صفر upstream، env value exclusion، app mismatch، redaction، زمان نامعلوم، v1/v2 shape، 401/429/503، cancellation دیررس، IPهای خاص/خصوصی v4/v6، mixed DNS، pin، redirect بدون follow و حد اندازه را پوشش می‌دهند. transport/DNS/socket آزمون‌ها مصنوعی هستند؛ هیچ درخواست Liara یا مدل و هزینه تازه وجود ندارد. TLS واقعی، host workload و semantics حساب به T20 وابسته‌اند.

دو failure توسعه رفع شدند: parameter property با strip-only runner سازگار نبود و به field صریح تغییر کرد؛ گزینه autoSelectFamily در نوع RequestOptions نسخه نصب‌شده نبود و family مشخص IP پین‌شده استفاده شد. lint نیز control regex و assignment در expression را رد کرد؛ filter کد نویسه و شمارش صریح جایگزین شدند. oracleها ضعیف نشدند. نصب محلی dependencies ناقص و swc قفل بود؛ فقط فرایند Next همین مسیر متوقف و `npm ci` از lockfile بازسازی شد؛ سپس همه فرمان‌های بالا تازه اجرا شدند. evidence collector و UI تشخیص مرحله بعدند؛ write/diagnosis زنده تأیید نشده‌اند.

## T14/T30/T31 و بخش مقایسه T32 — مسیر اختلال آفلاین

پایه `7af1b76` + working tree همین برش؛ AC08/09/11/13/14. Skills مؤثر competition-agent-engineer و ux-ui-agent-skills (component، accessibility و disclosure)، همراه قواعد React/Next موجود. ابزار coverage گراف Transport closed داد؛ source/call flow/test مستقیم مبنای نتیجه است. هیچ درخواست تازه Liara/BoxAPI وجود ندارد.

collector هفت read محدود را با یک deadline جمع می‌کند؛ failure هر منبع، empty و unknown مستقل‌اند. زمان log قدیمی حفظ می‌شود؛ شناسه release بدون تبدیل به سلامت workload می‌آید. diagnosis یک snapshot ثابت همان app را با tool call/result می‌خواند؛ terminal بدون شواهد، app دیگر، ابزار تکراری، reference ساختگی، log خارج بازه، metric unknown برای فرضیه مشخص، بودجه/لغو و field مجوز ناشناخته رد می‌شوند. validation ارجاع و JSON اثبات صحت علت یا کیفیت مدل نیست؛ این بخش با BoxApiClient و transport مصنوعی سنجیده شد.

`verifySameSymptom` به mode/team/app/origin/path و مشاهده تازه حساس است؛ healthz، app دیگر یا پاسخ قدیمی به موفقیت تبدیل نمی‌شوند. این helper فقط symptom را مقایسه می‌کند و action/release/env effect را موفق نمی‌کند. مسیر تمرینی سه سناریوی scripted دارد و صریحاً صفر provider request/تغییر زیرساخت گزارش می‌کند؛ fallback خطای provider نیست. snapshot/diagnosis تمرین ماندگار نیست.

`npm run lint`، `npm run typecheck`، `npm run build`: pass؛ `npm run test:domain`: 42 pass/0 fail/skip؛ `npm run test:http`: 8 subtest + 1 parent pass/0 fail/skip. `npm run test:browser`: 50 حالت در 280/320/360/390/414/768/1280 و متن 200٪، 0 overflow صفحه/axe violation/browser error/external request در حالت‌های سنجیده‌شده؛ artifact `.artifacts/p1/2026-10-21T18-00-54-064Z/`.

failure اولیه browser، focus لغو روی دکمه‌ای را یافت که هنوز disabled بود؛ بازگشت فوکوس پس از commit state انجام و همان case pass شد. screenshot اولیه صفحه بلند، تصمیم سه نمای جدا و انتخاب سناریوی جمع‌شونده را ایجاد کرد؛ تصویر اولیه در `.artifacts/p1/2026-10-21T17-56-54-194Z/` محفوظ است. تصاویر موبایل/دسکتاپ نتیجه تازه مستقیماً دیده شدند؛ بازبینی انسانی تازه و screen reader واقعی unconfirmed هستند. persistence incident، env secret-reference/write، deploy adapter و تشخیص/اصلاح واقعی باقی‌اند.

بازاجرای نهایی همین برش پس از اصلاح stretch ستون راهنما و افزودن بررسی لینک شاهد: build pass و browser برابر 51 حالت/7 عرض، همه شاخص‌های فوق 0؛ artifact `.artifacts/p1/2026-10-21T18-04-28-633Z/`. لینک از فرضیه به نمای شواهد می‌رود و همان entry فوکوس می‌گیرد؛ case لغو اولیه نیز دوباره pass شد. این snapshot جایگزین عدد run قبلی نمی‌شود و روی candidate بعدی باید جدا سنجیده شود.

## UX60 — معرفی واقعی پروژه محلی و خطای قابل بازیابی

پایه `d5c57a2` + working tree همین برش؛ AC02/13/14 و UX60. Skills مؤثر ux-ui-agent-skills، frontend-design، web-design-guidelines و vercel-react-best-practices؛ source و تست مستقیم برای پوشش گراف not_tracked روی generation 14:08:53Z. مسیر کنترل→API session/Origin/CSRF→canonical folder→listing/inspection→typed result بررسی شد.

با CUA و مرورگر واقعی روی سرور production ایزوله/حساب مصنوعی بازتولید شد: پوشه ناموجود خطای عمومی می‌داد، نتیجه پس از reload از بین می‌رفت و دکمه موبایل 924px پایین سند بود. پس از تغییر، dialog با Enter باز شد، examples/node-service از فهرست واقعی انتخاب و بررسی شد، Escape در تغییر انتخاب profile قبلی را نگه داشت و focus به کنترل بازگشت. محل کنترل انتخاب 618px در همان 360×844 بود. این کاهش فقط این برش را توصیف می‌کند؛ بهبود کلی تجربه هنوز تکمیل نشده است.

`npm run lint`، `npm run typecheck`، `npm run build` pass؛ `npm run test:domain`: 44 pass/0 fail/skip؛ `npm run test:http`: 9 subtest + 1 parent pass/0 fail/skip. پوشه خالی، pagination، root مجاز، symlink/junction، traversal، حذف پوشه، cancellation و نگاشت ENOENT/EACCES/EPERM سنجیده شدند؛ permission denial بخشی synthetic و آزمون ACL واقعی Windows انجام نشده است. مرورگر قبل از اصلاح نهایی خطای inline، 52 حالت/7 عرض را گذراند؛ run `.artifacts/p1/2026-10-21T18-20-17-519Z/`. مسیر نمونه اختیاری است و تغییر ناموفق/لغوشده انتخاب معتبر را پاک نمی‌کند. اتصال‌ها و persistence هنوز در همین برش پیاده نشده‌اند؛ هیچ درخواست مدل یا Liara وجود ندارد.

در run بعدی، locator بدون نام، announcer داخلی Next را پیش از پاسخ انتخاب کرد؛ locator به alert دارای پیام محصول محدود و برای خطای فیلد نام دسترس‌پذیر اضافه شد. همان focus assertion حفظ شد؛ تصویر شکست در `.artifacts/p1/2026-10-21T18-25-48-869Z/` باقی است. نتیجه بازاجرای نهایی پس از پایان آن در همین سند ثبت می‌شود.

بازاجرای نهایی UX60: build pass؛ `test:browser` با 52 حالت/7 عرض و 0 overflow/axe violation/browser error/external request موفق شد؛ `.artifacts/p1/2026-10-21T18-30-29-162Z/`. انتخاب واقعی پوشه با keyboard و لغو حفظ‌شونده به آزمون‌ها اضافه شد. 44 domain و 10 HTTP در build این سری pass هستند؛ پرونده تشخیص source و approval قبلی دست‌نخورده مانده‌اند. این برش تنها UX60 و بخشی از دسترسی موبایل را می‌بندد؛ UX61–66 همچنان کار فعال‌اند.

## UX61/62 — زیرساخت نگهداری اتصال و spike روش ورود

پایه `9437a05` + working tree این برش؛ AC01/13/16. اتصال محصول هنوز تکمیل نشده است. migration 3 append-only، metadata عمومی actor-bound و credential رمز‌شده با AES-256-GCM ساخته شدند. domain، actor/provider دیگر، key متفاوت، tamper، nonce تازه، حذف اتصال محلی و رد ذخیره plaintext را بررسی می‌کند؛ هیچ credential واقعی مصرف نشده است. `lint/typecheck/build` pass؛ `test:domain` برابر 46 pass/0 fail/skip و `test:http` برابر 10 pass/0 fail/skip. آزمون ارتقای DB قدیمی با شمار migrationهای جاری و hash بدون تغییر approval v1 دوباره pass شد. browser این برش تغییری نکرد.

CLI رسمی GitHub 2.103.0 از release رسمی دریافت شد؛ digest archive برابر `80c846a5b8432672ca6373b34ce9de998c9686aaa1885c845f2e1ee81f713726` با API رسمی برابر و `gh --version` موفق بود. فایل فقط ابزار محلی ignored است. pending login آزمایشی با config خالی و بدون grant پس از 20s قطع شد؛ code/نشانی ورود در این بازه دریافت نشد. credential/account grant انجام نشد؛ ورود واقعی همچنان unverified است. source رسمی نشان داد در non-interactive نشانی ورود چاپ می‌شود و مرورگر native باز نمی‌شود؛ timeout به fake connection تبدیل نخواهد شد.

متد browser از Liara CLI نصب‌شده 9.4.7 با module hook فقط برای open/HTTP/get-port/notify در spike خصوصی اجرا شد: no loopback host، پذیرش callback بدون state با Origin متفاوت، body=131160B و status=200؛ socket و مرورگر واقعی 0. این آزمون synthetic رفتار همان callback است و login حساب را تأیید نمی‌کند. تصمیم رد استفاده مستقیم و انتخاب راهنمای کلید+اعتبارسنجی در ADR اتصال ثبت شد. حساب/تیم/app واقعی و هیچ عملیات زیرساخت یا مدل تازه‌ای آزمایش نشده‌اند. مرحله بعد adapter ورود و انتخاب repository/برنامه با API واقعی در حد مجاز، fixture failures و UI قابل اقدام است.
