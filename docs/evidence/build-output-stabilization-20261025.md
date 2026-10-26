# Durable build output and bounded workers — 2026-10-25

Scope: AC23/AC26 and the first missing boundary of composite preparation. The owner requested technical fixes without appearance changes, staging, commits or pushes. HEAD remains `6937dfc9a6be4f53a134b55175a53d22512dcf29`; this is uncommitted source.

## Observed defects and changes

- Frontend validation previously stopped and removed its container before output could leave its tmpfs. The v5 frontend runner now keeps PID 1 alive, runs the unchanged install/build/workload program through stdin/exec, exports validated bytes, then removes only its full container ID. Other Node and Python runtime plans retain their existing execution semantics.
- Successful frontend job receipts now include a content-addressed output receipt binding the exact source hash and build-plan hash. The private output envelope is flushed, published without overwrite and independently read back before success. A fresh service instance can recover it. Missing, tampered, linked, oversized and incorrectly bound output fails closed. Existing historical receipts remain readable.
- Concurrent output publication originally raced both temporary-file enumeration and the last available storage slot. The new store serializes quota checking and publication per state directory. Its limits are 32 outputs / 128 MiB; it does not evict another job's data.
- Each build may reserve 2 GiB. A shared bounded FIFO now serializes dependency acquisition and container execution across adapter instances. Aborted/expired waiters do not execute project code; parent authority is checked again after waiting. The installation still assumes one owning server process, as its SQLite/runtime contract already requires.
- An incomplete Docker create reply previously lost the identity needed for cleanup. Node tests, Node/frontend builds and Python builds now reconcile only their unique name, exact pinned image and ownership label. A matching full ID is journaled before cleanup; unknown/replacement identities are not deleted. A lost response never starts or recreates a worker.

No schema migration, dependency installation, model allowance, infrastructure credential, original Torob source, catalogue or usage database was changed.

## Evidence and failure history

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

## Remaining acceptance boundaries

Public rollout used the existing hosting authority and resources. Active image: `sha256:a547236ef28225af76ba331086a371922bcd77b157f87267e6e44494c38c3061`; Build ID `6zRBRP24QoZ463cVmnGDS`. The prior `8ed153b5b1c0` image remains available for an image-only rollback. At 2026-10-25 06:03:27 UTC, all rows of 28 state tables and five ledger tables matched consistent pre-rollout SQLite backups; both quick checks were `ok`. The same persistent mount, runtime configuration and proxy image were preserved. Production had no test hook, zero restarts and no OOM.

The same public origin returned root/health200, anonymous workspace/MCP401 and all11 assets successfully. All four served CSS/font entries were byte-identical before/after. Remaining model credit stayed USD0.20; no model requests, new paid resources, allowance renewal or data reset occurred. No staging/commit/push was performed.

The durable generated output is attached to the tested job. It is **not yet the final composite publication artifact**: native frontend publication still follows its existing source/build contract. This slice does not establish byte-identical composite publication, persistent resource provisioning/import, a complete Torob deployment, all 14 official families, or executable Claude/OpenCode connectors. Framework detection, successful local compilation, HTTP 200 and provider READY remain insufficient for those claims.

The original Torob repository was read only: current HEAD was `2dffbde19d612e3935509d278aa2664cfed516db`, with no tracked/untracked changes reported. It supersedes older handoff revisions for subsequent investigation; it was not reset, prepared or deployed outside the product.

Next boundary: bind the durable frontend output into a reviewed composite artifact and typed resource/data plan, then verify the exact current Torob UI → API → database → response and persistence. Native families and actual MCP hosts/repair connectors remain independent acceptance obligations. No technical 10/10 or full-matrix pass is asserted.
