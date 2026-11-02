# Exact compiled pnpm components — 2026-10-29

Scope: AC19/24/26/28/31/32. [ADR0047](../decisions/0047-exact-compiled-pnpm-components.md) describes the existing Agent/web build, artifact selection, approval and Docker publication path. This evidence is independent of the data lane. It introduces no resource provisioning authority, SQL, schema migration, private credential endpoint, model allowance renewal or real cloud write.

## Implemented path

The same `propose_project_build` accepts an explicit `componentRoot` and optional reviewed internal API port. Plan9 preserves the original root package manager, lock, importers and build. It runs the selected member's original tests, exports its installed production closure or static build directory, rejects remaining background processes, removes the disposable build/install/tool trees, materializes those exact bytes, starts them with a clean production environment and independently probes the original primary/API criteria. Shutdown and unchanged exported bytes are checked before export. Missing tests are disclosed; CLI starts and start hooks fail typed instead of being removed. Test-source mutation, skips, missing compiled entries, build-tree dependencies, background counterfeit servers and wrong APIs cannot produce an artifact. Executable workspace dependencies retain independent release obligations.

The existing CodeRepairJob/output store records receipt2. It preserves verified internal links/executable bits and original source/plan/file hashes. A deterministic Docker envelope and immutable archive use the exact output. The destination only materializes/checks those bytes and runs them as uid1000, without reinstall/recompilation. Actor/job/source/plan/output/archive and fixed host/Dockerfile checks are required at selection, destination creation and publication. An uploaded marker grants no authority. Destination creation checks local bytes; publication additionally requires the existing environment interface to match the build. This avoids waiting for a cloud environment before its app exists.

ActionSpec40 uses the existing Docker provider adapter, approval, claim, write journal and observation. The original primary criterion, exact proof, APIs and static JS/CSS hashes are fenced by current/READY release and app/environment identity. A successful component remains a partially completed whole-workspace mission. Original requirements remain in the profile. Versions1–28, existing data contracts and receipt1 remain readable; no SQLite migration or production dependency was added.

## Runtime and test configuration

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

## Registry investigation

Actual full metadata measured38,999,531 bytes for Vite; sixteen Linux-compatible package documents total53,820,267 bytes. The initial16MiB-per-document reader rejected Vite before build. A subsequent attempt preserved that rejection's cause but exposed pnpm11's supply-chain check of every lock entry, including non-Linux optional packages. Serving metadata only for downloaded Linux binaries correctly failed with a404 for the Android binding; no compiler/artifact pass was recorded.

The host now verifies metadata for all lock entries while downloading/serving only compatible tarballs. It requests gzip with a64MiB total wire budget, bounds each decompressed document at64MiB and total decoded work at384MiB, and retains at most64MiB of metadata for the worker. Only exact locked versions and their original publish timestamps survive into the worker registry. The frozen lock, SRI checks, minimum-release-age policy and timeouts are unchanged. Full JSON and gzip inputs, an oversized response and optional-platform metadata have explicit regressions. The [official npm metadata contract](https://github.com/npm/registry/blob/main/docs/responses/package-metadata.md) distinguishes full metadata with publish times from abbreviated installation metadata; a timestamp was not invented from `modified` or the latest tag.

## Validation ledger

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

## Preserved failures and boundaries

- Generated Dockerfile/payload detection initially rejected its source context. The generated filename is now explicitly captured and the opaque payload is injected by the existing archive service; the successful actor-owned job is still required.
- A development edit initially changed the wrong occurrence of the job-version condition. Self-review restored the data-runner condition exactly and extended only compiled-publication decoding. No data-runner contract change is intended.
- A first compiler harness used the standalone12-tool fixture allowance and stopped before execution. Its explicit160-read local fixture matches the Agent's normal aggregate allowance; no stored run/ledger was renewed and no actual model was called.
- The first browser overflow is traced to the existing runner select's intrinsic width; the scoped repair-card rule bounds it. Docker's pre-existing fallback badge incorrectly said Python and is corrected.
- Working-test receipts are evidence for their specific source/plan/image/output, never ledger, persistence, public-browser or complete application acceptance.

Factory feed source was reread: pnpm11.19.0, Node>=24, root `pnpm -r build`, API `node dist/main.js`, frontend Vite, and the unchanged root database wrapper. Its original PostgreSQL ledger/data tests were not replaced, disabled or run on the source corpus. Raw intake findings, data-dependent component tests, production binding/migration/persistence, multi-component topology, worker/scheduler effects, model source repair for plan9, compiled-component rollback and actual Liara publication remain UNCONFIRMED. Native PHP/Laravel/.NET/Go/Django/Flask and complete acceptance of all fourteen families remain open.
