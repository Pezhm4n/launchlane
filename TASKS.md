# برنامه اجرایی Launchlane

آخرین وضعیت: ۲۰۲۶-۱۰-۲۱، Asia/Tehran. این فایل باید پس از هر مرحله به‌روزرسانی شود. وضعیت `done` فقط با شواهد پذیرش معتبر است. برنامه کار Coding Agent است؛ آماده‌سازی فعلی شامل پیاده‌سازی کل محصول نیست.

## وضعیت فعال

- P0 تمام شد: foundation و اسناد فنی اعتبارسنجی شده‌اند؛ شواهد در `docs/verification.md`.
- فاز بعد P1، آماده برای Coding Agent و هنوز آغازنشده: قرارداد adapter، flow و policy/state آفلاین؛ سپس P2 با دسترسی مجاز واقعی.
- وضعیت runtime: فقط صفحه ورودی و health؛ مدل، Liara adapter، session، persistence و Agent هنوز ساخته نشده‌اند.
- دسترسی و بودجه مدل/Liara و app/team scope زنده تأیید نشده‌اند. فیک به‌عنوان قابلیت واقعی گزارش نشود.

## P0 — آماده‌سازی

| Task | هدف/محدوده | وابستگی | پذیرش/تست | وضعیت |
| --- | --- | --- | --- | --- |
| T00 | تعریف نیاز، محدوده، flow و پذیرش محصول | تحلیل نیاز کاربر | overview و AC01-16؛ تفکیک موجود/پیشنهادی/نامعلوم | done |
| T01 | foundation کم‌وابستگی و Git | T00 | install/lint/type/build/run/smoke، lockfile و secret exclusion؛ evidence در verification | done |
| T02 | اسناد فنی و برنامه قابل استفاده از checkout مستقل | T00,T01 | هر AC→task؛ لینک‌های فنی سالم؛ بازبین تازه بتواند مسیر بعدی و محدودیت‌ها را تشخیص دهد | done |
| T03 | قرارداد upstream و تصمیم‌های انتقال‌پذیر برای adapter و state | T00 | OpenAPI pinned، endpointها و unknownها ثبت؛ تصمیم/پیامد در ARCHITECTURE؛ بدون ادعای live | done |

## P1 — مسیر مستقل آفلاین، قرارداد و طراحی

| Task | هدف/محدوده | وابستگی | پذیرش/تست | وضعیت |
| --- | --- | --- | --- | --- |
| T10 | تکمیل DESIGN با flow، توکن و component state؛ UI یکپارچه با action/evidence | T02 | AC14؛ walkthrough، keyboard و responsive؛ بدون پالت پراکنده | ready_offline |
| T11 | API adapter interface و schemaهای ورودی/پاسخ از OpenAPI؛ fixture صادقانه | T03 | AC01,08,13؛ teamID، pagination، null، 401/429 و unit/time contracts؛ synthetic بودن صریح | ready_offline |
| T12 | تشخیص read-only یک اپ Node و archive manifest مجاز | T02 | AC02,03؛ runtime/port/env names؛ traversal/symlink/secret و no script execution | ready_offline |
| T13 | operator session، policy، action immutable، approval و state SQLite | T02 | AC04,13,16؛ deny/expiry/replay/race/restart/storage-down؛ CAS پیش از write | ready_offline |
| T14 | تعریف oracle و demo fixture برای deploy و incident؛ توسعه تست domain با ابزار مناسب | T11,T12 | AC05,09,11؛ golden و counterexample؛ commandهای واقعی به AGENTS اضافه شود | ready_offline |

P1 شامل کدنویسی محصول توسط Coding Agent بعدی است. در صورت پایان قراردادهای مستقل، به علت نبود token کل پروژه متوقف نشود؛ اما وضعیت fake به live ارتقا نیابد.

## P2 — اتصال واقعی و اولین چرخه استقرار

| Task | هدف/محدوده | وابستگی | پذیرش/تست | وضعیت |
| --- | --- | --- | --- | --- |
| T20 | capability spike read-only لیارا با credential و scope مجاز | دسترسی Liara،T11 | AC01,08؛ scope/schema/time/unit و خطاهای واقعی؛ evidence sanitized؛ بدون write | blocked_live |
| T24 | smoke مدل/SDK و بودجه مستقل از اتصال Liara | دسترسی و budget مدل،T11 | AC09,13؛ tool protocol/schema، خروجی structured، terminal/error و مصرف واقعی؛ بدون fixture به‌جای live | blocked_live |
| T21 | انتخاب روش/پلن با منبع/قیمت فعلی و تأیید action | T12,T13,T20 | AC03,04؛ unknown price/budget سؤال/راهنمایی؛ تغییر args/source نیازمند consent تازه | not_started |
| T22 | upload source→release→observe→health روی app آزمایشی مجاز | T14,T21 | AC05؛ release واقعی و پاسخ workload؛ build fail/timeout/pending و unsafe path | not_started |
| T23 | انتشار نسخه بعدی و restart کنترل‌شده | T22 | AC06؛ release قبل/بعد، deny و عدم اثر روی app دیگر؛ readback | not_started |
| T25 | راهنمای دامنه و تفکیک API از registrar | T22 | AC07؛ مسیر واقعی با منبع معتبر و کار بیرون دسترسی مشخص؛ بدون ادعای اجرای DNS انجام‌نشده | not_started |

T20 و T24 مستقل‌اند؛ نبود مدل نباید مشاهده/آزمون provider را متوقف کند. T25 توسعه P1 است و شرط پذیرش هسته نیست. اگر endpoint یا schema با سند اختلاف داشت، ابتدا مرز adapter اصلاح و regression با پاسخ واقعی اضافه شود. شکست archive/deploy با افزودن framework/پایگاه‌داده جدید حل نمی‌شود مگر bottleneck اثبات شود.

## P3 — SRE و بستن حلقه اصلاح

| Task | هدف/محدوده | وابستگی | پذیرش/تست | وضعیت |
| --- | --- | --- | --- | --- |
| T30 | خواندن محدود logs/events/release/health/CPU/RAM و evidence panel | T11,T20 | AC08,14؛ app/time/unit، empty/unsupported؛ داده ناکافی به‌عنوان unknown | not_started |
| T31 | diagnosis مبتنی بر evidence و فرضیه رتبه‌دار | T14,T30,T24 | AC09؛ oracle 500، paraphrase، contradictory log، injection و redaction؛ کیفیت با مدل واقعی | not_started |
| T32 | اصلاح دارای approval و verification همان symptom؛ بسته قبل/بعد | T13,T22,T31 | AC11؛ اصلاح واقعی/ناموفق، timeout و replay؛ success فقط با readback | not_started |
| T33 | سناریوی مستقل کندی/منابع و پیشنهاد بهینه‌سازی | T30,T31 | AC10؛ latency و مصرف هم‌شرایط؛ بدون ادعای علت قطعی از یک نمودار | not_started |
| T34 | handoff پاک‌سازی‌شده برای Coding Agent | T31 | AC12؛ reproduction، evidence، محدوده اصلاح و acceptance قابل فهم برای reader تازه؛ بدون فایل/command ساختگی | not_started |

T32 هسته است. T25، T33 و T34 توسعه‌های P1 هستند؛ فقط در صورت اجرا و سنجش، AC07/10/12 را پذیرفته گزارش کنیم. اتصال خودکار editor، auto-PR، rollback عمومی و DNS automation فقط پس از پذیرش هسته و زمان کافی بررسی شوند. handoff قابل کپی کافی است و به اتصال editor نیاز ندارد؛ قابلیت پیاده‌نشده در limitations بماند.

## P4 — بازبینی تازه و ارتقای کیفیت

| Task | هدف/محدوده | وابستگی | پذیرش/تست | وضعیت |
| --- | --- | --- | --- | --- |
| T40 | peer review روی revision قابل اجرا با سه ورودی تازه | T10,T23,T32 | هسته AC01-06/08/09/11/13/14 و هر توسعه اجراشده؛ reader از demo نویسنده تقلید نکند؛ reproduction/شدت/مرز خراب/اصلاح/regression | not_started |
| T41 | رفع شکست‌های اثرگذار، UX و مصرف؛ self-review diff | T40 | lint/type/build/domain/browser/live gate مربوط؛ baseline هم‌شرایط؛ بدون feature بی‌آزمون | not_started |

بازبینی روی revision قابل اجرا با شواهد و روش reproduction انجام شود. ابتدا شکست‌های core، ایمنی و مسیر کاربر رفع شوند؛ معماری تازه فقط با ضرورت اثبات‌شده وارد شود.

## P5 — آماده‌سازی نسخه قابل تحویل

| Task | هدف/محدوده | وابستگی | پذیرش/تست | وضعیت |
| --- | --- | --- | --- | --- |
| T50 | README نهایی معماری/API/تعامل/limits و setup از checkout تمیز | T41 | AC15,16؛ دستورات واقعی، نسخه و real/simulated واضح؛ هیچ وابستگی به فایل محلی خارج Git | not_started |
| T51 | اجرای سناریوی واقعی end-to-end و ثبت evidence پاک‌سازی‌شده | T50 + دسترسی مجاز | AC05,09,11,15؛ trace درخواست→approval→اثر→readback؛ reproduction روی candidate مشخص؛ failureها محفوظ | not_started |
| T52 | بازبینی candidate و محدوده انتشار فنی | T51 | AC15,16؛ diff/secret scan، config و revision ثبت؛ visibility و تغییرات خارجی فقط طبق اختیار مالک | not_started |

## تصمیم‌های مهم

| تصمیم | وضعیت/دلیل | بازنگری در چه شرایطی؟ |
| --- | --- | --- |
| D1 وب‌اپ واحد و TypeScript | foundation ساخته شد؛ UX و API یکجا | فقط اگر spike محدودیت اساسی نشان دهد |
| D2 operator-local | دسترسی ساده‌تر به source و scope محدود | نیاز واقعی میزبانی remote بعد از طراحی auth |
| D3 یک runtime محدود | از چندعاملی/queue بی‌دلیل جلوگیری می‌کند | benchmark همان مسئله سود delegation را نشان دهد |
| D5 SQLite native | planned؛ approval ماندگار پیش از write | عدم پشتیبانی Node واقعی یا نیاز چند process |
| D6 مدل/SDK | باز تا دسترسی مجاز واقعی | smoke پروتکل، بودجه و eval تعیین‌کننده‌اند |
| D7 Biome | dependency lint ساده‌تر و حذف advisoryهای dev مسیر اولیه ESLint | صرفاً با نیاز اثبات‌شده |

## قالب به‌روزرسانی هر مرحله

```text
زمان و Task/Phase:
revision/config و acceptance IDs:
رفتار تغییرکرده و دلیل:
فرمان‌ها، pass/fail/skip و artifact:
real provider/tool/deploy یا simulated:
failure/ابهام و ریسک باقی‌مانده:
کار بعد، وابستگی و شرط پایان:
```

## جلسه آماده‌سازی — ۲۰۲۶-۱۰-۲۱

scaffold Next/TS، health صریح و smoke محلی ساخته شد. قرارداد upstream از OpenAPI ثبت شد؛ adapter هنوز ساخته نشده است. Biome جای پیکربندی اولیه lint را گرفت تا dependencyهای اضافی حذف شوند. نصب تمیز، lint/type/build، اجرای dev/production و 2 smoke محلی موفق‌اند؛ نتیجه دقیق در `docs/verification.md` ثبت شده است. بازبینی مستقل اسناد، ابهام بازیابی write و دو وابستگی نادرست برنامه را شناسایی کرد؛ هر سه اصلاح و بازخوانی شدند. مستندات فنی از فایل‌های محلی و یادداشت‌های داخلی مستقل‌اند. هیچ deploy، تغییر زیرساخت یا درخواست مدل اجرا نشده است.
