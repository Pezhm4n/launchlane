# Launchlane

دستیار استقرار و بررسی سلامت سرویس، با پیشنهاد مبتنی بر شواهد و تأیید شما پیش از اقدام حساس.

**وضعیت فعلی:** میز کار محلی برای ورود امن، بررسی پروژه Node، نمایش manifest، پیشنهاد انتشار و ثبت تأیید/رد ساخته شده است. تصمیم‌ها در SQLite می‌مانند. اتصال زنده Liara، upload/deploy و diagnosis هنوز انجام نشده‌اند؛ تأیید یک پیشنهاد فعلاً چیزی را منتشر نمی‌کند. ارتباط BoxAPI با یک smoke واقعی محدود و داده مصنوعی تأیید شده است؛ این نتیجه کیفیت تشخیص اختلال را ثابت نمی‌کند.

## اجرای محلی

Node 24.15+ از شاخه 24.x و npm لازم است. برای مسیر آفلاین کلید Liara/مدل لازم نیست.

```text
npm ci
npm run setup:local
npm run dev
```

صفحه پیش‌فرض: `http://127.0.0.1:3000`. کلید ورود را از `.local/operator-access.txt` به‌صورت محلی بردارید؛ این فایل و `.env.local` خصوصی‌اند و وارد Git نمی‌شوند. setup مقدار موجود credentialها را حفظ می‌کند. پس از تغییر config، server را restart کنید. برای اجرای production:

```text
npm run build
npm start
```

در terminal جدا، در حالی که server اجراست:

```text
npm run lint
npm run typecheck
npm run test:domain
npm test
```

`npm test` دو smoke اجرای server است. `test:domain` policy، persistence، source و قرارداد transport/خطا را می‌سنجد. برای پورت دیگر، `LAUNCHLANE_ORIGIN` و پورت اجرا را با هم عوض کنید و برای smoke، `TEST_BASE_URL` را نیز تنظیم کنید.

برای HTTP و UI، پس از build و بدون نیاز به اجرای server جداگانه:

```text
npm run test:http
npx playwright install chromium
npm run test:browser
```

این دو دستور server تولیدی موقت با scope مصنوعی و کلیدهای provider خالی ایجاد می‌کنند. آزمون مرورگر ۶ عرض، approve/reject، خطا، لغو، کیبورد، بزرگ‌نمایی متن و axe را می‌سنجد؛ تصاویر و گزارش در `.artifacts/` محلی می‌مانند. نتیجه، شاهد deploy یا کیفیت مدل واقعی نیست.

## استفاده از میز کار

1. وارد شوید و پوشه نسبی زیر `LAUNCHLANE_WORKSPACE_ROOT` را وارد کنید. setup ریشه همین checkout را پیش‌فرض می‌گذارد؛ نمونه آماده `examples/node-service` است.
2. runtime، port، start، نام envها، unknownها و فهرست فایل‌های مجاز را بررسی کنید. scanner هیچ script اجرا نمی‌کند، فایل env را نمی‌خواند و archive نمی‌سازد.
3. پس از مشخص‌شدن تیم/app واقعی، app آزمایشی را در `LAUNCHLANE_APP_ALLOWLIST` و تیم را در `LIARA_TEAM_ID` بگذارید. محصول app تصادفی انتخاب نمی‌کند. تا آن زمان بررسی source فعال و ساخت action بسته است.
4. پیشنهاد به app، port و source hash همان لحظه متصل می‌شود. تأیید/رد در server ثبت می‌شود؛ تغییر source نیاز به بررسی و پیشنهاد تازه دارد. پلن/قیمت هنوز نامعلوم است.

`.env.example` با config مصرف‌شده هماهنگ است. هر دو gate `LAUNCHLANE_ENABLE_MUTATIONS` و `LAUNCHLANE_ENABLE_LIVE_MODEL` پیش‌فرض false هستند. حتی فعال‌کردن flag mutation، adapter زنده یا approval ایجاد نمی‌کند. رمز پنل Liara توکن PaaS نیست؛ کلید مدل فقط به میزبان ثابت BoxAPI مجاز است.

پس از آماده‌شدن اعتبار و تعیین مدل مجاز، smoke کم‌مصرف و صریح زیر حداکثر دو درخواست واقعی به BoxAPI می‌فرستد. این فرمان در checkها اجرا نمی‌شود و gate ذخیره‌شده را تغییر نمی‌دهد:

```text
npm run smoke:model -- --live
```

برای `gpt-6-luna` در مسیر Chat Completions، `MODEL_REASONING_EFFORT=none` برای ابزارخوانی لازم بود؛ بدون آن سرویس 400 داد. مدل‌های دیگر این نصب هنوز تست نشده‌اند. فهرست مدل‌های Chat مجاز در server enforce می‌شود؛ نه endpoint/provider پنهان داریم و نه fallback خودکار.

## نقشه مستندات

| فایل | کاربرد |
| --- | --- |
| [project-overview.md](project-overview.md) | نیاز کاربر، core flow، محدوده و معیارهای موفقیت |
| [ARCHITECTURE.md](ARCHITECTURE.md) | معماری موجود/هدف، مرزها، مدل داده و تصمیم‌ها |
| [DESIGN.md](DESIGN.md) | توکن‌ها، ایران‌یکان، RTL و رفتار responsive نزدیک زبان بصری Liara |
| [TASKS.md](TASKS.md) | فاز فعال، وابستگی، پذیرش و وضعیت هر Task |
| [docs/acceptance.md](docs/acceptance.md) | رفتار قابل سنجش و تست‌های پذیرش |
| [docs/api-capabilities.md](docs/api-capabilities.md) | API مستند در برابر دسترسی زنده تأییدنشده |
| [docs/verification.md](docs/verification.md) | فرمان‌ها و شواهد واقعی آماده‌سازی |

## محدوده و دسترسی

MVP یک operator و یک scope مجاز دارد. privileged read/write به session، Host/Origin و در درخواست تغییر، CSRF وابسته‌اند؛ loopback جای authentication نیست. SQLite برای یک process است و approval/attempt به حافظه fallback نمی‌کنند. پاسخ گم‌شده یا قطع process، action را uncertain و write متعارض app را مسدود می‌کند.

تشخیص source محدود و static است؛ پشتیبانی همه frameworkها، archive/upload واقعی، قیمت/پلن، env secret-reference، health probe شبکه‌ای، diagnosis و اصلاح واقعی هنوز تکمیل نشده‌اند. پشتیبانی چند process، میزبانی عمومی و پایش ۲۴ساعته در محدوده این نسخه نیستند.

قابلیت پیاده‌نشده و بررسی زنده انجام‌نشده در گزارش وضعیت محصول صریح ثبت می‌شوند.
