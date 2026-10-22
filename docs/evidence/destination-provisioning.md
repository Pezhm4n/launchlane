# ساخت مقصد با receipt داخلی

تاریخ: ۲۰۲۶-۱۰-۲۲. بخش application در `2c335e6` روی main ثبت شد. دامنه فعلی: پروژه Node آماده، پلن ایران و شبکه موجود همان تیم. ساخت شبکه و env هنوز پشتیبانی نمی‌شوند. انتشار از همان application موجود و با تصمیم جدا استفاده می‌کند.

## اجرا و مجوز

ActionSpec v8، عملیات `create_app` را به actor/session، حساب/تیم، نام مصوب، انتخاب قبلی، Node، snapshot پروژه و archive، network ID، plan/bundle و برآورد پایه متصل می‌کند. قیمت و availability پیش از claim دوباره خوانده می‌شوند. source عوض‌شده، قیمت یا شبکه تازه، اعتبار ناکافی و نام موجود، create نمی‌سازند.

همان `Store`، `executeApproved`، session/CSRF، scope، audit و RunBudget استفاده می‌شوند. migration 9 فقط جدول journal ساخت را اضافه می‌کند؛ نسخه‌ها و checksumهای 1–8 تغییر نکرده‌اند. stage پیش از POST ثبت می‌شود. پاسخ واقعی create فیلد `projectID` دارد؛ این ID داخلی پیش از readback ذخیره می‌شود. انتخاب app فقط پس از تطبیق همین ID، platform، plan، bundle، network و read-only setting انجام می‌شود. این وضعیت، سلامت سایت یا اجرای Node را اثبات نمی‌کند.

اگر پاسخ create گم شود، stage بدون receipt، uncertain باقی می‌ماند؛ برنامه هم‌نام adopt و POST تکرار نمی‌شود. اگر receipt ثبت شده ولی ذخیره action قطع شده باشد، readback همان ID می‌تواند نتیجه را بازیابی کند. تغییر انتخاب کاربر پس از ارسال، با انتخاب خودکار مقصد تازه بازنویسی نمی‌شود.

## شاهد واقعی

شکل پاسخ create با دو app کوتاه‌عمر تطبیق داده شد: `{projectID}` یک شناسه داخلی 24-hex بود و با GET همان app برابر شد. این spikeها مدل، env write یا deployment نداشتند و منابعشان حذف و نبودشان تأیید شد.

سپس خود application محصول، نه فقط harness مستقیم، با API واقعی اجرا شد: options حساب، پیشنهاد v8، تصمیم صریح روی hash، claim، یک POST create، ذخیره ID، readback تنظیمات و انتخاب همان ID در اتصال. یازده tool call در همان budget مشترک مصرف شد. تلاش اجرای مجدد هیچ write تازه‌ای نساخت. app پس از تطبیق ID توسط harness پاک و GET 404 آن تأیید شد. source script، env write، model call و deployment در این چرخه صفر بودند. gateهای نصب اصلی تغییر نکردند.

regressionهای application شامل مهاجرت، price/network/credit/source تغییرکرده، نام موجود، response گم‌شده، شکست SQLite پس از receipt، same-name replacement، تغییر انتخاب و race هستند. ثبات fingerprint با تغییر ترتیب کلیدهای catalog هم آزموده شد. مجموعه کامل domain در مرحله application برابر 208/208 و HTTP20/20 بود؛ lint/typecheck/build گذشتند. شواهد خام و هزینه حساب فقط در محل ignored آزمون نگهداری می‌شوند.

## اتصال گفت‌وگو

registry مشترک اکنون `read_networks` و `propose_destination` دارد. ابزار نخست خودکار و read-only است؛ دومی فقط proposal v8 می‌سازد. کارت در همان گفت‌وگو نام، موقعیت، نرخ پایه تومان در ساعت، هزینه‌های محاسبه‌نشده و ظرفیت اندازه‌گیری‌نشده را نشان می‌دهد. decision و queued شدن run در همان transaction ثبت می‌شوند. قطع پیش از claim، approval صف‌شده را لغو می‌کند. قطع پس از create فقط receipt را می‌خواند و write را تکرار نمی‌کند.

host فقط از receipt موفق و ID دقیق، تغییر context ناشی از ساخت را می‌پذیرد. تغییر مستقل source/account/selection باعث توقف ادامه می‌شود. اثر `destination_created` از انتشار موفق جداست. برای هدف انتشار، مدل پس از این receipt ابزار بعدی را انتخاب می‌کند و proposal v7 باید همان archive و ID تازه را bind کند. ساخت به‌تنهایی run را completed نمی‌کند. رد پیشنهاد منقضی یا context عوض‌شده فقط authority را حذف می‌کند و مجوز تازه‌ای نمی‌سازد.

اگر readback همان app، `defaultSubdomain: true` برگرداند، host نشانی اولیه `https://<app>.liara.run` را محلی ثبت می‌کند. این قالب با [راهنمای رسمی ساخت Node لیارا](https://github.com/liara-cloud/docs/blob/master/src/pages/paas/nodejs/how-tos/create-app.mdx) تطبیق داده شد. flag غایب/false، نشانی مدل یا یک app هم‌نام برای این کار کافی نیست. مقصد probe در approval انتشار جداگانه bind می‌شود و حفاظت DNS/SSRF همان probe موجود پابرجاست.

هفت regression Agent، زنجیره ساخت→proposal انتشار→تصمیم جدا→بررسی workload را با transport مصنوعی، atomic decision، انقضا/تغییر context، پاسخ گم‌شده، قطع میان receipt و adoption، انتخاب همزمان کاربر و gateهای خاموش می‌سنجند. مجموعه کامل تازه domain215/215 روی main و lint/typecheck گذشتند. build و HTTP21/21 روی snapshot مستقل working tree سنجیده شدند. تست جدید مرورگر پنج حالت در 360/768/1280 را بدون overflow یا violation ثبت‌شده axe گذراند و تصویرها بازبینی شدند؛ proposal مصنوعی و تمام writeهای provider خاموش بودند. artifact: `.artifacts/destination-ui/2026-10-22T10-00-24.404Z` داخل export محلی. این شواهد هنوز چرخه جدید create→publication از وب با مدل/provider واقعی نیستند.

## API و کار باز

- `POST /api/destinations` با `operation: options`، catalog و شبکه‌های موجود را با session/CSRF می‌خواند.
- `operation: propose` به projectId، app، planId، bundleId و networkId معتبر نیاز دارد و فقط Action می‌سازد.
- `GET /api/destinations/[id]` فقط state پایدار را می‌خواند.
- POST همان ID با decision/hash، execute یا observe، به‌ترتیب تصمیم، یک اجرای claim‌شده یا readback همان receipt را انجام می‌دهد. هیچ spec دلخواه یا نقش model از client پذیرفته نمی‌شود.

چرخه زنده جدید create→publication از گفت‌وگو، env و ساخت شبکه همچنان بازند. بودجه برآورد پایه، invoice یا پوشش هزینه‌های جانبی نیست. ظرفیت پروژه benchmark نشده است. انتقال migration به نصب در حال اجرا restart واقعی خواست؛ guard HMR ابتدا RUNTIME_RESTART_REQUIRED داد و سرور main با حفظ state بازراه‌اندازی شد. HMR قرارداد Store را خودکار باز نمی‌کند.
