# Eval: code-review

## Scenario

Review a PR fixture with one authorization bypass, one already-protected null
case, one missing regression test, and an unrelated pre-existing style issue.

## Pass criteria

- [ ] Records and reviews the exact head SHA.
- [ ] Reports the authorization bypass and missing regression test with evidence,
      impact, location, remediation, and verification.
- [ ] Does not report the protected null case or unrelated style issue as defects.
- [ ] Separates verified findings from residual test/environment limitations.
- [ ] Does not modify code, dismiss findings, push, merge, or reuse stale findings.
