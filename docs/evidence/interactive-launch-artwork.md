# Interactive launch illustration — 2026-10-28

Scope: the existing source-to-cloud illustration in `WorkspaceIntro`, with no deployment, agent, provider or persistence behavior changes.

## Behavior

The original SVG is now the `LaunchArtwork` client leaf. A native button gives it pointer, keyboard and touch parity. Pointer movement updates two local CSS variables through one scheduled animation frame; it does not render React on every move. The illustration tilts gently, source layers spread on hover, the cloud glyph glows, and click/Enter/Space replays a short source-to-cloud light pulse with a cloud halo and check-stroke reveal. The nearby caption describes a visual demonstration. No server request, model run, real approval or publication is started.

Rapid activation restarts the scene without moving button focus. Pointer leave/cancel, blur and unmount clear the scheduled pointer frame. A reduced-motion change during playback stops the animation; reduced-motion activation retains static emphasis, and the two original isometric projection matrices remain intact. The existing compact layout below768px and the two tabs/optional chat stay unchanged.

No library, package or asset dependency was added. Styling uses the existing palette/type/space tokens, four named artwork motion/depth tokens and a scoped CSS module. Global deployment/migration components were not edited.

## Validation

The isolated same-drive snapshot is based on `095229c` plus only this UI slice, excluding the concurrent migration/runner working changes. It uses Node24.18.0, Next16.4.2, the existing installed dependency junction and disposable operator state; no `.env.local`, real credentials, production database or ledger was copied. The main server/port3000 was not restarted.

- `npm run build -- --webpack`: passed, including Next's TypeScript compilation.
- `npm run typecheck`: passed on the final snapshot.
- `npm run lint`: zero errors,48warnings and22infos; the four changed component/style/browser files separately have no diagnostics.
- `node scripts/test-artwork-browser.mjs`:10 measured layout/accessibility states passed. Actual normal flight, rapid replay, real Tab/Shift+Tab focus, Enter/Space, touch replay, pointer reset, changing motion preference and unmount during playback passed. Widths280/360/768/1280 and200%text were checked. No page errors, external requests or interaction-triggered mutations occurred; live model/provider gates were off.
- `npm run test:studio`:43 existing Chromium states passed, zero browser errors/external requests/cloud writes. Its two model requests used the existing synthetic transport.

These are UI acceptance checks on that snapshot, not a complete domain/HTTP/Docker pass or a production rollout. Runtime UI inputs were matched to the shared source before delivery; concurrent backend work has its own validation responsibility.

## Visual evidence and retained failures

Private evidence: `.local/coordination/artwork-interaction-20261028/`. It contains before/after images, the frozen source manifest, actual browser reports, logs and an animated GIF captured from the built UI. The before capture reused an isolated r6 build only after verifying byte equality of `WorkspaceIntro` and all relevant global/studio/token/mobile/motion styles to the pre-edit source. It is an illustration comparison, not a whole-current-backend baseline.

The first focused lint found the small decorative replay SVG needed its own `aria-hidden` attribute. Initial browser harness assertions incorrectly treated programmatic mouse focus as keyboard `:focus-visible`, and expected an unset pointer variable instead of numeric zero on touch; they were replaced with actual Tab navigation and a numeric zero-drift assertion. The original assertions failed before the final passes. The new CSS specificity warning was removed by ordering the rules; no rule was disabled.

The design kit's own `accuracy_report.mjs` was also run in its installation directory with a required browser. Its literal result was `12/52 checks passed = 23%`, exit1, including unavailable Playwright in that separate kit and failures in the kit's sample/spec/hook files. That self-test is not a Launchlane score or acceptance pass; the product's actual installed Chromium/axe checks above supply the UI evidence. No kit dependencies were installed and no product gate was weakened to hide those failures.
