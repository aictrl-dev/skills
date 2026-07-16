# OpenCode Ecosystem submission

Do not open the upstream issue or PR until `@aictrl/opencode` is publicly
installable and that exact version passes the clean lifecycle smoke. Keep
aictrl-dev/aictrl#3865 open until the upstream PR is merged and the live link is
smoke-tested.

## Current upstream contract

- Repository: `anomalyco/opencode`
- Base branch: `dev`
- File: `packages/web/src/content/docs/ecosystem.mdx`
- Section: `Plugins`
- Required sequence: feature-request issue, then one-row documentation PR using the repository template.

Re-check the branch, file, template, and duplicate issues immediately before
submission; upstream policy is external and may change.

## Preconditions

```bash
npm view @aictrl/opencode version dist-tags --json
npx @aictrl/opencode@beta --project .
opencode mcp list
npx @aictrl/opencode@beta --project . --uninstall
```

Record package version/integrity, `beta` dist-tag, clean install, canonical MCP
URL, OAuth-required boundary, uninstall result, and UTC time.

## Upstream issue

Title: `[FEATURE]: List @aictrl/opencode in the Ecosystem`

Use the feature-request form and confirm its duplicate checkbox. Description:

> Add `@aictrl/opencode` to the Plugins table. It gives OpenCode users eleven
> portable SDLC skills plus an optional OAuth-connected AICtrl workflow MCP.
> The public npm package has passed clean install, MCP discovery, repeat install,
> and uninstall verification.

## One-row documentation change

Append one row to the English `Plugins` table, matching its current alignment:

```markdown
| [@aictrl/opencode](https://github.com/aictrl-dev/skills)                                      | Install eleven portable SDLC skills and optional OAuth-connected AICtrl workflows                 |
```

PR title: `docs: add AICtrl to the OpenCode ecosystem`

Complete the upstream PR template with the issue closing reference, mark only
Documentation, describe the single row, record the published version and clean
lifecycle commands, mark both checklist items, and use `N/A` for screenshots.
Do not expand beyond the English table unless a maintainer requests it.

## After merge

Verify the live Ecosystem link, install from a clean OpenCode client, complete
one local skill and one connected OAuth workflow smoke, then record the upstream
issue, PR, merge commit, live URL, package version, and evidence on #3865.
