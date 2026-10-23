# وضعیت پلتفرم‌ها و مسیر انتشار

افزوده worker بعد از f5d9ace: Node24.18.0 با ProjectBuildPlan v3 و image رسمی digest-bound در همان build/repair/authority/artifact اجرا شد؛ candidate45، domain388/388، HTTP39/39 و۵sandbox واقعی پاس شد. این گسترش اجرای محلی22/24 است؛ native cloud Node24 و Next مستقل هنوز UNCONFIRMED هستند. [ADR0026](decisions/0026-node24-isolated-build.md).

افزوده پس از72618b6: [Static واقعی Login](evidence/native-static-login.md) از انتخاب پوشه/upload محصول، create16، انتشار Agent با مدل واقعی، artifact15، current release، تطبیق HTML/CSS/JS و تعامل مرورگر گذشت؛ stop/delete همان app تأیید شد. سؤال Node/port حذف شد. ردیف‌های تاریخی Static/missing پایین با این شاهد جایگزین می‌شوند: وضعیت فعلی **implemented_verified برای plain index/asset**، بدون install/build/start کاربر؛ Nginx80، source/assetهای nested از root انتخابی؛ bundler، SPA rewrite عمومی و repair عمومی باز. این شاهد به خانواده‌های دیگر تعمیم ندارد؛ همه۱۴خانواده الزامی‌اند.

شاهد افزوده `fb67971`: [کتاب‌فروشی upstream با fault صریح](evidence/codex-publication-mission.md) از upload محصول و Codex MCP، شبکه/مقصد تازه، برنامه مصوب، خطای500 در Node22 ایزوله، patch داخلی، آزمون مستقل و انتشار بومی همان artifact تا release جاری و HTML/API صحیح گذشت. source اصلی محفوظ و app با ID/404 پاک شد؛ cleanup خودکار شبکه هنوز تأیید نشده است. این مورد Node22ِ بدون dependency/lock/build-script است؛ Docker worker آن شاهد Docker publication، compiler frontend یا monorepo نیست و وضعیت خانواده‌های دیگر جدول را تغییر نمی‌دهد.

بازبینی: ۲۰۲۶-۱۰-۲۳، پایه6ae5c38. این ماتریس قرارداد A11/AC28 است؛ هر ردیف تا پروژه واقعی و شاهد انتشار همان مسیر، باز می‌ماند. «فهرست رسمی لیارا»، «تشخیص ایستا»، «ساخت محلی در Docker» و «انتشار بومی روی لیارا» شواهد جدا هستند. محصول هنوز پشتیبانی کامل همه خانواده‌ها را ندارد.

[فهرست رسمی](https://docs.liara.ir/paas/about/) در این بازبینی همان۱۴ خانواده را دارد. CLI نصب‌شده9.4.7 از package و source همان نصب بررسی شد؛ `get-supported-versions.js` فهرست ایستاست، پاسخ availability حساب نیست. دو GET واقعی `/v1/me?teamID` و `/v1/projects?teamID` در تیم مجاز200 شدند؛ تیم تطبیق داشت و فهرست برنامه‌ها خالی بود. پاسخ حساب، فهرست نسخه‌های database دارد؛ availability هر پلتفرم PaaS از آن اثبات نمی‌شود. OpenAPI pinned برای release، type/config را عرضه می‌کند و پذیرش همه ترکیب‌ها در حساب همچنان UNCONFIRMED است.

## نسخه مستند در برابر CLI نصب‌شده

| خانواده | نسخه‌های مستند / منبع | تفاوت مشاهده‌شده CLI9.4.7 | وضعیت Launchlane و مرز بعدی |
| --- | --- | --- | --- |
| NodeJS | [8/10/12/14/16/18/20/22/24؛ پیش‌فرض22](https://docs.liara.ir/paas/nodejs/how-tos/choose-version/) | فقط14/16/18/20/22/24؛ پیش‌فرض22 | partial؛ native Node22 محدود live؛ نسخه‌های دیگر و monorepo عمومی باز |
| NextJS | [Node20/22/24؛ پیش‌فرض22](https://docs.liara.ir/paas/nextjs/how-tos/choose-version/) | همان فهرست | partial؛ مسیر generic Node build هست، tarball/compiler در آزمون قبلی timeout داشت؛ Next واقعی هنوز unverified |
| Laravel | [PHP7.2/7.3/7.4/8.0/8.1/8.2/8.3/8.4؛ پیش‌فرض7.4](https://docs.liara.ir/paas/laravel/how-tos/choose-version/) | پیش‌فرض8.2؛ فهرست یکسان | missing؛ آماده‌سازی، worker و native publication |
| PHP | [7.2/7.3/7.4/8.0/8.1/8.2/8.3؛ پیش‌فرض8.0](https://docs.liara.ir/paas/php/how-tos/choose-version/) | CLI8.4 هم دارد | missing؛ نسخه/extension، build و publication |
| Python | [3.7–3.13؛ پیش‌فرض3.12](https://docs.liara.ir/paas/python/how-tos/choose-version/) | همان فهرست | partial؛ فقط3.12/FastAPI آماده‌شده live؛ raw/pyproject/dependency repair باز |
| Django | [Python3.7–3.13؛ پیش‌فرض3.12](https://docs.liara.ir/paas/django/how-tos/choose-version/) | همان فهرست | missing؛ manage/settings/static/migration و native publication |
| Flask | [Python3.7–3.13؛ پیش‌فرض3.12](https://docs.liara.ir/paas/flask/how-tos/choose-version/) | همان فهرست | missing؛ WSGI/start، worker و native publication |
| .NET | [2.1/2.2/3.0/3.1/5.0/6.0/7.0/8.0/9.0/10.0؛ صفحه پیش‌فرض3.1 می‌گوید](https://docs.liara.ir/paas/dotnet/how-tos/choose-version/) | پیش‌فرض8.0 | missing؛ solution/SDK/restore/publish و native publication |
| Go | [1.21–1.25؛ پیش‌فرض1.22](https://docs.liara.ir/paas/go/how-tos/choose-version/) | پیش‌فرض1.24 | missing؛ module/toolchain/cgo و native publication |
| React | [Vite یا create-react-app](https://docs.liara.ir/paas/react/how-tos/deploy-app/)؛ framework از lock، نسخه build runtime جداست | detector با react-scripts یا Vite+React؛ این detection build نیست | partial؛ Vite ترب در Node22 محلی ساخته و در Python سرو شد؛ native React live نشده |
| Angular | [پروژه Angular CLI](https://docs.liara.ir/paas/angular/how-tos/deploy-app/)؛ نسخه از lock | detector از @angular/core | missing؛ outputPath/version/build و native publication |
| Vue | [Vite یا vue-cli](https://docs.liara.ir/paas/vue/how-tos/deploy-app/)؛ نسخه از lock | detector از vue-cli-service یا Vite+Vue | missing؛ build/assets/routing و native publication |
| Static | [HTML/CSS/JS](https://docs.liara.ir/paas/static/how-tos/deploy-app/)؛ نسخه زبان مستقل ندارد | native80 و platformConfig خالی؛ create/release واقعی | implemented_verified برای plain index/asset؛ Login واقعی؛ bundler و repair عمومی باز |
| Docker | [Dockerfile یا مسیر image مستند](https://docs.liara.ir/paas/docker/how-tos/deploy-app/)؛ نسخه از image digest | detector Dockerfile، تعارض بعضی manifestها سؤال می‌گیرد | missing؛ Docker worker موجود با Docker publication فرق دارد؛ build/deploy واقعی هر framework لازم است |

نسخه‌های قدیمیِ ارائه‌شده، به معنی توصیه امنیتی یا سازگاری پروژه نیستند. تفاوت defaultها حل‌نشده است؛ هیچ default نامطمئن به approval تازه منتقل نمی‌شود. برای پروژه واقعی، قید manifest و lock، نسخه صریح، image/runtime و پذیرش حساب باید با هم سازگار باشند. انتخاب اولین عدد یا نسخه نصب‌شده میزبان جای این تطبیق نیست.

## قرارداد عملی هر خانواده

در ردیف‌های missing، ستون «آماده‌سازی» نیازِ اجرای بعدی است؛ capability پیاده‌شده معرفی نمی‌شود. فرمان باید از پروژه واقعی استخراج و پیش از اجرا در plan بسته شود. عبارت‌هایی مانند test موجود، اجازه ساخت oracle دلخواه مدل نیستند. ابهام root، چند entry یا native/Docker سؤال مشخص می‌خواهد؛ inspect هیچ script، import یا virtualenv activation اجرا نمی‌کند.

| خانواده | شواهد تشخیص و root | manager / lock؛ install، build، test، start | port/assets و env/منابع | native/Docker، آماده‌سازی و oracle نسخه بعد | پروژه آزموده / وضعیت live |
| --- | --- | --- | --- | --- | --- |
| NodeJS | package.json، engines، liara.json و entry؛ leaf مستقل | npm lockv3؛ ci آفلاین، build/test/start موجود؛ تست مستقیم Node در برنامه محدود | port/binding ایستا سپس GET واقعی؛ env reference محدود؛ نیاز DB باید از استفاده معتبر بیاید | native Node22؛ start/port محدود قابل اصلاح؛ artifact آزموده، current release و همان پاسخ | calendar/checkout کنترل‌شده live؛ Vite ترب local؛ arbitrary repo باز |
| NextJS | dependency next و scripts/config؛ root دارای workspaces مستقل فرض نشود | npm lock فعلی؛ install/build/test/start همان repo؛ pnpm/yarn هنوز worker ندارند | SSR/ISR/.next/public و public env ساخت، API و assets باید مستقل سنجیده شوند | native next هنوز پیاده نیست؛ Docker بدون آزمون جای آن نیست؛ نسخه جدید باید محتوای تازه داشته باشد | پروژه واقعی Next از محصول منتشر نشده؛ UNCONFIRMED |
| Laravel | composer.json/laravel، artisan، public و config؛ root صحیح | composer.lock؛ [composer install](https://docs.liara.ir/paas/laravel/how-tos/deploy-app/)، build frontend/test همان repo؛ entry سرو public | PHP/extension، env امن، DB/queue/disk براساس source؛ migration تصمیم مستقل | native laravel و Docker هر دو باز؛ oracle HTTP/API/assets و اثر migration جدا | هیچ پروژه واقعی در این مسیر؛ missing |
| PHP | composer.json یا entry PHP به‌همراه web root/config | composer.lock در صورت وجود؛ install/test از repo، نسخه/extension دقیق | web root/rewrites/assets و binding؛ DB/env براساس source | native php یا Docker انتخاب صریح؛ پاسخ واقعی و asset، current release | هیچ؛ missing |
| Python | requirements/pyproject و entry/argv؛ monorepo خام پشتیبانی کامل ندارد | فقط pinned requirements و wheelهای کامل؛ pip offline/hash/pip check، compile/unittest/start | argv مستقیم یا uvicorn3.12؛ env stdin؛ assets همان‌مبدأ و نیاز DB جدا | native python3.12؛ patch موجود در scope، همان unittest و workload، release جاری | کپی آماده FastAPI/React ترب بدون DB؛ دو release live و cleanup؛ partial |
| Django | requirements، manage.py، settings و WSGI/ASGI؛ app root مشخص | lock معتبر، install/test از repo؛ [collectstatic](https://docs.liara.ir/paas/django/how-tos/deploy-app/) و migration رفتارهای جدا | STATIC_ROOT/media/allowed hosts/DB؛ migration مخرب اختیار مستقل | native django و Docker باز؛ static، فرم/API و اتصال واقعی DB لازم | هیچ؛ missing |
| Flask | dependency Flask و WSGI factory/entry؛ وجود نام فایل کافی نیست | requirements/lock معتبر؛ [install و Gunicorn](https://docs.liara.ir/paas/flask/how-tos/deploy-app/)، test/start از پروژه | static/templates، bind و env/DB براساس استفاده | native flask یا Docker باز؛ route معنادار، assets و release جدید | هیچ؛ missing |
| .NET | csproj/sln، TargetFramework/global.json و entry؛ چند project نیازمند انتخاب | NuGet/lock موجود؛ restore/build/test/publish پروژه واقعی | ASP.NET binding، wwwroot، connection reference و DB/migration | native dotnet یا Docker باز؛ HTTP/API/static و revision فعلی | هیچ؛ missing |
| Go | go.mod/go.sum، toolchain و package main؛ module در monorepo مشخص | modules/sums؛ download/build/test همان module؛ entry و cgo صریح | bind و embed/static؛ env/DB در صورت نیاز معتبر | native go یا Docker باز؛ binary/runtime سازگار، workload و نسخه جدید | هیچ؛ missing |
| React | Vite/CRA و lock؛ ریشه frontend از API تفکیک شود | manager/lock واقعی؛ install/build/test؛ سرو output با برنامه مناسب | dist/build، SPA fallback و JS/CSS/font؛ public env با اعلام افشا | native react باز؛ موفقیت HTML بدون assets/browser پذیرفته نیست | Vite ترب local و bundle در Python live؛ native react تأیید نشده |
| Angular | angular.json/@angular/core و پروژه انتخاب‌شده workspace | manager/lock؛ install/build/test همان target؛ outputPath از config | bundle/assets/base href/SPA routing و build-time config | native angular یا Docker باز؛ route مرورگری و نسخه تازه | هیچ؛ missing |
| Vue | vue-cli یا Vite+Vue و config/lock؛ leaf واقعی | manager/lock؛ install/build/test؛ output از config | dist/assets/SPA و public config | native vue یا Docker باز؛ browser/assets/current release | هیچ؛ missing |
| Static | سند index معتبر، manifest و نبود source سرور متعارض؛ assetهای nested در root انتخابی | plain files بدون install/build/start؛ source دارای package/build استثنا نیست | Nginx80؛ local assets بررسی، external CDN گزارش، secret مرورگر ممنوع | create16/deploy15 همان artifact؛ current release، متن، byte و browser؛ repair عمومی باز | Login اصلی از browser upload، native live و cleanup؛ implemented_verified در همین محدوده |
| Docker | Dockerfile/context/ignore و target؛ ambiguity با manifest حل شود | manager/lock و stages داخل Dockerfile؛ فرمان‌ها و شبکه محدود و reviewشده | EXPOSE صرفاً شاهد است؛ listener/binding/assets/env/DB باید اجرا شوند | Docker publication جدا از sandbox؛ digest، health و رفتار framework واقعی | workerهای Node/Python فقط local؛ cloud Docker missing |

قیمت، ظرفیت، engine/version database و امکان شبکه تازه باید از حساب واقعی گرفته شوند؛ هیچ ردیف missing به معنی «بدون database» نیست. منابع ساخته‌شده، secret reference، readiness و اتصال workload به A14/AC34 وابسته‌اند. نسخه جدید هر خانواده از همان artifact/approval/journal و oracle اصلی عبور می‌کند؛ READY یا upload موفق جای آن نیست.

## تطبیق کار دستی مسیر رسمی

[راهنمای CLI رسمی](https://docs.liara.ir/references/cli/deploy-app/) و source deploy نسخه نصب‌شده عملاً بررسی شدند؛ اجرای deploy روی پروژه/حساب انجام نشد. جدول مقایسه عدد زمان یا کلیک ندارد. شواهد گذشته، با revision و حدود خودشان معتبرند؛ URL ترب پس از cleanup فعال نیست.

| کار دستی فعلی کاربر | رفتار متناظر Launchlane | بخش خودکارشده | تصمیم ضروری کاربر | شاهد صحت |
| --- | --- | --- | --- | --- |
| انتخاب root، حذف secret/dependency و ساخت بسته | انتخاب محلی/GitHub/upload، inspect و archive خصوصی | دریافت pinned و manifest/hash/exclusion بدون تغییر اصل | انتخاب پروژه/root مبهم | source/domain/HTTP و شاهد GitHub؛ همه runtimeها هنوز نه |
| تعیین entry/version/port و ساخت پروژه | profile و worker جدا با plan مشخص | Node/Python محدود؛ build/test/start واقعی در containment | scope اجرای محلی و ابهام واقعی | ADR0012/0015؛ شاهد raw monorepo عمومی باز |
| ساخت app و انتخاب منابع | catalog/quote و پیشنهاد actor-bound | Node/Python create محدود و ثبت ID/config | مقصد و اثر هزینه | destination-provisioning و python-real-project؛ DB/network تازه باز |
| کپی env و اتصال database | فرم امن و reference رمز‌شده | env merge/readback قراردادی و یک build Docker؛ DB provision هنوز missing | مقدار واقعاً بیرونی و هزینه/اثر منابع | ADR0013/0014؛ env/DB زنده باز |
| upload، deploy و خواندن history/log | application/journal و observe همان release | upload/release/current/semantic probe در محدوده فعلی | approval انتشار فعلی؛ اختیار چندمرحله‌ای هنوز partial | Node/Python live محدود؛ نسخه جاری و workload جدا |
| خواندن شکست، کپی log، اصلاح و deploy دوباره | CodeRepairJob، patch/test/artifact و proposal انتشار | اصلاح محدود مدل واقعی بدون کپی دستی log | هنوز scope/build و publication تصمیم جدا دارند | Python روی ترب آماده‌شده؛ چرخه عمومی خودکار و همه connectorها باز |
| تنظیم CI/CD برای pushهای بعدی | artifact/journal نسخه بعدی موجود | انتشار مجاز نسخه بعد؛ webhook هنوز missing | opt-in، branch/commit و سقف هزینه آینده | شواهد release بعدی؛ auto-push acceptance ندارد |

## تطبیق capability با تسک موجود

| قابلیت | تسک/AC | implementation / شاهد | وضعیت | اولین مرز اثبات‌نشده |
| --- | --- | --- | --- | --- |
| انتخاب، source و archive | A01/A07/AC19/32 | project-flows/inspect/archive؛ GitHub و upload evidence | implemented_verified در محدوده همان sourceهای آزموده | raw monorepo چند runtime و انتخاب root از MCP |
| مأموریت و replay | A02/A08/AC17/24 | AgentRun/Repository، domain و HTTP مشترک | implemented_verified در محدوده آزموده | resume خودکار بدون دورزدن uncertain |
| worker داخلی | A06/A07/AC26 | CodeRepairAdapter، Node/Python container و receipts | partial | dependency/command repair و runtimeهای غایب |
| اختیار چندمرحله‌ای | A05/AC23 | approval/claim/journal برای هر اقدام | partial | قرارداد برنامه، budget/محدوده و تبار artifact مشتق در یک تصمیم |
| env/منابع | A05/A14/AC22/34 | env9/10 و encrypted reference | partial؛ database missing | provision/readiness و اتصال واقعی DB؛ env زنده |
| انتشار و اصلاح | A08/A10/AC27 | Node/Python native، oracle/current release | partial | پروژه خام، چرخه خودکار در plan واحد و سایر خانواده‌ها |
| MCP | A16/AC31 | facade مشترک/SDK HTTP+stdio و Codex واقعی | partial | انتخاب source، incident مستقل، Claude/OpenCode و پذیرش نهایی |
| connector اجرایی بیرونی | A06/AC26 | CLI/help Codex و مستندات رسمی سه میزبان | missing | dispatch job در sandbox، receipt مستقل، cancellation/reconcile و هزینه |
| fallback داخلی connector | A06/A10 | worker داخلی موجود است | partial | broker بیرونی با fallback پیش از شروع و منع اجرای موازی نامعلوم |
| پوشش همه پلتفرم‌ها | A11/AC28 | جدول بالا؛ Node/Python محدود | partial | build و publication واقعی هر خانواده، بدون حذف موارد missing |

وضعیت blocked فقط برای مانع واقعاً مشاهده‌شده به کار می‌رود. نبود implementation با کمبود اعتبار یا «عدم امکان» یکی نیست؛ ردیف‌های missing در Aهای موجود باقی می‌مانند.
