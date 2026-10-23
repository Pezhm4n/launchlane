# ADR 0001 — worker محدود برای اصلاح کد

وضعیت: پذیرفته برای برش نخست A06؛ ۲۰۲۶-۱۰-۲۲.

## زمینه

محصول به اتصال اجرایی patch/test نیاز دارد و transport مجاز فعلی Chat Completions است. CLI نصب‌شده Codex `0.163.0-alpha.10.2` در spike واقعی، wire نوع chat را پیش از شبکه رد کرد. [مستند اجرای غیرتعاملی](https://developers.openai.com/codex/noninteractive/) و [مرجع config](https://developers.openai.com/codex/config-reference/) بررسی شدند. وجود CLI یا help، سازگاری اجرایی با provider فعلی را ثابت نمی‌کند. تغییر provider یا استفاده از حساب دیگری برای این برش انتخاب نشد.

## گزینه‌ها و تصمیم

تعویق اصلاح تا فراهم‌شدن runtime دیگر، اولین مرز مهم محصول را باز می‌گذاشت. Markdown handoff نیز patch/test برگشتی ندارد. بنابراین یک worker محدود با همان provider پشت CodeRepairAdapter انتخاب شد: یک فراخوانی تولید replacements، validation مستقل host، اجرای آزمون موجود، artifact و receipt. مسئولیت انتخاب هدف/ابزار با Agent اصلی می‌ماند؛ worker مالک shell یا approval نیست.

این قرارداد عمداً فقط فایل موجود و آزمون مستقیم Node دارد. توسعه بی‌درنگ آن به npm/build/install، دامنه اجرای source را بسیار بزرگ می‌کرد و به سیاست command، dependency، شبکه و sandbox جدا نیاز داشت. محدودیت فعلی قابلیت عمومی Coding Agent یا محیط مهارشده خصمانه معرفی نمی‌شود.

## پیامدها و بازبینی

مزیت، یک مسیر قابل آزمون با بودجه مشترک، base دقیق و same-test oracle است. هزینه، محدودبودن دامنه اصلاح و نبود OS/network isolation است. gate پیش‌فرض خاموش و scope/test پیش از اجرا قابل تصمیم‌اند. هر تغییر command/dependency یا افزودن runtime باید قرارداد و تست جدید داشته باشد. وقتی runtime رسمی با provider مجاز و isolation مناسب واقعاً آزموده شود، می‌تواند همین adapter را جایگزین کند؛ UI و policy نباید موتور دوم بسازند. راه کار سیستم در ARCHITECTURE و شواهد اجرا در گزارش Agent ثبت می‌شوند.

## بازبینی مأموریت کامل؛ ۲۰۲۶-۱۰-۲۳

محدودیت‌های تاریخی بالا با ADR0011/0012/0014/0015 در حوزه container، build و Python گسترش یافته‌اند؛ «فقط Node مستقیم» توصیف امروز همه worker نیست. CodeRepairJob، base/scope، budget، containment، لغو، آزمون مستقل و artifact receipt حفظ می‌شوند. محدودیت واقعی باقی‌مانده، آماده‌سازی raw/monorepo، تغییر dependency/command و connector اجرایی سه میزبان است؛ این‌ها الزام دائمی محصول نیستند.

[OpenHands Software Agent SDK](https://github.com/OpenHands/software-agent-sdk) APIهای Python/TypeScript/REST و Agent Server برای workspace اجرا دارد؛ جایگزینی فعلی، سرویس و runtime/permission/dependency تازه می‌خواهد و هیچ اجرای واقعی مقایسه‌ای در این نصب انجام نشده است. [mini-swe-agent](https://github.com/SWE-agent/mini-swe-agent) حلقه ساده و shell/subprocess دارد؛ سادگی حلقه، به‌تنهایی محدودیت command/network/receipt را حل نمی‌کند. هیچ کد از این دو پروژه اقتباس نشده است.

انتخاب اجرایی فعلی حفظ worker موجود و اتصال host از پشت همان قرارداد است. افزودن SDK تازه تا وقتی یک شکاف مشخص را با اجرای sandbox و receipt مستقل نبندد، توجیه ندارد. این تصمیم صرفه‌جویی اندازه‌گیری‌شده یا برتری عمومی worker نیست. spike واقعی جدید با Codex0.163.0-alpha.11 فقط MCP→application، discovery و سه فراخوانی بدون مدل را اثبات کرد؛ dispatch اصلاح، هزینه/مصرف، cancel/recovery و محدودیت ابزار هر connector هنوز آزمون جدا می‌خواهند. API رسمی جدید app-server، اجرای برنامه‌نویسی‌شده Claude Code و OpenCode SDK بررسی شده‌اند؛ CLI دو میزبان اخیر در PATH و مسیرهای معمولِ بررسی‌شده نبود. Markdown یا MCP discovery جای این مرز اجرایی قرار نمی‌گیرد.

پیش‌نیاز اختیار چندمرحله‌ای در برش بعدی صریح شد: jobهای تازه Agent، `parentRunId` تولیدشدهٔ host را در consent و packet نگه می‌دارند. claim/مصرف/ساخت artifact به همان والد، source، job و RunBudget پایدار وابسته‌اند؛ adapter وابسته نمی‌تواند بودجه تازه‌ای بسازد. بازبینی تصمیم منقضی، والد را حفظ می‌کند و هیچ مصرف یا تأییدی را تمدید نمی‌کند. تاریخچه optional/null خوانده می‌شود؛ ActionSpec/migration قبلی تغییر نکرد. [شاهد و regression](../evidence/repair-parent-binding.md) مرز این تغییر را از plan approval و dispatch میزبان بیرونی جدا می‌کند.
