# Codex reviewer fixture

Use the dedicated public fixture below for connected reviewer cases. Never use
an AICtrl production backlog repository.

## Provisioned resources

- Repository: [`aictrl-dev/aictrl-plugin-reviewer-fixture`](https://github.com/aictrl-dev/aictrl-plugin-reviewer-fixture)
- Original test baseline: [`09b5d36ae163a39fe6b3f56ce347a8cb026afd2c`](https://github.com/aictrl-dev/aictrl-plugin-reviewer-fixture/commit/09b5d36ae163a39fe6b3f56ce347a8cb026afd2c)
- Current protected-main revision: [`b209e41df04e20a38657bb77a933104f2bdff458`](https://github.com/aictrl-dev/aictrl-plugin-reviewer-fixture/commit/b209e41df04e20a38657bb77a933104f2bdff458)
- Fixture issue: [`#1`](https://github.com/aictrl-dev/aictrl-plugin-reviewer-fixture/issues/1)
- Repository-owned workflow: [`#2`](https://github.com/aictrl-dev/aictrl-plugin-reviewer-fixture/pull/2), independently approved at exact head [`ee2ef4d8f4051fb4bb4e46c058a7ba659e1d842b`](https://github.com/aictrl-dev/aictrl-plugin-reviewer-fixture/commit/ee2ef4d8f4051fb4bb4e46c058a7ba659e1d842b) and merged as [`066025ded78c41ef6968eab0c3e141017bbac8ad`](https://github.com/aictrl-dev/aictrl-plugin-reviewer-fixture/commit/066025ded78c41ef6968eab0c3e141017bbac8ad).
- Workflow clarification: [`#3`](https://github.com/aictrl-dev/aictrl-plugin-reviewer-fixture/pull/3) subsequently advanced protected `main` from the PR #2 merge commit to the current revision above on 2026-07-19.
- Connected publication: the repository is connected in automatic sync mode; org skill `implement-code-change@1.0.0` is active; `.aictrl/workflows/implement-code-change.yaml` is published as active repository-owned workflow version 1.
- Baseline verification: dependency-free `npm test` passes two tests at the original test baseline and its reviewed successors.
- Default branch: protected `main`; one independent approval, stale-review dismissal, last-push approval, conversation resolution, and admin enforcement are required. Force pushes and branch deletion are disabled.

The native Codex OAuth-to-completion rehearsal is recorded below. The no-MFA
portal demo account and exact web/mobile reviewer-case rehearsal remain pending.
Do not submit until those controls pass.

## Required controls

- The reviewer account can see only its intended AICtrl organization and the fixture repository.
- The private `Plugin Reviewer` backlog contains an active `Publishing OpenAI Codex Plugin` epic and one dedicated `OpenAI plugin reviewer fixture task`; no production backlog is used.
- The GitHub integration may create a feature branch and pull request but cannot merge or deploy.
- The repository-owned workflow is reviewed through protected `main`; plugin installation never provisions it.
- Credentials, recovery codes, OAuth tokens, GitHub installation tokens, domain challenges, and reviewer sessions never enter this repository or release evidence.

## Repeatability contract

Before every reviewer run:

1. Confirm protected `main` remains at the recorded baseline or a reviewed successor.
2. Reset only the dedicated private backlog task to the repeatable values declared in P4.
3. Confirm fixture issue #1 remains open and matches the current baseline.
4. Confirm the reviewer account and repository connection remain least-privilege.
5. Confirm P5's stable idempotency key resolves to exactly one run and record the default-branch SHA and UTC start time outside the prompt.

The workflow validates that exact revision and pauses before writes. The portal
case stops after reporting the initial run state; it does not approve, merge, or
deploy.

## Rehearsal evidence

The 2026-07-19 connected rehearsal used native `codex mcp login aictrl` and
workflow run `1f1b6590-d6e1-50e1-a2c2-f1b4e5587331`. Before approval, the
run revision, required expected revision, and protected fixture `main` all
matched `b209e41df04e20a38657bb77a933104f2bdff458`. Explicit approval produced
fixture [PR #4](https://github.com/aictrl-dev/aictrl-plugin-reviewer-fixture/pull/4)
without merging or deploying. The full redacted record is attached to
[aictrl-dev/aictrl#3866](https://github.com/aictrl-dev/aictrl/issues/3866#issuecomment-5016703203).

The rehearsal also showed that the workflow projected `merge_ready` before
GitHub review had completed and omitted its declared checks output. That
platform behavior is tracked in
[aictrl-dev/aictrl#4084](https://github.com/aictrl-dev/aictrl/issues/4084);
portal materials must not describe the terminal projection as independent proof
that CI and review were complete.

Record only non-secret evidence:

- release, skill, and workflow versions;
- OAuth start, completion, cancellation, refresh, and reconnect outcomes;
- paused and approved exact revisions;
- terminal status and generated pull-request URL;
- redacted evidence, checks, reported cost, and elapsed time.
