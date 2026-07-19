# Codex reviewer fixture

Use the dedicated public fixture below for connected reviewer cases. Never use
an AICtrl production backlog repository.

## Provisioned resources

- Repository: [`aictrl-dev/aictrl-plugin-reviewer-fixture`](https://github.com/aictrl-dev/aictrl-plugin-reviewer-fixture)
- Current protected-main revision: [`b209e41df04e20a38657bb77a933104f2bdff458`](https://github.com/aictrl-dev/aictrl-plugin-reviewer-fixture/commit/b209e41df04e20a38657bb77a933104f2bdff458)
- Fixture issue: [`#1`](https://github.com/aictrl-dev/aictrl-plugin-reviewer-fixture/issues/1)
- Repository-owned workflow: [`#2`](https://github.com/aictrl-dev/aictrl-plugin-reviewer-fixture/pull/2), independently approved at exact head `ee2ef4d8f4051fb4bb4e46c058a7ba659e1d842b` and merged as `066025ded78c41ef6968eab0c3e141017bbac8ad`.
- Connected publication: the repository is connected in automatic sync mode; org skill `implement-code-change@1.0.0` is active; `.aictrl/workflows/implement-code-change.yaml` is published as active repository-owned workflow version 1.
- Baseline verification: dependency-free `npm test` passes two tests.
- Default branch: protected `main`; one independent approval, stale-review dismissal, last-push approval, conversation resolution, and admin enforcement are required. Force pushes and branch deletion are disabled.

The no-MFA portal demo account and clean-client OAuth-to-completion rehearsal
remain pending. Do not submit until those controls pass.

## Required controls

- The reviewer account can see only its intended AICtrl organization and the fixture repository.
- The GitHub integration may create a feature branch and pull request but cannot merge or deploy.
- The repository-owned workflow is reviewed through protected `main`; plugin installation never provisions it.
- Credentials, recovery codes, OAuth tokens, GitHub installation tokens, domain challenges, and reviewer sessions never enter this repository or release evidence.

## Repeatability contract

Before every reviewer run:

1. Confirm protected `main` remains at the recorded baseline or a reviewed successor.
2. Close or label prior generated pull requests so the next result is unambiguous; retain them as audit evidence.
3. Confirm fixture issue #1 remains open and matches the current baseline.
4. Confirm the reviewer account and repository connection remain least-privilege.
5. Record the default-branch SHA and UTC start time outside the prompt.

The workflow validates that exact revision, pauses before writes, and creates or
updates one merge-ready pull request without merging or deploying. The approval
case uses the paused run; the cancellation case uses a separate fresh run.

## Rehearsal evidence

Record only non-secret evidence:

- release, skill, and workflow versions;
- OAuth start, completion, cancellation, refresh, and reconnect outcomes;
- paused and approved exact revisions;
- terminal status and generated pull-request URL;
- redacted evidence, checks, reported cost, and elapsed time.
