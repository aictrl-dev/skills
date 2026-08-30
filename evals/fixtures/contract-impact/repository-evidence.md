# Contract-impact eval repository evidence

Treat this file as the complete inspected evidence packet for the evals. The
paths and excerpts represent a small fixture repository; do not fill gaps with
facts from the aictrl skills repository.

## Repository guidance

`docs/releases.md` says:

- PostgreSQL migrations deploy before application and worker processes.
- During a rolling release, the old and new process versions must both work
  with the migrated schema.
- Production migrations are forward-only. Recovery disables new behavior and
  restores the previous process version; a later reviewed migration removes
  unused schema.

`package.json` defines these independently runnable commands:

- `npm run test:schema`
- `npm run test:migrations -- jobs-expiration`
- `npm run test:migrations -- job-team-ownership`
- `npm run test:workers -- job-cleanup`
- `npm run test:workers -- job-create`
- `npm run test:contracts -- project-export`
- `npm run test:integration -- project-export`
- `npm run generate:db-types && git diff --exit-code generated/db.ts`
- `npm run generate:api && git diff --exit-code openapi/v1.yaml generated/api`

## Database evidence

`db/schema/jobs.sql` contains:

```sql
CREATE TYPE job_status AS ENUM ('queued', 'running', 'completed', 'failed');

CREATE TABLE jobs (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  status job_status NOT NULL DEFAULT 'queued',
  completed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'completed' OR completed_at IS NOT NULL)
);

CREATE INDEX jobs_cleanup_completed_idx
  ON jobs (completed_at, id)
  WHERE status = 'completed';
```

`db/schema/teams.sql` contains:

```sql
CREATE TABLE teams (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name text NOT NULL,
  UNIQUE (tenant_id, id)
);
```

The fixture repository has no canonical ERD artifact or Mermaid validation
command. A schema-changing issue therefore needs a compact proposed Mermaid
`erDiagram` plus textual schema details; the diagram can be reviewed as part of
the issue before implementation.

No role, grant, row policy, view, function, trigger, extension, ownership, or
execution-context change is planned for this fixture.

`generated/db.ts` represents `completed_at` as `Date | null` and contains no
expiration or job owner-team field. It contains the current `Team` shape.

`workers/job-create.ts` inserts the authenticated tenant ID and new job fields.
It does not currently accept or persist a team assignment.

`workers/job-cleanup.ts` selects completed jobs older than seven days through
`jobs_cleanup_completed_idx` without an explicit `ORDER BY` or batch limit,
archives their child artifacts, and then deletes the job. A retry reselects
remaining rows; archived child artifacts are not duplicated because their
archive key is the job ID.

`tests/migrations/jobs.test.ts` migrates both empty and populated pre-change
databases. `tests/workers/job-cleanup.test.ts` covers the current
archive-before-delete ordering, retry after interruption, and timestamps
immediately before, at, and after the cleanup threshold.

## API evidence

`openapi/v1.yaml` uses bearer authentication, UUID path identifiers, JSON
request bodies with unknown fields rejected, and these bounded errors:

| HTTP | Code |
|---|---|
| 400 | `INVALID_ARGUMENT` |
| 401 | `UNAUTHENTICATED` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 413 | `EXPORT_TOO_LARGE` |
| 429 | `RATE_LIMITED` |
| 504 | `EXPORT_TIMEOUT` |

`src/auth/project-policy.ts` defines permission `project.export`. It resolves a
project inside the authenticated tenant and returns the same `404 NOT_FOUND`
for a missing or cross-tenant project. A same-tenant caller without permission
receives `403 FORBIDDEN`.

`src/privacy/export-redaction.ts` removes `credentials`, `internal_notes`, and
member `private_email` values. `src/audit/project-events.ts` logs tenant, actor,
project, outcome, and error code but never request bodies or exported content.

`config/api-limits.ts` sets project export to five requests per actor and tenant
per rolling minute and a maximum response size of 10 MiB. Exceeding the request
limit returns `429 RATE_LIMITED`; exceeding the response limit returns
`413 EXPORT_TOO_LARGE` with no partial body. A timeout returns
`504 EXPORT_TIMEOUT` with no partial body. The read-only operation is safe to
retry and needs no idempotency key or pagination.

`generated/api/` contains the checked-in TypeScript client and types generated
from `openapi/v1.yaml`. Existing v1 additions are backward compatible when they
add an operation and do not alter existing operations.

`src/flags.ts` defines boolean gate `project_export_v1`, default `false`,
evaluated for the authenticated tenant before the export handler. Delivery
stages are internal, selected tenants, then general availability. Disabling the
gate is the supported rollback and returns the existing route-disabled `404`.

## UI-only evidence

`web/src/dashboard/EmptyState.tsx` renders the local literal `No projects` when
the project list is empty. It imports no API client, storage adapter, generated
type, or event publisher.

`web/src/dashboard/EmptyState.test.tsx` covers empty and populated states. Run
it independently with:

`npm run test:web -- EmptyState`

No schema, migration, stored data, database object, API definition, request,
response, event, RPC, SDK, or generated artifact participates in this render
path.
