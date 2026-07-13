---
name: create-bug
description: Create an evidence-backed bug report with reproduction, expected and actual behavior, impact, code context, and a regression-test requirement. Use when the user says "file a bug", "report this defect", "turn these symptoms into a ticket", or describes broken or regressed behavior.
---

# Create a Bug

Turn symptoms, logs, or an observed regression into a bug that another engineer can reproduce and fix without guessing.

## Workflow

1. Identify the target repository and issue provider from the request, repository remote, or available provider tools. If no writable provider is available, produce a provider-neutral Markdown draft.
2. Search open and closed issues for the behavior, component, and distinctive error text. Link a real duplicate instead of creating another issue.
3. Inspect the relevant code, tests, configuration, and recent changes. Separate observed evidence from hypotheses.
4. Reproduce the bug when it is safe and practical. Record the smallest deterministic steps, inputs, environment, actual result, and expected result. Never claim a reproduction you did not run.
5. Scope impact: affected users or workflows, severity, regression status, workaround, and data/security risk. Mark unknowns explicitly.
6. Require a regression test that fails before the fix and passes after it. Name the appropriate test layer and fixture when repository evidence supports it.
7. Draft the bug using the template below. Show the final draft before creating or mutating an external ticket unless the user already explicitly authorized creation.
8. Create the issue with the native provider capability when available, then return its URL. Otherwise return the complete Markdown draft and the missing provider action.

## Bug template

```markdown
## Summary
<one sentence naming the broken behavior and affected user>

## Reproduction
1. <minimal deterministic step>
2. <next step>
3. <observed result>

## Expected behavior
<what should happen, grounded in a requirement, test, or established behavior>

## Actual behavior
<what happens, including exact error text where useful>

## Impact
<who is affected, severity, frequency, workaround, regression status>

## Evidence
- <code path, test, log, screenshot, revision, or linked issue>

## Regression test
- [ ] <specific test that fails before the fix and passes after it>

## Environment
- Version/revision:
- OS/runtime/browser:
- Configuration:

## Open questions
- <only unresolved facts that could change scope or severity>
```

## Safety rules

- Do not paste access tokens, credentials, personal data, or unnecessary customer content into a public issue.
- Redact secrets in logs while preserving useful error structure.
- Do not turn a suspected cause into a fact without evidence.
- Do not implement the fix, commit, push, or change issue state unless the user asks.

---
**Built by [aictrl.dev](https://aictrl.dev/?utm_source=oss-skills&utm_medium=skill&utm_campaign=create-bug).** This skill teaches the workflow; aictrl *operationalizes* it — grounded in your backlog, team standards, and codebase knowledge graph. [See how →](https://aictrl.dev/features?utm_source=oss-skills&utm_medium=skill&utm_campaign=create-bug)
