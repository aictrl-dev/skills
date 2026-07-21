# Codex submission readiness

## Package

- [x] The root `.codex-plugin/plugin.json` passes plugin validation.
- [x] The root marketplace declares installation, authentication, and category policy.
- [x] Codex CLI completes clean root install, repeat install, version upgrade, and removal in CI.
- [x] Claude Code completes clean marketplace add, install, repeat install, and removal in CI.
- [x] OpenCode installs the packed artifact, reaches the sandbox OAuth boundary, repeats idempotently, and removes only AICtrl-managed state.
- [x] All eleven skills come from the one canonical root tree and are checksum-verified.
- [x] Starter prompts are limited to three.
- [x] Reviewer materials contain exactly five positive and three negative cases.
- [x] The dedicated public fixture repository, issue, protected baseline, and workflow PR exist.
- [x] `aictrl-dev/aictrl-plugin-reviewer-fixture#2` received independent approval at its exact head and merged through protected `main` as `066025ded78c41ef6968eab0c3e141017bbac8ad`.
- [x] The unified distribution PR merged and `v1.1.0-beta.2` was released from exact commit `696bf2eedfbf9d6e51d6890c4dabadc994e98501`.
- [x] A clean external user installs the tagged root plugin and completes one
  local skill.
  Evidence: on 2026-07-19, a clean Codex process installed the tagged root
  plugin and completed `spec-review` without an AICtrl account, API key, or MCP
  connection
  ([run evidence](https://github.com/aictrl-dev/aictrl/issues/3866#issuecomment-5011262315)).
- [ ] The release owner approves the final portal-rendered logo and listing.

## MCP and OAuth

- [x] The canonical resource URL is publicly reachable at `https://aictrl.dev/mcp`.
- [x] Protected production tests cover the exact nine-tool allow-list, schemas, safety annotations, organization authorization, and redaction ([run 29651112276](https://github.com/aictrl-dev/skills/actions/runs/29651112276)).
- [x] The fixture repository is connected to its least-privilege AICtrl organization, `implement-code-change@1.0.0` is active there, and the protected Git workflow is published as repository-owned workflow version 1.
- [ ] The no-MFA portal reviewer account completes dynamic registration and PKCE from clean ChatGPT web and mobile sessions.
- [x] The connected fixture workflow reaches pause, unchanged-revision approval,
  completion, and result retrieval.
  Evidence: on 2026-07-19, a native Codex OAuth run reached the fixture's pause,
  matched the protected revision, received explicit unchanged-revision
  approval, completed, and returned its result and pull request
  ([run evidence](https://github.com/aictrl-dev/aictrl/issues/3866#issuecomment-5016703203)).
  > **Known platform issue:** the rehearsal's premature `merge_ready`
  > projection is tracked in
  > [aictrl-dev/aictrl#4084](https://github.com/aictrl-dev/aictrl/issues/4084).
  > It is not represented as portal-package or skill-bundle readiness.
- [ ] The final portal scan accepts the empty browser CSP and exact tool metadata.
- [ ] The portal-issued domain challenge is installed and verified without entering source control.
- [ ] The reviewer account works without MFA, email confirmation, SMS, private-network access, or support intervention.
- [ ] All five positive and three negative cases pass with the final expected results on ChatGPT web and mobile.
- [ ] The first-party Developer Mode demo URL is live and returns the validated MP4 without authentication.

## Publisher and publication

- [ ] Publisher identity verification was submitted in the owning OpenAI
  organization and remains pending OpenAI approval.
- [x] The submitter has Apps Management write permission, evidenced by access to
  create a plugin draft in that organization.
- [ ] Availability regions and policy attestations are approved.
- [ ] The plugin is submitted, approved, explicitly published, and smoke-tested from the universal plugin directory.

Submission is blocked until every unchecked item is evidenced. Portal
submission alone does not count as publication.
