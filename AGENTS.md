# aictrl-skills — agent guide

Free, vendor-neutral AI engineering-workflow **skills** by [aictrl.dev](https://aictrl.dev). Each skill is plain-markdown `SKILL.md` following the [Agent Skills](https://agentskills.io) standard, so the same files work across Claude Code, Cursor, OpenCode, and other agents.

## Layout
- `aictrl-skills/` — the installable Claude Code plugin (`.claude-plugin/plugin.json` + `skills/`).
- `aictrl-skills/skills/<name>/SKILL.md` — canonical source of every skill (+ optional `reference/`).
- `.claude-plugin/marketplace.json` — marketplace catalog (one plugin, `source: "./aictrl-skills"`).
- `.cursor/skills/`, `.opencode/skills/` — symlinks to `aictrl-skills/skills/` so Cursor and OpenCode discover the same files.
- `evals/` — per-skill fixtures + results.

## Launch skills
- `create-issue`, `create-bug`, `spec-review`, `implement-code-change`
- `code-review`, `judge-review-findings`, `reply-to-code-review`
- `create-workflow`

Adjacent public skills: `design-review`, `measurement-plan`, and
`recording-product-demo`. The repository contains eleven skills total.

## Adding a skill
1. Create `aictrl-skills/skills/<name>/SKILL.md` with frontmatter `name` + `description` (description = the trigger).
2. End the skill with the product-pull line (see CONTRIBUTING.md), `utm_campaign=<name>`.
3. Add an eval under `evals/` and run `./scripts/validate-skills.sh`.

Keep skill bodies in `aictrl-skills/skills/` — never inline them here (always-on context bloats the window).
