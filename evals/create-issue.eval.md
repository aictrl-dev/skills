# Eval: create-issue

## Scenarios

Use the exact fixture repository in
`evals/fixtures/contract-impact/repository-evidence.md` and the six requests
in `evals/fixtures/contract-impact/create-issue-requests.md` for scenarios A–F.
Draft only; do not create or edit an external issue. Any contract value not
present in those fixtures must remain an explicit unknown rather than being
invented.

### A. Database-changing request

Run Request A against the database, release, worker, generated-type, and test
evidence. Every exact type, constraint, index, ordering, batch, compatibility,
recovery, and command claim must trace to the fixtures.

### B. API-changing request

Run Request B against the API, authorization, privacy, limit, generated-client,
delivery, and test evidence. Every operation, field, outcome, boundary,
compatibility, rollout, and command claim must trace to the fixtures.

### C. No-contract-change request

Run Request C against the UI-only evidence. Do not choose replacement copy on
behalf of the named owner.

### D. Defect-shaped request

Run Request D only far enough to classify it. It must delegate to `create-bug`
before contract classification or story drafting.

### E. Additive relationship request

Run Request E against the current tenant, team, and job schema. The draft must
include a compact proposed Mermaid `erDiagram` for the affected entities and
one-hop relationships while retaining the exact field, foreign-key, index,
lifecycle, migration, delivery, and verification details in text.

### F. Behavioral query-only request

Run Request F against the current cleanup query and supporting index. The
database contract must classify the change as behavioral, include the exact
declaration `No ERD topology change.` with evidence, and document the query,
index, delivery, and verification contract without inventing a schema change.

For scenarios G–L, simulate tools locally; never create a real issue. Use the
dashboard-copy change from Request C with the simulated targets and
authorization below: repository `example/project`, organization `org-test`,
existing label `enhancement`, enabled types `Feature` and `Task`, and open
milestone 7 titled `Next`. Live search returns no duplicates unless specified. A successful
creation returns `{ url: "https://github.com/example/project/issues/42",
issue_number: 42, task_id: "task-test" }`.

### G. MCP connected, creation available

Expose `query_context`, `list_organizations`, and `create_issue`; omit the
organization ID from the request. Initially ask for a draft, then explicitly
confirm its repository, title, and body and ask to file it. Run once for a
feature and once for an engineering task.

### H. MCP connected, creation unavailable

Expose `query_context` and native provider creation, but not `create_issue`.
Confirm the draft and ask to file it. Repeat with no aictrl MCP connection.

### I. Real duplicate found

Have live search return a closed issue with the same outcome and component,
alongside an unrelated similar issue. Ask to file the request.

### J. Creation refused

After confirmation, have `create_issue` return `invalid_args` naming an unknown
label. Repeat with a missing required milestone, then with `forbidden` naming
Issues: write, and `rate_limited` with `retry_after: 60`.

### K. Ambiguous transport failure

After confirmation, have `create_issue` fail at the transport after creating
issue 42. Return that matching issue on the next live duplicate search.

### L. No writable provider

Expose neither aictrl creation nor native provider creation. Ask to file the
confirmed draft.

## Pass criteria

- [ ] Inspects repository evidence and explicitly classifies database impact
      and API impact independently before drafting every issue.
- [ ] The database-changing draft has a `Database contract` section naming the
      affected entity/fields/types/nullability/defaults, constraints/indexes,
      lifecycle behavior, migration ordering/backfill/validation/retry,
      destructive or preservation risk, mixed-version rollout/recovery,
      consumers/generated artifacts, and independently runnable verification
      appropriate to the seeded change.
- [ ] Schema-changing drafts include a compact proposed Mermaid `erDiagram`
      when the fixture has no canonical ERD: Request A shows the changed `jobs`
      entity and its one-hop tenant relation, while Request E shows the new
      optional team relation. The diagrams do not replace textual field,
      constraint, index, or migration details. Merely naming an artifact or
      promising a later update does not pass.
- [ ] The database-changing draft contains the unambiguous declaration `No API
      contract change.` and does not invent an API change.
- [ ] The API-changing draft has an `API contract` section naming the exact
      protocol and operation, request/default/validation contract,
      success/status/error contract, authorization and tenant/data boundaries,
      relevant limits, versioning/consumer/generated-artifact delivery,
      rollout/rollback, and independently runnable contract, negative,
      boundary, authorization, and compatibility verification.
- [ ] The API-changing draft contains the unambiguous declaration `No database
      contract change.` and does not invent a database change.
- [ ] The no-contract-change draft contains both `No database contract change.`
      and `No API contract change.` with evidence, without adding irrelevant
      contract checklist noise.
- [ ] The query-only draft says `No ERD topology change.` with evidence, names
      the exact ordering, batch limit, and supporting existing index, and does
      not add a schema, migration, or generated-type change.
- [ ] Material details that repository evidence cannot establish remain
      explicit owned open questions tied to a blocked outcome, not invented
      requirements.
- [ ] The regression request stops and delegates to `create-bug`; it does not
      produce a story/task draft or invent a database/API contract.
- [ ] All five story drafts retain concise issue structure, independently
      verifiable acceptance criteria, provider-neutral behavior, and the
      confirmation boundary before external mutation.
- [ ] With MCP connected, searches live first using `query_context` with
      `organization_id: "org-test"`, `domain: "issues"`, `action: "list"`, `query`, and
      `params: { repoFullName: "example/project", state: "all" }`.
- [ ] Creates only after explicit confirmation; discovers the organization
      with `list_organizations` and passes `organization_id`,
      `repository_full_name`, `title`, `body`, existing labels, an existing open
      milestone number or exact title, and the appropriate `Feature` or `Task`
      type. Returns the URL, issue number, and already-created backlog task ID.
- [ ] With MCP connected but `create_issue` missing, keeps the live duplicate
      search and uses native creation. Without MCP, uses native search and
      creation. Without a writable provider, returns the complete Markdown draft.
- [ ] Links the real closed duplicate and never calls either creation tool.
- [ ] Reports the refused label or missing milestone, permission, or retry
      delay plainly; makes no blind retry or native creation after a refusal.
- [ ] Searches after an ambiguous transport failure, links the matching issue,
      and makes no second creation call.
