# آماده‌سازی محدود پروژه Node

تاریخ: ۲۰۲۶-۱۰-۲۲. دامنه: Node بدون dependency، فایل ورودی و نسخه Node معلوم، تست مستقیم موجود و تغییر start/port. وضعیت اولیه A07، نبود اختیار اصلاح script در CodeRepair بود؛ آن محدودیت برای اصلاح باگ عمومی حفظ شد و برنامه جدا افزوده شد.

`propose_project_preparation` از entry و port، فرمان دقیق را در host می‌سازد؛ نام فایل نمی‌تواند interpreter option، shell command، traversal یا تست پذیرش باشد. محدوده تغییر از source استخراج می‌شود. goal نمایش‌داده‌شده فرمان و پورت را پیش از تصمیم توضیح می‌دهد. همان CodeRepair/تصمیم/RunBudget/نسخه جدا استفاده می‌شوند؛ هیچ عملیات cloud یا نصب dependency در این برش نیست.

پنج regression جدید، start مفقود، start اشتباه، پورت ناسازگار در entry/liara.json و leaf واقعی monorepo را با اجرای Node و پاسخ HTTP محلی می‌سنجند. baseline fail و همان تست unchanged پس از patch pass می‌شود؛ source اصلی و فایل تست حفظ می‌شوند. command/script/dependency/engine/config خارج برنامه، consent پورت دیگر، root monorepo و dependency موجود رد می‌شوند. قرارداد قدیمی حتی با تستی که پس از تغییر start می‌گذرد، تغییر package را رد می‌کند. مجموعه کامل domain220/220، lint و typecheck گذشتند؛ model transport این regressionها مصنوعی و اجرای Node/HTTP واقعی است. اجرای worker روی Node میزبان24.18.0 است؛ انتخاب Node22 پروژه به‌تنهایی اثبات اجرای تست با22 نیست.

در مرحله اولیه، چرخه جدید مدل واقعی، مرورگر و target runtime هنوز UNCONFIRMED بودند؛ شواهد تازه پایین همین گزارش آمده‌اند. build عمومی همچنان باز است. Docker Desktop نصب بود ولی engine خاموش بود؛ engine راه افتاد و image رسمی `node:22.23.3-bookworm-slim` با digest ثابت `sha256:3ed98443660ff48413b5af19ecefce3b9d50845a901a43420d47cc63a9fddbe9` واقعاً `v22.23.3` برگرداند. این فقط spike runtime است؛ محصول هنوز از Docker برای job استفاده نمی‌کند. containerها/سرویس‌های موجود پروژه‌های دیگر تغییر یا پاک نمی‌شوند.

این قابلیت عمومیِ ساخت پروژه یا اجرای هر script نیست. پروژه بدون تست، dependency/build، فایل جدید و frameworkهای دیگر هنوز به قرارداد اجرای جدا نیاز دارند. پس از موفقیت محلی، انتشار به همان artifact و approval مجزا متصل است. [تصمیم معماری](../decisions/0004-reviewed-node-preparation.md) چرایی حفظ مرز scripts را ثبت می‌کند.

## نخستین ورودی واقعی و failure حفظ‌شده

در export مربوط به bb06e41، مدل واقعی از وب، inspect و سه file read را انتخاب کرد و برنامه آماده‌سازی با تست موجود پیشنهاد داد. تصمیم در مرورگر ثبت و worker با مدل واقعی اجرا شد. شش درخواست مدل مصرف شد. baseline به‌علت start مفقود fail شد؛ بعد از patch همان تست و HTTP محلی pass شدند. با این حال worker عدد literal در listen را به const reference تبدیل کرد و regex قدیمی پورت را unknown کرد. host، PREPARATION_UNVERIFIED داد، artifact نساخت و source اصلی را تغییر نداد. این failure اجرای موفق قابلیت محسوب نمی‌شود.

اصلاح root cause با AST و bindingهای lexical، بدون اجرای source و بدون dependency تازه انجام شد؛ ورودی واقعی در regression باقی ماند. shadowing، mutation، imports، TDZ، comments/strings و listener متعارض/نامعلوم نیز آزموده شدند. domain کامل224/224، lint/typecheck، build و HTTP21/21 گذشتند. Number روی fallback صریح نیز با حفظ unknown در shadow/mutation پشتیبانی شد تا نمونه تاریخی regress نشود. [ADR](../decisions/0005-static-port-bindings.md) محدودیت parser و وابستگی به Next pin‌شده را ثبت می‌کند. تکرارهای بعدی نیز failureهای مستقل داشتند؛ اصلاح و نتیجه نهایی در ادامه ثبت شده است.

## دو آماده‌سازی واقعی پس از ae9a5f9

نسخه اجرایی شامل bb06e41، cb935da، e5832ef و ae9a5f9 بود؛ UI export پیش از 4cee36d ثابت نگه داشته شد تا کار همزمان رابط وارد شاهد backend نشود. در دو پروژه تازه، مدل واقعاً inspect، فایل‌های مرتبط و ابزار آماده‌سازی را انتخاب کرد. هر تصمیم محلی در مرورگر ثبت شد. مدل و worker هر دو از BoxAPI واقعی استفاده کردند؛ چهارده درخواست و 32,436 token گزارش‌شده برای این دو چرخه ثبت شدند.

| پروژه | ورودی | تغییر مدل | نتیجه مستقل |
| --- | --- | --- | --- |
| calendar-start | start مفقود، پورت6067، تست موجود | فقط package.json؛ start دقیق node server.mjs | همان تست ابتدا fail و بعد pass؛ artifact انتخاب‌شده روی Node22.23.3 پاسخ200/calendar-ready داد |
| checkout-settings | پورت entry برابر9393، config برابر9292، هدف6068 | فقط server.mjs و liara.json؛ custom.retain و فرمان start حفظ شدند | همان تست ابتدا fail و بعد pass؛ همان نسخه با npm start روی Node22.23.3 پاسخ200/checkout-settings-ready داد |

اجرای محصول، Node24 permission runner در workspace جدا بود. راستی‌آزمایی مستقل، همان workspace را به image رسمی با digest ثابت و mount فقط‌خواندنی داد؛ direct Node test و npm --ignore-scripts start واقعاً اجرا شدند. container بدون network خارجی، با user غیرریشه و محدودیت حافظه/CPU/process بود و probe داخل همان container انجام شد. این شاهد target runtime است و به معنی داشتن Docker executor در محصول نیست. source و تست اصلی در هر دو مورد حفظ شدند، hash نسخه منتخب با artifact آزموده‌شده برابر بود، reload صفر فراخوانی مدل تازه داشت و هر دو container و سرور موقت پاک/متوقف شدند. هیچ Liara read/write برای این دو آزمون انجام نشد. تصاویر proposal/result در 360 و1280 در .artifacts/preparation-live نگهداری شدند.

دو شکست دیگر هم به موفقیت تبدیل نشدند: REPAIR_NO_CHANGE پیش از نوشتن وصله، و MODEL_PROTOCOL پس از موفقیت کار محلی. اولی با normalization فایل‌های مجازِ بدون تغییر و حفظ رد وصله کاملاً بی‌اثر پوشش داده شد؛ دومی با finish_investigation دارای schema و کنترل outcome سرور اصلاح شد. domain227/227، lint/typecheck، build و HTTP21/21 روی export ثابت گذشتند. این شمارها جای آزمون عمومی پروژه‌های دارای dependency/build یا بدون تست را نمی‌گیرند.

## یک درخواست واقعی از پروژه ناآماده تا سایت پاسخ‌گو

همان export اجرایی ae9a5f9 با UI ثابتِ پیش از 4cee36d، state/workspace/allowlist جدا و مدل/PaaS واقعی اجرا شد. fixture از source اصلی calendar-start که هنوز start نداشت گرفته شد. تنها یک هدف فارسی در مرورگر ثبت شد: آماده‌سازی با فرمان node server.mjs، پورت6067 و همان تست موجود، سپس ساخت مقصد با پلن small-g2/basic و انتشار صفحه‌ای با status200 و متن calendar-ready. تصمیم اصلاح محلی، ساخت/هزینه و انتشار هر کدام در وب ثبت شدند؛ اتصال حساب از API احرازشده محلی انجام شد.

مدل پس از inspect و سه خواندن فایل، آماده‌سازی را پیشنهاد داد. worker واقعی start را اصلاح کرد؛ baseline fail و همان تست pass شد و artifact انتخاب شد. سپس خود مدل از نتیجه به destination/catalog/networks/quote و proposal ساخت رسید. یک create انجام شد و ID/config برگشتی انتخاب شدند. proposal انتشار v7، همان hash artifact اصلاح‌شده و همان ID را داشت. پس از تصمیم سوم، دقیقاً یک upload و یک release انجام شدند. source اصلی تغییر نکرد.

READY ابتدا با HTTP503 همراه بود؛ host آن را pending/WORKLOAD_STARTING نگه داشت. همان readback محدود به پاسخ200 و متن درست رسید و run فقط آن‌وقت completed/remote_changes_verified شد. خواندن مستقل عمومی نیز همین پاسخ را تأیید کرد. چرخه، ۱۲ درخواست واقعی مدل، 46,780 token گزارش‌شده، ۴۵ tool call و 191,787ms زمان فعال داشت. readback دستی و تغییر oracle صفر بودند. reload مدل یا write تازه نساخت. دفتر PaaS این آزمون ۳۶ GET شامل setup/cleanup، یک create، یک upload، یک release و یک DELETE دارد؛ این شمار، همه HTTPهای workload/model نیست.

پاک‌سازی، ID را دوباره تطبیق داد، همان app آزمایشی را حذف کرد و absence404 گرفت. سرور موقت متوقف شد؛ container موقتی باقی نماند. env write و network creation صفر بودند. تصاویر سه تصمیم و نتیجه در 360/1280 در .artifacts/preparation-publication-live بازبینی شدند؛ credential، state، source و دفتر مصرف در .local باقی ماندند. این شاهد یک Node بدون dependency با تست موجود و شبکه موجود است؛ پوشش build، env، پروژه بدون تست، preview، rollback یا MCP از آن نتیجه نمی‌شود.

## نصب اصلی و تفاوت آن با سرور آزمون

پس از درخواست صریح مالک برای فعال‌بودن دستیار، چهار gate نصب اصلی فعال و همان سرور loopback با حفظ credential/state بازراه‌اندازی شد. از وب اصلی روی پورت3000، پروژه examples/node-service انتخاب و درخواست فقط‌خواندنی ارسال شد. دو درخواست واقعی مدل، 5,193 token گزارش‌شده، inspect_project واقعی، پایان دارای قرارداد و reload بدون فراخوانی مدل تازه سنجیده شدند؛ صفر pageerror ثبت شد. serviceReads و analysis در API واقعی true بودند و پیام خاموش‌بودن نمایش داده نشد. deployment برای حساب/مقصد وصل‌نشده همچنان false است؛ روشن‌بودن gate، اتصال و approval تولید نمی‌کند.

این اجرا از main با UI همزمانِ در حال بازآرایی بود؛ نتیجه یک مرور کارکردی همین درخواست است و جای acceptance کامل UI جدید را نمی‌گیرد. شمار requestهای شکست ابزار مرورگر پیش از ارسال هدف، مصرف مدل همین نصب محسوب نشد. کنترل تجمعی مصرف آزمون‌ها در فرایند اصلی نیز فعال بود و سقف برای سرور یا retry از نو شروع نشد. حالت پیش‌فرض checkout تازه همچنان off است و فعال‌کردن مجاز نصب در README توضیح داده شده است.
