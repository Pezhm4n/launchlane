# Responsive interface stabilization

Scope: guided publication, investigation, project selection/library, account access,
repair consent, resource reviews and the optional assistant. This is interface
acceptance with isolated state and synthetic model/provider transports; it grants
no live deployment, model quality, SQL or data persistence acceptance.

## Reproduced problems and changes

- On base `15f2912`, the signed-in header occupied 97px at 280px because the new
  project library action no longer fitted beside the brand and account button.
  Its mobile representation is now a named folder icon with a 44px target; the
  desktop label remains visible. Text enlargement may grow the header naturally.
- The change-project control measured about 36px high. It now consumes the shared
  control-height token and allows its text to wrap.
- Once those earlier failures were removed, the existing mobile regression exposed
  a second problem at 280px/200% text: the long repository name in the project
  summary created 151px of horizontal overflow. The flex child containing the
  complete name now permits shrinking and line breaks. Bidi isolation remains.
- External-agent consent checkboxes inherited full-width text-field styling.
  They now have compact checkbox geometry and a full clickable, wrapping label.
  Acknowledgment, fallback, selected agent and authority semantics are unchanged.
- Assistant mode buttons and password visibility now meet the shared touch target.
  The existing agent selector uses the same field surface, font and control-height
  tokens. Transitions in the changed controls name their properties explicitly.
- Sign-out used an independent timer and always requested the operator-local key,
  even for hosted Liara authentication. It now reuses the guarded dialog exit,
  reports the actual sign-in method, scrolls in short windows, and restores focus
  on cancellation without ending the session. Hosted confirmation is tested
  through the actual session endpoint before a second synthetic user logs in.
- Desktop chat stays non-modal, as required by the existing design. Moving focus
  back to the workspace collapses its enlarged overlay so the focused controls
  are no longer obscured by blur/dimming; the chat draft and mission are retained.
- In windows at most 480px high, the header and chat launcher join the document
  flow, padding becomes compact, and focus scroll margins stop reserving the old
  sticky header. This leaves room for actual controls in landscape with 200% text.
  The launcher remains positioned relative to itself so its clipped decorative
  pseudo-element cannot create page overflow.

## Test corrections

The initial 26-runner baseline passed 22 runners and failed four. Two failures
were product geometry defects above. The other two needed precise investigation:

- The older destination test expected the contiguous phrase `تومان در ساعت`.
  The current component displays readable hourly amounts and `برای هر ساعت`,
  with exact prices under disclosure. The updated test independently checks the
  fixture's 540 toman/hour, 12,960 toman/24h and 388,800 toman/720h; it does not
  relax cost or unit verification.
- Deployment's viewport loop retained scroll from an earlier focused input after
  resizing. Axe then counted a partially clipped, inactive submit control at the
  viewport edge as a target-size violation. The geometry was captured separately.
  Layout scans now start at a deliberate page origin, following the existing
  workbench harness. Actual Tab/focus visibility is tested independently at
  280/320/768/959/1280px; targets, accessibility rules and timeouts remain enabled.

The broader intermediate candidate exposed two further regressions: 44px assistant
mode controls reduced the desktop reading area below its existing 65% oracle,
and destination polling could still be inside `route.fetch()` when its browser
context was closed. Desktop header padding now gives the reading area that space
back, and teardown explicitly awaits route handlers (`unrouteAll` with `wait`)
before closing their context/store. Neither oracle nor asynchronous errors are
suppressed. A stricter short-window probe then detected decorative overflow and
partially off-screen focused controls; these are covered by the final rerun.

## Validation

Candidate `candidate-r4`, based on `15f2912`, Windows/Node 24.18.0 and the
committed dependency lock, passed lint (0 errors, 48 existing warnings, 22 infos),
type generation/typecheck, a production Webpack build, domain 820/820, HTTP 49/49
and all 27 isolated browser runners in one final candidate. No tests were skipped.
The browser matrix covers the workbench, deployment, restart, domains, guided flow,
destination/resources, folders/library, sign-in, motion, mobile/chat, platform
badges, expiry, networks, storage, environment, database attachment/targets/data,
migration review, maintenance and artwork. The new responsive runner passed
47 states, guided 57, workbench 75, mobile 10, chat 13 and hosted login 10; these
are individual runner scopes, not a new combined case count.

The 561 source/test/config/fixture/workflow inputs matched the frozen snapshot.
Its LF-normalized input fingerprint is
`d0e9a822a1dbe3bb5a3dd37ed51230d868ca68b7498be21badd4418551c8e146`.
Intermediate r1/r2/r3 failures remain in their own logs; none is reported as a full
pass. The original 295 source files of the baseline snapshot were separately
matched against `15f2912` before comparison. Model/provider transports were
synthetic, browser/server actual, model spending and real cloud writes zero.

The shared-token follow-up below is a later candidate with its own focused checks.
The 27-runner/domain/HTTP matrix above belongs to `259fe85`; it is not relabeled
as a newly repeated full matrix for the token patch.
Private logs, source hashes and before/after screenshots live under
`.local/ui-responsive-20261101/`; disposable states and archives are not committed.

`npm run test:responsive` adds cross-flow axe, geometry, 200% text, short landscape,
Tab/Escape, modal boundaries, focus return and session-preserving cancellation.
The normal `test:browser` command includes it, and CI now runs the whole core
browser command instead of only the guided suite. Chromium is installed before
HTTP/browser execution. Real mobile devices and browser engines other than
Chromium remain outside this evidence.

## Shared-theme follow-up

The five missing variables were `--color-field-hover`, `--radius-full`,
`--radius-xl`, `--shadow-sm` and `--shadow-surface`. Undefined variables invalidated
their entire declarations: the project summary lost its rounded corners and the
selected plan lost its composed shadow/ring. All five now live in the existing
theme, using its palette and related tokens. No second theme or dependency exists.

`test:responsive` checks that every direct CSS variable reference has a declaration
or explicit fallback, then checks the actual computed project radius/shadow. The
plan test verifies the selected surface and actual hover background change. The
static check is a declaration contract; it does not prove every possible selector
cascade or browser engine. Actual Chromium rendering remains necessary.

Candidate `candidate-r5` carries the `259fe85` runtime plus this token patch. On
Windows/Node24.18.0 and the same pinned dependencies it passed lint (0 errors,
48 warnings, 22 infos), typecheck and production Webpack build, then responsive47,
plans14, chat13, guided57 and hosted sign-in10. These five affected suites were
rerun on r5; domain/HTTP and the other browser suites were not repeated locally
for this CSS-only follow-up. No real model/provider calls were made.

All 561 executable/test/config/fixture/workflow inputs matched the frozen r5
snapshot. Its LF-normalized fingerprint is `867b70d5f337ccaafb49d7d116dd9229e2d8d9c08e1cff81b0c72909921dd069`.
Before/after desktop/mobile/200%/short-window screenshots were visually inspected.
The final GitHub workflow checks the pushed revision independently.

## Linux synchronization follow-up

[Actions 41317995225](https://github.com/Pezhm4n/launchlane/actions/runs/41317995225)
on `05eea02` passed lint/typecheck, domain820, build, HTTP49 and the first thirteen
core browser runners. The new responsive runner failed its immediate library
return-focus assertion. `Workbench` intentionally schedules that focus in
`requestAnimationFrame`; modal removal alone does not establish focus completion.

The harness now waits for the exact trigger to become `document.activeElement`,
then retains its original assertion and default timeout. No application code,
target, accessibility rule or timeout changed. Local r6 reused the byte-identical
r5 application/build inputs and compiled output; only this test harness differs.
Changed-file lint and three consecutive 47-state responsive runs passed with no
failures or actual model/provider work. This is not a fresh local build or repeat
of domain/HTTP. The next pushed revision receives the full Linux workflow again.

A subsequent [Linux run on 19a4388](https://github.com/Pezhm4n/launchlane/actions/runs/41319062935)
passed domain820/HTTP49/build and ten core browser runners, then exposed the same
readiness class in the chat probe: the desktop CSS expand control was visible
before the media-query handler had changed the native mobile modal to non-modal.
Chat audits and explicit breakpoint changes now wait for both the actual dialog
mode and visual-viewport geometry. The original mode assertions remain intact.
Local r7 passed changed-file lint, three chat13 runs and responsive47 using the
unchanged r5 compiled application. Only harnesses and core-command order change;
the fourteen suite members, assertions and timeouts are retained. Responsive/chat
now run first so a new readiness failure is reported earlier in the core suite.
