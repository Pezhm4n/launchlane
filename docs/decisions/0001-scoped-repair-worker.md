# ADR 0001 — worker محدود برای اصلاح کد

وضعیت: پذیرفته برای برش نخست A06؛ ۲۰۲۶-۱۰-۲۲.

## زمینه

محصول به اتصال اجرایی patch/test نیاز دارد و transport مجاز فعلی Chat Completions است. CLI نصب‌شده Codex `0.163.0-alpha.10.2` در spike واقعی، wire نوع chat را پیش از شبکه رد کرد. [مستند اجرای غیرتعاملی](https://developers.openai.com/codex/noninteractive/) و [مرجع config](https://developers.openai.com/codex/config-reference/) بررسی شدند. وجود CLI یا help، سازگاری اجرایی با provider فعلی را ثابت نمی‌کند. تغییر provider یا استفاده از حساب دیگری برای این برش انتخاب نشد.

## گزینه‌ها و تصمیم

تعویق اصلاح تا فراهم‌شدن runtime دیگر، اولین مرز مهم محصول را باز می‌گذاشت. Markdown handoff نیز patch/test برگشتی ندارد. بنابراین یک worker محدود با همان provider پشت CodeRepairAdapter انتخاب شد: یک فراخوانی تولید replacements، validation مستقل host، اجرای آزمون موجود، artifact و receipt. مسئولیت انتخاب هدف/ابزار با Agent اصلی می‌ماند؛ worker مالک shell یا approval نیست.

این قرارداد عمداً فقط فایل موجود و آزمون مستقیم Node دارد. توسعه بی‌درنگ آن به npm/build/install، دامنه اجرای source را بسیار بزرگ می‌کرد و به سیاست command، dependency، شبکه و sandbox جدا نیاز داشت. محدودیت فعلی قابلیت عمومی Coding Agent یا محیط مهارشده خصمانه معرفی نمی‌شود.

## پیامدها و بازبینی

مزیت، یک مسیر قابل آزمون با بودجه مشترک، base دقیق و same-test oracle است. هزینه، محدودبودن دامنه اصلاح و نبود OS/network isolation است. gate پیش‌فرض خاموش و scope/test پیش از اجرا قابل تصمیم‌اند. هر تغییر command/dependency یا افزودن runtime باید قرارداد و تست جدید داشته باشد. وقتی runtime رسمی با provider مجاز و isolation مناسب واقعاً آزموده شود، می‌تواند همین adapter را جایگزین کند؛ UI و policy نباید موتور دوم بسازند. راه کار سیستم در ARCHITECTURE و شواهد اجرا در گزارش Agent ثبت می‌شوند.
