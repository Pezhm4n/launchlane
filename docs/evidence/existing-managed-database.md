# Existing managed database selection — 2026-10-28

This A14 / AC17/22/23/24/32/34 slice adds exact-ID reuse and private rebinding to the shared resource flow. It preserves the earlier v27/v28 creation, original migration-runner and artifact/publication implementations. [ADR0036](../decisions/0036-existing-managed-database-selection.md) records the decision. This is resource/configuration capability, not complete application or live data-plane acceptance.

## Product behavior and use

The guided publication mission may inspect `read_database_resources` inventory and call `propose_database_attachment` with `consumerRoot`, private `bindingKeys` and the exact `databaseId`. The host checks immutable source evidence and same-account inventory, then privately reads the existing provider detail endpoint. The detail ID/hostname/type/plan must agree with inventory; version and an explicit private network must be known, and the network must match the actual consumer in the selected team. Unknown public/private status, mismatched identities and missing metadata fail closed.

The proposal is ActionSpec v29 `attach_database`. The ordinary resource card shows the existing database name, application, type/version, connection keys, current separate price components and private network. Exact ID, consumer and expiry are available under technical details. The user approves selection, then fresh checks precede the existing atomic claim. Selection performs no create, clone, resize or SQL request. The journal records the observed resource as `selected`; neither execution nor Agent state rehydration labels it `created` or manufactures a cloud change.

The same secure form then obtains private credentials on the server and proposes encrypted v9 environment inputs. Its separate decision, merge-preserving single-send update and configuration readback remain required. The model and browser receive names and receipts, never passwords or raw connection values. The web and MCP Agent goals share this registry and application engine; no public credential/SQL tool is added. This slice does not include a new invocation from an actual MCP client.

Reservations cover v27/v28/v29. An occupied purpose may be selected again only for the identical successfully observed ID, engine, consumer and exact key set. New private credentials for that same identity/purpose may supersede the previous binding, allowing recovery after rotation. A different database or swapped resource links cannot satisfy the publication guard. Uncertain creation is not adopted by hostname.

After a local interruption between recording selection start and acceptance, reconciliation reads only the approved ID and requires the same private detail evidence. It does not renew or repeat claim/approval. This recovery is specific to selection, which has no provider write; v27/v28 unknown create responses still require their returned identity and never receive this exception.

Migration21 only appends a request-key index covering v27/v28/v29. The complete migrations1–20 `{version,sql}` prefix matches immutable base `fc01252d8531da66a9ca0cb4633e53a55b692f22`; aggregate JSON SHA256 is `a93f6875de44efa559d8cb3d0004693f7b5acf8379f4abbbf81c8b17acfbbf5d`. Disposable upgrade tests also preserve sessions and reject a duplicate request key across creation/selection.

## Revision and validation

Base: `fc01252d8531da66a9ca0cb4633e53a55b692f22`. Node24.18.0, npm11.16.0 and pinned dependencies. Final candidate: `database-attachment-r9`, runtime/package SHA256 `170d2b905a1247d5375b0a60daa946ec006621c6522d87bb869a9ef247a35cad`. Source and tests are frozen independently of the main server and the other agent's runtime/component worktree. Heavy checks hold the agreed OS FileStream lock with `FileShare.None`; file existence is not treated as ownership. Servers use isolated disposable state and ports, without modifying port3000 or the main `.next`.

All final results below belong to r9; earlier candidates are not relabelled as its pass:

| Command / boundary | Final result |
| --- | --- |
| `npm run test:domain` | 795/795,260.070s; no skipped/cancelled tests |
| `npm run typecheck` | Passed |
| `npm run lint` | 0errors,48warnings,22infos;542files; no fixes applied |
| `node node_modules/next/dist/bin/next build --webpack` | Passed; nested-snapshot workspace-root warning retained |
| `npm run test:http` | 48/48,28.391s; actual isolated HTTP with synthetic integration transports |
| `node scripts/test-database-attachment-browser.mjs` | Two exact existing IDs and two private bindings;8expanded responsive/axe layouts; keyboard disclosure/decisions, replay409 and reload passed; no browser errors, external requests or secret leaks |
| `node scripts/test-database-targets-browser.mjs` | Prior two-created-resource/private-binding web regression passed;8responsive/axe layouts; synthetic provider/model |
| `node scripts/test-guided-browser.mjs` | 54states at320/360/390/768/1280; synthetic model,0cloud writes |

Final existing-resource run `452cc96b-8ee2-4b85-b3ca-a6cb0865f17d` used6synthetic model requests,0create calls,2synthetic env writes and4durable attempts. Screenshots at320/1280 with expanded ID details were visually inspected. No fresh Docker/runtime-database test was necessary or claimed in this resource-selection slice; the prior original-runner evidence remains separate. Per-file normalized hashes for all23owned code/test paths match the frozen r9 manifest before staging. Private manifests/logs are under `.local/continuation-20261028/database-attachment-r9-*`; artifact outputs are under that candidate's `.artifacts`.

The preceding r8 runtime/package fingerprint was `2d33ea5a3ad1260c9024321abf35b9965c19ea98303268c16c6102d629c241bd`. Its fresh full domain suite passed795/795 in257.951s; typecheck, lint0errors/48warnings/22infos across542files, Webpack build, HTTP48/48 in18.503s, the actual web/API two-existing-resource path, the earlier two-created-resource regression and guided54 all passed. r9 adds the visible existing-resource name, a neutral missing-binding error, an explicit engine match for same-ID reservation reuse and expanded keyboard/disclosure/screenshot checks. Final r9 checks remain separately attributed.

The domain cases cover exact-ID and source-purpose binding, zero-balance selection without purchase, rejected/missing/public/cross-network/changed resource metadata, current catalog/price/source/account/expiry/budget checks before claim, immutable consent/session/actor/replay, inventory-only and mismatched proof denial, interrupted local selection reconciliation, shared Agent continuation, private environment merge and same-resource credential rotation. Existing creation/uncertainty and swapped-link regressions remain in the full suite.

The browser path uses real folder upload, guided mission registration, tools, approval API, Store/journal and private binding application. Provider and model transports are explicitly synthetic and deny every external network request and every unregistered operation. Two existing resources are seeded as fixture metadata. The mission reads inventory, selects each exact resource, obtains two separate selection decisions and two environment decisions, preserves KEEP_KEY and the first connection during the second merge, and stops with migration/data/publication still unverified. There are zero provider create calls, two synthetic environment writes, six synthetic model requests, four durable attempts and zero actual cloud writes. Replay must return409 and reload must preserve usage/limits and issue no new model request or write. Responsive/axe checks cover320/390/768/1280 for each selection, with exact ID disclosure operated by keyboard. Screenshots/logs remain private under the candidate's `.artifacts/database-attachment`.

## Retained failures and remaining work

The first typecheck rejected a nullable connection team ID; the adapter now receives the validated connected config's team scope. An early fixture omitted the required consumer bundle ID and failed before any selection. Expanding the historical pending-action fence indiscriminately also changed an existing reservation error; that unrelated expansion was removed while the existing cross-version uncertainty fence remains. The Agent integration then found state rehydration incorrectly labelling an existing selection as creation; both driver and repository projection now preserve prior effects. Later typechecks found test closure narrowing errors; local validated discriminants replaced them without assertions or relaxed typing. Failed logs remain in the private candidate records; their results are not counted as passing final runs.

Graph project/coverage tools again returned `Transport closed`; exact source/import/caller/contract reads supplied the evidence. No missing capability was inferred from absent graph symbols.

Selection currently requires explicit private detail network/version and a plan/bundle/version still observable in the account catalog with both separate prices known. Legacy resources with missing or retired metadata need a further reviewed contract; no default version, zero price or public endpoint is invented. The source binding is still limited to the supported private URL/URI shapes for PostgreSQL/MySQL/Redis.

Real provider detail/adoption, destination-side original migration execution, independent SQL/schema/data effects, release-bound API/connectivity, database restart/persistence, a complete resource/component plan and data-aware rollback remain open. The next implementation must connect the existing original-runner proof and these exact resource bindings to controlled authorized execution and the tested publishable artifact. A metadata/configuration receipt cannot discharge those requirements. The owner's no-new-model-spending decision was preserved: no real model calls, ledger renewal, actual infrastructure writes, production SQL, original corpus edits, push or rollout occurred.
