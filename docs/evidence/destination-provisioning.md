# ساخت مقصد با receipt داخلی

تاریخ: ۲۰۲۶-۱۰-۲۲. این برش روی branch جدا از بازآرایی رابط توسعه یافت. دامنه فعلی: پروژه Node آماده، پلن ایران و شبکه موجود همان تیم. ساخت شبکه، env و استقرار بعدی از همین API جزو این برش نیستند.

## اجرا و مجوز

ActionSpec v8، عملیات `create_app` را به actor/session، حساب/تیم، نام مصوب، انتخاب قبلی، Node، snapshot پروژه و archive، network ID، plan/bundle و برآورد پایه متصل می‌کند. قیمت و availability پیش از claim دوباره خوانده می‌شوند. source عوض‌شده، قیمت یا شبکه تازه، اعتبار ناکافی و نام موجود، create نمی‌سازند.

همان `Store`، `executeApproved`، session/CSRF، scope، audit و RunBudget استفاده می‌شوند. migration 9 فقط جدول journal ساخت را اضافه می‌کند؛ نسخه‌ها و checksumهای 1–8 تغییر نکرده‌اند. stage پیش از POST ثبت می‌شود. پاسخ واقعی create فیلد `projectID` دارد؛ این ID داخلی پیش از readback ذخیره می‌شود. انتخاب app فقط پس از تطبیق همین ID، platform، plan، bundle، network و read-only setting انجام می‌شود. این وضعیت، سلامت سایت یا اجرای Node را اثبات نمی‌کند.

اگر پاسخ create گم شود، stage بدون receipt، uncertain باقی می‌ماند؛ برنامه هم‌نام adopt و POST تکرار نمی‌شود. اگر receipt ثبت شده ولی ذخیره action قطع شده باشد، readback همان ID می‌تواند نتیجه را بازیابی کند. تغییر انتخاب کاربر پس از ارسال، با انتخاب خودکار مقصد تازه بازنویسی نمی‌شود.

## شاهد واقعی

شکل پاسخ create با دو app کوتاه‌عمر تطبیق داده شد: `{projectID}` یک شناسه داخلی 24-hex بود و با GET همان app برابر شد. این spikeها مدل، env write یا deployment نداشتند و منابعشان حذف و نبودشان تأیید شد.

سپس خود application محصول، نه فقط harness مستقیم، با API واقعی اجرا شد: options حساب، پیشنهاد v8، تصمیم صریح روی hash، claim، یک POST create، ذخیره ID، readback تنظیمات و انتخاب همان ID در اتصال. یازده tool call در همان budget مشترک مصرف شد. تلاش اجرای مجدد هیچ write تازه‌ای نساخت. app پس از تطبیق ID توسط harness پاک و GET 404 آن تأیید شد. source script، env write، model call و deployment در این چرخه صفر بودند. gateهای نصب اصلی تغییر نکردند.

هشت regression اولیه شامل مهاجرت، price/network/credit/source تغییرکرده، نام موجود، response گم‌شده، شکست SQLite پس از receipt، same-name replacement، تغییر انتخاب و race بودند. مجموعه کامل domain در این مرحله 208/208 و HTTP20/20، lint/typecheck/build گذشتند. سپس regression ترتیب کلیدهای catalog برای ثبات fingerprint افزوده شد. شواهد خام و هزینه حساب فقط در محل ignored آزمون نگهداری می‌شوند.

## API و کار باز

- `POST /api/destinations` با `operation: options`، catalog و شبکه‌های موجود را با session/CSRF می‌خواند.
- `operation: propose` به projectId، app، planId، bundleId و networkId معتبر نیاز دارد و فقط Action می‌سازد.
- `GET /api/destinations/[id]` فقط state پایدار را می‌خواند.
- POST همان ID با decision/hash، execute یا observe، به‌ترتیب تصمیم، یک اجرای claim‌شده یا readback همان receipt را انجام می‌دهد. هیچ spec دلخواه یا نقش model از client پذیرفته نمی‌شود.

این شاهد هنوز مسیر جدید Agent/کارت تصمیم مرورگر را نمی‌پذیرد؛ اتصال registry و رابط، و سپس create→publication واقعی در ادامه لازم‌اند. app در این مرحله source دریافت نمی‌کند. بودجه برآورد پایه، invoice یا پوشش هزینه‌های جانبی نیست. ظرفیت پروژه benchmark نشده است. pull این migration به نصب در حال اجرا restart واقعی می‌خواهد؛ HMR قرارداد Store را خودکار باز نمی‌کند.
