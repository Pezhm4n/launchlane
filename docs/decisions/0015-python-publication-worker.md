# ADR 0015: انتشار بومی Python و worker ایزوله با wheel قفل‌شده

وضعیت: پیاده‌سازی، آزمون محلی و پذیرش محدود مدل/Liara روی کپی آمادهٔ ترب؛ [گزارش و حدود](../evidence/python-real-project.md). ۲۰۲۶-۱۰-۲۳.

مسیر Node به قرارداد runtime و آزمون Node وابسته بود. Python با نام جعلی Node یا پوستهٔ Node منتشر نمی‌شود: ActionSpec v11 برای انتشار و v12 برای ساخت مقصد، runtime Python، فرمان argv، source/archive، حساب، ID مقصد، پلن و معیار workload را در مجوز می‌بندند. `nodeVersion:null` در این دو نسخه صریح است. canonicalization نسخه‌های ۱ تا ۱۰ تغییر نمی‌کند؛ جدول و موتور مجوز تازه‌ای وجود ندارد. journal، claim، uncertainty و readback همان applicationهای موجودند. مجوز ساخت، مجوز انتشار نیست.

در این برش فقط Python 3.12/Linux x86_64 و اجرای مستقیم `python3 <file.py>` یا uvicorn با module/host/port مشخص پذیرفته می‌شوند. inspection فقط فایل می‌خواند؛ فرمان shell، pip و import پروژه برای شناسایی اجرا نمی‌شوند. فایل `.py` و تنظیمات TOML قابل capture هستند؛ `.venv`، `venv`، cache، env، credential و SQLite در archive نیستند. requirements.txt ریشه باید نسخه‌های دقیق و تمام وابستگی‌ها را داشته باشد؛ نبود آن برای سرویس استاندارد بدون وابستگی مجاز است. تبدیل خودکار pyproject، نصب sdist، private index، dependency edit و آماده‌سازی عمومی پروژهٔ Python هنوز قابلیت این قرارداد نیستند.

host از JSON رسمی PyPI، wheel سازگار و checksum SHA-256 را می‌گیرد؛ نام، URL، اندازه و bytes بررسی می‌شوند. فقط فایل‌های binary wheel از files.pythonhosted.org دریافت می‌شوند. pip در محیط اجرا به شبکه دسترسی ندارد و با `--no-index --no-deps --only-binary=:all: --require-hashes` نصب می‌کند؛ `pip check` سازگاری dependencyها را می‌سنجد. image موجود Python با digest ثابت در برنامه و consent بسته است. این محدودیت دربارهٔ binary wheel به معنی اعتماد به کد dependency نیست؛ import و اجرای آن‌ها نیز در محیط ایزوله صورت می‌گیرد.

Docker بدون شبکه، با source و wheelهای فقط‌خواندنی، کاربر غیر root، حذف capability، no-new-privileges، سقف زمان/حافظه/PID/خروجی و tmpfs اجرا می‌شود. tmpfs به `exec` نیاز دارد، چون loader باید فایل shared object در wheelهایی مانند pydantic-core را map کند؛ noexec به خطای واقعی `failed to map segment` منجر شد. این انتخاب با حفظ سایر مرزهای محیط و آزمون واقعی dependency باینری انجام شد. کلیدهای PYTHON/PIP/LD جزو env برنامه پذیرفته نیستند. envهای مجاز همان reference بررسی‌شده را از stdin می‌گیرند و وارد archive یا command line نمی‌شوند.

worker، compile، آزمون‌های unittest مشخص و بدون تغییر، و شروع برنامه و GET همان workload را انجام می‌دهد. شکست dependency یا sandbox مجوز patch نیست. patch فقط فایل‌های موجود و صریحاً مجاز را عوض می‌کند؛ requirements، تنظیمات اجرا و تست‌ها از محدوده تغییر خارج‌اند. رسید پیش/پس، diff و archive ثبت می‌شوند؛ انتخاب نسخهٔ اصلاح‌شده باید همان archive آزموده‌شده باشد. انتشار بعدی تصمیم مستقل دارد و موفقیت به release جاری/READY و پاسخ معنایی همان مسیر، با readback پیش و پس از probe نیاز دارد.

برای فایل واقعی API ترب با حجم ۱۳٬۴۹۸ بایت، بازگرداندن کل فایل با سقف خروجی مدل مناسب نبود. `submit_patch.files[].replacements` بخش before/after را روی hash همان فایل اعمال می‌کند؛ match مفقود، تکراری یا حتی هم‌پوشان رد می‌شود. فقط newline یکنواخت LF/CRLF برای snippet سازگار می‌شود و hash همچنان bytes پایه را می‌بندد. content تاریخی برای فایل کوچک خواندنی می‌ماند. محدودهٔ متن UTF-8 پیش از پیشنهاد بررسی می‌شود: هر فایل حداکثر ۲۴ KiB و مجموع ۴۸ KiB؛ سقف کل درخواست مدل مستقل حفظ می‌شود. فایل باینری یا وصلهٔ خارج از محدوده به مدل/انتشار راه نمی‌یابد.

همین مرز tmpfs برای build در Node نیز لازم بود: نصب واقعی ۲۶ package فرانت‌اند ترب گذشت ولی `tsc: Permission denied` ساخت را متوقف کرد؛ با exec داخل همان containment، typecheck، Vite build، start و GET واقعی گذشتند. این شاهد Node/Vite است و پذیرش عمومی Next نیست. سهم ابزار مأموریت تازه ۱۶۰ است تا خواندن dependency، اصلاح محدود و بررسی release در یک دفتر جا شوند؛ یک اجرای واقعی با تلاش ناموفق و ادامه، ۱۲۶ واحد مصرف کرد. سهم ثبت‌شدهٔ run قدیمی، با refresh یا تغییر پیش‌فرض تمدید نمی‌شود.

اسکن منبع Python میان type annotation، ارجاع به متغیر credential و literal فرق می‌گذارد. این تشخیص محافظه‌کارِ متنی، اثبات نبودن تمام انواع secret یا بازسازی دادهٔ مبهم نیست؛ مقادیر واقعی شناخته‌شده مستقل از normalization مسدود می‌شوند. تست regression برای annotation، مقدار literal، dataclass default، قالب هدر و مقدار نصب‌شده وجود دارد؛ redaction لاگ همچنان مستقل و محافظه‌کار است.

مبنای provider: [نسخه‌های Python](https://docs.liara.ir/paas/python/how-tos/choose-version/)، [استقرار Python](https://docs.liara.ir/paas/python/how-tos/deploy-app/)، [FastAPI](https://docs.liara.ir/paas/python/related-apps/fastapi/) و [پیاده‌سازی deploy در CLI رسمی](https://github.com/liara-cloud/cli/blob/master/src/commands/deploy.ts)، بررسی‌شده در همین تاریخ. release با `type:python`، `platformConfig.version` و `args` صریح ساخته می‌شود. این منابع شکل درخواست را پشتیبانی می‌کنند؛ پذیرش واقعی حساب و workload به شاهد زندهٔ جدا نیاز دارد.

آزمون مستقل `node --test tests/sandbox/python-build.test.ts` با مدل مصنوعی، اجرای واقعی Python/Docker و سه assertion بدون تغییر، خطا را بازتولید و patch مرتبط را آزمود و همان artifact را انتخاب کرد؛ source اصلی حفظ شد. اجرای محلی API واقعی ترب با ۱۸ wheel قفل‌شده و بدون دیتابیس، `/openapi.json` را گذراند. این مشاهده، جست‌وجوی محصول/داده یا مدل داخلی ترب را تأیید نمی‌کند. شواهد Liara و مدل واقعی به‌صورت جدا ثبت می‌شوند.


## تکمیل مبتنی بر اجرای واقعی

HTTP200 صفحهٔ HTML برای پذیرش UI کافی نبود: وصلهٔ مدل، HTML را ارائه می‌کرد ولی script، سپس font و icon همچنان 404 بودند. runner Python منابع HTML/CSS هم‌مبدأ را با سقف ۱۶ فایل، ۵۱۲ KiB هر فایل، ۲ MiB مجموع و عمق محدود بررسی می‌کند؛ منابع خارجی unverified می‌مانند. این بررسی جای browser یا صحت تمام مسیرها را نمی‌گیرد. قبل/بعد واقعی و آزمون مستقل ترب در گزارش ثبت‌اند.

worker فقط متن فایل‌های مصوب را می‌گیرد و فهرست حداکثر ۱۲۸ نام/۸ KiB را برای grounding مسیرها می‌بیند. فهرست، مجوز ویرایش تازه نیست. این انتخاب از ارسال کل bundle یا حدس مسیر ناموجود جلوگیری می‌کند.

برای ادامهٔ اصلاح، wheel فقط از artifact موفقِ والد که دقیقاً انتخاب فعلی است reuse می‌شود. lock، manifest، اندازه و checksum تمام bytes دوباره بررسی می‌شوند؛ تغییر dependency یا کش دیگر به این مسیر راه ندارد. این کار دو دریافت تکراری ۳۶ واحدی را در اجرای واقعی حذف کرد و شمارندهٔ run بدون تمدید در ۱۱۴ ماند.

سقف پیش‌فرض run جدید ۲۴ درخواست مدل و۱۶۰ ابزار با۶۰۰٬۰۰۰ میلی‌ثانیه است. اجرای واقعی بازیابی ۱۷ درخواست مصرف کرد؛ سقف قبلی۱۶ این مسیر را نمی‌بست. مقدار هر run قدیمی از receipt خودش خوانده می‌شود. feedback محدود برای ادامه، صرفاً دادهٔ تازه است؛ source، workload، بودجه و authority قبلی را تغییر نمی‌دهد.

کارت‌های v11/v12 همان componentهای تصمیم قبلی‌اند؛ guard و برچسب runtime اصلاح شد. پیام تاریخیِ job پس از شروع publication به کارت وضعیت انتشار ارجاع می‌دهد. redesign هم‌زمان در این تغییر وارد نشده است.
