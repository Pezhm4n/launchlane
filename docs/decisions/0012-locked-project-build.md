# 0012 — نصب قفل‌شده و بررسی build/start در همان worker

وضعیت: پذیرفته برای npm lockfile v3، Node22 و scope فعلی؛ ۲۰۲۶-۱۰-۲۲. پذیرش عمومی Next، env و تغییر dependency هنوز کامل نیست.

## دلیل و انتخاب

آزمون مستقیم Node در ADR0011 برای پروژه دارای dependency یا build کافی نبود. افزودن shell مدل یا اجرای npm روی میزبان، مرز اجرای source غیرقابل اعتماد را از بین می‌برد. همان CodeRepairJob، تصمیم دارای نشست/expiry، claim، بودجه، worker وصله و artifact حفظ شدند؛ برنامه ساخت یک قرارداد مستقل داخل همین job است.

برنامه سمت host از source استخراج می‌شود: image دقیق Node22.23.3، build/start و test موجود، پورت و همان path/status/assertion. job بررسی اولیه اجازه ویرایش ندارد. بعد از شکست اجراشدهٔ build یا رفتار برنامه، اصلاح محدود می‌تواند همان برنامه و معیار را دوباره اجرا کند. دریافت dependency، integrity، timeout، OOM یا مشکل sandbox به‌خودی‌خود مجوز ویرایش source نیست. تغییر script/dependency، فایل آزمون یا تنظیمات سنجش در این قرارداد اصلاح عمومی مجاز نیست.

دانلود فقط tarball عمومی registry رسمی npm، HTTPS با DNS عمومی pin‌شده و integrity قفل‌شده است. سقف ۵۱۲ ورودی lock، ۶۴MiB هر tarball، ۳۸۴MiB مجموع و چهار دریافت هم‌زمان است؛ هر خواندن از همان budget کم می‌کند. redirect، registry دارای credential، git/file dependency و workspace link رد می‌شوند. npm داخل container از cache تاییدشده، `ci --offline` و scriptهای همان پروژه استفاده می‌کند؛ dependency و script شبکه ندارند. [npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci/) برای lock ناسازگار شکست می‌خورد؛ [cache](https://docs.npmjs.com/cli/v7/commands/npm-cache/) جای تغییر lockfile نیست.

فقط source و tarballهای همین job به‌صورت read-only mount می‌شوند. root read-only، user1000، cap-drop، no-new-privileges، network none، CPU1، RAM/swap2GiB، pids128 و tmpfs1GiB هستند. watchdog اجرای برنامه۱۱۰s، allowance هر container۱۲۰s و کل job حداکثر۳۶۰s و درون سقف تجمعی Agent است. Docker socket و credential میزبان mount یا inherit نمی‌شوند. شناسه پیش از start ثبت و فقط همان ID پاک می‌شود. artifact از source اصلی آزموده‌شده است؛ خروجی build یا dependency ساخته‌شده در container به‌عنوان source صادر نمی‌شود. استقرار همان source و lock را مجدداً build می‌کند و workload ابری هنوز باید جدا سنجیده شود.

مرحله start با `NODE_ENV=production` و PORT مصوب اجرا می‌شود؛ install/build dependencyهای لازم را نگه می‌دارند. envهای خصوصی پروژه در این برش تزریق نمی‌شوند. receipt زمان واقعی را ثبت می‌کند؛ timeout/OOM یا خروجی محدودشده با تست شکست‌خوردهٔ قابل اصلاح یکی نیستند.

مدل همچنان سقف۱۶ ابزار شامل completion دارد. آماده‌سازی محدود Node بدون dependency و build قفل‌شده، دو ابزار جایگزین متناسب با source هستند؛ هر دو در registry مشترک validate می‌شوند. API قدیمی هدف نیز برای job تازه container می‌سازد. runner permission تاریخی برای خواندن/آزمون قراردادهای قدیمی باقی است؛ مسیر Agent تصمیم یا اجرای تازه‌ای با آن نمی‌پذیرد.

ادامه پس از تکمیل حساب، رد تصمیم یا failure یک درخواست structured به همان run است. در تکمیل اولیه حساب و پیش از اثر remote، context حساب با source ثابت قابل تطبیق است؛ انتخاب مادی دیگر منتقل نمی‌شود. شمار مدل/ابزار و زمان مصرف‌شده reset نمی‌شوند. دو nonce برای همان revision یک ادامه می‌سازند. job قدیمی منقضی‌شده لغو می‌شود؛ ادامه، approval تازه تولید نمی‌کند. retry صریح failure دریافت dependency یک proposal تازه با همان plan/criterion و همان بودجه اجازه می‌دهد، نه ویرایش کد یا تکرار خودکار build شکست‌خورده.

## شاهد و محدودیت

`test:build-sandbox` با transport مدل مصنوعی و dependency واقعی دارای integrity، npm install/build/start و GET را در Docker واقعی اجرا می‌کند: پروژه سالم، و پروژه دارای باگ با fail→وصله محدود→همان معیار pass. source اصلی و artifact دقیق سنجیده و containerهای همان job حذف شدند. این شاهد مدل واقعی یا cloud نیست. سه regression تصمیم/اصلاح که اکنون container لازم دارند، به `tests/sandbox` منتقل شدند؛ از suite حذف نشده‌اند.

spike Next با lock نسخه‌های موجود آغاز شد. بسته‌های کوچک و خود Next از cache تطبیق داشتند؛ دریافت چند tarball از جمله compiler لینوکس در مسیر عادی و مسیر خصوصی نصب timeout شد. scope VPN/route سراسری تغییر نکرد. این failure محفوظ است و Next به‌عنوان build تاییدشده معرفی نمی‌شود. نصب خصوصی، install نیازمند شبکه، env ساخت/runtime، monorepo بدون lock مستقل، runtime دیگر و تغییر dependency/command در اصلاح، قرارداد و شاهد بعدی می‌خواهند.

## ادامه ۲۰۲۶-۱۰-۲۳؛ برنامه Node بدون وابستگی

وجود package-lock شرطِ نصب قفل‌شده است، نه نیاز یک برنامه بدون dependency. برنامه build نسخه1 فیلد اختیاری `install=none` دارد؛ نبود این فیلد شکل قراردادهای قبلی و hash آن‌ها را حفظ می‌کند. host فقط وقتی آن را می‌سازد و دوباره می‌پذیرد که package.json تک‌بسته باشد، dependencies/devDependencies/optionalDependencies/peerDependencies خالی باشند و هیچ lockfile شناخته‌شده‌ای وجود نداشته باشد. lock خراب یا dependency اعلام‌شده با skip نصب دور زده نمی‌شود؛ Python نیز این گزینه را نمی‌پذیرد.

همان container، محدودیت‌ها، build/test/start موجود، معیار response و CodeRepairJob استفاده می‌شوند؛ source یا lockfile ساختگی ایجاد نمی‌شود. هر مأموریت structured حتی برای Node بدون dependency، قبل از publication رسید واقعی همین build/start/workload را لازم دارد. وقتی start/port هنوز روشن نیست، ابزار آماده‌سازی محدود قبلی باقی می‌ماند. نبود build script به معنی اجرای build ساختگی نیست؛ start و workload مستقل همچنان بررسی می‌شوند. receipt و جزئیات UI می‌گویند نصب لازم نبود.

archive اکنون LICENSE/LICENCE/COPYING/NOTICE بدون پسوند را نیز با همان کنترل مسیر/secret حفظ می‌کند تا attribution با source همراه بماند؛ نام حساس همچنان مستثناست. آزمون archive، حضور copyright و نبود فایل حساس را بررسی می‌کند. candidate05 ثابت،322domain،37HTTP،6container مرتبط و43حالت guided browser را با build/typecheck و lint بدونerror/35warning/9info گذراند؛ مدل و PaaS آن آزمون‌ها مصنوعی‌اند. شاهد زندهٔ source بدون lock و MCP تا نتیجه هنوز جداگانه لازم است؛ این تغییر پذیرش عمومی Next یا تمام runtimeها نیست.
