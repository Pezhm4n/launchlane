# ADR0022 — Project library and private environment import

Status: implemented; candidate verification is recorded in the linked evidence.

## Decision

Keep the two primary views. Add a small authenticated **پروژه‌های من** entry in the existing header, opening a modal library of persisted source snapshots and their latest publication mission. Listing, refreshing and opening never start a model, worker or cloud write. Twenty snapshots are returned per page, scoped to the actor. A recorded completed mission is historical evidence, not a fresh health assertion.

Opening another snapshot checks its current source bytes and immutable archive before changing the active pointer. In one SQLite transaction, the server checks execution ownership and unknown effects, validates any restored target against the connected account/team/app ID, cancels unused decisions, revokes program authorities, preserves history and switches the active source/target. Opening the already active snapshot is idempotent. Publication remains sequential by the owner's explicit preference; this does not claim independent concurrent mission contexts.

Environment configuration is separate from the source archive. The authenticated browser folder import includes known root environment files in distinct multipart fields. They are never written to the source workspace. An explicitly selected operator-local folder uses the existing canonical-path, symlink, opened-file identity and bounded-read checks. Inspection itself remains script-free; direct `inspectProject` still excludes private files.

Supported UTF-8 file overlays, in ascending priority, are `.env`, `.env.production`, `.env.local`, `.env.production.local`. Invalid UTF-8 fails instead of silently changing a password. Each file is limited to32KiB; merged values use existing128-key/4096-byte-per-value validation. Parsing uses installed Node24's literal `util.parseEnv`; no expansion, shell or project script runs. Nonstandard framework-specific file naming/expansion and ambiguous nested roots require further implementation.

Store merged values in the existing private `environment_inputs` vault using a distinct `source-v1` ciphertext format, separate encryption-key domain and authenticated binding to actor, flow ID and source hash. Snapshot activation and encrypted-input insertion share the `saveProjectFlow` transaction. Failed storage rolls back activation and removes an uncommitted uploaded snapshot. No new migration is required; historical ActionSpec/ciphertext bindings are unchanged. Inputs are usable for30days; retained encrypted values remain available to redaction after expiry.

Only names are returned to the browser/model-facing review. Importing does not grant a provider write. Required application keys pass through the existing v9 proposal, explicit decision, merge-preserving preflight, single claim, uncertain-write journal and configuration readback. The same verified environment reference then binds builds and publication. Existing target keys are preserved. The server reopens the source-bound input for submission; the browser never downloads stored values or copies them into hidden fields.

Execution-controlled keys such as `PORT` are excluded. Localhost addresses, unresolved `${…}`/`$(…)` references and unclassified short values are held for review rather than copied into production. `NEXT_PUBLIC_` keys still require explicit public classification. Database readiness and real application connectivity are separate obligations; importing a connection string does not prove either. A provider-configuration receipt does not prove a healthy release.

## Trade-offs and limits

- Reusing the private vault avoids a second secret store. Its two input kinds must stay distinguished by authenticated binding and ciphertext version; importing a secret is not an approved environment action.
- A source snapshot is not a continuous device sync. New local changes need a fresh upload; existing deployed apps are not deleted when switching projects.
- GitHub archives continue excluding private environment files. A separate GitHub configuration/resource path remains necessary; this slice does not fetch secrets from arbitrary repository files.
- A local development database URL cannot be transformed into a valid hosted database without provisioning, access and a verified application connection. That capability remains in A05/A08, not silently inferred from this import.
- No all-runtime, live environment, fresh-reader or public multi-user hosting acceptance is implied.

Evidence: [project library and environment import](../evidence/project-library-and-environment-import.md).
