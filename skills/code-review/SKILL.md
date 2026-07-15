---
name: code-review
description: Review the exact head revision of a pull request for actionable correctness, security, reliability, performance, and test findings without modifying code. Use when the user says "review this PR", "do a code review", "find defects in this change", or provides a pull or merge request identifier.
---

# Review a Code Change

Produce high-signal findings for the exact pull or merge request revision. Review only; do not fix code.

## Workflow

1. Resolve the repository, request identifier, base revision, and exact head SHA. Record the SHA in the review so stale findings are detectable.
2. Load repository guidance and the request description, linked issue, commits, changed files, tests, and CI state. Inspect surrounding production code rather than judging the diff in isolation.
3. Build a change map: entry points, data and control flow, public contracts, persistence, authorization, failure paths, concurrency, and test coverage.
4. Review for concrete defects in:
   - behavior and requirement coverage;
   - security, privacy, authorization, and tenant isolation;
   - error handling, retries, idempotency, concurrency, and cleanup;
   - data/schema compatibility, migration, and rollback;
   - performance and resource bounds;
   - API/type/UI consistency and accessibility;
   - missing negative, boundary, regression, and integration tests.
5. Run focused verification when safe. Never present a theoretical concern as reproduced behavior.
6. Before reporting a finding, prove that it is introduced or exposed by the reviewed change, has a specific impact, and is not already prevented elsewhere.
7. Assign `BLOCKER`, `MAJOR`, `MINOR`, or `NIT`. Include file/line, evidence, failure scenario, and the smallest sound remediation.
8. Return findings only. If none meet the bar, say so and list residual test or environment limitations.
9. Post a provider review only when the user explicitly asks. Bind the posted review to the recorded head SHA.

## Finding format

```markdown
### [MAJOR] <imperative, specific title>
- Revision: `<head-sha>`
- Location: `path/to/file.ext:line`
- Evidence: <what the changed code does>
- Impact: <observable failure or risk>
- Fix: <smallest sound remediation>
- Verification: <test or check that proves the fix>
```

## Boundaries

- Do not edit code, commit, push, dismiss findings, or merge.
- Do not report style preferences unless they create a documented correctness or maintenance risk.
- Do not reuse findings from an older head without revalidating them.
- Separate verified defects from residual risk and untested hypotheses.

---
**Built by [aictrl.dev](https://aictrl.dev/?utm_source=oss-skills&utm_medium=skill&utm_campaign=code-review&utm_listing=github-skills&utm_platform=portable&utm_skill=code-review).** This skill teaches the workflow; aictrl *operationalizes* it — grounded in your backlog, team standards, and codebase knowledge graph. [See how →](https://aictrl.dev/features?utm_source=oss-skills&utm_medium=skill&utm_campaign=code-review&utm_listing=github-skills&utm_platform=portable&utm_skill=code-review)
