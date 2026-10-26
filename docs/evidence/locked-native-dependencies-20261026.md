# Locked native dependencies — 2026-10-26

Scope: A07/A08/A11, AC19/AC27. This checkpoint continues on `main` at base `6937dfc`, with the existing uncommitted Docker/fullstack work preserved. It does not establish a public release of any of the requested real projects.

## Observed failure boundary and change

The actual Zarinpal npm lock v3 declares Linux/x64 optional native packages without their `libc` fields. The official metadata for those exact versions distinguishes glibc from musl. Inferring compatibility from the missing lock field would download both variants for the pinned Debian/glibc worker. This is a dependency acquisition problem, not evidence that the application is broken.

`lockedTarballs` now records the exact public package/version identity for this bounded case. On a cache miss, the existing downloader reads only that version's official npm metadata. Name, version, tarball URL and integrity must all match the unchanged lock. Incompatible OS/CPU/libc entries are omitted from the executable cache manifest; `platform-selection.json` retains the metadata hash and decision. No package-name suffix heuristic, source/lock modification, dependency upgrade, new command or image authority was added. The [official npm package contract](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#libc) documents the platform fields.

Both metadata and tarball reads consume the existing tool budget. DNS/public-IP validation, TLS, fixed registry, redirect denial, byte bounds, cancellation and integrity verification remain in the same adapter. A verified existing cache hit requires no metadata request or new HTTP reservation. The existing private cache's immutable entries, quota, locking and corruption behavior are preserved. No model allowance was created or renewed.

## Actual dependency acquisition

- Source: `f11511c88cf07f46b929c6c56f6d2e1feba0bd44`; captured source hash `a6823489515ffbba1854559c563ea5aee093f03a127614d9e109ccfd1de6eba7`, 165 files, 5,683,899 bytes.
- Initial platform-compatible lock list: 591 tarballs; 573 existing cache hits and 18 misses.
- Official version metadata reads: 12. Six musl tarballs were excluded, with metadata hashes retained.
- Actual tarball downloads: 12, totaling **52,539,382 bytes**. Metadata: 22,601 bytes. Total HTTP reads: 24; duration 49,823 ms.
- Total verified tarball bytes copied to the job input: 125,579,056. Every cached/downloaded item was checked against the original lock integrity. No source script ran during intake or acquisition.

These figures are the measured transfer for this source and cache, not a general download estimate. Portable dependencies declared by the lock remain included; no other CPU/OS native binary was downloaded.

## Validation checkpoint

On the current working tree after this change:

- Focused platform/cache/project-build tests: 15/15, zero failed/skipped/cancelled.
- Complete domain suite: 643/643, zero failed/skipped/cancelled, 204,745 ms.
- `npm run typecheck` and `npm run build`: passed; Next 16.4.2, Node 24.18.0.
- HTTP suite: 45/45, zero failed/skipped/cancelled, 27,156 ms; provider/model transports are synthetic.
- Lint on the two new/changed platform files: clean. Whole-repository lint: zero errors, 46 warnings, 15 informational diagnostics; this is not warning-free.
- `git diff --check`: passed. Existing unrelated changes remain unstaged.

The platform tests distinguish glibc and musl metadata for the same neutral package name, reject changed package/version/URL/integrity before downloading, preserve offline cache hits and stop on malformed/cancelled metadata. They use synthetic transport. The dependency acquisition above used the real official registry.

An independent copy of HEAD plus only the staged slice initially passed 28/29 targeted tests: the cache's explicit operator-path configuration had been left outside the staged patch. That four-line configuration change is part of the slice now; the same unchanged tests passed 29/29. This check prevents the broader uncommitted implementation from hiding a missing commit dependency.

## Remaining acceptance

The real Next compiler/start/workload run and exact-artifact publication are separate steps. The first Linux controller failed before importing Launchlane because extracted controller directories were root-owned mode 0700. Directory permissions were read back, corrected in the isolated controller context, and a new controller identity was recorded. This was packaging failure before project execution; no application test was counted as passed.

Read-only live inventory confirmed the public Launchlane image `a547236ef28225af76ba331086a371922bcd77b157f87267e6e44494c38c3061`, Build ID `6zRBRP24QoZ463cVmnGDS`, healthy/restarts0/OOM=false and SQLite quick checks. The existing Zarinpal and Liara-assistant destinations have default subdomains disabled, and their selected team returned no domains. No public project URL is inferred from their names. No infrastructure write, new paid resource or model request was performed for this checkpoint.
