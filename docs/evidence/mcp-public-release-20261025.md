# انتشار واقعی MCP روی دامنهٔ عمومی — ۲۰۲۶-۱۰-۲۵

طبق درخواست مستقیم مالک، اصلاحات MCP بدون commit، staging، push یا تغییر طراحی روی **https://launchlane-live-1023.liara.run/?view=publish** فعال شدند. در04:57UTC، SDK و میزبان واقعی Codex روی همان دامنه و با فایل صادرشده از نشست واقعی کاربر بررسی شدند؛ این گزارش ادامهٔ [آزمون مستقل](mcp-hosted-independent-20261025.md) است.

## نسخه و دامنهٔ تغییر

HEAD همچنان `6937dfc9a6be4f53a134b55175a53d22512dcf29` است. تغییرهای runtime نسبت به کد عمومی قبلی محدود به قرارداد فایل MCP، dialog موجود، پاسخ ساخت‌یافته و تفکیک خطای لغو grant از انقضای نشست‌اند. startup و نمونهٔ محصول، اصلاح hosting منتشرشدهٔ قبلی را حفظ کردند. CSS، public، lockfile، موتور انتشار و migrationها تغییر نکردند.

| هویت | مقدار |
| --- | --- |
| image قبلی | `sha256:a109b27fde37cfbf02b40b3ade96c17f2eddf052e4d39fff1ecb95f009423c6f` |
| image فعال | `sha256:8ed153b5b1c0ede4f4eec56ddbce675b31336fb2553d97fccabeb288a93b61f2` |
| Build ID فعال Linux | `7JRJo53Hmy4LFYYWf68L2` |
| digest manifest بایت‌های source،۲۴۷فایل | `88a8beef95e050d00dbb2cdd33649c762ebf804e933744154c1c936369905213` |
| SHA256 بستهٔ source | `243151ea198be9015f0702cbeafcaf808347dfc333d3c5203134ff57247f2337` |
| اندازهٔ archive | ۴۷۶٬۹۲۲بایت |

manifest، بسته، فرمان‌ها و logهای خصوصی در `.local/hosting-launchlane-20261023/mcp-*` و audit/backup سرور در `/root/launchlane-mcp-audit-20261025` نگه‌داری شدند. بسته allowlist است؛ credential، state، ledger، `.env` و probeهای آزمون در آن نیستند. label image به digest source مقید است؛ نداشتن commit به‌معنی نداشتن هویت artifact نیست.

## ساخت و بررسی پیش از rollout

ساخت نخست در `npm ci` به `ECONNRESET` شبکه رسید. همان کانتینر build متعلق به این اجرا متوقف شد؛ production در تمام این مرحله healthy ماند. لایهٔ نصب dependency از build قبلی همان سرور، `sha256:923a670ba2d151cb5b553469da8b0420c5fa78cf689d0ceb489b9dd5b66494f8`، استفاده شد. پیش از استفاده، hash کامل package/lock با source برابر و Node24.18.0، Next16.4.2 و TypeScript6.0.3 تطبیق داده شدند. سپس compile با `docker build --network none` و همان recipe runtime انجام شد؛ install تازه، تغییر dependency یا fallback به build ویندوز صورت نگرفت. hash recipe cache برابر `96738de42fbb600420a8bc23aa01e2a97b84245a3f0237450cf2a9ee7ce16bdf` است.

همین image Linux ابتدا در کانتینر جدا، با `network none`، state/secret جدا و hook ورود مصنوعی سنجیده شد. initialize، discovery ده ابزار متناسب با gates خاموش آن محیط، reply ساخت‌یافته، scope خواندن، revoke، revoke تکراری404، token لغوشده401 و معتبرماندن نشست وب200 گذشتند. کانتینر آزمون متوقف شد؛ hook یا state آن به production منتقل نشدند.

دو خطای harness پیش از این pass حفظ شدند: fetch محلی Host دلخواه را منتقل نکرد و403 گرفت؛ transport آزمون به `node:http` با Host صحیح تبدیل شد. سپس DELETE بدون Content-Length بدنه را حمل نکرد و400 گرفت؛ طول واقعی بدنه اضافه شد. policy و oracle محصول برای عبور این موارد تغییر نکردند.

## حفظ داده، ledger و اختیار مصرف

پیش از rollout نبود action/run/job/execution فعال یا نامعلوم بررسی شد. با API backup خود SQLite از state و ledger سازگار نسخهٔ خصوصی گرفته شد. claim یک‌بارمصرف با image/digest/دامنه، دستور مالک، expiry و صفر منبع پولی تازه پیش از تعویض image در journal ثبت شد. فقط سرویس web با همان compose/runtime جایگزین شد؛ مسیر rollback تنها image قبلی را برمی‌گرداند و DB را reset نمی‌کند.

بعد از rollout و دوباره بعد از تمام آزمون‌های عمومی و لغو grant:

- تمام رکوردهای هر۲۸جدول `state.sqlite` با backup برابر بودند؛ `quick_check=ok`.
- تمام رکوردهای هر۵جدول ledger برابر ماندند؛ جدول calls همان۴۴۸رکورد و reserveها همان۳رکورد را داشت؛ `quick_check=ok`.
- mount اصلی `/var/lib/launchlane`، کلید نشست و runtime config ثابت ماندند. hash config `645147da6d4807b56fcab6c716367f25df99636a737df483e99047b4b0091700` تغییر نکرد. proxy همان image قبل بود؛ هیچ fixture در `NODE_OPTIONS` production نبود.
- ledger همان authorized=`2`، calls ceiling=`0.8904`، reserves=`0.9096` و remaining≈`0.20`دلار را گزارش کرد. هیچ allowance، partition، reserve یا درخواست مدل تازه ایجاد نشد.
- web جدید healthy، restart0 و OOM=false بود. هیچ منبع زیرساختی تازه یا تغییر پلن ایجاد نشد.

## آزمون واقعی روی دامنهٔ عمومی

کاربر شخصاً در مرورگر وارد لیارا شد؛ رمز یا کد در گفتگو یا script قرار نگرفت. نشست پس از تعویض web و reload باقی ماند. با تأیید صریح کاربر، از UI موجود grant **فقط‌خواندنی** صادر، دانلود و با setup روی رایانهٔ محلی تأیید شد. عمر grant به نشست والد و حداکثر یک ساعت مقید بود؛ mission permission نداشت.

| بررسی | نتیجهٔ مشاهده‌شده |
| --- | --- |
| HTTPS صفحه و assetها | root200 و هر۹asset عمومی200؛ hash بایت‌های CSS/فونت‌های حاضر در entry با قبل برابر |
| صدور و import واقعی | فایل متعلق به همین origin؛ نام سرور و scope واقعی با SDK بررسی شد؛ setup با exit0 و سه snippet بدون token پایان یافت |
| SDK رسمی HTTP روی public | initialize/discovery سیزده ابزار، `launchlane_context` موفق، برابری متن و `structuredContent` |
| scope و Origin | `launchlane_publish` با grant خواندن `TOOL_DENIED`؛ Origin خارجی403 |
| reconnect | اتصال تازه و خواندن وضعیت موجود؛ run=null/events=[] مطابق نبودن مأموریت در همان حساب؛ اجرای تازه‌ای آغاز نشد |
| bridge واقعی stdio به public | فراخوانی context موفق؛ خروج بدون افشای token |
| Codex واقعی | `codex-cli 0.163.0-alpha.11.2`، app-server/stdio با home موقت و config تولیدشده؛ سیزده ابزار و سه call واقعی context/publish-denied/mission موفق |
| مدل و write آزمون | هیچ `turn/start`، درخواست مدل یا mutation زیرساختی آغاز نشد؛ برابری ledger نیز این مرز را تأیید کرد |
| لغو | همان grant از UI لغو و درخواست بعدی با همان token روی public برابر401 شد؛ UI نشست والد را نگه داشت |
| دسترسی ناشناس | workspace بدون session401 ماند |

اجرای اول میزبان در پاک‌سازی home موقت ویندوز با EBUSY مواجه شد. cwd میزبان آزمون از home موقت جدا و انتظار cleanup اصلاح شد؛ بازاجرای کامل SDK/stdio/Codex موفق شد و هر دو home موقت پاک شدند. این خطای harness به‌عنوان شکست deployment یا موفقیت نادیده‌گرفته‌شده ثبت نشده است. config اصلی کاربر تغییر نکرد.

## حدود پذیرش

این شاهد، اتصال واقعی MCP خواندنی روی public با حساب و Codex واقعی، HTTPS، policy و revocation را می‌بندد. شروع مأموریت پولی، انتشار پروژهٔ تازه، repair از connector اجرایی، turn مکالمه‌ای Codex و runtime واقعی Claude Code/OpenCode در این rollout آزموده نشدند. شواهد قبلی publication و آزمون مستقل جای همین مرزها را نمی‌گیرند؛ پذیرش کلی A16/AC31 و ماتریس همهٔ خانواده‌ها همچنان گسترده‌تر است.

فایل آزمایشی دانلودشده و snippetهای آن اکنون به grant لغوشده اشاره می‌کنند. برای استفادهٔ عادی باید از «حساب‌ها ← اتصال MCP» دسترسی تازه با scope دلخواه ساخت و طبق [راهنما](../mcp.md) وارد کرد؛ هیچ credential دائمی یا تمدید بودجه ایجاد نشده است.
