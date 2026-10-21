# برنامه اجرایی Launchlane

آخرین وضعیت: ۲۰۲۶-۱۰-۲۱، Asia/Tehran. این فایل باید پس از هر مرحله به‌روزرسانی شود. وضعیت `done` فقط با شواهد پذیرش معتبر است. برنامه کار Coding Agent است؛ آماده‌سازی فعلی شامل پیاده‌سازی کل محصول نیست.

## وضعیت فعال

### مأموریت تجربه کاربر و اتصال حساب‌ها — پایه `0349c11`

بازتولید دستی با مرورگر واقعی روی production ایزوله، حساب مصنوعی و کلیدهای provider خالی در ۲۰۲۶-۱۰-۲۱؛ هیچ حساب واقعی یا هزینه‌ای مصرف نشد. در عرض 360×844، بالای دکمه بررسی پروژه دقیقاً 924px از ابتدای سند بود. پوشه ناموجود پیام عمومی INTERNAL_UNAVAILABLE داد. بررسی نمونه، بسته‌سازی و پورت دستی را نشان داد؛ نوسازی، profile و رفت‌وبرگشت بین ابزارها، نتیجه اختلال را پاک کرد. ورود محلی از اتصال حساب‌ها مستقل است، اما UI برای اتصال حساب اقدام قابل اجرا ندارد و نام‌های داخلی را نشان می‌دهد.

| Task | شدت / علت تأییدشده یا مرز تحقیق | معیار پذیرش این مرحله | وضعیت |
| --- | --- | --- | --- |
| UX60 | P0؛ ورودی متنی تنها مسیر انتخاب است؛ ENOENT از scanner به error عمومی می‌رسد | انتخاب‌گر واقعی و محدود پوشه سرور، لغو بدون پاک‌شدن انتخاب؛ خطای دقیق missing/access/invalid/empty؛ نمونه اختیاری | implemented_local؛ bounded server-folder dialog، ریشه مجاز/صفحه‌بندی، خطای typed و حفظ انتخاب قبلی؛ وضعیت نهایی چک‌ها در verification |
| UX61 | P0؛ اتصال/فهرست GitHub در UI موجود نیست؛ gh در PATH/دو محل معمول یافت نشد | یک روش رسمی قابل اجرا، هویت تأییدشده، repository/search/pagination/branch/subfolder/revision؛ دریافت محدود و بدون اجرای کد | investigation |
| UX62 | P0؛ Liara فقط وضعیت ثابت و بدون اقدام دارد؛ CLI رسمی 9.4.7 نصب است | spike ورود رسمی، تصمیم ایمن و مستند؛ اتصال با اعتبارسنجی فوری، تیم/app مجاز و قطع اتصال روشن؛ بدون جعل OAuth | investigation |
| UX63 | P0؛ profile و incident در state component هستند و بازیابی ندارند | جریان پایدار actor-bound در SQLite؛ بازیابی امن، تشخیص source قدیمی، URL/Back/Forward بدون secret و approval منقضی | ready |
| UX64 | P1؛ آماده‌سازی داخلی و هش‌ها/پورت بار تصمیم غیرضروری ایجاد کرده‌اند | آماده‌سازی محلی خودکار، port معتبر پیش‌فرض، فهرست قابل بررسی بدون هش اجباری؛ مقصد/هزینه/اثر همچنان واضح | ready |
| UX65 | P1؛ مسیر اصلی اختلال فقط scripted است؛ اتصال خاموش بن‌بست دارد | انتخاب برنامه متصل و نشانه، evidence واقعی در حد adapter موجود؛ تمرین اختیاری؛ نبود تحلیل/دسترسی بدون موفقیت جعلی | ready_after_connections |
| UX66 | P1؛ header/stepper/capabilities ثابت و CTA خارج viewport است | دو هدف روشن، فارسی قابل فهم، اتصال‌ها از وضعیت واحد، انتخاب پروژه در اولین viewport، keyboard/responsive/RTL و حذف health فنی از مسیر عادی | ready |

اولویت اجرا UX60/61/62/63 سپس UX64/65/66 است؛ قسمت‌های مستقل منتظر اتصال/اعتبار نمی‌مانند. gateهای هزینه/زیرساخت فعلی حفظ می‌شوند. اسکیل‌های مؤثر: ux-ui-agent-skills، web-design-guidelines، frontend-design، vercel-react-best-practices و competition-agent-engineer. شاهد دستی با CUA و تست‌های خودکار با server ایزوله ثبت می‌شوند؛ حساب واقعی، transport مصنوعی و blocker از هم جدا می‌مانند.

- P0 تمام شد: foundation و اسناد فنی اعتبارسنجی شده‌اند؛ شواهد در `docs/verification.md`.
- فاز فعال P1: مسیر محلی ورود→بررسی source→بسته خصوصی→پیشنهاد→تأیید/رد با UI و state پایدار قابل اجراست؛ gateهای اتصال زنده جدا هستند.
- session محلی، Host/Origin/CSRF، migration و approval اتمیک برای قرارداد محدود deploy/restart وجود دارند. executor زنده متصل نیست؛ همه writeها بسته‌اند.
- scope و دسترسی زنده Liara تأیید نشده‌اند. BoxAPI طبق خبر مالک فعال است و یک سازگاری محدود gpt-6-luna/none واقعاً سنجیده شد؛ کیفیت diagnosis و مبلغ کسرشده هنوز تأیید نشده‌اند.

## P0 — آماده‌سازی

| Task | هدف/محدوده | وابستگی | پذیرش/تست | وضعیت |
| --- | --- | --- | --- | --- |
| T00 | تعریف نیاز، محدوده، flow و پذیرش محصول | تحلیل نیاز کاربر | overview و AC01-16؛ تفکیک موجود/پیشنهادی/نامعلوم | done |
| T01 | foundation کم‌وابستگی و Git | T00 | install/lint/type/build/run/smoke، lockfile و secret exclusion؛ evidence در verification | done |
| T02 | اسناد فنی و برنامه قابل استفاده از checkout مستقل | T00,T01 | هر AC→task؛ لینک‌های فنی سالم؛ بازبین تازه بتواند مسیر بعدی و محدودیت‌ها را تشخیص دهد | done |
| T03 | قرارداد upstream و تصمیم‌های انتقال‌پذیر برای adapter و state | T00 | OpenAPI pinned، endpointها و unknownها ثبت؛ تصمیم/پیامد در ARCHITECTURE؛ بدون ادعای live | done |

## P1 — مسیر مستقل آفلاین، قرارداد و طراحی

| Task | هدف/محدوده | وابستگی | پذیرش/تست | وضعیت |
| --- | --- | --- | --- | --- |
| T10 | تکمیل DESIGN با flow، توکن و component state؛ UI یکپارچه با action/evidence | T02 | AC14؛ walkthrough، keyboard و responsive؛ بدون پالت پراکنده | implemented_offline؛ آزمون خودکار ۷ viewport/۲۳ حالت، walkthrough انسان تازه هنوز انجام نشده |
| T11 | API adapter interface و schemaهای ورودی/پاسخ از OpenAPI؛ fixture صادقانه | T03 | AC01,08,13؛ teamID، pagination، null، 401/429 و unit/time contracts؛ synthetic بودن صریح | partial_offline؛ readهای project/release/logs/events/applets/summary و probe امن، gate مستقل Liara؛ write و تطبیق زنده باقی است |
| T12 | تشخیص read-only یک اپ Node و archive manifest مجاز | T02 | AC02,03؛ runtime/port/env names؛ traversal/symlink/secret و no script execution | implemented_offline؛ manifest و tar.gz خصوصی، هش مستقل archive و approval v2؛ upload لیارا انجام نشده |
| T13 | operator session، policy، action immutable، approval و state SQLite | T02 | AC04,13,16؛ deny/expiry/replay/race/restart/storage-down؛ CAS پیش از write | implemented_offline؛ فقط deploy/restart، executor زنده و secret-reference برای env هنوز ساخته نشده |
| T14 | تعریف oracle و demo fixture برای deploy و incident؛ توسعه تست domain با ابزار مناسب | T11,T12 | AC05,09,11؛ golden و counterexample؛ commandهای واقعی به AGENTS اضافه شود | partial_offline؛ workload oracle، tool/result/terminal، خطای 500/اصلاح غلط/درست، تناقض و داده ناکافی؛ eval مدل/deploy زنده باقی است |

P1 شامل کدنویسی محصول توسط Coding Agent بعدی است. در صورت پایان قراردادهای مستقل، به علت نبود token کل پروژه متوقف نشود؛ اما وضعیت fake به live ارتقا نیابد.

## P2 — اتصال واقعی و اولین چرخه استقرار

| Task | هدف/محدوده | وابستگی | پذیرش/تست | وضعیت |
| --- | --- | --- | --- | --- |
| T20 | capability spike read-only لیارا با credential و scope مجاز | دسترسی Liara،T11 | AC01,08؛ scope/schema/time/unit و خطاهای واقعی؛ evidence sanitized؛ بدون write | blocked_live |
| T24 | smoke مدل/SDK و بودجه مستقل از اتصال Liara | دسترسی و budget مدل،T11 | AC09,13؛ tool protocol/schema، خروجی structured، terminal/error و مصرف واقعی؛ بدون fixture به‌جای live | compatibility_verified برای gpt-6-luna/none؛ دو snapshot موفق، هرکدام 2 درخواست/616 توکن؛ diagnosis و قطع پردازش provider پس از cancel هنوز تأیید نشده |
| T21 | انتخاب روش/پلن با منبع/قیمت فعلی و تأیید action | T12,T13,T20 | AC03,04؛ unknown price/budget سؤال/راهنمایی؛ تغییر args/source نیازمند consent تازه | not_started |
| T22 | upload source→release→observe→health روی app آزمایشی مجاز | T14,T21 | AC05؛ release واقعی و پاسخ workload؛ build fail/timeout/pending و unsafe path | not_started |
| T23 | انتشار نسخه بعدی و restart کنترل‌شده | T22 | AC06؛ release قبل/بعد، deny و عدم اثر روی app دیگر؛ readback | not_started |
| T25 | راهنمای دامنه و تفکیک API از registrar | T22 | AC07؛ مسیر واقعی با منبع معتبر و کار بیرون دسترسی مشخص؛ بدون ادعای اجرای DNS انجام‌نشده | not_started |

T20 و T24 مستقل‌اند؛ نبود مدل نباید مشاهده/آزمون provider را متوقف کند. T25 توسعه P1 است و شرط پذیرش هسته نیست. اگر endpoint یا schema با سند اختلاف داشت، ابتدا مرز adapter اصلاح و regression با پاسخ واقعی اضافه شود. شکست archive/deploy با افزودن framework/پایگاه‌داده جدید حل نمی‌شود مگر bottleneck اثبات شود.

## P3 — SRE و بستن حلقه اصلاح

| Task | هدف/محدوده | وابستگی | پذیرش/تست | وضعیت |
| --- | --- | --- | --- | --- |
| T30 | خواندن محدود logs/events/release/health/CPU/RAM و evidence panel | T11,T20 | AC08,14؛ app/time/unit، empty/unsupported؛ داده ناکافی به‌عنوان unknown | implemented_offline؛ collector با failure مستقل هر منبع و panel تمرینی؛ schema/unit/time و workload زنده وابسته به T20 |
| T31 | diagnosis مبتنی بر evidence و فرضیه رتبه‌دار | T14,T30,T24 | AC09؛ oracle 500، paraphrase، contradictory log، injection و redaction؛ کیفیت با مدل واقعی | implemented_offline_contract؛ چرخه محدود ابزار→snapshot→فرضیه، scope/citation/time/cancel/budget؛ UI scripted است؛ کیفیت و oracle مدل واقعی unverified |
| T32 | اصلاح دارای approval و verification همان symptom؛ بسته قبل/بعد | T13,T22,T31 | AC11؛ اصلاح واقعی/ناموفق، timeout و replay؛ success فقط با readback | partial_offline؛ مقایسه همان app/origin/path/time، اصلاح غلط 500 و متفاوت‌بودن healthz؛ env write/approval و اثر واقعی باقی است |
| T33 | سناریوی مستقل کندی/منابع و پیشنهاد بهینه‌سازی | T30,T31 | AC10؛ latency و مصرف هم‌شرایط؛ بدون ادعای علت قطعی از یک نمودار | not_started |
| T34 | handoff پاک‌سازی‌شده برای Coding Agent | T31 | AC12؛ reproduction، evidence، محدوده اصلاح و acceptance قابل فهم برای reader تازه؛ بدون فایل/command ساختگی | not_started |

T32 هسته است. T25، T33 و T34 توسعه‌های P1 هستند؛ فقط در صورت اجرا و سنجش، AC07/10/12 را پذیرفته گزارش کنیم. اتصال خودکار editor، auto-PR، rollback عمومی و DNS automation فقط پس از پذیرش هسته و زمان کافی بررسی شوند. handoff قابل کپی کافی است و به اتصال editor نیاز ندارد؛ قابلیت پیاده‌نشده در limitations بماند.

## P4 — بازبینی تازه و ارتقای کیفیت

| Task | هدف/محدوده | وابستگی | پذیرش/تست | وضعیت |
| --- | --- | --- | --- | --- |
| T40 | peer review روی revision قابل اجرا با سه ورودی تازه | T10,T23,T32 | هسته AC01-06/08/09/11/13/14 و هر توسعه اجراشده؛ reader از demo نویسنده تقلید نکند؛ reproduction/شدت/مرز خراب/اصلاح/regression | not_started |
| T41 | رفع شکست‌های اثرگذار، UX و مصرف؛ self-review diff | T40 | lint/type/build/domain/browser/live gate مربوط؛ baseline هم‌شرایط؛ بدون feature بی‌آزمون | not_started |

بازبینی روی revision قابل اجرا با شواهد و روش reproduction انجام شود. ابتدا شکست‌های core، ایمنی و مسیر کاربر رفع شوند؛ معماری تازه فقط با ضرورت اثبات‌شده وارد شود.

## P5 — آماده‌سازی نسخه قابل تحویل

| Task | هدف/محدوده | وابستگی | پذیرش/تست | وضعیت |
| --- | --- | --- | --- | --- |
| T50 | README نهایی معماری/API/تعامل/limits و setup از checkout تمیز | T41 | AC15,16؛ دستورات واقعی، نسخه و real/simulated واضح؛ هیچ وابستگی به فایل محلی خارج Git | not_started |
| T51 | اجرای سناریوی واقعی end-to-end و ثبت evidence پاک‌سازی‌شده | T50 + دسترسی مجاز | AC05,09,11,15؛ trace درخواست→approval→اثر→readback؛ reproduction روی candidate مشخص؛ failureها محفوظ | not_started |
| T52 | بازبینی candidate و محدوده انتشار فنی | T51 | AC15,16؛ diff/secret scan، config و revision ثبت؛ visibility و تغییرات خارجی فقط طبق اختیار مالک | not_started |

## تصمیم‌های مهم

| تصمیم | وضعیت/دلیل | بازنگری در چه شرایطی؟ |
| --- | --- | --- |
| D1 وب‌اپ واحد و TypeScript | foundation ساخته شد؛ UX و API یکجا | فقط اگر spike محدودیت اساسی نشان دهد |
| D2 operator-local | دسترسی ساده‌تر به source و scope محدود | نیاز واقعی میزبانی remote بعد از طراحی auth |
| D3 یک runtime محدود | از چندعاملی/queue بی‌دلیل جلوگیری می‌کند | benchmark همان مسئله سود delegation را نشان دهد |
| D5 SQLite native | implemented_offline روی Node 24.18؛ migration checksummed، attempt پایدار و claim اتمیک | نیاز چند process یا خطای واقعی storage |
| D6 مدل/SDK | BoxAPI با transport مستقیم chat-completions و بدون SDK تازه؛ gpt-6-luna/none smoke سازگاری را گذراند، کیفیت diagnosis unverified است | oracle واقعی و مصرف، تعیین‌کننده مدل diagnosis هستند |
| D7 Biome | dependency lint ساده‌تر و حذف advisoryهای dev مسیر اولیه ESLint | صرفاً با نیاز اثبات‌شده |

## قالب به‌روزرسانی هر مرحله

برش اختلال روی پایه `7af1b76`: AC08/09/11/13/14؛ collector و diagnosis runtime محدود با transport مصنوعی، تمرین scripted و مقایسه symptom ساخته شدند. 42 domain، 9 HTTP و 51 حالت مرورگر/7 عرض، lint/type/build pass؛ real provider request تازه 0. محدودیت‌های live، persistence incident و env/write در verification باقی‌اند. Skillهای مؤثر competition-agent-engineer و ux-ui-agent-skills؛ مرحله بعد مرز secret-reference و عملیات ماندگار است.

برش جاری T11/T30 روی پایه `7db15be`: read contracts و probe با DNS pin، redaction و live gate مستقل ساخته شدند؛ 36 domain و 8 HTTP، lint/type/build pass. هیچ تماس تازه Liara/مدل وجود ندارد؛ شواهد و failureهای اصلاح‌شده در verification ثبت‌اند. جمع‌آوری evidence و تشخیص/verification آفلاین در ادامه‌اند.

```text
زمان و Task/Phase:
revision/config و acceptance IDs:
رفتار تغییرکرده و دلیل:
فرمان‌ها، pass/fail/skip و artifact:
real provider/tool/deploy یا simulated:
failure/ابهام و ریسک باقی‌مانده:
کار بعد، وابستگی و شرط پایان:
```

## جلسه آماده‌سازی — ۲۰۲۶-۱۰-۲۱

scaffold Next/TS، health صریح و smoke محلی ساخته شد. قرارداد upstream از OpenAPI ثبت شد؛ adapter هنوز ساخته نشده است. Biome جای پیکربندی اولیه lint را گرفت تا dependencyهای اضافی حذف شوند. نصب تمیز، lint/type/build، اجرای dev/production و 2 smoke محلی موفق‌اند؛ نتیجه دقیق در `docs/verification.md` ثبت شده است. بازبینی مستقل اسناد، ابهام بازیابی write و دو وابستگی نادرست برنامه را شناسایی کرد؛ هر سه اصلاح و بازخوانی شدند. مستندات فنی از فایل‌های محلی و یادداشت‌های داخلی مستقل‌اند. هیچ deploy، تغییر زیرساخت یا درخواست مدل اجرا نشده است.

## P1 — برش session و approval ماندگار

۲۰۲۶-۱۰-۲۱؛ AC04/13/16؛ baseline `f6d7f7f` + working tree همین برش. Skillهای مؤثر: competition-agent-engineer و codebase-memory (Tier 2 با source fallback برای coverage قدیمی/excluded).

`node --test tests/domain/state.test.ts`: هفت آزمون موفق، بدون fail/skip؛ از جمله دو connection مستقل SQLite در worker، قطع process، lost write response، expiry/replay و storage/migration failure. gate خاموش با صفر فراخوانی provider و عدم مصرف approval بررسی شد. هیچ provider واقعی یا هزینه‌ای مصرف نشد.

API ورود و workspace، کوکی HttpOnly/Strict با انقضای یک ساعت و revoke پایدار، rate limit، action immutable و audit حداقلی ساخته شدند. attempt پیش از callback provider commit می‌شود؛ recovery فقط executing را uncertain می‌کند و observing را به write تبدیل نمی‌کند. متعارض‌های همان app تا تعیین نتیجه بسته‌اند. اجرای چند process، env secret-reference و write زنده هنوز تأیید/پیاده نشده‌اند. مرحله بعد: source manifest، قرارداد transport و UI با آزمون HTTP/مرورگر روی candidate نهایی همین سری.

## P1 — برش source و provider contract آفلاین

پایه امنیت: `917819a` + working tree همین برش؛ AC02/03 و بخش آفلاین AC01/08/13/16. Skill مؤثر competition-agent-engineer؛ مرجع runtime/evaluation. BoxAPI host و chat endpoint از مستند رسمی دوباره خوانده شدند؛ ساختار tool-call قرارداد انتخابی سازگار با Chat Completions است و روی BoxAPI واقعی تأیید نشده است.

`node --test tests/domain/*.test.ts`: بیست آزمون موفق، 0 fail/skip. `node --test tests/http/*.test.mjs` روی build تولیدی ایزوله: شش subtest + یک parent موفق؛ scope مصنوعی، بدون کلید واقعی و بدون provider. lint/typecheck موفق. نمونه کنترل‌شده به‌طور محلی نشان داد liveness=200 می‌تواند کنار workload=500 باشد، تغییر نامرتبط 500 را حفظ کند و env درست همان workload/revision را به 200 برساند. این آزمون کیفیت diagnosis مدل یا deploy لیارا نیست.

scanner تنها فایل‌های مجاز زیر workspace را می‌خواند؛ سقف ۱۰۰۰ فایل، ۵۰۰۰ entry، عمق ۱۰، ۵۱۲ KiB هر فایل و ۲۰ MiB کل. traversal/junction، secrets، script execution و source تغییریافته آزموده شدند. پورت/env به‌صورت static و محافظه‌کار استخراج می‌شوند؛ تحلیل عمومی framework/AST نیست. هیچ archive ایجاد نشده است.

release read با teamID/page/count و null/time fixture، metric=unknown تا اثبات unit/time، redaction و BoxAPI gate/budget/terminal/cancel ساخته شدند. gate خاموش هم در state و هم model transport صفر upstream دارد. write adapter، health probe شبکه‌ای، ابزار env و live integration همچنان بسته/اجرانشده‌اند. مرحله بعد: تثبیت UI و setup قابل اجرای همین candidate؛ سپس پیشبرد قراردادهای لازم برای اولین اتصال مجاز.

## P1 — رابط عملیاتی و بازتولیدپذیری

پایه server: `de06ac7` + working tree این برش؛ AC14 و بخش آفلاین AC15/16. Skills مؤثر: frontend-design، vercel-react-best-practices، webapp-testing و قواعد accessibility/RTL از ux-ui-agent-skills. `pr-evidence` با دستور مالک کنار گذاشته شد؛ تغییرات روی main و بدون PR/push هستند.

فرم ورود، بررسی/لغو source، facts/unknownها، manifest محدود با keyboard scroll، app allowlist، پورت و ساخت پیشنهاد، تأیید/رد و history پایدار به API واقعی محلی وصل‌اند. پلن/قیمت، upload/deploy و diagnosis انجام‌نشده صریح‌اند. setup فقط local credential ایجاد می‌کند و مقدار آن را چاپ نمی‌کند. پس از درخواست مالک، IRANYekan محلی و زبان بصری تیره نزدیک Liara جای پالت اولیه را گرفتند.

`npm run build` موفق؛ `npm run test:browser` روی production ایزوله، ۱۱ حالت در ۶ عرض و متن ۲۰۰٪، بدون overflow صفحه، browser error، external request یا axe violation در حالت‌های سنجیده‌شده. reject/approve، source error، focus و لغو واقعاً از UI اجرا شدند. حالت‌های live و screen reader انسانی تأیید نشده‌اند. `docs/verification.md` نتیجه candidate نهایی و failureهای اصلاح‌شده را نگه می‌دارد.

## T24 — اولین سازگاری واقعی BoxAPI

پایه `fec8938` + اصلاح transport/config همین برش؛ مدل `gpt-6-luna`، Chat Completions، `reasoning_effort=none`، output cap=512، فقط داده مصنوعی. دو درخواست اول با 400 رد شدند؛ درخواست نخست جزئیات نداشت و درخواست تشخیصی بعدی علت reasoning پیش‌فرض را نشان داد. retry خودکار و تغییر مدل/provider انجام نشد.

پس از اصلاح پارامتر، دو درخواست 200 در ۱۰٫۵۰۵ ثانیه، مجموع ۶۱۶ توکن گزارش‌شده دادند: tool call واقعی→result همان ID→JSON نهایی با app/evidence/status/outcome درست. preflight cancel صفر upstream اضافه داشت. هزینه واقعی حساب، مصرف خطاهای اولیه و توقف پردازش provider پس از لغو unverified هستند. فایل‌های خام sanitize شده فقط `.artifacts/model/` می‌مانند؛ خلاصه فنی در verification. CLI نهایی به دو request محدود و از automatic check خارج است؛ فهرست مجاز مدل و خطای 400/422 نیز در server enforce می‌شوند. آزمون fixture رگرسیون `reasoning_effort=none` را کنترل می‌کند.

snapshot جدا روی `a697eba`، دو پاسخ 200 و همان oracle را در ۲۵٫۱۰۴ ثانیه و ۶۱۶ توکن گزارش‌شده گذراند؛ با snapshot قبلی یک benchmark ترکیبی ساخته نمی‌شود. گام live Liara به دسترسی PaaS، اعتبار و app آزمایشی مجاز نیاز دارد. فعلاً طبق درخواست مالک کار آفلاین ادامه دارد؛ ساخت app اکنون لازم نیست. app بعدی هدف تست چرخه محصول است و با میزبانی خود Launchlane فرق دارد.

## P1 — بسته source و approval متصل به artifact

پایه `a697eba` + working tree این برش؛ AC02/04/13/14/16. Skills مؤثر: competition-agent-engineer (runtime/evaluation)، قواعد accessibility/RTL از ux-ui-agent-skills و webapp-testing. گراف قابل دسترسی شد اما generation همان `2026-10-21T14:08:53Z` و فایل‌های تازه not_tracked بودند؛ source، importها، route→use case→capture→archive→storage→policy و تست‌ها مستقیم بررسی شدند.

ساخت بسته محلی مستقل از اتصال/app است. manifest و archive از یک capture محدود می‌آیند؛ نام فارسی/مسیر بلند، exclusion، content hash، snapshot ثابت و بازخوانی bytes بررسی می‌شوند. SQLite migration 2 append-only، receipt actor-bound و ActionSpec v2 اضافه شد. v1 بدون تغییر hash خوانده می‌شود ولی deploy آن پیش از provider مسدود است. فایل گم‌شده/تغییریافته یا receipt ناموجود پیش از claim متوقف می‌شود. adapter تنها buffer مورد تأیید را می‌گیرد؛ API زنده هنوز null است.

اعتبارسنجی و artifactهای این برش در `docs/verification.md` ثبت می‌شوند. هیچ درخواست تازه مدل یا Liara در این برش وجود ندارد. گام بعد مستقل: قرارداد logs/events/evidence و probe امن برای T30/T31؛ اتصال زنده T20 همچنان به آماده‌شدن همان سرویس وابسته است. پاک‌سازی خودکار archive، env secret-reference و deploy/diagnosis/correction واقعی باقی‌اند.

تثبیت روی `7ba2a2a`: export تمیز Git، `npm ci`، setup بدون کلید provider، build، 26 domain، 8 HTTP (با parent) و 23 حالت مرورگر در 7 عرض، همگی pass و بدون skip. لینک‌های 9 سند/20 مسیر و 11 build trace بدون وابستگی به فایل خصوصی بودند. رکورد و تصویر همین candidate در verification مشخص است. این نتیجه بازتولید مسیر آفلاین است؛ T20/T22/T31/T32 را live پذیرفته نمی‌کند.
