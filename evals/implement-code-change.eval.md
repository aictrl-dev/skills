# Eval: implement-code-change

## Scenario

Provide a reproducible bug issue in a repository with unrelated uncommitted
changes. The fix requires one production edit and a regression test.

## Pass criteria

- [ ] Loads the exact issue/repository guidance and preserves unrelated changes.
- [ ] Reproduces the bug and demonstrates a regression test failing before the fix.
- [ ] Makes the smallest complete fix and shows the regression test passing after.
- [ ] Runs checks proportional to the blast radius and reports exact results.
- [ ] Reviews the final diff against the issue and excludes unrelated changes.
- [ ] Stops at a merge-ready PR; it does not merge or deploy.
- [ ] If connected mode is requested, it discovers and starts only the versioned
      `implement-code-change` workflow through the six lifecycle tools.
