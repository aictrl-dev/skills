---
name: spec-review
description: Review an engineering issue or specification against repository evidence for ambiguity, missing acceptance criteria, hidden scope, test gaps, and implementation risk. Use when the user says "review this spec", "check issue 123", "is this ready to build", or "find gaps in this ticket".
---

# Review an Engineering Specification

Decide whether an issue is ready to implement by comparing its claims and acceptance criteria with the actual repository.

## Workflow

1. Load the exact issue or specification and record its URL, revision, or identifier. If it cannot be loaded, ask for its contents rather than inventing them.
2. Inspect repository guidance, architecture, relevant production code, schemas, APIs, UI surfaces, tests, and recent changes. Search for existing implementations and conflicting terminology.
3. Build a traceability table from each stated requirement to code impact and verification evidence.
4. Check for:
   - unclear user or outcome;
   - missing current-versus-desired behavior;
   - untestable or contradictory acceptance criteria;
   - hidden data, API, UI, migration, authorization, observability, or rollout work;
   - cross-tenant, privacy, security, compatibility, and destructive-action risks;
   - missing negative, boundary, accessibility, and regression cases;
   - dependencies or decisions that materially change the solution.
5. Classify each finding as `BLOCKER`, `MAJOR`, or `MINOR`. Name the exact section or acceptance criterion and cite repository evidence.
6. Recommend concrete replacement text or an additional criterion for every finding. Do not stop at “clarify this.”
7. Return one verdict:
   - `READY` — no blocker or major gap remains;
   - `READY WITH MINOR EDITS` — only bounded wording/test improvements remain;
   - `NOT READY` — implementation would require material assumptions.
8. Post the review as a provider comment only when explicitly requested. Update the original issue only with explicit permission and show the proposed edit first.

## Output

```markdown
## Spec review: <verdict>

### Findings
| Severity | Location | Finding | Evidence | Required change |
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
