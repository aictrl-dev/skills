---
name: reply-to-code-review
description: Judge current-head review findings, fix accepted defects, run verification, post evidence-backed replies, and request bounded re-review. Use when the user says "address review comments", "reply to code review", "fix accepted findings", or "get this PR through review".
---

# Reply to Code Review

Turn review feedback into verified remediation and concise, evidence-backed responses without creating an unbounded fix/review loop.

## Workflow

1. Resolve the repository, request identifier, and exact current head SHA. Preserve unrelated worktree changes and load repository guidance.
2. Gather unresolved findings for the current head. Mark older-head findings stale and revalidate any concern that may still apply.
3. Apply the `judge-review-findings` procedure: assign TRUE/FALSE/UNCERTAIN and FIX/DEFER/IGNORE with evidence. If that skill is available, invoke it rather than duplicating stored judgments.
4. Present the remediation set when it contains a material scope, behavior, security, or compatibility decision. Never use “fix all” to bypass required user choices.
5. For each accepted `FIX`:
   - make the smallest complete change that resolves the root cause;
   - add or update a test that would fail without the fix;
   - avoid drive-by refactors and unrelated cleanup.
6. Run focused checks after each cluster, then broader tests, lint, type checks, build, and required CI in proportion to risk.
7. Re-read the changed diff and verify every accepted finding against the current head. If the head changed externally, refresh and rejudge before replying.
8. Commit and push only when authorized. Post one concise response per finding or a structured summary supported by exact code/test evidence.
9. Request re-review once per remediation round. Bound the loop by the user's time/cost limit or a default of two rounds. Escalate unresolved, contradictory, or newly expanding feedback.
10. Stop at addressed findings and green required checks. Do not merge or deploy unless separately authorized.

## Response format

```markdown
| Finding | Verdict / action | Resolution | Verification |
|---|---|---|---|
| <id> | TRUE · FIX | <path and behavior changed> | `<command>` — PASS |
| <id> | FALSE · IGNORE | <evidence-backed rationale> | <code/test evidence> |
| <id> | TRUE · DEFER | <reason and follow-up URL> | <risk boundary> |
```

## Boundaries

- Do not fix findings from a stale head without revalidation.
- Do not mark tests or CI green unless observed.
- Do not dismiss true findings without a documented defer decision.
- Do not expose secrets, private source, or sensitive logs in public replies.
- Do not create endless automated reviewer loops.

---
**Built by [aictrl.dev](https://aictrl.dev/?utm_source=oss-skills&utm_medium=skill&utm_campaign=reply-to-code-review&utm_listing=github-skills&utm_platform=portable&utm_skill=reply-to-code-review).** This skill teaches the workflow; aictrl *operationalizes* it — grounded in your backlog, team standards, and codebase knowledge graph. [See how →](https://aictrl.dev/features?utm_source=oss-skills&utm_medium=skill&utm_campaign=reply-to-code-review&utm_listing=github-skills&utm_platform=portable&utm_skill=reply-to-code-review)
