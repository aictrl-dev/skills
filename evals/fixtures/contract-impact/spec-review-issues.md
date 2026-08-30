# Specifications to review

Review each issue against `repository-evidence.md`. The omissions are
intentional; do not repair them silently or fill them with invented values.
The evidence establishes current behavior and repository conventions, but it
intentionally does not choose Issue A's desired field shape/index or Issue B's
exact operation/request/response shape. Those material values must become
owned decisions that name the blocked outcome.

## Issue A: persist job expiration

### Context

Completed jobs are cleaned up after seven days, but the deadline is not stored.

### Goal

Persist the expiration timestamp and use it for cleanup.

### Proposed approach

Add an `expires_at` field to `jobs`, backfill existing completed jobs, and make
the cleanup worker use the field.

### Database contract

Impact: additive.

- Add `jobs.expires_at`.
- Backfill existing completed jobs.

### API contract

No API contract change.

### Acceptance criteria

- [ ] Completed jobs store an expiration timestamp.
- [ ] Existing completed jobs are backfilled.
- [ ] Cleanup uses the new timestamp.
- [ ] Tests pass.

### Out of scope

- API changes.

## Issue B: add project export

### Context

Users need to export existing project data.

### Goal

Add an authenticated project export endpoint.

### Proposed approach

Add an export endpoint that returns happy-path JSON.

### Database contract

No database contract change.

### API contract

Impact: additive.

- Add an authenticated export endpoint.
- Return project data as JSON.

### Acceptance criteria

- [ ] An authenticated user can export a project.
- [ ] The happy path returns JSON.

### Out of scope

- Database changes.

## Issue C: update dashboard empty-state copy

### Context

`web/src/dashboard/EmptyState.tsx` currently renders `No projects`, which does
not tell a new user what to do next.

### Goal

Render `No projects yet. Create a project to get started.` in the empty state.

### Proposed approach

Change only the local text literal and its focused component assertion.

### Database contract

No database contract change.

The component has no persistence or database dependency.

### API contract

No API contract change.

The component makes no request and changes no response, event, RPC, SDK, or
generated client.

### Acceptance criteria

- [ ] The empty state renders `No projects yet. Create a project to get
      started.` with exact punctuation and capitalization.
- [ ] The populated dashboard state remains unchanged.
- [ ] `npm run test:web -- EmptyState` passes without API-mock or behavior
      changes.

### Out of scope

- Styling, layout, CTA behavior, localization, persistence, and API work.

### Risks and dependencies

- None identified from the supplied evidence.

### Open questions

- None.
