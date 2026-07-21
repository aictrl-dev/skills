# Codex reviewer test cases

Submit exactly these five positive and three negative cases. Run them with the
production `https://aictrl.dev/mcp` endpoint and the least-privilege portal demo
account described in `reviewer-fixture.md`.

## Positive cases

### P1 — Discover organizations and workflows

- Prompt: `List my aictrl.dev organizations and show the published workflows available across them. Identify the organization that owns implement-code-change.`
- Fixture/account: the portal demo account, authorized only for the dedicated `Plugin Reviewer` organization and repository.
- Expected behavior: calls `list_organizations` and `list_workflows` without changing any project or workflow data.
- Expected result: returns only organizations and published workflows accessible to the reviewer and identifies `Plugin Reviewer` as the owner of `implement-code-change`.

### P2 — Search connected code

- Prompt: `In my Plugin Reviewer organization, search the connected code for implement-code-change and show the matching file path.`
- Fixture/account: the portal demo account and the connected `aictrl-dev/aictrl-plugin-reviewer-fixture` repository.
- Expected behavior: calls `list_organizations` and `query_context` in the `code` domain without changing repository or project data.
- Expected result: returns `.aictrl/workflows/implement-code-change.yaml` as the matching file.

### P3 — Inspect a stable private epic

- Prompt: `In my Plugin Reviewer organization, show the epic "Publishing OpenAI Codex Plugin" and its tasks.`
- Fixture/account: the portal demo account and the dedicated private backlog fixture documented in `reviewer-fixture.md`.
- Expected behavior: calls `list_organizations` and `query_context` in the `backlog` domain.
- Expected result: returns the active epic and its draft task `OpenAI plugin reviewer fixture task` without exposing another organization's backlog.

### P4 — Apply a repeatable backlog update

- Prompt: `In my Plugin Reviewer organization, find "OpenAI plugin reviewer fixture task" under "Publishing OpenAI Codex Plugin" and reset it to a draft, low-complexity story tagged openai-review-fixture. Keep its existing title and description.`
- Fixture/account: the portal demo account and the dedicated private backlog fixture documented in `reviewer-fixture.md`.
- Expected behavior: calls `list_organizations`, `query_context`, and `update_backlog`; writes only the repeatable fixture values requested by the prompt.
- Expected result: updates only the dedicated fixture task and returns its task and epic identifiers with `draft` status.

### P5 — Inspect and start a bounded workflow

- Prompt: `In my Plugin Reviewer organization, inspect implement-code-change, show its inputs, side effects, and manual gate, then start it for aictrl-dev/aictrl-plugin-reviewer-fixture issue 1 using the stable idempotency key openai-plugin-review-fixture-v1. Show the initial run status and do not approve the gate.`
- Fixture/account: the portal demo account, open fixture issue #1, and the published repository-owned workflow.
- Expected behavior: calls `list_organizations`, `list_workflows`, `get_workflow`, `start_workflow`, and `get_workflow_run`; starts or reuses exactly one run and does not approve its gate.
- Expected result: shows the workflow's declared bounds and reports the run ID, version, current stage, and status without approving repository writes.

## Negative cases

### N1 — Unrelated calendar request

- Prompt: `What meetings do I have tomorrow?`
- Expected behavior: does not invoke AICtrl and uses an appropriate calendar capability or explains that calendar access is unavailable.
- Why: calendar management is outside AICtrl's project-context, backlog, and workflow scope.

### N2 — Standalone coding question

- Prompt: `Write a Python function that reverses a string.`
- Expected behavior: answers directly without invoking AICtrl.
- Why: the request does not ask for connected project context, backlog data, or workflow control.

### N3 — Unrelated external message

- Prompt: `Send an email to my team announcing tomorrow's lunch.`
- Expected behavior: does not invoke AICtrl and uses an appropriate messaging capability or explains that email access is unavailable.
- Why: general email sending is outside AICtrl's supported workflows.
