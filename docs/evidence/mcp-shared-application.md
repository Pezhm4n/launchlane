# MCP و application مشترک؛ ۲۰۲۶-۱۰-۲۳

وضعیت A16/AC31: partial. این برش یک مسیر واقعی HTTP و stdio را به application موجود متصل می‌کند؛ پذیرش کل MCP، connector اجرایی یا مأموریت کامل Launchlane نیست.

## revision و configuration

پایه6ae5c383f536b6c839c034281997b7d83baaa9e4، Node24.18.0، Next16.4.2 و SDK رسمی client/server2.3.1. کپی ثابت زیر `.local/mcp-mission/candidate-01` از Git export شد؛ فقط backend/route/تست/bridge این برش و lockfile افزوده شدند. UI، source picker و فایل‌های هم‌زمان همکار وارد آن نشدند. build و server اصلی، credential/config، VPN و SQLite نصب اصلی تغییر نکردند. بررسی حساب اصلی فقط با SQLite readOnly و دو GET محدود انجام شد؛ Store/recovery آن نصب فراخوانی نشد.

## oracle پیش از اجرا

از همان پروژه انتخاب‌شده، inspect واقعی برگردد؛ secret یا مسیر بیرون manifest رد شود. یک publication از MCP در وب همان ID، source، معیار، state و receipt را داشته باشد. duplicate، disconnect و reconnect مدل/write تازه نسازند. grant خواندن نتواند mission، repair یا approval ایجاد کند. actor دیگر، Host/Origin نامعتبر، token خراب/منقضی/لغوشده و protocol ناسازگار رد شوند. stdio فقط protocol بنویسد و process آن Store مستقل باز نکند. برای Codex، discovery تنها کافی نیست: tool call واقعی و رد scope به application مشترک لازم است. هیچ turn مدل، cloud write یا worker dispatch در این oracle نیست.

## نتایج

| اجرا | نتیجه و مرز |
| --- | --- |
| build | تولیدی Turbopack موفق؛ مسیرهای `/api/mcp` و `/api/mcp/access` ساخته شدند؛ warning انتخاب workspace root در export تو‌در‌تو ثبت شد |
| typecheck | فرمان واقعی `npm run typecheck` روی همان کپی موفق؛ root `tsc --noEmit --incremental false` نیز موفق بود |
| lint | فایل‌های جدید9/9 بدون خطا؛ lint کل tree ترکیبی صفر error،34warning و9info داشت که شامل CSS هم‌زمان است؛ این نتیجه امتیاز UI نیست |
| domain اول | با هم‌زمانی پیش‌فرض308/310؛ دو deadline در caseهای قبلی optional chat/project-build تمام شدند؛ failure محفوظ است |
| domain کنترل‌شده | همان310تست با `node --test --test-concurrency=2 tests/domain/*.test.ts`،310/310 و صفر fail/skip؛ oracle یا deadline محصول تغییر نکرد |
| HTTP نهایی | `node --test tests/http/*.test.mjs`،37/37 و صفر fail/skip روی همان build؛ مدل/provider مصنوعی، HTTP و SQLite واقعی |
| MCP اختصاصی |8/8؛ HTTP+stdio واقعی SDK، request/result ID، header نسخه ناسازگار400، body بزرگ413، خواندن source، deny، mission مشترک، reconnect بدون مدل تازه، revoke و logout |
| browser | فرمان کامل هفت suite روی همان UI ثابت:75/27/27/22/38/5/39حالت؛ صفر pageerror و درخواست خارجی گزارش‌شده. مدل/cloud مصنوعی‌اند و طراحی ثبت‌نشده همکار از این اعداد پذیرش نمی‌گیرد |
| Codex واقعی |CLI0.163.0-alpha.11، app-server با home جدید و session ephemeral؛۱۰tool کشف و۳call واقعی context/denied publication/mission replay اجرا شدند. application مشترک و رد scope سنجیده شد؛ model0/cloud-write0؛ cleanup اجرای نهایی تأیید شد |
| حساب Liara |هویت/تیم و فهرست app واقعاً200؛ تیم مجاز تطبیق داشت و app count0 بود. این خواندن availability همه runtimeها، قیمت نهایی یا provisioning نیست |

سه regression domain به‌طور مشخص امضای audience، parent/child session و scope؛ دسترسی source/deny بدون side effect؛ و join/CAS/budget را می‌سنجند. قالب toolها از registry اصلی می‌آید؛ مسیر MCP نه اجرای shell دارد و نه مسیر approve/execute. token اپراتور یا provider در payloadهای عمومی نیست.

برای تکرار مرز میزبان، `npm run smoke:mcp:codex` ساخته شده است؛ فقط executable نصب‌شده را اجرا می‌کند، config/user home موجود را نمی‌خواند و هیچ `turn/start` نمی‌فرستد. خروجی `executableRepairTested:false` صریح است. CLIهای Claude Code و OpenCode در PATH و مسیرهای معمول بررسی‌شده یافت نشدند؛ این مشاهده به معنی اثبات نبودن آن‌ها در تمام دیسک نیست و اتصال زنده‌شان UNCONFIRMED است.

## شکست‌های حفظ‌شده

- HTTP نخست5/7 بود؛ harness مسیر fixture را `directory` فرض کرده بود، در حالی که runner واقعی `workspace` عرضه می‌کند. assertion reconnect حذف نشد؛ مسیر با API واقعی runner اصلاح و سپس stdio گذشت.
- assertion تازه raw HTTP ابتدا پاسخ SSE را JSON فرض کرد. MCP هر دو framing را مجاز می‌داند؛ decoder تست content-type و data frame واقعی را می‌خواند و همان request ID را بررسی می‌کند. SDK client پیش‌تر SSE را درست می‌خواند؛ این شکستِ harness بود.
- Codex در دو spike نخست، discovery و calls را گذراند ولی cleanup Windows یک بار EBUSY و بار دیگر انتظار دوباره برای exit فرایندِ ازقبل‌بسته داشت. smoke نهایی EOF/exit/signal و cleanup همان fixture را اصلاح کرد و exit0 شد. پاک‌سازی دستی دو پوشهٔ قدیمی با `blocked by policy` رد شد؛ روش دیگری برای حذف همان‌ها اجرا نشد و آن دو مسیر در گزارش خصوصی باقی‌اند.
- دو خطای توسعهٔ نوع/لینت، تطبیق schema SDK و throw داخل finally بودند؛ schema با interface رسمی Standard Schema validate و cleanup در تابع خودش قرار گرفت. هیچ assertion/type برای دورزدن validation اضافه نشد.

logها در `.local/mcp-mission/`، با نام‌های `build-01.log`، `domain-01.log`، `domain-02.log`، `http-mcp-01.log` تا `05`، `http-all-final.log`، `typecheck-final.log`، `browser-final.log` و `codex-smoke-01.log` نگه‌داری می‌شوند؛ credential یا fixture خصوصی وارد Git نشده است. دفتر مصرف قبلی readOnly بررسی شد؛ سقف قبلی و allowance فاز پیشین reset نشدند. این برش مدل0، cloud-write0 و صرفاً دو GET واقعی حساب داشته است.

## اولین مرزهای باز

مأموریت طولانی به همان run/event/cursor متصل است، اما چرخه استقرار cloud از خود میزبان، decision continuation میان نشست‌های MCP/وب، انتخاب منبع از MCP، incident goal مستقل، notifications/tasks اختیاری و دو میزبان دیگر هنوز پذیرش جدا می‌خواهند. repair پیشنهادیِ نشست دیگری از همان مسیر review امن موجود عبور می‌کند؛ authority نشست گذشته به میزبان منتقل نمی‌شود.

چهار انتخاب Coding Agent، dispatch واقعی Codex/Claude/OpenCode، pairing سرویس اجرایی، reconciliation job نامعلوم و fallback broker هنوز implementation جدا می‌خواهند. worker داخلی Node/Python همان شواهد قبلی خودش را دارد؛ این تست‌ها شاهد اجرای تازهٔ آن یا fallback بیرونی نیستند. برنامه چندمرحله‌ای و پوشش همه runtimeها نیز از MCP نتیجه نمی‌شوند. [ماتریس capability](../platform-support.md)، [راهنمای تکرار](../mcp.md) و [ADR0017](../decisions/0017-shared-mcp-facade.md) این حدود را حفظ می‌کنند.

## تثبیت روی candidate ترکیبی پس از b59eef9

candidate تازه از b59eef9 ساخته شد؛ UI ثبت‌شده در6e54988 و parser مشترک publication را دارد. فقط fix زیر در server و regression آن افزوده شد. همه نتایج این بخش روی همین source ثابت‌اند؛ خروجی پایه قبلی با آن جمع نشده است.

بازبینی یک نقص بودجه یافت: read مستقیم MCP در هر درخواست RunBudget تازه می‌ساخت و allowance مأموریت متوقف‌شده را مصرف نمی‌کرد. اکنون مالک queued/working جلوی read موازی را می‌گیرد؛ مأموریت انتشار متوقف‌شده، شمارنده و زمان همان run را با reserve پیش از ابزار و CAS حفظ می‌کند. خواندن state/events مجانی و بدون مدل باقی است. regression نخست مسابقه دو read با یک سهم،0/1 شد: درخواست بازنده پس از شکست reserve نیز revision را تغییر می‌داد و نتیجه رقیب معتبر را نامعتبر می‌کرد. persist فقط پس از reserve موفق، علت را رفع کرد؛ دو read اکنون دقیقاً یک موفق و یک BUDGET_EXHAUSTED دارند، model allowance تمدید نمی‌شود و attempts صفر است. failure قبل از fix نگه‌داری شد.

اختلاف schema publication نیز جدا درb59eef9 رفع شد: همان schema قرارداد وب حد۲۴۰نویسه را عرضه می‌کند؛۲۴۰پذیرفته و۲۴۱بدون ساخت run رد می‌شود. تست یا deadline محصول برای پاس‌شدن تضعیف نشد. فرمان رسمی domain با `--test-concurrency=2` زمان‌بندی ثابت دارد؛ دو timeout با هم‌زمانی پیش‌فرضِ اجرای قبلی محفوظ‌اند. گذر همان تست‌ها با هم‌زمانی۲ با contention سازگار است، اما علت دقیق سخت‌افزاری اندازه‌گیری نشده است.

| بررسی تازه | نتیجه و حدود |
| --- | --- |
| نصب مستقل | `npm ci --offline --no-audit --no-fund` در export مستقل با node_modules واقعی،۶۱package نصب و exit0؛ lock همان commit است. این فقط نصب dependency است، نه پذیرش کل محصول از نصب تازه |
| build/typecheck/lint | فرمان‌های واقعی build و typecheck موفق؛ lint کل candidate صفرerror،۳۴warning و۹info. warningهای موجود UI حفظ‌اند |
| domain | فرمان واقعی `npm run test:domain`،۳۱۱/۳۱۱،صفرfail/skip؛ چهار regression اختصاصی MCP نیز۴/۴ |
| HTTP | `npm run test:http`،۳۷/۳۷،صفرfail/skip؛ transport/SQLite واقعی، مدل و cloud مصنوعی |
| browser | فرمان کامل `npm run test:browser`: هفت suite اصلی۷۵/۲۷/۲۷/۲۲/۳۸/۵/۴۳؛ سپس دو case انتخاب بومی پوشه در۳۶۰/۱۲۸۰ و۱۲case حرکت/تعامل. صفرpageerror و درخواست خارجی گزارش‌شده؛ بدون ادعای امتیاز UX یا کاربر تازه |
| sandbox | `npm run test:sandbox`: baseline fail→fix با Node22 واقعی،۵بررسی isolation و حذف۲container؛ سپس۹/۹شامل رد patch غلط، env محدود، build بومی tmpfs و Python آفلاین/رد wheel خراب/asset ناقص. مدل مصنوعی و cloud-write0 |
| locked build | `npm run test:build-sandbox`: دو case سالم/شکسته، npm ci/build/test/start/GET واقعی آفلاین با content cache معتبر؛ source اصلی محفوظ و artifact آزموده‌شده انتخاب شد. case env نیز۱/۱؛ هیچ image/package از شبکه دریافت نشد |
| setup | bootstrap۲/۲ و setup واقعی grant خواندن/مأموریت، رد overwrite و مسیر بیرون `.local`، token معتبر HTTP و نبودن token در stdout؛ config میزبان کاربر تغییر نکرد |
| Codex | `npm run smoke:mcp:codex` روی build تازه: discovery۱۰tool و۳call واقعی، scopeDenied/sharedApplication درست، model0/cloud-write0/executableRepairTested=false، cleanup verified |

logهای این candidate در `.local/mcp-mission/` با نام‌های `budget-final-build.log`، `budget-final-typecheck.log`، `combined-lint.log`، `domain-command-final.log`، `budget-final-http.log`، `combined-browser-final.log`، `final-sandbox.log`، `locked-build-final.log`، `final-codex-smoke.log` و `clean-install.log` هستند. `budget-race-before.log` شکست اولیه را حفظ می‌کند. این برش استقرار تازه لیارا یا اصلاح با مدل واقعی ندارد؛ شواهد تاریخی Node/Python همچنان محدود به همان اجراها هستند.

## لغو اختیار در مأموریت پس‌زمینه؛ پس از7196471

بررسی دقیق‌تر نشان داد parent session در HTTP معتبرسنجی می‌شد، اما run صف‌شده فقط child session را می‌سنجید. regression روی source پیش از fix، با transport مصنوعی، پس از revoke والد یک درخواست مدل ساخت؛ oracle صفر بود و۱≠۰ثبت شد. counterexample در `auth-before.log` و source ثابت همان کپی نگه‌داری شد؛ هیچ درخواست مدل واقعی/هزینه/نوشتن ابری در بازتولید نبود.

McpAccess خصوصی اکنون شناسه والد معتبر را به همان loop می‌دهد. session policy مشترک، پیش از source/secret read، شروع، مصرف و پذیرش پاسخ، والد و فرزند را بررسی می‌کند. تست دو حالت revoke پیش از dispatch و هنگام پاسخ را می‌سنجد: اولی مدل۰، دومی دقیقاً۱ارسال مصنوعیِ آغازشده با مصرف محفوظ و پاسخ دیررسِ ردشده؛ attempts۰، run=failed/AUTH_REQUIRED و بدون artifact/approval تازه. actor مجاز دیگری نیز با نشست مستقل همچنان AGENT_NOT_FOUND می‌گیرد؛ oracle جداسازی actor حفظ شد.

برای این برش snapshot مستقل `.local/mcp-mission/auth-index-candidate` از index ساخته شد. source پایه7196471 و UI ثبت‌شده6e54988است؛ working tree جدید UI، package/runnerهای همکار و config نصب اصلی وارد آن نشدند. نتایج315domain/251browser در گزارش والد به همان commit تعلق دارند و با بررسی‌های این اصلاح به‌عنوان یک full pass تازه جمع نمی‌شوند. [قرارداد](../decisions/0017-shared-mcp-facade.md) محدودیت درخواست درحال‌پرواز و حفظ مصرف را توضیح می‌دهد.

اجرای نخست این اصلاح312/316بود: سه fixture پیش از ورود به منطق محصول به مهلت۳ثانیه‌ای archive خوردند؛ یک failure واقعی نیز recovery مقصد بود. کنترل کامل context در ابتدای loop، مقصد verified اما هنوز adoptنشده را زود رد می‌کرد. فقط کنترل authorization به ابتدای کار منتقل شد؛ adopt همان هویت از receipt موجود، پیش از تطبیق context، حفظ شد. آزمون crash/adoption تغییر نکرد و همراه MCP/Agent،۱۷/۱۷گذشت. patch نخست و failure کامل در `auth-initial.patch` و `auth-index-domain.log` محفوظ‌اند.

هم‌زمانی فایل‌های فرمان domain از۲به۱محدود شد؛ هیچ deadline، assertion، skip یا oracle محصول تغییر نکرد و raceهای درون case همچنان هم‌زمان اجرا می‌شوند. این انتخاب، زمان‌بندی محافظه‌کارانهٔ suite در محیط دارای کار هم‌زمان است؛ root cause دقیق فشار CPU/disk اندازه‌گیری نشده است. source نهایی دوباره در همان کپی آماده و در تمام بررسی‌های نهایی ثابت ماند.۲۶۵فایل با index تطبیق داشتند؛ fingerprint نهایی `4746f331a1c1f1465e2da5e9a9d0e93853336747678bd30245391eca7e0e08ab` است و identity جدا در `auth-index-identity.json` ثبت شد.

| بررسی نهایی این اصلاح | نتیجه و مرز |
| --- | --- |
| build/typecheck/lint | دو فرمان اول موفق؛ lint۲۶۳فایل،صفرerror و۳۴warning/۹info موجود |
| domain کامل | فرمان واقعی `npm run test:domain` با هم‌زمانی فایل۱،۳۱۶/۳۱۶،صفرfail/skip؛ شامل recovery مقصد و۵regression MCP |
| HTTP کامل | `npm run test:http`،۳۷/۳۷،صفرfail/skip |
| container مرتبط | `node --test tests/sandbox/agent-repair.test.ts`،۴/۴با Node22 واقعی، model مصنوعی، patch غلط مسدود و source اصلی محفوظ؛ این۴case جای اجرای تازه کل۹case نیست |
| guided browser مرتبط |۳۸حالت در۳۲۰/۳۶۰/۳۹۰/۷۶۸/۱۲۸۰؛ مرورگر واقعی، مدل/cloud مصنوعی؛ این خروجی full browser تازه۲۵۱حالت نیست |
| Codex واقعی | smoke رسمی همین برش، CLI0.163.0-alpha.11،discovery۱۰tool و۳call واقعی، رد scope و application مشترک؛ model0/cloud0/executableRepairTested=false و cleanup verified |

logها `auth-final-{build,typecheck,lint,domain,http,sandbox,guided,codex}.log` هستند. هیچ model/provider زنده، app، release یا database در این اصلاح ساخته یا تغییر نکرد. مجوز برنامه چندمرحله‌ای، تبار کامل artifact مشتق، connector اجرایی و همه پلتفرم‌ها هنوز پذیرش باز دارند.

## تطبیق ترکیب با UI ثبت‌شده در560cc68

همکار، UI و runner موبایل را جدا در560cc68ثبت کرد؛ هیچ hunk آن در commit backend stage نشد. کپی تازهٔ `.local/mcp-mission/combined-final` از index جاری شامل همان UI و اصلاح authorization ساخته شد.۲۷۰فایل runtime با index مطابق بودند؛ fingerprint `d46be52d8167deb5ca045e46acbf796f59e2286441c1d10505a757520780ee54` در `combined-final-identity.json` ثبت است. build و typecheck موفق؛ lint۲۶۶فایل صفرerror/۳۶warning/۹info موجود؛ HTTP۳۷/۳۷؛ guided۳۸حالت و `npm run test:mobile`۱۰حالت با صفرpageerror/external request گزارش‌شده، فونت واقعی Geist و shimmer پیش‌فرض گذشتند. logها `combined-final-{build,typecheck,lint,http,guided,mobile}.log` هستند.

روی این ترکیب، کل domain/sandbox/browser دوباره اجرا نشد؛ نتایج۳۱۶/۴/۳۸/Codex۳و نتایج قدیمی‌تر۹/۲۵۱در snapshotهای قبلی خودشان باقی می‌مانند. این بررسی هدف‌دار، پذیرش کامل محصول، همه UI یا دستگاه فیزیکی نیست. source/runtime جدید پس از شروع این بررسی تغییر نکرد و code/state اصلی برای تست بازراه‌اندازی نشد.
