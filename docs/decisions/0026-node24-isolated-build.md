# ADR0026 — محیط ساخت Node24 با همان اختیار و worker

تاریخ: ۲۰۲۶-۱۰-۲۳. وضعیت: implemented، اجرای container واقعی تأیید؛ انتشار زنده Node24 در این برش UNCONFIRMED.

مأموریت واقعی کاربر با engines Node24 چهار بار به worker Node22 رسید و BUILD_RUNTIME_UNSUPPORTED داد. سؤال برای فراهم‌کردن محیط ناسازگار، تصمیم معمول مهندسی را به کاربر منتقل می‌کرد. image رسمی `node:24.18.0-bookworm-slim` از registry با digest `sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d` بررسی و دریافت شد؛ linux/amd64 manifest نیز مشاهده شد. این image در bootstrap اپراتور آماده می‌شود؛ runtime هیچ pull ضمنی یا shell میزبان برای کد کاربر ندارد.

ProjectBuildPlan v3، Node24 و همین digest را به هم متصل می‌کند؛ v1 Node22 و v2 Python بدون تغییر parse/canonical باقی می‌مانند. انتخاب از source/engines و نسخهٔ دقیق image انجام می‌شود؛ قید ناسازگار مانند Node24.99 روی24.18 پذیرفته نیست. image دلخواه مدل یا جابه‌جایی image22/24 رد است. API/وب/MCP همان ابزار proposal، approval، scope، deadline، budget و journal قبلی را مصرف می‌کنند؛ انتخاب image سؤال جدید کاربر نیست.

runner install/build/test/start/GET از image مصوب plan استفاده می‌کند؛ workspace/tarballs فقط read-only، work private tmpfs، شبکه none، cap-drop، user1000، CPU1، memory2GiB، pid128 و cancellation/cleanup با ID دقیق حفظ می‌شوند. test-only قدیمی بدون build همچنان image22 دارد؛ Node24 از برنامهٔ build معتبر استفاده می‌کند. مجوز تاریخی image22 هرگز به image24 تبدیل نمی‌شود. mission authority، تبار artifact، patch غیرمؤثر و publication همان artifact از همان policy می‌گذرند؛ migration تازه‌ای برای JSON contract لازم نیست.

آزمون واقعی Node22 و Node24، نصب آفلاین، اجرای executable در tmpfs و assert نسخه دقیق را گذراند. چرخهٔ container در هر دو نسخه، baseline failure→patch بی‌اثرِ ردشده→patch مؤثر→آزمون اصلی→artifact→publication مصنوعی را با یک اختیار گذراند؛ سورس اصلی محفوظ ماند. این شاهد worker است؛ Docker publication یا Next/React/PHP را اثبات نمی‌کند. فرمان‌های بازتولید: `node --test tests/sandbox/native-build.test.ts tests/sandbox/mission-authority.test.ts` پس از آماده‌سازی imageهای pinned. setup عمومی build service، نسخه‌های Node دیگر و dependency managerهای دیگر هنوز در A07/A11 بازند.
