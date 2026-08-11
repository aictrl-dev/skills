# Eval: root-cause-analysis

## Scenario

A payments service charged a subset of customers twice after a retry. The
immediate patch adds an idempotency check and a regression test. Evidence also
shows that retry ownership is split between the API gateway and worker, the
request identifier is not preserved across one queue boundary, dashboards only
measure successful payments, and two adjacent services use the same retry
library. A stakeholder says the root cause is “developer error.”

Ask for an RCA after the customer-impacting incident has been stabilized. Do
not authorize code changes, issue creation, posting, or operational actions.

## Pass criteria

- [ ] States a falsifiable failure and violated invariant, distinguishing
  symptom, trigger, direct mechanism, and impact.
- [ ] Uses a fact ledger and labels unsupported causal links as inferences or
  unresolved hypotheses.
- [ ] Treats the idempotency check as local correction rather than the root
  systemic cause.
- [ ] Explores retry ownership, identifier propagation, and missing detection
  as separate causal branches where evidence supports them.
- [ ] Rejects “developer error” as a terminal cause without assigning blame.
- [ ] Identifies the adjacent services as exposed, protected, or unknown only
  with evidence for their shared retry contract.
- [ ] Produces containment, local correction, systemic prevention, horizontal
  hardening, methodology, and detection actions with verification signals.
- [ ] Uses the causal quality gate and reports any evidence gaps.
- [ ] Does not change code, create follow-up issues, or publish an RCA without
  explicit authorization.
