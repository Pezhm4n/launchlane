# ADR0028 — native frontend build, bounded Node20 and environment discovery

Date: 2026-10-23. Status: implemented; native cloud acceptance remains open.

## Decision

Reuse the existing source, approval, mission authority, journal and publication engine for native React, Vue and Angular. ActionSpec19/20 bind framework, builder, output directory, mirror and fixed native Node20 to the exact source/artifact and destination. Historical ActionSpec1–18 bytes remain unchanged. Native Next keeps17/18, but its provider configuration is corrected to the documented `next.nodeVersion` field; the previous synthetic fixture had repeated the wrong `version` field.

Inspection does not execute scripts. Framework and build configuration must be supported and unambiguous. Angular SSR/multiple applications and conflicting frameworks are rejected with a preparation boundary. A platform label is not evidence of a successful compiler or release.

BuildPlan4 selects pinned Node20.20.2; BuildPlan5 additionally binds native frontend output. The isolated runner installs integrity-verified locked packages offline, runs actual build/tests and serves the actual output with a host-owned static server. Referenced local JS/CSS must exist, have the expected MIME and fit byte limits. A fallback HTML response cannot prove a missing asset. Source mounts stay read-only; no host shell, network, Docker socket or credentials are granted. Built output is not yet exported for composite Python applications.

The default tool ceiling becomes1024, maximum4096, and the npm lock-entry ceiling2048. A real upstream React lock required169 deduplicated package reads, exceeding the former160 tool limit. Time/model/currency limits and per-package/aggregate byte limits remain enforced; persisted old limits do not renew. This is not a new spending allowance.

Environment discovery parses real static JS/TS accesses and bounded Python helper calls instead of scanning arbitrary text. Comments, strings and shadowed objects are not environment requirements. Names do not imply requiredness. VITE_/REACT_APP_/NEXT_PUBLIC_ need explicit acknowledgement of browser exposure; raw values still use encrypted scoped forms.

## Evidence and remaining boundary

See [native frontend evidence](../evidence/native-frontend.md). Native cloud releases, real Vue/Angular compilers, browser application behavior and composite Torob data/publication require separate proof. Supporting these contracts does not establish all14 required families.

Official version sources: [React](https://docs.liara.ir/paas/react/how-tos/choose-version/), [Angular](https://docs.liara.ir/paas/angular/how-tos/choose-version/), [Next](https://docs.liara.ir/paas/nextjs/how-tos/choose-version/).
