# Interface — verification evidence

[Documentation](../README.md) · [Current support](../platform-support.md) · [Verification index](../verification.md)

These versioned records preserve the original decisions, source revisions, failures and evidence limits. Dates and passing counts apply only to the named snapshot, not the current release. Installation-specific locations and identities are omitted.

## Records

- [Destination price CI regression — 2026-11-04](#destination-price-ci)
- [Account settings as a page — 2026-11-04](#accounts-page)
- [انتخاب GitHub تا بررسی پروژه](#github-project-review)
- [انتشار مرحله‌ای و اصلاح Node22](#guided-publication)
- [Interactive launch illustration — 2026-10-28](#interactive-launch-artwork)
- [Destination controls refresh — 2026-11-04](#lifecycle-refresh)
- [Native proposal progress and selected build evidence, 2026-10-27](#native-proposal-progress-20261027)
- [Project library and private environment import — 2026-10-23](#project-library-and-environment-import)
- [حذف پروژه، توقف/حذف مقصد و خطای فرم env — ۲۰۲۶-۱۰-۲۳](#project-removal-and-env-response)
- [قیمت خوانا و نتیجهٔ انتشار — ۲۰۲۶-۱۰-۲۳](#publication-price-and-success)
- [Publication UI and active local runtime — 2026-11-04](#publication-ui-local-runtime)
- [Remembered Liara login — 2026-11-04](#remembered-login)
- [Responsive interface stabilization](#responsive-ui)

<a id="accounts-page"></a>

## Account settings as a page — 2026-11-04


<a id="accounts-page-problem-implementation-and-user-path"></a>

### Problem, implementation and user path

The account settings dialog constrained Liara destination controls, GitHub and coding
tool access to one scrolling overlay. It could not be addressed directly, survived
neither a reload nor browser history as settings, and hid browser sign-out on desktop.

The header's «حساب‌ها» now opens `?view=accounts`. This is a normal document page with
an h1, section navigation, a wider primary account area and separate GitHub, coding
tool and session sections. The existing tokens, fonts, glyphs and two task tabs are
retained. Mobile uses wrapped navigation and document scrolling; desktop gives the
section navigation its own column. Obsolete modal-only account CSS was removed.

`from=incident` retains the investigation destination; other/missing return values
resolve to publication. The existing validated project ID is retained. Reload and
authentication preserve the settings URL; Back/Forward restore the appropriate
view without starting an agent or deployment. The publication/investigation views
remain mounted, preserving their form state. The active account header control is
announced and the task-tab indicator is hidden while neither task is selected.

«بازگشت به فضای پروژه» returns to the previous task and the initiating control.
Escape does not dismiss the page. GitHub and MCP retain their scoped child flows;
closing them returns focus to the page's trigger. Cancelling sign-out preserves
the page, session and focus. Choosing a GitHub project returns to publication.

`ConnectionDialog` becomes `ConnectionPage`; existing connection actions, encrypted
credentials, account/team scope, CSRF and APIs are reused. No provider, policy,
persistence, grant engine, dependency or infrastructure authority is added.
An existing read-failure bug is also fixed: failed metadata no longer leaves an
endless loading message. A single in-flight read supports retry, ignores aborted
results and is cancelled when leaving the page. Auth expiry returns to sign-in.


<a id="accounts-page-exact-candidate-and-validation"></a>

### Exact candidate and validation

Frozen product candidate: `199cd76e0f08a869e57be9f4247ebbe85da76aaf` plus fifteen owned
source/test paths, Node24.18.0, the pinned lockfile and installed Chromium.
The committed schema-baseline slice is retained; runtime-component branch changes
are not part of this candidate. Final unified-tree acceptance is a separate gate.
Build/typecheck used r4; r5 changed only the workbench browser synchronization harness, with identical product source.
Only disposable build caching was disabled in the candidate; product Next config
was unchanged. No `.env`, private state, credentials or model allowance was copied.

| Check | Result |
| --- | --- |
| `npm run build -- --webpack` | Passed |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed; 0 errors, 46 warnings, 22 infos |
| Targeted domain | 14/14 passed |
| Accounts page browser | 13 states passed; no page errors/external requests |
| Responsive browser | 47 states passed; no recorded failures |
| MCP settings browser | 24 states passed; no page errors/external requests |
| Workbench browser | 75 states passed; no browser errors/external requests |
| Domain guide browser | 22 states passed; no browser errors/external requests |
| Active guided publication browser | 57 states passed; synthetic model, zero cloud writes |
| Destination plan browser | 14 states passed; zero provider writes/model calls |
| HTTP/HTTPS/stdio | 33/33 passed |
| Historical assistant-first browser | Failed before the changed account path; see boundary below |

Commands in the frozen candidate:

```text
node --test tests/domain/publication-mission.test.ts tests/domain/connections.test.ts tests/domain/mcp-setup-guide.test.ts
node scripts/test-accounts-page-browser.mjs
node scripts/test-responsive-browser.mjs
node scripts/test-mcp-settings-browser.mjs
node scripts/test-browser.mjs
node scripts/test-domain-browser.mjs
node scripts/test-guided-browser.mjs
node scripts/test-destination-plans-browser.mjs
node --test --test-concurrency=1 tests/http/api.test.mjs tests/http/mcp.test.mjs tests/http/mcp-hosted.test.mjs
```

The new accounts suite uses the actual built UI, session, source inspection, URL
and history. It covers direct URL through login, reload with the same project,
Back/Forward, Escape, child-flow cancellation/focus, loading, 503, 403, retry,
leaving during a pending read and 401. Layouts include 280/320/390/768/1280px,
200% text, short landscape and axe. Connection read failures are synthetic.
Existing suites retain original selection, site validation and grant assertions;
their account locators/navigation now assert a region and return action instead of
a modal and Escape. MCP grants/download/revocation and HTTP/stdio remain actual local
operations with synthetic model/provider transports. No real GitHub account login,
external host installation, model spending or cloud mutation is included.


<a id="accounts-page-retained-failures-and-evidence"></a>

### Retained failures and evidence

An initial C-drive snapshot with an I-drive dependency junction failed Webpack
resolution (`./<private-validation>` and `app-next.js`). Windows PowerShell
initially truncated stderr at the first native error; a repeat exposed the complete
diagnostic. The frozen source was moved to I outside the product root. No product
resolver, dependency, oracle or timeout was altered. An initial lint error on an
effect-only retry counter was fixed by reusing one abortable metadata read callback.
The workbench browser also exposed an existing sample transition race: the previous
incident report remained visible while a new sample request was pending, so keyboard
Enter could be sent to a disabled latency button. The harness now waits for the new
incident ID and the same control's enabled state. Its original latency oracle, keyboard
interaction and deadlines remain intact; the complete75-state workbench rerun passed.

`node scripts/test-agent-browser.mjs` failed at its unchanged line127 before exercising
account settings: it expects the historical h1 «میز کار پروژه» and a default assistant
view, whereas the pre-task199cd76 WorkspaceIntro already renders the guided publication
hero. Only its account navigation locators were adapted; this slice does not restore
the old product or claim that historical suite passed. The active guided suite is
reported separately. These failed attempts are not included in passing totals.

Before: the clean disposable UI at390/1280 was captured before editing, using the
previous source-matched UI candidate. After: actual r4 screenshots/reports are under
`<private-validation>`.
The ignored `<private-validation>` packet holds manifests,
exact logs, failed-attempt notes and the integration handoff. Images/build/state
and private coordination are not committed.


<a id="accounts-page-integration-boundary"></a>

### Integration boundary

The separate design kit self-test ran and exited1: only12/52 checks passed (23%).
Its own Playwright, fixture/hook and Windows command setup remain incomplete; this
is not a product score. Product Chromium/axe checks above actually ran.

The owner separately authorized coordination with the integration chat. It owns
the unified main/runtime merge and final root runtime activation. This slice does
not restart the old runtime-components task or move env/state. At this commit, root
runtime activation is owned by that integration and is not claimed by the isolated
UI checks. The handoff includes the exact SHA, commands and retained failures.

<a id="github-project-review"></a>

## انتخاب GitHub تا بررسی پروژه


<a id="github-project-review-محدوده-و-revision"></a>

### محدوده و revision

اصلاح اجرایی در `d981734`، روی Node 24.18.0 انجام شد؛ AC02/03/13/14/16. ورود حساب را کاربر با ابزار رسمی کامل کرد. خواندن‌های این بررسی از اتصال همان actor و credential نگهداری‌شده در keyring انجام شدند؛ حساب CLI دیگری یا token در مرورگر/خط فرمان استفاده نشد. هیچ درخواست مدل، درخواست Liara یا write زیرساخت انجام نشد و سه gate زنده خاموش ماندند.


<a id="github-project-review-شکستهای-بازتولیدشده-و-اصلاح"></a>

### شکست‌های بازتولیدشده و اصلاح

| مورد | شاهد و علت | رفتار اصلاح‌شده |
| --- | --- | --- |
| مخزن معمولی با فایل داده بزرگ رد می‌شد | مخزن انتخاب‌شده ۱۲۸ فایل قابل ورود، مجموع 5,364,734 بایت و یک فایل داده 3,949,893 بایتی داشت؛ سقف قبلی هر فایل 512 KiB بود | سقف هر فایل 4 MiB، تنظیمات ریشه package.json/liara.json همچنان 512 KiB؛ مجموع 20 MiB، ۱۰۰۰ فایل و ۵۰۰۰ entry حفظ شد. import، inspection و decoder یک قرارداد دارند؛ فایل بزرگ‌تر نام و راه بازیابی دارد |
| واژگان معمول به credential تعبیر می‌شدند | `js-tokens` در lockfile و «Motion tokens» در CSS/سند، classifier مشترک با redaction گزارش را فعال می‌کردند | تشخیص source نام کلید credential را می‌سنجد؛ مقادیر شناخته‌شده نصب، Bearer، URL دارای رمز و private key همچنان رد می‌شوند. redaction گزارش عمومی تغییر نکرد |
| تلاش ناموفق ظرفیت snapshot را مصرف می‌کرد | regression با package.json خراب، پوشه ذخیره‌شده بدون ProjectFlow باقی می‌گذاشت؛ پس از ۱۶ تلاش ظرفیت تمام می‌شد | فقط snapshot بدون مرجع پایدار پس از شکست پاک می‌شود؛ انتخاب قبلی حفظ و snapshot ثبت‌شده در پاسخ گم‌شده نگه داشته می‌شود. cleanup با realpath/lstat، junction و خروج از محدوده را رد می‌کند |
| مسیر متداول framework رد می‌شد | `src/routes/[slug].ts` به UNSAFE_PATH می‌رسید | براکت در جزء نام مجاز است؛ traversal، separator، لینک و نام تکراری Windows همچنان رد می‌شوند |

تشخیص source یک heuristic محافظه‌کار است؛ تضمین یافتن هر شکل دلخواه secret یا ممیزی کامل محتوای پروژه نیست. فایلی که به‌دلیل credential رد شود با مسیر نسبی و بدون مقدار محرمانه معرفی می‌شود. هیچ فایل ضروری برای سبزشدن بررسی، بی‌صدا حذف نشد.


<a id="github-project-review-شواهد-واقعی"></a>

### شواهد واقعی

- مسیر حساب واقعی: فهرست مخزن عمومی و خصوصی، جست‌وجو، انتخاب مخزن، شاخه و مرور پوشه از API واقعی از طریق CLI رسمی؛ سپس دریافت همان tarball با revision ثابت.
- انتخاب ریشه شاخه `main` با commit `f11511c88cf07f46b929c6c56f6d2e1feba0bd44` در مرورگر به نتیجه ذخیره‌شده و archive محلی رسید: ۱۲۸ فایل، 5,364,734 بایت. «آماده» فقط به آماده‌سازی فایل اشاره دارد؛ build یا deploy این پروژه اجرا نشده است.
- readback مستقل، طول و SHA-256 تک‌تک entryهای archive پایدار را با manifest و sourceHash بررسی دوباره snapshot تطبیق داد. هیچ action تازه ایجاد نشده بود؛ تعداد attempt تاریخی شش ماند.
- reload و رفتن به بخش اختلال و Back، همان نتیجه را حفظ کردند. انقضای واقعی نشست، ورود مجدد خواست و نتیجه قبلی بازیابی شد؛ اتصال GitHub دوباره درخواست نشد.
- دریافت واقعی زیرپوشه `src` در همان main، ۷۹ فایل را بررسی و به‌درستی `incomplete` ثبت کرد؛ بسته انتشار نساخت و نیاز به پوشه دارای package.json/start را توضیح داد. لغو واقعی دریافت، شناسه پروژه قبلی را حفظ و focus را به دکمه دریافت برگرداند؛ دریافت تازه پس از آن جداگانه اجرا شد.
- انتخاب شاخه دیگر، revision نمایان را به `b86020fd5ea7…` تغییر داد؛ پوشه‌ها از همان revision خوانده شدند. این مشاهده، build یا انتشار آن شاخه را اثبات نمی‌کند.

آزمون عمومی جداگانه با transport ناشناس واقعی و GitHubClient تولید، مخزن رسمی `liara-cloud/nodejs-getting-started` در commit `ca453167e498d381d50678d16e37180696b41de6` را با هشت درخواست خواند: هشت فایل، start برابر `node server.js`، پورت 3005 و restore موفق. این آزمون مستقل از ورود حساب و CLI بود و شاهد secure-storage یا مخزن خصوصی نیست.

جزئیات خصوصی حساب و archive دریافت‌شده در `.local` و خروجی بررسی در `.artifacts/gh-repo-review/`، خارج Git، باقی می‌مانند. کد مخزن هنگام شناسایی اجرا نشد و فایل‌ها به مدل یا لیارا ارسال نشدند.


<a id="github-project-review-اعتبارسنجی-و-حدود"></a>

### اعتبارسنجی و حدود

`npm run test:domain`: 169/169؛ `npm run typecheck` و `npm run lint`: موفق. regressionها علاوه بر مورد مثبت، فایل بیش از 4 MiB، تنظیمات بیش از 512 KiB، مجموع بیش از 20 MiB، credential واقعی، ۱۸ شکست متوالی، پاسخ گم‌شده پس از commit و cleanup روی junction را پوشش می‌دهند. خطاهای مجوز، rate limit، مخزن خالی، تغییر شاخه، replay/expiry و UI cancel با پاسخ کنترل‌شده بررسی می‌شوند؛ این‌ها خطاهای ایجادشده روی حساب واقعی نیستند.

بازراه‌اندازی کنترل‌شده dev برای جایگزینی Store قدیمی در حافظه لازم شد؛ HMR به‌تنهایی قرارداد decoder نمونه موجود را عوض نمی‌کند. داده و اتصال حذف نشدند و migration جدیدی اضافه نشد.

مخزن انتخاب‌شده برای دریافت واقعی عمومی بود؛ دیده‌شدن نام مخزن خصوصی به‌معنای آزمون دریافت محتوای آن نیست. صفحه‌بندی بیشتر، لغو ورود و قطع اتصال به‌صورت خودکار با fixture پوشش دارند؛ اتصال فعال کاربر برای تولید این حالت‌ها قطع یا باطل نشد. هیچ ادعای پذیرش همه GitHub organizationها، همه پروژه‌ها یا سلامت deployment از این برش نداریم. peer review مستقل T40 و قابلیت‌های برنامه‌ریزی‌شده Agent با این self-review تکمیل نمی‌شوند.


<a id="github-project-review-اصلاح-کنترلهای-انتخاب-و-candidate-رابط"></a>

### اصلاح کنترل‌های انتخاب و candidate رابط

در `97cad97` دکمه‌های پروژه GitHub از وضعیت همان selection نام می‌گیرند: «تغییر انتخاب GitHub» برای مخزن/شاخه/پوشه، و «انتخاب پوشه محلی» برای دستگاه سرور. بررسی دستی با Enter، انتخاب‌گر محلی را باز کرد؛ انصراف، شناسه پروژه GitHub و focus کنترل را حفظ کرد. تصویر واقعی `.artifacts/gh-repo-review/live-project-ready.png` پس از بازگشت به ریشه معتبر مشاهده شد.

درخت `c76a937b34bc66d875578539a799774ba708d397` دقیقاً tree همین commit است؛ پیش از commit از index تمیز export شد. npm ci/setup/lint/typecheck/build و bootstrap2 و چهار suite مرورگر75/27/27/22 تازه، بدون کلید حساب و با gate خاموش، موفق شدند. خروجی در `.artifacts/candidate/c76a937-2026-10-22T05-19-41.727Z/` است؛ پوشه و سرور موقت حذف شدند. domain169 و HTTP18 روی `d981734` سنجیده شدند و پس از تغییر صرفاً کنترل رابط تکرار نشدند؛ آن‌ها را آزمون تازه همین درخت معرفی نمی‌کنیم. یازده فایل client با secretهای setup match نداشتند.

<a id="guided-publication"></a>

## انتشار مرحله‌ای و اصلاح Node22

تاریخ: ۲۰۲۶-۱۰-۲۲. پایه مخزن e7fffd1، main؛ دو export مستقل working tree برای جلوگیری از برخورد build با کار هم‌زمان UI استفاده شدند. این گزارش پذیرش کل مأموریت، Next/build/env عمومی یا همه تغییرهای بعدی candidate نیست. فایل خصوصی مأموریت، tokenها، DB، source archive و حساب مصرف خارج Git هستند.


<a id="guided-publication-رفتار-و-قرارداد"></a>

### رفتار و قرارداد

ناوبری دو تب انتشار و بررسی مشکل دارد؛ ورود بدون view و لینک تاریخی agent به publish می‌رسند و project معتبر حفظ می‌شود. چت بسته و اختیاری است. دکمه، PublicationInput معتبر را به همان AgentRun می‌دهد. پروژه/نسخه و context سمت host کنترل می‌شوند؛ دو registration یکسان join می‌شوند. GET/reload/navigation فقط state را می‌خوانند. سؤال اختیاری channel فقط‌خواندنی دارد و مأموریت انتشار را جایگزین نمی‌کند. تصمیم‌های scope عوض‌شده لغو و کار متداخل پیش از اجرا رد می‌شوند.


<a id="guided-publication-دو-چرخه-مدل-و-paas-واقعی"></a>

### دو چرخه مدل و PaaS واقعی

انتخاب source و تصمیم‌های هر دو چرخه از مرورگر انجام شدند؛ اتصال حساب از API محلی احرازشده بود. چت باز نشد و view همواره publish ماند. محیط شبکه از مسیر خصوصی socket با VPN روشن استفاده کرد؛ native fetch و HTTPS واقعی و چهار کنترل منفی پیش از اجرا دوباره سنجیده شدند. این تنظیم شبکه، بخشی از محصول عمومی نیست.

| معیار | پروژه آماده | پروژه دارای باگ |
| --- | --- | --- |
| run | 937a69de-f447-4edc-8437-20572a2f6f46 | c4174352-b2d6-4981-bf5a-ec47de545d80 |
| مسیر و انتظار پیش از اجرا | /، وضعیت200، متن mentor publication ready | /orders، وضعیت200، متن JSON شامل total=73 |
| release | &lt;resource-id&gt; | &lt;resource-id&gt; |
| archive SHA256 | c94615f9895c1611ab744edc98daec15e231c554461f47c9018298ff70608398 | f25a22bb514d0f22143715daf28f7e9959bbe881dc40d0b1f72eff77fe567948 |
| مدل / ابزار | 7 / 45 | 12 / 48، شامل worker |
| token گزارش‌شده | 30,086 | 50,820 |
| زمان فعال ثبت‌شده | 168,896ms | 178,936ms |
| create/upload/release/delete | هرکدام1 | هرکدام1 |
| reload | صفر درخواست مدل تازه | صفر درخواست مدل تازه |

در چرخه دوم، مدل از profile به source و آزمون مرتبط رفت. baseline با خطای محاسبه تعداد شکست خورد؛ فقط invoice.mjs تغییر کرد. همان تست، فاکتور خالی و اعشار را نیز کنترل کرد و روی Node22.23.3 داخل container گذشت. source اصلی همچنان خراب و محفوظ بود. archive انتخاب‌شده دقیقاً همان archive تست‌شده بود و به ID داخلی مقصد تازه متصل شد. host فقط پس از READY/current و پاسخ200 با انتظار مصوب completed ثبت کرد؛ GET عمومی مستقل هم پاسخ درست داد.

هر دو مقصد از نام آزمایشی launchlane-sre-direct-check استفاده کردند؛ پیش از هر create، absence404 و پایان/cleanup چرخه قبلی مشخص بود. نام به‌تنهایی به مالکیت تبدیل نشد؛ ID برگشتی هر چرخه در journal و cleanup تطبیق داده شد. هر دو با یک DELETE و GET404 بسته شدند و سرورهای موقت متوقف شدند. نشانی &lt;deployment-origin&gt; پس از cleanup نمونه فعال نیست. env write و ساخت شبکه صفر بودند؛ صورتحساب قطعی از شمار درخواست یا token نتیجه نمی‌شود.

این دو مورد **اصلاح قبل از انتشار** را ثابت می‌کنند. در چرخه دوم انتشار اولیه ناسالم و سپس redeploy انجام نشد؛ مدل پیش از اولین انتشار تست را خواند و اصلاح کرد. شاهد تاریخی آن مسیر با شاهد تازه این تجربه یکی نیست. تغییرهای پایانی channel/lock به regression مستقل نیاز دارند؛ فقط وجود این دو رسید، تأیید همه source نهایی نیست.


<a id="guided-publication-failureهای-حفظشده"></a>

### failureهای حفظ‌شده

شروع نخستِ harness زنده به‌دلیل resolve کردن env خصوصی نسبت به cwd export شکست خورد؛ مدل و write صفر بودند. مسیر از محل module مشتق شد. تلاش بعدیِ پروژه خراب، نامی خارج allowlist پیشنهاد داد؛ policy قبل از API آن را رد کرد، 11 درخواست مدل و صفر write داشت. validation نام پیشنهاد اکنون خطای قابل اصلاح به همان call ID می‌دهد؛ scope، allowlist و مجوز write گسترش نیافتند. ورودی اولیه و آزمون بدون API حفظ شدند.

راه‌اندازی سرور browser-test در بار هم‌زمان، cold response بیش از2s داشت و timeout500ms harness کافی نبود. readiness با سقف کلی45s و درخواست3s محدود شد؛ oracle محصول تغییر نکرد. خطای focus بازگشت launcher نیز در browser پیدا و رفع شد. آزمون نخست container در cleanup timeout شکست خورد؛ اثر آن موفق ثبت نشد و همان ID بعداً absent بود. تکرار مستقل sandbox گذشت.


<a id="guided-publication-بررسی-محلی-و-حدود-باز"></a>

### بررسی محلی و حدود باز

قراردادهای تازه، join هم‌زمان، body/path/secret/schema، تغییر source، قفل مشترک، expectation ثابت، خطای نام مقصد پیش از API و channel فقط‌خواندنی را می‌سنجند. مرورگر تازه 17 حالت در320/360/390/768/1280، ارتفاع کوتاه، متن200٪، keyboard، focus، draft، URL و replay را با مدل مصنوعی و صفر درخواست خارجی گذراند. بازبینی بصری screenshot انجام شد. شمار نهایی build/lint/domain/HTTP و suiteهای مرورگر در verification ثبت می‌شود؛ نتایج subset با revision دیگر به یک full pass تبدیل نمی‌شوند.

مرزهای باز: آماده‌سازی dependency/build عمومی Node و Next، نصب قفل‌شده، env امن و merge/readback، مسیر GitHub دارای build روی UI جدید، شکست واقعی انتشار→repair→redeploy در همین تجربه، runtimeهای دیگر، reader تازه، screen reader و صفحه‌کلید موبایل فیزیکی. UI یا تست synthetic، شاهد این قابلیت‌ها نیست. هسته مأموریت همچنان partial است.

<a id="interactive-launch-artwork"></a>

## Interactive launch illustration — 2026-10-28


<a id="interactive-launch-artwork-follow-up-explicit-playback-under-reduced-motion--2026-11-04"></a>

### Follow-up: explicit playback under reduced motion — 2026-11-04

The original behavior below is historical. A fresh built Chromium baseline on
`4e4585ee6f05885559684e37107d25af0b17509c` reproduced the reported static click with
`prefers-reduced-motion: reduce`: JavaScript set `playing=false`, and the replay CSS
was restricted to `no-preference`. The normal-motion baseline did play. This establishes
a reproducible cause, not a read of the user's actual OS settings.

Explicit click/Enter/Space/touch now plays the finite 1800ms light transfer, cloud glow
and check reveal in either preference. Reduced motion still disables idle floating,
pointer tilt, layer lifting and halo scaling; changing the preference to reduce cancels
an active playback. Rapid activation restarts the existing scene and retains focus.
The requested sentence and its unused styles were removed. No new dependency, API,
provider call or publication path was introduced.

Validation used a same-drive frozen snapshot at
`<private-validation>`, Node24.18.0,
Next16.4.2 and the existing installed lockfile dependencies. Concurrent database edits
were replaced by their HEAD bytes only in this disposable validation copy. Main source,
index, running servers, credentials and real state were preserved.

- `npm run build -- --webpack`: passed, including TypeScript compilation.
- `npm run typecheck`: passed on the final snapshot.
- `npm run lint`: passed with zero errors,48warnings and22infos in the unchanged repository baseline; the three changed runtime/test files have no diagnostics.
- `node node_modules/@biomejs/biome/bin/biome lint src/components/LaunchArtwork.tsx src/components/LaunchArtwork.module.css scripts/test-artwork-browser.mjs`: passed without diagnostics.
- `node scripts/test-artwork-browser.mjs`: 10 layout/accessibility states passed; packet geometry, opacity and path progress change under both preferences, repeated replay, Enter/Space, touch, cancellation, unmount, responsive and enlarged text passed. Zero page errors, external requests or interaction writes.
- `npm run test:studio`: 43 states passed, zero browser errors/external requests/cloud writes; two model calls used synthetic transport.

Private baseline/probe output, failed-before regression, screenshots and final logs are
in `<private-validation>`; final browser artifacts remain in the
disposable snapshot. The generic design-kit self-test was rerun and again returned
`12/52 checks passed = 23%`, exit1, including its unavailable Playwright dependency.
It is a kit self-test, not a Launchlane score; the product's installed Chromium and
axe checks above passed. No dependency was installed or assertion weakened to hide it.
Graph discovery and coverage were unavailable (`Transport closed`); exact component,
caller, styles and browser harness source were read instead. No domain/HTTP/Docker,
live provider acceptance or deployment of the active product is claimed by this UI fix.


<a id="interactive-launch-artwork-original-implementation-and-validation--2026-10-28"></a>

### Original implementation and validation — 2026-10-28

Scope: the existing source-to-cloud illustration in `WorkspaceIntro`, with no deployment, agent, provider or persistence behavior changes.


<a id="interactive-launch-artwork-behavior"></a>

### Behavior

The original SVG is now the `LaunchArtwork` client leaf. A native button gives it pointer, keyboard and touch parity. Pointer movement updates two local CSS variables through one scheduled animation frame; it does not render React on every move. The illustration tilts gently, source layers spread on hover, the cloud glyph glows, and click/Enter/Space replays a short source-to-cloud light pulse with a cloud halo and check-stroke reveal. The nearby caption describes a visual demonstration. No server request, model run, real approval or publication is started.

Rapid activation restarts the scene without moving button focus. Pointer leave/cancel, blur and unmount clear the scheduled pointer frame. A reduced-motion change during playback stops the animation; reduced-motion activation retains static emphasis, and the two original isometric projection matrices remain intact. The existing compact layout below768px and the two tabs/optional chat stay unchanged.

No library, package or asset dependency was added. Styling uses the existing palette/type/space tokens, four named artwork motion/depth tokens and a scoped CSS module. Global deployment/migration components were not edited.


<a id="interactive-launch-artwork-validation"></a>

### Validation

The isolated same-drive snapshot is based on `095229c` plus only this UI slice, excluding the concurrent migration/runner working changes. It uses Node24.18.0, Next16.4.2, the existing installed dependency junction and disposable operator state; no `.env.local`, real credentials, production database or ledger was copied. The main server/port3000 was not restarted.

- `npm run build -- --webpack`: passed, including Next's TypeScript compilation.
- `npm run typecheck`: passed on the final snapshot.
- `npm run lint`: zero errors,48warnings and22infos; the four changed component/style/browser files separately have no diagnostics.
- `node scripts/test-artwork-browser.mjs`:10 measured layout/accessibility states passed. Actual normal flight, rapid replay, real Tab/Shift+Tab focus, Enter/Space, touch replay, pointer reset, changing motion preference and unmount during playback passed. Widths280/360/768/1280 and200%text were checked. No page errors, external requests or interaction-triggered mutations occurred; live model/provider gates were off.
- `npm run test:studio`:43 existing Chromium states passed, zero browser errors/external requests/cloud writes. Its two model requests used the existing synthetic transport.

These are UI acceptance checks on that snapshot, not a complete domain/HTTP/Docker pass or a production rollout. Runtime UI inputs were matched to the shared source before delivery; concurrent backend work has its own validation responsibility.


<a id="interactive-launch-artwork-visual-evidence-and-retained-failures"></a>

### Visual evidence and retained failures

Private evidence: `<private-validation>`. It contains before/after images, the frozen source manifest, actual browser reports, logs and an animated GIF captured from the built UI. The before capture reused an isolated r6 build only after verifying byte equality of `WorkspaceIntro` and all relevant global/studio/token/mobile/motion styles to the pre-edit source. It is an illustration comparison, not a whole-current-backend baseline.

The first focused lint found the small decorative replay SVG needed its own `aria-hidden` attribute. Initial browser harness assertions incorrectly treated programmatic mouse focus as keyboard `:focus-visible`, and expected an unset pointer variable instead of numeric zero on touch; they were replaced with actual Tab navigation and a numeric zero-drift assertion. The original assertions failed before the final passes. The new CSS specificity warning was removed by ordering the rules; no rule was disabled.

The design kit's own `accuracy_report.mjs` was also run in its installation directory with a required browser. Its literal result was `12/52 checks passed = 23%`, exit1, including unavailable Playwright in that separate kit and failures in the kit's sample/spec/hook files. That self-test is not a Launchlane score or acceptance pass; the product's actual installed Chromium/axe checks above supply the UI evidence. No kit dependencies were installed and no product gate was weakened to hide those failures.

<a id="lifecycle-refresh"></a>

## Destination controls refresh — 2026-11-04

After mounting before destination creation, ProjectLifecycle retained app=null because its load depended only on projectId. AgentPanel now remounts that existing component on a successful destination/publication action ID. Its heading also names start/stop/delete. Existing authenticated API, server decisions, single-send journals and the verified-stop prerequisite for deletion are unchanged; no schema/dependency change.

Against d0025cb, `node scripts/test-lifecycle-refresh-browser.mjs --baseline` reproduced one initial null lifecycle read and absent controls after a successful UI receipt. After the fix, lint (existing warnings), typecheck, build, the new Chromium test, project-library browser19states and HTTP48/48 passed under the shared OS lock. The test uses a controlled synthetic terminal receipt and actual lifecycle GET/Store: controls appear without reload, keyboard opens them, delete remains unavailable before verified stop, three widths have no overflow/axe violations, and reload preserves access. The existing library suite separately exercises stop/start/delete/replay with synthetic provider. No real model call or cloud write; these are UI/application regressions, not live stop/delete acceptance.

Local evidence: `<private-validation>`; screenshots/results in `.artifacts/lifecycle-refresh/2026-11-04T11-22-25.553Z/`. The owner destination was not stopped or deleted.

<a id="native-proposal-progress-20261027"></a>

## Native proposal progress and selected build evidence, 2026-10-27

Acceptance: AC17/19/26/27/32, partial. This continues the capability corpus through the actual web mission. It does not complete multi-service planning or public application acceptance.


<a id="native-proposal-progress-20261027-actual-failure-before-this-correction"></a>

### Actual failure before this correction

Committed source `017298e` (575 Git blobs, tar SHA-256 `7250c031c1c3613b7dddddae0386ef7c733e5411ca8e6edaffaab4f276476326`) was built on the existing Linux VPS using pinned cached Node 24.18.0 and the existing exact dependencies. The bounded Webpack build exited 0 in 212 seconds with no OOM. No dependency was downloaded. A separate authenticated loopback preview served this backend and UI; the production container stayed on image `a547236e…`, healthy with zero restarts.

Actual Chromium opened the primary publication page, verified account/team and source selection, and pressed the product's publication button with the original `/` / HTTP200 / `قدم` criterion. HTTP201 registered run `a2827932-6653-4957-9602-132eec9d03b9` for selected artifact `3d84deb66186fa8e0e8ae9bf67d8147d6078c490df2caf952e256e469bd11542`. The model chose four successful reads: project inspection, destination, catalog and networks. Its fifth request finished with another permission question instead of a proposal card. Usage was five model requests, four tools, 35,327 reported tokens and 30,183 ms active time. Infrastructure attempts: zero. This was a failed progress boundary, not a successful deployment.

The code/configuration offered `propose_destination` at this stage. Inspection also incorrectly used a generic “build has not been verified” limitation even for a selected compiled artifact with a successful host build. Those are observed product defects; the individual causal contribution of the generic limitation to the model's choice is not established by that first run alone.


<a id="native-proposal-progress-20261027-shared-correction"></a>

### Shared correction

The local compiled-artifact verifier now rechecks the selected archive, compiled output, original plan and successful container receipt independently of cloud environment verification. Publication and storage still call the wrapper that additionally requires the real matching verified environment reference. Inspection reports the stored build's time, original workload, requested-test result and API paths; it states that no code ran during inspection and that cloud publication/persistence are unverified. Changed provenance fails closed. The local receipt cannot manufacture a v9 environment decision or prove current cloud health.

Destination/account/catalog/network reads now carry their actual account/team scope, and inspection carries project/source identity. The host supplies a stable source-bound application-name suggestion when no genuine name choice is required. This is a suggestion, not an availability claim or approval.

For a structured publication mission with a supported source, no pending write, a known eligible offer and one network, a permission-only finish cannot replace the actual review card. The host returns a typed `PROPOSAL_REQUIRED` correction to the model. It still chooses tools/arguments, and the existing proposal service revalidates current price, identity and network membership. Older or foreign account evidence requests fresh authorized reads. A genuine network/name choice, unknown price/credit, a source mismatch, failed reads or unresolved required resources is not converted into a fabricated selection. User prose cannot supply host tool receipts. Two corrections are the limit; continued non-progress fails within the same stored allowance without a send. Call IDs remain unique, and model text cannot create consent.


<a id="native-proposal-progress-20261027-validation-and-boundaries"></a>

### Validation and boundaries

Fresh regressions reproduce the old redundant-permission completion and missing selected-build evidence. An initial fixture omitted a RunBudget import and a scoped synthetic transport credential; those fixture defects were corrected before the meaningful before/after comparison. One positive assertion also assumed that a tool result was the last model message; the existing authoritative host-state system message follows tool history, so the assertion now locates the actual last tool result while retaining the same required card, preserved criterion and zero-write oracle.

The focused set covers actual registry/proposal services with synthetic account/model transports, account/source/price/resource mismatches, forged user prose, two different networks, bounded repeated finishes, duplicate call IDs and corrupted build provenance. It separately requires cloud publication to remain blocked when the environment receipt is absent. Selected-snapshot and subsequent native continuation results are recorded below when measured.

The focused before/after set passed 29/29, including the original fullstack, disk and publication regressions. Type generation/checking and scoped lint passed. A separate export of selected tree `93b940a1b6efb9ea3dd5a212116da665de3cc558` contained 578 tracked blobs and no matches against the installed private values. It passed 703/703 domain tests (220,930 ms), 40/40 HTTP checks (8,873 ms), type generation/checking and the production Webpack build. Lint had zero errors, 48 warnings and 20 informational diagnostics. No provider/model was used in those suites.


<a id="native-proposal-progress-20261027-same-native-mission-after-the-correction"></a>

### Same native mission after the correction

The exact selected tree was packaged as tar SHA-256 `83cffcde0926be20bd0ff62ddeb991127f8c707ba687b2690327d79cd3a6e563` and independently verified file by file on Linux. A bounded offline build on the existing VPS exited 0 after 218 seconds, with no OOM. The previous private preview was gracefully stopped after confirming its PID, user, working directory and paused mission. The new preview became the sole owner of that same isolated state. Only an authentication session was renewed; the model ledger, phase allowance, stored run limits, usage and original source/workload were preserved.

The first browser attempt found that the earlier SSH tunnel had ended. The next harness attempt incorrectly expected private usage counters in the public Agent view, where they are intentionally absent. Neither attempt sent a continuation. After checking the preview directly and restoring the private tunnel, the harness used the host bootstrap's usage receipt and the public run identity/state, without weakening the same-mission or zero-write requirement.

Actual Chromium pressed **ادامه همان مأموریت**. HTTP200 resumed the same run `a2827932-6653-4957-9602-132eec9d03b9`. The real model selected `read_destination`, `quote_resource_plan` and `propose_destination` in three further requests. The shared application service fetched current account/network/catalog evidence and produced a v8 review card for `launchlane-c03e2b4b`, Node24, the existing network, `small-g2/basic` and the same artifact `3d84deb6…`. The observed base price at 08:05 UTC was 1,041.66 toman/hour, excluding tax, traffic and additional storage. This is historical proposal evidence, not a standing approval or current-price guarantee.

The mission reached `needs_approval`, with no question, error, infrastructure attempt or remote change. Cumulative usage was eight model requests, nine tool-budget units, 62,939 reported tokens, no unknown-usage request and 43,035 ms active time; limits stayed 24 model requests / 160 tools / 600,000 ms. Browser readback and screenshot showed the actual cost card and separate approve/reject controls, with no browser page error. The model-request observer recorded offered tool names, request sizes and response status only, behind the existing budget guard; it recorded no source content, prompt text or credential.

This continuation verifies proposal progress in the actual product. It did not exercise the new finish-correction branch or refresh `inspect_project`; those remain supported by the focused regressions rather than this live trajectory. The before/after does not isolate which guidance/read change caused the model's different choice. No card was approved. Cloud environment, disk, release, restart persistence, raw-source preparation through this mission and broader application topology remain unverified. The public production image stayed `a547236e…`, healthy, zero restarts and no OOM.

No original repository or business database was modified. No new Liara resource, phase allowance or `phase_reserves` allocation was created. Model requests use normal per-request reservations/settlement in the existing shared ledger/phase; credit is not copied or renewed. The production image remains unchanged. The original nine-project corpus and [its unresolved boundaries](../deployment-corpus.md) remain the acceptance target.

<a id="project-library-and-environment-import"></a>

## Project library and private environment import — 2026-10-23

Scope: A03/A07/A08/A17, AC22/AC23/AC24/AC32. [ADR0022](../decisions/access.md#0022-project-library-and-private-environment-import).


<a id="project-library-and-environment-import-semantic-oracles"></a>

### Semantic oracles

- An actual browser-selected folder supplies source bytes plus separately classified environment input. Source snapshot/manifest/archive must not contain `.env` or its private values. Original files remain unchanged.
- Imported values are encrypted and bound to actor/source, never returned in public results or persisted agent messages. The existing environment action preserves target keys and requires its valid human decision. One reviewed change yields at most one write; readback yields the same secure build reference.
- Unsafe local addresses/substitutions, infrastructure credentials, malformed/tampered inputs, private/public confusion and changed source stop before a provider write.
- Project listing is actor-scoped. Opening another persisted snapshot validates source/archive and target, invalidates unused authority on the server, preserves both histories and does not create a run, model call, artifact or cloud mutation. Unknown actions/external executions prevent a switch.
- Mobile, keyboard focus, reload, empty state and restored history work through the actual UI/API; historical completion does not advertise present health.


<a id="project-library-and-environment-import-implementation-and-boundaries"></a>

### Implementation and boundaries

Implemented browser folder import, authorized operator-local environment reading, encrypted private inputs, public name-only review and reuse of v9 merge/claim/readback/environment reference. Root `.env` overlays only; execution keys are controlled independently. GitHub private-file ingestion, interpolated configuration, database provisioning/application connectivity and live publication with these new imported inputs remain UNCONFIRMED.

Implemented the existing-header library, paged snapshots/latest mission state and server-owned sequential source/target activation. It does not enable concurrent publication or create an alternative execution engine.


<a id="project-library-and-environment-import-checks"></a>

### Checks

Final application candidate27 is exported from base `605628eb8447bc817a37c1d5b03ed90c491b96c8`, immutable tree `fab532ca7cea7010928875d3d25ad2f113e5ab65`. Its322runtime/test/config files match normalized SHA-256 digest `ba359f8631b0d541d0e2e8140f2d22e33cc9aff16144d618ad043b38092a65ca`, with zero mismatches. Concurrent uncommitted UI hunks and unfinished MCP setup/migration16 are excluded, preserved in the shared working tree and not accepted by these checks.

Fresh checks on that export:

| Check | Observed result | Boundary |
| --- | --- | --- |
| `npm run lint` |0errors,39warnings,10infos | Existing stylesheet specificity/other warnings remain |
| `npm run typecheck` |Passed | Actual Next route generation and TypeScript |
| `npm run build` |Passed | Production build used by the browser/HTTP checks below |
| `npm run test:domain` |361passed,0failed/skipped | Temporary SQLite, real filesystem, synthetic service/model transports |
| `npm run test:http` |38passed,0failed/skipped | Isolated production server, protected boundaries and synthetic providers |
| `npm run test:projects` |10states passed | Actual folder chooser/upload, encrypted input, reviewed synthetic env update/readback, empty/single/two-project library,320/390/280/768/1280 layouts, restore/reload/focus;0model calls,1synthetic env write |
| `node scripts/test-folder-browser.mjs` |2widths passed |360/1280, real device-directory selection outside operator workspace, original unchanged, reload/Escape/focus, vault content verified independently |
| `node scripts/test-guided-browser.mjs` |54states passed |320/360/390/768/1280, existing cancellation/secure entry/decision/progress oracles retained; synthetic model/provider |
| `node --test tests/sandbox/environment-build.test.ts` |1actual container case passed,13627.79ms test duration | Folder `.env`→encrypted input→reviewed synthetic config→same mission/reference→real Node22 isolated install/build/test/start/HTTP→descendant artifact; secret output redacted, no secret in archive, exact job container removed |

Browser outputs under candidate27's ignored `.artifacts`: `project-library/2026-10-23T11-52-07.275Z`, `folder/2026-10-23T11-52-19.506Z`, `guided-publication/2026-10-23T11-52-36.227Z`. Tested new states have0axe violations,0page errors and0external browser requests. The mobile/desktop two-project history and imported-env screens were visually inspected. Physical mobile, screen-reader and fresh-user acceptance remain UNCONFIRMED. This is an appropriate regression set, not a fresh pass of every repository/browser/runtime suite.

Application source in candidate26 already passed361domain/38HTTP/8new-interface/2folder/54guided checks. Candidate27 additionally strengthens the real-container oracle to import its fixture directly from `.env` and captures two-project UI states. Results above are fresh on candidate27; older counts are not added into them.


<a id="project-library-and-environment-import-capability-reconciliation"></a>

### Capability reconciliation

| Capability | Existing task/AC | Implementation/evidence | Status | First unproven boundary |
| --- | --- | --- | --- | --- |
| Actor-scoped project library, sequential switching |A03/A17,AC24/32 | Shared Store/AgentRepository, source/archive revalidation, target identity, atomic invalidation; domain and browser checks above |implemented_verified (local) | Fresh reader/physical device; arbitrary runtime/project layouts |
| Browser and authorized local `.env` import |A07,AC22 | Separate multipart/private vault; local bounded file reader; no source/archive secret; UTF-8/actor/tampering/rollback regressions |implemented_verified (bounded local) | Nonstandard/nested configuration, private GitHub config ingestion |
| Imported config through shared approval/merge/readback/reference |A05/A08,AC22/23 | Existing v9 policy and journal; real HTTP application path with synthetic Liara transport |implemented_verified (synthetic provider) | Live environment update and real application connectivity |
| Imported configuration used by actual build/test/start |A07/A08,AC22/24 | One actual isolated Node22 case above, original test oracle and artifact checks |implemented_verified (bounded container) | Other runtime families and real cloud release with these inputs |
| Automatic database provisioning/connection |A05/A08,AC22 | Not established by importing a local connection string |partial | Actual small database, secret reference and application connection |


<a id="project-library-and-environment-import-reproduction"></a>

### Reproduction

Use the project's pinned Node24/npm/lockfile setup. After `npm run build`, run `npm run test:projects` for the focused application/browser scenario and `node scripts/test-folder-browser.mjs` for the native directory regression. Chromium must already be installed. The separate container command requires the project's pinned Node22 image and Linux Docker engine; it is not a Liara deploy command.

In the product, choose a project folder normally. The preview identifies root environment files separately from source. When the mission needs those keys, select **مرور و استفاده از تنظیمات پوشه** and review the actual destination/key names; only the valid decision allows the shared updater to proceed. The values are not retyped or sent through chat. Open **پروژه‌های من** beside account controls to return to persisted snapshots. A removed/changed source or inaccessible recorded target needs a fresh selection/account review; an uncertain operation must be reconciled before switching.

The new automatic operator-local import exposed two test assumptions: a fixture already contains `.env`, so a later snapshot correctly has its own input rather than an empty vault; public-key denial must preserve the pre-existing encrypted-input count rather than assume an empty database. Original denied input and zero-provider-read/write assertions remain. Failed expectations are retained in ignored local test logs; neither provider oracle was weakened.

The first browser runner failed before product interaction because it opened SQLite before creating the isolated state directory; initialization now occurs inside cleanup coverage. Candidate24 then failed the environment-form wait because the seeded run used a different team configuration from its server. It now asserts the exact connected target before opening the form. Candidate25 passed8new UI states and the complete imported-input → approved synthetic update → readback path, with zero model calls. Its independent folder test exposed an invalid network oracle: Playwright/CDP's `postDataBuffer` omits file contents, so it cannot prove their presence or absence. The replacement checks the separate multipart field, decrypts each received source-bound fixture through the actual vault, verifies the expected value and confirms no `.env` manifest/plaintext vault entry. The original fixture marker is retained. This changes the faulty observation method, not the secret-isolation requirement.

Screenshots on candidate25 exposed the browser-default square white border/background on the library, despite passing axe/overflow. The library now explicitly uses shared surface/border/radius/overlay tokens and bounded scrolling. Invalid UTF-8 rejection and redaction of imported values even under a public-looking name were also added before the final candidate.

No paid model request or live Liara write has been made for this slice. Existing allowance is unchanged; unknown subscription costs remain unknown. Synthetic environment readback is not live workload verification.


<a id="project-library-and-environment-import-primary-local-server-handover"></a>

### Primary local server handover

The existing server on `http://127.0.0.1:3000` still returned404for the new library route after source delivery. This was a real running-build gap. The configured operator login identified the existing service, and read-only state inspection found schema15,0active/uncertain actions and0queued/working runs. A consistent SQLite backup was made before stopping its exact listening process. The first ordinary Windows stop failed with `Access is denied`; following the owner's explicit instruction to stop it, the standard elevated Windows helper stopped only that verified Node/PID/port. It did not change account resources or network/VPN settings.

The tested candidate27 application (code matching commit `9be6df6`) now runs on the same origin with the original absolute state/workspace paths, credentials, session-signing key and existing gates. It remains the single execution-store owner. The installation-local model hook uses the existing cumulative ledger/allowance and does not renew it. Concurrent unstaged UI edits remain on disk and were not overwritten or represented as this candidate's acceptance.

At `2026-10-23T12:09:19.009Z`, authenticated library GET returned200 and actual Chromium rendered the same16persisted snapshot rows, with0page errors and the pre-handover verification session still valid. Evidence is in ignored `main-current-browser/result.json` and `projects-1280.png` under the authority-mission directory. The temporary verification session was then revoked; the user's existing sessions were not revoked. No publication, worker or model was started by this check.

Aggregate BoxAPI phase readback remained70requests/664482reported tokens, conservative consumed ceiling0.668007USD and0.131993USD remaining from the same0.8USD authorization. These are cumulative ledger figures, not a provider invoice or a new allowance. External subscription cost remains unknown. Source/customer data were retained, no cloud cleanup was necessary and no cloud resource was created by the handover.

<a id="project-removal-and-env-response"></a>

## حذف پروژه، توقف/حذف مقصد و خطای فرم env — ۲۰۲۶-۱۰-۲۳


<a id="project-removal-and-env-response-candidate-و-مرز-شاهد"></a>

### Candidate و مرز شاهد

Candidate نهایی runtime: `candidate-35`، base `a838440791ce03a0b3b2271031785de2fffeb4b2`، tree `ef28adf03bea64e9ee7e462b08348b53925382f2`؛336 فایل runtime/test/config با digest `465aebf90be741b14562fe05848a4b9be0000129d354ba6989adef110de82eae` و صفر اختلاف. export از index خصوصیِ ثابت ساخته شد. تغییرات هم‌زمان و unstaged همکار در CSS و پنل‌ها وارد آن نشدند. افزودن این سند، TASKS و acceptance فقط مستندات را تغییر می‌دهد.

روی همین candidate35، build، typecheck و lint با صفر error،39 warning و12 info گذشتند.370/370 domain،39/39 HTTP،14 حالت مرورگر پروژه‌ها،12 حالت انتخاب پلن و54 حالت guided publication گذشتند. عرض‌های280/320/390/768/1280 در runner پروژه‌ها و320/360/390/768/1280 در guided پوشش داده شدند؛ axe/overflow و خطای صفحه طبق oracle runnerها بررسی شدند. تصویر فرم دستی320 و1280 و تأیید حذف320 نیز بازبینی بصری شدند. این subset مرتبط است؛ full aggregate همهٔ browser/sandbox/runtimeها در این revision اجرا نشده است. نتیجهٔ revisionهای مختلف به عنوان full pass واحد جمع نمی‌شود.


<a id="project-removal-and-env-response-root-cause-فرم-welcome_message"></a>

### Root cause فرم WELCOME_MESSAGE

خواندن مجاز و بدون write از `sample-welcome`، هویت مورد انتظار و فیلدهای env برابر `key,value,encrypted,_id` را نشان داد؛ مقدارها چاپ یا ذخیرهٔ عمومی نشدند. adapter این دادهٔ provider را به validator دقیق ورودی کاربر می‌داد و همان `INVALID_INPUT: ورودی دارای فیلد ناشناخته است` را به فرم برمی‌گرداند. خطا مربوط به متن واردشدهٔ کاربر نبود.

fixture قبلی فقط key/value داشت و این شکاف قرارداد را نمی‌دید. با افزودن metadata مشاهده‌شده،12 مورد از14 تست env در اجرای اولیه شکست خوردند. adapter اکنون key/value را در مرز provider استخراج می‌کند، نوع/تعداد/هویت را همچنان اعتبارسنجی می‌کند و encrypted=true را بدون شاهدِ قابل merge رد می‌کند. هر14 تست پس از اصلاح گذشتند. provider response خراب دیگر به صورت اشتباه به ورودی کاربر نسبت داده نمی‌شود. ادعای live env write از این read-only probe نتیجه نمی‌شود.


<a id="project-removal-and-env-response-رابط-واقعی-با-provider-مصنوعی"></a>

### رابط واقعی با provider مصنوعی

runner پروژه‌ها از مرورگر Chromium، پوشهٔ واقعی و API واقعی محصول استفاده می‌کند؛ hook شبکه هر میزبان بیرونیِ ثبت‌نشده را رد می‌کند. مقدار خصوصی پوشه از ورودی رمزگذاری‌شده به همان پیشنهاد/تأیید/merge/readback می‌رسد. مسیر دستی با metadata واقعی provider، دکمهٔ چشم، پنهان‌سازی دوباره و پاک‌شدن مقدار پس از submit بررسی می‌شود. screenshot مقدار واقعی کاربر ندارد.

حذف محلی با انصراف، Escape، focus روی انصراف، تأیید و refresh سنجیده می‌شود. مقصدِ دارای اثر ابری قبل از حذف از فهرست به توقف/حذف هدایت می‌شود. دو write مصنوعی stop/delete دقیقاً یک بار، بازخوانی و reload رسید و سپس حذف از فهرست بررسی می‌شوند. نوع receipt نمونه‌ها در این fixture `instances_absent` است؛ جای محدودیت زنده را نمی‌گیرد.

برای مراحل، یک activity و نتیجهٔ correlated به یک ردیف تبدیل می‌شوند. succeeded/failed از outcome میزبان یا JSON معتبر result همان call ID می‌آیند؛ متن آزاد تاریخچه، موفقیت محسوب نمی‌شود. تغییر پلن با نگه‌داشتن موقت درخواستِ واقعی در مرورگر تست می‌شود: پیام loading و disabled شدن انتخاب‌ها باید قبل از پاسخ دیده شوند. همان run در پنل دستیار و وب حفظ می‌شود؛ این delay، latency واقعی لیارا را اندازه‌گیری نمی‌کند.


<a id="project-removal-and-env-response-آزمون-زنده-محدود-بدون-مدل"></a>

### آزمون زندهٔ محدود؛ بدون مدل

برای آزمایش چرخهٔ عمر، یک سرویس کنترل‌شدهٔ کوچک Node22 بدون dependency ساخته شد؛ این پروژهٔ واقعیِ متنوع یا پذیرش یک runtime تازه نیست. source از API انتخاب/آماده‌سازی محصول وارد شد. oracle از ابتدا JSON با revision `lifecycle-v1` و status200 بود. اپ، کوچک‌ترین پلن منتخب این آزمون و شبکهٔ موجود، همگی به یک scope محدود شدند؛ hook مستقل هر نوع write را حداکثر یک بار مجاز می‌کرد.

| مورد | هویت / مشاهده |
| --- | --- |
| Candidate ایجاد و publication | candidate29، tree `5c2d6d579a61fd3184011dc22caa42a663f6fde6` |
| Candidate ادامهٔ همان receipt و حذف | candidate30، tree `a4b381cd14238bb56818d2c8991ee90c439e1aa5` |
| Source flow | `b56cf65e-6e6d-4b3f-8fa7-ef48ddec5c9a` |
| Source hash | `5e2fa67c163e1da55dbf111b2f9b8f8fd2d58d235dbb29c3eae791ab62d29f71` |
| Archive | `c0f10d7da40dd3dc6cf528880f16f127dfb80af8581ded2bab9f8aae29c87e15` |
| Destination action | `85f7776b-6a80-44ab-9edc-101561b9fcb7` |
| App | `launchlane-lifecycle-qa-102312` / `<resource-id>` |
| Publication action / release | `bc347377-c911-4450-84f0-5f8a9965d8ed` / `<resource-id>` |
| Stop action | `f55cb9a1-f3e3-4db1-92f2-743f697b0330` |
| Delete action | `f9229a90-0cb8-406c-8a4a-4f4d4a11cc6d` |
| Native runtime / plan | Node22 / small-g2 + basic؛1041.66 تومان در ساعت، بدون مالیات/ترافیک/ذخیرهٔ اضافی |
| Existing network | `<resource-id>`؛ شبکه‌ای ساخته یا حذف نشد |

Publication در اولین READY، پاسخ503 گرفت و به‌درستی failed/WORKLOAD_MISMATCH شد؛ این شکست حفظ شده است. بعداً همان سرویس از public origin پاسخ200 و JSON `status=healthy,revision=lifecycle-v1` داد. این خواندن مستقل، action شکست‌خورده را موفق نمی‌کند. فاصله با آماده‌شدن routing سازگار است؛ علت دقیق503 پایین‌دست اثبات نشده و سیاست bounded انتظار پس از READY هنوز شکاف A08 است.

Stop در12:57:46UTC یک POST انجام داد. همان ID با scale صفر خوانده شد؛ applets500 بود و candidate29 uncertain ماند. پس از اصلاح تفکیک receipt، candidate30 همان action را فقط با read ادامه داد و `verification=configuration` ثبت کرد. نبود نمونهٔ اجرایی زنده UNCONFIRMED است و UI آن را اعلام می‌کند. Delete در13:04:44UTC یک DELETE200 انجام داد؛ GET همان مقصد404 شد و در13:04:45UTC سابقهٔ source از library کنار رفت. URL قبلی لینک فعال نیست.

در مجموع یک create، یک upload، یک release، یک stop و یک delete واقعی ثبت شد؛ repair job در این سناریو وجود نداشت. مدل داخلی یا میزبان بیرونی اجرا نشد. تعرفه مشخص است؛ صورتحساب نهاییِ قابل انتساب به این برنامه، از اختلاف موجودی مشترک حساب نتیجه گرفته نمی‌شود و اندازه‌گیری نشده است. برنامه cleanup شده؛ شبکهٔ قبلی حفظ شده است.

خواندن مستقل با adapter خود candidate35 در13:21:18UTC نیز نبود همان app ID را تأیید کرد؛ write تازه‌ای انجام نشد. ledger جاری مدل78 درخواست/705123 توکن گزارش‌شده و سقف محافظه‌کارانه0.709037USD داشت. این سناریوی lifecycle صفر درخواست مدل داشت؛ مصرف هم‌زمان ledger به این تست نسبت داده نشده است. پس از دستور تازهٔ مالک، سقف قدیمی0.8 با سقف تجمعی2USD جایگزین شد؛ همهٔ rowها و baseline قبلی حفظ و تغییر اختیار جدا ثبت شد. باقی‌مانده در همان مشاهده1.290963USD است، نه بودجهٔ تکرارشونده برای subprocess/retry. مصرف اشتراک میزبان بیرونی و صورتحساب دقیق لیارا همچنان از این اعداد نتیجه نمی‌شود.


<a id="project-removal-and-env-response-شکستهای-محلی-حفظشده"></a>

### شکست‌های محلیِ حفظ‌شده

- Candidate29 domain:366/367؛ یک آماده‌سازی source در fixture قدیمی با deadline سه‌ثانیه‌ای cancelled شد. rerun همان provision suite به تنهایی9/9 گذشت. علت timeout همچنان UNCONFIRMED است؛ concurrency1 علت را ثابت نمی‌کند.
- Candidate30:368/368 domain؛ HTTP38/39. تست تازه نشان داد operation ناشناخته قبل از lookup رد نمی‌شد و404 می‌داد. route اصلاح شد؛ oracle همان400/INVALID_OPERATION باقی ماند.
- Candidate32:369/369 domain. Candidate34 علاوه بر اصلاح route، همبستگی receiptهای قدیمی، scope حذف پروژهٔ غیرفعال و پذیرش پاسخ مستند204 حذف را دارد. نتایج نهایی جدا ثبت می‌شوند.
- Candidate34:370/370 domain و39/39 HTTP؛ مرورگر در Escape خطای واقعی bubbling پنجرهٔ حذف به library را یافت. parent هم بسته می‌شد؛ stopPropagation روی cancel پنجرهٔ فرزند اضافه شد. آزمون plan پس از response و قبل از commit شدن state به DOM، checked را زود می‌خواند؛ انتظارِ همان radio بررسی‌شده اضافه شد و assert اصلی حفظ شد. این‌ها full browser pass قبلی محسوب نمی‌شوند.

پوشش همهٔ خانواده‌ها، DB، connectorهای اجرایی Claude/OpenCode و پذیرش کامل مأموریت همچنان از این برش نتیجه نمی‌شود. [ADR0023](../decisions/operations.md#0023-project-removal-and-stop-receipts) قرارداد و محدودیت‌ها را شرح می‌دهد.


<a id="project-removal-and-env-response-تحویل-به-نصب-اصلی"></a>

### تحویل به نصب اصلی

Commit `9bb87c1` از نظر runtime با candidate35 یکسان است؛ فقط شش سند پذیرش/شاهد/طراحی به tree آزموده‌شده اضافه شده‌اند. در13:28:42UTC سرور اصلی `http://127.0.0.1:3000` روی همین candidate بررسی شد. پیش از راه‌اندازی، backup سازگار SQLite گرفته شد و queued/working run یا action در executing وجود نداشت. PID قدیمی دیگر وجود نداشت و پورت آزاد بود؛ مالک اجرای دوم روی دیتابیس شروع نشد.

state/workspace اصلی، secret نشست و اتصال‌ها حفظ شدند. schema17 و17 رکورد پروژه باقی ماندند؛ ciphertext همهٔ اتصال‌ها با backup یکسان بود. Chromium واقعی روی نصب اصلی، فهرست17 پروژه در390/1280، بازکردن تأیید حذف و Escape بدون بستن library، focus برگشتی و صفر page error را بررسی کرد. حذف یا انتشار واقعی در این بررسی انجام نشد؛ action/run تازه صفر بودند و نشست آزمایشی جداگانه لغو شد. فایل‌های ثبت‌نشدهٔ همکار وارد کامیت/نسخهٔ frozen نشدند. این handover پذیرش پروژهٔ واقعی تازه یا live env write محسوب نمی‌شود.

<a id="publication-price-and-success"></a>

## قیمت خوانا و نتیجهٔ انتشار — ۲۰۲۶-۱۰-۲۳

درخواست مالک: قیمت‌های کارت پلن فونت خوانا و واحد محاوره‌ای داشته باشند؛ موفقیت انتشار و نشانی سایت در صفحهٔ اصلی واضح باشند.


<a id="publication-price-and-success-تغییر-و-حدود"></a>

### تغییر و حدود

- `d320874`: مبلغ کارت از فونت code به فونت متن رابط منتقل شد. نرخ کوچک به عبارت فارسی و مبلغ بزرگ به مقیاس هزار/میلیون با «حدود» و «تومن» نمایش داده می‌شود؛ نمونهٔ quote برابر۱۰۴۱٫۶۶ تومان در ساعت، «حدود هزار و چهل و دو تومن»، روزانه «حدود۲۵هزار تومن» و۳۰روز «حدود۷۵۰هزار تومن» است. اعداد از همان quote مشتق می‌شوند؛ نرخ تازه یا قیمت رسمی ماهانه ساخته نشده است. مقدار دقیق و محاسبات BigInt در «مبلغ دقیق پلن‌ها» باقی‌اند و این disclosure تصمیم radio را تغییر نمی‌دهد.
- `6e9cd5c`: فقط state موفق همان Action، کارت «سایت شما منتشر شد»، نشانی کامل همان workload، بازکردن سایت در زبانهٔ تازه و کپی لینک را نشان می‌دهد. نسخهٔ pending، failed یا uncertain کارت موفق نمی‌گیرد. کپی موفق/ناموفق بازخورد دارد؛ نبود clipboard راه کپی دستی را توضیح می‌دهد. جزئیات پس از موفقیت جمع و پیش از تصمیم بازند. اختیار، journal، معیار workload و backend انتشار تغییر نکردند.


<a id="publication-price-and-success-snapshot-و-بررسی"></a>

### snapshot و بررسی

candidate51 با کد `6e9cd5c985d2f0a759153b2757e9f50e67ac187e`، tree `ad5e9022800491534134cb57dbabcf701645024f`،۳۸۲فایل و digest `e1e8c4cc4e3e1f190b66312cf4739f3a7d3169325e1a7288bf896f2df9c2dd9a` بررسی شد؛ اختلاف snapshot با index صفر است.

| بررسی اجراشده | نتیجه |
| --- | --- |
| سه فایل domain مرتبط با خلاصه/هزینه، publication/expiry و runtime UI | ۱۱/۱۱؛ صفر fail/cancel/skip؛ از جمله حدود گردکردن، مبلغ دقیق و نبود موفقیت در stateهای ناموفق |
| Biome روی فایل‌های تغییرکرده و typecheck | موفق؛ SVG نخست aria-hidden مستقیم نداشت و lint آن را رد کرد؛ اصلاح و بررسی تکرار شد |
| production build نهایی | موفق؛ compiler و TypeScript و ساخت routeها تمام شدند؛ هشدار workspace/tracing موجود حفظ است |
| `npm run test:destination-plans` | ۱۴ حالت، از۳۲۰تا۱۲۸۰ و متن۲۰۰٪، keyboard/تغییر پلن، font بدون monospace، مبلغ کوتاه و disclosure دقیق؛ provider write/model صفر |
| `npm run test:publication-expiry` | ۸ حالت در۳۶۰/۱۲۸۰؛ صفر page error/external/model/provider attempt و تخطی گزارش‌شدهٔ axe/overflow |

مسیر رد انقضا در مرورگر از API واقعی محصول و state موقت استفاده می‌کند. موفقیت انتشار در این regression، projection مصنوعی پاسخ GET است و هیچ release پایدار جعلی ثبت نمی‌کند؛ موفقیت/عدم دسترسی clipboard نیز با adapter خصوصی همان مرورگر به handler واقعی داده می‌شود. بازکردن لینک واقعاً زبانهٔ تازه می‌سازد؛ مقصد آن در آزمون فقط با پاسخ مصنوعی همان URL پاسخ می‌گیرد. این تست‌ها انتشار زندهٔ تازه یا کیفیت مدل را ثابت نمی‌کنند. full domain، aggregate مرورگر و Docker در این delta تکرار نشده‌اند؛۴۴۱/۴۴۱ تاریخی مربوط به candidate49 است.

candidate50 ابتدا فقط قیمت را build کرد؛ درخواست بعدی مالک برای کارت موفقیت سبب snapshot51 شد. source snapshotها و شکست‌های اولیه دست‌کاری نشدند. به‌علت فضای محدود I، فقط cache متعلق به build50 با مسیر بررسی‌شده به پوشهٔ خصوصی C منتقل و حفظ شد؛ build51 cache را از همان محل استفاده کرد. source و state جابه‌جا نشدند.


<a id="publication-price-and-success-سرور-واقعی-و-حفظ-داده"></a>

### سرور واقعی و حفظ داده

پس از بررسی نبود action/run/job فعال یا uncertain و backup consistent سالم از state و دفتر مصرف، در۱۹:۱۳:۴۸UTC سرور اصلی۳۰۰۰ از candidate49 به51 منتقل شد. همهٔ ردیف‌های۲۸جدول state و۵جدول دفتر مصرف با backup همان لحظه برابر، hash تنظیمات یکسان و SQLite quick_check سالم بودند.۹فایل JS/CSS واقعاً سرو‌شده با51 SHA256 برابر و متن کارت تازه در bundle سرو‌شده موجود است. allowance یا reserve تازه‌ای ساخته نشد و این بررسی‌ها model/cloud write تازه نداشتند؛ فعالیت دستی قبلی کاربر از مصرف این برش جداست.

تب موجود خود کاربر، با همان پروژه و session، refresh و نتیجهٔ ذخیره‌شدهٔ واقعی Login بررسی شد: کارت جدید و لینک `<deployment-origin>`، بازکردن و کپی دیده شدند؛ ثبت دوبارهٔ mission یا انتشار لازم نشد. این مشاهده نتیجهٔ موجود را نمایش می‌دهد و health probe زندهٔ تازه برای سایت نیست. screenshot و logها خصوصی و خارج Git در `.local/login-demo-20261023/` و candidate51 نگه‌داری می‌شوند.

پوشهٔ مستقل Login خارج این مخزن جدا بازطراحی می‌شود؛ تغییر source اصلی آن، archive قبلاً uploadشده یا سایت جاری را خودکار عوض نمی‌کند. کاربر برای نسخهٔ تازه باید پوشه را دوباره در محصول انتخاب کند و انتشار همان artifact تازه را تأیید کند. انتشار کامل ترب/دادهٔ پایدار و ماتریس۱۴خانواده همچنان پذیرش باز قبلی خود را دارند.

<a id="publication-ui-local-runtime"></a>

## Publication UI and active local runtime — 2026-11-04


<a id="publication-ui-local-runtime-observed-problem-and-change"></a>

### Observed problem and change

The reported `<local-origin>` installation was built from the separate
`runtime-components` worktree at `efd696cfab0ac0c0ddb99cf9215873fc706479ad`.
It did not contain main's artwork replay/caption correction or MCP settings UI.
Changing main alone could not update this built production installation.

The existing artwork now replays on click, Enter/Space and touch; its old instruction
caption is removed. Explicit playback remains finite with reduced motion; ambient
motion still follows the preference. This is presentation only, with no job or write.
The existing guided MCP settings UI was transferred without changing access APIs,
policy, persistence or the runtime branch's platform implementations.

Plan quotes now use grouped Persian numerals and تومان, with exact hundredth-toman
precision from the existing real quote. For example, hourly 104166 hundredths is
۱٬۰۴۱٫۶۶ تومان; continuous 24 hours is ۲۴٬۹۹۹٫۸۴ تومان and 720 hours is
۷۴۹٬۹۹۵٫۲ تومان. No currency conversion, fabricated price, plan change or approval
change is introduced. The primary amount and currency have separate visual hierarchy.

GitHub readiness now resolves an explicitly configured executable in either auth
mode; otherwise it prefers the installed Windows private CLI and then PATH. An
explicit missing path never silently falls back. Existing private per-actor config
and credential isolation remain enforced. The missing-tool notice separates the
retry action from installer details; checking, failure and focus recovery are tested.
Readiness does not mean that an account has authenticated.

The existing official 2.103.0 ZIP was checksum-verified and its matching public
executable was installed into the runtime's ignored local tools directory. No new
download, global PATH change, account grant or credential copy was needed.


<a id="publication-ui-local-runtime-frozen-validation-not-a-combined-cross-revision-full-pass"></a>

### Frozen validation, not a combined cross-revision full pass

Node 24.18.0, pinned lockfiles, isolated source/build/state, installed Chromium.
No real model request, cloud mutation or GitHub account login/import was made.

| Candidate | Result |
| --- | --- |
| Main `72bebaf1e1f2aac530ab2ae5ed038222a9541198` plus ten owned task paths | Build, typecheck and lint passed; lint reported 0 errors, 48 warnings, 22 infos. Targeted domain 30/30; plan browser 14 states; GitHub browser 9 states. Concurrent database WIP excluded. |
| Runtime `efd696cfab0ac0c0ddb99cf9215873fc706479ad` plus twenty focused paths | Build, typecheck and lint passed; lint reported 0 errors, 54 warnings, 47 infos. Targeted domain 44/44; HTTP/HTTPS/stdio 33/33; actual Chromium artwork 10, plans 14, GitHub 9 and MCP 24 states, total 57. |
| Same runtime compiled output relocated with original build directory unavailable | Artwork 10 and GitHub 9 states passed. This checks artifact relocation, not another full-suite run. |

Commands run in each isolated candidate:

```text
npm run build -- --webpack
npm run typecheck
npm run lint
node --test tests/domain/publication-summary-ui.test.ts tests/domain/github-tool-resolution.test.ts tests/domain/github.test.ts tests/domain/github-login-driver.test.ts tests/domain/state.test.ts tests/domain/catalog.test.ts tests/domain/destination-recommendation.test.ts
node scripts/test-destination-plans-browser.mjs
node scripts/test-github-readiness-browser.mjs
```

The runtime domain command also included `tests/domain/mcp-setup-guide.test.ts`,
`tests/domain/mcp.test.ts`, `tests/domain/mcp-access-file.test.ts` and
`tests/domain/mcp-connections.test.ts`. Additional runtime commands:

```text
node --test --test-concurrency=1 tests/http/api.test.mjs tests/http/mcp.test.mjs tests/http/mcp-hosted.test.mjs
node scripts/test-artwork-browser.mjs
node scripts/test-mcp-settings-browser.mjs
```

The GitHub browser command used a process-local `LAUNCHLANE_GITHUB_CLI_PATH` pointing
to the verified official executable. Only its actual version/readiness was queried;
missing/delayed metadata cases were synthetic. Browser checks include 280–1280px,
200% text, keyboard/focus, loading/failure, reduced motion where relevant and axe.
MCP issuance/download/revocation and SDK/stdio are actual local operations;
provider/model transports and selected failure/expiry UI inputs are synthetic.

The separate design kit self-test passed only 12/52 checks (23%) and exited 1. Its
Playwright, fixture/hook setup and some Windows commands were unavailable/incomplete. This is retained as a tooling failure;
it is not a product score or a passing gate. Product browser checks above ran actual
installed Chromium. No failed oracle or timeout was weakened.


<a id="publication-ui-local-runtime-activation-of-the-installation-the-owner-sees"></a>

### Activation of the installation the owner sees

The twenty focused source paths were applied without merge/cherry-pick or replacing
runtime backend work. A comparison of 351 source/public/package files matched the
frozen tested runtime candidate. The compiled manifest covered 288 files.

The manual app was already stopped at activation; no active process was terminated.
The previous `.next` was moved to a checked local backup, the tested relocated build
was moved into this worktree, and the existing Windows task
`<local-runtime-task>` was started. Its configuration and launcher
were unchanged. `.env.local` bytes compared equal before/after; data and budget were
not reset or copied.

Active build: `mYYsfnnZ1CBUT64lkOzR6`; previous: `q8sUoxcQ1q4Hcq8Y6WU74`.
The task reported Running; `/api/health` and `/` returned 200. The served page chunk
and stylesheet hashes matched the exact validated compiled manifest, and the HTML
contained the new build ID. An already-open browser page still needs a refresh.

This is activation of the owner's local HTTPS production build, not a public Liara
deployment or acceptance of all runtime families. Real GitHub OAuth, external MCP
host installation, live provider deployment and unrelated database WIP were not
tested in this slice.


<a id="publication-ui-local-runtime-retained-evidence-and-scope"></a>

### Retained evidence and scope

Ignored packet: `<private-validation>` in the main checkout:
candidate manifests, exact owned patch, command logs, activation receipt and
`live-asset-verification.json`. Runtime browser reports/screenshots are retained in
`<private-validation>`.
Plan before-captures remain in the earlier MCP candidate's destination-plans artifacts.
Build/state/tool binaries, screenshots and private coordination are not committed.
The old active build backup is outside the product in the same temporary packet tree.

<a id="remembered-login"></a>

## Remembered Liara login — 2026-11-04

Existing Liara login accepts optional strict boolean remember. Only a verified login issues the ordinary signed HttpOnly/SameSite cookie with the existing persisted session. Selected lifetime is thirty days, default/operator lifetime is one hour. HTTPS retains Secure. Explicit logout revokes the durable row. No password/TOTP storage, dependency, migration or authority/approval extension.

Actual domain21/21 covers default/operator compatibility, seven-day Store reopen, thirty-day expiry, logout, malformed flags before provider calls and existing Host/Origin/CSRF/tamper checks. HTTP48/48, lint/typecheck/build and actual Chromium login8states/two actors pass. Keyboard selection, 2FA, long-lived cookie, new browser context restoration, revocation, reload and project isolation are checked. Eight responsive/axe states pass with zero page errors. Provider responses are synthetic and network-denying, no real account login/model call/cloud write is performed.

The private local runner separately reproduced HOST_DENIED at the old HTTP3101 URL while the same local HTTPS runtime request passed Host validation. It now redirects old HTTP navigation to fixed &lt;local-origin&gt; and keeps the Next backend on private3103. Host/Origin checks in product code stay intact. The self-signed local certificate remains a browser trust prompt. Real Liara password/2FA entry by the owner is still required for actual sign-in.

<a id="responsive-ui"></a>

## Responsive interface stabilization

Scope: guided publication, investigation, project selection/library, account access,
repair consent, resource reviews and the optional assistant. This is interface
acceptance with isolated state and synthetic model/provider transports; it grants
no live deployment, model quality, SQL or data persistence acceptance.


<a id="responsive-ui-reproduced-problems-and-changes"></a>

### Reproduced problems and changes

- On base `15f2912`, the signed-in header occupied 97px at 280px because the new
  project library action no longer fitted beside the brand and account button.
  Its mobile representation is now a named folder icon with a 44px target; the
  desktop label remains visible. Text enlargement may grow the header naturally.
- The change-project control measured about 36px high. It now consumes the shared
  control-height token and allows its text to wrap.
- Once those earlier failures were removed, the existing mobile regression exposed
  a second problem at 280px/200% text: the long repository name in the project
  summary created 151px of horizontal overflow. The flex child containing the
  complete name now permits shrinking and line breaks. Bidi isolation remains.
- External-agent consent checkboxes inherited full-width text-field styling.
  They now have compact checkbox geometry and a full clickable, wrapping label.
  Acknowledgment, fallback, selected agent and authority semantics are unchanged.
- Assistant mode buttons and password visibility now meet the shared touch target.
  The existing agent selector uses the same field surface, font and control-height
  tokens. Transitions in the changed controls name their properties explicitly.
- Sign-out used an independent timer and always requested the operator-local key,
  even for hosted Liara authentication. It now reuses the guarded dialog exit,
  reports the actual sign-in method, scrolls in short windows, and restores focus
  on cancellation without ending the session. Hosted confirmation is tested
  through the actual session endpoint before a second synthetic user logs in.
- Desktop chat stays non-modal, as required by the existing design. Moving focus
  back to the workspace collapses its enlarged overlay so the focused controls
  are no longer obscured by blur/dimming; the chat draft and mission are retained.
- In windows at most 480px high, the header and chat launcher join the document
  flow, padding becomes compact, and focus scroll margins stop reserving the old
  sticky header. This leaves room for actual controls in landscape with 200% text.
  The launcher remains positioned relative to itself so its clipped decorative
  pseudo-element cannot create page overflow.


<a id="responsive-ui-test-corrections"></a>

### Test corrections

The initial 26-runner baseline passed 22 runners and failed four. Two failures
were product geometry defects above. The other two needed precise investigation:

- The older destination test expected the contiguous phrase `تومان در ساعت`.
  The current component displays readable hourly amounts and `برای هر ساعت`,
  with exact prices under disclosure. The updated test independently checks the
  fixture's 540 toman/hour, 12,960 toman/24h and 388,800 toman/720h; it does not
  relax cost or unit verification.
- Deployment's viewport loop retained scroll from an earlier focused input after
  resizing. Axe then counted a partially clipped, inactive submit control at the
  viewport edge as a target-size violation. The geometry was captured separately.
  Layout scans now start at a deliberate page origin, following the existing
  workbench harness. Actual Tab/focus visibility is tested independently at
  280/320/768/959/1280px; targets, accessibility rules and timeouts remain enabled.

The broader intermediate candidate exposed two further regressions: 44px assistant
mode controls reduced the desktop reading area below its existing 65% oracle,
and destination polling could still be inside `route.fetch()` when its browser
context was closed. Desktop header padding now gives the reading area that space
back, and teardown explicitly awaits route handlers (`unrouteAll` with `wait`)
before closing their context/store. Neither oracle nor asynchronous errors are
suppressed. A stricter short-window probe then detected decorative overflow and
partially off-screen focused controls; these are covered by the final rerun.


<a id="responsive-ui-validation"></a>

### Validation

Candidate `candidate-r4`, based on `15f2912`, Windows/Node 24.18.0 and the
committed dependency lock, passed lint (0 errors, 48 existing warnings, 22 infos),
type generation/typecheck, a production Webpack build, domain 820/820, HTTP 49/49
and all 27 isolated browser runners in one final candidate. No tests were skipped.
The browser matrix covers the workbench, deployment, restart, domains, guided flow,
destination/resources, folders/library, sign-in, motion, mobile/chat, platform
badges, expiry, networks, storage, environment, database attachment/targets/data,
migration review, maintenance and artwork. The new responsive runner passed
47 states, guided 57, workbench 75, mobile 10, chat 13 and hosted login 10; these
are individual runner scopes, not a new combined case count.

The 561 source/test/config/fixture/workflow inputs matched the frozen snapshot.
Its LF-normalized input fingerprint is
`d0e9a822a1dbe3bb5a3dd37ed51230d868ca68b7498be21badd4418551c8e146`.
Intermediate r1/r2/r3 failures remain in their own logs; none is reported as a full
pass. The original 295 source files of the baseline snapshot were separately
matched against `15f2912` before comparison. Model/provider transports were
synthetic, browser/server actual, model spending and real cloud writes zero.

The shared-token follow-up below is a later candidate with its own focused checks.
The 27-runner/domain/HTTP matrix above belongs to `259fe85`; it is not relabeled
as a newly repeated full matrix for the token patch.
Private logs, source hashes and before/after screenshots live under
`.local/ui-responsive-20261101/`; disposable states and archives are not committed.

`npm run test:responsive` adds cross-flow axe, geometry, 200% text, short landscape,
Tab/Escape, modal boundaries, focus return and session-preserving cancellation.
The normal `test:browser` command includes it, and CI now runs the whole core
browser command instead of only the guided suite. Chromium is installed before
HTTP/browser execution. Real mobile devices and browser engines other than
Chromium remain outside this evidence.


<a id="responsive-ui-shared-theme-follow-up"></a>

### Shared-theme follow-up

The five missing variables were `--color-field-hover`, `--radius-full`,
`--radius-xl`, `--shadow-sm` and `--shadow-surface`. Undefined variables invalidated
their entire declarations: the project summary lost its rounded corners and the
selected plan lost its composed shadow/ring. All five now live in the existing
theme, using its palette and related tokens. No second theme or dependency exists.

`test:responsive` checks that every direct CSS variable reference has a declaration
or explicit fallback, then checks the actual computed project radius/shadow. The
plan test verifies the selected surface and actual hover background change. The
static check is a declaration contract; it does not prove every possible selector
cascade or browser engine. Actual Chromium rendering remains necessary.

Candidate `candidate-r5` carries the `259fe85` runtime plus this token patch. On
Windows/Node24.18.0 and the same pinned dependencies it passed lint (0 errors,
48 warnings, 22 infos), typecheck and production Webpack build, then responsive47,
plans14, chat13, guided57 and hosted sign-in10. These five affected suites were
rerun on r5; domain/HTTP and the other browser suites were not repeated locally
for this CSS-only follow-up. No real model/provider calls were made.

All 561 executable/test/config/fixture/workflow inputs matched the frozen r5
snapshot. Its LF-normalized fingerprint is `867b70d5f337ccaafb49d7d116dd9229e2d8d9c08e1cff81b0c72909921dd069`.
Before/after desktop/mobile/200%/short-window screenshots were visually inspected.
The final GitHub workflow checks the pushed revision independently.


<a id="responsive-ui-linux-synchronization-follow-up"></a>

### Linux synchronization follow-up

[Actions 41317995225](https://github.com/Pezhm4n/launchlane/actions/runs/41317995225)
on `05eea02` passed lint/typecheck, domain820, build, HTTP49 and the first thirteen
core browser runners. The new responsive runner failed its immediate library
return-focus assertion. `Workbench` intentionally schedules that focus in
`requestAnimationFrame`; modal removal alone does not establish focus completion.

The harness now waits for the exact trigger to become `document.activeElement`,
then retains its original assertion and default timeout. No application code,
target, accessibility rule or timeout changed. Local r6 reused the byte-identical
r5 application/build inputs and compiled output; only this test harness differs.
Changed-file lint and three consecutive 47-state responsive runs passed with no
failures or actual model/provider work. This is not a fresh local build or repeat
of domain/HTTP. The next pushed revision receives the full Linux workflow again.

A subsequent [Linux run on 19a4388](https://github.com/Pezhm4n/launchlane/actions/runs/41319062935)
passed domain820/HTTP49/build and ten core browser runners, then exposed the same
readiness class in the chat probe: the desktop CSS expand control was visible
before the media-query handler had changed the native mobile modal to non-modal.
Chat audits and explicit breakpoint changes now wait for both the actual dialog
mode and visual-viewport geometry. The original mode assertions remain intact.
Local r7 passed changed-file lint, three chat13 runs and responsive47 using the
unchanged r5 compiled application. Only harnesses and core-command order change;
the fourteen suite members, assertions and timeouts are retained. Responsive/chat
now run first so a new readiness failure is reported earlier in the core suite.

<a id="destination-price-ci"></a>

## Destination price CI regression — 2026-11-04

[Linux CI on 048d41a](https://github.com/Pezhm4n/launchlane/actions/runs/41887373104/job/126775343684) passed lint/types/domain/build/HTTP, then stopped in `test-destination-browser.mjs` waiting for retired price copy. The UI had already changed in 9c38849 to exact grouped amounts and «در هر ساعت»; the aggregate's destination harness still expected approximate words and «برای هر ساعت». The unchanged failure was reproduced locally.

The harness now checks hourly, 24-hour and 30-day amounts independently for each of the three fixture offers, inside its own radio label. Exact-cost disclosure, unmeasured capacity, disabled writes, expiry/cancellation, responsive/axe checks and the original timeout remain. No product runtime, price calculation or provider contract changes.

Local Node24.18.0/Chromium used a fresh Webpack build of 048d41a, build ID `cCNNoRNBjrTxEw6WXTL3Q`; the only executable delta is this harness. Focused destination5, plan-choice14, six existing price/summary domain regressions and all fourteen `test:browser` suites passed. Typecheck passed; lint retained 52 existing warnings/47 infos with zero errors. This is synthetic-provider/local-browser evidence, not a new GitHub workflow or live cloud result.
