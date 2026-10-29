# Pnpm workspace execution — 2026-10-29

Scope: path B, isolated managed worktree, base fc01252d8531da66a9ca0cb4633e53a55b692f22. The original main checkout, data-path services, original corpus repositories and running installation are not modified. No real model request, allowance renewal, provider write or production SQL is performed.

The existing project intake exposes source-bound package/workspace metadata. propose_project_build creates ProjectBuildPlan8 in the same web/Agent/MCP registry and CodeRepairJob. Its ordinary review decision controls execution. Unsupported native npm publication of a pnpm artifact is explicitly blocked. Historical build1–7 and data contracts are retained.

## Measured local evidence

- Factory feed source was reread: packageManager pnpm11.19.0, root Node>=24, packages apps/api, apps/web and packages/contracts, internal workspace:* links, original root recursive build and database-wrapped root tests. Exact manifest/lock hashes are in the private receipt; no original script or data operation was run for this source-only check.
- Full read-only intake of Factory feed revision e50fb16328df8dd1fccee24643c89a88d1b22615 stopped with SENSITIVE_SOURCE (56 candidate paths, first .github/workflows/ci.yml). The findings have not been classified or exempted. No Vite/Nest build, original test or ledger run occurred for that corpus. Manifest-only discovery identified four packages and 365 Linux-compatible deduplicated tarballs including the manager; that read is not full-source acceptance.
- Domain regressions exercise correct root/importers/links/Node selection, changed pins, conflicting locks, wrong links/specifiers/importers, unsupported settings, YAML aliases, foreign registries and Agent proposal before a cloud destination.
- The real pinned Node24/Docker worker installs actual pnpm11.19.0, preserves the source lock, builds linked packages and, in runtime mode, executes original Node tests/start and an independently checked JSON response. The controlled package tarball and its registry metadata are synthetic fixtures with checked SRI; pnpm and the worker are real. This is not Vite/Nest compiler acceptance for Factory feed or model-quality evidence.
- Six sequential actual worker scenarios passed in 98.059s on the r3 worker source: compile-only success, original tests/start/JSON success, original test failure, wrong JSON workload, a dependency newer than pnpm's release-age threshold, and a skipped original test. All four negative cases kept the source and produced no artifact. The test input pinned tool archive was an explicit worktree-local file revalidated by the normal SRI downloader, never the primary installation's state.
- Compile mode explicitly produces no publication artifact. Runtime mode produces the same tested source archive through the existing service; compiled byte export/publication is still an open boundary.

Tests use disposable state and exclusive FileShare.None ownership of the shared heavy-command lock. Test ports are allocated independently; port3000 and the primary installation are untouched. The branch is runtime-components, without the codex prefix, at the owner's explicit request.

The r10 runtime snapshot (07208aa0599f92e698d59247f75aa28889fe07524b3c992cf449943aed1a8562) passed domain790/790, HTTP48/48, guided54 states, pnpm review in six widths, the actual web-to-worker flow in five widths and thirteen actual container scenarios (seven pnpm, three native Node, three existing fullstack). r11 corrects v8 persisted usage parsing: 513–4096 checked dependency reads remain readable, while 4097 is rejected. Actual execution still uses the parent's stored allowance; no limit or receipt is renewed. Final rerun results and the r12 error-preservation delta follow below.

## Final candidate checks

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

## Preserved failures

1. The first domain harness queried nonexistent action_attempts; the proper persisted actions table is now asserted. This was a harness error after a valid proposal, not a product pass.
2. First actual pnpm execution failed with ERR_PNPM_FETCH_404 during its supply-chain verification because the private worker registry served tarballs without metadata. The original failure is retained privately. The implementation now verifies official package metadata name, version, tarball integrity and release time; the policy was not disabled.
3. Typecheck caught an unknown tar-stream chunk in the fixture and a nonexistent job.usage assertion. The fixture now narrows actual Buffer bytes; the invalid assertion was removed.
4. Web harness attempts r4–r7 reached actual worker success but failed their own hidden/duplicate/screen-reader text or terminal-state wait. These were not browser passes. The final harness polls the actual authenticated run endpoint until terminal, opens the existing disclosures and checks visible text plus the independent stored receipt. It does not intercept the decision/job/receipt.
5. Web attempt r8 timed out fetching the pinned public tool before container execution. It is retained as a preparation failure. The reproducible test accepts an explicit worktree-local tool tarball, puts it through the existing disposable integrity-checked cache and normal worker path, and does not borrow the primary installation's cache.
6. A Docker source declaring pnpm10 originally entered the native pnpm11 validator. Its regression failed with PNPM_VERSION_UNSUPPORTED. Explicit Docker routing now retains the image-owned package manager and the existing Docker plan6; native pnpm checks cannot override it.
7. A persisted v8 receipt with usage513 originally failed INVALID_INPUT on status/reload. The focused regression reproduces that failure, then verifies reading the unchanged receipt and the existing maximum4096, rejecting4097. Historical non-build and build1–7 parsing bounds remain unchanged.
8. The r11 web rerun failed before receiving a container identity, with SANDBOX_CLEANUP_UNCONFIRMED and no test receipt. It is not a worker pass. Subsequent locked Docker version/label-filtered container readback found the Linux daemon healthy and no locked-build-v1 containers; no uncertain resource was removed or creation blindly replayed. The original cause remains unconfirmed. The parent now preserves the underlying code instead of substituting PNPM_COMPILE_INCOMPLETE. A separate fresh disposable r12 web case passed after this readback.

## Open boundaries

Native provider pnpm execution, exact compiled workspace artifact publication, independent per-component release topology, production data binding/migration/connectivity/persistence, background consumer/scheduler effect checks and fresh public browser workloads remain UNCONFIRMED. Existing source-only requirements and publication gates continue to require those effects. Source complexity, a local build or a synthetic provider cannot close the complete-product acceptance criteria.
