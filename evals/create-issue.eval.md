# Eval: create-issue

## Scenarios

Use the exact fixture repository in
`evals/fixtures/contract-impact/repository-evidence.md` and the four requests
in `evals/fixtures/contract-impact/create-issue-requests.md`. Draft only; do not
create or edit an external issue. Any contract value not present in those
fixtures must remain an explicit unknown rather than being invented.

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

## Pass criteria

- [ ] Inspects repository evidence and explicitly classifies database impact
      and API impact independently before drafting every issue.
- [ ] The database-changing draft has a `Database contract` section naming the
      affected entity/fields/types/nullability/defaults, constraints/indexes,
      lifecycle behavior, migration ordering/backfill/validation/retry,
      destructive or preservation risk, mixed-version rollout/recovery,
      consumers/generated artifacts, and independently runnable verification
      appropriate to the seeded change.
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
- [ ] Material details that repository evidence cannot establish remain
      explicit owned open questions tied to a blocked outcome, not invented
      requirements.
- [ ] The regression request stops and delegates to `create-bug`; it does not
      produce a story/task draft or invent a database/API contract.
- [ ] All three story drafts retain concise issue structure, independently
      verifiable acceptance criteria, provider-neutral behavior, and the
      confirmation boundary before external mutation.
