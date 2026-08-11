# Causal Quality Gate

Run this gate after drafting the RCA. A failed critical check means the analysis
is interim, regardless of how polished it looks.

## Critical checks

- [ ] The boundary and evidence corpus are explicit.
- [ ] The problem statement is observable and falsifiable.
- [ ] The violated invariant is independent of the implementation.
- [ ] Facts, inferences, and unknowns are visibly separated.
- [ ] The direct defect is labelled as a mechanism, not automatically as root cause.
- [ ] Every accepted causal link has evidence and a counterfactual.
- [ ] The analysis reaches a controllable system, operating-model, or methodology condition.
- [ ] It asks why the failure was possible, undetected, uncontained, and difficult to recover from.
- [ ] It preserves separate branches where one chain would hide differences.
- [ ] The horizontal search labels siblings with evidence.
- [ ] Every initiative maps back to a cause ID.
- [ ] Systemic prevention and methodology changes are distinct from containment and local correction.
- [ ] One recommended next action is explicit, sequenced before longer-term work, and justified against alternatives.
- [ ] The recommendation names its preconditions, stop condition, safe fallback, and any required authorization.
- [ ] Success signals can show whether recurrence risk is decreasing.

## Shallow-analysis rejection tests

| Shallow answer | Required outward question |
|---|---|
| The wrong line, branch, or value was committed | What contract, type, invariant, review, or guardrail allowed invalid behavior to be representable and releasable? |
| There was no test | Why did the test strategy and risk model omit this state, transition, or boundary? |
| Human error or someone forgot | What conditions made the action likely, reasonable, possible, and undetected? |
| A race condition occurred | Which ownership, atomicity, idempotency, ordering, or reconciliation contract was absent or unenforced? |
| The cache was stale | Which identity, scope, invalidation, or source-of-truth contract allowed stale state to remain authoritative? |
| Requirements were unclear | Why could ambiguity survive specification, design review, acceptance criteria, and release validation? |
| The reviewer missed it | Why was correctness dependent on unaided memory instead of an enforceable contract or check? |

## Causal-link tests

For every root or contributing cause, answer:

1. What primary evidence supports the link?
2. What would have changed if the condition were absent?
3. How did the condition influence the next event?
4. Which other systems share it?
5. Who can change it, through what mechanism?
6. What evidence could strengthen or falsify it?

Prefer "contributed to," "made possible," or "failed to contain" when the
evidence does not support necessary or sufficient causality.

## Initiative quality checks

- [ ] Immediate restoration is not delayed by a long-term initiative.
- [ ] The action plan chooses a current-state recommendation rather than only listing valid initiatives.
- [ ] Repeated retries, unsafe bypasses, or irreversible changes are explicitly ruled out when they cannot change the causal condition.
- [ ] The local regression test reproduces the triggering failure.
- [ ] The systemic initiative removes or enforces a shared condition.
- [ ] Sibling remediation has a bounded discovery and rollout plan.
- [ ] Methodology changes name the decision point, artifact, gate, or ownership mechanism that will change.
- [ ] Detection covers absence and contradiction, not only explicit failures.
- [ ] Leading indicators measure adoption of the safeguard.
- [ ] Lagging indicators measure recurrence and user or operational impact.
- [ ] Residual risk and containment strategy are explicit.

## Final scoring

Score each dimension from 0 to 2: evidence, depth, causal rigor, horizontal
reach, action leverage, and measurability.

- **10–12:** decision-ready RCA.
- **7–9:** useful interim RCA with named evidence gaps.
- **0–6:** shallow analysis; continue investigating before planning initiatives.
