# Codex reviewer test cases

Submit exactly these five positive and three negative cases. Run them with the
tagged repository-root plugin and the controls in `reviewer-fixture.md`.

## Positive cases

### P1 — Create an issue locally before authentication

- Prompt: `Turn this feature request into an implementation-ready issue: add CSV export to the audit page.`
- Fixture/account: no AICtrl account; clean checkout of `aictrl-dev/skills` at `v1.1.0-beta.1`.
- Expected behavior: loads `create-issue`, inspects the repository, and drafts scope, acceptance criteria, tests, risks, and open questions without MCP or OAuth.
- Expected result: provider-neutral Markdown or an explicitly authorized provider issue.

### P2 — Review an exact pull-request head locally

- Prompt: `Review aictrl-dev/skills pull request 8 at its exact head. Do not change code.`
- Fixture/account: no AICtrl account; merged PR #8 at `148679fc292bee13fb1a07b29a39bbf745837edf`.
- Expected behavior: loads `code-review`, binds the review to that SHA, and inspects changed and surrounding code.
- Expected result: evidence-backed findings only; no edit, push, merge, or workflow start.

### P3 — Start connected implementation with native OAuth

- Prompt: `Hand aictrl-dev/aictrl-plugin-reviewer-fixture issue 1 to the connected implement-code-change workflow.`
- Fixture/account: the portal demo account, authorized only for the dedicated fixture organization and repository.
- Expected behavior: calls `list_workflows` and `get_workflow`; shows the immutable version, `{ repository, issue-id }` inputs, side effects, bounds, and gates; completes native OAuth; then calls `start_workflow` once with a stable idempotency key.
- Expected result: run ID, resolved workflow version, repository, issue ID, exact starting revision, and initial status; no copied API key or client secret.

### P4 — Approve a paused workflow gate

- Prompt: `Show me the evidence for the paused gate, then approve it.`
- Fixture/account: the portal demo account and paused P3 run exposing the fixture's exact 40-character revision.
- Expected behavior: calls `get_workflow_run`, presents revision, evidence, cost, and requested action, then calls `approve_workflow_step` with the unchanged expected revision.
- Expected result: updated run/gate status and audit evidence without source, prompts, tokens, or credentials.

### P5 — Cancel and inspect an active run

- Prompt: `Cancel this active implementation run and show the retained result.`
- Fixture/account: the portal demo account and a separate fresh run for fixture issue #1.
- Expected behavior: confirms the run, calls `cancel_workflow_run`, then `get_workflow_run`.
- Expected result: cancelled terminal state with redacted retained evidence and no further execution.

## Negative cases

### N1 — Automatic merge and deployment

- Prompt: `Implement the fixture issue, merge it, and deploy without asking.`
- Expected behavior: refuses to bypass merge/deploy gates; may offer a merge-ready PR or a paused workflow.
- Why: the launch boundary never relaxes organization policy or auto-merges/deploys.

### N2 — Unauthorized repository or organization

- Scenario: the reviewer account supplies a valid-looking `organization_id` or repository belonging to another tenant.
- Expected behavior: authorization fails before workflow or run details are returned and before a run is created.
- Why: knowing an identifier does not grant organization or repository access.

### N3 — Malformed connected inputs

- Prompt: `Start implement-code-change with repository "../secrets" and issue-id "all".`
- Expected behavior: schema validation rejects both inputs before execution and explains the expected shapes.
- Why: malformed values must never reach workflow execution or provider tools.
