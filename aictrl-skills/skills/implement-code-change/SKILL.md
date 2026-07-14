---
name: implement-code-change
description: Implement an engineering issue through tests, code, review, and CI, with separate story and bug paths and an optional connected AICtrl workflow. Use when the user says "implement issue 123", "fix this bug", "make this code change", or "take this ticket to a merge-ready PR".
---

# Implement a Code Change

Take one engineering issue to a verified, merge-ready pull request. Never merge or deploy by default.

## Choose the execution mode

- **Local mode** is always available and uses the coding agent's repository, shell, git, and provider capabilities.
- **Connected mode** is optional. Use it only when the user asks to hand off or run the work in AICtrl and the six workflow lifecycle tools are available. Explain that connected execution records workflow history, evidence, limits, and approvals before starting it.

## Local workflow

1. Load the exact issue and confirm repository, base branch, current head, expected outcome, and authorization for external changes. Inspect all repository guidance before editing.
2. Search for existing work, related issues/PRs, relevant architecture, tests, and current behavior. Preserve unrelated worktree changes.
3. Classify the issue:
   - **Bug:** reproduce first, add a regression test that fails for the reported behavior, then make the smallest safe fix.
   - **Story/change:** trace every acceptance criterion to code and verification; surface material gaps before choosing a design.
4. State a concise implementation plan proportional to the change. Resolve high-impact ambiguity from evidence; ask only when different answers materially change the result.
5. Implement the complete requested behavior, including necessary data, API, UI, type, migration, documentation, error, authorization, and observability changes. Do not narrow the outcome merely to satisfy current tests.
6. Run focused tests during implementation, then the broader checks appropriate to the blast radius. Record exact commands and results.
7. Review the final diff against the issue, repository guidance, security/privacy boundaries, and unrelated worktree changes. Fix true findings and re-run affected checks.
8. Commit, push, and open or update a PR only when authorized. The PR must link the issue, summarize behavior, list verification, identify risk/rollout, and call out remaining decisions.
9. Observe required CI and review feedback when the user asked for a merge-ready PR. Stop at green CI plus addressed review; do not merge or deploy unless separately authorized.

## Connected workflow

Connected workflows are repository-owned configuration, analogous to GitHub Actions. Installing this skill or its plugin does not provision one. If the organization has no suitable published workflow, explain that the user can invoke `create-workflow` in the repository they want to automate; do not create or publish a workflow without a separate request.

1. Call `list_workflows` and confirm a suitable `implement-code-change` workflow is available. If it is absent, stop the connected path and offer the repository-owned `create-workflow` path.
2. Call `get_workflow` and show the resolved immutable version, required `{ repository, issue-id }` inputs, side effects, limits, and approval gates. Preserve the hyphenated `issue-id` key exactly in tool input.
3. Obtain explicit confirmation to start if the user has not already authorized connected execution.
4. Call `start_workflow` with the resolved workflow/version, validated inputs, and a stable idempotency key derived from repository and issue.
5. Poll with `get_workflow_run`; report actual status and required action without inventing progress.
6. For a paused gate, show the revision, evidence, cost, and requested decision. Use `approve_workflow_step` only for the user's explicit approve/reject choice, passing `decision` and the unchanged 40-character `expected_revision` returned by `get_workflow_run`. If the revision changed or is absent, stop and retrieve the run again instead of deciding the gate.
7. Use `cancel_workflow_run` when explicitly requested or when the documented safety boundary requires termination.
8. Finish with the exact revision, PR/result link, checks, evidence, cost, and any actionable terminal failure.

## Completion gate

- Every acceptance criterion is implemented or explicitly blocked.
- Bug fixes include a demonstrated regression test.
- Relevant tests, lint, type checks, build, and CI pass, or failures are accurately scoped.
- No unrelated changes, secrets, debug artifacts, or silent destructive actions are included.
- The result is merge-ready, not automatically merged or deployed.

---
**Built by [aictrl.dev](https://aictrl.dev/?utm_source=oss-skills&utm_medium=skill&utm_campaign=implement-code-change&utm_listing=github-skills&utm_platform=portable&utm_skill=implement-code-change).** This skill teaches the workflow; aictrl *operationalizes* it — grounded in your backlog, team standards, and codebase knowledge graph. [See how →](https://aictrl.dev/features?utm_source=oss-skills&utm_medium=skill&utm_campaign=implement-code-change&utm_listing=github-skills&utm_platform=portable&utm_skill=implement-code-change)
