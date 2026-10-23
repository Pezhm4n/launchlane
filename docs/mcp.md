# اتصال به Launchlane از MCP

این برش روی همان نصب operator-local کار می‌کند. وب‌اپ باید در حال اجرا باشد؛ bridge مالک SQLite، مدل یا موتور انتشار جدا نیست. دو مسیر «ایجنت کاربر→Launchlane از MCP» و «Launchlane→Coding Agent برای اصلاح» مستقل‌اند. این راهنما مسیر اول را توضیح می‌دهد؛ وجود اتصال MCP به معنی آماده‌بودن worker بیرونی نیست.

## نصب و دسترسی

Node24.x طبق engines و lockfile لازم است. از checkout تمیز `npm ci`، `npm run setup:local` و `npm run build`، سپس `npm start` را اجرا کنید. پس از راه‌اندازی وب‌اپ:

```powershell
npm run setup:mcp
```

این فرمان ورود محلی را از `.env.local` می‌گیرد، token مخصوص MCP با دسترسی خواندن می‌سازد و در `.local/mcp-access.json` می‌نویسد. کلید را چاپ نمی‌کند و هیچ فایل تنظیمات میزبان را تغییر نمی‌دهد. اجازه ساخت/ادامه/لغو مأموریت اختیاری است و ممکن است مدل همان مأموریت را مصرف کند:

```powershell
npm run setup:mcp -- --missions --output .local/mcp-missions.json
```

فایل موجود overwrite نمی‌شود. token حداکثر یک ساعت و تا پایان نشست والد اعتبار دارد؛ پس از انقضا، فایل تازه با `--output .local/mcp-next.json` بسازید و مسیر config را تغییر دهید. renew خودکار و credential طولانی‌عمر در این برش پیاده نیست. فایل فقط زیر `.local` همین checkout پذیرفته می‌شود و باید با ACL خصوصی حساب اجراکننده نگه‌داری شود. raw token را در config، گفت‌وگو یا Git قرار ندهید.

## تنظیم میزبان‌ها

مسیرهای زیر را با مسیر مطلق checkout و فایل دسترسی خودتان جایگزین و فقط این entry را با config موجود merge کنید. فرمان Node مستقیم است؛ اجرای `npm run` برای stdio ممکن است banner غیرپروتکلی بسازد. فایل config کاربر را overwrite نکنید.

Codex، در config TOML موجود:

```toml
[mcp_servers.launchlane]
command = "node"
args = ["I:/Computer/dev/starcoach/launchlane/scripts/mcp-stdio.mjs"]
[mcp_servers.launchlane.env]
LAUNCHLANE_MCP_ACCESS_FILE = "I:/Computer/dev/starcoach/launchlane/.local/mcp-access.json"
```

Claude Code، entry در `mcpServers` پیکربندی موردنظر:

```json
{"mcpServers":{"launchlane":{"command":"node","args":["I:/Computer/dev/starcoach/launchlane/scripts/mcp-stdio.mjs"],"env":{"LAUNCHLANE_MCP_ACCESS_FILE":"I:/Computer/dev/starcoach/launchlane/.local/mcp-access.json"}}}}
```

OpenCode، entry در `mcp` پیکربندی موجود:

```json
{"mcp":{"launchlane":{"type":"local","command":["node","I:/Computer/dev/starcoach/launchlane/scripts/mcp-stdio.mjs"],"environment":{"LAUNCHLANE_MCP_ACCESS_FILE":"I:/Computer/dev/starcoach/launchlane/.local/mcp-access.json"},"enabled":true}}}
```

شکل configهای دوم و سوم از [مستند Claude Code](https://code.claude.com/docs/en/mcp) و [مستند OpenCode](https://opencode.ai/docs/mcp-servers/) خوانده شده است؛ اجرای زنده آن دو هنوز UNCONFIRMED است. برای Codex، CLI0.163.0-alpha.11 و app-server واقعی آزموده شده‌اند. استفاده مستقیم HTTP در `/api/mcp` نیز SDK-tested است؛ header احراز هویت آن bearer همین token محدود است. stdio توصیهٔ این نصب است تا token در config میزبان کپی نشود.

## ابزار و مرز اختیار

`inspect_project` و ابزارهای `read_*` و catalog متناسب با gateهای نصب از registry واقعی وب می‌آیند. source ابتدا در خود Launchlane انتخاب می‌شود؛ این برش picker یا upload جدیدی در میزبان ندارد. read فایل فقط از manifest همان source ممکن است. raw env یا host shell در ابزارها وجود ندارد.

| ابزار | اثر و ادامه |
| --- | --- |
| `launchlane_context` | انتخاب فعلی، artifact و capabilityهای همان حساب مجاز؛ بدون مدل |
| `launchlane_mission` | run، decision/job/artifact و events بعد از cursor؛ صرفاً replay |
| `launchlane_publish` | ایجاد یا join مأموریت همان source/معیار؛ requestKey را پیش از ارسال نگه دارید |
| `launchlane_resume` | ادامه صریح همان مأموریت با همان budget؛ تصمیم یا write نامعلوم را replay نمی‌کند |
| `launchlane_cancel` | توقف با revision فعلی؛ اثر پذیرفته‌شدهٔ provider را undo نمی‌کند |

سه ابزار آخر فقط با grant مأموریت عرضه می‌شوند. schema و خطای دارای code/message/retryable/requestId از application می‌آیند. تصمیم لازم با `reviewUrl` در خود Launchlane انجام می‌شود؛ هیچ ابزار approve/execute از MCP عرضه نشده است. خواندن progress، بستن میزبان یا reconnect، کار تازه ایجاد نمی‌کند. مأموریت طولانی را با ID و cursor بخوانید؛ بستن transport، لغو مأموریت نیست. notification/task اختیاری میزبان پیش‌شرط این مسیر نیست.

وقتی مالک مأموریت درحال اجراست، read مستقیم registry با AGENT_BUSY رد می‌شود؛ progress را از `launchlane_mission` بخوانید. در مأموریت انتشار متوقف‌شده، read واقعی همان source از allowance پایدار همان run کم می‌کند و transport تازه بودجه را تمدید نمی‌کند. reserve پیش از provider/read ثبت می‌شود؛ دو درخواست هم‌زمان با یک سهم، فقط یک خواندن معتبر دارند. خواندن state/events مدل یا tool allowance مصرف نمی‌کند. schema ورودی publication و حد۲۴۰نویسهٔ نشانه از همان قرارداد وب می‌آیند.

## آزمون و رفع اشکال

پس از build، `node --test tests/http/mcp.test.mjs`، SDK رسمی HTTP/stdio، replay مشترک، deny، revocation، version/body limit و request ID را با وب‌اپ/SQLite واقعی و مدل مصنوعی می‌سنجد. `node --test tests/domain/mcp.test.ts` مرز امضای دسترسی، actor، انقضا و CAS را بررسی می‌کند.

`npm run smoke:mcp:codex` opt-in و نیازمند Codex نصب‌شده است؛ یک server و home موقت بدون credential مدل ایجاد می‌کند، discovery و سه tool call را از app-server واقعی می‌سنجد و هیچ `turn/start` نمی‌فرستد. در صورت نبودن executable در PATH، `LAUNCHLANE_CODEX_PATH` را به همان فایل نصب‌شده بدهید؛ runner ابزاری دانلود نمی‌کند و config کاربر را نمی‌خواند یا overwrite نمی‌کند. این آزمون، job اصلاح کد نیست.

| نشانه | اقدام |
| --- | --- |
| خطای اتصال bridge | وب‌اپ به‌روز را اجرا کنید؛ origin در `.env.local` و access file باید یکی باشند |
| AUTH_REQUIRED | token/نشست والد منقضی یا لغو شده است؛ دوباره setup و مسیر فایل تازه |
| TOOL_DENIED | grant خواندن یا gate/registry آن ابزار را مجاز نمی‌کند؛ approval را با پیام جعل نکنید |
| AGENT_CONTEXT_CHANGED / PROJECT_CHANGED | انتخاب یا source تغییر کرده؛ مأموریت و تصمیم قدیمی به source تازه منتقل نمی‌شوند |
| AGENT_CONFLICT | revision فعلی را بخوانید؛ write را blind retry نکنید |
| نسخه پروتکل ناسازگار | client باید نسخه پذیرفته‌شده SDK را مذاکره کند؛ header ناسازگار رد می‌شود |
| میزبان بیرونی در دسترس نیست | این وضعیت اتصال اجرایی محسوب نمی‌شود؛ fallback پس از شروع job نامعلوم هنوز implementation جدا می‌خواهد |

HTTP عمومی، OAuth، انتخاب source از MCP، approve از میزبان، notifications/tasks پیشرفته، incident goal مستقل و پذیرش زنده Claude/OpenCode کارهای باز A16 هستند. جزئیات تصمیم در [ADR0017](decisions/0017-shared-mcp-facade.md) است.
