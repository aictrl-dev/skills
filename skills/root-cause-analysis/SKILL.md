---
name: root-cause-analysis
description: Perform an evidence-driven root cause analysis of an incident, recurring defect, failed release, or reliability problem. Use when the user says "perform root-cause analysis", "do a five-whys analysis", "why did this happen", "analyze this incident systemically", "why does this keep recurring", or "find broader prevention opportunities".
---

# Root Cause Analysis

Find the conditions that made a failure possible, repeatable, or hard to
detect. A corrected line of code is evidence of the direct mechanism, not
automatically the root cause.

Read these before beginning:

- [RCA report template](reference/rca-template.md)
- [Causal quality gate](reference/causal-quality-gate.md)

## Boundaries

- Use this after stabilization, or alongside a separate incident-response
  process. If customers are actively affected, prioritize approved mitigation
  and evidence preservation; do not delay it for analysis.
- Work read-only by default. Do not change code, roll back, create issues, or
  publish an RCA unless the user explicitly authorizes that action.
- Use primary evidence where possible. Separate verified facts, inferences,
  and unknowns; never manufacture a complete causal chain from a plausible
  story.
- Be blameless without becoming vague. A person's action, "human error," or
  "someone forgot" is never a terminal cause—ask what made the action likely,
  reasonable, possible, or undetectable.

## Workflow

### 1. Establish the evidence boundary

Define the incident, release, or issue-set boundary. For multiple incidents,
state the complete corpus and the inclusion/exclusion criteria. Gather:

- observable failure, impact, and time boundary;
- intended invariant or contract;
- timelines, logs, metrics, screenshots, code, configuration, releases, and
  prior investigations;
- earlier or sibling failures that could share the same condition.

Build a fact ledger before a why-chain.

| Claim | Evidence and timestamp/revision | Status | Confidence | Gaps or contradiction |
|---|---|---|---|---|
| | | fact / inference / unknown | high / medium / low | |

### 2. State the failure and violated invariant

Write one falsifiable statement:

> When `<conditions>`, `<system>` produced `<observable result>`, violating
> `<expected invariant>`, with `<impact>`.

Distinguish symptom, trigger, direct mechanism, and impact. Trace the actual
execution and state transitions to find the first point where reality diverged
from the invariant, but label that point as a mechanism—not automatically as a
root cause.

### 3. Build outward causal branches

Move outward from the mechanism through enabling conditions, system contracts,
and operating-model or methodology conditions. Five is a prompt, not a quota;
branch when prevention, detection, containment, or recovery have different
causes. For every causal link, record:

- why the preceding condition could exist or escape;
- a specific cause statement and its evidence;
- the counterfactual: what would have prevented, contained, or detected it;
- recurrence scope and confidence.

Ask separately why the failure was possible, undetected before release,
uncontained at runtime, difficult to diagnose or recover from, and able to
recur in sibling systems.

Classify each conclusion as a root systemic cause, contributing condition,
trigger, failed/missing safeguard, consequence, or unresolved hypothesis.
Run the evidence, counterfactual, recurrence, control, and depth checks in the
[causal quality gate](reference/causal-quality-gate.md).

### 4. Search horizontally

Turn each validated cause into a failure signature and inspect adjacent systems,
workflows, releases, and components for the same shared condition. Label each
candidate **exposed**, **protected**, or **unknown** with evidence; do not infer
exposure from names alone.

### 5. Recommend and sequence actions

Keep actions distinct so a long-term initiative does not replace immediate
repair:

- **Containment** — reduce current impact or restore service.
- **Local correction** — repair the direct mechanism and add a regression test.
- **Systemic prevention** — enforce a shared invariant, abstraction, or
  platform capability.
- **Horizontal hardening** — remediate exposed siblings.
- **Methodology change** — change a decision gate, review practice, ownership,
  or release practice.
- **Detection and learning** — add invariant monitoring, leading indicators,
  drills, or review dates.

Map every action to cause IDs and specify the failure class reduced, accountable
owner type, priority, verification method, leading and lagging signals, and
residual risk. Prefer a small number of high-leverage initiatives over one
ticket per symptom.

Make a decision, not just a catalogue. Name one **recommended next action** for
the current state, then sequence the remaining actions. State:

- the exact action and why it is safer or more effective than the alternatives;
- required preconditions, authorization, and evidence to proceed;
- explicit stop conditions and the safe fallback if they are met;
- what not to do (for example, retries, bypasses, or irreversible changes that
  do not change the causal condition).

For an active incident, recommend containment or recovery first, then local and
systemic prevention. For insufficient evidence, recommend the smallest safe
evidence-gathering action rather than a speculative operational change. A
recommendation is not authorization: do not perform it without the user's
explicit approval.

### 6. Report the RCA

Use the [report template](reference/rca-template.md). Lead with the systemic
conclusion and highest-leverage initiatives, while making the direct fix visible
as containment or local correction. If evidence is insufficient, return an
interim RCA with explicit hypotheses and the smallest evidence-gathering next
actions.

## Avoid

- Ending with "the code was wrong," "there was no test," "a race condition,"
  "legacy code," "requirements were unclear," or "the reviewer missed it."
- Treating timing correlation, a plausible narrative, or a changed file as
  proof of causality.
- Delaying immediate containment for a long-term prevention proposal.
- Assigning personal blame or ownership without evidence and authorization.

## Output

Return the RCA using the report template, followed by:

```markdown
## Evidence status
| Claim | Evidence | Status | Confidence |
|---|---|---|---|

## Unresolved hypotheses
- <hypothesis and the evidence needed to resolve it>

## Recommended actions
1. **Recommended now:** <specific action, prerequisite, and intended result>
2. **Then:** <sequenced follow-up>

State the stop condition, safe fallback, and any authorization needed. If the
evidence does not support operational action, recommend the smallest
evidence-gathering action instead.
```

---
**Built by [aictrl.dev](https://aictrl.dev/?utm_source=oss-skills&utm_medium=skill&utm_campaign=root-cause-analysis&utm_listing=github-skills&utm_platform=portable&utm_skill=root-cause-analysis).** This skill teaches the workflow; aictrl *operationalizes* it — grounded in your backlog, team standards, and codebase knowledge graph. [See how →](https://aictrl.dev/features?utm_source=oss-skills&utm_medium=skill&utm_campaign=root-cause-analysis&utm_listing=github-skills&utm_platform=portable&utm_skill=root-cause-analysis)
