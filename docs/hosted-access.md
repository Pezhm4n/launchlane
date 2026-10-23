# ورود کاربران سایت و مرز میزبانی عمومی

بازدیدکنندهٔ نسخهٔ عمومی، ایمیل و رمز حساب خودش در لیارا را وارد می‌کند. کد دومرحله‌ای فقط در صورت فعال‌بودن آن خواسته می‌شود. راه‌اندازی زیر فقط وظیفهٔ مدیر نصب است و داخل صفحهٔ ورود نمایش داده نمی‌شود. اصل تصمیم و محدودهٔ تأیید در [ADR0024](decisions/0024-liara-identity-login.md) است.

## تنظیم نصب

Node 24.15+ از خانوادهٔ 24 و dependencyهای lockfile لازم‌اند. پس از `npm ci` و `npm run build`، در تنظیمات امن سرور تعیین کنید:

```dotenv
LAUNCHLANE_AUTH_MODE=liara
LAUNCHLANE_ORIGIN=https://YOUR-LAUNCHLANE-DOMAIN
LAUNCHLANE_STATE_DIR=/data/launchlane
LAUNCHLANE_SESSION_SECRET=GENERATE-A-LONG-INDEPENDENT-RANDOM-SECRET
```

secret واقعی را یک‌بار روی سرور تولید و بیرون Git نگه دارید؛ مقدار نمونه کلید نیست. secret و disk باید در restart ثابت بمانند. state را بین چند replica/process نویسنده مشترک نکنید. `npm run start:hosted` نسخهٔ buildشده را روی `0.0.0.0` اجرا می‌کند و بدون mode ورود لیارا، origin HTTPS، session secret و مسیر مطلق state شروع نمی‌شود. وجود مسیر مطلق به‌تنهایی دوام disk را اثبات نمی‌کند؛ mount واقعی باید در مقصد بررسی شود.

reverse proxy باید TLS معتبر، Host مطابق origin، محدودیت نرخ/حجم و timeout داشته باشد. برنامه forwarded-host دلخواه را جای Host معتبر قبول نمی‌کند. redirect یا wildcard Origin برای حل مشکل اتصال اضافه نکنید. endpointهای نوشتن همان Origin و CSRF را لازم دارند؛ cookie عمومی Secure/HttpOnly/SameSite=Strict است. دسترسی فایل‌ها و DB را به process سرویس محدود کنید. از root قبلی workspace اپراتور، `.local/operator-access.txt` یا توکن لیارای مدیر برای کاربران استفاده نکنید.

گیت‌های مدل و زیرساخت همچنان در `.env.example` پیش‌فرض false هستند. فعال‌کردن آن‌ها به معنی اعطای approval نیست. کلید مدل متعلق به نصب، مصرف تجمیعی و ظرفیت ذخیره‌سازی کاربران باید با بودجه و محدودیت واقعی نصب هماهنگ شود. مدل یا source نمی‌تواند هزینه یا مجوز تازه ایجاد کند.

## مسیر فعلی کاربر

ورود با لیارا → انتخاب فضای کاری واقعی در همین سایت → انتخاب پوشه از مرورگر → بررسی source → پیشنهاد مقصد/پلن و هزینه → تصمیم مجاز → انتشار و بررسی نتیجه با موتور موجود. توکن API از کاربر خواسته نمی‌شود. اصل پوشهٔ کاربر عوض نمی‌شود و source آپلودشده در scope پروژه ثبت می‌شود. اتصال گیت‌هاب باید private همان actor باشد؛ استفاده از ورود گیت‌هاب/Codex مدیر سرور برای بازدیدکنندگان رد می‌شود.

این مسیر در آزمون HTTP/مرورگر با provider کنترل‌شده به انتخاب پوشه و جداسازی تاریخچه رسیده است؛ برای ادعای انتشار عمومی باید ورود زنده و انتشار از دامنهٔ واقعی جدا اثبات شوند. در حال حاضر scope حساب شخصیِ بدون تیم و ساخت تیم داخل محصول باز است. حساب صرفاً اجتماعیِ بدون رمز باید در لیارا رمز تعیین کند؛ ثبت‌نام/هویت/شارژ حساب، قابلیت API انتشار نیستند.

## عیب‌یابی

- «ورود تأیید نشد»: ایمیل/رمز یا کد را بررسی کنید. رمز اشتباه وارد log یا متن خطا نمی‌شود. مقدار رمز پس از خطا از فرم پاک می‌شود.
- کد دومرحله‌ای: شش رقم جاری برنامهٔ تأیید را وارد کنید؛ رقم فارسی هم به رقم لاتین تبدیل می‌شود.
- فهرست فضای کاری دریافت نشد: اتصال شبکه یا پاسخ account API را بررسی کنید. خالی‌بودن واقعی با خطای شبکه یکسان نیست.
- Host/Origin رد شده: دامنهٔ تنظیم‌شده و Host عبوری از proxy را تطبیق دهید. بررسی Origin را خاموش نکنید.
- history نصب محلی دیده نمی‌شود: actor اپراتور با حساب لیارای تازه یکسان نیست؛ داده‌ها پاک نشده‌اند و خودکار به کاربر دیگری منتقل نمی‌شوند.
- sandbox در دسترس نیست: build/test عمومی روی shell میزبان fallback نمی‌شود. سرویس اجرای ایزولهٔ مجاز در مقصد باید فراهم و آزموده شود؛ دسترسی عمومی به Docker socket راه‌حل این راهنما نیست.

تا بستن موارد باز [شاهد ورود](evidence/liara-identity-login.md)، این راهنما تنظیم تکرارپذیر مسیر دسترسی است، نه گواه آماده‌بودن کامل برای داورها.

## بستهٔ Linux و دامنهٔ پیش‌فرض لیارا

`Dockerfile` با Node24.18 دارای digest ثابت، `npm ci` و خروجی standalone همان Next نصب‌شده، web را می‌سازد. assets عمومی و static همراه خروجی قرار می‌گیرند؛ runtime با کاربر node اجرا می‌شود. Docker context یک allowlist است؛ `.env`، state، source archives، کلیدها و یادداشت‌های محلی داخل image نمی‌روند. build محلی این برش به خطای read-only در metadata موتور Docker خورد؛ این failure به معنی build موفق image نیست.

فایل‌های `deploy/liara-vps` استقرار یک writer و مسیر یکسان `/var/lib/launchlane` روی میزبان و orchestrator را تعریف می‌کنند. workerهای محدود موجود فقط source/cache مجاز خود را mount می‌کنند؛ socket در اختیار پروژهٔ کاربر قرار نمی‌گیرد و هیچ پورت Docker منتشر نمی‌شود. startup با gate اصلاح روشن، engine لینوکس و هر سه image فعلی را بررسی می‌کند. دسترسی orchestrator به socket اختیار بالای نصب است؛ آن را عمومی یا به پروژه‌ها واگذار نکنید.

برای دامنهٔ پیش‌فرض، `deploy/liara-ingress` برنامهٔ Node بدون dependency است که HTTPS ورودی لیارا را به VPS با mTLS می‌رساند. مقصد و Host ثابت‌اند؛ client certificate، key و CA فقط تنظیمات امن نصب هستند. TLS verification خاموش نمی‌شود و proxy هیچ write ناموفق را replay نمی‌کند. Caddy روی8443 گواهی client را لازم دارد؛ web3000 در host منتشر نمی‌شود. فایل خصوصی `/etc/launchlane/runtime.compose.json` متغیرهای runtime را به compose می‌دهد؛ imageها در deployment.env با digest واقعی مشخص می‌شوند. وجود این فایل‌ها، پذیرش live این معماری نیست؛ build، مسیر عمومی، ورود و restart persistence باید در مقصد ثبت شوند.

مدل زنده در `start:hosted` به `LAUNCHLANE_MODEL_LEDGER_PATH` مطلق و `LAUNCHLANE_MODEL_LEDGER_PHASE` موجود نیاز دارد. guard هیچ ledger، migration، allowance یا reserve تاریخی را از نو نمی‌سازد. reserve قبل از ارسال در transaction ثبت می‌شود؛ پاسخ نامعلوم reserve کامل را نگه می‌دارد. هزینهٔ تسویه‌شده همان ceiling محافظه‌کارانهٔ قبلی gpt-6-luna است، نه invoice. بدون انتقال مالکیت مصرف یا partition مستندِ همان باقیمانده، دو کپی ledger نباید هم‌زمان اختیار خرج کامل داشته باشند.

در mTLS، Host داخلی باید با SNI گواهی `launchlane-origin` یکسان باشد؛ Caddy سپس Host ثابت دامنهٔ عمومی را برای web بازنویسی می‌کند. Host عمومی در مرز ورودی کنترل می‌شود و `x-forwarded-host` همان دامنه است. ارسال Host عمومی با SNI خصوصی در مقصد واقعی421 داد؛ بررسی Host یا TLS برای رفع آن غیرفعال نمی‌شود.

GitHub CLI Linux نسخهٔ دقیق2.103.0 نیز dependency نصب است. آرشیو رسمی `gh_2.103.0_linux_amd64.tar.gz` با SHA256 `fdd768eb70f6409f80fcfa9f3a1c0adf0fc98d827ab3ce0bed2ac22762c5d786` بررسی و فقط `bin/gh` در `/opt/launchlane/tools/gh` با mode755 قرار می‌گیرد. runtime override همین فایل را read-only روی `/usr/local/bin/gh` mount می‌کند؛ هیچ GitHub credential مدیر کپی نمی‌شود. این آمادگی executable است، نه تأیید OAuth کاربر.
