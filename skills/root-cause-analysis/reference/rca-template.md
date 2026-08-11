# Root Cause Analysis Report Template

Adapt the sections to the available evidence. Do not remove uncertainties to
make the report appear complete.

## Executive conclusion

State the systemic cause, the failure class it explains, and the highest-leverage
prevention initiatives in one or two sentences.

## Boundary and evidence

- Incident, release, or issue-set boundary:
- Included and excluded evidence:
- Revisions and environments:
- Primary evidence:
- Important evidence gaps:

## Impact and violated invariant

> When `<conditions>`, `<system>` produced `<observable result>`, violating
> `<expected invariant>`, with `<impact>`.

- User or operational impact:
- Duration and scope:
- Detection source:

## Timeline

| Time/revision | Event | State transition | Evidence |
|---|---|---|---|
| | | | |

## Direct technical mechanism

Describe the first decision or state transition that diverged from the intended
contract. This is the proximal mechanism, not automatically the root cause.

## Outward causal branches

| Cause ID | Level | Why question | Evidence-backed cause | Counterfactual | Recurrence scope | Confidence |
|---|---|---|---|---|---|---|
| C1 | Mechanism | | | | | |
| C2 | Enablement | | | | | |
| C3 | System | | | | | |
| C4 | Operating model | | | | | |
| C5 | Principle/methodology | | | | | |

## Causal classification

### Root systemic causes

- `<cause ID>` — `<cause statement and why it qualifies>`

### Contributing conditions, triggers, and missing safeguards

- `<cause ID or trigger>` — `<condition>`

### Unresolved hypotheses

| Hypothesis | Evidence for | Evidence against or missing | How to resolve |
|---|---|---|---|
| | | | |

## Horizontal exposure

Define the reusable failure signature before listing siblings.

> Any `<system type>` that `<shared condition>` can `<failure mode>` because
> `<missing contract or safeguard>`.

| Sibling system or path | Exposed / protected / unknown | Evidence | Follow-up |
|---|---|---|---|
| | | | |

## Recommended actions

Choose and justify one action for the current state; do not leave the reader to
infer a priority from a portfolio.

- **Recommended now:**
- **Why this over the alternatives:**
- **Preconditions and required authorization:**
- **Stop condition and safe fallback:**
- **Do not:**

| Sequence | Action | Action class | Cause IDs | Decision criteria | Verification / success signal |
|---|---|---|---|---|---|
| 1 | | Containment / recovery / evidence gathering | | | |
| 2 | | Local correction / systemic prevention | | | |
| 3 | | Horizontal hardening / methodology / detection | | | |

## Prevention portfolio

| Initiative | Action class | Cause IDs | Failure class reduced | Priority | Owner type | Verification | Success signals | Residual risk |
|---|---|---|---|---|---|---|---|---|
| | Containment | | | | | | | |
| | Local correction | | | | | | | |
| | Systemic prevention | | | | | | | |
| | Horizontal hardening | | | | | | | |
| | Methodology change | | | | | | | |
| | Detection and learning | | | | | | | |

## Sequencing and measurement

1. Immediate containment:
2. Near-term systemic safeguards:
3. Horizontal rollout:
4. Methodology or governance change:
5. Review point and exit criteria:

- Leading indicators:
- Lagging indicators:
- Zero-tolerance invariants:
- Evidence that would invalidate this RCA:
