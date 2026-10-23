# پیوند اصلاح به مأموریت والد؛ ۲۰۲۶-۱۰-۲۳

وضعیت A06/AC26 و پیش‌نیاز A05/AC23: implemented_verified در محدودهٔ زیر. اختیار چندمرحله‌ای، connector بیرونی و fallback از این شاهد نتیجه نمی‌شوند.

## مسئله و تغییر

پیش از این برش، AgentRun به job اشاره می‌کرد و worker در مسیر معمول همان RunBudget را می‌گرفت؛ خود CodeRepairJob شناسهٔ والد نداشت. اجرای مستقیم adapter نیز می‌توانست RunBudget مستقلی بسازد. این مشاهده به معنی وقوع مصرف اضافی در چرخه‌های زنده تاریخی نیست؛ مسیر معمول آن چرخه‌ها بودجه مشترک داشت.

اکنون host شناسهٔ run را در context خصوصی ابزار می‌گذارد؛ مدل فیلدی برای انتخاب یا تعویض والد ندارد. build، preparation، repair و بازبینی امن تصمیم منقضی، `parentRunId` را ثبت و در همان consent محلی bind می‌کنند. job و worker packet دارای job ID، parent run، base، scope، oracle و artifact هستند. شمارنده/مهلت همچنان در مأموریت و receipt اجرای موجود قرار دارند؛ دفتر مصرف تازه‌ای ساخته نشده است.

worker قبل از claim و هر مصرف، والد working، پروژه/source همان job، اشارهٔ والد به همین job و تصمیم مصرف‌شده و منقضی‌نشده با نشست معتبر را بررسی می‌کند. سقف، شمارنده و deadline RunBudget باید با باقی‌ماندهٔ پایدار همان والد سازگار باشند؛ نبود بودجه، افزایش سقف، صفرکردن مصرف یا تمدید deadline رد می‌شود. پس از پاسخ مدل و پیش از ساخت artifact نیز مالکیت دوباره بررسی می‌شود. CAS قبلی job، isolation، same-test oracle و بررسی مستقل بسته حفظ‌اند. job لغوشده/نامعلوم خودکار با worker دیگری جایگزین نمی‌شود.

فیلد جدید برای تاریخچه optional است؛ jobهای قدیمی بدون والد با null خوانده می‌شوند و fingerprint consent بدون این فیلد همان قالب قبلی را دارد. ActionSpec1–12 و migrationهای1–10 تغییر نکردند. این سازگاری، مجوز اجرای runner تاریخی میزبان یا انتقال تأیید نشست دیگر نیست؛ gate و review موجود برقرارند. برنامهٔ چندمرحله‌ای آینده همچنان قرارداد نسخه‌دار، migration اختیار و تبار artifact مستقل می‌خواهد؛ این برش آن برنامه را اجرا یا تصویب نمی‌کند.

## oracle و بررسی

پیش از اجرا انتظار تعریف شد: والد واقعی باید از host بیاید؛ actor دیگر/شناسه ساختگی/ورودی مدل نتواند آن را تعیین کند؛ job وابسته بدون بودجه مشترک یا با parent لغوشده، job جایگزین، source دیگر و اختیار مصرف‌نشده حتی container آغاز نکند. بازبینی اختیار منقضی باید job تازهٔ همان والد را بسازد، قبلی را لغو کند و مصرف را نگه دارد. مسیر مثبت باید واقعاً همان آزمون Node22 را fail→patch→pass کند و فقط artifact آزموده‌شده را برگزیند؛ patch غلط همچنان رد شود.

پایه d11a803 با UI ثبت‌شده6e54988، Node24.18.0 و imageهای تثبیت‌شده موجود. کپی ثابت `.local/mcp-mission/final-candidate` فقط چهار source backend/contract و دو تست این برش را دریافت کرد. فایل‌های UI در حال تغییرِ همکار و config/state اصلی وارد آن نشدند. مدل و Liara در تمام تست‌های این بخش مصنوعی‌اند؛ Docker، Node22، Python3.12، HTTP، SQLite و مرورگر واقعی‌اند.

| بررسی | نتیجه |
| --- | --- |
| domain هدف‌دار |۱۶/۱۶؛ سپس review/parent۶/۶ با case واقعی انقضا؛ بدون cloud/model واقعی |
| domain کامل candidate | `npm run test:domain`،۳۱۵/۳۱۵،صفرfail/skip |
| sandbox کامل candidate | `npm run test:sandbox`: baseline/fix واقعی و۵بررسی isolation؛ سپس۹/۹،شامل Node22/رد patch غلط/env محدود/Python/رد wheel خراب/asset ناقص |
| build | تولیدی Turbopack موفق؛ warning root در export تو‌در‌تو محفوظ |
| lint | شش فایل تغییرکرده بدون error/warning؛ این نتیجه lint تمام UI هم‌زمان نیست |

فرمان مستقیم tsc در tree مشترک ابتدا خطای JSX در `workbench.tsx` در حال تغییر همکار داد؛ آن فایل تغییر داده نشد. نوع/build candidate ثابت مرجع این برش است. regression جدید نخست۱۵/۱۶بود: fixture «جایگزینی job» به ID ناموجود اشاره می‌کرد و به‌درستی STORAGE_INVALID می‌گرفت؛ fixture با job واقعی جایگزین شد تا همان شاخهٔ مالکیت، با REPAIR_PARENT_CHANGED، سنجیده شود. oracle «صفر claim/container و حفظ scope» تغییر نکرد.

logها در `.local/mcp-mission/` با نام‌های `repair-parent-domain.log`، `repair-review-parent.log`، `repair-parent-sandbox.log` و `parent-final-{build,domain,sandbox,typecheck,http,browser}.log` نگه‌داری می‌شوند. نتیجهٔ هر فرمان تکمیلی پس از پایان جدا ثبت می‌شود؛ شروع فرمان شاهد پاس نیست.

## snapshot نهایی index؛ پس از کنترل نشست

کنترل لغوشدن نشست انسانی نیز پیش از claim/مصرف به worker اضافه شد؛ case منفی آن بدون آغاز container گذشت. سپس با `git checkout-index` کپی مستقل `.local/mcp-mission/parent-index-candidate` ساخته شد.۲۶۵فایل source/runtime/test/script/public/config با index تطبیق داده شدند؛ با درنظرگرفتن EOL متن Git، هیچ اختلافی نبود. fingerprint این مجموعه `2192e5f9887e6c8a749f73037f22438f946131345c7b31eac8510ed745d4007b` است. هیچ source این کپی حین اجرا تغییر نکرد؛ runnerهای جدید UI همکار نیز وارد آن نشدند.

| بررسی نهایی | نتیجه |
| --- | --- |
| build و typecheck | هر دو فرمان رسمی موفق |
| lint کل snapshot |۲۶۳فایل،صفرerror؛۳۴warning و۹info موجود حفظ شدند |
| domain نخست |۳۱۴/۳۱۵؛ fixture آزمون environment پیش از بررسی configuration و در ساخت archive به مهلت۳ثانیه‌ای خورد |
| domain تکرار کامل |پس از پایان build/Docker، همان `npm run test:domain` و همان۳۱۵تست،۳۱۵/۳۱۵ و صفرfail/skip؛ assertion/deadline/fixture تغییر نکرد |
| HTTP |۳۷/۳۷،صفرfail/skip؛ application/SQLite/transport واقعی و provider مصنوعی |
| sandbox |۹/۹به‌علاوه baseline/fix و۵بررسی isolation؛ Node22 و Python3.12 واقعی، packet با job/parent ID درست، patch غلط مسدود و source اصلی محفوظ |
| browser کامل | `npm run test:browser`،هفت suite۷۵/۲۷/۲۷/۲۲/۳۸/۵/۴۳،پوشه۲ و motion۱۲؛۲۵۱حالت،صفرpageerror/external request گزارش‌شده؛ transport مدل/cloud مصنوعی، تعامل مرورگر واقعی |

خطای۳۱۴/۳۱۵در `parent-index-domain.log` و تکرار کامل در `parent-index-domain-rerun.log` هر دو حفظ شدند. همراهی شکست با اجرای سنگین با فرض contention سازگار است؛ مصرف CPU/disk در آن لحظه اندازه‌گیری نشده و root cause قطعی سخت‌افزاری اعلام نمی‌شود. این failure از سوابق با pass بعدی حذف نشده است. سایر logهای نهایی `parent-index-{build,typecheck,lint,http,sandbox,browser}.log` و identity در `parent-index-identity.json` هستند.
