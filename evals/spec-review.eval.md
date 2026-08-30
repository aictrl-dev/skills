# Eval: spec-review

## Scenarios

Use the exact fixture repository in
`evals/fixtures/contract-impact/repository-evidence.md` and review the three
issue bodies in `evals/fixtures/contract-impact/spec-review-issues.md`. Review
only; do not edit the issue or implement the requested change. Findings must
cite these concrete issue locations and evidence; unsupported values must be
owned open decisions rather than invented replacement text.

### A. Incomplete database contract

Review Issue A. Its API no-change declaration is supported, but its database
contract omits the exact field shape, constraint/index, lifecycle, migration,
delivery, consumer, recovery, and verification details present in the fixture.

### B. Incomplete API contract

Review Issue B. Its database no-change declaration is supported, but its API
contract omits the exact operation/request/response, authorization, privacy,
errors, limits, compatibility, client delivery, rollout, rollback, and
verification details present in the fixture.

### C. Supported no-change declarations

Review Issue C. Its exact desired copy, verification, boundaries, and both
no-change declarations are supported by the fixture.

## Pass criteria

- [ ] Inspects repository schemas, migrations, database objects, APIs,
      generated artifacts, consumers, code, and tests rather than reviewing
      prose alone.
- [ ] Maps every stated criterion to code impact and verification evidence and
      reports database and API contract readiness independently.
- [ ] Returns `NOT READY` for the incomplete database case and names every
      applicable seeded schema, index/lifecycle, migration/backfill/retry,
      mixed-version/recovery, consumer-sync, and verification gap.
- [ ] Returns `NOT READY` for the incomplete API case and names every applicable
      seeded operation/request, authorization/tenant/privacy, error/limit,
      compatibility/versioning, generated-client delivery, rollout/rollback,
      and negative/boundary/compatibility-test gap.
- [ ] Every contract finding identifies the exact issue location and repository
      evidence, then supplies concrete replacement text, an additional
      independently verifiable acceptance criterion, or owned decision text
      naming the blocked outcome when evidence cannot establish the value.
- [ ] Accepts both no-change declarations in the copy-only case without
      inventing contract work and returns `READY` when no other blocker or
      major gap remains.
- [ ] Classifies findings by severity and returns only `READY`, `READY WITH
      MINOR EDITS`, or `NOT READY` with justification consistent with the
      readiness rubric.
- [ ] Does not edit the issue or implement code without explicit permission.
