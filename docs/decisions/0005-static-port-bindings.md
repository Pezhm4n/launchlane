# 0005 — استخراج پورت از binding ثابت به‌جای تطبیق متن

وضعیت: پذیرفته‌شده. تاریخ: ۲۰۲۶-۱۰-۲۲.

## مسئله

در آزمون واقعی A07، worker start را درست افزود و همان تست HTTP گذشت، اما `.listen(6067)` را به `.listen(port)` با `export const port=6067` تبدیل کرد. regex قبلی این binding معتبر را نمی‌فهمید و host به‌درستی artifact را به‌دلیل port نامعلوم رد کرد. واداشتن مدل به literal یا حذف شرط readiness، root cause را حل نمی‌کرد.

## تصمیم و trade-off

پورت‌های فراخوانی listen از AST JavaScript و scopeهای lexical استخراج می‌شوند. فقط literal عددی، const قابل حل و fallback صریح PORT پشتیبانی می‌شوند؛ shadowing، mutation، binding متغیر، import، TDZ و expression نامعلوم قطعی نمی‌شوند. source اجرا نمی‌شود. comment/string و پورت تصادفی صفر، candidate استقرار نمی‌سازند. تعارض یا listener حل‌نشده، inference را unknown نگه می‌دارد؛ port صریح liara.json همچنان configuration انتخاب‌شده است، نه شاهد اجرای موفق.

Acorn8.14.0 که داخل Next16.4.2 نصب و pin شده بود reuse شد. dependency جدید و parser اختصاصی زبان ساخته نشد. مسیر compiled داخلی Next بخشی از API عمومی آن نیست؛ upgrade Next باید import/parser و regressionهای این مرز را دوباره بسنجد. AST در مرز unknown دریافت و ساختار nodeها narrow می‌شود؛ هیچ any یا double assertion لازم نیست. پشتیبانی کامل TypeScript/JSX یا حل expression دلخواه ادعا نمی‌شود. این‌ها candidateهای static هستند؛ tests و پاسخ واقعی برنامه همچنان لازم‌اند.
