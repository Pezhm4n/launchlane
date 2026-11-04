# ADR0039 — Source-bound schema baseline intake for disposable runner tests

Status: implemented; acceptance is bounded by the recorded tests.
Date: 2026-11-04

## Problem

A migration runner may depend on tables created before its tracked migrations.
Golestan's original runner exposed this boundary on an empty database. A historical
local dump contains the missing `users` DDL and real rows. Restoring that dump would
copy data and does not belong in an automatic preparation experiment.

## Decision

The authenticated project application accepts an explicitly chosen UTF-8 plain SQL
dump up to 8 MiB. A lexical reader skips COPY payloads, comments, strings and function
bodies while identifying table definitions. The user selects one to eight public,
unquoted tables. Only their limited CREATE TABLE / ADD CONSTRAINT / CREATE INDEX DDL is retained;
raw input and rows are not stored, archived or projected to a model. This adapter
rejects quoted names, string/dollar literals and selected unsupported default, sequence,
trigger or row-security dependencies rather than silently omitting them or rewriting
the source. Other dump dialects, sequence dependencies and literal defaults need
explicit adapters before acceptance.

Migration23 appends actor/project/source-bound immutable baseline records. A request
key is idempotent only for the same selected DDL. GET and inspect_project expose
summaries. The existing bounded/redacted read_project_file can read a baseline's
virtual path as untrusted source. No SQL authority comes from this read.
The existing source-credential policy also checks selected DDL against installation
and encrypted actor project secrets at import, read, proposal and execution. A value
newly registered as private cannot later escape through a previously saved schema.
Skipped COPY rows remain excluded and are not projected as source.

The existing v3/v4 runner target has an optional bootstrap plan. It binds exact source
SQL hashes or imported baseline IDs/hashes/bytes, plus at most eight ordinary NOLOGIN
role names and eight local schema names. Declaring schemas also grants the exact
ordinary app role CREATE on its disposable database, because PostgreSQL checks that
privilege even for CREATE SCHEMA IF NOT EXISTS. This is shown in the review and
grants no CREATEDB, role administration or access to another target. Historical plans without bootstrap keep
their canonical bytes. A fresh existing build approval binds the complete plan.
A failed job can propose prerequisites again with fresh approval while its runner,
API, schema and data oracles remain unchanged. An already successful job cannot
silently replace prerequisites.

The host revalidates imported bytes before worker execution. Only the existing
isolated fixture can prepare roles/schemas and apply baseline DDL as the exact
ordinary target owner before the unchanged project runner. Targets remain separate.
Baseline failure stops the runner and application. Root/observer identities,
external credentials and provider routes cannot be supplied by this contract.
There is no second approval engine or alternate deployment path.

## Limits

This operation reads no deployed database and applies nothing to Liara. The runner's
own ledger still owns migrations. A successful local receipt/artifact is not permission
to execute destination SQL or proof of the original complete Golestan application,
production data compatibility or provider persistence. Destination migration needs
its own exact resource/credential/runner authority and reconciliation contract.
