# برنامه اجرایی Launchlane

آخرین وضعیت: ۲۰۲۶-۱۰-۲۲، Asia/Tehran. این فایل باید پس از هر مرحله به‌روزرسانی شود. وضعیت `done` فقط با شواهد پذیرش معتبر است. برنامه کار Coding Agent است؛ آماده‌سازی فعلی شامل پیاده‌سازی کل محصول نیست.

## وضعیت فعال

### رفع ورود توسعه، hydration و کشف مسیر دستیار — verified_local

اصلاح runtime/RTL در `ff8c11a` ثبت شد. ورود واقعی نصب اصلی، سه read پس از ورود و بازیابی نتیجه در مرورگر 200 شدند؛ schema به 7 رسید و checksumهای 1–6 و شش action تاریخی حفظ شدند. تست تازه domain159/159، HTTP18/18، typecheck/lint/build و مرورگر عمومی75 حالت با تزریق marker RTL و صفر خطای hydration/external pass شدند. دکمه توضیح هوشمند در حالت disabled با علت روشن باقی می‌ماند؛ فعال‌سازی مدل، چت عمومی یا write تازه انجام نشد. شواهد و حدود در verification هستند.

پایه `429db8c`؛ AC13/14/16 و کشف مسیر AC09. بازتولید روی dev نصب اصلی: POST/session=200 ولی workspace/project-flows/incidents=503؛ DB readOnly migrationهای 1–6 و جدول restart_progress غایب، در حالی که کد v7 را می‌خواند. runtime سراسری پس از HMR بدون کنترل نسخه بازاستفاده می‌شود. پذیرش: نسخه ناسازگار cache با خطای قابل اقدام بسته شود، recovery حین HMR تکرار نشود، تنظیمات gate تازه اعمال شوند، restart محدود همین dev server و سپس ورود/میز کار از مسیر مرورگر تأیید شود؛ DB/تاریخچه حفظ شود. هشدار root، class اضافی rtl-enabled در HTML فارسی را نشان می‌دهد؛ source فعلی تولیدکننده آن نیست و منشأ افزونه هنوز تأیید نشده است. SSR/کلاینت برای همین class همسان شوند، بدون suppressHydrationWarning عمومی. مسیر توضیح هوشمند و غیرفعال‌بودنش آشکار شود، بدون چت/اتصال یا مصرف نمایشی. هیچ درخواست واقعی مدل یا write زیرساخت مجاز این برش نیست.

### T33 — اندازه‌گیری محدود کندی؛ partial_local

هسته در `9033250` commit شد؛ UI و گزارش همان اندازه‌گیری را مصرف می‌کنند. domain تازه 157/157، typecheck/lint/build و HTTP17 pass؛ مرورگر عمومی تازه 75 حالت، انتشار27، restart27 و دامنه22 با مرز هر run و تصاویر در [verification](docs/verification.md) ثبت‌اند. نتیجه کندی و سری ناقص با SQLite بازیابی می‌شوند، خطای آخر سری پنهان نمی‌شود و hash داخلی نمایش داده نمی‌شود. بخش باقی‌مانده AC10 شامل منابع واقعی با واحد/زمان معتبر، تشخیص واقعی مدل و before/after زنده هم‌شرایط است؛ هیچ ادعای پذیرش کامل T33 نداریم. مرحله مستقل بعد: بازبینی candidate با ورودی تازه و regressionهای T40/T41، بدون بازکردن سهم چرخه‌های زنده قبلی.

پایه `1814eec`؛ AC10/13/14. بررسی source جاری پس از graph نسل stale نشان داد collector فقط یک GET و duration ثبت می‌کند؛ مسیر «کند شده است» هنوز سری قابل مقایسه ندارد و CPU/RAM عمداً به‌دلیل واحد/زمان نامعتبر unknown هستند. شدت P1: یک پاسخ 200 یا یک زمان، شاهد کافی رفع کندی نیست. پذیرش برش: سه GET ترتیبی و محدود از همان صفحه، بدون ورود/cookie، ثبت زمان/واحد/روش، هویت داخلی app و fingerprint پاسخ برای رد مقایسه نامربوط؛ مقایسه فقط نمونه‌های هم‌روش با پاسخ یکسان و زمان مرتب. timeout/redirect/بودجه/لغو به زمان صفر یا بهبود تبدیل نشوند؛ داده منبع ناموجود unknown بماند. نتیجه محدود به نمونه‌هاست؛ p95، ظرفیت، علت قطعی CPU/RAM یا اثر تغییر پلن نتیجه نمی‌شود. UI/گزارش اصلاح و بازیابی باید همین معنا را حفظ کنند. oracle مستقل روی HTTP محلی کنترل‌شده و regression با تغییر نامرتبط، پاسخ متفاوت، واحد/زمان غلط و نمونه ناکافی اجرا می‌شوند. provider/model خاموش‌اند؛ سنجش واقعی منابع لیارا و کیفیت تشخیص مدل خارج این برش و همچنان UNCONFIRMED هستند. اسکیل‌های مؤثر: competition-agent-engineer و ux-ui-agent-skills؛ قواعد React و دسترس‌پذیری برای رابط اعمال می‌شوند.

بررسی setup مستقل روی `90e392a`، همان source چرخه زنده `7917816` با اسناد تکمیل‌شده، از export tracked بدون env/DB/context خصوصی گذشت: install/setup/typecheck/build، domain147، HTTP17 و bootstrap2 تازه pass؛ providerها خالی و gateها خاموش. ۱۱ فایل client با کلیدهای setup match نداشتند؛ server و پوشه موقت حذف شدند. این شاهد clone GitHub، reader تازه یا revision نهایی تحویل نیست؛ جزئیات در verification ثبت است.

### چرخه زنده مستقل T21/T22/T23 — بسته‌شده روی 7917816

مجوز صریح چرخه تازه با سقف ۵۰۰۰ تومان، یک release و یک restart، بدون مدل و حذف حداکثر تا ۲۰ دقیقه دریافت شد. نام app پیش از ساخت خالی و تیم/پلن/شبکه/اعتبار دوباره خوانده شدند؛ حساب، SQLite، نشست و journal چرخه جدا بودند و سهم قبلی بازنشانی نشد. یک upload و یک انتشار v5 با Node صریح 22 به `/identity`/200/`restart-v1` رسید؛ runtime واقعی از process.versions.node برابر 22.23.3 بود. READY با 404/503 به موفقیت تبدیل نشد؛ تنها خواندن همان release ادامه یافت و بازخوانی دوازدهم معیار دقیق را گذراند. incident واقعی `/orders`، 500 بود. پیشنهاد restart نخست رد شد و attempt نداشت؛ پیشنهاد تازه v6 تأیید و یک POST بدون body با HTTP 200 پذیرفته شد. همان release و صفحه پس از آن همچنان 500 بود؛ action درست `failed/unhealthy` شد و رابط واقعی، رفع مشکل یا پایان restart را ادعا نکرد. شناسه فرایند در مشاهده فوری عوض نشده بود؛ completion همچنان UNCONFIRMED است.

برنامه پس از 180575ms، حدود سه دقیقه، با یک DELETE حذف و نبودنش با API تأیید شد. اختلاف موجودی مشاهده‌شده 1145.8 تومان بود؛ تأخیر صورتحساب و انتساب قطعی هزینه باز است. model=0؛ create/upload/release/restart/delete هرکدام 1. بازبینی readOnly، دو attempt محصول، نبود اقدام ناتمام، migrationهای 1–7 در DB چرخه و نبود token خام در آن/۱۱ فایل client را سنجید. DB نصب اصلی همچنان migrationهای 1–6، شش attempt قبلی، apps خالی و هر سه gate خاموش داشت؛ دو checksum اولیه ثابت‌اند. source candidate پس از شروع چرخه تغییر نکرد. [گزارش فنی](docs/evidence/restart-live-cycle.md) و [verification](docs/verification.md) مرز دقیق شواهد زنده/محلی را دارند. قیمت داخل محصول، env write، app دوم، کیفیت عمومی مدل، T33 و reader/review تازه بازند؛ یک پذیرش restart، کل AC06 را پذیرفته نمی‌کند.

### T25 — راهنمای دامنه برای مقصد انتخاب‌شده؛ implemented_local / DNS_live_unverified

پایه `48addbf`؛ AC07/13/16. در مرورگر production ایزوله، مسیر ورود ← بررسی پروژه نمونه ← مقصد انتشار طی شد؛ راهنما یا اقدام اتصال دامنه وجود ندارد. graph نسل ۲۰۲۶-۱۰-۲۱ برای این مسیر stale بود و source جاری رابط/API بررسی شد. شدت P1: کاربر پس از انتشار، مسیر ثبت دامنه در برنامه، تنظیم DNS و فعال‌کردن اتصال امن را نمی‌بیند. علت، نبود همین جریان است؛ ثبت نشانی بررسی سایت، اتصال دامنه یا اثبات مالکیت نیست.

پذیرش برش: راهنمای اختیاری برای نام دامنه معتبر، انتخاب حفظ DNS موجود یا استفاده از DNS لیارا، مقصد actor/team/app معتبر و امکان راهنمای عمومی بدون اتصال؛ مقادیر رکورد و نیم‌سرور حدس زده نشوند، کار registrar/ایرنیک روشن بماند و هیچ مرحله انجام‌نشده موفق نمایش داده نشود. تولید راهنما نباید credential باز کند، provider/DNS/model را فراخوانی کند، نشانی مجاز probe یا approval را تغییر دهد. خطای فیلد، تغییر مقصد، قطع اتصال، cancel/error و keyboard/RTL/عرض‌های 360/768/1280 و مرزهای مرتبط سنجیده می‌شوند. اسکیل‌های مؤثر: competition-agent-engineer، ux-ui-agent-skills، frontend-design، vercel-react-best-practices و web-design-guidelines. اتصال زنده دامنه و reader تازه تا آزمون جداگانه UNCONFIRMED می‌مانند.

قرارداد typed، اعتبارسنجی IDNA/hostname، تطبیق actor/team/app/internal ID و route دارای CSRF پیاده شدند. راهنمای عمومی حالت‌های بدون اتصال/نیازمند ورود مجدد/بدون برنامه را جدا می‌کند و فقط وضعیت تأییدنشده دارد. آزمون اولیه پایان‌خط پنهان‌شده توسط trim را یافت؛ ورودی اصلی و counterexample حفظ و علت در ترتیب validation اصلاح شد. lint135/typecheck/build pass؛ domain147 و HTTP17 تازه pass، بدون fail/skip/cancel. هفت regression اختصاصی نام بین‌المللی، IP/URL/control، پسوند مستند غیرمجاز، دامنه actor، تغییر مقصد و عدم تغییر probe/approval را سنجیدند. transport مدل/provider مصنوعی مصرف نشد؛ upstream در آزمون راهنما صفر است. این نتایج مرحله backend هستند؛ نتیجه رابط در بند بعد آمده است.

رابط اختیاری و چهار گام دارای منبع رسمی پیاده شدند. فرم، مقصد و راهنما از مسیر واقعی HTTP می‌آیند؛ حالت عمومی بدون حساب نیز قابل استفاده است. خطای فیلد، cancel/error با حفظ نتیجه معتبر، تغییر مقصد با حفظ نام، بازگشت focus از حساب‌ها، IDN، دامنه طولانی و متن 200٪ سنجیده شدند. lint137/typecheck/build pass؛ سه مجموعه browser عمومی68/انتشار27/restart27 پیش از اصلاح scoped فاصله focus pass و مجموعه اختصاصی دامنه22/9 عرض پس از آخرین اصلاح تازه pass شدند؛ همه در محیط ایزوله با حساب مصنوعی. مرور دستی 360/768/1280 و تصاویر نیز بررسی شدند. focus بالای viewport در بازبینی تصویری بازتولید، با assertion شکست‌خورده ثبت و با scroll-margin توکن‌شده اصلاح شد. هیچ اتصال DNS/حساب واقعی یا provider/model request در این برش انجام نشد؛ reader تازه و اتصال واقعی دامنه بازند.

### T34 — گزارش قابل تحویل برای اصلاح کد؛ implemented_local / reader_unverified

پایه `4a01dfb`؛ AC12/13/14. بازتولید در کد: incident و نتیجه بازخوانی پایدارند، اما route یا کنترل دریافت گزارش برای برنامه‌نویس وجود ندارد. شدت P1: کاربر برای انتقال مسئله باید شواهد و محدودیت‌ها را دستی کنار هم بگذارد. پذیرش این برش: خروجی actor-bound از همان گزارش ذخیره‌شده، تفکیک نمونه/حساب متصل و مشاهده/فرضیه، روش تکرار همان صفحه، شواهد دارای زمان و ارجاع، محدوده اصلاح و معیار بررسی؛ بدون فایل/دستور حدسی، secret یا ارسال خودکار به بیرون. آخرین مشاهده معتبر restart نیز باید با گزارش رابط یکسان باشد؛ پذیرش درخواست و پایان restart یکی نشوند. پیش‌نمایش و دانلود اختیاری با keyboard، حالت خطا/لغو و عرض‌های 360/768/1280 بررسی می‌شوند. credential و داده خام اضافی صادر نمی‌شوند؛ هیچ فراخوانی provider، تغییر زیرساخت یا مصرف مدل لازم نیست. اسکیل‌های مؤثر: competition-agent-engineer، ux-ui-agent-skills، vercel-react-best-practices و web-design-guidelines. آزمون حساب واقعی و فهم گزارش توسط reader تازه، ادعای این برش نیستند.

server، پیش‌نمایش فقط‌خواندنی و دانلود واقعی فایل پیاده شدند. آخرین پاسخ و وضعیت درخواست نامعلوم جدا صادر می‌شوند؛ restore حتی بیرون 20 اقدام اخیر آن مشاهده را حفظ می‌کند و row/approval قدیمی تغییر نمی‌کند. lint131/typecheck/build pass؛ domain140 و HTTP16 تازه pass؛ browser تازه 68 حالت/11 عرض عمومی، 27 حالت/6 عرض انتشار و 27 حالت/8 عرض restart pass. هفت case گزارش، actor/credential/injection، query، نمونه، داده ناکافی/کندی، حجم، پاسخ گم‌شده و counterexample همان app/page/origin را سنجیدند. keyboard، cancel/error با حفظ فایل، انقضای ورود و بازگشت همان incident، download برابر پیش‌نمایش و متن 200٪ در مرورگر ایزوله گذشتند. مرور دستی 360/768/1280 و دریافت فایل نمونه انجام شد؛ providerها مصنوعی و هیچ اعتبار/عملیات واقعی تازه مصرف نشد. race اندازه‌گیری ردیف جایگزین‌شده GitHub در test با انتظار انتخاب کامل پوشه اصلاح شد؛ معیار هندسه ضعیف نشد و شاهد شکست محفوظ است. شکست مستقل bad-port در oracle workload نیز با allocator محدود مشترک، حفظ معیار و regression همسایه مجاز در e5f5fd5 اصلاح شد. candidate کد `2975375` از export مستقل tracked با install/setup/type/build/domain140/HTTP16/bootstrap2 تازه گذشت. تولید گزارش از incident واقعی ذخیره‌شده 500→200 نیز آفلاین در SQLite موقت گذشت؛ DB اصلی readOnly ماند. reader تازه و جمع‌آوری زنده تازه این candidate هنوز تأیید نشده‌اند.

### T23 — راه‌اندازی دوباره با تأیید و بازخوانی؛ partial_live / completion_unverified

برش اولیه قراردادی، پایه `12805b8`؛ AC04/06/13/14/16. بازتولید: operation قدیمی restart در policy و آزمون state وجود دارد، ولی route اجرا فقط به deployment و رسید release متصل است؛ adapter و مسیر عادی رابط برای restart وجود ندارند. قرارداد OpenAPI و CLI رسمی 9.4.7 فقط پذیرش درخواست را مشخص می‌کنند و شناسه/شاهد پایان restart ندارند. پذیرش این برش: پیشنهاد مستقل متصل به actor/account/team/app داخلی، نسخه فعلی و همان بررسی مشکل؛ تأیید اتمیک و attempt پایدار پیش از یک POST بدون retry؛ لغو/timeout/پاسخ گم‌شده به uncertain و بدون replay؛ بازخوانی همان صفحه و نسخه با حفاظت SSRF و تفکیک «درخواست پذیرفته شد»، «صفحه پاسخ می‌دهد» و «پایان restart اثبات نشده». پاسخ 2xx سایت جای شاهد پایان restart نیست. تغییر حساب/برنامه/نسخه/بررسی، تأیید قبلی را باطل کند؛ نتیجه و اقدام بعد پس از reload حفظ شوند. آزمون‌های transport/SQLite/HTTP/browser ایزوله و responsive لازم‌اند. اسکیل مؤثر: competition-agent-engineer؛ برای رابط ux-ui-agent-skills و قواعد React/دسترس‌پذیری به‌صورت هدفمند استفاده می‌شوند. سهم سه release و آزمون زنده قبلی مصرف شده است؛ این برش هیچ درخواست واقعی provider یا هزینه تازه ندارد و پذیرش زنده restart باز می‌ماند.

قرارداد server، route، transport بدون retry، journal مستقل و UI کامل پیشنهاد/تأیید/اجرا/بازخوانی پیاده شدند؛ hash/canonicalization v1–5 محفوظ‌اند. زمان دریافت HTTP و پایان بازخوانی جدا ثبت می‌شوند؛ شاهد تازه همان صفحه به گزارش اصلی می‌رسد و توضیح علت اولیه حفظ می‌شود. lint/typecheck/build pass؛ domain تازه 132/132 و HTTP تازه 16/16. browser تازه 55 حالت/9 عرض عمومی، 27 حالت/6 عرض انتشار و 26 حالت/8 عرض restart، شامل انقضا، رد، شکست پیشنهاد، پاسخ 500/200، قطع انتظار، reload، ناوبری و متن 200٪ گذشت. key تکراری React و overflow واقعی 280/200٪ از failure اولیه اصلاح و caseها حفظ شدند. مرور دستی 360/768/1280، رد با keyboard، focus و Back/reload انجام شد. providerها مصنوعی، SQLite/HTTP واقعی محلی‌اند؛ هیچ اعتبار تازه مصرف نشد. محدودیت پذیرش/پایان در ADR 0003 و شواهد دقیق در verification هستند. در آن revision، live restart به مقصد و مجوز تازه نیاز داشت. چرخه جداگانه تأییدشده بعدی در بند زیر ثبت شد؛ معیار پایان عملیات همچنان باز است.

candidate کد در `0738e91` از export مستقل tracked، بدون env/DB/context خصوصی، با npm ci/setup/typecheck/build و domain132/HTTP16/bootstrap2 تازه گذشت. clean GitHub clone، reader تازه و revision نهایی تحویل هنوز سنجیده نشده‌اند؛ جزئیات در verification. DB و gateهای محیط کاری با audit readOnly حفظ شدند.

### UX67 — خوانایی پیشنهاد در تبلت؛ implemented_local

پایه `69f1705`؛ AC14. در مرور واقعی با نمونه ثابت، عرض 768/client=753، ستون اصلی فقط 409.22px و کارت پیشنهاد تأییدشده 1158.61px ارتفاع داشت؛ پایین ستون کمکی فضای خالی می‌ماند. پذیرش: ستون اصلی در تبلت عرض در دسترس را بگیرد، چیدمان دسکتاپ حفظ شود، keyboard/focus و داده/اقدام تغییر نکنند؛ 360/768/1280 و مرز 959/960، متن 200٪ و سناریوهای قبلی بررسی شوند. تغییر محدود به breakpoint میز انتشار است؛ ورود و گزارش اختلال بازطراحی نمی‌شوند. اسکیل‌های مؤثر: frontend-design، ux-ui-agent-skills و web-design-guidelines؛ پالت و توکن‌های موجود حفظ می‌شوند.

پس از تغییر مرز دو ستون از 768 به 960، همان ستون 689px و پیشنهاد 911.67px شد؛ client/content همچنان 753/753 بود. مرز 959/960 دستی و screenshotهای قبل/بعد دیده شدند. lint/typecheck/build pass؛ browser تازه 55 حالت/9 عرض و 27 حالت/6 عرض انتشار، شامل متن 200٪ در 360/768/959/960، بدون overflow/axe violation/browser error/external request در حالت‌های سنجیده‌شده گذشت. domain89/HTTP15 مربوط به پایه 69f1705 هستند؛ برای تغییر صرف CSS بازاجرا نشدند. providerها مصنوعی و هیچ اعتبار واقعی مصرف نشد. حدود کامل در verification هستند.

### T21 — نسخه Node در پیشنهاد و انتشار؛ bounded_live_Node22 / other_versions_unverified

پایه `667227b`؛ AC02/03/04/05/13. بازتولید در کد: `engines.node` خوانده می‌شود ولی release فقط sourceID/port/type می‌فرستد و نسخه را به پیش‌فرض provider واگذار می‌کند. قرارداد مستند فعلی و CLI رسمی 9.4.7، `liara.json:node.version` و `platformConfig.version` را دارند. پذیرش این برش: حل deterministic محدوده semver و تنظیم صریح بدون اجرای کد؛ تعارض/نسخه نامعتبر پیش از provider متوقف شود؛ نسخه انتخابی در approval نسخه جدید بسته و همان مقدار ارسال شود؛ canonicalization v1–4 و بازخوانی تاریخچه حفظ شوند؛ محدوده جزئی patch و نبود تست زنده نسخه‌های دیگر صریح بمانند. سه release سهم آزمون قبلی مصرف شده‌اند؛ این برش فقط با transport مصنوعی و صفر مصرف اعتبار سنجیده می‌شود. اسکیل‌های مؤثر: competition-agent-engineer، ux-ui-agent-skills و vercel-react-best-practices.

پیشنهاد v5، parser مشترک نسخه مجاز، حل server-only با semver pinned و field صریح انتشار پیاده شدند؛ مقدار جعل‌شده یا تغییر فایل‌ها تأیید قبلی را دور نمی‌زند. regression اولیه نبود platformConfig را نشان داد و پس از اصلاح pass شد. lint/typecheck/build، domain تازه 89/89، HTTP تازه 15/15 و مرورگر تازه 55 حالت/9 عرض + 22 حالت/4 عرض pass. بررسی دستی نمونه ایزوله در 360/768/1280، تأیید با keyboard، بازیابی و علت بسته‌بودن اجرا انجام شد؛ provider و داده حساب مصنوعی بودند. جزئیات در verification؛ قیمت و سنجش زنده Node صریح هنوز بازند. مشکل خوانایی تبلت که این مرور آشکار کرد، در UX67 پیگیری و اصلاح شد.

### چرخه زنده محدود: نتیجه و کار بعدی

چرخه واقعی سه release، 500، تشخیص مدل و اصلاح source با approval و بررسی همان صفحه تکمیل شد؛ [گزارش فنی](docs/evidence/controlled-live-cycle.md) مرز real/synthetic و revisionها را ثبت می‌کند. این پایان کل پروژه نیست. برنامه آزمایشی حذف و نبودش تأیید شد؛ شبکه خالی آزمون باقی است. همه gateهای نصب خاموش‌اند و هیچ attempt نامعلوم/در حال اجرا باز نماند. انتشار، یک تشخیص و UX این سناریوی محدود سنجیده شدند؛ restart، env write، نسخه Node غیرپیش‌فرض، قیمت در محصول، GitHub واقعی و reader تازه باقی‌اند. نصب و اجرای مستقل از کلون محلی تمیز روی 869035a گذشت؛ clone مستقیم GitHub و بازبین تازه سنجیده نشده‌اند. تصمیم روتین و کار مستقل به اعتبار وابسته نیست؛ write یا مصرف بیشتر از سهم مجاز این آزمون انجام نمی‌شود.

گزارش‌های مرحله‌ای زیر سابقه‌اند و وضعیت همان زمان را بیان می‌کنند؛ جدول‌های Task و جمع‌بندی بالا مرجع وضعیت جاری‌اند. پس از اصلاح نهایی کد، lint/typecheck/build، domain 81/81، HTTP 15/15 و دو bootstrap روی نصب تمیز هم pass شدند؛ کلید یا state خصوصی کپی نشد و هیچ درخواست provider نیاز نبود.

### T22/UX64–66 — بازخوانی امن پس از پاسخ ناموفق سایت

بر پایه `bf276b1`، release واقعی ابتدا READY/503 بود؛ action به failed رفت و UI فقط پیشنهاد تازه داشت. predicate مشترک contract اکنون بازخوانی action دارای receipt را حتی پس از پاسخ ناموفق مجاز می‌کند؛ server و Store همان معیار را enforce می‌کنند. receipt/attempt/approval مصرف‌شده تغییر نمی‌کنند. regression اولیه fail شد؛ 503 سپس 200 با revision غلط همچنان failed و فقط 200 با همان revision موفق است؛ write همان دو فراخوانی باقی می‌ماند. بازخوانی واقعی نسخه نخست بعداً 500 را دید و موفق اعلام نکرد. CTA و دلیل غیرفعال‌بودن آن روشن شدند؛ گزارش اختلال متن تکراری ندارد و محدودیت env را با انتشار کد اصلاح‌شده اشتباه نمی‌کند. domain تازه 81/81، HTTP 15/15، lint/typecheck/build و browser تازه 55 حالت/9 عرض + 19 حالت/4 عرض pass. assertion قدیمی متن کوتاه پس از یکسان‌کردن متن گزارش به timeout رسید؛ assertion به معنی همان نتیجه منتقل و suite کامل تازه pass شد، oracle outcome تغییر نکرد. شواهد و config در verification هستند.

### T20/T30 — لاگ و رویداد واقعی زیرساخت جدید

روی `fffea88`، GET واقعی v1/logs با ISO since پاسخ 400 داد؛ CLI رسمی نصب‌شده 9.4.7 مسیر v2/logs با start بر حسب ثانیه و wrapper پیام/زمان نانوثانیه را مصرف می‌کند. transport همین قرارداد مشخص را اجرا می‌کند؛ parser v1 مستند به‌صورت مستقل حفظ شد و fallback شبکه پنهان اضافه نشد. timestamp لاگ کنترل‌شده با زمان ISO خود پیام در حد میلی‌ثانیه تطبیق داشت. رویداد lifecycle جدید نیز با schema محدود parse می‌شود؛ زمان event و واحد metrics هنوز unverified هستند. applets واقعی 500 داد و unavailable باقی ماند.

domain تازه 80/80، HTTP تازه 15/15، lint/typecheck/build pass. بازخوانی production واقعی، همان app و `/` با 500، نام متغیرهای موجود و log تازه CONFIG_REQUIRED/WELCOME_MESSAGE را در گزارش پایدار جمع کرد؛ model هنوز در این مرحله فراخوانی نشده است. مجموعه مرورگر برای تغییر backend جدا بازاجرا نشد. قدم بعد T31 با oracle مستقل و حداکثر دو فراخوانی مدل؛ سپس اصلاح تأییدشده و بررسی همان صفحه.

### T22 — رسید واقعی source و نخستین release

روی `635198d`، پاسخ واقعی upload برابر نام opaque دارای پسوند `.tar.gz` بود؛ regex قبلی هم در adapter و هم journal آن را رد می‌کرد. parser مشترک با سقف طول و منع مسیر/URL، ذخیره و ارسال همان receipt را می‌پذیرد؛ قالب release ID تغییر نکرد. regression پاک‌سازی‌شده ابتدا fail و سپس pass شد. domain تازه 79/79، lint/typecheck/build pass. اولین upload→source receipt→release receipt واقعی از API محصول گذشت؛ build ابتدا BUILDING و سپس READY/current دیده شد، اما probe نخست 503 و خواندن بعدی همان `/`، 500 با revision مورد انتظار داد؛ سلامت اعلام نشد. نمونه liveness مستقل 200 بود و جای همین symptom پذیرفته نشد. ساخت پیشنهاد/تأیید تازه پس از توقف‌های source، replay approval قبلی نبود؛ هنوز فقط یک POST release انجام شده است.

مرز بعدی T20/T30: project و release واقعی parse شدند؛ logs با since از نوع ISO رد شد، events با shape مستند قدیمی فرق دارد، applets پاسخ 500 داد؛ metrics مقدار خام دارد ولی واحد/زمان هنوز unknown است. این failures نباید داده خالی یا سلامت تلقی شوند. gate مدل و تنظیمات پیش‌فرض نصب همچنان خاموش‌اند.

### T22 / AC06/13 — بازیابی توقف پیش از درخواست انتشار

روی `7c8c988` برنامه Node جداگانه با مجوز صریح و بودجه محدود ساخته شد؛ ساخت app و شبکه لازم، fixture اپراتور بودند و قابلیت ساخت برنامه در محصول ادعا نمی‌شوند. اتصال واقعی حساب، انتخاب app، prepare و پیشنهاد v4 از مسیر production گذشتند. نخستین اجرا در `upload_started` بدون رسید source متوقف و uncertain شد؛ علت transport در حال بررسی است و انتشار موفق اعلام نشده است.

بازیابی همین case یک بن‌بست را نشان داد: journal ثابت می‌کند `release_started` هنوز ثبت نشده و handler متوقف است، پس هیچ درخواست release از این attempt ممکن نیست؛ وجود احتمالی source یتیم همچنان نامعلوم می‌ماند. observer پس از تطبیق تازه هویت/پلن، outcome مستقل `not_started` را ثبت می‌کند. همان approval مصرف‌شده هرگز replay نمی‌شود؛ پیشنهاد تازه تأیید تازه می‌خواهد. counterexample پاسخ گم‌شده پس از `release_started` همچنان uncertain و مانع write است؛ جعل `not_started` در Store رد می‌شود. regression ابتدا fail و سپس pass شد. domain تازه 78/78، HTTP تازه 15/15، lint/typecheck/build و browser انتشار 18 حالت در 4 عرض pass؛ transport آزمون خودکار مصنوعی است. بازخوانی دستی همین حالت در مرورگر واقعی و GET واقعی محصول نیز انجام شد؛ هیچ release یا سلامت سایت از آن نتیجه نمی‌شود. جزئیات در verification است.

### T20 — نخستین تطبیق واقعی حساب و تیم

روی پایه `cfbe099`، اتصال خواندنی هویت/تیم و فهرست برنامه‌های تیم با API واقعی تطبیق داده شد؛ تیم منتخب در این زمان برنامه‌ای نداشت. پاسخ واقعی از `team.teamName` استفاده می‌کند؛ parser و fixtureهای مصنوعی قدیمی اصلاح شدند. regression متناظر ابتدا fail و پس از اصلاح pass شد. lint/typecheck/build و اجرای تازه domain 78/78 pass؛ credential و پاسخ خصوصی در Git نیستند. gateهای mutation/model تنظیم نصب خاموش ماندند. جزئیات project/release/logs/metrics و انتشار واقعی هنوز به برنامه آزمایشی و تطبیق همان قرارداد وابسته‌اند.

### ثبت تغییرات در Git — ۲۰۲۶-۱۰-۲۲

- تغییرات کد به‌ترتیب در `1eee3c4` (ریشه مستقل workspace)، `4c9b44f` (مسیر کامل انتشار تأییدشده و UI/تست) و `7100111` (هویت/زمان شواهد و خواندن محدود Liara) ثبت شدند؛ قراردادها و شواهد در commit مستندات جدا همراه می‌شوند.
- پیش از ثبت، lint/typecheck و domain تازه 77/77 pass شدند. export ایزوله index برای commit اول 6 تست project-flow، برای دوم domain کامل 73/73 و برای سوم domain کامل 77/77 را گذراند؛ این نتایج جدا هستند و با هم جمع نمی‌شوند. staged diff و اسکن secret هر مرحله بدون مورد بود. build/HTTP/browser در این مرحله بازاجرا نشدند؛ شواهد اجرای قبلی با شرایط خودشان در verification حفظ شده‌اند.
- پژوهش، prompt، credential، state و artifactهای خصوصی خارج از Git می‌مانند؛ هیچ push، تغییر visibility، write زیرساختی یا درخواست مدل انجام نشد. T20 همچنان به API token و app مجاز مشخص وابسته است.

### ادامه T20 و اصلاح مرزهای read-only — پایه `cbd23a9`

- مجوز این مرحله فقط خواندن محدود حساب و app مجاز است؛ write زیرساختی و مصرف مدل مجاز نیستند. بررسی محلی config و SQLite با `readOnly:true` نشان داد API token و اتصال Liara اپراتور جاری وجود ندارند و app انتخابی/allowlist تعیین نشده است؛ فایل دسترسی محلی فقط password دارد. DB خصوصی فقط migrationهای 1/2 را دارد و جدول اتصال هنوز ساخته نشده؛ این بررسی هیچ migration/recovery روی آن اجرا نکرد. هیچ درخواست خارجی ارسال نشد و gateها تغییر نکردند. T20 در مرز دسترسی زنده blocked است.
- برش مستقل AC01/08/09/11/13 پیاده شد: تطبیق هویت تازه app پیش/پس از جمع‌آوری، پنجره زمانی متناسب با اجرای مجاز و لغو/deadline خواندن حتی با transport یا body معلق. چهار regression متمایزکننده پیش از اصلاح fail شدند: app بازساخته پذیرفته شد، symptom تازه با clock مصنوعی 20 ثانیه خارج پنجره افتاد و دو مسیر خواندن بعد از cancel/deadline معلق ماندند. پنجره تاریخی صریح نیز حفظ می‌شود. 21 آزمون هدفمند و مجموعه تازه domain با 77/77، lint/typecheck/build و HTTP با 15/15 pass شدند؛ browser تازه دو suite با 55 حالت/9 عرض و 15 حالت/4 عرض را بدون overflow/axe violation/browser error/external request در حالت‌های سنجیده‌شده گذراند. transport/DNS/model مصنوعی و SQLite محلی‌اند؛ این نتایج live نیستند. مسیر artifact و حدود دقیق در verification ثبت است.

### انتشار محدود و معیار نتیجه؛ پایه `cbd23a9`

- T11/T13/T21/T22/T23 و UX64/66: مسیر قراردادی انتشار روی برنامه Node موجود، ActionSpec v4 با همان artifact/revision و شناسه داخلی app، پلن فعلی به‌عنوان precondition و انتظار دقیق HTTP/JSON revision اضافه شد. v1/v2/v3 و hash تاریخچه حفظ شده‌اند؛ پیشنهادهای قدیمی وارد write adapter نمی‌شوند. ساخت app، resize و env write در این مسیر وجود ندارند.
- migration 6 append-only، claim/مرحله upload/رسید source/شروع release/receipt و مشاهده را پایدار می‌کند. 503، پاسخ ناقص یا cancel پس از احتمال write، uncertain و بدون replay است. نتیجه بدون release متناظر و پاسخ/نسخه همان workload موفق نمی‌شود؛ readback پس از انتخاب پروژه دیگر نیز قابل انجام است.
- شواهد candidate نهایی همین working tree: `npm run lint`، `typecheck` و `build` pass؛ `test:domain` تازه 73/73 و `test:http` تازه 15/15 با parent، بدون fail/skip. provider/DNS/socket مصنوعی، SQLite و archive واقعی محلی. یازده گروه regression تازه publication failure/race/cancel/receipt/semantic oracle را می‌سنجند؛ یک regression مستقل workspace root/leaf هم اضافه شد.
- مرورگر نقص بازیابی معیار نسخه پس از reload، بن‌بست نسخه بعدی و overflow 5px برند در 360px/متن 200٪ را یافت؛ اصلاح و caseهای اولیه حفظ شدند. `npm run test:browser` تازه، 55 حالت/9 عرض مسیر قبلی و 15 حالت/4 عرض انتشار را جدا اجرا کرد؛ همه بدون overflow/axe violation/browser error/external request در حالت‌های سنجیده‌شده. artifactها و حدود دقیق در verification هستند.
- E02/AC02: counterexample root دارای workspaces و start تجمیعی، به‌اشتباه ready بود. regression قرمز ثبت و انتخاب leaf الزامی شد؛ تست هدفمند همان root/leaf اکنون pass است. اجرای script برای تشخیص انجام نمی‌شود.
- هیچ gate واقعی تغییر نکرده، درخواست تازه Liara/مدل یا هزینه‌ای ایجاد نشده است. T20 و پایان زنده T22/T23 همچنان blocked_live هستند؛ catalog قیمت، env correction و کیفیت diagnosis باز می‌مانند. گام بعد: تنها با مجوز scope/budget، تطبیق حساب، حفظ env و یک چرخه زنده روی app آزمایشی موجود. commit/push/انتشار در این مأموریت انجام نشد.

### مأموریت تجربه کاربر و اتصال حساب‌ها — پایه `0349c11`

بازتولید دستی با مرورگر واقعی روی production ایزوله، حساب مصنوعی و کلیدهای provider خالی در ۲۰۲۶-۱۰-۲۱؛ هیچ حساب واقعی یا هزینه‌ای مصرف نشد. در عرض 360×844، بالای دکمه بررسی پروژه دقیقاً 924px از ابتدای سند بود. پوشه ناموجود پیام عمومی INTERNAL_UNAVAILABLE داد. بررسی نمونه، بسته‌سازی و پورت دستی را نشان داد؛ نوسازی، profile و رفت‌وبرگشت بین ابزارها، نتیجه اختلال را پاک کرد. ورود محلی از اتصال حساب‌ها مستقل است، اما UI برای اتصال حساب اقدام قابل اجرا ندارد و نام‌های داخلی را نشان می‌دهد.

| Task | شدت / علت تأییدشده یا مرز تحقیق | معیار پذیرش این مرحله | وضعیت |
| --- | --- | --- | --- |
| UX60 | P0؛ ورودی متنی تنها مسیر انتخاب است؛ ENOENT از scanner به error عمومی می‌رسد | انتخاب‌گر واقعی و محدود پوشه سرور، لغو بدون پاک‌شدن انتخاب؛ خطای دقیق missing/access/invalid/empty؛ نمونه اختیاری | implemented_local؛ bounded server-folder dialog، ریشه مجاز/صفحه‌بندی، خطای typed و حفظ انتخاب قبلی؛ وضعیت نهایی چک‌ها در verification |
| UX61 | P0؛ اتصال/فهرست GitHub در UI موجود نیست؛ gh در PATH/دو محل معمول یافت نشد | یک روش رسمی قابل اجرا، هویت تأییدشده، repository/search/pagination/branch/subfolder/revision؛ دریافت محدود و بدون اجرای کد | implemented_contract؛ UI ورود رسمی، تأیید حساب، catalog/search/pagination/branch/subfolder و دریافت pinned آماده‌اند؛ تست کنترل‌شده و import domain موفق؛ دریافت کد/حساب واقعی در شبکه فعلی unconfirmed، grant انجام نشده |
| UX62 | P0؛ Liara فقط وضعیت ثابت و بدون اقدام دارد؛ CLI رسمی 9.4.7 نصب است | spike ورود رسمی، تصمیم ایمن و مستند؛ اتصال با اعتبارسنجی فوری، تیم/app مجاز و قطع اتصال روشن؛ بدون جعل OAuth | live_verified_bounded؛ راهنمای کلید، validation هویت/تیم، انتخاب app/refresh و encryption پیاده‌اند؛ هویت/تیم/app با حساب واقعی تطبیق و انتخاب پس از حذف app خالی شد؛ قطع اتصال به معنی ابطال کلید سرویس نیست |
| UX63 | P0؛ profile و incident در state component هستند و بازیابی ندارند | جریان پایدار actor-bound در SQLite؛ بازیابی امن، تشخیص source قدیمی، URL/Back/Forward بدون secret و approval منقضی | implemented_local؛ پروژه و گزارش عادی/نمونه پس از جابه‌جایی، reload و ورود مجدد بازیابی می‌شوند؛ URL فقط شناسه/نما دارد؛ تغییر source و انتخاب تازه تأیید قبلی را باطل می‌کنند |
| UX64 | P1؛ آماده‌سازی داخلی و هش‌ها/پورت بار تصمیم غیرضروری ایجاد کرده‌اند | آماده‌سازی محلی خودکار، port معتبر پیش‌فرض، فهرست قابل بررسی بدون هش اجباری؛ مقصد/هزینه/اثر همچنان واضح | implemented_local برای Node پشتیبانی‌شده؛ UI به جریان خودکار منتقل شد، هش‌ها از فهرست معمول حذف شدند؛ تکمیل امن مقدار env و قیمت زنده هنوز قابلیت آماده نیستند |
| UX65 | P1؛ مسیر اصلی اختلال فقط scripted است؛ اتصال خاموش بن‌بست دارد | انتخاب برنامه متصل و نشانه، evidence واقعی در حد adapter موجود؛ تمرین اختیاری؛ نبود تحلیل/دسترسی بدون موفقیت جعلی | live_verified_one_case؛ جمع‌آوری/تحلیل/بازخوانی و گزارش ماندگار یک 500 واقعی سنجیده شد؛ تغییر نامرتبط مشکل را حفظ و انتشار کد اصلاح‌شده همان صفحه را 200 کرد؛ تعمیم کیفیت و env write بازند |
| UX66 | P1؛ header/stepper/capabilities ثابت و CTA خارج viewport است | دو هدف روشن، فارسی قابل فهم، اتصال‌ها از وضعیت واحد، انتخاب پروژه در اولین viewport، keyboard/responsive/RTL و حذف health فنی از مسیر عادی | implemented_local؛ نام سرویس مدل و جزئیات داخلی از مسیر عادی حذف شدند؛ وضعیت همان flow/اتصال، focus/keyboard، حالت‌های خطا/لغو/بازیابی و عرض‌های 280 تا 1280 سنجیده شدند؛ screen reader و reader تازه سنجیده نشده‌اند |
| UX67 | P1؛ ستون پیشنهاد در تبلت باریک و کنار آن خالی است | عرض اصلی برای تصمیم، حفظ کنترل/داده، بررسی دو سوی breakpoint و متن بزرگ‌شده | implemented_local؛ دو ستون از 960، اندازه‌گیری قبل/بعد 768 و browser تازه 27 حالت/6 عرض انتشار؛ بدون تغییر رنگ/فونت یا ادعای WCAG کامل |

اولویت اجرا UX60/61/62/63 سپس UX64/65/66 است؛ قسمت‌های مستقل منتظر اتصال/اعتبار نمی‌مانند. gateهای هزینه/زیرساخت فعلی حفظ می‌شوند. اسکیل‌های مؤثر: ux-ui-agent-skills، web-design-guidelines، frontend-design، vercel-react-best-practices و competition-agent-engineer. شاهد دستی با CUA و تست‌های خودکار با server ایزوله ثبت می‌شوند؛ حساب واقعی، transport مصنوعی و blocker از هم جدا می‌مانند.

بازبینی روی `15ace2f`: refresh برنامه هم‌نام با شناسه تازه، انتخاب/تأیید/نشانی قدیمی را باطل می‌کند؛ recheck/analyze گزارش نیز به همان شناسه داخلی متصل‌اند. ورودی catalog GitHub پیش از upstream رد می‌شود و پوشه خصوصی قابل انتخاب نیست. 61 domain، 14 HTTP و 55 حالت/9 عرض browser تازه pass شدند؛ جزئیات و failure اولیه در verification. ورود واقعی GitHub پس از timeout کد و شکل حساب Liara همچنان unconfirmed هستند؛ این‌ها با fixture بسته نشده‌اند.

بازبینی نهایی UX روی `fced65e`: گزارش از 768 دو ستونی و کنترل اتصال تکراری حذف شد؛ مرور دستی 360/768/1280 و browser تازه 55 حالت/9 عرض، lint/build pass. هیچ شارژ یا write واقعی برای این مرحله مصرف نشد. شرط پایان زنده UX61/62، ورود و مجوز واقعی و تطبیق schema حساب است؛ انتشار/اصلاح واقعی همچنان در T20–23/32 مستقل باقی‌اند.

P0 و مسیر مستقل P1 پیاده‌اند؛ بخش محدود P2/P3 زنده سنجیده شده است. restart، env، قیمت، تعمیم diagnosis و review تازه مطابق جدول‌ها بازند. gateهای نصب پس از آزمون خاموش‌اند؛ هیچ موفقیت عمومی از fixture یا یک case زنده نتیجه نمی‌شود.

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
| T10 | تکمیل DESIGN با flow، توکن و component state؛ UI یکپارچه با action/evidence | T02 | AC14؛ walkthrough، keyboard و responsive؛ بدون پالت پراکنده | implemented_local؛ suite تازه 55 حالت/9 عرض و 27 حالت/6 عرض انتشار؛ مقایسه دستی تبلت با نمونه ثابت و مرور پیشین تاریخچه واقعی؛ walkthrough انسان تازه و screen reader انجام نشده |
| T11 | API adapter interface و schemaهای ورودی/پاسخ از OpenAPI؛ fixture صادقانه | T03 | AC01,08,13؛ teamID، pagination، null، 401/429 و unit/time contracts؛ synthetic بودن صریح | partial_contract؛ readها/probe و upload/release محدود با gate مستقل و fixture آزموده‌اند؛ field/unit/time و semantics حساب واقعی همچنان به T20 وابسته‌اند |
| T12 | تشخیص read-only یک اپ Node و archive manifest مجاز | T02 | AC02,03؛ runtime/port/env names؛ traversal/symlink/secret و no script execution | implemented_local؛ manifest و tar.gz خصوصی؛ upload واقعی v4 سنجیده شد و انتخاب Node/approval v5 قرارداد آزموده دارد؛ تطبیق زنده runtime در T21 باز است |
| T13 | operator session، policy، action immutable، approval و state SQLite | T02 | AC04,13,16؛ deny/expiry/replay/race/restart/storage-down؛ CAS پیش از write | implemented_local؛ v5 و حفظ تاریخچه/journal/claim/recovery آزموده؛ چرخه live ثبت‌شده v4 بود؛ env secret-reference و چند process پیاده نیستند |
| T14 | تعریف oracle و demo fixture برای deploy و incident؛ توسعه تست domain با ابزار مناسب | T11,T12 | AC05,09,11؛ golden و counterexample؛ commandهای واقعی به AGENTS اضافه شود | partial؛ oracle مستقل 500/اصلاح غلط/درست در چرخه واقعی گذشت؛ تناقض/داده ناکافی/injection در domain مصنوعی‌اند و ارزیابی مدل واقعی آن‌ها باقی است |

کار مستقل آفلاین با نبود دسترسی متوقف نمی‌شود؛ وضعیت synthetic فقط پس از اجرای همان مرز با سرویس واقعی به live ارتقا می‌یابد.

## P2 — اتصال واقعی و اولین چرخه استقرار

| Task | هدف/محدوده | وابستگی | پذیرش/تست | وضعیت |
| --- | --- | --- | --- | --- |
| T20 | capability spike read-only لیارا با credential و scope مجاز | دسترسی Liara،T11 | AC01,08؛ scope/schema/time/unit و خطاهای واقعی؛ evidence sanitized؛ بدون write | partial_live؛ حساب/تیم/app/project/release/logs v2 و شکل lifecycle تطبیق داده شدند؛ applets=500؛ واحد metric/event و رفتار دیگر برنامه‌ها باز است |
| T24 | smoke مدل/SDK و بودجه مستقل از اتصال Liara | دسترسی و budget مدل،T11 | AC09,13؛ tool protocol/schema، خروجی structured، terminal/error و مصرف واقعی؛ بدون fixture به‌جای live | compatibility_verified برای gpt-6-luna/none؛ سنجش diagnosis واقعی جدا در T31 ثبت شد؛ قطع واقعی پردازش provider پس از cancel تأیید نشده است |
| T21 | انتخاب روش/پلن با منبع/قیمت فعلی و تأیید action | T12,T13,T20 | AC03,04؛ unknown price/budget سؤال/راهنمایی؛ تغییر args/source نیازمند consent تازه | partial؛ پلن موجود در approval بسته؛ v5 با platformConfig.version=22 و runtime واقعی 22.23.3 سنجیده شد؛ قیمت/انتخاب پلن در محصول unknown و نسخه‌ها/پروژه‌های دیگر unverified هستند |
| T22 | upload source→release→observe→health روی app آزمایشی مجاز | T14,T21 | AC05؛ release واقعی و پاسخ workload؛ build fail/timeout/pending و unsafe path | bounded_live_verified؛ سه release v4 و یک v5 با Node 22، receipt/READY/current و status/revision دقیق سنجیده شدند؛ READY همراه 404/503 موفق نشد؛ شاهد پشتیبانی همه پروژه‌ها نیست |
| T23 | انتشار نسخه بعدی و restart کنترل‌شده | T22 | AC06؛ release قبل/بعد، deny و عدم اثر روی app دیگر؛ readback | partial_live؛ نسخه‌های بعدی قبلاً سنجیده شدند؛ در چرخه تازه یک رد بدون attempt و یک restart پذیرفته‌شده با 500 همان صفحه سنجیده شد؛ پایان restart، حالت اصلاح‌کننده مشکل و app دوم زنده بازند |
| T25 | راهنمای دامنه و تفکیک API از registrar | T22 | AC07؛ مسیر واقعی با منبع معتبر و کار بیرون دسترسی مشخص؛ بدون ادعای اجرای DNS انجام‌نشده | implemented_local؛ guide scoped/عمومی و UI/HTTP/browser آزموده‌اند؛ DNS زنده و reader تازه تأیید نشده‌اند |

T20 و T24 مستقل‌اند؛ نبود مدل نباید مشاهده/آزمون provider را متوقف کند. T25 توسعه P1 است و شرط پذیرش هسته نیست. اگر endpoint یا schema با سند اختلاف داشت، ابتدا مرز adapter اصلاح و regression با پاسخ واقعی اضافه شود. شکست archive/deploy با افزودن framework/پایگاه‌داده جدید حل نمی‌شود مگر bottleneck اثبات شود.

## P3 — SRE و بستن حلقه اصلاح

| Task | هدف/محدوده | وابستگی | پذیرش/تست | وضعیت |
| --- | --- | --- | --- | --- |
| T30 | خواندن محدود logs/events/release/health/CPU/RAM و evidence panel | T11,T20 | AC08,14؛ app/time/unit، empty/unsupported؛ داده ناکافی به‌عنوان unknown | partial_live؛ snapshot همان app/page و log تازه در UI واقعی ثبت شد؛ خطای applets و واحد نامعلوم منابع صریح هستند |
| T31 | diagnosis مبتنی بر evidence و فرضیه رتبه‌دار | T14,T30,T24 | AC09؛ oracle 500، paraphrase، contradictory log، injection و redaction؛ کیفیت با مدل واقعی | live_verified_one_case؛ دو درخواست واقعی، 1653 توکن، فرضیه پیکربندی با سه شاهد مرتبط؛ سنجش واقعی داده ناکافی/تناقض/injection و تعمیم کیفیت باز است |
| T32 | اصلاح دارای approval و verification همان symptom؛ بسته قبل/بعد | T13,T22,T31 | AC11؛ اصلاح واقعی/ناموفق، timeout و replay؛ success فقط با readback | partial_live؛ تغییر نامرتبط 500 را حفظ کرد؛ اصلاح source با approval تازه همان / را 200/live-v3 کرد؛ env write و تولید/اعمال خودکار patch از diagnosis هنوز ساخته نشده‌اند |
| T33 | سناریوی مستقل کندی/منابع و پیشنهاد بهینه‌سازی | T30,T31 | AC10؛ latency و مصرف هم‌شرایط؛ بدون ادعای علت قطعی از یک نمودار | partial_local؛ سه نمونه/مقایسه/گزارش و UI تست شدند؛ واحد منابع و تشخیص واقعی باز |
| T34 | handoff پاک‌سازی‌شده برای Coding Agent | T31 | AC12؛ reproduction، evidence، محدوده اصلاح و acceptance قابل فهم برای reader تازه؛ بدون فایل/command ساختگی | implemented_local + historical_replay_verified؛ API/preview/download، هفت regression، browser و گزارش از incident واقعی ذخیره‌شده سنجیده‌اند؛ reader تازه و جمع‌آوری زنده تازه بازند |

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
| T50 | README نهایی معماری/API/تعامل/limits و setup از checkout تمیز | T41 | AC15,16؛ دستورات واقعی، نسخه و real/simulated واضح؛ هیچ وابستگی به فایل محلی خارج Git | partial؛ export مستقل tracked روی 90e392a، npm ci/setup/type/build/domain147/HTTP17/bootstrap2 تازه pass؛ بدون کپی env/DB/context خصوصی، با سه gate خاموش. lint و browser با محدوده ثبت‌شده در verification، و 42 لینک محلی اسناد pass؛ review تازه، clone مستقیم GitHub و revision تحویل نهایی باقی‌اند |
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
