# Runtime — verification evidence

[Documentation](../README.md) · [Current support](../platform-support.md) · [Verification index](../verification.md)

These versioned records preserve the original decisions, source revisions, failures and evidence limits. Dates and passing counts apply only to the named snapshot, not the current release. Installation-specific locations and identities are omitted.

## Records

- [Angular compiled component — 2026-11-02](#angular-compiled-component)
- [Durable build output and bounded workers — 2026-10-25](#build-output-stabilization-20261025)
- [Composite preparation foundation — 2026-10-23](#composite-preparation)
- [ASP.NET through the original Dockerfile — 2026-11-04](#dotnet-docker)
- [Flask/Django — 2026-11-02](#framework-python)
- [Compiled Go — 2026-11-02](#go-compiled-runtime)
- [Locked native dependencies — 2026-10-26](#locked-native-dependencies-20261026)
- [Native frontend slice — 2026-10-23](#native-frontend)
- [Next بومی؛ قرارداد و compiler](#native-next)
- [انتشار بومی Static و پروژهٔ Login](#native-static-login)
- [Dependency cache cancellation — 2026-10-26](#npm-cache-cancellation-20261026)
- [Installed PHP/Laravel — 2026-11-02](#php-installed-runtime)
- [Exact compiled pnpm components — 2026-10-29](#pnpm-components)
- [Pnpm workspace execution — 2026-10-29](#pnpm-workspaces)
- [Source preparation before destination, 2026-10-27](#pre-destination-preparation-20261027)
- [Python و پروژهٔ واقعی ترب — ۲۰۲۶-۱۰-۲۳](#python-real-project)
- [ورود سورس خام ترب؛ بدون آماده‌سازی بیرون محصول](#raw-torob-source)
- [Source intake syntax corrections, 2026-10-27](#source-syntax-20261027)
- [Vue compiled component — 2026-11-02](#vue-compiled-component)

<a id="angular-compiled-component"></a>

## Angular compiled component — 2026-11-02

The existing Agent/web plan9 → receipt2 → Docker22/publication40 path now binds Angular's actual `ng build` project, ordered configurations and output override. Ambiguous commands, custom builders and SSR stop typed. Original root/workspace/lock/tests remain unchanged by execution. No new approval engine, dependency, data action or migration.

Actual Angular22.2.4/CLI22.2.5/TypeScript6.0.3 uses source-pinned pnpm11.19.0/Node24.18.0. AOT and original quantity/zero/fractional/output tests run in the network-none worker. Fresh archive Docker/Chromium verifies rendering73, interaction81, router navigation and reload73. The real web upload/mission/approval/worker/archive/publication/reload passed ten responsive/axe states and two409 replays. Model/Liara/DNS/TLS routing are synthetic; zero real model calls/cloud writes. This is browser-component acceptance, not persistence or whole-product acceptance.

Runtime `1826b0a530e4452c7bd8ca3be3f2b18191f7815de99266eba6071e57e40ae100` on basee0635d7 passed lint/typecheck/build, focused24/24 and actual sandbox3/3: compiled190022ms, original-test rejection114530ms, AOT-template rejection141445ms; failures retain no artifact. Full domain834/834, HTTP48/48, eight actual pnpm/React worker regressions, the existing pnpm web publication/ten layouts/replay/reload and guided54states also passed on the unchanged runtime. The final locked batch exited0.

Sandbox source `46e774e3ba582b6b786fd623e421e325ad2d44d0087c881976ca799011f9b4de`, compiled output `93ce0032abdb10ed6faaf94f02f8ade1218da4aeda86452019ab57d2842a308f` (six files/321453bytes) repeated exactly across two independent runs. Web source `0310ce5bf242ba9f6e5f67dddc0da69a3cc7cce831f3d3b50eb9a1a0afa0598a`, output `c8d7673c1c73cbf928783a74d59f23c36475df7397e3ceb06b5fe47861804ba9`, archive `82a9f6d8eb6a96d153472bcc383829d87ce54b66ca2f62b7fc6480770eed2834`.

Preserved failures drove three fixes: command configuration previously selected the wrong directory; public `@inquirer/password` snapshot semver was mistaken for a credential; documented scalar `libc` was rejected. Private values/URLs/custom fields and musl/malformed constraints remain denied. Sequential350-package metadata hit the unchanged300s test deadline before compilation. Four bounded readers now charge streamed bytes against the same64MiB network/384MiB decoded quotas, preserve original timestamps/integrities and first failures, and keep per-read/run limits. Native hook permissions belong to this controlled fixture's source; the worker does not approve or edit them. Its strict Angular tsconfig is independently compiled; only that external fixture is excluded from Launchlane's own TypeScript project.

Run `node --test tests/domain/frontend-runtime.test.ts tests/domain/pnpm-component.test.ts tests/domain/project-build.test.ts`, `node --test --test-concurrency=1 tests/sandbox/pnpm-angular-component.test.ts`, then after build `node scripts/test-angular-component-browser.mjs`. Exact public pnpm cache is optional via `LAUNCHLANE_TEST_PNPM_TARBALL`; every heavy run holds the shared OS lock. Source semantics follow the [Angular workspace configuration](https://angular.dev/reference/configs/workspace-config), [version constraints](https://angular.dev/reference/versions) and [npm libc contract](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#libc).

UNCONFIRMED: native/live Liara (access removed), raw corpus, SSR/multiple Angular apps/custom builders, backend/data/worker topology and complete fourteen-family acceptance. No runtime version or database is substituted to claim success.

<a id="build-output-stabilization-20261025"></a>

## Durable build output and bounded workers — 2026-10-25

Scope: AC23/AC26 and the first missing boundary of composite preparation. The owner requested technical fixes without appearance changes, staging, commits or pushes. HEAD remains `6937dfc9a6be4f53a134b55175a53d22512dcf29`; this is uncommitted source.


<a id="build-output-stabilization-20261025-observed-defects-and-changes"></a>

### Observed defects and changes

- Frontend validation previously stopped and removed its container before output could leave its tmpfs. The v5 frontend runner now keeps PID 1 alive, runs the unchanged install/build/workload program through stdin/exec, exports validated bytes, then removes only its full container ID. Other Node and Python runtime plans retain their existing execution semantics.
- Successful frontend job receipts now include a content-addressed output receipt binding the exact source hash and build-plan hash. The private output envelope is flushed, published without overwrite and independently read back before success. A fresh service instance can recover it. Missing, tampered, linked, oversized and incorrectly bound output fails closed. Existing historical receipts remain readable.
- Concurrent output publication originally raced both temporary-file enumeration and the last available storage slot. The new store serializes quota checking and publication per state directory. Its limits are 32 outputs / 128 MiB; it does not evict another job's data.
- Each build may reserve 2 GiB. A shared bounded FIFO now serializes dependency acquisition and container execution across adapter instances. Aborted/expired waiters do not execute project code; parent authority is checked again after waiting. The installation still assumes one owning server process, as its SQLite/runtime contract already requires.
- An incomplete Docker create reply previously lost the identity needed for cleanup. Node tests, Node/frontend builds and Python builds now reconcile only their unique name, exact pinned image and ownership label. A matching full ID is journaled before cleanup; unknown/replacement identities are not deleted. A lost response never starts or recreates a worker.

No schema migration, dependency installation, model allowance, infrastructure credential, original Torob source, catalogue or usage database was changed.


<a id="build-output-stabilization-20261025-evidence-and-failure-history"></a>

### Evidence and failure history

- Baseline before this slice: 458/458 domain and 45/45 HTTP tests, no failures/skips.
- New store/capacity/identity cases exercise independent readers, content and provenance tampering, links, exact resource limits, concurrent writers, FIFO cancellation/overflow, lost replies and ownership mismatches.
- The initial store concurrency tests failed with an `ENOENT` temporary-file race and two successful claims for one remaining slot. Both failures were preserved and then passed with serialized publication.
- First combined build/domain run: 465/466 passed; one existing test cancelled while constructing its three-second source fixture, before its actual assertion. Build ran concurrently. Load is a hypothesis for that cancellation, not a proven product diagnosis. The original failure remains recorded; the test deadline and oracle were not weakened.
- A frozen Linux audit controller on the existing VPS, without network/provider credentials or production state mounts, passed 18/18 tests in 92.264 seconds. These include real Node20/22/24 workers, exact binary export after worker removal, private-env rejection/public-env retention, failed-asset rejection, approved job reconstruction and actual Docker identity readback after a simulated lost reply. The compiler/dependency fixture in the new job test is synthetic; it does not prove a general React compiler or cloud release. Other compiler/provider/model boundaries remain separately labelled.
- The real existing Python HTML/assets worker regression passed separately: 1/1, zero failures/skips, 26.465 seconds. This checks the changed Python container lifecycle without downloading dependencies or claiming another Python framework/version.
- Final sequential validation: build and typecheck passed; domain 468/468 in 125.000 seconds, HTTP 45/45 in 22.702 seconds, no failures/skips. Lint: zero errors, 43 warnings and 13 infos; no UI/CSS warning was suppressed or cosmetically changed.
- The guided browser suite passed 54 states at 320/360/390/768/1280, synthetic model/provider and zero cloud writes. The older deployment browser suite failed `target-size` at 959px. The exact same failure reproduced against the preceding MCP baseline with unchanged appearance. Failure JSON/screenshots were retained; its oracle was not relaxed and it was not called a full browser pass.
- The exact Linux production image passed isolated login, MCP discovery/structured result, scope denial, revocation and parent-session preservation using fixture identity, no real provider/model and a separate state mount. Its fixture hook was never applied to production.

The private operational records and source manifests are under the operator's ignored `.local/hosting-launchlane-20261023/` directory. The final frozen candidate has 493 files and digest `fb342f964b73c7b4dac992f5fc96afd54f58e4844dbbc7dfa5a5d5039f7c8d21`. Its 250-file production subset has digest `0196d63310f462f60e5b212a2e268975bfaed299fbe0359bc0717ac054592d42`; archive SHA256 `9bf5dfa6057d8c6298e44eeba778856d461d770b0ad097b8f933fafcd1d288c2`.


<a id="build-output-stabilization-20261025-remaining-acceptance-boundaries"></a>

### Remaining acceptance boundaries

Public rollout used the existing hosting authority and resources. Active image: `sha256:a547236ef28225af76ba331086a371922bcd77b157f87267e6e44494c38c3061`; Build ID `6zRBRP24QoZ463cVmnGDS`. The prior `8ed153b5b1c0` image remains available for an image-only rollback. At 2026-10-25 06:03:27 UTC, all rows of 28 state tables and five ledger tables matched consistent pre-rollout SQLite backups; both quick checks were `ok`. The same persistent mount, runtime configuration and proxy image were preserved. Production had no test hook, zero restarts and no OOM.

The same public origin returned root/health200, anonymous workspace/MCP401 and all11 assets successfully. All four served CSS/font entries were byte-identical before/after. Remaining model credit stayed USD0.20; no model requests, new paid resources, allowance renewal or data reset occurred. No staging/commit/push was performed.

The durable generated output is attached to the tested job. It is **not yet the final composite publication artifact**: native frontend publication still follows its existing source/build contract. This slice does not establish byte-identical composite publication, persistent resource provisioning/import, a complete Torob deployment, all 14 official families, or executable Claude/OpenCode connectors. Framework detection, successful local compilation, HTTP 200 and provider READY remain insufficient for those claims.

The original Torob repository was read only: current HEAD was `2dffbde19d612e3935509d278aa2664cfed516db`, with no tracked/untracked changes reported. It supersedes older handoff revisions for subsequent investigation; it was not reset, prepared or deployed outside the product.

Next boundary: bind the durable frontend output into a reviewed composite artifact and typed resource/data plan, then verify the exact current Torob UI → API → database → response and persistence. Native families and actual MCP hosts/repair connectors remain independent acceptance obligations. No technical 10/10 or full-matrix pass is asserted.

<a id="composite-preparation"></a>

## Composite preparation foundation — 2026-10-23

Scope: A07/A08/A11, AC19/23/27/28. Status: partial foundation, not a completed publication path.

`inspectCompositeProject` reads the captured source without importing or executing project code. It identifies one root ASGI backend and one locked Vite frontend, preserves the complete source root, records manifest/configuration hashes and describes the required preparation. Ambiguous entry points, dynamic output, conflicting locks and unsupported workspace layouts fail explicitly. A one-level root `-r requirements.lock.txt` indirection is provenance-bound; the descriptor does not silently rewrite it. Every detected descriptor remains `publishable: false`.

`validateBuildOutput` independently matches a bounded manifest against copied bytes: exact size/hash, nonempty index, regular-file declarations, canonical unique paths and no private/configuration/database files. Limits are 512 files, 32MiB total and 8MiB per file. It performs no filesystem writes and does not disable the source scanner's normal exclusions.

`compositeBootstrapSource` generates a restricted ASGI/static entry for applications without an existing root route or mount. It preserves API errors and refuses a conflicting root. The current Torob application already serves its own frontend and performs readiness checks, so this generated entry must not replace its production startup or add a second root mount.

Validation in this continuation: the two domain files passed 18/18; the bootstrap input-contract check passed 1/1. These are standalone checks, not fresh container, artifact-lineage or cloud evidence. Historical container evidence from the handoff is not relabelled as a new candidate pass.

The application/profile/Agent integration, actual build-output export lifecycle, final derived artifact, persistent disk/data transfer, runtime/start compatibility and live Torob workload remain open. No source, database or usage ledger in the original Torob repository was modified by this foundation.


<a id="composite-preparation-bounded-container-output-reader-and-frontend-oracle"></a>

### Bounded container-output reader and frontend oracle

`exportBuildOutput` adds a standalone read from an already-running, exactly identified container. A fixed host-owned Node program uses canonical paths, no-follow regular-file reads, link checks and before/after metadata checks. A separately bounded stdout channel transports manifest and base64 bytes; the host decodes the unknown envelope and independently validates its hashes and paths. Supplied private values are rejected even in binary content. This function neither stops the container nor creates an artifact; the build hold/export/stop lifecycle is still unconnected.

The frontend oracle now reads executable script and stylesheet references across normal HTML case, whitespace and quoted/unquoted attributes, including extensionless references and relevant preload links. Resource kind determines the required MIME. Comments, raw text and unrelated URL attributes do not manufacture dependencies. Three checks execute the same trusted parser/MIME program used inside the worker; all passed. This host test does not execute customer source.

Six host export/fixture regressions passed, including binary preservation, metadata mismatch, private bytes, cancellation, lost start/create responses and exact-identity cleanup. Container tests are present but have no fresh pass: the frontend baseline stopped after125.49s with `SANDBOX_CLEANUP_UNCONFIRMED` before reaching its asset assertion; the export fixture's detached start did not finish within its unchanged10s allowance before export. The latter exposed and corrected a test-harness cleanup gap: create and start now retain a full identity, with bounded name/label/image reconciliation after a lost create response. The exact leftover fixture was identified and removed. These failures remain recorded; they do not establish a production exporter defect or a successful container/export cycle. The latency cause remains UNCONFIRMED.

<a id="dotnet-docker"></a>

## ASP.NET through the original Dockerfile — 2026-11-04

The existing Agent/web Docker6 build is available before destination selection. The same job, approvals, Store, archive selection and publication21 are used. SDK stages retain the original literal BUILD_CONFIGURATION default. Global, inherited, proxy and dynamic build arguments stay denied. NuGet.Config keeps original bytes for a bounded public-source XML subset. Device, HTTP/GitHub staging and local capture reject private/config inheritance constructs. .slnx is retained. Recorded private inputs require the existing verified destination environment before build, including inputs imported after approval.

The actual framework-only ASP.NET10 fixture uses SDK10.0.403, ASP.NET10.0.14 and original locked solution/project references. Offline restore, original quantity/zero/fractional checks and publish execute in Docker. A separate verifier checks running Kestrel JSON. Original test failure and HTTP200 with total74 instead of73 fail without an artifact. Changing the publication criterion also fails. External NuGet packages have no execution evidence yet.

Runtime candidatee58eb6be8de6a6a381f009e035521b83da05385ddebb044ed05dd93e4d12dc42 on base0206415. Lint/typecheck/production build, focused17/17 and HTTP48/48 passed. Full domain838/838 also passed (345860ms), with no skipped/cancelled cases. Final lint has54 warnings/43 infos and no errors. All heavy gates held the shared FileShare.None OS handle. Runtime fingerprint recheck reported no changes.

The source archive is rebuilt at the destination. Source, Dockerfile, local image and workload are recorded. Immutable DLL export, native .NET without Dockerfile, external NuGet dependencies/test adapters, other SDKs, independent worker/scheduler topology, data and complete14 remain unconfirmed. Live Liara access is unavailable.

Run the three ASP.NET commands in AGENTS.md under the shared OS handle lock. Model/Liara/public DNS/TLS use network-denying synthetic transports. Docker/compiler/Kestrel/Chromium are actual, with zero real model calls and cloud writes.

The web publication run cefbf008-0cce-4443-9fd4-dff2269fb156 used source b32be65415e047511564e212b9374926bdb78b71fb30cf770d87b00a33d7ec00 and archive 001a05b9e07f74f9b3c551a708cd2a32be0fe0ac7e23e769c4da8e5882e4f115. The archive repeated exactly from the worker test. Fresh Docker destination and Chromium verified invoice73 and JSON total73. Both409 replays and reload passed with unchanged usage and no extra model requests. Three widths had no overflow. Original SDK/compiler/test failure and wrong JSON tests passed3/3.

The first web attempts exposed the shared approval guard expecting a fixed Node image for Docker6, whose source recipe intentionally has no containerImage. The guard now checks the correct representation and rejects an injected image. Separate failures caught an ambiguous card selector and a browser-poll race. Assertions and deadlines retain their original criteria.

The no-destination web run3beecc31-4525-495a-aac0-c7faef6aa212 used the same source/archive, passed one409 replay and reload without additional usage, and retained partially_completed/no_remote_changes. Its actual worker receipt and source artifact are selected through the existing application.

<a id="framework-python"></a>

## Flask/Django — 2026-11-02

Scope: source → existing Agent build10 → approved network-none Python3.12 worker → original unittest/manage.py test → Gunicorn/API → source artifact → native41/42 approval/journal. No second engine, root dependency or SQLite migration.
Source must declare version/port/configuration and pinned Gunicorn requirements; Django requires explicit disabled automatic collectstatic/settings/message edits. Other versions, pyproject, custom runners, source repair, migration/data and live provider acceptance remain open.
Actual local cases: both families pass locked install, original tests and production WSGI; failed/skipped/absent tests, wrong API responses and surviving test daemons fail without an artifact. The daemon regression reproduced false success before the process guard. A disposable Django key uses the existing private environment interface and is absent from job/archive.
Synthetic provider regressions check native payloads, family codecs, actor/source/workload fences, approval/replay and destination family mismatch. Actual web upload/mission/HTTP decision/worker/archive selection/replay409/reload passed for both families; only model responses are synthetic, with public pinned PyPI reads and zero cloud writes. Build is available before a target to avoid the build-before-create prerequisite cycle.
Final runtime snapshot: `3c4707ec0866fe9de6aad8dfbc0544eff9fdc8f57323db5d0f622c6c876151fa`, base73ce643: worker15/15, focused6/6, HTTP48/48, lint/typecheck/build and both actual web-worker flows passed. Policy snapshot `c0c4dd2e` passed full domain817/817, review12layouts and guided54states; its only runtime delta is the final plan10 process guard. All heavy commands hold the shared OS lock.
Commands: `node --test tests/domain/framework-python.test.ts`; `node --test --test-concurrency=1 tests/sandbox/framework-python.test.ts`; after build, `node scripts/test-framework-worker-browser.mjs` (actual worker) and `node scripts/test-framework-python-browser.mjs` (synthetic decision views).
Provider configuration follows [Flask](https://docs.liara.ir/paas/flask/how-tos/deploy-app/) and [Django](https://docs.liara.ir/paas/django/how-tos/deploy-app/); account availability, native running bytes and public behavior remain UNCONFIRMED while Liara is unavailable.

<a id="go-compiled-runtime"></a>

## Compiled Go — 2026-11-02

User path: select an explicitly configured Go1.25 project → existing Agent build review11 → original go.sum/download/verify/tests/build → fresh binary runtime → select exact archive → Docker destination22/publication43. No source flattening, lock rewrite, destination compile, root dependency or SQLite migration.

Pinned tool: Go1.25.14 Linux/amd64, 59,909,419 bytes, SHA256 `a21ae5633a269bcd7e90cf767e48225633795e99d831742cbf3397064fee7712`, checked against [official release metadata](https://go.dev/dl/?mode=json&include=all). Modules must pass the original go.sum in the offline Go command; [module](https://go.dev/ref/mod) and [toolchain](https://go.dev/doc/toolchain) rules apply. Local tests use the exact public tool archive and hash-checked public module cache; neither grants cloud/model authority.

Actual local execution covers UUID dependency installation, three original Go tests, compiled ELF export, a second worker without compiler/build tree, archive Docker, Chromium button/API/route/reload and secret absence. Negative cases cover failed/skipped/absent tests, wrong API, changed source, surviving counterfeit daemon, compiler-tree dependency, bad go.sum and changed toolchain; failures retain no artifact. Synthetic provider tests cover actor/approval/replay/source/workload/env/proof mismatch and unchanged Docker payloads.

Actual web upload/mission/HTTP decision/two-worker/archive/replay409/reload passed before a target. A second actual web flow passed publication43 through the existing approval/journal, actual archive Docker/API/proof and ten responsive/axe states. Model/Liara/DNS/TLS transports in that flow are synthetic; cloud writes and model charges are zero. One initial domain harness accidentally attempted an unauthenticated provider GET (401); it now explicitly denies external fetches. No provider write or real credential was involved.

Runtime snapshot `05b1ccab8178a20e6c1add3275ed18e95edb571f779c98da015b25e72e3c6962`, base20fd8fe. Tested web source `76aca33f5e2b0f232dd6fed70e79d020479aabe9867d76478b9f7281ba90a922`; publication archive `b1743d67e0e99c1c6f82788372d15fa9fff867757c3e0ec1cc83a75241847ffd`; output `3952f5d501a69b302d2eeab89c6bb957fe5169f2d4b5c49178ca85ea73abce29`. Policy/worker snapshot05b passed full domain822/822, HTTP48/48, Go worker10/10 (748,516ms), shared pnpm web publication10layouts and guided54states. Final snapshot `c29270047bd734249f1aecea80f55a4429e395b610d72f09a32d2aaab83ce8f6` changes only the public reader (bounded pinned IPv4/DNS/TLS); lint/typecheck/production build, focused domain6/6 and actual Go web publication10layouts/replay/reload passed. Its final archive is `a1295f8615234046583ec3f820014430c91c2aac3914d5ea175bfd6d74beb9e6`, with the same tested source/plan/output. The full domain/worker matrix belongs to05b, not a second final aggregate run.

Commands: `node --test tests/domain/go-build.test.ts`; `node --test --test-concurrency=1 tests/sandbox/go-build.test.ts`; after build, `node scripts/test-go-worker-browser.mjs` and `node scripts/test-go-publication-browser.mjs`. All heavy execution holds the shared OS lock with disposable state/ports. Preserve earlier network and harness failures separately; no oracle or timeout was weakened.

Initial tool downloads through the default public reader timed out in two bounded real read attempts (about120s each); public-cache execution does not prove fresh bootstrap. The typed registry error remains, without increasing the timeout or substituting tool bytes. This network/bootstrap boundary is open.

UNCONFIRMED: native/public Liara deployment (unavailable), raw corpus, production data/connectivity/persistence/rollback and full14 acceptance. Go1.25 explicit configuration and one pure-Go executable are supported here; other versions, cgo, dynamic environment names, Go workspaces/multiple executables, independent workers/schedulers and source repair fail typed or remain unsupported.

<a id="locked-native-dependencies-20261026"></a>

## Locked native dependencies — 2026-10-26

Scope: A07/A08/A11, AC19/AC27. This checkpoint continues on `main` at base `6937dfc`, with the existing uncommitted Docker/fullstack work preserved. It does not establish a public release of any of the requested real projects.


<a id="locked-native-dependencies-20261026-observed-failure-boundary-and-change"></a>

### Observed failure boundary and change

The actual Zarinpal npm lock v3 declares Linux/x64 optional native packages without their `libc` fields. The official metadata for those exact versions distinguishes glibc from musl. Inferring compatibility from the missing lock field would download both variants for the pinned Debian/glibc worker. This is a dependency acquisition problem, not evidence that the application is broken.

`lockedTarballs` now records the exact public package/version identity for this bounded case. On a cache miss, the existing downloader reads only that version's official npm metadata. Name, version, tarball URL and integrity must all match the unchanged lock. Incompatible OS/CPU/libc entries are omitted from the executable cache manifest; `platform-selection.json` retains the metadata hash and decision. No package-name suffix heuristic, source/lock modification, dependency upgrade, new command or image authority was added. The [official npm package contract](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#libc) documents the platform fields.

Both metadata and tarball reads consume the existing tool budget. DNS/public-IP validation, TLS, fixed registry, redirect denial, byte bounds, cancellation and integrity verification remain in the same adapter. A verified existing cache hit requires no metadata request or new HTTP reservation. The existing private cache's immutable entries, quota, locking and corruption behavior are preserved. No model allowance was created or renewed.


<a id="locked-native-dependencies-20261026-actual-dependency-acquisition"></a>

### Actual dependency acquisition

- Source: `f11511c88cf07f46b929c6c56f6d2e1feba0bd44`; captured source hash `a6823489515ffbba1854559c563ea5aee093f03a127614d9e109ccfd1de6eba7`, 165 files, 5,683,899 bytes.
- Initial platform-compatible lock list: 591 tarballs; 573 existing cache hits and 18 misses.
- Official version metadata reads: 12. Six musl tarballs were excluded, with metadata hashes retained.
- Actual tarball downloads: 12, totaling **52,539,382 bytes**. Metadata: 22,601 bytes. Total HTTP reads: 24; duration 49,823 ms.
- Total verified tarball bytes copied to the job input: 125,579,056. Every cached/downloaded item was checked against the original lock integrity. No source script ran during intake or acquisition.

These figures are the measured transfer for this source and cache, not a general download estimate. Portable dependencies declared by the lock remain included; no other CPU/OS native binary was downloaded.


<a id="locked-native-dependencies-20261026-validation-checkpoint"></a>

### Validation checkpoint

On the current working tree after this change:

- Focused platform/cache/project-build tests: 15/15, zero failed/skipped/cancelled.
- Complete domain suite: 643/643, zero failed/skipped/cancelled, 204,745 ms.
- `npm run typecheck` and `npm run build`: passed; Next 16.4.2, Node 24.18.0.
- HTTP suite: 45/45, zero failed/skipped/cancelled, 27,156 ms; provider/model transports are synthetic.
- Lint on the two new/changed platform files: clean. Whole-repository lint: zero errors, 46 warnings, 15 informational diagnostics; this is not warning-free.
- `git diff --check`: passed. Existing unrelated changes remain unstaged.

The platform tests distinguish glibc and musl metadata for the same neutral package name, reject changed package/version/URL/integrity before downloading, preserve offline cache hits and stop on malformed/cancelled metadata. They use synthetic transport. The dependency acquisition above used the real official registry.

An independent copy of HEAD plus only the staged slice initially passed 28/29 targeted tests: the cache's explicit operator-path configuration had been left outside the staged patch. That four-line configuration change is part of the slice now; the same unchanged tests passed 29/29. This check prevents the broader uncommitted implementation from hiding a missing commit dependency.


<a id="locked-native-dependencies-20261026-remaining-acceptance"></a>

### Remaining acceptance

The real Next compiler/start/workload run and exact-artifact publication are separate steps. The first Linux controller failed before importing Launchlane because extracted controller directories were root-owned mode 0700. Directory permissions were read back, corrected in the isolated controller context, and a new controller identity was recorded. This was packaging failure before project execution; no application test was counted as passed.

Read-only live inventory confirmed the public Launchlane image `a547236ef28225af76ba331086a371922bcd77b157f87267e6e44494c38c3061`, Build ID `6zRBRP24QoZ463cVmnGDS`, healthy/restarts0/OOM=false and SQLite quick checks. The existing Zarinpal and Liara-assistant destinations have default subdomains disabled, and their selected team returned no domains. No public project URL is inferred from their names. No infrastructure write, new paid resource or model request was performed for this checkpoint.

<a id="native-frontend"></a>

## Native frontend slice — 2026-10-23

Scope: A03/A06/A07/A08/A10/A11 and AC22/23/28. Status: partial; no live React/Vue/Angular release is claimed.


<a id="native-frontend-real-source-and-isolated-correction"></a>

### Real source and isolated correction

Upstream Notes-App source revision `0bd28c155fa092fed0a7615fa9f410a94cf0d47c`,18 files, source hash `752a35aa23be64ae072fa09f874df79580268106f584c6d86f3c65247a5cfe1c`. Capture used the product source flow. No hidden source preparation, dependency/test changes or source-repository write occurred. Its README claims MIT; no LICENSE file was found. No upstream source/assets were copied into Launchlane.

The raw Vite build generated `dist`, while native React requires `build`. Actual isolated baseline job `7ca08564-d387-4d89-9170-b99c00450a23` failed73 at `build/index.html`. Real internal coding job `88d5efd8-236d-41ad-8bde-1af145461351` changed only the existing `vite.config.js`. Independent Node20.20.2 install/build/workload then passed, retaining the original `<title>notesapp</title>` criterion. Derived artifact: `b4ebe7734b80a19f4b1a7522df506e33b73646f94e031e84932eb2b341c81533`. Test fixture state/artifact bytes were removed by its normal teardown; this artifact is not an available live publication.

Preserved failures: first attempt stopped because169 real dependency reads exceeded the former160 tool ceiling; another built the correct output but exposed an oracle bug comparing a canonical URL origin with an explicit default `:80`. The host comparison was corrected; missing-asset rejection was retained. The two actual coding-model requests added3389 reported tokens and a conservative $0.003719 ceiling, not an invoice. The existing private consumption ledger and prior reserves remain authoritative; no allowance was renewed. No cloud write occurred.

HTML and referenced compiled CSS/JS were verified; interactive notes behavior, mobile frontend workload, native cloud release and release-version readback remain UNCONFIRMED.


<a id="native-frontend-shared-engine-and-deterministic-checks"></a>

### Shared engine and deterministic checks

Synthetic product flow cases cover React/Vue/Angular source capture, exact runtime selection, ActionSpec20 creation/readback and19 publication payload, rejection of changed configuration and wrong destination type. Actual containers cover pinned Node20/22/24. Another actual container case rejects missing JS despite HTML200, and accepts the matching local JS/CSS output. These controlled runner cases are not real Vue/Angular compiler or publication evidence.

Environment-name regressions cover comments/strings/shadowing, public prefixes and conservative Python helper inference. Actual raw Torob capture now identifies its assistant and voice settings without reading values or executing source. Tool-only/script env names can still be discovered; discovery does not assert they are required application settings.

The UI summarizes correlated host outcomes once, reveals a fresh failure with cause/action and preserves manual closure across unchanged polling. Plan cards derive24-hour/30-day continuous-runtime estimates from the same actual hourly quote using integer arithmetic; taxes/traffic/storage are excluded and the estimate is not an official monthly quote. Candidate-bound final checks are recorded in verification after execution.

<a id="native-next"></a>

## Next بومی؛ قرارداد و compiler

وضعیت: partial در A07/A08/A11/AC28. [ADR0027](../decisions/runtime.md#0027-native-next-publication) قرارداد17/18 و حدود را ثبت می‌کند. منبع صرفاً با نام package یا index موفق حساب نمی‌شود. oracle پیش از اجرا: install قفل‌شده، build واقعی Next، start همان source و پاسخ200 شامل `next build ready`؛ cloud و browser مستقل لازم‌اند.

اجرای کنترل‌شده compiler روی backend بعد8b08364 با source hash `8dcac62a3fe2e4b27113685081a0fea50b982c402007a16531bba3d4545b375b`، چهار فایل، Next16.4.2/React19.3.1/Node22.23.3، job `7fbb1866-ee52-4e59-b933-eb5eede68f84` گذشت. npm ci آفلاین24بسته نصب کرد؛ compiler واقعی، generation و next start سپس GET معیار اولیه را گذراندند. receipt exit0/signalnull/duration67116ms و artifact `fb0ac67ee63525c03a55afc83da4bd958adf5ca85cbcf370566aea0a1359de69` ثبت شد. کل اجرا114193ms؛ container همان ID حذف شد، cloud write/model request صفر. tarballها از cache معتبر و reader عمومی npm با integrity مستقل دریافت شدند؛ workaround شبکه نصب، قابلیت عمومی محصول معرفی نشده است.

این یک compiler case کنترل‌شده است، پذیرش عمومی Next نیست. اجرای اول runner خصوصی پیش از compiler با budget12 شکست خورد؛ source و oracle عوض نشدند. بررسی پروژه واقعی [Lingua Loop](https://github.com/KStrochan/lingua-loop) در commit `c2d05a6f539a4b47bb6872c696b9b5f4aee5800e`، بدون تغییر source، در credential-like fixture آزمون متوقف شد؛ lock557 نیز از سقف512 بیشتر است. public prototype با کسب‌وکار واقعی یکسان نیست، ولی منطق آزمون سطح/جدول دوره‌ها/فرم demo دارد و generator ساده نیست. حذف تست/fixture، ضعیف‌کردن oracle یا انتشار آن اتفاق نیفتاد. raw upstream، native cloud17/18، assets و مرورگر همین خانواده هنوز UNCONFIRMED هستند.

domain، metadata نوع node به‌جای next را رد و create18→ID readback→deploy17 همان artifact، نسخه/mirror/env و payload native را با transport مصنوعی می‌سنجد. compatibility با Node/Python/Static و candidate نهایی در verification ثبت می‌شود.

candidate46 روی پایه14b18b9: domain390/390، HTTP39/39، build/typecheck و lint بدون error؛ مرورگر platform12حالت و ورود8حالت با دو actor و صفر pageerror. digest و tree در [verification](../verification.md) ثبت‌اند. compiler واقعی پیش از این export اجرا شد و با regression تازه به‌عنوان یک full live pass جمع نمی‌شود. هزینهٔ تازه مدل/ابر در این برش صفر است؛ allowance قبلی تمدید نشد.

افزوده candidate47: platformConfig قبلی به‌اشتباه version داشت؛ منبع رسمی next.nodeVersion می‌خواهد. adapter و fixture اصلاح شدند؛ قرارداد17/18 و hash تاریخی تغییری نکردند. سقف lock اکنون2048 است، پس مانع557 قدیمی دیگر سقف فعلی نیست؛ scanner fixture و اجرای upstream همچنان شاهد مستقل می‌خواهند. این اصلاح به معنی پذیرش cloud نیست.

<a id="native-static-login"></a>

## انتشار بومی Static و پروژهٔ Login


<a id="native-static-login-نتیجه-اجرای-واقعی-۲۰۲۶-۱۰-۲۳"></a>

### نتیجهٔ اجرای واقعی؛ ۲۰۲۶-۱۰-۲۳

این بخش جای وضعیت «در حال بررسی» تاریخی پایین را می‌گیرد. candidate40 بر پایه72618b6، tree `4b19f1160921ffd59052724202338200ecb482d2` و digest354فایل `9177fd36b9b11b06e34290c2e092dea50b480b4063db2d0a0ac4a34863808dda`، با صفر اختلاف byte از ایندکس و state جدا اجرا شد. پوشه اصلی Login از file chooser واقعی Chromium و upload محصول وارد شد؛ فایل تولیدشده یا کپی آماده جای آن ننشست. source revision همان manifest است؛ Git revision فرض نشده است.

| رسید | مقدار |
| --- | --- |
| source | `adf93e03ef4c77c50499c1b24dbb0149ba3282b50078da79adfa310e5c7d3dd8` |
| artifact | `b74de9d9775a66ec2b4df1d256c65d40f7e34518d0a35f2085e70ba6dbe53ac6` |
| project / run | `baf40dbc-2090-46aa-82aa-2ef8c7127261` / `f55b1714-1f38-4114-80ab-89f2354035e2` |
| create16 / deploy15 | `073b6903-bb51-4d9b-9a3f-346c1c649512` / `0b625187-c3c6-4635-bc19-4435e085552d` |
| app / internal ID | `launchlane-static-qa-10231449` / `<resource-id>` |
| release جاری | `<resource-id>`؛ native static، port80، platformConfig خالی |
| هزینه پایه catalog | small-g2/basic، ۱۰۴۱٫۶۶ تومان/ساعت؛ مالیات/ترافیک/ذخیره و صورتحساب واقعی اندازه‌گیری نشده |
| مدل | gpt-6-luna؛ ۴ درخواست، ۱۷۰۳۸ token؛ سقف محافظه‌کارانه ledger۰٫۰۱۷۱۱۹ دلار، نه صورتحساب |

ساخت مقصد از API همین محصول با تصمیم معتبر cost/network و شبکه موجود انجام شد. دکمهٔ اصلی بررسی انتشار و تأیید UI، AgentRun واقعی را بدون چت یا سؤال Node/port تا completed بردند. upload/release هرکدام یک intent داشتند. release جاری پیش و پس از probe برابر receipt و HTML200 با عنوان Login & Registration بود. مرورگر عمومی SHA256 هر سه فایل اصلی را تطبیق داد؛ popup، Register، بازگشت Login و بستن گذشتند. console/pageerror خالی، overflow در390/1280px مشاهده نشد. این منبع backend ورود/ثبت‌نام ندارد.

runner خصوصی اول قبل از دریافت cookie ادامه داد و پیش از write شکست خورد. اجرای دوم انتشار را کامل کرد ولی oracle اشتباهاً succeeded را به‌جای completed برای مأموریت انتظار داشت؛ failure حفظ شد. recovery فقط state موجود را خواند و browser را ادامه داد؛ مدل/upload/release تکرار نشدند. currentRelease پس از مرورگر هم ID بالا بود. stop/delete از lifecycle محصول با تصمیم جدا و یک ارسال هرکدام، توقف و destination_absent را تأیید کردند. URL حذف‌شده لینک فعال نیست؛ شبکه قبلی حذف نشد. report/transport/تصاویر خصوصی در `.local/authority-mission/static-live-02/` باقی‌اند.

اجرای زنده بالا Agent-create را پوشش نمی‌دهد. بازبینی بعدی دو guard قدیمی تصمیم/ادامه v16 را اصلاح و regression Agent create→adopt→publish را افزود؛ live همان بخش UNCONFIRMED است. repair عمومی Static و framework دارای bundler از این شاهد نتیجه نمی‌شوند.

inspect اولیه به‌علت نگه‌نداشتن متن web در مسیر read-only خطا داشت؛ خواندن bounded متن و manifest assetها علت را رفع کرد. runner SQLite پیش از mkdir اصلاح شد. axe در scroll بازیابی‌شده کنترل نیمه‌خارج viewport را target-size می‌دید؛ runner قبل از سنجش viewport به ابتدای scroll برمی‌گردد؛ قانون حذف نشد. candidate41 full domain385/386 بود: oracle تکرار invalid read هنوز BUDGET_EXHAUSTED می‌خواست؛ قرارداد تازه AGENT_NO_PROGRESS است. ورودی قبلی حفظ و case مستقل invalid argumentهای متفاوت برای توقف budget اضافه شد؛ read/write مجاز نشد. شکست fetch تاریخی candidate38 ریشه تأییدشده ندارد؛ به concurrency نسبت داده نمی‌شود. candidate نهایی جدا در verification ثبت می‌شود.

دو اجرای کاربر بعد از آخرین fetch receipt،۴۵ درخواست/۳۴۳۹۳۳ token بدون split داشتند؛ سقف۰٫۶۸۷۸۶۶ دلار جدا reserve شد، بدون ساخت درخواست‌های جعلی در ledger. شمار fetch82، سقف آن۰٫۷۲۶۱۵۶ دلار؛ از مجوز تجمعی۲دلار حداکثر۰٫۵۸۵۹۷۸ دلار باقی است. allowance تمدید نشده؛ ماندهٔ حساب provider نیست.


<a id="native-static-login-انتظار-پیش-از-اجرا"></a>

### انتظار پیش از اجرا

منبع واقعی، همان سه فایل index.html/style.css/script.js پروژهٔ Login است، بدون تغییر پوشه یا آماده‌سازی پنهان. oracle انتشار: current release متعلق به app ID همان مأموریت، HTML عنوان `Login & Registration`، دریافت CSS و JS اصلی با محتوای همان artifact، و مرورگر واقعی که دکمه Login پنجره را باز کند، Register فرم ثبت‌نام را نشان دهد و بستن کار کند. این source فقط رابط کاربری دارد؛ ورود/ثبت‌نام backend پیاده نشده و موفقیت آن‌ها ادعا نمی‌شود. assetهای بیرونی و مشکلات خود پروژه جدا ثبت می‌شوند.

انتظار منفی: پروژهٔ نیازمند bundler/سرور صرفاً با index.html آمادهٔ Static نشود؛ asset مفقود، source/hash دست‌کاری‌شده، تغییر پورت، Node version جعلی، scope دیگر و replay رد شوند. UI سؤال نسخه/پورت/Node در برابر Static نپرسد. شکست ابزار باید علت و قدم بعدی داشته باشد؛ تکرار runtime ناموجود مصرف مدل تازه نسازد.


<a id="native-static-login-بررسی-فعلی"></a>

### بررسی فعلی

inspect واقعی از مسیر اصلی محصول سه فایل اصلی و runtime=static، port80 و بدون gap گزارش داد؛ .idea وارد بسته نمی‌شود. هیچ script اجرا نشد. قرارداد v16 ساخت بومی و v15 انتشار، decode/canonical binding و release payload رسمی در آزمون کنترل‌شده سنجیده شدند. مأموریت موجود یک فراخوانی مدل مصنوعی تا کارت انتشار رفت، سؤال فنی/job Node نساخت و همان artifact را نگه داشت. آزمون پوشهٔ مفقود نیز دسترسی به سابقه و حذف بدون source را سنجید. شواهد candidate، مرورگر و اجرای زنده پس از اجرا به همین سند افزوده می‌شوند؛ تا آن زمان live verification تأیید نشده است.

این برش فقط plain Static را گسترش می‌دهد. خانواده‌های PHP/Laravel، Django/Flask، .NET/Go، Next/React/Angular/Vue و Docker تا شاهد مستقل کامل محسوب نمی‌شوند؛ دامنهٔ [ماتریس موجود](../platform-support.md) محفوظ است.

<a id="npm-cache-cancellation-20261026"></a>

## Dependency cache cancellation — 2026-10-26

Qadam's unchanged npm lock selected 431 Linux/x64/glibc candidate dependencies. A Windows registry read failed after 419 complete tarballs (48,294,103 bytes) had been staged. No project command ran. The following attempt correctly refused the private cache because `.write-lock` remained present; that refusal was preserved rather than treated as a cache miss or a reason to delete the lock.

The cache serializer returned an abort race while its filesystem task still owned the lock. Consequently a downloader could finish its `Promise.allSettled`, and its process could exit, before the task's asynchronous `finally` completed. The serializer now settles with the filesystem task itself. Cancellation checks inside that task still stop work, and the caller receives the rejection after owned-file cleanup. Existing stale-lock, quota, integrity, symlink and ownership guards remain in force.

Validation on Windows, Node 24.18.0:

- Cache regressions: **15/15 passed**, including cancellation after observing an actual writer lock, immediate absence of owned temporary files after rejection, and a subsequent verified write.
- Biome check on the two changed files passed; typecheck passed in the current working source.
- A further real Qadam dependency attempt still failed on an official-registry network read, but the new private namespace contained **no writer lock** after the process exited. This is cancellation evidence, not a successful dependency install or project build.

The original failed namespace and its quota were retained. No source repository, cloud application, database, model allowance or production container was changed by this fix. Network availability and the complete Qadam build are separate acceptance boundaries.

<a id="php-installed-runtime"></a>

## Installed PHP/Laravel — 2026-11-02

Path: source → same Agent/web build12 → original lock/install/hooks/PHPUnit → production vendor export → fresh Apache worker → exact archive → Docker22/publication44 → original workload and byte proof. No second engine, root dependency, SQLite migration or production data action.

Final runtime `326cec88c5a35a9e7b6f98ff161ed16c231890b468f27ade8786f9f3114043cc`, basec6b45ba: lint/typecheck/build, domain829/829, HTTP48/48 and sandbox14/14 passed. These are fourteen PHP/Laravel cases, not fourteen-family acceptance. Actual web upload/mission/HTTP approval/two workers/archive/replay409/reload passed both families. Each family's publication passed ten responsive/axe states; Go/pnpm publication regressions and guided54states also passed on the same runtime. All heavy execution held the shared OS lock; the final batch exited0.

PHP fixture source `2314e2ba28541facdcca3a2588de0e28bded998e3f19e9679db2e4530f247848`; Laravel source `56cf85d464eb9aac9bb61c9828a08d29647f9c2bba7b941bb7467e5ba7e15d0a`. Laravel12.70.2 installs101 locked packages, runs original discovery hooks and four tests/five assertions, then exports5,590 files/22,798,796 bytes and starts the actual archive in fresh Apache. Public proof/API and PHP Chromium interaction/routing/reload are actual; model/Liara/DNS/TLS routing transports are synthetic, with zero real model calls or cloud writes.

Negative cases retain no artifact: failed/skipped/absent tests, wrong API, changed source, counterfeit daemon, build-tree dependency, exposed PHP source, stale lock, changed tool, tool-control environment and embedded database output. Private inputs remain absent from job/archive. Domain regressions also cover actor/approval/replay/env/proof mismatch, unsafe package paths, corrupt cached tools and sensitive-named code namespaces without admitting private data. Dot-path build-proof substitution was reproduced before the shared server-policy fix; historical parsers remain readable.

Preserved failures: initial env discovery confused PHP array arrows with member calls; incomplete Apache configuration served source and failed the JSON oracle; Apache shutdown initially killed its checker process group. Laravel's first cold101-package fetch hit the unchanged120s test budget (95 cached); its direct-kernel fixture then correctly failed risky-handler cleanup and now uses the framework test lifecycle. Public Auth/Passwords code was initially rejected by path policy; data/private-value rejection remains tested. A final harness expected PHPUnit's failure-summary spelling for a successful run; exact four/five assertions were retained. No oracle or timeout was relaxed.

Tools: [official PHP image source](https://github.com/docker-library/php), pinned image `docker.arvancloud.ir/php@sha256:1d6dadc914463434ecc4a981df24b4cf688585ce7ca091bf05a8c84e25036995`; [Composer2.11.1](https://getcomposer.org/download/2.11.1/composer.phar.sha256sum),3,797,852 bytes/SHA256 `6f1b891e1d4927d62740276c540fb490e47689e19e102c49e8da849794882f8c`; [Debian unzip](https://packages.debian.org/bookworm/amd64/unzip/download),166,504 bytes/SHA256 `1c27c879f4f7f056499c5393d422fd6c77ff6fbfa450c3f91f2f205ca788cc36`. The tool's data archive is extracted inside the worker; no host installation or package maintainer script runs. Public GitHub ZIPs retain original commit references/checksums; cached public bytes are hashed. Fresh default unzip download was unavailable in this network and used the exact verified public cache; cold bootstrap is unconfirmed. Offline Composer advisory/filter reads remain incomplete, not a security-audit claim.

Commands: `node --test tests/domain/php-build.test.ts`; `node --test --test-concurrency=1 tests/sandbox/php-build.test.ts`; after build, `node scripts/test-php-worker-browser.mjs` and `node scripts/test-php-publication-browser.mjs` (set `LAUNCHLANE_TEST_PHP_FAMILY=laravel` for Laravel publication). Tests may use `LAUNCHLANE_TEST_COMPOSER_PHAR` for the exact public tool archive; production has no fixture bypass.

UNCONFIRMED: live/native Liara, raw corpus/WordPress/Composerless PHP, Laravel frontend integration, independent workers/scheduler, general custom config/repos/versions, source repair, data connectivity/migrations/persistence/rollback and complete14 acceptance. The owner removed live Liara access; local API success is not ledger or production acceptance.

<a id="pnpm-components"></a>

## Exact compiled pnpm components — 2026-10-29

Scope: AC19/24/26/28/31/32. [ADR0047](../decisions/runtime.md#0047-exact-compiled-pnpm-components) describes the existing Agent/web build, artifact selection, approval and Docker publication path. This evidence is independent of the data lane. It introduces no resource provisioning authority, SQL, schema migration, private credential endpoint, model allowance renewal or real cloud write.


<a id="pnpm-components-implemented-path"></a>

### Implemented path

The same `propose_project_build` accepts an explicit `componentRoot` and optional reviewed internal API port. Plan9 preserves the original root package manager, lock, importers and build. It runs the selected member's original tests, exports its installed production closure or static build directory, rejects remaining background processes, removes the disposable build/install/tool trees, materializes those exact bytes, starts them with a clean production environment and independently probes the original primary/API criteria. Shutdown and unchanged exported bytes are checked before export. Missing tests are disclosed; CLI starts and start hooks fail typed instead of being removed. Test-source mutation, skips, missing compiled entries, build-tree dependencies, background counterfeit servers and wrong APIs cannot produce an artifact. Executable workspace dependencies retain independent release obligations.

The existing CodeRepairJob/output store records receipt2. It preserves verified internal links/executable bits and original source/plan/file hashes. A deterministic Docker envelope and immutable archive use the exact output. The destination only materializes/checks those bytes and runs them as uid1000, without reinstall/recompilation. Actor/job/source/plan/output/archive and fixed host/Dockerfile checks are required at selection, destination creation and publication. An uploaded marker grants no authority. Destination creation checks local bytes; publication additionally requires the existing environment interface to match the build. This avoids waiting for a cloud environment before its app exists.

ActionSpec40 uses the existing Docker provider adapter, approval, claim, write journal and observation. The original primary criterion, exact proof, APIs and static JS/CSS hashes are fenced by current/READY release and app/environment identity. A successful component remains a partially completed whole-workspace mission. Original requirements remain in the profile. Versions1–28, existing data contracts and receipt1 remain readable; no SQLite migration or production dependency was added.


<a id="pnpm-components-runtime-and-test-configuration"></a>

### Runtime and test configuration

Worktree/branch: `runtime-components`, based on `fc01252d8531da66a9ca0cb4633e53a55b692f22`; previous commits `d312350` and `55450fd` are preserved. Host Node24.18.0 and the committed npm lock. Actual worker/destination image: `node:24.18.0-bookworm-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d`. Pnpm11.19.0 uses its source-bound SRI; the explicit worktree-local tool archive is revalidated normally. The fixed plan/program enter the read-only worker input rather than Windows command-line arguments. Environment values remain stdin-only.

Heavy checks hold the shared FileShare.None OS handle for the whole command. Each run uses worktree-local disposable TEMP/TMP/state, independently allocated loopback ports and owned Docker IDs/labels. No primary installation state, model credit, cloud resource, port3000, shared Docker cache cleanup or source corpus mutation is used. Model/provider fixture responses are never presented as live model/provider acceptance.

Focused commands:

```text
node --test tests/domain/pnpm-component.test.ts
node --test --test-concurrency=1 tests/sandbox/pnpm-component.test.ts tests/sandbox/pnpm-vite-component.test.ts
node scripts/test-pnpm-component-browser.mjs
```

Worker checks need the cached pinned image; the Vite case needs public npm reads and Playwright Chromium. An explicit `LAUNCHLANE_TEST_PNPM_TARBALL` may supply the exact public tool archive. The browser harness denies external model/provider sockets and maps the single test public workload host to an actual test-owned Docker target made from the approved archive. It performs actual directory upload, mission registration, HTTP decisions, worker, archive selection, publication journal, workload sockets, replay and reload. Liara provisioning, upload/release services and DNS/TLS are controlled fixtures; the Docker destination and application responses are actual local execution.

The controlled Vite source has its own original pnpm lock, Vite8.3.1 and React19.3.0. The lock was authored with pinned11.19.0, `--lockfile-only --ignore-scripts`; project install/build/test/start run in the isolated product worker. No compiler output is checked into Git. A fresh Docker target and Chromium evaluate the built browser module, click a route and reload it. This is a controlled compiler/artifact example, not raw Factory feed acceptance.


<a id="pnpm-components-registry-investigation"></a>

### Registry investigation

Actual full metadata measured38,999,531 bytes for Vite; sixteen Linux-compatible package documents total53,820,267 bytes. The initial16MiB-per-document reader rejected Vite before build. A subsequent attempt preserved that rejection's cause but exposed pnpm11's supply-chain check of every lock entry, including non-Linux optional packages. Serving metadata only for downloaded Linux binaries correctly failed with a404 for the Android binding; no compiler/artifact pass was recorded.

The host now verifies metadata for all lock entries while downloading/serving only compatible tarballs. It requests gzip with a64MiB total wire budget, bounds each decompressed document at64MiB and total decoded work at384MiB, and retains at most64MiB of metadata for the worker. Only exact locked versions and their original publish timestamps survive into the worker registry. The frozen lock, SRI checks, minimum-release-age policy and timeouts are unchanged. Full JSON and gzip inputs, an oversized response and optional-platform metadata have explicit regressions. The [official npm metadata contract](https://github.com/npm/registry/blob/main/docs/responses/package-metadata.md) distinguishes full metadata with publish times from abbreviated installation metadata; a timestamp was not invented from `modified` or the latest tag.


<a id="pnpm-components-validation-ledger"></a>

### Validation ledger

Development runs before the final candidate are retained separately:

| Candidate/check | Result and limit |
| --- | --- |
| candidate2 runtime `a24754f38cd48c9cd1fb7e9f28029cbdc3cfa12993dc2628053e9f9c28c371d0` | lint/typecheck exit0; domain4/4; actual compiled Node7/7 including two fresh Docker archive targets; Vite failed its install policy because non-Linux metadata was absent |
| earlier actual compiled Node/archive target | worker tests/start/API and fresh Docker runtime/proof passed; this is local execution, not Liara |
| early web runs | actual upload/worker/selection/ActionSpec40 proposal reached; a280px runner select overflow and then an incorrect harness button label prevented browser acceptance |
| candidate6 runtime `8168dbd40a2855aa905d587eb604e69d49db705c27fc8ac4993ebdcf669beb2c` | lint/typecheck/build exit0; domain7/7; actual Vite compiler/original tests/export/fresh Docker/Chromium1/1; web upload/mission/decisions/worker/archive Docker/workload/replay/reload10layouts passed; predates final independent-runtime hardening |
| candidate7 preflight, 2026-11-02 | lint/typecheck and domain7/7 passed; all11 container cases stopped before execution with SANDBOX_CLEANUP_UNCONFIRMED because the Linux Docker engine pipe was absent. Docker Desktop was started; this is an environment failure, not a worker pass or an oracle regression |

Final candidate7 runtime manifest: `e4671060cf9dbf5c134b4ec7a71d22663cb0e4430f230afccee22fa4cfdb5f9d`, based on55450fd. On2026-11-02, lint/typecheck exit0, focused domain7/7 and full domain810/810 passed without skips. Lint retains49warnings/27infos. The repeated actual component suite passed11/11 in244707ms: compiled Node24, root production dependency closure, Node22, original-test failure, missing compiled entry, wrong API, skipped original test, changed test source, build-tree escape and a background counterfeit server, followed by actual Vite/React compilation/original tests/fresh Docker/Chromium. The seven negative Node cases passed by withholding an artifact and retaining the expected failure.

Vite receipt on that snapshot: tested source `72e2932a1f9de2bbb49df39e4373d1a4f18cd2088e7914eb4e3bfee7e19d2024`, plan `7fd4479c0ab7f482d461782d255d410fb3230b3923d982837fba903cf730030b`, compiled output `1055977916fb8a34deef5c82030302a4b5244bc20d035254499d64c4a74f5603`, archive `385e76e016d5fe0a3f8cb0dd86c8fac1bbf2ace7a7fd419649bdaf8608a0bf0d`. Receipt2 has5entries,17106raw bytes and9298compressed bytes. Chromium executed the transformed module, clicked the orders route and reloaded the compiled destination. This is local compiler/browser acceptance, not a public Liara release.

On the same candidate, the legacy actual-container regression passed16/16 (fullstack3, native Node20/22/24, pnpm7 and Python3); production Webpack build and HTTP48/48 passed. The actual web-to-component publication run `13534839-ad5d-42be-bc30-af6ebbe715e0` passed upload/mission/worker/selection, two HTTP decisions, the archive-built Docker destination, proof/API observation, two409 replays and reload without added usage/limit/model-log changes. The model and Liara transports were synthetic (two model replies, two provider writes); actual cloud writes were zero. Its ten review/success layouts at280/320/390/768/1280 had no horizontal overflow, axe violations or page errors. The real390px review and1280px success screenshots were visually inspected. The old pnpm review also passed six layouts and keyboard approve/reject.

Web artifact: tested source `5a08c9e6f459f46894d12ec225d068230e03e6b7453a04372192d6edb558806d`, plan `96c7c440cd03f9a729db2bd22d847dd12836d712167886164bcefc1c271007af`, output `655652b00e01bb2eced515a9096472f3ed5d2b9cbe77e06ac9f012cfde0eecea`, archive `ff911578556bd52da55d1157b1ac77db007010bcb7968961b6a94b6abd8e8127`. The test approved and uploaded those archive bytes, not a later workspace rebuild. Private screenshots/results are under `.artifacts/pnpm-component/2026-11-02T09-42-46.555Z` in the isolated worktree.

Additional legacy browsers passed on the same runtime/build: actual web-to-pnpm compile worker5layouts/replay409/reload with no artifact, guided publication54states, platform UI12states and publication-route matched/mismatch/inconclusive15layouts including real MCP schema/live-gate denial. Their transports remain synthetic. All commands completed with the shared OS lock; no runtime file changed during validation. A blocked lock acquisition is not a check result. Earlier passes are never relabelled as a later snapshot.


<a id="pnpm-components-preserved-failures-and-boundaries"></a>

### Preserved failures and boundaries

- Generated Dockerfile/payload detection initially rejected its source context. The generated filename is now explicitly captured and the opaque payload is injected by the existing archive service; the successful actor-owned job is still required.
- A development edit initially changed the wrong occurrence of the job-version condition. Self-review restored the data-runner condition exactly and extended only compiled-publication decoding. No data-runner contract change is intended.
- A first compiler harness used the standalone12-tool fixture allowance and stopped before execution. Its explicit160-read local fixture matches the Agent's normal aggregate allowance; no stored run/ledger was renewed and no actual model was called.
- The first browser overflow is traced to the existing runner select's intrinsic width; the scoped repair-card rule bounds it. Docker's pre-existing fallback badge incorrectly said Python and is corrected.
- Working-test receipts are evidence for their specific source/plan/image/output, never ledger, persistence, public-browser or complete application acceptance.

Factory feed source was reread: pnpm11.19.0, Node>=24, root `pnpm -r build`, API `node dist/main.js`, frontend Vite, and the unchanged root database wrapper. Its original PostgreSQL ledger/data tests were not replaced, disabled or run on the source corpus. Raw intake findings, data-dependent component tests, production binding/migration/persistence, multi-component topology, worker/scheduler effects, model source repair for plan9, compiled-component rollback and actual Liara publication remain UNCONFIRMED. Native PHP/Laravel/.NET/Go/Django/Flask and complete acceptance of all fourteen families remain open.

<a id="pnpm-workspaces"></a>

## Pnpm workspace execution — 2026-10-29

Scope: path B, isolated managed worktree, base fc01252d8531da66a9ca0cb4633e53a55b692f22. The original main checkout, data-path services, original corpus repositories and running installation are not modified. No real model request, allowance renewal, provider write or production SQL is performed.

The existing project intake exposes source-bound package/workspace metadata. propose_project_build creates ProjectBuildPlan8 in the same web/Agent/MCP registry and CodeRepairJob. Its ordinary review decision controls execution. Unsupported native npm publication of a pnpm artifact is explicitly blocked. Historical build1–7 and data contracts are retained.


<a id="pnpm-workspaces-measured-local-evidence"></a>

### Measured local evidence

- Factory feed source was reread: packageManager pnpm11.19.0, root Node>=24, packages apps/api, apps/web and packages/contracts, internal workspace:* links, original root recursive build and database-wrapped root tests. Exact manifest/lock hashes are in the private receipt; no original script or data operation was run for this source-only check.
- Full read-only intake of Factory feed revision e50fb16328df8dd1fccee24643c89a88d1b22615 stopped with SENSITIVE_SOURCE (56 candidate paths, first .github/workflows/ci.yml). The findings have not been classified or exempted. No Vite/Nest build, original test or ledger run occurred for that corpus. Manifest-only discovery identified four packages and 365 Linux-compatible deduplicated tarballs including the manager; that read is not full-source acceptance.
- Domain regressions exercise correct root/importers/links/Node selection, changed pins, conflicting locks, wrong links/specifiers/importers, unsupported settings, YAML aliases, foreign registries and Agent proposal before a cloud destination.
- The real pinned Node24/Docker worker installs actual pnpm11.19.0, preserves the source lock, builds linked packages and, in runtime mode, executes original Node tests/start and an independently checked JSON response. The controlled package tarball and its registry metadata are synthetic fixtures with checked SRI; pnpm and the worker are real. This is not Vite/Nest compiler acceptance for Factory feed or model-quality evidence.
- Six sequential actual worker scenarios passed in 98.059s on the r3 worker source: compile-only success, original tests/start/JSON success, original test failure, wrong JSON workload, a dependency newer than pnpm's release-age threshold, and a skipped original test. All four negative cases kept the source and produced no artifact. The test input pinned tool archive was an explicit worktree-local file revalidated by the normal SRI downloader, never the primary installation's state.
- Compile mode explicitly produces no publication artifact. Runtime mode produces the same tested source archive through the existing service; compiled byte export/publication is still an open boundary.

Tests use disposable state and exclusive FileShare.None ownership of the shared heavy-command lock. Test ports are allocated independently; port3000 and the primary installation are untouched. The branch is runtime-components, without the codex prefix, at the owner's explicit request.

The r10 runtime snapshot (07208aa0599f92e698d59247f75aa28889fe07524b3c992cf449943aed1a8562) passed domain790/790, HTTP48/48, guided54 states, pnpm review in six widths, the actual web-to-worker flow in five widths and thirteen actual container scenarios (seven pnpm, three native Node, three existing fullstack). r11 corrects v8 persisted usage parsing: 513–4096 checked dependency reads remain readable, while 4097 is rejected. Actual execution still uses the parent's stored allowance; no limit or receipt is renewed. Final rerun results and the r12 error-preservation delta follow below.


<a id="pnpm-workspaces-final-candidate-checks"></a>

### Final candidate checks

The code/package manifest is recorded in the private worktree receipt. Host Node24.18.0 and the committed npm lock are used. Worker tests use the exact Node24/22/20 image digests already in the build contracts and the pinned pnpm archive, independently SHA256 b9e49603540d04107b98e93917a30e6114970d403c23e40309a44ea9c2bca7fd; normal SRI verification still runs. No primary state/configuration is imported.

| Snapshot | Check | Measured result |
| --- | --- | --- |
| r11 / c5de7035d59570a8b33b84a314ae48d10de726ffbd9e04e2399e6d078a11155b | npm run test:domain | 791/791, 242.813s |
| r11 | npm run test:http | 48/48, 24.746s |
| r12 / a73d113eb556e0da19cbbb62ed3e863e368942209704300624e6beebe4931d45 | node --test tests/domain/pnpm-workspace.test.ts | 5/5; includes unchanged usage and underlying interrupted-error preservation |
| r12 | npm run lint; npm run typecheck; npm run build -- --webpack | All exit0; lint48warnings/23infos, no errors |
| r12 | node scripts/test-pnpm-worker-browser.mjs | Actual directory upload, mission, HTTP decision and one real worker; two synthetic model requests, compile passed, no artifact/action/cloud write; replay409, reload without added usage or workers; five widths, no axe/overflow/browser errors |
| r12 | node scripts/test-pnpm-browser.mjs | Six widths280/320/360/390/768/1280, enlarged320 text, keyboard approve/reject; no axe/overflow/browser errors |
| r12 | node scripts/test-guided-browser.mjs | 54 states in five widths; synthetic model, zero cloud writes |
| r12 | node --test --test-concurrency=1 tests/sandbox/pnpm-workspace.test.ts tests/sandbox/native-build.test.ts tests/sandbox/fullstack-build.test.ts | 13/13 actual containers, 182.680s; seven pnpm and six existing native/fullstack regressions, no skips |

r12 differs from r11 only in preserving the interrupted worker's underlying typed error/message at the compile parent boundary, with one added synthetic regression. The full r11 suite and HTTP receipt are reported against their own snapshot; they are not relabelled as r12 results. The real r12 browser receipts are .artifacts/pnpm-worker/2026-10-29T06-55-08.136Z and .artifacts/pnpm-review/after-2026-10-29T06-55-45.156Z. These private disposable artifacts are not committed.


<a id="pnpm-workspaces-preserved-failures"></a>

### Preserved failures

1. The first domain harness queried nonexistent action_attempts; the proper persisted actions table is now asserted. This was a harness error after a valid proposal, not a product pass.
2. First actual pnpm execution failed with ERR_PNPM_FETCH_404 during its supply-chain verification because the private worker registry served tarballs without metadata. The original failure is retained privately. The implementation now verifies official package metadata name, version, tarball integrity and release time; the policy was not disabled.
3. Typecheck caught an unknown tar-stream chunk in the fixture and a nonexistent job.usage assertion. The fixture now narrows actual Buffer bytes; the invalid assertion was removed.
4. Web harness attempts r4–r7 reached actual worker success but failed their own hidden/duplicate/screen-reader text or terminal-state wait. These were not browser passes. The final harness polls the actual authenticated run endpoint until terminal, opens the existing disclosures and checks visible text plus the independent stored receipt. It does not intercept the decision/job/receipt.
5. Web attempt r8 timed out fetching the pinned public tool before container execution. It is retained as a preparation failure. The reproducible test accepts an explicit worktree-local tool tarball, puts it through the existing disposable integrity-checked cache and normal worker path, and does not borrow the primary installation's cache.
6. A Docker source declaring pnpm10 originally entered the native pnpm11 validator. Its regression failed with PNPM_VERSION_UNSUPPORTED. Explicit Docker routing now retains the image-owned package manager and the existing Docker plan6; native pnpm checks cannot override it.
7. A persisted v8 receipt with usage513 originally failed INVALID_INPUT on status/reload. The focused regression reproduces that failure, then verifies reading the unchanged receipt and the existing maximum4096, rejecting4097. Historical non-build and build1–7 parsing bounds remain unchanged.
8. The r11 web rerun failed before receiving a container identity, with SANDBOX_CLEANUP_UNCONFIRMED and no test receipt. It is not a worker pass. Subsequent locked Docker version/label-filtered container readback found the Linux daemon healthy and no locked-build-v1 containers; no uncertain resource was removed or creation blindly replayed. The original cause remains unconfirmed. The parent now preserves the underlying code instead of substituting PNPM_COMPILE_INCOMPLETE. A separate fresh disposable r12 web case passed after this readback.


<a id="pnpm-workspaces-open-boundaries"></a>

### Open boundaries

Native provider pnpm execution, exact compiled workspace artifact publication, independent per-component release topology, production data binding/migration/connectivity/persistence, background consumer/scheduler effect checks and fresh public browser workloads remain UNCONFIRMED. Existing source-only requirements and publication gates continue to require those effects. Source complexity, a local build or a synthetic provider cannot close the complete-product acceptance criteria.

<a id="pre-destination-preparation-20261027"></a>

## Source preparation before destination, 2026-10-27

Acceptance: AC17/19/26/27/32, partial. The nine reference projects remain a capability corpus. This change does not complete their deployment or the complete-application planner.


<a id="pre-destination-preparation-20261027-reproduced-product-boundary"></a>

### Reproduced product boundary

A supported raw single Worker/SQLite project needs deterministic preparation before its profile can satisfy application-publication scope. A destination must bind the actual final artifact. However, a structured publication mission hid `propose_project_build` until a destination existed. Independent adapter calls could propose/build the project, while the product mission could not offer that preparation. This is a product orchestration deadlock; an earlier manually selected successful artifact cannot demonstrate that the raw-source mission works.

A new regression registered an actual publication mission for the captured raw Worker, imported a synthetic private input using the existing encrypted store, and drove the real Agent/tool/proposal services with a synthetic model. It failed before the correction because the preparation tool was absent. Existing Worker detection, preparation-byte preservation and successful-receipt publication guards remained passing (3/4 in that before run). No Docker command, package download, model request or provider write was performed by this regression.


<a id="pre-destination-preparation-20261027-correction-and-retained-boundaries"></a>

### Correction and retained boundaries

The host now selects the existing fullstack preparation mode from the inspected `requiresPreparation` metadata. It offers the same bounded `propose_project_build` before account/destination selection for that mode. Ordinary Node/Python publication programs retain their destination prerequisite; publication and disk tools remain unavailable without their destination. Disabled local-repair gates still remove executable proposal tools. A model cannot grant preparation or cloud consent by choosing the mode.

The proposal reuses existing v7 build/preparation, reviewed paths, unchanged dependencies/tests, API expectations, encrypted source-input reference and local approval/execution services. No new executor, shell, migration or approval canonicalization was added. Fullstack preparation is not promoted into a generic mission authority. Original source and private values stay outside model output and source archives as before.

After a successful approved preparation selects a new artifact, the driver now chooses its source profile and applicable tools after that selection. It previously captured the profile before running the queued job. Guidance distinguishes this necessary local preparation from the ordinary destination-bound publication program.

The fresh Worker mission reaches the real local preparation review, bound to the same source/mission, exact Node24 image, page/API criteria and private-input reference, with no account, destination, container, artifact, infrastructure attempt or general publication authority. Rejecting that proposal executes nothing and preserves the original package bytes and run limits. A separate nested frontend/API regression reaches the corresponding v7 review with both package roots and exact API criteria. The model-client catalog bound is checked for all three preparation modes.


<a id="pre-destination-preparation-20261027-validation"></a>

### Validation

The focused set passed 28/28, covering Worker, nested fullstack, build registry, old publication-resume prerequisites and the proposal-progress regressions. Scoped lint had no error. An initial whole-working-tree type check hit a concurrent, unrelated `project-file-range.test.ts` nullable-line type error; that failure is retained and those edits are not part of this change. A separate export of selected tree `725534f5b603abc3e7d43f17ddae1840c3e75f61` (579 tracked files, no installed-private-value matches) passed 705/705 domain tests (251,828 ms), 40/40 HTTP checks (15,070 ms), type generation/checking and the production Webpack build. Selected lint had zero errors, 48 warnings and 20 informational diagnostics.


<a id="pre-destination-preparation-20261027-raw-qadam-mission-with-an-actual-linux-worker"></a>

### Raw Qadam mission with an actual Linux worker

The same selected tree was packaged as tar SHA-256 `f9ec610ba6105f7fa52806f273aa330fdde8a63530f69e4ca63afc59c808db53`, verified file by file on the existing VPS and imported by a separate local controller. It used a new disposable test store, synthetic authentication/provider credentials and synthetic model/provider ports. It did not copy the real account credentials, model ledger or business data. Its input was a private copy of the earlier immutable 98-file Qadam upload, source hash `f3d762ae3031a226d81d5dd847684b8d6b90d2f3e8309ad74e6d0c716e4c8710`, with the existing integrity-verified package cache. No original repository or production service was opened for mutation. The controller called the actual mission, tool, local-decision, worker, artifact-selection and proposal application services.

The first local build correctly failed its unchanged API oracle: npm installed 428 packages, Vite built 79 modules and all 193 tests in 19 original files passed, but the harness had supplied only `SESSION_SECRET`. The inspected Worker required `ICS_TOKEN`, `PASSWORD_HASH` and `SESSION_SECRET`; `authenticationConfigured=true` was therefore false. The workload stage exited 73, no artifact was selected, and the failed job `f244ceb1-9a4c-47c7-a226-222fcc9104e9` was retained. The controlled model also asserted the success-only next tool catalog after that failure and threw; its synthetic unknown-usage counter remains recorded. That harness exception is not a real model request or credit charge. Required-input preflight and the raw-source secure-input UX remain separate improvement work; no application/API assertion was removed.

After supplying all three source-declared names with explicitly synthetic values, the controller resumed the same mission `e823dd8f-5914-4276-a2de-eed648bff41c`, retaining its history, failed job, usage and limits (8 simulated model turns / 160 tools / 600,000 ms). It obtained a fresh source-input-bound local proposal/decision. The subsequent real offline worker job `8909a0a2-6c16-458c-8bd8-0a00f99498d8` passed build, all 193 original tests, original `/` / HTTP200 / `قدم` workload, compiled assets and the unchanged health requirements (database ready, authentication configured and nine migrations). The continuation took 114,389 ms. Worker lifecycle cleanup left no running customer-worker container.

The driver selected exact compiled artifact `30dad24c1f9726305376f01d11b95bf4e0fa3c626420ec67be4d5d33fabdad6b`. The next model-port call checked that the old raw preparation tool was absent. `inspect_project` returned the successful local receipt after archive/output revalidation, while explicitly retaining unverified cloud publication/storage. The model port then chose destination/catalog/network reads and the actual destination proposal. That review bound the new source and exact new artifact, with no attempt or cloud send. Both the original mission criterion and all 98 original file hashes remained unchanged. The same mission is retrievable under the newly selected project, and its two jobs retain one failed and one successful receipt.

This is an Agent/application integration with a **real Linux build/test worker and synthetic model/provider transports**. Eight recorded model turns, zero reported synthetic tokens and one retained synthetic unknown-usage count must not be described as real model consumption. Actual model and provider requests: zero; dependency tarball downloads: zero; infrastructure attempts: zero. The prior [native real-model/browser proposal](interface.md#native-proposal-progress-20261027) and earlier independent 27 persistence/workflow checks are separate evidence for their own artifacts and paths.

The combined raw-source web/real-model/worker trajectory, cloud environment/disk/release, persistence after a cloud restart, additional Cloudflare bindings, other languages, resource sizing and multi-service/database provisioning remain unverified. No paid resource or model allowance was created. Public production stayed on image `a547236e…`, healthy with zero restarts and no OOM.

<a id="python-real-project"></a>

## Python و پروژهٔ واقعی ترب — ۲۰۲۶-۱۰-۲۳

وضعیت: انتشار بومی Python و چرخهٔ اصلاح/انتشار مجدد روی پروژهٔ واقعیِ آماده‌شده تأیید شد. این گزارش A06/A08/A10/A11/A18 را فقط در محدودهٔ بیان‌شده پوشش می‌دهد؛ پذیرش عمومی همهٔ runtimeها یا رابط هم‌زمان نیست.


<a id="python-real-project-محدوده-و-نسخه"></a>

### محدوده و نسخه

کد Backend از برش `bc6a590` تا `ea33604`، روی `main` و با export مستقل اجرا شد. هر ۱۱۳ فایل `src/server`، `src/contracts` و `src/app/api` در اجرای زنده با `ea33604` تطبیق داشتند. رابط آن export پایهٔ `ca4dfcc` است؛ سازگاری کارت‌های Python و متن نتیجه در `2c89d97` پس از همین دادهٔ زنده بازآزمایی شد. تغییرات باز و کامیت‌های طراحی Agent موازی، و تغییرات هم‌زمان انتخاب/آپلود منبع، از این اجرا پذیرش نمی‌گیرند. Node میزبان 24.18.0، Next 16.4.2 و worker واقعی Python 3.12/Linux x86_64 با digest ثابت ADR0015 استفاده شدند.

منبع، API واقعی FastAPI و فرانت‌اند واقعی React/Vite پروژهٔ `torob-inperson-assistant` بود. مخزن اصلی تغییر نکرد؛ وضعیت Git آن تمیز و هر ۲۸ فایل Pythonِ کپی اولیه با اصل برابر ماند. یک کپی آمادهٔ انتشار شامل این فایل‌ها، قفل ۱۸ dependency، entry مستقیم `python3 main.py`، تنظیمات بومی Liara و ۷ فایل ساخته‌شدهٔ فرانت‌اند آماده شد. build واقعی فرانت‌اند، ۲۶ package قفل‌شده، typecheck، Vite build، start و GET را در Node22/Docker گذراند؛ entry پیش‌نمایش برای همین آزمون worker به کپی افزوده شده بود.

دیتابیس ۴۱۰٬۴۸۸٬۸۳۲ بایتی ترب، env و credential در کپی و archive نیستند. بدون دیتابیس، جست‌وجوی معتبر باید `503/catalogue_unavailable` بدهد؛ ورودی فاقد پارامتر الزامی `q` باید 422 باشد. کلیدهای دستیار خرید داخل ترب هم وارد نشدند، پس `ready:false` آن سرویس انتظار صحیح این تست است؛ این وضعیت با Agent انتشار Launchlane، که با مدل واقعی اجرا شد، فرق دارد. این اجرا صحت کاتالوگ، جست‌وجوی داده، تماس با فروشنده یا مدل داخلی ترب را اثبات نمی‌کند.

این کپی از قبل entry، requirements و bundle داشت. تبدیل خودکار یک monorepo خام، dependency edit، pyproject عمومی، Django، Python غیر 3.12 و build عمومی Next از این شاهد نتیجه نمی‌شوند.


<a id="python-real-project-اجرای-واقعی-و-شکستهای-حفظشده"></a>

### اجرای واقعی و شکست‌های حفظ‌شده

درخواست‌های مدل به BoxAPI `gpt-6-luna` و درخواست‌های زیرساخت به API واقعی Liara رفتند؛ مسیر HTTP خود محصول، session/CSRF، SQLite، CodeRepairJob، approval، claim و journal واقعی استفاده شدند. مشکل VPN با relay محدود TLS روی رابط فیزیکی همین نصب دور زده شد؛ VPN، proxy و route سیستم تغییر نکردند. این relay تنظیم محلی آزمون است و به‌عنوان قابلیت عمومی محصول ارائه نمی‌شود.

| مشاهده | علت یا حد شواهد | اصلاح / نتیجه |
| --- | --- | --- |
| wheel وابستگی tzdata با tag `py2.py3` رد شد | matcher فقط `py3` را می‌پذیرفت | tag معتبر پشتیبانی شد؛ runtime/architecture نامناسب همچنان قبل از download رد می‌شوند |
| loader وابستگی باینری با `failed to map segment` شکست خورد | tmpfs با `noexec` مانع mmap کتابخانهٔ native می‌شد | `exec` داخل containment موجود؛ network none، non-root، read-only source و محدودیت‌ها حفظ شدند |
| ساخت فرانت‌اند با `tsc: Permission denied` شکست خورد | فایل اجرایی نصب‌شده روی همان tmpfs اجرا نمی‌شد | آزمون واقعی Node پس از اصلاح، npm ci/typecheck/build/start/GET را گذراند |
| اولین نصب Python به timeout رسید | همان workspace و wheelها در اجرای مستقل گذشتند؛ علت تفاوت دقیق تأیید نشده است | staging wheelهای checksumشده در tmpfs، `--no-compile` و زمان هر مرحله؛ شکست شبکه/نصب به patch کد تبدیل نشد؛ همان run و سهم قبلی ادامه یافت |
| bundle واقعی React به‌عنوان credential تشخیص داده شد | metadata بولی `password:!0` با مقدار محرمانه اشتباه گرفته شد | فقط boolean/null/undefined بدون quote تفکیک شدند؛ literal و secret شناخته‌شده همچنان مسدودند |
| فایل API حدود ۱۳٫۲ KiB و خروجی کامل آن برای worker نامناسب بود | سقف قدیمی ۱۲ KiB و الزام بازگرداندن کل فایل | exact replacements روی hash پایه، سقف مستقل متن و تست match مفقود/تکراری/هم‌پوشان؛ بررسی پیش از approval |
| پیشنهاد اصلاح پس از session تازه اجرا نشد | authority نشست قدیمی قابل انتقال نبود | پیشنهاد استفاده‌نشده با همان scope دوباره بررسی و بدون authority تازه جایگزین شد؛ تصمیم دوم لازم ماند و بودجه تمدید نشد |
| وصلهٔ نخست مدل همچنان Root404 داد | فایل HTML را در `apps/web` فرض کرده بود | همان معیار واقعی شکست خورد؛ artifact منتشر نشد؛ ورودی/وصله/خروجی شکست حفظ شدند |
| وصلهٔ دوم Root200 می‌داد ولی JavaScript404 بود | معیار تک‌صفحه‌ای HTML برای پذیرش UI کافی نبود | پنج آزمون مستقل پیش از تأیید انتشار اجرا شدند و نسخه رد شد؛ فهرست محدود نام فایل‌های واقعی به worker اضافه شد |
| یکی از پنج آزمون مستقل انتظار 503 از درخواست ناقص داشت | `q` اجباری بود و 422 پاسخ صحیح برنامه بود | ورودی تست اصلاح شد؛ هم 422 ورودی ناقص و هم 503 درخواست معتبر بررسی می‌شوند؛ آزمون JavaScript ضعیف نشد |
| مدل آرگومان publication را به `read_destination` داد و run قطع شد | اعتبارسنجی آرگومان در transport، پیش از نتیجهٔ هم‌بستهٔ ابزار متوقف می‌شد | ابزار، JSON معتبر ولی دارای فیلد اضافه را در application رد می‌کند؛ regression تصحیح داخل همان بودجه و صفر read نامعتبر را سنجید؛ JSON خراب همچنان fatal است |
| CSS200 کنار Font404 و HTML200 کنار Icon404 بود | معیار یک فایل، گراف منابع هم‌مبدأ را نمی‌سنجید | checker محدود HTML/CSS، script/style/icon/font هم‌مبدأ را هم می‌خواند؛ قبل از اصلاح هر دو شکست واقعی و پس از آن شش asset گذشتند |
| کارت‌های Python در UI پنهان بودند | guard کامپوننت‌ها فقط v7/v10 و v8 را می‌پذیرفت | v11/v12 و نمایش runtime افزوده شد؛ کنترل تأیید/رد Python و نسخه‌های Node با SSR واقعی کامپوننت‌ها، و کارت نتیجه با دادهٔ زنده در مرورگر بررسی شدند |
| متن مرحلهٔ اصلاح، پس از انتشار هنوز «منتشر نشده» می‌گفت | receipt محلی تاریخی بدون توجه به attempt انتشار نمایش داده می‌شد | receipt حفظ شد؛ متن UI به کارت وضعیت انتشار ارجاع می‌دهد؛ تغییر طراحی/انیمیشن همکار وارد این کامیت نشد |
| آخرین HTTP یک بار 27/28 شد؛ لغو 409 گرفت | ثبت، claim و reservation مدل revision را جلو می‌برند؛ تست پیش از ورود fixture به درخواست مسدودشونده لغو می‌کرد | چهار بازآزمایی هدفمند سبز، سپس انتظار روی رویداد واقعی fixture، رد صریح revision اولیه با 409 و لغو revision تازه با 200؛ full HTTP و domain هم‌زمان دوباره 28/28 و303/303 شدند؛ guard سرور ضعیف نشد |

API ابتدا با قرارداد v12 در مقصد Python جدید ساخته و با v11 منتشر شد. شناسهٔ برنامه `<resource-id>` و انتشار نخست `<resource-id>` بودند. release جاری/READY و `GET /openapi.json=200` با عنوان دقیق API تأیید شدند؛ `GET /=404` مستقل باقی بود و موفقیت کل UI اعلام نشد.

مأموریت Root، وصلهٔ نخست نامؤثر و وصلهٔ دوم ناقص را ثبت کرد؛ انتشار نسخهٔ دوم پیش از cloud write رد شد. برای معیار تازهٔ asset، همان runtime اصلاح‌شده به کپی تازه رفت؛ فقط توضیح پذیرش و ورودی نادرست تست اصلاح شدند. source/معیار تازه، مأموریت و مجوز تازه دارد؛ شمارنده‌های دو مأموریت قبلی و دفتر مصرف مدل حفظ شدند. این مورد reset پنهان بودجهٔ retry در یک run نیست. پنج آزمون این کپی در ادامه تغییر نمی‌کنند.


<a id="python-real-project-قرارداد-اجرایی"></a>

### قرارداد اجرایی

Python انتشار بومی با `type:python`، `platformConfig.version:3.12` و argv صریح دارد. ActionSpec v11/v12، image، source/archive، حساب/ID مقصد، plan، runtime و همان workload را می‌بندند. مجوز اجرای محلی با مجوز ساخت مقصد و انتشار جداست. فایل آزموده‌شده از workspace جدا و archive پایدار انتخاب می‌شود؛ adapter به منبع اصلی برنمی‌گردد.

wheelها از metadata رسمی PyPI گرفته و با اندازه/SHA-256 بررسی می‌شوند؛ pip در Docker بدون شبکه و با `--no-index --no-deps --only-binary=:all: --require-hashes` اجرا می‌شود. فایل‌های credential، SQLite و venv کنار گذاشته می‌شوند. receipt تنظیمات معادل صحت workload نیست؛ نتیجهٔ release پیش و پس از probe خوانده می‌شود.

`sourceInventory` فقط نام حداکثر ۱۲۸ فایل و ۸ KiB را با تعداد موارد حذف‌شده می‌دهد. محتویات assetهای نامرتبط وارد مدل نمی‌شود؛ این فهرست هیچ مجوز ویرایشی ایجاد نمی‌کند. beforeHash، allowedPaths و آزمون‌ها مستقل enforce می‌شوند.

کپی wheel فقط از job موفقی مجاز است که artifact آن دقیقاً source انتخاب‌شدهٔ فعلی است. قفل requirement، فهرست، اندازه و checksum تمام bytes دوباره کنترل می‌شوند؛ کش تصادفی یا نسخهٔ دیگر پذیرفته نیست. این کار درخواست واقعی تازه‌ای به PyPI ندارد و یک واحد بررسی محلی مصرف می‌کند. در ادامهٔ واقعی، دو دانلود تکراریِ ۳۶ واحدی لازم نشدند و شمارندهٔ همان مأموریت در ۱۱۴ ابزار باقی ماند؛ بودجه تمدید نشد.

پیش‌فرض مأموریت تازه ۲۴ درخواست مدل، ۱۶۰ ابزار و۶۰۰٬۰۰۰ میلی‌ثانیه است؛ اجرای QA صریحاً ۲۴/۱۶۰/۹۰۰٬۰۰۰ داشت. یک مسیر واقعی با اصلاح و بازیابی ۱۷ درخواست مدل مصرف کرد؛ سقف پیشین ۱۶ برای این شاهد کافی نبود. مدل/ابزار/زمان runهای ذخیره‌شده از مقدار ثبت‌شده استفاده می‌کنند؛ تغییر پیش‌فرض یا `feedback` در ادامه سهم قدیمی را تمدید نمی‌کند. توضیح ادامه مرجع source، معیار اصلی و مجوز را عوض نمی‌کند.

checker وب فقط هم‌مبدأ، حداکثر ۱۶ asset، ۵۱۲ KiB هر asset، ۲ MiB مجموع و عمق محدود را می‌سنجد. منابع خارجی را unverified ثبت می‌کند؛ browser، منطق JavaScript، گردش‌کار داده و همهٔ مسیرها از این بررسی نتیجه نمی‌شوند. همین نمونه شش asset محلی و صفر مرجع خارجی داشت.


<a id="python-real-project-نتیجه-زنده-و-شناسهها"></a>

### نتیجهٔ زنده و شناسه‌ها

۴۷ درخواست واقعی مدل، ۴۵۹٬۰۷۲ توکن گزارش‌شده و سه مأموریت با scopeهای API، Root و asset ثبت شدند؛ این‌ها ۴۷ سناریوی مستقل گفت‌وگو نیستند. درخواست‌های رفع خطا و worker در همین تعداد هستند. دفتر تجمعی و همهٔ شکست‌ها حفظ شدند. برای ایجاد و دو انتشار، دقیقاً سه attempt وجود داشت و هر action فقط یک attempt داشت؛ پیشنهاد Root ناقص با صفر attempt لغو شد. replay هر تصمیم 409 گرفت و refresh صرفاً read بود.

| شاهد | نتیجه |
| --- | --- |
| انتشار نخست | `<resource-id>`؛ API صحیح و Root404 واقعی |
| انتشار اصلاح‌شده | `<resource-id>`؛ release جاری/READY و criterion مصوب تأیید شدند |
| archive نهایی | `479c91ff09e17af12c2703b89060bd736897c125f98d20d5514087f4271cc284`؛ ۴۱ فایل، ۱۹۰٬۲۳۷ بایت فشرده |
| source نهایی | `bc57f9dcf00ee4355a2969a1194cc403270baf1393aa07e48d7e973bc6ab1ffa` |
| صفحهٔ اصلی | GET200، ۹۱۲ بایت؛ برابر با HTML ساخته‌شده |
| JavaScript / CSS | GET200؛ ۲۹۹٬۸۴۵ /۲۲٬۷۳۰ بایت؛ هر دو SHA-256 برابر فایل بسته |
| فونت و آیکون‌ها | شش resource محلی در checker و فونت IRANYekan در Chromium واقعاً بارگیری شدند |
| OpenAPI | GET200؛ عنوان `Torob local historical catalogue` و endpointهای واقعی حفظ شدند |
| جست‌وجو بدون دیتابیس | `q=گوشی` برابر503 با `catalogue_unavailable`؛ نبود `q` برابر422 |
| دستیار خرید ترب | GET200 و `ready:false`؛ این تست credential آن سرویس را وارد نکرد |

URL هنگام آزمون `<deployment-origin>` بود. پس از اعتبارسنجی و تصویرها، شناسهٔ دقیق برنامه با رسید ساخت تطبیق داده شد؛ یک DELETE با پاسخ200 و readback404 در `2026-10-23T03:28:07Z` ثبت شد. برنامهٔ آزمایشی باقی نمانده و URL پس از cleanup برای بازدید زنده نیست. پاک‌سازی، دادهٔ اصلی ترب یا برنامهٔ دیگری را تغییر نداد.


<a id="python-real-project-نتیجه-بررسیها"></a>

### نتیجهٔ بررسی‌ها

| بررسی | نتیجه و حد |
| --- | --- |
| `test:domain` نهایی | 303/303، صفر fail/skip؛ provider عمدتاً مصنوعی، SQLite/فایل/اجرای Node و SSR کامپوننت واقعی |
| `test:http` نهایی | 28/28، صفر fail/skip، روی build ایزوله و provider مصنوعی؛ شکست قبلی27/28 در بالا حفظ شده است |
| Python/native sandbox انتخاب‌شده | 4/4، صفر fail/skip؛ Docker واقعی، patch model مصنوعی؛ این عدد کل `test:sandbox` نیست |
| پذیرش مستقل نسخهٔ واقعی ترب | پنج unittest بدون تغییر داخل مأموریت نهایی و شش asset هم‌مبدأ، همگی موفق |
| Playwright با سرویس واقعی | ترب و Launchlane پایه، هر کدام در1280 و390؛ چهار مشاهدهٔ صفحه، بدون overflow و بدون pageerror |
| تعامل واقعی مرورگر | جست‌وجوی فارسی با503 صحیح و پیام صریح نبود کاتالوگ؛ فونت loaded؛ دو تب، کارت تأیید انتشار و لینک نتیجه حاضر؛ refresh صفر درخواست مدل تازه |
| console مرورگر | یک خطای resource503 برای جست‌وجوی بدون دیتابیس، مطابق انتظار؛ صفر JavaScript pageerror؛ ادعای «console کاملاً خالی» وجود ندارد |
| build/typecheck/lint پروژه | موفق؛ lint روی پایهٔ UIِ exportشده ۳۰ warning و۹ info موجود داشت؛ lint خطا نداشت |

بخشی از شواهد در چند revision و پس از کشف خطا تکمیل شدند؛ یک pass هدفمند جای failure قبلی را نگرفته است. مدل برای مسیرهای غلط اصلاح مؤثر/نامؤثر متفاوت ساخت و checker مستقل مانع اعلام موفقیت زودهنگام شد. کیفیت همهٔ مکالمه‌ها، بار هزاران کاربر و نرخ موفقیت عمومی از این نمونه نتیجه نمی‌شوند.

خودآزمون kit مربوط به skill طراحی نیز اجرا شد: `RESULT: 12/52 checks passed`. harness/وابستگی‌های خود kit، از جمله Playwright و نمونهٔ لازم، در آن نصب فراهم نبودند و چند فرمان با Windows سازگار نبودند. این عدد امتیاز Launchlane نیست و به‌عنوان gate موفق پروژه ثبت نمی‌شود؛ Playwright نصب‌شدهٔ خود پروژه برای شواهد مرورگر بالا استفاده شد.


<a id="python-real-project-بازتولید-و-حدود"></a>

### بازتولید و حدود

تست‌های خودکار با مدل/transport مصنوعی و اجرای واقعی ابزار، از شواهد مدل/PaaS بالا جدا هستند:

```text
npm run lint
npm run typecheck
npm run build
npm run test:domain
npm run test:http
node --test tests/sandbox/python-build.test.ts tests/sandbox/native-build.test.ts
```

تست sandbox به Docker Linux و imageهای digestشدهٔ Python3.12/Node22 از قبل موجود نیاز دارد؛ domain و HTTP به credential ابر نیاز ندارند. `npm run test:sandbox` مجموعهٔ بزرگ‌تر Node را نیز اجرا می‌کند و معنای آن با دستور دو فایل بالا یکسان نیست.

اجرای زنده نیازمند credential محلی، اتصال واقعی Liara، allowlist مقصد، Docker و فعال‌بودن gateهای محلی و ثبت allowance محدود است؛ جزو اجرای خودکار تست‌ها نیست. env در archive یا ورودی مدل قرار نمی‌گیرد. درخواست‌های تکراری و replayِ تصمیم با همان ID نباید attempt دوم بسازند. URL یا READY به‌تنهایی oracle موفقیت نیست.

شواهد خام، source archive، مصرف حساب و تصویرهای runtime در خروجی خصوصی و ignored اپراتور نگه‌داری می‌شوند؛ کلید، env، دیتابیس و آن فایل‌های تولیدشده وارد Git نشده‌اند. این گزارش، ADR0015 و TASKS فقط خلاصهٔ قابل انتشار و حدود پذیرش را نگه می‌دارند.

<a id="raw-torob-source"></a>

## ورود سورس خام ترب؛ بدون آماده‌سازی بیرون محصول

پایه53844bd، source اصلی `torob-inperson-assistant` روی96a38011da16580caf84e4bffee4826a29b698a7 و working tree تمیز. oracle: capture فقط‌خواندنی ریشه از scanner خود محصول، بدون script/import، بدون خواندن SQLite/.env و بدون حذف تست‌ها؛ credential واقعی/شناخته‌شده و literal نامشخص همچنان رد شوند.

پس از اصلاح،234فایل و2533177بایت با source hash `8f7b99351417f35048cc7265a99df631824f018eb67f95e56858a157527092a2` capture شدند. شروع اجرا و پورت همچنان نامشخص‌اند؛ این نتیجه آمادگی انتشار نیست. scanner پیش‌تر روی شناسهٔ هماهنگی UI و fixtureها متوقف می‌شد. reference کامل متغیر/عضو JavaScript اکنون literal credential محسوب نمی‌شود؛ default/operator همچنان رد است. قالب‌های محدودِ نام درخواست تست، URL با نام/رمز صریح نمونه و دامنه رزروشده، و کلیدهای API آزمونِ توصیفی dummy یا نامعتبرِ چندکلمه‌ای جدا شده‌اند. استثنا فقط روی نوع فایل/محدوده تست و قالب دقیق مقدار است؛ فایل کامل، همه tokenها یا همه تست‌ها مجاز نشده‌اند. اسم/رمز و کلید واقعیِ نامشخص، authToken، رشته high-entropy، مقصد واقعی و exact installed secret همچنان مسدودند. log redaction تغییر نکرده است.

هفت تست domain/workspace پاس، با موارد مثبت و منفیِ همان شکست‌ها و منع عبور مقدار known حتی با ظاهر placeholder. شکست‌های قبلی hooks، pagination، URL ورودی نامعتبر و fixture API در شواهد خصوصی حفظ‌اند. این طبقه‌بندی heuristic منبع جای بازبینی credential یا اثبات نبود تمام انواع secret نیست. source اصلی، test oracleها، دیتابیس410488832بایتی، ledger و بودجه ترب تغییر نکردند؛ مدل/ابر تازه صفر. کشف کامل env، manifest انتشار، build فرانت و Python روی artifact مشترک، disk/mount و اجرای زنده هنوز بازند.

<a id="source-syntax-20261027"></a>

## Source intake syntax corrections, 2026-10-27

Acceptance boundaries: AC02 source intake, AC04 private data, AC19 evidence, and the corpus source-to-artifact boundary. This slice changes the shared scanner used by capture and archive. It does not exempt a project, run uploaded code or grant a publication/model/resource decision.


<a id="source-syntax-20261027-reproduced-problem-and-change"></a>

### Reproduced problem and change

Four fresh regressions initially failed: compound Python f-strings containing only runtime references, a Python comment referring to the Bearer header, exact omission markers in Markdown setup instructions, and actual DOM input reads through native document methods or one locally proven selector alias. Treating these expressions as embedded credential values prevented valid source intake.

The Python classifier accepts simple variable/member expressions with only separators or a Bearer/Basic prefix; quoted constants and nonempty static fragments stay scannable. The JavaScript syntax pass tracks bindings and writes before recognizing a narrow DOM input expression. Reassigned or shadowed aliases, imported/shadowed document objects, explicit method mutations and fallback constants remain blocked. Exact `...`, `sk-...`, `sk-or-...` and `sk-ant-...` are omission markers only in Markdown; they are not runtime credential defaults.

Installed/imported known-secret checks run before normalization, including JSON and URL-encoded variants. The ordinary log redactor is unchanged. Syntax classification never imports or executes the inspected project and does not rewrite the original bytes. An integration test captures and archives the original JavaScript/Python bytes, then requires both capture and archive to reject an adjacent literal credential. The first negative archive fixture omitted its required source hash and failed with `INVALID_INPUT`; it now supplies the valid earlier hash and preserves the `SENSITIVE_SOURCE` oracle.


<a id="source-syntax-20261027-owner-reviewed-test-fixtures-and-remaining-boundary"></a>

### Owner-reviewed test fixtures and remaining boundary

The owner's confirmation was applied only to the same 19 hash-listed Data Agent test files through the product's installation-signed review command. Review `11ba3d69-7467-4eb7-a93a-61364b660bcb` expires at 2026-11-02 17:32:22.037 UTC. No review was installed for source or documentation, and recovery does not renew it.

A fresh actual Data Agent capture still fails closed with `SENSITIVE_SOURCE` at eight other paths. They include source, Markdown and a JSON verification result. The original repository is unchanged and no publishable archive was issued. The remaining candidates need their actual syntax/value semantics or a proper private preparation path; test-fixture confirmation cannot authorize them. No cloud resource, public deployment or model allowance was created.


<a id="source-syntax-20261027-checks-and-limits"></a>

### Checks and limits

`node --test tests/domain/source-runtime-references.test.ts tests/domain/source-placeholders.test.ts tests/domain/source-fixture-review.test.ts` passed 21/21 with zero skips. Scoped Biome lint passed with zero errors/warnings and one informational template-string suggestion. An attempted unsupported Biome command-line flag failed before lint; the actual `biome lint` command supplied this result.

The complete selected snapshot `ef0a665c0a0d9aa8c5a214511b586d3b4a87c7a7`, based on `dbbeadc`, then passed 697/697 domain tests in 201,278 ms and 40/40 HTTP tests in 7,069 ms, with zero skips. Type generation/checking and the production Webpack build passed. Source lint checked 444 files with zero errors, 48 warnings and 20 infos. The Git-blob export contained 575 tracked files, no private installation state and zero known-private-value matches; dependencies came from the existing pinned cache. Provider/model transports were synthetic. Only evidence/TASKS text changed after these checks; the runtime/test blobs did not. No UI changed in this slice, so earlier UI evidence keeps its recorded snapshot identity.

This is a bounded static classification improvement, not proof of absence of every possible semantic secret or support for arbitrary dynamic language syntax. Complete Data Agent intake, pyproject dependency preparation, Docker packaging, actual storage and application publication remain UNCONFIRMED. Source-to-plan-to-execution product work continues under [the corpus contract](../deployment-corpus.md).

<a id="vue-compiled-component"></a>

## Vue compiled component — 2026-11-02

AC19/24/26/28: this advances the Vue compiler/artifact boundary of the fourteen-family mission. It does not establish complete Vue, native Liara, backend/data, or all-fourteen acceptance. The existing plan9/ActionSpec40 route is reused; no new registry, approval, data contract, dependency or migration is added.

The product now derives an explicit Vite output from both `--outDir directory` and `--outDir=directory`. Previously the equals form silently selected `dist`, even when the original compiler wrote elsewhere. Missing values and repeated output flags fail typed before execution. The original root command/lock are retained. This affects React/Vue Vite components through the same Agent build tool and web review.

The controlled original fixture uses Vue3.5.44, plugin-vue6.0.10, Vite8.3.1, pnpm11.19.0 and source-constrained pinned Node24.18.0. It has an actual `.vue` single-file component, plugin config, quantity/zero/fractional source tests and a compiled-output test. Its original build writes `public-build` using the equals flag. The fixture's own lock was authored without running project scripts; no upstream corpus or database was changed. The [Vue quick start](https://vuejs.org/guide/quick-start.html) describes the Vite/SFC path; actual installed versions and integrity come from the committed fixture lock, not provider defaults.

The actual existing CodeRepairAdapter runs frozen install/root build/original tests, removes build/tools, starts the exported output, persists receipt2 and assembles an immutable Docker archive. Selection and component verification recheck it. A synthetic-model Agent then proposes ActionSpec40 for that actual archive, awaiting the ordinary web approval. No provider write is performed. A fresh local Docker destination built only from those archive bytes serves the exact proof/assets; Chromium checks Vue rendering, reactivity73→81, navigation to `/orders`, and reload returning the original73. This is client state reset, not persistence evidence.

Negative runs preserve the same tests: a source quantity fault must fail its original test (76), and malformed SFC source must fail the real compiler (72), both without an artifact. The source fixture bytes remain unchanged by execution.


<a id="vue-compiled-component-validation-configuration-and-retained-failures"></a>

### Validation configuration and retained failures

Base2b6155df6fcd5be48d78b2fe164b8db101098fe0, isolated runtime-components worktree/branch. Runtime manifest `f5d9b1e0d7321e156e2a10b35719ff4c81a24379cd0d5297c149425b240f475a`. Heavy checks hold the shared FileShare.None OS lock and use independent state/TEMP/ports/owned Docker targets. Model/provider transports are synthetic; zero real model calls/cloud writes. No SQL/data-path code is changed.

An initial domain fixture had a manifest/lock mismatch and correctly failed before execution; the regression now reads the actual locked Vue fixture. An initial compiled case passed the compiler and Docker but failed its30s browser wait: the copied HTML had no Vue mount element. A preliminary120s-budget hypothesis was incorrect and is retained privately with the full failure. The fixture HTML now declares its mount element; the original budget and browser/worker timeouts are unchanged. A temporary explicit aggregate-budget setting was removed before final acceptance. Every retry uses a fresh disposable run, never renewal of an old allowance or retry of an uncertain cloud write.

The positive r4 case passed in80599ms with the original standalone budget. Tested source `794ec66e021b6d2fe84eb07f22074b814b4ede9b7d90513a9f5c550683396b5c`, plan `2e4714f6dc5eb8e4d93dc29676cce8557bfafc691d2957c88ee925ab1c9d303d`, compiled output `8a655fb13415a46dcf56f6b18dbb5eb196f7f093f29de70838d6afa391da7972`, archive `ec980f899bdcf70abed73dd01738f59f2f0d94f842402e747c30764c3a2177e1`. Receipt2 has5entries,82846raw bytes and45308compressed bytes. The Agent proposal binds that archive; local Docker proof, saved asset references and actual Chromium interactions passed. The suite retains at most64MiB of public metadata response bytes in memory across its independent jobs; each job validates every original lock timestamp/integrity and charges reads normally. No timestamp is invented or minimum-age policy disabled.

The final Vue suite passed3/3 in193021ms: positive80599ms, original-source-test rejection58448ms and compiler rejection52567ms, no skips. Focused domain8/8, lint and typecheck passed. A React compiler/archive/Docker/Chromium regression also passed on the same runtime (67549ms). An intermediate uncached run had two prereceipt failures in its negative cases (`afterTest` absent), so it was not counted as proof of those oracles; final cases require the actual76/72 receipts. The cause of those prereceipt failures was not independently captured. Additional whole-product results are appended after completion. Public commands: `node --test tests/domain/pnpm-component.test.ts` and `node --test --test-concurrency=1 tests/sandbox/pnpm-vue-component.test.ts`. The suite requires the pinned Linux Node image, public npm reads or exact own caches, and Chromium.

Remaining: raw Vue corpus/application acceptance, native Vue Liara publication, authenticated/public browser workloads, backend/data/persistence and the other missing families. The controlled fixture does not replace those obligations. Existing static/member limitations (CLI starts, SSR, topology and source repair) retain their typed behavior.

Full domain811/811 (285069ms) and production Webpack build passed on the same unchanged runtime. Lint had no errors (51warnings/28infos); typecheck passed. The graph was available but pointed to main's2026-10-21 generation with missing/not-tracked coverage for these symbols; exact worktree source/import/test fallback was used rather than interpreting missing graph symbols as absent functionality.

HTTP48/48 (20520ms) and the existing actual web/component worker/publication regression passed: run `00485ff3-d007-4577-a616-e252b94cc3e6`, archive `da15c31fbeaff8ddf246054094017114234c5d6ade3e1defe098e888c767b223`, ten review/success layouts280/320/390/768/1280 without overflow/axe violations/page errors, two409 replays and reload with unchanged usage/limits/model log. Its Node fixture verifies the shared web path; it is not a separate Vue browser-upload or native cloud case. The Vue test above uses the actual Vue worker/archive/Agent proposal and Chromium destination. The final sequential batch returned0 and released the shared lock. No runtime file changed through the matrix.
