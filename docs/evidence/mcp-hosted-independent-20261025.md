# اتصال MCP به HTTPS و آزمون مستقل — ۲۰۲۶-۱۰-۲۵

این برش با درخواست مالک برای تکمیل پیاده‌سازی و آزمون مستقل انجام شد. ورود به حساب شخصی، استقرار عمومی، تغییر بودجه، staging، commit و push انجام نشد. پایهٔ Git برابر `6937dfc9a6be4f53a134b55175a53d22512dcf29` است؛ نتیجه مربوط به working tree ثبت‌شده در این گزارش است، نه HEAD به‌تنهایی. تغییرهای قبلی hosting حفظ شدند.

## مسئله و تغییر

- قرارداد فایل و پنجرهٔ MCP فقط HTTP محلی را می‌پذیرفتند؛ در نتیجه مسیر حساب وب عمومی قابل تکمیل نبود. اکنون HTTPS با دامنهٔ دقیق و مستقل از فایل دانلودشده پذیرفته می‌شود. HTTP همچنان محدود به loopback است؛ مسیر `/api/mcp`، نبود userinfo/query/fragment و انقضا/scope بررسی می‌شوند.
- setup گزینهٔ `--origin` دارد. واردکردن فایل مرورگر با این گزینه به `.env.local` یا credential محلی وابسته نیست. پیش از ذخیره، TLS، نام سرور، `launchlane_context` و scope واقعی بررسی می‌شوند. فایل موجود overwrite نمی‌شود؛ scope خواندن را نمی‌توان با `--missions` افزایش داد. ورود operator فقط به HTTP محلی ممکن است.
- سه snippet برای Codex، Claude Code و OpenCode با مسیر مطلق Node/bridge/access file و origin ثابت تولید می‌شوند. token در snippet یا خروجی CLI نیست و هیچ config کاربر ویرایش نمی‌شود. شکل آن‌ها با مستند رسمی میزبان‌ها تطبیق داده شده است؛ این به‌تنهایی آزمون runtime سه میزبان نیست.
- `process.exit(0)` پس از واردکردن فایل حذف شد. bridge نیز upstream/stdio را به‌شکل یک‌بارمصرف می‌بندد و خروج اجباری ندارد؛ خطاهای SDK به‌صورت خام وارد transcript نمی‌شوند. timeout ابزار، signal و پاسخ انقضا/لغو حفظ می‌شوند؛ bridge هیچ Store، worker یا credential سرویس مستقلی ندارد.
- reply موفق MCP علاوه بر متن JSON، `structuredContent` یکسان دارد. registry، scope، مأموریت، بودجه و اختیار انتشار همان application وب هستند؛ approve/execute جدیدی در MCP اضافه نشده است.
- در همان پنجرهٔ موجود و بدون تغییر CSS، صدور روی HTTPS و لغو همان فایل فعال شد. API لغو برای دسترسی ناموجود/منقضی/ازقبل‌لغوشده، `MCP_ACCESS_NOT_FOUND/404` می‌دهد؛ احراز هویت خود درخواست همچنان مستقل است. رابط در این حالت نشست معتبر را قطع نمی‌کند.

## هویت نسخهٔ سنجیده‌شده

نسخهٔ plain export مستقل در `C:/Users/Ariike.ir/.codex/tmp/launchlane-mcp-20261025-b4ca5fd3` ساخته شد؛ branch یا Git worktree نیست. `.env.local`، state، ledger، آرشیوهای خصوصی و Git وارد snapshot نشدند. وابستگی‌های نصب‌شده کپی شدند؛ دانلود یا تغییر lockfile انجام نشد.

Build ID نهایی `s_u4vkof8dQ1eNBPH0-e4` است. hashهای SHA-256 دوازده فایل کد/آزمون این برش در نسخهٔ آزمون و working tree یکسان‌اند؛ digest فهرست `path:hash` برابر `6dacc6db69984f11a59b7a8a727c459b45f6916e6419fec1e66808979fcb1ad8` است. manifest و logهای موفق و ناموفق در مسیر خصوصی `.local/mcp-20261025/` نگه‌داری شدند؛ دادهٔ credential در Git نیست.

## اعتبارسنجی نهایی

| فرمان یا اجرا | نتیجه و معنای شاهد |
| --- | --- |
| `npm run build` | موفق؛ Next16.4.2/Turbopack و TypeScript؛ ده warning مربوط به filesystem tracing در `github/import.ts` باقی است |
| `npm run typecheck` | موفق روی build نهایی مستقل |
| Biome lint دوازده فایل تغییرکردهٔ کد/آزمون | موفق، بدون خطا؛ full lint کل مخزن در این برش ادعا نمی‌شود |
| `node --test tests/domain/mcp-access-file.test.ts tests/domain/mcp.test.ts tests/domain/mcp-connections.test.ts` | ۱۱pass، صفرfail/skip؛ فایل، signature/session/scope، actor، revocation و allowance مشترک |
| `node --test --test-concurrency=1 tests/http/mcp.test.mjs tests/http/mcp-hosted.test.mjs` | ۱۴pass شامل دو parent و دوازده subtest، صفرfail/skip؛ production application و SQLite واقعی، provider/model مصنوعی |
| `npm run smoke:mcp:codex` | Codex نصب‌شدهٔ `0.163.0-alpha.11.2`، app-server/stdio واقعی و snippet تولیدشده؛ discovery ده ابزار و سه tool call، شامل رد ابزار خارج scope؛ بدون `turn/start`، model یا cloud write؛ cleanup تأیید شد |

HTTPS با reverse proxy آزمایشی loopback، گواهی موقت SAN معتبر و ورود Liara مصنوعی اجرا شد. SDK و CLI از CA صریح استفاده کردند؛ اعتبارسنجی TLS خاموش نشد. Chromium فقط SPKI همان گواهی آزمایشی را پذیرفت. آزمون گواهی نامعتبر نیز import را رد کرد؛ این fixture شاهد HTTPS دامنهٔ عمومی نیست.

آزمون HTTP/HTTPS موارد زیر را واقعاً اجرا کرد:

- مذاکرهٔ SDK، ابزار واقعی، برابری reply متنی/ساخت‌یافته و رد permission بالاتر؛ HTTP version/body limit/request ID و Origin نامجاز نیز از suite قبلی حفظ شدند.
- سه import مستقل CLI با code0 و خروج طبیعی، فایل با فاصله در نام، config بدون token، عدم overwrite، رد origin دیگر، scope بالاتر و گواهی نامعتبر.
- رد bridge بدون origin ثابت HTTPS و با فایل منقضی؛ پایان عادی روی EOF، فراخوانی ابزار، لغو سمت سرور و دریافت `AUTH_REQUIRED` بدون افشای token.
- صدور، دانلود و لغو از UI واقعی Chromium؛ فایل متعلق به HTTPS همان نصب و scope انتخاب‌شده بود. token در DOM، localStorage یا sessionStorage نبود.
- عرض‌های۳۲۰/۱۲۸۰، صفر overflow صفحه و صفر نقض axe در dialog مورد سنجش؛ Escape، بازگشت فوکوس به دکمهٔ MCP و صفر pageerror. تصویر هر دو عرض بازبینی شد؛ این عددها فقط به همان حالات مربوط‌اند.
- لغو دوبارهٔ grant و وضعیت stale در UI بدون خروج از نشست معتبر؛ درخواست privileged بعدی همچنان200 و token لغوشده401 بود.
- redirect واقعی302 به مقصد آزمایشی؛ import شکست خورد و مقصد redirect هیچ درخواست دریافت نکرد. credential به مقصد بعدی فرستاده نشد.
- مأموریت مشترک وب/MCP، progress، reconnect/stdio، نداشتن مالک مدل دوم و باقی‌ماندن scope/بودجه در suite HTTP موجود.

## شکست‌ها و اصلاح harness

ساخت نخست با junction وابستگی‌ها بین دو درایو با خطای resolution در Turbopack متوقف شد. کپی همان وابستگی‌های نصب‌شده به snapshot این محدودیت را رفع کرد؛ source یا تنظیم build برای پنهان‌کردن خطا تغییر نکرد.

اجرای اول HTTPS پیش از تماس با برنامه به مسیر پیش‌فرض خراب `openssl.cnf` سیستم برخورد کرد. config موقت مختص آزمون اضافه شد. اجرای بعدی با operator روی HTTPS، طبق policy موجود503 گرفت؛ fixture به authMode لیارا و exchange مصنوعی همان مسیر واقعی ورود تغییر کرد. policy production برای عبور آزمون ضعیف نشد. اصل این failureها در logها حفظ شده است.

سه import نهایی و خروج EOF bridge با موفقیت پایان یافتند و `UV_HANDLE_CLOSING` بازتولید نشد. این شاهدِ رفع رفتار مسیر آزموده‌شده پس از حذف خروج اجباری است؛ به‌تنهایی تحلیل علت native همهٔ خطاهای تاریخی ویندوز نیست.

## حدود و ادامه

نسخهٔ عمومی در این مرحله به‌روزرسانی نشد و نشست شخصی طبق انتخاب مالک استفاده نشد. پذیرش واقعی HTTPS عمومی با نشست حساب، runtime میزبان‌های Claude Code/OpenCode و turn مکالمه‌ای Codex همچنان UNCONFIRMED هستند. هر دو میزبان اخیر در PATH موجود نبودند؛ ابزار یا بسته‌ای برای آن‌ها نصب نشد. full domain/browser aggregate، همهٔ خانواده‌های لیارا، انتشار کامل ترب و connector اجرایی اصلاح از این برش نتیجه نمی‌شوند.

OAuth اختصاصی MCP، انتخاب source از MCP، incident goal مستقل، notification/task پیشرفته و پایش وضعیت میزبان با جدول `mcp_connections` در این برش پیاده نشده‌اند؛ آن جدول شاهد اتصال فعال نیست. web-to-coding-agent connector همچنان پذیرش جداگانهٔ AC26 دارد. A16/AC31 با این شواهد پیشرفت کرده‌اند و کامل اعلام نمی‌شوند.

فرمان اتصال عمومی و نگه‌داری credential در [راهنمای MCP](../mcp.md) است. گام بعد برای پذیرش عمومی: انتشار همین candidate از مسیر میزبانی موجود با حفظ state/ledger و بودجه، سپس grant از نشست واقعی و discovery/tool call میزبان روی همان دامنه. هیچ درخواست مدل واقعی، منبع پولی تازه یا نوشتن در ابر انجام نشد؛ allowance و ledger نصب اصلی تغییر نکردند.
