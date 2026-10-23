# شواهد اعتبارسنجی Launchlane

## اختیار برنامه و artifact مشتق؛ A05/AC23 verified_local / ۲۰۲۶-۱۰-۲۳

[شاهد برش](evidence/mission-authority.md): برنامه v1 و migration11، قیمت پایه واقعی با واحد، محدوده build/repair/publication، منشأ artifact و claim مشترک پیاده شدند. یک تصمیم، build fail واقعی، patch بی‌اثر/test fail، patch مؤثر/test pass و publication مصنوعی همان artifact را بدون تأیید دوری جلو برد. candidate03 دارای320domain است؛ candidate04 نهایی با278فایل مطابق index، build/typecheck/lint بدونerror و35warning/9info،22domain مرتبط،37HTTP،5container و43حالت guided browser گذشت. snapshotها full pass تازه واحد نیستند. مدل و cloud واقعی0؛ source خام/انتشار زنده، MCP تا نتیجه و connector اجرایی هنوز بازند. شکست fixture چندخطی، فقدان origin و خودآزمون kit0/52 در شاهد حفظ‌اند. timeoutهای تاریخی fixture با concurrency1 علت‌یابی نشده‌اند.


## خواندن پاسخ و پنل دستیار؛ verified_local / ۲۰۲۶-۱۰-۲۳

AC32 و AC23/AC24: موبایل تمام‌صفحه با VisualViewport، ورودی یک‌خطیِ رشدکننده/دارای سقف با ارسال کنار آن، هدر و metadata فشرده، کپی آیکونی، placeholder فارسی و dir=auto متن، دکمهٔ شناور «آخرین پیام» فقط هنگام فاصله از انتها پیاده شدند. بنا بر آخرین بازخورد مالک، پاسخ موبایل۱۴px و دسکتاپ۱۶px است؛ ورودی۱۶px برای رفتار فوکوس موبایل حفظ شد. در۳۷۵×۶۶۷، ناحیهٔ پیام‌ها 502.109375px، نسبت 75.28٪ و composer 81.5px است. کنتراست واقعی متن/کارت پاسخ 14.37:1 بود. این نسبت، وضعیت اندازه‌گیری‌شدهٔ working با متن بلند است؛ تضمین همهٔ محتواها یا تأیید کامل WCAG نیست.

دسکتاپ عادی non-modal است و در عرض۱۴۴۰ به بالا محتوا کنار آن بازچینی می‌شود؛ نمای بزرگ‌شده modal با کنترل برگشت است. موبایل و نمای بزرگ‌شده، focus را در Tab/Shift+Tab نگه می‌دارند، پس‌زمینه inert و اسکرول آن قفل است؛ Escape و بازگشت به launcher تأیید شدند. در شبیه‌سازی visual-only با ارتفاع۳۴۰ و offset۶۰، پیام‌ها 175.109375px جا داشتند و ارسال بالای انتهای viewport باقی ماند. تغییر layout viewport به۳۶۰px نیز بررسی شد؛ این‌ها تست کیبورد واقعی گوشی نیستند.

مبنا 50f4076c1ab747b20381ee616b56cd5679cf4b99، tree کد نهایی c1fcd393c3a15b522fe67a65ec99049e961b6910. build تولیدی/typecheck/lint صفر error/۳۵warning/۹info روی tree 0d35db055404884373623b474e0a64649a722c03 گذشتند؛ delta نهایی فقط تصحیح clock تست motion است. npm run test:chat با۱۳چیدمان شامل۲۸۰تا۱۴۴۰، متن۲۰۰٪ و دو مدل کیبورد، بدون pageerror/درخواست خارجی و axe violation گذشت. تست عملی ارسال/processing، draft فعال، نبود پرش هنگام دریافت پیام در گذشته، رفتن به آخرین پیام، توقف، failed/refresh، خطای۵۰۳ و تلاش مجدد با requestKey یکسان، کپی واقعی clipboard با نرمال‌سازی newline بومی Windows، Enter ترکیبی/Shift+Enter، expand/collapse و focus دوطرفه نیز در همان runner گذشت. پاسخ‌های run کاملاً fixture مرورگرند؛ این شاهد کیفیت مدل یا اجرای زندهٔ لیارا نیست. studio۴۳ با دو درخواست مدل مصنوعی و motion۱۴ با۲۰کلیک سریع نیز روی export نهایی گذشتند.

HTTP۳۷/۳۷ و۱۰suite اول aggregate با۲۶۳حالت روی build d6262a0b39491256ad53cb9474b51565a5830867 گذشتند؛ aggregate در تست سخت‌گیرانهٔ focus برش chat شکست خورد. پس از اصلاح modal/focus، chat۱۳ و studio۴۳ و motion۱۴ بازاجرا شدند. بنابراین۱۱suite/۲۷۶حالتِ متمایز بررسی شده‌اند، اما aggregate کامل تازه ادعا نمی‌شود. TypeScript/سمت سرور آن build با نسخه نهایی یکسان است، جز FloatingAssistant؛ delta کامل شامل آن، stylesheet پنل، DESIGN و runner chat است و تست‌های هدفمند بالا آن را پوشش می‌دهند. logها .local/chat-reading-20261023/*-delivery.log، motion-corrected.log و browser-final.log هستند؛ screenshots در I:/Computer/dev/starcoach/launchlane/.local/chat-reading-20261023/candidate-delivery/.artifacts/chat-reading/2026-10-23T06-14-52.569Z قرار دارند.

failureهای نگه‌داری‌شده: placeholder بلند در۲۸۰، ورودی خالی را۶۶px می‌کرد و کوتاه شد؛ effect قدیمی رشد ورودی حذف شد تا دو صاحب اندازه‌گیری نداشته باشد. وسط‌چین دکمهٔ آخرین پیام با transform در :active بازنویسی و click از زیر اشاره‌گر خارج می‌شد؛ centering به inset/margin منتقل شد و click واقعی گذشت. شرط انتظار ارتفاع دسکتاپ در متن۲۰۰٪، rem را به‌اشتباه px ثابت فرض کرده بود؛ اکنون انتشار اندازهٔ viewport و هندسهٔ واقعی سنجیده می‌شود. Clipboard در Windows CRLF برمی‌گرداند و oracle فقط newline را یکسان می‌کند. focus بومی هنگام Tab از آخرین کنترل کافی نبود؛ trap صریح فقط در modal افزوده و هر دو جهت و منع focus پس‌زمینه آزموده شد. یک اجرای motion در مرز۴۰۰ms timeout داشت؛ خواندن دوبارهٔ clock می‌توانست collector را پیش از ثبت آخرین نمونه متوقف کند. شرط توقف از timestamp خود نمونه مصرف می‌کند؛ حد انتظار و oracle حرکت حفظ شدند و۱۴حالت دوباره گذشتند.

هم‌کار در AgentPanel تغییر authority هم‌زمان داشت؛ یک export پس از build آن hunkها را گرفت و typecheck به‌درستی روی قراردادهای ناقص آن snapshot شکست خورد. نسخهٔ UI فایل از tree d626 تثبیت شد، hunkهای authority و فایل‌های backend هم‌کار در working tree باقی ماندند و build/type نهایی بالا گذشتند. این کامیت آن قابلیت را شامل نمی‌شود. سرور/.next اصلی، credentials و gateهای زنده تغییر نکردند. self-test کیت طراحی در همین نشست۱۲/۵۲ بود و آماده‌نبودن محیط مستقل کیت ثبت است؛ امتیاز محصول نیست. گوشی/کیبورد فیزیکی، screen reader، fps و پذیرش سلیقهٔ مالک همچنان UNCONFIRMED هستند.

## مقیاس موبایل، Geist و جابه‌جایی تب؛ verified_local / ۲۰۲۶-۱۰-۲۳

AC32 با حفظ AC23/AC24: زیر۷۶۸px ناوبری به تب‌بار fixed پایین viewport منتقل شد؛ header عادی۵۶px است، context تکراری پنهان می‌شود و launcher فقط آیکون با نام دسترس‌پذیر کامل دارد. ارتفاع واقعی nav در فاصلهٔ پایین محتوا و launcher مصرف می‌شود. متن اصلی۱۴، دکمه۱۳، عنوان کارت۱۶، نام پروژه۱۸ و padding کارت۱۴px است؛ هدف لمس۴۴ و textarea۱۶px باقی می‌ماند. در۲۰۰٪ متن، header مجاز به wrap است و launcher مطابق متن بزرگ می‌شود. Geist Latin با همان bytes فایل موجود در Next16.4.2 و OFL رسمی محلی است؛ فونت فارسی و جزیرهٔ monospace حفظ‌اند. CDP رندر واقعی Geist را برای نام انگلیسی تأیید کرد. نام پروژه در block مستقل، dir=auto و تراز والد فارسی قرار می‌گیرد؛ اسم طولانی در خلاصه هم می‌شکند.

تعویض view با WAAPI افقی۲۰px/۴۲۰ms همراه نشانگر مستقل تب انجام می‌شود؛ componentها mounted می‌مانند تا state فرم و draft حفظ شود. گفت‌وگوی اختیاری همچنان در هر دو view در دسترس است. درخشش launcher با شروع زودتر و کنتراست بیشتر بدون hover حرکت دارد. کاهش حرکت، ورود view و درخشش را متوقف می‌کند؛ تغییر آن وسط animation نیز cancel می‌شود.

مبنای source 7196471d4c41b141bfc0539edbba4618ab38f8ea؛ tree نهایی کد/runner f5cad1d38052968d1a36af59de36e981cbc16379. Node24.18، Next16.4.2، Chromium نصب‌شده و provider/model مصنوعی استفاده شدند. build تولیدی، typecheck و lint صفر error/۳۶warning/۹info روی export نهایی گذشتند. domain۳۱۵/۳۱۵ و HTTP۳۷/۳۷ روی tree e37f1e8bdc63cc9f04a4e775d8ed2e819018ab47 گذشتند؛ delta برنامه تا tree نهایی فقط تراز نام در studio.css است، کد TypeScript و سمت سرور ثابت‌اند. همان tree در aggregate، ۹suite اول مرورگر را گذراند و در assertion تراز نامِ mobile متوقف شد. پس از اصلاح CSS، mobile۱۰ و studio۴۳ روی export نهایی دوباره گذشتند؛ بنابراین هر۱۰suite بررسی شده‌اند:۷۵/۲۷/۲۷/۲۲/۳۸/۵/۴۳/۲/۱۴/۱۰، مجموع۲۶۳حالت، اما aggregate کامل تازه ادعا نمی‌شود. اسکن axe، خطای صفحه و درخواست خارجی در حالت‌های runnerها صفر بود؛ studio دو درخواست مدل مصنوعی دارد. برش موبایل هیچ model run آغاز نکرد، متن پیش‌نویس پس از تعویض تب حفظ شد و رندر Geist/default shimmer از مرورگر تأیید شدند. شواهد .local/mobile-refinement-20261023/*-merged.log و *-release.log و screenshots در I:/Computer/dev/starcoach/launchlane/.local/mobile-refinement-20261023/candidate-release/.artifacts/mobile/2026-10-23T05-37-13.739Z و I:/Computer/dev/starcoach/launchlane/.local/mobile-refinement-20261023/candidate-release/.artifacts/studio/2026-10-23T05-37-13.715Z هستند. delta پس از tree کد فقط دستورهای AGENTS و گزارش‌های TASKS/verification است.

failureهای حفظ‌شده: اجرای نخست mobile در عرض۲۸۰ و متن۲۰۰٪ overflow۶۷px داشت؛ عدم wrap هدر اصلاح شد. اجرای بعد۳۹px overflow نام بلند داخل flex خلاصه داشت؛ min-inline-size و شکست سطر نام اصلاح شد. assertion اندازه launcher در متن۲۰۰٪ متناسب با مقیاس متن۸۸px تصحیح شد؛ حد۴۴–۴۸px در اندازه عادی پابرجاست. aggregate قدیمی در overflow و اجرای بعدی در assertion تراز نام پس از۹suite متوقف شدند؛ match-parent در Chromium start ماند و با تراز right، مستقل از dir=auto خود نام، اصلاح شد. بازاجرای هدفمند mobile/studio بالا این failureها را پنهان نمی‌کند. invocation اشتباه npm run test:motion اجرا نشد چون script موجود نیست؛ دستور واقعی node scripts/test-motion-browser.mjs گذشت. تست فونت۲۰۰٪، normal/reduced در۷عرض،۲۰تعویض سریع تب، frameهای میانی، انتخاب واقعی پوشه خارج workspace، draft/focus و reload حفظ شدند.

self-test نصب کیت UX دوباره۱۲/۵۲ است؛ Playwright مستقل کیت و بخشی از shell/Python encoding آن آماده نیستند. این عدد امتیاز محصول نیست و با آزمون‌های واقعی Playwright محصول جایگزین نشده است. keyboard موبایل فیزیکی، screen reader واقعی، سنجش fps و پذیرش سلیقه‌ای مالک UNCONFIRMED هستند. سرور/.next اصلی، env و gateهای زنده تغییر نکردند؛ این شواهد محلی شاهد انتشار زندهٔ لیارا نیستند. تغییرات staged/unstaged هم‌کار در backend/MCP و متن قدیمی verification وارد این کامیت نمی‌شوند.

## اختیار MCP در طول اجرا؛ snapshot مستقل پس از7196471

پس از commit جداگانهٔ UI در560cc68، snapshot ترکیبی جاری با۲۷۰فایل مطابق index، build/typecheck، lint بدونerror و۳۶warning/۹info موجود،۳۷HTTP،۳۸guided و۱۰mobile گذشت. این subset با۳۱۶domain یا full browser قبلی جمع نشده و پذیرش کامل ترکیب یا دستگاه فیزیکی نیست؛ [شاهد و fingerprint](evidence/mcp-shared-application.md) ثبت‌اند.

[شاهد A16](evidence/mcp-shared-application.md): لغو نشست والد/فرزند در dispatch، allowance و پذیرش پاسخ enforce شد؛ درخواست آغازشده رایگان یا تمدید نمی‌شود. source نهایی۲۶۵فایل مطابق index داشت. build/typecheck، lint با صفرerror/۳۴warning/۹info موجود،۳۱۶domain با هم‌زمانی فایل۱،۳۷HTTP،۴container مرتبط،۳۸guided browser و discovery/۳call واقعی Codex با cleanup گذشتند. مدل/cloud واقعی۰. اجرای اولیه312/316شامل یک regression واقعی recovery مقصد و سه timeout fixture بود؛ correction، patch و failure حفظ‌اند. oracle/deadline و آزمون crash/adoption تغییر نکردند. خروجی کل۹sandbox و۲۵۱browser قبلی به7196471تعلق دارد و به‌عنوان full pass این اصلاح جمع نشده است؛ UI جدید همکار، connector اجرایی، plan چندمرحله‌ای و پوشش همه runtimeها بازند.

## پیوستگی job و والد؛ snapshot مستقل پس از d11a803

[شاهد A06](evidence/repair-parent-binding.md): parentRunId و بودجه/مهلت/اختیار/نشست همان run در worker enforce شدند؛ review والد را حفظ می‌کند.۲۶۵فایل runtime با index تطبیق داشتند. build/typecheck، lint با صفرerror و۳۴warning/۹info موجود،۳۷HTTP،۹sandbox و browser کامل۲۵۱حالت روی snapshot ثابت گذشتند. domain نخست۳۱۴/۳۱۵با timeout ساخت fixture پیش از بررسی env بود؛ همان فرمان کامل بعد از build/Docker،۳۱۵/۳۱۵شد و failure محفوظ ماند. oracle/deadline تغییر نکرد. مدل و cloud write واقعی صفر؛ UI جدید و runnerهای در حال ویرایش همکار وارد این snapshot نشدند. plan approval، connector بیرونی، fallback و پوشش همه runtimeها همچنان بازند.

## MCP مشترک؛ برش مستقل ۲۰۲۶-۱۰-۲۳

[گزارش MCP](evidence/mcp-shared-application.md): روی export پایه6ae5c38، SDK2.3.1/HTTP/stdio و application مشترک پیاده و domain310 با concurrency2، HTTP37، build/typecheck و هفت browser75/27/27/22/38/5/39 گذشتند. Codex0.163.0-alpha.11 discovery و۳tool call واقعی بدون turn/model داشت؛ worker بیرونی تأیید نشده است. شکست domain موازی308/310 و failureهای harness/cleanup حفظ‌اند. مدل و cloud write این برش صفر و حساب فقط با دو GET واقعی خوانده شد. رابط ثبت‌نشده همکار، برنامه چندمرحله‌ای و سایر runtimeها از این برش پذیرش نمی‌گیرند.


## تعامل، حرکت و خوانایی رابط؛ verified_local / ۲۰۲۶-۱۰-۲۳

AC32 با حفظ AC23/AC24: تب‌های گروه‌شده با آیکون/نشان لغزان و هدف۴۴px، نام فارسی، composer با textarea مستقل، گزارش با آخرین مشاهده و فرضیهٔ قبلی بازشدنی، footer سه‌گروهی و caption متصل به SVG پیاده شدند. تصویر شناوری آرام و launcher درخشش دوره‌ای دارد؛ ورود/خروج پنل و dialog و ارتفاع disclosure واقعاً animate می‌شوند. dialog تا پایان خروج mounted و inert می‌ماند؛ سپس focus برمی‌گردد. reduced motion، draft و حالت فرم حفظ می‌شوند.

مبنا 6ae5c383f536b6c839c034281997b7d83baaa9e4؛ tree نهایی کد/runner 9ed51013a884e7c217c21189106e41120a9ed1a6. build و typecheck روی tree 09f07cb3e784e0447378a7dea30fe001a17b9aa0 گذشتند؛ delta بعدی فقط documentation و تنظیم runnerهاست و byteهای برنامه ثابت‌اند. lint صفر error/۳۴warning/۹info، HTTP۲۹/۲۹. Domain همان۳۰۷/۳۰۷ برش منبع معتبر است؛ src/server و قراردادهای آن در این برش تغییر نکردند. نه browser suite در اجرای aggregate تا سه suite و سپس اجرای مستقلِ باقی‌مانده روی همان برنامه گذشتند:۷۵/۲۷/۲۷/۲۲/۳۸/۵/۴۳، دو viewport انتخاب پوشه و۱۲حالت حرکت؛ مجموع۲۵۱حالت. logهای candidate-* در .local/ui-interactions-20261023 هستند. provider/model مصنوعی‌اند، درخواست خارجی و خطای صفحه در runnerها صفر، و studio دو درخواست مدل مصنوعی داشت؛ این نتیجه شاهد live Liara نیست.

حرکت در۲۸۰/۳۶۰/۵۵۹/۵۶۰/۷۶۸/۱۲۸۰ و normal/reduced،۲۰کلیک سریع تب، فریم‌های میانی opacity/ارتفاع آکاردئون، باقی‌ماندن dialog هنگام خروج، Escape/focus و حفظ متن بررسی شد. studio۴۳حالت شامل۲۸۰تا۱۲۸۰، عرض بازخورد مالک۱۱۰۱، متن۲۰۰٪، ارتفاع۴۸۰ و مشاهدهٔ تازه۲۰۰ کنار فرضیهٔ۵۰۰ قبلی دارد. انتخاب بومی پوشه از خارج workspace در۳۶۰/۱۲۸۰، حفظ اصل، پالایش پیش از multipart و reload دوباره گذشت. screenshots در I:/Computer/dev/starcoach/launchlane/.local/ui-interactions-20261023/interactions/.artifacts/studio/2026-10-23T04-32-52.757Z و I:/Computer/dev/starcoach/launchlane/.local/ui-interactions-20261023/interactions/.artifacts/folder/2026-10-23T04-33-25.790Z قرار دارند.

failureهای نگه‌داری‌شده: ref قبلی dt پس از تبدیل به p با TypeScript ناسازگار بود و با HTMLParagraphElement اصلاح شد. سربرگ موبایل۱۷۹px شد؛ لینک‌های هم‌ردیف و rail فشرده آن را به حدود۱۴۸px برگرداندند، oracle۱۵۰px تغییر نکرد. aXe روی summary یا کنترل غیرفعالِ نیمه‌پوشیده در مرز scroll زیر header خطای target-size داد. مختصات نشان داد تداخل با header است، نه launcher. cancel اکنون summary و کنترل بازگشت را زیر ارتفاع اندازه‌گیری‌شدهٔ سربرگ نگه می‌دارد و assertion مستقلی آن را پیش از snapshot می‌سنجد. اسکن layout در workbench/domain/guided/destination، پس از font readiness از scroll origin ثابت انجام می‌شود؛ assertionهای focus و اندازهٔ کنترل و ruleهای axe حذف یا غیرفعال نشده‌اند. اجرای aggregate پیش از اصلاح پیش‌شرط domain متوقف شد؛ suiteهای باقی‌مانده جداگانه گذشتند و یک اجرای aggregate کامل تازه ادعا نمی‌شود.

self-test نصب کیت طراحی۱۲/۵۲ است؛ runtime/encoding و Playwright مستقل خود کیت آماده نیستند. این عدد امتیاز محصول نیست. تست دستگاه فیزیکی، کیبورد مجازی، screen reader واقعی، پذیرش سلیقه‌ای مالک و سنجش fps این نسخه UNCONFIRMED هستند. dependency، env، API MCP، TASKS و تست‌های تازهٔ backend همکار وارد این commit نمی‌شوند. .next و سرور اصلی، secretها، gate و بودجهٔ live تغییر نکردند. probe فقط‌خواندنیِ پورت۳۰۰۰ هنگام تحویل پاسخ نگرفت؛ شواهد از production ایزوله‌اند و build اصلی برای تداخل‌نکردن جایگزین نشد.

## ورود مستقیم پوشه از رایانه؛ verified_local / ۲۰۲۶-۱۰-۲۳

AC32 و انتخاب منبع: انتخاب‌گر بومی مرورگر، پیش‌نمایش نام/حجم/تعداد و ورود مستقل فایل‌های پالایش‌شده پیاده شد. انتخاب پوشه بیرون از workspace مجاز است؛ پوشهٔ اصلی تغییر نمی‌کند. سرور پس از session/Origin/CSRF و محدودسازی دریافت، مسیرها و فایل‌ها را مستقل بررسی می‌کند و کپی خصوصی را به inspection/archive موجود می‌سپارد. API لیارا، مدل و اسکریپت منبع اجرا نمی‌شوند. تصمیم و محدودیت‌ها در ADR0016 ثبت شده‌اند.

مبنا d41b8cba7f08e6b228e405fdb891b81f0c58a35d؛ tree نهایی کد/runner b74b9235d8b4a8cf874de68a98a31c9f46363869. build تولیدی روی tree 06f4e7ae9a264e9790326b5e799c511c76973432 گذشت؛ تنها delta بعدی یک گام runner برای بازکردن مرورگر فرعی پوشه بود. typecheck، lint صفر error/۳۱warning/۹info، HTTP۲۹/۲۹، browser میزکار۷۵حالت و انتخاب پوشهٔ واقعی Chromium در۳۶۰/۱۲۸۰px گذشتند. فایل انتخاب‌شده بیرون workspace بود، نصب workspaceRoot نداشت، دو فایل خصوصی/وابستگی در multipart نبودند، اصل فایل، reload و Escape/focus بررسی شدند؛ خطای صفحه و درخواست خارجی صفر، axe صفر بود. Domain اجرای موازی۳۰۶/۳۰۷ بود؛ agent-evidence در deadline۳ثانیه CANCELLED شد. همان suiteها با --test-concurrency=2 و بدون تغییر oracle۳۰۷/۳۰۷ گذشتند؛ failure نخست حفظ است. Runner میزکار بار نخست در بازشدن دوم پوشه، disclosure تازه را باز نمی‌کرد؛ گام متناظر اضافه شد و اجرای دوم۷۵حالت گذشت.

شواهد محلی .local/ui-interactions-20261023/source-*.log و source/.artifacts/folder هستند. .next و سرور اصلی، env و حساب واقعی تغییر نکردند. مرز تأییدنشده: دیالوگ بومی روی دستگاه/مرورگر فیزیکی دیگر و انتخاب فایل خارج از Chromium. این نتیجه شاهد انتشار زنده نیست.

## بازطراحی دستیار و گزارش؛ verified_local / ۲۰۲۶-۱۰-۲۳

این برش AC32 و حفظ رفتارهای AC23/AC24 را به‌صورت محلی می‌سنجد. مبنا 40e2ea3 و tree کد/runnerها 5e724b1451c7764f9c99397257bc219e5b888c14 است. index مستقل فقط تغییرات همین UI را نگه داشت؛ hunkهای ثبت‌نشدهٔ globals، navigation، motion، iconها و activity همکار وارد commit نشدند. build در phase2-ship ایزوله با node_modules محلی و بدون env اصلی ساخته شد. سرور و .next اصلی، اتصال‌ها، VPN، مسیرهای شبکه و live budget تغییر نکردند.

- build تولیدی، npm run typecheck و lint گذشتند؛ lint صفر error،۳۱warning و۹info داشت. Domain:۳۰۰/۳۰۰، HTTP:۲۸/۲۸، browser:هفت suite با۷۵/۲۷/۲۷/۲۲/۳۸/۵/۳۹ حالت، مجموع۲۳۳. خطای مرورگر و درخواست خارجی در runnerها صفر بود. مدل/provider مصنوعی‌اند؛ فقط suite جدید دو درخواست transport مصنوعی ثبت کرد. این نتیجه شاهد انتشار یا کیفیت مدل زنده نیست.
- نام آشکار دستیار، پیشنهادهای فقط-draft، ارسال خالی غیرفعال، Escape/focus، حفظ draft در reload/navigation، scroll مستقل، composer پایین، ارتفاع۴۸۰، متن۲۰۰٪، بازه۲۸۰تا۱۲۸۰px و بارگذاری لوگوی SVG۴۰px بررسی شدند. انتخاب منبع در اولین viewport عادی موبایل می‌ماند. resetکردن scroll پیش از capture، تصویر sticky header و modal را به وضعیت واقعی viewport مربوط می‌کند.
- شکست‌های نگه‌داری‌شده: composer حدود۳۳px در ارتفاع کوتاه بیرون می‌رفت و در متن۲۰۰٪ تا۳۴۸px از پایین می‌گذشت؛ context به جریان پیام رفت، composer می‌تواند داخلی scroll کند و فاصلهٔ ثابت/حداکثر عرض native dialog اصلاح شد. SVG در reduced motion ماتریس پرسپکتیو را از دست می‌داد؛ فقط transform حرکتی reset شد و ماتریس ثابت با computed style آزموده شد. صفحهٔ شروع۲۸۰px/متن۲۰۰٪ به۳۱۰px overflow می‌رسید؛ آزمایش حذف معرفی، علت را به عنوان محدود کرد. عنوان wrap و ناوبری با حداقل عرض وابسته به فونت در صورت نیاز دو ردیفی شد؛ overflow پنهان نشد.
- یک HTTP اولیه۲۷/۲۸ در cancel با revision قدیمی۴۰۹ گرفت؛ بدون تغییر oracle/backend، دو اجرای بعدی۲۸/۲۸ گذشتند. log اولیه phase2-http-first-failure.log حفظ شده و حساسیت زمان‌بندی آزمون لغو هنوز ریسک تکرار است. build روی e431ab4 به private Store.transaction شکست خورد؛ اصلاح همکار c6c6268 حفظ و برش بعدی روی HEAD تازه ساخته شد.
- کپی combined-ui با hunkهای UI ثبت‌نشده نیز build و۳۹ حالت studio و۱۲ حالت probe محلی حرکت را گذراند؛ این کپی فقط شاهد سازگاری است و آن hunkها را ثبت نمی‌کند. یک اجرای اولیه motion پیش از پایان build و یک اجرای زیر بار روی نمونه‌برداری fade شکست خوردند؛ setup و زمان‌بندی از پذیرش عملکرد جدا نگه داشته شدند.
- self-test مستقل کیت طراحی۱۲/۵۲ است؛ وابستگی‌های render خود کیت و سازگاری Windows/encoding کامل نیستند. این عدد نمره محصول نیست و جای Playwright/axe واقعی پروژه را نمی‌گیرد. دستگاه فیزیکی، صفحه‌کلید مجازی موبایل و screen reader واقعی هنوز UNCONFIRMED هستند؛ سرعت/fps و بهبود conversion اندازه‌گیری نشده‌اند.

تصاویر و نتایج: .local/frontend-studio-20261023/evidence/final-staged، logهای ship-* و combined-* در همان پوشهٔ محلی. برای توسعه npm run dev؛ برای production در ریشه ابتدا npm run build و سپس npm start لازم است. کامپوننت‌ها با SVG/CSS موجود ساخته شدند و dependency تازه‌ای اضافه نشد.

Runner قدیمی test-motion-browser.mjs در کپی ترکیبی، هم نمونه‌برداری fade و هم focus پیش از pressSequentially را fail کرد؛ موفق اعلام نشده و فایل همکار تغییر نکرد. probe محلی همان انتظار حفظ متن/فریم میانی/end state/کیبورد/axe را با click واقعی قبل از تایپ و نمونه‌برداری requestAnimationFrame سنجید. در اجرای ثبت‌شده opacity بین حدود۴۵تا۱۷۸ms میانی و در۱۹۴ms صفر شد؛ در reduced motion از نخستین فریم صفر بود. ۱۲/۱۲ متعلق به این probe است و جایگزین pass اسکریپت قدیمی نیست. logها در combined-motion-probe.log و combined-motion-fade-under-load.log باقی‌اند.

## فضای انتشار با هویت بصری تازه؛ ۲۰۲۶-۱۰-۲۳

بر پایه eee6602، فقط UI خود این برش در index مستقل قرار گرفت. کپی قبل از تغییر، UI موجود را با backend ثبت‌شده ca4dfcc گرفت؛ دو ارجاع ناتمام Python فقط در همان کپی از UI جدا شدند و هیچ فایل کاری همکار برگشت داده نشد. مرجع قبل از تغییر در .local/frontend-studio-20261023/evidence/before و تصویر بعد در evidence/phase1-final همان مسیر است؛ حساب/مدل/provider مصنوعی و کپی‌ها فاقد env اصلی‌اند.

کد a161d5ed86d6462927ea52fc9cf62175a542a79f، build تولیدی با TypeScript، lint بدون error با30warning/9info موجود، مرورگر عمومی75 حالت و guided38 حالت را گذراند. مدل/ابر در این دو suite مصنوعی و درخواست خارجی صفر بود. دو failure متن200٪ در280px حفظ و علت‌ها رفع شدند: minimum محتوای گرید آماده‌سازی و حداقل عرض متن کنار نشان تزئینی معرفی. overflow پنهان نشد و oracle همان ماند. تصویر ایزومتریک SVG مستقل است، در موبایل برای بالا ماندن انتخاب منبع کنار می‌رود و حرکت reduced حذف می‌شود.

این نتیجه پذیرش کل تغییرات UI ثبت‌نشده همکار، دستگاه فیزیکی، screen reader یا استقرار زنده نیست. برش بعدی، پنل دستیار با نام روشن، فاصله از لبه، composer پایین، پیشنهادهای بدون ارسال خودکار و بررسی پنج عرض است. سرور اصلی، اتصال، VPN، live gates و دفتر مصرف تغییر نکردند.

## مرز env عمومی Next؛ candidate مستقل بر پایهf2df50d

نام NEXT_PUBLIC_ طبق مستند نصب‌شدهٔ Next16.4.2، در build وارد کد مرورگر می‌شود. فرم هشدار و اعلام عمومی‌بودن دارد؛ مقدار پُرشدهٔ طبقه‌بندی‌نشده/محرمانه پیش از هر provider read یا ذخیره input رد می‌شود. تأیید و اجرای grant تاریخیِ ناسازگار و استفاده از مرجع آن در build هم بسته‌اند؛ parser تاریخی خواندنی مانده است. credential نصب حتی با اعلام عمومی پذیرفته نیست. redaction مقدار موروثیِ credentialمانند نیز regression دارد؛ محدودیت heuristic در ADR0013 ثبت است.

روی code tree 02645eef7ea914d8c8a18a209307644c47b73cd2، build، typecheck، domain283/283 و HTTP28/28 با0fail/skip گذشتند. lint صفر error،30warning و9info موجود داشت. شش suite مرورگر به‌ترتیب75/27/27/22/38/5 گذشتند؛ case تازه، دکمهٔ disabled پیش از اعلام عمومی و هشدار form/review را در همان جریان recovery/یک env write مصنوعی می‌سنجد. همه مدل/providerها مصنوعی، سرورها disposable با port مستقل و درخواست خارجی صفر بودند. این gateها روی index بدون hunkهای UI همکار انجام شدند.

این اصلاح runner Docker را تغییر نداد؛ شاهد واقعی install/build/test/start/GET در Node22 به042cbb8 و بخش env/build زیر مربوط است. env واقعی، Next/GitHub دارای build، چرخه تازه fail-deploy→repair→redeploy، UI ترکیبیِ ثبت‌نشدهٔ همکار و screen reader/موبایل فیزیکی همچنان UNCONFIRMED هستند. guard بودجه زندهٔ گزارش همکار دور زده یا تمدید نشد؛ primary server، اتصال‌ها و VPN تغییر نکردند. قدم پذیرش بعدی، اجرای این caseهای باز توسط مالک تست زنده پس از تعیین تکلیف سقف مجاز است؛ هیچ مصرف تازه‌ای از این گزارش مجوز نمی‌گیرد.

## recovery نشست و env؛ candidate مستقل بر پایه042cbb8

actor در نشست تازه می‌تواند approval محیطیِ مصرف‌نشده را با hash همان پیشنهاد لغو کند؛ grant قبلی را اجرا نمی‌کند. پس از claim، revocation رد می‌شود و اثر احتمالی پس گرفته‌شده نمایش داده نمی‌شود. executing، پیام درحال اجرا و دکمهٔ GET وضعیت دارد؛ recovery مرحله claimed بدون request_started با همان observe به not_started می‌رسد. AUTH_REQUIRED فرم به ورود برنامه وصل و nonce پس از رد/شکست تازه می‌شود؛ مقدار قبلی در فرم بازنمایی نمی‌شود.

روی code tree `90b7a7453154fcb0506b0bea87082fdfb9681ada`، build، typecheck، domain282/282 و HTTP28/28 بدون fail/skip گذشتند. lint صفر error با30warning/9info بود. هر شش suite مرورگر روی همین کد به‌ترتیب75/27/27/22/37/5 گذشتند؛ 37 حالت guided شامل نشست قبلی، لغو بدون write، executing فقط‌خواندنی و recovery بدون POST تکراری است. fake provider فقط یک env update ثبت کرد؛ هیچ مقدار در model log/storage ظاهر نشد. این case بازیابی journal با fixture است، نه اثبات restart واقعی سیستم‌عامل یا PaaS.

گیت‌های Docker روی042cbb8 و شواهد جداگانهٔ آن در بخش بعد ثبت‌اند؛ این fix runner، source artifact یا transport build را تغییر نمی‌دهد. مدل/ابر این فاز مصنوعی و همه سرورها disposable با port مستقل بودند. primary server/config، VPN، دفتر مصرف زنده و فایل/hunkهای UI همکار تغییر یا commit نشدند. env زنده، Next/GitHub دارای build، چرخه تازه fail-deploy→repair→redeploy و ادغام با UI موازی همچنان پذیرش تازه ندارند. فرض آماده‌بودن کل مأموریت از این gateها مجاز نیست.


## env متصل به build و انتشار؛ candidate مستقل بر پایه37beb7a

مرجع configuration اکنون جزئی از برنامه و تصمیم build و ActionSpec v10 است. actor/project/account/app، lineage آزموده‌شده، کلیدها و HMAC بسته‌اند؛ source/image/فرمان/معیار قبلی به env عوض‌شده منتقل نمی‌شوند. secret با stdin و log driver none وارد container می‌شود، نه command line، Docker Env، mount یا فایل میزبان. configuration_changed با workload verified یکی نیست. [ADR0014](decisions/0014-build-environment-binding.md) مرز مصدر source artifact، CAS بیرونی و حفظ v1–v9 تاریخی را توضیح می‌دهد.

روی code tree `a77bcf4f3ff1658a4d6418244b9ce2d84071154d`: build، typecheck، domain281/281 و HTTP28/28 گذشتند؛ lint صفر error،30warning و9info داشت. شش suite مرورگر به‌ترتیب75/27/27/22/35/5 حالت را با transport مصنوعی گذراندند. 35 حالت guided شامل فرم امن، تصمیم build دارای reference، پنج عرض و رد بدون container است؛ تصویر تصمیم360 جدا بازبینی شد. این snapshot از hunkهای همین فاز ساخته شد و CSS/nav/icon هم‌زمان همکار را شامل نمی‌شود.

test:build-sandbox با dependencyهای واقعیِ cache و integrity همان lock، دو case واقعی Docker install/build/test/start/GET را گذراند: سالم1 container و fail→patch→همان تست pass سه container، artifact سالم هر دو815468242e09fec4ef3954a73e1465fc66c0c6a56c4e6e0890588eb4c9ba831b. case سوم env، همان mission و source را حفظ کرد، echo مصنوعی در receipt حذف شد، archive بازشده مقدار را نداشت و container خود job حذف شد. test:sandbox نیز containment و هر5 regression را گذراند. تکرارها واقعیِ local Docker ولی مدل/ابر همه مصنوعی‌اند؛ هیچ مصرف تازه مدل/لیارا، تغییر سرور اصلی، تنظیم اتصال، VPN یا reset دفتر مصرف در این فاز انجام نشد.

تست v10، تغییر configuration پیش از upload را بدون attempt و با نامعتبرشدن مجوز رد می‌کند؛ تغییر پس از HTTP200 نیز success نمی‌سازد. configuration ثابت با release جاری و workload درست می‌گذرد. env زنده، Next/GitHub دارای build زنده، چرخه تازه fail-deploy→repair→redeploy، reader/keyboard موبایل واقعی و ادغام نهایی با UI موازی همچنان UNCONFIRMED هستند. گزارش live همکار در afbbf0c شاهد جداست؛ سقف تجمعی آن run پیش از تکمیل repair مانع ادامه شد و این فاز آن را باز نکرد.


## اطلاعات امن runtime؛ candidate مستقل بر پایهafbbf0c

فرم داخل انتشار، مقدارها را به مرجع AES-GCM/actor/spec و ActionSpec v9 متصل می‌کند؛ migration10 فقط افزوده است. public readback نام/وضعیت دارد. HMAC مبنای کل configuration پیش از write دوباره تطبیق می‌یابد و مقادیر موجود در payload ادغام‌شده حفظ می‌شوند. احتمال restart پیش از تصمیم آشکار است؛ نتیجه configuration به معنی سلامت یا restart کامل نیست. منبع/حساب/app/پلن، جلسه، TTL، مصرف یک‌باره و journal قبلی reuse می‌شوند. [ADR0013](decisions/0013-project-environment.md) مرز CAS بیرونی و env ساخت محلی را ثبت می‌کند.

gate نهایی candidate: build، typecheck، HTTP28/28 و مرورگر30 حالت گذشتند؛ lint بدون error با30warning/6info بود. full domain279/279 پیش از تبدیل معادل عبارت مقداردهی mutex گذشت و پس از آن8/8 تست هدف env دوباره سبز شد. مرورگر با transport مصنوعی، پنج عرض320/360/390/768/1280، فرم رمز، refresh، همان proposal، یک env write مصنوعی، readback verified و بدون secret در storage/model log سنجیده شد. بازبینی تصویر320، overlap آیکون چت و دکمه عمومی اضافه را پیدا کرد؛ هر دو اصلاح، oracle اضافه و تصویر تازه بررسی شد. redaction برای نسخه JSON/URL مقدار شناخته‌شده regression دارد؛ staged whitespace و جست‌وجوی credentialهای نصب نیز پاک بود. هیچ provider/model واقعی در این فاز مصرف نشد؛ state/سرور/config و دفتر مصرف زنده دست‌نخورده‌اند. env ساخت محلی، env زنده، Next/GitHub دارای build و چرخه تازه fail-deploy→repair→redeploy همچنان بازند.


## نصب قفل‌شده و ادامه مأموریت؛ index مستقل بر پایه41e5080

برنامه immutable npm v3/Node22 به همان worker، تصمیم و artifact وصل شد. دو case Docker واقعی با dependency دارای integrity و مدل مصنوعی، install/build/start/GET و پروژه خراب fail→patch→همان معیار pass را گذراندند؛ source اصلی محفوظ، cloud write صفر و containerهای همان job پاک شدند. این نتیجه، مدل/PaaS واقعی یا Next نیست. [ADR0012](decisions/0012-locked-project-build.md) limits، تصویر دقیق، DNS/registry/integrity و مرز env/dependency تغییرکرده را توضیح می‌دهد.

سقف۱۶ ابزار client مدل حفظ و دو مجموعه آماده‌سازی متناسب با source به‌جای افزایش سقف آزموده شدند. ادامه structured، run و بودجه را حفظ می‌کند و دو nonce برای یک revision join می‌شوند. source یا scope مادی عوض‌شده منتقل نمی‌شود؛ تکمیل حساب اولیه پیش از اثر remote استثنای server-validated است. approval منقضی‌شدهٔ worker اجرا نمی‌شود و retry دریافت dependency تصمیم تازه می‌خواهد. سه regression Docker از domain به sandbox منتقل شدند، نه حذف.

روی candidate مستقل index بر پایه41e5080، build، typecheck، domain271/271 و HTTP27/27 گذشتند؛ lint بدون error با30warning/2info است. مرورگر23 حالت (320/360/390/768/1280، جزئیات فرمان‌ها و رد build با ادامه دکمه‌ای) را با صفر overflow/axe/pageerror/external request گذراند. پیش از تطبیق با41e5080، test:build-sandbox دو case واقعی Docker با npm ci/build/test/start/GET، تست فعلی unchanged و مدل مصنوعی را گذراند؛1+3 container همان jobها حذف شدند و artifact هر دو نسخه سالم،815468242e09fec4ef3954a73e1465fc66c0c6a56c4e6e0890588eb4c9ba831b بود. test:sandbox نیز containment و هر4 regression از جمله expiry صف را گذراند. تغییر آخر دریافت dependency با reader بی‌اعتنا به abort، در gate تازه domain پوشش داده شد؛ شاهد کانتینر قبلی به‌عنوان اجرای تازه بازشماری نشده است. Next compiler و چند tarball در مسیر معمول و relay خصوصی timeout شدند. cache فقط با digestهای همان lock خوانده شد؛ VPN/TUN/route تغییر نکرد و هیچ endpoint خصوصی نصب وارد محصول نشد. build واقعی Next، env امن، GitHub/build زنده و fail-deploy→repair→redeploy جدید همچنان باز/UNCONFIRMED هستند.


## انتشار مرحله‌ای؛ working tree پس از e7fffd1

دو تب و پیش‌فرض انتشار، ثبت structured، join درخواست هم‌زمان، تاریخچه scoped، چت اختیاری فقط‌خواندنی، expectation ثابت و worker container Node22 پیاده شدند. [گزارش تفکیکی](evidence/guided-publication.md) دو چرخه مدل/PaaS واقعی، failureهای حفظ‌شده و حدود آن‌ها را دارد. آماده‌سازی پروژه خراب، تست fail→patch→همان تست pass→انتشار همان artifact از وب و بدون چت گذشت؛ این شاهد، شکست انتشار اولیه و redeploy نیست.

مرورگر تازه 17 حالت در320/360/390/768/1280، متن200٪، ارتفاع کوتاه، keyboard/focus، draft، URL قدیمی و reload بدون model/write را با transport مصنوعی و صفر درخواست خارجی گذراند. sandbox واقعی با مدل مصنوعی، source اصلی محفوظ، پنج کنترل containment و حذف دو container را سنجید. پس از رفع regression قفلِ بیش از حد روی مشاهده تاریخی، domain تازه256/256 بدون skip گذشت؛ target32/32 پیش از full نیز ثبت است. build export و lint بدون error گذشتند. این شمارها متعلق به snapshotهای یادشده‌اند؛ نتیجه نهایی staged candidate جدا ثبت می‌شود.

generic Node/Next dependency/build، env امن، GitHub دارای build در تجربه تازه، چرخه تازه fail-deploy→repair→redeploy، reader/screen-reader و موبایل فیزیکی UNCONFIRMED/باز هستند. Docker این برش executor تست مستقیم موجود است؛ نصب dependency یا shell مدل اجرا نمی‌کند. این مرزها به‌عنوان پذیرش کامل مأموریت معرفی نمی‌شوند.

هسته روی index کامیت `568345a`: domain256/256، HTTP هدف5/5، build و lint بدون error (28warning/1info). candidate مستقل رابط با CSS/nav خود این برش و بدون فایل‌های همکار: HTTP26/26، شش suite مرورگر به‌ترتیب75/27/27/22/17/5، typecheck، build و lint بدون error (30warning/1info) گذشتند. آزمون‌های قدیمی پس از reload صریحاً بخش فنی را باز می‌کنند؛ default بسته می‌ماند. همه این browser/HTTPها synthetic و صفر درخواست خارجی‌اند.

gate خود کیت UX در نصب Windows اجرا شد و12/52 گذشت؛ dependency مرورگر کیت نصب نبود و بخشی از scriptها به shell/Pythonencoding آن وابسته‌اند. این self-test کیت، امتیاز Launchlane یا شاهد رد/قبول UI آن نیست؛ آزمون مستقل Playwright/axe محصول بالا مرجع است. reader و صفحه‌کلید موبایل فیزیکی همچنان UNCONFIRMED هستند.


شواهد جاری ابتدا و سابقه مراحل پیشین پایین‌تر ثبت شده‌اند. هر نتیجه به revision و شرایط خودش تعلق دارد؛ نتایج bootstrap جای قابلیت محصول و fixture جای اتصال زنده نیست.

## A09 و رفع timeout اتصال؛ پس از8d5abf2

در14336e1، چرخه تازه وب/PaaS روی backend/قراردادهای مطابق79 فایل commit و UI ثابت پیش از4cee36d گذشت: ساخت با ID/config و تصمیم جدا برای انتشار همان archive/Node22، WORKLOAD_VERIFIED و HTTP200/متن مورد انتظار، سپس دو تحقیق تازه فقط‌خواندنی. /orders با500 و لاگ سازگار، در۶ درخواست مدل workload/releases/logs/metrics را انتخاب کرد؛ / با200 در۵ درخواست، لاگ500 مسیر سفارش‌ها را از مشاهده ریشه تفکیک کرد. در هر دو، ورودی نامعتبر یک خواندن رد و در همان run اصلاح شد و منابع با واحد/زمان unverified نامعلوم ماندند. سؤال/تغییر ناخواسته و write تازه نداشتند؛ reloadها صفر model/write داشتند. مجموع۱۹ درخواست واقعی مدل،64,732 token گزارش‌شده و یک create/upload/release/delete ثبت شد؛ cleanup با تطبیق ID و404 گذشت. سرور export بسته و primary فعال ماند. GET مستقیم تازه مقصد uncertain قدیمی404 بود؛ receipt ازدست‌رفته بازسازی یا create تکرار نشد. [گزارش و حدود دقیق](evidence/agent-investigation.md) پذیرش محدود این چرخه را شرح می‌دهد؛ تعمیم SRE و UI نهایی پذیرفته نشده‌اند.

ارزیابی مستقل مدل واقعی با provider مصنوعی پس از اصلاح نیز دو case200/500 در۱۹ درخواست و52,251 token گزارش‌شده داشت؛ این۱۹ مستقل از۱۹ چرخه واقعی بالاست. domain249/249، lint/typecheck/build، HTTP21/21 و Agent browser20 حالت در360/768/1280 با provider/model مصنوعی و Node tests واقعی روی export گذشتند؛ bootstrap primary2/2 و browser نصب main با۲ درخواست واقعی مدل، render/reload، صفر page error و صفر درخواست مدل برای reload گذشتند. پس از توقف سرورهای آزمون، نصب تمیز dependencies با npm ci --prefer-offline --no-audit --no-fund در export جدا موفق شد؛ undici دقیق7.30.1 و domain249/249، lint/typecheck/build و HTTP21/21 دوباره گذشتند. cache استفاده شد و این ادعای نصب سیستم‌عامل تازه یا پذیرش UI همکار نیست.

پس ازbbd45cb، ساخت/انتشار و cleanup مقصد تازه گذشتند و /orders این بار500 واقعی در2.855s داشت، اما درخواست بعدی مدل INVALID_INPUT داد؛ آن تلاش SRE موفق نیست. سه بازپخش فقط‌مدل، read_releases با فیلد خارج قرارداد را بازتولید کردند؛ نام فراخوانی اصلیِ ردشده ثبت نشده بود. این خواندن اکنون ورودی را پیش از API در application رد و خطای هم‌بسته برای اصلاح در همان بودجه برمی‌گرداند. regression ابتدا شکست و سپس رد دو شکل نامعتبر، اصلاح و خواندن فقط‌خواندنی با identity fence و صفر write را تأیید کرد. چرخه14336e1 شاهد جدا پس از اصلاح است؛ failure قبلی حفظ شده است.

با درخواست مالک، واسط خصوصی این نصب فقط اتصال‌های API/model و میزبان دقیق آزمون را با IP_UNICAST_IF از کارت فیزیکی خارج می‌کند. proxy/default route/VPN دست‌نخورده‌اند؛ native fetch و pinnedHttps با گواهی معتبر و API401 بدون credential و چهار ردِ scope/auth/DNS گذشتند. نمونه محدود source فیزیکی/TUN و زمان API0.500/1.859s را ثبت کرد؛ علت همه خطاهای قبل ثابت نشده است. primary main/dev با همین مسیر، دو درخواست واقعی مدل، نمایش و reload همان گفتگو با صفر model call و صفر page error را گذراند. ابزار و تنظیم این مسیر خصوصی‌اند و محصول به آن وابسته نیست. جزئیات و مرزها در [گزارش تحقیق](evidence/agent-investigation.md) ثبت‌اند.

درea08a40، create با ID/config، انتشار جدا همان archive و HTTP200/متن درست از وب با مدل و PaaS واقعی گذشتند. reload صفر model/write تازه داشت و cleanup با ID و404 تأیید شد. goal بعدی /orders با cap5s، PROBE_TIMEOUT داد؛ مدل۵ درخواست و14,518 token گزارش‌شده، صفحه را unknown و READY را ناکافی نگه داشت. oracle500 پاس نشد و case200 بعدی اجرا نشد. مهلت شبکه probe با توجه به handshake واقعی5–7s به15s و همان deadline کوتاه‌تر run تنظیم شد؛ oracle وضعیت/محتوا عوض نشد. regression پاسخ6s/500 ابتدا شکست واقعی سابق را بازتولید و پس از fix همان500 را حفظ کرد. domain248/248، lint/typecheck/build و HTTP21/21 export ثابت گذشتند؛ پذیرش SRE پس از تنظیم هنوز نیاز به اجرای تازه دارد.

پس ازb525c18، POST واحد ساخت با UND_ERR_CONNECT_TIMEOUT پس از10.655s نامعلوم شد؛ uncertain/request_started و منع replay حفظ شدند. app بدون ID پذیرفته یا حذف نشد. سه GET بعدی با Pool سازگار، سه404 با زمان7.014/0.500/1.067s دادند؛ نبود فعلی app، نتیجه write گذشته را قطعی نمی‌کند. [ADR0009](decisions/0009-liara-transport-pool.md) Pool محدود فقط برای API، deadline اصلی و pin7.30.1 را ثبت می‌کند. dispatcher8 در native fetch شکست خورد و با HTTP واقعی محلی regression شد؛ multipart، credential مستقل، لغو و POST با پاسخ گم‌شده بدون replay سنجیده شدند. domain247/247، lint/typecheck/build و HTTP21/21 export ثابت گذشتند. primary پس از کنترل نبود عملیات فعال با dependency سازگار و gateهای مجاز بازراه‌اندازی شد و bootstrap2/2 گذشت. نتیجه تازه SRE/PaaS روی مقصد جدا هنوز در ادامه لازم است.

در83d961d، هر شش suite مرورگر75/27/27/22/20/5 با provider/model مصنوعی و Node tests واقعی گذشتند. تلاش زنده بعدی پیش از پیشنهاد و تکرار بعد از تصمیم ساخت، هر دو با خطای انتقال GET و صفر write متوقف شدند؛ دومی UND_ERR_CONNECT_TIMEOUT واقعی پس از10.491s داشت. [ADR 0008](decisions/0008-bounded-read-recovery.md) retry واحد GET همین خطا با همان بودجه/deadline و کنترل allowance write پیش از claim را ثبت می‌کند. هشت regression تازه و domain244/244، lint/typecheck/build و HTTP21/21 export ثابت گذشتند؛ آرگومان/scope و payload همچنان پس از retry اعتبارسنجی می‌شوند. این شاهد قراردادی رفع است؛ سناریوی تازه وب/PaaS پس از fix هنوز لازم است.

[گزارش تحقیق](evidence/agent-investigation.md) خواندن workload/metrics و بازه لاگ، هفت regression و دو ارزیابی مدل واقعی با provider مصنوعی را ثبت می‌کند. ۱۹ درخواست مدل، پاسخ200 همراه لاگ500 را از پاسخ500 همراه READY تفکیک کردند؛ منابع unknown ماندند. این ارزیابی، شاهد PaaS واقعی نیست.

دو تلاش تازه وب قبل از مدل و write با LIARA_TIMEOUT متوقف شدند. سه GET مستقل اتصال پشت سر هم از deadline مشترک15s استفاده می‌کردند؛ اندازه‌گیری واقعی همزمان سه200 در8.935s و جمع زمان‌های جدا بیش از25s، علت را مشخص کرد. اجرای همزمان با همان deadline و لغو siblingها اضافه شد؛ هیچ retry یا write تازه‌ای ندارد. application واقعی در9.292s با سه200 متصل شد. domain236/236، lint/typecheck/build export مستقل با UI ثابت پیش از4cee36d گذشتند؛ آزمون جدید وب/PaaS در ادامه لازم است. وضعیت حساب یا کل مأموریت از این شاهد محدود تعمیم نمی‌یابد.

## آماده‌سازی واقعی تا انتشار و نصب فعال؛ ae9a5f9

[گزارش این برش](evidence/project-preparation.md) شکست‌های حفظ‌شده و نتیجه بعد از اصلاح را ثبت می‌کند. دو پروژه فاقد start و دارای پورت ناسازگار، با۱۴ درخواست واقعی مدل، همان تست fail→pass، source اصلی محفوظ و همان artifact انتخاب‌شده گذشتند. direct test و npm start روی همان workspace با image ثابت Node22.23.3 نیز HTTP200 درست دادند؛ Docker راستی‌آزمایی مستقل بود و executor محصول نیست.

یک هدف تازه در وب، source فاقد start را تا اصلاح/تست، ساخت مقصد با هزینه/ID معتبر، انتشار همان artifact و پاسخ200/calendar-ready پیش برد. سه تصمیم داخل مرورگر ثبت شدند. READY همراه503 موفقیت نشد و readback محدود بدون oracle تازه یا write تکراری به پاسخ درست رسید. ۱۲ model call، 46,780 token گزارش‌شده، ۴۵ tool call و191,787ms ثبت شدند. دفتر provider یک create/upload/release/delete و۳۶ GET دارد؛ پس از تطبیق ID، حذف و absence404 تأیید شد. reload مدل یا write تازه نساخت. env و ساخت شبکه اجرا نشدند.

همین backend در export ثابت با UI پیش از4cee36d، lint/typecheck/build، domain227/227، HTTP21/21 و شش suite browser75/27/27/22/20/5 را گذراند. suiteهای مرورگر مصنوعی‌اند؛ model/provider چرخه‌های بالا واقعی‌اند. روی نصب اصلی main نیز پس از فعال‌سازی مجازِ چهار gate، یک درخواست چت فقط‌خواندنی با دو فراخوانی واقعی مدل و reload بدون replay و صفر pageerror گذشت؛ API، analysis/serviceReads=true داشت و پیام خاموش‌بودن نبود. این شاهد کارکرد نصب اصلی است؛ بازآرایی همزمان UI و پذیرش عمومی همه پروژه‌ها از آن نتیجه نمی‌شود.

منبع معرفی‌شده توسعه‌دهندگان دوباره بررسی شد؛ OpenAPI فعلی با snapshot commit‌شده بایت‌به‌بایت و SHA-256 برابر بود. README، API capabilities و A02/A03/A05/A07/A08/A18/A19 با این شواهد تطبیق شدند. نصب‌های تازه همچنان gateهای off دارند؛ نصب اصلی این آزمون با درخواست مالک فعال ماند. صورت‌حساب، اعتبار باقی‌مانده مدل، reader تازه، screen reader، build/dependency عمومی، env و کل مأموریت همچنان از این شاهد محدود پذیرفته نمی‌شوند.

## بازبینی تناسب و خوانایی UI؛ working tree پس از bb06e41

مرور اندازه و تناسب کامپوننت/دکمه/فونت در 320/360/768/1280 روی build همین تغییرات: مقیاس `clamp` عنوان و متن، برچسب کوتاه nav زیر 560px، composer چسبان هم‌تراز با پدینگ پنل، ردیف label/value کارت مقصد در موبایل و reserve اسکرول focus. شش suite مرورگر 75/27/27/22/23/5 حالت، domain 220/220 و HTTP 21/21 را گذراندند؛ صفر overflow/axe violation/pageerror/external request در حالت‌های سنجیده‌شده. پس از اصلاح یک selector focus، typecheck و build تولیدی و 23 حالت Agent (شامل 320px) روی worktree ایزولهٔ HEAD+همین پنج فایل دوباره pass شدند؛ artifact `.artifacts/agent-ui/2026-10-22T11-24-59.751Z/`. typecheck شاخه مشترک موقتاً به‌دلیل `src/server/workspace/ports.ts` در حال ویرایش هم‌کار مسدود بود؛ پس از رفع آن، typecheck و build تولیدی Turbopack روی main نیز pass شدند. reader تازه، screen reader و تأیید کامل WCAG همچنان UNCONFIRMED هستند؛ هیچ gate زنده یا درخواست provider اجرا نشد.

## A07؛ برنامه محدود start/port برای Node

تکرار واقعی پس از e5832ef، patch مؤثر package.json و baseline fail→همان تست HTTP pass و انتخاب artifact را گذراند، اما جمع‌بندی متنی مدل با JSON مورد انتظار تطبیق نداشت و MODEL_PROTOCOL داد؛ پذیرش وب کامل نشد. کنترل داخلی finish_investigation با همان validation پایان قبلی اضافه شد. domain227/227، lint، typecheck و build export ثابت گذشتند؛ تست‌های جدید پایان دارای قرارداد، follow-up/reload و رد completed/بدون evidence/فیلد اضافی را می‌سنجند. [ADR 0006](decisions/0006-typed-agent-completion.md) تصمیم و مرز اختیار را ثبت می‌کند. تکرار مدل واقعی بعد از این تغییر در ادامه لازم است.

نخستین چرخه مدل واقعی روی bb06e41 با شش درخواست، baseline fail→همان تست HTTP pass را تولید کرد، اما اسکنر `.listen(port)` با const معتبر را نفهمید؛ host، PREPARATION_UNVERIFIED داد و artifact نساخت. ورودی شکست‌خورده حفظ و با AST lexical اصلاح شد. domain224/224، lint/typecheck، build و HTTP21/21 روی export مستقل گذشتند؛ Number(PORT fallback) نمونه قدیمی نیز regression خود را حفظ کرد. تکرار زنده بعد از fix هنوز در ادامه لازم است؛ این failure به‌عنوان موفقیت گزارش نمی‌شود.

[گزارش آماده‌سازی](evidence/project-preparation.md): برنامه NodePreparation به همان CodeRepair و consent متصل شد؛ فقط فرمان start دقیق، entry موجود و پورت موجود در config می‌توانند تغییر کنند. پنج regression با transport مصنوعی و اجرای واقعی Node/HTTP محلی، دو ورودی متفاوت و leaf monorepo را گذراندند؛ تغییر scripts/deps/engine/test یا config نامرتبط و گسترش اختیار قرارداد قدیمی رد شدند. domain220/220، lint/typecheck و build در export مستقل گذشتند. مدل/وب تازه و target runtime هنوز برای این مسیر جدید سنجیده نشده‌اند؛ build/dependency عمومی، فایل تازه و ورودی بدون تست بازند. Docker/Node22 فقط spike واقعی runtime دارد و هنوز executor محصول نیست.

## چرخه کامل ساخت مقصد و انتشار از وب؛ 3cbf206

[چرخه واقعی](evidence/destination-provisioning.md) در export ثابت `3cbf206` با مدل و PaaS واقعی گذشت: app ناموجود→پیشنهاد نرخ پایه→تصمیم ساخت→ID/config readback→پیشنهاد همان archive به همان ID→تصمیم انتشار→upload/release→پاسخ200 HTML مورد انتظار. status503 و timeoutهای اولیه حفظ شدند و warmup محدود بدون readback دستی یا write تازه به نتیجه رسید. هفت درخواست مدل، 22,343 token گزارش‌شده و39 tool call ثبت شد؛ مدل قیمت را از catalog واقعی گرفت و ظرفیت همچنان unmeasured است. reload هیچ model/write تازه نساخت. پس از تطبیق ID، app آزمایشی حذف و absence404 تأیید شد؛ سرور موقت خاموش و gateهای نصب اصلی off ماندند. env/network write و اجرای محلی source scripts صفر بودند. این شاهد فقط همان Node آماده، پلن ایران و شبکه موجود را می‌پذیرد؛ چرخه env و آماده‌سازی build/dependency باز است.

`npm run check` روی main با lint/typecheck، domain215/215 و bootstrap2/2 تازه گذشت. export ثابت `3cbf206`، build، HTTP21/21 و هر شش suite مرورگر را در یک اجرای کامل تازه گذراند: به‌ترتیب 75/27/27/22/20/5 حالت. suiteهای مرورگر synthetic‌اند و تماس خارجی مسدود است؛ Node tests بخش اصلاح واقعاً در نسخه جدا اجرا می‌شوند. شاهد مدل/PaaS واقعی همان چرخه مستقل بالاست. بازآرایی UI پس از این commit در checkout اصلی ادامه دارد و نتیجه این export، تأیید تغییرات بعدی آن یا fresh-reader/screen-reader نیست.

## ساخت مقصد از گفت‌وگو؛ ادامه پس از 2c335e6

registry، کارت تصمیم ساخت، ادامه فقط با ID/config تأییدشده و approval جدا برای انتشار پیاده شدند. domain تازه main215/215، lint/typecheck گذشتند. snapshot مستقل working tree شامل رابط جاری build و HTTP21/21 را گذراند؛ تست جدید مرورگر پنج حالت در 360/768/1280 را با proposal مصنوعی و writeهای خاموش گذراند. این گزارش، هیچ تغییر UI ایجنت موازی را به این بخش نسبت نمی‌دهد. چرخه جدید واقعی ساخت→انتشار از وب هنوز لازم است؛ [گزارش مرزها](evidence/destination-provisioning.md).

## ساخت مقصد؛ application v8 در 2c335e6 روی main

[شاهد ساخت مقصد](evidence/destination-provisioning.md) پاسخ واقعی projectID و چرخه خود application با approval، یک create، receipt پایدار، تطبیق ID/config و انتخاب app را ثبت می‌کند. replay صفر write تازه داشت. source اجرا یا upload نشد؛ مدل، env write و deployment صفر بودند. app آزمایشی فقط پس از تطبیق ID حذف و نبود آن با 404 تأیید شد. migration9 با حفظ checksumهای1–8 و session/AgentRun تاریخی آزموده شد. domain208 و HTTP20، lint/typecheck/build گذشتند. این شاهد مربوط به مرحله application است؛ اتصال گفت‌وگو شواهد جدا در بخش بالاتر دارد.

## Catalog واقعی پیش از app؛ ادامه A04

[شاهد catalog](evidence/agent-catalog.md): هویت حساب/تیم و 24 ترکیب موجود واقعاً خوانده شدند. مدل واقعی پنج درخواست با registry جدید، پیشنهاد و جایگزین قیمت‌دار از دو quote معتبر داد؛ app انتخاب‌شده لازم نبود، ظرفیت unknown ماند و write صفر بود. چهار regression تازه و domain کامل 199/199، lint و typecheck گذشتند. build و HTTP19 روی export مستقل با UI پایه f94d44b و فایل‌های backend جدید سنجیده شدند؛ بازآرایی UI هم‌زمان، شاهد جدا می‌خواهد. quote، approval یا provisioning نیست و A04 partial مانده است.

## انتشار و اصلاح زنده از خود Agent؛ f94d44b

[گزارش چرخه واقعی](evidence/agent-publication-live.md) دو درخواست فارسی از مرورگر به مدل، approval، artifact، Liara و پاسخ سایت را ثبت می‌کند. HTML اصلی تأیید شد؛ در goal اصلاح، همان آزمون موجود fail→pass شد، فقط `cart.mjs` تغییر کرد و همان artifact منتشر شد. `/checkout` از 18.25 به 74 رسید. دو failure موقت (503 و 200 نسخه قبلی با وجود READY/current) حفظ شدند؛ readback صریح در همان رابط بدون model/write تازه، نتیجه هر دو action را تأیید کرد. سقف تجمعی guard یک درخواست مدل اضافه را قبل از شبکه متوقف کرد. این خطا از guard آزمون بود، نه شاهد خرابی provider.

App آزمایشی با harness ساخته و پس از تطبیق ID حذف شد؛ absence خوانده شد، سرور موقت متوقف و gateهای نصب اصلی خاموش ماندند. ساخت مقصد/env هنوز قابلیت Agent نیست. warmup محدود و backoff پس از این failure اضافه شد؛ regression کامل domain تازه 195/195 بدون skip گذشت. شاهد زمان‌بندی تازه محلی است؛ اجرای واقعی بالا متعلق به f94d44b و readback صریح است. [ADR](decisions/0002-workload-propagation.md) محدودیت نسبت‌دادن HTTP به نسخه را توضیح می‌دهد.

## اتصال انتشار به گفت‌وگو؛ پس از 5b0b0b8

ابزار `propose_publication` برنامه، مبدأ مجاز، port و پلن موجود را از host می‌گیرد. کارت تصمیم در همان تب، معیار HTML/API و مقصد را نشان می‌دهد. تصمیم و queued شدن Agent اتمیک‌اند؛ پس از تأیید، همان application انتشار و journal upload/release مصرف می‌شوند. موفقیت Agent فقط از receipt و oracle سرور به `completed` می‌رسد. GET/reload اجرا نمی‌سازد، نتیجه pending فقط readback می‌شود، و startup تأیید queued ولی claim‌نشده را لغو می‌کند. بودجه مستقل Agent، مجموع مدل/worker/tools/writes/polling را پایدار نگه می‌دارد؛ سقف feature تشخیص تاریخی تغییر نکرده است.

Domain تازه 193/193، lint، typecheck و build گذشتند. چهار regression جدید، توقف قبل از claim، رد، خطای ذخیره در لحظه تأیید، publication واقعی application با transport مصنوعی، نتیجه pending و recovery بدون replay را پوشش می‌دهند. suite Agent مرورگر 17 حالت در 360/768/1280 و متن 200٪ گذراند؛ کارت pending در سه اندازه دیده شد. artifact: `.artifacts/agent-ui/2026-10-22T07-49-47.592Z`. پیشنهاد کارت در بخش جدید آزمون UI seed شده و gate نوشتن سرور خاموش است؛ این بخش شاهد write یا مدل واقعی نیست. آزمون‌های Node برش اصلاح، واقعی و در workspace موقت‌اند. چرخه تازه Liara، قیمت catalog در پیشنهاد، ساخت app و env هنوز UNCONFIRMED هستند.

## ادامه Agent: قرارداد عمومی بررسی انتشار

در تغییر پس از `9213e6e`، ActionSpec v7 معیار متن HTML یا فیلد مستقیم JSON را به حساب، app داخلی، پلن موجود، Node و همان archive متصل می‌کند. نسخه‌های 1–6 بازنویسی نشده‌اند. probe این مسیر حداکثر 64KiB پاسخ کامل می‌گیرد؛ سقف تاریخی 4KiB پابرجاست. نتیجه نیازمند READY/current همان release، پاسخ مطلوب و fence دوباره release است؛ status تنها کافی نیست. این قرارداد ادعای آزمون همه رفتارهای برنامه یا اثبات محتوای سایر مسیرها ندارد.

`node --experimental-strip-types --test tests/domain/deployment.test.ts`، 22/22 بدون skip گذشت: HTML بیش از 4KiB، API اشتباه، 500، تغییر release، تغییر حساب و تمام regressionهای قبلی. lint و typecheck نیز گذشتند. هنوز اجرای تازه واقعی Liara یا اتصال این قرارداد به تصمیم مکالمه انجام نشده است؛ A08 partial باقی است.

## نخستین برش Agent؛ b3ebf55 تا 15aecaa

[گزارش تفصیلی](evidence/agent-first-slice.md) تطبیق A01، spike CLI، registry، worker و حدود پذیرش را ثبت می‌کند. تب مستقل پیش‌فرض، فرم‌های انتشار را از شروع مکالمه جدا می‌کند. مدل واقعی از درخواست وب به inspect/destination و سپس در goal مستقل به source/test، پیشنهاد اصلاح، تصمیم کاربر، worker، آزمون و artifact رسید. baseline فاکتور `26 !== 71` بود؛ همان آزمون پس از patch گذشت و نسخه آزموده‌شده انتخاب شد. source اصلی حفظ شد. هیچ write تازه Liara یا انتشار از این Agent اجرا نشد؛ AC26 کامل همچنان باز است. هزینه/credential/state فقط خصوصی‌اند.

پس از اصلاح حفظ انتخاب پروژه در `26d984c` و مرز آرگومان Node در `e1c4c53`، lint/typecheck/build، `check` با domain تازه 184/184 و bootstrap دو از دو، و HTTP تازه 19/19 بدون skip گذشتند. پنج suite مرورگر در یک اجرای کامل تازه به‌ترتیب 75/27/27/22/12 حالت را گذراندند؛ اندازه‌ها و شرایط هر runner مستقل‌اند و شمار حالت‌ها، درصد کیفیت نیست. در حالت‌های ثبت‌شده overflow، axe violation، pageerror و درخواست خارجی صفر بود. چهار suite قبلی provider غیرفعال دارند؛ suite جدید Agent از transport مصنوعی و اجرای واقعی Node در workspace موقت استفاده می‌کند.

artifactهای همین اجرای کامل: `.artifacts/ux/2026-10-22T06-52-48-288Z`، `.artifacts/deployment-ui/2026-10-22T06-53-41.499Z`، `.artifacts/restart-ui/2026-10-22T06-54-10.524Z`، `.artifacts/domain-ui/2026-10-22T06-54-36.922Z` و `.artifacts/agent-ui/2026-10-22T06-54-54.374Z`. تصاویر تب و اصلاح در 360/768/1280 مشاهده شدند. سپس فقط راهنمای مدل در `15aecaa` برای پایان هدف محلی بدون درخواست مقصد تغییر کرد؛ build، `check` تازه با 184/184 و دو bootstrap، و چرخه مدل واقعی با baseline تازه `26.5 !== 81` گذشتند. همان آزمون شامل فاکتور خالی و اعشار هم بود. نتیجه question=null/reply و بدون خواندن مقصد بود. پنج suite مرورگر روی این تغییر متن راهنما دوباره اجرا نشدند؛ UI/HTTP آن ثابت است. reader تازه، screen reader، streaming، OS/network sandbox و چرخه انتشار/بررسی سایت از خود گفت‌وگو هنوز UNCONFIRMED هستند.

نصب اپراتور، پس از بررسی صفر action در حال اجرا/نامعلوم و backup سازگار SQLite، فقط با restart همان dev process به migration 8 رسید. checksumهای 1–7 و شش وضعیت تاریخی برابر snapshot قبلی ماندند؛ workspace/project-flows/agent-runs بعد از ورود 200 و تب پیش‌فرض در مرورگر دیده شد. هر چهار gate مدل/اصلاح محلی/Liara/mutation خاموش‌اند و سرورهای موقت مدل پس از آزمون بسته شدند. این شاهدِ بازیابی نصب موجود است؛ clean install تازه همه قابلیت‌های Agent یا ساخت app زنده محسوب نمی‌شود.

مجموعه کامل domain یک بار به‌علت `pause(15)` در تست لغو، پیش از ورود transport لغو شد و 182/183 داد؛ تست به رویداد واقعی ورود provider متصل شد و اجرای کامل تازه 183/183 گذشت. مرورگر قدیمی نیز یک بار selector سراسریِ اولین form را به composer پنهان رساند؛ انتظار به همان دکمه incident محدود و اجرای کامل پنج suite تازه گذشت. معیارها تضعیف و نتایج اجراهای ناقص با هم جمع نشدند.

## بررسی واقعی پروژه GitHub؛ d981734 و 97cad97

[گزارش تفصیلی](evidence/github-project-review.md) علت دو خطای واقعی حساب را ثبت می‌کند: فایل داده3,949,893 بایتی در سقف قبلی512KiB و false positive واژگان js-tokens/Motion tokens. همان مخزن در مرورگر به128فایل/5,364,734بایت و archive پایدار رسید؛ readback مستقل تمام entryها را با manifest تطبیق داد. reload، تغییر بخش/Back و ورود مجدد پس از انقضای واقعی نشست، نتیجه را حفظ کردند. دریافت زیرپوشه src به‌درستی incomplete بود و انتشار را آماده معرفی نکرد. هیچ script پروژه، write Liara یا درخواست مدل اجرا نشد. public live ناشناس و private/account contracts در گزارش جدا هستند.

Export تمیز tracked از `d9817349febf9c38f9143be020b621a9ee8e6a34` با Node24.18.0 و بدون کپی env/DB/context خصوصی: npm ci، setup، lint، typecheck، build، domain169/169، HTTP18/18 و bootstrap2/2 موفق. چهار suite مرورگر نیز به‌ترتیب75/27/27/22حالت، با عرض‌های360/768/1280 و مرزهای280/320/390/414/559/560/767/959/960 طبق هر suite، موفق شدند. در حالت‌های ثبت‌شده overflow/axe/pageerror/external صفر بود؛ این بررسی، WCAG کامل یا سادگی تجربه همه کاربران را ثابت نمی‌کند. تصاویر review در360/1280 مشاهده شدند. artifactها با خروجی سرور/DB ایزوله در `.artifacts/candidate/d981734-2026-10-22T05-12-26.868Z/` نگه داشته شدند؛ پوشه checkout و سرور موقت حذف شدند. یازده فایل client بررسی و صفر match با secretهای setup ثبت شد. این export شاهد clone مستقیم GitHub یا revision نهایی تحویل نیست.

رابط نهایی در `97cad97`، با tree دقیق `c76a937b34bc66d875578539a799774ba708d397` از index تمیز export و جداگانه install/setup/lint/typecheck/build/bootstrap2 و چهار suite مرورگر75/27/27/22 را گذراند؛ artifact `.artifacts/candidate/c76a937-2026-10-22T05-19-41.727Z/`. domain/HTTP شاهد تازه مرحله قبل‌اند؛ تغییر بعدی فقط نام کنترل و regression باز/بستن picker است. نمونه واقعی با Enter و انصراف از پوشه محلی نیز انتخاب GitHub و focus را حفظ کرد.

graph نسل2026-10-21T19:24:24Z برای مسیرهای تغییرکرده stale و برای tests/scripts excluded بود؛ source دقیق، caller/provider و regressionها مبنای بررسی بودند. اسکیل‌های competition-agent-engineer، ux-ui-agent-skills و قواعد React/تعامل برای مرزهای مربوط استفاده شدند.

## دریافت کد GitHub؛ پایه 052aa8c

خطای «در حال دریافت کد ورود» با CLI رسمی نصب‌شده 2.103.0 بازتولید شد: حالت پیش‌فرض در1106ms پیام `One-time code (...) copied to clipboard` و URL رسمی داشت، اما parser فقط قالب `one-time code:` را می‌شناخت و false می‌داد؛ driver پس30s به timeout می‌رفت. GET عمومی GitHub نیز پاسخ302 در908ms داشت، بنابراین قطع عمومی شبکه علت اثبات‌شده نبود. با `--clipboard=false` همان CLI در1252ms خروجی قابل parse داد. این گزینه اکنون صریح است تا clipboard کاربر دست‌کاری نشود؛ parser هر دو پیام رسمی را می‌شناسد. [source رسمی همان نسخه](https://github.com/cli/cli/blob/v2.103.0/internal/authflow/flow.go) دو قالب و خط جدید انتهای URL را نشان می‌دهد.

برای پوشش مرز قبلاً تست‌نشده، launcher تایپ‌شده فقط در تست child کنترل‌شده Node می‌سازد؛ همان deviceLogin واقعی، محدودیت خروجی، parser و cancellation مصرف می‌شوند. تست کد تکه‌شده و stdout/stderr مستقل ابتدا با timeout شکست خورد؛ buffer مستقل هر stream علت را رفع کرد. counterexample URL تکه‌شده ابتدا به‌اشتباه protocol failure داد؛ فقط خطوط کاملِ قرارداد CLI parse می‌شوند و مقصد واقعاً نادرست همچنان رد می‌شود. شرط مقصد دقیق، سقف16384 و gateهای حساب/تأیید تضعیف نشده‌اند. fixture فقط کد ساختگی دارد و هیچ shell یا token واقعی دریافت نمی‌کند.

با Node24.18.0، domain تازه162/162، typecheck/lint بدون warning، production build و HTTP18/18 pass شدند. مرورگر عمومی روی همان UI، 75حالت/12عرض با صفر overflow/axe/pageerror/external گذشت: `.artifacts/ux/2026-10-22T04-40-18-464Z/`؛ آن run کنترل‌شده و بدون حساب واقعی بود. تغییر framing بعدی با regressionهای driver و domain/build/HTTP تازه بررسی شد؛ UI تغییر نکرد.

آزمون محدود adapter با CLI/شبکه واقعی، challenge را در1034ms دریافت و بلافاصله cancel کرد. مرور دستی نصب اصلی نیز «انتخاب از GitHub» → اتصال → codeVisible=true و نشانی دقیق `https://github.com/login/device` → لغو را طی کرد؛ starting پایان یافت، کد پاک و انتخاب پروژه قبلی حفظ شد. مقدار کد وارد خروجی ابزار، context مدل، گزارش یا screenshot نشد؛ فقط فرمت/نمایان‌بودن آن به‌صورت برنامه‌ای سنجیده شد. تصویر پس از لغو در `.artifacts/github-login-fix/cancelled-after-real-code.png` مشاهده شد. ورود نهایی، grant حساب، secure-storage واقعی پس از grant و مخازن خصوصی در این برش زنده تأیید نشده‌اند. هیچ مجوز حساب، درخواست Liara، write زیرساخت یا مصرف مدل انجام نشد. graph پوشش فایل‌های موجود stale و پوشش دو فایل تست جدید به‌علت transport بسته ناموجود بود؛ source دقیق مبنای آن‌ها بود.

## رفع ورود پس از HMR و یکسانی RTL؛ پایه 429db8c

اصلاح runtime/RTL در `ff8c11a`، رابط و regressionهای همان برش روی آن ثبت می‌شوند. domain تازه159/159، HTTP18/18، typecheck، lint بدون warning و production build pass شدند. `node scripts/test-browser.mjs` روی سرور/DB ایزوله با providerهای خالی و gateهای خاموش، 75 حالت در12عرض قبلی را گذراند؛ marker RTL در document-start افزوده شد و errorهای hydration کنسول نیز علاوه بر pageerror بررسی شدند. صفر overflow/axe/error/external در حالت‌های سنجیده‌شده ثبت شد؛ artifact `.artifacts/ux/2026-10-22T04-18-16-306Z/`. دکمه تحلیل خاموش و علت آن نیز assertion دارند. این آزمون، افزونه واقعی مرورگر کاربر را شناسایی یا تمام رفتار آن را تأیید نمی‌کند.

مرور دستی نصب اصلی، ورود با کلید ذخیره‌شده بدون نمایش آن، بازیابی پروژه و گزارش تاریخی و وضعیت غیرفعال دستیار را طی کرد؛ تصویر `.artifacts/runtime-repair/assistant-status.png` مشاهده شد. هیچ تحلیل هزینه‌دار، اتصال دوباره حساب یا درخواست خارجی از این مرور اجرا نشد. backup و DB خصوصی Git-excluded باقی ماندند.

مرورگر restart نیز روی همین برش، 27 حالت در8عرض با صفر pageerror/external گذشت: `.artifacts/restart-ui/2026-10-22T04-21-15.176Z/`. پس از این run فقط شرط تکراری نمایش دکمه به متغیر محلی منتقل و JSX خواناتر شد؛ شرط و متن/دسترسی تغییر نکردند.

روی dev نصب اصلی، با کلید صحیح، POST `/api/session` پاسخ 200 داد ولی GETهای workspace/project-flows/incidents پاسخ 503/INTERNAL_UNAVAILABLE دادند. بررسی readOnly نشان داد schema نصب اصلی تا 6 است و `restart_progress` وجود ندارد؛ source جدید در readهای action از آن استفاده می‌کند. runtime سراسری، Store پیش از تغییر را بدون بررسی نسخه بازاستفاده می‌کرد و migration سازنده دوباره اجرا نمی‌شد. این شاهد اشکال سرور پس از ورود است، نه کلید اشتباه.

runtime اکنون کلید پایدار محاسبه‌شده از migrationها را بین route bundleها بررسی می‌کند؛ cache قدیمی یا تغییر stateDir خطای `RUNTIME_RESTART_REQUIRED` با راه بازیابی می‌دهد. HMR نه DB را مخفیانه باز می‌کند و نه recovery را دوباره اجرا می‌کند. config تازه روی اتصال معتبر مصرف می‌شود تا gate خاموش با config قدیمی فعال نماند. تست SQLite موقت، ارتقای واقعی v6 به v7، حفظ نشست/checksumها، cache قدیمی/بدون stamp، تغییر مسیر و صفر اجرای مجدد recovery را می‌سنجد. تغییر قرارداد Store بدون migration نیز همچنان نیازمند restart سرور توسعه است.

پیش از تعمیر نصب اصلی، نبود executing/observing/uncertain بررسی و backup خصوصی SQLite گرفته شد. فقط dev process همین repository بازراه‌اندازی شد؛ startup migration شماره 7 را append کرد. POST/session و سه GET فوق پس از آن 200 شدند؛ ورود در مرورگر واقعی و بازیابی پروژه/incident تاریخی مشاهده شد. checksumهای 1–6 و وضعیت پنج failed/یک succeeded حفظ شدند. پروژه آزمایشیِ حذف‌شده به‌درستی نیازمند انتخاب پوشه/برنامه تازه است؛ نتیجه تاریخی، سایت فعال کنونی نیست. این عملیات محلی، آزمون جدید Liara یا مدل نیست؛ سه gate در config مصرف‌شده false هستند.

گزارش hydration شامل تنها class اضافه `rtl-enabled` در ریشه بود و source برنامه آن را تولید نمی‌کرد. منشأ دقیق افزونه/اسکریپت بیرونی شناسایی نشده است. اکنون همین marker RTL صریحاً در SSR/کلاینت تولید می‌شود؛ suppressHydrationWarning افزوده نشده است. HTTP تولیدی ریشه فارسی را بررسی می‌کند و مرورگر marker را پیش از hydration مثل گزارش کاربر اضافه و پیام‌های hydration در console را جمع می‌کند. این اصلاح، ضمانت سازگاری با هر تغییر DOM توسط افزونه‌ها نیست.

## T33؛ هسته 9033250 و رابط روی همان پایه

در ۲۰۲۶-۱۰-۲۲، Node 24.18.0، هسته `9033250` و diff رابط محدود کندی بررسی شدند. `npm run test:domain` تازه 157/157، typecheck، lint بدون warning، build و HTTP تازه 17/17 pass شدند. تست‌های اضافه، سه GET ترتیبی، تطبیق هویت/روش/زمان/پاسخ، نمونه ناکافی، timeout بدون زمان صفر، توقف سری روی پاسخ ناموفق، gate خاموش و بودجه ناکافی با صفر upstream، cancel، actor isolation، SQLite restore و خروجی بدون fingerprint داخلی را پوشش می‌دهند. oracle مستقل از مدل روی socket HTTP محلی با delay کنترل‌شده 180ms و سپس 2ms اجرا شد؛ provider و DNS مصنوعی بودند و TLS واقعی سرویس سنجیده نشد. آخرین مشاهده ms: نخست `[256,192,186]`، بدون حذف تأخیر `[189,201,205]` و پس از حذف `[13,32,32]`. نویز اجرای سری بدون تغییر می‌تواند نمونه‌ها را کمی پایین‌تر ببرد؛ آزمون از آن رفع علت نتیجه نمی‌گیرد و دامنه کنترل‌شده تأخیر را جدا بررسی می‌کند. مقایسه قطعیِ سری‌های یکسان و نمونه‌های هم‌پوشان با زمان‌های ثابت نیز تست شد.

مرورگر عمومی تازه `node scripts/test-browser.mjs`: 75 حالت در 12 عرض `[280,320,360,390,414,559,560,767,768,959,960,1280]`، صفر overflow، تخلف axe، page error و external request در حالت‌های سنجیده‌شده. گزارش `.artifacts/ux/2026-10-22T03-36-28-508Z/` شامل نمونه کندی، مقایسه نامرتبط/مرتبط، reload، سری ناقص، خطای 500 در آخر سری پس از پاسخ‌های موفق و متن ۲۰۰٪ در ۳۶۰ است. خطای آخر در خلاصه اصلی باقی می‌ماند و به «کندی رفع شد» تبدیل نمی‌شود. یک اجرای قبلی به‌علت سنجش کنترل‌های در حال حذف پس از refresh شکست خورد؛ انتظار آماده‌شدن واقعی فرم اضافه شد، حداقل 44px و oracle دسترس‌پذیری حفظ شدند. اجرای میانی `.artifacts/ux/2026-10-22T03-35-02-320Z/` در مرحله دریافت GitHub timeout داشت و با rebuild هم‌پوشانی داشت؛ علت قطعی از آن نتیجه نمی‌شود. اجرای نهایی بدون rebuild هم‌زمان و بدون ضعیف‌کردن assertion همان مسیر گذشت.

مجموعه‌های مستقل مرورگر انتشار 27 حالت/6 عرض، restart تعداد 27/8 و دامنه 22/9 نیز با همین build pass شدند؛ artifactهای تازه به‌ترتیب `.artifacts/deployment-ui/2026-10-22T03-31-29.766Z/`، `.artifacts/restart-ui/2026-10-22T03-31-55.728Z/` و `.artifacts/domain-ui/2026-10-22T03-32-17.399Z/` هستند. این‌ها runهای جدا و مصنوعی‌اند. مرور دستی CUA در 360/768/1280، انتخاب نمونه، دو مقایسه، بازکردن زمان‌ها و بازیابی را طی کرد؛ تصاویر `.artifacts/latency-manual/` مشاهده شدند. axe و تصویر، تأیید کامل WCAG یا کیفیت همه مسیرها نیستند.

درخواست واقعی Liara، write زیرساخت و مصرف مدل این برش صفر است. gateهای نصب اصلی خاموش نگه داشته شدند. هیچ app تازه‌ای ساخته نشد و سهم چرخه‌های بسته‌شده بازنشانی نشد. منابع واقعی، کیفیت تحلیل مدل برای کندی و تغییر هم‌شرایط واقعی هنوز UNCONFIRMED هستند؛ T33 فقط partial_local است.

## candidate مستقل پس از راهنمای دامنه و چرخه restart؛ 90e392a

revision `90e392a6299f66b6a222b095dfc03fc1745d50c8` با `git archive` در پوشه موقت مستقل استخراج شد. هیچ `.env.local`، `.local`، DB، source archive خصوصی یا context محلی کپی نشد. با Node 24.18.0 و lockfile همین revision، `npm ci --no-audit --no-fund`، `npm run setup:local`، typecheck، build، domain تازه 147/147، HTTP تازه 17/17 (شامل parent) و bootstrap تازه 2/2 pass شدند؛ fail/skip/cancel صفر بود. setup کلیدهای محلی تازه ساخت؛ provider keyها خالی و سه gate خاموش ماندند. ۱۱ فایل client با کلیدهای همان setup match نداشتند. logها و نتیجه در `.artifacts/candidate/90e392a-2026-10-22T03-04-14.920Z/` هستند؛ server و پوشه موقت در پایان بسته/حذف شدند.

این export مستقل tracked است، نه clone مستقیم GitHub و نه مرورگر تازه در آن پوشه. source/scripts/tests/package/lock بین `7917816`، چرخه زنده، و `90e392a` یکسان‌اند؛ commit میانی فقط شواهد و حدود قابلیت را مستند کرد. مجموعه‌های مرورگر و اصلاح focus در بخش T25 با revision/محدوده خودشان ثبت شده‌اند؛ اعداد چند run به یک ارزیابی ساختگی تبدیل نمی‌شوند. 42 لینک محلی در نه سند فنی نیز به فایل‌های tracked رسیدند؛ URL خارجی و anchorها موضوع آن check نبودند. reader تازه، T40 و candidate تحویل نهایی هنوز بازند.

## چرخه زنده v5 و restart؛ candidate 7917816

[گزارش مستقل چرخه](evidence/restart-live-cycle.md) مسیر واقعی create fixture ← source inspection/archive ← پیشنهاد v5/approval/execute ← release/readback ← incident 500 ← رد و پیشنهاد v6 تازه ← یک restart ← همان صفحه 500 ← حذف را ثبت می‌کند. صرف READY ابتدا همراه پاسخ نامعتبر بود؛ تنها بازخوانی دوازدهم، current release و JSON revision/status دقیق را تأیید کرد. runtime اندازه‌گیری‌شده از process.versions.node برابر 22.23.3 بود. restart با HTTP 200 پذیرفته شد؛ بازخوانی همان release/page، 500 و `unhealthy/failed` داشت. همسان‌بودن شناسه فرایند در مشاهده فوری و نبود operation ID اجازه ادعای پایان restart را نمی‌دهد. این failure مورد انتظار oracle بود؛ کد یا env برای سبزکردن نتیجه تغییر نکرد. UI واقعی با CUA مشاهده و تصویر `.artifacts/restart-live-7917816/restart-real.png` ثبت شد؛ این تصویر synthetic نیست.

شمارنده‌های durable هر پنج write برابر 1 بودند؛ پیشنهاد ردشده attempt نداشت. 67 درخواست API ثبت شد، شامل 62 GET؛ یک applets=500 به unknown تبدیل شد. probeهای HTTPS جدا از این شمارند. مدل صفر درخواست داشت. برنامه پس از 180575ms، زیر ۲۰ دقیقه، حذف و نبودش با API خوانده شد. اختلاف موجودی مشاهده‌شده 1145.8 تومان زیر سقف ۵۰۰۰ بود؛ فاکتور قطعی یا انتساب تمام این اختلاف ادعا نمی‌شود. `.local/restart-cycle/verification.json` با DBهای readOnly، دو attempt محصول، صفر اقدام ناتمام، migrationهای 1–7 چرخه و صفر match کلیدهای config/ورود چرخه در ۱۱ فایل client را ثبت کرد؛ token Liara در DB چرخه plaintext نبود. audit نصب اصلی با migrationهای 1–6، checksum اولیه ثابت، همان شش attempt قبلی و سه gate خاموش pass شد. هیچ migration/recovery تازه روی DB اصلی اجرا نشد. fixture/ledger/DBها خصوصی و خارج Git هستند.

این شاهد محدود، پایان restart یا اصلاح‌کننده‌بودن آن، app دوم، سایر Nodeها/پروژه‌ها، secret envها یا پذیرش نهایی محصول را نمی‌سنجد. lint137/typecheck/build، domain147 و HTTP17 پیش‌تر روی همین source سنجیده شدند؛ مرورگر عمومی68/انتشار27/restart27 قبل از اصلاح scoped فاصله focus دامنه و مجموعه دامنه22 بعد از آن pass هستند. این یک run تجمیعی تازه همه تست‌ها یا clean export تازه نیست.

## T25 — رابط راهنمای دامنه؛ پایه 2b30287 و تغییرات این برش

ورود ← انتخاب صریح نمونه ← نتیجه بررسی ← «دامنه دلخواه وصل کنید» ← نام و روش DNS ← راهنما در production ایزوله طی شد. endpoint واقعی محلی و SQLite واقعی‌اند؛ هویت حساب انتخابی مصنوعی است. هیچ فراخوانی DNS/provider/model یا تغییر زیرساخت در این برش انجام نشد. guide شامل مقصد شناخته‌شده یا نبود اتصال، گام‌های منبع‌دار، کار registrar/ایرنیک و وضعیت صریح تأییدنشده است؛ CNAME/NS حدسی، completed یا مجوز بررسی میزبان تازه تولید نمی‌کند.

lint137، typecheck و build pass. سه مجموعه عمومی68/11 عرض، انتشار27/6 عرض و restart27/8 عرض روی source پیش از اصلاح scoped scroll-margin گذشتند؛ artifactهای `ux/2026-10-22T02-37-39-969Z`، `deployment-ui/2026-10-22T02-38-27.145Z` و `restart-ui/2026-10-22T02-38-51.966Z` زیر `.artifacts/` هستند. مجموعه جدید `node scripts/test-domain-browser.mjs` پس از آخرین اصلاح، 22 حالت در 280/320/360/559/560/768/959/960/1280، از جمله متن 200٪، را گذراند؛ صفر overflow، axe violation، خطای مرورگر و درخواست خارجی در حالت‌های سنجیده‌شده. ورودی نامعتبر focus/پیام کنار فیلد دارد؛ failure/cancel نتیجه قبلی را نگه می‌دارند، تغییر مقصد آن را پاک و نام را حفظ می‌کند، راهنمای بین‌المللی و بدون حساب و نیازمند ورود دوباره صریح‌اند. فایل report در `.artifacts/domain-ui/2026-10-22T02-40-17.232Z/` است. این script به `npm run test:browser` افزوده شد و smoke پولی ندارد.

آزمون نخست نام dialog را اشتباه فرض کرده بود؛ با نام واقعی «حساب‌ها و دسترسی» اصلاح شد، بدون تغییر محصول یا حذف assertion focus. بازبینی تصویری جدا، بریدگی کادر focus عنوان را نشان داد؛ assertion تازه پیش از اصلاح شکست خورد (`domain-ui/2026-10-22T02-39-38.388Z`) و با scroll-margin توکن‌شده pass شد. تصویر نخست نیز در `.artifacts/domain-manual/initial-focus-768.png` محفوظ است. مرور دستی نهایی 360/768/1280، focus عنوان در حدود 16px داخل viewport و client/content برابر 345/345، 753/753 و 1265/1265 را ثبت کرد؛ تصاویر و geometry در `.artifacts/domain-manual/` هستند. فهم reader تازه، screen reader واقعی و اتصال دامنه حساب زنده سنجیده نشده‌اند؛ axe یا screenshot تأیید کامل WCAG نیست.

## T25 — قرارداد راهنمای دامنه؛ پایه 48addbf و تغییرات این برش

`POST /api/domains/guide` با session/Host/Origin/CSRF، IDNA و تطبیق انتظار team/app/internal ID با اتصال همان actor سنجیده شد. هیچ provider/model request، migration، تغییر origin مجاز probe یا approval لازم نیست؛ credential باز نمی‌شود. حالت بدون اتصال، برنامه انتخاب‌نشده و ورود مجدد، راهنمای عمومی با target خالی دارند؛ race انتخاب، جایگزینی app هم‌نام، app خارج allowlist و تیم دیگر رد می‌شوند. مقادیر DNS، NS یا وضعیت موفق اختراع نمی‌شوند. مبنا، [ثبت دامنه](https://docs.liara.ir/paas/domains/add-domain/)، [راه‌اندازی DNS](https://docs.liara.ir/dns-management-system/quick-setup/)، [گواهی](https://docs.liara.ir/paas/domains/enable-ssl/) و [پسوندهای پشتیبانی‌نشده](https://docs.liara.ir/paas/domains/supported-tlds/) رسمی، خوانده‌شده در ۲۰۲۶-۱۰-۲۲ است؛ دامنه و DNS حساب واقعی بررسی نشده‌اند.

lint135، typecheck و production build pass؛ domain تازه 147/147 و HTTP تازه 17/17 (شامل parent)، بدون fail/skip/cancel. هفت regression جدید، نام بین‌المللی، حد label، URL/IP/control، پسوند، actor، scope/race و جلوگیری از خروجی موفق جعلی را می‌سنجند. شکست نخست `example.ir\n` به‌دلیل trim پیش از تشخیص control بود؛ بررسی روی ورودی اصلی انجام و همان case با فاصله مجاز پیرامونی دوباره pass شد. log اولیه در `.artifacts/domain-guide/initial-control-character-failure.log` و domain نهایی در `core-domain.log` همان پوشه خصوصی است. خطای TypeScript روی دسترسی احتمالاً خالی به عضو fixture با ساخت fixture صریح رفع شد؛ نوع‌ها و validation ضعیف نشدند. UI/keyboard/browser این برش هنوز سنجیده نشده‌اند.

## candidate مستقل و گزارش تاریخی واقعی؛ 2975375

tracked export مستقل این revision با `git archive`، بدون `.env.local`، DB، `.local` یا context خصوصی استخراج شد. با Node 24.18.0 و lockfile همین candidate، `npm ci --no-audit --no-fund`، `npm run setup:local`، typecheck، build، domain تازه 140/140، HTTP تازه 16/16 و bootstrap تازه 2/2 pass؛ هیچ fail/skip/cancel نبود. این clone مستقیم GitHub نیست؛ مجموعه browser همین source در بخش بعد سنجیده شده و در export دوباره اجرا نشد. setup کلیدهای محلی تازه ساخت و سه gate خاموش و provider keyها خالی ماندند. scan فایل‌های client با کلیدهای همان setup match صفر داشت؛ نتیجه و logهای پاک‌شده در `.artifacts/candidate/2975375-2026-10-22T02-03-15.201Z/` هستند. server و پوشه موقت در پایان بسته/حذف شدند. 25 لینک محلی در شش سند فنی نیز به فایل‌های tracked معتبر رسیدند؛ URL خارجی و anchorها موضوع آن check نبودند.

گزارش واقعی ذخیره‌شده چرخه قبلی، فقط برای همان تیم و app آزمایشی، با `DatabaseSync({readOnly:true})` خوانده و در SQLite موقت بازپخش شد. `createIncidentHandoff` همان incident دارای 500 اولیه، diagnosis موجود و 200 ثبت‌شده همان صفحه را به فایل 13928-byte با برچسب تاریخی تبدیل کرد؛ مقادیر credentialهای config در فایل نبودند و row اصلی بدون تغییر ماند. شواهد خصوصی در `.artifacts/handoff-historical/7fb24b1c-f289-469f-8100-e44a08e2b4a2/` هستند. این یک آزمون آفلاین با داده واقعی گذشته است؛ نه جمع‌آوری تازه، نه تشخیص تازه مدل و نه اجرای زنده اصلاح. درخواست تازه Liara/مدل و write زیرساختی صفر بود؛ DB موقت در پایان حذف شد.

audit جداگانه readOnly روی محیط کاری در 2026-10-22T02:03:43Z: gateها خاموش، migrationهای اصلی 1–6 و checksum دو migration نخست محفوظ، همان شش attempt قبلی و 5 failed/1 succeeded، صفر executing/observing/uncertain/approved، اتصال رمز‌شده و selected app خالی. 148 فایل tracked با کلیدهای config و DB/WAL با کلیدهای provider تطبیق داده شدند و match شناخته‌شده نبود. migration 7 فقط در محیط‌های آزمون/بازتولید اعمال شد؛ DB اصلی برای پذیرش این برش migration یا recovery نشد. reader مستقل، screen reader، کیفیت عمومی مدل و چرخه زنده تازه همچنان سنجیده نشده‌اند.

## T34 — رابط دریافت و بازیابی امن؛ پایه e5f5fd5 و تغییرات این برش

گزارش از همان داده پایدار ساخته و بدون ارسال خارجی به‌صورت فایل Markdown دریافت می‌شود. پیش‌نمایش متن فقط‌خواندنی است؛ نتیجه نامعلوم restart و پاسخ صفحه جدا باقی می‌مانند. query مستقل، آخرین مشاهده را بیرون 20 اقدام اخیر نیز پیدا می‌کند و GET بازیابی همان evidence را در view نشان می‌دهد؛ row اولیه و approvalها تغییر نمی‌کنند. هفت case تخصصی گزارش، شامل مدل/کلید ورود ساختگی غیرخالی، اتصال رمز‌شده، prompt injection/fence، query URL، نمونه، داده ناموجود/کندی، سقف و نام فایل، پاسخ گم‌شده و scoped readback pass. lint روی 131 فایل، typecheck و build pass؛ domain تازه 140/140 و HTTP تازه 16/16، صفر fail/skip/cancel. transportها مصنوعی و SQLite/route واقعی محلی‌اند؛ درخواست واقعی حساب/مدل و write تازه صفر است.

browser نهایی روی همین source: 68 حالت/11 عرض عمومی، 27 حالت/6 عرض انتشار و 27 حالت/8 عرض restart pass؛ در حالت‌های سنجیده‌شده overflow، axe violation، خطای مرورگر و درخواست خارجی صفر بود. دریافت فایل واقعی با متن پیش‌نمایش برابر بود؛ خطا/لغو فایل قبلی را حفظ کردند، focus پس از لغو برگشت، ورود مجدد همان incident را بازیابی و پیش‌نمایش قبلی را پاک کرد. متن 200٪ برای preview باز در 280/360/559/560/768/959/960/1280 نیز سنجیده شد. نتیجه‌های نهایی خصوصی: `.artifacts/ux/2026-10-22T01-59-08-892Z/`، `.artifacts/deployment-ui/2026-10-22T01-59-53.001Z/` و `.artifacts/restart-ui/2026-10-22T02-00-16.499Z/`.

failure اولیه `.artifacts/ux/2026-10-22T01-40-38-955Z/` ردیف GitHub با اندازه صفر را هنگام جایگزینی پاسخ زیرپوشه ثبت کرد. کد chooseBranch، مسیر و ردیف‌ها را پس از پاسخ عوض می‌کند؛ آزمون بلافاصله بعد از click اندازه می‌گرفت. انتظار صریح `apps/web`، حذف ردیف قبلی و فعال‌شدن ادامه اضافه شد؛ هیچ صفراندازه‌ای از oracle حذف نشد. پیش‌نمایش نخست با pre نیز lint دسترس‌پذیری را رد کرد؛ به textarea بومی فقط‌خواندنی و قابل پیمایش تبدیل شد. این اصلاحات، اثبات دسترس‌پذیری کامل یا فهم‌پذیری برای همه کاربران نیستند.

یک بازاجرای domain روی همان منطق محصول، 138/139 و `fetch failed: bad port` در oracle مستقل workload داشت؛ log شکست در `.artifacts/handoff-test-failures/domain-bad-port.log` محفوظ است. port آزاد OS لزوماً در [قرارداد Fetch](https://fetch.spec.whatwg.org/#port-blocking) مجاز نیست. در `e5f5fd5`، allocator مشترک loopback با سقف 16 تخصیص و رد bad-port برای HTTP/browser/workload ساخته شد؛ assertionهای liveness/500/اصلاح غلط/200 تغییر نکردند و blocked-port و همسایه مجاز regression دارند. پس از اصلاح، مجموعه کامل تازه 140/140، HTTP16 و هر سه browser بالا pass شدند؛ نتیجه شکست با یک rerun بی‌توضیح پنهان نشد.

مرور دستی CUA با حساب/کلید موقت، gate خاموش و provider key خالی انجام شد: Enter، focus نتیجه، reload همان incident و دریافت واقعی فایل نمونه 6395-byte بررسی شدند؛ فایل برچسب نمونه داشت و کلید ورود را نداشت. client/content در 360 برابر 345/345، در 768 برابر 753/753 و در 1280 برابر 1265/1265 بود؛ screenshotهای نهایی در `.artifacts/handoff-manual/` دیده شدند. اندازه مرورگر بازگردانده و فقط تب‌ها/serverهای خود آزمون بسته شدند؛ محیط کاری موجود دست‌کاری نشد. reader مستقل، screen reader، الگوهای ناشناخته secret و handoff همراه جمع‌آوری زنده تازه این candidate همچنان unverified هستند؛ بازپخش آفلاین incident واقعی در بخش بالا جدا ثبت شده است. اسکیل‌های مؤثر: competition-agent-engineer، ux-ui-agent-skills، frontend-design، vercel-react-best-practices و web-design-guidelines؛ graph قدیمی/ناقص با خواندن source فعلی تکمیل شد.

## T34 — قرارداد گزارش قابل تحویل؛ پایه 4a01dfb و تغییرات این برش

API مشتق از incident پایدار همان actor، بدون فراخوانی provider، با پاک‌سازی دوباره credential، نقل امن داده نامطمئن و سقف خروجی ساخته شد. lint روی 129 فایل pass و typecheck/build pass؛ domain تازه 138/138 و HTTP تازه 16/16 pass، صفر fail/skip/cancel. شش case جدید، دسترسی actor، export پس از قطع اتصال/gate خاموش، log حاوی credential و prompt injection، حذف query، نمونه صریح، آخرین پاسخ restart بدون replay/ادعای پایان، اطلاعات ناموجود/کندی و محدودیت حجم/نام فایل را پوشش می‌دهند. آزمون HTTP واقعی محلی، auth/Origin، id نامعتبر/تکراری/ناموجود و headerهای no-store/nosniff را نیز سنجید. providerها و داده حساب مصنوعی‌اند؛ SQLite و routeهای production واقعی محلی‌اند. شکست اولیه نام method قطع اتصال در fixture بود؛ به method واقعی Store اصلاح شد. UI و بررسی reader تازه هنوز پذیرش این برش نیستند؛ هیچ اعتبار تازه یا write واقعی مصرف نشد.

## بازتولید مستقل candidate روی 0738e91

فایل‌های tracked این revision با `git archive` در پوشه موقت مستقل استخراج شدند؛ `.env.local`، DB، ابزارهای خصوصی و context محلی کپی نشدند. Node 24.18.0 و lockfile همان candidate: `npm ci --no-audit --no-fund`، `npm run setup:local`، typecheck و build pass؛ domain تازه 132/132، HTTP تازه 16/16 و bootstrap تازه 2/2 روی server production ایزوله pass، بدون fail/skip/cancel. این شاهد clean tracked export است؛ clone مستقیم GitHub یا بازبینی انسان تازه نیست. مجموعه browser روی همان source revision در بخش بعد ثبت شده و در export دوباره اجرا نشد.

setup کلید محلی تازه ساخت و هر سه gate خاموش ماندند؛ هیچ کلید provider از محیط کاری وارد آزمون نشد. 11 فایل client در build مستقل با کلیدهای همان setup تطبیق داده شدند و match صفر بود. logهای پاک‌سازی‌شده و نتایج در `.artifacts/candidate/0738e91-2026-10-22T01-06-30.536Z/` خصوصی‌اند. server و پوشه موقت پس از اجرا حذف شدند. audit جداگانه readOnly روی DB کاری نیز شش attempt پیشین، 5 failed/1 succeeded، صفر unresolved/approved و migrationهای 1–6 با checksum اولیه محفوظ را دید؛ migration 7 فقط در DBهای ایزوله این آزمون‌ها اعمال شد. هیچ درخواست تازه provider یا تغییر gate نصب انجام نشد.

## T23 — مسیر رابط و بازخوانی هماهنگ؛ پایه 69ba98c و تغییرات این برش

AC04/06/13/14/16؛ Node 24.18.0، Next 16.4.2. پنل اختیاری restart به routeها، تصمیم اتمیک و journal وصل است. ثبت تأیید با خاموش‌بودن خواندن، درخواست provider ندارد؛ مرز observe مستقل و پیش از dependency تزریق‌شده fail-closed است. زمان دریافت HTTP مستقل از checkedAt ثبت می‌شود؛ تنها شاهد دارای زمان و app/release/path معتبر در گزارش اصلی همان incident مصرف می‌شود. تاریخچه بدون observedAt به شاهد تازه تبدیل نمی‌شود. UI approval، اجرا، پذیرش و پاسخ صفحه را تفکیک و قطع انتظار را از replay جدا می‌کند.

اعتبارسنجی تازه روی همین candidate: `npm run lint` (124 فایل، بدون warning)، `npm run typecheck`، `npm run build`، `npm run test:domain` برابر 132/132 و `npm run test:http` برابر 16/16 pass؛ صفر fail/skip/cancel. `npm run test:browser` سه بخش مستقل دارد: 55 حالت/9 عرض عمومی در `.artifacts/ux/2026-10-22T00-52-07-836Z/`، 27 حالت/6 عرض انتشار در `.artifacts/deployment-ui/2026-10-22T00-52-46.229Z/` و 26 حالت/8 عرض restart در `.artifacts/restart-ui/2026-10-22T00-53-11.092Z/`. عرض‌های restart: 280/360/559/560/768/959/960/1280؛ متن 200٪ در 280/360/768/959/960 و جزئیات شناسه/مسیر/نام تیم بلند باز نیز سنجیده شدند. هیچ overflow، axe violation، page error، هشدار key تکراری یا درخواست خارجی در حالت‌های سنجیده‌شده ثبت نشد. این‌ها تأیید کامل WCAG، screen reader یا آسان‌بودن برای کاربر تازه نیستند.

سه failure اولیه حفظ شدند: key مشترک دو sibling، پس از refresh گزارش را تکرار می‌کرد؛ keyها مستقل و assertion یکتایی گزارش اضافه شد. سپس test، Enter را پیش از فعال‌شدن کنترل می‌فرستاد؛ انتخاب‌گر آزمون اکنون enabled بودن کنترل واقعی را انتظار می‌کشد و هنوز با صفحه‌کلید اقدام می‌کند. آخرین شکست، بیرون‌زدگی واقعی URL و radio در 280 با متن 200٪ بود؛ overflow-wrap و اندازه کنترل محدود شدند، بدون overflow-x مخفی یا حذف متن. artifactهای اولیه در `.artifacts/restart-ui/2026-10-22T00-41-40.640Z/`، `00-43-39.455Z/`، `00-45-00.057Z/` و اجرای دارای overflow.json باقی‌اند. oracle پذیرش، همان صفحه، انقضا و عدم replay کاهش نیافت.

مرور دستی با CUA روی production ایزوله و hostname جدا از نشست کاری انجام شد: ورود محلی، کنترل بسته همراه علت، رد با Enter، بازگشت focus به عنوان پنل، reload و رفتن به انتشار/Back تصمیم را حفظ کردند؛ گزارش یکتا ماند. client/content در 360/768/1280 برابر 345/345، 753/753 و 1265/1265 بود؛ تصاویر و geometry در `.artifacts/restart-manual/` خصوصی‌اند. fixture پایانی cancelled و صفر provider request داشت؛ tabها و server موقت بسته و viewport بازگردانده شدند. اسکیل‌های مؤثر: competition-agent-engineer، ux-ui-agent-skills، frontend-design، vercel-react-best-practices و web-design-guidelines؛ graph نسل 2026-10-21T19:24:24Z قدیمی بود و مسیرهای متکی به کد با source مستقیم بررسی شدند.

حساب و transport خودکار مصنوعی‌اند؛ login/decision/restore و SQLite محلی واقعاً اجرا شدند. هیچ smoke پولی مدل، درخواست واقعی Liara یا write زیرساختی تازه انجام نشد؛ هر سه gate نصب خاموش‌اند. restart live، correlation پایان واقعی آن و رفتار تغییر بیرونی بین preflight و POST همچنان unconfirmed هستند.

## T23 — قرارداد restart؛ پایه 12805b8 و تغییرات همین برش

AC04/06/13/16؛ Node 24.18.0. ActionSpec v6 و migration append-only شماره 7، هویت حساب/برنامه، پلن، نسخه جاری و شاهد تازه همان صفحه را به approval متصل می‌کنند. یک POST پس از claim و journal پایدار انجام می‌شود؛ HTTP 200 خالی پذیرش است و release ID ساخته نمی‌شود. پذیرش و پاسخ همان صفحه جدا ثبت می‌شوند؛ پایان واقعی restart همچنان اثبات نشده است. تصمیم در ADR 0003 است.

`npm run lint` (122 فایل)، `npm run typecheck` و `npm run build` pass؛ `npm run test:domain` تازه 131/131 و `npm run test:http` تازه 16/16، بدون fail/skip/cancel. 42 آزمون و زیرآزمون اختصاصی restart، deny/expiry/session/actor، دوبارکلیک، تغییر account/app/plan/release/origin/evidence، بودجه/لغو، 401/409/429/503، پاسخ گم‌شده، transport بی‌واکنش به abort، recovery پیش/پس از شروع درخواست، readback قدیمیِ هم‌زمان و fail-closed claim را پوشش می‌دهند. upgrade از migration 6 در SQLite موقت، checksumهای 1–6 و hash اقدام تاریخی را حفظ کرد. نخستین اجرای آزمون به syntax پارامتر property ناسازگار با strip-only بومی Node برخورد؛ constructor با field صریح اصلاح و مجموعه‌های تازه بالا اجرا شدند. oracle تضعیف نشد.

SQLite و HTTP server واقعی محلی‌اند؛ پاسخ‌های Liara و DNS/socket در domain مصنوعی‌اند. HTTP با کلیدهای provider خالی و gateهای خاموش، auth/CSRF/validation و بسته‌بودن مسیر را سنجید. UI این operation در برش بعد متصل و مرور می‌شود؛ این نتایج شاهد UI یا حساب واقعی نیستند. هیچ درخواست واقعی Liara/مدل، write زیرساختی یا مصرف اعتبار تازه انجام نشد. سه release سهم آزمون قبلی مصرف شده و app آن حذف شده است؛ live restart به مجوز و مقصد تازه نیاز دارد.

## UX67 — خوانایی تبلت؛ پایه 69f1705

تغییر محصول فقط نقطه دو ستونی `.workbench-grid` از 768 به 960 است؛ ورود، چیدمان گزارش اختلال، توکن‌ها و منطق API/state دست‌نخورده‌اند. در دو production ایزوله، با همان نمونه/متن پیشنهاد تأییدشده، اندازه viewport=768×1000 و پس از `document.fonts.ready`، client/content در هر دو 753/753 بود. عرض ستون اصلی از 409.21875 به 689 و ارتفاع همان proposal از 1158.609375 به 911.671875 پیکسل تغییر کرد. در 959، client/content=944/944 و یک ستون 880px؛ در 960، client/content=945/945 و دو ستون 527.375/329.625px دیده شدند. تصاویر و داده قبل/بعد در `.artifacts/tablet-ux/` خصوصی‌اند. این‌ها اندازه هندسی‌اند و امتیاز UX یا تأیید WCAG نیستند.

`npm run lint`، `npm run typecheck` و `npm run build` pass. `npm run test:browser` تازه، 55 حالت در 9 عرض مسیر عمومی و 27 حالت در 6 عرض انتشار را گذراند؛ متن 200٪ در 360/768/959/960 بررسی شد. در حالت‌های سنجیده‌شده overflow، axe violation، browser error و external request صفر بودند. artifactها: `.artifacts/ux/2026-10-22T00-07-32-266Z/` و `.artifacts/deployment-ui/2026-10-22T00-08-05.392Z/`. شواهد domain 89/89 و HTTP 15/15 متعلق به 69f1705 در بخش بعدند؛ تغییر CSS علت اجرای دوباره آن‌ها نبود. تمام حساب/providerهای این برش مصنوعی‌اند؛ کلید واقعی کپی نشد، gateها خاموش و درخواست واقعی Liara/مدل صفر بود. تست انسانی با کاربر تازه و screen reader انجام نشده است.

## T21 — انتخاب Node و approval v5؛ پایه 667227b

مرز نخست خراب: profile دارای نیاز `>=24.15.0 <25` بود ولی release JSON هیچ platformConfig نداشت. regression مستقل ابتدا diff نبود `platformConfig.version=24` داد؛ پس از اصلاح همان case pass شد. helper server-only محدوده کامل semver را با catalog مستند تطبیق می‌دهد، تنظیم صریح liara.json را با engines می‌سنجد و به runtime رایانه fallback نمی‌کند. semver 7.8.5 و types 7.8.0 با lockfile pinned شدند؛ همان نسخه runtime پیش‌تر dependency غیرمستقیم sharp بود و اکنون direct و deduplicated است.

ActionSpec v5 شاخه Node را در hash دارد؛ نسخه جعل‌شده، تغییر فایل‌ها، source/target/plan و approval مصرف‌شده مسیر تازه‌ای ایجاد نمی‌کنند. canonicalization قبلی تغییر نکرده است. v4 قدیمی اجرا نمی‌شود ولی journal/receipt/observe آن پس از reopen قابل خواندن است. profile تاریخی فاقد انتخاب runtime، با حفظ نتیجه به بررسی تازه نیاز دارد. تعارض engines/liara و نسخه نامعتبر پیش از provider، صفر read/write/attempt دارند. شرط نسخه جزئی صرفاً با انتخاب major یا پاسخ JSON سایت اثبات نمی‌شود.

`npm run lint`، `npm run typecheck` و `npm run build` pass؛ اجرای تازه `npm run test:domain` برابر 89/89 و `npm run test:http` برابر 15/15، بدون fail/skip/cancel. `npm run test:browser` تازه 55 حالت در 9 عرض و 22 حالت انتشار در 4 عرض را بدون overflow/axe violation/browser error/external request در حالت‌های سنجیده‌شده گذراند: `.artifacts/ux/2026-10-21T23-53-26-482Z/` و `.artifacts/deployment-ui/2026-10-21T23-54-00.460Z/`. اجرای قبلی در `.artifacts/deployment-ui/2026-10-21T23-49-55.758Z/` پس از دکمه پیشنهاد تازه، به‌اشتباه منتظر فرم دوم ماند؛ کنترل موجود مستقیماً پیشنهاد جدید می‌ساخت. انتظار کلیک اضافی از test حذف شد؛ oracle نسخه v5، تأیید تازه و صفر send ثابت ماندند. case اولیه و failure artifact حفظ‌اند.

مرور دستی CUA روی production ایزوله با حساب/برنامه مصنوعی، کلیدهای provider خالی و gateهای خاموش انجام شد. تأیید با Enter، انتقال focus به پیشنهاد، نسخه Node، بازیابی و دکمه اجرای غیرفعال با علت/گام بعد بررسی شدند. client/content در 360/768/1280 به‌ترتیب 345/345، 753/753 و 1265/1265 بود؛ تصاویر در `.artifacts/node-runtime-manual/` خصوصی‌اند. screen reader و کاربر تازه سنجیده نشده‌اند. ستون اصلی تبلت در 768 بیش از نیاز باریک و کنار آن خالی بود؛ این مشکل خوانایی با نبود overflow متفاوت است و برش بعدی UX آن را دنبال می‌کند. درخواست واقعی Liara/مدل و write زیرساختی این مرحله صفر بودند؛ شاهد زنده چرخه قبلی به v5 تعمیم داده نمی‌شود.

## چرخه زنده محدود روی 869035a

گزارش مستقل از چت در [controlled-live-cycle.md](evidence/controlled-live-cycle.md) است. سه release واقعی روی برنامه Node آزمایشی، 500 کنترل‌شده، تحلیل واقعی با دو فراخوانی/1653 توکن، تغییر نامرتبط همچنان 500 و اصلاح source دارای approval با پاسخ 200/live-v3 و release متناظر بررسی شدند. این cycle، env write، اصلاح خودکار کد توسط مدل یا پشتیبانی همه پروژه‌ها نیست. revision هر مرحله و حدود مصرف در همان گزارش ثبت‌اند.

برنامه و نبودش بعد از حذف با API و پنل همان تیم تأیید شدند؛ مدت حدود 29 دقیقه و اختلاف موجودی ثبت‌شده حدود 1145.8 تومان بود. شبکه خالی آزمون باقی است و حذف آن از مسیر رسمی بررسی‌شده در دسترس نبود. credential پنل فقط برای همان ورود رسمی و بدون چاپ/تصویر رمز استفاده شد؛ نشست موقت مرورگر خارج شد. اتصال محصول refresh و selected app خالی شد. همه gateهای نصب خاموش ماندند. audit خصوصیِ readOnly، migrations 1–6 با حفظ checksumهای backup اولیه، شش attempt با 5 failed/1 succeeded و صفر اقدام unresolved را تأیید کرد؛ plaintext کلید provider در SQLite نبود.

پس از candidate UI، lint/typecheck/build pass. domain تازه 81/81 و HTTP تازه 15/15؛ browser تازه 55 حالت/9 عرض و 19 حالت/4 عرض با provider مصنوعی و بدون external request، overflow، axe violation یا browser error در حالت‌های سنجیده‌شده گذشتند. مرور دستی تاریخچه واقعی با gateهای خاموش در 360/768/1280 نیز اجرا شد؛ client/content به‌ترتیب 345/345، 753/753 و 1265/1265 بودند. تصویر 768/1280 بلافاصله پس از تغییر viewport در سطح پنل برش داشت؛ پس از reload، screenshot خود tab ثبت و بررسی شد. این مشکل ثبت تصویر به‌عنوان overflow محصول گزارش نشد. تصاویر پاک‌سازی‌شده در `.artifacts/live-validation/` خصوصی‌اند؛ بررسی screen reader و کاربر تازه انجام نشده است.

اسکیل‌های مؤثر: competition-agent-engineer برای انتخاب مرز زنده و oracle مستقل؛ ux-ui-agent-skills و vercel-react-best-practices برای حالت/بازخوانی و مرز server/client؛ writing-guidelines برای هم‌سطح‌کردن README و limits. عدد کیفیت kit، درصد آمادگی یا امتیاز داور از این‌ها ساخته نشده است. گام بعدی هسته، رفع/تطبیق نسخه Node و تنظیمات موردنیاز پیش از استفاده گسترده، سپس restart و review تازه است؛ توسعه دامنه/عملکرد/handoff مستقل باز می‌ماند.

### نصب مستقل از کلون محلی تمیز

commit `869035a7ede1ad3816c3473895bc72b1d16bcf24` با `git clone --no-hardlinks --single-branch --branch main` از مخزن محلی به پوشه موقت مستقل کپی شد. `.env.local`، `.data`، `.local` و `.artifacts` در ورودی clone وجود نداشتند؛ dependency یا state از checkout کاری کپی نشد. این آزمون clone مستقیم GitHub نیست؛ تغییرهای بعدی این مرحله فقط مستندات‌اند.

روی Node 24.18.0، `npm ci`، `npm run setup:local`، `npm run lint`، `npm run typecheck`، `npm run build`، `npm run test:domain` تازه 81/81 و `npm run test:http` تازه 15/15 pass شدند؛ بدون fail/skip/cancel. setup کلید ورود و session تازه ساخت و هیچ کلیدی چاپ نکرد. production server همان نصب با پورت loopback آزاد اجرا شد؛ ورود با کلید تازه و GET خصوصی workspace پاسخ 200 دادند. فرمان واقعی bootstrap، `node --test tests/bootstrap.test.mjs` با `TEST_BASE_URL` همان server بود و 2/2 pass شد. این همان script `npm test` است. server متعلق به این بررسی متوقف شد؛ سرور کاربر دست‌نخورده ماند. credential provider خالی و سه gate خاموش بودند؛ هیچ smoke پولی در این بررسی اجرا نشد. suite مرورگر این clone دوباره اجرا نشد؛ شاهد مرورگر candidate در بند قبلی است.

## T22/UX — بازخوانی پس از پاسخ ناموفق؛ پایه bf276b1

نخستین release واقعی READY/current بود ولی probe اولیه 503 داد. نتیجه به‌درستی healthy نشد، اما UI دیگر امکان خواندن دوباره همان رسید را نداشت. `canReadDeploymentResult` در contract، application، Store و UI اکنون failed دارای receipt قطعی و stage=release_accepted را هم برای observe فقط‌خواندنی مجاز می‌کند. state/attempt/approval هیچ‌گاه به write-ready برنمی‌گردند. پس از reopen، 200 با revision غلط نیز شکست می‌ماند؛ فقط همان release/current/READY و status/revision دقیق می‌تواند آخرین مشاهده را موفق کند. case پیش از اصلاح ACTION_CONFLICT داشت؛ پس از اصلاح pass شد. بازخوانی واقعی action نسخه نخست، 500 را ثبت و failure را حفظ کرد؛ write اضافه‌ای نداشت.

گزارش اختلال اکنون reason مقایسه را یک‌بار نمایش می‌دهد و تغییر مستقیم env را از انتشار کد اصلاح‌شده جدا توضیح می‌دهد. `npm run test:domain` تازه 81/81، HTTP تازه 15/15، lint/typecheck/build pass؛ browser تازه مسیر عادی 55 حالت در 9 عرض و انتشار 19 حالت در 4 عرض، بدون overflow/axe violation/browser error/external request در حالت‌های سنجیده‌شده. artifactهای خصوصی: `.artifacts/ux/2026-10-21T23-07-43-359Z/` و `.artifacts/deployment-ui/2026-10-21T23-08-19.860Z/`. اجرای قبلی پس از تغییر متن گزارش، روی assertion متن کوتاه قدیمی timeout شد؛ case حفظ و matcher به همان reason کامل منتقل شد. این failure و تصویرش در `.artifacts/ux/2026-10-21T23-06-19-238Z/` باقی است. outcome مقایسه یا fixture برای سبزشدن تغییر نکردند. این suiteها provider مصنوعی دارند و صرفاً بخش UI/contract را ثابت می‌کنند.

## T20/T30 — logs v2 و lifecycle؛ پایه fffea88

قرارداد مستند v1 در حساب واقعی با ISO since پاسخ 400 «since باید عدد باشد» داد. CLI رسمی 9.4.7 در `commands/app/logs.js` از `GET /v2/projects/{app}/logs` با `start` بر حسب Unix seconds، direction=forward و last_lines=false استفاده می‌کند؛ داده گروه‌های metaData/values دارد و هر tuple شامل زمان نانوثانیه و JSON دارای `type/_entry` است. درخواست محدود همین قرارداد 200 داد. timestamp خام لاگ کنترل‌شده و ISO تولیدشده در خود پیام، با تقسیم دقیق BigInt به میلی‌ثانیه، حدود 2ms اختلاف داشتند؛ این شاهد به v2 logs محدود است و واحد metric/event را تأیید نمی‌کند.

parser جدید group/line/byte/field/time را محدود و متن wrapper را untrusted و پاک‌سازی‌شده نگه می‌دارد. fixture قدیمی collector به protocol انتخاب‌شده منتقل شد؛ تست v1 pure همچنان زمان عددی نامشخص را unknown نگه می‌دارد. regression v2 قبل از اصلاح fail شد؛ traversal با تغییر endpoint از ورودی کاربر ممکن نیست و هیچ retry/fallback upstream اضافه نشده است. lifecycle واقعی `/events` ردیف‌های action/status/time/release دارد؛ به metadata محدود و زمان خام unverified تبدیل می‌شود. applets با 500 unavailable و metrics با rawPoint و واحد unverified باقی ماندند.

`npm run test:domain` تازه 80/80، `npm run test:http` تازه 15/15، lint/typecheck/build pass. شش read محدود مستقیم و سپس reader واقعی production با fence هویت app، `500 /` و log تازه CONFIG_REQUIRED را parse و پایدار کردند. خواندن اول snapshot، log خالی داشت؛ بعد از درخواست 500 تازه و نوبت بعدی، پیام نمایان شد. empty اولیه دستکاری یا به تشخیص موفق تبدیل نشد؛ در این برش model صفر بار فراخوانی شد. مرورگر قبلی روی revision خودش باقی است؛ کیفیت diagnosis هنوز سنجیده نشده است.

## T22 — قرارداد واقعی رسید source؛ پایه 635198d

سه attempt نخست فقط در upload متوقف شدند؛ هر approval جدا و مصرف‌شده باقی ماند، هیچ POST release از آن‌ها انجام نشد. پاسخ محدود transport واقعی نشان داد `sourceID` نامی به قالب UUID با پسوند `.tar.gz` است؛ شناسه خام در artifact خصوصی باقی ماند. parser قبلی پسوند را رد می‌کرد. `sourceReceiptId` مشترک در adapter/journal و بازیابی، همان نام محدود را بدون تغییر قبول می‌کند؛ traversal/URL/پسوند نامربوط همچنان رد می‌شوند و validation شناسه release گسترده نشده است. fixture با شناسه مصنوعی هم‌شکل ابتدا `UPSTREAM_UNCERTAIN` داد و پس از اصلاح، ذخیره/reopen/ارسال دقیق receipt را گذراند.

`node --test tests/domain/deployment.test.ts` تازه 12/12 و `npm run test:domain` تازه 79/79؛ lint/typecheck/build pass. روی همان source اجرایی، درخواست upload واقعی 200 و release واقعی 201 داد؛ مرحله اجرا 2646ms بود. observer ابتدا BUILDING/pending را ثبت کرد، سپس READY/current همراه 503 را failed/WORKLOAD_MISMATCH دانست؛ probe خواندنی بعدی همان `/`، 500 و JSON revision مورد انتظار را مشاهده کرد. `/healthz` مستقل 200 بود و به‌عنوان اصلاح خطای صفحه اصلی پذیرفته نشد. این سناریو عمداً پیکربندی ناقص دارد؛ هنوز اصلاح واقعی یا diagnosis مدل انجام نشده است. مجموعه مرورگر/HTTP این اصلاح receipt جدا بازاجرا نشده‌اند؛ نتایج بخش قبلی با همان revision حفظ‌اند.

## T22 — توقف پیش از release؛ پایه 7c8c988

برنامه Node آزمایشی با مجوز مالک، سقف 30,000 تومان، حداکثر سه انتشار و حذف پس از آزمون ساخته شد. `small-g2` همراه `basic` در catalog موجود بود، اما ساخت بدون شبکه با `400 g2_plan_unavailable` رد شد؛ GET بعدی نبود app را تأیید کرد. پس از ساخت شبکه اختصاصی آزمون با همان تیم، ساخت app و readback شناسه/پلن موفق شدند. این provisioning یک harness خصوصی اپراتور با approval/attempt پایدار بود؛ ساخت app/network هنوز قابلیت UI محصول نیست. نرخ پاسخ catalog، جمع سخت‌افزار و بسته، 1041.66 تومان/ساعت است؛ مبلغ واقعی کسرشده هنوز اندازه‌گیری نشده است.

سرور production جدا با gateهای مقطعی و تنها app آزمون اجرا شد؛ model خاموش ماند. APIهای واقعی session → اتصال/انتخاب Liara → prepare محلی → پیشنهاد/تصمیم v4 گذشتند. نخستین execute در مرحله `upload_started` بدون source receipt به uncertain رسید؛ هنوز release ارسال نشده و علت transport باز است. عمل تکرار نشد. مرورگر واقعی نتیجه را پس از restart بازیابی و فقط observe را فراخواند. journal پیش از release، fresh GET هویت/پلن و Store transition ثابت کردند درخواست انتشار این attempt شروع نشده است؛ نتیجه `not_started` با توضیح احتمال source یتیم ثبت شد. این شاهد deploy موفق یا سالم‌بودن workload نیست.

regression اصلی source-503 و counterexample release-503 حفظ شدند: هر دو ابتدا uncertain، بدون replay و پس از reopen هستند؛ فقط توقف پیش از `release_started` پس از observe به failed/not_started می‌رود و پیشنهاد مستقل دوباره approval می‌خواهد. release با رسید گم‌شده همچنان uncertain است و جعل `not_started` در همان مرحله رد می‌شود. نخستین اجرای regression جدید fail بود. `npm run test:domain` تازه 78/78، `npm run test:http` تازه 15/15، lint/typecheck/build pass؛ `node scripts/test-deployment-browser.mjs` تازه 18 حالت در عرض‌های 280/360/768/1280، بدون overflow/axe violation/browser error/external request در حالت‌های سنجیده‌شده. artifact خصوصی: `.artifacts/deployment-ui/2026-10-21T22-39-34.507Z/`. providerهای suite خودکار مصنوعی‌اند؛ بازخوانی دستی بالا GET واقعی داشت. مجموعه کامل browser قبلی این برش بازاجرا نشده است. تصمیم ایمنی در ADR 0002 است.

## T20 — حساب و تیم واقعی؛ پایه cfbe099

۲۰۲۶-۱۰-۲۲ Asia/Tehran؛ main و working tree این برش. چهار commit تازه و source/call flow بررسی شدند. گراف Tier 2 نسل 2026-10-21T19:24:24Z مسیر validation را نشان داد؛ coverage برای adapterهای تازه not_tracked و برای مسیرهای قبلی metadata_changed بود و tests excluded بودند. source جاری و اجرای مستقیم مبنای ادعاها هستند.

خواندن واقعی محدود: اجرای نخست `GET /v1/me` و همان endpoint با teamID هر دو 200 دادند؛ اتصال به علت انتظار `team.name` رد شد. پاسخ واقعی `team.teamName` دارد. fixture پاک‌سازی‌شده همان field و شناسه مصنوعی، ابتدا fail شد؛ parser و دو fixture قبلی اصلاح شدند. اجرای بعدی سه GET هویت، تیم و `/v1/projects?teamID=...` را از validation واقعی گذراند؛ حساب/تیم موردنظر تطبیق و فهرست خالی مشاهده شد. یک GET تیمی billing هم 200 داد؛ raw account/billing ذخیره یا وارد مدل نشد. مجموع این دو اجرای محدود 6 GET، بدون retry، write زیرساخت یا درخواست مدل بود. catalogue طرح‌ها فقط داده پاسخ است؛ قیمت و واحد مصرف هنوز به‌عنوان قرارداد محصول پذیرفته نشده‌اند.

`node --test tests/domain/liara-connection.test.ts tests/domain/project-flows.test.ts`: 10 pass/0 fail/skip؛ `npm run test:domain`: 78/78 pass تازه؛ lint/typecheck/build pass. SQLite خصوصی ابتدا با readOnly بررسی شد: migrations 1/2 و صفر action. پیش از هر migration، backup بومی SQLite گرفته و نسخه/checksum آن تطبیق داده شد؛ backup فقط محلی است. این برش upload/release، schema برنامه، logs/metrics یا تشخیص واقعی را تأیید نمی‌کند. منبع عمومی auth/team: [Liara API](https://docs.liara.ir/references/api/about/) و [اطلاعات حساب](https://docs.liara.ir/references/api/get-info/).

## ثبت مرحله‌ای تغییرات در Git — ۲۰۲۶-۱۰-۲۲

سه commit کد به‌ترتیب `1eee3c4`، `4c9b44f` و `7100111` روی `main` ثبت شدند؛ مستندات قرارداد/طراحی/شواهد در commit جدا می‌آیند. کد اجرایی در این مرحله تغییر تازه‌ای نکرد؛ فقط دسته‌بندی و ثبت تغییرات موجود انجام شد.

`npm run lint` روی 112 فایل، `npm run typecheck` و `npm run test:domain` با 77 pass/0 fail/cancel/skip دوباره اجرا شدند. برای سنجش جداسازی commitها، هر index با `git checkout-index --all --prefix=<new isolated directory>` در مسیر تازه زیر `.artifacts/` export شد؛ working tree اصلی checkout یا reset نشد. روی index اول، فایل project-flows شش تست pass داشت؛ روی index دوم domain کامل 73/73 و روی index سوم domain کامل 77/77 pass شد. snapshotها به‌ترتیب `.artifacts/commit-index-workspace-n6iD83/`، `.artifacts/commit-index-deployment-CTxEKu/` و `.artifacts/commit-index-incidents-yTck8G/` هستند. این‌ها شاهد مستقل هر مرز commit هستند، نه یک مجموعه جمع‌شده بزرگ‌تر.

قبل از هر commit، فایل‌ها و diff staged، whitespace، مسیرهای خصوصی و نبود مقادیر secret تنظیم‌شده در staged/client assets بررسی شدند. build، HTTP و browser در این مرحله بازاجرا نشدند؛ نتایج بخش‌های قبلی با revision/configuration همان اجراها باقی‌اند. هیچ live provider/model call، write زیرساختی، push یا تغییر visibility انجام نشد؛ T20 همچنان blocked_live است. فایل پژوهشی خصوصی و سایر داده‌های ignored وارد commit نشدند.

## ادامه T20؛ موجودی دسترسی و اصلاح مرز read-only، پایه cbd23a9

۲۰۲۶-۱۰-۲۲ Asia/Tehran؛ branch `main` و HEAD مبنا `cbd23a9e13d2b6603dee27ca1474a652c34c0539` همراه working tree فعلی. مجوز این مرحله فقط بررسی محدود read-only حساب/app بود؛ مصرف مدل و write زیرساختی مجاز نبودند و انجام نشدند. dependency یا migration تازه‌ای در این ادامه اضافه نشده است.

### مرز دسترسی واقعی

config جاری به‌صورت in-process خوانده شد، بدون چاپ secret: API token تنظیم نشده، team تنظیم شده و app allowlist/selected app موجود نیست. SQLite خصوصی با `DatabaseSync(...,{readOnly:true})` و فقط SELECT بررسی شد؛ migrationهای اعمال‌شده 1/2 هستند و جدول `account_connections` وجود ندارد. `Store`، runtime، migration و recovery روی state خصوصی اجرا نشدند. فایل دسترسی محلی password دارد؛ password به API token تعبیر نشد و ورود یا ساخت کلید انجام نشد. نبود app تعیین‌شده به معنی خالی‌بودن حساب نیست؛ فهرست واقعی حساب خوانده نشده است.

artifact sanitized محلی: `.artifacts/liara-readiness/2026-10-21T21-58-59.767Z/result.json`. هر سه gate همچنان false هستند؛ **درخواست واقعی Liara: 0، write زیرساختی: 0، درخواست مدل/مصرف تازه اعتبار: 0**. T20 همچنان `blocked_live` است. 401/403، schema، pagination، زمان، واحد، plan و semantics واقعی env/release از نبود دسترسی نتیجه‌گیری نشده‌اند.

### برش مستقل و oracleها

- **AC01/08/09/11، app identity:** counterexample با نام app ثابت و `_id` تازه پیش از اصلاح پذیرفته شد. reader اصلی اکنون ID اتصال actor-bound را به collector می‌دهد؛ project پیش از سایر داده‌ها و پیش از بازگرداندن snapshot بررسی می‌شود. تغییر پیش از شروع، صفر log/probe دارد؛ تغییر حین خواندن کل snapshot را رد می‌کند. ID ثابت پذیرفته و هر هشت tool call، شامل GET اضافه نهایی، در یک budget شمرده می‌شود. endpoint قدیمی evidence قرارداد نام/team را دارد و جای گزارش ماندگار این مسیر نیست.
- **AC08/09/11، زمان همان symptom:** clock مصنوعی 20s در پاسخ project، یک HTTP 500 تازه روی `/orders` را در reader پیشین خارج پنجره 15s قرار داد. پنجره خودکار اکنون تا deadline همان budget و در پایان تا زمان واقعی جمع‌آوری است؛ `collectedAt` پایان snapshot و `at` محلی زمان دریافت مشاهده است. پنجره تاریخی صریح تمدید نمی‌شود؛ HTTP فعلی خارج آن، evidence کافی برای diagnosis/recovery تاریخی تلقی نمی‌شود. زمان خام log و واحد ناشناخته تغییر نکرده‌اند.
- **AC13، cancel/deadline:** transport بی‌پاسخ و body stream بی‌پایان، پیش از اصلاح تا guard آزمون 500ms معلق ماندند. `LiaraReadClient` حالا هم header و هم body را با deadline/cancel محدود می‌کند؛ کد CANCELLED از BUDGET_EXHAUSTED تفکیک می‌شود. validation حساب نیز با cancel خاتمه می‌یابد و اتصال ذخیره نمی‌کند. هر درخواست دقیقاً یک attempt شمارش‌شده دارد؛ retry اضافه نشده است. این آزمون‌ها transport/body مصنوعی دارند، نه اثبات لغو پردازش واقعی upstream.

### validation همین کد اجرایی

| بررسی | فرمان و شرایط | نتیجه |
| --- | --- | --- |
| Regression هدفمند | `node --test tests/domain/liara-read.test.ts tests/domain/liara-connection.test.ts tests/domain/incident.test.ts tests/domain/incident-runs.test.ts` | 21 pass، 0 fail/cancel/skip؛ چهار case تازه ابتدا fail و پس از اصلاح pass شدند |
| Lint / Types / Build | `npm run lint`، `npm run typecheck`، `npm run build` | pass؛ Biome روی 112 فایل، typegen/tsc و production build با dependencyهای موجود |
| Domain کامل تازه | `npm run test:domain` | **77/77 pass**، 0 fail/cancel/skip؛ شامل case اضافه پنجره تاریخی؛ جمع نتایج چند زیرمجموعه نیست |
| HTTP | `npm run test:http`؛ پس از build، production/DB/workspace ایزوله، کلید provider خالی | **14 subtest + 1 parent pass**، 0 fail/cancel/skip |
| Browser | `npm run test:browser`؛ production/DB ایزوله و upstream کنترل‌شده | **55 حالت/9 عرض** و سپس **15 حالت/4 عرض**، بدون overflow/axe violation/browser error/external request در حالت‌های سنجیده‌شده |
| Git / build trace | `git diff --check`، staged/tracked/exclude و 19 فایل `.nft.json` زیر server/app | whitespace صحیح، staged خالی، مسیرهای خصوصی tracked نیستند؛ صفر reference به `.local/.data/.artifacts/.env.local` در traceهای سنجیده‌شده |

artifact مرورگر اول `.artifacts/ux/2026-10-21T21-56-22-519Z/report.json` با عرض‌های 280/320/360/390/414/559/560/768/1280 است؛ artifact انتشار `.artifacts/deployment-ui/2026-10-21T21-57-02.761Z/results.json` با عرض‌های 280/360/768/1280 است. تاریخ پوشه‌ها UTC است. این ادامه UI تازه‌ای تغییر نداد؛ مرورگر مسیرهای موجود و بازیابی را regression کرد. fixtureها provider، DNS/socket و مدل را کنترل می‌کنند؛ فایل/SQLite محلی واقعی‌اند. حساب و workload واقعی، کیفیت مدل، screen reader انسانی و نسبت‌دادن log به release مشخص سنجیده نشده‌اند.

گراف Tier 2 نسل `2026-10-21T19:24:24Z` برای discovery/trace استفاده شد؛ coverage مسیرهای مورد استناد metadata_changed/not_tracked و برخی tests excluded بود. source جاری، import/callerها، diff و اجرا جای این محدودیت را برای برش فوق گرفتند؛ ادعای پوشش جامع گراف نداریم. export اولیه موجودی، جدول اتصال را در DB قدیمی فرض کرده بود و `no such table` داد؛ exporter محلی با بررسی schema اصلاح شد، بدون اجرای migration یا تعبیر خطا به پاسخ provider.

گام بعد: API token معتبر و app صریح در همان حساب/team تعیین شوند و فقط GETهای محدود T20 با mutation/model خاموش اجرا شوند. قفل اتمیک upstream، تعلق log به release، field/unit/time و حفظ env همچنان unconfirmed هستند؛ بررسی read-only به‌تنهایی semantics write یا سلامت deployment را نمی‌پذیرد. commit/push/انتشار انجام نشد.

## انتشار محدود و معیار نتیجه؛ candidate بر پایه cbd23a9

۲۰۲۶-۱۰-۲۲ Asia/Tehran؛ branch `main`، HEAD مبنا `cbd23a9e13d2b6603dee27ca1474a652c34c0539` به‌همراه working tree این برش؛ commit/push انجام نشد. Windows، Node 24.18.0، npm 11.16.0، Next 16.4.2، React 19.3.1، TypeScript 6.0.3، Playwright 1.62.1 و dependencyهای موجود با `npm ls --depth=0` تطبیق داده شدند. dependency جدید نصب نشد. AC02/04/05/06/13/14/16؛ AC05/06 همچنان شاهد زنده ندارند.

### رفتار و oracle

پیشنهاد اجرایی v4 به artifact/source/selection/revision، actor/team/app identity، پلن موجود و origin/path/status/JSON revision متصل است. read-only preflight پس از بررسی source و درست پیش از claim، app/node/plan را بررسی می‌کند. claim و مرحله ابتدایی در SQLite اتمیک‌اند؛ upload فقط همان archive hash را در field `file` می‌فرستد. source receipt پیش از درخواست release پایدار است و app/plan پیش از release دوباره خوانده می‌شوند؛ release receipt همراه observing ذخیره می‌شود. هر خطای مبهم بعد از claim، بدون write retry به uncertain می‌رود. گم‌شدن receipt با آخرین release حدس زده نمی‌شود و اجازه اقدام متعارض تازه نمی‌دهد.

موفقیت، صرف accepted/READY/200 نیست: همان release باید READY و current باشد؛ همان workload path باید status دقیق و JSON revision مورد انتظار را برگرداند. project/plan و release پس از probe موفق دوباره خوانده می‌شوند. 404، 500، نسخه قبلی، JSON صرفاً liveness، redirect، تغییر currentRelease و provider 403 موفق نیستند. pending به readback دستی بعدی می‌رود. مشاهده می‌تواند با mutation gate خاموش یا پس از انتخاب source دیگر انجام شود؛ هیچ approval تمدید/بازپخش نمی‌شود.

Root دارای workspaces دیگر به‌عنوان یک workload Node تأیید نمی‌شود؛ start تجمیعی باعث artifact قابل پیشنهاد نمی‌شود و کاربر باید زیرپوشه مستقل همان برنامه را انتخاب کند. profile قدیمی ready با همان bytes نیز هنگام restore دوباره از نظر قابلیت انتشار بررسی و stale می‌شود. این رفتار پشتیبانی عمومی monorepo یا dependencyهای بین workspaceها نیست.

### نتایج نهایی همین candidate

| بررسی | فرمان/شرایط | نتیجه |
| --- | --- | --- |
| Lint | `npm run lint` | pass؛ 112 فایل، بدون خاموش‌کردن rule یا explicit any |
| Type check | `npm run typecheck` | pass؛ typegen سپس TypeScript |
| Production build | `npm run build` | pass؛ مسیر observe ساخته شد، کلید/gate واقعی تغییر نکرد |
| Domain | `npm run test:domain` | **73 passed، 0 fail/cancel/skip**؛ اجرای تازه کامل، نه جمع runهای هدفمند |
| HTTP | `npm run test:http` | **14 subtest + 1 parent passed**، 0 fail/cancel/skip؛ production/DB/workspace ایزوله و کلیدهای provider خالی |
| Browser قبلی | بخش اول `npm run test:browser` | **55 حالت، 9 عرض** 280/320/360/390/414/559/560/768/1280؛ بدون overflow/axe violation/browser error/external browser request در حالت‌های سنجیده‌شده |
| Browser انتشار | بخش دوم همان فرمان؛ `test-deployment-browser.mjs` | **15 حالت، 4 عرض** 280/360/768/1280؛ بدون overflow/axe violation/browser error/external request؛ متن 200٪ در 360، Enter، focus نتیجه، reload، progress، pending، failed، verified، نسخه بعدی و cancel/uncertain recovery |
| Git و داده خصوصی | `git diff --check`، بررسی status/staged و `git ls-files` مسیرهای خصوصی | diff بدون خطای whitespace؛ staged خالی؛ research، env محلی، state، archive و artifact خصوصی tracked نشده‌اند؛ exclude پژوهش حفظ شد |
| Build trace | خواندن 19 فایل `.nft.json` زیر `.next/server/app` | صفر reference به `.local/.data/.artifacts/.env.local` در traceهای سنجیده‌شده؛ این بررسی audit جامع secret نیست |

شواهد Browser قبلی: `.artifacts/ux/2026-10-21T21-41-32-954Z/`؛ Browser انتشار: `.artifacts/deployment-ui/2026-10-21T21-42-15.856Z/`، `results.json` و تصاویر موبایل/دسکتاپ مستقیماً دیده شدند. تاریخ پوشه UTC است. هر دو suite در یک فرمان تازه روی همین کد اجرا شدند؛ شمار حالت‌ها جداست. Browser انتشار upstream را در مرز درخواست کنترل می‌کند و از routes واقعی احراز هویت/source/approval/recovery و SQLite استفاده می‌کند؛ نتیجه آن اجرای واقعی transport Liara نیست. domain جدا از مسیر application و `LiaraDeployClient` با send/DNS/socket مصنوعی عبور می‌کند؛ exact archive bytes، دو مرحله، race و failure را می‌سنجد. localStorage خالی بود. screen reader انسانی و reader تازه سنجیده نشدند.

### failureهای حفظ‌شده و اصلاح

- regression root workspace ابتدا `ready` را به‌جای `incomplete` مشاهده کرد؛ start تجمیعی از پشتیبانی تک‌برنامه خارج و restore نتیجه قدیمی نیز stale شد. انتخاب Node leaf مستقل همان oracle را pass کرد.
- مرورگر پس از reload، proposal تازه را با path=/ و revision خالی ساخت، در حالی که کارت قبلی قرارداد را نگه داشته بود؛ applyFlow معیار ذخیره‌شده را بازیابی می‌کند و انتخاب پروژه تازه آن را پاک می‌کند. oracle مسیر/نسخه ضعیف نشد.
- پس از نتیجه موفق، اقدام نسخه بعدی وجود نداشت؛ آماده‌سازی دوباره source با approval تازه اضافه و از همان UI اجرا شد.
- متن 200٪ در 360px باعث document width=365 شد؛ DOM نشان داد brand/subtitle با min-content بیرون می‌زند. انعطاف محدود brand و wrapping اصلاح شد؛ overflow پنهان نشد. artifact شکست `.artifacts/deployment-ui/2026-10-21T21-32-37.900Z/overflow.json`، viewport=360/content=365 و عنصر brand را ثبت می‌کند. پوشه نهایی بالا مرجع نتیجه موفق است.
- خطاهای harness از محصول جدا بودند: DB پیش از ایجاد stateDir باز می‌شد و یک seed تاریخی ابتدا ID تکراری داشت؛ setup اصلاح شد. این‌ها نقص integration زنده تلقی نمی‌شوند. یک invocation formatter با config غیرفعال هیچ فایلی را format نکرد؛ سپس فقط فایل‌های تغییرکرده با تنظیم صریح JS هم‌سبک پروژه مرتب شدند.

### حدود evidence و گام بعد

گراف Tier 2 نسل `2026-10-21T19:24:24Z` برای discovery/trace استفاده شد؛ coverage مسیرهای تازه not_tracked، مسیرهای قبلی metadata_changed و tests/scripts excluded بود. بنابراین source جاری، importها، diff و اجرای مستقیم مبنای ادعاها هستند؛ هیچ ادعای پوشش کامل از گراف نداریم. گزارش پژوهشی خصوصی وارد مستندات یا Git نشده است.

**درخواست تازه واقعی Liara/مدل و هزینه: صفر.** fixtureها synthetic هستند؛ سازگاری مدل قبلی، evidence تشخیص یا deploy این candidate نیست. T20 باید identity/plan/schema/units و حفظ env در release را روی حساب مجاز تأیید کند؛ سپس یک upload/release/workload و نسخه بعدی با approval و budget صریح اجرا شود. API نام‌محور Liara قفل identity/plan بین preflight و write را در snapshot مستند نمی‌کند؛ readback جای CAS upstream نیست. مشاهده فقط صفحه اول 50 release و JSON revision کوچک است. origin انتخابی اثبات مالکیت DNS، failure نامعلوم اثبات عدم اثر، و پاسخ موفق اثبات علت رفع incident نیست. catalog قیمت، env secret-reference/merge/correction، restart transport، rollback، performance مستقل و handoff اختصاصی همچنان انجام‌نشده‌اند. gateها پیش‌فرض خاموش ماندند.

## UX63/65/66 — مسیر عادی مشکل سایت و بازیابی؛ پایه 0947c6b

۲۰۲۶-۱۰-۲۲ Asia/Tehran؛ Node 24.18.0/npm 11.16.0، working tree همین برش. برنامه/نشانه/صفحه → جمع‌آوری مجاز → گزارش → بررسی دوباره، به backend و SQLite وصل شد. تمرین اختیاری و صریحاً scripted است. Site origin فقط برای خواندن همان برنامه ثبت می‌شود؛ DNS/شبکه روی ذخیره فرم اجرا نمی‌شود. پروژه/گزارش پس از reload، Back/Forward، جابه‌جایی و ورود مجدد حفظ می‌شوند. لغو/خطای دریافت قبلی را پاک نمی‌کند. تحلیل و provider gates در تنظیم واقعی خاموش ماندند.

`npm run lint`، `npm run typecheck` و `npm run build`: pass. `npm run test:domain`: 59 pass، 0 fail/skip؛ `npm run test:http`: 13 subtest + 1 parent pass، 0 fail/skip. `npm run test:browser`: 55 حالت در 280/320/360/390/414/559/560/768/1280، 0 overflow/axe violation/browser error/external browser request در حالت‌های سنجیده‌شده. artifact: `.artifacts/ux/2026-10-21T20-40-33-738Z/`؛ timestamp پوشه UTC است.

Browser fixture فقط پاسخ upstream اتصال/دریافت را کنترل می‌کند؛ import GitHub از application واقعی، tar/gzip، snapshot خصوصی، scan و SQLite می‌گذرد. فایل خصوصی حذف می‌شود و کد ناشناس هرگز اجرا نمی‌شود. دریافت ناموفق/لغوشده، پروژه قبلی و focus را حفظ می‌کند. مسیر عادی incident با reader مصنوعی از application واقعی و SQLite عبور می‌کند؛ درخواست model/زیرساخت واقعی 0. خواندن 500 سپس 200 روی همان صفحه، حفظ نتیجه پس از failure/cancel/session loss و تفاوت تأیید/اجرا/نتیجه نامعلوم آزموده شدند. کیفیت علت مدل و مجوز حساب از این نتیجه استنتاج نمی‌شوند.

با CUA در مرورگر واقعی، اتصال لازم در مسیر عادی، نمونه اختیاری با Enter، انتقال focus به نتیجه، اصلاح نامرتبط و مرتبط و reload همان شناسه مشاهده شدند. در snapshot موبایل گزارش چهار پاسخ اصلی را پیش از شواهد بازشدنی نشان می‌دهد. failure اولیه `.artifacts/ux/2026-10-21T20-33-01-942Z/` ساختار نامعتبر definition-list را یافت؛ توضیحات داخل dd اصلاح و همان case پاس شد. run بعدی `.2026-10-21T20-34-57-788Z/` locator متن dd را پس از افزودن توضیح پیدا نمی‌کرد؛ متن نتیجه به span مشخص تبدیل شد، بدون تغییر oracle یا نتیجه 500/200.

spike محدود GitHub با CLI رسمی و config خالی، در 30s کد ورود نداد و با `GITHUB_LOGIN_TIMEOUT` پایان یافت؛ grant/credential صادر نشد. GET بدون احراز هویت به github.com و api.github.com به‌ترتیب 302/200 داد؛ این شاهد، علت timeout مسیر device را مشخص نمی‌کند. ورود/مخزن واقعی GitHub، ساختار تیم Liara و حساب/سایت واقعی همچنان unconfirmed هستند. آزمون تازه پولی مدل یا write زیرساختی اجرا نشد. اسکیل‌های مؤثر: ux-ui-agent-skills، web-design-guidelines، frontend-design، vercel-react-best-practices، webapp-testing و competition-agent-engineer؛ graph list/coverage در این جلسه Transport closed داشت و source/test مستقیم مبنا بود.

### بازبینی محدوده اتصال روی پایه 15ace2f

نام app ممکن است پس از حذف/ساخت دوباره ثابت بماند. refresh اکنون شناسه داخلی را هم تطبیق می‌دهد؛ app تازه انتخاب، پیشنهاد/تأیید یا نشانی بررسی قبلی را ارث نمی‌برد. گزارش جدید incident شناسه app را ذخیره می‌کند؛ گزارش قدیمی بدون آن خواندنی می‌ماند ولی analyze/recheck نمی‌شود. claim تحلیل همین شناسه را داخل transaction کنترل می‌کند. ورودی نامعتبر جست‌وجو/شاخه/پوشه GitHub پیش از بررسی credential و transport رد و پوشه‌های خصوصی از catalog حذف می‌شوند.

`npm run lint`، `npm run typecheck` و `npm run build`: pass؛ domain تازه 61/61 و HTTP تازه 14/14، 0 fail/skip. Browser تازه 55 حالت/9 عرض با همان شاخص‌های صفر، artifact `.artifacts/ux/2026-10-21T20-45-29-679Z/`. تست app با نام یکسان و شناسه متفاوت، عدم ایجاد attempt، ابطال approval، پاک‌شدن نشانی قدیمی و عدم تماس recheck/model را سنجید؛ refresh همان شناسه، انتخاب و تأیید معتبر را حفظ کرد. نخستین expectation آزمون جدید کد خطای PROJECT_CHANGED را فرض کرده بود؛ مرز زودتر PROJECT_ACCESS_CHANGED برگرداند. کد معتبر همان boundary و assert صفر attempt ثبت شدند؛ منع اجرا ضعیف نشد. هیچ درخواست واقعی Liara/مدل یا grant حساب انجام نشد.

### بازبینی نهایی responsive روی پایه fced65e

چیدمان چهار پاسخ گزارش در 768+ دو ستون شد و دکمه اتصال تکراری کارت وضعیت حذف شد. lint/build و browser تازه pass؛ 55 حالت/9 عرض، 0 overflow/axe violation/page error/external browser request در `.artifacts/ux/2026-10-21T20-48-10-308Z/`. domain/HTTP بازاجرای قبلی روی همین منطق server به‌ترتیب 61/14 pass بودند؛ برای تغییر CSS دوباره شمرده نشده‌اند. مرور دستی CUA در 360/768/1280 شامل Enter در انتخاب‌گر پوشه واقعی، آماده‌سازی خودکار، مسیر اتصال لازم، نمونه اختلال، focus، Back و reload همان شناسه بود. عرض واقعی DOM تبلت 753 با scrollbar، content=753 و دو ستون 309.5px دیده شد؛ screen reader واقعی و کاربر تازه هنوز سنجیده نشده‌اند. screenshot و axe به‌تنهایی اثبات UX یا WCAG کامل نیستند.

## UX61 — backend ورود و catalog GitHub، پس از 6dc7e85

- CLI رسمی pinned 2.103.0 با npm run setup:github و SHA-256 همان asset رسمی اجرا شد؛ بدون grant، تغییر PATH یا ورود حساب.
- lint، typecheck و build موفق؛ test:domain برابر 49 pass/0 fail/0 skip و test:http برابر 11 pass/0 fail/0 skip روی server ایزوله. UI این slice تغییر نکرد؛ browser تکرار نشد. تست HTTP جدید session/CSRF، metadata و operation ناشناخته را بدون شروع ورود واقعی بررسی می‌کند.
- تست‌های جدید با transport مصنوعی: جست‌وجوی مخزن خصوصی در pagination همان حساب، حذف فیلدهای credential، 401/403/429/404/409/5xx، keyring در برابر fallback ناامن، نشانی device نامعتبر، تأیید هویت/حساب، actor متفاوت، لغو و race تغییر حساب.
- این شاهد، ورود واقعی حساب یا دریافت مخزن خصوصی نیست. spike قبلی بدون grant در 20 ثانیه کد دریافت نکرد؛ مسیر شبکه/حساب همچنان UNCONFIRMED است. UI اتصال، دریافت محدود archive و binding revision در slice بعدی تکمیل می‌شوند.

## UX62 — اعتبارسنجی اتصال لیارا، پس از fadd33c

- lint/typecheck/build موفق؛ 51 تست domain و 12 تست HTTP موفق، بدون skip یا fail. تمام حساب‌ها و پاسخ‌ها مصنوعی‌اند؛ هیچ کلید واقعی خوانده یا مصرف نشده است.
- اتصال صریح فقط هویت محدود /me، تیم ثابت و فهرست برنامه‌ها را می‌خواند؛ payload حساس /me و env values حذف می‌شوند. کلید پیش از ذخیره با actor/provider رمز می‌شود؛ انتخاب برنامه فقط یک app را به محدوده اضافه می‌کند و allowlist مدیر را گسترش نمی‌دهد.
- regression: تیم اشتباه پیش از خواندن برنامه‌ها متوقف می‌شود؛ 401/403/429/5xx، کلید نامعتبر، cancellation پس از پاسخ، پاسخ ناسازگار، actor دیگر، تغییر محدوده و خاموش‌ماندن gate شواهد تست شده‌اند. metadata و درخواست بدون CSRF هیچ validation حسابی انجام نمی‌دهند.
- shape دقیق تیم و کلید/مجوز حساب واقعی هنوز تأیید نشده؛ موفقیت قراردادی به اتصال زنده یا اعتبار مالی نسبت داده نمی‌شود. UI راهنما و اتصال در مرحله بعدی است.

## UX61/63/64 — دریافت پروژه و بازیابی پایدار، پس از f6704e5

- lint/typecheck/build موفق؛ test:domain برابر 55 pass و test:http برابر 13 pass، بدون fail/skip. UI قبلی هنوز از API قدیمی استفاده می‌کند و پذیرش مرورگر این جریان در slice بعدی است.
- انتخاب محلی، نمونه صریح یا GitHub به flow جدید actor-bound در SQLite متصل می‌شود. بررسی و بسته خصوصی خودکارند؛ هیچ script پروژه اجرا و هیچ فایل به Liara ارسال نمی‌شود. بازگشت پس از restart، فایل‌ها و archive را دوباره بررسی می‌کند؛ فایل حذف‌شده/تغییریافته approval را نامعتبر می‌کند و نتیجه قبلی با هشدار حفظ می‌شود.
- ActionSpec v3، flow/انتخاب/مخزن/شاخه/revision/زیرپوشه را در اثر انگشت approval می‌بندد؛ canonicalization v1/v2 دست‌نخورده است. انتخاب تازه حتی با فایل‌های یکسان، پیشنهاد قبلی را باطل می‌کند؛ executing/observing/uncertain هرگز آماده replay نمی‌شوند.
- دریافت GitHub با transport مصنوعی روی commit دقیق، زیرپوشه و فایل‌های خصوصی تست شد. traversal، symlink/hardlink، نام تکراری در Windows، فایل بزرگ، gzip ناقص و cancel رد می‌شوند. حدها: 24MiB دریافت، 64MiB بازشده، 5000 entry، 1000 فایل قابل استفاده/20MiB، 512KiB هر فایل، حداکثر 16 snapshot خصوصی. مخزن بزرگ نیازمند ورودی کوچک‌تر است؛ subtree از upstream به‌صورت مستقل دریافت نمی‌شود.
- failure اولیه decoder: رد header بزرگ، child stream را پیش از مالکیت iterator نابود می‌کرد و خطای async پس از پایان تست می‌رسید؛ همان case نگه داشته شد و مدیریت خطای child اصلاح شد. fixture سبز، تأیید archive/redirect حساب واقعی GitHub نیست.

مرز تازه پس از 9845cec: connection جاری هنگام ایجاد/تصمیم/claim پیشنهاد v3 دوباره داخل transaction خوانده می‌شود؛ قطع اتصال بین validation و claim هیچ attempt ایجاد نمی‌کند. تغییر برنامه یا هویت، قطع اتصال و خرابی credential، approval پروژه را باطل می‌کنند؛ stateهای executing/observing/uncertain دست‌نخورده می‌مانند. ورود GitHub پس از پاسخ گم‌شده به همان run برمی‌گردد و دریافت کد سقف 30s جدا از مهلت کل دارد. 9 regression مرتبط domain موفق شدند؛ suite کامل قبلی 55 و HTTP روی build جاری 13 pass بودند. این نتایج با هم به شمارش تازه تجمیع نشده‌اند.

## UX61–64/66 — جریان انتشار و حساب‌ها در UI، پس از 0fd669b

- lint/typecheck/build موفق. Browser تازه در `.artifacts/ux/2026-10-21T19-53-48-323Z/`، 34 حالت روی عرض‌های 280/320/360/390/414/559/560/768/1280؛ صفر page overflow/axe violation/page error/external browser request. screen reader واقعی و تأیید کامل WCAG از این تست نتیجه نمی‌شوند.
- server/DB ایزوله و حساب مصنوعی؛ مسیر پوشه واقعی→بررسی/بسته خودکار→reload/Back/Forward، لغو انتخاب، پوشه ناموجود با حفظ نتیجه، manifest بدون هش، نمونه صریح، کلید نامعتبر، اتصال کنترل‌شده/انتخاب app، پیشنهاد v3، رد/تأیید/عدم انتشار و نمایش executing/uncertain آزموده شدند. حالت‌های عملیات در DB مصنوعی ساخته شده‌اند و شاهد هیچ write واقعی نیستند.
- GitHub device challenge/هویت/مخزن خصوصی/صفحه‌بندی/جست‌وجو/شاخه/زیرپوشه/قطع اتصال با پاسخ کنترل‌شده مرورگر بررسی شدند؛ import واقعی UI با حساب خصوصی تأیید نشده است. domain جدا، دریافت و استخراج archive pinned را با transport مصنوعی می‌سنجد.
- مرور دستی CUA روی production ایزوله: انتخاب پوشه با Enter، بررسی خودکار، focus نتیجه، reload و راهنمای اتصال حساب انجام شد. primary folder chooser در 360×844 برابر 396px از ابتدای سند بود؛ baseline 924px. شروع واقعی CLI در همین شبکه کد نداد؛ لغو بدون grant و بدون ازبین‌رفتن پروژه موفق بود. هیچ credential واقعی Liara یا تماس مدل مصرف نشد.
- failure تعامل: radio برنامه لیارا تا پاسخ server ظاهراً انتخاب نمی‌ماند؛ اکنون intent در حال ثبت جدا از دسترسی تأییدشده نگه داشته می‌شود و failure به مقدار قبلی برمی‌گردد. case حفظ و دوباره اجرا شد. failure انتخابگر تست alert از Next announcer با نام دقیق پیام محصول رفع شد؛ assertion معنایی خطای کلید حفظ شد.
- نتیجه project در SQLite و شناسه در URL است؛ browser localStorage خالی ماند. نام provider داخلی و health endpoint از مسیر عادی انتشار حذف شدند. مسیر عادی مشکل سایت و persistence تمرین پس از reload کار بعدی همین مأموریت است.

## UX63/65 — run پایدار و مجوز بررسی سایت، پس از fd5a70e

- lint/typecheck/build موفق؛ suite کامل domain برابر 59 و HTTP برابر 14 pass، بدون fail/skip. همه transportهای حساب/مدل در موارد تازه مصنوعی‌اند؛ هیچ credential یا مدل واقعی استفاده نشد.
- migration 5 append-only: آخرین 20 نتیجه هر actor و نشانی مجاز بررسی ذخیره می‌شوند. sample comparison به همان مشاهده نخست متصل است؛ actor دیگر یا نوع evidence متفاوت پذیرفته نمی‌شود. GET نتیجه بدون فراخوانی provider است.
- مسیر معمول backend: app انتخابی→نشانه/توضیح پاک‌سازی‌شده→خواندن محدود→شواهد ذخیره‌شده→توضیح علت جدا و gated. gate خاموش/دسترسی اشتباه/URL متفاوت/secret در توضیح پیش از transport متوقف شدند. evidence ذخیره‌شده دوباره redaction و به همان app/host/path متصل می‌شود. مدت پاسخ محدود با واحد میلی‌ثانیه از probe می‌آید؛ زمان بارگذاری کامل سایت یا معیار عملکرد عمومی نیست.
- تحلیل قبل از اولین درخواست claim می‌شود. race، تکرار، cancel و recovery pending جلوی مصرف خودکار دوباره را می‌گیرند؛ پاسخ گم‌شده به معنی صفر هزینه نیست. recheck همان برنامه/صفحه است؛ تغییر نشانی پیش از transport رد و موفقیت مقایسه به علت اصلاح نسبت داده نمی‌شود.
- UI هنوز به endpoint جدید منتقل نشده؛ آزمون browser این slice تکرار نشد. تطبیق since/logs و حساب واقعی، کیفیت تشخیص و اصلاح واقعی همچنان unconfirmed/blocked_live هستند.

## محیط و شرایط

- تاریخ: 2026-10-21؛ Windows PowerShell؛ Node 24.18.0، npm 11.16.0.
- نسخه دقیق وابستگی‌ها: `package-lock.json`؛ Next 16.4.2، React 19.3.1، TypeScript 6.0.3، Biome 2.6.2.
- هیچ credential، مدل یا درخواست احرازشده Liara استفاده نشد.
- HTTP smoke فقط loopback را می‌پذیرد و server در حال اجرا لازم دارد.

## نتایج

| بررسی | دستور/شرط | نتیجه |
| --- | --- | --- |
| نصب از lockfile | `npm ci` | موفق؛ نصب تمیز وابستگی‌ها از lockfile |
| Lint | `npm run lint` | موفق؛ exit 0 |
| Type check | `npm run typecheck` | موفق؛ exit 0 |
| Production build | `npm run build` | موفق؛ exit 0 |
| Production HTTP smoke | `npm start -- --port 3147` و `TEST_BASE_URL=http://127.0.0.1:3147` سپس `npm test` | 2 passed، 0 failed، 0 skipped؛ پاسخ entry/health و no-store/نبود x-powered-by |
| Development HTTP smoke | `npm run dev -- --port 3148` و `TEST_BASE_URL=http://127.0.0.1:3148` سپس `npm run check` | lint/typecheck موفق؛ همان 2 smoke passed، 0 failed/skipped؛ 2 مورد مجزا هستند، نه 4 تست محصول |
| ثبات دستورالعمل محلی | اجرای dev با `agentRules: false` | فایل AGENTS تحت مدیریت پروژه ماند؛ تولید خودکار framework غیرفعال است |
| لینک‌های مستندات | بررسی 9 Markdown فنی با خواندن مسیر نسبی | 0 لینک شکسته یا وابسته به یادداشت محلی خصوصی |
| Dependency audit | `npm audit --json` | 0 advisory در prod/dev؛ کنترل وابستگی‌ها، نه اثبات امنیت محصول |
| SQLite runtime probe | import ماژول `node:sqlite` و query در حافظه | نسخه SQLite 3.53.1؛ فقط سازگاری این runtime، نه تست storage آینده |

## بازبینی اسناد

یک reader مستقل، اسناد فنی را بدون اتکا به یادداشت‌های خصوصی و سپس handoff محلی را خواند. ابهام ترتیب recovery پس از write، وابستگی UI به گیت نهایی و جداسازی spike لیارا/مدل اصلاح و دوباره بررسی شدند. این بررسی فقط وضوح و سازگاری مدارک را می‌سنجد؛ هیچ آزمون runtime جدید از آن نتیجه نمی‌شود.

## مرزهای تأییدنشده

- صحت قرارداد با حساب واقعی، team/app، timestamp/unit و خطاهای provider؛
- tool calling و کیفیت مدل، هزینه و quota؛
- upload/release/readiness و درخواست workload روی Liara؛
- رعایت approval/auth/Origin/CSRF و persistence در runtime محصول آینده؛
- تشخیص معنایی خطا، اثر اصلاح، عملکرد و تجربه کاربر؛
- ظاهر نهایی، responsive و accessibility محصول.

هنگام پیاده‌سازی هر قابلیت، revision/config، داده ورودی، expected/actual، فرمان و نتیجه، real/simulated و محدودیت باقی‌مانده را ثبت کنید. نتایج bootstrap را به readiness محصول تعمیم ندهید.

## P1 — میز کار محلی و مرزهای اجرا، ۲۰۲۶-۱۰-۲۱

پایه‌های موضوعی: `917819a` (session/approval) و `de06ac7` (source/provider contracts)، به‌همراه UI و اسناد همین commit. Node 24.18.0، Windows؛ Next 16.4.2 و package-lock همین candidate. هر دو gate زنده false. HTTP/مرورگر با scope و login موقت، provider key خالی و DB/workspace موقت اجرا شدند. هیچ درخواست مدل یا Liara در این مجموعه نیست.

| بررسی | فرمان و شرط | نتیجه و مرز شاهد |
| --- | --- | --- |
| Lint | `npm run lint` | pass؛ بدون explicit any یا خاموش‌کردن آن rule |
| Type/build | `npm run typecheck`، `npm run build` | pass؛ همه routeهای موجود ساخته شدند؛ بدون نیاز به API key |
| Domain | `npm run test:domain` | 20 passed، 0 failed/skipped؛ policy/session، race دو connection، crash/lost response، migration/storage failure، source safety، budget، protocol و workload oracle |
| HTTP تولیدی ایزوله | `npm run test:http` پس از build | 6 subtest + 1 parent passed، 0 fail/skip؛ auth/Host/Origin/CSRF، app mismatch، source change، decision/replay، mutation gate و logout |
| Browser تولیدی ایزوله | `npm run test:browser` | 11 حالت؛ 320/360/390/414/768/1280 و text 200٪؛ overflow صفحه 0، browser error 0، external request 0 و axe violation 0 در حالت‌های سنجیده‌شده |
| Bootstrap | server تولیدی loopback با `npm start`، سپس `npm test` | 2 passed، 0 fail/skip؛ liveness و entry، نه شاهد deploy |
| Local setup | `npm run setup:local` | config موجود حفظ شد؛ کلید محلی جدا تولید و فقط در فایل ignored نوشته شد؛ مقدار در stdout نیامد |
| Build traces | parse ده فایل `.nft.json` و بررسی private path | 0 reference به `.local/.data/.artifacts/.env*` در traceهای سنجیده‌شده |

آخرین artifact رابط در زمان این ثبت: `.artifacts/p1/2026-10-21T16-12-24-811Z/` محلی؛ `results.json`، تصاویر ورود، profile/manifest، تأیید و خطا. نسخه تیره با IRANYekan و بدون وابستگی فونت خارجی اجرا شد. UI شامل اصلاح header/عنوان کوچک‌تر پس از ورود برای دسترسی زودتر به کار اصلی در موبایل است. این artifactها داده حساب واقعی ندارند و وارد Git نمی‌شوند.

معنای oracle محلی: همان `/` و revision نمونه با env غایب 500، env خالی/اصلاح ناموفق 500 و مقدار درست 200 داد؛ `/healthz` در هر سه حالت 200 بود. source sample تحت کنترل پروژه است. نتیجه، سازگاری Liara یا استدلال مدل درباره علت را اثبات نمی‌کند.

### failureهای حفظ‌شده و علت اصلاح

- axe در حالت focus لینک skip، پوشانده‌شدن لوگو را `target-size` گزارش کرد. لینک هنگام focus وارد flow می‌شود تا روی هدف دیگر نیفتد؛ همان حالت دوباره pass شد.
- آزمون Host با `fetch` ابتدا به 200 رسید. probe مستقل نشان داد Node هدر Host داده‌شده را بازنویسی می‌کند. تست به `node:http` تغییر کرد تا Host مخرب واقعاً روی wire ارسال شود؛ 403 از boundary محصول تأیید شد.
- کنترل focus از مسیر pointer/programmatic با `:focus-visible` یکسان نیست؛ regression اکنون Tab واقعی از summary به scroll region را بررسی می‌کند. Next route announcer نیز alert جدا دارد؛ alert خطای برنامه نام accessible مستقل گرفته است.
- build اولیه از مسیر dynamic state هشدار tracing تمام پروژه داد؛ مسیرهای runtime با annotation نسخه نصب‌شده از tracing خارج شدند. build بعدی بدون آن هشدار و traceها بدون private reference بودند.
- parser متن مدل در self-review برای متن چندخطی اصلاح و regression اضافه شد؛ payload بزرگ و پاسخ دیررس پس از cancel به موفقیت تبدیل نمی‌شوند.

### محدودیت‌های جاری

گراف اولیه نسل `2026-10-21T14:08:53Z` در Tier 2 خوانده شد؛ coverage برای مسیرهای اولیه metadata_changed و docs/tests excluded داشت، پس source مستقیم خوانده شد. در بازبینی نهایی transport گراف قطع بود؛ coverage تازه برای فایل‌های اضافه‌شده قابل تأیید نیست و نتیجه نهایی بر exact source/diff و اجرا متکی است.

screen reader واقعی، walkthrough فرد تازه، تمام stateهای provider، زمان/واحد metric واقعی، archive/upload، env secret reference، اجرای چند process، SSRF-safe probe و deployment/diagnosis/correction زنده هنوز تأیید/تکمیل نشده‌اند. هیچ نمره آمادگی یا نتیجه مسابقه از این تست‌ها استخراج نمی‌شود.

## T24 — نخستین smoke واقعی BoxAPI

Runtime پایه `fec8938` با اصلاح transport/config در working tree؛ `gpt-6-luna`، میزبان ثابت BoxAPI، Chat Completions non-streaming، output cap=512 و timeout=30s. هیچ درخواست Liara انجام نشد. داده ارسالی فقط protocol-smoke مصنوعی است و شامل source/log/account واقعی نیست.

- 16:15:49 UTC: یک درخواست، HTTP 400، 5.526s؛ جزئیات در نسخه نخست ثبت نشده بود. consumption و مبلغ unknown.
- 16:17:11 UTC: یک درخواست تشخیصی همان case، HTTP 400، 2.799s؛ سرویس ناسازگاری tools با reasoning پیش‌فرض gpt-6-luna در Chat Completions را اعلام کرد. پاسخ sanitizer شد؛ retry خودکار وجود نداشت.
- اصلاح: `MODEL_REASONING_EFFORT=none` به‌صورت صریح، `PROVIDER_REJECTED` برای 400/422 و regression روی body واقعی transport. endpoint، مدل و oracle تغییر نکردند. Responses به دلیل نبودن در فهرست endpointهای این اعتبار استفاده نشد.
- 16:18:21 UTC: دو درخواست HTTP 200، tool-call واقعی→result همان ID→JSON terminal با app/evidenceId/status/outcome مطابق oracle؛ 616 total tokens گزارش‌شده، 10.505s کل run. preflight cancel هیچ upstream اضافه‌ای نداشت. توقف پردازش/عدم billing پس از in-flight cancel آزموده نشده است.

گزارش‌های sanitize شده در `.artifacts/model/2026-10-21T16-15-49-733Z/`، `2026-10-21T16-17-11-767Z/` و `2026-10-21T16-18-21-569Z/` محلی نگه داشته شدند. در این سه run مجموعاً چهار HTTP attempt وجود داشت؛ usage فقط برای دو درخواست موفق گزارش شد و خطاها رایگان فرض نمی‌شوند. این سه snapshot را یک ارزیابی مدل یا accuracy عمومی نمی‌نامیم.

پس از smoke، مدل‌های مجاز Chat در config/client محدود و CLI به حداکثر دو درخواست کاهش یافت. `npm run smoke:model -- --live` صریحاً opt-in است؛ automatic check آن را اجرا نمی‌کند و gate ذخیره‌شده false می‌ماند. تغییر scope آزمون fixture یا انتخاب مدل/endpoint fallback پنهان وجود ندارد. اعتبارسنجی candidate نهایی در رکورد بعدی جدا ثبت خواهد شد.

### snapshot روی candidate `a697eba`

`a697eba9480d0dd5ac7326280963c50601565ae6`، همان model/protocol/reasoning/output cap و oracle قبلی. `npm run smoke:model -- --live` در 16:25:57 UTC: دو پاسخ 200، همان tool/result/terminal معتبر، 616 total tokens گزارش‌شده و 25.104s زمان کل. preflight cancel صفر درخواست اضافه داشت؛ in-flight provider cancellation و مبلغ کسرشده همچنان unverified هستند. گزارش محلی `.artifacts/model/2026-10-21T16-25-57-204Z/report.json`.

در مجموع snapshotهای ثبت‌شده T24 شش HTTP attempt بوده است: دو خطای 400 و چهار پاسخ موفق. usage دو run موفق هرکدام 616 است؛ usage/هزینه خطاها unknown می‌ماند. runهای جدا به accuracy یا latency میانگین عمومی تبدیل نمی‌شوند. روی همین candidate، lint/type/build، 20 domain، 7 HTTP (با parent)، 2 bootstrap و 11 حالت مرورگر pass بودند. artifact مرورگر `.artifacts/p1/2026-10-21T16-25-59-179Z/` است. export فقط از Git در پوشه موقت، setup محلی و `npm run build` بدون provider key هم اجرا و exit 0 مشاهده شد؛ این شاهد به revision قبل از archive مربوط است.

## P1 — archive واقعی محلی و approval v2

پایه `a697eba` + working tree همین برش؛ Node 24.18.0، npm 11.16.0، tar-stream 3.2.2 از lockfile. AC02/04/13/14/16؛ Skills مؤثر: competition-agent-engineer، ux-ui-agent-skills (قواعد accessibility/RTL) و webapp-testing. هیچ درخواست تازه مدل یا Liara در این برش وجود ندارد؛ تمام adapterهای اجرای تست مصنوعی و scopeها موقت‌اند. بسته واقعاً ساخته و خوانده می‌شود، اما upload/deploy لیارا انجام نشده است.

| بررسی | فرمان/شرط | نتیجه و مرز |
| --- | --- | --- |
| Lint/type/build | `npm run lint`، `npm run typecheck`، `npm run build` | pass؛ route archive تولید شد؛ explicit any یا bypass تازه وجود ندارد |
| Domain | `npm run test:domain` | 26 pass، 0 fail/skip؛ 6 case جدید archive علاوه بر 20 case موجود |
| HTTP ایزوله | `npm run test:http` | 7 subtest + 1 parent pass، 0 fail/skip؛ archive auth/CSRF، hash جعلی، source تغییرکرده، receipt mismatch و approval v2 |
| Browser ایزوله | `npm run test:browser` | 23 حالت در 280/320/360/390/414/768/1280 و متن 200٪؛ overflow صفحه 0، browser error 0، external request 0 و axe violation 0 در حالت‌های سنجیده‌شده |
| Bootstrap تولیدی | `npm start` روی loopback، سپس `npm test` | 2 pass، 0 fail/skip؛ شاهد entry/liveness و نه سرویس بیرونی |
| Decoder مستقل | `node .local/verify-source-archive.mjs .artifacts/source/2026-10-21T16-56-10-465Z/source.tar.gz`؛ ابزار موقت محلی، وارد Git نمی‌شود | Python tarfile: هر 4 entry و بایت/hash دقیقاً با manifest برابر؛ Unicode و مسیر بلند؛ bsdtar: بایت فایل‌های ASCII برابر؛ بدون شبکه |

artifact مرورگر نهایی `.artifacts/p1/2026-10-21T17-01-48-065Z/` و decoder `.artifacts/source/2026-10-21T16-57-23-878Z/report.json` هستند. IRANYekan واقعاً با FontFace loaded بررسی شده است. فوکوس پس از بسته‌سازی به heading نتیجه و پس از لغو هر read به دکمه شروع همان مرحله برمی‌گردد؛ keyboard assertion هر سه مسیر pass شد. بدون app لیارا، بسته آماده می‌شود اما ساخت پیشنهاد غیرفعال می‌ماند.

معیار archive: regular fileهای داخل tar دقیقاً همان path/byte/hash manifest، بدون env/dependency؛ metadata ثابت، تغییر صرف timestamp بدون تغییر archive hash، receipt actor-bound پس از reopen و blob بدون receipt فاقد مجوز. فایل حذف‌شده/هم‌اندازه ولی خراب، تغییر archive hash، پوشه junction و سقف نگهداری پیش از attempt/provider رد شدند. ویرایش workspace پس از approval، snapshot تأییدشده را تغییر نداد؛ adapter مصنوعی همان buffer را گرفت و receipt تنها به observing رسید. history v1 با hash قبلی پس از migration 2 خوانده شد؛ deploy v1 صفر provider call داشت.

### failureهای این برش و شواهد اصلاح

- در سنجش loading، تأخیر ثابت 500ms پاسخ fixture گاهی پیش از کلیک لغو تمام می‌شد. همان oracle حفظ شد و transport تست تا تصمیم لغو نگه داشته شد؛ state و بازگشت فوکوس دوباره pass شدند.
- bsdtar ویندوز نام فارسی را در stdout به `?` نمایش داد؛ hash/بایت archive تغییر نکرد. همان فایل اولیه با Python tarfile مستقل خوانده و تمام نام‌ها/بایت‌ها/hashها درست بودند. `originalFailedArchiveUnchanged=true` و `windowsTarDisplayLoss=true` در report محفوظ‌اند؛ نمایش Unicode ابزار ویندوز تأییدشده نامیده نمی‌شود.
- بازبینی UI، حذف‌شدن دکمه متمرکز پس از نتیجه را یافت. heading نتیجه و بازگشت فوکوس پس از cancel اضافه و با DOM واقعی بررسی شدند؛ صرف live message جای حفظ focus نیست.

گراف دوباره در دسترس بود اما coverage همان generation قدیمی، فایل‌های تازه not_tracked و docs excluded را نشان داد؛ تلاش پوشش تکمیلی به Transport closed رسید. exact source/import/diff و اجرای مستقیم مبنای نتیجه‌اند. NTFS/hard-link در این میزبان سنجیده شد؛ filesystem دیگر، چند process، screen reader انسانی و walkthrough تازه هنوز unconfirmed هستند. نگهداری archive سقف دارد ولی پاک‌سازی خودکار ندارد. env secret-reference، provider write adapter، probe امن، تشخیص و اصلاح زنده باقی‌اند؛ کار بعد مستقل قرارداد evidence و failures است.

### بازتولید از Git روی `7ba2a2a`

Candidate اجرایی: `7ba2a2a5c0b9b0cec1d51e6303a2dd58777894b3`. با `git archive` فقط فایل‌های tracked به پوشه موقت تازه منتقل شدند؛ env، DB، source archive و اسناد خصوصی workspace وارد export نشدند. روی همان Node/npm و Chromium نصب‌شده این میزبان، `npm ci` → `npm run setup:local` → `npm run build` → `npm run test:domain` → `npm run test:http` → `npm run test:browser` همگی exit 0 دادند. کلیدهای provider خالی و هر دو gate false تأیید شدند؛ setup فقط credential محلی همان export را ایجاد کرد.

در این اجرای مستقل: domain برابر 26 pass، HTTP برابر 7 subtest + 1 parent pass و مرورگر برابر 23 حالت/7 عرض، با 0 fail/skip، browser error، external request و axe violation در دامنه سنجیده‌شده. این اعداد اجرای تازه‌اند و از جمع runها ساخته نشده‌اند. streaming enumeration نیز پیش از materialize شدن پوشه، سقف entry را enforce می‌کند؛ capture فقط بایت واقعی را نگه می‌دارد، نه buffer موقت کامل هر فایل.

گزارش قدم‌ها، logها و تصاویر کپی‌شده در `.artifacts/repro/7ba2a2a5c0b9b0cec1d51e6303a2dd58777894b3/` محلی‌اند. حذف دو checkout موقت توسط policy محیط با `blocked by policy` رد شد؛ نگه داشته شدند و روش جایگزین حذف اجرا نشد. فایل خصوصی آن‌ها وارد Git نمی‌شود. بررسی 9 سند فنی/20 لینک نسبی: 0 لینک شکسته یا وابسته به فایل private. parse تعداد 11 build trace: 0 reference به `.local/.data/.artifacts/.env*`. پیش از commit source، 30 فایل staged و 11 فایل client بررسی شدند: 0 مسیر خصوصی و 0 تطابق با secretهای env تنظیم‌شده. این بررسی جای security audit جامع یا کشف همه انواع secret را نمی‌گیرد.

## T11/T30 — قرارداد خواندن و probe مستقل از حساب

پایه `7db15be` + working tree همین برش؛ Node 24.18.0/npm 11.16.0؛ AC01/08/13. Skill مؤثر competition-agent-engineer (runtime/evaluation). generation قبلی گراف این مسیرها را پوشش نمی‌داد؛ index_status و check_index_coverage فعلی هر دو Transport closed دادند. source دقیق، importها، OpenAPI pinned و مسیر logs در CLI رسمی مبنای بررسی‌اند؛ گراف شاهد کامل بودن نیست.

project/release/logs/events/applets/summary، scope و teamID مشترک، خطای typed، حذف env values و DNS-pinned HTTPS probe پیاده شدند. gate مستقل Liara پیش از budget/transport/DNS کنترل می‌شود. فقط ISO با timezone صریح به زمان قابل مقایسه تبدیل می‌شود؛ tuple عددی و unit متریک unknown می‌مانند. logs v1 با v2 در CLI اختلاف مستند دارد؛ تبدیل حدسی یا fallback انجام نمی‌شود.

`npm run lint`، `npm run typecheck`، `npm run build`: pass. `npm run test:domain`: 36 pass/0 fail/skip؛ `npm run test:http`: 7 subtest + 1 parent pass/0 fail/skip. ده case جدید، gate صفر upstream، env value exclusion، app mismatch، redaction، زمان نامعلوم، v1/v2 shape، 401/429/503، cancellation دیررس، IPهای خاص/خصوصی v4/v6، mixed DNS، pin، redirect بدون follow و حد اندازه را پوشش می‌دهند. transport/DNS/socket آزمون‌ها مصنوعی هستند؛ هیچ درخواست Liara یا مدل و هزینه تازه وجود ندارد. TLS واقعی، host workload و semantics حساب به T20 وابسته‌اند.

دو failure توسعه رفع شدند: parameter property با strip-only runner سازگار نبود و به field صریح تغییر کرد؛ گزینه autoSelectFamily در نوع RequestOptions نسخه نصب‌شده نبود و family مشخص IP پین‌شده استفاده شد. lint نیز control regex و assignment در expression را رد کرد؛ filter کد نویسه و شمارش صریح جایگزین شدند. oracleها ضعیف نشدند. نصب محلی dependencies ناقص و swc قفل بود؛ فقط فرایند Next همین مسیر متوقف و `npm ci` از lockfile بازسازی شد؛ سپس همه فرمان‌های بالا تازه اجرا شدند. evidence collector و UI تشخیص مرحله بعدند؛ write/diagnosis زنده تأیید نشده‌اند.

## T14/T30/T31 و بخش مقایسه T32 — مسیر اختلال آفلاین

پایه `7af1b76` + working tree همین برش؛ AC08/09/11/13/14. Skills مؤثر competition-agent-engineer و ux-ui-agent-skills (component، accessibility و disclosure)، همراه قواعد React/Next موجود. ابزار coverage گراف Transport closed داد؛ source/call flow/test مستقیم مبنای نتیجه است. هیچ درخواست تازه Liara/BoxAPI وجود ندارد.

collector هفت read محدود را با یک deadline جمع می‌کند؛ failure هر منبع، empty و unknown مستقل‌اند. زمان log قدیمی حفظ می‌شود؛ شناسه release بدون تبدیل به سلامت workload می‌آید. diagnosis یک snapshot ثابت همان app را با tool call/result می‌خواند؛ terminal بدون شواهد، app دیگر، ابزار تکراری، reference ساختگی، log خارج بازه، metric unknown برای فرضیه مشخص، بودجه/لغو و field مجوز ناشناخته رد می‌شوند. validation ارجاع و JSON اثبات صحت علت یا کیفیت مدل نیست؛ این بخش با BoxApiClient و transport مصنوعی سنجیده شد.

`verifySameSymptom` به mode/team/app/origin/path و مشاهده تازه حساس است؛ healthz، app دیگر یا پاسخ قدیمی به موفقیت تبدیل نمی‌شوند. این helper فقط symptom را مقایسه می‌کند و action/release/env effect را موفق نمی‌کند. مسیر تمرینی سه سناریوی scripted دارد و صریحاً صفر provider request/تغییر زیرساخت گزارش می‌کند؛ fallback خطای provider نیست. snapshot/diagnosis تمرین ماندگار نیست.

`npm run lint`، `npm run typecheck`، `npm run build`: pass؛ `npm run test:domain`: 42 pass/0 fail/skip؛ `npm run test:http`: 8 subtest + 1 parent pass/0 fail/skip. `npm run test:browser`: 50 حالت در 280/320/360/390/414/768/1280 و متن 200٪، 0 overflow صفحه/axe violation/browser error/external request در حالت‌های سنجیده‌شده؛ artifact `.artifacts/p1/2026-10-21T18-00-54-064Z/`.

failure اولیه browser، focus لغو روی دکمه‌ای را یافت که هنوز disabled بود؛ بازگشت فوکوس پس از commit state انجام و همان case pass شد. screenshot اولیه صفحه بلند، تصمیم سه نمای جدا و انتخاب سناریوی جمع‌شونده را ایجاد کرد؛ تصویر اولیه در `.artifacts/p1/2026-10-21T17-56-54-194Z/` محفوظ است. تصاویر موبایل/دسکتاپ نتیجه تازه مستقیماً دیده شدند؛ بازبینی انسانی تازه و screen reader واقعی unconfirmed هستند. persistence incident، env secret-reference/write، deploy adapter و تشخیص/اصلاح واقعی باقی‌اند.

بازاجرای نهایی همین برش پس از اصلاح stretch ستون راهنما و افزودن بررسی لینک شاهد: build pass و browser برابر 51 حالت/7 عرض، همه شاخص‌های فوق 0؛ artifact `.artifacts/p1/2026-10-21T18-04-28-633Z/`. لینک از فرضیه به نمای شواهد می‌رود و همان entry فوکوس می‌گیرد؛ case لغو اولیه نیز دوباره pass شد. این snapshot جایگزین عدد run قبلی نمی‌شود و روی candidate بعدی باید جدا سنجیده شود.

## UX60 — معرفی واقعی پروژه محلی و خطای قابل بازیابی

پایه `d5c57a2` + working tree همین برش؛ AC02/13/14 و UX60. Skills مؤثر ux-ui-agent-skills، frontend-design، web-design-guidelines و vercel-react-best-practices؛ source و تست مستقیم برای پوشش گراف not_tracked روی generation 14:08:53Z. مسیر کنترل→API session/Origin/CSRF→canonical folder→listing/inspection→typed result بررسی شد.

با CUA و مرورگر واقعی روی سرور production ایزوله/حساب مصنوعی بازتولید شد: پوشه ناموجود خطای عمومی می‌داد، نتیجه پس از reload از بین می‌رفت و دکمه موبایل 924px پایین سند بود. پس از تغییر، dialog با Enter باز شد، examples/node-service از فهرست واقعی انتخاب و بررسی شد، Escape در تغییر انتخاب profile قبلی را نگه داشت و focus به کنترل بازگشت. محل کنترل انتخاب 618px در همان 360×844 بود. این کاهش فقط این برش را توصیف می‌کند؛ بهبود کلی تجربه هنوز تکمیل نشده است.

`npm run lint`، `npm run typecheck`، `npm run build` pass؛ `npm run test:domain`: 44 pass/0 fail/skip؛ `npm run test:http`: 9 subtest + 1 parent pass/0 fail/skip. پوشه خالی، pagination، root مجاز، symlink/junction، traversal، حذف پوشه، cancellation و نگاشت ENOENT/EACCES/EPERM سنجیده شدند؛ permission denial بخشی synthetic و آزمون ACL واقعی Windows انجام نشده است. مرورگر قبل از اصلاح نهایی خطای inline، 52 حالت/7 عرض را گذراند؛ run `.artifacts/p1/2026-10-21T18-20-17-519Z/`. مسیر نمونه اختیاری است و تغییر ناموفق/لغوشده انتخاب معتبر را پاک نمی‌کند. اتصال‌ها و persistence هنوز در همین برش پیاده نشده‌اند؛ هیچ درخواست مدل یا Liara وجود ندارد.

در run بعدی، locator بدون نام، announcer داخلی Next را پیش از پاسخ انتخاب کرد؛ locator به alert دارای پیام محصول محدود و برای خطای فیلد نام دسترس‌پذیر اضافه شد. همان focus assertion حفظ شد؛ تصویر شکست در `.artifacts/p1/2026-10-21T18-25-48-869Z/` باقی است. نتیجه بازاجرای نهایی پس از پایان آن در همین سند ثبت می‌شود.

بازاجرای نهایی UX60: build pass؛ `test:browser` با 52 حالت/7 عرض و 0 overflow/axe violation/browser error/external request موفق شد؛ `.artifacts/p1/2026-10-21T18-30-29-162Z/`. انتخاب واقعی پوشه با keyboard و لغو حفظ‌شونده به آزمون‌ها اضافه شد. 44 domain و 10 HTTP در build این سری pass هستند؛ پرونده تشخیص source و approval قبلی دست‌نخورده مانده‌اند. این برش تنها UX60 و بخشی از دسترسی موبایل را می‌بندد؛ UX61–66 همچنان کار فعال‌اند.

## UX61/62 — زیرساخت نگهداری اتصال و spike روش ورود

پایه `9437a05` + working tree این برش؛ AC01/13/16. اتصال محصول هنوز تکمیل نشده است. migration 3 append-only، metadata عمومی actor-bound و credential رمز‌شده با AES-256-GCM ساخته شدند. domain، actor/provider دیگر، key متفاوت، tamper، nonce تازه، حذف اتصال محلی و رد ذخیره plaintext را بررسی می‌کند؛ هیچ credential واقعی مصرف نشده است. `lint/typecheck/build` pass؛ `test:domain` برابر 46 pass/0 fail/skip و `test:http` برابر 10 pass/0 fail/skip. آزمون ارتقای DB قدیمی با شمار migrationهای جاری و hash بدون تغییر approval v1 دوباره pass شد. browser این برش تغییری نکرد.

CLI رسمی GitHub 2.103.0 از release رسمی دریافت شد؛ digest archive برابر `80c846a5b8432672ca6373b34ce9de998c9686aaa1885c845f2e1ee81f713726` با API رسمی برابر و `gh --version` موفق بود. فایل فقط ابزار محلی ignored است. pending login آزمایشی با config خالی و بدون grant پس از 20s قطع شد؛ code/نشانی ورود در این بازه دریافت نشد. credential/account grant انجام نشد؛ ورود واقعی همچنان unverified است. source رسمی نشان داد در non-interactive نشانی ورود چاپ می‌شود و مرورگر native باز نمی‌شود؛ timeout به fake connection تبدیل نخواهد شد.

متد browser از Liara CLI نصب‌شده 9.4.7 با module hook فقط برای open/HTTP/get-port/notify در spike خصوصی اجرا شد: no loopback host، پذیرش callback بدون state با Origin متفاوت، body=131160B و status=200؛ socket و مرورگر واقعی 0. این آزمون synthetic رفتار همان callback است و login حساب را تأیید نمی‌کند. تصمیم رد استفاده مستقیم و انتخاب راهنمای کلید+اعتبارسنجی در ADR اتصال ثبت شد. حساب/تیم/app واقعی و هیچ عملیات زیرساخت یا مدل تازه‌ای آزمایش نشده‌اند. مرحله بعد adapter ورود و انتخاب repository/برنامه با API واقعی در حد مجاز، fixture failures و UI قابل اقدام است.
# Worker replacement normalization — 2026-10-22

The next real preparation attempt stopped with `REPAIR_NO_CHANGE`: at least one returned replacement was byte-identical to its base, and the per-file guard rejected the entire response before writes. That response was not recorded as a successful preparation. The patch contract now asks for changed files and normalizes unchanged allowed snapshots after checking scope, uniqueness, base hash and secrets. An entirely unchanged response still fails; tests, command and artifact checks are unchanged. A regression covers a real change mixed with an unchanged allowed file, entirely unchanged responses, out-of-scope unchanged files, wrong base hashes and duplicates. Domain225/225 and lint passed; a frozen export passed typecheck and production build. New real-model acceptance remains pending the repeated browser cycle.

## ریتم کنترل‌ها و اصلاح فاصله‌گذاری UI — 2026-10-22

این برش فقط CSS، توکن‌ها و markup کارت مقصد را تغییر داد؛ سرویس approval، archive، journal، مسیر provider و رفتار live دست‌نخورده‌اند. فیلد متنی سطح `--color-field`، حاشیه کنترل و radius مشترک گرفت؛ فوکوس به حاشیه primary و حلقه ۲px بدون layout shift تبدیل شد و حالت invalid همان حلقه را با danger نشان می‌دهد. label/hint/اقدام‌ها ریتم ۴/۸/۱۶px دارند، دکمه‌ها ارتفاع ۴۴px و سه سطح primary/secondary/quiet، ردیف جست‌وجو گرید input/button، facts به tile و جزئیات فنی به ردیف‌های فشرده با code chip تبدیل شدند. کارت مقصد بلوک نام تیم/برنامه و اقدام تمام‌عرض دارد.

`npm run lint` بدون خطا (۲۷ warning موجود CSS) و `npm run typecheck` pass؛ build تولیدی در همین run موفق بود. `npm run test:browser` روی build نهایی شش suite را pass کرد: 75/27/27/22/23/5 حالت، با 0 overflow صفحه، 0 نقض axe، 0 browser error و 0 external request در حالت‌های سنجیده‌شده. artifactها `.artifacts/ux/2026-10-22T12-12-24-739Z/`، `.artifacts/deployment-ui/2026-10-22T12-13-24.519Z/`، `.artifacts/restart-ui/2026-10-22T12-13-53.314Z/`، `.artifacts/domain-ui/2026-10-22T12-14-18.536Z/`، `.artifacts/agent-ui/2026-10-22T12-14-45.689Z/` و `.artifacts/destination-ui/2026-10-22T12-15-17.874Z/` هستند؛ زمان پوشه‌ها UTC است.

تصاویر 360/1280 ورود، فوکوس فیلد، مقصد و جزئیات فنی بازبینی شدند؛ عنوان‌های LTR مستقل، متن ۲۰۰٪ و عرض‌های 280–1280 بدون overflow افقی ماندند. این شاهد، بازبینی کاربر تازه و screen reader واقعی نیست؛ اندازه‌گیری کیفیت بصری و پذیرش عمومی همچنان انجام نشده است. هیچ حساب، مدل یا سرویس واقعی در این مجموعه مصرف نشد.
