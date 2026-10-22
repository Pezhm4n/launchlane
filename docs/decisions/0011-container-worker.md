# 0011 — حفظ worker و افزودن اجرای محدود container

وضعیت: پذیرفته برای اصلاح Node22 با آزمون مستقیم موجود؛ ۲۰۲۶-۱۰-۲۲. این تصمیم پذیرش dependency/build عمومی نیست.

## بررسی گزینه‌ها

منابع رسمی در همین تاریخ خوانده شدند؛ نسخه از فایل source گرفته شد، نه امتیاز benchmark:

| گزینه | شاهد و تناسب | هزینه و مرز ادغام |
| --- | --- | --- |
| OpenHands SDK 1.57.0 | [نسخه و وابستگی‌ها](https://github.com/OpenHands/software-agent-sdk/blob/main/openhands-sdk/pyproject.toml)، [persistence](https://docs.openhands.dev/sdk/guides/convo-persistence)، [metrics](https://docs.openhands.dev/sdk/guides/metrics) و [confirmation](https://docs.openhands.dev/sdk/guides/security) | Python/REST و Agent Server گزینه قابل توسعه‌اند؛ برای TypeScript فعلی، bridge و تطبیق event، cancellation، retry و دفتر مصرف لازم است. سازگاری واقعی با BoxAPI و policy این نصب آزموده نشد. |
| mini-swe-agent 2.4.6 | [نسخه](https://github.com/SWE-agent/mini-swe-agent/blob/main/src/minisweagent/__init__.py) و [source محیط Docker](https://mini-swe-agent.com/latest/reference/environments/docker/) | محیط command و cleanup دارد؛ پیش‌فرض interpreter آن bash و run_args آن فقط rm است. resource/network policy و patch/test validation Launchlane همچنان باید در host enforce شوند. نصب و اجرای runtime آن در این برش انجام نشد. |
| worker موجود + executor محدود | job، source base، scope، budget، patch، same-test oracle و artifact قبلاً وجود داشتند | یک provider و یک policy حفظ می‌شوند؛ shell دلخواه مدل لازم نیست. توسعه عمومی build/dependency هنوز قرارداد جدا می‌خواهد. |

هر دو پروژه [OpenHands](https://github.com/OpenHands/software-agent-sdk/blob/main/LICENSE) و [mini-swe-agent](https://github.com/SWE-agent/mini-swe-agent/blob/main/LICENSE.md) MIT هستند. کدی از آن‌ها کپی یا dependency آن‌ها نصب نشد. الگوی پنل گلستون نیز صرفاً مرجع رفتار بود و کد یا منطق آن وارد نشد.

## تصمیم و spike اجرایی

همان CodeRepairAdapter و یک درخواست patch حفظ شدند. برای مأموریت دکمه‌ای، host اجرای container را در consent/job می‌بندد. image رسمی Node22.23.3 با digest ثابت، بدون pull خودکار، فقط mount همان workspace به‌صورت read-only، root read-only، user1000، network none، CPU1، RAM256MiB، pids64 و tmpfs64MiB استفاده می‌شود. کد به نسخه tmpfs کپی می‌شود؛ Docker socket، home و credential میزبان در دسترس نیستند. watch‌dog20s فرایند container را محدود می‌کند؛ مهلت میزبان انتقال/راه‌اندازی و خروجی نیز محدودند.

شناسه کامل برگشتی پیش از start در job ثبت می‌شود. فقط همان شناسه در cleanup حذف می‌شود؛ enumerate یا توقف containerهای دیگر نداریم. timeout یا cleanup نامعلوم، artifact موفق نمی‌سازد. crash می‌تواند job را interrupted و نیازمند بررسی receipt باقی بگذارد؛ resume خودکار script یا write وجود ندارد. این مرز با یک daemon مقاوم چندفرایندی اشتباه نشود.

`npm run test:sandbox` واقعاً baseline fail، patch مصنوعی، همان تست pass، حفظ source اصلی، نبود credential/نوشتن mount/شبکه و حذف دو container را سنجید. چرخه بعدی با مدل واقعی نیز فقط invoice.mjs را اصلاح کرد، دو آزمون Node22 را گذراند و همان artifact را به Liara فرستاد. جزئیات در [گزارش انتشار](../evidence/guided-publication.md) هستند. نخستین آزمون تحت بار هم‌زمان در cleanup timeout شکست خورد؛ نبود container با همان ID بعداً خوانده شد و آن failure حفظ شد.

## حدود و بازنگری

فرمان npm/install/build، تغییر dependency، ساخت تست تازه و پروژه بدون تست همچنان پشتیبانی عمومی ندارند. اجرای تاریخی Node permission برای سازگاری حفظ شده و sandbox سیستم‌عامل معرفی نمی‌شود. اگر harness بیرونی با مدل مجاز و budget/cancellation/receipt مشترک spike موفق بدهد، می‌تواند پشت همین adapter جایگزین شود؛ UI و cloud policy مستقل دیگری ساخته نمی‌شوند.
