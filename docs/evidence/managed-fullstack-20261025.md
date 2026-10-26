# Managed fullstack continuation — 2026-10-25

Working-tree implementation on `main`, base HEAD `6937dfc9a6be4f53a134b55175a53d22512dcf29`. The owner requested no commits, staging, push or visual changes. This report separates source inspection, controlled execution, synthetic provider behavior and public acceptance.

## Real Golestan source intake

The original `F:\University\Golestoon\golestan-web` was inspected read-only at `f0d4f4499e7cf605bb2a2e33e530c4c6dcf237ed`; its Git status remained clean. Product capture retained 419 files / 12,185,491 bytes with source hash `be6f5839db84081ecc1fc2633f5f2722d858329b1e52c8a95f3387702eb6e58b`. No environment values or original database were published or reset.

The actual root `start` serves the frontend only. The fullstack descriptor derives `tsx --tsconfig tsconfig.ai.json server/index.ts`, port 8000, Vite output `build`, the root and `guides` locks, and compatible Node 22. The existing Dockerfile is backend-only. Neither is represented as proof of complete deployment. The source requirements identify an API, PostgreSQL and an external model requirement; analysis diagnostics are empty after excluding inert AST leaves and type metadata from the bounded executable traversal. Runtime TypeScript wrappers, enums, namespaces and JSX expressions retain executable calls.

A later import audit found that filename keyword exclusion had incorrectly dropped three real authentication components: `ForgotPassword.tsx`, `PasswordStrengthIndicator.tsx` and `ResetPassword.tsx`. Executable source names now retain ordinary credential-related vocabulary while credential data files stay excluded and all captured content still passes the secret guard. PascalCase JSX component bindings are distinguished from literal credential getters; nested and installed secret negatives remain unchanged. Fresh source-only capture is now 422 files / 12,201,417 bytes, hash `8efda30dc844d8d2239dfccea20a26607d4e448091f84ce6be2b2631f11ac998`, with all three components and zero analysis diagnostics. The original files and Git stayed unchanged. The earlier 419-file snapshot is historical evidence, not the final full source manifest.

The owner explicitly confirmed that credential-shaped values in these three tests are public synthetic fixtures. The product operator review binds these exact bytes, retains the tests and expires without automatic renewal:

| Test | SHA-256 |
| --- | --- |
| `server/ai/testing/unit/routeAuthCharacterization.test.ts` | `6be2121df875a70f5ab781fa16d6e235b3304c3b7de372096ea126f40093ca64` |
| `server/ai/testing/unit/routes/authRouter.test.ts` | `6f4334900b56c45f11f01077c921ea040320a8a1fd902916bfd08d2cbb49c25b` |
| `server/ai/testing/unit/transportPolicy.test.ts` | `c961b1d75f9aec9877984af7f0376f86cdc416ead76b5ae92327b70d056cbd5b` |

Review ID: `ab189182-09bc-4844-a20c-75e21418ea68`. All three hashes were rechecked against the original files after capture. The signed registry remains private.

## Implemented verification boundaries

- Docker build/runtime v6 and deploy/create v21/v22 share the existing policy, approval and journal services. A durable execution marker blocks uncertain daemon work across workers. The built image is an outcome, distinct from the immutable planned environment.
- Fullstack build v7 preserves root/nested locks and declared tests, excludes runtime secrets from frontend build, starts the actual API, verifies frontend assets plus independent JSON assertions, and exports exact output before cleanup. Final publication v23 checks proof, public JS/CSS hashes, API criteria and current release. The original repository remains unchanged.
- `test:ai:history-db` in Golestan emits `SKIP` and exits zero without `AI_HISTORY_TEST_DB_URL`; this is not a passed database test. The runner now rejects explicit skips, missing tests and nonzero skip counters, including TAP-commented and ANSI-colored output. No original test oracle was weakened.
- Source scanning respects bounded root/nested gitignore semantics. Public-fixture reviews never override known secrets; standalone code repair reads fresh actor-specific vault values instead of relying on a stale configuration snapshot.
- The shared Agent/MCP registry exposes read-only database inventory, identity and capabilities. It validates account/team identity, returns no passwords or connection strings, and reports pagination completeness, network/version readback and connectivity as unknown. Seventeen adapter tests plus registry integration passed against synthetic transport. No real database API or SQL was executed.

## Validation and failures

The initial full domain run after database-tool registration was 571 passed / 15 failed out of 586. Fourteen failures arose from the old 16-definition model input bound, including downstream missing-build proposals; the definition ceiling is now 20, with existing run request/tool/time allowances unchanged and a boundary test rejecting excess definitions before transport. One archive regression arose from applying an entry-path length limit to all source paths. The original long-path archive oracle was retained; source paths now retain the 512-character import limit while native entry paths remain bounded to 240.

The next complete domain run passed 586/586 with zero skips or cancellations. A subsequent concurrent run was 585/586: the unchanged project-library fixture exceeded its three-second setup deadline during competing build work. Its oracle and timeout were preserved. The final serial run passed 586/586, zero failed/skipped/cancelled, in 151.4 seconds. Earlier targeted passes do not erase either failed run above.

Final runtime candidate: source snapshot `59af5e79e717ca716532207e094a26fc6823fe74541e5c8e2c7b2462e971360f`, 530 files, isolated filesystem copy (no Git worktree). `npm run build` and TypeScript passed. `npm run test:http` passed 45/45. `node scripts/test-guided-browser.mjs` passed 54 states at widths 320, 360, 390, 768 and 1280, with synthetic model transport and zero cloud writes. Targeted lint over 18 changed files reported zero errors/warnings and two informational diagnostics. The earlier whole-repository lint had zero errors, 44 warnings and 14 infos; it is not described as warning-free.

The project-library browser suite additionally passed 14 states, zero model requests and one synthetic environment write in disposable local state. Stopped test controllers and their three owned images were removed by verified full IDs after receipts were retained. The production image/restart/health check remained unchanged. A read-only execution-host inventory found no cached PostgreSQL image; no pull, database process or SQL execution followed that inventory.

Four actual Linux/Docker cases passed on the existing execution VPS: pinned Docker build/runtime verification and owned cleanup; offline root/nested fullstack build with runtime-secret phase separation and output export; rejection of healthy HTML with unhealthy API; rejection of exit-zero skipped database tests before output export. The final run took 114.1 seconds; controller exit 0, no OOM. Production image, health, restart/OOM status and compose hash matched before/after. These were controlled fixtures, not Golestan or a native Liara release. The first Docker attempt exposed a missing `Labels` field in official image metadata; readback was corrected using optional map lookup. Earlier harness/path failures remain in private logs.

## Open acceptance

Owner clarification: Golestan is an already deployed production application with thousands of users, supplied as a compatibility example for Launchlane. This work must not change that deployment, its credentials, database, migrations or data. Any subsequent execution uses a separate captured copy and synthetic/disposable data only. A production migration or replacement release is outside this test scope.

Golestan has not completed its actual compiler/test/database/publication path. Its existing startup migrations require a concrete reviewed data plan. Disposable test DB execution, durable AUTH/PROF binding, migration recovery, data persistence after restart and real UI → API → DB behavior remain unverified. No model feature was called, and no new cloud resource, model allowance or budget was created.

The v7 test phase currently receives public build inputs only; private runtime configuration is reserved for start/workload. Database-dependent tests therefore require a separate isolated private-test contract, not disclosure of database credentials to frontend build. Golestan's history test additionally refuses a non-loopback database. A real disposable test database and its migration/cleanup authority must be designed explicitly; pointing it at a production DB is not a workaround.

A read-only dependency preflight found 1,331 Linux-compatible locked tarballs: 1,309 already existed in the operator's content-addressed npm cache, totaling 114,584,441 bytes, and 22 were missing. No package was downloaded by that preflight and no project script ran. This is source-only intake without environment import. A separate attempt to treat every local environment value as a known secret rejected ordinary configuration matches in 221 files; it was not counted as a successful secure environment import. Existing private-value guards were not weakened to bypass it. Public/source selection and later secure configuration remain separate steps.

The final cache helper independently verified those 1,309 actual entries read-only against the new 422-file source's locks. Fourteen temporary-filesystem cache tests and two integration regressions cover SHA512/SHA256 identity, symlink/hardlink/race boundaries, immutable publication, stale locks, malformed/partial quota, bounded entries/bytes and cross-job reuse without another network reservation. `LAUNCHLANE_NPM_CONTENT_CACHE` is an explicit operator `_cacache` path; actual `.env` files were not modified to enable it. No real cache entry was written or deleted by the preflight. The job still verifies and writes its own tarball manifest; missing packages are not fabricated and cache capacity cannot renew model/tool allowances.

## Final checkpoint after cache and authentication-source fixes

The new frozen candidate contains 536 files, snapshot digest `4dc78f3a3cfa42d05eb4f76050d221584ab941610647af98f1c4d2d8a56a36e5`. Its 303 runtime/source inputs have digest `fde37f4e1a05b950b8ecc461e825687e5417a7107884bd1910cdd4570b22ba88`; all candidate file hashes and current runtime-source hashes matched after testing. Build ID: `rBWy741Ndyp_UVe7boCUh`.

- `npm run build` and TypeScript passed on the final candidate.
- Final `npm run test:domain`: 604/604, zero failed/skipped/cancelled, 193.4 seconds. The earlier failures above remain recorded.
- Final HTTP suite: 45/45, zero failed/skipped/cancelled.
- Final project-library browser suite: 14 states, zero model requests, one synthetic environment write in disposable test state. The earlier guided browser checkpoint covered 54 states; the appearance was not redesigned.
- Final whole-repository lint: zero errors, 44 warnings and 14 informational diagnostics. Focused cache/source integration lint was clean.
- The four actual Docker worker cases retain their precise scope above; no actual Golestan compiler, database execution or public release is implied.

At 2026-10-25 17:08:44 UTC the existing public Launchlane health endpoint returned HTTP 200. That is an availability check for the unchanged public deployment, not acceptance of this new candidate. No Git commit/staging/push was performed; original Golestan HEAD/status remained unchanged. PostgreSQL package/image download, disposable database execution and a new public rollout were not performed.

The public Launchlane image remained `sha256:a547236ef28225af76ba331086a371922bcd77b157f87267e6e44494c38c3061`, build ID `6zRBRP24QoZ463cVmnGDS`; these working-tree changes have not been publicly rolled out. Persistent production mounts, configuration and ledgers were not reset. All fourteen official families remain in scope; source detection and controlled Docker fixtures do not complete their individual live acceptance rows.
