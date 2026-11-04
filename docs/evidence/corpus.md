# Corpus — verification evidence

[Documentation](../README.md) · [Current support](../platform-support.md) · [Verification index](../verification.md)

These versioned records preserve the original decisions, source revisions, failures and evidence limits. Dates and passing counts apply only to the named snapshot, not the current release. Installation-specific locations and identities are omitted.

## Records

- [Qadam — actual Worker build and isolated persistent data, 2026-10-26](#qadam-worker-storage-20261026)
- [Zarinpal: tested source, temporary native publication and verified deletion](#zarinpal-temporary-publication-20261026)

<a id="qadam-worker-storage-20261026"></a>

## Qadam — actual Worker build and isolated persistent data, 2026-10-26

This evidence concerns the source-to-artifact path and the new storage approval boundary. It does not mark the deployment corpus, AC28, AC31 or AC34 complete.


<a id="qadam-worker-storage-20261026-source-artifact-and-isolation"></a>

### Source, artifact and isolation

The original Qadam revision was `f2edec6970a18eb5519b11bf6155aee450a83b4f`; source capture was `f3d762ae3031a226d81d5dd847684b8d6b90d2f3e8309ad74e6d0c716e4c8710` (98 files, 1,209,422 bytes). No original source or database was modified, read as runtime data, imported or reset. Docker Desktop was not started. Bounded Linux jobs ran serially on the existing VPS, independently of the unchanged production Launchlane container.

The product's actual CodeRepairAdapter job `86dc1470-cd1a-4939-a5ab-aec5ac066613` used the pinned Node 24.18.0 image, a non-root read-only source mount, no container network and new synthetic private environment inputs. It used zero model calls. The existing npm lock selected 431 integrity-verified Linux packages (97,042,588 downloaded bytes); only missing official npm tarballs were read. The successful offline job installed 428 packages, built both Vite output and the compiled Hono Worker, ran the original unchanged Vitest suite and started the actual Node server.

| Identity | SHA-256 / result |
| --- | --- |
| Tested prepared source | `31ee7fdd6ab267cdbe70af1092490a960634239674682817c323927bd3e4466b` |
| Build plan | `ecbac1d1895b1967846c9a8f73603421bff7c74157d9f9a7f28ce85b99dacf85` |
| Compiled output artifact | `6aac1e6853c1e0e89e210fe5f22c334107f3c1d48eefbc586daaec8f302ccb98` |
| Final publication archive | `3d84deb66186fa8e0e8ae9bf67d8147d6078c490df2caf952e256e469bd11542` |
| Final source hash | `c98f2ebd7d801967ae85b0f9cc0661e2b371ab373487f05a70f211e579cb74a4` |
| Final archive | 124 files, 726,942 bytes |

The job passed 19 test files / 193 tests. Vite built 79 modules in 11.01 seconds; unchanged test execution took 21.69 seconds. The build/start verification took 84,228 ms, and the whole job took 145,795 ms. Root HTML, same-origin compiled assets, nine migrations and independent configuration/API assertions passed. Vite's bundle-size warning and npm's deferred-script/deprecation warnings remain in the receipt; they were not suppressed or counted as failures.


<a id="qadam-worker-storage-20261026-independent-behavioral-and-persistence-checks"></a>

### Independent behavioral and persistence checks

The exact final archive was unpacked and started without rebuilding. Two serial isolated containers used the same new synthetic `/data` directory. The first was stopped and removed before the second started. Twenty-seven behavioral assertions passed across both processes: valid and invalid login, anonymous API rejection, secure session cookie, actual seeded catalogue synchronization, note write/read, stale generation rejection without overwrite, authenticated calendar token access, actual calendar response, invalid token rejection, private backend/descriptor/SQLite path rejection and logout. The new note survived complete container replacement.

Reset requests: 0. Original Cloudflare data reads/writes: 0. Model calls: 0. Cloud resource writes: 0. The synthetic database was 290,816 bytes after verification. Authentication values are retained only in private operator state and are not embedded in this document or the source archive.


<a id="qadam-worker-storage-20261026-storage-policy-checks"></a>

### Storage policy checks

Seven domain tests passed for v25/v26: exact source and actor binding, separate approval, session binding, denial, expiry, idempotent proposal, single send, durable request-start ownership, recovery, lost response readback without replay, unavailable inventory, price/capacity/app identity drift before claim, and rejection of unknown/duplicate disk identity or invalid mount. A release with valid HTML/API/proof but `/wrong` storage remains `observing` with an `inconclusive / DISK_BINDING_CHANGED` observation; later correct `/data` readback can confirm it without another upload or release.

The first test runner attempt failed before assertions because a new constructor used TypeScript parameter properties unsupported by Node strip-only execution. The constructor now uses explicit fields. An initial test incorrectly expected the deployment state `uncertain` for an inconclusive read; the existing deployment contract retains `observing`. The corrected oracle explicitly requires inconclusive storage evidence, no success and no additional provider sends. No original workload criterion was weakened.

A bounded read-only Liara check observed plan volume 5 GB and Basic's maximum two disks. The selected existing non-financial app had no disks or reserved space. Reading `/v1/projects/<name>/disks` returned 404 while the same exact app's object-ID path returned `{disks:[],mounts:[]}`. These are account/endpoint shape observations, not permission to create, a new application quote or live disk acceptance. The mutation follows the official versioned CLI body `{name,size:"1"}` and release mount body `{name,mountTo:"/data"}`.


<a id="qadam-worker-storage-20261026-preserved-failures-and-open-boundaries"></a>

### Preserved failures and open boundaries

The first Qadam download failed after 419 complete packages; the cache cancellation ownership defect and retained stale lock are recorded separately in [the cache evidence](runtime.md#npm-cache-cancellation-20261026). Later failures after the fix left no lock. Two controller attempts failed on trusted runner packaging permissions before a job was created; fixing that packaging did not change project code. The first actual build job `115fc223-81f0-4369-a790-df9ec9efdce9` failed with `BUILD_DEPENDENCY_UNAVAILABLE`; the approved missing packages were completed and a new bounded offline job succeeded. Failed inputs and receipts remain private and retained.

An earlier full Launchlane domain run recorded 681/682 passing: the old Worker-without-assets fixture exposed an inspection error. The adapter now declines that unsupported shape so it remains inspectable and unpublishable, preserving the original oracle. Its focused scope/preparation/source-environment rerun passed 9/9. The complete subsequent domain run passed 689/689 in 201,257 ms with no skips; type generation and TypeScript checking also passed. Build and HTTP boundary checks are tracked separately.

The native Agent regression now verifies its own proposal → decision pause → one disk send → identity readback → original v26 publication proposal, with source-scoped tool availability and no optional-chat mutation. The follow-on queued cancellation/recovery regression keeps the original usage and revokes unused authority without a send. These model/provider transports are synthetic. The browser-only synthetic receipt test renders the real publication view and card at 280/320/360/414/768/1280 pixels, exercises keyboard rejection, expiry and uncertain readback controls, and records zero overflow, axe violations and page errors in those measured views. That UI fixture does not establish an actual backend decision or a cloud write.

The final browser rerun additionally measured hover/focus accessibility, keyboard approval and rejection, an unobscured focused control and 200% text. The final prescribed serialized domain run passed 691/691 in 217,604 ms, with zero skips. The production Webpack build and TypeScript generation/checking passed; lint reported zero errors, 48 warnings and 19 infos across the broader working tree. HTTP passed 46/46 with the new authenticated storage route and Agent decision boundary, using disposable state and synthetic/no provider credentials.

An intermediate full run was 690/691: an old resume oracle rejected an added null disk field in its historical host-state message before its synthetic model reservation. The host now appends disk state only when a run has it, preserving the old no-disk message. The original test was retained; its serialized disk/resume rerun passed 15/15 before the final 691/691 run. No timeout or workload criterion was changed.

One parallel targeted run failed to obtain the Agent publication proposal, while the earlier isolated run and the prescribed serialized rerun passed. The serialized disk/publication regression passed 18/18. The failure's cause is not established from that first assertion; the diagnostic now records final state, sanitized recent events and aggregate usage if it recurs. This targeted rerun does not erase that failure or substitute for the full final regression.

The user clarified that these projects are a capability test corpus for Launchlane, not a list of manual deployment jobs. The Qadam destination proposal is unapproved with zero attempts and zero infrastructure writes. It is not the next completion criterion. The active next boundary is the product's source-to-plan-to-execution loop across the corpus, including resource/dependency/runtime preparation and appropriate behavioral acceptance; see [the corpus contract](../deployment-corpus.md).

The related registry audit also found that Agent view decoding omitted Docker destination v22 even though the provider/application contract supported it. The decoder now uses the shared provision guard. A fresh test selects Docker from actual `liara.json`/Dockerfile bytes, invokes the real Agent destination tool and proposal service with synthetic account reads, and decodes its pending decision without a provider write. This closes that proposal/view gap; it does not prove a complete Docker publication or multi-service runtime.


<a id="qadam-worker-storage-20261026-selected-change-verification-and-review-corrections"></a>

### Selected change verification and review corrections

A plain export of the selected Git index, based on `5324b47`, separates this slice from unrelated hosted MCP/bootstrap work and private installation state. Its 573 tracked files were exported from Git blobs with a per-file SHA-256 manifest; known installed private values had zero matches. Existing pinned dependencies were linked locally, with no package download.

The first complete selected export (`34d480245cfa032f42bf35d4a9c5dcf87dda4e6b`) passed 690/690 domain and 40/40 HTTP cases, the production Webpack build and TypeScript checks. Real Chromium passed 54 guided publication states across five widths, 19 project-library states, and the storage card at six widths including keyboard approve/reject, focus, expiry, uncertain readback and enlarged text. Scoped source lint reported zero errors, 48 warnings and 19 infos. All provider/model transports in these checks were synthetic; they do not verify a public provider rollout.

Self-review then found another v22 omission: `finishObservation(...,"healthy")` could complete Docker destination creation using a generic receipt. Its new regression failed 9/10 before the fix. The method now uses `isProvisionSpec`, preserving the requirement for dedicated identity/configuration readback for every destination. Docker/provision/disk regressions passed 33/33, and the next immutable selected export (`32fdbf1eb8805d8d62a5c9a2c9d7800587a53715`) passed 691/691 domain cases in 198,553 ms.

Two additional review regressions initially passed 18/20: choosing another plan rejected an unexecuted Docker destination because of a separate old version list, and an uncertain disk reached the generic Store unresolved-effect guard rather than the mission's earlier reconciliation gate. The existing Store guard already prevented continuation; this was not evidence of a second send. The destination revision now uses the same provision guard, and mission continuation includes disk receipts before restoring or changing the run. The focused Docker/disk/destination/resume set then passed 29/29, preserving usage, limits, consumed attempts and the original workload oracle. No timeout was increased.

The final selected runtime snapshot (`a8ed104424af62b9f9e9eb22478f3731516266b4`) passed 692/692 domain cases in 200,249 ms and 40/40 HTTP cases in 6,871 ms, with no skips. Type generation/checking and `npm run build -- --webpack` passed. Scoped lint again reported zero errors, 48 warnings and 19 infos. The storage browser rerun on this build passed all six measured widths with zero overflow, axe violations or page errors and the same keyboard/focus/expiry/readback checks. The earlier guided/library results apply to their recorded snapshot; they are not relabeled as a fresh whole-browser pass. Only this evidence text and the surgical TASKS status were appended after the final runtime snapshot; runtime, tests, dependencies and UI blobs remained identical.

Still UNCONFIRMED: a public Qadam destination/release, actual Liara disk creation/mount/restart persistence, public auth/business/browser behavior, hosted Agent disk decisions and MCP goal completion. The production Launchlane image was not updated. Any eventual live capability test needs its exact resource decision; retention follows the user's later instruction to keep destinations until they explicitly request deletion.

<a id="zarinpal-temporary-publication-20261026"></a>

## Zarinpal: tested source, temporary native publication and verified deletion

Date: 2026-10-26. Scope: A07/A08/A11/A14 and AC19/AC26/AC27. This is bounded evidence for one real Next application. It does not complete the eight-project mission, general fullstack publication or the public Launchlane UI rollout.


<a id="zarinpal-temporary-publication-20261026-source-and-executable-artifact"></a>

### Source and executable artifact

The original `challenge-1-zarinpal` repository remained at `f11511c88cf07f46b929c6c56f6d2e1feba0bd44`. Launchlane captured 165 files / 5,683,899 bytes with source hash `a6823489515ffbba1854559c563ea5aee093f03a127614d9e109ccfd1de6eba7`. It uses Next 16.3.1 / React 19.2.8, local fonts and immutable analysis JSON files. There is no online application database or application worker in this tested source.

CodeRepair job `66a2f689-0f40-468c-9917-e7b18b1036a9` used the existing bounded Linux Node22 worker, reviewed source commands, locked dependencies and the unchanged root oracle: HTTP 200 containing `مرکز اقدام`. Its successful run installed 604 packages, compiled Next, checked TypeScript, generated seven pages, started the actual application and returned 241,346 bytes of matching HTML. The after-test receipt passed with exit 0 in 145,607 ms; the complete job took 190,084 ms. No model request was used.

The persisted, Linux-tested **source** archive is 673,633 bytes / 165 files with SHA-256 `0d33c79586a6369eafa9e009c8e1b060900e8e7ea7f87c34a21d699f85071360`. Native Liara builds that source again. This evidence does not assert byte-identical compiled `.next` output between the worker and Liara.

Failures remain evidence: an earlier worker was OOM-killed after install; another controller was cancelled during metadata acquisition; a later run compiled but reached its 110-second TypeScript deadline; another completed compile/start but exceeded the old 64-KiB HTML probe limit. None of these failed runs exported a passing artifact. Their causes are not all attributed to memory or concurrency.


<a id="zarinpal-temporary-publication-20261026-shared-product-fixes-exercised"></a>

### Shared product fixes exercised

- Exact-version official npm platform metadata is persisted in a private bounded sibling cache. Lock identity/integrity checks, immutable entries, quota and locking remain enforced. A later worker reused the verified dependency inputs without a new download. See the [dependency checkpoint](runtime.md#locked-native-dependencies-20261026).
- The Node worker removes only its ephemeral npm cache after install, before compilation. Measured tmpfs use fell by 129,294,336 bytes. Build-command, host-test and container lifetime bounds were coordinated without renewing the parent run deadline or model allowance.
- JSON under a `public/` or `data/` directory and SVG assets can use the 16-MiB asset bound. Root/code JSON limits stay at 4 MiB, configuration limits at 512 KiB and total capture limits stay enforced. Upload, capture and immutable archive round trips retain the original bytes.
- The independent Next text/HTML oracle permits up to 1 MiB with an HTML content type. The small generic probe and file fingerprint limits remain separate. This preserves the original content assertion instead of declaring a large successful page unhealthy.
- New Next inspection follows Liara's documented package mirror default when the project omits the setting. Explicit `false` and historical ActionSpec v17 serialization remain unchanged. The first real native attempt timed out at `npm ci`; the subsequent mirror-enabled attempt became READY. Build logs confirmed mirror use. This sequence supports the bounded correction, not a general claim that every build timeout is caused by mirror settings. [Official Next deployment documentation](https://docs.liara.ir/paas/nextjs/how-tos/deploy-app/).
- Decimal-string commit timestamps observed in real Liara release responses preserve their raw value and unknown unit, while exact release identity remains usable. Malformed timestamps still fail closed.
- A shared `read_build_logs` Agent/MCP tool reads sanitized, bounded build evidence after proving the requested release belongs to the selected application's latest fifty releases. Its global provider endpoint is based on the [official CLI implementation](https://github.com/liara-cloud/cli/blob/v9.6.0/src/services/build-logs.ts). Membership reads, log reads and identity fences spend the same existing run budget. Provider log text never authorizes a write; a returned page is not complete build history.
- ActionSpec v24 adds explicit approved start and default-domain activation, with current identity, price, scope, expiry and durable journal/readback. A public-domain setting can be bound to the exact observing READY/current publication. Stop/delete retain historical v14 canonicalization.

The source and product changes were exercised through actual application services, Store, approvals, adapters and journals in an isolated operator state. The credential was encrypted under that installation's separate key, outside source and worker mounts. Scripts called the product services; they did not substitute direct cloud writes for them. Model access was disabled. This is not acceptance of a fresh public-web Agent turn, a new model allowance or the unchanged public Launchlane runtime.


<a id="zarinpal-temporary-publication-20261026-actual-provider-and-public-sequence"></a>

### Actual provider and public sequence

All times below are UTC. The human explicitly changed the plan to a temporary test followed by complete deletion. A second, specific decision covered exactly one new named destination, the reviewed small-g2/basic plan, the same artifact and deletion after testing. No database, disk, larger plan or model allowance was created.

| Time | Observed result |
| --- | --- |
| 13:22 | The original app's first native release failed after a build timeout at install. Product observation recorded release failure. |
| 13:42 | A separately approved mirror-enabled release on that app was READY/current. Public workload still failed with 503. |
| 13:57 | The original app reported `defaultSubdomain=false`, `defaultSubdomainExpired=true`. This is configuration evidence; it does not prove the sole cause of its 503. |
| 14:06:06 | The original `nabz-zarinpal` app, ID `<resource-id>`, was deleted and independently absent. |
| 14:14:41 | Approved creation of `launchlane-zarinpal-check-1026` succeeded with identity/configuration readback: ID `<resource-id>`. |
| 14:14:56 | Publication action `60a84d79-d622-42f0-8afc-0af839a29298` requested release `<resource-id>` from the exact tested archive. |
| 14:18:29–37 | This release was READY/current, but the public root returned 503. The product kept the workload pending. The startup/routing cause remains unconfirmed. |
| 14:26:34 | Independent public root read returned 200 and the original marker; fresh app metadata reported scale 1, default domain enabled and not expired. |
| 14:27:05 | Product `observeDeployment` recorded `succeeded / WORKLOAD_VERIFIED` for that exact release, HTTP 200. |
| 14:27–30 | Actual Chromium read the four application pages, public source-data fingerprints were checked and the temporary link was delivered in chat. |
| 14:30:55–57 | Approved product stop and delete passed readback. Independent account metadata returned 404/null for the exact created destination. A consistent SQLite backup followed cleanup. |

The quote at approval was 1041.66 toman/hour, excluding tax/traffic. No final invoice was read, so actual billed cost is unknown. The temporary URL was `<deployment-origin>`; **it was deleted and is not an active delivery link**.

The old expired-domain request had an uncertain response. No blind replay was made. Product guards now prevent activation when expiry is true or unknown. Explicit compensating stop/delete may pass only the same actor/target/source/flow/plan's uncertain domain-setting action. Unknown publication/environment writes and active writes still block. After independently verified deletion, the superseded setting becomes cancelled with `DESTINATION_REMOVED`; its journal and attempt remain preserved. This does not turn an uncertain request into a successful one.


<a id="zarinpal-temporary-publication-20261026-browser-and-data-evidence"></a>

### Browser and data evidence

A fresh Chromium context allowed only GET/HEAD to the approved public origin. These were actual workload reads, not synthetic provider responses:

- `/`, `/customers`, `/opportunities` and `/recovery`: HTTP 200, expected Persian headings and real analysis content, without the application's report-load error.
- Actual keyboard navigation in the customer selector focused option M1, changed the URL selection to M1 and retained it after reload.
- No page errors, blocked external requests or same-origin responses >=400 were recorded in the passing browser run.
- Desktop and 390-pixel mobile screenshots were captured and inspected. The root had no measured mobile horizontal overflow. This is viewport evidence, not a physical-device test or a complete accessibility audit.

| Public file | Bytes | SHA-256, matching captured source |
| --- | ---: | --- |
| `/analysis/action-center.json` | 138,099 | `92e36ee7f9e20f1a41862ca4a5997e12702e79e4e5f734df828a8e9122c194fb` |
| `/analysis/customer-growth.json` | 3,949,893 | `42b67cf0a417b8de8c163c9c008c341e019b0e434fe3201e15a7032366726e35` |
| `/analysis/peer-opportunities.json` | 43,548 | `8750cfa743da644b755e905ce4bb10c74d41821804d4dec611c1d5bd398e75ce` |
| `/analysis/conversion-recovery.json` | 88,402 | `1750f6e8ed75b14c80cf1f311a82fe53a2cc5fe6f96cc4dbb5174629b485b938` |

The first browser harness incorrectly refocused the trigger for each key and timed out without changing the merchant. Its failed receipt/trace were retained. A second full harness timed out re-reading a large asset before opening the browser. The final browser run sent keys to the actual open listbox and passed the original M1/reload expectation; it reused the already measured file-fingerprint evidence rather than relabeling either failure as a pass.

Private evidence is under `<private-validation>`, the corresponding controller logs under `.local/hosting-launchlane-20261023/continuation-zarinpal-*`, and Chromium traces/results under `output/playwright/continuation-zarinpal-20261026/`. These are excluded local artifacts, not source archives or credentials committed to Git.


<a id="zarinpal-temporary-publication-20261026-limits-and-next-boundary"></a>

### Limits and next boundary

Validation checkpoint after the bounded provider fixes: domain 667/667 (179,806 ms), HTTP 45/45 (16,756 ms), typecheck and production build passed. Lint had zero errors, 46 warnings and 17 informational diagnostics. The project-library Chromium suite initially passed 17 states, with model requests0 and one synthetic environment write. The live public browser/provider receipts above remain distinct from these synthetic suites.

An independent HEAD-plus-staged build-log snapshot passed 21 tests and typecheck. The next native-build snapshot initially passed 67/68: the old preparation-registry test still hardcoded a 16-definition limit after the shared model client moved to its explicit definition-count constant. That test now checks the actual client constant and still calls the real client with both preparation alternatives; request/execution budgets are unchanged. The same 68 tests and typecheck then passed. Broad uncommitted Docker/fullstack/MCP work was left outside those selected commits.

The lifecycle snapshot passed 56 related domain tests and typecheck. Its external dependency junction on C: prevented both Turbopack and Webpack from resolving packages on I:; those packaging failures were preserved. The same staged source was then materialized on I:, built successfully with the installed Webpack mode and passed 19 actual Chromium project-library states. Default Turbopack build on the working source also passed; this is not a claim that the C: packaging failure itself passed.

The extra two browser states reproduce an uncertain domain-setting response and verify a new explicit stop confirmation through the UI. The first added assertion read the action before the asynchronous decision finished; waiting for the existing uncertain status fixed that harness race. The next run exposed the actual missing cleanup control. The UI now offers a separately approved stop only for that uncertain domain action. Successful activation remains an independent earlier oracle; after delete, the uncertain action is cancelled with its original attempt retained. The 19-state suite passed both on the working build and the independent staged build, with zero page errors/external requests and axe0 in the measured layouts. These are synthetic provider cases, not a second live cloud cycle.

Final selected-code checkpoint: source revision `38f2d99` after the four topical commits starting at `113573c`. The independent staged snapshot's runtime/test sources match that revision; later documentation edits do not change its execution. Its **complete tracked domain suite passed 501/501** (133,255 ms), its HTTP suite passed **39/39** (6,431 ms), and its actual project-library browser suite passed **19 states**. It also passed typecheck and the same-volume Webpack build. These counts exclude the separate pre-existing uncommitted fullstack/MCP files; they are not substituted for the working tree's 667-domain / 45-HTTP checkpoint. Final working-tree typecheck and default production build passed after the UI recovery change; lint remained zero errors / 46 warnings / 18 informational diagnostics.

At **15:11:39 UTC**, a fresh read-only account/team identity check and both project lookups again confirmed 404/null for `nabz-zarinpal` and `launchlane-zarinpal-check-1026`. No cleanup mutation was replayed. Private log: `final-removal-readback.json`. A failed first readback helper used the wrong local property for the expected account ID; the provider scope guard rejected it before project reads. The helper was corrected to the connection's validated identity and the account client’s void identity-check contract. This was a diagnostic-helper error, not a change to the owner/account or a failed deletion.

This source persists its published analysis files, not a live DB. Browser reload verifies merchant query selection and server rendering; restart durability, database writes, online payment-provider integration and a financial transaction were not tested or claimed. Cleanup was intentional and authorized. The public Launchlane image remained `a547236ef28225af76ba331086a371922bcd77b157f87267e6e44494c38c3061`, healthy, zero restarts and not OOM-killed; it was not replaced by this work.

The other seven projects remain separate acceptance work. Several imports are stopped by source-safety findings that need exact syntax/fixture review; D1, Supabase, PostgreSQL/Redis/Celery and WordPress/MariaDB topologies cannot be replaced with an unrelated database merely to show a frontend. No paid destination or model allowance for them is inferred from this temporary Zarinpal decision.
