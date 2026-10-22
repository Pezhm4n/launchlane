# 0004 — قرارداد جدا برای آماده‌سازی فرمان Node

وضعیت: پذیرفته‌شده برای Node بدون dependency و با تست مستقیم موجود. تاریخ: ۲۰۲۶-۱۰-۲۲.

## مسئله

قرارداد اصلاح باگ، package.json را ثابت نگه می‌داشت تا مدل نتواند با تغییر test/script/dependency، آزمون را دور بزند یا دامنه اجرای محلی را گسترش دهد. همین invariant، افزودن start مفقود را هم رد می‌کرد. حذف عمومی این کنترل، اختیار بیشتری از هدف آماده‌سازی به worker می‌داد.

## تصمیم

`propose_project_preparation` یک برنامه محدود شامل فایل JavaScript موجود، پورت و فرمان دقیقِ مشتق‌شده `node <entry>` می‌سازد. این برنامه داخل همان CodeRepairJob، consent و تصمیم محلی ثبت می‌شود؛ executor یا approval engine موازی ساخته نمی‌شود. فقط scripts.start، entry مصوب و port در liara.json موجود می‌توانند تغییر کنند. سایر package fields، تست‌ها، engine، scriptها، dependencyها و config ثابت می‌مانند. قرارداد قدیمی بدون این برنامه همچنان تغییر package.json را رد می‌کند.

## پیامد

این راه، پروژه native Node با تست پذیرش موجود را پشتیبانی می‌کند؛ command دلخواه، نصب dependency، build عمومی، ایجاد فایل، root monorepo و engine نامعلوم پذیرفته نمی‌شوند. برای monorepo باید leaf واقعی انتخاب شود. تست قبل باید failure را بازتولید کند؛ همان تست بعد از patch باید بگذرد و profile دوباره فرمان/پورت/نسخه معلوم را تأیید کند. archive از همان bytes ساخته و source اصلی حفظ می‌شود. Docker/build executor و پوشش پروژه بدون تست، قرارداد و شواهد جدا لازم دارند؛ یک test runner روی میزبان، sandbox سیستم‌عامل ادعا نمی‌شود.
