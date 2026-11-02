# ADR0050 — Installed PHP/Laravel through the existing publication path

Accepted, 2026-11-02. Plan12 uses pinned PHP8.3.36/Apache, Composer2.11.1 and a checksum-verified Debian unzip tool. It retains the original Composer lock, scripts/hooks and PHPUnit configuration, checks actual platform requirements and exports the production vendor closure after removing dev dependencies through Composer itself.

A second network-none worker tests the installed bytes with Apache without Composer/cache. Receipt2 and the existing archive/output store bind actor/job/source/plan/vendor/recipe. Docker destination22 and publication44 reuse existing approvals, environment verification and journals; destination installation is unnecessary. No root dependency, SQLite migration or data authority is added.

Trade-offs: one explicit document root/version and PHPUnit runner are supported; separate frontend builds, background components, custom repositories/configuration, other versions and Composerless PHP remain open. Code leaves under namespaces such as Auth/Passwords stay code; private data paths and private input bytes remain blocked. Generated build proof cannot substitute for application behavior in compiled builds or artifact selection. [Evidence](../evidence/php-installed-runtime.md).
