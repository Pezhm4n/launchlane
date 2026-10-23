# میزبانی واقعی Launchlane روی لیارا — ۲۰۲۶-۱۰-۲۴

دامنهٔ قابل دسترس: **https://launchlane-live-1023.liara.run/?view=publish**. در `2026-10-23T20:45:20Z` صفحهٔ اصلی با عنوان Launchlane و هر۹ فایل JS/CSS با200 دریافت شدند. `GET /api/health` برابر200 و `GET /api/workspace` بدون نشست برابر401/AUTH_REQUIRED بود. این انتشار خود محصول است؛ انتشار تازهٔ پروژهٔ کاربر یا ترب از آن نتیجه نمی‌شود.

## هویت و ساختار نصب

- web: کد `27b14b5c78832abec4f2b3401c63b1a322dd7483`؛ image واقعی `sha256:0261aad88a1a8c39e5ef6a2ceb8bc99755c140a8e5304470cc303df47fd16e69`، خروجی standalone Next16.4.2 با Node24.18.0 و npm ci. بستهٔ Git allowlist با SHA256 `b529eaab2316dcd42be8405f3d327498e5faf0d805452e9ee97ce22541df622e` روی VPS ساخته شد؛ build محلی Docker پیش‌تر read-only metadata داده بود.
- VPS مجاز: Ubuntu24.04، پلن standard-plus-g2 با۴GB/دوCPU/۴۰GB؛ Docker29.1.3/Linux. web با کاربرnode، root read-only، state bind هم‌مسیر `/var/lib/launchlane` و socket خصوصی orchestrator اجرا می‌شود. Node22/24 و Python3.12 با digestهای قرارداد فعلی موجود و startup آن‌ها را inspect کرده است؛ job تازهٔ repair/build در این نصب اجرا نشده است.
- ingress: کد `4e5a55e798fb405dd95876217c0b9a0629a0d01c`؛ release فعال `6adbc700bffb36d7841c34b0`، source `c48677fc-8e10-415b-b0d0-b60165b669b5.tar.gz`، archive SHA256 `3452d385fbeeac3ae2be8222a23d90e986434e9543b81285a0ca2014a5908f91`؛ پلن small-g2/basic و Node24، پورت8080. READY در readback با پاسخ واقعی صفحه و assetها تکمیل شد؛ READY به‌تنهایی oracle نبود.
- لیارا TLS عمومی را خاتمه می‌دهد؛ ingress به Caddy روی8443 با CA و client certificate اختصاصی متصل است. `rejectUnauthorized:true` و client-auth روشن‌اند. web3000 و Docker API پورت عمومی ندارند. certificate سرور/client فعلی۳۰روزه و CA۹۰روزه‌اند؛ تمدید خودکار آن‌ها پیاده نشده است.
- gh رسمی Linux2.103.0 با checksum رسمی آرشیو، فقط executable و bind read-only نصب شد؛ `gh --version` داخل web همین نسخه را داد. هیچ credential/OAuth مدیر منتقل نشد.

## state و مصرف

نصب عمومی secret مستقل و state تازه دارد؛ DB محلی، archiveها، history، approvalهای single-use و credentialهای مدیر clone نشدند. پس از درخواست واقعی حفاظت‌شده، `state.sqlite` دارای۲۸جدول و `quick_check=ok` بود. دفتر مدل۵جدول و `quick_check=ok` دارد؛ هر دو داخل bind پایدار VPS هستند. restart/redeploy persistence عملی در این مرحله اجرا نشده و از وجود mount به‌عنوان شاهد restart استفاده نمی‌شود. بکاپ خارج VPS و بازیابی پس از از‌دست‌رفتن VPS هنوز تأیید نشده‌اند.

دفتر اصلی پیش از partition: allowance همان۲دلار، ceiling درخواست‌ها۰٫۸۹۰۴دلار، reserveهای تاریخی۰٫۶۸۷۸۶۶دلار و باقیمانده۰٫۴۲۱۷۳۴دلار. همهٔ ردیف‌ها با SQLite backup consistent حفظ و fingerprint زیر lock مقایسه شد. فقط reserve تخصیص append شد:۰٫۲دلار اختصاصی برای public و۰٫۲۲۱۷۳۴دلار برای نصب محلی. دو کپی حق خرج کل باقیمانده را ندارند؛ allowance تمدید/ایجاد نشد. readback guard در VPS دقیقاً۰٫۲دلار ماندهٔ مجاز داشت. این اعداد سقف محافظه‌کارانه‌اند، نه invoice یا اعتبار حساب. هیچ model request برای استقرار میزبان ارسال نشد؛ فعالیت هم‌زمان کاربر پیش از partition در baseline تازه منظور شده است.

برآورد پایهٔ VPS+IPv4+ingress از همان catalog مجاز حدود۵هزار تومن در ساعت و۸۴۰هزار تومن در۷روز است؛ مالیات/ترافیک و منابع قبلی جدا هستند. سقف قبلی۲میلیون تومان افزایش نیافت. میزان نهایی صورتحساب این استقرار هنوز اندازه‌گیری نشده است؛ منابع ساخته‌شده در journal خصوصی با ID ثبت‌اند.

## شکست‌ها و اصلاح‌ها

- نام اولیهٔ VPS طولانی‌تر از حد کنسول بود و400 گرفت؛ readback خالی و نام کوتاه `launchlane-exec-1023` با همان منابع/مالکیت یک‌بار ساخته شد. SSH مستقیم در TUN timeout داشت؛ مسیر خصوصی همان میزبان از NIC فیزیکی، با host-key ثابت و بدون تغییر VPN سیستم برقرار شد.
- اولین source upload ورودی موفق بود؛ harness به‌اشتباه ID آن را hex24 انتظار داشت. شناسهٔ واقعی UUID.tar.gz حفظ شد و بدون upload دوباره، با readback نبود release، همان source منتشر شد.
- release اول READY بود اما درخواست واقعی421 می‌داد: Host عمومی با SNI خصوصی در mTLS برابر نبود. ingress اکنون Host داخلی برابر `launchlane-origin` می‌فرستد و Caddy Host عمومی ثابت را بازمی‌گرداند. درخواست داخلی با این تغییر200 شد؛ بررسی TLS/Host غیرفعال نشد.
- upload اصلاح‌شده در یک تلاش پاسخ `fetch failed` داد و receipt نداشت؛ journal آن uncertain باقی است. GET فهرست source در این حساب404 و readback release فقط v1 را نشان داد؛ هیچ release/env/resource write تکرار نشد. یک object immutable مستقل، با سقف یک upload و یک release جدید در مجوز استقرار موجود ثبت شد؛ احتمال باقی‌ماندن source orphan قبلی نامعلوم است. تلاش مستقل receipt داد و فقط همان receipt به releasev2 وصل شد. READY زودتر از جابه‌جایی واقعی ترافیک دیده شد؛421 گذرا حفظ و نهایتاً200 واقعی ثبت شد.
- طبق دستور مالک، suite تازه پس از توقف آزمون‌ها اجرا نشد. تغییر نهایی ingress syntax-check و diff-check شد؛ assertion موجود SNI/Host به قرارداد صحیح به‌روز شد ولی اجرای تازهٔ آن ادعا نمی‌شود.۹regression hosting و۳MCP وlint/typecheck مربوط به برش پیش از توقف، evidence تاریخی همان snapshotها هستند.

## محدودهٔ تحویل

ورود با رمز/TOTP حساب واقعی از این دامنه، publication جدید از همان نشست عمومی، job واقعی build/repair، GitHub OAuth، persistence پس از restart، بار چندکاربر و تأیید همهٔ۱۴خانواده **UNCONFIRMED** هستند. API health همچنان liveness را گزارش می‌کند و integrations=unverified را به پذیرش کامل تبدیل نمی‌کند. MCP grant محلی و اتصال Codex جدا هستند؛ یک context واقعی گرفته شد ولی CLI پس از آن با UV_HANDLE_CLOSING خارج شد و اتصال کامل میزبان پذیرفته نیست. MCP عمومی از انتشار web حاصل نمی‌شود.

سرور محلی candidate53 از6a27c66 روی3000 و preview مستقل Login روی3011 حفظ شدند. تغییرات دادهٔ محلی ناشی از upload/کاربر حذف نشدند؛ دادهٔ اصلی ترب دست‌نخورده است. این نصب، مرزهای باز export/artifact/data/publication ترب یا ماتریس رسمی را نمی‌بندد. لینک داورها اکنون به صفحهٔ واقعی محصول وصل است، و ادعای «تمام قابلیت‌ها در production پذیرفته‌اند» مطرح نمی‌شود.

فایل‌های raw، journal، backup، partition و readback در پوشهٔ ignored `.local/hosting-launchlane-20261023` هستند؛ env، TLS key و credential در Git/image/source ingress قرار نگرفتند. راه‌اندازی و محل تنظیمات خصوصی در [راهنمای نصب](../hosted-access.md) آمده است.
