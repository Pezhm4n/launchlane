# ADR0048 — Flask/Django execution

2026-11-02: reuse the Python worker, Agent/web registry, approvals and journals.
Plan10 binds Python3.12, Gunicorn WSGI entry/port and the original framework runner; Action41/42 preserve family identity for publication/destination. Legacy2/11/12 remain unchanged.
Native configuration must be explicit; dependency versions are pinned and wheels hash-checked. Django settings/static/message mutations and source repair are unsupported in this slice; data authority is unchanged.
Publication requires the successful actor-owned source artifact, original workload and matching reviewed environment. Destination creation checks local build evidence independently of future cloud env.
[Checks and limits](../evidence/framework-python.md). Live Liara is unavailable; no cloud/model write is tested or authorized here.
