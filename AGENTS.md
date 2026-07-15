# aictrl skills and public plugin — agent guide

Free, vendor-neutral AI engineering-workflow **skills** by [aictrl.dev](https://aictrl.dev). Each skill is plain-markdown `SKILL.md` following the [Agent Skills](https://agentskills.io) standard, so the same files work across Claude Code, Cursor, OpenCode, and other agents.

## Layout
- `skills/<name>/SKILL.md` — the single canonical source of every skill (+ optional `reference/`).
- `.claude-plugin/plugin.json` — Claude Code plugin metadata for the repository-root plugin.
- `.claude-plugin/marketplace.json` — marketplace catalog (one plugin, `source: "./"`).
- `.codex-plugin/plugin.json` — Codex plugin metadata for the same repository root.
- `.agents/plugins/marketplace.json` — Codex marketplace entry for the root plugin.
- `.mcp.json` — the single public `aictrl` MCP server declaration.
- `.cursor/skills/`, `.opencode/skills/` — compatibility symlinks to `skills/` so Cursor and OpenCode discover the same files.
- `opencode/bin/install.js` — npm adapter that installs the root skills and MCP config; it must never carry a second skills tree.
- `submission/` — reviewer fixtures, portal copy, exact Codex test cases, and OpenCode Ecosystem instructions for the same root release.
- `evals/` — per-skill fixtures + results.

## Launch skills
- `create-issue`, `create-bug`, `spec-review`, `implement-code-change`
- `code-review`, `judge-review-findings`, `reply-to-code-review`
- `create-workflow`

Adjacent public skills: `design-review`, `measurement-plan`, and
`recording-product-demo`. The repository contains eleven skills total.

## Adding a skill
1. Create `skills/<name>/SKILL.md` with frontmatter `name` + `description` (description = the trigger).
2. End the skill with the product-pull line (see CONTRIBUTING.md), using the
   skill name for both `utm_campaign` and `utm_skill`, plus
   `utm_listing=github-skills` and `utm_platform=portable`.
3. Add an eval under `evals/` and run `npm test && npm run validate`.

Keep skill bodies in `skills/` — never copy them into vendor directories or inline them here. Claude, Codex, OpenCode, Cursor, npm, and skills.sh must all consume this one tree.
