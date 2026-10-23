# Project library and private environment import — 2026-10-23

Scope: A03/A07/A08/A17, AC22/AC23/AC24/AC32. [ADR0022](../decisions/0022-project-library-and-private-environment-import.md).

## Semantic oracles

- An actual browser-selected folder supplies source bytes plus separately classified environment input. Source snapshot/manifest/archive must not contain `.env` or its private values. Original files remain unchanged.
- Imported values are encrypted and bound to actor/source, never returned in public results or persisted agent messages. The existing environment action preserves target keys and requires its valid human decision. One reviewed change yields at most one write; readback yields the same secure build reference.
- Unsafe local addresses/substitutions, infrastructure credentials, malformed/tampered inputs, private/public confusion and changed source stop before a provider write.
- Project listing is actor-scoped. Opening another persisted snapshot validates source/archive and target, invalidates unused authority on the server, preserves both histories and does not create a run, model call, artifact or cloud mutation. Unknown actions/external executions prevent a switch.
- Mobile, keyboard focus, reload, empty state and restored history work through the actual UI/API; historical completion does not advertise present health.

## Implementation and boundaries

Implemented browser folder import, authorized operator-local environment reading, encrypted private inputs, public name-only review and reuse of v9 merge/claim/readback/environment reference. Root `.env` overlays only; execution keys are controlled independently. GitHub private-file ingestion, interpolated configuration, database provisioning/application connectivity and live publication with these new imported inputs remain UNCONFIRMED.

Implemented the existing-header library, paged snapshots/latest mission state and server-owned sequential source/target activation. It does not enable concurrent publication or create an alternative execution engine.

## Checks

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

## Capability reconciliation

| Capability | Existing task/AC | Implementation/evidence | Status | First unproven boundary |
| --- | --- | --- | --- | --- |
| Actor-scoped project library, sequential switching |A03/A17,AC24/32 | Shared Store/AgentRepository, source/archive revalidation, target identity, atomic invalidation; domain and browser checks above |implemented_verified (local) | Fresh reader/physical device; arbitrary runtime/project layouts |
| Browser and authorized local `.env` import |A07,AC22 | Separate multipart/private vault; local bounded file reader; no source/archive secret; UTF-8/actor/tampering/rollback regressions |implemented_verified (bounded local) | Nonstandard/nested configuration, private GitHub config ingestion |
| Imported config through shared approval/merge/readback/reference |A05/A08,AC22/23 | Existing v9 policy and journal; real HTTP application path with synthetic Liara transport |implemented_verified (synthetic provider) | Live environment update and real application connectivity |
| Imported configuration used by actual build/test/start |A07/A08,AC22/24 | One actual isolated Node22 case above, original test oracle and artifact checks |implemented_verified (bounded container) | Other runtime families and real cloud release with these inputs |
| Automatic database provisioning/connection |A05/A08,AC22 | Not established by importing a local connection string |partial | Actual small database, secret reference and application connection |

## Reproduction

Use the project's pinned Node24/npm/lockfile setup. After `npm run build`, run `npm run test:projects` for the focused application/browser scenario and `node scripts/test-folder-browser.mjs` for the native directory regression. Chromium must already be installed. The separate container command requires the project's pinned Node22 image and Linux Docker engine; it is not a Liara deploy command.

In the product, choose a project folder normally. The preview identifies root environment files separately from source. When the mission needs those keys, select **مرور و استفاده از تنظیمات پوشه** and review the actual destination/key names; only the valid decision allows the shared updater to proceed. The values are not retyped or sent through chat. Open **پروژه‌های من** beside account controls to return to persisted snapshots. A removed/changed source or inaccessible recorded target needs a fresh selection/account review; an uncertain operation must be reconciled before switching.

The new automatic operator-local import exposed two test assumptions: a fixture already contains `.env`, so a later snapshot correctly has its own input rather than an empty vault; public-key denial must preserve the pre-existing encrypted-input count rather than assume an empty database. Original denied input and zero-provider-read/write assertions remain. Failed expectations are retained in ignored local test logs; neither provider oracle was weakened.

The first browser runner failed before product interaction because it opened SQLite before creating the isolated state directory; initialization now occurs inside cleanup coverage. Candidate24 then failed the environment-form wait because the seeded run used a different team configuration from its server. It now asserts the exact connected target before opening the form. Candidate25 passed8new UI states and the complete imported-input → approved synthetic update → readback path, with zero model calls. Its independent folder test exposed an invalid network oracle: Playwright/CDP's `postDataBuffer` omits file contents, so it cannot prove their presence or absence. The replacement checks the separate multipart field, decrypts each received source-bound fixture through the actual vault, verifies the expected value and confirms no `.env` manifest/plaintext vault entry. The original fixture marker is retained. This changes the faulty observation method, not the secret-isolation requirement.

Screenshots on candidate25 exposed the browser-default square white border/background on the library, despite passing axe/overflow. The library now explicitly uses shared surface/border/radius/overlay tokens and bounded scrolling. Invalid UTF-8 rejection and redaction of imported values even under a public-looking name were also added before the final candidate.

No paid model request or live Liara write has been made for this slice. Existing allowance is unchanged; unknown subscription costs remain unknown. Synthetic environment readback is not live workload verification.
