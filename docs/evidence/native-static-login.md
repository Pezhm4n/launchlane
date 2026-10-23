# انتشار بومی Static و پروژهٔ Login

## نتیجهٔ اجرای واقعی؛ ۲۰۲۶-۱۰-۲۳

این بخش جای وضعیت «در حال بررسی» تاریخی پایین را می‌گیرد. candidate40 بر پایه72618b6، tree `4b19f1160921ffd59052724202338200ecb482d2` و digest354فایل `9177fd36b9b11b06e34290c2e092dea50b480b4063db2d0a0ac4a34863808dda`، با صفر اختلاف byte از ایندکس و state جدا اجرا شد. پوشه اصلی Login از file chooser واقعی Chromium و upload محصول وارد شد؛ فایل تولیدشده یا کپی آماده جای آن ننشست. source revision همان manifest است؛ Git revision فرض نشده است.

| رسید | مقدار |
| --- | --- |
| source | `adf93e03ef4c77c50499c1b24dbb0149ba3282b50078da79adfa310e5c7d3dd8` |
| artifact | `b74de9d9775a66ec2b4df1d256c65d40f7e34518d0a35f2085e70ba6dbe53ac6` |
| project / run | `baf40dbc-2090-46aa-82aa-2ef8c7127261` / `f55b1714-1f38-4114-80ab-89f2354035e2` |
| create16 / deploy15 | `073b6903-bb51-4d9b-9a3f-346c1c649512` / `0b625187-c3c6-4635-bc19-4435e085552d` |
| app / internal ID | `launchlane-static-qa-10231449` / `6adb732a7b39ae0264e7aefe` |
| release جاری | `6adb734772aa39a87ab024ec`؛ native static، port80، platformConfig خالی |
| هزینه پایه catalog | small-g2/basic، ۱۰۴۱٫۶۶ تومان/ساعت؛ مالیات/ترافیک/ذخیره و صورتحساب واقعی اندازه‌گیری نشده |
| مدل | gpt-6-luna؛ ۴ درخواست، ۱۷۰۳۸ token؛ سقف محافظه‌کارانه ledger۰٫۰۱۷۱۱۹ دلار، نه صورتحساب |

ساخت مقصد از API همین محصول با تصمیم معتبر cost/network و شبکه موجود انجام شد. دکمهٔ اصلی بررسی انتشار و تأیید UI، AgentRun واقعی را بدون چت یا سؤال Node/port تا completed بردند. upload/release هرکدام یک intent داشتند. release جاری پیش و پس از probe برابر receipt و HTML200 با عنوان Login & Registration بود. مرورگر عمومی SHA256 هر سه فایل اصلی را تطبیق داد؛ popup، Register، بازگشت Login و بستن گذشتند. console/pageerror خالی، overflow در390/1280px مشاهده نشد. این منبع backend ورود/ثبت‌نام ندارد.

runner خصوصی اول قبل از دریافت cookie ادامه داد و پیش از write شکست خورد. اجرای دوم انتشار را کامل کرد ولی oracle اشتباهاً succeeded را به‌جای completed برای مأموریت انتظار داشت؛ failure حفظ شد. recovery فقط state موجود را خواند و browser را ادامه داد؛ مدل/upload/release تکرار نشدند. currentRelease پس از مرورگر هم ID بالا بود. stop/delete از lifecycle محصول با تصمیم جدا و یک ارسال هرکدام، توقف و destination_absent را تأیید کردند. URL حذف‌شده لینک فعال نیست؛ شبکه قبلی حذف نشد. report/transport/تصاویر خصوصی در `.local/authority-mission/static-live-02/` باقی‌اند.

اجرای زنده بالا Agent-create را پوشش نمی‌دهد. بازبینی بعدی دو guard قدیمی تصمیم/ادامه v16 را اصلاح و regression Agent create→adopt→publish را افزود؛ live همان بخش UNCONFIRMED است. repair عمومی Static و framework دارای bundler از این شاهد نتیجه نمی‌شوند.

inspect اولیه به‌علت نگه‌نداشتن متن web در مسیر read-only خطا داشت؛ خواندن bounded متن و manifest assetها علت را رفع کرد. runner SQLite پیش از mkdir اصلاح شد. axe در scroll بازیابی‌شده کنترل نیمه‌خارج viewport را target-size می‌دید؛ runner قبل از سنجش viewport به ابتدای scroll برمی‌گردد؛ قانون حذف نشد. candidate41 full domain385/386 بود: oracle تکرار invalid read هنوز BUDGET_EXHAUSTED می‌خواست؛ قرارداد تازه AGENT_NO_PROGRESS است. ورودی قبلی حفظ و case مستقل invalid argumentهای متفاوت برای توقف budget اضافه شد؛ read/write مجاز نشد. شکست fetch تاریخی candidate38 ریشه تأییدشده ندارد؛ به concurrency نسبت داده نمی‌شود. candidate نهایی جدا در verification ثبت می‌شود.

دو اجرای کاربر بعد از آخرین fetch receipt،۴۵ درخواست/۳۴۳۹۳۳ token بدون split داشتند؛ سقف۰٫۶۸۷۸۶۶ دلار جدا reserve شد، بدون ساخت درخواست‌های جعلی در ledger. شمار fetch82، سقف آن۰٫۷۲۶۱۵۶ دلار؛ از مجوز تجمعی۲دلار حداکثر۰٫۵۸۵۹۷۸ دلار باقی است. allowance تمدید نشده؛ ماندهٔ حساب provider نیست.

## انتظار پیش از اجرا

منبع واقعی، همان سه فایل index.html/style.css/script.js پروژهٔ Login است، بدون تغییر پوشه یا آماده‌سازی پنهان. oracle انتشار: current release متعلق به app ID همان مأموریت، HTML عنوان `Login & Registration`، دریافت CSS و JS اصلی با محتوای همان artifact، و مرورگر واقعی که دکمه Login پنجره را باز کند، Register فرم ثبت‌نام را نشان دهد و بستن کار کند. این source فقط رابط کاربری دارد؛ ورود/ثبت‌نام backend پیاده نشده و موفقیت آن‌ها ادعا نمی‌شود. assetهای بیرونی و مشکلات خود پروژه جدا ثبت می‌شوند.

انتظار منفی: پروژهٔ نیازمند bundler/سرور صرفاً با index.html آمادهٔ Static نشود؛ asset مفقود، source/hash دست‌کاری‌شده، تغییر پورت، Node version جعلی، scope دیگر و replay رد شوند. UI سؤال نسخه/پورت/Node در برابر Static نپرسد. شکست ابزار باید علت و قدم بعدی داشته باشد؛ تکرار runtime ناموجود مصرف مدل تازه نسازد.

## بررسی فعلی

inspect واقعی از مسیر اصلی محصول سه فایل اصلی و runtime=static، port80 و بدون gap گزارش داد؛ .idea وارد بسته نمی‌شود. هیچ script اجرا نشد. قرارداد v16 ساخت بومی و v15 انتشار، decode/canonical binding و release payload رسمی در آزمون کنترل‌شده سنجیده شدند. مأموریت موجود یک فراخوانی مدل مصنوعی تا کارت انتشار رفت، سؤال فنی/job Node نساخت و همان artifact را نگه داشت. آزمون پوشهٔ مفقود نیز دسترسی به سابقه و حذف بدون source را سنجید. شواهد candidate، مرورگر و اجرای زنده پس از اجرا به همین سند افزوده می‌شوند؛ تا آن زمان live verification تأیید نشده است.

این برش فقط plain Static را گسترش می‌دهد. خانواده‌های PHP/Laravel، Django/Flask، .NET/Go، Next/React/Angular/Vue و Docker تا شاهد مستقل کامل محسوب نمی‌شوند؛ دامنهٔ [ماتریس موجود](../platform-support.md) محفوظ است.
