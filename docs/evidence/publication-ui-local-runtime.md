# Publication UI and active local runtime — 2026-11-04

## Observed problem and change

The reported `https://localhost:3102` installation was built from the separate
`runtime-components` worktree at `efd696cfab0ac0c0ddb99cf9215873fc706479ad`.
It did not contain main's artwork replay/caption correction or MCP settings UI.
Changing main alone could not update this built production installation.

The existing artwork now replays on click, Enter/Space and touch; its old instruction
caption is removed. Explicit playback remains finite with reduced motion; ambient
motion still follows the preference. This is presentation only, with no job or write.
The existing guided MCP settings UI was transferred without changing access APIs,
policy, persistence or the runtime branch's platform implementations.

Plan quotes now use grouped Persian numerals and تومان, with exact hundredth-toman
precision from the existing real quote. For example, hourly 104166 hundredths is
۱٬۰۴۱٫۶۶ تومان; continuous 24 hours is ۲۴٬۹۹۹٫۸۴ تومان and 720 hours is
۷۴۹٬۹۹۵٫۲ تومان. No currency conversion, fabricated price, plan change or approval
change is introduced. The primary amount and currency have separate visual hierarchy.

GitHub readiness now resolves an explicitly configured executable in either auth
mode; otherwise it prefers the installed Windows private CLI and then PATH. An
explicit missing path never silently falls back. Existing private per-actor config
and credential isolation remain enforced. The missing-tool notice separates the
retry action from installer details; checking, failure and focus recovery are tested.
Readiness does not mean that an account has authenticated.

The existing official 2.103.0 ZIP was checksum-verified and its matching public
executable was installed into the runtime's ignored local tools directory. No new
download, global PATH change, account grant or credential copy was needed.

## Frozen validation, not a combined cross-revision full pass

Node 24.18.0, pinned lockfiles, isolated source/build/state, installed Chromium.
No real model request, cloud mutation or GitHub account login/import was made.

| Candidate | Result |
| --- | --- |
| Main `72bebaf1e1f2aac530ab2ae5ed038222a9541198` plus ten owned task paths | Build, typecheck and lint passed; lint reported 0 errors, 48 warnings, 22 infos. Targeted domain 30/30; plan browser 14 states; GitHub browser 9 states. Concurrent database WIP excluded. |
| Runtime `efd696cfab0ac0c0ddb99cf9215873fc706479ad` plus twenty focused paths | Build, typecheck and lint passed; lint reported 0 errors, 54 warnings, 47 infos. Targeted domain 44/44; HTTP/HTTPS/stdio 33/33; actual Chromium artwork 10, plans 14, GitHub 9 and MCP 24 states, total 57. |
| Same runtime compiled output relocated with original build directory unavailable | Artwork 10 and GitHub 9 states passed. This checks artifact relocation, not another full-suite run. |

Commands run in each isolated candidate:

```text
npm run build -- --webpack
npm run typecheck
npm run lint
node --test tests/domain/publication-summary-ui.test.ts tests/domain/github-tool-resolution.test.ts tests/domain/github.test.ts tests/domain/github-login-driver.test.ts tests/domain/state.test.ts tests/domain/catalog.test.ts tests/domain/destination-recommendation.test.ts
node scripts/test-destination-plans-browser.mjs
node scripts/test-github-readiness-browser.mjs
```

The runtime domain command also included `tests/domain/mcp-setup-guide.test.ts`,
`tests/domain/mcp.test.ts`, `tests/domain/mcp-access-file.test.ts` and
`tests/domain/mcp-connections.test.ts`. Additional runtime commands:

```text
node --test --test-concurrency=1 tests/http/api.test.mjs tests/http/mcp.test.mjs tests/http/mcp-hosted.test.mjs
node scripts/test-artwork-browser.mjs
node scripts/test-mcp-settings-browser.mjs
```

The GitHub browser command used a process-local `LAUNCHLANE_GITHUB_CLI_PATH` pointing
to the verified official executable. Only its actual version/readiness was queried;
missing/delayed metadata cases were synthetic. Browser checks include 280–1280px,
200% text, keyboard/focus, loading/failure, reduced motion where relevant and axe.
MCP issuance/download/revocation and SDK/stdio are actual local operations;
provider/model transports and selected failure/expiry UI inputs are synthetic.

The separate design kit self-test passed only 12/52 checks (23%) and exited 1. Its
Playwright, fixture/hook setup and some Windows commands were unavailable/incomplete. This is retained as a tooling failure;
it is not a product score or a passing gate. Product browser checks above ran actual
installed Chromium. No failed oracle or timeout was weakened.

## Activation of the installation the owner sees

The twenty focused source paths were applied without merge/cherry-pick or replacing
runtime backend work. A comparison of 351 source/public/package files matched the
frozen tested runtime candidate. The compiled manifest covered 288 files.

The manual app was already stopped at activation; no active process was terminated.
The previous `.next` was moved to a checked local backup, the tested relocated build
was moved into this worktree, and the existing Windows task
`Launchlane-runtime-components-local-3102` was started. Its configuration and launcher
were unchanged. `.env.local` bytes compared equal before/after; data and budget were
not reset or copied.

Active build: `mYYsfnnZ1CBUT64lkOzR6`; previous: `q8sUoxcQ1q4Hcq8Y6WU74`.
The task reported Running; `/api/health` and `/` returned 200. The served page chunk
and stylesheet hashes matched the exact validated compiled manifest, and the HTML
contained the new build ID. An already-open browser page still needs a refresh.

This is activation of the owner's local HTTPS production build, not a public Liara
deployment or acceptance of all runtime families. Real GitHub OAuth, external MCP
host installation, live provider deployment and unrelated database WIP were not
tested in this slice.

## Retained evidence and scope

Ignored packet: `.local/coordination/ui-polish-20261104/` in the main checkout:
candidate manifests, exact owned patch, command logs, activation receipt and
`live-asset-verification.json`. Runtime browser reports/screenshots are retained in
`C:\Users\Ariike.ir\.codex\tmp\launchlane-ui-polish-20261104\runtime-candidate1\.artifacts`.
Plan before-captures remain in the earlier MCP candidate's destination-plans artifacts.
Build/state/tool binaries, screenshots and private coordination are not committed.
The old active build backup is outside the product in the same temporary packet tree.
