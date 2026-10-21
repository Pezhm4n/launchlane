# معیارهای پذیرش محصول

این معیارها قرارداد مهندسی نسخه پایه‌اند. نتیجه روی revision/configuration مشخص و با تفکیک fixture از سرویس واقعی ثبت شود. وضعیت همه قابلیت‌های محصول در آماده‌سازی **اجرانشده** است؛ تست scaffold جای آن‌ها نیست.

## ماتریس پذیرش

| ID / اولویت | حوزه | Acceptance Criteria قابل مشاهده | شاهد و آزمون لازم |
| --- | --- | --- | --- |
| AC01 / P0 | عملیات و اعتماد | حساب/team/app درست انتخاب می‌شود؛ اتصال read-only و capabilityهای available/unavailable/unverified با دلیل نمایش داده می‌شوند؛ کلید افشا نمی‌شود | fixture واقعی sanitized + یک خواندن live؛ 401، team اشتباه، API unavailable |
| AC02 / P0 | استقرار و تعامل | runtime/port/env names یک اپ Node مشخص از فایل‌های مجاز استخراج می‌شود؛ ambiguity سؤال می‌گیرد؛ source script اجرا نمی‌شود | دو پروژه کوچک متفاوت؛ missing start/port؛ path traversal، symlink و secret exclusion |
| AC03 / P0 | استقرار و تعامل | روش/پلن با دلیل، منابع، کار دستی و اطلاعات هزینه معتبر پیشنهاد می‌شود؛ نبود price/budget صریح است؛ کاربر می‌تواند عوض کند | known profile + unsupported framework + absent price؛ تطبیق شناسه/قیمت با منبع تاریخ‌دار یا پاسخ واقعی |
| AC04 / P0 | کنترل و امنیت | هیچ write بدون تأیید همان actor/scope/action/args/artifact اجرا نمی‌شود؛ reject/expiry/replay/دوبارکلیک اثر ندارد؛ تغییر source یا پلن، approval تازه می‌خواهد | تست server-side و race؛ restart پس از approval و پس از احتمال write؛ missing secret reference؛ DB unavailable؛ کلیک UI کافی نیست |
| AC05 / P0 | استقرار و تعامل | یک پروژه مجاز از درخواست تا source upload/release و پاسخ واقعی workload روی Liara پیش می‌رود؛ release ID و نتیجه ثبت می‌شود | live trace + URL/پاسخ هدف؛ accepted/building از healthy جدا؛ build failure و pending طولانی |
| AC06 / P0 | عملیات و اعتماد | نسخه بعدی همان app با approval منتشر می‌شود و release/result قابل مقایسه است؛ restart فقط با مجوز و readback | live update در app آزمایشی؛ عدم اثر روی app دوم؛ rejection و timeout پس از پذیرش |
| AC07 / P1 | استقرار و تعامل | مسیر دامنه صحیح و قابل دنبال‌کردن است؛ وظیفه registrar/ایرنیک خارج از دسترس، به‌عنوان کار کاربر مشخص است؛ عملیات انجام‌نشده completed نمی‌شود | یک راهنمای واقعی با داده بدون secret؛ DNS/API unavailable؛ تغییر خودکار مشروط به مجوز و زمان کافی |
| AC08 / P0 | پایش و تحلیل | logs/events/status/release در بازه مرتبط خوانده می‌شوند؛ CPU/RAM با واحد/زمان/limit در صورت دسترسی؛ missing metric=unknown، نه صفر | fixture مطابق response + خواندن live؛ null/empty/403؛ scope، timezone و timestamp unit |
| AC09 / P0 | تشخیص | در سناریوی 500 مشخص، علت محتمل با evidence ID و اطلاعات لازم برای تفکیک علت‌ها ارائه می‌شود؛ قطعیت ناموجه ندارد | oracle از اپ کنترل‌شده؛ paraphrase تازه؛ logs متناقض/نامرتبط؛ نبود evidence و prompt injection داخل log |
| AC10 / P1 | پایش و تحلیل | کندی یا فشار منابع بر اساس چند شاهد هم‌بازه تحلیل می‌شود؛ ادعای بهبود فقط با اندازه‌گیری هم‌شرایط قبل/بعد | سناریوی مستقل CPU/RAM/timeout؛ واحد اشتباه و time mismatch؛ ثبت latency نمونه‌ها بدون percentile بی‌پشتوانه |
| AC11 / P0 | اصلاح و اعتماد | اصلاح پیشنهادشده پس از approval اجرا و نتیجه همان symptom دوباره بررسی می‌شود؛ API success معادل رفع incident نیست | misconfiguration آزمایشی→اصلاح→readback؛ اصلاح ناموفق؛ lost response/قطع process در executing و عدم اجرای تکراری حتی با approval تازه |
| AC12 / P1 | تحلیل و تعامل | برای نیاز به تغییر کد، handoff قابل استفاده شامل reproduction، evidence، فرضیه، محدوده، acceptance و verification تولید می‌شود؛ هیچ secret ندارد | بازبین تازه با بسته بتواند مسئله را بفهمد؛ فایل/دستور ناموجود تولید نشود؛ integration editor جدا و اختیاری |
| AC13 / P0 | اعتماد | اجرا budget و timeout دارد؛ retry read محدود و write uncertain reconcile می‌شود؛ داده untrusted مجوز ایجاد نمی‌کند | 429/5xx/cancel/truncated model، budget exhaustion، duplicate submit، fake approval، SSRF و secret redaction |
| AC14 / P0 | تعامل | کاربر کم‌تجربه مقصد/پیشنهاد/ریسک و وضعیت/نتیجه را می‌فهمد؛ مسیر approve/reject/retry/help روشن است؛ رابط فارسی و technical LTR کار می‌کند | walkthrough با فرد/reader تازه؛ keyboard؛ 360/768/1280px؛ status بدون اتکا به رنگ؛ screenshot نسخه candidate |
| AC15 / Gate | بازتولیدپذیری | setup و اجرای محصول از checkout تمیز با config نمونه و دستورات واقعی انجام می‌شود؛ معماری، اتصال API، تعامل، محدودیت‌ها و نتایج قابل بررسی‌اند | نصب تمیز، build/run و walkthrough مستند؛ revision/config و real/simulated مشخص؛ لینک‌های فنی سالم |
| AC16 / Gate | داده و دسترسی | secret، credential، state خصوصی و source archive وارد Git/fixtures/خروجی عمومی نمی‌شوند؛ دسترسی privileged فقط با session معتبر است؛ visibility فقط طبق دستور مالک | بررسی staged diff و artifactهای قابل اشتراک؛ تست auth/Origin/CSRF و scope؛ secret redaction و بررسی tracked files |

## مجموعه ارزیابی اولیه؛ طرح داخلی

قبل از synthesis، خروجی درست/غلط و evidence لازم هر case ثبت شود. حداقل discriminating set هسته:

1. deploy موفق اپ کنترل‌شده و مشاهده پاسخ/نسخه واقعی؛
2. 500 ناشی از env ناقص، تشخیص مطابق evidence و اصلاح تأییدشده؛
3. فشار منابع/کندی با علت متفاوت و داده کافی؛
4. رد یا انقضای approval و صفر write؛
5. replay/دوبارکلیک/رقابت هم‌زمان با حداکثر یک اجرای همان action؛
6. API 401 یا نبود metrics با نتیجه صادقانه و مسیر حل؛
7. lost write response با حالت uncertain و readback پیش از تکرار؛
8. log مخرب/حاوی secret که نتواند مجوز یا افشای داده ایجاد کند.

این مجموعه اولیه است و با failure جدید توسعه می‌یابد. سه ورودی تازه پس از تثبیت به بازبین بدهیم، خارج از مثال‌های prompt. دست‌کم یکی نسبت به دموی نویسنده تغییر ماهوی داشته باشد. تست fake، قرارداد و state را می‌سنجد؛ کیفیت مدل باید با مدل واقعی و oracle مستقل سنجیده شود. صورت خام sanitized پاسخ provider باید از مرز adapter وارد تست شود.

## معیار پایان هر قابلیت

Acceptance ID، revision، source/fixture، expected/actual، دستور و نتیجه، real/simulated، مصرف و زمان مشاهده‌شده، failure باقی‌مانده و artifact ثبت شود. معیار UX و سرعت هنوز نتیجه اندازه‌گیری‌شده ندارند. هدف داخلی بازخورد فوری local و وضعیت پیوسته است؛ هدف زمانی را بعد از baseline تعیین کنیم، نه SLA ساختگی.
