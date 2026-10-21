# شواهد اعتبارسنجی Launchlane

بخش نخست، سابقه P0 است؛ بخش P1 پایین همین فایل شواهد جاری را نگه می‌دارد. نتایج bootstrap جای قابلیت محصول و fixture جای اتصال زنده نیست.

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
