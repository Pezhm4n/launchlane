# README visuals

These images show the actual Persian interface at source
`1af6a15bce4bd70f17707d25ef404e071517d798`, captured with Chromium on
2026-11-04 from production build `w3jzwyov9AR7sRVyFdQ4A` at 1280 × 960.
The application has a dark theme; the images retain its real appearance in light
and dark README surroundings.

| Asset | Content and scope |
| --- | --- |
| `launchlane.svg` | Existing Launchlane mark, maintained in the repository; no new identity or artwork |
| `publication.png` | Authenticated landing page and actual folder/GitHub/sample entry points |
| `inspection.png` | Actual built-in `node-service` inspection, with execution gates disabled |
| `accounts.png` | Separate accounts page with disconnected Liara, GitHub and coding-tool controls |

Capture uses disposable operator state and separately executes local setup in a
temporary directory. GitHub connection metadata alone is replaced with an explicit
disconnected test response, so the host's CLI/account is never inspected. Browser
requests outside the test server are denied. There were zero browser errors,
external requests, model calls or provider writes. These are UI/setup observations,
not deployment, production data or live account evidence. Images contain no login
key, credential, private hostname or personal project.

From the repository root, after installing the locked dependencies and Chromium:

```sh
npm run build
node scripts/capture-readme.mjs
```

The script replaces the three PNGs and writes the current source revision, build
ID and image SHA-256 values to the ignored `.local/readme-capture.json`. Review
the actual images before committing; a later capture has its own provenance.
