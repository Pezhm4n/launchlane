# Composite preparation foundation — 2026-10-23

Scope: A07/A08/A11, AC19/23/27/28. Status: partial foundation, not a completed publication path.

`inspectCompositeProject` reads the captured source without importing or executing project code. It identifies one root ASGI backend and one locked Vite frontend, preserves the complete source root, records manifest/configuration hashes and describes the required preparation. Ambiguous entry points, dynamic output, conflicting locks and unsupported workspace layouts fail explicitly. A one-level root `-r requirements.lock.txt` indirection is provenance-bound; the descriptor does not silently rewrite it. Every detected descriptor remains `publishable: false`.

`validateBuildOutput` independently matches a bounded manifest against copied bytes: exact size/hash, nonempty index, regular-file declarations, canonical unique paths and no private/configuration/database files. Limits are 512 files, 32MiB total and 8MiB per file. It performs no filesystem writes and does not disable the source scanner's normal exclusions.

`compositeBootstrapSource` generates a restricted ASGI/static entry for applications without an existing root route or mount. It preserves API errors and refuses a conflicting root. The current Torob application already serves its own frontend and performs readiness checks, so this generated entry must not replace its production startup or add a second root mount.

Validation in this continuation: the two domain files passed 18/18; the bootstrap input-contract check passed 1/1. These are standalone checks, not fresh container, artifact-lineage or cloud evidence. Historical container evidence from the handoff is not relabelled as a new candidate pass.

The application/profile/Agent integration, actual build-output export lifecycle, final derived artifact, persistent disk/data transfer, runtime/start compatibility and live Torob workload remain open. No source, database or usage ledger in the original Torob repository was modified by this foundation.
