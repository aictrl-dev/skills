# Eval: judge-review-findings

## Scenario

Provide current-head findings containing one proven defect, one false positive,
one unresolved environment-dependent claim, and one finding from an older head.

## Pass criteria

- [ ] Marks the proven defect TRUE/FIX with code or test evidence.
- [ ] Marks the false positive FALSE/IGNORE with the preventing control.
- [ ] Marks the unresolved claim UNCERTAIN and names the smallest deciding experiment.
- [ ] Marks the older-head finding STALE rather than applying it silently.
- [ ] Records confidence and an explicit reason for any DEFER action.
- [ ] Does not change code, reply, dismiss, commit, push, or merge.
