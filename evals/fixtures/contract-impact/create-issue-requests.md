# Create-issue requests

Use each request with `repository-evidence.md`. These are product decisions and
requested outcomes; repository evidence supplies the current state and existing
conventions.

## Request A: persisted job expiration

Create an engineering issue to persist the cleanup deadline for completed jobs.

- Add `jobs.expires_at timestamptz NULL DEFAULT NULL`.
- A completion producer sets `expires_at = completed_at + interval '7 days'`.
- Add `CHECK (expires_at IS NULL OR completed_at IS NOT NULL)` and replace the
  current cleanup index with `jobs_cleanup_due_idx (expires_at, id) WHERE status
  = 'completed' AND expires_at IS NOT NULL`.
- Backfill completed rows whose expiration is null in ID-ordered batches of
  1,000. Each batch must be idempotent and commits its own progress so retry
  resumes from remaining null rows.
- Validate the completed/null count before the backfill, then require zero
  completed/null rows and sample `expires_at = completed_at + 7 days` after it.
- Deploy schema and generated database types first, then producers that write
  the field, then backfill, then enable cleanup reads. Old workers must keep
  using `completed_at`; new workers must tolerate null until validation passes.
- Preserve archive-before-delete behavior and all rows during migration. For
  recovery, disable the new cleanup path and restore the old worker; retain the
  additive column and data for a later reviewed migration.
- Cover exact schema/index definitions, populated migration, interruption and
  retry, mixed old/new worker versions, before/at/after time boundaries, and
  recovery with the repository commands.
- No API, event, RPC, SDK, or generated API artifact changes.

Draft only. No provider or writable issue target is supplied.

## Request B: project export API

Create an engineering issue for a REST `POST
/v1/projects/{project_id}/exports` operation with operation ID `exportProject`.

- Require bearer authentication, UUID `project_id`, and a JSON body with
  required `format: json | csv` plus optional `include_archived: boolean`
  defaulting to `false`. Reject unknown fields and invalid values.
- Return `200`; JSON exports return a project ID, generation timestamp, and
  complete redacted data, while CSV exports return the equivalent complete
  rows. Partial success is not allowed.
- Use the repository's exact bounded errors, permission `project.export`,
  non-disclosing cross-tenant behavior, redaction rules, audit boundary, five-
  request rolling-minute limit, 10 MiB response limit, timeout behavior, and
  retry-safe read semantics.
- This is an additive v1 operation. Update OpenAPI and checked-in generated
  client/types, publish them before consumers adopt `exportProject`, and do not
  alter existing operations.
- Ship behind `project_export_v1` through the documented stages. Roll back by
  disabling the gate; no data recovery is required.
- Use the repository commands for contract, integration, generated-artifact,
  authorization, tenant-isolation, redaction, exact/over-limit, timeout,
  gate-off/on, rollback, and old-client compatibility coverage.
- Existing persisted data is sufficient. No schema, stored-data behavior,
  migration, constraint, index, or database-owned object changes.

Draft only. No provider or writable issue target is supplied.

## Request C: dashboard copy

Create an engineering issue to make the dashboard empty-state copy clearer.
The exact replacement string has not been approved; the Product owner owns that
decision. Keep the populated state and all behavior unchanged.

Draft only. No provider or writable issue target is supplied.

## Request D: regressed report creation

Create an issue for this problem: after upgrading the application from 1.7 to
1.8, `POST /v1/reports` returns `500 INTERNAL_ERROR` for every authenticated
tenant. Version 1.7 returned `201` for the same request. The first failing
revision and exact cause are not yet known.

Draft only. No provider or writable issue target is supplied.
