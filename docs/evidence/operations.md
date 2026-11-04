# Operations — verification evidence

[Documentation](../README.md) · [Current support](../platform-support.md) · [Verification index](../verification.md)

These versioned records preserve the original decisions, source revisions, failures and evidence limits. Dates and passing counts apply only to the named snapshot, not the current release. Installation-specific locations and identities are omitted.

## Records

- [آزمون واقعی انتشار و اصلاح یک برنامه Node](#controlled-live-cycle)
- [Destination choice, assistant integration and stopped missions — 2026-10-23](#destination-choice-and-resume)
- [ساخت مقصد با receipt داخلی](#destination-provisioning)
- [ارزیابی واقعی Agent — ۲۰۲۶-۱۰-۲۲](#live-qa-2026-10-22)
- [علت و اقدام بعدی خطای سرویس](#provider-failures)
- [Publication-bound route observations — 2026-10-29](#publication-routes)
- [Required private network — A05 / AC21 / AC23](#required-private-network)
- [انتشار v5 و restart واقعی با بررسی همان صفحه](#restart-live-cycle)
- [تثبیت و تحویل candidate49 — ۲۰۲۶-۱۰-۲۳](#stabilization-candidate49)
- [Primary checkout integration — 2026-11-04](#worktree-integration)

<a id="controlled-live-cycle"></a>

## آزمون واقعی انتشار و اصلاح یک برنامه Node

در ۲۰۲۶-۱۰-۲۲، Launchlane سه نسخه از یک برنامه آزمایشی را روی Liara منتشر کرد. نسخه دارای مشکل، خطای واقعی 500 داد؛ تشخیص مدل به شواهد همان برنامه ارجاع داد. تغییر نامرتبط مشکل را حفظ کرد و اصلاح کد، پاسخ همان صفحه را به 200 با revision مورد انتظار رساند. برنامه پس از آزمون حذف شد. این گزارش شاهد محدود همین سناریو است.


<a id="controlled-live-cycle-محیط-و-مرز-آزمون"></a>

### محیط و مرز آزمون

سرور Launchlane روی loopback، با Node 24.18.0 و build تولیدی اجرا شد. برنامه آزمایشی دو فایل، بدون dependency، با Node 22 پیش‌فرض Liara داشت. پلن `small-g2` و بسته `basic` از پاسخ واقعی حساب انتخاب شدند. حساب و تیم با API تطبیق داده شدند؛ نام یا شناسه حساب، credential، محیط خصوصی و archive در این گزارش نیستند.

ساخت برنامه و شبکه لازم، کار harness خصوصی اپراتور با مجوز محدود و journal پایدار بود؛ قابلیت ساخت app/network در محصول ادعا نمی‌شود. مراحل انتخاب پروژه، آماده‌سازی archive، پیشنهاد v4، تصمیم، اجرا، مشاهده، جمع‌آوری و تحلیل از API تولیدی Launchlane گذشتند. provider و DNS/socket در این بخش واقعی بودند. مرور دستی رابط و بازیابی نتیجه با مرورگر واقعی انجام شد؛ suiteهای خودکار بخش جدا و بدون حساب واقعی‌اند.

اصلاح کد را Coding Agent آماده کرد. مدل داخل محصول کد را تغییر نداد و متغیر محیطی ننوشت؛ فرضیه و بررسی پیشنهادی ارائه کرد. هر انتشار، proposal و approval مستقل با همان actor، مقصد، archive و معیار پاسخ داشت.


<a id="controlled-live-cycle-انتظار-مستقل-و-نتیجه-مشاهدهشده"></a>

### انتظار مستقل و نتیجه مشاهده‌شده

قبل از تحلیل، علت کنترل‌شده و خروجی درست/غلط مشخص شدند: نبود `WELCOME_MESSAGE` در نسخه بدون مقدار پیش‌فرض باید `/` را 500 کند. دست‌کاری `/healthz` نباید آن را برطرف کند. مقدار پیش‌فرض غیرمحرمانه در کد نسخه اصلاح‌شده باید `/` را با revision تازه، 200 کند. پاسخ liveness به‌تنهایی شاهد رفع مشکل نیست.

| نسخه | تغییر | انتظار | مشاهده واقعی |
| --- | --- | --- | --- |
| `live-v2` | نیاز به تنظیم خوشامد، بدون مقدار پیش‌فرض | خطای 500 در `/`؛ liveness مستقل | release ابتدا BUILDING و سپس READY/current؛ probe اولیه 503 و بعد همان صفحه 500/CONFIG_REQUIRED با همین revision؛ `/healthz` پاسخ 200 |
| `live-v2-wrong` | تغییر نامرتبط در پاسخ healthz | خطای `/` باقی بماند | release تازه READY/current؛ `/` همچنان 500 با revision جدید؛ مقایسه همان گزارش `still_failing` |
| `live-v3` | مقدار پیش‌فرض مشخص و غیرمحرمانه در کد | پاسخ 200 و revision تازه در همان `/` | release تازه READY/current؛ status و JSON revision دقیق، سپس بازخوانی project/release؛ action=`succeeded` و مقایسه همان گزارش `verified` |

مقایسه از همان incident، app identity، origin، path و ترتیب زمان استفاده کرد. موفقیت فقط همین مشاهده و صفحه را پوشش می‌دهد؛ سلامت همه مسیرها یا علت عمومی تغییر را اثبات نمی‌کند. digest دو متغیر پیش‌فرض `PORT` و `NODE_ENV` بین نسخه دوم و سوم ثابت بود؛ حفظ secretها یا merge/replace انواع دیگر env از آن نتیجه نمی‌شود.


<a id="controlled-live-cycle-تشخیص-واقعی-مدل-و-مصرف"></a>

### تشخیص واقعی مدل و مصرف

مدل درخواستی `gpt-6-luna` با `reasoning_effort=none`، روی Chat Completions و تنها میزبان BoxAPI بود. دو درخواست، ابزار خواندن snapshot و پاسخ نهایی را کامل کردند. مدل به HTTP 500، نام تنظیمات و log تازه `CONFIG_REQUIRED/WELCOME_MESSAGE` ارجاع داد؛ مشکل پیکربندی را فرضیه دانست و ادعای اصلاح یا کمبود منابع نکرد. ارزیابی معنایی با علت ازپیش‌مشخص سناریو تطبیق داده شد؛ صرف JSON یا citation معتبر، oracle نبود.

| درخواست | پاسخ | توکن ورودی | توکن خروجی | مجموع | مدت transport محلی |
| --- | --- | --- | --- | --- | --- |
| خواندن ابزار | 200/tool call | 385 | 23 | 408 | 2387 ms |
| نتیجه نهایی | 200/terminal | 1034 | 211 | 1245 | 3253 ms |

مجموع گزارش‌شده 1653 توکن و زمان endpoint تحلیل 5754 ms بود. فیلد `usage.cost` مجموع `0.0004459413` گزارش کرد؛ واحد و تطبیق با صورتحساب حساب مستقلاً بررسی نشد. routing مدل بومی پشت gateway در این trace ثبت نشده است. هیچ درخواست مدل، retry یا fallback دیگری در این چرخه اجرا نشد. این یک case واقعی پیکربندی است؛ کیفیت مدل در موارد ناکافی، متناقض، تزریق دستور یا مسائل دیگر هنوز با مدل واقعی سنجیده نشده است.


<a id="controlled-live-cycle-شکستهایی-که-آزمون-واقعی-آشکار-کرد"></a>

### شکست‌هایی که آزمون واقعی آشکار کرد

- `team.teamName` با fixture قبلی `team.name` فرق داشت. regression پاک‌سازی‌شده ابتدا شکست خورد و parser اصلاح شد.
- source receipt نام فایل با پسوند `.tar.gz` بود. validation قبلی آن را رد می‌کرد؛ receipt مشترک در transport، journal و بازیابی اصلاح شد. شناسه release همچنان validation مستقل دارد.
- سه attempt پیش از اصلاح receipt در مرحله upload متوقف شدند. هر سه approval مصرف‌شده و بدون replay باقی ماندند. journal ثابت کرد درخواست release شروع نشده است؛ وضعیت احتمالی source یتیم معلوم فرض نشد. `not_started` پس از readback این توقف را از release با رسید گم‌شده جدا کرد.
- v1 logs با ISO since رد شد. قرارداد CLI رسمی 9.4.7، v2 با start بر حسب ثانیه و tuple نانوثانیه/JSON است؛ parser محدود همان قرارداد اکنون پیام کنترل‌شده را می‌خواند. زمان event و واحد metric از آن استنتاج نمی‌شوند.
- events واقعی ردیف lifecycle داشت. applets پاسخ 500 داد و unavailable باقی ماند؛ CPU/RAM خام به مصرف صفر یا کمبود منابع تبدیل نشدند.
- اولین snapshot پس از درخواست تازه، log خالی داشت؛ پس از نمایان‌شدن پیام در منبع، snapshot تازه تحلیل شد. empty اولیه به شاهد ساختگی تبدیل نشد.
- پاسخ اولیه ناموفق سایت پس از READY، فقط پیشنهاد تازه داشت. اکنون همان receipt قابل بازخوانی است؛ 200 با revision غلط همچنان شکست می‌ماند و هیچ write تازه‌ای از آن ایجاد نمی‌شود.


<a id="controlled-live-cycle-revision-و-اعتبار-شواهد"></a>

### revision و اعتبار شواهد

رفع ناسازگاری‌ها مرحله‌ای بود: نام تیم در `7c8c988`، توقف پیش از release در `635198d`، source receipt در `fffea88` و logs/lifecycle در `bf276b1`. تحلیل مدل روی `bf276b1` انجام شد؛ prompt/provider code بعد از آن تغییر نکرد. اجرای بازخوانی و نسخه‌های بعدی روی working tree همان اصلاحی بود که در `869035a` ثبت شد. تغییرهای نهایی capability/report صرفاً متن وضعیت را هم‌سطح کردند؛ برای آن‌ها مصرف مدل یا چرخه زنده تکرار نشد. زمان‌ها به همان اجراها تعلق دارند و مقایسه عملکرد دو candidate نیستند.

بررسی candidate شامل domain تازه 81/81، HTTP تازه 15/15، lint/typecheck/build و browser تازه 55 حالت در 9 عرض به‌علاوه 19 حالت انتشار در 4 عرض بود. providerهای suite خودکار مصنوعی‌اند. در حالت‌های سنجیده‌شده overflow، axe violation، خطای مرورگر و درخواست خارجی ثبت نشد. گزارش واقعی ذخیره‌شده نیز پس از حذف برنامه، با همه gateها خاموش، در عرض‌های 360/768/1280 دستی دیده شد؛ این مشاهده تاریخی، تماس تازه با Liara یا اجرای دوباره تحلیل نیست. screen reader، کاربر تازه و تأیید کامل WCAG سنجیده نشده‌اند.


<a id="controlled-live-cycle-پاکسازی-و-محدودیتهای-باز"></a>

### پاک‌سازی و محدودیت‌های باز

در مجموع سه POST release اجرا شد. شش attempt بارگذاری وجود داشت؛ status نخستین attempt قبل از ثبت transport trace نگهداری نشده است و پنج مورد بعدی 200 ثبت کردند. دو درخواست ساخت بدون شبکه رد شدند؛ ساخت پس از انتخاب شبکه انجام شد. هیچ write خودکار تکرار نشد. منابع/پلن، برنامه‌های دیگر یا تیم دیگری تغییر نکردند.

برنامه پس از حدود 29 دقیقه با همان شناسه داخلی حذف شد؛ فهرست API و پنل رسمی نبود آن را تأیید کردند. اختلاف موجودی ثبت‌شده تا زمان حذف حدود 1145.8 تومان بود، پایین‌تر از سقف مجاز؛ تأخیر ثبت صورتحساب ممکن است. شبکه خالی آزمون باقی است؛ CLI و جریان رسمی بررسی‌شده امکان حذف آن نشان ندادند و endpoint حدسی استفاده نشد. پاک‌شدن همه sourceهای موقت در سمت provider مستقلاً بررسی نشده است.

اتصال محلی refresh شد و app انتخابی/فهرست مجاز خالی شدند. gateهای واقعی نصب خاموش‌اند. SQLite شش attempt دارد، پنج failed و یک succeeded؛ executing/observing/uncertain/approved باز باقی نماند. migrationهای 1/2 با backup اولیه تطبیق داشتند و 3 تا 6 به روش موجود اعمال شدند. credential رمز‌شده است؛ کلید provider در SQLite یا فایل tracked پیدا نشد. هیچ push یا تغییر visibility انجام نشد.

نصب مستقل از کلون محلی تمیزِ 869035a، بدون env/DB/context خصوصی، با npm ci و setup/lint/type/build/domain81/HTTP15/bootstrap2 گذشت. ورود با کلید تازه و workspace خصوصی نیز 200 دادند؛ provider keys خالی و gateها خاموش بودند. clone مستقیم GitHub و بازبین تازه سنجیده نشدند. جزئیات فرمان‌ها در [verification](../verification.md) است.

پیش از گسترش استفاده، این موارد بازند: انتقال نسخه Node موردنیاز پروژه به `platformConfig`، قیمت/پیشنهاد پلن داخل محصول، restart، env/secret reference، GitHub با grant و دریافت واقعی و review با ورودی تازه. این آزمون، استقرار عمومی خود Launchlane نبود.

<a id="destination-choice-and-resume"></a>

## Destination choice, assistant integration and stopped missions — 2026-10-23

The bounded implementation covers A05/AC20/AC23 and A08/AC24. It does not complete all-platform publication. [ADR0021](../decisions/agent.md#0021-destination-choice-and-resume) records the policy and migration; the following candidate checks are distinct from provider evidence.


<a id="destination-choice-and-resume-expected-behavior-fixed-before-execution"></a>

### Expected behavior, fixed before execution

- An empty connected account can review a destination and actual available plan prices inside Launchlane. App creation still requires the exact cost/scope decision.
- Changing the plan cancels old consent atomically, preserves the parent and consumes only the required catalog/network/absence reads. The same selection, refresh and opening/closing the assistant consume no model or infrastructure write.
- The assistant answers current price questions through the common catalog/quote application. Its explicit publication control displays the same live review panel. There is one mission and one copy of each decision card.
- A stopped mission resumes the same source, workload, allowance and usage after its owner exits. Uncertain provider/external execution blocks continuation. A competing run or decision remains blocked.
- Revoked programs retain their historical step/artifact receipts; a successor needs a new exact decision. Migration from populated v14 preserves bytes, hashes and foreign keys.


<a id="destination-choice-and-resume-observed-manual-work-comparison"></a>

### Observed manual-work comparison

| Existing user task | Launchlane behavior in this slice | Automated part | Essential decision | Evidence boundary |
| --- | --- | --- | --- | --- |
| Select/create the PaaS app in the provider console | Empty-account destination proposal inside the publication flow | Account-scoped catalog/network reads, source-bound review and identity-bound create application | Destination name, actual price and cost permission | Creation has prior controlled live evidence; this candidate's changed selection is browser/contract evidence until its separate live receipt |
| Compare plan names and prices | Source summary, low-cost starting option and priced alternatives | Fresh available offers and exact hourly unit; unknown prices excluded | Select an offer; capacity remains unmeasured | Domain plus real browser against a synthetic catalog |
| Repeat the decision after changing a plan | Server revokes the old proposal and returns a fresh one | Transaction/CAS, quote/source binding and old-consent rejection | Approve the newly selected cost | Domain race and browser HTTP application path |
| Recreate work after pressing stop | Continue the same mission | Preserved ID/source/usage, revoked unattempted consent, journal checks | A fresh program decision when prior consent was revoked | Domain, including another pending owner and unknown external dispatch |
| Move between assistant and publication | The same panel moves between the two views | Same callbacks, action/run and persisted progress | Meaningful cost/program decisions only | Browser plan change in assistant, close, refresh and one-run assertion |

No time or click savings were measured. This table makes no numerical savings claim.


<a id="destination-choice-and-resume-candidate-and-checks"></a>

### Candidate and checks

Candidate15 is a frozen index export on base `086c5d1`, tree `1748e8eb2a007dcf1b110fbaeb80162356db6982`; 310 runtime/test/config files match digest `09fb5e59246cf00144fb71789650ebb235a17c278c29b0f5205623581eb7a214` after text line-ending normalization. Concurrent unstaged UI changes are excluded. Build, typecheck and lint passed, with 35 warnings/9 infos and zero lint errors.

The new plan browser runner passed 12 states at widths320/390/768/1280, with native radio keyboard selection, server-side replacement, an empty account, assistant/main shared view, refresh,200% text, zero axe violations in tested states, no page errors and no external browser requests. Model/provider writes were disabled; this is not live pricing or cloud execution. Baseline images were captured on candidate10 in a fresh browser profile. Candidate15 mobile and desktop images were inspected; real device/screen reader/user walkthrough remains unconfirmed.

Candidate15 additionally passed351 domain,38HTTP,54 guided browser states and4 related actual-container cases. Candidate14 independently passed351 domain and38HTTP tests. Its first assistant layout passed axe/overflow but failed visual inspection; its guided suite also caught optional chat overlapping secure environment entry. The layout/host geometry and secure-entry block were fixed before candidate15. Candidate12's guided process ended with Windows status `-1073741819` and no output; its cause is unknown. These results are not merged into a fresh candidate15 full pass.

Candidate16 added the authoritative current decision state after historical model messages and the explicit cancellation receipt. It passed351 domain/38HTTP/12 plan browser states and the real Codex-to-Liara cycle in [the live report](agent.md#codex-product-publication). Its guided suite failed before the missing-account oracle: the synthetic model hook assumed the last protocol message must be user/tool and tried to decode the new system message as a tool result. The hook now selects the last non-system conversation message; the original missing-account, secret-entry, cancellation and workload assertions are unchanged.

Final regression candidate17, tree `539a91ac44b9934cc328dbbd0d9d1d5762d4087e`, contains that fixture correction and identical application source to live candidate16. Its310 runtime/test/config files match digest `68cb4787fdae81228d0eaebf02f2b922c0e48b82369c0ad48fb74dafcd54a0ed`. A fresh build/typecheck/lint,351 domain,38HTTP,12 plan browser states,54 guided states and4 related actual-container cases all passed on this export. Container cases cover ineffective-patch rejection, a raw dependency-free build, pre-dispatch fallback and lost external response without parallel internal work. Patch model/cloud transports in these four tests are synthetic. The broader browser aggregate is recorded separately after completion; these counts are not an all-runtime full pass.

The candidate17 aggregate `test:browser` passed the workbench75, deployment27, restart27, domain22 and guided54-state suites, then failed starting the destination suite's isolated production server: `ECONNREFUSED`, empty captured server output. Its cause is unconfirmed. A separate destination rerun passed5 states; that rerun does not turn the aggregate into a full pass. No test deadline or concurrency was changed to label the cause fixed.

The subsequent studio check found a real regression at200% text: verbose new mode buttons consumed reading space. Short visible labels with full accessible names fixed it on candidate18, which passed43 studio and12 plan states. Its independent chat audit then measured396.1px of reading space in a619px panel at width768, below the existing65% reading-area criterion. The new shell gap was reduced from the existing spacing3 token to spacing1 to remove that overhead. The criterion and assertions were retained.

Candidate19 is **invalid as feature acceptance**. Concurrent UI commit `6083088` changed the shared index during snapshot preparation; the candidate lacked the new plan runner and package command, despite its unrelated studio/chat checks passing. Its outputs are retained but do not verify the new controls. Subsequent exports use a separately captured immutable tree/private index, and validate both file membership and bytes against that tree. The committed UI work is preserved in the next combined candidate; it is not staged or claimed as this feature's work.

The valid combined candidate20 passed351domain/38HTTP and13chat states, but initially failed studio contrast. A diagnostic studio rerun passed43states; the separate plans audit reproduced an empty-account contrast failure (axe measured2.33:1). Candidate21 removed reduced-motion dialog fades, then exposed the same issue after moving publication back into the main panel: its reduced-motion panel entrance still faded text. Reduced-motion dialogs, backdrops and panel entrances now settle immediately; normal-motion interactions are preserved. This explains the observed animation-related failures; the earlier isolated-server/timeouts remain separately unconfirmed.

Candidate22 is a new immutable-tree export on `6083088`, tree `fdbdef9e7d3248d2d137225bea6ebb4402635e76`,312runtime/test/config files, normalized digest `7df371d8e94f337af994dc17a42cb564eb939f18ea4ca5246345ec67794e8734`, zero mismatches. Its fresh production build and12plan/43studio/13chat states passed. These counts are candidate-specific; candidate20 domain/HTTP results are not relabeled as a fresh candidate22 full pass. No provider/model live request was added by these regressions.


<a id="destination-choice-and-resume-preserved-failures"></a>

### Preserved failures

Candidate11 first failed one of349 domain tests because the SSR test loader could not load a nested TSX/CSS-module import. The loader now recursively transpiles the trusted component imports and maps actual CSS class names; the original Node/Python render assertions were retained. Candidate13 lint caught a non-semantic group element; it was corrected before candidate14. Neither failure was hidden by changing an application oracle.

The original live product attempt on candidate10 consumed5 model calls/23040 tokens, proposed executable build before destination and stopped before consent, Codex execution or a cloud write. The source/run remain intact. The first continuation on candidate12 failed `AGENT_BUSY` before another model or cloud request: the idle check treated the same paused owner as a competing mission. The regression reproduces the five-call/23040-token owner, confirms another pending decision still blocks, and then resumes that exact owner without renewing its allowance. This was corrected on candidate14/15. A new run is not the recovery mechanism.

<a id="destination-provisioning"></a>

## ساخت مقصد با receipt داخلی

تاریخ: ۲۰۲۶-۱۰-۲۲. بخش application در `2c335e6` روی main ثبت شد. دامنه فعلی: پروژه Node آماده، پلن ایران و شبکه موجود همان تیم. ساخت شبکه و env هنوز پشتیبانی نمی‌شوند. انتشار از همان application موجود و با تصمیم جدا استفاده می‌کند.


<a id="destination-provisioning-اجرا-و-مجوز"></a>

### اجرا و مجوز

ActionSpec v8، عملیات `create_app` را به actor/session، حساب/تیم، نام مصوب، انتخاب قبلی، Node، snapshot پروژه و archive، network ID، plan/bundle و برآورد پایه متصل می‌کند. قیمت و availability پیش از claim دوباره خوانده می‌شوند. source عوض‌شده، قیمت یا شبکه تازه، اعتبار ناکافی و نام موجود، create نمی‌سازند.

همان `Store`، `executeApproved`، session/CSRF، scope، audit و RunBudget استفاده می‌شوند. migration 9 فقط جدول journal ساخت را اضافه می‌کند؛ نسخه‌ها و checksumهای 1–8 تغییر نکرده‌اند. stage پیش از POST ثبت می‌شود. پاسخ واقعی create فیلد `projectID` دارد؛ این ID داخلی پیش از readback ذخیره می‌شود. انتخاب app فقط پس از تطبیق همین ID، platform، plan، bundle، network و read-only setting انجام می‌شود. این وضعیت، سلامت سایت یا اجرای Node را اثبات نمی‌کند.

اگر پاسخ create گم شود، stage بدون receipt، uncertain باقی می‌ماند؛ برنامه هم‌نام adopt و POST تکرار نمی‌شود. اگر receipt ثبت شده ولی ذخیره action قطع شده باشد، readback همان ID می‌تواند نتیجه را بازیابی کند. تغییر انتخاب کاربر پس از ارسال، با انتخاب خودکار مقصد تازه بازنویسی نمی‌شود.


<a id="destination-provisioning-شاهد-واقعی"></a>

### شاهد واقعی

شکل پاسخ create با دو app کوتاه‌عمر تطبیق داده شد: `{projectID}` یک شناسه داخلی 24-hex بود و با GET همان app برابر شد. این spikeها مدل، env write یا deployment نداشتند و منابعشان حذف و نبودشان تأیید شد.

سپس خود application محصول، نه فقط harness مستقیم، با API واقعی اجرا شد: options حساب، پیشنهاد v8، تصمیم صریح روی hash، claim، یک POST create، ذخیره ID، readback تنظیمات و انتخاب همان ID در اتصال. یازده tool call در همان budget مشترک مصرف شد. تلاش اجرای مجدد هیچ write تازه‌ای نساخت. app پس از تطبیق ID توسط harness پاک و GET 404 آن تأیید شد. source script، env write، model call و deployment در این چرخه صفر بودند. gateهای نصب اصلی تغییر نکردند.

regressionهای application شامل مهاجرت، price/network/credit/source تغییرکرده، نام موجود، response گم‌شده، شکست SQLite پس از receipt، same-name replacement، تغییر انتخاب و race هستند. ثبات fingerprint با تغییر ترتیب کلیدهای catalog هم آزموده شد. مجموعه کامل domain در مرحله application برابر 208/208 و HTTP20/20 بود؛ lint/typecheck/build گذشتند. شواهد خام و هزینه حساب فقط در محل ignored آزمون نگهداری می‌شوند.


<a id="destination-provisioning-اتصال-گفتوگو"></a>

### اتصال گفت‌وگو

registry مشترک اکنون `read_networks` و `propose_destination` دارد. ابزار نخست خودکار و read-only است؛ دومی فقط proposal v8 می‌سازد. کارت در همان گفت‌وگو نام، موقعیت، نرخ پایه تومان در ساعت، هزینه‌های محاسبه‌نشده و ظرفیت اندازه‌گیری‌نشده را نشان می‌دهد. decision و queued شدن run در همان transaction ثبت می‌شوند. قطع پیش از claim، approval صف‌شده را لغو می‌کند. قطع پس از create فقط receipt را می‌خواند و write را تکرار نمی‌کند.

host فقط از receipt موفق و ID دقیق، تغییر context ناشی از ساخت را می‌پذیرد. تغییر مستقل source/account/selection باعث توقف ادامه می‌شود. اثر `destination_created` از انتشار موفق جداست. برای هدف انتشار، مدل پس از این receipt ابزار بعدی را انتخاب می‌کند و proposal v7 باید همان archive و ID تازه را bind کند. ساخت به‌تنهایی run را completed نمی‌کند. رد پیشنهاد منقضی یا context عوض‌شده فقط authority را حذف می‌کند و مجوز تازه‌ای نمی‌سازد.

اگر readback همان app، `defaultSubdomain: true` برگرداند، host نشانی اولیه `https://<app>.liara.run` را محلی ثبت می‌کند. این قالب با [راهنمای رسمی ساخت Node لیارا](https://github.com/liara-cloud/docs/blob/master/src/pages/paas/nodejs/how-tos/create-app.mdx) تطبیق داده شد. flag غایب/false، نشانی مدل یا یک app هم‌نام برای این کار کافی نیست. مقصد probe در approval انتشار جداگانه bind می‌شود و حفاظت DNS/SSRF همان probe موجود پابرجاست.

هفت regression Agent، زنجیره ساخت→proposal انتشار→تصمیم جدا→بررسی workload را با transport مصنوعی، atomic decision، انقضا/تغییر context، پاسخ گم‌شده، قطع میان receipt و adoption، انتخاب همزمان کاربر و gateهای خاموش می‌سنجند. مجموعه کامل تازه domain215/215 روی main و lint/typecheck گذشتند. build و HTTP21/21 روی snapshot مستقل working tree سنجیده شدند. تست جدید مرورگر پنج حالت در 360/768/1280 را بدون overflow یا violation ثبت‌شده axe گذراند و تصویرها بازبینی شدند؛ proposal مصنوعی و تمام writeهای provider خاموش بودند. artifact: `.artifacts/destination-ui/2026-10-22T10-00-24.404Z` داخل export محلی. این شواهد هنوز چرخه جدید create→publication از وب با مدل/provider واقعی نیستند.


<a id="destination-provisioning-چرخه-واقعی-وب-3cbf206"></a>

### چرخه واقعی وب؛ 3cbf206

یک export ثابت از commit `3cbf206` build و در سرور loopback با state، workspace، نشست و allowlist مستقل اجرا شد. نصب اصلی و بازآرایی UI در main ادامه داشتند. fixture تازه `inventory-site`، Node 22 انتخاب‌شده، یک HTML معمولی و API summary داشت؛ endpoint مصنوعی revision اضافه نشد. نبود app آزمایشی پیش از شروع با 404 بررسی شد. اتصال حساب از API محلی احرازشده انجام شد؛ انتخاب پوشه، هدف فارسی و هر دو تصمیم در خود مرورگر بودند.

مدل واقعی هفت درخواست داد و بر اساس نتایج، inspect، catalog، destination، networks، quote و proposal ساخت را انتخاب کرد. کارت نرخ پایه واقعی 1041.66 تومان در ساعت را نشان داد. پس از تصمیم در وب، خود application یک create انجام داد و همان ID/config را تأیید و انتخاب کرد. مدل از receipt ساخت به `propose_publication` رسید. proposal v7 به همان archive مصوب v8 و ID برگشتی برابر بود؛ هیچ upload یا release پیش از تصمیم دوم انجام نشد.

پس از تصمیم انتشار، فقط یک upload و یک release انجام شدند. READY به‌تنهایی پذیرفته نشد: پاسخ عمومی ابتدا 503 بود و journal چند PROBE_TIMEOUT داشت. readback محدود همان action ادامه یافت و بدون تغییر oracle یا ارسال تازه، صفحه اصلی با status200 و متن `Inventory overview is ready` تأیید شد. یک خواندن مستقل عمومی هم همین پاسخ را گرفت. run به completed/remote_changes_verified رسید؛ هفت model call، 22,343 reported token، 39 tool call و حدود 279 ثانیه زمان فعال ثبت شد. readback دستی صفر بود. این شاهد واقعی، رفتار warmup را که پیش‌تر فقط regression داشت نیز برای همین مورد محدود تأیید می‌کند؛ علت تمام timeoutها یا سلامت سایر صفحات از آن نتیجه نمی‌شود.

reload همان نتیجه را بازیابی کرد و model/write تازه‌ای نساخت. journal مشترک PaaS در پایان یک create، یک upload، یک release، یک DELETE پاک‌سازی و 40 GET داشت؛ GETهای setup/diagnostic هم در آن هستند و این عدد تمام HTTPهای probe/model نیست. app با همان ID ثبت‌شده حذف و نبودش با 404 تأیید شد. سرور موقت متوقف و gateهای نصب اصلی خاموش ماندند. شبکه تازه، env write و اجرای source script محلی صفر بودند. در خواندن تشخیصی همزمان، applets داده معتبر نداد؛ از آن ظرفیت یا علت قطعی استنتاج نشد. خطای اولیه harness قبل از انتظار برای پایان login، با صفر مدل و صفر write، جدا حفظ و اصلاح شد.

تصویرهای proposal و نتیجه در 360 و1280 ذخیره و بازبینی شدند: `.artifacts/provision-web-live/`. source، state، credentials و ledger هزینه فقط در `.local/agent-mission/provision-web-cycle` ignored هستند. مصرف ارز یا invoice از تعداد token فرض نشده است؛ guard تجمعی قبلی و ذخیره هزینه نامعلوم اولیه حفظ شدند.


<a id="destination-provisioning-api-و-کار-باز"></a>

### API و کار باز

- `POST /api/destinations` با `operation: options`، catalog و شبکه‌های موجود را با session/CSRF می‌خواند.
- `operation: propose` به projectId، app، planId، bundleId و networkId معتبر نیاز دارد و فقط Action می‌سازد.
- `GET /api/destinations/[id]` فقط state پایدار را می‌خواند.
- POST همان ID با decision/hash، execute یا observe، به‌ترتیب تصمیم، یک اجرای claim‌شده یا readback همان receipt را انجام می‌دهد. هیچ spec دلخواه یا نقش model از client پذیرفته نمی‌شود.

چرخه ساخت→انتشار از گفت‌وگو برای همین Node/پلن ایران/شبکه موجود تأیید شد؛ env، شبکه تازه، چند runtime و پروژه نامرتبط هنوز بازند. بودجه برآورد پایه، invoice یا پوشش هزینه‌های جانبی نیست. ظرفیت پروژه benchmark نشده است. انتقال migration به نصب در حال اجرا restart واقعی خواست؛ guard HMR ابتدا RUNTIME_RESTART_REQUIRED داد و سرور main با حفظ state بازراه‌اندازی شد. HMR قرارداد Store را خودکار باز نمی‌کند.

<a id="live-qa-2026-10-22"></a>

## ارزیابی واقعی Agent — ۲۰۲۶-۱۰-۲۲

نتیجه: پذیرش کامل Agent، استقرار کامل ترب و چرخهٔ تازهٔ «تشخیص → اصلاح → انتشار مجدد» تأیید نمی‌شوند. چند خطای واقعی اصلاح شده‌اند؛ پاسخ مدل، موفقیت HTTP و نتیجهٔ کسب‌وکاری جدا ارزیابی شدند.


<a id="live-qa-2026-10-22-نسخه-و-شرایط"></a>

### نسخه و شرایط

پایه 802685e بود. اصلاح‌ها در e6fe795 و 41e5080 روی main ثبت شدند. محتوای نسخهٔ تولیدی ایزولهٔ آزمون در پایان با هر **۲۴۱ فایل tracked کامیت 41e5080** برابر بود. Node 24.18.0، Next 16.4.2 و lockfile همین نسخه استفاده شدند. تغییرات باز و هم‌زمان Agent دیگر در این تأیید نیستند.

کلیدهای واقعی از Environment نصب خوانده شدند؛ state، پورت و browser context جدا بودند. در مسیرهای live، مدل و Liara با fixture جایگزین نشدند. VPN و تنظیمات سراسری شبکه تغییر نکردند؛ bypass فقط برای socketهای میزبان‌های مشخص آزمون بود. relay اختصاصی چرخه پس از پایان متوقف شد.

گراف قدیمی، فایل‌های جدید Agent را پوشش نمی‌داد؛ ادعاهای مؤثر با source دقیق، caller، contract و اجرا بررسی شدند. نبودن در گراف، شاهد نبود قابلیت تلقی نشد.


<a id="live-qa-2026-10-22-شمارش-شواهد"></a>

### شمارش شواهد

| دسته | تعداد و نتیجه | مرز ادعا |
| --- | --- | --- |
| درخواست واقعی مدل در این فاز | **۶۲ پاسخ واقعی، ۲۰۶٬۱۹۹ توکن گزارش‌شده** | تعداد درخواست، نه تعداد تست یا جمعیت کاربران |
| اجرای سناریو با مدل | **۲۷ run** و ۲ پیام ادامهٔ مکالمه | شامل baseline، تکرار و بازآزمایی |
| baseline مکالمه | ۵ از ۵ run ناموفق | پایان پاسخ بدون receipt ابزار، در host رد شد |
| ماتریس مکالمه پس از اصلاح نخست | **۱۳ موفق، ۱ ناموفق از ۱۴ سناریو** | پاسخ خارج از حوزه هنوز نامناسب بود |
| regression هدفمند scope | **۳ از ۳ موفق** | سلام، رفع ابهام و خارج از حوزه؛ یک ماتریس تازهٔ ۱۴/۱۴ نیست |
| HTTP نهایی با تنظیمات واقعی | **۳۷ از ۳۷ موفق** | بدون درخواست مدل؛ اتصال و catalog واقعی Liara |
| مرورگر با مدل واقعی | **۱۲ از ۱۲ بررسی، ۲ درخواست مدل** | پیش از آخرین تغییر پیام راهنمای mission؛ پنج عرض نمایش |
| احراز هویت منفی واقعی | Liara بدون credential: **401** | outage یا rate limit واقعی عمداً ایجاد نشد |
| domain نهایی | **۲۶۶ از ۲۶۶، بدون skip** | providerها عمدتاً قراردادی/مصنوعی؛ benchmark مدل نیست |
| lint / typecheck / build | موفق | lint دارای ۳۰ warning و یک info قبلی؛ فایل‌های تغییرکرده lint تمیز |
| استقرار ترب | **ناموفق/تأییدنشده** | پشتیبانی runtime و بستهٔ داده کافی نیست |
| چرخهٔ ابری کنترل‌شده | مقصد و release واقعی؛ workload به‌درستی رد شد | patch و انتشار مجدد تمام نشد |

HTTP سه بار اجرا شد: ۳۵/۳۷، سپس ۳۷/۳۷ و در پایان ۳۷/۳۷. یکی از دو failure اول، انتظار اشتباه harness دربارهٔ نام error code بود؛ باگ محصول شمرده نشد. این تکرارها تعداد سناریوهای مستقل را افزایش نمی‌دهند.


<a id="live-qa-2026-10-22-انتظار-معنایی-و-اصلاحها"></a>

### انتظار معنایی و اصلاح‌ها

ورودی‌ها در [بانک سناریو](../../tests/eval/agent-live-cases.json) هستند. oracle پیش از خروجی تعیین شد؛ پاسخ، رسید ابزار، context، side effect و پرسش بعدی بررسی شدند. HTTP 200 یا JSON معتبر به‌تنهایی pass نبود. از داور مدل برای ساختن یک امتیاز ظاهراً دقیق استفاده نشد.

پوشش: سلام رسمی و خودمانی، غلط تایپی، فاصله‌گذاری و Unicode، درخواست چندبخشی، ابهام، context، تکرار، تغییر خواسته، موضوع نامرتبط، فقدان داده، فشار برای ساختن URL/نتیجهٔ انتشار، افشای کلید و انتشار بدون تأیید. برای Node/start/port، پاسخ با فایل و inspect تطبیق داده شد. نمونه واقعاً Node24 و پورت 3000 بود؛ انتظار اولیهٔ Node22 از fixture قدیمی اشتباه بود و پیش از grading اصلاح شد.

| مشکل | Root cause | Fix و شاهد |
| --- | --- | --- |
| سلام/رفع ابهام به خطای فنی تبدیل می‌شد | شرط عمومی پایان run برای conversation هم receipt ابزار می‌خواست | معافیت فقط کانال read-only؛ completed و write از متن مدل حاصل نمی‌شوند. مدل واقعی و agent-conversation regression گذشتند |
| پیام فقط فاصله run خالی می‌ساخت | text پیش از trim اعتبارسنجی می‌شد؛ application ورودی خالی حاصل را نمی‌گرفت | create و continuation پیش از persistence نرمال و بررسی می‌شوند؛ HTTP و Unicode-whitespace regression گذشتند |
| چت کار خارج از حوزه انجام می‌داد | scope پاسخ اختیاری روشن نبود | محدوده صریح شد؛ همان ورودی واقعی به توضیح محدوده تبدیل شد |
| README ترب مانع انتخاب می‌شد | نمونهٔ صریح YOUR_* به‌عنوان credential واقعی تشخیص داده می‌شد | استثنای محدود فقط در source؛ exact secret، suffix، Bearer و credential URL همچنان مسدود؛ log redaction محافظه‌کار ماند |
| mission گاهی به‌جای کارت سؤال تأیید می‌پرسید | مدل proposal را با اعطای مجوز یکی می‌گرفت | راهنمای proposal/تصمیم host تفکیک شد؛ اجرای تازه واقعاً کارت ساخت و سپس کارت انتشار تولید کرد. تضمین همهٔ wordingها نیست |

function calling درخواست ابزار مدل را از اجرای ابزار در application جدا می‌کند؛ تصمیم و receipt در host می‌مانند. [مستند رسمی](https://developers.openai.com/api/docs/guides/function-calling)


<a id="live-qa-2026-10-22-شاهد-انتشار-واقعی"></a>

### شاهد انتشار واقعی

این workload یک fixture کنترل‌شدهٔ تازهٔ Node22 بود و جای ترب محسوب نمی‌شود. تابع فاکتور عمداً quantity را نادیده می‌گرفت. معیار مستقل: **17×3 + 8×0 + 11×2 = 73**.

مقصد launchlane-sre-qa-1022 ابتدا وجود نداشت. ساخت با proposal، تصمیم server-validated و readback همان app ID انجام شد. انتشار تصمیم جدا، archive ثبت‌شده و معیار ثابت /total داشت.

- نشانی زمان آزمون: <deployment-origin>
- release ID: <resource-id>
- وضعیت Liara: READY
- پاسخ مستقل واقعی: HTTP 200 و {"total":36,"case":"qa-20261022"}
- انتظار: total برابر 73
- policy: **WORKLOAD_MISMATCH** و action ناموفق؛ سلامت یا انتشار تأییدشده اعلام نشد.

harness ابتدا زودتر از پنجرهٔ گرم‌شدن محصول timeout شد؛ این ایراد harness بود. زمان انتظار اصلاح و همان state با ورود تازه و فقط publication-observe ادامه داده شد. journal نهایی دو attempt دارد: یک create_app و یک deploy؛ ایجاد و انتشار تکرار نشد. این، بازیابی محدود readback را می‌سنجد و اثبات همهٔ crashها نیست.

پس از mismatch، مدل read_workload و دو فایل مرتبط را خواند. قفل تجمعی بودجهٔ مصوب، پیش از درخواست بعدی و قبل از شبکه متوقف کرد. جزئیات حساب و مالی خصوصی‌اند. علت با همان guard بازتولید شد و تعداد درخواست‌ها ثابت ماند.

خطای application، MODEL_TRANSPORT بود؛ guard خصوصی transport wrapper است. در این مورد outage مدل یا مشکل VPN اثبات نشده است. **patch، artifact اصلاح‌شده و انتشار مجدد در این چرخه سنجیده نشدند.**

در پایان، تنها app همین آزمایش با تطبیق شناسه حذف و نبودش با پاسخ مستقل 404 تأیید شد. نشانی فوق اکنون سرویس فعال نیست.


<a id="live-qa-2026-10-22-ترب-و-مرز-پذیرش"></a>

### ترب و مرز پذیرش

Fact: پروژه Backend پایتون/FastAPI، UI در apps/web و SQLite محلی با اندازهٔ 410,488,832 بایت دارد. root فاقد package.json و Node start است. پس از اصلاح template، انتخاب واقعی source گذشت و inspect، runtime=unknown و نبود start/port را گزارش کرد.

Fact: capture و deployment این نسخه برای Node هستند؛ py در allowlist source نیست و .local/SQLite کنار گذاشته می‌شوند. قرارداد runtime پایتون، دادهٔ بزرگ و انتشار کامل workload این پروژه اثبات نشده‌اند. انتخاب فقط apps/web، استقرار کامل ترب نیست.

structured publication ترب با سقف محلی شش فراخوانی، پس از inspect و پنج read فایل با BUDGET_EXHAUSTED پایان یافت. این نتیجه به تنظیم پیش‌فرض ۱۶ فراخوانی تعمیم داده نمی‌شود؛ مرز runtime و داده از source مستقل روشن است. app یا release برای ترب ساخته نشد.

Inference: پیش از پذیرش ترب، محصول به قرارداد runtime مناسب، بسته‌بندی production API/UI، انتقال امن snapshot واقعی و آزمون API با همان داده نیاز دارد. افزایش سقف prompt این مرزهای اجرایی را پیاده نمی‌کند.


<a id="live-qa-2026-10-22-ریسکهای-باقیمانده"></a>

### ریسک‌های باقی‌مانده

- ترب، چرخهٔ تازهٔ patch→artifact→انتشار مجدد و پشتیبانی عمومی dependency/build پذیرفته نیستند.
- بار هزاران کاربر یا نرخ موفقیت عمومی مدل اندازه‌گیری نشده است. 429/5xx واقعی و همهٔ حالت‌های قطع اتصال سنجیده نشدند؛ fixture جای آن را نمی‌گیرد.
- GitHub واقعی و مخزن خصوصی جدید در این فاز اجرا نشدند.
- پنج عرض نمایش، focus و refresh سنجیده شدند؛ screen reader انسانی و همهٔ states رابط موازی باز هستند.
- تغییرات Agent دیگر حفظ شدند و در این دو commit وارد نشدند. پس از تثبیت آن‌ها integration/browser regression تازه لازم است.

شواهد کامل در مسیر ignored .local/live-eval-20261022/ باقی‌اند: results/model-audit، semantic-review، final-tree-identity، HTTP نهایی، تصاویر browser، journal-summary، independent-before-repair، recovery/cleanup و budget-stop-proof. پاسخ خام، credential، archive و state به Git اضافه نشدند.

تست‌های تازهٔ agent-conversation.test.ts و source-placeholders.test.ts بدون مصرف مدل اجرا می‌شوند. اجرای provider تازه باید دفتر تجمعی همان مأموریت را رعایت کند؛ این گزارش مجوز مصرف تازه ایجاد نمی‌کند.

<a id="provider-failures"></a>

## علت و اقدام بعدی خطای سرویس

پایه401abfc و تغییر محدود httpFailure/failureNextStep:402 با PROVIDER_PAYMENT_REQUIRED،409 با PROVIDER_CONFLICT و413 با PROVIDER_REQUEST_TOO_LARGE از خطای عمومی جدا شدند. 409 به تعارض نام محدود نیست. قرارداد401/403،429،5xx حفظ شد؛ body خام مصرف/نمایش داده نمی‌شود. پیام بعدی، پرداخت و دسترسی و شبکه را از نیاز به اصلاح کد جدا می‌کند.

سه suite هدفمند provider-failures/providers/liara-read،۱۸/۱۸ پاس؛ lint همین سه فایل بدون diagnostic و diff-check پاس. transport مصنوعی در مدل/read/write برای هر status فقط یک بار صدا زده شد، body حذف و retryable به replay تبدیل نشد؛ مدل یا Liara زنده مصرف نشد. این نتیجه full regression candidate نیست. executeApproved خطای پس از claim را همچنان UPSTREAM_UNCERTAIN می‌کند؛ تعیین تکلیف journal/readback پیش از هر write تازه لازم است.

<a id="publication-routes"></a>

## Publication-bound route observations — 2026-10-29

Path B, worktree runtime-components; preceding commit d312350cf355292485fb34774a598e71c799a092. Main checkout, production state and corpus projects are outside mutation scope. No real model consumption, infrastructure write or database SQL is authorized or performed by this slice.

The existing read_workload registry is extended with publicationActionId and checks. The application verifies accepted action/attempt/source/release correlation and the archived bytes before evaluating the unchanged primary criterion and explicit nested JSON API expectations. Existing origin/DNS/redirect/timeout/budget and asset behavior is reused. A host-owned notice is persisted through the existing AgentRun and rendered in its steps. It never changes a publication journal or creates an approval.


<a id="publication-routes-verification-scope"></a>

### Verification scope

Domain tests use the real Store/action/attempt transitions, archive reader, application, Agent transport and probe validators with controlled synthetic provider/model/DNS/TLS/workload ports. They cover original-page plus two nested JSON routes and an asset; wrong/missing values, logged-out state, redirect, HTML fallback, arrays, changed/unready/missing releases, app/account changes, altered archive/attempt, invalid/duplicate/oversized paths, private DNS, budget exhaustion, stale/future/foreign probe receipts and replay without authority renewal.

The browser harness uses disposable state and the actual application/Agent to produce and persist its observations. A real isolated production server serves authenticated HTTP/reload and the unchanged step UI. Provider, DNS/TLS, workload and model ports for those observations are synthetic; the server's live gates remain off. MCP SDK schema discovery and denial through its real HTTP facade are checked separately. Neither a synthetic provider port nor a real UI is public-runtime acceptance.

All heavy checks use the shared FileShare.None lock, independent ports and disposable state. No existing evidence is relabelled as live.


<a id="publication-routes-measured-candidates-and-preserved-failures"></a>

### Measured candidates and preserved failures

r2 runtime manifest56b2423de953f6ee06ffd8bf92355cc1eb386a88fa8f907342575ecc03a2a9d3 passed focused18/18, lint/typecheck/Webpack build, full domain800/800(260.477s), HTTP48/48(15.737s), guided54states and the real browser in15layouts. Its model/provider/workload ports are synthetic. The receipt is .artifacts/publication-routes/2026-10-29T07-20-02.725Z. This precedes the two review corrections below and is not relabelled as their final evidence.

1. A test expecting rejection of JSON value [REDACTED] failed with Missing expected rejection: a redacted secret could be mistaken for expected data. The new mode now rejects such expectations before any read, for additional API fields and stored JSON/text primary criteria. A response with unrelated redacted fields still passes its public assertions.
2. A data-context tool set omits read_publications. Its read_releases comparison originally exposed no accepted action ID, so a regression failed undefined versus the exact recorded ID. It now returns nullable recordedActionId after the existing unique scoped accepted-receipt correlation. The actual Agent/browser sequence consumes this returned ID in the next read_workload; it does not choose by project name or invent an action.

The private routes-review-before.log preserves both failing assertions (9/11), followed by positive and negative regression coverage. r3 runtime manifest e355426f702c64354cc50e7843eb436dc317da6002e07fed0f5f68a083715446 passes the focused25/25, lint0errors/48warnings/24infos, typecheck and Webpack build. The final full matrix on the identical runtime follows below. Its real browser sequence has three synthetic model turns per outcome (nine total),21 synthetic provider reads and9 probes; all15layouts passed, schema discovery and the live gate denial passed, reload made no reads. The test-server-only model/provider/workload ports remain synthetic; no live model cost or cloud writes occurred.


<a id="publication-routes-final-isolated-configuration"></a>

### Final isolated configuration

The final full matrix retains the exact r3 application/package manifest. Child TEMP/TMP is explicitly <private-validation>, so even disposable state is under this managed checkout. Earlier independently cleaned system-temp receipts remain separately labelled above. Host Node24.18.0, pinned package lock and the existing image digests are unchanged. Ports are independently allocated; production/main/port3000 are untouched by this lane.

| Check | Final measured result |
| --- | --- |
| npm run lint; npm run typecheck; npm run build -- --webpack | exit0; lint48warnings/24infos, no errors |
| npm run test:domain | 803/803,269.455s, no skips |
| npm run test:http | 48/48,17.837s |
| node scripts/test-publication-routes-browser.mjs | 15layouts, direct persisted outcome/action/release/artifact assertions, nine synthetic model turns,21 synthetic provider reads,9 probes; no axe/overflow/browser/external errors; reload0reads; real MCP SDKschema/closed-gate denial |
| node scripts/test-pnpm-worker-browser.mjs | One real pinned worker from actual directory upload/mission/HTTP decision; five layouts, replay409/reload stable; two synthetic model turns, no artifact/cloud write |
| node scripts/test-pnpm-browser.mjs | Six widths and keyboard approve/reject, no axe/overflow/browser errors |
| node scripts/test-guided-browser.mjs | 54states in five widths, synthetic model, no cloud writes |
| node --test --test-concurrency=1 tests/sandbox/pnpm-workspace.test.ts tests/sandbox/native-build.test.ts tests/sandbox/fullstack-build.test.ts | 13/13 actual container cases,184.650s, no skips; original test/workload/release-age/skip/source-change failures retained |

Final route screenshots/receipt: .artifacts/publication-routes/2026-10-29T07-46-35.462Z. Pnpm worker receipt: .artifacts/pnpm-worker/2026-10-29T07-46-53.099Z. Review: .artifacts/pnpm-review/after-2026-10-29T07-47-30.043Z. Guided: .artifacts/guided-publication/2026-10-29T07-47-39.808Z. These private generated artifacts are ignored, not committed. The runtime/package manifest remained unchanged through all final checks.


<a id="publication-routes-unconfirmed"></a>

### UNCONFIRMED

Current provider fixture/live availability, public routing lag, immutable public-release URLs, actual browser user journeys, authentication/session transitions, application data effects/persistence and background worker/scheduler behavior remain unconfirmed. Fences show identity at their observations, not an atomic remote snapshot or attested executable content. Runtime-specific compiled artifacts, pnpm component publication and the Factory feed raw intake remain the separate open boundaries recorded in [pnpm evidence](runtime.md#pnpm-workspaces).

<a id="required-private-network"></a>

## Required private network — A05 / AC21 / AC23

Update on `fb67971`: the operator-authorized real network, destination and bounded repair/publication cycle now passed; see the [correlated live record](agent.md#codex-publication-mission). The pending-live statements below describe the earlier local candidate. App deletion is verified; the exact unused network was still listed at08:04:39UTC and its provider garbage collection remains UNCONFIRMED.

The first candidate-05 live attempt selected and uploaded the controlled bookshop source through Chromium and connected the real Liara account. Destination options then returned zero networks. An independent read of the actual selected team returned the same empty list. The semantic precondition failed before any create, publication, AgentRun or model request. The isolated app name was independently absent (404); no delete was sent. Private request logs and the failed oracle are retained under the ignored mission directory.

This closes a product gap, not a reason to prepare infrastructure manually outside Launchlane. [ADR0019](../decisions/operations.md#0019-required-private-network) records the official guide and installed CLI evidence, unknown-price decision, ActionSpec v13, appended migration 12 and no-replay journal. The publication program from ADR0018 does not implicitly authorize this new resource.

Implemented source: typed network contract/decoder, one bounded provider write, account identity/list readback, existing Store claim/audit/recovery and common application functions; standalone authenticated web routes and `propose_network` in the existing AgentRun; one visible decision card in the guided publication flow. MCP returns that same run/card and its web decision URL. The actual returned network ID comes from the account read, not an assumed POST response shape.

The deterministic oracle requires explicit unknown-cost acknowledgment, an unchanged project/account/session, one claimed request, independently matched identity, and zero extra writes after duplicate requests or uncertain outcomes. Tests cover acceptance without visibility, later read-only reconciliation, lost responses, 401/429/5xx, source/expiry/session/network changes, preflight read retries exhausting the write allowance, cross-app conflict, same-run continuation and decision replay. Browser verification covers plain unknown-price text, checkbox, keyboard/focus, refresh and rejection at five widths; a synthetic card is not live provider proof.

Live creation and the full repaired-artifact publication remain UNCONFIRMED until an explicitly accepted unknown-cost network decision can be executed and the same candidate passes its workload oracle. No new model allowance is created. Existing phase ledger at the first stopped attempt: 47 requests, conservative $0.461534 of the existing $0.80 grant, leaving $0.338466; this attempt consumed zero model requests and zero cloud writes. Balance is not spending authority or an invoice.


<a id="required-private-network-candidate-06-local-verification"></a>

### Candidate-06 local verification

Base `fdf4c7f`; frozen index tree `2622f352628d3485fa9259b5a66c4a20edb4fd37`. All 294 runtime/test/script/assets/config files matched normalized Git bytes, digest `1538a5a0731f4a9eabfb17cf32461b1137ba87bc7105aa9ef495f9bd72c40596`. Build/typecheck passed; lint had zero errors, 35 warnings and 9 informational findings. On that same snapshot: 329/329 domain, 38/38 HTTP, 6/6 actual related Node22 container cases with synthetic models/provider, 43 guided browser states and 5 network-card browser states passed. `npm run test:networks` is the installed runner for the added card suite; a full aggregate browser or all-runtime sandbox pass is not claimed.

Initial development failures are retained privately: a TypeScript constructor parameter property was incompatible with Node's strip-only test runner; a direct model fixture used the wrong `ToolTurn` field names. Both were corrected without weakening the oracle. The first screenshot showed a generic field-sized checkbox; the control now reuses the existing `radio-option` style and the final candidate repeated keyboard/focus/axe/overflow checks at 320/360/390/768/1280. Container durations varied while unrelated local services were running; this does not establish the cause of older fixture timeouts.

The operator subsequently explicitly authorized the proposed one-network live operation in response to its unknown-cost question. This grants that concrete network action; it does not reset the phase ledger or turn the local tests into live evidence. Candidate-06 excludes concurrent uncommitted CSS/workbench/intro changes. Those files and the colleague's verification edits remain untouched and unstaged.

<a id="restart-live-cycle"></a>

## انتشار v5 و restart واقعی با بررسی همان صفحه

تاریخ: ۲۰۲۶-۱۰-۲۲. candidate کد: `79178164bb85f1c814d9bdc354edf167eeca4c15` روی `main`؛ Node محلی 24.18.0 و lockfile همین revision. این چرخه جدا از [سه انتشار قبلی](operations.md#controlled-live-cycle) است؛ شمارنده یا مجوز قبلی بازنشانی نشد. مقصد فقط برنامه موقت `launchlane-e2e` در همان تیم مجاز، با هویت داخلی تازه بود. اعتبار و قیمت جاری پیش از ساخت خوانده شدند. gateهای فایل نصب خاموش ماندند؛ read/mutation فقط در فرایند اپراتور جدا، با SQLite و نشست تازه، فعال شدند. کلید و gate مدل در آن فرایند خالی/خاموش و تعداد درخواست مدل صفر بود.


<a id="restart-live-cycle-انتظار-ثبتشده-پیش-از-عملیات"></a>

### انتظار ثبت‌شده پیش از عملیات

fixture کوچک Node، از کد نوشته‌شده برای همین آزمون، سه فایل داشت: `package.json`، `liara.json` و `server.mjs`. بررسی Launchlane کد یا script آن را اجرا نکرد. نسخه Node در تنظیم پروژه صریحاً `22` و دامنه engines سازگار بود. `/identity` باید پاسخ 200 و JSON دارای `revision=restart-v1` بدهد؛ همان endpoint، `process.versions.node` و شناسه تصادفی فرایند را نیز برمی‌گرداند. `/orders` عمداً همیشه 500 می‌دهد. انتظار این بود که restart، خطای کد را اصلاح نکند؛ مشاهده همان صفحه باید `still_failing` بماند. این سناریو به مدل یا اصلاح source/env نیاز نداشت.


<a id="restart-live-cycle-نتیجه-مسیر-واقعی"></a>

### نتیجه مسیر واقعی

تمام پیشنهاد، تصمیم، اجرا و مشاهده از API واقعی همین وب‌اپ عبور کردند. ساخت/حذف fixture در harness محدود اپراتور، با ثبت approval/attempt پیش از side effect بود؛ محصول هنوز قابلیت عمومی ساخت/حذف برنامه ندارد. رمز و token وارد URL، خروجی عمومی یا مدل نشدند.

| مرحله | مشاهده | نتیجه قابل ادعا |
| --- | --- | --- |
| انتخاب حساب و مقصد | اتصال تازه و تطبیق همان team/app/internal ID | برنامه حذف‌شده یا تأیید قدیمی دوباره استفاده نشد |
| آماده‌سازی و پیشنهاد | archive خصوصی؛ ActionSpec v5 با Node 22، مقصد، پلن و `/identity`/revision مشخص | فقط همان bytes و معیار به تأیید وصل شدند |
| ارسال source | یک POST؛ HTTP 200 | رسید archive پایدار شد |
| ایجاد release | یک POST؛ HTTP 201؛ `platformConfig.version="22"` | پذیرش انتشار، به‌تنهایی سلامت سایت نبود |
| بازخوانی انتشار | BUILDING سپس READY/current؛ پاسخ صفحه هنوز بلافاصله معتبر نبود؛ در بازخوانی دوازدهم `/identity`، 200 و revision دقیق داشت | action انتشار `succeeded` شد؛ runtime گزارش‌شده واقعاً `22.23.3` بود |
| جمع‌آوری مشکل | گزارش زنده همان app و `/orders` با HTTP 500 | علت از مدل حدس زده نشد؛ مدل خاموش بود |
| رد پیشنهاد restart | action=`cancelled` و `attemptId=null` | هیچ درخواست restart برای پیشنهاد ردشده ارسال نشد |
| پیشنهاد و تأیید تازه | ActionSpec v6؛ app ID، همان release و همان incident/page | یک claim و شروع درخواست در journal ثبت شد |
| ارسال restart | یک POST بدون body؛ HTTP 200 | پذیرش درخواست در journal پایدار شد؛ شناسه پایان عملیات وجود نداشت |
| بازخوانی restart | همان release و `/orders` دوباره 500؛ `outcome=unhealthy` و action=`failed` | درخواست پذیرفته شد، اما رفع مشکل تأیید نشد |
| بازیابی رابط | گزارش ذخیره‌شده و پنل restart از مرورگر واقعی خوانده شدند | پاسخ 500 و قید «پایان restart اثبات نمی‌شود» واقعاً نمایش داده شدند |
| حذف fixture | یک DELETE با HTTP 200 و GET فهرست پس از آن؛ برنامه دیگر وجود نداشت | cleanup همان هویت داخلی تأیید شد |

بین READY و پاسخ معتبر، 404 در بازخوانی برنامه و 503 در یک خواندن تشخیصی همان hostname دیده شدند. هیچ release/upload دوباره‌ای ارسال نشد؛ تنها readback همان درخواست پذیرفته‌شده ادامه یافت. این مشاهده زنده، اهمیت تفکیک release آماده از پاسخ workload را نشان می‌دهد؛ برای همه برنامه‌ها زمان آماده‌شدن ثابتی نتیجه نمی‌شود.


<a id="restart-live-cycle-مرز-نتیجه-و-مصرف"></a>

### مرز نتیجه و مصرف

شناسه فرایند در خواندن فوری پیش/پس از restart یکسان بود. این مشاهده پایان restart، تعویض همه replicaها یا علت رفتار را ثابت نمی‌کند. پذیرش HTTP 200، مشاهده دوباره صفحه و شاهد پایان عملیات سه موضوع جدا باقی ماندند. برنامه پیش از انتظار نامحدود حذف شد؛ هیچ retry write، تغییر env/پلن، انتشار اصلاحی یا مصرف مدل انجام نشد. digest دو env پیش‌فرض بین ساخت، انتشار و مشاهده پس از restart ثابت بود؛ حفظ secretهای واقعی یا semantics عمومی merge/replace از آن ثابت نمی‌شود.

از شروع ساخت تا حذف و readback، 180575ms، حدود سه دقیقه، گذشت؛ کمتر از سقف ۲۰ دقیقه. شمارنده‌های پایدار: create=1، upload=1، release=1، restart=1 و delete=1. از 67 درخواست API ثبت‌شده، 62 مورد GET بودند؛ یکی از آن‌ها applets با 500 بود و داده ناموجود به سلامت یا مصرف صفر تعبیر نشد. probeهای HTTPS صفحه جدا از این شمار API هستند. اختلاف موجودی مشاهده‌شده حدود 1145.8 تومان، کمتر از سقف ۵۰۰۰ تومان چرخه بود؛ صورتحساب ممکن است تأخیر داشته باشد و این اختلاف، فاکتور قطعی قابل انتساب نیست. هیچ درخواستی برای ایجاد/حذف شبکه ارسال نشد.

شواهد خصوصی: ledger و journal در `.local/restart-cycle/`، از جمله oracle قبل از عملیات، proposalها، مشاهده، رد تصمیم، snapshot incident، نتیجه و cleanup؛ تصویر رابط واقعی در `.artifacts/restart-live-7917816/restart-real.png`. این فایل‌های خصوصی tracked نیستند. ۱۱ فایل bundle با credentialهای config و کلید ورود چرخه تطبیق داده شدند و match نداشتند؛ token خام Liara نیز در DB چرخه نبود. این scan تضمین تشخیص همه داده‌های محرمانه احتمالی نیست.

این چرخه، انتشار v5 با Node 22 و پذیرش واقعی restart همراه با نتیجه ناموفق همان symptom را تأیید کرد. پایان خود restart، restart موفقِ رفع‌کننده مشکل، app دوم، سایر شاخه‌های Node، env write، قیمت‌گذاری داخل محصول، تشخیص مدل روی این case و پذیرش نهایی کل محصول همچنان تأیید نشده‌اند.

<a id="stabilization-candidate49"></a>

## تثبیت و تحویل candidate49 — ۲۰۲۶-۱۰-۲۳

وضعیت این برش: هستهٔ محلی و آزمون‌های مشخص زیر موفق‌اند و سرور اصلی همان خروجی را اجرا می‌کند. انتشار کامل ترب با دادهٔ پایدار، پذیرش عمومی همهٔ خانواده‌ها و اجرای تازهٔ Docker از این نتیجه حاصل نمی‌شوند.


<a id="stabilization-candidate49-هویت-نسخه-و-تغییرهای-بستهشده"></a>

### هویت نسخه و تغییرهای بسته‌شده

کد فعال `e1709301250afd85282c694d08d81a7d67dfe39f`، tree `8ca1526603660f0936474e45c4fc6463556922ec` و candidate49 است. export ایندکس ۳۸۲ فایل runtime/test/script/config دارد؛ digest آن `1bdb38f71b79d5d7bd68bedfe50cbe9dce14a626bc9685531936dea7ac2b6467` و اختلاف بایت با snapshot صفر است. parent زمان freeze برابر `69f38c9` بود؛ commit متناظر **tree کامل** برابر `e170930` است. commit بعدی مستندات، نسخهٔ کد سرو‌شده را تغییر نمی‌دهد.

تغییرات انباشته، پس از review و بررسی مربوط، در هفت کامیت موضوعی Conventional ثبت شدند:

- `d5a3a4d`: آزادکردن SQLite و پوشهٔ موقت متعلق به fixture هنگام شکست setup؛ بستن تکراری امن است. deadline و assertion قبلی حفظ شدند.
- `88518e2`: اتصال frontend بومی React/Vue/Angular و Node20 به قرارداد مشترک؛ حفظ `next.nodeVersion`، کشف env از referenceهای واقعی process و رد root دارای workspace به‌عنوان frontend آماده. پذیرش cloud این خانواده‌ها همچنان مستقل است.
- `f6a748f`: کاهش فقط متن source تکراری در درخواست مدل با حفظ رسید کامل برابر، ترتیب ابزار و history؛ دکمهٔ بستن پیشنهاد منقضی‌شده با همان تصمیم reject موجود.
- `d56c099`: خلاصهٔ مراحل و نتیجهٔ correlated، حفظ باز/بسته‌کردن دستی و نمایش برآورد ۲۴ساعت/۳۰روز از quote موجود با محاسبهٔ صحیح و بیان موارد خارج از قیمت.
- `1617fbd`: descriptor خواندنی ASGI/Vite، اعتبارسنجی مستقل manifest/بایت خروجی و قرارداد bootstrap محدود؛ foundation مستقل با `publishable:false`، بدون جایگزینی startup فعلی ترب.
- `69f38c9`: oracle واقعی script/stylesheet و MIME، خواندن محدود خروجی container و اصلاح cleanup تست پس از پاسخ گم‌شده با هویت دقیق. اتصال export به lifecycle و artifact نهایی هنوز انجام نشده است.
- `e170930`: آزمون مرورگر محصول کامل برای پیشنهاد منقضی‌شده، API واقعی تصمیم و ادامهٔ هدایت‌شده؛ افزوده‌شدن آن به دستورهای مرورگر و ثبت دستور تحویل موضوعی.

مقایسهٔ مرجع liara-copilot فقط مبنای انتخاب بهبود بود؛ کد یا asset آن کپی نشد. [گزارش مستقل مرجع](references.md#reference-improvements) و [مرز foundation ترکیبی](runtime.md#composite-preparation) تصمیم‌ها و شکست‌های اولیه را نگه می‌دارند.


<a id="stabilization-candidate49-بررسی-روی-همین-snapshot-نهایی"></a>

### بررسی روی همین snapshot نهایی

| فرمان یا بررسی | نتیجهٔ مشاهده‌شده و مرز |
| --- | --- |
| `npm run build` | موفق؛ build تازهٔ candidate49، بدون کپی bundle/server از نسخهٔ قبل؛ هشدارهای tracing موجود حفظ‌اند |
| `npm run typecheck` | موفق؛ Next typegen و `tsc --noEmit` |
| `npm run lint` | صفر error؛ ۴۳ warning و ۱۳ info روی ۳۷۸ فایل؛ هشدارها رفع‌شده ادعا نمی‌شوند |
| `npm run test:domain` | ۴۴۱/۴۴۱؛ صفر fail/cancel/skip، حدود ۲۵۳٫۲۶ ثانیه؛ model/provider مصنوعی |
| `npm run test:http` | ۳۹/۳۹؛ صفر fail/cancel/skip، حدود ۲۲٫۰۶ ثانیه؛ سرور تولیدی مجزا و scope مصنوعی |
| بررسی host/VM در سه فایل sandbox | ۱۰/۱۰؛ parser/MIME مشترک worker، قرارداد bootstrap و exporter/cleanup میزبان؛ **اجرای واقعی Docker نیست** |
| `npm run test:publication-expiry` | ۴ حالت در ۳۶۰ و ۱۲۸۰؛ صفر page error/external/model/provider attempt؛ API واقعی محصول، state موقت و provider مصنوعی |
| `npm run test:login` | ۸ حالت/دو کاربر؛ جداسازی پروژه موفق، صفر page error؛ identity provider مصنوعی |
| `npm run test:destination-plans` | ۱۴ حالت؛ صفر model/provider write، quote و تعامل واقعی Chromium |
| `npm run test:platforms` | ۱۲ حالت؛ صفر error/external/model، نشان و چیدمان واقعی Chromium با profileهای محدود آزمون |

آزمون expiry، کنترل approve نامعتبر را غایب، مسیر keyboard از disclosure به close و Enter، تصمیم reject، وضعیت `needs_input`/`cancelled`، حفظ مصرف غیرصفر/limits/mission و reload بدون replay را بررسی می‌کند. ادامهٔ هدایت‌شده فعال است؛ دکمهٔ آن برای آغاز مأموریت تازه کلیک نشد. سناریوی موقت روی همان build نهایی اجرا شد؛ state اصلی برای ساختن این وضعیت seed نشد.

این‌ها suiteهای مشخص‌اند؛ `npm run check`، aggregate کامل `test:browser` یا ماتریس همهٔ Docker/runtimeها دوباره اجرا نشده‌اند. logهای دقیق `candidate-49-*.log` و هویت‌ها در evidence خصوصی همان مأموریت نگه‌داری می‌شوند.

۱۰ بررسی میزبان از `tests/sandbox/composite-bootstrap.test.ts`، `tests/sandbox/frontend-build.test.ts` و `tests/sandbox/frontend-export.test.ts` با انتخاب نام `^(composite bootstrap validates|the worker|host )` اجرا شدند؛ انتخاب موردها عمداً هیچ آزمون دارای اجرای Docker را شامل نمی‌شود.


<a id="stabilization-candidate49-فعالسازی-و-حفظ-state"></a>

### فعال‌سازی و حفظ state

در ۱۸:۴۰:۱۳ UTC سرور loopback پورت۳۰۰۰ از candidate46/`401abfc` به candidate49/`e170930` منتقل شد. پیش از stop، نبود action/run/job فعال یا uncertain بررسی، از SQLite بکاپ consistent گرفته و `quick_check` آن تأیید شد؛ env و launcher قبلی نیز خصوصی حفظ شدند. فقط process متعلق به همان listener متوقف شد.

پس از startup، مسیر حفاظت‌شده بدون session پاسخ۴۰۱ و صفحهٔ اصلی پاسخ۲۰۰ داد. ۹ فایل JS/CSS دریافت‌شده از سرور اصلی با فایل‌های candidate49 SHA256 برابر دارند و متن کنترل expiry در bundle سرو‌شده وجود دارد. بررسی مستقل Chromium در۳۶۰/۱۲۸۰ نیز هر۶ JS واقعاً loadشده، tree نسخه و ancestry کامیت `f6a748f` را تأیید کرد؛ صفر page error، تخطی گزارش‌شدهٔ axe، overflow و درخواست خارجی یا POST داشت. این probe فقط صفحهٔ ورود و هویت فایل‌های سرور را می‌سنجد؛ تعامل expiry با API در state موقت بالا بررسی شده است. رمز واقعی ارسال نشد.

تمام ردیف‌های هر۲۸ جدول state، شامل credential ciphertext، session، history و schema17، با بکاپ پیش از جابه‌جایی برابر ماندند؛ ۱۹ flow،۱۷ action و۲ connection حفظ شدند. hash فایل تنظیمات نیز برابر است. دفتر مصرف مدل و reserveهای قبلی حفظ شدند؛ درخواست زندهٔ تازهٔ مدل/لیارا صفر و allowance تازه ایجاد نشد. هزینهٔ زمان اجرای Codex و صورتحساب سرویس، اندازه‌گیری نشده‌اند.


<a id="stabilization-candidate49-شکستهای-محفوظ-و-اولین-مرزهای-باز"></a>

### شکست‌های محفوظ و اولین مرزهای باز

- candidate47 آخرین full-domain برابر۴۰۹/۴۱۰ داشت؛ fixture پیش از assertion در archive/capture به deadline رسید. ۵۰ تکرار instrumentشده و subset موفق، علت تاریخی را اثبات نکردند. cleanup درست شد، timeout زیاد نشد و pass جدید۴۴۱/۴۴۱ مربوط به candidate49 است. candidate48 نیز۴۴۱/۴۴۱ داشت؛ اصلاح یک mkdir در harness expiry سبب snapshot تازه49 شد و بررسی‌های نهایی روی49 تکرار شدند.
- آزمون واقعی frontend Docker پیش از asset assertion پس از۱۲۵٫۴۹ثانیه با `SANDBOX_CLEANUP_UNCONFIRMED` متوقف شد. fixture export نیز پیش از export در مهلت۱۰ثانیهٔ start متوقف شد. منبع دقیق باقی‌مانده با name/label/image/ID تطبیق و حذف شد؛ علت latency همچنان UNCONFIRMED و actual export pass تازه موجود نیست.
- نخستین probe خصوصی primary، عنوان ثابت اشتباه را انتظار داشت؛ source عنوان صفحهٔ ورود را صریحاً تعیین می‌کند. فقط oracle خصوصی با source برابر و probe تکرار شد؛ محصول برای پاس‌کردن آن عوض نشد. شکست اصلی محفوظ است.
- مخزن ترب مستقل در این مدت تغییر کرد؛ آخرین مشاهدهٔ فقط‌خواندنی در این برش `24ffcaa03cc34cefc46d2ce824913f681152e46b` با تغییر باز اسناد بود. هیچ source، DB یا usage ledger آن تغییر/reset نشد. پیش از مأموریت بعد، revision و تغییرهای تازه باید مجدد pin شوند.
- مسیر لازم بعدی در خود محصول: runtime/start ترب فعلی، build و export واقعی frontend پیش از پایان container، اتصال بایت تأییدشده به artifact مشتق، دیسک و انتقال consistent دیتابیس/دفتر مصرف، سپس current-release/assets/رفتار واقعی و پایداری پس از restart/redeploy. foundation مستقل یا build محلی این مسیر را تکمیل نمی‌کند.
- AC28/همهٔ۱۴ خانواده همچنان partial است؛ native React/Vue/Angular/Next زنده و خانواده‌های باقیمانده پذیرش مستقل لازم دارند. MCP مشترک و شاهد محدود Codex قبلی، از connector اجرایی جدا هستند؛ connector Codex شاهد محدود قبلی دارد و اجرای زندهٔ Claude Code/OpenCode هنوز UNCONFIRMED است.

هیچ push، branch/worktree تازه، بازنویسی تاریخچه، preparation پنهان ترب یا reset داده انجام نشد. وضعیت Git تحویل باید پس از کامیت همین گزارش دوباره clean بررسی شود.

<a id="worktree-integration"></a>

## Primary checkout integration — 2026-11-04

The initial main9c38849 and runtime4af8d04 had 17 and12 unique commits since fc01252. Three history-preserving merges (6f08e8c, ca4f628, f361346) retain both lines, schema199cd76 and accounts a1ab628. Main was fast-forwarded only after the other owners committed their work and its index/worktree were clean. Existing environment/state files were preserved.

Exact executable source: f361346; Node24.18.0; primary folder <private-validation>; production build m5FSXET2TnE0UVFFqk-un. Under the shared OS lock, npm ci, lint (52 existing warnings/47 infos, zero errors), typecheck, domain893/893, build and HTTP50/50 passed. Nine actual Chromium suites passed: accounts13, responsive47, library19, login10/two actors, automatic lifecycle3, MCP24, plans14, guided57 and baseline intake/review/reject15. Browser state/providers/model are disposable/synthetic; baseline review starts no worker/SQL, rejects by keyboard and retains replay409. Local logs/results: <private-validation>; images: .artifacts.

Retained integration failures: the first combined domain run was881/882 because the old hosted-config test expected an empty managed CLI path. Its expectation now follows the installed-tool contract; system-account denial and actor isolation remain tested. Duplicate identical CSS tokens were removed. The account owner's historical assistant-first browser script and kit self-test remain separate limitations in accounts-page.md. Fresh Docker/provider/model/full14 production acceptance was not performed by this integration.

Verification history already moved by main stays in docs/archive/verification-20261029.md; duplicate restoration during the merge was removed only after confirming every old base line remains there with adjusted link prefixes.

The manual local HTTPS runtime task now starts Next from the primary folder and serves that build. Entry/health200, unauthenticated workspace401 and nine served JS/CSS hashes matched the primary output. Its ignored launcher is <private-validation> old worktree entrypoints delegate to it. Existing private env/state/certificate stay in place with a private state backup. The child does not inherit the primary installation's configuration. Standard npm start/dev separately uses the primary folder's own .env.local at http://127.0.0.1:3000.
