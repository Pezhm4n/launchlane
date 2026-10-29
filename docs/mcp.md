# اتصال به Launchlane از MCP

افزودهٔ v4 داده، ۲۰۲۶-۱۰-۲۹: `propose_project_build` در شکل runner، `prepareArtifact:true` را برای تصمیم تازهٔ آماده‌سازی می‌پذیرد. همان registry/job پس از proof مستقل داده، بستهٔ compiled دقیق را انتخاب می‌کند؛ v1–v3 همچنان فقط compatibility هستند. publication به binding خصوصی تمام منابع مستقل نیاز دارد؛ این گزینه ابزار SQL تولیدی یا اختیار approve ایجاد نمی‌کند. [شاهد](evidence/data-tested-artifact.md) اجرای تازه از میزبان MCP واقعی نیست.

افزودهٔ v29، ۲۰۲۶-۱۰-۲۸: `propose_database_attachment {consumerRoot,bindingKeys,databaseId}` در همان registry و اجرای Agent وب/MCP قرار دارد. host، هویت و شبکهٔ خصوصی منبع موجود را بررسی و پیشنهاد انتخاب انسانی ایجاد می‌کند؛ این ابزار مجوز ساخت، credential عمومی یا SQL نمی‌دهد. `configure_env` به همان فرم خصوصی و تصمیم جداگانه وصل است. [شواهد](evidence/existing-managed-database.md) شامل اجرای تازه از میزبان MCP واقعی نیست.

افزودهٔ منابع نام‌دار، ۲۰۲۶-۱۰-۲۸: `propose_database` مشترک به `consumerRoot/bindingKeys/type/version/planId/bundleId` نیاز دارد. host، کلیدهای خصوصی همان source را در v28 و تصمیم ساخت می‌بندد؛ هر پیشنهاد یک منبع است و چند کلیدِ یک پیشنهاد صریحاً alias همان منبع‌اند. پس از binding خصوصیِ تأییدشده، همان mission می‌تواند منبع مستقل بعدی را با تصمیم تازه پیشنهاد کند. v27 و journal/uncertainty قبلی حفظ‌اند؛ ابزار عمومی credential، approve یا SQL افزوده نشده است. [شواهد مشترک](evidence/managed-database-targets.md) جای آزمون تازه از میزبان MCP واقعی را نمی‌گیرد.

افزودهٔ runner داده، ۲۰۲۶-۱۰-۲۸: همان `propose_project_build` اکنون شکل `compatibilityDatabase: { runnerScript, targets }` هم دارد. هر target شامل `id/environmentKeys/requiredRelations/oracle` است؛ oracle از `columns/rows/persistence` تشکیل می‌شود و `rows` برای schema-only می‌تواند خالی باشد. host زنجیره و hash script/hook موجود، image، DB/role و خلاصهٔ اتصال را می‌سازد؛ مدل نمی‌تواند URL واقعی، role، SQL میزبان یا رسید موفق بسازد. تصمیم همچنان در وب و execution در job مشترک است. [شاهد مسیر مشترک](evidence/project-migration-runners.md) اجرای تازه از میزبان MCP واقعی یا اختیار SQL روی provider نیست.

افزودهٔ آزمون داده، ۲۰۲۶-۱۰-۲۸: همان registry ابزار `propose_project_build` با `compatibilityDatabase.migration`، SQL منبع‌محور و معیار schema/seed/ماندگاری موقت را می‌پذیرد. مدل مسیرها را پیشنهاد می‌کند و host hash/role/image را می‌بندد؛ تصمیم در همان کارت وب و اجرا در CodeRepairJob موجود است. MCP ابزار SQL آزاد، credential، approval یا executor تازه ندارد. [شاهد](evidence/postgres-migration-test.md) از Agent/worker/UI مشترک است؛ اجرای تازه از یک میزبان MCP واقعی در این برش ادعا نمی‌شود.

افزودهٔ منابع، ۲۰۲۶-۱۰-۲۸: مأموریت انتشار MCP از همان registry و AgentRun می‌تواند به پیشنهاد `propose_database` برسد؛ schema این پیشنهاد فقط در وضعیت source/مقصد مناسب به مدل داده می‌شود. کارت تصمیم و credential binding در همان review وب انجام می‌شوند. هیچ tool عمومی برای دریافت password، ساخت بدون approval یا SQL اضافه نشده است. قطع/replay، بودجه و journal مشترک‌اند. [شاهد و حدود](evidence/managed-database.md).

افزودهٔ ۲۰۲۶-۱۰-۲۸: `read_publications` سابقهٔ موفق همان actor/account/team/internal-app را با cursor می‌خواند؛ سابقه اثبات نسخهٔ جاری یا سازگاری داده نیست. `launchlane_maintain` با grant مأموریت، `requestKey` پایدار و هدف نگهداری به همان AgentRun وب وصل می‌شود. مدل برای هدف صریح بازگردانی می‌تواند `propose_rollback` را انتخاب کند؛ archive دقیق با application موجود انتخاب و همان کارت تصمیم وب باز می‌شود. reconnect/replay و ثبت تکراری بودجه تازه نمی‌سازند و MCP هنوز approve/execute ندارد. مسیر وب همان `POST /api/agent/runs` با `operation=maintain` است. [شاهد و مرزهای مدل/provider](evidence/agent-rollback-maintenance.md).

افزودهٔ working tree در۲۰۲۶-۱۰-۲۵ و تکمیل ۲۰۲۶-۱۰-۲۸: `read_database_resources` از همان registry وب/Agent، با `view=inventory|capabilities|identity|quote` مشخصات و مؤلفه‌های قیمت دیتابیس حساب و تیم را فقط می‌خواند. `quote` یک ترکیب engine/version/plan/bundle را دوباره اعتبارسنجی می‌کند؛ total ترکیبی محاسبه نمی‌شود و price نامعلوم null می‌ماند. identity به شناسهٔ داخلی نیاز دارد؛ password/connection string/SQL/migration/provision خروجی یا عملیات آن نیست. RUNNING، فهرست خالی و catalog نسخه‌ها سلامت data plane را ثابت نمی‌کنند؛ completeness و network/version readback نامعلوم صریح‌اند. آزمون این delta مصنوعی است و هنوز به شاهد اتصال عمومی تاریخی زیر افزوده نشده است. `read_workload` با `assets=true` همان شاهد محدود CSS/JS هم‌مبدأ را از registry مشترک برمی‌گرداند؛ این خواندن فقط حضور فایل را می‌سنجد و اجرای JavaScript، مسیر کاربر یا وجود artifact را ثابت نمی‌کند.

[انتشار و آزمون واقعی HTTPS عمومی در۲۰۲۶-۱۰-۲۵](evidence/mcp-public-release-20261025.md) با نشست واقعی، grant خواندن، SDK HTTP/stdio، سیزده ابزار، سه call از Codex نصب‌شده، reconnect و revocation موفق شد. نسخهٔ عمومی اکنون این اصلاحات را دارد؛ grant آزمایشی پس از تست لغو شد. این شاهد شامل مأموریت پولی یا runtime واقعی Claude/OpenCode نیست.

[آزمون زنده Codex روی `fb67971`](evidence/codex-publication-mission.md) اکنون ثبت مأموریت با `launchlane_publish`، دریافت کارت تصمیم وب، دنبال‌کردن progress با `launchlane_mission`، قطع/وصل، رد ابزار خارج scope و تحویل نتیجه همان artifact/release را پوشش می‌دهد. این فراخوانی‌ها از client واقعی app-server/stdio میزبان با harness انجام شدند؛ turn مکالمه‌ای Codex و connector اجرایی Codex، Claude Code یا OpenCode از این شاهد نتیجه نمی‌شوند.

اتصال به نصب محلی یا نشانی ثابت HTTPS پشتیبانی می‌شود. وب‌اپ باید در حال اجرا باشد؛ bridge مالک SQLite، مدل یا موتور انتشار جدا نیست. دو مسیر «ایجنت کاربر→Launchlane از MCP» و «Launchlane→Coding Agent برای اصلاح» مستقل‌اند. این راهنما مسیر اول را توضیح می‌دهد؛ وجود اتصال MCP به معنی آماده‌بودن worker بیرونی نیست. [آزمون مستقل HTTPS و میزبان Codex در ۲۰۲۶-۱۰-۲۵](evidence/mcp-hosted-independent-20261025.md) شواهد این تغییر و محدودیت آزمون زنده را ثبت می‌کند.

## نصب و دسترسی

Node24.x طبق engines و lockfile لازم است. از checkout تمیز `npm ci`، `npm run setup:local` و `npm run build`، سپس `npm start` را اجرا کنید. پس از راه‌اندازی وب‌اپ:

```powershell
npm run setup:mcp
```

این فرمان ورود محلی را از `.env.local` می‌گیرد، token مخصوص MCP با دسترسی خواندن می‌سازد و در `.local/mcp-access.json` می‌نویسد. کلید را چاپ نمی‌کند و هیچ فایل تنظیمات میزبان را تغییر نمی‌دهد. اجازه ساخت/ادامه/لغو مأموریت اختیاری است و ممکن است مدل همان مأموریت را مصرف کند:

```powershell
npm run setup:mcp -- --missions --output .local/mcp-missions.json
```

برای نسخهٔ عمومی، وارد همان وب‌اپ شوید و «حساب‌ها ← اتصال MCP» را باز کنید. محدودهٔ خواندن یا مأموریت را انتخاب، دسترسی را بسازید و فایل را دانلود کنید. سپس در checkout نصب‌شده روی رایانهٔ میزبان اجرا کنید:

```powershell
npm run setup:mcp -- --from-file "$env:USERPROFILE\Downloads\launchlane-mcp-access.json" --origin https://launchlane-live-1023.liara.run --output .local/mcp-hosted.json
```

نشانی `--origin` را مستقلاً با نصب موردنظر تطبیق دهید؛ از نشانی داخل فایل ناشناس به‌عنوان مرجع اعتماد استفاده نکنید. در این مسیر `.env.local` یا کلید operator لازم نیست. setup با TLS معتبر، مذاکرهٔ SDK و `launchlane_context` نام سرور و scope واقعی را بررسی می‌کند و فقط پس از موفقیت فایل را می‌نویسد. تغییر دامنه، HTTP غیرمحلی، redirect، scope بالاتر و فایل منقضی رد می‌شوند. رمز ورود، کلید لیارا و raw token به تنظیم میزبان منتقل نمی‌شوند. در همین پنجره، «لغو همین دسترسی MCP» فایل صادرشده را در سرور بی‌اعتبار می‌کند.

فایل موجود overwrite نمی‌شود. token حداکثر یک ساعت و تا پایان نشست والد اعتبار دارد؛ پس از انقضا، فایل تازه با `--output .local/mcp-next.json` بسازید و مسیر config را تغییر دهید. renew خودکار و credential طولانی‌عمر در این برش پیاده نیست. فایل فقط زیر `.local` همین checkout پذیرفته می‌شود و باید با ACL خصوصی حساب اجراکننده نگه‌داری شود. raw token را در config، گفت‌وگو یا Git قرار ندهید.

## تنظیم میزبان‌ها

setup کنار فایل دسترسی، سه snippet با پسوندهای `.codex.toml`، `.claude.json` و `.opencode.json` می‌سازد. آن‌ها مسیر مطلق Node، bridge و فایل خصوصی، دامنهٔ دقیق و مهلت ابزار را دارند؛ raw token ندارند. فقط entry مربوط به Launchlane را با config موجود میزبان ادغام کنید. فایل موجود و تنظیمات کاربر overwrite نمی‌شوند. فرمان Node مستقیم است؛ اجرای `npm run` برای stdio ممکن است banner غیرپروتکلی بسازد. نمونهٔ زیر برای نصب محلی است؛ در HTTPS مقدار `LAUNCHLANE_MCP_ORIGIN` الزامی و برابر `--origin` است.

Codex، در config TOML موجود:

```toml
[mcp_servers.launchlane]
command = "node"
args = ["I:/Computer/dev/starcoach/launchlane/scripts/mcp-stdio.mjs"]
[mcp_servers.launchlane.env]
LAUNCHLANE_MCP_ACCESS_FILE = "I:/Computer/dev/starcoach/launchlane/.local/mcp-access.json"
LAUNCHLANE_MCP_ORIGIN = "http://127.0.0.1:3000"
```

Claude Code، entry در `mcpServers` پیکربندی موردنظر:

```json
{"mcpServers":{"launchlane":{"type":"stdio","command":"node","args":["I:/Computer/dev/starcoach/launchlane/scripts/mcp-stdio.mjs"],"env":{"LAUNCHLANE_MCP_ACCESS_FILE":"I:/Computer/dev/starcoach/launchlane/.local/mcp-access.json","LAUNCHLANE_MCP_ORIGIN":"http://127.0.0.1:3000"}}}}
```

OpenCode، entry در `mcp` پیکربندی موجود:

```json
{"mcp":{"launchlane":{"type":"local","command":["node","I:/Computer/dev/starcoach/launchlane/scripts/mcp-stdio.mjs"],"environment":{"LAUNCHLANE_MCP_ACCESS_FILE":"I:/Computer/dev/starcoach/launchlane/.local/mcp-access.json","LAUNCHLANE_MCP_ORIGIN":"http://127.0.0.1:3000"},"enabled":true,"timeout":150000}}}
```

شکل configها با [مستند Codex](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)، [مستند Claude Code](https://code.claude.com/docs/en/mcp) و [مستند OpenCode](https://opencode.ai/docs/mcp-servers/) تطبیق داده شده است؛ اجرای زنده دو میزبان آخر هنوز UNCONFIRMED است. برای Codex، CLI0.163.0-alpha.11.2 و app-server واقعی با snippet تولیدشده آزموده شدند. استفاده مستقیم HTTP/HTTPS در `/api/mcp` نیز SDK-tested است؛ header احراز هویت آن bearer همین token محدود است. stdio توصیهٔ این نصب است تا token در config میزبان کپی نشود.

## ابزار و مرز اختیار

`inspect_project` و ابزارهای `read_*` و catalog متناسب با gateهای نصب از registry واقعی وب می‌آیند. source ابتدا در خود Launchlane انتخاب می‌شود؛ این برش picker یا upload جدیدی در میزبان ندارد. read فایل فقط از manifest همان source ممکن است. raw env یا host shell در ابزارها وجود ندارد.

| ابزار | اثر و ادامه |
| --- | --- |
| `launchlane_context` | انتخاب فعلی، artifact و capabilityهای همان حساب مجاز؛ بدون مدل |
| `launchlane_mission` | run، decision/job/artifact و events بعد از cursor؛ صرفاً replay |
| `launchlane_publish` | ایجاد یا join مأموریت همان source/معیار؛ requestKey را پیش از ارسال نگه دارید |
| `launchlane_maintain` | نگهداری با هدف، requestKey پایدار و همان AgentRun؛ پیشنهاد بازگردانی به تصمیم وب می‌رسد |
| `launchlane_resume` | ادامه صریح انتشار یا نگهداری paused/interrupted با همان budget؛ تصمیم یا write نامعلوم را replay نمی‌کند |
| `launchlane_cancel` | توقف با revision فعلی؛ اثر پذیرفته‌شدهٔ provider را undo نمی‌کند |

چهار ابزار آخر فقط با grant مأموریت عرضه می‌شوند. schema و خطای دارای code/message/retryable/requestId از application می‌آیند. تصمیم لازم با `reviewUrl` در خود Launchlane انجام می‌شود؛ هیچ ابزار approve/execute از MCP عرضه نشده است. خواندن progress، بستن میزبان یا reconnect، کار تازه ایجاد نمی‌کند. مأموریت طولانی را با ID و cursor بخوانید؛ بستن transport، لغو مأموریت نیست. notification/task اختیاری میزبان پیش‌شرط این مسیر نیست.

وقتی مالک مأموریت درحال اجراست، read مستقیم registry با AGENT_BUSY رد می‌شود؛ progress را از `launchlane_mission` بخوانید. در مأموریت انتشار متوقف‌شده، read واقعی همان source از allowance پایدار همان run کم می‌کند و transport تازه بودجه را تمدید نمی‌کند. reserve پیش از provider/read ثبت می‌شود؛ دو درخواست هم‌زمان با یک سهم، فقط یک خواندن معتبر دارند. خواندن state/events مدل یا tool allowance مصرف نمی‌کند. schema ورودی publication و حد۲۴۰نویسهٔ نشانه از همان قرارداد وب می‌آیند.

لغو اتصال یا خروج از نشست والد، علاوه بر درخواست بعدی در خود مأموریتِ صف‌شده/فعال نیز بررسی می‌شود. اجرای صف‌شده با اختیار لغوشده مدل را شروع نمی‌کند؛ پاسخ دیررسِ درخواست ازقبل‌آغازشده پذیرفته نمی‌شود و مصرف آن پاک نمی‌شود. شروع مجدد یا token تازه، سقف مأموریت قبلی را تمدید نمی‌کند. در این حالت AUTH_REQUIRED و رسید همان run را پس از ورود دوباره بخوانید؛ دسترسی را با فایل تازه و تصمیم روشن آماده کنید.

## آزمون و رفع اشکال

پس از build، `node --test tests/http/mcp.test.mjs`، SDK رسمی HTTP/stdio، replay مشترک، deny، revocation، version/body limit و request ID را با وب‌اپ/SQLite واقعی و مدل مصنوعی می‌سنجد. `node --test tests/domain/mcp.test.ts` مرز امضای دسترسی، actor، انقضا و CAS را بررسی می‌کند.

`node --test tests/http/mcp-hosted.test.mjs` نسخهٔ production مستقل را پشت HTTPS محلی با گواهی موقت و اعتماد صریح CA اجرا می‌کند. OpenSSL نصب‌شده لازم است؛ مسیر جایگزین آن با `LAUNCHLANE_TEST_OPENSSL` تعیین می‌شود و چیزی دانلود نمی‌شود. SDK و فرایندهای CLI اعتبار TLS را بررسی می‌کنند؛ Chromium فقط SPKI همان گواهی آزمایشی را می‌پذیرد. صدور/دانلود/لغو واقعی UI، عدم افشای token در DOM/storage/config، عرض‌های۳۲۰/۱۲۸۰، axe و بازگشت فوکوس، عدم overwrite، انقضا، redirect و خروج طبیعی بررسی می‌شوند. Liara و حساب ورود مصنوعی‌اند؛ این آزمون شاهد ورود شخصی یا دامنهٔ عمومی نیست.

`npm run smoke:mcp:codex` opt-in و نیازمند Codex نصب‌شده است؛ یک server و home موقت بدون credential مدل ایجاد می‌کند، discovery و سه tool call را از app-server واقعی می‌سنجد و هیچ `turn/start` نمی‌فرستد. در صورت نبودن executable در PATH، `LAUNCHLANE_CODEX_PATH` را به همان فایل نصب‌شده بدهید؛ runner ابزاری دانلود نمی‌کند و config کاربر را نمی‌خواند یا overwrite نمی‌کند. این آزمون، job اصلاح کد نیست.

| نشانه | اقدام |
| --- | --- |
| خطای اتصال bridge | وب‌اپ باید فعال باشد؛ `--origin`، مقدار `LAUNCHLANE_MCP_ORIGIN` و دامنهٔ فایل باید دقیقاً یکی باشند؛ HTTPS فایل امضاشدهٔ نشست وب می‌خواهد |
| AUTH_REQUIRED | token/نشست والد منقضی یا لغو شده است؛ دوباره setup و مسیر فایل تازه |
| TOOL_DENIED | grant خواندن یا gate/registry آن ابزار را مجاز نمی‌کند؛ approval را با پیام جعل نکنید |
| AGENT_CONTEXT_CHANGED / PROJECT_CHANGED | انتخاب یا source تغییر کرده؛ مأموریت و تصمیم قدیمی به source تازه منتقل نمی‌شوند |
| AGENT_CONFLICT | revision فعلی را بخوانید؛ write را blind retry نکنید |
| نسخه پروتکل ناسازگار | client باید نسخه پذیرفته‌شده SDK را مذاکره کند؛ header ناسازگار رد می‌شود |
| میزبان بیرونی در دسترس نیست | این وضعیت اتصال اجرایی محسوب نمی‌شود؛ fallback پس از شروع job نامعلوم هنوز implementation جدا می‌خواهد |

پذیرش مأموریت انتشار از MCP روی دامنهٔ عمومی، OAuth اختصاصی MCP، انتخاب source از MCP، approve از میزبان، notifications/tasks پیشرفته، incident goal مستقل و پذیرش زنده Claude/OpenCode کارهای باز A16 هستند. اتصال خواندن عمومی با نشست واقعی و Codex در شاهد بالا تأیید شده است. جدول داخلی `mcp_connections` به‌تنهایی شاهد discovery یا اتصال فعال میزبان نیست؛ مسیر فایل حاضر بدون ادعای پایش میزبان کار می‌کند. جزئیات تصمیم در [ADR0017](decisions/0017-shared-mcp-facade.md) است.
