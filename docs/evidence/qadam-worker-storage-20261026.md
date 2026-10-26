# Qadam — actual Worker build and isolated persistent data, 2026-10-26

This evidence concerns the source-to-artifact path and the new storage approval boundary. It does not mark the deployment corpus, AC28, AC31 or AC34 complete.

## Source, artifact and isolation

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

## Independent behavioral and persistence checks

The exact final archive was unpacked and started without rebuilding. Two serial isolated containers used the same new synthetic `/data` directory. The first was stopped and removed before the second started. Twenty-seven behavioral assertions passed across both processes: valid and invalid login, anonymous API rejection, secure session cookie, actual seeded catalogue synchronization, note write/read, stale generation rejection without overwrite, authenticated calendar token access, actual calendar response, invalid token rejection, private backend/descriptor/SQLite path rejection and logout. The new note survived complete container replacement.

Reset requests: 0. Original Cloudflare data reads/writes: 0. Model calls: 0. Cloud resource writes: 0. The synthetic database was 290,816 bytes after verification. Authentication values are retained only in private operator state and are not embedded in this document or the source archive.

## Storage policy checks

Seven domain tests passed for v25/v26: exact source and actor binding, separate approval, session binding, denial, expiry, idempotent proposal, single send, durable request-start ownership, recovery, lost response readback without replay, unavailable inventory, price/capacity/app identity drift before claim, and rejection of unknown/duplicate disk identity or invalid mount. A release with valid HTML/API/proof but `/wrong` storage remains `observing` with an `inconclusive / DISK_BINDING_CHANGED` observation; later correct `/data` readback can confirm it without another upload or release.

The first test runner attempt failed before assertions because a new constructor used TypeScript parameter properties unsupported by Node strip-only execution. The constructor now uses explicit fields. An initial test incorrectly expected the deployment state `uncertain` for an inconclusive read; the existing deployment contract retains `observing`. The corrected oracle explicitly requires inconclusive storage evidence, no success and no additional provider sends. No original workload criterion was weakened.

A bounded read-only Liara check observed plan volume 5 GB and Basic's maximum two disks. The selected existing non-financial app had no disks or reserved space. Reading `/v1/projects/<name>/disks` returned 404 while the same exact app's object-ID path returned `{disks:[],mounts:[]}`. These are account/endpoint shape observations, not permission to create, a new application quote or live disk acceptance. The mutation follows the official versioned CLI body `{name,size:"1"}` and release mount body `{name,mountTo:"/data"}`.

## Preserved failures and open boundaries

The first Qadam download failed after 419 complete packages; the cache cancellation ownership defect and retained stale lock are recorded separately in [the cache evidence](npm-cache-cancellation-20261026.md). Later failures after the fix left no lock. Two controller attempts failed on trusted runner packaging permissions before a job was created; fixing that packaging did not change project code. The first actual build job `115fc223-81f0-4369-a790-df9ec9efdce9` failed with `BUILD_DEPENDENCY_UNAVAILABLE`; the approved missing packages were completed and a new bounded offline job succeeded. Failed inputs and receipts remain private and retained.

An earlier full Launchlane domain run recorded 681/682 passing: the old Worker-without-assets fixture exposed an inspection error. The adapter now declines that unsupported shape so it remains inspectable and unpublishable, preserving the original oracle. Its focused scope/preparation/source-environment rerun passed 9/9. The complete subsequent domain run passed 689/689 in 201,257 ms with no skips; type generation and TypeScript checking also passed. Build and HTTP boundary checks are tracked separately.

The native Agent regression now verifies its own proposal → decision pause → one disk send → identity readback → original v26 publication proposal, with source-scoped tool availability and no optional-chat mutation. The follow-on queued cancellation/recovery regression keeps the original usage and revokes unused authority without a send. These model/provider transports are synthetic. The browser-only synthetic receipt test renders the real publication view and card at 280/320/360/414/768/1280 pixels, exercises keyboard rejection, expiry and uncertain readback controls, and records zero overflow, axe violations and page errors in those measured views. That UI fixture does not establish an actual backend decision or a cloud write.

The final browser rerun additionally measured hover/focus accessibility, keyboard approval and rejection, an unobscured focused control and 200% text. The final prescribed serialized domain run passed 691/691 in 217,604 ms, with zero skips. The production Webpack build and TypeScript generation/checking passed; lint reported zero errors, 48 warnings and 19 infos across the broader working tree. HTTP passed 46/46 with the new authenticated storage route and Agent decision boundary, using disposable state and synthetic/no provider credentials.

An intermediate full run was 690/691: an old resume oracle rejected an added null disk field in its historical host-state message before its synthetic model reservation. The host now appends disk state only when a run has it, preserving the old no-disk message. The original test was retained; its serialized disk/resume rerun passed 15/15 before the final 691/691 run. No timeout or workload criterion was changed.

One parallel targeted run failed to obtain the Agent publication proposal, while the earlier isolated run and the prescribed serialized rerun passed. The serialized disk/publication regression passed 18/18. The failure's cause is not established from that first assertion; the diagnostic now records final state, sanitized recent events and aggregate usage if it recurs. This targeted rerun does not erase that failure or substitute for the full final regression.

The user clarified that these projects are a capability test corpus for Launchlane, not a list of manual deployment jobs. The Qadam destination proposal is unapproved with zero attempts and zero infrastructure writes. It is not the next completion criterion. The active next boundary is the product's source-to-plan-to-execution loop across the corpus, including resource/dependency/runtime preparation and appropriate behavioral acceptance; see [the corpus contract](../deployment-corpus.md).

The related registry audit also found that Agent view decoding omitted Docker destination v22 even though the provider/application contract supported it. The decoder now uses the shared provision guard. A fresh test selects Docker from actual `liara.json`/Dockerfile bytes, invokes the real Agent destination tool and proposal service with synthetic account reads, and decodes its pending decision without a provider write. This closes that proposal/view gap; it does not prove a complete Docker publication or multi-service runtime.

## Selected change verification and review corrections

A plain export of the selected Git index, based on `5324b47`, separates this slice from unrelated hosted MCP/bootstrap work and private installation state. Its 573 tracked files were exported from Git blobs with a per-file SHA-256 manifest; known installed private values had zero matches. Existing pinned dependencies were linked locally, with no package download.

The first complete selected export (`34d480245cfa032f42bf35d4a9c5dcf87dda4e6b`) passed 690/690 domain and 40/40 HTTP cases, the production Webpack build and TypeScript checks. Real Chromium passed 54 guided publication states across five widths, 19 project-library states, and the storage card at six widths including keyboard approve/reject, focus, expiry, uncertain readback and enlarged text. Scoped source lint reported zero errors, 48 warnings and 19 infos. All provider/model transports in these checks were synthetic; they do not verify a public provider rollout.

Self-review then found another v22 omission: `finishObservation(...,"healthy")` could complete Docker destination creation using a generic receipt. Its new regression failed 9/10 before the fix. The method now uses `isProvisionSpec`, preserving the requirement for dedicated identity/configuration readback for every destination. Docker/provision/disk regressions passed 33/33, and the next immutable selected export (`32fdbf1eb8805d8d62a5c9a2c9d7800587a53715`) passed 691/691 domain cases in 198,553 ms.

Two additional review regressions initially passed 18/20: choosing another plan rejected an unexecuted Docker destination because of a separate old version list, and an uncertain disk reached the generic Store unresolved-effect guard rather than the mission's earlier reconciliation gate. The existing Store guard already prevented continuation; this was not evidence of a second send. The destination revision now uses the same provision guard, and mission continuation includes disk receipts before restoring or changing the run. The focused Docker/disk/destination/resume set then passed 29/29, preserving usage, limits, consumed attempts and the original workload oracle. No timeout was increased.

The final selected runtime snapshot (`a8ed104424af62b9f9e9eb22478f3731516266b4`) passed 692/692 domain cases in 200,249 ms and 40/40 HTTP cases in 6,871 ms, with no skips. Type generation/checking and `npm run build -- --webpack` passed. Scoped lint again reported zero errors, 48 warnings and 19 infos. The storage browser rerun on this build passed all six measured widths with zero overflow, axe violations or page errors and the same keyboard/focus/expiry/readback checks. The earlier guided/library results apply to their recorded snapshot; they are not relabeled as a fresh whole-browser pass. Only this evidence text and the surgical TASKS status were appended after the final runtime snapshot; runtime, tests, dependencies and UI blobs remained identical.

Still UNCONFIRMED: a public Qadam destination/release, actual Liara disk creation/mount/restart persistence, public auth/business/browser behavior, hosted Agent disk decisions and MCP goal completion. The production Launchlane image was not updated. Any eventual live capability test needs its exact resource decision; retention follows the user's later instruction to keep destinations until they explicitly request deletion.
