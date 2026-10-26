# SQLite binding and migration ownership — 2026-10-26

The fixed Worker runtime implements the observed `prepare/bind/first/all/run/batch` surface using Node 24's actual SQLite engine. It preserves repeated numbered parameters, anonymous parameter ordering and independent bound statements without rewriting quoted literals or comments. Unsupported binding values, named parameters, malformed input and additional statements fail explicitly.

Five domain tests execute the program against real temporary SQLite databases. They check returned query values, a batch rollback after a later SQL error, rejection of another database's statement, checksum-bound migration history, distinct filenames sharing the same numeric prefix, preservation of edited stored data, atomic migration failure and refusal to adopt an unowned populated database. The tests passed without a provider or model.

The same program was used in the actual isolated Qadam build and its independent two-process persistence experiment. Those broader preparation/publication/Agent paths are separate working-tree capabilities and their own evidence is required. This commit alone does not connect or accept an entire deployment path.

The adapter deliberately omits remote D1 access, sessions, replication, bookmarks and `exec`. It does not copy or reset an original application's database. A successful compatibility example is a product capability test, not a substitute for native mission execution, approved resources and actual public workload verification.
