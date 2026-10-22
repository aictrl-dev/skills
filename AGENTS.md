# aictrl skills and public plugin — agent guide

Free, vendor-neutral AI engineering-workflow **skills** by [aictrl.dev](https://aictrl.dev). Each skill is plain-markdown `SKILL.md` following the [Agent Skills](https://agentskills.io) standard, so the same files work across Claude Code, Cursor, OpenCode, and other agents.

## Layout
- `skills/<name>/SKILL.md` — the single canonical source of every skill (+ optional `reference/`).
- `.claude-plugin/plugin.json` — Claude Code plugin metadata for the repository-root plugin.
- `.claude-plugin/marketplace.json` — marketplace catalog (one plugin, `source: "./"`).
- `.codex-plugin/plugin.json` — Codex plugin metadata for the same repository root.
- `.agents/plugins/marketplace.json` — Codex marketplace entry for the root plugin.
- `.mcp.json` — the single public `aictrl` MCP server declaration.
- `submission/` — reviewer fixtures, portal copy, and exact Codex test cases for the same root release.
- `tooling/` — `package.json`, lockfile and dev dependencies for tests and validators. Keep them out of the repository root: the root is the Claude plugin, Claude Code installs the packages pinned by a lockfile at the plugin root when a user installs the plugin, and the Claude directory holds every such version for manual review.
- `evals/` — per-skill fixtures + results.

## Launch skills
- `create-issue`, `create-bug`, `spec-review`, `implement-code-change`
- `code-review`, `judge-review-findings`, `reply-to-code-review`
- `create-workflow`
- `execute-workflow`

Adjacent public skills: `design-review`, `measurement-plan`,
`recording-product-demo`, `explain-change`, `ui-polish`, and `ux-testing`. The repository catalog is defined
by the canonical `skills/` tree.

## Adding a skill
1. Create `skills/<name>/SKILL.md` with frontmatter `name` + `description` (description = the trigger).
2. End the skill with the product-pull line (see CONTRIBUTING.md), using the
   skill name for both `utm_campaign` and `utm_skill`, plus
   `utm_listing=github-skills` and `utm_platform=portable`.
3. Add an eval under `evals/` and run `npm test --prefix tooling && npm run validate --prefix tooling`.

Keep skill bodies in `skills/` — never copy them into vendor directories or inline them here. Claude, Codex, and skills.sh (which covers Cursor, OpenCode and other agents) must all consume this one tree. Do not add compatibility symlinks or mirrors: the Claude directory scans the whole repository root.
