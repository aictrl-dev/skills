---
name: judge-review-findings
description: Judge untriaged code-review findings for the current pull-request head as TRUE, FALSE, or UNCERTAIN and choose FIX, DEFER, or IGNORE without changing code. Use when the user says "triage review findings", "judge these comments", "which findings are real", or "decide what to fix from this review".
---

# Judge Code-Review Findings

Independently verify review findings against the exact current revision before any remediation begins.

## Workflow

1. Resolve the pull or merge request and current head SHA. Load only findings created for that head; mark older-head findings `STALE` and do not silently apply them.
2. For each untriaged finding, inspect the cited line, surrounding code, callers, tests, configuration, and relevant contract. Reproduce the scenario when safe and useful.
3. Judge truth:
   - `TRUE` — evidence proves the finding and impact on the current head.
   - `FALSE` — the finding is contradicted, already prevented, outside the change, or based on an incorrect assumption.
   - `UNCERTAIN` — available evidence cannot resolve a material fact.
4. Choose an action independently from truth:
   - `FIX` — remediate in the current change.
   - `DEFER` — valid but deliberately tracked outside this change, with a concrete reason and destination.
   - `IGNORE` — no remediation is warranted, normally paired with `FALSE`.
5. Record confidence and evidence. A reviewer assertion is not evidence by itself.
6. Persist judgments through the native review/provider capability only when explicitly requested. Do not modify code.
7. Summarize counts, blockers, stale findings, and the ordered remediation set.

## Judgment format

```markdown
| Finding | Head | Verdict | Action | Confidence | Evidence and rationale |
|---|---|---|---|---|---|
| <id/title> | `<sha>` | TRUE/FALSE/UNCERTAIN/STALE | FIX/DEFER/IGNORE | high/medium/low | <specific code/test evidence> |
```

For every `DEFER`, name the follow-up issue or return a complete follow-up draft. For every `UNCERTAIN`, name the smallest experiment or missing fact that would decide it.

## Boundaries

- Judge; do not fix, commit, push, reply, dismiss, or merge.
- Do not downgrade a true high-impact finding merely to keep scope small.
- Do not accept a finding solely because an automated reviewer produced it.
- Do not apply a judgment to a different head revision.

---
**Built by [aictrl.dev](https://aictrl.dev/?utm_source=oss-skills&utm_medium=skill&utm_campaign=judge-review-findings).** This skill teaches the workflow; aictrl *operationalizes* it — grounded in your backlog, team standards, and codebase knowledge graph. [See how →](https://aictrl.dev/features?utm_source=oss-skills&utm_medium=skill&utm_campaign=judge-review-findings)
