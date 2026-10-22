# شواهد اعتبارسنجی Launchlane

شواهد جاری ابتدا و سابقه مراحل پیشین پایین‌تر ثبت شده‌اند. هر نتیجه به revision و شرایط خودش تعلق دارد؛ نتایج bootstrap جای قابلیت محصول و fixture جای اتصال زنده نیست.

## UX67 — خوانایی تبلت؛ پایه 69f1705

تغییر محصول فقط نقطه دو ستونی `.workbench-grid` از 768 به 960 است؛ ورود، چیدمان گزارش اختلال، توکن‌ها و منطق API/state دست‌نخورده‌اند. در دو production ایزوله، با همان نمونه/متن پیشنهاد تأییدشده، اندازه viewport=768×1000 و پس از `document.fonts.ready`، client/content در هر دو 753/753 بود. عرض ستون اصلی از 409.21875 به 689 و ارتفاع همان proposal از 1158.609375 به 911.671875 پیکسل تغییر کرد. در 959، client/content=944/944 و یک ستون 880px؛ در 960، client/content=945/945 و دو ستون 527.375/329.625px دیده شدند. تصاویر و داده قبل/بعد در `.artifacts/tablet-ux/` خصوصی‌اند. این‌ها اندازه هندسی‌اند و امتیاز UX یا تأیید WCAG نیستند.

`npm run lint`، `npm run typecheck` و `npm run build` pass. `npm run test:browser` تازه، 55 حالت در 9 عرض مسیر عمومی و 27 حالت در 6 عرض انتشار را گذراند؛ متن 200٪ در 360/768/959/960 بررسی شد. در حالت‌های سنجیده‌شده overflow، axe violation، browser error و external request صفر بودند. artifactها: `.artifacts/ux/2026-10-22T00-07-32-266Z/` و `.artifacts/deployment-ui/2026-10-22T00-08-05.392Z/`. شواهد domain 89/89 و HTTP 15/15 متعلق به 69f1705 در بخش بعدند؛ تغییر CSS علت اجرای دوباره آن‌ها نبود. تمام حساب/providerهای این برش مصنوعی‌اند؛ کلید واقعی کپی نشد، gateها خاموش و درخواست واقعی Liara/مدل صفر بود. تست انسانی با کاربر تازه و screen reader انجام نشده است.

## T21 — انتخاب Node و approval v5؛ پایه 667227b

مرز نخست خراب: profile دارای نیاز `>=24.15.0 <25` بود ولی release JSON هیچ platformConfig نداشت. regression مستقل ابتدا diff نبود `platformConfig.version=24` داد؛ پس از اصلاح همان case pass شد. helper server-only محدوده کامل semver را با catalog مستند تطبیق می‌دهد، تنظیم صریح liara.json را با engines می‌سنجد و به runtime رایانه fallback نمی‌کند. semver 7.8.5 و types 7.8.0 با lockfile pinned شدند؛ همان نسخه runtime پیش‌تر dependency غیرمستقیم sharp بود و اکنون direct و deduplicated است.

ActionSpec v5 شاخه Node را در hash دارد؛ نسخه جعل‌شده، تغییر فایل‌ها، source/target/plan و approval مصرف‌شده مسیر تازه‌ای ایجاد نمی‌کنند. canonicalization قبلی تغییر نکرده است. v4 قدیمی اجرا نمی‌شود ولی journal/receipt/observe آن پس از reopen قابل خواندن است. profile تاریخی فاقد انتخاب runtime، با حفظ نتیجه به بررسی تازه نیاز دارد. تعارض engines/liara و نسخه نامعتبر پیش از provider، صفر read/write/attempt دارند. شرط نسخه جزئی صرفاً با انتخاب major یا پاسخ JSON سایت اثبات نمی‌شود.

`npm run lint`، `npm run typecheck` و `npm run build` pass؛ اجرای تازه `npm run test:domain` برابر 89/89 و `npm run test:http` برابر 15/15، بدون fail/skip/cancel. `npm run test:browser` تازه 55 حالت در 9 عرض و 22 حالت انتشار در 4 عرض را بدون overflow/axe violation/browser error/external request در حالت‌های سنجیده‌شده گذراند: `.artifacts/ux/2026-10-21T23-53-26-482Z/` و `.artifacts/deployment-ui/2026-10-21T23-54-00.460Z/`. اجرای قبلی در `.artifacts/deployment-ui/2026-10-21T23-49-55.758Z/` پس از دکمه پیشنهاد تازه، به‌اشتباه منتظر فرم دوم ماند؛ کنترل موجود مستقیماً پیشنهاد جدید می‌ساخت. انتظار کلیک اضافی از test حذف شد؛ oracle نسخه v5، تأیید تازه و صفر send ثابت ماندند. case اولیه و failure artifact حفظ‌اند.

مرور دستی CUA روی production ایزوله با حساب/برنامه مصنوعی، کلیدهای provider خالی و gateهای خاموش انجام شد. تأیید با Enter، انتقال focus به پیشنهاد، نسخه Node، بازیابی و دکمه اجرای غیرفعال با علت/گام بعد بررسی شدند. client/content در 360/768/1280 به‌ترتیب 345/345، 753/753 و 1265/1265 بود؛ تصاویر در `.artifacts/node-runtime-manual/` خصوصی‌اند. screen reader و کاربر تازه سنجیده نشده‌اند. ستون اصلی تبلت در 768 بیش از نیاز باریک و کنار آن خالی بود؛ این مشکل خوانایی با نبود overflow متفاوت است و برش بعدی UX آن را دنبال می‌کند. درخواست واقعی Liara/مدل و write زیرساختی این مرحله صفر بودند؛ شاهد زنده چرخه قبلی به v5 تعمیم داده نمی‌شود.

## چرخه زنده محدود روی 869035a

گزارش مستقل از چت در [controlled-live-cycle.md](evidence/controlled-live-cycle.md) است. سه release واقعی روی برنامه Node آزمایشی، 500 کنترل‌شده، تحلیل واقعی با دو فراخوانی/1653 توکن، تغییر نامرتبط همچنان 500 و اصلاح source دارای approval با پاسخ 200/live-v3 و release متناظر بررسی شدند. این cycle، env write، اصلاح خودکار کد توسط مدل یا پشتیبانی همه پروژه‌ها نیست. revision هر مرحله و حدود مصرف در همان گزارش ثبت‌اند.

برنامه و نبودش بعد از حذف با API و پنل همان تیم تأیید شدند؛ مدت حدود 29 دقیقه و اختلاف موجودی ثبت‌شده حدود 1145.8 تومان بود. شبکه خالی آزمون باقی است و حذف آن از مسیر رسمی بررسی‌شده در دسترس نبود. credential پنل فقط برای همان ورود رسمی و بدون چاپ/تصویر رمز استفاده شد؛ نشست موقت مرورگر خارج شد. اتصال محصول refresh و selected app خالی شد. همه gateهای نصب خاموش ماندند. audit خصوصیِ readOnly، migrations 1–6 با حفظ checksumهای backup اولیه، شش attempt با 5 failed/1 succeeded و صفر اقدام unresolved را تأیید کرد؛ plaintext کلید provider در SQLite نبود.

پس از candidate UI، lint/typecheck/build pass. domain تازه 81/81 و HTTP تازه 15/15؛ browser تازه 55 حالت/9 عرض و 19 حالت/4 عرض با provider مصنوعی و بدون external request، overflow، axe violation یا browser error در حالت‌های سنجیده‌شده گذشتند. مرور دستی تاریخچه واقعی با gateهای خاموش در 360/768/1280 نیز اجرا شد؛ client/content به‌ترتیب 345/345، 753/753 و 1265/1265 بودند. تصویر 768/1280 بلافاصله پس از تغییر viewport در سطح پنل برش داشت؛ پس از reload، screenshot خود tab ثبت و بررسی شد. این مشکل ثبت تصویر به‌عنوان overflow محصول گزارش نشد. تصاویر پاک‌سازی‌شده در `.artifacts/live-validation/` خصوصی‌اند؛ بررسی screen reader و کاربر تازه انجام نشده است.

اسکیل‌های مؤثر: competition-agent-engineer برای انتخاب مرز زنده و oracle مستقل؛ ux-ui-agent-skills و vercel-react-best-practices برای حالت/بازخوانی و مرز server/client؛ writing-guidelines برای هم‌سطح‌کردن README و limits. عدد کیفیت kit، درصد آمادگی یا امتیاز داور از این‌ها ساخته نشده است. گام بعدی هسته، رفع/تطبیق نسخه Node و تنظیمات موردنیاز پیش از استفاده گسترده، سپس restart و review تازه است؛ توسعه دامنه/عملکرد/handoff مستقل باز می‌ماند.

### نصب مستقل از کلون محلی تمیز

commit `869035a7ede1ad3816c3473895bc72b1d16bcf24` با `git clone --no-hardlinks --single-branch --branch main` از مخزن محلی به پوشه موقت مستقل کپی شد. `.env.local`، `.data`، `.local` و `.artifacts` در ورودی clone وجود نداشتند؛ dependency یا state از checkout کاری کپی نشد. این آزمون clone مستقیم GitHub نیست؛ تغییرهای بعدی این مرحله فقط مستندات‌اند.

روی Node 24.18.0، `npm ci`، `npm run setup:local`، `npm run lint`، `npm run typecheck`، `npm run build`، `npm run test:domain` تازه 81/81 و `npm run test:http` تازه 15/15 pass شدند؛ بدون fail/skip/cancel. setup کلید ورود و session تازه ساخت و هیچ کلیدی چاپ نکرد. production server همان نصب با پورت loopback آزاد اجرا شد؛ ورود با کلید تازه و GET خصوصی workspace پاسخ 200 دادند. فرمان واقعی bootstrap، `node --test tests/bootstrap.test.mjs` با `TEST_BASE_URL` همان server بود و 2/2 pass شد. این همان script `npm test` است. server متعلق به این بررسی متوقف شد؛ سرور کاربر دست‌نخورده ماند. credential provider خالی و سه gate خاموش بودند؛ هیچ smoke پولی در این بررسی اجرا نشد. suite مرورگر این clone دوباره اجرا نشد؛ شاهد مرورگر candidate در بند قبلی است.

## T22/UX — بازخوانی پس از پاسخ ناموفق؛ پایه bf276b1

نخستین release واقعی READY/current بود ولی probe اولیه 503 داد. نتیجه به‌درستی healthy نشد، اما UI دیگر امکان خواندن دوباره همان رسید را نداشت. `canReadDeploymentResult` در contract، application، Store و UI اکنون failed دارای receipt قطعی و stage=release_accepted را هم برای observe فقط‌خواندنی مجاز می‌کند. state/attempt/approval هیچ‌گاه به write-ready برنمی‌گردند. پس از reopen، 200 با revision غلط نیز شکست می‌ماند؛ فقط همان release/current/READY و status/revision دقیق می‌تواند آخرین مشاهده را موفق کند. case پیش از اصلاح ACTION_CONFLICT داشت؛ پس از اصلاح pass شد. بازخوانی واقعی action نسخه نخست، 500 را ثبت و failure را حفظ کرد؛ write اضافه‌ای نداشت.

گزارش اختلال اکنون reason مقایسه را یک‌بار نمایش می‌دهد و تغییر مستقیم env را از انتشار کد اصلاح‌شده جدا توضیح می‌دهد. `npm run test:domain` تازه 81/81، HTTP تازه 15/15، lint/typecheck/build pass؛ browser تازه مسیر عادی 55 حالت در 9 عرض و انتشار 19 حالت در 4 عرض، بدون overflow/axe violation/browser error/external request در حالت‌های سنجیده‌شده. artifactهای خصوصی: `.artifacts/ux/2026-10-21T23-07-43-359Z/` و `.artifacts/deployment-ui/2026-10-21T23-08-19.860Z/`. اجرای قبلی پس از تغییر متن گزارش، روی assertion متن کوتاه قدیمی timeout شد؛ case حفظ و matcher به همان reason کامل منتقل شد. این failure و تصویرش در `.artifacts/ux/2026-10-21T23-06-19-238Z/` باقی است. outcome مقایسه یا fixture برای سبزشدن تغییر نکردند. این suiteها provider مصنوعی دارند و صرفاً بخش UI/contract را ثابت می‌کنند.

## T20/T30 — logs v2 و lifecycle؛ پایه fffea88

قرارداد مستند v1 در حساب واقعی با ISO since پاسخ 400 «since باید عدد باشد» داد. CLI رسمی 9.4.7 در `commands/app/logs.js` از `GET /v2/projects/{app}/logs` با `start` بر حسب Unix seconds، direction=forward و last_lines=false استفاده می‌کند؛ داده گروه‌های metaData/values دارد و هر tuple شامل زمان نانوثانیه و JSON دارای `type/_entry` است. درخواست محدود همین قرارداد 200 داد. timestamp خام لاگ کنترل‌شده و ISO تولیدشده در خود پیام، با تقسیم دقیق BigInt به میلی‌ثانیه، حدود 2ms اختلاف داشتند؛ این شاهد به v2 logs محدود است و واحد metric/event را تأیید نمی‌کند.

parser جدید group/line/byte/field/time را محدود و متن wrapper را untrusted و پاک‌سازی‌شده نگه می‌دارد. fixture قدیمی collector به protocol انتخاب‌شده منتقل شد؛ تست v1 pure همچنان زمان عددی نامشخص را unknown نگه می‌دارد. regression v2 قبل از اصلاح fail شد؛ traversal با تغییر endpoint از ورودی کاربر ممکن نیست و هیچ retry/fallback upstream اضافه نشده است. lifecycle واقعی `/events` ردیف‌های action/status/time/release دارد؛ به metadata محدود و زمان خام unverified تبدیل می‌شود. applets با 500 unavailable و metrics با rawPoint و واحد unverified باقی ماندند.

`npm run test:domain` تازه 80/80، `npm run test:http` تازه 15/15، lint/typecheck/build pass. شش read محدود مستقیم و سپس reader واقعی production با fence هویت app، `500 /` و log تازه CONFIG_REQUIRED را parse و پایدار کردند. خواندن اول snapshot، log خالی داشت؛ بعد از درخواست 500 تازه و نوبت بعدی، پیام نمایان شد. empty اولیه دستکاری یا به تشخیص موفق تبدیل نشد؛ در این برش model صفر بار فراخوانی شد. مرورگر قبلی روی revision خودش باقی است؛ کیفیت diagnosis هنوز سنجیده نشده است.

## T22 — قرارداد واقعی رسید source؛ پایه 635198d

سه attempt نخست فقط در upload متوقف شدند؛ هر approval جدا و مصرف‌شده باقی ماند، هیچ POST release از آن‌ها انجام نشد. پاسخ محدود transport واقعی نشان داد `sourceID` نامی به قالب UUID با پسوند `.tar.gz` است؛ شناسه خام در artifact خصوصی باقی ماند. parser قبلی پسوند را رد می‌کرد. `sourceReceiptId` مشترک در adapter/journal و بازیابی، همان نام محدود را بدون تغییر قبول می‌کند؛ traversal/URL/پسوند نامربوط همچنان رد می‌شوند و validation شناسه release گسترده نشده است. fixture با شناسه مصنوعی هم‌شکل ابتدا `UPSTREAM_UNCERTAIN` داد و پس از اصلاح، ذخیره/reopen/ارسال دقیق receipt را گذراند.

`node --test tests/domain/deployment.test.ts` تازه 12/12 و `npm run test:domain` تازه 79/79؛ lint/typecheck/build pass. روی همان source اجرایی، درخواست upload واقعی 200 و release واقعی 201 داد؛ مرحله اجرا 2646ms بود. observer ابتدا BUILDING/pending را ثبت کرد، سپس READY/current همراه 503 را failed/WORKLOAD_MISMATCH دانست؛ probe خواندنی بعدی همان `/`، 500 و JSON revision مورد انتظار را مشاهده کرد. `/healthz` مستقل 200 بود و به‌عنوان اصلاح خطای صفحه اصلی پذیرفته نشد. این سناریو عمداً پیکربندی ناقص دارد؛ هنوز اصلاح واقعی یا diagnosis مدل انجام نشده است. مجموعه مرورگر/HTTP این اصلاح receipt جدا بازاجرا نشده‌اند؛ نتایج بخش قبلی با همان revision حفظ‌اند.

## T22 — توقف پیش از release؛ پایه 7c8c988

برنامه Node آزمایشی با مجوز مالک، سقف 30,000 تومان، حداکثر سه انتشار و حذف پس از آزمون ساخته شد. `small-g2` همراه `basic` در catalog موجود بود، اما ساخت بدون شبکه با `400 g2_plan_unavailable` رد شد؛ GET بعدی نبود app را تأیید کرد. پس از ساخت شبکه اختصاصی آزمون با همان تیم، ساخت app و readback شناسه/پلن موفق شدند. این provisioning یک harness خصوصی اپراتور با approval/attempt پایدار بود؛ ساخت app/network هنوز قابلیت UI محصول نیست. نرخ پاسخ catalog، جمع سخت‌افزار و بسته، 1041.66 تومان/ساعت است؛ مبلغ واقعی کسرشده هنوز اندازه‌گیری نشده است.

سرور production جدا با gateهای مقطعی و تنها app آزمون اجرا شد؛ model خاموش ماند. APIهای واقعی session → اتصال/انتخاب Liara → prepare محلی → پیشنهاد/تصمیم v4 گذشتند. نخستین execute در مرحله `upload_started` بدون source receipt به uncertain رسید؛ هنوز release ارسال نشده و علت transport باز است. عمل تکرار نشد. مرورگر واقعی نتیجه را پس از restart بازیابی و فقط observe را فراخواند. journal پیش از release، fresh GET هویت/پلن و Store transition ثابت کردند درخواست انتشار این attempt شروع نشده است؛ نتیجه `not_started` با توضیح احتمال source یتیم ثبت شد. این شاهد deploy موفق یا سالم‌بودن workload نیست.

regression اصلی source-503 و counterexample release-503 حفظ شدند: هر دو ابتدا uncertain، بدون replay و پس از reopen هستند؛ فقط توقف پیش از `release_started` پس از observe به failed/not_started می‌رود و پیشنهاد مستقل دوباره approval می‌خواهد. release با رسید گم‌شده همچنان uncertain است و جعل `not_started` در همان مرحله رد می‌شود. نخستین اجرای regression جدید fail بود. `npm run test:domain` تازه 78/78، `npm run test:http` تازه 15/15، lint/typecheck/build pass؛ `node scripts/test-deployment-browser.mjs` تازه 18 حالت در عرض‌های 280/360/768/1280، بدون overflow/axe violation/browser error/external request در حالت‌های سنجیده‌شده. artifact خصوصی: `.artifacts/deployment-ui/2026-10-21T22-39-34.507Z/`. providerهای suite خودکار مصنوعی‌اند؛ بازخوانی دستی بالا GET واقعی داشت. مجموعه کامل browser قبلی این برش بازاجرا نشده است. تصمیم ایمنی در ADR 0002 است.

## T20 — حساب و تیم واقعی؛ پایه cfbe099

۲۰۲۶-۱۰-۲۲ Asia/Tehran؛ main و working tree این برش. چهار commit تازه و source/call flow بررسی شدند. گراف Tier 2 نسل 2026-10-21T19:24:24Z مسیر validation را نشان داد؛ coverage برای adapterهای تازه not_tracked و برای مسیرهای قبلی metadata_changed بود و tests excluded بودند. source جاری و اجرای مستقیم مبنای ادعاها هستند.

خواندن واقعی محدود: اجرای نخست `GET /v1/me` و همان endpoint با teamID هر دو 200 دادند؛ اتصال به علت انتظار `team.name` رد شد. پاسخ واقعی `team.teamName` دارد. fixture پاک‌سازی‌شده همان field و شناسه مصنوعی، ابتدا fail شد؛ parser و دو fixture قبلی اصلاح شدند. اجرای بعدی سه GET هویت، تیم و `/v1/projects?teamID=...` را از validation واقعی گذراند؛ حساب/تیم موردنظر تطبیق و فهرست خالی مشاهده شد. یک GET تیمی billing هم 200 داد؛ raw account/billing ذخیره یا وارد مدل نشد. مجموع این دو اجرای محدود 6 GET، بدون retry، write زیرساخت یا درخواست مدل بود. catalogue طرح‌ها فقط داده پاسخ است؛ قیمت و واحد مصرف هنوز به‌عنوان قرارداد محصول پذیرفته نشده‌اند.

`node --test tests/domain/liara-connection.test.ts tests/domain/project-flows.test.ts`: 10 pass/0 fail/skip؛ `npm run test:domain`: 78/78 pass تازه؛ lint/typecheck/build pass. SQLite خصوصی ابتدا با readOnly بررسی شد: migrations 1/2 و صفر action. پیش از هر migration، backup بومی SQLite گرفته و نسخه/checksum آن تطبیق داده شد؛ backup فقط محلی است. این برش upload/release، schema برنامه، logs/metrics یا تشخیص واقعی را تأیید نمی‌کند. منبع عمومی auth/team: [Liara API](https://docs.liara.ir/references/api/about/) و [اطلاعات حساب](https://docs.liara.ir/references/api/get-info/).

## ثبت مرحله‌ای تغییرات در Git — ۲۰۲۶-۱۰-۲۲

سه commit کد به‌ترتیب `1eee3c4`، `4c9b44f` و `7100111` روی `main` ثبت شدند؛ مستندات قرارداد/طراحی/شواهد در commit جدا می‌آیند. کد اجرایی در این مرحله تغییر تازه‌ای نکرد؛ فقط دسته‌بندی و ثبت تغییرات موجود انجام شد.

`npm run lint` روی 112 فایل، `npm run typecheck` و `npm run test:domain` با 77 pass/0 fail/cancel/skip دوباره اجرا شدند. برای سنجش جداسازی commitها، هر index با `git checkout-index --all --prefix=<new isolated directory>` در مسیر تازه زیر `.artifacts/` export شد؛ working tree اصلی checkout یا reset نشد. روی index اول، فایل project-flows شش تست pass داشت؛ روی index دوم domain کامل 73/73 و روی index سوم domain کامل 77/77 pass شد. snapshotها به‌ترتیب `.artifacts/commit-index-workspace-n6iD83/`، `.artifacts/commit-index-deployment-CTxEKu/` و `.artifacts/commit-index-incidents-yTck8G/` هستند. این‌ها شاهد مستقل هر مرز commit هستند، نه یک مجموعه جمع‌شده بزرگ‌تر.

قبل از هر commit، فایل‌ها و diff staged، whitespace، مسیرهای خصوصی و نبود مقادیر secret تنظیم‌شده در staged/client assets بررسی شدند. build، HTTP و browser در این مرحله بازاجرا نشدند؛ نتایج بخش‌های قبلی با revision/configuration همان اجراها باقی‌اند. هیچ live provider/model call، write زیرساختی، push یا تغییر visibility انجام نشد؛ T20 همچنان blocked_live است. فایل پژوهشی خصوصی و سایر داده‌های ignored وارد commit نشدند.

## ادامه T20؛ موجودی دسترسی و اصلاح مرز read-only، پایه cbd23a9

۲۰۲۶-۱۰-۲۲ Asia/Tehran؛ branch `main` و HEAD مبنا `cbd23a9e13d2b6603dee27ca1474a652c34c0539` همراه working tree فعلی. مجوز این مرحله فقط بررسی محدود read-only حساب/app بود؛ مصرف مدل و write زیرساختی مجاز نبودند و انجام نشدند. dependency یا migration تازه‌ای در این ادامه اضافه نشده است.

### مرز دسترسی واقعی

config جاری به‌صورت in-process خوانده شد، بدون چاپ secret: API token تنظیم نشده، team تنظیم شده و app allowlist/selected app موجود نیست. SQLite خصوصی با `DatabaseSync(...,{readOnly:true})` و فقط SELECT بررسی شد؛ migrationهای اعمال‌شده 1/2 هستند و جدول `account_connections` وجود ندارد. `Store`، runtime، migration و recovery روی state خصوصی اجرا نشدند. فایل دسترسی محلی password دارد؛ password به API token تعبیر نشد و ورود یا ساخت کلید انجام نشد. نبود app تعیین‌شده به معنی خالی‌بودن حساب نیست؛ فهرست واقعی حساب خوانده نشده است.

artifact sanitized محلی: `.artifacts/liara-readiness/2026-10-21T21-58-59.767Z/result.json`. هر سه gate همچنان false هستند؛ **درخواست واقعی Liara: 0، write زیرساختی: 0، درخواست مدل/مصرف تازه اعتبار: 0**. T20 همچنان `blocked_live` است. 401/403، schema، pagination، زمان، واحد، plan و semantics واقعی env/release از نبود دسترسی نتیجه‌گیری نشده‌اند.

### برش مستقل و oracleها

- **AC01/08/09/11، app identity:** counterexample با نام app ثابت و `_id` تازه پیش از اصلاح پذیرفته شد. reader اصلی اکنون ID اتصال actor-bound را به collector می‌دهد؛ project پیش از سایر داده‌ها و پیش از بازگرداندن snapshot بررسی می‌شود. تغییر پیش از شروع، صفر log/probe دارد؛ تغییر حین خواندن کل snapshot را رد می‌کند. ID ثابت پذیرفته و هر هشت tool call، شامل GET اضافه نهایی، در یک budget شمرده می‌شود. endpoint قدیمی evidence قرارداد نام/team را دارد و جای گزارش ماندگار این مسیر نیست.
- **AC08/09/11، زمان همان symptom:** clock مصنوعی 20s در پاسخ project، یک HTTP 500 تازه روی `/orders` را در reader پیشین خارج پنجره 15s قرار داد. پنجره خودکار اکنون تا deadline همان budget و در پایان تا زمان واقعی جمع‌آوری است؛ `collectedAt` پایان snapshot و `at` محلی زمان دریافت مشاهده است. پنجره تاریخی صریح تمدید نمی‌شود؛ HTTP فعلی خارج آن، evidence کافی برای diagnosis/recovery تاریخی تلقی نمی‌شود. زمان خام log و واحد ناشناخته تغییر نکرده‌اند.
- **AC13، cancel/deadline:** transport بی‌پاسخ و body stream بی‌پایان، پیش از اصلاح تا guard آزمون 500ms معلق ماندند. `LiaraReadClient` حالا هم header و هم body را با deadline/cancel محدود می‌کند؛ کد CANCELLED از BUDGET_EXHAUSTED تفکیک می‌شود. validation حساب نیز با cancel خاتمه می‌یابد و اتصال ذخیره نمی‌کند. هر درخواست دقیقاً یک attempt شمارش‌شده دارد؛ retry اضافه نشده است. این آزمون‌ها transport/body مصنوعی دارند، نه اثبات لغو پردازش واقعی upstream.

### validation همین کد اجرایی

| بررسی | فرمان و شرایط | نتیجه |
| --- | --- | --- |
| Regression هدفمند | `node --test tests/domain/liara-read.test.ts tests/domain/liara-connection.test.ts tests/domain/incident.test.ts tests/domain/incident-runs.test.ts` | 21 pass، 0 fail/cancel/skip؛ چهار case تازه ابتدا fail و پس از اصلاح pass شدند |
| Lint / Types / Build | `npm run lint`، `npm run typecheck`، `npm run build` | pass؛ Biome روی 112 فایل، typegen/tsc و production build با dependencyهای موجود |
| Domain کامل تازه | `npm run test:domain` | **77/77 pass**، 0 fail/cancel/skip؛ شامل case اضافه پنجره تاریخی؛ جمع نتایج چند زیرمجموعه نیست |
| HTTP | `npm run test:http`؛ پس از build، production/DB/workspace ایزوله، کلید provider خالی | **14 subtest + 1 parent pass**، 0 fail/cancel/skip |
| Browser | `npm run test:browser`؛ production/DB ایزوله و upstream کنترل‌شده | **55 حالت/9 عرض** و سپس **15 حالت/4 عرض**، بدون overflow/axe violation/browser error/external request در حالت‌های سنجیده‌شده |
| Git / build trace | `git diff --check`، staged/tracked/exclude و 19 فایل `.nft.json` زیر server/app | whitespace صحیح، staged خالی، مسیرهای خصوصی tracked نیستند؛ صفر reference به `.local/.data/.artifacts/.env.local` در traceهای سنجیده‌شده |

artifact مرورگر اول `.artifacts/ux/2026-10-21T21-56-22-519Z/report.json` با عرض‌های 280/320/360/390/414/559/560/768/1280 است؛ artifact انتشار `.artifacts/deployment-ui/2026-10-21T21-57-02.761Z/results.json` با عرض‌های 280/360/768/1280 است. تاریخ پوشه‌ها UTC است. این ادامه UI تازه‌ای تغییر نداد؛ مرورگر مسیرهای موجود و بازیابی را regression کرد. fixtureها provider، DNS/socket و مدل را کنترل می‌کنند؛ فایل/SQLite محلی واقعی‌اند. حساب و workload واقعی، کیفیت مدل، screen reader انسانی و نسبت‌دادن log به release مشخص سنجیده نشده‌اند.

گراف Tier 2 نسل `2026-10-21T19:24:24Z` برای discovery/trace استفاده شد؛ coverage مسیرهای مورد استناد metadata_changed/not_tracked و برخی tests excluded بود. source جاری، import/callerها، diff و اجرا جای این محدودیت را برای برش فوق گرفتند؛ ادعای پوشش جامع گراف نداریم. export اولیه موجودی، جدول اتصال را در DB قدیمی فرض کرده بود و `no such table` داد؛ exporter محلی با بررسی schema اصلاح شد، بدون اجرای migration یا تعبیر خطا به پاسخ provider.

گام بعد: API token معتبر و app صریح در همان حساب/team تعیین شوند و فقط GETهای محدود T20 با mutation/model خاموش اجرا شوند. قفل اتمیک upstream، تعلق log به release، field/unit/time و حفظ env همچنان unconfirmed هستند؛ بررسی read-only به‌تنهایی semantics write یا سلامت deployment را نمی‌پذیرد. commit/push/انتشار انجام نشد.

## انتشار محدود و معیار نتیجه؛ candidate بر پایه cbd23a9

۲۰۲۶-۱۰-۲۲ Asia/Tehran؛ branch `main`، HEAD مبنا `cbd23a9e13d2b6603dee27ca1474a652c34c0539` به‌همراه working tree این برش؛ commit/push انجام نشد. Windows، Node 24.18.0، npm 11.16.0، Next 16.4.2، React 19.3.1، TypeScript 6.0.3، Playwright 1.62.1 و dependencyهای موجود با `npm ls --depth=0` تطبیق داده شدند. dependency جدید نصب نشد. AC02/04/05/06/13/14/16؛ AC05/06 همچنان شاهد زنده ندارند.

### رفتار و oracle

پیشنهاد اجرایی v4 به artifact/source/selection/revision، actor/team/app identity، پلن موجود و origin/path/status/JSON revision متصل است. read-only preflight پس از بررسی source و درست پیش از claim، app/node/plan را بررسی می‌کند. claim و مرحله ابتدایی در SQLite اتمیک‌اند؛ upload فقط همان archive hash را در field `file` می‌فرستد. source receipt پیش از درخواست release پایدار است و app/plan پیش از release دوباره خوانده می‌شوند؛ release receipt همراه observing ذخیره می‌شود. هر خطای مبهم بعد از claim، بدون write retry به uncertain می‌رود. گم‌شدن receipt با آخرین release حدس زده نمی‌شود و اجازه اقدام متعارض تازه نمی‌دهد.

موفقیت، صرف accepted/READY/200 نیست: همان release باید READY و current باشد؛ همان workload path باید status دقیق و JSON revision مورد انتظار را برگرداند. project/plan و release پس از probe موفق دوباره خوانده می‌شوند. 404، 500، نسخه قبلی، JSON صرفاً liveness، redirect، تغییر currentRelease و provider 403 موفق نیستند. pending به readback دستی بعدی می‌رود. مشاهده می‌تواند با mutation gate خاموش یا پس از انتخاب source دیگر انجام شود؛ هیچ approval تمدید/بازپخش نمی‌شود.

Root دارای workspaces دیگر به‌عنوان یک workload Node تأیید نمی‌شود؛ start تجمیعی باعث artifact قابل پیشنهاد نمی‌شود و کاربر باید زیرپوشه مستقل همان برنامه را انتخاب کند. profile قدیمی ready با همان bytes نیز هنگام restore دوباره از نظر قابلیت انتشار بررسی و stale می‌شود. این رفتار پشتیبانی عمومی monorepo یا dependencyهای بین workspaceها نیست.

### نتایج نهایی همین candidate

| بررسی | فرمان/شرایط | نتیجه |
| --- | --- | --- |
| Lint | `npm run lint` | pass؛ 112 فایل، بدون خاموش‌کردن rule یا explicit any |
| Type check | `npm run typecheck` | pass؛ typegen سپس TypeScript |
| Production build | `npm run build` | pass؛ مسیر observe ساخته شد، کلید/gate واقعی تغییر نکرد |
| Domain | `npm run test:domain` | **73 passed، 0 fail/cancel/skip**؛ اجرای تازه کامل، نه جمع runهای هدفمند |
| HTTP | `npm run test:http` | **14 subtest + 1 parent passed**، 0 fail/cancel/skip؛ production/DB/workspace ایزوله و کلیدهای provider خالی |
| Browser قبلی | بخش اول `npm run test:browser` | **55 حالت، 9 عرض** 280/320/360/390/414/559/560/768/1280؛ بدون overflow/axe violation/browser error/external browser request در حالت‌های سنجیده‌شده |
| Browser انتشار | بخش دوم همان فرمان؛ `test-deployment-browser.mjs` | **15 حالت، 4 عرض** 280/360/768/1280؛ بدون overflow/axe violation/browser error/external request؛ متن 200٪ در 360، Enter، focus نتیجه، reload، progress، pending، failed، verified، نسخه بعدی و cancel/uncertain recovery |
| Git و داده خصوصی | `git diff --check`، بررسی status/staged و `git ls-files` مسیرهای خصوصی | diff بدون خطای whitespace؛ staged خالی؛ research، env محلی، state، archive و artifact خصوصی tracked نشده‌اند؛ exclude پژوهش حفظ شد |
| Build trace | خواندن 19 فایل `.nft.json` زیر `.next/server/app` | صفر reference به `.local/.data/.artifacts/.env.local` در traceهای سنجیده‌شده؛ این بررسی audit جامع secret نیست |

شواهد Browser قبلی: `.artifacts/ux/2026-10-21T21-41-32-954Z/`؛ Browser انتشار: `.artifacts/deployment-ui/2026-10-21T21-42-15.856Z/`، `results.json` و تصاویر موبایل/دسکتاپ مستقیماً دیده شدند. تاریخ پوشه UTC است. هر دو suite در یک فرمان تازه روی همین کد اجرا شدند؛ شمار حالت‌ها جداست. Browser انتشار upstream را در مرز درخواست کنترل می‌کند و از routes واقعی احراز هویت/source/approval/recovery و SQLite استفاده می‌کند؛ نتیجه آن اجرای واقعی transport Liara نیست. domain جدا از مسیر application و `LiaraDeployClient` با send/DNS/socket مصنوعی عبور می‌کند؛ exact archive bytes، دو مرحله، race و failure را می‌سنجد. localStorage خالی بود. screen reader انسانی و reader تازه سنجیده نشدند.

### failureهای حفظ‌شده و اصلاح

- regression root workspace ابتدا `ready` را به‌جای `incomplete` مشاهده کرد؛ start تجمیعی از پشتیبانی تک‌برنامه خارج و restore نتیجه قدیمی نیز stale شد. انتخاب Node leaf مستقل همان oracle را pass کرد.
- مرورگر پس از reload، proposal تازه را با path=/ و revision خالی ساخت، در حالی که کارت قبلی قرارداد را نگه داشته بود؛ applyFlow معیار ذخیره‌شده را بازیابی می‌کند و انتخاب پروژه تازه آن را پاک می‌کند. oracle مسیر/نسخه ضعیف نشد.
- پس از نتیجه موفق، اقدام نسخه بعدی وجود نداشت؛ آماده‌سازی دوباره source با approval تازه اضافه و از همان UI اجرا شد.
- متن 200٪ در 360px باعث document width=365 شد؛ DOM نشان داد brand/subtitle با min-content بیرون می‌زند. انعطاف محدود brand و wrapping اصلاح شد؛ overflow پنهان نشد. artifact شکست `.artifacts/deployment-ui/2026-10-21T21-32-37.900Z/overflow.json`، viewport=360/content=365 و عنصر brand را ثبت می‌کند. پوشه نهایی بالا مرجع نتیجه موفق است.
- خطاهای harness از محصول جدا بودند: DB پیش از ایجاد stateDir باز می‌شد و یک seed تاریخی ابتدا ID تکراری داشت؛ setup اصلاح شد. این‌ها نقص integration زنده تلقی نمی‌شوند. یک invocation formatter با config غیرفعال هیچ فایلی را format نکرد؛ سپس فقط فایل‌های تغییرکرده با تنظیم صریح JS هم‌سبک پروژه مرتب شدند.

### حدود evidence و گام بعد

گراف Tier 2 نسل `2026-10-21T19:24:24Z` برای discovery/trace استفاده شد؛ coverage مسیرهای تازه not_tracked، مسیرهای قبلی metadata_changed و tests/scripts excluded بود. بنابراین source جاری، importها، diff و اجرای مستقیم مبنای ادعاها هستند؛ هیچ ادعای پوشش کامل از گراف نداریم. گزارش پژوهشی خصوصی وارد مستندات یا Git نشده است.

**درخواست تازه واقعی Liara/مدل و هزینه: صفر.** fixtureها synthetic هستند؛ سازگاری مدل قبلی، evidence تشخیص یا deploy این candidate نیست. T20 باید identity/plan/schema/units و حفظ env در release را روی حساب مجاز تأیید کند؛ سپس یک upload/release/workload و نسخه بعدی با approval و budget صریح اجرا شود. API نام‌محور Liara قفل identity/plan بین preflight و write را در snapshot مستند نمی‌کند؛ readback جای CAS upstream نیست. مشاهده فقط صفحه اول 50 release و JSON revision کوچک است. origin انتخابی اثبات مالکیت DNS، failure نامعلوم اثبات عدم اثر، و پاسخ موفق اثبات علت رفع incident نیست. catalog قیمت، env secret-reference/merge/correction، restart transport، rollback، performance مستقل و handoff اختصاصی همچنان انجام‌نشده‌اند. gateها پیش‌فرض خاموش ماندند.

## UX63/65/66 — مسیر عادی مشکل سایت و بازیابی؛ پایه 0947c6b

۲۰۲۶-۱۰-۲۲ Asia/Tehran؛ Node 24.18.0/npm 11.16.0، working tree همین برش. برنامه/نشانه/صفحه → جمع‌آوری مجاز → گزارش → بررسی دوباره، به backend و SQLite وصل شد. تمرین اختیاری و صریحاً scripted است. Site origin فقط برای خواندن همان برنامه ثبت می‌شود؛ DNS/شبکه روی ذخیره فرم اجرا نمی‌شود. پروژه/گزارش پس از reload، Back/Forward، جابه‌جایی و ورود مجدد حفظ می‌شوند. لغو/خطای دریافت قبلی را پاک نمی‌کند. تحلیل و provider gates در تنظیم واقعی خاموش ماندند.

`npm run lint`، `npm run typecheck` و `npm run build`: pass. `npm run test:domain`: 59 pass، 0 fail/skip؛ `npm run test:http`: 13 subtest + 1 parent pass، 0 fail/skip. `npm run test:browser`: 55 حالت در 280/320/360/390/414/559/560/768/1280، 0 overflow/axe violation/browser error/external browser request در حالت‌های سنجیده‌شده. artifact: `.artifacts/ux/2026-10-21T20-40-33-738Z/`؛ timestamp پوشه UTC است.

Browser fixture فقط پاسخ upstream اتصال/دریافت را کنترل می‌کند؛ import GitHub از application واقعی، tar/gzip، snapshot خصوصی، scan و SQLite می‌گذرد. فایل خصوصی حذف می‌شود و کد ناشناس هرگز اجرا نمی‌شود. دریافت ناموفق/لغوشده، پروژه قبلی و focus را حفظ می‌کند. مسیر عادی incident با reader مصنوعی از application واقعی و SQLite عبور می‌کند؛ درخواست model/زیرساخت واقعی 0. خواندن 500 سپس 200 روی همان صفحه، حفظ نتیجه پس از failure/cancel/session loss و تفاوت تأیید/اجرا/نتیجه نامعلوم آزموده شدند. کیفیت علت مدل و مجوز حساب از این نتیجه استنتاج نمی‌شوند.

با CUA در مرورگر واقعی، اتصال لازم در مسیر عادی، نمونه اختیاری با Enter، انتقال focus به نتیجه، اصلاح نامرتبط و مرتبط و reload همان شناسه مشاهده شدند. در snapshot موبایل گزارش چهار پاسخ اصلی را پیش از شواهد بازشدنی نشان می‌دهد. failure اولیه `.artifacts/ux/2026-10-21T20-33-01-942Z/` ساختار نامعتبر definition-list را یافت؛ توضیحات داخل dd اصلاح و همان case پاس شد. run بعدی `.2026-10-21T20-34-57-788Z/` locator متن dd را پس از افزودن توضیح پیدا نمی‌کرد؛ متن نتیجه به span مشخص تبدیل شد، بدون تغییر oracle یا نتیجه 500/200.

spike محدود GitHub با CLI رسمی و config خالی، در 30s کد ورود نداد و با `GITHUB_LOGIN_TIMEOUT` پایان یافت؛ grant/credential صادر نشد. GET بدون احراز هویت به github.com و api.github.com به‌ترتیب 302/200 داد؛ این شاهد، علت timeout مسیر device را مشخص نمی‌کند. ورود/مخزن واقعی GitHub، ساختار تیم Liara و حساب/سایت واقعی همچنان unconfirmed هستند. آزمون تازه پولی مدل یا write زیرساختی اجرا نشد. اسکیل‌های مؤثر: ux-ui-agent-skills، web-design-guidelines، frontend-design، vercel-react-best-practices، webapp-testing و competition-agent-engineer؛ graph list/coverage در این جلسه Transport closed داشت و source/test مستقیم مبنا بود.

### بازبینی محدوده اتصال روی پایه 15ace2f

نام app ممکن است پس از حذف/ساخت دوباره ثابت بماند. refresh اکنون شناسه داخلی را هم تطبیق می‌دهد؛ app تازه انتخاب، پیشنهاد/تأیید یا نشانی بررسی قبلی را ارث نمی‌برد. گزارش جدید incident شناسه app را ذخیره می‌کند؛ گزارش قدیمی بدون آن خواندنی می‌ماند ولی analyze/recheck نمی‌شود. claim تحلیل همین شناسه را داخل transaction کنترل می‌کند. ورودی نامعتبر جست‌وجو/شاخه/پوشه GitHub پیش از بررسی credential و transport رد و پوشه‌های خصوصی از catalog حذف می‌شوند.

`npm run lint`، `npm run typecheck` و `npm run build`: pass؛ domain تازه 61/61 و HTTP تازه 14/14، 0 fail/skip. Browser تازه 55 حالت/9 عرض با همان شاخص‌های صفر، artifact `.artifacts/ux/2026-10-21T20-45-29-679Z/`. تست app با نام یکسان و شناسه متفاوت، عدم ایجاد attempt، ابطال approval، پاک‌شدن نشانی قدیمی و عدم تماس recheck/model را سنجید؛ refresh همان شناسه، انتخاب و تأیید معتبر را حفظ کرد. نخستین expectation آزمون جدید کد خطای PROJECT_CHANGED را فرض کرده بود؛ مرز زودتر PROJECT_ACCESS_CHANGED برگرداند. کد معتبر همان boundary و assert صفر attempt ثبت شدند؛ منع اجرا ضعیف نشد. هیچ درخواست واقعی Liara/مدل یا grant حساب انجام نشد.

### بازبینی نهایی responsive روی پایه fced65e

چیدمان چهار پاسخ گزارش در 768+ دو ستون شد و دکمه اتصال تکراری کارت وضعیت حذف شد. lint/build و browser تازه pass؛ 55 حالت/9 عرض، 0 overflow/axe violation/page error/external browser request در `.artifacts/ux/2026-10-21T20-48-10-308Z/`. domain/HTTP بازاجرای قبلی روی همین منطق server به‌ترتیب 61/14 pass بودند؛ برای تغییر CSS دوباره شمرده نشده‌اند. مرور دستی CUA در 360/768/1280 شامل Enter در انتخاب‌گر پوشه واقعی، آماده‌سازی خودکار، مسیر اتصال لازم، نمونه اختلال، focus، Back و reload همان شناسه بود. عرض واقعی DOM تبلت 753 با scrollbar، content=753 و دو ستون 309.5px دیده شد؛ screen reader واقعی و کاربر تازه هنوز سنجیده نشده‌اند. screenshot و axe به‌تنهایی اثبات UX یا WCAG کامل نیستند.

## UX61 — backend ورود و catalog GitHub، پس از 6dc7e85

- CLI رسمی pinned 2.103.0 با npm run setup:github و SHA-256 همان asset رسمی اجرا شد؛ بدون grant، تغییر PATH یا ورود حساب.
- lint، typecheck و build موفق؛ test:domain برابر 49 pass/0 fail/0 skip و test:http برابر 11 pass/0 fail/0 skip روی server ایزوله. UI این slice تغییر نکرد؛ browser تکرار نشد. تست HTTP جدید session/CSRF، metadata و operation ناشناخته را بدون شروع ورود واقعی بررسی می‌کند.
- تست‌های جدید با transport مصنوعی: جست‌وجوی مخزن خصوصی در pagination همان حساب، حذف فیلدهای credential، 401/403/429/404/409/5xx، keyring در برابر fallback ناامن، نشانی device نامعتبر، تأیید هویت/حساب، actor متفاوت، لغو و race تغییر حساب.
- این شاهد، ورود واقعی حساب یا دریافت مخزن خصوصی نیست. spike قبلی بدون grant در 20 ثانیه کد دریافت نکرد؛ مسیر شبکه/حساب همچنان UNCONFIRMED است. UI اتصال، دریافت محدود archive و binding revision در slice بعدی تکمیل می‌شوند.

## UX62 — اعتبارسنجی اتصال لیارا، پس از fadd33c

- lint/typecheck/build موفق؛ 51 تست domain و 12 تست HTTP موفق، بدون skip یا fail. تمام حساب‌ها و پاسخ‌ها مصنوعی‌اند؛ هیچ کلید واقعی خوانده یا مصرف نشده است.
- اتصال صریح فقط هویت محدود /me، تیم ثابت و فهرست برنامه‌ها را می‌خواند؛ payload حساس /me و env values حذف می‌شوند. کلید پیش از ذخیره با actor/provider رمز می‌شود؛ انتخاب برنامه فقط یک app را به محدوده اضافه می‌کند و allowlist مدیر را گسترش نمی‌دهد.
- regression: تیم اشتباه پیش از خواندن برنامه‌ها متوقف می‌شود؛ 401/403/429/5xx، کلید نامعتبر، cancellation پس از پاسخ، پاسخ ناسازگار، actor دیگر، تغییر محدوده و خاموش‌ماندن gate شواهد تست شده‌اند. metadata و درخواست بدون CSRF هیچ validation حسابی انجام نمی‌دهند.
- shape دقیق تیم و کلید/مجوز حساب واقعی هنوز تأیید نشده؛ موفقیت قراردادی به اتصال زنده یا اعتبار مالی نسبت داده نمی‌شود. UI راهنما و اتصال در مرحله بعدی است.

## UX61/63/64 — دریافت پروژه و بازیابی پایدار، پس از f6704e5

- lint/typecheck/build موفق؛ test:domain برابر 55 pass و test:http برابر 13 pass، بدون fail/skip. UI قبلی هنوز از API قدیمی استفاده می‌کند و پذیرش مرورگر این جریان در slice بعدی است.
- انتخاب محلی، نمونه صریح یا GitHub به flow جدید actor-bound در SQLite متصل می‌شود. بررسی و بسته خصوصی خودکارند؛ هیچ script پروژه اجرا و هیچ فایل به Liara ارسال نمی‌شود. بازگشت پس از restart، فایل‌ها و archive را دوباره بررسی می‌کند؛ فایل حذف‌شده/تغییریافته approval را نامعتبر می‌کند و نتیجه قبلی با هشدار حفظ می‌شود.
- ActionSpec v3، flow/انتخاب/مخزن/شاخه/revision/زیرپوشه را در اثر انگشت approval می‌بندد؛ canonicalization v1/v2 دست‌نخورده است. انتخاب تازه حتی با فایل‌های یکسان، پیشنهاد قبلی را باطل می‌کند؛ executing/observing/uncertain هرگز آماده replay نمی‌شوند.
- دریافت GitHub با transport مصنوعی روی commit دقیق، زیرپوشه و فایل‌های خصوصی تست شد. traversal، symlink/hardlink، نام تکراری در Windows، فایل بزرگ، gzip ناقص و cancel رد می‌شوند. حدها: 24MiB دریافت، 64MiB بازشده، 5000 entry، 1000 فایل قابل استفاده/20MiB، 512KiB هر فایل، حداکثر 16 snapshot خصوصی. مخزن بزرگ نیازمند ورودی کوچک‌تر است؛ subtree از upstream به‌صورت مستقل دریافت نمی‌شود.
- failure اولیه decoder: رد header بزرگ، child stream را پیش از مالکیت iterator نابود می‌کرد و خطای async پس از پایان تست می‌رسید؛ همان case نگه داشته شد و مدیریت خطای child اصلاح شد. fixture سبز، تأیید archive/redirect حساب واقعی GitHub نیست.

مرز تازه پس از 9845cec: connection جاری هنگام ایجاد/تصمیم/claim پیشنهاد v3 دوباره داخل transaction خوانده می‌شود؛ قطع اتصال بین validation و claim هیچ attempt ایجاد نمی‌کند. تغییر برنامه یا هویت، قطع اتصال و خرابی credential، approval پروژه را باطل می‌کنند؛ stateهای executing/observing/uncertain دست‌نخورده می‌مانند. ورود GitHub پس از پاسخ گم‌شده به همان run برمی‌گردد و دریافت کد سقف 30s جدا از مهلت کل دارد. 9 regression مرتبط domain موفق شدند؛ suite کامل قبلی 55 و HTTP روی build جاری 13 pass بودند. این نتایج با هم به شمارش تازه تجمیع نشده‌اند.

## UX61–64/66 — جریان انتشار و حساب‌ها در UI، پس از 0fd669b

- lint/typecheck/build موفق. Browser تازه در `.artifacts/ux/2026-10-21T19-53-48-323Z/`، 34 حالت روی عرض‌های 280/320/360/390/414/559/560/768/1280؛ صفر page overflow/axe violation/page error/external browser request. screen reader واقعی و تأیید کامل WCAG از این تست نتیجه نمی‌شوند.
- server/DB ایزوله و حساب مصنوعی؛ مسیر پوشه واقعی→بررسی/بسته خودکار→reload/Back/Forward، لغو انتخاب، پوشه ناموجود با حفظ نتیجه، manifest بدون هش، نمونه صریح، کلید نامعتبر، اتصال کنترل‌شده/انتخاب app، پیشنهاد v3، رد/تأیید/عدم انتشار و نمایش executing/uncertain آزموده شدند. حالت‌های عملیات در DB مصنوعی ساخته شده‌اند و شاهد هیچ write واقعی نیستند.
- GitHub device challenge/هویت/مخزن خصوصی/صفحه‌بندی/جست‌وجو/شاخه/زیرپوشه/قطع اتصال با پاسخ کنترل‌شده مرورگر بررسی شدند؛ import واقعی UI با حساب خصوصی تأیید نشده است. domain جدا، دریافت و استخراج archive pinned را با transport مصنوعی می‌سنجد.
- مرور دستی CUA روی production ایزوله: انتخاب پوشه با Enter، بررسی خودکار، focus نتیجه، reload و راهنمای اتصال حساب انجام شد. primary folder chooser در 360×844 برابر 396px از ابتدای سند بود؛ baseline 924px. شروع واقعی CLI در همین شبکه کد نداد؛ لغو بدون grant و بدون ازبین‌رفتن پروژه موفق بود. هیچ credential واقعی Liara یا تماس مدل مصرف نشد.
- failure تعامل: radio برنامه لیارا تا پاسخ server ظاهراً انتخاب نمی‌ماند؛ اکنون intent در حال ثبت جدا از دسترسی تأییدشده نگه داشته می‌شود و failure به مقدار قبلی برمی‌گردد. case حفظ و دوباره اجرا شد. failure انتخابگر تست alert از Next announcer با نام دقیق پیام محصول رفع شد؛ assertion معنایی خطای کلید حفظ شد.
- نتیجه project در SQLite و شناسه در URL است؛ browser localStorage خالی ماند. نام provider داخلی و health endpoint از مسیر عادی انتشار حذف شدند. مسیر عادی مشکل سایت و persistence تمرین پس از reload کار بعدی همین مأموریت است.

## UX63/65 — run پایدار و مجوز بررسی سایت، پس از fd5a70e

- lint/typecheck/build موفق؛ suite کامل domain برابر 59 و HTTP برابر 14 pass، بدون fail/skip. همه transportهای حساب/مدل در موارد تازه مصنوعی‌اند؛ هیچ credential یا مدل واقعی استفاده نشد.
- migration 5 append-only: آخرین 20 نتیجه هر actor و نشانی مجاز بررسی ذخیره می‌شوند. sample comparison به همان مشاهده نخست متصل است؛ actor دیگر یا نوع evidence متفاوت پذیرفته نمی‌شود. GET نتیجه بدون فراخوانی provider است.
- مسیر معمول backend: app انتخابی→نشانه/توضیح پاک‌سازی‌شده→خواندن محدود→شواهد ذخیره‌شده→توضیح علت جدا و gated. gate خاموش/دسترسی اشتباه/URL متفاوت/secret در توضیح پیش از transport متوقف شدند. evidence ذخیره‌شده دوباره redaction و به همان app/host/path متصل می‌شود. مدت پاسخ محدود با واحد میلی‌ثانیه از probe می‌آید؛ زمان بارگذاری کامل سایت یا معیار عملکرد عمومی نیست.
- تحلیل قبل از اولین درخواست claim می‌شود. race، تکرار، cancel و recovery pending جلوی مصرف خودکار دوباره را می‌گیرند؛ پاسخ گم‌شده به معنی صفر هزینه نیست. recheck همان برنامه/صفحه است؛ تغییر نشانی پیش از transport رد و موفقیت مقایسه به علت اصلاح نسبت داده نمی‌شود.
- UI هنوز به endpoint جدید منتقل نشده؛ آزمون browser این slice تکرار نشد. تطبیق since/logs و حساب واقعی، کیفیت تشخیص و اصلاح واقعی همچنان unconfirmed/blocked_live هستند.

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
