# ADR0049 — Compiled Go through the existing publication path

Accepted, 2026-11-02. Plan11 runs the original module lock and Go tests with SHA-pinned Go1.25.14 in the existing network-none worker. A second fresh worker tests the exported binary without the compiler/cache/build tree; failed, skipped or absent tests cannot produce an artifact.

Receipt3 and the selected archive bind actor/job/source/plan/binary/recipe. Docker destination22 and publication43 reuse existing approval, environment, journal and release/workload checks; the destination does not reinstall modules or compile source. A fixed host serves the compiled proof and proxies to the original Go port.

Trade-off: an exact Linux/amd64 pure-Go binary and fixed Docker envelope are reproducible locally; this adds a Node host and supports one explicit executable, not native Liara rebuilding, cgo, Go workspaces, source repair or independent workers. Data requirements remain in the existing source contract; no migration, resource authority or second engine is added. [Evidence and remaining limits](../evidence/go-compiled-runtime.md).
