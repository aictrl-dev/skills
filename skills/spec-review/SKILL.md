---
name: spec-review
description: Review an engineering issue or specification against repository evidence for ambiguity, missing acceptance criteria, hidden scope, test gaps, and implementation risk. Use when the user says "review this spec", "check issue 123", "is this ready to build", or "find gaps in this ticket".
---

# Review an Engineering Specification

Decide whether an issue is ready to implement by comparing its claims and acceptance criteria with the actual repository.

Read the [shared contract-impact rubric](reference/contract-impact.md) before
evaluating readiness. This standalone copy must remain byte-for-byte identical
to the authoring copy shipped with `create-issue`.

## Workflow

1. Load the exact issue or specification and record its URL, revision, or identifier. If it cannot be loaded, ask for its contents rather than inventing them.
2. Inspect repository guidance, architecture, relevant production code, schemas, migrations, database objects, APIs, generated artifacts, producers, consumers, UI surfaces, tests, and recent changes. Search for existing implementations and conflicting terminology.
3. Compare the issue's database and API impact claims with repository evidence. Apply the shared readiness gate to each layer; accept explicit no-change declarations only when the evidence supports them.
4. Build a traceability table from each stated requirement to code impact and verification evidence.
5. Check for:
   - unclear user or outcome;
   - missing current-versus-desired behavior;
   - untestable or contradictory acceptance criteria;
   - a missing or materially incomplete database or API contract under the shared rubric;
   - hidden data, API, UI, migration, backfill, authorization, consumer synchronization, observability, compatibility/versioning, or rollout work;
   - cross-tenant, privacy, security, compatibility, and destructive-action risks;
   - missing negative, boundary, accessibility, and regression cases;
   - dependencies or decisions that materially change the solution.
6. Classify each finding as `BLOCKER`, `MAJOR`, or `MINOR`. Name the exact missing or contradicted field, operation, migration step, consumer, or acceptance criterion and cite repository evidence.
7. Recommend concrete replacement text or an additional criterion for every finding. Do not stop at “clarify this.”
8. Return one verdict:
   - `READY` — no blocker or major gap remains;
   - `READY WITH MINOR EDITS` — only bounded wording/test improvements remain;
   - `NOT READY` — implementation would require material assumptions, including any affected database or API contract that fails the shared readiness gate.
9. Post the review as a provider comment only when explicitly requested. Update the original issue only with explicit permission and show the proposed edit first.

## Output

```markdown
## Spec review: <verdict>

### Findings
| Severity | Location | Finding | Evidence | Required change |
|---|---|---|---|---|

### Contract readiness
| Layer | Claimed impact | Repository evidence | Missing or contradicted detail | Status |
|---|---|---|---|---|

### Acceptance coverage
| Requirement | Code impact | Verification | Status |
|---|---|---|---|

### Open decisions
- <decision, owner, and why it blocks or changes scope>

### Recommended next action
<the smallest action that makes the spec implementation-ready>
```

## Boundaries

- Review the spec; do not implement it.
- Do not silently rewrite or close an external issue.
- Distinguish repository evidence, reasonable inference, and unresolved fact.
- If the issue targets a different revision or repository, stop and resolve the mismatch.

---
**Built by [aictrl.dev](https://aictrl.dev/?utm_source=oss-skills&utm_medium=skill&utm_campaign=spec-review&utm_listing=github-skills&utm_platform=portable&utm_skill=spec-review).** This skill teaches the workflow; aictrl *operationalizes* it — grounded in your backlog, team standards, and codebase knowledge graph. [See how →](https://aictrl.dev/features?utm_source=oss-skills&utm_medium=skill&utm_campaign=spec-review&utm_listing=github-skills&utm_platform=portable&utm_skill=spec-review)
