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
- [ ] `aictrl-dev/aictrl-plugin-reviewer-fixture#2` receives independent approval and merges through protected `main`.
- [ ] The unified distribution PR merges and `v1.1.0-beta.2` is released from its exact commit.
- [ ] A clean external user installs the tagged root plugin and completes one local skill.
- [ ] The release owner approves the final portal-rendered logo and listing.

## MCP and OAuth

- [x] The canonical resource URL is publicly reachable at `https://aictrl.dev/mcp`.
- [x] Protected production tests cover the exact six-tool allow-list, schemas, safety annotations, organization authorization, and redaction.
- [ ] A clean Codex/ChatGPT client completes dynamic registration, PKCE, OAuth cancellation/retry, refresh, and reconnect.
- [ ] The connected fixture workflow reaches pause, unchanged-revision approval, completion, and result retrieval.
- [ ] The final portal scan accepts the empty browser CSP and exact tool metadata.
- [ ] The portal-issued domain challenge is installed and verified without entering source control.
- [ ] The reviewer account works without MFA, email confirmation, SMS, private-network access, or support intervention.

## Publisher and publication

- [x] The publisher identity is verified in the owning OpenAI organization.
- [x] The submitter has Apps Management write permission in that organization.
- [ ] Availability regions and policy attestations are approved.
- [ ] The plugin is submitted, approved, explicitly published, and smoke-tested from the universal plugin directory.

Submission is blocked until every unchecked item is evidenced. Portal
submission alone does not count as publication.
