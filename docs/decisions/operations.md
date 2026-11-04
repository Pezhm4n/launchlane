# Operations — architecture decisions

[Documentation](../README.md) · [Current support](../platform-support.md) · [Verification index](../verification.md)

These versioned records preserve the original decisions, source revisions, failures and evidence limits. Dates and passing counts apply only to the named snapshot, not the current release. Installation-specific locations and identities are omitted.

## Records

- [0003 — هویت مقصد تازه از پاسخ create](#0003-provisioning-receipts)
- [Restart acceptance and same-page readback](#0003-restart-acceptance)
- [ADR0019 — Required private network with separate unknown-cost consent](#0019-required-private-network)
- [ADR 0023 — حذف پروژه و رسید توقف و حذف مقصد](#0023-project-removal-and-stop-receipts)
- [ADR0025 — انتشار بومی فایل‌های Static](#0025-native-static-publication)
- [ADR 0031 — Single Worker preparation and approved persistent storage](#0031-single-worker-sqlite-and-bound-storage)
- [ADR0046 — Publication-bound route observations](#0046-publication-bound-route-observations)

<a id="0003-provisioning-receipts"></a>

## 0003 — هویت مقصد تازه از پاسخ create

وضعیت: پذیرفته‌شده برای ساخت محدود Node. تاریخ: ۲۰۲۶-۱۰-۲۲.


<a id="0003-provisioning-receipts-مسئله"></a>

### مسئله

پروژه بدون app قبلی به ساخت مقصد نیاز دارد. نام app برای مالکیت و اجرای مراحل بعد کافی نیست؛ ممکن است از قبل موجود باشد یا پس از پاسخ گم‌شده دوباره دیده شود. مستند OpenAPI برای پاسخ موفق create schema نداشت. probe واقعی نشان داد `projectID`، ID داخلی 24-hex است و با GET همان app تطبیق دارد.


<a id="0003-provisioning-receipts-تصمیم"></a>

### تصمیم

ActionSpec v8 و journal مستقلِ stage، با همان policy/approval/application موجود استفاده می‌شوند. ورودی هزینه و منبع به approval بسته‌اند؛ قبل از claim از provider بازبینی می‌شوند. ID برگشتی قبل از هر خواندن بعدی پایدار و app تنها با همان ID و تنظیمات مصوب تأیید می‌شود. هم‌نامی به identity تبدیل نمی‌شود. در فقدان receipt، اثر uncertain و هر create متعارض مسدود می‌ماند؛ model یا recovery مجوز را تمدید نمی‌کنند.


<a id="0003-provisioning-receipts-پیامد-و-trade-off"></a>

### پیامد و trade-off

این سیاست می‌تواند پس از قطع شبکه به بررسی اپراتور نیاز داشته باشد، حتی اگر app ساخته شده باشد. در مقابل، عملیات duplicate یا انتخاب app دیگر از یک پاسخ نامعلوم ایجاد نمی‌شود. receipt دریافت‌شده که در journal ذخیره شده، در قطع بعدی قابل readback است. انتخاب خودکار فقط وقتی context منبع و انتخاب قبلی هنوز همان است انجام می‌شود؛ اطلاعات app ساخته‌شده بدون بازنویسی انتخاب تازه کاربر حفظ می‌شوند.

ساخت و انتشار دو اثر معنادارند. این برش برای ساخت approval جدا می‌گیرد و فایل‌ها را ارسال نمی‌کند؛ پیشنهاد انتشار بعدی همان source و ID تأییدشده را دوباره bind می‌کند. پوشش یک plan approval برای تمام مراحل، ساخت شبکه و انتقال secret هنوز نیازمند قرارداد جداست؛ با متن مدل یا نام یکسان فرض نمی‌شود.

در گفت‌وگو، ساخت موفق می‌تواند انتخاب مقصد را عوض کند؛ مقایسه کور context قدیمی، ادامه مجاز را هم stale می‌کرد. به همین دلیل host فقط تغییر ناشی از receipt پایدار همان action را می‌پذیرد و source/selection/account و ID مقصد را دوباره تطبیق می‌دهد. crash میان ذخیره receipt و ادامه گفتگو با همان proof بازیابی می‌شود؛ این استثنا اجازه بازنویسی انتخاب تازه کاربر یا انتشار بدون approval تازه نیست.

<a id="0003-restart-acceptance"></a>

## Restart acceptance and same-page readback

Status: implemented contract, 2026-10-22. Live restart remains unverified.

The pinned Liara OpenAPI describes HTTP 200 from
`POST /v1/projects/{name}/actions/restart` as submission acceptance, with no
operation ID or response body. Installed official CLI 9.4.7 sends that POST
without a body. Neither source establishes a completion event that Launchlane
can correlate to this request. A responding page may also have been served by
the old process while a restart was queued.

Use ActionSpec v6 for this operation. Bind approval to the operator, connected
account, team, internal app identity, current plan and READY release, incident
ID, evidence hash and exact approved page. No archive, upload, release creation,
plan change or environment change belongs to this action. Fresh HTTP error
evidence from the same page is required; latency and content correctness are
outside this readback contract.

Migration 7 adds a separate restart journal. The existing atomic claim persists
an attempt before `request_started`, which is persisted before the only POST.
Only HTTP 200 records `acceptedAt`; no fabricated release/operation ID is used.
Cancellation, unexpected status or lost response after the write boundary stays
uncertain. Recovery before `request_started` can establish that no send began;
recovery after it cannot. No automatic replay or write retry is supported.

Readback checks the same internal app, plan and current READY release before and
after a bounded, redirect-blocked page probe. Acceptance and a same-page 2xx may
finish the action as `succeeded`, meaning **the request was accepted and the page
responded**. UI and evidence must describe exactly that. This state does not
certify container replacement, every replica, application correctness or the
cause of recovery. A non-2xx response remains unhealthy; failed accepted checks
can be read again without sending another restart. Lost acceptance cannot become
success solely because a page responds; it keeps the conflict lock.

An alternative was to infer completion from HTTP 200, elapsed time, logs or an
unverified applet timestamp. That would manufacture causal evidence. Keeping
every acknowledged request permanently uncertain would discard the documented
acceptance and prevent ordinary follow-up work. The selected contract exposes
both its useful observations and its completion limit. Revisit it only after an
authorized live check establishes a provider completion marker and correlation
rule. Project/release reads are not an atomic provider transaction; external
changes between a preflight and POST remain a limitation.

Evidence: `tests/domain/restart.test.ts` uses synthetic transports and real
temporary SQLite; HTTP tests use an isolated production server with blank
provider keys. No new live request is implied by these checks.

<a id="0019-required-private-network"></a>

## ADR0019 — Required private network with separate unknown-cost consent

Status: implemented and bounded-live verified on `fb67971`; unused-network garbage collection pending. Date: 2026-10-23. The [correlated record](../evidence/agent.md#codex-publication-mission) supersedes the earlier pending-live state and preserves its failed attempts.

The bounded publication trial stopped before any model or provider write because the selected team's `GET /v1/networks` returned an empty list. An earlier preflight had observed an unused network. Liara documents automatic deletion of unused networks; that explains a possible cause, but the deletion event was not observed. Requiring an existing network forever would leave a fresh account unable to use publication.


<a id="0019-required-private-network-evidence-and-decision"></a>

### Evidence and decision

The [official private-network guide](https://docs.liara.ir/paas/details/private-network/) requires shared networks for private app/database access, describes network creation during resource setup and automatic deletion of unused networks. The [Node creation guide](https://docs.liara.ir/paas/nodejs/how-tos/create-app/) documents `liara network create`. The actually installed official CLI 9.4.7's `lib/commands/network/create.js` sends one `POST v1/networks` with `{networkName}`; its base network chooser fails when the list is empty. The pinned OpenAPI has no network-create entry. The CLI does not consume a returned ID, so Launchlane does not invent its response schema.

ActionSpec v13 authorizes one network for an exact actor, account/team, project selection, source archive, prospective app and optional host-owned parent run. A nonce in the host-generated network name correlates the later account-scoped read. No independent network tariff was found in the documented catalog: cost stays `unknown`, with null amount/currency/period. It is never shown or authorized as zero. Approval requires the explicit `acknowledgeUnknownCost` decision recorded in the same transaction and checked again at claim; generic legacy approvals and model prose cannot grant it. This is outside MissionPlan v1's existing-app publication authority.

Migration 12 only appends `network_progress`; migrations 1–11 and ActionSpec v1–v12 canonicalization remain intact. The existing action, session, attempt, audit and AgentRun stores own both transports. Web routes and the agent tool delegate to the same application functions. Stdio never owns SQLite writes.


<a id="0019-required-private-network-execution-and-recovery"></a>

### Execution and recovery

Preparation and preflight read the selected identity and require an empty network list. Existing networks are reused instead of creating extras. The durable stages are `claimed → request_started → accepted → created`. Acceptance is a successful HTTP response, independent of its body. A separate identity/list read must find exactly the nonce name before recording the actual provider ID and success. This is network configuration evidence, never application health or publication.

After a lost write response the stage remains `request_started` and uncertain; a coincident name alone does not prove acceptance. The request is never retried. An accepted but not-yet-visible network can be read again without creating another. Unresolved network writes block further network creation for the entire team even when a different future app name is supplied. Restart, expiry, source/account change and another session cannot renew authority. Agent review and resume retain the same run counters and limits. Network receipt continuation leads to a separately reviewed app/plan, then the existing publication program.


<a id="0019-required-private-network-limits"></a>

### Limits

The first implementation creates only a missing private network, not additional networks, a network migration, a database or arbitrary resource changes. Existing apps cannot change networks through this path. The provider has no documented create idempotency key or authoritative lost-response query; an uncertain request without an accepted receipt requires operator reconciliation. Unused-network cleanup follows the documented provider lifecycle; no undocumented delete endpoint is assumed. Network pricing remains unknown until authoritative information is available. Local/synthetic transport tests do not establish live API availability or billing.

<a id="0023-project-removal-and-stop-receipts"></a>

## ADR 0023 — حذف پروژه و رسید توقف و حذف مقصد

وضعیت: implemented؛ حدود شاهد زنده در [گزارش آزمون](../evidence/interface.md#project-removal-and-env-response).


<a id="0023-project-removal-and-stop-receipts-تصمیم"></a>

### تصمیم

حذف از «پروژه‌های من» با حذف زیرساخت دو اثر متفاوت دارد. نسخهٔ بدون اثر ابری پس از تأیید صریح از فهرست کنار می‌رود. migration17 یک tombstone با actor، session، source hash و زمان می‌سازد؛ FKها، source، آزمون‌ها و journal دست‌نخورده می‌مانند. بازکردن یا فعال‌کردن نسخهٔ حذف‌شده رد می‌شود. حذف نسخهٔ غیرفعال، تصمیم پروژهٔ دیگر را لغو نمی‌کند.

سابقهٔ deploy ناموفق نیز می‌تواند مقصد واقعی و هزینه داشته باشد. خانوادهٔ source و repair با receiptها بررسی می‌شود؛ وجود attempt مرتبط تا تأیید حذف همان هویت، حذف از فهرست را می‌بندد. نبود شناسهٔ قطعی مقصد، به معنای نبود منبع نیست و وضعیت blocked می‌ماند. منابع مشترک مانند شبکه، دیسک و دیتابیس با حذف این سابقه پاک نمی‌شوند.

ActionSpec v14 دو اثر `stop_app` و `delete_app` را به actor، نشست تأیید، حساب، تیم، app ID، پروژه، source/selection hash، پلن، request key و expiry می‌بندد. canonicalization نسخه‌های1–13 تغییر نمی‌کند. همان Store.decide/claim، attempts، audit و کنترل conflict وب به کار می‌روند؛ engine تأیید تازه‌ای ساخته نشده است. migration17 فقط جدول receipt و tombstone را اضافه می‌کند؛ migration16 زیرساخت قبلی connection grant است و تاریخچهٔ آن تغییر نمی‌کند.

توقف از [مسیر رسمی CLI](https://github.com/liara-cloud/cli/blob/master/src/commands/app/stop.ts)، `POST /v1/projects/{name}/actions/scale` با `scale=0` استفاده می‌کند. حذف از [مسیر رسمی حذف](https://github.com/liara-cloud/cli/blob/master/src/commands/app/delete.ts) استفاده می‌کند؛ پاسخ200 یا204 فقط پذیرش است. قبل از حذف، هویت/پلن و scale صفر دوباره خوانده می‌شوند. مجوز حذف جداست و حذف نسخه‌ها و تنظیمات همان مقصد را توضیح می‌دهد؛ خاموش‌شدن یا پایان همهٔ هزینه‌ها وعده داده نمی‌شود.


<a id="0023-project-removal-and-stop-receipts-تفکیک-شاهد-توقف"></a>

### تفکیک شاهد توقف

در آزمون زنده، GET app مقدار scale صفر را برگرداند ولی endpoint applets همین حساب پاسخ500 داد؛ status برنامه همچنان ACTIVE بود. بنابراین status یا خطای applets نمی‌تواند شاهد «نبود نمونه» باشد. قرارداد receipt سه نوع بررسی دارد:

- `instances_absent`: هویت دقیق، scale صفر و فهرست معتبرِ خالی؛ نبود نمونه تأیید شده است.
- `configuration`: هویت دقیق و scale صفر، همراه404/500 از endpoint نمونه‌ها؛ فقط ثبت توقف در تنظیمات تأیید شده و UI خاموشی کامل را UNCONFIRMED اعلام می‌کند.
- `destination_absent`: GET مقصد پس از درخواست حذف404 داده است.

خواندن ناموفق هویت،401/429، شبکه، جایگزینی app ID یا فهرست غیرخالی به موفقیت تبدیل نمی‌شوند. این محدودیت مشاهده‌پذیری مانع تأیید جداگانهٔ حذفِ برنامه با scale صفر نمی‌شود؛ اختیار حذف خودِ همان مقصد را پوشش می‌دهد. اوراکل اولیهٔ «توقف فقط با applets خالی» در candidate29 به‌درستی inconclusive ماند؛ نتیجهٔ قدیمی سبز بازنویسی نشده است. قرارداد دقیق‌تر، تأیید control-plane را از نبود workload جدا می‌کند.


<a id="0023-project-removal-and-stop-receipts-بازیابی-و-محدودیتها"></a>

### بازیابی و محدودیت‌ها

قبل از write، claim و سپس request_started ثبت می‌شوند. timeout/پاسخ گم‌شده uncertain می‌ماند؛ observe فقط می‌خواند و هرگز write را دوباره اجرا نمی‌کند. حذف موفق، allowlist همان app ID و انتخاب مقصد را اصلاح و اختیارهای استفاده‌نشده را باطل می‌کند. عملیات نامعلوم و worker بیرونی نامعلوم مانع پنهان‌کردن پروژه می‌شوند.

این تصمیم حذف حساب، شبکه، دیسک یا دیتابیس، بازگردانی برنامهٔ حذف‌شده، یا توقف قطعی همهٔ هزینه‌ها را پیاده نمی‌کند. محدودیت readback applets و race با تغییر هم‌زمان از ابزار بیرونی همچنان واقعی‌اند؛ API لیارا برای write شرط اتمیک If-Match در این مسیر اثبات نشده است.

<a id="0025-native-static-publication"></a>

## ADR0025 — انتشار بومی فایل‌های Static

تاریخ: ۲۰۲۶-۱۰-۲۳. وضعیت: implemented؛ [شاهد بومی Login](../evidence/runtime.md#native-static-login) با مرز API-create و Agent-publication تأیید شد؛ repair عمومی و Agent-create زنده بازند.


<a id="0025-native-static-publication-مسئله-و-مسیر"></a>

### مسئله و مسیر

پروژهٔ واقعی `<owner-provided-static-project>`، HTML/CSS/JavaScript مرورگر است؛ package/start یا runtime Node ندارد. پیشنهاد مقصد قبلی با PROJECT_INCOMPLETE رد شد و مدل با سؤال Static یا Node و port، allowance را مصرف کرد. محدودیت مقصد Node/Python باید در implementation برطرف شود، نه به کاربر عادی منتقل شود.

پلتفرم بومی Static لیارا، با پورت80 و Nginx مدیریت‌شده، مسیر انتخابی است. [مستند رسمی](https://docs.liara.ir/paas/static/getting-started/) و [port CLI](https://github.com/liara-cloud/cli/blob/master/src/utils/get-port.ts)، به‌همراه [deploy CLI](https://github.com/liara-cloud/cli/blob/master/src/commands/deploy.ts) در تاریخ تصمیم بررسی شدند. release از `type=static` و `platformConfig={}` استفاده می‌کند؛ نسخهٔ زبان اختراع نمی‌شود. wrapper Node یا Docker worker، شاهد انتشار بومی Static نیست و این تصمیم از آن‌ها استفاده نمی‌کند.

در inspect بدون اجرای script، وجود سند HTML معتبر در index.html، نبود manifest/فایل سرورِ متعارض و وجود assetهای محلی بررسی می‌شود. JS با dependency سروری/bare import شناخته‌شده برای انتشار خام رد می‌شود؛ این بررسی parser کامل مرورگر یا اثبات موفقیت همهٔ generatorها نیست. منبع دارای package/build باید مسیر build خودش را طی کند. مسیر زیرپوشه از انتخاب منبع موجود می‌آید. فایل‌های IDE کنار credential/cache کنار گذاشته می‌شوند. capture و archive همان فایل‌های اصلی است و هیچ فایل اجرایی ساخته یا اصل پوشه تغییر داده نمی‌شود.


<a id="0025-native-static-publication-قرارداد-و-اختیار"></a>

### قرارداد و اختیار

ActionSpec v15، انتشار Static را به actor، account/team/app ID، source/selection/artifact، port80، WorkloadContract و پلن متصل می‌کند. v16، ساخت مقصد Static را با همان catalog/cost/network و previous destination قراردادهای پیشین عرضه می‌کند. پارس و decode تاریخی v1–v14 و hashهایشان حفظ می‌شوند. journal، claim، idempotency، readback و جلوگیری از retry نتیجهٔ نامعلوم همان سرویس‌ها هستند؛ schema JSON فعلی migration تازه لازم ندارد.

فایل‌های plain Static فرمان نصب/build/start کاربر ندارند؛ نبود این فرمان‌ها به سؤال فنی یا job ساخت Node تبدیل نمی‌شود. در مأموریت Static ابزارهای ساخت/اصلاح Node نمایش داده نمی‌شوند. پیش از انتشار، همان artifact و معیار پاسخ یک تصمیم صریح دارند؛ مجوز build یا اصلاح Node به Static منتقل نمی‌شود. این برش، دامنهٔ برنامهٔ artifact مشتق یا repair عمومی Static را کامل اعلام نمی‌کند. هزینهٔ ساخت مقصد همچنان تصمیم جدا و واقعی دارد.

موفقیت به current release و پاسخ همان صفحه وابسته است. HTML200 کافی نیست: برای پروژهٔ واقعی باید CSS/JS، رفتار DOM، console و موبایل هم بررسی شوند. CDN بیرونی، API ورود واقعی یا ثبت‌نام از فرم ظاهری استنتاج نمی‌شود. وضعیت Nginx/نسخهٔ مدیریت‌شدهٔ provider از مقدار ساختگی پر نمی‌شود.


<a id="0025-native-static-publication-حلقه-خطا-و-سابقه"></a>

### حلقهٔ خطا و سابقه

علت شکست و قدم بعدی از error ساخت‌یافتهٔ correlated در AgentView عرضه می‌شوند؛ message آزاد اثبات شکست/موفقیت نیست و تاریخچه برای backfill بازنویسی نمی‌شود. runtime ساختِ واقعاً ناموجود و اقدام بدون پیشرفت، پیش از سؤال/تکرار تازه متوقف می‌شوند؛ کلید تکرار از canonical arguments ساخته می‌شود. این توقف مانع خرج بی‌اثر است و جای پیاده‌سازی نسخه‌های دیگر نیست. رفع Node24 و خانواده‌های دیگر در همان ماتریس الزامی باز می‌مانند.

پوشهٔ مفقود مانع بازکردن سابقه برای مدیریت ID-bound مقصد نمی‌شود. record به unavailable می‌رود و approvalهای وابسته نامعتبر می‌شوند؛ انتشار همچنان به inspect/source معتبر نیاز دارد. حذف از فهرست، وجود یا نتیجهٔ نامعلوم منبع ابری را پنهان نمی‌کند؛ مسیر توقف/حذف قبلی حفظ می‌شود.

<a id="0031-single-worker-sqlite-and-bound-storage"></a>

## ADR 0031 — Single Worker preparation and approved persistent storage

Status: implemented server and Agent boundary with isolated Qadam and synthetic Agent/UI evidence; public storage acceptance remains open.


<a id="0031-single-worker-sqlite-and-bound-storage-context"></a>

### Context

Qadam contains a React/Vite frontend and one Hono Worker with one D1 binding, nine SQL migration files and private runtime environment inputs. Publishing its frontend alone loses authentication, synchronization, calendar and data. Running its Worker against an ephemeral filesystem loses writes when the process is replaced. The original repository and its Cloudflare database must remain untouched.


<a id="0031-single-worker-sqlite-and-bound-storage-decision"></a>

### Decision

Preparation supports a deliberately narrow source shape: one Hono Worker, one D1 binding, one Vite SPA asset binding, an existing npm lock and migration directory. Static inspection never runs project scripts. A reviewed repair workspace receives four fixed, content-verified adapter files, Node 24 configuration, build and start commands. Dependency versions, application code, original test scripts and migration bytes remain unchanged. The actual sandbox builds both frontend and backend, executes the existing tests and probes independent API criteria before assembling immutable compiled output.

The fixed Node adapter implements the observed `prepare/bind/first/all/run/batch` SQL surface using `node:sqlite`. Repeated numbered parameters retain their binding semantics. Batches and migrations use savepoints. The migration ledger binds full filenames and checksums, including distinct files with the same numeric prefix. Populated databases without the ledger, changed applied migrations, unsupported transaction/storage directives and invalid bindings fail closed. This is not a complete Cloudflare D1 emulator, a data migration service, replicated sessions or a general Worker runtime.

Private source environment references allow an isolated build before a destination exists. They bind actor, source lineage, key names and a keyed fingerprint over encrypted imported values. Values enter the approved sandbox through stdin and do not enter its source archive. They do not pretend that cloud configuration has been applied. Publication still requires a succeeded v9 configuration readback for the same values and destination.

ActionSpec v25 creates exactly one 1 GB disk for a fresh, empty, product-created Node destination for this exact artifact. It binds actor, account, team, app object ID, plan/bundle, source and selection, unique disk name, existing inventory, available capacity and a short-lived catalog fingerprint. The current slice refuses existing disks, mounts, reserved storage and a plan change. It does not resize a resource or quote invented extra capacity. The base application cost remains governed by its destination approval.

Migration 18 appends a disk progress table without rewriting migrations 1–17. Approval is single-use and session-bound. Claim and request-start records commit before the sole POST. A missing response stays uncertain; only identity-scoped readback may resolve it. A claimed journal without a send can resolve as not started. Generic healthy receipts cannot confirm a disk. The inventory endpoint uses the provider app object ID, as confirmed by a bounded read-only account check; the create endpoint follows the pinned API and official CLI name-based request.

ActionSpec v26 extends compiled fullstack publication with the succeeded v25 disk identity and `/data` mount. Proposal, preflight, the boundary after source upload and final observation check the exact disk. The release request includes only that mount. READY, correct HTML, API and compiled proof cannot confirm an unexpected/missing mount. A failed read remains inconclusive and never authorizes replay. Historical action canonicalization remains unchanged.


<a id="0031-single-worker-sqlite-and-bound-storage-alternatives-and-limits"></a>

### Alternatives and limits

Copying the original D1 data was rejected because it changes the privacy and migration scope. Serving just the frontend was rejected because it omits required behavior. A separate database service adds an unneeded service and a new SQL compatibility boundary for this application. The bounded SQLite adapter preserves the application's observed SQL and permits a dedicated persistent disk, while explicitly retaining unsupported D1 features as gaps.

The Qadam sandbox checks and full container replacement establish isolated application compatibility with new synthetic data. They do not prove native Node 24 release behavior, provider disk permissions, Liara restart persistence or the hosted Agent loop. The same application service is available through a source-scoped `propose_disk` Agent tool and the publication review card. Optional read-only chat cannot obtain that tool. Parent run identity, decisions, claim, cancellation and recovery share the existing budget and journal. MCP missions use that same driver and registry; live MCP storage acceptance remains unverified. No live disk or Qadam destination was created for this evidence.

Documentary references: [Liara Node version selection](https://raw.githubusercontent.com/liara-cloud/docs/master/src/pages/paas/nodejs/how-tos/choose-version.mdx), [official CLI 9.6.0 disk creation](https://github.com/liara-cloud/cli/blob/v9.6.0/src/commands/disk/create.ts), [official CLI release request](https://github.com/liara-cloud/cli/blob/v9.6.0/src/commands/deploy.ts). Actual account fields and configured limits still require fresh readback at approval and execution.

See [measured Qadam evidence](../evidence/corpus.md#qadam-worker-storage-20261026).

<a id="0046-publication-bound-route-observations"></a>

## ADR0046 — Publication-bound route observations

Date: 2026-10-29. Status: implemented with bounded local application/Agent/browser/MCP evidence; public-runtime acceptance remains open.

A current HTTP200 and a READY release do not prove the requested application behavior. The existing read_workload tool already owns approved-origin probing, DNS/SSRF protection, bounded redirects, redaction, budgets and optional asset reads. The existing publication record already binds actor/account/team/internal app, source archive and the provider's accepted source/release receipts. Reuse these boundaries instead of adding another tool registry, approval or execution engine.

The same read_workload accepts the optional pair publicationActionId/checks. With neither, its historical single-page behavior is unchanged. With both, the application requires an accepted publication receipt and matching attempt, checks the stored archive bytes and original source hash, preserves its original primary path/assertion and evaluates one to eight explicit unique JSON API paths. The existing nested-field parser/oracle is reused; JSON MIME, status and every field expectation must match. Redaction placeholders cannot serve as expected data, including in the stored primary criterion; unrelated redacted fields do not invalidate public assertions. Optional same-origin CSS/JS presence uses the existing asset checker. Values and response bodies are not returned in this receipt.

read_releases adds the nullable sourceComparison.recordedActionId only after its existing unique accepted source/release/attempt correlation succeeds for a workload-compatible publication. Unknown, ambiguous and historical unsupported records return null. This additive field permits observation even in a data-context tool set that omits read_publications, and covers an accepted release whose workload failed. It grants no additional authority and leaves the comparison's existing unverified fields intact.

Account, team, selected app, internal app identity and approved origin are checked. Fresh provider reads before and after the workload require that exact release to be current and READY; a newer READY list item is never substituted. Missing or changed release evidence stays inconclusive. Wrong body/status/MIME or an asset failure stays a mismatch. Each network/local-archive read consumes the original run budget, and replay only reads persisted run events. No ActionSpec, SQLite migration, provider write, publication journal update or refreshed allowance is added.

The known minimum is six reads plus the number of API paths; insufficient remaining allowance fails before transport. Optional HTML references consume more. A standalone MCP read keeps its historical per-call allowance, so the schema maximum of eight paths does not promise eight paths within every configured budget. A maintenance run retains its original cumulative limits; the service never starts one or renews it implicitly.

This contract records correlation to an accepted publication, with a verified saved archive. It deliberately leaves runtimeContent/runtimeConfiguration unverified and publicationVerified false. Provider fences cannot attest every running byte, make the sequence atomic, detect a complete A-to-B-to-A transition between reads or prove public routing switched immediately. They also do not execute browser JavaScript or authenticate a user, write application data, verify persistence, run workers/schedulers or close a runtime family. Such effects require their own artifact-bound workload contracts and the data lane's interfaces. Existing compiled-publication proof/asset observations remain separate and unchanged.

The host adds a plain scope/outcome notice to the existing Agent steps. Web and MCP share the same schema, application and Store. A model-selected expectation remains an explicit observation criterion, never deployment authority; the stored publication's original criterion cannot be replaced to obtain a green result. See [evidence](../evidence/operations.md#publication-routes).
