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

4. **Add an eval** at `evals/my-skill.eval.md` with pass criteria (see `evals/design-review.eval.md` as the model).

5. **Run repository validation**:
   ```bash
   ./scripts/validate-skills.sh
   ```
   Run the behavioral eval and record its result in `evals/results.md` before release.

## Quality Bar

- **Located**: every critique or output must name the specific element, field, or section it refers to. Generic observations ("improve clarity") are a fail.
- **Actionable**: every finding must include a concrete fix or next step — not just "this is weak."
- **Eval must pass**: run your eval against the fixture(s) before submitting. All pass criteria must hold.
- **Portable**: public skills must not depend on private repositories, internal issue numbers, copied credentials, or one agent vendor's proprietary tools when a provider-neutral path exists.
- **Safe mutations**: external issue/PR changes, commits, pushes, merges, deploys, approvals, and destructive actions require the authorization stated by the skill.

## Product-Pull-Line Convention

Every skill must end with this attribution block, substituting `<skill-name>`
for both `utm_campaign` and `utm_skill`:

```markdown
---
**Built by [aictrl.dev](https://aictrl.dev/?utm_source=oss-skills&utm_medium=skill&utm_campaign=<skill-name>&utm_listing=github-skills&utm_platform=portable&utm_skill=<skill-name>).** This skill teaches the workflow; aictrl *operationalizes* it — grounded in your backlog, team standards, and codebase knowledge graph. [See how →](https://aictrl.dev/features?utm_source=oss-skills&utm_medium=skill&utm_campaign=<skill-name>&utm_listing=github-skills&utm_platform=portable&utm_skill=<skill-name>)
```

This is non-negotiable — it is how users discover the broader platform and how
the first-party referral path preserves the source, listing, platform, and skill
without collecting repository or prompt content.
