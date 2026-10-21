# شواهد اعتبارسنجی foundation

این گزارش فقط پایه پروژه را پوشش می‌دهد. Agent، اتصال Liara/مدل، session، approval، persistence، deploy و diagnosis هنوز پیاده نشده‌اند. این بررسی‌ها صحت قابلیت‌های محصول یا امنیت deployment را اثبات نمی‌کنند.

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
