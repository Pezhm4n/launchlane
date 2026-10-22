# ADR 0009 — اتصال پایدار و محدود فقط برای API لیارا

تاریخ: 2026-10-22. وضعیت: پیاده‌شده؛ نتیجه تازه وب/PaaS جدا ثبت می‌شود.

## مسئله

پس ازb525c18، پیش‌بررسی ساخت گذشت ولی POST ساخت با UND_ERR_CONNECT_TIMEOUT پس از10.655s پاسخ نداد. journal به uncertain/request_started/CREATE_RECEIPT_UNKNOWN رفت و ارسال تکرار نشد. بدون ID برگشتی، app هم‌نام قابل پذیرش یا حذف نیست. بررسی فقط‌خواندنی بعدی دو404 و یکECONNRESET داشت؛ رسید نامعلوم حفظ شد.

اندازه‌گیری HTTPS با اتصال تازه، DNS برابر1–17ms و TCP برابر6–24ms و TLS برابر5.232–6.821s را نشان داد. API پاسخ می‌داد، اما handshake در شبکه این آزمون به سقف داخلی اتصال نزدیک بود. این مشاهده محدود، تضمین پایداری شبکه یا اثبات اثر write نیست.

## تصمیم

transport پیش‌فرض برای origin دقیق https://api.liara.ir از یک Pool مشترک undici با حداکثر۴ اتصال، connectTimeout=30s، keepAliveTimeout=30s و keepAliveMaxTimeout=60s استفاده می‌کند. HTTP/1.1 حفظ شده است. credential، body، redirect:error، no-store و AbortSignal از همان درخواست می‌آیند؛ deadline کوتاه‌ترِ application همچنان مقدم است. dispatcher سراسری تغییر نمی‌کند؛ BoxAPI، probe سایت، loopback و host مشابه از این Pool استفاده نمی‌کنند. این لایه هیچ درخواست یا POST را retry نمی‌کند. سیاست محدود GET در ADR0008 جدا می‌ماند.

تغییر با [custom dispatcher رسمی Node24.18](https://nodejs.org/download/release/v24.18.0/docs/api/globals.html#custom-dispatcher) و گزینه‌های [Client نسخه7.30.1](https://github.com/nodejs/undici/blob/v7.30.1/docs/docs/api/Client.md) انجام شد. یک dependency دقیق7.30.1 به lockfile اضافه شد؛ dependency انتقالی تازه ندارد. در آزمون native، نسخه8.12.3 با fetch داخلی این Node، invalid onRequestStart method داد. تست واقعی HTTP محلی همان شکست را حفظ می‌کند؛ نسخه سازگار شاخه۷ انتخاب شد. تشخیص این ناسازگاری با mock ممکن نبود.

نوشتن یک client HTTP/multipart/TLS تازه، سطح خطای بیشتری داشت. استفاده از Pool مستند، تغییر محدودتری است؛ dependency و نگهداری نسخه هزینه آن است. افزایش کلی deadline، retry بی‌قید یا تغییر policy مجوز توجیهی نداشت. reuse اتصال، handshakeهای تکراری را کم می‌کند؛ خطای شبکه همچنان ممکن است.

## شواهد و مرزها

سه GET واقعی وضعیت مقصد قبلی با فاصله۶s، سه404 و زمان7.014/0.500/1.067s داشتند. این اندازه‌گیری محدودِ مسیر فقط‌خواندنی است؛ benchmark عمومی یا تأیید نتیجه POST نیست. receipt نامعلوم اولیه و دفتر مصرف حفظ شدند. هیچ app بدون ID پذیرفته یا حذف نشد و همان create بازاجرا نشد.

سه regression، انتخاب Pool فقط برای origin دقیق، عدم اشتراک credential/signal، حفظ multipart، POST واحد پس از پاسخ گم‌شده در wire واقعی محلی و cancellation واقعی fetch را می‌سنجند. موفقیت مدل یا cloud از این تست محلی استنتاج نمی‌شود. اعتبارسنجی SRE بعدی روی مقصد تازه با journal و allowance مشخص انجام می‌شود؛ دفتر مصرف قبلی reset نمی‌شود.
