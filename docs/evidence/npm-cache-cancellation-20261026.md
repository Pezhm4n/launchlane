# Dependency cache cancellation — 2026-10-26

Qadam's unchanged npm lock selected 431 Linux/x64/glibc candidate dependencies. A Windows registry read failed after 419 complete tarballs (48,294,103 bytes) had been staged. No project command ran. The following attempt correctly refused the private cache because `.write-lock` remained present; that refusal was preserved rather than treated as a cache miss or a reason to delete the lock.

The cache serializer returned an abort race while its filesystem task still owned the lock. Consequently a downloader could finish its `Promise.allSettled`, and its process could exit, before the task's asynchronous `finally` completed. The serializer now settles with the filesystem task itself. Cancellation checks inside that task still stop work, and the caller receives the rejection after owned-file cleanup. Existing stale-lock, quota, integrity, symlink and ownership guards remain in force.

Validation on Windows, Node 24.18.0:

- Cache regressions: **15/15 passed**, including cancellation after observing an actual writer lock, immediate absence of owned temporary files after rejection, and a subsequent verified write.
- Biome check on the two changed files passed; typecheck passed in the current working source.
- A further real Qadam dependency attempt still failed on an official-registry network read, but the new private namespace contained **no writer lock** after the process exited. This is cancellation evidence, not a successful dependency install or project build.

The original failed namespace and its quota were retained. No source repository, cloud application, database, model allowance or production container was changed by this fix. Network availability and the complete Qadam build are separate acceptance boundaries.
