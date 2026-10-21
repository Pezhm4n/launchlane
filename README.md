# Launchlane

دستیار استقرار و بررسی سلامت سرویس، با پیشنهاد مبتنی بر شواهد و تأیید شما پیش از اقدام حساس.

**وضعیت فعلی:** پایهٔ پروژه و برنامه پیاده‌سازی آماده شده‌اند؛ Agent، اتصال لیارا، مدل، عملیات deploy و diagnosis هنوز پیاده نشده‌اند. صفحه اصلی و `/api/health` فقط سلامت اجرای scaffold را نشان می‌دهند.

## اجرای پایه

Node 24.15+ از شاخه 24.x و npm لازم است. برای scaffold کلید API لازم نیست.

```text
npm ci
npm run dev
```

صفحه پیش‌فرض: `http://127.0.0.1:3000`. برای اجرای production:

```text
npm run build
npm start
```

در terminal جدا، در حالی که server اجراست:

```text
npm run lint
npm run typecheck
npm test
```

`npm test` فعلاً smoke HTTP محلی است. تست‌های قابلیت و provider در مراحل بعد اضافه می‌شوند؛ این نتیجه به معنای درست‌بودن deploy یا تشخیص خطا نیست. برای پورت دیگر، `TEST_BASE_URL` را در محیط همان terminal تنظیم کن. `.env.example` نام‌های config برنامه‌ریزی‌شده را دارد؛ تا پیش از P1/P2 بیشترشان هنوز مصرف نمی‌شوند. مقدار واقعی را فقط در `.env.local` ignored نگه دار.

## نقشه مستندات

| فایل | کاربرد |
| --- | --- |
| [project-overview.md](project-overview.md) | نیاز کاربر، core flow، محدوده و معیارهای موفقیت |
| [ARCHITECTURE.md](ARCHITECTURE.md) | معماری موجود/هدف، مرزها، مدل داده و تصمیم‌ها |
| [DESIGN.md](DESIGN.md) | اصول ثابت؛ تکمیل طرح واقعی با Coding Agent |
| [TASKS.md](TASKS.md) | فاز فعال، وابستگی، پذیرش و وضعیت هر Task |
| [docs/acceptance.md](docs/acceptance.md) | رفتار قابل سنجش و تست‌های پذیرش |
| [docs/api-capabilities.md](docs/api-capabilities.md) | API مستند در برابر دسترسی زنده تأییدنشده |
| [docs/verification.md](docs/verification.md) | فرمان‌ها و شواهد واقعی آماده‌سازی |

## محدوده و دسترسی

MVP پیشنهادی یک operator و یک scope مجاز دارد. runtime به‌صورت loopback شروع می‌شود؛ پیش از فعال‌کردن write، session/policy و approval پایدار باید ساخته شوند. پشتیبانی multi-tenant و پایش ۲۴ساعته جزو پایه نیستند. source خصوصی، کلیدها و state اجرایی وارد Git نمی‌شوند.

قابلیت پیاده‌نشده و بررسی زنده انجام‌نشده در گزارش وضعیت محصول صریح ثبت می‌شوند.
