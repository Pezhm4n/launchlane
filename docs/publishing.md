# Public repository preparation

This guide covers repository publication, not deployment of Launchlane or users'
projects. Publishing the repository grants no provider/model execution authority.

## Included in the repository

- Equivalent [Persian](../README.md) and [English](../README.en.md) entry points,
  actual UI images, the existing brand mark, and a current architecture diagram.
- [MIT license](../LICENSE), [third-party notices](../THIRD_PARTY_NOTICES.md),
  [contributing](../CONTRIBUTING.md), [security reporting](../SECURITY.md), and
  [community conduct](../CODE_OF_CONDUCT.md).
- Issue forms, PR template, read-only-token CI, and Dependabot configuration.
  Routine npm/Actions version PRs are paused with `open-pull-requests-limit: 0`;
  security alerts/updates have separate GitHub controls and are not disabled here.
- Committed exclusions for runtime state, local access files, disposable output,
  dependencies, environment secrets, and private key files. Internal prompts and
  personal research remain under local Git excludes.
- A documentation index and a separate historical verification archive. Historical
  evidence remains available without presenting its counts as a current full pass.

## Before the first public push

1. Add the permitted IRANYekan redistribution notice supplied by the owner. Permission
   was confirmed, but its supporting document is not present yet. Third-party material
   is not relicensed by the root MIT file; review [the notices](../THIRD_PARTY_NOTICES.md).
2. Inspect the exact staged paths and diff, and scan the complete history that will
   be pushed as well as the current files. A `.gitignore` rule does not erase an
   already committed secret. Rotate any exposed credential before handling history.
3. Check the intended GitHub owner, repository name, remote, and visibility. The
   README clone URL follows the existing `Pezhm4n/launchlane` remote; update both
   languages if the destination changes. Do not overwrite another repository.
4. After the owner authorizes publication, push and inspect the first actual hosted
   CI run. Local checks do not establish an Ubuntu/GitHub Actions pass. CI uses
   synthetic providers and no cloud credentials; it does not deploy.
5. Enable private vulnerability reporting, secret scanning/push protection where
   available, and the applicable branch rules in GitHub settings. Require the actual
   `CI / checks` result before merging once the workflow has run. These are account
   settings and are not enabled by committing files.

No repository creation, visibility change, push, release, or rollout is implied by
this preparation. The product's unfinished platform/data acceptance remains in
[the acceptance matrix](acceptance.md), independently of repository presentation.
