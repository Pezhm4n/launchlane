# آماده‌سازی محدود پروژه Node

تاریخ: ۲۰۲۶-۱۰-۲۲. دامنه: Node بدون dependency، فایل ورودی و نسخه Node معلوم، تست مستقیم موجود و تغییر start/port. وضعیت اولیه A07، نبود اختیار اصلاح script در CodeRepair بود؛ آن محدودیت برای اصلاح باگ عمومی حفظ شد و برنامه جدا افزوده شد.

`propose_project_preparation` از entry و port، فرمان دقیق را در host می‌سازد؛ نام فایل نمی‌تواند interpreter option، shell command، traversal یا تست پذیرش باشد. محدوده تغییر از source استخراج می‌شود. goal نمایش‌داده‌شده فرمان و پورت را پیش از تصمیم توضیح می‌دهد. همان CodeRepair/تصمیم/RunBudget/نسخه جدا استفاده می‌شوند؛ هیچ عملیات cloud یا نصب dependency در این برش نیست.

پنج regression جدید، start مفقود، start اشتباه، پورت ناسازگار در entry/liara.json و leaf واقعی monorepo را با اجرای Node و پاسخ HTTP محلی می‌سنجند. baseline fail و همان تست unchanged پس از patch pass می‌شود؛ source اصلی و فایل تست حفظ می‌شوند. command/script/dependency/engine/config خارج برنامه، consent پورت دیگر، root monorepo و dependency موجود رد می‌شوند. قرارداد قدیمی حتی با تستی که پس از تغییر start می‌گذرد، تغییر package را رد می‌کند. مجموعه کامل domain220/220، lint و typecheck گذشتند؛ model transport این regressionها مصنوعی و اجرای Node/HTTP واقعی است. اجرای worker روی Node میزبان24.18.0 است؛ انتخاب Node22 پروژه به‌تنهایی اثبات اجرای تست با22 نیست.

در این مرحله چرخه جدید مدل واقعی، مرورگر و target runtime و build عمومی هنوز UNCONFIRMED هستند. Docker Desktop نصب بود ولی engine خاموش بود؛ engine راه افتاد و image رسمی `node:22.23.3-bookworm-slim` با digest ثابت `sha256:3ed98443660ff48413b5af19ecefce3b9d50845a901a43420d47cc63a9fddbe9` واقعاً `v22.23.3` برگرداند. این فقط spike runtime است؛ محصول هنوز از Docker برای job استفاده نمی‌کند. containerها/سرویس‌های موجود پروژه‌های دیگر تغییر یا پاک نمی‌شوند.

این قابلیت عمومیِ ساخت پروژه یا اجرای هر script نیست. پروژه بدون تست، dependency/build، فایل جدید و frameworkهای دیگر هنوز به قرارداد اجرای جدا نیاز دارند. پس از موفقیت محلی، انتشار به همان artifact و approval مجزا متصل است. [تصمیم معماری](../decisions/0004-reviewed-node-preparation.md) چرایی حفظ مرز scripts را ثبت می‌کند.
