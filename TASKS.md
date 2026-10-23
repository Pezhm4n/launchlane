# برنامه اجرایی Launchlane

## تحویل دامنهٔ عمومی؛ ۲۰۲۶-۱۰-۲۴

**https://launchlane-live-1023.liara.run/?view=publish** به backend واقعی متصل است: root/۹asset/health=200 و privileged workspace=401 بدون session، مشاهده20:45:20UTC. web27b14b5 و ingress4e5a55e/release6adbc700bffb36d7841c34b0، state/ledger bind و quick_check تأیید شدند؛ [گزارش کامل](docs/evidence/launchlane-hosted-release.md). خطای421 و source-upload نامعلوم ثبت و رفع مسیر فعال اثبات شد. suite تازه طبق دستور مالک اجرا نشد؛ ورود/انتشار کاربر از public، repair زنده، restart persistence، MCP عمومی، ترب کامل و ماتریس۱۴خانواده همچنان بازند. candidate53 محلی و Login3011 محفوظ‌اند. از بودجهٔ قبلی partition شد و allowance افزایش نیافت.

## اتصال دامنه به backend؛ ۲۰۲۶-۱۰-۲۴

image واقعی Linux از27b14b5 روی VPS با شناسهٔ ثابت ساخته و web/سه worker image/GitHub CLI2.103.0 آماده شدند. release ورودی عمومی ثبت شد. readback داخلی به دلیل تفاوت Host عمومی و SNI خصوصی421 داد؛ ورودی اکنون Host خصوصی را برابر SNI ارسال می‌کند و Caddy Host ثابت عمومی را بازمی‌گرداند. TLS verification و client-auth حفظ شدند. طبق توقف آزمون‌های تازه از سوی مالک، suite تازه اجرا نمی‌شود؛ نتیجهٔ درخواست واقعی دامنه پس از rollout جدا ثبت خواهد شد. ledger اصلی با حفظ تمام allowance/reserveهای تاریخی partition شد: از باقیماندهٔ0.421734دلار،0.2برای نصب عمومی و0.221734برای محلی؛ هیچ allowance افزایش نیافت.

## میزبانی خود Launchlane؛ ۲۰۲۶-۱۰-۲۳ — در حال اجرا

مالک ساخت VPSچهارGB و ورودی کوچک دامنهٔ پیش‌فرض را در همان سقف قبلی۲میلیون تومان تأیید کرد؛ allowance مدل تمدید نشد. account/plan/OS واقعی فقط‌خواندنی تطبیق داده شد. نام بیش‌از۲۰کاراکتر با400 رد شد؛ با رعایت محدودیت کنسول رسمی، یک VPS `launchlane-exec-1023` روی Ubuntu24.04 ساخته و ID/plan/IP خوانده شد. SSH عادی banner timeout داشت؛ اتصال خصوصی همان میزبان از رابط فیزیکی، با host-key و بدون تغییر VPN برقرار شد. Docker29.1.3 و CA/server/client certificate روی همان VPS آماده‌اند. build image محلی به readonly metadata موتور خورد و هنوز موفق معرفی نمی‌شود. بستهٔ standalone، state bind، ingress mTLS و guard همان ledger آماده‌اند؛۹regression مربوط وlint/typecheck پاس. استقرار عمومی، ورود، build/repair و restart persistence تا ثبت شواهد مقصد بازند.

candidate53 از `6a27c66` با output رویC و module lookup همان نصب، پس از failureهای ENOSPC/module-resolve با build موفق روی3000 فعال شد؛۳۸۵runtimefile/index و۹asset واقعی match شدند. ledger۵جدول/config ثابت ماندند؛ مقایسهٔ strict همهٔ stateها ابتدا به دلیل upload تازهٔ Login هنگام تعامل کاربر fail شد، تمام۲۱flow قبلی byte-equal حفظ و flowجدید اضافه شد. نمونهٔ operator_progress نیز با تعامل هم‌زمان تغییر کرد؛ snapshotها ثابت فرض نشدند و reset نشد. grant واقعی MCP و آزمون مرورگر این delta به همکار مربوط واگذار شده‌اند؛ scope عمومی MCP از آن نتیجه نمی‌شود.

## اتصال MCP از نشست ورود لیارا؛ AC28 / ۲۰۲۶-۱۰-۲۳

script قدیمی setup فقط operator-token می‌پذیرفت و با ورود لیارا کار نمی‌کرد. رابط حساب‌ها اکنون grant همان actor/CSRF را یک‌بار صادر و فایل خصوصی آن را دانلود می‌کند؛ CLI با `--from-file`، origin محلی/expiry/scope را validate و `launchlane_context` واقعی را پیش از ذخیره بررسی می‌کند. مسیر operator حفظ شد؛ grant نمی‌تواند scope بیشتری بسازد و token در DOM/log قرار نمی‌گیرد. unit۳/۳، lint مرتبط و typecheck پاس شدند؛ آزمون مرورگر و اتصال همین actor پس از فعال‌سازی candidate53 هنوز بازند. MCP عمومی از این تغییر نتیجه نمی‌شود.

## ورود source دموی جدید؛ AC19/AC22 / ۲۰۲۶-۱۰-۲۳

بررسی فقط‌خواندنی واقعی Login تازه، ternary استاندارد autocomplete را با SENSITIVE_SOURCE رد کرد. regression پیش از اصلاح شکست خورد؛ فقط دو برچسب عمومی در ternary کامل پذیرفته شدند و assignment واقعی، object map، literal دیگر، operator/default، JSON و exact secret همچنان رد می‌شوند. workspace/archive۱۴/۱۴ و inspect واقعی sourceHash `41badd06ce0ca2e804df8583b1a47f3a16298bff1e79bd55cc3402feed898f8f`،۵فایل/۹۰۹۹۵بایت، static80 و missing خالی پاس شدند؛ تشخیص source به معنی انتشار نیست. انتشار خود Launchlane بنا بر دستور تازهٔ مالک، اولویت بعدی و نیازمند backend، دسترسی عمومی، state پایدار و execution واقعی است.

## تحویل قیمت و نتیجهٔ انتشار؛ candidate51 / ۲۰۲۶-۱۰-۲۳

اصلاح قیمت `d320874` و کارت موفقیت `6e9cd5c` روی سرور اصلی فعال‌اند؛ [شواهد](docs/evidence/publication-price-and-success.md). build/typecheck و lint مرتبط،۱۱domain مرتبط، plans۱۴ و expiry/success/copy۸ حالت پاس؛۹asset واقعی و حفظ۲۸جدول state/۵جدول ledger/تنظیمات بررسی شدند. همان تب واقعی کاربر، لینک و کارت نتیجهٔ انتشار ذخیره‌شدهٔ Login را نشان داد. مدل/cloud write تازه و تمدید allowance صفر؛ full-domain و انتشار تازه در این delta اجرا نشدند.

## نتیجهٔ انتشار و لینک؛ A03/A17/AC24/AC27/AC32 / ۲۰۲۶-۱۰-۲۳

کارت موفقیت، دامنه/مسیر کامل، بازکردن سایت و کپی لینک با fallback، جزئیات جمع‌شده و تفکیک صریح از receipt/pending پیاده شد. یازده آزمون رندر مرتبط پاس؛ lint اولیه فقدان aria-hidden مستقیم SVG را یافت و اصلاح شد. مرورگر روی build نهایی با state موقت/پاسخ موفق مصنوعی پاس شد؛ write/cloud تازه برای ظاهر موفقیت انجام نشد. پوشهٔ Login پروژه‌ای مستقل و خارج Git این مخزن است.

## خوانایی قیمت؛ A04/AC20/AC32 / ۲۰۲۶-۱۰-۲۳

فونت کد از مبلغ کارت پلن حذف و نمایش با عبارت فارسی/مقیاس هزار و میلیون و «تومن» جایگزین شد. quote، اختیار و محاسبات دقیق محفوظ‌اند؛ نرخ دقیق زیر «مبلغ دقیق پلن‌ها» دیده می‌شود. پنج آزمون رندر/محاسبه و lint چهار فایل پاس؛ پذیرش build/مرورگر و فعال‌سازی این delta جدا ثبت می‌شود. مدل/ابر تازه صفر و allowance قبلی محفوظ است.

## تحویل نسخهٔ تثبیت‌شده؛ candidate49 / ۲۰۲۶-۱۰-۲۳

برش‌های frontend/env، خلاصه و هزینه، context مدل، بستن پیشنهاد منقضی و foundation خروجی در هفت Conventional Commit موضوعی ثبت شدند؛ [گزارش تحویل](docs/evidence/stabilization-candidate49.md). روی snapshot نهایی: build/typecheck موفق، lint صفرerror/43warning/13info، domain۴۴۱/۴۴۱، HTTP۳۹/۳۹، host/VM۱۰/۱۰ و مرورگر expiry۴/login۸/plans۱۴/platform۱۲ پاس شدند. candidate49/`e170930` روی سرور اصلی فعال و exact assetها، مرورگر۳۶۰/۱۲۸۰، حفظ۲۸جدول/تنظیمات و ledger/reserve تأیید شدند؛ درخواست زندهٔ تازه صفر. این وضعیت، جمله‌های «candidate تازه در حال بررسی است» در برش‌های زیر را برای همین مجموعه جایگزین می‌کند.

A02/A03/A04/A17/A18 در مرزهای گزارش‌شده verified_local هستند؛ A07/A08/A11 و AC19/22/23/27/28 کامل نشده‌اند. Docker frontend/export تازه پیش از assertion/export timeout داشت؛ host pass جای آن نیست. نخستین کار لازم بعدی: pin دوباره تربِ مستقلاً تغییرکرده، اتصال export واقعی به artifact و startup فعلی در خود محصول، دیسک/انتقال consistent داده و usage ledger، انتشار و readback نسخه/رفتار/persistence؛ سپس بقیهٔ ماتریس۱۴خانواده. MCP و connector اجرایی جدا ارزیابی می‌شوند. هیچ allowance تازه یا preparation دستی بیرون محصول مجاز فرض نشده است.

## پایهٔ آماده‌سازی ترکیبی؛ A07/A08/A11 / ۲۰۲۶-۱۰-۲۳

descriptor محدود ASGI/Vite، اعتبارسنجی مستقل manifest/بایت خروجی و مولد entry بدون تداخل root با۱۸آزمون domain و۱آزمون قرارداد bootstrap ثبت شدند. همهٔ این‌ها هنوز foundation مستقل‌اند و descriptor صریحاً `publishable:false` است؛ به application یا اختیار انتشار متصل نشده‌اند. [شواهد و مرز باز](docs/evidence/composite-preparation.md). ترب فعلی root mount و readiness خودش را دارد؛ bootstrap جایگزین آن نمی‌شود. اتصال export واقعی، artifact نهایی، منابع/داده و انتشار کامل در همان Aها باز می‌ماند.

خواندن محدود خروجی container و تطبیق مستقل بایت‌ها،۶regression میزبان دارد؛ parser/MIME خروجی frontend نیز۳/۳ بررسی سبک دارد. export lifecycle هنوز متصل نیست و actual container pass تازه نداریم: baselinefrontend پیش از assertion با cleanup نامعلوم و fixtureexport پیش از export با timeout متوقف شدند. شکاف cleanup تست پس از پاسخ گم‌شده اصلاح و همان منبع با identity پاک شد؛ deadlineها افزایش نیافتند. این برش انتشار کامل ترب یا تأیید container را ادعا نمی‌کند.

## جمع‌بندی برش‌های آماده؛ A02/A03/A04/A17/A18 / ۲۰۲۶-۱۰-۲۳

خلاصهٔ correlated مراحل و برآورد صحیح۲۴ساعت/۳۰روز با۴آزمون رندر/محاسبه بررسی شدند؛ انتخاب پلن همان quote و اختیار موجود را نگه می‌دارد. projection فقط متن source تکراری با رسید کاملِ برابر در همان درخواست را جایگزین می‌کند؛ evidence یکتا، جفت ابزار، oracle و history پایدار حفظ می‌شوند. پیشنهاد انتشار منقضی‌شده در همان کارت بسته می‌شود. بستهٔ مستقل پس از review در `f6a748f` ثبت شد؛ [شواهد و حدود](docs/evidence/reference-improvements.md). نتیجهٔ هدفمند مشترک۱۴/۱۴ است؛ این عدد full-domain یا پذیرش سرور اصلی نیست. پذیرش candidate تازه و مسیر کامل ترب، منابع و سایر۱۴خانواده همچنان ادامه دارند.

پاک‌سازی شکست setup آزمون در `d5a3a4d`، مالک SQLite و پوشهٔ موقت را آزاد می‌کند؛ regression تزریق failure و مجموعهٔ repair هدفمند۹/۹ گذشتند. deadline و oracle قبلی تغییر نکردند. علت timeoutهای تاریخی candidate47 هنوز UNCONFIRMED است؛ subset موفق جای نتیجهٔ کامل۴۰۹/۴۱۰ آن را نمی‌گیرد.

## Native React/Vue/Angular؛ A07/A08/A11 / ۲۰۲۶-۱۰-۲۳

قرارداد19/20، worker بومی Node20 و build واقعی خروجی frontend به موتور مشترک وصل شدند. React خام upstream با failure واقعی output، patch فقط Vite config و آزمون مستقل گذشت؛ Vue/Angular فعلاً قرارداد و تشخیص/runner دارند، نه شاهد compiler و cloud. اصلاح next.nodeVersion، کشف env واقعی و خلاصهٔ وضعیت/برآورد هزینه نیز در همین candidate بررسی می‌شوند. [ADR0028](docs/decisions/0028-native-frontend-build.md)، [شاهد](docs/evidence/native-frontend.md). A11 و پذیرش همه۱۴خانواده همچنان partial؛ ساخت ترکیبی ترب، دیسک/داده، cloud frontend و بقیه خانواده‌ها ادامه دارند.


## ورود سورس خام ترب؛ A07/A11 / ۲۰۲۶-۱۰-۲۳

روی96a38011 ترب، capture ریشه بدون تغییر source اکنون234فایل/2533177بایت را با hash `8f7b99351417f35048cc7265a99df631824f018eb67f95e56858a157527092a2` می‌خواند. variable reference و placeholder صریح تست از credential واقعی جدا شدند؛ تست‌ها حذف/ویرایش نشدند و exact installed secret همچنان رد است. هفت regression scanner پاس؛ این شاهد فقط ورود source است، نه آمادگی start/build/data/publication. start/port و build ترکیبی، دیسک و انتقال SQLite مرزهای بازند. [شاهد](docs/evidence/raw-torob-source.md).

## خطاهای قابل اقدام سرویس؛ A06/A08/A18 / ۲۰۲۶-۱۰-۲۳

402/409/413 اکنون اعتبار/پرداخت، تعارض وضعیت و حجم درخواست را جدا گزارش می‌کنند؛ احراز هویت، rate limit و شبکه اقدام بعدی فارسی دارند و به تغییر بی‌دلیل کد راهنمایی نمی‌شوند. ۱۸ آزمون هدفمند و lint سه فایل پاس شدند؛ مدل/provider مصنوعی و write زنده صفر. claimed write همچنان uncertain و نیازمند journal/readback است؛ این تغییر مجوز retry نیست. [شاهد](docs/evidence/provider-failures.md).

## native Next؛ A07/A08/A11 / ۲۰۲۶-۱۰-۲۳

پس از8b08364، [ADR0027](docs/decisions/0027-native-next-publication.md) و [شاهد](docs/evidence/native-next.md): قرارداد17/18، source/runtime، env، creation/publication/readback، mission authority و UI به مسیر Next متصل شدند؛ platform node نمی‌تواند receipt Next شود. compiler واقعی با dependency قفل‌شده/build/start/GET در Node22 گذشت؛ cloud/model آن صفر و case کنترل‌شده است. پروژه upstream خام در fixture شبیه credential و lock557 متوقف شد؛ تست‌ها حذف یا ویرایش نشدند. **A11 همچنان partial**؛ native Next زنده/پروژه عمومی، سایر خانواده‌ها و source-preparation عمومی الزامی‌اند. بخش‌های تاریخی Next missing با همین مقدار implementation جایگزین می‌شوند، نه با ادعای تأیید کامل.

## Node24 در worker مشترک؛ A07/A10/A11 / ۲۰۲۶-۱۰-۲۳

پس از f5d9ace، [ADR0026](docs/decisions/0026-node24-isolated-build.md): ProjectBuildPlan v3 و image رسمی24.18.0 با digest ثابت به ابزار موجود متصل شدند. source نسخه را انتخاب می‌کند؛ approval قدیمی22 عوض نمی‌شود. domain انتخاب/قید/image mismatch و دو container build واقعی گذشتند؛ چرخهٔ یک اختیار، patch بی‌اثر/مؤثر و publication مصنوعی برای22 و24 نیز اجرا شد. نتیجهٔ candidate نهایی جدا در verification ثبت می‌شود. Node24 cloud/Next عمومی هنوز UNCONFIRMED؛ ادامه روی خانواده‌های دیگر در A11، بدون کاهش دامنه۱۴خانواده.

## Static واقعی و رفع توقف بی‌اثر؛ A07/A08/A10/A11/A18 / ۲۰۲۶-۱۰-۲۳

پس از72618b6: [ADR0025](docs/decisions/0025-native-static-publication.md) و [شاهد Login](docs/evidence/native-static-login.md)، native Static را با create16/deploy15 به همان archive، actor، approval و journal وصل کردند. پوشه اصلی از browser upload، تصمیم هزینه application، انتشار Agent، current release، byte هر سه فایل و تعامل مرورگر گذشت؛ توقف/حذف مقصد تأیید شد. آماده‌سازی بیرون محصول انجام نشد. API-create زنده با Agent-create یکی نیست؛ دو guard تصمیم/ادامه v16 اصلاح و regression شدند، live این قسمت باز است. A11/AC28 همچنان partial و هر۱۴خانواده الزامی‌اند؛ bundler و سایر runtimeها از Static نتیجه نمی‌شوند.

UI علت correlated شکست و قدم بعدی دارد؛ runtime ناموجود و no-progress بدون سؤال/مصرف تکراری متوقف می‌شوند. Node24 هنوز پیاده نشده؛ توقف جای تکمیل آن نیست. سابقهٔ پوشه مفقود برای مدیریت مقصد/حذف باز می‌شود؛ publication بدون source معتبر رد است. دو اجرای کاربر خارج fetch-ledger با سقف۰٫۶۸۷۸۶۶ دلار reserve شدند؛ allowance۲دلار تمدید نشد. candidate نهایی و failure oracle تکرار invalid read در verification ثبت می‌شوند.

## ورود کاربر عمومی؛ A03/A05/A17/A19 / ۲۰۲۶-۱۰-۲۳

برش جدیدِ همین تسک‌ها: ورود ایمیل/رمز/TOTP از قرارداد رسمی CLI لیارا، actor پایدار، کلید رمز‌شده، نشست Secure در HTTPS و انتخاب تیم داخل محصول پیاده شده‌اند. وب و MCP همان actorConfig و application را مصرف می‌کنند؛ توکن/تیم/root/CLI حساب اپراتور به کاربران ارث نمی‌رسد. مسیر اپراتور برای نصب خصوصی سازگار می‌ماند و در حالت عمومی پذیرفته نمی‌شود. [ADR0024](docs/decisions/0024-liara-identity-login.md)، [شاهد](docs/evidence/liara-identity-login.md) و [راه‌اندازی](docs/hosted-access.md) مرزها را مشخص می‌کنند. A03/A05/A17/A19 همچنان partial هستند: login زنده با رمز، حساب شخصی بدون تیم، ساخت تیم، sandbox و استقرار در میزبان عمومی اولین مرزهای بازند. بقیهٔ مأموریت و همهٔ خانواده‌های runtime حفظ می‌شوند.

## حذف پروژه و خطای env؛ A03/A05/A07/A08/A17 / ۲۰۲۶-۱۰-۲۳

زیرکار داشبورد: حذف تأییدشدهٔ نسخهٔ بدون اثر ابری، نگهداری journal و source، رد بازکردن نسخهٔ حذف‌شده و حفظ تصمیم پروژهٔ دیگر پیاده شده‌اند. اثر deploy/create ناموفق و خانوادهٔ repair نیز در server بررسی می‌شود؛ وجود منبع/نتیجهٔ نامعلوم مانع حذف ساده از فهرست است. پنل موجود انتشار و همان پنل داخل دستیار، توقف و حذف مقصد را با ActionSpec v14، claim و receipt مشترک عرضه می‌کنند. [ADR0023](docs/decisions/0023-project-removal-and-stop-receipts.md) و [شاهد](docs/evidence/project-removal-and-env-response.md) مرز محلی و زنده را جدا ثبت می‌کنند. scope نمونه‌ها و صورتحساب از scale صفر استنتاج نمی‌شود. A05/A08 کلی partial می‌مانند.

زیرکار A07/AC22: خطای WELCOME_MESSAGE در read-only واقعی به metadata پاسخ لیارا نسبت داده شد؛ fixture اصلی پس از افزودن همان metadata شکست خورد و adapter اصلاح شد. قرارداد browser input همچنان strict است؛ scope، merge و secret redaction ضعیف نشده‌اند. دکمهٔ چشم، چیدمان فرم، summary کوتاه، ردیف واحد پیشرفت از receipt واقعی و loading انتخاب پلن به جریان موجود متصل‌اند. دریافت تنظیمات موجود پوشه حفظ شده؛ مقدار ناموجود یا فاقد معنای قابل‌اعتماد حدس زده نمی‌شود. env write زنده هنوز از این برش نتیجه نمی‌شود.

زیرکار A16: migration16 و service ساخت/لغو grant محلی MCP در `a8384407` با یک تست روی candidate28 ثبت شدند؛ configuration فقط به فایل خصوصی اشاره می‌کند و state اولیه prepared است. API/رابط تازهٔ این setup و handshake این service هنوز exposed/verified نیستند؛ این کار به معنی تکمیل UI اتصال یا connector اجرایی نیست.

برش زندهٔ lifecycle یک مقصد آزمایشی با شناسهٔ ثبت‌شده را از API محصول ساخت و منتشر کرد؛ نخستین بررسی صفحه503 و failed ماند، سپس خواندن مستقل همان سرویس200 داد. توقف یک بار scale صفر کرد؛ به دلیل applets500 فقط configuration تأیید شد. حذف جداگانه یک بار اجرا و با GET404 تأیید شد، سپس همان سابقه کنار رفت. مدل تازه در این سناریو مصرف نشد و شبکهٔ موجود حفظ شد. اولین مرز اثبات‌نشده: نبود workload زنده پس از توقف، grace محدود پس از READY، صورتحساب منتسب، env/DB زنده و دامنهٔ همهٔ runtimeها. candidate35 با370domain،39HTTP،14حالت پروژه،12پلن،54guided و build/type/lint بدونerror گذشت؛ timeout قدیمی fixture به concurrency نسبت داده نشده است. دستور تازهٔ مالک سقف تجمعی مدل را2USD کرد؛ ledger قبلی0.709037USD حفظ شد، allowance از نو شروع نشد.

## پروژه‌های من و تنظیمات پوشه؛ A03/A07/A08/A17 / ۲۰۲۶-۱۰-۲۳

خواست تازهٔ مالک: انتشارها ترتیبی بمانند؛ اجرای موازی جزو این برش نیست. «پروژه‌های من» به هدر موجود و API scoped وصل شده است؛ فهرست/refresh/open مصرف مدل یا write ابری نمی‌سازند. بازکردن نسخهٔ دیگر، source/archive و مقصد مجاز را بررسی و در transaction، اختیارهای استفاده‌نشده را باطل می‌کند. سابقه و بودجه حفظ می‌شوند؛ نتیجهٔ نامعلوم مانع جابه‌جایی است. زیرکار داشبورد A03/A17 اکنون implemented_verified (local) است؛ candidate27 با361domain/38HTTP/10حالت رابط جدید/2عرض پوشه/54guided و build/type/lint بدونerror گذشت. [شاهد](docs/evidence/project-library-and-environment-import.md) هویت candidate و failureهای واقعی را نگه می‌دارد؛ reader تازه هنوز UNCONFIRMED است.

زیرکار A07/AC22: `.env` ریشهٔ پوشهٔ مرورگر جدا از source دریافت می‌شود؛ پوشهٔ مجاز نصب نیز با خواندن bounded و بدون اجرای script پشتیبانی می‌شود. ورودی actor/source-bound رمزگذاری‌شده، نام‌های قابل مرور و «استفاده از تنظیمات پوشه» به همان v9 merge/approval/readback و reference ساخت وصل‌اند؛ source activation و ذخیره امن اتمیک‌اند. تنظیمات اجرایی، localhost، interpolation و public prefix کنترل جدا دارند. import و اتصال مشترک implemented_verified در مرز محلی/provider مصنوعی‌اند؛ یک container واقعی Node22 با همین ورودی پوشه، install/build/test/start/HTTP و artifact/redaction را گذراند. اتصال DB، env زنده و همهٔ فایل/نسخه/frameworkها از آن نتیجه نمی‌شوند. [ADR0022](docs/decisions/0022-project-library-and-private-environment-import.md) قرارداد و مرزها را ثبت می‌کند. A05/A08/AC22 کلی partial می‌مانند. مصرف مدل/لیارای تازه در این برش صفر است؛ allowance تمدید نشد.

## پلن مشترک، توقف و Codex تا نسخه سالم؛ A03/A04/A05/A06/A08/A17 / ۲۰۲۶-۱۰-۲۳

پلن source-bound و گزینه‌های قیمت‌دار از همان catalog، تغییر اتمیک پیشنهاد/رضایت، حساب خالی بدون الزام کنسول لیارا، ادامه همان run پس از توقف، successor اختیار پس از لغو و migration15 پیاده‌اند. دستیار برای سؤال قیمت همان ابزارهای catalog/quote را دارد؛ کنترل انتشار در دستیار همان پنل و callbackهای صفحه را منتقل می‌کند و مأموریت دوم نمی‌سازد. [ADR0021](docs/decisions/0021-destination-choice-and-resume.md) و [شاهد انتخاب/بازیابی](docs/evidence/destination-choice-and-resume.md) failureها و مرزها را نگه می‌دارند. ظرفیت اندازه‌گیری‌نشده است؛ پیشنهاد کم‌هزینه تضمین ظرفیت نیست.

روی candidate16، همان run/source/budget ناموفق قبلی از Codex MCP ادامه یافت: پیشنهاد مقصد و دو تصمیم واقعی هزینه/برنامه، build500 واقعی، Codex اجرایی با24307token، patch فقط server.js، آزمون مستقل، archive مشتق و release بومی Node22 تا تطبیق نسخه جاری/HTML/API/مرورگر گذشت. [شاهد کامل](docs/evidence/codex-product-publication.md) هویت‌ها، مصرف، startup موقت و cleanup یک DELETE/GET404 را ثبت می‌کند. پس از تصمیم برنامه هیچ کلیک ادامه/approval تازه یا انتقال لاگ لازم نشد. بودجه قبلی تمدید نشد؛ باقی‌ماندهٔ محافظه‌کارانه BoxAPI-only برابر0.131993USD و قیمت مصرف اشتراک Codex همچنان نامعلوم است. این یک demo کاربردی upstream با fault اعلام‌شده است؛ شاهد عمومی هر مخزن، همه۱۴خانواده، DB یا incident پس از release نیست. A05/A06/A08/A10/A16 partial می‌مانند.

زیرکارهای تازه مالک در همان A03/A07/A08/A17 پیگیری می‌شوند: مسیر browser folder upload واقعاً bytes را با مسیر نسبی به snapshot خصوصی می‌فرستد؛ مسیر پوشه‌های مجاز نصب از آن جداست. سقف فعلی1000فایل/20MiB و sync نشدن تغییرات بعدی باید روشن بمانند. تاریخچه داده‌ها حفظ است، اما داشبورد انتخاب و ادامه پروژه‌های قبلی **missing** است؛ اولین مرز، API فهرست scoped و اتصال UI به انتخاب امن همان پروژه است. انتشار هم‌زمان برای یک actor فعلاً **blocked** توسط context فعال مشترک است؛ پیش از رفع قفل، مقصد/اختیار/بودجه و provenance باید مستقل به هر پروژه متصل شوند و تغییر انتخاب، اجرای پروژه دیگر را تصاحب نکند. این قفل محدودیت دائمی محصول فرض نمی‌شود. UI setup MCP، راهنمای دامنه و API منابع، سایر connectorها و ماتریس runtime همچنان در تسک‌های خود بازند.

## انتخاب عامل در برنامه و شکاف مقصد؛ A05/A06/A08 / ۲۰۲۶-۱۰-۲۳

انتخاب داخلی/Codex و fallback محدود به پیش از dispatch در MissionPlan v2 پیاده شد؛ بازبینی پیش از اجرا تاریخچه و ID/hash تازه دارد و approval قدیمی رد می‌شود. روی candidate10،341domain/38HTTP/53حالت مرورگر/2container fallback و build/type/lint بدونerror گذشتند؛ [شاهد](docs/evidence/coding-agent-selection.md). تلاش زنده۵درخواست مدل/23040token و0write ابری/0Codex داشت، اما مدل build را پیش از مقصد پیشنهاد کرد و مسیر برنامه متوقف شد. این failure حفظ است؛ ادامه باید مقصد/پیشنهاد پلن را داخل محصول کامل کند و همان run/budget را نگه دارد. A06/A08 partial؛ budget باقیمانده BoxAPI-only برابر0.217836USD، اشتراک Codex unpriced. درخواست تازه مالک: حذف بن‌بست انتخاب برنامه، پلن متناسب با پروژه، ادامه پس از توقف و راهنمای ساده دامنه در همان مسیر موجود، بدون دورزدن uncertain.

## اتصال اجرایی Codex؛ A06/A18 / ۲۰۲۶-۱۰-۲۳

یک رفت‌وبرگشت واقعی Launchlane→Codex0.163.0-alpha.11 در حالت packet-only، patch محدود و آزمون مستقل Node22 را گذراند و همان parent/authority را تا publication مصنوعی ادامه داد. دو failure اولیه decoder و مصرف نامعلوم اول حفظ شدند؛ ErrorItem رسمی non-fatal بود. accounting خارجی و توقف پیش از fallback موازی اصلاح شدند. [شاهد مستقل](docs/evidence/codex-executable-worker.md) و [ADR0020](docs/decisions/0020-codex-packet-worker.md) حدود را ثبت می‌کنند. A06/AC26 partial؛ اقدام بعد اتصال انتخاب نسخه‌دار و fallback مجاز به همان مأموریت، سپس سایر میزبان‌ها و ماتریس است. باقی‌مانده۰٫۲۴۰۹۷۰دلار فقط ceiling محافظه‌کارانه BoxAPI است؛ مصرف اشتراک Codex قیمت نامعلوم دارد و صفر فرض نمی‌شود.

## چرخه زنده برنامه و MCP؛ A05/A08/A10/A16 / ۲۰۲۶-۱۰-۲۳

روی `fb67971` و candidate06 ثابت، [یک مأموریت واقعی Codex MCP](docs/evidence/codex-publication-mission.md) از upload source کتاب‌فروشی upstream با fault اعلام‌شده، شبکه و app تازه، کارت برنامه، failure500 واقعی، patch worker داخلی، آزمون مستقل، artifact مشتق و انتشار بومی Node22 تا تأیید release جاری/HTML/API رسید. تصمیم‌های ضروری شبکه، هزینه مقصد و برنامه ثبت شدند؛ پس از تأیید برنامه هیچ تصمیم/ادامه تازه یا جابه‌جایی لاگ لازم نشد. reconnect و duplicate/replay پس از descendant صفر مصرف/write تازه داشتند. برنامه با ID/404 پاک شد؛ GC شبکه هنوز UNCONFIRMED است. A05/AC23، A08/A10 و A16 همچنان partial؛ connectorهای اجرایی، DB، dependency/monorepo و همه خانواده‌های جدول بازند. ۱۱ درخواست/۹۷۰۳۹token واقعی مدل، ceiling افزوده۰٫۰۹۷۴۹۶دلار؛ از همان۰٫۸دلار قدیمی،۰٫۲۴۰۹۷۰باقی است. قدم بعد، connector اجرایی Codex با همان patch/test/artifact/policy و fallback معتبر است.

## شبکه لازم برای حساب خالی؛ برش A05 / ۲۰۲۶-۱۰-۲۳

اولین اجرای زنده candidate05 پیش از مدل/write به `networks=[]` متوقف شد؛ خواندن مستقل همان تیم نیز خالی بود. وابستگی دائمی به شبکه ازقبل‌آماده رفع می‌شود: ActionSpec v13، پذیرش صریح تعرفه نامعلوم، migration12 افزوده، claim/journal و تطبیق ID از readback حساب، در application مشترک وب/AgentRun پیاده شدند. مسیر guided کارت تصمیم دارد و پس از هویت شبکه همان run/budget را ادامه می‌دهد؛ ساخت app و اختیار publication جدا می‌مانند. پاسخ گم‌شده و شبکه هنوز نامرئی به retry نوشتن تبدیل نمی‌شوند. [ADR0019](docs/decisions/0019-required-private-network.md) و [شاهد](docs/evidence/required-private-network.md) حدود و آزمون‌های candidate را ثبت می‌کنند. A05/AC23 همچنان partial؛ ساخت شبکه و چرخه کامل اصلاح/انتشار زنده هنوز UNCONFIRMED است. هزینه شبکه صفر فرض نشده است.

## source بدون وابستگی و حفظ مجوز؛ برش A07/A11 / ۲۰۲۶-۱۰-۲۳

Node بدون dependency و lock با `install=none` سرور-اعتبارسنجی‌شده از همان build/repair/workload/artifact می‌گذرد؛ lock خراب و dependency اعلام‌شده از این استثنا استفاده نمی‌کنند. همه مأموریت‌های structured پیش از publication به رسید واقعی همین بسته نیاز دارند. فایل LICENSE/NOTICE بدون پسوند در archive حفظ می‌شود. candidate05 با322domain،37HTTP،6container واقعی مرتبط و43حالت guided browser، build/typecheck/lint بدونerror گذشت؛ provider/model مصنوعی و source اصلی محفوظ‌اند. [ادامه ADR0012](docs/decisions/0012-locked-project-build.md) شرایط و compatibility را ثبت می‌کند. A07/A11 همچنان partial؛ اقدام بعد، همین چرخه از انتخاب source خام و میزبان MCP تا نتیجه زنده، و سپس آماده‌سازی واقعی monorepo/وابستگی و تعمیم ماتریس است. نمونه کتاب‌فروشیِ upstream صرفاً یک case کنترل‌شده است؛ از آن ادعای عمومی پروژه‌های دلخواه ساخته نمی‌شود.

## مرکزچین دسکتاپ، اسکرول آزاد و نشان runtime؛ verified_local / ۲۰۲۶-۱۰-۲۳

AC32: پنل بزرگ دسکتاپ با سقف۹۲۸px و ستون وسط۸۳۲px، پاسخ۱۴px در موبایل/دسکتاپ، آیکون کپی۱۴px با هدف۴۴px، تب‌های وسط‌چین دسکتاپ و نشان محلی Node.js/Python از runtime بررسی‌شده پیاده شدند. دسکتاپ در هر دو اندازه non-modal است؛ قفل سراسری فقط dialog:modal را دنبال می‌کند و موبایل تمام‌صفحه/modal می‌ماند. unknown برند حدسی نمی‌گیرد. روی مبنای695773d و tree کد49a07739d0a7391bafdef0028cdbc8fc2fe4a748، build/typecheck/lint بدونerror،۳۷HTTP و۷suite مرورگر/۱۶۹حالت گذشتند؛ full aggregate۱۲suite ادعا نمی‌شود. شواهد و failure اولیه در verification ثبت‌اند. گوشی/کیبورد فیزیکی و پذیرش بصری هنوز بازند. بنا بر درخواست تازه مالک آزمون دیگری اجرا نمی‌شود؛ اقدام بعد آزمون انسانی همین نسخه است. تغییرات backend همکار خارج این برش حفظ شده‌اند.

## دستیار با اولویت فضای خواندن؛ verified_local / ۲۰۲۶-۱۰-۲۳

AC32: پنل تمام‌صفحهٔ موبایل، پاسخ۱۴px بنا بر بازخورد تازه، ورودی یک‌خطیِ رشدکننده با ارسال کناری، toolbar/metadata فشرده، «آخرین پیام» بدون مصرف ارتفاع، expand/collapse دسکتاپ و بازچینی نمایشگر عریض پیاده شدند. در۳۷۵×۶۶۷، پیام‌ها۵۰۲٫۱px/۷۵٫۲۸٪ و کنتراست پاسخ۱۴٫۳۷:۱ اندازه‌گیری شد. build/type/lint نهایی،۳۷HTTP روی build پیشین همین برش،۱۰suite اولیه/۲۶۳حالت و سپس chat۱۳/studio۴۳/motion۱۴ پس از اصلاح focus گذشتند؛ aggregate کامل تازه ادعا نمی‌شود. شواهد/شکست‌های نخست در verification و DESIGN ثبت‌اند. مرز باز: گوشی/کیبورد/screen reader واقعی، fps و پذیرش بصری؛ اقدام بعد بازخورد انسانی همین نسخه است. تغییر authority هم‌کار در فایل مشترک حفظ و از این کامیت جدا شده است.

## اختیار برنامه و تبار artifact؛ A05/AC23 verified_local / ۲۰۲۶-۱۰-۲۳

قرارداد مستقل MissionPlan v1/revision1 و migration11، تصمیم انسانی actor/session/hash/revision، حدود build/repair/publication، مقصد و plan/bundle/network ثابت، قیمت پایه زنده با تومان/ساعت، همان build/workload/env و بودجه پایدار مأموریت پیاده شدند. driver مراحل داخل محدوده را در همان اجرا ادامه می‌دهد؛ هر job/انتشار پیش از اجرا رزرو می‌شود و claim، worker و زنجیره artifact رسید میزبان را دوباره بررسی می‌کنند. تکرار درخواست اولیه پس از انتخاب artifact مشتق هم به همان مأموریت می‌پیوندد. کد و [ADR0018](docs/decisions/0018-bounded-mission-authority.md) هنوز جای شاهد زنده را نمی‌گیرند.

اولین آزمون container واقعی، build fail، patch بی‌اثر با آزمون fail، اصلاح دوم با آزمون pass، انتخاب همان artifact و publication مصنوعی را با یک تصمیم گذراند. خطای harness چندخطی پیش از آزمون اصلاح و خروجی اولیه حفظ شد. چهار regression اختیار، replay/rollback/session/scope، منشأ اثبات‌نشده، تغییر قیمت، recovery و reject را بررسی می‌کنند. candidate03 دارای320domain و candidate04 نهایی دارای22domain مرتبط،37HTTP،5container و43حالت guided browser با build/typecheck/lint بدونerror است؛ [تفکیک snapshotها](docs/evidence/mission-authority.md) و شکست‌ها حفظ‌اند. شاهد مدل/PaaS واقعی این برش هنوز باز است؛ A05/A08/A10 partial می‌مانند. این برش از پیشنهاد build با مقصد موجود شروع می‌شود؛ source خام عمومی، ایجاد منابع، connector اجرایی و تمام۱۴ runtime همچنان دامنه الزامی‌اند. timeoutهای قبلی fixture علت قطعی ندارند؛ concurrency1 اثبات علت نیست. اقدام بعد: چرخه زنده از source خام؛ مسیر بدون dependency/lock نیز باید از همان build/repair/workload و artifact استفاده کند، نه آماده‌سازی دستی بیرون محصول؛ سپس مأموریت MCP و connector اجرایی.

## موبایل فشرده، فونت لاتین و حرکت محسوس؛ verified_local / ۲۰۲۶-۱۰-۲۳

AC32: تب‌بار پایین زیر۷۶۸، header۵۶px، launcher آیکون، مقیاس مستقل متن/کارت/دکمه با هدف لمس۴۴، Geist محلی/OFL، نام پروژهٔ bidi در خط جدا و ورود۴۲۰ms هر view پیاده شد. build/type/lint نهایی روی 7196471d4c41b141bfc0539edbba4618ab38f8ea و tree f5cad1d38052968d1a36af59de36e981cbc16379 گذشت؛۳۱۵domain،۳۷HTTP و۹suite مرورگر روی tree پیش از اصلاح تراز نام گذشتند، سپس mobile۱۰ و studio۴۳ روی export نهایی دوباره pass شدند. هر۱۰suite/۲۶۳حالت بررسی شده‌اند؛ aggregate کامل تازه ادعا نمی‌شود. glyph واقعی Geist، درخشش بدون hover،۲۰۰٪ متن و حفظ draft تأیید شدند. failureهای نخست و محدودیت کیت۱۲/۵۲ در verification ثبت‌اند. مرز باز: دستگاه/کیبورد/screen reader واقعی، fps و پذیرش بصری مالک؛ مسیر اصلی مرحله‌ای و اختیاری‌بودن چت حفظ است. اقدام بعد: بازخورد مرور انسانی همین نسخه؛ قابلیت ابری تازه‌ای در این برش ادعا نمی‌شود.

## اعتبار اختیار MCP در پس‌زمینه؛ برش A16 / ۲۰۲۶-۱۰-۲۳

ترکیب پس از commit مستقل UI در560cc68نیز در export ثابت با۲۷۰فایل مطابق index، build/typecheck، lint بدونerror با۳۶warning/۹info موجود،۳۷HTTP،۳۸guided و۱۰mobile گذشت. این subset، full domain/sandbox/browser تازه نیست؛ نتایج snapshotهای قبلی جدا باقی‌اند. تغییرات و runner موبایل همکار وارد commit این برش backend نمی‌شوند.

A16/AC23/AC24: لغو/انقضای نشست والد و فرزند، پیش از شروع، مصرف و پذیرش نتیجهٔ مأموریت هم بررسی می‌شود. regression قبل از fix یک درخواست مصنوعی پس از revoke نشان داد؛ اکنون شروع۰ و پاسخ دیررسِ ردشده با مصرف محفوظ سنجیده شدند. یک regression اولیهٔ context/recovery بدون تغییر آزمون crash/adoption رفع شد؛ سه timeout fixture نیز محفوظ‌اند. فرمان domain فایل‌ها را با هم‌زمانی۱اجرا می‌کند؛ deadline/oracle/race داخلی تغییر نکرد. snapshot نهایی پس از7196471، build/typecheck/lint بدون error،۳۱۶domain،۳۷HTTP،۴container واقعی مرتبط،۳۸guided browser و Codex۳call واقعی/cleanup را گذراند؛ مدل/cloud واقعی۰. [شاهد دقیق](docs/evidence/mcp-shared-application.md) نتایج قبلی را از این revision جدا نگه می‌دارد. A16 همچنان partial و مأموریت کامل محصول باز است.

## تعامل و خوانایی رابط؛ verified_local / ۲۰۲۶-۱۰-۲۳

AC32: تب‌های واضح، composer مستقل، گزارش قابل تفکیک، نام فارسی، footer منظم، حرکت تصویر/launcher و خروج واقعی dialog/ارتفاع disclosure پیاده شدند. بازگشت focus زیر header اندازه‌گیری‌شده است. build/type/lint،۲۹HTTP و نه browser suite با۲۵۱حالت روی برنامهٔ ایزوله گذشتند؛ suiteها پس از اصلاح پیش‌شرط scroll، بخشی مستقل اجرا شدند. Domain۳۰۷/۳۰۷ برش منبع حفظ است؛ backend تغییر نکرد. شکست‌ها و شرایط دقیق در verification ثبت‌اند. مرز باقی‌مانده دستگاه/کیبورد/reader واقعی و پذیرش بصری مالک است؛ مدل و Liara واقعی برای این UI اجرا نشدند. تغییرات جاری backend/MCP و وابستگی‌های همکار جدا و دست‌نخورده می‌مانند.

## تطبیق مأموریت کامل با پایه 6ae5c38؛ ۲۰۲۶-۱۰-۲۳

A01 دوباره با HEAD/source تطبیق شد: graph نسل2026-10-21T19:24:24Z برای Agent جدید not_tracked و برای policy/runtime قدیمی metadata_changed است؛ source دقیق مرجع این برش است. تمام اسناد ورودی مأموریت، ADR0013–0015 و شواهد Python/آماده‌سازی/برش نخست خوانده شدند. UI/UX و source picker هم‌زمان، مالکیت مستقل دارند؛ backend روی main و بدون branch/worktree تازه اجرا می‌شود.

زیرکارهای مأموریت در همان Aها دنبال می‌شوند: A05/AC23 قرارداد نسخه‌دار اختیار چندمرحله‌ای و تبار artifact مشتق؛ A06 اتصال اجرایی مستقل داخلی/Codex/Claude Code/OpenCode و fallback بدون اجرای موازی نامعلوم؛ A07 آماده‌سازی source خام و root مبهم؛ A08/A10 چرخه شکست انتشار→اصلاح→انتشار همان artifact؛ A11 ماتریس هر۱۴ خانواده رسمی و نسخه/فرمان/مسیر native یا Docker و پروژه واقعی؛ A14 منابع موجود/جدید، secret reference و اتصال واقعی database؛ A16 facade مشترک HTTP و stdio، سپس آزمون مستقل سه میزبان؛ A18 ledger تجمعی بدون تمدید allowance؛ A19 setup و candidate مستقل. دامنه runtime دیگر به Node/Next و فقط یک خانواده متفاوت محدود نیست؛ شواهد تاریخی محدود حفظ می‌شوند.

اولین برش A16/AC31 در8aa5a9d ثبت شد: SDK رسمی2.3.1، token محدود/عمرمحدود وابسته به نشست اپراتور، registry خواندن مشترک، lifecycle همان مأموریت، HTTP در process وب و stdio bridge بدون Store دوم. domain310 با concurrency2، HTTP نهایی37، build/typecheck و هفت browser75/27/27/22/38/5/39 روی export ثابت پایه6ae5c38 گذشتند؛ Codex0.163.0-alpha.11 discovery و۳call واقعی با cleanup تأییدشده داشت. دو timeout اجرای موازی308/310 و failureهای harness حفظ‌اند. مدل/cloud-write0؛ فقط دو GET واقعی حساب. [ماتریس۱۴خانواده و شکاف‌ها](docs/platform-support.md)، [شاهد MCP](docs/evidence/mcp-shared-application.md) و [setup](docs/mcp.md) مرزها را ثبت می‌کنند. UI همکار در6e54988 جدا commit شد و شاهد export قبلی، پذیرش ترکیب نهایی آن نیست. اختیار چندمرحله‌ای، connector اجرایی و runtimeهای missing همچنان بازند.

## تثبیت مرز بودجه MCP؛ verified_local / ۲۰۲۶-۱۰-۲۳

A16/AC23/AC24: schema publication با parser وب مشترک شد؛ read مستقیم، allowance و زمان همان مأموریت متوقف‌شده را با reserve/CAS مصرف می‌کند و مالک فعال جلوی read موازی را می‌گیرد. regression مسابقهٔ یک سهم/دو درخواست و عدم تمدید مدل گذشت؛ شکست نخست حفظ شد. فرمان domain هم‌زمانی۲ دارد، بدون تغییر oracle/deadline. روی candidate ثابت پس ازb59eef9، build/typecheck،۳۱۱domain،۳۷HTTP، فرمان کامل browser (هفت suite۷۵/۲۷/۲۷/۲۲/۳۸/۵/۴۳، انتخاب پوشه۲ و motion۱۲)، sandbox۹ و locked build واقعی Node22/env۱ گذشتند. npm ci مستقل آفلاین و setup/Codex۳call واقعی نیز گذشتند؛ مدل/cloud-write0. [شاهد تفکیکی](docs/evidence/mcp-shared-application.md) حدود و failureها را نگه می‌دارد. A16 همچنان partial؛ اختیار چندمرحله‌ای، connector اجرایی و پوشش خانواده‌های دیگر بعدی‌اند.

## پیوند job اصلاح به مأموریت؛ برش A06 / ۲۰۲۶-۱۰-۲۳

A06/AC26 و پیش‌نیاز A05/AC23: host، parentRunId را در CodeRepairJob، consent و packet می‌بندد. build/preparation/repair و review همین والد را حفظ می‌کنند؛ worker بدون والد working، job/source جاری، تصمیم/نشست معتبر و RunBudget با سقف/مصرف/deadline همان run claim نمی‌شود. legacy/null و canonicalization قدیمی محفوظ‌اند. regression والد دیگر، لغو، source عوض‌شده، job جایگزین، انقضا، نشست لغوشده و بودجه نو/بزرگ/تمدیدشده اضافه شد؛ same-test واقعی و patch غلط حفظ‌اند. [شاهد مستقل](docs/evidence/repair-parent-binding.md) نتایج candidate و وضعیت UI هم‌زمان را دارد. اختیار یکجای plan، تبار کامل artifact، raw preparation و connectorهای اجرایی هنوز بازند؛ این برش A05 یا A06 را کامل نمی‌کند.

## انتخاب پوشهٔ دلخواه؛ verified_local / ۲۰۲۶-۱۰-۲۳

AC32: انتخاب بومی پوشه با پیش‌نمایش، پالایش مشترک و کپی خصوصی، بدون وابستگی به workspaceRoot پیاده شد. build/type/lint،۲۹HTTP،۷۵حالت میزکار و انتخاب واقعی پوشه در دو عرض گذشتند. Domain موازی یک timeout داشت؛ همان۳۰۷تست با هم‌زمانی۲ گذشتند. ADR0016 و verification مرزها و failure اولیه را نگه می‌دارند. اقدام بعد: تکمیل خوانایی گزارش، تب‌ها، composer و حرکت واقعی رابط. انتشار و مدل زنده در این برش اجرا نشده‌اند.

## دستیار روشن و رابط واکنش‌گرا؛ verified_local / ۲۰۲۶-۱۰-۲۳

AC32: نام روشن دستیار، composer پایین، پیشنهاد بدون ارسال، فونت کوچک‌تر، دکمه موبایل با لمس حداقل۴۴px، گزارش با سلسله‌مراتب و لوگوی کوچک لیارا پیاده شدند. build/typecheck/lint،۳۰۰domain،۲۸HTTP و هفت browser suite با۲۳۳حالت گذشتند. combined UI نیز۳۹حالت studio و۱۲حالت probe محلی حرکت گذراند؛ runner قدیمی همچنان failure ثبت‌شده دارد؛ هیچ hunk همکار در commit UI نیست. failureها، داده‌های مصنوعی و ریسک زمان‌بندی cancel در verification حفظ‌اند. مرز باقی‌مانده، دستگاه فیزیکی/کیبورد مجازی/screen reader واقعی و ارزیابی با کاربر تازه است؛ هیچ ادعای live یا بهبود عددی UX از این برش نمی‌شود.

## بازطراحی قاب انتشار؛ verified_local / ۲۰۲۶-۱۰-۲۳

هویت سرمه‌ای/نعنایی، معرفی با SVG ایزومتریک اختصاصی، انتخاب منبع خوانا و خلاصهٔ کم‌ارتفاع پروژه پیاده شد. build با TypeScript، lint بدون error و دو browser suite75/38 روی index مستقل گذشتند. اصل/شاهد synthetic و دو failure متن بزرگ در verification ثبت‌اند. تغییرات هم‌زمان Python در main حفظ و hunkهای UI ثبت‌نشده همکار کنار گذاشته شدند. تکمیل دستیار شناور، پیشنهادهای چت و اعتبارسنجی نهایی کار بعدی است؛ هیچ provider/model زنده مصرف نشد.

## بستن مرز secret در env عمومی Next؛ پس ازf2df50d

فرم، API، اجرای grant قدیمی و مرجع build، secretKey با پیشوند NEXT_PUBLIC_ را رد می‌کنند؛ مقدار عمومی فقط با اعلام صریح و هشدار افشا مجاز است. parser تاریخی حفظ شده و credential نصب مستقل ممنوع است. redaction مقدار موروثی با نام credential regression دارد؛ محدودیت تشخیص مستند است. build/typecheck، domain283/283، HTTP28/28 و شش suite مرورگر75/27/27/22/38/5 گذشتند؛ lint صفر error با30warning/9info. این‌ها روی snapshot مستقل و transport مصنوعی‌اند. Next/GitHub و env زنده، fail-deploy→repair→redeploy تازه، UI ترکیبی همکار و reader/موبایل فیزیکی بازند؛ مصرف و سرور زنده تغییر نکردند. [شواهد دقیق](docs/verification.md) و [تصمیم](docs/decisions/0013-project-environment.md).

## اصلاح recovery اطلاعات امن؛ پس از042cbb8

تصمیم approved در نشست قدیمی با مجوز نشست جدید اجرا نمی‌شود؛ actor می‌تواند فقط grant بدون attempt را لغو و فرم خالی/nonce تازه را مرور کند. پس از claim لغو رد می‌شود. executing، پیام درست و دکمه دریافت همان وضعیت دارد؛ recovery claimed پیش از write با readback به not_started می‌رسد. AUTH_REQUIRED از فرم به ورود برنامه برمی‌گردد. regression domain و مرورگر شامل نشست قبلی، لغو، in-flight فقط‌خواندنی و recovery بدون POST دوم است؛ نتیجه نهایی در verification ثبت می‌شود.

## اتصال env به build و انتشار؛ پس از37beb7a

A05/A07/A08/AC22 به همان reference متصل‌اند: تصمیم build نام کلیدهای تزریق‌شده را نشان می‌دهد، worker از stdin و log driver none استفاده می‌کند و archive source بدون مقدار می‌ماند. v10، reference و configuration را به مجوز انتشار می‌بندد؛ parser/canonicalization تاریخی محفوظ و migration تغییر نکرده است. build با env قبلی، تغییر قبل از upload یا تغییر بعد از HTTP200 تأیید نمی‌شوند. مجوز مصرف‌نشدهٔ env نامعتبر fail می‌شود و اثر configuration با انتشار سالم یکی نیست. [ADR0014](docs/decisions/0014-build-environment-binding.md).

یک case واقعی Docker، install/build/تست موجود/start/GET را در همان mission با مقدار مصنوعی گذراند؛ source محفوظ، secret در receipt/archive نبود و container همان ID پاک شد. دو case سالم و اصلاح build نیز با runner تازه گذشتند؛ مدل و cloud مصنوعی‌اند. نتیجه gateهای نهایی در verification ثبت می‌شود. Next/GitHub دارای build زنده، env زنده و چرخه تازه fail-deploy→repair→redeploy هنوز پذیرش ندارند؛ هماهنگی و شواهد تست زنده همکار در afbbf0c حفظ شده‌اند و بودجه/سرور او تغییر نکرده است.

## تکمیل runtime env؛ پس از6230e6a و مستقل از آزمون زنده همکار

A05/AC22 اکنون فرم امن همان انتشار، ActionSpec v9، migration10 افزوده، reference رمز‌شده و HMAC، حفظ کلیدهای موجود، claim/journal و readback configuration دارد. تصمیم و خواندن/نوشتن بودجه همان مأموریت را مصرف می‌کنند؛ ادامه بودجه تازه نمی‌سازد. رد/انقضا/نشست دیگر/مبنای تغییرکرده، ciphertext دستکاری‌شده، پاسخ گم‌شده و اجرای هم‌زمان آزموده شدند. source/پلن/هویت app بسته می‌شوند و credential نصب به برنامه مشتری منتقل نمی‌شود. [ADR0013](docs/decisions/0013-project-environment.md) محدودیت CAS provider و retention/redaction را ثبت می‌کند.

این برش پذیرش زنده env، restart کامل، env ساخت محلی یا GitHub/Next را ادعا نمی‌کند. تست‌های تازه در candidate مستقل با transport مصنوعی‌اند؛ سرور اصلی، اتصال، VPN و دفتر مصرف مشترک دست‌نخورده ماندند. نتیجه دقیق gate در verification ثبت می‌شود؛ اقدام بعدی اتصال مرجع env به تصمیم build و اثبات workload همان نسخه است.

آخرین وضعیت: ۲۰۲۶-۱۰-۲۲، Asia/Tehran. پس از هر مرحله به‌روزرسانی شود؛ وضعیت done فقط با شواهد پذیرش معتبر است. برنامه A00–A19 مأموریت توسعه جاری است و سوابق پایه پایین آن حفظ شده‌اند. برش نخست موتور/اصلاح در `b3ebf55` ثبت شد؛ [گزارش Agent](docs/evidence/agent-first-slice.md) مرز اجرای واقعی، مصنوعی و کارهای باز را مشخص می‌کند.

## تصمیم جاری محصول و برش انتشار هدایت‌شده

تصمیم ۲۰۲۶-۱۰-۲۲، تب مستقل/پیش‌فرض دستیار را جایگزین می‌کند: فقط انتشار و بررسی مشکل؛ چت اختیاری. A03/A17 اکنون مسیر مرحله‌ای و دکمه‌ای در انتشار را دنبال می‌کنند؛ A02/A05/A06/A08 همان موتور و policy هستند. ثبت structured، تاریخچه scoped، join هم‌زمان، قفل/ابطال تصمیم و worker container Node22 پیاده‌اند. دو چرخه محدود مدل/PaaS واقعی با فرم و دکمه، یکی آماده و دیگری با باگ→تست fail→patch→همان تست pass→انتشار، گذشتند. منبع اصلی محفوظ و هر دو مقصد با ID و404 پاک شدند.

وضعیت هسته همچنان partial است. A07/A11 برای dependency/build عمومی Node/Next و A05/AC22 برای env امن بازند؛ چرخه جدید شکست انتشار سپس redeploy، GitHub دارای build روی این تجربه و reader/screen-reader نیز پذیرش تازه ندارند. تحقق A10 از شاهد تاریخی جداست. هیچ‌کدام done اعلام نمی‌شوند. آزمون‌ها و failureهای همین برش در [گزارش](docs/evidence/guided-publication.md) و [verification](docs/verification.md) ثبت می‌شوند.

هسته این برش در `568345a` کامیت شد: روی export دقیق index، domain256/256، HTTP مأموریت5/5، build و lint بدون error گذشتند؛ lint28 warning و1info موجود داشت. فاز بعدی dependency/build و env است؛ موفقیت worker آزمون مستقیم، جای شاهد این دو قابلیت را نمی‌گیرد.

## سوابق مأموریت Agent استقرار و نگهداری

برش بعد از `802685e`: A07/A11 برای npm v3 در Node22 توسعه یافت. همان CodeRepairJob برنامه immutable install/build/start/workload و تصویر دقیق می‌گیرد؛ تصمیم اولیه اجازه ویرایش نمی‌دهد، انتشار بدون رسید همان source/معیار رد می‌شود و اصلاح build از همان معیار استفاده می‌کند. دو case Docker واقعی با مدل مصنوعی، یکی سالم و یکی fail→patch→pass، گذشتند؛ اثر cloud صفر و source اصلی محفوظ بود. درخواست تازه از API قدیمی نیز container لازم دارد. سه regression نیازمند Docker به `tests/sandbox` منتقل و در `test:sandbox` باقی ماندند. Next به‌علت دریافت ناموفق چند tarball هنوز UNCONFIRMED است؛ env، تغییر dependency و فرمان در پروژه دارای build، و مسیر GitHub/build زنده، کار بعدی‌اند. [تصمیم و حدود](docs/decisions/0012-locked-project-build.md).

رفتار هدف در [agent-experience](docs/agent-experience.md) و پذیرش در [AC17–AC34](docs/acceptance.md) تعریف شده‌اند. حلقه چندابزاری، اصلاح محدود Node و انتشار از گفت‌وگو برای ورودی‌های کنترل‌شده اجرایی و زنده سنجیده شده‌اند؛ پذیرش عمومی کل هسته هنوز باز است. خروجی دانلودی handoff جای اتصال اجرایی را نمی‌گیرد.

پیش از شروع A01، آخرین HEAD، diff و task جاری بازبینی شوند. اصلاحات GitHub/ورود و کارهای هم‌زمان پایین این بخش، بدون بررسی نتیجه کنار گذاشته یا تکرار نشوند. وضعیت «موجود در پایه» با پذیرش capability جدید یکی نیست. برای هر task، scope فایل‌ها پس از trace منطق واقعی مشخص شود.

| Task / فاز | هدف و محدوده | وابستگی | پذیرش | آزمون و شاهد لازم | وضعیت |
| --- | --- | --- | --- | --- | --- |
| A00 / مشخصات | هماهنگی هدف، معماری، طراحی، acceptance و نقشه کار | تصمیم محصول | سند مرکزی و ارجاع‌های سازگار؛ قابلیت آینده از موجود جدا | بررسی لینک‌ها، IDها، diff و local exclude؛ هیچ ادعای UI/live تازه | done_docs؛ لینک‌ها و ۲۰ task/۱۸ AC جدید و DAG بررسی شدند؛ فقط اعتبارسنجی مستندات |
| A01 / بازیابی | inventory شکاف‌ها، reuse ابزارهای فعلی و تعیین اولین slice اجرایی | A00 و candidate جاری | AC17/18/32؛ هر مورد implemented_verified/partial/missing با source/test | trace مسیر model→tool→application و UI؛ API/CLI نصب‌شده؛ جدول شکاف کوتاه در گزارش | done؛ پایه ef5a3fb، source fallback برای graph قدیمی، CLI/help و جدول شکاف در گزارش Agent؛ GitHub/ورود بازنویسی نشد |
| A02 / موتور | registry typed چندابزاری، AgentRun پایدار، loop و outcome | A01 | AC17/18/24؛ هدف و نتیجه واقعی ابزار قدم بعدی را عوض کنند | tool انتخاب غلط/تکرار، malformed args، truncation، 429، cancel، crash، replay و context تغییرکرده؛ یک trace مدل واقعی | partial؛ registry چندابزاری، CAS/event/idempotency، بودجه مشترک worker و completion دارای schema؛ domain227 و HTTP21؛ مسیر واقعی inspect و آماده‌سازی→ساخت→انتشار همان artifact گذشت. تأیید یکجای plan و env باز است |
| A03 / رابط پایه | مکالمه، context پروژه، picker، سؤال/تصمیم و progress به موتور واقعی | A02؛ componentهای موجود | AC18/24/32؛ درخواست انتشار از وب‌اپ به ابزار موجود برسد | UI/API/SQLite واقعی محلی، keyboard/RTL، 360/768/1280، reload و error/cancel؛ بدون چت نمایشی | partial؛ تب مستقل، picker و تصمیم اصلاح/ساخت/انتشار به موتور واقعی متصل‌اند؛ شش suite ثابت مرورگر75/27/27/22/20/5 و دو آماده‌سازی واقعی و یک هدف کامل ثبت شد. نصب اصلی پس از فعال‌سازی مجاز با دو model call واقعی و reload بدون replay گذشت؛ UI همزمان و پذیرش عمومی/reader تازه باز است |
| A04 / تصمیم استقرار | catalog، قیمت/واحد، انتخاب روش و پلن و نقشه منابع | A01؛ حساب متصل | AC20/23؛ پیشنهاد با دلیل و جایگزین و هزینه معتبر | catalog واقعی، غیرفعال/ناموجود/قیمت نامعلوم، تغییر انتخاب، scope و unit؛ مقایسه دو profile | partial؛ catalog/quote نسخه‌دار و gate/account/budget، خواندن واقعی 24 ترکیب و پیشنهاد مدل واقعی با جایگزین/نرخ تومان‌ساعت؛ domain 199/199. approval ساخت با همان quote و بازبینی هزینه اجرا و زنده سنجیده شد؛ ظرفیت و دو profile مستقل و resize باز؛ گزارش‌های agent-catalog و destination-provisioning |
| A05 / آماده‌سازی مقصد | provision app، plan approval مرحله‌ای و env/secret flow | A02/A04؛ policy موجود | AC21/22/23؛ app تازه و مراحل بعد به ID و ورودی مصوب متصل | live create/config، crash پس از create، env merge، concurrent change، secret redaction و reject/replay | partial؛ ساخت Node با v8/journal/ID واقعی و ادامه به انتشار، شواهد تاریخی دارد. env runtime با v9/migration10/reference رمز‌شده و readback، و استفاده محلی از همان env و v10 پیاده و contract/Docker-tested هستند؛ live env و شبکه تازه هنوز بازند؛ ADR0013/0014 |
| A06 / اتصال کدنویسی | spike runtime رسمی و CodeRepairJob رفت‌وبرگشت اجرایی | A01؛ قرارداد CodeRepair | AC26؛ job→patch/test/artifact، نه فقط Markdown | یک اصلاح واقعی در workspace جدا؛ base stale، تغییر خارج مسیر، timeout/cancel، تست fail؛ روش isolation مستند | partial؛ اتصال اجرایی Node و Python در workspace جدا، مدل واقعی→patch/test/artifact→انتخاب دقیق→انتشار آزموده شد. Python 3.12 با فایل واقعی API ترب و exact replacements، reject/expiry/session recovery و دو وصله نامؤثر/ناقص سنجیده شد؛ اصلاح dependency و build عمومی باز. گزارش python-real-project و ADR0015 |
| A07 / آماده‌سازی پروژه | رفع start/port/config و فایل‌های لازم با CodeRepair | A02/A06؛ workspace/profile موجود | AC19/26؛ پروژه ناآماده با patch و build/test معتبر آماده شود | دو ورودی متفاوت، monorepo، command موجود/ناموجود، عدم اجرای script در inspect و حفظ source اصلی | partial؛ npm lock v3/Node22 در image تثبیت‌شده، offline ci و build/test/start موجود و oracle مستقل؛ تصمیم/مرجع env همان پروژه و archive source آزموده‌شده. دو case build سالم/اصلاح و یک case env در Docker واقعی با مدل/ابر مصنوعی گذشتند. تغییر dependency/فرمان و build عمومی Next پذیرفته نیست؛ ADR0012/0014 |
| A08 / انتشار هدف‌محور | اتصال همه مراحل و WorkloadContract عمومی HTML/API | A03/A05/A07 | AC17/21/23/27/32 و AC05/06؛ درخواست→لینک سالم | چرخه live پروژه آماده و ناآماده؛ خطای build، 404/200 اشتباه، نسخه قبلی، receipt گم‌شده، ادامه بدون write تکراری | partial؛ چرخه‌های هدایت‌شده Node حفظ‌اند؛ Python بومی با v11/v12 و یک مقصد/دو release واقعی، API صحیح، Root404 سپس اصلاح و HTML/JS/CSS200 و assetهای لازم تأیید شد. source اصلی محفوظ و replay صفر write تازه بود. GitHub/Next عمومی و env زنده هنوز باز؛ گزارش python-real-project |
| A09 / تحقیق پویا | انتخاب مرحله‌ای evidence/source بر اساس hypothesis | A02؛ incident/collector موجود | AC25؛ مدل ابزار بعدی را از نتیجه واقعی انتخاب کند | logs متناقض/قدیمی، metric ناموجود، منبع ناقص، سؤال لازم و ورودی فارسی تازه؛ انتخاب ابزار مدل واقعی | partial؛ در14336e1 چرخه وب/PaaS با ساخت/انتشار همان artifact و دو تحقیق500/200 واقعی گذشت؛۱۹ درخواست مدل، انتخاب ابزار متفاوت، لاگ مسیر دیگر از پاسخ200 تفکیک و منابع unverified نامعلوم ماندند. ورودی نامعتبر releases/metrics در همان بودجه اصلاح و تحقیق بدون write/reload replay پایان یافت؛ cleanup با ID و404 تأیید شد. domain249، HTTP21 و Agent browser20 گذشتند. تعمیم کیفیت/سناریوها باز؛ گزارش agent-investigation |
| A10 / اصلاح کامل | CodeRepair برای incident، تأیید patch و انتشار و سنجش اثر | A06/A08/A09 | AC26/27 و AC09/11؛ همان رفتار خراب واقعاً اصلاح شود | باگ source تازه، اصلاح غلط/درست، تست بازتولید و regression، diff و live before/after از وب‌اپ | partial؛ شاهد تاریخی cart.mjs و چرخهٔ تازه Python روی ترب آماده‌شده، خطای واقعی، وصله نامؤثر، آزمون مستقلِ مانع انتشار ناقص، اصلاح مؤثر و انتشار دقیق artifact را دارند. پنج آزمون نهایی، شش asset و readback نسخه جاری گذشتند؛ scope/dependency repair عمومی هنوز باز |
| A11 / runtime | گسترش تشخیص/آماده‌سازی/build/publication/health برای هر۱۴خانواده رسمی لیارا | A07/A08 | AC28؛ هر runtime فرمان/تنظیمات و oracle درست خود را داشته باشد | پروژه واقعی و ساختار متفاوت برای هر خانواده، نسخه و شرط پشتیبانی، مسیر native/Docker جدا، root مبهم و دلیل ناسازگاری؛ بدون ادعای عمومی از generator یا worker Docker | partial؛ Python 3.12/FastAPI بومی با۱۸ wheel قفل‌شده، worker Docker و نشر/اصلاح مجدد واقعی تأیید شد. Node22/Vite build واقعی نیز گذشت. آماده‌سازی خودکار monorepo خام، pyproject/Django، Pythonهای دیگر و Next عمومی هنوز UNCONFIRMED؛ ADR0015 و گزارش python-real-project |
| A12 / preview | app آزمایشی، لینک و انتقال artifact تأییدشده | A05/A08 | AC29؛ تست preview قبل از تغییر مقصد اصلی | تفاوت مقصد/هویت، source عوض‌شده، شکست تست، cleanup دقیق و هزینه؛ یک مسیر live | not_started |
| A13 / برگشت | تشخیص regression و rollback به نسخه در دسترس | A08؛ journal/artifact واقعی | AC30؛ محتوا و config سابق معلوم و نتیجه دوباره سنجیده شود | source محلی تغییرکرده، artifact مفقود، ناسازگاری داده، رد مجوز و برگشت live روی app آزمایشی | not_started |
| A14 / منابع و دامنه | نقشه database/disk و اتصال دامنه/HTTPS با API مجاز | A05؛ راهنمای موجود | AC34 و AC07؛ ایجاد و اتصالِ لازم و قابل مشاهده | قرارداد واقعی منابع انتخابی، credential flow، DNS/SSL و عدم تخریب رکوردهای قبلی؛ capability ناموجود صریح | not_started |
| A15 / بهینه‌سازی | پیشنهاد اصلاح کد یا تغییر منابع با سنجش هزینه/عملکرد | A09/A10؛ T33 | AC33 و AC10/20؛ نتیجه با روش یکسان سنجیده شود | workload مستقل، before/after هم‌شرایط، unit/time معتبر و گزینه کد در برابر resize | not_started |
| A16 / MCP | facade ابزارهای مشترک برای Coding Agent میزبان | A02؛ use caseهای پذیرفته‌شده | AC31؛ policy و receipt با وب‌اپ یکسان | اتصال میزبان واقعی، سناریوی انتشار/تحقیق، denied tool، scope/approval و transport دوم | partial؛ SDK2.3.1، HTTP در همان process، stdio bridge بدون Store دوم، grant محدود و lifecycle مشترک پیاده‌اند. domain310 با concurrency2، HTTP36 و سپس MCP8 با assertions تازه گذشتند؛ Codex0.163.0-alpha.11 discovery و۳tool call واقعی بدون مدل داشت. source selection از MCP، incident مستقل، Claude/OpenCode و connector اجرایی همچنان باز؛ ADR0017 و docs/mcp.md |
| A17 / کیفیت تعامل | زبان ساده، کارت‌ها و states کامل و reader تازه | همراه A03/A08/A10؛ نهایی روی candidate | AC32 و AC14؛ بدون راهنمای شفاهی، انتخاب/تصمیم/نتیجه فهمیده شود | مرور کامل keyboard/mobile، focus، متن ۲۰۰٪، viewport و screen reader در حد اجرا؛ خطای واقعی و بازیابی | partial؛ تب خلوت مستقل، draft بین تب‌ها، focus/picker/RTL/۳ عرض/متن۲۰۰٪ و خطا/لغو سنجیده؛ reader تازه و screen reader هنوز UNCONFIRMED |
| A18 / ارزیابی زنده | ماتریس سناریوهای تازه و مصرف ثبت‌شده | از اولین slice، تکمیل پس از A08/A10 | AC17–27/32؛ model/operation/outcome هرکدام شاهد داشته باشند | پروژه‌های متفاوت، paraphrase، failure، decline، recovery، code patch و تست تازه؛ revision و real/simulated جدا | partial؛ چرخه‌های واقعی آماده/ناآماده، دو اصلاح start/port با Node22 و هدف ناآماده تا سایت200 با۱۲ model call گذشتند. در14336e1 چرخه تازه انتشار/تحقیق500/200 با۱۹ درخواست واقعی مدل، read correction و cleanup با ID/404 گذشت؛ browser primary تازه۲ درخواست و reload بدون replay داشت. failureهای پیشین و مصرف تجمعی خصوصی حفظ شدند؛ تعمیم سناریوها باز است |
| A19 / candidate | setup تمیز و تطبیق اسناد/فرمان‌ها با رفتار نهایی | هسته پذیرفته + A17/A18 | AC15/16؛ محدودیت صادقانه و اجرای مستقل | lint/type/build و regression مرتبط روی candidate؛ doc links، setup، secret/public artifacts و انتخاب رفتار اصلی | partial؛ export ثابت با backend14336e1 و UI پیش از4cee36d،79 فایل مطابق commit؛ domain249، lint/typecheck/build، HTTP21 و Agent browser20 گذشتند؛ شش browser75/27/27/22/20/5 روی bbd45cb گذشتند. npm ci تمیز با cache و lock جدید، undici7.30.1 و domain249/lint/typecheck/build/HTTP21 نیز موفق شدند. primary با مدل واقعی، read و reload سنجیده شد؛ UI همزمان و پذیرش کل مأموریت بازند |

### ترتیب وابستگی و نقطه تحویل

اول A01 و spike اتصال A06؛ سپس A02/A03 برای یک مسیر واقعی با ابزارهای فعلی. A04/A05/A07/A08 چرخه استقرار کامل را می‌بندند؛ A09/A10 چرخه اصلاح را. A17 و A18 از اولین slice همراه‌اند. توسعه‌های A11–A16 بر اساس وابستگی و ارزش وارد می‌شوند؛ engine، approval و UI موازی نسازیم.

پایان هسته: ورودی طبیعی از وب‌اپ، آماده‌سازی و تصمیم، انتشار واقعی و بررسی برنامه؛ سپس یک مشکل source که با job اجرایی، تست و انتشار اصلاح‌شده حل شود. هیچ task زنده با fixture یا نام‌گذاری UI، done نمی‌شود. اگر dependency بیرونی مانع یک مسیر شد، کار مستقل ادامه و gap دقیق ثبت شود.

بعد از هر مرحله: task و AC، scope فایل‌ها، revision/config، رفتار قبل/بعد، دستور و نتیجه، real/simulated، مصرف مشاهده‌شده، failure باز و قدم بعد ثبت شوند. تصمیم‌های معماری جدید در ARCHITECTURE و طراحی اجراشده در DESIGN منعکس شوند؛ بودجه حساب و یادداشت شخصی وارد مستند مشترک نشوند.

ادامه A09 پس از8d5abf2: دو آزمون وب پیش از model/write با timeout اتصال متوقف شدند؛ سه خواندن مستقل به‌صورت متوالی deadline15s را مصرف می‌کردند. اجرای همزمان با همان deadline، لغو sibling و عدم ثبت پاسخ ناقص اضافه شد. دو regression تازه، domain236/236، lint/typecheck/build و HTTP21/21 روی export با UI ثابت گذشتند؛ اتصال واقعی application با سه200 در9.292s تأیید شد. تلاش‌های شکست‌خورده حفظ شدند. قدم بعد، انتشار کنترل‌شده و تحقیق واقعی دو مسیر200/500 از وب است؛ A09 همچنان partial است.

ادامه پس از83d961d: شش browser suite ثابت75/27/27/22/20/5 گذشتند. دو اجرای زنده پیش از create با GET transport failure متوقف شدند؛ در دومی، خطای UND_ERR_CONNECT_TIMEOUT ثبت شد. retry واحد فقط برای همین خطای GET، هزینه هر ارسال در budget و allowance write قبل از claim اضافه شد؛ POST، HTTP errors و schema error تکرار نمی‌شوند. هشت regression تازه، domain244/244، lint/typecheck/build و HTTP21/21 export ثابت گذشتند. قدم بعد تکرار SRE واقعی با همان مصرف تجمعی و حفظ failureهاست؛ A09 partial مانده است.

ادامه پس ازb525c18: شش browser suite ثابت75/27/27/22/20/5 دوباره گذشتند. POST ساخت پس از preflight نامعلوم شد؛ receipt و منع replay حفظ شدند و سه خواندن بعدی404 بودند. TLS واقعی5–7s در برابر TCP چندمیلی‌ثانیه‌ای، Pool محدود فقط برای API و dependency دقیق سازگار7.30.1 را توجیه کرد؛ [ADR0009](docs/decisions/0009-liara-transport-pool.md). سه regression تازه با HTTP/multipart/cancel و POST بدون replay واقعی محلی؛ domain247/247، lint/typecheck/build و HTTP21/21 export ثابت و bootstrap2/2 primary گذشتند. dispatcher8 ناسازگار به regression تبدیل شد. قدم بعد، SRE واقعی در مقصد تازه و journal جدا با همان دفتر مصرف است؛ create قبلی تکرار نمی‌شود و A09 partial است.

ادامه پس ازea08a40: شش browser suite ثابت75/27/27/22/20/5 گذشتند. ساخت مقصد تازه، ID/config، انتشار همان archive و HTTP200/متن اصلی با مدل و PaaS واقعی و cleanup404 تأیید شدند. goal تحقیق بعدی /orders با PROBE_TIMEOUT متوقف شد و مدل در۵ درخواست وضعیت صفحه/منابع را unknown نگه داشت؛ oracle500 پاس نشد. cap شبکه probe با شاهد TLS5–7s به15s با تقدم deadline run تنظیم شد؛ status/content و سایر حفاظت‌ها عوض نشدند. regression6s/500 قبل شکست و بعد همان500 را حفظ کرد؛ domain248/248، lint/typecheck/build و HTTP21/21 export ثابت گذشتند. قدم بعد یک تکرار محدود SRE با دفتر تجمعی قبلی است؛ A09 partial مانده است.

ادامه پس ازbbd45cb: شش browser suite ثابت75/27/27/22/20/5 گذشتند. چرخه ساخت/انتشار تازه و cleanup404 موفق و /orders با500 واقعی در2.855s ثبت شد؛ goal بعد از آن INVALID_INPUT گرفت. سه بازپخش فقط‌مدل، read_releases با کلید خارج قرارداد را بازتولید کردند. recovery همین خواندن، با رد پیش از API و اصلاح هم‌بسته در همان بودجه اضافه شد؛ domain249/249، lint/typecheck/build و HTTP21/21 export ثابت گذشتند. مسیر خصوصی مستقیمِ هر socket برای این نصب Windows با VPN روشن فعال شد؛ native fetch/pinnedHttps و چهار ردِ auth/host/IP/DNS گذشتند. primary مرورگری با دو درخواست مدل واقعی و reload بدون model call و page error گذشت. این تنظیم پیش‌فرض محصول نیست؛ سایر ترافیک و تنظیمات VPN تغییر نکرده‌اند. قدم بعد،200/500 کامل با مدل و PaaS واقعی و همین دفتر تجمعی است؛ A09 partial است و failureهای قبلی حفظ شده‌اند.

ادامه در14336e1: چرخه واقعی200/500 بالا کامل گذشت؛۱۹ درخواست مدل و64,732 token گزارش‌شده، یک create/upload/release/delete و صفر write در تحقیق ثبت شدند. همان archive به Node22 رسید و root200 مستقل خوانده شد؛ reloadهای سه مرحله بدون درخواست تازه بودند. /orders500 با لاگ سازگار و /200 با لاگ مسیر دیگر، با ابزار/خلاصه متفاوت و منابع unknown پایان یافتند. cleanup با ID و404 و سرور export بسته تأیید شدند؛ مقصد uncertain قبلی نیز GET404 مستقیم داشت و receipt نامعلوم حفظ شد. proxy/default route و PIDهای VPN قبل/بعد یکسان و TUN روشن ماندند. primary3000 مستقیم فعال است. ارزیابی جدا مدل واقعی/provider مصنوعی۱۹ درخواست و52,251 token داشت. Agent browser20 و bootstrap primary2/2 گذشتند. پس از توقف سرورهای آزمون، npm ci تمیز با cache در export موفق شد و domain249/lint/typecheck/build دوباره گذشتند. A09 در همین دو سناریو شاهد live دارد؛ تعمیم و UI هم‌زمان بازند. قدم بعد، برش env/build/MCP طبق وابستگی‌هاست.

## وضعیت ثبت‌شده پایه و کارهای هم‌زمان

### بررسی کامل انتخاب GitHub و آماده‌سازی پیش از مرحله Agent — bounded_live_verified

AC02/03/13/14/16؛ اصلاح server در `d981734`. اتصال رسمی حساب با اقدام انسانی کامل شد و مسیر واقعی فهرست/جست‌وجو→مخزن→شاخه/SHA→زیرپوشه→tarball→snapshot→inspection/archive→SQLite و reload طی شد. مخزن اولیه با ۱۲۸ فایل و مجموع 5,364,734 بایت به‌دلیل یک فایل داده 3,949,893 بایتی رد می‌شد؛ سقف مشترک هر فایل 4 MiB و تنظیمات ریشه 512 KiB شد، بدون تغییر مجموع20 MiB/1000فایل/5000entry. واژگان js-tokens و Motion tokens دیگر credential نیستند؛ credential واقعی/کلیدهای نصب و redaction گزارش حفظ شدند. snapshot شکست‌خورده بدون مرجع پاک می‌شود؛ snapshot ثبت‌شده و انتخاب قبلی حفظ و junction رد می‌شوند. مسیر [slug].ts نیز پشتیبانی می‌شود. domain169، lint/typecheck و export مستقل tracked روی همین revision با install/setup/build/HTTP18/bootstrap2 و چهار suite مرورگر75/27/27/22 موفق شدند؛ artifact candidate با سرور/DB ایزوله و gateهای خاموش است. مقایسه bytes/hash آرشیو واقعی با manifest و restore نیز گذشت؛ هیچ write زیرساخت یا درخواست مدل انجام نشد. جزئیات و مرز مخزن خصوصی/صفحه‌بندی/peer review در [شواهد GitHub](docs/evidence/github-project-review.md) هستند.

بخش مستقل T41 شامل شکست‌های بالا اصلاح شد؛ T40 reader مستقل با self-review جایگزین نشده است. T50 روی candidate جدید سنجیده شد ولی revision نهایی مأموریت Agent و clone مستقیم GitHub همچنان بازند. باقی‌مانده‌های نیازمند app زنده، بودجه مدل یا reader مستقل done معرفی نمی‌شوند. وظایف فاز Agent برنامه توسعه بعدی‌اند و این بررسی آن‌ها را پیاده نمی‌کند.

### رفع دریافت کد GitHub — bounded_live_verified

گزینه `--clipboard=false` صریح شد؛ parser هر دو پیام رسمی را می‌شناسد، stdout/stderr جدا و فقط خط کامل parse می‌شود. regression واقعی child ابتدا روی ادغام جریان‌ها و سپس URL تکه‌شده شکست خورد و پس از رفع علت گذشت. domain162/162، lint/typecheck/build و HTTP18 تازه pass؛ مرورگر عمومی75 حالت نیز گذشت. adapter با CLI/شبکه واقعی در1034ms challenge گرفت و در مرورگر نصب اصلی کد+URL رسمی دیده شد؛ آزمون پیش از grant لغو و پروژه قبلی حفظ شد. ورود کامل حساب/فهرست مخزن زنده هنوز باز است. شواهد دقیق در verification؛ هیچ token یا کد واقعی در اسناد/تصویر ثبت نشده است.

پایه `052aa8c`؛ AC02/13/14. اجرای محدود CLI رسمی 2.103.0 روی همین رایانه: با گزینه پیش‌فرض، copied-to-clipboard=true و قالب پرانتزی، URL حاضر ولی parse=false در 1106ms؛ با `--clipboard=false`، parse=true در1252ms. آزمون اولیه adapter بعد30s به timeout می‌رسید، نه به نبود ابزار یا قطعی عمومی GitHub. پذیرش: clipboard کاربر دست‌کاری نشود؛ هر دو پیام مستند CLI به challenge صحیح و URL دقیق GitHub برسند؛ خروجی chunked، لغو، oversized و مقصد نامعتبر در driver واقعی با child ساختگی آزموده شوند؛ کد واقعی در UI دیده و بدون grant حساب لغو شود. ورود کامل حساب و مخزن خصوصی تا تأیید انسانی، verified معرفی نشوند. هیچ credential یا کد واقعی در artifact tracked/گزارش ذخیره نشود.

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

بازبینی تناسب و اندازه UI روی working tree پس از `bb06e41` (۲۰۲۶-۱۰-۲۲): مقیاس `clamp` عنوان/متن، nav و دکمه‌های header تک‌خطی با برچسب کوتاه زیر 560px، عنوان کوتاه دستیار و حذف نام تکراری پروژه، composer چسبان هم‌تراز با پدینگ پنل، ردیف label/value کارت مقصد در موبایل و reserve اسکرول focus برای composer. شش suite مرورگر روی build همین تغییرات 75/27/27/22/23/5 حالت و domain 220/220 و HTTP 21/21 pass دادند؛ صفر خطای صفحه و صفر درخواست خارجی. پس از اصلاح یک selector focus، typecheck و build تولیدی و 23 حالت Agent در 320/360/768/1280 روی worktree ایزولهٔ HEAD+همین پنج فایل دوباره pass شد؛ پس از رفع ویرایش هم‌کار `src/server/workspace/ports.ts`، typecheck و build Turbopack روی main نیز pass شدند. axe target-size پنهان زیر composer با اسکرول کنترل‌شده تست برطرف شد، بدون حذف sticky. reader تازه و screen reader همچنان UNCONFIRMED؛ هیچ gate زنده‌ای تغییر نکرد.

اصلاح حرکت UX66 در working tree پس از `e7fffd1`: نشانگر کشویی مشترک، ورود واضح‌تر پنل و خروج details پیاده شد. `node scripts/test-motion-browser.mjs` با12 case/6 عرض،20 تعویض سریع، متن200%، reduced motion و حفظ تایپ، همراه build webpack/typecheck ایزوله و lint فایل‌های حرکت پاس شد. اندازه‌گیری کوتاه CPU4× بدون long task/CLS بود؛ پذیرش حس حرکت در مرورگر مالک هنوز UNCONFIRMED است. کپی آزمون مستقل از build هم‌کار بود؛ هیچ commit یا write زنده انجام نشد. جزئیات و مرزها در verification ثبت شده‌اند.

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
| T41 | رفع شکست‌های اثرگذار، UX و مصرف؛ self-review diff | T40 | lint/type/build/domain/browser/live gate مربوط؛ baseline هم‌شرایط؛ بدون feature بی‌آزمون | partial؛ شکست‌های GitHub/منبع و کنترل انتخاب در d981734/97cad97 با regression و self-review رفع شدند؛ مرور مستقل T40 و شکست‌های احتمالی بعدی بازند |

بازبینی روی revision قابل اجرا با شواهد و روش reproduction انجام شود. ابتدا شکست‌های core، ایمنی و مسیر کاربر رفع شوند؛ معماری تازه فقط با ضرورت اثبات‌شده وارد شود.

## P5 — آماده‌سازی نسخه قابل تحویل

| Task | هدف/محدوده | وابستگی | پذیرش/تست | وضعیت |
| --- | --- | --- | --- | --- |
| T50 | README نهایی معماری/API/تعامل/limits و setup از checkout تمیز | T41 | AC15,16؛ دستورات واقعی، نسخه و real/simulated واضح؛ هیچ وابستگی به فایل محلی خارج Git | partial؛ export tracked تمیز d981734 با install/setup/lint/type/build/domain169/HTTP18/bootstrap2 و مرورگر75/27/27/22 گذشت؛ tree رابط97cad97 نیز install/setup/lint/type/build/browser/bootstrap تازه دارد. env/DB/context خصوصی کپی نشد؛ gateها خاموش‌اند. clone مستقیم GitHub، reader مستقل و revision تحویل نهایی مأموریت Agent بازند |
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


## A18/A19 — ارزیابی واقعی موازی، ۲۰۲۶-۱۰-۲۲

وضعیت partial است؛ [گزارش مستقل ارزیابی](docs/evidence/live-qa-2026-10-22.md) بر محتوای دقیق 41e5080 تکیه دارد. ۶۲ درخواست واقعی مدل در ۲۷ run (با تکرار و regression)، ماتریس گفت‌وگوی ۱۳/۱۴ و سپس بازآزمایی هدفمند ۳/۳ ثبت شدند. این اعداد یک ماتریس تازهٔ ۱۴/۱۴ یا آزمون بار هزاران کاربر نیستند.

اصلاح conversation/پیام خالی و template منبع در e6fe795 و 41e5080 ثبت شد. ۲۶۶ domain، HTTP نهایی ۳۷/۳۷، browser واقعی ۱۲/۱۲ در پنج عرض، lint/typecheck/build و identity هر ۲۴۱ فایل candidate گذشتند؛ مرزهای هر snapshot در گزارش آمده‌اند. محیط و credential واقعی بودند؛ providerهای domain عمدتاً مصنوعی‌اند.

یک مقصد و release واقعی Node22 ساخته شدند؛ READY و HTTP200 با total=36 به‌جای 73 به WORKLOAD_MISMATCH منجر شد. readback پس از قطع harness، بدون attempt تازه ادامه یافت؛ app با ID و 404 پاک شد. سقف تجمعی مصوب، مدل را پیش از patch متوقف کرد؛ اصلاح و انتشار مجدد در این چرخه پذیرفته نیستند. ترب پس از رفع مانع README انتخاب شد، اما Python/runtime/data/archive آن هنوز پشتیبانی کامل ندارد. افزایش سقف مدل جای این implementation را نمی‌گیرد. تغییرات باز Agent موازی از این ارزیابی پذیرش تازه نمی‌گیرند.


## A10/A11 — Python و تکمیل چرخه اصلاح، ۲۰۲۶-۱۰-۲۳

برش Python 3.12 بومی با ActionSpec v11/v12، archive واقعی، تأیید و journal موجود و worker Docker ایزوله پیاده شد؛ ADR0015 حدود آن را مشخص می‌کند. آزمون domain برای source/secret/argv/wheel/approval و مسیر واقعی حلقه Agent اضافه شد. آزمون Docker با مدل مصنوعی، fail→patch→همان unittest و workload→artifact→انتخاب دقیق را گذراند. API واقعی ترب، بدون دیتابیس و با ۱۸ dependency قفل‌شده، در همان محیط Python نصب و اجرا شد و OpenAPI صحیح داد. این نتیجه local است؛ انتشار واقعی و چرخهٔ کامل مدل/ابر هنوز در حال اعتبارسنجی‌اند و A10/A11 کامل علامت نمی‌خورند. کار UI موازی در این شواهد پذیرفته نیست؛ فقط نمایش نوع Python و قرارداد تازه به آن متصل می‌شود.


### به‌روزرسانی پایان برش Python — ۲۰۲۶-۱۰-۲۳

A06/A08/A10/A11/A18 همچنان پذیرش محدود دارند؛ [گزارش مستقل](docs/evidence/python-real-project.md) نتیجهٔ نهایی این جلسه را جای وضعیت «در حال اعتبارسنجی» بالا می‌نشاند. Backend اجرای زنده ea33604، تطبیق هر۱۱۳ فایل runtime؛ UI پایه ca4dfcc با سازگاری کارت Python از2c89d97؛ تغییرات UI همکار در این شاهد پذیرفته نیستند.

یک کپی آمادهٔ API و UI واقعی ترب، بدون دیتابیس۴۱۰MB و credential داخلی آن، روی Python3.12 Liara منتشر شد. انتشار6adac1284400f7631d780c59 API صحیح و Root404 داشت. نسخه اصلاح‌شده6adad0d0fc09ae5c3cd410cc، Root/JS/CSS و پنج unittest مستقل و شش asset را گذراند. مدل واقعی۴۷ درخواست داشت؛ این تعداد، ماتریس۴۷ سناریوی گفت‌وگو نیست. سه attempt ایجاد/انتشار هر کدام یک بار، و یک پیشنهاد ناقص با صفر attempt ثبت شدند. حذف ID-bound یک بار و readback404 تأیید شد.

رگرسیون نهایی: domain303/303، HTTP28/28، Docker انتخاب‌شده4/4، مرورگر ترب/Launchlane پایه در390و1280 چهار مشاهده موفق، صفر pageerror و صفر درخواست مدل در refresh؛ build/typecheck/lint موفق. یک console503 مورد انتظار برای نبود دیتابیس بود. HTTP پیشین27/28 و خطاهای مدل/installer/asset/کارت در گزارش حفظ شده‌اند؛ تست لغو اکنون ورود واقعی fixture به درخواست مدل را انتظار می‌کشد، revision قدیمی را409 و لغو تازه را200 بررسی می‌کند.

پیش‌فرض درخواست‌های تازه۲۴ مدل/۱۶۰ ابزار/۶۰۰ثانیه با evidence مصرف۱۷ درخواست انتخاب شد؛ سهم run قدیمی تمدید نشد. تبدیل خام پروژه Python، dependency edit، build عمومی Next/GitHub، env زنده، دیتابیس ترب و اعتبارسنجی دستیار خرید داخلی، گام‌های بازند. منابع اصلی پروژه و تغییرات باز همکار محفوظ‌اند.
