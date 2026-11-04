# README visuals

- `launchlane.svg`: repository-maintained SVG representation of the existing UI
  mark in `src/components/workbench.tsx` and shared brand styles; no new favicon.
- `publication.png`: actual guided UI from `data-read-r8`, captured on 2026-10-29
  at 1280px with Chromium. It shows a disposable authenticated operator session,
  no personal account or production data.
- `database-observation.png`: actual publication/data review component from the same
  snapshot, with synthetic publication/database responses. This is **not** cloud
  publication, production SQL, migration, application-write, or restart evidence.

Snapshot parent: `62a844e6b58bf51e874b5ae15033d2007de91a15`, plus the implementation
committed as `32bb2aae48aee91be9e99f2c7f0880a82eb3f9a2`. Runtime/package source SHA-256:
`8ae8da645abfcd27dd925a565d917af36bc3c3289db7f234f5e9157dc61af6dd`.
See [the validation report](../../evidence/postgres-data-observation.md).

Images contain no login key, private URL, credential, or actual database row. The
sample hostname in the card is test transport, not a demo link. The app has a dark
UI; images retain that real appearance in light and dark README surroundings.
