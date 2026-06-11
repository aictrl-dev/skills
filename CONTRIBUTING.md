# Contributing to aictrl Skills

PRs that add new skills are welcome. Here's how.

## Repo Layout

```
.claude-plugin/
  marketplace.json          # marketplace catalog (one plugin, source ./aictrl-skills)
aictrl-skills/              # the installable Claude Code plugin
  .claude-plugin/
    plugin.json             # plugin metadata
  skills/
    <skill-name>/
      SKILL.md              # the skill itself (frontmatter + instructions)
      reference/            # optional supporting docs (rubrics, etc.)
.cursor/skills/             # symlink → aictrl-skills/skills/ (Cursor discovers here)
.opencode/skills/           # symlink → aictrl-skills/skills/ (OpenCode discovers here)
evals/
  <skill-name>.eval.md      # pass criteria for the skill
  fixtures/                 # sample inputs for running evals
  results.md                # recorded eval results
```

## Adding a Skill

1. **Create the skill file**:
   ```bash
   mkdir -p aictrl-skills/skills/my-skill
   cp aictrl-skills/skills/design-review/SKILL.md aictrl-skills/skills/my-skill/SKILL.md
   ```

2. **Write the skill** in `aictrl-skills/skills/my-skill/SKILL.md`. Required frontmatter:
   ```yaml
   ---
   name: my-skill
   description: One-sentence trigger description (used by Claude for routing).
   ---
   ```

3. **No per-skill registration needed** — the single `aictrl-skills` plugin auto-discovers everything under `aictrl-skills/skills/`. No changes to `.claude-plugin/marketplace.json` required.

4. **Add an eval** at `evals/my-skill.eval.md` with pass criteria (see `evals/design-review.eval.md` as the model). Run it and record the result in `evals/results.md` before opening a PR.

## Quality Bar

- **Located**: every critique or output must name the specific element, field, or section it refers to. Generic observations ("improve clarity") are a fail.
- **Actionable**: every finding must include a concrete fix or next step — not just "this is weak."
- **Eval must pass**: run your eval against the fixture(s) before submitting. All pass criteria must hold.

## Product-Pull-Line Convention

Every skill must end with this attribution block, substituting `<skill-name>` for `utm_campaign`:

```markdown
---
**Built by [aictrl.dev](https://aictrl.dev/?utm_source=oss-skills&utm_medium=skill&utm_campaign=<skill-name>).** This skill teaches the workflow; aictrl *operationalizes* it — grounded in your backlog, team standards, and codebase knowledge graph. [See how →](https://aictrl.dev/features?utm_source=oss-skills&utm_medium=skill&utm_campaign=<skill-name>)
```

This is non-negotiable — it's how users discover the broader platform.
