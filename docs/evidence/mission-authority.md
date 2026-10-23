# برنامهٔ محدود انتشار و artifact مشتق‌شده — ۲۰۲۶-۱۰-۲۳

وضعیت: implementation و آزمون قطعی محلی؛ انتشار زنده این برش هنوز UNCONFIRMED است. A05/AC23 و چرخه عمومی A08/A10 کامل اعلام نمی‌شوند. دامنه تمام۱۴ خانواده، منابع وابسته، MCP تا نتیجه زنده و connector اجرایی هر سه میزبان پابرجاست.

## رفتار و oracle

از یک source انتخاب‌شده با خطای مبلغ فاکتور، یک مأموریت انتشار و پیشنهاد build واقعی ساخته می‌شود. قبل از اجرای مدل مصنوعی، oracle ثابت است: آزمون اصلی همان source باید تعداد اقلام را در مبلغ لحاظ کند؛ build/start و GET باید نشانه `invoice service` را در همان مسیر بدهند. برنامه فقط همین مقصد، image، فرمان‌ها، env reference و معیار را با حداکثر 2 repair و 2 publication پوشش می‌دهد. این عدد محدودیت محصول در این برش است، نه قانون رسمی مسابقه.

`tests/sandbox/mission-authority.test.ts` یک تصمیم می‌دهد و سپس driver بدون تصمیم/دکمه ادامه تازه این زنجیره را اجرا می‌کند: build واقعی ناموفق در Node22/Docker، دریافت خطا، job اول، patch بی‌اثر، همان آزمون ناموفق و بدون artifact، job دوم، patch مؤثر، همان آزمون موفق، artifact تازه، انتخاب همان بسته و publication با همان hash. npm/build/test/start/GET، فایل و SQLite واقعی‌اند؛ مدل، DNS/probe لیارا و transport نوشتن مصنوعی‌اند. بنابراین این آزمون شاهد Docker publication یا PaaS زنده نیست. original source تغییر نمی‌کند؛ replay مأموریت و درخواست اولیه پس از انتخاب descendant، صفر مدل/attempt تازه دارند.

آزمون‌های domain، actor/session/hash/revision، rollback تصمیم+رزرو، replay، job خارج محدوده، دستور تغییرکرده، ancestry اثبات‌نشده، سقف تلاش، نشست لغوشده، root بدون build، قیمت تغییرکرده، reject و recovery را پوشش می‌دهند. ActionSpecهای تاریخی عوض نشده‌اند. برنامه تنها از پیشنهاد build هم‌بسته به مأموریت، برای مقصد موجود شروع می‌شود؛ آماده‌سازی عمومی dependency/entry، ساخت resource و اختیار پولی محصول در این برش نیستند.

## candidateها و شکست‌های حفظ‌شده

- پایه کد اولیه `50f4076`؛ UI هم‌زمان در `ef54058` جدا commit شد و در candidateهای بعدی حاضر است. کار UI در commit backend stage نشده است.
- candidate01 روی export ثابت index، build/typecheck و lint بدون error با36warning/9info،320domain،37HTTP،5container مرتبط و38حالت guided browser را گذراند. این candidate قبل از دو guard نهایی scope و تکمیل کارت جدید است.
- candidate02،320domain داشت؛ آزمون کارت برنامه در انتظار دکمه timeout شد. مقصد fixture نشانی probe ذخیره‌شده نداشت؛ صرف selectedApp برای آغاز برنامه کافی نبود. برنامه اکنون فقط با readback رسمی `defaultSubdomain=true`، origin همان app را خودکار ثبت می‌کند؛ در غیر این صورت `PROBE_UNCONFIGURED` با اقدام لازم می‌دهد. metadata، fixture و oracle ضعیف نشدند.
- candidate03، build/typecheck و lint با صفرerror/35warning/9info،320domain و43حالت guided browser در320/360/390/768/1280 را گذراند. کارت قیمت با واحد، محدوده، focus واقعی، reload بدون مدل/بودجه تازه و reject از مسیر HTTP بررسی شد؛ screenshot موبایل دیده شد. برنامه زنده اجرا نشد. پس از این snapshot، فقط راهنمای مدل درباره اختیار برنامه مصوب روشن‌تر شد؛ نتایج candidate نهایی جدا ثبت می‌شوند.
- candidate04 نهایی با278فایل runtime/test/script مطابق index و digest `eb584d7af09ac4089dbd3d7f925036f4279811ad77cd7e1366c2b1de94fa919d` ثبت شد؛ build/typecheck و lint با صفرerror/35warning/9info،22domain مرتبط،37HTTP،5container مرتبط و43حالت guided browser گذشتند. این subset به‌عنوان320domain یا full browser تازه جمع نمی‌شود. export مستقل، UI کامیت `ef54058` را دارد؛ فایل‌ها و hunkهای باز بعدی همکار در candidate نیستند. هیچ مدل یا Liara واقعی در این pass استفاده نشد.
- نخستین دو اجرای container به‌علت دو نقص fixture، پیش از هدف آزمون شکست خوردند: credential مصنوعی در config client نبود و پاسخ مصنوعی `status` نداشت. پس از اصلاح شکل fixture، چرخه کامل تا نتیجه پیش رفت.
- oracle نخستِ patch بی‌اثر آن را پیش از آزمون با `string()` تک‌خطی رد می‌کرد؛ متن چندخطی source به `text()` منتقل شد. failure معتبر حفظ شد؛ سپس همان patch واقعاً آزمون را شکست داد (`REPAIR_TEST_FAILED`, exit76) و patch دوم همان آزمون را گذراند. معیار مبلغ و پاسخ تغییر نکردند.
- kit طراحی روی همین نصب `RESULT: 0/52` و `MODULE_NOT_FOUND` داشت؛ این خودآزمون kit امتیاز محصول و gate موفق نیست. مرورگر و axe نصب‌شده پروژه برای UI واقعی استفاده شدند.
- timeoutهای قدیمی fixture و تغییر concurrency1 جدا و باز می‌مانند؛ pass این candidate علت آن timeoutها را ثابت نمی‌کند.

گزارش‌ها، exportها و تصاویر قابل بازتولید در مسیر خصوصی `.local/authority-mission/` هستند؛ source archive، credential و state خصوصی وارد Git نمی‌شوند. آزمون قطعی مدل یا cloud واقعی مصرف نکرده است. برای آزمون زنده بعدی باید source/revision/artifact/job/app/release، workload و cleanup همان اجرا جدا ثبت شوند.
